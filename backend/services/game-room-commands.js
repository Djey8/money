'use strict';

const { TableCommandError } = require('@money/domain');

/**
 * The commands a client may send to a running table (todo/cashflow-multiplayer.md slice S3): checked for shape here, decided by
 * the domain's rules afterwards. The API speaks in **seats**, never account ids - a trade offer names `toSeat`, a seller accepts
 * `fromSeat` - so `parseCommand` returns a function of the current table that builds the domain command.
 *
 * Only moves of play are accepted: joining, leaving, readiness, kicking and settings have their own routes (limits and seat
 * lookups belong to them), and the clock's timeout is the server's alone.
 */

const DECKS = ['dealSmall', 'dealBig', 'market', 'doodad'];
const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

/** A field that must be a whole number above zero. */
const wholeAbove0 = (value, name) =>
  Number.isSafeInteger(value) && value > 0 ? null : `${name} must be a whole number above zero.`;
const wholeSeat = (value, name) =>
  Number.isSafeInteger(value) && value >= 0 ? null : `${name} must be a seat number from 0.`;

const PILES = ['seed', 'sapling', 'tree'];
const text = (value, name) =>
  typeof value === 'string' && value.length > 0 && value.length <= 200
    ? null
    : `${name} must be a non-empty string.`;
const amount = (value, name) =>
  Number.isSafeInteger(value) && value > 0 ? null : `${name} must be a whole number above zero.`;
const none = { fields: [], check: () => null };

/**
 * The moves of the Dreamfund game (todo/dreamfund-multiplayer.md): the table's own - a life's decisions, its money, a Harvest card's
 * options, a standing sale. (`roll`, the trade commands and the clock's commands are shared with the classic game above.)
 */
