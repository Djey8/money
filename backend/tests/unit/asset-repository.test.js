'use strict';

const { EncryptionSession } = require('@money/domain');
const {
  listAssets,
  getAsset,
  createAsset,
  updateAsset,
  deleteAsset,
} = require('../../repositories/asset-repository');

function dependencies(data, encryptionConfig) {
  return {
    usersDb: { get: jest.fn(async () => ({ data })) },
    authDb: { get: jest.fn(async () => ({ encryptionConfig })) },
  };
}

describe('listAssets', () => {
  it('decrypts and normalizes stored assets', async () => {
    const deps = dependencies({
      balance: { asset: { assets: [{ id: 'assets_1', tag: 'Car', amount: 8000 }] } },
    });
    const assets = await listAssets(deps, 'user_1');
    expect(assets).toEqual([{ id: 'assets_1', tag: 'Car', amountMinor: 800000 }]);
  });

  it('throws a clear error for an asset missing a stable id', async () => {
    const deps = dependencies({ balance: { asset: { assets: [{ tag: 'Car', amount: 8000 }] } } });
    await expect(listAssets(deps, 'user_1')).rejects.toThrow('migrate-balance-entity-ids');
  });

  it('decrypts every field when database encryption is enabled', async () => {
    const session = new EncryptionSession('secret');
    const encryptField = (value) => session.encrypt(String(value));
    const deps = dependencies(
      {
        balance: {
          asset: {
            assets: [
              {
                id: encryptField('assets_1'),
                tag: encryptField('Car'),
                amount: encryptField('8000'),
              },
            ],
          },
        },
      },
      { key: 'secret', encryptDatabase: true },
    );
    const [asset] = await listAssets(deps, 'user_1');
    expect(asset.tag).toBe('Car');
    expect(asset.amountMinor).toBe(800000);
  });

  it('leaves already-minor-unit values (schema version 2) unconverted', async () => {
    const deps = dependencies({
      meta: { schemaVersion: 2 },
      balance: { asset: { assets: [{ id: 'assets_1', tag: 'Car', amount: 800000 }] } },
    });
    const [asset] = await listAssets(deps, 'user_1');
    expect(asset.amountMinor).toBe(800000);
  });

  it('returns an empty list for a user with no data document', async () => {
    const error = new Error('not_found');
    error.statusCode = 404;
    const deps = {
      usersDb: { get: jest.fn(async () => Promise.reject(error)) },
      authDb: { get: jest.fn(async () => Promise.reject(error)) },
    };
    await expect(listAssets(deps, 'user_1')).resolves.toEqual([]);
  });
});

