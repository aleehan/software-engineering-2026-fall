import type { Room } from '@/types';
import { fmt } from '@/lib/availability';

interface Props {
  room: Room | null;
  candidateStart: number | null;
  candidateEnd: number | null;
}

export function BookingTimeline({ room, candidateStart, candidateEnd }: Props) {
  if (!room) return null;

  return (
    <div>
      <p className="text-sm font-semibold text-slate-700 mb-3">
        Today's Schedule — {room.name}
      </p>
      <div className="relative h-14 bg-slate-100 rounded-lg overflow-hidden">
        {/* Hour gridlines */}
        {Array.from({ length: 25 }).map((_, h) => (
          <div
            key={h}
            className="absolute top-0 bottom-0 border-l border-slate-200"
            style={{ left: `${(h / 24) * 100}%` }}
          />
        ))}

        {/* Existing bookings */}
        {room.bookings.map((b) => (
          <div
            key={b.id}
            className="absolute top-1 bottom-1 rounded bg-slate-400/80 px-1 flex items-center overflow-hidden"
            style={{
              left: `${(b.start / 1440) * 100}%`,
              width: `${((b.end - b.start) / 1440) * 100}%`,
            }}
            title={`${fmt(b.start)}–${fmt(b.end)}: ${b.bookedBy}`}
          >
            <span className="text-[10px] text-white font-medium truncate">
              {fmt(b.start)}–{fmt(b.end)}
            </span>
          </div>
        ))}

        {/* Candidate interval */}
        {candidateStart !== null && candidateEnd !== null && (
          <div
            className="absolute top-0 bottom-0 rounded border-2 border-dashed border-blue-500 bg-blue-200/40"
            style={{
              left: `${(candidateStart / 1440) * 100}%`,
              width: `${Math.max(0, (candidateEnd - candidateStart) / 1440) * 100}%`,
            }}
          />
        )}
      </div>

      <div className="flex justify-between text-[10px] text-slate-400 mt-1">
        <span>00:00</span>
        <span>06:00</span>
        <span>12:00</span>
        <span>18:00</span>
        <span>24:00</span>
      </div>

      <div className="flex items-center gap-4 mt-3 text-xs text-slate-500">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-slate-400/80 inline-block" />
          Existing bookings
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded border-2 border-dashed border-blue-500 bg-blue-200/40 inline-block" />
          Your request
        </span>
      </div>
    </div>
  );
}
