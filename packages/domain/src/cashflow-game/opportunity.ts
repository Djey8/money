import {
  emptyEffects,
  type BookGrowUpdate,
  type BookSubscription,
  type GameEffects,
} from './effects';
import { emptyEmergencyDeck, type EmergencyDeckState, type EmergencyLang } from './emergency-deck';
import type { LifeState } from './life-deck';
import type { GameBooks } from './books';
import {
  OPPORTUNITY_PILES,
  type OpportunityBuyRoll,
  type OpportunityCard,
  type OpportunityPile,
  type OpportunityRoll,
} from './opportunity-deck';
import { mortgageDeltaMinor, withLuck, type Difficulty } from './difficulty';
import { bookOneTime } from './payments-due';
import { pickOne, rollDie, systemRng, type Rng } from './rng';
import type { CashflowGameState } from './types';

/**
 * The rules of the Opportunity tile (JFK, 2026-10-26): which cards a pile offers, what taking one costs and what it does to the books.
 * Like every rule these are pure: books and a die in, `GameEffects` out. The purchase itself is paid in the Add dialog (a payment due);
 * `buyOpportunity` runs once it is paid - or at once for a card that costs nothing.
 */

export interface OpportunitySettings {
  /** Cards shown per landing; the player takes at most one. */
  offersPerLanding: number;
  /** Side hustles a player can run at once; a new one replaces an old one. */
  maxSideHustles: number;
  /** Copies of each savings card in its pile. */
  savingsCardCopies: number;
}

export const DEFAULT_OPPORTUNITY_SETTINGS: OpportunitySettings = {
  offersPerLanding: 1,
  maxSideHustles: 2,
  savingsCardCopies: 2,
};

export type OpportunityDeckState = Record<OpportunityPile, EmergencyDeckState>;

export function emptyOpportunityDeck(): OpportunityDeckState {
  return { seed: emptyEmergencyDeck(), sapling: emptyEmergencyDeck(), tree: emptyEmergencyDeck() };
}

/** What the player owns of the cards, for the Paydays to come: the card, what it pays now and what is still running. */
export interface OpportunityHolding {
  cardId: string;
  /** The title of the Grow project (the ticker for a share). */
  title: string;
  boughtRound: number;
  paydays: number;
  units?: number;
  /** The title of the subscription that carries its monthly cash flow, if it has one. */
  subscription?: string;
  /** What the card pays (or costs) every month once it runs; it pays nothing before `rampLeft` is over. */
  cashflowMinor: number;
  rampLeft?: number;
  /** Money that is locked this many Paydays, and what comes back then. */
  lockedLeft?: number;
  lockedReturnMinor?: number;
  /** Rent that is cut for some Paydays. */
  rentCut?: { percent: number; paydaysLeft: number };
  rentMinor?: number;
  laterCosts?: { inPaydays: number; minor: number }[];
  /** A saving: what it takes off the month, and what it has saved altogether. */
  monthlySavingsMinor?: number;
  savedMinor?: number;
  /** The line of expenses a saving was taken from. */
  savedFrom?: string;
  ponziLeft?: number;
  collapseLeft?: number;
  capitalMinor?: number;
  /** The player ended it (sold, swapped out, ran out). */
  ended?: boolean;
  /** The market it is priced by (the Harvest cards move its index), and how often a split has divided the price of a unit. */
  marketTag?: string;
  splitFactor?: number;
  /** What a Harvest card did to its cash flow: for good (a factor), for some Paydays, or nothing for some Paydays. */
  factor?: number;
  temp?: { factor: number; paydaysLeft: number }[];
  noCashflowLeft?: number;
  /** What an asset is worth at the start of the markets (before its index), and what was paid for it altogether. */
  assetBaseMinor?: number;
  paidMinor?: number;
  /** What its monthly line says now. */
  lineMinor?: number;
}

/**
 * What a holding pays (or costs) this month: its cash flow, less a cut of the rent, times what the Harvest cards did to it - and
 * nothing while it ramps up or while a market card has stopped it.
 */
export function monthlyOf(holding: OpportunityHolding): number {
  if (holding.rampLeft && holding.rampLeft > 0) return 0;
  if (holding.noCashflowLeft && holding.noCashflowLeft > 0) return 0;
  const cut = holding.rentCut
    ? Math.round(((holding.rentMinor ?? 0) * holding.rentCut.percent) / 100)
    : 0;
  const temp = (holding.temp ?? []).reduce((product, entry) => product * entry.factor, 1);
  return Math.round((holding.cashflowMinor - cut) * (holding.factor ?? 1) * temp);
}

