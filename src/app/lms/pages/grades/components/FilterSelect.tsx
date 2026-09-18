// Labelled <select> used inside the grades filter drawer.
export default function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <div>
      <label className="mb-1.5 block text-2xs font-semibold uppercase tracking-wider text-subtle">{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="h-10 w-full rounded-control border border-hairline-strong bg-surface px-3 text-sm text-body focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15 cursor-pointer">
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}
