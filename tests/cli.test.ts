import { Readable } from 'node:stream';

import type { Command } from 'commander';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { buildCli } from '../src/buildCli.js';

import type { CliDependencies } from '../src/buildCli.js';
import type { HuxleyStationBoardResponse } from '../src/lib/schemas.js';
import type { HuxleyClient } from '../src/providers/huxley.js';

const ESCAPE_CHARACTER = String.fromCharCode(27);
const ANSI_PATTERN = new RegExp(`${ESCAPE_CHARACTER}\\[[0-9;]*m`, 'g');

const notImplemented = (label: string): never => {
  throw new Error(`${label} was not stubbed for this test.`);
};

const createStubHuxleyClient = (overrides: Partial<HuxleyClient> = {}): HuxleyClient => ({
  getArrivals: vi.fn(async () => notImplemented('getArrivals')),
  getDepartures: vi.fn(async () => notImplemented('getDepartures')),
  searchStations: vi.fn(async () => notImplemented('searchStations')),
  ...overrides,
});

const applyExitOverrideRecursively = (command: Command): void => {
  command.exitOverride();
  command.commands.forEach((subcommand) => {
    applyExitOverrideRecursively(subcommand);
  });
};

type CliEnvironment = {
  columns?: number | undefined;
  env?: Record<string, string | undefined> | undefined;
  isTTY?: boolean | undefined;
  stdin?: string | undefined;
  stdinIsTTY?: boolean | undefined;
};

const runCli = async (
  args: string[],
  dependencies?: CliDependencies,
  environment: CliEnvironment = {},
): Promise<{ exitCode: number; stderr: string; stdout: string }> => {
  const stdoutChunks: string[] = [];
  const stderrChunks: string[] = [];
  const stdoutSpy = vi
    .spyOn(process.stdout, 'write')
    .mockImplementation((chunk: string | Uint8Array) => {
      stdoutChunks.push(String(chunk));
      return true;
    });
  const stderrSpy = vi
    .spyOn(process.stderr, 'write')
    .mockImplementation((chunk: string | Uint8Array) => {
      stderrChunks.push(String(chunk));
      return true;
    });
  const priorExitCode = process.exitCode;
  const previousEnvironment = Object.fromEntries(
    Object.keys(environment.env ?? {}).map((key) => [key, process.env[key]]),
  );
  const previousStdinDescriptor = Object.getOwnPropertyDescriptor(process, 'stdin');
  const previousIsTTYDescriptor = Object.getOwnPropertyDescriptor(process.stdout, 'isTTY');
  const previousColumnsDescriptor = Object.getOwnPropertyDescriptor(process.stdout, 'columns');

  process.exitCode = undefined;
  Object.entries(environment.env ?? {}).forEach(([key, value]) => {
    if (value === undefined) {
      delete process.env[key];
      return;
    }

    process.env[key] = value;
  });

  if (environment.isTTY !== undefined) {
    Object.defineProperty(process.stdout, 'isTTY', {
      configurable: true,
      value: environment.isTTY,
    });
  }

  if (environment.columns !== undefined) {
    Object.defineProperty(process.stdout, 'columns', {
      configurable: true,
      value: environment.columns,
    });
  }

  if (environment.stdin !== undefined || environment.stdinIsTTY !== undefined) {
    const stdinChunks = environment.stdin === undefined ? [] : [environment.stdin];
    const fakeStdin = Readable.from(stdinChunks);

    if (environment.stdinIsTTY !== undefined) {
      Object.defineProperty(fakeStdin, 'isTTY', {
        configurable: true,
        value: environment.stdinIsTTY,
      });
    }

    Object.defineProperty(process, 'stdin', {
      configurable: true,
      value: fakeStdin,
    });
  }

  try {
    const cli = buildCli(dependencies);
    applyExitOverrideRecursively(cli);

    try {
      await cli.parseAsync(args, {
        from: 'user',
      });
    } catch (error) {
      if (!(error instanceof Error) || !('code' in error)) {
        throw error;
      }
    }

    return {
      exitCode: process.exitCode ?? 0,
      stderr: stderrChunks.join(''),
      stdout: stdoutChunks.join(''),
    };
  } finally {
    process.exitCode = priorExitCode;
    Object.entries(previousEnvironment).forEach(([key, value]) => {
      if (value === undefined) {
        delete process.env[key];
        return;
      }

      process.env[key] = value;
    });
    if (previousColumnsDescriptor) {
      Object.defineProperty(process.stdout, 'columns', previousColumnsDescriptor);
    } else {
      delete (process.stdout as Partial<typeof process.stdout> & { columns?: number }).columns;
    }
    if (previousStdinDescriptor) {
      Object.defineProperty(process, 'stdin', previousStdinDescriptor);
    }
    if (previousIsTTYDescriptor) {
      Object.defineProperty(process.stdout, 'isTTY', previousIsTTYDescriptor);
    } else {
      delete (process.stdout as Partial<typeof process.stdout> & { isTTY?: boolean }).isTTY;
    }
    stderrSpy.mockRestore();
    stdoutSpy.mockRestore();
  }
};

