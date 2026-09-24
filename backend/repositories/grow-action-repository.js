'use strict';

/**
 * The six typed actions for Grow (PLAN.md D-16):
 * `POST /grow/{id}/{buy,sell,dividend,payback,cashflow,deposit}`. Split out
 * of `grow-repository.js` (CRUD) purely for file size — this module reuses
 * that one's encrypt/decrypt helpers.
 *
 * Each action loads the Grow project's fixed *kind* (`isAsset`/`share`/
 * `investment`, mutually exclusive, set at creation and never changed by
 * PATCH), the matching standalone Asset/Share/Investment entity, and any
 * attached Liability — all from the ONE document read `withGrowActionWrite`
 * already did — calls the matching pure calculator in
 * `packages/domain/src/grow/actions.ts`, and folds the resulting
 * Transaction + Grow patch + linked-entity patch(es) into a single atomic
 * CouchDB write. Every write also runs `applyDerivedState` (the same
 * recompute every other transaction write goes through), so these
 * transactions correctly feed Smile/Fire fund state and the Income
 * accounting rebuild exactly like a hand-entered one would.
 *
 * `payback` is available whenever a Grow project has an attached
 * `.liabilitie` (regardless of kind) — confirmed by reading
 * `grow.component.ts`'s `paybackProject()`, which matches a liability by
 * `tag === grow.title` with no kind check at all. The *financing* liability
 * a `buy` action can optionally attach uses the same tag (the Grow
 * project's own title) but is a logically distinct concept from an
 * Investment's companion `M-<title>` mortgage liability, which every
 * Investment buy/sell always creates/updates unconditionally.
 */

const crypto = require('crypto');
const {
  transactionFromApi,
  calculateBuyAsset,
  calculateBuyShare,
  calculateBuyInvestment,
  calculateSellAsset,
  calculateSellShare,
  calculateSellInvestment,
  calculateDividend,
  calculatePayback,
  calculateCashflow,
  calculateDeposit,
  multiplyQuantityPrice,
  normalizeQuantity,
} = require('@money/domain');
const { getEncryptionSession } = require('../services/encryption-session');
const { decryptValue, toApiTransactions, encryptTransaction } = require('./transaction-repository');
const {
  writeValue,
  toStoredMoney,
  applyDerivedState,
} = require('../services/transaction-derived-state');
const {
  decryptMoney,
  decryptAllGrow,
  encryptGrow,
  MAX_WRITE_RETRIES,
} = require('./grow-repository');

function findIndexByTag(rawEntries, tag, session) {
  return rawEntries.findIndex((raw) => decryptValue(raw.tag, session) === tag);
}

function upsertRawEntry(rawEntries, tag, session, idPrefix, patchFields) {
  const index = findIndexByTag(rawEntries, tag, session);
  if (index === -1) {
    return [
      ...rawEntries,
      { id: `${idPrefix}_${crypto.randomUUID()}`, tag: writeValue(tag, session), ...patchFields },
    ];
  }
  return rawEntries.map((raw, i) => (i === index ? { ...raw, ...patchFields } : raw));
}

function removeRawEntryByTag(rawEntries, tag, session) {
  const index = findIndexByTag(rawEntries, tag, session);
  return index === -1 ? rawEntries : rawEntries.filter((_, i) => i !== index);
}

function moneyPatch(schemaVersion, session, fields) {
  const patch = {};
  for (const [key, amountMinor] of Object.entries(fields)) {
    patch[key] = writeValue(toStoredMoney(amountMinor, schemaVersion), session);
  }
  return patch;
}

/**
 * A financed buy's resulting debt is reflected onto the Grow project's own
 * embedded `.liabilitie` copy too (not just the standalone Liability
 * entity) — otherwise a later `payback` or `sell`-with-payback would have
 * nothing to act on, since both require `current.liabilitie` to be set.
 */
function growLiabilitiePatchFrom(liabilityPatch) {
  if (!liabilityPatch) return undefined;
  return {
    tag: liabilityPatch.tag,
    amountMinor: liabilityPatch.amountMinor,
    investment: true,
    creditMinor: liabilityPatch.creditMinor,
  };
}

