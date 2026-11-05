import { TableGameDriver } from '../tables/table-game-driver';
import type { RemoteOutcome } from '../shared/services/remote-game';
import { AppStateService } from '../shared/services/app-state.service';
import { dreamTexts } from './dream-texts';

type Rest = Record<string, unknown>;

/** What the tile cards of the solo screen decide, and the command of the table each one is. */
const DECISIONS: Record<string, (d: Rest) => Record<string, unknown>> = {
  pay: (d) => ({ type: 'pay_emergency', pay: d['pay'] }),
  choose: (d) => ({ type: 'emergency_choose', choiceId: d['choiceId'] }),
  rollDie: (d) => ({ type: 'emergency_roll', key: d['key'] }),
  rollAgain: () => ({ type: 'emergency_reroll' }),
  answer: (d) => ({
    type: 'answer_life',
    decision: d['answer'],
    ...(d['option'] ? { option: d['option'] } : {}),
  }),
  branch: (d) => ({ type: 'choose_career_branch', index: d['index'] }),
  takeDream: (d) => ({ type: 'take_dream', cardId: d['cardId'] }),
  pile: (d) => ({ type: 'choose_pile', pile: d['pile'] }),
  takeCard: (d) => ({ type: 'take_opportunity', ...d }),
  rollCard: () => ({ type: 'roll_opportunity' }),
  planCard: (d) => ({ type: 'plan_opportunity', cardId: d['cardId'], swapOut: d['swapOut'] }),
  leave: () => ({ type: 'skip' }),
  sellInWindow: (d) => ({ type: 'harvest_sell', holding: d['holding'] }),
  acceptBuyer: (d) => ({ type: 'harvest_accept', holding: d['holding'] }),
  ladder: (d) => ({ type: 'harvest_ladder', holding: d['holding'], action: d['action'] }),
  // the app's own pages: funding the reserve and the dream, repaying, the plans, selling and offering what is owned
  fundReserve: (d) => ({ type: 'fund_reserve', amountMinor: d['amountMinor'] }),
  fundDream: (d) => ({
    type: 'fund_dream',
    amountMinor: d['amountMinor'],
    ...(d['id'] ? { id: d['id'] } : {}),
  }),
  fundEmergency: (d) => ({ type: 'fund_emergency', id: d['id'], amountMinor: d['amountMinor'] }),
  repayDebt: (d) => ({ type: 'repay_debt', tag: d['tag'] }),
  repayBank: (d) => ({ type: 'repay_bank_loan', amountMinor: d['amountMinor'] }),
  setInsurance: (d) => ({ type: 'set_insurance', kind: d['kind'], on: d['on'] }),
  plan: (d) => ({ type: 'set_plan', kind: d['kind'], id: d['id'], perMinor: d['perMinor'] }),
  settle: () => ({ type: 'settle_payday' }),
  sellHolding: (d) => ({ type: 'sell_holding', holding: d['holding'] }),
  offerTrade: (d) => ({ type: 'offer_trade', holding: d['holding'], priceMinor: d['priceMinor'] }),
  withdrawTrade: () => ({ type: 'withdraw_trade' }),
  counterTrade: (d) => ({ type: 'counter_trade', priceMinor: d['priceMinor'] }),
  declineTrade: () => ({ type: 'decline_trade' }),
  acceptTrade: (d) => ({
    type: 'accept_trade',
    ...(d['fromSeat'] !== undefined ? { fromSeat: d['fromSeat'] } : {}),
  }),
};

/**
 * The solo screen's moves at a Dreamfund table (todo/dreamfund-tables-solo-ui.md, R4): the same driver as the classic table's, with the
 * Dreamfund's commands. The server rolls the dice, draws the cards and books them; this sends what the player decided. Moves the
 * Dreamfund has no use for (the classic deals) are answered with a refusal, so a stale button costs nothing.
 */
export class DreamTableGameDriver extends TableGameDriver {
  override readonly dreamfund = true;
  /** The language of the words this driver gives the app's pages. */
  lang = 'en';
  /** A debt as the screen names it, as the table knows it (the screen shows the words of its language). */
  originalTag: (shown: string) => string = (shown) => shown;

  private static readonly NOT_HERE = 'This move is not part of the Dreamfund.';
  private notHere = (..._args: unknown[]): Promise<RemoteOutcome> =>
    Promise.resolve({ ok: false, message: DreamTableGameDriver.NOT_HERE, events: [] });

  /** A decision of a tile card, turned into the table's own command. */
  dreamMove(decision: { decision: string } & Record<string, unknown>): Promise<RemoteOutcome> {
    const { decision: name, ...rest } = decision;
    const command = DECISIONS[name]?.(rest);
    if (!command) return this.notHere();
    return this.move(command);
  }

  /** The plan of a project of the app: the reserve (a Fire project), the character's dream, or a dream taken (Smile projects). */
  projectPlan(project: {
    kind: 'smile' | 'fire';
    title: string;
  }): { label: string; button: string; perMinor: number } | null {
    const goal = this.goalOf(project);
    if (!goal) return null;
    const t = dreamTexts(this.lang);
    return { label: t.planPerPayday, button: t.payPlan, perMinor: goal.perMinor };
  }

