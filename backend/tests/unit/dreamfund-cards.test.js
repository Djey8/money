'use strict';

const { browseDreamfundCards, DREAMFUND_DECKS } = require('../../services/dreamfund-cards');

describe('the printed cards of the Dreamfund game for an agent (JFK, 2026-11-06)', () => {
  it('lists every pile', () => {
    expect(DREAMFUND_DECKS).toEqual(['opportunity', 'harvest', 'life', 'emergency', 'dream']);
    for (const deck of DREAMFUND_DECKS) {
      const result = browseDreamfundCards({ deck, limit: 5 });
      expect(result.total).toBeGreaterThan(40);
      expect(result.cards).toHaveLength(5);
    }
    expect(browseDreamfundCards({ deck: 'nothing' }).error).toMatch(/deck must be one of/);
  });

  it('finds the Opportunity cards by pile and by word, with what each does', () => {
    const seed = browseDreamfundCards({ deck: 'opportunity', pile: 'seed', limit: 200 });
    expect(seed.cards.every((card) => card.pile === 'seed')).toBe(true);
    const pensions = browseDreamfundCards({ deck: 'opportunity', query: 'pension' });
    expect(pensions.cards.map((card) => card.id)).toEqual(['S38', 'S39', 'P33', 'T32']);
    expect(pensions.cards[0].contribution).toEqual({
      monthlyMinor: 8000,
      paydays: 12,
      bonusPercent: 20,
    });
    const course = browseDreamfundCards({ deck: 'opportunity', id: 's40' }).cards[0];
    expect(course).toMatchObject({ id: 'S40', unsellable: true, rampPaydays: 3 });
    expect(course.tip).toMatch(/Do:/);
    expect(course.links.length).toBeGreaterThanOrEqual(2);
  });

  it('never tells which offers are scams: they look like any other card', () => {
    const all = browseDreamfundCards({ deck: 'opportunity', limit: 200 });
    expect(JSON.stringify(all)).not.toMatch(/"trap"|ponzi|trueCategory|collapseAfter/);
    const scam = browseDreamfundCards({ deck: 'opportunity', id: 'S21' }).cards[0];
    expect(scam.cashflowMinor).toBeGreaterThan(0);
  });

  it('says in a sentence what a Harvest card does, and does not list the cards that find a scam out', () => {
    const buyer = browseDreamfundCards({ deck: 'harvest', id: 'H95' }).cards[0];
    expect(buyer.does[0]).toMatch(/a buyer for ONLINE/);
    const rally = browseDreamfundCards({ deck: 'harvest', id: 'H107' }).cards[0];
    expect(rally.does.join(' ')).toMatch(/opens the market for selling/);
    const all = browseDreamfundCards({ deck: 'harvest', limit: 200 });
    expect(all.cards.some((card) => card.group === 'traps')).toBe(false);
    expect(all.note).toMatch(/not listed/);
    expect(JSON.stringify(all)).not.toMatch(
      /Timeshare Exit|Raid on a Call|Withdrawals Frozen|Liquidity Pulled|Trading Halted|Resale Agency|Course Seller/,
    );
  });

  it('has the windfalls among the Life cards', () => {
    const life = browseDreamfundCards({ deck: 'life', query: 'inheritance' });
    expect(life.cards.map((card) => card.id)).toContain('L77');
  });
});
