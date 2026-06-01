/**
 * Activities query keys + invalidation (CLAUDE.md §6.2).
 *
 * `ACTIVITY_PATHS` lists every OpenAPI path template that returns Activity data.
 * `invalidateActivities` does a PREDICATE match over those paths (preferred over
 * prefix matching — literal paths overlap). Mutations call it in `onSuccess`.
 */
import type { QueryClient } from "@tanstack/react-query";

export const ACTIVITY_PATHS = [
  "/api/activities",
  "/api/activities/{id}",
  "/api/routes/{id}/activities",
] as const;

export function invalidateActivities(qc: QueryClient): Promise<void> {
  return qc.invalidateQueries({
    predicate: (query) => {
      const path = query.queryKey[0];
      return (
        typeof path === "string" &&
        (ACTIVITY_PATHS as readonly string[]).includes(path)
      );
    },
  });
}
