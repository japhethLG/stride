# Tech Stack Research — Strava-style Run Tracker (Android PoC)

This report evaluates the technology stack for a Strava-like run/jog/activity tracker at proof-of-concept stage, optimized for **fast development**, **Android-first** delivery, and **free / generous-free-tier / self-hostable** services without sacrificing the five core features (drag-to-create + AI-suggested routes, route invites, segment leaderboards, live multi-user tracking, and an optional 3D replay). The existing stack (Expo/React Native + MapLibre + expo-location; NestJS + Prisma + PostgreSQL; Docker Compose with Postgres + Caddy on what is confirmed to be an Oracle Cloud free-tier aarch64 VM) is treated as context, not a constraint. The central question driving every platform call: **can a pure PWA deliver the core features — especially continuous background GPS with the screen off — or is a native shell required?** All claims were adversarially verified against primary sources as of **2026-06-01**; verdicts (and the handful that were *refuted* or *partly-true*) are folded into the recommendations below.

---

## TL;DR / Recommendation

**The key verdict (PWA vs Capacitor vs RN/Expo vs Native):**

- **A pure PWA cannot do the one non-negotiable feature: continuous background GPS with the screen off on Android. CONFIRMED, full stop.** `navigator.geolocation.watchPosition` is `[Exposed=Window]`-only and stops emitting when the tab is backgrounded or the screen turns off; the Geolocation API is *not* available to Service Workers; Periodic Background Sync has a ~12 h minimum interval and is explicitly not real-time. A backgrounded PWA also cannot hold a WebSocket alive (the OS freezes/discards the renderer). A PWA is therefore a **foreground-only** tracker.
- **To get background tracking you must ship an Android app shell** that runs a native **foreground service** (persistent notification, `FOREGROUND_SERVICE_LOCATION` on Android 14+). This is reachable only via **Capacitor, React Native/Expo, or native Kotlin** — never a PWA.
- **Recommended: wrap the React UI in Capacitor** and use the **free, MIT `@capacitor-community/background-geolocation`** plugin. Lowest cost ($0 plugin + one-time $25 Play account), highest code reuse, delivers the core feature a PWA can't. Staying on the **existing Expo/RN stack is also valid and free** (`expo-location` + `expo-task-manager`) — it's the least-migration option, with documented reliability gaps.
- **Lowest-friction starting point — foreground-only, no `ACCESS_BACKGROUND_LOCATION`:** you can run a native **foreground service while the app/feature is active** (screen on, recording notification visible) *without* requesting `ACCESS_BACKGROUND_LOCATION`. This entirely **sidesteps the Google Play background-location declaration review** and is the fastest path to a working Android demo that records a real run. Only add `ACCESS_BACKGROUND_LOCATION` (and the review gate) once true screen-off / app-backgrounded tracking is a hard requirement.
- **Upgrade path if battery/reliability disappoints:** swap in the Transistor Software SDK — **free in debug, $399 one-time/perpetual per app for release** (verified) — on either Capacitor or RN without architecture changes.
- **Build the earliest prototype as a plain PWA** (instant iteration; Screen Wake Lock keeps a foreground demo alive), then drop the same React code into the Capacitor shell the moment background tracking is needed. **Push notifications do NOT force a wrapper** (Web Push works on installed Android PWAs).

**Recommended free / hybrid stack (one line per domain):**

- **Platform:** Capacitor shell around a React web UI (or stay on Expo/RN) — only way to get the Android foreground service for background GPS.
- **Maps renderer:** MapLibre GL JS (PWA/Capacitor WebView) / `@maplibre/maplibre-react-native` (RN) — free BSD/MIT, shared `style.json` + vector-tile contract.
- **Tiles:** OpenFreeMap now (free, no key, commercial OK), migrate to self-hosted **Protomaps PMTiles** (regional extract on the Oracle VM via Caddy) for durability.
- **Route drawing:** Terra Draw via `@watergis/maplibre-gl-terradraw` (web/JS) + `route-snapper` for client-side road-snapping — web-only, which favors a WebView surface.
- **Routing engine:** self-hosted **GraphHopper** (loop-by-distance + turn-by-turn + A→B) + **Valhalla** (map-matching) on the Oracle VM; prototype against the OpenRouteService free API first.
- **AI suggestions:** thin LLM *intent parser* (Groq Llama 3.1 8B primary, Gemini 2.5 Flash-Lite fallback) emitting a validated parameter object → deterministic round-trip routing. Ship v1 with no LLM (form/chips).
- **Realtime live tracking:** **Firebase Realtime Database** (free) for fastest path, or **Socket.IO on the existing NestJS** (zero new infra) as the no-cost self-host destination.
- **Gamification:** **PostGIS** on the existing Postgres (segment matching via `ST_DWithin` + `ST_LineLocatePoint` + interpolation) + plain SQL leaderboards.
- **3D replay (phase 2):** deck.gl TripsLayer over MapLibre GL JS on a web surface; free AWS Terrarium DEM for 3D terrain.
- **Auth / push:** **Firebase Auth** (free ≤50K MAU) + **Firebase Cloud Messaging** (free, unlimited, HTTP v1 API).
- **Media storage:** **Cloudflare R2** (10 GB free, zero egress).
- **Elevation:** self-hosted **OpenTopoData** (SRTM 90m or regional Copernicus GLO-30) + free AWS Terrarium tiles for terrain.

---

## Platform Decision: PWA vs Capacitor vs React Native/Expo vs Native

This domain *is* the platform decision. Everything the PoC needs — drag-to-create routes, leaderboards, invites, even Web Push and live-tracking *viewing* — a PWA can do. The single feature it cannot do is **continuous background GPS with the screen off**, and that one requirement forces a native app shell. The wrapper is being adopted almost solely to obtain an Android **foreground service** for location.

### Capability matrix

