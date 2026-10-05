import {
  emptyEffects,
  type BookGrowUpdate,
  type BookSubscription,
  type GameEffects,
} from './effects';
import { MARKET_NOTE_MARK, upsertBookSubscription, type RoundDeps } from './rounds';
import { BUSINESS_SYMBOLS, PROPERTY_SYMBOLS } from './symbols';
import type { GameStep } from './steps';
import type {
  CashflowAssetDeal,
  CashflowDealCard,
  CashflowGameState,
  CashflowMarketCard,
  CashflowMarketOffer,
} from './types';

/**
 * The Market cards, as pure functions (todo/cashflow-game-pro.md slice A1(c)): a buyer's offer for a property or for
 * gold, a stock split, a cashflow boost, a one-off cost for a property owner, and a stock's new price.
 *
 * Same shape as the round rules: they read the **books** (in minor units) and return **effects**; nothing is
 * mutated and the clock, the language and the money format come from the caller. The labels a card's property
 * types go by (EFH in German, SFH in English) are resolved by the caller from the card-text catalog and passed in -
 * the rule only matches them against what the player owns.
 */

export interface BookInvestment {
  tag: string;
  depositMinor: number;
  amountMinor: number;
}

export interface BookShare {
  tag: string;
  quantity: number;
  priceMinor: number;
}

export interface BookAsset {
  tag: string;
  amountMinor: number;
}

/** What the card rules read of a Grow project. */
export interface BookGrowProject {
  title: string;
  notes: { text: string; createdAt: string }[];
  cashflowMinor: number;
  share?: { tag: string; priceMinor: number } | null;
}

export interface CardBooks {
  state: CashflowGameState;
  subscriptions: BookSubscription[];
  investments: BookInvestment[];
  shares: BookShare[];
  assets: BookAsset[];
  growProjects: BookGrowProject[];
}

/** The round rules' dependencies plus how this game formats an amount ("4.000 €"). */
export interface CardDeps extends RoundDeps {
  money: (amountMinor: number) => string;
}

/** What a Market-card rule changes: the shared description every game rule returns. */
export type CardEffects = GameEffects;

/** One kind of property or asset a card is about: the labels it goes by, and for a building the unit count. */
export interface CardType {
  labels: string[];
  units?: number;
}

const effects = emptyEffects;

function requireStarted(state: CashflowGameState): void {
  if (!state.virtualDate) throw new Error('Pick a profession first.');
}

/** A property / asset label matches a type's label when it is that label or a copy of it (EFH, EFH-II, EFH-III...). */
export function labelMatches(tag: string, label: string): boolean {
  const lower = tag.toLowerCase();
  const wanted = label.toLowerCase();
  const escaped = wanted.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return lower === wanted || new RegExp(`^${escaped}-[ivxlcdm]+$`).test(lower);
}

const matchesType = (tag: string, type: CardType) =>
  type.labels.some((label) => labelMatches(tag, label));

/** How many coins of a special asset (gold) are still owned - 0 for any other asset. */
export function coinsOwnedOf(state: CashflowGameState, title: string): number {
  return (
    (state.assetDeals ?? []).find((deal) => deal.title === title && deal.stage === 'owned')
      ?.coins ?? 0
  );
}

// ── Which kind of Market card is this, and which types does it name ─────────────────────────────

export type MarketCardKind = 'buyer' | 'gold' | 'split' | 'boost' | 'cost' | 'text';

/** What playing a Market card does, from the fields it carries. Cards with none are shown as text only. */
export function marketCardKind(card: CashflowMarketCard): MarketCardKind {
  if (card.sells) return card.sells.pricePerCoinMinor !== undefined ? 'gold' : 'buyer';
  if (card.splits) return 'split';
  if (card.boost) return 'boost';
  if (card.pays) return 'cost';
  return 'text';
}

/** A symbol's label in the game's language (from the card-text catalog), or the symbol itself. */
export type SymbolLabel = (symbol: string) => string | undefined;

/**
 * The property or asset types a buyer card names, with the labels each goes by in the game's language. A trailing
 * number in the symbol is the unit count (APH24 = 24 units), which a per-unit price multiplies.
 */
