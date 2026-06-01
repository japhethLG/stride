/**
 * TopBar — screen header with optional back button + right-side slot (ported
 * verbatim from design/project/stride-chrome.jsx `TopBar`).
 */
import type { ReactNode } from "react";
import { IconBtn } from "@/components/primitives";

export interface TopBarProps {
  title?: ReactNode;
  onBack?: () => void;
  right?: ReactNode;
  sub?: ReactNode;
  /** When true, draws the bottom hairline (set as the content scrolls). */
  scrolled?: boolean;
}

export function TopBar({ title, onBack, right, sub, scrolled }: TopBarProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "8px 14px",
        minHeight: 56,
        flexShrink: 0,
        borderBottom: `1px solid ${scrolled ? "var(--border)" : "transparent"}`,
        background: "var(--bg)",
        position: "relative",
        zIndex: 10,
        transition: "border-color var(--dur)",
      }}
    >
      {onBack && <IconBtn name="chevL" onClick={onBack} size={40} iconSize={22} />}
      <div style={{ flex: 1, minWidth: 0 }}>
        {title && (
          <div
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 700,
              fontSize: 24,
              lineHeight: 1,
              letterSpacing: ".3px",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {title}
          </div>
        )}
        {sub && <div style={{ fontSize: 12.5, color: "var(--text-3)", marginTop: 2 }}>{sub}</div>}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>{right}</div>
    </div>
  );
}
