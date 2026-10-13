import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';

export default defineConfig([
  ...nextVitals,
  ...nextTypescript,
  {
    // Legacy data pages use effect -> async fetch callbacks. React 19's
    // compiler lint flags their loading-state updates despite the async edge.
    rules: {
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/immutability': 'off',
    },
  },
  {
    files: ['__tests__/**/*.{ts,tsx}', '__mocks__/**/*.js'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },
  {
    files: ['jest.config.js'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  globalIgnores([
    '.next/**',
    '.delta/**',
    '.swc/**',
    'checkpoints/**',
    'coverage/**',
    'next-env.d.ts',
    '.data/**',
    '.delta/**',
    'attachments/**',
  ]),
]);
