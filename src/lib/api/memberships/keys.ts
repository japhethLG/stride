/**
 * Memberships / invites query keys + invalidation (CLAUDE.md §6.2).
 *
 * `MEMBERSHIP_PATHS` lists every OpenAPI path that returns membership/invite data
 * — a route's member list and the current user's invite inbox. `invalidateMembers`
 * does a PREDICATE match over those paths. Invite/member mutations call it in
 * `onSuccess` (they also touch route member counts, but those refresh on their own
 * cadence).
 */
import type { QueryClient } from "@tanstack/react-query";

export const MEMBERSHIP_PATHS = [
  "/api/routes/{id}/members",
  "/api/invites",
] as const;

export function invalidateMembers(qc: QueryClient): Promise<void> {
  return qc.invalidateQueries({
    predicate: (query) => {
      const path = query.queryKey[0];
      return (
        typeof path === "string" &&
        (MEMBERSHIP_PATHS as readonly string[]).includes(path)
      );
    },
  });
}
