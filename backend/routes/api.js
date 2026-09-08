'use strict';

const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const express = require('express');
const { getAuditDb } = require('../config/db');
const { recordAuditEntry, findAuditEntryByIdempotencyKey } = require('../config/audit');
const { createToken, listTokens, revokeToken } = require('../cli/commands/token');
const {
  ACCESS_TOKEN_EXPIRES_IN,
  ACCESS_TOKEN_MAX_AGE_MS,
  COOKIE_OPTIONS,
  clearAuthCookies,
  revokeRefreshToken,
} = require('./auth');
const {
  getAccount,
  updateAccountEmail,
  verifyAccountPassword,
  deleteAccount,
  AccountError,
} = require('../repositories/account-repository');
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
  getKpis,
  getFireCoverage,
  getGrowPnl,
} = require('../repositories/report-repository');
const { getMojoStatus, updateMojoTarget } = require('../repositories/mojo-repository');
const {
  SMILE_PHASES,
  listSmileProjects,
  getSmileProject,
  createSmileProject,
  updateSmileProject,
  deleteSmileProject,
  createSmilePaymentPlan,
} = require('../repositories/smile-repository');
const {
  FIRE_PHASES,
  listFireProjects,
  getFireProject,
  createFireProject,
  updateFireProject,
  deleteFireProject,
  createFirePaymentPlan,
} = require('../repositories/fire-repository');
const {
  listAssets,
  getAsset,
  createAsset,
  updateAsset,
  deleteAsset,
} = require('../repositories/asset-repository');
const {
  listLiabilities,
  getLiability,
  createLiability,
  updateLiability,
  deleteLiability,
} = require('../repositories/liability-repository');
const {
  listInvestments,
  getInvestment,
  createInvestment,
  updateInvestment,
  deleteInvestment,
} = require('../repositories/investment-repository');
const {
  listShares,
  getShare,
  createShare,
  updateShare,
  deleteShare,
} = require('../repositories/share-repository');
const {
  listRevenues,
  listInterests,
  listProperties,
} = require('../repositories/income-entity-repository');
const {
  listGrow,
  getGrow,
  createGrow,
  updateGrow,
  deleteGrow,
} = require('../repositories/grow-repository');
const {
  buyGrow,
  sellGrow,
  dividendGrow,
  paybackGrow,
  cashflowGrow,
  depositGrow,
} = require('../repositories/grow-action-repository');
const {
  listSubscriptions,
  getSubscription,
  createSubscription,
  updateSubscription,
  deleteSubscription,
  refreshSubscriptions,
  batchSubscriptions,
} = require('../repositories/subscription-repository');
const {
  listBudget,
  getBudgetRow,
  upsertBudget,
  updateBudgetRow,
  deleteBudgetRow,
  deleteBudgetMonth,
  fillForwardBudget,
  copyBudget,
  fromSubscriptionsBudget,
} = require('../repositories/budget-repository');
const {
  getSettings,
  updateSettings,
  validateSettingsAllocation,
} = require('../repositories/settings-repository');
const {
  getPublicEncryptionConfig,
  updatePublicEncryptionConfig,
} = require('../repositories/encryption-config-repository');
const {
  recalculateUserData,
  exportUserData,
  importUserData,
  ImportError,
} = require('../repositories/data-repository');
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

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim() !== '';
}

function validateFundLink(link) {
  return (
    link && typeof link === 'object' && isNonEmptyString(link.label) && isNonEmptyString(link.url)
  );
}

function validateFundNote(note) {
  return note && typeof note === 'object' && isNonEmptyString(note.text);
}

const FUND_ACTION_PRIORITIES = ['low', 'medium', 'high'];

function validateFundActionItem(item) {
  if (!item || typeof item !== 'object' || !isNonEmptyString(item.text)) return false;
  if (item.priority !== undefined && !FUND_ACTION_PRIORITIES.includes(item.priority)) return false;
  if (item.done !== undefined && typeof item.done !== 'boolean') return false;
  return true;
}

/**
 * Stricter than `validateFundActionItem`: `done` must be given explicitly.
 * `actionItems` on PATCH replaces the whole array (see `updateSmileProject`),
 * so an omitted `done` can't default to `false` the way it safely can at
 * creation — that would silently un-complete an already-done item the
 * caller forgot to echo back with its current state.
 */
function validateUpdateFundActionItem(item) {
  if (!item || typeof item !== 'object' || !isNonEmptyString(item.text)) return false;
  if (typeof item.done !== 'boolean') return false;
  if (item.priority !== undefined && !FUND_ACTION_PRIORITIES.includes(item.priority)) return false;
  return true;
}

function validateFundBucketInput(bucket) {
  if (!bucket || typeof bucket !== 'object') return 'Each bucket must be an object.';
  if (!isNonEmptyString(bucket.title)) return 'Each bucket requires a non-empty title.';
  if (!Number.isInteger(bucket.targetMinor) || bucket.targetMinor <= 0) {
    return 'Each bucket requires a positive integer targetMinor.';
  }
  if (
    bucket.amountMinor !== undefined &&
    (!Number.isInteger(bucket.amountMinor) || bucket.amountMinor < 0)
  ) {
    return "Each bucket's amountMinor must be a non-negative integer.";
  }
  // `id` is only meaningful on PATCH (preserves an existing bucket's identity
  // across the update); create always mints a fresh one regardless, so this
  // is validated here once for both callers rather than in two places.
  if (bucket.id !== undefined && !isNonEmptyString(bucket.id)) {
    return "Each bucket's id, if given, must be a non-empty string.";
  }
  return null;
}

function validateUpdateFundNote(note) {
  if (!note || typeof note !== 'object' || !isNonEmptyString(note.text)) return false;
  if (note.createdAt !== undefined && typeof note.createdAt !== 'string') return false;
  return true;
}

// Bucket titles are matched case-insensitively by applyBucketAllocations
// (packages/domain/src/transactions/bucket-allocations.ts) when a `#bucket:`
// tag routes a contribution — two buckets sharing a title would silently
// misdirect every tagged contribution meant for the second one to whichever
// bucket .find() reaches first. Reject rather than guess. Returns the
// colliding normalized title, or null if every title is unique.
function findDuplicateBucketTitle(titles) {
  const seen = new Set();
  for (const title of titles) {
    const normalized = title.trim().toLowerCase();
    if (seen.has(normalized)) return normalized;
    seen.add(normalized);
  }
  return null;
}

function validateCreateSmileProjectInput(input) {
  if (!input || typeof input !== 'object') return 'A Smile project object is required.';
  if (!isNonEmptyString(input.title)) return 'title must be a non-empty string.';
  const hasTarget = input.targetMinor !== undefined;
  const hasBuckets = Array.isArray(input.buckets) && input.buckets.length > 0;
  if (!hasTarget && !hasBuckets) {
    return 'Either targetMinor or a non-empty buckets array is required.';
  }
  if (hasTarget) {
    if (!Number.isInteger(input.targetMinor) || input.targetMinor <= 0) {
      return 'targetMinor must be a positive integer.';
    }
    if (
      input.amountMinor !== undefined &&
      (!Number.isInteger(input.amountMinor) || input.amountMinor < 0)
    ) {
      return 'amountMinor must be a non-negative integer.';
    }
  }
  if (input.buckets !== undefined) {
    if (!Array.isArray(input.buckets)) return 'buckets must be an array.';
    for (const bucket of input.buckets) {
      const bucketError = validateFundBucketInput(bucket);
      if (bucketError) return bucketError;
    }
  }
  const allBucketTitles = [];
  if (hasTarget) allBucketTitles.push(input.title);
  if (Array.isArray(input.buckets)) {
    for (const bucket of input.buckets) allBucketTitles.push(bucket.title);
  }
  const duplicateTitle = findDuplicateBucketTitle(allBucketTitles);
  if (duplicateTitle) {
    return hasTarget && duplicateTitle === input.title.trim().toLowerCase()
      ? 'A bucket cannot share a title with the project itself (targetMinor already creates a default bucket named after title).'
      : 'Bucket titles must be unique within a project (case-insensitive).';
  }
  if (input.phase !== undefined && !SMILE_PHASES.includes(input.phase)) {
    return `phase must be one of ${SMILE_PHASES.join(', ')}.`;
  }
  if (input.links !== undefined) {
    if (!Array.isArray(input.links) || !input.links.every(validateFundLink)) {
      return 'links must be an array of {label, url} objects.';
    }
  }
  if (input.actionItems !== undefined) {
    if (!Array.isArray(input.actionItems) || !input.actionItems.every(validateFundActionItem)) {
      return 'actionItems must be an array of {text, done?, priority?} objects.';
    }
  }
  if (input.notes !== undefined) {
    if (!Array.isArray(input.notes) || !input.notes.every(validateFundNote)) {
      return 'notes must be an array of {text} objects.';
    }
  }
  return null;
}

const EDITABLE_SMILE_FIELDS = [
  'title',
  'sub',
  'phase',
  'description',
  'targetDate',
  'completionDate',
  'buckets',
  'links',
  'actionItems',
  'notes',
];

function validatePatchSmileProjectInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return 'A Smile project object is required.';
  }
  const unknownField = Object.keys(input).find((key) => !EDITABLE_SMILE_FIELDS.includes(key));
  if (unknownField) return `${unknownField} is not an editable field.`;
  if (input.title !== undefined && !isNonEmptyString(input.title)) {
    return 'title must be a non-empty string.';
  }
  if (input.phase !== undefined && !SMILE_PHASES.includes(input.phase)) {
    return `phase must be one of ${SMILE_PHASES.join(', ')}.`;
  }
  if (input.buckets !== undefined) {
    if (!Array.isArray(input.buckets) || input.buckets.length === 0) {
      return 'buckets must be a non-empty array.';
    }
    for (const bucket of input.buckets) {
      const bucketError = validateFundBucketInput(bucket);
      if (bucketError) return bucketError;
    }
    if (findDuplicateBucketTitle(input.buckets.map((bucket) => bucket.title))) {
      return 'Bucket titles must be unique within a project (case-insensitive).';
    }
    const requestedIds = input.buckets.map((bucket) => bucket.id).filter((id) => id !== undefined);
    if (new Set(requestedIds).size !== requestedIds.length) {
      return 'Two buckets in the same patch cannot request the same id.';
    }
  }
  if (input.links !== undefined) {
    if (!Array.isArray(input.links) || !input.links.every(validateFundLink)) {
      return 'links must be an array of {label, url} objects.';
    }
  }
  if (input.actionItems !== undefined) {
    if (
      !Array.isArray(input.actionItems) ||
      !input.actionItems.every(validateUpdateFundActionItem)
    ) {
      return 'actionItems must be an array of {text, done, priority?} objects — done is required here since this replaces the whole array.';
    }
  }
  if (input.notes !== undefined) {
    if (!Array.isArray(input.notes) || !input.notes.every(validateUpdateFundNote)) {
      return 'notes must be an array of {text, createdAt?} objects.';
    }
  }
  return null;
}

