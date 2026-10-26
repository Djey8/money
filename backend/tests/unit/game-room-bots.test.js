'use strict';

const { createBotDriver } = require('../../services/game-room-bots');

/** A scheduler we wind by hand, like the clocks' tests. */
function fakeScheduler() {
  const jobs = new Map();
  let next = 1;
  return {
    set(fn, delay) {
      const id = next++;
      jobs.set(id, { fn, delay });
      return id;
    },
    clear(id) {
      jobs.delete(id);
    },
    pending: () => jobs.size,
    delays: () => [...jobs.values()].map((j) => j.delay),
    async fireAll() {
      const due = [...jobs.entries()];
      jobs.clear();
      for (const [, job] of due) await job.fn();
    },
  };
}

const table = (over = {}) => ({
  phase: 'playing',
  players: [
    { id: 'a', status: 'active' },
    { id: 'bot:2', status: 'active', bot: { policyId: 'x' } },
  ],
  ...over,
});

describe('the bot driver', () => {
  it('wakes a table that is being played and has a bot, once, however often it changes', async () => {
    const scheduler = fakeScheduler();
    const run = jest.fn(async () => ({ moved: false }));
    const driver = createBotDriver({ run, scheduler, delayMs: () => 40 });
    driver.touch('r1', table());
    driver.touch('r1', table());
    driver.touch('r1', table());
    expect(scheduler.pending()).toBe(1);
    expect(scheduler.delays()).toEqual([40]);
    await scheduler.fireAll();
    expect(run).toHaveBeenCalledTimes(1);
    expect(run).toHaveBeenCalledWith('r1');
    expect(driver.size()).toBe(0);
  });

  it('does not wait between moves once only bots are left in the game', () => {
    const scheduler = fakeScheduler();
    const driver = createBotDriver({ run: jest.fn(), scheduler });
    const playing = { state: {} };
    const bot = { id: 'bot:2', status: 'active', bot: { policyId: 'x' }, books: playing };
    driver.touch(
      'people',
      table({ players: [{ id: 'a', status: 'active', books: playing }, bot] }),
    );
    driver.touch('bots', table({ players: [{ id: 'a', status: 'left', books: playing }, bot] }));
    const [waits, fast] = scheduler.delays();
    expect(waits).toBeGreaterThan(1000);
    expect(fast).toBeLessThan(100);
  });

  it('ignores tables with no bot, a bot that left, or a game not being played', () => {
    const scheduler = fakeScheduler();
    const driver = createBotDriver({ run: jest.fn(), scheduler });
    driver.touch('a', table({ players: [{ id: 'a', status: 'active' }] }));
    driver.touch(
      'b',
      table({ players: [{ id: 'bot:1', status: 'left', bot: { policyId: 'x' } }] }),
    );
    driver.touch('c', table({ phase: 'lobby' }));
    driver.touch('d', table({ phase: 'finished' }));
    expect(scheduler.pending()).toBe(0);
  });

  it('drops the timer of a table that stopped being one for the bots', () => {
    const scheduler = fakeScheduler();
    const driver = createBotDriver({ run: jest.fn(), scheduler });
    driver.touch('r', table());
    expect(scheduler.pending()).toBe(1);
    driver.touch('r', table({ phase: 'finished' }));
    expect(scheduler.pending()).toBe(0);
  });

  it('tries again later when running them failed, and tells the log', async () => {
    const scheduler = fakeScheduler();
    const log = jest.fn();
    const run = jest.fn().mockRejectedValueOnce(new Error('database away')).mockResolvedValue({});
    const driver = createBotDriver({ run, scheduler, log, delayMs: () => 0 });
    driver.touch('r', table());
    await scheduler.fireAll();
    expect(log).toHaveBeenCalledWith(
      'game_room_bots_failed',
      expect.objectContaining({ roomId: 'r' }),
    );
    expect(scheduler.pending()).toBe(1);
    expect(scheduler.delays()[0]).toBeGreaterThan(1000);
    await scheduler.fireAll();
    expect(run).toHaveBeenCalledTimes(2);
  });

  it('reads the delay from GAME_BOT_DELAY_MS when it is not given', () => {
    const scheduler = fakeScheduler();
    process.env.GAME_BOT_DELAY_MS = '7';
    try {
      createBotDriver({ run: jest.fn(), scheduler }).touch('r', table());
      expect(scheduler.delays()).toEqual([7]);
    } finally {
      delete process.env.GAME_BOT_DELAY_MS;
    }
  });

  it('clearAll stops every timer', () => {
    const scheduler = fakeScheduler();
    const driver = createBotDriver({ run: jest.fn(), scheduler });
    driver.touch('a', table());
    driver.touch('b', table());
    driver.clearAll();
    expect(scheduler.pending()).toBe(0);
    expect(driver.size()).toBe(0);
  });
});
