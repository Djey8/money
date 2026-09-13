import { randomBytes, randomUUID } from 'node:crypto';
import type { Response } from 'express';
import type {
  AuthorizationParams,
  OAuthServerProvider,
} from '@modelcontextprotocol/sdk/server/auth/provider.js';
import type { OAuthRegisteredClientsStore } from '@modelcontextprotocol/sdk/server/auth/clients.js';
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';
import type {
  OAuthClientInformationFull,
  OAuthTokens,
} from '@modelcontextprotocol/sdk/shared/auth.js';
import {
  InvalidGrantError,
  InvalidRequestError,
  InvalidTokenError,
  UnsupportedGrantTypeError,
} from '@modelcontextprotocol/sdk/server/auth/errors.js';
import {
  getCurrentIdentity,
  loginWithPassword,
  mintPersonalAccessToken,
} from './backend-client.js';

const AUTH_REQUEST_TTL_MS = 10 * 60 * 1000;
const CODE_TTL_MS = 5 * 60 * 1000;

/** Mirrors the "everything except settings/profile" bundle documented on the Pro API docs page. */
export const DEFAULT_SCOPES = [
  'transactions:rw',
  'transactions:bulk',
  'subscriptions:rw',
  'subscriptions:bulk',
  'smile:rw',
  'fire:rw',
  'mojo:rw',
  'grow:rw',
  'balance:rw',
  'budget:rw',
  'income:r',
  'reports:r',
];

class InMemoryClientsStore implements OAuthRegisteredClientsStore {
  private readonly clients = new Map<string, OAuthClientInformationFull>();

  getClient(clientId: string): OAuthClientInformationFull | undefined {
    return this.clients.get(clientId);
  }

  registerClient(
    client: Omit<OAuthClientInformationFull, 'client_id' | 'client_id_issued_at'>,
  ): OAuthClientInformationFull {
    const full = {
      ...client,
      client_id: randomUUID(),
      client_id_issued_at: Math.floor(Date.now() / 1000),
    } as OAuthClientInformationFull;
    this.clients.set(full.client_id, full);
    return full;
  }
}

export interface PendingAuthRequest {
  client: OAuthClientInformationFull;
  params: AuthorizationParams;
  createdAt: number;
}

interface IssuedCode {
  clientId: string;
  scopes: string[];
  codeChallenge: string;
  accessToken: string;
  createdAt: number;
}

/**
 * The MCP OAuth authorization server for this self-hosted instance.
 *
 * This is deliberately NOT a general-purpose OAuth AS: "authorizing" IS
 * logging into the existing account (backend-client.ts's loginWithPassword,
 * hitting the same /api/auth/login every other client uses), and an issued
 * "access token" IS a personal access token minted through the existing
 * POST /auth/tokens (ADR-0006) — reusing that scope/revocation model
 * wholesale rather than building a second one. See docs/adr/0008.
 *
 * No refresh tokens are issued (PATs don't expire on an OAuth-style
 * schedule, so there's nothing to refresh) and client registrations/pending
 * requests/codes live only in this process's memory — a restart means
 * clients must re-register and any in-flight authorization must restart.
 * Acceptable for a personal, low-traffic deployment; would need persistent
 * storage for a multi-replica one.
 */
export class MoneyManagerOAuthProvider implements OAuthServerProvider {
  readonly clientsStore = new InMemoryClientsStore();
  private readonly pendingRequests = new Map<string, PendingAuthRequest>();
  private readonly codes = new Map<string, IssuedCode>();

  constructor(private readonly apiUrl: string) {}

  async authorize(
    client: OAuthClientInformationFull,
    params: AuthorizationParams,
    res: Response,
  ): Promise<void> {
    if (!client.redirect_uris.includes(params.redirectUri)) {
      throw new InvalidRequestError('redirect_uri is not registered for this client.');
    }
    this.prune();
    const requestId = randomUUID();
    this.pendingRequests.set(requestId, { client, params, createdAt: Date.now() });
    res.redirect(`/oauth/login?req=${requestId}`);
  }

  async challengeForAuthorizationCode(
    _client: OAuthClientInformationFull,
    authorizationCode: string,
  ): Promise<string> {
    const code = this.codes.get(authorizationCode);
    if (!code) throw new InvalidGrantError('Unknown or expired authorization code.');
    return code.codeChallenge;
  }

