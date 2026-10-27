import type { TableView } from '@money/domain';
import type { DreamPlayerData } from '@money/domain/dist/cashflow-game/dreamfund/player';
import type { DreamPending, DreamTableView } from './dream-session.service';

/** A Dreamfund table seen as the table screens read a table: its seats carry the life's books, and the life itself beside them. */
export interface DreamShownTable extends TableView {
  kind: 'dreamfund';
}

/** The life of a seat as the table keeps it (the books and what the solo game keeps in the app), when the seat has one. */
export function lifeOf(view: TableView, seat: number): DreamPlayerData | null {
  const player = view.players[seat] as unknown as
    { dreamLife?: DreamPlayerData | null } | undefined;
  return player?.dreamLife ?? null;
}

const NO_DECK = { left: 0, discard: [] as string[] };

/**
 * The Dreamfund table in the shape of the classic one (todo/dreamfund-tables-solo-ui.md, R3): the room page, the table mode, the
 * layer with the players' queue and the presenter all read this, so a Dreamfund table is opened, watched and looked through the same
 * way. What the classic table has and the Dreamfund has not (the draw piles, the undo vote, the turn hold) is empty.
 */
export function dreamViewAsTable(view: DreamTableView): TableView {
  const settings = view.settings as Record<string, unknown>;
  const ranking = view.result?.ranking ?? [];
  const shown = {
    kind: 'dreamfund' as const,
    id: view.id,
    version: view.version,
    phase: view.phase === 'abandoned' ? 'closed' : view.phase,
    settings: {
      ...view.settings,
      // the game set the characters come from, and the classic table's own switches that a Dreamfund table does not have
      gameSetId: 'jfk-stories',
      rulesBase: view.settings.mode,
      rules: { sellOfferRolls: 0 },
      turnGate: settings['turnGate'] === true,
      showProgress: settings['showProgress'] !== false,
      allowRewind: false,
      repayOffTurn: false,
      leaveFreeRounds: 0,
      awayAfterTimeouts: 2,
    },
    hostSeat: view.hostSeat,
    youSeat: view.you,
    players: view.players.map((player) => {
      const life = (player as unknown as { life?: DreamPlayerData | null }).life ?? null;
      return {
        seat: player.seat,
        name: player.name,
        color: player.color,
        ...(player.initials ? { initials: player.initials } : {}),
        ready: player.ready,
        status: player.status,
        away: player.away,
        hasPicked: player.pick !== null,
        bot: player.bot,
        pick: player.pick,
        professionId: player.professionId,
        books: life ? life.books : null,
        // the Dreamfund's extras, for the bridge to the app
        dreamLife: life,
        dreamPending: (player as unknown as { pending?: unknown }).pending ?? null,
      };
    }),
    order: view.order,
    activeSeat: view.activeSeat,
    tableRound: view.tableRound,
    turnRolled: view.turnRolled,
    clock: {
      deadlineAt: view.clock.deadlineAt,
      pausedAt: view.clock.pausedAt,
      banksMs: [],
      timeouts: [],
    },
    trade: null,
    holdSeats: [],
    undo: null,
    result: view.result
      ? {
          reason: view.result.reason,
          winnerSeat: view.result.winnerSeat,
          ranking: ranking.map((entry) => ({
            seat: entry.seat,
            rank: entry.rank,
            outcome: entry.outcome === 'won' ? 'escaped' : entry.outcome,
            passiveIncomeMinor: 0,
            monthlyCashflowMinor: 0,
          })),
        }
      : null,
    standings: ranking.map((entry) => ({
      seat: entry.seat,
      rank: entry.rank,
      outcome: entry.outcome === 'won' ? 'escaped' : entry.outcome,
    })),
    fastForward: false,
    decks: { dealSmall: NO_DECK, dealBig: NO_DECK, market: NO_DECK, doodad: NO_DECK },
    createdAt: '',
  };
  return shown as unknown as TableView;
}

/** What the seat has to decide at a Dreamfund table, as the table sent it (the viewer's own in full). */
export function pendingOf(view: TableView, seat: number): DreamPending | { kind: string } | null {
  const player = view.players[seat] as unknown as
    { dreamPending?: DreamPending | { kind: string } | null } | undefined;
  return player?.dreamPending ?? null;
}