| Feature | Pure PWA | Capacitor (+ community BG-geo) | React Native / Expo | Native Kotlin |
|---|---|---|---|---|
| **Background GPS (screen off)** | ❌ Impossible — `watchPosition` halts when backgrounded; no Geolocation in SW; Periodic Sync ≥12 h, not real-time (CONFIRMED) | ✅ Foreground service via free MIT plugin | ✅ `expo-location`+`expo-task-manager` (⚠️ documented sparse/unreliable updates) | ✅ Gold standard (FusedLocationProvider + FGS) |
| **Foreground GPS (app open)** | ✅ `watchPosition` + Screen Wake Lock (Baseline) | ✅ | ✅ | ✅ |
| **Live-tracking connection while running** | ❌ OS freezes/discards renderer; WebSocket drops when backgrounded (CONFIRMED) | ✅ FGS keeps socket + GPS alive | ✅ | ✅ |
| **Push notifications** | ✅ Web Push + VAPID (Chrome/FF Android, survives closed tab) | ✅ FCM native SDK (most reliable) | ✅ FCM SDK | ✅ FCM SDK |
| **Install to home screen** | ✅ Add-to-Home-Screen / manifest | ✅ Play Store app | ✅ Play Store app | ✅ Play Store app |
| **Dev speed / iteration** | ✅ Instant reload, no build/sign | ⚠️ Reuses React verbatim, but adds build/sign pipeline | ⚠️ Matches current stack; needs Dev Client (no Expo Go for native maps) | ❌ Slowest; separate Kotlin codebase, no web reuse |
| **App-store requirement** | ✅ None | ⚠️ $25 Play account + BG-location review *(only if `ACCESS_BACKGROUND_LOCATION` requested)* | ⚠️ $25 Play account + BG-location review *(same caveat)* | ⚠️ $25 Play account + BG-location review *(same caveat)* |
| **Cost** | ✅ $0 | ✅ $0 plugin + $25 once (or $399 Transistor) | ✅ $0 (or $399 Transistor) | ✅ $0 SDKs + $25 once |

### What background GPS does to the PWA option on Android

There is **no web-platform mechanism** for a PWA to capture a continuous GPS track with the screen off (verified against the W3C Geolocation spec, Chromium issues 506435/41186218, Mozilla bug 1482733, and the Periodic Background Sync explainer). Concretely:

1. `watchPosition` is tied to a foreground `Window`; Android Oreo+ background-location limits stop fixes once the app/tab is not foreground or the screen is off — described as *by-design*.
2. The Geolocation API is not exposed to Service Workers, so a SW cannot keep sampling after the page is frozen (W3C ServiceWorker issue #745, open since 2015).
3. The only true web background scheduler, Periodic Background Sync, enforces a ≥12 h gap and is explicitly *not* for real-time tracking.
4. Once backgrounded, the Page Lifecycle API **freezes then discards** the renderer, killing any WebSocket — so a PWA can show live tracking only in the foreground with the screen on.

The fix is an Android **foreground service** with a persistent notification and the `location` foreground-service type, which keeps GPS sampling *and* the network connection alive. The web platform exposes no API to start one (confirmed via `android-browser-helper` issue #496 — the only PWA path is a TWA wrapping native code), so it is reachable only through Capacitor, RN, or native.

### Recommendation and upgrade path

**Recommendation:** Build the map/route/leaderboard UI as a **React web app and wrap it in Capacitor**, using the free MIT `@capacitor-community/background-geolocation` plugin for the Android foreground service. Do the very earliest prototyping as a **plain PWA** (instant iteration, Screen Wake Lock for a foreground-only demo) and move into the Capacitor shell the moment real background tracking is needed — the web code carries over unchanged.

**Lowest-friction first step (skip the review gate):** before committing to full background tracking, run a **foreground-only** recording mode — a native foreground service active *only while the run screen is open* (screen on, notification visible) and **without** declaring `ACCESS_BACKGROUND_LOCATION`. This records a real GPS track and demos the full loop while **completely avoiding Google Play's background-location declaration review**, which is the slowest, riskiest gate to a shippable Android PoC. Promote to true screen-off tracking (and the review) only when the product demands it.

**Critical implementation caveat (CONFIRMED against the v1.2.26 README):** after **5 minutes** in the background, Android throttles WebView-initiated HTTP requests; if unmitigated, GPS points silently stop syncing mid-run. Mitigate by uploading points through a **native HTTP plugin (CapacitorHttp)** and/or setting `android.useLegacyBridge=true`. Also note Android 13+ requires the `POST_NOTIFICATIONS` runtime permission for the persistent notification.

**Upgrade path:** if the community plugin's battery use or reliability is inadequate on long runs, swap in the **Transistor Software SDK** (free in debug; **$399 one-time/perpetual per app** for release, identical pricing on Capacitor and RN — CONFIRMED) with no architecture change. Reserve native Kotlin for when reliability/battery at scale becomes a hard product requirement.

**Hard release gate (CONFIRMED, framework-agnostic) — only if you ship `ACCESS_BACKGROUND_LOCATION`:** any app declaring `ACCESS_BACKGROUND_LOCATION` must pass Google Play's background-location **declaration review** — a prominent in-app disclosure plus a demo video showing the disclosure, the runtime prompt, and the background feature in action. **Background location must be the app's *core* purpose; "nice-to-have" tracking is rejected**, and the review can **reject or materially delay** a PoC submission. This applies equally to Capacitor, RN/Expo, and native. Two ways to avoid the gate for a PoC: (1) the **foreground-only path above** (no `ACCESS_BACKGROUND_LOCATION` at all), or (2) ship to **closed/internal testing tracks**, which do not require the public production declaration. Note the **April 15, 2026 Play policy update** tightened location handling (location-button as recommended scope, geofencing removed as an approved FGS use case); the declaration/disclosure/video requirement remains and the justification bar is higher — re-check live policy before release.

---

## Maps & Drawing

A fully free, open-source map stack is achievable. MapLibre GL JS (web) and `@maplibre/maplibre-react-native` (native) are the de-facto Mapbox replacements and share the exact same `style.json` + vector-tile contract, so the choice is portable across PWA/Capacitor/RN and does **not** force a wrapper. The route-drawing tools, however, are web/JS only — which mildly favors keeping a web rendering surface.

| Option | Type | Free tier / Cost | Self-host | Notes |
|---|---|---|---|---|
| MapLibre GL JS | Library | Free (BSD-3) | n/a (npm) | Web/PWA renderer; huge plugin ecosystem (terra-draw, pmtiles, deck.gl) |
| @maplibre/maplibre-react-native | Library | Free (MIT) | n/a | RN SDK; native code → **needs Expo Dev Client, not Expo Go** |
| OpenFreeMap | Managed-free | Free, **no enforced limit, commercial OK** (CONFIRMED) | Yes (Btrfs/MBTiles) | Donation-funded single operator (~$500/mo) → low bus factor; a ~100M req/24h per-referer cap is only a *future plan*, not enforced |
| Protomaps PMTiles | Self-host | MIT software; hosting = storage+egress (regional extract small) | Yes (static file + Caddy Range/CORS) | Cheapest durable self-host. **On the WebView/PWA surface you use MapLibre GL JS + `pmtiles.js` `addProtocol` (the JS code path).** Native on-device PMTiles (MapLibre Native ≥11.8.0 / iOS ≥6.10.0, CONFIRMED) applies **only to the RN-native SDK**, not Capacitor. |
| Planetiler | Self-host | Free (Apache-2.0) | Yes | Build your own tiles; **don't run planet builds on the free VM** — regional only |
| MapTiler Cloud | Managed-free | **100k req + 5k sessions + 100 MB/mo; pauses when exhausted; non-commercial** (CONFIRMED) | Paid on-prem | Hard cap pauses your map; API key |
| Stadia Maps | Managed-free | **200,000 credits/mo** (NOT 2,500 — see Risks), **non-commercial/eval only** | No (engines are) | Bundles Valhalla routing + Pelias geocoding |
| Terra Draw + @watergis/maplibre-gl-terradraw | Library | Free (MIT) | n/a | linestring/freehand drawing; **web-only, no RN build** (CONFIRMED) |
| route-snapper | Library | Free (Apache-2.0) | Graph file on VM | Client-side road-snapping (WASM); **web-only** (CONFIRMED) |
| Photon / Nominatim | Self-host | Free (Apache/GPL) | Yes (regional extract) | Photon = best autocomplete; Nominatim = structured address; planet index too big for free VM |

**Recommendation:** MapLibre GL JS (web) + `@maplibre/maplibre-react-native` (RN) for rendering; **OpenFreeMap** for immediate dev speed with a ready **Protomaps PMTiles** regional-extract migration path served from Caddy (Range + CORS). On the recommended **Capacitor/WebView** surface, PMTiles is wired via **MapLibre GL JS + `pmtiles.js addProtocol`** — the on-device MapLibre Native ≥11.8.0 path only matters if you render with the RN-native SDK instead. Use **Terra Draw** (`@watergis/maplibre-gl-terradraw`) for drawing and **route-snapper** for snapping — both web-only, so run the route-creation screen in a WebView (trivial under PWA/Capacitor; on RN-native you'd embed a WebView). Avoid the dead `mapbox-gl-draw` for MapLibre. Self-host **Photon** (regional) for autocomplete.

---

## Routing Engines (loop-by-distance, snap-to-road, turn-by-turn, A→B)

The four routing needs split cleanly across engines; no single self-hostable engine does all four perfectly. Routing is a stateless server-side HTTP concern and is **platform-agnostic** — it does not influence the PWA-vs-wrapper decision.

| Option | Type | Free tier / Cost | Self-host | Notes |
|---|---|---|---|---|
| GraphHopper | Self-host | Apache-2.0 free; hosted free 500 credits/day non-commercial | Yes (fits free VM, 1-country) | **Only self-hostable loop-to-distance** (`algorithm=round_trip`, foot/hike); turn-by-turn; A→B. `round_trip` requires `ch.disable=true` (CONFIRMED) |
| Valhalla | Self-host | MIT free | Yes (1-country fits VM) | **Best map-matching** (Meili `/trace_route`) returns snapped shape + turn-by-turn; no loop-by-distance; needs SSD for tile build |
| OSRM | Self-host | BSD-2 free | Yes (lightest) | Fastest A→B; `/match` for dense traces; **no loop-by-distance**, one profile per build, no elevation |
| OpenRouteService | Managed-free | **~2,000 directions/day, sliding 40/min, round_trip ≤100 km** (CONFIRMED) | Yes (GraphHopper-based) | Prototype here before self-hosting; same engine family. **The round_trip ≤100 km cap directly bounds AI loop-suggestion distance during prototyping.** |
| Mapbox Navigation/Matching | Managed-free | **~100k req/mo each** for Directions/Matching/Isochrone; Matching+Isochrone 300 req/min; ~$2.00/1k after (CONFIRMED; card required) | No | Optional high-quality map-matching fallback; no loop-by-distance |

**Recommendation:** Self-host **GraphHopper** on the Oracle Ampere A1 free VM with a single-country/region OSM extract serving foot + hike profiles — it covers loop-to-distance (`round_trip`), turn-by-turn, and A→B. Add a **Valhalla** container for map-matching (Meili `/trace_route`). Prototype against the **OpenRouteService free API** first to defer infra (but note its **round_trip ≤100 km** ceiling limits how long an AI-suggested loop can be while prototyping). Skip OSRM (no loop-by-distance, single-profile). **Sizing caveat (PARTLY-TRUE finding):** a *country* extract fits the 24 GB VM, but the cited "Germany ~300 MB PBF" is wrong — Germany is **~4.4 GB PBF** (Geofabrik); GraphHopper's ~4–8 GB band is tight for *import* and Valhalla's ~8–16 GB only appears under heavy matrix loads (idle ~4–6 GB). A single small region is comfortable; Europe/continent extracts blow past the free tier.

---

## AI / LLM Route Suggestion

The realistic, low-cost design is a thin LLM **intent parser** in front of the deterministic routing engine: free text → a validated structured parameter object (distance, profile, start, avoid-X, near-POI) → existing round-trip/route calls. The LLM never invents geometry. This domain is **entirely server-side and platform-agnostic**. You don't strictly need an LLM for a PoC — a form/keyword heuristic feeding the same endpoint covers most intents.

| Option | Type | Free tier / Cost | Self-host | Notes |
|---|---|---|---|---|
| Google Gemini Flash-Lite/Flash | Managed-free | Free tier **volatile** — cut 50–80% Dec 2025, changed again ~May 2026; numbers now only in AI Studio — **verify live** (PARTLY-TRUE) | No | Best structured-output/JSON-schema adherence; **free-tier data trains Google products + human review (terms eff. 2026-03-23, CONFIRMED) → no PII** |
| Groq (Llama 3.1 8B) | Managed-free | **8B: 14,400 RPD / 500k TPD**, but **shared 30 RPM / 6,000 TPM per-minute ceiling** (others ~1,000 RPD); no card (CONFIRMED) | No (open models → portable) | Lowest latency; primary $0 provider; validate tool-call JSON + retry. **The 30 RPM cap can bite a burst of route suggestions before the daily cap does.** |
| OpenRouter `:free` models | Managed-free | 50 free RPD until a one-time $10 deposit → 1,000 RPD | No | One gateway, many models, auto-fallback |
| Self-hosted Ollama (Qwen2.5/Llama 8B) | Self-host | $0 software; 8B Q4_K_M ~6 GB RAM, **single-digit tok/s CPU-only on free VM** (CONFIRMED) | Yes | No quota, full privacy (safe for PII); slow → async/fallback only |
| No-LLM heuristic + round_trip | Library | $0 | Reuses routing engine | Deterministic, instant, hallucination-free; ship as v1 |

**Recommendation:** Ship in two layers sharing one routing backend. **v1 = no LLM:** a form/chip UI maps directly to GraphHopper `round_trip` (multiple `seed`s, `use_hills` low = "flat", avoid motorway/primary = "busy roads"), generating 3–5 ranked candidates. **v2 = thin LLM intent parser** emitting the same schema-validated object, with **Groq Llama 3.1 8B** primary and **Gemini 2.5 Flash-Lite** fallback behind an OpenAI-compatible interface (swap to Ollama later). Mind Groq's **30 RPM / 6,000 TPM** per-minute ceiling for suggestion bursts, not just the daily cap. Guardrails: always validate against the schema and retry; never let the LLM produce geometry; **strip PII before any free-tier call** (Gemini free-tier inputs are used for training and may be human-reviewed). Keep all keys server-side.

---

## Realtime Live Tracking

Each runner pushes GPS every 2–5 s to a realtime layer keyed by `routeId`, fanned out to everyone viewing that route, with a copy persisted to Postgres. At PoC scale this is tiny. **The binding constraint is not the backend — it's the client platform:** a backgrounded PWA cannot keep a WebSocket alive or keep emitting GPS, so the *runner* role requires a foreground service (Capacitor/RN/native). Viewers, who only watch in the foreground, can be lighter.

| Option | Type | Free tier / Cost | Self-host | Notes |
|---|---|---|---|---|
| Firebase Realtime Database | Managed-free | **100 simultaneous connections, 1 GB stored, 10 GB/mo download** (CONFIRMED) | No | Fastest PoC: fan-out + presence (`onDisconnect`) + offline queue + auth, no server code; keep leaderboards in Postgres |
| Cloud Firestore | Managed-free | 1 GiB; **per-day 50k reads / 20k writes / 20k deletes** (CONFIRMED) | No | Wrong tool for high-frequency telemetry (20k writes/day burns fast); use for metadata only |
| Supabase Realtime | Managed-free | **200 peak connections, 2M msgs/mo, 256 KB** (CONFIRMED); **pauses after 7 days inactivity** | Yes (heavy stack) | Broadcast + Presence purpose-built; self-host config via `max_concurrent_users` |
| Socket.IO on existing NestJS | Self-host | Free (MIT) | Yes (zero new infra) | Rooms = routes; persist via Prisma; reuse JWT; scale later with Redis adapter |
| Centrifugo | Self-host | OSS free (Apache-2.0) | Yes (~1 GB RAM → 10k+ conns) | Built-in presence/history/auth; upgrade from Socket.IO if fan-out grows |
| MQTT (Mosquitto/EMQX) | Self-host | Free | Yes (Mosquitto tiny) | Efficient telemetry + Last-Will presence; needs WS client + persistence bridge |
| Ably / Pusher / PubNub | Managed-free | **Ably 6M msgs/mo + 200 conns**; **Pusher 100 conns + 200k msgs/day (dev-oriented)**; **PubNub 200 MAU** (CONFIRMED; Pusher "non-prod-only" overstated) | No | Ably is the most generous managed alternative to Firebase |

**Recommendation:** Pick per your platform decision. **Fastest path:** **Firebase Realtime Database** (free) for the live position stream + presence + Firebase Auth — write to `/live/{routeId}/{userId}`, viewers subscribe to `/live/{routeId}`, fan out **deltas only**, keep leaderboards in Postgres. Two caps bind, and the **100-connection ceiling is the one most likely to stop a multi-viewer demo first** — every device *and* every open viewer tab counts as one of the 100 connections (1 device/tab = 1 connection). The **10 GB/mo download** cap is easy to under-estimate under fan-out: a single 2–5 s position delta of ~200 bytes fanned to *N* viewers for a 30-min run is roughly `N × (~360 deltas) × ~0.2 KB ≈ N × 72 KB` per runner-session — so e.g. **10 viewers × 100 such sessions ≈ ~72 MB**, but bump payloads (full docs instead of deltas), viewer counts, or session length and you can burn the 10 GB in a few hundred busy demo sessions. Send minimal deltas and watch both caps. **Self-host destination:** add a **Socket.IO Gateway to the existing NestJS** (zero new infra, no caps, reuses Postgres + JWT; Caddy already proxies WebSocket upgrades), promoting to **Centrifugo** only if fan-out outgrows one Node process. Use **Supabase Realtime** only if consolidating auth+DB+realtime on Supabase; **Ably** if you want hosted realtime without Firebase.

---

## Gamification & Leaderboards (Strava-style segments)

You can fully replicate Strava segments with the Postgres you already run, by adding **PostGIS**. A segment is a directed reference LineString with start/end gates; matching an activity = gate-detect, verify corridor + forward direction, interpolate elapsed time. Entirely server-side and platform-agnostic — though match quality depends on dense background GPS, which again favors a native recording client.

| Option | Type | Free tier / Cost | Self-host | Notes |
|---|---|---|---|---|
| PostGIS (`ST_DWithin` + `ST_LineLocatePoint` + interp) | Self-host | Free (GPL) | Yes (existing Postgres) | Recommended core: corridor filter → gate interpolation → monotonic-progress direction check → elapsed time. GIST indexes. |
| `ST_FrechetDistance` / `ST_HausdorffDistance` | Self-host | Free (PostGIS) | Yes | Secondary "did the trace follow the line?" gate (Fréchet ≥ 2.4.0, GEOS ≥ 3.7 — CONFIRMED); clip with `ST_LineSubstring` first |
| Map-matching pre-clean (Valhalla/OSRM) | Self-host | Free | Yes (heavy build) | **Defer for PoC** — GB-scale RAM/disk build competing with Postgres (CONFIRMED); share with routing domain if added later |
| Plain SQL leaderboard (window fn / `DISTINCT ON`) | Self-host | Free | Yes | Recommended: `segment_efforts` table, best-per-user ranked, `(segment_id, elapsed_seconds)` index, keyset pagination |
| Redis sorted sets | Self-host | Free OSS; managed free tiers small/changing (CONFIRMED) | Yes (adds container) | O(log N) rank; **premature for PoC** — defer; can't express rich filters SQL handles |

**Recommendation:** Do it all in the existing Postgres via **PostGIS**. **Critical correction (REFUTED finding):** the recommendation to "switch to the official `postgis/postgis` 18-* image" is **wrong for this aarch64 VM** — the official `postgis/postgis` repo publishes **amd64-only** PG18 tags (no ARM64). The live DB was confirmed as **PostgreSQL 18.3 on aarch64, plain `postgres:latest`, no PostGIS** (and the Prisma schema confirms the one-row-per-point `ActivityLocation` model). Use the community **`imresamu/postgis`** multi-arch fork instead (e.g. `imresamu/postgis:18-3.6`), keep the volume mount at `/var/lib/postgresql` (PG18 `PGDATA=/var/lib/postgresql/18/docker`), and **back up `postgres_data` before switching**. Then store segments as `geometry(LineString,4326)`, replace the current `ActivityLocation` per-point table with a LineString column + denormalized summaries on `Activity`, add GIST indexes, and rank leaderboards with plain SQL. Defer Redis and map-matching.

---

## 3D / Animated Replay (optional, phase 2)

An animated flyby is a browser/WebGL feature, not native-mobile. The lowest-effort free path is deck.gl's **TripsLayer** (moving fading trail driven by a `currentTime` playhead) over a MapLibre GL JS basemap, optionally with 3D terrain from free AWS Terrarium DEM. This argues **mildly for a web rendering surface** but should not override the background-GPS decision: under Capacitor the UI is already a WebView, so the same code runs; under RN-native you embed a WebView.

| Option | Type | Free tier / Cost | Self-host | Notes |
|---|---|---|---|---|
| deck.gl TripsLayer over MapLibre GL JS | Library | Free (MIT / BSD-3) | n/a | ~1 day to a credible flyby; **normalize timestamps off a base time (float32) and interleaved mode needs WebGL2 / maplibre-gl ≥3** (CONFIRMED); no RN renderer |
| MapLibre GL JS 3D terrain (`setTerrain`) | Library | Free (BSD-3) | n/a | **Web-only — MapLibre Native still has NO `setTerrain`** (CONFIRMED June 2026; only fill-extrusion + 2D hillshade native) |
| AWS Terrarium DEM tiles | API | Free, **CORS-open, no key, no published rate limit, maxzoom 15** (CONFIRMED live) | Optional mirror | `raster-dem`, `encoding:'terrarium'`, decode `(R*256+G+B/256)-32768` |
| MapTiler Cloud terrain | Managed-free | 100k req / 5k sessions; non-commercial; pauses (CONFIRMED) | Paid on-prem | CDN-backed, higher detail; API key |
| CesiumJS + Cesium ion | Hybrid | Engine free (Apache-2.0); **ion Community 15 GB/mo stream + 5 GB store, non-commercial, upgrade >$50K; next tier $149/mo** (CONFIRMED) | Partial | True 3D globe; overkill + GPU-risky for PoC |
| Three.js (expo-gl in RN) | Library | Free (MIT) | n/a | Only native-RN 3D option; highest effort; reinvents deck.gl |

**Recommendation:** **deck.gl TripsLayer over MapLibre GL JS on a web surface**, shipped flat first (already reads as "Strava replay"). Phase-2 polish: add `map.setTerrain()` (exaggeration ~1.5) pointing at the keyless **AWS Terrarium** endpoint plus pitch/bearing `flyTo`. Skip Cesium (non-commercial cap, GPU-heavy) and Three.js (reinvents everything) for the PoC. Remember to normalize timestamps and use WebGL2 interleaved mode.

---

## Backend: Auth, Storage, Push

Keep the existing self-hosted NestJS + Postgres as the system of record; use free managed tiers only for the fiddly identity, push, and media-CDN pieces. **Push is the only backend domain that touches the platform decision** — and it works on all three shells, so it does **not** force a wrapper.

| Option | Type | Free tier / Cost | Self-host | Notes |
|---|---|---|---|---|
| Firebase Auth | Managed-free | **50K MAU; email/social free; phone/SMS metered (~$0.01–$0.13/SMS typical, premium carriers to ~$0.34) + Blaze** (CONFIRMED) | No | Fastest login; pairs with FCM; no inactivity pause |
| Supabase Auth | Managed-free | 50K MAU, 500 MB DB, 1 GB storage; **2-project cap; pauses after 7 days inactivity** (CONFIRMED) | Yes (heavy) | Auth+DB+storage+realtime in one; pause hurts sporadic demos |
| NestJS + Passport-JWT | Library | Free | Yes (in-process) | No lock-in; you build reset/OAuth/verification (slow) |
| Better-Auth / Keycloak | Self-host | Free | Yes | **Lucia deprecated**; Keycloak too heavy for PoC |
| GPS storage: PostGIS LineString | Self-host | Free | Yes | Recommended; ~<100 KB/activity vs ~0.3–0.7 MB for current per-point rows; unlocks segment queries |
| GPS storage: TimescaleDB / GeoJSON-JSONB | Self-host | Free | Yes | Timescale = future scale; JSONB = ship-before-PostGIS (no spatial queries) |
| Media: Cloudflare R2 | Managed-free | **10 GB, 1M Class A, 10M Class B, ZERO egress** (CONFIRMED) | S3-compatible | Recommended; protects VM bandwidth, portable |
| Media: Firebase Storage | Managed-free | Legacy bucket 5 GB on Spark; **new buckets need Blaze** | No | Fine if one ecosystem; egress billed |
| Media: self-hosted MinIO | Self-host | Free | Yes | **AVOID — repo archived (Apr 2026), official images discontinued (Oct 2025), Bitnami no longer free** (PARTLY-TRUE; conclusion strengthened) |
| Push: Firebase Cloud Messaging | Managed-free | **Free + unlimited, both plans** (CONFIRMED) | No | Works PWA/Capacitor/native; **legacy server-key API dead since July 2024 → must use HTTP v1 + service-account JSON** (CONFIRMED) |

**Recommendation:** **Firebase Auth** (email + Google, JWT verified in NestJS via Admin SDK; avoid paid SMS) + **GPS tracks in PostGIS LineString** on the existing Postgres + **Cloudflare R2** for media (do NOT stand up MinIO) + **FCM** for push (send from NestJS with the **HTTP v1 API + service-account JSON** — the legacy server-key path is shut down). Push does not force a native wrapper.

---

## Elevation Data

Two jobs: (1) elevation profiles + gain/loss (sample a DEM along the track), and (2) 3D terrain in the map. Both are platform-agnostic. Compute gain from the **DEM-sampled** profile (not noisy raw GPS altitude), smoothed, with a ~10 m noise threshold (Strava-style).

| Option | Type | Free tier / Cost | Self-host | Notes |
|---|---|---|---|---|
| Copernicus DEM GLO-30 (AWS Open Data) | Self-host | **Free, open, no AWS account, COG** (CONFIRMED live) | Yes (region-clip) | Best free 30m (~4m vertical); read COGs on demand to keep disk tiny |
| OpenTopoData | Self-host | Free (MIT) | Yes (~1 GB RAM) | Google-Elevation-compatible JSON; **SRTM 90m=12 GB fits free VM, SRTM 30m=73 GB likely too big** (CONFIRMED sizes) |
| Open-Meteo Elevation API | API | **~10k/day, 100 coords/req, GLO-90, NON-COMMERCIAL only** (CONFIRMED) | Yes (AGPLv3) | Fastest stand-in; migrate before commercial launch |
| AWS Terrarium tiles | Self-host/API | **Free, keyless, CORS-open, maxzoom 15** (CONFIRMED) | Optional mirror | `raster-dem` source for `setTerrain` + hillshade |
| MapTiler Cloud terrain | Managed-free | 100k req / 5k sessions; non-commercial + logo | Paid on-prem | CDN, higher detail; API key |
| Google Maps Elevation API | Managed-paid | **Only 5,000 free/mo (credit ended Feb 28 2025), then $5/1k** (CONFIRMED) | No | Effectively not free — avoid |

**Recommendation:** Self-host **OpenTopoData** in the existing Docker Compose, pointed at **Copernicus GLO-30 COGs** (region-clipped) or **SRTM 90m** (12 GB) if disk is tight — Google-Elevation-compatible, unlimited self-hosted. Batch all track points into one request per activity. For 3D terrain, use the keyless **AWS Terrarium** tiles as a MapLibre `raster-dem` source (mirror behind Caddy for reliability). Use **Open-Meteo** only as a temporary non-commercial stand-in. Avoid the Google API.

---

## Recommended Architecture (Android PoC)

```
                         ┌─────────────────────────────────────────────────┐
                         │  ANDROID CLIENT  (Capacitor shell, React UI)     │
                         │  — or existing Expo/React Native —               │
                         │                                                  │
                         │  • MapLibre (GL JS in WebView / RN SDK)          │
                         │  • Terra Draw + route-snapper (WebView surface)  │
                         │  • deck.gl TripsLayer 3D replay (WebView, ph.2)  │
                         │  • PMTiles via pmtiles.js addProtocol (WebView)  │
                         │  • Foreground Service → GPS recording            │
                         │    – PoC start: foreground-ONLY (screen on, no   │
                         │      ACCESS_BACKGROUND_LOCATION → no Play review) │
                         │    – then background (screen off) when required   │
                         │    via @capacitor-community/background-geolocation│
                         │    (upload points via native HTTP, NOT WebView)  │
                         │  • Firebase Auth (JWT)   • FCM push              │
                         └───────┬───────────────────────┬──────────────────┘
                                 │ HTTPS (Caddy TLS)      │ realtime
                                 ▼                        ▼
   ┌──────────────────────────────────────┐   ┌──────────────────────────────┐
   │  ORACLE FREE-TIER VM (Ampere A1)      │   │  REALTIME LAYER              │
   │  Docker Compose behind Caddy proxy    │   │  Firebase RTDB (fast path)   │
   │                                       │   │   /live/{routeId}/{userId}   │
   │  • NestJS API (verifies Firebase JWT) │◄──┤   — OR —                     │
   │  • Postgres 18 + PostGIS              │   │  Socket.IO on NestJS (rooms  │
   │    (imresamu/postgis, aarch64)        │   │   = routes, persist→Postgres)│
   │    – LineString tracks + segments     │   └──────────────────────────────┘
   │    – SQL leaderboards (window fns)    │
   │  • GraphHopper  (round_trip, foot,    │   ┌──────────────────────────────┐
   │    turn-by-turn, A→B)                 │   │  EXTERNAL FREE/HYBRID         │
   │  • Valhalla    (Meili map-matching)   │   │  • Tiles: OpenFreeMap →       │
   │  • OpenTopoData (elevation profiles)  │   │    self-host PMTiles (Caddy)  │
   │  • PMTiles + Terrarium tiles (Caddy)  │   │  • LLM: Groq / Gemini         │
   │  • AI intent parser (calls Groq/Gemini│   │    (intent → params only)     │
   │    → GraphHopper round_trip)          │   │  • Media: Cloudflare R2       │
   └───────────────────────────────────────┘   │  • DEM/Terrain: AWS Open Data │
                                                └──────────────────────────────┘
```

Bias: self-host the heavy/expensive pieces (Postgres+PostGIS, GraphHopper, Valhalla, OpenTopoData, tiles) on the one free Oracle VM behind Caddy; use free managed tiers only for auth, push, realtime-if-RTDB, media CDN, and LLM.

---

## Free-Tier & Cost Summary

| Service | Used for | Free limit | When you'd start paying / self-host trigger |
|---|---|---|---|
| `@capacitor-community/background-geolocation` | Background GPS | Free (MIT), unlimited | If battery/reliability poor → Transistor $399 once/app |
| Transistor SDK (upgrade) | Battery-smart background GPS | Free in debug builds | **$399 one-time/perpetual per app** for release |
| Google Play Developer account | Publishing | — | **$25 one-time** to publish |
| Google Play BG-location review | Shipping `ACCESS_BACKGROUND_LOCATION` | Free, but can **reject/delay**; must be *core* purpose | Avoid via foreground-only PoC or closed/internal testing track |
| MapLibre (JS + RN) | Map rendering | Free, unlimited | Never (you pay only for tiles) |
| OpenFreeMap | Map tiles (start) | No enforced limit, commercial OK | Reliability/longevity → self-host PMTiles |
| Protomaps PMTiles (self-host) | Map tiles (durable) | Storage+egress only; regional = small | Egress at scale → CDN (R2/CloudFront <$5/mo) |
| GraphHopper / Valhalla (self-host) | Routing + map-matching | Free; fits VM for 1 region | Multi-country/continent extract → paid VM |
| OpenRouteService | Routing (prototype) | ~2,000 directions/day, 40/min, **round_trip ≤100 km** | Live/heavy use or longer loops → self-host GraphHopper |
| Groq (Llama 3.1 8B) | LLM intent parser | 14,400 RPD / 500k TPD, **30 RPM / 6,000 TPM** | Burst >30 RPM or beyond PoC volume → paid / self-host Ollama |
| Gemini Flash-Lite | LLM fallback | Volatile (~250–1,500 RPD, **verify live in AI Studio**); **no PII** | PII/personalization → paid tier or Ollama |
| Firebase Realtime Database | Live tracking (fast path) | 100 conns, 1 GB, 10 GB/mo download (≈ N viewers × ~72 KB/runner-session/30 min) | >100 concurrent conns, or download cap (fan-out × viewers) → Blaze or Socket.IO |
| Socket.IO on NestJS (self-host) | Live tracking (durable) | Free, no caps | Multi-instance scale → Redis adapter / Centrifugo |
| PostGIS on existing Postgres | Segments + tracks + leaderboards | Free | Never (until very high traffic → Redis cache) |
| Firebase Auth | Login | 50,000 MAU; email/social free | Phone/SMS auth → Blaze (~$0.01–$0.13/SMS, premium to ~$0.34) |
| Firebase Cloud Messaging | Push | Free + unlimited (both plans) | Never (FCM itself); adjacent Cloud Functions billed |
| Cloudflare R2 | Media (thumbnails/avatars) | 10 GB, zero egress | >10 GB or >1M writes/mo → $0.015/GB-mo |
| OpenTopoData (self-host) | Elevation profiles | Free, unlimited | DEM disk on VM → use SRTM 90m / clip Copernicus |
| AWS Terrarium / Copernicus DEM | 3D terrain + DEM | Free, keyless, no published cap | Production reliability → mirror behind your CDN |
| deck.gl + MapLibre + Cesium engine | 3D replay (phase 2) | Free (MIT/BSD/Apache) | Cesium ion only: >15 GB/mo stream or >$50K revenue |

---

## Phased Roadmap

**Phase 0 — Fastest PoC (validate core loop):**
- Plain **PWA** (React + MapLibre GL JS) for instant iteration: drag-to-create routes (Terra Draw + route-snapper), Screen Wake Lock for a foreground-only single-session tracker.
- Backend: existing NestJS + Postgres; add **PostGIS** (via `imresamu/postgis`, back up volume first), store tracks as **LineString**, basic **SQL leaderboards**.
- Tiles: **OpenFreeMap**. Routing: **OpenRouteService free API** (`round_trip` + foot, ≤100 km loops). Auth: **Firebase Auth**. Elevation: **Open-Meteo** stand-in.
- **Wrap in Capacitor + free background-geolocation plugin** as soon as on-device recording is needed. **Start in foreground-only mode (no `ACCESS_BACKGROUND_LOCATION`)** to record real runs while sidestepping the Play review gate; upload points via native HTTP (5-min throttle mitigation).
- Maps to features: routes #1 (drawing/snapping), #2 invites, #3 leaderboards (PostGIS).

**Phase 1 — Real product behavior:**
- Self-host **GraphHopper** + **Valhalla** + **OpenTopoData** on the Oracle VM (regional extract); move off ORS/Open-Meteo.
- **Live tracking** #4: Firebase RTDB fast-path (deltas only; watch 100-conn + 10 GB caps), or Socket.IO on NestJS; runner role uses the foreground service.
- **AI suggestions** #1(a–d): v1 form/chips → v2 thin LLM intent parser (Groq/Gemini, PII-stripped; mind Groq 30 RPM).
- Migrate tiles to self-hosted **PMTiles** behind Caddy (WebView surface → `pmtiles.js addProtocol`); **FCM** push; **R2** media.
- Enable true **background (screen-off) tracking**: add `ACCESS_BACKGROUND_LOCATION`, then either complete Google Play's **background-location declaration review** (disclosure + demo video, core-purpose justification) or keep it on a **closed/internal testing track** to defer the public declaration.

**Phase 2 — 3D replay & scale:**
- **3D replay** #5: deck.gl TripsLayer over MapLibre (web surface / WebView), flat first then `setTerrain` + AWS Terrarium.
- Scale realtime (Centrifugo / Socket.IO Redis adapter), consider Redis sorted-set leaderboard cache, TimescaleDB for raw-point retention.
- Transistor SDK if battery/reliability needs it; evaluate a paid VM if the region grows beyond one country.

---

## Risks & Verification Notes

Most findings were **CONFIRMED** against primary sources (2026-06-01). The decision-changing ones:

- **REFUTED — PostGIS image for ARM64:** the official `postgis/postgis` image has **no PG18 ARM64 tags** (amd64-only). The live DB is confirmed PostgreSQL 18.3 on **aarch64**, plain `postgres:latest`, no PostGIS. **Use the community `imresamu/postgis` multi-arch fork** instead; keep the volume at `/var/lib/postgresql` and back up `postgres_data` before swapping. (Gamification/backend recommendations corrected accordingly.)
- **REFUTED — Stadia Maps free credits:** it's **200,000 credits/month**, not 2,500 (off by ~80×); still **non-commercial/eval only**. Doesn't change the recommendation (we don't rely on Stadia); corrected in the maps table.
- **PARTLY-TRUE — routing VM sizing:** "Germany ~300 MB PBF" is wrong (it's **~4.4 GB**); GraphHopper's 4–8 GB band is tight for *import* and Valhalla's 8–16 GB is a heavy-load worst case (idle ~4–6 GB). A *single small region* fits the 24 GB free VM; **Europe/continent extracts do not** — plan region-by-region.
- **PARTLY-TRUE — MinIO status:** repo formally archived **Apr 25, 2026** (status flagged ~Feb), official Docker images discontinued **Oct 2025**, and **Bitnami's free image is gone** too. Conclusion *strengthened*: prefer **Cloudflare R2** over self-hosted MinIO.
- **PARTLY-TRUE — Gemini free tier:** highly volatile (cut 50–80% Dec 2025, changed again ~May 2026); Google no longer publishes static numbers — **verify live in AI Studio**. Free-tier data is used for training + human review → **never send PII** (CONFIRMED terms eff. 2026-03-23).
- **PARTLY-TRUE — Firebase SMS pricing:** per-SMS ceiling exceeds the cited $0.06 in many regions (Germany ~$0.08, Indonesia ~$0.125–0.135, premium carriers to ~$0.34). Avoid phone auth on the free PoC.
- **PARTLY-TRUE — `mapbox-gl-draw` "unmaintained":** it got a release Nov 2025 — it's *low-activity and not MapLibre-native* (works only via a CSS-class hack), not abandoned. We use Terra Draw regardless, so no change.
- **PARTLY-TRUE — Groq descriptors:** the load-bearing numbers (8B = 14,400 RPD / 500k TPD, no card) are CONFIRMED; the per-minute ceiling (**30 RPM / 6,000 TPM**, shared across models) is the real burst constraint; only the "6,000 TPM for most models" generalization phrasing was imprecise.
- **CONFIRMED — Play background-location gate is core-purpose-only:** declarations for "nice-to-have" tracking are rejected, and review can reject/delay a submission. **The foreground-only path (no `ACCESS_BACKGROUND_LOCATION`) and closed/internal testing tracks both avoid the public declaration** — the lowest-friction routes to a working Android PoC.

**Remaining unknowns / time-sensitive to re-check:** OpenFreeMap's no-limit status and the still-unenforced ~100M/24h per-referer cap (keep the PMTiles fallback ready); the exact OpenRouteService daily quota (docs say ~2,000/day but the rendered plans page is account-specific); all managed free-tier numbers (Gemini, Firebase, Supabase, Ably/Pusher/PubNub, MapTiler, Groq RPM/RPD) which vendors revise frequently; Cesium ion's non-commercial $50K threshold if 3D replay ever ships publicly; the exact native SDK version your pinned `maplibre-react-native` resolves to (on-device PMTiles requires Native ≥11.8.0, relevant only on the RN-native surface); and Google Play's evolving April-2026 location policy wording before submission.

---

## Sources

- W3C Geolocation spec — https://w3c.github.io/geolocation/
- Chromium issue 506435 (background geolocation) — https://bugs.chromium.org/p/chromium/issues/detail?id=506435
- W3C ServiceWorker issue #745 (Geolocation in SW) — https://github.com/w3c/ServiceWorker/issues/745
- Periodic Background Sync — https://developer.chrome.com/docs/capabilities/periodic-background-sync
- Page Lifecycle API — https://developer.chrome.com/docs/web-platform/page-lifecycle-api
- Android foreground service types (14+) — https://developer.android.com/about/versions/14/changes/fgs-types-required
- `@capacitor-community/background-geolocation` README — https://github.com/capacitor-community/background-geolocation
- Transistor Software purchase/pricing — https://docs.transistorsoft.com/purchase/
- expo-location — https://docs.expo.dev/versions/latest/sdk/location/
- Google Play background-location declaration — https://support.google.com/googleplay/android-developer/answer/9799150
- Google Play April 2026 policy update — https://support.google.com/googleplay/android-developer/answer/16926792
- MapLibre GL JS docs — https://maplibre.org/maplibre-gl-js/docs/
- maplibre-react-native — https://github.com/maplibre/maplibre-react-native
- MapLibre Native PMTiles (Android CHANGELOG 11.8.0) — https://github.com/maplibre/maplibre-native/blob/main/platform/android/CHANGELOG.md
- pmtiles.js (`addProtocol`) — https://github.com/protomaps/PMTiles/tree/main/js
- OpenFreeMap — https://openfreemap.org/
- Protomaps PMTiles — https://docs.protomaps.com/pmtiles/
- Terra Draw — https://github.com/JamesLMilner/terra-draw ; watergis plugin — https://github.com/watergis/maplibre-gl-terradraw
- route-snapper — https://github.com/dabreegster/route_snapper
- MapTiler pricing — https://www.maptiler.com/cloud/pricing/ ; Stadia limits — https://docs.stadiamaps.com/limits/ ; Stadia pricing — https://stadiamaps.com/pricing/
- GraphHopper API / round_trip — https://github.com/graphhopper/graphhopper/blob/master/docs/web/api-doc.md
- Valhalla map-matching — https://valhalla.github.io/valhalla/api/map-matching/api-reference/
- OpenRouteService restrictions — https://openrouteservice.org/restrictions/ ; FAQ — https://giscience.github.io/openrouteservice/frequently-asked-questions
- Mapbox pricing — https://www.mapbox.com/pricing
- Gemini rate limits — https://ai.google.dev/gemini-api/docs/rate-limits ; terms — https://ai.google.dev/gemini-api/terms
- Groq rate limits — https://console.groq.com/docs/rate-limits
- Firebase pricing — https://firebase.google.com/pricing ; RTDB limits — https://firebase.google.com/docs/database/usage/limits
- Firestore quotas — https://firebase.google.com/docs/firestore/quotas
- Supabase pricing — https://supabase.com/pricing ; Realtime limits — https://supabase.com/docs/guides/realtime/limits
- Ably limits — https://ably.com/docs/platform/pricing/limits ; Pusher pricing — https://pusher.com/channels/pricing/ ; PubNub pricing — https://www.pubnub.com/pricing/
- NestJS WebSockets — https://docs.nestjs.com/websockets/adapter ; Centrifugo — https://github.com/centrifugal/centrifugo
- PostGIS `ST_LineLocatePoint` — https://postgis.net/docs/ST_LineLocatePoint.html ; `ST_DWithin` — https://postgis.net/docs/ST_DWithin.html ; `ST_FrechetDistance` — https://postgis.net/docs/ST_FrechetDistance.html
- imresamu/postgis (ARM64) — https://hub.docker.com/r/imresamu/postgis ; official image ARM note — https://github.com/postgis/docker-postgis
- deck.gl TripsLayer — https://deck.gl/docs/api-reference/geo-layers/trips-layer ; with MapLibre — https://deck.gl/docs/developer-guide/base-maps/using-with-maplibre
- MapLibre Native Terrain3D roadmap — https://maplibre.org/roadmap/maplibre-native/terrain3d/
- AWS Terrain Tiles (Terrarium) — https://registry.opendata.aws/terrain-tiles/ ; Copernicus DEM — https://registry.opendata.aws/copernicus-dem/
- Cesium ion pricing — https://cesium.com/platform/cesium-ion/pricing/
- FCM HTTP v1 migration — https://firebase.google.com/docs/cloud-messaging/migrate-v1
- Cloudflare R2 pricing — https://developers.cloudflare.com/r2/pricing/
- MinIO repo (archived) — https://github.com/minio/minio ; Bitnami change — https://hub.docker.com/r/bitnami/minio
- OpenTopoData — https://www.opentopodata.org/ ; dataset sizes — https://www.opentopodata.org/notes/dataset-sizes/
- Open-Meteo Elevation API — https://open-meteo.com/en/docs/elevation-api ; terms — https://open-meteo.com/en/terms
- Google Elevation API billing — https://developers.google.com/maps/documentation/elevation/usage-and-billing
- Oracle Always Free resources — https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm
