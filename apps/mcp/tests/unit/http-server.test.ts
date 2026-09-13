import type { Server as HttpServer } from 'node:http';
import { createServer } from 'node:net';
import { createHash, randomBytes } from 'node:crypto';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { startHttpServer } from '../../src/http-server';
import * as backendClient from '../../src/oauth/backend-client';

jest.mock('../../src/oauth/backend-client');
const mockedBackend = jest.mocked(backendClient);

async function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.listen(0, () => {
      const address = probe.address();
      if (address && typeof address === 'object') {
        const { port } = address;
        probe.close(() => resolve(port));
      } else {
        probe.close(() => reject(new Error('Could not determine a free port')));
      }
    });
    probe.on('error', reject);
  });
}

function addressUrl(server: HttpServer, path = '/mcp'): URL {
  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Expected the test server to bind to a TCP port.');
  }
  return new URL(`http://127.0.0.1:${address.port}${path}`);
}

/**
 * Every real network call GET /me could make is mocked here (see
 * jest.mock above) — these tests never touch a real backend, matching the
 * "fast targeted unit tests while iterating" convention. Only tokens
 * starting with "mmpat_valid" verify successfully, mirroring how the real
 * backend would reject an unrecognized token.
 */
function mockIdentityFor(
  validToken: string,
  identity = { userId: 'user_1', scopes: ['transactions:rw'] },
) {
  mockedBackend.getCurrentIdentity.mockImplementation((_apiUrl, token) => {
    if (token === validToken) return Promise.resolve(identity);
    return Promise.reject(new Error('Invalid or expired access token.'));
  });
}

describe('startHttpServer (Streamable HTTP transport, resource server)', () => {
  let server: HttpServer;

  afterEach(async () => {
    jest.resetAllMocks();
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('rejects an initialize request with no Authorization header', async () => {
    const port = await getFreePort();
    server = await startHttpServer({
      MM_API_URL: 'http://backend/api/v1',
      MM_MCP_PORT: String(port),
    });
    const response = await fetch(addressUrl(server), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'test-client', version: '0.0.0' },
        },
      }),
    });
    expect(response.status).toBe(401);
    expect(mockedBackend.getCurrentIdentity).not.toHaveBeenCalled();
  });

  it('rejects a bearer token that fails backend verification', async () => {
    mockIdentityFor('mmpat_valid');
    const port = await getFreePort();
    server = await startHttpServer({
      MM_API_URL: 'http://backend/api/v1',
      MM_MCP_PORT: String(port),
    });
    const response = await fetch(addressUrl(server), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        Authorization: 'Bearer mmpat_wrong',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'x', version: '0' },
        },
      }),
    });
    expect(response.status).toBe(401);
  });

  it('rejects a request carrying an unknown session ID (does not silently start a new one)', async () => {
    mockIdentityFor('mmpat_valid');
    const port = await getFreePort();
    server = await startHttpServer({
      MM_API_URL: 'http://backend/api/v1',
      MM_MCP_PORT: String(port),
    });
    const response = await fetch(addressUrl(server), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        Authorization: 'Bearer mmpat_valid',
        'mcp-session-id': 'not-a-real-session',
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }),
    });
    expect(response.status).toBe(404);
  });

  it('accepts a valid bearer token, lists tools, and calls explain_concept over a real session', async () => {
    mockIdentityFor('mmpat_valid');
    const port = await getFreePort();
    server = await startHttpServer({
      MM_API_URL: 'http://backend/api/v1',
      MM_MCP_PORT: String(port),
    });
    const transport = new StreamableHTTPClientTransport(addressUrl(server), {
      requestInit: { headers: { Authorization: 'Bearer mmpat_valid' } },
    });
    const client = new Client({ name: 'http-transport-test-client', version: '0.0.0' });

    try {
      await client.connect(transport);
      expect(transport.sessionId).toBeDefined();

      const toolList = await client.listTools();
      expect(toolList.tools.map((t) => t.name)).toContain('explain_concept');

      const explainTool = toolList.tools.find((t) => t.name === 'explain_concept');
      const topicEnum =
        (explainTool?.inputSchema.properties?.topic as { enum?: string[] })?.enum ?? [];
      expect(topicEnum.length).toBeGreaterThan(0);

      const result = await client.callTool({
        name: 'explain_concept',
        arguments: { topic: topicEnum[0] },
      });
      expect(result.isError).toBeFalsy();
    } finally {
      await client.close();
    }
  }, 15000);

  it('isolates two sessions from different clients/tokens under the same server', async () => {
    mockedBackend.getCurrentIdentity.mockImplementation((_apiUrl, token) =>
      Promise.resolve({ userId: token, scopes: ['transactions:rw'] }),
    );
    const port = await getFreePort();
    server = await startHttpServer({
      MM_API_URL: 'http://backend/api/v1',
      MM_MCP_PORT: String(port),
    });
    const url = addressUrl(server);

    const transportA = new StreamableHTTPClientTransport(url, {
      requestInit: { headers: { Authorization: 'Bearer mmpat_client-a' } },
    });
    const clientA = new Client({ name: 'client-a', version: '0.0.0' });
    const transportB = new StreamableHTTPClientTransport(url, {
      requestInit: { headers: { Authorization: 'Bearer mmpat_client-b' } },
    });
    const clientB = new Client({ name: 'client-b', version: '0.0.0' });

    try {
      await clientA.connect(transportA);
      await clientB.connect(transportB);
      expect(transportA.sessionId).toBeDefined();
      expect(transportB.sessionId).toBeDefined();
      expect(transportA.sessionId).not.toBe(transportB.sessionId);
    } finally {
      await clientA.close();
      await clientB.close();
    }
  }, 15000);
});

describe('startHttpServer (OAuth authorization server)', () => {
  let server: HttpServer;
  let publicUrl: string;

  afterEach(async () => {
    jest.resetAllMocks();
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  async function boot(): Promise<void> {
    const port = await getFreePort();
    publicUrl = `http://127.0.0.1:${port}`;
    server = await startHttpServer({
      MM_API_URL: 'http://backend/api/v1',
      MM_MCP_PORT: String(port),
      MM_MCP_PUBLIC_URL: publicUrl,
    });
  }

  it('publishes discoverable AS and protected-resource metadata', async () => {
    await boot();
    const asMetadata = (await (
      await fetch(`${publicUrl}/.well-known/oauth-authorization-server`)
    ).json()) as Record<string, unknown>;
    expect(asMetadata.issuer).toBe(`${publicUrl}/`);
    expect(typeof asMetadata.authorization_endpoint).toBe('string');
    expect(typeof asMetadata.token_endpoint).toBe('string');
    expect(typeof asMetadata.registration_endpoint).toBe('string');

    const prmResponse = await fetch(`${publicUrl}/.well-known/oauth-protected-resource/mcp`);
    expect(prmResponse.status).toBe(200);
    const prm = (await prmResponse.json()) as { authorization_servers?: string[] };
    expect(prm.authorization_servers).toContain(`${publicUrl}/`);
  });

  it('advertises the protected-resource metadata URL on a 401 from /mcp', async () => {
    await boot();
    const response = await fetch(new URL('/mcp', publicUrl), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'x', version: '0' },
        },
      }),
    });
    expect(response.status).toBe(401);
    expect(response.headers.get('www-authenticate')).toMatch(/resource_metadata=/);
  });

  it('runs the full DCR + authorize + login + token exchange dance end to end', async () => {
    mockedBackend.loginWithPassword.mockResolvedValue('session-jwt');
    mockedBackend.mintPersonalAccessToken.mockResolvedValue({
      token: 'mmpat_from_oauth',
      scopes: ['transactions:rw', 'reports:r'],
    });
    mockedBackend.getCurrentIdentity.mockImplementation((_apiUrl, token) => {
      if (token === 'mmpat_from_oauth') {
        return Promise.resolve({ userId: 'user_1', scopes: ['transactions:rw', 'reports:r'] });
      }
      return Promise.reject(new Error('Invalid or expired access token.'));
    });
    await boot();

    // 1. Dynamic client registration.
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
        grant_types: ['authorization_code'],
        response_types: ['code'],
        client_name: 'Test Claude Client',
      }),
    });
    expect(registerResponse.status).toBe(201);
    const client = (await registerResponse.json()) as { client_id: string };
    expect(client.client_id).toBeTruthy();

    // 2. Authorization request — PKCE.
    const codeVerifier = randomBytes(32).toString('base64url');
    const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url');
    const authorizeUrl = new URL(asMetadata.authorization_endpoint);
    authorizeUrl.searchParams.set('response_type', 'code');
    authorizeUrl.searchParams.set('client_id', client.client_id);
    authorizeUrl.searchParams.set('redirect_uri', redirectUri);
    authorizeUrl.searchParams.set('code_challenge', codeChallenge);
    authorizeUrl.searchParams.set('code_challenge_method', 'S256');
    authorizeUrl.searchParams.set('state', 'xyz123');
    authorizeUrl.searchParams.set('scope', 'transactions:rw reports:r');

    const authorizeResponse = await fetch(authorizeUrl, { redirect: 'manual' });
    expect(authorizeResponse.status).toBeGreaterThanOrEqual(300);
    expect(authorizeResponse.status).toBeLessThan(400);
    const loginPageUrl = new URL(authorizeResponse.headers.get('location')!, publicUrl);
    expect(loginPageUrl.pathname).toBe('/oauth/login');
    const requestId = loginPageUrl.searchParams.get('req');
    expect(requestId).toBeTruthy();

    // The login page itself renders and shows the requested scopes.
    const loginPageResponse = await fetch(loginPageUrl);
    expect(loginPageResponse.status).toBe(200);
    const loginPageHtml = await loginPageResponse.text();
    expect(loginPageHtml).toContain('transactions:rw');
    expect(loginPageHtml).toContain('Test Claude Client');

    // 3. Submit the login form.
    const loginSubmitResponse = await fetch(`${publicUrl}/oauth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ req: requestId!, email: 'me@example.com', password: 'hunter2' }),
      redirect: 'manual',
    });
    expect(loginSubmitResponse.status).toBeGreaterThanOrEqual(300);
    expect(loginSubmitResponse.status).toBeLessThan(400);
    const finalRedirect = new URL(loginSubmitResponse.headers.get('location')!);
    expect(finalRedirect.origin + finalRedirect.pathname).toBe(redirectUri);
    expect(finalRedirect.searchParams.get('state')).toBe('xyz123');
    const code = finalRedirect.searchParams.get('code');
    expect(code).toBeTruthy();

    // 4. Exchange the code for the access token (= the minted PAT).
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
    expect(tokens.access_token).toBe('mmpat_from_oauth');
    expect(tokens.token_type).toBe('bearer');

    // 5. That access token actually works against the protected /mcp resource.
    const transport = new StreamableHTTPClientTransport(new URL('/mcp', publicUrl), {
      requestInit: { headers: { Authorization: `Bearer ${tokens.access_token}` } },
    });
    const mcpClient = new Client({ name: 'oauth-dance-test-client', version: '0.0.0' });
    try {
      await mcpClient.connect(transport);
      const toolList = await mcpClient.listTools();
      expect(toolList.tools.length).toBeGreaterThan(0);
    } finally {
      await mcpClient.close();
    }
  }, 20000);

  it('rejects a login attempt with a wrong password and lets the user retry', async () => {
    mockedBackend.loginWithPassword.mockRejectedValue(new Error('Invalid email or password.'));
    await boot();

    const asMetadata = (await (
      await fetch(`${publicUrl}/.well-known/oauth-authorization-server`)
    ).json()) as { authorization_endpoint: string; registration_endpoint: string };
    const redirectUri = 'http://127.0.0.1:1/callback';
    const registerResponse = await fetch(asMetadata.registration_endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ redirect_uris: [redirectUri], token_endpoint_auth_method: 'none' }),
    });
    const client = (await registerResponse.json()) as { client_id: string };

    const authorizeUrl = new URL(asMetadata.authorization_endpoint);
    authorizeUrl.searchParams.set('response_type', 'code');
    authorizeUrl.searchParams.set('client_id', client.client_id);
    authorizeUrl.searchParams.set('redirect_uri', redirectUri);
    authorizeUrl.searchParams.set('code_challenge', 'x'.repeat(43));
    authorizeUrl.searchParams.set('code_challenge_method', 'S256');
    const authorizeResponse = await fetch(authorizeUrl, { redirect: 'manual' });
    const loginPageUrl = new URL(authorizeResponse.headers.get('location')!, publicUrl);
    const requestId = loginPageUrl.searchParams.get('req')!;

    const loginSubmitResponse = await fetch(`${publicUrl}/oauth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ req: requestId, email: 'me@example.com', password: 'wrong' }),
    });
    expect(loginSubmitResponse.status).toBe(401);
    const html = await loginSubmitResponse.text();
    expect(html).toContain('Invalid email or password.');
  });
});
