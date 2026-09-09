'use strict';

const { EncryptionSession } = require('@money/domain');
const {
  listInvestments,
  getInvestment,
  createInvestment,
  updateInvestment,
  deleteInvestment,
} = require('../../repositories/investment-repository');

function dependencies(data, encryptionConfig) {
  return {
    usersDb: { get: jest.fn(async () => ({ data })) },
    authDb: { get: jest.fn(async () => ({ encryptionConfig })) },
  };
}

describe('listInvestments', () => {
  it('decrypts and normalizes stored investments', async () => {
    const deps = dependencies({
      balance: {
        asset: {
          investments: [
            { id: 'investments_1', tag: 'Rental Unit A', amount: 180000, deposit: 30000 },
          ],
        },
      },
    });
    const investments = await listInvestments(deps, 'user_1');
    expect(investments).toEqual([
      { id: 'investments_1', tag: 'Rental Unit A', amountMinor: 18000000, depositMinor: 3000000 },
    ]);
  });

  it('throws a clear error for an investment missing a stable id', async () => {
    const deps = dependencies({
      balance: { asset: { investments: [{ tag: 'Rental Unit A', amount: 180000 }] } },
    });
    await expect(listInvestments(deps, 'user_1')).rejects.toThrow('migrate-balance-entity-ids');
  });

  it('decrypts every field when database encryption is enabled', async () => {
    const session = new EncryptionSession('secret');
    const encryptField = (value) => session.encrypt(String(value));
    const deps = dependencies(
      {
        balance: {
          asset: {
            investments: [
              {
                id: encryptField('investments_1'),
                tag: encryptField('Rental Unit A'),
                amount: encryptField('180000'),
                deposit: encryptField('30000'),
              },
            ],
          },
        },
      },
      { key: 'secret', encryptDatabase: true },
    );
    const [investment] = await listInvestments(deps, 'user_1');
    expect(investment.tag).toBe('Rental Unit A');
    expect(investment.depositMinor).toBe(3000000);
  });

  it('leaves already-minor-unit values (schema version 2) unconverted', async () => {
    const deps = dependencies({
      meta: { schemaVersion: 2 },
      balance: {
        asset: {
          investments: [
            { id: 'investments_1', tag: 'Rental Unit A', amount: 18000000, deposit: 3000000 },
          ],
        },
      },
    });
    const [investment] = await listInvestments(deps, 'user_1');
    expect(investment.amountMinor).toBe(18000000);
    expect(investment.depositMinor).toBe(3000000);
  });

  it('returns an empty list for a user with no data document', async () => {
    const error = new Error('not_found');
    error.statusCode = 404;
    const deps = {
      usersDb: { get: jest.fn(async () => Promise.reject(error)) },
      authDb: { get: jest.fn(async () => Promise.reject(error)) },
    };
    await expect(listInvestments(deps, 'user_1')).resolves.toEqual([]);
  });
});

