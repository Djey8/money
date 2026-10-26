import type { GameBooks } from './books';
import type { Difficulty } from './difficulty';
import { emptyEffects, type GameEffects } from './effects';
import { emptyEmergencyDeck, type EmergencyDeckState, type EmergencyLang } from './emergency-deck';
import {
  HARVEST_GROUPS,
  MARKET_DRIFT_PERCENT,
  type HarvestBuyer,
  type HarvestCard,
  type HarvestFactorBand,
  type HarvestHolderEffect,
  type HarvestLadder,
  type HarvestOp,
} from './harvest-deck';
import { monthlyOf, tickOpportunities, type OpportunityHolding } from './opportunity';
import type { OpportunityCard } from './opportunity-deck';
import { bookOneTime } from './payments-due';
import { pickOne, rollDie, systemRng, type Rng } from './rng';
import type { CashflowGameState } from './types';

/**
 * The market of the Dreamfund game (JFK, 2026-10-26): what the Harvest cards do to the indices, to what the player owns, and what they
 * offer - a window to sell, a buyer, a hype to ride. Every market starts at an index of 1.00; the value of a share is its card price
 * times the index of its market. Pure rules like all the others: books and a die in, `GameEffects` out.
 */

/** The trap tickers have no public index; the Harvest cards set them to zero. */
const NO_INDEX = new Set(['LITHX', 'MOON', 'PREIPO', 'TIMESH']);

/** The markets at the start of a game: every index at 1.00. */
export function initialMarkets(): Record<string, number> {
  return Object.fromEntries(Object.keys(MARKET_DRIFT_PERCENT).map((tag) => [tag, 1]));
}

export const indexOf = (
  state: Pick<CashflowGameState, 'markets'>,
  tag: string | undefined,
): number => (tag && !NO_INDEX.has(tag) ? (state.markets?.[tag] ?? 1) : 1);

const round2 = (value: number) => Math.round(value * 100) / 100;

// ── the pile ──

export interface HarvestDraw {
  card: HarvestCard;
  deck: EmergencyDeckState;
}

/** The next card of the Harvest pile: every copy once before it is shuffled again. */
export function drawHarvestCard(
  cards: readonly HarvestCard[],
  deckState: EmergencyDeckState | undefined,
  rng: Rng = systemRng,
): HarvestDraw {
  const deck = deckState ?? emptyEmergencyDeck();
  const keys = cards.flatMap((card) =>
    Array.from({ length: card.copies }, (_, n) => ({ key: `${card.id}#${n}`, card })),
  );
  let seen = [...deck.seen];
  let pool = keys.filter((entry) => !seen.includes(entry.key));
  if (pool.length === 0) {
    seen = [];
    pool = keys;
  }
  const entry = pickOne(pool, rng);
  return { card: entry.card, deck: { ...deck, seen: [...seen, entry.key] } };
}

// ── what a holding is worth ──

/** The price of one unit of a share now: its card price, divided by the splits, times the index of its market. */
export function unitPriceNow(
  card: OpportunityCard,
  holding: OpportunityHolding,
  state: Pick<CashflowGameState, 'markets'>,
): number {
  if (!card.share) return 0;
  const base = card.share.unitPriceMinor / (holding.splitFactor ?? 1);
  return Math.round(base * indexOf(state, holding.marketTag ?? card.market?.tag));
}

/** What a holding is worth in cash now, before what is owed on it. */
export function valueOf(
  card: OpportunityCard,
  holding: OpportunityHolding,
  state: Pick<CashflowGameState, 'markets'>,
): number {
  if (card.share) return unitPriceNow(card, holding, state) * (holding.units ?? 0);
  if (card.property) {
    return Math.round(card.property.priceMinor * indexOf(state, 'PROPERTY'));
  }
  if (holding.assetBaseMinor !== undefined) {
    return Math.round(holding.assetBaseMinor * indexOf(state, holding.marketTag));
  }
  return holding.paidMinor ?? 0;
}

/** The groups a holding is spoken of by on the Harvest cards (a business, a side hustle, a saving, a property). */
export function groupsOf(card: OpportunityCard): string[] {
  const groups = Object.entries(HARVEST_GROUPS)
    .filter(([, ids]) => ids.includes(card.id))
    .map(([name]) => name);
  if (card.property) groups.push('PROPERTY');
  return [...groups, card.id];
}

const matchesTarget = (
  card: OpportunityCard,
  holding: OpportunityHolding,
  target: string,
): boolean =>
  groupsOf(card).includes(target) ||
  holding.marketTag === target ||
  card.share?.ticker === target ||
  card.id === target;

// ── the dice of the cards ──

function rollFactor(
  bands: readonly HarvestFactorBand[],
  rng: Rng,
): { factor: number; told: string } {
  const roll = rollDie(rng);
  const band =
    bands.find((entry) => roll >= entry.from && roll <= entry.to) ?? bands[bands.length - 1];
  if (typeof band.value === 'number') return { factor: band.value, told: `${roll}` };
  const again = rollDie(rng);
  const inner =
    band.value.rollAgain.find((entry) => again >= entry.from && again <= entry.to) ??
    band.value.rollAgain[band.value.rollAgain.length - 1];
  return { factor: inner.value, told: `${roll}/${again}` };
}

function holderEffect(
  bands: readonly { from: number; to: number; value: HarvestHolderEffect }[],
  rng: Rng,
): { effect: HarvestHolderEffect; roll: number } {
  const roll = rollDie(rng);
  const band =
    bands.find((entry) => roll >= entry.from && roll <= entry.to) ?? bands[bands.length - 1];
  return { effect: band.value, roll };
}

