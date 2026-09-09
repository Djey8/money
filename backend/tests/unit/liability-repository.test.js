'use strict';

const { EncryptionSession } = require('@money/domain');
const {
  listLiabilities,
  getLiability,
  createLiability,
  updateLiability,
  deleteLiability,
} = require('../../repositories/liability-repository');

function dependencies(data, encryptionConfig) {
  return {
    usersDb: { get: jest.fn(async () => ({ data })) },
    authDb: { get: jest.fn(async () => ({ encryptionConfig })) },
  };
}

describe('listLiabilities', () => {
  it('decrypts and normalizes stored liabilities', async () => {
    const deps = dependencies({
      balance: {
        liabilities: [
          { id: 'liabilities_1', tag: 'Mortgage', amount: 150000, investment: true, credit: 50000 },
        ],
      },
    });
    const liabilities = await listLiabilities(deps, 'user_1');
    expect(liabilities).toEqual([
      {
        id: 'liabilities_1',
        tag: 'Mortgage',
        amountMinor: 15000000,
        investment: true,
        creditMinor: 5000000,
      },
    ]);
  });

  it('throws a clear error for a liability missing a stable id', async () => {
    const deps = dependencies({ balance: { liabilities: [{ tag: 'Mortgage', amount: 150000 }] } });
    await expect(listLiabilities(deps, 'user_1')).rejects.toThrow('migrate-balance-entity-ids');
  });

  it('decrypts every field when database encryption is enabled', async () => {
    const session = new EncryptionSession('secret');
    const encryptField = (value) => session.encrypt(String(value));
    const deps = dependencies(
      {
        balance: {
          liabilities: [
            {
              id: encryptField('liabilities_1'),
              tag: encryptField('Mortgage'),
              amount: encryptField('150000'),
              investment: encryptField('true'),
              credit: encryptField('50000'),
            },
          ],
        },
      },
      { key: 'secret', encryptDatabase: true },
    );
    const [liability] = await listLiabilities(deps, 'user_1');
    expect(liability.tag).toBe('Mortgage');
    expect(liability.investment).toBe(true);
    expect(liability.creditMinor).toBe(5000000);
  });

  it('leaves already-minor-unit values (schema version 2) unconverted', async () => {
    const deps = dependencies({
      meta: { schemaVersion: 2 },
      balance: {
        liabilities: [
          {
            id: 'liabilities_1',
            tag: 'Mortgage',
            amount: 15000000,
            investment: false,
            credit: 5000000,
          },
        ],
      },
    });
    const [liability] = await listLiabilities(deps, 'user_1');
    expect(liability.amountMinor).toBe(15000000);
    expect(liability.creditMinor).toBe(5000000);
  });

  it('returns an empty list for a user with no data document', async () => {
    const error = new Error('not_found');
    error.statusCode = 404;
    const deps = {
      usersDb: { get: jest.fn(async () => Promise.reject(error)) },
      authDb: { get: jest.fn(async () => Promise.reject(error)) },
    };
    await expect(listLiabilities(deps, 'user_1')).resolves.toEqual([]);
  });
});

describe('getLiability', () => {
  it('finds a liability by id among several', async () => {
    const deps = dependencies({
      balance: {
        liabilities: [
          { id: 'liabilities_1', tag: 'Mortgage', amount: 150000, investment: true, credit: 50000 },
          { id: 'liabilities_2', tag: 'Car Loan', amount: 20000, investment: false, credit: 5000 },
        ],
      },
    });
    const liability = await getLiability(deps, 'user_1', 'liabilities_2');
    expect(liability.tag).toBe('Car Loan');
  });

  it('returns null for an id that does not exist', async () => {
    const deps = dependencies({
      balance: {
        liabilities: [
          { id: 'liabilities_1', tag: 'Mortgage', amount: 150000, investment: true, credit: 50000 },
        ],
      },
    });
    await expect(getLiability(deps, 'user_1', 'liabilities_missing')).resolves.toBeNull();
  });
});

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

