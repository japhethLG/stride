/**
 * Segmented — pill segmented control (ported verbatim from
 * design/project/stride-ui.jsx `Segmented`). Options may be plain strings or
 * `{ value, label }` objects.
 */
import type { CSSProperties } from "react";

export type SegmentedOption = string | { value: string; label: string };

export interface SegmentedProps {
  options: SegmentedOption[];
  value: string;
  onChange: (value: string) => void;
  style?: CSSProperties;
}

export function Segmented({ options, value, onChange, style }: SegmentedProps) {
  return (
    <div
      style={{
        display: "flex",
        background: "var(--surface-2)",
        borderRadius: "var(--r-pill)",
        padding: 4,
        border: "1px solid var(--border)",
        gap: 2,
        ...style,
      }}
    >
      {options.map((opt) => {
        const v = typeof opt === "string" ? opt : opt.value;
        const label = typeof opt === "string" ? opt : opt.label;
        const on = v === value;
        return (
          <button
            type="button"
            key={v}
            onClick={() => onChange(v)}
            style={{
              flex: 1,
              height: 34,
              border: "none",
              borderRadius: "var(--r-pill)",
              cursor: "pointer",
              background: on ? "var(--accent)" : "transparent",
              color: on ? "var(--on-accent)" : "var(--text-2)",
              fontFamily: "var(--font-body)",
              fontWeight: 700,
              fontSize: 13,
              letterSpacing: ".3px",
              transition: "background var(--dur), color var(--dur)",
              whiteSpace: "nowrap",
              padding: "0 8px",
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
