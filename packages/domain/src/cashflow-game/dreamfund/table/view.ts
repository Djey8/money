import { quoteEmergency } from '../../emergency-deck';
import { expectedMonthlyMinor } from '../../dreamfund-sim/policies';
import { DreamPlayer, type DreamPlayerData } from '../player';
import { goalsOf } from './scoring';
import type { DreamCommand, DreamHarvestOpen, DreamPending, DreamTable } from './types';

/**
 * What a viewer of a Dreamfund table is shown (todo/dreamfund-multiplayer.md, slice 5). Everything about a life is open at the table,
 * as in the classic game - the books, the dreams, the plans - so what is hidden is only what is the server's: the dice's position, the
 * pile's order, a character picked in secret before the reveal and what a player has still to decide (others see only that they do).
 * The API speaks in seats, never account ids. Pure.
 */

/** A life in numbers, worked out on the server (a screen keeps no rules): what the player has, owes, earns and is saving for. Minor units. */
export interface LifeSummary {
  months: number;
  cashMinor: number;
  reserveMinor: number;
  reserveTargetMinor: number;
  passiveMinor: number;
  expensesMinor: number;
  livingMinor: number;
  cashflowMinor: number;
  netWorthMinor: number;
  bankLoanMinor: number;
  dreamTargetMinor: number;
  dreamSavedMinor: number;
  dreamPoints: number;
  goals: { reserve: number; debts: number; dream: number; independence: number };
  debts: { tag: string; amountMinor: number }[];
  holdings: {
    title: string;
    cardId: string;
    units?: number;
    monthlyMinor: number;
    paidMinor: number;
  }[];
  plans: { kind: string; id: string; perMinor: number; leftMinor: number }[];
  smile: { cardId: string; totalMinor: number; savedMinor: number; points: number }[];
  career: string | null;
}

/** What the player in front of a decision is shown of it, at their own price level (the screen keeps no rules and no prices). */
export interface PendingInfo {
  /** An emergency: what it costs (null while a choice or a die is still open), whether it must be paid at once, and what it asks you to choose. */
  emergency?: {
    payMinor: number | null;
    mustPayNow: boolean;
    choices: { id: string }[];
    plans: { months: number; perMinor: number; totalMinor: number }[];
  };
  /** Opportunity cards on offer: the cost, what it pays a month, whether it can be taken now and why not. */
  offers?: { id: string; costMinor: number; monthlyMinor: number; ok: boolean; reason?: string }[];
  /** Dreams on offer: the price and the points. */
  dreams?: { id: string; totalMinor: number; points: number }[];
}

export function pendingInfoOf(life: DreamPlayerData, pending: DreamPending): PendingInfo | null {
  const p = DreamPlayer.restore(life, () => 0.5, { sharedMarkets: true });
  if (pending.kind === 'emergency') {
    const card = p.emergencyCard(pending.cardId);
    if (!card) return null;
    const quote = quoteEmergency(card, { rolls: {} }, p.emergencyContext());
    const payMinor = quote.needsChoice || quote.needsRolls.length > 0 ? null : quote.payMinor;
    return {
      emergency: {
        payMinor,
        mustPayNow: card.payment === 'pay_now',
        choices: (card.choices ?? []).map((choice) => ({ id: choice.id })),
        plans:
          payMinor === null
            ? []
            : p
                .emergencyPlanOptions(payMinor)
                .map((o) => ({ months: o.months, perMinor: o.per, totalMinor: o.total })),
      },
    };
  }
  if (pending.kind === 'opportunity') {
    return {
      offers: pending.offers.flatMap((id) => {
        const card = p.opportunityCard(id);
        if (!card) return [];
        const quote = p.quoteOpportunity(card, {});
        return [
          {
            id,
            costMinor: quote.costMinor,
            monthlyMinor: Math.round(expectedMonthlyMinor(card)),
            ok: quote.ok,
            ...(quote.reason ? { reason: quote.reason } : {}),
          },
        ];
      }),
    };
  }
  if (pending.kind === 'dream') {
    return {
      dreams: pending.offers.flatMap((id) => {
        const card = p.dreamCard(id);
        return card ? [{ id, totalMinor: card.totalMinor, points: card.points }] : [];
      }),
    };
  }
  return null;
}

const summaries = new WeakMap<object, LifeSummary>();

