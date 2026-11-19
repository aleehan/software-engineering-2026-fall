interface Props {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

export function TimeInput({ label, value, onChange }: Props) {
  return (
    <div className="flex-1">
      <label className="block text-sm font-semibold text-slate-700 mb-2">
        {label}
      </label>
      <input
        type="time"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-slate-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
      />
    </div>
  );
}
