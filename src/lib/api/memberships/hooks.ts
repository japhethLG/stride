/**
 * Memberships / invites entity hooks (CLAUDE.md §6).
 *
 * Route-side: `useRouteMembers(routeId)`, `useInviteMember(routeId)`,
 * `useRemoveMember(routeId)`. Invitee-side ("inbox"): `useInvites()`,
 * `useAcceptInvite()`, `useDeclineInvite()`. Mutations invalidate via
 * `invalidateMembers` in `onSuccess`.
 *
 * The route-scoped mutations capture `routeId` so call sites pass only the body /
 * the variable path id (e.g. `inviteMember.mutate({ body: { email } })`).
 */
import { useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { useApiMutation, useApiQuery } from "@/lib/api/hooks";
import type { ApiError } from "@/lib/api/client";
import type {
  InviteListResponseDto,
  MemberListResponseDto,
} from "@/lib/api/types";
import { invalidateMembers } from "./keys";

/** GET /api/routes/{id}/members — a route's members + status (owner/joined only). */
export function useRouteMembers(
  routeId: string | undefined,
): UseQueryResult<MemberListResponseDto, ApiError> {
  return useApiQuery(
    "/api/routes/{id}/members",
    { params: { path: { id: routeId ?? "" } } },
    { enabled: Boolean(routeId) },
  ) as UseQueryResult<MemberListResponseDto, ApiError>;
}

/**
 * POST /api/routes/{id}/invites — invite someone by email (owner only). The
 * `routeId` is bound here, so call sites pass only the body:
 * `inviteMember.mutate({ email })`.
 */
export function useInviteMember(routeId: string) {
  const qc = useQueryClient();
  const m = useApiMutation("/api/routes/{id}/invites", "post", {
    onSuccess: () => invalidateMembers(qc),
  });
  return {
    ...m,
    mutate: (body: { email: string }) =>
      m.mutate({ params: { path: { id: routeId } }, body }),
    mutateAsync: (body: { email: string }) =>
      m.mutateAsync({ params: { path: { id: routeId } }, body }),
  };
}

/**
 * DELETE /api/routes/{id}/members/{userId} — remove a member, or leave (self).
 * The `routeId` is bound here; call sites pass the target `userId`:
 * `removeMember.mutate({ userId })`.
 */
export function useRemoveMember(routeId: string) {
  const qc = useQueryClient();
  const m = useApiMutation("/api/routes/{id}/members/{userId}", "delete", {
    onSuccess: () => invalidateMembers(qc),
  });
  return {
    ...m,
    mutate: ({ userId }: { userId: string }) =>
      m.mutate({ params: { path: { id: routeId, userId } } }),
    mutateAsync: ({ userId }: { userId: string }) =>
      m.mutateAsync({ params: { path: { id: routeId, userId } } }),
  };
}

/** GET /api/invites — the current user's pending (INVITED) invites (inbox). */
export function useInvites(): UseQueryResult<InviteListResponseDto, ApiError> {
  return useApiQuery("/api/invites") as UseQueryResult<
    InviteListResponseDto,
    ApiError
  >;
}

/** POST /api/invites/{inviteId}/accept — accept an invite → JOINED. */
export function useAcceptInvite() {
  const qc = useQueryClient();
  return useApiMutation("/api/invites/{inviteId}/accept", "post", {
    onSuccess: () => invalidateMembers(qc),
  });
}

/** POST /api/invites/{inviteId}/decline — decline an invite → DECLINED. */
export function useDeclineInvite() {
  const qc = useQueryClient();
  return useApiMutation("/api/invites/{inviteId}/decline", "post", {
    onSuccess: () => invalidateMembers(qc),
  });
}