const stripAnsi = (value: string): string => value.replaceAll(ANSI_PATTERN, '');

const createDepartureBoard = (): HuxleyStationBoardResponse => ({
  crs: 'KGX',
  filterLocationName: 'Leeds',
  filterType: 'to' as const,
  filtercrs: 'LDS',
  generatedAt: '2026-03-24T11:00:00Z',
  locationName: 'London Kings Cross',
  nrccMessages: [],
  platformAvailable: true,
  trainServices: [
    {
      currentDestinations: [],
      currentOrigins: [],
      destination: [
        {
          locationName: 'Leeds',
        },
      ],
      etd: 'On time',
      operator: 'LNER',
      origin: [],
      platform: '11',
      previousCallingPoints: [],
      serviceID: 'service-1',
      std: '13:10',
      subsequentCallingPoints: [
        {
          callingPoint: [
            {
              locationName: 'Peterborough',
            },
            {
              locationName: 'York',
            },
            {
              locationName: 'Peterborough',
            },
          ],
        },
      ],
    },
    {
      currentDestinations: [],
      currentOrigins: [],
      destination: [
        {
          locationName: 'Aberdeen',
        },
      ],
      etd: '13:40',
      operator: 'LNER',
      origin: [],
      previousCallingPoints: [],
      std: '13:03',
      subsequentCallingPoints: [],
    },
  ],
});

const createArrivalBoard = (): HuxleyStationBoardResponse => ({
  crs: 'KGX',
  filterLocationName: 'Leeds',
  filterType: 'from' as const,
  filtercrs: 'LDS',
  generatedAt: '2026-03-24T11:00:00Z',
  locationName: 'London Kings Cross',
  nrccMessages: [],
  platformAvailable: true,
  trainServices: [
    {
      currentDestinations: [],
      currentOrigins: [],
      destination: [],
      eta: 'On time',
      operator: 'LNER',
      origin: [
        {
          locationName: 'Leeds',
        },
      ],
      previousCallingPoints: [
        {
          callingPoint: [
            {
              locationName: 'Wakefield Westgate',
            },
            {
              locationName: 'Doncaster',
            },
          ],
        },
      ],
      sta: '14:00',
      subsequentCallingPoints: [],
    },
  ],
});

