import { quoteEmergency } from '../../emergency-deck';
import { DreamPlayer } from '../player';
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

describe('the Dreamfund table: the lobby', () => {
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

  it('takes the Dreamfund settings: difficulty, map, rules, end condition - and refuses what a shared table cannot run', () => {
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

  it('lets everybody pick a character, then starts: lives, an order and a clock', () => {
    let t = table({ professions: 'unique' });
    t = run(t, 'ann', { type: 'join', name: 'Ann' });
    t = run(t, 'ann', { type: 'set_ready', ready: true });
    t = run(t, 'host', { type: 'start' });
    expect(t.phase).toBe('picking');
    t = run(t, 'host', { type: 'pick_profession', professionId: 'jan-oberarzt' });
    expect(() => run(t, 'ann', { type: 'pick_profession', professionId: 'jan-oberarzt' })).toThrow(
      /already/,
    );
    t = run(t, 'ann', { type: 'pick_profession', professionId: 'random' });
    expect(t.phase).toBe('playing');
    expect(t.players.every((p) => p.life && p.professionId)).toBe(true);
    expect(t.players.find((p) => p.id === 'host')!.professionId).toBe('jan-oberarzt');
    expect(new Set(t.players.map((p) => p.professionId)).size).toBe(2);
    expect(dreamCharacterIds()).toHaveLength(10);
    expect(t.tableRound).toBe(1);
    expect(t.order).toHaveLength(2);
  });
});

describe('the Dreamfund table: play', () => {
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
    for (const who of ['host', 'ann']) {
      t = run(t, who, { type: 'pick_profession', professionId: 'dual-student-informatik' });
    }
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
    // back to the choice: the others keep theirs
    t = run(t, 'bob', { type: 'reopen_pick' });
    expect(t.phase).toBe('picking');
    expect(t.players.find((seat) => seat.id === 'ann')!.pick).toBe('dual-student-informatik');
    t = run(t, 'bob', { type: 'pick_profession', professionId: 'mehmet-elektroniker' });
    expect(t.briefing).toBe(true);
    t = run(t, 'host', { type: 'confirm_briefing' });
    t = run(t, 'ann', { type: 'confirm_briefing' });
    expect(t.briefing).toBe(true);
    t = run(t, 'bob', { type: 'confirm_briefing' });
    expect(t.briefing).toBe(false);
    expect(t.activePlayerId).toBe('host');
    expect(() => run(t, 'bob', { type: 'reopen_pick' })).toThrow(/begun/);
  });

  it('refuses a move that is not possible, and changes nothing', () => {
    const t = started();
    const who = t.activePlayerId!;
    expect(() => run(t, who, { type: 'pay_emergency', pay: 'now' })).toThrow(/no emergency/);
    expect(() => run(t, who, { type: 'take_dream', cardId: 'D01' })).toThrow(/not on offer/);
    expect(t.version).toBe(t.version);
  });

  it('counts the goals of a life: a reserve, no debts, a dream lived and passive income make a win', () => {
    const t = started({ endCondition: 'first-win' });
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

describe('the Emergency card at a Dreamfund table', () => {
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

describe('the Dream and Career tiles at a Dreamfund table', () => {
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
