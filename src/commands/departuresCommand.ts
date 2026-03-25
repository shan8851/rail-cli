import type { Command } from 'commander';

import { DEFAULT_LIMIT } from '../lib/constants.js';
import { ensurePositiveInteger, parseIntegerOption } from '../lib/commandUtils.js';
import { ensureStationInput, formatRailBoardText, normalizeRailBoardData } from '../lib/railBoards.js';
import { runCommand, withGlobalOutputOptions } from '../lib/output.js';
import { resolveStation } from '../lib/stations.js';

import type { RailBoardData } from '../lib/types.js';
import type { TextFormatterContext } from '../lib/output.js';
import type { HuxleyClient } from '../providers/huxley.js';

type DeparturesCommandOptions = {
  expand?: boolean;
  json?: boolean;
  limit?: number;
  text?: boolean;
  to?: string;
};

const DEPARTURES_HELP_EXAMPLES = `
Examples:
  rail departures KGX
  rail departures "edinburgh" --to york
`;

export const registerDeparturesCommand = (program: Command, huxleyClient: HuxleyClient): void => {
  program
    .command('departures')
    .description('Get live departures from a National Rail station.')
    .argument('<station>', 'Station name or CRS code')
    .option('--to <destination>', 'Optional destination station to filter departures')
    .option('--expand', 'Include calling points for each service')
    .option('--limit <count>', 'Maximum number of departures to return', parseIntegerOption, DEFAULT_LIMIT)
    .option('--json', 'Force JSON output')
    .option('--text', 'Force text output')
    .addHelpText('after', DEPARTURES_HELP_EXAMPLES)
    .action(async (station: string, options: DeparturesCommandOptions, command: Command) => {
      await runCommand(
        'departures',
        withGlobalOutputOptions(command, options),
        async () => {
          const limit = ensurePositiveInteger(options.limit ?? DEFAULT_LIMIT, 'limit');
          const requestedStation = ensureStationInput(station, 'station');
          const requestedFilter = options.to ? ensureStationInput(options.to, 'destination') : undefined;
          const resolvedStation = await resolveStation(huxleyClient, requestedStation);
          const resolvedFilter = requestedFilter
            ? await resolveStation(huxleyClient, requestedFilter)
            : undefined;
          const board = await huxleyClient.getDepartures({
            crs: resolvedStation.crs,
            expand: options.expand,
            filterCrs: resolvedFilter?.crs,
            limit,
          });

          return normalizeRailBoardData({
            board,
            boardKind: 'departures',
            expand: options.expand === true,
            requestedFilter,
            requestedStation,
            resolvedFilter,
            resolvedStation,
          }) satisfies RailBoardData;
        },
        formatDeparturesText,
      );
    });
};

const formatDeparturesText = (data: RailBoardData, context: TextFormatterContext): string =>
  formatRailBoardText(data, 'departures', context);
