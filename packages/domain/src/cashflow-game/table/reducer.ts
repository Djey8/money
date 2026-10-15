import { CASHFLOW_GAME_SETS } from '../../cashflow-content';
import { drawCardAction, rollDecisionAction, startGameAction } from '../actions';
import { openDecisions } from '../asset-deals';
import { applyEffectsToBooks, type GameBooks } from '../books';
import { pickOne } from '../rng';
import { currentTurn } from '../turn';
import {
  initialCashflowGameState,
  type CashflowDealCard,
  type CashflowGameSet,
  type CashflowProfession,
} from '../types';
import { marketCardKind } from '../market-cards';
import { movePriceForHolders, playMarketForTable } from './market';
import { isMoveCommand, planMove, runPlan, type MoveCommand, type PlayDeps } from './play';
import { normalizeTableSettings } from './settings';
import { shuffled, tableRng } from './table-rng';
import {
  countTimeout,
  initClock,
  isDue,
  pauseClock,
  resetTimeouts,
  resumeClock,
  startTurnClock,
  stopClock,
  whyClockBlocks,
} from './clock';
import { nextPassiveCommand } from './passive';
import { isAlive, settleTable } from './turns';
import {
  PLAYER_NAME_MAX,
  TABLE_COLORS,
  TABLE_MIN_SEATS,
  TableCommandError,
  type Table,
  type TableCommand,
  type TableEvent,
  type TableEventType,
  type TablePlayer,
  type TableSettingsInput,
} from './types';

/**
 * The table's one way to change (todo/cashflow-multiplayer.md slice T1): `applyCommand(table, playerId, command, ctx)` returns
 * the next table and the events it produced, or throws a `TableCommandError` and changes nothing. Pure: no I/O, the clock and
 * the game text come in through `ctx`, and chance comes from the table's own stream (`rngState`), so the same commands applied
 * to the same table always give the same game - which is what makes a replay and a restarted server possible.
 *
 * T1 covers the lifecycle: join, leave, ready, kick, settings, start, profession picking, close. Turns come in T3.
 */

/** What the table's rules need from outside: the clock, the game's words and card texts, money formatting. */
export interface TableContext extends PlayDeps {
  gameSets?: CashflowGameSet[];
}

export interface CommandResult {
  table: Table;
  events: TableEvent[];
}

const gameSetsOf = (ctx: TableContext) => ctx.gameSets ?? CASHFLOW_GAME_SETS;

/** The server's current time in epoch milliseconds, from the context's clock. */
const nowOf = (ctx: TableContext) => Date.parse(ctx.clock.nowIso());

function fail(code: ConstructorParameters<typeof TableCommandError>[0], message: string): never {
  throw new TableCommandError(code, message);
}

// ── Creating a table ───────────────────────────────────────────────────────────────────────────────

export interface CreateTableInput {
  id: string;
  hostId: string;
  hostName: string;
  hostColor?: string;
  settings: TableSettingsInput;
  /** The server's secret seed; the dice and card stream starts here. */
  seed: number;
}

/** A new table in the lobby with its host seated and ready. */
export function createTable(input: CreateTableInput, ctx: TableContext): CommandResult {
  const settings = normalizeTableSettings(input.settings, gameSetsOf(ctx));
  const name = cleanName(input.hostName);
  const host: TablePlayer = {
    id: input.hostId,
    name,
    color: pickColor([], input.hostColor),
    ready: true,
    pick: null,
    professionId: null,
    status: 'active',
    away: false,
    books: null,
  };
  const table: Table = {
    id: input.id,
    version: 1,
    phase: 'lobby',
    settings,
    hostId: host.id,
    players: [host],
    order: [],
    activePlayerId: null,
    tableRound: 0,
    turnRolled: false,
    finishers: [],
    result: null,
    clock: { turnStartedAt: null, deadlineAt: null, banksMs: {}, pausedAt: null, timeouts: {} },
    drawnCardIds: { dealSmall: [], dealBig: [], market: [], doodad: [] },
    rngState: input.seed >>> 0,
    createdAt: ctx.clock.nowIso(),
  };
  return {
    table,
    events: [event(ctx, table.version, 'table_created', host.id, { name: settings.name })],
  };
}

// ── Commands ───────────────────────────────────────────────────────────────────────────────────────

