import { encrypt, EncryptionSession } from './cryptic';
import { rewriteEncryptedValues } from './reencrypt-document';

describe('rewriteEncryptedValues', () => {
  const OLD_KEY = 'old-password';
  const NEW_KEY = 'new-password';

  it('rewrites every encrypted leaf, wherever it appears, regardless of field name', () => {
    const oldSession = new EncryptionSession(OLD_KEY);
    const newSession = new EncryptionSession(NEW_KEY);
    const data = {
      transactions: [
        { amount: encrypt('42.5', OLD_KEY), tag: encrypt('@Groceries', OLD_KEY), id: 'tx-1' },
      ],
      smile: { target: encrypt('1000', OLD_KEY) },
      info: { username: encrypt('jannis', OLD_KEY) },
    };

    const { data: rewritten, rewrittenPaths } = rewriteEncryptedValues(data, (v) =>
      newSession.encrypt(oldSession.decrypt(v)),
    );

    expect(rewrittenPaths.sort()).toEqual(
      [
        '$.transactions[0].amount',
        '$.transactions[0].tag',
        '$.smile.target',
        '$.info.username',
      ].sort(),
    );
    const result = rewritten as typeof data;
    expect(newSession.decrypt(result.transactions[0].amount)).toBe('42.5');
    expect(newSession.decrypt(result.transactions[0].tag)).toBe('@Groceries');
    expect(newSession.decrypt(result.smile.target)).toBe('1000');
    expect(newSession.decrypt(result.info.username)).toBe('jannis');
  });

  it('leaves non-encrypted leaves (numbers, booleans, plain strings, IDs) untouched', () => {
    const oldSession = new EncryptionSession(OLD_KEY);
    const newSession = new EncryptionSession(NEW_KEY);
    const data = {
      id: 'tx-1',
      count: 3,
      active: true,
      createdAt: '2026-01-01T00:00:00.000Z',
      nested: { plain: 'not encrypted' },
    };

    const { data: rewritten, rewrittenPaths } = rewriteEncryptedValues(data, (v) =>
      newSession.encrypt(oldSession.decrypt(v)),
    );

    expect(rewrittenPaths).toEqual([]);
    expect(rewritten).toEqual(data);
  });

  it('supports pure decryption by passing a rewrite that only decrypts', () => {
    const session = new EncryptionSession(OLD_KEY);
    const data = { transactions: [{ amount: encrypt('42.5', OLD_KEY) }] };

    const { data: decrypted } = rewriteEncryptedValues(data, (v) => session.decrypt(v));

    expect((decrypted as typeof data).transactions[0].amount).toBe('42.5');
  });

  it('walks arrays of arrays and deeply nested objects', () => {
    const oldSession = new EncryptionSession(OLD_KEY);
    const newSession = new EncryptionSession(NEW_KEY);
    const data = {
      grow: [{ projects: [{ shares: [{ price: encrypt('99.99', OLD_KEY) }] }] }],
    };

    const { data: rewritten, rewrittenPaths } = rewriteEncryptedValues(data, (v) =>
      newSession.encrypt(oldSession.decrypt(v)),
    );

    expect(rewrittenPaths).toEqual(['$.grow[0].projects[0].shares[0].price']);
    const result = rewritten as typeof data;
    expect(newSession.decrypt(result.grow[0].projects[0].shares[0].price)).toBe('99.99');
  });

  it('rewrites an encrypted value that is a bare array element, not just an object property', () => {
    const oldSession = new EncryptionSession(OLD_KEY);
    const newSession = new EncryptionSession(NEW_KEY);
    const data = { tags: [encrypt('@Food', OLD_KEY), encrypt('@Fun', OLD_KEY), 'plain'] };

    const { data: rewritten, rewrittenPaths } = rewriteEncryptedValues(data, (v) =>
      newSession.encrypt(oldSession.decrypt(v)),
    );

    expect(rewrittenPaths.sort()).toEqual(['$.tags[0]', '$.tags[1]']);
    const result = rewritten as typeof data;
    expect(newSession.decrypt(result.tags[0])).toBe('@Food');
    expect(newSession.decrypt(result.tags[1])).toBe('@Fun');
    expect(result.tags[2]).toBe('plain');
  });

  it('rewrites an encrypted value at the document root itself', () => {
    const oldSession = new EncryptionSession(OLD_KEY);
    const newSession = new EncryptionSession(NEW_KEY);
    const data = encrypt('root-value', OLD_KEY);

    const { data: rewritten, rewrittenPaths } = rewriteEncryptedValues(data, (v) =>
      newSession.encrypt(oldSession.decrypt(v)),
    );

    expect(rewrittenPaths).toEqual(['$']);
    expect(newSession.decrypt(rewritten as string)).toBe('root-value');
  });

  it('handles null and undefined without throwing', () => {
    const { data, rewrittenPaths } = rewriteEncryptedValues({ a: null, b: undefined }, (v) => v);
    expect(data).toEqual({ a: null, b: undefined });
    expect(rewrittenPaths).toEqual([]);
  });
});
