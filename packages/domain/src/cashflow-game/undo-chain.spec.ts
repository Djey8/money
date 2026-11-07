import { decodeUndoChain, encodeUndoChain, isEncodedUndoChain } from './undo-chain';

const empty = () => ({
  allTransactions: [] as any[],
  allSubscriptions: [] as any[],
  allGrowProjects: [] as any[],
  allShares: [] as any[],
  allInvestments: [] as any[],
  allAssets: [] as any[],
  liabilities: [] as any[],
  allSmileProjects: [] as any[],
  allFireEmergencies: [] as any[],
  mojo: { amount: 0, target: 0 },
  cashflowGame: { round: 0 } as any,
});

/** A game whose books grow by a transaction per step and whose subscriptions change now and then. */
function playedGame(steps: number) {
  const stack: any[] = [];
  const live = empty();
  for (let step = 0; step < steps; step++) {
    stack.push({ step: { kind: 'payday', at: `t${step}` }, ...JSON.parse(JSON.stringify(live)) });
    live.allTransactions.push({
      title: `tx ${step}`,
      amount: step,
      category: '@Salary',
      comment: 'Payday, month ' + step,
      date: '2026-10-04',
      account: 'Daily',
    });
    if (step % 3 === 0) live.allSubscriptions = [{ title: 'Salary', amount: 100 + step }];
    live.cashflowGame = { round: step + 1 };
  }
  return stack;
}

describe('undo chain codec', () => {
  it('gives back exactly what was encoded', () => {
    const stack = playedGame(12);
    expect(decodeUndoChain(encodeUndoChain(stack))).toEqual(stack);
  });

  it('survives a JSON round trip (what localStorage and a saved game do)', () => {
    const stack = playedGame(8);
    const stored = JSON.parse(JSON.stringify(encodeUndoChain(stack)));
    expect(isEncodedUndoChain(stored)).toBe(true);
    expect(decodeUndoChain(stored)).toEqual(stack);
  });

  it('stores the growing game log of every step only once', () => {
    const stack = playedGame(120).map((snapshot, index) => ({
      ...snapshot,
      cashflowGame: {
        round: index + 1,
        history: Array.from({ length: index }, (_, n) => ({ kind: 'roll', detail: 'Roll ' + n })),
      },
    }));
    const encoded = encodeUndoChain(stack);
    expect(decodeUndoChain(encoded)).toEqual(stack);
    expect(JSON.stringify(encoded).length).toBeLessThan(JSON.stringify(stack).length / 10);
  });

  it('handles an empty history and a single step', () => {
    expect(decodeUndoChain(encodeUndoChain([]))).toEqual([]);
    const one = playedGame(1);
    expect(decodeUndoChain(encodeUndoChain(one))).toEqual(one);
  });

  it('stores only what changed between steps', () => {
    const stack = playedGame(60);
    const encoded = encodeUndoChain(stack);

    const whole = JSON.stringify(stack).length;
    const compact = JSON.stringify(encoded).length;
    expect(compact).toBeLessThan(whole / 4);
    // Every step but the newest repeats the transactions of the one after it.
    expect(encoded.snapshots[10].lists['allTransactions'].tail).toEqual([]);
  });

  it('copes with an item that was changed in the middle of a list', () => {
    const stack = playedGame(6);
    stack[2].allTransactions[1] = { title: 'edited', amount: 99 };
    expect(decodeUndoChain(encodeUndoChain(stack))).toEqual(stack);
  });

  it('decodes into independent copies', () => {
    const decoded = decodeUndoChain(encodeUndoChain(playedGame(4)));
    (decoded[3]['allTransactions'] as unknown[]).push({ title: 'extra', amount: 1 });
    expect(decoded[2]['allTransactions']).toHaveLength(2);
  });

  it('recognises only its own format', () => {
    expect(isEncodedUndoChain([])).toBe(false);
    expect(isEncodedUndoChain(null)).toBe(false);
    expect(isEncodedUndoChain({ format: 3, snapshots: [] })).toBe(false);
    expect(isEncodedUndoChain({ format: 1, snapshots: [] })).toBe(true);
    expect(isEncodedUndoChain({ format: 2, snapshots: [] })).toBe(true);
  });

  it('is quick enough to run after every move', () => {
    const stack: any[] = [];
    const live = empty();
    for (let step = 0; step < 200; step++) {
      stack.push(JSON.parse(JSON.stringify(live)));
      for (let n = 0; n < 3; n++)
        live.allTransactions.push({ title: `tx ${step}-${n}`, amount: n });
    }
    const started = Date.now();
    decodeUndoChain(encodeUndoChain(stack));
    expect(Date.now() - started).toBeLessThan(1500);
  });

  it('stores a Payday - every date of the books moved back a month - without repeating the books', () => {
    // each step is a Payday that adds a transaction and moves every date back by a month
    const stack: any[] = [];
    let transactions: any[] = [];
    let plan: any[] = [];
    for (let step = 0; step < 40; step++) {
      stack.push({
        step: { kind: 'payday', at: `t${step}` },
        ...empty(),
        allTransactions: JSON.parse(JSON.stringify(transactions)),
        cashflowGame: { round: step, budgetPlan: JSON.parse(JSON.stringify(plan)) },
      });
      transactions = transactions.map((t) => ({ ...t, date: move(t.date) }));
      transactions.push({
        title: `tx ${step}`,
        amount: step,
        date: '2026-10-27',
        account: 'Daily',
        comment: 'c'.repeat(80),
      });
      plan = plan.map((m) => ({ ...m, month: move(m.month + '-27').slice(0, 7) }));
      plan.push({ month: '2026-10', cells: { rent: 800, food: 300 } });
    }
    const encoded = encodeUndoChain(stack);
    expect(decodeUndoChain(JSON.parse(JSON.stringify(encoded)))).toEqual(stack);
    // without the move the whole list repeats in every Payday step: ~40 x 20 items; with it only what is new
    expect(JSON.stringify(encoded).length).toBeLessThan(JSON.stringify(stack).length / 6);
  });

  it('works out a chain that grew by one step without working out the others again', () => {
    const stack = playedGame(30);
    const cache = new WeakMap();
    const first = encodeUndoChain(stack, cache);
    stack.push(JSON.parse(JSON.stringify(stack[stack.length - 1])));
    const second = encodeUndoChain(stack, cache);
    // the steps that did not change are the very same encoded objects
    expect(second.snapshots[3]).toBe(first.snapshots[3]);
    expect(decodeUndoChain(second)).toEqual(stack);
  });

  it('still reads a chain written in the first format', () => {
    const stack = playedGame(6);
    const encoded = { ...encodeUndoChain(stack), format: 1 as const };
    expect(decodeUndoChain(encoded)).toEqual(stack);
  });
});

/** One month back, the way the game moves its dates. */
function move(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  const zero = m - 1 - 1;
  const year = y + Math.floor(zero / 12);
  const month = ((zero % 12) + 12) % 12;
  const day = Math.min(d, new Date(year, month + 1, 0).getDate());
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
