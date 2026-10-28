import { CASHFLOW_GAME_SETS } from '../../cashflow-content';
import { applyEffectsToBooks, type GameBooks } from '../books';
import { cashOnHandMinor, loanForShortfallMinor } from '../cash';
import { fixedClock } from '../clock';
import {
  findStage,
  applyCareerMoment,
  applyCareerStage,
  rollCareer,
  type CareerResult,
} from '../career';
import { normalizeCustomRules, classicRulesOfMode, type CustomRules } from '../custom-rules';
import { difficultySettings } from '../difficulty';
import { gameSetFor } from '../card-scale';
import { professionIdAtDifficulty } from '../game-sets';
import type { OpportunityCard } from '../opportunity-deck';
import type { HarvestCard } from '../harvest-deck';
import {
  EMPTY_DREAM_LOG,
  DREAM_MOMENTS,
  canTakeDream,
  drawDreamLanding,
  type DreamCard,
  type DreamLog,
  type DreamSettings,
} from '../dream-deck';
import { buildDreamfundBoard, type BoardSetup } from '../dreamfund-board';
import { emptyEffects, type BookSubscription } from '../effects';
import {
  drawEmergencyCard,
  emptyEmergencyDeck,
  quoteEmergency,
  type EmergencyCard,
  type EmergencyContext,
  type EmergencySelection,
} from '../emergency-deck';
import { pickCashflowProfession } from '../engine';
import { endIfOver } from '../game-end';
import { identityText } from '../game-text';
import {
  drawHarvestCard,
  initialMarkets,
  ladderPayout,
  playHarvestCard,
  rideLadder,
  sellHolding,
  standingSale,
  unitPriceNow,
  valueOf,
  type HarvestLadderOffer,
} from '../harvest';
import { activeInsurances } from '../insurance';
import {
  drawLifeCard,
  endableLines,
  resolveLifeCard,
  type LifeCard,
  type LifeDecision,
} from '../life-deck';
import {
  applyLifeOutcome,
  endLifeLine,
  lifeContext,
  monthlyExpensesMinor,
  netMonthlyMinor,
} from '../life-books';
import { playBankLoan } from '../loan';
import {
  buyOpportunity,
  drawOpportunityOffers,
  quoteOpportunity,
  rollsFor,
  type OpportunityChoice,
  type OpportunityContext,
  type OpportunitySettings,
} from '../opportunity';
import { payOffLiability } from '../liability-payoff';
import { rollDie, seededRng, type Rng } from '../rng';
import { summarizeGameFinances } from '../saved-games';
import { currentTurn, playTurn, settleDecision } from '../turn';
import type { CashflowGameSet, CashflowGameState, CashflowProfession } from '../types';

/**
 * One player's Dreamfund life as plain data and the rules that move it (JFK, 2026-10-27): the books, the reserve (Mojo), the dreams
 * and their funding, the payment plans, the points. It is the part of the simulation that is not a strategy - extracted so that the
 * simulation, the bots and the multiplayer table play the very same rules. Every method either draws a card (and says what was
 * drawn) or applies a decision that was taken (a payment, a purchase, an answer); who decides - a policy, a human's command - is not
 * its business. It changes itself in place; the table clones it around a command, so its reducer stays pure.
 */

export const TODAY = '2026-11-15';
export const NOW = '2026-11-15T09:00:00.000Z';

/** A payment plan of a project: so much every Payday until what is left is paid. */
export interface DreamPlan {
  kind: 'mojo' | 'life' | 'smile' | 'emergency';
  /** The dream card of a Smile project; the card of an emergency. */
  id: string;
  perMinor: number;
  leftMinor: number;
}

export interface DreamProject {
  cardId: string;
  totalMinor: number;
  savedMinor: number;
  points: number;
  round: number;
}

export interface DreamPlayerConfig {
  /** The dice and the shuffles: a seeded random source (a table passes its own, shared one). */
  rng: Rng;
  /** The seed the board is built from. */
  seed: number;
  professionId?: string;
  shape?: BoardSetup['shape'];
  size?: BoardSetup['size'];
  rules?: Partial<CustomRules>;
  /** At a table the Harvest markets are everybody's: this player's own Paydays do not drift them. */
  sharedMarkets?: boolean;
}

