import type { CashflowGameSet } from './types';

/**
 * The card reference (JFK, 2026-10-07): every card of every deck, readable without playing it - for the player in the
 * manual, for an agent in `docs/domain/CASHFLOW_CARDS.md`. The History names a picked card by its id, so this is where
 * an id turns back into a card. One function builds the rows, so the page, the document and the API cannot disagree.
 */

export type ReferenceDeck = 'dealSmall' | 'dealBig' | 'market' | 'doodad';

export const REFERENCE_DECKS: ReferenceDeck[] = ['dealSmall', 'dealBig', 'market', 'doodad'];

export interface CardReferenceRow {
  id: string;
  deck: ReferenceDeck;
  /** The ticker or short name printed on the card (SFH, OK4U), when it has one. */
  label: string;
  /** The card's title in the language the texts are in. */
  title: string;
  /** What kind of card it is: share, property, special asset, doodad, buyer, cost, boom, split... */
  kind: string;
  /** The card's numbers, as short phrases ("deposit 5.000 €", "cashflow 160 €/month"). */
  facts: string[];
  /** What the card says (market cards: the whole rule), when the texts have it. */
  description: string;
}

export interface CardReferenceDeps {
  /** The card's printed title and description in a language (empty when there are none). */
  textFor: (cardId: string) => { title?: string; description?: string };
  /** The ticker as the game's language writes it (EFH -> SFH). */
  symbolFor: (symbol: string | undefined) => string | undefined;
  /** An amount in minor units, formatted. */
  money: (amountMinor: number) => string;
}

type AnyCard = Record<string, unknown> & { id: string; title: string };

const num = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined;

function dealFacts(card: AnyCard, money: (minor: number) => string): string[] {
  const facts: string[] = [];
  const price = num(card.priceMinor);
  const min = num(card.rangeMinMinor);
  const max = num(card.rangeMaxMinor);
  const deposit = num(card.depositMinor);
  const mortgage = num(card.mortgageMinor);
  const cashflow = num(card.cashflowMinor);
  const cost = num(card.costMinor);
  if (price !== undefined) facts.push(`price ${money(price)}`);
  if (min !== undefined && max !== undefined) facts.push(`range ${money(min)} to ${money(max)}`);
  if (deposit !== undefined) facts.push(`deposit ${money(deposit)}`);
  if (mortgage !== undefined) facts.push(`mortgage ${money(mortgage)}`);
  if (cashflow !== undefined) facts.push(`cashflow ${money(cashflow)} a month`);
  if (deposit && cashflow !== undefined) {
    facts.push(`${Math.round((cashflow / deposit) * 1000) / 10}% a month on the deposit`);
  }
  if (cost !== undefined) facts.push(`cost ${money(cost)}`);
  const quantity = num(card.quantity);
  if (quantity !== undefined) facts.push(`${quantity} units`);
  const payout = num(card.payoutMinor);
  if (payout !== undefined) facts.push(`pays ${money(payout)}`);
  const successOn = num(card.successOn);
  if (successOn !== undefined) facts.push(`a die roll of ${successOn} or more wins`);
  if (card.recurring === true) facts.push('pays again every month it wins');
  if (card.superDeal === true) facts.push('super deal');
  return facts;
}

function dealKind(card: AnyCard): string {
  if (card.assetKind === 'share') return card.securityKind === 'stock' ? 'stock' : 'share';
  if (card.assetKind === 'investment') return 'property or business';
  if (card.assetKind === 'asset') return 'special asset';
  return String(card.assetKind ?? 'deal');
}

