/**
 * Unit tests for the commands a client may send to a running table (backend/services/game-room-commands.js).
 */
'use strict';

const { TableCommandError } = require('@money/domain');
const { parseCommand, parseGuards, TYPES } = require('../../services/game-room-commands');

const table = { players: [{ id: 'acct-host' }, { id: 'acct-anna' }, { id: 'acct-ben' }] };
const build = (command) => {
  const parsed = parseCommand(command);
  expect(parsed.error).toBeUndefined();
  return parsed.build(table);
};
const error = (command) => parseCommand(command).error;

describe('the moves of play', () => {
  it('turns each valid command into the domain command', () => {
    expect(build({ type: 'roll' })).toEqual({ type: 'roll' });
    expect(build({ type: 'roll', dice: 2 })).toEqual({ type: 'roll', dice: 2 });
    expect(build({ type: 'draw_card', deck: 'market' })).toEqual({
      type: 'draw_card',
      deck: 'market',
    });
    expect(build({ type: 'buy_deal', cardId: 'c1' })).toEqual({ type: 'buy_deal', cardId: 'c1' });
    expect(build({ type: 'buy_deal', cardId: 'c1', quantity: 10 })).toEqual({
      type: 'buy_deal',
      cardId: 'c1',
      quantity: 10,
    });
    expect(build({ type: 'pay_doodad', cardId: 'd1' })).toEqual({
      type: 'pay_doodad',
      cardId: 'd1',
    });
    expect(build({ type: 'roll_decision' })).toEqual({ type: 'roll_decision' });
    expect(build({ type: 'roll_decision', title: 'GOLD' })).toEqual({
      type: 'roll_decision',
      title: 'GOLD',
    });
    expect(build({ type: 'pass_card' })).toEqual({ type: 'pass_card' });
    expect(build({ type: 'bank_loan', amountMinor: -100000 })).toEqual({
      type: 'bank_loan',
      amountMinor: -100000,
    });
    expect(build({ type: 'sell_position', input: { title: 'EFH', priceMinor: 5000 } })).toEqual({
      type: 'sell_position',
      input: { title: 'EFH', priceMinor: 5000 },
    });
    for (const type of ['withdraw_trade', 'decline_trade', 'pause', 'resume', 'back']) {
      expect(build({ type })).toEqual({ type });
    }
    expect(build({ type: 'counter_trade', priceMinor: 700 })).toEqual({
      type: 'counter_trade',
      priceMinor: 700,
    });
  });

  it('names players by seat and builds the account only when the command is applied', () => {
    expect(build({ type: 'offer_trade', priceMinor: 300000 })).toEqual({
      type: 'offer_trade',
      priceMinor: 300000,
    });
    expect(build({ type: 'offer_trade', priceMinor: 300000, toSeat: 2 })).toEqual({
      type: 'offer_trade',
      priceMinor: 300000,
      to: 'acct-ben',
    });
    expect(build({ type: 'accept_trade' })).toEqual({ type: 'accept_trade' });
    expect(build({ type: 'accept_trade', fromSeat: 1 })).toEqual({
      type: 'accept_trade',
      from: 'acct-anna',
    });
    // a seat nobody holds is an unknown player, decided against the table at hand
    const parsed = parseCommand({ type: 'accept_trade', fromSeat: 9 });
    expect(parsed.error).toBeUndefined();
    expect(() => parsed.build(table)).toThrow(TableCommandError);
    expect(() => parsed.build(table)).toThrow(/seat 9/);
    try {
      parsed.build(table);
    } catch (thrown) {
      expect(thrown.code).toBe('UNKNOWN_PLAYER');
    }
  });

  it("refuses what is not a move of play: lobby commands, the server's timeout, anything unknown", () => {
    for (const type of [
      'join',
      'leave',
      'set_ready',
      'kick',
      'update_settings',
      'start',
      'pick_profession',
      'close',
      'timeout',
      'nope',
    ]) {
      expect(error({ type })).toMatch(/command\.type must be one of/);
    }
    expect(error({})).toMatch(/command\.type/);
    expect(error(null)).toMatch(/must be an object/);
    expect(error('roll')).toMatch(/must be an object/);
    expect(error([])).toMatch(/must be an object/);
    expect(error({ type: 'toString' })).toMatch(/command\.type must be one of/);
    expect(TYPES).not.toContain('start');
    expect(TYPES).toContain('sell_position');
  });

  it('refuses unknown fields, so a typo is an error and not a silently different move', () => {
    expect(error({ type: 'roll', dice: 1, cheat: true })).toBe('roll has unknown fields: cheat.');
    expect(error({ type: 'pass_card', cardId: 'x' })).toBe('pass_card has unknown fields: cardId.');
    expect(error({ type: 'sell_position', input: { title: 'EFH', price: 5 } })).toMatch(
      /unknown fields: price/,
    );
  });

  it('checks every field', () => {
    expect(error({ type: 'roll', dice: 3 })).toMatch(/dice must be 1 or 2/);
    expect(error({ type: 'draw_card', deck: 'jokers' })).toMatch(/deck must be one of/);
    expect(error({ type: 'draw_card' })).toMatch(/deck must be one of/);
    expect(error({ type: 'buy_deal' })).toMatch(/cardId/);
    expect(error({ type: 'buy_deal', cardId: 'c', quantity: 0 })).toMatch(/quantity/);
    expect(error({ type: 'buy_deal', cardId: 'c', quantity: 'ten' })).toMatch(/quantity/);
    expect(error({ type: 'pay_doodad', cardId: '' })).toMatch(/cardId/);
    expect(error({ type: 'roll_decision', title: 5 })).toMatch(/title/);
    expect(error({ type: 'bank_loan', amountMinor: 0 })).toMatch(/amountMinor/);
    expect(error({ type: 'bank_loan', amountMinor: 10.5 })).toMatch(/amountMinor/);
    expect(error({ type: 'sell_position' })).toMatch(/input must be an object/);
    expect(error({ type: 'sell_position', input: { title: '' } })).toMatch(/input.title/);
    expect(error({ type: 'sell_position', input: { title: 'EFH', quantity: -1 } })).toMatch(
      /input.quantity/,
    );
    expect(error({ type: 'offer_trade', priceMinor: 0 })).toMatch(/priceMinor/);
    expect(error({ type: 'offer_trade', priceMinor: 1.5 })).toMatch(/priceMinor/);
    expect(error({ type: 'offer_trade', priceMinor: 5, toSeat: -1 })).toMatch(/toSeat/);
    expect(error({ type: 'offer_trade', priceMinor: 5, toSeat: 'x' })).toMatch(/toSeat/);
    expect(error({ type: 'counter_trade' })).toMatch(/priceMinor/);
    expect(error({ type: 'accept_trade', fromSeat: 1.5 })).toMatch(/fromSeat/);
  });
});

describe('the optional guards', () => {
  it('accepts a command id and a version, or neither', () => {
    expect(parseGuards({})).toEqual({ clientCommandId: undefined, expectedVersion: undefined });
    expect(parseGuards({ clientCommandId: 'roll-17_a.b:c', expectedVersion: 0 })).toEqual({
      clientCommandId: 'roll-17_a.b:c',
      expectedVersion: 0,
    });
  });

  it('refuses a command id that is not a plain token, and a version that is not a count', () => {
    expect(parseGuards({ clientCommandId: '' }).error).toMatch(/clientCommandId/);
    expect(parseGuards({ clientCommandId: 'has space' }).error).toMatch(/clientCommandId/);
    expect(parseGuards({ clientCommandId: 'x'.repeat(65) }).error).toMatch(/clientCommandId/);
    expect(parseGuards({ clientCommandId: '<script>' }).error).toMatch(/clientCommandId/);
    expect(parseGuards({ expectedVersion: -1 }).error).toMatch(/expectedVersion/);
    expect(parseGuards({ expectedVersion: 1.5 }).error).toMatch(/expectedVersion/);
    expect(parseGuards({ expectedVersion: '3' }).error).toMatch(/expectedVersion/);
  });
});
