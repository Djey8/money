'use strict';

const { getAuthDb } = require('../config/db');
const { getAccount } = require('../repositories/account-repository');
const { isGameAccountEmail } = require('../services/game-account');
const { problem } = require('./api-auth');

/**
 * The Cashflow game is for game accounts only - an email containing "cashflow" - whatever the token's scopes say. A token
 * carries no email, so it is read from the account. Used by the multiplayer routes (docs/adr/0010): a normal account gets the
 * same 403 `not_a_game_account` as on the solo game endpoints, on every route and on the event stream.
 */
async function requireGameAccount(req, res, next) {
  try {
    const email = req.userEmail || (await getAccount({ authDb: getAuthDb() }, req.userId)).email;
    if (isGameAccountEmail(email)) return next();
    return problem(
      res,
      403,
      'not_a_game_account',
      'Not a game account',
      'The Cashflow game endpoints are only available to game accounts.',
    );
  } catch (error) {
    return next(error);
  }
}

module.exports = { requireGameAccount };
