# Stride

A Strava-style run/jog/activity tracker — **proof of concept**.

This repository is the **frontend**: a React **PWA** (Vite + MapLibre GL JS) architected to transition to a **Capacitor** Android shell later (for background GPS). The API reuses the existing `fitnessBackend` repo (NestJS + Prisma + Postgres/PostGIS + Firebase Auth).

## Core features (PoC scope) 

1. Create a route by dragging points on a map (snap-to-road).
2. Invite other users to a route.
3. Gamified leaderboards — rank best times per route (Strava-segment style).
4. Live multi-user tracking on a shared route (Firebase Realtime Database).
5. Activity recording — GPS track, stats, save.

**Deferred:** 3D/animated replay, LLM route suggestions, auto loop-by-distance generation, true screen-off background GPS (arrives with the Capacitor shell).

## Stack

| Layer | Choice |
|---|---|
| Frontend | React + Vite PWA → Capacitor later; MapLibre GL JS |
| Maps tiles | OpenFreeMap (→ self-hosted Protomaps PMTiles) |
| Routing | OpenRouteService API (→ self-hosted GraphHopper / Valhalla) |
| Backend | NestJS + Prisma (existing `fitnessBackend`) |
| Database | PostgreSQL + **PostGIS** |
| Auth | Firebase Auth |
| Realtime | Firebase Realtime Database |

## Docs

- [docs/tech-stack-research.md](docs/tech-stack-research.md) — service/platform research (PWA vs Capacitor vs native; free/self-host stack).
- [docs/implementation-plan.md](docs/implementation-plan.md) — implementation plan for the core features.
- [docs/ui-spec.md](docs/ui-spec.md) — per-page mobile UI functional spec.
