import type { Command } from 'commander';

import { DEFAULT_LIMIT } from '../lib/constants.js';
import { ensurePositiveInteger, parseIntegerOption } from '../lib/commandUtils.js';
import { createAppError } from '../lib/errors.js';
import { runCommand, withGlobalOutputOptions } from '../lib/output.js';
import { searchStationCandidates } from '../lib/stations.js';

import type { SearchData } from '../lib/types.js';
import type { TextFormatterContext } from '../lib/output.js';
import type { HuxleyClient } from '../providers/huxley.js';

type SearchCommandOptions = {
  json?: boolean;
  limit?: number;
  text?: boolean;
};

export const registerSearchCommand = (program: Command, huxleyClient: HuxleyClient): void => {
  program
    .command('search')
    .description('Search National Rail stations by name.')
    .argument('<query>', 'Station search query')
    .option('--limit <count>', 'Maximum number of candidates to return', parseIntegerOption, DEFAULT_LIMIT)
    .option('--json', 'Force JSON output')
    .option('--text', 'Force text output')
    .action(async (query: string, options: SearchCommandOptions, command: Command) => {
      await runCommand(
        'search',
        withGlobalOutputOptions(command, options),
        async () => {
          const limit = ensurePositiveInteger(options.limit ?? DEFAULT_LIMIT, 'limit');
          const normalizedQuery = query.trim();

          if (normalizedQuery.length === 0) {
            throw createAppError('INVALID_INPUT', 'query must not be empty.');
          }

          return {
            candidates: (await searchStationCandidates(huxleyClient, normalizedQuery)).slice(0, limit),
            query: normalizedQuery,
          } satisfies SearchData;
        },
        formatSearchText,
      );
    });
};

const formatSearchText = (data: SearchData, context: TextFormatterContext): string => {
  if (data.candidates.length === 0) {
    return `No station matches for "${data.query}".`;
  }

  return data.candidates
    .map((candidate) => {
      const name = context.text.style.primary(context.text.style.bold(candidate.name));
      const crs = context.text.style.cyan(`(${candidate.crs})`);

      return `${name} ${crs}`;
    })
    .join('\n');
};
