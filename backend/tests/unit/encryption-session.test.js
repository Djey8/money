'use strict';

const { EncryptionSession } = require('@money/domain');
const {
  getEncryptionConfig,
  getEncryptionSession,
  DEFAULT_ENCRYPTION_CONFIG,
} = require('../../services/encryption-session');

function makeAuthDb(result) {
  return { get: jest.fn(async () => result) };
}

describe('encryption session resolution', () => {
  it('uses the documented defaults when no auth document exists', async () => {
    const error = new Error('not_found');
    error.statusCode = 404;
    expect(await getEncryptionConfig(makeAuthDb(Promise.reject(error)), 'user_1')).toEqual(
      DEFAULT_ENCRYPTION_CONFIG,
    );
  });

  it('does not create a session when database encryption is disabled', async () => {
    const authDb = makeAuthDb({ encryptionConfig: { key: 'secret', encryptDatabase: false } });
    await expect(getEncryptionSession(authDb, 'user_1')).resolves.toBeNull();
  });

  it('creates a reusable session for database encryption', async () => {
    const authDb = makeAuthDb({ encryptionConfig: { key: 'secret', encryptDatabase: true } });
    const session = await getEncryptionSession(authDb, 'user_1');
    expect(session).toBeInstanceOf(EncryptionSession);
    expect(session.decrypt(session.encrypt('hello'))).toBe('hello');
  });

  it('propagates auth database failures other than not found', async () => {
    const error = new Error('unavailable');
    error.statusCode = 503;
    await expect(getEncryptionSession(makeAuthDb(Promise.reject(error)), 'user_1')).rejects.toThrow(
      'unavailable',
    );
  });
});
