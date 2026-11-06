import { defineConfig } from 'vitest/config';

// Unit tests for the record, compare and machine code. The browser run itself
// needs Chromium and runs with pnpm bench, not here.
export default defineConfig({
  esbuild: { jsx: 'automatic' },
  test: { include: ['src/**/*.test.ts', 'app/**/*.test.tsx'] },
});
