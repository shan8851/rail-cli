import { HUXLEY_HINT } from '../lib/constants.js';
import { StationBoardResponseSchema, StationSearchResponseSchema } from '../lib/schemas.js';

import { requestJson } from './requestJson.js';

import type { AppConfig } from '../lib/config.js';
import type { HuxleyStationBoardResponse } from '../lib/schemas.js';
import type { StationCandidate } from '../lib/types.js';

export type HuxleyClient = {
  getArrivals: (options: {
    crs: string;
    expand?: boolean | undefined;
    filterCrs?: string | undefined;
    limit: number;
  }) => Promise<HuxleyStationBoardResponse>;
  getDepartures: (options: {
    crs: string;
    expand?: boolean | undefined;
    filterCrs?: string | undefined;
    limit: number;
  }) => Promise<HuxleyStationBoardResponse>;
  searchStations: (query: string) => Promise<StationCandidate[]>;
};

export const createHuxleyClient = (config: AppConfig): HuxleyClient => {
  const baseUrl = new URL(config.railApiUrl);
  const accessToken = config.darwinAccessToken;

  const buildUrl = (path: string, expand?: boolean): URL => {
    const url = new URL(path.replace(/^\//, ''), ensureTrailingSlash(baseUrl));

    if (expand) {
      url.searchParams.set('expand', 'true');
    }

    if (accessToken) {
      url.searchParams.set('accessToken', accessToken);
    }

    return url;
  };

  return {
    getArrivals: async ({ crs, expand, filterCrs, limit }) =>
      requestJson({
        hint: HUXLEY_HINT,
        label: `Rail arrivals lookup for "${crs}"`,
        schema: StationBoardResponseSchema,
        url: buildBoardUrl({
          accessToken,
          baseUrl: ensureTrailingSlash(baseUrl),
          board: 'arrivals',
          crs,
          expand,
          filterCrs,
          filterType: 'from',
          limit,
        }),
      }),
    getDepartures: async ({ crs, expand, filterCrs, limit }) =>
      requestJson({
        hint: HUXLEY_HINT,
        label: `Rail departures lookup for "${crs}"`,
        schema: StationBoardResponseSchema,
        url: buildBoardUrl({
          accessToken,
          baseUrl: ensureTrailingSlash(baseUrl),
          board: 'departures',
          crs,
          expand,
          filterCrs,
          filterType: 'to',
          limit,
        }),
      }),
    searchStations: async (query) => {
      const normalizedQuery = query.trim();

      if (normalizedQuery.length === 0) {
        return [];
      }

      const url = buildUrl(`crs/${encodeURIComponent(normalizedQuery)}`);
      const response = await requestJson({
        hint: HUXLEY_HINT,
        label: `Rail station search for "${normalizedQuery}"`,
        schema: StationSearchResponseSchema,
        url,
      });

      return response.map((result) => ({
        crs: result.crsCode.toUpperCase(),
        name: result.stationName,
      }));
    },
  };
};

const buildBoardUrl = ({
  accessToken,
  baseUrl,
  board,
  crs,
  expand,
  filterCrs,
  filterType,
  limit,
}: {
  accessToken?: string | undefined;
  baseUrl: URL;
  board: 'arrivals' | 'departures';
  crs: string;
  expand?: boolean | undefined;
  filterCrs?: string | undefined;
  filterType: 'from' | 'to';
  limit: number;
}): URL => {
  const encodedCrs = encodeURIComponent(crs);
  const encodedLimit = encodeURIComponent(String(limit));
  const path = filterCrs
    ? `${board}/${encodedCrs}/${filterType}/${encodeURIComponent(filterCrs)}/${encodedLimit}`
    : `${board}/${encodedCrs}/${encodedLimit}`;
  const url = new URL(path, baseUrl);

  if (expand) {
    url.searchParams.set('expand', 'true');
  }

  if (accessToken) {
    url.searchParams.set('accessToken', accessToken);
  }

  return url;
};

const ensureTrailingSlash = (value: URL): URL => {
  const normalizedUrl = new URL(value.toString());

  if (!normalizedUrl.pathname.endsWith('/')) {
    normalizedUrl.pathname = `${normalizedUrl.pathname}/`;
  }

  return normalizedUrl;
};
