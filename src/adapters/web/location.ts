/**
 * WebLocationTracker (CLAUDE.md §4, plan §4.1 / §7.4).
 *
 * GPS subscription via `navigator.geolocation.watchPosition` + Screen Wake Lock.
 * Applies the interval/distance/accuracy filters before emitting. Re-acquires the
 * wake lock on `visibilitychange -> visible` (browsers auto-release when hidden).
 *
 * PWA recording is FOREGROUND-ONLY: with the screen off / tab hidden the browser
 * stops emitting fixes — a documented web-platform limit. The Record screen makes
 * this legible; true background tracking arrives with the Capacitor shell
 * (NativeLocationTracker).
 *
 * CP4 ships the structure + lifecycle; the distance/pace math is platform-agnostic
 * feature logic in lib/recording (fleshed out in CP5).
 */
import type {
  GeoPoint,
  LocationTracker,
  LocationTrackerOptions,
  TrackerError,
  TrackerState,
} from "@/adapters/types";

const DEFAULTS: Required<Omit<LocationTrackerOptions, "maxAccuracyM">> & {
  maxAccuracyM: number | null;
} = {
  minIntervalMs: 1000,
  minDistanceM: 5,
  maxAccuracyM: 30,
  keepScreenOn: true,
};

function haversineM(a: GeoPoint, b: GeoPoint): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export class WebLocationTracker implements LocationTracker {
  private watchId: number | null = null;
  private wakeLock: WakeLockSentinel | null = null;
  private opts = DEFAULTS;
  private state: TrackerState = "idle";
  private last: GeoPoint | null = null;

  private positionCbs = new Set<(p: GeoPoint) => void>();
  private stateCbs = new Set<(s: TrackerState) => void>();
  private errorCbs = new Set<(e: TrackerError) => void>();
  private visibilityHandler: (() => void) | null = null;

  private setState(s: TrackerState) {
    this.state = s;
    for (const cb of this.stateCbs) cb(s);
  }

  private emitError(e: TrackerError) {
    for (const cb of this.errorCbs) cb(e);
  }

  async start(opts: LocationTrackerOptions = {}): Promise<void> {
    this.opts = { ...DEFAULTS, ...opts };
    this.last = null;
    this.setState("acquiring");

    if (!("geolocation" in navigator)) {
      this.emitError({ code: "POSITION_UNAVAILABLE", message: "Geolocation unavailable" });
      throw new Error("Geolocation unavailable");
    }

    if (this.opts.keepScreenOn) {
      await this.acquireWakeLock();
      this.visibilityHandler = () => {
        if (document.visibilityState === "visible") void this.acquireWakeLock();
      };
      document.addEventListener("visibilitychange", this.visibilityHandler);
    }

    return new Promise<void>((resolve, reject) => {
      let resolved = false;
      this.watchId = navigator.geolocation.watchPosition(
        (pos) => {
          const point = toGeoPoint(pos);
          if (!this.accept(point)) return;
          this.last = point;
          this.setState("tracking");
          for (const cb of this.positionCbs) cb(point);
          if (!resolved) {
            resolved = true;
            resolve();
          }
        },
        (err) => {
          const code: TrackerError["code"] =
            err.code === err.PERMISSION_DENIED
              ? "PERMISSION_DENIED"
              : err.code === err.TIMEOUT
                ? "TIMEOUT"
                : "POSITION_UNAVAILABLE";
          this.emitError({ code, message: err.message });
          if (!resolved) {
            resolved = true;
            reject(new Error(err.message));
          }
        },
        { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 },
      );
    });
  }

  private accept(p: GeoPoint): boolean {
    if (this.state === "paused") return false;
    const { maxAccuracyM, minIntervalMs, minDistanceM } = this.opts;
    if (maxAccuracyM != null && p.accuracy != null && p.accuracy > maxAccuracyM) return false;
    if (this.last) {
      if (p.timestamp - this.last.timestamp < minIntervalMs) return false;
      if (haversineM(this.last, p) < minDistanceM) return false;
    }
    return true;
  }

  pause(): void {
    this.setState("paused");
  }

  resume(): void {
    if (this.watchId != null) this.setState("tracking");
  }

  async stop(): Promise<void> {
    if (this.watchId != null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
    if (this.visibilityHandler) {
      document.removeEventListener("visibilitychange", this.visibilityHandler);
      this.visibilityHandler = null;
    }
    await this.releaseWakeLock();
    this.last = null;
    this.setState("idle");
  }

  onPosition(cb: (p: GeoPoint) => void): () => void {
    this.positionCbs.add(cb);
    return () => this.positionCbs.delete(cb);
  }

  onStateChange(cb: (s: TrackerState) => void): () => void {
    this.stateCbs.add(cb);
    return () => this.stateCbs.delete(cb);
  }

  onError(cb: (e: TrackerError) => void): () => void {
    this.errorCbs.add(cb);
    return () => this.errorCbs.delete(cb);
  }

  private async acquireWakeLock(): Promise<void> {
    try {
      if (!("wakeLock" in navigator)) return;
      this.wakeLock = await navigator.wakeLock.request("screen");
    } catch {
      this.emitError({ code: "WAKELOCK_LOST", message: "Could not acquire screen wake lock" });
    }
  }

  private async releaseWakeLock(): Promise<void> {
    try {
      await this.wakeLock?.release();
    } catch {
      /* ignore */
    }
    this.wakeLock = null;
  }
}

function toGeoPoint(pos: GeolocationPosition): GeoPoint {
  const c = pos.coords;
  return {
    lat: c.latitude,
    lng: c.longitude,
    timestamp: pos.timestamp,
    altitude: c.altitude,
    speed: c.speed,
    accuracy: c.accuracy,
  };
}