export function applyCommand(
  table: Table,
  playerId: string,
  command: TableCommand,
  ctx: TableContext,
): CommandResult {
  const me = table.players.find((player) => player.id === playerId);
  if (command.type !== 'join' && !me) fail('NOT_A_MEMBER', 'You are not at this table.');
  const version = table.version + 1;
  if (isMoveCommand(command)) {
    return runAwayTurns(play(table, playerId, command, version, ctx), version, ctx);
  }
  const emit = (type: TableEventType, who: string | null, data?: Record<string, unknown>) =>
    event(ctx, version, type, who, data);

  switch (command.type) {
    case 'join':
      return join(table, playerId, command, version, emit, me);
    case 'leave':
      return leave(table, playerId, version, emit, ctx);
    case 'set_ready':
      return setReady(table, playerId, command.ready, version, emit);
    case 'kick':
      return kick(table, playerId, command.target, version, emit, ctx);
    case 'update_settings':
      return updateSettings(table, playerId, command.settings, version, emit, ctx);
    case 'start':
      return start(table, playerId, version, emit, ctx);
    case 'pick_profession':
      return pick(table, playerId, command.professionId, version, emit, ctx);
    case 'close':
      return close(table, playerId, version, emit);
    case 'pause':
    case 'resume':
      return pauseOrResume(table, playerId, command.type, version, emit, ctx);
    case 'back':
      return back(table, playerId, version, emit);
    default:
      return fail('UNKNOWN_COMMAND', 'Unknown table command.');
  }
}

type Emit = (
  type: TableEventType,
  who: string | null,
  data?: Record<string, unknown>,
) => TableEvent;

function event(
  ctx: TableContext,
  version: number,
  type: TableEventType,
  playerId: string | null,
  data?: Record<string, unknown>,
): TableEvent {
  return { version, at: ctx.clock.nowIso(), type, playerId, ...(data ? { data } : {}) };
}

function cleanName(raw: unknown): string {
  const name = typeof raw === 'string' ? raw.trim().replace(/\s+/g, ' ') : '';
  // eslint-disable-next-line no-control-regex
  if (name.length < 1 || name.length > PLAYER_NAME_MAX || /[\u0000-\u001f\u007f]/.test(name)) {
    fail('INVALID_NAME', `A player name must be 1 to ${PLAYER_NAME_MAX} characters.`);
  }
  return name;
}

function pickColor(players: readonly TablePlayer[], wanted?: string): string {
  const taken = new Set(players.map((player) => player.color));
  if (wanted !== undefined) {
    if (!TABLE_COLORS.includes(wanted))
      fail('COLOR_TAKEN', 'That is not one of the table colours.');
    if (taken.has(wanted)) fail('COLOR_TAKEN', 'Another player already has that colour.');
    return wanted;
  }
  const free = TABLE_COLORS.find((color) => !taken.has(color));
  if (!free) fail('TABLE_FULL', 'The table has no free colour left.');
  return free as string;
}

const activePlayers = (table: Table) => table.players.filter((p) => p.status === 'active');

function join(
  table: Table,
  playerId: string,
  command: Extract<TableCommand, { type: 'join' }>,
  version: number,
  emit: Emit,
  existing: TablePlayer | undefined,
): CommandResult {
  if (existing) fail('ALREADY_JOINED', 'You are already at this table.');
  if (table.phase !== 'lobby') fail('WRONG_PHASE', 'The game has already started.');
  if (table.players.length >= table.settings.maxSeats) fail('TABLE_FULL', 'The table is full.');
  const name = cleanName(command.name);
  if (table.players.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
    fail('NAME_TAKEN', 'Another player at this table has that name.');
  }
  const player: TablePlayer = {
    id: playerId,
    name,
    color: pickColor(table.players, command.color),
    ready: false,
    pick: null,
    professionId: null,
    status: 'active',
    away: false,
    books: null,
  };
  return {
    table: { ...table, version, players: [...table.players, player] },
    events: [emit('player_joined', playerId, { name, color: player.color })],
  };
}

function setReady(
  table: Table,
  playerId: string,
  ready: boolean,
  version: number,
  emit: Emit,
): CommandResult {
  if (table.phase !== 'lobby') fail('WRONG_PHASE', 'Ready can only be changed in the lobby.');
  return {
    table: {
      ...table,
      version,
      players: table.players.map((p) => (p.id === playerId ? { ...p, ready } : p)),
    },
    events: [emit('ready_changed', playerId, { ready })],
  };
}

/** Removes a seat before play (lobby or picking) and settles what that leaves behind. */
function removeSeat(
  table: Table,
  targetId: string,
  version: number,
  emit: Emit,
  ctx: TableContext,
  eventType: 'player_left' | 'player_kicked',
): CommandResult {
  const events: TableEvent[] = [emit(eventType, targetId)];
  const players = table.players.filter((p) => p.id !== targetId);
  if (players.length === 0) {
    events.push(emit('table_closed', targetId, { reason: 'empty' }));
    return { table: { ...table, version, phase: 'abandoned', players }, events };
  }
  let next: Table = { ...table, version, players };
  if (table.hostId === targetId) {
    next = { ...next, hostId: players[0].id };
    events.push(emit('host_changed', players[0].id));
  }
  if (next.phase === 'picking') {
    if (players.length < TABLE_MIN_SEATS) {
      next = {
        ...next,
        phase: 'lobby',
        players: players.map((p) => ({ ...p, pick: null, ready: p.id === next.hostId })),
      };
      events.push(emit('back_to_lobby', null, { reason: 'not_enough_players' }));
    } else if (players.every((p) => p.pick !== null)) {
      return reveal(next, version, events, emit, ctx);
    }
  }
  return { table: next, events };
}

function leave(
  table: Table,
  playerId: string,
  version: number,
  emit: Emit,
  ctx: TableContext,
): CommandResult {
  if (table.phase === 'lobby' || table.phase === 'picking') {
    return removeSeat(table, playerId, version, emit, ctx, 'player_left');
  }
  if (table.phase !== 'playing') fail('WRONG_PHASE', 'The game is over.');
  // Mid-game the seat stays (its books are part of the game); the player is simply out, and if it was their turn it moves on.
  const players = table.players.map((p) =>
    p.id === playerId ? { ...p, status: 'left' as const } : p,
  );
  const events: TableEvent[] = [emit('player_left', playerId)];
  let next: Table = { ...table, version, players };
  if (activePlayers(next).length === 0) {
    next = { ...next, phase: 'abandoned', activePlayerId: null };
    events.push(emit('table_closed', playerId, { reason: 'everyone_left' }));
    return { table: next, events };
  }
  if (table.hostId === playerId) {
    const heir = activePlayers(next)[0];
    next = { ...next, hostId: heir.id };
    events.push(emit('host_changed', heir.id));
  }
  next = settleTable(next, (type, who, data) => events.push(emit(type, who, data)), nowOf(ctx));
  return runAwayTurns({ table: next, events }, version, ctx);
}

function kick(
  table: Table,
  playerId: string,
  target: string,
  version: number,
  emit: Emit,
  ctx: TableContext,
): CommandResult {
  if (playerId !== table.hostId) fail('NOT_HOST', 'Only the host can remove a player.');
  if (table.phase !== 'lobby' && table.phase !== 'picking') {
    fail('WRONG_PHASE', 'Players can only be removed before the game starts.');
  }
  if (target === table.hostId) fail('CANNOT_KICK_HOST', 'The host cannot be removed.');
  if (!table.players.some((p) => p.id === target)) fail('UNKNOWN_PLAYER', 'No such player.');
  return removeSeat(table, target, version, emit, ctx, 'player_kicked');
}

function updateSettings(
  table: Table,
  playerId: string,
  patch: TableSettingsInput,
  version: number,
  emit: Emit,
  ctx: TableContext,
): CommandResult {
  if (playerId !== table.hostId) fail('NOT_HOST', 'Only the host can change the settings.');
  if (table.phase !== 'lobby') fail('WRONG_PHASE', 'The settings are frozen once the game starts.');
  const { rules: currentRules, rulesBase: currentBase, ...current } = table.settings;
  const rulesBase = patch.rulesBase ?? currentBase;
  const merged: TableSettingsInput = {
    ...current,
    ...patch,
    rulesBase,
    // A new base preset starts from its own values; otherwise the host's overrides carry on.
    rules:
      patch.rulesBase && patch.rulesBase !== currentBase
        ? patch.rules
        : { ...currentRules, ...patch.rules },
  };
  if (merged.endCondition !== 'round-limit') delete merged.roundLimit;
  const settings = normalizeTableSettings(merged, gameSetsOf(ctx));
  if (settings.maxSeats < table.players.length) {
    fail('INVALID_SETTINGS', 'maxSeats cannot be lower than the number of players already seated.');
  }
  return {
    table: {
      ...table,
      version,
      settings,
      // A changed table has to be agreed to again.
      players: table.players.map((p) => ({ ...p, ready: p.id === table.hostId })),
    },
    events: [emit('settings_updated', playerId)],
  };
}

