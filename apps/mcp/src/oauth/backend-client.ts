/**
 * Server-to-server calls this OAuth layer makes against the existing
 * backend endpoints — no new backend code is needed for OAuth at all. An
 * "access token" this server issues IS a personal access token minted
 * through the same `POST /auth/tokens` the REST API already exposes
 * (ADR-0006); "authorizing" IS logging into the existing `/api/auth/login`.
 * See docs/adr/0008's OAuth section.
 */

function backendOrigin(apiUrl: string): string {
  return apiUrl.replace(/\/api\/v1\/?$/, '');
}

function trimTrailingSlash(url: string): string {
  return url.replace(/\/+$/, '');
}

/**
 * `/api/auth/login` sets the session JWT as an httpOnly `access_token`
 * cookie rather than returning it in the JSON body — extract it from
 * Set-Cookie so it can be forwarded as a Bearer header on the next call
 * (`authenticateApiToken` in backend/middleware/api-auth.js accepts a
 * session JWT from either the cookie or the Authorization header equally).
 */
function extractCookie(response: Response, name: string): string | undefined {
  const headers = response.headers as Headers & { getSetCookie?: () => string[] };
  const cookies =
    typeof headers.getSetCookie === 'function'
      ? headers.getSetCookie()
      : (() => {
          const raw = headers.get('set-cookie');
          return raw ? [raw] : [];
        })();
  for (const cookie of cookies) {
    const match = new RegExp(`(?:^|;\\s*)${name}=([^;]+)`).exec(cookie);
    if (match) return decodeURIComponent(match[1]);
  }
  return undefined;
}

/**
 * Verifies an email/password against the real account database and returns
 * the resulting session JWT. Throws with a message safe to show the user
 * (never echoes the password, never distinguishes "no such user" from
 * "wrong password" beyond what the backend's own login endpoint already
 * distinguishes).
 */
export async function loginWithPassword(
  apiUrl: string,
  email: string,
  password: string,
): Promise<string> {
  const response = await fetch(`${backendOrigin(apiUrl)}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) {
    throw new Error('Invalid email or password.');
  }
  const sessionToken = extractCookie(response, 'access_token');
  if (!sessionToken) {
    throw new Error('Login succeeded but the server did not return a session token.');
  }
  return sessionToken;
}

export interface MintedToken {
  token: string;
  scopes: string[];
}

/** Mints a PAT via the existing session-authenticated POST /auth/tokens endpoint. */
export async function mintPersonalAccessToken(
  apiUrl: string,
  sessionToken: string,
  options: { name: string; scopes: string[] },
): Promise<MintedToken> {
  const response = await fetch(`${trimTrailingSlash(apiUrl)}/auth/tokens`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionToken}` },
    body: JSON.stringify(options),
  });
  if (!response.ok) {
    throw new Error(`Failed to mint an access token (status ${response.status}).`);
  }
  const body = (await response.json()) as { token: string; scopes: string[] };
  return { token: body.token, scopes: body.scopes };
}

export interface Identity {
  userId: string;
  scopes: string[];
}

/** Introspects a PAT via the existing GET /me endpoint — works for any valid PAT, however it was minted. */
export async function getCurrentIdentity(apiUrl: string, token: string): Promise<Identity> {
  const response = await fetch(`${trimTrailingSlash(apiUrl)}/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    throw new Error('Invalid or expired access token.');
  }
  const body = (await response.json()) as { userId: string; scopes: string[] };
  return { userId: body.userId, scopes: body.scopes };
}
