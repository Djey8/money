/**
 * An agent plays a whole Cashflow game through the real MCP stdio server against the real backend (slice D5, exit
 * criterion (b) of todo/cashflow-game-pro.md): start a solo game, play every turn with a simple policy using only the
 * moves `legalActions` offers, save the finished game compactly, and clean up after itself. Needs CouchDB at COUCHDB_URL
 * and a built `dist/index.js`; skips itself when the database is not reachable.
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
const { app, checkDb } = require('../../../../backend/tests/integration/setup');

const DIST_ENTRY = join(__dirname, '..', '..', 'dist', 'index.js');
const GAME_PASSWORD = 'mcp-integration-test-only';

function stringEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (typeof value === 'string') env[key] = value;
  }
  return env;
}

describe('an agent plays a whole game over MCP', () => {
  let dbAvailable = false;
  let httpServer: HttpServer;
  let baseUrl: string;
  let sessionToken = '';
  let patToken = '';
  const originalHash = process.env.CASHFLOW_GAME_PASSWORD_SHA256;

  beforeAll(async () => {
    dbAvailable = await checkDb();
    if (!dbAvailable) return;
    if (!existsSync(DIST_ENTRY)) throw new Error(`${DIST_ENTRY} is missing - run npm run build.`);
    process.env.CASHFLOW_GAME_PASSWORD_SHA256 = createHash('sha256')
      .update(GAME_PASSWORD)
      .digest('hex');
    await new Promise<void>((resolve) => {
      httpServer = app.listen(0, '127.0.0.1', () => resolve());
    });
    const address = httpServer.address();
    if (!address || typeof address === 'string') throw new Error('No port.');
    baseUrl = `http://127.0.0.1:${address.port}`;

    const registered = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `mcp_${Date.now()}_cashflow@test.local`,
        password: 'TestPassword123!',
        gamePassword: GAME_PASSWORD,
      }),
    });
    expect(registered.status).toBe(201);
    const cookie = registered.headers
      .getSetCookie()
      .find((entry: string) => entry.startsWith('access_token='));
    sessionToken = (cookie as string).split(';')[0].split('=')[1];

    const minted = await fetch(`${baseUrl}/api/v1/auth/tokens`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${sessionToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'mcp-game-test', scopes: ['game:rw'] }),
    });
    patToken = ((await minted.json()) as { token: string }).token;
  });

  afterAll(async () => {
    if (originalHash === undefined) delete process.env.CASHFLOW_GAME_PASSWORD_SHA256;
    else process.env.CASHFLOW_GAME_PASSWORD_SHA256 = originalHash;
    if (dbAvailable && sessionToken) {
      await fetch(`${baseUrl}/api/v1/account`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${sessionToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: true }),
      });
    }
    if (httpServer) await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  });

  it('plays from the first roll to the escape, saves it compactly and cleans up', async () => {
    if (!dbAvailable) {
      console.warn('Skipping the MCP game test: CouchDB not reachable.');
      return;
    }
    const transport = new StdioClientTransport({
      command: 'node',
      args: [DIST_ENTRY],
      env: { ...stringEnv(), MM_API_URL: `${baseUrl}/api/v1`, MM_API_TOKEN: patToken },
    });
    const client = new Client({ name: 'game-test-client', version: '0.0.0' });
    await client.connect(transport);

    const call = async (name: string, args: Record<string, unknown>) => {
      const result = await client.callTool({ name, arguments: args });
      const text = (result.content as Array<{ text: string }>)[0].text;
      return {
        isError: Boolean(result.isError),
        text,
        json: result.isError ? null : JSON.parse(text),
      };
    };
    const read = (args: Record<string, unknown>) => call('get_cashflow_game', args);
    const play = (args: Record<string, unknown>) => call('play_cashflow_game', args);

    try {
      const tools = (await client.listTools()).tools.map((tool) => tool.name);
      expect(tools).toEqual(expect.arrayContaining(['get_cashflow_game', 'play_cashflow_game']));

      const before = await read({ action: 'game' });
      expect(before.json).toMatchObject({ active: false });
      const sets = await read({ action: 'sets' });
      expect(sets.json.sets[0].id).toBe('cashflow');

      const started = await play({
        action: 'start',
        gameSetId: 'cashflow',
        professionId: 'hausmeister',
        mode: 'solo',
      });
      expect(started.isError).toBe(false);

      let game = started.json;
      for (let turn = 0; turn < 250 && game.turn.phase !== 'over'; turn += 1) {
        const legal = game.legalActions.map((entry: { action: string }) => entry.action);
        if (game.turn.phase === 'roll') {
          expect(legal).toContain('roll');
          game = (await play({ action: 'roll', dice: game.status.charityRoundsLeft > 0 ? 2 : 1 }))
            .json;
          continue;
        }
        // a card waits: only ever do what legalActions offers
        if (game.pendingDecision.kind !== 'deal') {
          game = (await play({ action: 'pass_card' })).json;
          continue;
        }
        const deck = Math.random() < 0.5 ? 'dealSmall' : 'dealBig';
        game = (await play({ action: 'draw_card', deck })).json;
        const card = game.result.card;
        if (card.assetKind === 'investment' && card.depositMinor <= game.cashMinor) {
          game = (await play({ action: 'buy_deal', cardId: card.id })).json;
        } else {
          game = (await play({ action: 'pass_card' })).json;
        }
      }
      expect(game.turn.phase).toBe('over');
      expect(['escaped', 'bankrupt']).toContain(game.outcome);
      // The dice and the draw are real: a game can end before any deal was affordable (the backend's seeded golden
      // game covers buying). What this test proves is the whole loop over MCP, whatever the game did.

      // a refused move says why, as a tool error and not a crash
      const refused = await play({ action: 'roll' });
      expect(refused.isError).toBe(true);
      expect(refused.text).toMatch(/game_action_not_allowed/);

      // save it small, look at what the account has left, then clean up
      const saved = await play({ action: 'save', name: 'mcp test game', compact: true });
      expect(saved.json.game.sizeBytes).toBeGreaterThan(1000);
      const listed = await read({ action: 'saves' });
      expect(listed.json.games).toHaveLength(1);
      expect(listed.json.storage.remainingBytes).toBeGreaterThan(1000000);
      const detail = await read({ action: 'save', saveId: saved.json.game.id });
      expect(
        detail.json.steps.filter((step: { kind: string }) => step.kind === 'roll').length,
      ).toBeGreaterThan(0);

      const unconfirmed = await play({ action: 'prune_saves', keepLatest: 0 });
      expect(unconfirmed.isError).toBe(true);
      const pruned = await play({ action: 'prune_saves', keepLatest: 0, confirm: true });
      expect(pruned.json.deleted).toEqual([saved.json.game.id]);
      expect((await read({ action: 'saves' })).json.games).toEqual([]);

      const reset = await play({ action: 'reset', confirm: true });
      expect(reset.json.active).toBe(false);
    } finally {
      await client.close();
    }
  }, 240000);
});
