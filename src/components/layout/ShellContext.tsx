"use client";

import { createContext, useContext, useEffect, useState } from "react";

type ShellContextValue = {
  sidebarHidden: boolean;
  toggleSidebar: () => void;
  sectionsHidden: boolean;
  toggleSections: () => void;
};

const ShellContext = createContext<ShellContextValue>({
  sidebarHidden: false,
  toggleSidebar: () => {},
  sectionsHidden: false,
  toggleSections: () => {},
});

export function ShellProvider({ children }: { children: React.ReactNode }) {
  const [sidebarHidden, setSidebarHidden] = useState(false);
  const [sectionsHidden, setSectionsHidden] = useState(false);

  useEffect(() => {
    const storedSidebar = localStorage.getItem("box-studio:sidebar-hidden");
    if (storedSidebar === "1") setSidebarHidden(true);
    const storedSections = localStorage.getItem("box-studio:sections-hidden");
    if (storedSections === "1") setSectionsHidden(true);
  }, []);

  function toggleSidebar() {
    setSidebarHidden((prev) => {
      const next = !prev;
      localStorage.setItem("box-studio:sidebar-hidden", next ? "1" : "0");
      return next;
    });
  }

  function toggleSections() {
    setSectionsHidden((prev) => {
      const next = !prev;
      localStorage.setItem("box-studio:sections-hidden", next ? "1" : "0");
      return next;
    });
  }

  return (
    <ShellContext.Provider
      value={{
        sidebarHidden,
        toggleSidebar,
        sectionsHidden,
        toggleSections,
      }}
    >
      {children}
    </ShellContext.Provider>
  );
}

export function useShell() {
  return useContext(ShellContext);
}
