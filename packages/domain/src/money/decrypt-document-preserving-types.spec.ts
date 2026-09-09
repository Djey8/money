import { EncryptionSession } from '../crypto/cryptic';
import { decryptDocumentPreservingTypes } from './convert-document';

describe('decryptDocumentPreservingTypes', () => {
  const KEY = 'export-secret';

  it('leaves an unencrypted document untouched, with native types intact', () => {
    const data = {
      transactions: [{ account: 'Daily', amount: -12.5, category: '@Groceries', id: 'tx_1' }],
      grow: [{ riskScore: 3, share: { quantity: 10 } }],
    };
    const { data: result } = decryptDocumentPreservingTypes(data);
    expect(result).toEqual(data);
  });

  it('decrypts numeric fields back to real numbers, not stringified values', () => {
    const session = new EncryptionSession(KEY);
    const data = {
      transactions: [
        { account: session.encrypt('Daily'), amount: session.encrypt('-12.5'), id: 'tx_1' },
      ],
    };
    const { data: result } = decryptDocumentPreservingTypes(data, {
      decrypt: (v) => session.decrypt(v),
    });
    const tx = (result as any).transactions[0];
    expect(tx.amount).toBe(-12.5);
    expect(typeof tx.amount).toBe('number');
    expect(tx.account).toBe('Daily');
    expect(typeof tx.account).toBe('string');
  });

  it('recovers quantity and riskScore as numbers too, not just MONEY_FIELD_NAMES', () => {
    const session = new EncryptionSession(KEY);
    const data = {
      grow: [
        {
          riskScore: session.encrypt('4'),
          share: { quantity: session.encrypt('12') },
        },
      ],
    };
    const { data: result } = decryptDocumentPreservingTypes(data, {
      decrypt: (v) => session.decrypt(v),
    });
    const grow = (result as any).grow[0];
    expect(grow.riskScore).toBe(4);
    expect(grow.share.quantity).toBe(12);
  });

  it('decrypts a non-numeric field anywhere in the document, regardless of name or nesting', () => {
    const session = new EncryptionSession(KEY);
    const data = {
      smile: [
        { title: session.encrypt('Vacation'), buckets: [{ title: session.encrypt('Flights') }] },
      ],
      tags: [session.encrypt('@Food'), session.encrypt('@Fun')],
    };
    const { data: result } = decryptDocumentPreservingTypes(data, {
      decrypt: (v) => session.decrypt(v),
    });
    const typed = result as any;
    expect(typed.smile[0].title).toBe('Vacation');
    expect(typed.smile[0].buckets[0].title).toBe('Flights');
    expect(typed.tags).toEqual(['@Food', '@Fun']);
  });

  it('only treats SubscriptionChange.oldValue/newValue as numeric when field === "amount"', () => {
    const session = new EncryptionSession(KEY);
    const data = {
      subscriptionChanges: [
        {
          field: session.encrypt('amount'),
          oldValue: session.encrypt('1000'),
          newValue: session.encrypt('1500'),
        },
        {
          field: session.encrypt('account'),
          oldValue: session.encrypt('Daily'),
          newValue: session.encrypt('Income'),
        },
      ],
    };
    const { data: result } = decryptDocumentPreservingTypes(data, {
      decrypt: (v) => session.decrypt(v),
    });
    const [amountChange, accountChange] = (result as any).subscriptionChanges;
    expect(amountChange.oldValue).toBe(1000);
    expect(amountChange.newValue).toBe(1500);
    expect(accountChange.oldValue).toBe('Daily');
    expect(accountChange.newValue).toBe('Income');
  });

  it('recovers Settings allocation fields (daily/splurge/smile/fire) as numbers', () => {
    const session = new EncryptionSession(KEY);
    const data = {
      settings: {
        allocation: {
          daily: session.encrypt('60'),
          splurge: session.encrypt('10'),
          smile: session.encrypt('10'),
          fire: session.encrypt('20'),
        },
      },
    };
    const { data: result } = decryptDocumentPreservingTypes(data, {
      decrypt: (v) => session.decrypt(v),
    });
    const allocation = (result as any).settings.allocation;
    expect(allocation).toEqual({ daily: 60, splurge: 10, smile: 10, fire: 20 });
  });

  it('does not treat data.smile/data.fire (project arrays) as numeric just because the key matches an allocation field name', () => {
    const session = new EncryptionSession(KEY);
    const data = {
      smile: [{ title: session.encrypt('Vacation'), target: session.encrypt('1000') }],
      fire: [{ title: session.encrypt('Retire early'), target: session.encrypt('500000') }],
    };
    const { data: result } = decryptDocumentPreservingTypes(data, {
      decrypt: (v) => session.decrypt(v),
    });
    const typed = result as any;
    expect(typed.smile[0].title).toBe('Vacation');
    expect(typed.smile[0].target).toBe(1000);
    expect(typed.fire[0].title).toBe('Retire early');
    expect(typed.fire[0].target).toBe(500000);
  });

  it('recovers boolean fields (done/investment/isAsset/isEuropeanFormat/manuallyAdjusted) as real booleans', () => {
    const session = new EncryptionSession(KEY);
    const data = {
      smile: [{ buckets: [{ done: session.encrypt('true') }] }],
      grow: [
        {
          isAsset: session.encrypt('false'),
          liabilitie: { investment: session.encrypt('true') },
        },
      ],
      settings: { isEuropeanFormat: session.encrypt('true') },
      plannedSubscriptions: [{ manuallyAdjusted: session.encrypt('true') }],
    };
    const { data: result } = decryptDocumentPreservingTypes(data, {
      decrypt: (v) => session.decrypt(v),
    });
    const typed = result as any;
    expect(typed.smile[0].buckets[0].done).toBe(true);
    expect(typeof typed.smile[0].buckets[0].done).toBe('boolean');
    expect(typed.grow[0].isAsset).toBe(false);
    expect(typed.grow[0].liabilitie.investment).toBe(true);
    expect(typed.settings.isEuropeanFormat).toBe(true);
    expect(typed.plannedSubscriptions[0].manuallyAdjusted).toBe(true);
  });

  it("does not misinterpret Grow's own embedded investment object as the Liability boolean flag of the same name", () => {
    const session = new EncryptionSession(KEY);
    const data = {
      grow: [
        {
          investment: { tag: session.encrypt('Rental'), amount: session.encrypt('180000') },
        },
      ],
    };
    const { data: result } = decryptDocumentPreservingTypes(data, {
      decrypt: (v) => session.decrypt(v),
    });
    const investment = (result as any).grow[0].investment;
    expect(investment.tag).toBe('Rental');
    expect(investment.amount).toBe(180000);
  });

  it("does not crash on Grow's own investment field when it is null (no embedded investment)", () => {
    const data = { grow: [{ title: 'Rental Property', investment: null }] };
    const { data: result } = decryptDocumentPreservingTypes(data);
    expect((result as any).grow[0].investment).toBeNull();
  });

  it('resets the field-kind when descending into an array, rather than propagating the parent key to every element', () => {
    // Defense-in-depth: a hypothetical array of primitives reusing a
    // registered numeric/boolean field name must not get silently
    // mis-coerced just because its container key matches.
    const data = { smile: ['not-a-project', 'also-not-a-project'] };
    const { data: result } = decryptDocumentPreservingTypes(data);
    expect((result as any).smile).toEqual(['not-a-project', 'also-not-a-project']);
  });

  it('throws if a value looks encrypted but no decrypt callback is given', () => {
    const session = new EncryptionSession(KEY);
    const data = { transactions: [{ amount: session.encrypt('-12.5') }] };
    expect(() => decryptDocumentPreservingTypes(data)).toThrow(/no decrypt callback/);
  });

  it('handles null, undefined, and empty documents without throwing', () => {
    expect(decryptDocumentPreservingTypes({}).data).toEqual({});
    expect(decryptDocumentPreservingTypes({ a: null, b: undefined }).data).toEqual({
      a: null,
      b: undefined,
    });
  });
});
