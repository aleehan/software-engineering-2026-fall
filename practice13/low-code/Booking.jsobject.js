export default {
  // Smart Campus availability contract (Practice #13), low-code track.
  // Fictional data only: one room, fixed bookings, times in minutes from midnight.
  room: {
    name: 'Engineering Hall A',
    bookings: [
      { id: 'b1', start: 600, end: 660, label: 'CS101 Lecture' },
      { id: 'b2', start: 1020, end: 1080, label: 'Robotics Club' }
    ]
  },
  MAX_DURATION: 120,
  parseTime (value) {
    const s = String(value || '').trim();
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(s)) return null;
    const parts = s.split(':');
    return Number(parts[0]) * 60 + Number(parts[1]);
  },
  fmt (min) {
    return String(Math.floor(min / 60)).padStart(2, '0') + ':' + String(min % 60).padStart(2, '0');
  },
  // Pure rule function: returns { available, reasonCode, message } and never mutates bookings.
  check (startText, durationText, blocked, currentText) {
    const fail = (reasonCode, message) => ({ available: false, reasonCode: reasonCode, message: message });
    const current = this.parseTime(currentText);
    if (current === null) return fail('INVALID_INPUT', 'Current time must use the HH:MM format (e.g. 09:00).');
    const start = this.parseTime(startText);
    if (start === null) return fail('INVALID_INPUT', 'Start time must use the HH:MM format (e.g. 09:30).');
    const raw = String(durationText === undefined || durationText === null ? '' : durationText).trim();
    if (!/^-?\d+$/.test(raw)) return fail('INVALID_DURATION', 'Duration must be a whole number of minutes.');
    const duration = Number(raw);
    if (duration <= 0) return fail('INVALID_DURATION', 'Duration must be greater than 0 minutes.');
    if (duration > this.MAX_DURATION) return fail('INVALID_DURATION', 'Booking duration cannot exceed 120 minutes.');
    const end = start + duration;
    if (end > 1440) return fail('INVALID_INPUT', 'The requested slot would end after 24:00.');
    if (start <= current) return fail('START_NOT_FUTURE', 'Start time must be after the current time.');
    if (blocked) return fail('BLOCKED', 'This room is currently blocked and cannot be booked.');
    const clash = this.room.bookings.find(b => start < b.end && end > b.start);
    if (clash) return fail('OVERLAP', 'Overlaps existing booking (' + this.fmt(clash.start) + '-' + this.fmt(clash.end) + ' by ' + clash.label + ').');
    return { available: true, reasonCode: 'AVAILABLE', message: this.room.name + ' is available from ' + this.fmt(start) + ' to ' + this.fmt(end) + ' (' + duration + ' min).' };
  },
  // Presentation glue: reads the widgets, stores the result for the Text widget.
  async run () {
    const result = this.check(StartTimeInput.text, DurationInput.text, BlockedSwitch.isSwitchedOn, CurrentTimeInput.text);
    await storeValue('result', result, false);
    return result;
  }
}
