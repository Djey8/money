import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { mergeTableView, TableSessionService } from './table-session.service';

class FakeEventSource {
  static last: FakeEventSource;
  static CLOSED = 2;
  static OPEN = 1;
  readyState = 1;
  onopen: (() => void) | null = null;
  onerror: (() => void) | null = null;
  closed = false;
  private handlers = new Map<string, ((m: { data: string }) => void)[]>();
  constructor(
    public url: string,
    public init?: { withCredentials?: boolean },
  ) {
    FakeEventSource.last = this;
  }
  addEventListener(name: string, handler: (m: { data: string }) => void) {
    this.handlers.set(name, [...(this.handlers.get(name) ?? []), handler]);
  }
  close() {
    this.closed = true;
    this.readyState = 2;
  }
  emit(name: string, data: unknown) {
    for (const h of this.handlers.get(name) ?? []) h({ data: JSON.stringify(data) });
  }
}

const player = (seat: number, books?: unknown) => ({
  seat,
  name: `P${seat}`,
  ...(books !== undefined ? { books } : {}),
});
const view = (version: number, players: unknown[]) => ({ id: 'r1', version, players });

describe('mergeTableView', () => {
  it('keeps the books of a player an update leaves out, takes the ones it carries', () => {
    const before = view(1, [player(0, { n: 'a' }), player(1, { n: 'b' })]) as never;
    const merged = mergeTableView(before, view(2, [player(0), player(1, { n: 'b2' })]) as never);
    expect((merged.players[0] as never as { books: unknown }).books).toEqual({ n: 'a' });
    expect((merged.players[1] as never as { books: unknown }).books).toEqual({ n: 'b2' });
    expect(merged.version).toBe(2);
  });
});

