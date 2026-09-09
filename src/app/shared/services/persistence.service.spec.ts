/**
 * Tests for PersistenceService — the unified write path used across the
 * app (writeAndSync for single writes, batchWriteAndSync for bulk writes).
 * Covers localStorage-first saves, success/error callbacks, and the
 * write-conflict handling added for docs/adr/0003-api-ui-write-consistency.md.
 */

let mockMode: 'firebase' | 'selfhosted' = 'selfhosted';
jest.mock('../../../environments/environment', () => ({
  get environment() {
    return { production: false, mode: mockMode };
  },
}));

import { of, throwError } from 'rxjs';
import { PersistenceService } from './persistence.service';

function makeMockDatabase() {
  return {
    writeObject: jest.fn(),
    batchWrite: jest.fn(),
  };
}

function makeMockLocalStorage() {
  return { saveData: jest.fn() };
}

function makeMockLogger() {
  return { logActivity: jest.fn() };
}

function createService(overrides: Record<string, any> = {}) {
  const deps = {
    database: makeMockDatabase(),
    localStorage: makeMockLocalStorage(),
    frontendLogger: makeMockLogger(),
    ...overrides,
  };
  const service = new (PersistenceService as any)(
    deps.database,
    deps.localStorage,
    deps.frontendLogger,
  );
  return { service, ...deps };
}

describe('PersistenceService', () => {
  beforeEach(() => {
    mockMode = 'selfhosted';
  });

  describe('writeAndSync()', () => {
    it('saves to localStorage before the database write resolves', () => {
      const database = makeMockDatabase();
      database.writeObject.mockReturnValue(of({ success: true }));
      const localStorage = makeMockLocalStorage();
      const { service } = createService({ database, localStorage });

      const onSuccess = jest.fn();
      service.writeAndSync({
        tag: 'transactions',
        data: [{ amount: 5 }],
        localStorageKey: 'transactions',
        logEvent: 'transactions_saved',
        logMetadata: {},
        onSuccess,
        onError: jest.fn(),
      });

      expect(localStorage.saveData).toHaveBeenCalledWith(
        'transactions',
        JSON.stringify([{ amount: 5 }]),
      );
      expect(onSuccess).toHaveBeenCalled();
    });

    it('calls onError when the database write fails', () => {
      const database = makeMockDatabase();
      database.writeObject.mockReturnValue(throwError(() => new Error('boom')));
      const { service } = createService({ database });

      const onError = jest.fn();
      service.writeAndSync({
        tag: 'transactions',
        data: [],
        localStorageKey: 'transactions',
        logEvent: 'x',
        logMetadata: {},
        onSuccess: jest.fn(),
        onError,
      });

      expect(onError).toHaveBeenCalled();
    });
  });

  describe('batchWriteAndSync() — selfhosted mode', () => {
    it('saves all localStorage entries and calls onSuccess on a normal write', () => {
      const database = makeMockDatabase();
      database.batchWrite.mockReturnValue(of({ success: true, conflict: false }));
      const localStorage = makeMockLocalStorage();
      const { service } = createService({ database, localStorage });

      const onSuccess = jest.fn();
      const onConflict = jest.fn();
      service.batchWriteAndSync({
        writes: [{ tag: 'transactions', data: [] }],
        localStorageSaves: [{ key: 'transactions', data: '[]' }],
        onSuccess,
        onConflict,
      });

      expect(localStorage.saveData).toHaveBeenCalledWith('transactions', '[]');
      expect(onSuccess).toHaveBeenCalled();
      expect(onConflict).not.toHaveBeenCalled();
    });

    it('calls onConflict instead of onSuccess when the write reports a conflict', () => {
      const database = makeMockDatabase();
      database.batchWrite.mockReturnValue(
        of({ success: false, skipped: true, conflict: true, totalWrites: 0 }),
      );
      const { service } = createService({ database });

      const onSuccess = jest.fn();
      const onConflict = jest.fn();
      const onError = jest.fn();
      service.batchWriteAndSync({
        writes: [{ tag: 'transactions', data: [] }],
        localStorageSaves: [],
        onSuccess,
        onConflict,
        onError,
      });

      expect(onConflict).toHaveBeenCalled();
      expect(onSuccess).not.toHaveBeenCalled();
      expect(onError).not.toHaveBeenCalled();
    });

    it('falls back to onError on conflict when onConflict is not provided (backward compatible)', () => {
      const database = makeMockDatabase();
      database.batchWrite.mockReturnValue(of({ success: false, conflict: true }));
      const { service } = createService({ database });

      const onError = jest.fn();
      service.batchWriteAndSync({
        writes: [{ tag: 'transactions', data: [] }],
        localStorageSaves: [],
        onError,
      });

      expect(onError).toHaveBeenCalled();
    });

    it('does not throw when no callbacks are provided at all (existing call sites like updateDatabase())', () => {
      const database = makeMockDatabase();
      database.batchWrite.mockReturnValue(of({ success: true }));
      const { service } = createService({ database });

      expect(() =>
        service.batchWriteAndSync({
          writes: [{ tag: 'transactions', data: [] }],
          localStorageSaves: [],
        }),
      ).not.toThrow();
    });

    it('calls onError on a genuine database error', () => {
      const database = makeMockDatabase();
      database.batchWrite.mockReturnValue(throwError(() => new Error('db down')));
      const { service } = createService({ database });

      const onError = jest.fn();
      service.batchWriteAndSync({
        writes: [{ tag: 'transactions', data: [] }],
        localStorageSaves: [],
        onError,
      });

      expect(onError).toHaveBeenCalled();
    });
  });

  describe('batchWriteAndSync() — firebase mode', () => {
    it('writes each entry individually via writeObject and calls onSuccess', () => {
      mockMode = 'firebase';
      const database = makeMockDatabase();
      const { service } = createService({ database });

      const onSuccess = jest.fn();
      service.batchWriteAndSync({
        writes: [
          { tag: 'transactions', data: [] },
          { tag: 'budget', data: [] },
        ],
        localStorageSaves: [],
        onSuccess,
      });

      expect(database.writeObject).toHaveBeenCalledTimes(2);
      expect(onSuccess).toHaveBeenCalled();
    });
  });
});
