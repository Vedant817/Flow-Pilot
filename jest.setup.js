import 'whatwg-fetch';
import '@testing-library/jest-dom'

// Mock fetch globally for all tests
global.fetch = jest.fn()

// Global stub for the transformers runtime: deterministic constant vectors,
// so suites exercise routing logic without downloading models.
// Suites needing the REAL runtime (classifier-accuracy) override this with:
//   jest.mock('@huggingface/transformers', () => jest.requireActual('@huggingface/transformers'))
jest.mock('@huggingface/transformers', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('./__mocks__/transformers.js');
});

// Mock Next.js router
jest.mock('next/router', () => ({
  useRouter() {
    return {
      route: '/',
      pathname: '/',
      query: {},
      asPath: '/',
      push: jest.fn(),
      pop: jest.fn(),
      reload: jest.fn(),
      back: jest.fn(),
      prefetch: jest.fn().mockResolvedValue(undefined),
      beforePopState: jest.fn(),
      events: {
        on: jest.fn(),
        off: jest.fn(),
        emit: jest.fn(),
      },
    }
  },
}))

// Mock Next.js navigation
jest.mock('next/navigation', () => ({
  useRouter() {
    return {
      push: jest.fn(),
      replace: jest.fn(),
      refresh: jest.fn(),
      back: jest.fn(),
      forward: jest.fn(),
    }
  },
  useSearchParams() {
    return new URLSearchParams()
  },
  usePathname() {
    return '/'
  },
}))

// Setup cleanup after each test
afterEach(() => {
  jest.clearAllMocks()
})