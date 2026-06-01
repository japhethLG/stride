/**
 * Routes entity hooks (CLAUDE.md §6).
 *
 * Lists/reads: `useRoutes({scope})`, `useRoute(id)`, `useRouteActivities(id)`,
 * `useRouteLeaderboard(id)`. Mutations: `useCreateRoute`, `useUpdateRoute`,
 * `useDeleteRoute` — each invalidates via `invalidateRoutes` in `onSuccess`.
 *
 * `useRoute`/`useRouteActivities`/`useRouteLeaderboard` are `enabled` only when an
 * id is present, so screens can call them before the param resolves.
 */
import { useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { useApiMutation, useApiQuery } from "@/lib/api/hooks";
import type { ApiError } from "@/lib/api/client";
import type {
  ActivityListResponseDto,
  LeaderboardResponseDto,
  RouteDetailResponseDto,
  RouteListResponseDto,
} from "@/lib/api/types";
import { invalidateRoutes } from "./keys";

export type RouteScope = "mine" | "member" | "public";

/** GET /api/routes?scope= — visible routes by scope (cursor-paginated). */
export function useRoutes(query?: {
  scope?: RouteScope;
  limit?: number;
  cursor?: string;
}): UseQueryResult<RouteListResponseDto, ApiError> {
  return useApiQuery("/api/routes", {
    params: { query },
  }) as UseQueryResult<RouteListResponseDto, ApiError>;
}

/** GET /api/routes/{id} — one route: geometry + segments + member count. */
export function useRoute(
  id: string | undefined,
): UseQueryResult<RouteDetailResponseDto, ApiError> {
  return useApiQuery(
    "/api/routes/{id}",
    { params: { path: { id: id ?? "" } } },
    { enabled: Boolean(id) },
  ) as UseQueryResult<RouteDetailResponseDto, ApiError>;
}

/** GET /api/routes/{id}/activities — activities recorded on a route. */
export function useRouteActivities(
  id: string | undefined,
  query?: { limit?: number; cursor?: string },
): UseQueryResult<ActivityListResponseDto, ApiError> {
  return useApiQuery(
    "/api/routes/{id}/activities",
    { params: { path: { id: id ?? "" }, query } },
    { enabled: Boolean(id) },
  ) as UseQueryResult<ActivityListResponseDto, ApiError>;
}

/** GET /api/routes/{id}/leaderboard — the route's default full-route leaderboard. */
export function useRouteLeaderboard(
  id: string | undefined,
  query?: { limit?: number; cursor?: string; period?: "all" | "month" | "week" },
): UseQueryResult<LeaderboardResponseDto, ApiError> {
  return useApiQuery(
    "/api/routes/{id}/leaderboard",
    { params: { path: { id: id ?? "" }, query } },
    { enabled: Boolean(id) },
  ) as UseQueryResult<LeaderboardResponseDto, ApiError>;
}

/** POST /api/routes — create a route from snapped GeoJSON. */
export function useCreateRoute() {
  const qc = useQueryClient();
  return useApiMutation("/api/routes", "post", {
    onSuccess: () => invalidateRoutes(qc),
  });
}

/** PATCH /api/routes/{id} — update name/description/visibility or geometry. */
export function useUpdateRoute() {
  const qc = useQueryClient();
  return useApiMutation("/api/routes/{id}", "patch", {
    onSuccess: () => invalidateRoutes(qc),
  });
}

/** DELETE /api/routes/{id} — delete a route (owner only; cascades). */
export function useDeleteRoute() {
  const qc = useQueryClient();
  return useApiMutation("/api/routes/{id}", "delete", {
    onSuccess: () => invalidateRoutes(qc),
  });
}
