/**
 * Live smoke test for the Streamable HTTP transport's OAuth flow: boots the
 * real backend against the test CouchDB stack (docker-compose.test.yml,
 * same one tests/integration/smoke.test.ts and backend/tests/integration
 * use), registers a real account, and drives the actual DCR + authorize +
 * login + token-exchange dance with real HTTP requests against the *built*
 * dist/http-server.js (not an in-memory stub) — no mocks anywhere. Proves
 * the access token handed back really is a working PAT against the live
 * account, not just something that satisfies the unit tests' mocked
 * backend-client.
 *
 * Requires CouchDB reachable at COUCHDB_URL and `npm run build` to have
 * produced dist/ first (wired as `test:integration`'s pretest step, same as
 * smoke.test.ts). Skips itself (not fails) when the database isn't
 * reachable, matching backend/tests/integration's own convention.
 */
import { createHash, randomBytes } from 'node:crypto';
import type { Server as HttpServer } from 'node:http';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-for-ci';
process.env.COUCHDB_URL = process.env.COUCHDB_URL || 'http://admin:password@localhost:5986';
process.env.SKIP_RATE_LIMIT = 'true';
process.env.NODE_ENV = 'test';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { app, checkDb, registerTestUser } = require('../../../../backend/tests/integration/setup');

const DIST_HTTP_SERVER = join(__dirname, '..', '..', 'dist', 'http-server.js');

