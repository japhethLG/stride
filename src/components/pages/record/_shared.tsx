/**
 * Shared helpers for the record cluster pages (CP5).
 *
 * Ported from the local helpers the design defines in
 * design/project/screens-record.jsx (`ordinal`, `posAlong`, `SplitsList`) plus
 * small adapters that turn the REAL recording-store / backend shapes
 * (per-km `{ km, durationS, paceSPerKm }` splits, GeoJSON `[lng,lat]` tracks)
 * into the verbatim visuals. Kept in one spot so Record / Summary /
 * ActivityDetail don't each re-derive them.
 *
 * `fmtTime` / `fmtPace` already live in `@/lib/format` (the design's identical
 * helpers were lifted there in CP4) — re-exported here for one import site.
 */
import { Card, Icon, Row } from "@/components/primitives";
import { fmtTime, fmtPace, distUnit, type Units } from "@/lib/format";

export { fmtTime, fmtPace };

/** Ordinal suffix (design verbatim): 1 -> "1st", 4 -> "4th", 23 -> "23rd". */
export function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

/**
 * One split row's display shape: the km label, the elapsed-time string, and the
 * raw bar magnitude (longer bar = faster split, mirroring the design where the
 * bar width tracked a per-split metric and the fastest split is flagged).
 */
export interface SplitRow {
  /** 1-based km/mi label, e.g. "1" or "5.4" for a partial final split. */
  label: string;
  /** Pace string for this split, e.g. "5:01". */
  pace: string;
  /** Bar magnitude — bigger is faster (we invert pace so quicker = longer). */
  bar: number;
  /** Whether this is the final partial split (rendered dimmed). */
  partial?: boolean;
}

/**
 * GeoJSON LineString `[lng,lat][]` -> MapView coords (already in that order).
 * Returns `[]` for a missing/empty geometry.
 */
export function lineCoords(
  geom: { coordinates?: unknown } | null | undefined,
): [number, number][] {
  const c = geom?.coordinates;
  if (!Array.isArray(c)) return [];
  return c
    .filter((p): p is number[] => Array.isArray(p) && p.length >= 2)
    .map((p) => [p[0], p[1]] as [number, number]);
}

/** Coerce the generator's `Record<string,never> | null` "number" fields. */
export function asNum(v: unknown): number {
  return typeof v === "number" ? v : 0;
}

/** Coerce the generator's `Record<string,never> | null` "string" fields. */
export function asText(v: unknown): string {
  return typeof v === "string" ? v : "";
}

/** Parse a BigInt-as-string field (durationMs / elapsedMs) to seconds. */
export function msStringToSeconds(ms: string | number | null | undefined): number {
  const n = typeof ms === "string" ? Number(ms) : ms ?? 0;
  return Number.isFinite(n) ? Math.round(n / 1000) : 0;
}

/** Average pace in seconds-per-km from elapsed seconds + distance (m). */
export function paceSPerKm(elapsedS: number, distanceM: number): number | null {
  if (!distanceM || distanceM <= 0) return null;
  return elapsedS / (distanceM / 1000);
}

/** Pace per active unit, formatted `M:SS` (per-mile for imperial). */
export function fmtPaceUnit(sPerKm: number | null, units: Units): string {
  if (sPerKm == null) return "--:--";
  const per = units === "imperial" ? sPerKm / 0.621371 : sPerKm;
  return fmtPace(per);
}

/** Friendly long date label from an ISO timestamp (e.g. "Mon, May 4 · 7:12 AM"). */
export function longDateTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * Build the verbatim splits-list rows from the recording store / backend per-km
 * splits (`{ km, durationS, paceSPerKm }`), converting pace to the active unit
 * and appending a partial final split for the trailing distance.
 */
