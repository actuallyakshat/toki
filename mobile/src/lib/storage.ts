import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

/**
 * Small key/value storage. Native keeps values in the keychain / keystore (the session token lives
 * here), web falls back to localStorage so `expo start --web` still works for quick checks.
 */
export const storage = {
  async get(key: string): Promise<string | null> {
    try {
      if (Platform.OS === "web") return globalThis.localStorage?.getItem(key) ?? null;
      return await SecureStore.getItemAsync(key);
    } catch {
      return null;
    }
  },
  async set(key: string, value: string | null): Promise<void> {
    try {
      if (Platform.OS === "web") {
        if (value === null) globalThis.localStorage?.removeItem(key);
        else globalThis.localStorage?.setItem(key, value);
        return;
      }
      if (value === null) await SecureStore.deleteItemAsync(key);
      else await SecureStore.setItemAsync(key, value);
    } catch {}
  },
};

/** SecureStore keys may only hold letters, digits, ".", "-" and "_". */
export const KEYS = {
  token: "toki.token",
  apiOrigin: "toki.api",
  theme: "toki.theme",
  mode: "toki.mode",
  list: "toki.list",
  income: "toki.income",
  view: "toki.view",
} as const;
