import { applyEffectsToBooks, type GameBooks } from '../books';
import {
  buyDealAction,
  drawCardAction,
  payDoodadAction,
  playMarketAction,
  rollDecisionAction,
  sellPositionAction,
  startGameAction,
  type ActionDeps,
  type ActionPlan,
} from '../actions';
import { cashOnHandMinor } from '../cash';
import { fixedClock } from '../clock';
import { emptyEffects } from '../effects';
import { endIfOver } from '../game-end';
import { identityText } from '../game-text';
import { playBankLoan } from '../loan';
import { openDecisions } from '../asset-deals';
import { CLASSIC_RAT_RACE_BOARD } from '../board';
import { seededRng, type Rng } from '../rng';
import { summarizeGameFinances } from '../saved-games';
import { currentTurn, playTurn, settleDecision } from '../turn';
import {
  initialCashflowGameState,
  type CashflowDealCard,
  type CashflowGameSet,
  type CashflowProfession,
} from '../types';
import type { Policy, PolicyView } from './policy';

/**
 * One whole solo game played in memory (todo/cashflow-game-analysis.md, E1): the same rules the app and the Pro API run
 * (`playTurn`, `buyDealAction`, `sellPositionAction`...), decided by a `Policy`, from a seed. No database, no clock, no
 * text catalogs - so thousands of games take seconds, and the same seed always plays the same game.
 */

export interface SimConfig {
  gameSets: CashflowGameSet[];
  gameSetId: string;
  professionId: string;
  policy: Policy;
  seed: number;
  /** A game that has not ended after this many rolls is called a timeout. */
  maxTurns?: number;
  /** Keep every decision in `record.decisions` (the game analyst reads it). */
  keepDecisions?: boolean;
  /** Continue a game that is already running (a position to evaluate) instead of starting one. */
  from?: GameBooks;
}

export interface Purchase {
  turn: number;
  round: number;
  title: string;
  kind: string;
  /** What it cost out of pocket or loan, in minor units. */
  costMinor: number;
  cashflowMinor: number;
}

export interface Decision {
  turn: number;
  round: number;
  kind: 'buy' | 'pass' | 'doodad' | 'market' | 'sell' | 'repay';
  detail: string;
  /** The card the decision was about (a Deal bought or passed, a Doodad paid, a Market card played). */
  cardId?: string;
  cashMinor: number;
}

export type SimOutcome = 'escaped' | 'bankrupt' | 'timeout';

export interface GameRecord {
  seed: number;
  professionId: string;
  policyId: string;
  outcome: SimOutcome;
  /** Rolls played. */
  turns: number;
  /** Paydays - the months of the game. */
  rounds: number;
  children: number;
  salaryMinor: number;
  passiveIncomeMinor: number;
  expensesMinor: number;
  monthlyCashflowMinor: number;
  cashMinor: number;
  /** The most passive income held at any moment of the game. */
  peakPassiveIncomeMinor: number;
  lowestCashMinor: number;
  peakBankLoanMinor: number;
  purchases: Purchase[];
  sales: number;
  /** How many of each kind of space the token landed on. */
  landings: Record<string, number>;
  decisions?: Decision[];
}

const TODAY = '2026-10-15';
const NOW = '2026-10-15T09:00:00.000Z';

const noCardText = {
  textFor: () => ({}),
  symbolFor: (symbol: string | undefined) => symbol,
  sharedText: () => '',
  groupName: (group: string) => group,
};

export class SimGame {
  books: GameBooks;
  readonly rng: Rng;
  private readonly deps: ActionDeps;
  private readonly profession: CashflowProfession;
  private readonly record: GameRecord;
  private readonly decisions: Decision[] | undefined;
  private turns: number;

