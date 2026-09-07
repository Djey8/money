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
const {
  getIncomeStatement,
  getCashflow,
  getBalanceSheet,
} = require('../repositories/report-repository');
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

const REPORT_PERIODS = ['week', 'month', 'quarter', 'halfyear', 'year'];

function validateReportPeriodQuery(query) {
  const period = query.period || 'month';
  if (!REPORT_PERIODS.includes(period)) {
    return { error: `period must be one of ${REPORT_PERIODS.join(', ')}.` };
  }
  if (query.offset === undefined) return { period, offset: 0 };
  const offset = Number(query.offset);
  if (!Number.isInteger(offset)) return { error: 'offset must be an integer.' };
  return { period, offset };
}

const MAX_IMPORT_LINES = 10000;
// A single transaction line has no legitimate reason to be this large — this
// bounds JSON.parse's per-line cost so one oversized "line" (no newlines at
// all) can't turn a line-count cap into a CPU/memory amplification vector.
const MAX_IMPORT_LINE_LENGTH = 16384;

function parseImportLines(rawBody) {
  if (typeof rawBody !== 'string' || rawBody.trim() === '') {
    return { error: 'A newline-delimited JSON (NDJSON) body is required.' };
  }
  const lines = rawBody
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  if (lines.length === 0) {
    return { error: 'A newline-delimited JSON (NDJSON) body is required.' };
  }
  if (lines.length > MAX_IMPORT_LINES) {
    return { error: `Import cannot exceed ${MAX_IMPORT_LINES} lines.` };
  }
  const items = lines.map((line, index) => {
    if (line.length > MAX_IMPORT_LINE_LENGTH) {
      return {
        op: 'create',
        error: `Line ${index + 1} exceeds ${MAX_IMPORT_LINE_LENGTH} characters.`,
      };
    }
    let parsed;
    try {
      parsed = JSON.parse(line);
    } catch {
      return { op: 'create', error: `Line ${index + 1} is not valid JSON.` };
    }
    const fieldsError = validateTransactionInput(parsed);
    return fieldsError
      ? { op: 'create', error: `Line ${index + 1}: ${fieldsError}` }
      : { op: 'create', fields: parsed };
  });
  return { items };
}

function auditActor(auth) {
  return auth.type === 'token' ? { type: 'token', tokenId: auth.tokenId } : { type: 'session' };
}

function validateIdempotencyKeyPresence(req) {
  const idempotencyKey = req.get('Idempotency-Key');
  return !idempotencyKey || !idempotencyKey.trim()
    ? 'The Idempotency-Key header is required.'
    : null;
}

/**
 * Wraps a bulk transactions write with the shared Idempotency-Key contract:
 * requires the header, replays a prior result for the same key + body,
 * rejects the same key reused with a different body, and otherwise runs
 * `run()` once and records its result on the audit entry so a later replay
 * can find it. See the "known gap" note where this is called: the write
 * `run()` performs and this audit record are not one atomic transaction.
 */
