module.exports = {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/tests/unit/**/*.test.js', '<rootDir>/tests/integration/**/*.test.js'],
  // Integration tests share two CouchDB users across an ever-growing file.
  // One user has database encryption enabled partway through (per-field
  // encrypt/decrypt on every transaction read/write); by the time later
  // tests run against that user with an accumulated transaction list, a
  // single request measured 10-20s+ under Podman on this machine — a real,
  // pre-existing cost (not introduced by any one endpoint; confirmed twice
  // now, by instrumentation and by a second, later test independently
  // hitting the same wall as the file grew further, that individual
  // write/read calls are the slow part while request handling itself stays
  // fast). Raised from 30s -> 60s -> 90s as the file kept growing; this is a
  // recurring pattern, not a one-off — revisit properly (e.g. a lighter
  // per-test fixture instead of two shared, ever-more-loaded users) rather
  // than keep bumping this reactively. See PLAN.md.
  testTimeout: 90000,
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
