import { ApiTransaction } from '../transactions/transaction';
import { PeriodRange } from './period-range';
import { StatementRow, makeRow, EXPENSE_ACCOUNTS, cleanCategory, isTransfer, inRange } from './statement-shared';

/**
 * Ports `computeCashflow`/`computeCashflowOne` from
 * `src/app/stats/statement/statement-calculations.ts` (canonical per
 * PLAN.md D-22, same source as income-statement.ts). Unlike the income
 * statement, this classifies every transaction regardless of account —
 * `operating` only picks up ordinary Income/expense-account activity,
 * everything else falls into one of the other three buckets or is dropped
 * as a pure inter-account transfer.
 */

export interface CashflowStatement {
  operating: StatementRow;
  /** Transfers into the Smile/Fire savings buckets from Income. */
  investing: StatementRow;
  /** Liability paybacks — detected by a `payback liabilitie` substring in `comment`, case-insensitively, regardless of account. */
  financing: StatementRow;
  /** Contributions to Mojo (transfers from Income, or direct inflows on the Mojo account). */
  mojo: StatementRow;
  netCashflow: StatementRow;
}

function computeCashflowOne(
  transactions: ApiTransaction[],
  range: PeriodRange,
): { operating: number; investing: number; financing: number; mojo: number } {
  let operating = 0;
  let investing = 0;
  let financing = 0;
  let mojo = 0;
  for (const transaction of transactions) {
    if (!inRange(transaction, range)) continue;
    if (transaction.amountMinor === 0) continue;
    const amount = transaction.amountMinor;
    const category = cleanCategory(transaction.category);
    const comment = (transaction.comment || '').toLowerCase();

    if (comment.includes('payback liabilitie')) {
      financing += Math.abs(amount);
      continue;
    }
    if (transaction.account === 'Income' && amount < 0 && (category === 'Smile' || category === 'Fire')) {
      investing += Math.abs(amount);
      continue;
    }
    if (transaction.account === 'Mojo' && amount > 0) {
      mojo += amount;
      continue;
    }
    if (transaction.account === 'Income' && amount < 0 && category === 'Mojo') {
      mojo += Math.abs(amount);
      continue;
    }
    if (isTransfer(transaction.category)) continue;
    if (transaction.account === 'Income' && amount > 0) operating += amount;
    else if ((EXPENSE_ACCOUNTS as readonly string[]).includes(transaction.account) && amount < 0) {
      operating -= Math.abs(amount);
    }
  }
  return { operating, investing, financing, mojo };
}

export function computeCashflow(
  transactions: ApiTransaction[],
  currentRange: PeriodRange,
  previousRange: PeriodRange,
): CashflowStatement {
  const current = computeCashflowOne(transactions, currentRange);
  const previous = computeCashflowOne(transactions, previousRange);
  return {
    operating: makeRow(current.operating, previous.operating),
    investing: makeRow(current.investing, previous.investing),
    financing: makeRow(current.financing, previous.financing),
    mojo: makeRow(current.mojo, previous.mojo),
    netCashflow: makeRow(
      current.operating - current.investing - current.financing - current.mojo,
      previous.operating - previous.investing - previous.financing - previous.mojo,
    ),
  };
}
