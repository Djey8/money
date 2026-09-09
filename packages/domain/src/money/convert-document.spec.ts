import { EncryptionSession } from '../crypto/cryptic';
import { convertDocumentToMinorUnits } from './convert-document';

describe('convertDocumentToMinorUnits', () => {
  describe('plaintext documents (encryptDatabase off)', () => {
    it('converts a flat transaction array', () => {
      const data = {
        transactions: [
          { account: 'Daily', amount: -12.5, category: '@Groceries' },
          { account: 'Income', amount: 3000, category: '@Salary' },
        ],
      };

      const { data: result, fieldsConverted } = convertDocumentToMinorUnits(data);
      const transactions = (result as any).transactions;

      expect(transactions[0].amount).toBe(-1250);
      expect(transactions[1].amount).toBe(300000);
      expect(transactions[0].category).toBe('@Groceries'); // untouched
      expect(fieldsConverted).toHaveLength(2);
      expect(fieldsConverted[0].path).toBe('$.transactions[0].amount');
    });

    it('converts deeply nested Grow money fields (share/investment/liabilitie) regardless of nesting depth', () => {
      const data = {
        grow: [
          {
            title: 'Rental Property',
            isAsset: false,
            riskScore: 3, // NOT money — must stay untouched
            cashflow: 450.75,
            currentCost: 1200,
            share: { tag: 'n/a', quantity: 0, price: 0 },
            investment: { tag: 'Rental Property', amount: 180000, deposit: 30000 },
            liabilitie: { tag: 'Mortgage', amount: 150000, investment: true, credit: 4200.5 },
          },
        ],
      };

      const { data: result } = convertDocumentToMinorUnits(data);
      const grow = (result as any).grow[0];

      expect(grow.riskScore).toBe(3); // not money, untouched
      expect(grow.cashflow).toBe(45075);
      expect(grow.currentCost).toBe(120000);
      expect(grow.share.price).toBe(0);
      expect(grow.investment.amount).toBe(18000000);
      expect(grow.investment.deposit).toBe(3000000);
      expect(grow.liabilitie.amount).toBe(15000000);
      expect(grow.liabilitie.investment).toBe(true); // boolean flag named "investment" — not money, untouched
      expect(grow.liabilitie.credit).toBe(420050);
    });

    it('converts Smile/Fire bucket target and amount inside nested arrays', () => {
      const data = {
        smile: [
          {
            title: 'Vacation',
            buckets: [
              { id: 'b1', title: 'Flights', target: 1500, amount: 200.5 },
              { id: 'b2', title: 'Hotel', target: 3000, amount: 0 },
            ],
          },
        ],
      };

      const { data: result } = convertDocumentToMinorUnits(data);
      const buckets = (result as any).smile[0].buckets;

      expect(buckets[0].target).toBe(150000);
      expect(buckets[0].amount).toBe(20050);
      expect(buckets[1].target).toBe(300000);
    });

    it('converts Mojo (a singleton, not an array)', () => {
      const data = { mojo: { target: 2000, amount: 1500.25 } };
      const { data: result } = convertDocumentToMinorUnits(data);
      expect((result as any).mojo).toEqual({ target: 200000, amount: 150025 });
    });

    it('converts SubscriptionChange.oldValue/newValue only when field === "amount"', () => {
      const data = {
        subscriptions: [
          {
            title: 'Spotify',
            amount: -9.99,
            changeHistory: [
              { effectiveDate: '2026-01-01', field: 'amount', oldValue: -8.99, newValue: -9.99 },
              {
                effectiveDate: '2026-02-01',
                field: 'account',
                oldValue: 'Daily',
                newValue: 'Splurge',
              },
            ],
          },
        ],
      };

      const { data: result } = convertDocumentToMinorUnits(data);
      const sub = (result as any).subscriptions[0];

      expect(sub.amount).toBe(-999);
      expect(sub.changeHistory[0].oldValue).toBe(-899);
      expect(sub.changeHistory[0].newValue).toBe(-999);
      // Non-amount change record: oldValue/newValue are account names, left untouched.
      expect(sub.changeHistory[1].oldValue).toBe('Daily');
      expect(sub.changeHistory[1].newValue).toBe('Splurge');
    });

    it('reports non-numeric values under a money field name instead of guessing', () => {
      const data = { budget: [{ tag: '@Groceries', amount: null, date: '2026-01' }] };
      const { data: result, skippedNonNumeric } = convertDocumentToMinorUnits(data);

      expect((result as any).budget[0].amount).toBeNull(); // untouched
      expect(skippedNonNumeric).toContain('$.budget[0].amount');
    });

    it('leaves non-money numeric fields untouched (Share.quantity)', () => {
      const data = { balance: { asset: { shares: [{ tag: 'MSFT', quantity: 10, price: 415 }] } } };
      const { data: result } = convertDocumentToMinorUnits(data);
      const share = (result as any).balance.asset.shares[0];

      expect(share.quantity).toBe(10); // untouched
      expect(share.price).toBe(41500);
    });
  });

  describe('encrypted documents (encryptDatabase on)', () => {
    it("decrypts, converts, and re-encrypts only the money fields, leaving other fields' ciphertext untouched", () => {
      const session = new EncryptionSession('user-key');
      const originalCategoryCiphertext = session.encrypt('@Groceries');
      const data = {
        transactions: [
          {
            account: 'Daily',
            amount: session.encrypt('-12.5'),
            category: originalCategoryCiphertext,
          },
        ],
      };

      const { data: result, fieldsConverted } = convertDocumentToMinorUnits(data, {
        decrypt: (v) => session.decrypt(v),
        encrypt: (v) => session.encrypt(v),
      });
      const tx = (result as any).transactions[0];

      expect(session.decrypt(tx.amount)).toBe('-1250');
      expect(tx.category).toBe(originalCategoryCiphertext); // byte-for-byte untouched, not re-encrypted
      expect(fieldsConverted[0].from).toBe(-12.5);
      expect(fieldsConverted[0].to).toBe(-1250);
    });

    it('resolves an encrypted SubscriptionChange.field discriminator before deciding whether oldValue/newValue is money', () => {
      const session = new EncryptionSession('user-key');
      const data = {
        subscriptions: [
          {
            changeHistory: [
              {
                field: session.encrypt('amount'),
                oldValue: session.encrypt('-8.99'),
                newValue: session.encrypt('-9.99'),
              },
            ],
          },
        ],
      };

      const { data: result } = convertDocumentToMinorUnits(data, {
        decrypt: (v) => session.decrypt(v),
        encrypt: (v) => session.encrypt(v),
      });
      const change = (result as any).subscriptions[0].changeHistory[0];

      expect(session.decrypt(change.oldValue)).toBe('-899');
      expect(session.decrypt(change.newValue)).toBe('-999');
    });

    it('throws a clear error if an encrypted money field is found but no decrypt callback was given', () => {
      const session = new EncryptionSession('k');
      const data = { budget: [{ amount: session.encrypt('100') }] };

      expect(() => convertDocumentToMinorUnits(data)).toThrow(/decrypt callback/);
    });
  });

  describe('reversibility check (fromMinorUnits round-trip)', () => {
    it('every converted field can be converted back to the original decimal', () => {
      const data = { transactions: [{ amount: 42.5 }, { amount: -0.01 }, { amount: 1000000.99 }] };
      const { fieldsConverted } = convertDocumentToMinorUnits(data);

      for (const f of fieldsConverted) {
        expect(f.to / 100).toBeCloseTo(f.from, 9);
      }
    });
  });
});