/** The optional financing liability a `buy` can attach, tagged with the Grow project's own title — distinct from an Investment's `M-<title>` mortgage. */
function loadLiabilitieAttachment(input, rawLiabilities, session, schemaVersion, title) {
  if (!input) return undefined;
  const index = findIndexByTag(rawLiabilities, title, session);
  return {
    existingAmountMinor:
      index === -1 ? null : decryptMoney(rawLiabilities[index].amount, session, schemaVersion),
    existingCreditMinor:
      index === -1 ? null : decryptMoney(rawLiabilities[index].credit, session, schemaVersion),
    loanMinor: input.loanMinor,
    creditMinor: input.creditMinor,
  };
}

/**
 * Always returns a real array (never `undefined`) — `rawLiabilities`
 * unchanged when there's no attachment, so a caller that already applied
 * an unconditional mortgage patch (Investment buy/sell) doesn't lose it by
 * passing the result through here.
 */
function applyLiabilityPatch(rawLiabilities, liabilityPatch, session, schemaVersion) {
  if (!liabilityPatch) return rawLiabilities;
  return upsertRawEntry(rawLiabilities, liabilityPatch.tag, session, 'liabilities', {
    ...moneyPatch(schemaVersion, session, {
      amount: liabilityPatch.amountMinor,
      credit: liabilityPatch.creditMinor,
    }),
    investment: writeValue(true, session),
  });
}

function applyMortgagePatch(rawLiabilities, mortgagePatch, session, schemaVersion) {
  const index = findIndexByTag(rawLiabilities, mortgagePatch.tag, session);
  if (index === -1) {
    // A cash-only investment (mortgage 0) has no mortgage to track — don't create an empty `M-<title>` liability.
    if (mortgagePatch.amountMinor === 0) return rawLiabilities;
    return [
      ...rawLiabilities,
      {
        id: `liabilities_${crypto.randomUUID()}`,
        tag: writeValue(mortgagePatch.tag, session),
        ...moneyPatch(schemaVersion, session, { amount: mortgagePatch.amountMinor, credit: 0 }),
        investment: writeValue(true, session),
      },
    ];
  }
  if (mortgagePatch.amountMinor === 0) return rawLiabilities.filter((_, i) => i !== index);
  return rawLiabilities.map((raw, i) =>
    i === index
      ? { ...raw, ...moneyPatch(schemaVersion, session, { amount: mortgagePatch.amountMinor }) }
      : raw,
  );
}

