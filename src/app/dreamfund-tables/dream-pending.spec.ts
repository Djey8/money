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
    ).toEqual({
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
});