// ── what a card brings to the table ──

/** A sale on offer: a buyer for what the player owns. */
export interface HarvestSale {
  holding: string;
  label: string;
  /** The offer, before what is owed on it and the costs of the sale. */
  grossMinor: number;
  costsMinor: number;
  /** What the buyer pays, and what is owed on the holding (a mortgage, a loan): what is left is the proceeds. */
  owedMinor: number;
  netMinor: number;
  /** Units that are sold (a share) - all of them unless the player chooses. */
  units?: number;
}

/** A hype the player may ride with everything they hold of the target. */
export interface HarvestLadderOffer {
  holding: string;
  label: string;
  /** What the stake is worth now, and what it is worth after the steps ridden so far. */
  stakeMinor: number;
  multiplier: number;
  steps: number;
  maxSteps: number;
  successFrom: number;
  step: number;
  fail: number;
  /** open: waiting; riding: a step won, cash out or roll again; done: it ended. */
  state: 'open' | 'riding' | 'done';
  told: string[];
}

/** What a Harvest card did, kept on the turn while the card is open. */
export interface HarvestPending {
  cardId: string;
  told: string[];
  /** The markets one may sell in now ('ALL': every one of them). */
  window: string[] | 'ALL';
  sales: HarvestSale[];
  ladders: HarvestLadderOffer[];
}

/** A holding in a market that is open for selling now: what a unit brings, and how many there are. */
export interface HarvestWindowSale {
  holding: string;
  label: string;
  units: number;
  unitMinor: number;
  isShare: boolean;
}

/** What the player owns in a market that a card has opened for selling. */
export function windowSaleList(
  state: CashflowGameState,
  cards: readonly OpportunityCard[],
  window: string[] | 'ALL',
  lang: EmergencyLang,
): HarvestWindowSale[] {
  const out: HarvestWindowSale[] = [];
  for (const holding of state.holdings ?? []) {
    if (holding.ended) continue;
    const card = cards.find((candidate) => candidate.id === holding.cardId);
    if (!card || (!card.share && holding.assetBaseMinor === undefined)) continue;
    const open =
      window === 'ALL'
        ? !!holding.marketTag
        : !!holding.marketTag && window.includes(holding.marketTag);
    if (!open) continue;
    const unitMinor = card.share
      ? unitPriceNow(card, holding, state)
      : valueOf(card, holding, state);
    out.push({
      holding: holding.title,
      label: card.title[lang],
      units: card.share ? (holding.units ?? 0) : 1,
      unitMinor,
      isShare: !!card.share,
    });
  }
  return out;
}

export interface HarvestContext {
  cards: readonly OpportunityCard[];
  lang: EmergencyLang;
  date: string;
  rng?: Rng;
  difficulty?: Difficulty;
}

export interface HarvestResult {
  effects: GameEffects;
  pending: HarvestPending;
}

const text = (en: string, de: string, lang: EmergencyLang) => (lang === 'de' ? de : en);

/**
 * Plays a Harvest card: the indices move, the dice of the card are rolled, what happens to the holders is done, and what the player
 * may do about it - sell, ride a hype - is told. Nothing is paid or earned here beyond what the card itself brings.
 */
