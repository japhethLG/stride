/**
 * Formatting helpers (CP4) — ported verbatim from the design
 * (design/project/stride-data.jsx `fmtKm`/`distUnit` and
 * design/project/screens-record.jsx `fmtTime`/`fmtPace`).
 *
 * These are the unit/pace/time formatters the screens (CP5) reference. Keep the
 * exact output shapes so the ported screens render byte-for-byte.
 */

export type Units = "metric" | "imperial";

/** Kilometres → display string in the active unit (2dp). `8.42` km → `"8.42"` (metric) / `"5.23"` (imperial). */
export function fmtKm(km: number, u: Units = "metric"): string {
  return u === "imperial" ? (km * 0.621371).toFixed(2) : km.toFixed(2);
}

/** Distance-unit label for the active unit: `"mi"` (imperial) | `"km"` (metric). */
export function distUnit(u: Units = "metric"): string {
  return u === "imperial" ? "mi" : "km";
}

/** Seconds → elapsed time. `<1h` → `"M:SS"`, `>=1h` → `"H:MM:SS"`. */
export function fmtTime(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

/** Pace in seconds-per-unit → `"M:SS"`. */
export function fmtPace(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.round(s % 60);
  return `${m}:${String(sec).padStart(2, "0")}`;
}
