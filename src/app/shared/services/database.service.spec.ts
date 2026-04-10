/**
 * Tests for DatabaseService — covers selfhosted-mode batch-read, updatedAt,
 * ETag cache clearing on writes, caching, and Firebase fallback.
 */

// We need to control the environment mode per-describe, so we mock the module.
let mockMode: 'firebase' | 'selfhosted' = 'selfhosted';
jest.mock('../../../environments/environment', () => ({
  get environment() {
    return {
      production: false,
      mode: mockMode,
      firebase: { apiKey: 'k', authDomain: 'd', databaseURL: 'u', projectId: 'p', storageBucket: 's', messagingSenderId: 'm', appId: 'a' },
      selfhosted: { apiUrl: 'http://localhost:3000/api' }
    };
  }
}));

import { of, throwError } from 'rxjs';
import { DatabaseService } from './database.service';

// ── Mock factories ──────────────────────────────────────────────────────────

function makeMockSelfhosted() {
  return {
    readBatch: jest.fn(),
    getUpdatedAt: jest.fn(),
    getData: jest.fn(),
    writeObject: jest.fn().mockReturnValue(of({ success: true })),
    writeBatch: jest.fn().mockReturnValue(of({ success: true })),
    clearEtagCache: jest.fn()
  };
}

function makeMockDb() {
  const refOnce = jest.fn().mockResolvedValue({ val: () => null, exists: () => false });
  return {
    database: {
      goOnline: jest.fn(),
      ref: jest.fn().mockReturnValue({ once: refOnce, set: jest.fn() })
    },
    object: jest.fn().mockReturnValue({ set: jest.fn().mockResolvedValue(undefined) })
  };
}

function makeMockCryptic() {
  return {
    encrypt: jest.fn((v: string) => `enc(${v})`),
    decrypt: jest.fn((v: string) => v)
  };
}

function makeMockLocal() {
  return { getData: jest.fn().mockReturnValue('uid_123'), saveData: jest.fn(), removeData: jest.fn() };
}

function makeMockDirtyTracker() {
  return {
    markClean: jest.fn(),
    markDirty: jest.fn(),
    takeSnapshot: jest.fn(),
    hasChanged: jest.fn().mockReturnValue(true),
    isDirty: jest.fn().mockReturnValue(false),
    getDirtyTags: jest.fn().mockReturnValue([])
  };
}

function makeMockCache() {
  return {
    get: jest.fn().mockReturnValue(null),
    set: jest.fn(),
    invalidate: jest.fn(),
    clearAll: jest.fn()
  };
}

function createService(overrides: Record<string, any> = {}): DatabaseService {
  const deps = {
    db: makeMockDb(),
    localStorage: makeMockLocal(),
    cryptic: makeMockCryptic(),
    selfhosted: makeMockSelfhosted(),
    dirtyTracker: makeMockDirtyTracker(),
    cacheService: makeMockCache(),
    ...overrides
  };
  return new (DatabaseService as any)(
    deps.db, deps.localStorage, deps.cryptic,
    deps.selfhosted, deps.dirtyTracker, deps.cacheService
  );
}

// ── Selfhosted mode ─────────────────────────────────────────────────────────

