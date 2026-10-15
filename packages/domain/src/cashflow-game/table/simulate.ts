import { openDecisions, whyDiceFirst } from '../asset-deals';
import type { GameBooks } from '../books';
import { cashOnHandMinor } from '../cash';
import { fixedClock } from '../clock';
import { summarizeGameFinances } from '../saved-games';
import { seededRng } from '../rng';
import type { Policy, PolicyView } from '../simulation/policy';
import { PRESET_POLICIES } from '../simulation/strategies';
import { currentTurn } from '../turn';
import type { CashflowDealCard } from '../types';
import { nextDeadline } from './clock';
import { nextPassiveCommand } from './passive';
import {
  applyCommand,
  applyTimeout,
  createTable,
  type CommandResult,
  type CreateTableInput,
  type TableContext,
} from './reducer';
import {
  TableCommandError,
  type Table,
  type TableCommand,
  type TableEvent,
  type TableSettingsInput,
} from './types';
import { projectFor } from './view';

/**
 * Whole tables played in memory (todo/cashflow-multiplayer.md slice T6): the real table rules, driven by the strategy lab's
 * policies, with a clock that jumps instead of waiting. A run produces the final table, every event, a **script** - the
 * creation input and every command or timeout with the time it happened - and a list of broken invariants. The same script
 * replays to the identical table (`replayScript`), which is what the server's and the bot harness's tests pin.
 */

export const SIM_START = Date.parse('2026-10-15T09:00:00.000Z');

export type ScriptStep =
  | { at: number; actor: string; command: TableCommand }
  | { at: number; actor: 'server'; timeout: true };

export interface TableScript {
  create: CreateTableInput;
  /** The time the table was created, epoch milliseconds. */
  startAt: number;
  steps: ScriptStep[];
}

export interface TableSimConfig {
  players: number;
  seed: number;
  settings?: TableSettingsInput;
  /** One policy per seat, repeated if fewer than players; default: the strategy lab's presets in turn. */
  policies?: Policy[];
  /** Seats that never answer in time: the server plays their turn after the clock runs out. */
  slowSeats?: number[];
  /** Stop after this many commands (a game that has not ended by then is cut off). */
  maxCommands?: number;
  /** Milliseconds each command takes. */
  stepMs?: number;
  /** What a table needs from outside, without the clock (the simulation provides that). */
  context: Omit<TableContext, 'clock'>;
}

export interface TableSimResult {
  table: Table;
  events: TableEvent[];
  script: TableScript;
  commands: number;
  timeouts: number;
  /** Anything that broke an invariant along the way; empty is the point. */
  problems: string[];
  /** The game was cut off by `maxCommands`. */
  cutOff: boolean;
}

const isoDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const withClock = (base: Omit<TableContext, 'clock'>, ms: number): TableContext => ({
  ...base,
  clock: fixedClock(isoDay(ms), new Date(ms).toISOString()),
});

// ── Invariants ─────────────────────────────────────────────────────────────────────────────────────

