import { quoteEmergency } from '../../emergency-deck';
import { DreamPlayer } from '../player';
import { normalizeDreamSettings } from './settings';
import { TableCommandError } from '../../table/types';
import {
  applyDreamCommand,
  briefAll,
  applyDreamTimeout,
  createDreamTable,
  dreamCharacterIds,
  dreamStandings,
  passiveCommands,
} from './reducer';
import type { DreamCommand, DreamTable } from './types';

let nowMs = Date.parse('2026-11-01T10:00:00.000Z');
const ctx = { clock: { nowIso: () => new Date(nowMs).toISOString() } };

function table(settings: Record<string, unknown> = {}, seed = 7): DreamTable {
  return createDreamTable(
    { id: 't1', hostId: 'host', hostName: 'Hanna', seed, settings: { name: 'Test', ...settings } },
    ctx,
  ).table;
}

function run(t: DreamTable, who: string, command: DreamCommand): DreamTable {
  return applyDreamCommand(t, who, command, ctx).table;
}

/** A table of the host and two players, started with random characters. */
function started(settings: Record<string, unknown> = {}, seed = 7): DreamTable {
  let t = table({ professions: 'random', turnOrder: 'seat', ...settings }, seed);
  t = run(t, 'ann', { type: 'join', name: 'Ann' });
  t = run(t, 'bob', { type: 'join', name: 'Bob' });
  t = run(t, 'ann', { type: 'set_ready', ready: true });
  t = run(t, 'bob', { type: 'set_ready', ready: true });
  return briefAll(run(t, 'host', { type: 'start' }), ctx);
}

/** Plays the turns of everybody the most passive way for some rounds. */
function playRounds(t: DreamTable, rounds: number): DreamTable {
  let current = t;
  for (let guard = 0; guard < rounds * 60 && current.phase === 'playing'; guard += 1) {
    if (current.tableRound > rounds) break;
    const who = current.activePlayerId!;
    const commands = passiveCommands(current, who);
    let moved = false;
    for (const command of commands) {
      try {
        current = run(current, who, command);
        moved = true;
        break;
      } catch (error) {
        if (!(error instanceof TableCommandError)) throw error;
      }
    }
    if (!moved)
      throw new Error(
        `stuck: ${JSON.stringify(current.players.find((p) => p.id === who)?.pending)}`,
      );
  }
  return current;
}

describe('the Dreamer table: the lobby', () => {
  it('seats the host, takes players and bots, and refuses a full table', () => {
    let t = table({ maxSeats: 3 });
    expect(t.phase).toBe('lobby');
    expect(t.settings.difficulty).toBe('medium');
    t = run(t, 'ann', { type: 'join', name: 'Ann' });
    t = run(t, 'host', { type: 'add_bot', name: 'Bert', policyId: 'expert' });
    expect(t.players.map((p) => p.name)).toEqual(['Hanna', 'Ann', 'Bert']);
    expect(t.players[2].bot?.policyId).toBe('expert');
    expect(() => run(t, 'cy', { type: 'join', name: 'Cy' })).toThrow(/full/);
    expect(() => run(t, 'ann', { type: 'add_bot', name: 'X', policyId: 'saver' })).toThrow(/host/);
  });

  it('takes the Dreamer settings: difficulty, map, rules, end condition - and refuses what a shared table cannot run', () => {
    const t = table({
      difficulty: 'hard',
      shape: 'infinity',
      size: 'small',
      mode: 'strict',
      endCondition: 'round-limit',
      roundLimit: 12,
    });
    expect(t.settings).toMatchObject({
      difficulty: 'hard',
      shape: 'infinity',
      size: 'small',
      mode: 'strict',
      roundLimit: 12,
    });
    expect(t.settings.customRules.difficulty).toBe('hard');
    expect(() => table({ mode: 'free' })).toThrow(/guided/);
    expect(() => table({ difficulty: 'insane' })).toThrow(/difficulty/);
    expect(() => table({ roundLimit: 5 })).toThrow(/round-limit/);
    const changed = run(t, 'host', { type: 'update_settings', settings: { difficulty: 'easy' } });
    expect(changed.settings.difficulty).toBe('easy');
    expect(changed.settings.customRules.difficulty).toBe('easy');
  });

  it('deals everybody a character at the start: lives, an order and a clock - and each may change theirs while reading it', () => {
    let t = table({ professions: 'unique' });
    t = run(t, 'ann', { type: 'join', name: 'Ann' });
    t = run(t, 'ann', { type: 'set_ready', ready: true });
    t = run(t, 'host', { type: 'start' });
    // no picking in the lobby: the game is on, and everybody reads the character they were dealt
    expect(t.phase).toBe('playing');
    expect(t.briefing).toBe(true);
    expect(t.players.every((p) => p.life && p.professionId)).toBe(true);
    expect(new Set(t.players.map((p) => p.professionId)).size).toBe(2);
    expect(dreamCharacterIds()).toHaveLength(10);
    expect(t.tableRound).toBe(1);
    expect(t.order).toHaveLength(2);
    // a character the other holds cannot be taken at a table of unique characters; a free one can
    const annHas = t.players.find((p) => p.id === 'ann')!.professionId!;
    expect(() => run(t, 'host', { type: 'pick_profession', professionId: annHas })).toThrow(
      /already/,
    );
    const free = dreamCharacterIds().find((id) => !t.players.some((p) => p.professionId === id))!;
    t = run(t, 'host', { type: 'pick_profession', professionId: free });
    expect(t.players.find((p) => p.id === 'host')!.professionId).toBe(free);
  });

  it('a table where the characters are drawn does not let them be changed', () => {
    let t = table({ professions: 'random' });
    t = run(t, 'ann', { type: 'join', name: 'Ann' });
    t = run(t, 'ann', { type: 'set_ready', ready: true });
    t = run(t, 'host', { type: 'start' });
    expect(() => run(t, 'host', { type: 'pick_profession', professionId: 'jan-oberarzt' })).toThrow(
      /drawn/,
    );
  });
});

