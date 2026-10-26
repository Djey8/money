import { CASHFLOW_GAME_SETS } from '../../cashflow-content';
import { HARVEST_CARDS } from '../../cashflow-harvest-cards';
import { OPPORTUNITY_CARDS } from '../../cashflow-opportunity-cards';
import { applyEffectsToBooks, type GameBooks } from '../books';
import { cashOnHandMinor, loanForShortfallMinor } from '../cash';
import { fixedClock } from '../clock';
import { findStage, applyCareerMoment, applyCareerStage, rollCareer } from '../career';
import { normalizeCustomRules, classicRulesOfMode, type CustomRules } from '../custom-rules';
import { difficultySettings } from '../difficulty';
import {
  EMPTY_DREAM_LOG,
  DREAM_MOMENTS,
  canTakeDream,
  drawDreamLanding,
  type DreamLog,
  type DreamSettings,
} from '../dream-deck';
import { buildDreamfundBoard, type BoardSetup } from '../dreamfund-board';
import { emptyEffects, type BookSubscription } from '../effects';
import {
  drawEmergencyCard,
  emptyEmergencyDeck,
  quoteEmergency,
  type EmergencyContext,
  type EmergencySelection,
} from '../emergency-deck';
import { pickCashflowProfession } from '../engine';
import { endIfOver } from '../game-end';
import { identityText } from '../game-text';
import {
  drawHarvestCard,
  indexOf,
  initialMarkets,
  ladderPayout,
  playHarvestCard,
  rideLadder,
  sellHolding,
  unitPriceNow,
  valueOf,
} from '../harvest';
import { activeInsurances } from '../insurance';
import { drawLifeCard, resolveLifeCard, type LifeDecision } from '../life-deck';
import {
  applyLifeOutcome,
  endLifeLine,
  lifeContext,
  monthlyExpensesMinor,
  netMonthlyMinor,
} from '../life-books';
import { endableLines } from '../life-deck';
import { playBankLoan } from '../loan';
import {
  buyOpportunity,
  drawOpportunityOffers,
  quoteOpportunity,
  rollsFor,
  type OpportunityContext,
  type OpportunitySettings,
} from '../opportunity';
import { payOffLiability } from '../liability-payoff';
import { rollDie, seededRng, type Rng } from '../rng';
import { summarizeGameFinances } from '../saved-games';
import { currentTurn, playTurn, settleDecision } from '../turn';
import type { CashflowGameSet, CashflowProfession, CashflowGameState } from '../types';
import type { DreamPolicy, DreamView } from './policies';

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

/** A payment plan of a project: so much every Payday until what is left is paid. */
interface SimPlan {
  kind: 'mojo' | 'life' | 'smile' | 'emergency';
  /** The dream card of a Smile project; the card of an emergency. */
  id: string;
  perMinor: number;
  leftMinor: number;
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
  emergenciesPaidMinor: number;
  /** The last cards before the game ended (a bankruptcy shows what broke it). */
  lastEvents: string[];
}

const TODAY = '2026-11-15';
const NOW = '2026-11-15T09:00:00.000Z';

export class DreamSim {
  books: GameBooks;
  readonly rng: Rng;
  private readonly rules: CustomRules;
  private readonly gameSet: CashflowGameSet;
  private readonly profession: CashflowProfession;
  private readonly board: ReturnType<typeof buildDreamfundBoard>['board'];
  private readonly deps;
  private turns = 0;
  private reserveMinor = 0;
  private dreamSavedMinor = 0;
  private dreamLived = false;
  private readonly dreamTargetMinor: number;
  private smile: {
    cardId: string;
    totalMinor: number;
    savedMinor: number;
    points: number;
    round: number;
  }[] = [];
  private dreamPoints = 0;
  /** What the Smile and Fire projects are paid by: a plan pays an installment at every Payday (the payment plans of the app). */
  private plans: SimPlan[] = [];
  private bonusPoints = 0;
  private readonly record: DreamGameRecord;
  private readonly debtTags: string[];

