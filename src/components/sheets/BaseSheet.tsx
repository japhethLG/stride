/**
 * BaseSheet — the mobile bottom-sheet shell (CLAUDE.md §9), ported from
 * design/project/stride-ui.jsx `Sheet`.
 *
 * Controlled via `open` + `onOpenChange(false)`. The sheet is **only mounted
 * when open** (`if (!open) return null`) — this is what guarantees a closed
 * sheet can never appear, on any platform. (An earlier version kept it mounted
 * and hid it with `transform: translateY(110%)` inside a `position:absolute`
 * wrapper; on Android Chrome the positioned-ancestor height chain collapsed, so
 * the closed panels weren't anchored to the viewport bottom and showed through —
 * every sheet on a page appeared "open". Mounting only when open + `position:
 * fixed` (viewport-anchored) removes that whole failure mode.) The open
 * animation runs on mount via the `strideSheetUp` / `strideScrimIn` keyframes.
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
  if (!open) return null;
  const close = () => onOpenChange(false);
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 60 }}>
      {/* scrim */}
      <div
        onClick={close}
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(0,0,0,.55)",
          animation: "strideScrimIn .2s var(--ease-out)",
        }}
      />
      {/* panel */}
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
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          animation: "strideSheetUp .3s var(--ease-out)",
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