/** A player's life as plain data (no rules, no cards): what a table stores and sends. */
export interface DreamPlayerData {
  seed: number;
  /** The character as chosen (the variant of its difficulty is found from the rules). */
  professionId: string;
  rules: CustomRules;
  shape: BoardSetup['shape'];
  size: BoardSetup['size'];
  /** The books without the game set (the set is the same for everybody and is found again). */
  books: Omit<GameBooks, 'gameSet'>;
  reserveMinor: number;
  dreamSavedMinor: number;
  dreamLived: boolean;
  smile: DreamProject[];
  dreamPoints: number;
  bonusPoints: number;
  plans: DreamPlan[];
  turns: number;
}

type Pending = ReturnType<typeof playHarvestCard>['pending'];

export class DreamPlayer {
  books: GameBooks;
  readonly rng: Rng;
  readonly rules: CustomRules;
  readonly gameSet: CashflowGameSet;
  readonly cards: OpportunityCard[];
  readonly harvestCards: HarvestCard[];
  readonly profession: CashflowProfession;
  readonly board: ReturnType<typeof buildDreamfundBoard>['board'];
  readonly setup: BoardSetup;
  readonly deps;
  readonly debtTags: string[];
  /** The character as asked for, before its difficulty picked the variant. */
  readonly baseProfessionId: string;
  readonly dreamTargetMinor: number;
  reserveMinor = 0;
  dreamSavedMinor = 0;
  dreamLived = false;
  smile: DreamProject[] = [];
  dreamPoints = 0;
  bonusPoints = 0;
  /** What the Smile and Fire projects are paid by: a plan pays an installment at every Payday (the payment plans of the app). */
  plans: DreamPlan[] = [];
  /** Rolls played. */
  turns = 0;
  /** What happened, for whoever keeps a history (an event like `E E04`, `L L12`, `O S36`). */
  onEvent?: (event: string) => void;

