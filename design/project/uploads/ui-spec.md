# UI Functional Spec — Run Tracker PoC (Mobile)

This document specifies the expected **functionality** of each page in the Run Tracker proof-of-concept — *what* each screen does, the data it shows, the actions it offers, and the states it can be in — **not** its visual design (no colors, spacing, or pixel-level layout). It is written **mobile-first**: every screen is designed for a single-handed phone experience in portrait orientation. The app ships **today as a foreground-only PWA** (React + Vite, MapLibre GL JS); device capabilities (location, uploads, push, auth) sit behind thin adapter interfaces so that a **later Capacitor (Android) shell** can swap in native implementations — most importantly true screen-off background GPS — with minimal change to page logic. Wherever behavior differs between *PWA-now* and *Capacitor-later*, the spec calls it out explicitly.

## Navigation Map

The app uses a persistent **bottom tab bar** (thumb-reachable, 4 primary tabs) as the backbone of navigation once a user is authenticated. All other screens are pushed on top of a tab as modal or detail views and return to their originating tab on back.

**Primary bottom-nav tabs (always visible when authenticated, except during full-screen Record/Live):**

```
┌─────────────────────────────────────────────┐
│                                               │
│                 (page content)                │
│                                               │
├──────┬──────────┬───────────┬─────────────────┤
│ Home │  Routes  │  ●Record  │     Profile     │
│  /   │ /routes  │  /record  │    /profile     │
└──────┴──────────┴───────────┴─────────────────┘
```

- **Home** → `/`
- **Routes** → `/routes`
- **Record** → `/record` (center, emphasized call-to-action; enters full-screen tracking)
- **Profile** → `/profile`

**Pre-auth flow (no bottom nav):**

```
  App launch
     │
     ▼
 /login ──(new user / missing grants)──▶ /onboarding/permissions
     │                                            │
     └──────────────(authed & ready)──────────────┘
                          │
                          ▼
                        /  (Home)
```

**Full screen-connection map:**

```
                         ┌────────────────────────┐
                         │   /login (Launch/Auth)  │
                         └───────────┬─────────────┘
                                     ▼
                    ┌────────────────────────────────┐
                    │ /onboarding/permissions (primer)│
                    └───────────────┬────────────────┘
                                     ▼
   ┌─────────────────────────────── / (Home / Dashboard) ───────────────────────────────┐
   │     │                    │                         │                                │
   ▼     ▼                    ▼                         ▼                                ▼
[Routes  [Record]        [Profile]              (recent activity card)            (live-now card)
 tab]      │                  │                         │                                │
   │       ▼                  ▼                         ▼                                ▼
   │   /record ──▶ /record/summary ──▶ /activities/:id  /settings              /routes/:id/live
   │   (active tracking)  (post-run save)  (activity detail)
   ▼
/routes (List / Explore)
   │
   ├──▶ /routes/new (Create Route) ──(save)──▶ /routes/:id
   │
   └──▶ /routes/:id (Route Detail)
            │
            ├──▶ /routes/:id/members      (Invite / Manage Members)
            ├──▶ /routes/:id/leaderboard  (Route Leaderboard)
            ├──▶ /routes/:id/live         (Live Tracking / Spectate)
            └──▶ /record?routeId=:id       (start a run on this route)
                     │
                     ▼
             /record/summary ──▶ /activities/:id
                                      │
                                      └──▶ /routes/:id/leaderboard (view best-effort rank)
```

Notes on transitions:
- **/login** and **/onboarding/permissions** are gates outside the tab shell; once cleared they are not part of normal back-stack navigation.
- **/record** and **/routes/:id/live** are **full-screen** (bottom nav hidden) to maximize map area and prevent accidental taps while moving; they expose their own explicit exit/stop controls.
- **/record/summary** is a one-way post-run step: saving advances to **/activities/:id**; discarding returns to Home.
- **/settings** is reached from **/profile** (and from inline "fix this" links on permission/connectivity errors).

## Global Patterns

These cross-cutting rules apply to every page unless a page section overrides them explicitly.

- **Bottom navigation.** A 4-tab bar (Home, Routes, Record, Profile) is the persistent root navigation when authenticated. The center **Record** tab is the emphasized primary action. The bar is **hidden on full-screen flows** (`/record`, `/routes/:id/live`) and on pre-auth gates (`/login`, `/onboarding/permissions`). Each tab preserves its own back-stack; tapping the active tab again scrolls to top / resets to the tab root.

- **Location permission prompts.** Location is requested **just-in-time with rationale**, never silently on app open. The OS prompt is always preceded by an in-app explanation (see `/onboarding/permissions`). Pages that need location (`/routes/new` snap-to-road preview, `/record`, `/routes/:id/live`) check permission state and, if not granted, show an inline rationale + "Enable location" action that re-triggers the prompt or deep-links to OS settings if previously denied. *PWA-now:* only foreground/"while using" precision is available. *Capacitor-later:* background/"always" permission is additionally requested to enable screen-off tracking.

- **GPS & connectivity status indicators.** A consistent status affordance communicates: **GPS fix quality** (acquiring / weak / good — based on accuracy radius), **network online/offline**, and **live-sync state** (connected / reconnecting / throttled) on real-time screens. These appear as compact, non-blocking indicators; tapping one reveals a short explanation and any remedial action. During recording, GPS-fix quality is always visible.

- **Loading states.** Use skeleton placeholders for content-bearing screens (lists, detail, leaderboards) rather than full-screen spinners; map tiles show a neutral loading surface until tiles arrive. Actions in flight (save route, save activity, send invite) show inline progress on the triggering control and disable double-submit.

- **Empty states.** Every list/collection screen defines a purposeful empty state with a one-line explanation and a primary next action (e.g., Routes empty → "Create your first route"; Activities empty → "Record your first run"; Leaderboard empty → "Be the first to set a time").

- **Error states.** Errors are surfaced close to their cause and are **recoverable**: inline retry for failed loads, non-destructive toasts for transient failures, and explicit reconnect messaging for lost live/GPS connections. Network actions queue or fail gracefully; an in-progress run is **never lost to a failed network call** (data is held locally and retried — see recording offline behavior). Permission-denied errors link directly to the fix (in-app rationale or OS settings).

- **Offline behavior.** The app is a PWA with an offline shell: previously loaded screens and the active recording flow remain usable without network. **Recording continues fully offline** — track points buffer locally and upload/merge when connectivity returns. Write actions that require the server (save route, send invite, post results) are clearly disabled or queued offline, with a visible "will sync when online" indication rather than silent failure.

- **Foreground-recording (keep-screen-on) banner.** While a run is recording in the PWA, a persistent banner/indicator communicates that **tracking is foreground-only**: a **Screen Wake Lock** keeps the screen on, and **leaving the app or letting the screen turn off will pause/degrade tracking**. This banner is a PWA-now constraint and is **suppressed in the Capacitor build**, where an Android foreground service provides reliable screen-off background tracking. If the wake lock is lost (e.g., OS reclaim, tab backgrounded), the banner escalates to a warning and the recording state reflects the interruption.

- **Units.** A single user-level units preference (**metric / imperial**, set in `/settings`) governs all distance, pace, speed, and elevation displays app-wide. Distance is km/mi, pace is min/km or min/mi, elevation is m/ft. Time is shown as elapsed duration (h:mm:ss). The preference is read globally so all pages render consistently; default follows device locale on first run.

---

## Page Index

