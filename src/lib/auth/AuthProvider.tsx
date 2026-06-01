/**
 * AuthProvider + useAuth (CLAUDE.md §4.1 / §11).
 *
 * Consumes the AuthService adapter and exposes the current user + sign-in/out
 * actions to the app. It does NOT itself redirect — the <AuthGuard> (routes.tsx)
 * reads `useAuth()` and redirects to /login when signed out.
 *
 * Today the AuthService is the dev-stub WebAuthService; swapping to real Firebase
 * later changes nothing here.
 */
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useNavigate } from "react-router-dom";
import type { AuthUser } from "@/adapters/types";
import { getAuthService } from "@/adapters";
import { setUnauthorizedHandler } from "@/lib/api/client";

interface AuthContextValue {
  user: AuthUser | null;
  /** false until the first `onAuthStateChanged` emission resolves. */
  ready: boolean;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const auth = getAuthService();
  const [user, setUser] = useState<AuthUser | null>(auth.current());
  const [ready, setReady] = useState(false);
  const navigate = useNavigate();
  const signingOut = useRef(false);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged((u) => {
      setUser(u);
      setReady(true);
    });
    return unsub;
  }, [auth]);

  // On a 401 from the api client: sign out + route to /login (CLAUDE.md §11.4).
  useEffect(() => {
    setUnauthorizedHandler(() => {
      if (signingOut.current) return;
      signingOut.current = true;
      void auth.signOut().finally(() => {
        signingOut.current = false;
        navigate("/login", { replace: true });
      });
    });
    return () => setUnauthorizedHandler(null);
  }, [auth, navigate]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      ready,
      signInWithEmail: async (email, password) => {
        await auth.signInWithEmail(email, password);
      },
      signUpWithEmail: async (email, password) => {
        await auth.signUpWithEmail(email, password);
      },
      signInWithGoogle: async () => {
        await auth.signInWithGoogle();
      },
      signOut: async () => {
        await auth.signOut();
      },
    }),
    [auth, user, ready],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
