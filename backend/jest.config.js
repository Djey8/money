module.exports = {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/tests/unit/**/*.test.js', '<rootDir>/tests/integration/**/*.test.js'],
  // Integration tests share two CouchDB users across an ever-growing file.
  // One user has database encryption enabled partway through (per-field
  // encrypt/decrypt on every transaction read/write); by the time later
  // tests run against that user with an accumulated transaction list, a
  // single request measured 10-20s+ under Podman on this machine — a real,
  // pre-existing cost (not introduced by any one endpoint; confirmed by
  // instrumentation showing individual write/read calls this slow, and
  // request handling itself otherwise fast). 30s was too tight against it.
  // Revisit if this grows into a real problem — see PLAN.md.
  testTimeout: 60000,
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
