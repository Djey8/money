'use strict';

const { EncryptionSession, initialCashflowGameState } = require('@money/domain');
const { decodeGameState, encodeGameState } = require('../../services/game-state-codec');
const { createGameText, createMoneyFormat } = require('../../services/game-text');

const state = {
  ...initialCashflowGameState(),
  gameSetId: 'placeholder',
  professionId: 'placeholder-profession',
  mode: 'solo',
  boardPosition: 5,
  round: 3,
  virtualDate: '2026-04-01',
  children: 1,
  gameSubscriptionTitles: ['Salary'],
  drawnCardIds: { dealSmall: ['a'], dealBig: [], market: [], doodad: [] },
  assetDeals: [{ title: 'GOLD', coins: 2.5, costMinor: 500000, stage: 'owned', recurring: true }],
  turn: { phase: 'decide', count: 7, lastRoll: [4], pending: { kind: 'deal', spaceIndex: 4 } },
  gameId: 'game_1',
};

describe('game state codec', () => {
  it('round-trips a state through the stored form, plain', () => {
    expect(decodeGameState(encodeGameState(state, null), null)).toEqual(state);
  });

  it('round-trips encrypted, and every leaf is ciphertext', () => {
    const session = new EncryptionSession('secret');
    const stored = encodeGameState(state, session);
    expect(stored.round).not.toBe(3);
    expect(stored.mode).not.toBe('solo');
    expect(decodeGameState(stored, session)).toEqual(state);
  });

  it('keeps a null token position null', () => {
    const stored = encodeGameState({ ...state, boardPosition: null }, new EncryptionSession('k'));
    expect(stored.boardPosition).toBeNull();
  });
});

describe('game text', () => {
  it('translates a catalog key and fills its parameters', () => {
    const text = createGameText('en');
    expect(text('CashflowGame.childrenExpensesSubscriptionTitle', { profession: 'Nurse' })).toBe(
      'Nurse Children Expenses',
    );
  });

  it('answers the key itself for an unknown key, like the browser', () => {
    expect(createGameText('de')('CashflowGame.noSuchKey')).toBe('CashflowGame.noSuchKey');
  });

  it('falls back to English for an unknown language', () => {
    expect(createGameText('xx')('CashflowGame.Round')).toBe('Round');
  });

  it('words an amount the way the app does', () => {
    expect(createMoneyFormat({ currency: '€', isEuropeanFormat: true })(400000)).toBe('4.000 €');
    expect(createMoneyFormat({ currency: '$', isEuropeanFormat: false })(400000)).toBe('4,000 $');
  });
});
