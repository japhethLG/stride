# CLAUDE.md — Stride Frontend Agent Guide

> **Audience:** AI coding agents working in this repo.
> **Goal:** add features without breaking the routing / data / adapter / modal /
> sheet / auth patterns. Read this before non-trivial edits.
>
> This is a **Vite + React single-page app**, shipped as an installable **PWA**
> today and architected to become a **Capacitor** Android app with minimal
> change (§4). It is **not** Next.js: there is no RSC, no SSR, no server
> components, no `page.tsx`, no server HTTP client, no session cookie, no
> middleware/`proxy.ts`. All code runs in the browser; auth is **Bearer-token
> only**.
>
> Backend conventions live in [`../fitnessBackend/CLAUDE.md`](../fitnessBackend/CLAUDE.md).
> Product/spec docs live in [`docs/`](docs/)
> ([implementation-plan.md](docs/implementation-plan.md),
> [ui-spec.md](docs/ui-spec.md), [tech-stack-research.md](docs/tech-stack-research.md)).
> The repo is an early proof-of-concept — much below is the **target** shape;
> check the file before assuming it exists.

---

## 1. Tech stack

| Layer | Tech | Notes |
|-------|------|-------|
| Build / framework | **Vite** + **React 19** | client-only SPA; no SSR |
| Language | **TypeScript** (strict) | |
| Shell target | **PWA now → Capacitor (Android) later** | device capabilities behind adapters (§4) |
| Routing | **react-router** | client routing; route guards via an `<AuthGuard>` wrapper (§4.1) |
| Server state | **TanStack Query v5** | every backend read/write goes through a typed hook (§6) |
| HTTP client | **openapi-fetch** | one browser client + Bearer middleware ([lib/api/client.ts](src/lib/api/client.ts)) |
| Type generation | **openapi-typescript** | against the backend's `/api-docs-json` → [lib/api/schema.d.ts](src/lib/api/schema.d.ts) (generated) |
| Client state | **Zustand** | **Built:** the recording-session store (§12). Target stores — modals (§8), sheets (§9), mobile-actions FAB (§10.1) — not built yet |
| Forms | **react-hook-form** + **zod** = target (§7.1) | **Built:** `Field` + `useState` (RHF/zod not installed yet); add `Form*` wrappers when migrating |
| Auth | `firebase` (client SDK) | Google + email; Bearer ID token only (§11) |
| Maps | **MapLibre GL JS** + `maplibre-gl` | free/open renderer; consumed via the `MapView` primitive ([components/map/MapView.tsx](src/components/map/MapView.tsx), §5) |
| Tiles | **OpenFreeMap** (→ self-host Protomaps PMTiles) | no API key now; runtime dark recolor + raster fallback in [lib/map/](src/lib/map/) |
| Route drawing | **tap-to-draw** (map clicks drop waypoints) | our own overlay on `MapView` — **no draw library** (Terra Draw was trialled and removed — not needed) (§5) |
| Snap-to-road | **backend `POST /api/routing/snap`** (GraphHopper) | the FE calls our backend, not a routing API directly; `useSnapRoute()` with foot/bike/car profiles (§5) |
| Realtime | **Firebase Realtime Database** (`firebase` JS SDK) | live multi-user positions (§12) |
| Icons | `lucide-react` = target | **Built:** a custom `Icon` set in [primitives/Icon.tsx](src/components/primitives/Icon.tsx) (lucide not installed); add icons there |
| Styling | Tailwind + `cn()` = target | **Built:** inline styles + CSS-var tokens ([styles/tokens.css](src/styles/tokens.css)) for pixel-fidelity port; Tailwind not installed |
| Lint | Biome (or configured linter) | |
| PWA | **`vite-plugin-pwa`** (Workbox) | manifest + service worker (§13) — NOT Serwist/Next |

Backend dev server + OpenAPI URL come from `VITE_API_BASE_URL`
(e.g. `http://localhost:8000`); type-gen reads `${VITE_API_BASE_URL}/api-docs-json`.

---

## 2. Commands

```bash
npm run dev          # vite dev server
npm run build        # production build (tsc + vite build)
npm run preview      # serve the built bundle
npm run typecheck    # tsc --noEmit
npm run lint         # linter
npm run check        # enforce-ui-primitives + lint (§7)
npm run api:types    # regenerate src/lib/api/schema.d.ts (needs backend running)
# later (Capacitor):
npx cap add android  # add the native shell
npx cap sync         # copy the web build + plugins into the native project
```

