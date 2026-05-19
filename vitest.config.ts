import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 60_000, // 60s max per test (AC11)
    hookTimeout: 10_000,
    include: ['tests/integration/**/*.test.ts'],
    exclude: ['tests/*.spec.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: [
        'tests/helpers/**/*.ts',
        'tests/types/**/*.ts',
      ],
      exclude: [
        'tests/fixtures/**',
        'tests/integration/**',
      ],
    },
  },
});