/**
 * Icon — the single icon primitive (CP4).
 *
 * Ported verbatim from design/project/stride-ui.jsx (`ICON_PATHS` + `Icon`). This
 * is the custom 24×24 stroke icon set used across the chrome + every screen; the
 * full path table is reproduced unchanged for pixel fidelity. Two icons render
 * bespoke SVG: `google` (multicolour mark) and `dot` (filled circle).
 *
 * Approved CP4 deviation: we do NOT use `lucide-react` (CLAUDE.md §1/§7) — the
 * design ships its own glyphs, so all icon access goes through this `<Icon>`.
 */
import type { CSSProperties } from "react";

/** 24×24 viewBox path data, keyed by icon name. Ported verbatim. */
export const ICON_PATHS = {
  home: "M3 10.8 12 4l9 6.8M5.5 9.4V20h13V9.4",
  route:
    "M6.5 19a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM17.5 9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM6.5 14V12a4 4 0 0 1 4-4h3a4 4 0 0 0 4-4",
  profile: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM5 20c0-3.3 3.1-5 7-5s7 1.7 7 5",
  play: "M7 5.5v13l11-6.5-11-6.5Z",
  pause: "M8 5.5v13M16 5.5v13",
  stop: "M6.5 6.5h11v11h-11z",
  target:
    "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM12 2v3M12 19v3M22 12h-3M5 12H2",
  locate:
    "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM12 2v3M12 19v3M22 12h-3M5 12H2",
  chevL: "M15 5l-7 7 7 7",
  chevR: "M9 5l7 7-7 7",
  chevD: "M5 9l7 7 7-7",
  chevU: "M5 15l7-7 7 7",
  arrowUR: "M7 17 17 7M9 7h8v8",
  plus: "M12 5v14M5 12h14",
  search: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14ZM20 20l-4-4",
  filter: "M3 5h18M6 12h12M10 19h4",
  sort: "M7 4v16M7 20l-3-3M7 4l3 3M17 20V4M17 4l-3 3M17 4l3 3",
  more: "M12 6h.01M12 12h.01M12 18h.01",
  share: "M14 9l4-4m0 0h-4m4 0v4M20 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5",
  bell: "M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6M10 20a2 2 0 0 0 4 0",
  mail: "M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7ZM3.5 7.5l8.5 6 8.5-6",
  settings:
    "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM19 12a7 7 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7 7 0 0 0-2-1.2l-.4-2.6H10.9l-.4 2.6a7 7 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6A7 7 0 0 0 5 12a7 7 0 0 0 .1 1.2l-2 1.6 2 3.4 2.4-1a7 7 0 0 0 2 1.2l.4 2.6h3.2l.4-2.6a7 7 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6A7 7 0 0 0 19 12Z",
  signout: "M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4M11 16l4-4-4-4M15 12H4",
  check: "M5 12.5 10 17.5 19.5 7",
  checkCircle: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM8.5 12l2.5 2.5L15.5 9",
  x: "M6 6l12 12M18 6 6 18",
  xCircle: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM9 9l6 6M15 9l-6 6",
  trophy:
    "M7 4h10v4a5 5 0 0 1-10 0V4ZM7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 1-3 3M9 14h6M10 14l-.5 4M14 14l.5 4M8 20h8",
  medal: "M12 14a5 5 0 1 0 0-10 5 5 0 0 0 0 10ZM12 14v7l-3-2-3 2M12 14l3 7 3-2 3 2",
  flag: "M6 21V4M6 4h11l-2 4 2 4H6",
  mountain: "M3 19h18L14 7l-3 5-2-3-6 10Z",
  clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 7v5l3 2",
  gauge: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 12l4-3M12 12a1.5 1.5 0 1 0 0 3",
  ruler: "M4 8l12-4 4 12-12 4L4 8ZM8 8l1 2M11 7l1.5 3M14 6l1 2",
  users:
    "M9 12a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM3 20c0-3 2.7-4.5 6-4.5s6 1.5 6 4.5M16 5.5a3.5 3.5 0 0 1 0 7M18 15.5c2 .6 3 1.9 3 4.5",
  crown: "M4 18h16M4 18l-1.5-9 5 4L12 5l4.5 8 5-4L20 18",
  bolt: "M13 3 4 14h6l-1 7 9-11h-6l1-7Z",
  google: "",
  eye: "M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z",
  gps: "M12 13a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM5 5l3.5 3.5M19 5l-3.5 3.5M5 19l3.5-3.5M19 19l-3.5-3.5M12 2v2M12 20v2M2 12h2M20 12h2",
  refresh: "M20 11a8 8 0 1 0-1.5 5.5M20 6v5h-5",
  edit: "M4 20h4L19 9l-4-4L4 16v4ZM14 6l4 4",
  trash: "M5 7h14M9 7V4h6v3M6 7l1 13h10l1-13",
  camera: "M3 8a2 2 0 0 1 2-2h2l1.5-2h7L19 6h0a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8ZM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z",
  lock: "M6 11V8a6 6 0 0 1 12 0v3M5 11h14v9H5z",
  calendar: "M4 6h16v15H4zM4 10h16M8 3v4M16 3v4",
  heart: "M12 20S4 14.5 4 9a4 4 0 0 1 8-1 4 4 0 0 1 8 1c0 5.5-8 11-8 11Z",
  map: "M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2ZM9 4v14M15 6v14",
  wifi: "M2 9a14 14 0 0 1 20 0M5 12.5a9 9 0 0 1 14 0M8.5 16a4 4 0 0 1 7 0M12 20h.01",
  signal: "M3 17h3v3H3zM9 12h3v8H9zM15 8h3v12h-3z",
  shoe: "M3 16v-4l3-1 2-4 4 3 6 1c2 .4 3 1.6 3 3v2H3ZM3 14h18",
  sparkle: "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z",
  info: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 11v5M12 8h.01",
  warning: "M12 4 2 20h20L12 4ZM12 10v4M12 17h.01",
  star: "M12 4l2.4 5 5.6.8-4 3.9 1 5.5L12 16.6 7 19.2l1-5.5-4-3.9 5.6-.8L12 4Z",
  dot: "",
} as const;

