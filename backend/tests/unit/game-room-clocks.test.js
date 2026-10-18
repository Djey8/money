/**
 * Unit tests for the timers of running tables (backend/services/game-room-clocks.js). Time and the scheduler are faked, so
 * nothing waits.
 */
'use strict';

const {
  createRoomClocks,
  MAX_DELAY_MS,
  SLACK_MS,
  RETRY_MS,
} = require('../../services/game-room-clocks');

function setup(overrides = {}) {
  let now = 1_000_000;
  const timers = [];
  const scheduler = {
    set: jest.fn((fn, delay) => {
      const timer = { delay, cleared: false, fired: false, unref: jest.fn() };
      // a timer that has rung is gone, like a real one
      timer.fn = async () => {
        timer.fired = true;
        return fn();
      };
      timers.push(timer);
      return timer;
    }),
    clear: jest.fn((timer) => {
      timer.cleared = true;
    }),
  };
  const onDue = jest.fn(async () => {});
  const log = jest.fn();
  const clocks = createRoomClocks({ onDue, now: () => now, scheduler, log, ...overrides });
  const live = () => timers.filter((t) => !t.cleared && !t.fired);
  return {
    clocks,
    onDue,
    log,
    scheduler,
    timers,
    live,
    advance: (ms) => {
      now += ms;
    },
    setNow: (value) => {
      now = value;
    },
    now: () => now,
  };
}

describe('arming a table', () => {
  it('sets one timer for the deadline, a little after it, and does not keep the process alive', () => {
    const t = setup();
    t.clocks.arm('r1', t.now() + 60_000);
    expect(t.live()).toHaveLength(1);
    expect(t.live()[0].delay).toBe(60_000 + SLACK_MS);
    expect(t.live()[0].unref).toHaveBeenCalled();
    expect(t.clocks.deadlineOf('r1')).toBe(t.now() + 60_000);
    expect(t.clocks.count()).toBe(1);
  });

  it('a deadline already past fires at once; a very far one is capped and re-checked', () => {
    const t = setup();
    t.clocks.arm('late', t.now() - 5000);
    expect(t.live()[0].delay).toBe(SLACK_MS);
    t.clocks.arm('far', t.now() + 90 * 24 * 3600 * 1000);
    expect(t.live()[1].delay).toBe(MAX_DELAY_MS);
  });

  it('arming again replaces the old timer; the same deadline again changes nothing; null removes it', () => {
    const t = setup();
    t.clocks.arm('r1', t.now() + 10_000);
    const first = t.live()[0];
    t.clocks.arm('r1', t.now() + 10_000);
    expect(t.timers).toHaveLength(1);
    t.clocks.arm('r1', t.now() + 30_000);
    expect(first.cleared).toBe(true);
    expect(t.live()).toHaveLength(1);
    expect(t.live()[0].delay).toBe(30_000 + SLACK_MS);
    t.clocks.arm('r1', null);
    expect(t.live()).toHaveLength(0);
    expect(t.clocks.deadlineOf('r1')).toBeNull();
    t.clocks.arm('r1', undefined);
    expect(t.clocks.count()).toBe(0);
  });

  it('keeps tables apart, and clears them all', () => {
    const t = setup();
    t.clocks.arm('a', t.now() + 1000);
    t.clocks.arm('b', t.now() + 2000);
    t.clocks.disarm('a');
    expect(t.clocks.deadlineOf('b')).toBe(t.now() + 2000);
    expect(t.clocks.deadlineOf('a')).toBeNull();
    t.clocks.arm('a', t.now() + 1000);
    t.clocks.clearAll();
    expect(t.live()).toHaveLength(0);
    expect(t.clocks.count()).toBe(0);
  });
});

describe('when the timer rings', () => {
  it('asks the service about that table once, and forgets the timer', async () => {
    const t = setup();
    t.clocks.arm('r1', t.now() + 1000);
    await t.live()[0].fn();
    expect(t.onDue).toHaveBeenCalledTimes(1);
    expect(t.onDue).toHaveBeenCalledWith('r1');
    expect(t.clocks.count()).toBe(0);
  });

  it('can be armed again from inside the answer (the service re-arms for the deadline it finds)', async () => {
    const t = setup();
    t.onDue.mockImplementationOnce(async (roomId) => t.clocks.arm(roomId, t.now() + 5000));
    t.clocks.arm('r1', t.now() + 1000);
    await t.live()[0].fn();
    expect(t.clocks.deadlineOf('r1')).toBe(t.now() + 5000);
    expect(t.live()).toHaveLength(1);
  });

  it('tries again in a few seconds when the service could not answer, and says so', async () => {
    const t = setup();
    t.onDue.mockRejectedValueOnce(new Error('database away'));
    t.clocks.arm('r1', t.now() + 1000);
    await t.live()[0].fn();
    expect(t.log).toHaveBeenCalledWith('game_room_timeout_failed', {
      roomId: 'r1',
      message: 'database away',
    });
    expect(t.live()).toHaveLength(1);
    expect(t.live()[0].delay).toBe(RETRY_MS);
    await t.live()[0].fn();
    expect(t.onDue).toHaveBeenCalledTimes(2);
    expect(t.clocks.count()).toBe(0);
  });

  it('does not overwrite a newer arm made while the failed call was running', async () => {
    const t = setup();
    t.onDue.mockImplementationOnce(async (roomId) => {
      t.clocks.arm(roomId, t.now() + 9000);
      throw new Error('boom');
    });
    t.clocks.arm('r1', t.now() + 1000);
    await t.live()[0].fn();
    expect(t.clocks.deadlineOf('r1')).toBe(t.now() + 9000);
    expect(t.live()).toHaveLength(1);
  });
});
