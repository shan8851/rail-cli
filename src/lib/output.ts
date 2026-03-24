import type { Command } from 'commander';

import {
  createTextStyler,
  getTerminalWidth,
  joinAligned,
  padVisibleEnd,
  padVisibleStart,
  stripAnsi,
  visibleWidth,
  wrapText,
} from './colours.js';
import { JSON_SCHEMA_VERSION } from './constants.js';
import { formatAppError, toAppError } from './errors.js';

import type { ErrorEnvelope, OutputMode, OutputOptions, SuccessEnvelope } from './types.js';

export type TextFormatterContext = {
  colorEnabled: boolean;
  terminalWidth: number;
  text: {
    joinAligned: typeof joinAligned;
    padVisibleEnd: typeof padVisibleEnd;
    padVisibleStart: typeof padVisibleStart;
    stripAnsi: typeof stripAnsi;
    style: ReturnType<typeof createTextStyler>;
    visibleWidth: typeof visibleWidth;
    wrapText: typeof wrapText;
  };
};

export const getOutputMode = (options: OutputOptions): OutputMode => {
  if (options.json && options.text) {
    throw toAppError(new Error('Choose either --json or --text, not both.'));
  }

  if (options.json) {
    return 'json';
  }

  if (options.text) {
    return 'text';
  }

  return process.stdout.isTTY ? 'text' : 'json';
};

export const runCommand = async <TData>(
  commandName: string,
  options: OutputOptions,
  handler: () => Promise<TData>,
  formatText: (data: TData, context: TextFormatterContext) => string,
): Promise<void> => {
  const requestedAt = new Date().toISOString();
  const outputMode = getOutputMode(options);
  const colorEnabled =
    outputMode === 'text' &&
    process.stdout.isTTY === true &&
    options.color !== false &&
    !process.env['NO_COLOR'];
  const textContext: TextFormatterContext = {
    colorEnabled,
    terminalWidth: getTerminalWidth(),
    text: {
      joinAligned,
      padVisibleEnd,
      padVisibleStart,
      stripAnsi,
      style: createTextStyler(colorEnabled),
      visibleWidth,
      wrapText,
    },
  };

  try {
    const data = await handler();
    const envelope: SuccessEnvelope<TData> = {
      command: commandName,
      data,
      ok: true,
      requestedAt,
      schemaVersion: JSON_SCHEMA_VERSION,
    };

    if (outputMode === 'json') {
      writeJson(envelope);
      return;
    }

    process.stdout.write(`${formatText(data, textContext)}\n`);
  } catch (error) {
    const appError = toAppError(error);
    const envelope: ErrorEnvelope = {
      command: commandName,
      error: {
        code: appError.code,
        details: appError.details,
        message: appError.message,
        retryable: appError.retryable,
      },
      ok: false,
      requestedAt,
      schemaVersion: JSON_SCHEMA_VERSION,
    };

    process.exitCode = appError.exitCode;

    if (outputMode === 'json') {
      writeJson(envelope);
      return;
    }

    process.stderr.write(`${formatAppError(appError)}\n`);
  }
};

export const withGlobalOutputOptions = <TOptions extends OutputOptions>(
  command: Command,
  options: TOptions,
): TOptions & OutputOptions => {
  const globalOptions = command.optsWithGlobals();
  const color =
    typeof globalOptions === 'object' &&
    globalOptions !== null &&
    'color' in globalOptions &&
    typeof globalOptions['color'] === 'boolean'
      ? globalOptions['color']
      : undefined;

  return {
    ...options,
    color,
  };
};

const writeJson = (value: unknown): void => {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
};
