/**
 * Card — surface container (ported verbatim from design/project/stride-ui.jsx
 * `Card`). Pass `interactive` for the hover/press treatment (`.strideCard` in
 * styles/tokens.css).
 */
import type { CSSProperties, ReactNode } from "react";

export interface CardProps {
  children?: ReactNode;
  pad?: number | string;
  onClick?: () => void;
  style?: CSSProperties;
  interactive?: boolean;
}

export function Card({ children, pad = 16, onClick, style, interactive }: CardProps) {
  return (
    <div
      onClick={onClick}
      className={interactive ? "strideCard" : ""}
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r)",
        padding: pad,
        cursor: onClick ? "pointer" : "default",
        transition: "transform .12s var(--ease), background var(--dur)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}