`schema.d.ts` is **generated — never edit by hand**. `npm run check` fails the
build on native HTML elements outside primitives (§7).

---

## 3. Directory layout (target)

```
src/
├── main.tsx                 # React root: providers + RouterProvider
├── App.tsx / routes.tsx     # react-router route table
├── adapters/                # PWA-now / Capacitor-later device capabilities (§4)
│   ├── types.ts             # LocationTracker, PointUploader, PushService, AuthService interfaces
│   ├── web/                 # browser implementations (used now)
│   ├── native/              # Capacitor implementations (added with the shell)
│   └── index.ts             # composition root — picks impl by platform
├── components/
│   ├── primitives/          # OUR design system — page code uses these (§7)
│   ├── ui/                  # (planned) raw headless wrappers consumed BY primitives — not built yet
│   ├── formElements/        # (planned) RHF-bound primitive wrappers (§7.1) — not built yet
│   ├── chrome/              # ambient UI (faux-map bg, toasts) — BUILT
│   ├── map/                 # MapView primitive + draw/live overlays (§5)
│   ├── layout/              # AppShell, BottomNav, TopBar, page FAB (§10)
│   ├── pages/               # page-level composites (the real screen UI; §4.2)
│   ├── modals/              # (planned) BaseModal + registry (§8) — not built yet
│   └── sheets/              # BUILT: local BaseSheet + ActionMenu (registry is the §9 target)
└── lib/
    ├── api/
    │   ├── client.ts        # openapi-fetch + Bearer middleware
    │   ├── hooks.ts         # useApiQuery / useApiMutation / invalidate helpers
    │   ├── schema.d.ts      # GENERATED
    │   └── <entity>/        # one folder per entity (§6) — incl. routing/ (snap), live/ (rtdb)
    ├── firebase/client.ts   # Firebase app + auth + RTDB init
    ├── auth/                # AuthProvider, sign-in/out, guard (§11)
    ├── map/                 # style.ts, darkTheme.ts, geo.ts, markers.ts (§5)
    ├── location/            # UserLocationProvider — shared device location (§5)
    ├── recording/           # active-run store + live-writer (RTDB) (§12)
    ├── db/                  # IndexedDB point buffer
    ├── prefs/               # local user prefs (theme, etc.)
    ├── format.ts            # distance/pace/time formatters
    ├── viewModel.ts         # shared view-model helpers
    └── useToast.tsx         # toast hook
    # (planned, per §8/§9 targets) lib/modals/ + lib/sheets/ registry/store/host — not built yet
```

There is **no** `app/`, **no** `pages/` route files, **no** `proxy.ts`, **no**
`server.ts` API client. Stale references to those (carried over from a Next.js
template) are wrong. **There is no `lib/utils.ts` / `cn()`** (that was a Tailwind
helper — styling is inline tokens, §1).

---

## 4. The PWA-now / Capacitor-later adapter layer (load-bearing)

This is the most important architectural rule. **Every device capability that
behaves differently in a browser vs a Capacitor shell sits behind a thin
interface in `src/adapters/`.** Feature code depends on the interface, never on
`navigator.*` or a Capacitor plugin directly. This is what makes the shell swap
cheap. Full interface shapes + migration checklist: [implementation-plan.md §4](docs/implementation-plan.md).

```ts
// src/adapters/types.ts (shape — see the plan for the full version)
export interface LocationTracker {
  start(opts: { keepScreenOn?: boolean }, onPosition: (p: GeoPoint) => void): Promise<void>;
  stop(): Promise<void>;
}
export interface PointUploader { enqueue(activityId: string, pts: GeoPoint[]): void; flush(): Promise<void>; }
export interface PushService { /* no-op on web now; FCM later */ }
export interface AuthService { /* wraps Firebase sign-in/out + token */ }
```

- **Web impl now** (`adapters/web/`): `LocationTracker` uses
  `navigator.geolocation.watchPosition` + the **Screen Wake Lock API** (keep the
  screen on while recording); `PointUploader` buffers to **IndexedDB** and flushes
  via `fetch`.
- **Native impl later** (`adapters/native/`): `LocationTracker` uses
  `@capacitor-community/background-geolocation` (Android **foreground service**,
  true screen-off tracking); `PointUploader` flushes via **`CapacitorHttp`** to
  dodge the ~5-min backgrounded-WebView fetch throttle.
