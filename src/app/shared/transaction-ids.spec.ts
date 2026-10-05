import { ensureTransactionIds, newTransactionId } from './transaction-ids';

describe('transaction ids', () => {
  it('mints tx_<uuid> ids', () => {
    expect(newTransactionId()).toMatch(
      /^tx_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it('works where crypto.randomUUID is unavailable (plain-http, non-secure context)', () => {
    const original = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
    Object.defineProperty(globalThis, 'crypto', {
      value: { getRandomValues: (a: Uint8Array) => a.fill(7) },
      configurable: true,
    });
    try {
      expect(newTransactionId()).toMatch(/^tx_[0-9a-f-]{36}$/);
    } finally {
      if (original) Object.defineProperty(globalThis, 'crypto', original);
    }
  });

  it('keeps existing ids and fills in missing ones, in place', () => {
    const list: { id?: unknown }[] = [{ id: 'tx_a' }, {}, { id: '' }, { id: 5 }];
    expect(ensureTransactionIds(list)).toBe(true);
    expect(list[0].id).toBe('tx_a');
    for (const t of list) expect(typeof t.id).toBe('string');
    expect(new Set(list.map((t) => t.id)).size).toBe(4);
  });

  it('re-mints a duplicate id (a cloned transaction) but keeps the first holder', () => {
    const original = { id: 'tx_dup' };
    const clone = { ...original };
    ensureTransactionIds([original, clone]);
    expect(original.id).toBe('tx_dup');
    expect(clone.id).not.toBe('tx_dup');
  });

  it('reports no change when every transaction already has a unique id', () => {
    expect(ensureTransactionIds([{ id: 'tx_a' }, { id: 'tx_b' }])).toBe(false);
  });
});
