import type { Type } from '@angular/core';

/**
 * Where the coach of the guided Dreamer demo game is hung into the app (JFK, 2026-11-06). The coach has to follow the person from the
 * game screen to the Grow, Fire and Smile pages and back, so it cannot live in one page: the app shell draws whatever component is
 * registered here. Nothing of the coach is in the shared files - the lazy tables chunk registers itself when a demo starts, so the Firebase
 * build only carries this empty holder (docs/adr/0004; the same pattern as `RemoteGameHook`).
 */
export class DemoGuideHook {
  /** The coach's component, set by the tables chunk when a demo starts. */
  static component: Type<unknown> | null = null;
  /** Whether the coach is on. */
  static on: () => boolean = () => false;
}