export interface OpportunityContext {
  life?: LifeState;
  careerStage: number;
  holdings: readonly OpportunityHolding[];
  debtMinor: number;
}

const copiesOf = (card: OpportunityCard, settings: OpportunitySettings): number =>
  card.growType === 'income-growth' ? 1 : settings.savingsCardCopies;

const active = (holdings: readonly OpportunityHolding[]) =>
  holdings.filter((holding) => !holding.ended);

/** Whether a card can be offered to this player now: what it asks is there, and it is not a second copy of what runs already. */
export function canOffer(
  card: OpportunityCard,
  context: OpportunityContext,
  deck: readonly OpportunityCard[],
): boolean {
  const need = card.requires;
  if (need?.home && context.life?.home !== need.home) return false;
  if (need?.careerStage !== undefined && context.careerStage < need.careerStage) return false;
  if (need?.debtMinor !== undefined && context.debtMinor < need.debtMinor) return false;
  if (need?.owns) {
    const owned = active(context.holdings).some((holding) => holding.cardId === need.owns);
    if (!owned && deck.some((candidate) => candidate.id === need.owns)) return false;
  }
  const held = context.holdings.find((holding) => holding.cardId === card.id);
  // a share can be bought again (more units); everything else is owned once, a saving is applied once
  if (held && !held.ended && !card.share) return false;
  if (held && card.growType !== 'income-growth') return false;
  return true;
}

export interface OpportunityDraw {
  offers: OpportunityCard[];
  deck: OpportunityDeckState;
}

/**
 * The cards a landing offers: the next ones of the pile that can happen to this player. A card that was offered goes to the bottom -
 * it is not offered again until the whole pile has been through. A savings card appears as often as the settings say.
 */
export function drawOpportunityOffers(
  cards: readonly OpportunityCard[],
  deckState: OpportunityDeckState | undefined,
  pile: OpportunityPile,
  settings: OpportunitySettings,
  context: OpportunityContext,
  rng: Rng = systemRng,
): OpportunityDraw {
  const deck = deckState ?? emptyOpportunityDeck();
  const inPile = cards.filter((card) => card.pile === pile);
  const keys = inPile.flatMap((card) =>
    Array.from({ length: copiesOf(card, settings) }, (_, n) => ({ key: `${card.id}#${n}`, card })),
  );
  let seen = [...deck[pile].seen];
  const offers: OpportunityCard[] = [];
  const wanted = Math.max(1, Math.min(3, settings.offersPerLanding));
  for (let attempt = 0; attempt < wanted * 3 && offers.length < wanted; attempt += 1) {
    const usable = (list: typeof keys) =>
      list.filter(
        (entry) =>
          !seen.includes(entry.key) &&
          !offers.some((offer) => offer.id === entry.card.id) &&
          canOffer(entry.card, context, cards),
      );
    let pool = usable(keys);
    if (pool.length === 0) {
      // the pile has been through: it is shuffled again
      seen = [];
      pool = usable(keys);
    }
    if (pool.length === 0) break;
    const entry = pickOne(pool, rng);
    seen.push(entry.key);
    offers.push(entry.card);
  }
  return { offers, deck: { ...deck, [pile]: { ...deck[pile], seen } } };
}

/** The band a die roll falls in (the last one for a roll beyond the bands). */
export function bandFor<T>(
  bands: readonly { from: number; to: number; value: T }[],
  roll: number,
): T {
  return (bands.find((band) => roll >= band.from && roll <= band.to) ?? bands[bands.length - 1])
    .value;
}

/** What the player chooses when they take a card: the units of a share, the steps of a savings account, the hustle to give up. */
export interface OpportunityChoice {
  units?: number;
  steps?: number;
  /** The id of the side hustle that ends to make room. */
  swapOut?: string;
  /** The market price of a unit now, in percent of the card's price (100 without a market). */
  indexPercent?: number;
}

export interface OpportunityQuote {
  ok: boolean;
  reason?: 'sideHustleFull' | 'units' | 'steps' | 'nothing';
  /** Paid now, in the Add dialog. */
  costMinor: number;
  /** The side hustles that run now (the player has to give one up when the limit is reached). */
  sideHustles: OpportunityHolding[];
  needsSwap: boolean;
}

export function sideHustlesOf(
  holdings: readonly OpportunityHolding[],
  cards: readonly OpportunityCard[],
): OpportunityHolding[] {
  return active(holdings).filter(
    (holding) => cards.find((card) => card.id === holding.cardId)?.sideHustle,
  );
}

