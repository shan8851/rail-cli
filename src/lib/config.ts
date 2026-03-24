import { config as loadDotEnv } from 'dotenv';

import { DEFAULT_RAIL_API_URL } from './constants.js';

export type AppConfig = {
  railApiUrl: string;
};

export const loadConfig = (): AppConfig => {
  loadDotEnv({
    quiet: true,
  });

  const railApiUrl = firstDefinedValue([process.env['RAIL_API_URL']]) ?? DEFAULT_RAIL_API_URL;

  return {
    railApiUrl,
  };
};

const firstDefinedValue = (values: Array<string | undefined>): string | undefined =>
  values.map((value) => value?.trim()).find((value) => Boolean(value));