function start(
  table: Table,
  playerId: string,
  version: number,
  emit: Emit,
  ctx: TableContext,
): CommandResult {
  if (playerId !== table.hostId) fail('NOT_HOST', 'Only the host can start the game.');
  if (table.phase !== 'lobby') fail('WRONG_PHASE', 'The game has already started.');
  if (table.players.length < TABLE_MIN_SEATS) {
    fail('NOT_ENOUGH_PLAYERS', `At least ${TABLE_MIN_SEATS} players are needed.`);
  }
  if (table.players.some((p) => !p.ready)) fail('NOT_READY', 'Everyone has to be ready first.');
  if (table.settings.professions === 'unique') {
    const pool = gameSetOf(table, ctx).professions.length;
    if (table.players.length > pool) {
      fail('INVALID_SETTINGS', `Unique professions allow at most ${pool} players.`);
    }
  }
  const events: TableEvent[] = [];
  if (table.settings.professions === 'random') {
    return reveal({ ...table, version }, version, events, emit, ctx);
  }
  events.push(emit('picking_started', playerId));
  return {
    table: {
      ...table,
      version,
      phase: 'picking',
      players: table.players.map((p) => ({ ...p, pick: null })),
    },
    events,
  };
}

function gameSetOf(table: Table, ctx: TableContext): CashflowGameSet {
  const gameSet = gameSetsOf(ctx).find((candidate) => candidate.id === table.settings.gameSetId);
  if (!gameSet) fail('INVALID_SETTINGS', `Unknown game set '${table.settings.gameSetId}'.`);
  return gameSet as CashflowGameSet;
}

function pick(
  table: Table,
  playerId: string,
  professionId: string,
  version: number,
  emit: Emit,
  ctx: TableContext,
): CommandResult {
  if (table.phase !== 'picking') fail('WRONG_PHASE', 'Professions are not being picked now.');
  if (professionId !== 'random') {
    const known = gameSetOf(table, ctx).professions.some((p) => p.id === professionId);
    if (!known) fail('UNKNOWN_PROFESSION', `Unknown profession '${professionId}'.`);
    const unique = table.settings.professions === 'unique';
    if (unique && table.players.some((p) => p.id !== playerId && p.pick === professionId)) {
      fail('PROFESSION_TAKEN', 'Another player already picked that profession.');
    }
  }
  const players = table.players.map((p) => (p.id === playerId ? { ...p, pick: professionId } : p));
  // Duplicates are picked in secret until the reveal; only a unique table shows who took what.
  const data = table.settings.professions === 'unique' ? { professionId } : undefined;
  const events: TableEvent[] = [emit('profession_picked', playerId, data)];
  const next: Table = { ...table, version, players };
  if (players.every((p) => p.pick !== null)) return reveal(next, version, events, emit, ctx);
  return { table: next, events };
}

function close(table: Table, playerId: string, version: number, emit: Emit): CommandResult {
  if (playerId !== table.hostId) fail('NOT_HOST', 'Only the host can close the table.');
  if (table.phase === 'finished' || table.phase === 'abandoned') {
    fail('WRONG_PHASE', 'The table is already over.');
  }
  return {
    table: { ...table, version, phase: 'abandoned' },
    events: [emit('table_closed', playerId, { reason: 'host' })],
  };
}

// ── Playing ────────────────────────────────────────────────────────────────────────────────────────

const EVENT_FOR_MOVE: Record<MoveCommand['type'], TableEventType> = {
  roll: 'rolled',
  draw_card: 'card_drawn',
  pass_card: 'card_passed',
  buy_deal: 'card_played',
  pay_doodad: 'card_played',
  roll_decision: 'dice_decided',
  sell_position: 'position_sold',
  bank_loan: 'loan_changed',
};

/**
 * One move of the solo game by a seated player. The active player plays their turn (roll, the card of the space, loans);
 * selling is open to every seated player at any time the rules allow it (JFK, 2026-10-14: "everybody can sell always, if
 * able"). The move is the solo rule over that player's own books; afterwards the table settles - who escaped or went
 * bankrupt, whether the game is over, whether the turn moves on.
 */
