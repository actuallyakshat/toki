import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import { WxtVitest } from 'wxt/testing/vitest-plugin';

export default defineConfig({
  // WxtVitest swaps `browser`/`chrome` for an in-memory fake, so wxt storage works in tests.
  plugins: [WxtVitest()],
  resolve: { alias: { '@': fileURLToPath(new URL('./', import.meta.url)) } },
  test: { environment: 'happy-dom', include: ['tests/**/*.test.ts'] },
});