/** What taking a card costs now, and whether the player has to make room first. */
export function quoteOpportunity(
  card: OpportunityCard,
  choice: OpportunityChoice,
  context: OpportunityContext,
  settings: OpportunitySettings,
  cards: readonly OpportunityCard[],
): OpportunityQuote {
  const sideHustles = card.sideHustle ? sideHustlesOf(context.holdings, cards) : [];
  const needsSwap = !!card.sideHustle && sideHustles.length >= settings.maxSideHustles;
  let costMinor: number;
  let reason: OpportunityQuote['reason'];
  if (card.share) {
    const held = active(context.holdings).find((holding) => holding.cardId === card.id);
    const room = card.share.maxUnits - (held?.units ?? 0);
    const units = choice.units ?? 1;
    if (units < 1 || units > room) reason = 'units';
    costMinor =
      Math.round((card.share.unitPriceMinor * (choice.indexPercent ?? 100)) / 100) * units;
  } else if (card.stepMinor) {
    const steps = choice.steps ?? 1;
    if (steps < 1 || steps > 50) reason = 'steps';
    costMinor = card.stepMinor * steps;
  } else {
    costMinor = card.costMinor ?? 0;
  }
  if (!reason && needsSwap && !sideHustles.some((holding) => holding.cardId === choice.swapOut)) {
    reason = 'sideHustleFull';
  }
  return { ok: !reason, reason, costMinor, sideHustles, needsSwap };
}

/** The dice a card needs when it is bought: one for its outcome, one for what happens on the purchase. */
export function diceNeeded(card: OpportunityCard): { outcome: boolean; onBuy: boolean } {
  return { outcome: !!card.dice, onBuy: !!card.onBuy };
}

/** Where a saving is taken from: the expense line of the character (its key), by card. */
const SAVINGS_FROM: Record<string, string> = {
  S01: 'subscriptions',
  S02: 'utilities',
  S03: 'groceries',
  S04: 'utilities',
  S36: 'subscriptions',
};

const note = (text: string, at: string) => ({ text, createdAt: at });
const money = (minor: number) => (minor / 100).toLocaleString('en', { maximumFractionDigits: 2 });

/** What the purchase decides by chance. */
export interface OpportunityRolls {
  outcome?: number;
  outcomeAgain?: number;
  onBuy?: number;
}

export function rollsFor(
  card: OpportunityCard,
  rng: Rng = systemRng,
  difficulty?: Difficulty,
): OpportunityRolls {
  const rolls: OpportunityRolls = {};
  if (card.dice) {
    // the luck of the level goes on the dice where high is good - never on a trap
    const roll = rollDie(rng);
    rolls.outcome = card.trap ? roll : withLuck(roll, difficulty);
    const first = bandFor(card.dice, rolls.outcome);
    if (first.rollAgain) rolls.outcomeAgain = rollDie(rng);
  }
  if (card.onBuy) rolls.onBuy = rollDie(rng);
  return rolls;
}

function resolveOutcome(card: OpportunityCard, rolls: OpportunityRolls): OpportunityRoll {
  if (!card.dice || rolls.outcome === undefined) return {};
  const first = bandFor(card.dice, rolls.outcome);
  if (first.rollAgain) return bandFor(first.rollAgain, rolls.outcomeAgain ?? 1);
  return first;
}

function line(
  title: string,
  amountMinor: number,
  date: string,
  category: string,
): BookSubscription {
  return {
    title,
    account: amountMinor >= 0 ? 'Income' : 'Daily',
    amountMinor,
    startDate: date,
    endDate: '',
    category,
    comment: '#dreamfund',
    frequency: 'monthly',
  };
}

export interface OpportunityPurchase {
  effects: GameEffects;
  /** Payments the card asks for besides what was paid (a renovation, a hidden damage). */
  holding: OpportunityHolding;
  /** What the dice said, in words for the notes. */
  told: string[];
}

/**
 * Puts a taken card into the books: the Grow project (in `execute`, with everything the card tells), the position it gives (shares, a
 * property and its mortgage, an asset, a loan), the monthly lines it pays or costs, what its dice decided, and what it does to the
 * expenses (a saving). What was paid is not booked here: the Add dialog did that.
 */
