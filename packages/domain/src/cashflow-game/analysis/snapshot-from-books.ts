import { fromMinorUnits } from '../../money/minor-units';
import type { GameBooks } from '../books';
import type { GameSnapshot } from '../history';

/**
 * The reverse of `booksFromSnapshot`: minor-unit books as the app would keep them in memory (decimal amounts, the entity
 * lists of the Angular state). Lets a simulated game be written out as the history of a real one - for tests, and for
 * replaying a lab game in the analyst.
 */
export function snapshotFromBooks(books: GameBooks): GameSnapshot {
  return {
    allTransactions: books.transactions.map((transaction) => ({
      account: transaction.account,
      amount: fromMinorUnits(transaction.amountMinor),
      date: transaction.date,
      time: transaction.time,
      category: transaction.category,
      comment: transaction.comment,
    })),
    allSubscriptions: books.subscriptions.map((sub) => ({
      title: sub.title,
      account: sub.account,
      amount: fromMinorUnits(sub.amountMinor),
      startDate: sub.startDate,
      endDate: sub.endDate,
      category: sub.category,
      comment: sub.comment,
      frequency: sub.frequency,
    })),
    allGrowProjects: books.growProjects.map((project) => ({
      title: project.title,
      sub: project.sub,
      phase: project.phase,
      status: project.status,
      description: project.description,
      strategy: project.strategy,
      riskScore: 0,
      risks: '',
      links: [],
      actionItems: [],
      notes: project.notes,
      cashflow: fromMinorUnits(project.cashflowMinor),
      amount: fromMinorUnits(project.amountMinor),
      isAsset: project.isAsset,
      share: project.share
        ? {
            tag: project.share.tag,
            quantity: project.share.quantity,
            price: fromMinorUnits(project.share.priceMinor),
          }
        : null,
      investment: project.investment
        ? {
            tag: project.investment.tag,
            deposit: fromMinorUnits(project.investment.depositMinor),
            amount: fromMinorUnits(project.investment.amountMinor),
          }
        : null,
      liabilitie: project.loan
        ? {
            tag: project.loan.tag,
            amount: fromMinorUnits(project.loan.amountMinor),
            credit: fromMinorUnits(project.loan.creditMinor),
            investment: project.loan.investment,
          }
        : null,
      createdAt: project.updatedAt,
      updatedAt: project.updatedAt,
    })),
    allShares: books.shares.map((share) => ({
      tag: share.tag,
      quantity: share.quantity,
      price: fromMinorUnits(share.priceMinor),
    })),
    allInvestments: books.investments.map((investment) => ({
      tag: investment.tag,
      deposit: fromMinorUnits(investment.depositMinor),
      amount: fromMinorUnits(investment.amountMinor),
    })),
    allAssets: books.assets.map((asset) => ({
      tag: asset.tag,
      amount: fromMinorUnits(asset.amountMinor),
    })),
    liabilities: books.liabilities.map((liability) => ({
      tag: liability.tag,
      amount: fromMinorUnits(liability.amountMinor),
      investment: liability.investment,
      credit: 0,
    })),
    allSmileProjects: [],
    allFireEmergencies: [],
    mojo: { amount: 0, target: 0 },
    cashflowGame: books.state,
  };
}
