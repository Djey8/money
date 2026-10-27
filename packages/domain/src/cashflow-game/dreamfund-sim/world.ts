import { salaryLinkedMinor } from '../saved-games';
import type { CustomRules } from '../custom-rules';
import type { BoardSetup } from '../dreamfund-board';
import { EMPTY_DREAM_LOG } from '../dream-deck';
import type { LifeDecision } from '../life-deck';
import { indexOf, ladderPayout, rideLadder, sellHolding, unitPriceNow, valueOf } from '../harvest';
import { DreamPlayer, type DreamPlan } from '../dreamfund/player';
import { expectedMonthlyMinor, type DreamPolicy, type DreamView } from './policies';

/**
 * One whole Dreamfund game played in memory (JFK, 2026-10-26): the same rules the app runs - `playTurn`, the stacks of cards, the
 * Opportunity purchases, the Harvest market - decided by a `DreamPolicy`, from a seed. The money the app keeps in Mojo and Smile
 * projects is kept here as plain numbers (the reserve and the dream), moved at every Payday the way the player would move it.
 * Thousands of games take seconds, and the same seed always plays the same game. This is for the balance of the cards, not a
 * replica of the screens: what a player does inside the Fire and Smile pages is reduced to its money.
 */

export interface DreamSimConfig {
  seed: number;
  policy: DreamPolicy;
  professionId?: string;
  shape?: BoardSetup['shape'];
  size?: BoardSetup['size'];
  rules?: Partial<CustomRules>;
  /** A game not won or lost after this many rolls is a timeout. */
  maxTurns?: number;
}

export type DreamOutcome = 'won' | 'bankrupt' | 'timeout' | 'error';

export interface DreamGameRecord {
  seed: number;
  policyId: string;
  shape: string;
  size: string;
  difficulty: string;
  outcome: DreamOutcome;
  error?: string;
  turns: number;
  /** Paydays: the months of the game. */
  paydays: number;
  /** The turn each win condition was first met. */
  reserveFullTurn?: number;
  debtsRepaidTurn?: number;
  dreamLivedTurn?: number;
  independentTurn?: number;
  wonTurn?: number;
  netWorthMinor: number;
  cashMinor: number;
  reserveMinor: number;
  passiveMinor: number;
  expensesMinor: number;
  peakPassiveMinor: number;
  peakBankLoanMinor: number;
  lowestCashMinor: number;
  dreamPoints: number;
  landings: Record<string, number>;
  /** How often each Opportunity card was taken, and what it earned. */
  taken: Record<string, number>;
  /** How often each card of the other stacks was met (`E01`, `L05`, `H12`, `D...`): for finding the events that break a game. */
  drawn: Record<string, number>;
  /** The same, only in the first 60 rolls: every game gets that far, so the events can be compared fairly. */
  drawnEarly: Record<string, number>;
  emergenciesPaidMinor: number;
  /** The last cards before the game ended (a bankruptcy shows what broke it). */
  lastEvents: string[];
  /** Every 10 turns: where the game stood (for finding where a strategy stalls). */
  trace: {
    turn: number;
    cash: number;
    reserve: number;
    dream: number;
    passive: number;
    expenses: number;
    living: number;
    cashflow: number;
    holdings: number;
    plans: number;
  }[];
}

export class DreamSim {
  /** The player's life: the rules are the engine's (`dreamfund/player.ts`), the decisions this class's policy's. */
  readonly player: DreamPlayer;
  private readonly record: DreamGameRecord;

  constructor(private readonly config: DreamSimConfig) {
    this.player = DreamPlayer.fromSeed({
      seed: config.seed,
      professionId: config.professionId,
      shape: config.shape,
      size: config.size,
      rules: config.rules,
    });
    this.player.onEvent = (event) => this.log(event);
    this.record = {
      seed: config.seed,
      policyId: config.policy.id,
      shape: this.player.setup.shape,
      size: this.player.setup.size,
      difficulty: this.player.rules.difficulty,
      outcome: 'timeout',
      turns: 0,
      paydays: 0,
      netWorthMinor: 0,
      cashMinor: 0,
      reserveMinor: 0,
      passiveMinor: 0,
      expensesMinor: 0,
      peakPassiveMinor: 0,
      peakBankLoanMinor: 0,
      lowestCashMinor: this.player.cash(),
      dreamPoints: 0,
      landings: {},
      taken: {},
      emergenciesPaidMinor: 0,
      lastEvents: [],
      drawn: {},
      drawnEarly: {},
      trace: [],
    };
  }