describe('getAsset', () => {
  it('finds an asset by id among several', async () => {
    const deps = dependencies({
      balance: {
        asset: {
          assets: [
            { id: 'assets_1', tag: 'Car', amount: 8000 },
            { id: 'assets_2', tag: 'Boat', amount: 20000 },
          ],
        },
      },
    });
    const asset = await getAsset(deps, 'user_1', 'assets_2');
    expect(asset.tag).toBe('Boat');
  });

  it('returns null for an id that does not exist', async () => {
    const deps = dependencies({
      balance: { asset: { assets: [{ id: 'assets_1', tag: 'Car', amount: 8000 }] } },
    });
    await expect(getAsset(deps, 'user_1', 'assets_missing')).resolves.toBeNull();
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

describe('createAsset', () => {
  it('creates a new asset with a stable id', async () => {
    const { deps, current } = writableDeps({ _id: 'user_1', _rev: '1-a', data: {} });
    const asset = await createAsset(deps, 'user_1', { tag: 'Car', amountMinor: 800000 });
    expect(asset.id).toMatch(/^assets_/);
    expect(asset.tag).toBe('Car');
    expect(asset.amountMinor).toBe(800000);
    expect(current().data.balance.asset.assets).toHaveLength(1);
  });

  it('defaults amountMinor to 0 when omitted', async () => {
    const { deps } = writableDeps({ _id: 'user_1', _rev: '1-a', data: {} });
    const asset = await createAsset(deps, 'user_1', { tag: 'Car' });
    expect(asset.amountMinor).toBe(0);
  });

  it('trims the tag before storing and comparing it', async () => {
    const { deps } = writableDeps({ _id: 'user_1', _rev: '1-a', data: {} });
    const asset = await createAsset(deps, 'user_1', { tag: '  Car  ', amountMinor: 100 });
    expect(asset.tag).toBe('Car');
  });

  it('rejects a tag that collides with an existing asset', async () => {
    const document = {
      _id: 'user_1',
      _rev: '1-a',
      data: { balance: { asset: { assets: [{ id: 'assets_1', tag: 'Car', amount: 8000 }] } } },
    };
    const { deps } = writableDeps(document);
    await expect(
      createAsset(deps, 'user_1', { tag: 'Car', amountMinor: 100 }),
    ).rejects.toMatchObject({
      code: 'ASSET_DUPLICATE_TAG',
    });
  });

  it('rejects a tag that collides with an existing share', async () => {
    const document = {
      _id: 'user_1',
      _rev: '1-a',
      data: { balance: { asset: { shares: [{ tag: 'MSFT', quantity: 10, price: 415 }] } } },
    };
    const { deps } = writableDeps(document);
    await expect(
      createAsset(deps, 'user_1', { tag: 'MSFT', amountMinor: 100 }),
    ).rejects.toMatchObject({
      code: 'ASSET_DUPLICATE_TAG',
    });
  });

  it('rejects a tag that collides with an existing investment', async () => {
    const document = {
      _id: 'user_1',
      _rev: '1-a',
      data: {
        balance: {
          asset: { investments: [{ tag: 'Rental Unit A', amount: 180000, deposit: 30000 }] },
        },
      },
    };
    const { deps } = writableDeps(document);
    await expect(
      createAsset(deps, 'user_1', { tag: 'Rental Unit A', amountMinor: 100 }),
    ).rejects.toMatchObject({ code: 'ASSET_DUPLICATE_TAG' });
  });
});

describe('updateAsset', () => {
  function existingAssetDocument() {
    return {
      _id: 'user_1',
      _rev: '1-a',
      data: { balance: { asset: { assets: [{ id: 'assets_1', tag: 'Car', amount: 8000 }] } } },
    };
  }

  it('updates only the fields provided', async () => {
    const { deps, current } = writableDeps(existingAssetDocument());
    const asset = await updateAsset(deps, 'user_1', 'assets_1', { amountMinor: 900000 });
    expect(asset.tag).toBe('Car');
    expect(asset.amountMinor).toBe(900000);
    expect(current().data.balance.asset.assets[0].tag).toBeDefined();
  });

  it('returns null for an id that does not exist', async () => {
    const { deps } = writableDeps(existingAssetDocument());
    await expect(
      updateAsset(deps, 'user_1', 'assets_missing', { amountMinor: 1 }),
    ).resolves.toBeNull();
  });

  it('allows renaming to a tag that is not otherwise in use', async () => {
    const { deps } = writableDeps(existingAssetDocument());
    const asset = await updateAsset(deps, 'user_1', 'assets_1', { tag: 'Motorcycle' });
    expect(asset.tag).toBe('Motorcycle');
  });

  it('does not reject renaming an asset to its own current tag', async () => {
    const { deps } = writableDeps(existingAssetDocument());
    const asset = await updateAsset(deps, 'user_1', 'assets_1', { tag: 'Car', amountMinor: 100 });
    expect(asset.tag).toBe('Car');
  });

  it('rejects a rename that collides with another asset', async () => {
    const document = existingAssetDocument();
    document.data.balance.asset.assets.push({ id: 'assets_2', tag: 'Boat', amount: 20000 });
    const { deps } = writableDeps(document);
    await expect(updateAsset(deps, 'user_1', 'assets_1', { tag: 'Boat' })).rejects.toMatchObject({
      code: 'ASSET_DUPLICATE_TAG',
    });
  });

  it('rejects a rename that collides with a share', async () => {
    const document = existingAssetDocument();
    document.data.balance.asset.shares = [{ tag: 'MSFT', quantity: 10, price: 415 }];
    const { deps } = writableDeps(document);
    await expect(updateAsset(deps, 'user_1', 'assets_1', { tag: 'MSFT' })).rejects.toMatchObject({
      code: 'ASSET_DUPLICATE_TAG',
    });
  });
});

describe('deleteAsset', () => {
  it('removes the asset and returns its id', async () => {
    const document = {
      _id: 'user_1',
      _rev: '1-a',
      data: { balance: { asset: { assets: [{ id: 'assets_1', tag: 'Car', amount: 8000 }] } } },
    };
    const { deps, current } = writableDeps(document);
    const result = await deleteAsset(deps, 'user_1', 'assets_1');
    expect(result).toEqual({ id: 'assets_1' });
    expect(current().data.balance.asset.assets).toEqual([]);
  });

  it('returns null for an id that does not exist', async () => {
    const document = {
      _id: 'user_1',
      _rev: '1-a',
      data: { balance: { asset: { assets: [{ id: 'assets_1', tag: 'Car', amount: 8000 }] } } },
    };
    const { deps } = writableDeps(document);
    const result = await deleteAsset(deps, 'user_1', 'assets_missing');
    expect(result).toBeNull();
  });

  it('leaves other assets untouched', async () => {
    const document = {
      _id: 'user_1',
      _rev: '1-a',
      data: {
        balance: {
          asset: {
            assets: [
              { id: 'assets_1', tag: 'Car', amount: 8000 },
              { id: 'assets_2', tag: 'Boat', amount: 20000 },
            ],
          },
        },
      },
    };
    const { deps, current } = writableDeps(document);
    await deleteAsset(deps, 'user_1', 'assets_1');
    expect(current().data.balance.asset.assets.map((a) => a.id)).toEqual(['assets_2']);
  });
});
