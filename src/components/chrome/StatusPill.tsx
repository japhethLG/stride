/**
 * StatusPill — GPS / connection status pill, overlaid on the map (ported
 * verbatim from design/project/stride-chrome.jsx `StatusPill`).
 */
import type { ReactNode } from "react";

export type StatusPillTone = "live" | "warn" | "danger" | "neutral";

export interface StatusPillProps {
  tone?: StatusPillTone;
  children?: ReactNode;
}

const DOT: Record<StatusPillTone, string> = {
  live: "var(--live)",
  warn: "var(--warn)",
  danger: "var(--danger)",
  neutral: "var(--text-2)",
};

export function StatusPill({ tone = "live", children }: StatusPillProps) {
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        height: 30,
        padding: "0 11px",
        borderRadius: "var(--r-pill)",
        background: "rgba(0,0,0,.4)",
        backdropFilter: "blur(8px)",
        border: "1px solid var(--border)",
        color: "#fff",
        fontSize: 12,
        fontWeight: 700,
        whiteSpace: "nowrap",
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: DOT[tone],
          boxShadow: `0 0 8px ${DOT[tone]}`,
        }}
      />
      {children}
    </div>
  );
}
