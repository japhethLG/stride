/**
 * Tag — small uppercase pill label (ported verbatim from
 * design/project/stride-ui.jsx `Tag`).
 */
import type { CSSProperties, ReactNode } from "react";
import { Icon, type IconName } from "./Icon";

export type TagTone = "neutral" | "accent" | "live" | "warn" | "danger" | "info";
export type TagSize = "sm" | "md";

export interface TagProps {
  children?: ReactNode;
  tone?: TagTone;
  size?: TagSize;
  icon?: IconName;
  style?: CSSProperties;
}

const TONES: Record<TagTone, { bg: string; fg: string }> = {
  neutral: { bg: "var(--surface-3)", fg: "var(--text-2)" },
  accent: { bg: "var(--accent-soft)", fg: "var(--accent)" },
  live: { bg: "var(--live-soft)", fg: "var(--live)" },
  warn: { bg: "var(--warn-soft)", fg: "var(--warn)" },
  danger: { bg: "var(--danger-soft)", fg: "var(--danger)" },
  info: { bg: "var(--info-soft)", fg: "var(--info)" },
};

export function Tag({ children, tone = "neutral", size = "md", icon, style }: TagProps) {
  const tones = TONES[tone];
  const fs = size === "sm" ? 10.5 : 11.5;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        background: tones.bg,
        color: tones.fg,
        padding: size === "sm" ? "2px 7px" : "3px 9px",
        borderRadius: "var(--r-pill)",
        fontSize: fs,
        fontWeight: 700,
        letterSpacing: ".4px",
        textTransform: "uppercase",
        lineHeight: 1.4,
        ...style,
      }}
    >
      {icon && <Icon name={icon} size={fs + 2} stroke={2.4} />}
      {children}
    </span>
  );
}
