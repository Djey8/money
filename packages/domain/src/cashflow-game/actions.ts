import { applyEffectsToBooks, type GameBooks } from './books';
import { dealPlanText, doodadPaymentCategory, doodadPaymentTitle } from './card-plan-text';
import type { CardTextDeps, CardTextSource } from './card-plan-text';
import { drawRandomCard } from './cards';
import { pickCashflowProfession } from './engine';
import { textOrFallback } from './game-text';
import { gameSubscriptionDays, nextSmartDate } from './scheduling';
import { dealInputFromCard, executeDeal, planDeal, takenDealLabels, type DealDeps } from './deals';
import { openDecisions, resolveGamble } from './asset-deals';
import { emptyEffects, type GameEffects } from './effects';
import { MARKET_COST_ACCOUNT, doodadAccount, payCardExpense } from './expenses';
import {
  buyerCardTypes,
  businessCardLabels,
  marketCardKind,
  playBoostCard,
  playMarketBuyerCard,
  playMarketCostCard,
  playShareSplitCard,
  propertyCardTypes,
  updateSharePrice,
} from './market-cards';
import { buyAssetDeal, sellPosition, type SellInput } from './positions';
import { rollDie, type Rng } from './rng';
import { cardPickedStep, type GameStep } from './steps';
import type {
  CashflowDealCard,
  CashflowDeckKind,
  CashflowDoodadCard,
  CashflowGameSet,
  CashflowMarketCard,
} from './types';

/**
 * The card and trade moves of the game as pure rules (todo/cashflow-game-pro.md, D3 and the strategy lab): draw a card,
 * buy a Deal, pay a Doodad, play a Market card, roll for a waiting card, sell a position. Each takes the books and says
 * what to apply (`effects`, in order), whether the open card decision of a solo turn is dealt with (`settle`), and what
 * to tell the caller (`result`). The Pro API stores these effects in the account; the strategy lab applies them in
 * memory - one set of rules for both.
 */

/** The dependencies every move needs: the shared rule deps, the card texts of the game's language and the dice. */
export interface ActionDeps extends DealDeps {
  cards: CardTextSource;
  rng: Rng;
}

export interface ActionPlan {
  effects: GameEffects[];
  /** The card decision of a solo turn is dealt with by this move. */
  settle?: boolean;
  /** The one History step the effects share, when they carry none of their own. */
  step?: GameStep;
  result?: Record<string, unknown>;
}

const DECK_FOR_PENDING: Record<string, CashflowDeckKind[]> = {
  deal: ['dealSmall', 'dealBig'],
  market: ['market'],
  doodad: ['doodad'],
};

const textDeps = (deps: ActionDeps): CardTextDeps => ({
  text: deps.text,
  cards: deps.cards,
  money: deps.money,
});

/** A card as callers show it: its numbers, plus what it prints in the game's language. */
export function describeCard<T extends { id: string; symbol?: string }>(
  card: T,
  deps: Pick<ActionDeps, 'cards'>,
) {
  return {
    ...card,
    printed: deps.cards.textFor(card.id),
    label: deps.cards.symbolFor(card.symbol),
  };
}

function findDeck<K extends CashflowDeckKind>(gameSet: CashflowGameSet | undefined, kind: K) {
  const deck = gameSet?.decks?.[kind];
  if (!deck) throw new Error(`This game set has no ${kind} cards.`);
  return deck;
}

export function drawCardAction(
  books: GameBooks,
  input: { deck: CashflowDeckKind },
  deps: ActionDeps,
): ActionPlan {
  const { deck } = input;
  const pending = books.state.turn?.pending;
  if (books.state.mode === 'solo' && pending && !DECK_FOR_PENDING[pending.kind].includes(deck)) {
    throw new Error(
      `This space asks for a ${pending.kind} card: draw from ${DECK_FOR_PENDING[pending.kind].join(' or ')}.`,
    );
  }
  const drawn = drawRandomCard(
    findDeck(books.gameSet, deck) as { id: string }[],
    books.state.drawnCardIds[deck],
    deps.rng,
  );
  const state = {
    ...books.state,
    drawnCardIds: { ...books.state.drawnCardIds, [deck]: drawn.drawnIds },
  };
  const described = describeCard(drawn.card, deps);
  return {
    effects: [
      emptyEffects(
        state,
        cardPickedStep(deck, drawn.card as { id: string; title: string }, described.label),
      ),
    ],
    result: { deck, reshuffled: drawn.reshuffled, card: described },
  };
}

