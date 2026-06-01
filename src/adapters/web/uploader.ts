/**
 * WebPointUploader (CLAUDE.md §4 / §12, plan §4.1 / §7.4).
 *
 * Buffers points to IndexedDB first (durable across reload/crash), then flushes.
 *
 * Upload model: `POST /api/activities` is an upsert-on-finish keyed by the
 * client-generated `activityId` (plan §6/§7.4) — there is no per-batch ingest
 * endpoint. So the uploader's job is the DURABLE BUFFER + crash-recovery surface;
 * the recording store assembles the full buffered track and POSTs it on Stop via
 * the activities entity hook. `flush()` here reports buffer state (and is where a
 * future incremental-ingest endpoint would hook in). CP5 fleshes out the
 * recover-unfinished-activity path; the buffer + idempotent `(activityId, seq)`
 * keying are in place now.
 */
import type { GeoPoint, PointUploader } from "@/adapters/types";
import { addBatch, countBatches, clearActivity } from "@/lib/db/pointBuffer";

export class WebPointUploader implements PointUploader {
  private seqByActivity = new Map<string, number>();
  private autoFlushTimer: ReturnType<typeof setInterval> | null = null;

  async enqueue(activityId: string, points: GeoPoint[]): Promise<void> {
    if (points.length === 0) return;
    const seq = (this.seqByActivity.get(activityId) ?? -1) + 1;
    this.seqByActivity.set(activityId, seq);
    await addBatch({ activityId, seq, points, createdAt: Date.now() });
  }

  async flush(): Promise<{ uploaded: number; pending: number }> {
    // No incremental ingest endpoint in the PoC backend — durability is the
    // IndexedDB buffer + the upsert POST on Stop. Report current buffer state.
    const pending = await countBatches();
    return { uploaded: 0, pending };
  }

  startAutoFlush(intervalMs: number): void {
    this.stopAutoFlush();
    this.autoFlushTimer = setInterval(() => {
      void this.flush();
    }, intervalMs);
  }

  stopAutoFlush(): void {
    if (this.autoFlushTimer != null) {
      clearInterval(this.autoFlushTimer);
      this.autoFlushTimer = null;
    }
  }

  async pendingCount(): Promise<number> {
    return countBatches();
  }

  /** Drop a finished/uploaded activity's buffered batches. */
  async clear(activityId: string): Promise<void> {
    this.seqByActivity.delete(activityId);
    await clearActivity(activityId);
  }
}
