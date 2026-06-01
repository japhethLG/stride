/**
 * Metric — inline stat numeral + unit, used in list rows (ported verbatim from
 * design/project/stride-chrome.jsx `Metric`). Uses the `.stat-num` type class.
 */
import type { ReactNode } from "react";

export interface MetricProps {
  /** Value. */
  v: ReactNode;
  /** Unit label. */
  u: ReactNode;
}

export function Metric({ v, u }: MetricProps) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 3 }}>
      <span className="stat-num" style={{ fontSize: 19 }}>
        {v}
      </span>
      <span style={{ fontSize: 11, color: "var(--text-3)", fontWeight: 600 }}>{u}</span>
    </div>
  );
}