function play(
  table: Table,
  playerId: string,
  command: MoveCommand,
  version: number,
  ctx: TableContext,
  options: { internal?: boolean } = {},
): CommandResult {
  if (table.phase !== 'playing') fail('WRONG_PHASE', 'The game is not being played now.');
  const player = table.players.find((p) => p.id === playerId);
  if (!player || !player.books) fail('NOT_A_MEMBER', 'You are not at this table.');
  const me = player as TablePlayer & { books: NonNullable<TablePlayer['books']> };
  if (me.status !== 'active') fail('ILLEGAL_MOVE', 'You have left this game.');
  if (currentTurn(me.books.state).phase === 'over') {
    fail('ILLEGAL_MOVE', 'You are out of the game.');
  }
  const now = nowOf(ctx);
  if (!options.internal) {
    // A paused game accepts no move; the active player's own moves must come in time (the server plays for them otherwise).
    const blocked = whyClockBlocks(table, now);
    if (blocked?.code === 'PAUSED') fail('PAUSED', blocked.message);
    if (blocked && command.type !== 'sell_position' && table.activePlayerId === playerId) {
      fail(blocked.code, blocked.message);
    }
  }
  if (command.type !== 'sell_position' && table.activePlayerId !== playerId) {
    fail('NOT_YOUR_TURN', 'It is not your turn.');
  }
  const profession = gameSetOf(table, ctx).professions.find((p) => p.id === me.professionId);
  if (!profession) fail('UNKNOWN_PROFESSION', 'This player has no profession.');

  const played = runPlan(
    table,
    playerId,
    (books, rng) => planMove(command, books, { ...ctx, rng }, profession as CashflowProfession),
    { openOfferWindow: command.type === 'sell_position' },
  );
  const events: TableEvent[] = [
    event(ctx, version, EVENT_FOR_MOVE[command.type], playerId, {
      ...(command.type === 'buy_deal' || command.type === 'pay_doodad'
        ? { action: command.type }
        : {}),
      ...(played.plan.result ?? {}),
    }),
  ];
  let current = played.table;
  const spread = (drawerId: string) => {
    const wide = tableWideCard(current, drawerId, ctx);
    current = wide.table;
    events.push(...wide.events.map((e) => event(ctx, version, e.type, e.playerId, e.data)));
  };
  if (command.type === 'draw_card') spread(playerId);
  // A Market space is not a choice: its card is drawn and read out at once, for the whole table.
  const pending = current.players.find((p) => p.id === playerId)?.books?.state.turn?.pending;
  if (command.type === 'roll' && pending?.kind === 'market' && !pending.offered) {
    // The dice-first rule: a dice decision the roll opened (a kept card's Payday roll) is rolled before the card of the space.
    for (let guard = 0; guard < 8; guard += 1) {
      const open = current.players.find((p) => p.id === playerId)?.books?.state;
      if (!open || openDecisions(open).length === 0) break;
      const decided = runPlan(current, playerId, (books, rng) =>
        rollDecisionAction(books, {}, { ...ctx, rng }),
      );
      current = decided.table;
      events.push(
        event(ctx, version, 'dice_decided', playerId, { ...(decided.plan.result ?? {}) }),
      );
    }
    const drawn = runPlan(current, playerId, (books, rng) =>
      drawCardAction(books, { deck: 'market' }, { ...ctx, rng }),
    );
    current = drawn.table;
    events.push(event(ctx, version, 'card_drawn', playerId, { ...(drawn.plan.result ?? {}) }));
    spread(playerId);
  }
  // Doing anything on their own turn shows the player is here.
  if (!options.internal && table.activePlayerId === playerId) {
    current = resetTimeouts(current, playerId);
    if (me.away) {
      current = mapPlayerIn(current, playerId, (p) => ({ ...p, away: false }));
      events.push(event(ctx, version, 'player_returned', playerId));
    }
  }
  const rolled = current.turnRolled || command.type === 'roll';
  const next = settleTable(
    { ...current, version, turnRolled: rolled },
    (type, who, data) => events.push(event(ctx, version, type, who, data)),
    now,
  );
  return { table: next, events };
}

function mapPlayerIn(table: Table, playerId: string, fn: (p: TablePlayer) => TablePlayer): Table {
  return { ...table, players: table.players.map((p) => (p.id === playerId ? fn(p) : p)) };
}

// ── The clock ──────────────────────────────────────────────────────────────────────────────────────