/** Plans a Deal card as a Grow project and buys it - the app's two steps, so Undo takes them back one at a time. */
export function buyDealAction(
  books: GameBooks,
  input: { cardId: string; quantity?: number },
  deps: ActionDeps,
): ActionPlan {
  const gameSet = books.gameSet;
  const cards: CashflowDealCard[] = [
    ...findDeck(gameSet, 'dealSmall'),
    ...(gameSet?.decks?.dealBig ?? []),
  ];
  const card = cards.find((candidate) => candidate.id === input.cardId);
  if (!card) throw new Error(`No Deal card with the id '${input.cardId}'.`);
  const symbol = card.symbol ?? card.title;
  const holds = books.shares.some((share) => share.tag === symbol && share.quantity > 0);
  if (card.assetKind === 'share' && holds) {
    // The market moves the price of a share already held; planning it again would double the position.
    const priced = updateSharePrice(
      books,
      card,
      { description: deps.cards.textFor(card.id).description },
      deps,
    );
    return {
      effects: [priced.effects],
      settle: true,
      result: { card: describeCard(card, deps), title: priced.title, kind: 'priceUpdate' },
    };
  }
  const dealInput = dealInputFromCard(
    card,
    dealPlanText(card, textDeps(deps)),
    takenDealLabels(books),
  );
  const plan = planDeal(books, dealInput, deps);
  const planned = applyEffectsToBooks(books, plan);
  // A special-asset card (gold, the loan to a relative, MLM) is bought as an asset; a dice card then waits for its roll.
  const executed =
    card.assetKind === 'asset'
      ? buyAssetDeal(planned, dealInput.title, deps)
      : executeDeal(planned, dealInput.title, input.quantity, deps);
  return {
    effects: [plan, ...executed.steps],
    settle: true,
    result: { card: describeCard(card, deps), title: dealInput.title, kind: executed.kind },
  };
}

export function payDoodadAction(
  books: GameBooks,
  input: { cardId: string },
  deps: ActionDeps,
): ActionPlan {
  const card = (findDeck(books.gameSet, 'doodad') as CashflowDoodadCard[]).find(
    (candidate) => candidate.id === input.cardId,
  );
  if (!card) throw new Error(`No Doodad card with the id '${input.cardId}'.`);
  const text = textDeps(deps);
  const effects = payCardExpense(
    books,
    {
      kind: 'doodad',
      title: doodadPaymentTitle(card, text),
      flavor: deps.cards.textFor(card.id).comment,
      category: doodadPaymentCategory(card, text),
      costMinor: card.costMinor,
      account: doodadAccount(card),
    },
    deps,
  );
  return {
    effects,
    settle: true,
    result: { card: describeCard(card, deps), costMinor: card.costMinor },
  };
}

/** A Market card's heading in the game's language (a star card is the jackpot of the pile). */
function marketHeading(card: CashflowMarketCard, deps: ActionDeps): string {
  const name = deps.cards.textFor(card.id).title ?? card.title;
  return card.star ? `${name} ★` : name;
}

/** Plays a Market card the way its kind asks; a card that does not apply to the player is still played (a History step). */
export function playMarketAction(
  books: GameBooks,
  input: { cardId: string },
  deps: ActionDeps,
): ActionPlan {
  const card = (findDeck(books.gameSet, 'market') as CashflowMarketCard[]).find(
    (candidate) => candidate.id === input.cardId,
  );
  if (!card) throw new Error(`No Market card with the id '${input.cardId}'.`);
  const title = marketHeading(card, deps);
  const label = (symbol: string) => deps.cards.symbolFor(symbol);
  const kind = marketCardKind(card);
  const described = describeCard(card, deps);
  switch (kind) {
    case 'buyer':
    case 'gold': {
      const played = playMarketBuyerCard(
        books,
        card,
        { title, types: buyerCardTypes(card, label) },
        deps,
      );
      return {
        effects: [played.effects],
        settle: true,
        result: { card: described, kind, matched: played.matched },
      };
    }
    case 'split': {
      const played = playShareSplitCard(
        books,
        card,
        { title, labels: [card.splits!.symbol] },
        deps,
      );
      return {
        effects: [played.effects],
        settle: true,
        result: {
          card: described,
          kind,
          share: played.share ?? null,
          decisionOpen: played.effects.decisionNeeded,
        },
      };
    }
    case 'boost': {
      const played = playBoostCard(
        books,
        card,
        {
          title,
          businessLabels: card.boost?.onlyBusinesses ? businessCardLabels(label) : undefined,
        },
        deps,
      );
      return {
        effects: [played.effects],
        settle: true,
        result: { card: described, kind, changed: played.changed },
      };
    }
    case 'cost': {
      const played = playMarketCostCard(books, card, { title, types: propertyCardTypes(label) });
      if (!played.property) {
        return {
          effects: [played.effects],
          settle: true,
          result: { card: described, kind, property: null },
        };
      }
      const flavor = (deps.cards.textFor(card.id).comment ?? '')
        .split('{property}')
        .join(played.property);
      const effects = payCardExpense(
        books,
        {
          kind: 'marketCost',
          title,
          flavor,
          category: played.property,
          costMinor: card.pays!.costMinor,
          account: MARKET_COST_ACCOUNT,
        },
        deps,
      );
      return {
        effects,
        settle: true,
        result: {
          card: described,
          kind,
          property: played.property,
          costMinor: card.pays!.costMinor,
        },
      };
    }
    default:
      return { effects: [], settle: true, result: { card: described, kind } };
  }
}

