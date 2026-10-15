import type { TableView } from '@money/domain';

/** What the clock of the player on the move shows right now. */
export interface ClockReading {
  /** Whole seconds left, or null without a clock, while paused, or when nobody is on the move. */
  secondsLeft: number | null;
  /** How much of the allowance is left, 0..1, for a bar; null when there is no bar to draw. */
  fraction: number | null;
  /** 10 seconds or less. */
  low: boolean;
}

export function formatClock(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  if (m >= 60) {
    const h = Math.floor(m / 60);
    return `${h}:${String(m % 60).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** The allowance a full bar stands for, in milliseconds. */
function allowanceMs(view: TableView): number | null {
  const clock = view.settings.clock;
  switch (clock.mode) {
    case 'per-move':
      return clock.secondsPerMove * 1000;
    case 'bank':
      return clock.bankSeconds * 1000;
    case 'daily':
      return clock.hoursPerMove * 3_600_000;
    default:
      return null;
  }
}

/** The countdown of the player on the move, from the server's deadline (the server's epoch milliseconds). */
export function clockReading(view: TableView, now: number): ClockReading {
  const deadline = view.clock.deadlineAt;
  if (deadline === null || deadline === undefined) {
    return { secondsLeft: null, fraction: null, low: false };
  }
  const left = Math.max(0, deadline - now);
  const secondsLeft = Math.ceil(left / 1000);
  const total = allowanceMs(view);
  return {
    secondsLeft,
    fraction: total ? Math.min(1, left / total) : null,
    low: secondsLeft <= 10,
  };
}

/**
 * A player's time bank at a bank-clock table: the stored bank for everyone waiting, and what is left of the deadline for the
 * player on the move (their bank is running down right now). Null at the other kinds of clock.
 */
export function bankSeconds(view: TableView, seat: number, now: number): number | null {
  if (view.settings.clock.mode !== 'bank') return null;
  if (
    seat === view.activeSeat &&
    view.clock.deadlineAt !== null &&
    view.clock.deadlineAt !== undefined
  ) {
    return Math.max(0, Math.ceil((view.clock.deadlineAt - now) / 1000));
  }
  const bank = view.clock.banksMs[seat];
  return bank === null || bank === undefined ? null : Math.max(0, Math.ceil(bank / 1000));
}
