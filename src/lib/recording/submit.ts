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
import { useEffect, useRef } from "react";
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

  // Keep the latest mutation/user behind refs so the bridges below can register
  // ONCE (stable `[]` deps) and still call the current versions. This is critical:
  // TanStack's `useMutation` returns a NEW object every render, so depending on it
  // re-ran these effects on every render — and the live cleanup calls `stopLive()`,
  // which would tear the live RTDB session down mid-run (no positions ever land).
  const createRef = useRef(createActivity);
  createRef.current = createActivity;
  const liveSessionRef = useRef(liveSession);
  liveSessionRef.current = liveSession;
  const userRef = useRef(auth.user);
  userRef.current = auth.user;

  // Activity submitter (POST /api/activities on stop()).
  useEffect(() => {
    const submit: SubmitActivity = (body) =>
      createRef.current.mutateAsync({ body }) as Promise<ActivityResponseDto>;
    setSubmitActivity(submit);
    return () => setSubmitActivity(null);
  }, []);

  // RTDB live controller (presence + throttled position overwrite on route runs).
  // Registered once; `stopLive()` runs only on real unmount (leaving the Record
  // flow), never on incidental re-renders during a run.
  useEffect(() => {
    if (!isFirebaseConfigured()) {
      setLiveController(null);
      return;
    }
    const controller: LiveController = {
      async start(routeId, activityId) {
        const user = userRef.current;
        if (!user) return null;
        // Join: authorize + ensure backend routeMembers index + get paths/throttle.
        const session = (await liveSessionRef.current.mutateAsync({
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
  }, []);
}