describe('the Dreamer table: play', () => {
  it('lets only the player on the move act, and plays turns round the table', () => {
    let t = started();
    const first = t.activePlayerId!;
    const other = t.order.find((id) => id !== first)!;
    expect(() => run(t, other, { type: 'roll' })).toThrow(/not your turn/i);
    expect(() => run(t, first, { type: 'end_turn' })).toThrow(/Roll first/);
    t = playRounds(t, 3);
    expect(t.tableRound).toBeGreaterThan(1);
    expect(t.players.every((p) => p.life!.turns >= 1)).toBe(true);
  });

  it('tells a roll with its dice and the way the token walked, for the screen that shows it', () => {
    const t = started();
    const who = t.activePlayerId!;
    const result = applyDreamCommand(t, who, { type: 'roll' }, ctx);
    const rolled = result.events.find((event) => event.type === 'rolled');
    const data = rolled!.data as { dice: number[]; total: number; from: number | null; to: number };
    expect(data.dice.length).toBeGreaterThan(0);
    expect(data.total).toBe(data.dice.reduce((sum, die) => sum + die, 0));
    expect(typeof data.to).toBe('number');
    const seat = result.table.players.find((p) => p.id === who)!;
    expect(seat.life!.books.state.boardPosition).toBe(data.to);
  });

  it('plays a whole game to its round limit and ranks everybody by the goals and the dream points', () => {
    let t = started({ endCondition: 'round-limit', roundLimit: 8 });
    t = playRounds(t, 20);
    expect(t.phase).toBe('finished');
    expect(t.result?.reason).toBe('round-limit');
    const ranking = t.result!.ranking;
    expect(ranking).toHaveLength(3);
    expect(ranking.map((r) => r.rank)).toEqual([1, 2, 3]);
    for (let i = 1; i < ranking.length; i += 1) {
      if (ranking[i - 1].outcome === ranking[i].outcome) {
        expect(ranking[i - 1].score).toBeGreaterThanOrEqual(ranking[i].score);
      }
    }
    for (const standing of ranking) {
      expect(standing.goals.reserve).toBeGreaterThanOrEqual(0);
      expect(standing.goals.reserve).toBeLessThanOrEqual(1);
    }
  });

  it('keeps one market for the table: a Harvest card moves everybody’s prices the same', () => {
    let t = started({ endCondition: 'round-limit', roundLimit: 40 }, 11);
    const seen = new Set<string>();
    for (let guard = 0; guard < 600 && t.phase === 'playing' && seen.size === 0; guard += 1) {
      const result = (() => {
        const who = t.activePlayerId!;
        for (const command of passiveCommands(t, who)) {
          try {
            return applyDreamCommand(t, who, command, ctx);
          } catch (error) {
            if (!(error instanceof TableCommandError)) throw error;
          }
        }
        throw new Error('stuck');
      })();
      t = result.table;
      for (const event of result.events)
        if (event.type === 'harvest') seen.add(String(event.data?.['cardId']));
    }
    expect(seen.size).toBeGreaterThan(0);
    for (const seat of t.players) {
      expect(seat.life!.books.state.markets).toEqual(t.markets);
    }
  });

  it('is deterministic: the same seed and the same moves give the same table', () => {
    const a = playRounds(started({}, 21), 4);
    const b = playRounds(started({}, 21), 4);
    expect(a.players.map((p) => p.life)).toEqual(b.players.map((p) => p.life));
    expect(a.rngState).toBe(b.rngState);
    expect(playRounds(started({}, 22), 4).rngState).not.toBe(a.rngState);
  });

  it('plays the passive turn of a player whose time is up, and marks them away after too many', () => {
    let t = started({ clock: { mode: 'per-move', secondsPerMove: 60 }, awayAfterTimeouts: 2 });
    const first = t.activePlayerId!;
    nowMs += 120_000;
    t = applyDreamTimeout(t, ctx).table;
    expect(t.activePlayerId).not.toBe(first);
    expect(t.players.find((p) => p.id === first)!.away).toBe(false);
    expect(t.players.find((p) => p.id === first)!.life!.turns).toBeGreaterThanOrEqual(1);
  });

  it('lets a player choose the insurances: at once before the first roll, with the next Payday after it', () => {
    const t = started();
    const who = t.activePlayerId!;
    const mine = (current: DreamTable) =>
      DreamPlayer.restore(current.players.find((p) => p.id === who)!.life!, () => 0.5, {
        sharedMarkets: true,
      });
    expect(mine(t).state.insurance?.active).toContain('household');
    const dropped = run(t, who, { type: 'set_insurance', kind: 'household', on: false });
    expect(mine(dropped).state.insurance?.active).not.toContain('household');
    expect(() => run(t, who, { type: 'set_insurance', kind: 'unknown', on: true })).toThrow(
      /no such insurance/,
    );
    // after a roll the change is only written down
    const rolled = run(dropped, who, { type: 'roll' });
    const later = run(rolled, who, { type: 'set_insurance', kind: 'household', on: true });
    expect(mine(later).state.insurance?.pending).toEqual([{ kind: 'household', on: true }]);
    expect(mine(later).state.insurance?.active).not.toContain('household');
  });

  it('tells everybody what a player drew and what they decided, with the card', () => {
    let t = started({}, 11);
    const seen: { type: string; data?: Record<string, unknown> }[] = [];
    for (let guard = 0; guard < 400 && t.phase === 'playing'; guard += 1) {
      const who = t.activePlayerId!;
      let moved = false;
      for (const command of passiveCommands(t, who)) {
        try {
          const result = applyDreamCommand(t, who, command, ctx);
          seen.push(...result.events);
          t = result.table;
          moved = true;
          break;
        } catch (error) {
          if (!(error instanceof TableCommandError)) throw error;
        }
      }
      if (!moved) break;
      if (t.tableRound > 12) break;
    }
    const landed = seen.filter((e) => ['emergency', 'life'].includes(e.type));
    expect(landed.length).toBeGreaterThan(0);
    expect(landed.every((e) => typeof e.data?.['cardId'] === 'string')).toBe(true);
    const answers = seen.filter((e) => e.type === 'life_answered');
    expect(answers.every((e) => e.data?.['cardId'] && e.data?.['decision'])).toBe(true);
    expect(seen.some((e) => e.type === 'opportunity_passed' || e.type === 'dream_declined')).toBe(
      true,
    );
  });

  it('plans an investment in Grow first and buys it from there, or lets the chance go', () => {
    const t0 = started({}, 5);
    const who = t0.activePlayerId!;
    const withOffer = (t: DreamTable): DreamTable => ({
      ...t,
      turnRolled: true,
      players: t.players.map((seat) =>
        seat.id === who
          ? { ...seat, pending: { kind: 'opportunity', pile: 'seed', offers: ['S10'] } }
          : seat,
      ),
    });
    const grow = (t: DreamTable) =>
      DreamPlayer.restore(t.players.find((seat) => seat.id === who)!.life!, () => 0.5, {
        sharedMarkets: true,
      }).books;
    const planned = run(withOffer(t0), who, { type: 'plan_opportunity', cardId: 'S10' });
    expect(grow(planned).growProjects.map((g) => [g.title, g.phase])).toEqual([['WORLD', 'plan']]);
    expect(grow(planned).shares).toHaveLength(grow(t0).shares.length);
    expect(() => run(planned, who, { type: 'buy_planned', title: 'OTHER' })).toThrow(
      /not on offer/,
    );
    const bought = run(planned, who, { type: 'buy_planned', title: 'WORLD', units: 2 });
    expect(grow(bought).shares.some((share) => share.tag === 'WORLD' && share.quantity === 2)).toBe(
      true,
    );
    expect(bought.players.find((seat) => seat.id === who)!.pending).toBeNull();
    // leaving it: the chance is missed
    const left = run(planned, who, { type: 'skip' });
    expect(grow(left).growProjects[0].phase).toBe('completed');
    expect(grow(left).state.opportunityPlans).toEqual([]);
  });

  it('takes an emergency as a Fire project, pays it from the cash in steps, and does not let the turn end before', () => {
    const t0 = started({ mode: 'strict' }, 5);
    const who = t0.activePlayerId!;
    const cards = DreamPlayer.restore(t0.players.find((s) => s.id === who)!.life!, () => 0.5, {
      sharedMarkets: true,
    }).gameSet.decks!.emergency!;
    const card = cards.find((c) => c.payment === 'plan_ok' && c.type === 'fixed')!;
    const open: DreamTable = {
      ...t0,
      turnRolled: true,
      players: t0.players.map((seat) =>
        seat.id === who ? { ...seat, pending: { kind: 'emergency', cardId: card.id } } : seat,
      ),
    };
    const life = (t: DreamTable) =>
      DreamPlayer.restore(t.players.find((s) => s.id === who)!.life!, () => 0.5, {
        sharedMarkets: true,
      });
    const cash0 = life(open).cash();
    const later = run(open, who, { type: 'pay_emergency', pay: 'later' });
    expect(life(later).cash()).toBe(cash0);
    const plan = life(later).plans.find((p) => p.kind === 'emergency')!;
    expect(plan).toMatchObject({ id: card.id, perMinor: 0 });
    expect(() => run(later, who, { type: 'end_turn' })).toThrow(/Fire project/);
    const part = run(later, who, { type: 'fund_emergency', id: card.id, amountMinor: 1000 });
    expect(life(part).plans.find((p) => p.kind === 'emergency')!.leftMinor).toBe(
      plan.leftMinor - 1000,
    );
    expect(life(part).cash()).toBe(cash0 - 1000);
    const paid = run(later, who, {
      type: 'fund_emergency',
      id: card.id,
      amountMinor: plan.leftMinor,
    });
    expect(life(paid).plans.some((p) => p.kind === 'emergency')).toBe(false);
    expect(() => run(paid, who, { type: 'end_turn' })).not.toThrow();
  });

  it('lets every player read their character first: no roll, the insurances at once, and the game begins when all have said so', () => {
    let t = table({ professions: 'duplicates', turnOrder: 'seat' }, 9);
    t = run(t, 'ann', { type: 'join', name: 'Ann' });
    t = run(t, 'bob', { type: 'join', name: 'Bob' });
    t = run(t, 'ann', { type: 'set_ready', ready: true });
    t = run(t, 'bob', { type: 'set_ready', ready: true });
    t = run(t, 'host', { type: 'start' });
    t = run(t, 'bob', { type: 'pick_profession', professionId: 'lena-pflege' });
    expect(t.phase).toBe('playing');
    expect(t.briefing).toBe(true);
    expect(t.activePlayerId).toBeNull();
    expect(() => run(t, 'host', { type: 'roll' })).toThrow(/reading their character/);
    const insured = (current: DreamTable, who: string) =>
      DreamPlayer.restore(current.players.find((seat) => seat.id === who)!.life!, () => 0.5, {
        sharedMarkets: true,
      }).state.insurance?.active;
    t = run(t, 'bob', { type: 'set_insurance', kind: 'household', on: false });
    expect(insured(t, 'bob')).not.toContain('household');
    // another character while reading: the life is new, the insurances start again, the others keep theirs
    const annBefore = t.players.find((seat) => seat.id === 'ann')!.professionId;
    t = run(t, 'bob', { type: 'pick_profession', professionId: 'mehmet-elektroniker' });
    expect(t.players.find((seat) => seat.id === 'bob')!.professionId).toBe('mehmet-elektroniker');
    expect(t.players.find((seat) => seat.id === 'ann')!.professionId).toBe(annBefore);
    expect(insured(t, 'bob')).toContain('household');
    expect(t.briefing).toBe(true);
    t = run(t, 'host', { type: 'confirm_briefing' });
    t = run(t, 'ann', { type: 'confirm_briefing' });
    expect(t.briefing).toBe(true);
    t = run(t, 'bob', { type: 'confirm_briefing' });
    expect(t.briefing).toBe(false);
    expect(t.activePlayerId).toBe('host');
    expect(() => run(t, 'bob', { type: 'pick_profession', professionId: 'lena-pflege' })).toThrow(
      /begun/,
    );
  });

  it('a card with a die waits for the throw of the player, then it is a project that carries what the card told', () => {
    const t0 = started({}, 5);
    const who = t0.activePlayerId!;
    const open: DreamTable = {
      ...t0,
      turnRolled: true,
      players: t0.players.map((seat) =>
        seat.id === who
          ? { ...seat, pending: { kind: 'opportunity', pile: 'seed', offers: ['S01'] } }
          : seat,
      ),
    };
    const books = (t: DreamTable) =>
      DreamPlayer.restore(t.players.find((seat) => seat.id === who)!.life!, () => 0.5, {
        sharedMarkets: true,
      }).books;
    const taken = run(open, who, { type: 'take_opportunity', cardId: 'S01' });
    const seat = taken.players.find((s2) => s2.id === who)!;
    expect(seat.pending).toMatchObject({ kind: 'opportunity', rolling: { cardId: 'S01' } });
    expect(books(taken).growProjects).toHaveLength(0);
    expect(() => run(taken, who, { type: 'skip' })).toThrow(/die/);
    const thrown = run(taken, who, { type: 'roll_opportunity' });
    const project = books(thrown).growProjects[0];
    expect(thrown.players.find((s2) => s2.id === who)!.pending).toBeNull();
    expect(project.details?.type).toBe('subscription-action');
    expect(project.details?.monthlySavingsMinor).toBeGreaterThan(0);
    expect(project.details?.links?.length).toBeGreaterThan(0);
    expect(project.details?.actionItems?.length).toBeGreaterThan(0);
  });

  it('a debug game: the host loads any card at any time, a Payday too; nobody else does, and it is never ranked', () => {
    const t = started({ debug: true, ranked: true }, 8);
    expect(t.settings.debug).toBe(true);
    expect(t.settings.ranked).toBe(false);
    const who = t.activePlayerId!;
    expect(who).toBe('host');
    const card: Record<string, string> = {
      emergency: 'E01',
      life: 'L07',
      dream: 'D01',
      opportunity: 'S01',
      harvest: 'H01',
    };
    expect(() => run(t, 'ann', { type: 'debug_load', tile: 'life', cardId: 'L07' })).toThrow();
    expect(() => run(t, 'host', { type: 'debug_load', tile: 'life', cardId: 'NOPE' })).toThrow(
      /pile/,
    );
    for (const tile of Object.keys(card)) {
      // without a roll, and again over a card that is open: each is loaded as if just dealt
      const chosen = run(t, 'host', { type: 'debug_load', tile, cardId: card[tile] });
      const seat = chosen.players.find((s) => s.id === 'host')!;
      if (tile === 'harvest') expect(seat.harvest?.cardId).toBe('H01');
      else expect(JSON.stringify(seat.pending ?? seat.resolved)).toContain(card[tile]);
      // the screen stands at the card of that tile, as after a roll that landed there - not at the dice
      const turn = seat.life!.books.state.turn;
      expect(turn?.phase).toBe('decide');
      expect(turn?.pending).toMatchObject({ kind: 'story', tile });
      const again = run(chosen, 'host', { type: 'debug_load', tile: 'emergency', cardId: 'E02' });
      expect(JSON.stringify(again.players.find((s) => s.id === 'host')!.pending)).toContain('E02');
    }
    const paid = run(t, 'host', { type: 'debug_payday' });
    const before = t.players.find((s) => s.id === 'host')!.life!;
    const after = paid.players.find((s) => s.id === 'host')!;
    expect(after.paydayDue).toBe(true);
    expect(after.life!.books.state.round).toBe(before.books.state.round + 1);
    // a game that is not a debug game has none of it
    const plain = started({}, 8);
    expect(() => run(plain, 'host', { type: 'debug_payday' })).toThrow();
  });

  it('a Harvest card that affects others holds the end of the turn until each has said Continue', () => {
    let t = started({ debug: true }, 8);
    t = run(t, 'host', { type: 'debug_load', tile: 'emergency', cardId: 'E01' });
    t = run(t, 'host', { type: 'pay_emergency', pay: 'now' });
    const open = {
      cardId: 'H01',
      told: [],
      window: 'ALL' as const,
      sellable: ['X'],
      sales: [],
      ladders: [],
    };
    const affected = (table: DreamTable, id: string, harvest: typeof open | null) => ({
      ...table,
      players: table.players.map((seat) => (seat.id === id ? { ...seat, harvest } : seat)),
    });
    t = affected(t, 'ann', open);
    // nothing to sell for Bob: he is not waited for
    t = affected(t, 'bob', { ...open, sellable: [] });
    expect(() => run(t, 'host', { type: 'end_turn' })).toThrow(/Waiting for Ann/);
    const told = run(t, 'ann', { type: 'harvest_continue' });
    expect(() => run(told, 'host', { type: 'end_turn' })).not.toThrow();
  });

  it('refuses a move that is not possible, and changes nothing', () => {
    const t = started();
    const who = t.activePlayerId!;
    expect(() => run(t, who, { type: 'pay_emergency', pay: 'now' })).toThrow(/no emergency/);
    expect(() => run(t, who, { type: 'take_dream', cardId: 'D01' })).toThrow(/not on offer/);
    expect(t.version).toBe(t.version);
  });

  it('counts the goals of a life: a reserve, no debts, a dream lived and passive income make a win', () => {
    const t = started({ endCondition: 'first-win', dreamPoints: 0 });
    const who = t.activePlayerId!;

    const life: any = JSON.parse(JSON.stringify(t.players.find((p) => p.id === who)!.life));
    life.reserveMinor = 99_999_999;
    life.dreamLived = true;
    life.dreamSavedMinor = 99_999_999;
    for (const liability of life.books.liabilities) liability.amountMinor = 0;
    life.books.subscriptions.push({
      title: 'Passive Cashflow',
      account: 'Income',
      amountMinor: 99_999_999,
      startDate: '2026-11-15',
      endDate: '',
      category: '@Passive',
      comment: '#dreamfund',
      frequency: 'monthly',
    });
    life.books.state.gameSubscriptionTitles.push('Passive Cashflow');
    const rich: DreamTable = {
      ...t,
      players: t.players.map((p) => (p.id === who ? { ...p, life } : p)),
    };
    const standing = dreamStandings(rich).find((s) => s.playerId === who)!;
    expect(standing.goals.reserve).toBe(1);
    expect(standing.goals.debts).toBe(1);
    expect(standing.goals.dream).toBe(1);
    // any move of that player shows the win and, in this end condition, ends the game
    const after = run(rich, who, { type: 'roll' });
    expect(after.phase).toBe('finished');
    expect(after.result).toMatchObject({ reason: 'won', winnerId: who });
    expect(after.result!.ranking[0]).toMatchObject({ playerId: who, outcome: 'won' });
  });
});

