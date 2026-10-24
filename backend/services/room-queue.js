'use strict';

/**
 * One line per table (JFK, 2026-10-24): everything that changes a table - a player's move, a bot's move, a clock's timeout - waits its
 * turn in the order it reached the server and is applied to the table AS IT IS THEN, one after the other. Nobody's move is refused
 * because somebody else's was applied a moment earlier: the rules decide, against the current table, whether it is legal - and say why
 * when it is not. Different tables never wait for each other. A task that fails does not hold the line up.
 *
 * (The database's own revision check stays as the safeguard between several server processes; inside one process the line makes a
 * clash the exception instead of the rule.)
 */
function createRoomQueue() {
  /** roomId -> the end of the line of that table */
  const tails = new Map();
  /** roomId -> how many tasks are waiting or running */
  const depth = new Map();

  function run(roomId, task) {
    const tail = tails.get(roomId) ?? Promise.resolve();
    depth.set(roomId, (depth.get(roomId) ?? 0) + 1);
    const result = tail.then(task);
    const end = result.then(
      () => undefined,
      () => undefined,
    );
    tails.set(roomId, end);
    end.then(() => {
      const left = (depth.get(roomId) ?? 1) - 1;
      if (left <= 0) {
        depth.delete(roomId);
        if (tails.get(roomId) === end) tails.delete(roomId);
      } else {
        depth.set(roomId, left);
      }
    });
    return result;
  }

  return { run, waiting: (roomId) => depth.get(roomId) ?? 0, size: () => tails.size };
}

module.exports = { createRoomQueue };
