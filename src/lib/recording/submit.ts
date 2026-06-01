/**
 * Bridge hook: wire the `useCreateActivity` entity mutation into the React-free
 * recording store (CLAUDE.md §6 / §12).
 *
 * The recording store's `stop()` POSTs `/api/activities` through an injected
 * submitter so the store itself never touches the apiClient. Mount this hook once
 * inside the Record flow (or app shell while recording) — it registers the
 * mutation's `mutateAsync` via `setSubmitActivity` and clears it on unmount.
 */
import { useEffect } from "react";
import { useCreateActivity } from "@/lib/api/activities";
import type { ActivityResponseDto } from "@/lib/api/types";
import { setSubmitActivity, type SubmitActivity } from "./store";

export function useRecordingSubmit(): void {
  const createActivity = useCreateActivity();
  useEffect(() => {
    const submit: SubmitActivity = (body) =>
      createActivity.mutateAsync({ body }) as Promise<ActivityResponseDto>;
    setSubmitActivity(submit);
    return () => setSubmitActivity(null);
  }, [createActivity]);
}
