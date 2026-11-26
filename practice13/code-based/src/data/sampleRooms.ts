import type { Room } from '@/types';

export const sampleRooms: Room[] = [
  {
    id: 'r1',
    name: 'Engineering Hall A',
    building: 'Block A',
    capacity: 40,
    blocked: false,
    bookings: [
      { id: 'b1', start: 600, end: 660, bookedBy: 'CS101 Lecture' },
      { id: 'b2', start: 1020, end: 1080, bookedBy: 'Robotics Club' },
    ],
  },
  {
    id: 'r2',
    name: 'Science Lab 2',
    building: 'Block B',
    capacity: 25,
    blocked: true,
    bookings: [
      { id: 'b4', start: 600, end: 660, bookedBy: 'Chem Lab Session' },
    ],
  },
  {
    id: 'r3',
    name: 'Library Study Room',
    building: 'Main Library',
    capacity: 12,
    blocked: false,
    bookings: [
      { id: 'b5', start: 480, end: 540, bookedBy: 'Study Group Alpha' },
      { id: 'b6', start: 900, end: 960, bookedBy: 'Book Club' },
    ],
  },
  {
    id: 'r4',
    name: 'Auditorium C',
    building: 'Block C',
    capacity: 200,
    blocked: false,
    bookings: [
      { id: 'b7', start: 840, end: 960, bookedBy: 'Guest Lecture' },
    ],
  },
];
