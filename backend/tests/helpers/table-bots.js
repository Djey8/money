'use strict';

/**
 * A harness of scripted clients for the multiplayer tables (todo/cashflow-multiplayer.md slice S6). Each bot is what a browser or
 * an agent would be: it holds a token, follows its table on the **live stream** (never by polling), decides what to do only from
 * the `legalActions` the table tells it, and sends moves over plain HTTP with a `clientCommandId`. Nothing here reaches into the
 * server: a game played with these bots is a game played through the public API.
 *
 * The harness also does what a flaky network does to real clients - sends the same move twice at once, drops a stream and
 * reconnects with `Last-Event-ID`, keeps retrying through a server restart - and checks what must hold afterwards: every bot saw
 * every version in order, the table each bot rebuilt from snapshot + updates equals the table the server serves, and the log has
 * no gap.
 */

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Merges an update's table view into the view a bot holds: a player entry without `books` keeps the books it had. */
function mergeView(previous, incoming) {
  if (!previous) return incoming;
  return {
    ...incoming,
    players: incoming.players.map((player, seat) =>
      Object.prototype.hasOwnProperty.call(player, 'books')
        ? player
        : { ...player, books: previous.players[seat] ? previous.players[seat].books : null },
    ),
  };
}

class TableBot {
  /**
   * @param {object} options
   * @param {string} options.name
   * @param {string} options.token
   * @param {() => string} options.baseUrl  the server's address, read at each request (it can move when the server restarts)
   * @param {string} options.roomId
   */
  constructor({ name, token, baseUrl, roomId, rng = Math.random }) {
    this.name = name;
    this.token = token;
    this.baseUrl = baseUrl;
    this.roomId = roomId;
    this.rng = rng;
    this.view = null;
    this.legalActions = [];
    this.room = null;
    this.lastSeq = 0;
    this.presence = { seats: [] };
    /** seq -> event, from updates and log lines */
    this.events = new Map();
    /** Everything that went wrong in what the stream delivered. */
    this.problems = [];
    this.messages = [];
    this.connections = 0;
    this.commandCount = 0;
    this.streamAbort = null;
    this.wantStream = false;
    this.slow = false;
    this.lastVersionOnConnection = null;
    this.firstSnapshotSeq = undefined;
  }

  get seat() {
    return this.view ? this.view.youSeat : null;
  }

  isMyTurn() {
    return (
      this.view !== null &&
      this.view.phase === 'playing' &&
      this.view.activeSeat === this.view.youSeat
    );
  }

  can(action) {
    return this.legalActions.some((a) => a.action === action);
  }

  headers() {
    return { Authorization: `Bearer ${this.token}`, 'Content-Type': 'application/json' };
  }

  // ── The stream ───────────────────────────────────────────────────────────────────────────────

  /** Opens the stream and keeps it open: if it drops, it is opened again with `Last-Event-ID` until `disconnect()`. */
  connect() {
    this.wantStream = true;
    this.loop = this.runStream();
    return this.waitFor((bot) => bot.view !== null, 10000);
  }

  disconnect() {
    this.wantStream = false;
    if (this.streamAbort) this.streamAbort.abort();
  }

  /** Drops the connection (a network blip) but keeps wanting the stream: it comes back by itself. */
  blip() {
    if (this.streamAbort) this.streamAbort.abort();
  }

  async runStream() {
    while (this.wantStream) {
      this.streamAbort = new AbortController();
      try {
        const headers = { Authorization: `Bearer ${this.token}` };
        if (this.lastSeq > 0) headers['Last-Event-ID'] = String(this.lastSeq);
        const res = await fetch(`${this.baseUrl()}/api/v1/game/rooms/${this.roomId}/events`, {
          headers,
          signal: this.streamAbort.signal,
        });
        if (res.status !== 200) {
          this.problems.push(`stream refused with ${res.status}`);
          await sleep(100);
          continue;
        }
        this.connections += 1;
        this.lastVersionOnConnection = null;
        await this.readStream(res);
      } catch {
        // the connection dropped or the server is away: try again shortly
      }
      if (this.wantStream) await sleep(50);
    }
  }

  async readStream(res) {
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    for (;;) {
      const { done, value } = await reader.read();
      if (done) return;
      buffer += decoder.decode(value, { stream: true });
      let at;
      while ((at = buffer.indexOf('\n\n')) >= 0) {
        const block = buffer.slice(0, at);
        buffer = buffer.slice(at + 2);
        const message = {};
        for (const line of block.split('\n')) {
          if (line.startsWith('id: ')) message.id = Number(line.slice(4));
          else if (line.startsWith('event: ')) message.event = line.slice(7);
          else if (line.startsWith('data: ')) message.data = JSON.parse(line.slice(6));
        }
        if (message.event) this.handle(message);
      }
    }
  }

