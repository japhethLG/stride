/**
 * Auth entity hooks (CLAUDE.md §6) — the current user's profile row.
 *
 * `useMe` reads `GET /api/auth/me`; `useUpdateMe` PATCHes displayName/photoUrl and
 * invalidates the profile via `invalidateAuth` in `onSuccess`.
 *
 * NOTE: this is the server-side profile row, distinct from the `useAuth()`
 * identity from `@/lib/auth/AuthProvider` (the Firebase/dev-stub session).
 */
import { useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { useApiMutation, useApiQuery } from "@/lib/api/hooks";
import type { ApiError } from "@/lib/api/client";
import type { MeResponseDto } from "@/lib/api/types";
import { invalidateAuth } from "./keys";

/** GET /api/auth/me — the current user's profile (provisioned by the guard). */
export function useMe(): UseQueryResult<MeResponseDto, ApiError> {
  return useApiQuery("/api/auth/me") as UseQueryResult<MeResponseDto, ApiError>;
}

/** PATCH /api/auth/me — update displayName / photoUrl. */
export function useUpdateMe() {
  const qc = useQueryClient();
  return useApiMutation("/api/auth/me", "patch", {
    onSuccess: () => invalidateAuth(qc),
  });
}
