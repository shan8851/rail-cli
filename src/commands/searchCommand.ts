import type { Command } from 'commander';

import { DEFAULT_LIMIT } from '../lib/constants.js';
import { ensurePositiveInteger, parseIntegerOption } from '../lib/commandUtils.js';
import { createAppError } from '../lib/errors.js';
import { runCommand, withGlobalOutputOptions } from '../lib/output.js';
import { searchStationCandidates } from '../lib/stations.js';

import type {
  SearchBatchData,
  SearchData,
  SearchProjectedCandidate,
  SearchQueryResult,
  SearchSelectMode,
  StationCandidate,
} from '../lib/types.js';
import type { TextFormatterContext } from '../lib/output.js';
import type { HuxleyClient } from '../providers/huxley.js';

type SearchCommandOptions = {
  json?: boolean;
  limit?: number;
  select?: string;
  stdin?: boolean;
  text?: boolean;
};

type SearchCommandData = SearchBatchData | SearchData;

const SEARCH_HELP_EXAMPLES = `
Examples:
  rail search "waterloo"
  rail search "waterloo" --select crs
  printf "waterloo\\nvictoria\\n" | rail search --stdin
`;

const SEARCH_USAGE = '[options] <query>\n       rail search [options] --stdin';
const VALID_SEARCH_SELECT_MODES: readonly SearchSelectMode[] = ['name', 'crs', 'name,crs'];

export const registerSearchCommand = (program: Command, huxleyClient: HuxleyClient): void => {
  program
    .command('search')
    .description('Search National Rail stations by name.')
    .usage(SEARCH_USAGE)
    .argument('[query]', 'Station search query')
    .option('--stdin', 'Read newline-delimited queries from stdin')
    .option('--select <fields>', 'Return only search fields: name, crs, or name,crs')
    .option('--limit <count>', 'Maximum number of candidates to return', parseIntegerOption, DEFAULT_LIMIT)
    .option('--json', 'Force JSON output')
    .option('--text', 'Force text output')
    .addHelpText('after', SEARCH_HELP_EXAMPLES)
    .action(async (query: string | undefined, options: SearchCommandOptions, command: Command) => {
      if (!options.stdin && query === undefined) {
        command.error(`error: missing required argument 'query'`, {
          code: 'commander.missingArgument',
        });
      }

      await runCommand<SearchCommandData>(
        'search',
        withGlobalOutputOptions(command, options),
        async () => {
          const limit = ensurePositiveInteger(options.limit ?? DEFAULT_LIMIT, 'limit');
          const selectMode = parseSearchSelectMode(options.select);

          if (options.stdin) {
            if (query !== undefined) {
              throw createAppError(
                'INVALID_INPUT',
                'query cannot be used together with --stdin. Remove the positional query or omit --stdin.',
              );
            }

            return {
              queries: await getBatchSearchResults(huxleyClient, limit, selectMode),
            } satisfies SearchBatchData;
          }

          const normalizedQuery = normalizeSearchQuery(query);

          return {
            candidates: await getProjectedCandidates(huxleyClient, normalizedQuery, limit, selectMode),
            query: normalizedQuery,
          } satisfies SearchData;
        },
        formatSearchText,
      );
    });
};

const getBatchSearchResults = async (
  huxleyClient: HuxleyClient,
  limit: number,
  selectMode: SearchSelectMode | undefined,
): Promise<SearchQueryResult[]> => {
  if (process.stdin.isTTY === true) {
    throw createAppError(
      'INVALID_INPUT',
      '--stdin requires piped stdin input. Example: printf "waterloo\\nvictoria\\n" | rail search --stdin',
    );
  }

  const queries = await readSearchQueriesFromStdin();

  if (queries.length === 0) {
    throw createAppError(
      'INVALID_INPUT',
      'No search queries were provided on stdin. Pipe newline-delimited queries into rail search --stdin.',
    );
  }

  return queries.reduce<Promise<SearchQueryResult[]>>(async (queryResultsPromise, stdinQuery) => {
    const queryResults = await queryResultsPromise;
    const candidates = await getProjectedCandidates(huxleyClient, stdinQuery, limit, selectMode);

    return [
      ...queryResults,
      {
        candidates,
        query: stdinQuery,
      },
    ];
  }, Promise.resolve([]));
};

