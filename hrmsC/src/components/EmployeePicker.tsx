import { useEffect, useRef, useState } from "react";
import { api } from "../api/client";
import type { Employee } from "../types";

/** Typeahead replacement for a plain `<select>` of employees — old_project's
 * PeoplePicker/MultiPeoplePicker equivalent, searching server-side via the
 * existing /employees?q= endpoint rather than shipping the whole directory
 * to the client. */
export function EmployeePicker({
  value,
  onChange,
  excludeId,
  placeholder = "Search employee…",
}: {
  value: string;
  onChange: (employeeId: string) => void;
  excludeId?: string;
  placeholder?: string;
}) {
  const [query, setQuery] = useState("");
  const [selectedLabel, setSelectedLabel] = useState("");
  const [results, setResults] = useState<Employee[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!value) {
      setSelectedLabel("");
      return;
    }
    api
      .get<{ employee: Employee }>(`/employees/${value}`)
      .then((res) => setSelectedLabel(`${res.employee.full_name} (${res.employee.employee_no})`))
      .catch(() => {});
  }, [value]);

  useEffect(() => {
    if (!open) return;
    const handle = setTimeout(() => {
      const params = new URLSearchParams();
      if (query) params.set("q", query);
      api
        .get<{ employees: Employee[] }>(`/employees?${params.toString()}`)
        .then((res) => setResults(res.employees.filter((e) => e.id !== excludeId).slice(0, 20)));
    }, 200);
    return () => clearTimeout(handle);
  }, [query, open, excludeId]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  function select(emp: Employee) {
    onChange(emp.id);
    setSelectedLabel(`${emp.full_name} (${emp.employee_no})`);
    setOpen(false);
  }

  return (
    <div className="position-relative" ref={ref}>
      <div className="input-group">
        <input
          className="form-control"
          placeholder={placeholder}
          value={open ? query : selectedLabel}
          onFocus={() => {
            setOpen(true);
            setQuery("");
          }}
          onChange={(e) => setQuery(e.target.value)}
        />
        {value && (
          <button
            type="button"
            className="btn btn-outline-secondary"
            onClick={() => {
              onChange("");
              setSelectedLabel("");
            }}
          >
            <i className="bi bi-x" />
          </button>
        )}
      </div>
      {open && (
        <ul className="list-group position-absolute w-100 shadow-sm" style={{ zIndex: 1050, maxHeight: 240, overflowY: "auto" }}>
          {results.map((emp) => (
            <li
              key={emp.id}
              className="list-group-item list-group-item-action"
              style={{ cursor: "pointer" }}
              onClick={() => select(emp)}
            >
              {emp.full_name} <span className="text-secondary small">({emp.employee_no})</span>
            </li>
          ))}
          {results.length === 0 && <li className="list-group-item text-secondary small">No matches</li>}
        </ul>
      )}
    </div>
  );
}
