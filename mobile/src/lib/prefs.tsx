import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Income } from "./format";
import { KEYS, storage } from "./storage";

export type ThemePref = "system" | "light" | "dark";
export type Mode = "money" | "time";
export type ViewKind = "grid" | "priority";

interface Prefs {
  ready: boolean;
  theme: ThemePref;
  setTheme: (t: ThemePref) => void;
  mode: Mode;
  setMode: (m: Mode) => void;
  listId: string | null;
  setListId: (id: string) => void;
  view: ViewKind;
  setView: (v: ViewKind) => void;
  /** Salary kept only on this phone when the profile says `income_storage = device`. */
  deviceIncome: Income | null;
  setDeviceIncome: (i: Income | null) => void;
}

const PrefsContext = createContext<Prefs | null>(null);

function parseIncome(raw: string | null): Income | null {
  try {
    const v = raw ? JSON.parse(raw) : null;
    return v && v.monthly_income_minor > 0 && v.hours_per_week > 0 ? v : null;
  } catch {
    return null;
  }
}

/** Per-device preferences, stored like the website's localStorage keys (`toki.theme`, `toki.mode`, …). */
export function PrefsProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [theme, setThemeState] = useState<ThemePref>("system");
  const [mode, setModeState] = useState<Mode>("money");
  const [listId, setListIdState] = useState<string | null>(null);
  const [view, setViewState] = useState<ViewKind>("grid");
  const [deviceIncome, setIncomeState] = useState<Income | null>(null);

  useEffect(() => {
    (async () => {
      const [t, m, l, v, i] = await Promise.all([
        storage.get(KEYS.theme),
        storage.get(KEYS.mode),
        storage.get(KEYS.list),
        storage.get(KEYS.view),
        storage.get(KEYS.income),
      ]);
      if (t === "light" || t === "dark") setThemeState(t);
      if (m === "time") setModeState("time");
      if (l) setListIdState(l);
      if (v === "priority") setViewState("priority");
      setIncomeState(parseIncome(i));
      setReady(true);
    })();
  }, []);

  const setTheme = useCallback((t: ThemePref) => {
    setThemeState(t);
    void storage.set(KEYS.theme, t === "system" ? null : t);
  }, []);
  const setMode = useCallback((m: Mode) => {
    setModeState(m);
    void storage.set(KEYS.mode, m);
  }, []);
  const setListId = useCallback((id: string) => {
    setListIdState(id);
    void storage.set(KEYS.list, id);
  }, []);
  const setView = useCallback((v: ViewKind) => {
    setViewState(v);
    void storage.set(KEYS.view, v);
  }, []);
  const setDeviceIncome = useCallback((i: Income | null) => {
    setIncomeState(i);
    void storage.set(KEYS.income, i ? JSON.stringify(i) : null);
  }, []);

  const value = useMemo(
    () => ({ ready, theme, setTheme, mode, setMode, listId, setListId, view, setView, deviceIncome, setDeviceIncome }),
    [ready, theme, setTheme, mode, setMode, listId, setListId, view, setView, deviceIncome, setDeviceIncome],
  );
  return <PrefsContext.Provider value={value}>{children}</PrefsContext.Provider>;
}

export function usePrefs(): Prefs {
  const ctx = useContext(PrefsContext);
  if (!ctx) throw new Error("usePrefs must be used inside PrefsProvider");
  return ctx;
}
