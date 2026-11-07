import { captureShown, reconcileEdit, type ShownBooks } from './dream-edit-reconcile';

const tx = (over: Partial<Record<string, unknown>> = {}) => ({
  account: 'Daily',
  amount: -12.5,
  date: '2026-11-16',
  time: '08:00',
  category: '@Food',
  comment: 'Groceries',
  ...over,
});

const sub = (over: Partial<Record<string, unknown>> = {}) => ({
  title: 'Rent',
  account: 'Daily',
  amount: -800,
  startDate: '2026-11-01',
  endDate: '',
  category: '@Rent',
  comment: '',
  frequency: 'monthly',
  ...over,
});

function shown(): ShownBooks {
  return captureShown(
    {
      allTransactions: [tx(), tx({ account: 'Income', amount: 2833, comment: 'Salary' })],
      allSubscriptions: [sub(), sub({ title: 'Salary', account: 'Income', amount: 2833 })],
      allGrowProjects: [{ title: 'WORLD', phase: 'execute' }],
      allSmileProjects: [
        { title: 'Mountains', phase: 'saving', dream: true },
        { title: 'Trip', phase: 'planning', dreamCardId: 'D12' },
      ],
      allFireEmergencies: [
        { title: 'Reserve', phase: 'saving', reserve: true },
        { title: 'Car repair', phase: 'saving', emergencyCardId: 'E07' },
      ],
    },
    { Miete: 'Rent' },
  );
}

describe('what a player may change by hand at a Dreamer table', () => {
  it('keeps the category, the time and the account of a booking and nothing else', () => {
    const edited = [
      tx({ category: '@Groceries', account: 'Splurge', time: '09:30' }),
      tx({ account: 'Income', amount: 2833, comment: 'Salary' }),
    ];
    expect(reconcileEdit('transactions', edited, shown())).toEqual({
      commands: [
        {
          type: 'edit_transaction',
          index: 0,
          patch: { category: '@Groceries', account: 'Splurge', time: '09:30' },
        },
      ],
      refused: false,
    });
  });

  it('puts back what belongs to the game: an amount, a date, a comment, a deleted booking', () => {
    const base = [tx(), tx({ account: 'Income', amount: 2833, comment: 'Salary' })];
    for (const edit of [{ amount: -1 }, { date: '2027-01-01' }, { comment: 'mine' }]) {
      const worked = reconcileEdit('transactions', [tx(edit), base[1]], shown());
      expect(worked.refused).toBe(true);
      expect(worked.commands).toEqual([]);
    }
    expect(reconcileEdit('transactions', [base[0]], shown()).refused).toBe(true);
  });

  it('says nothing when nothing was changed, and ignores a booking that was only added', () => {
    const same = [tx(), tx({ account: 'Income', amount: 2833, comment: 'Salary' })];
    expect(reconcileEdit('transactions', same, shown())).toEqual({ commands: [], refused: false });
    expect(reconcileEdit('transactions', [...same, tx({ amount: -3 })], shown()).refused).toBe(
      false,
    );
  });

  it('changes the account a payment is paid from, under the title the table knows it by', () => {
    const edited = [
      sub({ account: 'Splurge' }),
      sub({ title: 'Salary', account: 'Income', amount: 2833 }),
    ];
    expect(reconcileEdit('subscriptions', edited, shown())).toEqual({
      commands: [{ type: 'edit_subscription', title: 'Rent', account: 'Splurge' }],
      refused: false,
    });
    const amount = [sub({ amount: -700 }), edited[1]];
    expect(reconcileEdit('subscriptions', amount, shown()).refused).toBe(true);
    expect(reconcileEdit('subscriptions', [edited[1]], shown()).refused).toBe(true);
  });

  it('sets the phase of a Grow, Smile or Fire project by the id the table knows it by', () => {
    expect(reconcileEdit('grow', [{ title: 'WORLD', phase: 'monitor' }], shown()).commands).toEqual(
      [{ type: 'set_phase', kind: 'grow', id: 'WORLD', phase: 'monitor' }],
    );
    expect(
      reconcileEdit(
        'smile',
        [
          { title: 'Mountains', phase: 'idea', dream: true },
          { title: 'Trip', phase: 'idea', dreamCardId: 'D12' },
        ],
        shown(),
      ).commands,
    ).toEqual([
      { type: 'set_phase', kind: 'smile', id: 'life', phase: 'idea' },
      { type: 'set_phase', kind: 'smile', id: 'D12', phase: 'idea' },
    ]);
    expect(
      reconcileEdit(
        'fire',
        [
          { title: 'Reserve', phase: 'ready', reserve: true },
          { title: 'Car repair', phase: 'saving', emergencyCardId: 'E07' },
        ],
        shown(),
      ).commands,
    ).toEqual([{ type: 'set_phase', kind: 'fire', id: 'mojo', phase: 'ready' }]);
  });

  it('knows nothing of a tag that is not an edit', () => {
    expect(reconcileEdit('budget', [], shown())).toEqual({ commands: [], refused: false });
    expect(reconcileEdit('transactions', 'nonsense', shown())).toEqual({
      commands: [],
      refused: false,
    });
  });
});
