import { createContext, useContext, useEffect, useMemo, type ReactNode } from "react";
import { Appearance, useColorScheme } from "react-native";
import { Easing, useSharedValue, withTiming, type SharedValue } from "react-native-reanimated";
import { usePrefs } from "@/lib/prefs";
import { duration, palettes, timeAccent, type Palette, type Scheme } from "./tokens";

interface Theme {
  scheme: Scheme;
  c: Palette;
  /** Accent for the current mode: ink (or paper in dark) for money, purple for time. */
  accent: string;
  accentContrast: string;
  /** 0 in money mode, 1 in time mode, eased over 420 ms — the one orchestrated colour change. */
  timeProgress: SharedValue<number>;
}

const ThemeContext = createContext<Theme | null>(null);

/** cubic-bezier(0.22, 1, 0.36, 1), the Toki ease-out. */
export const easeOut = Easing.bezier(0.22, 1, 0.36, 1);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { theme, mode } = usePrefs();
  const system = useColorScheme();
  const scheme: Scheme = theme === "system" ? (system === "dark" ? "dark" : "light") : theme;
  const timeProgress = useSharedValue(mode === "time" ? 1 : 0);

  useEffect(() => {
    timeProgress.set(withTiming(mode === "time" ? 1 : 0, { duration: duration.slow, easing: easeOut }));
  }, [mode, timeProgress]);

  // Native pieces (keyboard, alerts, date pickers) follow the theme the person picked.
  useEffect(() => {
    try {
      Appearance.setColorScheme(theme === "system" ? "unspecified" : theme);
    } catch {}
  }, [theme]);

  const value = useMemo<Theme>(() => {
    const c = palettes[scheme];
    const time = mode === "time";
    return {
      scheme,
      c,
      accent: time ? timeAccent.accent : c.accent,
      accentContrast: time ? timeAccent.accentContrast : c.accentContrast,
      timeProgress,
    };
  }, [scheme, mode, timeProgress]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside ThemeProvider");
  return ctx;
}
