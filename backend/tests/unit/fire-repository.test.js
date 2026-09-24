'use strict';

const { EncryptionSession } = require('@money/domain');
const {
  listFireProjects,
  getFireProject,
  createFireProject,
  updateFireProject,
  deleteFireProject,
  createFirePaymentPlan,
} = require('../../repositories/fire-repository');

function dependencies(data, encryptionConfig) {
  return {
    usersDb: { get: jest.fn(async () => ({ data })) },
    authDb: { get: jest.fn(async () => ({ encryptionConfig })) },
  };
}

describe('listFireProjects', () => {
  it('decrypts and normalizes a stored project, computing bucket totals', async () => {
    const deps = dependencies({
      fire: [
        {
          id: 'fire_1',
          title: 'Vacation',
          sub: 'Summer trip',
          phase: 'saving',
          description: 'Beach holiday',
          buckets: [{ id: 'b1', title: 'Flights', target: 1500, amount: 200 }],
          links: [{ label: 'Flights site', url: 'https://example.com' }],
          actionItems: [{ text: 'Book flights', done: false, priority: 'high' }],
          notes: [{ text: 'Check passports', createdAt: '2026-01-01T00:00:00.000Z' }],
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
    });
    const [project] = await listFireProjects(deps, 'user_1');
    expect(project.id).toBe('fire_1');
    expect(project.buckets[0]).toMatchObject({
      id: 'b1',
      title: 'Flights',
      targetMinor: 150000,
      amountMinor: 20000,
    });
    expect(project.totals).toEqual({
      targetMinor: 150000,
      amountMinor: 20000,
      remainingMinor: 130000,
      percentFilled: (20000 / 150000) * 100,
    });
    expect(project.links).toEqual([{ label: 'Flights site', url: 'https://example.com' }]);
    expect(project.actionItems).toEqual([{ text: 'Book flights', done: false, priority: 'high' }]);
    expect(project.notes).toEqual([
      { text: 'Check passports', createdAt: '2026-01-01T00:00:00.000Z' },
    ]);
  });

  it('throws a clear error for a project missing a stable id', async () => {
    const deps = dependencies({ fire: [{ title: 'Legacy', buckets: [] }] });
    await expect(listFireProjects(deps, 'user_1')).rejects.toThrow('migrate-fund-project-ids');
  });

  it('decrypts every field when database encryption is enabled', async () => {
    const session = new EncryptionSession('secret');
    const encryptField = (value) => session.encrypt(String(value));
    const deps = dependencies(
      {
        fire: [
          {
            id: encryptField('fire_1'),
            title: encryptField('Vacation'),
            sub: encryptField(''),
            phase: encryptField('idea'),
            description: encryptField(''),
            buckets: [
              {
                id: encryptField('b1'),
                title: encryptField('Flights'),
                target: encryptField('1500'),
                amount: encryptField('200'),
              },
            ],
            links: [],
            actionItems: [],
            notes: [],
            createdAt: encryptField('2026-01-01T00:00:00.000Z'),
            updatedAt: encryptField('2026-01-01T00:00:00.000Z'),
          },
        ],
      },
      { key: 'secret', encryptDatabase: true },
    );
    const [project] = await listFireProjects(deps, 'user_1');
    expect(project.buckets[0].targetMinor).toBe(150000);
    expect(project.buckets[0].amountMinor).toBe(20000);
  });

  it('returns an empty list for a user with no data document', async () => {
    const error = new Error('not_found');
    error.statusCode = 404;
    const deps = {
      usersDb: { get: jest.fn(async () => Promise.reject(error)) },
      authDb: { get: jest.fn(async () => Promise.reject(error)) },
    };
    await expect(listFireProjects(deps, 'user_1')).resolves.toEqual([]);
  });
});

describe('getFireProject', () => {
  it('finds a project by id among several', async () => {
    const deps = dependencies({
      fire: [
        { id: 'fire_1', title: 'A', buckets: [] },
        { id: 'fire_2', title: 'B', buckets: [] },
      ],
    });
    const project = await getFireProject(deps, 'user_1', 'fire_2');
    expect(project.title).toBe('B');
  });

  it('returns null for an id that does not exist', async () => {
    const deps = dependencies({ fire: [{ id: 'fire_1', title: 'A', buckets: [] }] });
    await expect(getFireProject(deps, 'user_1', 'fire_missing')).resolves.toBeNull();
  });
});

describe('createFireProject', () => {
  it('throws a clear error rather than creating a project when an existing project lacks a stable id', async () => {
    const document = {
      _id: 'user_1',
      _rev: '1-a',
      data: { fire: [{ title: 'Legacy', buckets: [] }] },
    };
    const deps = {
      usersDb: { get: jest.fn(async () => structuredClone(document)) },
      authDb: {
        get: jest.fn(async () => ({
          encryptionConfig: { key: 'default', encryptDatabase: false },
        })),
      },
    };
    await expect(
      createFireProject(deps, 'user_1', { title: 'Vacation', targetMinor: 100000 }),
    ).rejects.toThrow('migrate-fund-project-ids');
  });

  it('creates a default bucket from targetMinor named after the title', async () => {
    let document = { _id: 'user_1', _rev: '1-a', data: { fire: [] } };
    const deps = {
      usersDb: {
        get: jest.fn(async () => structuredClone(document)),
        insert: jest.fn(async (next) => {
          document = { ...next, _rev: '2-b' };
        }),
      },
      authDb: {
        get: jest.fn(async () => ({
          encryptionConfig: { key: 'default', encryptDatabase: false },
        })),
      },
    };
    const project = await createFireProject(deps, 'user_1', {
      title: 'Vacation',
      targetMinor: 150000,
    });
    expect(project.buckets).toEqual([
      expect.objectContaining({ title: 'Vacation', targetMinor: 150000, amountMinor: 0 }),
    ]);
    expect(project.totals.targetMinor).toBe(150000);
    expect(project.phase).toBe('idea');
    expect(document.data.fire).toHaveLength(1);
  });

  it('merges a default target bucket with explicit custom buckets', async () => {
    let document = { _id: 'user_1', _rev: '1-a', data: { fire: [] } };
    const deps = {
      usersDb: {
        get: jest.fn(async () => structuredClone(document)),
        insert: jest.fn(async (next) => {
          document = { ...next, _rev: '2-b' };
        }),
      },
      authDb: {
        get: jest.fn(async () => ({
          encryptionConfig: { key: 'default', encryptDatabase: false },
        })),
      },
    };
    const project = await createFireProject(deps, 'user_1', {
      title: 'Vacation',
      targetMinor: 100000,
      buckets: [{ title: 'Hotel', targetMinor: 80000 }],
    });
    expect(project.buckets.map((bucket) => bucket.title)).toEqual(['Vacation', 'Hotel']);
    expect(project.totals.targetMinor).toBe(180000);
  });

  it('trims the project title and bucket titles before storing and comparing them', async () => {
    let document = { _id: 'user_1', _rev: '1-a', data: { fire: [] } };
    const deps = {
      usersDb: {
        get: jest.fn(async () => structuredClone(document)),
        insert: jest.fn(async (next) => {
          document = { ...next, _rev: '2-b' };
        }),
      },
      authDb: {
        get: jest.fn(async () => ({
          encryptionConfig: { key: 'default', encryptDatabase: false },
        })),
      },
    };
    const project = await createFireProject(deps, 'user_1', {
      title: '  Vacation  ',
      buckets: [{ title: '  Hotel  ', targetMinor: 80000 }],
    });
    expect(project.title).toBe('Vacation');
    expect(project.buckets[0].title).toBe('Hotel');
  });

  it('rejects a title that exactly matches an existing project', async () => {
    const document = {
      _id: 'user_1',
      _rev: '1-a',
      data: { fire: [{ id: 'fire_1', title: 'Vacation', buckets: [] }] },
    };
    const deps = {
      usersDb: { get: jest.fn(async () => structuredClone(document)) },
      authDb: {
        get: jest.fn(async () => ({
          encryptionConfig: { key: 'default', encryptDatabase: false },
        })),
      },
    };
    await expect(
      createFireProject(deps, 'user_1', { title: 'Vacation', targetMinor: 100000 }),
    ).rejects.toMatchObject({ code: 'FIRE_DUPLICATE_TITLE' });
  });

  it('stamps completionDate when created directly in the completed phase', async () => {
    let document = { _id: 'user_1', _rev: '1-a', data: { fire: [] } };
    const deps = {
      usersDb: {
        get: jest.fn(async () => structuredClone(document)),
        insert: jest.fn(async (next) => {
          document = { ...next, _rev: '2-b' };
        }),
      },
      authDb: {
        get: jest.fn(async () => ({
          encryptionConfig: { key: 'default', encryptDatabase: false },
        })),
      },
    };
    const project = await createFireProject(deps, 'user_1', {
      title: 'Done Goal',
      targetMinor: 5000,
      phase: 'completed',
    });
    expect(project.completionDate).toBeDefined();
  });

  it('encrypts the stored project when database encryption is enabled', async () => {
    const session = new EncryptionSession('secret');
    let document = { _id: 'user_1', _rev: '1-a', data: { fire: [] } };
    const deps = {
      usersDb: {
        get: jest.fn(async () => structuredClone(document)),
        insert: jest.fn(async (next) => {
          document = { ...next, _rev: '2-b' };
        }),
      },
      authDb: {
        get: jest.fn(async () => ({ encryptionConfig: { key: 'secret', encryptDatabase: true } })),
      },
    };
    const project = await createFireProject(deps, 'user_1', {
      title: 'Vacation',
      targetMinor: 150000,
    });
    expect(project.title).toBe('Vacation');
    expect(typeof document.data.fire[0].title).toBe('string');
    expect(document.data.fire[0].title).toMatch(/^v2:/);
    expect(session.decrypt(document.data.fire[0].title)).toBe('Vacation');
  });

  it('retries on a CouchDB write conflict', async () => {
    let document = { _id: 'user_1', _rev: '1-a', data: { fire: [] } };
    let writes = 0;
    const deps = {
      usersDb: {
        get: jest.fn(async () => structuredClone(document)),
        insert: jest.fn(async (next) => {
          writes += 1;
          if (writes === 1) {
            const error = new Error('conflict');
            error.statusCode = 409;
            throw error;
          }
          document = { ...next, _rev: '2-b' };
        }),
      },
      authDb: {
        get: jest.fn(async () => ({
          encryptionConfig: { key: 'default', encryptDatabase: false },
        })),
      },
    };
    await expect(
      createFireProject(deps, 'user_1', { title: 'Vacation', targetMinor: 150000 }),
    ).resolves.toMatchObject({ title: 'Vacation' });
    expect(writes).toBe(2);
  });
});

function existingProjectDocument() {
  return {
    _id: 'user_1',
    _rev: '1-a',
    data: {
      fire: [
        {
          id: 'fire_1',
          title: 'Vacation',
          sub: '',
          phase: 'saving',
          description: '',
          buckets: [{ id: 'b1', title: 'Flights', target: 1500, amount: 200 }],
          links: [],
          actionItems: [],
          notes: [],
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
    },
  };
}

function writableDeps(initialDocument) {
  let document = initialDocument;
  return {
    deps: {
      usersDb: {
        get: jest.fn(async () => structuredClone(document)),
        insert: jest.fn(async (next) => {
          document = { ...next, _rev: '2-b' };
        }),
      },
      authDb: {
        get: jest.fn(async () => ({
          encryptionConfig: { key: 'default', encryptDatabase: false },
        })),
      },
    },
    current: () => document,
  };
}

describe('updateFireProject', () => {
  it('updates only the fields provided, leaving the rest untouched', async () => {
    const { deps, current } = writableDeps(existingProjectDocument());
    const project = await updateFireProject(deps, 'user_1', 'fire_1', { phase: 'ready' });
    expect(project.phase).toBe('ready');
    expect(project.title).toBe('Vacation');
    expect(project.buckets).toHaveLength(1);
    expect(current().data.fire[0].phase).toBe('ready');
    expect(current().data.fire[0].title).toBe('Vacation');
  });

  it('replaces the entire links array', async () => {
    const document = existingProjectDocument();
    document.data.fire[0].links = [{ label: 'Old link', url: 'https://old.example.com' }];
    const { deps } = writableDeps(document);
    const project = await updateFireProject(deps, 'user_1', 'fire_1', {
      links: [{ label: 'New link', url: 'https://new.example.com' }],
    });
    expect(project.links).toEqual([{ label: 'New link', url: 'https://new.example.com' }]);
  });

  it('returns null for an id that does not exist, without writing anything', async () => {
    const { deps } = writableDeps(existingProjectDocument());
    const result = await updateFireProject(deps, 'user_1', 'fire_missing', { phase: 'ready' });
    expect(result).toBeNull();
    expect(deps.usersDb.insert).not.toHaveBeenCalled();
  });

  it('rejects a new title that collides with another existing project', async () => {
    const document = existingProjectDocument();
    document.data.fire.push({
      id: 'fire_2',
      title: 'New Car',
      sub: '',
      phase: 'idea',
      description: '',
      buckets: [{ id: 'b2', title: 'Car', target: 2000, amount: 0 }],
      links: [],
      actionItems: [],
      notes: [],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
    const { deps } = writableDeps(document);
    await expect(
      updateFireProject(deps, 'user_1', 'fire_1', { title: 'New Car' }),
    ).rejects.toMatchObject({ code: 'FIRE_DUPLICATE_TITLE' });
  });

  it('allows setting the title to its own current value without a duplicate error', async () => {
    const { deps } = writableDeps(existingProjectDocument());
    await expect(
      updateFireProject(deps, 'user_1', 'fire_1', { title: 'Vacation' }),
    ).resolves.toMatchObject({ title: 'Vacation' });
  });

  it('preserves an existing bucket id when the patch echoes it back, and mints a fresh id for a new bucket', async () => {
    const { deps, current } = writableDeps(existingProjectDocument());
    const project = await updateFireProject(deps, 'user_1', 'fire_1', {
      buckets: [
        { id: 'b1', title: 'Flights', targetMinor: 200000, amountMinor: 20000 },
        { title: 'Hotel', targetMinor: 80000 },
      ],
    });
    expect(project.buckets[0]).toMatchObject({ id: 'b1', targetMinor: 200000 });
    expect(project.buckets[1].id).not.toBe('b1');
    expect(project.buckets[1].id).toMatch(/^bucket_/);
    expect(project.totals.targetMinor).toBe(280000);
    expect(current().data.fire[0].buckets).toHaveLength(2);
  });

  it('never produces two buckets sharing one id, even if two patch entries request the same existing id', async () => {
    const { deps } = writableDeps(existingProjectDocument());
    const project = await updateFireProject(deps, 'user_1', 'fire_1', {
      buckets: [
        { id: 'b1', title: 'Flights', targetMinor: 200000, amountMinor: 20000 },
        { id: 'b1', title: 'Other', targetMinor: 50000 },
      ],
    });
    const ids = project.buckets.map((bucket) => bucket.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('stamps a completion date when a patch moves phase to completed without one already set', async () => {
    const { deps } = writableDeps(existingProjectDocument());
    const project = await updateFireProject(deps, 'user_1', 'fire_1', { phase: 'completed' });
    expect(project.completionDate).toEqual(expect.any(String));
    expect(project.completionDate).not.toBe('');
  });

  it('does not override an explicit completionDate sent in the same patch', async () => {
    const { deps } = writableDeps(existingProjectDocument());
    const project = await updateFireProject(deps, 'user_1', 'fire_1', {
      phase: 'completed',
      completionDate: '2026-05-01',
    });
    expect(project.completionDate).toBe('2026-05-01');
  });

  it('does not re-stamp a completion date that was already set before the patch', async () => {
    const document = existingProjectDocument();
    document.data.fire[0].phase = 'ready';
    document.data.fire[0].completionDate = '2026-01-15';
    const { deps } = writableDeps(document);
    const project = await updateFireProject(deps, 'user_1', 'fire_1', { phase: 'completed' });
    expect(project.completionDate).toBe('2026-01-15');
  });

  it('preserves createdAt for a round-tripped note and stamps a fresh one for a new note', async () => {
    const document = existingProjectDocument();
    document.data.fire[0].notes = [{ text: 'Existing', createdAt: '2026-02-01T00:00:00.000Z' }];
    const { deps } = writableDeps(document);
    const project = await updateFireProject(deps, 'user_1', 'fire_1', {
      notes: [{ text: 'Existing', createdAt: '2026-02-01T00:00:00.000Z' }, { text: 'New note' }],
    });
    expect(project.notes[0].createdAt).toBe('2026-02-01T00:00:00.000Z');
    expect(project.notes[1].createdAt).toEqual(expect.any(String));
    expect(project.notes[1].createdAt).not.toBe('');
  });

  it("replaces actionItems wholesale using each item's own done value, not a false default", async () => {
    const document = existingProjectDocument();
    document.data.fire[0].actionItems = [{ text: 'Book flights', done: true, priority: 'high' }];
    const { deps } = writableDeps(document);
    const project = await updateFireProject(deps, 'user_1', 'fire_1', {
      actionItems: [
        { text: 'Book flights', done: true, priority: 'high' },
        { text: 'Pack bags', done: false, priority: 'low' },
      ],
    });
    expect(project.actionItems[0]).toEqual({ text: 'Book flights', done: true, priority: 'high' });
    expect(project.actionItems[1]).toEqual({ text: 'Pack bags', done: false, priority: 'low' });
  });

  it('throws for a legacy project missing a stable id anywhere in the collection', async () => {
    const document = existingProjectDocument();
    document.data.fire.push({ title: 'Legacy', buckets: [] });
    const { deps } = writableDeps(document);
    await expect(updateFireProject(deps, 'user_1', 'fire_1', { phase: 'ready' })).rejects.toThrow(
      'migrate-fund-project-ids',
    );
  });

  it('encrypts the updated project while leaving the untouched raw document field encrypted as before', async () => {
    const session = new EncryptionSession('secret');
    const encryptField = (value) => session.encrypt(String(value));
    const document = {
      _id: 'user_1',
      _rev: '1-a',
      data: {
        fire: [
          {
            id: encryptField('fire_1'),
            title: encryptField('Vacation'),
            sub: encryptField(''),
            phase: encryptField('saving'),
            description: encryptField(''),
            buckets: [
              {
                id: encryptField('b1'),
                title: encryptField('Flights'),
                target: encryptField('1500'),
                amount: encryptField('200'),
              },
            ],
            links: [],
            actionItems: [],
            notes: [],
            createdAt: encryptField('2026-01-01T00:00:00.000Z'),
            updatedAt: encryptField('2026-01-01T00:00:00.000Z'),
          },
        ],
      },
    };
    let stored = document;
    const deps = {
      usersDb: {
        get: jest.fn(async () => structuredClone(stored)),
        insert: jest.fn(async (next) => {
          stored = { ...next, _rev: '2-b' };
        }),
      },
      authDb: {
        get: jest.fn(async () => ({ encryptionConfig: { key: 'secret', encryptDatabase: true } })),
      },
    };
    const project = await updateFireProject(deps, 'user_1', 'fire_1', { phase: 'ready' });
    expect(project.phase).toBe('ready');
    expect(session.decrypt(stored.data.fire[0].phase)).toBe('ready');
    expect(session.decrypt(stored.data.fire[0].title)).toBe('Vacation');
  });

  it('retries on a CouchDB write conflict', async () => {
    let document = existingProjectDocument();
    let writes = 0;
    const deps = {
      usersDb: {
        get: jest.fn(async () => structuredClone(document)),
        insert: jest.fn(async (next) => {
          writes += 1;
          if (writes === 1) {
            const error = new Error('conflict');
            error.statusCode = 409;
            throw error;
          }
          document = { ...next, _rev: '2-b' };
        }),
      },
      authDb: {
        get: jest.fn(async () => ({
          encryptionConfig: { key: 'default', encryptDatabase: false },
        })),
      },
    };
    await expect(
      updateFireProject(deps, 'user_1', 'fire_1', { phase: 'ready' }),
    ).resolves.toMatchObject({ phase: 'ready' });
    expect(writes).toBe(2);
  });

  it('re-validates title uniqueness against freshly-read data on a write-conflict retry', async () => {
    let document = existingProjectDocument();
    let attempts = 0;
    const deps = {
      usersDb: {
        get: jest.fn(async () => {
          attempts += 1;
          if (attempts === 2) {
            // Simulate a concurrent request creating a colliding title
            // between this function's first attempt and its retry.
            document = structuredClone(document);
            document.data.fire.push({
              id: 'fire_2',
              title: 'Renamed',
              sub: '',
              phase: 'idea',
              description: '',
              buckets: [{ id: 'bx', title: 'Goal', target: 100, amount: 0 }],
              links: [],
              actionItems: [],
              notes: [],
              createdAt: '2026-01-01T00:00:00.000Z',
              updatedAt: '2026-01-01T00:00:00.000Z',
            });
          }
          return structuredClone(document);
        }),
        insert: jest.fn(async () => {
          const error = new Error('conflict');
          error.statusCode = 409;
          throw error;
        }),
      },
      authDb: {
        get: jest.fn(async () => ({
          encryptionConfig: { key: 'default', encryptDatabase: false },
        })),
      },
    };
    await expect(
      updateFireProject(deps, 'user_1', 'fire_1', { title: 'Renamed' }),
    ).rejects.toMatchObject({ code: 'FIRE_DUPLICATE_TITLE' });
    expect(attempts).toBeGreaterThanOrEqual(2);
  });
});

describe('renaming a Fire bucket', () => {
  it("rewrites the @<bucket> category too, so the fund's money stays put", async () => {
    const document = existingProjectDocument();
    document.data.meta = { schemaVersion: 2 };
    const bucketId = document.data.fire[0].buckets[0].id;
    const oldTitle = document.data.fire[0].buckets[0].title;
    document.data.fire[0].buckets[0].target = 100000;
    document.data.transactions = [
      {
        id: 'tx_1',
        account: 'Fire',
        amount: -20000,
        date: '2026-09-01',
        time: '10:00',
        category: `@${oldTitle}`,
        comment: '',
      },
    ];
    const { deps, current } = writableDeps(document);

    const result = await updateFireProject(deps, 'user_1', document.data.fire[0].id, {
      buckets: [{ id: bucketId, title: 'Renamed bucket', targetMinor: 100000 }],
    });

    expect(result.buckets[0].amountMinor).toBe(20000);
    expect(current().data.transactions[0].category).toBe('@Renamed bucket');
  });
});

describe('deleteFireProject', () => {
  it('refuses to delete a project that still holds money unless forced', async () => {
    const { deps, current } = writableDeps(existingProjectDocument());
    await expect(deleteFireProject(deps, 'user_1', 'fire_1')).rejects.toMatchObject({
      code: 'FUND_HAS_MONEY',
    });
    expect(current().data.fire).toHaveLength(1);
  });

  it('removes the project and returns its id', async () => {
    const { deps, current } = writableDeps(existingProjectDocument());
    const result = await deleteFireProject(deps, 'user_1', 'fire_1', { force: true });
    expect(result).toMatchObject({ id: 'fire_1', effects: expect.any(Object) });
    expect(current().data.fire).toEqual([]);
  });

  it('returns null for an id that does not exist, without writing anything', async () => {
    const { deps } = writableDeps(existingProjectDocument());
    const result = await deleteFireProject(deps, 'user_1', 'fire_missing');
    expect(result).toBeNull();
    expect(deps.usersDb.insert).not.toHaveBeenCalled();
  });

  it('leaves other projects untouched', async () => {
    const document = existingProjectDocument();
    document.data.fire.push({
      id: 'fire_2',
      title: 'New Car',
      sub: '',
      phase: 'idea',
      description: '',
      buckets: [{ id: 'b2', title: 'Car', target: 2000, amount: 0 }],
      links: [],
      actionItems: [],
      notes: [],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
    const { deps, current } = writableDeps(document);
    await deleteFireProject(deps, 'user_1', 'fire_1', { force: true });
    expect(current().data.fire.map((p) => p.id)).toEqual(['fire_2']);
  });
});

describe('createFirePaymentPlan', () => {
  const planInput = {
    planTitle: 'Flight Fund',
    startDate: '2026-01-01',
    targetDate: '2026-04-01',
    frequency: 'monthly',
    account: 'Daily',
  };

  it('calculates and persists a new planned payment plan onto the project', async () => {
    const { deps, current } = writableDeps(existingProjectDocument());
    const plan = await createFirePaymentPlan(deps, 'user_1', 'fire_1', planInput);
    // Bucket target 1500, amount 200 -> missing 1300 minor units (130000), over 3 monthly periods.
    expect(plan.amountMinor).toBe(Math.round(130000 / 3));
    expect(plan.status).toBe('planned');
    expect(plan.projectType).toBe('fire');
    expect(plan.projectTitle).toBe('Vacation');
    expect(plan.category).toBe('@Vacation');
    expect(plan.id).toMatch(/^plan_/);
    expect(plan.comment).toContain('#bucket:Flights:');
    const stored = current().data.fire[0];
    expect(stored.plannedSubscriptions).toHaveLength(1);
    expect(stored.plannedSubscriptions[0].id).toBe(plan.id);
  });

  it('uses the manual amount when provided', async () => {
    const { deps } = writableDeps(existingProjectDocument());
    const plan = await createFirePaymentPlan(deps, 'user_1', 'fire_1', {
      ...planInput,
      manualAmountMinor: 50000,
    });
    expect(plan.amountMinor).toBe(50000);
    expect(plan.manuallyAdjusted).toBe(true);
  });

  it('returns null for a project that does not exist', async () => {
    const { deps } = writableDeps(existingProjectDocument());
    const plan = await createFirePaymentPlan(deps, 'user_1', 'fire_missing', planInput);
    expect(plan).toBeNull();
  });

  it('rejects a plan whose target date is not after its start date', async () => {
    const { deps } = writableDeps(existingProjectDocument());
    await expect(
      createFirePaymentPlan(deps, 'user_1', 'fire_1', {
        ...planInput,
        startDate: '2026-04-01',
        targetDate: '2026-01-01',
      }),
    ).rejects.toMatchObject({ code: 'PAYMENT_PLAN_INVALID' });
  });

  it('rejects a selectedBucketIds entry that does not match any bucket on the project', async () => {
    const { deps } = writableDeps(existingProjectDocument());
    await expect(
      createFirePaymentPlan(deps, 'user_1', 'fire_1', {
        ...planInput,
        selectedBucketIds: ['not-a-real-bucket'],
      }),
    ).rejects.toMatchObject({ code: 'PAYMENT_PLAN_INVALID' });
  });

  it('appends to existing planned subscriptions rather than replacing them', async () => {
    const document = existingProjectDocument();
    document.data.fire[0].plannedSubscriptions = [
      {
        id: 'plan_existing',
        title: 'Existing Plan',
        status: 'planned',
        projectType: 'fire',
        projectTitle: 'Vacation',
        account: 'Daily',
        amount: 10,
        startDate: '2026-01-01',
        endDate: '2026-02-01',
        category: '@Vacation',
        comment: '',
        frequency: 'monthly',
        targetDate: '2026-02-01',
        targetBucketIds: [],
        originalCalculatedAmount: 10,
        manuallyAdjusted: false,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ];
    const { deps, current } = writableDeps(document);
    await createFirePaymentPlan(deps, 'user_1', 'fire_1', planInput);
    expect(current().data.fire[0].plannedSubscriptions).toHaveLength(2);
    expect(current().data.fire[0].plannedSubscriptions[0].id).toBe('plan_existing');
  });

  it('decrypts and re-encrypts every field when database encryption is enabled', async () => {
    const session = new EncryptionSession('secret');
    const encryptField = (value) => session.encrypt(String(value));
    const document = {
      _id: 'user_1',
      _rev: '1-a',
      data: {
        fire: [
          {
            id: encryptField('fire_1'),
            title: encryptField('Vacation'),
            sub: encryptField(''),
            phase: encryptField('saving'),
            description: encryptField(''),
            buckets: [
              {
                id: encryptField('b1'),
                title: encryptField('Flights'),
                target: encryptField('1500'),
                amount: encryptField('200'),
              },
            ],
            links: [],
            actionItems: [],
            notes: [],
            createdAt: encryptField('2026-01-01T00:00:00.000Z'),
            updatedAt: encryptField('2026-01-01T00:00:00.000Z'),
          },
        ],
      },
    };
    let stored = document;
    const deps = {
      usersDb: {
        get: jest.fn(async () => structuredClone(stored)),
        insert: jest.fn(async (next) => {
          stored = { ...next, _rev: '2-b' };
        }),
      },
      authDb: {
        get: jest.fn(async () => ({ encryptionConfig: { key: 'secret', encryptDatabase: true } })),
      },
    };
    const plan = await createFirePaymentPlan(deps, 'user_1', 'fire_1', planInput);
    expect(plan.amountMinor).toBe(Math.round(130000 / 3));
    expect(stored.data.fire[0].plannedSubscriptions[0].id).not.toBe(plan.id); // stored encrypted
  });
});
