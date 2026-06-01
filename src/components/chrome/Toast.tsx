/**
 * Toast — transient bottom-centred message (ported verbatim from
 * design/project/stride-chrome.jsx `Toast`). Renders nothing when `msg` is
 * empty. Uses the `strideToast` keyframe in styles/tokens.css.
 */
import type { ReactNode } from "react";

export interface ToastProps {
  msg?: ReactNode;
}

export function Toast({ msg }: ToastProps) {
  if (!msg) return null;
  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        bottom: 96,
        transform: "translateX(-50%)",
        zIndex: 90,
        background: "var(--surface-3)",
        color: "var(--text)",
        padding: "11px 18px",
        borderRadius: "var(--r-pill)",
        fontSize: 13.5,
        fontWeight: 600,
        boxShadow: "var(--shadow)",
        border: "1px solid var(--border-strong)",
        maxWidth: "80%",
        textAlign: "center",
        animation: "strideToast .3s var(--ease-out)",
      }}
    >
      {msg}
    </div>
  );
}
