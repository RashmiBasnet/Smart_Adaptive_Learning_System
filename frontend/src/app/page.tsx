"use client";

// Root route: purely a redirect — to the dashboard when a session exists,
// otherwise to login.

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../providers/auth-provider";

export default function Home() {
  const { token, ready } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!ready) return;
    router.replace(token ? "/dashboard" : "/login");
  }, [ready, token, router]);

  return null;
}
