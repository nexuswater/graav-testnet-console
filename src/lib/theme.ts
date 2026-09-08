export const THEME_STORAGE_KEY = "graav-theme";

export type ThemePreference = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === "light" || value === "dark" || value === "system";
}

export function resolveTheme(
  preference: ThemePreference,
  systemIsLight = false,
): ResolvedTheme {
  if (preference === "system") return systemIsLight ? "light" : "dark";
  return preference;
}

export function readStoredThemePreference(): ThemePreference {
  if (typeof window === "undefined") return "system";
  try {
    const raw = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isThemePreference(raw) ? raw : "system";
  } catch {
    return "system";
  }
}

export function persistThemePreference(preference: ThemePreference) {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    /* private mode */
  }
}

export const THEME_BOOT_SCRIPT = `(function(){try{var k=${JSON.stringify(THEME_STORAGE_KEY)};var raw=localStorage.getItem(k);var pref=raw==="light"||raw==="dark"||raw==="system"?raw:"system";var systemLight=window.matchMedia("(prefers-color-scheme: light)").matches;var theme=pref==="system"?(systemLight?"light":"dark"):pref;var r=document.documentElement;r.dataset.theme=theme;r.style.colorScheme=theme;r.classList.toggle("dark",theme==="dark");r.classList.toggle("light",theme==="light");}catch(e){var r=document.documentElement;r.dataset.theme="dark";r.style.colorScheme="dark";}})();`;
