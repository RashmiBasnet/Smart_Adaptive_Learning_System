"use client";

// Auth context: holds the JWT + student in React state (memory), persisted to
// localStorage so a page refresh keeps the session. The token is pushed into
// the api client's module memory so every request carries it. A 401 from any
// API call clears the session and redirects to login.
//
// localStorage is read in an effect (not during render) because client
// components still server-render their first pass in Next — reading browser
// storage during render would cause a hydration mismatch.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { setAuthToken, setUnauthorizedHandler } from "../lib/api/client";
import type { AuthResult, PublicStudent } from "../lib/types/api";

const STORAGE_KEY = "sals-auth";

interface AuthState {
  student: PublicStudent | null;
  token: string | null;
  // false until localStorage has been checked — guards against a redirect
  // flash on refresh when a valid session actually exists.
  ready: boolean;
  signIn: (result: AuthResult) => void;
  signOut: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [student, setStudent] = useState<PublicStudent | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const signIn = useCallback((result: AuthResult) => {
    setAuthToken(result.token);
    setStudent(result.student);
    setToken(result.token);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(result));
  }, []);

  const signOut = useCallback(() => {
    setAuthToken(null);
    setStudent(null);
    setToken(null);
    localStorage.removeItem(STORAGE_KEY);
    router.push("/login");
  }, [router]);

  // Restore the session once on mount, then mark the provider ready.
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed: AuthResult = JSON.parse(stored);
        setAuthToken(parsed.token);
        setStudent(parsed.student);
        setToken(parsed.token);
      }
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
    setReady(true);
  }, []);

  // Any 401 means the token is invalid/expired: end the session.
  useEffect(() => {
    setUnauthorizedHandler(signOut);
    return () => setUnauthorizedHandler(null);
  }, [signOut]);

  return (
    <AuthContext.Provider value={{ student, token, ready, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
