export default function ServingSelector({
  value, onChange, min = 1, max = 100,
}: { value: number; onChange: (v: number) => void; min?: number; max?: number }) {
  const presets = [1, 2, 4, 6, 10, 20, 50];
  return (
    <div>
      <div className="serving-stepper" role="group" aria-label="Number of servings">
        <button className="btn btn-outline-secondary" onClick={() => onChange(Math.max(min, value - 1))} aria-label="Fewer servings">−</button>
        <span className="serving-value" aria-live="polite">{value}</span>
        <button className="btn btn-outline-secondary" onClick={() => onChange(Math.min(max, value + 1))} aria-label="More servings">+</button>
      </div>
      <div className="d-flex flex-wrap gap-1 mt-2">
        {presets.map((p) => (
          <button
            key={p}
            className={`btn btn-sm ${p === value ? 'btn-primary' : 'btn-outline-secondary'}`}
            onClick={() => onChange(p)}
          >
            {p}
          </button>
        ))}
      </div>
    </div>
  );
}