/** Every supported icon name. */
export type IconName = keyof typeof ICON_PATHS;

export interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
  stroke?: number;
  fill?: boolean;
  style?: CSSProperties;
}

export function Icon({
  name,
  size = 22,
  color = "currentColor",
  stroke = 2,
  fill = false,
  style,
}: IconProps) {
  if (name === "google") {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" style={style} aria-hidden="true">
        <path
          fill="#4285F4"
          d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.3Z"
        />
        <path
          fill="#34A853"
          d="M12 22c2.7 0 5-.9 6.6-2.5l-3.2-2.5c-.9.6-2 .9-3.4.9-2.6 0-4.8-1.7-5.6-4.1H3.1v2.6A10 10 0 0 0 12 22Z"
        />
        <path
          fill="#FBBC05"
          d="M6.4 13.8a6 6 0 0 1 0-3.6V7.6H3.1a10 10 0 0 0 0 8.8l3.3-2.6Z"
        />
        <path
          fill="#EA4335"
          d="M12 6.2c1.5 0 2.8.5 3.8 1.5l2.8-2.8A10 10 0 0 0 3.1 7.6l3.3 2.6C7.2 7.9 9.4 6.2 12 6.2Z"
        />
      </svg>
    );
  }
  if (name === "dot") {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" style={style} aria-hidden="true">
        <circle cx="12" cy="12" r="5" fill={color} />
      </svg>
    );
  }
  const d = ICON_PATHS[name] || "";
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style} aria-hidden="true">
      <path
        d={d}
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill={fill ? color : "none"}
      />
    </svg>
  );
}
