"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/auth-store";
import { Sidebar } from "@/components/Sidebar";
import { LoadingBlock } from "@/components/ui/Feedback";

/**
 * Route-group auth guard. Since the access token lives only in memory
 * (ADR-020), there's nothing a server-side check (middleware/proxy) could
 * inspect that would actually prove current auth state — the httpOnly
 * refresh cookie's mere presence doesn't confirm it's still valid without
 * the network round trip hydrate() already makes. So this is a client
 * guard: block on the silent-refresh attempt, then redirect if it came
 * back unauthenticated.
 */
export default function DashboardLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const isHydrated = useAuthStore((s) => s.isHydrated);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  useEffect(() => {
    void useAuthStore.getState().hydrate();
  }, []);

  useEffect(() => {
    if (isHydrated && !isAuthenticated) router.replace("/login");
  }, [isHydrated, isAuthenticated, router]);

  if (!isHydrated || !isAuthenticated) {
    return <LoadingBlock />;
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-8">{children}</main>
    </div>
  );
}
