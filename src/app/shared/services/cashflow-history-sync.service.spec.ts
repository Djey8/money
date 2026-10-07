import { Subject, of } from 'rxjs';
import { LIVE_HISTORY_PATH } from '@money/domain';
import { CashflowHistorySyncService } from './cashflow-history-sync.service';

// The real codec streams through the browser's compressor; it has its own tests.
jest.mock('../saved-game-codec', () => ({
  packSavedGame: async (value: unknown) => `raw:${JSON.stringify(value)}`,
  unpackSavedGame: async (text: string) => JSON.parse(text.slice(4)),
}));

const stored = (value: unknown) => ({ val: () => ({ payload: `raw:${JSON.stringify(value)}` }) });
const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe('CashflowHistorySyncService', () => {
  let changed: Subject<void>;
  let game: any;
  let database: { writeObject: jest.Mock; getData: jest.Mock };
  let service: CashflowHistorySyncService;
  const cryptic = { decrypt: (value: string) => value } as any;

  beforeAll(() => {
    CashflowHistorySyncService.writeDelayMs = 20;
  });

  beforeEach(() => {
    changed = new Subject<void>();
    game = {
      historyChanged$: changed,
      canUndo: true,
      historyUpdatedAt: '2026-10-05T10:00:00.000Z',
      liveHistory: jest.fn(() => ({ schema: 1, updatedAt: 'now', undo: {}, steps: [] })),
      adoptAccountHistory: jest.fn(() => false),
    };
    database = { writeObject: jest.fn(() => of(undefined)), getData: jest.fn() };
    service = new CashflowHistorySyncService(game, database as any, cryptic);
  });

  it('writes a burst of changes as one packed document, a moment after the last', async () => {
    changed.next();
    changed.next();
    changed.next();
    expect(database.writeObject).not.toHaveBeenCalled();

    await delay(60);
    expect(database.writeObject).toHaveBeenCalledTimes(1);
    const [path, value] = database.writeObject.mock.calls[0];
    expect(path).toBe(LIVE_HISTORY_PATH);
    expect(value.schema).toBe(1);
    expect(typeof value.payload).toBe('string');
  });

  it('a failing write never throws into the game', async () => {
    database.writeObject.mockImplementation(() => {
      throw new Error('offline');
    });
    changed.next();
    await delay(60);
    expect(database.writeObject).toHaveBeenCalledTimes(1);
  });

  it('on load hands the account’s copy to the game and writes nothing back when it was taken', async () => {
    database.getData.mockResolvedValue(stored({ schema: 1, updatedAt: '2999' }));
    game.adoptAccountHistory.mockReturnValue(true);
    await service.loadAndAdopt();
    await settle();
    expect(game.adoptAccountHistory).toHaveBeenCalledWith({ schema: 1, updatedAt: '2999' });
    expect(database.writeObject).not.toHaveBeenCalled();
  });

  it('on load writes the browser’s copy out when the account has none or an older one', async () => {
    database.getData.mockResolvedValue({ val: () => null });
    await service.loadAndAdopt();
    await settle();
    expect(database.writeObject).toHaveBeenCalledTimes(1);

    database.writeObject.mockClear();
    database.getData.mockResolvedValue(
      stored({ schema: 1, updatedAt: '2000-01-01T00:00:00.000Z' }),
    );
    await service.loadAndAdopt();
    await settle();
    expect(database.writeObject).toHaveBeenCalledTimes(1);
  });

  it('on load leaves everything alone when the browser has no history, and survives a failed read', async () => {
    game.canUndo = false;
    database.getData.mockResolvedValue({ val: () => null });
    await service.loadAndAdopt();
    await settle();
    expect(database.writeObject).not.toHaveBeenCalled();

    database.getData.mockRejectedValue(new Error('offline'));
    await expect(service.loadAndAdopt()).resolves.toBeUndefined();
  });
});