/** Plays the most passive turn for `who` (see passive.ts), as moves of their own that no clock can refuse. */
function passiveTurn(table: Table, who: string, version: number, ctx: TableContext): CommandResult {
  let current = table;
  const events: TableEvent[] = [];
  for (let step = 0; step < 24; step += 1) {
    const command = nextPassiveCommand(current, who);
    if (!command || current.activePlayerId !== who || !isMoveCommand(command)) break;
    const result = play(current, who, command, version, ctx, { internal: true });
    current = result.table;
    events.push(...result.events);
  }
  return { table: { ...current, version }, events };
}

/**
 * While the player on the move is away, their turn is played at once so nobody waits for them. If everyone left in the game
 * is away, nobody is here to play: the table is closed instead of playing itself out.
 */
function runAwayTurns(result: CommandResult, version: number, ctx: TableContext): CommandResult {
  let { table } = result;
  const events = [...result.events];
  for (let guard = 0; guard < table.players.length * 2 + 2; guard += 1) {
    if (table.phase !== 'playing') break;
    const active = table.players.find((p) => p.id === table.activePlayerId);
    if (!active?.away) break;
    if (table.players.filter(isAlive).every((p) => p.away)) {
      table = { ...stopClock(table), phase: 'abandoned', activePlayerId: null };
      events.push(event(ctx, version, 'table_closed', null, { reason: 'everyone_away' }));
      break;
    }
    const turn = passiveTurn(table, active.id, version, ctx);
    table = turn.table;
    events.push(...turn.events);
  }
  return { table, events };
}

/**
 * The active player's time is up (the server calls this when `nextDeadline(table)` passes): the most passive legal turn is
 * played for them. After `awayAfterTimeouts` timeouts in a row they are marked away. Throws `NOT_DUE` when nobody is out of time.
 */
export function applyTimeout(table: Table, ctx: TableContext): CommandResult {
  if (table.phase !== 'playing') fail('WRONG_PHASE', 'The game is not being played now.');
  if (!isDue(table, nowOf(ctx))) fail('NOT_DUE', 'Nobody is out of time.');
  const who = table.activePlayerId as string;
  const version = table.version + 1;
  const counted = countTimeout(table, who);
  const events: TableEvent[] = [event(ctx, version, 'turn_timeout', who, { count: counted.count })];
  const turn = passiveTurn(counted.table, who, version, ctx);
  let current = turn.table;
  events.push(...turn.events);
  const timedOut = current.players.find((p) => p.id === who);
  if (timedOut && !timedOut.away && counted.count >= current.settings.awayAfterTimeouts) {
    current = mapPlayerIn(current, who, (p) => ({ ...p, away: true }));
    events.push(event(ctx, version, 'player_away', who, { timeouts: counted.count }));
  }
  return runAwayTurns({ table: current, events }, version, ctx);
}

function pauseOrResume(
  table: Table,
  playerId: string,
  kind: 'pause' | 'resume',
  version: number,
  emit: Emit,
  ctx: TableContext,
): CommandResult {
  if (playerId !== table.hostId) fail('NOT_HOST', 'Only the host can pause the game.');
  if (table.phase !== 'playing') fail('WRONG_PHASE', 'The game is not being played now.');
  const now = nowOf(ctx);
  const next = kind === 'pause' ? pauseClock(table, now) : resumeClock(table, now);
  return {
    table: { ...next, version },
    events: [emit(kind === 'pause' ? 'paused' : 'resumed', playerId)],
  };
}

/** An away player says they are here again: from their next turn on they play for themselves. */
function back(table: Table, playerId: string, version: number, emit: Emit): CommandResult {
  if (table.phase !== 'playing') fail('WRONG_PHASE', 'The game is not being played now.');
  const me = table.players.find((p) => p.id === playerId);
  if (!me?.away) fail('WRONG_PHASE', 'You are not away.');
  const next = resetTimeouts(
    mapPlayerIn(table, playerId, (p) => ({ ...p, away: false })),
    playerId,
  );
  return { table: { ...next, version }, events: [emit('player_returned', playerId)] };
}

/**
 * What a card just drawn does beyond the drawer (T4): a Market card takes effect for every player at once; a stock card moves
 * the share's price for every other holder. Other cards are the drawer's alone.
 */
