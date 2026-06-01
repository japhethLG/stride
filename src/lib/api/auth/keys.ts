/**
 * Auth (current-user profile) query keys + invalidation (CLAUDE.md §6.2).
 *
 * `AUTH_PATHS` lists every OpenAPI path that returns the current user's profile.
 * `invalidateAuth` does a PREDICATE match over those paths. Mutations call it in
 * `onSuccess`.
 */
import type { QueryClient } from "@tanstack/react-query";

export const AUTH_PATHS = ["/api/auth/me"] as const;

export function invalidateAuth(qc: QueryClient): Promise<void> {
  return qc.invalidateQueries({
    predicate: (query) => {
      const path = query.queryKey[0];
      return (
        typeof path === "string" && (AUTH_PATHS as readonly string[]).includes(path)
      );
    },
  });
}
