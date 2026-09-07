'use strict';

const { EncryptionSession } = require('@money/domain');
const {
  listSmileProjects,
  getSmileProject,
  createSmileProject,
} = require('../../repositories/smile-repository');

function dependencies(data, encryptionConfig) {
  return {
    usersDb: { get: jest.fn(async () => ({ data })) },
    authDb: { get: jest.fn(async () => ({ encryptionConfig })) },
  };
}

describe('listSmileProjects', () => {
  it('decrypts and normalizes a stored project, computing bucket totals', async () => {
    const deps = dependencies({
      smile: [
        {
          id: 'smile_1',
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
    const [project] = await listSmileProjects(deps, 'user_1');
    expect(project.id).toBe('smile_1');
    expect(project.buckets[0]).toMatchObject({ id: 'b1', title: 'Flights', targetMinor: 150000, amountMinor: 20000 });
    expect(project.totals).toEqual({
      targetMinor: 150000,
      amountMinor: 20000,
      remainingMinor: 130000,
      percentFilled: (20000 / 150000) * 100,
    });
    expect(project.links).toEqual([{ label: 'Flights site', url: 'https://example.com' }]);
    expect(project.actionItems).toEqual([{ text: 'Book flights', done: false, priority: 'high' }]);
    expect(project.notes).toEqual([{ text: 'Check passports', createdAt: '2026-01-01T00:00:00.000Z' }]);
  });

  it('throws a clear error for a project missing a stable id', async () => {
    const deps = dependencies({ smile: [{ title: 'Legacy', buckets: [] }] });
    await expect(listSmileProjects(deps, 'user_1')).rejects.toThrow('migrate-fund-project-ids');
  });

  it('decrypts every field when database encryption is enabled', async () => {
    const session = new EncryptionSession('secret');
    const encryptField = (value) => session.encrypt(String(value));
    const deps = dependencies(
      {
        smile: [
          {
            id: encryptField('smile_1'),
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
    const [project] = await listSmileProjects(deps, 'user_1');
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
    await expect(listSmileProjects(deps, 'user_1')).resolves.toEqual([]);
  });
});

describe('getSmileProject', () => {
  it('finds a project by id among several', async () => {
    const deps = dependencies({
      smile: [
        { id: 'smile_1', title: 'A', buckets: [] },
        { id: 'smile_2', title: 'B', buckets: [] },
      ],
    });
    const project = await getSmileProject(deps, 'user_1', 'smile_2');
    expect(project.title).toBe('B');
  });

  it('returns null for an id that does not exist', async () => {
    const deps = dependencies({ smile: [{ id: 'smile_1', title: 'A', buckets: [] }] });
    await expect(getSmileProject(deps, 'user_1', 'smile_missing')).resolves.toBeNull();
  });
});

describe('createSmileProject', () => {
  it('throws a clear error rather than creating a project when an existing project lacks a stable id', async () => {
    const document = {
      _id: 'user_1',
      _rev: '1-a',
      data: { smile: [{ title: 'Legacy', buckets: [] }] },
    };
    const deps = {
      usersDb: { get: jest.fn(async () => structuredClone(document)) },
      authDb: { get: jest.fn(async () => ({ encryptionConfig: { key: 'default', encryptDatabase: false } })) },
    };
    await expect(
      createSmileProject(deps, 'user_1', { title: 'Vacation', targetMinor: 100000 }),
    ).rejects.toThrow('migrate-fund-project-ids');
  });

  it('creates a default bucket from targetMinor named after the title', async () => {
    let document = { _id: 'user_1', _rev: '1-a', data: { smile: [] } };
    const deps = {
      usersDb: {
        get: jest.fn(async () => structuredClone(document)),
        insert: jest.fn(async (next) => {
          document = { ...next, _rev: '2-b' };
        }),
      },
      authDb: { get: jest.fn(async () => ({ encryptionConfig: { key: 'default', encryptDatabase: false } })) },
    };
    const project = await createSmileProject(deps, 'user_1', { title: 'Vacation', targetMinor: 150000 });
    expect(project.buckets).toEqual([
      expect.objectContaining({ title: 'Vacation', targetMinor: 150000, amountMinor: 0 }),
    ]);
    expect(project.totals.targetMinor).toBe(150000);
    expect(project.phase).toBe('idea');
    expect(document.data.smile).toHaveLength(1);
  });

  it('merges a default target bucket with explicit custom buckets', async () => {
    let document = { _id: 'user_1', _rev: '1-a', data: { smile: [] } };
    const deps = {
      usersDb: {
        get: jest.fn(async () => structuredClone(document)),
        insert: jest.fn(async (next) => {
          document = { ...next, _rev: '2-b' };
        }),
      },
      authDb: { get: jest.fn(async () => ({ encryptionConfig: { key: 'default', encryptDatabase: false } })) },
    };
    const project = await createSmileProject(deps, 'user_1', {
      title: 'Vacation',
      targetMinor: 100000,
      buckets: [{ title: 'Hotel', targetMinor: 80000 }],
    });
    expect(project.buckets.map((bucket) => bucket.title)).toEqual(['Vacation', 'Hotel']);
    expect(project.totals.targetMinor).toBe(180000);
  });

  it('trims the project title and bucket titles before storing and comparing them', async () => {
    let document = { _id: 'user_1', _rev: '1-a', data: { smile: [] } };
    const deps = {
      usersDb: {
        get: jest.fn(async () => structuredClone(document)),
        insert: jest.fn(async (next) => {
          document = { ...next, _rev: '2-b' };
        }),
      },
      authDb: { get: jest.fn(async () => ({ encryptionConfig: { key: 'default', encryptDatabase: false } })) },
    };
    const project = await createSmileProject(deps, 'user_1', {
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
      data: { smile: [{ id: 'smile_1', title: 'Vacation', buckets: [] }] },
    };
    const deps = {
      usersDb: { get: jest.fn(async () => structuredClone(document)) },
      authDb: { get: jest.fn(async () => ({ encryptionConfig: { key: 'default', encryptDatabase: false } })) },
    };
    await expect(
      createSmileProject(deps, 'user_1', { title: 'Vacation', targetMinor: 100000 }),
    ).rejects.toMatchObject({ code: 'SMILE_DUPLICATE_TITLE' });
  });

  it('stamps completionDate when created directly in the completed phase', async () => {
    let document = { _id: 'user_1', _rev: '1-a', data: { smile: [] } };
    const deps = {
      usersDb: {
        get: jest.fn(async () => structuredClone(document)),
        insert: jest.fn(async (next) => {
          document = { ...next, _rev: '2-b' };
        }),
      },
      authDb: { get: jest.fn(async () => ({ encryptionConfig: { key: 'default', encryptDatabase: false } })) },
    };
    const project = await createSmileProject(deps, 'user_1', {
      title: 'Done Goal',
      targetMinor: 5000,
      phase: 'completed',
    });
    expect(project.completionDate).toBeDefined();
  });

  it('encrypts the stored project when database encryption is enabled', async () => {
    const session = new EncryptionSession('secret');
    let document = { _id: 'user_1', _rev: '1-a', data: { smile: [] } };
    const deps = {
      usersDb: {
        get: jest.fn(async () => structuredClone(document)),
        insert: jest.fn(async (next) => {
          document = { ...next, _rev: '2-b' };
        }),
      },
      authDb: { get: jest.fn(async () => ({ encryptionConfig: { key: 'secret', encryptDatabase: true } })) },
    };
    const project = await createSmileProject(deps, 'user_1', { title: 'Vacation', targetMinor: 150000 });
    expect(project.title).toBe('Vacation');
    expect(typeof document.data.smile[0].title).toBe('string');
    expect(document.data.smile[0].title).toMatch(/^v2:/);
    expect(session.decrypt(document.data.smile[0].title)).toBe('Vacation');
  });

  it('retries on a CouchDB write conflict', async () => {
    let document = { _id: 'user_1', _rev: '1-a', data: { smile: [] } };
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
      authDb: { get: jest.fn(async () => ({ encryptionConfig: { key: 'default', encryptDatabase: false } })) },
    };
    await expect(
      createSmileProject(deps, 'user_1', { title: 'Vacation', targetMinor: 150000 }),
    ).resolves.toMatchObject({ title: 'Vacation' });
    expect(writes).toBe(2);
  });
});
