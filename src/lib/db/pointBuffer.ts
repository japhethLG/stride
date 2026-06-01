/**
 * IndexedDB point buffer (CLAUDE.md §12, plan §4.1 / §7.4).
 *
 * Durable recording buffer: survives reload/crash for upload-on-finish + crash
 * recovery. Batches are keyed by `(activityId, seq)` so re-flushes are idempotent.
 * The WebPointUploader is the only consumer; recording feature logic never touches
 * IndexedDB directly.
 */
import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { GeoPoint } from "@/adapters/types";

export interface PointBatch {
  /** auto-increment key */
  id?: number;
  activityId: string;
  /** monotonic batch counter within the activity */
  seq: number;
  points: GeoPoint[];
  createdAt: number;
}

interface StrideDB extends DBSchema {
  pointBatches: {
    key: number;
    value: PointBatch;
    indexes: { byActivity: string };
  };
}

const DB_NAME = "stride";
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<StrideDB>> | null = null;

function db(): Promise<IDBPDatabase<StrideDB>> {
  if (!dbPromise) {
    dbPromise = openDB<StrideDB>(DB_NAME, DB_VERSION, {
      upgrade(database) {
        const store = database.createObjectStore("pointBatches", {
          keyPath: "id",
          autoIncrement: true,
        });
        store.createIndex("byActivity", "activityId");
      },
    });
  }
  return dbPromise;
}

export async function addBatch(batch: Omit<PointBatch, "id">): Promise<void> {
  await (await db()).add("pointBatches", batch as PointBatch);
}

export async function getAllBatches(): Promise<PointBatch[]> {
  return (await db()).getAll("pointBatches");
}

export async function deleteBatch(id: number): Promise<void> {
  await (await db()).delete("pointBatches", id);
}

export async function countBatches(): Promise<number> {
  return (await db()).count("pointBatches");
}

export async function clearActivity(activityId: string): Promise<void> {
  const database = await db();
  const tx = database.transaction("pointBatches", "readwrite");
  const keys = await tx.store.index("byActivity").getAllKeys(activityId);
  await Promise.all(keys.map((k) => tx.store.delete(k)));
  await tx.done;
}
