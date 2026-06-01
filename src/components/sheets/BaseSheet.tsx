/**
 * BaseSheet — the mobile bottom-sheet shell (CLAUDE.md §9), ported verbatim from
 * design/project/stride-ui.jsx `Sheet`.
 *
 * Visuals are unchanged: scrim, rounded top, drag handle, optional title row with
 * a close button, and a scrollable body. Additions for the production sheet
 * system:
 *   - controlled via `open` + `onOpenChange(false)` (the §9 sheet host injects
 *     these; local callers pass them directly). The design's `onClose` maps to
 *     `onOpenChange(false)`.
 *   - optional `footer` slot pinned to the bottom with iOS safe-area padding
 *     (`env(safe-area-inset-bottom)`).
 *
 * This is the BASE shell only — concrete sheets wrap it (`<Name>Sheet.tsx`) and
 * register with the sheet registry/host in CP5.
 */
import type { ReactNode } from "react";
import { IconBtn } from "@/components/primitives";

export interface BaseSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children?: ReactNode;
  title?: ReactNode;
  /** Snap height (e.g. 420 or "60%"); defaults to content height, capped at 88%. */
  height?: number | string;
  /** Pinned footer (e.g. a primary action). Gets safe-area bottom padding. */
  footer?: ReactNode;
}

export function BaseSheet({ open, onOpenChange, children, title, height, footer }: BaseSheetProps) {
  const close = () => onOpenChange(false);
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 60,
        pointerEvents: open ? "auto" : "none",
      }}
    >
      <div
        onClick={close}
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(0,0,0,.55)",
          opacity: open ? 1 : 0,
          transition: "opacity var(--dur)",
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          maxHeight: "88%",
          height,
          background: "var(--surface)",
          borderRadius: "24px 24px 0 0",
          border: "1px solid var(--border)",
          transform: open ? "translateY(0)" : "translateY(110%)",
          transition: "transform .34s var(--ease-out)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <div style={{ padding: "12px 0 4px", display: "flex", justifyContent: "center" }}>
          <div style={{ width: 40, height: 4, borderRadius: 2, background: "var(--border-strong)" }} />
        </div>
        {title && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "6px 20px 12px",
            }}
          >
            <h3 style={{ fontSize: 22 }}>{title}</h3>
            <IconBtn name="x" onClick={close} size={34} iconSize={18} />
          </div>
        )}
        <div style={{ overflow: "auto", padding: "0 20px 24px", flex: 1 }}>{children}</div>
        {footer && (
          <div
            style={{
              flexShrink: 0,
              padding: "12px 20px",
              paddingBottom: "calc(12px + env(safe-area-inset-bottom, 0px))",
              borderTop: "1px solid var(--border)",
              background: "var(--surface)",
            }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