  get books() {
    return this.player.books;
  }

  private get p(): DreamPlayer {
    return this.player;
  }

  cash(): number {
    return this.p.cash();
  }

  private log(event: string): void {
    this.record.lastEvents = [...this.record.lastEvents, `${this.p.turns}:${event}`].slice(-8);
    const id = event.split(' ')[1];
    if (id && !event.startsWith('O ') && !event.startsWith('C ')) {
      this.record.drawn[id] = (this.record.drawn[id] ?? 0) + 1;
      if (this.p.turns <= 60) this.record.drawnEarly[id] = (this.record.drawnEarly[id] ?? 0) + 1;
    }
  }

  private view(): DreamView {
    const p = this.p;
    const finances = p.finances();
    const expenses = p.monthlyExpenses();
    const cash = p.cash();
    return {
      cashMinor: cash,
      monthlyExpensesMinor: expenses,
      passiveMinor: finances.passiveIncomeMinor,
      reserveMinor: p.reserveMinor,
      reserveTargetMinor: expenses * 3,
      round: p.state.round,
      debtsMinor: p.debtsMinor(),
      dreamFundedMinor: p.dreamSavedMinor,
      dreamTargetMinor: p.dreamTargetMinor,
      spendableMinor: Math.max(0, cash - this.config.policy.bufferMonths * expenses),
      markets: p.state.markets ?? {},
      holdingsCount: (p.state.holdings ?? []).filter((holding) => !holding.ended).length,
      difficulty: p.rules.difficulty,
    };
  }

  // ── the run ──

  run(): DreamGameRecord {
    const max = this.config.maxTurns ?? 400;
    try {
      while (this.p.turns < max && !this.p.isOver() && !this.record.wonTurn) {
        this.turn();
      }
    } catch (error) {
      this.record.outcome = 'error';
      this.record.error =
        error instanceof Error
          ? `${error.message}\n${error.stack?.split('\n')[1] ?? ''}`
          : String(error);
    }
    return this.finish();
  }

  private finish(): DreamGameRecord {
    const p = this.p;
    const finances = p.finances();
    const record = this.record;
    if (record.outcome !== 'error') {
      record.outcome = record.wonTurn ? 'won' : p.outcome() === 'bankrupt' ? 'bankrupt' : 'timeout';
    }
    record.turns = p.turns;
    record.paydays = p.state.round;
    record.cashMinor = p.cash();
    record.reserveMinor = p.reserveMinor;
    record.passiveMinor = finances.passiveIncomeMinor;
    record.expensesMinor = finances.expensesMinor;
    record.dreamPoints = p.dreamPoints + p.bonusPoints;
    record.netWorthMinor = p.netWorth();
    return record;
  }

  private turn(): void {
    const p = this.p;
    const rolled = p.roll();
    this.record.landings[rolled.landed] = (this.record.landings[rolled.landed] ?? 0) + 1;
    for (let i = 0; i < rolled.paydays; i += 1) this.payday();
    const tile = p.pendingTile();
    if (tile) this.tile(tile);
    p.endTurn();
    this.track();
  }