function tableWideCard(
  table: Table,
  drawerId: string,
  ctx: TableContext,
): { table: Table; events: Pick<TableEvent, 'type' | 'playerId' | 'data'>[] } {
  const offered = table.players.find((p) => p.id === drawerId)?.books?.state.turn?.pending?.offered;
  if (!offered) return { table, events: [] };
  const gameSet = gameSetOf(table, ctx);
  if (offered.deck === 'market') {
    const card = gameSet.decks?.market?.find((c) => c.id === offered.cardId);
    const wide = playMarketForTable(table, drawerId, offered.cardId, ctx);
    return {
      table: wide.table,
      events: [
        {
          type: 'market_card_played',
          playerId: drawerId,
          data: { cardId: offered.cardId, kind: card ? marketCardKind(card) : 'text' },
        },
        ...wide.effects.map((e) => ({
          type: 'market_effect' as const,
          playerId: e.playerId,
          data: { kind: e.kind, ...e.detail },
        })),
      ],
    };
  }
  const deal = gameSet.decks?.[offered.deck]?.find((c) => c.id === offered.cardId) as
    CashflowDealCard | undefined;
  if ((offered.deck === 'dealSmall' || offered.deck === 'dealBig') && deal?.assetKind === 'share') {
    const wide = movePriceForHolders(table, drawerId, deal, ctx);
    return {
      table: wide.table,
      events: wide.effects.map((e) => ({
        type: 'market_effect' as const,
        playerId: e.playerId,
        data: { kind: e.kind, ...e.detail },
      })),
    };
  }
  return { table, events: [] };
}

// ── Starting play ──────────────────────────────────────────────────────────────────────────────────

/** One player's starting books - the profession's savings, subscriptions and starting positions - never an account's. */
function startingBooks(
  gameSet: CashflowGameSet,
  professionId: string,
  table: Table,
  ctx: TableContext,
): GameBooks {
  const blank: GameBooks = {
    state: initialCashflowGameState(),
    allocation: { daily: 60, splurge: 10, smile: 10, fire: 20 },
    gameSet,
    subscriptions: [],
    transactions: [],
    liabilities: [],
    shares: [],
    investments: [],
    assets: [],
    growProjects: [],
  };
  const plan = startGameAction(
    blank,
    {
      gameSetId: gameSet.id,
      professionId,
      mode: 'solo',
      rules: table.settings.rules,
    },
    { clock: ctx.clock, text: ctx.text },
    gameSetsOf(ctx),
  );
  return plan.effects.reduce(applyEffectsToBooks, blank);
}

/** Resolves every pick (random ones from the table's stream, in seat order), fixes the turn order, deals the books, and starts play. */
function reveal(
  table: Table,
  version: number,
  events: TableEvent[],
  emit: Emit,
  ctx: TableContext,
): CommandResult {
  const gameSet = gameSetOf(table, ctx);
  const stream = tableRng(table.rngState);
  const unique = table.settings.professions === 'unique';
  const taken = new Set(
    unique ? table.players.flatMap((p) => (p.pick && p.pick !== 'random' ? [p.pick] : [])) : [],
  );

  const professionOf = new Map<string, string>();
  for (const player of table.players) {
    if (player.pick && player.pick !== 'random') {
      professionOf.set(player.id, player.pick);
      continue;
    }
    const pool = gameSet.professions.filter((p) => !(unique && taken.has(p.id)));
    const chosen = pickOne(pool, stream.rng).id;
    taken.add(chosen);
    professionOf.set(player.id, chosen);
  }

  const seatOrder = table.players.map((p) => p.id);
  const order = table.settings.turnOrder === 'random' ? shuffled(seatOrder, stream.rng) : seatOrder;
  const players = table.players.map((player) => {
    const professionId = professionOf.get(player.id) as string;
    return {
      ...player,
      professionId,
      books: startingBooks(gameSet, professionId, table, ctx),
    };
  });
  const nameOf = (id: string) => players.find((p) => p.id === id)?.name as string;

  const started: Table = {
    ...table,
    version,
    phase: 'playing',
    players,
    order,
    activePlayerId: order[0],
    tableRound: 1,
    rngState: stream.state(),
  };
  return {
    table: startTurnClock(initClock(started), order[0], nowOf(ctx)),
    events: [
      ...events,
      emit('professions_revealed', null, {
        picks: players.map((p) => ({ player: p.name, professionId: p.professionId })),
      }),
      emit('play_started', null, { order: order.map(nameOf) }),
    ],
  };
}
