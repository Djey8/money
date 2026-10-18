import { ApiClient } from '../../src/client';
import type { FetchLike } from '../../src/client';
import { buildToolList, dispatchToolCall } from '../../src/tools/dispatch';
import { TOOLS } from '../../src/tools/registry';
import { OPERATIONS } from '../../src/generated/operations';

/**
 * The multiplayer table actions of get_cashflow_game / play_cashflow_game (todo/cashflow-multiplayer.md slice S7): what an
 * agent sees in tools/list, and what its calls become on the wire.
 */

function fakeClient(fetchImpl: FetchLike): ApiClient {
  return new ApiClient('http://localhost:3000/api/v1', 'mmpat_test', fetchImpl);
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': status >= 400 ? 'application/problem+json' : 'application/json' },
  });
}

const tools = buildToolList(TOOLS);
const play = tools.find((tool) => tool.name === 'play_cashflow_game')!;
const read = tools.find((tool) => tool.name === 'get_cashflow_game')!;
const props = (tool: typeof play) =>
  tool.inputSchema.properties as Record<string, { enum?: string[] }>;

describe('what an agent sees in tools/list', () => {
  it('offers the table actions on the two game tools, next to the solo ones', () => {
    expect(props(read).action.enum).toEqual(
      expect.arrayContaining(['game', 'tables', 'table', 'table_log', 'table_bots']),
    );
    expect(props(play).action.enum).toEqual(
      expect.arrayContaining([
        'start',
        'roll',
        'table_create',
        'table_join',
        'table_leave',
        'table_ready',
        'table_kick',
        'table_settings',
        'table_add_bot',
        'table_start',
        'table_profession',
        'table_move',
        'table_close',
        'table_rewind',
        'table_save',
      ]),
    );
  });

  it('has the arguments a table call needs, with the shapes of the API', () => {
    const properties = props(play) as Record<string, Record<string, unknown>>;
    for (const name of [
      'roomId',
      'command',
      'clientCommandId',
      'expectedVersion',
      'nickname',
      'settings',
      'seat',
      'ready',
      'code',
    ]) {
      expect(properties[name]).toBeDefined();
    }
    expect(JSON.stringify(properties.command)).toContain('offer_trade');
    expect(JSON.stringify(properties.command)).toContain('sell_position');
    expect(properties.confirm).toBeDefined();
    expect(JSON.stringify(properties.clientCommandId)).toContain('A-Za-z0-9');
  });

  it('tells an agent how to play a table: read legalActions first, send a clientCommandId, no stream', () => {
    expect(play.description).toContain('table_move');
    expect(play.description).toContain('legalActions');
    expect(play.description).toContain('clientCommandId');
    expect(play.description).toContain('expectedVersion');
    expect(play.description).toContain('Playing at a table');
    expect(read.description).toContain('WAITING FOR YOUR TURN');
    expect(read.description).toContain('version');
  });

  it('every table action points at an operation of the API, and the stream is not a tool', () => {
    const actions = [
      ...Object.entries(
        (
          TOOLS.find((t) => t.name === 'play_cashflow_game') as never as {
            actions: Record<string, { operationId: string }>;
          }
        ).actions,
      ),
      ...Object.entries(
        (
          TOOLS.find((t) => t.name === 'get_cashflow_game') as never as {
            actions: Record<string, { operationId: string }>;
          }
        ).actions,
      ),
    ].filter(([name]) => name.startsWith('table'));
    expect(actions.length).toBe(18);
    for (const [, action] of actions) expect(OPERATIONS[action.operationId]).toBeDefined();
    expect(OPERATIONS.streamGameRoomEvents).toBeUndefined();
    expect(JSON.stringify(TOOLS)).not.toContain('streamGameRoomEvents');
  });
});

