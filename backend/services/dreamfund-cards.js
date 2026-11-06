'use strict';

/**
 * The printed cards of the Dreamfund game for readers who are not looking at the screen (JFK, 2026-11-06): an agent that advises or
 * plays has to know which cards exist and what each does. Language-neutral numbers (minor units: 100 = 1 Dream Taler) with the English
 * and German titles, and for the Harvest cards a plain sentence for every operation. What only the engine may know - which Opportunity
 * cards are scams, what a scam card reveals - is never part of it: a card looks here as it looks to a player.
 */
const { CASHFLOW_GAME_SETS } = require('./game-sets');

const DECKS = ['opportunity', 'harvest', 'life', 'emergency', 'dream'];

const set = () => CASHFLOW_GAME_SETS.find((entry) => entry.id === 'jfk-stories');

const pick = (source, keys) =>
  Object.fromEntries(
    keys.filter((key) => source[key] !== undefined).map((key) => [key, source[key]]),
  );

function opportunity(card) {
  return {
    id: card.id,
    pile: card.pile,
    title: card.title,
    kind: card.kind ?? 'saving',
    growType: card.growType,
    category: card.category,
    riskScore: card.riskScore,
    costMinor: card.costMinor,
    cashflowMinor: card.cashflowMinor,
    ...pick(card, [
      'rampPaydays',
      'lockedPaydays',
      'contribution',
      'unsellable',
      'sideHustle',
      'stepMinor',
      'monthlyCostMinor',
      'requires',
    ]),
    ...(card.share
      ? {
          share: pick(card.share, [
            'ticker',
            'unitPriceMinor',
            'maxUnits',
            'dividendMonthPerUnitMinor',
            'yieldYearPercent',
          ]),
        }
      : {}),
    ...(card.property
      ? {
          property: pick(card.property, [
            'priceMinor',
            'rentMonthMinor',
            'cashNeededMinor',
            'mortgageMinor',
            'mortgagePaymentMonthMinor',
          ]),
        }
      : {}),
    ...(card.savings ? { savings: card.savings } : {}),
    ...(card.dice ? { dice: card.dice } : {}),
    story: card.story,
    strategy: card.strategy,
    risks: card.risks,
    tip: card.tip,
    links: card.links,
    tasks: (card.actions ?? []).map((action) => action.text),
  };
}

const factorText = (factor) =>
  `${factor >= 1 ? '+' : '-'}${Math.abs(Math.round((factor - 1) * 100))}%`;

/** One sentence for each operation of a Harvest card. */
function harvestOp(op) {
  switch (op.op) {
    case 'index':
      return `moves the markets: ${Object.entries(op.factors)
        .map(([tag, factor]) => `${tag} ${factorText(factor)}`)
        .join(', ')}`;
    case 'indexDice':
      return `a die moves ${op.markets.join(', ')} by ${op.bands
        .map(
          (band) =>
            `${band.from}${band.to > band.from ? `-${band.to}` : ''}: ${typeof band.value === 'number' ? factorText(band.value) : 'roll again'}`,
        )
        .join(', ')}`;
    case 'nextPaydayIndex':
      return 'another move of the markets follows at the next Payday';
    case 'recover':
      return 'every market below its start recovers part of its fall';
    case 'sellWindow':
      return `opens the market for selling: ${op.markets === 'ALL' ? 'every market' : op.markets.join(', ')} (the offer stays open for the table's number of turns)`;
    case 'buyer':
      return `a buyer for ${op.buyer.targets.join(', ')} (${op.buyer.basis}${op.buyer.bands ? `, price by a die: ${op.buyer.bands.map((band) => `${band.from}${band.to > band.from ? `-${band.to}` : ''} x${band.value}`).join(', ')}` : op.buyer.factor ? `, x${op.buyer.factor}` : ''})`;
    case 'cashflowFactor':
    case 'cashflowDice':
      return `changes the monthly cash flow of ${op.groups.join(', ')}${op.paydays ? ` for ${op.paydays} Paydays` : ''}`;
    case 'payoutFactor':
      return `changes the payouts of ${Object.keys(op.factors).join(', ')}`;
    case 'specialPayout':
      return 'a special payout';
    case 'split':
      return `a stock split of ${op.tag}`;
    case 'expensesPercent':
      return `everybody's costs ${op.percent >= 0 ? '+' : ''}${op.percent}%`;
    case 'rentPercent':
      return `rents ${op.percent >= 0 ? '+' : ''}${op.percent}%`;
    case 'expensesAdd':
      return `an extra cost for ${op.paydays} Paydays`;
    case 'savingsRate':
      return 'the interest on savings changes';
    case 'mortgageRate':
      return `mortgage rates ${op.pp >= 0 ? '+' : ''}${op.pp} points`;
    case 'holderDice':
      return `a die for every holder of ${op.targets.join(', ')}`;
    case 'holdingValue':
      return `the price of ${op.targets.join(', ')} changes`;
    case 'ladder':
      return `a hype on ${op.ladder.targets.join(', ')}: stay in while the die wins, cash out before it collapses`;
    case 'penny':
      return `a penny-stock rocket on ${op.ticker}`;
    case 'trapReveal':
      return 'a scam is found out';
    default:
      return op.op;
  }
}

