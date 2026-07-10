"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signIn, useSession } from "next-auth/react";
import {
  LayoutDashboard,
  Boxes,
  BarChart3,
  BookOpen,
  Settings,
  PanelLeftClose,
} from "lucide-react";
import { useShell } from "@/components/layout/ShellContext";

const nav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/builder", label: "Box Builder", icon: Boxes },
  { href: "/analytics", label: "Analytics", icon: BarChart3, disabled: true },
  { href: "/knowledge", label: "Knowledge Base", icon: BookOpen },
];

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const { toggleSidebar } = useShell();

  return (
    <aside className="flex h-full w-[220px] shrink-0 flex-col border-r border-[var(--border)] bg-[var(--bg-elevated)]">
      <div className="flex items-center justify-between gap-2 px-4 py-4">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
            <Boxes size={16} />
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold tracking-tight">
              Box Studio
            </div>
            <div className="text-[11px] text-[var(--text-dim)]">CIAB Builder</div>
          </div>
        </div>
        <button
          type="button"
          onClick={toggleSidebar}
          className="rounded-lg p-1.5 text-[var(--text-dim)] hover:bg-[var(--bg-soft)] hover:text-[var(--text)]"
          title="Hide sidebar"
        >
          <PanelLeftClose size={14} />
        </button>
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
        {session?.user ? (
          <div className="mb-2 truncate px-3 text-xs text-[var(--text-dim)]">
            {session.user.email}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => signIn("google", { callbackUrl: "/knowledge" })}
            className="mb-1 w-full rounded-xl bg-[var(--accent-soft)] px-3 py-2 text-left text-xs text-[var(--accent)]"
          >
            Connect Google
          </button>
        )}
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