  constructor(config: DreamPlayerConfig) {
    this.rng = config.rng;
    this.baseProfessionId = (config.professionId ?? 'dual-student-informatik').split('~')[0];
    this.rules = normalizeCustomRules({ mode: 'free', ...config.rules });
    const gameSet = CASHFLOW_GAME_SETS.find((set) => set.id === 'jfk-stories');
    // Easy and Hard are characters of their own that share the story of the one asked for
    const professionId = professionIdAtDifficulty(
      gameSet,
      config.professionId ?? 'dual-student-informatik',
      this.rules.difficulty,
    );
    const profession = gameSet?.professions.find((candidate) => candidate.id === professionId);
    if (!gameSet || !profession) throw new Error(`Unknown character ${professionId}`);
    // the cards are as big as the character's price level makes them
    const scaled = gameSetFor(gameSet, profession.priceFactor, { round: profession.roundNumbers });
    this.gameSet = scaled;
    this.cards = scaled.decks?.opportunity ?? [];
    this.harvestCards = scaled.decks?.harvest ?? [];
    this.profession = profession;
    this.setup = {
      shape: config.shape ?? 'ring',
      size: config.size ?? 'medium',
      seed: config.seed,
    };
    this.board = buildDreamfundBoard(this.setup).board;
    const pick = pickCashflowProfession(
      CASHFLOW_GAME_SETS,
      'jfk-stories',
      professionId,
      TODAY,
      'solo',
      classicRulesOfMode(this.rules.mode),
      this.setup,
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
      gameSet: scaled,
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
      opportunityCards: this.cards,
      difficulty: this.rules.difficulty,
      sharedMarkets: config.sharedMarkets ?? false,
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
  }

  /** A player from a seed: the simulation's way in. */
  static fromSeed(config: Omit<DreamPlayerConfig, 'rng'>): DreamPlayer {
    return new DreamPlayer({ ...config, rng: seededRng(config.seed) });
  }

  /** The life as plain data: a copy that shares nothing with the player. */
  snapshot(): DreamPlayerData {
    const { gameSet: _gameSet, ...books } = this.books;
    void _gameSet;
    return JSON.parse(
      JSON.stringify({
        seed: this.setup.seed,
        professionId: this.baseProfessionId,
        rules: this.rules,
        shape: this.setup.shape,
        size: this.setup.size,
        books,
        reserveMinor: this.reserveMinor,
        dreamSavedMinor: this.dreamSavedMinor,
        dreamLived: this.dreamLived,
        smile: this.smile,
        dreamPoints: this.dreamPoints,
        bonusPoints: this.bonusPoints,
        plans: this.plans,
        turns: this.turns,
      }),
    ) as DreamPlayerData;
  }

  /** A life from its data, playing with the given dice. */
  static restore(
    data: DreamPlayerData,
    rng: Rng,
    options: { sharedMarkets?: boolean } = {},
  ): DreamPlayer {
    const player = new DreamPlayer({
      rng,
      sharedMarkets: options.sharedMarkets,
      seed: data.seed,
      professionId: data.professionId,
      shape: data.shape,
      size: data.size,
      rules: data.rules,
    });
    player.books = {
      ...(JSON.parse(JSON.stringify(data.books)) as Omit<GameBooks, 'gameSet'>),
      gameSet: player.gameSet,
    };
    player.reserveMinor = data.reserveMinor;
    player.dreamSavedMinor = data.dreamSavedMinor;
    player.dreamLived = data.dreamLived;
    player.smile = JSON.parse(JSON.stringify(data.smile));
    player.dreamPoints = data.dreamPoints;
    player.bonusPoints = data.bonusPoints;
    player.plans = JSON.parse(JSON.stringify(data.plans));
    player.turns = data.turns;
    return player;
  }

  // ── the books ──

  get state(): CashflowGameState {
    return this.books.state;
  }

  cash(): number {
    return cashOnHandMinor(this.books.transactions, this.books.allocation);
  }

  setState(state: CashflowGameState): void {
    this.books = { ...this.books, state };
  }

  apply(effects: ReturnType<typeof emptyEffects>): void {
    this.books = applyEffectsToBooks(this.books, effects);
  }

  add(account: string, amountMinor: number, category: string): void {
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
  spend(costMinor: number, category: string, fromReserve = true): void {
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

  log(event: string): void {
    this.onEvent?.(event);
  }

  /** What a card has put on the player's bill (an insurance excess, a repair): paid now. */
  payDues(): void {
    for (const due of this.state.paymentsDue ?? []) this.spend(due.costMinor, `@${due.category}`);
    if ((this.state.paymentsDue ?? []).length > 0) {
      this.setState({ ...this.state, paymentsDue: [] });
    }
  }

  monthlyExpenses(): number {
    return monthlyExpensesMinor(this.state, this.books.subscriptions);
  }

  debtsMinor(): number {
    return this.books.liabilities
      .filter((liability) => this.debtTags.includes(liability.tag))
      .reduce((sum, liability) => sum + liability.amountMinor, 0);
  }

  finances() {
    return summarizeGameFinances(this.state, this.books.subscriptions);
  }

  /** What the player is worth: cash, reserve, dream money and holdings less every debt. */
  netWorth(): number {
    const state = this.state;
    const holdingsValue = (state.holdings ?? [])
      .filter((holding) => !holding.ended)
      .reduce((sum, holding) => {
        const card = this.cards.find((candidate) => candidate.id === holding.cardId);
        return sum + (card ? valueOf(card, holding, state) : 0);
      }, 0);
    const loans = this.books.liabilities.reduce((sum, liability) => sum + liability.amountMinor, 0);
    return this.cash() + this.reserveMinor + this.dreamSavedMinor + holdingsValue - loans;
  }

  // ── a turn ──

  /**
   * The roll: the token moves, the landing's first effects are applied. Returns the tile that was landed on, the Paydays that were
   * passed on the way (each is to be settled with `payday`) and the story tile that waits for the player's decisions, if any.
   */
  roll(): {
    landed: string;
    paydays: number;
    dice: number[];
    total: number;
    from: number | null;
    to: number;
    openingPayday: boolean;
  } {
    const before = this.state.round;
    const from = this.state.boardPosition;
    const result = playTurn(this.books, {
      ...this.deps,
      board: this.board,
      profession: this.profession,
    });
    let books = this.books;
    for (const effects of result.effects) books = applyEffectsToBooks(books, effects);
    this.books = books;
    this.turns += 1;
    return {
      landed: result.move.landed.kind,
      paydays: this.state.round - before,
      dice: result.roll.dice,
      total: result.roll.total,
      from,
      to: result.move.to,
      openingPayday: result.openingPayday,
    };
  }

  /** The tile the player has to deal with after a roll (an emergency, a life card, an opportunity...), or null. */
  pendingTile(): string | null {
    const pending = currentTurn(this.state).pending;
    if (pending?.kind === 'story' && pending.tile && currentTurn(this.state).phase === 'decide') {
      return pending.tile;
    }
    return null;
  }

  /** Done deciding: the turn ends (and the game, when it is over). */
  endTurn(): void {
    if (currentTurn(this.state).phase === 'decide') {
      const settled = settleDecision(this.state, 'done', this.books.subscriptions);
      this.setState(settled.state);
    }
    this.setState(endIfOver(this.state, this.books.subscriptions));
  }

  isOver(): boolean {
    return currentTurn(this.state).phase === 'over';
  }

  outcome(): string | undefined {
    return currentTurn(this.state).outcome;
  }

  // ── a Payday ──

  /** A thin month is thinned out: the lines of life that can be ended are ended, the dearest first, until it is safe again. */
  trim(): void {
    for (let guard = 0; guard < 8; guard += 1) {
      const finances = this.finances();
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

  /** The installments of every plan are paid: the project they are for grows by them. */
  payInstallments(): void {
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
  checkDreams(): void {
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

  /** Money into the reserve (a lump sum). */
  fundReserve(putMinor: number): void {
    if (putMinor <= 0) return;
    this.add('Daily', -putMinor, '@Mojo');
    this.reserveMinor += putMinor;
  }

  /** Extra money for dreams: the life dream first, then the dreams taken from the Dream tiles. */
  fundDreams(money: number): void {
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

  /** Pays back some of the Bank loan (a multiple of its step); false when the rules refuse it. */
  repayBankLoan(repayMinor: number): boolean {
    if (repayMinor <= 0) return false;
    try {
      this.apply(playBankLoan(this.books, -repayMinor, this.deps));
      return true;
    } catch {
      return false; // the rules refuse it: it stays
    }
  }

  /** Pays off a debt of the character's in full; false when the rules refuse it. */
  repayDebt(tag: string): boolean {
    try {
      for (const effects of payOffLiability(this.books, this.profession, tag, this.deps)) {
        this.apply(effects);
      }
      return true;
    } catch {
      return false; // not allowed now: it stays
    }
  }

  // ── Emergency ──

  /** What an Emergency card's price is worked out in. */
  emergencyContext(): EmergencyContext {
    const level = difficultySettings(this.rules.difficulty);
    return {
      insurances: activeInsurances(this.state),
      traits: this.state.traits ?? [],
      openEmergencies: 0,
      priceFactor: (this.profession.priceFactor ?? 1) * level.emergencyCostMultiplier,
      deductibleCapMinor: level.insuranceDeductibleCapMinor,
    };
  }

  /** The card of an id (an Emergency card a table remembers). */
  emergencyCard(id: string): EmergencyCard | undefined {
    return (this.gameSet.decks?.emergency ?? []).find((card) => card.id === id);
  }

  /** Draws the next Emergency card: what it is and the context its price is worked out in; null when the set has none. */
  drawEmergency(): { card: EmergencyCard; context: EmergencyContext } | null {
    const cards = this.gameSet.decks?.emergency ?? [];
    if (cards.length === 0) return null;
    const draw = drawEmergencyCard(
      cards,
      this.state.emergencyDeck ?? emptyEmergencyDeck(),
      this.state.possessions ?? [],
      this.rng,
    );
    this.setState({ ...this.state, emergencyDeck: draw.deck });
    const context = this.emergencyContext();
    this.log(`E ${draw.card.id}`);
    return { card: draw.card, context };
  }

  /**
   * The choices and the dice of a card settled the cheapest way (a player who is not asked: a bot, a player who ran out of time):
   * the choice that costs least, the dice rolled. Returns what is to be paid.
   */
  autoEmergencySelection(
    card: EmergencyCard,
    context: EmergencyContext,
    choiceId?: string,
  ): number | null {
    let selection: EmergencySelection = { rolls: {} };
    for (let guard = 0; guard < 10; guard += 1) {
      const quote = quoteEmergency(card, selection, context);
      if (quote.needsChoice && choiceId) {
        selection = { ...selection, choiceId };
        continue;
      }
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
      return quote.payMinor;
    }
    return null;
  }

  /** An emergency paid at once: from cash, from the reserve, the Bank loan covering the rest. */
  payEmergencyNow(payMinor: number): void {
    this.spend(payMinor, '@Emergency');
  }

  /** The Paydays an emergency may be spread over, and what each costs: the plan's surcharge is the difficulty's. */
  emergencyPlanOptions(payMinor: number): { months: number; total: number; per: number }[] {
    const surcharge = difficultySettings(this.rules.difficulty).planSurchargePercents;
    return [3, 6, 12].map((months, at) => {
      const total = Math.round(payMinor * (1 + surcharge[at] / 100));
      return { months, total, per: Math.ceil(total / months) };
    });
  }

  /** An emergency on a plan: a part is paid at every Payday. */
  planEmergency(id: string, option: { total: number; per: number }): void {
    this.plans.push({ kind: 'emergency', id, perMinor: option.per, leftMinor: option.total });
  }

  /** What is left of a month after the plans that already run. */
  planRoomMinor(): number {
    return Math.max(
      0,
      this.finances().monthlyCashflowMinor -
        this.plans.reduce((sum, plan) => sum + plan.perMinor, 0),
    );
  }

  // ── Life ──

  drawLife(): LifeCard | null {
    const cards = this.gameSet.decks?.life ?? [];
    const life = this.state.life;
    if (cards.length === 0 || !life) return null;
    const draw = drawLifeCard(cards, this.state.lifeDeck ?? emptyEmergencyDeck(), life, this.rng);
    this.setState({ ...this.state, lifeDeck: draw.deck });
    this.log(`L ${draw.card.id}`);
    return draw.card;
  }

  /** The outcome of a decision on a Life card, applied. */
  resolveLife(card: LifeCard, decision: LifeDecision) {
    const cards = this.gameSet.decks?.life ?? [];
    const books = { state: this.state, subscriptions: this.books.subscriptions };
    const outcome = resolveLifeCard(card, decision, lifeContext(books, 'en', this.rng), (id) =>
      cards.find((c) => c.id === id),
    );
    this.apply(applyLifeOutcome(books, outcome, { date: TODAY, lang: 'en' }));
    this.payDues();
    return outcome;
  }

  /** The Life card of an id. */
  lifeCard(id: string): LifeCard | undefined {
    return (this.gameSet.decks?.life ?? []).find((card) => card.id === id);
  }

  /** The Dream card of an id. */
  dreamCard(id: string): DreamCard | undefined {
    return (this.gameSet.decks?.dream ?? []).find((card) => card.id === id);
  }

  /** The Opportunity card of an id (at this player's price level). */
  opportunityCard(id: string): OpportunityCard | undefined {
    return this.cards.find((card) => card.id === id);
  }

  /** What accepting a Life card would do: the monthly impact, what is to be paid now. */
  probeLife(card: LifeCard): { impact: number; payNow: number } {
    const cards = this.gameSet.decks?.life ?? [];
    const books = { state: this.state, subscriptions: this.books.subscriptions };
    const probe = resolveLifeCard(
      card,
      { kind: 'accept' },
      lifeContext(books, 'en', seededRng(1)),
      (id) => cards.find((c) => c.id === id),
    );
    return {
      impact: probe.lines.reduce((sum, line) => sum + line.amountMinor, 0),
      payNow: Math.max(0, -probe.oneTimeMinor),
    };
  }

  // ── Career ──

  /** The Career tile: the die is rolled; nothing is applied yet (a branch asks which way). */
  careerRoll(): CareerResult | null {
    const track = this.profession.career;
    const career = this.state.career;
    if (!track || !career) return null;
    const result = rollCareer(career, track, this.rng);
    this.log(`C ${result.kind}`);
    return result;
  }

  /** What a Career result brings, applied (a branch takes the path asked for). */
  careerApply(result: CareerResult, branch = 0): void {
    const track = this.profession.career;
    if (!track) return;
    const books = { state: this.state, subscriptions: this.books.subscriptions };
    if (result.kind === 'promoted' || result.kind === 'branch') {
      const stage = findStage(
        track,
        result.kind === 'promoted' ? result.to : (result.options[branch] ?? result.options[0]),
      );
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

  /** The Career tile at once: the die is rolled and what follows is applied (a branch takes its first path). */
  career(branch = 0): CareerResult | null {
    const result = this.careerRoll();
    if (result) this.careerApply(result, branch);
    return result;
  }

  // ── Dream ──

  dreamSettings(): DreamSettings {
    return {
      offersPerLanding: this.rules.dreamOffers,
      maxOpenDreams: this.rules.maxOpenDreams,
      lifeCanDecline: this.rules.lifeMayDecline,
    };
  }

  /** The Dream tile: a moment, or cards to choose from; null when the set has none. */
  drawDream(): { landing: ReturnType<typeof drawDreamLanding>; cards: DreamCard[] } | null {
    const cards = this.gameSet.decks?.dream ?? [];
    if (cards.length === 0) return null;
    const log: DreamLog = this.state.dreams ?? EMPTY_DREAM_LOG;
    const landing = drawDreamLanding(
      cards,
      DREAM_MOMENTS,
      this.state.dreamDeck ?? emptyEmergencyDeck(),
      { log, life: this.state.life, settings: this.dreamSettings() },
      this.rng,
    );
    this.setState({ ...this.state, dreamDeck: landing.deck });
    if (landing.kind === 'moment') this.log(`D ${landing.moment.id}`);
    return { landing, cards };
  }

  canTakeDream(): boolean {
    return canTakeDream(this.state.dreams ?? EMPTY_DREAM_LOG, this.dreamSettings());
  }

  /** A dream card taken: its Smile project opens. */
  takeDream(pick: DreamCard): void {
    const log: DreamLog = this.state.dreams ?? EMPTY_DREAM_LOG;
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

  /** What a dream moment does, for the dreams the player has open (the life dream is left as it is); `choose` picks of three offered dreams. */
  moment(
    id: string,
    cards: readonly DreamCard[],
    choose: (offers: DreamCard[], openCount: number) => DreamCard | null | undefined,
  ): void {
    const settings = this.dreamSettings();
    const log: DreamLog = this.state.dreams ?? EMPTY_DREAM_LOG;
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
        const pick = choose(landing.offers, log.open.length);
        if (pick && canTakeDream(log, settings)) this.takeDream(pick);
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

  // ── Opportunity ──

  opportunitySettings(): OpportunitySettings {
    return {
      offersPerLanding: this.rules.opportunityOffers,
      maxSideHustles: this.rules.maxSideHustles,
      savingsCardCopies: this.rules.savingsCardCopies,
    };
  }

  opportunityContext(): OpportunityContext {
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

  /** The cards of a pile that are offered on this landing. */
  drawOpportunity(pile: Parameters<typeof drawOpportunityOffers>[2]): OpportunityCard[] {
    const draw = drawOpportunityOffers(
      this.cards,
      this.state.opportunityDeck,
      pile,
      this.opportunitySettings(),
      this.opportunityContext(),
      this.rng,
    );
    this.setState({ ...this.state, opportunityDeck: draw.deck });
    return draw.offers;
  }

  /** What taking a card costs and whether it can be taken (a side hustle may need another to be given up). */
  quoteOpportunity(card: OpportunityCard, choice: OpportunityChoice) {
    return quoteOpportunity(
      card,
      choice,
      this.opportunityContext(),
      this.opportunitySettings(),
      this.cards,
    );
  }

  /** A card taken: paid and in the books. The quote has to be `ok`. */
  buyOpportunity(card: OpportunityCard, choice: OpportunityChoice, costMinor: number): string[] {
    const context = this.opportunityContext();
    this.spend(costMinor, `@${card.title.en}`);
    const purchase = buyOpportunity(
      this.books,
      card,
      choice,
      rollsFor(card, this.rng, this.rules.difficulty),
      {
        date: TODAY,
        lang: 'en',
        context,
        cards: this.cards,
        difficulty: this.rules.difficulty,
      },
    );
    this.apply(purchase.effects);
    this.payDues();
    this.log(`O ${card.id}`);
    return purchase.told;
  }

  // ── Harvest ──

  /** What the harvest functions need to know. */
  harvestContext() {
    return {
      cards: this.cards,
      lang: 'en' as const,
      date: TODAY,
      rng: this.rng,
      difficulty: this.rules.difficulty,
    };
  }

  /** The Harvest tile: a card is drawn and played; what the player may still do about it (sell in the window, a buyer, a hype) is told. */
  playHarvest(): { card: HarvestCard; pending: Pending } {
    const draw = drawHarvestCard(this.harvestCards, this.state.harvestDeck, this.rng);
    this.setState({ ...this.state, harvestDeck: draw.deck });
    return { card: draw.card, pending: this.applyHarvest(draw.card) };
  }

  /** A Harvest card that was drawn (by this player, or by another at a table) played on this player's books. */
  applyHarvest(card: HarvestCard): Pending {
    this.log(`H ${card.id}`);
    const played = playHarvestCard(this.books, card, this.harvestContext());
    this.apply(played.effects);
    this.payDues();
    return played.pending;
  }

  /** The holdings that may be sold now into a Harvest card's window (the titles). */
  harvestSellable(pending: Pending): string[] {
    const titles: string[] = [];
    for (const holding of this.state.holdings ?? []) {
      if (holding.ended || !holding.marketTag) continue;
      const open =
        pending.window === 'ALL' ||
        (Array.isArray(pending.window) && pending.window.includes(holding.marketTag));
      if (!open) continue;
      const card = this.cards.find((candidate) => candidate.id === holding.cardId);
      if (!card || (!card.share && holding.assetBaseMinor === undefined)) continue;
      titles.push(holding.title);
    }
    return titles;
  }

  /** A holding sold at today's price of its market. */
  sellAtMarket(title: string): boolean {
    const holding = (this.state.holdings ?? []).find((h) => h.title === title && !h.ended);
    const card = holding ? this.cards.find((c) => c.id === holding.cardId) : undefined;
    if (!holding || !card) return false;
    const gross = card.share
      ? unitPriceNow(card, holding, this.state) * (holding.units ?? 0)
      : valueOf(card, holding, this.state);
    this.apply(
      sellHolding(
        this.books,
        title,
        { grossMinor: gross, costsMinor: 0, owedMinor: 0 },
        this.harvestContext(),
      ),
    );
    return true;
  }

  /** A buyer's offer accepted. */
  acceptSale(sale: {
    holding: string;
    grossMinor: number;
    costsMinor: number;
    owedMinor: number;
  }): boolean {
    const live = (this.state.holdings ?? []).some((h) => h.title === sale.holding && !h.ended);
    if (!live) return false;
    this.apply(sellHolding(this.books, sale.holding, sale, this.harvestContext()));
    this.payDues();
    return true;
  }

  /** One more step up the hype ladder (the offer after the roll). */
  rideLadderOffer(offer: HarvestLadderOffer): HarvestLadderOffer {
    return rideLadder(offer, this.rng).offer;
  }

  /** The hype cashed out at what the ladder is worth now. */
  cashLadderOffer(offer: HarvestLadderOffer): boolean {
    const live = (this.state.holdings ?? []).some((h) => h.title === offer.holding && !h.ended);
    if (!live) return false;
    this.apply(
      sellHolding(
        this.books,
        offer.holding,
        { grossMinor: ladderPayout(offer), costsMinor: 0, owedMinor: 0 },
        this.harvestContext(),
      ),
    );
    return true;
  }

  // ── selling and trading what the player owns ──

  /** A holding that can be sold (not a saving or a scam): the holding, its card and what a standing sale brings. */
  sellable(title: string) {
    const holding = (this.state.holdings ?? []).find((h) => h.title === title && !h.ended);
    const card = holding ? this.cards.find((c) => c.id === holding.cardId) : undefined;
    if (!holding || !card) return null;
    const standing = standingSale(card, holding, this.state);
    return standing ? { holding, card, standing } : null;
  }

  /** The way out that is always there: a holding sold at the market price less the standing discount. False when nobody buys it. */
  sellAtStanding(title: string): boolean {
    const found = this.sellable(title);
    if (!found) return false;
    return this.sellFor(title, found.standing.grossMinor);
  }

  /** A holding handed to another player at the price agreed: what is owed on it is paid off from the price. False when it cannot be sold. */
  sellForTrade(title: string, priceMinor: number): boolean {
    return this.sellFor(title, priceMinor);
  }

  private sellFor(title: string, grossMinor: number): boolean {
    const found = this.sellable(title);
    if (!found) return false;
    const { standing } = found;
    this.apply(
      sellHolding(
        this.books,
        title,
        {
          grossMinor,
          costsMinor: 0,
          owedMinor: standing.owedMinor,
          ...(standing.units !== undefined ? { units: standing.units } : {}),
        },
        this.harvestContext(),
      ),
    );
    this.payDues();
    return true;
  }
}
