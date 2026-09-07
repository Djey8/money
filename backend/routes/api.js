'use strict';

const express = require('express');
const { getAuditDb } = require('../config/db');
const { recordAuditEntry } = require('../config/audit');
const { createToken, listTokens, revokeToken } = require('../cli/commands/token');
const {
  createTransaction,
  getTransaction,
  listTransactions,
} = require('../repositories/transaction-repository');
const { getUsersDb, getAuthDb } = require('../config/db');
const {
  authenticateApiToken,
  requireScope,
  requireSession,
  problem,
} = require('../middleware/api-auth');

const router = express.Router();

function validateTransactionInput(input) {
  if (!input || typeof input !== 'object') return 'A transaction object is required.';
  if (!Number.isInteger(input.amountMinor)) return 'amountMinor must be an integer.';
  if (input.amountMinor === 0) return 'amountMinor cannot be zero.';
  for (const field of ['account', 'date', 'time', 'category', 'comment']) {
    if (typeof input[field] !== 'string' || (field !== 'comment' && input[field].trim() === '')) {
      return `${field} must be a string${field === 'comment' ? '' : ' and cannot be empty'}.`;
    }
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) return 'date must use YYYY-MM-DD format.';
  return null;
}

function auditActor(auth) {
  return auth.type === 'token' ? { type: 'token', tokenId: auth.tokenId } : { type: 'session' };
}

router.use(authenticateApiToken);

router.get('/me', (req, res) => {
  res.json({
    userId: req.userId,
    authenticationType: req.auth.type,
    tokenName: req.auth.name,
    scopes: req.auth.scopes,
  });
});

router.get('/transactions', requireScope('transactions:r'), async (req, res, next) => {
  try {
    const limit = Number(req.query.limit || 50);
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      return problem(
        res,
        400,
        'validation_invalid',
        'Invalid transaction request',
        'limit must be 1 to 100.',
      );
    }
    const sort = req.query.sort || 'date';
    const order = req.query.order || 'desc';
    if (!['date', 'amount'].includes(sort) || !['asc', 'desc'].includes(order)) {
      return problem(
        res,
        400,
        'validation_invalid',
        'Invalid transaction request',
        'sort and order are invalid.',
      );
    }
    return res.json(
      await listTransactions({ usersDb: getUsersDb(), authDb: getAuthDb() }, req.userId, {
        cursor: req.query.cursor,
        limit,
        account: req.query.account,
        category: req.query.category,
        from: req.query.from,
        to: req.query.to,
        sort,
        order,
      }),
    );
  } catch (error) {
    return next(error);
  }
});

router.post('/transactions', requireScope('transactions:w'), async (req, res, next) => {
  const validationError = validateTransactionInput(req.body);
  if (validationError) {
    return problem(res, 400, 'validation_invalid', 'Invalid transaction request', validationError);
  }
  try {
    const transaction = await createTransaction(
      { usersDb: getUsersDb(), authDb: getAuthDb() },
      req.userId,
      req.body,
    );
    await recordAuditEntry(getAuditDb(), {
      userId: req.userId,
      actor: auditActor(req.auth),
      method: req.method,
      path: req.baseUrl + req.path,
      resource: 'transactions',
      resourceId: transaction.id,
    });
    return res.status(201).json(transaction);
  } catch (error) {
    return next(error);
  }
});

router.get(
  '/transactions/:transactionId',
  requireScope('transactions:r'),
  async (req, res, next) => {
    try {
      const transaction = await getTransaction(
        { usersDb: getUsersDb(), authDb: getAuthDb() },
        req.userId,
        req.params.transactionId,
      );
      if (!transaction) {
        return problem(
          res,
          404,
          'not_found',
          'Transaction not found',
          'No matching transaction exists.',
        );
      }
      return res.json(transaction);
    } catch (error) {
      return next(error);
    }
  },
);

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
