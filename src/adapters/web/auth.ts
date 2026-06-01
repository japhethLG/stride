/**
 * WebAuthService — DEV STUB (CLAUDE.md §11, plan §4.1).
 *
 * The PoC has no real Firebase project, so this fakes a signed-in user and mints
 * a dev-stub token in the backend's expected shape: `dev.<uid>.<email>`. The api
 * client middleware sends `Authorization: Bearer dev.<uid>.<email>`, which the
 * backend's dev-stub guard accepts and provisions a User from.
 *
 * The interface is exactly the real shape, so swapping in the Firebase JS SDK
 * later (guarded by isFirebaseConfigured()) is a localized change here — no
 * feature code or the api client changes. `signInWithGoogle` is the only method
 * that swaps natively under Capacitor.
 */
import type { AuthService, AuthUser } from "@/adapters/types";

const STORAGE_KEY = "stride.devAuth.user";

function makeUser(email: string): AuthUser {
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
  private user: AuthUser | null = loadPersisted();
  private listeners = new Set<(u: AuthUser | null) => void>();

  private set(user: AuthUser | null) {
    this.user = user;
    try {
      if (user) localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore storage failures (private mode etc.) */
    }
    for (const cb of this.listeners) cb(user);
  }

  async signInWithEmail(email: string, _password: string): Promise<AuthUser> {
    const user = makeUser(email);
    this.set(user);
    return user;
  }

  async signUpWithEmail(email: string, _password: string): Promise<AuthUser> {
    return this.signInWithEmail(email, _password);
  }

  async signInWithGoogle(): Promise<AuthUser> {
    const user = makeUser("dev.user@stride.run");
    this.set(user);
    return user;
  }

  async signOut(): Promise<void> {
    this.set(null);
  }

  current(): AuthUser | null {
    return this.user;
  }

  /**
   * Dev-stub token: `dev.<uid>.<email>` — matches the backend's dev auth guard.
   * The real impl will return `firebaseUser.getIdToken(forceRefresh)`.
   */
  async getIdToken(_forceRefresh = false): Promise<string | null> {
    if (!this.user) return null;
    return `dev.${this.user.uid}.${this.user.email ?? ""}`;
  }

  onAuthStateChanged(cb: (u: AuthUser | null) => void): () => void {
    this.listeners.add(cb);
    // Emit current state asynchronously so subscribers wire up consistently.
    queueMicrotask(() => cb(this.user));
    return () => {
      this.listeners.delete(cb);
    };
  }
}
