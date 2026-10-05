import { decodeUndoChain, encodeUndoChain, isEncodedUndoChain } from './undo-chain-codec';

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
    decoded[3]['allTransactions'].push({ title: 'extra', amount: 1 });
    expect(decoded[2]['allTransactions']).toHaveLength(2);
  });

  it('recognises only its own format', () => {
    expect(isEncodedUndoChain([])).toBe(false);
    expect(isEncodedUndoChain(null)).toBe(false);
    expect(isEncodedUndoChain({ format: 2, snapshots: [] })).toBe(false);
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
});
