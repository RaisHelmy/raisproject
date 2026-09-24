import type { ModelDTO, ParameterDef } from "../../lib/types";

/**
 * Renders controls straight from the model's parameter definitions, so a model
 * that has no negative prompt simply does not show one (§9, §13, §155).
 */
export function ParameterControls(props: {
  model: ModelDTO;
  values: Record<string, unknown>;
  onChange: (name: string, value: unknown) => void;
  advanced: boolean;
}) {
  const params = props.model.parameters.filter((p) => (props.advanced ? true : !p.advanced));
  if (params.length === 0) {
    return <p className="text-secondary small">This model has no extra settings.</p>;
  }
  return (
    <div className="row g-3">
      {params.map((param) => (
        <div className="col-sm-6" key={param.name}>
          <Control param={param} value={props.values[param.name]} onChange={(v) => props.onChange(param.name, v)} />
        </div>
      ))}
    </div>
  );
}

function Control(props: { param: ParameterDef; value: unknown; onChange: (value: unknown) => void }) {
  const { param } = props;
  const id = `param-${param.name}`;
  const current = props.value ?? param.default ?? "";

  if (param.type === "boolean") {
    return (
      <div className="form-check form-switch">
        <input
          id={id}
          className="form-check-input"
          type="checkbox"
          checked={Boolean(props.value ?? param.default ?? false)}
          onChange={(e) => props.onChange(e.target.checked)}
        />
        <label className="form-check-label" htmlFor={id}>{param.label}</label>
        {param.help && <div className="form-text">{param.help}</div>}
      </div>
    );
  }

  if (param.type === "enum") {
    return (
      <>
        <label className="form-label" htmlFor={id}>{param.label}</label>
        <select id={id} className="form-select" value={String(current)} onChange={(e) => props.onChange(e.target.value)}>
          {param.options?.map((option) => (
            <option key={String(option.value)} value={String(option.value)}>{option.label}</option>
          ))}
        </select>
        {param.help && <div className="form-text">{param.help}</div>}
      </>
    );
  }

  if (param.type === "range") {
    return (
      <>
        <label className="form-label d-flex justify-content-between" htmlFor={id}>
          <span>{param.label}</span>
          <span className="text-secondary">{String(current)}</span>
        </label>
        <input
          id={id}
          type="range"
          className="form-range"
          min={param.min}
          max={param.max}
          step={param.step ?? 1}
          value={Number(current)}
          onChange={(e) => props.onChange(Number(e.target.value))}
        />
        {param.help && <div className="form-text">{param.help}</div>}
      </>
    );
  }

  if (param.type === "number") {
    return (
      <>
        <label className="form-label" htmlFor={id}>{param.label}</label>
        <input
          id={id}
          type="number"
          className="form-control"
          min={param.min}
          max={param.max}
          step={param.step ?? 1}
          value={current === "" ? "" : Number(current)}
          onChange={(e) => props.onChange(e.target.value === "" ? undefined : Number(e.target.value))}
        />
        {param.help && <div className="form-text">{param.help}</div>}
      </>
    );
  }

  return (
    <>
      <label className="form-label" htmlFor={id}>{param.label}</label>
      <input id={id} type="text" className="form-control" value={String(current)} onChange={(e) => props.onChange(e.target.value)} />
      {param.help && <div className="form-text">{param.help}</div>}
    </>
  );
}
