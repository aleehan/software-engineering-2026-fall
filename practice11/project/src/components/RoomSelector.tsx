import { Users, Lock, MapPin } from 'lucide-react';
import type { Room } from '@/types';

interface Props {
  rooms: Room[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function RoomSelector({ rooms, selectedId, onSelect }: Props) {
  return (
    <div>
      <label className="block text-sm font-semibold text-slate-700 mb-3">
        Select a Room
      </label>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {rooms.map((room) => {
          const active = room.id === selectedId;
          return (
            <button
              key={room.id}
              onClick={() => onSelect(room.id)}
              className={[
                'text-left rounded-xl border p-4 transition-all duration-200',
                active
                  ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm',
              ].join(' ')}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-slate-800">{room.name}</p>
                  <p className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                    <MapPin className="w-3 h-3" /> {room.building}
                  </p>
                </div>
                {room.blocked && (
                  <span className="flex items-center gap-1 text-xs font-medium text-red-600 bg-red-50 px-2 py-1 rounded-full">
                    <Lock className="w-3 h-3" /> Blocked
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 flex items-center gap-1 mt-2">
                <Users className="w-3 h-3" /> {room.capacity} seats
                <span className="mx-1">·</span>
                {room.bookings.length} booking{room.bookings.length !== 1 ? 's' : ''} today
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
