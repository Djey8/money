import { drawTableCard, type TableDrawDeps } from './deck';
import { applyCommand, createTable } from './reducer';
import { testContext } from './testing';
import { type Table, type TableCommand, type TableEvent } from './types';
import { projectEvents, projectFor } from './view';

const ctx = testContext;
const deps: TableDrawDeps = testContext;

const HOST = 'acct-secret-host-0001';
const ANNA = 'acct-secret-anna-0002';
const BEN = 'acct-secret-ben-0003';
const SEED = 987654321;

function play(
  settings: object,
  steps: [string, TableCommand][],
): { table: Table; events: TableEvent[] } {
  const created = createTable(
    { id: 't', hostId: HOST, hostName: 'Host', settings: { name: 'T', ...settings }, seed: SEED },
    ctx,
  );
  let table = created.table;
  const events = [...created.events];
  for (const [who, command] of steps) {
    const result = applyCommand(table, who, command, ctx);
    table = result.table;
    events.push(...result.events);
  }
  return { table, events };
}

const lobbySteps: [string, TableCommand][] = [
  [ANNA, { type: 'join', name: 'Anna' }],
  [ANNA, { type: 'set_ready', ready: true }],
  [BEN, { type: 'join', name: 'Ben' }],
  [BEN, { type: 'set_ready', ready: true }],
  [HOST, { type: 'start' }],
];

describe('projectFor', () => {
  it('shows seats instead of account ids, and the viewer their own seat', () => {
    const { table } = play({}, lobbySteps.slice(0, 2));
    const view = projectFor(table, ANNA);
    expect(view.youSeat).toBe(1);
    expect(view.hostSeat).toBe(0);
    expect(view.players.map((p) => [p.seat, p.name])).toEqual([
      [0, 'Host'],
      [1, 'Anna'],
    ]);
    expect(projectFor(table, 'someone-else').youSeat).toBeNull();
    expect(projectFor(table, null).youSeat).toBeNull();
    expect(JSON.stringify(view)).not.toContain('acct-secret');
  });

  it('hides the dice stream and every account id in a running game', () => {
    const { table } = play({ professions: 'random' }, lobbySteps);
    const json = JSON.stringify(projectFor(table, ANNA));
    expect(table.phase).toBe('playing');
    expect(json).not.toContain('acct-secret');
    expect(json).not.toContain(String(table.rngState));
    expect(json).not.toContain('rngState');
    expect(json).not.toContain('drawnCardIds');
  });

  it("shows everybody's books to everybody, without the static game set", () => {
    const { table } = play({ professions: 'random' }, lobbySteps);
    const view = projectFor(table, BEN);
    expect(view.players).toHaveLength(3);
    for (const player of view.players) {
      expect(player.books).not.toBeNull();
      expect(player.books!.subscriptions.length).toBeGreaterThan(0);
      expect(player.professionId).not.toBeNull();
      expect(player.books).not.toHaveProperty('gameSet');
      expect(player.books!.state).not.toHaveProperty('drawnCardIds');
    }
    // another player's books are readable by the viewer: the same numbers the owner sees
    expect(projectFor(table, HOST).players[1].books).toEqual(view.players[1].books);
  });

  it("keeps a duplicates table's picks secret until the reveal, but not your own", () => {
    const { table } = play({}, [
      ...lobbySteps,
      [ANNA, { type: 'pick_profession', professionId: 'pilot' }],
    ]);
    expect(table.phase).toBe('picking');
    const asBen = projectFor(table, BEN);
    expect(asBen.players[1]).toMatchObject({ hasPicked: true, pick: null });
    expect(asBen.players[2]).toMatchObject({ hasPicked: false, pick: null });
    expect(projectFor(table, ANNA).players[1].pick).toBe('pilot');
    expect(JSON.stringify(asBen)).not.toContain('pilot');

    const done = applyCommand(
      applyCommand(table, HOST, { type: 'pick_profession', professionId: 'lehrer' }, ctx).table,
      BEN,
      { type: 'pick_profession', professionId: 'arzt' },
      ctx,
    ).table;
    expect(done.phase).toBe('playing');
    expect(projectFor(done, BEN).players.map((p) => p.professionId)).toEqual([
      'lehrer',
      'pilot',
      'arzt',
    ]);
  });

  it('shows who took what at a unique table', () => {
    const { table } = play({ professions: 'unique' }, [
      ...lobbySteps,
      [ANNA, { type: 'pick_profession', professionId: 'pilot' }],
    ]);
    expect(projectFor(table, BEN).players[1].pick).toBe('pilot');
  });

  it('maps the turn order and the active player to seats', () => {
    const { table } = play({ professions: 'random', turnOrder: 'seat' }, lobbySteps);
    const view = projectFor(table, ANNA);
    expect(view.order).toEqual([0, 1, 2]);
    expect(view.activeSeat).toBe(0);
    const lobby = projectFor(play({}, []).table, HOST);
    expect(lobby.order).toEqual([]);
    expect(lobby.activeSeat).toBeNull();
  });

  it('shows the discard piles and what is left, never the order', () => {
    let { table } = play({ professions: 'random' }, lobbySteps);
    table = {
      ...table,
      players: table.players.map((p) =>
        p.id === ANNA
          ? {
              ...p,
              books: {
                ...p.books!,
                state: {
                  ...p.books!.state,
                  turn: {
                    phase: 'decide' as const,
                    count: 1,
                    pending: { kind: 'deal' as const, spaceIndex: 0 },
                  },
                },
              },
            }
          : p,
      ),
    };
    table = drawTableCard(table, ANNA, { deck: 'dealSmall' }, deps).table;
    const view = projectFor(table, BEN);
    expect(view.decks.dealSmall.discard).toEqual(table.drawnCardIds.dealSmall);
    expect(view.decks.dealSmall.discard).toHaveLength(1);
    expect(view.decks.dealSmall.left).toBeGreaterThan(0);
    expect(view.decks.market.discard).toEqual([]);
    // the card Anna holds is on the table for everyone to see
    expect(view.players[1].books!.state.turn?.pending?.offered?.cardId).toBe(
      view.decks.dealSmall.discard[0],
    );
  });
});

describe('projectEvents', () => {
  it('turns account ids into seats and leaks nothing else', () => {
    const { table, events } = play({ professions: 'random' }, lobbySteps);
    const projected = projectEvents(table, events);
    expect(projected).toHaveLength(events.length);
    expect(projected.map((e) => e.type)).toEqual(events.map((e) => e.type));
    expect(projected.find((e) => e.type === 'player_joined')).toMatchObject({ seat: 1 });
    expect(projected.find((e) => e.type === 'table_created')).toMatchObject({ seat: 0 });
    expect(projected.find((e) => e.type === 'play_started')).toMatchObject({ seat: null });
    expect(JSON.stringify(projected)).not.toContain('acct-secret');
  });

  it('does not reveal a secret pick through the event log either', () => {
    const { table, events } = play({}, [
      ...lobbySteps,
      [ANNA, { type: 'pick_profession', professionId: 'pilot' }],
    ]);
    expect(JSON.stringify(projectEvents(table, events))).not.toContain('pilot');
  });

  it('keeps the seat of a player who has since left', () => {
    const { table, events } = play({ professions: 'random' }, [
      ...lobbySteps,
      [BEN, { type: 'leave' }],
    ]);
    const left = projectEvents(table, events).find((e) => e.type === 'player_left');
    expect(left?.seat).toBe(2);
  });
});
