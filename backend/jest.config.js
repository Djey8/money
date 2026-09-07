module.exports = {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/tests/unit/**/*.test.js', '<rootDir>/tests/integration/**/*.test.js'],
  // Was bumped 30s -> 60s -> 90s to paper over integration tests timing out
  // against one heavily-reused, database-encryption-enabled test user. Root
  // cause found and fixed: EncryptionSession.encrypt() defaulted to a fresh
  // random salt per call, so every field of every transaction paid its own
  // independent PBKDF2 (10,000 iterations) on every read/write — 17.7s for
  // 210 field-encryptions in one request, measured, vs. 109ms once the
  // session's own salt is reused by default (packages/domain/src/crypto/
  // cryptic.ts). That fix brought the whole live-CouchDB integration suite
  // from ~193s back down to ~14s, so this is back to a normal safety margin,
  // not a workaround. See PLAN.md.
  testTimeout: 20000,
  // Run test files sequentially (integration tests share CouchDB state)
  maxWorkers: 1,
  verbose: true,
  collectCoverageFrom: [
    'routes/**/*.js',
    'config/**/*.js',
    'middleware/**/*.js',
    'server.js',
    '!**/node_modules/**',
  ],
  coverageThreshold: {
    global: {
      branches: 60,
      functions: 60,
      lines: 60,
      statements: 60,
    },
  },
};
