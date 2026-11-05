import { harvestWaiting } from './harvest-ack';
import { loggedRng, rollDie } from '../../rng';
import { quoteEmergency } from '../../emergency-deck';
import { defaultTableGameSets } from '../../table/default-game-sets';
import { driftMarkets, drawHarvestCard, initialMarkets } from '../../harvest';
import { normalizeCustomRules } from '../../custom-rules';
import type { Rng } from '../../rng';
import { cleanInitials } from '../../table/reducer';
import {
  countTimeout,
  endTurnClock,
  initClock,
  pauseClock,
  resetTimeouts,
  resumeClock,
  startTurnClock,
  stopClock,
  whyClockBlocks,
} from '../../table/clock';
import { shuffled, tableRng } from '../../table/table-rng';
import {
  PLAYER_NAME_MAX,
  TABLE_COLORS,
  TableCommandError,
  type Table,
  type TableErrorCode,
} from '../../table/types';
import { canOffer, projectTitleOf } from '../../opportunity';
import { DreamPlayer } from '../player';
import { splitDreamBotId } from './bot-levels';
import { normalizeDreamSettings } from './settings';
import { goalsOf, isWon, rankStandings, standingOf } from './scoring';
import {
  DREAM_TABLE_MIN_SEATS,
  type DreamCommand,
  type DreamEvent,
  type DreamEventType,
  type DreamSeat,
  type DreamSettingsInput,
  type DreamTable,
} from './types';

/**
 * The pure rules of a Dreamfund table (todo/dreamfund-multiplayer.md, slice 2): `createDreamTable` and `applyDreamCommand`, the classic
 * table's flow for the Dreamfund game. A command either returns the new table and the events it made, or throws a
 * `TableCommandError` and changes nothing. A table is plain data: a player's life is stored as data (`DreamPlayerData`) and woken up
 * with the table's dice for the length of one command.
 */

export interface DreamContext {
  clock: { nowIso(): string };
}

export interface DreamCommandResult {
  table: DreamTable;
  events: DreamEvent[];
}

const base = () => defaultTableGameSets().find((set) => set.id === 'jfk-stories')!;

/** The characters a table offers: the Normal version of each (Easy and Hard are the table's difficulty). */
export const dreamCharacterIds = (): string[] =>
  base()
    .professions.filter((profession) => !profession.variantOf)
    .map((profession) => profession.id);

const nowOf = (ctx: DreamContext) => Date.parse(ctx.clock.nowIso());

function fail(code: TableErrorCode, message: string): never {
  throw new TableCommandError(code, message);
}

type Emit = (type: DreamEventType, who: string | null, data?: Record<string, unknown>) => void;

// The classic clock's helpers only read the fields the two tables share.
type Shared = DreamTable;
const asClassic = (table: Shared) => table as unknown as Table;
const fromClassic = (table: Table, like: Shared): Shared => ({
  ...like,
  ...(table as unknown as Shared),
});

const clockOf = {
  init: (t: Shared) => fromClassic(initClock(asClassic(t)), t),
  start: (t: Shared, id: string, now: number) =>
    fromClassic(startTurnClock(asClassic(t), id, now), t),
  end: (t: Shared, id: string, now: number) => fromClassic(endTurnClock(asClassic(t), id, now), t),
  stop: (t: Shared) => fromClassic(stopClock(asClassic(t)), t),
  pause: (t: Shared, now: number) => fromClassic(pauseClock(asClassic(t), now), t),
  resume: (t: Shared, now: number) => fromClassic(resumeClock(asClassic(t), now), t),
  reset: (t: Shared, id: string) => fromClassic(resetTimeouts(asClassic(t), id), t),
};

// ── Creating a table ─────────────────────────────────────────────────────────────────────────────

export interface CreateDreamTableInput {
  id: string;
  hostId: string;
  hostName: string;
  hostColor?: string;
  hostInitials?: string;
  settings: DreamSettingsInput;
  /** The server's secret seed: the map and the dice start here. */
  seed: number;
}

function cleanName(raw: unknown): string {
  const name = typeof raw === 'string' ? raw.trim() : '';
  if (name.length < 1 || name.length > PLAYER_NAME_MAX) {
    fail('INVALID_NAME', `A name must be 1 to ${PLAYER_NAME_MAX} characters.`);
  }
  return name;
}

function pickColor(players: readonly DreamSeat[], wanted?: string): string {
  const taken = new Set(players.map((p) => p.color));
  if (wanted) {
    if (!TABLE_COLORS.includes(wanted)) fail('COLOR_TAKEN', 'That is not a seat colour.');
    if (taken.has(wanted)) fail('COLOR_TAKEN', 'That colour is taken.');
    return wanted;
  }
  return TABLE_COLORS.find((color) => !taken.has(color)) ?? TABLE_COLORS[0];
}

function uniqueName(table: DreamTable, name: string): string {
  const taken = new Set(table.players.map((p) => p.name.toLowerCase()));
  if (!taken.has(name.toLowerCase())) return name;
  for (let n = 2; ; n += 1) {
    const candidate = `${name} (${n})`;
    if (!taken.has(candidate.toLowerCase())) return candidate;
  }
}

const newSeat = (id: string, name: string, color: string, initials?: string): DreamSeat => ({
  id,
  name,
  color,
  ...(initials ? { initials } : {}),
  ready: false,
  pick: null,
  professionId: null,
  status: 'active',
  away: false,
  life: null,
  pending: null,
  harvest: null,
  reached: {},
});

export function createDreamTable(
  input: CreateDreamTableInput,
  ctx: DreamContext,
): DreamCommandResult {
  const settings = normalizeDreamSettings(input.settings, dreamCharacterIds().length);
  const host = {
    ...newSeat(
      input.hostId,
      cleanName(input.hostName),
      pickColor([], input.hostColor),
      cleanInitials(input.hostInitials),
    ),
    ready: true,
  };
  const table: DreamTable = {
    kind: 'dreamfund',
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
    harvestDeck: null,
    trade: null,
    markets: initialMarkets(),
    seed: input.seed >>> 0,
    rngState: input.seed >>> 0,
    createdAt: ctx.clock.nowIso(),
  };
  return {
    table,
    events: [
      {
        version: 1,
        at: ctx.clock.nowIso(),
        type: 'table_created',
        playerId: host.id,
        data: { name: settings.name },
      },
    ],
  };
}

// ── Commands ──────────────────────────────────────────────────────────────────────────────────────

const PLAY_COMMANDS = new Set<DreamCommand['type']>([
  'roll',
  'pay_emergency',
  'emergency_choose',
  'emergency_roll',
  'emergency_reroll',
  'answer_life',
  'choose_career_branch',
  'take_dream',
  'choose_pile',
  'take_opportunity',
  'plan_opportunity',
  'buy_planned',
  'roll_opportunity',
  'throw_job_search',
  'debug_load',
  'debug_payday',
  'debug_career',
  'skip',
  'end_turn',
  'fund_reserve',
  'edit_transaction',
  'edit_subscription',
  'set_phase',
  'fund_dream',
  'repay_debt',
  'repay_bank_loan',
  'fund_emergency',
  'set_insurance',
  'set_plan',
  'settle_payday',
  'sell_holding',
  'harvest_continue',
  'harvest_sell',
  'harvest_accept',
  'harvest_ladder',
]);

export function applyDreamCommand(
  table: DreamTable,
  playerId: string,
  command: DreamCommand,
  ctx: DreamContext,
): DreamCommandResult {
  const me = table.players.find((player) => player.id === playerId);
  if (command.type !== 'join' && !me) fail('NOT_A_MEMBER', 'You are not at this table.');
  if (me && me.status === 'left' && table.phase === 'playing') {
    fail('NOT_A_MEMBER', 'You have left this game.');
  }
  const version = table.version + 1;
  const events: DreamEvent[] = [];
  const emit: Emit = (type, who, data) =>
    events.push({
      version,
      at: ctx.clock.nowIso(),
      type,
      playerId: who,
      ...(data ? { data } : {}),
    });
  let next: DreamTable;
  if (TRADE_COMMANDS.has(command.type)) {
    next = trade(table, playerId, command, ctx, emit);
  } else if (table.briefing && command.type === 'set_insurance') {
    next = briefingInsurance(table, playerId, command);
  } else if (PLAY_COMMANDS.has(command.type)) {
    next = play(table, playerId, command, ctx, emit, false);
  } else {
    next = lobbyCommand(table, playerId, command, ctx, emit);
  }
  next = { ...next, version };
  next = runAwayTurns(next, ctx, emit);
  return { table: next, events };
}

function lobbyCommand(
  table: DreamTable,
  playerId: string,
  command: DreamCommand,
  ctx: DreamContext,
  emit: Emit,
): DreamTable {
  switch (command.type) {
    case 'join': {
      if (table.players.some((p) => p.id === playerId)) {
        fail('ALREADY_JOINED', 'You are already at this table.');
      }
      if (table.phase !== 'lobby') fail('WRONG_PHASE', 'The game has already started.');
      if (table.players.length >= table.settings.maxSeats) fail('TABLE_FULL', 'The table is full.');
      const name = uniqueName(table, cleanName(command.name));
      const seat = newSeat(
        playerId,
        name,
        pickColor(table.players, command.color),
        cleanInitials(command.initials),
      );
      emit('player_joined', playerId, { name, color: seat.color });
      return { ...table, players: [...table.players, seat] };
    }
    case 'add_bot': {
      if (playerId !== table.hostId) fail('NOT_HOST', 'Only the host can seat a bot.');
      if (table.phase !== 'lobby') fail('WRONG_PHASE', 'The game has already started.');
      if (table.players.length >= table.settings.maxSeats) fail('TABLE_FULL', 'The table is full.');
      if (!splitDreamBotId(command.policyId)) {
        fail('UNKNOWN_COMMAND', `Unknown bot strategy or level '${command.policyId}'.`);
      }
      if (command.professionId && !dreamCharacterIds().includes(command.professionId)) {
        fail('UNKNOWN_PROFESSION', `Unknown character '${command.professionId}'.`);
      }
      const n = table.players.filter((p) => p.bot).length + 1;
      const id = `bot:${n}`;
      const seat: DreamSeat = {
        ...newSeat(
          id,
          uniqueName(table, cleanName(command.name)),
          pickColor(table.players, command.color),
        ),
        ready: true,
        bot: {
          policyId: command.policyId,
          ...(command.professionId ? { professionId: command.professionId } : {}),
        },
      };
      emit('bot_added', id, { name: seat.name, policyId: command.policyId });
      return { ...table, players: [...table.players, seat] };
    }
    case 'set_ready': {
      if (table.phase !== 'lobby') fail('WRONG_PHASE', 'The game has already started.');
      emit('ready_changed', playerId, { ready: command.ready });
      return {
        ...table,
        players: table.players.map((p) => (p.id === playerId ? { ...p, ready: command.ready } : p)),
      };
    }
    case 'kick': {
      if (playerId !== table.hostId) fail('NOT_HOST', 'Only the host can remove a player.');
      if (table.phase !== 'lobby') fail('WRONG_PHASE', 'The game has already started.');
      if (command.target === table.hostId) fail('CANNOT_KICK_HOST', 'The host cannot be removed.');
      if (!table.players.some((p) => p.id === command.target)) {
        fail('UNKNOWN_PLAYER', 'There is nobody with that id at the table.');
      }
      emit('player_kicked', command.target);
      return { ...table, players: table.players.filter((p) => p.id !== command.target) };
    }
    case 'leave':
      return leave(table, playerId, emit, ctx);
    case 'update_settings': {
      if (playerId !== table.hostId) fail('NOT_HOST', 'Only the host can change the settings.');
      if (table.phase !== 'lobby')
        fail('WRONG_PHASE', 'The settings are frozen once the game starts.');
      const merged = normalizeDreamSettings(
        {
          ...table.settings,
          ...command.settings,
          customRules: { ...table.settings.customRules, ...(command.settings.customRules ?? {}) },
        },
        dreamCharacterIds().length,
      );
      if (table.players.length > merged.maxSeats) {
        fail('INVALID_SETTINGS', 'There are more players at the table than that.');
      }
      emit('settings_updated', playerId);
      return { ...table, settings: merged };
    }
    case 'start':
      return start(table, playerId, ctx, emit);
    case 'pick_profession':
      return changeCharacter(table, playerId, command.professionId, emit);
    case 'confirm_briefing':
      return confirmBriefing(table, playerId, ctx, emit);
    case 'close': {
      if (playerId !== table.hostId) fail('NOT_HOST', 'Only the host can close the table.');
      if (table.phase === 'finished' || table.phase === 'abandoned') {
        fail('WRONG_PHASE', 'The table is already over.');
      }
      emit('table_closed', playerId, { reason: 'host' });
      return { ...clockOf.stop(table), phase: 'abandoned', activePlayerId: null };
    }
    case 'pause':
    case 'resume': {
      if (playerId !== table.hostId) fail('NOT_HOST', 'Only the host can pause the game.');
      if (table.phase !== 'playing') fail('WRONG_PHASE', 'The game is not being played now.');
      const now = nowOf(ctx);
      const pausing = command.type === 'pause';
      if (pausing === (table.clock.pausedAt !== null)) {
        fail('WRONG_PHASE', pausing ? 'It is paused already.' : 'It is not paused.');
      }
      emit(pausing ? 'paused' : 'resumed', playerId);
      return pausing ? clockOf.pause(table, now) : clockOf.resume(table, now);
    }
    case 'away': {
      emit('player_away', playerId);
      return mapSeat(table, playerId, (p) => ({ ...p, away: true }));
    }
    case 'back': {
      emit('player_returned', playerId);
      return clockOf.reset(
        mapSeat(table, playerId, (p) => ({ ...p, away: false })),
        playerId,
      );
    }
    default:
      return fail('UNKNOWN_COMMAND', 'Unknown table command.');
  }
}

function mapSeat(table: DreamTable, id: string, fn: (p: DreamSeat) => DreamSeat): DreamTable {
  return { ...table, players: table.players.map((p) => (p.id === id ? fn(p) : p)) };
}

function leave(table: DreamTable, playerId: string, emit: Emit, ctx: DreamContext): DreamTable {
  if (table.phase === 'lobby' || table.phase === 'picking') {
    if (playerId === table.hostId) {
      const heir = table.players.find((p) => p.id !== playerId && !p.bot);
      if (!heir) {
        emit('table_closed', playerId, { reason: 'host_left' });
        return { ...table, phase: 'abandoned' };
      }
      emit('host_changed', heir.id);
      emit('player_left', playerId);
      return { ...table, hostId: heir.id, players: table.players.filter((p) => p.id !== playerId) };
    }
    emit('player_left', playerId);
    return { ...table, players: table.players.filter((p) => p.id !== playerId) };
  }
  if (table.phase !== 'playing') fail('WRONG_PHASE', 'The game is over.');
  emit('player_left', playerId);
  let next = mapSeat(table, playerId, (p) => ({
    ...p,
    status: 'left',
    leftRound: table.tableRound,
  }));
  if (next.activePlayerId === playerId) next = advance(next, ctx, emit);
  return checkEnd(next, emit) ?? next;
}

// ── Starting ──────────────────────────────────────────────────────────────────────────────────────

function start(table: DreamTable, playerId: string, ctx: DreamContext, emit: Emit): DreamTable {
  if (playerId !== table.hostId) fail('NOT_HOST', 'Only the host can start the game.');
  if (table.phase !== 'lobby') fail('WRONG_PHASE', 'The game has already started.');
  if (table.players.length < DREAM_TABLE_MIN_SEATS) {
    fail('NOT_ENOUGH_PLAYERS', `At least ${DREAM_TABLE_MIN_SEATS} players are needed.`);
  }
  if (table.players.some((p) => !p.ready)) fail('NOT_READY', 'Everyone has to be ready first.');
  const characters = dreamCharacterIds();
  if (table.settings.professions === 'unique' && table.players.length > characters.length) {
    fail('INVALID_SETTINGS', `Unique characters allow at most ${characters.length} players.`);
  }
  // everybody is dealt a character (a bot its own); each reads theirs first and may change it there - no picking in the lobby
  return reveal(
    {
      ...table,
      players: table.players.map((p) => ({
        ...p,
        pick:
          p.bot && table.settings.professions !== 'unique'
            ? (p.bot.professionId ?? 'random')
            : 'random',
      })),
    },
    ctx,
    emit,
  );
}

/** Everybody has chosen: the characters are settled, every life is begun and play starts. */
function reveal(table: DreamTable, ctx: DreamContext, emit: Emit): DreamTable {
  const rng = tableRng(table.rngState);
  const characters = dreamCharacterIds();
  const taken = new Set<string>();
  const unique = table.settings.professions === 'unique';
  if (unique) for (const p of table.players) if (p.pick && p.pick !== 'random') taken.add(p.pick);
  const settle = (seat: DreamSeat): string => {
    if (seat.pick && seat.pick !== 'random') return seat.pick;
    const pool = unique ? characters.filter((id) => !taken.has(id)) : characters;
    const chosen = shuffled(pool, rng.rng)[0];
    taken.add(chosen);
    return chosen;
  };
  const players = table.players.map((seat, index): DreamSeat => {
    const professionId = settle(seat);
    const life = new DreamPlayer({
      rng: rng.rng,
      seed: table.settings.layoutSeed || table.seed,
      // the Yin Yang map has two tracks: the seats take them in turn, white first (three players: two white, one black)
      lane: index % 2,
      professionId,
      shape: table.settings.shape,
      size: table.settings.size,
      dreamTiles: (table.settings.dreamPoints ?? 0) > 0,
      rules: table.settings.customRules,
      sharedMarkets: true,
    }).snapshot();
    return {
      ...seat,
      professionId,
      life,
      pending: null,
      harvest: null,
      reached: {},
      briefed: !!seat.bot,
    };
  });
  const order =
    table.settings.turnOrder === 'random'
      ? shuffled(
          players.map((p) => p.id),
          rng.rng,
        )
      : players.map((p) => p.id);
  emit('professions_revealed', null, {
    professions: Object.fromEntries(players.map((p) => [p.id, p.professionId])),
  });
  const next: DreamTable = {
    ...table,
    phase: 'playing',
    players,
    order,
    activePlayerId: null,
    tableRound: 1,
    turnRolled: false,
    briefing: true,
    markets: initialMarkets(),
    rngState: rng.state(),
  };
  // everybody reads who they are first; a table of bots begins at once
  return players.every((seat) => seat.briefed) ? beginPlay(next, ctx, emit) : next;
}

/** Everybody who has not yet read their character says so (a test, a simulation or a table of bots begins at once). */
export function briefAll(table: DreamTable, ctx: DreamContext): DreamTable {
  let current = table;
  for (const seat of table.players) {
    if (current.briefing && !seat.briefed) {
      current = applyDreamCommand(current, seat.id, { type: 'confirm_briefing' }, ctx).table;
    }
  }
  return current;
}

/** Every player knows their character: the game begins with the first turn. */
function beginPlay(table: DreamTable, ctx: DreamContext, emit: Emit): DreamTable {
  const first = table.order[0];
  emit('play_started', null, { order: table.order });
  let next: DreamTable = { ...table, briefing: false, activePlayerId: first };
  next = clockOf.init(next);
  next = clockOf.start(next, first, nowOf(ctx));
  emit('round_started', null, { round: 1 });
  emit('turn_started', first);
  return next;
}

/** The player has read their character: the game begins when everybody has. */
function confirmBriefing(
  table: DreamTable,
  playerId: string,
  ctx: DreamContext,
  emit: Emit,
): DreamTable {
  if (table.phase !== 'playing' || !table.briefing) {
    fail('WRONG_PHASE', 'The game has begun already.');
  }
  const next = mapSeat(table, playerId, (seat) => ({ ...seat, briefed: true }));
  return next.players.every((seat) => seat.briefed || seat.status === 'left')
    ? beginPlay(next, ctx, emit)
    : next;
}

/**
 * The player changes the character they were dealt, while they are still reading it (JFK, 2026-11-04): a new life of the character
 * asked for - or a drawn one - takes its place; the insurances start again. Not at a table where the characters are drawn, not with a
 * character another player holds at a table of unique characters, and not once the player has said they are ready.
 */
function changeCharacter(
  table: DreamTable,
  playerId: string,
  professionId: string,
  emit: Emit,
): DreamTable {
  if (table.phase !== 'playing' || !table.briefing) {
    fail('WRONG_PHASE', 'The game has begun: the character cannot be changed now.');
  }
  if (table.settings.professions === 'random') {
    fail('ILLEGAL_MOVE', 'At this table the characters are drawn.');
  }
  const seat = seatOf(table, playerId);
  if (seat.briefed) fail('ILLEGAL_MOVE', 'You said you are ready: go back first.');
  const characters = dreamCharacterIds();
  const unique = table.settings.professions === 'unique';
  const rng = tableRng(table.rngState);
  const held = new Set(
    table.players.filter((p) => p.id !== playerId && p.professionId).map((p) => p.professionId),
  );
  let chosen = professionId;
  if (professionId === 'random') {
    const pool = characters.filter((id) => id !== seat.professionId && !(unique && held.has(id)));
    chosen = shuffled(pool.length > 0 ? pool : characters, rng.rng)[0];
  } else if (!characters.includes(professionId)) {
    fail('UNKNOWN_PROFESSION', `Unknown character '${professionId}'.`);
  } else if (unique && held.has(professionId)) {
    fail('PROFESSION_TAKEN', 'Another player already holds that character.');
  }
  const life = new DreamPlayer({
    rng: rng.rng,
    seed: table.settings.layoutSeed || table.seed,
    lane: Math.max(0, table.players.indexOf(seat)) % 2,
    professionId: chosen,
    shape: table.settings.shape,
    size: table.settings.size,
    dreamTiles: (table.settings.dreamPoints ?? 0) > 0,
    rules: table.settings.customRules,
    sharedMarkets: true,
  }).snapshot();
  emit('profession_picked', playerId, unique ? { professionId: chosen } : undefined);
  return {
    ...mapSeat(table, playerId, (p) => ({
      ...p,
      pick: chosen,
      professionId: chosen,
      life,
      pending: null,
      harvest: null,
      briefed: false,
    })),
    rngState: rng.state(),
  };
}

/** Hopping in or out of an insurance while the characters are read (before the first roll): it counts at once. */
function briefingInsurance(
  table: DreamTable,
  playerId: string,
  command: Extract<DreamCommand, { type: 'set_insurance' }>,
): DreamTable {
  const seat = seatOf(table, playerId);
  if (!seat.life) fail('ILLEGAL_MOVE', 'There is no life to insure yet.');
  const rng = tableRng(table.rngState);
  const player = wake(table, seat, rng.rng);
  if (!(command.kind in (player.state.insurance?.premiums ?? {}))) {
    fail('ILLEGAL_MOVE', 'You have no such insurance on offer.');
  }
  player.setInsurance(command.kind, command.on);
  return sleep({ ...table, rngState: rng.state() }, playerId, player, {});
}

// ── Play ───────────────────────────────────────────────────────────────────────────────────────────

const seatOf = (table: DreamTable, id: string): DreamSeat =>
  table.players.find((p) => p.id === id) as DreamSeat;

/** The seat's life awake: it plays with the table's dice and the table's markets. */
function wake(table: DreamTable, seat: DreamSeat, rng: Rng): DreamPlayer {
  const player = DreamPlayer.restore(seat.life!, rng, { sharedMarkets: true });
  player.setState({ ...player.state, markets: { ...table.markets } });
  return player;
}

/** The life put back to sleep: the seat keeps the data, the table the markets. */
function sleep(
  table: DreamTable,
  seatId: string,
  player: DreamPlayer,
  patch: Partial<DreamSeat> = {},
) {
  return {
    ...mapSeat(table, seatId, (seat) => ({ ...seat, ...patch, life: player.snapshot() })),
    markets: { ...(player.state.markets ?? table.markets) },
  };
}

const alive = (table: DreamTable, seat: DreamSeat) =>
  seat.status === 'active' &&
  !table.finishers.some((finisher) => finisher.playerId === seat.id) &&
  seat.life !== null;

