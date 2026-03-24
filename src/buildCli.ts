import { createRequire } from 'node:module';

import { Command } from 'commander';

import { registerArrivalsCommand } from './commands/arrivalsCommand.js';
import { registerDeparturesCommand } from './commands/departuresCommand.js';
import { registerSearchCommand } from './commands/searchCommand.js';
import { loadConfig } from './lib/config.js';
import { createHuxleyClient } from './providers/huxley.js';

import type { HuxleyClient } from './providers/huxley.js';

export type CliDependencies = {
  huxleyClient: HuxleyClient;
};

const require = createRequire(import.meta.url);
const packageJson = require('../package.json') as { version: string };

export const buildCli = (dependencies?: CliDependencies): Command => {
  const config = loadConfig();
  const huxleyClient = dependencies?.huxleyClient ?? createHuxleyClient(config);
  const program = new Command();

  program
    .name('rail')
    .description('UK National Rail CLI for agents and humans')
    .option('--no-color', 'Disable ANSI colours in text output')
    .showHelpAfterError()
    .showSuggestionAfterError()
    .version(packageJson.version);

  registerDeparturesCommand(program, huxleyClient);
  registerArrivalsCommand(program, huxleyClient);
  registerSearchCommand(program, huxleyClient);

  program.addHelpText(
    'after',
    '\nOutput defaults to text in a TTY and JSON when piped. Use --json or --text to override.',
  );

  return program;
};
