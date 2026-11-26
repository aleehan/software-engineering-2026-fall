import { describe, it, expect, vi } from 'vitest';
import {
  MockExplanationAdapter,
  buildFallbackExplanation,
  deriveReasonCode,
  validateExplanationInput,
  validateExplanationOutput,
  resolveExplanation,
  type ExplanationAdapter,
  type ExplanationInput,
} from '@/lib/explanation';
import type { CheckResult } from '@/types';

function makeInput(overrides: Partial<ExplanationInput> = {}): ExplanationInput {
  return {
    roomLabel: 'Room A',
    start: '10:00',
    end: '11:00',
    isAvailable: true,
    reasonCode: 'AVAILABLE',
    ...overrides,
  };
}

describe('deriveReasonCode', () => {
  it('available result maps to AVAILABLE', () => {
    expect(deriveReasonCode({ status: 'available' })).toBe('AVAILABLE');
  });

  it('past-start reason maps to PAST_START', () => {
    const result: CheckResult = {
      status: 'unavailable',
      reasons: ['Start time must be after the current time.'],
    };
    expect(deriveReasonCode(result)).toBe('PAST_START');
  });

  it('duration reason maps to TOO_LONG', () => {
    const result: CheckResult = {
      status: 'unavailable',
      reasons: ['Booking duration cannot exceed 120 minutes.'],
    };
    expect(deriveReasonCode(result)).toBe('TOO_LONG');
  });

  it('blocked reason maps to BLOCKED', () => {
    const result: CheckResult = {
      status: 'unavailable',
      reasons: ['This room is currently blocked and cannot be booked.'],
    };
    expect(deriveReasonCode(result)).toBe('BLOCKED');
  });

  it('overlap reason maps to OVERLAP', () => {
    const result: CheckResult = {
      status: 'unavailable',
      reasons: ['Overlaps existing booking (10:00–11:00 by Test).'],
    };
    expect(deriveReasonCode(result)).toBe('OVERLAP');
  });

  it('unrecognized reason maps to null (no known rule matched)', () => {
    const result: CheckResult = {
      status: 'unavailable',
      reasons: ['Something unexpected.'],
    };
    expect(deriveReasonCode(result)).toBeNull();
  });
});

describe('validateExplanationInput', () => {
  it('accepts a well-formed input', () => {
    expect(validateExplanationInput(makeInput())).toBe(true);
  });

  it('rejects an empty room label', () => {
    expect(validateExplanationInput(makeInput({ roomLabel: '   ' }))).toBe(false);
  });

  it('rejects an overly long room label', () => {
    expect(validateExplanationInput(makeInput({ roomLabel: 'R'.repeat(81) }))).toBe(false);
  });

  it('rejects a malformed start time', () => {
    expect(validateExplanationInput(makeInput({ start: '25:99' }))).toBe(false);
  });

  it('rejects a malformed end time', () => {
    expect(validateExplanationInput(makeInput({ end: '9:00' }))).toBe(false);
  });

  it('rejects a null reason code', () => {
    expect(validateExplanationInput(makeInput({ reasonCode: null }))).toBe(false);
  });

  it('rejects an unknown reason code', () => {
    expect(
      validateExplanationInput(makeInput({ reasonCode: 'UNKNOWN' as never }))
    ).toBe(false);
  });
});

describe('validateExplanationOutput', () => {
  it('accepts a short single-sentence text', () => {
    expect(
      validateExplanationOutput({ explanation: 'This slot is free.' }, true)
    ).toBe(true);
  });

  it('rejects an empty explanation', () => {
    expect(validateExplanationOutput({ explanation: '   ' }, true)).toBe(false);
  });

  it('rejects text over 280 characters', () => {
    const text = 'Sentence one. '.repeat(25);
    expect(validateExplanationOutput({ explanation: text }, true)).toBe(false);
  });

  it('rejects more than two sentences', () => {
    expect(
      validateExplanationOutput(
        { explanation: 'One. Two. Three.' },
        true
      )
    ).toBe(false);
  });

  it('rejects a text that contradicts an available result', () => {
    expect(
      validateExplanationOutput(
        { explanation: 'This slot is unavailable for booking.' },
        true
      )
    ).toBe(false);
  });

  it('rejects a text that contradicts an unavailable result', () => {
    expect(
      validateExplanationOutput(
        { explanation: 'You can proceed with your booking.' },
        false
      )
    ).toBe(false);
  });
});

