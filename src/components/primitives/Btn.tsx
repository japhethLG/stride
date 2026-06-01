/**
 * Btn — primary action button (ported verbatim from
 * design/project/stride-ui.jsx `Btn`). Inline-style + CSS-token visuals; the
 * press-scale micro-interaction is preserved via the mouse handlers.
 */
import type { CSSProperties, ReactNode } from "react";
import { Icon, type IconName } from "./Icon";
import { Spinner } from "./Spinner";

export type BtnVariant =
  | "primary"
  | "solidLive"
  | "secondary"
  | "ghost"
  | "danger"
  | "quiet";
export type BtnSize = "sm" | "md" | "lg";

export interface BtnProps {
  children?: ReactNode;
  variant?: BtnVariant;
  size?: BtnSize;
  icon?: IconName;
  full?: boolean;
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
  style?: CSSProperties;
}

const SIZES: Record<BtnSize, { h: number; px: number; fs: number }> = {
  sm: { h: 38, px: 14, fs: 14 },
  md: { h: 50, px: 20, fs: 16 },
  lg: { h: 58, px: 24, fs: 18 },
};

const VARIANTS: Record<BtnVariant, CSSProperties> = {
  primary: { background: "var(--accent)", color: "var(--on-accent)", border: "none" },
  solidLive: { background: "var(--live)", color: "#04130C", border: "none" },
  secondary: { background: "var(--surface-3)", color: "var(--text)", border: "1px solid var(--border)" },
  ghost: { background: "transparent", color: "var(--text)", border: "1px solid var(--border-strong)" },
  danger: { background: "var(--danger-soft)", color: "var(--danger)", border: "1px solid transparent" },
  quiet: { background: "transparent", color: "var(--text-2)", border: "none" },
};

export function Btn({
  children,
  variant = "primary",
  size = "md",
  icon,
  full,
  onClick,
  disabled,
  loading,
  style,
}: BtnProps) {
  const sizes = SIZES[size];
  const variants = VARIANTS[variant];
  return (
    <button
      type="button"
      onClick={disabled || loading ? undefined : onClick}
      disabled={disabled || loading}
      style={{
        height: sizes.h,
        padding: `0 ${sizes.px}px`,
        fontSize: sizes.fs,
        fontWeight: 700,
        fontFamily: "var(--font-body)",
        borderRadius: "var(--r-pill)",
        cursor: disabled ? "not-allowed" : "pointer",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 9,
        width: full ? "100%" : "auto",
        opacity: disabled ? 0.45 : 1,
        whiteSpace: "nowrap",
        transition: "transform .12s var(--ease), filter var(--dur)",
        letterSpacing: ".2px",
        ...variants,
        ...style,
      }}
      onMouseDown={(e) => {
        if (!disabled) e.currentTarget.style.transform = "scale(.97)";
      }}
      onMouseUp={(e) => {
        e.currentTarget.style.transform = "scale(1)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "scale(1)";
      }}
    >
      {loading ? (
        <Spinner color={variants.color as string} />
      ) : (
        icon && <Icon name={icon} size={sizes.fs + 3} stroke={2.2} />
      )}
      {children}
    </button>
  );
}