  private track(): void {
    const p = this.p;
    const finances = p.finances();
    const record = this.record;
    if (p.turns % 10 === 0 && record.trace.at(-1)?.turn !== p.turns) {
      record.trace.push({
        turn: p.turns,
        cash: Math.round(p.cash() / 100),
        reserve: Math.round(p.reserveMinor / 100),
        dream: Math.round(p.dreamSavedMinor / 100),
        passive: Math.round(finances.passiveIncomeMinor / 100),
        expenses: Math.round(finances.expensesMinor / 100),
        living: Math.round(
          (finances.expensesMinor - salaryLinkedMinor(p.state, p.books.subscriptions)) / 100,
        ),
        cashflow: Math.round(finances.monthlyCashflowMinor / 100),
        holdings: (p.state.holdings ?? []).filter((h) => !h.ended).length,
        plans: p.plans.length,
      });
    }
    const expenses = p.monthlyExpenses();
    record.peakPassiveMinor = Math.max(record.peakPassiveMinor, finances.passiveIncomeMinor);
    record.lowestCashMinor = Math.min(record.lowestCashMinor, p.cash());
    const loan =
      p.books.liabilities.find((liability) => liability.tag === 'Bank loan')?.amountMinor ?? 0;
    record.peakBankLoanMinor = Math.max(record.peakBankLoanMinor, loan);
    if (!record.reserveFullTurn && expenses > 0 && p.reserveMinor >= expenses * 3)
      record.reserveFullTurn = p.turns;
    if (!record.debtsRepaidTurn && p.debtsMinor() === 0) record.debtsRepaidTurn = p.turns;
    if (!record.dreamLivedTurn && p.dreamLived) record.dreamLivedTurn = p.turns;
    if (!record.independentTurn && expenses > 0 && finances.escapedRatRace) {
      record.independentTurn = p.turns;
    }
    if (
      !record.wonTurn &&
      record.reserveFullTurn &&
      p.reserveMinor >= expenses * 3 &&
      p.debtsMinor() === 0 &&
      p.dreamLived &&
      finances.escapedRatRace
    ) {
      record.wonTurn = p.turns;
    }
  }

  // ── a Payday: where the free money goes ──

  private payday(): void {
    this.p.trim();
    this.p.payInstallments();
    this.replan();
    this.extraPayments();
    this.track();
  }

  /**
   * The plans of the reserve and of the dreams are set to what the month can carry: a share of what is left of the monthly cashflow
   * after the plans already running (an emergency plan is paid first), in the order of the strategy.
   */
  private replan(): void {
    const p = this.p;
    const policy = this.config.policy;
    const finances = p.finances();
    const committed = p.plans
      .filter((plan) => plan.kind === 'emergency')
      .reduce((sum, plan) => sum + plan.perMinor, 0);
    let room = Math.max(
      0,
      Math.floor((finances.monthlyCashflowMinor - committed) * policy.planShare),
    );
    const months = Math.max(3, policy.planMonths);
    const set = (kind: DreamPlan['kind'], id: string, left: number) => {
      p.plans = p.plans.filter((plan) => !(plan.kind === kind && plan.id === id));
      if (left <= 0 || room <= 0) return;
      const per = Math.min(room, Math.ceil(left / months));
      p.plans.push({ kind, id, perMinor: per, leftMinor: left });
      room -= per;
    };
    for (const priority of policy.priorities) {
      if (priority === 'reserve') {
        set('mojo', 'mojo', Math.max(0, p.monthlyExpenses() * 3 - p.reserveMinor));
      } else if (priority === 'dream') {
        const wait = policy.dreamAfterPassiveShare;
        const living = finances.expensesMinor - salaryLinkedMinor(p.state, p.books.subscriptions);
        if (wait !== undefined && finances.passiveIncomeMinor < living * wait) continue;
        if (!p.dreamLived && p.dreamTargetMinor > 0) {
          set('life', 'life', p.dreamTargetMinor - p.dreamSavedMinor);
        }
        for (const dream of p.smile)
          set('smile', dream.cardId, dream.totalMinor - dream.savedMinor);
      }
    }
  }

