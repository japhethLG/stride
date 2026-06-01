/**
 * Leaderboard / segments entity hooks (CLAUDE.md §6).
 *
 * `useSegmentLeaderboard(segmentId, {period})` reads the ranked board;
 * `useMySegmentRank(segmentId, {period})` reads the caller's own best effort + rank
 * (surfaced even when off the current page). Both are `enabled` only when a
 * segmentId is present.
 *
 * BigInt fields (`elapsedMs`) arrive as STRINGS — parse before doing math.
 */
import type { UseQueryResult } from "@tanstack/react-query";
import { useApiQuery } from "@/lib/api/hooks";
import type { ApiError } from "@/lib/api/client";
import type {
  LeaderboardResponseDto,
  MyLeaderboardEntryResponseDto,
} from "@/lib/api/types";

export type LeaderboardPeriod = "all" | "month" | "week";

/** GET /api/segments/{segmentId}/leaderboard — ranked best efforts (paginated). */
export function useSegmentLeaderboard(
  segmentId: string | undefined,
  query?: { period?: LeaderboardPeriod; limit?: number; cursor?: string },
): UseQueryResult<LeaderboardResponseDto, ApiError> {
  return useApiQuery(
    "/api/segments/{segmentId}/leaderboard",
    { params: { path: { segmentId: segmentId ?? "" }, query } },
    { enabled: Boolean(segmentId) },
  ) as UseQueryResult<LeaderboardResponseDto, ApiError>;
}

/** GET /api/segments/{segmentId}/leaderboard/me — my best effort + rank. */
export function useMySegmentRank(
  segmentId: string | undefined,
  query?: { period?: LeaderboardPeriod },
): UseQueryResult<MyLeaderboardEntryResponseDto, ApiError> {
  return useApiQuery(
    "/api/segments/{segmentId}/leaderboard/me",
    { params: { path: { segmentId: segmentId ?? "" }, query } },
    { enabled: Boolean(segmentId) },
  ) as UseQueryResult<MyLeaderboardEntryResponseDto, ApiError>;
}