function marketRow(card: AnyCard, deps: CardReferenceDeps): { kind: string; facts: string[] } {
  const { money, symbolFor } = deps;
  const sells = card.sells as Record<string, unknown> | undefined;
  if (sells) {
    const facts: string[] = [];
    const symbols = Array.isArray(sells.symbols) ? (sells.symbols as string[]) : [];
    const family = typeof sells.family === 'string' ? sells.family : '';
    facts.push(
      `buys ${(symbols.length > 0 ? symbols : [family]).map((s) => symbolFor(s) ?? s).join(', ')}`,
    );
    const percent = num(sells.plusPercent);
    const plus = num(sells.plusMinor);
    const price = num(sells.priceMinor);
    const perUnit = num(sells.pricePerUnitMinor);
    const perCoin = num(sells.pricePerCoinMinor);
    if (percent !== undefined) facts.push(`offers the original price +${percent}%`);
    if (plus !== undefined) facts.push(`offers the original price +${money(plus)}`);
    if (price !== undefined) facts.push(`offers ${money(price)}`);
    if (perUnit !== undefined) facts.push(`offers ${money(perUnit)} for every unit`);
    if (perCoin !== undefined) facts.push(`offers ${money(perCoin)} for every coin`);
    return { kind: 'buyer', facts };
  }
  const pays = card.pays as { costMinor?: number } | undefined;
  if (pays) {
    return { kind: 'cost', facts: pays.costMinor ? [`you pay ${money(pays.costMinor)}`] : [] };
  }
  const splits = card.splits as { symbol?: string } | undefined;
  if (splits) {
    return { kind: 'stock split', facts: [`${symbolFor(splits.symbol) ?? splits.symbol ?? ''}`] };
  }
  const boost = card.boost as { maxCashflowMinor?: number; addMinor?: number } | undefined;
  if (boost) {
    const facts: string[] = [];
    if (boost.addMinor !== undefined) facts.push(`adds ${money(boost.addMinor)} a month`);
    if (boost.maxCashflowMinor !== undefined) {
      facts.push(`to a business paying at most ${money(boost.maxCashflowMinor)} a month`);
    }
    return { kind: 'boom', facts };
  }
  return { kind: 'other', facts: [] };
}

/** Every card of one deck as reference rows, in the deck's own order. */
export function cardReferenceRows(
  gameSet: CashflowGameSet | undefined,
  deck: ReferenceDeck,
  deps: CardReferenceDeps,
): CardReferenceRow[] {
  const cards = (gameSet?.decks?.[deck] ?? []) as unknown as AnyCard[];
  return cards.map((card) => {
    const text = deps.textFor(card.id);
    const symbol = typeof card.symbol === 'string' ? card.symbol : undefined;
    const base = {
      id: card.id,
      deck,
      label: deps.symbolFor(symbol) ?? '',
      title: text.title || card.title,
      description: text.description ?? '',
    };
    if (deck === 'dealSmall' || deck === 'dealBig') {
      return { ...base, kind: dealKind(card), facts: dealFacts(card, deps.money) };
    }
    if (deck === 'doodad') {
      const cost = num(card.costMinor);
      return {
        ...base,
        kind: 'doodad',
        facts: [
          ...(cost !== undefined ? [`cost ${deps.money(cost)}`] : []),
          ...(typeof card.account === 'string' ? [`paid from ${card.account}`] : []),
        ],
      };
    }
    return { ...base, ...marketRow(card, deps) };
  });
}

const DECK_HEADINGS: Record<ReferenceDeck, string> = {
  dealSmall: 'Small Deals (`dealSmall`)',
  dealBig: 'Big Deals (`dealBig`)',
  market: 'Market (`market`)',
  doodad: 'Doodads (`doodad`)',
};

const cell = (value: string): string => value.replace(/\|/g, '/').replace(/\s+/g, ' ').trim();

/**
 * The reference as a Markdown document (`docs/domain/CASHFLOW_CARDS.md`, generated by `scripts/card-reference.js`). A spec
 * keeps the file equal to the cards, so it can never describe a card that is gone or miss one that was added.
 */
export function renderCardReferenceMarkdown(
  gameSetId: string,
  decks: Record<ReferenceDeck, CardReferenceRow[]>,
): string {
  const lines: string[] = [
    '# Cashflow card reference',
    '',
    "<!-- Generated by `node scripts/card-reference.js` from the game set's decks - do not edit by hand. -->",
    '',
    `Every card of the \`${gameSetId}\` game set, by deck. The game's History names a picked card by its **id** (a \`cardPicked\` step carries \`cardId\` and \`deck\`; a passed card's \`skipCard\` line carries the same \`cardId\`), so this is where an id turns back into a card - what was passed on, and what it was worth. The same list is available from the API without a running game: \`GET /api/v1/game/cards?deck=dealSmall&gameSetId=${gameSetId}&limit=200\`, and the in-app manual shows it as the card reference.`,
    '',
    'Amounts are in euros. Titles and texts are the English ones.',
    '',
  ];
  for (const deck of REFERENCE_DECKS) {
    const rows = decks[deck];
    lines.push(`## ${DECK_HEADINGS[deck]} - ${rows.length} cards`, '');
    lines.push('| id | label | title | kind | numbers |', '| --- | --- | --- | --- | --- |');
    for (const row of rows) {
      lines.push(
        `| \`${row.id}\` | ${cell(row.label)} | ${cell(row.title)} | ${cell(row.kind)} | ${cell(row.facts.join('; '))} |`,
      );
    }
    lines.push('');
  }
  return lines.join('\n');
}