export function buyerCardTypes(card: CashflowMarketCard, labelFor: SymbolLabel): CardType[] {
  const symbols = card.sells?.symbols ?? (card.sells ? [card.sells.family] : []);
  return symbols.map((symbol) => ({
    labels: [symbol, labelFor(symbol) ?? symbol],
    units: Number(/\d+$/.exec(symbol)?.[0]) || undefined,
  }));
}

/** Every kind of real estate (a cost card hits "a player who owns a property"), with its labels. */
export function propertyCardTypes(labelFor: SymbolLabel): CardType[] {
  return PROPERTY_SYMBOLS.map((symbol) => ({ labels: [symbol, labelFor(symbol) ?? symbol] }));
}

/** The labels of the businesses (pizza franchise, partners, car washes), for a boost that only helps them. */
export function businessCardLabels(labelFor: SymbolLabel): string[] {
  return BUSINESS_SYMBOLS.flatMap((symbol) => [symbol, labelFor(symbol) ?? symbol]);
}

// ── Buyers ──────────────────────────────────────────────────────────────────────────────────────

/** The one "💰" note on a project: replaced by the next offer, removed at Payday. */
function withMarketNote(
  notes: { text: string; createdAt: string }[],
  text: string,
  createdAt: string,
): { text: string; createdAt: string }[] {
  const index = notes.findIndex((note) => note.text.startsWith(MARKET_NOTE_MARK));
  return index >= 0
    ? notes.map((note, i) => (i === index ? { ...note, text } : note))
    : [...notes, { text, createdAt }];
}

export interface BuyerResult {
  effects: CardEffects;
  /** The labels of the properties (or gold assets) that got an offer; none = the card does not apply to this player. */
  matched: string[];
}

/**
 * Plays a market buyer card (JFK, 2026-10-03). Every property the player owns of the card's types gets the buyer's
 * offer: remembered in the game state until the next Payday, and written into the property's Grow project as a note
 * saying what the sale would bring. The sale itself is the normal Sell in Grow, which pre-fills this offer
 * (`marketSaleFor`). A gold buyer (cash for every coin) offers on the gold assets still holding coins.
 * One History step either way.
 */