const getProjectedCandidates = async (
  huxleyClient: HuxleyClient,
  query: string,
  limit: number,
  selectMode: SearchSelectMode | undefined,
): Promise<SearchProjectedCandidate[]> =>
  (await searchStationCandidates(huxleyClient, query))
    .slice(0, limit)
    .map((candidate) => projectCandidate(candidate, selectMode));

const projectCandidate = (
  candidate: StationCandidate,
  selectMode: SearchSelectMode | undefined,
): SearchProjectedCandidate => {
  if (selectMode === undefined) {
    return candidate;
  }

  if (selectMode === 'name') {
    return {
      name: candidate.name,
    };
  }

  if (selectMode === 'crs') {
    return {
      crs: candidate.crs,
    };
  }

  return {
    name: candidate.name,
    crs: candidate.crs,
  };
};

const readSearchQueriesFromStdin = async (): Promise<string[]> => {
  const stdinBody = await readStdin();

  return stdinBody
    .split(/\r?\n/u)
    .map((query) => query.trim())
    .filter((query) => query.length > 0);
};

const readStdin = async (): Promise<string> => {
  let stdinBody = '';

  for await (const chunk of process.stdin as AsyncIterable<string | Uint8Array>) {
    stdinBody += typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8');
  }

  return stdinBody;
};

const parseSearchSelectMode = (value: string | undefined): SearchSelectMode | undefined => {
  if (value === undefined) {
    return undefined;
  }

  const normalizedValue = value
    .split(',')
    .map((field) => field.trim())
    .join(',');

  if (isSearchSelectMode(normalizedValue)) {
    return normalizedValue;
  }

  throw createAppError(
    'INVALID_INPUT',
    `--select must be one of: ${VALID_SEARCH_SELECT_MODES.join(', ')}.`,
  );
};

const isSearchSelectMode = (value: string): value is SearchSelectMode =>
  VALID_SEARCH_SELECT_MODES.includes(value as SearchSelectMode);

const normalizeSearchQuery = (query: string | undefined): string => {
  const normalizedQuery = query?.trim() ?? '';

  if (normalizedQuery.length === 0) {
    throw createAppError('INVALID_INPUT', 'query must not be empty.');
  }

  return normalizedQuery;
};

const formatSearchText = (data: SearchCommandData, context: TextFormatterContext): string =>
  isSearchBatchData(data)
    ? formatBatchSearchText(data, context)
    : formatSingleSearchText(data, context);

const formatSingleSearchText = (data: SearchData, context: TextFormatterContext): string => {
  if (data.candidates.length === 0) {
    return `No station matches for "${data.query}".`;
  }

  return data.candidates.map((candidate) => formatSearchCandidate(candidate, context)).join('\n');
};

const formatBatchSearchText = (data: SearchBatchData, context: TextFormatterContext): string =>
  data.queries
    .map((queryResult) => {
      if (queryResult.candidates.length === 0) {
        return `Query: ${queryResult.query}\nNo station matches for "${queryResult.query}".`;
      }

      return [
        `Query: ${queryResult.query}`,
        ...queryResult.candidates.map((candidate) => formatSearchCandidate(candidate, context)),
      ].join('\n');
    })
    .join('\n\n');

const formatSearchCandidate = (
  candidate: SearchProjectedCandidate,
  context: TextFormatterContext,
): string => {
  const includesName = hasCandidateName(candidate);
  const includesCrs = hasCandidateCrs(candidate);
  const formattedName = hasCandidateName(candidate)
    ? context.text.style.primary(context.text.style.bold(candidate.name))
    : undefined;
  const formattedCrs = includesCrs
    ? context.text.style.cyan(includesName ? `(${candidate.crs})` : candidate.crs)
    : undefined;

  if (formattedName && formattedCrs) {
    return `${formattedName} ${formattedCrs}`;
  }

  return formattedName ?? formattedCrs ?? '';
};

const isSearchBatchData = (data: SearchCommandData): data is SearchBatchData => 'queries' in data;

const hasCandidateName = (
  candidate: SearchProjectedCandidate,
): candidate is SearchProjectedCandidate & { name: string } => 'name' in candidate;

const hasCandidateCrs = (
  candidate: SearchProjectedCandidate,
): candidate is SearchProjectedCandidate & { crs: string } => 'crs' in candidate;