export function buyOpportunity(
  books: GameBooks,
  card: OpportunityCard,
  choice: OpportunityChoice,
  rolls: OpportunityRolls,
  options: {
    date: string;
    lang: EmergencyLang;
    context: OpportunityContext;
    cards: readonly OpportunityCard[];
    difficulty?: Difficulty;
  },
): OpportunityPurchase {
  const { date, lang } = options;
  const { state } = books;
  const at = `${date}T00:00:00.000Z`;
  const outcome = resolveOutcome(card, rolls);
  const buyRoll: OpportunityBuyRoll =
    card.onBuy && rolls.onBuy ? bandFor(card.onBuy, rolls.onBuy) : {};
  const told: string[] = [];
  const effects = emptyEffects(state, { kind: 'buyDeal', detail: card.title[lang] });
  effects.persist = { subscriptions: false, grow: true, balanceSheet: true };
  let next: CashflowGameState = { ...state };
  const holdings = [...(state.holdings ?? [])];

  // a side hustle that makes room ends
  if (choice.swapOut) {
    const out = holdings.find((holding) => holding.cardId === choice.swapOut && !holding.ended);
    if (out) {
      out.ended = true;
      if (out.subscription) effects.subscriptionRemovals.push(out.subscription);
      effects.growUpdates.push({
        title: out.title,
        phase: 'completed',
        cashflowMinor: 0,
        updatedAt: at,
        notes: [
          ...(books.growProjects.find((project) => project.title === out.title)?.notes ?? []),
          note(`Ended to make room for ${card.title[lang]}.`, at),
        ],
      });
      effects.persist.subscriptions = true;
    }
  }

  const title = card.share ? card.share.ticker : card.title[lang];
  const units = card.share
    ? (choice.units ?? 1) +
      (active(holdings).find((holding) => holding.cardId === card.id)?.units ?? 0)
    : undefined;
  const subscriptionTitle = `${title} Cashflow`;
  const growDetails: NonNullable<BookGrowUpdate['details']> = {
    type: card.growType,
    category: card.category,
    pattern: card.pattern,
    reasoning: card.reasoning,
    risks: card.risks,
    riskScore: card.riskScore,
    insights: card.insights,
    alternative: card.alternative,
    alternativeCostMinor: card.alternativeCostMinor,
    links: card.links,
    actionItems: card.actions,
  };
  const notes = [
    note(`${card.title[lang]}: ${card.story[lang]}`, at),
    ...(card.note ? [note(card.note, at)] : []),
  ];
  const update: BookGrowUpdate = {
    title,
    create: true,
    createdAt: at,
    sub: card.category,
    phase: 'execute',
    description: card.story[lang],
    strategy: card.strategy,
    isAsset: card.kind === 'asset',
    amountMinor: 0,
    cashflowMinor: 0,
    updatedAt: at,
    details: growDetails,
  };

  let cashflowMinor = outcome.cashflowMinor ?? buyRoll.cashflowMinor ?? card.cashflowMinor ?? 0;
  // the mortgage costs what the level and the market say, not only what the card was written with
  if (card.property && !outcome.cashflowMinor && buyRoll.cashflowMinor === undefined) {
    cashflowMinor -= mortgageDeltaMinor(
      card.property.mortgageMinor,
      options.difficulty,
      state.mortgageRatePp ?? 0,
    );
  }
  const holding: OpportunityHolding = {
    cardId: card.id,
    title,
    boughtRound: state.round,
    paydays: 0,
    cashflowMinor: 0,
  };
  const paid = quoteOpportunity(
    card,
    choice,
    options.context,
    DEFAULT_OPPORTUNITY_SETTINGS,
    options.cards,
  ).costMinor;

  // ── a saving: it takes something off the month ──
  const isSaving = card.growType !== 'income-growth';
  if (isSaving) {
    const debt = options.context.debtMinor;
    const wanted =
      outcome.monthlySavingsMinor ??
      (card.savingsFormulaPercentOfDebt
        ? Math.round((debt * card.savingsFormulaPercentOfDebt) / 100 / 12)
        : (card.savings?.monthlySavingsMinor ?? 0));
    const key = SAVINGS_FROM[card.id];
    const lineTitle = key ? state.lineTitles?.[key] : undefined;
    const lineSub = lineTitle
      ? books.subscriptions.find((sub) => sub.title === lineTitle)
      : undefined;
    let applied = 0;
    if (lineSub && lineSub.amountMinor < 0) {
      applied = Math.min(wanted, -lineSub.amountMinor);
      effects.subscriptionUpserts.push({ ...lineSub, amountMinor: lineSub.amountMinor + applied });
    }
    // what no line of expenses can give is a small income of its own
    const rest = wanted - applied;
    if (rest > 0) {
      effects.subscriptionUpserts.push(line(subscriptionTitle, rest, date, `@${title}`));
      next = {
        ...next,
        gameSubscriptionTitles: next.gameSubscriptionTitles.includes(subscriptionTitle)
          ? next.gameSubscriptionTitles
          : [...next.gameSubscriptionTitles, subscriptionTitle],
      };
      holding.subscription = subscriptionTitle;
    }
    effects.persist.subscriptions = true;
    holding.monthlySavingsMinor = wanted;
    holding.savedMinor = 0;
    if (lineSub && applied > 0) holding.savedFrom = lineSub.title;
    growDetails.monthlySavingsMinor = wanted;
    growDetails.annualSavingsMinor = wanted * 12;
    if (card.savings?.currentCostMinor)
      growDetails.currentCostMinor = card.savings.currentCostMinor;
    if (card.savings?.targetCostMinor !== undefined)
      growDetails.targetCostMinor = card.savings.targetCostMinor;
    update.phase = 'execute';
    notes.push(
      note(
        `Saving applied: ${money(wanted)} less every month${holding.savedFrom ? ` (taken off "${holding.savedFrom}")` : ''}. Together: ${money(wanted * 12)} a year.`,
        at,
      ),
    );
    if (outcome.monthlySavingsMinor !== undefined && rolls.outcome !== undefined) {
      told.push(`Roll ${rolls.outcome}: ${money(wanted)} a month.`);
    }
  }

  // ── a share ──
  if (card.share && units !== undefined) {
    const price = Math.round((card.share.unitPriceMinor * (choice.indexPercent ?? 100)) / 100);
    const bought = choice.units ?? 1;
    const invested =
      (books.growProjects.find((p) => p.title === title)?.amountMinor ?? 0) + price * bought;
    update.amountMinor = invested;
    update.share = { tag: title, quantity: units, priceMinor: price };
    effects.shareUpserts.push({ tag: title, quantity: units, priceMinor: price });
    holding.units = units;
    cashflowMinor = units * card.share.dividendMonthPerUnitMinor;
    notes.push(note(`Bought ${bought} units at ${money(price)} - ${units} in total.`, at));
    if (card.setsCar) next = { ...next, life: next.life ? { ...next.life, car: true } : next.life };
  }

  // ── a property or a business: the deposit is the project's amount, the loan a liability of its own ──
  const loanMinor = card.property?.mortgageMinor ?? card.loan?.loanMinor ?? 0;
  if ((card.property || card.loan || card.kind === 'investment') && !card.share && !isSaving) {
    update.amountMinor = paid;
    effects.investmentUpserts.push({ tag: title, depositMinor: paid, amountMinor: loanMinor });
    update.investment = { tag: title, depositMinor: paid, amountMinor: loanMinor };
    if (loanMinor > 0) {
      effects.liabilityUpserts.push({ tag: title, amountMinor: loanMinor, investment: true });
      update.loan = { tag: title, amountMinor: loanMinor, creditMinor: 0, investment: true };
      notes.push(note(`Financed with a loan of ${money(loanMinor)}.`, at));
    }
  } else if (!card.share && !isSaving && (card.kind === 'asset' || card.costMinor !== undefined)) {
    // a thing owned: collectibles, metals, equipment, a lent sum
    const value = outcome.assetValueMinor ?? card.assetValueMinor ?? paid;
    update.amountMinor = value;
    if (
      value > 0 &&
      !card.cashflowMinor &&
      !card.dice?.some((band) => band.value.cashflowMinor !== undefined)
    ) {
      effects.assetUpserts.push({ tag: title, amountMinor: value });
    } else if (paid > 0) {
      effects.assetUpserts.push({ tag: title, amountMinor: paid });
    }
    if (outcome.assetValueMinor !== undefined && rolls.outcome !== undefined) {
      told.push(
        `Roll ${rolls.outcome}${rolls.outcomeAgain ? ` / ${rolls.outcomeAgain}` : ''}: worth ${money(outcome.assetValueMinor)}.`,
      );
      notes.push(
        note(`What it is really worth: ${money(outcome.assetValueMinor)} (the dice decided).`, at),
      );
    }
  }

  // ── what the dice decided for the monthly money, and what a purchase brings by chance ──
  if (outcome.cashflowMinor !== undefined && rolls.outcome !== undefined) {
    told.push(`Roll ${rolls.outcome}: ${money(outcome.cashflowMinor)} a month.`);
    notes.push(
      note(`Roll ${rolls.outcome}: cash flow ${money(outcome.cashflowMinor)} a month.`, at),
    );
  }
  if (card.onBuy && rolls.onBuy !== undefined) {
    if (buyRoll.oneTimeMinor) {
      next = bookOneTime(next, effects, card.title, buyRoll.oneTimeMinor, date, lang);
      told.push(`Roll ${rolls.onBuy}: ${money(Math.abs(buyRoll.oneTimeMinor))} to pay.`);
    } else if (buyRoll.laterCost) {
      holding.laterCosts = [
        { inPaydays: buyRoll.laterCost.afterPaydays, minor: buyRoll.laterCost.minor },
      ];
      told.push(`Roll ${rolls.onBuy}: a cost of ${money(buyRoll.laterCost.minor)} comes in time.`);
    } else if (buyRoll.cashflowMinor !== undefined) {
      told.push(
        `Roll ${rolls.onBuy}: the numbers were inflated - ${money(buyRoll.cashflowMinor)} a month.`,
      );
    } else if (buyRoll.extraCostPercent) {
      told.push(`Roll ${rolls.onBuy}: the renovation costs ${buyRoll.extraCostPercent}% more.`);
    } else {
      told.push(`Roll ${rolls.onBuy}: as expected.`);
    }
  }
  if (outcome.oneTimeMinor !== undefined && !isSaving) {
    next = bookOneTime(next, effects, card.title, outcome.oneTimeMinor, date, lang);
    told.push(`Roll ${rolls.outcome}: ${money(outcome.oneTimeMinor)}.`);
  }
  // the renovation of a fixer-upper is paid before rent starts
  if (card.property?.extraCostMinor) {
    const extra = Math.round(
      (card.property.extraCostMinor * (100 + (buyRoll.extraCostPercent ?? 0))) / 100,
    );
    next = bookOneTime(
      next,
      effects,
      { en: `${card.title.en}: renovation`, de: `${card.title.de}: Sanierung` },
      -extra,
      date,
      lang,
    );
  }

  // ── the monthly line the card pays (or costs) ──
  if (!isSaving && (cashflowMinor !== 0 || card.rampPaydays || card.property)) {
    holding.cashflowMinor = cashflowMinor;
    holding.subscription = subscriptionTitle;
    holding.rentMinor = card.property?.rentMonthMinor;
    holding.rampLeft = card.rampPaydays;
    const monthly = holding.rampLeft ? 0 : cashflowMinor;
    effects.subscriptionUpserts.push(line(subscriptionTitle, monthly, date, `@${title}`));
    effects.persist.subscriptions = true;
    next = {
      ...next,
      gameSubscriptionTitles: next.gameSubscriptionTitles.includes(subscriptionTitle)
        ? next.gameSubscriptionTitles
        : [...next.gameSubscriptionTitles, subscriptionTitle],
    };
    update.cashflowMinor = cashflowMinor;
    notes.push(
      note(
        `Cash flow: ${money(cashflowMinor)} a month${card.rampPaydays ? ` after ${card.rampPaydays} Paydays` : ''}.`,
        at,
      ),
    );
  }
  if (card.monthlyCostMinor) {
    const costTitle = `${title} Costs`;
    effects.subscriptionUpserts.push(line(costTitle, -card.monthlyCostMinor, date, `@${title}`));
    next = {
      ...next,
      gameSubscriptionTitles: [...next.gameSubscriptionTitles, costTitle],
    };
    effects.persist.subscriptions = true;
  }

  // ── what runs by itself: locked money, a trap ──
  if (card.lockedPaydays) {
    holding.lockedLeft = card.lockedPaydays;
    holding.lockedReturnMinor = paid;
    notes.push(
      note(`The money is locked for ${card.lockedPaydays} Paydays, then it comes back.`, at),
    );
  }
  if (card.trap?.ponzi) {
    holding.ponziLeft = card.trap.ponzi.paysPaydays;
    effects.subscriptionUpserts.push(
      line(subscriptionTitle, card.trap.ponzi.paysMonthMinor, date, `@${title}`),
    );
    holding.subscription = subscriptionTitle;
    effects.persist.subscriptions = true;
    next = {
      ...next,
      gameSubscriptionTitles: next.gameSubscriptionTitles.includes(subscriptionTitle)
        ? next.gameSubscriptionTitles
        : [...next.gameSubscriptionTitles, subscriptionTitle],
    };
  }
  if (card.trap?.collapseAfterPaydays) holding.collapseLeft = card.trap.collapseAfterPaydays;
  if (card.sideHustle)
    notes.push(note('A side hustle: it takes your evenings (at most two run at a time).', at));
  if (card.setsCar && !card.share) {
    next = { ...next, life: next.life ? { ...next.life, car: true } : next.life };
  }
  if (card.property || card.loan) holding.capitalMinor = paid;

  holding.marketTag = card.market?.tag;
  holding.paidMinor = paid;
  holding.assetBaseMinor =
    outcome.assetValueMinor ?? card.assetValueMinor ?? (card.kind === 'asset' ? paid : undefined);
  holding.lineMinor = holding.subscription ? monthlyOf(holding) : undefined;
  update.notes = notes;
  effects.growUpdates.push(update);
  const same = card.share ? active(holdings).find((h) => h.cardId === card.id) : undefined;
  if (same) {
    // more units of a share already held: the position grows, it is not a second project
    same.units = holding.units;
    same.cashflowMinor = holding.cashflowMinor;
    same.paidMinor = (same.paidMinor ?? 0) + paid;
    same.lineMinor = monthlyOf(same);
    effects.subscriptionUpserts = effects.subscriptionUpserts.map((sub) =>
      sub.title === same.subscription ? { ...sub, amountMinor: monthlyOf(same) } : sub,
    );
  } else {
    holdings.push(holding);
  }
  next = { ...next, holdings };
  effects.state = next;
  return { effects, holding, told };
}

