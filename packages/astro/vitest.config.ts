import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts'],
      reporter: ['text', 'html', 'lcov'],
      // Floors just under current coverage, so it can only go up.
      thresholds: { statements: 95, branches: 80, functions: 100, lines: 95 },
    },
  },
});