describe('MockExplanationAdapter', () => {
  it('returns a mock explanation on success', async () => {
    const adapter = new MockExplanationAdapter({ delayMs: 0 });
    const out = await adapter.explain(makeInput());
    expect(typeof out.explanation).toBe('string');
    expect(out.explanation.length).toBeGreaterThan(0);
    expect(validateExplanationOutput(out, true)).toBe(true);
  });

  it('rejects on simulated error', async () => {
    const adapter = new MockExplanationAdapter({ failureMode: 'error', delayMs: 0 });
    await expect(adapter.explain(makeInput())).rejects.toThrow();
  });

  it('rejects on simulated timeout', async () => {
    vi.useFakeTimers();
    try {
      const adapter = new MockExplanationAdapter({
        failureMode: 'timeout',
        delayMs: 0,
        timeoutMs: 3000,
      });
      const promise = adapter.explain(makeInput());
      vi.advanceTimersByTime(3100);
      await expect(promise).rejects.toThrow('timed out');
    } finally {
      vi.useRealTimers();
    }
  });

  it('returns invalid output when failureMode is invalid-output', async () => {
    const adapter = new MockExplanationAdapter({
      failureMode: 'invalid-output',
      delayMs: 0,
    });
    const out = await adapter.explain(makeInput());
    expect(validateExplanationOutput(out, true)).toBe(false);
  });
});

describe('buildFallbackExplanation', () => {
  it('builds deterministic text from the first reason', () => {
    const input = makeInput({ isAvailable: false, reasonCode: 'OVERLAP' });
    expect(
      buildFallbackExplanation(input, ['Overlaps existing booking (10:00–11:00 by Test).'])
    ).toBe('Unavailable (OVERLAP): Overlaps existing booking (10:00–11:00 by Test).');
  });

  it('uses a neutral detail when no reasons are given', () => {
    const input = makeInput();
    expect(buildFallbackExplanation(input, [])).toBe(
      'Available (AVAILABLE): No reason details were provided.'
    );
  });

  it('omits the code segment when the reason code is null', () => {
    const input = makeInput({ isAvailable: false, reasonCode: null });
    expect(buildFallbackExplanation(input, ['Please enter the current time.'])).toBe(
      'Unavailable: Please enter the current time.'
    );
  });
});

describe('resolveExplanation', () => {
  function okAdapter(text: string): ExplanationAdapter {
    return { explain: vi.fn().mockResolvedValue({ explanation: text }) };
  }

  function failingAdapter(): ExplanationAdapter {
    return { explain: vi.fn().mockRejectedValue(new Error('boom')) };
  }

  it('accepts adapter text for an available result', async () => {
    const adapter = okAdapter('This slot is free.');
    const out = await resolveExplanation(
      { status: 'available' },
      'Room A',
      '10:00',
      '11:00',
      adapter
    );
    expect(out).toEqual({ text: 'This slot is free.', usedFallback: false });
  });

  it('falls back when adapter output contradicts an unavailable result', async () => {
    const adapter = okAdapter('You can proceed with your booking.');
    const out = await resolveExplanation(
      { status: 'unavailable', reasons: ['This room is currently blocked and cannot be booked.'] },
      'Room A',
      '10:00',
      '11:00',
      adapter
    );
    expect(out.usedFallback).toBe(true);
    expect(out.text).toContain('Unavailable (BLOCKED)');
  });

  it('falls back when adapter output exceeds 280 characters', async () => {
    const adapter = okAdapter('Free. ' + 'x'.repeat(280));
    const out = await resolveExplanation(
      { status: 'available' },
      'Room A',
      '10:00',
      '11:00',
      adapter
    );
    expect(out.usedFallback).toBe(true);
  });

  it('falls back when the adapter errors', async () => {
    const out = await resolveExplanation(
      { status: 'unavailable', reasons: ['This room is currently blocked and cannot be booked.'] },
      'Room A',
      '10:00',
      '11:00',
      failingAdapter()
    );
    expect(out).toEqual({
      text: 'Unavailable (BLOCKED): This room is currently blocked and cannot be booked.',
      usedFallback: true,
    });
  });

  it('falls back on empty start/end without mentioning 00:00 and without the adapter', async () => {
    const adapter = okAdapter('Should never appear.');
    const out = await resolveExplanation(
      { status: 'unavailable', reasons: ['Please enter both start and end times.'] },
      'Room A',
      '',
      '',
      adapter
    );
    expect(out.usedFallback).toBe(true);
    expect(out.text).toContain('Please enter both start and end times.');
    expect(out.text).not.toContain('00:00');
    expect(adapter.explain).not.toHaveBeenCalled();
  });

  it('falls back on an empty current-time reason without calling the adapter', async () => {
    const adapter = okAdapter('Should never appear.');
    const out = await resolveExplanation(
      { status: 'unavailable', reasons: ['Please enter the current time.'] },
      'Room A',
      '10:00',
      '11:00',
      adapter
    );
    expect(out.usedFallback).toBe(true);
    expect(out.text).toContain('Please enter the current time.');
    expect(adapter.explain).not.toHaveBeenCalled();
  });
});
