import type { CheckResult } from '@/types';

/**
 * "Explain availability" feature: MOCK adapter only.
 * No network calls, no API key, no database.
 *
 * Flow: CheckResult -> structured ExplanationInput -> ExplanationAdapter ->
 * validated ExplanationOutput -> UI. checkAvailability in availability.ts
 * remains the only authority on availability; this module only describes it.
 */

export type ReasonCode =
  | 'AVAILABLE'
  | 'INVALID_INTERVAL'
  | 'PAST_START'
  | 'TOO_LONG'
  | 'BLOCKED'
  | 'OVERLAP';

export interface ExplanationInput {
  roomLabel: string;
  start: string;
  end: string;
  isAvailable: boolean;
  reasonCode: ReasonCode | null;
}

export interface ExplanationOutput {
  explanation: string;
}

export interface ExplanationAdapter {
  explain(input: ExplanationInput): Promise<ExplanationOutput>;
}

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const ROOM_LABEL_MAX = 80;
export const EXPLANATION_MAX = 280;
const SENTENCE_MAX = 2;

/** no-control-regex-safe equivalent of /[\u0000-\u001F\u007F]/ */
function hasControlChars(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code <= 0x1f || code === 0x7f) return true;
  }
  return false;
}

const NEGATIVE_CLAIM =
  /unavailable|not available|cannot be booked|isn't available|is not free/i;
const POSITIVE_CLAIM =
  /\b(?:is|are)\s+available\b|you can proceed|can be booked|\bis free\b/i;

const REASON_CODES: ReasonCode[] = [
  'AVAILABLE',
  'INVALID_INTERVAL',
  'PAST_START',
  'TOO_LONG',
  'BLOCKED',
  'OVERLAP',
];

/**
 * Maps a CheckResult to a single reason code, scanning reasons in the order
 * produced by checkAvailability. Returns null when no reason matches a known
 * rule (e.g. incomplete input caught before the booking rules ran); callers
 * must use the deterministic fallback in that case.
 */
export function deriveReasonCode(result: CheckResult): ReasonCode | null {
  if (result.status === 'available') return 'AVAILABLE';
  for (const reason of result.reasons) {
    if (reason === 'Start time must be earlier than end time.') return 'INVALID_INTERVAL';
    if (reason === 'Start time must be after the current time.') return 'PAST_START';
    if (reason.startsWith('Current time must be provided')) return 'PAST_START';
    if (reason.includes('120 minutes')) return 'TOO_LONG';
    if (reason.includes('blocked')) return 'BLOCKED';
    if (reason.startsWith('Overlaps existing booking')) return 'OVERLAP';
  }
  return null;
}

export function validateExplanationInput(input: ExplanationInput): boolean {
  const label = input.roomLabel.trim();
  if (label.length === 0 || label.length > ROOM_LABEL_MAX) return false;
  if (hasControlChars(input.roomLabel)) return false;
  if (input.reasonCode === null) return false;
  if (!TIME_PATTERN.test(input.start) || !TIME_PATTERN.test(input.end)) return false;
  return REASON_CODES.includes(input.reasonCode);
}

export function validateExplanationOutput(
  output: ExplanationOutput,
  isAvailable: boolean
): boolean {
  const text = output.explanation.trim();
  if (text.length === 0 || text.length > EXPLANATION_MAX) return false;
  if ((text.match(/[.!?]/g) ?? []).length > SENTENCE_MAX) return false;
  if (hasControlChars(text)) return false;
  if (isAvailable && NEGATIVE_CLAIM.test(text)) return false;
  if (!isAvailable && POSITIVE_CLAIM.test(text)) return false;
  return true;
}

