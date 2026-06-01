/**
 * Spinner — ported verbatim from design/project/stride-ui.jsx (`Spinner`).
 * Relies on the `strideSpin` keyframe in styles/tokens.css.
 */
export interface SpinnerProps {
  size?: number;
  color?: string;
}

export function Spinner({ size = 18, color = "currentColor" }: SpinnerProps) {
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        display: "inline-block",
        border: `2.5px solid ${color}`,
        borderTopColor: "transparent",
        opacity: 0.9,
        animation: "strideSpin .7s linear infinite",
      }}
    />
  );
}
