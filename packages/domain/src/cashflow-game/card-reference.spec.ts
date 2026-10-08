import * as fs from 'fs';
import * as path from 'path';
import { CASHFLOW_GAME_SETS } from '../cashflow-content';
import {
  REFERENCE_DECKS,
  cardReferenceRows,
  renderCardReferenceMarkdown,
  type CardReferenceDeps,
  type ReferenceDeck,
} from './card-reference';

const root = path.join(__dirname, '..', '..', '..', '..');
const texts = JSON.parse(
  fs.readFileSync(path.join(root, 'src/assets/i18n/cashflow-cards/en.json'), 'utf8'),
);
const money = (minor: number) =>
  `${(minor / 100).toLocaleString('en-US', { maximumFractionDigits: 2 })} €`;
const deps: CardReferenceDeps = {
  textFor: (id) => texts.cards?.[id] ?? {},
  symbolFor: (symbol) => (symbol ? (texts.symbols?.[symbol] ?? symbol) : undefined),
  money,
};
const gameSet = CASHFLOW_GAME_SETS.find((candidate) => candidate.id === 'cashflow')!;

describe('cardReferenceRows', () => {
  it('lists every card of every deck once, with its id', () => {
    for (const deck of REFERENCE_DECKS) {
      const rows = cardReferenceRows(gameSet, deck, deps);
      expect(rows).toHaveLength(gameSet.decks![deck]!.length);
      expect(new Set(rows.map((row) => row.id)).size).toBe(rows.length);
    }
  });

  it('describes a property by its numbers and what it returns a month', () => {
    const row = cardReferenceRows(gameSet, 'dealBig', deps).find(
      (candidate) => candidate.id === 'classic-big-pizza',
    )!;
    expect(row.kind).toBe('property or business');
    expect(row.facts).toEqual(
      expect.arrayContaining(['deposit 100,000 €', 'cashflow 5,000 € a month']),
    );
  });

  it('describes a buyer by what it buys and offers', () => {
    const row = cardReferenceRows(gameSet, 'market', deps).find(
      (candidate) => candidate.id === 'classic-market-efh-pct20-a',
    )!;
    expect(row.kind).toBe('buyer');
    expect(row.facts.join(' ')).toContain('+20%');
  });
});

describe('docs/domain/CASHFLOW_CARDS.md', () => {
  it('is the generated reference of the cards (run: node scripts/card-reference.js)', () => {
    const decks = Object.fromEntries(
      REFERENCE_DECKS.map((deck) => [deck, cardReferenceRows(gameSet, deck, deps)]),
    ) as Record<ReferenceDeck, ReturnType<typeof cardReferenceRows>>;
    const expected = renderCardReferenceMarkdown('cashflow', decks);
    const actual = fs
      .readFileSync(path.join(root, 'docs/domain/CASHFLOW_CARDS.md'), 'utf8')
      .replace(/\r\n/g, '\n');
    expect(actual).toBe(expected);
  });
});
