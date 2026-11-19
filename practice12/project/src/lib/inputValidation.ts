import type { CheckResult } from '@/types';

/**
 * Pure input-completion check that runs before the booking rules.
 * Returns the same CheckResult values handleCheck used to build inline,
 * in the same order, or null when all inputs are present.
 */
export function validateInputs(
  currentTimeStr: string,
  startTime: string,
  endTime: string
): CheckResult | null {
  if (!currentTimeStr) {
    return {
      status: 'unavailable',
      reasons: ['Please enter the current time.'],
    };
  }
  if (!startTime || !endTime) {
    return {
      status: 'unavailable',
      reasons: ['Please enter both start and end times.'],
    };
  }
  return null;
}
