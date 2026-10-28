import type { GameBooks } from '@money/domain';
import { withDreamPending } from './dream-pending';

const books = (pending: Record<string, unknown>) =>
  ({
    state: {
      turn: {
        phase: 'decide',
        count: 1,
        pending: { kind: 'story', tile: 'emergency', ...pending },
      },
    },
  }) as unknown as GameBooks;

const pendingOf = (b: GameBooks) => b.state.turn!.pending as unknown as Record<string, unknown>;

describe('withDreamPending', () => {
  it('writes the drawn Emergency and Life cards where the solo screen reads them', () => {
    expect(
      pendingOf(withDreamPending(books({}), { kind: 'emergency', cardId: 'E12' }))['emergency'],
    ).toMatchObject({
      cardId: 'E12',
      skipped: [],
    });
    expect(
      pendingOf(withDreamPending(books({ tile: 'life' }), { kind: 'life', cardId: 'L3' }))['life'],
    ).toEqual({
      cardId: 'L3',
      skipped: [],
    });
  });

  it('writes the dreams and the Opportunity cards on offer', () => {
    expect(
      pendingOf(
        withDreamPending(books({ tile: 'dream' }), { kind: 'dream', offers: ['D1', 'D2'] }),
      )['dream'],
    ).toEqual({ offers: ['D1', 'D2'] });
    expect(
      pendingOf(
        withDreamPending(books({ tile: 'opportunity' }), {
          kind: 'opportunity',
          pile: 'seed',
          offers: ['O1'],
        }),
      )['opportunity'],
    ).toMatchObject({ pile: 'seed', offers: ['O1'] });
  });

  it("leaves the books alone when nothing is pending, or the decision is somebody else's kind only", () => {
    const plain = books({});
    expect(withDreamPending(plain, null)).toBe(plain);
    expect(withDreamPending(plain, { kind: 'emergency' })).toBe(plain);
  });

  it('carries the choice and the dice of an emergency, with the plans the table worked out', () => {
    const shown = withDreamPending(
      books({}),
      { kind: 'emergency', cardId: 'E1', choiceId: 'a', rolls: { main: 4 } },
      {
        info: {
          emergency: {
            payMinor: 90000,
            mustPayNow: false,
            choices: [],
            plans: [{ months: 3, perMinor: 31000, totalMinor: 93000 }],
          },
        },
      },
    );
    expect(pendingOf(shown)['emergency']).toMatchObject({
      choiceId: 'a',
      rolls: { main: 4 },
      dreamPayMinor: 90000,
      dreamPlans: [{ months: 3, perMinor: 31000, totalMinor: 93000 }],
    });
  });

  it('keeps a card that was dealt with on screen, with what came of it, until the next roll', () => {
    const paid = withDreamPending(books({}), null, {
      resolved: { kind: 'emergency', cardId: 'E1', payMinor: 90000, how: 3 },
    });
    expect(pendingOf(paid)['emergency']).toMatchObject({
      cardId: 'E1',
      dreamPaid: { payMinor: 90000, how: 3 },
    });
    const life = withDreamPending(books({ tile: 'life' }), null, {
      resolved: { kind: 'life', cardId: 'L3', decision: 'accept', outcome: { lines: [] } },
    });
    expect(pendingOf(life)['life']).toMatchObject({ cardId: 'L3', decision: 'accept' });
  });

  it('shows the career die and the paths of a branch, and what a promotion came to', () => {
    const branch = withDreamPending(books({ tile: 'career' }), {
      kind: 'career_branch',
      options: ['S2a', 'S2b'],
      roll: 6,
    });
    expect(pendingOf(branch)['career']).toMatchObject({
      result: { kind: 'branch', options: ['S2a', 'S2b'], roll: 6 },
    });
    const done = withDreamPending(books({ tile: 'career' }), null, {
      resolved: { kind: 'career', result: { kind: 'promoted', to: 'S2', roll: 5 }, reached: 'S2' },
    });
    expect(pendingOf(done)['career']).toMatchObject({ done: true, reached: 'S2' });
  });

  it('shows the dreams on offer and what was done with them', () => {
    const left = withDreamPending(books({ tile: 'dream' }), null, {
      resolved: { kind: 'dream', offers: ['D1'], declined: true },
    });
    expect(pendingOf(left)['dream']).toMatchObject({ offers: ['D1'], declined: true });
    const taken = withDreamPending(books({ tile: 'dream' }), null, {
      resolved: { kind: 'dream', offers: ['D1', 'D2'], taken: 'D2' },
    });
    expect(pendingOf(taken)['dream']).toMatchObject({ dreamTakenCardId: 'D2' });
  });
});
