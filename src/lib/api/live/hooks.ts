/**
 * Live session entity hooks (CLAUDE.md §6).
 *
 * `useLiveSession(routeId)` is a mutation: POST joins the route's live session and
 * returns RTDB `{ rtdbPath, selfPath, presencePath, ttlSeconds, throttleMs,
 * maxParticipants }` (call it when entering the Live / Record-with-others flow,
 * then subscribe to RTDB directly). `routeId` is bound, so call sites do
 * `liveSession.mutate()`.
 *
 * `useLiveParticipants(routeId)` is the optional read-through of live participants.
 *
 * TODO(CP6): Firebase RTDB is not configured, so participant positions are
 * empty/offline (`enabled:false`, `participants:[]`). Both hooks return their full
 * structure and tolerate the no-positions state — screens render a "waiting" state.
 */
import { useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { useApiMutation, useApiQuery } from "@/lib/api/hooks";
import type { ApiError } from "@/lib/api/client";
import type {
  LiveParticipantsResponseDto,
  LiveSessionResponseDto,
} from "@/lib/api/types";
import { invalidateLive } from "./keys";

/**
 * POST /api/routes/{id}/live/session — join the live session and get RTDB paths +
 * throttle policy. `routeId` is bound; `mutate()` takes no args. Returns 429
 * `{ reason: "live_full" }` (a thrown `ApiError`) when the route is at capacity.
 */
export function useLiveSession(routeId: string) {
  const qc = useQueryClient();
  const m = useApiMutation("/api/routes/{id}/live/session", "post", {
    onSuccess: () => invalidateLive(qc),
  });
  return {
    ...m,
    mutate: () => m.mutate({ params: { path: { id: routeId } } }),
    mutateAsync: (): Promise<LiveSessionResponseDto> =>
      m.mutateAsync({
        params: { path: { id: routeId } },
      }) as Promise<LiveSessionResponseDto>,
  };
}

/**
 * GET /api/routes/{id}/live/participants — read-through of live participants.
 * Empty/offline when Firebase is not configured (TODO(CP6)). `enabled` only when a
 * routeId is present.
 */
export function useLiveParticipants(
  routeId: string | undefined,
): UseQueryResult<LiveParticipantsResponseDto, ApiError> {
  return useApiQuery(
    "/api/routes/{id}/live/participants",
    { params: { path: { id: routeId ?? "" } } },
    { enabled: Boolean(routeId) },
  ) as UseQueryResult<LiveParticipantsResponseDto, ApiError>;
}
