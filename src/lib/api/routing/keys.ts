/**
 * Routing query keys + invalidation (CLAUDE.md §6.2).
 *
 * `/api/routing/snap` is a pure stateless transform (drawn polyline → snapped
 * GeoJSON), so there is no cached read to invalidate. `ROUTING_PATHS` is kept for
 * symmetry with the other entity folders; `invalidateRouting` is a no-op-by-design
 * predicate invalidator.
 */
import type { QueryClient } from "@tanstack/react-query";

export const ROUTING_PATHS = ["/api/routing/snap"] as const;

export function invalidateRouting(qc: QueryClient): Promise<void> {
  return qc.invalidateQueries({
    predicate: (query) => {
      const path = query.queryKey[0];
      return (
        typeof path === "string" &&
        (ROUTING_PATHS as readonly string[]).includes(path)
      );
    },
  });
}
