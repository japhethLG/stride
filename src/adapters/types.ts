/**
 * Adapter interfaces — the PWA-now / Capacitor-later device-capability boundary
 * (CLAUDE.md §4, implementation-plan.md §4.1).
 *
 * Every capability that behaves differently in a browser vs a Capacitor shell
 * sits behind one of these thin, framework-free interfaces. Feature code depends
 * on the interface, NEVER on `navigator.*` / a Capacitor plugin / a raw upload
 * `fetch`. Web impls live in `adapters/web/*`; native impls land in
 * `adapters/native/*` at the Capacitor migration. `adapters/index.ts` is the
 * single composition root that picks an impl by platform.
 */

/** A single GPS sample. Wire-canonical: serialized as `{ lat, lng, ts }`. */
export interface GeoPoint {
  lat: number;
  lng: number;
  /** epoch ms (device clock) */
  timestamp: number;
  altitude: number | null;
  speed: number | null;
  accuracy: number | null;
}

export type TrackerState = "idle" | "acquiring" | "tracking" | "paused";

export type TrackerErrorCode =
  | "PERMISSION_DENIED"
  | "POSITION_UNAVAILABLE"
  | "TIMEOUT"
  | "WAKELOCK_LOST"
  | "UNKNOWN";

export interface TrackerError {
  code: TrackerErrorCode;
  message: string;
}

export interface LocationTrackerOptions {
  /** default 1000 — throttles to protect upload/RTDB budgets */
  minIntervalMs?: number;
  /** default 5 */
  minDistanceM?: number;
  /** default 30 — drop low-quality fixes */
  maxAccuracyM?: number | null;
  /** PWA: hold a Screen Wake Lock while tracking; default true */
  keepScreenOn?: boolean;
}

/**
 * Owns the GPS subscription only. Does NOT compute distance/pace or manage pause
 * semantics beyond the subscription — that is platform-agnostic feature logic in
 * `lib/recording`.
 */
export interface LocationTracker {
  /** resolves on the first acceptable fix */
  start(opts?: LocationTrackerOptions): Promise<void>;
  /**
   * One-shot location read (does NOT start the tracking subscription). Used by
   * non-recording screens (e.g. Create Route auto-focus / locate-me) that just
   * need the user's current position. Resolves to `null` when permission is
   * denied or no fix is available — callers fall back gracefully, never throw.
   */
  getCurrentPosition(): Promise<GeoPoint | null>;
  pause(): void;
  resume(): void;
  stop(): Promise<void>;
  onPosition(cb: (p: GeoPoint) => void): () => void;
  onStateChange(cb: (s: TrackerState) => void): () => void;
  onError(cb: (e: TrackerError) => void): () => void;
}

/**
 * Buffers points to IndexedDB first (durable), flushes in idempotent batches
 * keyed by `(activityId, seq)`. The `activityId` is client-generated at recording
 * start (UUID v4), so batches are addressable before any server row exists.
 */
export interface PointUploader {
  /** IndexedDB write — never lost across reload/crash */
  enqueue(activityId: string, points: GeoPoint[]): Promise<void>;
  flush(): Promise<{ uploaded: number; pending: number }>;
  startAutoFlush(intervalMs: number): void;
  stopAutoFlush(): void;
  pendingCount(): Promise<number>;
  /** Drop a finished/uploaded activity's buffered batches (recording §7.4). */
  clear(activityId: string): Promise<void>;
}

/** The auth identity an AuthService surfaces. */
export interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoUrl: string | null;
  emailVerified: boolean;
}

/**
 * Wraps sign-in/out + token acquisition. The api client middleware and the
 * PointUploader just ask for a fresh token; they never touch Firebase directly.
 * Today the web impl is a DEV STUB (no real Firebase). When Firebase env is
 * present it will use the JS SDK; only `signInWithGoogle` swaps natively later.
 */
export interface AuthService {
  signInWithEmail(email: string, password: string): Promise<AuthUser>;
  signUpWithEmail(email: string, password: string): Promise<AuthUser>;
  /** the only method whose impl differs natively */
  signInWithGoogle(): Promise<AuthUser>;
  signOut(): Promise<void>;
  current(): AuthUser | null;
  /** for the NestJS guard's `Authorization: Bearer <token>` */
  getIdToken(forceRefresh?: boolean): Promise<string | null>;
  onAuthStateChanged(cb: (u: AuthUser | null) => void): () => void;
}

export type PushPermission = "granted" | "denied" | "unsupported";

/** No-op stub on web today; FCM via Capacitor later. */
export interface PushService {
  requestPermission(): Promise<PushPermission>;
  getToken(): Promise<string | null>;
}

/** The full adapter set, provided once via the composition root. */
export interface Adapters {
  location: LocationTracker;
  uploader: PointUploader;
  auth: AuthService;
  push: PushService;
}