- `adapters/index.ts` is the **composition root** — it picks web vs native once,
  by platform detection. Nothing else branches on platform.

- **Don't re-ask for location every login.** `LocationTracker.getPermissionState()`
  reads the geolocation permission *without* prompting (web: `navigator.permissions.query`).
  After auth, `LoginPage` skips the `/onboarding/permissions` screen straight to
  `/` when it's already `"granted"` (and the permissions screen self-skips on mount
  too). Only `"prompt"`/`"denied"`/`"unknown"` show the onboarding screen. Route
  any new "should I ask for X permission?" check through an adapter method like
  this — never call `navigator.permissions` from a component.

**PWA recording is foreground-only.** With the screen off / tab hidden the web
`LocationTracker` stops producing points (a documented web-platform limit — see
[tech-stack-research.md](docs/tech-stack-research.md)). The Record screen must
make this legible (§12) and rely on Wake Lock. True background tracking arrives
only with the Capacitor shell.

> **Never call `navigator.geolocation`, a Capacitor plugin, or `fetch` for
> point upload directly from a component.** Go through the adapter — a direct
> call is the one thing that breaks the Capacitor migration.

---

## 4.1 Routing & guards

- Routes are declared in `routes.tsx` (react-router). The screen list + nav map
  are in [ui-spec.md](docs/ui-spec.md).
- An `<AuthGuard>` wrapper redirects unauthenticated users to `/login`; an
  `<AppShell>` layout route wraps every authenticated screen (§10). Public routes
  (`/login`, invite-by-token) render outside the shell.
- Auth state comes from the `AuthProvider` (§11) — never read cookies/query
  params for identity.

## 4.2 Pages are composites, not route files

Each screen is a composite under `components/pages/<feature>/` (e.g.
`RouteDetailPage`). The route element just renders it: `element: <RouteDetailPage />`.
The composite reads its own route params (`useParams()`) — don't thread params
through the route table. No business logic in `routes.tsx`.

---

## 5. Maps & route drawing (MapLibre)

- **One `MapView` primitive** ([components/map/](src/components/map/)) wraps
  MapLibre GL JS. Page code uses `MapView` + overlay components, never `new
  maplibre.Map(...)` inline.
- The map **style** (sources/layers) lives in [lib/map/](src/lib/map/) — one
  shared style pointing at OpenFreeMap now; the `pmtiles` protocol is registered
  there for the later self-host swap. Changing the basemap = editing one file.
- **Route drawing (as built): tap-to-draw, no draw library.** Map clicks on
  `MapView` (`onMapClick`) drop real `{lng,lat}` waypoints; an Undo control pops
  the last one. (Terra Draw was trialled for editable vertices and removed — the
  manual flow is enough for now.)
- **⚠️ Drawing must NOT move the camera.** Create-route mounts `MapView` with
  `fit={false}`, because `MapView`'s auto-fit effect re-frames on every
  `drawCoords`/`markers` change — which made the map jump/zoom on *every* dropped
  point. With `fit={false}` the only camera move is the locate-me `flyTo`. If you
  add a drawing surface elsewhere, pass `fit={false}` too.
- **User location is a shared context — `useUserLocation()`**
  ([lib/location/UserLocationProvider.tsx](src/lib/location/UserLocationProvider.tsx)),
  mounted in `RootLayout`. It persists the **last-known** `[lng,lat]` to
  localStorage and **auto-refreshes** the live fix on an interval *while permission
  is granted* (never prompts on its own — that's the onboarding screen / the
  explicit `refresh()`). Map screens read `loc.center` (live → last-known →
  `DEFAULT_CENTER`) for the initial camera so they open **near the user, not on the
  default center**, and `loc.current`/`loc.lastKnown` for the `type:"me"` marker.
  **Don't reintroduce per-screen `getCurrentPosition` for centering — use the
  context.** Continuous tracking for an active *run* still belongs to
  `lib/recording` via the tracker's `start()` (§12); this context is for centering
  maps only and must not contend with it.
- **Snap-to-road goes through the backend, not a routing API.** When the Snap
  toggle is on (≥2 waypoints), `useSnapRoute()` (`POST /api/routing/snap`, with a
  `foot`/`bike`/`car` profile) returns the road-snapped GeoJSON, and **that** is
  what gets drawn + saved (§6) — never persist the raw waypoints when snap is on.
  The backend proxies GraphHopper; the FE never calls GraphHopper/ORS directly.
