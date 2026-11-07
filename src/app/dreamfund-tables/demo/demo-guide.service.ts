import { Injectable, signal } from '@angular/core';
import type { TableSessionService } from '../../tables/table-session.service';

/**
 * The state of the guided demo game (JFK, 2026-11-06): is the coach on, and which step it is at. Kept in this tab's session so that the
 * coach follows the person from the lobby into the table and into the game screen, and a reload does not lose it. Only ever imported
 * from the lazy Dreamfund chunk (docs/adr/0004), so none of it reaches the Firebase build.
 */
const KEY = 'mm.dreamDemo';

interface Saved {
  active: boolean;
  index: number;
  roomId: string | null;
  /** Demo tables the person has ended: the coach never takes them up again. */
  dismissed: string[];
}

function read(): Saved {
  try {
    const raw = JSON.parse(sessionStorage.getItem(KEY) ?? 'null') as Partial<Saved> | null;
    if (raw && raw.active === true) {
      return {
        active: true,
        index: Number.isInteger(raw.index) ? Math.max(0, raw.index as number) : 0,
        roomId: typeof raw.roomId === 'string' ? raw.roomId : null,
        dismissed: Array.isArray(raw.dismissed)
          ? raw.dismissed.filter((id) => typeof id === 'string')
          : [],
      };
    }
    if (raw && Array.isArray(raw.dismissed)) {
      return {
        active: false,
        index: 0,
        roomId: null,
        dismissed: raw.dismissed.filter((id) => typeof id === 'string'),
      };
    }
  } catch {
    // no storage: the coach just starts again
  }
  return { active: false, index: 0, roomId: null, dismissed: [] };
}

@Injectable({ providedIn: 'root' })
export class DreamDemoService {
  readonly active = signal(false);
  readonly index = signal(0);
  /** The table of the demo (once there is one): "Stop the tutorial" removes it. */
  readonly roomId = signal<string | null>(null);
  private dismissed: string[] = [];
  /** The table page's own session while the table is only a lobby (the game screen has the table mode's). */
  readonly roomSession = signal<TableSessionService | null>(null);

  constructor() {
    const saved = read();
    this.active.set(saved.active);
    this.index.set(saved.index);
    this.roomId.set(saved.roomId);
    this.dismissed = saved.dismissed;
  }

  /** The coach starts from the beginning. */
  start(): void {
    this.index.set(0);
    this.roomId.set(null);
    this.active.set(true);
    this.save();
  }

  /** A table that is the demo (seen by its settings) is taken up by the coach wherever it is opened. */
  adopt(roomId: string): void {
    // a demo the person ended (Stop tutorial, or the last step) is theirs now: the coach does not come back to it
    if (this.dismissed.includes(roomId)) return;
    if (this.roomId() === roomId) return;
    if (!this.active()) {
      this.active.set(true);
      this.index.set(0);
    }
    this.roomId.set(roomId);
    this.save();
  }

  goTo(index: number): void {
    if (index === this.index()) return;
    this.index.set(Math.max(0, index));
    this.save();
  }

  stop(alsoRoom?: string | null): void {
    for (const room of [this.roomId(), alsoRoom ?? null]) {
      if (room && !this.dismissed.includes(room))
        this.dismissed = [...this.dismissed.slice(-9), room];
    }
    this.active.set(false);
    this.index.set(0);
    this.roomId.set(null);
    this.save();
  }

  private save(): void {
    try {
      sessionStorage.setItem(
        KEY,
        JSON.stringify({
          active: this.active(),
          index: this.index(),
          roomId: this.roomId(),
          dismissed: this.dismissed,
        }),
      );
    } catch {
      // no storage: the coach works in memory only
    }
  }
}
