import { useState } from 'react';
import { Sparkles, AlertTriangle, Loader2 } from 'lucide-react';
import type { CheckResult } from '@/types';
import {
  MockExplanationAdapter,
  resolveExplanation,
  type ExplanationAdapter,
  type MockFailureMode,
} from '@/lib/explanation';

interface Props {
  result: CheckResult | null;
  roomLabel: string;
  start: string;
  end: string;
  adapter?: ExplanationAdapter;
  failureMode?: MockFailureMode;
}

export function ExplanationSection({
  result,
  roomLabel,
  start,
  end,
  adapter,
  failureMode = 'none',
}: Props) {
  const [explanation, setExplanation] = useState<string | null>(null);
  const [usedFallback, setUsedFallback] = useState(false);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  if (!result) return null;

  async function handleExplain() {
    if (!result) return;
    const effectiveAdapter =
      adapter ?? new MockExplanationAdapter({ failureMode });
    setLoading(true);
    setFailed(false);
    setUsedFallback(false);
    try {
      const { text, usedFallback: fellBack } = await resolveExplanation(
        result,
        roomLabel.trim(),
        start,
        end,
        effectiveAdapter
      );
      setExplanation(text);
      setUsedFallback(fellBack);
      setFailed(fellBack);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-sm animate-[fadeIn_0.2s_ease]">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-blue-600" />
          Explain availability
        </h2>
        <button
          onClick={handleExplain}
          disabled={loading}
          className="px-4 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Generating…' : 'Explain availability'}
        </button>
      </div>

      {loading && (
        <p className="text-xs text-slate-500 flex items-center gap-2">
          <Loader2 className="w-3 h-3 animate-spin" />
          Generating explanation…
        </p>
      )}

      {!loading && explanation && (
        <div className="mt-1">
          <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-slate-700 leading-relaxed">
            {explanation}
          </div>
          {usedFallback && (
            <p className="mt-2 text-xs text-amber-700 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" />
              {failed
                ? 'The explanation service failed; showing a deterministic fallback from the booking result.'
                : 'Invalid explanation output; showing a deterministic fallback from the booking result.'}
            </p>
          )}
          <p className="mt-2 text-xs text-slate-400">
            AI-generated explanation (mock) — the booking status above is authoritative.
          </p>
        </div>
      )}
    </section>
  );
}