function harvest(card) {
  return {
    id: card.id,
    group: card.group,
    copies: card.copies,
    title: card.title,
    story: card.story,
    realWorld: card.realWorld,
    does: card.ops.map(harvestOp),
    links: card.links,
  };
}

function life(card) {
  return {
    id: card.id,
    type: card.type,
    copies: card.copies,
    title: card.title,
    story: card.story,
    ...pick(card, [
      'requires',
      'effects',
      'effectsByState',
      'accept',
      'dice',
      'optional',
      'give',
      'lend',
    ]),
    ...(card.options
      ? {
          options: card.options.map((option) => ({
            id: option.id,
            label: option.label,
            effect: option.effect,
          })),
        }
      : {}),
  };
}

function plain(card) {
  const { links, ...rest } = card;
  return { ...rest, links };
}

const SUMMARIZE = { opportunity, harvest, life, emergency: plain, dream: plain };

/** The haystack a query is searched in. */
const haystack = (card) =>
  JSON.stringify([
    card.id,
    card.title,
    card.pile,
    card.group,
    card.category,
    card.type,
    card.share?.ticker,
    card.tier,
  ]).toLowerCase();

/**
 * Browses the cards of one Dreamfund pile: `deck`, optional `pile` (opportunity: seed, sapling, tree), `query` (every word must match
 * the id, title, category or ticker), `id` for one card, `limit` (default 25, at most 200).
 */
function browseDreamfundCards({ deck, pile, query, id, limit } = {}) {
  if (!DECKS.includes(deck)) return { error: `deck must be one of ${DECKS.join(', ')}.` };
  const gameSet = set();
  // the cards that find a scam out would name it: they are read when they are drawn, not before
  const hidden = (card) => deck === 'harvest' && card.group === 'traps';
  const cards = (gameSet?.decks?.[deck] ?? []).filter(
    (card) => !hidden(card) && (!pile || card.pile === pile || card.tier === pile),
  );
  const words = String(query ?? '')
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  const found = cards.filter(
    (card) =>
      (id === undefined || card.id.toLowerCase() === String(id).toLowerCase()) &&
      words.every((word) => haystack(card).includes(word)),
  );
  const size = Math.min(Math.max(Number(limit) || 25, 1), 200);
  return {
    deck,
    total: found.length,
    cards: found.slice(0, size).map((card) => SUMMARIZE[deck](card)),
    ...(deck === 'harvest'
      ? {
          note: 'A few more Harvest cards (group traps) find a scam out or close it; they are not listed, so that no offer is given away.',
        }
      : {}),
  };
}

module.exports = { browseDreamfundCards, DREAMFUND_DECKS: DECKS };
