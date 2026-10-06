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
      actions.push({
        action: 'pass_card',
        description: `Leave the ${pending?.kind ?? 'card'} on this space without playing it; the next roll is open afterwards.`,
      });
    }
  } else {
    actions.push(
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
  if (options.canUndo) {
    actions.push({
      action: 'undo',
      description: 'Take back the newest step (or several, with count), exactly as before it ran.',
    });
  }
  actions.push({ action: 'reset', description: 'Wipe the running game (destructive).' });
  return actions;
}
