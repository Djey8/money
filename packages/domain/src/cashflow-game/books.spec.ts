import { applyEffectsToBooks, type BookGrowProject, type GameBooks } from './books';
import { emptyEffects } from './effects';
import { initialCashflowGameState } from './types';

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value as object).forEach(deepFreeze);
  }
  return value;
}

const project = (extra: Partial<BookGrowProject> = {}): BookGrowProject => ({
  title: 'OK4U',
  sub: 'OK4U Inc.',
  phase: 'plan',
  status: 'planned',
  description: '',
  strategy: '',
  notes: [],
  cashflowMinor: 0,
  amountMinor: 0,
  isAsset: false,
  share: { tag: 'OK4U', quantity: 10, priceMinor: 500 },
  investment: null,
  loan: null,
  updatedAt: '2026-10-01T00:00:00.000Z',
  ...extra,
});

function books(extra: Partial<GameBooks> = {}): GameBooks {
  return {
    state: initialCashflowGameState(),
    allocation: { daily: 60, splurge: 10, smile: 10, fire: 20 },
    gameSet: undefined,
    subscriptions: [],
    transactions: [],
    liabilities: [],
    shares: [],
    investments: [],
    assets: [],
    growProjects: [],
    ...extra,
  };
}

const sub = (title: string, amountMinor = 100) => ({
  title,
  account: 'Daily',
  amountMinor,
  startDate: '2026-10-01',
  endDate: '',
  category: '',
  comment: '#cashflow',
  frequency: 'monthly' as const,
});

describe('applyEffectsToBooks', () => {
  it('changes nothing for empty effects, and never mutates its input', () => {
    const input = deepFreeze(books({ growProjects: [project()] }));
    const output = applyEffectsToBooks(input, emptyEffects(input.state, null));
    expect(output).toEqual(input);
  });

  it('moves transaction dates by position and appends new ones after them', () => {
    const tx = (date: string) => ({
      account: 'Daily',
      amountMinor: 1,
      date,
      time: '',
      category: '',
      comment: '',
    });
    const effects = emptyEffects(initialCashflowGameState(), null);
    effects.transactionDates = [{ index: 1, date: '2026-09-30' }];
    effects.appendedTransactions = [tx('2026-10-05')];
    const out = applyEffectsToBooks(
      deepFreeze(books({ transactions: [tx('2026-10-01'), tx('2026-10-31')] })),
      effects,
    );
    expect(out.transactions.map((t) => t.date)).toEqual(['2026-10-01', '2026-09-30', '2026-10-05']);
  });

  it('creates and replaces subscriptions and liabilities by title / tag, and removes the ones asked to go', () => {
    const effects = emptyEffects(initialCashflowGameState(), null);
    effects.subscriptionUpserts = [sub('B', 200), sub('C')];
    effects.subscriptionRemovals = ['A'];
    effects.liabilityUpserts = [{ tag: 'Bank loan', amountMinor: 5000, investment: false }];
    effects.liabilityRemovals = ['Old'];
    const out = applyEffectsToBooks(
      deepFreeze(
        books({
          subscriptions: [sub('A'), sub('B')],
          liabilities: [
            { tag: 'Bank loan', amountMinor: 1000, investment: false },
            { tag: 'Old', amountMinor: 1, investment: false },
          ],
        }),
      ),
      effects,
    );
    expect(out.subscriptions.map((s) => [s.title, s.amountMinor])).toEqual([
      ['B', 200],
      ['C', 100],
    ]);
    expect(out.liabilities).toEqual([{ tag: 'Bank loan', amountMinor: 5000, investment: false }]);
  });

  it('upserts positions and sets share prices on held shares', () => {
    const effects = emptyEffects(initialCashflowGameState(), null);
    effects.shareUpserts = [{ tag: 'NEW', quantity: 5, priceMinor: 100 }];
    effects.investmentUpserts = [{ tag: 'EFH', depositMinor: 1, amountMinor: 2 }];
    effects.sharePrices = [{ tag: 'OK4U', priceMinor: 700 }];
    const out = applyEffectsToBooks(
      books({ shares: [{ tag: 'OK4U', quantity: 10, priceMinor: 500 }] }),
      effects,
    );
    expect(out.shares).toEqual([
      { tag: 'OK4U', quantity: 10, priceMinor: 700 },
      { tag: 'NEW', quantity: 5, priceMinor: 100 },
    ]);
    expect(out.investments).toEqual([{ tag: 'EFH', depositMinor: 1, amountMinor: 2 }]);
  });

  it('updates only the project fields that are present', () => {
    const effects = emptyEffects(initialCashflowGameState(), null);
    effects.growUpdates = [
      { title: 'OK4U', status: 'bought', phase: 'execute', amountMinor: 5000, updatedAt: 'now' },
    ];
    const out = applyEffectsToBooks(deepFreeze(books({ growProjects: [project()] })), effects);
    expect(out.growProjects[0]).toEqual(
      project({ status: 'bought', phase: 'execute', amountMinor: 5000, updatedAt: 'now' }),
    );
  });

  it('a project that does not exist is only made when the update says so, and a plain update to a missing one is ignored', () => {
    const create = emptyEffects(initialCashflowGameState(), null);
    create.growUpdates = [
      {
        title: 'EFH',
        create: true,
        createdAt: 'c',
        phase: 'plan',
        status: 'planned',
        amountMinor: 700,
      },
    ];
    const made = applyEffectsToBooks(books(), create);
    expect(made.growProjects).toHaveLength(1);
    expect(made.growProjects[0]).toMatchObject({
      title: 'EFH',
      phase: 'plan',
      status: 'planned',
      amountMinor: 700,
      updatedAt: 'c',
      share: null,
      notes: [],
    });

    const ignore = emptyEffects(initialCashflowGameState(), null);
    ignore.growUpdates = [{ title: 'GHOST', status: 'x' }];
    expect(applyEffectsToBooks(books(), ignore).growProjects).toEqual([]);
  });

  it('a share price update reaches the project’s own share, and a null clears the loan', () => {
    const effects = emptyEffects(initialCashflowGameState(), null);
    effects.growUpdates = [{ title: 'OK4U', sharePriceMinor: 900, loan: null }];
    const input = books({
      growProjects: [
        project({ loan: { tag: 'OK4U', amountMinor: 1000, creditMinor: 0, investment: true } }),
      ],
    });
    const out = applyEffectsToBooks(input, effects);
    expect(out.growProjects[0].share).toEqual({ tag: 'OK4U', quantity: 10, priceMinor: 900 });
    expect(out.growProjects[0].loan).toBeNull();
  });

  it('takes over the new game state', () => {
    const state = { ...initialCashflowGameState(), round: 7 };
    expect(applyEffectsToBooks(books(), emptyEffects(state, null)).state.round).toBe(7);
  });
});