/** The summary of a life (worked out once per life that is held: the same data object gives the same summary). */
export function summarizeLife(life: DreamPlayerData): LifeSummary {
  const cached = summaries.get(life);
  if (cached) return cached;
  const p = DreamPlayer.restore(life, () => 0.5, { sharedMarkets: true });
  const finances = p.finances();
  const goals = goalsOf(p);
  const living = finances.expensesMinor - (finances.salaryLinkedMinor ?? 0);
  const summary: LifeSummary = {
    months: p.state.round,
    cashMinor: p.cash(),
    reserveMinor: p.reserveMinor,
    reserveTargetMinor: p.monthlyExpenses() * 3,
    passiveMinor: finances.passiveIncomeMinor,
    expensesMinor: finances.expensesMinor,
    livingMinor: living,
    cashflowMinor: finances.monthlyCashflowMinor,
    netWorthMinor: p.netWorth(),
    bankLoanMinor: p.books.liabilities.find((l) => l.tag === 'Bank loan')?.amountMinor ?? 0,
    dreamTargetMinor: p.dreamTargetMinor,
    dreamSavedMinor: p.dreamSavedMinor,
    dreamPoints: p.dreamPoints + p.bonusPoints,
    goals,
    debts: p.books.liabilities
      .filter((l) => p.debtTags.includes(l.tag) && l.amountMinor > 0)
      .map((l) => ({ tag: l.tag, amountMinor: l.amountMinor })),
    holdings: (p.state.holdings ?? [])
      .filter((h) => !h.ended)
      .map((h) => ({
        title: h.title,
        cardId: h.cardId,
        ...(h.units ? { units: h.units } : {}),
        monthlyMinor: h.lineMinor ?? h.cashflowMinor,
        paidMinor: h.paidMinor ?? 0,
      })),
    plans: p.plans.map((plan) => ({ ...plan })),
    smile: p.smile.map((d) => ({ ...d })),
    career: p.state.career?.stage ?? null,
  };
  summaries.set(life, summary);
  return summary;
}

export interface DreamPlayerView {
  seat: number;
  name: string;
  color: string;
  initials?: string;
  ready: boolean;
  /** The character: the viewer's own pick, everybody's once it is revealed (or at a table of unique characters). */
  pick: string | null;
  professionId: string | null;
  status: 'active' | 'left';
  away: boolean;
  bot: { policyId: string } | null;
  /** The life as data (the books, the reserve, the dreams, the plans); null before play starts. A live screen reads `summary`. */
  life: unknown;
  /** The life in numbers, null before play starts. */
  summary: LifeSummary | null;
  /** What the player has to decide: the viewer sees their own in full, the others only its kind. */
  pending: DreamPending | { kind: DreamPending['kind'] } | null;
  /** The prices and options of the viewer's own decision. */
  pendingInfo: PendingInfo | null;
  harvest: DreamHarvestOpen | null;
  paydayDue: boolean;
  reached: DreamTable['players'][number]['reached'];
  you: boolean;
}

export interface DreamTableView {
  kind: 'dreamfund';
  id: string;
  version: number;
  phase: DreamTable['phase'];
  settings: DreamTable['settings'];
  hostSeat: number;
  /** The viewer's seat, or null for a spectator. */
  you: number | null;
  /** The same, under the name the classic table's readers use. */
  youSeat: number | null;
  /** Seats the table waits for (classic: the turn hold); none at a Dreamfund table. */
  holdSeats: number[];
  /** Turn order as seats. */
  order: number[];
  activeSeat: number | null;
  tableRound: number;
  turnRolled: boolean;
  finishers: { seat: number; outcome: 'won' | 'bankrupt' }[];
  result: {
    reason: string;
    winnerSeat: number | null;
    ranking: (Omit<NonNullable<DreamTable['result']>['ranking'][number], 'playerId'> & {
      seat: number;
    })[];
  } | null;
  clock: DreamTable['clock'];
  markets: Record<string, number>;
  trade: {
    sellerSeat: number;
    holding: string;
    cardId: string;
    toSeat: number | null;
    priceMinor: number;
    counters: { seat: number; priceMinor: number }[];
    declinedSeats: number[];
  } | null;
  players: DreamPlayerView[];
  createdAt: string;
}

const seatOf = (table: DreamTable, id: string | null): number => {
  const at = id ? table.players.findIndex((p) => p.id === id) : -1;
  return at;
};

