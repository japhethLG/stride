/**
 * Routes query keys + invalidation (CLAUDE.md §6.2).
 *
 * `ROUTE_PATHS` lists every OpenAPI path template that returns Route data (the
 * list, a single route, its activities, and its convenience leaderboard).
 * `invalidateRoutes` does a PREDICATE match over those paths. Route mutations
 * (create/update/delete) call it in `onSuccess`.
 */
import type { QueryClient } from "@tanstack/react-query";

export const ROUTE_PATHS = [
  "/api/routes",
  "/api/routes/{id}",
  "/api/routes/{id}/activities",
  "/api/routes/{id}/leaderboard",
] as const;

export function invalidateRoutes(qc: QueryClient): Promise<void> {
  return qc.invalidateQueries({
    predicate: (query) => {
      const path = query.queryKey[0];
      return (
        typeof path === "string" &&
        (ROUTE_PATHS as readonly string[]).includes(path)
      );
    },
  });
}
