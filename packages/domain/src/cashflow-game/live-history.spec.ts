import { identityText } from './game-text';
import { blankGameData, type GameSnapshot, type HistoryDeps } from './history';
import {
  accountHistoryIsNewer,
  buildLiveHistory,
  LIVE_HISTORY_PATH,
  LIVE_HISTORY_SCHEMA,
  readLiveHistory,
} from './live-history';
import { initialCashflowGameState, type CashflowGameState } from './types';

const deps: HistoryDeps = { text: identityText, money: (m) => `${m / 100}E` };
const started = (extra: Partial<CashflowGameState> = {}): CashflowGameState => ({
  ...initialCashflowGameState(),
  professionId: 'p',
  gameSetId: 's',
  virtualDate: '2026-10-01',
  ...extra,
});
const snap = (extra: Partial<GameSnapshot> = {}): GameSnapshot => ({
  ...blankGameData(),
  cashflowGame: started(),
  ...extra,
});

const stack = (): GameSnapshot[] => [
  snap({ step: { kind: 'start', detail: 'Janitor', at: 't1' } }),
  snap({
    step: { kind: 'payday', detail: 'Round 1', at: 't2' },
    allTransactions: [{ category: '@Savings' }],
  }),
];
const live = (): GameSnapshot =>
  snap({
    cashflowGame: started({ round: 1, gameId: 'game_1' }),
    allTransactions: [{ category: '@Savings' }, { category: '@Salary' }],
  });

describe('the live history', () => {
  it('lives at its own path', () => {
    expect(LIVE_HISTORY_PATH).toBe('cashflowGameHistory');
  });

  it('is the compact undo chain plus a plain log, oldest step first, stamped and tied to the game’s slot', () => {
    const history = buildLiveHistory(stack(), live(), deps, '2026-10-05T10:00:00.000Z');
    expect(history.schema).toBe(LIVE_HISTORY_SCHEMA);
    expect(history.updatedAt).toBe('2026-10-05T10:00:00.000Z');
    expect(history.gameId).toBe('game_1');
    expect(history.undo.format).toBe(1);
    expect(history.undo.snapshots).toHaveLength(2);
    expect(history.steps).toEqual([
      { number: 1, kind: 'start', detail: 'Janitor', at: 't1' },
      { number: 2, kind: 'payday', detail: 'Round 1', at: 't2' },
    ]);
  });

  it('has no slot until the game has one, and is empty for an empty stack', () => {
    const history = buildLiveHistory([], snap(), deps, 'now');
    expect('gameId' in history).toBe(false);
    expect(history.steps).toEqual([]);
    expect(history.undo.snapshots).toEqual([]);
  });

  it('survives being stored as JSON and reads back to the same steps', () => {
    const history = buildLiveHistory(stack(), live(), deps, 'now');
    const read = readLiveHistory<GameSnapshot>(JSON.parse(JSON.stringify(history)))!;
    expect(read.updatedAt).toBe('now');
    expect(read.gameId).toBe('game_1');
    expect(read.stack).toEqual(stack());
  });

  it('refuses anything that is not a live history', () => {
    const good = buildLiveHistory(stack(), live(), deps, 'now');
    for (const bad of [
      null,
      undefined,
      'text',
      {},
      { ...good, schema: undefined },
      { ...good, updatedAt: 5 },
      { ...good, undo: { format: 2, snapshots: [] } },
      { ...good, undo: 'nope' },
    ]) {
      expect(readLiveHistory(bad)).toBeNull();
    }
  });

  it('refuses one written by a newer version rather than misreading it', () => {
    const newer = {
      ...buildLiveHistory(stack(), live(), deps, 'now'),
      schema: LIVE_HISTORY_SCHEMA + 1,
    };
    expect(readLiveHistory(newer)).toBeNull();
  });

  it('refuses a chain whose snapshots cannot be decoded', () => {
    const broken = {
      ...buildLiveHistory(stack(), live(), deps, 'now'),
      undo: { format: 1, snapshots: [null] },
    };
    expect(readLiveHistory(broken)).toBeNull();
  });
});

describe('which copy wins', () => {
  it('the account’s only when it is strictly newer, or when the browser has nothing', () => {
    expect(accountHistoryIsNewer('2026-10-05T10:00:01Z', '2026-10-05T10:00:00Z')).toBe(true);
    expect(accountHistoryIsNewer('2026-10-05T10:00:00Z', '2026-10-05T10:00:00Z')).toBe(false);
    expect(accountHistoryIsNewer('2026-10-05T09:59:59Z', '2026-10-05T10:00:00Z')).toBe(false);
    expect(accountHistoryIsNewer('2026-10-05T10:00:00Z', null)).toBe(true);
    expect(accountHistoryIsNewer('2026-10-05T10:00:00Z', undefined)).toBe(true);
  });
});
