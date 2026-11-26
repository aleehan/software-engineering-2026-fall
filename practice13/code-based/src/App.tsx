import { useMemo, useState } from 'react';
import { Clock, DoorOpen, CalendarClock } from 'lucide-react';
import type { CheckResult } from '@/types';
import { sampleRooms } from '@/data/sampleRooms';
import { checkRequest } from '@/lib/contract';
import { fmt, parseTime } from '@/lib/availability';
import { RoomSelector } from '@/components/RoomSelector';
import { TimeInput } from '@/components/TimeInput';
import { DurationInput } from '@/components/DurationInput';
import { BookingTimeline } from '@/components/BookingTimeline';
import { AvailabilityResult } from '@/components/AvailabilityResult';
import { ExplanationSection } from '@/components/ExplanationSection';

function App() {
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [currentTimeStr, setCurrentTimeStr] = useState('09:00');
  const [startTime, setStartTime] = useState('');
  const [durationStr, setDurationStr] = useState('');
  const [result, setResult] = useState<CheckResult | null>(null);

  const currentTime = parseTime(currentTimeStr);

  const selectedRoom = useMemo(
    () => sampleRooms.find((r) => r.id === selectedRoomId) ?? null,
    [selectedRoomId]
  );

  const candidateStart = startTime ? parseTime(startTime) : null;
  const durationNum = durationStr === '' ? null : Number(durationStr);
  const validDuration =
    durationNum !== null && Number.isInteger(durationNum) && durationNum > 0;
  const candidateEnd =
    candidateStart !== null && validDuration
      ? candidateStart + durationNum
      : null;

  function handleCheck() {
    const contractResult = checkRequest(
      selectedRoom,
      startTime,
      durationNum ?? NaN,
      currentTime
    );
    setResult({
      status: contractResult.available ? 'available' : 'unavailable',
      reasons: [`${contractResult.reasonCode}: ${contractResult.message}`],
    });
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100">
      <style>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }`}</style>

      {/* Header */}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center">
            <DoorOpen className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-800">
              Smart Campus Room Availability
            </h1>
            <p className="text-xs text-slate-500 flex items-center gap-1">
              <Clock className="w-3 h-3" /> Current time (simulated):{' '}
              {fmt(currentTime)}
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Room Selection */}
        <section className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-sm">
          <RoomSelector
            rooms={sampleRooms}
            selectedId={selectedRoomId}
            onSelect={(id) => {
              setSelectedRoomId(id);
              setResult(null);
            }}
          />
        </section>

        {/* Time Input */}
        <section className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-sm">
          <label className="block text-sm font-semibold text-slate-700 mb-3">
            Requested Time Interval
          </label>
          <div className="flex flex-col sm:flex-row gap-4">
            <TimeInput label="Current Time" value={currentTimeStr} onChange={(v) => { setCurrentTimeStr(v); setResult(null); }} />
            <TimeInput label="Start Time" value={startTime} onChange={(v) => { setStartTime(v); setResult(null); }} />
            <DurationInput label="Duration (minutes)" value={durationStr} onChange={(v) => { setDurationStr(v); setResult(null); }} />
          </div>

          <button
            onClick={handleCheck}
            disabled={!selectedRoomId}
            className="mt-4 w-full sm:w-auto px-6 py-2.5 rounded-lg bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            <CalendarClock className="w-4 h-4" />
            Check Availability
          </button>
        </section>

        {/* Timeline */}
        {selectedRoom && (
          <section className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-sm">
            <BookingTimeline
              room={selectedRoom}
              candidateStart={candidateStart}
              candidateEnd={candidateEnd}
            />
          </section>
        )}

        {/* Result */}
        {result && (
          <section>
            <AvailabilityResult result={result} />
          </section>
        )}

        {/* Explain availability (mock) */}
        {result && selectedRoom && (
          <ExplanationSection
            result={result}
            roomLabel={selectedRoom.name}
            start={startTime}
            end={candidateEnd !== null && startTime ? fmt(candidateEnd) : ''}
          />
        )}
      </main>

      <footer className="max-w-3xl mx-auto px-4 sm:px-6 py-8 text-center text-xs text-slate-400">
        Sample data for demonstration · No real bookings are created
      </footer>
    </div>
  );
}

export default App;
