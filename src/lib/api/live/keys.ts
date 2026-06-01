/**
 * Live session query keys + invalidation (CLAUDE.md §6.2).
 *
 * `LIVE_PATHS` is the read-through participants endpoint (the session POST returns
 * RTDB paths and has no cached read). Live positions come from Firebase RTDB,
 * which is NOT configured yet (TODO(CP6)) — the participants read tolerates an
 * empty/offline `{ enabled:false, participants:[] }`. `invalidateLive` refreshes
 * the participants read by predicate.
 */
import type { QueryClient } from "@tanstack/react-query";

export const LIVE_PATHS = ["/api/routes/{id}/live/participants"] as const;

export function invalidateLive(qc: QueryClient): Promise<void> {
  return qc.invalidateQueries({
    predicate: (query) => {
      const path = query.queryKey[0];
      return (
        typeof path === "string" && (LIVE_PATHS as readonly string[]).includes(path)
      );
    },
  });
}
