import { HttpClientTestingModule } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import type { TableView } from '@money/domain';
import { CashflowCardTextService } from '../shared/services/cashflow-card-text.service';
import { DatabaseService } from '../shared/services/database.service';
import { RemoteGameHook } from '../shared/services/remote-game';
import { TableLayerComponent } from './table-layer.component';
import { TableModeService } from './table-mode.service';
import type { TableSessionService } from './table-session.service';

const player = (seat: number, name: string, extra: Record<string, unknown> = {}) => ({
  seat,
  name,
  color: '#abc',
  status: 'active',
  away: false,
  bot: null,
  books: null,
  ...extra,
});

const view = (patch: Record<string, unknown> = {}): TableView =>
  ({
    phase: 'playing',
    youSeat: 1,
    activeSeat: 0,
    tableRound: 3,
    holdSeats: [],
    settings: { clock: { mode: 'none' }, showProgress: true },
    clock: { deadlineAt: null, pausedAt: null, banksMs: [], timeouts: [] },
    players: [player(0, 'Ann'), player(1, 'Ben'), player(2, 'Rob', { bot: { policyId: 'x' } })],
    decks: {},
    ...patch,
  }) as unknown as TableView;

function render(table: TableView, canDone: boolean | string[] = false) {
  const play = jest.fn(async () => true);
  const session = {
    view: signal(table),
    events: signal([{ seq: 1, version: 2, at: '', type: 'rolled', seat: 0 }]),
    can: (action: string) =>
      Array.isArray(canDone) ? canDone.includes(action) : canDone && action === 'done',
    play,
    busy: signal(false),
    close: jest.fn(),
    problem: signal<string | null>(null),
  } as unknown as TableSessionService;
  TestBed.configureTestingModule({
    imports: [HttpClientTestingModule],
    providers: [
      // the printed card texts come from files: here the card's own title and numbers are enough
      {
        provide: CashflowCardTextService,
        useValue: { ensureLoaded: async () => undefined, textFor: () => ({}) },
      },
    ],
  });
  // the books on the app are the layer's neighbour's business; here only what the layer itself reads
  jest.spyOn(TableModeService.prototype, 'show').mockImplementation(() => undefined);
  TestBed.inject(TableModeService).begin(session, 'en', false);
  const fixture = TestBed.createComponent(TableLayerComponent);
  fixture.detectChanges();
  return { fixture, play, session, mode: TestBed.inject(TableModeService) };
}

