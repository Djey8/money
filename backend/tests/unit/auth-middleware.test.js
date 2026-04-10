/**
 * Unit tests for authenticateToken middleware (middleware/auth.js).
 * Pure unit tests — no database, no network.
 */
const jwt = require('jsonwebtoken');

// Set JWT_SECRET before requiring the middleware
process.env.JWT_SECRET = 'test-secret-for-unit-tests';

const { authenticateToken } = require('../../middleware/auth');

// Helper to build mock req/res/next
function createMocks(authHeader) {
  const req = { headers: {} };
  if (authHeader !== undefined) {
    req.headers.authorization = authHeader;
  }

  const res = {
    _status: null,
    _json: null,
    status(code) { this._status = code; return this; },
    json(data) { this._json = data; return this; }
  };

  const next = jest.fn();
  return { req, res, next };
}

describe('authenticateToken middleware', () => {
  const secret = process.env.JWT_SECRET;

  it('returns 401 when no Authorization header is present', () => {
    const { req, res, next } = createMocks(undefined);

    authenticateToken(req, res, next);

    expect(res._status).toBe(401);
    expect(res._json).toEqual({ error: 'Access token required' });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when Authorization header has no token', () => {
    const { req, res, next } = createMocks('Bearer ');

    authenticateToken(req, res, next);

    // 'Bearer '.split(' ')[1] is '' which is falsy
    expect(res._status).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 403 for an invalid token', () => {
    const { req, res, next } = createMocks('Bearer not-a-real-jwt');

    authenticateToken(req, res, next);

    expect(res._status).toBe(403);
    expect(res._json).toEqual({ error: 'Invalid or expired token' });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 403 for an expired token', () => {
    const expired = jwt.sign(
      { userId: 'u1', email: 'a@b.com' },
      secret,
      { expiresIn: '-1s' }          // already expired
    );
    const { req, res, next } = createMocks(`Bearer ${expired}`);

    authenticateToken(req, res, next);

    expect(res._status).toBe(403);
    expect(res._json).toEqual({ error: 'Invalid or expired token' });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 403 for a token signed with a different secret', () => {
    const wrongSecret = jwt.sign(
      { userId: 'u1', email: 'a@b.com' },
      'wrong-secret',
      { expiresIn: '1h' }
    );
    const { req, res, next } = createMocks(`Bearer ${wrongSecret}`);

    authenticateToken(req, res, next);

    expect(res._status).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('sets req.userId and req.userEmail and calls next() for a valid token', () => {
    const token = jwt.sign(
      { userId: 'user_123', email: 'valid@test.com' },
      secret,
      { expiresIn: '1h' }
    );
    const { req, res, next } = createMocks(`Bearer ${token}`);

    authenticateToken(req, res, next);

    expect(req.userId).toBe('user_123');
    expect(req.userEmail).toBe('valid@test.com');
    expect(next).toHaveBeenCalledTimes(1);
    expect(res._status).toBeNull();
  });

  it('handles a token without email claim', () => {
    const token = jwt.sign({ userId: 'u1' }, secret, { expiresIn: '1h' });
    const { req, res, next } = createMocks(`Bearer ${token}`);

    authenticateToken(req, res, next);

    expect(req.userId).toBe('u1');
    expect(req.userEmail).toBeUndefined();
    expect(next).toHaveBeenCalled();
  });
});
