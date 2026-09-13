import type { Response } from 'express';
import type { OAuthClientInformationFull } from '@modelcontextprotocol/sdk/shared/auth.js';
import { DEFAULT_SCOPES, MoneyManagerOAuthProvider } from '../../src/oauth/provider';
import * as backendClient from '../../src/oauth/backend-client';

jest.mock('../../src/oauth/backend-client');

const mockedBackend = jest.mocked(backendClient);

function fakeClient(
  overrides: Partial<OAuthClientInformationFull> = {},
): OAuthClientInformationFull {
  return {
    client_id: 'client_123',
    client_id_issued_at: Math.floor(Date.now() / 1000),
    redirect_uris: ['https://claude.ai/callback'],
    client_name: 'Claude',
    ...overrides,
  } as OAuthClientInformationFull;
}

function fakeRes(): Response & { redirectedTo?: string } {
  const res = {} as Response & { redirectedTo?: string };
  res.redirect = jest.fn((url: string) => {
    res.redirectedTo = url;
    return res;
  }) as unknown as Response['redirect'];
  return res;
}

describe('MoneyManagerOAuthProvider', () => {
  const apiUrl = 'http://backend:3000/api/v1';

  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe('authorize', () => {
    it('rejects a redirect_uri not registered for the client', async () => {
      const provider = new MoneyManagerOAuthProvider(apiUrl);
      const client = fakeClient();
      await expect(
        provider.authorize(
          client,
          {
            codeChallenge: 'challenge',
            redirectUri: 'https://evil.example.com/callback',
          },
          fakeRes(),
        ),
      ).rejects.toThrow(/redirect_uri/i);
    });

    it('stashes the pending request and redirects into the internal login page', async () => {
      const provider = new MoneyManagerOAuthProvider(apiUrl);
      const client = fakeClient();
      const res = fakeRes();
      await provider.authorize(
        client,
        { codeChallenge: 'challenge', redirectUri: 'https://claude.ai/callback', state: 'xyz' },
        res,
      );
      expect(res.redirectedTo).toMatch(/^\/oauth\/login\?req=/);
      const requestId = res.redirectedTo!.split('req=')[1];
      expect(provider.getPendingRequest(requestId)).toBeDefined();
    });
  });

  describe('completeLogin', () => {
    it('mints a PAT with the requested scopes and redirects with a single-use code + state', async () => {
      mockedBackend.loginWithPassword.mockResolvedValue('session-jwt');
      mockedBackend.mintPersonalAccessToken.mockResolvedValue({
        token: 'mmpat_minted',
        scopes: ['transactions:rw'],
      });

      const provider = new MoneyManagerOAuthProvider(apiUrl);
      const client = fakeClient();
      const res = fakeRes();
      await provider.authorize(
        client,
        {
          codeChallenge: 'challenge',
          redirectUri: 'https://claude.ai/callback',
          state: 'xyz',
          scopes: ['transactions:rw'],
        },
        res,
      );
      const requestId = res.redirectedTo!.split('req=')[1];

      const redirectUrl = await provider.completeLogin(requestId, 'me@example.com', 'hunter2');

      expect(mockedBackend.loginWithPassword).toHaveBeenCalledWith(
        apiUrl,
        'me@example.com',
        'hunter2',
      );
      expect(mockedBackend.mintPersonalAccessToken).toHaveBeenCalledWith(apiUrl, 'session-jwt', {
        name: 'Claude (OAuth)',
        scopes: ['transactions:rw'],
      });

      const parsed = new URL(redirectUrl);
      expect(parsed.origin + parsed.pathname).toBe('https://claude.ai/callback');
      expect(parsed.searchParams.get('state')).toBe('xyz');
      const code = parsed.searchParams.get('code');
      expect(code).toBeTruthy();

      // The code is single-use: exchanging it twice must fail the second time.
      const tokens = await provider.exchangeAuthorizationCode(client, code!);
      expect(tokens).toEqual({
        access_token: 'mmpat_minted',
        token_type: 'bearer',
        scope: 'transactions:rw',
      });
      await expect(provider.exchangeAuthorizationCode(client, code!)).rejects.toThrow(
        /unknown or expired/i,
      );
    });

    it('falls back to DEFAULT_SCOPES when the client requested none', async () => {
      mockedBackend.loginWithPassword.mockResolvedValue('session-jwt');
      mockedBackend.mintPersonalAccessToken.mockResolvedValue({
        token: 'mmpat_minted',
        scopes: DEFAULT_SCOPES,
      });

      const provider = new MoneyManagerOAuthProvider(apiUrl);
      const res = fakeRes();
      await provider.authorize(
        fakeClient(),
        { codeChallenge: 'challenge', redirectUri: 'https://claude.ai/callback' },
        res,
      );
      const requestId = res.redirectedTo!.split('req=')[1];

      await provider.completeLogin(requestId, 'me@example.com', 'hunter2');

      expect(mockedBackend.mintPersonalAccessToken).toHaveBeenCalledWith(
        apiUrl,
        'session-jwt',
        expect.objectContaining({ scopes: DEFAULT_SCOPES }),
      );
    });

    it('never requests the admin scope even if the client asked for it', async () => {
      mockedBackend.loginWithPassword.mockResolvedValue('session-jwt');
      mockedBackend.mintPersonalAccessToken.mockResolvedValue({ token: 'mmpat_x', scopes: [] });

      const provider = new MoneyManagerOAuthProvider(apiUrl);
      const res = fakeRes();
      await provider.authorize(
        fakeClient(),
        {
          codeChallenge: 'challenge',
          redirectUri: 'https://claude.ai/callback',
          scopes: ['admin', 'transactions:rw'],
        },
        res,
      );
      const requestId = res.redirectedTo!.split('req=')[1];

      await provider.completeLogin(requestId, 'me@example.com', 'hunter2');

      expect(mockedBackend.mintPersonalAccessToken).toHaveBeenCalledWith(
        apiUrl,
        'session-jwt',
        expect.objectContaining({ scopes: ['transactions:rw'] }),
      );
    });

    it('surfaces a login failure without minting a token', async () => {
      mockedBackend.loginWithPassword.mockRejectedValue(new Error('Invalid email or password.'));

      const provider = new MoneyManagerOAuthProvider(apiUrl);
      const res = fakeRes();
      await provider.authorize(
        fakeClient(),
        { codeChallenge: 'challenge', redirectUri: 'https://claude.ai/callback' },
        res,
      );
      const requestId = res.redirectedTo!.split('req=')[1];

      await expect(provider.completeLogin(requestId, 'me@example.com', 'wrong')).rejects.toThrow(
        /invalid email or password/i,
      );
      expect(mockedBackend.mintPersonalAccessToken).not.toHaveBeenCalled();
      // The pending request survives a failed attempt so the user can retry.
      expect(provider.getPendingRequest(requestId)).toBeDefined();
    });

    it('rejects an unknown/expired request id', async () => {
      const provider = new MoneyManagerOAuthProvider(apiUrl);
      await expect(provider.completeLogin('not-a-real-id', 'a@b.com', 'pw')).rejects.toThrow(
        /expired/i,
      );
    });
  });

  describe('exchangeRefreshToken', () => {
    it('always throws — this server never issues refresh tokens', async () => {
      const provider = new MoneyManagerOAuthProvider(apiUrl);
      await expect(provider.exchangeRefreshToken()).rejects.toThrow(/refresh/i);
    });
  });

  describe('verifyAccessToken', () => {
    it('delegates to GET /me and maps the result to AuthInfo', async () => {
      mockedBackend.getCurrentIdentity.mockResolvedValue({
        userId: 'user_42',
        scopes: ['transactions:rw'],
      });
      const provider = new MoneyManagerOAuthProvider(apiUrl);
      const info = await provider.verifyAccessToken('mmpat_abc');
      expect(mockedBackend.getCurrentIdentity).toHaveBeenCalledWith(apiUrl, 'mmpat_abc');
      expect(info).toEqual(
        expect.objectContaining({
          token: 'mmpat_abc',
          clientId: 'user_42',
          scopes: ['transactions:rw'],
          expiresAt: expect.any(Number),
        }),
      );
    });

    it('rejects with InvalidTokenError (not a bare Error) so the resource server maps it to 401', async () => {
      mockedBackend.getCurrentIdentity.mockRejectedValue(new Error('backend said no'));
      const provider = new MoneyManagerOAuthProvider(apiUrl);
      await expect(provider.verifyAccessToken('bad-token')).rejects.toMatchObject({
        name: 'InvalidTokenError',
      });
    });
  });
});
