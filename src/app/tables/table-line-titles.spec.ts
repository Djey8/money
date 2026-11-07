import type { GameBooks } from '@money/domain';
import { shownDebtTags, withShownLineTitles } from './table-line-titles';

const books = {
  state: {
    gameSubscriptionTitles: ['Gehalt', 'Miete'],
    lineTitles: { rent: 'Miete' },
    insurance: { active: [], premiums: { household: 'Hausratversicherung' }, pending: [] },
  },
  subscriptions: [
    { title: 'Miete', category: '@Miete', amountMinor: -80000 },
    { title: 'Gehalt', category: '@Gehalt', amountMinor: 283300 },
  ],
  transactions: [{ category: '@Miete' }, { category: '@Mojo' }],
  liabilities: [{ tag: 'Eltern-Darlehen', amountMinor: 150000, investment: false }],
} as unknown as GameBooks;

describe('withShownLineTitles', () => {
  const words: Record<string, string> = {
    'CashflowGame.expenseLine.rent': 'Rent',
    'CashflowGame.liabilityTag.parentsLoan': 'Loan from parents',
  };
  const translate = (key: string) => words[key] ?? null;

  it('shows the lines the card names by key in the language of the screen, everywhere they appear', () => {
    const shown = withShownLineTitles(books, translate, [
      { tag: 'Eltern-Darlehen', key: 'parentsLoan' },
    ]);
    expect(shown.liabilities[0].tag).toBe('Loan from parents');
    expect(shown.state.gameSubscriptionTitles).toEqual(['Gehalt', 'Rent']);
    expect(shown.state.lineTitles).toEqual({ rent: 'Rent' });
    expect(shown.subscriptions.map((sub) => [sub.title, sub.category])).toEqual([
      ['Rent', '@Rent'],
      ['Gehalt', '@Gehalt'],
    ]);
    expect(shown.transactions.map((t) => t.category)).toEqual(['@Rent', '@Mojo']);
  });

  it('leaves the books alone when nothing is to be translated', () => {
    expect(withShownLineTitles(books, () => null)).toBe(books);
  });

  it('knows a debt by the word it is shown with and by the tag of the table', () => {
    const map = shownDebtTags([{ tag: 'Eltern-Darlehen', key: 'parentsLoan' }], translate);
    expect(map.get('Loan from parents')).toBe('Eltern-Darlehen');
  });
});
