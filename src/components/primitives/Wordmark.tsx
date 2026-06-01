/**
 * StrideMark + Wordmark — brand glyph + logotype (ported verbatim from
 * design/project/stride-ui.jsx `StrideMark` / `Wordmark`).
 */

export interface StrideMarkProps {
  size?: number;
  color?: string;
}

/** Forward-leaning chevron stack — the motion/stride glyph. */
export function StrideMark({ size = 28, color = "var(--accent)" }: StrideMarkProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <path
        d="M6 22 L15 22 L19 14"
        stroke={color}
        strokeWidth="3.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M11 26 L22 26 L27 16 L21 6"
        stroke={color}
        strokeWidth="3.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.55"
      />
    </svg>
  );
}

export interface WordmarkProps {
  size?: number;
  color?: string;
  accent?: string;
}

export function Wordmark({ size = 30, color = "var(--text)", accent = "var(--accent)" }: WordmarkProps) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: size * 0.28 }}>
      <StrideMark size={size * 1.05} color={accent} />
      <span
        style={{
          fontFamily: "var(--font-display)",
          fontWeight: 800,
          fontSize: size,
          letterSpacing: "1.5px",
          color,
          lineHeight: 1,
          textTransform: "uppercase",
        }}
      >
        Stride
      </span>
    </span>
  );
}
