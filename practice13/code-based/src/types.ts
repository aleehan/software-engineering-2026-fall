export interface Booking {
  id: string;
  start: number; // minutes from midnight
  end: number;   // minutes from midnight
  bookedBy: string;
}

export interface Room {
  id: string;
  name: string;
  building: string;
  capacity: number;
  blocked: boolean;
  bookings: Booking[];
}

export type CheckResult =
  | { status: 'available' }
  | { status: 'unavailable'; reasons: string[] };
