/**
 * useApiQuery / useApiMutation — typed TanStack Query wrappers over the openapi-
 * fetch client (CLAUDE.md §6).
 *
 * - Query keys are ALWAYS `[path, init]` — `useApiQuery` builds them; never
 *   hand-write a key (§6.2). Entity `keys.ts` files invalidate by predicate over
 *   `<ENTITY>_PATHS`.
 * - Both throw `ApiError` (from client.ts) on non-2xx, so `error` in the result is
 *   a typed `ApiError`.
 *
 * Components do not call these directly either — they call an entity hook (e.g.
 * `useMyActivities`) that calls these. These are the building blocks for the
 * entity-folder hooks.
 */
import {
  useMutation,
  useQuery,
  type UseMutationOptions,
  type UseMutationResult,
  type UseQueryOptions,
  type UseQueryResult,
} from "@tanstack/react-query";
import type { paths } from "@/lib/api/schema";
import { apiClient, ApiError } from "@/lib/api/client";

/** Paths that support a given HTTP method. */
type PathsWith<M extends string> = {
  [P in keyof paths]: paths[P] extends Record<M, unknown> ? P : never;
}[keyof paths];

type GetPaths = PathsWith<"get">;

// openapi-fetch's per-call `init` carries `{ params, body }`. The generic wrapper
// erases the per-path narrowing, so init is the structured shape and the typed
// per-path checking lives in the entity hooks that call this.
type ApiInit = { params?: Record<string, unknown>; body?: unknown };

type ClientGet = typeof apiClient.GET;

/**
 * GET hook. Query key is ALWAYS `[path, init]` (§6.2) — never hand-write a key.
 * `init` carries `{ params, body }` per openapi-fetch.
 */
export function useApiQuery<P extends GetPaths>(
  path: P,
  init?: ApiInit,
  options?: Omit<UseQueryOptions<unknown, ApiError>, "queryKey" | "queryFn">,
): UseQueryResult<unknown, ApiError> {
  return useQuery<unknown, ApiError>({
    queryKey: [path, init ?? {}],
    queryFn: async () => {
      const { data, error } = await (apiClient.GET as ClientGet)(
        path as never,
        init as never,
      );
      if (error) throw error as ApiError;
      return data;
    },
    ...options,
  });
}

type MutMethod = "post" | "put" | "patch" | "delete";
type MutPaths<M extends MutMethod> = PathsWith<M>;

/**
 * Mutation hook. `variables` is the openapi-fetch `init` (`{ params, body }`).
 * Pass `onSuccess` to call `invalidate<Entity>(qc)` per §6.2.
 */
export function useApiMutation<M extends MutMethod, P extends MutPaths<M>>(
  path: P,
  method: M,
  options?: Omit<
    UseMutationOptions<unknown, ApiError, Record<string, unknown> | undefined>,
    "mutationFn"
  >,
): UseMutationResult<unknown, ApiError, Record<string, unknown> | undefined> {
  return useMutation<unknown, ApiError, Record<string, unknown> | undefined>({
    mutationFn: async (init) => {
      const fn = {
        post: apiClient.POST,
        put: apiClient.PUT,
        patch: apiClient.PATCH,
        delete: apiClient.DELETE,
      }[method] as ClientGet;
      const { data, error } = await fn(path as never, init as never);
      if (error) throw error as ApiError;
      return data;
    },
    ...options,
  });
}
