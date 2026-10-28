import type { GameBooks } from '@money/domain';
import type { DreamPending, DreamPendingInfo, DreamResolvedView } from './dream-session.service';

/**
 * What a Dreamfund table wants from a player next, in the shape the solo screen keeps it (todo/dreamfund-tables-solo-ui.md, R4): the
 * card drawn for the tile the token stands on is written into the turn's pending decision, so the solo views (the Emergency card, the
 * Life card, the dreams offered, the Opportunity cards) show it exactly as they do in a solo game - the server drew it, the screen
 * only reads it. Only the player's own decision is known in full; a pending decision of somebody else has just its kind.
 *
 * The table's own additions ride in the same entries under `dream...` names the solo game never reads: the plans an emergency may be
 * paid over (the server worked them out), whether it must be paid at once, and what the card came to once it was dealt with.
 */
export interface DreamPendingExtras {
  info?: DreamPendingInfo | null;
  resolved?: DreamResolvedView | null;
}

export function withDreamPending(
  books: GameBooks,
  pending: DreamPending | { kind: string } | null | undefined,
  extras: DreamPendingExtras = {},
): GameBooks {
  const turn = books.state.turn;
  const open = turn?.pending;
  if (!turn || !open || open.kind !== 'story') return books;
  let next = open;
  const card = pending as
    | (DreamPending & {
        cardId?: string;
        offers?: string[];
        pile?: string;
        options?: string[];
        roll?: number;
      })
    | null
    | undefined;
  switch (card?.kind) {
    case 'emergency':
      if (card.cardId) {
        next = {
          ...open,
          emergency: {
            cardId: card.cardId,
            skipped: [],
            ...(card.choiceId ? { choiceId: card.choiceId } : {}),
            ...(card.rolls ? { rolls: card.rolls } : {}),
            ...(card.rerolled ? { rerolled: true } : {}),
            dreamPlans: extras.info?.emergency?.plans ?? [],
            dreamMustPayNow: extras.info?.emergency?.mustPayNow ?? false,
            dreamPayMinor: extras.info?.emergency?.payMinor ?? null,
          } as never,
        };
      }
      break;
    case 'life':
      if (card.cardId) next = { ...open, life: { cardId: card.cardId, skipped: [] } };
      break;
    case 'dream':
      next = { ...open, dream: { offers: card.offers ?? [] } };
      break;
    case 'career_branch':
      next = {
        ...open,
        career: {
          result: { kind: 'branch', options: card.options ?? [], roll: card.roll ?? 0 },
        } as never,
      };
      break;
    case 'opportunity':
      next = { ...open, opportunity: { pile: card.pile, offers: card.offers ?? [], told: [] } };
      break;
    default:
      break;
  }
  // a card that was dealt with this turn stays on the screen with what came of it, until the next roll
  const done = extras.resolved as (DreamResolvedView & Record<string, unknown>) | null | undefined;
  if (!card && done?.kind === 'emergency' && typeof done['cardId'] === 'string') {
    next = {
      ...open,
      emergency: {
        cardId: done['cardId'],
        skipped: [],
        ...(done['choiceId'] ? { choiceId: done['choiceId'] as string } : {}),
        ...(done['rolls'] ? { rolls: done['rolls'] as Record<string, number> } : {}),
        dreamPaid: { payMinor: done['payMinor'], how: done['how'] },
      } as never,
    };
  } else if (!card && done?.kind === 'career') {
    next = {
      ...open,
      career: {
        result: done['result'] as never,
        done: true,
        ...(done['reached'] ? { reached: done['reached'] as string } : {}),
      },
    };
  } else if (!card && done?.kind === 'dream') {
    next = {
      ...open,
      dream: {
        offers: (done['offers'] as string[] | undefined) ?? [],
        ...(done['moment'] ? { moment: done['moment'] as string } : {}),
        ...(done['declined'] ? { declined: true } : {}),
        // the Smile project of the dream taken is named by the bridge, in the language of the screen
        ...(done['taken'] ? { dreamTakenCardId: done['taken'] } : {}),
      } as never,
    };
  } else if (!card && done?.kind === 'life' && typeof done['cardId'] === 'string') {
    next = {
      ...open,
      life: {
        cardId: done['cardId'],
        skipped: [],
        decision: done['decision'] as string,
        outcome: done['outcome'] as never,
      },
    };
  }
  if (next === open) return books;
  return { ...books, state: { ...books.state, turn: { ...turn, pending: next } } };
}
