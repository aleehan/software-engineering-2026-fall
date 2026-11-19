import { describe, it, expect } from 'vitest';
import { checkAvailability } from '@/lib/availability';
import type { CheckResult, Room } from '@/types';

/** Returns a fresh room object so tests never share mutable state. */
function makeRoom(overrides: Partial<Room> = {}): Room {
  return {
    id: 'fixture-room',
    name: 'Fixture Room',
    building: 'Test Building',
    capacity: 30,
    blocked: false,
    bookings: [{ id: 'b1', start: 600, end: 660, bookedBy: 'Fixture' }],
    ...overrides,
  };
}

const DEFAULT_CURRENT_TIME = 540; // 09:00

/** Snapshot room.bookings for immutability assertion. */
function snapshot(room: Room): string {
  return JSON.stringify(room.bookings);
}

/** Assert the room's bookings array was not mutated by the check. */
function assertBookingsUnchanged(room: Room, before: string) {
  expect(snapshot(room)).toBe(before);
}

/** Assert unavailable with exactly one reason containing expected text. */
function expectUnavailableWithReason(
  result: CheckResult,
  expectedText: string
) {
  expect(result.status).toBe('unavailable');
  if (result.status !== 'unavailable') throw new Error('expected unavailable');
  const reasons = result.reasons;
  expect(reasons).toHaveLength(1);
  expect(reasons[0]).toContain(expectedText);
}

// Note: AC6 (understandable validation feedback in the UI) is verified manually
// and is not covered by these unit tests.

