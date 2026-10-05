import { AppDataService } from './app-data.service';

/**
 * The game state is written to the database leaf by leaf (everything a string once encrypted) and read
 * back field by field. A field the reader does not name is silently lost on the next load - which is how
 * the gold coin counts, the Multi-Level-Marketing cards, the pending dice decisions and the market offers
 * once vanished after a reload (found 2026-10-04). Every field of the state has to come back.
 */
describe('AppDataService game state read-back', () => {
  const read = (raw: unknown) => {
    const service: any = Object.create(AppDataService.prototype);
    service.cryptic = { decrypt: (value: unknown) => String(value) };
    return service.decryptCashflowGameState(raw);
  };

  const stored = {
    gameSetId: 'cashflow',
    professionId: 'hausmeister',
    mode: 'companion',
    round: '3',
    virtualDate: '2026-12-01',
    children: '1',
    charityRoundsLeft: '0',
    unemployedRoundsLeft: '0',
    gameSubscriptionTitles: ['Salary', 'Rent'],
    drawnCardIds: { dealSmall: ['a'], dealBig: [], market: [], doodad: [] },
    history: [],
    gameId: 'game_abc',
    gameName: 'My run',
    assetDeals: [
      {
        title: 'GOLD',
        coins: '2.5',
        costMinor: '75000',
        successOn: '4',
        payoutMinor: '50000',
        recurring: 'true',
        rollDue: 'false',
        stage: 'owned',
        successText: 'Won',
        failureText: 'Lost',
      },
      {
        title: 'SPLIT-OK4U',
        coins: '0',
        costMinor: '0',
        stage: 'awaitingRoll',
        split: { shareTag: 'OK4U' },
      },
    ],
    marketOffers: [
      {
        title: 'GOLD',
        salePriceMinor: '2500000',
        cardId: 'c1',
        label: '1.000 € × 25',
        pricePerCoinMinor: '100000',
      },
    ],
  };

  it('brings back the asset deals, with their numbers and flags intact', () => {
    const state = read(stored);

    expect(state.assetDeals).toEqual([
      {
        title: 'GOLD',
        coins: 2.5,
        costMinor: 75000,
        successOn: 4,
        payoutMinor: 50000,
        recurring: true,
        rollDue: false,
        stage: 'owned',
        successText: 'Won',
        failureText: 'Lost',
      },
      {
        title: 'SPLIT-OK4U',
        coins: 0,
        costMinor: 0,
        split: { shareTag: 'OK4U' },
        stage: 'awaitingRoll',
      },
    ]);
  });

  it('brings back the market offers and the saved-game slot', () => {
    const state = read(stored);

    expect(state.marketOffers).toEqual([
      {
        title: 'GOLD',
        salePriceMinor: 2500000,
        cardId: 'c1',
        label: '1.000 € × 25',
        pricePerCoinMinor: 100000,
      },
    ]);
    expect(state.gameId).toBe('game_abc');
    expect(state.gameName).toBe('My run');
  });

  it('brings back a solo game’s token and open turn', () => {
    const state = read({
      ...stored,
      mode: 'solo',
      boardPosition: '7',
      turn: {
        phase: 'decide',
        count: '4',
        lastRoll: ['3', '4'],
        pending: { kind: 'market', spaceIndex: '7' },
      },
    });

    expect(state.mode).toBe('solo');
    expect(state.boardPosition).toBe(7);
    expect(state.turn).toEqual({
      phase: 'decide',
      count: 4,
      lastRoll: [3, 4],
      pending: { kind: 'market', spaceIndex: 7 },
    });
    expect(read({ ...stored, turn: { phase: 'roll', count: '0' } }).turn).toEqual({
      phase: 'roll',
      count: 0,
    });
  });

  it('brings back how a finished solo game ended', () => {
    const state = read({
      ...stored,
      mode: 'solo',
      turn: { phase: 'over', count: '31', outcome: 'escaped' },
    });
    expect(state.turn).toEqual({ phase: 'over', count: 31, outcome: 'escaped' });
  });

  it('a companion game has no turn', () => {
    expect(read(stored).turn).toBeUndefined();
    expect(read(stored).boardPosition).toBeNull();
  });

  it('a game saved before these existed still loads, with empty lists and no slot', () => {
    const { assetDeals: _a, marketOffers: _m, gameId: _i, gameName: _n, ...older } = stored;

    const state = read(older);

    expect(state.assetDeals).toEqual([]);
    expect(state.marketOffers).toEqual([]);
    expect(state.gameId).toBeUndefined();
    expect(state.round).toBe(3);
  });
});
