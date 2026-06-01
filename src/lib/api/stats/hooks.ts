/**
 * Stats entity hooks (CLAUDE.md §6) — lifetime activity totals for the current
 * user (the Home/Profile summary cards).
 */
import type { UseQueryResult } from "@tanstack/react-query";
import { useApiQuery } from "@/lib/api/hooks";
import type { ApiError } from "@/lib/api/client";
import type { StatsSummaryResponseDto } from "@/lib/api/types";

/** GET /api/stats/summary — lifetime activity totals for the current user. */
export function useStatsSummary(): UseQueryResult<StatsSummaryResponseDto, ApiError> {
  return useApiQuery("/api/stats/summary") as UseQueryResult<
    StatsSummaryResponseDto,
    ApiError
  >;
}