describe('checkAvailability — AC1–AC5', () => {
  // T01: 660–720, no overlap with 600–660 booking → Available (AC4: touching endpoints allowed)
  it('T01: 660–720 → true (AC4 touching endpoints)', () => {
    const room = makeRoom();
    const before = snapshot(room);
    const result = checkAvailability(room, 660, 720, DEFAULT_CURRENT_TIME);
    expect(result.status).toBe('available');
    assertBookingsUnchanged(room, before);
  });

  // T02: 540–570, start == currentTime → false (AC1: start must be after currentTime)
  it('T02: 540–570 → false (AC1 start not after current time)', () => {
    const room = makeRoom();
    const before = snapshot(room);
    const result = checkAvailability(room, 540, 570, DEFAULT_CURRENT_TIME);
    expectUnavailableWithReason(result, 'after the current time');
    assertBookingsUnchanged(room, before);
  });

  // T03: 720–720, start == end → false (AC1: start must be < end)
  it('T03: 720–720 → false (AC1 start equals end)', () => {
    const room = makeRoom();
    const before = snapshot(room);
    const result = checkAvailability(room, 720, 720, DEFAULT_CURRENT_TIME);
    expectUnavailableWithReason(result, 'earlier than end time');
    assertBookingsUnchanged(room, before);
  });

  // T04: 750–720, start > end → false (AC1: start must be < end)
  it('T04: 750–720 → false (AC1 start after end)', () => {
    const room = makeRoom();
    const before = snapshot(room);
    const result = checkAvailability(room, 750, 720, DEFAULT_CURRENT_TIME);
    expectUnavailableWithReason(result, 'earlier than end time');
    assertBookingsUnchanged(room, before);
  });

  // T05: 1380–1441, end > 1440 → false (AC1: end must be ≤ 1440)
  it('T05: 1380–1441 → false (AC1 end exceeds 1440)', () => {
    const room = makeRoom();
    const before = snapshot(room);
    const result = checkAvailability(room, 1380, 1441, DEFAULT_CURRENT_TIME);
    expectUnavailableWithReason(result, '1440');
    assertBookingsUnchanged(room, before);
  });

  // T06: 720–840, duration exactly 120 min → true (AC2: ≤ 120 allowed)
  it('T06: 720–840 → true (AC2 exactly 120 min allowed)', () => {
    const room = makeRoom();
    const before = snapshot(room);
    const result = checkAvailability(room, 720, 840, DEFAULT_CURRENT_TIME);
    expect(result.status).toBe('available');
    assertBookingsUnchanged(room, before);
  });

  // T07: 720–841, duration 121 min → false (AC2: > 120 rejected)
  it('T07: 720–841 → false (AC2 exceeds 120 min)', () => {
    const room = makeRoom();
    const before = snapshot(room);
    const result = checkAvailability(room, 720, 841, DEFAULT_CURRENT_TIME);
    expectUnavailableWithReason(result, '120 minutes');
    assertBookingsUnchanged(room, before);
  });

  // T08: 570–600, touches start of booking at 600 → true (AC4: touching endpoints allowed)
  it('T08: 570–600 → true (AC4 touches booking start)', () => {
    const room = makeRoom();
    const before = snapshot(room);
    const result = checkAvailability(room, 570, 600, DEFAULT_CURRENT_TIME);
    expect(result.status).toBe('available');
    assertBookingsUnchanged(room, before);
  });

  // T09: 630–690, overlaps 600–660 → false (AC4)
  it('T09: 630–690 → false (AC4 overlaps booking)', () => {
    const room = makeRoom();
    const before = snapshot(room);
    const result = checkAvailability(room, 630, 690, DEFAULT_CURRENT_TIME);
    expectUnavailableWithReason(result, 'Overlaps existing booking');
    assertBookingsUnchanged(room, before);
  });

  // T10: 570–690, fully contains 600–660 → false (AC4)
  it('T10: 570–690 → false (AC4 contains booking)', () => {
    const room = makeRoom();
    const before = snapshot(room);
    const result = checkAvailability(room, 570, 690, DEFAULT_CURRENT_TIME);
    expectUnavailableWithReason(result, 'Overlaps existing booking');
    assertBookingsUnchanged(room, before);
  });

  // T11: 615–645, fully inside 600–660 → false (AC4)
  it('T11: 615–645 → false (AC4 inside booking)', () => {
    const room = makeRoom();
    const before = snapshot(room);
    const result = checkAvailability(room, 615, 645, DEFAULT_CURRENT_TIME);
    expectUnavailableWithReason(result, 'Overlaps existing booking');
    assertBookingsUnchanged(room, before);
  });

  // T12: 600–660, exact match of existing booking → false (AC4)
  it('T12: 600–660 → false (AC4 exact match)', () => {
    const room = makeRoom();
    const before = snapshot(room);
    const result = checkAvailability(room, 600, 660, DEFAULT_CURRENT_TIME);
    expectUnavailableWithReason(result, 'Overlaps existing booking');
    assertBookingsUnchanged(room, before);
  });

  // T13: 660–720 with blocked room → false (AC3)
  it('T13: 660–720 blocked room → false (AC3)', () => {
    const room = makeRoom({ blocked: true });
    const before = snapshot(room);
    const result = checkAvailability(room, 660, 720, DEFAULT_CURRENT_TIME);
    expectUnavailableWithReason(result, 'blocked');
    assertBookingsUnchanged(room, before);
  });

  // T14: 630–690 with no bookings → true (AC4: no overlaps when empty)
  it('T14: 630–690 no bookings → true (AC4 empty bookings)', () => {
    const room = makeRoom({ bookings: [] });
    const before = snapshot(room);
    const result = checkAvailability(room, 630, 690, DEFAULT_CURRENT_TIME);
    expect(result.status).toBe('available');
    assertBookingsUnchanged(room, before);
  });

  // T15: 1380–1440, valid boundary → true (AC1: end == 1440 allowed)
  it('T15: 1380–1440 → true (AC1 boundary end at 1440)', () => {
    const room = makeRoom();
    const before = snapshot(room);
    const result = checkAvailability(room, 1380, 1440, DEFAULT_CURRENT_TIME);
    expect(result.status).toBe('available');
    assertBookingsUnchanged(room, before);
  });

  // T16: 660–720 with currentTime = NaN → false (AC1: invalid current time must be rejected)
  it('T16: 660–720 currentTime NaN → false (AC1 invalid current time)', () => {
    const room = makeRoom();
    const before = snapshot(room);
    const result = checkAvailability(room, 660, 720, NaN);
    expect(result.status).toBe('unavailable');
    if (result.status !== 'unavailable') throw new Error('expected unavailable');
    expect(result.reasons.length).toBeGreaterThan(0);
    assertBookingsUnchanged(room, before);
  });

  // T17: AC5 — multiple checks must not mutate the room or its bookings
  it('T17: AC5 multiple checks leave room deeply unchanged', () => {
    const room = makeRoom();
    const roomBefore = JSON.stringify(room);
    const bookingsBefore = JSON.stringify(room.bookings);

    checkAvailability(room, 660, 720, DEFAULT_CURRENT_TIME);
    checkAvailability(room, 630, 690, DEFAULT_CURRENT_TIME);
    checkAvailability(room, 720, 840, DEFAULT_CURRENT_TIME);
    checkAvailability(room, 570, 690, DEFAULT_CURRENT_TIME);

    expect(JSON.stringify(room.bookings)).toBe(bookingsBefore);
    expect(JSON.stringify(room)).toBe(roomBefore);
  });

    it('T18: 540–600, now 500 → true (AC4 touches booking start, regression BUG-A)', () => {
    const room = makeRoom();
    const before = snapshot(room);
    const result = checkAvailability(room, 540, 600, 500);
    expect(result.status).toBe('available');
    assertBookingsUnchanged(room, before);
  });

  it('T19: 659–720 → false (AC4 one-minute overlap, regression BUG-A)', () => {
    const room = makeRoom();
    const before = snapshot(room);
    const result = checkAvailability(room, 659, 720, DEFAULT_CURRENT_TIME);
    expectUnavailableWithReason(result, 'Overlaps existing booking');
    assertBookingsUnchanged(room, before);
  });
  
    it('T20: unsorted bookings stay unchanged after a check (AC5, regression BUG-B)', () => {
    const room = makeRoom({
      bookings: [
        { id: 'b2', start: 720, end: 780, bookedBy: 'Later' },
        { id: 'b1', start: 600, end: 660, bookedBy: 'Earlier' },
      ],
    });
    const before = snapshot(room);
    const result = checkAvailability(room, 660, 720, DEFAULT_CURRENT_TIME);
    expect(result.status).toBe('available');
    assertBookingsUnchanged(room, before);
  });
});
