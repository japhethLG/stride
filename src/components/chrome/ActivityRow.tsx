/**
 * ActivityRow — an activity list row (ported verbatim from
 * design/project/stride-chrome.jsx `ActivityRow`).
 *
 * `ActivityRowData` mirrors the design's activity shape
 * (design/project/stride-data.jsx ACTIVITIES). CP5 maps backend DTOs to this
 * view shape at the screen layer; the row itself stays presentational.
 */
import { Card, Tag, type TagTone } from "@/components/primitives";
import { fmtKm, distUnit, type Units } from "@/lib/format";
import { MiniMap } from "./MiniMap";
import { Metric } from "./Metric";
import type { FauxMapStyle } from "./fauxMap";

export type ActivityType = "RUN" | "JOG" | "WALK";

export interface ActivityRowData {
  title: string;
  type: ActivityType;
  date: string;
  /** Distance in kilometres. */
  dist: number;
  /** Pre-formatted duration string, e.g. "42:18". */
  dur: string;
  /** Pre-formatted pace string, e.g. "5:01". */
  pace: string;
  /** Track geometry in 0..100 viewBox space. */
  track?: string;
  seed?: number;
  /** When false, shows the "Syncing" tag. */
  synced?: boolean;
}

/** Tag tone per activity type (verbatim from the design). */
export const TYPE_TONE: Record<ActivityType, TagTone> = {
  RUN: "accent",
  JOG: "info",
  WALK: "live",
};

export interface ActivityRowProps {
  a: ActivityRowData;
  onClick?: () => void;
  units?: Units;
  mapStyle?: FauxMapStyle;
}

export function ActivityRow({ a, onClick, units = "metric", mapStyle }: ActivityRowProps) {
  return (
    <Card pad={12} interactive onClick={onClick} style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <MiniMap path={a.track} seed={a.seed} size={56} mapStyle={mapStyle} />
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
            {a.title}
          </span>
          <Tag tone={TYPE_TONE[a.type]} size="sm">
            {a.type}
          </Tag>
          {!a.synced && (
            <Tag tone="warn" size="sm" icon="refresh">
              Syncing
            </Tag>
          )}
        </div>
        <div style={{ color: "var(--text-3)", fontSize: 12.5, marginTop: 3 }}>{a.date}</div>
        <div style={{ display: "flex", gap: 16, marginTop: 7 }}>
          <Metric v={fmtKm(a.dist, units)} u={distUnit(units)} />
          <Metric v={a.dur} u="time" />
          <Metric v={a.pace} u={"/" + distUnit(units)} />
        </div>
      </div>
    </Card>
  );
}
