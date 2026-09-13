import type { Server as HttpServer } from 'node:http';
import type { Request } from 'express';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { extractBearerToken, startHttpServer } from '../../src/http-server';

function addressUrl(server: HttpServer): URL {
  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Expected the test server to bind to a TCP port.');
  }
  return new URL(`http://127.0.0.1:${address.port}/mcp`);
}

function fakeRequest(authorization?: string): Request {
  return { headers: authorization !== undefined ? { authorization } : {} } as unknown as Request;
}

describe('extractBearerToken', () => {
  it('extracts the token from a well-formed Authorization header', () => {
    expect(extractBearerToken(fakeRequest('Bearer mmpat_abc123'))).toBe('mmpat_abc123');
  });

  it('is case-insensitive on the "Bearer" scheme', () => {
    expect(extractBearerToken(fakeRequest('bearer mmpat_abc123'))).toBe('mmpat_abc123');
  });

  it('returns undefined when the header is missing', () => {
    expect(extractBearerToken(fakeRequest())).toBeUndefined();
  });

  it('returns undefined for a non-Bearer scheme', () => {
    expect(extractBearerToken(fakeRequest('Basic dXNlcjpwYXNz'))).toBeUndefined();
  });
});

describe('startHttpServer (Streamable HTTP transport)', () => {
  let server: HttpServer;

  afterEach(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('rejects an initialize request with no Authorization header', async () => {
    server = await startHttpServer({ MM_API_URL: 'http://localhost:0/api/v1', MM_MCP_PORT: '0' });
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
  });

  it('rejects a request carrying an unknown session ID (does not silently start a new one)', async () => {
    server = await startHttpServer({ MM_API_URL: 'http://localhost:0/api/v1', MM_MCP_PORT: '0' });
    const response = await fetch(addressUrl(server), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        'mcp-session-id': 'not-a-real-session',
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }),
    });
    expect(response.status).toBe(404);
  });

  it('accepts a valid bearer token, lists tools, and calls explain_concept over a real session', async () => {
    server = await startHttpServer({ MM_API_URL: 'http://localhost:0/api/v1', MM_MCP_PORT: '0' });
    const transport = new StreamableHTTPClientTransport(addressUrl(server), {
      requestInit: { headers: { Authorization: 'Bearer mmpat_test-token' } },
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
    server = await startHttpServer({ MM_API_URL: 'http://localhost:0/api/v1', MM_MCP_PORT: '0' });
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