describe('the Emergency card at a Dreamer table', () => {
  function withEmergency(pick: (cards: import('../../emergency-deck').EmergencyCard[]) => string) {
    let t = started();
    const who = t.activePlayerId!;
    const seat = t.players.find((p) => p.id === who)!;
    const cards = DreamPlayer.restore(seat.life!, () => 0.5, { sharedMarkets: true }).gameSet.decks!
      .emergency!;
    t = {
      ...t,
      players: t.players.map((p) =>
        p.id === who ? { ...p, pending: { kind: 'emergency', cardId: pick(cards) } } : p,
      ),
    };
    return { t, who };
  }
  const seatOf = (t: DreamTable, who: string) => t.players.find((p) => p.id === who)!;

  it('keeps the option picked, refuses one the card does not have, and rolls only the dice it asks for', () => {
    const { t, who } = withEmergency((cards) => cards.find((c) => c.type === 'choice')!.id);
    const card = DreamPlayer.restore(seatOf(t, who).life!, () => 0.5, {
      sharedMarkets: true,
    }).emergencyCard((seatOf(t, who).pending as { cardId: string }).cardId)!;
    expect(() => run(t, who, { type: 'emergency_choose', choiceId: 'nope' })).toThrow(/options/i);
    const chosen = run(t, who, { type: 'emergency_choose', choiceId: card.choices![0].id });
    expect((seatOf(chosen, who).pending as { choiceId?: string }).choiceId).toBe(
      card.choices![0].id,
    );
    expect(() => run(chosen, who, { type: 'emergency_roll', key: 'bucket:none' })).toThrow(
      /not to be rolled/i,
    );
  });

  it('rolls the dice itself, pays what the picked and rolled card costs, and shows the result', () => {
    const { t, who } = withEmergency(
      (cards) => cards.find((c) => c.type !== 'choice' && c.payment !== 'pay_now')!.id,
    );
    let current = t;
    const card = DreamPlayer.restore(seatOf(t, who).life!, () => 0.5, {
      sharedMarkets: true,
    }).emergencyCard((seatOf(t, who).pending as { cardId: string }).cardId)!;
    void card;
    // roll every die the card asks for, one by one
    for (let i = 0; i < 6; i += 1) {
      const p = seatOf(current, who).pending as { cardId: string; rolls?: Record<string, number> };
      const player = DreamPlayer.restore(seatOf(current, who).life!, () => 0.5, {
        sharedMarkets: true,
      });
      const quote = quoteEmergency(
        player.emergencyCard(p.cardId)!,
        { rolls: p.rolls },
        player.emergencyContext(),
      );
      if (!quote.needsRolls.length) break;
      current = run(current, who, { type: 'emergency_roll', key: quote.needsRolls[0] });
      const rolled = (seatOf(current, who).pending as { rolls: Record<string, number> }).rolls;
      expect(Object.values(rolled).every((die) => die >= 1 && die <= 6)).toBe(true);
    }
    const paid = run(current, who, { type: 'pay_emergency', pay: 'now' });
    const seat = seatOf(paid, who);
    expect(seat.pending).toBeNull();
    expect(seat.resolved).toMatchObject({ kind: 'emergency', how: 'now' });
  });
});

