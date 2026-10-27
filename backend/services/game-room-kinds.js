'use strict';

const domain = require('@money/domain');
// the Dreamfund table is kept out of the domain package's barrel (the browser bundle does not carry the table's rules)
const dreamTable = require('@money/domain/dist/cashflow-game/dreamfund/table/reducer');
const dreamBots = require('@money/domain/dist/cashflow-game/dreamfund/table/bot');
const dreamView = require('@money/domain/dist/cashflow-game/dreamfund/table/view');
const { DREAM_POLICIES } = require('@money/domain/dist/cashflow-game/dreamfund-sim/policies');

/**
 * The kinds of table a room can hold (todo/dreamfund-multiplayer.md slice 5): the classic Cashflow table and the Dreamfund table.
 * A room, its lobby, its clock, its event log, its live channel and its seats are the same for both; what differs is the rules - which
 * are the domain's, one set per kind. A table says which kind it is (`kind: 'dreamfund'`; a classic table has none), so rooms made
 * before the Dreamfund existed are classic without a change.
 */

const classic = {
  id: 'classic',
  create: (input, ctx) => domain.createTable(input, ctx),
  apply: (table, userId, command, ctx) => domain.applyCommand(table, userId, command, ctx),
  timeout: (table, ctx) => domain.applyTimeout(table, ctx),
  project: (table, userId) => domain.projectFor(table, userId),
  legal: (table, userId) => domain.tableLegalActions(table, userId),
  deadline: (table) => domain.nextDeadline(table),
  humansOut: (table) => domain.humansAreOut(table),
};

/** Only bots are left in the game: nobody finished, left or is still a person. */
function dreamHumansOut(table) {
  if (table.phase !== 'playing') return false;
  const finished = new Set(table.finishers.map((f) => f.playerId));
  return !table.players.some((p) => !p.bot && p.status === 'active' && !finished.has(p.id));
}

const dreamfund = {
  id: 'dreamfund',
  create: (input, ctx) => dreamTable.createDreamTable(input, ctx),
  apply: (table, userId, command, ctx) => dreamTable.applyDreamCommand(table, userId, command, ctx),
  timeout: (table, ctx) => dreamTable.applyDreamTimeout(table, ctx),
  project: (table, userId) => dreamView.projectDreamFor(table, userId),
  legal: (table, userId) => dreamView.dreamLegalActions(table, userId),
  // the clock reads only what the two tables share
  deadline: (table) => domain.nextDeadline(table),
  humansOut: dreamHumansOut,
  /** The next step of the first bot that has one, played through the rules; null when none has. */
  botStep: (table, ctx) => {
    const step = dreamBots.nextBotStep(table);
    return step ? dreamBots.playBotStep(table, step, ctx) : null;
  },
  /** The strategies a bot of this table may play. */
  policies: DREAM_POLICIES.map((policy) => ({ id: policy.id, name: policy.name })),
};

/** The rules of a table (by what it says it is). */
const kindOf = (table) => (table && table.kind === 'dreamfund' ? dreamfund : classic);

/** The rules for a kind named in a request (`dreamfund`; anything else is the classic game). */
const kindNamed = (name) => (name === 'dreamfund' ? dreamfund : classic);

module.exports = { classic, dreamfund, kindOf, kindNamed };