  handle(message) {
    this.messages.push(message.event);
    const { data } = message;
    switch (message.event) {
      case 'snapshot':
        this.view = data.view;
        this.legalActions = data.legalActions;
        this.room = data.room;
        this.lastSeq = Math.max(this.lastSeq, message.id || 0);
        if (this.firstSnapshotSeq === undefined) this.firstSnapshotSeq = message.id || 0;
        this.lastVersionOnConnection = data.view.version;
        break;
      case 'log':
        this.events.set(data.seq, data);
        break;
      case 'update':
        if (
          this.lastVersionOnConnection !== null &&
          data.version !== this.lastVersionOnConnection + 1
        ) {
          this.problems.push(
            `update jumped from ${this.lastVersionOnConnection} to ${data.version}`,
          );
        }
        this.lastVersionOnConnection = data.version;
        this.view = mergeView(this.view, data.view);
        this.legalActions = data.legalActions;
        for (const event of data.events) this.events.set(event.seq, event);
        if (message.id) this.lastSeq = Math.max(this.lastSeq, message.id);
        break;
      case 'presence':
        this.presence = data;
        break;
      default:
        break;
    }
  }

  async waitFor(predicate, ms = 5000) {
    const until = Date.now() + ms;
    while (Date.now() < until) {
      if (predicate(this)) return;
      await sleep(5);
    }
    throw new Error(`${this.name}: timed out waiting (version ${this.view && this.view.version})`);
  }

  waitForVersion(version, ms = 5000) {
    return this.waitFor((bot) => bot.view !== null && bot.view.version >= version, ms);
  }

  // ── Moves ────────────────────────────────────────────────────────────────────────────────────

  /**
   * Sends a move. A network error (the server is restarting) is retried with the **same** `clientCommandId`, which is what makes
   * that safe: if the first attempt was applied after all, the retry is answered with `replayed: true`.
   */
  async send(command, { id, expectedVersion } = {}) {
    this.commandCount += 1;
    const clientCommandId = id || `${this.name}-${this.commandCount}`;
    const body = JSON.stringify({
      command,
      clientCommandId,
      ...(expectedVersion !== undefined ? { expectedVersion } : {}),
    });
    for (let attempt = 0; attempt < 60; attempt += 1) {
      try {
        const res = await fetch(`${this.baseUrl()}/api/v1/game/rooms/${this.roomId}/commands`, {
          method: 'POST',
          headers: this.headers(),
          body,
        });
        return {
          status: res.status,
          body: await res.json(),
          clientCommandId,
          attempts: attempt + 1,
        };
      } catch {
        await sleep(100);
      }
    }
    throw new Error(`${this.name}: the server never came back`);
  }

  async post(path, payload = {}) {
    const res = await fetch(`${this.baseUrl()}/api/v1/game/rooms/${this.roomId}${path}`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(payload),
    });
    return { status: res.status, body: await res.json() };
  }

  async get(path = '') {
    const res = await fetch(`${this.baseUrl()}/api/v1/game/rooms/${this.roomId}${path}`, {
      headers: this.headers(),
    });
    return { status: res.status, body: await res.json() };
  }

  // ── Deciding ─────────────────────────────────────────────────────────────────────────────────

  /** My books as the table shows them (public: every player's are). */
  mine() {
    return this.view && this.view.players[this.seat] ? this.view.players[this.seat].books : null;
  }

  /**
   * What this bot does next, from what the table says it may do - or null. A bot never guesses: if the action is not in
   * `legalActions` it does not try it.
   */
  decide() {
    const state = this.mine() ? this.mine().state : null;
    // selling into an offer open for me, on or off my turn
    if (
      this.can('sell_position') &&
      state &&
      (state.marketOffers || []).length > 0 &&
      this.rng() < 0.8
    ) {
      return { type: 'sell_position', input: { title: state.marketOffers[0].title } };
    }
    // answering a trade
    if (this.can('accept_trade') && this.can('decline_trade')) {
      return this.rng() < 0.5 ? { type: 'accept_trade' } : { type: 'decline_trade' };
    }
    // the turn is over and the table waits for the people who can still sell: a player says done
    if (this.can('done')) return { type: 'done' };
    if (!this.isMyTurn()) return null;
    if (this.can('roll_decision')) return { type: 'roll_decision' };
    if (this.can('roll')) return { type: 'roll' };
    const pending = state && state.turn ? state.turn.pending : null;
    if (this.can('draw_card') && pending) {
      const deck =
        pending.kind === 'doodad'
          ? 'doodad'
          : pending.kind === 'market'
            ? 'market'
            : this.rng() < 0.7
              ? 'dealSmall'
              : 'dealBig';
      return { type: 'draw_card', deck };
    }
    if (this.can('pay_doodad') && pending && pending.offered)
      return { type: 'pay_doodad', cardId: pending.offered.cardId };
    if (this.can('buy_deal') && pending && pending.offered && this.rng() < 0.5) {
      return { type: 'buy_deal', cardId: pending.offered.cardId };
    }
    if (this.can('offer_trade') && this.rng() < 0.3)
      return { type: 'offer_trade', priceMinor: 50000 };
    if (this.can('finish_card')) return { type: 'finish_card' };
    if (this.can('pass_card')) return { type: 'pass_card' };
    return null;
  }
}

