import { useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, configureApi } from "./api";
import { defaultApiOrigin, normalizeOrigin } from "./config";
import { KEYS, storage } from "./storage";

type Status = "loading" | "signed-out" | "signed-in";

interface SessionState {
  status: Status;
  origin: string;
  signIn: (b: { email: string; password: string; origin: string }) => Promise<void>;
  signUp: (b: { name: string; email: string; password: string; origin: string }) => Promise<void>;
  signOut: () => Promise<void>;
}

const SessionContext = createContext<SessionState | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [status, setStatus] = useState<Status>("loading");
  const [origin, setOrigin] = useState(defaultApiOrigin);

  const forget = useCallback(async () => {
    configureApi({ token: null });
    await storage.set(KEYS.token, null);
    qc.clear();
    setStatus("signed-out");
  }, [qc]);

  useEffect(() => {
    configureApi({ onUnauthorized: () => void forget() });
  }, [forget]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [token, saved] = await Promise.all([storage.get(KEYS.token), storage.get(KEYS.apiOrigin)]);
      if (cancelled) return;
      const o = saved ?? defaultApiOrigin();
      configureApi({ origin: o, token });
      setOrigin(o);
      setStatus(token ? "signed-in" : "signed-out");
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const save = useCallback(
    async (o: string, token: string) => {
      configureApi({ origin: o, token });
      await Promise.all([storage.set(KEYS.token, token), storage.set(KEYS.apiOrigin, o)]);
      setOrigin(o);
      qc.clear();
      setStatus("signed-in");
    },
    [qc],
  );

  const signIn = useCallback<SessionState["signIn"]>(
    async ({ email, password, origin: raw }) => {
      const o = normalizeOrigin(raw);
      const { token } = await api.token({ email, password }, o);
      await save(o, token);
    },
    [save],
  );

  const signUp = useCallback<SessionState["signUp"]>(
    async ({ name, email, password, origin: raw }) => {
      const o = normalizeOrigin(raw);
      await api.signup({ name, email, password }, o);
      // Sign-up answers with a cookie for the website; the app asks for its own bearer token.
      const { token } = await api.token({ email, password }, o);
      await save(o, token);
    },
    [save],
  );

  const signOut = useCallback(async () => {
    await api.logout().catch(() => {});
    await forget();
  }, [forget]);

  const value = useMemo(() => ({ status, origin, signIn, signUp, signOut }), [status, origin, signIn, signUp, signOut]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionState {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used inside SessionProvider");
  return ctx;
}