/** Rolls the die for a waiting card: a stock split doubles on 1-3, every other card wins on a high roll. */
export function rollDecisionAction(
  books: GameBooks,
  input: { title?: string },
  deps: ActionDeps,
): ActionPlan {
  const waiting = openDecisions(books.state);
  const deal = input.title
    ? waiting.find((candidate) => candidate.title === input.title)
    : waiting[0];
  if (!deal) throw new Error('There is no dice decision waiting.');
  const roll = rollDie(deps.rng);
  const won = deal.split ? roll <= 3 : roll >= (deal.successOn ?? 6);
  const settled = resolveGamble(books, deal.title, { won, roll }, deps);
  return {
    effects: [settled.effects],
    result: { title: deal.title, kind: settled.kind, roll, won },
  };
}

/** Sells a position the player holds: shares, a property to a market buyer, gold by the coin. */
export function sellPositionAction(
  books: GameBooks,
  input: SellInput,
  deps: ActionDeps,
): ActionPlan {
  const sold = sellPosition(books, input, deps);
  return {
    effects: sold.steps,
    result: { title: input.title, kind: sold.kind, cashMinor: sold.cashMinor },
  };
}

/**
 * The starting position of a game: the savings booked, the profession's subscriptions and starting positions created in
 * the game's language, a solo game's token at START. A new game has a new history - the caller drops the old one.
 */
export function startGameAction(
  books: GameBooks,
  input: { gameSetId: string; professionId: string; mode?: 'companion' | 'solo' },
  deps: Pick<ActionDeps, 'clock' | 'text'>,
  gameSets: CashflowGameSet[],
): ActionPlan {
  const { gameSetId, professionId, mode = 'companion' } = input;
  const result = pickCashflowProfession(
    gameSets,
    gameSetId,
    professionId,
    deps.clock.todayIso(),
    mode,
  );
  const { text } = deps;
  const { profession } = result;
  const professionTitle = textOrFallback(
    text,
    `CashflowGame.profession.${profession.id}.title`,
    profession.title,
  );
  const salaryWord = text('CashflowGame.salary');
  const savingsWord = text('CashflowGame.savings');
  const lineTitle = (line: { key?: string; title: string }) =>
    line.key
      ? textOrFallback(text, `CashflowGame.expenseLine.${line.key}`, line.title)
      : line.title;
  // result.subscriptions is [salary, ...the non-zero expense lines], in that order.
  const nonZeroExpenses = profession.expenses.filter((line) => line.amountMinor !== 0);
  const titles = result.subscriptions.map((_sub, index) =>
    index === 0
      ? text('CashflowGame.salarySubscriptionTitle', { profession: professionTitle })
      : lineTitle(nonZeroExpenses[index - 1]),
  );

  const usedDays = gameSubscriptionDays(books.subscriptions);
  const kit = result.starterKit;
  const effects = emptyEffects(
    { ...result.state, gameSubscriptionTitles: titles },
    { kind: 'start', detail: professionTitle },
  );
  effects.appendedTransactions = result.startingTransactions.map((record) => ({
    ...record,
    category: `@${savingsWord}`,
    comment: `${text('CashflowGame.savingsTransactionComment', { profession: professionTitle })}\n#cashflow`,
  }));
  effects.subscriptionUpserts = result.subscriptions.map((sub, index) => ({
    title: titles[index],
    account: sub.account,
    amountMinor: sub.amountMinor,
    startDate: nextSmartDate(usedDays, deps.clock.todayIso()),
    endDate: '',
    category: index === 0 ? `@${salaryWord}` : `@${titles[index]}`,
    comment: sub.comment ? `${sub.comment}\n#cashflow` : '#cashflow',
    frequency: sub.frequency,
  }));
  effects.assetUpserts = (kit.assets ?? []).map((asset) => ({
    tag: asset.tag,
    amountMinor: asset.amountMinor,
  }));
  effects.investmentUpserts = (kit.investments ?? []).map((investment) => ({
    tag: investment.tag,
    depositMinor: investment.depositMinor,
    amountMinor: investment.amountMinor,
  }));
  effects.shareUpserts = (kit.shares ?? []).map((share) => ({ ...share }));
  effects.liabilityUpserts = (kit.liabilities ?? []).map((liability) => ({
    tag: liability.key
      ? textOrFallback(text, `CashflowGame.liabilityTag.${liability.key}`, liability.tag)
      : liability.tag,
    amountMinor: liability.amountMinor,
    investment: false,
  }));
  return { effects: [effects] };
}