export function playHarvestCard(
  books: GameBooks,
  card: HarvestCard,
  context: HarvestContext,
): HarvestResult {
  const rng = context.rng ?? systemRng;
  const { lang, date } = context;
  const difficulty = context.difficulty ?? 'medium';
  const effects = emptyEffects(books.state, { kind: 'marketCard', detail: card.title[lang] });
  effects.persist = { subscriptions: false, grow: true, balanceSheet: true };
  let state: CashflowGameState = {
    ...books.state,
    markets: { ...initialMarkets(), ...(books.state.markets ?? {}) },
  };
  const holdings = (state.holdings ?? []).map((holding) => ({
    ...holding,
    temp: holding.temp?.map((entry) => ({ ...entry })),
  }));
  const told: string[] = [];
  const pending: HarvestPending = { cardId: card.id, told, window: [], sales: [], ladders: [] };
  const cardOf = (holding: OpportunityHolding) =>
    context.cards.find((candidate) => candidate.id === holding.cardId);
  const live = () => holdings.filter((holding) => !holding.ended);
  const markets = state.markets as Record<string, number>;
  const mark = (tag: string, factor: number) => {
    if (NO_INDEX.has(tag) || markets[tag] === undefined) return;
    markets[tag] = Math.max(0, round4(markets[tag] * factor));
  };
  const sign = (factor: number) =>
    (factor >= 1 ? '+' : '−') + Math.abs(Math.round((factor - 1) * 100)) + '%';
  const note = (title: string, line: string) => {
    effects.growUpdates.push({
      title,
      updatedAt: `${date}T00:00:00.000Z`,
      notes: [
        ...(books.growProjects.find((project) => project.title === title)?.notes ?? []),
        { text: line, createdAt: `${date}T00:00:00.000Z` },
      ],
    });
  };
  const setLines = () => {
    for (const holding of live()) {
      if (!holding.subscription || holding.ponziLeft !== undefined) continue;
      const monthly = monthlyOf(holding);
      if (monthly !== holding.lineMinor) {
        effects.subscriptionUpserts.push({
          title: holding.subscription,
          account: monthly >= 0 ? 'Income' : 'Daily',
          amountMinor: monthly,
          startDate: date,
          endDate: '',
          category: `@${holding.title}`,
          comment: '#dreamfund',
          frequency: 'monthly',
        });
        holding.lineMinor = monthly;
        effects.persist.subscriptions = true;
      }
    }
  };

  for (const op of card.ops) {
    switch (op.op) {
      case 'index': {
        for (const [tag, factor] of Object.entries(op.factors)) mark(tag, factor);
        told.push(
          Object.entries(op.factors)
            .slice(0, 6)
            .map(([tag, factor]) => `${tag} ${sign(factor)}`)
            .join(', ') + (Object.keys(op.factors).length > 6 ? ' …' : ''),
        );
        break;
      }
      case 'indexDice': {
        const { factor, told: rolled } = rollFactor(op.bands, rng);
        for (const tag of op.markets) mark(tag, factor);
        told.push(
          `${text('Roll', 'Wurf', lang)} ${rolled}: ${op.markets.join(', ')} ${sign(factor)}`,
        );
        break;
      }
      case 'nextPaydayIndex':
        state = { ...state, nextPaydayIndex: op.factors };
        told.push(
          text(
            'Another fall follows at the next Payday.',
            'Beim nächsten Zahltag folgt ein weiterer Rückgang.',
            lang,
          ),
        );
        break;
      case 'recover': {
        for (const tag of Object.keys(markets)) {
          if (markets[tag] < 1)
            markets[tag] = round4(markets[tag] + (1 - markets[tag]) * op.fraction);
        }
        told.push(
          text(
            'Every market below its start recovers half of its fall.',
            'Jeder Markt unter seinem Start holt die Hälfte seines Rückgangs auf.',
            lang,
          ),
        );
        break;
      }
      case 'sellWindow':
        pending.window = op.markets;
        break;
      case 'buyer': {
        pending.sales.push(...buyerSales(op.buyer, live(), cardOf, state, rng, lang));
        break;
      }
      case 'cashflowFactor':
      case 'cashflowDice': {
        const { factor, told: rolled } =
          op.op === 'cashflowDice' ? rollFactor(op.bands, rng) : { factor: op.factor, told: '' };
        for (const holding of live()) {
          const held = cardOf(holding);
          if (!held || !op.groups.some((group) => matchesTarget(held, holding, group))) continue;
          if (op.paydays) {
            holding.temp = [...(holding.temp ?? []), { factor, paydaysLeft: op.paydays }];
          } else {
            holding.factor = round4((holding.factor ?? 1) * factor);
          }
          note(
            holding.title,
            `${card.title[lang]}: ${text('cash flow', 'Cashflow', lang)} ${sign(factor)}${op.paydays ? ` (${op.paydays} ${text('Paydays', 'Zahltage', lang)})` : ''}.`,
          );
        }
        told.push(
          `${op.groups.join(', ')}: ${text('cash flow', 'Cashflow', lang)} ${sign(factor)}${rolled ? ` (${text('roll', 'Wurf', lang)} ${rolled})` : ''}`,
        );
        break;
      }
      case 'payoutFactor': {
        for (const holding of live()) {
          const held = cardOf(holding);
          if (!held?.share) continue;
          for (const [tag, factor] of Object.entries(op.factors)) {
            if (holding.marketTag !== tag) continue;
            if (op.paydays)
              holding.temp = [...(holding.temp ?? []), { factor, paydaysLeft: op.paydays }];
            else holding.factor = round4((holding.factor ?? 1) * factor);
          }
        }
        told.push(
          text(
            'The payouts of the shares change.',
            'Die Ausschüttungen der Aktien ändern sich.',
            lang,
          ),
        );
        break;
      }
      case 'specialPayout': {
        for (const holding of live()) {
          const held = cardOf(holding);
          const per = holding.marketTag ? op.perUnitMinor[holding.marketTag] : undefined;
          if (!held?.share || !per || !holding.units) continue;
          const amount = per * holding.units;
          effects.appendedTransactions.push({
            account: 'Income',
            amountMinor: amount,
            date,
            time: '',
            category: `@${holding.title}`,
            comment: `${card.title[lang]}\n#dreamfund`,
          });
          note(
            holding.title,
            `${card.title[lang]}: ${text('special dividend', 'Sonderdividende', lang)} ${round2(amount / 100)}.`,
          );
          told.push(
            `${holding.title}: ${text('special dividend', 'Sonderdividende', lang)} ${round2(amount / 100)}`,
          );
        }
        break;
      }
      case 'split': {
        for (const holding of live()) {
          const held = cardOf(holding);
          if (!held?.share || holding.marketTag !== op.tag) continue;
          holding.units = (holding.units ?? 0) * op.factor;
          holding.splitFactor = (holding.splitFactor ?? 1) * op.factor;
          note(
            holding.title,
            `${card.title[lang]}: ${holding.units} ${text('units now', 'Anteile jetzt', lang)}.`,
          );
          told.push(`${holding.title}: ${text('units ×', 'Anteile ×', lang)}${op.factor}`);
        }
        break;
      }
      case 'expensesPercent': {
        state = { ...state, expensesPercentTotal: (state.expensesPercentTotal ?? 0) + op.percent };
        for (const sub of books.subscriptions) {
          if (!state.gameSubscriptionTitles.includes(sub.title) || sub.amountMinor >= 0) continue;
          if (sub.title === 'Bank loan interest') continue;
          effects.subscriptionUpserts.push({
            ...sub,
            amountMinor: Math.round(sub.amountMinor * (1 + op.percent / 100)),
          });
        }
        effects.persist.subscriptions = true;
        told.push(
          text(
            `Living costs +${op.percent}% for good.`,
            `Lebenshaltungskosten dauerhaft +${op.percent} %.`,
            lang,
          ),
        );
        break;
      }
      case 'rentPercent': {
        for (const holding of live()) {
          if (!holding.rentMinor) continue;
          const more = Math.round((holding.rentMinor * op.percent) / 100);
          holding.rentMinor += more;
          holding.cashflowMinor += more;
          note(
            holding.title,
            `${card.title[lang]}: ${text('rent', 'Miete', lang)} +${op.percent}%.`,
          );
        }
        told.push(text(`Rents +${op.percent}%.`, `Mieten +${op.percent} %.`, lang));
        break;
      }
      case 'expensesAdd': {
        const title = `${card.title[lang]}`;
        state = {
          ...state,
          marketEffects: [
            ...(state.marketEffects ?? []),
            { title, paydaysLeft: op.paydays, expensesMinor: op.minor },
          ],
        };
        effects.subscriptionUpserts.push({
          title,
          account: op.minor >= 0 ? 'Daily' : 'Income',
          amountMinor: -op.minor,
          startDate: date,
          endDate: '',
          category: `@${title}`,
          comment: '#dreamfund',
          frequency: 'monthly',
        });
        state = { ...state, gameSubscriptionTitles: [...state.gameSubscriptionTitles, title] };
        effects.persist.subscriptions = true;
        told.push(
          text(
            `Living costs ${op.minor >= 0 ? '+' : ''}${round2(op.minor / 100)} for ${op.paydays} Paydays.`,
            `Lebenshaltungskosten ${op.minor >= 0 ? '+' : ''}${round2(op.minor / 100)} für ${op.paydays} Zahltage.`,
            lang,
          ),
        );
        break;
      }
      case 'savingsRate': {
        for (const holding of live()) {
          const held = cardOf(holding);
          if (held && HARVEST_GROUPS['SAVINGS'].includes(held.id)) {
            holding.factor = round4((holding.factor ?? 1) * op.factor);
          }
        }
        told.push(
          text('Savings pay a different rate.', 'Sparkonten zahlen einen anderen Zins.', lang),
        );
        break;
      }
      case 'mortgageRate':
        state = { ...state, mortgageRatePp: (state.mortgageRatePp ?? 0) + op.pp };
        told.push(
          text(
            `New mortgages cost ${op.pp > 0 ? '+' : ''}${op.pp} points.`,
            `Neue Hypotheken kosten ${op.pp > 0 ? '+' : ''}${op.pp} Punkte.`,
            lang,
          ),
        );
        break;
      case 'holderDice':
        applyHolderDice(
          op,
          live(),
          cardOf,
          books,
          effects,
          told,
          note,
          rng,
          lang,
          date,
          card.title[lang],
          (next) => {
            state = next(state);
          },
          state,
        );
        break;
      case 'ladder':
        for (const holding of live()) {
          const held = cardOf(holding);
          if (!held || !op.ladder.targets.some((target) => matchesTarget(held, holding, target)))
            continue;
          const level = op.ladder.byDifficulty[difficulty];
          const stake = valueOf(held, holding, state);
          if (stake <= 0) continue;
          const start = op.ladder.start ?? 1;
          pending.ladders.push({
            holding: holding.title,
            label: held.title[lang],
            stakeMinor: Math.round(stake * (op.ladder.start ? start : 1)),
            multiplier: start,
            steps: 0,
            maxSteps: op.ladder.maxSteps,
            successFrom: level.successFrom,
            step: level.step,
            fail: level.fail,
            state: 'open',
            told: [],
          });
        }
        break;
      case 'penny':
        for (const holding of live()) {
          const held = cardOf(holding);
          if (!held?.share || held.share.ticker !== op.ticker) continue;
          const gross = Math.round((holding.paidMinor ?? 0) * op.factor);
          pending.sales.push({
            holding: holding.title,
            label: text(
              `${held.title.en} at ${op.factor} times what you paid`,
              `${held.title.de} zum ${op.factor}-fachen des Kaufpreises`,
              lang,
            ),
            grossMinor: gross,
            costsMinor: 0,
            owedMinor: 0,
            netMinor: gross,
            units: holding.units,
          });
        }
        break;
      case 'trapReveal':
        revealTraps(op, live(), cardOf, effects, markets, told, note, lang, date);
        break;
    }
  }
  setLines();
  // what the card offers is also what Grow's Sell works with: a buyer's price for a property, a price for every share in a window
  const offers = [
    ...windowSaleList(state, context.cards, pending.window, lang).map((entry) => ({
      title: entry.holding,
      salePriceMinor: entry.unitMinor * (entry.isShare ? entry.units : 1),
      cardId: card.id,
      label: card.title[lang],
      ...(entry.isShare ? { pricePerShareMinor: entry.unitMinor } : {}),
      offeredAtRoll: state.turn?.count ?? 0,
    })),
    ...pending.sales.map((sale) => ({
      title: sale.holding,
      salePriceMinor: sale.grossMinor - sale.costsMinor,
      cardId: card.id,
      label: sale.label,
      ...(sale.units && sale.owedMinor === 0 && sale.costsMinor === 0
        ? { pricePerShareMinor: Math.round(sale.grossMinor / sale.units) }
        : {}),
      offeredAtRoll: state.turn?.count ?? 0,
    })),
  ];
  const offered = new Set(offers.map((offer) => offer.title));
  state = {
    ...state,
    marketOffers: [
      ...(state.marketOffers ?? []).filter((offer) => !offered.has(offer.title)),
      ...offers,
    ],
  };
  // the holdings the card ended are not live any more; prices follow the indices
  repriceHoldings(live(), context.cards, state, effects, books.growProjects, date);
  effects.state = { ...state, holdings, markets };
  return { effects, pending };
}

