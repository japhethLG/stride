# Implementation Plan — Run Tracker PoC

A Strava-style run/jog tracker, shipped as an installable PWA today and architected to become a Capacitor Android app with minimal change. This plan is the single source of truth for the proof-of-concept: it integrates the data model, API surface, segment-matching engine, and frontend adapter architecture into one buildable sequence, grounded in the existing NestJS + Prisma backend (`Activity` / `ActivityLocation`, `BigInt` epoch-ms timestamps, UUID ids, no `User`, no PostGIS, no global prefix today; `postgres:latest` image with a `pgadmin` sidecar behind an existing `Caddyfile`).

---

## 1. Scope & Non-Goals

### In scope (core features)

1. **Auth & onboarding** — Firebase Auth (email/password + Google); NestJS guard verifies Firebase ID tokens; provision-on-first-request user mirror.
2. **Route creation** — drag points on a MapLibre map to draw a route; **snap-to-road** via OpenRouteService; show distance + elevation profile; save.
3. **Invites & membership** — invite other users to a route by email; accept/decline; membership scopes visibility and leaderboards.
4. **Activity recording** — GPS track recording in the **foreground PWA** (Screen Wake Lock); live stats (time / distance / pace); upload-on-finish; compute best effort vs leaderboard.
5. **Segment matching & gamified leaderboards** — Strava-segment-style ranking of users' best times on a route/segment via **PostGIS** trace matching.
6. **Live multi-user tracking** — see self + other runners on the same route in real time via **Firebase Realtime Database** (presence + throttled position fan-out).

### Explicitly out of scope / deferred (future phases)

These are acknowledged as future work and are **not** designed in detail here:

- **3D / animated replay** of activities.
- **LLM natural-language route suggestions** ("a flat 5k near the river").
- **Auto loop-by-distance route generation.**
- **True screen-off / background GPS** — impossible in a foreground-only PWA; arrives with the **Capacitor Android shell + foreground service** (Phase 2). The PWA tracks only while the page is visible (Screen Wake Lock keeps the screen on); the data-gap behavior when the user leaves the tab is made explicit in the UI (§7.4).
- **Push notifications (FCM)** and **media uploads (Cloudflare R2)** — interfaces are stubbed now (§4.1) so feature code needs no later branching; wiring lands with Capacitor.

---

## 2. Architecture Overview

The PWA client is the only thing users touch. It talks to **two** backends: the **NestJS REST API** (durable source of truth, backed by Postgres/PostGIS) for everything authoritative, and **Firebase** directly (Auth + Realtime Database) for sign-in and low-latency live position fan-out. Maps and routing are third-party HTTP services called from the browser. Membership-derived RTDB authorization data is written **by the backend** via `firebase-admin` (see §2.1, §7.6) — the client never writes the access-control index.

```
                                  ┌───────────────────────────────────────────┐
                                  │            PWA CLIENT (browser)             │
                                  │  React + Vite + MapLibre GL JS              │
                                  │  ┌───────────────────────────────────────┐ │
                                  │  │ adapters: LocationTracker, PointUploader│ │
                                  │  │           AuthService, PushService      │ │
                                  │  └───────────────────────────────────────┘ │
                                  └───┬───────────┬───────────┬───────────┬─────┘
                  Firebase ID token   │           │           │           │
        (Authorization: Bearer …)     │           │           │           │
                                      │           │           │           │
        ┌─────────────────────────────▼──┐   ┌────▼─────┐ ┌───▼────────┐ ┌▼──────────────┐
        │      NestJS REST API (/api)     │   │ Firebase │ │OpenFreeMap │ │OpenRouteService│
        │  FirebaseAuthGuard (verifies    │   │   Auth   │ │  vector    │ │ snap-to-road   │
        │   ID token, upserts User)       │   │ (email/  │ │   tiles    │ │ (foot-walking) │
        │  + firebase-admin RTDB writer   │   │  Google) │ │ (no key)   │ │  (key, quota)  │
        │  Routes · Invites · Activities  │   └──────────┘ └────────────┘ └────────────────┘
        │  Leaderboards · Live-session    │
        │  PostGIS segment matching       │        ▲   live positions + presence (direct)
        └───────┬───────────────┬─────────┘        │   throttled ~1 write / 2 s,
                │ writes         │                  │   onDisconnect() presence cleanup
                │ routeMembers/* │                  │
        ┌───────▼───────────────▼─────────┐   ┌─────▼───────────────────────────┐
        │  PostgreSQL + PostGIS            │   │  Firebase Realtime Database      │
        │  (postgis/postgis Docker image)  │   │  (Spark free tier)               │
        │  Users, Routes, Segments,        │   │  liveSessions/<routeId>/<uid>    │
        │  Memberships, Activities,        │◄──┤  presence/<routeId>/<uid>        │
        │  ActivityPoints, RouteEfforts    │   │  routeMembers/<routeId>/<uid>    │
        │  geometry/geography(...,4326)    │   │  connections/<uid>               │
        │  + GiST                          │   │  (ephemeral, NOT authoritative)  │
        └─────────────────────────────────┘   └──────────────────────────────────┘
                  Self-hosted: Docker Compose + Caddy on Oracle Cloud free-tier aarch64 VM
```

### 2.1 Geometry-type policy (load-bearing — read before §5/§7)

PostGIS `geography` **does not support the M (measure) dimension**, and the matching functions `ST_LineLocatePoint` / `ST_LineInterpolatePoint` accept **`geometry`, not `geography`**. The plan therefore fixes a single, explicit policy used everywhere:

- **Store all durable geometry as `geometry(...,4326)`** (planar lon/lat). This is the canonical column type for `Route.path`, `Segment.path`, `RouteWaypoint.point`, `Activity.track` (a `geometry(LineStringM,4326)` whose `M` ordinate carries epoch-ms), and `ActivityPoint.point`.
- **Cast to `::geography` only at the point of a metric operation** — `ST_Length`, `ST_DWithin`, `ST_Distance` — so distances come back in **meters** with no manual projection.
- **Keep `geometry` for topology operations** — `ST_LineLocatePoint`, `ST_LineInterpolatePoint`, `ST_M`, `ST_MakePointM`, `ST_MakeLine` — which require it and which would drop the `M` ordinate under `geography`.

This resolves both the M-dimension and the function-signature issues in one rule: **columns are `geometry`; metric calls add `::geography`.** Every SQL block below follows it.

### Data flow — activity recording (upload-on-finish)

```
1. User taps Start.
   Client generates activityId (UUID v4) locally.       ← the run has an id before any DB row exists
   LocationTracker.start({keepScreenOn:true})  → wake lock acquired, watchPosition begins.
2. Each filtered GeoPoint →  (a) in-memory state (live map line + stats)
                             (b) PointUploader.enqueue(activityId, points) → IndexedDB (durable buffer)
3. Concurrently (if "on a route" / live):
   throttled write of CURRENT position only → RTDB liveSessions/<routeId>/<uid>  (~1 / 2 s)
4. User taps Stop.
   Client assembles full buffered track → POST /api/activities { id, points:[{lat,lng,ts}], … }
5. Server: upsert Activity on client id  → build geometry(LineStringM) track
            → run PostGIS segment matching → upsert RouteEffort → return { activity, bestEfforts:[{rank,…}] }
6. Client deletes RTDB live node, sets presence offline, clears IndexedDB buffer.
```

The **client generates the `activityId`** (UUID v4) the moment recording starts. This single decision makes everything else coherent: `PointUploader` can enqueue/flush idempotent batches keyed by `(activityId, seq)` *during* the run, the RTDB live node can reference `activityId`, and `POST /api/activities` is an **upsert on that client id** (no separate `start` endpoint, no DB row until finish). Re-sends (retry, `sendBeacon`, recovery-after-crash) all converge on the same row.

### Data flow — live multi-user tracking

```
Runner A                         Firebase RTDB                      Viewer B (on same route)
────────                         ─────────────                      ────────────────────────
POST /api/routes/:id/live/session → (NestJS verifies A is a JOINED member, returns paths+throttle)
   (backend also ensures routeMembers/<routeId>/<A>=true via firebase-admin — see §7.6)
write presence/<routeId>/<A> {running, onDisconnect→offline}
write liveSessions/<routeId>/<A> (overwrite, throttled ~1/2s) ─────►  subscribes liveSessions/<routeId>
                                                                      renders A's marker live
                                 ◄── B writes its own node ─────────  (B is also a runner; symmetric)
on tab close / network loss → onDisconnect() flips presence.online=false, frees connection slot
```

The REST API and RTDB never proxy each other on the hot path: live positions go **client → RTDB directly** (latency is the point); durable state goes **client → NestJS → Postgres**. NestJS only *authorizes* live joins, *maintains the RTDB membership index*, and *persists* the final track.

---

## 3. Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Frontend framework | **React + Vite + React DOM (TypeScript, strict)** | Fast dev, web-first PWA today; React/TS carries 1:1 into the Capacitor WebView later. |
| Shipping format | **PWA** (`vite-plugin-pwa` / Workbox) → **Capacitor Android** later | Installable, app-like now; Capacitor is additive (wraps the same `dist/`), not a fork. |
| Maps rendering | **MapLibre GL JS** | Open-source vector maps; same JS API in PWA and Capacitor; supports drawing + custom layers. |
| Map tiles | **OpenFreeMap** (no key) now → self-host **Protomaps PMTiles** later | Free, keyless start; PMTiles protocol registered now so the swap is a style-URL change. |
| Route drawing | **Terra Draw** (MapLibre adapter) | Drag/edit polyline control points; feeds the snap-to-road call. |
| Routing / snap-to-road | **OpenRouteService** REST (`foot-walking`) now → self-host **GraphHopper + Valhalla** later | Free tier covers PoC; only snap-to-road is in scope now. |
| State / data fetching | **Redux Toolkit + RTK Query** + `redux-persist` | Carried over from the existing app; RTK Query base API injects the Firebase token. |
| Validation | **`class-validator` + `class-transformer` DTOs**, global `ValidationPipe({ whitelist:true, forbidNonWhitelisted:true, transform:true })` | Enforces wire contracts; `whitelist` strips client-injected fields like `userId`. |
| Local point buffer | **IndexedDB** (`idb`) | Durable recording buffer; survives reload/crash for upload-on-finish + recovery. |
| Auth | **Firebase Auth** (email/password + Google), Spark tier | Backend verifies ID tokens (free, local JWT verification); no custom user-id minting. |
| Realtime / live tracking | **Firebase Realtime Database**, Spark tier | Low-latency fan-out + `onDisconnect()` presence; ephemeral only, mind the 100-connection cap. |
| Backend | **NestJS + Prisma** (existing) | Reuse the existing `Activity`/`ActivityLocation` foundation and `BigIntInterceptor`. |
| Database | **PostgreSQL + PostGIS** (`postgis/postgis` Docker image) | **Required** for segment trace matching (`geometry`/`geography`, `ST_DWithin`, GiST). |
| Hosting | **Docker Compose + Caddy** on **Oracle Cloud free-tier aarch64 VM** | Self-host, zero cost; the existing `Caddyfile` already terminates TLS. |
| Push (later) | **FCM** via Capacitor | Deferred; `PushService` stub exists now. |
| Media (later) | **Cloudflare R2** | Deferred; presigned-URL endpoint added when needed. |

