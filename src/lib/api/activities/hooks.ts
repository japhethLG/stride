/**
 * Activities entity hooks (CLAUDE.md §6) — the TEMPLATE every other entity folder
 * mirrors. Consumers do `import { useMyActivities } from "@/lib/api/activities"`.
 *
 * Naming (§6): `/me`-style self lists use the `My` prefix (`useMyActivities`);
 * a single resource by id is a bare hook (`useActivity`). Mutations invalidate via
 * `invalidateActivities` in `onSuccess`.
 */
import { useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { useApiMutation, useApiQuery } from "@/lib/api/hooks";
import type { ApiError } from "@/lib/api/client";
import type {
  ActivityListResponseDto,
  ActivityResponseDto,
} from "@/lib/api/types";
import { invalidateActivities } from "./keys";

/** GET /api/activities — the current user's activities (cursor-paginated). */
export function useMyActivities(query?: {
  limit?: number;
  cursor?: string;
  routeId?: string;
}): UseQueryResult<ActivityListResponseDto, ApiError> {
  return useApiQuery("/api/activities", {
    params: { query },
  }) as UseQueryResult<ActivityListResponseDto, ApiError>;
}

/**
 * POST /api/activities — upsert a finished activity (client id + track + stats).
 * Idempotent on the client-generated `id`; returns `bestEfforts`. Called by the
 * recording store on Stop. Invalidates the activity lists on success.
 */
export function useCreateActivity() {
  const qc = useQueryClient();
  return useApiMutation("/api/activities", "post", {
    onSuccess: () => invalidateActivities(qc),
  });
}

/** GET /api/activities/{id} — one activity. */
export function useActivity(
  id: string,
): UseQueryResult<ActivityResponseDto, ApiError> {
  return useApiQuery(
    "/api/activities/{id}",
    { params: { path: { id } } },
    { enabled: Boolean(id) },
  ) as UseQueryResult<ActivityResponseDto, ApiError>;
}

/** DELETE /api/activities/{id} — delete my activity. */
export function useDeleteActivity() {
  const qc = useQueryClient();
  return useApiMutation("/api/activities/{id}", "delete", {
    onSuccess: () => invalidateActivities(qc),
  });
}
