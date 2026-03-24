import { createAppError } from '../lib/errors.js';

import type { ZodType } from 'zod';

type RequestJsonOptions<TData> = {
  hint?: string | undefined;
  label: string;
  schema: ZodType<TData>;
  url: URL;
};

export const requestJson = async <TData>({
  hint,
  label,
  schema,
  url,
}: RequestJsonOptions<TData>): Promise<TData> => {
  try {
    const response = await fetch(url, {
      headers: {
        accept: 'application/json',
      },
      signal: AbortSignal.timeout(10_000),
    });

    const bodyText = await response.text();

    if (!response.ok) {
      const parsedBody = bodyText === '' ? undefined : safeJsonParse(bodyText, hint);
      throw createStatusError(response.status, label, parsedBody, hint);
    }

    if (bodyText === '') {
      throw createAppError('UPSTREAM_API_ERROR', withHint(`${label} returned an empty response.`, hint));
    }

    return schema.parse(safeJsonParse(bodyText, hint));
  } catch (error) {
    if (error instanceof Error && error.name === 'TimeoutError') {
      throw createAppError('TIMEOUT', withHint(`${label} timed out.`, hint));
    }

    if (error instanceof TypeError) {
      throw createAppError('UPSTREAM_API_ERROR', withHint(`${label} could not be reached.`, hint));
    }

    throw error;
  }
};

const safeJsonParse = (value: string, hint?: string): unknown => {
  try {
    return JSON.parse(value);
  } catch (error) {
    throw createAppError(
      'UPSTREAM_API_ERROR',
      withHint('Received malformed JSON from an upstream API.', hint),
      {
        bodyPreview: value.slice(0, 250),
        reason: error instanceof Error ? error.message : String(error),
      },
    );
  }
};

const createStatusError = (
  status: number,
  label: string,
  body: unknown,
  hint?: string,
): Error => {
  const upstreamMessage = extractUpstreamMessage(body);
  const message = upstreamMessage ? `${label}: ${upstreamMessage}` : `${label} failed with HTTP ${status}.`;
  const finalMessage = withHint(message, hint);

  if (status === 401 || status === 403) {
    return createAppError('AUTH_ERROR', finalMessage, {
      status,
    });
  }

  if (status === 404) {
    return createAppError('NOT_FOUND', finalMessage, {
      status,
    });
  }

  if (status === 429) {
    return createAppError('RATE_LIMITED', finalMessage, {
      status,
    });
  }

  return createAppError('UPSTREAM_API_ERROR', finalMessage, {
    status,
  });
};

const extractUpstreamMessage = (body: unknown): string | undefined => {
  if (typeof body !== 'object' || body === null) {
    return undefined;
  }

  const message = 'message' in body ? body.message : undefined;
  return typeof message === 'string' ? message : undefined;
};

const withHint = (message: string, hint?: string): string => (hint ? `${message} ${hint}` : message);
