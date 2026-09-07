'use strict';

const crypto = require('crypto');
const express = require('express');
const { getAuditDb } = require('../config/db');
const { recordAuditEntry, findAuditEntryByIdempotencyKey } = require('../config/audit');
const { createToken, listTokens, revokeToken } = require('../cli/commands/token');
const {
  batchTransactions,
  copyTransaction,
  createTransaction,
  deleteTransaction,
  getTransaction,
  listTransactions,
  updateTransaction,
  MAX_BATCH_OPERATIONS,
} = require('../repositories/transaction-repository');
const { getUsersDb, getAuthDb } = require('../config/db');
const { getEncryptionSession } = require('../services/encryption-session');
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

const EDITABLE_TRANSACTION_FIELDS = [
  'account',
  'amountMinor',
  'date',
  'time',
  'category',
  'comment',
];

function validatePartialTransactionFields(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return 'A transaction object is required.';
  }
  const unknownField = Object.keys(input).find((key) => !EDITABLE_TRANSACTION_FIELDS.includes(key));
  if (unknownField) return `${unknownField} is not an editable field.`;
  if (input.amountMinor !== undefined) {
    if (!Number.isInteger(input.amountMinor)) return 'amountMinor must be an integer.';
    if (input.amountMinor === 0) return 'amountMinor cannot be zero.';
  }
  for (const field of ['account', 'date', 'time', 'category', 'comment']) {
    if (input[field] === undefined) continue;
    if (typeof input[field] !== 'string' || (field !== 'comment' && input[field].trim() === '')) {
      return `${field} must be a string${field === 'comment' ? '' : ' and cannot be empty'}.`;
    }
  }
  if (input.date !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(input.date)) {
    return 'date must use YYYY-MM-DD format.';
  }
  return null;
}

function validateTransactionPatch(input) {
  if (!input || typeof input !== 'object') return 'A transaction object is required.';
  if (Object.keys(input).length === 0) return 'At least one field must be provided.';
  return validatePartialTransactionFields(input);
}

function validateTransactionCopyOverrides(input) {
  if (input === undefined || input === null) return null;
  return validatePartialTransactionFields(input);
}

function validateBatchOperationItem(operation) {
  if (!operation || typeof operation !== 'object' || Array.isArray(operation)) {
    return { op: undefined, error: 'Each operation must be an object.' };
  }
  if (operation.op === 'create') {
    const { op: _op, ...fields } = operation;
    const fieldsError = validateTransactionInput(fields);
    return fieldsError ? { op: 'create', error: fieldsError } : { op: 'create', fields };
  }
  if (operation.op === 'update') {
    if (typeof operation.id !== 'string' || operation.id.trim() === '') {
      return { op: 'update', error: 'id is required.' };
    }
    const { op: _op, id, ...fields } = operation;
    if (Object.keys(fields).length === 0) {
      return { op: 'update', id, error: 'At least one field must be provided.' };
    }
    const fieldsError = validatePartialTransactionFields(fields);
    return fieldsError ? { op: 'update', id, error: fieldsError } : { op: 'update', id, fields };
  }
  if (operation.op === 'delete') {
    const { op: _op, id, ...rest } = operation;
    if (typeof id !== 'string' || id.trim() === '')
      return { op: 'delete', error: 'id is required.' };
    const extraField = Object.keys(rest)[0];
    if (extraField) {
      return { op: 'delete', id, error: `${extraField} is not allowed for a delete operation.` };
    }
    return { op: 'delete', id };
  }
  return { op: operation.op, error: "op must be 'create', 'update', or 'delete'." };
}

