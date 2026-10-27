import { applyDreamCommand, createDreamTable } from './reducer';
import { dreamLegalActions, projectDreamFor } from './view';
import type { DreamTable } from './types';

const ctx = { clock: { nowIso: () => '2026-11-01T10:00:00.000Z' } };

function started(): DreamTable {
  let t = createDreamTable(
    {
      id: 'v',
      hostId: 'host',
      hostName: 'Hanna',
      seed: 6,
      settings: { name: 'View', professions: 'random', turnOrder: 'seat' },
    },
    ctx,
  ).table;
  t = applyDreamCommand(t, 'ann', { type: 'join', name: 'Ann' }, ctx).table;
  t = applyDreamCommand(t, 'ann', { type: 'set_ready', ready: true }, ctx).table;
  return applyDreamCommand(t, 'host', { type: 'start' }, ctx).table;
}

describe('what a viewer of a Dreamfund table is shown', () => {
  it('has seats and numbers, never account ids or the dice, and a summary of every life', () => {
    const t = started();
    const view = projectDreamFor(t, 'ann');
    expect(JSON.stringify(view)).not.toContain('rngState');
    expect(JSON.stringify(view)).not.toContain('"host"');
    expect(view.you).toBe(1);
    expect(view.youSeat).toBe(1);
    for (const player of view.players) {
      expect(player.summary).toMatchObject({ months: 0 });
      expect(player.summary!.cashMinor).toBeGreaterThan(0);
      expect(player.summary!.debts.length).toBeGreaterThan(0);
      expect(player.summary!.goals.reserve).toBe(0);
    }
    // a spectator sees the same table without a seat
    expect(projectDreamFor(t, 'nobody').you).toBeNull();
  });

  it('shows a player the prices of their own decision, and the others only that there is one', () => {
    let t = started();
    // roll until somebody has a card to decide
    const order = t.order;
    for (let guard = 0; guard < 300 && !t.players.some((p) => p.pending); guard += 1) {
      const who = t.activePlayerId!;
      const seat = t.players.find((p) => p.id === who)!;
      try {
        t = applyDreamCommand(
          t,
          who,
          seat.pending ? { type: 'skip' } : t.turnRolled ? { type: 'end_turn' } : { type: 'roll' },
          ctx,
        ).table;
      } catch {
        t = applyDreamCommand(t, who, { type: 'end_turn' }, ctx).table;
      }
    }
    const holder = t.players.find((p) => p.pending);
    if (!holder) return; // no landing asked anything in these moves
    const mine = projectDreamFor(t, holder.id).players.find((p) => p.you)!;
    const other = projectDreamFor(
      t,
      order.find((id) => id !== holder.id)!,
    ).players.find((p) => p.name === holder.name)!;
    expect(mine.pending).toEqual(holder.pending);
    expect(other.pending).toEqual({ kind: holder.pending!.kind });
    expect(other.pendingInfo).toBeNull();
    expect(dreamLegalActions(t, holder.id).length).toBeGreaterThan(0);
  });

  it('lists the lobby actions for the host and a seat, and join for a stranger', () => {
    const t = createDreamTable(
      { id: 'l', hostId: 'host', hostName: 'Hanna', seed: 1, settings: { name: 'Lobby' } },
      ctx,
    ).table;
    expect(dreamLegalActions(t, 'host').map((a) => a.type)).toEqual(
      expect.arrayContaining(['start', 'add_bot', 'update_settings']),
    );
    expect(dreamLegalActions(t, 'stranger').map((a) => a.type)).toEqual(['join']);
  });
});
