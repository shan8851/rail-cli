#!/usr/bin/env node

import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { buildCli } from './buildCli.js';

const isEntrypoint = (() => {
  if (process.argv[1] === undefined) return false;
  const scriptPath = fileURLToPath(import.meta.url);
  try {
    return realpathSync(process.argv[1]) === realpathSync(scriptPath);
  } catch {
    return scriptPath === process.argv[1];
  }
})();

if (isEntrypoint) {
  await buildCli().parseAsync(process.argv);
}
