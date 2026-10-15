'use strict';

const { projectFor } = require('@money/domain');

/**
 * What a viewer of a table is sent over the live channel (todo/cashflow-multiplayer.md slice S2). Pure: the same functions
 * build a message for a connection that is open and for the log a reconnecting one replays.
 *
 * A change reaches a viewer as one `update`: the events it produced, by seat, and the table as that viewer may see it - but
 * the books of a player are included only when that player's books changed (a move changes one player's books, a Market card
 * several, a lobby change none), because the books are the bulk of a table. A player entry **without** `books` keeps the books
 * the client already has; `booksChanged` names the seats that do carry them.
 */

/** The seat an event is about: where the player sat when it happened (a player who left no longer has one now). */
function eventSeat(previous, table, event) {
  if (event.playerId === null || event.playerId === undefined) return null;
  const before = previous ? previous.players.findIndex((p) => p.id === event.playerId) : -1;
  if (before >= 0) return before;
  const after = table.players.findIndex((p) => p.id === event.playerId);
  return after >= 0 ? after : null;
}

/** An event as every viewer sees it: a seat instead of an account, and its place in the log. */
function publicEvent(seq, seat, event) {
  return {
    seq,
    version: event.version,
    at: event.at,
    type: event.type,
    seat,
    ...(event.data ? { data: event.data } : {}),
  };
}

/** Whether two players' books differ. Unchanged players keep the same object through a command, so that is checked first. */
function sameBooks(a, b) {
  if (a === b) return true;
  if (!a || !b) return false;
  return JSON.stringify(a) === JSON.stringify(b);
}

/** The seats whose books differ between two versions of a table (all of them when there is no earlier one). */
function changedSeats(previous, table) {
  return table.players
    .map((player, seat) => {
      const before = previous && previous.players.find((p) => p.id === player.id);
      return before && sameBooks(before.books, player.books) ? -1 : seat;
    })
    .filter((seat) => seat >= 0);
}

/**
 * The `update` a viewer is sent for one change: `previous` is the table before it (null for the first), `events` the domain
 * events with their sequence numbers (`{ seq, event }`).
 */
function projectUpdate(previous, table, events, userId) {
  const changed = new Set(changedSeats(previous, table));
  const view = projectFor(table, userId);
  const players = view.players.map((player) => {
    if (changed.has(player.seat) || player.books === null) return player;
    const { books: _unchanged, ...rest } = player;
    return rest;
  });
  return {
    version: table.version,
    events: events.map(({ seq, event }) =>
      publicEvent(seq, eventSeat(previous, table, event), event),
    ),
    booksChanged: [...changed].filter(
      (seat) => view.players[seat] && view.players[seat].books !== null,
    ),
    view: { ...view, players },
  };
}

/** The log lines a reconnecting viewer missed, from the stored event documents (which carry their seat). */
function projectLog(docs) {
  return docs.map((doc) => publicEvent(doc.seq, doc.seat === undefined ? null : doc.seat, doc));
}

module.exports = { eventSeat, publicEvent, changedSeats, projectUpdate, projectLog };
