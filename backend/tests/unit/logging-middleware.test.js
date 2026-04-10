/**
 * Unit tests for request and error logging middleware.
 * Verifies that the middleware logs correctly and passes control.
 */
const logger = require('../../config/logger');

// Silence actual log output during tests
jest.spyOn(logger, 'info').mockImplementation(() => {});
jest.spyOn(logger, 'warn').mockImplementation(() => {});
jest.spyOn(logger, 'error').mockImplementation(() => {});

process.env.JWT_SECRET = 'test-secret';

const {
  requestLoggingMiddleware,
  errorLoggingMiddleware,
  logDatabaseOperation,
  logAuthEvent,
  logUserActivity,
  logSecurityEvent
} = require('../../middleware/logging');

// Helpers
function mockReq(overrides = {}) {
  return {
    method: 'GET',
    path: '/test',
    query: {},
    ip: '127.0.0.1',
    headers: { 'user-agent': 'jest', 'content-type': 'application/json' },
    requestId: undefined,
    userId: undefined,
    ...overrides
  };
}

function mockRes() {
  const res = {
    statusCode: 200,
    send: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    status: jest.fn(function (code) { this.statusCode = code; return this; })
  };
  return res;
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('requestLoggingMiddleware', () => {
  it('calls next() so the request chain continues', () => {
    const req = mockReq();
    const res = mockRes();
    const next = jest.fn();

    requestLoggingMiddleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  it('assigns a requestId to the request', () => {
    const req = mockReq();
    const res = mockRes();
    const next = jest.fn();

    requestLoggingMiddleware(req, res, next);

    expect(req.requestId).toBeDefined();
    expect(typeof req.requestId).toBe('string');
  });

  it('logs the incoming request', () => {
    const req = mockReq({ method: 'POST', path: '/api/auth/login' });
    const res = mockRes();
    const next = jest.fn();

    requestLoggingMiddleware(req, res, next);

    expect(logger.info).toHaveBeenCalledWith(
      'Incoming request',
      expect.objectContaining({
        method: 'POST',
        path: '/api/auth/login',
        requestType: 'incoming_request'
      })
    );
  });

  it('logs the response when res.json() is called', () => {
    const req = mockReq();
    const res = mockRes();
    const next = jest.fn();

    requestLoggingMiddleware(req, res, next);

    // Simulate a JSON response
    res.json({ ok: true });

    // Should have logged both the incoming request _and_ the response
    expect(logger.info).toHaveBeenCalledTimes(2);
  });

  it('logs the response when res.send() is called', () => {
    const req = mockReq();
    const res = mockRes();
    const next = jest.fn();

    requestLoggingMiddleware(req, res, next);

    res.send('OK');

    expect(logger.info).toHaveBeenCalledTimes(2);
  });

  it('logs a warning for 4xx responses', () => {
    const req = mockReq();
    const res = mockRes();
    res.statusCode = 404;
    const next = jest.fn();

    requestLoggingMiddleware(req, res, next);
    res.json({ error: 'not found' });

    expect(logger.warn).toHaveBeenCalledWith(
      'Client error response',
      expect.objectContaining({ statusCode: 404 })
    );
  });

  it('logs an error for 5xx responses', () => {
    const req = mockReq();
    const res = mockRes();
    res.statusCode = 500;
    const next = jest.fn();

    requestLoggingMiddleware(req, res, next);
    res.json({ error: 'server error' });

    expect(logger.error).toHaveBeenCalledWith(
      'Server error response',
      expect.objectContaining({ statusCode: 500 })
    );
  });
});

describe('errorLoggingMiddleware', () => {
  it('logs the error and sends a 500 response', () => {
    const err = new Error('Something broke');
    const req = mockReq({ requestId: 'req-1' });
    const res = mockRes();
    const next = jest.fn();

    errorLoggingMiddleware(err, req, res, next);

    expect(logger.error).toHaveBeenCalledWith(
      'Unhandled error',
      expect.objectContaining({
        requestId: 'req-1',
        errorType: 'unhandled_exception'
      })
    );
    expect(res.status).toHaveBeenCalledWith(500);
  });

  it('uses statusCode from the error if present', () => {
    const err = new Error('Not found');
    err.statusCode = 404;
    const req = mockReq();
    const res = mockRes();
    const next = jest.fn();

    errorLoggingMiddleware(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
  });
});

describe('logDatabaseOperation', () => {
  it('logs structured database operation info', () => {
    logDatabaseOperation('write', 'u1', { path: '/data/info' });

    expect(logger.info).toHaveBeenCalledWith(
      'Database operation',
      expect.objectContaining({
        operation: 'write',
        userId: 'u1',
        path: '/data/info'
      })
    );
  });
});

describe('logAuthEvent', () => {
  it('logs successful auth as info', () => {
    logAuthEvent('login', 'u1', true, { email: 'u@t.com' });

    expect(logger.info).toHaveBeenCalledWith(
      'Authentication event',
      expect.objectContaining({ event: 'login', success: true })
    );
  });

  it('logs failed auth as warn', () => {
    logAuthEvent('login', 'u1', false, { reason: 'bad_password' });

    expect(logger.warn).toHaveBeenCalledWith(
      'Authentication failure',
      expect.objectContaining({ event: 'login', success: false })
    );
  });
});

describe('logUserActivity', () => {
  it('logs user activity info', () => {
    logUserActivity('u1', 'created_budget', { amount: 500 });

    expect(logger.info).toHaveBeenCalledWith(
      'User activity',
      expect.objectContaining({
        userId: 'u1',
        action: 'created_budget',
        amount: 500
      })
    );
  });
});

describe('logSecurityEvent', () => {
  it('logs high severity as error', () => {
    logSecurityEvent('brute_force_detected', 'high', { ip: '1.2.3.4' });

    expect(logger.error).toHaveBeenCalledWith(
      'Security event',
      expect.objectContaining({ event: 'brute_force_detected', severity: 'high' })
    );
  });

  it('logs medium severity as warn', () => {
    logSecurityEvent('suspicious_login', 'medium');

    expect(logger.warn).toHaveBeenCalledWith(
      'Security event',
      expect.objectContaining({ event: 'suspicious_login', severity: 'medium' })
    );
  });
});
