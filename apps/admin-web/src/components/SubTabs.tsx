"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function SubTabs({ items }: { items: { href: string; label: string }[] }) {
  const pathname = usePathname();
  return (
    <div className="mb-6 flex gap-1 border-b border-border">
      {items.map((item) => {
        const isActive = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-semibold transition-colors ${
              isActive ? "border-primary text-primary" : "border-transparent text-text-muted hover:text-text"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}
