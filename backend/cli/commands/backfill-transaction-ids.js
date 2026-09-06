'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { getEncryptionSession } = require('../../services/encryption-session');

const DEFAULT_BACKUP_DIR = path.join(__dirname, '..', '..', 'migration-backups');
const MAX_WRITE_RETRIES = 10;

function writeBackup(backupDir, userId, userDoc) {
  fs.mkdirSync(backupDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFile = path.join(backupDir, `${userId}-transaction-ids-${timestamp}.json`);
  fs.writeFileSync(backupFile, JSON.stringify(userDoc, null, 2), 'utf8');
  return backupFile;
}

function addMissingIds(transactions, session) {
  let count = 0;
  const updated = transactions.map((transaction) => {
    if (transaction.id !== undefined) return transaction;
    count += 1;
    const id = `tx_${crypto.randomUUID()}`;
    return { ...transaction, id: session ? session.encrypt(id) : id };
  });
  return { transactions: updated, count };
}

async function backfillTransactionIds(
  { usersDb, authDb },
  { userId, dryRun = false, backupDir = DEFAULT_BACKUP_DIR },
) {
  if (!userId) throw new Error('--user <id> is required');
  let attempts = 0;
  while (attempts < MAX_WRITE_RETRIES) {
    const userDoc = await usersDb.get(userId);
    const transactions = userDoc.data?.transactions;
    if (!Array.isArray(transactions)) return { status: 'no-transactions', userId, idsAdded: 0 };
    const session = await getEncryptionSession(authDb, userId);
    const { transactions: updatedTransactions, count } = addMissingIds(transactions, session);
    if (count === 0) return { status: 'already-backfilled', userId, idsAdded: 0 };
    if (dryRun) return { status: 'dry-run', userId, idsAdded: count };

    const backupFile = writeBackup(backupDir, userId, userDoc);
    try {
      await usersDb.insert({
        ...userDoc,
        data: { ...userDoc.data, transactions: updatedTransactions },
        updatedAt: new Date().toISOString(),
      });
      return { status: 'backfilled', userId, idsAdded: count, backupFile };
    } catch (error) {
      if (error.statusCode !== 409) throw error;
      attempts += 1;
    }
  }
  throw new Error(`Could not backfill transaction IDs for ${userId}: CouchDB conflict`);
}

module.exports = { backfillTransactionIds, addMissingIds };
