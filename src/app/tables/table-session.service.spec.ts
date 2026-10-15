import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { mergeTableView, TableSessionService } from './table-session.service';

class FakeEventSource {
  static last: FakeEventSource;
  static CLOSED = 2;
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

  it('plays one move with a command id and the version it read', async () => {
    FakeEventSource.last.emit('snapshot', {
      room: { id: 'r1' },
      view: view(7, []),
      legalActions: [],
    });
    const done = service.play({ type: 'roll' });
    const req = http.expectOne((r) => r.url.endsWith('/v1/game/rooms/r1/commands'));
    expect(req.request.method).toBe('POST');
    expect(req.request.body.command).toEqual({ type: 'roll' });
    expect(req.request.body.expectedVersion).toBe(7);
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
});
