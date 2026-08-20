"use client";

// Gate for authenticated pages: waits for the session restore, then redirects
// to /login if there is no token. Rendered client-side only — there is no
// middleware auth by design (pure client-side SPA against the Express API).

import { ReactNode, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../providers/auth-provider";

export function RequireAuth({ children }: { children: ReactNode }) {
  const { token, ready } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (ready && !token) router.replace("/login");
  }, [ready, token, router]);

  if (!ready || !token) return null;
  return <>{children}</>;
}
