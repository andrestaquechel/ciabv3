"use client";

import { createContext, useContext, useEffect, useState } from "react";

type ShellContextValue = {
  sidebarHidden: boolean;
  toggleSidebar: () => void;
};

const ShellContext = createContext<ShellContextValue>({
  sidebarHidden: false,
  toggleSidebar: () => {},
});

export function ShellProvider({ children }: { children: React.ReactNode }) {
  const [sidebarHidden, setSidebarHidden] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("box-studio:sidebar-hidden");
    if (stored === "1") setSidebarHidden(true);
  }, []);

  function toggleSidebar() {
    setSidebarHidden((prev) => {
      const next = !prev;
      localStorage.setItem("box-studio:sidebar-hidden", next ? "1" : "0");
      return next;
    });
  }

  return (
    <ShellContext.Provider value={{ sidebarHidden, toggleSidebar }}>
      {children}
    </ShellContext.Provider>
  );
}

export function useShell() {
  return useContext(ShellContext);
}
