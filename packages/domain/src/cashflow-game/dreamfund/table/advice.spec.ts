import { adviseDreamSeat, DREAM_STRATEGIES } from './advice';
import { applyDreamCommand, briefAll, createDreamTable } from './reducer';
import type { DreamCommand, DreamTable } from './types';

const nowMs = Date.parse('2026-11-06T10:00:00.000Z');
const ctx = { clock: { nowIso: () => new Date(nowMs).toISOString() } };

const run = (t: DreamTable, who: string, command: DreamCommand): DreamTable =>
  applyDreamCommand(t, who, command, ctx).table;

/** A table of two people, started with random characters. */
function started(seed = 7): DreamTable {
  let t = createDreamTable(
    {
      id: 't1',
      hostId: 'host',
      hostName: 'Hanna',
      seed,
      settings: { name: 'Test', professions: 'random', turnOrder: 'seat' },
    },
    ctx,
  ).table;
  t = run(t, 'ann', { type: 'join', name: 'Ann' });
  t = run(t, 'host', { type: 'set_ready', ready: true });
  t = run(t, 'ann', { type: 'set_ready', ready: true });
  return briefAll(run(t, 'host', { type: 'start' }), ctx);
}

describe('advice for a seat of a Dreamfund table (JFK, 2026-11-06)', () => {
  it('tells the goals, the money and the move a strategy would make now', () => {
    const t = started();
    const who = t.activePlayerId!;
    const advice = adviseDreamSeat(t, who, 'expert');
    expect(advice.yourTurn).toBe(true);
    expect(advice.open).toBe('your roll');
    expect(advice.next[0].command).toEqual({ type: 'roll' });
    expect(advice.next[0].says).toMatch(/Roll the dice/);
    expect(advice.goals).toEqual({
      reserve: expect.any(Number),
      debts: expect.any(Number),
      dream: expect.any(Number),
      independence: expect.any(Number),
    });
    expect(advice.toWin.length).toBeGreaterThanOrEqual(5);
    expect(advice.strategies).toEqual(DREAM_STRATEGIES);
    expect(advice.attention.join(' ')).toMatch(/26.375% tax/);
  });

  it('has no move for a seat that does not have the turn', () => {
    const t = started();
    const other = t.players.find((seat) => seat.id !== t.activePlayerId)!.id;
    const advice = adviseDreamSeat(t, other);
    expect(advice.yourTurn).toBe(false);
    expect(advice.next).toEqual([]);
    expect(advice.open).toMatch(/wait for your turn/);
  });

  it('plays a person’s seat with the moves of a strategy: every move it names is legal, for a long stretch', () => {
    let t = started(11);
    const who = t.players[0].id;
    let moves = 0;
    for (let guard = 0; guard < 600 && t.phase === 'playing'; guard += 1) {
      // everybody is a person here: the one on the move first, then the one that has to say Continue to a Harvest card
      const order = [t.activePlayerId!, ...t.players.map((seat) => seat.id)];
      let moved = false;
      for (const seat of order) {
        const advice = adviseDreamSeat(t, seat, seat === who ? 'expert' : 'saver');
        if (advice.next.length === 0) continue;
        // a step is a few moves in a row (the plans of a month, then settling it); ending the turn waits for a person who has
        // to read a Harvest card - then it is theirs to move
        try {
          for (const move of advice.next) {
            t = run(t, seat, move.command);
            moves += 1;
          }
        } catch (error) {
          if (!/Waiting for/.test(String((error as Error).message))) throw error;
          continue;
        }
        moved = true;
        break;
      }
      if (!moved) break;
    }
    expect(moves).toBeGreaterThan(60);
  });
});