- **Live positions** (§12) render as a dedicated overlay layer fed by the RTDB
  subscription; keep it separate from the static route layer so re-renders are cheap.
- **⚠️ Route/run thumbnails are SVG, NOT `MapView` — WebGL contexts are scarce.**
  Each `MapView` is a full MapLibre WebGL context and browsers cap those (~16); a
  `MapView` per list card crashes/janks. List cards (`RouteCard`, `ActivityRow`)
  use the **`MiniMap`** SVG thumbnail ([components/chrome/MiniMap.tsx](src/components/chrome/MiniMap.tsx)):
  the backend returns a **simplified** route/track in *list* responses (full
  geometry only on detail — BE §8.4), and `coordsToThumbPath()` ([lib/map/geo.ts](src/lib/map/geo.ts))
  projects it into the 0..100 viewBox the SVG draws (aspect-corrected, centered).
  When a real path is present the faux street network is suppressed (`plain`).
  **Never put a `MapView` in a list row** — only "hero"/detail screens get a live
  map (e.g. Home's single start-run hero, centered on `loc.center` with a "me"
  marker; §5 location context above).
- MapLibre carries over **unchanged** into Capacitor (it runs in the WebView) —
  this is a reason the drawing/map stack favors the web surface.
- **Locate / auto-focus (CreateRoute):** the camera opens at `loc.center` (above)
  and a "me" marker shows the user. `flyTo` re-centers only on **mount and explicit
  locate-me** (a `flyPendingRef` guards it) — never on a background auto-refresh,
  which would yank the camera mid-draw. The locate button shows `loc.locating` and
  calls `loc.refresh()`. Because the bottom panel's height varies (the profile
  selector grows it), that button is positioned above it via a
  `ResizeObserver`-measured offset — don't hard-code its `bottom`. Use
  `pendingCenterRef` to avoid a flyTo race before the map loads.

---

## 6. API layer — one folder per entity, typed hooks

The single most important data convention. **Every backend endpoint is wrapped
in a typed hook in an entity folder. Components never call `openapi-fetch`
directly.**

We are **not** multi-tenant, so the hook naming is simple:

- Collection/owner endpoints → bare hooks: `useRoutes`, `useCreateRoute`, `useRoute(id)`.
- `/me/*` self endpoints → `My` prefix: `useMyActivities`, `useMyRoutes`.
- Token/public endpoints → `Public` prefix: `useAcceptInvite`.

### 6.1 Folder shape

```
src/lib/api/<entity>/
├── keys.ts          # <ENTITY>_PATHS + invalidate<Entity>(qc)
├── hooks.ts         # the typed hooks
└── index.ts         # re-exports
```

Consumers do `import { useMyActivities } from "@/lib/api/activities"`.

### 6.2 Query keys & invalidation

- Every query key is `[path, init]` where `path` is the literal OpenAPI template
  (`"/api/v1/routes/{id}"`) and `init` is `{ params, body }`. **Never hand-write
  keys** — `useApiQuery` sets them.
- `keys.ts` exports `<ENTITY>_PATHS` (every path returning this entity) and
  `invalidate<Entity>(qc)` (predicate match over those paths — prefer predicate
  over prefix matching; literal paths overlap).
- Mutations invalidate in `onSuccess`:

```ts
return useApiMutation("/api/v1/routes", "post", {
  onSuccess: () => invalidateRoutes(qc),
});
```

### 6.3 Adding a new endpoint

1. Backend ships it. 2. `npm run api:types`. 3. Add a hook to the entity's
`hooks.ts` (create the folder + `index.ts` if new). 4. Add the path to
`<ENTITY>_PATHS`. 5. Mutations call `invalidate<Entity>` on success.

### 6.4 Auth endpoints are special

`/auth/session`, sign-in/out are multi-step Firebase flows — they live in
[lib/auth/](src/lib/auth/) (§11), **not** as raw `useApiMutation`. Only `GET
/auth/me` is exposed as a hook (`useAuthMe()`).

---

## 7. UI primitives — strict enforcement

Every interactive element comes from [`components/primitives/`](src/components/primitives/)
(Button, IconBtn, Field, Icon, Card, Avatar, Segmented, Spinner, …) — these are
**built** as inline-style/CSS-token components (§1). Page code uses these, not raw
HTML elements; use react-router `<Link>` for navigation.

