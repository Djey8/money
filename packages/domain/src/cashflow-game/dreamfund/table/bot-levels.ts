import { DREAM_POLICIES, type DreamPolicy } from '../../dreamfund-sim/policies';
import type { Rng } from '../../rng';

/**
 * The skill levels of a Dreamfund bot (JFK, 2026-10-27: "4 versions of a bot - master, strong, casual, beginner, see how we did for
 * the classic bots"): the same strategy, played with a chance per decision of a slip - a card its strategy would take is passed, one it
 * would leave is taken, a sale is made or missed. A level is part of the bot's id: `expert` is a master, `expert--casual` a casual one.
 * The level is the bot's; the difficulty of the game is the table's - a bot has a rating for each difficulty at each level.
 */

export type DreamBotLevel = 'master' | 'strong' | 'casual' | 'beginner';

/** The chance, per decision, that a bot of the level slips (the classic bots' values). */
export const DREAM_BOT_LEVELS: Record<DreamBotLevel, number> = {
  master: 0,
  strong: 0.1,
  casual: 0.25,
  beginner: 0.45,
};

const SEPARATOR = '--';

/** `expert--casual` -> the strategy and the level; a plain id is a master. Null for a strategy or level that does not exist. */
export function splitDreamBotId(id: string): { base: string; level: DreamBotLevel } | null {
  const at = id.lastIndexOf(SEPARATOR);
  const base = at < 0 ? id : id.slice(0, at);
  const level = at < 0 ? 'master' : id.slice(at + SEPARATOR.length);
  if (!DREAM_POLICIES.some((policy) => policy.id === base)) return null;
  if (!Object.prototype.hasOwnProperty.call(DREAM_BOT_LEVELS, level)) return null;
  return { base, level: level as DreamBotLevel };
}

export const dreamBotId = (base: string, level: DreamBotLevel) =>
  level === 'master' ? base : `${base}${SEPARATOR}${level}`;

/** A strategy that slips with a chance per decision (the coin is the bot's own luck, not the table's dice). */
export function withDreamMistakes(policy: DreamPolicy, chance: number, coin: Rng): DreamPolicy {
  if (chance <= 0) return policy;
  const slip = () => coin() < chance;
  return {
    ...policy,
    pile: (view, rng) =>
      slip()
        ? (['seed', 'sapling', 'tree'] as const)[Math.floor(coin() * 3)]
        : policy.pile(view, rng),
    take: (offers, view, held) => {
      const wanted = policy.take(offers, view, held);
      if (!slip()) return wanted;
      // passes what it would take, or takes what it would not
      if (wanted) return null;
      const card = offers[Math.floor(coin() * offers.length)];
      return card ? { card, choice: {} } : null;
    },
    dream: (offers, view, open) => {
      const wanted = policy.dream(offers, view, open);
      return slip() ? (wanted ? null : (offers[0] ?? null)) : wanted;
    },
    sellWindow: (view, holding, index) => {
      const wanted = policy.sellWindow(view, holding, index);
      return slip() ? !wanted : wanted;
    },
    acceptBuyer: (view, sale) => {
      const wanted = policy.acceptBuyer(view, sale);
      return slip() ? !wanted : wanted;
    },
    ladder: (view, offer) => {
      const wanted = policy.ladder(view, offer);
      if (!slip()) return wanted;
      return wanted === 'ride' ? 'cash' : 'ride';
    },
  };
}
