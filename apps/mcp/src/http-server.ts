import type { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import type { Server as HttpServer } from 'node:http';
import { createMcpExpressApp } from '@modelcontextprotocol/sdk/server/express.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { loadHttpConfig } from './config.js';
import { buildServer } from './index.js';

/**
 * Extracts the bearer token from an `Authorization: Bearer <token>` header.
 * This IS the auth model for the HTTP transport (docs/adr/0008): no OAuth,
 * no dynamic client registration — a session's PAT is exactly the token a
 * client already has for the REST API (ADR-0006), reused as-is. Deploy this
 * behind TLS (the existing self-hosted ingress/reverse proxy) since the
 * token travels as a plain bearer header, same as every other API call.
 */
export function extractBearerToken(req: Request): string | undefined {
  const header = req.headers.authorization;
  if (!header) return undefined;
  const match = /^Bearer (.+)$/i.exec(header);
  return match?.[1];
}

function jsonRpcError(res: Response, status: number, code: number, message: string): void {
  res.status(status).json({ jsonrpc: '2.0', error: { code, message }, id: null });
}

/**
 * Starts the Streamable HTTP transport (docs/adr/0008's deferred "remote/
 * multi-user use" transport, e.g. claude.ai connectors) alongside the
 * existing stdio transport used by Claude Code/Desktop. One session per
 * initialize call, each bound to the PAT its own Authorization header
 * carried at session-creation time — sessions never share a client/token.
 */
export async function startHttpServer(env: NodeJS.ProcessEnv = process.env): Promise<HttpServer> {
  const { apiUrl, port } = loadHttpConfig(env);
  const sessions = new Map<string, StreamableHTTPServerTransport>();

  const app = createMcpExpressApp({
    host: '0.0.0.0',
    allowedHosts: env.MM_MCP_ALLOWED_HOSTS?.split(','),
  });

  const handlePost = async (req: Request, res: Response): Promise<void> => {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;

    const existing = sessionId ? sessions.get(sessionId) : undefined;
    if (existing) {
      await existing.handleRequest(req, res, req.body);
      return;
    }

    if (sessionId) {
      // A session ID was presented but isn't known to this process (expired,
      // or this server restarted) — this must not silently fall through to
      // "start a new session", or a stale session ID would ever create one.
      jsonRpcError(res, 404, -32001, 'Session not found. Reconnect without a session ID.');
      return;
    }

    if (!isInitializeRequest(req.body)) {
      jsonRpcError(res, 400, -32000, 'Bad Request: No valid session ID provided.');
      return;
    }

    const apiToken = extractBearerToken(req);
    if (!apiToken) {
      jsonRpcError(
        res,
        401,
        -32001,
        'Missing bearer token: send your Money Manager personal access token as ' +
          '"Authorization: Bearer <token>" on the initialize request.',
      );
      return;
    }

    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (newSessionId) => {
        sessions.set(newSessionId, transport);
      },
    });
    transport.onclose = () => {
      const sid = transport.sessionId;
      if (sid) sessions.delete(sid);
    };

    const server = buildServer({ apiUrl, apiToken });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  };

  const handleSessionRequest = async (req: Request, res: Response): Promise<void> => {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;
    const transport = sessionId ? sessions.get(sessionId) : undefined;
    if (!transport) {
      res.status(400).send('Invalid or missing session ID');
      return;
    }
    await transport.handleRequest(req, res);
  };

  app.post('/mcp', (req, res) => {
    handlePost(req, res).catch((error) => {
      console.error('money-manager-mcp: error handling POST /mcp:', error);
      if (!res.headersSent) jsonRpcError(res, 500, -32603, 'Internal server error');
    });
  });
  app.get('/mcp', (req, res) => {
    handleSessionRequest(req, res).catch((error) => {
      console.error('money-manager-mcp: error handling GET /mcp:', error);
      if (!res.headersSent) res.status(500).send('Internal server error');
    });
  });
  app.delete('/mcp', (req, res) => {
    handleSessionRequest(req, res).catch((error) => {
      console.error('money-manager-mcp: error handling DELETE /mcp:', error);
      if (!res.headersSent) res.status(500).send('Internal server error');
    });
  });

  return new Promise<HttpServer>((resolve, reject) => {
    const server = app
      .listen(port, () => {
        const address = server.address();
        const boundPort = typeof address === 'object' && address ? address.port : port;
        console.error(
          `money-manager-mcp: Streamable HTTP transport listening on :${boundPort}/mcp`,
        );
        resolve(server);
      })
      .on('error', reject);
  });
}