export function playMarketBuyerCard(
  books: CardBooks,
  card: CashflowMarketCard,
  options: { title?: string; types: CardType[] },
  deps: CardDeps,
): BuyerResult {
  const { state } = books;
  if (!card.sells) throw new Error('This market card has no offer to play.');
  requireStarted(state);
  const step: GameStep = { kind: 'marketCard', detail: options.title ?? card.title };
  const now = deps.clock.nowIso();
  const sells = card.sells;
  const offers: CashflowMarketOffer[] = [];
  const notesByTitle = new Map<string, { text: string; createdAt: string }[]>();
  const projectNotes = (title: string) =>
    notesByTitle.get(title) ?? books.growProjects.find((p) => p.title === title)?.notes;

  const matched: string[] = [];
  if (sells.pricePerCoinMinor !== undefined) {
    const perCoinMinor = sells.pricePerCoinMinor;
    for (const asset of books.assets) {
      const coins = coinsOwnedOf(state, asset.tag);
      if (coins <= 0 || !options.types.some((type) => matchesType(asset.tag, type))) continue;
      matched.push(asset.tag);
      offers.push({
        title: asset.tag,
        salePriceMinor: perCoinMinor * coins,
        cardId: card.id,
        label: `${deps.money(perCoinMinor)} × ${coins}`,
        pricePerCoinMinor: perCoinMinor,
      });
      const notes = projectNotes(asset.tag);
      if (notes) {
        notesByTitle.set(
          asset.tag,
          withMarketNote(
            notes,
            MARKET_NOTE_MARK +
              deps.text('CashflowGame.noteMarketOfferCoins', {
                perCoin: deps.money(perCoinMinor),
                coins,
                price: deps.money(perCoinMinor * coins),
              }),
            now,
          ),
        );
      }
    }
  } else {
    for (const investment of books.investments) {
      const type = options.types.find((candidate) => matchesType(investment.tag, candidate));
      if (!type) continue;
      matched.push(investment.tag);
      // The original price: what the property cost in all - the deposit plus the mortgage.
      const mortgageMinor = investment.amountMinor;
      const originalMinor = investment.depositMinor + mortgageMinor;
      // What the buyer pays: the original price plus a percentage or a fixed profit, a fixed price for the whole
      // property (condos), or a price for every unit (WE) of the building (complexes).
      const units = type.units ?? 1;
      const salePriceMinor =
        sells.priceMinor !== undefined
          ? sells.priceMinor
          : sells.pricePerUnitMinor !== undefined
            ? sells.pricePerUnitMinor * units
            : originalMinor +
              (sells.plusPercent !== undefined
                ? Math.round((originalMinor * sells.plusPercent) / 100)
                : (sells.plusMinor ?? 0));
      const offerLabel =
        sells.plusPercent !== undefined
          ? `+${sells.plusPercent}%`
          : sells.plusMinor !== undefined
            ? `+${deps.money(sells.plusMinor)}`
            : sells.priceMinor !== undefined
              ? deps.money(sells.priceMinor)
              : `${deps.money(sells.pricePerUnitMinor ?? 0)} × ${units}`;
      offers.push({
        title: investment.tag,
        salePriceMinor,
        cardId: card.id,
        label: offerLabel,
      });
      const notes = projectNotes(investment.tag);
      if (notes) {
        notesByTitle.set(
          investment.tag,
          withMarketNote(
            notes,
            MARKET_NOTE_MARK +
              deps.text(
                salePriceMinor < mortgageMinor
                  ? 'CashflowGame.noteMarketOfferLoss'
                  : 'CashflowGame.noteMarketOffer',
                {
                  loss: deps.money(Math.max(0, mortgageMinor - salePriceMinor)),
                  offer: offerLabel,
                  price: deps.money(salePriceMinor),
                  profit: deps.money(salePriceMinor - originalMinor),
                  mortgage: deps.money(mortgageMinor),
                  cash: deps.money(salePriceMinor - mortgageMinor),
                },
              ),
            now,
          ),
        );
      }
    }
  }

  const matchedSet = new Set(matched);
  const kept = (state.marketOffers ?? []).filter((offer) => !matchedSet.has(offer.title));
  const result = effects({ ...state, marketOffers: [...kept, ...offers] }, step);
  result.growUpdates = [...notesByTitle].map(([title, notes]) => ({ title, notes }));
  result.persist.grow = true;
  return { effects: result, matched: [...matchedSet] };
}

export interface MarketSale {
  salePriceMinor: number;
  /** The income the sale books: the buyer pays the original price plus the profit, the mortgage is paid back out of it. */
  netCashMinor: number;
  label: string;
  /** Gold offers only: the price for every coin, and how many coins are owned now. */
  pricePerCoinMinor?: number;
  coins?: number;
}

/**
 * The market offer waiting for a property or for gold, as the Sell button needs it (JFK, 2026-10-03). Null when no
 * buyer is interested.
 */
export function marketSaleFor(
  state: CashflowGameState,
  investments: BookInvestment[],
  title: string,
): MarketSale | null {
  const offer = (state.marketOffers ?? []).find((candidate) => candidate.title === title);
  if (offer?.pricePerCoinMinor !== undefined) {
    // Gold: no mortgage, the whole price is cash - for the coins still owned.
    const coins = coinsOwnedOf(state, title);
    if (coins <= 0) return null;
    const totalMinor = offer.pricePerCoinMinor * coins;
    return {
      salePriceMinor: totalMinor,
      netCashMinor: totalMinor,
      label: offer.label,
      pricePerCoinMinor: offer.pricePerCoinMinor,
      coins,
    };
  }
  const investment = investments.find((candidate) => candidate.tag === title);
  if (!offer || !investment) return null;
  return {
    salePriceMinor: offer.salePriceMinor,
    netCashMinor: offer.salePriceMinor - investment.amountMinor,
    label: offer.label,
  };
}

// ── Split, boost, cost, price ───────────────────────────────────────────────────────────────────

export interface SplitResult {
  effects: CardEffects;
  /** The share the split applies to, or null when the player does not own it (the card does not apply). */
  share: string | null;
}

