/**
 * Live smoke test for the stdio transport (Slice 7 step 5): boots the real
 * backend against the test CouchDB stack (docker-compose.test.yml, same one
 * backend/tests/integration uses), mints a real PAT through the actual
 * `POST /auth/tokens` route, spawns the *built* `dist/index.js` as a real
 * child process over stdio (not an in-memory transport — this is the one
 * place that exercises the transport Claude Code/Desktop actually use), and
 * round-trips a couple of tool calls against the live API.
 *
 * Requires CouchDB reachable at COUCHDB_URL and `npm run build` to have
 * produced dist/index.js first (wired as `test:integration`'s pretest step).
 * Skips itself (not fails) when the database isn't reachable, matching
 * backend/tests/integration's own convention.
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import type { Server as HttpServer } from 'node:http';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-for-ci';
process.env.COUCHDB_URL = process.env.COUCHDB_URL || 'http://admin:password@localhost:5986';
process.env.SKIP_RATE_LIMIT = 'true';
process.env.NODE_ENV = 'test';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { app, checkDb, registerTestUser } = require('../../../../backend/tests/integration/setup');

const DIST_ENTRY = join(__dirname, '..', '..', 'dist', 'index.js');

function stringEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (typeof value === 'string') env[key] = value;
  }
  return env;
}

describe('MCP stdio smoke test (live backend + CouchDB)', () => {
  let dbAvailable = false;
  let httpServer: HttpServer;
  let apiUrl: string;
  let token: string;

  beforeAll(async () => {
    dbAvailable = await checkDb();
    if (!dbAvailable) return;
    if (!existsSync(DIST_ENTRY)) {
      throw new Error(`${DIST_ENTRY} does not exist — run \`npm run build\` before this test.`);
    }

    await new Promise<void>((resolve) => {
      httpServer = app.listen(0, '127.0.0.1', () => resolve());
    });
    const address = httpServer.address();
    if (!address || typeof address === 'string') {
      throw new Error('Expected the test HTTP server to bind to a TCP port.');
    }
    apiUrl = `http://127.0.0.1:${address.port}/api/v1`;

    const user = await registerTestUser('_mcp_smoke');
    const tokenResponse = await fetch(`http://127.0.0.1:${address.port}/api/v1/auth/tokens`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${user.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'mcp-smoke-test', scopes: ['transactions:rw'] }),
    });
    if (!tokenResponse.ok) {
      throw new Error(`Failed to mint a PAT for the smoke test: ${tokenResponse.status}`);
    }
    const tokenBody = (await tokenResponse.json()) as { token: string };
    token = tokenBody.token;
  });

  afterAll(async () => {
    if (httpServer) {
      await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    }
  });

  it('lists tools and round-trips a transaction create/list over the real stdio transport', async () => {
    if (!dbAvailable) {
      console.warn('Skipping MCP smoke test: CouchDB not reachable at ' + process.env.COUCHDB_URL);
      return;
    }

    const transport = new StdioClientTransport({
      command: 'node',
      args: [DIST_ENTRY],
      env: { ...stringEnv(), MM_API_URL: apiUrl, MM_API_TOKEN: token },
    });
    const client = new Client({ name: 'smoke-test-client', version: '0.0.0' });

    try {
      await client.connect(transport);

      const toolList = await client.listTools();
      expect(toolList.tools.length).toBeGreaterThan(10);
      expect(toolList.tools.map((t) => t.name)).toContain('manage_transactions');
      expect(toolList.tools.map((t) => t.name)).toContain('get_identity');

      // explain_concept resolves docs/domain/ relative to the *built* dist/
      // location at runtime — only a real spawned-process run like this one
      // (as opposed to ts-jest unit tests, which never touch that default
      // path) actually exercises that path arithmetic.
      const explainTool = toolList.tools.find((t) => t.name === 'explain_concept');
      expect(explainTool).toBeDefined();
      const topicEnum =
        (explainTool?.inputSchema.properties?.topic as { enum?: string[] })?.enum ?? [];
      expect(topicEnum.length).toBeGreaterThan(0);
      const explained = await client.callTool({
        name: 'explain_concept',
        arguments: { topic: topicEnum[0] },
      });
      expect(explained.isError).toBeFalsy();
      expect((explained.content as Array<{ text: string }>)[0].text.length).toBeGreaterThan(0);

      const identity = await client.callTool({ name: 'get_identity', arguments: {} });
      expect(identity.isError).toBeFalsy();
      const identityText = (identity.content as Array<{ text: string }>)[0].text;
      expect(JSON.parse(identityText)).toMatchObject({ authenticationType: 'token' });

      const created = await client.callTool({
        name: 'manage_transactions',
        arguments: {
          action: 'create',
          account: 'Daily',
          amountMinor: -1250,
          date: '2026-01-15',
          time: '09:00',
          category: '@McpSmokeTest',
          comment: 'stdio smoke test',
        },
      });
      expect(created.isError).toBeFalsy();

      const listed = await client.callTool({
        name: 'manage_transactions',
        arguments: { action: 'list' },
      });
      expect(listed.isError).toBeFalsy();
      const listedText = (listed.content as Array<{ text: string }>)[0].text;
      const listedBody = JSON.parse(listedText) as { transactions: Array<{ category: string }> };
      expect(listedBody.transactions.some((t) => t.category === '@McpSmokeTest')).toBe(true);
    } finally {
      await client.close();
    }
  }, 30000);
});
