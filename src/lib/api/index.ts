/**
 * API layer barrel. Components import entity hooks from their entity folder
 * (e.g. `@/lib/api/activities`); these exports are the shared building blocks.
 */
export { apiClient, ApiError, API_BASE_URL, setUnauthorizedHandler } from "./client";
export { useApiQuery, useApiMutation } from "./hooks";
export type { paths, components } from "./schema";
