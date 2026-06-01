/**
 * View-model mappers (CP5) — adapt backend DTOs to the design's presentational
 * row shapes (`ActivityRowData` / `RouteCardData`) and derive the small display
 * strings the design's mock data pre-baked (date label, duration, pace).
 *
 * The CP4 chrome rows (`ActivityRow` / `RouteCard`) stay presentational and
 * consume these view shapes; screens (Home, Profile) call these mappers to turn
 * the real `ActivityDto` / `RouteDto` into them. Backend BigInt fields
 * (`durationMs`) arrive as STRINGS — parsed here for math.
 *
 * Shared by the home cluster (Home + Profile). Lives in `lib/` because more than
 * one feature folder consumes it.
 */
import type { ActivityDto, RouteDto } from "@/lib/api/types";
import type { ActivityRowData, RouteRole } from "@/components/chrome";
import { fmtTime, fmtPace } from "@/lib/format";

/** Stable faux-thumbnail seed from a string id (the list DTOs carry no path). */
export function seedFromId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h % 1000;
}

/** Meters → kilometres (the chrome rows take km and format per active unit). */
export function metersToKm(m: number | null | undefined): number {
  return (m ?? 0) / 1000;
}

/**
 * Date label like the design's `"Today · 6:42 AM"` / `"Tue · 6:10 PM"`. Uses the
 * activity's ISO `startedAt`; relative ("Today"/"Yesterday") within 48h, else the
 * short weekday, plus the local clock time.
 */
export function fmtActivityDate(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const time = d.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dayDiff = Math.round(
    (startOfToday.getTime() - startOfDay.getTime()) / 86_400_000,
  );
  let day: string;
  if (dayDiff === 0) day = "Today";
  else if (dayDiff === 1) day = "Yesterday";
  else if (dayDiff > 1 && dayDiff < 7)
    day = d.toLocaleDateString(undefined, { weekday: "short" });
  else day = d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return `${day} · ${time}`;
}

/** Average pace (s/km) → `"M:SS"`, falling back to distance/duration when null. */
export function activityPaceSPerKm(a: ActivityDto): number | null {
  const fromServer = a.avgPaceSPerKm as unknown;
  if (typeof fromServer === "number" && Number.isFinite(fromServer) && fromServer > 0) {
    return fromServer;
  }
  const km = metersToKm(a.distanceM);
  const durMs = Number(a.durationMs);
  if (km > 0 && Number.isFinite(durMs) && durMs > 0) return durMs / 1000 / km;
  return null;
}

/** `ActivityDto` → the presentational `ActivityRowData` the chrome row renders. */
export function toActivityRow(
  a: ActivityDto,
  opts: { synced?: boolean; now?: Date } = {},
): ActivityRowData {
  const pace = activityPaceSPerKm(a);
  return {
    title: a.title,
    type: a.type,
    date: fmtActivityDate(a.startedAt, opts.now),
    dist: metersToKm(a.distanceM),
    dur: fmtTime(Number(a.durationMs) / 1000),
    pace: pace == null ? "--" : fmtPace(pace),
    seed: seedFromId(a.id),
    synced: opts.synced ?? true,
  };
}

/**
 * Owner-relative role for a route, given the current user's id. Only OWNER vs
 * MEMBER is derivable from `RouteDto` (the list carries no membership status);
 * an explicit role can be passed for member/invite lists.
 */
export function routeRole(r: RouteDto, myUserId: string | null | undefined): RouteRole {
  return myUserId && r.ownerId === myUserId ? "OWNER" : "MEMBER";
}

/** `RouteDto` → `RouteCardData`. `role`/`members`/`liveNow` may be supplied by the caller. */
export function toRouteCard(
  r: RouteDto,
  opts: { role?: RouteRole; members?: number; liveNow?: number; myUserId?: string | null } = {},
): {
  name: string;
  dist: number;
  elev: number;
  role: RouteRole;
  members: number;
  isPublic: boolean;
  liveNow: number;
  seed: number;
} {
  const elev = typeof r.elevationGainM === "number" ? r.elevationGainM : 0;
  return {
    name: r.name,
    dist: metersToKm(r.distanceM),
    elev: Math.round(elev),
    role: opts.role ?? routeRole(r, opts.myUserId),
    members: opts.members ?? 0,
    isPublic: r.isPublic,
    liveNow: opts.liveNow ?? 0,
    seed: seedFromId(r.id),
  };
}