> **Target, not yet enforced:** the `components/ui/` headless-wrapper split, the
> `scripts/enforce-ui-primitives.mjs` lint, and the `npm run check` gate don't
> exist yet. The *rule* (no raw `<button>`/`<input>`/`<img>`/`<a>` in pages —
> wrap them in a primitive) still holds; it's just convention-enforced today. Add
> the script when the primitive set stabilizes.

### 7.1 Forms

**Target:** compose RHF + zod via `components/formElements/*`:

```tsx
const methods = useForm<Values>({ resolver: zodResolver(schema) });
<Form methods={methods} onSubmit={onSubmit}>
  <FormInput name="title" label="Route name" />
  <FormSubmit label="Save" />
</Form>
```

**Built today:** RHF/zod/`formElements` are **not installed**. Forms use the
`Field` primitive + local `useState` and a plain submit handler. That's fine for
the PoC's small forms; when forms grow (cross-field validation, arrays), add RHF
+ zod and the `Form*` wrappers rather than hand-rolling validation.

---

## 8. Modal system

> **Status: target, not built yet.** There is no `components/modals/`, no
> `lib/modals/` registry, and no `BaseModal` today — the PoC has had no desktop
> modal need. This section is the pattern to adopt **when you add the first
> modal** (mirror the §9 sheet system). Until then, don't reference a registry
> that isn't there.

Every modal renders inside `BaseModal.tsx`. Never render a standalone overlay/portal.

```
src/components/modals/<name>/<Name>Modal.tsx   # component + declare-module augmentation
src/lib/modals/{registry,store,host}.ts        # typed registry, openModal/closeModal, lazy host
```

Props are typed globally via a `declare module "@/lib/modals/registry"`
augmentation of `ModalPropsMap`, so `openModal("confirm-delete", {...})` is
type-checked. Register a modal in three edits: the component (with the
augmentation + `<BaseModal>` wrapper), its `index.ts`, and a lazy entry in the
host's `registry`. The host lazy-loads each modal, so an unopened modal ships
none of its deps. While a mutation is pending pass `dismissible={false}`.

`openModal` / `closeModal` work outside React; `useModalStore` is available
inside components.

---

## 9. Sheets — mobile bottom sheets

Modals (§8) are the desktop-centred overlay; **sheets** are the mobile
bottom-sheet counterpart (drag handle, safe-area footer). The **target** is a
`src/components/sheets/` registry/host/store mirroring the modal system one-for-one.

> **Built today (no registry yet):** `components/sheets/` is just a **local
> `BaseSheet` + `ActionMenu`**. Pages own their sheet's `open` state and render
> `<BaseSheet open=… onOpenChange=… />` inline. This has been enough so far; add
> the registry/host/store when sheets multiply and need to open from outside React.
>
> **⚠️ CRITICAL — render a sheet ONLY when open.** `BaseSheet` does
> `if (!open) return null` and uses `position: fixed; inset: 0`. An earlier
> version kept every sheet mounted and hid it with `transform: translateY(110%)`
> inside a `position: absolute` wrapper — on **Android Chrome** the positioned-
> ancestor height chain collapsed, so closed panels weren't anchored to the
> viewport bottom and **every sheet on the page showed through at once**. Never
> reintroduce always-mounted + transform-hidden sheets. The open animation runs
> on mount via the `strideSheetUp` / `strideScrimIn` keyframes
> ([styles/tokens.css](src/styles/tokens.css)).

- Use a **sheet** for a mobile-first flow (start a run, invite a member, account
  menu); a **modal** for confirmations / desktop forms. A flow may ship both.
- Register a sheet exactly like a modal (§8): `<Name>Sheet.tsx` wrapping
  `<BaseSheet>` + `declare module "@/lib/sheets/registry"`, its `index.ts`, and a
  lazy entry in the sheet host.
- `openSheet("invite-member", {...})` is type-checked against `SheetPropsMap` and
  works outside React. The host injects `open`/`onOpenChange` — callers never pass them.
- A sheet whose controls must read **live page state** (e.g. a list filter) is
  built **locally with `BaseSheet`, NOT registered globally** — the global store
  snapshots props at open time and would go stale.

---

## 10. Layout, chrome & mobile

[`AppShell`](src/components/layout/) is the chrome for every authenticated
screen — **pages don't import it**; it's a layout route (§4.1). It renders the
**bottom tab bar** (the primary nav on mobile) and a top bar.