  constructor(private readonly config: DreamSimConfig) {
    this.rng = seededRng(config.seed);
    this.rules = normalizeCustomRules({ mode: 'free', ...config.rules });
    const gameSet = CASHFLOW_GAME_SETS.find((set) => set.id === 'jfk-stories');
    const professionId = config.professionId ?? 'dual-student-informatik';
    const profession = gameSet?.professions.find((candidate) => candidate.id === professionId);
    if (!gameSet || !profession) throw new Error(`Unknown character ${professionId}`);
    this.gameSet = gameSet;
    this.profession = profession;
    const setup: BoardSetup = {
      shape: config.shape ?? 'ring',
      size: config.size ?? 'medium',
      seed: config.seed,
    };
    this.board = buildDreamfundBoard(setup).board;
    const pick = pickCashflowProfession(
      CASHFLOW_GAME_SETS,
      'jfk-stories',
      professionId,
      TODAY,
      'solo',
      classicRulesOfMode(this.rules.mode),
      setup,
    );
    const subscriptions: BookSubscription[] = pick.subscriptions.map((sub) => ({
      title: sub.title,
      account: sub.account,
      amountMinor: sub.amountMinor,
      startDate: TODAY,
      endDate: '',
      category: sub.category ?? '',
      comment: '#dreamfund',
      frequency: 'monthly',
    }));
    const kit = pick.starterKit;
    this.debtTags = (kit.liabilities ?? []).map((liability) => liability.tag);
    this.books = {
      state: {
        ...pick.state,
        customRules: this.rules,
        markets: initialMarkets(),
        dreams: EMPTY_DREAM_LOG,
      },
      allocation: { daily: 60, splurge: 10, smile: 10, fire: 20 },
      gameSet,
      subscriptions,
      transactions: pick.startingTransactions,
      liabilities: (kit.liabilities ?? []).map((liability) => ({
        tag: liability.tag,
        amountMinor: liability.amountMinor,
        investment: false,
      })),
      shares: (kit.shares ?? []).map((share) => ({ ...share })),
      investments: [],
      assets: [],
      growProjects: [],
    };
    this.deps = {
      clock: fixedClock(TODAY, NOW),
      text: identityText,
      money: (minor: number) => `${minor / 100}`,
      plainMoney: (minor: number) => `${minor / 100}`,
      lang: 'en' as const,
      rng: this.rng,
      opportunityCards: OPPORTUNITY_CARDS,
      difficulty: this.rules.difficulty,
      cards: {
        textFor: () => ({}),
        symbolFor: (symbol: string | undefined) => symbol,
        sharedText: () => '',
        groupName: (group: string) => group,
      },
    };
    const project = profession.profile?.texts.en.dream.project;
    this.dreamTargetMinor =
      project?.buckets.reduce((sum, bucket) => sum + bucket.targetMinor, 0) ?? 0;
    this.record = {
      seed: config.seed,
      policyId: config.policy.id,
      shape: setup.shape,
      size: setup.size,
      difficulty: this.rules.difficulty,
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
      lowestCashMinor: this.cash(),
      dreamPoints: 0,
      landings: {},
      taken: {},
      emergenciesPaidMinor: 0,
      lastEvents: [],
    };
  }

  // ── the books ──

  private get state(): CashflowGameState {
    return this.books.state;
  }

  cash(): number {
    return cashOnHandMinor(this.books.transactions, this.books.allocation);
  }

  private setState(state: CashflowGameState): void {
    this.books = { ...this.books, state };
  }

  private apply(effects: ReturnType<typeof emptyEffects>): void {
    this.books = applyEffectsToBooks(this.books, effects);
  }

  private add(account: string, amountMinor: number, category: string): void {
    const effects = emptyEffects(this.state, null);
    effects.appendedTransactions.push({
      account,
      amountMinor,
      date: TODAY,
      time: '',
      category,
      comment: '#dreamfund',
    });
    this.apply(effects);
  }

  /** Money out of the account: the reserve gives back first, then the Bank loan covers what is still short. */
  private spend(costMinor: number, category: string, fromReserve = true): void {
    if (costMinor <= 0) return;
    let cash = this.cash();
    if (fromReserve && cash < costMinor && this.reserveMinor > 0) {
      const back = Math.min(this.reserveMinor, costMinor - cash);
      this.reserveMinor -= back;
      this.add('Fire', back, '@Mojo');
      cash += back;
    }
    if (cash < costMinor) {
      const step = this.books.gameSet?.loanRule.incrementMinor ?? 0;
      const loan = loanForShortfallMinor(costMinor, cash, step);
      this.apply(playBankLoan(this.books, loan, this.deps, { mandatory: true }));
    }
    this.add('Daily', -costMinor, category);
  }

  private log(event: string): void {
    this.record.lastEvents = [...this.record.lastEvents, `${this.turns}:${event}`].slice(-8);
  }

  private payDues(): void {
    for (const due of this.state.paymentsDue ?? []) this.spend(due.costMinor, `@${due.category}`);
    if ((this.state.paymentsDue ?? []).length > 0) {
      this.setState({ ...this.state, paymentsDue: [] });
    }
  }

  private monthlyExpenses(): number {
    return monthlyExpensesMinor(this.state, this.books.subscriptions);
  }

  private debtsMinor(): number {
    return this.books.liabilities
      .filter((liability) => this.debtTags.includes(liability.tag))
      .reduce((sum, liability) => sum + liability.amountMinor, 0);
  }

