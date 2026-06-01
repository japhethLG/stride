/**
 * Leaderboard / segments query keys + invalidation (CLAUDE.md §6.2).
 *
 * `LEADERBOARD_PATHS` lists every OpenAPI path that returns segment leaderboard
 * data (the ranked board, the caller's own entry, and the route-convenience
 * board). Leaderboards change when activities are created, so the activities
 * invalidator is what normally refreshes them; `invalidateLeaderboard` is here for
 * explicit refresh by predicate.
 */
import type { QueryClient } from "@tanstack/react-query";

export const LEADERBOARD_PATHS = [
  "/api/segments/{segmentId}/leaderboard",
  "/api/segments/{segmentId}/leaderboard/me",
  "/api/routes/{id}/leaderboard",
] as const;

export function invalidateLeaderboard(qc: QueryClient): Promise<void> {
  return qc.invalidateQueries({
    predicate: (query) => {
      const path = query.queryKey[0];
      return (
        typeof path === "string" &&
        (LEADERBOARD_PATHS as readonly string[]).includes(path)
      );
    },
  });
}