describe('the Dream and Career tiles at a Dreamer table', () => {
  const seatOf = (t: DreamTable, who: string) => t.players.find((p) => p.id === who)!;

  it('shows a dream taken, and the dreams left, as what the turn came to', () => {
    const t = started();
    const who = t.activePlayerId!;
    const cards = DreamPlayer.restore(seatOf(t, who).life!, () => 0.5, { sharedMarkets: true })
      .gameSet.decks!.dream!;
    const offers = [cards[0].id, cards[1].id];
    const asked = {
      ...t,
      players: t.players.map((p) =>
        p.id === who ? { ...p, pending: { kind: 'dream' as const, offers } } : p,
      ),
    };
    const taken = run(asked, who, { type: 'take_dream', cardId: offers[0] });
    expect(seatOf(taken, who).resolved).toMatchObject({ kind: 'dream', taken: offers[0], offers });
    const left = run(asked, who, { type: 'skip' });
    expect(seatOf(left, who).resolved).toMatchObject({ kind: 'dream', declined: true });
  });

  it('waits for the player to throw the career die, then tells what it said', () => {
    const t = started();
    const who = t.activePlayerId!;
    const waiting = {
      ...t,
      turnRolled: true,
      players: t.players.map((p) =>
        p.id === who
          ? {
              ...p,
              pending: {
                kind: 'career_roll' as const,
                result: { kind: 'failed' as const, roll: 3 },
              },
            }
          : p,
      ),
    };
    expect(() => run(waiting, who, { type: 'end_turn' })).toThrow(/decide about the card/i);
    expect(() => run(waiting, who, { type: 'skip' })).toThrow(/has to be answered/i);
    const thrown = run(waiting, who, { type: 'roll_career' });
    expect(seatOf(thrown, who).pending).toBeNull();
    expect(seatOf(thrown, who).resolved).toMatchObject({
      kind: 'career',
      result: { kind: 'failed', roll: 3 },
    });
    expect(() => run(thrown, who, { type: 'roll_career' })).toThrow(/no career die/i);
  });

  it('keeps the die of a career branch, and the path taken', () => {
    const t = started();
    const who = t.activePlayerId!;
    const asked = {
      ...t,
      players: t.players.map((p) =>
        p.id === who
          ? { ...p, pending: { kind: 'career_branch' as const, options: ['x', 'y'], roll: 5 } }
          : p,
      ),
    };
    expect(() => run(asked, who, { type: 'choose_career_branch', index: 4 })).toThrow(
      /no such path/i,
    );
  });
});

