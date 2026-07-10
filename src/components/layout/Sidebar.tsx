"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Boxes,
  BarChart3,
  BookOpen,
  Settings,
} from "lucide-react";

const nav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/builder", label: "Box Builder", icon: Boxes },
  { href: "/analytics", label: "Analytics", icon: BarChart3, disabled: true },
  { href: "/knowledge", label: "Knowledge Base", icon: BookOpen, disabled: true },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-full w-[220px] shrink-0 flex-col border-r border-[var(--border)] bg-[var(--bg-elevated)]">
      <div className="flex items-center gap-2.5 px-5 py-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
          <Boxes size={16} />
        </div>
        <div>
          <div className="text-sm font-semibold tracking-tight">Box Studio</div>
          <div className="text-[11px] text-[var(--text-dim)]">CIAB Builder</div>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-1 px-3">
        {nav.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          if (item.disabled) {
            return (
              <span
                key={item.href}
                className="flex cursor-not-allowed items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm text-[var(--text-dim)]"
              >
                <Icon size={16} />
                {item.label}
              </span>
            );
          }
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm transition ${
                active
                  ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                  : "text-[var(--text-muted)] hover:bg-[var(--bg-soft)] hover:text-[var(--text)]"
              }`}
            >
              <Icon size={16} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-[var(--border)] p-3">
        <Link
          href="/settings"
          className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm text-[var(--text-muted)] hover:bg-[var(--bg-soft)] hover:text-[var(--text)]"
        >
          <Settings size={16} />
          Settings
        </Link>
      </div>
    </aside>
  );
}