describe('TableSessionService', () => {
  let service: TableSessionService;
  let http: HttpTestingController;
  const original = (globalThis as { EventSource?: unknown }).EventSource;

  beforeEach(() => {
    (globalThis as { EventSource?: unknown }).EventSource = FakeEventSource;
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), TableSessionService],
    });
    service = TestBed.inject(TableSessionService);
    http = TestBed.inject(HttpTestingController);
    service.open('r1');
  });

  afterEach(() => {
    service.close();
    (globalThis as { EventSource?: unknown }).EventSource = original;
  });

  it('follows the stream with the session cookie', () => {
    expect(FakeEventSource.last.url).toContain('/v1/game/rooms/r1/events');
    expect(FakeEventSource.last.init?.withCredentials).toBe(true);
    FakeEventSource.last.onopen?.();
    expect(service.connection()).toBe('live');
    FakeEventSource.last.onerror?.();
    expect(service.connection()).toBe('reconnecting');
  });

  it('builds the table from a snapshot and its updates, and ignores a replayed one', () => {
    const source = FakeEventSource.last;
    source.emit('snapshot', {
      room: { id: 'r1', inviteCode: 'ABC' },
      view: view(5, [player(0, { n: 'a' })]),
      legalActions: [{ action: 'roll', description: '' }],
    });
    expect(service.room()?.inviteCode).toBe('ABC');
    expect(service.can('roll')).toBe(true);
    source.emit('update', {
      version: 6,
      view: view(6, [player(0)]),
      legalActions: [],
      events: [{ seq: 1, version: 6, at: '', type: 'rolled', seat: 0 }],
    });
    expect(service.view()?.version).toBe(6);
    expect((service.view()!.players[0] as never as { books: unknown }).books).toEqual({ n: 'a' });
    expect(service.can('roll')).toBe(false);
    // a replay after a reconnect changes nothing
    source.emit('update', {
      version: 6,
      view: view(6, [player(0, { n: 'x' })]),
      legalActions: [],
      events: [],
    });
    expect((service.view()!.players[0] as never as { books: unknown }).books).toEqual({ n: 'a' });
    // events are kept once, in order
    source.emit('log', { seq: 1, version: 6, at: '', type: 'rolled', seat: 0 });
    source.emit('log', { seq: 0, version: 5, at: '', type: 'started', seat: null });
    expect(service.events().map((e) => e.seq)).toEqual([0, 1]);
  });

  it('plays one move with a command id, and no expected version: the server judges it when its turn comes', async () => {
    FakeEventSource.last.emit('snapshot', {
      room: { id: 'r1' },
      view: view(7, []),
      legalActions: [],
    });
    const done = service.play({ type: 'roll' });
    const req = http.expectOne((r) => r.url.endsWith('/v1/game/rooms/r1/commands'));
    expect(req.request.method).toBe('POST');
    expect(req.request.body.command).toEqual({ type: 'roll' });
    expect(req.request.body.expectedVersion).toBeUndefined();
    expect(req.request.body.clientCommandId).toMatch(/^c[a-z0-9]+$/);
    req.flush({});
    expect(await done).toBe(true);
  });

  it("shows a refused move's own words and sends nothing twice", async () => {
    const done = service.play({ type: 'roll' });
    http
      .expectOne((r) => r.url.endsWith('/commands'))
      .flush({ detail: 'It is not your turn.' }, { status: 409, statusText: 'Conflict' });
    expect(await done).toBe(false);
    expect(service.problem()).toBe('It is not your turn.');
    expect(service.busy()).toBe(false);
  });

  it('loads the whole record of the table when it is opened, so a game joined again has its history', async () => {
    // opened in beforeEach: its first request is the log from the start
    const first = http.expectOne((r) => r.url.endsWith('/r1/log?after=0&limit=1000'));
    first.flush({
      events: [
        { seq: 1, version: 2, at: 'a', type: 'rolled', seat: 0 },
        { seq: 2, version: 3, at: 'b', type: 'card_drawn', seat: 0 },
      ],
      next: 2,
      end: false,
    });
    await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve));
    const second = http.expectOne((r) => r.url.endsWith('/r1/log?after=2&limit=1000'));
    second.flush({
      events: [{ seq: 3, version: 4, at: 'c', type: 'card_passed', seat: 0 }],
      next: 3,
      end: true,
    });
    await new Promise((resolve) => setTimeout(resolve));
    // a live update that repeats the last line adds nothing twice
    FakeEventSource.last.emit('log', { seq: 3, version: 4, at: 'c', type: 'card_passed', seat: 0 });
    expect(service.events().map((e) => e.seq)).toEqual([1, 2, 3]);
  });

  it('catches up by itself when the table moved on without this screen, and says nothing about it', async () => {
    service.open('r1');
    FakeEventSource.last.emit('snapshot', {
      room: { id: 'r1' },
      view: view(1, [player(0, {})]),
      legalActions: [],
    });
    expect(service.view()!.version).toBe(1);
    const resynced = service.resync();
    http
      .expectOne((r) => r.method === 'GET' && r.url.endsWith('/rooms/r1'))
      .flush({ table: view(4, [player(0, { n: 'fresh' })]), legalActions: [{ action: 'roll' }] });
    await resynced;
    expect(service.view()!.version).toBe(4);
    expect(service.can('roll')).toBe(true);
    expect(service.offline()).toBe(false);
  });

  it('a move refused because the table had moved on is not a problem to show: the table is read afresh', async () => {
    service.open('r1');
    FakeEventSource.last.emit('snapshot', {
      room: { id: 'r1' },
      view: view(1, [player(0, {})]),
      legalActions: [],
    });
    const done = service.play({ type: 'roll' });
    http
      .expectOne((r) => r.url.endsWith('/rooms/r1/commands'))
      .flush({ code: 'room_conflict', detail: 'changed' }, { status: 409, statusText: 'Conflict' });
    expect(await done).toBe(false);
    expect(service.problem()).toBeNull();
    http
      .expectOne((r) => r.method === 'GET' && r.url.endsWith('/rooms/r1'))
      .flush({ table: view(2, [player(0, {})]), legalActions: [] });
    await Promise.resolve();
  });

  it('knows when the line is gone: after it had been live, a broken stream is lost until it is back', () => {
    service.open('r1');
    expect(service.everLive()).toBe(false);
    FakeEventSource.last.onopen!();
    expect(service.everLive()).toBe(true);
    FakeEventSource.last.readyState = 0;
    FakeEventSource.last.onerror!();
    expect(service.connection()).toBe('reconnecting');
  });
});
