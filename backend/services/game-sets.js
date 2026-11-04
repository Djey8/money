'use strict';

/**
 * The printed game content of the server (JFK, 2026-11): the one place that loads the catalog. The domain package does not import it
 * itself (it would travel into every browser bundle), so the table rules find their sets here, registered once.
 */
const { CASHFLOW_GAME_SETS } = require('@money/domain/dist/cashflow-content');
const {
  setDefaultTableGameSets,
} = require('@money/domain/dist/cashflow-game/table/default-game-sets');

setDefaultTableGameSets(CASHFLOW_GAME_SETS);

module.exports = { CASHFLOW_GAME_SETS };