const round4 = (value: number) => Math.round(value * 10000) / 10000;

function buyerSales(
  buyer: HarvestBuyer,
  holdings: OpportunityHolding[],
  cardOf: (holding: OpportunityHolding) => OpportunityCard | undefined,
  state: CashflowGameState,
  rng: Rng,
  lang: EmergencyLang,
): HarvestSale[] {
  const sales: HarvestSale[] = [];
  let soldProperty = false;
  let soldBusiness = false;
  for (const holding of holdings) {
    const held = cardOf(holding);
    if (!held || !buyer.targets.some((target) => matchesTarget(held, holding, target))) continue;
    let gross = 0;
    let owed = 0;
    let costs = 0;
    let label = held.title[lang];
    if (buyer.basis === 'fixed') {
      gross = buyer.fixedMinor ?? 0;
    } else if (buyer.basis === 'index') {
      if (!held.share) continue;
      gross = Math.round(valueOf(held, holding, state) * (buyer.factor ?? 1));
    } else if (buyer.basis === 'asset') {
      if (held.share || held.property) continue;
      const roll = pickBand(
        holding.marketTag === 'ART' && buyer.artBands ? buyer.artBands : (buyer.bands ?? []),
        rng,
      );
      gross = Math.round(valueOf(held, holding, state) * roll);
      costs = Math.round((gross * (buyer.feesPercent ?? 0)) / 100);
      label = `${held.title[lang]} (×${round4(roll)})`;
    } else if (buyer.basis === 'property') {
      if (!held.property || soldProperty) continue;
      soldProperty = true;
      const roll = buyer.bands ? pickBand(buyer.bands, rng) : (buyer.factor ?? 1);
      gross = Math.round(valueOf(held, holding, state) * roll);
      costs = Math.round((gross * (buyer.saleCostsPercent ?? 0)) / 100);
      owed = held.property.mortgageMinor;
      label = `${held.title[lang]} (×${round4(roll)})`;
    } else if (buyer.basis === 'business') {
      if (soldBusiness || (!held.sideHustle && !held.loan)) continue;
      soldBusiness = true;
      const roll = buyer.bands ? pickBand(buyer.bands, rng) : 1;
      gross = Math.round((buyer.monthsOfCashflow ?? 24) * monthlyOf(holding) * roll);
      owed = held.loan?.loanMinor ?? 0;
      label = `${held.title[lang]} (×${round4(roll)})`;
    }
    if (gross <= 0 && buyer.basis !== 'business') continue;
    sales.push({
      holding: holding.title,
      label,
      grossMinor: gross,
      costsMinor: costs,
      owedMinor: owed,
      netMinor: gross - costs - owed,
      units: holding.units,
    });
  }
  return sales;
}