  private view(): DreamView {
    const finances = summarizeGameFinances(this.state, this.books.subscriptions);
    const expenses = this.monthlyExpenses();
    const cash = this.cash();
    return {
      cashMinor: cash,
      monthlyExpensesMinor: expenses,
      passiveMinor: finances.passiveIncomeMinor,
      reserveMinor: this.reserveMinor,
      reserveTargetMinor: expenses * 3,
      round: this.state.round,
      debtsMinor: this.debtsMinor(),
      dreamFundedMinor: this.dreamSavedMinor,
      dreamTargetMinor: this.dreamTargetMinor,
      spendableMinor: Math.max(0, cash - this.config.policy.bufferMonths * expenses),
      markets: this.state.markets ?? {},
      holdingsCount: (this.state.holdings ?? []).filter((holding) => !holding.ended).length,
      difficulty: this.rules.difficulty,
    };
  }

  // ── the run ──

  run(): DreamGameRecord {
    const max = this.config.maxTurns ?? 400;
    try {
      while (this.turns < max && currentTurn(this.state).phase !== 'over' && !this.record.wonTurn) {
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
    const finances = summarizeGameFinances(this.state, this.books.subscriptions);
    const record = this.record;
    const turn = currentTurn(this.state);
    if (record.outcome !== 'error') {
      record.outcome = record.wonTurn
        ? 'won'
        : turn.outcome === 'bankrupt'
          ? 'bankrupt'
          : 'timeout';
    }
    record.turns = this.turns;
    record.paydays = this.state.round;
    record.cashMinor = this.cash();
    record.reserveMinor = this.reserveMinor;
    record.passiveMinor = finances.passiveIncomeMinor;
    record.expensesMinor = finances.expensesMinor;
    record.dreamPoints = this.dreamPoints + this.bonusPoints;
    record.netWorthMinor = this.netWorth();
    return record;
  }

  private netWorth(): number {
    const state = this.state;
    const holdingsValue = (state.holdings ?? [])
      .filter((holding) => !holding.ended)
      .reduce((sum, holding) => {
        const card = OPPORTUNITY_CARDS.find((candidate) => candidate.id === holding.cardId);
        return sum + (card ? valueOf(card, holding, state) : 0);
      }, 0);
    const loans = this.books.liabilities.reduce((sum, liability) => sum + liability.amountMinor, 0);
    return this.cash() + this.reserveMinor + this.dreamSavedMinor + holdingsValue - loans;
  }

  private turn(): void {
    const before = this.state.round;
    const result = playTurn(this.books, {
      ...this.deps,
      board: this.board,
      profession: this.profession,
    });
    let books = this.books;
    for (const effects of result.effects) books = applyEffectsToBooks(books, effects);
    this.books = books;
    this.turns += 1;
    const landed = result.move.landed.kind;
    this.record.landings[landed] = (this.record.landings[landed] ?? 0) + 1;
    for (let i = 0; i < this.state.round - before; i += 1) this.payday();
    const pending = currentTurn(this.state).pending;
    if (pending?.kind === 'story' && pending.tile && currentTurn(this.state).phase === 'decide') {
      this.tile(pending.tile);
    }
    if (currentTurn(this.state).phase === 'decide') {
      const settled = settleDecision(this.state, 'done', this.books.subscriptions);
      this.setState(settled.state);
    }
    this.setState(endIfOver(this.state, this.books.subscriptions));
    this.track();
  }

  private track(): void {
    const finances = summarizeGameFinances(this.state, this.books.subscriptions);
    const record = this.record;
    const expenses = this.monthlyExpenses();
    record.peakPassiveMinor = Math.max(record.peakPassiveMinor, finances.passiveIncomeMinor);
    record.lowestCashMinor = Math.min(record.lowestCashMinor, this.cash());
    const loan =
      this.books.liabilities.find((liability) => liability.tag === 'Bank loan')?.amountMinor ?? 0;
    record.peakBankLoanMinor = Math.max(record.peakBankLoanMinor, loan);
    if (!record.reserveFullTurn && expenses > 0 && this.reserveMinor >= expenses * 3)
      record.reserveFullTurn = this.turns;
    if (!record.debtsRepaidTurn && this.debtsMinor() === 0) record.debtsRepaidTurn = this.turns;
    if (!record.dreamLivedTurn && this.dreamLived) record.dreamLivedTurn = this.turns;
    if (
      !record.independentTurn &&
      expenses > 0 &&
      finances.passiveIncomeMinor >= finances.expensesMinor
    ) {
      record.independentTurn = this.turns;
    }
    if (
      !record.wonTurn &&
      record.reserveFullTurn &&
      this.reserveMinor >= expenses * 3 &&
      this.debtsMinor() === 0 &&
      this.dreamLived &&
      finances.passiveIncomeMinor >= finances.expensesMinor
    ) {
      record.wonTurn = this.turns;
    }
  }

  // ── a Payday: where the free money goes ──

  /** A thin month is thinned out: the lines of life that can be ended are ended, the dearest first, until it is safe again. */
  private trim(): void {
    for (let guard = 0; guard < 8; guard += 1) {
      const finances = summarizeGameFinances(this.state, this.books.subscriptions);
      if (finances.monthlyCashflowMinor >= finances.expensesMinor * 0.1) return;
      const lines = endableLines(this.state.lifeLines ?? []).filter((line) => line.amountMinor < 0);
      if (lines.length === 0) return;
      const worst = [...lines].sort((a, b) => a.amountMinor - b.amountMinor)[0];
      const books = { state: this.state, subscriptions: this.books.subscriptions };
      const effects = endLifeLine(books, worst.id, { date: TODAY, lang: 'en' });
      if (!effects) return;
      this.apply(effects);
      this.payDues();
    }
  }

  private payday(): void {
    this.trim();
    this.payInstallments();
    this.replan();
    this.extraPayments();
    this.track();
  }

  /** The installments of every plan are paid: the project they are for grows by them. */
  private payInstallments(): void {
    for (const plan of [...this.plans]) {
      const pay = Math.min(plan.perMinor, plan.leftMinor);
      if (pay <= 0) continue;
      this.spend(pay, `@${plan.kind}`, plan.kind !== 'mojo');
      plan.leftMinor -= pay;
      if (plan.kind === 'mojo') this.reserveMinor += pay;
      else if (plan.kind === 'life') this.dreamSavedMinor += pay;
      else if (plan.kind === 'smile') {
        const dream = this.smile.find((candidate) => candidate.cardId === plan.id);
        if (dream) dream.savedMinor += pay;
      }
      if (plan.leftMinor <= 0) this.plans = this.plans.filter((candidate) => candidate !== plan);
    }
    this.checkDreams();
  }

  /** A dream that is fully funded is lived. */
  private checkDreams(): void {
    if (
      !this.dreamLived &&
      this.dreamTargetMinor > 0 &&
      this.dreamSavedMinor >= this.dreamTargetMinor
    ) {
      this.dreamLived = true;
      this.plans = this.plans.filter((plan) => plan.kind !== 'life');
    }
    for (const dream of [...this.smile]) {
      if (dream.savedMinor < dream.totalMinor) continue;
      this.dreamPoints += dream.points;
      this.smile = this.smile.filter((candidate) => candidate !== dream);
      this.plans = this.plans.filter(
        (plan) => !(plan.kind === 'smile' && plan.id === dream.cardId),
      );
      const log: DreamLog = this.state.dreams ?? EMPTY_DREAM_LOG;
      this.setState({
        ...this.state,
        dreams: {
          ...log,
          open: log.open.filter((open) => open.cardId !== dream.cardId),
          lived: [
            ...log.lived,
            { cardId: dream.cardId, points: dream.points, round: this.state.round },
          ],
        },
      });
    }
  }

  /**
   * The plans of the reserve and of the dreams are set to what the month can carry: a share of what is left of the monthly cashflow
   * after the plans already running (an emergency plan is paid first), in the order of the strategy.
   */
  private replan(): void {
    const policy = this.config.policy;
    const finances = summarizeGameFinances(this.state, this.books.subscriptions);
    const committed = this.plans
      .filter((plan) => plan.kind === 'emergency')
      .reduce((sum, plan) => sum + plan.perMinor, 0);
    let room = Math.max(
      0,
      Math.floor((finances.monthlyCashflowMinor - committed) * policy.planShare),
    );
    const months = Math.max(3, policy.planMonths);
    const set = (kind: SimPlan['kind'], id: string, left: number) => {
      this.plans = this.plans.filter((plan) => !(plan.kind === kind && plan.id === id));
      if (left <= 0 || room <= 0) return;
      const per = Math.min(room, Math.ceil(left / months));
      this.plans.push({ kind, id, perMinor: per, leftMinor: left });
      room -= per;
    };
    for (const priority of policy.priorities) {
      if (priority === 'reserve') {
        set('mojo', 'mojo', Math.max(0, this.monthlyExpenses() * 3 - this.reserveMinor));
      } else if (priority === 'dream') {
        if (!this.dreamLived && this.dreamTargetMinor > 0) {
          set('life', 'life', this.dreamTargetMinor - this.dreamSavedMinor);
        }
        for (const dream of this.smile)
          set('smile', dream.cardId, dream.totalMinor - dream.savedMinor);
      }
    }
  }

  /** What is left over a buffer after the plans: lump sums into the reserve, the debts and the dreams, as the strategy ranks them. */
  private extraPayments(): void {
    const policy = this.config.policy;
    const expenses = this.monthlyExpenses();
    const buffer = policy.bufferMonths * expenses;
    const free = () => Math.max(0, this.cash() - buffer);
    for (const priority of policy.priorities) {
      if (priority === 'reserve') {
        const put = Math.min(free(), Math.max(0, expenses * 3 - this.reserveMinor));
        if (put > 0) {
          this.add('Daily', -put, '@Mojo');
          this.reserveMinor += put;
        }
      } else if (priority === 'debt') {
        for (const liability of [...this.books.liabilities]) {
          if (liability.amountMinor <= 0) continue;
          const isBank = liability.tag === 'Bank loan';
          if (!isBank && !this.debtTags.includes(liability.tag)) continue;
          if (isBank) {
            const step = this.books.gameSet?.loanRule.incrementMinor ?? 100000;
            const repay = Math.min(liability.amountMinor, Math.floor(free() / step) * step);
            if (repay > 0) {
              try {
                this.apply(playBankLoan(this.books, -repay, this.deps));
              } catch {
                // the rules refuse it: it stays
              }
            }
          } else if (free() >= liability.amountMinor) {
            try {
              for (const effects of payOffLiability(
                this.books,
                this.profession,
                liability.tag,
                this.deps,
              )) {
                this.apply(effects);
              }
            } catch {
              // not allowed now: it stays
            }
          }
        }
      } else if (priority === 'dream') {
        this.fundDreams(free() * policy.dreamShare);
      }
    }
    this.checkDreams();
  }

  /** Extra money for dreams: the life dream first, then the dreams taken from the Dream tiles. */
  private fundDreams(money: number): void {
    let left = Math.floor(money);
    if (!this.dreamLived && this.dreamTargetMinor > 0 && left > 0) {
      const put = Math.min(left, this.dreamTargetMinor - this.dreamSavedMinor);
      this.spend(put, '@Dream', false);
      this.dreamSavedMinor += put;
      left -= put;
    }
    for (const dream of this.smile) {
      if (left <= 0) break;
      const put = Math.min(left, dream.totalMinor - dream.savedMinor);
      this.spend(put, '@Dream', false);
      dream.savedMinor += put;
      left -= put;
    }
  }

  // ── the tiles ──

  private tile(tile: string): void {
    switch (tile) {
      case 'emergency':
        return this.emergency();
      case 'life':
        return this.life();
      case 'career':
        return this.career();
      case 'dream':
        return this.dream();
      case 'opportunity':
        return this.opportunity();
      case 'harvest':
        return this.harvest();
    }
  }

  private emergency(): void {
    const cards = this.gameSet.decks?.emergency ?? [];
    if (cards.length === 0) return;
    const draw = drawEmergencyCard(
      cards,
      this.state.emergencyDeck ?? emptyEmergencyDeck(),
      this.state.possessions ?? [],
      this.rng,
    );
    this.setState({ ...this.state, emergencyDeck: draw.deck });
    const level = difficultySettings(this.rules.difficulty);
    const context: EmergencyContext = {
      insurances: activeInsurances(this.state),
      traits: this.state.traits ?? [],
      openEmergencies: 0,
      priceFactor: (this.profession.priceFactor ?? 1) * level.emergencyCostMultiplier,
      deductibleCapMinor: level.insuranceDeductibleCapMinor,
    };
    const card = draw.card;
    this.log(`E ${card.id}`);
    let selection: EmergencySelection = { rolls: {} };
    for (let guard = 0; guard < 10; guard += 1) {
      const quote = quoteEmergency(card, selection, context);
      if (quote.needsChoice) {
        // the cheapest way out
        let best: { id: string; pay: number } | null = null;
        for (const choice of card.choices ?? []) {
          let probe: EmergencySelection = {
            ...selection,
            choiceId: choice.id,
            rolls: { ...(selection.rolls ?? {}) },
          };
          for (let i = 0; i < 6; i += 1) {
            const q = quoteEmergency(card, probe, context);
            if (!q.needsRolls.length) break;
            probe = { ...probe, rolls: { ...probe.rolls, [q.needsRolls[0]]: 3 } };
          }
          const pay = quoteEmergency(card, probe, context).payMinor;
          if (!best || pay < best.pay) best = { id: choice.id, pay };
        }
        selection = { ...selection, choiceId: best?.id };
        continue;
      }
      if (quote.needsRolls.length > 0) {
        selection = {
          ...selection,
          rolls: { ...selection.rolls, [quote.needsRolls[0]]: rollDie(this.rng) },
        };
        continue;
      }
      this.record.emergenciesPaidMinor += quote.payMinor;
      this.payEmergency(card.id, card.payment === 'pay_now', quote.payMinor);
      return;
    }
  }

  /** An emergency is paid from cash, from the reserve, or - where the card allows - on a plan of 3, 6 or 12 Paydays with its surcharge. */
  private payEmergency(id: string, mustPayNow: boolean, payMinor: number): void {
    const policy = this.config.policy;
    const buffer = policy.bufferMonths * this.monthlyExpenses();
    if (mustPayNow || this.cash() - payMinor >= buffer || this.reserveMinor >= payMinor) {
      this.spend(payMinor, '@Emergency');
      return;
    }
    const surcharge = difficultySettings(this.rules.difficulty).planSurchargePercents;
    const finances = summarizeGameFinances(this.state, this.books.subscriptions);
    const room = Math.max(
      0,
      finances.monthlyCashflowMinor - this.plans.reduce((sum, plan) => sum + plan.perMinor, 0),
    );
    const choices = [3, 6, 12].map((months, at) => {
      const total = Math.round(payMinor * (1 + surcharge[at] / 100));
      return { total, per: Math.ceil(total / months) };
    });
    const fits = choices.find((choice) => choice.per <= room) ?? choices[2];
    this.plans.push({ kind: 'emergency', id, perMinor: fits.per, leftMinor: fits.total });
  }

  private life(): void {
    const cards = this.gameSet.decks?.life ?? [];
    const life = this.state.life;
    if (cards.length === 0 || !life) return;
    const draw = drawLifeCard(cards, this.state.lifeDeck ?? emptyEmergencyDeck(), life, this.rng);
    this.setState({ ...this.state, lifeDeck: draw.deck });
    const card = draw.card;
    this.log(`L ${card.id}`);
    let decision: LifeDecision;
    if (card.type === 'fate') decision = { kind: 'fate' };
    else if (card.type === 'dice') {
      // a wish for a baby, a risk worth taking only with a full reserve and a month that can carry it
      const finances = summarizeGameFinances(this.state, this.books.subscriptions);
      const safe =
        this.reserveMinor >= this.monthlyExpenses() * 3 &&
        finances.monthlyCashflowMinor >= finances.expensesMinor * 0.3;
      decision = card.optional && !safe ? { kind: 'pass' } : { kind: 'roll' };
    } else if (card.type === 'giving') decision = { kind: 'pass' };
    else if (card.options?.length) decision = { kind: 'option', id: card.options[0].id };
    else decision = this.lifeChoice(card);
    const books = { state: this.state, subscriptions: this.books.subscriptions };
    const outcome = resolveLifeCard(card, decision, lifeContext(books, 'en', this.rng), (id) =>
      cards.find((c) => c.id === id),
    );
    this.apply(applyLifeOutcome(books, outcome, { date: TODAY, lang: 'en' }));
    this.payDues();
  }

  /**
   * A choice of life: a sensible player takes what they can afford - a new monthly cost that leaves a good part of the month, and a
   * payment that cash and reserve can carry - and the strategy's appetite decides the rest.
   */
  private lifeChoice(card: Parameters<typeof resolveLifeCard>[0]): LifeDecision {
    const cards = this.gameSet.decks?.life ?? [];
    const books = { state: this.state, subscriptions: this.books.subscriptions };
    const probe = resolveLifeCard(
      card,
      { kind: 'accept' },
      lifeContext(books, 'en', seededRng(1)),
      (id) => cards.find((c) => c.id === id),
    );
    const impact = probe.lines.reduce((sum, line) => sum + line.amountMinor, 0);
    const cashflow = summarizeGameFinances(
      this.state,
      this.books.subscriptions,
    ).monthlyCashflowMinor;
    const payNow = Math.max(0, -probe.oneTimeMinor);
    const affordable = payNow <= this.cash() + this.reserveMinor;
    const keeps = impact >= 0 || cashflow + impact >= cashflow * 0.4;
    if (!affordable || !keeps) return { kind: 'decline' };
    return impact >= 0 || this.rng() < this.config.policy.lifeAcceptChance
      ? { kind: 'accept' }
      : { kind: 'decline' };
  }

  private career(): void {
    const track = this.profession.career;
    const career = this.state.career;
    if (!track || !career) return;
    const result = rollCareer(career, track, this.rng);
    this.log(`C ${result.kind}`);
    const books = { state: this.state, subscriptions: this.books.subscriptions };
    if (result.kind === 'promoted' || result.kind === 'branch') {
      const stage = findStage(track, result.kind === 'promoted' ? result.to : result.options[0]);
      if (stage) {
        this.apply(applyCareerStage(books, stage, { date: TODAY, lang: 'en' }));
        this.payDues();
      }
    } else if (result.kind === 'moment') {
      this.apply(applyCareerMoment(books, result.moment, { date: TODAY, lang: 'en' }));
    } else if (result.kind === 'failed' && result.retakeMinor) {
      this.spend(result.retakeMinor, '@Exam');
    }
  }

  private dream(): void {
    const cards = this.gameSet.decks?.dream ?? [];
    if (cards.length === 0) return;
    const settings: DreamSettings = {
      offersPerLanding: this.rules.dreamOffers,
      maxOpenDreams: this.rules.maxOpenDreams,
      lifeCanDecline: this.rules.lifeMayDecline,
    };
    const log: DreamLog = this.state.dreams ?? EMPTY_DREAM_LOG;
    const landing = drawDreamLanding(
      cards,
      DREAM_MOMENTS,
      this.state.dreamDeck ?? emptyEmergencyDeck(),
      { log, life: this.state.life, settings },
      this.rng,
    );
    this.setState({ ...this.state, dreamDeck: landing.deck });
    if (landing.kind === 'moment') {
      this.log(`D ${landing.moment.id}`);
      this.moment(landing.moment.id, cards, settings, log);
      return;
    }
    const pick = this.config.policy.dream(landing.offers, this.view(), log.open.length);
    if (!pick || !canTakeDream(log, settings)) return;
    this.takeDream(pick, log);
  }

  /** What a bot does with a dream moment: it uses it for the dreams it has open (the life dream is left as it is). */
  private moment(
    id: string,
    cards: readonly import('../dream-deck').DreamCard[],
    settings: DreamSettings,
    log: DreamLog,
  ): void {
    const open = this.smile;
    const cardOf = (cardId: string) => cards.find((candidate) => candidate.id === cardId);
    const half = open.find((dream) => dream.savedMinor * 2 >= dream.totalMinor);
    const gift = (minor: number) => {
      const target = open[0];
      if (target) target.savedMinor += minor;
      else this.add('Smile', minor, '@Gift');
    };
    if (id === 'M01' && half) {
      half.totalMinor = Math.round(half.savedMinor + (half.totalMinor - half.savedMinor) * 0.85);
    } else if (id === 'M02') {
      gift(30000);
    } else if (id === 'M03' || id === 'M04') {
      const trip = open.find((dream) => {
        const category = cardOf(dream.cardId)?.category;
        return (
          category === 'travel' ||
          category === 'wonders' ||
          (id === 'M04' && category === 'adventure')
        );
      });
      const partner = (this.state.life?.relationship ?? 'single') !== 'single';
      if (trip && (id === 'M03' || partner)) {
        const percent = id === 'M03' ? 20 : 25;
        // the last-minute deal needs the dream to be funded completely right now
        if (
          id === 'M04' ||
          this.cash() >= (trip.totalMinor - trip.savedMinor) * (1 - percent / 100)
        ) {
          trip.totalMinor = Math.round(trip.totalMinor * (1 - percent / 100));
          trip.savedMinor = Math.min(trip.savedMinor, trip.totalMinor);
        }
      }
    } else if (id === 'M05') {
      const landing = drawDreamLanding(
        cards,
        [],
        this.state.dreamDeck ?? emptyEmergencyDeck(),
        { log, life: this.state.life, settings, forceOffers: 3 },
        this.rng,
      );
      if (landing.kind === 'offers') {
        const pick = this.config.policy.dream(landing.offers, this.view(), log.open.length);
        if (pick && canTakeDream(log, settings)) this.takeDream(pick, log);
      }
    } else if (id === 'M06') {
      const net = netMonthlyMinor(this.state, this.books.subscriptions);
      gift(Math.round(net * 0.05));
    } else if (id === 'M07') {
      this.bonusPoints += open.filter(
        (dream) => dream.savedMinor > 0 && this.state.round - dream.round >= 6,
      ).length;
    }
    this.checkDreams();
  }

  private takeDream(pick: import('../dream-deck').DreamCard, log: DreamLog): void {
    this.smile.push({
      cardId: pick.id,
      totalMinor: pick.totalMinor,
      savedMinor: 0,
      points: pick.points,
      round: this.state.round,
    });
    this.setState({
      ...this.state,
      dreams: {
        ...log,
        open: [
          ...log.open,
          { cardId: pick.id, projectTitle: pick.title.en, round: this.state.round },
        ],
      },
    });
  }

  private opportunitySettings(): OpportunitySettings {
    return {
      offersPerLanding: this.rules.opportunityOffers,
      maxSideHustles: this.rules.maxSideHustles,
      savingsCardCopies: this.rules.savingsCardCopies,
    };
  }

  private opportunityContext(): OpportunityContext {
    const debt = this.books.liabilities
      .filter((liability) => liability.tag !== 'Bank loan')
      .reduce((sum, liability) => sum + liability.amountMinor, 0);
    return {
      life: this.state.life,
      careerStage: Number(/\d+/.exec(this.state.career?.stage ?? 'C1')?.[0] ?? 1),
      holdings: this.state.holdings ?? [],
      debtMinor: debt,
    };
  }

  private opportunity(): void {
    const policy = this.config.policy;
    const view = this.view();
    const pile = policy.pile(view, this.rng);
    if (!pile) return;
    const context = this.opportunityContext();
    const settings = this.opportunitySettings();
    const draw = drawOpportunityOffers(
      OPPORTUNITY_CARDS,
      this.state.opportunityDeck,
      pile,
      settings,
      context,
      this.rng,
    );
    this.setState({ ...this.state, opportunityDeck: draw.deck });
    const held = new Map<string, number>();
    for (const holding of this.state.holdings ?? []) {
      if (!holding.ended) held.set(holding.cardId, holding.units ?? 1);
    }
    const pick = policy.take(draw.offers, view, held);
    if (!pick) return;
    let choice = pick.choice;
    let quote = quoteOpportunity(pick.card, choice, context, settings, OPPORTUNITY_CARDS);
    if (quote.needsSwap && quote.sideHustles.length > 0) {
      choice = { ...choice, swapOut: quote.sideHustles[0].cardId };
      quote = quoteOpportunity(pick.card, choice, context, settings, OPPORTUNITY_CARDS);
    }
    if (!quote.ok) return;
    this.spend(quote.costMinor, `@${pick.card.title.en}`);
    const purchase = buyOpportunity(
      this.books,
      pick.card,
      choice,
      rollsFor(pick.card, this.rng, this.rules.difficulty),
      {
        date: TODAY,
        lang: 'en',
        context,
        cards: OPPORTUNITY_CARDS,
        difficulty: this.rules.difficulty,
      },
    );
    this.apply(purchase.effects);
    this.payDues();
    this.record.taken[pick.card.id] = (this.record.taken[pick.card.id] ?? 0) + 1;
    this.log(`O ${pick.card.id}`);
  }

  private harvest(): void {
    const policy = this.config.policy;
    const draw = drawHarvestCard(HARVEST_CARDS, this.state.harvestDeck, this.rng);
    this.setState({ ...this.state, harvestDeck: draw.deck });
    const context = {
      cards: OPPORTUNITY_CARDS,
      lang: 'en' as const,
      date: TODAY,
      rng: this.rng,
      difficulty: this.rules.difficulty,
    };
    this.log(`H ${draw.card.id}`);
    const played = playHarvestCard(this.books, draw.card, context);
    this.apply(played.effects);
    this.payDues();
    const pending = played.pending;
    // a window to sell in
    for (const holding of [...(this.state.holdings ?? [])]) {
      if (holding.ended || !holding.marketTag) continue;
      const open =
        pending.window === 'ALL' ||
        (Array.isArray(pending.window) && pending.window.includes(holding.marketTag));
      if (!open) continue;
      const card = OPPORTUNITY_CARDS.find((candidate) => candidate.id === holding.cardId);
      if (!card || (!card.share && holding.assetBaseMinor === undefined)) continue;
      if (
        !policy.sellWindow(
          this.view(),
          { title: holding.title, tag: holding.marketTag },
          indexOf(this.state, holding.marketTag),
        )
      )
        continue;
      const gross = card.share
        ? unitPriceNow(card, holding, this.state) * (holding.units ?? 0)
        : valueOf(card, holding, this.state);
      this.apply(
        sellHolding(
          this.books,
          holding.title,
          { grossMinor: gross, costsMinor: 0, owedMinor: 0 },
          context,
        ),
      );
    }
    // a buyer
    for (const sale of pending.sales) {
      if (!policy.acceptBuyer(this.view(), sale)) continue;
      const live = (this.state.holdings ?? []).some(
        (holding) => holding.title === sale.holding && !holding.ended,
      );
      if (!live) continue;
      this.apply(sellHolding(this.books, sale.holding, sale, context));
      this.payDues();
    }
    // a hype
    for (let offer of pending.ladders) {
      const live = (this.state.holdings ?? []).some(
        (holding) => holding.title === offer.holding && !holding.ended,
      );
      if (!live) continue;
      let choice = policy.ladder(this.view(), offer);
      if (choice === 'skip') continue;
      for (let step = 0; step < 6 && choice === 'ride' && offer.state !== 'done'; step += 1) {
        offer = rideLadder(offer, this.rng).offer;
        if (offer.state === 'done') break;
        choice = policy.ladder(this.view(), offer);
      }
      this.apply(
        sellHolding(
          this.books,
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
