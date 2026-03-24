import { ZodError } from 'zod';

import type { StationCandidate } from './types.js';

export type AppErrorCode =
  | 'AMBIGUOUS_LOCATION'
  | 'AUTH_ERROR'
  | 'INTERNAL_ERROR'
  | 'INVALID_INPUT'
  | 'NOT_FOUND'
  | 'RATE_LIMITED'
  | 'TIMEOUT'
  | 'UPSTREAM_API_ERROR';

export type AppError = Error & {
  code: AppErrorCode;
  details?: unknown;
  exitCode: number;
  retryable: boolean;
};

const EXIT_CODE_BY_ERROR: Record<AppErrorCode, number> = {
  AMBIGUOUS_LOCATION: 2,
  AUTH_ERROR: 3,
  INTERNAL_ERROR: 4,
  INVALID_INPUT: 2,
  NOT_FOUND: 2,
  RATE_LIMITED: 3,
  TIMEOUT: 3,
  UPSTREAM_API_ERROR: 3,
};

const RETRYABLE_CODES = new Set<AppErrorCode>(['RATE_LIMITED', 'TIMEOUT', 'UPSTREAM_API_ERROR']);

export const createAppError = (
  code: AppErrorCode,
  message: string,
  details?: unknown,
): AppError => {
  const error = new Error(message) as AppError;
  error.code = code;
  error.details = details;
  error.exitCode = EXIT_CODE_BY_ERROR[code];
  error.retryable = RETRYABLE_CODES.has(code);
  return error;
};

export const createAmbiguousLocationError = (
  query: string,
  candidates: StationCandidate[],
): AppError =>
  createAppError('AMBIGUOUS_LOCATION', `Could not confidently resolve "${query}".`, {
    candidates,
    query,
  });

export const isAppError = (error: unknown): error is AppError =>
  error instanceof Error &&
  'code' in error &&
  'exitCode' in error &&
  'retryable' in error;

export const toAppError = (error: unknown): AppError => {
  if (isAppError(error)) {
    return error;
  }

  if (error instanceof ZodError) {
    return createAppError('UPSTREAM_API_ERROR', 'Received an unexpected response shape from an upstream API.', {
      issues: error.issues,
    });
  }

  if (error instanceof Error) {
    return createAppError('INTERNAL_ERROR', error.message);
  }

  return createAppError('INTERNAL_ERROR', 'An unknown internal error occurred.');
};

export const formatAppError = (error: AppError): string => {
  if (error.code === 'AMBIGUOUS_LOCATION' && isAmbiguousDetails(error.details)) {
    const candidates = error.details.candidates
      .map((candidate) => `- ${candidate.name} (${candidate.crs})`)
      .join('\n');

    return `${error.message}\n${candidates}\nUse "rail search \\"${error.details.query}\\"" to inspect matches.`;
  }

  return error.message;
};

const isAmbiguousDetails = (
  value: unknown,
): value is { candidates: StationCandidate[]; query: string } =>
  typeof value === 'object' &&
  value !== null &&
  'candidates' in value &&
  Array.isArray(value['candidates']) &&
  'query' in value &&
  typeof value['query'] === 'string';
