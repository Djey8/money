import { openDecisions } from './asset-deals';
import { currentTurn, whyCannotRoll, whyCannotSettle } from './turn';
import type { CashflowGameState } from './types';

/**
 * What the player (or an agent) may do right now, as plain ids (todo/cashflow-game-pro.md, slice D1). The rules that
 * say "not now" are the same ones the app and the turn engine use - this only collects them - so an agent is never
 * offered a move the game would refuse. A solo game is driven by the roll; a companion game by the player's report of
 * the space they landed on.
 */

export type LegalActionId =
  | 'start'
  | 'roll'
  | 'pass_card'
  | 'draw_card'
  | 'buy_deal'
  | 'pay_doodad'
  | 'play_market'
  | 'roll_decision'
  | 'sell_position'
  | 'payday'
  | 'baby'
  | 'charity'
  | 'downsized'
  | 'clear_status'
  | 'bank_loan'
  | 'undo'
  | 'reset';

export interface LegalAction {
  action: LegalActionId;
  description: string;
}

/** What may be done with a card: draw one, and deal with it the way its pile asks. `kind` is the pending pile (any in a companion game). */
function cardActions(kind: 'deal' | 'market' | 'doodad' | undefined): LegalAction[] {
  const actions: LegalAction[] = [
    {
      action: 'draw_card',
      description: kind
        ? `Draw a random ${kind} card.`
        : 'Draw a random card from a pile (dealSmall, dealBig, market or doodad).',
    },
  ];
  if (!kind || kind === 'deal') {
    actions.push({
      action: 'buy_deal',
      description: 'Plan and buy a Deal card (a share or a property) by its card id.',
    });
  }
  if (!kind || kind === 'market') {
    actions.push({
      action: 'play_market',
      description:
        'Play a Market card by its card id: buyer offers, price moves, splits, boosts and costs.',
    });
  }
  if (!kind || kind === 'doodad') {
    actions.push({
      action: 'pay_doodad',
      description:
        'Pay a Doodad card by its card id (the Bank loan is taken first when cash is short).',
    });
  }
  return actions;
}

export function legalActions(
  state: CashflowGameState,
  options: { canUndo?: boolean } = {},
): LegalAction[] {
  if (!state.professionId) {
    return [{ action: 'start', description: 'Pick a game set and a profession to begin a game.' }];
  }
  const actions: LegalAction[] = [];
  if (state.mode === 'solo') {
    if (!whyCannotRoll(state)) {
      actions.push({
        action: 'roll',
        description: 'Roll the dice, move the token and resolve the space it lands on.',
      });
    }
    if (!whyCannotSettle(state)) {
      const pending = currentTurn(state).pending;
      actions.push(...cardActions(pending?.kind));
      actions.push({
        action: 'pass_card',
        description: `Leave the ${pending?.kind ?? 'card'} on this space without playing it; the next roll is open afterwards.`,
      });
    }
  } else {
    actions.push(
      ...cardActions(undefined),
      { action: 'payday', description: 'Run a Payday: salary in, monthly expenses out.' },
      { action: 'baby', description: 'A child is born: raises the monthly expenses.' },
      { action: 'charity', description: 'Donate; roll one or two dice for the next 3 turns.' },
      { action: 'downsized', description: 'Lose the job: pay the total monthly expenses once.' },
    );
    if (state.charityRoundsLeft > 0 || state.unemployedRoundsLeft > 0) {
      actions.push({
        action: 'clear_status',
        description: 'Dismiss the Charity (dice choice) or Downsized (sitting out) reminder.',
      });
    }
  }
  if (currentTurn(state).phase !== 'over') {
    actions.push({
      action: 'bank_loan',
      description: 'Borrow one more loan step from the bank, or repay some of it.',
    });
  }
  if (currentTurn(state).phase !== 'over') {
    actions.push({
      action: 'sell_position',
      description:
        'Sell a position you hold: shares (quantity, price), a property to the buyer a Market card brought, gold by the coin.',
    });
  }
  const waiting = openDecisions(state);
  if (waiting.length > 0) {
    actions.push({
      action: 'roll_decision',
      description: `Roll the die for a waiting card (${waiting.map((deal) => deal.title).join(', ')}).`,
    });
  }
  if (options.canUndo) {
    actions.push({
      action: 'undo',
      description: 'Take back the newest step (or several, with count), exactly as before it ran.',
    });
  }
  actions.push({ action: 'reset', description: 'Wipe the running game (destructive).' });
  return actions;
}
