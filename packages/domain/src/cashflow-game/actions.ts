import { applyEffectsToBooks, type GameBooks } from './books';
import { dealPlanText, doodadPaymentCategory, doodadPaymentTitle } from './card-plan-text';
import type { CardTextDeps, CardTextSource } from './card-plan-text';
import { drawRandomCard } from './cards';
import { pickCashflowProfession } from './engine';
import { textOrFallback } from './game-text';
import { gameSubscriptionDays, nextSmartDate } from './scheduling';
import { dealInputFromCard, executeDeal, planDeal, takenDealLabels, type DealDeps } from './deals';
import { openDecisions, resolveGamble, whyDiceFirst } from './asset-deals';
import { emptyEffects, type GameEffects } from './effects';
import { MARKET_COST_ACCOUNT, doodadAccount, payCardExpense } from './expenses';
import {
  buyerCardTypes,
  businessCardLabels,
  costCardProperty,
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
import {
  normalizeRules,
  offerIsOpen,
  whyCannotBuyCard,
  whyCardAlreadyBought,
  whyCardAlreadyPlayed,
  whyCannotDraw,
  whyCannotUseCard,
  whyPaymentPending,
  type GameRules,
} from './rules';
import type {
  CashflowDealCard,
  CashflowDeckKind,
  CashflowDoodadCard,
  CashflowGameSet,
  CashflowMarketCard,
  CashflowMarketOffer,
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
  const refused = whyDiceFirst(books.state) ?? whyCannotDraw(books.state);
  if (refused) throw new Error(refused);
  const drawn = drawRandomCard(
    findDeck(books.gameSet, deck) as { id: string }[],
    books.state.drawnCardIds[deck],
    deps.rng,
  );
  const drawnState = {
    ...books.state,
    drawnCardIds: { ...books.state.drawnCardIds, [deck]: drawn.drawnIds },
  };
  // The drawn card is the card in hand on this space (under 'offered-once' the only one that can be played).
  const state =
    books.state.mode === 'solo' && drawnState.turn?.pending
      ? {
          ...drawnState,
          turn: {
            ...drawnState.turn,
            pending: {
              ...drawnState.turn.pending,
              offered: {
                deck,
                cardId: drawn.card.id,
                title:
                  (drawn.card as { symbol?: string; title?: string }).symbol ??
                  (drawn.card as { title?: string }).title,
              },
            },
          },
        }
      : drawnState;
  // A Market cost card for a player who owns a property is a payment that has to be made (the Doodad rule applies to it).
  const dueCard = drawn.card as unknown as CashflowMarketCard;
  const paymentDue =
    deck === 'market' &&
    !!dueCard.pays &&
    costCardProperty(
      books,
      propertyCardTypes((symbol) => deps.cards.symbolFor(symbol)),
    ) !== null;
  const stateWithPayment =
    paymentDue && state.turn?.pending
      ? { ...state, turn: { ...state.turn, pending: { ...state.turn.pending, paymentDue: true } } }
      : state;
  const described = describeCard(drawn.card, deps);
  return {
    effects: [
      emptyEffects(
        stateWithPayment,
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
  const refused =
    whyPaymentPending(books.state) ??
    whyDiceFirst(books.state) ??
    whyCannotUseCard(books.state, input.cardId) ??
    whyCannotBuyCard(books.state, input.cardId);
  if (refused) throw new Error(refused);
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

/** The open space's card is in play: `played`, and `title` names the Grow project it became (the Buy button looks for it). */
function withCardInPlay(
  effects: GameEffects,
  title: string,
  more: { purchased?: boolean } = {},
): GameEffects {
  const pending = effects.state.turn?.pending;
  if (!effects.state.turn || !pending) return effects;
  return {
    ...effects,
    state: {
      ...effects.state,
      turn: {
        ...effects.state.turn,
        pending: {
          ...pending,
          played: true,
          ...(more.purchased ? { purchased: true } : {}),
          ...(pending.offered ? { offered: { ...pending.offered, title } } : {}),
        },
      },
    },
  };
}

/**
 * "Plan this" of the solo game: the Deal card in hand becomes a planned Grow project and stays there to be looked at, edited
 * (the share count) and bought with Grow's own Buy. Nothing is paid yet and the card is not settled. A share already held takes
 * the card's price instead (the market moved), which does settle the card.
 */
export function planDealAction(
  books: GameBooks,
  input: { cardId: string },
  deps: ActionDeps,
): ActionPlan {
  const gameSet = books.gameSet;
  const cards: CashflowDealCard[] = [
    ...findDeck(gameSet, 'dealSmall'),
    ...(gameSet?.decks?.dealBig ?? []),
  ];
  const card = cards.find((candidate) => candidate.id === input.cardId);
  if (!card) throw new Error(`No Deal card with the id '${input.cardId}'.`);
  const refused =
    whyPaymentPending(books.state) ??
    whyDiceFirst(books.state) ??
    whyCardAlreadyPlayed(books.state, input.cardId) ??
    whyCannotUseCard(books.state, input.cardId) ??
    whyCannotBuyCard(books.state, input.cardId);
  if (refused) throw new Error(refused);
  const symbol = card.symbol ?? card.title;
  if (card.assetKind === 'share' && books.shares.some((s) => s.tag === symbol && s.quantity > 0)) {
    const priced = updateSharePrice(
      books,
      card,
      { description: deps.cards.textFor(card.id).description },
      deps,
    );
    return {
      effects: [withCardInPlay(priced.effects, priced.title)],
      settle: true,
      result: { card: describeCard(card, deps), title: priced.title, kind: 'priceUpdate' },
    };
  }
  const dealInput = dealInputFromCard(
    card,
    dealPlanText(card, textDeps(deps)),
    takenDealLabels(books),
  );
  const plan = withCardInPlay(planDeal(books, dealInput, deps), dealInput.title);
  return {
    effects: [plan],
    result: { card: describeCard(card, deps), title: dealInput.title, kind: 'planned' },
  };
}

/**
 * Grow's Buy for the project the card in hand became: shares (`quantity`), a property or a special asset. A card buys once;
 * the bank loan is taken first when cash is short. Settles the card.
 */
/**
 * The open stock price card for a share the player holds, or undefined (JFK, 2026-10-18). A drawn stock card sets the price for
 * everyone who holds the share: they may sell at it - and buy more at it - while the offer is open. The question is asked as if
 * the player were still deciding, because at a table the offer comes from somebody else's card and stays until their next roll.
 */
export function openPriceCardFor(
  books: Pick<GameBooks, 'state' | 'shares'>,
  title: string,
): CashflowMarketOffer | undefined {
  const state = books.state;
  const turn = state.turn;
  const asking =
    turn?.phase === 'roll' ? { ...state, turn: { ...turn, phase: 'decide' as const } } : state;
  if (!books.shares.some((share) => share.tag === title && share.quantity > 0)) return undefined;
  return (state.marketOffers ?? []).find(
    (offer) =>
      offer.title === title && offer.pricePerShareMinor !== undefined && offerIsOpen(asking, offer),
  );
}

export function buyPlannedAction(
  books: GameBooks,
  input: { title: string; quantity?: number },
  deps: ActionDeps,
): ActionPlan {
  const pending = books.state.turn?.pending;
  const offered = pending?.offered;
  // More of a share the player holds, at the price of a stock card somebody drew: no plan, no card of their own is needed.
  if (!(offered && pending?.played && offered.title === input.title)) {
    const priceCard = openPriceCardFor(books, input.title);
    if (priceCard) {
      const waiting = whyPaymentPending(books.state);
      if (waiting) throw new Error(waiting);
      const executed = executeDeal(books, input.title, input.quantity, deps);
      return {
        effects: executed.steps,
        result: { title: input.title, kind: executed.kind, atPriceCard: priceCard.cardId },
      };
    }
  }
  const refused =
    whyPaymentPending(books.state) ??
    whyDiceFirst(books.state) ??
    whyCardAlreadyBought(books.state) ??
    (offered && pending?.played && offered.title === input.title
      ? null
      : 'Plan the card in hand first: only the project it became can be bought.');
  if (refused || !offered) throw new Error(refused ?? 'There is no card in hand.');
  const cards: CashflowDealCard[] = [
    ...(books.gameSet?.decks?.dealSmall ?? []),
    ...(books.gameSet?.decks?.dealBig ?? []),
  ];
  const card = cards.find((candidate) => candidate.id === offered.cardId);
  if (!card) throw new Error('The card in hand is not a Deal card.');
  const executed =
    card.assetKind === 'asset'
      ? buyAssetDeal(books, input.title, deps)
      : executeDeal(books, input.title, input.quantity, deps);
  const steps = executed.steps.map((step, index) =>
    index === executed.steps.length - 1
      ? withCardInPlay(step, input.title, { purchased: true })
      : step,
  );
  return {
    effects: steps,
    settle: true,
    result: { card: describeCard(card, deps), title: input.title, kind: executed.kind },
  };
}

/** "Done" of the solo game: the card in hand was dealt with (planned and looked at, or sold to a friend) - the space is settled. */
export function finishCardAction(books: GameBooks): ActionPlan {
  const pending = books.state.turn?.pending;
  if (!pending?.played)
    throw new Error('Play the card first: only a card that was played is ticked off.');
  return { effects: [], settle: true, result: { kind: 'finished' } };
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
  const refused = whyDiceFirst(books.state) ?? whyCannotUseCard(books.state, input.cardId);
  if (refused) throw new Error(refused);
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

/**
 * Pays the cost of a Market card the player drew (a sewer pipe, a roof): the same payment the solo game books through the Add
 * dialog - from Fire, on the first property, a Bank loan taken first when the cash is short. Only the card in hand, only once.
 */
export function payMarketCostAction(
  books: GameBooks,
  input: { cardId: string },
  deps: ActionDeps,
): ActionPlan {
  const card = (findDeck(books.gameSet, 'market') as CashflowMarketCard[]).find(
    (candidate) => candidate.id === input.cardId,
  );
  if (!card?.pays) throw new Error(`No Market card with a cost and the id '${input.cardId}'.`);
  const pending = books.state.turn?.pending;
  if (!pending || pending.offered?.cardId !== input.cardId || !pending.paymentDue) {
    throw new Error('There is no cost of this card waiting to be paid.');
  }
  const refused = whyDiceFirst(books.state);
  if (refused) throw new Error(refused);
  return marketCardPlan(books, card, deps);
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
  const refused =
    whyPaymentPending(books.state) ??
    whyDiceFirst(books.state) ??
    whyCannotUseCard(books.state, input.cardId);
  if (refused) throw new Error(refused);
  return marketCardPlan(books, card, deps);
}

/**
 * What a Market card does to one player's books, whatever the player's own turn is doing: offers for the properties they own,
 * a split to decide, a boost, a cost to pay - or nothing when it does not apply to them. `playMarketAction` checks the
 * player's own turn first; a table plays the same card over every player's books without those checks.
 */
export function marketCardPlan(
  books: GameBooks,
  card: CashflowMarketCard,
  deps: ActionDeps,
): ActionPlan {
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
  input: {
    gameSetId: string;
    professionId: string;
    mode?: 'companion' | 'solo';
    /** A preset name and/or single settings; see rules.ts. Absent: free, as before. */
    rules?: Partial<GameRules>;
  },
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
    input.rules ? normalizeRules(input.rules) : undefined,
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
