import type { Command } from 'commander';

import { DEFAULT_LIMIT } from '../lib/constants.js';
import { ensurePositiveInteger, parseIntegerOption } from '../lib/commandUtils.js';
import { ensureStationInput, formatRailBoardText, normalizeRailBoardData } from '../lib/railBoards.js';
import { runCommand, withGlobalOutputOptions } from '../lib/output.js';
import { resolveStation } from '../lib/stations.js';

import type { RailBoardData } from '../lib/types.js';
import type { TextFormatterContext } from '../lib/output.js';
import type { HuxleyClient } from '../providers/huxley.js';

type ArrivalsCommandOptions = {
  expand?: boolean;
  from?: string;
  json?: boolean;
  limit?: number;
  text?: boolean;
};

export const registerArrivalsCommand = (program: Command, huxleyClient: HuxleyClient): void => {
  program
    .command('arrivals')
    .description('Get live arrivals at a National Rail station.')
    .argument('<station>', 'Station name or CRS code')
    .option('--from <origin>', 'Optional origin station to filter arrivals')
    .option('--expand', 'Include calling points for each service')
    .option('--limit <count>', 'Maximum number of arrivals to return', parseIntegerOption, DEFAULT_LIMIT)
    .option('--json', 'Force JSON output')
    .option('--text', 'Force text output')
    .action(async (station: string, options: ArrivalsCommandOptions, command: Command) => {
      await runCommand(
        'arrivals',
        withGlobalOutputOptions(command, options),
        async () => {
          const limit = ensurePositiveInteger(options.limit ?? DEFAULT_LIMIT, 'limit');
          const requestedStation = ensureStationInput(station, 'station');
          const requestedFilter = options.from ? ensureStationInput(options.from, 'origin') : undefined;
          const resolvedStation = await resolveStation(huxleyClient, requestedStation);
          const resolvedFilter = requestedFilter
            ? await resolveStation(huxleyClient, requestedFilter)
            : undefined;
          const board = await huxleyClient.getArrivals({
            crs: resolvedStation.crs,
            expand: options.expand,
            filterCrs: resolvedFilter?.crs,
            limit,
          });

          return normalizeRailBoardData({
            board,
            boardKind: 'arrivals',
            expand: options.expand === true,
            requestedFilter,
            requestedStation,
            resolvedFilter,
            resolvedStation,
          }) satisfies RailBoardData;
        },
        formatArrivalsText,
      );
    });
};

const formatArrivalsText = (data: RailBoardData, context: TextFormatterContext): string =>
  formatRailBoardText(data, 'arrivals', context);
