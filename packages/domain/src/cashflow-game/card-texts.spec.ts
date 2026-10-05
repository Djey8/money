import * as fs from 'fs';
import * as path from 'path';
import { CLASSIC_DEAL_BIG } from './classic-deal-big';
import { CLASSIC_DEAL_SMALL } from './classic-deal-small';
import { CLASSIC_DOODAD } from './classic-doodad';
import { CLASSIC_MARKET } from './classic-market';
import { BUSINESS_SYMBOLS, PROPERTY_SYMBOLS } from './symbols';

const LANGS = ['de', 'en', 'fr', 'es', 'cn', 'ar'];
const TEXT_DIR = path.join(__dirname, '../../../../src/assets/i18n/cashflow-cards');

/** Catches a card added to the deck without its printed text in every language (todo/cashflow-game.md decision 53). */
describe('Classic Small Deal card texts', () => {
  for (const lang of LANGS) {
    it(`${lang}: every card has a description, and the shared rule line exists`, () => {
      const file = JSON.parse(fs.readFileSync(path.join(TEXT_DIR, `${lang}.json`), 'utf-8'));
      expect(file.shared.shareRule).toBeTruthy();
      expect(file.shared.investmentRule).toBeTruthy();
      const missing = [...CLASSIC_DEAL_SMALL, ...CLASSIC_DEAL_BIG]
        .filter((card) => !file.cards[card.id]?.description)
        .map((card) => card.id);
      expect(missing).toEqual([]);
    });
  }

  for (const lang of LANGS) {
    it(`${lang}: every property type has a label without whitespace (Grow splits its comment on spaces)`, () => {
      const file = JSON.parse(fs.readFileSync(path.join(TEXT_DIR, `${lang}.json`), 'utf-8'));
      const propertySymbols = new Set(
        [...CLASSIC_DEAL_SMALL, ...CLASSIC_DEAL_BIG]
          .filter((card) => card.assetKind !== 'share')
          .map((card) => card.symbol!),
      );
      for (const symbol of propertySymbols) {
        expect(file.symbols?.[symbol]).toBeTruthy();
        expect(file.symbols[symbol]).not.toMatch(/\s/);
      }
    });
  }

  for (const lang of LANGS) {
    it(`${lang}: every dice card has its win and its miss text`, () => {
      const file = JSON.parse(fs.readFileSync(path.join(TEXT_DIR, `${lang}.json`), 'utf-8'));
      const dice = [...CLASSIC_DEAL_SMALL, ...CLASSIC_DEAL_BIG].filter((card) => card.successOn);
      expect(dice.length).toBeGreaterThan(0);
      for (const card of dice) {
        expect(file.cards[card.id]?.success).toBeTruthy();
        expect(file.cards[card.id]?.failure).toBeTruthy();
      }
    });
  }

  for (const lang of LANGS) {
    it(`${lang}: every card type in the piles has a name for the type filter`, () => {
      const file = JSON.parse(fs.readFileSync(path.join(TEXT_DIR, `${lang}.json`), 'utf-8'));
      const families = new Set(
        [...CLASSIC_DEAL_SMALL, ...CLASSIC_DEAL_BIG]
          .filter((card) => card.assetKind !== 'share')
          .map((card) => card.symbol!.replace(/\d+$/, '')),
      );
      for (const family of families) {
        expect(file.families?.[family]).toBeTruthy();
      }
    });
  }
});

/** The red Schnickschnack pile: a title and a light-hearted comment per card, and a category name per group, in every language. */
describe('Classic Doodad card texts', () => {
  it('suggests Smile or Splurge only, and uses both', () => {
    const accounts = new Set(CLASSIC_DOODAD.map((card) => card.account));
    expect([...accounts].sort()).toEqual(['Smile', 'Splurge']);
  });

  it('keeps big treats on Smile and the smallest on Splurge', () => {
    for (const card of CLASSIC_DOODAD) {
      if (card.costMinor >= 300000) expect(card.account).toBe('Smile');
      if (card.costMinor <= 50000) expect(card.account).toBe('Splurge');
    }
  });

  for (const lang of LANGS) {
    it(`${lang}: every card has a title and a comment, and every group a category name`, () => {
      const file = JSON.parse(fs.readFileSync(path.join(TEXT_DIR, `${lang}.json`), 'utf-8'));
      for (const card of CLASSIC_DOODAD) {
        expect(file.cards[card.id]?.title).toBeTruthy();
        expect(file.cards[card.id]?.comment).toBeTruthy();
        expect(file.doodadGroups?.[card.group!]).toBeTruthy();
      }
      expect(file.shared.doodadLoanHint).toBeTruthy();
      expect(file.shared.doodadChildHint).toBeTruthy();
      expect(file.shared.doodadLoanChildHint).toBeTruthy();
    });
  }
});

