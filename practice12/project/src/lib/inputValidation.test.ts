import { describe, it, expect } from 'vitest';
import { validateInputs } from '@/lib/inputValidation';

describe('validateInputs', () => {
  it('empty current time → current-time message', () => {
    const result = validateInputs('', '10:00', '11:00');
    expect(result).toEqual({
      status: 'unavailable',
      reasons: ['Please enter the current time.'],
    });
  });

  it('empty start → start/end message', () => {
    const result = validateInputs('09:00', '', '11:00');
    expect(result).toEqual({
      status: 'unavailable',
      reasons: ['Please enter both start and end times.'],
    });
  });

  it('empty end → start/end message', () => {
    const result = validateInputs('09:00', '10:00', '');
    expect(result).toEqual({
      status: 'unavailable',
      reasons: ['Please enter both start and end times.'],
    });
  });

  it('all three empty → current-time message comes first', () => {
    const result = validateInputs('', '', '');
    expect(result).toEqual({
      status: 'unavailable',
      reasons: ['Please enter the current time.'],
    });
  });

  it('all present → null', () => {
    const result = validateInputs('09:00', '10:00', '11:00');
    expect(result).toBeNull();
  });
});
