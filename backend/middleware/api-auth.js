'use strict';

const jwt = require('jsonwebtoken');
const { getAuthDb } = require('../config/db');
const { verifyToken } = require('../cli/commands/token');

const JWT_SECRET = process.env.JWT_SECRET;

function problem(res, status, code, title, detail) {
  return res
    .status(status)
    .type('application/problem+json')
    .json({
      type: `https://money-manager.dev/problems/${code}`,
      title,
      status,
      detail,
      code,
    });
}

function getBearerToken(req) {
  const authorization = req.headers.authorization;
  if (!authorization || !authorization.startsWith('Bearer ')) return null;
  return authorization.slice('Bearer '.length).trim() || null;
}

function hasScope(scopes, requiredScope) {
  if (scopes.includes('admin')) return true;
  const [resource, level] = requiredScope.split(':');
  return scopes.some((scope) => {
    const [grantedResource, grantedLevel] = scope.split(':');
    if (grantedResource !== resource) return false;
    return grantedLevel === level || grantedLevel === 'rw';
  });
}

async function authenticateApiToken(req, res, next) {
  const token = getBearerToken(req) || req.cookies?.access_token;
  if (!token) {
    return problem(
      res,
      401,
      'auth_required',
      'Authentication required',
      'Provide a session or PAT.',
    );
  }

  if (token.startsWith('mmpat_')) {
    const personalToken = await verifyToken({ authDb: getAuthDb() }, token);
    if (!personalToken) {
      return problem(
        res,
        401,
        'auth_invalid',
        'Invalid token',
        'The personal access token is invalid.',
      );
    }
    req.userId = personalToken.userId;
    req.auth = {
      type: 'token',
      tokenId: personalToken.tokenId,
      name: personalToken.name,
      scopes: personalToken.scopes,
    };
    return next();
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    req.userEmail = decoded.email;
    req.userRole = decoded.role || 'user';
    req.auth = { type: 'session', scopes: ['admin'] };
    return next();
  } catch {
    return problem(
      res,
      401,
      'auth_invalid',
      'Invalid token',
      'The session token is invalid or expired.',
    );
  }
}

function requireScope(scope) {
  return (req, res, next) => {
    if (hasScope(req.auth?.scopes || [], scope)) return next();
    return problem(
      res,
      403,
      'scope_insufficient',
      'Insufficient scope',
      `This operation requires the '${scope}' scope.`,
    );
  };
}

function requireSession(req, res, next) {
  if (req.auth?.type === 'session' && req.userRole !== 'guest') return next();
  return problem(
    res,
    403,
    'auth_session_required',
    'Session authentication required',
    'An authenticated account session is required for this operation.',
  );
}

module.exports = { authenticateApiToken, requireScope, requireSession, hasScope, problem };
