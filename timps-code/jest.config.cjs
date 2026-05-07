module.exports = {
  testEnvironment: 'node',
  collectCoverage: true,
  coverageDirectory: 'coverage',
  testMatch: ['<rootDir>/src/**/*.test.ts', '<rootDir>/src/**/*.spec.ts'],
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { diagnostics: { ignoreCodes: [151002] } }],
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
};