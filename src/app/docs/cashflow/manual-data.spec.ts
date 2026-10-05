import { CASHFLOW_GAME_SETS } from '../../shared/cashflow-content';
import { buildManualTable, MANUAL_DATA_IDS, type ManualContext } from './manual-data';

/** Every label answers with its own name, so a test can tell which column or row it is looking at. */
const ctx: ManualContext = {
  labels: new Proxy({} as Record<string, string>, { get: (_target, key) => String(key) }),
  money: (minor) => `${minor / 100}€`,
  percent: (ratio) => `${Math.round(ratio * 100)}%`,
  number: (value) => String(value),
  professionTitle: (profession) => profession.title,
  groupName: (group) => group,
  familyName: (family) => family,
};

const classic = CASHFLOW_GAME_SETS.find((set) => set.id === 'cashflow')!;
const cell = (rows: string[][], first: string, column: number) =>
  rows.find((row) => row[0] === first)![column];

describe('Cashflow manual - numbers read from the real card catalog', () => {
  it('builds every table without a missing label or an empty result', () => {
    for (const id of MANUAL_DATA_IDS) {
      const table = buildManualTable(id, ctx);
      expect(table.head.length).toBeGreaterThan(1);
      expect(table.rows.length).toBeGreaterThan(0);
      for (const row of table.rows) expect(row).toHaveLength(table.head.length);
      for (const text of [...table.head, ...table.rows.flat()]) {
        expect(text).not.toContain('undefined');
        expect(text).not.toContain('NaN');
      }
    }
  });

  it('lists all 15 playable professions, best monthly cashflow first', () => {
    const { rows } = buildManualTable('professions', ctx);

    expect(rows).toHaveLength(15);
    expect(rows[0][0]).toBe('Arzt/Ärztin'); // 13.200 - 8.300
    expect(cell(rows, 'Hausmeister/in', 3)).toBe('600€'); // 1.600 salary - 1.000 expenses
    expect(cell(rows, 'Softwareentwickler/in (customMark)', 1)).toBe('5000€');
  });

  it("tells how many average deals it takes to cover a profession's expenses", () => {
    const { rows } = buildManualTable('escape', ctx);

    expect(rows).toHaveLength(15);
    expect(cell(rows, 'Hausmeister/in', 1)).toBe('1000€');
    // the smallest expenses need the fewest deals; the doctor's 8.300 the most
    const bigDeals = (name: string) => Number(cell(rows, name, 3));
    expect(bigDeals('Hausmeister/in')).toBeLessThan(bigDeals('Arzt/Ärztin'));
    expect(Number(cell(rows, 'Hausmeister/in', 2))).toBeGreaterThan(bigDeals('Hausmeister/in'));
  });

  it('groups the Small and Big Deal properties by type, with the real card counts', () => {
    const small = buildManualTable('smallProperties', ctx).rows;
    expect(small.map((row) => [row[0], row[1]])).toEqual([
      ['EFH', '7'],
      ['ETW', '4'],
    ]);
    expect(cell(small, 'EFH', 6)).toBe('1'); // one single-family home pays nothing

    const big = buildManualTable('bigProperties', ctx).rows;
    expect(big.map((row) => row[0]).sort()).toEqual(
      ['APH', 'AU', 'AWA', 'DH', 'EFH', 'GP', 'MFH', 'PIZZA'].sort(),
    );
    expect(cell(big, 'MFH', 1)).toBe('10');
    expect(cell(big, 'PIZZA', 3)).toBe('100000€');
  });

  it('shows which property types can pay for their own bank loan (10% a month of the deposit)', () => {
    const { rows } = buildManualTable('loanProof', ctx);
    // a small single-family home pays 250 on a 2.000 deposit = 12,5% a month
    expect(cell(rows, 'EFH', 1).split(' / ')[0]).not.toBe('0');
    // a Big Deal business partner never reaches 10% a month on its deposit
    expect(cell(rows, 'GP', 1).startsWith('0 /')).toBe(true);
  });

  it('lists the four tickers with five prices each', () => {
    const { rows } = buildManualTable('shares', ctx);

    expect(rows.map((row) => row[0])).toEqual(['OK4U', 'ON2U', 'MYT4U', 'GRO4US']);
    expect(rows.every((row) => row[2].split(' / ').length === 5)).toBe(true);
    expect(cell(rows, 'GRO4US', 1)).toBe('kindFund');
  });

  it('covers every Doodad exactly once across its categories', () => {
    const { rows } = buildManualTable('doodads', ctx);
    const total = rows.reduce((sum, row) => sum + Number(row[1]), 0);

    expect(total).toBe(classic.decks!.doodad!.length);
    expect(rows.reduce((sum, row) => sum + Number(row[2]) + Number(row[3]), 0)).toBe(total);
  });

  it('gives the odds of each draw, which add up to the whole pile', () => {
    const { rows } = buildManualTable('pileOdds', ctx);
    const pile = (name: string) =>
      rows.filter((row) => row[0] === name).reduce((sum, row) => sum + Number(row[2]), 0);

    expect(pile('pileSmall')).toBe(classic.decks!.dealSmall!.length);
    expect(pile('pileBig')).toBe(classic.decks!.dealBig!.length);
    expect(rows.find((row) => row[1] === 'cat_shares')![2]).toBe('20');
  });

  it('counts the Market pile by kind and by what you own', () => {
    const kinds = buildManualTable('marketKinds', ctx).rows;
    expect(kinds.reduce((sum, row) => sum + Number(row[1]), 0)).toBe(classic.decks!.market!.length);

    const odds = buildManualTable('marketOdds', ctx).rows;
    // single-family home: 9 buyers + 5 repair costs + 2 cashflow boosts
    expect(cell(odds, 'profile_EFH', 1)).toBe('16');
    // a semi-detached house has no buyer card at all, only the costs and the boosts
    expect(cell(odds, 'profile_DH', 1)).toBe('7');
    expect(cell(odds, 'profile_GOLD', 1)).toBe('3');
  });
});
