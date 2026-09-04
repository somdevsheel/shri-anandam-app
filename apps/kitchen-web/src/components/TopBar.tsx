"use client";

import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/auth-store";

export function TopBar() {
  const router = useRouter();
  const staff = useAuthStore((s) => s.staff);
  const clear = useAuthStore((s) => s.clear);

  const handleLogout = async () => {
    await clear();
    router.replace("/login");
  };

  return (
    <header className="flex items-center justify-between border-b-2 border-border bg-surface px-5 py-3">
      <div>
        <p className="text-sm font-bold uppercase tracking-wide text-primary">Shri Anandam</p>
        <p className="text-xl font-bold text-text">Kitchen Queue</p>
      </div>
      <div className="flex items-center gap-4">
        <p className="text-lg text-text-muted">{staff?.email}</p>
        <button onClick={() => void handleLogout()} className="rounded-lg border-2 border-border px-4 py-2 text-lg font-semibold text-text active:bg-border/50">
          Sign Out
        </button>
      </div>
    </header>
  );
}