function renderMockExplanation(input: ExplanationInput): string {
  const { roomLabel, start, end, reasonCode } = input;
  if (reasonCode === null) return 'No booking rule matched, so no explanation is available.';
  switch (reasonCode) {
    case 'AVAILABLE':
      return `${roomLabel} is free from ${start} to ${end}. You can proceed with your booking.`;
    case 'INVALID_INTERVAL':
      return `The interval ${start} to ${end} is not a valid booking window for ${roomLabel}. Adjust the start and end times and check again.`;
    case 'PAST_START':
      return `The start time ${start} for ${roomLabel} is not after the current time. Pick a later start time and check again.`;
    case 'TOO_LONG':
      return `The requested slot at ${roomLabel} from ${start} to ${end} exceeds the 120-minute limit. Split your request into shorter slots.`;
    case 'BLOCKED':
      return `${roomLabel} is currently blocked and cannot be booked. Please choose a different room.`;
    case 'OVERLAP':
      return `The requested slot at ${roomLabel} overlaps an existing booking. Choose a time that does not overlap and check again.`;
  }
}

/** Deterministic fallback built from the check reasons, shown when the adapter fails. */
export function buildFallbackExplanation(
  input: ExplanationInput,
  reasons: string[]
): string {
  const status = input.isAvailable ? 'Available' : 'Unavailable';
  const detail =
    reasons.length > 0 ? reasons[0] : 'No reason details were provided.';
  const text =
    input.reasonCode === null
      ? `${status}: ${detail}`
      : `${status} (${input.reasonCode}): ${detail}`;
  return text.length > EXPLANATION_MAX
    ? text.slice(0, EXPLANATION_MAX - 1) + '…'
    : text;
}

/**
 * Pure orchestration for the "Explain availability" feature. Validates the
 * input, calls the adapter, and accepts the adapter text only if it passes
 * validateExplanationOutput against the authoritative isAvailable value.
 * On invalid input, a null reason code, invalid output, error or timeout it
 * returns the deterministic fallback and never invents booking details.
 */
export async function resolveExplanation(
  result: CheckResult,
  roomLabel: string,
  start: string,
  end: string,
  adapter: ExplanationAdapter
): Promise<{ text: string; usedFallback: boolean }> {
  const isAvailable = result.status === 'available';
  const input: ExplanationInput = {
    roomLabel,
    start,
    end,
    isAvailable,
    reasonCode: deriveReasonCode(result),
  };
  const fallback = (): { text: string; usedFallback: boolean } => ({
    text: buildFallbackExplanation(input, isAvailable ? [] : result.reasons),
    usedFallback: true,
  });

  if (!validateExplanationInput(input)) return fallback();

  try {
    const output = await adapter.explain(input);
    if (validateExplanationOutput(output, isAvailable)) {
      return { text: output.explanation.trim(), usedFallback: false };
    }
    return fallback();
  } catch {
    return fallback();
  }
}

export type MockFailureMode = 'none' | 'timeout' | 'error' | 'invalid-output';

export interface MockAdapterOptions {
  failureMode?: MockFailureMode;
  delayMs?: number;
  timeoutMs?: number;
}

export class MockExplanationAdapter implements ExplanationAdapter {
  private readonly failureMode: MockFailureMode;
  private readonly delayMs: number;
  private readonly timeoutMs: number;

  constructor(options: MockAdapterOptions = {}) {
    this.failureMode = options.failureMode ?? 'none';
    this.delayMs = options.delayMs ?? 300;
    this.timeoutMs = options.timeoutMs ?? 3000;
  }

  explain(input: ExplanationInput): Promise<ExplanationOutput> {
    return Promise.race([this.attempt(input), this.timeoutPromise()]);
  }

  private async attempt(input: ExplanationInput): Promise<ExplanationOutput> {
    if (this.failureMode === 'timeout') {
      return new Promise<ExplanationOutput>(() => {});
    }
    if (this.delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.delayMs));
    }
    switch (this.failureMode) {
      case 'error':
        throw new Error('Simulated explanation failure');
      case 'invalid-output':
        return { explanation: '' };
      default:
        return { explanation: renderMockExplanation(input) };
    }
  }

  private timeoutPromise(): Promise<never> {
    return new Promise((_, reject) => {
      const handle: ReturnType<typeof setTimeout> = setTimeout(
        () => reject(new Error('Explanation request timed out')),
        this.timeoutMs
      );
      if (typeof handle === 'object' && handle !== null && 'unref' in handle) {
        handle.unref();
      }
    });
  }
}
