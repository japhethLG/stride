/**
 * UserLocationProvider — the user's device location as shared context
 * (CLAUDE.md §4 / §5).
 *
 * Why a context: every map-bearing screen (Create Route, Record, …) needs "where
 * is the user?" Before this, each screen ran its own one-shot `getCurrentPosition`
 * and meanwhile showed `DEFAULT_CENTER` (San Francisco) — so opening those screens
 * flashed a random US map until a fix arrived. This provider fixes that by:
 *
 *   1. **Persisting the last known location** to localStorage, so the very first
 *      paint can center on roughly where the user is (no SF flash) across reloads.
 *   2. **Auto-refreshing** the live fix on an interval while permission is granted,
 *      so `current` stays fresh without each screen re-implementing it.
 *
 * It NEVER prompts on its own — it only reads `getCurrentPosition` when permission
 * is already `"granted"` (checked via the adapter, never `navigator.*` directly).
 * `refresh()` is the explicit, user-triggered path (locate-me button) that may
 * prompt. Continuous high-accuracy tracking for an active *run* stays in
 * `lib/recording` via the tracker's `start()` — this context is only for centering
 * maps / showing the "me" marker, and must not contend with that.
 *
 * Consume via `useUserLocation()` (named to avoid react-router's `useLocation`).
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { getAdapters } from "@/adapters";
import type { GeoPoint } from "@/adapters/types";
import { DEFAULT_CENTER } from "@/lib/map/style";

type LngLat = [number, number];

/** How often to re-read the location while permission is granted. */
const REFRESH_MS = 20_000;
const STORAGE_KEY = "stride.lastLocation";

export interface UserLocationValue {
  /** Freshest fix; null until one is obtained this session. */
  current: GeoPoint | null;
  /** Last good `[lng,lat]`, persisted across reloads (null on first-ever use). */
  lastKnown: LngLat | null;
  /** Best initial map center: live fix → last known → `DEFAULT_CENTER`. */
  center: LngLat;
  /** A one-shot read is in flight (drives locate-me spinners). */
  locating: boolean;
  /** The most recent read failed / was denied. */
  error: boolean;
  /** Force an immediate read (locate-me). May prompt the first time. */
  refresh: () => Promise<void>;
}

const UserLocationContext = createContext<UserLocationValue | null>(null);

function loadLastKnown(): LngLat | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as unknown;
    if (
      Array.isArray(v) &&
      v.length === 2 &&
      typeof v[0] === "number" &&
      typeof v[1] === "number"
    ) {
      return [v[0], v[1]];
    }
  } catch {
    /* corrupt/missing — fall through */
  }
  return null;
}

export function UserLocationProvider({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState<GeoPoint | null>(null);
  const [lastKnown, setLastKnown] = useState<LngLat | null>(() => loadLastKnown());
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState(false);
  const mounted = useRef(true);

  const apply = useCallback((p: GeoPoint) => {
    setCurrent(p);
    const at: LngLat = [p.lng, p.lat];
    setLastKnown(at);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(at));
    } catch {
      /* storage full / unavailable — keep the in-memory value */
    }
    setError(false);
  }, []);

  const refresh = useCallback(async () => {
    setLocating(true);
    const p = await getAdapters().location.getCurrentPosition();
    if (!mounted.current) return;
    setLocating(false);
    if (p) apply(p);
    else setError(true);
  }, [apply]);

  // Auto-refresh while permission is granted. Re-checks each tick so a grant made
  // later (onboarding / locate-me) starts refreshing without a remount. Never
  // prompts here — only reads when already granted.
  useEffect(() => {
    mounted.current = true;
    let cancelled = false;
    const tick = async () => {
      const perm = await getAdapters().location.getPermissionState();
      if (cancelled || perm !== "granted") return;
      const p = await getAdapters().location.getCurrentPosition();
      if (!cancelled && p) apply(p);
    };
    void tick();
    const timer = window.setInterval(() => void tick(), REFRESH_MS);
    return () => {
      cancelled = true;
      mounted.current = false;
      clearInterval(timer);
    };
  }, [apply]);

  const center: LngLat = current ? [current.lng, current.lat] : (lastKnown ?? DEFAULT_CENTER);

  const value = useMemo<UserLocationValue>(
    () => ({ current, lastKnown, center, locating, error, refresh }),
    [current, lastKnown, center, locating, error, refresh],
  );

  return <UserLocationContext.Provider value={value}>{children}</UserLocationContext.Provider>;
}

/** Read the shared user-location context. Must be used under UserLocationProvider. */
export function useUserLocation(): UserLocationValue {
  const ctx = useContext(UserLocationContext);
  if (!ctx) throw new Error("useUserLocation must be used within <UserLocationProvider>");
  return ctx;
}
