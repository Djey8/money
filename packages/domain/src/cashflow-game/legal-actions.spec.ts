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
    expect(ids(state)).toEqual(['pass_card', 'bank_loan', 'reset']);
  });

  it('offers nothing but a reset once a solo game is over', () => {
    const state = started({ mode: 'solo', turn: { phase: 'over', count: 40, outcome: 'escaped' } });
    expect(ids(state)).toEqual(['reset']);
  });

  it('offers the player-reported spaces in a companion game', () => {
    expect(ids(started({}))).toEqual([
      'payday',
      'baby',
      'charity',
      'downsized',
      'bank_loan',
      'reset',
    ]);
  });
});