describe('rail cli', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns departures in json mode with resolved station and filter metadata', async () => {
    const huxleyClient = createStubHuxleyClient({
      getDepartures: vi.fn(async () => createDepartureBoard()),
      searchStations: vi.fn(async (query: string) => {
        if (query.toLowerCase() === 'kgx') {
          return [
            {
              crs: 'KGX',
              name: 'London Kings Cross',
            },
          ];
        }

        return [
          {
            crs: 'LDS',
            name: 'Leeds',
          },
        ];
      }),
    });

    const result = await runCli(['departures', 'kgx', '--to', 'leeds', '--json'], {
      huxleyClient,
    });

    expect(result.exitCode).toBe(0);
    expect(huxleyClient.getDepartures).toHaveBeenCalledWith({
      crs: 'KGX',
      expand: undefined,
      filterCrs: 'LDS',
      limit: 10,
    });

    expect(JSON.parse(result.stdout)).toMatchObject({
      command: 'departures',
      data: {
        filter: {
          crs: 'LDS',
          name: 'Leeds',
          type: 'to',
        },
        requestedFilter: 'leeds',
        requestedStation: 'kgx',
        services: [
          {
            counterpartName: 'Leeds',
            operatorName: 'LNER',
            platform: '11',
            scheduledTime: '13:10',
            status: 'on-time',
            statusLabel: 'On time',
          },
          {
            counterpartName: 'Aberdeen',
            expectedTime: '13:40',
            scheduledTime: '13:03',
            status: 'expected',
            statusLabel: 'Exp 13:40',
          },
        ],
        station: {
          crs: 'KGX',
          name: 'London Kings Cross',
        },
      },
      ok: true,
    });
  });

  it('returns arrivals in json mode with expanded previous calling points', async () => {
    const huxleyClient = createStubHuxleyClient({
      getArrivals: vi.fn(async () => createArrivalBoard()),
      searchStations: vi.fn(async () => [
        {
          crs: 'LDS',
          name: 'Leeds',
        },
      ]),
    });

    const result = await runCli(['arrivals', 'KGX', '--from', 'leeds', '--expand', '--json'], {
      huxleyClient: {
        ...huxleyClient,
        searchStations: vi.fn(async (query: string) =>
          query.toLowerCase() === 'kgx'
            ? [
                {
                  crs: 'KGX',
                  name: 'London Kings Cross',
                },
              ]
            : [
                {
                  crs: 'LDS',
                  name: 'Leeds',
                },
              ],
        ),
      },
    });

    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
      data: {
        filter: {
          crs: 'LDS',
          type: 'from',
        },
        services: [
          {
            callingPoints: ['Wakefield Westgate', 'Doncaster'],
            counterpartName: 'Leeds',
            scheduledTime: '14:00',
            status: 'on-time',
            statusLabel: 'On time',
          },
        ],
      },
      ok: true,
    });
  });

  it('returns ambiguous station matches as structured json errors', async () => {
    const huxleyClient = createStubHuxleyClient({
      searchStations: vi.fn(async () => [
        {
          crs: 'WAT',
          name: 'London Waterloo',
        },
        {
          crs: 'WTI',
          name: 'Waterloo International',
        },
      ]),
    });

    const result = await runCli(['departures', 'waterloo', '--json'], {
      huxleyClient,
    });

    expect(result.exitCode).toBe(2);
    expect(JSON.parse(result.stdout)).toMatchObject({
      command: 'departures',
      error: {
        code: 'AMBIGUOUS_LOCATION',
      },
      ok: false,
    });
  });

  it('returns scored search results in json mode', async () => {
    const huxleyClient = createStubHuxleyClient({
      searchStations: vi.fn(async () => [
        {
          crs: 'KGX',
          name: 'London Kings Cross',
        },
        {
          crs: 'KGX',
          name: 'London Kings Cross',
        },
        {
          crs: 'LBG',
          name: 'London Bridge',
        },
      ]),
    });

    const result = await runCli(['search', 'london', '--json'], {
      huxleyClient,
    });

    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
      command: 'search',
      data: {
        candidates: [
          {
            crs: 'KGX',
            name: 'London Kings Cross',
          },
          {
            crs: 'LBG',
            name: 'London Bridge',
          },
        ],
        query: 'london',
      },
      ok: true,
    });
  });

  it('returns batched search results in json mode when reading queries from stdin', async () => {
    const huxleyClient = createStubHuxleyClient({
      searchStations: vi.fn(async (query: string) => {
        if (query === 'waterloo') {
          return [
            {
              crs: 'WAT',
              name: 'London Waterloo',
            },
            {
              crs: 'WAE',
              name: 'London Waterloo East',
            },
          ];
        }

        return [
          {
            crs: 'VIC',
            name: 'London Victoria',
          },
          {
            crs: 'MCV',
            name: 'Manchester Victoria',
          },
        ];
      }),
    });

    const result = await runCli(
      ['search', '--stdin', '--json'],
      {
        huxleyClient,
      },
      {
        stdin: 'waterloo\nvictoria\n',
        stdinIsTTY: false,
      },
    );

    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
      command: 'search',
      data: {
        queries: [
          {
            candidates: [
              {
                crs: 'WAT',
                name: 'London Waterloo',
              },
              {
                crs: 'WAE',
                name: 'London Waterloo East',
              },
            ],
            query: 'waterloo',
          },
          {
            candidates: [
              {
                crs: 'VIC',
                name: 'London Victoria',
              },
              {
                crs: 'MCV',
                name: 'Manchester Victoria',
              },
            ],
            query: 'victoria',
          },
        ],
      },
      ok: true,
    });
  });

  it('projects search results to crs values in text mode', async () => {
    const huxleyClient = createStubHuxleyClient({
      searchStations: vi.fn(async () => [
        {
          crs: 'WAT',
          name: 'London Waterloo',
        },
        {
          crs: 'WAE',
          name: 'London Waterloo East',
        },
      ]),
    });

    const result = await runCli(
      ['search', 'waterloo', '--select', 'crs', '--text'],
      {
        huxleyClient,
      },
      {
        isTTY: false,
      },
    );

    expect(result.exitCode).toBe(0);
    expect(stripAnsi(result.stdout)).toBe('WAT\nWAE\n');
  });

  it('projects search results to crs values in json mode', async () => {
    const huxleyClient = createStubHuxleyClient({
      searchStations: vi.fn(async () => [
        {
          crs: 'WAT',
          name: 'London Waterloo',
        },
        {
          crs: 'WAE',
          name: 'London Waterloo East',
        },
      ]),
    });

    const result = await runCli(['search', 'waterloo', '--select', 'crs', '--json'], {
      huxleyClient,
    });

    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
      command: 'search',
      data: {
        candidates: [
          {
            crs: 'WAT',
          },
          {
            crs: 'WAE',
          },
        ],
        query: 'waterloo',
      },
      ok: true,
    });
  });

  it('rejects combining stdin mode with a positional query', async () => {
    const huxleyClient = createStubHuxleyClient();

    const result = await runCli(
      ['search', 'waterloo', '--stdin', '--json'],
      {
        huxleyClient,
      },
      {
        stdin: 'victoria\n',
        stdinIsTTY: false,
      },
    );

    expect(result.exitCode).toBe(2);
    expect(JSON.parse(result.stdout)).toMatchObject({
      command: 'search',
      error: {
        code: 'INVALID_INPUT',
        message: expect.stringContaining('query cannot be used together with --stdin'),
      },
      ok: false,
    });
  });

  it('rejects invalid search select values', async () => {
    const huxleyClient = createStubHuxleyClient();

    const result = await runCli(['search', 'waterloo', '--select', 'foo', '--json'], {
      huxleyClient,
    });

    expect(result.exitCode).toBe(2);
    expect(JSON.parse(result.stdout)).toMatchObject({
      command: 'search',
      error: {
        code: 'INVALID_INPUT',
        message: '--select must be one of: name, crs, name,crs.',
      },
      ok: false,
    });
    expect(huxleyClient.searchStations).not.toHaveBeenCalled();
  });

  it('rejects empty stdin in batch search mode', async () => {
    const huxleyClient = createStubHuxleyClient();

    const result = await runCli(
      ['search', '--stdin', '--json'],
      {
        huxleyClient,
      },
      {
        stdin: '',
        stdinIsTTY: false,
      },
    );

    expect(result.exitCode).toBe(2);
    expect(JSON.parse(result.stdout)).toMatchObject({
      command: 'search',
      error: {
        code: 'INVALID_INPUT',
        message: expect.stringContaining('No search queries were provided on stdin'),
      },
      ok: false,
    });
  });

  it('rejects tty stdin in batch search mode', async () => {
    const huxleyClient = createStubHuxleyClient();

    const result = await runCli(
      ['search', '--stdin', '--json'],
      {
        huxleyClient,
      },
      {
        stdinIsTTY: true,
      },
    );

    expect(result.exitCode).toBe(2);
    expect(JSON.parse(result.stdout)).toMatchObject({
      command: 'search',
      error: {
        code: 'INVALID_INPUT',
        message: expect.stringContaining('--stdin requires piped stdin input'),
      },
      ok: false,
    });
  });

  it('renders coloured departures text with expanded calling points in tty mode', async () => {
    const huxleyClient = createStubHuxleyClient({
      getDepartures: vi.fn(async () => createDepartureBoard()),
      searchStations: vi.fn(async () => [
        {
          crs: 'KGX',
          name: 'London Kings Cross',
        },
      ]),
    });

    const result = await runCli(
      ['departures', 'KGX', '--expand', '--text'],
      {
        huxleyClient,
      },
      {
        columns: 64,
        env: {
          NO_COLOR: undefined,
        },
        isTTY: true,
      },
    );

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(ANSI_PATTERN);
    expect(stripAnsi(result.stdout)).toContain('London Kings Cross');
    expect(stripAnsi(result.stdout)).toContain('13:10  Leeds  LNER');
    expect(stripAnsi(result.stdout)).toContain('✅ On time');
    expect(stripAnsi(result.stdout)).toContain('\n    Peterborough, York');
  });

  it('disables colour when NO_COLOR is set', async () => {
    const huxleyClient = createStubHuxleyClient({
      getDepartures: vi.fn(async () => createDepartureBoard()),
      searchStations: vi.fn(async () => [
        {
          crs: 'KGX',
          name: 'London Kings Cross',
        },
      ]),
    });

    const result = await runCli(
      ['departures', 'KGX'],
      {
        huxleyClient,
      },
      {
        env: {
          NO_COLOR: '1',
        },
        isTTY: true,
      },
    );

    expect(result.exitCode).toBe(0);
    expect(result.stdout).not.toMatch(ANSI_PATTERN);
    expect(result.stdout).toContain('✅ On time');
  });

  it('disables colour with --no-color even when passed after the subcommand', async () => {
    const huxleyClient = createStubHuxleyClient({
      getDepartures: vi.fn(async () => createDepartureBoard()),
      searchStations: vi.fn(async () => [
        {
          crs: 'KGX',
          name: 'London Kings Cross',
        },
      ]),
    });

    const result = await runCli(
      ['departures', 'KGX', '--no-color'],
      {
        huxleyClient,
      },
      {
        isTTY: true,
      },
    );

    expect(result.exitCode).toBe(0);
    expect(result.stdout).not.toMatch(ANSI_PATTERN);
    expect(result.stdout).toContain('✅ On time');
  });

  it('keeps text output plain when forced in a non-tty', async () => {
    const huxleyClient = createStubHuxleyClient({
      getDepartures: vi.fn(async () => createDepartureBoard()),
      searchStations: vi.fn(async () => [
        {
          crs: 'KGX',
          name: 'London Kings Cross',
        },
      ]),
    });

    const result = await runCli(
      ['departures', 'KGX', '--text'],
      {
        huxleyClient,
      },
      {
        isTTY: false,
      },
    );

    expect(result.exitCode).toBe(0);
    expect(result.stdout).not.toMatch(ANSI_PATTERN);
    expect(result.stdout.trim()).not.toMatch(/^\{/);
    expect(result.stdout).toContain('✅ On time');
  });

  it('returns structured invalid input errors for non-positive limits', async () => {
    const huxleyClient = createStubHuxleyClient({
      searchStations: vi.fn(async () => [
        {
          crs: 'KGX',
          name: 'London Kings Cross',
        },
      ]),
    });

    const result = await runCli(['departures', 'KGX', '--limit', '0', '--json'], {
      huxleyClient,
    });

    expect(result.exitCode).toBe(2);
    expect(JSON.parse(result.stdout)).toMatchObject({
      error: {
        code: 'INVALID_INPUT',
      },
      ok: false,
    });
  });

  it('surfaces empty-body upstream 500 errors with the rail api hint', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: URL | string) => {
        const url = String(input);

        if (url.includes('/crs/')) {
          return new Response(JSON.stringify([{ stationName: 'London Kings Cross', crsCode: 'KGX' }]), {
            status: 200,
          });
        }

        return new Response('', {
          status: 500,
        });
      }),
    );

    const result = await runCli(
      ['departures', 'KGX', '--json'],
      undefined,
      {
        env: {
          RAIL_API_URL: 'https://example.test',
        },
      },
    );

    expect(result.exitCode).toBe(3);
    expect(JSON.parse(result.stdout)).toMatchObject({
      error: {
        code: 'UPSTREAM_API_ERROR',
        message: expect.stringContaining('Set RAIL_API_URL to a working Huxley instance'),
      },
      ok: false,
    });
  });

  it('surfaces upstream timeouts as retryable json errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: URL | string) => {
        const url = String(input);

        if (url.includes('/crs/')) {
          return new Response(JSON.stringify([{ stationName: 'London Kings Cross', crsCode: 'KGX' }]), {
            status: 200,
          });
        }

        const timeoutError = new Error('Request timed out');
        timeoutError.name = 'TimeoutError';
        throw timeoutError;
      }),
    );

    const result = await runCli(
      ['departures', 'KGX', '--json'],
      undefined,
      {
        env: {
          RAIL_API_URL: 'https://example.test',
        },
      },
    );

    expect(result.exitCode).toBe(3);
    expect(JSON.parse(result.stdout)).toMatchObject({
      error: {
        code: 'TIMEOUT',
        retryable: true,
      },
      ok: false,
    });
  });

  it('surfaces malformed json from the upstream board endpoint', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: URL | string) => {
        const url = String(input);

        if (url.includes('/crs/')) {
          return new Response(JSON.stringify([{ stationName: 'London Kings Cross', crsCode: 'KGX' }]), {
            status: 200,
          });
        }

        return new Response('{', {
          status: 200,
        });
      }),
    );

    const result = await runCli(
      ['departures', 'KGX', '--json'],
      undefined,
      {
        env: {
          RAIL_API_URL: 'https://example.test',
        },
      },
    );

    expect(result.exitCode).toBe(3);
    expect(JSON.parse(result.stdout)).toMatchObject({
      error: {
        code: 'UPSTREAM_API_ERROR',
        message: expect.stringContaining('malformed JSON'),
      },
      ok: false,
    });
  });

  it('prints version output', async () => {
    const result = await runCli(['--version']);

    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe('0.1.0');
  });

  it('prints help output', async () => {
    const result = await runCli(['--help']);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('--no-color');
    expect(result.stdout).toContain('departures');
    expect(result.stdout).toContain('arrivals');
    expect(result.stdout).toContain('search');
    expect(result.stdout).toContain('Examples:');
    expect(result.stdout).toContain('rail departures KGX');
    expect(result.stdout).toContain('rail departures "edinburgh" --to york');
    expect(result.stdout).toContain('rail arrivals leeds --from london --limit 5');
    expect(result.stdout).toContain('rail search "waterloo"');
    expect(result.stdout).toContain('printf "waterloo\\nvictoria\\n" | rail search --stdin');
  });

  it('prints departures help examples', async () => {
    const result = await runCli(['departures', '--help']);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Examples:');
    expect(result.stdout).toContain('rail departures KGX');
    expect(result.stdout).toContain('rail departures "edinburgh" --to york');
  });

  it('prints arrivals help examples', async () => {
    const result = await runCli(['arrivals', '--help']);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Examples:');
    expect(result.stdout).toContain('rail arrivals leeds --from london --limit 5');
  });

  it('prints search help examples and agent-first options', async () => {
    const result = await runCli(['search', '--help']);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Usage: rail search [options] <query>');
    expect(result.stdout).toContain('       rail search [options] --stdin');
    expect(result.stdout).toContain('--stdin');
    expect(result.stdout).toContain('--select <fields>');
    expect(result.stdout).toContain('Examples:');
    expect(result.stdout).toContain('rail search "waterloo"');
    expect(result.stdout).toContain('rail search "waterloo" --select crs');
    expect(result.stdout).toContain('printf "waterloo\\nvictoria\\n" | rail search --stdin');
  });
});
