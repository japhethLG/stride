/**
 * RTDB live subscription (CP6, plan §5.5 / §7.6).
 *
 * `useLiveRunners(routeId)` subscribes (`onValue`) to BOTH `liveSessions/<routeId>`
 * (positions) and `presence/<routeId>` (who is live), merges them into one runner
 * record per user, and filters stale/offline runners (`online === false` or
 * `lastSeen` older than ~30 s). It cleans up both listeners on unmount / routeId
 * change.
 *
 * GATED on `isFirebaseConfigured()` — when Firebase env is absent the hook is a
 * no-op returning `{ enabled:false, runners:[] }`, and screens fall back to the
 * REST `useLiveParticipants` empty/"waiting" state (the dev-stub path).
 *
 * Shape mirrors `LiveParticipantResponseDto` so the Live/Record pages render the
 * same marker + roster code whether positions come from RTDB or the REST read.
 */
import { useEffect, useState } from "react";
import { ref, onValue } from "firebase/database";
import { isFirebaseConfigured, getFirebaseDb } from "@/lib/firebase/client";
import type { LiveParticipantResponseDto } from "@/lib/api/types";

/** A merged live runner — positions (liveSessions) + presence, keyed by uid. */
export type LiveRunner = LiveParticipantResponseDto;

/** Drop runners whose last position/presence is older than this (ms). */
const STALE_MS = 30_000;

interface PresenceNode {
  displayName?: string | null;
  photoUrl?: string | null;
  state?: string;
  startedAt?: number;
  lastSeen?: number;
  online?: boolean;
}

interface PositionNode {
  lat?: number;
  lng?: number;
  ts?: number;
  ele?: number;
  speed?: number;
  seq?: number;
}

export interface UseLiveRunnersResult {
  /** True only when Firebase is configured (the real RTDB subscription is live). */
  enabled: boolean;
  runners: LiveRunner[];
}

export function useLiveRunners(routeId: string | undefined): UseLiveRunnersResult {
  const configured = isFirebaseConfigured();
  const [positions, setPositions] = useState<Record<string, PositionNode>>({});
  const [presence, setPresence] = useState<Record<string, PresenceNode>>({});
  // Re-render every ~10s so the stale filter prunes runners that went quiet.
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!configured || !routeId) {
      setPositions({});
      setPresence({});
      return;
    }
    const db = getFirebaseDb();
    const unsubPos = onValue(ref(db, `liveSessions/${routeId}`), (snap) => {
      setPositions((snap.val() as Record<string, PositionNode> | null) ?? {});
    });
    const unsubPres = onValue(ref(db, `presence/${routeId}`), (snap) => {
      setPresence((snap.val() as Record<string, PresenceNode> | null) ?? {});
    });
    const interval = window.setInterval(() => setTick((t) => t + 1), 10_000);
    return () => {
      unsubPos();
      unsubPres();
      window.clearInterval(interval);
    };
  }, [configured, routeId]);

  if (!configured || !routeId) return { enabled: false, runners: [] };

  const now = Date.now();
  const uids = new Set([...Object.keys(presence), ...Object.keys(positions)]);
  const runners: LiveRunner[] = [];
  for (const uid of uids) {
    const pr = presence[uid] ?? {};
    const po = positions[uid];
    const lastSeen = pr.lastSeen ?? po?.ts ?? null;
    const online = pr.online === true && lastSeen != null && now - lastSeen <= STALE_MS;
    // Skip runners that are offline AND have no recent position to show.
    if (!online && (lastSeen == null || now - lastSeen > STALE_MS)) continue;
    runners.push({
      userId: uid,
      displayName: pr.displayName ?? null,
      photoUrl: pr.photoUrl ?? null,
      state: pr.state ?? "running",
      online,
      lat: po?.lat ?? null,
      lng: po?.lng ?? null,
      lastSeen,
    });
  }

  return { enabled: true, runners };
}
