import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { createContext, useCallback, useContext, useEffect, useMemo, type ReactNode } from "react";
import { incomeFromProfile, type Income } from "./format";
import { useLists, useMe } from "./hooks";
import { usePrefs, type Mode } from "./prefs";
import type { List, Profile, User } from "./types";

interface AppState {
  user: User | undefined;
  profile: Profile | undefined;
  lists: List[];
  list: List | undefined;
  listsLoading: boolean;
  listsError: boolean;
  refetchLists: () => void;
  setListId: (id: string) => void;
  mode: Mode;
  income: Income | null;
  currency: string;
  /** Switches the display mode. Opens the salary sheet first when no salary is set. */
  requestMode: (mode: Mode) => void;
}

const AppContext = createContext<AppState | null>(null);

/** Signed-in state shared by every screen, after the website's AppProvider. */
export function AppStateProvider({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  const me = useMe(enabled);
  const lists = useLists(enabled);
  const { mode, setMode, listId, setListId, deviceIncome } = usePrefs();
  const profile = me.data?.profile;
  const income = incomeFromProfile(profile, deviceIncome);

  // A remembered time mode needs a salary; fall back quietly when it is gone.
  useEffect(() => {
    if (profile && mode === "time" && !income) setMode("money");
  }, [profile, mode, income, setMode]);

  const all = useMemo(() => lists.data ?? [], [lists.data]);
  const list = all.find((l) => l.id === listId) ?? all[0];

  const requestMode = useCallback(
    (next: Mode) => {
      if (next === mode) return;
      if (next === "time" && !income) {
        router.push("/income");
        return;
      }
      void Haptics.selectionAsync();
      setMode(next);
    },
    [mode, income, setMode],
  );

  const value = useMemo<AppState>(
    () => ({
      user: me.data?.user,
      profile,
      lists: all,
      list,
      listsLoading: lists.isLoading,
      listsError: lists.isError,
      refetchLists: () => void lists.refetch(),
      setListId,
      mode,
      income,
      currency: profile?.currency || "INR",
      requestMode,
    }),
    [me.data?.user, profile, all, list, lists, setListId, mode, income, requestMode],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppState {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside AppStateProvider");
  return ctx;
}