---

## 4. Frontend: PWA-now / Capacitor-later

The PWA build and the future Capacitor build differ in a small, enumerated set of places: where GPS comes from, how points upload (web `fetch` is throttled/frozen in the background; native `CapacitorHttp` is not), how push works, and **the Google sign-in provider only** (the rest of `AuthService` is shared). Each is isolated behind a thin **adapter interface**. Everything else — UI, Redux state, RTK Query, MapLibre, drawing, geo/elevation math, the IndexedDB buffer, and the RTDB live code — is platform-agnostic and carries over unchanged.

```
features/  screens/  components/  lib/map  store/  services/api   ← unchanged across PWA & Capacitor
            │  import { useLocationTracker } from '@/adapters'  (interface, not impl)
            ▼
adapters/index.ts  ── createAdapters() gated by Capacitor.isNativePlatform() ──┐
   LocationTracker   PointUploader   AuthService   PushService                  │
        │                 │              │ (shared    │                         │
   web/ │ native/    web/ │ native/   impl; Google  web/ │ native/  ← native/* swapped at migration
                                       provider swap)                 (AuthService: provider-only swap)
```

**Rule of thumb:** if a line calls a browser/native API directly (`navigator.geolocation`, `fetch` to our ingest endpoint, `firebase/messaging`, a token getter), it belongs in an adapter — never in a feature.

> **Honest accounting of what swaps at migration.** Three adapters are *whole-implementation* swaps (`LocationTracker`, `PointUploader`, `PushService`). `AuthService` is a **partial, provider-only swap**: a single shared `WebAuthService` is used in both builds, and only the *Google sign-in path* is delegated to a native plugin when running natively (email/password and `getIdToken` are byte-for-byte identical). So the boundary is "three adapters + one provider inside the fourth," not "four whole adapters." §4.2 and §4.5 reflect this precisely.

### 4.1 Adapter interfaces (`src/adapters/types.ts`)

Thin, framework-free (no React), start/stop/callback shapes. React hooks (`useLocationTracker`, `useAuth`, …) wrap them for components.

- **`LocationTracker`** — owns the GPS subscription only. Does **not** compute distance/pace or manage pause state (that is platform-agnostic feature logic in `features/recording`).
  ```ts
  export interface GeoPoint {
    lat: number; lng: number; timestamp: number;       // epoch ms (device clock)
    altitude: number | null; speed: number | null; accuracy: number | null;
  }
  export type TrackerState = 'idle' | 'acquiring' | 'tracking' | 'paused';
  export interface LocationTrackerOptions {
    minIntervalMs?: number;       // default 1000 — throttles to protect upload/RTDB budgets
    minDistanceM?: number;        // default 5
    maxAccuracyM?: number | null; // default 30 — drop low-quality fixes
    keepScreenOn?: boolean;       // PWA: hold a Screen Wake Lock while tracking; default true
  }
  export interface LocationTracker {
    start(opts?: LocationTrackerOptions): Promise<void>; // resolves on first acceptable fix
    pause(): void; resume(): void; stop(): Promise<void>;
    onPosition(cb: (p: GeoPoint) => void): () => void;
    onStateChange(cb: (s: TrackerState) => void): () => void;
    onError(cb: (e: { code: 'PERMISSION_DENIED'|'POSITION_UNAVAILABLE'|'TIMEOUT'|'WAKELOCK_LOST'|'UNKNOWN'; message: string }) => void): () => void;
  }
  ```
  - **Web (now):** `navigator.geolocation.watchPosition(…, { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 })`; applies the interval/distance/accuracy filters before emitting; acquires `navigator.wakeLock.request('screen')` on start and **re-acquires on `visibilitychange → visible`** (browsers auto-release when hidden); emits `WAKELOCK_LOST` if re-acquisition fails.
  - **Native (later):** wraps `@capacitor-community/background-geolocation` (Android **foreground service** with persistent notification, GPS continues screen-off). `keepScreenOn` becomes a no-op. Same callback shape → feature code untouched.