  /** What is left over a buffer after the plans: lump sums into the reserve, the debts and the dreams, as the strategy ranks them. */
  private extraPayments(): void {
    const p = this.p;
    const policy = this.config.policy;
    const expenses = p.monthlyExpenses();
    const buffer = policy.bufferMonths * expenses;
    const free = () => Math.max(0, p.cash() - buffer);
    for (const priority of policy.priorities) {
      if (priority === 'reserve') {
        p.fundReserve(Math.min(free(), Math.max(0, expenses * 3 - p.reserveMinor)));
      } else if (priority === 'debt') {
        for (const liability of [...p.books.liabilities]) {
          if (liability.amountMinor <= 0) continue;
          const isBank = liability.tag === 'Bank loan';
          if (!isBank && !p.debtTags.includes(liability.tag)) continue;
          if (isBank) {
            const step = p.books.gameSet?.loanRule.incrementMinor ?? 100000;
            p.repayBankLoan(Math.min(liability.amountMinor, Math.floor(free() / step) * step));
          } else if (free() >= liability.amountMinor) {
            p.repayDebt(liability.tag);
          }
        }
      } else if (priority === 'dream') {
        p.fundDreams(free() * policy.dreamShare);
      }
    }
    p.checkDreams();
  }

  // ── the tiles ──

  private tile(tile: string): void {
    switch (tile) {
      case 'emergency':
        return this.emergency();
      case 'life':
        return this.life();
      case 'career':
        this.p.career();
        return;
      case 'dream':
        return this.dream();
      case 'opportunity':
        return this.opportunity();
      case 'harvest':
        return this.harvest();
    }
  }

  private emergency(): void {
    const p = this.p;
    const drawn = p.drawEmergency();
    if (!drawn) return;
    const pay = p.autoEmergencySelection(drawn.card, drawn.context);
    if (pay === null) return;
    this.record.emergenciesPaidMinor += pay;
    this.payEmergency(drawn.card.id, drawn.card.payment === 'pay_now', pay);
  }

  /** An emergency is paid from cash, from the reserve, or - where the card allows - on a plan of 3, 6 or 12 Paydays with its surcharge. */
  private payEmergency(id: string, mustPayNow: boolean, payMinor: number): void {
    const p = this.p;
    const buffer = this.config.policy.bufferMonths * p.monthlyExpenses();
    if (mustPayNow || p.cash() - payMinor >= buffer || p.reserveMinor >= payMinor) {
      p.payEmergencyNow(payMinor);
      return;
    }
    const room = p.planRoomMinor();
    const choices = p.emergencyPlanOptions(payMinor);
    const fits = choices.find((choice) => choice.per <= room) ?? choices[2];
    p.planEmergency(id, fits);
  }

  private life(): void {
    const p = this.p;
    const card = p.drawLife();
    if (!card) return;
    let decision: LifeDecision;
    if (card.type === 'fate') decision = { kind: 'fate' };
    else if (card.type === 'dice') {
      // a wish for a baby, a risk worth taking only with a full reserve and a month that can carry it
      const finances = p.finances();
      const safe =
        p.reserveMinor >= p.monthlyExpenses() * 3 &&
        finances.monthlyCashflowMinor >= finances.expensesMinor * 0.3;
      decision = card.optional && !safe ? { kind: 'pass' } : { kind: 'roll' };
    } else if (card.type === 'giving') decision = { kind: 'pass' };
    else if (card.options?.length) decision = { kind: 'option', id: card.options[0].id };
    else decision = this.lifeChoice(card);
    p.resolveLife(card, decision);
  }

  /**
   * A choice of life: a sensible player takes what they can afford - a new monthly cost that leaves a good part of the month, and a
   * payment that cash and reserve can carry - and the strategy's appetite decides the rest.
   */
  private lifeChoice(card: NonNullable<ReturnType<DreamPlayer['drawLife']>>): LifeDecision {
    const p = this.p;
    const probe = p.probeLife(card);
    const cashflow = p.finances().monthlyCashflowMinor;
    const affordable = probe.payNow <= p.cash() + p.reserveMinor;
    const keeps = probe.impact >= 0 || cashflow + probe.impact >= cashflow * 0.4;
    if (!affordable || !keeps) return { kind: 'decline' };
    return probe.impact >= 0 || p.rng() < this.config.policy.lifeAcceptChance
      ? { kind: 'accept' }
      : { kind: 'decline' };
  }

  private dream(): void {
    const p = this.p;
    const policy = this.config.policy;
    const drawn = p.drawDream();
    if (!drawn) return;
    const { landing, cards } = drawn;
    if (landing.kind === 'moment') {
      p.moment(landing.moment.id, cards, (offers, openCount) =>
        policy.dream(offers, this.view(), openCount),
      );
      return;
    }
    const log = p.state.dreams ?? EMPTY_DREAM_LOG;
    const pick = policy.dream(landing.offers, this.view(), log.open.length);
    if (!pick || !p.canTakeDream()) return;
    p.takeDream(pick);
  }

