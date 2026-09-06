'use strict';

const express = require('express');
const { getAuthDb } = require('../config/db');
const { getAuditDb } = require('../config/db');
const { recordAuditEntry } = require('../config/audit');
const { createToken, listTokens, revokeToken } = require('../cli/commands/token');
const { authenticateApiToken, requireSession, problem } = require('../middleware/api-auth');

const router = express.Router();

router.use(authenticateApiToken);

router.get('/me', (req, res) => {
  res.json({
    userId: req.userId,
    authenticationType: req.auth.type,
    tokenName: req.auth.name,
    scopes: req.auth.scopes,
  });
});

router.post('/auth/tokens', requireSession, async (req, res) => {
  try {
    const { name, scopes, expiresInDays } = req.body || {};
    if (Array.isArray(scopes) && scopes.includes('admin')) {
      return problem(
        res,
        400,
        'validation_invalid',
        'Invalid token request',
        'The admin scope cannot be issued through the API.',
      );
    }
    const token = await createToken(
      { authDb: getAuthDb() },
      { userId: req.userId, name, scopes, expiresInDays },
    );
    await recordAuditEntry(getAuditDb(), {
      userId: req.userId,
      actor: { type: 'session' },
      method: req.method,
      path: req.baseUrl + req.path,
      resource: 'auth_tokens',
      resourceId: token.tokenId,
    });
    res.status(201).json(token);
  } catch (error) {
    problem(res, 400, 'validation_invalid', 'Invalid token request', error.message);
  }
});

router.get('/auth/tokens', requireSession, async (req, res, next) => {
  try {
    res.json({ tokens: await listTokens({ authDb: getAuthDb() }, { userId: req.userId }) });
  } catch (error) {
    next(error);
  }
});

router.delete('/auth/tokens/:tokenId', requireSession, async (req, res, next) => {
  try {
    const result = await revokeToken(
      { authDb: getAuthDb() },
      { tokenId: req.params.tokenId, userId: req.userId },
    );
    await recordAuditEntry(getAuditDb(), {
      userId: req.userId,
      actor: { type: 'session' },
      method: req.method,
      path: req.baseUrl + req.path,
      resource: 'auth_tokens',
      resourceId: result.tokenId,
    });
    res.json(result);
  } catch (error) {
    if (error.code === 'TOKEN_NOT_FOUND' || error.statusCode === 404) {
      return problem(res, 404, 'not_found', 'Token not found', 'No matching token exists.');
    }
    return next(error);
  }
});

module.exports = router;
