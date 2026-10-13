import {
  generateDueTransfers,
  reconcileGeneratedTransfers,
  recurringTransferComment,
  RecurringTransferRule,
  TransferLike,
} from './recurring-transfers';

const NOW = new Date('2026-04-15');

const shared: RecurringTransferRule = {
  title: 'Shared account',
  fromLocationId: 'loc_main',
  toLocationId: 'loc_shared',
  amountMinor: 5000,
  startDate: '2026-03-23',
  endDate: null,
  comment: '',
  frequency: 'weekly',
};

const asTransfers = (rule: RecurringTransferRule, now = NOW): TransferLike[] =>
  generateDueTransfers([rule], [], now).map((t) => ({ ...t }));

describe('generateDueTransfers', () => {
  it('creates one transfer per due occurrence, in the right direction, with the generated comment', () => {
    const due = generateDueTransfers([shared], [], NOW);
    // weekly from Mon 2026-03-23: 23.03, 30.03, 06.04, 13.04
    expect(due.map((t) => t.date)).toEqual([
      '2026-03-23',
      '2026-03-30',
      '2026-04-06',
      '2026-04-13',
    ]);
    for (const t of due) {
      expect(t).toMatchObject({
        fromLocationId: 'loc_main',
        toLocationId: 'loc_shared',
        amountMinor: 5000,
        comment: 'Shared account',
      });
    }
  });

  it('does not create what already exists, so running it twice adds nothing', () => {
    const first = generateDueTransfers([shared], [], NOW);
    expect(generateDueTransfers([shared], first, NOW)).toEqual([]);
  });

  it('adds only the missing occurrences', () => {
    const first = generateDueTransfers([shared], [], NOW);
    const later = generateDueTransfers([shared], first, new Date('2026-04-28'));
    expect(later.map((t) => t.date)).toEqual(['2026-04-20', '2026-04-27']);
  });

  it('respects the end date and an unstarted rule', () => {
    expect(
      generateDueTransfers([{ ...shared, endDate: '2026-03-31' }], [], NOW).map((t) => t.date),
    ).toEqual(['2026-03-23', '2026-03-30']);
    expect(generateDueTransfers([{ ...shared, startDate: '2026-05-01' }], [], NOW)).toEqual([]);
  });

  it('works for monthly rules too', () => {
    const monthly = { ...shared, frequency: 'monthly' as const, startDate: '2026-01-10' };
    expect(generateDueTransfers([monthly], [], NOW).map((t) => t.date)).toEqual([
      '2026-01-10',
      '2026-02-10',
      '2026-03-10',
      '2026-04-10',
    ]);
  });

  it('a transfer made by hand that merely looks alike is not mistaken for a generated one', () => {
    const byHand: TransferLike = {
      fromLocationId: 'loc_main',
      toLocationId: 'loc_shared',
      amountMinor: 5000,
      date: '2026-03-23',
      time: '10:00',
      comment: 'birthday gift',
    };
    expect(generateDueTransfers([shared], [byHand], NOW)).toHaveLength(4);
  });

  it('the comment of a rule with its own comment is "title + comment"', () => {
    expect(recurringTransferComment({ title: 'Shared', comment: 'rent share' })).toBe(
      'Shared + rent share',
    );
    const due = generateDueTransfers([{ ...shared, comment: 'rent share' }], [], NOW);
    expect(due[0].comment).toBe('Shared account + rent share');
  });
});

describe('reconcileGeneratedTransfers', () => {
  it('changes the generated transfers in place when the amount changes', () => {
    const generated = asTransfers(shared);
    const { updates, removals } = reconcileGeneratedTransfers(
      shared,
      { ...shared, amountMinor: 7500 },
      generated,
      NOW,
    );
    expect(removals).toEqual([]);
    expect(updates).toHaveLength(4);
    expect(updates.every((u) => u.amountMinor === 7500)).toBe(true);
    expect(updates.map((u) => u.index)).toEqual([0, 1, 2, 3]);
  });

  it('follows a changed destination', () => {
    const generated = asTransfers(shared);
    const { updates } = reconcileGeneratedTransfers(
      shared,
      { ...shared, toLocationId: 'loc_other' },
      generated,
      NOW,
    );
    expect(
      updates.every((u) => u.toLocationId === 'loc_other' && u.fromLocationId === 'loc_main'),
    ).toBe(true);
  });

  it('removes only the transfers after an end date moved into the past', () => {
    const generated = asTransfers(shared);
    const { updates, removals } = reconcileGeneratedTransfers(
      shared,
      { ...shared, endDate: '2026-03-31' },
      generated,
      NOW,
    );
    expect(updates).toEqual([]);
    expect(removals).toEqual([2, 3]);
  });

  it('removes everything it generated when deleted, never a transfer made by hand', () => {
    const generated = asTransfers(shared);
    const byHand: TransferLike = { ...generated[0], comment: 'birthday gift' };
    const { removals } = reconcileGeneratedTransfers(shared, null, [...generated, byHand], NOW);
    expect(removals).toEqual([0, 1, 2, 3]);
  });

  it('does nothing when nothing that matters changed', () => {
    const generated = asTransfers(shared);
    expect(reconcileGeneratedTransfers(shared, { ...shared }, generated, NOW)).toEqual({
      updates: [],
      removals: [],
    });
  });
});
