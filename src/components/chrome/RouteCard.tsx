/**
 * RouteCard — a route list row (ported verbatim from
 * design/project/stride-chrome.jsx `RouteCard`).
 *
 * `RouteCardData` mirrors the design's route shape
 * (design/project/stride-data.jsx ROUTES). The design declared an unused
 * `ATHLETES[r.owner]` lookup — it never rendered the owner, so it's dropped here;
 * the visible fields (name, dist, elev, role, members, isPublic, liveNow) are
 * unchanged.
 */
import { Card, Icon, Tag, type TagTone } from "@/components/primitives";
import { fmtKm, distUnit, type Units } from "@/lib/format";
import { MiniMap } from "./MiniMap";
import { Metric } from "./Metric";
import type { FauxMapStyle } from "./fauxMap";

export type RouteRole = "OWNER" | "MEMBER" | "INVITED";

export interface RouteCardData {
  name: string;
  /** Distance in kilometres. */
  dist: number;
  /** Elevation gain in metres. */
  elev: number;
  role: RouteRole;
  members: number;
  isPublic: boolean;
  /** Number of athletes currently live on the route. */
  liveNow: number;
  /** Route geometry in 0..100 viewBox space. */
  path?: string;
  seed?: number;
}

const ROLE_TONE: Record<RouteRole, TagTone> = {
  OWNER: "accent",
  MEMBER: "info",
  INVITED: "warn",
};

export interface RouteCardProps {
  r: RouteCardData;
  onClick?: () => void;
  units?: Units;
  mapStyle?: FauxMapStyle;
}

export function RouteCard({ r, onClick, units = "metric", mapStyle }: RouteCardProps) {
  const roleTone = ROLE_TONE[r.role];
  return (
    <Card pad={12} interactive onClick={onClick} style={{ display: "flex", alignItems: "center", gap: 13 }}>
      <MiniMap path={r.path} seed={r.seed} size={64} mapStyle={mapStyle} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <span
            style={{
              fontWeight: 700,
              fontSize: 15.5,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {r.name}
          </span>
          {r.liveNow > 0 && (
            <Tag tone="live" size="sm" icon="dot">
              {r.liveNow} live
            </Tag>
          )}
        </div>
        <div style={{ display: "flex", gap: 14, marginTop: 6 }}>
          <Metric v={fmtKm(r.dist, units)} u={distUnit(units)} />
          <Metric v={"+" + r.elev} u="m" />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
          <Tag tone={roleTone} size="sm">
            {r.role}
          </Tag>
          <span
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              color: "var(--text-3)",
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            <Icon name="users" size={14} /> {r.members}
          </span>
          {!r.isPublic && <Icon name="lock" size={13} color="var(--text-3)" />}
        </div>
      </div>
      <Icon name="chevR" size={20} color="var(--text-4)" />
    </Card>
  );
}