describe('DatabaseService (selfhosted mode)', () => {
  let service: DatabaseService;
  let selfhosted: ReturnType<typeof makeMockSelfhosted>;
  let cacheService: ReturnType<typeof makeMockCache>;
  let dirtyTracker: ReturnType<typeof makeMockDirtyTracker>;

  beforeEach(() => {
    mockMode = 'selfhosted';
    selfhosted = makeMockSelfhosted();
    cacheService = makeMockCache();
    dirtyTracker = makeMockDirtyTracker();
    service = createService({ selfhosted, cacheService, dirtyTracker });
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('isSelfhosted() returns true', () => {
    expect(service.isSelfhosted()).toBe(true);
  });

  it('getMode() returns selfhosted', () => {
    expect(service.getMode()).toBe('selfhosted');
  });

  // ── getBatchData ────────────────────────────────────────────────────────

  describe('getBatchData()', () => {
    it('calls selfhosted.readBatch with the given paths', async () => {
      const payload = { data: { transactions: [1, 2] }, updatedAt: '2026-01-01T00:00:00Z' };
      selfhosted.readBatch.mockReturnValue(of(payload));

      const result = await service.getBatchData(['transactions']);
      expect(selfhosted.readBatch).toHaveBeenCalledWith(['transactions']);
      expect(result).toEqual(payload);
    });

    it('returns null when selfhosted returns null (304 Not Modified)', async () => {
      selfhosted.readBatch.mockReturnValue(of(null));

      const result = await service.getBatchData(['transactions', 'budget']);
      expect(result).toBeNull();
    });

    it('passes multiple paths through to readBatch', async () => {
      const paths = ['transactions', 'subscriptions', 'income/revenue/revenues'];
      selfhosted.readBatch.mockReturnValue(of({ data: {}, updatedAt: null }));

      await service.getBatchData(paths);
      expect(selfhosted.readBatch).toHaveBeenCalledWith(paths);
    });

    it('rejects on readBatch error', async () => {
      selfhosted.readBatch.mockReturnValue(throwError(() => new Error('network')));

      await expect(service.getBatchData(['transactions'])).rejects.toThrow('network');
    });
  });

  // ── getUpdatedAt ────────────────────────────────────────────────────────

  describe('getUpdatedAt()', () => {
    it('returns the updatedAt timestamp', async () => {
      selfhosted.getUpdatedAt.mockReturnValue(of({ updatedAt: '2026-03-29T10:00:00.000Z' }));

      const result = await service.getUpdatedAt();
      expect(result).toBe('2026-03-29T10:00:00.000Z');
    });

    it('returns null when selfhosted returns null (304)', async () => {
      selfhosted.getUpdatedAt.mockReturnValue(of(null));

      const result = await service.getUpdatedAt();
      expect(result).toBeNull();
    });

    it('returns null when updatedAt field is missing', async () => {
      selfhosted.getUpdatedAt.mockReturnValue(of({ updatedAt: null }));

      const result = await service.getUpdatedAt();
      expect(result).toBeNull();
    });

    it('returns null on error', async () => {
      selfhosted.getUpdatedAt.mockReturnValue(throwError(() => new Error('fail')));

      const result = await service.getUpdatedAt();
      expect(result).toBeNull();
    });
  });

  // ── ETag cache clearing ─────────────────────────────────────────────────

  describe('ETag cache clearing on writes', () => {
    it('clears ETag cache after writeObject succeeds', () => {
      selfhosted.writeObject.mockReturnValue(of({ success: true }));
      const result = service.writeObject('transactions', [{ a: 1 }]);

      // Subscribe to trigger the side effects
      (result as any).subscribe();
      expect(selfhosted.clearEtagCache).toHaveBeenCalled();
    });

    it('clears ETag cache after batchWrite succeeds', () => {
      dirtyTracker.hasChanged.mockReturnValue(true);
      selfhosted.writeBatch.mockReturnValue(of({ success: true }));

      const obs = service.batchWrite([
        { tag: 'transactions', data: [] },
        { tag: 'budget', data: [] }
      ]);
      obs.subscribe();
      expect(selfhosted.clearEtagCache).toHaveBeenCalled();
    });

    it('does NOT clear ETag cache when batchWrite is skipped (no dirty)', () => {
      dirtyTracker.hasChanged.mockReturnValue(false);

      const obs = service.batchWrite([{ tag: 'transactions', data: [] }]);
      obs.subscribe();
      expect(selfhosted.clearEtagCache).not.toHaveBeenCalled();
    });
  });

  // ── clearReadCache ──────────────────────────────────────────────────────

  describe('clearReadCache()', () => {
    it('clears the CacheService', () => {
      service.clearReadCache();
      expect(cacheService.clearAll).toHaveBeenCalled();
    });
  });

  // ── getData (selfhosted, with caching) ──────────────────────────────────

  describe('getData()', () => {
    it('returns cached data when cache hit', async () => {
      cacheService.get.mockReturnValue([{ amount: 100 }]);

      const snapshot = await service.getData('transactions');
      expect(snapshot.val()).toEqual([{ amount: 100 }]);
      expect(snapshot.exists()).toBe(true);
      expect(selfhosted.getData).not.toHaveBeenCalled();
    });

    it('fetches from selfhosted on cache miss and caches the result', async () => {
      cacheService.get.mockReturnValue(null);
      selfhosted.getData.mockReturnValue(of([{ amount: 200 }]));

      const snapshot = await service.getData('transactions');
      expect(snapshot.val()).toEqual([{ amount: 200 }]);
      expect(cacheService.set).toHaveBeenCalledWith('transactions', [{ amount: 200 }], 300000);
    });

    it('returns exists=false when selfhosted returns null', async () => {
      cacheService.get.mockReturnValue(null);
      selfhosted.getData.mockReturnValue(of(null));

      const snapshot = await service.getData('transactions');
      expect(snapshot.val()).toBeNull();
      expect(snapshot.exists()).toBe(false);
    });
  });

  // ── writeObjectIfDirty ──────────────────────────────────────────────────

  describe('writeObjectIfDirty()', () => {
    it('writes when dirtyTracker reports change', () => {
      dirtyTracker.hasChanged.mockReturnValue(true);
      selfhosted.writeObject.mockReturnValue(of({ success: true }));

      const result = service.writeObjectIfDirty('budget', []);
      expect(result).toBeDefined();
    });

    it('skips write when dirtyTracker reports no change', () => {
      dirtyTracker.hasChanged.mockReturnValue(false);

      const result = service.writeObjectIfDirty('budget', []);
      (result as any).subscribe((val: any) => {
        expect(val.skipped).toBe(true);
      });
      expect(selfhosted.writeObject).not.toHaveBeenCalled();
    });
  });
});

// ── Firebase mode ───────────────────────────────────────────────────────────

describe('DatabaseService (firebase mode)', () => {
  let service: DatabaseService;
  let db: ReturnType<typeof makeMockDb>;

  beforeEach(() => {
    mockMode = 'firebase';
    db = makeMockDb();
    service = createService({ db });
  });

  it('isSelfhosted() returns false', () => {
    expect(service.isSelfhosted()).toBe(false);
  });

  it('getMode() returns firebase', () => {
    expect(service.getMode()).toBe('firebase');
  });

  describe('getBatchData()', () => {
    it('falls back to individual getData calls', async () => {
      const refOnce = jest.fn()
        .mockResolvedValueOnce({ val: () => [{ a: 1 }] })
        .mockResolvedValueOnce({ val: () => [{ b: 2 }] });
      db.database.ref.mockReturnValue({ once: refOnce, set: jest.fn() });

      const result = await service.getBatchData(['transactions', 'budget']);
      expect(result).not.toBeNull();
      expect(result!.data['transactions']).toEqual([{ a: 1 }]);
      expect(result!.data['budget']).toEqual([{ b: 2 }]);
      expect(result!.updatedAt).toBeNull();
    });

    it('returns null for paths that fail', async () => {
      const refOnce = jest.fn().mockRejectedValue(new Error('not found'));
      db.database.ref.mockReturnValue({ once: refOnce, set: jest.fn() });

      const result = await service.getBatchData(['missing']);
      expect(result!.data['missing']).toBeNull();
    });
  });

  describe('getUpdatedAt()', () => {
    it('returns null (firebase has no updatedAt concept)', async () => {
      const result = await service.getUpdatedAt();
      expect(result).toBeNull();
    });
  });

  describe('writeObject()', () => {
    it('calls Firebase set with encrypted data', (done) => {
      const result = service.writeObject('transactions', [{ amount: 50 }]);
      expect(db.database.goOnline).toHaveBeenCalled();
      
      // Subscribe to the Observable to complete the test
      result.subscribe({
        next: () => {
          expect(db.object).toHaveBeenCalledWith('users/uid_123/transactions');
          done();
        },
        error: (err) => done(err)
      });
    });
  });
});
