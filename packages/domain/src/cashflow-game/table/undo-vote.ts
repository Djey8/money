import { TableCommandError, type Table, type TableEventType } from './types';

/**
 * Undoing the last turn is the table's decision (JFK, 2026-10-16): anyone who plays may ask for it, and it happens when **more
 * than half of the people at the table** say yes. Bots do not vote, and neither do players who left or are away. A host can switch
 * the whole thing off when the game is set up (`settings.allowRewind`). The vote only decides - going back to the start of the
 * previous turn is `rewindTable` (rewind.ts), run by the server when the vote is approved, because only the server holds the
 * snapshots. A vote lives for the turn it was asked in: when the turn changes it is dropped.
 */

type Emit = (
  type: TableEventType,
  playerId: string | null,
  data?: Record<string, unknown>,
) => unknown;

/** Who has a say: people who are still in the game and here. */
export function undoVoters(table: Table): string[] {
  return table.players.filter((p) => !p.bot && p.status === 'active' && !p.away).map((p) => p.id);
}

function check(table: Table, playerId: string): void {
  if (table.phase !== 'playing') {
    throw new TableCommandError('WRONG_PHASE', 'The game is not being played now.');
  }
  if (!table.settings.allowRewind) {
    throw new TableCommandError('ILLEGAL_MOVE', 'This table does not allow undoing a turn.');
  }
  if (!undoVoters(table).includes(playerId)) {
    throw new TableCommandError('ILLEGAL_MOVE', 'Only players who are here can vote on an undo.');
  }
}

export interface VoteOutcome {
  table: Table;
  /** More than half said yes: the server now goes back one turn. */
  approved: boolean;
}

/** Tallies the open vote: approved on a majority of yes, dropped when yes can no longer get one. */
function tally(table: Table, emit: Emit): VoteOutcome {
  const vote = table.undoVote;
  if (!vote) return { table, approved: false };
  const voters = undoVoters(table);
  const yes = vote.yes.filter((id) => voters.includes(id)).length;
  const no = vote.no.filter((id) => voters.includes(id)).length;
  if (yes * 2 > voters.length) {
    emit('undo_approved', null, { yes, voters: voters.length });
    return { table: { ...table, undoVote: null }, approved: true };
  }
  if (no * 2 >= voters.length) {
    emit('undo_rejected', null, { no, voters: voters.length });
    return { table: { ...table, undoVote: null }, approved: false };
  }
  return { table, approved: false };
}

/** Asks the table to go back one turn. The asker votes yes; with one person at the table that is a majority at once. */
export function proposeUndo(
  table: Table,
  playerId: string,
  version: number,
  emit: Emit,
): VoteOutcome {
  check(table, playerId);
  if (table.undoVote) {
    throw new TableCommandError('ILLEGAL_MOVE', 'An undo is already being voted on.');
  }
  emit('undo_proposed', playerId);
  return tally(
    { ...table, version, undoVote: { proposerId: playerId, yes: [playerId], no: [] } },
    emit,
  );
}

/** One vote on the open undo. */
export function voteUndo(
  table: Table,
  playerId: string,
  yes: boolean,
  version: number,
  emit: Emit,
): VoteOutcome {
  check(table, playerId);
  const vote = table.undoVote;
  if (!vote) throw new TableCommandError('ILLEGAL_MOVE', 'No undo is being voted on.');
  if (vote.yes.includes(playerId) || vote.no.includes(playerId)) {
    throw new TableCommandError('ILLEGAL_MOVE', 'You have already voted.');
  }
  emit('undo_voted', playerId, { yes });
  return tally(
    {
      ...table,
      version,
      undoVote: {
        ...vote,
        yes: yes ? [...vote.yes, playerId] : vote.yes,
        no: yes ? vote.no : [...vote.no, playerId],
      },
    },
    emit,
  );
}
