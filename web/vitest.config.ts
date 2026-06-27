import { defineConfig } from 'vitest/config';

// Unit tests cover the platform-agnostic shared modules and pure web helpers.
// Everything under test here is plain TypeScript (no DOM), so the node
// environment keeps runs fast.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', '../shared/**/*.test.ts'],
    globals: false
  }
});