const DREAMFUND_COMMANDS = {
  pay_emergency: {
    fields: ['pay', 'choiceId'],
    check: (c) =>
      !['now', 3, 6, 12].includes(c.pay)
        ? "pay must be 'now' or a plan of 3, 6 or 12 Paydays."
        : c.choiceId === undefined || typeof c.choiceId === 'string'
          ? null
          : 'choiceId must be a string.',
    build: (c) => ({
      type: 'pay_emergency',
      pay: c.pay,
      ...(c.choiceId !== undefined ? { choiceId: c.choiceId } : {}),
    }),
  },
  emergency_choose: {
    fields: ['choiceId'],
    check: (c) => text(c.choiceId, 'choiceId'),
    build: (c) => ({ type: 'emergency_choose', choiceId: c.choiceId }),
  },
  emergency_roll: {
    fields: ['key'],
    check: (c) => text(c.key, 'key'),
    build: (c) => ({ type: 'emergency_roll', key: c.key }),
  },
  emergency_reroll: { ...none, build: () => ({ type: 'emergency_reroll' }) },
  answer_life: {
    fields: ['decision', 'option'],
    check: (c) =>
      ['accept', 'decline', 'roll', 'pass', 'give', 'lend', 'option'].includes(c.decision)
        ? c.decision === 'option'
          ? text(c.option, 'option')
          : null
        : 'decision must be accept, decline, roll, pass, give, lend or option.',
    build: (c) => ({
      type: 'answer_life',
      decision: c.decision === 'option' ? { option: c.option } : c.decision,
    }),
  },
  choose_career_branch: {
    fields: ['index'],
    check: (c) => (Number.isInteger(c.index) && c.index >= 0 ? null : 'index must be 0 or more.'),
    build: (c) => ({ type: 'choose_career_branch', index: c.index }),
  },
  take_dream: {
    fields: ['cardId'],
    check: (c) => text(c.cardId, 'cardId'),
    build: (c) => ({ type: 'take_dream', cardId: c.cardId }),
  },
  choose_pile: {
    fields: ['pile'],
    check: (c) => (PILES.includes(c.pile) ? null : `pile must be one of ${PILES.join(', ')}.`),
    build: (c) => ({ type: 'choose_pile', pile: c.pile }),
  },
  take_opportunity: {
    fields: ['cardId', 'units', 'steps', 'swapOut'],
    check: (c) =>
      text(c.cardId, 'cardId') ||
      (c.units === undefined ? null : amount(c.units, 'units')) ||
      (c.steps === undefined ? null : amount(c.steps, 'steps')) ||
      (c.swapOut === undefined ? null : text(c.swapOut, 'swapOut')),
    build: (c) => ({
      type: 'take_opportunity',
      cardId: c.cardId,
      choice: {
        ...(c.units !== undefined ? { units: c.units } : {}),
        ...(c.steps !== undefined ? { steps: c.steps } : {}),
        ...(c.swapOut !== undefined ? { swapOut: c.swapOut } : {}),
      },
    }),
  },
  skip: { ...none, build: () => ({ type: 'skip' }) },
  end_turn: { ...none, build: () => ({ type: 'end_turn' }) },
  settle_payday: { ...none, build: () => ({ type: 'settle_payday' }) },
  fund_reserve: {
    fields: ['amountMinor'],
    check: (c) => amount(c.amountMinor, 'amountMinor'),
    build: (c) => ({ type: 'fund_reserve', amountMinor: c.amountMinor }),
  },
  fund_dream: {
    fields: ['amountMinor'],
    check: (c) => amount(c.amountMinor, 'amountMinor'),
    build: (c) => ({ type: 'fund_dream', amountMinor: c.amountMinor }),
  },
  repay_debt: {
    fields: ['tag'],
    check: (c) => text(c.tag, 'tag'),
    build: (c) => ({ type: 'repay_debt', tag: c.tag }),
  },
  repay_bank_loan: {
    fields: ['amountMinor'],
    check: (c) => amount(c.amountMinor, 'amountMinor'),
    build: (c) => ({ type: 'repay_bank_loan', amountMinor: c.amountMinor }),
  },
  set_plan: {
    fields: ['kind', 'id', 'perMinor'],
    check: (c) =>
      !['mojo', 'life', 'smile'].includes(c.kind)
        ? 'kind must be mojo, life or smile.'
        : text(c.id, 'id') ||
          (Number.isSafeInteger(c.perMinor) && c.perMinor >= 0
            ? null
            : 'perMinor must be a whole number, 0 to stop the plan.'),
    build: (c) => ({ type: 'set_plan', kind: c.kind, id: c.id, perMinor: c.perMinor }),
  },
  sell_holding: {
    fields: ['holding'],
    check: (c) => text(c.holding, 'holding'),
    build: (c) => ({ type: 'sell_holding', holding: c.holding }),
  },
  harvest_sell: {
    fields: ['holding'],
    check: (c) => text(c.holding, 'holding'),
    build: (c) => ({ type: 'harvest_sell', holding: c.holding }),
  },
  harvest_accept: {
    fields: ['holding'],
    check: (c) => text(c.holding, 'holding'),
    build: (c) => ({ type: 'harvest_accept', holding: c.holding }),
  },
  harvest_ladder: {
    fields: ['holding', 'action'],
    check: (c) =>
      text(c.holding, 'holding') ||
      (['ride', 'cash', 'skip'].includes(c.action) ? null : 'action must be ride, cash or skip.'),
    build: (c) => ({ type: 'harvest_ladder', holding: c.holding, action: c.action }),
  },
};