  setProjectPlan(
    project: { kind: 'smile' | 'fire'; title: string },
    perMinor: number,
  ): Promise<RemoteOutcome> {
    const goal = this.goalOf(project);
    return goal
      ? this.dreamMove({ decision: 'plan', kind: goal.kind, id: goal.id, perMinor })
      : this.notHere();
  }

  /** What the table plans for: the reserve, the character's dream, a dream taken - found from the project's own marks. */
  private goalOf(project: {
    kind: 'smile' | 'fire';
    title: string;
  }): { kind: 'mojo' | 'life' | 'smile' | 'emergency'; id: string; perMinor: number } | null {
    const state = AppStateService.instance;
    if (project.kind === 'fire') {
      const fire = state.allFireEmergencies.find((candidate) => candidate.title === project.title);
      const emergencyId = (fire as { emergencyCardId?: string } | undefined)?.emergencyCardId;
      if (emergencyId) {
        return {
          kind: 'emergency',
          id: emergencyId,
          perMinor: Number((fire as { dreamPlanMinor?: number }).dreamPlanMinor ?? 0),
        };
      }
      return fire?.reserve
        ? {
            kind: 'mojo',
            id: 'mojo',
            perMinor: Number((fire as { dreamPlanMinor?: number }).dreamPlanMinor ?? 0),
          }
        : null;
    }
    const smile = state.allSmileProjects.find((candidate) => candidate.title === project.title);
    if (!smile) return null;
    const perMinor = Number((smile as { dreamPlanMinor?: number }).dreamPlanMinor ?? 0);
    if (smile.dream) return { kind: 'life', id: 'life', perMinor };
    return smile.dreamCardId ? { kind: 'smile', id: smile.dreamCardId, perMinor } : null;
  }

  /** A debt of the balance sheet is paid off from the app's own page. */
  override payLiability(tag: string): Promise<RemoteOutcome> {
    return this.dreamMove({ decision: 'repayDebt', tag: this.originalTag(tag) });
  }

  /** The Bank loan is repaid in steps from the app's page; borrowing is the game's own (a thin month is covered by it). */
  override bankLoan(amountMinor: number): Promise<RemoteOutcome> {
    return amountMinor < 0
      ? this.dreamMove({ decision: 'repayBank', amountMinor: -amountMinor })
      : this.notHere();
  }

  /** What is owned is sold at the market price from the Grow page. */
  override sellPosition(title: string): Promise<RemoteOutcome> {
    return this.dreamMove({ decision: 'sellHolding', holding: title });
  }

  override roll(): Promise<RemoteOutcome> {
    return this.move({ type: 'roll' });
  }

  /**
   * What may be changed by hand without changing the game (a booking's category, time and account, the account a payment is paid
   * from, the phase of a project): it does not wait for a turn.
   */
  editEntry(command: Record<string, unknown>): Promise<RemoteOutcome> {
    return this.move(command, false);
  }

  /** The turn is over: the card's decisions are made, or the tile had none. */
  override finish(): Promise<RemoteOutcome> {
    return this.move({ type: 'end_turn' });
  }

  /** The money of the table: the game's own, or the sign of a real currency. */
  currency(): string {
    const view = this.session.view() as unknown as { settings: { currency?: string } } | null;
    return view?.settings.currency ?? 'game';
  }

  /** The dream points the table asks for besides the life dream, and what this player has. */
  dreamPoints(): { goal: number; points: number } | null {
    const view = this.session.view() as unknown as {
      youSeat: number | null;
      settings: { dreamPoints?: number };
      players: { dreamSummary?: { dreamPoints?: number } | null }[];
    } | null;
    const goal = view?.settings.dreamPoints ?? 0;
    if (!view || view.youSeat === null || goal <= 0) return null;
    return { goal, points: view.players[view.youSeat]?.dreamSummary?.dreamPoints ?? 0 };
  }

  /** The gate button: "End turn" for the player on the move, "Continue" for one a Harvest card of this turn affects. */
  override proceed(): Promise<RemoteOutcome> {
    const view = this.session.view();
    if (view && view.youSeat !== null && view.activeSeat !== view.youSeat) {
      return this.move({ type: 'harvest_continue' }, false);
    }
    return this.done();
  }

  override done(): Promise<RemoteOutcome> {
    return this.move({ type: 'end_turn' }, false);
  }

  /** Leaves the decision open as it is (no dream taken, no card bought); the turn can then be ended. */
  override pass(): Promise<RemoteOutcome> {
    return this.move({ type: 'skip' });
  }

  override draw = this.notHere;
  override buy = this.notHere;
  override plan = this.notHere;
  /** What was planned in Grow is bought from there: the units are decided in the Add dialog. */
  override buyPlanned(title: string, quantity?: number): Promise<RemoteOutcome> {
    return this.move({
      type: 'buy_planned',
      title,
      ...(quantity ? { units: quantity } : {}),
    });
  }
  override payDoodad = this.notHere;
  override payMarket = this.notHere;
  override rollDecision = this.notHere;
  override askUndo = this.notHere;
}
