"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/auth-store";
import { TopBar } from "@/components/TopBar";
import { LoadingBlock } from "@/components/ui/Feedback";

/** Same client-guard rationale as apps/admin-web (ADR-020) — no server-visible signal of auth state exists to check, so this blocks on the silent-refresh attempt and redirects if it fails. */
export default function QueueLayout({ children }: { children: ReactNode }) {
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
    <div className="flex min-h-screen flex-col">
      <TopBar />
      <main className="flex-1 p-4">{children}</main>
    </div>
  );
}