/** Each command: its allowed fields, a check of them, and how it becomes a domain command given the table. */
const COMMANDS = {
  roll: {
    fields: ['dice'],
    check: (c) =>
      c.dice === undefined || c.dice === 1 || c.dice === 2 ? null : 'dice must be 1 or 2.',
    build: (c) => ({ type: 'roll', ...(c.dice !== undefined ? { dice: c.dice } : {}) }),
  },
  draw_card: {
    fields: ['deck'],
    check: (c) => (DECKS.includes(c.deck) ? null : `deck must be one of ${DECKS.join(', ')}.`),
    build: (c) => ({ type: 'draw_card', deck: c.deck }),
  },
  buy_deal: {
    fields: ['cardId', 'quantity'],
    check: (c) =>
      typeof c.cardId !== 'string' || !c.cardId
        ? 'cardId must be a card id.'
        : c.quantity !== undefined && !(Number.isFinite(c.quantity) && c.quantity > 0)
          ? 'quantity must be a number above zero.'
          : null,
    build: (c) => ({
      type: 'buy_deal',
      cardId: c.cardId,
      ...(c.quantity !== undefined ? { quantity: c.quantity } : {}),
    }),
  },
  pay_market: {
    fields: ['cardId'],
    check: (c) => (typeof c.cardId === 'string' && c.cardId ? null : 'cardId must be a card id.'),
    build: (c) => ({ type: 'pay_market', cardId: c.cardId }),
  },
  pay_doodad: {
    fields: ['cardId'],
    check: (c) => (typeof c.cardId === 'string' && c.cardId ? null : 'cardId must be a card id.'),
    build: (c) => ({ type: 'pay_doodad', cardId: c.cardId }),
  },
  roll_decision: {
    fields: ['title'],
    check: (c) =>
      c.title === undefined || typeof c.title === 'string' ? null : 'title must be a string.',
    build: (c) => ({ type: 'roll_decision', ...(c.title !== undefined ? { title: c.title } : {}) }),
  },
  plan_deal: {
    fields: ['cardId'],
    check: (c) => (typeof c.cardId === 'string' && c.cardId ? null : 'cardId must be a string.'),
    build: (c) => ({ type: 'plan_deal', cardId: c.cardId }),
  },
  buy_planned: {
    fields: ['title', 'quantity'],
    check: (c) =>
      typeof c.title !== 'string' || !c.title
        ? 'title must be the title of the planned project.'
        : c.quantity === undefined || (Number.isInteger(c.quantity) && c.quantity > 0)
          ? null
          : 'quantity must be a whole number above zero.',
    build: (c) => ({
      type: 'buy_planned',
      title: c.title,
      ...(c.quantity !== undefined ? { quantity: c.quantity } : {}),
    }),
  },
  finish_card: { fields: [], check: () => null, build: () => ({ type: 'finish_card' }) },
  pass_card: { fields: [], check: () => null, build: () => ({ type: 'pass_card' }) },
  pay_liability: {
    fields: ['tag'],
    check: (c) =>
      typeof c.tag === 'string' && c.tag.length > 0 && c.tag.length <= 120
        ? null
        : 'tag must be the name of the liability to pay off (see books.liabilities).',
    build: (c) => ({ type: 'pay_liability', tag: c.tag }),
  },
  bank_loan: {
    fields: ['amountMinor'],
    check: (c) =>
      Number.isSafeInteger(c.amountMinor) && c.amountMinor !== 0
        ? null
        : 'amountMinor must be a whole number, positive to borrow and negative to repay.',
    build: (c) => ({ type: 'bank_loan', amountMinor: c.amountMinor }),
  },
  sell_position: {
    fields: ['input'],
    check: (c) => {
      if (!isObject(c.input)) return 'input must be an object with the title of the position.';
      const unknown = Object.keys(c.input).filter(
        (key) => !['title', 'quantity', 'priceMinor', 'salePriceMinor'].includes(key),
      );
      if (unknown.length > 0) return `input has unknown fields: ${unknown.join(', ')}.`;
      if (typeof c.input.title !== 'string' || !c.input.title)
        return 'input.title must be a string.';
      for (const key of ['quantity', 'priceMinor', 'salePriceMinor']) {
        if (c.input[key] !== undefined && !(Number.isFinite(c.input[key]) && c.input[key] > 0)) {
          return `input.${key} must be a number above zero.`;
        }
      }
      return null;
    },
    build: (c) => ({ type: 'sell_position', input: { ...c.input } }),
  },
  offer_trade: {
    fields: ['priceMinor', 'toSeat', 'holding'],
    check: (c) =>
      wholeAbove0(c.priceMinor, 'priceMinor') ||
      (c.holding === undefined || (typeof c.holding === 'string' && c.holding)
        ? null
        : 'holding must be the title of the holding offered.') ||
      (c.toSeat === undefined ? null : wholeSeat(c.toSeat, 'toSeat')),
    build: (c, table) => ({
      type: 'offer_trade',
      priceMinor: c.priceMinor,
      ...(c.holding !== undefined ? { holding: c.holding } : {}),
      ...(c.toSeat !== undefined ? { to: seatId(table, c.toSeat) } : {}),
    }),
  },
  withdraw_trade: { fields: [], check: () => null, build: () => ({ type: 'withdraw_trade' }) },
  counter_trade: {
    fields: ['priceMinor'],
    check: (c) => wholeAbove0(c.priceMinor, 'priceMinor'),
    build: (c) => ({ type: 'counter_trade', priceMinor: c.priceMinor }),
  },
  decline_trade: { fields: [], check: () => null, build: () => ({ type: 'decline_trade' }) },
  accept_trade: {
    fields: ['fromSeat'],
    check: (c) => (c.fromSeat === undefined ? null : wholeSeat(c.fromSeat, 'fromSeat')),
    build: (c, table) => ({
      type: 'accept_trade',
      ...(c.fromSeat !== undefined ? { from: seatId(table, c.fromSeat) } : {}),
    }),
  },
  ...DREAMFUND_COMMANDS,
  pause: { fields: [], check: () => null, build: () => ({ type: 'pause' }) },
  resume: { fields: [], check: () => null, build: () => ({ type: 'resume' }) },
  back: { fields: [], check: () => null, build: () => ({ type: 'back' }) },
  away: { fields: [], check: () => null, build: () => ({ type: 'away' }) },
  done: { fields: [], check: () => null, build: () => ({ type: 'done' }) },
  propose_undo: { fields: [], check: () => null, build: () => ({ type: 'propose_undo' }) },
  vote_undo: {
    fields: ['yes'],
    check: (c) => (typeof c.yes === 'boolean' ? null : 'yes must be true or false.'),
    build: (c) => ({ type: 'vote_undo', yes: c.yes }),
  },
};

