import { legalActions } from './legal-actions';
import { initialCashflowGameState } from './types';
import type { CashflowGameState } from './types';

const ids = (state: CashflowGameState) => legalActions(state).map((action) => action.action);

function started(patch: Partial<CashflowGameState>): CashflowGameState {
  return { ...initialCashflowGameState(), gameSetId: 'classic', professionId: 'nurse', ...patch };
}

describe('legalActions', () => {
  it('offers only starting a game before a profession is picked', () => {
    expect(ids(initialCashflowGameState())).toEqual(['start']);
  });

  it('offers the roll in a solo game waiting for one', () => {
    expect(ids(started({ mode: 'solo' }))).toEqual(['roll', 'bank_loan', 'reset']);
  });

  it('offers passing the card, and no roll, while a card decision is open', () => {
    const state = started({
      mode: 'solo',
      turn: { phase: 'decide', count: 3, pending: { kind: 'deal', spaceIndex: 2 } },
    });
    expect(ids(state)).toEqual(['draw_card', 'buy_deal', 'pass_card', 'bank_loan', 'reset']);
  });

  it('offers nothing but a reset once a solo game is over', () => {
    const state = started({ mode: 'solo', turn: { phase: 'over', count: 40, outcome: 'escaped' } });
    expect(ids(state)).toEqual(['reset']);
  });

  it('offers undo only when there is a step to take back', () => {
    expect(legalActions(started({}), { canUndo: true }).map((a) => a.action)).toContain('undo');
    expect(ids(started({}))).not.toContain('undo');
  });

  it('offers dismissing a status reminder only while one is showing (companion)', () => {
    expect(ids(started({ unemployedRoundsLeft: 2 }))).toContain('clear_status');
    expect(ids(started({}))).not.toContain('clear_status');
  });

  it('offers the player-reported spaces in a companion game', () => {
    expect(ids(started({}))).toEqual([
      'draw_card',
      'buy_deal',
      'play_market',
      'pay_doodad',
      'payday',
      'baby',
      'charity',
      'downsized',
      'bank_loan',
      'reset',
    ]);
  });
});
