import { toMinorUnits } from '../../money/minor-units';
import type { BookGrowProject, GameBooks } from '../books';
import type { CashAllocation } from '../cash';
import type { GameSnapshot } from '../history';
import type { CashflowGameSet } from '../types';

/**
 * A game as the app keeps it (a snapshot: decimal amounts, the entity lists of the Angular state) read as the minor-unit
 * books the rules take (todo/cashflow-game-analysis.md, E4). Undo steps, saved games and the live history all hold
 * snapshots, so this is how a real game's every position becomes something the simulator can continue from.
 */

type Loose = Record<string, unknown>;

const num = (value: unknown): number => Number(value) || 0;
const minor = (value: unknown): number => toMinorUnits(num(value));
const str = (value: unknown): string => (value == null ? '' : String(value));
const list = (value: unknown): Loose[] => (Array.isArray(value) ? (value as Loose[]) : []);

function growProject(raw: Loose): BookGrowProject {
  const share = raw['share'] as Loose | null | undefined;
  const investment = raw['investment'] as Loose | null | undefined;
  const loan = raw['liabilitie'] as Loose | null | undefined;
  return {
    title: str(raw['title']),
    sub: str(raw['sub']),
    phase: str(raw['phase']),
    status: str(raw['status']),
    description: str(raw['description']),
    strategy: str(raw['strategy']),
    notes: list(raw['notes']).map((note) => ({
      text: str(note['text']),
      createdAt: str(note['createdAt']),
    })),
    cashflowMinor: minor(raw['cashflow']),
    amountMinor: minor(raw['amount']),
    isAsset: raw['isAsset'] === true || raw['isAsset'] === 'true',
    share: share?.['tag']
      ? {
          tag: str(share['tag']),
          quantity: num(share['quantity']),
          priceMinor: minor(share['price']),
        }
      : null,
    investment: investment?.['tag']
      ? {
          tag: str(investment['tag']),
          depositMinor: minor(investment['deposit']),
          amountMinor: minor(investment['amount']),
        }
      : null,
    loan: loan?.['tag']
      ? {
          tag: str(loan['tag']),
          amountMinor: minor(loan['amount']),
          creditMinor: minor(loan['credit']),
          investment: loan['investment'] === true || loan['investment'] === 'true',
        }
      : null,
    updatedAt: str(raw['updatedAt']),
  };
}

export function booksFromSnapshot(
  snapshot: Omit<GameSnapshot, 'step'>,
  context: { gameSet: CashflowGameSet | undefined; allocation?: CashAllocation },
): GameBooks {
  return {
    state: snapshot.cashflowGame,
    allocation: context.allocation ?? { daily: 60, splurge: 10, smile: 10, fire: 20 },
    gameSet: context.gameSet,
    subscriptions: list(snapshot.allSubscriptions).map((sub) => ({
      title: str(sub['title']),
      account: str(sub['account']),
      amountMinor: minor(sub['amount']),
      startDate: str(sub['startDate']),
      endDate: str(sub['endDate']),
      category: str(sub['category']),
      comment: str(sub['comment']),
      frequency: (str(sub['frequency']) ||
        'monthly') as GameBooks['subscriptions'][number]['frequency'],
    })),
    transactions: list(snapshot.allTransactions).map((transaction) => ({
      account: str(transaction['account']),
      amountMinor: minor(transaction['amount']),
      date: str(transaction['date']),
      time: str(transaction['time']),
      category: str(transaction['category']),
      comment: str(transaction['comment']),
    })),
    liabilities: list(snapshot.liabilities).map((liability) => ({
      tag: str(liability['tag']),
      amountMinor: minor(liability['amount']),
      investment: liability['investment'] === true || liability['investment'] === 'true',
    })),
    shares: list(snapshot.allShares).map((share) => ({
      tag: str(share['tag']),
      quantity: num(share['quantity']),
      priceMinor: minor(share['price']),
    })),
    investments: list(snapshot.allInvestments).map((investment) => ({
      tag: str(investment['tag']),
      depositMinor: minor(investment['deposit']),
      amountMinor: minor(investment['amount']),
    })),
    assets: list(snapshot.allAssets).map((asset) => ({
      tag: str(asset['tag']),
      amountMinor: minor(asset['amount']),
    })),
    growProjects: list(snapshot.allGrowProjects).map(growProject),
  };
}