/**
 * A stock split card (JFK, 2026-10-03): only for a player who owns that share - otherwise it does not apply (still a
 * History step, nothing written). With the share, a dice decision opens: 1-3 doubles the quantity, 4-6 halves it,
 * rounding up; `resolveShareSplit` applies it later.
 */
export function playShareSplitCard(
  books: CardBooks,
  card: CashflowMarketCard,
  options: { title?: string; labels: string[] },
  deps: CardDeps,
): SplitResult {
  const { state } = books;
  if (!card.splits) throw new Error('This market card has no stock split to play.');
  requireStarted(state);
  const step: GameStep = { kind: 'marketCard', detail: options.title ?? card.title };
  const wanted = options.labels.map((label) => label.toLowerCase());
  const share = books.shares.find(
    (candidate) => candidate.quantity > 0 && wanted.includes(candidate.tag.toLowerCase()),
  );
  if (!share) {
    return { effects: { ...effects(state, step), write: false }, share: null };
  }
  const id = `SPLIT-${share.tag}`;
  const deal: CashflowAssetDeal = {
    title: id,
    coins: 0,
    costMinor: 0,
    stage: 'awaitingRoll',
    split: { shareTag: share.tag },
    successText: deps.text('CashflowGame.splitDouble', {
      share: share.tag,
      from: share.quantity,
      to: share.quantity * 2,
    }),
    failureText: deps.text('CashflowGame.splitHalve', {
      share: share.tag,
      from: share.quantity,
      to: Math.ceil(share.quantity / 2),
    }),
  };
  const result = effects(
    {
      ...state,
      assetDeals: [...(state.assetDeals ?? []).filter((candidate) => candidate.title !== id), deal],
    },
    step,
  );
  result.decisionNeeded = true;
  return { effects: result, share: share.tag };
}

export interface BoostResult {
  effects: CardEffects;
  changed: { title: string; fromMinor: number; toMinor: number }[];
}

/**
 * A cashflow boost (JFK, 2026-10-03: "Kleiner Business Boom!", "Neues Managementsystem"): every investment that pays
 * a monthly cashflow of up to the card's limit gains the card's amount. The Grow project's cashflow and its Payday
 * subscription are both raised, and the project gets a note. Empty `changed` = the card does not apply (still a
 * History step). `businessLabels`, when given, restricts the boost to those property labels.
 */
export function playBoostCard(
  books: CardBooks,
  card: CashflowMarketCard,
  options: { title?: string; businessLabels?: string[] },
  deps: CardDeps,
): BoostResult {
  const { state } = books;
  if (!card.boost) throw new Error('This market card has no boost to play.');
  requireStarted(state);
  const boost = card.boost;
  const now = deps.clock.nowIso();
  const today = deps.clock.todayIso();
  let subscriptions = [...books.subscriptions];
  const upserts: BookSubscription[] = [];
  const growUpdates: BookGrowUpdate[] = [];
  const changed: BoostResult['changed'] = [];
  let titles = state.gameSubscriptionTitles;

  for (const investment of books.investments) {
    if (
      options.businessLabels &&
      !options.businessLabels.some((label) => labelMatches(investment.tag, label))
    ) {
      continue;
    }
    const project = books.growProjects.find((candidate) => candidate.title === investment.tag);
    const cashflowMinor = project?.cashflowMinor ?? 0;
    if (!project || cashflowMinor <= 0 || cashflowMinor > boost.maxCashflowMinor) continue;
    const toMinor = cashflowMinor + boost.addMinor;
    growUpdates.push({
      title: investment.tag,
      cashflowMinor: toMinor,
      notes: [
        ...project.notes,
        {
          text: deps.text('CashflowGame.noteMarketBoost', {
            card: options.title ?? card.title,
            add: deps.money(boost.addMinor),
            from: deps.money(cashflowMinor),
            to: deps.money(toMinor),
          }),
          createdAt: now,
        },
      ],
    });
    // The Payday subscription follows the project's cashflow.
    const subscriptionTitle = `${investment.tag} Cashflow`;
    const upsert = upsertBookSubscription(
      subscriptions,
      {
        title: subscriptionTitle,
        account: 'Income',
        amountMinor: toMinor,
        frequency: 'monthly',
        category: `@${investment.tag}`,
      },
      today,
    );
    subscriptions = subscriptions.some((sub) => sub.title === subscriptionTitle)
      ? subscriptions.map((sub) => (sub.title === subscriptionTitle ? upsert : sub))
      : [...subscriptions, upsert];
    upserts.push(upsert);
    if (!titles.includes(subscriptionTitle)) titles = [...titles, subscriptionTitle];
    changed.push({ title: investment.tag, fromMinor: cashflowMinor, toMinor });
  }

  const result = effects(
    { ...state, gameSubscriptionTitles: titles },
    { kind: 'marketCard', detail: options.title ?? card.title },
  );
  result.growUpdates = growUpdates;
  result.subscriptionUpserts = upserts;
  result.persist = { subscriptions: true, grow: true, balanceSheet: false };
  return { effects: result, changed };
}

