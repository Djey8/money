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
      firebase: {
        apiKey: 'k',
        authDomain: 'd',
        databaseURL: 'u',
        projectId: 'p',
        storageBucket: 's',
        messagingSenderId: 'm',
        appId: 'a',
      },
      selfhosted: { apiUrl: 'http://localhost:3000/api' },
    };
  },
}));

import { defer, lastValueFrom, of, throwError } from 'rxjs';
import { DatabaseService } from './database.service';
import { AppStateService } from './app-state.service';

// ── Mock factories ──────────────────────────────────────────────────────────

function makeMockSelfhosted() {
  return {
    readBatch: jest.fn(),
    getUpdatedAt: jest.fn(),
    getData: jest.fn(),
    writeObject: jest.fn().mockReturnValue(of({ success: true })),
    writeBatch: jest.fn().mockReturnValue(of({ success: true })),
    clearEtagCache: jest.fn(),
  };
}

function makeMockDb() {
  const refOnce = jest.fn().mockResolvedValue({ val: () => null, exists: () => false });
  return {
    database: {
      goOnline: jest.fn(),
      ref: jest.fn().mockReturnValue({ once: refOnce, set: jest.fn() }),
    },
    object: jest.fn().mockReturnValue({ set: jest.fn().mockResolvedValue(undefined) }),
  };
}

function makeMockCryptic() {
  return {
    encrypt: jest.fn((v: string) => `enc(${v})`),
    decrypt: jest.fn((v: string) => v),
  };
}

function makeMockLocal() {
  return {
    getData: jest.fn().mockReturnValue('uid_123'),
    saveData: jest.fn(),
    removeData: jest.fn(),
  };
}

function makeMockDirtyTracker() {
  return {
    markClean: jest.fn(),
    markDirty: jest.fn(),
    takeSnapshot: jest.fn(),
    hasChanged: jest.fn().mockReturnValue(true),
    isDirty: jest.fn().mockReturnValue(false),
    getDirtyTags: jest.fn().mockReturnValue([]),
    clearAll: jest.fn(),
    clearAllSnapshots: jest.fn(),
  };
}

