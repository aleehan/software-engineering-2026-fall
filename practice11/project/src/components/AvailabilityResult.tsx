import { CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import type { CheckResult } from '@/types';

interface Props {
  result: CheckResult | null;
}

export function AvailabilityResult({ result }: Props) {
  if (!result) return null;

  if (result.status === 'available') {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 p-5 flex items-center gap-3 animate-[fadeIn_0.2s_ease]">
        <CheckCircle2 className="w-6 h-6 text-green-600 flex-shrink-0" />
        <div>
          <p className="font-semibold text-green-800">Available</p>
          <p className="text-sm text-green-700">
            This time slot is open — you can proceed with your booking.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-5 animate-[fadeIn_0.2s_ease]">
      <div className="flex items-center gap-3 mb-2">
        <XCircle className="w-6 h-6 text-red-600 flex-shrink-0" />
        <p className="font-semibold text-red-800">Unavailable</p>
      </div>
      <ul className="space-y-1.5 ml-9">
        {result.reasons.map((r, i) => (
          <li key={i} className="text-sm text-red-700 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            {r}
          </li>
        ))}
      </ul>
    </div>
  );
}
