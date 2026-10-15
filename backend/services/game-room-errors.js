'use strict';

/** A refusal that is not a table rule: the room is not there, the account is at a limit, two saves collided. */
class RoomError extends Error {
  constructor(code, status, message) {
    super(message);
    this.name = 'RoomError';
    this.code = code;
    this.status = status;
  }
}

module.exports = { RoomError };