describe('createLiability', () => {
  it('creates a new liability with a stable id', async () => {
    const { deps, current } = writableDeps({ _id: 'user_1', _rev: '1-a', data: {} });
    const liability = await createLiability(deps, 'user_1', {
      tag: 'Mortgage',
      amountMinor: 15000000,
      investment: true,
      creditMinor: 5000000,
    });
    expect(liability.id).toMatch(/^liabilities_/);
    expect(liability.investment).toBe(true);
    expect(liability.creditMinor).toBe(5000000);
    expect(current().data.balance.liabilities).toHaveLength(1);
  });

  it('defaults amountMinor, creditMinor to 0 and investment to false when omitted', async () => {
    const { deps } = writableDeps({ _id: 'user_1', _rev: '1-a', data: {} });
    const liability = await createLiability(deps, 'user_1', { tag: 'Mortgage' });
    expect(liability.amountMinor).toBe(0);
    expect(liability.creditMinor).toBe(0);
    expect(liability.investment).toBe(false);
  });

  it('trims the tag before storing and comparing it', async () => {
    const { deps } = writableDeps({ _id: 'user_1', _rev: '1-a', data: {} });
    const liability = await createLiability(deps, 'user_1', { tag: '  Mortgage  ' });
    expect(liability.tag).toBe('Mortgage');
  });

  it('rejects a tag that collides with an existing liability', async () => {
    const document = {
      _id: 'user_1',
      _rev: '1-a',
      data: {
        balance: { liabilities: [{ id: 'liabilities_1', tag: 'Mortgage', amount: 150000 }] },
      },
    };
    const { deps } = writableDeps(document);
    await expect(createLiability(deps, 'user_1', { tag: 'Mortgage' })).rejects.toMatchObject({
      code: 'LIABILITY_DUPLICATE_TAG',
    });
  });

  it('does not reject a tag that collides with an Asset/Share/Investment tag (separate namespace)', async () => {
    const document = {
      _id: 'user_1',
      _rev: '1-a',
      data: { balance: { asset: { assets: [{ id: 'assets_1', tag: 'Car', amount: 8000 }] } } },
    };
    const { deps } = writableDeps(document);
    const liability = await createLiability(deps, 'user_1', { tag: 'Car' });
    expect(liability.tag).toBe('Car');
  });
});

describe('updateLiability', () => {
  function existingLiabilityDocument() {
    return {
      _id: 'user_1',
      _rev: '1-a',
      data: {
        balance: {
          liabilities: [
            {
              id: 'liabilities_1',
              tag: 'Mortgage',
              amount: 150000,
              investment: true,
              credit: 50000,
            },
          ],
        },
      },
    };
  }

  it('updates only the fields provided', async () => {
    const { deps } = writableDeps(existingLiabilityDocument());
    const liability = await updateLiability(deps, 'user_1', 'liabilities_1', {
      creditMinor: 4000000,
    });
    expect(liability.tag).toBe('Mortgage');
    expect(liability.creditMinor).toBe(4000000);
    expect(liability.investment).toBe(true);
  });

  it('returns null for an id that does not exist', async () => {
    const { deps } = writableDeps(existingLiabilityDocument());
    await expect(
      updateLiability(deps, 'user_1', 'liabilities_missing', { amountMinor: 1 }),
    ).resolves.toBeNull();
  });

  it('does not reject renaming a liability to its own current tag', async () => {
    const { deps } = writableDeps(existingLiabilityDocument());
    const liability = await updateLiability(deps, 'user_1', 'liabilities_1', { tag: 'Mortgage' });
    expect(liability.tag).toBe('Mortgage');
  });

  it('rejects a rename that collides with another liability', async () => {
    const document = existingLiabilityDocument();
    document.data.balance.liabilities.push({ id: 'liabilities_2', tag: 'Car Loan', amount: 20000 });
    const { deps } = writableDeps(document);
    await expect(
      updateLiability(deps, 'user_1', 'liabilities_1', { tag: 'Car Loan' }),
    ).rejects.toMatchObject({ code: 'LIABILITY_DUPLICATE_TAG' });
  });

  it('can toggle the investment flag', async () => {
    const { deps } = writableDeps(existingLiabilityDocument());
    const liability = await updateLiability(deps, 'user_1', 'liabilities_1', { investment: false });
    expect(liability.investment).toBe(false);
  });
});

describe('deleteLiability', () => {
  it('removes the liability and returns its id', async () => {
    const document = {
      _id: 'user_1',
      _rev: '1-a',
      data: {
        balance: { liabilities: [{ id: 'liabilities_1', tag: 'Mortgage', amount: 150000 }] },
      },
    };
    const { deps, current } = writableDeps(document);
    const result = await deleteLiability(deps, 'user_1', 'liabilities_1');
    expect(result).toEqual({ id: 'liabilities_1' });
    expect(current().data.balance.liabilities).toEqual([]);
  });

  it('returns null for an id that does not exist', async () => {
    const document = {
      _id: 'user_1',
      _rev: '1-a',
      data: {
        balance: { liabilities: [{ id: 'liabilities_1', tag: 'Mortgage', amount: 150000 }] },
      },
    };
    const { deps } = writableDeps(document);
    const result = await deleteLiability(deps, 'user_1', 'liabilities_missing');
    expect(result).toBeNull();
  });

  it('leaves other liabilities untouched', async () => {
    const document = {
      _id: 'user_1',
      _rev: '1-a',
      data: {
        balance: {
          liabilities: [
            { id: 'liabilities_1', tag: 'Mortgage', amount: 150000 },
            { id: 'liabilities_2', tag: 'Car Loan', amount: 20000 },
          ],
        },
      },
    };
    const { deps, current } = writableDeps(document);
    await deleteLiability(deps, 'user_1', 'liabilities_1');
    expect(current().data.balance.liabilities.map((l) => l.id)).toEqual(['liabilities_2']);
  });
});
