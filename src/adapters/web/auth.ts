/**
 * WebAuthService — real Firebase (CP6) with a DEV-STUB fallback (CLAUDE.md §11, plan §4.1).
 *
 * BRANCHES on `isFirebaseConfigured()`:
 *  - Firebase env PRESENT  -> the Firebase Web SDK path: real email/password +
 *    Google sign-in, `onAuthStateChanged` driving the AuthProvider, and
 *    `getIdToken()` minting a REAL `Authorization: Bearer <idToken>` (auto-refreshed).
 *  - Firebase env ABSENT   -> the DEV STUB: fakes a signed-in user and mints a
 *    dev-stub token in the backend's expected shape `dev.<uid>.<email>`, which the
 *    backend's dev guard accepts.
 *
 * Either way the public interface (AuthService) is identical, so feature code and
 * the api client never branch. `signInWithGoogle` is the only method that swaps
 * natively under Capacitor later.
 */
import type { AuthService, AuthUser } from "@/adapters/types";
import { isFirebaseConfigured, getFirebaseAuth } from "@/lib/firebase/client";
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  onAuthStateChanged as fbOnAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as fbSignOut,
  updateProfile,
  type User as FirebaseUser,
} from "firebase/auth";

const STORAGE_KEY = "stride.devAuth.user";

/** Map a Firebase user to the app's AuthUser shape. */
function fromFirebase(u: FirebaseUser): AuthUser {
  return {
    uid: u.uid,
    email: u.email,
    displayName: u.displayName,
    photoUrl: u.photoURL,
    emailVerified: u.emailVerified,
  };
}

// --- dev-stub helpers (used only when Firebase env is absent) ---------------

function makeStubUser(email: string): AuthUser {
  // Stable uid derived from the email so the same dev user maps to the same
  // backend User row across reloads.
  const uid = "dev_" + btoa(email).replace(/[^a-zA-Z0-9]/g, "").slice(0, 24).toLowerCase();
  return {
    uid,
    email,
    displayName: email.split("@")[0] ?? null,
    photoUrl: null,
    emailVerified: true,
  };
}

function loadPersisted(): AuthUser | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

export class WebAuthService implements AuthService {
  /** True when the Firebase env is present — the real SDK path is active. */
  private readonly real = isFirebaseConfigured();

  // --- dev-stub state (only used when !real) ---
  private user: AuthUser | null = this.real ? null : loadPersisted();
  private listeners = new Set<(u: AuthUser | null) => void>();

  // --- real-path state (only used when real) ---
  private fbUser: FirebaseUser | null = null;

  private setStub(user: AuthUser | null) {
    this.user = user;
    try {
      if (user) localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore storage failures (private mode etc.) */
    }
    for (const cb of this.listeners) cb(user);
  }

  async signInWithEmail(email: string, password: string): Promise<AuthUser> {
    if (!this.real) {
      const user = makeStubUser(email);
      this.setStub(user);
      return user;
    }
    const cred = await signInWithEmailAndPassword(getFirebaseAuth(), email, password);
    return fromFirebase(cred.user);
  }

  async signUpWithEmail(email: string, password: string): Promise<AuthUser> {
    if (!this.real) {
      const user = makeStubUser(email);
      this.setStub(user);
      return user;
    }
    const cred = await createUserWithEmailAndPassword(getFirebaseAuth(), email, password);
    // Derive a friendly default display name from the email local-part.
    const displayName = email.split("@")[0] ?? null;
    if (displayName && !cred.user.displayName) {
      await updateProfile(cred.user, { displayName });
    }
    return fromFirebase(cred.user);
  }

  async signInWithGoogle(): Promise<AuthUser> {
    if (!this.real) {
      const user = makeStubUser("dev.user@stride.run");
      this.setStub(user);
      return user;
    }
    const provider = new GoogleAuthProvider();
    const cred = await signInWithPopup(getFirebaseAuth(), provider);
    return fromFirebase(cred.user);
  }

  async signOut(): Promise<void> {
    if (!this.real) {
      this.setStub(null);
      return;
    }
    await fbSignOut(getFirebaseAuth());
  }

  current(): AuthUser | null {
    if (!this.real) return this.user;
    return this.fbUser ? fromFirebase(this.fbUser) : null;
  }

  /**
   * Real path: `currentUser.getIdToken(forceRefresh)` (auto-refreshes the JWT the
   * NestJS guard verifies). Dev-stub: `dev.<uid>.<email>` for the backend dev guard.
   */
  async getIdToken(forceRefresh = false): Promise<string | null> {
    if (!this.real) {
      if (!this.user) return null;
      return `dev.${this.user.uid}.${this.user.email ?? ""}`;
    }
    const current = getFirebaseAuth().currentUser;
    if (!current) return null;
    return current.getIdToken(forceRefresh);
  }

  onAuthStateChanged(cb: (u: AuthUser | null) => void): () => void {
    if (!this.real) {
      this.listeners.add(cb);
      // Emit current state asynchronously so subscribers wire up consistently.
      queueMicrotask(() => cb(this.user));
      return () => {
        this.listeners.delete(cb);
      };
    }
    return fbOnAuthStateChanged(getFirebaseAuth(), (u) => {
      this.fbUser = u;
      cb(u ? fromFirebase(u) : null);
    });
  }
}
