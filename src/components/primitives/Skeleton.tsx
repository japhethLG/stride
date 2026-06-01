/**
 * Skeleton — loading placeholder bar (ported verbatim from
 * design/project/stride-ui.jsx `Skeleton`). Uses the `stridePulse` keyframe in
 * styles/tokens.css.
 */
import type { CSSProperties } from "react";

export interface SkeletonProps {
  w?: number | string;
  h?: number | string;
  r?: number | string;
  style?: CSSProperties;
}

export function Skeleton({ w = "100%", h = 16, r = 8, style }: SkeletonProps) {
  return (
    <div
      style={{
        width: w,
        height: h,
        borderRadius: r,
        background: "var(--surface-3)",
        animation: "stridePulse 1.4s ease-in-out infinite",
        ...style,
      }}
    />
  );
}
