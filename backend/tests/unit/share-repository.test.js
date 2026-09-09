'use strict';

const { EncryptionSession } = require('@money/domain');
const {
  listShares,
  getShare,
  createShare,
  updateShare,
  deleteShare,
} = require('../../repositories/share-repository');

function dependencies(data, encryptionConfig) {
  return {
    usersDb: { get: jest.fn(async () => ({ data })) },
    authDb: { get: jest.fn(async () => ({ encryptionConfig })) },
  };
}

describe('listShares', () => {
  it('decrypts and normalizes stored shares', async () => {
    const deps = dependencies({
      balance: { asset: { shares: [{ id: 'shares_1', tag: 'MSFT', quantity: 10, price: 415 }] } },
    });
    const shares = await listShares(deps, 'user_1');
    expect(shares).toEqual([{ id: 'shares_1', tag: 'MSFT', quantity: 10, priceMinor: 41500 }]);
  });

  it('throws a clear error for a share missing a stable id', async () => {
    const deps = dependencies({
      balance: { asset: { shares: [{ tag: 'MSFT', quantity: 10, price: 415 }] } },
    });
    await expect(listShares(deps, 'user_1')).rejects.toThrow('migrate-balance-entity-ids');
  });

  it('decrypts every field when database encryption is enabled', async () => {
    const session = new EncryptionSession('secret');
    const encryptField = (value) => session.encrypt(String(value));
    const deps = dependencies(
      {
        balance: {
          asset: {
            shares: [
              {
                id: encryptField('shares_1'),
                tag: encryptField('MSFT'),
                quantity: encryptField('10'),
                price: encryptField('415'),
              },
            ],
          },
        },
      },
      { key: 'secret', encryptDatabase: true },
    );
    const [share] = await listShares(deps, 'user_1');
    expect(share.tag).toBe('MSFT');
    expect(share.quantity).toBe(10);
    expect(share.priceMinor).toBe(41500);
  });

  it('leaves already-minor-unit values (schema version 2) unconverted', async () => {
    const deps = dependencies({
      meta: { schemaVersion: 2 },
      balance: { asset: { shares: [{ id: 'shares_1', tag: 'MSFT', quantity: 10, price: 41500 }] } },
    });
    const [share] = await listShares(deps, 'user_1');
    expect(share.priceMinor).toBe(41500);
  });

  it('returns an empty list for a user with no data document', async () => {
    const error = new Error('not_found');
    error.statusCode = 404;
    const deps = {
      usersDb: { get: jest.fn(async () => Promise.reject(error)) },
      authDb: { get: jest.fn(async () => Promise.reject(error)) },
    };
    await expect(listShares(deps, 'user_1')).resolves.toEqual([]);
  });
});

