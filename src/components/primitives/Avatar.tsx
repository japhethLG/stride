/**
 * Avatar — circular avatar with image or generated initials/colour (ported
 * verbatim from design/project/stride-ui.jsx `Avatar`).
 */
export interface AvatarProps {
  name?: string;
  src?: string;
  size?: number;
  color?: string;
  ring?: string;
}

const COLORS = ["#FF4D2E", "#5B8CFF", "#00E07A", "#FFB020", "#C879FF", "#FF6FB5", "#21D4C4"];

export function Avatar({ name, src, size = 40, color, ring }: AvatarProps) {
  const initials = (name || "?")
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const bg = color || COLORS[(name || "").charCodeAt(0) % COLORS.length] || COLORS[0];
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        flexShrink: 0,
        overflow: "hidden",
        background: src ? `center/cover url(${src})` : bg,
        color: "#fff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "var(--font-display)",
        fontWeight: 700,
        fontSize: size * 0.4,
        boxShadow: ring ? `0 0 0 2px var(--bg), 0 0 0 4px ${ring}` : "none",
      }}
    >
      {!src && initials}
    </div>
  );
}