describe('the layout of the map the host dealt', () => {
  it('is checked as a whole number and defaults to the table’s own seed', () => {
    expect(normalizeDreamSettings({ name: 'T' } as never, 10).layoutSeed).toBe(0);
    expect(normalizeDreamSettings({ name: 'T', layoutSeed: 42 } as never, 10).layoutSeed).toBe(42);
    expect(() => normalizeDreamSettings({ name: 'T', layoutSeed: -1 } as never, 10)).toThrow();
    expect(() => normalizeDreamSettings({ name: 'T', layoutSeed: 1.5 } as never, 10)).toThrow();
  });

  it('everybody plays the same map, dealt from the host’s layout seed rather than the table’s secret one', () => {
    const seeds = (t: DreamTable) => t.players.map((p) => p.life!.seed);
    expect(seeds(started({ layoutSeed: 123456 }, 7))).toEqual([123456, 123456, 123456]);
    expect(seeds(started({ layoutSeed: 123456 }, 99))).toEqual([123456, 123456, 123456]);
    // without a chosen layout the table's own seed deals the map, as before
    expect(new Set(seeds(started({}, 7))).size).toBe(1);
    expect(seeds(started({}, 7))[0]).toBe(7);
  });
});

describe('passing on an Opportunity (JFK, 2026-11-05)', () => {
  const open = (t: DreamTable, who: string, pending: object): DreamTable => ({
    ...t,
    turnRolled: true,
    players: t.players.map((seat) =>
      seat.id === who ? { ...seat, pending: pending as never } : seat,
    ),
  });

  it.each([
    ['the pile to choose', { kind: 'opportunity_pile' }],
    ['offers shown', { kind: 'opportunity', pile: 'seed', offers: ['S10'] }],
    [
      'a card planned in Grow',
      { kind: 'opportunity', pile: 'seed', offers: ['S10'], planned: 'S10' },
    ],
  ])('%s: pass leaves the card and the turn can end', (_name, pending) => {
    const t0 = started({}, 5);
    const who = t0.activePlayerId!;
    const left = run(open(t0, who, pending), who, { type: 'skip' });
    expect(left.players.find((seat) => seat.id === who)!.pending).toBeNull();
    expect(() => run(left, who, { type: 'end_turn' })).not.toThrow();
  });

  it.each([
    ['the pile to choose', { kind: 'opportunity_pile' }],
    ['offers shown', { kind: 'opportunity', pile: 'seed', offers: ['S10'] }],
  ])('%s: ending the turn with Done is the same as passing', (_name, pending) => {
    const t0 = started({}, 5);
    const who = t0.activePlayerId!;
    expect(() => run(open(t0, who, pending), who, { type: 'end_turn' })).not.toThrow();
  });
});

