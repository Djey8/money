import { summarizeGameFinances } from '../saved-games';
import type { RivalView, TableAwareness } from '../simulation/policy';
import type { Table } from './types';

/** Passive income as a share of expenses: 1 or more is out of the rat race. */
function coverageOf(table: Table, playerId: string): { view: RivalView; ok: boolean } {
  const player = table.players.find((p) => p.id === playerId);
  const books = player?.books;
  if (!player || !books || player.status !== 'active' || !books.state.professionId) {
    return { view: { coverage: 0, escaped: false, bankrupt: false }, ok: false };
  }
  const finances = summarizeGameFinances(books.state, books.subscriptions);
  return {
    view: {
      coverage:
        finances.expensesMinor > 0 ? finances.passiveIncomeMinor / finances.expensesMinor : 0,
      escaped: finances.escapedRatRace,
      bankrupt: finances.bankrupt,
    },
    ok: true,
  };
}

/**
 * The race as one player may see it (todo/cashflow-tournament-and-bots.md A4): how far each rival is from escaping, from their
 * public books. Everything here is open at a table, so a strategy - a bot, or an agent's helper - may use it freely; it carries no
 * dice, no pile order and no account.
 */
export function tableAwareness(table: Table, playerId: string): TableAwareness {
  const mine = coverageOf(table, playerId);
  const rivals: RivalView[] = [];
  for (const player of table.players) {
    if (player.id === playerId) continue;
    const rival = coverageOf(table, player.id);
    if (rival.ok) rivals.push(rival.view);
  }
  const alive = rivals.filter((r) => !r.bankrupt);
  return {
    rivals,
    leaderCoverage: alive.reduce((best, r) => Math.max(best, r.coverage), 0),
    myCoverage: mine.view.coverage,
    seats: table.players.length,
  };
}