function validateCreateFireProjectInput(input) {
  if (!input || typeof input !== 'object') return 'A Fire project object is required.';
  if (!isNonEmptyString(input.title)) return 'title must be a non-empty string.';
  const hasTarget = input.targetMinor !== undefined;
  const hasBuckets = Array.isArray(input.buckets) && input.buckets.length > 0;
  if (!hasTarget && !hasBuckets) {
    return 'Either targetMinor or a non-empty buckets array is required.';
  }
  if (hasTarget) {
    if (!Number.isInteger(input.targetMinor) || input.targetMinor <= 0) {
      return 'targetMinor must be a positive integer.';
    }
    if (
      input.amountMinor !== undefined &&
      (!Number.isInteger(input.amountMinor) || input.amountMinor < 0)
    ) {
      return 'amountMinor must be a non-negative integer.';
    }
  }
  if (input.buckets !== undefined) {
    if (!Array.isArray(input.buckets)) return 'buckets must be an array.';
    for (const bucket of input.buckets) {
      const bucketError = validateFundBucketInput(bucket);
      if (bucketError) return bucketError;
    }
  }
  const allBucketTitles = [];
  if (hasTarget) allBucketTitles.push(input.title);
  if (Array.isArray(input.buckets)) {
    for (const bucket of input.buckets) allBucketTitles.push(bucket.title);
  }
  const duplicateTitle = findDuplicateBucketTitle(allBucketTitles);
  if (duplicateTitle) {
    return hasTarget && duplicateTitle === input.title.trim().toLowerCase()
      ? 'A bucket cannot share a title with the project itself (targetMinor already creates a default bucket named after title).'
      : 'Bucket titles must be unique within a project (case-insensitive).';
  }
  if (input.phase !== undefined && !FIRE_PHASES.includes(input.phase)) {
    return `phase must be one of ${FIRE_PHASES.join(', ')}.`;
  }
  if (input.links !== undefined) {
    if (!Array.isArray(input.links) || !input.links.every(validateFundLink)) {
      return 'links must be an array of {label, url} objects.';
    }
  }
  if (input.actionItems !== undefined) {
    if (!Array.isArray(input.actionItems) || !input.actionItems.every(validateFundActionItem)) {
      return 'actionItems must be an array of {text, done?, priority?} objects.';
    }
  }
  if (input.notes !== undefined) {
    if (!Array.isArray(input.notes) || !input.notes.every(validateFundNote)) {
      return 'notes must be an array of {text} objects.';
    }
  }
  return null;
}

const EDITABLE_FIRE_FIELDS = [
  'title',
  'sub',
  'phase',
  'description',
  'targetDate',
  'completionDate',
  'buckets',
  'links',
  'actionItems',
  'notes',
];

function validatePatchFireProjectInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return 'A Fire project object is required.';
  }
  const unknownField = Object.keys(input).find((key) => !EDITABLE_FIRE_FIELDS.includes(key));
  if (unknownField) return `${unknownField} is not an editable field.`;
  if (input.title !== undefined && !isNonEmptyString(input.title)) {
    return 'title must be a non-empty string.';
  }
  if (input.phase !== undefined && !FIRE_PHASES.includes(input.phase)) {
    return `phase must be one of ${FIRE_PHASES.join(', ')}.`;
  }
  if (input.buckets !== undefined) {
    if (!Array.isArray(input.buckets) || input.buckets.length === 0) {
      return 'buckets must be a non-empty array.';
    }
    for (const bucket of input.buckets) {
      const bucketError = validateFundBucketInput(bucket);
      if (bucketError) return bucketError;
    }
    if (findDuplicateBucketTitle(input.buckets.map((bucket) => bucket.title))) {
      return 'Bucket titles must be unique within a project (case-insensitive).';
    }
    const requestedIds = input.buckets.map((bucket) => bucket.id).filter((id) => id !== undefined);
    if (new Set(requestedIds).size !== requestedIds.length) {
      return 'Two buckets in the same patch cannot request the same id.';
    }
  }
  if (input.links !== undefined) {
    if (!Array.isArray(input.links) || !input.links.every(validateFundLink)) {
      return 'links must be an array of {label, url} objects.';
    }
  }
  if (input.actionItems !== undefined) {
    if (
      !Array.isArray(input.actionItems) ||
      !input.actionItems.every(validateUpdateFundActionItem)
    ) {
      return 'actionItems must be an array of {text, done, priority?} objects — done is required here since this replaces the whole array.';
    }
  }
  if (input.notes !== undefined) {
    if (!Array.isArray(input.notes) || !input.notes.every(validateUpdateFundNote)) {
      return 'notes must be an array of {text, createdAt?} objects.';
    }
  }
  return null;
}

const PAYMENT_PLAN_FREQUENCIES = ['weekly', 'biweekly', 'monthly', 'quarterly', 'yearly'];

/** Shared by `POST /smile/{id}/payment-plan` and `POST /fire/{id}/payment-plan` — the request shape is identical for both. */
function validateCreatePaymentPlanInput(input) {
  if (!input || typeof input !== 'object') return 'A payment plan object is required.';
  if (!isNonEmptyString(input.planTitle)) return 'planTitle must be a non-empty string.';
  if (!isNonEmptyString(input.startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(input.startDate)) {
    return 'startDate must use YYYY-MM-DD format.';
  }
  if (!isNonEmptyString(input.targetDate) || !/^\d{4}-\d{2}-\d{2}$/.test(input.targetDate)) {
    return 'targetDate must use YYYY-MM-DD format.';
  }
  if (!PAYMENT_PLAN_FREQUENCIES.includes(input.frequency)) {
    return `frequency must be one of ${PAYMENT_PLAN_FREQUENCIES.join(', ')}.`;
  }
  if (!isNonEmptyString(input.account)) return 'account must be a non-empty string.';
  if (input.selectedBucketIds !== undefined) {
    if (
      !Array.isArray(input.selectedBucketIds) ||
      !input.selectedBucketIds.every(isNonEmptyString)
    ) {
      return 'selectedBucketIds must be an array of non-empty strings.';
    }
  }
  if (
    input.manualAmountMinor !== undefined &&
    (!Number.isInteger(input.manualAmountMinor) || input.manualAmountMinor <= 0)
  ) {
    return 'manualAmountMinor must be a positive integer.';
  }
  return null;
}

const SUBSCRIPTION_FREQUENCIES = ['weekly', 'biweekly', 'monthly', 'quarterly', 'yearly'];

function validateSubscriptionInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return 'A subscription object is required.';
  }
  if (!isNonEmptyString(input.account)) return 'account must be a non-empty string.';
  if (!Number.isInteger(input.amountMinor)) return 'amountMinor must be an integer.';
  if (input.amountMinor === 0) return 'amountMinor cannot be zero.';
  if (!isNonEmptyString(input.category) || input.category === '@') {
    return 'category must be a non-empty string.';
  }
  if (!isNonEmptyString(input.startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(input.startDate)) {
    return 'startDate must use YYYY-MM-DD format.';
  }
  if (
    input.endDate !== undefined &&
    input.endDate !== null &&
    (!isNonEmptyString(input.endDate) || !/^\d{4}-\d{2}-\d{2}$/.test(input.endDate))
  ) {
    return 'endDate must use YYYY-MM-DD format, or be null.';
  }
  if (input.title !== undefined && typeof input.title !== 'string') {
    return 'title must be a string.';
  }
  if (input.comment !== undefined && typeof input.comment !== 'string') {
    return 'comment must be a string.';
  }
  if (input.frequency !== undefined && !SUBSCRIPTION_FREQUENCIES.includes(input.frequency)) {
    return `frequency must be one of ${SUBSCRIPTION_FREQUENCIES.join(', ')}.`;
  }
  return null;
}

const EDITABLE_SUBSCRIPTION_FIELDS = [
  'title',
  'account',
  'amountMinor',
  'startDate',
  'endDate',
  'category',
  'comment',
  'frequency',
];

function validatePatchSubscriptionInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return 'A subscription object is required.';
  }
  const unknownField = Object.keys(input).find(
    (key) => !EDITABLE_SUBSCRIPTION_FIELDS.includes(key),
  );
  if (unknownField) return `${unknownField} is not an editable field.`;
  if (input.account !== undefined && !isNonEmptyString(input.account)) {
    return 'account must be a non-empty string.';
  }
  if (input.amountMinor !== undefined) {
    if (!Number.isInteger(input.amountMinor)) return 'amountMinor must be an integer.';
    if (input.amountMinor === 0) return 'amountMinor cannot be zero.';
  }
  if (
    input.category !== undefined &&
    (!isNonEmptyString(input.category) || input.category === '@')
  ) {
    return 'category must be a non-empty string.';
  }
  if (
    input.startDate !== undefined &&
    (!isNonEmptyString(input.startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(input.startDate))
  ) {
    return 'startDate must use YYYY-MM-DD format.';
  }
  if (
    input.endDate !== undefined &&
    input.endDate !== null &&
    (!isNonEmptyString(input.endDate) || !/^\d{4}-\d{2}-\d{2}$/.test(input.endDate))
  ) {
    return 'endDate must use YYYY-MM-DD format, or be null.';
  }
  if (input.title !== undefined && typeof input.title !== 'string') {
    return 'title must be a string.';
  }
  if (input.comment !== undefined && typeof input.comment !== 'string') {
    return 'comment must be a string.';
  }
  if (input.frequency !== undefined && !SUBSCRIPTION_FREQUENCIES.includes(input.frequency)) {
    return `frequency must be one of ${SUBSCRIPTION_FREQUENCIES.join(', ')}.`;
  }
  return null;
}

function validateSubscriptionBatchOperationItem(operation) {
  if (!operation || typeof operation !== 'object' || Array.isArray(operation)) {
    return { op: undefined, error: 'Each operation must be an object.' };
  }
  if (operation.op === 'create') {
    const { op: _op, ...fields } = operation;
    const fieldsError = validateSubscriptionInput(fields);
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
    const fieldsError = validatePatchSubscriptionInput(fields);
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

function validateSubscriptionBatchRequest(body) {
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
  return { items: body.operations.map(validateSubscriptionBatchOperationItem) };
}

function parseSubscriptionImportLines(rawBody) {
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
    const fieldsError = validateSubscriptionInput(parsed);
    return fieldsError
      ? { op: 'create', error: `Line ${index + 1}: ${fieldsError}` }
      : { op: 'create', fields: parsed };
  });
  return { items };
}

const BUDGET_MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

function validateBudgetInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return 'A budget object is required.';
  }
  if (!isNonEmptyString(input.date) || !BUDGET_MONTH_PATTERN.test(input.date)) {
    return 'date must use YYYY-MM format.';
  }
  if (!isNonEmptyString(input.tag) || input.tag === '@') {
    return 'tag must be a non-empty string.';
  }
  if (!Number.isInteger(input.amountMinor)) return 'amountMinor must be an integer.';
  return null;
}

const EDITABLE_BUDGET_FIELDS = ['date', 'tag', 'amountMinor'];

function validatePatchBudgetInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return 'A budget object is required.';
  }
  const unknownField = Object.keys(input).find((key) => !EDITABLE_BUDGET_FIELDS.includes(key));
  if (unknownField) return `${unknownField} is not an editable field.`;
  if (
    input.date !== undefined &&
    (!isNonEmptyString(input.date) || !BUDGET_MONTH_PATTERN.test(input.date))
  ) {
    return 'date must use YYYY-MM format.';
  }
  if (input.tag !== undefined && (!isNonEmptyString(input.tag) || input.tag === '@')) {
    return 'tag must be a non-empty string.';
  }
  if (input.amountMinor !== undefined && !Number.isInteger(input.amountMinor)) {
    return 'amountMinor must be an integer.';
  }
  return null;
}

function validateFillForwardBudgetInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return 'A request body object is required.';
  }
  if (!isNonEmptyString(input.targetMonth) || !BUDGET_MONTH_PATTERN.test(input.targetMonth)) {
    return 'targetMonth must use YYYY-MM format.';
  }
  return null;
}

function validateCopyBudgetInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return 'A request body object is required.';
  }
  if (!isNonEmptyString(input.fromMonth) || !BUDGET_MONTH_PATTERN.test(input.fromMonth)) {
    return 'fromMonth must use YYYY-MM format.';
  }
  if (!isNonEmptyString(input.toMonth) || !BUDGET_MONTH_PATTERN.test(input.toMonth)) {
    return 'toMonth must use YYYY-MM format.';
  }
  return null;
}

const SETTINGS_THEMES = ['light', 'dark'];
const SETTINGS_LANGUAGES = ['en', 'de', 'es', 'fr', 'cn', 'ar'];
const SETTINGS_DATE_FORMATS = [
  'dd.MM.yyyy',
  'dd.MM.yy',
  'dd/MM/yyyy',
  'dd/MM/yy',
  'yyyy-MM-dd',
  'MM/dd/yyyy',
  'dd-MM-yyyy',
];
const EDITABLE_SETTINGS_FIELDS = [
  'username',
  'currency',
  'theme',
  'language',
  'dateFormat',
  'isEuropeanFormat',
  'allocation',
];

function validatePatchSettingsInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return 'A settings object is required.';
  }
  const unknownField = Object.keys(input).find((key) => !EDITABLE_SETTINGS_FIELDS.includes(key));
  if (unknownField) return `${unknownField} is not an editable field.`;
  if (input.username !== undefined && typeof input.username !== 'string') {
    return 'username must be a string.';
  }
  if (input.currency !== undefined && !isNonEmptyString(input.currency)) {
    return 'currency must be a non-empty string.';
  }
  if (input.theme !== undefined && !SETTINGS_THEMES.includes(input.theme)) {
    return `theme must be one of ${SETTINGS_THEMES.join(', ')}.`;
  }
  if (input.language !== undefined && !SETTINGS_LANGUAGES.includes(input.language)) {
    return `language must be one of ${SETTINGS_LANGUAGES.join(', ')}.`;
  }
  if (input.dateFormat !== undefined && !SETTINGS_DATE_FORMATS.includes(input.dateFormat)) {
    return `dateFormat must be one of ${SETTINGS_DATE_FORMATS.join(', ')}.`;
  }
  if (input.isEuropeanFormat !== undefined && typeof input.isEuropeanFormat !== 'boolean') {
    return 'isEuropeanFormat must be a boolean.';
  }
  if (input.allocation !== undefined) {
    const allocationError = validateSettingsAllocation(input.allocation);
    if (allocationError) return allocationError;
  }
  return null;
}

const EDITABLE_ENCRYPTION_CONFIG_FIELDS = ['key', 'encryptLocal', 'encryptDatabase'];

/**
 * Despite the PUT verb (kept for consistency with this resource's single-config-object shape),
 * this accepts a partial body — any subset of the three fields — since toggling
 * encryptLocal/encryptDatabase without touching key is an explicitly supported use case (see
 * encryption-config-repository.js).
 */
function validatePutEncryptionConfigInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return 'A request body object is required.';
  }
  const unknownField = Object.keys(input).find(
    (key) => !EDITABLE_ENCRYPTION_CONFIG_FIELDS.includes(key),
  );
  if (unknownField) return `${unknownField} is not a recognized field.`;
  if (input.key !== undefined && (typeof input.key !== 'string' || input.key.trim() === '')) {
    return 'key must be a non-empty string.';
  }
  if (input.encryptLocal !== undefined && typeof input.encryptLocal !== 'boolean') {
    return 'encryptLocal must be a boolean.';
  }
  if (input.encryptDatabase !== undefined && typeof input.encryptDatabase !== 'boolean') {
    return 'encryptDatabase must be a boolean.';
  }
  return null;
}

function validateCreateAssetInput(input) {
  if (!input || typeof input !== 'object') return 'An asset object is required.';
  if (!isNonEmptyString(input.tag)) return 'tag must be a non-empty string.';
  if (input.amountMinor !== undefined && !Number.isInteger(input.amountMinor)) {
    return 'amountMinor must be an integer.';
  }
  return null;
}

const EDITABLE_ASSET_FIELDS = ['tag', 'amountMinor'];

function validatePatchAssetInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return 'An asset object is required.';
  }
  const unknownField = Object.keys(input).find((key) => !EDITABLE_ASSET_FIELDS.includes(key));
  if (unknownField) return `${unknownField} is not an editable field.`;
  if (input.tag !== undefined && !isNonEmptyString(input.tag)) {
    return 'tag must be a non-empty string.';
  }
  if (input.amountMinor !== undefined && !Number.isInteger(input.amountMinor)) {
    return 'amountMinor must be an integer.';
  }
  return null;
}

function validateCreateLiabilityInput(input) {
  if (!input || typeof input !== 'object') return 'A liability object is required.';
  if (!isNonEmptyString(input.tag)) return 'tag must be a non-empty string.';
  if (input.amountMinor !== undefined && !Number.isInteger(input.amountMinor)) {
    return 'amountMinor must be an integer.';
  }
  if (input.creditMinor !== undefined && !Number.isInteger(input.creditMinor)) {
    return 'creditMinor must be an integer.';
  }
  if (input.investment !== undefined && typeof input.investment !== 'boolean') {
    return 'investment must be a boolean.';
  }
  return null;
}

const EDITABLE_LIABILITY_FIELDS = ['tag', 'amountMinor', 'investment', 'creditMinor'];

function validatePatchLiabilityInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return 'A liability object is required.';
  }
  const unknownField = Object.keys(input).find((key) => !EDITABLE_LIABILITY_FIELDS.includes(key));
  if (unknownField) return `${unknownField} is not an editable field.`;
  if (input.tag !== undefined && !isNonEmptyString(input.tag)) {
    return 'tag must be a non-empty string.';
  }
  if (input.amountMinor !== undefined && !Number.isInteger(input.amountMinor)) {
    return 'amountMinor must be an integer.';
  }
  if (input.creditMinor !== undefined && !Number.isInteger(input.creditMinor)) {
    return 'creditMinor must be an integer.';
  }
  if (input.investment !== undefined && typeof input.investment !== 'boolean') {
    return 'investment must be a boolean.';
  }
  return null;
}

function validateCreateInvestmentInput(input) {
  if (!input || typeof input !== 'object') return 'An investment object is required.';
  if (!isNonEmptyString(input.tag)) return 'tag must be a non-empty string.';
  if (input.amountMinor !== undefined && !Number.isInteger(input.amountMinor)) {
    return 'amountMinor must be an integer.';
  }
  if (input.depositMinor !== undefined && !Number.isInteger(input.depositMinor)) {
    return 'depositMinor must be an integer.';
  }
  return null;
}

const EDITABLE_INVESTMENT_FIELDS = ['tag', 'amountMinor', 'depositMinor'];

function validatePatchInvestmentInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return 'An investment object is required.';
  }
  const unknownField = Object.keys(input).find((key) => !EDITABLE_INVESTMENT_FIELDS.includes(key));
  if (unknownField) return `${unknownField} is not an editable field.`;
  if (input.tag !== undefined && !isNonEmptyString(input.tag)) {
    return 'tag must be a non-empty string.';
  }
  if (input.amountMinor !== undefined && !Number.isInteger(input.amountMinor)) {
    return 'amountMinor must be an integer.';
  }
  if (input.depositMinor !== undefined && !Number.isInteger(input.depositMinor)) {
    return 'depositMinor must be an integer.';
  }
  return null;
}

function validateCreateShareInput(input) {
  if (!input || typeof input !== 'object') return 'A share object is required.';
  if (!isNonEmptyString(input.tag)) return 'tag must be a non-empty string.';
  if (input.quantity !== undefined && !Number.isFinite(input.quantity)) {
    return 'quantity must be a number.';
  }
  if (input.priceMinor !== undefined && !Number.isInteger(input.priceMinor)) {
    return 'priceMinor must be an integer.';
  }
  return null;
}

const EDITABLE_SHARE_FIELDS = ['tag', 'quantity', 'priceMinor'];

function validatePatchShareInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return 'A share object is required.';
  }
  const unknownField = Object.keys(input).find((key) => !EDITABLE_SHARE_FIELDS.includes(key));
  if (unknownField) return `${unknownField} is not an editable field.`;
  if (input.tag !== undefined && !isNonEmptyString(input.tag)) {
    return 'tag must be a non-empty string.';
  }
  if (input.quantity !== undefined && !Number.isFinite(input.quantity)) {
    return 'quantity must be a number.';
  }
  if (input.priceMinor !== undefined && !Number.isInteger(input.priceMinor)) {
    return 'priceMinor must be an integer.';
  }
  return null;
}

const GROW_PHASES = ['idea', 'research', 'plan', 'execute', 'monitor', 'completed'];
const GROW_TYPES = [
  'income-growth',
  'budget-optimization',
  'subscription-action',
  'expense-insight',
];
const GROW_MONEY_MINOR_FIELDS = [
  'currentCostMinor',
  'targetCostMinor',
  'monthlySavingsMinor',
  'annualSavingsMinor',
  'alternativeCostMinor',
];

function validateGrowCategory(category) {
  if (category === undefined) return null;
  const valid =
    typeof category === 'string' ||
    (Array.isArray(category) && category.every((entry) => typeof entry === 'string'));
  return valid ? null : 'category must be a string or an array of strings.';
}

function validateGrowSharedMetadataFields(input) {
  if (input.phase !== undefined && !GROW_PHASES.includes(input.phase)) {
    return `phase must be one of ${GROW_PHASES.join(', ')}.`;
  }
  if (input.type !== undefined && !GROW_TYPES.includes(input.type)) {
    return `type must be one of ${GROW_TYPES.join(', ')}.`;
  }
  if (input.riskScore !== undefined && !Number.isFinite(input.riskScore)) {
    return 'riskScore must be a number.';
  }
  if (
    input.links !== undefined &&
    (!Array.isArray(input.links) || !input.links.every(validateFundLink))
  ) {
    return 'links must be an array of {label, url} objects.';
  }
  if (
    input.actionItems !== undefined &&
    (!Array.isArray(input.actionItems) || !input.actionItems.every(validateFundActionItem))
  ) {
    return 'actionItems must be an array of {text, done?, priority?} objects.';
  }
  if (
    input.notes !== undefined &&
    (!Array.isArray(input.notes) || !input.notes.every(validateFundNote))
  ) {
    return 'notes must be an array of {text} objects.';
  }
  const categoryError = validateGrowCategory(input.category);
  if (categoryError) return categoryError;
  for (const field of GROW_MONEY_MINOR_FIELDS) {
    if (input[field] !== undefined && !Number.isInteger(input[field])) {
      return `${field} must be an integer.`;
    }
  }
  return null;
}

function validateCreateGrowInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return 'A grow project object is required.';
  }
  if (!isNonEmptyString(input.title)) return 'title must be a non-empty string.';
  if (input.isAsset !== undefined && typeof input.isAsset !== 'boolean') {
    return 'isAsset must be a boolean.';
  }
  if (input.share !== undefined && typeof input.share !== 'boolean') {
    return 'share must be a boolean (whether this project tracks a Share position).';
  }
  if (input.investment !== undefined && typeof input.investment !== 'boolean') {
    return 'investment must be a boolean (whether this project tracks an Investment position).';
  }
  const kindCount = [input.isAsset, input.share, input.investment].filter(Boolean).length;
  if (kindCount > 1) {
    return 'isAsset, share, and investment are mutually exclusive — set at most one to true.';
  }
  return validateGrowSharedMetadataFields(input);
}

const EDITABLE_GROW_FIELDS = [
  'title',
  'sub',
  'phase',
  'description',
  'strategy',
  'riskScore',
  'risks',
  'links',
  'actionItems',
  'notes',
  'type',
  'category',
  ...GROW_MONEY_MINOR_FIELDS,
  'reasoning',
  'alternative',
  'pattern',
  'insights',
  'status',
];

function validatePatchGrowInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return 'A grow project object is required.';
  }
  const unknownField = Object.keys(input).find((key) => !EDITABLE_GROW_FIELDS.includes(key));
  if (unknownField) {
    return `${unknownField} is not an editable field (use the typed action endpoints for amount/cashflow/share/investment/liabilitie).`;
  }
  if (input.title !== undefined && !isNonEmptyString(input.title)) {
    return 'title must be a non-empty string.';
  }
  return validateGrowSharedMetadataFields(input);
}

function validateGrowActionBody(input) {
  return !input || typeof input !== 'object' || Array.isArray(input)
    ? 'A request body object is required.'
    : null;
}

const GROW_ACTION_VALIDATION_CODES = [
  'GROW_INVALID_INPUT',
  'GROW_NO_KIND',
  'GROW_NO_POSITION',
  'GROW_NO_LIABILITY',
  'GROW_NOT_SHARE_KIND',
];