function pickBand(
  bands: readonly {
    from: number;
    to: number;
    value: number | { rollAgain: { from: number; to: number; value: number }[] };
  }[],
  rng: Rng,
): number {
  return rollFactor(bands as HarvestFactorBand[], rng).factor;
}

function applyHolderDice(
  op: Extract<HarvestOp, { op: 'holderDice' }>,
  holdings: OpportunityHolding[],
  cardOf: (holding: OpportunityHolding) => OpportunityCard | undefined,
  books: GameBooks,
  effects: GameEffects,
  told: string[],
  note: (title: string, line: string) => void,
  rng: Rng,
  lang: EmergencyLang,
  date: string,
  cardTitle: string,
  setState: (change: (state: CashflowGameState) => CashflowGameState) => void,
  stateNow: CashflowGameState,
): void {
  let state = stateNow;
  const hit = holdings.filter((holding) => {
    const held = cardOf(holding);
    return !!held && op.targets.some((target) => matchesTarget(held, holding, target));
  });
  // a holder rolls once for what they own of the target; one property or one business is the one that is hit
  const byGroup = new Set<string>();
  for (const holding of hit) {
    const held = cardOf(holding)!;
    const key = op.targets.find((target) => matchesTarget(held, holding, target)) ?? held.id;
    const single = held.property || held.sideHustle || held.loan;
    if (single && byGroup.has(key)) continue;
    if (single) byGroup.add(key);
    const { effect, roll } = holderEffect(op.bands, rng);
    if (effect.none) {
      told.push(
        `${holding.title}: ${text('roll', 'Wurf', lang)} ${roll} - ${text('nothing happens', 'nichts passiert', lang)}.`,
      );
      continue;
    }
    if (effect.pausePayoutsPaydays) {
      holding.temp = [
        ...(holding.temp ?? []),
        { factor: 0, paydaysLeft: effect.pausePayoutsPaydays },
      ];
      note(
        holding.title,
        `${cardTitle}: ${text('payouts paused', 'Auszahlungen ausgesetzt', lang)} (${effect.pausePayoutsPaydays} ${text('Paydays', 'Zahltage', lang)}).`,
      );
      told.push(
        `${holding.title}: ${text('roll', 'Wurf', lang)} ${roll} - ${text('payouts paused for', 'Auszahlungen ausgesetzt für', lang)} ${effect.pausePayoutsPaydays} ${text('Paydays', 'Zahltage', lang)}.`,
      );
    }
    if (effect.loseCapitalPercent) {
      const loss = Math.round(
        ((holding.capitalMinor ?? holding.paidMinor ?? 0) * effect.loseCapitalPercent) / 100,
      );
      holding.capitalMinor = (holding.capitalMinor ?? holding.paidMinor ?? 0) - loss;
      holding.factor = round4((holding.factor ?? 1) * (1 - effect.loseCapitalPercent / 100));
      told.push(
        `${holding.title}: ${text('roll', 'Wurf', lang)} ${roll} - ${effect.loseCapitalPercent}% ${text('of the capital is lost', 'des Kapitals verloren', lang)}.`,
      );
      note(
        holding.title,
        `${cardTitle}: ${effect.loseCapitalPercent}% ${text('of the capital lost', 'des Kapitals verloren', lang)}.`,
      );
    }
    if (effect.loseUnitsPercent && holding.units) {
      const lost = Math.round((holding.units * effect.loseUnitsPercent) / 100);
      holding.units -= lost;
      told.push(
        `${holding.title}: ${text('roll', 'Wurf', lang)} ${roll} - ${lost} ${text('units lost on the exchange', 'Anteile an der Börse verloren', lang)}.`,
      );
      note(holding.title, `${cardTitle}: ${lost} ${text('units lost', 'Anteile verloren', lang)}.`);
    }
    if (effect.noRentPaydays || effect.noCashflowPaydays) {
      holding.noCashflowLeft = Math.max(
        holding.noCashflowLeft ?? 0,
        effect.noRentPaydays ?? effect.noCashflowPaydays ?? 0,
      );
      told.push(
        `${holding.title}: ${text('roll', 'Wurf', lang)} ${roll} - ${text('no income for', 'kein Einkommen für', lang)} ${holding.noCashflowLeft} ${text('Paydays', 'Zahltage', lang)}.`,
      );
      note(
        holding.title,
        `${cardTitle}: ${text('no income for', 'kein Einkommen für', lang)} ${holding.noCashflowLeft} ${text('Paydays', 'Zahltage', lang)}.`,
      );
    }
    if (effect.legalCostMinor) {
      state = bookOneTime(
        state,
        effects,
        { en: `${holding.title}: legal costs`, de: `${holding.title}: Anwaltskosten` },
        -effect.legalCostMinor,
        date,
        lang,
      );
    }
    if (effect.repairPercentOfPrice) {
      const held2 = cardOf(holding)!;
      const price = held2.property?.priceMinor ?? 0;
      state = bookOneTime(
        state,
        effects,
        { en: `${holding.title}: repair`, de: `${holding.title}: Reparatur` },
        -Math.round((price * effect.repairPercentOfPrice) / 100),
        date,
        lang,
      );
      told.push(
        `${holding.title}: ${text('roll', 'Wurf', lang)} ${roll} - ${text('a repair of', 'eine Reparatur von', lang)} ${effect.repairPercentOfPrice}%.`,
      );
    }
    if (effect.cashflowFactor) {
      holding.factor = round4((holding.factor ?? 1) * effect.cashflowFactor);
      told.push(
        `${holding.title}: ${text('roll', 'Wurf', lang)} ${roll} - ${text('cash flow ×', 'Cashflow ×', lang)}${effect.cashflowFactor}.`,
      );
      note(
        holding.title,
        `${cardTitle}: ${text('cash flow ×', 'Cashflow ×', lang)}${effect.cashflowFactor}.`,
      );
    }
    if (effect.oneTimeMinor) {
      state = bookOneTime(
        state,
        effects,
        { en: `${holding.title}`, de: `${holding.title}` },
        effect.oneTimeMinor,
        date,
        lang,
      );
      told.push(
        `${holding.title}: ${text('roll', 'Wurf', lang)} ${roll} - ${round2(effect.oneTimeMinor / 100)}.`,
      );
    }
    if (effect.valueFactor) {
      holding.assetBaseMinor = Math.round(
        (holding.assetBaseMinor ?? holding.paidMinor ?? 0) * effect.valueFactor,
      );
      told.push(
        `${holding.title}: ${text('roll', 'Wurf', lang)} ${roll} - ${text('value ×', 'Wert ×', lang)}${effect.valueFactor}.`,
      );
    }
    if (effect.fakeItem) {
      holding.assetBaseMinor = 0;
      told.push(
        `${holding.title}: ${text('roll', 'Wurf', lang)} ${roll} - ${text('a fake: it is worth nothing', 'eine Fälschung: wertlos', lang)}.`,
      );
    }
    if (effect.depositBack || effect.depositLost) {
      told.push(
        `${holding.title}: ${text('roll', 'Wurf', lang)} ${roll} - ${effect.depositBack ? text('you got your deposit back', 'du hast deine Einlage zurück', lang) : text('the deposit is lost', 'die Einlage ist verloren', lang)}.`,
      );
    }
    if (effect.sellAtFactor) {
      // handled as an offer by the caller through `sellAtFactor`: noted for the player
      told.push(
        `${holding.title}: ${text('roll', 'Wurf', lang)} ${roll} - ${text('bought out at ×', 'aufgekauft zum ×', lang)}${effect.sellAtFactor}.`,
      );
    }
    if (effect.worthless || effect.endsProject || effect.depositLost) {
      holding.ended = true;
      if (holding.subscription) {
        effects.subscriptionRemovals.push(holding.subscription);
        state = {
          ...state,
          gameSubscriptionTitles: state.gameSubscriptionTitles.filter(
            (t) => t !== holding.subscription,
          ),
        };
      }
      effects.growUpdates.push({
        title: holding.title,
        phase: 'completed',
        cashflowMinor: 0,
        updatedAt: `${date}T00:00:00.000Z`,
      });
      effects.persist.subscriptions = true;
    }
  }
  void books;
  setState(() => state);
}