  constructor(private readonly config: SimConfig) {
    this.rng = seededRng(config.seed);
    const gameSet = config.gameSets.find((candidate) => candidate.id === config.gameSetId);
    const profession = gameSet?.professions.find(
      (candidate) => candidate.id === config.professionId,
    );
    if (!gameSet || !profession) {
      throw new Error(`Unknown game set or profession: ${config.gameSetId}/${config.professionId}`);
    }
    this.profession = profession;
    this.deps = {
      clock: fixedClock(TODAY, NOW),
      text: identityText,
      money: (minor) => `${minor / 100}`,
      plainMoney: (minor) => `${minor / 100}`,
      cards: noCardText,
      rng: this.rng,
    };
    const blank: GameBooks = {
      state: initialCashflowGameState(),
      allocation: { daily: 60, splurge: 10, smile: 10, fire: 20 },
      gameSet,
      subscriptions: [],
      transactions: [],
      liabilities: [],
      shares: [],
      investments: [],
      assets: [],
      growProjects: [],
    };
    this.books = config.from ?? blank;
    if (!config.from) {
      this.apply(
        startGameAction(
          blank,
          { gameSetId: config.gameSetId, professionId: config.professionId, mode: 'solo' },
          this.deps,
          config.gameSets,
        ),
      );
    }
    this.turns = currentTurn(this.books.state).count;
    this.decisions = config.keepDecisions ? [] : undefined;
    this.record = {
      seed: config.seed,
      professionId: config.professionId,
      policyId: config.policy.id,
      outcome: 'timeout',
      turns: 0,
      rounds: 0,
      children: 0,
      salaryMinor: 0,
      passiveIncomeMinor: 0,
      expensesMinor: 0,
      monthlyCashflowMinor: 0,
      cashMinor: 0,
      peakPassiveIncomeMinor: 0,
      lowestCashMinor: this.cashMinor(),
      peakBankLoanMinor: 0,
      purchases: [],
      sales: 0,
      landings: {},
    };
  }

  cashMinor(): number {
    return cashOnHandMinor(this.books.transactions, this.books.allocation);
  }

  get phase(): string {
    return currentTurn(this.books.state).phase;
  }

  view(): PolicyView {
    const { books } = this;
    const finances = summarizeGameFinances(books.state, books.subscriptions);
    const rule = books.gameSet?.loanRule;
    return {
      books,
      cashMinor: this.cashMinor(),
      finances,
      bankLoanMinor: books.liabilities.find((l) => l.tag === 'Bank loan')?.amountMinor ?? 0,
      loanStepMinor: rule?.incrementMinor ?? 0,
      loanInterestPercent: rule?.monthlyInterestPercent ?? 0,
      round: books.state.round,
      turn: this.turns,
      children: books.state.children,
      charityRoundsLeft: books.state.charityRoundsLeft,
    };
  }

  /** Applies a move's effects in order; a solo card decision is closed when the move dealt with it. */
  private apply(plan: ActionPlan): void {
    let books = this.books;
    for (const effects of plan.effects) books = applyEffectsToBooks(books, effects);
    if (plan.settle && currentTurn(books.state).phase === 'decide') {
      books = {
        ...books,
        state: settleDecision(books.state, 'done', books.subscriptions).state,
      };
    }
    books = { ...books, state: endIfOver(books.state, books.subscriptions) };
    this.books = books;
  }

  private note(kind: Decision['kind'], detail: string, cardId?: string): void {
    this.decisions?.push({
      turn: this.turns,
      round: this.books.state.round,
      kind,
      detail,
      ...(cardId ? { cardId } : {}),
      cashMinor: this.cashMinor(),
    });
  }

  /** Whatever the strategy does between rolls: sell to a buyer, pay the bank back. */
  private maintain(): void {
    for (let pass = 0; pass < 6 && this.phase !== 'over'; pass += 1) {
      const moves = this.config.policy.maintain(this.view());
      if (moves.length === 0) return;
      let did = false;
      for (const move of moves) {
        try {
          if (move.kind === 'sell') {
            this.apply(sellPositionAction(this.books, move.input, this.deps));
            this.record.sales += 1;
            this.note('sell', move.input.title);
          } else {
            const loan = playBankLoan(this.books, -move.amountMinor, this.deps);
            this.apply({ effects: [loan] });
            this.note('repay', `${move.amountMinor / 100}`);
          }
          did = true;
        } catch {
          // a move the rules refuse (no buyer, nothing to repay) is simply not made
        }
      }
      if (!did) return;
    }
  }

  private settleOpenCard(): void {
    const settled = settleDecision(this.books.state, 'passed', this.books.subscriptions);
    this.apply({ effects: [emptyEffects(settled.state, settled.step)] });
  }

  private rollWaitingDice(): void {
    for (let guard = 0; guard < 8 && openDecisions(this.books.state).length > 0; guard += 1) {
      this.apply(rollDecisionAction(this.books, {}, this.deps));
    }
  }

  private buyCard(card: CashflowDealCard, quantity: number | undefined): void {
    const before = this.books;
    const plan = buyDealAction(before, { cardId: card.id, quantity }, this.deps);
    this.apply(plan);
    const result = plan.result as { title?: string; kind?: string } | undefined;
    if (result?.kind && result.kind !== 'priceUpdate') {
      this.record.purchases.push({
        turn: this.turns,
        round: this.books.state.round,
        title: result.title ?? card.title,
        kind: result.kind,
        costMinor: card.depositMinor ?? card.costMinor ?? (card.priceMinor ?? 0) * (quantity ?? 0),
        cashflowMinor: card.cashflowMinor ?? 0,
      });
      this.note('buy', result.title ?? card.title, card.id);
    }
  }