function handleGrowActionError(res, next, error, label) {
  if (error.code === 'GROW_NOT_FOUND') {
    return problem(
      res,
      404,
      'not_found',
      'Grow project not found',
      'No matching grow project exists.',
    );
  }
  if (GROW_ACTION_VALIDATION_CODES.includes(error.code)) {
    return problem(res, 400, 'validation_invalid', `Invalid ${label} request`, error.message);
  }
  return next(error);
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
 * Wraps a bulk write with the shared Idempotency-Key contract: requires the
 * header, replays a prior result for the same key + body, rejects the same
 * key reused with a different body, and otherwise runs `run()` once and
 * records its result on the audit entry so a later replay can find it. See
 * the "known gap" note where this is called: the write `run()` performs and
 * this audit record are not one atomic transaction. `resource` scopes the
 * idempotency lookup and audit entry to the calling resource (`transactions`,
 * `subscriptions`, ...) so two different bulk endpoints can't collide on the
 * same key.
 *
 * `onError`, if given, gets first look at anything `run()` throws and may
 * return a Problem Details response of its own (matching this file's usual
 * `if (error.code === '...') return problem(...)` inline pattern, just
 * relocated here since this helper's own `catch` — falling through to the
 * generic `next(error)` 500 handler — would otherwise be the only thing
 * that sees it). Return `undefined`/nothing from `onError` to fall through
 * to that default `next(error)` handling for anything it doesn't recognize.
 */
async function handleIdempotentBulkWrite(
  req,
  res,
  next,
  { resource = 'transactions', requestBodyForHash, itemCount, run, onError },
) {
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
      resource,
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
        resource,
        itemCount,
        idempotencyKey,
        requestHash,
        payload: response,
      },
      session ? (value) => session.encrypt(value) : undefined,
    );
    return res.status(200).json(response);
  } catch (error) {
    if (onError) {
      const handled = onError(error);
      if (handled !== undefined) return handled;
    }
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

router.get('/smile', requireScope('smile:r'), async (req, res, next) => {
  try {
    const projects = await listSmileProjects(
      { usersDb: getUsersDb(), authDb: getAuthDb() },
      req.userId,
    );
    return res.json({ projects });
  } catch (error) {
    return next(error);
  }
});

router.post('/smile', requireScope('smile:w'), async (req, res, next) => {
  const validationError = validateCreateSmileProjectInput(req.body);
  if (validationError) {
    return problem(
      res,
      400,
      'validation_invalid',
      'Invalid Smile project request',
      validationError,
    );
  }
  try {
    const project = await createSmileProject(
      { usersDb: getUsersDb(), authDb: getAuthDb() },
      req.userId,
      req.body,
    );
    await recordAuditEntry(getAuditDb(), {
      userId: req.userId,
      actor: auditActor(req.auth),
      method: req.method,
      path: req.baseUrl + req.path,
      resource: 'smile',
      resourceId: project.id,
    });
    return res.status(201).json(project);
  } catch (error) {
    if (error.code === 'SMILE_DUPLICATE_TITLE') {
      return problem(
        res,
        400,
        'validation_invalid',
        'Invalid Smile project request',
        error.message,
      );
    }
    return next(error);
  }
});

router.get('/smile/:projectId', requireScope('smile:r'), async (req, res, next) => {
  try {
    const project = await getSmileProject(
      { usersDb: getUsersDb(), authDb: getAuthDb() },
      req.userId,
      req.params.projectId,
    );
    if (!project) {
      return problem(
        res,
        404,
        'not_found',
        'Smile project not found',
        'No matching Smile project exists.',
      );
    }
    return res.json(project);
  } catch (error) {
    return next(error);
  }
});

router.patch('/smile/:projectId', requireScope('smile:w'), async (req, res, next) => {
  const validationError = validatePatchSmileProjectInput(req.body);
  if (validationError) {
    return problem(
      res,
      400,
      'validation_invalid',
      'Invalid Smile project request',
      validationError,
    );
  }
  try {
    const project = await updateSmileProject(
      { usersDb: getUsersDb(), authDb: getAuthDb() },
      req.userId,
      req.params.projectId,
      req.body,
    );
    if (!project) {
      return problem(
        res,
        404,
        'not_found',
        'Smile project not found',
        'No matching Smile project exists.',
      );
    }
    await recordAuditEntry(getAuditDb(), {
      userId: req.userId,
      actor: auditActor(req.auth),
      method: req.method,
      path: req.baseUrl + req.path,
      resource: 'smile',
      resourceId: project.id,
    });
    return res.json(project);
  } catch (error) {
    if (error.code === 'SMILE_DUPLICATE_TITLE') {
      return problem(
        res,
        400,
        'validation_invalid',
        'Invalid Smile project request',
        error.message,
      );
    }
    return next(error);
  }
});

router.delete('/smile/:projectId', requireScope('smile:w'), async (req, res, next) => {
  try {
    const deleted = await deleteSmileProject(
      { usersDb: getUsersDb(), authDb: getAuthDb() },
      req.userId,
      req.params.projectId,
    );
    if (!deleted) {
      return problem(
        res,
        404,
        'not_found',
        'Smile project not found',
        'No matching Smile project exists.',
      );
    }
    await recordAuditEntry(getAuditDb(), {
      userId: req.userId,
      actor: auditActor(req.auth),
      method: req.method,
      path: req.baseUrl + req.path,
      resource: 'smile',
      resourceId: req.params.projectId,
    });
    return res.json({ id: req.params.projectId });
  } catch (error) {
    return next(error);
  }
});

router.post('/smile/:projectId/payment-plan', requireScope('smile:w'), async (req, res, next) => {
  const validationError = validateCreatePaymentPlanInput(req.body);
  if (validationError) {
    return problem(res, 400, 'validation_invalid', 'Invalid payment plan request', validationError);
  }
  try {
    const plan = await createSmilePaymentPlan(
      { usersDb: getUsersDb(), authDb: getAuthDb() },
      req.userId,
      req.params.projectId,
      req.body,
    );
    if (!plan) {
      return problem(
        res,
        404,
        'not_found',
        'Smile project not found',
        'No matching Smile project exists.',
      );
    }
    await recordAuditEntry(getAuditDb(), {
      userId: req.userId,
      actor: auditActor(req.auth),
      method: req.method,
      path: req.baseUrl + req.path,
      resource: 'smile',
      resourceId: req.params.projectId,
    });
    return res.status(201).json(plan);
  } catch (error) {
    if (error.code === 'PAYMENT_PLAN_INVALID') {
      return problem(res, 400, 'validation_invalid', 'Invalid payment plan request', error.message);
    }
    return next(error);
  }
});

router.get('/fire', requireScope('fire:r'), async (req, res, next) => {
  try {
    const projects = await listFireProjects(
      { usersDb: getUsersDb(), authDb: getAuthDb() },
      req.userId,
    );
    return res.json({ projects });
  } catch (error) {
    return next(error);
  }
});

router.post('/fire', requireScope('fire:w'), async (req, res, next) => {
  const validationError = validateCreateFireProjectInput(req.body);
  if (validationError) {
    return problem(res, 400, 'validation_invalid', 'Invalid Fire project request', validationError);
  }
  try {
    const project = await createFireProject(
      { usersDb: getUsersDb(), authDb: getAuthDb() },
      req.userId,
      req.body,
    );
    await recordAuditEntry(getAuditDb(), {
      userId: req.userId,
      actor: auditActor(req.auth),
      method: req.method,
      path: req.baseUrl + req.path,
      resource: 'fire',
      resourceId: project.id,
    });
    return res.status(201).json(project);
  } catch (error) {
    if (error.code === 'FIRE_DUPLICATE_TITLE') {
      return problem(res, 400, 'validation_invalid', 'Invalid Fire project request', error.message);
    }
    return next(error);
  }
});

router.get('/fire/:projectId', requireScope('fire:r'), async (req, res, next) => {
  try {
    const project = await getFireProject(
      { usersDb: getUsersDb(), authDb: getAuthDb() },
      req.userId,
      req.params.projectId,
    );
    if (!project) {
      return problem(
        res,
        404,
        'not_found',
        'Fire project not found',
        'No matching Fire project exists.',
      );
    }
    return res.json(project);
  } catch (error) {
    return next(error);
  }
});

router.patch('/fire/:projectId', requireScope('fire:w'), async (req, res, next) => {
  const validationError = validatePatchFireProjectInput(req.body);
  if (validationError) {
    return problem(res, 400, 'validation_invalid', 'Invalid Fire project request', validationError);
  }
  try {
    const project = await updateFireProject(
      { usersDb: getUsersDb(), authDb: getAuthDb() },
      req.userId,
      req.params.projectId,
      req.body,
    );
    if (!project) {
      return problem(
        res,
        404,
        'not_found',
        'Fire project not found',
        'No matching Fire project exists.',
      );
    }
    await recordAuditEntry(getAuditDb(), {
      userId: req.userId,
      actor: auditActor(req.auth),
      method: req.method,
      path: req.baseUrl + req.path,
      resource: 'fire',
      resourceId: project.id,
    });
    return res.json(project);
  } catch (error) {
    if (error.code === 'FIRE_DUPLICATE_TITLE') {
      return problem(res, 400, 'validation_invalid', 'Invalid Fire project request', error.message);
    }
    return next(error);
  }
});

router.delete('/fire/:projectId', requireScope('fire:w'), async (req, res, next) => {
  try {
    const deleted = await deleteFireProject(
      { usersDb: getUsersDb(), authDb: getAuthDb() },
      req.userId,
      req.params.projectId,
    );
    if (!deleted) {
      return problem(
        res,
        404,
        'not_found',
        'Fire project not found',
        'No matching Fire project exists.',
      );
    }
    await recordAuditEntry(getAuditDb(), {
      userId: req.userId,
      actor: auditActor(req.auth),
      method: req.method,
      path: req.baseUrl + req.path,
      resource: 'fire',
      resourceId: req.params.projectId,
    });
    return res.json({ id: req.params.projectId });
  } catch (error) {
    return next(error);
  }
});

router.post('/fire/:projectId/payment-plan', requireScope('fire:w'), async (req, res, next) => {
  const validationError = validateCreatePaymentPlanInput(req.body);
  if (validationError) {
    return problem(res, 400, 'validation_invalid', 'Invalid payment plan request', validationError);
  }
  try {
    const plan = await createFirePaymentPlan(
      { usersDb: getUsersDb(), authDb: getAuthDb() },
      req.userId,
      req.params.projectId,
      req.body,
    );
    if (!plan) {
      return problem(
        res,
        404,
        'not_found',
        'Fire project not found',
        'No matching Fire project exists.',
      );
    }
    await recordAuditEntry(getAuditDb(), {
      userId: req.userId,
      actor: auditActor(req.auth),
      method: req.method,
      path: req.baseUrl + req.path,
      resource: 'fire',
      resourceId: req.params.projectId,
    });
    return res.status(201).json(plan);
  } catch (error) {
    if (error.code === 'PAYMENT_PLAN_INVALID') {
      return problem(res, 400, 'validation_invalid', 'Invalid payment plan request', error.message);
    }
    return next(error);
  }
});

router.get('/balance/assets', requireScope('balance:r'), async (req, res, next) => {
  try {
    const assets = await listAssets({ usersDb: getUsersDb(), authDb: getAuthDb() }, req.userId);
    return res.json({ assets });
  } catch (error) {
    return next(error);
  }
});

router.post('/balance/assets', requireScope('balance:w'), async (req, res, next) => {
  const validationError = validateCreateAssetInput(req.body);
  if (validationError) {
    return problem(res, 400, 'validation_invalid', 'Invalid asset request', validationError);
  }
  try {
    const asset = await createAsset(
      { usersDb: getUsersDb(), authDb: getAuthDb() },
      req.userId,
      req.body,
    );
    await recordAuditEntry(getAuditDb(), {
      userId: req.userId,
      actor: auditActor(req.auth),
      method: req.method,
      path: req.baseUrl + req.path,
      resource: 'balance_assets',
      resourceId: asset.id,
    });
    return res.status(201).json(asset);
  } catch (error) {
    if (error.code === 'ASSET_DUPLICATE_TAG') {
      return problem(res, 400, 'validation_invalid', 'Invalid asset request', error.message);
    }
    return next(error);
  }
});

router.get('/balance/assets/:assetId', requireScope('balance:r'), async (req, res, next) => {
  try {
    const asset = await getAsset(
      { usersDb: getUsersDb(), authDb: getAuthDb() },
      req.userId,
      req.params.assetId,
    );
    if (!asset) {
      return problem(res, 404, 'not_found', 'Asset not found', 'No matching asset exists.');
    }
    return res.json(asset);
  } catch (error) {
    return next(error);
  }
});

router.patch('/balance/assets/:assetId', requireScope('balance:w'), async (req, res, next) => {
  const validationError = validatePatchAssetInput(req.body);
  if (validationError) {
    return problem(res, 400, 'validation_invalid', 'Invalid asset request', validationError);
  }
  try {
    const asset = await updateAsset(
      { usersDb: getUsersDb(), authDb: getAuthDb() },
      req.userId,
      req.params.assetId,
      req.body,
    );
    if (!asset) {
      return problem(res, 404, 'not_found', 'Asset not found', 'No matching asset exists.');
    }
    await recordAuditEntry(getAuditDb(), {
      userId: req.userId,
      actor: auditActor(req.auth),
      method: req.method,
      path: req.baseUrl + req.path,
      resource: 'balance_assets',
      resourceId: asset.id,
    });
    return res.json(asset);
  } catch (error) {
    if (error.code === 'ASSET_DUPLICATE_TAG') {
      return problem(res, 400, 'validation_invalid', 'Invalid asset request', error.message);
    }
    return next(error);
  }
});

router.delete('/balance/assets/:assetId', requireScope('balance:w'), async (req, res, next) => {
  try {
    const deleted = await deleteAsset(
      { usersDb: getUsersDb(), authDb: getAuthDb() },
      req.userId,
      req.params.assetId,
    );
    if (!deleted) {
      return problem(res, 404, 'not_found', 'Asset not found', 'No matching asset exists.');
    }
    await recordAuditEntry(getAuditDb(), {
      userId: req.userId,
      actor: auditActor(req.auth),
      method: req.method,
      path: req.baseUrl + req.path,
      resource: 'balance_assets',
      resourceId: req.params.assetId,
    });
    return res.json({ id: req.params.assetId });
  } catch (error) {
    return next(error);
  }
});

router.get('/balance/liabilities', requireScope('balance:r'), async (req, res, next) => {
  try {
    const liabilities = await listLiabilities(
      { usersDb: getUsersDb(), authDb: getAuthDb() },
      req.userId,
    );
    return res.json({ liabilities });
  } catch (error) {
    return next(error);
  }
});

router.post('/balance/liabilities', requireScope('balance:w'), async (req, res, next) => {
  const validationError = validateCreateLiabilityInput(req.body);
  if (validationError) {
    return problem(res, 400, 'validation_invalid', 'Invalid liability request', validationError);
  }
  try {
    const liability = await createLiability(
      { usersDb: getUsersDb(), authDb: getAuthDb() },
      req.userId,
      req.body,
    );
    await recordAuditEntry(getAuditDb(), {
      userId: req.userId,
      actor: auditActor(req.auth),
      method: req.method,
      path: req.baseUrl + req.path,
      resource: 'balance_liabilities',
      resourceId: liability.id,
    });
    return res.status(201).json(liability);
  } catch (error) {
    if (error.code === 'LIABILITY_DUPLICATE_TAG') {
      return problem(res, 400, 'validation_invalid', 'Invalid liability request', error.message);
    }
    return next(error);
  }
});

router.get(
  '/balance/liabilities/:liabilityId',
  requireScope('balance:r'),
  async (req, res, next) => {
    try {
      const liability = await getLiability(
        { usersDb: getUsersDb(), authDb: getAuthDb() },
        req.userId,
        req.params.liabilityId,
      );
      if (!liability) {
        return problem(
          res,
          404,
          'not_found',
          'Liability not found',
          'No matching liability exists.',
        );
      }
      return res.json(liability);
    } catch (error) {
      return next(error);
    }
  },
);

router.patch(
  '/balance/liabilities/:liabilityId',
  requireScope('balance:w'),
  async (req, res, next) => {
    const validationError = validatePatchLiabilityInput(req.body);
    if (validationError) {
      return problem(res, 400, 'validation_invalid', 'Invalid liability request', validationError);
    }
    try {
      const liability = await updateLiability(
        { usersDb: getUsersDb(), authDb: getAuthDb() },
        req.userId,
        req.params.liabilityId,
        req.body,
      );
      if (!liability) {
        return problem(
          res,
          404,
          'not_found',
          'Liability not found',
          'No matching liability exists.',
        );
      }
      await recordAuditEntry(getAuditDb(), {
        userId: req.userId,
        actor: auditActor(req.auth),
        method: req.method,
        path: req.baseUrl + req.path,
        resource: 'balance_liabilities',
        resourceId: liability.id,
      });
      return res.json(liability);
    } catch (error) {
      if (error.code === 'LIABILITY_DUPLICATE_TAG') {
        return problem(res, 400, 'validation_invalid', 'Invalid liability request', error.message);
      }
      return next(error);
    }
  },
);

router.delete(
  '/balance/liabilities/:liabilityId',
  requireScope('balance:w'),
  async (req, res, next) => {
    try {
      const deleted = await deleteLiability(
        { usersDb: getUsersDb(), authDb: getAuthDb() },
        req.userId,
        req.params.liabilityId,
      );
      if (!deleted) {
        return problem(
          res,
          404,
          'not_found',
          'Liability not found',
          'No matching liability exists.',
        );
      }
      await recordAuditEntry(getAuditDb(), {
        userId: req.userId,
        actor: auditActor(req.auth),
        method: req.method,
        path: req.baseUrl + req.path,
        resource: 'balance_liabilities',
        resourceId: req.params.liabilityId,
      });
      return res.json({ id: req.params.liabilityId });
    } catch (error) {
      return next(error);
    }
  },
);

router.get('/balance/investments', requireScope('balance:r'), async (req, res, next) => {
  try {
    const investments = await listInvestments(
      { usersDb: getUsersDb(), authDb: getAuthDb() },
      req.userId,
    );
    return res.json({ investments });
  } catch (error) {
    return next(error);
  }
});

router.post('/balance/investments', requireScope('balance:w'), async (req, res, next) => {
  const validationError = validateCreateInvestmentInput(req.body);
  if (validationError) {
    return problem(res, 400, 'validation_invalid', 'Invalid investment request', validationError);
  }
  try {
    const investment = await createInvestment(
      { usersDb: getUsersDb(), authDb: getAuthDb() },
      req.userId,
      req.body,
    );
    await recordAuditEntry(getAuditDb(), {
      userId: req.userId,
      actor: auditActor(req.auth),
      method: req.method,
      path: req.baseUrl + req.path,
      resource: 'balance_investments',
      resourceId: investment.id,
    });
    return res.status(201).json(investment);
  } catch (error) {
    if (error.code === 'INVESTMENT_DUPLICATE_TAG') {
      return problem(res, 400, 'validation_invalid', 'Invalid investment request', error.message);
    }
    return next(error);
  }
});

router.get(
  '/balance/investments/:investmentId',
  requireScope('balance:r'),
  async (req, res, next) => {
    try {
      const investment = await getInvestment(
        { usersDb: getUsersDb(), authDb: getAuthDb() },
        req.userId,
        req.params.investmentId,
      );
      if (!investment) {
        return problem(
          res,
          404,
          'not_found',
          'Investment not found',
          'No matching investment exists.',
        );
      }
      return res.json(investment);
    } catch (error) {
      return next(error);
    }
  },
);

router.patch(
  '/balance/investments/:investmentId',
  requireScope('balance:w'),
  async (req, res, next) => {
    const validationError = validatePatchInvestmentInput(req.body);
    if (validationError) {
      return problem(res, 400, 'validation_invalid', 'Invalid investment request', validationError);
    }
    try {
      const investment = await updateInvestment(
        { usersDb: getUsersDb(), authDb: getAuthDb() },
        req.userId,
        req.params.investmentId,
        req.body,
      );
      if (!investment) {
        return problem(
          res,
          404,
          'not_found',
          'Investment not found',
          'No matching investment exists.',
        );
      }
      await recordAuditEntry(getAuditDb(), {
        userId: req.userId,
        actor: auditActor(req.auth),
        method: req.method,
        path: req.baseUrl + req.path,
        resource: 'balance_investments',
        resourceId: investment.id,
      });
      return res.json(investment);
    } catch (error) {
      if (error.code === 'INVESTMENT_DUPLICATE_TAG') {
        return problem(res, 400, 'validation_invalid', 'Invalid investment request', error.message);
      }
      return next(error);
    }
  },
);

router.delete(
  '/balance/investments/:investmentId',
  requireScope('balance:w'),
  async (req, res, next) => {
    try {
      const deleted = await deleteInvestment(
        { usersDb: getUsersDb(), authDb: getAuthDb() },
        req.userId,
        req.params.investmentId,
      );
      if (!deleted) {
        return problem(
          res,
          404,
          'not_found',
          'Investment not found',
          'No matching investment exists.',
        );
      }
      await recordAuditEntry(getAuditDb(), {
        userId: req.userId,
        actor: auditActor(req.auth),
        method: req.method,
        path: req.baseUrl + req.path,
        resource: 'balance_investments',
        resourceId: req.params.investmentId,
      });
      return res.json({ id: req.params.investmentId });
    } catch (error) {
      return next(error);
    }
  },
);

router.get('/balance/shares', requireScope('balance:r'), async (req, res, next) => {
  try {
    const shares = await listShares({ usersDb: getUsersDb(), authDb: getAuthDb() }, req.userId);
    return res.json({ shares });
  } catch (error) {
    return next(error);
  }
});

router.post('/balance/shares', requireScope('balance:w'), async (req, res, next) => {
  const validationError = validateCreateShareInput(req.body);
  if (validationError) {
    return problem(res, 400, 'validation_invalid', 'Invalid share request', validationError);
  }
  try {
    const share = await createShare(
      { usersDb: getUsersDb(), authDb: getAuthDb() },
      req.userId,
      req.body,
    );
    await recordAuditEntry(getAuditDb(), {
      userId: req.userId,
      actor: auditActor(req.auth),
      method: req.method,
      path: req.baseUrl + req.path,
      resource: 'balance_shares',
      resourceId: share.id,
    });
    return res.status(201).json(share);
  } catch (error) {
    if (error.code === 'SHARE_DUPLICATE_TAG') {
      return problem(res, 400, 'validation_invalid', 'Invalid share request', error.message);
    }
    return next(error);
  }
});

router.get('/balance/shares/:shareId', requireScope('balance:r'), async (req, res, next) => {
  try {
    const share = await getShare(
      { usersDb: getUsersDb(), authDb: getAuthDb() },
      req.userId,
      req.params.shareId,
    );
    if (!share) {
      return problem(res, 404, 'not_found', 'Share not found', 'No matching share exists.');
    }
    return res.json(share);
  } catch (error) {
    return next(error);
  }
});

router.patch('/balance/shares/:shareId', requireScope('balance:w'), async (req, res, next) => {
  const validationError = validatePatchShareInput(req.body);
  if (validationError) {
    return problem(res, 400, 'validation_invalid', 'Invalid share request', validationError);
  }
  try {
    const share = await updateShare(
      { usersDb: getUsersDb(), authDb: getAuthDb() },
      req.userId,
      req.params.shareId,
      req.body,
    );
    if (!share) {
      return problem(res, 404, 'not_found', 'Share not found', 'No matching share exists.');
    }
    await recordAuditEntry(getAuditDb(), {
      userId: req.userId,
      actor: auditActor(req.auth),
      method: req.method,
      path: req.baseUrl + req.path,
      resource: 'balance_shares',
      resourceId: share.id,
    });
    return res.json(share);
  } catch (error) {
    if (error.code === 'SHARE_DUPLICATE_TAG') {
      return problem(res, 400, 'validation_invalid', 'Invalid share request', error.message);
    }
    return next(error);
  }
});

router.delete('/balance/shares/:shareId', requireScope('balance:w'), async (req, res, next) => {
  try {
    const deleted = await deleteShare(
      { usersDb: getUsersDb(), authDb: getAuthDb() },
      req.userId,
      req.params.shareId,
    );
    if (!deleted) {
      return problem(res, 404, 'not_found', 'Share not found', 'No matching share exists.');
    }
    await recordAuditEntry(getAuditDb(), {
      userId: req.userId,
      actor: auditActor(req.auth),
      method: req.method,
      path: req.baseUrl + req.path,
      resource: 'balance_shares',
      resourceId: req.params.shareId,
    });
    return res.json({ id: req.params.shareId });
  } catch (error) {
    return next(error);
  }
});

router.get('/income/revenues', requireScope('income:r'), async (req, res, next) => {
  try {
    const revenues = await listRevenues({ usersDb: getUsersDb(), authDb: getAuthDb() }, req.userId);
    return res.json({ revenues });
  } catch (error) {
    return next(error);
  }
});

router.get('/income/interests', requireScope('income:r'), async (req, res, next) => {
  try {
    const interests = await listInterests(
      { usersDb: getUsersDb(), authDb: getAuthDb() },
      req.userId,
    );
    return res.json({ interests });
  } catch (error) {
    return next(error);
  }
});

router.get('/income/properties', requireScope('income:r'), async (req, res, next) => {
  try {
    const properties = await listProperties(
      { usersDb: getUsersDb(), authDb: getAuthDb() },
      req.userId,
    );
    return res.json({ properties });
  } catch (error) {
    return next(error);
  }
});

router.get('/mojo', requireScope('mojo:r'), async (req, res, next) => {
  try {
    const status = await getMojoStatus({ usersDb: getUsersDb(), authDb: getAuthDb() }, req.userId);
    return res.json(status);
  } catch (error) {
    return next(error);
  }
});

router.put('/mojo', requireScope('mojo:w'), async (req, res, next) => {
  const targetMinor = req.body?.targetMinor;
  if (!Number.isInteger(targetMinor) || targetMinor < 1) {
    return problem(
      res,
      400,
      'validation_invalid',
      'Invalid Mojo request',
      'targetMinor must be an integer of at least 1.',
    );
  }
  try {
    const status = await updateMojoTarget(
      { usersDb: getUsersDb(), authDb: getAuthDb() },
      req.userId,
      targetMinor,
    );
    await recordAuditEntry(getAuditDb(), {
      userId: req.userId,
      actor: auditActor(req.auth),
      method: req.method,
      path: req.baseUrl + req.path,
      resource: 'mojo',
    });
    return res.json(status);
  } catch (error) {
    return next(error);
  }
});

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
    const statement = await getCashflow(
      { usersDb: getUsersDb(), authDb: getAuthDb() },
      req.userId,
      {
        period: validation.period,
        offset: validation.offset,
      },
    );
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

router.get('/reports/kpis', requireScope('reports:r'), async (req, res, next) => {
  const validation = validateReportPeriodQuery(req.query);
  if (validation.error) {
    return problem(res, 400, 'validation_invalid', 'Invalid report request', validation.error);
  }
  try {
    const report = await getKpis({ usersDb: getUsersDb(), authDb: getAuthDb() }, req.userId, {
      period: validation.period,
      offset: validation.offset,
    });
    return res.json(report);
  } catch (error) {
    return next(error);
  }
});

router.get('/reports/fire-coverage', requireScope('reports:r'), async (req, res, next) => {
  try {
    const report = await getFireCoverage(
      { usersDb: getUsersDb(), authDb: getAuthDb() },
      req.userId,
    );
    return res.json(report);
  } catch (error) {
    return next(error);
  }
});

router.get('/reports/grow/:growId/pnl', requireScope('reports:r'), async (req, res, next) => {
  try {
    const report = await getGrowPnl(
      { usersDb: getUsersDb(), authDb: getAuthDb() },
      req.userId,
      req.params.growId,
    );
    if (!report) {
      return problem(
        res,
        404,
        'not_found',
        'Grow project not found',
        'No matching grow project exists.',
      );
    }
    return res.json(report);
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

router.get('/grow', requireScope('grow:r'), async (req, res, next) => {
  try {
    const grow = await listGrow({ usersDb: getUsersDb(), authDb: getAuthDb() }, req.userId);
    return res.json({ grow });
  } catch (error) {
    return next(error);
  }
});

router.post('/grow', requireScope('grow:w'), async (req, res, next) => {
  const validationError = validateCreateGrowInput(req.body);
  if (validationError) {
    return problem(res, 400, 'validation_invalid', 'Invalid grow project request', validationError);
  }
  try {
    const project = await createGrow(
      { usersDb: getUsersDb(), authDb: getAuthDb() },
      req.userId,
      req.body,
    );
    await recordAuditEntry(getAuditDb(), {
      userId: req.userId,
      actor: auditActor(req.auth),
      method: req.method,
      path: req.baseUrl + req.path,
      resource: 'grow',
      resourceId: project.id,
    });
    return res.status(201).json(project);
  } catch (error) {
    if (error.code === 'GROW_DUPLICATE_TITLE') {
      return problem(res, 400, 'validation_invalid', 'Invalid grow project request', error.message);
    }
    return next(error);
  }
});

router.get('/grow/:growId', requireScope('grow:r'), async (req, res, next) => {
  try {
    const project = await getGrow(
      { usersDb: getUsersDb(), authDb: getAuthDb() },
      req.userId,
      req.params.growId,
    );
    if (!project) {
      return problem(
        res,
        404,
        'not_found',
        'Grow project not found',
        'No matching grow project exists.',
      );
    }
    return res.json(project);
  } catch (error) {
    return next(error);
  }
});

router.patch('/grow/:growId', requireScope('grow:w'), async (req, res, next) => {
  const validationError = validatePatchGrowInput(req.body);
  if (validationError) {
    return problem(res, 400, 'validation_invalid', 'Invalid grow project request', validationError);
  }
  try {
    const project = await updateGrow(
      { usersDb: getUsersDb(), authDb: getAuthDb() },
      req.userId,
      req.params.growId,
      req.body,
    );
    if (!project) {
      return problem(
        res,
        404,
        'not_found',
        'Grow project not found',
        'No matching grow project exists.',
      );
    }
    await recordAuditEntry(getAuditDb(), {
      userId: req.userId,
      actor: auditActor(req.auth),
      method: req.method,
      path: req.baseUrl + req.path,
      resource: 'grow',
      resourceId: project.id,
    });
    return res.json(project);
  } catch (error) {
    if (error.code === 'GROW_DUPLICATE_TITLE' || error.code === 'GROW_MONEY_FIELD_NOT_PATCHABLE') {
      return problem(res, 400, 'validation_invalid', 'Invalid grow project request', error.message);
    }
    return next(error);
  }
});

router.delete('/grow/:growId', requireScope('grow:w'), async (req, res, next) => {
  try {
    const deleted = await deleteGrow(
      { usersDb: getUsersDb(), authDb: getAuthDb() },
      req.userId,
      req.params.growId,
    );
    if (!deleted) {
      return problem(
        res,
        404,
        'not_found',
        'Grow project not found',
        'No matching grow project exists.',
      );
    }
    await recordAuditEntry(getAuditDb(), {
      userId: req.userId,
      actor: auditActor(req.auth),
      method: req.method,
      path: req.baseUrl + req.path,
      resource: 'grow',
      resourceId: req.params.growId,
    });
    return res.json({ id: req.params.growId });
  } catch (error) {
    return next(error);
  }
});

router.post('/grow/:growId/buy', requireScope('grow:w'), async (req, res, next) => {
  const validationError = validateGrowActionBody(req.body);
  if (validationError) {
    return problem(res, 400, 'validation_invalid', 'Invalid buy request', validationError);
  }
  try {
    const result = await buyGrow(
      { usersDb: getUsersDb(), authDb: getAuthDb() },
      req.userId,
      req.params.growId,
      req.body,
    );
    await recordAuditEntry(getAuditDb(), {
      userId: req.userId,
      actor: auditActor(req.auth),
      method: req.method,
      path: req.baseUrl + req.path,
      resource: 'grow_buy',
      resourceId: req.params.growId,
    });
    return res.status(201).json(result);
  } catch (error) {
    return handleGrowActionError(res, next, error, 'buy');
  }
});

router.post('/grow/:growId/sell', requireScope('grow:w'), async (req, res, next) => {
  const validationError = validateGrowActionBody(req.body);
  if (validationError) {
    return problem(res, 400, 'validation_invalid', 'Invalid sell request', validationError);
  }
  try {
    const result = await sellGrow(
      { usersDb: getUsersDb(), authDb: getAuthDb() },
      req.userId,
      req.params.growId,
      req.body,
    );
    await recordAuditEntry(getAuditDb(), {
      userId: req.userId,
      actor: auditActor(req.auth),
      method: req.method,
      path: req.baseUrl + req.path,
      resource: 'grow_sell',
      resourceId: req.params.growId,
    });
    return res.status(201).json(result);
  } catch (error) {
    return handleGrowActionError(res, next, error, 'sell');
  }
});

router.post('/grow/:growId/dividend', requireScope('grow:w'), async (req, res, next) => {
  const validationError = validateGrowActionBody(req.body);
  if (validationError) {
    return problem(res, 400, 'validation_invalid', 'Invalid dividend request', validationError);
  }
  try {
    const result = await dividendGrow(
      { usersDb: getUsersDb(), authDb: getAuthDb() },
      req.userId,
      req.params.growId,
      req.body,
    );
    await recordAuditEntry(getAuditDb(), {
      userId: req.userId,
      actor: auditActor(req.auth),
      method: req.method,
      path: req.baseUrl + req.path,
      resource: 'grow_dividend',
      resourceId: req.params.growId,
    });
    return res.status(201).json(result);
  } catch (error) {
    return handleGrowActionError(res, next, error, 'dividend');
  }
});

router.post('/grow/:growId/payback', requireScope('grow:w'), async (req, res, next) => {
  const validationError = validateGrowActionBody(req.body);
  if (validationError) {
    return problem(res, 400, 'validation_invalid', 'Invalid payback request', validationError);
  }
  try {
    const result = await paybackGrow(
      { usersDb: getUsersDb(), authDb: getAuthDb() },
      req.userId,
      req.params.growId,
      req.body,
    );
    await recordAuditEntry(getAuditDb(), {
      userId: req.userId,
      actor: auditActor(req.auth),
      method: req.method,
      path: req.baseUrl + req.path,
      resource: 'grow_payback',
      resourceId: req.params.growId,
    });
    return res.status(201).json(result);
  } catch (error) {
    return handleGrowActionError(res, next, error, 'payback');
  }
});

router.post('/grow/:growId/cashflow', requireScope('grow:w'), async (req, res, next) => {
  const validationError = validateGrowActionBody(req.body);
  if (validationError) {
    return problem(res, 400, 'validation_invalid', 'Invalid cashflow request', validationError);
  }
  try {
    const result = await cashflowGrow(
      { usersDb: getUsersDb(), authDb: getAuthDb() },
      req.userId,
      req.params.growId,
      req.body,
    );
    await recordAuditEntry(getAuditDb(), {
      userId: req.userId,
      actor: auditActor(req.auth),
      method: req.method,
      path: req.baseUrl + req.path,
      resource: 'grow_cashflow',
      resourceId: req.params.growId,
    });
    return res.status(201).json(result);
  } catch (error) {
    return handleGrowActionError(res, next, error, 'cashflow');
  }
});

router.post('/grow/:growId/deposit', requireScope('grow:w'), async (req, res, next) => {
  const validationError = validateGrowActionBody(req.body);
  if (validationError) {
    return problem(res, 400, 'validation_invalid', 'Invalid deposit request', validationError);
  }
  try {
    const result = await depositGrow(
      { usersDb: getUsersDb(), authDb: getAuthDb() },
      req.userId,
      req.params.growId,
      req.body,
    );
    await recordAuditEntry(getAuditDb(), {
      userId: req.userId,
      actor: auditActor(req.auth),
      method: req.method,
      path: req.baseUrl + req.path,
      resource: 'grow_deposit',
      resourceId: req.params.growId,
    });
    return res.status(201).json(result);
  } catch (error) {
    return handleGrowActionError(res, next, error, 'deposit');
  }
});

router.get('/subscriptions', requireScope('subscriptions:r'), async (req, res, next) => {
  try {
    const subscriptions = await listSubscriptions(
      { usersDb: getUsersDb(), authDb: getAuthDb() },
      req.userId,
    );
    return res.json({ subscriptions });
  } catch (error) {
    return next(error);
  }
});

router.post('/subscriptions', requireScope('subscriptions:w'), async (req, res, next) => {
  const validationError = validateSubscriptionInput(req.body);
  if (validationError) {
    return problem(res, 400, 'validation_invalid', 'Invalid subscription request', validationError);
  }
  try {
    const subscription = await createSubscription(
      { usersDb: getUsersDb(), authDb: getAuthDb() },
      req.userId,
      req.body,
    );
    await recordAuditEntry(getAuditDb(), {
      userId: req.userId,
      actor: auditActor(req.auth),
      method: req.method,
      path: req.baseUrl + req.path,
      resource: 'subscriptions',
      resourceId: subscription.id,
    });
    return res.status(201).json(subscription);
  } catch (error) {
    return next(error);
  }
});

// Registered before the `/subscriptions/:subscriptionId` route below so `export` is never
// captured as a subscription id.
router.get('/subscriptions/export', requireScope('subscriptions:bulk'), async (req, res, next) => {
  try {
    const subscriptions = await listSubscriptions(
      { usersDb: getUsersDb(), authDb: getAuthDb() },
      req.userId,
    );
    await recordAuditEntry(getAuditDb(), {
      userId: req.userId,
      actor: auditActor(req.auth),
      method: req.method,
      path: req.baseUrl + req.path,
      resource: 'subscriptions',
      itemCount: subscriptions.length,
    });
    res.type('application/x-ndjson');
    return res.send(subscriptions.map((subscription) => JSON.stringify(subscription)).join('\n'));
  } catch (error) {
    return next(error);
  }
});

router.get(
  '/subscriptions/:subscriptionId',
  requireScope('subscriptions:r'),
  async (req, res, next) => {
    try {
      const subscription = await getSubscription(
        { usersDb: getUsersDb(), authDb: getAuthDb() },
        req.userId,
        req.params.subscriptionId,
      );
      if (!subscription) {
        return problem(
          res,
          404,
          'not_found',
          'Subscription not found',
          'No matching subscription exists.',
        );
      }
      return res.json(subscription);
    } catch (error) {
      return next(error);
    }
  },
);

router.patch(
  '/subscriptions/:subscriptionId',
  requireScope('subscriptions:w'),
  async (req, res, next) => {
    const validationError = validatePatchSubscriptionInput(req.body);
    if (validationError) {
      return problem(
        res,
        400,
        'validation_invalid',
        'Invalid subscription request',
        validationError,
      );
    }
    try {
      const subscription = await updateSubscription(
        { usersDb: getUsersDb(), authDb: getAuthDb() },
        req.userId,
        req.params.subscriptionId,
        req.body,
      );
      if (!subscription) {
        return problem(
          res,
          404,
          'not_found',
          'Subscription not found',
          'No matching subscription exists.',
        );
      }
      await recordAuditEntry(getAuditDb(), {
        userId: req.userId,
        actor: auditActor(req.auth),
        method: req.method,
        path: req.baseUrl + req.path,
        resource: 'subscriptions',
        resourceId: subscription.id,
      });
      return res.json(subscription);
    } catch (error) {
      return next(error);
    }
  },
);

router.delete(
  '/subscriptions/:subscriptionId',
  requireScope('subscriptions:w'),
  async (req, res, next) => {
    const deleteTransactions = req.query.deleteTransactions === 'true';
    try {
      const deleted = await deleteSubscription(
        { usersDb: getUsersDb(), authDb: getAuthDb() },
        req.userId,
        req.params.subscriptionId,
        { deleteTransactions },
      );
      if (!deleted) {
        return problem(
          res,
          404,
          'not_found',
          'Subscription not found',
          'No matching subscription exists.',
        );
      }
      await recordAuditEntry(getAuditDb(), {
        userId: req.userId,
        actor: auditActor(req.auth),
        method: req.method,
        path: req.baseUrl + req.path,
        resource: 'subscriptions',
        resourceId: req.params.subscriptionId,
      });
      return res.json({ id: req.params.subscriptionId });
    } catch (error) {
      return next(error);
    }
  },
);

router.post('/subscriptions/refresh', requireScope('subscriptions:w'), async (req, res, next) => {
  try {
    const result = await refreshSubscriptions(
      { usersDb: getUsersDb(), authDb: getAuthDb() },
      req.userId,
    );
    await recordAuditEntry(getAuditDb(), {
      userId: req.userId,
      actor: auditActor(req.auth),
      method: req.method,
      path: req.baseUrl + req.path,
      resource: 'subscriptions_refresh',
      itemCount: result.transactionsCreated,
    });
    return res.json(result);
  } catch (error) {
    return next(error);
  }
});

router.post('/subscriptions/batch', requireScope('subscriptions:bulk'), async (req, res, next) => {
  const idempotencyKeyError = validateIdempotencyKeyPresence(req);
  if (idempotencyKeyError) {
    return problem(
      res,
      400,
      'validation_invalid',
      'Invalid subscription batch request',
      idempotencyKeyError,
    );
  }
  const validation = validateSubscriptionBatchRequest(req.body);
  if (validation.error) {
    return problem(
      res,
      400,
      'validation_invalid',
      'Invalid subscription batch request',
      validation.error,
    );
  }
  const atomic = Boolean(req.body.atomic);
  return handleIdempotentBulkWrite(req, res, next, {
    resource: 'subscriptions',
    requestBodyForHash: JSON.stringify(req.body),
    itemCount: validation.items.length,
    run: async () => {
      const results = await batchSubscriptions(
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

router.post('/subscriptions/import', requireScope('subscriptions:bulk'), async (req, res, next) => {
  const idempotencyKeyError = validateIdempotencyKeyPresence(req);
  if (idempotencyKeyError) {
    return problem(
      res,
      400,
      'validation_invalid',
      'Invalid subscription import request',
      idempotencyKeyError,
    );
  }
  const validation = parseSubscriptionImportLines(req.body);
  if (validation.error) {
    return problem(
      res,
      400,
      'validation_invalid',
      'Invalid subscription import request',
      validation.error,
    );
  }
  const atomic = req.query.atomic === 'true';
  return handleIdempotentBulkWrite(req, res, next, {
    resource: 'subscriptions',
    requestBodyForHash: req.body,
    itemCount: validation.items.length,
    run: async () => {
      const results = await batchSubscriptions(
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

router.get('/budget', requireScope('budget:r'), async (req, res, next) => {
  try {
    const budget = await listBudget({ usersDb: getUsersDb(), authDb: getAuthDb() }, req.userId, {
      month: req.query.month,
    });
    return res.json({ budget });
  } catch (error) {
    return next(error);
  }
});

router.post('/budget', requireScope('budget:w'), async (req, res, next) => {
  const validationError = validateBudgetInput(req.body);
  if (validationError) {
    return problem(res, 400, 'validation_invalid', 'Invalid budget request', validationError);
  }
  try {
    const row = await upsertBudget(
      { usersDb: getUsersDb(), authDb: getAuthDb() },
      req.userId,
      req.body,
    );
    await recordAuditEntry(getAuditDb(), {
      userId: req.userId,
      actor: auditActor(req.auth),
      method: req.method,
      path: req.baseUrl + req.path,
      resource: 'budget',
      resourceId: row.id,
    });
    return res.status(201).json(row);
  } catch (error) {
    return next(error);
  }
});

router.get('/budget/:budgetId', requireScope('budget:r'), async (req, res, next) => {
  try {
    const row = await getBudgetRow(
      { usersDb: getUsersDb(), authDb: getAuthDb() },
      req.userId,
      req.params.budgetId,
    );
    if (!row) {
      return problem(
        res,
        404,
        'not_found',
        'Budget row not found',
        'No matching budget row exists.',
      );
    }
    return res.json(row);
  } catch (error) {
    return next(error);
  }
});

router.patch('/budget/:budgetId', requireScope('budget:w'), async (req, res, next) => {
  const validationError = validatePatchBudgetInput(req.body);
  if (validationError) {
    return problem(res, 400, 'validation_invalid', 'Invalid budget request', validationError);
  }
  try {
    const row = await updateBudgetRow(
      { usersDb: getUsersDb(), authDb: getAuthDb() },
      req.userId,
      req.params.budgetId,
      req.body,
    );
    if (!row) {
      return problem(
        res,
        404,
        'not_found',
        'Budget row not found',
        'No matching budget row exists.',
      );
    }
    await recordAuditEntry(getAuditDb(), {
      userId: req.userId,
      actor: auditActor(req.auth),
      method: req.method,
      path: req.baseUrl + req.path,
      resource: 'budget',
      resourceId: row.id,
    });
    return res.json(row);
  } catch (error) {
    if (error.code === 'BUDGET_DUPLICATE_MONTH_TAG') {
      return problem(res, 400, 'validation_invalid', 'Invalid budget request', error.message);
    }
    return next(error);
  }
});

router.delete('/budget/:budgetId', requireScope('budget:w'), async (req, res, next) => {
  try {
    const deleted = await deleteBudgetRow(
      { usersDb: getUsersDb(), authDb: getAuthDb() },
      req.userId,
      req.params.budgetId,
    );
    if (!deleted) {
      return problem(
        res,
        404,
        'not_found',
        'Budget row not found',
        'No matching budget row exists.',
      );
    }
    await recordAuditEntry(getAuditDb(), {
      userId: req.userId,
      actor: auditActor(req.auth),
      method: req.method,
      path: req.baseUrl + req.path,
      resource: 'budget',
      resourceId: req.params.budgetId,
    });
    return res.json({ id: req.params.budgetId });
  } catch (error) {
    return next(error);
  }
});

router.post('/budget/fill-forward', requireScope('budget:w'), async (req, res, next) => {
  const validationError = validateFillForwardBudgetInput(req.body);
  if (validationError) {
    return problem(res, 400, 'validation_invalid', 'Invalid budget request', validationError);
  }
  try {
    const result = await fillForwardBudget(
      { usersDb: getUsersDb(), authDb: getAuthDb() },
      req.userId,
      req.body.targetMonth,
    );
    await recordAuditEntry(getAuditDb(), {
      userId: req.userId,
      actor: auditActor(req.auth),
      method: req.method,
      path: req.baseUrl + req.path,
      resource: 'budget',
      itemCount: result.rowsAdded,
    });
    return res.json(result);
  } catch (error) {
    return next(error);
  }
});

router.post('/budget/copy', requireScope('budget:w'), async (req, res, next) => {
  const validationError = validateCopyBudgetInput(req.body);
  if (validationError) {
    return problem(res, 400, 'validation_invalid', 'Invalid budget request', validationError);
  }
  try {
    const result = await copyBudget({ usersDb: getUsersDb(), authDb: getAuthDb() }, req.userId, {
      fromMonth: req.body.fromMonth,
      toMonth: req.body.toMonth,
    });
    await recordAuditEntry(getAuditDb(), {
      userId: req.userId,
      actor: auditActor(req.auth),
      method: req.method,
      path: req.baseUrl + req.path,
      resource: 'budget',
      itemCount: result.rowsCopied,
    });
    return res.json(result);
  } catch (error) {
    return next(error);
  }
});

router.post('/budget/from-subscriptions', requireScope('budget:w'), async (req, res, next) => {
  try {
    const result = await fromSubscriptionsBudget(
      { usersDb: getUsersDb(), authDb: getAuthDb() },
      req.userId,
    );
    await recordAuditEntry(getAuditDb(), {
      userId: req.userId,
      actor: auditActor(req.auth),
      method: req.method,
      path: req.baseUrl + req.path,
      resource: 'budget',
      itemCount: result.rowsWritten,
    });
    return res.json(result);
  } catch (error) {
    return next(error);
  }
});

router.delete('/budget', requireScope('budget:w'), async (req, res, next) => {
  if (!isNonEmptyString(req.query.month) || !BUDGET_MONTH_PATTERN.test(req.query.month)) {
    return problem(
      res,
      400,
      'validation_invalid',
      'Invalid budget request',
      'month must use YYYY-MM format.',
    );
  }
  try {
    const result = await deleteBudgetMonth(
      { usersDb: getUsersDb(), authDb: getAuthDb() },
      req.userId,
      req.query.month,
    );
    await recordAuditEntry(getAuditDb(), {
      userId: req.userId,
      actor: auditActor(req.auth),
      method: req.method,
      path: req.baseUrl + req.path,
      resource: 'budget',
      itemCount: result.deletedCount,
    });
    return res.json(result);
  } catch (error) {
    return next(error);
  }
});

router.get('/settings', requireScope('settings:r'), async (req, res, next) => {
  try {
    const settings = await getSettings({ usersDb: getUsersDb(), authDb: getAuthDb() }, req.userId);
    return res.json(settings);
  } catch (error) {
    return next(error);
  }
});

router.patch('/settings', requireScope('settings:w'), async (req, res, next) => {
  const validationError = validatePatchSettingsInput(req.body);
  if (validationError) {
    return problem(res, 400, 'validation_invalid', 'Invalid settings request', validationError);
  }
  try {
    const settings = await updateSettings(
      { usersDb: getUsersDb(), authDb: getAuthDb() },
      req.userId,
      req.body,
    );
    await recordAuditEntry(getAuditDb(), {
      userId: req.userId,
      actor: auditActor(req.auth),
      method: req.method,
      path: req.baseUrl + req.path,
      resource: 'settings',
    });
    return res.json(settings);
  } catch (error) {
    return next(error);
  }
});

router.get('/encryption-config', requireScope('encryption:r'), async (req, res, next) => {
  try {
    const config = await getPublicEncryptionConfig({ authDb: getAuthDb() }, req.userId);
    return res.json(config);
  } catch (error) {
    return next(error);
  }
});

// requireSession-only, no scope check on top — a security-posture change (which key is active,
// whether encryption is on) is treated the same as PAT-management (`/auth/tokens*`): human-only,
// regardless of what scopes a token holds, since a session already carries full access anyway.
router.put('/encryption-config', requireSession, async (req, res, next) => {
  const validationError = validatePutEncryptionConfigInput(req.body);
  if (validationError) {
    return problem(
      res,
      400,
      'validation_invalid',
      'Invalid encryption config request',
      validationError,
    );
  }
  try {
    const input = req.body.key === undefined ? req.body : { ...req.body, key: req.body.key.trim() };
    const config = await updatePublicEncryptionConfig({ authDb: getAuthDb() }, req.userId, input);
    await recordAuditEntry(getAuditDb(), {
      userId: req.userId,
      actor: auditActor(req.auth),
      method: req.method,
      path: req.baseUrl + req.path,
      resource: 'encryption_config',
    });
    return res.json(config);
  } catch (error) {
    if (error.code === 'ENCRYPTION_KEY_ROTATION_REQUIRES_CLI') {
      return problem(
        res,
        400,
        'validation_invalid',
        'Invalid encryption config request',
        error.message,
      );
    }
    return next(error);
  }
});

// `data:bulk` — a full-account dump is exactly the kind of blast-radius
// read that scope is meant to gate, even though it's a GET. Always
// decrypts (unlike the legacy `GET /api/data/document`, which returns
// ciphertext as-stored) and never includes the encryption key/config
// (which lives only on the separate authDb document anyway). Audited like
// `GET /subscriptions/export` despite being a read.
router.get('/data/export', requireScope('data:bulk'), async (req, res, next) => {
  try {
    const result = await exportUserData({ usersDb: getUsersDb(), authDb: getAuthDb() }, req.userId);
    await recordAuditEntry(getAuditDb(), {
      userId: req.userId,
      actor: auditActor(req.auth),
      method: req.method,
      path: req.baseUrl + req.path,
      resource: 'data',
    });
    return res.json(result);
  } catch (error) {
    return next(error);
  }
});

// `data:bulk`, requires `{confirm: true}` — this replaces the entire
// account. Backs up the pre-import document to disk (mirroring `mm-admin
// migrate`'s own pattern) before overwriting, so a bad import is manually
// recoverable by an operator with server access. Idempotency-Key required
// like every other bulk write; importing the identical payload twice is
// naturally idempotent (same final state), but a replay still short-
// circuits to the first run's result rather than re-running the write.
router.post('/data/import', requireScope('data:bulk'), async (req, res, next) => {
  return handleIdempotentBulkWrite(req, res, next, {
    resource: 'data',
    requestBodyForHash: JSON.stringify(req.body || {}),
    run: async () =>
      importUserData({ usersDb: getUsersDb(), authDb: getAuthDb() }, req.userId, req.body),
    onError: (error) => {
      if (!(error instanceof ImportError)) return undefined;
      return problem(res, 400, 'validation_invalid', 'Invalid import request', error.message);
    },
  });
});

// `data:bulk` (not a scope any `rw` grant satisfies, per docs/adr/0006) —
// this forces a recalculation of every derived aggregate (accounting
// totals, Mojo, Smile/Fire fund buckets), the same server-side logic every
// transaction write already runs, useful after a direct data edit (e.g.
// `POST /data/import`, or manual CouchDB surgery) that could have left
// those aggregates stale. Idempotency-Key required like every other bulk
// write (docs/MASTER_PROMPT.md §4.2) even though recalculating twice is
// naturally idempotent in effect — replaying the same key still short-
// circuits to the first run's result rather than doing the work twice.
router.post('/data/recalculate', requireScope('data:bulk'), async (req, res, next) => {
  return handleIdempotentBulkWrite(req, res, next, {
    resource: 'data',
    requestBodyForHash: JSON.stringify(req.body || {}),
    run: async () =>
      recalculateUserData({ usersDb: getUsersDb(), authDb: getAuthDb() }, req.userId),
    onError: (error) => {
      if (error.code !== 'RECALCULATE_WOULD_DROP_TRANSACTIONS') return undefined;
      return problem(res, 400, 'validation_invalid', 'Cannot recalculate', error.message);
    },
  });
});

// `account:r` — reading the current email isn't identity-sensitive the way
// changing/deleting it is, so this alone stays PAT-readable (decision 3,
// Slice 6 plan), unlike every other route on this resource below.
router.get('/account', requireScope('account:r'), async (req, res, next) => {
  try {
    const account = await getAccount({ authDb: getAuthDb() }, req.userId);
    return res.json(account);
  } catch (error) {
    if (error instanceof AccountError && error.code === 'ACCOUNT_NOT_FOUND') {
      return problem(res, 404, 'not_found', 'Account not found', error.message);
    }
    return next(error);
  }
});

function validatePatchAccountInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return 'A request body object is required.';
  }
  const unknownField = Object.keys(input).find((key) => key !== 'email');
  if (unknownField) return `${unknownField} is not an editable field.`;
  if (!isNonEmptyString(input.email)) return 'email must be a non-empty string.';
  return null;
}

// requireSession-only, no scope check on top — the same restriction already
// applied to `/auth/tokens*` and `PUT /encryption-config`: a leaked PAT with
// `account:w` scope must never be able to change the account's email.
router.patch('/account', requireSession, async (req, res, next) => {
  const validationError = validatePatchAccountInput(req.body);
  if (validationError) {
    return problem(res, 400, 'validation_invalid', 'Invalid account request', validationError);
  }
  try {
    const result = await updateAccountEmail(
      { usersDb: getUsersDb(), authDb: getAuthDb() },
      req.userId,
      req.body.email,
    );
    // Reissue the session cookie with the new email, the same way the
    // legacy PUT /auth/update-email does — using ACCESS_TOKEN_MAX_AGE_MS
    // (24h), not that route's own now-fixed 15-minute bug.
    const accessToken = jwt.sign(
      { userId: req.userId, email: result.email },
      process.env.JWT_SECRET,
      { expiresIn: ACCESS_TOKEN_EXPIRES_IN },
    );
    res.cookie('access_token', accessToken, {
      ...COOKIE_OPTIONS,
      maxAge: ACCESS_TOKEN_MAX_AGE_MS,
    });
    await recordAuditEntry(getAuditDb(), {
      userId: req.userId,
      actor: auditActor(req.auth),
      method: req.method,
      path: req.baseUrl + req.path,
      resource: 'account',
    });
    return res.json(result);
  } catch (error) {
    if (error instanceof AccountError) {
      const isConflict = error.code === 'ACCOUNT_EMAIL_TAKEN';
      return problem(
        res,
        isConflict ? 409 : 400,
        isConflict ? 'conflict_email_taken' : 'validation_invalid',
        'Invalid account request',
        error.message,
      );
    }
    return next(error);
  }
});

// requireSession-only — verifying the account password gates other
// sensitive UI actions; a PAT (even with account:w) must never be able to
// do this on the user's behalf.
router.post('/account/verify-password', requireSession, async (req, res, next) => {
  if (!isNonEmptyString(req.body?.password)) {
    return problem(
      res,
      400,
      'validation_invalid',
      'Invalid verify-password request',
      'password must be a non-empty string.',
    );
  }
  try {
    const valid = await verifyAccountPassword(
      { authDb: getAuthDb() },
      req.userId,
      req.body.password,
    );
    if (!valid) {
      return problem(
        res,
        401,
        'auth_invalid',
        'Invalid password',
        'The provided password is incorrect.',
      );
    }
    return res.json({ valid: true });
  } catch (error) {
    return next(error);
  }
});

// requireSession-only, requires {confirm: true} — this permanently deletes
// the account. Extends the legacy DELETE /auth/delete-account cascade
// (which destroys only the usersDb/authDb documents) to also delete every
// PAT belonging to the user — left in place, a PAT would otherwise keep
// authenticating after the account it belongs to no longer exists — and to
// explicitly revoke the current refresh token, rather than relying solely
// on the deleted authDb document to (eventually, on next use) invalidate it.
router.delete('/account', requireSession, async (req, res, next) => {
  if (req.body?.confirm !== true) {
    return problem(
      res,
      400,
      'validation_invalid',
      'Invalid delete-account request',
      'confirm must be true to delete the account.',
    );
  }
  try {
    const result = await deleteAccount({ usersDb: getUsersDb(), authDb: getAuthDb() }, req.userId);
    const refreshToken = req.cookies?.refresh_token;
    if (refreshToken) {
      try {
        const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);
        await revokeRefreshToken(decoded.jti);
      } catch {
        // Already invalid/expired/malformed — nothing left to revoke.
      }
    }
    await recordAuditEntry(getAuditDb(), {
      userId: req.userId,
      actor: auditActor(req.auth),
      method: req.method,
      path: req.baseUrl + req.path,
      resource: 'account',
      itemCount: result.deletedTokenCount,
    });
    clearAuthCookies(res);
    return res.json({ deletedTokenCount: result.deletedTokenCount });
  } catch (error) {
    if (error instanceof AccountError) {
      return problem(res, 400, 'validation_invalid', 'Cannot delete account', error.message);
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
module.exports.parseSubscriptionImportLines = parseSubscriptionImportLines;
