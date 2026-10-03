import Constants from "expo-constants";

/**
 * Where the Toki API lives. Order: what the person typed on the sign-in screen (stored), then
 * EXPO_PUBLIC_API_URL, then — in development — the machine running Metro on port 8080, so a phone
 * on the same Wi-Fi reaches `go run ./cmd/toki` without any setup.
 */
export function defaultApiOrigin(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  if (fromEnv) return normalizeOrigin(fromEnv);
  const host = Constants.expoConfig?.hostUri?.split(":")[0];
  if (__DEV__ && host) return `http://${host}:8080`;
  return "http://localhost:8080";
}

/** The website, used for share links (`/s/<slug>`). Falls back to the API origin on port 3000 in development. */
export function appUrl(apiOrigin: string): string {
  const fromEnv = process.env.EXPO_PUBLIC_APP_URL;
  if (fromEnv) return normalizeOrigin(fromEnv);
  return apiOrigin.replace(/:8080$/, ":3000");
}

/** "toki.example.com/" -> "https://toki.example.com". */
export function normalizeOrigin(value: string): string {
  const trimmed = value
    .trim()
    .replace(/\/+$/, "")
    .replace(/\/api$/, "");
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}
