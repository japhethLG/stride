/**
 * Routing entity hooks (CLAUDE.md §6).
 *
 * `useSnapRoute()` POSTs a drawn polyline (`{ points:[{lat,lng}], profile? }`) and
 * returns `{ snapped, geometry, distanceM, reason? }`. The Create-route screen
 * calls this while the user draws. Stateless transform — nothing to invalidate.
 */
import { useApiMutation } from "@/lib/api/hooks";

/** POST /api/routing/snap — snap a drawn polyline to roads via GraphHopper. */
export function useSnapRoute() {
  return useApiMutation("/api/routing/snap", "post");
}
