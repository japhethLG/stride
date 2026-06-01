/**
 * SectionHead — section title + optional "see all" action (ported verbatim from
 * design/project/stride-chrome.jsx `SectionHead`).
 */
import type { ReactNode } from "react";
import { Icon } from "@/components/primitives";

export interface SectionHeadProps {
  title: ReactNode;
  action?: ReactNode;
  onAction?: () => void;
}

export function SectionHead({ title, action, onAction }: SectionHeadProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        margin: "4px 0 12px",
      }}
    >
      <h2 style={{ fontSize: 21, fontWeight: 700, letterSpacing: ".3px", whiteSpace: "nowrap" }}>
        {title}
      </h2>
      {action && (
        <button
          type="button"
          onClick={onAction}
          style={{
            background: "none",
            border: "none",
            color: "var(--accent)",
            fontWeight: 700,
            fontSize: 13.5,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 2,
            whiteSpace: "nowrap",
            flexShrink: 0,
          }}
        >
          {action}
          <Icon name="chevR" size={15} stroke={2.4} />
        </button>
      )}
    </div>
  );
}
