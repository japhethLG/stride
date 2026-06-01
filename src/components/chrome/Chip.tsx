/**
 * Chip — selectable/removable filter pill (ported verbatim from
 * design/project/stride-chrome.jsx `Chip`).
 */
import type { ReactNode } from "react";
import { Icon, type IconName } from "@/components/primitives";

export interface ChipProps {
  children?: ReactNode;
  active?: boolean;
  onClick?: () => void;
  icon?: IconName;
  onRemove?: () => void;
}

export function Chip({ children, active, onClick, icon, onRemove }: ChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        height: 34,
        padding: "0 13px",
        borderRadius: "var(--r-pill)",
        background: active ? "var(--accent-soft)" : "var(--surface-2)",
        border: `1px solid ${active ? "var(--accent)" : "var(--border)"}`,
        color: active ? "var(--accent)" : "var(--text-2)",
        fontWeight: 700,
        fontSize: 13,
        cursor: "pointer",
        whiteSpace: "nowrap",
        flexShrink: 0,
        fontFamily: "var(--font-body)",
      }}
    >
      {icon && <Icon name={icon} size={15} stroke={2.2} />}
      {children}
      {onRemove && (
        <span
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          style={{ display: "flex", marginLeft: 1 }}
        >
          <Icon name="x" size={13} stroke={2.6} />
        </span>
      )}
    </button>
  );
}