export function projectDreamFor(table: DreamTable, viewerId: string | null): DreamTableView {
  const you = seatOf(table, viewerId);
  const revealed = table.phase !== 'lobby' && table.phase !== 'picking';
  const open = table.settings.professions === 'unique';
  return {
    kind: 'dreamfund',
    id: table.id,
    version: table.version,
    phase: table.phase,
    settings: table.settings,
    hostSeat: seatOf(table, table.hostId),
    you: you >= 0 ? you : null,
    youSeat: you >= 0 ? you : null,
    holdSeats: [],
    order: table.order.map((id) => seatOf(table, id)),
    activeSeat: table.activePlayerId ? seatOf(table, table.activePlayerId) : null,
    tableRound: table.tableRound,
    turnRolled: table.turnRolled,
    finishers: table.finishers.map((f) => ({
      seat: seatOf(table, f.playerId),
      outcome: f.outcome,
    })),
    result: table.result
      ? {
          reason: table.result.reason,
          winnerSeat: table.result.winnerId ? seatOf(table, table.result.winnerId) : null,
          ranking: table.result.ranking.map(({ playerId, ...rest }) => ({
            ...rest,
            seat: seatOf(table, playerId),
          })),
        }
      : null,
    clock: table.clock,
    markets: table.markets,
    trade: table.trade
      ? {
          sellerSeat: seatOf(table, table.trade.sellerId),
          holding: table.trade.holding,
          cardId: table.trade.cardId,
          toSeat: table.trade.to ? seatOf(table, table.trade.to) : null,
          priceMinor: table.trade.priceMinor,
          counters: table.trade.counters.map((c) => ({
            seat: seatOf(table, c.playerId),
            priceMinor: c.priceMinor,
          })),
          declinedSeats: table.trade.declined.map((id) => seatOf(table, id)),
        }
      : null,
    players: table.players.map((p, seat) => {
      const mine = p.id === viewerId;
      return {
        seat,
        name: p.name,
        color: p.color,
        ...(p.initials ? { initials: p.initials } : {}),
        ready: p.ready,
        pick: mine || revealed || open ? p.pick : null,
        professionId: p.professionId,
        status: p.status,
        away: p.away,
        bot: p.bot ? { policyId: p.bot.policyId } : null,
        life: p.life,
        summary: p.life ? summarizeLife(p.life) : null,
        pending: p.pending ? (mine ? p.pending : { kind: p.pending.kind }) : null,
        pendingInfo: mine && p.pending && p.life ? pendingInfoOf(p.life, p.pending) : null,
        harvest: mine ? p.harvest : null,
        paydayDue: p.paydayDue === true,
        reached: p.reached,
        you: mine,
      };
    }),
    createdAt: table.createdAt,
  };
}

export interface DreamLegalAction {
  type: DreamCommand['type'];
  /** What the command needs, where that is not obvious (the cards on offer, the plans a payment may take). */
  hint?: Record<string, unknown>;
}

/** The commands the viewer may send now: a guide for a screen or an agent, the rules decide when one is sent. */
export function dreamLegalActions(table: DreamTable, viewerId: string | null): DreamLegalAction[] {
  const me = table.players.find((p) => p.id === viewerId);
  const actions: DreamLegalAction[] = [];
  const add = (type: DreamCommand['type'], hint?: Record<string, unknown>) =>
    actions.push({ type, ...(hint ? { hint } : {}) });
  if (!me) {
    if (table.phase === 'lobby' && table.players.length < table.settings.maxSeats) add('join');
    return actions;
  }
  const host = table.hostId === me.id;
  if (table.phase === 'lobby') {
    add('leave');
    add('set_ready');
    if (host) {
      add('update_settings');
      add('add_bot');
      add('kick');
      add('start');
      add('close');
    }
    return actions;
  }
  if (table.phase === 'picking') {
    add('pick_profession');
    add('leave');
    if (host) add('close');
    return actions;
  }
  if (table.phase !== 'playing' || me.status !== 'active') return actions;
  if (host) {
    add('close');
    add(table.clock.pausedAt === null ? 'pause' : 'resume');
  }
  add('away');
  add('back');
  const finished = table.finishers.some((f) => f.playerId === me.id);
  if (finished) return actions;
  const mine = table.activePlayerId === me.id;
  if (me.harvest) {
    if (me.harvest.sellable.length) add('harvest_sell', { holdings: me.harvest.sellable });
    if (me.harvest.sales.length) add('harvest_accept', { sales: me.harvest.sales });
    if (me.harvest.ladders.length) {
      add('harvest_ladder', { holdings: me.harvest.ladders.map((l) => l.holding) });
    }
  }
  const trade = table.trade;
  if (trade && trade.sellerId !== me.id && (trade.to === null || trade.to === me.id)) {
    if (!trade.declined.includes(me.id)) {
      add('accept_trade', { priceMinor: trade.priceMinor });
      add('counter_trade');
      add('decline_trade');
    }
  }
  if (!mine) return actions;
  if (trade?.sellerId === me.id) {
    add('withdraw_trade');
    if (trade.counters.length) add('accept_trade', { counters: trade.counters });
  }
  const p = me.pending;
  if (p) {
    switch (p.kind) {
      case 'emergency':
        add('pay_emergency', { cardId: p.cardId });
        break;
      case 'life':
        add('answer_life', { cardId: p.cardId });
        break;
      case 'career_branch':
        add('choose_career_branch', { options: p.options });
        break;
      case 'dream':
        add('take_dream', { offers: p.offers });
        add('skip');
        break;
      case 'opportunity_pile':
        add('choose_pile', { piles: ['seed', 'sapling', 'tree'] });
        add('skip');
        break;
      case 'opportunity':
        add('take_opportunity', { pile: p.pile, offers: p.offers });
        add('skip');
        break;
    }
  } else if (!table.turnRolled) add('roll');
  else add('end_turn');
  add('fund_reserve');
  add('fund_dream');
  add('repay_debt');
  add('repay_bank_loan');
  add('set_plan');
  add('sell_holding');
  if (!trade) add('offer_trade');
  if (me.paydayDue) add('settle_payday');
  return actions;
}