function resolveDateTime(input) {
  if (input.date && input.time) return { date: input.date, time: input.time };
  const now = new Date();
  const pad = (value) => String(value).padStart(2, '0');
  return {
    date: input.date || `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
    time: input.time || `${pad(now.getHours())}:${pad(now.getMinutes())}`,
  };
}

function growNotFoundError() {
  const error = new Error('No matching grow project exists.');
  error.code = 'GROW_NOT_FOUND';
  return error;
}

function growError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

/**
 * Kind (isAsset/share/investment) is fixed by the Grow project, not chosen
 * per call, so a request body shaped for the wrong kind (e.g. share fields
 * sent to an asset-kind project) must be rejected here explicitly —
 * otherwise the missing fields would silently become `NaN` deep inside the
 * pure calculators instead of a clear 400.
 */
function assertInteger(value, fieldName) {
  if (!Number.isInteger(value)) {
    throw growError('GROW_INVALID_INPUT', `${fieldName} must be an integer.`);
  }
}

function assertFiniteNumber(value, fieldName) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw growError('GROW_INVALID_INPUT', `${fieldName} must be a number.`);
  }
}

function assertPositiveInteger(value, fieldName) {
  assertInteger(value, fieldName);
  if (value <= 0) throw growError('GROW_INVALID_INPUT', `${fieldName} must be a positive integer.`);
}

function assertNonNegativeInteger(value, fieldName) {
  assertInteger(value, fieldName);
  if (value < 0) {
    throw growError('GROW_INVALID_INPUT', `${fieldName} must be a non-negative integer.`);
  }
}

function assertPositiveNumber(value, fieldName) {
  assertFiniteNumber(value, fieldName);
  if (value <= 0) throw growError('GROW_INVALID_INPUT', `${fieldName} must be a positive number.`);
}

/** A sell/payback amount must not exceed the position/liability it's drawn down against — otherwise it silently persists a negative balance instead of a clear 400. */
function assertDoesNotExceed(value, limit, fieldName) {
  if (value > limit) {
    throw growError(
      'GROW_INVALID_INPUT',
      `${fieldName} (${value}) exceeds the current position (${limit}).`,
    );
  }
}

function assertLiabilitieAttachmentShape(liabilitie) {
  if (liabilitie === undefined) return;
  if (!liabilitie || typeof liabilitie !== 'object') {
    throw growError('GROW_INVALID_INPUT', 'liabilitie must be an object.');
  }
  assertPositiveInteger(liabilitie.loanMinor, 'liabilitie.loanMinor');
  assertNonNegativeInteger(liabilitie.creditMinor, 'liabilitie.creditMinor');
}

/**
 * An asset trade is either one lump sum (`totalAmountMinor`) or units x unit
 * price (`quantity` + `priceMinor`, e.g. selling part of a holding) — the
 * DSL's `Buy/Sell Asset <title> <qty> x <price>` form. The balance-sheet
 * Asset itself only stores an amount, so both resolve to a total.
 */
function resolveAssetTrade(input) {
  const hasUnits = input.quantity !== undefined || input.priceMinor !== undefined;
  if (input.totalAmountMinor !== undefined && hasUnits) {
    throw growError(
      'GROW_INVALID_INPUT',
      'Send either totalAmountMinor or quantity + priceMinor for an asset, not both.',
    );
  }
  if (!hasUnits) {
    assertPositiveInteger(input.totalAmountMinor, 'totalAmountMinor');
    return { totalAmountMinor: input.totalAmountMinor, units: undefined };
  }
  assertPositiveNumber(input.quantity, 'quantity');
  assertPositiveInteger(input.priceMinor, 'priceMinor');
  const units = { quantity: normalizeQuantity(input.quantity), priceMinor: input.priceMinor };
  return {
    totalAmountMinor: multiplyQuantityPrice(units.quantity, units.priceMinor),
    units,
  };
}

function assertBuyInputMatchesKind(current, input) {
  if (current.isAsset) {
    resolveAssetTrade(input);
  } else if (current.share) {
    assertPositiveNumber(input.quantity, 'quantity');
    assertPositiveInteger(input.priceMinor, 'priceMinor');
  } else if (current.investment) {
    assertPositiveInteger(input.depositMinor, 'depositMinor');
    // Optional: a cash-only purchase has no mortgage.
    assertNonNegativeInteger(input.mortgageMinor ?? 0, 'mortgageMinor');
  } else {
    throw growError('GROW_NO_KIND', 'This grow project has no asset/share/investment kind to buy.');
  }
  assertLiabilitieAttachmentShape(input.liabilitie);
}

function assertSellInputMatchesKind(current, input) {
  if (current.isAsset) {
    resolveAssetTrade(input);
    return;
  }
  if (current.share) {
    assertPositiveNumber(input.quantity, 'quantity');
    assertPositiveInteger(input.priceMinor, 'priceMinor');
    return;
  }
  if (current.investment) {
    // Either side may be 0 (a cash-only investment, or a mortgage already paid off), but not both.
    const depositMinor = input.depositMinor ?? 0;
    const mortgageMinor = input.mortgageMinor ?? 0;
    assertNonNegativeInteger(depositMinor, 'depositMinor');
    assertNonNegativeInteger(mortgageMinor, 'mortgageMinor');
    if (depositMinor === 0 && mortgageMinor === 0) {
      throw growError('GROW_INVALID_INPUT', 'depositMinor and mortgageMinor must not both be 0.');
    }
    if (input.payback !== undefined) {
      if (!input.payback || typeof input.payback !== 'object') {
        throw growError('GROW_INVALID_INPUT', 'payback must be an object.');
      }
      assertNonNegativeInteger(input.payback.amountMinor, 'payback.amountMinor');
      assertNonNegativeInteger(input.payback.creditMinor, 'payback.creditMinor');
      if (input.payback.amountMinor === 0 && input.payback.creditMinor === 0) {
        throw growError(
          'GROW_INVALID_INPUT',
          'payback.amountMinor and payback.creditMinor must not both be 0.',
        );
      }
    }
    return;
  }
  throw growError('GROW_NO_KIND', 'This grow project has no asset/share/investment kind to sell.');
}

/**
 * Shared read → mutate → write-with-retry-on-409 loop for every typed
 * action. `mutate({current, data, session, schemaVersion, currency})` must
 * return `{transactionFields, growPatch, updatedRawAssets?, updatedRawShares?,
 * updatedRawInvestments?, updatedRawLiabilities?}` or throw a `.code`-tagged
 * error for the route layer to map to a Problem Details response.
 */
async function withGrowActionWrite({ usersDb, authDb }, userId, growId, mutate) {
  let attempt = 0;
  while (attempt < MAX_WRITE_RETRIES) {
    let userDoc;
    try {
      userDoc = await usersDb.get(userId);
    } catch (error) {
      if (error.statusCode !== 404) throw error;
      throw growNotFoundError();
    }
    const data = userDoc.data || {};
    const session = await getEncryptionSession(authDb, userId);
    const schemaVersion = data.meta?.schemaVersion || 1;
    const currency = data.meta?.currency || 'EUR';
    const rawGrow = data.grow || [];
    if (!Array.isArray(rawGrow)) throw new Error('Stored grow projects must be an array');
    const allGrow = decryptAllGrow(rawGrow, session, schemaVersion);
    const index = allGrow.findIndex((project) => project.id === growId);
    if (index === -1) throw growNotFoundError();
    const current = allGrow[index];

    const mutation = mutate({ current, data, session, schemaVersion, currency });
    const {
      transactionFields,
      growPatch,
      updatedRawAssets,
      updatedRawShares,
      updatedRawInvestments,
      updatedRawLiabilities,
    } = mutation;

    const updatedGrow = { ...current, ...growPatch, updatedAt: new Date().toISOString() };
    const updatedRawGrow = rawGrow.map((raw, i) =>
      i === index ? encryptGrow(updatedGrow, session, schemaVersion) : raw,
    );

    const existingRawTransactions = data.transactions || [];
    const existingTransactions = toApiTransactions(
      existingRawTransactions,
      session,
      schemaVersion,
      currency,
    );
    const newTransaction = { ...transactionFields, id: `tx_${crypto.randomUUID()}`, currency };
    const allTransactions = [...existingTransactions, newTransaction];
    const derived = applyDerivedState(data, allTransactions, session, schemaVersion);

    const updatedData = derived.data;
    updatedData.transactions = derived.transactions.map((effective) =>
      encryptTransaction(transactionFromApi(effective, schemaVersion), session),
    );
    updatedData.grow = updatedRawGrow;
    if (updatedRawAssets !== undefined) {
      updatedData.balance = {
        ...updatedData.balance,
        asset: { ...updatedData.balance?.asset, assets: updatedRawAssets },
      };
    }
    if (updatedRawShares !== undefined) {
      updatedData.balance = {
        ...updatedData.balance,
        asset: { ...updatedData.balance?.asset, shares: updatedRawShares },
      };
    }
    if (updatedRawInvestments !== undefined) {
      updatedData.balance = {
        ...updatedData.balance,
        asset: { ...updatedData.balance?.asset, investments: updatedRawInvestments },
      };
    }
    if (updatedRawLiabilities !== undefined) {
      updatedData.balance = { ...updatedData.balance, liabilities: updatedRawLiabilities };
    }

    try {
      await usersDb.insert({ ...userDoc, data: updatedData, updatedAt: new Date().toISOString() });
      return {
        grow: updatedGrow,
        transaction: derived.transactions.find((t) => t.id === newTransaction.id),
      };
    } catch (error) {
      if (error.statusCode !== 409) throw error;
      attempt += 1;
    }
  }
  throw new Error('Failed to write grow action after maximum retries due to write conflicts');
}

function buyMutation(input) {
  return ({ current, data, session, schemaVersion }) => {
    assertBuyInputMatchesKind(current, input);
    const { date, time } = resolveDateTime(input);
    const rawLiabilities = data.balance?.liabilities || [];
    const liabilitie = loadLiabilitieAttachment(
      input.liabilitie,
      rawLiabilities,
      session,
      schemaVersion,
      current.title,
    );

    if (current.isAsset) {
      const rawAssets = data.balance?.asset?.assets || [];
      const assetIndex = findIndexByTag(rawAssets, current.title, session);
      const trade = resolveAssetTrade(input);
      const calc = calculateBuyAsset({
        title: current.title,
        totalAmountMinor: trade.totalAmountMinor,
        units: trade.units,
        existingAssetAmountMinor:
          assetIndex === -1
            ? null
            : decryptMoney(rawAssets[assetIndex].amount, session, schemaVersion),
        existingGrowAmountMinor: current.amountMinor,
        liabilitie,
      });
      return {
        transactionFields: {
          account: 'Fire',
          category: `@${current.title}`,
          amountMinor: calc.transactionAmountMinor,
          comment: calc.comment,
          date,
          time,
        },
        growPatch: {
          amountMinor: calc.newGrowAmountMinor,
          status: calc.growStatus,
          ...(calc.liabilityPatch
            ? { liabilitie: growLiabilitiePatchFrom(calc.liabilityPatch) }
            : {}),
        },
        updatedRawAssets: upsertRawEntry(
          rawAssets,
          current.title,
          session,
          'assets',
          moneyPatch(schemaVersion, session, { amount: calc.newAssetAmountMinor }),
        ),
        updatedRawLiabilities: applyLiabilityPatch(
          rawLiabilities,
          calc.liabilityPatch,
          session,
          schemaVersion,
        ),
      };
    }

    if (current.share) {
      const rawShares = data.balance?.asset?.shares || [];
      const shareIndex = findIndexByTag(rawShares, current.title, session);
      const calc = calculateBuyShare({
        title: current.title,
        quantity: input.quantity,
        priceMinor: input.priceMinor,
        existingShareQuantity:
          shareIndex === -1 ? null : Number(decryptValue(rawShares[shareIndex].quantity, session)),
        existingGrowAmountMinor: current.amountMinor,
        liabilitie,
      });
      return {
        transactionFields: {
          account: 'Fire',
          category: `@${current.title}`,
          amountMinor: calc.transactionAmountMinor,
          comment: calc.comment,
          date,
          time,
        },
        growPatch: {
          amountMinor: calc.newGrowAmountMinor,
          status: calc.growStatus,
          share: {
            ...current.share,
            quantity: calc.newShareQuantity,
            priceMinor: calc.newSharePriceMinor,
          },
          ...(calc.liabilityPatch
            ? { liabilitie: growLiabilitiePatchFrom(calc.liabilityPatch) }
            : {}),
        },
        updatedRawShares: upsertRawEntry(rawShares, current.title, session, 'shares', {
          quantity: writeValue(calc.newShareQuantity, session),
          ...moneyPatch(schemaVersion, session, { price: calc.newSharePriceMinor }),
        }),
        updatedRawLiabilities: applyLiabilityPatch(
          rawLiabilities,
          calc.liabilityPatch,
          session,
          schemaVersion,
        ),
      };
    }

    if (current.investment) {
      const rawInvestments = data.balance?.asset?.investments || [];
      const investmentIndex = findIndexByTag(rawInvestments, current.title, session);
      const mortgageTag = `M-${current.title}`;
      const mortgageIndex = findIndexByTag(rawLiabilities, mortgageTag, session);
      const calc = calculateBuyInvestment({
        title: current.title,
        depositMinor: input.depositMinor ?? 0,
        mortgageMinor: input.mortgageMinor ?? 0,
        existingInvestmentDepositMinor:
          investmentIndex === -1
            ? null
            : decryptMoney(rawInvestments[investmentIndex].deposit, session, schemaVersion),
        existingInvestmentAmountMinor:
          investmentIndex === -1
            ? null
            : decryptMoney(rawInvestments[investmentIndex].amount, session, schemaVersion),
        existingMortgageLiabilityAmountMinor:
          mortgageIndex === -1
            ? null
            : decryptMoney(rawLiabilities[mortgageIndex].amount, session, schemaVersion),
        existingGrowAmountMinor: current.amountMinor,
        liabilitie,
      });
      const withMortgage = applyMortgagePatch(
        rawLiabilities,
        calc.mortgageLiabilityPatch,
        session,
        schemaVersion,
      );
      return {
        transactionFields: {
          account: 'Fire',
          category: `@${current.title}`,
          amountMinor: calc.transactionAmountMinor,
          comment: calc.comment,
          date,
          time,
        },
        growPatch: {
          amountMinor: calc.newGrowAmountMinor,
          status: calc.growStatus,
          investment: {
            ...current.investment,
            depositMinor: calc.newInvestmentDepositMinor,
            amountMinor: calc.newInvestmentAmountMinor,
          },
          ...(calc.liabilityPatch
            ? { liabilitie: growLiabilitiePatchFrom(calc.liabilityPatch) }
            : {}),
        },
        updatedRawInvestments: upsertRawEntry(
          rawInvestments,
          current.title,
          session,
          'investments',
          moneyPatch(schemaVersion, session, {
            deposit: calc.newInvestmentDepositMinor,
            amount: calc.newInvestmentAmountMinor,
          }),
        ),
        updatedRawLiabilities: applyLiabilityPatch(
          withMortgage,
          calc.liabilityPatch,
          session,
          schemaVersion,
        ),
      };
    }

    throw growError('GROW_NO_KIND', 'This grow project has no asset/share/investment kind to buy.');
  };
}

async function buyGrow(deps, userId, growId, input) {
  return withGrowActionWrite(deps, userId, growId, buyMutation(input));
}

function sellMutation(input) {
  return ({ current, data, session, schemaVersion }) => {
    assertSellInputMatchesKind(current, input);
    const { date, time } = resolveDateTime(input);

    if (current.isAsset) {
      const rawAssets = data.balance?.asset?.assets || [];
      const assetIndex = findIndexByTag(rawAssets, current.title, session);
      if (assetIndex === -1) throw growError('GROW_NO_POSITION', 'No matching asset to sell.');
      const existingAssetAmountMinor = decryptMoney(
        rawAssets[assetIndex].amount,
        session,
        schemaVersion,
      );
      const trade = resolveAssetTrade(input);
      assertDoesNotExceed(trade.totalAmountMinor, existingAssetAmountMinor, 'totalAmountMinor');
      const calc = calculateSellAsset(
        current.title,
        trade.totalAmountMinor,
        existingAssetAmountMinor,
        trade.units,
      );
      const updatedRawAssets =
        calc.newAssetAmountMinor === 0
          ? rawAssets.filter((_, i) => i !== assetIndex)
          : rawAssets.map((raw, i) =>
              i === assetIndex
                ? {
                    ...raw,
                    ...moneyPatch(schemaVersion, session, { amount: calc.newAssetAmountMinor }),
                  }
                : raw,
            );
      return {
        transactionFields: {
          account: 'Income',
          category: `@${current.title}`,
          amountMinor: calc.transactionAmountMinor,
          comment: calc.comment,
          date,
          time,
        },
        growPatch: { status: calc.growStatus },
        updatedRawAssets,
      };
    }

    if (current.share) {
      const rawShares = data.balance?.asset?.shares || [];
      const shareIndex = findIndexByTag(rawShares, current.title, session);
      if (shareIndex === -1)
        throw growError('GROW_NO_POSITION', 'No matching share position to sell.');
      const existingShareQuantity = Number(decryptValue(rawShares[shareIndex].quantity, session));
      assertDoesNotExceed(input.quantity, existingShareQuantity, 'quantity');
      const calc = calculateSellShare(
        current.title,
        input.quantity,
        input.priceMinor,
        existingShareQuantity,
      );
      const updatedRawShares =
        calc.newShareQuantity === 0
          ? rawShares.filter((_, i) => i !== shareIndex)
          : rawShares.map((raw, i) =>
              i === shareIndex
                ? {
                    ...raw,
                    quantity: writeValue(calc.newShareQuantity, session),
                    ...moneyPatch(schemaVersion, session, { price: calc.newSharePriceMinor }),
                  }
                : raw,
            );
      return {
        transactionFields: {
          account: 'Income',
          category: `@${current.title}`,
          amountMinor: calc.transactionAmountMinor,
          comment: calc.comment,
          date,
          time,
        },
        growPatch: {
          status: calc.growStatus,
          share: {
            ...current.share,
            quantity: calc.newShareQuantity,
            priceMinor: calc.newSharePriceMinor,
          },
        },
        updatedRawShares,
      };
    }

    if (current.investment) {
      const rawInvestments = data.balance?.asset?.investments || [];
      const investmentIndex = findIndexByTag(rawInvestments, current.title, session);
      if (investmentIndex === -1) {
        throw growError('GROW_NO_POSITION', 'No matching investment position to sell.');
      }
      const rawLiabilities = data.balance?.liabilities || [];
      const mortgageTag = `M-${current.title}`;
      const mortgageIndex = findIndexByTag(rawLiabilities, mortgageTag, session);
      const existingInvestmentDepositMinor = decryptMoney(
        rawInvestments[investmentIndex].deposit,
        session,
        schemaVersion,
      );
      const existingInvestmentAmountMinor = decryptMoney(
        rawInvestments[investmentIndex].amount,
        session,
        schemaVersion,
      );
      assertDoesNotExceed(input.depositMinor ?? 0, existingInvestmentDepositMinor, 'depositMinor');
      assertDoesNotExceed(input.mortgageMinor ?? 0, existingInvestmentAmountMinor, 'mortgageMinor');
      const payback = input.payback
        ? {
            amountMinor: input.payback.amountMinor,
            creditMinor: input.payback.creditMinor,
          }
        : undefined;
      if (payback) {
        if (!current.liabilitie) {
          throw growError(
            'GROW_NO_LIABILITY',
            'This grow project has no attached liability to pay back.',
          );
        }
        assertDoesNotExceed(
          payback.amountMinor,
          current.liabilitie.amountMinor,
          'payback.amountMinor',
        );
        assertDoesNotExceed(
          payback.creditMinor,
          current.liabilitie.creditMinor,
          'payback.creditMinor',
        );
      }
      const calc = calculateSellInvestment({
        title: current.title,
        depositMinor: input.depositMinor ?? 0,
        mortgageMinor: input.mortgageMinor ?? 0,
        existingInvestmentDepositMinor,
        existingInvestmentAmountMinor,
        existingMortgageLiabilityAmountMinor:
          mortgageIndex === -1
            ? 0
            : decryptMoney(rawLiabilities[mortgageIndex].amount, session, schemaVersion),
        existingGrowAmountMinor: current.amountMinor,
        payback,
      });
      const updatedRawInvestments =
        calc.newInvestmentDepositMinor === 0 && calc.newInvestmentAmountMinor === 0
          ? rawInvestments.filter((_, i) => i !== investmentIndex)
          : rawInvestments.map((raw, i) =>
              i === investmentIndex
                ? {
                    ...raw,
                    ...moneyPatch(schemaVersion, session, {
                      deposit: calc.newInvestmentDepositMinor,
                      amount: calc.newInvestmentAmountMinor,
                    }),
                  }
                : raw,
            );
      let updatedRawLiabilities = applyMortgagePatch(
        rawLiabilities,
        { tag: mortgageTag, amountMinor: calc.newMortgageLiabilityAmountMinor },
        session,
        schemaVersion,
      );
      let growPatch = {
        status: calc.growStatus,
        amountMinor: calc.newGrowAmountMinor,
        investment: {
          ...current.investment,
          depositMinor: calc.newInvestmentDepositMinor,
          amountMinor: calc.newInvestmentAmountMinor,
        },
      };
      if (payback) {
        const newLiabilityAmountMinor = current.liabilitie.amountMinor - payback.amountMinor;
        const newLiabilityCreditMinor = current.liabilitie.creditMinor - payback.creditMinor;
        updatedRawLiabilities =
          newLiabilityAmountMinor === 0 && newLiabilityCreditMinor === 0
            ? removeRawEntryByTag(updatedRawLiabilities, current.title, session)
            : upsertRawEntry(
                updatedRawLiabilities,
                current.title,
                session,
                'liabilities',
                moneyPatch(schemaVersion, session, {
                  amount: newLiabilityAmountMinor,
                  credit: newLiabilityCreditMinor,
                }),
              );
        growPatch.liabilitie =
          newLiabilityAmountMinor === 0 && newLiabilityCreditMinor === 0
            ? null
            : {
                ...current.liabilitie,
                amountMinor: newLiabilityAmountMinor,
                creditMinor: newLiabilityCreditMinor,
              };
      }
      return {
        transactionFields: {
          account: 'Income',
          category: `@${current.title}`,
          amountMinor: calc.transactionAmountMinor,
          comment: calc.comment,
          date,
          time,
        },
        growPatch,
        updatedRawInvestments,
        updatedRawLiabilities,
      };
    }

    throw growError(
      'GROW_NO_KIND',
      'This grow project has no asset/share/investment kind to sell.',
    );
  };
}

async function sellGrow(deps, userId, growId, input) {
  return withGrowActionWrite(deps, userId, growId, sellMutation(input));
}

function dividendMutation(input) {
  return ({ current }) => {
    if (!current.share) {
      throw growError(
        'GROW_NOT_SHARE_KIND',
        'Only a share-kind grow project can record a dividend.',
      );
    }
    assertPositiveNumber(input.quantity, 'quantity');
    assertPositiveInteger(input.priceMinor, 'priceMinor');
    const { date, time } = resolveDateTime(input);
    const calc = calculateDividend(current.title, input.quantity, input.priceMinor);
    return {
      transactionFields: {
        account: 'Income',
        category: `@${current.title}`,
        amountMinor: calc.transactionAmountMinor,
        comment: calc.comment,
        date,
        time,
      },
      growPatch: {},
    };
  };
}

async function dividendGrow(deps, userId, growId, input) {
  return withGrowActionWrite(deps, userId, growId, dividendMutation(input));
}

function paybackMutation(input) {
  return ({ current, data, session, schemaVersion }) => {
    if (!current.liabilitie) {
      throw growError(
        'GROW_NO_LIABILITY',
        'This grow project has no attached liability to pay back.',
      );
    }
    const rawLiabilities = data.balance?.liabilities || [];
    const liabilityIndex = findIndexByTag(rawLiabilities, current.title, session);
    if (liabilityIndex === -1) {
      throw growError(
        'GROW_NO_LIABILITY',
        'No matching liability record exists for this grow project.',
      );
    }
    assertNonNegativeInteger(input.amountMinor, 'amountMinor');
    assertNonNegativeInteger(input.creditMinor, 'creditMinor');
    if (input.amountMinor === 0 && input.creditMinor === 0) {
      throw growError('GROW_INVALID_INPUT', 'amountMinor and creditMinor must not both be 0.');
    }
    const existingLiabilityAmountMinor = decryptMoney(
      rawLiabilities[liabilityIndex].amount,
      session,
      schemaVersion,
    );
    const existingLiabilityCreditMinor = decryptMoney(
      rawLiabilities[liabilityIndex].credit,
      session,
      schemaVersion,
    );
    assertDoesNotExceed(input.amountMinor, existingLiabilityAmountMinor, 'amountMinor');
    assertDoesNotExceed(input.creditMinor, existingLiabilityCreditMinor, 'creditMinor');
    const { date, time } = resolveDateTime(input);
    const calc = calculatePayback(
      input.amountMinor,
      input.creditMinor,
      existingLiabilityAmountMinor,
      existingLiabilityCreditMinor,
      current.amountMinor,
    );
    const paidOff = calc.newLiabilityAmountMinor === 0 && calc.newLiabilityCreditMinor === 0;
    return {
      transactionFields: {
        account: 'Fire',
        category: `@${current.title}`,
        amountMinor: calc.transactionAmountMinor,
        comment: calc.comment,
        date,
        time,
      },
      growPatch: {
        amountMinor: calc.newGrowAmountMinor,
        status: calc.growStatus,
        liabilitie: paidOff
          ? null
          : {
              ...current.liabilitie,
              amountMinor: calc.newLiabilityAmountMinor,
              creditMinor: calc.newLiabilityCreditMinor,
            },
      },
      updatedRawLiabilities: paidOff
        ? removeRawEntryByTag(rawLiabilities, current.title, session)
        : rawLiabilities.map((raw, i) =>
            i === liabilityIndex
              ? {
                  ...raw,
                  ...moneyPatch(schemaVersion, session, {
                    amount: calc.newLiabilityAmountMinor,
                    credit: calc.newLiabilityCreditMinor,
                  }),
                }
              : raw,
          ),
    };
  };
}

async function paybackGrow(deps, userId, growId, input) {
  return withGrowActionWrite(deps, userId, growId, paybackMutation(input));
}

function cashflowMutation(input) {
  return ({ current }) => {
    assertInteger(input.cashflowMinor, 'cashflowMinor');
    if (input.creditMinor !== undefined) {
      assertNonNegativeInteger(input.creditMinor, 'creditMinor');
    }
    const { date, time } = resolveDateTime(input);
    const calc = calculateCashflow(input.cashflowMinor, input.creditMinor);
    return {
      transactionFields: {
        account: 'Income',
        category: `@${current.title}`,
        amountMinor: calc.transactionAmountMinor,
        comment: calc.comment,
        date,
        time,
      },
      growPatch: {},
    };
  };
}

async function cashflowGrow(deps, userId, growId, input) {
  return withGrowActionWrite(deps, userId, growId, cashflowMutation(input));
}

function depositMutation(input) {
  return ({ current }) => {
    assertPositiveInteger(input.amountMinor, 'amountMinor');
    const { date, time } = resolveDateTime(input);
    const calc = calculateDeposit(input.amountMinor);
    return {
      transactionFields: {
        account: 'Fire',
        category: `@${current.title}`,
        amountMinor: calc.transactionAmountMinor,
        comment: calc.comment,
        date,
        time,
      },
      growPatch: {},
    };
  };
}

async function depositGrow(deps, userId, growId, input) {
  return withGrowActionWrite(deps, userId, growId, depositMutation(input));
}

module.exports = {
  buyGrow,
  sellGrow,
  dividendGrow,
  paybackGrow,
  cashflowGrow,
  depositGrow,
};