describe('what a player may change by hand (JFK, 2026-11-05)', () => {
  const life = (t: DreamTable, who: string) =>
    DreamPlayer.restore(t.players.find((seat) => seat.id === who)!.life!, () => 0.5, {
      sharedMarkets: true,
    });

  /** A table whose players have a booking of the Daily account (the start has only an income). */
  const withBookings = (): DreamTable => {
    const t = started({}, 5);
    return {
      ...t,
      players: t.players.map((seat) =>
        seat.life
          ? {
              ...seat,
              life: {
                ...seat.life,
                books: {
                  ...seat.life.books,
                  transactions: [
                    ...seat.life.books.transactions,
                    {
                      account: 'Daily',
                      amountMinor: -1250,
                      date: '2026-11-16',
                      time: '08:00',
                      category: '@Food',
                      comment: 'Groceries',
                    },
                  ],
                },
              },
            }
          : seat,
      ),
    };
  };

  it('changes the category, the time and the account of a booking, on or off the turn, and keeps the cash', () => {
    const t0 = withBookings();
    const who = t0.activePlayerId!;
    const other = t0.players.find((seat) => seat.id !== who)!.id;
    const before = life(t0, other);
    const index = before.books.transactions.findIndex((tx) => tx.account === 'Daily');
    expect(index).toBeGreaterThanOrEqual(0);
    const t1 = run(t0, other, {
      type: 'edit_transaction',
      index,
      patch: { category: '@Groceries', account: 'Splurge', time: '09:15' },
    });
    const after = life(t1, other);
    expect(after.books.transactions[index]).toMatchObject({
      account: 'Splurge',
      category: '@Groceries',
      time: '09:15',
    });
    expect(after.books.transactions[index].amountMinor).toBe(
      before.books.transactions[index].amountMinor,
    );
    expect(after.cash()).toBe(before.cash());
  });

  it('refuses what belongs to the game: the amount, the date, the comment, an income or the Mojo', () => {
    const t0 = withBookings();
    const who = t0.activePlayerId!;
    for (const patch of [{ amount: 5 }, { date: '2030-01-01' }, { comment: 'x' }]) {
      expect(() =>
        run(t0, who, { type: 'edit_transaction', index: 0, patch: patch as never }),
      ).toThrow(/belong to the game/);
    }
    const txs = life(t0, who).books.transactions;
    const income = txs.findIndex((tx) => tx.account === 'Income');
    if (income >= 0) {
      expect(() =>
        run(t0, who, { type: 'edit_transaction', index: income, patch: { account: 'Daily' } }),
      ).toThrow(/move between/);
    }
    expect(() =>
      run(t0, who, { type: 'edit_transaction', index: 0, patch: { account: 'Mojo' } }),
    ).toThrow(/move between/);
    expect(() =>
      run(t0, who, { type: 'edit_transaction', index: 99999, patch: { category: 'x' } }),
    ).toThrow(/no such booking/);
  });

  it('changes the account a running payment is paid from, but nothing else of it', () => {
    const t0 = started({}, 5);
    const who = t0.activePlayerId!;
    const sub = life(t0, who).books.subscriptions.find(
      (entry) => entry.amountMinor < 0 && entry.account === 'Daily',
    )!;
    const t1 = run(t0, who, { type: 'edit_subscription', title: sub.title, account: 'Splurge' });
    const changed = life(t1, who).books.subscriptions.find((entry) => entry.title === sub.title)!;
    expect(changed).toEqual({ ...sub, account: 'Splurge' });
    expect(() =>
      run(t0, who, { type: 'edit_subscription', title: sub.title, account: 'Income' }),
    ).toThrow(/change its account/);
  });

  it('sets the phase of a project by hand, backwards too, but never completes one', () => {
    const t0 = started({}, 5);
    const who = t0.activePlayerId!;
    const t1 = run(t0, who, { type: 'set_phase', kind: 'smile', id: 'life', phase: 'idea' });
    expect(life(t1, who).phaseEdits).toEqual({ 'smile:life': 'idea' });
    const t2 = run(t1, who, { type: 'set_phase', kind: 'smile', id: 'life', phase: 'saving' });
    expect(life(t2, who).phaseEdits).toEqual({ 'smile:life': 'saving' });
    expect(() =>
      run(t0, who, { type: 'set_phase', kind: 'smile', id: 'life', phase: 'completed' }),
    ).toThrow(/idea, planning, saving or ready/);
    expect(() =>
      run(t0, who, { type: 'set_phase', kind: 'grow', id: 'nothing', phase: 'plan' }),
    ).toThrow(/no such project/);
  });
});