function revealTraps(
  op: Extract<HarvestOp, { op: 'trapReveal' }>,
  holdings: OpportunityHolding[],
  cardOf: (holding: OpportunityHolding) => OpportunityCard | undefined,
  effects: GameEffects,
  markets: Record<string, number>,
  told: string[],
  note: (title: string, line: string) => void,
  lang: EmergencyLang,
  date: string,
): void {
  for (const holding of holdings) {
    const held = cardOf(holding);
    if (!held) continue;
    const byId = op.cardIds?.includes(held.id);
    const byTicker = !!held.share && !!op.tickers?.includes(held.share.ticker);
    if (!byId && !byTicker) continue;
    holding.ended = true;
    if (held.share) {
      effects.shareRemovals.push(holding.title);
      markets[held.share.ticker] = 0;
    }
    if (holding.subscription) effects.subscriptionRemovals.push(holding.subscription);
    effects.growUpdates.push({
      title: holding.title,
      phase: 'completed',
      cashflowMinor: 0,
      updatedAt: `${date}T00:00:00.000Z`,
    });
    effects.persist.subscriptions = true;
    note(
      holding.title,
      text('It was a scam: the money is gone.', 'Es war Betrug: das Geld ist weg.', lang),
    );
    told.push(
      `${holding.title}: ${text('it was a scam - the money is gone', 'es war Betrug - das Geld ist weg', lang)}.`,
    );
  }
}

