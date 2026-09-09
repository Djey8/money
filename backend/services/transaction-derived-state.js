'use strict';

const {
  fromMinorUnits,
  recalculateTransactionDerivedState,
  toMinorUnits,
} = require('@money/domain');

function readValue(value, session) {
  return session && typeof value === 'string' ? session.decrypt(value) : value;
}

function readNumber(value, session) {
  const number = Number(readValue(value, session));
  if (!Number.isFinite(number)) throw new Error('Stored financial value is invalid');
  return number;
}

function writeValue(value, session) {
  return session ? session.encrypt(String(value)) : value;
}

function toStoredMoney(amountMinor, schemaVersion) {
  return schemaVersion >= 2 ? amountMinor : fromMinorUnits(amountMinor);
}

function fromStoredMoney(value, session, schemaVersion) {
  const amount = readNumber(value, session);
  return schemaVersion >= 2 ? amount : toMinorUnits(amount);
}

function toFundProjects(projects, session, schemaVersion) {
  return (projects || []).map((project) => ({
    title: readValue(project.title, session),
    phase: readValue(project.phase, session),
    completionDate: readValue(project.completionDate, session),
    buckets: (project.buckets || []).map((bucket) => ({
      id: readValue(bucket.id, session),
      title: readValue(bucket.title, session),
      targetMinor: fromStoredMoney(bucket.target, session, schemaVersion),
      amountMinor: fromStoredMoney(bucket.amount, session, schemaVersion),
    })),
  }));
}

function buildDerivedStateContext(data, session, schemaVersion) {
  const shares = data.balance?.asset?.shares || [];
  const investments = data.balance?.asset?.investments || [];
  return {
    shareTags: shares.map((share) => readValue(share.tag, session)),
    investmentTags: investments.map((investment) => readValue(investment.tag, session)),
    funds: {
      mojo: {
        amountMinor: fromStoredMoney(data.mojo?.amount || 0, session, schemaVersion),
        targetMinor: fromStoredMoney(data.mojo?.target || 0, session, schemaVersion),
      },
      smile: toFundProjects(data.smile, session, schemaVersion),
      fire: toFundProjects(data.fire, session, schemaVersion),
    },
  };
}

function writeTaggedAmounts(entries, session, schemaVersion) {
  return entries.map((entry) => ({
    tag: writeValue(entry.tag, session),
    amount: writeValue(toStoredMoney(entry.amountMinor, schemaVersion), session),
  }));
}

function applyFundProjects(storedProjects, projects, session, schemaVersion) {
  return (storedProjects || []).map((storedProject) => {
    const title = readValue(storedProject.title, session);
    const project = projects.find((candidate) => candidate.title === title);
    if (!project) return storedProject;
    return {
      ...storedProject,
      phase: project.phase === undefined ? storedProject.phase : writeValue(project.phase, session),
      completionDate:
        project.completionDate === undefined
          ? storedProject.completionDate
          : writeValue(project.completionDate, session),
      buckets: (storedProject.buckets || []).map((storedBucket) => {
        const bucketId = readValue(storedBucket.id, session);
        const bucket = project.buckets.find((candidate) => candidate.id === bucketId);
        return bucket
          ? {
              ...storedBucket,
              amount: writeValue(toStoredMoney(bucket.amountMinor, schemaVersion), session),
            }
          : storedBucket;
      }),
    };
  });
}

function applyDerivedState(data, transactions, session, schemaVersion) {
  const derived = recalculateTransactionDerivedState(
    transactions,
    buildDerivedStateContext(data, session, schemaVersion),
  );
  const income = data.income || {};
  const expenses = income.expenses || {};
  return {
    transactions: derived.transactions,
    data: {
      ...data,
      income: {
        ...income,
        revenue: {
          ...(income.revenue || {}),
          revenues: writeTaggedAmounts(derived.accounting.revenues, session, schemaVersion),
          interests: writeTaggedAmounts(derived.accounting.interests, session, schemaVersion),
          properties: writeTaggedAmounts(derived.accounting.properties, session, schemaVersion),
        },
        expenses: {
          ...expenses,
          daily: writeTaggedAmounts(derived.accounting.expenses.Daily, session, schemaVersion),
          splurge: writeTaggedAmounts(derived.accounting.expenses.Splurge, session, schemaVersion),
          smile: writeTaggedAmounts(derived.accounting.expenses.Smile, session, schemaVersion),
          fire: writeTaggedAmounts(derived.accounting.expenses.Fire, session, schemaVersion),
          mojo: writeTaggedAmounts(derived.accounting.expenses.Mojo, session, schemaVersion),
        },
      },
      mojo: {
        ...(data.mojo || {}),
        amount: writeValue(toStoredMoney(derived.funds.mojo.amountMinor, schemaVersion), session),
      },
      smile: applyFundProjects(data.smile, derived.funds.smile, session, schemaVersion),
      fire: applyFundProjects(data.fire, derived.funds.fire, session, schemaVersion),
    },
  };
}

module.exports = { applyDerivedState, buildDerivedStateContext, writeValue, toStoredMoney };
