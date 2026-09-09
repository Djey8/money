'use strict';

const { EncryptionSession } = require('@money/domain');
const {
  listRevenues,
  listInterests,
  listProperties,
} = require('../../repositories/income-entity-repository');

function dependencies(data, encryptionConfig) {
  return {
    usersDb: { get: jest.fn(async () => ({ data })) },
    authDb: { get: jest.fn(async () => ({ encryptionConfig })) },
  };
}

describe('listRevenues', () => {
  it('decrypts and normalizes stored revenues', async () => {
    const deps = dependencies({
      income: { revenue: { revenues: [{ tag: 'Salary', amount: 250000 }] } },
    });
    const revenues = await listRevenues(deps, 'user_1');
    expect(revenues).toEqual([{ tag: 'Salary', amountMinor: 25000000 }]);
  });

  it('decrypts every field when database encryption is enabled', async () => {
    const session = new EncryptionSession('secret');
    const encryptField = (value) => session.encrypt(String(value));
    const deps = dependencies(
      {
        income: {
          revenue: { revenues: [{ tag: encryptField('Salary'), amount: encryptField('250000') }] },
        },
      },
      { key: 'secret', encryptDatabase: true },
    );
    const [revenue] = await listRevenues(deps, 'user_1');
    expect(revenue.tag).toBe('Salary');
    expect(revenue.amountMinor).toBe(25000000);
  });

  it('leaves already-minor-unit values (schema version 2) unconverted', async () => {
    const deps = dependencies({
      meta: { schemaVersion: 2 },
      income: { revenue: { revenues: [{ tag: 'Salary', amount: 25000000 }] } },
    });
    const [revenue] = await listRevenues(deps, 'user_1');
    expect(revenue.amountMinor).toBe(25000000);
  });

  it('returns an empty list when there is no revenue data', async () => {
    const deps = dependencies({});
    await expect(listRevenues(deps, 'user_1')).resolves.toEqual([]);
  });

  it('returns an empty list for a user with no data document', async () => {
    const error = new Error('not_found');
    error.statusCode = 404;
    const deps = {
      usersDb: { get: jest.fn(async () => Promise.reject(error)) },
      authDb: { get: jest.fn(async () => Promise.reject(error)) },
    };
    await expect(listRevenues(deps, 'user_1')).resolves.toEqual([]);
  });
});

describe('listInterests', () => {
  it('decrypts and normalizes stored interests', async () => {
    const deps = dependencies({
      income: { revenue: { interests: [{ tag: 'MSFT', amount: 800 }] } },
    });
    const interests = await listInterests(deps, 'user_1');
    expect(interests).toEqual([{ tag: 'MSFT', amountMinor: 80000 }]);
  });

  it('returns an empty list when there is no interests data', async () => {
    const deps = dependencies({ income: { revenue: {} } });
    await expect(listInterests(deps, 'user_1')).resolves.toEqual([]);
  });
});

describe('listProperties', () => {
  it('decrypts and normalizes stored properties', async () => {
    const deps = dependencies({
      income: { revenue: { properties: [{ tag: 'Rental Unit A', amount: 800 }] } },
    });
    const properties = await listProperties(deps, 'user_1');
    expect(properties).toEqual([{ tag: 'Rental Unit A', amountMinor: 80000 }]);
  });

  it('returns an empty list when there is no properties data', async () => {
    const deps = dependencies({ income: {} });
    await expect(listProperties(deps, 'user_1')).resolves.toEqual([]);
  });
});