  private opportunity(): void {
    const p = this.p;
    const policy = this.config.policy;
    const view = this.view();
    const pile = policy.pile(view, p.rng);
    if (!pile) return;
    const offers = p.drawOpportunity(pile);
    const held = new Map<string, number>();
    for (const holding of p.state.holdings ?? []) {
      if (!holding.ended) held.set(holding.cardId, holding.units ?? 1);
    }
    const pick = policy.take(offers, view, held);
    if (!pick) return;
    let choice = pick.choice;
    let quote = p.quoteOpportunity(pick.card, choice);
    if (quote.needsSwap && quote.sideHustles.length > 0) {
      // give up the weakest hustle, and only for a card that is clearly better
      const weakest = [...quote.sideHustles].sort(
        (x, y) => (x.lineMinor ?? x.cashflowMinor) - (y.lineMinor ?? y.cashflowMinor),
      )[0];
      const weakestMonthly = Math.max(weakest.lineMinor ?? 0, weakest.cashflowMinor);
      if (expectedMonthlyMinor(pick.card) < weakestMonthly * 1.3) return;
      choice = { ...choice, swapOut: weakest.cardId };
      quote = p.quoteOpportunity(pick.card, choice);
    }
    if (!quote.ok) return;
    p.buyOpportunity(pick.card, choice, quote.costMinor);
    this.record.taken[pick.card.id] = (this.record.taken[pick.card.id] ?? 0) + 1;
  }

  private harvest(): void {
    const p = this.p;
    const policy = this.config.policy;
    const context = p.harvestContext();
    const { pending } = p.playHarvest();
    // a window to sell in
    for (const holding of [...(p.state.holdings ?? [])]) {
      if (holding.ended || !holding.marketTag) continue;
      const open =
        pending.window === 'ALL' ||
        (Array.isArray(pending.window) && pending.window.includes(holding.marketTag));
      if (!open) continue;
      const card = p.cards.find((candidate) => candidate.id === holding.cardId);
      if (!card || (!card.share && holding.assetBaseMinor === undefined)) continue;
      if (
        !policy.sellWindow(
          this.view(),
          { title: holding.title, tag: holding.marketTag },
          indexOf(p.state, holding.marketTag),
        )
      )
        continue;
      const gross = card.share
        ? unitPriceNow(card, holding, p.state) * (holding.units ?? 0)
        : valueOf(card, holding, p.state);
      p.apply(
        sellHolding(
          p.books,
          holding.title,
          { grossMinor: gross, costsMinor: 0, owedMinor: 0 },
          context,
        ),
      );
    }
    // a buyer
    for (const sale of pending.sales) {
      if (!policy.acceptBuyer(this.view(), sale)) continue;
      const live = (p.state.holdings ?? []).some(
        (holding) => holding.title === sale.holding && !holding.ended,
      );
      if (!live) continue;
      p.apply(sellHolding(p.books, sale.holding, sale, context));
      p.payDues();
    }
    // a hype
    for (let offer of pending.ladders) {
      const live = (p.state.holdings ?? []).some(
        (holding) => holding.title === offer.holding && !holding.ended,
      );
      if (!live) continue;
      let choice = policy.ladder(this.view(), offer);
      if (choice === 'skip') continue;
      for (let step = 0; step < 6 && choice === 'ride' && offer.state !== 'done'; step += 1) {
        offer = rideLadder(offer, p.rng).offer;
        if (offer.state === 'done') break;
        choice = policy.ladder(this.view(), offer);
      }
      p.apply(
        sellHolding(
          p.books,
          offer.holding,
          { grossMinor: ladderPayout(offer), costsMinor: 0, owedMinor: 0 },
          context,
        ),
      );
    }
  }
}

export function simulateDreamGame(config: DreamSimConfig): DreamGameRecord {
  return new DreamSim(config).run();
}