async function handleIdempotentBulkWrite(req, res, next, { requestBodyForHash, itemCount, run }) {
  const idempotencyKey = req.get('Idempotency-Key');
  if (!idempotencyKey || !idempotencyKey.trim()) {
    return problem(
      res,
      400,
      'validation_invalid',
      'Invalid request',
      'The Idempotency-Key header is required.',
    );
  }
  const requestHash = crypto.createHash('sha256').update(requestBodyForHash).digest('hex');
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

    const response = await run();
    await recordAuditEntry(
      auditDb,
      {
        userId: req.userId,
        actor: auditActor(req.auth),
        method: req.method,
        path: req.baseUrl + req.path,
        resource: 'transactions',
        itemCount,
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

router.get('/transactions/export', requireScope('transactions:bulk'), async (req, res, next) => {
  try {
    const { transactions } = await listTransactions(
      { usersDb: getUsersDb(), authDb: getAuthDb() },
      req.userId,
      { limit: Number.MAX_SAFE_INTEGER },
    );
    await recordAuditEntry(getAuditDb(), {
      userId: req.userId,
      actor: auditActor(req.auth),
      method: req.method,
      path: req.baseUrl + req.path,
      resource: 'transactions',
      itemCount: transactions.length,
    });
    res.type('application/x-ndjson');
    return res.send(transactions.map((transaction) => JSON.stringify(transaction)).join('\n'));
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
  const idempotencyKeyError = validateIdempotencyKeyPresence(req);
  if (idempotencyKeyError) {
    return problem(
      res,
      400,
      'validation_invalid',
      'Invalid transaction batch request',
      idempotencyKeyError,
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
  const atomic = Boolean(req.body.atomic);
  return handleIdempotentBulkWrite(req, res, next, {
    requestBodyForHash: JSON.stringify(req.body),
    itemCount: validation.items.length,
    run: async () => {
      const results = await batchTransactions(
        { usersDb: getUsersDb(), authDb: getAuthDb() },
        req.userId,
        validation.items,
        { atomic },
      );
      return {
        idempotencyKey: req.get('Idempotency-Key'),
        atomic,
        itemCount: validation.items.length,
        results,
      };
    },
  });
});

router.post('/transactions/import', requireScope('transactions:bulk'), async (req, res, next) => {
  const idempotencyKeyError = validateIdempotencyKeyPresence(req);
  if (idempotencyKeyError) {
    return problem(
      res,
      400,
      'validation_invalid',
      'Invalid transaction import request',
      idempotencyKeyError,
    );
  }
  const validation = parseImportLines(req.body);
  if (validation.error) {
    return problem(
      res,
      400,
      'validation_invalid',
      'Invalid transaction import request',
      validation.error,
    );
  }
  const atomic = req.query.atomic === 'true';
  return handleIdempotentBulkWrite(req, res, next, {
    requestBodyForHash: req.body,
    itemCount: validation.items.length,
    run: async () => {
      const results = await batchTransactions(
        { usersDb: getUsersDb(), authDb: getAuthDb() },
        req.userId,
        validation.items,
        { atomic },
      );
      return {
        idempotencyKey: req.get('Idempotency-Key'),
        atomic,
        itemCount: validation.items.length,
        results,
      };
    },
  });
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

router.get('/reports/income-statement', requireScope('reports:r'), async (req, res, next) => {
  const validation = validateReportPeriodQuery(req.query);
  if (validation.error) {
    return problem(res, 400, 'validation_invalid', 'Invalid report request', validation.error);
  }
  try {
    const statement = await getIncomeStatement(
      { usersDb: getUsersDb(), authDb: getAuthDb() },
      req.userId,
      { period: validation.period, offset: validation.offset },
    );
    return res.json(statement);
  } catch (error) {
    return next(error);
  }
});

router.get('/reports/cashflow', requireScope('reports:r'), async (req, res, next) => {
  const validation = validateReportPeriodQuery(req.query);
  if (validation.error) {
    return problem(res, 400, 'validation_invalid', 'Invalid report request', validation.error);
  }
  try {
    const statement = await getCashflow({ usersDb: getUsersDb(), authDb: getAuthDb() }, req.userId, {
      period: validation.period,
      offset: validation.offset,
    });
    return res.json(statement);
  } catch (error) {
    return next(error);
  }
});

router.get('/reports/balance-sheet', requireScope('reports:r'), async (req, res, next) => {
  try {
    const sheet = await getBalanceSheet({ usersDb: getUsersDb(), authDb: getAuthDb() }, req.userId);
    return res.json(sheet);
  } catch (error) {
    return next(error);
  }
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
// Attached for direct unit testing (parseImportLines has enough
// dependency-free edge cases — empty body, per-line JSON/field errors, the
// line-count and line-length caps — to be worth testing without a live
// server, unlike this file's simpler validators).
module.exports.parseImportLines = parseImportLines;
