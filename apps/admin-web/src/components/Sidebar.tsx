"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "@/lib/nav";
import { useAuthStore } from "@/lib/auth-store";

export function Sidebar() {
  const pathname = usePathname();
  const staff = useAuthStore((s) => s.staff);
  const clear = useAuthStore((s) => s.clear);
  const hasPermission = useAuthStore((s) => s.hasPermission);

  const visibleItems = NAV_ITEMS.filter((item) => !item.permission || hasPermission(item.permission));

  return (
    <aside className="flex h-screen w-60 shrink-0 flex-col border-r border-border bg-surface">
      <div className="border-b border-border px-5 py-5">
        <p className="text-xs font-bold uppercase tracking-wide text-primary">Shri Anandam</p>
        <p className="text-sm font-semibold text-text">Admin</p>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {visibleItems.map((item) => {
          const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`mb-1 block rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isActive ? "bg-primary/10 text-primary" : "text-text-muted hover:bg-border/50 hover:text-text"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border px-4 py-4">
        <p className="truncate text-xs text-text-muted">{staff?.email}</p>
        <button onClick={() => void clear()} className="mt-2 text-sm font-semibold text-danger hover:underline">
          Sign out
        </button>
      </div>
    </aside>
  );
}
