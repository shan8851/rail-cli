import { createAmbiguousLocationError, createAppError } from './errors.js';

import type { ResolvedStation, StationCandidate } from './types.js';
import type { HuxleyClient } from '../providers/huxley.js';

const CRS_PATTERN = /^[A-Za-z]{3}$/;

export const searchStationCandidates = async (
  huxleyClient: HuxleyClient,
  query: string,
): Promise<StationCandidate[]> => {
  const normalizedQuery = query.trim();

  if (normalizedQuery.length === 0) {
    throw createAppError('INVALID_INPUT', 'station query must not be empty.');
  }

  const candidates = await huxleyClient.searchStations(normalizedQuery);

  return Array.from(
    candidates.reduce<Map<string, StationCandidate>>((candidateMap, candidate) => {
      const key = candidate.crs.toUpperCase();

      if (!candidateMap.has(key)) {
        candidateMap.set(key, {
          crs: key,
          name: candidate.name,
        });
      }

      return candidateMap;
    }, new Map()).values(),
  );
};

export const resolveStation = async (
  huxleyClient: HuxleyClient,
  input: string,
): Promise<ResolvedStation> => {
  const normalizedInput = input.trim();

  if (normalizedInput.length === 0) {
    throw createAppError('INVALID_INPUT', 'station must not be empty.');
  }

  const candidates = await searchStationCandidates(huxleyClient, normalizedInput);

  if (CRS_PATTERN.test(normalizedInput)) {
    const crsInput = normalizedInput.toUpperCase();
    const crsMatch = candidates.find((candidate) => candidate.crs === crsInput);

    if (crsMatch) {
      return crsMatch;
    }

    // The /crs/ endpoint is name-based — it won't find CRS codes as search queries.
    // If the input looks like a CRS code but wasn't found via name search, trust
    // it as a direct CRS code and let the departures/arrivals endpoint validate it.
    return { crs: crsInput, name: crsInput };
  }

  if (candidates.length === 0) {
    throw createAppError('NOT_FOUND', `No station matched "${normalizedInput}".`);
  }

  if (candidates.length === 1) {
    const singleCandidate = candidates[0];

    if (!singleCandidate) {
      throw createAppError('NOT_FOUND', `No station matched "${normalizedInput}".`);
    }

    return singleCandidate;
  }

  const normalizedQuery = normalizeStationName(normalizedInput);
  const exactMatches = candidates.filter(
    (candidate) => normalizeStationName(candidate.name) === normalizedQuery,
  );

  if (exactMatches.length === 1) {
    const exactMatch = exactMatches[0];

    if (!exactMatch) {
      throw createAppError('NOT_FOUND', `No station matched "${normalizedInput}".`);
    }

    return exactMatch;
  }

  throw createAmbiguousLocationError(normalizedInput, candidates.slice(0, 5));
};

const normalizeStationName = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replaceAll('&', 'and')
    .replaceAll(/['.,/()-]/g, ' ')
    .replaceAll(/\s+/g, ' ');
