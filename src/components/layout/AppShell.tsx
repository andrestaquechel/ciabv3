"use client";

import { Sidebar } from "@/components/layout/Sidebar";
import { useShell } from "@/components/layout/ShellContext";
import { PanelLeft } from "lucide-react";

export function AppShell({
  children,
  topBar,
}: {
  children: React.ReactNode;
  topBar?: React.ReactNode;
}) {
  const { sidebarHidden, toggleSidebar } = useShell();

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--bg)]">
      {!sidebarHidden && <Sidebar />}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-9 shrink-0 items-center border-b border-[var(--border)] px-3">
          <button
            type="button"
            onClick={toggleSidebar}
            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-[var(--text-muted)] hover:bg-[var(--bg-soft)] hover:text-[var(--text)]"
            title={sidebarHidden ? "Show sidebar" : "Hide sidebar"}
          >
            <PanelLeft size={14} />
            {sidebarHidden ? "Show sidebar" : "Hide sidebar"}
          </button>
        </div>
        {topBar}
        <main className="min-h-0 flex-1 overflow-hidden">{children}</main>
      </div>
    </div>
  );
}