1. [Launch & Authentication](#launch-authentication) — `/login`
2. [Permissions Primer](#permissions-primer) — `/onboarding/permissions`
3. [Home / Dashboard](#home-dashboard) — `/`
4. [Routes List / Explore](#routes-list-explore) — `/routes`
5. [Create Route](#create-route) — `/routes/new`
6. [Route Detail](#route-detail) — `/routes/:id`
7. [Invite / Manage Members](#invite-manage-members) — `/routes/:id/members`
8. [Route Leaderboard](#route-leaderboard) — `/routes/:id/leaderboard`
9. [Record Run (Active Tracking)](#record-run-active-tracking) — `/record`
10. [Live Tracking / Spectate](#live-tracking-spectate) — `/routes/:id/live`
11. [Activity Summary (Post-Run Save)](#activity-summary-post-run-save) — `/record/summary`
12. [Activity Detail](#activity-detail) — `/activities/:id`
13. [Profile](#profile) — `/profile`
14. [Settings](#settings) — `/settings`


---

## Launch & Authentication

**Route:** `/login`

First screen an unauthenticated user reaches: a brief splash/brand moment that resolves into a sign-in / sign-up surface. It establishes a Firebase Auth session (email/password + Google) so every downstream call to the NestJS backend can carry a verified Firebase ID token, and it triggers the backend User upsert (Postgres User.id = Firebase uid) on first authenticated request.

**Primary actions**

- Sign in (email + password)
- Create account (sign-up mode)
- Continue with Google
- Forgot password?
- Toggle between Sign in / Create account
- Show/hide password

**Functional requirements**

- Splash gate on app open: while the AuthService restores any persisted Firebase session (onAuthStateChanged first emission), show a branded splash with a spinner. This is a determinate gate, not a timer -- proceed only when auth state is known. If a valid session exists, skip the form entirely and redirect to the post-login landing route (e.g. /routes or dashboard); never flash the login form to an already-signed-in user.
- Email + password SIGN IN: email field (type=email, inputmode=email, autocomplete=username/email, autocapitalize=off, autocorrect=off) and password field (autocomplete=current-password) with a show/hide password toggle reachable by thumb. Primary 'Sign in' button submits via the AuthService.signInWithEmail adapter.
- Email + password SIGN UP: toggle/segmented control or a 'Create account' link that switches the same surface into sign-up mode (password autocomplete=new-password, optional confirm-password field, optional display name). Calls AuthService.signUpWithEmail; on success the user is signed in immediately (no separate verification gate required for the PoC, but see email-verification note).
- Continue with Google: a 'Continue with Google' button using AuthService.signInWithGoogle. PWA-now uses Firebase web signInWithPopup with redirect fallback (popup blocked / in-app browser) -- on redirect, the splash must re-detect the returning session via getRedirectResult before showing the form. Document that the Capacitor build will swap this for native Google sign-in behind the same adapter.
- Forgot password: a 'Forgot password?' affordance that, given the entered email, calls a reset flow (Firebase sendPasswordResetEmail) and shows a confirmation toast ('If an account exists, a reset link was sent'). Does not reveal whether the email is registered.
- Single-flight submission: disable the submit button and show an inline button spinner while a request is in flight; prevent double-submit on rapid taps. Re-enable on completion or error.
- Client-side validation BEFORE hitting Firebase: non-empty + valid email format, non-empty password, password min length (6, Firebase minimum), and confirm-password match in sign-up mode. Show inline per-field error text; keep the keyboard from covering the focused field.
- Map Firebase auth error codes to friendly messages: auth/invalid-email, auth/user-not-found + auth/wrong-password (collapse to a single 'Email or password is incorrect' to avoid user enumeration), auth/email-already-in-use (offer to switch to sign-in), auth/weak-password, auth/too-many-requests (rate-limited, suggest retry later or reset), auth/popup-closed-by-user / auth/cancelled-popup-request (silent, no error toast), auth/account-exists-with-different-credential (explain the email is registered with a different provider).
- On successful authentication: obtain the Firebase ID token, ensure it is available to the API layer's prepareHeaders (Authorization: Bearer <idToken>), then navigate to the post-login landing route. The first authenticated backend request triggers the server-side User upsert; the page itself does not need to call a profile endpoint, but must not navigate before a token is retrievable.
- Token lifecycle awareness: the AuthService must register a token refresh listener (Firebase auto-refreshes ID tokens ~hourly) so the API layer always reads a fresh token; the login page sets this up on session establishment. No silent 401 loop on stale tokens.
- Offline handling: if the device is offline when the user submits, detect navigator.onLine === false (or a network-failure auth error) and show 'You appear to be offline -- check your connection' rather than a generic failure. Buttons return to enabled.
- Network/Firebase reachability error: distinguish transient network errors (auth/network-request-failed) from credential errors and offer a 'Retry' action.
- Persisted-session sign-in failure / token revoked: if a restored session is invalid (revoked, disabled account), clear it and fall back to the form with an explanatory message instead of a redirect loop.
- Terms / privacy: show a short 'By continuing you agree to Terms & Privacy' line with tappable links (PoC can link to placeholders) beneath the primary auth actions.
- Do NOT request location, notification, motion, or any device permission on this page. Auth must complete with zero device-capability prompts; all GPS/wake-lock/notification permission prompts belong to the recording and live-tracking pages later in the flow.
- Accessibility & one-handed use: primary CTAs and the Google button sit in the lower/thumb-reachable third of the screen; inputs are above them; form is operable with the on-screen keyboard's 'Go'/'Done' action submitting the active mode.
- Sign-up duplicate-account recovery: if sign-up returns email-already-in-use, present a one-tap path to switch into sign-in mode with the email pre-filled.

**Data displayed**

- App brand/logo and name on the splash and at the top of the auth surface
- Email input
- Password input (with show/hide toggle)
- Confirm-password and optional display-name inputs (sign-up mode only)
- Mode toggle between Sign in and Create account
- 'Continue with Google' provider button
- 'Forgot password?' link
- Inline per-field validation errors and a top-level/aria-live error banner for auth failures
- Loading indicators: full-screen splash spinner (session restore) and in-button spinner (submission)
- Terms & Privacy links
- Optional: offline/connection-status notice when applicable

**Mobile interactions**

- Splash auto-resolves to the form or to the app once auth state is determined -- no user tap required to leave the splash
- Tapping an input raises the OS keyboard; the layout scrolls/pads so the focused field and the submit button stay visible above the keyboard
- Keyboard 'Go'/'Done' action submits the currently active mode
- Show/hide password is a thumb-reachable toggle inside the password field
- Primary CTAs anchored in the lower third for one-handed reach; Google button adjacent
- Google sign-in opens a popup (PWA); on popup block it falls back to a full-page redirect and returns to /login
- In-flight submit disables buttons and shows an inline spinner; tapping again is a no-op
- Error banner is announced via aria-live; dismissible by retrying or editing a field
- Switching to sign-up animates/reveals confirm-password and display-name fields in the same surface (no full route change)

**States**

- _empty:_ Default unauthenticated form with empty fields in Sign in mode; no prior input.
- _loading:_ Splash spinner during Firebase session restore (onAuthStateChanged / getRedirectResult); in-button spinner during email or Google submission.
- _error:_ Inline field errors for validation; top aria-live banner for auth failures with friendly, de-enumerated messages and a Retry action for network errors.
- _offline:_ Detected via navigator.onLine/auth network error -> 'You appear to be offline' banner, submit disabled-then-re-enabled; Google sign-in suppressed or shows the same notice. No auth call is attempted while clearly offline.
- _permissionDenied:_ Not applicable -- this page requests no device permissions. (A revoked/disabled Firebase account on session restore is treated as an auth error: clear session, return to form with explanation, no redirect loop.)

**Permissions / services**

- Firebase Auth (email/password + Google provider) -- web SDK in the PWA
- Firebase ID token issuance + auto-refresh, consumed by the API layer's Authorization header (prepareHeaders)
- Network connectivity to Firebase and (post-login, first request) the NestJS backend for the User upsert
- AuthService adapter interface (web implementation now; Capacitor native implementation later)
- No location, notification, wake-lock, or media permissions on this page

**PWA-now / Capacitor-later**

PWA-now: all auth runs through the Firebase WEB SDK behind the AuthService adapter. Google sign-in uses signInWithPopup with a signInWithRedirect fallback (popups are unreliable in mobile/in-app browsers), so the splash must handle getRedirectResult on the return leg. Session persistence relies on browser local persistence (IndexedDB/localStorage); a user clearing site data is logged out. Capacitor-later: swap the same AuthService methods for native Google sign-in (Capacitor Firebase Authentication plugin) and native token storage -- no callsite changes outside the adapter, no popup/redirect dance. This page intentionally provisions NO device capabilities; LocationTracker/PushService/wake-lock adapters are introduced on recording and live-tracking pages, so the PWA-vs-Capacitor behavioral split here is limited to the Google sign-in mechanism and token storage, not GPS/background concerns.

**Out of scope (deferred)**

- FCM push registration / notification permission (deferred to Capacitor phase)
- Native Google sign-in via Capacitor Firebase Authentication plugin (later)
- Email-verification gate and verified-email enforcement (PoC signs the user in directly; can be added later)
- Additional auth providers (Apple, phone/OTP, magic links)
- Multi-factor authentication
- Biometric / device-credential unlock (Capacitor phase)
- Account linking UI for account-exists-with-different-credential beyond a basic explanatory message
- Any location/GPS, wake-lock, or background-tracking concerns -- handled on recording/live pages, not here

**Navigation**

- _Entry:_ Cold app launch / PWA open when no valid Firebase session exists (default unauthenticated entry); Redirect from any auth-guarded route when the session is missing or expired (deep-link bounce, e.g. opening an invite link while logged out -> /login then back); Explicit sign-out from Profile/Settings returns the user here; Return leg of a Google sign-in redirect (getRedirectResult resolves on this route)
- _Exits:_ Post-login landing route on success (dashboard / routes list); Back to the originally-requested deep link after auth, if one was captured before bouncing to /login; Password-reset confirmation stays on /login (toast), no navigation away



---

## Permissions Primer

**Route:** `/onboarding/permissions`

A one-time onboarding interstitial that explains in plain language why the app needs location access (and, in the Capacitor phase, notifications) before the user ever hits a raw OS/browser permission dialog, then triggers the request and routes the user onward based on the outcome. It exists to raise grant rates and to prevent the user from accidentally hard-denying a permission they don't yet understand.

**Primary actions**

- 'Enable location' primary CTA (triggers the LocationTracker permission request via user gesture)
- 'Not now' / 'Skip for now' secondary action (records seen, proceeds in degraded mode)
- 'Try again' (re-trigger request after a soft denial)
- 'Re-check' / 'I've enabled it' (re-query permission state in the blocked variant and auto-advance if granted)
- 'Continue without location' (explicitly enter app degraded)
- (Capacitor phase) 'Enable notifications' / 'Maybe later' on the optional second card
- 'View privacy details' link

**Functional requirements**

- Show a single, scrollable, thumb-reachable primer screen that explains WHY location is needed: 'to record your runs, show you on the map, draw routes by your position, and place you live next to other runners.' Keep copy benefit-led, not technical.
- Render a primary CTA pinned to the bottom of the viewport within thumb reach (e.g. 'Enable location') and a secondary, lower-emphasis 'Not now' / 'Skip for now' control. The primary CTA is the only element that triggers the OS/browser geolocation prompt.
- On primary CTA tap, call the LocationTracker adapter's permission-request method (web: navigator.permissions query + navigator.geolocation.getCurrentPosition to trigger the browser prompt; Capacitor-later: native foreground location request). Never call getCurrentPosition/the prompt automatically on mount — the prompt must be user-gesture-initiated so the browser actually shows it and so a one-shot denial isn't wasted.
- Before showing this primer, the page must check the current permission state via the Permissions API (navigator.permissions.query({name:'geolocation'})). If state is already 'granted', skip the primer entirely and forward to the post-onboarding destination without flashing the screen. If 'prompt', show the primer. If 'denied', show the recovery/blocked variant (see below) instead of the normal CTA.
- Handle the GRANTED outcome: persist a flag (e.g. permissionsPrimerSeen + locationGranted) to local storage / app state, then navigate to the next onboarding step or the intended deep-link/return target (default: the map/home tab). Do not show this page again on subsequent launches.
- Handle the DENIED outcome (user dismissed or pressed Deny in the OS/browser prompt): do NOT trap the user. Show inline messaging that the app still works for browsing/route viewing but cannot record runs or show live position, keep a 'Try again' affordance, and allow 'Continue without location' to proceed in a degraded mode. Record that the primer was seen so it isn't force-shown repeatedly.
- Handle the BLOCKED / hard-denied state (Permissions API returns 'denied', or repeated browser denial where the prompt will no longer appear): replace the in-app request CTA with OS/browser-specific recovery instructions, because the app can no longer surface a prompt. For PWA on Android Chrome, show steps to re-enable via the site settings (lock icon / Site settings > Permissions > Location). Provide a 'Re-check' button that re-queries permission state and advances automatically if it flips to granted (e.g. after the user changes it in another tab/settings and returns).
- Subscribe to Permissions API change events (permissionStatus.onchange) while on the page so that if the user grants/blocks from browser UI without an in-app action, the page updates its state live and can auto-advance on grant.
- Support an explicit 'Skip / Not now' path that records the primer as seen, leaves location ungranted, and routes the user into the app. Downstream recording/live pages are responsible for re-prompting at point-of-use; this page only does the upfront ask.
- Be resilient when the Permissions API is unavailable (older WebViews/browsers that don't support navigator.permissions): fall back to feature-detecting navigator.geolocation, and treat the request optimistically — tapping the CTA calls getCurrentPosition and branches on success vs the PERMISSION_DENIED error code rather than on a queried state.
- Handle the case where geolocation is entirely unsupported (no navigator.geolocation, or insecure context / non-HTTPS where the API is disabled): show a clear 'Location isn't available in this browser' message, explain a secure (HTTPS) context is required, and allow continuing in degraded mode. PWA must be served over HTTPS for geolocation to work at all — surface this if detected on http.
- Time-box the active request: if getCurrentPosition neither resolves nor rejects within a reasonable window (e.g. the user left the prompt open or the GPS is acquiring), keep the CTA in a non-blocking 'Requesting…' state, allow cancel, and do not freeze the UI. A POSITION_UNAVAILABLE or TIMEOUT error (codes 2/3) must be treated as 'granted-but-no-fix-yet' (permission was likely allowed) rather than 'denied' (code 1) — only code 1 means denied.
- Be idempotent / safe to re-enter: navigating back to /onboarding/permissions after a grant should immediately forward out; the page must read persisted state on mount and not double-prompt.
- For the Capacitor phase only, optionally chain a SECOND primer card for notification (FCM/push) permission AFTER location is resolved — explaining notifications are for activity/leaderboard/live-invite alerts. In the PWA-now phase this notification card is hidden/absent (push is out of scope until Capacitor). The notification ask must be deferrable and never block entering the app.
- Provide a privacy reassurance line (e.g. 'Your location is only used while you're recording or viewing live tracking; we don't track you in the background') and a link to a privacy/details view, since the locked PWA build is foreground-only tracking.
- Ensure all branching is logged to app state so analytics/QA can see grant vs deny vs skip vs blocked outcomes (no PII).

**Data displayed**

- Headline + benefit-led explanation of why location is needed (record runs, live map position, route drawing, leaderboards).
- Bulleted/iconed list of concrete uses of location within the app.
- Current permission state indicator implied by which variant is shown (initial ask vs denied retry vs blocked-recovery).
- Privacy reassurance line: foreground-only, no background tracking in the PWA build.
- OS/browser-specific re-enable instructions text (only in the blocked variant).
- (Capacitor phase only) Notification permission rationale copy on the second card.
- Link/affordance to a fuller privacy details view.

**Mobile interactions**

- Single-screen, vertically scrollable if content exceeds viewport; primary CTA pinned to a bottom action bar within thumb reach for one-handed use.
- Tapping the primary CTA is the user gesture that opens the native OS/browser geolocation dialog (rendered by the platform, not the app) — the page shows a non-blocking 'Requesting…' state behind it.
- Secondary actions ('Not now', privacy link) placed lower-emphasis and reachable without stretching to the top of the screen.
- On returning to the tab/foreground (visibilitychange / focus), re-query permission state so a change made in browser settings is reflected without a manual refresh; auto-advance if it became granted.
- Live reaction to permissionStatus.onchange events while the page is open.
- No swipe-to-dismiss that could strand the user without recording a decision; leaving requires an explicit action that sets permissionsPrimerSeen.
- (Capacitor phase) Notification card presented as a follow-on step or bottom sheet after location resolves, also deferrable with one tap.

**States**

- _empty:_ Not applicable — this page has no list/data content; the 'empty' equivalent is the default first-ask variant shown when permission state is 'prompt'.
- _loading:_ Brief state on mount while querying navigator.permissions for current geolocation state; resolves quickly and either auto-forwards (already granted) or renders the appropriate primer variant. Avoid a visible flash if state is already granted.
- _error:_ If the permission request throws or getCurrentPosition errors with a non-denial code (POSITION_UNAVAILABLE=2, TIMEOUT=3), treat as permission-likely-granted-but-no-fix; show a soft 'Couldn't get a location fix yet, but you're set up — we'll try again when you record' message and allow proceeding. Genuine adapter/runtime errors show a retryable inline error, never a dead end.
- _offline:_ Permission request itself does not require network (it's a device capability), so the primer still functions offline; show the request normally. Any privacy-details link or analytics that needs network degrades gracefully. Note for the user that map tiles/routing need connectivity later, but that does not block granting location here.
- _permissionDenied:_ Denied variant: explain what won't work (recording, live position) without trapping the user, offer 'Try again' (if the browser will still prompt) and 'Continue without location'. Blocked variant (Permissions API reports 'denied' / prompt suppressed): hide the in-app request, show OS/browser-specific re-enable steps and a 'Re-check' button that re-queries state and auto-advances on flip to granted.

**Permissions / services**

- Geolocation permission — requested via the LocationTracker adapter (web: navigator.geolocation + navigator.permissions; Capacitor-later: native foreground location). This is the page's whole reason for existing.
- Notification/push permission — only in the Capacitor phase via the PushService adapter (FCM). Out of scope / hidden in the PWA-now build.
- AuthService — the user must already be authenticated (Firebase Auth) before reaching this onboarding step; not requested here.
- Local storage / persisted app state (redux-persist) — to record permissionsPrimerSeen and the resolved outcome so the page is shown only once.
- Secure context (HTTPS) — required by the browser for geolocation; the PWA must be served over HTTPS. No backend, RTDB, or routing API calls are made from this page.

**PWA-now / Capacitor-later**

"PWA NOW: this page requests only FOREGROUND geolocation via the web LocationTracker adapter (navigator.geolocation + navigator.permissions). There is NO background-location ask because PWA tracking is foreground-only (Screen Wake Lock keeps the screen on while recording); true screen-off background GPS does not exist yet, so do not promise it in the primer copy. The notification/push card is absent in the PWA build (push is deferred to Capacitor). The browser, not the app, renders the actual permission dialog, and the prompt must be user-gesture-triggered. CAPACITOR LATER: the same page swaps in native adapter implementations — the LocationTracker requests native foreground (and, when the Android foreground service + background GPS land, can additionally explain/request 'while using' vs 'always' location), and the PushService adds the FCM notification primer card as a second step. The adapter boundary (LocationTracker, PushService) means the primer's UI/flow stays the same across both phases; only the underlying request implementation and the presence of the notification card change. Copy should be written so the location rationale holds in both phases, with the background-GPS and notification messaging gated to the Capacitor build."


**Out of scope (deferred)**

- Background / screen-off GPS permission ('always allow' location) and any Android foreground-service messaging — deferred until the Capacitor shell; the PWA primer is foreground-only.
- Notification / FCM push permission card — deferred to the Capacitor phase; hidden in the PWA-now build (push is out of scope now).
- Media/camera/photo permissions for activity sharing (R2 media) — not requested in this onboarding step.
- Per-feature granular re-prompts at point of use (Record, Live Tracking) — those pages own their own inline re-asks; this page is only the upfront primer.
- 3D/animated replay, LLM route suggestions, and auto loop-by-distance generation — unrelated future-phase features.
- Deep OS-settings deep-linking (programmatically opening Android app settings) — only available in the Capacitor native phase; the PWA blocked variant shows manual instructions instead.

**Navigation**

- _Entry:_ First-run onboarding flow, shown after auth/sign-in (AuthService) and before the user reaches the map/home tab, when permissionsPrimerSeen is false and geolocation isn't already granted; Deep-link / programmatic redirect from a point-of-use page (e.g. Record or Live Tracking) that needs location but finds it ungranted — though those pages may also prompt inline; Re-entry from browser back navigation (handled idempotently: auto-forwards if already granted)
- _Exits:_ Forward to the next onboarding step or the intended return target (default map/home tab) on grant, skip, or continue-degraded; Auto-forward out immediately on mount if permission already granted; (Capacitor phase) Forward from the location card to the optional notification card, then onward



---

## Home / Dashboard

**Route:** `/`

Entry hub for an authenticated user: a prominent Record CTA plus quick scannable lists of recent activities, my routes, and invited routes, each linking deeper into the app.

**Primary actions**

- Record (primary CTA) -> /record
- Tap an activity row -> /activity/:id
- See all activities -> activity history/feed
- Tap a route row -> route detail
- Create route -> route creation page
- Accept invite (inline)
- Decline invite (inline)
- Tap avatar -> /profile
- Pull-to-refresh

**Functional requirements**

- Render only for an authenticated Firebase user. If no valid Firebase session, redirect to the sign-in route (the page never renders its hub content for a signed-out user).
- On first authenticated load, trigger the backend User upsert flow implicitly (the Firebase ID token is attached to all API calls; the NestJS guard mirrors the uid into Postgres User on first request). The page itself does not need a dedicated upsert button — it just must function correctly the very first time a brand-new user with zero activities/routes lands here.
- Show a greeting/header with the athlete's displayName (fallback to email local-part if displayName is null) and their avatar (photoUrl from Google or R2; fallback to initials avatar). Avatar is a tap target that navigates to /profile.
- Display a primary, persistently-visible, thumb-reachable 'Record' CTA (large button near the bottom of the screen / above the bottom nav). Tapping it navigates to the Record page (/record). This is the single most prominent action on the page.
- Before navigating from the Record CTA, do NOT block on permissions here — defer the geolocation permission prompt to the Record page. The Home page should not request location. (It may optionally show a subtle hint badge on the CTA if location permission is already known-denied, but must not gate the tap.)
- Show a lifetime/summary stats strip computed from the user's saved activities: total distance (km), total active time (h m), and total activity count. These are derived client-side from the merged activity list (server + any locally-saved-not-yet-synced activities) and must update reactively when sync completes or a new activity is saved.
- Recent Activities section: list the most recent N (e.g. 5) saved activities, newest first, each row showing title, type (RUN/JOG/WALK), date, distance (km), duration, and avg pace; tapping a row navigates to /activity/:id. Include a 'See all' affordance navigating to the full activity history/feed.
- My Routes section: list routes the user owns (Route.ownerId == uid), each row showing name, distance (km), elevation gain, and a member/invite count badge; tapping a row navigates to that route's detail page. Include a 'Create route' affordance that navigates to the route-creation page.
- Invited Routes section: list RouteMembership rows where userId == uid and status == INVITED, showing route name, owner displayName, and route distance. Each row exposes inline Accept and Decline actions.
- Accept invite: optimistically move the route from Invited to My Routes (or a 'Joined routes' grouping) and call the membership-accept endpoint (sets status JOINED). On failure, revert the optimistic change and show an inline error/toast with retry. Decline invite: optimistically remove the row and call the decline endpoint (status DECLINED); on failure, restore the row and show retry.
- Pull-to-refresh at the top of the scroll view re-fetches activities, my routes, and invited routes (re-runs the underlying queries / refetch). Show a refreshing indicator during the fetch.
- Offline-first behavior: the page must render from cached/local data when the network is unavailable. Recent activities must include locally-saved activities that have not yet synced to the backend (merge local + server, dedupe by activity id), consistent with the existing merge + background-sync pattern. Show a non-blocking offline banner when offline.
- Background sync awareness: if there are locally-saved activities not yet on the server, surface a subtle 'syncing' / 'N unsynced' indicator; do not block the UI. Sync retries on regaining foreground/connectivity (existing useSyncActivitiesWithServer behavior). Once synced, the indicator clears and counts reconcile (no duplicate rows).
- Handle the brand-new / empty user: when the user has zero activities, show an empty state in Recent Activities prompting them to record their first run (a secondary CTA that also routes to /record). When they own zero routes, show an empty state in My Routes prompting them to create a route. When there are no pending invites, hide the Invited Routes section entirely (or render nothing — do not show an empty placeholder for invites).
- Loading states: while the initial activity/route/invite queries are in flight (and no cached data exists), show skeleton placeholders for each section rather than a full-page spinner, so the Record CTA and header remain interactive immediately.
- Error states: if a section's fetch fails and there is no cached data, show a per-section inline error with a 'Retry' button that refetches only that section; a failure in one section must not blank out the others or hide the Record CTA.
- Auth/token expiry: if an API call returns 401 (expired/invalid Firebase token), attempt a silent token refresh via the AuthService adapter and retry once; if refresh fails, route to sign-in. The page must not show stale authenticated content after a hard auth failure.
- Each list section must be capped/preview-only on this page (recent N activities, owned routes preview) with explicit navigation to fuller list pages, to keep the dashboard scannable and fast on mobile.
- Numbers must be formatted for locale/units consistently (distance in km to 1 decimal, pace mm:ss /km, duration as h m / m s) and degrade gracefully when a value is null (e.g. elevation gain null shows '—').

**Data displayed**

- Athlete displayName (or email local-part fallback) and avatar (photoUrl / initials)
- Lifetime summary: total distance (km), total active time (h m), total activity count
- Recent activities (preview list): title, type (RUN/JOG/WALK), startedAt/date, distanceM (km), durationS, avgPaceSPerKm
- My routes (owned): name, distanceM (km), elevationGainM, member/invite count
- Invited routes: route name, owner displayName, route distanceM, invite status (INVITED)
- Sync/offline indicators: unsynced activity count, offline banner
- Empty-state prompts for no activities / no routes

**Mobile interactions**

- Vertical scroll of stacked sections; primary Record CTA pinned within thumb reach near the bottom (above the bottom tab/nav bar).
- Pull-to-refresh gesture at top of the scroll container re-fetches all sections with a refreshing spinner.
- Tap targets sized for one-handed use; entire activity/route rows are tappable (not just a small chevron).
- Inline Accept/Decline on invite rows are adjacent thumb-reachable buttons; Decline may require a quick confirm to avoid accidental dismissal, Accept is single-tap.
- Horizontal scroll is acceptable for compact summary stat chips or route cards if used, but core lists scroll vertically.
- Optimistic UI on invite accept/decline with toast + undo/retry on failure; toasts appear bottom-center, clear of the nav bar.
- Skeleton shimmer placeholders during initial load so layout doesn't jump.
- No map gestures on this page (no embedded interactive map required for the dashboard).

**States**

- _empty:_ Zero activities -> Recent Activities shows a 'record your first run' prompt; zero owned routes -> My Routes shows a 'create a route' prompt; zero invites -> Invited Routes section is hidden.
- _loading:_ Header and Record CTA render immediately; each data section shows skeleton placeholders while its initial query is in flight and no cache exists.
- _error:_ Per-section inline error with Retry; one section failing does not blank the page or hide the Record CTA. Hard auth failure routes to sign-in.
- _offline:_ Renders from cached + locally-saved data (merged activities); non-blocking offline banner shown; refresh and invite actions queue/fail gracefully with retry.
- _permissionDenied:_ Location is NOT requested on this page; if location is known-denied the Record CTA may show a subtle hint but remains tappable (the prompt/handling happens on /record).

**Permissions / services**

- Firebase Auth (session + ID token via AuthService adapter; silent refresh on 401)
- Backend REST API (NestJS, Firebase-guarded) for activities, routes, memberships — via PointUploader/API layer
- Network connectivity detection (online/offline)
- Local persistence (cached activities/routes + unsynced activities) for offline-first rendering
- Cloudflare R2 / Google avatar URL for profile photo
- No Geolocation permission used on this page (deferred to Record page)

**PWA-now / Capacitor-later**

"This page does no GPS recording, so the PWA-now vs Capacitor-later split barely affects it. PWA now: launched from the browser/installed PWA icon; auth session and token refresh go through the web AuthService adapter; offline rendering relies on the service worker cache + local store; background sync of unsynced activities runs only while the PWA is in the foreground/visible. Capacitor later: same screen, but auth/token refresh swap to the native AuthService implementation, and true background sync (and any FCM-driven invite notifications that could refresh the Invited Routes list) become possible via the native shell. The Record CTA's downstream behavior changes (foreground-only Screen Wake Lock recording now vs background Android foreground-service recording later), but that lives on /record, not here; this page only routes to it."

**Out of scope (deferred)**

- 3D / animated activity replay (future phase)
- LLM natural-language route suggestions on the dashboard (future phase)
- Auto loop-by-distance route generation (future phase)
- FCM push notifications for new invites refreshing this list (arrives with Capacitor + FCM; now invites surface only on fetch/refresh)
- Public route discovery / global feed beyond the user's own + invited routes
- Live-tracking widgets or in-progress run resumption banners on the dashboard (live tracking lives on Record/Live pages)
- True screen-off background GPS or background sync (until Capacitor shell)

**Navigation**

- _Entry:_ App launch / default route after successful sign-in (Firebase Auth); Bottom navigation 'Home/Dashboard' tab; Back navigation from Record, Route detail, Route creation, Activity detail, or Profile; Deep link / PWA app icon launch to /
- _Exits:_ /record (Record CTA and empty-state 'record first run'); /activity/:id (tap a recent activity); Route detail page (tap an owned or accepted route); Route creation page ('Create route'); /profile (avatar tap); Activity history/feed ('See all'); Sign-in route (on auth failure / token refresh failure)



---

## Routes List / Explore

**Route:** `/routes`

The home hub for a signed-in user's planned routes: browse routes they own and routes they were invited to or joined, triage pending invites, and jump off to create a new route or open one to view/record/see its leaderboard. It is a list/triage screen, not a map-drawing screen.

**Primary actions**

- Create route (FAB / primary button) -> /routes/new
- Open a route -> /routes/:id
- Accept invitation (inline)
- Decline invitation (inline)
- Search / filter routes by name
- Sort routes (Recently updated / Name / Distance)
- Toggle Mine / Shared / All
- Pull-to-refresh
- Per-card overflow menu: Rename / Invite / Delete (owner) or Leave (member)

**Functional requirements**

- Load and display two logical groups on entry: (a) 'My Routes' (routes where the signed-in User.id is Route.ownerId) and (b) 'Shared with me' (routes where a RouteMembership exists for this user with status JOINED). Pending invites (status INVITED) surface separately at the top (see invites requirement).
- Fetch list data from the backend (GET /routes, scoped server-side to the authenticated Firebase uid via the NestJS guard); never trust a client-supplied user id. The request carries the Firebase ID token; a 401 routes the user to sign-in.
- Render each route as a tappable card showing at minimum: name, distance (km, converted from Route.distanceM), elevation gain (m, from Route.elevationGainM when present), owner display name/avatar (from User), member count, my-membership/ownership badge (Owner / Member / Invited), and a small static route-shape thumbnail (rendered from Route.path; see Maps note — may be a lightweight static preview rather than a full interactive map per card to save tiles/memory).
- Tapping a route card navigates to that route's detail page (/routes/:id) which is the launch point for view-on-map, start-recording-on-route, invite, and leaderboard. This list page itself does not draw or edit geometry.
- Primary action: a thumb-reachable 'Create route' control (FAB bottom-right or a button in a bottom bar) that navigates to the route-creation/draw page (/routes/new). This is always visible even when the list is empty.
- Show pending invites prominently (status INVITED for this user): an 'Invitations' section or banner listing each inviting route with the inviter's name, with inline Accept and Decline actions. Accept issues PATCH to set RouteMembership.status = JOINED and moves the route into 'Shared with me'; Decline sets status = DECLINED and removes it from the list. Both actions optimistically update the UI and roll back on failure with a toast.
- Support pull-to-refresh to re-fetch the lists; show a refreshing indicator without blocking existing content.
- Provide client-side search/filter by route name (debounced text input) and a segment toggle/filter for 'Mine' vs 'Shared' vs 'All'; filtering operates on the already-loaded set and does not require a round-trip for the PoC.
- Provide a sort control (e.g., Recently updated [Route.updatedAt] default, Name A–Z, Distance). Sort is client-side over the loaded set.
- Each card exposes a lightweight overflow/long-press menu with context actions: for owned routes — Rename, Invite (deep-link to invite flow), Delete; for shared routes — Leave route (delete my RouteMembership). Destructive actions (Delete route, Leave route) require a confirmation sheet. Deleting a route cascades server-side (waypoints, segment, memberships) per the data model; the card is removed optimistically.
- Handle the empty state for a brand-new user with no owned and no shared routes: show an explanatory empty card with a clear 'Create your first route' CTA pointing to /routes/new.
- Handle the 'no results' state when search/filter excludes everything but routes exist: show a 'No routes match' message with a clear-filter affordance, distinct from the true-empty state.
- Handle the loading state on first paint with skeleton cards (not a blank screen); subsequent navigations should show cached data immediately (stale-while-revalidate) then refresh.
- Handle fetch error (network down / 5xx): show an inline error state with a Retry button that re-issues the query; keep any previously cached list visible if available rather than wiping it.
- Reflect ownership/permission correctly: only owners see Delete/Rename/Invite; members never see destructive owner actions. The UI must derive these from the membership/ownership data, not assume.
- Show a count badge or subtle indicator when there are unseen pending invitations so the user notices them even after scrolling.
- Distinguish public routes (Route.isPublic) with a small badge where relevant, but the PoC list is scoped to the user's own + shared routes — public discovery/explore feed is out of scope for this page (see outOfScope).
- Be resilient to partial data: routes missing elevationGainM show distance only; routes whose Route.path failed to compute still render with name and a placeholder thumbnail.
- Restore scroll position and active filter/sort when returning to this page from a route detail or the create flow (preserve in-memory state).

**Data displayed**

- Route name
- Route distance (km, derived from Route.distanceM)
- Elevation gain (m, from Route.elevationGainM; hidden if null)
- Owner display name and avatar (User.displayName / User.photoUrl)
- Membership/ownership badge: Owner / Member / Invited
- Member count (count of RouteMembership with status JOINED, plus owner)
- Static route-shape thumbnail rendered from Route.path
- Public badge when Route.isPublic is true
- Route.updatedAt (used for 'Recently updated' sort; may show relative time on card)
- Pending invitations: inviting route name + inviter display name (RouteMembership.invitedById -> User)
- Unseen-invitations count indicator

**Mobile interactions**

- Thumb-reachable bottom-right FAB for Create route, kept clear of the bottom tab bar and safe-area inset
- Vertical scroll list of route cards optimized for one-handed scrolling
- Pull-to-refresh gesture at the top of the list
- Tap a card to open detail; long-press (or a top-right overflow icon on the card) opens a context bottom sheet with Rename/Invite/Delete or Leave
- Inline Accept/Decline buttons on invitation rows sized for thumb tapping; swipe-to-dismiss optional for declining an invite
- Confirmation bottom sheet for destructive actions (Delete route / Leave route) with a clearly separated destructive button
- Search input collapses/expands from a top control; sort and Mine/Shared/All filters presented as a compact chip row or a bottom-sheet filter panel reachable with the thumb
- Toasts/snackbars anchored above the tab bar for action success/failure and offline notices
- Static (non-interactive) route thumbnails so list scrolling never instantiates many live MapLibre GL instances

**States**

- _empty:_ No owned and no shared routes: friendly empty card with 'Create your first route' CTA to /routes/new. (Distinct 'no results' state shown when filters exclude all loaded routes, with a clear-filters action.)
- _loading:_ Skeleton route cards on first load; on revisit, show cached list immediately then silently revalidate (stale-while-revalidate).
- _error:_ Inline error banner with Retry that re-issues GET /routes; previously cached cards remain visible if present rather than blanking the screen.
- _offline:_ PWA: if the network is unavailable, show the last cached route list (read-only) with an offline indicator; Create-route, Accept/Decline invite, Rename, Delete, and Leave are disabled or queued with a 'You're offline' toast since they require the backend. No geometry is editable here so offline impact is limited to staleness.
- _permissionDenied:_ Not applicable for device permissions on this page (no GPS/location needed to browse routes). Authorization-denied (expired/invalid Firebase token) -> redirect to sign-in. A member attempting an owner-only action is prevented by the UI (controls not shown) and rejected server-side as a 403 fallback.

**Permissions / services**

- Network connectivity (required to fetch/mutate routes and memberships)
- AuthService adapter: Firebase Auth ID token attached to GET /routes and membership mutations; backend NestJS Firebase guard verifies the uid
- Backend REST API (NestJS + Prisma + PostGIS) for Route and RouteMembership reads/writes
- Map tiles (OpenFreeMap now) only if route thumbnails are rendered as live/static map previews; a precomputed static path thumbnail avoids per-card tile fetches
- No device location/GPS, camera, or wake-lock permissions are needed on this page

**PWA-now / Capacitor-later**

"This is a list/triage page with no GPS recording or live tracking, so the PWA-now vs Capacitor-later split is minimal. PWA now: data is fetched over the network via the AuthService/PointUploader-style REST adapters; offline browsing relies on the in-memory/RTK-Query cache (and optionally a service-worker cache) showing the last-loaded routes read-only. Capacitor later: the same REST + AuthService adapters are reused unchanged; the only additions are deep-link/notification entry (FCM) that can open this page focused on a pending invitation, and more robust offline persistence via native storage. No screen wake lock or foreground-service concerns apply here since nothing is being recorded."

**Out of scope (deferred)**

- Public route discovery / global Explore feed of routes from other users (the PoC /routes is scoped to owned + shared only; Route.isPublic exists in the model but browsing strangers' public routes is a future phase)
- Map-based explore (panning a map to find nearby routes) — out of scope for this list page
- 3D / animated route replay
- LLM natural-language route suggestions
- Auto loop-by-distance route generation
- Creating or drawing geometry on this page (handled by /routes/new)
- Leaderboard rendering (handled on route detail / leaderboard page)
- Live multi-user tracking (handled on the route detail / live page via Firebase RTDB)
- FCM push notifications for invites (arrives with the Capacitor shell)

**Navigation**

- _Entry:_ Bottom tab bar 'Routes' tab (Main group); Post-sign-in default landing for the Main group; Back navigation from /routes/:id (route detail); Back/cancel from /routes/new (create flow) returns here; Deep link / notification tap for a route invitation can land here with the invites section focused
- _Exits:_ Tap a route card -> /routes/:id (route detail: map view, start recording, invite, leaderboard); Create route FAB -> /routes/new (draw + snap-to-road creation flow); Invite context action -> invite flow for that route; 401/unauthenticated -> sign-in screen; Other bottom-tab destinations (e.g., Record, Activity feed, Profile)



---

## Create Route

**Route:** `/routes/new`

A map-centric editor where a user drafts a running route by tapping/dragging waypoints on the map, snaps the connecting path to real roads/trails via the routing API, reviews live distance and an elevation profile, then names and saves the route (which also auto-creates a full-route Segment for leaderboards).

**Primary actions**

- Tap map to add waypoint
- Drag waypoint / drag line to reshape
- Long-press leg or marker for insert/delete menu
- Toggle snap-to-road
- Undo / Redo / Clear
- Optional 'Out & back' helper
- Open 'Save route' sheet -> enter name (+ optional description, isPublic) -> Save
- Sign in (if unauthenticated, before save)
- Back / cancel (with unsaved-changes confirm)

**Functional requirements**

- MAP-FIRST CANVAS: The page opens to a full-screen MapLibre GL JS map (OpenFreeMap 'bright' style, no key) with a thin bottom sheet for route stats/actions, so the map remains the dominant one-handed surface.
- INITIAL CENTERING: On open, attempt to center on the user's current location via the LocationTracker adapter's one-shot getCurrentPosition (web Geolocation now; Capacitor Geolocation later). This is a convenience-only request, NOT continuous tracking; no Wake Lock is acquired on this page. If permission is denied, blocked, times out, or unavailable, fall back to the last-used map center or a sensible default region and still allow full route creation by panning/zooming.
- ADD WAYPOINT BY TAP: Tapping an empty spot on the map appends a new waypoint at the tapped coordinate to the ordered waypoint list (seq increments). Each tap that yields >=2 waypoints triggers a snap-to-road request for the affected leg(s).
- DRAG TO REPOSITION: Each waypoint renders as a draggable marker sized for thumb interaction (large hit target). Dragging a waypoint updates its coordinate; on drag-end, re-snap only the legs adjacent to the moved waypoint (incremental re-route), not the whole path, to limit routing-API calls.
- INSERT MIDPOINT: User can insert a waypoint between two existing ones by dragging the snapped line itself (a 'pull the line' gesture) or by long-pressing a leg to drop a new ordered waypoint, then re-snapping the two new legs. Provide this as the primary way to bend the route along a different road.
- REMOVE WAYPOINT: User can delete a waypoint via tap-to-select then a delete control (and/or long-press menu). Removing a waypoint re-snaps the now-adjacent legs; removing down to <2 waypoints clears distance/elevation and disables Save.
- SNAP-TO-ROAD: Connecting legs are routed along real paths via the OpenRouteService directions API (foot/walking profile appropriate for run/jog) through the routing adapter. The snapped polyline is what is drawn, measured, and ultimately saved to Route.path; raw dragged anchors are preserved separately as RouteWaypoint rows (seq + point) so the route can be re-edited/re-snapped later.
- SNAP TOGGLE / FALLBACK: Provide a 'snap to roads' toggle. When ON (default), legs follow roads. When OFF, legs are straight geodesic lines between waypoints (useful off-grid / when routing fails). If a snap request fails (network error, ORS rate limit/quota, no route found between points), show a non-blocking inline error on that leg, fall back to a straight dashed line for the un-snappable leg, and let the user retry, toggle snap off, or move the waypoint; the rest of the route stays usable.
- LIVE DISTANCE: Continuously display total route distance in meters/kilometers (and a mi option per locale), recomputed from the current snapped (or straight) geometry after every edit. Distance shown during editing is the client estimate (from ORS leg distances); the authoritative value is recomputed server-side as ST_Length(path) at save.
- ELEVATION PROFILE: Request elevation along the route (ORS elevation=true) and render a compact elevation profile chart in the bottom sheet plus a total positive elevation gain figure. The chart x-axis is cumulative distance, y-axis is elevation; tapping/scrubbing the chart highlights the corresponding point on the map. If elevation data is unavailable, hide the chart gracefully and show distance only (do not block save).
- ELEVATION/DISTANCE PERSISTENCE: On save, send the snapped path plus the sampled elevation profile ([{distM, eleM}]) so the backend can cache Route.distanceM, Route.elevationGainM, and Route.elevationProfile (jsonb) for cheap reads on the route detail/leaderboard pages.
- UNDO / REDO: Provide Undo (and ideally Redo) for waypoint add/move/insert/delete operations so a mis-drag is cheap to recover from on a small screen.
- CLEAR / START OVER: Provide a 'clear route' action (with confirm) that removes all waypoints and resets stats.
- OUT-AND-BACK / MAKE LOOP HELPERS (lightweight): Optionally offer a one-tap 'out & back' that mirrors the current waypoint sequence back to the start (still snapped). NOTE: automatic loop-by-target-distance generation is OUT OF SCOPE (future phase).
- NAME & SAVE: Saving requires a non-empty route name (validated, trimmed, reasonable max length) and >=2 waypoints producing a valid path. Save is reachable from the bottom sheet via a 'Save route' CTA that expands a details mini-form: name (required), optional description, and an isPublic toggle (default private/false).
- SAVE PAYLOAD & BACKEND CONTRACT: On save, POST to the routes API with: ordered waypoints (lat/lng + seq), the snapped path as a LineString (or instruction to re-snap server-side), snap-mode flag, client distance estimate, and elevation profile. Backend (NestJS) verifies the Firebase ID token via the AuthService adapter, upserts the User row if first request, writes Route + RouteWaypoint rows via raw PostGIS ($executeRaw with ST_GeogFromText / ST_MakeLine), and AUTO-CREATES one Segment equal to the full Route.path (PoC default) for leaderboards. Owner is set from the verified uid; an OWNER RouteMembership may be created.
- AUTH GATE: The page requires an authenticated user (Firebase Auth, email or Google). If the user is unauthenticated or the token is missing/expired, prompt sign-in (via AuthService adapter) before allowing save; allow drafting the route locally but block the final POST until authenticated, preserving the in-progress draft across the auth round-trip.
- SAVE STATES: Save button shows idle/disabled (when invalid), loading (request in flight, prevent double-submit), success (navigate to the new route's detail page), and error (server/network failure -> keep the editor state intact, show retryable error, do not lose the drawn route).
- OFFLINE / FLAKY NETWORK: Map tiles, snap-to-road, and elevation all require network. If offline: allow adding/moving waypoints with straight-line geometry and a clear 'snap unavailable offline' banner, queue nothing silently, and disable Save with an explanatory message (saving needs the routing API + backend). Reconnect should let the user re-snap and save.
- DRAFT PRESERVATION: Guard against accidental loss: warn (confirm dialog) on back-navigation/route-change/tab-close while there are unsaved waypoints; optionally persist the in-progress draft to localStorage so an accidental reload can restore it.
- ROUTING RATE-LIMIT HYGIENE: Debounce/throttle snap and elevation requests during rapid dragging, coalesce adjacent-leg re-snaps, and cancel superseded in-flight requests to respect the OpenRouteService free-tier quota; surface a gentle 'too many edits, slowing down' notice if throttled.
- VALIDATION & EDGE CASES: Handle a single waypoint (no path, no distance, Save disabled), duplicate/identical consecutive points (ignore zero-length legs), waypoints in water/off-network where snapping fails (fall back to straight + warn), and extremely long routes (warn if the path exceeds a sane PoC length so a runaway routing call is avoided).

**Data displayed**

- Full-screen interactive map (OpenFreeMap tiles via MapLibre GL JS)
- Ordered, numbered draggable waypoint markers (start/end visually distinguished)
- The snapped route polyline (solid) and any un-snappable legs (dashed straight fallback)
- Total route distance (km/mi per locale)
- Total positive elevation gain (m)
- Elevation profile chart (cumulative distance vs elevation) with scrub-to-highlight
- Snap-to-road toggle state
- Waypoint count / selected-waypoint indicator
- Route details mini-form: name (required), description (optional), isPublic toggle
- Inline per-leg snap-error / fallback indicators
- Network/offline and routing-throttle banners
- Save button state (disabled/loading/error)
- Current-location indicator dot when location is available (non-tracking)

**Mobile interactions**

- Tap empty map = add waypoint; tap existing marker = select it (reveals delete/handle)
- Drag waypoint marker with large thumb-friendly hit area; haptic/visual feedback on grab and drop
- Drag the snapped line to pull in a new midpoint (Strava-style line bending)
- Long-press a leg or marker for a contextual menu (insert before/after, delete)
- Standard map gestures: one-finger pan, pinch-zoom, two-finger rotate/tilt (tilt non-essential here)
- Bottom sheet is draggable: collapsed shows distance + Save; expanded reveals elevation chart and the name/description/isPublic form
- Scrub the elevation chart to move a highlight marker along the route on the map
- Thumb-reachable controls: Undo/Redo/Snap-toggle/locate-me as floating buttons in the lower portion of the screen; primary Save CTA pinned to the bottom sheet
- 'Recenter on me' button to re-trigger one-shot location centering
- Pull-down or back gesture triggers unsaved-changes confirm

**States**

- _empty:_ No waypoints yet: map centered on user/last/default location with a hint overlay ('Tap the map to drop your first point'); distance/elevation hidden; Save disabled.
- _loading:_ Snapping legs and fetching elevation: subtle per-leg/route loading indicator and a 'snapping...' state on stats; Save shows spinner while POST is in flight.
- _error:_ Snap or elevation request failed: inline retryable error on the affected leg with straight-line fallback; save failure shows a toast/banner with retry while preserving the full draft.
- _offline:_ Routing/tiles unavailable: 'You're offline — snap-to-road and saving need a connection' banner; editing continues with straight lines; Save disabled with explanation.
- _permissionDenied:_ Location permission denied/blocked: no auto-center; show 'Location off — pan the map to your start' hint; route creation fully available without location.

**Permissions / services**

- Network (required for tiles, snap-to-road, elevation, and save)
- MapLibre GL JS + OpenFreeMap tiles (no API key)
- OpenRouteService directions API (snap-to-road) + elevation, via the routing adapter — free-tier quota, must throttle
- Geolocation for one-shot map centering only (web Geolocation API now; Capacitor Geolocation later) — optional, not continuous, no Wake Lock
- Firebase Auth ID token (via AuthService adapter) for the authenticated save request
- NestJS + Prisma + PostgreSQL/PostGIS backend (raw ST_* writes for Route.path / RouteWaypoint; auto-create full-route Segment)

**PWA-now / Capacitor-later**

"This page is NOT a recording/live page, so there is no foreground GPS session and no Screen Wake Lock here (those belong to the Activity Recording / Live Tracking pages). Location is used ONLY for a one-shot map-centering convenience. PWA NOW: that one-shot read goes through the LocationTracker adapter's web implementation (navigator.geolocation.getCurrentPosition); CAPACITOR LATER: the same adapter interface is backed by @capacitor/geolocation with native permission prompts, with no change to this page's logic. Likewise snap-to-road/elevation go through a routing adapter (OpenRouteService now, self-hosted GraphHopper/Valhalla later) and save goes through PointUploader/AuthService adapters (Firebase web SDK now, native FCM/Auth later). The map renderer (MapLibre GL JS) is identical web-and-Capacitor, so the map canvas itself needs no swap."

**Out of scope (deferred)**

- Automatic loop generation by target distance (future phase)
- LLM natural-language route suggestions (future phase)
- 3D / animated route replay (future phase)
- Sub-segment authoring (drawing custom hill/lap segments) — PoC auto-creates only one full-route segment; sub-segments deferred
- True screen-off background GPS (Capacitor + Android foreground service later) — not relevant to drawing but noted as the global PWA-now limitation
- Self-hosted Protomaps PMTiles and self-hosted GraphHopper/Valhalla routing (adapters keep these swappable later)
- Inviting members during creation — invites/membership management handled on the Route detail page, not here

**Navigation**

- _Entry:_ Routes list/tab 'Create / New route' FAB or button; Empty-state 'Create your first route' CTA on the Routes page; Deep link /routes/new
- _Exits:_ On successful save -> Route detail page (/routes/:id) of the newly created route; Cancel/back -> previous screen (Routes list) after unsaved-changes confirm; Sign-in flow (modal/redirect) and back to the preserved draft



---

## Route Detail

**Route:** `/routes/:id`

The hub for a single saved route: shows the route line on a map with stats (distance, elevation profile), a leaderboard preview of best times, the member roster with invite controls, and the primary entry point to start a foreground-recorded run on this route. Acts as the bridge from "a planned route" to "recording an activity against it" and to "live tracking with others on it."

**Primary actions**

- Start run on this route (primary CTA, foreground recording)
- Invite users to the route
- Accept / Decline invite (if current user is INVITED)
- View full leaderboard
- Open members bottom sheet
- Open live tracking (when someone is live now)
- Owner overflow: edit route, toggle public/private, delete route, remove member
- Share route link

**Functional requirements**

- Load and display a single Route by :id via GET /routes/:id, returning route metadata (name, description, owner, isPublic), the snapped path geometry (decoded to coordinates for MapLibre), cached distanceM, elevationGainM, and the elevationProfile jsonb sample array.
- Render the route's snapped path as a polyline on a MapLibre GL JS map, auto-fitting the map bounds to the full route extent on first load with mobile-safe padding (so the line is not hidden behind the top app bar or the bottom sheet).
- Show start and end markers on the route line; if the route is a loop (start within startBuffer of end), render a single combined start/finish marker instead of two overlapping ones.
- Display primary route stats prominently: total distance (km, 2 decimals), elevation gain (m), and segment count (PoC default = 1 auto-created segment equal to the full route).
- Render an elevation profile chart from Route.elevationProfile ([{distM, eleM}]); if elevationProfile is null/empty, hide the chart and show a compact 'Elevation data unavailable' note rather than a broken/empty chart.
- Show a leaderboard PREVIEW: the top N (e.g. 3-5) best efforts on this route's primary segment, each row showing rank, runner display name + avatar (photoUrl), best elapsed time (formatted m:ss / h:mm:ss), and date. Highlight the current user's own row if they appear, and if the current user has a best effort but is outside the top N, append a pinned 'You — rank #X' row beneath the preview.
- Provide a 'View full leaderboard' affordance that navigates to the dedicated leaderboard view/segment screen for this route's segment.
- Show a members section: a compact horizontal avatar stack/roster of RouteMembership rows with status JOINED (and visually distinguish INVITED/pending), plus a count (e.g. '5 members'). Tapping the roster opens a members bottom sheet listing each member with display name, avatar, role (OWNER/MEMBER) and membership status (JOINED / INVITED / DECLINED).
- Provide an 'Invite' action (button or in the members sheet) that lets the route owner or members invite other users; opening it presents an invite sheet to search/enter a user (by email) and send an invite, creating a RouteMembership with status INVITED and invitedById = current user. Enforce the UNIQUE(routeId, userId) rule client-side: if the user is already a member/invited, disable re-invite and show 'Already invited / already a member'.
- Reflect the current user's own membership state on this route: if they are OWNER or JOINED show full controls; if they are INVITED show an 'Accept invite' / 'Decline' pair that PATCHes their RouteMembership.status to JOINED or DECLINED; if they have no membership and the route is public, optionally allow 'Join route'.
- Gate management actions by role: only the OWNER can edit route details, delete the route, or remove other members; non-owners see those controls hidden or disabled. Provide an owner overflow menu (edit, delete, toggle isPublic).
- Provide the PRIMARY call-to-action 'Start run on this route' that begins a foreground GPS recording session pre-associated with this routeId (so the saved Activity gets routeId set and the run can be matched against the route's segment for a best effort).
- Before starting a run, check geolocation permission state: if permission is not yet granted, trigger the browser geolocation permission prompt (via the LocationTracker adapter); if denied, block the start and show a permission-denied explainer with guidance to enable location in browser/site settings.
- When starting a run, request a Screen Wake Lock (via the LocationTracker/recording adapter) so the screen stays on during foreground recording; surface a non-blocking warning that the PWA must stay in the foreground with the screen on (true background/screen-off recording is a later Capacitor capability).
- On 'Start run', acquire an initial GPS fix and show a brief 'Acquiring GPS…' state; if no fix is obtained within a timeout or accuracy is poor, allow the user to start anyway or retry, and surface a low-accuracy indicator.
- Optionally offer a 'Start live run' / share-live toggle at start so other members on the same route can see the runner in real time (writes presence + throttled positions to Firebase RTDB); make clear this is opt-in and battery/data aware.
- Allow non-members to start a run on a public route, but require membership (or being the owner) to start a run on a private route; surface the appropriate gate.
- Show whether anyone is currently live on this route (presence from Firebase RTDB): if one or more members are actively running this route now, show a 'N live now' indicator and a way to open the live tracking view to watch them.
- Handle the loading state (route geometry + leaderboard + members may load independently): show a map/stat skeleton while the route loads and per-section spinners for leaderboard and members so the page is usable as soon as the route renders.
- Handle not-found / no-access: if GET /routes/:id returns 404 (deleted) or 403 (private route the user is not a member of), show a clear 'Route not found' or 'You don't have access to this route' state with a back action, not a broken map.
- Handle network/offline: if the route fetch fails, show a retry affordance; if previously cached (RTK Query / offline cache), render cached route geometry and stats with a stale/offline banner and disable mutating actions (invite, accept, delete).
- Handle empty leaderboard (route has no recorded efforts yet): show an encouraging empty state ('No times yet — be the first to set a record') with the 'Start run' CTA emphasized.
- Handle empty members (owner only so far): show 'Just you so far — invite friends' prompting the invite flow.
- Support pull-to-refresh (or a refresh control) to re-fetch route stats, leaderboard, and live presence.
- Confirm destructive actions: deleting the route (owner) and removing a member require a confirmation sheet/dialog; deleting cascades and should warn that activities recorded on this route keep their data but lose the route link.
- Provide a share affordance for the route (copy link / share sheet) consistent with the existing share pattern used on the activity summary screen.

**Data displayed**

- Route name, description, owner display name + avatar, public/private badge
- Snapped route path polyline on the map with start/end (or combined loop) markers
- Total distance (km), elevation gain (m), segment count
- Elevation profile chart derived from Route.elevationProfile
- Leaderboard preview: rank, runner avatar + display name, best elapsed time, date; current-user highlight and pinned 'You' row if outside top N
- Members roster: avatars, member count, per-member role (OWNER/MEMBER) and status (JOINED / INVITED / DECLINED)
- Current user's own membership state (owner / joined / invited / none)
- Live presence indicator ('N live now') for members currently recording this route
- GPS/permission status when starting a run (acquiring fix, accuracy, permission denied)
- Stale/offline banner when showing cached data

**Mobile interactions**

- Map gestures: pan, pinch-zoom, and rotate on the route polyline; a 'recenter / fit route' button anchored within thumb reach to re-fit bounds after panning.
- Bottom sheet pattern: the route stats, leaderboard preview, and members live in a draggable bottom sheet over the map; drag up to expand the sheet for full stats/leaderboard, drag down to maximize the map. Sheet supports a half/expanded snap.
- Members roster tap opens a members bottom sheet; invite opens an invite sheet with an email/user search field and a send button — both reachable one-handed from the lower half of the screen.
- Primary 'Start run' button is a large, fixed, thumb-reachable CTA pinned to the bottom of the screen so it is always tappable without reaching the top.
- Pull-to-refresh on the sheet content to refresh stats, leaderboard, and live presence.
- Permission prompt surfaced inline on first 'Start run' tap; permission-denied state shown as an inline explainer sheet rather than blocking the whole page.
- Confirmation sheets for destructive actions (delete route, remove member, decline invite) with clear primary/secondary buttons.
- Haptic feedback on key actions (start run, send invite) consistent with the existing haptic-tab pattern.

**States**

- _empty:_ Empty leaderboard shows 'No times yet — be the first to set a record' with the Start run CTA emphasized; empty members (owner only) shows 'Just you so far — invite friends'; missing elevationProfile hides the chart with an 'Elevation data unavailable' note.
- _loading:_ Map + stat skeleton while route geometry loads; independent per-section spinners for leaderboard and members so the route renders as soon as its geometry/stats arrive.
- _error:_ Route fetch failure shows an error state with retry; 404 shows 'Route not found'; 403 (private, not a member) shows 'You don't have access to this route' with a back action — never a broken/empty map.
- _offline:_ If cached, render cached route geometry + stats with a stale/offline banner and disable mutating actions (invite, accept/decline, delete, edit); if not cached, show offline error with retry. Live presence shows 'Live unavailable offline'.
- _permissionDenied:_ On Start run with denied geolocation, block recording and show a permission-denied explainer with steps to re-enable location in browser/site settings and a retry; the rest of the page stays usable.

**Permissions / services**

- Browser Geolocation API (via LocationTracker adapter) for GPS fix when starting a run
- Screen Wake Lock API (via recording adapter) to keep screen on during foreground recording
- Network / backend REST API (NestJS) for route, leaderboard, and membership data
- Firebase Auth ID token (AuthService adapter) on all backend requests; backend verifies uid
- Firebase Realtime Database for live presence ('N live now') and, if starting a live run, position fan-out
- PostGIS-backed backend for route geometry, ST_Length distance, and segment best-effort/leaderboard computation
- OpenFreeMap tiles for the MapLibre base map (no key)
- Web Share API / clipboard for sharing the route link

**PWA-now / Capacitor-later**

"Starting a run from this page uses foreground-only recording in the PWA today: the LocationTracker web adapter uses the browser Geolocation watch and a Screen Wake Lock to keep the screen on while recording — if the user backgrounds the tab or the screen sleeps without the wake lock, GPS sampling pauses and the track will gap. The page must warn the user to keep the app foregrounded with the screen on. Later, the Capacitor shell swaps in a native LocationTracker backed by an Android foreground service for true screen-off background GPS, at which point the wake-lock warning and foreground-only caveat shown here are removed/relaxed. Live tracking presence/position writes go through the PushService/RTDB adapter; in the PWA these also only run while foregrounded, whereas Capacitor can sustain them via the background service. The adapter interfaces (LocationTracker, PointUploader, PushService, AuthService) are the only things that change between PWA-now and Capacitor-later — this page's UI and the 'Start run' contract stay the same."

**Out of scope (deferred)**

- 3D / animated replay of the route or efforts (future phase)
- LLM natural-language route suggestions (future phase)
- Auto loop-by-distance route generation (future phase)
- True screen-off / background GPS recording (arrives with the Capacitor Android foreground service; PWA is foreground-only)
- FCM push notifications for invites and 'someone is live' (later, with Capacitor)
- Sub-segment leaderboards within a route (schema supports it; PoC ships one segment = full route)
- Self-hosted Protomaps PMTiles, GraphHopper/Valhalla routing, and R2-hosted media (using OpenFreeMap + OpenRouteService now)
- In-page route editing of the geometry beyond linking to the route editor (re-snap waypoints handled on the editor screen)

**Navigation**

- _Entry:_ Routes list / discovery screen (tap a route card); Deep link / shared route link (/routes/:id); Notification or invite (open the route you were invited to); Post-route-creation success (navigate to the newly saved route's detail); Activity summary that references a route ('View route' link from an Activity with a routeId); Live tracking entry that resolves back to its route
- _Exits:_ Start run -> Record screen / live recording session pre-associated with this routeId; View full leaderboard -> Segment/leaderboard screen for this route; Open members -> members bottom sheet (in-page); N live now -> Live tracking map for this route; Owner edit -> Route editor (re-snap waypoints); Tap a leaderboard row -> that runner's Activity detail (best effort); Back -> Routes list / previous screen; Delete route -> back to Routes list



---

## Invite / Manage Members

**Route:** `/routes/:id/members`

Lets a route owner invite other users to a route and lets owners and members view the full membership roster with each person's role and invite status. It is the single place to grow and manage who is associated with a route (for shared live tracking, leaderboards, and route visibility).

**Primary actions**

- Invite by email (opens invite bottom sheet)
- Share invite link (copy + OS/Web share sheet)
- Revoke / cancel pending invite (owner, on INVITED rows)
- Remove member (owner, on JOINED rows, destructive confirm)
- Resend invite (owner, on INVITED rows)
- Accept / Decline invite (for the viewer's own pending invitation)
- Leave route (non-owner member)

**Functional requirements**

- Load the membership roster for the route in :id on mount via GET (RouteMembership rows joined to User), grouping/ordering so the OWNER appears first, then JOINED members, then pending INVITED, then DECLINED at the bottom; show a per-row skeleton list while loading.
- Resolve the viewer's own membership/role first: the page must know whether the current Firebase user is the OWNER, a MEMBER, or a non-member, because controls differ. Only OWNER (and optionally JOINED members if owner-only invite is not enforced) can send invites; only OWNER can change roles, revoke invites, or remove members.
- Owner can invite a user by email: an 'Invite' primary action opens an invite bottom sheet with an email input (type=email, autocomplete=email, inputmode=email). On submit, the app looks up / sends an invite to that email. If the email maps to an existing User (Firebase mirror), create a RouteMembership(status=INVITED, role=MEMBER, invitedById=currentUid) with UNIQUE(routeId,userId) enforced. If no User exists yet for that email, still record a pending invite keyed by email so it resolves to a membership when that person first authenticates (or, minimally for PoC, surface 'No account found for this email' and block).
- Prevent duplicate / invalid invites client-side and handle server rejection of the UNIQUE(routeId,userId) constraint: if the email already has a membership row, do not create a second one — instead show inline status ('Already a member', 'Invite already pending', or 'Previously declined — re-invite?') and offer a re-invite action that flips a DECLINED row back to INVITED rather than inserting a duplicate.
- Validate the email field inline before enabling submit (non-empty, valid email shape); trim whitespace; block self-invite (entering the owner's own email) with a clear message; disable the submit button while the request is in flight and show a spinner on it.
- Generate and share an invite link / shareable handle for the route as an alternative to per-email invites: a 'Share invite link' action that copies a deep link (e.g. https://app/routes/:id/join) to the clipboard and, where available, opens the OS share sheet (Web Share API now; native share via Capacitor later). Show a 'Copied' confirmation toast. (Acceptance/redemption of that link is handled by a separate join flow / Route Detail page, not designed here.)
- Render each member row with: avatar (User.photoUrl, fallback to initials from displayName/email), display name (fallback to email when displayName is null), role badge (OWNER/MEMBER), and status badge (JOINED / INVITED-pending / DECLINED). The owner row is visually marked and is never removable or demotable through this page.
- Owner can revoke a pending invite (delete or mark the INVITED RouteMembership), shown as a 'Revoke' / 'Cancel invite' action on INVITED rows, gated behind a confirm step (swipe-to-reveal action or overflow menu given one-handed use).
- Owner can remove a JOINED member (delete the RouteMembership), gated behind a destructive-confirm dialog ('Remove <name> from this route?'). Removing a member must not delete that user's already-saved Activities or LeaderboardEntry rows; clarify in the confirm copy that past results remain. After removal the row disappears and the count updates.
- Owner can resend a pending invite (e.g. for an INVITED row that has lingered), with light client-side throttle/cooldown feedback to avoid spamming; show 'Invite resent' confirmation.
- A non-owner member viewing this page sees the roster read-only (no invite/remove/role controls) and gets a 'Leave route' action that deletes their own RouteMembership after a confirm; leaving returns them to the routes list and removes the route from their 'my routes'.
- An invited user who has not yet accepted may land here from an invite: surface Accept / Decline actions for their own pending row, flipping status to JOINED or DECLINED and updating their access; this can also be reachable from a notifications/route-detail entry point.
- Show a live member/invite count summary (e.g. 'Owner + 3 members, 2 pending') in the header so the owner can gauge route size against any practical limits for live tracking fan-out.
- Optimistically update the roster on invite/revoke/remove/role-change and reconcile with the server response; on failure, roll back the optimistic change and show an error toast with a retry affordance.
- Handle the not-found / no-access cases: if :id is not a real route, show a 'Route not found' state; if the current user is neither owner nor member and the route is not public, show a 'You don't have access to this route' state with a back action rather than the roster.
- Require auth: if the Firebase ID token is missing/expired, redirect to sign-in and return here after; all list/mutation calls send the Firebase ID token in the Authorization header and are authorized by the NestJS guard (owner-only mutations enforced server-side, not just hidden in UI).
- Provide pull-to-refresh / manual refresh to re-fetch the roster, since invite statuses change asynchronously (someone may accept/decline while the owner views the page).
- Empty state when the route has only the owner and no other members/invites: show an encouraging empty state with the primary 'Invite' and 'Share invite link' actions front and center.
- Edge case — last owner: there is exactly one OWNER per route in the PoC; the owner cannot leave or be removed (deleting the route is a separate Route settings concern, out of scope here). Surface this if the owner attempts 'Leave'.

**Data displayed**

- Route name/title in the header for context (the route this membership list belongs to)
- Member/invite summary counts (joined members, pending invites)
- Per member: avatar (User.photoUrl or initials fallback), displayName (or email fallback), email (for owner's view of pending invites)
- Role badge: OWNER or MEMBER (RouteMembership.role)
- Status badge: JOINED, INVITED (pending), or DECLINED (RouteMembership.status)
- Who sent a pending invite (invitedById -> display name), where useful
- The shareable invite link / deep link for the route
- Inline validation and result messages on the invite input (invalid email, already a member, pending, declined, self-invite)

**Mobile interactions**

- Bottom sheet for the invite-by-email form so the email keyboard and submit button sit within thumb reach; sheet is dismissible by swipe-down or backdrop tap and traps focus on the email input on open.
- Swipe-to-reveal row actions (revoke / remove) plus an overflow (...) menu fallback for one-handed discoverability on each manageable row.
- Destructive actions (remove member, leave route, revoke invite) require a confirm dialog/action sheet anchored to the bottom of the screen.
- Pull-to-refresh on the roster list to re-pull asynchronous status changes.
- Tap 'Share invite link' triggers Web Share API where available, otherwise copies to clipboard with a 'Copied' toast.
- Primary 'Invite' CTA pinned as a thumb-reachable bottom button (or FAB) rather than top-right, given one-handed use.
- Toasts/snackbars for success and error states with an undo/retry affordance where the action is reversible.
- Status and role badges are non-interactive labels; tapping a member row (optional) opens a lightweight detail/action sheet.

**States**

- _empty:_ Route has only the owner: friendly empty state prompting 'Invite people to run this route together' with prominent Invite and Share invite link actions.
- _loading:_ Header shows route name; roster area shows a skeleton list of member rows while GET membership resolves.
- _error:_ Roster failed to load: inline error with a Retry button; mutation failures roll back optimistic UI and show an error toast with retry.
- _offline:_ Show cached roster if available with an 'Offline — showing last known members' banner; disable invite/remove/role mutations (queue or block) until back online since these require the backend + Firebase token.
- _permissionDenied:_ Viewer is neither owner nor member of a non-public route: 'You don't have access to this route' with a back action; non-owner members see the roster read-only with management controls hidden (and enforced server-side).

**Permissions / services**

- Network / backend REST API (NestJS) for RouteMembership CRUD and User lookup by email
- Firebase Auth ID token (Authorization header) verified by the NestJS guard; identity = Firebase uid which is the User PK/FK
- Clipboard access for copying the invite link
- Web Share API (now, where supported) / native share sheet via Capacitor (later) for sharing the invite link
- PostgreSQL is the source of truth for RouteMembership (no PostGIS geometry needed on this page); no GPS/location permission required

**PWA-now / Capacitor-later**

"This page has no GPS/recording or live-tracking, so there is no foreground-vs-background distinction. The only device-capability difference is sharing the invite link: PWA-now uses the Web Share API when available (and falls back to clipboard-copy + toast on browsers without it), while Capacitor-later swaps in the native Android share sheet via the same thin share adapter. Auth token retrieval also goes through the AuthService adapter (web Firebase SDK now, native Firebase via Capacitor later); the page code itself does not change."

**Out of scope (deferred)**

- FCM push notifications for new invites / acceptances (arrives with Capacitor + native shell, future phase)
- Granular per-member permissions or multiple owners / co-owner roles (PoC has a single OWNER and flat MEMBER role)
- Hard enforcement of free-tier live-tracking concurrency limits on membership size (informational count only for now)
- Email delivery of invitations to non-registered users (PoC resolves invites on first authenticated login or via shared link; transactional email is a future phase)
- Route deletion / route settings (separate Route settings surface)
- Bulk invite (CSV / contact picker import) and group/team management
- In-page realtime presence of which members are currently live on the route (that lives on the Live Tracking page via Firebase RTDB)

**Navigation**

- _Entry:_ Route Detail page (a 'Members' / 'Manage members' button); Routes list / 'My routes' (overflow action on a route owned by the user); Deep link / invite link redemption that lands an invited user on this page with their pending Accept/Decline row; Notifications entry (later, via FCM) pointing to a pending invite
- _Exits:_ Back to Route Detail (default back); Back to Routes list after 'Leave route'; Redirect to sign-in if unauthenticated, returning here after auth; Forward to Live Tracking / Leaderboard for the same route (cross-links once members are set)



---

## Route Leaderboard

**Route:** `/routes/:id/leaderboard`

Shows the ranked best efforts (fastest elapsed times) of users on a route's segment, Strava-segment style. Lets a runner see where they place, who the leaders are, and filter the ranking by time period, membership scope, and activity type, with a clear call to go run the route.

**Primary actions**

- Open filters bottom sheet (period / scope / type)
- Jump to my rank
- Tap a row to open that athlete's best-effort activity
- Pull-to-refresh
- Start Run on this route (CTA, prominent when user has no time)
- Share leaderboard link (with current filters)
- Back to Route detail (via header)

**Functional requirements**

- Resolve the route from the :id param, fetch its leaderboard for the route's default segment (PoC: one Segment == full Route.path, auto-created on route save), and render a ranked list ordered by fastest elapsed time (bestDurationS ascending), rank 1 at top.
- Each leaderboard row must show: rank number (with crown/medal emphasis for top 3), runner display name + avatar (User.displayName / photoUrl, fallback to initials when photoUrl null), best elapsed time formatted mm:ss or h:mm:ss, and a secondary stat (avg pace s/km derived from bestDurationS and segment distanceM, or date of that best effort). Each entry maps to a LeaderboardEntry (segmentId, userId, best activityId, bestDurationS).
- Pin a persistent 'my rank' summary so the current user (Firebase uid == User.id) can see their own standing without scrolling: show my rank position, my best time, gap to rank 1 (and gap to the rank directly above me), and a CTA to open my best-effort activity. If I have no qualifying effort yet, show 'No time yet — run this route to get on the board' with a Start Run CTA.
- Tapping a leaderboard row opens that user's best-effort Activity detail (route /activity/:activityId) so the time can be inspected on the map.
- Auto-scroll / 'jump to my rank' affordance: a thumb-reachable control that scrolls the list to and highlights the current user's row when they are ranked outside the visible top.
- Filter controls (mobile bottom sheet, thumb-reachable): Time period (All-time / This year / This month / This week — server filters by the best effort's activity startedAt), Scope (Everyone vs Route members only — members come from RouteMembership where status=JOINED; default scope respects route privacy: a private route defaults to and locks Members-only), and Activity type (All / Run / Jog / Walk per Activity.type enum). Active filters are reflected in a compact summary chip row above the list; clearing returns to defaults.
- Persist selected filters in the URL query string (e.g. ?period=month&scope=members&type=run) so the filtered view is shareable and survives refresh/deep-link; the page must read and apply these on load.
- One best effort per user per segment: the list shows each user once (their fastest qualifying time), never multiple rows for the same user. Ties on bestDurationS broken by earlier startedAt (whoever set the time first ranks higher).
- Show segment context header: route name, segment distance (km, from distanceM), elevation gain if available, and total number of ranked athletes for the current filter; tapping the header navigates back to the Route detail page.
- Pull-to-refresh re-fetches the leaderboard (recomputed by PostGIS trace matching server-side); show last-updated/relative-time so the user knows freshness.
- Pagination / lazy loading: load the top N (e.g. 50) then infinite-scroll/'Load more' for long boards; always fetch and pin the current user's own row even if it falls outside the loaded page.
- Membership gate: if the route is private and the current user is not a JOINED member (and not the owner), the leaderboard must not render entries — show a gated state explaining they need to be invited/join, with no athlete data leaked.
- Provide a share affordance for the route/leaderboard (copy link with current filters) — links resolve to this page including filter query params.
- Handle a freshly created route with zero recorded efforts: show empty leaderboard state with a Start Run / View Route CTA, still showing segment distance header.
- Handle the case where the current user has an effort but it has not yet been matched/scored (recompute pending after a just-saved activity): show their row as 'pending / being scored' rather than omitting it, and refresh on next fetch.
- Gracefully handle a deleted/invalid route id (404) and a route the user has no access to (403) with distinct states.
- All times and paces use the segment distance for pace math; never recompute distance client-side from geometry — read cached Segment.distanceM.

**Data displayed**

- Route name and (optional) description snippet
- Segment distance in km and elevation gain in m (from Segment.distanceM / Route.elevationGainM)
- Total ranked athlete count for the active filter
- Ranked list rows: rank number, athlete avatar + display name, best elapsed time (mm:ss / h:mm:ss), secondary stat (avg pace s/km or effort date)
- Top-3 visual emphasis (medal/crown indicators)
- Current user's pinned 'my rank' card: my position, my best time, gap to leader and to the runner above me
- Active filter summary chips (period / scope / type)
- Last-updated / data freshness timestamp
- Empty, gated (private/non-member), pending-scoring, and error indicators as applicable

**Mobile interactions**

- Filters open as a bottom sheet anchored to the lower screen for one-handed thumb reach; options are large tap targets with single-tap apply and a clear-all action.
- Pull-to-refresh gesture at top of the list re-fetches and updates the freshness timestamp.
- Sticky 'my rank' card pinned to the bottom (thumb zone) so it stays visible while scrolling the ranked list; tapping 'jump to my rank' smooth-scrolls and briefly highlights the user's row.
- Filter summary chips at the top are individually tappable to remove/adjust that single filter.
- Infinite scroll triggers 'Load more' near the list bottom; a small loading row appears while paginating.
- Long lists: list virtualizes; rank numbers stay left-aligned and times right-aligned for fast scanning with one thumb.
- Row tap gives subtle haptic feedback (consistent with existing haptic-tab pattern) before navigating to the activity detail.

**States**

- _empty:_ No efforts recorded on this route yet — show segment distance header plus 'Be the first — Start Run' CTA and a 'View Route' link.
- _loading:_ Skeleton rows for the ranked list and a placeholder 'my rank' card while the leaderboard fetch resolves; segment header shows as soon as route metadata is available.
- _error:_ Leaderboard fetch failed (network/server) — inline retry with the last cached board shown dimmed if available; distinct 404 state for deleted/invalid route and 403 state for no-access.
- _offline:_ PWA offline — show last cached leaderboard (if any) with an 'offline, last updated X ago' banner; disable refresh/pagination and Start Run until back online; if no cache, show offline empty state with retry.
- _permissionDenied:_ Private route and current user is not a JOINED member or owner — gated state: route name only, message to request/accept an invite, no athlete data or times shown; offer link to membership/invite flow.

**Permissions / services**

- Backend REST (NestJS) leaderboard endpoint returning ranked LeaderboardEntry rows joined with User, filtered server-side by period/scope/type
- Firebase Auth ID token (NestJS guard) to identify the current user for 'my rank' and to enforce private-route membership access
- PostgreSQL + PostGIS server-side for trace-matching that produces LeaderboardEntry rows (read-only from this page's perspective; recompute happens on activity save)
- Network connectivity (no device sensors/location required to view; GPS/location only needed once the user follows the Start Run CTA)

**PWA-now / Capacitor-later**

This page is read-only data display and behaves identically as a PWA now and inside the Capacitor shell later — no device-capability adapters (LocationTracker, PointUploader, PushService) are exercised here. The only cross-cutting difference is downstream: the 'Start Run' CTA leads to the recording flow, which is foreground-only (Screen Wake Lock) in the PWA today and gains true screen-off background GPS via the Android foreground service under Capacitor. Additionally, when FCM lands with Capacitor, a future enhancement could push 'your time was beaten' notifications that deep-link back into this page with filters preset; the PWA build omits that. Offline caching of the last-seen leaderboard relies on the PWA service worker now and would use the same web cache under Capacitor's WebView.

**Out of scope (deferred)**

- Live/real-time rank updates while others are running (Firebase RTDB live tracking is a separate live page; this leaderboard is recomputed durable data, refreshed on pull/refetch)
- Sub-segments within a route (hill/lap segments) — PoC ranks one segment == full route; schema supports more later
- Creating/editing custom segments or adjusting start/end gate buffers from this page
- Age/gender/weight-class filtering and segment 'KOM/QOM' style crowns beyond simple top-3 emphasis
- 3D/animated replay of a leaderboard effort
- LLM natural-language route suggestions and auto loop-by-distance generation
- Push notifications when someone beats your time (FCM arrives with Capacitor)
- Server-side anti-cheat / GPS spoofing detection beyond basic trace matching

**Navigation**

- _Entry:_ Route detail page (/routes/:id) 'Leaderboard' button/tab; Activity summary after saving an on-route run ('You placed #N — view leaderboard'); Deep link / shared URL including filter query params; Routes list when a route shows a 'leaderboard' shortcut
- _Exits:_ Athlete's best-effort Activity detail (/activity/:activityId); Route detail page (/routes/:id) via header tap or back; Record/Start Run flow for this route (e.g. /record?routeId=:id) via Start Run CTA; Invite/membership flow if gated (request to join / view invite)



---

## Record Run (Active Tracking)

**Route:** `/record`

Full-screen live recording surface where a user records a run by GPS: a map follows their position and draws the live track, large live stats (elapsed time, distance, pace/speed) update in real time, and start/pause/stop controls plus a keep-screen-on guarantee let them run one-handed. When recording on a shared route, they also see other runners on that route live. On stop, the run is finalized and handed off to the activity summary/save flow.

**Primary actions**

- Start (begin recording, acquire wake lock)
- Pause / Resume (toggle while recording)
- Stop (finalize run, with confirmation)
- Recenter map / re-enable follow mode
- Retry location permission (in permission-denied state)
- Dev: toggle simulated walk (dev builds only)

**Functional requirements**

- Acquire an initial GPS fix on mount: request foreground geolocation permission (web Geolocation API now; native plugin under the LocationTracker adapter later), then show a 'Searching for GPS...' acquiring state until the first fix with acceptable accuracy arrives. Do NOT start the clock or track until the user explicitly taps Start.
- Start recording: on tap Start, capture startedAt, zero the elapsed timer/distance/pace, begin appending GPS samples to the live track, request a Screen Wake Lock so the screen stays on, and transition controls to the recording state (Pause + Stop). If no GPS fix exists yet, Start is disabled (or queues until first fix) and shows why.
- Continuously append accepted GPS samples (lat/lng, accuracy, altitude/elevation if available, speed if available, recordedAt timestamp, seq) to the in-memory track while recording AND not paused; each sample also updates currentLocation used for the map marker even when paused or not yet recording.
- Compute and display live distance by summing haversine deltas between consecutive accepted samples; this is the in-app running total (server recomputes authoritative distanceM from the PostGIS LineString on save).
- Maintain a live elapsed timer (1s tick) that counts only while recording and not paused; pausing freezes elapsed time and stops distance accumulation.
- Display live pace (avg sec/km derived from elapsed/distance) and/or current speed (km/h from the latest sample's speed); handle the divide-by-zero / no-movement case by showing 0:00 or '--' rather than NaN/Infinity.
- Pause: stop accumulating time, distance, and track points; keep the wake lock and the GPS subscription alive so the map marker still tracks the user; swap the Pause control for Resume.
- Resume: continue the same recording session (do NOT reset stats or start a new track); a paused gap must not draw a straight line artifact across the skipped segment.
- Stop: finalize the session, release the Screen Wake Lock, stop the GPS subscription, capture endedAt and final duration/distance/track, and hand the recorded payload (ordered points with timestamps + summary stats + optional routeId) to the save/summary flow (current code routes to /activity/:id; PoC target is an activity summary page where title/type are confirmed before POSTing to the backend).
- Require a confirmation before Stop discards or finalizes a run so an accidental thumb tap mid-run does not end recording; very short/empty runs (e.g. <2 points or near-zero distance) should warn that there is nothing meaningful to save.
- Guarantee the Screen Wake Lock is held only while actively recording: re-acquire it on visibility regain (browsers drop wake locks when the tab is backgrounded), and release it on pause-is-allowed-to-keep-it-but-stop/unmount must release it. Surface a non-blocking notice if wake lock is unsupported/denied so the user knows the screen may sleep.
- Render the live track polyline on the MapLibre map as points accrue, and keep the map camera following the user's current position (follow mode) while allowing the user to pan/zoom away; when the user manually pans, exit follow mode and show a 'recenter' control to re-enable following.
- When recording on a route (routeId present, e.g. launched from a Route detail 'Start run on this route'), overlay the planned Route.path so the user can follow it, and connect to Firebase RTDB live tracking: publish own throttled/batched position + presence to the route's live session, and subscribe to other members' live positions to render their markers (with display name / avatar) on the same map in near real time.
- Throttle/batch RTDB writes (e.g. every few seconds or every N meters, not every GPS sample) to stay within Firebase Spark free-tier limits (100 concurrent connections, bandwidth); show other runners as last-known position and gracefully fade/mark them stale or remove them on presence disconnect.
- Free run (no routeId): hide the planned route overlay and the live-others layer; recording works standalone with self-only marker and track.
- Handle permission-denied for geolocation: show a clear blocking state explaining location is required to record, with a button to retry / open settings instructions, and never silently fail to record.
- Handle GPS signal loss / low accuracy mid-run: filter or de-weight high-uncertainty samples to avoid spikes in the track and distance, show a transient 'weak GPS' indicator, and keep the timer running (elapsed time is independent of GPS).
- Handle backgrounding/foreground-only reality: because this is a foreground PWA, if the screen sleeps or the tab is backgrounded GPS sampling pauses; on returning to foreground, resume sampling and avoid drawing a false straight segment across the gap. The wake lock is the mitigation while the page is visible. (True screen-off background tracking is deferred to the Capacitor shell.)
- Prevent accidental loss: warn (beforeunload / in-app guard) if the user tries to navigate away or close the tab while a recording is in progress, since an in-flight track is not yet persisted to Postgres.
- Network resilience: recording does not require network (GPS is local); the live-others/RTDB layer and final save require network. If offline at Stop, allow the run to be held locally and synced when back online (existing app already has a client-side activity store + server sync; reuse it).
- Show recording status affordances appropriate to a glanceable running screen: large, high-contrast stats readable in motion; controls sized for thumb reach at the bottom; a visible 'recording / paused' indicator.
- Provide a dev-only simulated walk toggle (existing feature) to fake a GPS path for emulators/desktop where there is no real movement, disabled once recording starts.

**Data displayed**

- Live elapsed time (HH:MM:SS, hours only when >0)
- Live total distance (km, 2 decimals)
- Live pace (avg min/km) and/or current speed (km/h) from latest GPS sample
- Map with user's current position marker and the live-drawn track polyline
- Planned route overlay (Route.path) when recording on a route
- Other runners' live markers with display name/avatar when on a shared route
- GPS state indicator (searching / weak / good accuracy)
- Recording state indicator (idle / recording / paused)
- Keep-screen-on / wake-lock status (only surfaced when unsupported or denied)
- Optional elevation/altitude of current sample if device provides it
- Dev-only: simulated walk toggle (development builds only)

**Mobile interactions**

- One-handed bottom control cluster: large circular Start, then Pause/Resume + Stop within thumb reach at the bottom of the screen
- Map gestures: drag to pan and pinch to zoom; manual pan disengages follow mode and reveals a recenter button
- Live stats fixed as a top/overlay panel so they stay glanceable while the map is interactive
- Stop requires a confirmation gesture (confirm sheet / press-and-hold or two-step) to prevent accidental finalize mid-run
- Keep-screen-on is automatic during recording (no manual toggle needed); status only surfaces if unavailable
- Pull/return-to-foreground re-acquires wake lock and resumes sampling without user action
- Optional bottom-sheet for secondary info (split/pace detail, other-runners list) that can be dragged up without obscuring the primary controls
- Navigation-away/close attempt during an active recording triggers a confirm guard

**States**

- _empty:_ Idle/pre-start: map centered on current location (or last known), stats showing 0:00 / 0.00 km / -- pace, a single large Start button. No track drawn yet.
- _loading:_ 'Searching for GPS...' acquiring state before the first acceptable fix; map shows a spinner/placeholder and Start is disabled until a fix lands.
- _error:_ GPS lost / weak-signal banner during recording (timer keeps running, suspect samples filtered); generic error toast if RTDB live session fails (recording continues self-only). Save errors surface on the summary page, not here.
- _offline:_ Recording continues fully (GPS is local). Live-others layer is hidden/unavailable and a subtle 'live tracking offline' notice shows; on Stop the run is stored locally and queued for server sync when connectivity returns.
- _permissionDenied:_ Blocking state: location permission denied -> message explaining location is required to record, a Retry button, and brief instructions to re-enable in browser/OS settings. No recording possible until granted.

**Permissions / services**

- Geolocation permission (foreground) — required to record
- Screen Wake Lock API — keep screen on while recording (graceful fallback if unsupported)
- Network — required only for live-others (Firebase RTDB) and final activity save, not for GPS recording itself
- Firebase Auth (ID token) — to associate the activity/live session with the user (User.id = Firebase uid)
- Firebase Realtime Database (Spark) — presence + live position fan-out when on a shared route
- MapLibre GL JS + OpenFreeMap tiles — map rendering
- Backend (NestJS + Prisma + PostGIS) — persisting the finalized Activity/ActivityPoint track and computing authoritative distance and best-effort vs leaderboard (on save, off this page)

**PWA-now / Capacitor-later**

"PWA now (foreground-only): GPS comes from the browser Geolocation API (watchPosition) behind the LocationTracker adapter; tracking only runs while the page is visible and the screen is awake. Screen Wake Lock API keeps the screen on while recording, but the OS/browser can still drop the lock when the tab is backgrounded, so it must be re-acquired on visibilitychange. If the user switches apps or the screen sleeps, sampling pauses and resumes on return (with gap handling so no false straight line is drawn). RTDB publishing is via the web Firebase SDK behind a PointUploader/live adapter, throttled to respect Spark limits. Capacitor later: swap the LocationTracker adapter for a native geolocation + Android foreground service implementation enabling true screen-off background GPS, and the PushService/PointUploader for native FCM/native upload — the page UI and stats logic stay unchanged because all device capability is isolated behind the adapter interfaces. Document the wake-lock-vs-foreground-service distinction explicitly so users/testers know screen-off recording is NOT supported until the native shell."

**Out of scope (deferred)**

- 3D / animated replay of the recorded run (future phase)
- True screen-off / background GPS recording — deferred until the Capacitor Android shell + foreground service
- FCM push notifications (e.g. 'a friend started a run on your route') — deferred to Capacitor
- Snap-to-road / map-matching of the recorded GPS track on this screen (snap-to-road is scoped for route creation; a snap util exists in code but is not part of the live recording UX)
- On-device live segment/leaderboard best-effort computation — leaderboard matching runs server-side via PostGIS after the activity is saved, not live on this page
- LLM natural-language route suggestions and auto loop-by-distance generation (future phase)
- Manual lap/split buttons and auto-pause-on-stationary (not in PoC scope)
- Self-hosted Protomaps tiles and self-hosted GraphHopper/Valhalla routing (later; using OpenFreeMap + OpenRouteService for now)

**Navigation**

- _Entry:_ Bottom tab / primary nav 'Record' entry (current app has a Record tab); Route detail page 'Start run on this route' action (passes routeId so the run is associated with the route and joins its live session); Live tracking entry from a shared route where the user chooses to also record their own run
- _Exits:_ On Stop -> activity summary / save page (e.g. /activity/:id) to confirm title/type and persist the activity to the backend, where best-effort vs leaderboard is computed; Back / cancel before any Start -> returns to previous screen (no run created); Navigate-away guard while recording -> stays on page unless user confirms discarding the in-flight run



---

## Live Tracking / Spectate

**Route:** `/routes/:id/live`

A real-time spectator view that lets a signed-in user watch other runners who are currently active on a specific route, moving live on a map, without recording an activity of their own. It is the "watch only" counterpart to the Record page: it consumes the Firebase Realtime Database live session for the route and renders each active runner's latest position, presence, and basic live stats.

**Primary actions**

- Run this route / Record (navigate to recording flow bound to :id)
- Follow selected runner / Recenter (resume following)
- Fit all (zoom to route + all runners)
- Select/deselect a runner from marker or roster row
- Refresh / resync live session

**Functional requirements**

- Load the route by :id from the backend (Postgres/PostGIS) on mount and draw the authoritative Route.path polyline as the base layer so spectators see where runners are supposed to go, plus route name and total distanceM in the header.
- Subscribe to the route's Firebase RTDB live session node (e.g. /live/{routeId}/runners) and render one live marker per active runner, using the latest throttled lat/lng position fanned out by RTDB.
- For each active runner show identity (displayName + photoUrl/avatar from the User mirror, falling back to initials) attached to or tappable from their marker.
- Animate/interpolate each runner marker smoothly between received RTDB position updates rather than teleporting, since positions are throttled/batched (mind Spark free-tier bandwidth) and may arrive every few seconds.
- Maintain a live roster list (in a bottom sheet) of everyone currently active on the route, sorted by live progress along the route (e.g. distance covered / % of route) or by elapsed time; each row shows name, current live distance, elapsed time, and current/avg pace if present in the RTDB payload.
- Derive and display per-runner live stats from the RTDB payload: elapsed time (ticking from startedAt), distance so far, and current pace; the page must not recompute authoritative stats — it only mirrors what the recorder publishes.
- Tap a runner (marker or roster row) to focus/select them: center and follow that runner's marker, highlight their row, and optionally trace their live partial path if the recorder publishes a recent breadcrumb. Provide a clear way to deselect / stop following.
- Provide a 'follow' vs 'free pan' mode: while following a selected runner the map recenters on each update; if the user manually pans/zooms, automatically drop out of follow mode and show a 'recenter / resume following' button (thumb-reachable, bottom area).
- Provide a 'fit all' / 'show everyone' control that zooms the map to a bounding box containing the full route and all active runner markers.
- Reflect presence transitions in real time: when a runner goes offline (RTDB onDisconnect / presence flag flips, or stale heartbeat), visually mark them as 'paused/offline' (dimmed marker, greyed roster row) and, after they finish or their session is cleared/TTL-expires, remove them from the live view with a brief transition.
- Detect and handle stale data: if a runner's last update timestamp exceeds a freshness threshold (e.g. >30s) treat them as stale/possibly-disconnected even without an explicit offline flag, and surface this in their roster row.
- Handle the empty-but-valid case: route exists but nobody is currently live -> show an empty state ('No one is running this route right now') with the route still drawn on the map and a CTA to start recording on this route, plus a hint that the view updates automatically when someone goes live.
- This page is read-only/spectate: it MUST NOT start GPS recording, request location permission, acquire a Screen Wake Lock, or write the spectator's own position to RTDB. (It may optionally show the spectator's own location as a passive dot only if location is already granted from elsewhere; if not granted it must not prompt here.)
- Offer a primary action to transition into recording on this same route ('Run this route' / 'Record') that navigates to the Record flow pre-bound to :id; entering recording is what triggers permission prompts and wake lock, not this page.
- Reconnect gracefully: on network drop, show a non-blocking 'reconnecting…' indicator; when the RTDB connection (and the SDK's .info/connected) restores, resync the roster and marker positions to the current truth without requiring a manual refresh.
- Throttle inbound rendering work: coalesce rapid RTDB updates into animation frames so marker updates stay smooth and battery/CPU friendly on mobile, and detach/unsubscribe from RTDB listeners when the page is unmounted or backgrounded to conserve free-tier connections.
- Cap or virtualize the number of simultaneously rendered runners gracefully if many are live (free-tier concurrency is limited), e.g. render all markers but virtualize the roster list.
- Handle authorization/visibility: if the route is private and the spectator is not the owner or an accepted RouteMembership member, show an access-restricted state instead of the live view; public routes are spectatable by any signed-in user.
- Provide pull-to-refresh (or a manual refresh affordance) to hard-resync the route metadata and re-establish the RTDB subscription if the user suspects stale state.

**Data displayed**

- Route name, total distance (distanceM), and optionally an at-a-glance count of runners currently live
- Base route polyline (Route.path) rendered on the MapLibre map
- Per-runner live marker with avatar/initials and online/offline-paused styling
- Live roster list: each active runner's name, live distance covered, elapsed time, current/avg pace, and freshness/online status
- Selected/followed runner's live partial breadcrumb path (if the recorder publishes one)
- Connection status (live / reconnecting / offline) indicator
- Stale-data badge per runner when their last update exceeds the freshness threshold
- Empty state messaging when no one is live
- Optional passive 'you are here' dot only if device location is already available (never prompted here)

**Mobile interactions**

- Full-screen MapLibre map with standard one-finger pan and pinch-to-zoom; manual pan cancels follow mode
- Tap a runner marker to select and follow; tap empty map or a deselect control to release
- Bottom sheet roster: drag handle to expand/collapse (peek showing live count + top runner, expanded showing the full virtualized list); thumb-reachable
- Tap a roster row to focus that runner on the map (mirror of tapping the marker)
- Floating, thumb-reachable bottom controls: 'Recenter/Follow' and 'Fit all'; primary 'Run this route' CTA pinned within thumb reach
- Pull-to-refresh at the top of the roster sheet (or a refresh button) to hard-resync
- Smooth marker animation between throttled RTDB updates; non-blocking 'reconnecting…' toast/badge on connection loss

**States**

- _empty:_ Route loaded and drawn, but no runners are currently live -> 'No one is running this route right now' with a 'Run this route' CTA and a note that the view auto-updates when someone goes live.
- _loading:_ Skeleton/placeholder while route metadata loads from the backend and the initial RTDB snapshot is being fetched; map shows the route as soon as path is available, roster shows a spinner.
- _error:_ Route failed to load (network/backend) -> error message with Retry; if the RTDB subscription fails to attach, show a live-data error with Retry while still rendering the static route.
- _offline:_ Device offline -> show last-known roster/markers dimmed with a persistent 'You're offline — positions may be outdated' banner; auto-resync when connectivity and RTDB .info/connected return.
- _permissionDenied:_ Not applicable for core spectating (no permission is requested). If route is private and the user lacks owner/accepted-membership access, show an access-restricted state with a path back to Route Detail. (Any optional self-location dot is simply absent when location isn't already granted.)

**Permissions / services**

- Firebase Auth (signed-in user; ID token to read route + verify membership)
- Firebase Realtime Database (Spark free tier) — read-only subscription to the route's live session/presence node; mind 100 concurrent connections + bandwidth, so throttle/coalesce reads and unsubscribe on unmount
- Backend (NestJS + Prisma/PostGIS) — fetch Route.path, name, distance, and membership/visibility check
- MapLibre GL JS + OpenFreeMap tiles (no key now; self-host Protomaps later) for the base map
- Network connectivity (graceful reconnect handling)
- NO device geolocation permission and NO Screen Wake Lock are required or requested by this page

**PWA-now / Capacitor-later**

"This page is read-only and consumes RTDB, so the PWA-now vs Capacitor-later split is much lighter than on the Record page, but it still matters. PWA now: the RTDB subscription runs only while the page is open and foregrounded; the Firebase JS SDK web socket is suspended/closed when the browser tab is backgrounded or the screen sleeps, so live updates pause and must resync on resume (no background spectating). There is intentionally no Wake Lock here (we are not recording), so the screen will sleep normally and updates stop until the user returns. Marker fan-out depends entirely on what active recorders publish; a PWA recorder is foreground-only too, so a runner whose screen sleeps will stop emitting positions (appears stale/offline) until Capacitor's Android foreground service enables true screen-off background GPS. Capacitor later: spectating itself stays the same web RTDB read, but native push (FCM) can alert spectators that friends went live, and native lifecycle/visibility events give cleaner subscribe/unsubscribe and reconnect behavior; more importantly, recorders running under the Capacitor foreground service will keep emitting positions with the screen off, making the spectate view far more continuous. All live-data access stays behind the thin adapter interface (e.g. the RTDB/PushService adapters) so swapping web for native is minimal."
<parameter name="outOfScope">["3D / animated replay of runners' tracks (future phase)", "Recording the spectator's own GPS, computing their stats, or best-effort vs leaderboard (that lives on the Record/Activity pages)", "True screen-off background spectating or background GPS for recorders (arrives with Capacitor + Android foreground service)", "Push notifications that a friend went live (FCM, later with Capacitor)", "Spectator-to-runner messaging, cheering, or reactions", "LLM natural-language route suggestions and auto loop-by-distance route generation", "Persisting any live/ephemeral RTDB data as authoritative — final tracks are saved to Postgres by the recorder, not here"]

**Navigation**

- _Entry:_ Route Detail page (/routes/:id) via a 'Live' / 'Watch live' button, especially when the detail page indicates runners are currently active; Leaderboard or route list when a route shows a 'live now' indicator; Deep link / shared URL to /routes/:id/live; A notification or in-app prompt that friends are live on a route (FCM later, with Capacitor)
- _Exits:_ 'Run this route' / 'Record' -> Record flow bound to this route (/record or /routes/:id/record), which is where location permission + Screen Wake Lock are requested; Back -> Route Detail (/routes/:id); Tapping a runner's profile/avatar -> that user's profile (if in scope) or just in-page focus; Leaderboard for this route/segment (/routes/:id/leaderboard) to compare best times



---

## Activity Summary (Post-Run Save)

**Route:** `/record/summary`

The post-run checkpoint shown the moment a recording is stopped. It presents the recorded run (map trace, headline stats, per-km splits, optional elevation, and the leaderboard result if the run was on a route/segment) and forces an explicit decision: Save the activity to the backend or Discard it. Nothing is persisted to Postgres until the user saves here.

**Primary actions**

- Save activity (POST to backend, compute leaderboard result)
- Discard activity (with confirmation)
- Edit title / select activity type
- Refit/recenter map to trace
- Share summary card (after save)
- Continue to saved activity detail / back to feed (after save)

**Functional requirements**

- Receive the just-finished recording from the recorder (handed off in-memory via the recording store/state, NOT yet persisted): the ordered GPS sample array (lat/lng/elevation/recordedAt per point), elapsed durationS, accumulated distanceM, startedAt/endedAt, and any routeId/segmentId the run was started against. The page must render from this local draft even before any network call.
- Render the run as a polyline on a non-following, gesture-light MapLibre GL JS map auto-fit (fitBounds) to the trace with padding; show distinct start and finish markers. Map is a static-feeling preview here (recorder follow-mode is OFF), but allow pinch-zoom/drag to inspect; provide a 'recenter/refit' control to re-fit the bounds after the user pans.
- Show headline stats computed from the local draft: total distance (km, 2 decimals), elapsed time (h:mm:ss), and average pace (min/km), with moving vs elapsed clearly the same value for PoC (no auto-pause). Pace must be guarded against divide-by-zero when distance is ~0.
- Show per-kilometer splits: a list of each completed km with its split time and pace, plus a final partial-distance split labeled as partial. Splits are derived client-side from the sample timestamps and cumulative distance. If total distance < 1 km, show a single partial split and no per-km rows.
- Show elevation gain and an elevation profile chart when per-point elevation is available; if the device/browser provided no altitude (common on web GPS), hide or disable the elevation block and show a 'No elevation data' note rather than a fake chart.
- Provide an editable activity title field (prefilled with a sensible default like 'Morning Run' based on time-of-day) and an activity type selector (RUN / JOG / WALK) defaulting to RUN. These map to Activity.title and Activity.type on save.
- If the run was started on a route (routeId present), show the route name and the leaderboard result for that route's segment: the user's elapsed time on the segment, whether it is a new personal best, and their resulting rank vs other members. This result is computed by the BACKEND on save (PostGIS trace match against Segment.path with start/end gates); before save, show it as 'Pending — saves your effort to the leaderboard'.
- Handle the case where the run was a FREE run (no routeId): hide the leaderboard block entirely and show only stats/splits/map. Saving a free run creates an Activity with routeId = null and no LeaderboardEntry.
- Handle the case where the run WAS on a route but the trace did NOT match the segment (user diverged, too short, or never crossed the start/end gates): after save, show a clear 'No leaderboard result — your track did not complete this segment' message; the Activity still saves, just without a LeaderboardEntry.
- Primary action: Save. On tap, POST the activity to the NestJS backend via the PointUploader/api adapter: send the raw point array (with per-point lat/lng/elevation/recordedAt for PostGIS ActivityPoint + trace matching), durationS, startedAt/endedAt, title, type, and routeId (nullable). The backend derives Activity.track LineString, distanceM (ST_Length), avgPace, and runs segment matching → LeaderboardEntry. Show a saving spinner and disable Save/Discard while in flight.
- On successful save, surface the backend-computed result (final distance, PR/rank if applicable) and navigate forward to the saved Activity detail (/activity/:id) or back to the feed; the local recording draft is then cleared and the corresponding Firebase RTDB live session is cleared/TTL-released.
- On save failure (network/offline/5xx): keep the user on the summary, do NOT lose the draft, show a retry affordance, and offer to queue the save for retry (optimistic local cache) so the run is never lost. Make explicit that the run is unsaved until the POST succeeds.
- Secondary action: Discard. Require a confirmation dialog ('Discard this run? This can't be undone'). On confirm, drop the local draft, clear the RTDB live session, and navigate back to the recorder/feed. Discard must be reachable but visually subordinate to Save to prevent accidental data loss.
- Guard against accidental loss: intercept hardware/browser back and page-unload (beforeunload) while an unsaved draft exists, prompting Save or Discard rather than silently dropping the run.
- Handle a too-short / empty run (e.g., 0 or 1 GPS points, distance ~0, or duration below a minimum threshold): show a 'Not enough data to save' state that offers Discard and disables Save (or warns that distance is ~0), so junk activities are not persisted.
- Provide a share affordance (generate a shareable summary card / image of the run map + stats) AFTER a successful save; this is a convenience and must not block or precede saving. If the run is unsaved, share is hidden or disabled.
- Keep the Screen Wake Lock RELEASED on this page — recording has stopped, so the screen no longer needs to be forced awake; releasing it conserves battery while the user reviews and saves.
- Ensure all stat math and splits work from the local draft with zero network dependency, so the user can review (but not yet persist the server-derived results) even fully offline.

**Data displayed**

- Map preview of the recorded GPS trace with start and finish markers
- Editable activity title (default by time of day) and activity type (RUN/JOG/WALK)
- Total distance (km)
- Elapsed/total time (h:mm:ss)
- Average pace (min/km)
- Per-kilometer splits list (km index, split time, pace) plus a final partial split
- Elevation gain (m) and elevation profile chart (only when altitude data exists)
- Date/time of the run (startedAt)
- Route name (if run was on a route)
- Leaderboard result for the route's segment: segment elapsed time, new-PR badge, and rank among members (backend-computed on save; 'pending' before save)
- Save status indicators (saving / saved / failed / unsaved-draft)
- Unit labels (km, min/km, m)

**Mobile interactions**

- One-handed layout: Save as a large thumb-reachable primary button at the bottom; Discard subordinate (text/secondary) to avoid mis-taps
- Vertically scrollable summary with the map pinned/large at top and stats/splits/leaderboard stacked below; splits in a scannable list
- Map gestures: pinch-zoom and drag to inspect the trace, with a recenter/refit button; no follow-mode here
- Confirmation bottom sheet / dialog for Discard
- Inline editing of the title via tappable text field; type chosen via segmented control or chips
- Beforeunload / back-press interception when an unsaved draft exists
- Saving feedback via inline spinner and disabled controls; success confirmation (toast or result banner) before navigating away

**States**

- _empty:_ Run too short / no usable GPS points (0-1 points, distance ~0): show 'Not enough data to save', disable Save, offer Discard.
- _loading:_ Saving in progress: spinner on the Save button, Save/Discard disabled, stats remain visible from the local draft.
- _error:_ Save failed (network/5xx): inline error with Retry; draft preserved and optionally queued for later sync; run flagged as unsaved.
- _offline:_ Offline: stats/splits/map render fully from the local draft; Save queues the activity for retry when connectivity returns and clearly marks the run as not-yet-saved.
- _permissionDenied:_ Not applicable for save itself; if location was denied earlier the recorder would not have produced a draft. Share-to-OS may be unavailable on some browsers — fall back to a downloadable image.

**Permissions / services**

- Network / backend API (NestJS): POST /activities to persist Activity + ActivityPoint and trigger PostGIS segment matching
- Firebase Auth: ID token attached to the save request (verified by NestJS guard; User row keyed by Firebase uid)
- Firebase Realtime Database: clear/TTL-release the live tracking session for this run on save or discard
- MapLibre GL JS + OpenFreeMap tiles for the trace preview (network for tiles)
- PostGIS (backend): ST_Length for distance, ST_DWithin/ST_Intersects against Segment.path for leaderboard matching
- Web Share API / file download for the share card (browser-dependent)
- Screen Wake Lock: released here (no longer recording)

**PWA-now / Capacitor-later**

"This page consumes the recording produced upstream; the PWA-now vs Capacitor-later split mainly affects how the draft arrived. PWA NOW: recording was foreground-only (Screen Wake Lock kept the screen on), so the handed-off draft only covers time the page was foregrounded; web GPS often lacks altitude, so the elevation block may be empty and must degrade gracefully. The save path goes through the PointUploader/AuthService adapters using web implementations (fetch + Firebase web SDK). CAPACITOR LATER: with a native foreground service + true screen-off background GPS, drafts will be longer and denser and reliably carry altitude/accuracy; the same adapter interfaces (PointUploader, AuthService, PushService) get native implementations with no change to this page's logic, and a native share sheet replaces the Web Share fallback. The summary page itself stays device-agnostic — it operates on the abstract draft and the api adapter, so it is unchanged across the PWA→Capacitor transition. Wake Lock is released on this page in both modes."

**Out of scope (deferred)**

- 3D / animated route replay of the run
- LLM natural-language summaries or route suggestions
- Auto loop-by-distance generation
- Manual split/lap editing or auto-pause detection (PoC treats elapsed == moving time)
- Photo/media attachment upload to R2 from this page (media storage exists but attaching is out of scope for the PoC summary)
- Push notifications for new PRs (FCM arrives with Capacitor)
- Editing/cropping the GPS trace before saving

**Navigation**

- _Entry:_ From the Record/Recording screen (/record) when the user taps Stop — recording handed off as an in-memory draft
- _Exits:_ Saved Activity detail (/activity/:id) after a successful save; Activity feed / dashboard after save or after discard; Back to recorder (if save fails and user chooses to retry later, or after discard)



---

## Activity Detail

**Route:** `/activities/:id`

Read-only, scrollable detail view of one saved activity (a recorded run/jog/walk): a map of the recorded track, headline stats, per-kilometer splits, the elevation profile, and—when the run was on a route or matched a segment—the user's leaderboard placement. It is the destination after saving a recording and the tap target from the Activities list/feed.

**Primary actions**

- Back to Activities list
- Share activity (summary image/card)
- Open linked route detail
- Open segment/route leaderboard
- Edit title/type (owner)
- Delete activity (owner, with confirmation)

**Functional requirements**

- Load the activity by the :id route param via the activities feature data layer, resolving from an already-loaded list cache first and falling back to a single-activity fetch (GET /activities/:id) only when not cached, so navigating from the list renders instantly.
- Render the recorded track on a MapLibre GL JS map: draw Activity.track as a polyline, auto-fit/pad the camera to the track bounds on first render, and place distinct Start and Finish markers at the first/last ActivityPoint.
- If the activity has a linked routeId, fetch and overlay the planned Route.path beneath the recorded track (visually distinguished) so the user can compare where they ran vs the intended route; if routeId is null (free run) show only the recorded track and no route overlay.
- Display headline stats computed from persisted fields: total distance (Activity.distanceM, shown km with unit), elapsed/moving duration (Activity.durationS, formatted H:MM:SS or MM:SS), average pace (Activity.avgPaceSPerKm, formatted mm:ss /km), and elevation gain (Activity.elevationGainM); show activity title, type (RUN/JOG/WALK), and start date/time (Activity.startedAt) in the user's locale.
- Render a per-kilometer splits list derived from ActivityPoint timestamps + cumulative distance: each row shows the km index, split time, split pace, and a relative bar; the final partial split is labeled with its actual fractional distance. Splits must be computed/displayed from per-point data, not faked.
- Highlight the fastest split (and optionally slowest) in the splits list.
- Render an elevation profile chart from ActivityPoint.elevationM over cumulative distance (or from a cached elevation profile if present); show total gain. If no elevation samples exist, hide/disable the chart with a clear 'No elevation data' note rather than showing fake bars.
- Show leaderboard placement context when the activity matched a segment: for each LeaderboardEntry tied to this activity (or for the route's default full-route segment), display the segment name, the user's elapsed time on that segment, their current rank (e.g. '4th of 28'), and whether this activity set or beat their personal best (PR badge). Tapping it navigates to the segment/route leaderboard.
- If the activity is on a route but produced no qualifying segment match (e.g. partial coverage, GPS gaps, didn't pass start/finish gates within startBuffer/endBuffer), show an explanatory 'No leaderboard time for this run' state instead of an empty rank.
- Provide a Share action that generates a shareable summary image/card (map snapshot + key stats) of the activity.
- Provide an owner-only Delete action with a confirmation dialog; on confirm, delete the activity (and cascade its points), invalidate the activities list cache, and navigate back to the list. Non-owners (if the activity is ever viewed by an invited member) must not see Delete.
- Provide an Edit affordance for owner-editable fields at minimum the title and type; persist via update and reflect immediately. (Geometry/stats are not editable.)
- Handle the loading state with a skeleton/placeholder for map and stats while the activity resolves.
- Handle activity-not-found / 404 / deleted: show an 'Activity not found' state with a button back to the Activities list; do not get stuck on a spinner.
- Handle a fetch/network error distinctly from not-found: show an error message with a Retry action that refetches.
- Handle an activity that saved successfully but has an empty or single-point track (e.g. recording stopped immediately): show a 'No route recorded' placeholder in the map area and still render whatever stats exist; do not crash on track[0] access.
- Treat all geometry as read-only here—no point dragging, no re-snapping; map interactions are pan/zoom/inspect only. Editing geometry is a route-creation concern, not this page.
- Show ownership/source context: indicate the recording user (and their avatar/displayName) and, if linked, the route name as a tappable link to that route's detail.
- Do not depend on Firebase RTDB or any live session on this page; this is the durable post-run view sourced from Postgres/PostGIS. Any in-flight live session for this activity is already cleared at save time.

**Data displayed**

- Activity title, type (RUN/JOG/WALK), and start date/time (startedAt)
- Recorded GPS track (Activity.track) as a map polyline with Start/Finish markers
- Linked planned route overlay (Route.path) and route name, when routeId is set
- Total distance (distanceM, km), elapsed duration (durationS), average pace (avgPaceSPerKm, mm:ss/km), elevation gain (elevationGainM)
- Per-kilometer splits: km index, split time, split pace, relative bar, fastest-split highlight, final partial-split distance
- Elevation profile chart over distance, with total gain (from ActivityPoint.elevationM or cached profile)
- Leaderboard placement per matched segment: segment name, user's segment time, rank (Nth of M), PR/personal-best badge
- Recording user identity (displayName, photoUrl/avatar)

**Mobile interactions**

- Single-column vertical scroll with map pinned near the top and a stats/splits/leaderboard stack below, comfortably scrollable one-handed.
- Map gestures: pan and pinch-zoom to inspect the track; a 'recenter/fit track' control to re-fit bounds after panning. No drag-to-edit.
- Tap a leaderboard placement card to push to the leaderboard; tap the route name/chip to push to route detail.
- Thumb-reachable top bar with Back (left) and Share (right); destructive Delete placed in an overflow/menu or near the bottom to avoid accidental taps, and gated behind a confirmation sheet/dialog.
- Tapping a split row may scrub/highlight the corresponding portion on the map and elevation chart (nice-to-have).
- Pull-to-refresh near the top to refetch the activity and its leaderboard placement.
- Confirmation bottom sheet/dialog for Delete with explicit Cancel and Delete buttons.

**States**

- _empty:_ Activity saved with no/one track point: map area shows a 'No route recorded' placeholder; splits and elevation sections show 'No data' notes; headline stats still render from stored fields.
- _loading:_ Skeleton placeholders for the map block and stat tiles while the activity resolves from cache or the single-fetch returns; no flash of 'not found'.
- _error:_ Network/server fetch error: inline error message with a Retry button that refetches the activity (distinct from the not-found case).
- _permissionDenied:_ Delete/Edit affordances hidden for non-owners; if a backend authorization error occurs on a mutation, show a 'You can't modify this activity' message and revert optimistic UI.

**Permissions / services**

- Backend REST API (NestJS): GET /activities/:id, DELETE /activities/:id, PATCH for title/type edits
- Firebase Auth ID token attached to API requests (NestJS guard verifies uid; uid scopes ownership for edit/delete)
- PostgreSQL + PostGIS as the source of truth for track geometry, splits source points, elevation, and LeaderboardEntry/Segment rank data
- MapLibre GL JS for map rendering with OpenFreeMap tiles (no key) now; Protomaps PMTiles self-host later
- Network connectivity (read/refetch); no location permission, no GPS, and no Firebase RTDB needed on this page

**PWA-now / Capacitor-later**

"This is a durable read/display page, so the PWA-now vs Capacitor-later split is minimal. The one device-capability touchpoint is Share: behind the thin adapter, the PWA implementation uses the Web Share API (navigator.share) with a fallback to download/copy when unsupported (notably desktop browsers), while the Capacitor build swaps in the native share sheet. No LocationTracker/PointUploader involvement here—those belong to the recording/live pages. Map tiles and geometry rendering are identical across PWA and Capacitor."

**Out of scope (deferred)**

- 3D / animated replay of the run (future phase)
- LLM natural-language route suggestions
- Auto loop-by-distance route generation
- Social interactions (kudos/comments/likes) on the activity
- Editing or re-snapping the recorded track geometry (geometry is read-only here)
- Photos/media attached to the activity (R2 media is future)
- Live tracking / Firebase RTDB presence (not relevant to a saved activity)
- Manual segment creation or re-matching from this page (PostGIS trace matching runs at save time)

**Navigation**

- _Entry:_ Activities list / feed (tap an activity card → /activities/:id); Post-recording Save flow (after saving an activity, navigate to its detail); Deep link / shared link to /activities/:id; Route detail or leaderboard (tap a user's entry → that activity's detail)
- _Exits:_ Back to Activities list / feed; Linked Route detail (/routes/:routeId); Segment/Route leaderboard; Activities list after a successful Delete



---

## Profile

**Route:** `/profile`

The signed-in user's personal hub: shows their identity (Firebase-backed display name, avatar, email), lifetime aggregate totals, and tabbed lists of their own activities and routes (owned + memberships). Acts as the entry point to account settings and sign-out. Read-only for the user's own data except for editing basic profile fields and navigating into items.

**Primary actions**

- Switch between Activities and Routes tabs
- Tap an activity row to open activity detail
- Tap a route row to open route detail
- Accept or Decline a pending route invitation
- Edit display name
- Change / upload avatar photo (to R2)
- Open Settings
- Sign Out
- Pull to refresh
- Load more (infinite scroll)

**Functional requirements**

- Render the current authenticated user's profile from the backend User record (mirrored from Firebase uid): avatar (photoUrl, falling back to initials derived from displayName/email), displayName (fallback to email local-part if null), and email. Identity always reflects the verified Firebase token, never client-typed values.
- Show lifetime aggregate totals computed server-side over the user's Activity rows: total activities count, total distance (sum distanceM, displayed in km or mi per unit preference), total moving time (sum durationS, formatted H:MM:SS or Xh Ym), and total elevation gain (sum elevationGainM, meters/feet). Totals must be a dedicated aggregate endpoint, NOT computed by paginating the full activity list client-side.
- Provide a tabbed/segmented switch between 'Activities' and 'Routes' lists so both fit one-handed on a phone without a long scroll mixing types; remember the last-selected tab within the session.
- Activities tab: list the user's recorded activities (Activity where userId == me) newest-first by startedAt, each row showing title, type badge (RUN/JOG/WALK), date, distance, duration, and pace; tapping a row navigates to the activity detail page (/activity/:id).
- Activities list must merge locally-saved-but-not-yet-synced activities with server activities (the app records offline-first), de-duplicating by id and clearly flagging rows still pending upload so the user knows a run is saved locally even when the network is down.
- Routes tab: list routes the user owns (Route where ownerId == me) AND routes they are a member of (RouteMembership where userId == me and status == JOINED), each row showing route name, distance, elevation gain, an owner-vs-member indicator, and public/private indicator; tapping navigates to the route detail page.
- Surface pending route invitations (RouteMembership status == INVITED for me) as a distinct, prominent section or badge at the top of the Routes tab with Accept / Decline actions; accepting sets status=JOINED, declining sets DECLINED, both optimistically update the list and reconcile with the server response.
- Paginate or infinitely-scroll both lists (cursor/offset) since activity counts can grow large; load more as the user reaches the bottom, with a loading footer.
- Support pull-to-refresh on each list to re-fetch from the server and re-run the local/server merge; refreshing also re-fetches aggregate totals.
- Allow the user to edit a minimal subset of their own profile: displayName and avatar photo. Avatar upload goes to Cloudflare R2 and the returned URL is saved to User.photoUrl; show optimistic preview, upload progress, and rollback on failure. Email is read-only here (owned by Firebase Auth).
- Provide a clearly labeled entry to Settings (navigates to the settings page/section: units km/mi, default activity type, privacy defaults like default route visibility, account management).
- Provide a Sign Out action that signs out of Firebase Auth (AuthService adapter), clears cached user/profile/activity query data and any local unsynced-activity warning state appropriately, and routes back to the auth/login screen. Confirm before signing out if there are unsynced local activities, warning the user they remain on-device.
- Handle the not-authenticated edge case: if the Firebase session is missing/expired when the page loads (token refresh fails), redirect to the login screen rather than showing a broken profile.
- Handle the first-login / freshly-created User case: the User row is upserted on first authenticated request, so a brand-new user with no activities/routes must render valid zeroed totals and friendly empty states, not errors.
- All thumb-reachable primary controls (tab switch, sign out, settings entry, invite Accept/Decline) sit within comfortable bottom-half reach; the avatar/edit affordance can be higher since it is used less often.
- Respect the unit preference (km/mi, m/ft) consistently across totals and every list row; if preference is unset default to metric (meters-derived, matching the geography source-of-truth).

**Data displayed**

- Avatar image (User.photoUrl) or initials fallback
- Display name (User.displayName, fallback email local-part)
- Email (User.email, read-only)
- Aggregate totals: total activities count, total distance, total moving time, total elevation gain
- Activities list rows: title, type (RUN/JOG/WALK), startedAt date, distanceM, durationS, avgPaceSPerKm, pending-sync flag
- Routes list rows: route name, distanceM, elevationGainM, owner/member role, public/private (isPublic)
- Pending route invitations: route name, who invited (invitedById display), Accept/Decline actions
- Tab labels with counts (e.g. Activities (N), Routes (N))
- Settings entry label
- Sign Out action

**Mobile interactions**

- Pull-to-refresh gesture on each list to re-fetch and re-merge data and refresh totals
- Vertical scroll with infinite-scroll pagination; sticky tab switcher so the user can flip tabs without scrolling back to the top
- Tap segmented control to switch Activities/Routes tabs (thumb-reachable)
- Tap list rows (full-row tap target, generous min ~48px height) to navigate
- Inline Accept/Decline buttons on invitation cards with optimistic UI and undo-on-failure
- Tap avatar to open an edit bottom sheet (change photo / edit name) using the device photo picker via adapter; bottom sheet keeps actions in thumb reach
- Confirmation dialog (bottom sheet/modal) before Sign Out when unsynced local activities exist
- Loading skeletons for header/totals and list rows on first load; loading footer spinner while paginating

**States**

- _empty:_ New user with no activities: Activities tab shows a friendly empty state with a CTA to record a run (links to record page). No routes: Routes tab shows an empty state with a CTA to create a route. No pending invites: invitation section is hidden entirely. Totals render as zeros, not errors.
- _loading:_ Skeleton placeholders for avatar, name, the four totals tiles, and ~5 list rows while the profile, aggregate totals, and first list page load.
- _error:_ If profile or totals fetch fails, show an inline error with Retry; if a list fetch fails, show a per-list error row with Retry while keeping the rest of the page usable. Avatar upload failure shows a toast and rolls back the optimistic preview.
- _offline:_ Show an offline banner; the profile header and totals render from cached query data; the Activities list still shows locally-saved activities (including unsynced ones flagged 'pending upload'); Accept/Decline invite and avatar upload are disabled/queued with a message that they require a connection; pull-to-refresh shows an offline notice instead of spinning indefinitely.
- _permissionDenied:_ If the user denies photo-library/camera access during avatar change, show an inline message in the edit sheet explaining access is needed and offer to open app settings; the rest of the profile remains fully functional.

**Permissions / services**

- Firebase Auth (AuthService adapter) for current-user identity, token, and sign-out
- Backend NestJS API (Firebase ID token verified by guard) for User record, aggregate totals, activities list, routes/memberships list, and invite accept/decline
- Cloudflare R2 for avatar image upload/storage
- Device photo library / camera access (web file picker now; native picker via Capacitor later) for avatar change
- Network connectivity (for fetch, refresh, invite actions, and upload)
- Local cache / Redux store of unsynced activities for the offline-first merge

**PWA-now / Capacitor-later**

"This page does no GPS tracking, so the foreground-only-now constraint does not apply directly. Two adapter-mediated behaviors differ PWA-now vs Capacitor-later: (1) Avatar change uses the web file <input> / browser file picker now; the same flow swaps to the native camera/gallery picker behind the PhotoPicker/media adapter under Capacitor. (2) Sign-out and identity go through the AuthService adapter — web Firebase Auth SDK now, native Firebase Auth (and FCM token cleanup) later. Build the page against these adapter interfaces so no Profile UI logic changes when Capacitor is introduced. Push/FCM token registration tied to the account is deferred until Capacitor and is not wired here."

**Out of scope (deferred)**

- Follower/following social graph and the Followers/Following/Level/'Trail Blazer' badges shown in the current placeholder UI (no such tables in the data model; not in PoC scope)
- Viewing OTHER users' profiles (public profile pages) — this page is the signed-in user's own profile only
- 3D / animated activity replay from the profile
- LLM natural-language route suggestions and auto loop-by-distance route generation entry points
- Health-integration / external-device (gear) sections from the placeholder
- Push/FCM notification preferences (deferred until Capacitor)
- Editing email/password from this page (handled by Firebase Auth / dedicated account-management flow)
- Achievements/gamification badges beyond per-segment leaderboard standing (no badge entity in the model)

**Navigation**

- _Entry:_ Bottom tab bar 'Profile'/Account tab; Avatar or username tap from other screens (e.g. activity detail, feed) when viewing self; Redirect target after completing login (optional landing); Deep link /profile
- _Exits:_ /activity/:id (activity detail) from an activity row; Route detail page from a route row; Settings page/section from Settings entry; Login/auth screen after Sign Out or expired session; Avatar edit bottom sheet (in-page modal)



---

## Settings

**Route:** `/settings`

A single account-and-device control page where a signed-in user reviews and changes app-wide preferences (units, map/recording behavior), inspects the live status of every device permission/service the app depends on (location, screen wake lock, notifications, network), and manages their account (profile basics, sign-out, account deletion). It is the canonical place to diagnose "why isn't recording / live tracking working" by surfacing permission and capability state in one screen.

**Primary actions**

- Sign out
- Toggle units (Metric / Imperial)
- Set default activity type
- Request location permission (when state is 'prompt')
- Edit display name
- Change avatar
- Delete account (destructive, confirmed)
- Test GPS (one-shot fix, when location granted)
- Clear local data

**Functional requirements**

- AUTH GATE: Page requires an authenticated Firebase session. On load it reads the current user via the AuthService adapter; if there is no session it redirects to /signin (settings is account-scoped and has nothing to show signed-out).
- ACCOUNT IDENTITY BLOCK: Display the signed-in user's email (read-only, from the verified Firebase token), displayName, and avatar (photoUrl from Google or R2). These mirror the Postgres User row (id = Firebase uid). Show which sign-in provider is active (email/password vs Google) since it changes which account actions are available.
- EDIT DISPLAY NAME: User can tap displayName to edit it inline / in a bottom sheet. On save, PATCH the User row on the backend (Firebase guard verifies uid) and optimistically update the UI; on failure roll back and toast an error. Trim/validate non-empty, reasonable max length.
- EDIT AVATAR (basic): User can change avatar by picking an image; upload goes to Cloudflare R2 and the returned URL is saved to User.photoUrl. Show upload progress, allow cancel, and handle upload failure with retry. If the provider is Google and no custom avatar is set, fall back to the Google photoUrl. (Full photo cropping/editing is out of scope.)
- UNITS PREFERENCE: User can switch distance/pace units between Metric (km, min/km) and Imperial (mi, min/mi). This is a client-side display preference persisted locally (localStorage/IndexedDB) and applied app-wide (record screen, activity summary, leaderboards, route distance/elevation). Backend always stores SI meters/seconds; this toggle only changes formatting. Default to Metric. Changing it must immediately re-render dependent values without reload.
- ELEVATION UNITS follow the distance unit choice (meters vs feet) — no separate toggle needed for the PoC, but elevation labels must respect the selection.
- ACTIVITY TYPE DEFAULT: User can set a default activity type (RUN / JOG / WALK) used to pre-select the type when starting a new recording. Persisted locally. Matches the Activity.type enum.
- PERMISSIONS & DEVICE STATUS SECTION: Show a live, per-capability status list, each row reading current state from the corresponding adapter and offering a contextual action:
- - LOCATION: Query Permissions API (navigator.permissions 'geolocation') and show state granted / prompt (not yet asked) / denied / unavailable (no Geolocation API). If 'prompt', a button triggers the LocationTracker adapter's permission request (one-time geolocation call) and the row updates on resolution. If 'denied', show guidance that the browser blocked it and instructions to re-enable in browser site settings (the app cannot re-prompt once hard-denied) — no button that would silently fail. If granted, optionally show a 'Test GPS' action that gets one fix and reports accuracy, confirming the sensor works.
- - SCREEN WAKE LOCK (recording-critical): Detect support for the Screen Wake Lock API. Show Supported / Not supported. Explain that during PWA recording the screen is kept awake via this API and that if it is unsupported the screen may sleep and pause foreground GPS. This is a status indicator (no permission to grant); it sets expectations for the record page.
- - NOTIFICATIONS: For the PWA-now phase this row shows 'Coming soon' / disabled, since push (FCM) arrives only with the Capacitor shell. Optionally read Notification.permission to display current browser state, but do NOT wire up subscription yet. Make the deferred nature explicit.
- - NETWORK: Show online/offline status (navigator.onLine + online/offline events) because recording uploads (PointUploader) and live tracking (Firebase RTDB) need connectivity. When offline, explain that recordings are stored locally and synced when back online.
- - (Capacitor-later, shown as informational/disabled now) BACKGROUND LOCATION + PERSISTENT NOTIFICATION: indicate that true screen-off background GPS requires the native shell and is not available in the PWA; do not present a toggle that cannot work.
- PERMISSION STATE REACTIVITY: When the page regains focus / becomes visible (visibilitychange) or when a Permissions API 'change' event fires, re-query all statuses so a permission the user changed in browser settings is reflected without a manual reload.
- SIGN OUT: Primary account action. On tap, confirm (to avoid accidental loss of an in-progress unsaved recording), then call AuthService.signOut(); clear any cached auth/session and locally-held live-tracking handles, and redirect to /signin. If a recording is currently in progress (record page active / unsaved activity buffered locally), warn the user and offer to save or discard before signing out so GPS buffer isn't lost.
- ACCOUNT DELETION (data-rights): Provide a clearly separated, destructive 'Delete account' action behind a confirmation requiring explicit intent (type-to-confirm or re-auth). On confirm it calls the backend to cascade-delete the User row (Routes owned, Activities, ActivityPoints, RouteMemberships, LeaderboardEntries cascade per schema) and deletes the Firebase auth user; recent-login may be required so handle Firebase 'requires-recent-login' by re-authenticating first. Show progress and a final signed-out redirect.
- RE-AUTH HANDLING: Sensitive actions (delete account, change email if exposed) must gracefully handle Firebase requiring a fresh login — surface a re-auth prompt (password re-entry for email provider, Google re-consent for Google) rather than failing silently.
- APP/BUILD INFO: Show app version/build and an environment indicator, plus the API base URL in dev, useful for diagnosing the PoC. Provide a link to backend/connection health if trivially available.
- DATA RESET / CLEAR LOCAL CACHE: Provide a 'Clear local data' action that wipes locally-cached preferences and any locally-buffered-but-unsynced activities after warning the user that unsynced recordings will be lost. Useful while iterating on the PoC.
- LOADING STATE: While fetching the User row and probing permissions, show skeletons per section; permission probes are independent so render each row as it resolves rather than blocking the whole page.
- ERROR STATE: If the User profile fetch fails (network/backend down), still render the local-only sections (units, activity default, permission statuses) and show a non-blocking error banner with retry for the account block.
- OFFLINE BEHAVIOR: Units/default-type toggles work fully offline (local persistence). Display-name/avatar/account-deletion actions are disabled with an explanation when offline, since they need the backend; re-enable automatically when connectivity returns.
- PERSISTENCE & SYNC: Local preferences persist across reloads and survive the PWA being closed. (Server-side preference storage is out of scope for the PoC; note this so devices won't sync preferences until added.)
- ALL DEVICE-CAPABILITY ACCESS GOES THROUGH ADAPTERS: location status/request via LocationTracker adapter, notifications via PushService adapter (stubbed/disabled now), auth/sign-out/delete/re-auth via AuthService adapter, so the Capacitor swap changes only the adapter implementations, not this page.

**Data displayed**

- Account: email (read-only), displayName (editable), avatar/photoUrl, active sign-in provider (email or Google)
- Units preference: Metric (km, min/km, m) vs Imperial (mi, min/mi, ft)
- Default activity type: RUN / JOG / WALK
- Location permission state: granted / prompt / denied / unavailable
- Screen Wake Lock support: supported / not supported
- Notifications: deferred placeholder (and optionally raw Notification.permission for info)
- Network status: online / offline
- Background-location capability note (Capacitor-only, informational)
- App version / build number and environment (dev/prod), API base URL in dev
- Confirmation copy for sign-out and account deletion
- Optional GPS test result: last fix accuracy in meters

**Mobile interactions**

- Single-column vertically scrollable list of grouped sections (Account, Preferences, Permissions & Device, About, Danger zone) for natural one-handed scroll
- Toggles/segmented controls (units, default type) sized and placed for thumb reach on the right edge of each row
- Permission rows use a right-aligned status chip plus a contextual action button so the tappable target is in the thumb arc
- Editing display name opens a bottom sheet with the keyboard, Save/Cancel pinned above the keyboard; avatar change opens the system file/photo picker
- Destructive actions (Sign out, Delete account) use a confirmation bottom sheet / dialog; Delete account requires type-to-confirm or re-auth before the confirm button enables
- Pull-to-refresh (or returning focus to the tab) re-probes permission and network statuses
- Live status updates: rows update reactively on Permissions API 'change' and online/offline events without user action
- Toasts/snackbars for save success, save failure with retry, and upload progress for avatar

**States**

- _empty:_ No displayName/avatar yet: placeholder name derived from email and default avatar initial, with edit affordances visible.
- _loading:_ Per-section skeletons; account block from backend, permission/capability rows probe adapters independently and fill in as each resolves.
- _error:_ Account fetch failed: non-blocking error banner with Retry over the account block; local-only sections stay functional.
- _offline:_ Offline banner; local toggles still work; backend actions disabled with explanation; network row shows Offline; auto-recovers on reconnect.
- _permissionDenied:_ Location row shows Denied with guidance to re-enable in browser site settings; no in-app re-prompt button; auto-refreshes when the tab regains focus.

**Permissions / services**

- AuthService adapter -> Firebase Auth (current user, sign-out, delete user, re-authenticate)
- LocationTracker adapter -> Geolocation + Permissions API (status query, permission request, one-shot test fix)
- Screen Wake Lock API (capability detection only on this page)
- PushService adapter -> FCM (stubbed/disabled in PWA phase)
- Backend (NestJS, Firebase ID-token guard) -> read/update User row, account deletion cascade
- Cloudflare R2 -> avatar image upload
- navigator.onLine + online/offline events for network status
- localStorage/IndexedDB for client-side preference persistence (units, default activity type)

**PWA-now / Capacitor-later**

PWA NOW: Permission/capability rows reflect the web reality — location via the browser Geolocation + Permissions API (states granted/prompt/denied/unavailable; once hard-denied the app cannot re-prompt, only deep-link the user to browser site settings). Screen Wake Lock is shown as a support indicator only and is the mechanism that keeps the screen awake during foreground recording; recording is foreground-only. Notifications/push are deferred and shown disabled ('coming soon'). A 'background location / persistent notification' row is informational-only, explaining true screen-off background GPS is unavailable until the native shell. CAPACITOR LATER: the same rows are backed by native adapter implementations — location permission becomes the Android runtime permission flow (including 'while using' vs 'always'/background), the Notifications row activates real FCM push registration via PushService, a foreground-service / persistent-notification status appears and becomes the real mechanism for screen-off background GPS (replacing the Wake Lock note), and re-enable flows can deep-link into Android app settings. Because all access is funneled through the LocationTracker / PushService / AuthService adapters, only the adapter implementations change; this page's structure stays the same.

**Out of scope (deferred)**

- Notifications/push (FCM) wiring — deferred to the Capacitor phase; shown disabled now
- True screen-off background GPS and Android foreground-service controls — Capacitor-later
- Server-side / cross-device sync of preferences (units, default type are local-only for the PoC)
- Email/password change and password reset flows (only basic profile + provider display now)
- Privacy/visibility controls for activities and routes beyond Route.isPublic (no granular privacy settings page yet)
- Connected/third-party health integrations (e.g. Apple Health, Google Fit)
- Theming / appearance settings (visual design system is explicitly out of scope for these functional specs)
- Data export / download-my-data archive
- Language/locale selection
- Full avatar cropping/editing editor (only basic pick-and-upload now)

**Navigation**

- _Entry:_ From Profile screen 'Settings' row; From a top-bar/avatar menu 'Settings' item; Deep link / direct navigation to /settings; From a permission-denied prompt on the Record or Live Tracking page that links here to fix location access
- _Exits:_ Back to previous screen (Profile / app shell); Redirect to /signin after Sign out or Account deletion; Out to browser site-settings (instructional only) when location is hard-denied; To /signin for re-authentication when a sensitive action requires recent login