function makeMockCache() {
  return {
    get: jest.fn().mockReturnValue(null),
    set: jest.fn(),
    invalidate: jest.fn(),
    clearAll: jest.fn(),
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
    ...overrides,
  };
  return new (DatabaseService as any)(
    deps.db,
    deps.localStorage,
    deps.cryptic,
    deps.selfhosted,
    deps.dirtyTracker,
    deps.cacheService,
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
    it('clears ETag cache after writeObject succeeds', async () => {
      selfhosted.writeObject.mockReturnValue(of({ success: true }));
      await lastValueFrom(service.writeObject('transactions', [{ a: 1 }]));
      expect(selfhosted.clearEtagCache).toHaveBeenCalled();
    });

    it('clears ETag cache after batchWrite succeeds', async () => {
      dirtyTracker.hasChanged.mockReturnValue(true);
      selfhosted.writeBatch.mockReturnValue(of({ success: true }));

      await lastValueFrom(
        service.batchWrite([
          { tag: 'transactions', data: [] },
          { tag: 'budget', data: [] },
        ]),
      );
      expect(selfhosted.clearEtagCache).toHaveBeenCalled();
    });

    it('does NOT clear ETag cache when batchWrite is skipped (no dirty)', async () => {
      dirtyTracker.hasChanged.mockReturnValue(false);

      await lastValueFrom(service.batchWrite([{ tag: 'transactions', data: [] }]));
      expect(selfhosted.clearEtagCache).not.toHaveBeenCalled();
    });
  });

  // ── Money minor-units conversion on write (docs/adr/0002) ───────────────

  describe('minor-units conversion on write for schemaVersion-2 accounts', () => {
    afterEach(() => {
      AppStateService.instance.schemaVersion = 1;
    });

    it('scales money fields to minor units before encrypting when schemaVersion is 2', async () => {
      AppStateService.instance.schemaVersion = 2;
      selfhosted.writeObject.mockReturnValue(of({ success: true }));

      await lastValueFrom(
        service.writeObject('transactions', [{ id: 'tx_1', amount: 42.5, category: '@Food' }]),
      );

      expect(selfhosted.writeObject).toHaveBeenCalledWith(
        'transactions',
        [{ id: 'enc(tx_1)', amount: 'enc(4250)', category: 'enc(@Food)' }],
        null,
      );
    });

    it('leaves money fields as decimal when schemaVersion is 1 (default)', async () => {
      selfhosted.writeObject.mockReturnValue(of({ success: true }));

      await lastValueFrom(
        service.writeObject('transactions', [{ id: 'tx_1', amount: 42.5, category: '@Food' }]),
      );

      expect(selfhosted.writeObject).toHaveBeenCalledWith(
        'transactions',
        [{ id: 'enc(tx_1)', amount: 'enc(42.5)', category: 'enc(@Food)' }],
        null,
      );
    });
  });

  // ── Stable transaction ids (see shared/transaction-ids.ts) ──────────────

  describe('stable transaction ids on write', () => {
    it('stamps missing ids onto the in-memory transactions and sends them, encrypted', async () => {
      selfhosted.writeObject.mockReturnValue(of({ success: true }));
      const transactions: any[] = [{ id: 'tx_kept', amount: 1 }, { amount: 2 }];

      await lastValueFrom(service.writeObject('transactions', transactions));

      expect(transactions[0].id).toBe('tx_kept');
      expect(transactions[1].id).toMatch(/^tx_[0-9a-f-]{36}$/);
      const sent = selfhosted.writeObject.mock.calls[0][1];
      expect(sent[0].id).toBe('enc(tx_kept)');
      expect(sent[1].id).toBe(`enc(${transactions[1].id})`);
    });

    it('keeps the same id across later saves of the same transaction', async () => {
      selfhosted.writeObject.mockReturnValue(of({ success: true }));
      const transactions: any[] = [{ amount: 2 }];

      await lastValueFrom(service.writeObject('transactions', transactions));
      const firstId = transactions[0].id;
      await lastValueFrom(service.writeObject('transactions', transactions));

      expect(transactions[0].id).toBe(firstId);
    });

    it('stamps ids on the batch write path too', async () => {
      selfhosted.writeBatch.mockReturnValue(of({ success: true }));
      const transactions: any[] = [{ amount: 2 }];

      await lastValueFrom(
        service.batchWrite([
          { tag: 'transactions', data: transactions },
          { tag: 'budget', data: [{ tag: 'x' }] },
        ]),
      );

      expect(transactions[0].id).toMatch(/^tx_/);
      const batch = selfhosted.writeBatch.mock.calls[0][0];
      expect(batch[0].data[0].id).toBe(`enc(${transactions[0].id})`);
      expect(batch[1].data[0].id).toBeUndefined(); // other collections are untouched
    });

    it('does not touch other tags', async () => {
      selfhosted.writeObject.mockReturnValue(of({ success: true }));
      const smile: any[] = [{ title: 'Trip' }];

      await lastValueFrom(service.writeObject('smile', smile));

      expect(smile[0].id).toBeUndefined();
    });
  });

  // ── Encrypted-row cache: a save only encrypts what changed ──────────────

  describe('encrypted transaction row cache', () => {
    let cryptic: ReturnType<typeof makeMockCryptic> & {
      configEpoch: number;
      encryptionDatabaseEnabled: boolean;
    };
    let cachedService: DatabaseService;
    let rows: any[];

    const save = () => lastValueFrom(cachedService.writeObject('transactions', rows));
    const sentPayload = (call = 0) => selfhosted.writeObject.mock.calls[call][1];

    beforeEach(() => {
      cryptic = { ...makeMockCryptic(), configEpoch: 0, encryptionDatabaseEnabled: true };
      cachedService = createService({ selfhosted, cacheService, dirtyTracker, cryptic });
      selfhosted.writeObject.mockReturnValue(of({ success: true }));
      rows = [
        { id: 'tx_1', account: 'Daily', amount: 1, category: '@A' },
        { id: 'tx_2', account: 'Daily', amount: 2, category: '@B' },
      ];
    });

    it('does not re-encrypt rows that have not changed, and sends the identical payload', async () => {
      await save();
      const encryptCalls = cryptic.encrypt.mock.calls.length;
      expect(encryptCalls).toBe(8); // 2 rows x 4 fields

      await save();

      expect(cryptic.encrypt.mock.calls.length).toBe(encryptCalls);
      expect(sentPayload(1)).toEqual(sentPayload(0));
    });

    it('re-encrypts only the row that changed, and encrypts a new row', async () => {
      await save();
      cryptic.encrypt.mockClear();

      rows[1].amount = 99;
      rows.push({ id: 'tx_3', account: 'Daily', amount: 3, category: '@C' });
      await save();

      expect(cryptic.encrypt.mock.calls.length).toBe(8); // edited row + new row, 4 fields each
      expect(sentPayload(1)[1].amount).toBe('enc(99)');
      expect(sentPayload(1)[2].id).toBe('enc(tx_3)');
      expect(sentPayload(1)[0]).toBe(sentPayload(0)[0]); // untouched row reused as-is
    });

    it('re-encrypts everything after the key or session changed (configEpoch)', async () => {
      await save();
      cryptic.encrypt.mockClear();

      cryptic.configEpoch++;
      await save();

      expect(cryptic.encrypt.mock.calls.length).toBe(8);
    });

    it('re-encrypts everything when database encryption is toggled', async () => {
      await save();
      cryptic.encrypt.mockClear();

      cryptic.encryptionDatabaseEnabled = false;
      await save();

      expect(cryptic.encrypt.mock.calls.length).toBe(8);
    });

    it('re-encrypts everything when the schema version changes', async () => {
      await save();
      cryptic.encrypt.mockClear();

      AppStateService.instance.schemaVersion = 2;
      try {
        await save();
      } finally {
        AppStateService.instance.schemaVersion = 1;
      }

      expect(cryptic.encrypt.mock.calls.length).toBe(8);
      expect(sentPayload(1)[0].amount).toBe('enc(100)'); // stored as minor units now
    });

    it('does not cache anything for other collections', async () => {
      const smile = [{ title: 'Trip', target: 1 }];
      await lastValueFrom(cachedService.writeObject('smile', smile));
      cryptic.encrypt.mockClear();
      await lastValueFrom(cachedService.writeObject('smile', smile));
      expect(cryptic.encrypt.mock.calls.length).toBe(2);
    });
  });

  // ── Stale-write guard (docs/adr/0003) ───────────────────────────────────

  describe('stale-write guard', () => {
    const conflict = { status: 409, error: { conflict: true, updatedAt: 'later' } };

    afterEach(() => {
      AppStateService.instance.lastUpdatedAt = null;
    });

    it('sends no base version when this session has no baseline yet', async () => {
      dirtyTracker.hasChanged.mockReturnValue(true);
      selfhosted.writeBatch.mockReturnValue(of({ success: true }));

      const result = await lastValueFrom(
        service.batchWrite([
          { tag: 'transactions', data: [] },
          { tag: 'budget', data: [] },
        ]),
      );

      expect(selfhosted.writeBatch).toHaveBeenCalledWith(expect.any(Array), null);
      expect(result.success).toBe(true);
    });

    it('sends the baseline as the base version and adopts the version the write produced', async () => {
      AppStateService.instance.lastUpdatedAt = '2026-03-29T10:00:00.000Z';
      dirtyTracker.hasChanged.mockReturnValue(true);
      selfhosted.writeBatch.mockReturnValue(
        of({ success: true, updatedAt: '2026-03-29T10:05:00.000Z' }),
      );

      await lastValueFrom(
        service.batchWrite([
          { tag: 'transactions', data: [] },
          { tag: 'budget', data: [] },
        ]),
      );

      expect(selfhosted.writeBatch).toHaveBeenCalledWith(
        expect.any(Array),
        '2026-03-29T10:00:00.000Z',
      );
      expect(AppStateService.instance.lastUpdatedAt).toBe('2026-03-29T10:05:00.000Z');
    });

    it('reports a refused (stale) batch write as a conflict and notifies staleWrite$', async () => {
      AppStateService.instance.lastUpdatedAt = '2026-03-29T10:00:00.000Z';
      dirtyTracker.hasChanged.mockReturnValue(true);
      selfhosted.writeBatch.mockReturnValue(throwError(() => conflict));
      const stale = jest.fn();
      service.staleWrite$.subscribe(stale);

      const result = await lastValueFrom(
        service.batchWrite([
          { tag: 'transactions', data: [] },
          { tag: 'budget', data: [] },
        ]),
      );

      expect(result).toMatchObject({ success: false, conflict: true });
      expect(stale).toHaveBeenCalledTimes(1);
      expect(selfhosted.clearEtagCache).not.toHaveBeenCalled();
      expect(AppStateService.instance.lastUpdatedAt).toBe('2026-03-29T10:00:00.000Z');
    });

    it('notifies staleWrite$ and errors a refused single write', async () => {
      selfhosted.writeObject.mockReturnValue(throwError(() => conflict));
      const stale = jest.fn();
      service.staleWrite$.subscribe(stale);
      jest.spyOn(console, 'error').mockImplementation(() => undefined);

      await expect(lastValueFrom(service.writeObject('grow', []))).rejects.toBe(conflict);
      expect(stale).toHaveBeenCalledTimes(1);
    });

    it('runs writes one at a time, each based on the version the previous one produced', async () => {
      AppStateService.instance.lastUpdatedAt = 'v1';
      selfhosted.writeObject
        .mockReturnValueOnce(of({ success: true, updatedAt: 'v2' }))
        .mockReturnValueOnce(of({ success: true, updatedAt: 'v3' }));

      const first = service.writeObject('grow', []);
      const second = service.writeObject('smile', []);
      await lastValueFrom(second);
      await lastValueFrom(first);

      expect(selfhosted.writeObject.mock.calls[0][2]).toBe('v1');
      expect(selfhosted.writeObject.mock.calls[1][2]).toBe('v2');
      expect(AppStateService.instance.lastUpdatedAt).toBe('v3');
    });

    it('sends a write exactly once even when both the service and the caller subscribe', async () => {
      let posts = 0;
      selfhosted.writeObject.mockReturnValue(
        defer(() => {
          posts += 1;
          return of({ success: true });
        }),
      );

      const result = service.writeObject('grow', []);
      await lastValueFrom(result);
      await lastValueFrom(result);

      expect(posts).toBe(1);
    });
  });

  // ── clearReadCache ──────────────────────────────────────────────────────

  describe('clearReadCache()', () => {
    it('clears the CacheService', () => {
      service.clearReadCache();
      expect(cacheService.clearAll).toHaveBeenCalled();
    });
  });

  // ── clearAllCaches ──────────────────────────────────────────────────────

  describe('clearAllCaches()', () => {
    it('clears read cache, ETag cache, and dirty tracker on selfhosted', () => {
      service.clearAllCaches();
      expect(cacheService.clearAll).toHaveBeenCalled();
      expect(selfhosted.clearEtagCache).toHaveBeenCalled();
      expect(dirtyTracker.clearAll).toHaveBeenCalled();
      expect(dirtyTracker.clearAllSnapshots).toHaveBeenCalled();
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
      const refOnce = jest
        .fn()
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
    it('does not add ids to transactions (Firebase data is unchanged)', () => {
      const transactions: any[] = [{ amount: 50 }];
      service.writeObject('transactions', transactions);
      expect(transactions[0].id).toBeUndefined();
    });

    it('calls Firebase set with encrypted data', (done) => {
      const result = service.writeObject('transactions', [{ amount: 50 }]);
      expect(db.database.goOnline).toHaveBeenCalled();

      // Subscribe to the Observable to complete the test
      result.subscribe({
        next: () => {
          expect(db.object).toHaveBeenCalledWith('users/uid_123/transactions');
          done();
        },
        error: (err) => done(err),
      });
    });
  });
});
