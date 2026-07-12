"use client";

// TanStack Query provider. One QueryClient per app instance; created lazily in
// state so it survives re-renders without being shared across requests during
// server rendering of the shell.

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactNode, useState } from "react";

export function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Dashboard data changes only when the student submits a quiz, and
            // submissions invalidate queries explicitly — no need to refetch
            // aggressively in the background.
            staleTime: 30_000,
            retry: 1,
          },
        },
      })
  );

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
