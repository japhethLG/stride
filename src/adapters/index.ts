/**
 * Composition root (CLAUDE.md §4, plan §4.2).
 *
 * Picks web vs native impls ONCE, by platform detection. Nothing else in the app
 * branches on platform — feature code imports adapters from here (or the React
 * hooks below), never a `web/` or `native/` file directly.
 *
 * Today only web impls exist (PWA). At the Capacitor migration, `createAdapters`
 * gains a `Capacitor.isNativePlatform()` branch returning the `native/*` impls;
 * the AuthService stays the same instance (only its Google provider swaps).
 */
import type { Adapters, AuthService } from "@/adapters/types";
import { WebAuthService } from "@/adapters/web/auth";
import { WebLocationTracker } from "@/adapters/web/location";
import { WebPointUploader } from "@/adapters/web/uploader";
import { WebPushService } from "@/adapters/web/push";

let adapters: Adapters | null = null;

export function createAdapters(): Adapters {
  // const native = Capacitor.isNativePlatform();  // added with the Capacitor shell
  return {
    location: new WebLocationTracker(),
    uploader: new WebPointUploader(),
    auth: new WebAuthService(),
    push: new WebPushService(),
  };
}

/** The process-wide singleton adapter set (created lazily on first access). */
export function getAdapters(): Adapters {
  if (!adapters) adapters = createAdapters();
  return adapters;
}

/**
 * Direct accessor for the AuthService — used by the api client middleware, which
 * runs outside React and must not depend on the React context.
 */
export function getAuthService(): AuthService {
  return getAdapters().auth;
}

export type { Adapters } from "@/adapters/types";