/** What must hold after every accepted command. `previous` is the table before it (null for the first). */
export function tableInvariantProblems(table: Table, previous: Table | null): string[] {
  const problems: string[] = [];
  const bad = (message: string) => problems.push(`v${table.version}: ${message}`);

  if (previous && table.version !== previous.version + 1) {
    bad(`version went ${previous.version} -> ${table.version}`);
  }
  if (previous && table.tableRound < previous.tableRound) bad('the table round went backwards');
  if (previous && previous.phase === 'finished' && table.phase !== 'finished') {
    bad('a finished game started again');
  }

  const ids = table.players.map((p) => p.id);
  if (new Set(ids).size !== ids.length) bad('two players share an id');
  if (new Set(table.players.map((p) => p.color)).size !== table.players.length) {
    bad('two players share a colour');
  }

  if (table.phase === 'playing') {
    const active = table.players.find((p) => p.id === table.activePlayerId);
    if (!active) bad('nobody is on the move in a running game');
    else if (active.status !== 'active') bad('a player who left is on the move');
    else if (active.books && currentTurn(active.books.state).phase === 'over') {
      bad('a player who is out is on the move');
    }
    if (table.order.length !== table.players.length) bad('the turn order lost a player');
  }
  if (table.phase === 'finished') {
    if (!table.result) bad('a finished game has no result');
    else {
      const ranks = table.result.ranking.map((r) => r.rank);
      if (ranks.join() !== ids.map((_, i) => i + 1).join()) bad('the ranking is not 1..N');
      if (new Set(table.result.ranking.map((r) => r.playerId)).size !== ids.length) {
        bad('the ranking does not list everybody once');
      }
    }
    if (table.activePlayerId !== null) bad('a finished game still has a player on the move');
  }

  const finisherIds = table.finishers.map((f) => f.playerId);
  if (new Set(finisherIds).size !== finisherIds.length) bad('a player finished twice');
  for (const player of table.players) {
    const turn = player.books ? currentTurn(player.books.state) : null;
    if (turn?.phase === 'over' && !finisherIds.includes(player.id)) {
      bad(`${player.name} is out but not recorded as a finisher`);
    }
  }

  // The piles: every drawn card is in its deck, and none twice.
  const gameSet = table.players.find((p) => p.books?.gameSet)?.books?.gameSet;
  if (gameSet) {
    for (const deck of ['dealSmall', 'dealBig', 'market', 'doodad'] as const) {
      const pile = table.drawnCardIds[deck];
      const known = new Set((gameSet.decks?.[deck] ?? []).map((c) => c.id));
      if (new Set(pile).size !== pile.length) bad(`${deck}: a card is in the pile twice`);
      if (pile.some((id) => !known.has(id)))
        bad(`${deck}: the pile holds a card that is not in the deck`);
    }
  }

  for (const player of table.players) {
    const books = player.books;
    if (!books) continue;
    const money = [
      ...books.transactions.map((t) => t.amountMinor),
      ...books.subscriptions.map((s) => s.amountMinor),
      ...books.liabilities.map((l) => l.amountMinor),
    ];
    if (money.some((m) => !Number.isInteger(m)))
      bad(`${player.name}: money that is not whole minor units`);
    if (!Number.isFinite(cashOnHandMinor(books.transactions, books.allocation))) {
      bad(`${player.name}: cash is not a number`);
    }
    const before = previous?.players.find((p) => p.id === player.id)?.books;
    if (before && currentTurn(books.state).count < currentTurn(before.state).count) {
      bad(`${player.name}: the roll count went backwards`);
    }
    if (books.state.children > 3) bad(`${player.name}: more than 3 children`);
  }
  return problems;
}

/** What the view of a table shows a viewer must never contain another player's account id or the dice stream. */
export function leakProblems(table: Table): string[] {
  const problems: string[] = [];
  for (const viewer of table.players) {
    const json = JSON.stringify(projectFor(table, viewer.id));
    for (const other of table.players) {
      if (json.includes(other.id))
        problems.push(`the view for ${viewer.name} contains an account id`);
    }
    if (json.includes('rngState'))
      problems.push(`the view for ${viewer.name} contains the dice stream`);
  }
  return [...new Set(problems)];
}