Per [ui-spec.md](docs/ui-spec.md) the bottom nav is 4 tabs: **Home / Routes /
Record / Profile** (Record is the emphasized center CTA → full-screen recording).

### 10.1 Page-action FAB

> **Status: target, not built yet.** There's no `mobile-actions` store today —
> pages render their own action buttons inline (e.g. CreateRoute's locate/undo/save
> controls). Adopt the pattern below when a page needs a shared, tab-aware FAB.

A page publishes its primary action(s) via the mobile-actions store:

```ts
useMobileActions(useMemo(() => [{ label, icon, onClick }], deps));
```

One action → a one-tap FAB; 2+ → a speed dial. Call the hook **before any early
return** (rules-of-hooks). On a tabbed detail page, compute the FAB set from the
active tab **in the parent** — sibling `useMobileActions` calls clobber each other.

### 10.2 The mobile page recipe

- Scroll container clears the bottom nav **and** the FAB — use generous bottom
  padding (the FAB is taller than the nav; too little padding hides the last row).
- Tables/lists → a card layout on mobile (collapsed headline + tap-reveal), not a
  horizontally-scrolling table.
- Tab strips scroll horizontally rather than squish.
- Design every screen for one-handed portrait use; keep primary controls in thumb reach.

---

## 11. Auth — Firebase, Bearer-token only

```
Google / email sign-in (Firebase client SDK)
        │
        ▼
    ID token ──► every API call sends  Authorization: Bearer <ID token>
                 (the client middleware fetches a fresh token per request)
```

There is **no session cookie and no server-side verification path** (that was a
Next.js/RSC thing) — this SPA only ever sends the Bearer token, and the backend
guard verifies + provisions the `User` (backend §9).

Rules:

1. **Sign-in/out live in [lib/auth/actions.ts](src/lib/auth/actions.ts)** — don't
   reinvent the Firebase flow inline.
2. **Never store the ID token** in state/localStorage. The client middleware
   calls `auth.currentUser.getIdToken()` per request (it refreshes for you).
3. **`AuthProvider`** exposes the current user; route guards (§4.1) and screens
   read it. It does not itself redirect — the `<AuthGuard>` does.
4. **401 → sign out.** The response middleware in [client.ts](src/lib/api/client.ts)
   signs the user out and routes to `/login` (except on already-public paths).
5. Firebase web config comes from `VITE_FIREBASE_*` env vars.

---

## 12. Recording session & live tracking

The active run is owned by a Zustand store ([lib/recording/store.ts](src/lib/recording/store.ts)):

- On Start: generate the `activityId` **client-side** (UUID), acquire the Wake
  Lock via the `LocationTracker` adapter (§4), begin watching position.
- Each filtered point updates (a) the live map line + stats in the store and (b)
  the `PointUploader` IndexedDB buffer (durable across reloads).
- If "on a route" / live, a **throttled** current-position write (~1 / 2 s) goes
  to Firebase RTDB `liveSessions/<routeId>/<uid>` via the `firebase` SDK; set
  `onDisconnect()` to clear presence. Don't write every raw fix — it burns the
  RTDB free tier.
