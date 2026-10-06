'use strict';

const { EncryptionSession } = require('@money/domain');
const { getGame, listGameSets, getGameSet } = require('../../repositories/game-repository');
const { decodeGameState } = require('../../services/game-state-codec');

const plainState = {
  gameSetId: 'placeholder',
  professionId: 'placeholder-profession',
  mode: 'solo',
  boardPosition: '5',
  round: '3',
  virtualDate: '2026-04-01',
  children: '1',
  charityRoundsLeft: '0',
  unemployedRoundsLeft: '0',
  gameSubscriptionTitles: ['Placeholder profession', 'Placeholder Expenses'],
  drawnCardIds: { dealSmall: ['a'], dealBig: [], market: [], doodad: [] },
  history: [],
  assetDeals: [],
  marketOffers: [],
  turn: {
    phase: 'decide',
    count: '7',
    lastRoll: ['4'],
    pending: { kind: 'deal', spaceIndex: '4' },
  },
};

function dependencies(data, encryptionConfig) {
  return {
    usersDb: { get: jest.fn(async () => ({ data })) },
    authDb: { get: jest.fn(async () => ({ encryptionConfig })) },
  };
}

const subscriptions = [
  { id: 's1', title: 'Placeholder profession', amount: 3000, account: 'Income' },
  { id: 's2', title: 'Placeholder Expenses', amount: -1800, account: 'Daily' },
];

function encryptDeep(value, session) {
  if (Array.isArray(value)) return value.map((item) => encryptDeep(item, session));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, encryptDeep(v, session)]));
  }
  return session.encrypt(String(value));
}

describe('decodeGameState', () => {
  it('returns the initial state for an account without a game', () => {
    expect(decodeGameState(undefined, null).professionId).toBeNull();
  });

  it('reads the stored leaves back into typed values', () => {
    const state = decodeGameState(plainState, null);
    expect(state.boardPosition).toBe(5);
    expect(state.round).toBe(3);
    expect(state.turn).toEqual({
      phase: 'decide',
      count: 7,
      lastRoll: [4],
      pending: { kind: 'deal', spaceIndex: 4 },
    });
    expect(state.drawnCardIds.dealSmall).toEqual(['a']);
  });

  it('reads an encrypted state the way the browser wrote it', () => {
    const session = new EncryptionSession('secret');
    const state = decodeGameState(encryptDeep(plainState, session), session);
    expect(state.professionId).toBe('placeholder-profession');
    expect(state.turn.pending).toEqual({ kind: 'deal', spaceIndex: 4 });
  });
});

describe('getGame', () => {
  it('says there is no game, and that one can be started, for a fresh account', async () => {
    const result = await getGame(dependencies({}), 'user_1');
    expect(result).toEqual({
      active: false,
      legalActions: [expect.objectContaining({ action: 'start' })],
    });
  });

  it('describes a running solo game: pending decision, figures and legal actions', async () => {
    const deps = dependencies({
      meta: { schemaVersion: 1, currency: 'EUR' },
      cashflowGame: plainState,
      subscriptions,
      transactions: [],
    });
    const game = await getGame(deps, 'user_1');
    expect(game).toMatchObject({
      active: true,
      mode: 'solo',
      round: 3,
      position: { index: 5, spaceKind: 'payday' },
      pendingDecision: { kind: 'deal', spaceIndex: 4 },
      outcome: 'playing',
      cashMinor: 0,
      finances: { salaryMinor: 300000, expensesMinor: 180000, monthlyCashflowMinor: 120000 },
    });
    expect(game.legalActions.map((action) => action.action)).toEqual([
      'pass_card',
      'bank_loan',
      'reset',
    ]);
  });
});

describe('game sets', () => {
  it('lists every set with its professions', () => {
    const sets = listGameSets();
    expect(sets.length).toBeGreaterThan(0);
    expect(sets[0].professions[0]).toEqual(
      expect.objectContaining({ id: expect.any(String), salaryMinor: expect.any(Number) }),
    );
  });

  it('returns one set with the 24-space board, and null for an unknown id', () => {
    const [first] = listGameSets();
    expect(getGameSet(first.id).board).toHaveLength(24);
    expect(getGameSet('nope')).toBeNull();
  });
});