/** A short stable fingerprint of where a table stands (FNV-1a), to pin a replayed game. */
export function digestTable(table: Table): string {
  const parts = [
    table.version,
    table.phase,
    table.tableRound,
    table.rngState,
    table.result?.reason ?? '',
    ...(table.result?.ranking.map(
      (r) => `${r.rank}:${r.playerId}:${r.outcome}:${r.passiveIncomeMinor}`,
    ) ?? []),
    ...table.players.map((p) => {
      const books = p.books;
      if (!books) return p.id;
      const finances = summarizeGameFinances(books.state, books.subscriptions);
      return [
        p.id,
        p.professionId,
        cashOnHandMinor(books.transactions, books.allocation),
        finances.passiveIncomeMinor,
        finances.expensesMinor,
        books.state.boardPosition,
        currentTurn(books.state).count,
        books.state.round,
      ].join(':');
    }),
  ].join('|');
  let hash = 0x811c9dc5;
  for (let i = 0; i < parts.length; i += 1) {
    hash ^= parts.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

// ── Policies at a table ────────────────────────────────────────────────────────────────────────────

function viewOf(books: GameBooks): PolicyView {
  const finances = summarizeGameFinances(books.state, books.subscriptions);
  const rule = books.gameSet?.loanRule;
  return {
    books,
    cashMinor: cashOnHandMinor(books.transactions, books.allocation),
    finances,
    bankLoanMinor: books.liabilities.find((l) => l.tag === 'Bank loan')?.amountMinor ?? 0,
    loanStepMinor: rule?.incrementMinor ?? 0,
    loanInterestPercent: rule?.monthlyInterestPercent ?? 0,
    round: books.state.round,
    turn: currentTurn(books.state).count,
    children: books.state.children,
    charityRoundsLeft: books.state.charityRoundsLeft,
  };
}

const cardOf = (books: GameBooks, deck: string, cardId: string) =>
  (books.gameSet?.decks?.[deck as 'dealSmall'] as { id: string }[] | undefined)?.find(
    (c) => c.id === cardId,
  );

/** The next command a policy plays for the player on the move, or null when their turn is over. */
function decide(
  table: Table,
  playerId: string,
  policy: Policy,
  coin: () => number,
): TableCommand | null {
  const books = table.players.find((p) => p.id === playerId)?.books;
  if (!books || table.activePlayerId !== playerId) return null;
  const turn = currentTurn(books.state);
  if (turn.phase === 'over') return null;
  const view = viewOf(books);

  if (turn.phase === 'roll') {
    const waiting = openDecisions(books.state);
    if (waiting.length > 0) return { type: 'roll_decision', title: waiting[0].title };
    return { type: 'roll', dice: books.state.charityRoundsLeft > 0 ? policy.dice(view) : 1 };
  }
  const pending = turn.pending;
  if (!pending) return null;
  const waiting = openDecisions(books.state);
  if (waiting.length > 0 && whyDiceFirst(books.state)) {
    return { type: 'roll_decision', title: waiting[0].title };
  }
  if (pending.kind === 'deal') {
    if (!pending.offered) return { type: 'draw_card', deck: policy.pile(view, coin) };
    const card = cardOf(books, pending.offered.deck, pending.offered.cardId) as CashflowDealCard;
    const choice = policy.deal(view, card);
    return choice.buy
      ? { type: 'buy_deal', cardId: card.id, quantity: choice.quantity }
      : { type: 'pass_card' };
  }
  if (pending.kind === 'doodad') {
    return pending.offered
      ? { type: 'pay_doodad', cardId: pending.offered.cardId }
      : { type: 'draw_card', deck: 'doodad' };
  }
  return { type: 'pass_card' };
}

// ── The run ────────────────────────────────────────────────────────────────────────────────────────

/** Plays a whole table from the lobby to the end (or the cut-off). Deterministic from the config. */
export function simulateTable(config: TableSimConfig): TableSimResult {
  const stepMs = config.stepMs ?? 1000;
  const maxCommands = config.maxCommands ?? 20_000;
  const policies = config.policies ?? PRESET_POLICIES;
  const slow = new Set(config.slowSeats ?? []);
  const coin = seededRng(config.seed ^ 0x5eed);
  const ids = Array.from({ length: config.players }, (_, i) => `acct-sim-${i}`);

  let now = SIM_START;
  let table!: Table;
  const events: TableEvent[] = [];
  const problems: string[] = [];
  const steps: ScriptStep[] = [];
  let commands = 0;
  let timeouts = 0;
  let lastRefusal = '';

  const accept = (result: CommandResult) => {
    const found = tableInvariantProblems(result.table, commands === 0 ? null : table);
    if (found.length > 0 && problems.length < 20) problems.push(...found);
    if (commands % 40 === 0 && problems.length < 20) problems.push(...leakProblems(result.table));
    table = result.table;
    events.push(...result.events);
    commands += 1;
    now += stepMs;
  };

  const create: CreateTableInput = {
    id: 'sim-table',
    hostId: ids[0],
    hostName: 'Player 0',
    settings: {
      name: 'Simulated table',
      professions: 'random',
      turnOrder: 'random',
      maxSeats: Math.max(2, config.players),
      clock: { mode: 'per-move', secondsPerMove: 120 },
      ...config.settings,
    },
    seed: config.seed,
  };
  const created = createTable(create, withClock(config.context, now));
  accept(created);

  /** Applies a command, records it in the script, and says whether it was accepted. */
  const send = (actor: string, command: TableCommand): boolean => {
    try {
      const at = now;
      const result = applyCommand(table, actor, command, withClock(config.context, at));
      steps.push({ at, actor, command });
      accept(result);
      return true;
    } catch (error) {
      if (error instanceof TableCommandError) {
        lastRefusal = `${error.code}: ${error.message}`;
        return false;
      }
      throw error;
    }
  };

  for (let i = 1; i < config.players; i += 1) {
    send(ids[i], { type: 'join', name: `Player ${i}` });
    send(ids[i], { type: 'set_ready', ready: true });
  }
  send(ids[0], { type: 'start' });

  const sellIntoOffers = () => {
    for (const player of table.players) {
      const books = player.books;
      if (!books || player.status !== 'active' || currentTurn(books.state).phase === 'over')
        continue;
      const policy = policies[ids.indexOf(player.id) % policies.length];
      for (const move of policy.maintain(viewOf(books))) {
        if (move.kind === 'sell') send(player.id, { type: 'sell_position', input: move.input });
      }
    }
  };

  while (table.phase === 'playing' && commands < maxCommands) {
    const current = table;
    const who = current.activePlayerId as string;
    const seat = ids.indexOf(who);
    const policy = policies[seat % policies.length];

    // A slow player lets the whole turn run out; the server plays it for them.
    if (slow.has(seat) && !current.turnRolled) {
      const deadline = nextDeadline(current);
      if (deadline !== null) {
        now = Math.max(now, deadline + 1);
        const at = now;
        const result = applyTimeout(current, withClock(config.context, at));
        steps.push({ at, actor: 'server', timeout: true });
        accept(result);
        timeouts += 1;
        continue;
      }
    }

    // Between rolls: pay the bank back and sell where a buyer is waiting.
    const books = current.players.find((p) => p.id === who)!.books!;
    if (currentTurn(books.state).phase === 'roll') {
      for (const move of policy.maintain(viewOf(books))) {
        if (move.kind === 'sell') send(who, { type: 'sell_position', input: move.input });
        else send(who, { type: 'bank_loan', amountMinor: -move.amountMinor });
      }
    }
    const fresh = table;
    if (fresh.activePlayerId !== who) continue;
    const command = decide(fresh, who, policy, coin);
    if (!command) {
      problems.push(`v${fresh.version}: nothing to play for ${who}`);
      break;
    }
    const eventsBefore = events.length;
    if (!send(who, command)) {
      // The rules refused (no cash for the card): fall back to the passive move, which always exists.
      const fallback = nextPassiveCommand(fresh, who) ?? ({ type: 'pass_card' } as TableCommand);
      const pass: TableCommand = command.type === 'buy_deal' ? { type: 'pass_card' } : fallback;
      if (!send(who, pass)) {
        problems.push(
          `v${fresh.version}: ${who} could not play ${command.type} nor ${pass.type} (${lastRefusal})`,
        );
        break;
      }
    }
    // A card for the whole table was just read out: everybody who can sells into it.
    if (events.slice(eventsBefore).some((e) => e.type === 'market_effect')) sellIntoOffers();
  }

  const final = table;
  problems.push(...leakProblems(final));
  return {
    table: final,
    events,
    script: { create, startAt: SIM_START, steps },
    commands,
    timeouts,
    problems: [...new Set(problems)],
    cutOff: final.phase === 'playing',
  };
}

/** Plays a recorded script again from nothing: the same table and the same events, or the game's rules have changed. */
export function replayScript(
  script: TableScript,
  context: Omit<TableContext, 'clock'>,
): { table: Table; events: TableEvent[] } {
  const created = createTable(script.create, withClock(context, script.startAt));
  let table = created.table;
  const events = [...created.events];
  for (const step of script.steps) {
    const ctx = withClock(context, step.at);
    const result =
      'timeout' in step
        ? applyTimeout(table, ctx)
        : applyCommand(table, step.actor, step.command, ctx);
    table = result.table;
    events.push(...result.events);
  }
  return { table, events };
}
