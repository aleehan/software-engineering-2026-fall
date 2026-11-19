import type { Booking, CheckResult, Room } from '@/types';

/** AC1: interval is valid when 0 ≤ start < end ≤ 1440 and start > currentTime */
export function validateInterval(
  start: number,
  end: number,
  currentTime: number
): string[] {
  const reasons: string[] = [];

  if (!Number.isFinite(currentTime))
    reasons.push('Current time must be provided.');
  if (start < 0) reasons.push('Start time cannot be before midnight (0 min).');
  if (end > 1440) reasons.push('End time cannot exceed 24:00 (1440 min).');
  if (start >= end) reasons.push('Start time must be earlier than end time.');
  if (start <= currentTime)
    reasons.push('Start time must be after the current time.');

  return reasons;
}

/** AC2: reject bookings longer than 120 minutes */
export function validateDuration(start: number, end: number): string[] {
  if (end - start > 120)
    return ['Booking duration cannot exceed 120 minutes.'];
  return [];
}

/** AC4: reject intervals that overlap existing bookings; touching endpoints allowed */
export function findOverlaps(start: number, end: number, bookings: Booking[]): string[] {
  const overlaps = bookings.filter(
       (b) => start < b.end && end > b.start
  );
  if (overlaps.length === 0) return [];
  return overlaps.map(
    (b) =>
      `Overlaps existing booking (${fmt(b.start)}–${fmt(b.end)} by ${b.bookedBy}).`
  );
}

/** AC3: reject when room is blocked */
export function checkAvailability(
  room: Room | null,
  start: number,
  end: number,
  currentTime: number
): CheckResult {
  const reasons: string[] = [];

  if (!room) {
    return { status: 'unavailable', reasons: ['Please select a room.'] };
  }

  reasons.push(...validateInterval(start, end, currentTime));
  reasons.push(...validateDuration(start, end));

  if (room.blocked) {
    reasons.push('This room is currently blocked and cannot be booked.');
  }

  reasons.push(...findOverlaps(start, end, room.bookings));

  return reasons.length === 0
    ? { status: 'available' }
    : { status: 'unavailable', reasons };
}

/** Convert minutes-from-midnight to HH:MM */
export function fmt(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Convert HH:MM string to minutes from midnight */
export function parseTime(value: string): number {
  const [h, m] = value.split(':').map(Number);
  return h * 60 + m;
}