- On Stop: assemble the buffered track, `POST /api/activities { id, points }`,
  then clear the RTDB live node + IndexedDB buffer. Segment matching + leaderboard
  result come back from the backend (don't compute rank client-side).

The client **reads** `liveSessions/*` (and gets access via the backend-written
`routeMembers/*` index — backend §10); it **never writes** `routeMembers/*`.
RTDB structure + cadence: [implementation-plan.md §5.5/§7.6](docs/implementation-plan.md).

---

## 13. PWA / service worker

Installable PWA via **`vite-plugin-pwa`** (Workbox) — manifest + service worker.

- **Never cache `/api/*`** (Bearer-gated; a stale response would trip the
  401 → sign-out in [client.ts](src/lib/api/client.ts)).
- **Pass Firebase auth + RTDB hosts straight through (NetworkOnly)** — caching
  `*.firebaseapp.com` / `*.googleapis.com` / the RTDB socket breaks sign-in and
  live updates.
- Precache the app shell + static assets only. Bump the SW on each build.

When the Capacitor shell lands, the native WebView loads local assets and this SW
is largely bypassed — keep PWA-only logic out of feature code.

> **⚠️ Deploy gotcha — stale cache:** with the SW registered (`autoUpdate`), a
> freshly deployed build is often **not** what an already-open client sees until
> the SW updates. When verifying a deploy, do a **hard refresh** (or close all
> tabs) — otherwise you're testing the previous bundle and will chase phantom
> "fix didn't work" reports.

---

## 14. Anti-patterns — non-obvious traps

| Anti-pattern | Fix |
|---|---|
| Calling `navigator.geolocation` / a Capacitor plugin / `fetch`-for-upload directly in a component | Go through the `src/adapters/` interface — direct calls break the Capacitor migration (§4) |
| `<button>`/`<input>`/`<img>`/`<a>` outside primitives | Use the matching primitive; `<Link>` for nav (§7) |
| Calling `openapi-fetch` (or bare `fetch`) for a backend call in a component | Wrap it in a typed entity hook (§6) |
| Hand-writing a TanStack query key | `useApiQuery` builds `[path, init]` for you (§6.2) |
| New mutation without `invalidate<Entity>` in `onSuccess` | Stale lists after writes (§6.2) |
| Editing `src/lib/api/schema.d.ts` by hand | Regenerated — your edits vanish (`npm run api:types`) |
| Storing the Firebase ID token in state/localStorage | `getIdToken()` refreshes per request (§11) |
| Reintroducing RSC / `page.tsx` / a server API client / `proxy.ts` | This is a client SPA — none of those exist (header, §3) |
| Persisting the raw tapped waypoints when Snap is on | Save the **snapped** GeoJSON from `POST /api/routing/snap` (§5) |
| Instantiating `maplibre.Map` inline in a page | Use the `MapView` primitive (§5) |
| A `MapView` in each list card for a route/run thumbnail | Use the SVG `MiniMap` — WebGL contexts are capped (~16); only heroes/detail get a live map (§5) |
| Writing every GPS fix to RTDB, or writing `routeMembers/*` from the client | Throttle live writes (~1/2s); membership index is backend-only (§12) |
| Computing leaderboard rank client-side | Rank comes from the backend's PostGIS match on activity save (§12) |
| Rendering a modal/sheet overlay inline instead of via `BaseModal`/`BaseSheet` + registry | Breaks ESC/backdrop/drag handling (§8, §9) |
| Registering a live-state filter sheet in the global store | Keep it local — the global store snapshots props and goes stale (§9) |
| Caching `/api/*` or Firebase hosts in the service worker | NetworkOnly for those (§13) |
| Calling `useMobileActions` from each tab of a tabbed page | Compute the FAB set in the parent (§10.1) |
| Assuming background GPS works in the PWA | Foreground-only until Capacitor — surface it in the Record UI (§4, §12) |

---

## 15. Pre-commit checklist

1. Ran `npm run api:types` after the backend changed?
2. Device capability used only through a `src/adapters/` interface (no direct `navigator.*` / plugin / upload `fetch`)?
3. Every backend call goes through a typed entity hook; every new mutation calls `invalidate<Entity>`?
4. New sheet uses the local `BaseSheet` and **renders only when open** (never always-mounted + transform-hidden — §9)? (If you build the registry/modals, follow §8/§9.)
5. New full-page composite follows the mobile recipe (bottom-nav clearance, card lists, thumb-reach)?
6. No raw HTML elements in pages (use primitives); no inline `maplibre.Map` (use `MapView`)?
7. Live writes throttled; no client writes to `routeMembers/*`; SW doesn't cache `/api` or Firebase hosts?
8. `npm run typecheck` + `npm run build` green? (`npm run check` doesn't exist yet — §7.)

---

## 16. Deployment (as built)

The SPA builds to static assets (`npm run build`) served by an **nginx**
container (`stride-web`) behind a shared Caddy proxy — live at
**https://stride.crabdance.com** (Caddy routes `/api*` → the backend, everything
else → this SPA).

- **Build-time env:** `VITE_API_BASE_URL=https://stride.crabdance.com` and the
  `VITE_FIREBASE_*` web config live in `.env.production` (**gitignored — never
  commit**). `api:types` reads `${VITE_API_BASE_URL}/api-docs-json`.
- **TLS:** the cert uses a **ZeroSSL** issuer (the shared crabdance.com zone hit
  Let's Encrypt rate limits). The shared `caddy-proxy` is edited via `docker cp` +
  `caddy reload` — never restart it.
- **Standing manual step:** `stride.crabdance.com` must be in Firebase → Auth →
  Authorized domains or Google sign-in fails in prod.
- After deploying, **hard-refresh** to bypass the service worker (§13).