/** The share prices and the asset values follow the indices: what changed goes into the books. */
function repriceHoldings(
  holdings: OpportunityHolding[],
  cards: readonly OpportunityCard[],
  state: CashflowGameState,
  effects: GameEffects,
  growProjects: readonly { title: string }[],
  date: string,
): void {
  for (const holding of holdings) {
    const card = cards.find((candidate) => candidate.id === holding.cardId);
    if (!card) continue;
    const grow = growProjects.find((project) => project.title === holding.title);
    if (card.share && holding.units) {
      const price = unitPriceNow(card, holding, state);
      effects.sharePrices = effects.sharePrices.filter((entry) => entry.tag !== holding.title);
      effects.shareUpserts = effects.shareUpserts.filter((entry) => entry.tag !== holding.title);
      effects.shareUpserts.push({ tag: holding.title, quantity: holding.units, priceMinor: price });
      effects.growUpdates.push({
        title: holding.title,
        share: { tag: holding.title, quantity: holding.units, priceMinor: price },
        updatedAt: `${date}T00:00:00.000Z`,
      });
    } else if (holding.assetBaseMinor !== undefined && holding.marketTag) {
      const value = valueOf(card, holding, state);
      effects.assetUpserts = effects.assetUpserts.filter((entry) => entry.tag !== holding.title);
      effects.assetUpserts.push({ tag: holding.title, amountMinor: value });
      if (grow) {
        effects.growUpdates.push({
          title: holding.title,
          amountMinor: value,
          updatedAt: `${date}T00:00:00.000Z`,
        });
      }
    }
  }
}

// ── selling ──

/**
 * What the player sells and gets: a share lot, a property, a business, an asset. The position, its loan and its monthly line end (or
 * shrink, for a part of a lot) and the proceeds - what was paid for it less what is owed on it and the costs - come into the account.
 */
export function sellHolding(
  books: GameBooks,
  holdingTitle: string,
  sale: { grossMinor: number; costsMinor: number; owedMinor: number; units?: number },
  context: HarvestContext,
): GameEffects {
  const { lang, date } = context;
  const state = books.state;
  const holdings = (state.holdings ?? []).map((holding) => ({ ...holding }));
  const holding = holdings.find(
    (candidate) => candidate.title === holdingTitle && !candidate.ended,
  );
  if (!holding) throw new Error(`There is nothing called "${holdingTitle}" to sell.`);
  const card = context.cards.find((candidate) => candidate.id === holding.cardId);
  const effects = emptyEffects(state, { kind: 'cardSale', detail: holdingTitle });
  effects.persist = { subscriptions: true, grow: true, balanceSheet: true };
  const at = `${date}T00:00:00.000Z`;
  const partial =
    card?.share &&
    sale.units !== undefined &&
    holding.units !== undefined &&
    sale.units < holding.units;
  let next = state;
  if (partial && card?.share && holding.units !== undefined && sale.units !== undefined) {
    holding.units -= sale.units;
    holding.cashflowMinor = holding.units * card.share.dividendMonthPerUnitMinor;
    const price = unitPriceNow(card, holding, state);
    effects.shareUpserts.push({ tag: holdingTitle, quantity: holding.units, priceMinor: price });
    effects.growUpdates.push({
      title: holdingTitle,
      share: { tag: holdingTitle, quantity: holding.units, priceMinor: price },
      amountMinor: price * holding.units,
      updatedAt: at,
    });
    if (holding.subscription) {
      effects.subscriptionUpserts.push({
        title: holding.subscription,
        account: 'Income',
        amountMinor: monthlyOf(holding),
        startDate: date,
        endDate: '',
        category: `@${holdingTitle}`,
        comment: '#dreamfund',
        frequency: 'monthly',
      });
      holding.lineMinor = monthlyOf(holding);
    }
  } else {
    holding.ended = true;
    if (card?.share) effects.shareRemovals.push(holdingTitle);
    effects.investmentRemovals.push(holdingTitle);
    effects.assetRemovals.push(holdingTitle);
    effects.liabilityRemovals.push(holdingTitle);
    if (holding.subscription) {
      effects.subscriptionRemovals.push(holding.subscription);
      next = {
        ...next,
        gameSubscriptionTitles: next.gameSubscriptionTitles.filter(
          (t) => t !== holding.subscription,
        ),
      };
    }
    effects.growUpdates.push({
      title: holdingTitle,
      phase: 'completed',
      cashflowMinor: 0,
      amountMinor: 0,
      updatedAt: at,
      notes: [
        ...(books.growProjects.find((project) => project.title === holdingTitle)?.notes ?? []),
        {
          text: `Sold for ${round2(sale.grossMinor / 100)}${sale.owedMinor ? `, ${round2(sale.owedMinor / 100)} repaid` : ''}.`,
          createdAt: at,
        },
      ],
    });
  }
  const net = sale.grossMinor - sale.costsMinor - sale.owedMinor;
  if (net >= 0) {
    effects.appendedTransactions.push({
      account: 'Fire',
      amountMinor: net,
      date,
      time: '',
      category: `@${holdingTitle}`,
      comment: `${holdingTitle}\n#dreamfund`,
    });
  } else {
    next = bookOneTime(
      next,
      effects,
      { en: `${holdingTitle}: sale`, de: `${holdingTitle}: Verkauf` },
      net,
      date,
      lang,
    );
  }
  effects.state = { ...next, holdings };
  return effects;
}

