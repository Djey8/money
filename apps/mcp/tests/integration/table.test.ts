/**
 * Two agents play a multiplayer Cashflow table through the real MCP stdio server against the real backend (slice S7 of
 * todo/cashflow-multiplayer.md): one opens the table, the other joins, both start it, play every turn using only the moves
 * their own `legalActions` list, finish, and file the game in their saved games. A third client with a normal account gets
 * turned away. Needs CouchDB at COUCHDB_URL and a built `dist/index.js`; skips itself when the database is not reachable.
 */
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { Server as HttpServer } from 'node:http';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-for-ci';
process.env.COUCHDB_URL = process.env.COUCHDB_URL || 'http://admin:password@localhost:5986';
process.env.SKIP_RATE_LIMIT = 'true';
process.env.NODE_ENV = 'test';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { app, checkDb, registerTestUser } = require('../../../../backend/tests/integration/setup');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { getGameRoomsDb } = require('../../../../backend/config/db');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const store = require('../../../../backend/repositories/game-room-store');

jest.setTimeout(120000);

const DIST_ENTRY = join(__dirname, '..', '..', 'dist', 'index.js');
const GAME_PASSWORD = 'mcp-integration-test-only';

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
interface Reply {
  isError: boolean;
  text: string;
  json: Json | null;
}

function stringEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (typeof value === 'string') env[key] = value;
  }
  return env;
}

