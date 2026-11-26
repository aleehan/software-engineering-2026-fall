import type { Room } from '@/types';
import { checkAvailability, fmt, parseTime } from '@/lib/availability';

/**
 * Shared availability contract (Practice #13).
 * Inputs: start time (HH:MM), duration in minutes, room blocked flag,
 * fictional bookings. Output: { available, reasonCode, message }.
 * Deterministic booking rules remain in availability.ts (checkAvailability);
 * this module only validates the request shape and translates its result.
 * Fictional data only.
 */

export type ContractReasonCode =
  | 'AVAILABLE'
  | 'INVALID_INPUT'
  | 'START_NOT_FUTURE'
  | 'INVALID_DURATION'
  | 'BLOCKED'
  | 'OVERLAP';

export interface ContractResult {
  available: boolean;
  reasonCode: ContractReasonCode;
  message: string;
}

export const MIN_DURATION = 1;
export const MAX_DURATION = 120;
const DAY_END = 1440;

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export interface RequestValidation {
  ok: boolean;
  reasonCode: ContractReasonCode;
  message: string;
}

/** AC6: empty/malformed time, bad duration, or an end past 24:00 is rejected. */
export function validateRequest(
  startHHMM: string,
  durationMinutes: number
): RequestValidation {
  if (!startHHMM) {
    return {
      ok: false,
      reasonCode: 'INVALID_INPUT',
      message: 'Please enter a start time.',
    };
  }
  if (!TIME_PATTERN.test(startHHMM)) {
    return {
      ok: false,
      reasonCode: 'INVALID_INPUT',
      message: 'Start time must use the HH:MM format (e.g. 09:30).',
    };
  }
  if (!Number.isInteger(durationMinutes)) {
    return {
      ok: false,
      reasonCode: 'INVALID_DURATION',
      message: 'Duration must be a whole number of minutes.',
    };
  }
  if (durationMinutes < MIN_DURATION) {
    return {
      ok: false,
      reasonCode: 'INVALID_DURATION',
      message: 'Duration must be greater than 0 minutes.',
    };
  }
  if (durationMinutes > MAX_DURATION) {
    return {
      ok: false,
      reasonCode: 'INVALID_DURATION',
      message: 'Booking duration cannot exceed 120 minutes.',
    };
  }
  const start = parseTime(startHHMM);
  if (start + durationMinutes > DAY_END) {
    return {
      ok: false,
      reasonCode: 'INVALID_INPUT',
      message: 'The requested slot would end after 24:00.',
    };
  }
  return { ok: true, reasonCode: 'AVAILABLE', message: '' };
}

/**
 * Maps the reasons produced by checkAvailability to a contract reason code.
 * Scans in the order the rules emit reasons; durations over 120 and invalid
 * intervals are already caught by validateRequest, so these are safety nets.
 */
export function reasonsToCode(reasons: string[]): ContractReasonCode {
  for (const reason of reasons) {
    if (reason === 'Start time must be after the current time.') return 'START_NOT_FUTURE';
    if (reason.startsWith('Current time must be provided')) return 'START_NOT_FUTURE';
    if (reason.includes('120 minutes')) return 'INVALID_DURATION';
    if (reason.includes('blocked')) return 'BLOCKED';
    if (reason.startsWith('Overlaps existing booking')) return 'OVERLAP';
  }
  return 'INVALID_INPUT';
}

/**
 * Pure contract entry point: validates the request, computes
 * end = start + duration, and delegates the booking rules to the existing
 * checkAvailability, which remains the only authority on availability.
 */
export function checkRequest(
  room: Room | null,
  startHHMM: string,
  durationMinutes: number,
  currentTime: number
): ContractResult {
  const validation = validateRequest(startHHMM, durationMinutes);
  if (!validation.ok) {
    return {
      available: false,
      reasonCode: validation.reasonCode,
      message: validation.message,
    };
  }

  if (!room) {
    return {
      available: false,
      reasonCode: 'INVALID_INPUT',
      message: 'Please select a room.',
    };
  }

  const start = parseTime(startHHMM);
  const end = start + durationMinutes;
  const result = checkAvailability(room, start, end, currentTime);

  if (result.status === 'available') {
    return {
      available: true,
      reasonCode: 'AVAILABLE',
      message: `${room.name} is available from ${startHHMM} to ${fmt(end)} (${durationMinutes} min). You can proceed with your booking.`,
    };
  }

  return {
    available: false,
    reasonCode: reasonsToCode(result.reasons),
    message: result.reasons[0] ?? 'This room is unavailable for the requested time.',
  };
}
