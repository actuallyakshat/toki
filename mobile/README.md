# Toki mobile

The Toki wishlist for iOS and Android, built with Expo (SDK 57) and Expo Router. It talks to the
same Go API as the website and follows the same design system (`../DESIGN.md`, `../design/tokens.css`).

## Try it in an emulator

```sh
npm run emulator          # boots an Android emulator (or the iOS Simulator on a Mac without Android SDK) and opens Toki
npm run emulator:ios      # iOS Simulator (macOS)
./scripts/emulator.sh --backend   # also starts Postgres and the Go API
```

The script finds your Android SDK (`ANDROID_HOME`, or the Android Studio default), boots the first
emulator from Device Manager (pick one with `TOKI_AVD=<name>`), forwards port 8080 so the app reaches
your local API on `localhost`, installs dependencies if needed, and opens the app in Expo Go.

Sign in with the demo account after `./dev.sh --seed` (repo root): `demo@toki.dev` / `password123`.

## Run on your phone

```sh
npm install
npx expo start            # scan the QR code with Expo Go (Android) or the Camera app (iOS)
```

In development the app calls the API on the computer running Metro at port 8080, so a phone on the
same Wi-Fi works with `./dev.sh` and no setup. Every dependency ships in Expo Go; no development build
is needed.

## Configuration

| Variable | Default | Meaning |
|---|---|---|
| `EXPO_PUBLIC_API_URL` | Metro host on port 8080 (dev), `http://localhost:8080` | Toki API origin |
| `EXPO_PUBLIC_APP_URL` | API origin with port 3000 | Website origin, used for share links (`/s/<slug>`) |

People who host their own Toki can also change the server from the sign-in screen ("Change").

## How it fits together

- **Auth**: like the extension, the app exchanges email and password for a bearer token
  (`POST /api/auth/token`) and keeps it in the keychain / keystore (`expo-secure-store`). Sign-up uses
  `POST /api/auth/signup`, then asks for a token. No server changes were needed: native apps send no
  `Origin`, so CORS does not apply.
- **Data**: TanStack Query with the website's query keys and optimistic updates (`src/lib/hooks.ts`).
- **Screens** (`src/app`): Wishlist (grid and priority), Bought and Settings tabs; item detail, add
  item, lists, list editor and salary as sheets. Deep link: `toki://add?url=<product link>`.
- **Design**: tokens in `src/theme/tokens.ts` mirror `design/tokens.css`. Geist and Geist Mono,
  hairlines instead of shadows, ink pill buttons, 4:3 product images in 6px cards, and the time toggle:
  every price rolls into hours of work, 25 ms apart across the grid, while the accent eases to purple.

## Checks

```sh
npm run typecheck
npm run lint
npx expo export --platform android   # bundles without a device
```

`npm run icons` regenerates the app icon and splash from the sundial mark (`scripts/make-icons.mjs`).
Release builds go through EAS: `npx eas-cli@latest build`.