describe('two agents play a multiplayer table over MCP', () => {
  let dbAvailable = false;
  let httpServer: HttpServer;
  let baseUrl = '';
  const originalHash = process.env.CASHFLOW_GAME_PASSWORD_SHA256;
  const sessions: string[] = [];
  const clients: Client[] = [];
  const roomIds: string[] = [];

  async function registerGameAccount(label: string): Promise<{ session: string; pat: string }> {
    const registered = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `mcp_${Date.now()}_${label}_cashflow@test.local`,
        password: 'TestPassword123!',
        gamePassword: GAME_PASSWORD,
      }),
    });
    expect(registered.status).toBe(201);
    const cookie = registered.headers
      .getSetCookie()
      .find((entry: string) => entry.startsWith('access_token='));
    const session = (cookie as string).split(';')[0].split('=')[1];
    sessions.push(session);
    return { session, pat: await mintToken(session, label) };
  }

  async function mintToken(session: string, name: string): Promise<string> {
    const minted = await fetch(`${baseUrl}/api/v1/auth/tokens`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${session}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: `mcp-table-${name}`, scopes: ['game:rw'] }),
    });
    return ((await minted.json()) as { token: string }).token;
  }

  async function connect(pat: string, name: string) {
    const transport = new StdioClientTransport({
      command: 'node',
      args: [DIST_ENTRY],
      env: { ...stringEnv(), MM_API_URL: `${baseUrl}/api/v1`, MM_API_TOKEN: pat },
    });
    const client = new Client({ name, version: '0.0.0' });
    await client.connect(transport);
    clients.push(client);
    const call = async (tool: string, args: Record<string, unknown>): Promise<Reply> => {
      const result = await client.callTool({ name: tool, arguments: args });
      const text = (result.content as Array<{ text: string }>)[0].text;
      let json: Json | null = null;
      if (!result.isError) {
        try {
          json = JSON.parse(text);
        } catch {
          json = null;
        }
      }
      return { isError: Boolean(result.isError), text, json };
    };
    return {
      client,
      read: (args: Record<string, unknown>) => call('get_cashflow_game', args),
      play: (args: Record<string, unknown>) => call('play_cashflow_game', args),
    };
  }

  beforeAll(async () => {
    dbAvailable = await checkDb();
    if (!dbAvailable) return;
    if (!existsSync(DIST_ENTRY)) throw new Error(`${DIST_ENTRY} is missing - run npm run build.`);
    process.env.CASHFLOW_GAME_PASSWORD_SHA256 = createHash('sha256')
      .update(GAME_PASSWORD)
      .digest('hex');
    process.env.GAME_ROOMS_MAX_HOSTED = '50';
    process.env.GAME_ROOMS_MAX_SEATED = '50';
    await new Promise<void>((resolve) => {
      httpServer = app.listen(0, '127.0.0.1', () => resolve());
    });
    const address = httpServer.address();
    if (!address || typeof address === 'string') throw new Error('No port.');
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    for (const client of clients) await client.close().catch(() => undefined);
    if (originalHash === undefined) delete process.env.CASHFLOW_GAME_PASSWORD_SHA256;
    else process.env.CASHFLOW_GAME_PASSWORD_SHA256 = originalHash;
    delete process.env.GAME_ROOMS_MAX_HOSTED;
    delete process.env.GAME_ROOMS_MAX_SEATED;
    if (dbAvailable) {
      for (const id of roomIds) await store.deleteRoom(getGameRoomsDb(), id);
      for (const session of sessions) {
        await fetch(`${baseUrl}/api/v1/account`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${session}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ confirm: true }),
        });
      }
    }
    if (httpServer) await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  });

  it('open a table, join, play every turn from legalActions, finish and file the game', async () => {
    if (!dbAvailable) {
      console.warn('Skipping the MCP table test: CouchDB not reachable.');
      return;
    }
    const a = await registerGameAccount('agentA');
    const b = await registerGameAccount('agentB');
    const normal = await registerTestUser('_mcp_normal');
    sessions.push(normal.token);
    const agentA = await connect(a.pat, 'agent-a');
    const agentB = await connect(b.pat, 'agent-b');
    const stranger = await connect(await mintToken(normal.token, 'normal'), 'normal-client');

    const tools = (await agentA.client.listTools()).tools;
    const playTool = tools.find((tool) => tool.name === 'play_cashflow_game')!;
    expect(JSON.stringify(playTool.inputSchema)).toContain('table_move');

    // ── agent A opens a table ─────────────────────────────────────────────────────────────────
    const created = await agentA.play({
      action: 'table_create',
      nickname: 'Agent A',
      settings: {
        name: 'Agent table',
        professions: 'random',
        turnOrder: 'seat',
        clock: { mode: 'none' },
        endCondition: 'round-limit',
        roundLimit: 2,
      },
    });
    expect(created.isError).toBe(false);
    const roomId = created.json!.id as string;
    roomIds.push(roomId);
    expect(created.json!.inviteCode).toMatch(/^[A-HJ-NP-Z2-9]{8}$/);
    expect(created.json!.table.youSeat).toBe(0);

    // ── agent B finds it in the list and joins ─────────────────────────────────────────────────
    const listed = await agentB.read({ action: 'tables' });
    expect(listed.json!.items.map((item: Json) => item.id)).toContain(roomId);
    const joined = await agentB.play({ action: 'table_join', roomId, nickname: 'Agent B' });
    expect(joined.isError).toBe(false);
    expect(joined.json!.table.youSeat).toBe(1);
    expect((await agentB.play({ action: 'table_ready', roomId, ready: true })).isError).toBe(false);
    const notHost = await agentB.play({ action: 'table_start', roomId });
    expect(notHost.isError).toBe(true);
    expect(notHost.text).toContain('table_not_host');
    const started = await agentA.play({ action: 'table_start', roomId });
    expect(started.json!.table.phase).toBe('playing');

    // a normal account's agent is turned away from the tables
    const turnedAway = await stranger.read({ action: 'tables' });
    expect(turnedAway.isError).toBe(true);
    expect(turnedAway.text).toContain('not_a_game_account');

    // ── both agents play, each only from what its own legalActions lists ──────────────────────
    const agents = [agentA, agentB];
    let moves = 0;
    let duplicateChecked = false;
    let outOfTurnChecked = false;
    for (let step = 0; step < 300; step += 1) {
      const view = (await agents[0].read({ action: 'table', roomId })).json!;
      if (view.table.phase !== 'playing') break;
      const mover = agents[view.table.activeSeat];
      const other = agents[1 - view.table.activeSeat];
      const mine = (await mover.read({ action: 'table', roomId })).json!;
      const legal: string[] = mine.legalActions.map((entry: Json) => entry.action);
      expect(mine.table.activeSeat).toBe(mine.table.youSeat);

      if (!outOfTurnChecked) {
        // the other agent tries a move that is not its turn: refused with the table's code, nothing changes
        const refused = await other.play({
          action: 'table_move',
          roomId,
          command: { type: 'roll' },
          clientCommandId: `early-${step}`,
        });
        expect(refused.isError).toBe(true);
        expect(refused.text).toContain('table_not_your_turn');
        outOfTurnChecked = true;
      }

      const state = mine.table.players[mine.table.youSeat].books.state;
      const pending = state.turn?.pending;
      let command: Json;
      if (legal.includes('roll_decision')) command = { type: 'roll_decision' };
      else if (legal.includes('roll')) command = { type: 'roll' };
      else if (legal.includes('draw_card') && pending) {
        command = {
          type: 'draw_card',
          deck:
            pending.kind === 'doodad'
              ? 'doodad'
              : pending.kind === 'market'
                ? 'market'
                : 'dealSmall',
        };
      } else if (legal.includes('pay_doodad') && pending?.offered)
        command = { type: 'pay_doodad', cardId: pending.offered.cardId };
      else if (legal.includes('finish_card')) command = { type: 'finish_card' };
      else if (legal.includes('pass_card')) command = { type: 'pass_card' };
      else if (legal.includes('done')) command = { type: 'done' };
      else throw new Error(`nothing to play from ${JSON.stringify(legal)}`);

      const args = {
        action: 'table_move',
        roomId,
        command,
        clientCommandId: `agent-${step}`,
        expectedVersion: mine.table.version,
      };
      const done = await mover.play(args);
      expect([command.type, done.isError, done.text.slice(0, 120)]).toEqual([
        command.type,
        false,
        done.text.slice(0, 120),
      ]);
      expect(done.json!.replayed).toBe(false);
      moves += 1;

      if (!duplicateChecked) {
        // the same call again - a retry after a lost answer - is not a second move
        const again = await mover.play(args);
        expect(again.isError).toBe(false);
        expect(again.json!.replayed).toBe(true);
        expect(again.json!.appliedVersion).toBe(done.json!.appliedVersion);
        // and a move on a table that has moved on is refused
        const stale = await mover.play({
          ...args,
          clientCommandId: `stale-${step}`,
          expectedVersion: mine.table.version,
        });
        expect(stale.isError).toBe(true);
        expect(stale.text).toContain('room_conflict');
        duplicateChecked = true;
      }
    }
    expect(moves).toBeGreaterThanOrEqual(4);

    // ── the end ─────────────────────────────────────────────────────────────────────────────────
    const end = (await agentA.read({ action: 'table', roomId })).json!;
    expect(end.table.phase).toBe('finished');
    expect(end.table.result.reason).toBe('round-limit');
    expect(end.table.result.ranking).toHaveLength(2);
    expect(end.legalActions).toEqual([]);
    const log = (await agentB.read({ action: 'table_log', roomId })).json!;
    expect(log.end).toBe(true);
    expect(log.events.map((event: Json) => event.type)).toEqual(
      expect.arrayContaining(['play_started', 'rolled', 'game_finished']),
    );
    expect(JSON.stringify(log)).not.toContain(a.session);

    for (const [agent, label] of [
      [agentA, 'Agent table · A'],
      [agentB, 'Agent table · B'],
    ] as const) {
      const filed = await agent.play({ action: 'table_save', roomId, name: label });
      expect(filed.isError).toBe(false);
      expect(filed.json!.alreadyFiled).toBe(false);
      const again = await agent.play({ action: 'table_save', roomId, name: label });
      expect(again.json!.alreadyFiled).toBe(true);
      const saves = await agent.read({ action: 'saves' });
      expect(saves.json!.games.map((game: Json) => game.name)).toContain(label);
    }
    const recent = await agentA.read({ action: 'tables', scope: 'recent' });
    expect(recent.json!.items.map((item: Json) => item.id)).toContain(roomId);

    // destructive actions need confirm, with nothing sent without it
    const closeWithoutConfirm = await agentA.play({ action: 'table_close', roomId });
    expect(closeWithoutConfirm.isError).toBe(true);
    expect(closeWithoutConfirm.text).toContain('confirm');
  });
});
