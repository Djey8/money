module.exports = {
  preset: 'jest-preset-angular',
  setupFilesAfterEnv: ['<rootDir>/src/setup-jest.ts'],
  testPathIgnorePatterns: ['<rootDir>/node_modules/', '<rootDir>/dist/', '<rootDir>/backend/'],
  testMatch: ['<rootDir>/src/**/*.spec.ts'],
  collectCoverageFrom: [
    'src/app/**/*.ts',
    '!src/app/**/*.module.ts',
    '!src/app/**/*.spec.ts',
    '!src/app/interfaces/**',
    '!src/main.ts'
  ],
  coverageThreshold: {
    global: {
      branches: 5,
      functions: 20,
      lines: 15,
      statements: 15
    }
  },
  moduleNameMapper: {
    '^src/(.*)$': '<rootDir>/src/$1'
  },
  transformIgnorePatterns: [
    'node_modules/(?!(@angular|@ngx-translate|rxjs|d3|d3-.*|internmap|delaunator|robust-predicates|@angular/fire|firebase|@firebase)/)'
  ]
};