/** The blue Market pile: a title and the printed text per card, in every language. */
describe('Classic Market card texts', () => {
  for (const lang of LANGS) {
    it(`${lang}: every buyer card has a title and a text that names its offer`, () => {
      const file = JSON.parse(fs.readFileSync(path.join(TEXT_DIR, `${lang}.json`), 'utf-8'));
      for (const card of CLASSIC_MARKET) {
        expect(file.cards[card.id]?.title).toBeTruthy();
        const text: string = file.cards[card.id]?.description;
        expect(text).toBeTruthy();
        expect(text).not.toContain('{o}');
        if (card.pays || card.splits || card.boost) continue;
        const sells = card.sells!;
        const amount =
          (sells.plusMinor ??
            sells.priceMinor ??
            sells.pricePerUnitMinor ??
            sells.pricePerCoinMinor ??
            0) / 100;
        const grouped = amount.toLocaleString('en-US');
        if (sells.plusPercent) {
          expect(text).toContain(`${sells.plusPercent}%`);
        } else {
          // the amount in the language's own grouping: 65.000 / 65,000 / 65 000
          expect(
            [grouped, grouped.replace(/,/g, '.'), grouped.replace(/,/g, ' ')].some((v) =>
              text.includes(v),
            ),
          ).toBe(true);
        }
      }
    });
  }

  it('has the apartment and multi-family buyers: four percentages and six fixed amounts', () => {
    const apartments = CLASSIC_MARKET.filter((card) => card.sells?.family === 'MFH');
    expect(apartments).toHaveLength(10);
    expect(apartments.filter((card) => card.sells?.plusMinor)).toHaveLength(6);
    expect(apartments.filter((card) => card.sells?.plusPercent)).toHaveLength(4);
  });

  it('has a buyer for the single-family home (EFH), five by percentage and four by amount', () => {
    expect(CLASSIC_MARKET.filter((card) => card.sells?.family === 'EFH')).toHaveLength(9);
    expect(CLASSIC_MARKET).toHaveLength(39);
  });

  it('has two condo buyers (a fixed price) and four apartment-complex buyers (a price per unit)', () => {
    expect(CLASSIC_MARKET.filter((card) => card.sells?.priceMinor)).toHaveLength(2);
    const complexes = CLASSIC_MARKET.filter((card) => card.sells?.pricePerUnitMinor);
    expect(complexes).toHaveLength(4);
    expect(complexes.every((card) => card.sells!.symbols!.every((s) => s.startsWith('APH')))).toBe(
      true,
    );
  });

  for (const lang of LANGS) {
    it(`${lang}: the cost cards have a title, the printed text and a "what happened" comment`, () => {
      const file = JSON.parse(fs.readFileSync(path.join(TEXT_DIR, `${lang}.json`), 'utf-8'));
      const costs = CLASSIC_MARKET.filter((card) => card.pays);
      expect(costs).toHaveLength(5);
      for (const card of costs) {
        expect(file.cards[card.id]?.title).toBeTruthy();
        expect(file.cards[card.id]?.description).toBeTruthy();
        expect(file.cards[card.id]?.comment).toContain('{property}');
      }
    });
  }

  it('counts real estate of every type as a property, and no business', () => {
    expect(PROPERTY_SYMBOLS).toEqual([
      'EFH',
      'ETW',
      'MFH4',
      'MFH8',
      'DH',
      'APH12',
      'APH24',
      'APH60',
    ]);
  });

  for (const lang of LANGS) {
    it(`${lang}: the split and boost cards have a title and a text without placeholders`, () => {
      const file = JSON.parse(fs.readFileSync(path.join(TEXT_DIR, `${lang}.json`), 'utf-8'));
      for (const card of CLASSIC_MARKET.filter((c) => c.splits || c.boost)) {
        const text: string = file.cards[card.id]?.description;
        expect(file.cards[card.id]?.title).toBeTruthy();
        expect(text).toBeTruthy();
        expect(text).not.toMatch(/\{[a-z]\}/);
        if (card.splits) expect(text).toContain(card.splits.symbol);
      }
    });
  }

  it('has a split card for each of the four tickers, and two star boosts', () => {
    expect(CLASSIC_MARKET.filter((card) => card.splits).map((card) => card.splits!.symbol)).toEqual(
      ['OK4U', 'MYT4U', 'GRO4US', 'ON2U'],
    );
    const boosts = CLASSIC_MARKET.filter((card) => card.boost);
    expect(
      boosts.map((card) => [card.boost!.maxCashflowMinor / 100, card.boost!.addMinor / 100]),
    ).toEqual([
      [1000, 250],
      [2000, 400],
    ]);
    expect(boosts.every((card) => card.star)).toBe(true);
    expect(BUSINESS_SYMBOLS).toEqual(['PIZZA', 'GP', 'AU', 'AWA']);
  });
});
