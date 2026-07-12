"use client";

import { RequireAuth } from "../../features/auth/RequireAuth";
import { DashboardView } from "../../features/dashboard/DashboardView";

export default function DashboardPage() {
  return (
    <RequireAuth>
      <DashboardView />
    </RequireAuth>
  );
}
