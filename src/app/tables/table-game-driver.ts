import type {
  RemoteGame,
  RemoteGate,
  RemoteOver,
  RemoteMenuItem,
  RemoteHistoryLine,
  RemoteOutcome,
} from '../shared/services/remote-game';
import type { TableSessionService } from './table-session.service';

/**
 * The solo game screen's moves, made at a table (todo/cashflow-multiplayer-solo-ui.md R1): every one is a command to the server,
 * which rolls the dice, draws the card and books it; this waits until the stream has brought the table up to the version the move
 * made - so the books the screen shows are the new ones - and hands back what happened.
 */
export class TableGameDriver implements RemoteGame {
  readonly dreamfund?: boolean;

  /**
   * `refusal` says why a move of play cannot be made now (looking at another player's books, not the player's turn, the turn held):
   * the words for the toast, or null when it can. It is asked before anything is sent, so a click on a stale button costs nothing.
   */
  constructor(
    protected readonly session: TableSessionService,
    protected readonly refusal: () => string | null = () => null,
    private readonly historyLines: () => RemoteHistoryLine[] = () => [],
    private readonly words: () => { label: string; confirm: string; lobby: string } = () => ({
      label: 'Resign',
      confirm: 'Resign?',
      lobby: 'Lobby',
    }),
    private readonly screen: {
      viewOnly: () => boolean;
      gate: () => RemoteGate | null;
      turnBanner: () => { text: string; color: string } | null;
      over: () => RemoteOver | null;
      menu: () => { title: string; items: RemoteMenuItem[] } | null;
      quick: () => { id: string; icon: string; title: string; on: boolean }[];
      runMenu: (id: string) => Promise<void>;
    } = {
      viewOnly: () => false,
      gate: () => null,
      turnBanner: () => null,
      over: () => null,
      menu: () => null,
      quick: () => [],
      runMenu: async () => undefined,
    },
  ) {}

  viewOnly(): boolean {
    return this.screen.viewOnly();
  }

  tableMenu(): { title: string; items: RemoteMenuItem[] } | null {
    return this.screen.menu();
  }

  quickToggles(): { id: string; icon: string; title: string; on: boolean }[] {
    return this.screen.quick();
  }

  runTableMenu(id: string): Promise<void> {
    return this.screen.runMenu(id);
  }

  over(): RemoteOver | null {
    return this.screen.over();
  }

  gate(): RemoteGate | null {
    return this.screen.gate();
  }

  turnBanner(): { text: string; color: string } | null {
    return this.screen.turnBanner();
  }

  proceed(): Promise<RemoteOutcome> {
    return this.done();
  }

  async resign(): Promise<RemoteOutcome> {
    const ok = await this.session.lobby('leave');
    return ok
      ? { ok: true, events: [] }
      : { ok: false, message: this.session.problem() ?? undefined, events: [] };
  }

  resignWords(): { label: string; confirm: string; lobby: string } {
    return this.words();
  }

  async saveGame(): Promise<RemoteOutcome> {
    const ok = await this.session.save();
    return ok
      ? { ok: true, events: [] }
      : { ok: false, message: this.session.problem() ?? undefined, events: [] };
  }

  history(): RemoteHistoryLine[] {
    return this.historyLines();
  }

  canAskUndo(): boolean {
    return this.session.can('propose_undo');
  }

  askUndo(): Promise<RemoteOutcome> {
    return this.move({ type: 'propose_undo' }, false);
  }

  canAct(): boolean {
    return this.refusal() === null;
  }

  done(): Promise<RemoteOutcome> {
    return this.move({ type: 'done' }, false);
  }

  roll(dice: 1 | 2): Promise<RemoteOutcome> {
    return this.move({ type: 'roll', dice });
  }

  draw(deck: 'dealSmall' | 'dealBig' | 'market' | 'doodad'): Promise<RemoteOutcome> {
    return this.move({ type: 'draw_card', deck });
  }

  buy(cardId: string, quantity?: number): Promise<RemoteOutcome> {
    return this.move({ type: 'buy_deal', cardId, ...(quantity ? { quantity } : {}) });
  }

  plan(cardId: string): Promise<RemoteOutcome> {
    return this.move({ type: 'plan_deal', cardId });
  }

  buyPlanned(title: string, quantity?: number): Promise<RemoteOutcome> {
    return this.move({ type: 'buy_planned', title, ...(quantity ? { quantity } : {}) });
  }

  finish(): Promise<RemoteOutcome> {
    return this.move({ type: 'finish_card' });
  }

  sellPosition(title: string, quantity?: number): Promise<RemoteOutcome> {
    // selling is open to everybody who has a buyer's offer, on or off their turn: only a stale screen is refused here
    return this.move(
      { type: 'sell_position', input: { title, ...(quantity ? { quantity } : {}) } },
      false,
    );
  }

  payDoodad(cardId: string): Promise<RemoteOutcome> {
    return this.move({ type: 'pay_doodad', cardId });
  }

  payMarket(cardId: string): Promise<RemoteOutcome> {
    return this.move({ type: 'pay_market', cardId });
  }

  pass(): Promise<RemoteOutcome> {
    return this.move({ type: 'pass_card' });
  }

  rollDecision(title?: string): Promise<RemoteOutcome> {
    // the die of a card is rolled while the turn waits to be ended: the server decides, not the screen's turn check
    return this.move({ type: 'roll_decision', ...(title ? { title } : {}) }, false);
  }

  offerTrade(priceMinor: number): Promise<RemoteOutcome> {
    return this.move({ type: 'offer_trade', priceMinor });
  }

  bankLoan(amountMinor: number): Promise<RemoteOutcome> {
    // the bank is open while the turn waits for everybody to continue: the server decides, not the screen's turn check
    return this.move({ type: 'bank_loan', amountMinor }, false);
  }

  payLiability(tag: string): Promise<RemoteOutcome> {
    // like the bank: open any time the table allows it; the server decides (the setting, the cash, the bankruptcy rule)
    return this.move({ type: 'pay_liability', tag }, false);
  }

  protected async move(command: Record<string, unknown>, play = true): Promise<RemoteOutcome> {
    const refused = play ? this.refusal() : null;
    if (refused) return { ok: false, message: refused, events: [] };
    const done = await this.session.playForResult(command);
    if (!done) {
      return { ok: false, message: this.session.problem() ?? undefined, events: [] };
    }
    await this.session.untilVersion(done.appliedVersion ?? done.version ?? 0);
    return {
      ok: true,
      events: (done.events ?? []).map((event) => ({
        type: event.type,
        seat: event.seat,
        data: event.data,
      })),
    };
  }
}
