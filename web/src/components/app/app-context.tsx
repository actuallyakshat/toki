"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { incomeFromProfile, type Income } from "@/lib/format";
import { useDeviceIncome } from "@/lib/income";
import { needsSalaryOnboarding } from "@/lib/onboarding";
import { restoreMode, setMode, useMode, type Mode } from "@/lib/mode";
import { useLists } from "@/lib/hooks/use-wishlist";
import type { List, Profile, User } from "@/lib/types";

export type ModalView = "onboarding" | "add" | "income" | "new-list" | "edit-list" | "share";

interface AppState {
  user: User;
  profile: Profile;
  lists: List[];
  list: List | undefined;
  listsLoading: boolean;
  setListId: (id: string) => void;
  mode: Mode;
  income: Income | null;
  currency: string;
  /** Switches the display mode. Opens the salary dialog first when no salary is set. */
  requestMode: (mode: Mode) => void;
  modal: ModalView | null;
  openModal: (view: ModalView) => void;
  closeModal: () => void;
  selectedItemId: string | null;
  openItem: (id: string) => void;
  closeItem: () => void;
  paletteOpen: boolean;
  setPaletteOpen: (open: boolean) => void;
}

const AppContext = createContext<AppState | null>(null);

const LIST_KEY = "toki.list";

function readStoredList(): string | null {
  try {
    return localStorage.getItem(LIST_KEY);
  } catch {
    return null;
  }
}

export function AppProvider({ user, profile, children }: { user: User; profile: Profile; children: ReactNode }) {
  const lists = useLists();
  const mode = useMode();
  const deviceIncome = useDeviceIncome();
  const income = incomeFromProfile(profile, deviceIncome);

  const [storedListId, setStoredListId] = useState<string | null>(readStoredList);
  const [modal, setModal] = useState<ModalView | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => restoreMode(), []);
  // First visit without a salary: offer it once the shell has painted, so the modal animates in.
  useEffect(() => {
    if (!needsSalaryOnboarding(user.id, profile)) return;
    const t = setTimeout(() => setModal((m) => m ?? "onboarding"), 400);
    return () => clearTimeout(t);
    // Only on sign-in; saving a salary later changes the profile but must not re-check.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id]);
  useEffect(() => {
    if (mode === "time" && !income) setMode("money", { persist: false });
  }, [mode, income]);

  const all = useMemo(() => lists.data ?? [], [lists.data]);
  const list = all.find((l) => l.id === storedListId) ?? all[0];

  const setListId = useCallback((id: string) => {
    setStoredListId(id);
    try {
      localStorage.setItem(LIST_KEY, id);
    } catch {}
  }, []);

  const requestMode = useCallback(
    (next: Mode) => {
      if (next === "time" && !income) setModal("income");
      else setMode(next);
    },
    [income],
  );

  const value = useMemo<AppState>(
    () => ({
      user,
      profile,
      lists: all,
      list,
      listsLoading: lists.isLoading,
      setListId,
      mode,
      income,
      currency: profile.currency || "INR",
      requestMode,
      modal,
      openModal: setModal,
      closeModal: () => setModal(null),
      selectedItemId,
      openItem: setSelectedItemId,
      closeItem: () => setSelectedItemId(null),
      paletteOpen,
      setPaletteOpen,
    }),
    [user, profile, all, lists.isLoading, list, setListId, mode, income, requestMode, modal, selectedItemId, paletteOpen],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppState {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside AppProvider");
  return ctx;
}
