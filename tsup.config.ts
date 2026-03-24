import { defineConfig } from 'tsup';

export default defineConfig({
  clean: true,
  dts: false,
  entry: ['src/cli.ts'],
  format: ['esm'],
  shims: false,
  sourcemap: true,
  splitting: false,
  target: 'node22',
});
