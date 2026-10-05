import { savedGameStatus } from '@money/domain';
import { of } from 'rxjs';
import { AppStateService } from './app-state.service';
import { CashflowGameService } from './cashflow-game.service';
import { CashflowSavedGamesService } from './cashflow-saved-games.service';
import { IncomeStatementService } from './income-statement.service';
import { ProfileComponent } from '../../panels/profile/profile.component';

const ok = () => ({ onSuccess: jest.fn(), onError: jest.fn() });

describe('CashflowSavedGamesService', () => {
  let game: CashflowGameService;
  let saved: CashflowSavedGamesService;
  let store: Map<string, any>;
  let previousMail: string;

  beforeEach(() => {
    previousMail = ProfileComponent.mail;
    ProfileComponent.mail = 'player@cashflow.example';
    (AppStateService as any)._instance = undefined;
    localStorage.clear();
    const state = AppStateService.instance;
    Object.assign(state, {
      allRevenues: [],
      allIntrests: [],
      allProperties: [],
      dailyExpenses: [],
      splurgeExpenses: [],
      smileExpenses: [],
      fireExpenses: [],
      mojoExpenses: [],
      allSmileProjects: [],
      allFireEmergencies: [],
      allShares: [],
      allInvestments: [],
      allGrowProjects: [],
      allAssets: [],
      liabilities: [],
      allSubscriptions: [],
      allTransactions: [],
      mojo: { amount: 0, target: 0 },
      daily: 60,
      splurge: 10,
      smile: 10,
      fire: 20,
    });

    const persistence = {
      batchWriteAndSync: jest.fn((config) => config.onSuccess()),
      writeAndSync: jest.fn((config) => config.onSuccess()),
    };
    const translate = { currentLang: 'en', instant: jest.fn((key: string) => key) };
    game = new CashflowGameService(
      persistence as any,
      new IncomeStatementService({ saveData: jest.fn() } as any),
      translate as any,
    );

    // The user's database: stores exactly what writeObject is given, like the real one does.
    store = new Map();
    const database = {
      writeObject: jest.fn((tag: string, element: any) => {
        store.set(tag, JSON.parse(JSON.stringify(element)));
        return of({});
      }),
      getData: jest.fn(async (tag: string) => ({ val: () => store.get(tag) ?? null })),
    };
    saved = new CashflowSavedGamesService(
      database as any,
      { decrypt: (value: string) => String(value) } as any,
      game,
      translate as any,
    );
  });

  afterEach(() => (ProfileComponent.mail = previousMail));

  const start = () => game.pickProfession('cashflow', 'hausmeister', ok());

  it('has nothing to save before a game is started', async () => {
    expect(await saved.saveCurrent()).toBeNull();
    expect(store.size).toBe(0);
  });

  it('the first save gives the running game a slot and a name, and lists it', async () => {
    start();

    const summary = await saved.saveCurrent();

    const live = AppStateService.instance.cashflowGame;
    expect(summary).toMatchObject({
      id: live.gameId,
      name: live.gameName,
      professionId: 'hausmeister',
    });
    expect(live.gameId).toMatch(/^game_/);
    expect(saved.games.map((g) => g.id)).toEqual([live.gameId]);
    expect(store.has(`cashflowGames/games/${live.gameId}`)).toBe(true);
    expect(store.has('cashflowGames/index')).toBe(true);
  });

  it('saving again updates the same slot instead of adding a game', async () => {
    start();
    const first = await saved.saveCurrent();
    game.payday(ok());

    const second = await saved.saveCurrent();

    expect(second!.id).toBe(first!.id);
    expect(second!.createdAt).toBe(first!.createdAt);
    expect(second!.round).toBeGreaterThan(first!.round);
    expect(saved.games).toHaveLength(1);
  });

  it('the list entry carries the numbers statistics will need, in minor units', async () => {
    start();
    const summary = await saved.saveCurrent();

    expect(summary).toMatchObject({
      gameSetId: 'cashflow',
      round: 0,
      escapedRatRace: false,
      bankrupt: false,
    });
    expect(summary!.salaryMinor).toBeGreaterThan(0);
    expect(summary!.expensesMinor).toBeGreaterThan(0);
    expect(summary!.transactionCount).toBeGreaterThanOrEqual(0);
  });

  it('a new game saves the old one first and leaves a clean account', async () => {
    start();
    game.payday(ok());
    const transactions = AppStateService.instance.allTransactions.length;

    await saved.startNewGame();

    const state = AppStateService.instance;
    expect(state.cashflowGame.professionId).toBeNull();
    expect(state.allTransactions).toEqual([]);
    expect(saved.games).toHaveLength(1);
    expect(saved.games[0].transactionCount).toBe(transactions);
  });

  it('loading another game saves the one being played and restores the other exactly', async () => {
    start();
    game.payday(ok());
    const firstGame = (await saved.saveCurrent())!;
    const firstTransactions = JSON.stringify(AppStateService.instance.allTransactions);
    await saved.startNewGame();

    game.pickProfession('cashflow', 'hausmeister', ok());
    game.payday(ok());
    game.payday(ok());
    const secondId = AppStateService.instance.cashflowGame.gameId;
    expect(secondId).toBeUndefined(); // not saved yet

    await saved.loadGame(firstGame.id);

    const state = AppStateService.instance;
    expect(state.cashflowGame.gameId).toBe(firstGame.id);
    expect(JSON.stringify(state.allTransactions)).toBe(firstTransactions);
    expect(saved.games).toHaveLength(2); // the second game was saved on the way
    // a loaded game brings its own history back, not the one of whatever ran before
    expect(game.historySteps().map((step) => step.kind)).toEqual(['payday', 'start']);
  });

  it('a loaded game can be undone move by move, back to before it started', async () => {
    start();
    game.payday(ok());
    game.adjustBankLoan(1000, ok());
    game.payday(ok());
    const first = (await saved.saveCurrent())!;
    await saved.startNewGame();
    start();
    game.payday(ok());

    await saved.loadGame(first.id);
    const state = AppStateService.instance;
    expect(game.historySteps().map((step) => step.kind)).toEqual([
      'payday',
      'loanTaken',
      'payday',
      'start',
    ]);

    game.undoSteps(1, ok());
    expect(state.cashflowGame.round).toBe(1);
    game.undoSteps(2, ok());
    expect(state.liabilities.find((l) => l.tag === 'Bank loan')).toBeUndefined();
    game.undoSteps(1, ok());
    expect(state.cashflowGame.professionId).toBeNull();
    // stepping back past the first save keeps the slot
    expect(state.cashflowGame.gameId).toBe(first.id);
  });

  it('a game saved before histories were kept loads with an empty history', async () => {
    start();
    game.payday(ok());
    const first = (await saved.saveCurrent())!;
    const key = `cashflowGames/games/${first.id}`;
    const blob = JSON.parse(store.get(key).payload.replace(/^raw:/, ''));
    delete blob.undo;
    store.set(key, { schema: 1, payload: `raw:${JSON.stringify(blob)}` });
    game.payday(ok());

    await saved.loadGame(first.id);

    expect(AppStateService.instance.cashflowGame.round).toBe(1);
    expect(game.canUndo).toBe(false);
  });

  it('a game that cannot be opened changes nothing', async () => {
    start();
    game.payday(ok());
    const before = JSON.stringify(AppStateService.instance.allTransactions);

    await expect(saved.loadGame('game_missing')).rejects.toThrow('could not be found');

    expect(JSON.stringify(AppStateService.instance.allTransactions)).toBe(before);
    expect(AppStateService.instance.cashflowGame.professionId).toBe('hausmeister');
    expect(saved.games).toHaveLength(0); // not even an automatic save happened
  });

  it('a damaged snapshot is refused before anything is touched', async () => {
    start();
    const first = (await saved.saveCurrent())!;
    const key = `cashflowGames/games/${first.id}`;
    const blob = JSON.parse(store.get(key).payload.replace(/^raw:/, ''));
    blob.snapshot.allTransactions = 'nope';
    store.set(key, { schema: 1, payload: `raw:${JSON.stringify(blob)}` });
    game.payday(ok());
    const before = JSON.stringify(AppStateService.instance.allTransactions);

    await expect(saved.loadGame(first.id)).rejects.toThrow('damaged');

    expect(JSON.stringify(AppStateService.instance.allTransactions)).toBe(before);
  });

  it('ending a game marks it ended and clears the account', async () => {
    start();

    await saved.endGame();

    expect(saved.games[0].endedAt).toBeTruthy();
    expect(AppStateService.instance.cashflowGame.professionId).toBeNull();
  });

  it('an ended game is playing again once it is continued, and stays so when saved', async () => {
    start();
    game.payday(ok());
    const first = (await saved.saveCurrent())!;
    await saved.endGame();
    expect(saved.games.find((g) => g.id === first.id)!.endedAt).toBeDefined();

    await saved.loadGame(first.id);
    const listed = () => saved.games.find((g) => g.id === first.id)!;
    expect(listed().endedAt).toBeUndefined();
    expect(savedGameStatus(listed())).toBe('playing');

    game.payday(ok());
    await saved.saveCurrent();
    expect(listed().endedAt).toBeUndefined();
    expect(savedGameStatus(listed())).toBe('playing');
  });

  it('a game can be ended again after it was continued', async () => {
    start();
    const first = (await saved.saveCurrent())!;
    await saved.endGame();
    await saved.loadGame(first.id);
    await saved.endGame();
    expect(savedGameStatus(saved.games.find((g) => g.id === first.id)!)).toBe('ended');
  });

  it('renaming changes the list and the running game', async () => {
    start();
    const first = (await saved.saveCurrent())!;

    await saved.renameGame(first.id, '  My first run  ');

    expect(saved.games[0].name).toBe('My first run');
    expect(AppStateService.instance.cashflowGame.gameName).toBe('My first run');
  });

  it('deleting a game removes it for good; if it was running, the account just forgets its slot', async () => {
    start();
    const first = (await saved.saveCurrent())!;

    await saved.deleteGame(first.id);

    expect(saved.games).toEqual([]);
    expect(AppStateService.instance.cashflowGame.gameId).toBeUndefined();
    expect(AppStateService.instance.cashflowGame.professionId).toBe('hausmeister'); // still playing
    await expect(saved.loadGame(first.id)).rejects.toThrow('could not be found');
  });

  it('an exported game can be imported as a new game and played from there', async () => {
    start();
    game.payday(ok());
    const first = (await saved.saveCurrent())!;
    const { fileName, text } = await saved.exportGame(first.id);
    expect(fileName).toMatch(/^cashflow-.+\.json$/);

    const imported = await saved.importGame(text);

    expect(imported.id).not.toBe(first.id);
    expect(saved.games).toHaveLength(2);
    await saved.loadGame(imported.id);
    expect(AppStateService.instance.cashflowGame.gameId).toBe(imported.id);
  });

  it('refuses a file that is not a saved game', async () => {
    await expect(saved.importGame('{"hello":1}')).rejects.toThrow('not a saved game');
    await expect(saved.importGame('not json')).rejects.toThrow('not a saved game');
  });

  it('keeps assetDeals and market offers through a save and a load', async () => {
    start();
    const state = AppStateService.instance;
    state.cashflowGame = {
      ...state.cashflowGame,
      assetDeals: [{ title: 'GOLD', coins: 10, costMinor: 300000, stage: 'owned' }],
      marketOffers: [{ title: 'SFH', salePriceMinor: 6000000, cardId: 'x', label: '+20%' }],
    };
    const first = (await saved.saveCurrent())!;
    await saved.startNewGame();

    await saved.loadGame(first.id);

    expect(AppStateService.instance.cashflowGame.assetDeals).toHaveLength(1);
    expect(AppStateService.instance.cashflowGame.marketOffers).toHaveLength(1);
  });
});