/** The account that sits at a seat; a seat nobody holds is a refusal like any other unknown player. */
function seatId(table, seat) {
  const player = table.players[seat];
  if (!player) throw new TableCommandError('UNKNOWN_PLAYER', `Nobody sits at seat ${seat}.`);
  return player.id;
}

const TYPES = Object.keys(COMMANDS);

/**
 * Checks the `command` of a request. Returns `{ build(table) }` - the domain command for the table as it is when the command
 * is applied - or `{ error }` describing what is wrong with the request.
 */
function parseCommand(command) {
  if (!isObject(command)) return { error: 'command must be an object with a type.' };
  const entry = Object.prototype.hasOwnProperty.call(COMMANDS, command.type)
    ? COMMANDS[command.type]
    : null;
  if (!entry) {
    return { error: `command.type must be one of: ${TYPES.join(', ')}.` };
  }
  const unknown = Object.keys(command).filter(
    (key) => key !== 'type' && !entry.fields.includes(key),
  );
  if (unknown.length > 0)
    return { error: `${command.type} has unknown fields: ${unknown.join(', ')}.` };
  const problem = entry.check(command);
  if (problem) return { error: `${command.type}: ${problem}` };
  return { build: (table) => entry.build(command, table) };
}

const COMMAND_ID = /^[A-Za-z0-9_.:-]{1,64}$/;

/** The optional `clientCommandId` (idempotency) and `expectedVersion` (concurrency) of a request body. */
function parseGuards(body) {
  if (body.clientCommandId !== undefined && !COMMAND_ID.test(String(body.clientCommandId))) {
    return { error: 'clientCommandId must be 1 to 64 letters, digits or _ . : -.' };
  }
  if (
    body.expectedVersion !== undefined &&
    !(Number.isInteger(body.expectedVersion) && body.expectedVersion >= 0)
  ) {
    return { error: 'expectedVersion must be a whole number of zero or more.' };
  }
  return {
    clientCommandId: body.clientCommandId === undefined ? undefined : String(body.clientCommandId),
    expectedVersion: body.expectedVersion,
  };
}

module.exports = { parseCommand, parseGuards, TYPES };