  // Code verifier / PKCE is checked by the SDK's token handler itself
  // (using challengeForAuthorizationCode's return value) before this is
  // called — see the SDK's demoInMemoryOAuthProvider.js for the same
  // convention.
  async exchangeAuthorizationCode(
    client: OAuthClientInformationFull,
    authorizationCode: string,
  ): Promise<OAuthTokens> {
    const code = this.codes.get(authorizationCode);
    if (!code) throw new InvalidGrantError('Unknown or expired authorization code.');
    if (code.clientId !== client.client_id) {
      throw new InvalidGrantError('This authorization code was not issued to this client.');
    }
    this.codes.delete(authorizationCode); // single use
    return {
      access_token: code.accessToken,
      token_type: 'bearer',
      scope: code.scopes.join(' '),
    };
  }

  async exchangeRefreshToken(): Promise<OAuthTokens> {
    throw new UnsupportedGrantTypeError('This server does not issue refresh tokens.');
  }

  async verifyAccessToken(token: string): Promise<AuthInfo> {
    // requireBearerAuth maps only InvalidTokenError/InsufficientScopeError/
    // OAuthError to a 401/403 — anything else becomes a bare 500 — so a
    // failed backend check must be re-thrown as InvalidTokenError, not left
    // as getCurrentIdentity's plain Error.
    let identity;
    try {
      identity = await getCurrentIdentity(this.apiUrl, token);
    } catch {
      throw new InvalidTokenError('Invalid or expired access token.');
    }
    // requireBearerAuth also requires a numeric expiresAt (it rejects tokens
    // that report none) even though the underlying PAT itself may never
    // expire. This isn't the PAT's real expiry — GET /me doesn't return one
    // — it's a validity window for this specific check, harmless because
    // every /mcp request re-verifies against the live backend rather than
    // trusting a cached result past this window.
    const expiresAt = Math.floor(Date.now() / 1000) + 3600;
    return { token, clientId: identity.userId, scopes: identity.scopes, expiresAt };
  }

  getPendingRequest(requestId: string): PendingAuthRequest | undefined {
    this.prune();
    return this.pendingRequests.get(requestId);
  }

  /**
   * Called by the POST /oauth/login route once the browser has submitted
   * credentials for a pending request. Verifies the password, mints a PAT
   * scoped to what was requested (falling back to DEFAULT_SCOPES when the
   * client asked for none — admin is always stripped, matching the API's
   * own refusal to ever issue admin to a PAT), and returns the final
   * redirect_uri the caller should send the browser to.
   */
  async completeLogin(requestId: string, email: string, password: string): Promise<string> {
    this.prune();
    const pending = this.pendingRequests.get(requestId);
    if (!pending) {
      throw new Error('This sign-in link has expired. Go back and try connecting again.');
    }

    const sessionToken = await loginWithPassword(this.apiUrl, email, password);

    const requested = (pending.params.scopes ?? []).filter((scope) => scope !== 'admin');
    const scopes = requested.length > 0 ? requested : DEFAULT_SCOPES;
    const minted = await mintPersonalAccessToken(this.apiUrl, sessionToken, {
      name: `${pending.client.client_name ?? pending.client.client_id} (OAuth)`,
      scopes,
    });

    this.pendingRequests.delete(requestId);

    const code = randomBytes(32).toString('base64url');
    this.codes.set(code, {
      clientId: pending.client.client_id,
      scopes: minted.scopes,
      codeChallenge: pending.params.codeChallenge,
      accessToken: minted.token,
      createdAt: Date.now(),
    });

    const redirectUrl = new URL(pending.params.redirectUri);
    redirectUrl.searchParams.set('code', code);
    if (pending.params.state !== undefined) {
      redirectUrl.searchParams.set('state', pending.params.state);
    }
    return redirectUrl.toString();
  }

  private prune(): void {
    const now = Date.now();
    for (const [id, request] of this.pendingRequests) {
      if (now - request.createdAt > AUTH_REQUEST_TTL_MS) this.pendingRequests.delete(id);
    }
    for (const [code, data] of this.codes) {
      if (now - data.createdAt > CODE_TTL_MS) this.codes.delete(code);
    }
  }
}
