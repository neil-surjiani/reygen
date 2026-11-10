"use client";

import React, { createContext, useContext, useSyncExternalStore } from "react";

type Theme = "dark" | "light";

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: "light",
  toggleTheme: () => {},
  setTheme: () => {},
});

function applyDomTheme(newTheme: Theme) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (newTheme === "dark") {
    root.classList.add("dark");
    root.classList.remove("light");
  } else {
    root.classList.remove("dark");
    root.classList.add("light");
  }
}

function getStoredTheme(): Theme {
  if (typeof window === "undefined") return "dark";
  try {
    const saved = localStorage.getItem("reygen-theme") as Theme | null;
    if (saved === "light" || saved === "dark") {
      return saved;
    }
    return "light";
  } catch {
    return "light";
  }
}

let listeners: (() => void)[] = [];

function subscribeTheme(listener: () => void) {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

let currentTheme: Theme = "light";

if (typeof window !== "undefined") {
  currentTheme = getStoredTheme();
  applyDomTheme(currentTheme);
}

function setAppTheme(newTheme: Theme) {
  currentTheme = newTheme;
  try {
    localStorage.setItem("reygen-theme", newTheme);
  } catch {}
  applyDomTheme(newTheme);
  listeners.forEach((l) => l());
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useSyncExternalStore<Theme>(
    subscribeTheme,
    () => currentTheme,
    () => "light" as Theme
  );

  const toggleTheme = () => {
    const next = currentTheme === "dark" ? "light" : "dark";
    setAppTheme(next);
  };

  const setTheme = (newTheme: Theme) => {
    setAppTheme(newTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
