'use strict';

const { createRoomQueue } = require('../../services/room-queue');

const later = (ms, value) => new Promise((resolve) => setTimeout(() => resolve(value), ms));

describe('the line of a table', () => {
  it('runs what changes a table one after the other, in the order it arrived, however long each takes', async () => {
    const queue = createRoomQueue();
    const order = [];
    const slow = queue.run('r1', async () => {
      await later(40);
      order.push('first');
      return 1;
    });
    const quick = queue.run('r1', async () => {
      order.push('second');
      return 2;
    });
    const last = queue.run('r1', async () => {
      order.push('third');
      return 3;
    });
    expect(await Promise.all([slow, quick, last])).toEqual([1, 2, 3]);
    expect(order).toEqual(['first', 'second', 'third']);
  });

  it('never makes one table wait for another', async () => {
    const queue = createRoomQueue();
    const order = [];
    const a = queue.run('a', async () => {
      await later(60);
      order.push('a');
    });
    const b = queue.run('b', async () => {
      order.push('b');
    });
    await Promise.all([a, b]);
    expect(order).toEqual(['b', 'a']);
  });

  it('a task that fails tells its own caller and does not hold the line up', async () => {
    const queue = createRoomQueue();
    const failing = queue.run('r', async () => {
      throw new Error('refused');
    });
    const next = queue.run('r', async () => 'went through');
    await expect(failing).rejects.toThrow('refused');
    await expect(next).resolves.toBe('went through');
  });

  it('counts who is waiting and forgets a table once its line is empty', async () => {
    const queue = createRoomQueue();
    const one = queue.run('r', () => later(20));
    const two = queue.run('r', () => later(1));
    expect(queue.waiting('r')).toBe(2);
    await Promise.all([one, two]);
    await later(5);
    expect(queue.waiting('r')).toBe(0);
    expect(queue.size()).toBe(0);
  });
});
