import { ApiTransaction } from './transaction';

export interface TaggedAmount {
  tag: string;
  amountMinor: number;
}

export interface TransactionAccountingSummary {
  revenues: TaggedAmount[];
  interests: TaggedAmount[];
  properties: TaggedAmount[];
  expenses: Record<'Daily' | 'Splurge' | 'Smile' | 'Fire' | 'Mojo', TaggedAmount[]>;
}

export interface TransactionAccountingContext {
  shareTags?: string[];
  investmentTags?: string[];
}

const EXPENSE_ACCOUNTS = ['Daily', 'Splurge', 'Smile', 'Fire', 'Mojo'] as const;

function addAmount(entries: TaggedAmount[], tag: string, amountMinor: number): void {
  const existing = entries.find(
    (entry) => entry.tag.toLocaleLowerCase() === tag.toLocaleLowerCase(),
  );
  if (existing) existing.amountMinor += amountMinor;
  else entries.push({ tag, amountMinor });
}

/**
 * Rebuilds the non-project portion of the income statement from API-form
 * transactions. Values stay as integer minor units; callers can persist or
 * display them through their own schema-version boundary.
 */
export function summarizeTransactionAccounting(
  transactions: ApiTransaction[],
  { shareTags = [], investmentTags = [] }: TransactionAccountingContext = {},
): TransactionAccountingSummary {
  const expenses = { Daily: [], Splurge: [], Smile: [], Fire: [], Mojo: [] } as Record<
    (typeof EXPENSE_ACCOUNTS)[number],
    TaggedAmount[]
  >;
  const summary: TransactionAccountingSummary = {
    revenues: [],
    interests: [],
    properties: [],
    expenses,
  };

  for (const transaction of transactions) {
    if (transaction.amountMinor === 0) continue;
    const tag = transaction.category.replace('@', '');
    if (transaction.account === 'Income') {
      if (shareTags.some((shareTag) => shareTag.toLocaleLowerCase() === tag.toLocaleLowerCase())) {
        addAmount(summary.interests, tag, transaction.amountMinor);
      } else if (
        investmentTags.some(
          (investmentTag) => investmentTag.toLocaleLowerCase() === tag.toLocaleLowerCase(),
        )
      ) {
        addAmount(summary.properties, tag, transaction.amountMinor);
      } else {
        addAmount(summary.revenues, tag, transaction.amountMinor);
      }
    } else if (
      EXPENSE_ACCOUNTS.includes(transaction.account as (typeof EXPENSE_ACCOUNTS)[number])
    ) {
      addAmount(
        expenses[transaction.account as (typeof EXPENSE_ACCOUNTS)[number]],
        tag,
        transaction.amountMinor,
      );
    }
  }
  return summary;
}