  private playDealSpace(): void {
    const pile = this.config.policy.pile(this.view(), this.rng);
    const drawn = drawCardAction(this.books, { deck: pile }, this.deps);
    this.apply(drawn);
    const card = (drawn.result as { card: CashflowDealCard }).card;
    const choice = this.config.policy.deal(this.view(), card);
    if (choice.buy) {
      try {
        this.buyCard(card, choice.quantity);
        return;
      } catch {
        // the rules refused the purchase (nothing to pay it with): it is passed
      }
    }
    this.note('pass', card.title, card.id);
    this.settleOpenCard();
  }

  private playDoodadSpace(): void {
    const drawn = drawCardAction(this.books, { deck: 'doodad' }, this.deps);
    this.apply(drawn);
    const card = (drawn.result as { card: { id: string; title: string } }).card;
    this.apply(payDoodadAction(this.books, { cardId: card.id }, this.deps));
    this.note('doodad', card.title, card.id);
  }

  private playMarketSpace(): void {
    const drawn = drawCardAction(this.books, { deck: 'market' }, this.deps);
    this.apply(drawn);
    const card = (drawn.result as { card: { id: string; title: string } }).card;
    this.apply(playMarketAction(this.books, { cardId: card.id }, this.deps));
    this.note('market', card.title, card.id);
  }

  private track(): void {
    const finances = summarizeGameFinances(this.books.state, this.books.subscriptions);
    const cash = this.cashMinor();
    const loan = this.books.liabilities.find((l) => l.tag === 'Bank loan')?.amountMinor ?? 0;
    this.record.peakPassiveIncomeMinor = Math.max(
      this.record.peakPassiveIncomeMinor,
      finances.passiveIncomeMinor,
    );
    this.record.lowestCashMinor = Math.min(this.record.lowestCashMinor, cash);
    this.record.peakBankLoanMinor = Math.max(this.record.peakBankLoanMinor, loan);
  }

  /** Plays one roll and everything it asks for. */
  playTurn(): void {
    this.maintain();
    if (this.phase === 'over') return;
    const dice = this.books.state.charityRoundsLeft > 0 ? this.config.policy.dice(this.view()) : 1;
    const turn = playTurn(
      this.books,
      { ...this.deps, board: CLASSIC_RAT_RACE_BOARD, profession: this.profession },
      { dice },
    );
    this.turns += 1;
    this.apply({ effects: turn.effects });
    const landed = turn.move.landed.kind;
    this.record.landings[landed] = (this.record.landings[landed] ?? 0) + 1;

    this.resolveSpace();
    this.rollWaitingDice();
    this.track();
  }

  /** The card space the token waits on: the strategy draws and decides, like on any landing. */
  private resolveSpace(): void {
    const pending = currentTurn(this.books.state).pending;
    if (pending?.kind === 'deal') this.playDealSpace();
    else if (pending?.kind === 'doodad') this.playDoodadSpace();
    else if (pending?.kind === 'market') this.playMarketSpace();
  }

  /** Plays the game out and returns what happened. */
  play(): GameRecord {
    const max = this.config.maxTurns ?? 400;
    // A position can begin on a card space nobody has dealt with yet ("what if the card had been looked at?")
    if (this.phase === 'decide') this.resolveSpace();
    // a dice decision left open by the position (a card just bought) is rolled first
    if (this.phase !== 'over') this.rollWaitingDice();
    while (this.turns < max && this.phase !== 'over') this.playTurn();
    return this.finish();
  }

  finish(): GameRecord {
    const { books } = this;
    const finances = summarizeGameFinances(books.state, books.subscriptions);
    const turn = currentTurn(books.state);
    const outcome: SimOutcome = turn.phase === 'over' ? (turn.outcome ?? 'bankrupt') : 'timeout';
    return {
      ...this.record,
      outcome,
      turns: this.turns,
      rounds: books.state.round,
      children: books.state.children,
      salaryMinor: finances.salaryMinor,
      passiveIncomeMinor: finances.passiveIncomeMinor,
      expensesMinor: finances.expensesMinor,
      monthlyCashflowMinor: finances.monthlyCashflowMinor,
      cashMinor: this.cashMinor(),
      ...(this.decisions ? { decisions: this.decisions } : {}),
    };
  }
}

/** Plays one whole game. */
export function simulateGame(config: SimConfig): GameRecord {
  return new SimGame(config).play();
}
