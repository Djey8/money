import { CashflowGameService } from '../../shared/services/cashflow-game.service';
import { CASHFLOW_GAME_SETS } from '../../shared/cashflow-content';
import type { CardKindOf } from './game-markers';

interface Titled {
  title?: Record<string, string> | string;
}

const PILES = ['emergency', 'life', 'opportunity', 'harvest'] as const;

let cache: { sets: number; index: Map<string, ReturnType<CardKindOf>> } | null = null;

function titlesOf(card: Titled): string[] {
  const title = card.title;
  if (!title) return [];
  return typeof title === 'string' ? [title] : Object.values(title).filter((t) => !!t);
}

/** Title (any language, lower case) -> the kind of the card or career step that bears it. Built once the game content is there. */
function buildIndex(): Map<string, ReturnType<CardKindOf>> {
  const index = new Map<string, ReturnType<CardKindOf>>();
  for (const set of CASHFLOW_GAME_SETS) {
    const decks = (set.decks ?? {}) as unknown as Record<string, Titled[] | undefined>;
    for (const pile of PILES) {
      for (const card of decks[pile] ?? []) {
        for (const title of titlesOf(card)) index.set(title.toLowerCase(), pile);
      }
    }
    // a career step is booked under the title of the stage reached (the fee of the promotion)
    for (const profession of set.professions ?? []) {
      const stages = (profession as unknown as { career?: { stages?: Titled[] } }).career?.stages;
      for (const stage of stages ?? []) {
        for (const title of titlesOf(stage)) {
          if (!index.has(title.toLowerCase())) index.set(title.toLowerCase(), 'career');
        }
      }
    }
  }
  return index;
}

/** What card a booking category belongs to ("@Hobbies" is no card: null). Empty until the game content is loaded. */
export const gameCardKindOf: CardKindOf = (title) => {
  if (CASHFLOW_GAME_SETS.length === 0) return null;
  if (!cache || cache.sets !== CASHFLOW_GAME_SETS.length) {
    cache = { sets: CASHFLOW_GAME_SETS.length, index: buildIndex() };
  }
  return cache.index.get(title.trim().toLowerCase()) ?? null;
};

/** This account plays the game (its game content is loaded and it is a game account): only then the chart draws game markers off the books. */
export function isGameAccount(): boolean {
  return CashflowGameService.isCashflowGame();
}