describe('MCP OAuth flow (live backend + CouchDB)', () => {
  let dbAvailable = false;
  let backendServer: HttpServer;
  let apiUrl: string;
  let email: string;
  let password: string;

  beforeAll(async () => {
    dbAvailable = await checkDb();
    if (!dbAvailable) return;
    if (!existsSync(DIST_HTTP_SERVER)) {
      throw new Error(
        `${DIST_HTTP_SERVER} does not exist — run \`npm run build\` before this test.`,
      );
    }

    await new Promise<void>((resolve) => {
      backendServer = app.listen(0, '127.0.0.1', () => resolve());
    });
    const address = backendServer.address();
    if (!address || typeof address === 'string') {
      throw new Error('Expected the test backend to bind to a TCP port.');
    }
    apiUrl = `http://127.0.0.1:${address.port}/api/v1`;

    const user = await registerTestUser('_oauth_smoke');
    email = user.email;
    password = 'TestPassword123!';
  });

  afterAll(async () => {
    if (backendServer) {
      await new Promise<void>((resolve) => backendServer.close(() => resolve()));
    }
  });

  it('runs the full DCR + authorize + real login + token exchange dance against a real account', async () => {
    if (!dbAvailable) {
      console.warn(
        'Skipping OAuth smoke test: CouchDB not reachable at ' + process.env.COUCHDB_URL,
      );
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { startHttpServer } = require(DIST_HTTP_SERVER);

    // MM_MCP_PUBLIC_URL must be known before startHttpServer mounts OAuth
    // metadata routes, so grab a free port first rather than using 0.
    const probePort = await new Promise<number>((resolve, reject) => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const net = require('node:net');
      const probe = net.createServer();
      probe.listen(0, () => {
        const probeAddress = probe.address();
        probe.close(() => resolve(probeAddress.port));
      });
      probe.on('error', reject);
    });
    const publicUrl = `http://127.0.0.1:${probePort}`;

    const mcpServer: HttpServer = await startHttpServer({
      MM_API_URL: apiUrl,
      MM_MCP_PORT: String(probePort),
      MM_MCP_PUBLIC_URL: publicUrl,
    });

    try {
      const asMetadata = (await (
        await fetch(`${publicUrl}/.well-known/oauth-authorization-server`)
      ).json()) as {
        authorization_endpoint: string;
        token_endpoint: string;
        registration_endpoint: string;
      };

      const redirectUri = 'http://127.0.0.1:1/callback';
      const registerResponse = await fetch(asMetadata.registration_endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          redirect_uris: [redirectUri],
          token_endpoint_auth_method: 'none',
          client_name: 'OAuth Smoke Test Client',
        }),
      });
      expect(registerResponse.status).toBe(201);
      const client = (await registerResponse.json()) as { client_id: string };

      const codeVerifier = randomBytes(32).toString('base64url');
      const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url');
      const authorizeUrl = new URL(asMetadata.authorization_endpoint);
      authorizeUrl.searchParams.set('response_type', 'code');
      authorizeUrl.searchParams.set('client_id', client.client_id);
      authorizeUrl.searchParams.set('redirect_uri', redirectUri);
      authorizeUrl.searchParams.set('code_challenge', codeChallenge);
      authorizeUrl.searchParams.set('code_challenge_method', 'S256');
      authorizeUrl.searchParams.set('state', 'e2e-state');
      authorizeUrl.searchParams.set('scope', 'transactions:rw reports:r');

      const authorizeResponse = await fetch(authorizeUrl, { redirect: 'manual' });
      expect(authorizeResponse.status).toBeGreaterThanOrEqual(300);
      expect(authorizeResponse.status).toBeLessThan(400);
      const loginPageUrl = new URL(authorizeResponse.headers.get('location')!, publicUrl);
      expect(loginPageUrl.pathname).toBe('/oauth/login');

      const loginPageHtml = await (await fetch(loginPageUrl)).text();
      expect(loginPageHtml).toContain('OAuth Smoke Test Client');
      expect(loginPageHtml).toContain('transactions:rw');

      const requestId = loginPageUrl.searchParams.get('req')!;

      // Wrong password against the real account must be rejected for real.
      const wrongPasswordResponse = await fetch(`${publicUrl}/oauth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ req: requestId, email, password: 'WrongPassword!' }),
      });
      expect(wrongPasswordResponse.status).toBe(401);

      const loginSubmitResponse = await fetch(`${publicUrl}/oauth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ req: requestId, email, password }),
        redirect: 'manual',
      });
      expect(loginSubmitResponse.status).toBeGreaterThanOrEqual(300);
      expect(loginSubmitResponse.status).toBeLessThan(400);
      const finalRedirect = new URL(loginSubmitResponse.headers.get('location')!);
      expect(finalRedirect.origin + finalRedirect.pathname).toBe(redirectUri);
      expect(finalRedirect.searchParams.get('state')).toBe('e2e-state');
      const code = finalRedirect.searchParams.get('code');
      expect(code).toBeTruthy();

      const tokenResponse = await fetch(asMetadata.token_endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code: code!,
          redirect_uri: redirectUri,
          client_id: client.client_id,
          code_verifier: codeVerifier,
        }),
      });
      expect(tokenResponse.status).toBe(200);
      const tokens = (await tokenResponse.json()) as { access_token: string; token_type: string };
      expect(tokens.access_token).toMatch(/^mmpat_/); // a real PAT, not a synthetic value
      expect(tokens.token_type).toBe('bearer');

      // The minted PAT must actually show up as a real row in the account's token list.
      const loginJwtResponse = await fetch(`${apiUrl.replace(/\/api\/v1$/, '')}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const sessionCookie = loginJwtResponse.headers
        .getSetCookie()
        .find((cookie) => cookie.startsWith('access_token='))!;
      const sessionJwt = decodeURIComponent(sessionCookie.split('access_token=')[1].split(';')[0]);
      const tokenListResponse = await fetch(`${apiUrl}/auth/tokens`, {
        headers: { Authorization: `Bearer ${sessionJwt}` },
      });
      const tokenList = (await tokenListResponse.json()) as { tokens: Array<{ name: string }> };
      expect(tokenList.tokens.some((t) => t.name.includes('OAuth Smoke Test Client'))).toBe(true);

      // Finally, use the OAuth-issued token against the real protected /mcp resource.
      const transport = new StreamableHTTPClientTransport(new URL('/mcp', publicUrl), {
        requestInit: { headers: { Authorization: `Bearer ${tokens.access_token}` } },
      });
      const mcpClient = new Client({ name: 'oauth-smoke-test-client', version: '0.0.0' });
      try {
        await mcpClient.connect(transport);
        const toolList = await mcpClient.listTools();
        expect(toolList.tools.length).toBeGreaterThan(10);

        const identity = await mcpClient.callTool({ name: 'get_identity', arguments: {} });
        expect(identity.isError).toBeFalsy();
        const identityBody = JSON.parse((identity.content as Array<{ text: string }>)[0].text);
        expect(identityBody.authenticationType).toBe('token');
        expect(identityBody.scopes).toEqual(
          expect.arrayContaining(['transactions:rw', 'reports:r']),
        );
      } finally {
        await mcpClient.close();
      }
    } finally {
      await new Promise<void>((resolve) => mcpServer.close(() => resolve()));
    }
  }, 30000);
});
