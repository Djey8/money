import { signal } from '@angular/core';
import { CLASSIC_RAT_RACE_BOARD, moveToken, type TableView } from '@money/domain';
import type { TableEventLine } from './table-session.service';
import { tableLayerTexts, type TableLayerTexts } from './table-layer.texts';

/** What the stage shows while another player's move is told: who, what they do, and the dice / card / money it is about. */
export interface Stage {
  seat: number;
  who: string;
  color: string;
  headline: string;
  dice?: number[];
  tumbling?: boolean;
  card?: {
    title: string;
    deck: string;
    tone: 'deal' | 'market' | 'doodad';
    lines: string[];
    text?: string;
  };
  patch?: { text: string; tone: 'plus' | 'minus' | 'neutral' };
}

const MESSAGES_KEY = 'mm.tables.messages';
function readMessages(): boolean {
  try {
    return localStorage.getItem(MESSAGES_KEY) !== '0';
  } catch {
    return true;
  }
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const money = (minor: number): string =>
  (Math.abs(minor) / 100).toLocaleString(undefined, { maximumFractionDigits: 0 });

/** Events of other players that are told on the stage; the rest (bookkeeping) is not. */
const TOLD = new Set([
  'rolled',
  'card_drawn',
  'card_played',
  'card_passed',
  'market_card_played',
  'dice_decided',
  'position_sold',
  'loan_changed',
  'trade_offered',
  'trade_made',
  'player_escaped',
  'player_bankrupt',
]);

/**
 * Tells the other players' moves round by round (JFK, 2026-10-17): their dice tumble, their token walks space by space, the card
 * they draw is shown, what they pay or get appears as a little patch - one move after the other, at a pace people can follow.
 * The table's books are already up to date when an event arrives, so nothing here changes the game: it only holds the tokens
 * where they were until the walk has been shown (`tokenAt`) and draws the `stage`. While it runs (`busy`) the player cannot
 * continue to the next turn, so nobody misses what happened.
 *
 * A plain class around signals: no timers of its own beyond the awaited pauses, and `stop()` ends the show at once.
 */
export class TablePresenter {
  readonly stage = signal<Stage | null>(null);
  /** Token positions to draw instead of the books' while a walk is told, by seat. */
  readonly tokenAt = signal<Record<number, number | null>>({});
  readonly busy = signal(false);
  /** The events (by their number) that are queued or being told: the history does not mention them before the story has got there. */
  readonly unfinished = signal<ReadonlySet<number>>(new Set());
  /** Of those, the rolls whose dice have come to rest: the history may say what was rolled, not yet where the token lands. */
  readonly rested = signal<ReadonlySet<number>>(new Set());
  private markTold(seq: number, kind: 'start' | 'rest' | 'done'): void {
    const edit = (set: ReadonlySet<number>, add: boolean) => {
      const next = new Set(set);
      if (add) next.add(seq);
      else next.delete(seq);
      return next;
    };
    if (kind === 'start') this.unfinished.update((set) => edit(set, true));
    if (kind === 'rest') this.rested.update((set) => edit(set, true));
    if (kind === 'done') {
      this.unfinished.update((set) => edit(set, false));
      this.rested.update((set) => edit(set, false));
    }
  }
  /** Whether the messages about the others' moves float over the screen (the telling itself goes on either way). */
  readonly messages = signal(readMessages());
  setMessages(on: boolean): void {
    this.messages.set(on);
    if (!on) this.stage.set(null);
    try {
      localStorage.setItem(MESSAGES_KEY, on ? '1' : '0');
    } catch {
      // a convenience only
    }
  }
  /** The dice of the roll being told: shown in the game screen's own dice, next to the roll button. */
  readonly dice = signal<{ faces: number[]; tumbling: boolean } | null>(null);

  private queue: { line: TableEventLine; view: TableView }[] = [];
  /** The card each player has in hand, so that passing or finishing it can say which one. */
  private readonly inHand = new Map<number, string>();
  private running = false;
  private stopped = false;

  constructor(
    private readonly lang: () => string,
    /** How long a beat of the telling lasts, as a factor (the table's pace); tests make it zero. */
    private readonly beatOf: number | (() => number) = 1,
  ) {}

  private get beat(): number {
    return typeof this.beatOf === 'function' ? this.beatOf() : this.beatOf;
  }

  private get t(): TableLayerTexts {
    return tableLayerTexts(this.lang());
  }

  /** The events a table update brought, before its books are shown: the walks they tell start from where tokens were. */
  push(lines: TableEventLine[], view: TableView | null): void {
    if (!view || this.stopped) return;
    const mine = view.youSeat;
    for (const line of lines) {
      if (line.seat === null || !TOLD.has(line.type)) continue;
      // the player's own moves are shown by their own screen (a Market card too: they open it themselves)
      if (line.seat === mine) continue;
      if (line.type === 'rolled') {
        const from = line.data?.['from'];
        this.tokenAt.update((at) => ({
          ...at,
          [line.seat as number]: typeof from === 'number' ? from : null,
        }));
      }
      this.queue.push({ line, view });
      this.markTold(line.seq, 'start');
    }
    if (this.queue.length && !this.running) void this.run();
  }

  /** Closes the message on screen and gets the rest of the telling over with at once (the player was blocked by it). */
  dismiss(): void {
    this.skipping = true;
    this.stage.set(null);
    this.wake?.();
  }

  private skipping = false;
  private wake: (() => void) | null = null;

  private pause(ms: number): Promise<void> {
    if (this.skipping) return Promise.resolve();
    return new Promise<void>((resolve) => {
      const done = () => {
        this.wake = null;
        resolve();
      };
      this.wake = done;
      setTimeout(done, ms);
    });
  }

  stop(): void {
    this.stopped = true;
    this.queue = [];
    this.unfinished.set(new Set());
    this.rested.set(new Set());
    this.stage.set(null);
    this.dice.set(null);
    this.tokenAt.set({});
    this.busy.set(false);
  }

  private async run(): Promise<void> {
    this.running = true;
    this.busy.set(true);
    while (this.queue.length && !this.stopped) {
      const next = this.queue.shift()!;
      await this.tell(next.line, next.view);
      this.markTold(next.line.seq, 'done');
    }
    this.skipping = false;
    this.stage.set(null);
    this.dice.set(null);
    this.running = false;
    this.busy.set(false);
  }

  private base(line: TableEventLine, view: TableView, headline: string): Stage {
    const player = view.players[line.seat as number];
    return {
      seat: line.seat as number,
      who: player?.name ?? '',
      color: player?.color ?? '#999',
      headline,
    };
  }

  private async tell(line: TableEventLine, view: TableView): Promise<void> {
    const t = this.t;
    const data = line.data ?? {};
    const seat = line.seat as number;
    switch (line.type) {
      case 'rolled': {
        const faces = (data['dice'] as number[] | undefined) ?? [];
        const total = Number(data['total'] ?? 0);
        const from = typeof data['from'] === 'number' ? (data['from'] as number) : null;
        const stage = this.base(line, view, t.stRoll);
        // the dice tumble, then rest on their faces
        this.stage.set(stage);
        for (let i = 0; i < 8; i += 1) {
          this.dice.set({
            tumbling: true,
            faces: faces.map(() => 1 + Math.floor(Math.random() * 6)),
          });
          await this.pause(90 * this.beat);
        }
        this.dice.set({ tumbling: false, faces });
        this.markTold(line.seq, 'rest');
        await this.pause(450 * this.beat);
        // the token walks to where the roll took it
        if (total > 0) {
          for (const space of moveToken(CLASSIC_RAT_RACE_BOARD, from, total).entered) {
            this.tokenAt.update((at) => ({ ...at, [seat]: space.index }));
            await this.pause(260 * this.beat);
          }
        }
        this.tokenAt.update((at) => {
          const rest = { ...at };
          delete rest[seat];
          return rest;
        });
        const net =
          Number(data['paydayIncomeMinor'] ?? 0) - Number(data['paydayExpensesMinor'] ?? 0);
        if (Number(data['paydays'] ?? 0) > 0) {
          this.stage.set({
            ...stage,
            patch: {
              text: `${t.payday} ${net < 0 ? '−' : '+'}${money(net)}`,
              tone: net < 0 ? 'minus' : 'plus',
            },
          });
          await this.pause(1300 * this.beat);
        } else {
          await this.pause(300 * this.beat);
        }
        return;
      }
      case 'card_drawn': {
        const card = data['card'] as
          | (Record<string, unknown> & { printed?: { title?: string; description?: string } })
          | undefined;
        const deck = String(data['deck'] ?? '');
        this.inHand.set(
          seat,
          String(card?.printed?.title ?? card?.['label'] ?? card?.['title'] ?? ''),
        );
        this.stage.set({
          ...this.base(line, view, t.stDraw),
          card: this.cardOf(card, deck),
        });
        await this.pause(1900 * this.beat);
        return;
      }
      case 'market_card_played': {
        this.stage.set({ ...this.base(line, view, t.stMarket) });
        await this.pause(700 * this.beat);
        return;
      }
      case 'card_played': {
        const card = data['card'] as Record<string, unknown> | undefined;
        const action = String(data['action'] ?? '');
        const title = String(data['title'] ?? card?.['title'] ?? '');
        const cost = Number(data['costMinor'] ?? 0);
        const stage = this.base(
          line,
          view,
          action === 'pay_doodad' ? t.stPaid : action === 'plan_deal' ? t.stPlanned : t.stBought,
        );
        this.stage.set({
          ...stage,
          card: card ? this.cardOf(card, String(data['deck'] ?? '')) : undefined,
          patch:
            action === 'pay_doodad' && cost
              ? { text: `−${money(cost)}`, tone: 'minus' }
              : { text: title, tone: 'neutral' },
        });
        await this.pause(1500 * this.beat);
        return;
      }
      case 'card_passed': {
        const finished = data['action'] === 'finish_card';
        const card = this.inHand.get(seat);
        this.stage.set({
          ...this.base(line, view, finished ? t.stFinished : t.stPassed),
          ...(card ? { patch: { text: card, tone: 'neutral' as const } } : {}),
        });
        await this.pause(1000 * this.beat);
        return;
      }
      case 'dice_decided': {
        const roll = Number(data['roll'] ?? 0);
        this.stage.set(this.base(line, view, t.stDecision));
        if (roll) this.dice.set({ tumbling: false, faces: [roll] });
        await this.pause(1300 * this.beat);
        this.dice.set(null);
        return;
      }
      case 'position_sold': {
        const cash = Number(data['cashMinor'] ?? 0);
        this.stage.set({
          ...this.base(line, view, t.stSold),
          patch: {
            text: `${String(data['title'] ?? '')} ${cash < 0 ? '−' : '+'}${money(cash)}`,
            tone: cash < 0 ? 'minus' : 'plus',
          },
        });
        await this.pause(1500 * this.beat);
        return;
      }
      case 'loan_changed':
        this.stage.set(this.base(line, view, t.stLoan));
        await this.pause(900 * this.beat);
        return;
      case 'trade_offered':
        this.stage.set(this.base(line, view, t.stTradeOffer));
        await this.pause(1000 * this.beat);
        return;
      case 'trade_made':
        this.stage.set(this.base(line, view, t.stTradeMade));
        await this.pause(1000 * this.beat);
        return;
      case 'player_escaped':
        this.stage.set(this.base(line, view, t.stEscaped));
        await this.pause(2000 * this.beat);
        return;
      case 'player_bankrupt':
        this.stage.set(this.base(line, view, t.stBankrupt));
        await this.pause(2000 * this.beat);
        return;
    }
  }

  /** A card as the stage shows it: its name, which pile, and the numbers that matter. */
  private cardOf(
    card:
      | (Record<string, unknown> & { printed?: { title?: string; description?: string } })
      | undefined,
    deck: string,
  ): Stage['card'] {
    const t = this.t;
    if (!card) return undefined;
    const title = String(
      card.printed?.title ?? card['label'] ?? card['title'] ?? card['symbol'] ?? '',
    );
    const tone = deck === 'market' ? 'market' : deck === 'doodad' ? 'doodad' : 'deal';
    const names: Record<string, string> = {
      dealSmall: t.deckDealSmall,
      dealBig: t.deckDealBig,
      market: t.deckMarket,
      doodad: t.deckDoodad,
    };
    const lines: string[] = [];
    const add = (label: string, value: unknown) => {
      if (typeof value === 'number' && value) lines.push(`${label}: ${money(value)}`);
    };
    add(t.cost, card['costMinor']);
    add(t.price, card['priceMinor']);
    add(t.deposit, card['depositMinor']);
    add(t.cashflow, card['cashflowMinor']);
    return {
      title,
      deck: names[deck] ?? '',
      tone,
      lines,
      text: card.printed?.description ? String(card.printed.description) : undefined,
    };
  }
}