export interface CostResult {
  effects: CardEffects;
  /** The label of the first property the player owns - the payment is booked on it through the Add dialog - or null. */
  property: string | null;
}

/**
 * A Market card that costs money to a player who owns a property (JFK, 2026-10-03: tenant damage, a broken sewer
 * pipe). With a property, the caller books the payment on it through the Add dialog, which takes its own undo step,
 * so nothing is recorded here. Without one the card simply does not apply - still a History step: it was played.
 */
export function playMarketCostCard(
  books: Pick<CardBooks, 'state' | 'investments'>,
  card: CashflowMarketCard,
  options: { title?: string; types: CardType[] },
): CostResult {
  const { state } = books;
  if (!card.pays) throw new Error('This market card has no cost to pay.');
  requireStarted(state);
  const first = books.investments.find((investment) =>
    options.types.some((type) => matchesType(investment.tag, type)),
  );
  return {
    effects: {
      ...effects(state, first ? null : { kind: 'marketCard', detail: options.title ?? card.title }),
      write: false,
    },
    property: first?.tag ?? null,
  };
}

export interface PriceResult {
  effects: CardEffects;
  title: string;
}

/**
 * A drawn stock card moves the market price (JFK, 2026-10-03): only its drawer can buy at that price, but everyone
 * can sell at it. When the player still holds shares of it this card does not plan anything - it sets the share's
 * price on the Grow project and on the share held in the balance sheet (quantity, cash and phase stay), and writes
 * what happened on the stock market into the project's notes. One undo step. Throws when the player holds none.
 */
export function updateSharePrice(
  books: CardBooks,
  card: CashflowDealCard,
  text: { description?: string },
  deps: CardDeps,
): PriceResult {
  const title = card.symbol ?? card.title;
  const held = books.shares.find((share) => share.tag === title);
  const project = books.growProjects.find(
    (candidate) => candidate.title === title && Boolean(candidate.share?.tag),
  );
  if (!held || !(held.quantity > 0) || !project || !project.share) {
    throw new Error(`You hold no ${title} shares - plan the card instead.`);
  }
  const priceMinor = card.priceMinor ?? 0;
  const beforeMinor = held.priceMinor ?? project.share.priceMinor ?? 0;
  const now = deps.clock.nowIso();
  const result = effects(books.state, {
    kind: 'priceUpdate',
    detail: `${title} · ${deps.money(beforeMinor)} → ${deps.money(priceMinor)}`,
  });
  result.sharePrices = [{ tag: title, priceMinor }];
  result.growUpdates = [
    {
      title,
      sharePriceMinor: priceMinor,
      updatedAt: now,
      notes: [
        ...project.notes,
        {
          text: [
            deps.text(
              priceMinor >= beforeMinor ? 'CashflowGame.notePriceUp' : 'CashflowGame.notePriceDown',
              {
                symbol: title,
                from: deps.money(beforeMinor),
                to: deps.money(priceMinor),
              },
            ),
            text.description,
          ]
            .filter(Boolean)
            .join(' '),
          createdAt: now,
        },
      ],
    },
  ];
  result.persist = { subscriptions: false, grow: true, balanceSheet: true };
  return { effects: result, title };
}
