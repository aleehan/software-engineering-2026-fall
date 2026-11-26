import { describe, it, expect } from 'vitest';
import { checkRequest, validateRequest } from '@/lib/contract';
import { sampleRooms } from '@/data/sampleRooms';
import type { Room } from '@/types';

// Shared contract cases on fictional fixtures only.
const hallA: Room = { ...sampleRooms[0], bookings: [...sampleRooms[0].bookings] };
const scienceLab2: Room = { ...sampleRooms[1], bookings: [...sampleRooms[1].bookings] };
const CURRENT_TIME = 540; // 09:00

function snapshot(room: Room): string {
  return JSON.stringify(room.bookings);
}

describe('validateRequest', () => {
  it('rejects an empty start time', () => {
    const r = validateRequest('', 60);
    expect(r.ok).toBe(false);
    expect(r.reasonCode).toBe('INVALID_INPUT');
  });

  it('rejects a malformed start time', () => {
    expect(validateRequest('9:00', 60).reasonCode).toBe('INVALID_INPUT');
    expect(validateRequest('25:00', 60).reasonCode).toBe('INVALID_INPUT');
  });

  it('rejects a non-integer duration', () => {
    expect(validateRequest('12:00', 30.5).reasonCode).toBe('INVALID_DURATION');
  });

  it('rejects a slot ending after 24:00', () => {
    expect(validateRequest('23:30', 60).reasonCode).toBe('INVALID_INPUT');
  });
});

describe('checkRequest shared cases (Engineering Hall A, bookings 10:00-11:00 and 17:00-18:00, current time 09:00)', () => {
  it('T1: 12:00 + 60 → Available', () => {
    const before = snapshot(hallA);
    const r = checkRequest(hallA, '12:00', 60, CURRENT_TIME);
    expect(r.available).toBe(true);
    expect(r.reasonCode).toBe('AVAILABLE');
    expect(snapshot(hallA)).toBe(before);
  });

  it('T2: 10:30 + 60 → OVERLAP', () => {
    const r = checkRequest(hallA, '10:30', 60, CURRENT_TIME);
    expect(r.available).toBe(false);
    expect(r.reasonCode).toBe('OVERLAP');
  });

  it('T3: Science Lab 2, 12:00 + 60 → BLOCKED', () => {
    const r = checkRequest(scienceLab2, '12:00', 60, CURRENT_TIME);
    expect(r.available).toBe(false);
    expect(r.reasonCode).toBe('BLOCKED');
  });

  it('T4: duration 0 → INVALID_DURATION', () => {
    const r = checkRequest(hallA, '12:00', 0, CURRENT_TIME);
    expect(r.available).toBe(false);
    expect(r.reasonCode).toBe('INVALID_DURATION');
  });

  it('T5: duration 121 → INVALID_DURATION', () => {
    const r = checkRequest(hallA, '12:00', 121, CURRENT_TIME);
    expect(r.available).toBe(false);
    expect(r.reasonCode).toBe('INVALID_DURATION');
  });

  it('T6: 08:00 + 30 → START_NOT_FUTURE', () => {
    const r = checkRequest(hallA, '08:00', 30, CURRENT_TIME);
    expect(r.available).toBe(false);
    expect(r.reasonCode).toBe('START_NOT_FUTURE');
  });

  it('T7: 11:00 + 60 → Available (touching endpoints allowed)', () => {
    const r = checkRequest(hallA, '11:00', 60, CURRENT_TIME);
    expect(r.available).toBe(true);
    expect(r.reasonCode).toBe('AVAILABLE');
  });

  it('T8: bookings unchanged after T1-T7', () => {
    expect(hallA.bookings).toHaveLength(2);
    expect(hallA.bookings[0]).toEqual({ id: 'b1', start: 600, end: 660, bookedBy: 'CS101 Lecture' });
    expect(hallA.bookings[1]).toEqual({ id: 'b2', start: 1020, end: 1080, bookedBy: 'Robotics Club' });
    expect(scienceLab2.bookings).toHaveLength(1);
  });
});
