/**
 * Bridge hooks: wire the React-side entity mutations into the React-free
 * recording store (CLAUDE.md §6 / §12).
 *
 * The recording store's `stop()` POSTs `/api/activities` through an injected
 * submitter, and (CP6) its `start()` joins the RTDB live session through an
 * injected `LiveController` — so the store itself never touches the apiClient or
 * Firebase. Mount `useRecordingSubmit()` once inside the Record flow (or app
 * shell while recording); it registers both bridges and clears them on unmount.
 */
import { useEffect } from "react";
import { useApiMutation } from "@/lib/api/hooks";
import { useCreateActivity } from "@/lib/api/activities";
import { useAuth } from "@/lib/auth/AuthProvider";
import type { ActivityResponseDto, LiveSessionResponseDto } from "@/lib/api/types";
import { isFirebaseConfigured } from "@/lib/firebase/client";
import {
  startLive,
  stopLive,
  writeLivePosition,
  setLiveState,
} from "./live-writer";
import {
  setSubmitActivity,
  setLiveController,
  type SubmitActivity,
  type LiveController,
} from "./store";

export function useRecordingSubmit(): void {
  const createActivity = useCreateActivity();
  const auth = useAuth();
  // Unbound live-session mutation — routeId is supplied per start() call.
  const liveSession = useApiMutation("/api/routes/{id}/live/session", "post");

  // Activity submitter (POST /api/activities on stop()).
  useEffect(() => {
    const submit: SubmitActivity = (body) =>
      createActivity.mutateAsync({ body }) as Promise<ActivityResponseDto>;
    setSubmitActivity(submit);
    return () => setSubmitActivity(null);
  }, [createActivity]);

  // RTDB live controller (presence + throttled position overwrite on route runs).
  useEffect(() => {
    if (!isFirebaseConfigured()) {
      setLiveController(null);
      return;
    }
    const controller: LiveController = {
      async start(routeId, activityId) {
        const user = auth.user;
        if (!user) return null;
        // Join: authorize + ensure backend routeMembers index + get paths/throttle.
        const session = (await liveSession.mutateAsync({
          params: { path: { id: routeId } },
        })) as LiveSessionResponseDto;
        const started = await startLive(
          {
            selfPath: session.selfPath,
            presencePath: session.presencePath,
            throttleMs: session.throttleMs,
          },
          user,
        );
        if (!started) return null;
        // activityId is carried on each position write via the store's points.
        void activityId;
        return session.throttleMs ?? null;
      },
      write(p) {
        writeLivePosition(p);
      },
      setState(state) {
        setLiveState(state);
      },
      stop() {
        void stopLive();
      },
    };
    setLiveController(controller);
    return () => {
      setLiveController(null);
      void stopLive();
    };
    // auth.user identity is stable per session; re-bind if the mutation/user changes.
  }, [auth.user, liveSession]);
}