/** What a Payday does to what the player owns of the cards. */
export interface OpportunityTick {
  effects: GameEffects;
  news: string[];
}

/**
 * A Payday of the cards: a ramping business starts to pay, locked money comes back, a trap pays and stops, a property has a bad
 * season, a saving adds to its total. Dice come from `rng`.
 */
export function tickOpportunities(
  books: {
    state: CashflowGameState;
    subscriptions: readonly BookSubscription[];
    growProjects: readonly { title: string; notes: { text: string; createdAt: string }[] }[];
  },
  cards: readonly OpportunityCard[],
  options: { date: string; lang: EmergencyLang; rng?: Rng },
): OpportunityTick | null {
  const state = books.state;
  const holdings = (state.holdings ?? []).map((holding) => ({ ...holding }));
  if (holdings.every((holding) => holding.ended)) return null;
  const rng = options.rng ?? systemRng;
  const { date, lang } = options;
  const at = `${date}T00:00:00.000Z`;
  const effects = emptyEffects(state, null);
  const news: string[] = [];
  let next = { ...state };
  const setLine = (holding: OpportunityHolding, amountMinor: number) => {
    if (!holding.subscription) return;
    effects.subscriptionUpserts.push(
      line(holding.subscription, amountMinor, date, `@${holding.title}`),
    );
    effects.persist.subscriptions = true;
  };
  const end = (holding: OpportunityHolding, text: string, cashBack = 0) => {
    holding.ended = true;
    if (holding.subscription) {
      effects.subscriptionRemovals.push(holding.subscription);
      next = {
        ...next,
        gameSubscriptionTitles: next.gameSubscriptionTitles.filter(
          (t) => t !== holding.subscription,
        ),
      };
      effects.persist.subscriptions = true;
    }
    effects.growUpdates.push({
      title: holding.title,
      phase: 'completed',
      cashflowMinor: 0,
      updatedAt: at,
      notes: [
        ...(books.growProjects.find((project) => project.title === holding.title)?.notes ?? []),
        note(text, at),
      ],
    });
    effects.persist.grow = true;
    if (cashBack > 0) {
      effects.appendedTransactions.push({
        account: 'Income',
        amountMinor: cashBack,
        date,
        time: '',
        category: `@${holding.title}`,
        comment: `${holding.title}\n#dreamfund`,
      });
    }
    news.push(text);
  };

  for (const holding of holdings) {
    if (holding.ended) continue;
    const card = cards.find((candidate) => candidate.id === holding.cardId);
    if (!card) continue;
    holding.paydays += 1;
    const notes = () =>
      books.growProjects.find((project) => project.title === holding.title)?.notes ?? [];

    // a saving counts what it has saved
    if (holding.monthlySavingsMinor) {
      holding.savedMinor = (holding.savedMinor ?? 0) + holding.monthlySavingsMinor;
      const kept = notes().filter((n) => !n.text.startsWith('Total saved'));
      effects.growUpdates.push({
        title: holding.title,
        updatedAt: at,
        notes: [
          ...kept,
          note(
            `Total saved so far: ${money(holding.savedMinor)} (${holding.paydays} Paydays).`,
            at,
          ),
        ],
      });
      effects.persist.grow = true;
    }

    // a trap
    if (holding.ponziLeft !== undefined) {
      holding.ponziLeft -= 1;
      if (holding.ponziLeft <= 0) {
        const then = card.trap?.ponzi?.then;
        const lost = then === 'lost' || rollDie(rng) <= 5;
        end(
          holding,
          lost
            ? `${holding.title} stopped paying: the money is gone.`
            : `${holding.title}: you got out in time.`,
          lost ? 0 : (card.costMinor ?? 0),
        );
      }
      continue;
    }
    if (holding.collapseLeft !== undefined) {
      holding.collapseLeft -= 1;
      if (holding.collapseLeft <= 0) {
        effects.shareRemovals.push(holding.title);
        end(holding, `${holding.title} collapsed to nothing.`);
        continue;
      }
    }

    // money that is locked
    if (holding.lockedLeft !== undefined) {
      holding.lockedLeft -= 1;
      if (holding.lockedLeft <= 0) {
        end(holding, `${holding.title}: the locked money is back.`, holding.lockedReturnMinor ?? 0);
        continue;
      }
    }

    // the start of a business
    if (holding.rampLeft) {
      holding.rampLeft -= 1;
      if (holding.rampLeft <= 0) {
        news.push(`${holding.title} starts to pay.`);
        effects.growUpdates.push({
          title: holding.title,
          updatedAt: at,
          notes: [...notes(), note(`It runs now: ${money(holding.cashflowMinor)} a month.`, at)],
        });
        effects.persist.grow = true;
      }
    }

    // a bad season, a tenant who leaves
    if (holding.rentCut) {
      holding.rentCut.paydaysLeft -= 1;
      if (holding.rentCut.paydaysLeft <= 0) {
        holding.rentCut = undefined;
      }
    } else if (card.eachPayday && !holding.rampLeft) {
      const roll = bandFor(card.eachPayday, rollDie(rng));
      if (roll.rentCutPercent && holding.rentMinor) {
        const cut = Math.round((holding.rentMinor * roll.rentCutPercent) / 100);
        holding.rentCut = { percent: roll.rentCutPercent, paydaysLeft: roll.paydays ?? 1 };
        void cut;
        news.push(
          `${holding.title}: rent is ${roll.rentCutPercent}% lower for ${roll.paydays ?? 1} Payday(s).`,
        );
      } else if (roll.capitalLossPercent && holding.capitalMinor) {
        const loss = Math.round((holding.capitalMinor * roll.capitalLossPercent) / 100);
        holding.capitalMinor -= loss;
        holding.cashflowMinor = Math.round(
          holding.cashflowMinor * (1 - roll.capitalLossPercent / 100),
        );
        news.push(
          `${holding.title}: a borrower defaulted, ${roll.capitalLossPercent}% of the capital is lost.`,
        );
      }
    }

    // a cost that comes in time
    if (holding.laterCosts?.length) {
      holding.laterCosts = holding.laterCosts.map((cost) => ({
        ...cost,
        inPaydays: cost.inPaydays - 1,
      }));
      const due = holding.laterCosts.filter((cost) => cost.inPaydays <= 0);
      holding.laterCosts = holding.laterCosts.filter((cost) => cost.inPaydays > 0);
      for (const cost of due) {
        next = bookOneTime(
          next,
          effects,
          { en: `${holding.title}: repair`, de: `${holding.title}: Reparatur` },
          -cost.minor,
          date,
          lang,
        );
        news.push(`${holding.title}: a big repair is due.`);
      }
    }

    // what the Harvest cards did runs down, and the line follows what the holding pays now
    if (holding.temp?.length) {
      holding.temp = holding.temp
        .map((entry) => ({ ...entry, paydaysLeft: entry.paydaysLeft - 1 }))
        .filter((entry) => entry.paydaysLeft > 0);
    }
    if (holding.noCashflowLeft && holding.noCashflowLeft > 0) holding.noCashflowLeft -= 1;
    if (holding.subscription && holding.ponziLeft === undefined) {
      const monthly = monthlyOf(holding);
      if (monthly !== holding.lineMinor) {
        setLine(holding, monthly);
        holding.lineMinor = monthly;
      }
    }
  }
  effects.state = { ...next, holdings };
  return { effects, news };
}

/** Whether a pile name is one of the three (for a stored game). */
export function isOpportunityPile(value: unknown): value is OpportunityPile {
  return OPPORTUNITY_PILES.includes(value as OpportunityPile);
}