// ── the hype ladder ──

export interface LadderStep {
  offer: HarvestLadderOffer;
  roll: number;
}

/** Rides one step: a die decides. A win multiplies the stake; a loss ends the hype and what is left is the fail share of the stake. */
export function rideLadder(offer: HarvestLadderOffer, rng: Rng = systemRng): LadderStep {
  const roll = rollDie(rng);
  const next = { ...offer, told: [...offer.told] };
  if (roll >= offer.successFrom) {
    next.steps += 1;
    next.multiplier = round4(next.multiplier * offer.step);
    next.state = next.steps >= offer.maxSteps ? 'done' : 'riding';
    next.told.push(`${roll}: ×${offer.step}`);
  } else {
    next.multiplier = round4(offer.fail * (offer.stakeMinor > 0 ? 1 : 0)) || 0;
    next.state = 'done';
    next.told.push(`${roll}: ${offer.fail > 0 ? `×${offer.fail}` : '×0'}`);
    next.steps = -1;
  }
  return { offer: next, roll };
}

/** What a ladder pays when it is cashed out (or has failed): the stake times where it stands. */
export function ladderPayout(offer: HarvestLadderOffer): number {
  return offer.steps < 0
    ? Math.round(offer.stakeMinor * offer.fail)
    : Math.round(offer.stakeMinor * offer.multiplier);
}

// ── the Payday of the markets ──

/**
 * A Payday of the markets: every index drifts a little, what a card said was to come at the next Payday comes, and an extra cost of a
 * card runs down. Returns the new state; the prices of the holdings follow in `tickOpportunities`.
 */
export function tickMarkets(
  state: CashflowGameState,
  difficulty: Difficulty = 'medium',
): CashflowGameState {
  const markets = { ...initialMarkets(), ...(state.markets ?? {}) };
  for (const tag of Object.keys(MARKET_DRIFT_PERCENT)) {
    markets[tag] = round4(markets[tag] * (1 + MARKET_DRIFT_PERCENT[tag][difficulty] / 100));
  }
  for (const [tag, factor] of Object.entries(state.nextPaydayIndex ?? {})) {
    if (markets[tag] !== undefined) markets[tag] = round4(markets[tag] * factor);
  }
  return { ...state, markets, nextPaydayIndex: undefined };
}

/** Marks the ladder state of a Harvest pending as a plain object for the state (see `HarvestPending`). */
export function openLadders(pending: HarvestPending): HarvestLadderOffer[] {
  return pending.ladders.filter((ladder) => ladder.state !== 'done');
}

/**
 * A Payday of the whole market: the indices drift, what the player owns is priced again, what the cards did to it runs down, and an
 * extra cost of a market card ends. This is what the Payday of the game calls.
 */
export function tickWorld(
  books: {
    state: CashflowGameState;
    subscriptions: GameBooks['subscriptions'];
    growProjects: readonly { title: string; notes: { text: string; createdAt: string }[] }[];
  },
  cards: readonly OpportunityCard[],
  options: { date: string; lang: EmergencyLang; rng?: Rng; difficulty?: Difficulty },
): { effects: GameEffects; news: string[] } {
  const drifted = tickMarkets(books.state, options.difficulty);
  const tick = tickOpportunities({ ...books, state: drifted }, cards, options);
  const effects = tick?.effects ?? emptyEffects(drifted, null);
  let state = effects.state;
  const news = [...(tick?.news ?? [])];
  // an extra cost of a market card runs down and ends
  const running = (state.marketEffects ?? []).map((entry) => ({
    ...entry,
    paydaysLeft: entry.paydaysLeft - 1,
  }));
  for (const entry of running.filter((candidate) => candidate.paydaysLeft <= 0)) {
    effects.subscriptionRemovals.push(entry.title);
    state = {
      ...state,
      gameSubscriptionTitles: state.gameSubscriptionTitles.filter((t) => t !== entry.title),
    };
    effects.persist.subscriptions = true;
  }
  state = { ...state, marketEffects: running.filter((entry) => entry.paydaysLeft > 0) };
  const live = (state.holdings ?? []).filter((holding) => !holding.ended);
  repriceHoldings(live, cards, state, effects, books.growProjects, options.date);
  effects.persist = { ...effects.persist, grow: true, balanceSheet: true };
  effects.state = state;
  return { effects, news };
}

export type { HarvestLadder };
