/**
 * Shared helpers for the routes cluster pages (CP5).
 *
 * Ported from the design's local helpers in
 * design/project/screens-routes.jsx (`fmtGap`, `ElevationChart`, `LeaderRow`,
 * the medal-colour table) + small adapters that convert the REAL backend DTOs
 * (BigInt-string `elapsedMs`, `[lng,lat]` geometry, `elevationProfile`) into the
 * shapes the verbatim visuals expect. Kept in one spot so RouteDetail /
 * Leaderboard / Members don't each re-derive them.
 */
import { Icon, Avatar, Row } from "@/components/primitives";
import { fmtTime, distUnit, type Units } from "@/lib/format";
import type { GeoJsonLineStringDto } from "@/lib/api/types";

/** Medal colours for ranks 1..3 (design verbatim). */
export const MEDAL_COLORS = ["#FFD24A", "#C7CDD6", "#E0915A"] as const;

/** Coerce the generator's `Record<string,never> | null` "string" fields to a real string. */
export function asText(v: unknown): string {
  return typeof v === "string" ? v : "";
}

/** Coerce the generator's `Record<string,never> | null` "number" fields to a real number. */
export function asNum(v: unknown): number {
  return typeof v === "number" ? v : 0;
}

/** Parse a BigInt-as-string field (durationMs / elapsedMs) to seconds. */
export function msStringToSeconds(ms: string | number | null | undefined): number {
  const n = typeof ms === "string" ? Number(ms) : (ms ?? 0);
  return Number.isFinite(n) ? Math.round(n / 1000) : 0;
}

/** GeoJSON LineString `[lng,lat][]` → MapView coords (already in that order). */
export function lineCoords(geom: GeoJsonLineStringDto | null | undefined): [number, number][] {
  const c = geom?.coordinates;
  if (!Array.isArray(c)) return [];
  return c
    .filter((p) => Array.isArray(p) && p.length >= 2)
    .map((p) => [p[0], p[1]] as [number, number]);
}

/**
 * Gap between two efforts (seconds), formatted like the design's `fmtGap`:
 * `"M:SS"` when ≥ 1 min, else `"Ns"`.
 */
export function fmtGapSeconds(seconds: number): string {
  const d = Math.max(0, Math.round(seconds));
  const m = Math.floor(d / 60);
  const sec = d % 60;
  return (m ? m + ":" : "") + String(sec).padStart(m ? 2 : 1, "0") + (m ? "" : "s");
}

/** Average pace in seconds-per-km from elapsed seconds + distance (m). */
export function paceSPerKm(elapsedS: number, distanceM: number): number | null {
  if (!distanceM || distanceM <= 0) return null;
  return elapsedS / (distanceM / 1000);
}

/** Pace per active unit, formatted `M:SS` (converts to per-mile for imperial). */
export function fmtPaceUnit(sPerKm: number | null, units: Units): string {
  if (sPerKm == null) return "--:--";
  const per = units === "imperial" ? sPerKm / 0.621371 : sPerKm;
  const m = Math.floor(per / 60);
  const sec = Math.round(per % 60);
  return `${m}:${String(sec).padStart(2, "0")}`;
}

/** Short date label from an ISO timestamp (e.g. "May 02"). */
export function shortDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { month: "short", day: "2-digit" });
}

/**
 * ElevationChart — ported verbatim from design/project/screens-routes.jsx.
 *
 * The design generated a seeded random profile; here we render the REAL
 * `elevationProfile` samples (`[{distM,eleM}]`) when present. The SVG shape /
 * gradient styling is unchanged. Falls back to a flat baseline when there are no
 * samples (e.g. a freshly-snapped route without a profile yet).
 */
export function ElevationChart({
  profile,
  color = "var(--accent)",
  h = 64,
  id = "eg",
}: {
  profile?: { distM?: number; eleM?: number }[] | null;
  color?: string;
  h?: number;
  id?: string;
}) {
  const eles = (profile ?? [])
    .map((p) => (typeof p.eleM === "number" ? p.eleM : null))
    .filter((v): v is number => v != null);

  // Map real elevations to the 10..90 band the design used, preserving shape.
  let ys: number[];
  if (eles.length >= 2) {
    const min = Math.min(...eles);
    const max = Math.max(...eles);
    const span = max - min || 1;
    ys = eles.map((e) => 10 + ((e - min) / span) * 80);
  } else {
    ys = [50, 50];
  }

  const n = ys.length;
  const step = 100 / (n - 1);
  const line = ys.map((y, i) => `${i * step} ${100 - y}`).join(" L ");
  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      style={{ width: "100%", height: h, display: "block" }}
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity="0.35" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`M 0 ${100 - ys[0]} L ${line} L 100 100 L 0 100 Z`} fill={`url(#${id})`} />
      <path
        d={`M 0 ${100 - ys[0]} L ${line}`}
        stroke={color}
        strokeWidth="1.6"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export interface LeaderRowData {
  rank: number;
  /** Display name (or "You"). */
  name: string;
  me?: boolean;
  /** Elapsed time string, e.g. "42:18". */
  time: string;
  /** Pace string per unit, e.g. "5:01". */
  pace: string;
  /** Trailing line second half: date OR gap-to-leader. */
  meta: string;
  color?: string;
}

/**
 * LeaderRow — ported verbatim from design/project/screens-routes.jsx, fed the
 * real DTO-derived `LeaderRowData`.
 */
export function LeaderRow({
  e,
  units,
  last,
  onClick,
}: {
  e: LeaderRowData;
  units: Units;
  last?: boolean;
  onClick?: () => void;
}) {
  const medal = MEDAL_COLORS[e.rank - 1];
  return (
    <Row
      onClick={onClick}
      gap={12}
      pad="11px 14px"
      style={{
        borderBottom: last ? "none" : "1px solid var(--border)",
        background: e.me ? "var(--accent-soft)" : "transparent",
      }}
    >
      <div style={{ width: 26, textAlign: "center", flexShrink: 0 }}>
        {e.rank <= 3 ? (
          <Icon name="medal" size={22} color={medal} stroke={2} />
        ) : (
          <span className="stat-num" style={{ fontSize: 18, color: "var(--text-3)" }}>
            {e.rank}
          </span>
        )}
      </div>
      <Avatar name={e.name} color={e.color} size={36} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontWeight: 700,
            fontSize: 14.5,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {e.me ? "You" : e.name}
        </div>
        <div style={{ fontSize: 12, color: "var(--text-3)" }}>
          {e.pace} /{distUnit(units)} · {e.meta}
        </div>
      </div>
      <span className="stat-num" style={{ fontSize: 22, color: e.me ? "var(--accent)" : "var(--text)" }}>
        {e.time}
      </span>
    </Row>
  );
}

/** Friendly display name for a membership/leaderboard user. */
export function userLabel(
  user: { displayName?: unknown; email?: unknown } | null | undefined,
  fallback = "Runner",
): string {
  const dn = asText(user?.displayName);
  if (dn) return dn;
  const email = asText(user?.email);
  if (email) return email.split("@")[0];
  return fallback;
}

export { fmtTime };
