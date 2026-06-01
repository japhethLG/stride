/**
 * Stats query keys + invalidation (CLAUDE.md §6.2).
 *
 * Stats are derived from activities, so the activities mutations are what change
 * them; this invalidator exists so callers (or a future stats mutation) can
 * refresh the summary by predicate over `STATS_PATHS`.
 */
import type { QueryClient } from "@tanstack/react-query";

export const STATS_PATHS = ["/api/stats/summary"] as const;

export function invalidateStats(qc: QueryClient): Promise<void> {
  return qc.invalidateQueries({
    predicate: (query) => {
      const path = query.queryKey[0];
      return (
        typeof path === "string" && (STATS_PATHS as readonly string[]).includes(path)
      );
    },
  });
}