describe('getShare', () => {
  it('finds a share by id among several', async () => {
    const deps = dependencies({
      balance: {
        asset: {
          shares: [
            { id: 'shares_1', tag: 'MSFT', quantity: 10, price: 415 },
            { id: 'shares_2', tag: 'AAPL', quantity: 5, price: 190 },
          ],
        },
      },
    });
    const share = await getShare(deps, 'user_1', 'shares_2');
    expect(share.tag).toBe('AAPL');
  });

  it('returns null for an id that does not exist', async () => {
    const deps = dependencies({
      balance: { asset: { shares: [{ id: 'shares_1', tag: 'MSFT', quantity: 10, price: 415 }] } },
    });
    await expect(getShare(deps, 'user_1', 'shares_missing')).resolves.toBeNull();
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

describe('createShare', () => {
  it('creates a new share with a stable id', async () => {
    const { deps, current } = writableDeps({ _id: 'user_1', _rev: '1-a', data: {} });
    const share = await createShare(deps, 'user_1', {
      tag: 'MSFT',
      quantity: 10,
      priceMinor: 41500,
    });
    expect(share.id).toMatch(/^shares_/);
    expect(share.quantity).toBe(10);
    expect(share.priceMinor).toBe(41500);
    expect(current().data.balance.asset.shares).toHaveLength(1);
  });

  it('defaults quantity/priceMinor to 0 when omitted', async () => {
    const { deps } = writableDeps({ _id: 'user_1', _rev: '1-a', data: {} });
    const share = await createShare(deps, 'user_1', { tag: 'MSFT' });
    expect(share.quantity).toBe(0);
    expect(share.priceMinor).toBe(0);
  });

  it('strips every space from the tag, correcting the original single-space-only bug', async () => {
    const { deps } = writableDeps({ _id: 'user_1', _rev: '1-a', data: {} });
    const share = await createShare(deps, 'user_1', { tag: '  Rental Property Fund  ' });
    expect(share.tag).toBe('RentalPropertyFund');
  });

  it('rejects a tag that collides with an existing share', async () => {
    const document = {
      _id: 'user_1',
      _rev: '1-a',
      data: {
        balance: { asset: { shares: [{ id: 'shares_1', tag: 'MSFT', quantity: 10, price: 415 }] } },
      },
    };
    const { deps } = writableDeps(document);
    await expect(createShare(deps, 'user_1', { tag: 'MSFT' })).rejects.toMatchObject({
      code: 'SHARE_DUPLICATE_TAG',
    });
  });

  it('rejects a tag that collides with an existing asset', async () => {
    const document = {
      _id: 'user_1',
      _rev: '1-a',
      data: { balance: { asset: { assets: [{ id: 'assets_1', tag: 'Car', amount: 8000 }] } } },
    };
    const { deps } = writableDeps(document);
    await expect(createShare(deps, 'user_1', { tag: 'Car' })).rejects.toMatchObject({
      code: 'SHARE_DUPLICATE_TAG',
    });
  });

  it('rejects a tag that collides with an existing investment', async () => {
    const document = {
      _id: 'user_1',
      _rev: '1-a',
      data: { balance: { asset: { investments: [{ tag: 'RentalUnitA', amount: 180000 }] } } },
    };
    const { deps } = writableDeps(document);
    await expect(createShare(deps, 'user_1', { tag: 'RentalUnitA' })).rejects.toMatchObject({
      code: 'SHARE_DUPLICATE_TAG',
    });
  });
});

describe('updateShare', () => {
  function existingShareDocument() {
    return {
      _id: 'user_1',
      _rev: '1-a',
      data: {
        balance: { asset: { shares: [{ id: 'shares_1', tag: 'MSFT', quantity: 10, price: 415 }] } },
      },
    };
  }

  it('updates only the fields provided', async () => {
    const { deps } = writableDeps(existingShareDocument());
    const share = await updateShare(deps, 'user_1', 'shares_1', { quantity: 20 });
    expect(share.tag).toBe('MSFT');
    expect(share.quantity).toBe(20);
    expect(share.priceMinor).toBe(41500);
  });

  it('returns null for an id that does not exist', async () => {
    const { deps } = writableDeps(existingShareDocument());
    await expect(
      updateShare(deps, 'user_1', 'shares_missing', { quantity: 1 }),
    ).resolves.toBeNull();
  });

  it('does not reject renaming a share to its own current tag', async () => {
    const { deps } = writableDeps(existingShareDocument());
    const share = await updateShare(deps, 'user_1', 'shares_1', { tag: 'MSFT' });
    expect(share.tag).toBe('MSFT');
  });

  it('strips every space from a renamed tag', async () => {
    const { deps } = writableDeps(existingShareDocument());
    const share = await updateShare(deps, 'user_1', 'shares_1', { tag: '  New Ticker Name  ' });
    expect(share.tag).toBe('NewTickerName');
  });

  it('rejects a rename that collides with another share', async () => {
    const document = existingShareDocument();
    document.data.balance.asset.shares.push({
      id: 'shares_2',
      tag: 'AAPL',
      quantity: 5,
      price: 190,
    });
    const { deps } = writableDeps(document);
    await expect(updateShare(deps, 'user_1', 'shares_1', { tag: 'AAPL' })).rejects.toMatchObject({
      code: 'SHARE_DUPLICATE_TAG',
    });
  });

  it('cascades a tag rename into matching income.revenue.interests entries', async () => {
    const document = existingShareDocument();
    document.data.income = {
      revenue: {
        interests: [
          { tag: 'MSFT', amount: 800 },
          { tag: 'Unrelated Interest', amount: 500 },
        ],
      },
    };
    const { deps, current } = writableDeps(document);
    await updateShare(deps, 'user_1', 'shares_1', { tag: 'MSFT2' });
    const interests = current().data.income.revenue.interests;
    expect(interests[0].tag).toBe('MSFT2');
    expect(interests[1].tag).toBe('Unrelated Interest');
  });

  it('does not touch income.revenue.interests when the tag is unchanged', async () => {
    const document = existingShareDocument();
    document.data.income = { revenue: { interests: [{ tag: 'MSFT', amount: 800 }] } };
    const { deps, current } = writableDeps(document);
    await updateShare(deps, 'user_1', 'shares_1', { quantity: 15 });
    expect(current().data.income.revenue.interests[0].tag).toBe('MSFT');
  });

  it('syncs quantity/price into a Grow project whose title matches the (possibly new) tag', async () => {
    const document = existingShareDocument();
    document.data.grow = [
      { title: 'MSFT', isAsset: true, share: { tag: 'MSFT', quantity: 10, price: 415 } },
      { title: 'Unrelated Grow', isAsset: false, share: {} },
    ];
    const { deps, current } = writableDeps(document);
    await updateShare(deps, 'user_1', 'shares_1', { quantity: 25, priceMinor: 50000 });
    const grow = current().data.grow;
    expect(grow[0].share.quantity).toBe(25);
    expect(grow[0].share.price).toBe(500); // toStoredMoney at schemaVersion 1 -> decimal
    expect(grow[0].share.tag).toBe('MSFT'); // the embedded copy's own tag is never touched
    expect(grow[1].share).toEqual({});
  });

  it('syncs into the Grow project matching the NEW tag after a rename, not the old one', async () => {
    const document = existingShareDocument();
    document.data.grow = [
      { title: 'MSFT2', isAsset: true, share: { tag: 'MSFT2', quantity: 1, price: 1 } },
    ];
    const { deps, current } = writableDeps(document);
    await updateShare(deps, 'user_1', 'shares_1', { tag: 'MSFT2', quantity: 30 });
    expect(current().data.grow[0].share.quantity).toBe(30);
  });

  it('does not touch data.grow when no Grow project title matches', async () => {
    const document = existingShareDocument();
    document.data.grow = [
      { title: 'Something Else', isAsset: true, share: { quantity: 1, price: 1 } },
    ];
    const { deps, current } = writableDeps(document);
    await updateShare(deps, 'user_1', 'shares_1', { quantity: 99 });
    expect(current().data.grow[0].share.quantity).toBe(1);
  });
});

describe('deleteShare', () => {
  it('removes the share and returns its id', async () => {
    const document = {
      _id: 'user_1',
      _rev: '1-a',
      data: {
        balance: { asset: { shares: [{ id: 'shares_1', tag: 'MSFT', quantity: 10, price: 415 }] } },
      },
    };
    const { deps, current } = writableDeps(document);
    const result = await deleteShare(deps, 'user_1', 'shares_1');
    expect(result).toEqual({ id: 'shares_1' });
    expect(current().data.balance.asset.shares).toEqual([]);
  });

  it('returns null for an id that does not exist', async () => {
    const document = {
      _id: 'user_1',
      _rev: '1-a',
      data: {
        balance: { asset: { shares: [{ id: 'shares_1', tag: 'MSFT', quantity: 10, price: 415 }] } },
      },
    };
    const { deps } = writableDeps(document);
    const result = await deleteShare(deps, 'user_1', 'shares_missing');
    expect(result).toBeNull();
  });

  it('leaves other shares untouched', async () => {
    const document = {
      _id: 'user_1',
      _rev: '1-a',
      data: {
        balance: {
          asset: {
            shares: [
              { id: 'shares_1', tag: 'MSFT', quantity: 10, price: 415 },
              { id: 'shares_2', tag: 'AAPL', quantity: 5, price: 190 },
            ],
          },
        },
      },
    };
    const { deps, current } = writableDeps(document);
    await deleteShare(deps, 'user_1', 'shares_1');
    expect(current().data.balance.asset.shares.map((s) => s.id)).toEqual(['shares_2']);
  });
});
