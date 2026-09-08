"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  persistThemePreference,
  readStoredThemePreference,
  resolveTheme,
  type ResolvedTheme,
  type ThemePreference,
} from "@/lib/theme";

type ThemeContextValue = {
  preference: ThemePreference;
  theme: ResolvedTheme;
  setPreference: (preference: ThemePreference) => void;
};

const ThemeContext = createContext<ThemeContextValue>({
  preference: "system",
  theme: "dark",
  setPreference: () => undefined,
});

function applyResolved(theme: ResolvedTheme) {
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
  root.classList.toggle("dark", theme === "dark");
  root.classList.toggle("light", theme === "light");
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>("system");
  const [systemIsLight, setSystemIsLight] = useState(false);

  useEffect(() => {
    setPreferenceState(readStoredThemePreference());
    const media = window.matchMedia("(prefers-color-scheme: light)");
    const sync = () => setSystemIsLight(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  const theme = useMemo(() => resolveTheme(preference, systemIsLight), [preference, systemIsLight]);

  useEffect(() => {
    applyResolved(theme);
  }, [theme]);

  const setPreference = (next: ThemePreference) => {
    setPreferenceState(next);
    persistThemePreference(next);
    applyResolved(resolveTheme(next, window.matchMedia("(prefers-color-scheme: light)").matches));
  };

  return <ThemeContext.Provider value={{ preference, theme, setPreference }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
