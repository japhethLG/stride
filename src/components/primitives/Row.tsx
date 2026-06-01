/**
 * Row — flex row helper (ported verbatim from design/project/stride-ui.jsx
 * `Row`).
 */
import type { CSSProperties, ReactNode } from "react";

export interface RowProps {
  children?: ReactNode;
  onClick?: () => void;
  style?: CSSProperties;
  gap?: number | string;
  pad?: number | string;
}

export function Row({ children, onClick, style, gap = 12, pad }: RowProps) {
  return (
    <div
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap,
        padding: pad,
        cursor: onClick ? "pointer" : "default",
        ...style,
      }}
    >
      {children}
    </div>
  );
}