/**
 * Plays a table with bots until it is over. `chaos` switches on what real networks do:
 *   duplicateEvery  send every Nth move twice at the same moment
 *   blipEvery       drop a bystander's stream every Nth move (it reconnects with Last-Event-ID)
 *   restartAt       call `restart()` at that move (the server goes down and comes back)
 * Returns what happened.
 */
async function playTable(
  bots,
  { maxMoves = 600, chaos = {}, restart, onMove, maxIdleMs = 25000 } = {},
) {
  const stats = { moves: 0, refused: 0, duplicates: 0, replays: 0, blips: 0, restarts: 0 };
  let idleSince = Date.now();
  while (stats.moves < maxMoves) {
    if (bots.every((bot) => bot.view && bot.view.phase !== 'playing')) break;
    // anyone who may sell or answer a trade does, then the mover plays
    const candidates = bots.filter(
      (bot) => !bot.slow && bot.view && bot.view.phase === 'playing' && bot.decide(),
    );
    const actor = candidates.find((bot) => bot.isMyTurn()) || candidates[0];
    if (!actor) {
      if (Date.now() - idleSince > maxIdleMs) throw new Error('nobody could move for too long');
      await sleep(10);
      continue;
    }
    idleSince = Date.now();
    const command = actor.decide();
    stats.moves += 1;

    if (chaos.restartAt && stats.moves === chaos.restartAt && restart) {
      stats.restarts += 1;
      await restart();
    }

    let result;
    if (chaos.duplicateEvery && stats.moves % chaos.duplicateEvery === 0) {
      const id = `${actor.name}-dup-${stats.moves}`;
      const [a, b] = await Promise.all([actor.send(command, { id }), actor.send(command, { id })]);
      stats.duplicates += 1;
      result = a.status === 200 ? a : b;
      if (a.status === 200 && b.status === 200) {
        if (a.body.appliedVersion !== b.body.appliedVersion)
          throw new Error('duplicate applied twice');
        if (a.body.replayed === b.body.replayed) throw new Error('duplicate was not recognised');
        stats.replays += 1;
      }
    } else {
      result = await actor.send(command);
    }

    if (result.status !== 200) {
      stats.refused += 1;
      // the rules refused (not enough cash to buy): the fallback is always allowed
      if (actor.can('pass_card')) await actor.send({ type: 'pass_card' });
    }
    if (onMove) await onMove(actor, command, result, stats);

    if (chaos.blipEvery && stats.moves % chaos.blipEvery === 0) {
      const bystander = bots.find((bot) => bot !== actor && bot.connections > 0);
      if (bystander) {
        bystander.blip();
        stats.blips += 1;
      }
    }
    // the move is on every bot's screen before the next one
    const version = result.body && result.body.appliedVersion;
    if (version) {
      await Promise.all(bots.map((bot) => bot.waitForVersion(version, 15000)));
    }
  }
  return stats;
}

/** What must be true of every bot after a game, however rough the network was. Returns a list of problems (empty is the point). */
async function verifyBots(bots) {
  const problems = [];
  const log = [];
  for (let after = 0; ;) {
    const page = (await bots[0].get(`/log?after=${after}&limit=1000`)).body;
    log.push(...page.events);
    after = page.next;
    if (page.end) break;
  }
  if (log.some((event, index) => event.seq !== index + 1)) problems.push('the log has a gap');

  for (const bot of bots) {
    for (const problem of bot.problems) problems.push(`${bot.name}: ${problem}`);
    const mine = (await bot.get()).body;
    await bot
      .waitForVersion(mine.table.version, 10000)
      .catch(() => problems.push(`${bot.name}: never caught up`));
    if (bot.view.version !== mine.table.version)
      problems.push(
        `${bot.name}: at version ${bot.view.version}, the server is at ${mine.table.version}`,
      );
    // the table rebuilt from a snapshot and updates is the table the server serves
    const rebuilt = JSON.parse(JSON.stringify(bot.view));
    const served = JSON.parse(JSON.stringify(mine.table));
    if (JSON.stringify(rebuilt) !== JSON.stringify(served))
      problems.push(`${bot.name}: the rebuilt table differs from the served one`);
    // every event after the bot first connected reached it, once, in a stream or a replay (earlier ones are in its snapshot)
    const missing = log
      .filter((event) => event.seq > bot.firstSnapshotSeq && !bot.events.has(event.seq))
      .map((event) => event.seq);
    if (missing.length > 0)
      problems.push(`${bot.name}: missed events ${missing.slice(0, 5).join(', ')}`);
  }
  return problems;
}

module.exports = { TableBot, playTable, verifyBots, mergeView, sleep };
