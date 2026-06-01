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
| Client state | **Zustand** | UI-only stores: modals (§8), sheets (§9), mobile-actions FAB (§10), recording session (§12) |
| Forms | **react-hook-form** + **zod** | via `components/formElements/*` (§7.1) |
| Auth | `firebase` (client SDK) | Google + email; Bearer ID token only (§11) |
| Maps | **MapLibre GL JS** + `maplibre-gl` | free/open renderer; consumed via a map primitive (§5) |
| Tiles | **OpenFreeMap** (→ self-host Protomaps PMTiles) | no API key now |
| Route drawing | **Terra Draw** (`maplibre-gl-terradraw`) | draw/snap a route line (§5) |
| Routing API | **OpenRouteService** | snap-to-road / directions (later: self-host GraphHopper/Valhalla) |
| Realtime | **Firebase Realtime Database** (`firebase` JS SDK) | live multi-user positions (§12) |
| Icons | `lucide-react` | consumed only via [Icon.tsx](src/components/primitives/Icon.tsx) |
| Styling | Tailwind + `cn()` in [lib/utils.ts](src/lib/utils.ts) | |
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
│   ├── ui/                  # raw headless wrappers — consumed BY primitives only
│   ├── formElements/        # RHF-bound primitive wrappers (§7.1)
│   ├── map/                 # MapView primitive + draw/live overlays (§5)
│   ├── layout/              # AppShell, BottomNav, TopBar, MobilePageFab (§10)
│   ├── pages/               # page-level composites (the real screen UI; §4.2)
│   ├── modals/              # BaseModal + registry (§8)
│   └── sheets/              # BaseSheet + registry — mobile bottom sheets (§9)
└── lib/
    ├── api/
    │   ├── client.ts        # openapi-fetch + Bearer middleware
    │   ├── hooks.ts         # useApiQuery / useApiMutation / invalidate helpers
    │   ├── schema.d.ts      # GENERATED
    │   └── <entity>/        # one folder per entity (§6)
    ├── firebase/client.ts   # Firebase app + auth + RTDB init
    ├── auth/                # AuthProvider, actions (signIn/Out), guard (§11)
    ├── map/                 # style config, pmtiles protocol, ORS client (§5)
    ├── modals/{registry,store,host}.ts
    ├── sheets/{registry,store,host}.ts
    ├── recording/store.ts   # active-run Zustand store + IndexedDB buffer (§12)
    └── utils.ts             # cn(), small helpers
```

There is **no** `app/`, **no** `pages/` route files, **no** `proxy.ts`, **no**
`server.ts` API client. Stale references to those (carried over from a Next.js
template) are wrong.

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
- **Route drawing:** Terra Draw, wrapped behind a draw-overlay component. After
  the user draws, **snap-to-road** calls the ORS client in `lib/map/` and the
  snapped GeoJSON is what gets saved (§6) — never persist the raw freehand line.
- **Live positions** (§12) render as a dedicated overlay layer fed by the RTDB
  subscription; keep it separate from the static route layer so re-renders are cheap.
- MapLibre carries over **unchanged** into Capacitor (it runs in the WebView) —
  this is a reason the drawing/map stack favors the web surface.

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
(Button, Input, Select, Textarea, Card, Avatar, Pressable, DataList, …).
[`components/ui/`](src/components/ui/) is consumed **only by primitives** — page
code never imports from it.

`scripts/enforce-ui-primitives.mjs` (part of `npm run check`) fails the build on
these native elements outside `components/primitives/` and `components/ui/`:

```
<button>  <input>  <select>  <textarea>  <img>  <label>  <a>
```

Wrap in the matching primitive instead of silencing the linter. Use react-router
`<Link>` for navigation (the linter only flags raw `<a>`).

### 7.1 Forms

Compose RHF + zod via `components/formElements/*`:

```tsx
const methods = useForm<Values>({ resolver: zodResolver(schema) });
<Form methods={methods} onSubmit={onSubmit}>
  <FormInput name="title" label="Route name" />
  <FormSubmit label="Save" />
</Form>
```

Don't reach for `<input>` + `register()` directly — add a `Form*` wrapper if one
is missing.

---

## 8. Modal system

Every modal renders inside [BaseModal.tsx](src/components/modals/BaseModal.tsx).
Never render a standalone overlay/portal.

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
bottom-sheet counterpart (drag handle, snap points, safe-area footer). They live
in `src/components/sheets/` driven by a **separate registry/host/store that
mirrors the modal system one-for-one** — don't conflate them.

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
| Persisting the raw freehand drawn line | Save the **snapped** GeoJSON from ORS (§5) |
| Instantiating `maplibre.Map` inline in a page | Use the `MapView` primitive (§5) |
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
4. New modal/sheet: uses `BaseModal`/`BaseSheet`, the `declare module` augmentation, and appears in its `index.ts` + host registry?
5. New full-page composite follows the mobile recipe (bottom-nav + FAB clearance, card lists, thumb-reach)?
6. No native HTML elements outside primitives; no inline `maplibre.Map`?
7. Live writes throttled; no client writes to `routeMembers/*`; SW doesn't cache `/api` or Firebase hosts?
8. `npm run check` + `npm run typecheck` + `npm run build` green?
