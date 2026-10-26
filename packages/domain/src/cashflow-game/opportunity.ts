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
import { cardText } from '../cashflow-card-text-de';
import { marketOfTag } from './harvest-deck';
import { planDeal, type DealDeps, type DealInput } from './deals';
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
  /** Turns a planned card stays buyable: 1 = only in the turn it was drawn. */
  validTurns?: number;
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
    // a share has no limit on the card: the player decides in Grow how many to buy
    const units = choice.units ?? 1;
    if (units < 1) reason = 'units';
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
/** The language of the sentences being made: numbers follow it (set where a rule starts; the rules run one at a time). */
let moneyLocale: 'en' | 'de' = 'en';
const money = (minor: number) =>
  (minor / 100).toLocaleString(moneyLocale, { maximumFractionDigits: 2 });
const tx = (lang: EmergencyLang, en: string, de: string) => (lang === 'de' ? de : en);

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
    /** The position was bought in Grow (the Add dialog books it): only what the card adds to it is done here. */
    light?: boolean;
  },
): OpportunityPurchase {
  const { date, lang } = options;
  moneyLocale = lang;
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
          note(
            tx(
              lang,
              `Ended to make room for ${card.title[lang]}.`,
              `Beendet, um Platz für ${card.title[lang]} zu machen.`,
            ),
            at,
          ),
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
  const growDetails = detailsOf(card, lang);
  const notes = [
    note(`${card.title[lang]}: ${card.story[lang]}`, at),
    ...(card.note ? [note(cardText(card.note, lang), at)] : []),
  ];
  const update: BookGrowUpdate = {
    title,
    create: true,
    createdAt: at,
    sub: cardText(card.category, lang),
    phase: 'execute',
    description: card.story[lang],
    strategy: cardText(card.strategy, lang),
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
        tx(
          lang,
          `Saving applied: ${money(wanted)} less every month${holding.savedFrom ? ` (taken off "${holding.savedFrom}")` : ''}. Together: ${money(wanted * 12)} a year.`,
          `Ersparnis angewendet: ${money(wanted)} weniger jeden Monat${holding.savedFrom ? ` (von „${holding.savedFrom}“ abgezogen)` : ''}. Zusammen: ${money(wanted * 12)} im Jahr.`,
        ),
        at,
      ),
    );
    if (outcome.monthlySavingsMinor !== undefined && rolls.outcome !== undefined) {
      told.push(
        tx(
          lang,
          `Roll ${rolls.outcome}: ${money(wanted)} a month.`,
          `Wurf ${rolls.outcome}: ${money(wanted)} im Monat.`,
        ),
      );
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
    notes.push(
      note(
        tx(
          lang,
          `Bought ${bought} units at ${money(price)} - ${units} in total.`,
          `${bought} Anteile zu je ${money(price)} gekauft – insgesamt ${units}.`,
        ),
        at,
      ),
    );
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
      notes.push(
        note(
          tx(
            lang,
            `Financed with a loan of ${money(loanMinor)}.`,
            `Mit einem Kredit von ${money(loanMinor)} finanziert.`,
          ),
          at,
        ),
      );
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
        tx(
          lang,
          `Roll ${rolls.outcome}${rolls.outcomeAgain ? ` / ${rolls.outcomeAgain}` : ''}: worth ${money(outcome.assetValueMinor)}.`,
          `Wurf ${rolls.outcome}${rolls.outcomeAgain ? ` / ${rolls.outcomeAgain}` : ''}: Wert ${money(outcome.assetValueMinor)}.`,
        ),
      );
      notes.push(
        note(
          tx(
            lang,
            `What it is really worth: ${money(outcome.assetValueMinor)} (the dice decided).`,
            `Was es wirklich wert ist: ${money(outcome.assetValueMinor)} (der Würfel hat entschieden).`,
          ),
          at,
        ),
      );
    }
  }

  // ── what the dice decided for the monthly money, and what a purchase brings by chance ──
  if (outcome.cashflowMinor !== undefined && rolls.outcome !== undefined) {
    told.push(
      tx(
        lang,
        `Roll ${rolls.outcome}: ${money(outcome.cashflowMinor)} a month.`,
        `Wurf ${rolls.outcome}: ${money(outcome.cashflowMinor)} im Monat.`,
      ),
    );
    notes.push(
      note(
        tx(
          lang,
          `Roll ${rolls.outcome}: cash flow ${money(outcome.cashflowMinor)} a month.`,
          `Wurf ${rolls.outcome}: Cashflow ${money(outcome.cashflowMinor)} im Monat.`,
        ),
        at,
      ),
    );
  }
  if (card.onBuy && rolls.onBuy !== undefined) {
    if (buyRoll.oneTimeMinor) {
      next = bookOneTime(next, effects, card.title, buyRoll.oneTimeMinor, date, lang);
      told.push(
        tx(
          lang,
          `Roll ${rolls.onBuy}: ${money(Math.abs(buyRoll.oneTimeMinor))} to pay.`,
          `Wurf ${rolls.onBuy}: ${money(Math.abs(buyRoll.oneTimeMinor))} zu zahlen.`,
        ),
      );
    } else if (buyRoll.laterCost) {
      holding.laterCosts = [
        { inPaydays: buyRoll.laterCost.afterPaydays, minor: buyRoll.laterCost.minor },
      ];
      told.push(
        tx(
          lang,
          `Roll ${rolls.onBuy}: a cost of ${money(buyRoll.laterCost.minor)} comes in time.`,
          `Wurf ${rolls.onBuy}: Mit der Zeit kommen Kosten von ${money(buyRoll.laterCost.minor)}.`,
        ),
      );
    } else if (buyRoll.cashflowMinor !== undefined) {
      told.push(
        tx(
          lang,
          `Roll ${rolls.onBuy}: the numbers were inflated - ${money(buyRoll.cashflowMinor)} a month.`,
          `Wurf ${rolls.onBuy}: Die Zahlen waren aufgebläht – ${money(buyRoll.cashflowMinor)} im Monat.`,
        ),
      );
    } else if (buyRoll.extraCostPercent) {
      told.push(
        tx(
          lang,
          `Roll ${rolls.onBuy}: the renovation costs ${buyRoll.extraCostPercent}% more.`,
          `Wurf ${rolls.onBuy}: Die Renovierung kostet ${buyRoll.extraCostPercent} % mehr.`,
        ),
      );
    } else {
      told.push(
        tx(lang, `Roll ${rolls.onBuy}: as expected.`, `Wurf ${rolls.onBuy}: wie erwartet.`),
      );
    }
  }
  if (outcome.oneTimeMinor !== undefined && !isSaving) {
    next = bookOneTime(next, effects, card.title, outcome.oneTimeMinor, date, lang);
    told.push(`${tx(lang, 'Roll', 'Wurf')} ${rolls.outcome}: ${money(outcome.oneTimeMinor)}.`);
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
        tx(
          lang,
          `Cash flow: ${money(cashflowMinor)} a month${card.rampPaydays ? ` after ${card.rampPaydays} Paydays` : ''}.`,
          `Cashflow: ${money(cashflowMinor)} im Monat${card.rampPaydays ? ` nach ${card.rampPaydays} Zahltagen` : ''}.`,
        ),
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
      note(
        tx(
          lang,
          `The money is locked for ${card.lockedPaydays} Paydays, then it comes back.`,
          `Das Geld ist ${card.lockedPaydays} Zahltage gebunden, dann kommt es zurück.`,
        ),
        at,
      ),
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
    notes.push(
      note(
        tx(
          lang,
          'A side hustle: it takes your evenings (at most two run at a time).',
          'Ein Nebenprojekt: Es nimmt deine Abende (höchstens zwei laufen gleichzeitig).',
        ),
        at,
      ),
    );
  if (card.setsCar && !card.share) {
    next = { ...next, life: next.life ? { ...next.life, car: true } : next.life };
  }
  if (card.property || card.loan) holding.capitalMinor = paid;

  holding.marketTag = marketOfTag(card.market?.tag);
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
  if (options.light) {
    // the Add dialog books the share, the property, the loan and the asset itself; the project keeps what Grow wrote
    effects.shareUpserts = [];
    effects.investmentUpserts = [];
    effects.liabilityUpserts = [];
    effects.assetUpserts = [];
    effects.growUpdates = effects.growUpdates.map((entry) =>
      entry.title !== title
        ? entry
        : {
            title: entry.title,
            updatedAt: entry.updatedAt,
            notes: entry.notes,
            ...(entry.cashflowMinor !== undefined ? { cashflowMinor: entry.cashflowMinor } : {}),
          },
    );
  }
  next = {
    ...next,
    holdings,
    // a plan that was bought is done (a share keeps its plan: more units can be bought later)
    opportunityPlans: card.share
      ? next.opportunityPlans
      : (next.opportunityPlans ?? []).filter((plan) => plan.title !== title),
  };
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
  moneyLocale = lang;
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
      const kept = notes().filter(
        (n) => !n.text.startsWith('Total saved') && !n.text.startsWith('Bisher gespart'),
      );
      effects.growUpdates.push({
        title: holding.title,
        updatedAt: at,
        notes: [
          ...kept,
          note(
            tx(
              lang,
              `Total saved so far: ${money(holding.savedMinor)} (${holding.paydays} Paydays).`,
              `Bisher gespart: ${money(holding.savedMinor)} (${holding.paydays} Zahltage).`,
            ),
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
            ? tx(
                lang,
                `${holding.title} stopped paying: the money is gone.`,
                `${holding.title} zahlt nicht mehr: Das Geld ist weg.`,
              )
            : tx(
                lang,
                `${holding.title}: you got out in time.`,
                `${holding.title}: Du bist rechtzeitig ausgestiegen.`,
              ),
          lost ? 0 : (card.costMinor ?? 0),
        );
      }
      continue;
    }
    if (holding.collapseLeft !== undefined) {
      holding.collapseLeft -= 1;
      if (holding.collapseLeft <= 0) {
        effects.shareRemovals.push(holding.title);
        end(
          holding,
          tx(
            lang,
            `${holding.title} collapsed to nothing.`,
            `${holding.title} ist in sich zusammengebrochen.`,
          ),
        );
        continue;
      }
    }

    // money that is locked
    if (holding.lockedLeft !== undefined) {
      holding.lockedLeft -= 1;
      if (holding.lockedLeft <= 0) {
        end(
          holding,
          tx(
            lang,
            `${holding.title}: the locked money is back.`,
            `${holding.title}: Das gebundene Geld ist zurück.`,
          ),
          holding.lockedReturnMinor ?? 0,
        );
        continue;
      }
    }

    // the start of a business
    if (holding.rampLeft) {
      holding.rampLeft -= 1;
      if (holding.rampLeft <= 0) {
        news.push(
          tx(lang, `${holding.title} starts to pay.`, `${holding.title} beginnt zu zahlen.`),
        );
        effects.growUpdates.push({
          title: holding.title,
          updatedAt: at,
          notes: [
            ...notes(),
            note(
              tx(
                lang,
                `It runs now: ${money(holding.cashflowMinor)} a month.`,
                `Es läuft jetzt: ${money(holding.cashflowMinor)} im Monat.`,
              ),
              at,
            ),
          ],
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
          tx(
            lang,
            `${holding.title}: rent is ${roll.rentCutPercent}% lower for ${roll.paydays ?? 1} Payday(s).`,
            `${holding.title}: Die Miete ist ${roll.rentCutPercent} % niedriger für ${roll.paydays ?? 1} Zahltag(e).`,
          ),
        );
      } else if (roll.capitalLossPercent && holding.capitalMinor) {
        const loss = Math.round((holding.capitalMinor * roll.capitalLossPercent) / 100);
        holding.capitalMinor -= loss;
        holding.cashflowMinor = Math.round(
          holding.cashflowMinor * (1 - roll.capitalLossPercent / 100),
        );
        news.push(
          tx(
            lang,
            `${holding.title}: a borrower defaulted, ${roll.capitalLossPercent}% of the capital is lost.`,
            `${holding.title}: Ein Kreditnehmer ist ausgefallen, ${roll.capitalLossPercent} % des Kapitals gehen verloren.`,
          ),
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
        news.push(
          tx(
            lang,
            `${holding.title}: a big repair is due.`,
            `${holding.title}: Eine große Reparatur steht an.`,
          ),
        );
      }
    }

    // what the Harvest cards did runs down, and the line follows what the holding pays now
    // and each of them says so when it is over (JFK, 2026-10-26: "I magically got cashflow back and dont know why")
    const over: string[] = [];
    if (holding.temp?.length) {
      const before = holding.temp.length;
      holding.temp = holding.temp
        .map((entry) => ({ ...entry, paydaysLeft: entry.paydaysLeft - 1 }))
        .filter((entry) => entry.paydaysLeft > 0);
      if (holding.temp.length < before)
        over.push(
          tx(
            lang,
            `${holding.title}: a market card's effect on the cash flow is over.`,
            `${holding.title}: Der Effekt einer Marktkarte auf den Cashflow ist vorbei.`,
          ),
        );
    }
    if (holding.noCashflowLeft && holding.noCashflowLeft > 0) {
      holding.noCashflowLeft -= 1;
      if (holding.noCashflowLeft === 0)
        over.push(
          tx(lang, `${holding.title}: it pays again.`, `${holding.title}: Es zahlt wieder.`),
        );
    }
    if (over.length) {
      news.push(...over);
      const pushed = [...effects.growUpdates]
        .reverse()
        .find((entry) => entry.title === holding.title);
      const lines = over.map((line) => note(line, at));
      if (pushed?.notes) pushed.notes = [...pushed.notes, ...lines];
      else
        effects.growUpdates.push({
          title: holding.title,
          updatedAt: at,
          notes: [...notes(), ...lines],
        });
      effects.persist.grow = true;
    }
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

// ── Planning in Grow, and selling there (JFK, 2026-10-26) ──

const averageOf = (values: number[]) =>
  values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0;

/** What a card is expected to pay each month (by its numbers, the dice averaged): what the plan in Grow shows before it is bought. */
export function expectedCashflowMinor(card: OpportunityCard): number {
  if (card.cashflowMinor !== undefined) return card.cashflowMinor;
  const rolled = (card.dice ?? []).flatMap((band) =>
    band.value.cashflowMinor === undefined
      ? []
      : Array.from({ length: band.to - band.from + 1 }, () => band.value.cashflowMinor as number),
  );
  return averageOf(rolled);
}

/** The Grow project's title of a card: the ticker of a share, the name of everything else. */
export const projectTitleOf = (card: OpportunityCard, lang: EmergencyLang): string =>
  card.share ? card.share.ticker : card.title[lang];

/** What a card tells about its project, in the language of the game. */
function detailsOf(
  card: OpportunityCard,
  lang: EmergencyLang,
): NonNullable<BookGrowUpdate['details']> {
  const t = (text: string) => cardText(text, lang);
  return {
    type: card.growType,
    category: t(card.category),
    pattern: t(card.pattern),
    reasoning: t(card.reasoning),
    risks: t(card.risks),
    riskScore: card.riskScore,
    insights: t(card.insights),
    alternative: t(card.alternative),
    alternativeCostMinor: card.alternativeCostMinor,
    links: card.links.map((link) => ({ ...link, label: t(link.label) })),
    actionItems: card.actions.map((action) => ({ ...action, text: t(action.text) })),
  };
}

/**
 * Taking a card is **planning** it: a Grow project in `plan` with everything the card tells, its numbers as the plan and a note that
 * says what the player has in cash and what they would have to borrow. The player sets how many units to buy (there is no limit on the
 * card), then buys with Grow's Buy; selling is Grow's Sell. The card becomes a holding when the purchase is booked (`light` buy).
 */
export function planOpportunity(
  books: GameBooks,
  card: OpportunityCard,
  deps: DealDeps,
  options: { lang: EmergencyLang; indexPercent?: number; swapOut?: string; validTurns?: number },
): GameEffects {
  const { lang } = options;
  const title = projectTitleOf(card, lang);
  const subtitle = cardText(card.category, lang);
  const description = card.story[lang];
  const price = Math.round(
    ((card.share?.unitPriceMinor ?? 0) * (options.indexPercent ?? 100)) / 100,
  );
  const input: DealInput = card.share
    ? {
        kind: 'share',
        title,
        quantity: 1,
        priceMinor: price,
        subtitle,
        description,
        strategy: cardText(card.strategy, lang),
      }
    : card.property || card.loan || card.kind === 'investment'
      ? {
          kind: 'investment',
          title,
          depositMinor: card.costMinor ?? 0,
          mortgageMinor: card.property?.mortgageMinor ?? card.loan?.loanMinor ?? 0,
          cashflowMinor: expectedCashflowMinor(card),
          subtitle,
          description,
        }
      : {
          kind: 'asset',
          title,
          costMinor: card.costMinor ?? 0,
          coins: 0,
          subtitle,
          description,
          strategy: cardText(card.strategy, lang),
        };
  const effects = planDeal(books, input, deps);
  const at = deps.clock.nowIso();
  const first = effects.growUpdates[0];
  effects.growUpdates = [
    {
      ...first,
      strategy: cardText(card.strategy, lang),
      isAsset: first.isAsset ?? (card.kind === 'asset' && !card.share ? true : undefined),
      details: detailsOf(card, lang),
      notes: [
        ...(first.notes ?? []),
        ...(card.note ? [note(cardText(card.note, lang), at)] : []),
        ...(card.sideHustle
          ? [
              note(
                tx(
                  lang,
                  'A side hustle: it takes your evenings (at most a few run at a time).',
                  'Ein Nebenprojekt: Es nimmt deine Abende (nur einige laufen gleichzeitig).',
                ),
                at,
              ),
            ]
          : []),
      ],
    },
  ];
  effects.state = {
    ...effects.state,
    opportunityPlans: [
      ...(effects.state.opportunityPlans ?? []).filter((plan) => plan.title !== title),
      {
        title,
        cardId: card.id,
        turnsLeft: options.validTurns ?? 1,
        ...(options.swapOut ? { swapOut: options.swapOut } : {}),
      },
    ],
  };
  return effects;
}

/**
 * A sale in Grow (the Add dialog books the money and the position): the holding follows - fewer units of a share, or ended with its
 * monthly line when it is all sold. Returns null for a title that is not a holding.
 */
export function settleHoldingSale(
  books: Pick<GameBooks, 'state'>,
  title: string,
  soldUnits: number | undefined,
  cards: readonly OpportunityCard[],
  date: string,
): GameEffects | null {
  const state = books.state;
  const holdings = (state.holdings ?? []).map((holding) => ({ ...holding }));
  const holding = holdings.find((candidate) => candidate.title === title && !candidate.ended);
  if (!holding) return null;
  const card = cards.find((candidate) => candidate.id === holding.cardId);
  const effects = emptyEffects(state, null);
  effects.persist = { subscriptions: true, grow: false, balanceSheet: false };
  const partial =
    !!card?.share &&
    soldUnits !== undefined &&
    holding.units !== undefined &&
    soldUnits < holding.units;
  let next = state;
  if (partial && card?.share && soldUnits !== undefined && holding.units !== undefined) {
    holding.units -= soldUnits;
    holding.cashflowMinor = holding.units * card.share.dividendMonthPerUnitMinor;
    if (holding.subscription) {
      holding.lineMinor = monthlyOf(holding);
      effects.subscriptionUpserts.push(
        line(holding.subscription, holding.lineMinor, date, `@${title}`),
      );
    }
  } else {
    holding.ended = true;
    if (holding.subscription) {
      effects.subscriptionRemovals.push(holding.subscription);
      next = {
        ...next,
        gameSubscriptionTitles: next.gameSubscriptionTitles.filter(
          (t) => t !== holding.subscription,
        ),
      };
    }
  }
  effects.state = { ...next, holdings };
  return effects;
}

/**
 * A turn is settled (JFK, 2026-10-26): every planned card has one turn less to be bought. A card whose time is up is a chance missed -
 * the Grow project is completed (or back to execute when units of it are held) and says so in a note; it cannot be bought any more.
 * With the default of one turn a card can only be bought in the turn in which it is in hand.
 */
export function closeOpportunityPlans(
  books: Pick<GameBooks, 'state' | 'growProjects'>,
  lang: EmergencyLang,
  date: string,
): GameEffects | null {
  const plans = books.state.opportunityPlans ?? [];
  if (plans.length === 0) return null;
  const effects = emptyEffects(books.state, null);
  const kept: typeof plans = [];
  for (const plan of plans) {
    const left = (plan.turnsLeft ?? 1) - 1;
    if (left > 0) {
      kept.push({ ...plan, turnsLeft: left });
      continue;
    }
    const project = books.growProjects.find((candidate) => candidate.title === plan.title);
    const held = (books.state.holdings ?? []).some(
      (holding) => holding.title === plan.title && !holding.ended,
    );
    const text =
      lang === 'de'
        ? 'Chance verpasst: Das Angebot wurde nicht rechtzeitig genutzt und ging an jemand anderen.'
        : 'Chance missed: the offer was not taken in time and went to somebody else.';
    effects.growUpdates.push({
      title: plan.title,
      phase: held ? 'execute' : 'completed',
      notes: [...(project?.notes ?? []), note(text, date)],
      updatedAt: date,
    });
  }
  effects.state = { ...books.state, opportunityPlans: kept };
  effects.persist.grow = effects.growUpdates.length > 0;
  return effects;
}