export function buildSplitRows(
  splits: { km: number; durationS: number; paceSPerKm: number }[],
  totalDistanceM: number,
  totalDurationS: number,
  units: Units,
): SplitRow[] {
  const unitMeters = units === "imperial" ? 1609.344 : 1000;
  // The store computes per-KM splits; re-segment into the active display unit so
  // imperial users see per-mile rows. We approximate from the km splits by
  // accumulating their durations into unit-sized buckets.
  const rows: SplitRow[] = [];
  if (units === "metric") {
    for (const s of splits) {
      const pace = s.paceSPerKm;
      rows.push({ label: String(s.km), pace: fmtPace(pace), bar: pace });
    }
  } else {
    // Convert: total km covered by full splits, remap to miles proportionally.
    const fullKm = splits.length;
    const miles = Math.floor((fullKm * 1000) / unitMeters);
    for (let mi = 1; mi <= miles; mi++) {
      // average the km-paces spanned by this mile (~1.609 km)
      const startKm = Math.round((mi - 1) * (unitMeters / 1000));
      const endKm = Math.min(splits.length, Math.round(mi * (unitMeters / 1000)));
      const span = splits.slice(startKm, endKm);
      const avgPaceKm =
        span.length > 0 ? span.reduce((a, s) => a + s.paceSPerKm, 0) / span.length : 0;
      const pacePerMile = avgPaceKm / 0.621371;
      rows.push({ label: String(mi), pace: fmtPace(pacePerMile), bar: pacePerMile });
    }
  }

  // Trailing partial split (distance beyond the last full unit).
  const fullUnits = rows.length;
  const remainingM = totalDistanceM - fullUnits * unitMeters;
  if (remainingM > 60 && totalDistanceM > 0) {
    const fullUnitFrac = (totalDistanceM - remainingM) / unitMeters;
    const partialLabel = (fullUnits + remainingM / unitMeters).toFixed(1);
    // estimate the partial split's pace from the overall average
    const avgPace =
      paceSPerKm(totalDurationS, totalDistanceM) ?? 0;
    const perUnit = units === "imperial" ? avgPace / 0.621371 : avgPace;
    void fullUnitFrac;
    rows.push({ label: partialLabel, pace: fmtPace(perUnit), bar: perUnit, partial: true });
  }
  return rows;
}

/**
 * SplitsList — ported verbatim from design/project/screens-record.jsx
 * `SplitsList`. The design fed `[label, paceStr, barVal]` tuples; here it takes
 * the typed `SplitRow[]` derived above. Bar width tracks "faster = longer" and
 * the fastest split is flagged with a bolt.
 */
export function SplitsList({ splits }: { splits: SplitRow[] }) {
  if (splits.length === 0) {
    return (
      <Card pad={14}>
        <div style={{ color: "var(--text-3)", fontSize: 13, textAlign: "center" }}>
          Not enough distance for splits yet.
        </div>
      </Card>
    );
  }
  // The design used a per-split metric where bigger = faster; we invert pace
  // (smaller seconds = faster) into a magnitude so the fastest split has the
  // widest bar — preserving the original visual.
  const mags = splits.map((s) => (s.bar > 0 ? 1 / s.bar : 0));
  const max = Math.max(...mags, 1e-9);
  const fastest = splits.reduce(
    (best, s, i) => (s.bar > 0 && s.bar < splits[best].bar ? i : best),
    0,
  );
  return (
    <Card pad={0}>
      {splits.map((s, i) => (
        <Row
          key={i}
          gap={12}
          pad="10px 14px"
          style={{ borderBottom: i === splits.length - 1 ? "none" : "1px solid var(--border)" }}
        >
          <span
            className="stat-num"
            style={{ fontSize: 18, width: 30, color: s.partial ? "var(--text-3)" : "var(--text)" }}
          >
            {s.label}
          </span>
          <div
            style={{
              flex: 1,
              height: 8,
              borderRadius: 4,
              background: "var(--surface-2)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: (mags[i] / max) * 100 + "%",
                height: "100%",
                borderRadius: 4,
                background: i === fastest && !s.partial ? "var(--live)" : "var(--accent)",
              }}
            />
          </div>
          {i === fastest && !s.partial && <Icon name="bolt" size={15} color="var(--live)" fill />}
          <span className="stat-num" style={{ fontSize: 18, width: 50, textAlign: "right" }}>
            {s.pace}
          </span>
        </Row>
      ))}
    </Card>
  );
}

/** Distance-unit-aware "/unit" label, e.g. "/km" | "/mi". */
export function perUnit(units: Units): string {
  return "/" + distUnit(units);
}