function validateBatchRequest(body) {
  if (!body || typeof body !== 'object') return { error: 'A batch request object is required.' };
  if (body.atomic !== undefined && typeof body.atomic !== 'boolean') {
    return { error: 'atomic must be a boolean.' };
  }
  if (!Array.isArray(body.operations) || body.operations.length === 0) {
    return { error: 'operations must be a non-empty array.' };
  }
  if (body.operations.length > MAX_BATCH_OPERATIONS) {
    return { error: `operations cannot exceed ${MAX_BATCH_OPERATIONS} items.` };
  }
  return { items: body.operations.map(validateBatchOperationItem) };
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

router.post('/transactions/batch', requireScope('transactions:bulk'), async (req, res, next) => {
  const idempotencyKey = req.get('Idempotency-Key');
  if (!idempotencyKey || !idempotencyKey.trim()) {
    return problem(
      res,
      400,
      'validation_invalid',
      'Invalid transaction batch request',
      'The Idempotency-Key header is required.',
    );
  }
  const validation = validateBatchRequest(req.body);
  if (validation.error) {
    return problem(
      res,
      400,
      'validation_invalid',
      'Invalid transaction batch request',
      validation.error,
    );
  }
  const requestHash = crypto.createHash('sha256').update(JSON.stringify(req.body)).digest('hex');
  try {
    const auditDb = getAuditDb();
    const existingReplay = await findAuditEntryByIdempotencyKey(
      auditDb,
      req.userId,
      'transactions',
      idempotencyKey,
    );
    const session = await getEncryptionSession(getAuthDb(), req.userId);
    if (existingReplay) {
      if (existingReplay.requestHash !== requestHash) {
        return problem(
          res,
          409,
          'conflict_idempotency_mismatch',
          'Idempotency key reused with a different request',
          'This Idempotency-Key was already used for a request with a different body.',
        );
      }
      const serialized =
        existingReplay.payloadEncrypted && session
          ? session.decrypt(existingReplay.payload)
          : existingReplay.payload;
      return res.status(200).json(JSON.parse(serialized));
    }

    const atomic = Boolean(req.body.atomic);
    const results = await batchTransactions(
      { usersDb: getUsersDb(), authDb: getAuthDb() },
      req.userId,
      validation.items,
      { atomic },
    );
    const response = { idempotencyKey, atomic, results };
    // Known gap, flagged not hidden (see docs/api/AGENTS.md and PLAN.md): the
    // mutating write above and this idempotency record aren't one atomic
    // transaction. A crash or audit-db failure in the narrow window between
    // them leaves no replay record for a write that already happened, so a
    // client's well-intentioned retry with the same key would reapply it.
    // Not fixed now — a real fix needs a two-phase pending/complete record,
    // which is more new, untested machinery than this narrow crash-window
    // risk currently justifies; documented instead of silently shipped.
    await recordAuditEntry(
      auditDb,
      {
        userId: req.userId,
        actor: auditActor(req.auth),
        method: req.method,
        path: req.baseUrl + req.path,
        resource: 'transactions',
        itemCount: validation.items.length,
        idempotencyKey,
        requestHash,
        payload: response,
      },
      session ? (value) => session.encrypt(value) : undefined,
    );
    return res.status(200).json(response);
  } catch (error) {
    return next(error);
  }
});

router.post(
  '/transactions/:transactionId/copy',
  requireScope('transactions:w'),
  async (req, res, next) => {
    const validationError = validateTransactionCopyOverrides(req.body);
    if (validationError) {
      return problem(
        res,
        400,
        'validation_invalid',
        'Invalid transaction request',
        validationError,
      );
    }
    try {
      const transaction = await copyTransaction(
        { usersDb: getUsersDb(), authDb: getAuthDb() },
        req.userId,
        req.params.transactionId,
        req.body || {},
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
      if (error.code === 'BUCKET_PATCH_REQUIRES_BOTH_FIELDS') {
        return problem(
          res,
          400,
          'validation_invalid',
          'Invalid transaction request',
          error.message,
        );
      }
      return next(error);
    }
  },
);

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

router.patch(
  '/transactions/:transactionId',
  requireScope('transactions:w'),
  async (req, res, next) => {
    const validationError = validateTransactionPatch(req.body);
    if (validationError) {
      return problem(
        res,
        400,
        'validation_invalid',
        'Invalid transaction request',
        validationError,
      );
    }
    try {
      const transaction = await updateTransaction(
        { usersDb: getUsersDb(), authDb: getAuthDb() },
        req.userId,
        req.params.transactionId,
        req.body,
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
      await recordAuditEntry(getAuditDb(), {
        userId: req.userId,
        actor: auditActor(req.auth),
        method: req.method,
        path: req.baseUrl + req.path,
        resource: 'transactions',
        resourceId: transaction.id,
      });
      return res.json(transaction);
    } catch (error) {
      if (error.code === 'BUCKET_PATCH_REQUIRES_BOTH_FIELDS') {
        return problem(
          res,
          400,
          'validation_invalid',
          'Invalid transaction request',
          error.message,
        );
      }
      return next(error);
    }
  },
);

router.delete(
  '/transactions/:transactionId',
  requireScope('transactions:w'),
  async (req, res, next) => {
    try {
      const deleted = await deleteTransaction(
        { usersDb: getUsersDb(), authDb: getAuthDb() },
        req.userId,
        req.params.transactionId,
      );
      if (!deleted) {
        return problem(
          res,
          404,
          'not_found',
          'Transaction not found',
          'No matching transaction exists.',
        );
      }
      await recordAuditEntry(getAuditDb(), {
        userId: req.userId,
        actor: auditActor(req.auth),
        method: req.method,
        path: req.baseUrl + req.path,
        resource: 'transactions',
        resourceId: req.params.transactionId,
      });
      return res.json({ id: req.params.transactionId });
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