- **`PointUploader`** — buffers points to IndexedDB first (durable), flushes in idempotent batches keyed by `(activityId, seq)`. The `activityId` is **client-generated at recording start** (UUID v4), so batches are addressable before any server row exists.
  ```ts
  export interface PointUploader {
    enqueue(activityId: string, points: GeoPoint[]): Promise<void>; // IndexedDB write, never lost
    flush(): Promise<{ uploaded: number; pending: number }>;
    startAutoFlush(intervalMs: number): void; stopAutoFlush(): void;
    pendingCount(): Promise<number>;
  }
  ```
  - **Web (now):** `enqueue` → IndexedDB; auto-flush POSTs via `fetch` with the Firebase token; also flushes on `visibilitychange → hidden` and uses `navigator.sendBeacon` as a **best-effort** last gasp on unload (see token caveat below). Removes a batch from IndexedDB only after a 2xx.
  - **Native (later):** same buffer, flush via **`CapacitorHttp`** so uploads survive screen-off/app-background (defeats the WebView's ~5-min background throttle).

  > **`sendBeacon` + token-expiry caveat (explicit).** A Firebase ID token lives ~1 h; a long run can outlive it, and `sendBeacon` fires synchronously on `unload` with **no ability to await a fresh token**. The beacon therefore carries the *last-known* token and may 401 server-side. **Beacon is best-effort only.** The real durability guarantee is IndexedDB + crash recovery: any batch the beacon fails to deliver remains buffered and is re-flushed (against the same `activityId`/`seq`) on next launch via the "Recover unfinished activity" path (§7.4). The server tolerates a stale-but-valid-signature beacon where it can but never depends on it.

- **`AuthService`** — wraps Firebase Auth; hides token acquisition so RTK Query `prepareHeaders` and `PointUploader` just ask for a fresh token.
  ```ts
  export interface AuthService {
    signInWithEmail(e: string, p: string): Promise<AuthUser>;
    signUpWithEmail(e: string, p: string): Promise<AuthUser>;
    signInWithGoogle(): Promise<AuthUser>;   // ← the only method whose impl differs natively
    signOut(): Promise<void>;
    current(): AuthUser | null;
    getIdToken(forceRefresh?: boolean): Promise<string | null>;  // for the NestJS guard
    onAuthStateChanged(cb: (u: AuthUser | null) => void): () => void;
  }
  ```
  - **Web (now):** Firebase JS SDK (`signInWithEmailAndPassword`, `signInWithPopup(GoogleAuthProvider)`, `onIdTokenChanged`, `getIdToken`). The **same `WebAuthService` instance is used in both PWA and Capacitor** (the JS SDK runs in the WebView).
  - **Native (later):** **provider-only swap** — `signInWithGoogle()` delegates to `@capacitor-firebase/authentication` (native account picker, avoids WebView popup limits) and then bridges the credential back into the JS SDK so `getIdToken`/`onAuthStateChanged` are unchanged. Email/password and the token contract are identical. This is a partial swap inside one shared adapter, not a separate native adapter class.

- **`PushService`** — no-op stub today; interface exists so feature code needs no later branching.
  - **Web (now):** returns `'unsupported'` / `null`.
  - **Native (later):** wraps `@capacitor/push-notifications` + FCM; `getToken()` returns the FCM token; `POST_NOTIFICATIONS` requested on Android 13+.

### 4.2 Composition root (`src/adapters/index.ts`)

```ts
import { Capacitor } from '@capacitor/core'; // present in the PWA build too; reports 'web'
export function createAdapters(): Adapters {
  const native = Capacitor.isNativePlatform();   // false in PWA, true in Capacitor shell
  // NOTE: WebAuthService is intentionally used in BOTH branches. Native-ness only changes
  // the Google sign-in *provider* inside it (set via a flag), not the adapter class.
  const auth = new WebAuthService({ nativeGoogle: native });
  return native
    ? { location: new NativeLocationTracker(), uploader: new NativePointUploader(),
        auth,                                   push: new NativePushService() }
    : { location: new WebLocationTracker(),     uploader: new WebPointUploader(),
        auth,                                   push: new WebPushService() };
}
```

Instances are provided once via `AdaptersProvider` (React context) and consumed through hooks. **No feature imports a `web/` or `native/` file directly.** Native plugin modules are loaded via dynamic `import()` so the web-only build never references uninstalled Capacitor packages; tree-shaking keeps the native bundle out of the PWA.

### 4.3 Project structure

```
src/
├── adapters/                 # ⭐ device-capability boundary
│   ├── types.ts  index.ts    # interfaces + createAdapters() + provider/hooks
│   ├── web/                  # PWA impls now (location/uploader/auth/push .web.ts)
│   └── native/               # Capacitor impls later (.native.ts)
├── features/                 # platform-agnostic logic + Redux slice + RTK Query endpoints + hooks
│   ├── routes/               #   draw + snap-to-road + elevation + save (Terra Draw + ORS)
│   ├── recording/            #   consumes LocationTracker + PointUploader; pace/distance/splits
│   ├── live/                 #   Firebase RTDB presence + throttled position fan-out
│   ├── leaderboards/         #   best-effort vs PostGIS segment results
│   ├── membership/           #   invite users to a route
│   └── permissions/          #   permission primer + capability gating (§7.0)
├── screens/                  # launch/auth, home, record, summary, route-builder, route-detail,
│                             #   routes-list/explore, leaderboard, live, invites, profile, settings
├── components/map/           # MapView, RouteLayer, LiveRunnersLayer, DrawControl
├── lib/
│   ├── map/                  # MapLibre style + PMTiles protocol registration + OpenFreeMap style
│   ├── firebase/             # Firebase app init (auth + rtdb)
│   ├── db/                   # IndexedDB (idb) point buffer + offline cache
│   └── geo/                  # Haversine, elevation, GeoJSON helpers (no device APIs)
├── services/api.ts           # RTK Query base API; prepareHeaders pulls token from AuthService
├── store/                    # configureStore + redux-persist
└── main.tsx                  # registers PMTiles protocol + AdaptersProvider
```

### 4.4 Screen inventory → endpoint ownership

Every inventory page has an explicit owner. (Screens, not adapters; all data via RTK Query unless noted.)

| Screen | Shows | Backed by |
|---|---|---|
| **Launch & Authentication** | Sign-in / sign-up (email + Google) | `AuthService`; `POST /api/auth/me` on success |
| **Permissions Primer** (§7.0) | Pre-prompt rationale for geolocation + wake-lock (web); placeholder copy for Android 13+ `POST_NOTIFICATIONS` / background-location (native) | client-only; no endpoint |
| **Home / Dashboard** | "Record" CTA; recent activities (last 5); lifetime totals (count, distance, time); pending invites badge | `GET /api/activities?limit=5`; `GET /api/stats/summary`; `GET /api/invites` |
| **Routes List** (mine/member) | Routes I own or joined | `GET /api/routes?scope=mine` and `?scope=member` |
| **Explore** | **Public** routes (discover) | `GET /api/routes?scope=public` (≡ `isPublic=true`, excludes private/invite-only I'm not in) |
| **Create Route** (Route Builder) | Draw + snap + elevation + save | `POST /api/routing/snap`; `POST /api/routes` |
| **Route Detail** | Geometry, segments, members, leaderboard entry, "record on this" | `GET /api/routes/:id`; `GET /api/routes/:id/leaderboard` |
| **Invite / Manage Members** | Invite by email; member list + status; remove/leave | `POST /api/routes/:id/invites`; `GET …/members`; `DELETE …/members/:userId` |
| **Record** (foreground tracking) | Live map line + time/distance/pace; Start/Stop | `LocationTracker`+`PointUploader`; `POST /api/activities` on Stop |
| **Activity Summary** (post-save) | Immediate "saved!"/"New PR!" view | **Consumes the `POST /api/activities` response directly** (incl. `bestEfforts`) — no re-fetch |
| **Activity Detail** (later retrieval) | Map, splits, efforts for a past run | **Re-fetches** `GET /api/activities/:id` (returns the same `bestEfforts` shape) |
| **Route Leaderboard** | Ranked best times; my rank | `GET /api/segments/:segmentId/leaderboard[/me]` |
| **Live / Spectate** | Self + other runners live on a route | `POST /api/routes/:id/live/session` then direct RTDB subscribe |
| **Invites** (inbox) | My pending invites; accept/decline | `GET /api/invites`; `POST /api/invites/:id/accept\|decline` |
| **Profile** | Display name, photo, lifetime stats | `GET /api/auth/me`; `PATCH /api/auth/me`; `GET /api/stats/summary` |
| **Settings** | Units (km/mi), default activity type, permission re-prompt toggles, sign-out | client-prefs in `redux-persist` (units/default type are **client-only** for PoC); `AuthService.signOut()`; deep-links to Permissions Primer |

> **Summary vs Detail (explicit):** the "New PR!" experience is driven entirely by the `bestEfforts` array returned **in the `POST /api/activities` response** and rendered by **Activity Summary**. **Activity Detail** is a separate, later view that re-fetches `GET /api/activities/:id`. They share a component but differ in data source; matching is never re-run on read.

### 4.5 PWA setup

- `vite-plugin-pwa` with `registerType: 'autoUpdate'`; Workbox precaches the app shell and runtime-caches the OpenFreeMap **style JSON + glyphs/sprites** (`StaleWhileRevalidate`). **Do not** indiscriminately precache map tiles (quota/bandwidth) — cache only a small viewport budget.
- Manifest: `display: 'standalone'`, portrait, maskable icons (192/512), theme/background colors → Android Chrome offers Add to Home Screen and launches chrome-less.
- Register the **PMTiles protocol** on MapLibre in `main.tsx` so OpenFreeMap → self-hosted PMTiles is later a style-URL change, not a code change.
- The service worker is **app-shell caching only** — it is explicitly **not** a substitute for background GPS.

### 4.6 Capacitor migration checklist

**Add the shell:** `npm i @capacitor/core @capacitor/cli && npx cap init`; `npm i @capacitor/android && npx cap add android`; point `webDir` at Vite `dist/`; `npm run build && npx cap sync`.

**Install native plugins:** `@capacitor-community/background-geolocation`, `@capacitor/push-notifications` + Firebase FCM, `@capacitor-firebase/authentication`, `@capacitor/app` / `@capacitor/status-bar`.

**Swap at migration (only `adapters/native/*` + the `createAdapters` branch + one `AuthService` flag):** `LocationTracker` → FGS background-geolocation (whole impl); `PointUploader` → `CapacitorHttp` (whole impl); `PushService` → FCM (whole impl); `AuthService` → **same `WebAuthService`, `nativeGoogle:true`** routes only `signInWithGoogle()` through `@capacitor-firebase/authentication` (email/password + `getIdToken` unchanged). `Capacitor.isNativePlatform()` returns `true` and wires the native branch automatically.

**Android manifest / permissions:** `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION`, **`ACCESS_BACKGROUND_LOCATION`**; `FOREGROUND_SERVICE` + **`FOREGROUND_SERVICE_LOCATION`** (Android 14+) with `<service … foregroundServiceType="location">`; **`POST_NOTIFICATIONS`** (Android 13+); `INTERNET`; battery-optimization exemption prompt for long runs. The **Permissions Primer** screen (§7.0) gains the native rationale copy at this point.

**Carries over unchanged (the payoff):** all of `features/`, `screens/`, `components/`, `lib/map`, `lib/geo`, `store/`, `services/api.ts`, RTK Query endpoints, Redux slices, MapLibre + Terra Draw, elevation/leaderboard logic, the IndexedDB buffer schema, the RTDB live code, and the adapter interfaces themselves. The PWA build stays shippable in parallel.

---

## 5. Data Model

### 5.1 Design principles

- **PostGIS is the source of truth.** All durable geometry lives in Postgres as **`geometry(...,4326)`** (WGS84 lon/lat), cast to `::geography` only for metric calls so distances return in **meters** with no manual projection — see the §2.1 geometry-type policy (this is why columns are `geometry`, never `geography`). The recorded track is a **`geometry(LineStringM,4326)`** whose `M` ordinate carries each vertex's epoch-ms timestamp (the trick that lets segment matching recover *when* the runner reached any point without a side-table join — see §7.5). `M` is only possible because the column is `geometry`.
- **Firebase RTDB is ephemeral.** It holds only in-flight live positions + presence + a backend-maintained membership index for rules. Nothing in RTDB is authoritative; on save, the final track is persisted to Postgres and the live node is cleared.
- **User identity is Firebase.** We never mint our own user ids — the verified Firebase `uid` is the PK/FK everywhere. The guard upserts the `User` on first authenticated request.
- **Prisma + raw PostGIS.** Prisma has no geometry type, so geometry columns are declared `Unsupported("geometry(...,4326)")` (Prisma migrates them but can't read/write them through the typed client). All geometry I/O goes through `$queryRaw` / `$executeRaw` with `ST_*`. Indexes are added via SQL migrations.

```prisma
// schema.prisma — required header for PostGIS (extends the current bare datasource/generator)
datasource db {
  provider   = "postgresql"
  url        = env("DATABASE_URL")
  directUrl  = env("DIRECT_URL")
  extensions = [postgis]
}
generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["postgresqlExtensions"]
}
```

> Migration from the current schema: `ActivityLocation` → `ActivityPoint` (PostGIS `geometry(Point,4326)` + `recordedAtMs bigint` + `accuracyM`); `Activity` gains `userId`, optional `routeId`, and the `track geometry(LineStringM,4326)`; new tables `User`, `Route`, `RouteWaypoint`, `Segment`, `RouteMembership`, `RouteEffort`. The `BigInt` epoch-ms convention and `BigIntInterceptor` (serialize-to-string) are preserved. **Data-migration path is documented in §8** (the existing volume holds stock-postgres data and will not auto-acquire the PostGIS extension).

### 5.2 Relational entities (PostgreSQL + PostGIS)

| Table | Purpose | PostGIS column (all `geometry`, cast `::geography` for meters) |
|---|---|---|
| `User` | Mirror of a Firebase auth user (`id` = uid) | — |
| `Route` | Planned/drawn route (snapped path) | `path geometry(LineString,4326)` |
| `RouteWaypoint` | Editable draw anchors (pre-snap) | `point geometry(Point,4326)` |
| `Segment` | Matchable stretch for leaderboards (default = full route) | `path geometry(LineString,4326)` |
| `RouteMembership` | Invite/join relationship | — |
| `Activity` | A recorded run | `track geometry(LineStringM,4326)` |
| `ActivityPoint` | Per-sample GPS point (raw fidelity + timestamps) | `point geometry(Point,4326)` |
| `RouteEffort` | A matched effort (one valid pass of a segment) | — |

**`User`** — `id text PK (= Firebase uid)`, `email text unique`, `displayName?`, `photoUrl?`, `emailVerified bool`, `createdAt`, `updatedAt`/`lastSeenAt`. Upserted on first authenticated request.

**`Route`** — `id uuid PK`, `ownerId → User.id (cascade)`, `name`, `description?`, **`path geometry(LineString,4326)`** (snapped ORS output, authoritative), `distanceM double` (cached `ST_Length(path::geography)`), `elevationGainM?`, `elevationProfile jsonb?` (`[{distM,eleM}]` for the chart), `isPublic bool default false`, timestamps.

**`RouteWaypoint`** — `id uuid PK`, `routeId → Route (cascade)`, `seq int`, **`point geometry(Point,4326)`**. Stores user-dragged anchors so a route can be re-edited/re-snapped without losing intent.

**`Segment`** — `id uuid PK`, `routeId → Route (nullable)`, `name`, **`path geometry(LineString,4326)`**, `distanceM double`, `startBuffer`/`endBuffer double default 25` (match tolerance, m), `createdAt`. PoC default: one segment per route equal to the full path, auto-created on route save; kept separate so sub-segments (a hill, a lap) can be added later without schema change.

**`RouteMembership`** — `id uuid PK`, `routeId → Route (cascade)`, `userId → User`, `role enum(OWNER,MEMBER) default MEMBER`, `status enum(INVITED,JOINED,DECLINED) default INVITED`, `invitedById → User?`, `invitedEmail text?` (set when invitee has no account yet), timestamps. **`UNIQUE(routeId, userId)`**.

**`Activity`** — `id uuid PK (client-generated UUID v4)`, `userId → User (cascade)`, `routeId → Route (nullable)`, `title`, `type enum(RUN,JOG,WALK) default RUN`, `startedAt`/`endedAt timestamptz`, `durationMs bigint`, `distanceM double` (`ST_Length(track::geography)`), `elevationGainM?`, `avgPaceSPerKm?`, **`track geometry(LineStringM,4326)`** (built once at save via `ST_MakeLine`; `M` = epoch-ms), timestamps.

**`ActivityPoint`** — `id bigserial PK`, `activityId → Activity (cascade)`, `seq int`, **`point geometry(Point,4326)`**, `elevationM real?`, `recordedAtMs bigint` (epoch-ms; **this is the column the matching SQL reads** — see §7.5), `accuracyM real?`. Per-point timestamps are required for pace/splits and best-effort timing (a `LineString` is geometry-only — which is exactly why we store both the point array **and** the derived `LineStringM` track).

**`RouteEffort`** — `id uuid PK`, `routeId → Route (cascade)`, **`segmentId → Segment (cascade)`**, `userId`, `activityId → Activity (cascade)`, `elapsedMs bigint`, `coverage real` (audit; the matching coverage fraction), `startedAt timestamptz`, `createdAt`. **`UNIQUE(segmentId, activityId)`** for idempotent re-matching (one activity yields at most one effort *per segment*; a route with N segments can produce N efforts from one run). We keep all efforts (history/PRs); the leaderboard derives each user's best with `DISTINCT ON`.

> **Units & naming (fixed, consistent):** every **duration** is **milliseconds** and the column/field name ends in `Ms` (`durationMs`, `elapsedMs`). Every **distance** is **meters**, name ends in `M` (`distanceM`, `elevationGainM`). Both are stored as `bigint` (durations) / `double` (distances) — no 32-bit `int` durations anywhere (a 24-day cap is avoided and the type matches the rest of the schema). The **API exposes the same units it stores**: the leaderboard response field is **`elapsedMs`** (not `elapsedSeconds`) and the activity duration field is **`durationMs`**. Clients format for display.

### 5.3 ERD (text)

```
User 1─N Route (ownerId)   User 1─N Activity   User 1─N RouteMembership   User 1─N RouteEffort
Route 1─N RouteWaypoint     Route 1─N Segment   Route 1─N RouteMembership [UNIQUE(routeId,userId)]
Route 1─N Activity (optional, Activity.routeId nullable)   Route 1─N RouteEffort
Segment 1─N RouteEffort [UNIQUE(segmentId,activityId)]
Activity 1─N ActivityPoint   Activity 1─N RouteEffort (the run that set the time, ≤1 per segment)
```

### 5.4 Indexes (run in SQL migration)

```sql
CREATE EXTENSION IF NOT EXISTS postgis;
-- GiST (mandatory: ST_DWithin / && only use a spatial index if one exists). Columns are geometry.
CREATE INDEX route_path_gix     ON "Route"        USING GIST (path);
CREATE INDEX segment_path_gix   ON "Segment"      USING GIST (path);
CREATE INDEX activity_track_gix ON "Activity"     USING GIST (track);
-- B-tree
CREATE INDEX route_owner_idx    ON "Route"            ("ownerId");
CREATE INDEX route_public_idx   ON "Route"            ("isPublic");        -- Explore feed
CREATE INDEX waypoint_route_seq ON "RouteWaypoint"    ("routeId","seq");
CREATE INDEX membership_user    ON "RouteMembership"  ("userId");
CREATE INDEX membership_route   ON "RouteMembership"  ("routeId");
CREATE INDEX membership_email   ON "RouteMembership"  ("invitedEmail");   -- claim-on-signup
CREATE INDEX activity_user_idx  ON "Activity"         ("userId");
CREATE INDEX activity_route_idx ON "Activity"         ("routeId");
CREATE INDEX actpoint_act_seq   ON "ActivityPoint"    ("activityId","seq");
CREATE INDEX effort_leaderboard ON "RouteEffort"      ("segmentId","elapsedMs");  -- covers ORDER BY
CREATE INDEX effort_user_idx    ON "RouteEffort"      ("segmentId","userId");
```

### 5.5 Firebase RTDB structure (ephemeral live tracking + membership index)

Keys mirror relational IDs (`routeId` = `Route.id`, `userId` = uid = `User.id`) so the client cross-references live RTDB data with REST data. The **producer** of the `liveSessions`/`presence`/`connections` writes is the client (`LocationTracker` → live writer); the **`routeMembers` index is written exclusively by the backend** via `firebase-admin` (§7.6) so Security Rules have a trustworthy membership source. The **structure does not change** between PWA and Capacitor — only the adapter implementation behind the client writes does.

```jsonc
{
  "liveSessions": {                         // live positions, fanned out per route (client writes)
    "<routeId>": {                          // = Route.id (or "free:<activityId>" for non-route runs)
      "<userId>": {                         // = uid = User.id
        "lat": 37.7821, "lng": -122.4012, "ele": 34.2, "speed": 3.1, "heading": 145,
        "ts": 1717200000123,                // client epoch ms (+ serverTimestamp on write)
        "activityId": "a1b2…",              // = the client-generated Activity.id being recorded
        "seq": 412                          // monotonic sample counter
      }
    }
  },
  "presence": {                             // who is live on which route (client writes)
    "<routeId>": { "<userId>": {
      "displayName": "Jamie", "photoUrl": "https://…",
      "state": "running",                   // running | paused
      "startedAt": 1717199990000, "lastSeen": 1717200000123,
      "online": true                        // set false by onDisconnect()
    } }
  },
  "routeMembers": {                         // ⭐ access-control index — BACKEND-ONLY writes (firebase-admin)
    "<routeId>": { "<userId>": true }       // mirrors RouteMembership(status=JOINED); rules read this
  },
  "connections": {                          // per-connection liveness drives presence cleanup (client)
    "<userId>": { "<connectionId>": true }  // onDisconnect() removes; last one flips presence.online=false
  }
}
```

**RTDB ↔ Postgres mapping:** `liveSessions/{routeId}` = `Route.id`; `…/{userId}` = `User.id`; `…/{userId}.activityId` = the in-progress (client-generated) `Activity.id`; `presence/{routeId}/{userId}` ⇔ `RouteMembership(routeId,userId)`; **`routeMembers/{routeId}/{userId}` is the backend-maintained mirror of `RouteMembership(status=JOINED)`** that the Security Rules consult; RTDB live points (transient) ⇒ `ActivityPoint` rows (durable) only via the explicit `POST /api/activities` at finish.

### 5.6 Storage volume & RTDB bandwidth budget

**Postgres storage.** A typical 30-min / 5 km run at ~1 Hz ≈ **1,800 points** ≈ **~0.15–0.2 MB** (`ActivityPoint` rows dominate; the `LineStringM` track is ~30 KB). Even **10,000 runs ≈ ~2 GB**, comfortably within the Oracle free-tier VM. Optionally store a simplified line (`ST_SimplifyPreserveTopology`, ~5 m) for thumbnails later; PoC can skip it.

**RTDB download budget (per-route fan-out, the real cap).** Storage is near-zero (one overwritten node per active runner), but **download** is `writers × viewers × updates × payload × duration` and is what threatens the **10 GB/mo** Spark cap. Each `liveSessions` update is ~120 bytes; with the **2 s** throttle that's **1,800 updates/runner/hour**. A subscriber to `liveSessions/<routeId>` downloads **every runner's** update:

| Runners (R) | Viewers (V) | Downloaded/hour ≈ R·V·1800·120 B | Notes |
|---|---|---|---|
| 5 | 5 | ~5.4 MB | comfortable |
| 10 | 10 | ~21.6 MB | fine |
| 20 | 20 | ~86 MB | one busy event |
| 30 | 30 | ~194 MB | approaching daily prudence |

To stay well inside 10 GB/mo, the PoC enforces a **hard per-route live participant cap of `LIVE_MAX_PARTICIPANTS = 25`** (combined runners+viewers on a single `liveSessions/<routeId>` node), checked in `POST …/live/session` (it returns `429`/`live_full` past the cap), plus the **2 s** write throttle and stale-session filtering. 25 participants × 25 subscribers × ~1.6 MB/participant/hour ≈ ~135 MB/route-hour worst case — sustainable for PoC traffic, and the cap also keeps us clear of the 100-concurrent-connection limit.

---

## 6. Backend API

NestJS + Prisma over the `postgis/postgis` image, served behind the existing Caddy. JSON over HTTPS, base path **`/api`** (add `app.setGlobalPrefix('api')` in `main.ts` — the current bootstrap has no prefix; existing `/activities` routes are **extended**, not replaced). Timestamps/durations are Prisma `BigInt` serialized to **strings** by the existing global `BigIntInterceptor`; clients parse as numbers. IDs are UUID strings (activity IDs are **client-generated**).

**Validation & DTOs (mandated).** Every endpoint has a `class-validator` DTO. A global `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })` is registered in `main.ts`. `whitelist:true` **strips** any field not on the DTO (so a client-sent `userId` is silently dropped, never trusted), and `forbidNonWhitelisted:true` rejects obviously malformed bodies. This is the enforcement mechanism behind every "client must not send X" rule below — it is not left to convention.

**Body-size limit (single authoritative layer).** The body-size cap is enforced **at NestJS** via `express.json({ limit: '6mb' })` configured in `main.ts` — this is the authoritative limit. Caddy's `request_body max_size` is set **higher (8 MB)** purely as a coarse backstop so the two layers never silently disagree about who rejects an oversized upload (Nest rejects first with a clean `413`). 6 MB comfortably holds the capped 50k-point payload.

### 6.1 Firebase token verification guard

1. Client signs in with the Firebase Web SDK → ID token (JWT, ~1h). 2. Client sends `Authorization: Bearer <idToken>` on every request and refreshes via the SDK; the backend never sees refresh tokens. 3. A global `FirebaseAuthGuard` (`APP_GUARD`) verifies with `firebase-admin` `auth().verifyIdToken(token)`. 4. On success it **provisions** (idempotent upsert keyed by uid) and attaches the local `User` to `request.user`. 5. On failure → `401`.

```ts
@Injectable()
export class FirebaseAuthGuard implements CanActivate {
  constructor(private readonly users: UserService, private readonly reflector: Reflector) {}
  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    if (this.reflector.get('isPublic', ctx.getHandler())) return true;      // @Public()
    const req = ctx.switchToHttp().getRequest();
    const token = (req.headers.authorization ?? '').replace(/^Bearer\s+/i, '');
    if (!token) throw new UnauthorizedException('Missing bearer token');
    let decoded: admin.auth.DecodedIdToken;
    try { decoded = await admin.auth().verifyIdToken(token); }
    catch { throw new UnauthorizedException('Invalid or expired ID token'); }
    req.user = await this.users.upsertFromFirebase({                        // provision-on-first-request
      uid: decoded.uid, email: decoded.email ?? null, displayName: decoded.name ?? null,
      photoUrl: decoded.picture ?? null, emailVerified: decoded.email_verified ?? false,
    });
    return true;
  }
}
```

- `firebase-admin` is initialized **once** at bootstrap from a service account (`FIREBASE_SERVICE_ACCOUNT` / `GOOGLE_APPLICATION_CREDENTIALS`); the same SDK instance is reused for the RTDB membership-index writes (§7.6). Token verification is a **local public-key JWT check** — but the signing keys are Google-rotated, so `firebase-admin` **periodically refetches the public certs over the network**. "Free, no per-verify network call" is accurate; "works fully offline forever" is **not** — do not design for true offline verification.
- A `@CurrentUser()` param decorator returns `request.user`; controllers never touch tokens. Cache `uid → User` briefly and rate-limit `lastSeenAt` writes (≤1/min) to avoid a DB write per request.
- **Public:** only `GET /api/health`.

### 6.2 Endpoints by feature

All require a valid token unless marked Public. `4xx` bodies are Nest's default `{ statusCode, message, error }`. Lists are **cursor-paginated** (`?limit` default 20, max 100).

**Auth**
| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/auth/me` | Return current profile (the guard already upserts; this is a plain read). |
| `PATCH` | `/api/auth/me` | Update `displayName` / `photoUrl`. |

> **`POST /api/auth/me` removed.** The global guard upserts the `User` on *every* authenticated request, so a dedicated upsert endpoint is a no-op. Post-sign-in the client simply calls `GET /api/auth/me` (which has already been provisioned by the guard) — there is nothing for a `POST` to add.

**Stats** (Home/Dashboard + Profile)
| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/stats/summary` | Lifetime totals for the current user: `{ activityCount, totalDistanceM, totalDurationMs, lastActivityAt }`. Cheap aggregate over `Activity`. |

**Routes**
| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/routes` | Create from already-snapped geometry; server recomputes `ST_Length`, auto-creates a default full-route `Segment`. |
| `GET` | `/api/routes` | List visible routes (`?scope=mine\|member\|public`, `?limit`, `?cursor`). |
| `GET` | `/api/routes/:id` | One route (owner/member, or anyone if `isPublic`): geometry + segments + member count. |
| `PATCH` | `/api/routes/:id` | Update name/desc/visibility or replace geometry (owner only). |
| `DELETE` | `/api/routes/:id` | Delete (owner only; cascades). |

**Visibility rules (`?scope` reconciled with `isPublic`):** `mine` = routes I own; `member` = routes where I have a `JOINED` `RouteMembership`; `public` = routes with `isPublic=true` (the **Explore** feed). A private (`isPublic=false`) route is visible only to its owner and `JOINED` members — never via `public`. There is no `scope=all`; Explore is precisely `scope=public`.

`POST /api/routes` body: `{ name, description?, visibility: 'private'|'invite'|'public', geometry: GeoJSON LineString (WGS84), distanceMeters (advisory; server recomputes), elevation: { gainMeters, lossMeters, profile:[{distM,eleM}] } }`. (`visibility:'public'` sets `isPublic=true`; `private`/`invite` set `false`.)

**Routing (snap-to-road)** — primary path is **client-side** (browser calls ORS directly), then POST the finished geometry. A thin proxy hides the ORS key and centralizes throttling:
| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/routing/snap` | Proxy a drawn polyline to ORS `directions` (`foot-walking`); return snapped GeoJSON LineString + distance. Holds `ORS_API_KEY` server-side, per-user throttle, never stores the result. |

> **ORS budget-exhaustion / degraded mode (specified).** The cache key is `sha1(roundedCoords@5dp + profile)` (≈1 m rounding) with a short in-memory TTL so identical drags don't re-bill. A per-`userId` token bucket (1/s, 100/day) sheds load before ORS. **When the shared ORS daily quota (2,000/day) or the per-user bucket is exhausted, `/api/routing/snap` returns `200` with `{ snapped:false, geometry:<original unsnapped polyline>, distanceM:<haversine of input>, reason:'ROUTING_BUDGET_EXHAUSTED' }`** rather than failing the route build. The client renders the raw drawn polyline, shows a non-blocking "couldn't snap to roads — saved as drawn" notice, and still allows save (`Route.path` = unsnapped line). Matching tolerances absorb the reduced precision. This keeps route creation functional under quota exhaustion.

**Invites / Membership**
| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/routes/:id/invites` | Invite by email (owner only) → membership `INVITED`. |
| `GET` | `/api/routes/:id/members` | List members + status. |
| `POST` | `/api/invites/:inviteId/accept` | Accept → `JOINED` (backend mirrors `routeMembers/<routeId>/<uid>=true` in RTDB). |
| `POST` | `/api/invites/:inviteId/decline` | Decline → `DECLINED`. |
| `GET` | `/api/invites` | My pending invites. |
| `DELETE` | `/api/routes/:id/members/:userId` | Remove a member (owner) or leave (self); backend removes the RTDB `routeMembers` entry. |

If the invited email has no `User` yet, the invite is stored against `invitedEmail` and **claimed** on that person's first authenticated request (match `email` → pending invites).

**Activities** — upload-on-finish; **no `start` endpoint**. The `activityId` is **client-generated (UUID v4) at recording start**, so the client owns the id for the whole run (RTDB references it, `PointUploader` keys batches on it). `POST /api/activities` **upserts on that id**, so retries, `sendBeacon`, and crash-recovery re-sends all converge on one row — no DB write occurs until finish.
| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/activities` | Upsert a finished activity (client `id` + track + stats); builds `track`, runs segment matching, returns `bestEfforts`. |
| `GET` | `/api/activities` | List **my** activities (`?limit`, `?cursor`, `?routeId`). |
| `GET` | `/api/activities/:id` | One activity (owner, or anyone if its route is public). |
| `GET` | `/api/routes/:id/activities` | Activities on a route (visible to members). |
| `DELETE` | `/api/activities/:id` | Delete my activity (cascades points + efforts). |

`POST /api/activities` body (single canonical wire shape, `{lat,lng,ts}`):
```jsonc
{
  "id": "a1b2c3d4-…",            // client-generated UUID v4 (idempotency key for the whole run)
  "title": "Morning run", "type": "RUN", "routeId": "…|null",
  "startedAt": 1717199990000, "endedAt": 1717200600000,   // epoch ms
  "distanceMeters": 5012, "durationMs": 610000,           // advisory; server recomputes distance
  "elevation": { "gainMeters": 42 },
  "points": [ { "lat": 37.78, "lng": -122.40, "ts": 1717199990000,
                "ele": 34.2, "accuracy": 8 } ]            // ⭐ canonical: lat/lng/ts (NOT latitude/longitude/timestamp)
}
```
> **Wire-shape reconciliation (one shape, stated mapping).** The **canonical wire shape is `{lat,lng,ts}`** — identical to the adapter's `GeoPoint` (`{lat,lng,timestamp}` → serialized as `ts`), so there is no client-side remap between recording and upload. The legacy `{latitude,longitude,timestamp}` shape from the current `ActivityController` is **dropped**; the existing endpoint is updated to the new DTO as part of the Phase 0 migration. Server maps each point: `ST_MakePointM(lng, lat, ts)` for the track and `(lng,lat)` + `recordedAtMs = ts` for `ActivityPoint`. **`userId` is never read from the body** (stripped by `whitelist`; taken from `@CurrentUser`). Response echoes the activity plus `bestEfforts: [{ segmentId, elapsedMs, rank }]`. Cap `points` length at **≤ 50k**; oversize → `413` (Nest body limit) or `400` (DTO `@ArrayMaxSize`).

**Leaderboard**
| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/segments/:segmentId/leaderboard` | Ranked best efforts (`?limit`, `?cursor`, `?period=all\|month\|week`). |
| `GET` | `/api/routes/:id/leaderboard` | Convenience: the route's default full-route segment. |
| `GET` | `/api/segments/:segmentId/leaderboard/me` | My best effort + my rank (even when off-page). |

Ranking = best (min) `elapsedMs` per user, derived from `RouteEffort` rows produced during upload (not recomputed on read), **scoped by `segmentId`** (matching the endpoint). `?period` applies a `startedAt` predicate (see §7.5). Scoped to route members (or anyone for public routes). The API uses **`RANK()`** semantics (ties share a rank, next rank skips) — fixed for the PoC contract.

**Live session (Firebase RTDB authorization)**
| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/routes/:id/live/session` | Verify the caller is a `JOINED` member; ensure the RTDB membership index; enforce the participant cap; return canonical RTDB paths + throttle policy + TTL. |
| `GET` | `/api/routes/:id/live/participants` | Optional read-through fallback; direct RTDB read is preferred. |

`POST …/live/session` response: `{ rtdbPath: "liveSessions/<routeId>", selfPath: "liveSessions/<routeId>/<uid>", ttlSeconds: 3600, throttleMs: 2000, maxParticipants: 25 }`. It (a) verifies membership, (b) **idempotently writes `routeMembers/<routeId>/<uid>=true` via `firebase-admin`** so Security Rules can authorize the subscribe, (c) rejects with `429 { reason:'live_full' }` if the route is at `LIVE_MAX_PARTICIPANTS`. The Firebase Web SDK is already authenticated (same sign-in), so **RTDB Security Rules** are the primary access control; this endpoint provisions the data those rules read. Live position fan-out and presence go **direct client ↔ RTDB**; durable track and leaderboards stay **proxied through NestJS + PostGIS**.

---

## 7. Feature Implementation Breakdown

### 7.0 Permissions primer (cross-cutting UX)

**Build:** a `features/permissions` module + **Permissions Primer** screen shown *before* the first sensitive prompt — it explains *why* the app needs each capability so the OS prompt isn't a cold, easily-denied surprise.
- **Web (now):** rationale for **geolocation** (high-accuracy, "only while recording") and **Screen Wake Lock** ("keeps the screen on so tracking continues"); a capability check that routes users with denied geolocation to a recovery explainer.
- **Native (later):** same screen gains copy for **Android 13+ `POST_NOTIFICATIONS`** (the foreground-service notification) and the **background-location rationale** required before requesting `ACCESS_BACKGROUND_LOCATION` (Android's two-step prompt). Reached again from **Settings** ("permission re-prompt toggles").
**Endpoints:** none (client-only). **Gotchas:** request geolocation only after the primer and only on a user gesture (Start); never request background location on web (it doesn't exist there).

### 7.1 Auth & onboarding

**Build:** Firebase project (email/password + Google providers); client `lib/firebase` init; `AuthService` web impl; `FirebaseAuthGuard` (global `APP_GUARD`) + `UserService.upsertFromFirebase`; `@Public()` + `@CurrentUser()` decorators; `auth/me` controller; client auth screens + route guards driven by `onAuthStateChanged`.
**Endpoints:** `GET/PATCH /api/auth/me` (no `POST` — the guard provisions).
**Libraries:** `firebase` (JS SDK), `firebase-admin` (backend).
**Gotchas:** initialize `firebase-admin` once (not per request); cache `uid → User` and throttle `lastSeenAt` writes; RTK Query `prepareHeaders` must call `getIdToken()` (which auto-refreshes near expiry) on every request; claim pending email invites at provisioning time; note that admin cert refetch needs occasional network (not truly offline).

### 7.2 Route creation (draw + snap-to-road)

**Build:** a `RouteBuilder` screen with MapLibre + **Terra Draw**; user drags control points; on drag-end, snap the polyline; render snapped line + an elevation-profile chart + total distance; save.
**Snap-to-road:** call **OpenRouteService** `directions` (`foot-walking`) **client-side** (recommended — tight interactivity, per-user quota), falling back to the `POST /api/routing/snap` proxy when the key must be hidden, and falling back again to the **unsnapped polyline** when the budget is exhausted (degraded mode, §6.2). Persist the user-dragged anchors as `RouteWaypoint[]` and the snapped (or unsnapped) result as `Route.path`.
**Endpoints:** `POST /api/routes` (server recomputes `ST_Length(path::geography)`, auto-creates the full-route `Segment`); `PATCH /api/routes/:id` to re-snap/replace geometry.
**Libraries:** MapLibre GL JS, Terra Draw, ORS REST, a chart lib for the profile; `lib/geo` for GeoJSON/elevation helpers.
**Gotchas:** **debounce** snapping to drag-end (not per pixel) to respect ORS's 40/min, 2,000/day; ORS uses `[lng,lat]` order; ORS returns distance + an elevation profile (request `elevation=true`) — store the profile as `jsonb` so the chart needs no recompute; cache identical snap requests briefly.

### 7.3 Invites & membership

**Build:** an invite-by-email UI on a route; a pending-invites inbox; member list with status; accept/decline; leave-route.
**Endpoints:** `POST /api/routes/:id/invites`, `GET /api/routes/:id/members`, `POST /api/invites/:id/accept|decline`, `GET /api/invites`, `DELETE /api/routes/:id/members/:userId`.
**RTDB membership index ownership (concrete):** on **accept**, on first **`POST …/live/session`**, and on any join, the backend writes `routeMembers/<routeId>/<uid> = true` via the singleton `firebase-admin` app; on **decline / remove / leave**, the backend deletes it. This is the *only* writer of `routeMembers/*` — the client never writes it — and it is what the §7.6 Security Rules read to authorize live access.
**Libraries:** `firebase-admin` (backend, for the index write); none extra on the client.
**Gotchas:** `UNIQUE(routeId,userId)` prevents duplicate memberships — use upsert on re-invite; invites to not-yet-registered emails are stored on `invitedEmail` and claimed at first sign-in; membership gates route reads, leaderboard visibility, **and** RTDB live access (via the backend-maintained `routeMembers` index).

### 7.4 Activity recording (GPS, foreground now)

**Build:** a recording screen consuming `LocationTracker` + `PointUploader`; compute live distance/pace/duration (platform-agnostic feature logic, **not** in the adapter); render the live track on the map; upload the full buffered track on Stop.
**Recording flow:** Start → **client generates `activityId` (UUID v4)** → `LocationTracker.start({keepScreenOn:true})` (wake lock + `watchPosition`); each filtered `GeoPoint` → in-memory state **and** `PointUploader.enqueue(activityId, …)` → IndexedDB; `startAutoFlush(10000)` POSTs batches (idempotent on `(activityId, seq)`); Stop → assemble full track → `POST /api/activities { id: activityId, … }` (upsert) → server matching → `{ bestEfforts }` → **Activity Summary** renders "New PR!" from that response; then clear the buffer.
**Foreground-only data-risk model (made honest in the UI):** while the tab is visible, fixes flow and batches flush; if the user switches apps / locks the screen, geolocation stops emitting after the throttle (recorded points are safe in IndexedDB) and the track gets a straight-line gap; returning re-acquires the wake lock and resumes. Show a persistent banner ("Recording — keep this screen on") and a "Tracking paused — return to the app" state on prolonged `hidden`. **True screen-off tracking is the explicit reason for the Capacitor migration** (FGS-backed `NativeLocationTracker`).
**Durability/recovery (the real guarantee):** IndexedDB survives reload/crash; on relaunch, check `pendingCount()` and offer "Recover unfinished activity" → re-flush against the **same `activityId`** (the upsert dedupes). Also flush on `visibilitychange → hidden` and via `sendBeacon` on unload — but **beacon is best-effort** (it can 401 on an expired token; §4.1), so recovery is the guarantee, not the beacon. Server idempotency (upsert on `id`, dedupe on `(activityId, seq)`) makes retries/beacon double-sends safe.
**Elevation gain (simple, shipped — not left open):** compute cumulative gain with a **noise-threshold filter** — sum positive deltas between consecutive `elevationM` samples **only when the rise exceeds `ELEV_GAIN_THRESHOLD_M = 3 m`** (ignoring sub-3 m device jitter), after a light 3-sample moving-median smooth. This is deliberately crude but yields a non-garbage `elevationGainM` at PoC; a DEM-based source is the deferred upgrade (§11).
**Endpoints:** `POST /api/activities`, `GET /api/activities`, `GET /api/activities/:id`, `DELETE /api/activities/:id`.
**Libraries:** Geolocation + Screen Wake Lock API (web), `idb`, `lib/geo` (Haversine + the elevation filter).
**Gotchas:** browsers auto-release the wake lock on hide — re-acquire on `visible`; filter low-accuracy fixes (`maxAccuracyM`) to cut jitter before distance math; cap `points` at 50k.

### 7.5 Segment matching & leaderboards (PostGIS)

Server-side, **synchronous on activity save**, after the `track` (`geometry(LineStringM,4326)`) is built. Backend-only — adapters never see it. **All geometry columns are `geometry`; every metric call casts `::geography` (§2.1).**

**Geometry build (same transaction as save):**
```sql
UPDATE "Activity" a SET track = sub.line
FROM (
  SELECT ST_SetSRID(ST_MakeLine(
           ST_MakePointM(p.longitude, p.latitude, p."recordedAtMs")  -- M = epoch-ms; (lng,lat) order!
           ORDER BY p.seq), 4326) AS line                            -- result is geometry(LineStringM)
  FROM "ActivityPoint" p WHERE p."activityId" = $1
) sub
WHERE a.id = $1;
```
> Two gotchas baked in: PostGIS points are `(longitude, latitude)` = (X, Y) — wrong order silently dumps every track in the Gulf of Guinea; and the third arg is **`recordedAtMs`** (the real column, §5.2), not a derived value — query and schema agree.

**Algorithm (per candidate route; cheap → expensive). Named SQL params map 1:1 to env vars (§7.5 thresholds):**
- `$corridor_m` = `MATCH_CORRIDOR_M` (corridor half-width, **25**)
- `$start_tol` / `$end_tol` = `MATCH_START_TOL_M` / `MATCH_END_TOL_M` (endpoint radius, **35**)
- `$min_coverage` = `MATCH_MIN_COVERAGE` (**0.80**)

1. **Candidate prefilter** (index-only, cheap): only routes whose bbox overlaps the track **and** the user is a member of —
   `SELECT r.id FROM "Route" r, "Activity" a WHERE a.id=$1 AND r.path && a.track AND ST_DWithin(r.path::geography, a.track::geography, $corridor_m);`
2. **Endpoint gate:** `ST_DWithin(a.track::geography, ST_StartPoint(r.path)::geography, $start_tol)` AND `… ST_EndPoint(r.path)::geography … $end_tol`. If either fails → not a match.
3. **Corridor coverage (primary signal):** buffer the route to a corridor and take the fraction of track vertices inside it; require `coverage_fraction >= $min_coverage`. Buffer the *route* (`ST_Buffer(r.path::geography, $corridor_m)` — fixed/cacheable for hot routes). Use `ST_DumpPoints` on the track for the fraction; a cheaper variant is the length-ratio `ST_Length(ST_Intersection(a.track, corridor)::geography) / ST_Length(a.track::geography)`. (`ST_LineLocatePoint`/`ST_LineInterpolatePoint` below operate on the **`geometry`** columns directly — they reject `geography`, which is exactly why the columns are `geometry`.)
4. **Elapsed time + direction:** use `ST_LineLocatePoint(r.path, vertex)` (geometry) to find the track vertices nearest the route start/end, recover their timestamps from the **`M` ordinate** via `ST_M` (only available because `track` is `geometry(LineStringM)`), require the end sample to be *later* than the start → `elapsed_ms`, and validate `start_frac ≲ 0.15`, `end_frac ≳ 0.85`. Optionally enforce **monotonic progression** through 5 ordered checkpoints (`ST_LineInterpolatePoint(r.path, k)` at 0/.25/.5/.75/1, each within `$corridor_m`, in time order) — the strongest, cheapest guard against shortcuts and reversed loops.
5. **Persist:** insert one `RouteEffort` **per matched segment** of the route with `ON CONFLICT (segmentId, activityId) DO UPDATE` (idempotent), storing `elapsedMs`, `coverage`, `startedAt`. (PoC: one full-route segment per route ⇒ one effort; the schema supports N.)

**Leaderboard query** (one query, window functions; **scoped by `segmentId`**, with the `?period` predicate):
```sql
WITH best AS (
  SELECT DISTINCT ON ("userId") "userId","activityId","elapsedMs","startedAt"
  FROM "RouteEffort"
  WHERE "segmentId" = $1                                   -- ⭐ per-segment, matches the endpoint
    AND ($period = 'all'
         OR "startedAt" >= now() - ($period_interval)::interval)   -- ⭐ month/week predicate
  ORDER BY "userId","elapsedMs" ASC                        -- min per user
), ranked AS (
  SELECT *, RANK() OVER (ORDER BY "elapsedMs" ASC) AS rank,
            COUNT(*) OVER () AS total_athletes
  FROM best )
SELECT * FROM ranked ORDER BY rank LIMIT $limit OFFSET $offset;
```
`$period_interval` is `'1 month'` / `'7 days'` when `?period=month|week` (else the date clause is skipped). A second query filters `ranked` by `"userId"=$me` for the current user's rank when off-page. Both hit `effort_leaderboard` (`segmentId, elapsedMs`). **`RANK()`** is the chosen contract (ties share a rank, next rank skips); `DENSE_RANK()` is *not* used.

**Recommended PoC thresholds (env vars; per-route overridable):** `MATCH_START_TOL_M`/`MATCH_END_TOL_M` = **35 m**; `MATCH_CORRIDOR_M` = **25 m** (30–40 m in urban canyons); `MATCH_MIN_COVERAGE` = **0.80**; start/end frac **≤0.15 / ≥0.85**; distance sanity band **0.8×–1.5×** route length; Fréchet **off** by default. Loop routes and very short routes (<300 m) are the main false-match risks — lean on checkpoint progression for them.

**When to run:** synchronously inside `ActivityService.create` (the upsert) after the track is built (single-digit ms for a handful of candidate routes → immediate "New PR!" response feeding Activity Summary). If route counts explode, move to a background job keyed off `activityId` — the algorithm is unchanged, only the trigger moves.
**Endpoints/files:** `GET /api/segments/:id/leaderboard[/me]`, `GET /api/routes/:id/leaderboard`; extend `activity.service.ts` with `matchActivity()` and `activity.repository.ts` to build `track` via `$queryRaw` after point insert.
**Gotchas:** GiST indexes are **mandatory** (no spatial index → full scan); cast to `::geography` for meter distances; `ST_Buffer` on geography is a planar approximation (fine at 10–40 m); densify before any optional Fréchet.

### 7.6 Live tracking (Firebase RTDB)

**Build:** a live map screen that subscribes to `liveSessions/<routeId>` and `presence/<routeId>` and renders one marker per online runner; the recording feature (when on a route) also *writes* the current position.
**Write cadence / throttling:** the live writer **overwrites a single position node** at the `throttleMs` returned by `POST …/live/session` (default **2000 ms**) — never appends history. Full-fidelity samples go to IndexedDB → Postgres in bulk, **not** to RTDB. Write only deltas (`lat`, `lng`, `ts`, light extras).
**Presence:** on Start, write `presence/<routeId>/<uid>` (`state:running`, `startedAt`) and register `onDisconnect()` to flip `presence…/online=false` and remove the `connections/<uid>/<connId>` node (frees a connection slot cleanly — impossible via REST). Update `lastSeen` each write.
**Membership index (backend-owned, the missing-writer fix):** the client never writes access-control data. The backend maintains `routeMembers/<routeId>/<uid>` via `firebase-admin` — written `=true` on invite-accept and on `POST …/live/session` (idempotent), deleted on decline/remove/leave (§7.3). The Security Rules read **this** node.
**Fan-out:** all route members subscribe to the same `liveSessions/<routeId>` node; each writes only their own `<uid>` subtree (enforced by rules).
**Free-tier guardrails (Spark: 100 concurrent connections, 1 GB stored, 10 GB/mo download):** throttle to `throttleMs`; single overwritten node (no history) → near-zero storage; `onDisconnect()` cleanup; **hard cap `LIVE_MAX_PARTICIPANTS = 25` per route** enforced in `POST …/live/session` (returns `429 live_full`), which bounds both the download fan-out (§5.6 table) and the connection count; client-side filter of ghost sessions where `lastSeen` > ~30 s; on Stop, delete the live node and set presence offline.
**Security Rules (concrete):**
```jsonc
{ "rules": {
  "liveSessions": { "$routeId": {
    ".read":  "auth != null && root.child('routeMembers').child($routeId).child(auth.uid).val() === true",
    "$uid": { ".write": "auth != null && auth.uid === $uid &&
                          root.child('routeMembers').child($routeId).child(auth.uid).val() === true" }
  } },
  "presence": { "$routeId": {
    ".read":  "auth != null && root.child('routeMembers').child($routeId).child(auth.uid).val() === true",
    "$uid": { ".write": "auth != null && auth.uid === $uid" }
  } },
  "routeMembers": { ".read": false, ".write": false },   // ⭐ backend-only (firebase-admin bypasses rules)
  "connections": { "$uid": { ".write": "auth != null && auth.uid === $uid" } }
} }
```
**Endpoints/structure:** `POST /api/routes/:id/live/session` (authorize + write `routeMembers` + enforce cap + return paths/throttle); RTDB tree per §5.5.
**Libraries:** `firebase/database` (client), `firebase-admin` (backend index writes).
**Gotchas:** the RTDB structure is identical PWA↔Capacitor (only the producing adapter changes); `routeMembers` is **backend-written only** (admin SDK bypasses Security Rules, so the `.write:false` rule is correct); RTDB is **never** authoritative — the durable track only ever lands via `POST /api/activities`.

---

## 8. Infrastructure & Deployment

**Existing compose facts (acknowledged):** the current `docker-compose.yml` runs **`postgres:latest`** with the data volume mounted at the **non-standard `/var/lib/postgresql`** (not `/var/lib/postgresql/data`), includes a **`pgadmin`** sidecar, and a **`Caddyfile` already exists** (TLS is already terminated by Caddy — we extend it, not introduce it).

**Postgres → PostGIS migration (the real work, not just an image bump):**
- Switch the image to **`postgis/postgis`** (aarch64-compatible tag pinned). **Swapping the image does not install PostGIS into the existing stock-`postgres` data directory** — the extension must exist in the database.
- **PoC-recommended path: fresh volume.** Since there's no production data to preserve, point the service at a **new named volume**, let `postgis/postgis` initialize, and run the first migration (`CREATE EXTENSION IF NOT EXISTS postgis;` + table/index DDL). Simplest and avoids the path/extension mismatch entirely.
- **If existing data must be kept:** keep the volume, bring it up under `postgis/postgis`, then run `CREATE EXTENSION IF NOT EXISTS postgis;` against the existing DB **once** (the image binaries support it; the extension is per-database and not auto-created on an already-initialized cluster), and only then apply the geometry-column migration.
- **Fix/confirm the volume mount path:** standardize on **`postgres_data:/var/lib/postgresql/data`** (the canonical PGDATA). If retaining the old volume, either keep the non-standard `/var/lib/postgresql` mount **consistently** or set `PGDATA` explicitly — mixing the two loses the data dir. For the fresh-volume PoC path, use the standard `/var/lib/postgresql/data`.
- The **`pgadmin`** sidecar is retained as-is (handy for inspecting PostGIS geometries during development); no change required.

**NestJS API service:** build from the backend repo; reads `DATABASE_URL`, `DIRECT_URL`, `FIREBASE_SERVICE_ACCOUNT`, `ORS_API_KEY`, the `MATCH_*` / `LIVE_MAX_PARTICIPANTS` / `ELEV_GAIN_THRESHOLD_M` tunables; runs Prisma migrate on deploy.

**Caddy (existing `Caddyfile`, extended):** keep automatic HTTPS (Let's Encrypt); proxy `/api/*` → NestJS; set `request_body { max_size 8MB }` as the **coarse backstop** above the authoritative **6 MB** Nest limit (§6); serve the PWA `dist/` as static (or host on a CDN/pages and use Caddy only for the API).

**`main.ts` changes (currently a bare bootstrap):** add `app.setGlobalPrefix('api')`; register the global `ValidationPipe({ whitelist:true, forbidNonWhitelisted:true, transform:true })`; configure `express.json({ limit:'6mb' })`; keep `enableCors()` and the global `BigIntInterceptor`.

**Firebase project setup:** enable Auth (email/password + Google); enable Realtime Database (Spark) with the §7.6 Security Rules; generate a service-account JSON for `firebase-admin` (used for both token verification and the `routeMembers` index writes); register the Web app config for the client.

**FCM / R2 (noted for later):** FCM lands with Capacitor (`PushService` native impl); R2 media uploads land via a future `POST /api/media/sign` presigned-URL endpoint so bytes never transit the VM. Neither is provisioned now.

**Env / secrets:** backend — `DATABASE_URL`, `DIRECT_URL`, `FIREBASE_SERVICE_ACCOUNT` (or `GOOGLE_APPLICATION_CREDENTIALS`), `FIREBASE_DB_URL` (RTDB, for admin writes), `ORS_API_KEY`, `PORT`, `MATCH_CORRIDOR_M`, `MATCH_START_TOL_M`, `MATCH_END_TOL_M`, `MATCH_MIN_COVERAGE`, `LIVE_MAX_PARTICIPANTS`, `ELEV_GAIN_THRESHOLD_M`. Frontend — `VITE_FIREBASE_*` (web config incl. `databaseURL`), `VITE_API_BASE_URL`, `VITE_ORS_API_KEY` (only if snapping client-side; otherwise rely on the proxy). Keep secrets out of git; inject via Compose env files / VM environment.

---

## 9. Free-Tier & Cost Guardrails

- **Firebase RTDB (Spark): 100 concurrent connections, 1 GB stored, 10 GB/mo download.** Mitigations baked into the contract: throttle position writes to `throttleMs` (default **2000 ms**); overwrite a **single** node (no history → near-zero storage); `onDisconnect()` frees connections promptly; **hard per-route cap `LIVE_MAX_PARTICIPANTS = 25`** (bounds the per-route download fan-out — see the §5.6 table — and the connection count); client-side filter of stale (`lastSeen` > ~30 s) sessions; never store track history in RTDB.
- **OpenRouteService (free): ~2,000 directions/day, 40/min.** Prefer client-side snapping (per-user quota); **debounce to drag-end**, not per pixel; the `/api/routing/snap` proxy applies a per-`userId` token bucket (1/s, 100/day) and caches identical requests (`sha1(coords@5dp+profile)`, short TTL). **On quota exhaustion the proxy degrades to returning the unsnapped polyline** (`reason:'ROUTING_BUDGET_EXHAUSTED'`, §6.2) so route creation never hard-fails.
- **Firebase Auth (Spark):** token verification is a local public-key JWT check (no per-verify network call), but `firebase-admin` **periodically refetches Google's rotating signing certs** — not truly offline. Cache `uid → User`; throttle `lastSeenAt` writes to ≤1/min.
- **Backend (Oracle aarch64 free VM):** all list endpoints cursor-paginated (`?limit` default 20, max 100) — the current unfiltered `ActivityController.findAll()` **must** gain `where userId` + pagination; cap activity `points` (≤ 50k) and enforce the **6 MB Nest body limit** (Caddy 8 MB backstop); PostGIS matching is GiST-indexed and bbox-bounded.
- **R2 (later):** uploads via presigned URLs so media bytes never transit the VM.

---

## 10. Phased Roadmap & Milestones

### Phase 0 — Thinnest end-to-end PoC (prove the spine)
Goal: sign in, record a foreground run, upload it, see it saved. No routes/leaderboards/live yet.
- **Infra:** switch Compose to `postgis/postgis` on a **fresh volume at `/var/lib/postgresql/data`**; first migration runs `CREATE EXTENSION postgis`; keep the existing Caddy + `pgadmin`; in `main.ts` add `setGlobalPrefix('api')`, the global `ValidationPipe`, and the 6 MB body limit.
- **Data:** add `User`; migrate `ActivityLocation` → `ActivityPoint` (+ `geometry` + `recordedAtMs`); add `Activity.userId`, client-generated `id`, and `track geometry(LineStringM,4326)`.
- **Auth:** Firebase project; `FirebaseAuthGuard` + `GET/PATCH /api/auth/me`; client `AuthService` + sign-in screens; **Permissions Primer** (web copy).
- **Frontend skeleton:** Vite + MapLibre + OpenFreeMap tiles; `adapters/` scaffold (web impls, `WebAuthService` shared); `vite-plugin-pwa` manifest/SW; RTK Query base API with token header.
- **Recording:** `WebLocationTracker` (wake lock) + `WebPointUploader` (IndexedDB + flush, client `activityId`); recording screen with live stats; `POST /api/activities` upserts + builds `track`; Activity Summary from the response.
- **Exit criteria:** install PWA on Android → sign in → record a run with screen on → activity persists, lists, and survives a mid-run reload (recovery).
- **Dependencies:** everything downstream depends on Auth + the PostGIS migration.

### Phase 1 — Core product (routes, leaderboards, live, invites)
- **Route creation (7.2):** Terra Draw + ORS snap (+ proxy + degraded mode); elevation profile; `POST /api/routes`; auto full-route `Segment`; Routes List + Explore + Route Detail screens. *(depends on Phase 0 auth + PostGIS.)*
- **Segment matching & leaderboards (7.5):** `RouteEffort` (per-segment), `matchActivity()` in activity upsert, leaderboard queries + endpoints (`segmentId`-scoped, `?period`). *(depends on Routes + recording producing `track`.)*
- **Invites & membership (7.3):** invite/accept/decline; membership gates visibility; **backend `routeMembers` RTDB index** writes. *(depends on Routes + Auth.)*
- **Live tracking (7.6):** RTDB rules + structure; `POST …/live/session` (cap + index write); live writer + subscriber; presence/`onDisconnect()`; throttling guardrails. *(depends on Auth + Routes + Membership.)*
- **Exit criteria:** draw+snap+save a route → invite a friend → both record on it → leaderboard ranks best times → both see each other live (within the 25-participant cap).

### Phase 2 — Capacitor shell + background GPS, then deferred features
- **Capacitor migration (4.6):** add Android shell; install native plugins; swap `adapters/native/*` (`NativeLocationTracker` FGS, `NativePointUploader` via `CapacitorHttp`, `NativePushService`) and flip the `AuthService` `nativeGoogle` flag (Google-provider-only swap); add native Permissions Primer copy + manifest permissions. **Delivers true screen-off background GPS** — the one thing the PWA cannot do.
- **Then, deferred (not designed here):** FCM push; R2 media; **3D/animated replay**; **LLM route suggestions**; **auto loop-by-distance**; self-host Protomaps PMTiles + GraphHopper/Valhalla.
- **Dependencies:** Capacitor migration only swaps three adapter impls + one provider flag + the `createAdapters` branch; all Phase 0/1 feature code carries over unchanged.

```
Phase 0:  Infra+PostGIS ─ Auth ─ Recording(fg) ─ POST /activities(upsert)
              │
Phase 1:  Routes(draw+snap) ─┬─ Segment matching ─ Leaderboards
                             ├─ Invites/Membership ─┐ (backend routeMembers index)
                             └─ Live tracking (RTDB) ┘ (needs membership)
              │
Phase 2:  Capacitor shell ─ Background GPS (FGS) ─ FCM ─ R2 ─ [deferred features]
```

---

## 11. Risks & Open Questions

- **Foreground-only PWA tracking is a real product limitation.** Locking the phone or switching apps creates a straight-line gap in the track. Mitigation: honest in-app warnings + wake lock + IndexedDB recovery; *resolution* is the Phase 2 Capacitor FGS. **Question:** is foreground-only acceptable for the PoC's evaluation runs, or does Phase 2 need to be pulled forward?
- **Segment-matching false positives on loops / very short routes.** Endpoint detection degenerates when start ≈ end. Mitigation: checkpoint progression + monotonic-time. **Question:** what tolerance set best fits the target running area (urban canyon vs open park)? Thresholds are per-route configurable via the `MATCH_*` env vars.
- **RTDB 100-concurrent-connection cap.** The `LIVE_MAX_PARTICIPANTS = 25` per-route cap keeps a single popular route well clear, but many simultaneous *routes* could still aggregate toward 100. Mitigation: throttle, `onDisconnect()`, per-route cap. **Question:** expected max concurrent live routes/viewers across the whole app?
- **ORS free quota (2,000/day).** Heavy route drawing could exhaust it. Mitigation: debounce-to-drag-end + caching + per-user proxy throttle + **degraded unsnapped-polyline mode**. **Question:** client-side key (per-user quota, key exposed) vs server proxy (shared key, hidden, centrally throttled)? — leaning proxy for production, client-side for fastest PoC dev.
- **`geography` buffer/Fréchet accuracy.** `ST_Buffer` on a geography cast is planar-approximate; acceptable at 10–40 m corridors but worth validating against real GPS traces before trusting leaderboard times.
- **Oracle aarch64 image availability.** Confirm `postgis/postgis` and all base images have arm64 tags; pin versions in Compose.
- **Synchronous matching on the upsert request.** Fine at single-digit ms for a few candidate routes; if a user belongs to many overlapping routes, latency could grow. Mitigation: the algorithm is queue-ready — move to a background job keyed off `activityId` if needed.
- **Elevation accuracy.** The PoC ships a threshold-based cumulative-gain filter (`ELEV_GAIN_THRESHOLD_M`, §7.4) over noisy device altitude — good enough to avoid garbage, not survey-grade. **Question:** do we need a server-side DEM source for accurate activity elevation gain, or is the threshold filter good enough for the PoC?
- **Invite-by-email to non-users.** Claiming pending invites at first sign-in assumes the verified email matches exactly. **Question:** handle email aliasing / Google-vs-password account linking?
