/**
 * User preferences store (plan §12) — units + theme, persisted to localStorage.
 *
 * - `units` ('metric' | 'imperial'): screens read it and pass to the `lib/format`
 *   helpers (`fmtKm(km, units)`, `distUnit(units)`).
 * - `theme` ('dark' | 'light'): applied to `document.documentElement[data-theme]`
 *   so `styles/tokens.css` (`[data-theme="dark|light"]`) switches the palette. The
 *   design defaults to dark.
 *
 * Persisted via zustand's `persist` middleware (localStorage key `stride.prefs`).
 * Settings mutates via `setUnits`/`setTheme`/`toggleTheme`; everything else reads.
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Units = "metric" | "imperial";
export type Theme = "dark" | "light";

export interface PrefsState {
  units: Units;
  theme: Theme;
  setUnits(units: Units): void;
  setTheme(theme: Theme): void;
  toggleTheme(): void;
}

/** Reflect the active theme onto the document so tokens.css switches palette. */
function applyTheme(theme: Theme): void {
  if (typeof document !== "undefined") {
    document.documentElement.setAttribute("data-theme", theme);
  }
}

export const usePrefs = create<PrefsState>()(
  persist(
    (set, get) => ({
      units: "metric",
      theme: "dark",
      setUnits: (units) => set({ units }),
      setTheme: (theme) => {
        applyTheme(theme);
        set({ theme });
      },
      toggleTheme: () => get().setTheme(get().theme === "dark" ? "light" : "dark"),
    }),
    {
      name: "stride.prefs",
      // After rehydrating from localStorage, push the stored theme to the DOM.
      onRehydrateStorage: () => (state) => {
        if (state) applyTheme(state.theme);
      },
    },
  ),
);

/** Selector hook for the active units (the common read in screens/format calls). */
export function useUnits(): Units {
  return usePrefs((s) => s.units);
}

/** Selector hook for the active theme. */
export function useTheme(): Theme {
  return usePrefs((s) => s.theme);
}
