/**
 * Firebase client — lazy, env-guarded init (CLAUDE.md §11, plan §7.1).
 *
 * Today the dev-stub auth path is active (see adapters/web/auth.ts) and no
 * `VITE_FIREBASE_*` env is set, so Firebase is NEVER initialized. These accessors
 * exist so the real WebAuthService / RTDB live code can `getFirebaseAuth()` /
 * `getFirebaseDb()` later without any other file branching on "is Firebase
 * configured". They must not crash when env is absent — callers check
 * `isFirebaseConfigured()` first.
 */
import { initializeApp, type FirebaseApp, type FirebaseOptions } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getDatabase, type Database } from "firebase/database";

function readConfig(): FirebaseOptions | null {
  const env = import.meta.env;
  if (!env.VITE_FIREBASE_API_KEY || !env.VITE_FIREBASE_PROJECT_ID) return null;
  return {
    apiKey: env.VITE_FIREBASE_API_KEY,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: env.VITE_FIREBASE_APP_ID,
    databaseURL: env.VITE_FIREBASE_DATABASE_URL,
  };
}

let app: FirebaseApp | null = null;
let authInstance: Auth | null = null;
let dbInstance: Database | null = null;

/** True when the `VITE_FIREBASE_*` env is present — false in the dev-stub PoC. */
export function isFirebaseConfigured(): boolean {
  return readConfig() !== null;
}

function getApp(): FirebaseApp {
  const config = readConfig();
  if (!config) {
    throw new Error(
      "Firebase is not configured (VITE_FIREBASE_* env absent). " +
        "Guard calls with isFirebaseConfigured(); the dev-stub auth path is active.",
    );
  }
  if (!app) app = initializeApp(config);
  return app;
}

export function getFirebaseAuth(): Auth {
  if (!authInstance) authInstance = getAuth(getApp());
  return authInstance;
}

export function getFirebaseDb(): Database {
  if (!dbInstance) dbInstance = getDatabase(getApp());
  return dbInstance;
}
