/**
 * StatBlock — big condensed stat numeral + unit + eyebrow label (ported verbatim
 * from design/project/stride-ui.jsx `StatBlock`). Uses the `.stat-num` /
 * `.eyebrow` type classes from styles/tokens.css.
 */
import type { ReactNode } from "react";

export type StatBlockSize = "sm" | "md" | "lg" | "xl";
export type StatBlockAlign = "center" | "left";

export interface StatBlockProps {
  value: ReactNode;
  unit?: ReactNode;
  label?: ReactNode;
  accent?: boolean;
  size?: StatBlockSize;
  align?: StatBlockAlign;
}

const FS: Record<StatBlockSize, number> = { sm: 34, md: 52, lg: 88, xl: 120 };

export function StatBlock({
  value,
  unit,
  label,
  accent,
  size = "md",
  align = "center",
}: StatBlockProps) {
  const fs = FS[size];
  return (
    <div style={{ textAlign: align, minWidth: 0 }}>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 4,
          justifyContent: align === "center" ? "center" : "flex-start",
        }}
      >
        <span className="stat-num" style={{ fontSize: fs, color: accent ? "var(--accent)" : "var(--text)" }}>
          {value}
        </span>
        {unit && (
          <span
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 600,
              fontSize: fs * 0.32,
              color: "var(--text-3)",
            }}
          >
            {unit}
          </span>
        )}
      </div>
      {label && (
        <div className="eyebrow" style={{ marginTop: 4 }}>
          {label}
        </div>
      )}
    </div>
  );
}
