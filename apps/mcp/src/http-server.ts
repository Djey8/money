import express, { type Request, type Response } from 'express';
import { randomUUID } from 'node:crypto';
import type { Server as HttpServer } from 'node:http';
import { createMcpExpressApp } from '@modelcontextprotocol/sdk/server/express.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import {
  getOAuthProtectedResourceMetadataUrl,
  mcpAuthRouter,
} from '@modelcontextprotocol/sdk/server/auth/router.js';
import { requireBearerAuth } from '@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js';
import { loadHttpConfig } from './config.js';
import { buildServer } from './index.js';
import { DEFAULT_SCOPES, MoneyManagerOAuthProvider } from './oauth/provider.js';
import { renderExpiredPage, renderLoginPage } from './oauth/login-page.js';

function jsonRpcError(res: Response, status: number, code: number, message: string): void {
  res.status(status).json({ jsonrpc: '2.0', error: { code, message }, id: null });
}

/**
 * Starts the Streamable HTTP transport (docs/adr/0008's deferred "remote/
 * multi-user use" transport, e.g. claude.ai connectors) alongside the
 * existing stdio transport used by Claude Code/Desktop. Every caller — one
 * that went through the browser OAuth flow below, or one that just pastes a
 * PAT minted via `POST /auth/tokens`/`mm-admin token create` directly —
 * authenticates the same way: a Bearer token verified against the real
 * backend (MoneyManagerOAuthProvider.verifyAccessToken calls GET /me), one
 * MCP session per successfully-verified initialize call.
 */
export async function startHttpServer(env: NodeJS.ProcessEnv = process.env): Promise<HttpServer> {
  const { apiUrl, port, publicUrl } = loadHttpConfig(env);
  const sessions = new Map<string, StreamableHTTPServerTransport>();
  const provider = new MoneyManagerOAuthProvider(apiUrl);
  const issuerUrl = new URL(publicUrl);
  const mcpResourceUrl = new URL('/mcp', publicUrl);

  const app = createMcpExpressApp({
    host: '0.0.0.0',
    allowedHosts: env.MM_MCP_ALLOWED_HOSTS?.split(','),
  });
  app.use(express.urlencoded({ extended: false }));

  // Mounts /authorize, /token, /register, /revoke, and the AS/RS metadata
  // documents (/.well-known/oauth-authorization-server,
  // /.well-known/oauth-protected-resource) — see MoneyManagerOAuthProvider's
  // doc comment for what "authorize"/"token" actually do here.
  app.use(
    mcpAuthRouter({
      provider,
      issuerUrl,
      resourceServerUrl: mcpResourceUrl,
      resourceName: 'Money Manager',
      scopesSupported: [...DEFAULT_SCOPES, 'admin'],
    }),
  );

  app.get('/oauth/login', (req, res) => {
    const requestId = typeof req.query.req === 'string' ? req.query.req : undefined;
    const pending = requestId ? provider.getPendingRequest(requestId) : undefined;
    if (!requestId || !pending) {
      res.status(400).type('html').send(renderExpiredPage());
      return;
    }
    const scopes = (pending.params.scopes ?? []).filter((scope) => scope !== 'admin');
    res.type('html').send(
      renderLoginPage({
        requestId,
        clientName: pending.client.client_name ?? pending.client.client_id,
        scopes: scopes.length > 0 ? scopes : DEFAULT_SCOPES,
      }),
    );
  });

  app.post('/oauth/login', (req, res) => {
    const body = req.body as { req?: string; email?: string; password?: string };
    const requestId = body.req;
    const pending = requestId ? provider.getPendingRequest(requestId) : undefined;
    if (!requestId || !pending) {
      res.status(400).type('html').send(renderExpiredPage());
      return;
    }
    const email = body.email ?? '';
    const password = body.password ?? '';
    const scopes = (pending.params.scopes ?? []).filter((scope) => scope !== 'admin');
    const displayScopes = scopes.length > 0 ? scopes : DEFAULT_SCOPES;

    provider
      .completeLogin(requestId, email, password)
      .then((redirectUrl) => res.redirect(redirectUrl))
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : 'Sign-in failed.';
        res
          .status(401)
          .type('html')
          .send(
            renderLoginPage({
              requestId,
              clientName: pending.client.client_name ?? pending.client.client_id,
              scopes: displayScopes,
              error: message,
            }),
          );
      });
  });

  const resourceMetadataUrl = getOAuthProtectedResourceMetadataUrl(mcpResourceUrl);
  const requireAuth = requireBearerAuth({ verifier: provider, resourceMetadataUrl });

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

    // requireBearerAuth (mounted below) already verified req.auth.token
    // against the backend before this handler ever runs.
    const apiToken = req.auth?.token;
    if (!apiToken) {
      jsonRpcError(res, 401, -32001, 'Missing or invalid bearer token.');
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

  app.post('/mcp', requireAuth, (req, res) => {
    handlePost(req, res).catch((error) => {
      console.error('money-manager-mcp: error handling POST /mcp:', error);
      if (!res.headersSent) jsonRpcError(res, 500, -32603, 'Internal server error');
    });
  });
  app.get('/mcp', requireAuth, (req, res) => {
    handleSessionRequest(req, res).catch((error) => {
      console.error('money-manager-mcp: error handling GET /mcp:', error);
      if (!res.headersSent) res.status(500).send('Internal server error');
    });
  });
  app.delete('/mcp', requireAuth, (req, res) => {
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
          `money-manager-mcp: Streamable HTTP transport listening on :${boundPort}/mcp ` +
            `(OAuth issuer: ${issuerUrl.toString()})`,
        );
        resolve(server);
      })
      .on('error', reject);
  });
}