function play(
  table: DreamTable,
  playerId: string,
  command: DreamCommand,
  ctx: DreamContext,
  emit: Emit,
  internal: boolean,
): DreamTable {
  if (table.phase !== 'playing') fail('WRONG_PHASE', 'The game is not being played now.');
  if (table.briefing) fail('WRONG_PHASE', 'Everybody is reading their character first.');
  const seat = seatOf(table, playerId);
  if (!alive(table, seat)) fail('ILLEGAL_MOVE', 'You are out of the game.');
  const now = nowOf(ctx);
  // changing how the books are kept does not wait for a turn (it changes nothing of the game)
  const harvestOption =
    command.type === 'edit_transaction' ||
    command.type === 'edit_subscription' ||
    command.type === 'set_phase' ||
    command.type === 'harvest_continue' ||
    command.type === 'harvest_sell' ||
    command.type === 'harvest_accept' ||
    command.type === 'harvest_ladder';
  if (!internal) {
    const blocked = whyClockBlocks(asClassic(table), now);
    if (blocked?.code === 'PAUSED') fail('PAUSED', blocked.message);
    if (blocked && table.activePlayerId === playerId && !harvestOption) {
      fail(blocked.code, blocked.message);
    }
  }
  if (!harvestOption && table.activePlayerId !== playerId) {
    fail('NOT_YOUR_TURN', 'It is not your turn.');
  }
  const rng = tableRng(table.rngState);
  // every die an effect of the card rolls is written down: the card shows them until it is done
  const dice: number[] = [];
  const logged = loggedRng(rng.rng, dice);
  const player = wake(table, seat, logged);
  let patch: Partial<DreamSeat>;
  try {
    patch = doCommand(table, seat, player, command, logged, emit, internal);
    // the dice of the token's move are the roll's own (told with it): the dice of the card follow them
    const own = (patch as { __moveDice?: number }).__moveDice ?? 0;
    delete (patch as { __moveDice?: number }).__moveDice;
    patch = withDice(seat, patch, dice.slice(own));
  } catch (error) {
    if (error instanceof TableCommandError) throw error;
    return fail(
      'ILLEGAL_MOVE',
      `That move is not possible: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  let current = sleep({ ...table, rngState: rng.state() }, playerId, player, patch);
  if (command.type === 'roll' || command.type === 'debug_load' || command.type === 'debug_career') {
    current = { ...current, turnRolled: true };
  }
  // a landing on a Harvest tile moves the markets of the whole table
  if ((patch as { __harvest?: boolean }).__harvest) {
    current = broadcastHarvest(
      current,
      playerId,
      rng,
      emit,
      (patch as { __harvestId?: string }).__harvestId,
    );
  }
  if (!internal && table.activePlayerId === playerId) {
    current = clockOf.reset(current, playerId);
    if (seat.away) {
      current = mapSeat(current, playerId, (p) => ({ ...p, away: false }));
      emit('player_returned', playerId);
    }
  }
  current = noteGoals(current, playerId, emit);
  const ended = checkEnd(current, emit);
  if (ended) return ended;
  if (command.type === 'end_turn') return advance(current, ctx, emit);
  return current;
}

const TILE_EVENT: Record<string, DreamEventType> = {
  emergency: 'emergency',
  life: 'life',
  career: 'career',
  dream: 'dream',
  opportunity: 'opportunity',
  harvest: 'harvest',
};

/**
 * The dice a move rolled for a card are kept with the card (JFK, 2026-11): on what is still to be decided, or on what the card came to.
 * The dice of the same card that fell earlier stay in front of them.
 */
function withDice(
  seat: DreamSeat,
  patch: Partial<DreamSeat>,
  rolled: number[],
): Partial<DreamSeat> {
  if (rolled.length === 0) return patch;
  const before = seat.pending as { kind?: string; dice?: number[] } | null | undefined;
  const target = (patch.pending ?? patch.resolved) as
    { kind?: string; dice?: number[] } | null | undefined;
  if (!target || typeof target !== 'object') return patch;
  const earlier = before?.kind === target.kind ? (before?.dice ?? []) : [];
  const dice = [...earlier, ...rolled].slice(-12);
  return patch.pending
    ? { ...patch, pending: { ...patch.pending, dice } as never }
    : { ...patch, resolved: { ...patch.resolved, dice } as never };
}

/** What a command does to a life; returns what is to change on the seat. Throws when the move is not possible. */
function doCommand(
  table: DreamTable,
  seat: DreamSeat,
  p: DreamPlayer,
  command: DreamCommand,
  rng: Rng,
  emit: Emit,
  internal = false,
): Partial<DreamSeat> {
  const id = seat.id;
  const pending = seat.pending;
  const refuse = (message: string): never => fail('ILLEGAL_MOVE', message);
  switch (command.type) {
    case 'roll': {
      if (table.turnRolled) refuse('You have rolled already.');
      if (pending) refuse('Decide about the card first.');
      const roundBefore = p.state.round;
      const rolled = p.roll();
      // what the solo screen needs to show the roll: the dice, and the way the token walked
      emit('rolled', id, {
        landed: rolled.landed,
        dice: rolled.dice,
        total: rolled.total,
        from: rolled.from,
        to: rolled.to,
        paydays: rolled.paydays,
        openingPayday: rolled.openingPayday,
      });
      for (let i = 0; i < rolled.paydays; i += 1) {
        p.trim();
        p.payInstallments();
        // the first roll of a game pays the opening Payday as well as the one it lands on: told apart, each with its month
        emit('payday', id, {
          round: roundBefore + i + 1,
          ...(i === 0 && rolled.openingPayday ? { opening: true } : {}),
        });
      }
      const tile = p.pendingTile();
      const jobSearch = rolled.jobSearch ? { ...rolled.jobSearch, thrown: false } : null;
      // the dice of the move itself (and of the job search of a Payday) are not the card's
      const moveDice = { __moveDice: rolled.dice.length + (rolled.jobSearch ? 1 : 0) } as object;
      if (!tile) {
        return {
          pending: null,
          resolved: null,
          paydayDue: rolled.paydays > 0,
          jobSearch,
          ...moveDice,
        };
      }
      // the landing is told with the card the tile dealt, so everybody at the table can read what was drawn
      const landing = enterTile(tile, p, rng, emit, id);
      const dealt = landing.pending ?? landing.resolved;
      const dealtData = dealt as unknown as Record<string, unknown> | null | undefined;
      emit(TILE_EVENT[tile] ?? 'rolled', id, {
        tile,
        ...(typeof dealtData?.['cardId'] === 'string' ? { cardId: dealtData['cardId'] } : {}),
        ...(Array.isArray(dealtData?.['offers']) ? { offers: dealtData['offers'] } : {}),
      });
      if (landing.resolved?.kind === 'life') {
        emit('life_answered', id, { cardId: landing.resolved.cardId, decision: 'fate' });
      }
      return { resolved: null, ...landing, paydayDue: rolled.paydays > 0, jobSearch, ...moveDice };
    }
    case 'pay_emergency': {
      if (pending?.kind !== 'emergency') return refuse('There is no emergency to pay.');
      const card = p.emergencyCard(pending.cardId);
      if (!card) return refuse('That emergency card is gone.');
      const context = p.emergencyContext();
      // what the player picked and rolled is the card's; a player who was not asked (a bot, a timeout) gets the cheapest way
      const picked = quoteEmergency(
        card,
        { choiceId: pending.choiceId, rolls: pending.rolls, rerolled: pending.rerolled },
        context,
      );
      const pay = picked.ready
        ? picked.payMinor
        : p.autoEmergencySelection(card, context, command.choiceId);
      if (pay === null) return refuse('The emergency could not be worked out.');
      if (command.pay === 'now') p.payEmergencyNow(pay);
      else if (command.pay === 'later') p.openEmergency(card.id, pay);
      else {
        if (card.payment === 'pay_now') return refuse('This emergency has to be paid at once.');
        const option = p.emergencyPlanOptions(pay).find((o) => o.months === command.pay);
        if (!option) return refuse('A plan runs over 3, 6 or 12 Paydays.');
        p.planEmergency(card.id, option);
      }
      emit('money_moved', id, {
        what: 'emergency',
        cardId: card.id,
        payMinor: pay,
        how: command.pay,
      });
      return {
        pending: null,
        resolved: {
          kind: 'emergency',
          cardId: card.id,
          ...(pending.choiceId ? { choiceId: pending.choiceId } : {}),
          ...(pending.rolls ? { rolls: pending.rolls } : {}),
          payMinor: pay,
          how: command.pay,
        },
      };
    }
    case 'emergency_choose': {
      if (pending?.kind !== 'emergency') return refuse('There is no emergency to choose for.');
      const card = p.emergencyCard(pending.cardId);
      if (!card || !(card.choices ?? []).some((choice) => choice.id === command.choiceId)) {
        return refuse("That is not one of the card's options.");
      }
      return { pending: { ...pending, choiceId: command.choiceId, rolls: undefined } };
    }
    case 'emergency_roll': {
      if (pending?.kind !== 'emergency') return refuse('There is no emergency to roll for.');
      const card = p.emergencyCard(pending.cardId);
      if (!card) return refuse('That emergency card is gone.');
      const quote = quoteEmergency(
        card,
        { choiceId: pending.choiceId, rolls: pending.rolls, rerolled: pending.rerolled },
        p.emergencyContext(),
      );
      if (!quote.needsRolls.includes(command.key))
        return refuse('That die is not to be rolled now.');
      return {
        pending: { ...pending, rolls: { ...(pending.rolls ?? {}), [command.key]: rollDie(rng) } },
      };
    }
    case 'emergency_reroll': {
      if (pending?.kind !== 'emergency') return refuse('There is no emergency to roll again for.');
      const card = p.emergencyCard(pending.cardId);
      const quote =
        card &&
        quoteEmergency(
          card,
          { choiceId: pending.choiceId, rolls: pending.rolls, rerolled: pending.rerolled },
          p.emergencyContext(),
        );
      if (!card?.reroll || !quote?.canReroll) return refuse('There is no offer to roll again.');
      return { pending: { ...pending, rerolled: true } };
    }
    case 'answer_life': {
      if (pending?.kind !== 'life') return refuse('There is no life card to answer.');
      const card = p.lifeCard(pending.cardId);
      if (!card) return refuse('That life card is gone.');
      const d = command.decision;
      const outcome = p.resolveLife(
        card,
        typeof d === 'string' ? { kind: d } : { kind: 'option', id: d.option },
      );
      emit('life_answered', id, {
        cardId: card.id,
        decision: typeof d === 'string' ? d : d.option,
      });
      return {
        pending: null,
        resolved: {
          kind: 'life',
          cardId: card.id,
          decision: typeof d === 'string' ? d : d.option,
          outcome,
        },
      };
    }
    case 'choose_career_branch': {
      if (pending?.kind !== 'career_branch') return refuse('There is no career branch to choose.');
      if (!pending.options[command.index]) return refuse('There is no such path.');
      const result = { kind: 'branch' as const, options: pending.options, roll: pending.roll ?? 0 };
      p.careerApply(result, command.index);
      return {
        pending: null,
        resolved: { kind: 'career', result, reached: pending.options[command.index] },
      };
    }
    case 'take_dream': {
      if (pending?.kind !== 'dream' || !pending.offers.includes(command.cardId)) {
        return refuse('That dream is not on offer.');
      }
      if (!p.canTakeDream()) return refuse('You have as many open dreams as you can carry.');
      const card = p.dreamCard(command.cardId);
      if (!card) return refuse('That dream card is gone.');
      p.takeDream(card);
      emit('dream_taken', id, { cardId: card.id });
      return {
        pending: null,
        resolved: { kind: 'dream', offers: pending.offers, taken: card.id },
      };
    }
    case 'choose_pile': {
      if (pending?.kind !== 'opportunity_pile') return refuse('There is no pile to choose now.');
      const offers = p.drawOpportunity(command.pile);
      emit('opportunity_offers', id, { pile: command.pile, offers: offers.map((o) => o.id) });
      return {
        pending: offers.length
          ? { kind: 'opportunity', pile: command.pile, offers: offers.map((o) => o.id) }
          : null,
      };
    }
    case 'plan_opportunity': {
      if (pending?.kind !== 'opportunity' || !pending.offers.includes(command.cardId)) {
        return refuse('That card is not on offer.');
      }
      if (pending.planned) return refuse('A card is planned already: buy it in Grow, or leave it.');
      const card = p.opportunityCard(command.cardId);
      if (!card) return refuse('That card is gone.');
      if (card.growType !== 'income-growth') return refuse('This card is taken, not planned.');
      const quote = p.quoteOpportunity(card, { swapOut: command.swapOut });
      if (!quote.ok)
        return refuse(`That card cannot be taken (${quote.reason ?? 'not possible'}).`);
      const planned = p.planOpportunity(card, command.swapOut);
      emit('opportunity_planned', id, { cardId: card.id });
      return { pending: { ...pending, planned } };
    }
    case 'roll_opportunity':
    case 'buy_planned':
    case 'take_opportunity': {
      const planned = pending?.kind === 'opportunity' ? pending.planned : undefined;
      const rolling = pending?.kind === 'opportunity' ? pending.rolling : undefined;
      const wanted =
        command.type === 'roll_opportunity'
          ? (rolling?.cardId ?? '')
          : command.type === 'buy_planned'
            ? planned && planned.title === command.title
              ? planned.cardId
              : ''
            : command.cardId;
      if (pending?.kind !== 'opportunity' || !wanted || !pending.offers.includes(wanted)) {
        return refuse('That card is not on offer.');
      }
      const card = p.opportunityCard(wanted);
      if (!card) return refuse('That card is gone.');
      const choice =
        command.type === 'roll_opportunity'
          ? (rolling?.choice ?? {})
          : command.type === 'buy_planned'
            ? {
                units: command.units,
                steps: command.steps,
                // the side hustle given up was chosen when the card was planned
                swapOut: (p.state.opportunityPlans ?? []).find((plan) => plan.cardId === wanted)
                  ?.swapOut,
              }
            : (command.choice ?? {});
      const quote = p.quoteOpportunity(card, choice);
      if (!quote.ok)
        return refuse(`That card cannot be taken (${quote.reason ?? 'not possible'}).`);
      // a card with a die waits for the player's throw, as alone: nothing is paid or booked before it
      if (
        (card.dice || card.onBuy) &&
        (command.type === 'buy_planned' ||
          (command.type === 'take_opportunity' && !command.immediate))
      ) {
        return { pending: { ...pending, rolling: { cardId: card.id, choice } } };
      }
      const told = p.buyOpportunity(card, choice, quote.costMinor);
      emit('opportunity_taken', id, { cardId: card.id, costMinor: quote.costMinor });
      return {
        pending: null,
        resolved: {
          kind: 'opportunity',
          pile: pending.pile,
          offers: pending.offers,
          taken: card.id,
          told,
          project: projectTitleOf(card, 'en'),
        },
      };
    }
    case 'skip': {
      if (!pending) return refuse('There is nothing to leave.');
      if (
        pending.kind === 'emergency' ||
        pending.kind === 'life' ||
        pending.kind === 'career_branch'
      ) {
        return refuse('This one has to be answered.');
      }
      if (pending.kind === 'opportunity' && pending.rolling) {
        return refuse('Throw the die of the card you took first.');
      }
      if (pending.kind === 'dream') emit('dream_declined', id, { offers: pending.offers });
      if (pending.kind === 'opportunity') {
        p.closePlans();
        emit('opportunity_passed', id, { pile: pending.pile, offers: pending.offers });
      }
      return {
        pending: null,
        ...(pending.kind === 'dream'
          ? { resolved: { kind: 'dream' as const, offers: pending.offers, declined: true } }
          : pending.kind === 'opportunity'
            ? {
                resolved: {
                  kind: 'opportunity' as const,
                  pile: pending.pile,
                  offers: pending.offers,
                  passed: true,
                },
              }
            : {}),
      };
    }
    case 'end_turn': {
      if (!table.turnRolled) return refuse('Roll first.');
      if (seat.jobSearch && !seat.jobSearch.thrown)
        return refuse('Throw the die of your job search first.');
      // the Harvest card of this turn affects others: the turn ends when each of them has said Continue
      if (!internal) {
        const waiting = harvestWaiting(table).map(
          (other) => table.players.find((player) => player.id === other)?.name ?? '',
        );
        if (waiting.length > 0)
          return refuse(`Waiting for ${waiting.join(', ')} to press Continue.`);
      }
      // an investment planned in Grow and not bought is left with the turn: the chance is missed
      if (pending?.kind === 'opportunity' && pending.rolling) {
        return refuse('Throw the die of the card you bought first.');
      }
      // Done on an Opportunity nobody took is the same as passing: nobody has to take a card (JFK, 2026-11-05)
      if (pending?.kind === 'opportunity_pile') {
        p.endTurn();
        return { pending: null };
      }
      if (pending?.kind === 'opportunity') {
        // a card that was only offered or planned in Grow: the chance is missed
        p.closePlans();
        emit('opportunity_passed', id, { pile: pending.pile, offers: pending.offers });
        p.endTurn();
        return {
          pending: null,
          resolved: {
            kind: 'opportunity',
            pile: pending.pile,
            offers: pending.offers,
            passed: true,
          },
        };
      }
      if (pending) return refuse('Decide about the card first.');
      // an emergency taken as a Fire project is paid or planned before the game goes on (the guided and the strict game)
      if (!internal && p.rules.mode !== 'free' && p.unsettledEmergencies().length > 0) {
        return refuse(
          'Pay the emergency from its Fire project, or plan it, before you end the turn.',
        );
      }
      p.endTurn();
      return {};
    }
    case 'edit_transaction': {
      const patch = command.patch ?? {};
      const critical = Object.keys(patch).filter(
        (key) => !['category', 'account', 'time'].includes(key),
      );
      if (critical.length > 0) {
        return refuse(
          `The ${critical.join(', ')} of a booking belong to the game and cannot be changed.`,
        );
      }
      p.editTransaction(command.index, patch);
      return {};
    }
    case 'edit_subscription': {
      p.editSubscription(command.title, command.account);
      return {};
    }
    case 'set_phase': {
      p.setPhase(command.kind, command.id, command.phase);
      return {};
    }
    case 'fund_reserve': {
      const put = Math.floor(command.amountMinor);
      if (put <= 0) return refuse('Enter an amount to put in the reserve.');
      p.fundReserve(put);
      emit('money_moved', id, { what: 'reserve', amountMinor: put });
      return {};
    }
    case 'fund_dream': {
      if (command.id && command.id !== 'life' && !p.smile.some((d) => d.cardId === command.id)) {
        return refuse('That dream is not open.');
      }
      if (command.amountMinor <= 0) return refuse('Enter an amount for the dream.');
      const put = p.fundDreams(command.amountMinor, command.id);
      if (put <= 0) return refuse('There is nothing left to save for there.');
      p.checkDreams();
      emit('money_moved', id, { what: 'dream', amountMinor: put });
      return {};
    }
    case 'fund_emergency': {
      if (!p.plans.some((plan) => plan.kind === 'emergency' && plan.id === command.id)) {
        return refuse('That emergency is not open.');
      }
      const put = p.fundEmergency(command.id, command.amountMinor);
      if (put <= 0) return refuse('There is no cash to pay it with.');
      emit('money_moved', id, { what: 'emergency_fund', cardId: command.id, amountMinor: put });
      return {};
    }
    case 'repay_debt': {
      if (!p.debtTags.includes(command.tag)) return refuse('That is not one of your debts.');
      if (!p.repayDebt(command.tag)) return refuse('That debt cannot be paid off now.');
      emit('money_moved', id, { what: 'debt', tag: command.tag });
      return {};
    }
    case 'repay_bank_loan': {
      const repaid = p.repayBankLoan(command.amountMinor);
      if (repaid !== true) return refuse(repaid);
      emit('money_moved', id, { what: 'bank_loan', amountMinor: command.amountMinor });
      return {};
    }
    case 'set_insurance': {
      const known = p.state.insurance?.premiums ?? {};
      if (!(command.kind in known)) return refuse('You have no such insurance on offer.');
      p.setInsurance(command.kind, command.on);
      return {};
    }
    case 'debug_load': {
      if (!table.settings.debug || id !== table.hostId) {
        return refuse('Only the host of a debug game loads cards.');
      }
      const tile = command.tile;
      p.debugLand(tile);
      const landing = enterTileWith(tile, command.cardId, p, id);
      if (!landing) return refuse('That card is not in the pile of this tile.');
      const dealt = landing.pending ?? landing.resolved;
      const dealtData = dealt as unknown as Record<string, unknown> | null | undefined;
      emit(TILE_EVENT[tile] ?? 'rolled', id, {
        tile,
        ...(typeof dealtData?.['cardId'] === 'string' ? { cardId: dealtData['cardId'] } : {}),
        ...(Array.isArray(dealtData?.['offers']) ? { offers: dealtData['offers'] } : {}),
      });
      if (landing.resolved?.kind === 'life') {
        emit('life_answered', id, { cardId: landing.resolved.cardId, decision: 'fate' });
      }
      // everything of the card before is cancelled: the player stands on this tile with exactly this card
      return {
        resolved: null,
        pending: null,
        harvest: null,
        jobSearch: null,
        paydayDue: false,
        ...landing,
      };
    }
    case 'debug_payday': {
      if (!table.settings.debug || id !== table.hostId) {
        return refuse('Only the host of a debug game mocks a Payday.');
      }
      const round = p.state.round;
      const searched = p.debugPayday();
      p.trim();
      p.payInstallments();
      emit('payday', id, { round: round + 1 });
      return {
        paydayDue: true,
        jobSearch: searched ? { ...searched, thrown: false } : null,
      };
    }
    case 'debug_career': {
      if (!table.settings.debug || id !== table.hostId) {
        return refuse('Only the host of a debug game moves the career.');
      }
      if (!p.debugCareer(command.stage)) return refuse('That stage cannot be put before.');
      p.debugLand('career');
      return { resolved: null, ...enterTile('career', p, rng, emit, id) };
    }
    case 'throw_job_search': {
      if (!seat.jobSearch || seat.jobSearch.thrown) return refuse('There is no die to throw.');
      emit('job_search', id, {
        roll: seat.jobSearch.roll,
        rollFrom: seat.jobSearch.rollFrom,
        result: seat.jobSearch.result,
      });
      return { jobSearch: { ...seat.jobSearch, thrown: true } };
    }
    case 'settle_payday':
      return { paydayDue: false };
    case 'sell_holding': {
      const found = p.sellable(command.holding);
      if (!found) return refuse('That cannot be sold: nobody buys it.');
      p.sellAtStanding(command.holding);
      emit('holding_sold', id, { holding: command.holding, grossMinor: found.standing.grossMinor });
      return {};
    }
    case 'set_plan': {
      const per = Math.max(0, Math.floor(command.perMinor));
      if (command.kind === 'emergency') {
        if (!p.planOpenEmergency(command.id, per)) return refuse('That emergency is not open.');
        return {};
      }
      p.plans = p.plans.filter((plan) => !(plan.kind === command.kind && plan.id === command.id));
      if (per > 0) {
        const left =
          command.kind === 'mojo'
            ? p.monthlyExpenses() * 3 - p.reserveMinor
            : command.kind === 'life'
              ? p.dreamTargetMinor - p.dreamSavedMinor
              : (() => {
                  const dream = p.smile.find((d) => d.cardId === command.id);
                  return dream ? dream.totalMinor - dream.savedMinor : 0;
                })();
        if (left <= 0) return refuse('There is nothing left to save for there.');
        p.plans.push({ kind: command.kind, id: command.id, perMinor: per, leftMinor: left });
      }
      return {};
    }
    case 'harvest_continue':
      if (!seat.harvest) return refuse('There is no Harvest card to continue from.');
      return { harvest: { ...seat.harvest, acknowledged: true } };
    case 'harvest_sell':
    case 'harvest_accept':
    case 'harvest_ladder':
      return harvestOption(seat, p, command, rng);
    default:
      return refuse('That is not a move.');
  }
}

/** The share of the choice cards of the Life stack that are not a choice when they are drawn: life decides. */
const LIFE_FORCED_SHARE = 0.35;

/** The tile a roll landed on: what the player has to decide, in the order of the solo game. */
function enterTile(
  tile: string,
  p: DreamPlayer,
  rng: Rng,
  emit: Emit,
  id: string,
): Partial<DreamSeat> {
  switch (tile) {
    case 'emergency': {
      const drawn = p.drawEmergency();
      return { pending: drawn ? { kind: 'emergency', cardId: drawn.card.id } : null };
    }
    case 'life': {
      const card = p.drawLife();
      if (!card) return { pending: null };
      // a choice is not always one: sometimes the player is asked, sometimes life decides (JFK, 2026-11-03)
      const forced =
        card.type === 'choice' && !!card.accept && !card.options && rng() < LIFE_FORCED_SHARE;
      if (card.type === 'fate' || forced) {
        const outcome = p.resolveLife(card, { kind: forced ? 'accept' : 'fate' });
        return {
          pending: null,
          resolved: { kind: 'life', cardId: card.id, decision: 'fate', outcome },
        };
      }
      return { pending: { kind: 'life', cardId: card.id } };
    }
    case 'career': {
      const result = p.careerRoll();
      if (!result) return { pending: null };
      if (result.kind === 'branch') {
        return { pending: { kind: 'career_branch', options: result.options, roll: result.roll } };
      }
      p.careerApply(result);
      emit('career', id, { result: result.kind });
      return {
        pending: null,
        resolved: {
          kind: 'career',
          result,
          ...(result.kind === 'promoted' ? { reached: result.to } : {}),
        },
      };
    }
    case 'dream': {
      const drawn = p.drawDream();
      if (!drawn) return { pending: null };
      if (drawn.landing.kind === 'moment') {
        p.moment(drawn.landing.moment.id, drawn.cards, () => null);
        return { pending: null, resolved: { kind: 'dream', moment: drawn.landing.moment.id } };
      }
      const offers = drawn.landing.offers.map((o) => o.id);
      return p.canTakeDream() && offers.length > 0
        ? { pending: { kind: 'dream', offers } }
        : // the dreams are shown, but there is room for none
          { pending: null, resolved: { kind: 'dream', offers, declined: true } };
    }
    case 'opportunity':
      return { pending: { kind: 'opportunity_pile' } };
    case 'harvest':
      return { pending: null, ...({ __harvest: true } as object) };
    default:
      return { pending: null };
  }
}

/** The tile dealt a card the host chose (a debug game); null when the card is not one of the pile of the tile. */
function enterTileWith(
  tile: string,
  cardId: string,
  p: DreamPlayer,
  id: string,
): Partial<DreamSeat> | null {
  void id;
  switch (tile) {
    case 'emergency':
      return p.emergencyCard(cardId) ? { pending: { kind: 'emergency', cardId } } : null;
    case 'life': {
      const card = p.lifeCard(cardId);
      if (!card) return null;
      if (card.type === 'fate') {
        const outcome = p.resolveLife(card, { kind: 'fate' });
        return { pending: null, resolved: { kind: 'life', cardId, decision: 'fate', outcome } };
      }
      return { pending: { kind: 'life', cardId } };
    }
    case 'dream':
      return p.dreamCard(cardId) ? { pending: { kind: 'dream', offers: [cardId] } } : null;
    case 'opportunity': {
      const card = p.opportunityCard(cardId);
      return card ? { pending: { kind: 'opportunity', pile: card.pile, offers: [cardId] } } : null;
    }
    case 'harvest':
      return { pending: null, ...({ __harvest: true, __harvestId: cardId } as object) };
    default:
      return null;
  }
}

/**
 * A Harvest card is the table's: one card is drawn for everybody, the markets move once, and it happens to every player's holdings
 * (with the same dice: one roll for the whole table). Each player may then sell into it until the turn of the player who drew it is over.
 */
function broadcastHarvest(
  table: DreamTable,
  drawerId: string,
  trng: { rng: Rng; state(): number },
  emit: Emit,
  /** A debug game: the card the host chose instead of the one that chance would deal. */
  forcedId?: string,
): DreamTable {
  const cards = base().decks?.harvest ?? [];
  const forced = forcedId ? cards.find((card) => card.id === forcedId) : undefined;
  const draw = forced
    ? { card: forced, deck: table.harvestDeck as never }
    : drawHarvestCard(cards, table.harvestDeck as never, trng.rng);
  const cardId = draw.card.id;
  emit('harvest', drawerId, { cardId });
  let current: DreamTable = { ...table, harvestDeck: draw.deck };
  // the dice of the card, rolled once for the table and replayed for everybody else
  const seen: number[] = [];
  const recording: Rng = () => {
    const v = trng.rng();
    seen.push(v);
    return v;
  };
  const markets = { ...table.markets };
  let moved = markets;
  let first = true;
  for (const seat of table.order.map((id) => seatOf(current, id))) {
    if (!alive(current, seat)) continue;
    let i = 0;
    const replay: Rng = () => (i < seen.length ? seen[i++] : trng.rng());
    const p = DreamPlayer.restore(seat.life!, first ? recording : replay, { sharedMarkets: true });
    p.setState({ ...p.state, markets: { ...markets } });
    const card = p.harvestCards.find((c) => c.id === cardId);
    if (!card) continue;
    const pending = p.applyHarvest(card);
    if (first) {
      moved = { ...(p.state.markets ?? markets) };
      first = false;
    }
    p.setState({ ...p.state, markets: { ...moved } });
    const open = {
      cardId,
      told: pending.told,
      window: pending.window,
      sellable: p.harvestSellable(pending),
      sales: pending.sales.map((s) => ({
        holding: s.holding,
        grossMinor: s.grossMinor,
        costsMinor: s.costsMinor,
        owedMinor: s.owedMinor,
      })),
      ladders: pending.ladders,
    };
    current = sleep(current, seat.id, p, {
      // everybody sees the card, whether or not it brought them anything to sell
      harvest: open,
    });
  }
  return { ...current, markets: moved, rngState: trng.state() };
}

function harvestOption(
  seat: DreamSeat,
  p: DreamPlayer,
  command: Extract<DreamCommand, { type: 'harvest_sell' | 'harvest_accept' | 'harvest_ladder' }>,
  rng: Rng,
): Partial<DreamSeat> {
  void rng;
  const open = seat.harvest;
  if (!open) fail('ILLEGAL_MOVE', 'There is nothing to sell into now.');
  const left = open!;
  if (command.type === 'harvest_sell') {
    if (!left.sellable.includes(command.holding)) fail('ILLEGAL_MOVE', 'That cannot be sold now.');
    if (!p.sellAtMarket(command.holding)) fail('ILLEGAL_MOVE', 'You do not own that any more.');
    return { harvest: { ...left, sellable: left.sellable.filter((t) => t !== command.holding) } };
  }
  if (command.type === 'harvest_accept') {
    const sale = left.sales.find((s) => s.holding === command.holding);
    if (!sale) fail('ILLEGAL_MOVE', 'Nobody offered for that.');
    if (!p.acceptSale(sale!)) fail('ILLEGAL_MOVE', 'You do not own that any more.');
    return { harvest: { ...left, sales: left.sales.filter((s) => s.holding !== command.holding) } };
  }
  const offer = left.ladders.find((l) => l.holding === command.holding);
  if (!offer) fail('ILLEGAL_MOVE', 'There is no hype to ride.');
  const rest = left.ladders.filter((l) => l.holding !== command.holding);
  if (command.action === 'skip') return { harvest: { ...left, ladders: rest } };
  if (command.action === 'cash') {
    if (!p.cashLadderOffer(offer!)) fail('ILLEGAL_MOVE', 'You do not own that any more.');
    return { harvest: { ...left, ladders: rest } };
  }
  const ridden = p.rideLadderOffer(offer!);
  if (ridden.state === 'done') {
    p.cashLadderOffer(ridden);
    return { harvest: { ...left, ladders: rest } };
  }
  return { harvest: { ...left, ladders: [...rest, ridden] } };
}

// ── Trading ────────────────────────────────────────────────────────────────────────────────────────

const TRADE_COMMANDS = new Set<DreamCommand['type']>([
  'offer_trade',
  'withdraw_trade',
  'counter_trade',
  'decline_trade',
  'accept_trade',
]);

/**
 * What a price may be (JFK, 2026-10-27): a card is a card of its owner's price level, so a deal across levels could be a gift in
 * disguise. The seller's price is within this band of what a standing sale would bring, the buyer's within the same band of the
 * card's cost at the buyer's own level - checked when the offer is made and again when it is taken.
 */
export const TRADE_PRICE_BAND = { low: 0.25, high: 3 };

function trade(
  table: DreamTable,
  playerId: string,
  command: DreamCommand,
  ctx: DreamContext,
  emit: Emit,
): DreamTable {
  if (table.phase !== 'playing') fail('WRONG_PHASE', 'The game is not being played now.');
  const seat = seatOf(table, playerId);
  if (!alive(table, seat)) fail('ILLEGAL_MOVE', 'You are out of the game.');
  const refuse = (message: string): never => fail('ILLEGAL_MOVE', message);
  const offer = table.trade;
  const rng = tableRng(table.rngState);
  switch (command.type) {
    case 'offer_trade': {
      if (table.activePlayerId !== playerId)
        fail('NOT_YOUR_TURN', 'Offer a card in your own turn.');
      if (offer) refuse('There is an offer open already.');
      if (!Number.isInteger(command.priceMinor) || command.priceMinor <= 0) {
        refuse('A price is a positive amount.');
      }
      if (command.to !== undefined) {
        const target = table.players.find((p) => p.id === command.to);
        if (!target || command.to === playerId || !alive(table, target)) {
          refuse('That player cannot be offered the card.');
        }
      }
      const p = wake(table, seat, rng.rng);
      const found = p.sellable(command.holding);
      if (!found) return refuse('That cannot be traded: nobody buys it.');
      const gross = found.standing.grossMinor;
      if (
        command.priceMinor < gross * TRADE_PRICE_BAND.low ||
        command.priceMinor > gross * TRADE_PRICE_BAND.high
      ) {
        refuse('That price is too far from what the card is worth.');
      }
      emit('trade_offered', playerId, {
        holding: command.holding,
        cardId: found.holding.cardId,
        priceMinor: command.priceMinor,
        ...(command.to ? { to: command.to } : {}),
      });
      return {
        ...table,
        trade: {
          sellerId: playerId,
          holding: command.holding,
          cardId: found.holding.cardId,
          to: command.to ?? null,
          priceMinor: command.priceMinor,
          counters: [],
          declined: [],
          at: nowOf(ctx),
        },
      };
    }
    case 'withdraw_trade': {
      if (!offer || offer.sellerId !== playerId) return refuse('You have no offer to withdraw.');
      emit('trade_withdrawn', playerId, { holding: offer.holding });
      return { ...table, trade: null };
    }
    case 'counter_trade': {
      if (!offer) return refuse('There is no offer.');
      if (offer.sellerId === playerId) return refuse('You cannot trade with yourself.');
      if (offer.to !== null && offer.to !== playerId) return refuse('This offer is not for you.');
      if (!Number.isInteger(command.priceMinor) || command.priceMinor <= 0) {
        return refuse('A price is a positive amount.');
      }
      emit('trade_countered', playerId, { priceMinor: command.priceMinor });
      return {
        ...table,
        trade: {
          ...offer,
          counters: [
            ...offer.counters.filter((c) => c.playerId !== playerId),
            { playerId, priceMinor: command.priceMinor },
          ],
        },
      };
    }
    case 'decline_trade': {
      if (!offer) return refuse('There is no offer.');
      if (offer.sellerId === playerId) return refuse('Withdraw your own offer instead.');
      emit('trade_declined', playerId);
      const declined = [...offer.declined, playerId];
      // an offer for one player ends when that player says no
      return { ...table, trade: offer.to === playerId ? null : { ...offer, declined } };
    }
    case 'accept_trade': {
      if (!offer) return refuse('There is no offer.');
      // the buyer takes the card at the asking price, or the seller takes one of the proposals
      const sellerAccepts = playerId === offer.sellerId;
      const buyerId = sellerAccepts ? command.from : playerId;
      if (!buyerId) return refuse('Say whose proposal you accept.');
      const buyerSeat = table.players.find((s) => s.id === buyerId);
      if (!buyerSeat || buyerId === offer.sellerId || !alive(table, buyerSeat)) {
        return refuse('That player cannot buy the card.');
      }
      if (offer.to !== null && offer.to !== buyerId) return refuse('This offer is not for them.');
      if (offer.declined.includes(buyerId)) return refuse('They turned this offer down.');
      const price = sellerAccepts
        ? offer.counters.find((c) => c.playerId === buyerId)?.priceMinor
        : offer.priceMinor;
      if (price === undefined) return refuse('They made no proposal.');
      const sellerSeat = seatOf(table, offer.sellerId);
      const sellerP = wake(table, sellerSeat, rng.rng);
      const buyerP = wake(table, buyerSeat, rng.rng);
      const found = sellerP.sellable(offer.holding);
      if (!found) return refuse('The seller no longer has that card.');
      const card = buyerP.opportunityCard(offer.cardId);
      if (!card) return refuse('That card does not exist for the buyer.');
      if (!canOffer(card, buyerP.opportunityContext(), buyerP.cards)) {
        return refuse(
          'The buyer cannot take that card (they own it already, or it asks for more than they have).',
        );
      }
      const choice = found.holding.units ? { units: found.holding.units } : {};
      const quote = buyerP.quoteOpportunity(card, choice);
      if (!quote.ok) {
        return refuse(`The buyer cannot take that card (${quote.reason ?? 'not possible'}).`);
      }
      if (
        price < quote.costMinor * TRADE_PRICE_BAND.low ||
        price > quote.costMinor * TRADE_PRICE_BAND.high
      ) {
        return refuse('That price is too far from what the card costs the buyer.');
      }
      sellerP.sellForTrade(offer.holding, price);
      buyerP.buyOpportunity(card, choice, price);
      emit('trade_made', offer.sellerId, {
        buyerId,
        holding: offer.holding,
        cardId: offer.cardId,
        priceMinor: price,
      });
      let next: DreamTable = { ...table, trade: null, rngState: rng.state() };
      next = sleep(next, offer.sellerId, sellerP);
      next = sleep(next, buyerId, buyerP);
      next = noteGoals(next, offer.sellerId, emit);
      next = noteGoals(next, buyerId, emit);
      return checkEnd(next, emit) ?? next;
    }
    default:
      return fail('UNKNOWN_COMMAND', 'Unknown table command.');
  }
}

// ── Goals, the end and the turn order ─────────────────────────────────────────────────────────────

/** Notes the goals a player has newly reached, and a win or a bankruptcy. */
function noteGoals(table: DreamTable, seatId: string, emit: Emit): DreamTable {
  const seat = seatOf(table, seatId);
  if (!seat.life || table.finishers.some((f) => f.playerId === seatId)) return table;
  const p = DreamPlayer.restore(seat.life, () => 0.5, { sharedMarkets: true });
  const goals = goalsOf(p, table.settings.dreamPoints ?? 0);
  const reached = { ...seat.reached };
  const round = table.tableRound;
  for (const key of ['reserve', 'debts', 'dream', 'independence', 'points'] as const) {
    if ((goals[key] ?? 0) >= 1 && reached[key] === undefined) {
      reached[key] = round;
      emit('goal_reached', seatId, { goal: key, round });
    }
  }
  let next = mapSeat(table, seatId, (s) => ({ ...s, reached }));
  if (p.outcome() === 'bankrupt') {
    emit('player_bankrupt', seatId);
    return { ...next, finishers: [...next.finishers, { playerId: seatId, outcome: 'bankrupt' }] };
  }
  if (isWon(goals)) {
    reached.won = round;
    next = mapSeat(next, seatId, (s) => ({ ...s, reached: { ...reached } }));
    emit('player_won', seatId, { round });
    return { ...next, finishers: [...next.finishers, { playerId: seatId, outcome: 'won' }] };
  }
  return next;
}

/** How everybody stands now. */
export function dreamStandings(table: DreamTable) {
  return rankStandings(
    table.players
      .filter((seat) => seat.life)
      .map((seat) => {
        const p = DreamPlayer.restore(seat.life!, () => 0.5, { sharedMarkets: true });
        const finisher = table.finishers.find((f) => f.playerId === seat.id);
        const outcome =
          seat.status === 'left'
            ? 'left'
            : finisher?.outcome === 'won'
              ? 'won'
              : finisher?.outcome === 'bankrupt'
                ? 'bankrupt'
                : 'playing';
        return standingOf(seat, p, outcome, table.settings.dreamPoints ?? 0);
      }),
  );
}

function finish(
  table: DreamTable,
  reason: NonNullable<DreamTable['result']>['reason'],
  emit: Emit,
): DreamTable {
  const ranking = dreamStandings(table);
  const winner =
    reason === 'everyone-out'
      ? null
      : ranking[0]?.outcome === 'won' || reason === 'last-standing' || reason === 'round-limit'
        ? (ranking[0]?.playerId ?? null)
        : null;
  emit('game_finished', winner, { reason });
  return {
    ...clockOf.stop(table),
    phase: 'finished',
    activePlayerId: null,
    result: { reason, winnerId: winner, ranking },
  };
}

function checkEnd(table: DreamTable, emit: Emit): DreamTable | null {
  if (table.phase !== 'playing') return null;
  const won = table.finishers.filter((f) => f.outcome === 'won');
  if (table.settings.endCondition === 'first-win' && won.length > 0)
    return finish(table, 'won', emit);
  const standing = table.players.filter((seat) => alive(table, seat));
  if (standing.length === 0) {
    return won.length > 0 ? finish(table, 'all-done', emit) : finish(table, 'everyone-out', emit);
  }
  if (standing.length === 1 && won.length === 0 && table.players.length >= 2) {
    return finish(table, 'last-standing', emit);
  }
  return null;
}

/** The turn goes on to the next player who can play; the first of the order starts a new round (the markets drift once). */
function advance(table: DreamTable, ctx: DreamContext, emit: Emit): DreamTable {
  const now = nowOf(ctx);
  if (table.trade) emit('trade_expired', table.trade.sellerId, { holding: table.trade.holding });
  let next: DreamTable = {
    ...(table.activePlayerId ? clockOf.end(table, table.activePlayerId, now) : table),
    trade: null,
    turnRolled: false,
    players: table.players.map((p) => ({
      ...p,
      harvest: null,
      pending: null,
      paydayDue: false,
      jobSearch: null,
    })),
  };
  const order = next.order;
  let index = Math.max(0, order.indexOf(table.activePlayerId ?? ''));
  for (let guard = 0; guard < order.length * 4; guard += 1) {
    index = (index + 1) % order.length;
    if (index === 0) {
      const round = next.tableRound + 1;
      if (next.settings.endCondition === 'round-limit' && round > (next.settings.roundLimit ?? 0)) {
        return finish(next, 'round-limit', emit);
      }
      next = {
        ...next,
        tableRound: round,
        markets: driftMarkets(next.markets, next.settings.difficulty, 1),
      };
      emit('round_started', null, { round });
    }
    const seat = seatOf(next, order[index]);
    if (alive(next, seat)) {
      emit('turn_started', seat.id);
      return clockOf.start({ ...next, activePlayerId: seat.id }, seat.id, now);
    }
  }
  return finish(next, 'everyone-out', emit);
}

// ── Passive play: the clock and the away ───────────────────────────────────────────────────────────

/** What a player who is not asked (time ran out, away) does next: the most passive legal move. */
export function passiveCommands(table: DreamTable, playerId: string): DreamCommand[] {
  const seat = seatOf(table, playerId);
  if (!seat || table.activePlayerId !== playerId) return [];
  const pending = seat.pending;
  if (seat.jobSearch && !seat.jobSearch.thrown) return [{ type: 'throw_job_search' }];
  if (!pending) return table.turnRolled ? [{ type: 'end_turn' }] : [{ type: 'roll' }];
  switch (pending.kind) {
    case 'emergency':
      return [{ type: 'pay_emergency', pay: 'now' }];
    case 'life':
      return [
        { type: 'answer_life', decision: 'decline' },
        { type: 'answer_life', decision: 'pass' },
        { type: 'answer_life', decision: 'accept' },
      ];
    case 'career_branch':
      return [{ type: 'choose_career_branch', index: 0 }];
    case 'opportunity':
      return pending.rolling ? [{ type: 'roll_opportunity' }] : [{ type: 'skip' }];
    default:
      return [{ type: 'skip' }];
  }
}

function passiveTurn(table: DreamTable, who: string, ctx: DreamContext, emit: Emit): DreamTable {
  let current = table;
  for (
    let step = 0;
    step < 24 && current.activePlayerId === who && current.phase === 'playing';
    step += 1
  ) {
    let done = false;
    for (const command of passiveCommands(current, who)) {
      try {
        current = play(current, who, command, ctx, emit, true);
        done = true;
        break;
      } catch (error) {
        if (!(error instanceof TableCommandError)) throw error;
      }
    }
    if (!done) {
      // nothing legal is left to do: end the turn so the game goes on
      if (current.turnRolled) current = play(current, who, { type: 'end_turn' }, ctx, emit, true);
      else break;
    }
  }
  return current;
}

/** While the player on the move is away, their turn is played at once so nobody waits for them. */
function runAwayTurns(table: DreamTable, ctx: DreamContext, emit: Emit): DreamTable {
  let current = table;
  for (let guard = 0; guard < current.players.length * 2 + 2; guard += 1) {
    if (current.phase !== 'playing') break;
    const active = current.players.find((p) => p.id === current.activePlayerId);
    if (!active?.away) break;
    if (current.players.filter((s) => alive(current, s)).every((s) => s.away)) {
      emit('table_closed', null, { reason: 'everyone_away' });
      return { ...clockOf.stop(current), phase: 'abandoned', activePlayerId: null };
    }
    current = passiveTurn(current, active.id, ctx, emit);
  }
  return current;
}

/** The active player's time is up: the most passive turn is played for them; too many timeouts in a row make them away. */
export function applyDreamTimeout(table: DreamTable, ctx: DreamContext): DreamCommandResult {
  if (table.phase !== 'playing') fail('WRONG_PHASE', 'The game is not being played now.');
  const who = table.activePlayerId;
  if (!who) return fail('NOT_DUE', 'Nobody is on the move.');
  const version = table.version + 1;
  const events: DreamEvent[] = [];
  const emit: Emit = (type, pid, data) =>
    events.push({
      version,
      at: ctx.clock.nowIso(),
      type,
      playerId: pid,
      ...(data ? { data } : {}),
    });
  const counted = countTimeout(asClassic(table), who);
  let current = fromClassic(counted.table, table);
  emit('turn_timeout', who, { count: counted.count });
  if (counted.count >= current.settings.awayAfterTimeouts) {
    current = mapSeat(current, who, (p) => ({ ...p, away: true }));
    emit('player_away', who);
  }
  current = passiveTurn(current, who, ctx, emit);
  current = runAwayTurns({ ...current, version }, ctx, emit);
  return { table: { ...current, version }, events };
}

export { normalizeCustomRules };
