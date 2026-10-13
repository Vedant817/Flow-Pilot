const nextJest = require('next/jest')

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files
  dir: './',
})

// Add any custom config to be passed to Jest
const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'jest-environment-jsdom',
  testPathIgnorePatterns: ['<rootDir>/.next/', '<rootDir>/node_modules/'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    '^lucide-react$': '<rootDir>/node_modules/lucide-react/dist/cjs/lucide-react.js',
    '^@huggingface/transformers$': '<rootDir>/__mocks__/transformers.js',
    '^@/lib/analytics/rollup$': '<rootDir>/__mocks__/rollup.js',
    '^@/lib/ai/memory$': '<rootDir>/__mocks__/memory.js',
    '^@/lib/mongodb$': '<rootDir>/__mocks__/mongodb.js',
    '^@/models/(.*)$': '<rootDir>/__mocks__/models.js',
  },
  collectCoverageFrom: [
    'app/**/*.{js,jsx,ts,tsx}',
    'lib/**/*.{js,jsx,ts,tsx}',
    'models/**/*.{js,jsx,ts,tsx}',
    '!**/*.d.ts',
    '!**/node_modules/**',
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },
}

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
module.exports = createJestConfig(customJestConfig)
