import {
  getCurrentIdentity,
  loginWithPassword,
  mintPersonalAccessToken,
} from '../../src/oauth/backend-client';

function fakeResponse(options: {
  ok: boolean;
  status?: number;
  json?: unknown;
  setCookie?: string[];
}): Response {
  const { ok, status = ok ? 200 : 401, json, setCookie } = options;
  return {
    ok,
    status,
    json: () => Promise.resolve(json),
    headers: {
      getSetCookie: () => setCookie ?? [],
      get: () => (setCookie ? setCookie.join(', ') : null),
    },
  } as unknown as Response;
}

describe('loginWithPassword', () => {
  const apiUrl = 'http://backend:3000/api/v1';

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('posts to /api/auth/login (not /api/v1) derived from the API URL', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(
        fakeResponse({ ok: true, setCookie: ['access_token=jwt-value; HttpOnly; Path=/'] }),
      );

    await loginWithPassword(apiUrl, 'me@example.com', 'hunter2');

    expect(fetchMock).toHaveBeenCalledWith(
      'http://backend:3000/api/auth/login',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ email: 'me@example.com', password: 'hunter2' }),
      }),
    );
  });

  it('extracts the access_token cookie from Set-Cookie', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(
      fakeResponse({
        ok: true,
        setCookie: ['refresh_token=other; HttpOnly', 'access_token=the-jwt; HttpOnly; Path=/'],
      }),
    );

    const token = await loginWithPassword(apiUrl, 'me@example.com', 'hunter2');
    expect(token).toBe('the-jwt');
  });

  it('throws a generic message on a failed login, never echoing the password', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(fakeResponse({ ok: false, status: 401 }));
    await expect(loginWithPassword(apiUrl, 'me@example.com', 'wrong-password')).rejects.toThrow(
      /invalid email or password/i,
    );
  });

  it('throws when login succeeds but no session cookie comes back', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(fakeResponse({ ok: true, setCookie: [] }));
    await expect(loginWithPassword(apiUrl, 'me@example.com', 'hunter2')).rejects.toThrow(
      /session token/i,
    );
  });
});

describe('mintPersonalAccessToken', () => {
  const apiUrl = 'http://backend:3000/api/v1';

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('posts to /auth/tokens with the session JWT as a bearer header', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(
        fakeResponse({ ok: true, json: { token: 'mmpat_new', scopes: ['transactions:rw'] } }),
      );

    const result = await mintPersonalAccessToken(apiUrl, 'session-jwt', {
      name: 'Claude (OAuth)',
      scopes: ['transactions:rw'],
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://backend:3000/api/v1/auth/tokens',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer session-jwt' }),
      }),
    );
    expect(result).toEqual({ token: 'mmpat_new', scopes: ['transactions:rw'] });
  });

  it('throws when minting fails', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(fakeResponse({ ok: false, status: 403 }));
    await expect(
      mintPersonalAccessToken(apiUrl, 'session-jwt', { name: 'x', scopes: ['transactions:rw'] }),
    ).rejects.toThrow(/403/);
  });
});

describe('getCurrentIdentity', () => {
  const apiUrl = 'http://backend:3000/api/v1';

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('gets /me with the token as a bearer header', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(
        fakeResponse({ ok: true, json: { userId: 'user_1', scopes: ['reports:r'] } }),
      );

    const identity = await getCurrentIdentity(apiUrl, 'mmpat_abc');

    expect(fetchMock).toHaveBeenCalledWith(
      'http://backend:3000/api/v1/me',
      expect.objectContaining({ headers: { Authorization: 'Bearer mmpat_abc' } }),
    );
    expect(identity).toEqual({ userId: 'user_1', scopes: ['reports:r'] });
  });

  it('throws for an invalid/expired token', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(fakeResponse({ ok: false, status: 401 }));
    await expect(getCurrentIdentity(apiUrl, 'bad')).rejects.toThrow(/invalid or expired/i);
  });
});