describe('what a table call becomes on the wire', () => {
  it('table_move: one POST with the command, the command id and the version', async () => {
    const fetchImpl = jest.fn(async () =>
      jsonResponse(200, { replayed: false, appliedVersion: 42 }),
    );
    const result = await dispatchToolCall(TOOLS, fakeClient(fetchImpl), 'play_cashflow_game', {
      action: 'table_move',
      roomId: 'room/1',
      command: { type: 'sell_position', input: { title: 'EFH' } },
      clientCommandId: 'turn-12-sell',
      expectedVersion: 41,
    });
    expect(result.isError).toBeFalsy();
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [
      string,
      { method: string; body: string },
    ];
    expect(url).toBe('http://localhost:3000/api/v1/game/rooms/room%2F1/commands');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({
      command: { type: 'sell_position', input: { title: 'EFH' } },
      clientCommandId: 'turn-12-sell',
      expectedVersion: 41,
    });
  });

  it('the lobby actions: create, join, ready, kick, settings, start, profession, leave', async () => {
    const fetchImpl = jest.fn(async () => jsonResponse(200, {}));
    const client = fakeClient(fetchImpl);
    const call = (args: Record<string, unknown>) =>
      dispatchToolCall(TOOLS, client, 'play_cashflow_game', args);
    await call({
      action: 'table_create',
      nickname: 'Agent',
      settings: { name: 'Agents', maxSeats: 4 },
    });
    await call({ action: 'table_join', code: 'H2LX8D4L', nickname: 'Agent2' });
    await call({ action: 'table_ready', roomId: 'r1', ready: true });
    await call({ action: 'table_kick', roomId: 'r1', seat: 2 });
    await call({ action: 'table_settings', roomId: 'r1', settings: { maxSeats: 8 } });
    await call({ action: 'table_start', roomId: 'r1' });
    await call({ action: 'table_profession', roomId: 'r1', professionId: 'random' });
    await call({ action: 'table_leave', roomId: 'r1' });
    const seen = fetchImpl.mock.calls.map((c) => {
      const [url, init] = c as unknown as [string, { method: string; body?: string }];
      return [
        init.method,
        url.replace('http://localhost:3000/api/v1', ''),
        init.body ? JSON.parse(init.body) : null,
      ];
    });
    expect(seen).toEqual([
      ['POST', '/game/rooms', { nickname: 'Agent', settings: { name: 'Agents', maxSeats: 4 } }],
      ['POST', '/game/rooms/join', { code: 'H2LX8D4L', nickname: 'Agent2' }],
      ['PUT', '/game/rooms/r1/ready', { ready: true }],
      ['POST', '/game/rooms/r1/kick', { seat: 2 }],
      ['PUT', '/game/rooms/r1/settings', { settings: { maxSeats: 8 } }],
      ['POST', '/game/rooms/r1/start', {}],
      ['PUT', '/game/rooms/r1/profession', { professionId: 'random' }],
      ['POST', '/game/rooms/r1/leave', {}],
    ]);
  });

  it('the reads: tables (scope, limit), table, table_log (after)', async () => {
    const fetchImpl = jest.fn(async () => jsonResponse(200, {}));
    const client = fakeClient(fetchImpl);
    const call = (args: Record<string, unknown>) =>
      dispatchToolCall(TOOLS, client, 'get_cashflow_game', args);
    await call({ action: 'tables', scope: 'mine', limit: 5 });
    await call({ action: 'tables' });
    await call({ action: 'table', roomId: 'r1' });
    await call({ action: 'table_log', roomId: 'r1', after: 40, limit: 100 });
    const urls = fetchImpl.mock.calls.map((c) =>
      (c as unknown as [string])[0].replace('http://localhost:3000/api/v1', ''),
    );
    expect(urls).toEqual([
      '/game/rooms?scope=mine&limit=5',
      '/game/rooms',
      '/game/rooms/r1',
      '/game/rooms/r1/log?after=40&limit=100',
    ]);
    for (const c of fetchImpl.mock.calls)
      expect((c as unknown as [string, { method: string }])[1].method).toBe('GET');
  });

  it('closing a table and rewinding it need confirm: true, and send it as the query', async () => {
    const fetchImpl = jest.fn(async () => jsonResponse(200, {}));
    const client = fakeClient(fetchImpl);
    for (const action of ['table_close', 'table_rewind']) {
      const refused = await dispatchToolCall(TOOLS, client, 'play_cashflow_game', {
        action,
        roomId: 'r1',
      });
      expect(refused.isError).toBe(true);
    }
    expect(fetchImpl).not.toHaveBeenCalled();
    await dispatchToolCall(TOOLS, client, 'play_cashflow_game', {
      action: 'table_close',
      roomId: 'r1',
      confirm: true,
    });
    await dispatchToolCall(TOOLS, client, 'play_cashflow_game', {
      action: 'table_rewind',
      roomId: 'r1',
      confirm: true,
      clientCommandId: 'rw-1',
    });
    const [closeUrl, closeInit] = fetchImpl.mock.calls[0] as unknown as [
      string,
      { method: string },
    ];
    expect(closeUrl).toBe('http://localhost:3000/api/v1/game/rooms/r1?confirm=true');
    expect(closeInit.method).toBe('DELETE');
    const [rewindUrl, rewindInit] = fetchImpl.mock.calls[1] as unknown as [
      string,
      { method: string; body: string },
    ];
    expect(rewindUrl).toBe('http://localhost:3000/api/v1/game/rooms/r1/rewind?confirm=true');
    expect(JSON.parse(rewindInit.body)).toEqual({ clientCommandId: 'rw-1' });
  });

  it("a refused move comes back as an error carrying the table's code and its words", async () => {
    const fetchImpl = jest.fn(async () =>
      jsonResponse(422, {
        type: 'https://money-manager.dev/problems/table_illegal_move',
        title: 'Table request refused',
        status: 422,
        detail: 'A card was already offered on this space: play it or pass.',
        code: 'table_illegal_move',
      }),
    );
    const result = await dispatchToolCall(TOOLS, fakeClient(fetchImpl), 'play_cashflow_game', {
      action: 'table_move',
      roomId: 'r1',
      command: { type: 'draw_card', deck: 'dealSmall' },
    });
    expect(result.isError).toBe(true);
    const text = (result.content[0] as { text: string }).text;
    expect(text).toContain('table_illegal_move');
    expect(text).toContain('A card was already offered');
  });

  it('table_move without a room is refused before any call', async () => {
    const fetchImpl = jest.fn();
    const result = await dispatchToolCall(TOOLS, fakeClient(fetchImpl), 'play_cashflow_game', {
      action: 'table_move',
      command: { type: 'roll' },
    });
    expect(result.isError).toBe(true);
    expect((result.content[0] as { text: string }).text).toContain('roomId');
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
