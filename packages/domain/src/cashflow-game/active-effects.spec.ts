import { activeEffects, effectsMonthlyMinor } from './active-effects';

describe('what is working on the account', () => {
  it('lists the costs that run for some Paydays, the pauses and what is for good, the soonest end first', () => {
    const effects = activeEffects(
      {
        lifeLines: [
          {
            id: 'a',
            cardId: 'L07',
            title: { en: 'A parent needs help', de: 'Hilfe' },
            amountMinor: -15000,
            paydaysLeft: 4,
          },
          {
            id: 'b',
            cardId: 'L21',
            title: { en: 'Lifestyle creep', de: 'Lebensstil' },
            amountMinor: -8000,
          },
        ],
        marketEffects: [{ title: 'Repair wave', paydaysLeft: 2, expensesMinor: 3000 }],
        expensesPercentTotal: 5,
        holdings: [
          {
            cardId: 'P15',
            title: 'Snack Vending Machine',
            cashflowMinor: 100000,
            noCashflowLeft: 1,
            temp: [{ factor: 0.5, paydaysLeft: 3 }],
          },
        ],
      } as never,
      'en',
    );
    expect(effects.map((effect) => [effect.kind, effect.paydaysLeft])).toEqual([
      ['pause', 1],
      ['market', 2],
      ['holding', 3],
      ['life', 4],
      ['permanent', undefined],
      ['permanent', undefined],
    ]);
    expect(effects[0]).toMatchObject({ amountMinor: -100000, tone: 'bad' });
    const sums = effectsMonthlyMinor(effects);
    expect(sums.costMinor).toBeLessThan(0);
    expect(sums.gainMinor).toBe(0);
  });

  it('is empty when nothing runs', () => {
    expect(activeEffects({} as never, 'de')).toEqual([]);
  });

  it('shows the lines of one card that run the same time as one effect, the amounts added', () => {
    const effects = activeEffects(
      {
        lifeLines: [
          {
            id: 'L16:incomePercent',
            cardId: 'L16',
            title: { en: 'Job Offer', de: 'Jobangebot' },
            amountMinor: 13916,
          },
          {
            id: 'L16:expensesPercent',
            cardId: 'L16',
            title: { en: 'Job Offer', de: 'Jobangebot' },
            amountMinor: 12415,
          },
        ],
      } as never,
      'en',
    );
    expect(effects).toHaveLength(1);
    expect(effects[0]).toMatchObject({ title: 'Job Offer', amountMinor: 26331, tone: 'good' });
  });
});
