import { createAppError } from './errors.js';

export const parseIntegerOption = (value: string): number => {
  const parsedValue = Number.parseInt(value, 10);

  if (Number.isNaN(parsedValue)) {
    throw createAppError('INVALID_INPUT', `Expected a whole number but received "${value}".`);
  }

  return parsedValue;
};

export const ensurePositiveInteger = (value: number, label: string): number => {
  if (!Number.isInteger(value) || value <= 0) {
    throw createAppError('INVALID_INPUT', `${label} must be a positive whole number.`);
  }

  return value;
};