describe('TableLayerComponent', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    DatabaseService.readOnly = false;
    RemoteGameHook.current = null;
    RemoteGameHook.layer = null;
    RemoteGameHook.onMenuEntry = null;
  });

  it('says whose turn it is, the round, and lists the players with a tag for me and the bot', () => {
    const { fixture } = render(view());
    const text = fixture.nativeElement.textContent;
    expect(text).toContain("Ann's turn");
    expect(text).toContain('Table round 3');
    expect(text).toContain('Ben');
    expect(text).toContain('you');
    expect(text).toContain('bot');
  });

  it('shows who is out of the game and where everybody stands, so a player knows their chances', () => {
    const { fixture } = render(
      view({
        standings: [
          { seat: 2, rank: 1, outcome: 'escaped' },
          { seat: 0, rank: 2, outcome: 'playing' },
          { seat: 1, rank: 3, outcome: 'bankrupt' },
        ],
      }),
    );
    const chips = Array.from<HTMLElement>(fixture.nativeElement.querySelectorAll('.tl-player'));
    const place = (index: number) => chips[index].querySelector('.tl-place')?.textContent?.trim();
    expect(place(0)).toBe('#2'); // Ann, still playing: her place as it is now
    expect(place(1)).toBe('✖ #3'); // Ben went bankrupt: last, and out
    expect(place(2)).toBe('🥇 #1'); // the bot got out first
    expect(chips[1].classList).toContain('tl-player--bankrupt');
    expect(chips[2].classList).toContain('tl-player--out');
    expect(chips[0].classList).not.toContain('tl-player--out');
  });

  it('says it is my turn when it is', () => {
    const { fixture } = render(view({ activeSeat: 1 }));
    expect(fixture.nativeElement.textContent).toContain('Your turn');
  });

  it('shows who the table waits for; the button to go on is in the game screen, not here', () => {
    const waiting = render(view({ holdSeats: [0] }));
    expect(waiting.fixture.nativeElement.textContent).toContain('Waiting for Ann');
    const buttons = Array.from<HTMLButtonElement>(
      waiting.fixture.nativeElement.querySelectorAll('button'),
    ).map((b) => b.textContent!.trim());
    expect(buttons.join('|')).not.toMatch(/Continue|End turn/);
  });

  it('tells a seller that the table waits for them', () => {
    const mine = {
      state: {
        marketOffers: [{ title: 'EFH', label: '+20%', salePriceMinor: 9000000, cardId: 'c' }],
      },
    };
    const seller = render(
      view({
        holdSeats: [1],
        players: [player(0, 'Ann'), player(1, 'Ben', { books: mine })],
      }),
      ['sell_position'],
    );
    expect(seller.fixture.nativeElement.textContent).toContain('Sell if you want to');
  });

  it('tells the one who only ends their turn nothing: the button says it', () => {
    const mover = render(view({ holdSeats: [1] }));
    expect(mover.fixture.nativeElement.textContent).not.toContain('Sell if you want to');
  });

  it('looking at a player says so and Back goes to my books', () => {
    const { fixture, mode } = render(view());
    const chips = fixture.nativeElement.querySelectorAll('.tl-player');
    (chips[0] as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(mode.looking()).toBe(0);
    expect(fixture.nativeElement.textContent).toContain(
      "You are looking at Ann's books - read only.",
    );
    const back = Array.from<HTMLButtonElement>(
      fixture.nativeElement.querySelectorAll('button'),
    ).find((b) => b.textContent!.includes('Back to my books'))!;
    back.click();
    fixture.detectChanges();
    expect(mode.looking()).toBeNull();
  });

  it('counts the time down from the server deadline', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-10-16T10:00:00Z'));
    const { fixture } = render(
      view({
        settings: { clock: { mode: 'per-move', secondsPerMove: 60 } },
        clock: {
          deadlineAt: Date.parse('2026-10-16T10:00:42Z'),
          pausedAt: null,
          banksMs: [],
          timeouts: [],
        },
      }),
    );
    expect(fixture.nativeElement.textContent).toContain('0:42');
    jest.useRealTimers();
  });

  it('a refusal hangs over the wheel with an x instead of pushing the page down, and stays hidden once hidden', () => {
    const { fixture, session } = render(view());
    (session.problem as unknown as ReturnType<typeof signal<string | null>>).set('Not your turn.');
    fixture.detectChanges();
    const float = fixture.nativeElement.querySelector('.tl-float') as HTMLElement;
    expect(float.textContent).toContain('Not your turn.');
    (float.querySelector('.tl-float-x') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.tl-problem')).toBeNull();
    // a different refusal shows again
    (session.problem as unknown as ReturnType<typeof signal<string | null>>).set('Too late.');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.tl-problem')).not.toBeNull();
  });

  it('lists the buyers waiting for me and sells into one', () => {
    const mine = {
      state: {
        marketOffers: [{ title: 'EFH', label: '+20%', salePriceMinor: 9000000, cardId: 'c' }],
      },
    };
    const { fixture, play } = render(
      view({
        players: [
          player(0, 'Ann'),
          player(1, 'Ben', { books: mine }),
          player(2, 'Rob', { bot: { policyId: 'x' } }),
        ],
      }),
      ['sell_position'],
    );
    expect(fixture.nativeElement.textContent).toContain('Buyers waiting for you');
    expect(fixture.nativeElement.textContent).toContain('EFH');
    const sell = Array.from<HTMLButtonElement>(
      fixture.nativeElement.querySelectorAll('button'),
    ).find((b) => b.textContent!.trim() === 'Sell')!;
    sell.click();
    expect(play).toHaveBeenCalledWith({ type: 'sell_position', input: { title: 'EFH' } });
  });

  it('shows a card offered to me as a card, with what it would do to me, and lets me take it or turn it down', () => {
    const offer = {
      sellerSeat: 0,
      cardId: 'classic-small-efh-45k-2k',
      deck: 'dealSmall',
      toSeat: null,
      priceMinor: 500000,
      counters: [],
      declinedSeats: [],
      at: 1,
      you: {
        quote: {
          ok: true,
          reason: null,
          priceMinor: 500000,
          loanMinor: 100000,
          cashflowAfterMinor: 34500,
        },
        maxPriceMinor: 3000000,
      },
    };
    const { fixture, play } = render(
      view({
        trade: offer,
        settings: { clock: { mode: 'none' }, showProgress: true, gameSetId: 'cashflow' },
      }),
      ['accept_trade', 'counter_trade', 'decline_trade'],
    );
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Ann offers this card to the table');
    expect(text).toMatch(/Down payment/); // the card as it is, with its own terms
    expect(text).toMatch(/Asking price/);
    expect(text).toMatch(/Bank loan taken first/);
    const buttons = () =>
      Array.from<HTMLButtonElement>(fixture.nativeElement.querySelectorAll('.to-panel button'));
    buttons()
      .find((b) => b.textContent!.includes('Buy for'))!
      .click();
    expect(play).toHaveBeenCalledWith({ type: 'accept_trade' });
    buttons()
      .find((b) => b.textContent!.includes('No thanks'))!
      .click();
    expect(play).toHaveBeenCalledWith({ type: 'decline_trade' });
  });

  it('a card I cannot afford cannot be taken: the reason is told and only an offer within my means is possible', () => {
    const { fixture, play } = render(
      view({
        trade: {
          sellerSeat: 0,
          cardId: 'classic-small-efh-45k-2k',
          deck: 'dealSmall',
          toSeat: null,
          priceMinor: 9000000,
          counters: [],
          declinedSeats: [],
          you: {
            quote: {
              ok: false,
              reason: 'Your monthly cashflow would be -500.',
              priceMinor: 9000000,
              loanMinor: 9000000,
              cashflowAfterMinor: null,
            },
            maxPriceMinor: 1200000,
          },
        },
      }),
      ['counter_trade', 'decline_trade'],
    );
    const panel: HTMLElement = fixture.nativeElement.querySelector('.to-panel');
    expect(panel.textContent).toContain('You cannot take it: Your monthly cashflow would be -500.');
    const buy = Array.from<HTMLButtonElement>(panel.querySelectorAll('button')).find((b) =>
      b.textContent!.includes('Buy for'),
    )!;
    expect(buy.disabled).toBe(true);
    const input: HTMLInputElement = panel.querySelector('.to-input')!;
    input.value = '30000'; // more than the 12.000 I can afford
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    const offerButton = () =>
      Array.from<HTMLButtonElement>(panel.querySelectorAll('button')).find((b) =>
        b.textContent!.includes('Make an offer'),
      )!;
    expect(offerButton().disabled).toBe(true);
    input.value = '10000';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(offerButton().disabled).toBe(false);
    offerButton().click();
    expect(play).toHaveBeenCalledWith({ type: 'counter_trade', priceMinor: 1000000 });
  });

  it('shows the seller the offers that came in, to accept or take the card back', () => {
    const { fixture, play } = render(
      view({
        youSeat: 0,
        activeSeat: 0,
        trade: {
          sellerSeat: 0,
          cardId: 'classic-small-efh-45k-2k',
          deck: 'dealSmall',
          toSeat: null,
          priceMinor: 500000,
          counters: [{ seat: 1, priceMinor: 300000 }],
          declinedSeats: [],
        },
      }),
      ['accept_trade', 'withdraw_trade'],
    );
    const panel: HTMLElement = fixture.nativeElement.querySelector('.to-panel');
    expect(panel.textContent).toContain('Your card on the table');
    expect(panel.textContent).toContain('Ben');
    Array.from<HTMLButtonElement>(panel.querySelectorAll('button'))
      .find((b) => b.textContent!.includes('Accept'))!
      .click();
    expect(play).toHaveBeenCalledWith({ type: 'accept_trade', fromSeat: 1 });
    Array.from<HTMLButtonElement>(panel.querySelectorAll('button'))
      .find((b) => b.textContent!.includes('Take it back'))!
      .click();
    expect(play).toHaveBeenCalledWith({ type: 'withdraw_trade' });
  });

  it('nobody else sees an offer that is not theirs to answer', () => {
    const { fixture } = render(
      view({
        trade: {
          sellerSeat: 2,
          cardId: 'classic-small-efh-45k-2k',
          deck: 'dealSmall',
          toSeat: 0,
          priceMinor: 500000,
          counters: [],
          declinedSeats: [],
        },
      }),
    );
    expect(fixture.nativeElement.querySelector('.to-panel')).toBeNull();
  });

  it('shows an open undo vote and lets me answer it', () => {
    const { fixture, play } = render(
      view({
        undo: { proposerSeat: 0, yesSeats: [0], noSeats: [], voterSeats: [0, 1, 2] },
      }),
      ['vote_undo'],
    );
    expect(fixture.nativeElement.textContent).toContain(
      'Ann asks to go back one turn - 1 of 3 say yes.',
    );
    const yes = Array.from<HTMLButtonElement>(
      fixture.nativeElement.querySelectorAll('button'),
    ).find((b) => b.textContent!.trim() === 'Yes')!;
    yes.click();
    expect(play).toHaveBeenCalledWith({ type: 'vote_undo', yes: true });
  });

  it('the blue highlight follows the player looked at, the one on the move has a marker', () => {
    const { fixture, mode } = render(view());
    const chips = () =>
      Array.from<HTMLElement>(fixture.nativeElement.querySelectorAll('.tl-player'));
    expect(chips()[1].classList.contains('tl-player--looked')).toBe(true);
    // the one on the move wears its own colour, a glow and a "playing" label
    expect(chips()[0].classList.contains('tl-player--active')).toBe(true);
    expect(chips()[0].querySelector('.tl-playing')?.textContent).toContain('playing');
    expect(chips()[1].querySelector('.tl-playing')).toBeNull();
    (chips()[0] as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(mode.looking()).toBe(0);
    expect(chips()[0].classList.contains('tl-player--looked')).toBe(true);
    expect(chips()[1].classList.contains('tl-player--looked')).toBe(false);
  });

  it('lists the players in the order they play, the one on the move first - and the one who just played last', () => {
    const names = (fixture: { nativeElement: HTMLElement }) =>
      Array.from<HTMLElement>(fixture.nativeElement.querySelectorAll('.tl-player')).map((chip) =>
        chip.querySelector('.tl-name')!.textContent!.trim(),
      );
    const seen = (table: TableView) => {
      TestBed.resetTestingModule();
      return names(render(table).fixture);
    };
    expect(seen(view({ activeSeat: 0, order: [0, 1, 2] }))).toEqual(['Ann', 'Ben', 'Rob']);
    expect(seen(view({ activeSeat: 1, order: [0, 1, 2] }))).toEqual(['Ben', 'Rob', 'Ann']);
    // the order they play is the table's own, not the order of the seats
    expect(seen(view({ activeSeat: 2, order: [2, 0, 1] }))).toEqual(['Rob', 'Ann', 'Ben']);
  });

  it('hides the progress of all players when the table was opened without it', () => {
    const { fixture } = render(
      view({ settings: { clock: { mode: 'none' }, showProgress: false } }),
    );
    expect(fixture.nativeElement.textContent).toContain('Ben');
    expect(fixture.nativeElement.textContent).not.toMatch(/\d+%/);
  });
});