describe('getInvestment', () => {
  it('finds an investment by id among several', async () => {
    const deps = dependencies({
      balance: {
        asset: {
          investments: [
            { id: 'investments_1', tag: 'Rental Unit A', amount: 180000, deposit: 30000 },
            { id: 'investments_2', tag: 'Rental Unit B', amount: 90000, deposit: 10000 },
          ],
        },
      },
    });
    const investment = await getInvestment(deps, 'user_1', 'investments_2');
    expect(investment.tag).toBe('Rental Unit B');
  });

  it('returns null for an id that does not exist', async () => {
    const deps = dependencies({
      balance: {
        asset: { investments: [{ id: 'investments_1', tag: 'Rental Unit A', amount: 180000 }] },
      },
    });
    await expect(getInvestment(deps, 'user_1', 'investments_missing')).resolves.toBeNull();
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

describe('createInvestment', () => {
  it('creates a new investment with a stable id', async () => {
    const { deps, current } = writableDeps({ _id: 'user_1', _rev: '1-a', data: {} });
    const investment = await createInvestment(deps, 'user_1', {
      tag: 'Rental Unit A',
      amountMinor: 18000000,
      depositMinor: 3000000,
    });
    expect(investment.id).toMatch(/^investments_/);
    expect(investment.depositMinor).toBe(3000000);
    expect(current().data.balance.asset.investments).toHaveLength(1);
  });

  it('defaults amountMinor/depositMinor to 0 when omitted', async () => {
    const { deps } = writableDeps({ _id: 'user_1', _rev: '1-a', data: {} });
    const investment = await createInvestment(deps, 'user_1', { tag: 'Rental Unit A' });
    expect(investment.amountMinor).toBe(0);
    expect(investment.depositMinor).toBe(0);
  });

  it('trims the tag before storing and comparing it', async () => {
    const { deps } = writableDeps({ _id: 'user_1', _rev: '1-a', data: {} });
    const investment = await createInvestment(deps, 'user_1', { tag: '  Rental Unit A  ' });
    expect(investment.tag).toBe('Rental Unit A');
  });

  it('rejects a tag that collides with an existing investment', async () => {
    const document = {
      _id: 'user_1',
      _rev: '1-a',
      data: {
        balance: {
          asset: { investments: [{ id: 'investments_1', tag: 'Rental Unit A', amount: 180000 }] },
        },
      },
    };
    const { deps } = writableDeps(document);
    await expect(createInvestment(deps, 'user_1', { tag: 'Rental Unit A' })).rejects.toMatchObject({
      code: 'INVESTMENT_DUPLICATE_TAG',
    });
  });

  it('rejects a tag that collides with an existing asset', async () => {
    const document = {
      _id: 'user_1',
      _rev: '1-a',
      data: { balance: { asset: { assets: [{ id: 'assets_1', tag: 'Car', amount: 8000 }] } } },
    };
    const { deps } = writableDeps(document);
    await expect(createInvestment(deps, 'user_1', { tag: 'Car' })).rejects.toMatchObject({
      code: 'INVESTMENT_DUPLICATE_TAG',
    });
  });

  it('rejects a tag that collides with an existing share', async () => {
    const document = {
      _id: 'user_1',
      _rev: '1-a',
      data: { balance: { asset: { shares: [{ tag: 'MSFT', quantity: 10, price: 415 }] } } },
    };
    const { deps } = writableDeps(document);
    await expect(createInvestment(deps, 'user_1', { tag: 'MSFT' })).rejects.toMatchObject({
      code: 'INVESTMENT_DUPLICATE_TAG',
    });
  });
});

describe('updateInvestment', () => {
  function existingInvestmentDocument() {
    return {
      _id: 'user_1',
      _rev: '1-a',
      data: {
        balance: {
          asset: {
            investments: [
              { id: 'investments_1', tag: 'Rental Unit A', amount: 180000, deposit: 30000 },
            ],
          },
        },
      },
    };
  }

  it('updates only the fields provided', async () => {
    const { deps } = writableDeps(existingInvestmentDocument());
    const investment = await updateInvestment(deps, 'user_1', 'investments_1', {
      depositMinor: 4000000,
    });
    expect(investment.tag).toBe('Rental Unit A');
    expect(investment.depositMinor).toBe(4000000);
    expect(investment.amountMinor).toBe(18000000);
  });

  it('returns null for an id that does not exist', async () => {
    const { deps } = writableDeps(existingInvestmentDocument());
    await expect(
      updateInvestment(deps, 'user_1', 'investments_missing', { amountMinor: 1 }),
    ).resolves.toBeNull();
  });

  it('does not reject renaming an investment to its own current tag', async () => {
    const { deps } = writableDeps(existingInvestmentDocument());
    const investment = await updateInvestment(deps, 'user_1', 'investments_1', {
      tag: 'Rental Unit A',
    });
    expect(investment.tag).toBe('Rental Unit A');
  });

  it('rejects a rename that collides with another investment', async () => {
    const document = existingInvestmentDocument();
    document.data.balance.asset.investments.push({
      id: 'investments_2',
      tag: 'Rental Unit B',
      amount: 90000,
    });
    const { deps } = writableDeps(document);
    await expect(
      updateInvestment(deps, 'user_1', 'investments_1', { tag: 'Rental Unit B' }),
    ).rejects.toMatchObject({ code: 'INVESTMENT_DUPLICATE_TAG' });
  });

  it('cascades a tag rename into matching income.revenue.properties entries', async () => {
    const document = existingInvestmentDocument();
    document.data.income = {
      revenue: {
        properties: [
          { tag: 'Rental Unit A', amount: 800 },
          { tag: 'Unrelated Property', amount: 500 },
        ],
      },
    };
    const { deps, current } = writableDeps(document);
    await updateInvestment(deps, 'user_1', 'investments_1', { tag: 'Renamed Unit' });
    const properties = current().data.income.revenue.properties;
    expect(properties[0].tag).toBe('Renamed Unit');
    expect(properties[1].tag).toBe('Unrelated Property');
  });

  it('does not touch income.revenue.properties when the tag is unchanged', async () => {
    const document = existingInvestmentDocument();
    document.data.income = { revenue: { properties: [{ tag: 'Rental Unit A', amount: 800 }] } };
    const { deps, current } = writableDeps(document);
    await updateInvestment(deps, 'user_1', 'investments_1', { amountMinor: 19000000 });
    expect(current().data.income.revenue.properties[0].tag).toBe('Rental Unit A');
  });
});

describe('deleteInvestment', () => {
  it('removes the investment and returns its id', async () => {
    const document = {
      _id: 'user_1',
      _rev: '1-a',
      data: {
        balance: {
          asset: { investments: [{ id: 'investments_1', tag: 'Rental Unit A', amount: 180000 }] },
        },
      },
    };
    const { deps, current } = writableDeps(document);
    const result = await deleteInvestment(deps, 'user_1', 'investments_1');
    expect(result).toEqual({ id: 'investments_1' });
    expect(current().data.balance.asset.investments).toEqual([]);
  });

  it('returns null for an id that does not exist', async () => {
    const document = {
      _id: 'user_1',
      _rev: '1-a',
      data: {
        balance: {
          asset: { investments: [{ id: 'investments_1', tag: 'Rental Unit A', amount: 180000 }] },
        },
      },
    };
    const { deps } = writableDeps(document);
    const result = await deleteInvestment(deps, 'user_1', 'investments_missing');
    expect(result).toBeNull();
  });

  it('leaves other investments untouched', async () => {
    const document = {
      _id: 'user_1',
      _rev: '1-a',
      data: {
        balance: {
          asset: {
            investments: [
              { id: 'investments_1', tag: 'Rental Unit A', amount: 180000 },
              { id: 'investments_2', tag: 'Rental Unit B', amount: 90000 },
            ],
          },
        },
      },
    };
    const { deps, current } = writableDeps(document);
    await deleteInvestment(deps, 'user_1', 'investments_1');
    expect(current().data.balance.asset.investments.map((i) => i.id)).toEqual(['investments_2']);
  });
});
