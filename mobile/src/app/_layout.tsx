// Per-weight imports keep the other Geist weights out of the bundle.
import { Geist_400Regular } from "@expo-google-fonts/geist/400Regular";
import { Geist_500Medium } from "@expo-google-fonts/geist/500Medium";
import { Geist_600SemiBold } from "@expo-google-fonts/geist/600SemiBold";
import { GeistMono_500Medium } from "@expo-google-fonts/geist-mono/500Medium";
import { QueryClient, QueryClientProvider, focusManager, onlineManager } from "@tanstack/react-query";
import { useFonts } from "expo-font";
import { DarkTheme, DefaultTheme, ThemeProvider as NavigationTheme, Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { AppState, Platform } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ToastProvider } from "@/components/toast";
import { ApiError } from "@/lib/api";
import { AppStateProvider } from "@/lib/app-state";
import { PrefsProvider, usePrefs } from "@/lib/prefs";
import { SessionProvider, useSession } from "@/lib/session";
import { ThemeProvider, useTheme } from "@/theme/theme";

SplashScreen.preventAutoHideAsync();

// Refetch when the app comes back to the foreground, as a browser tab does on focus.
focusManager.setEventListener((handleFocus) => {
  const sub = AppState.addEventListener("change", (state) => {
    if (Platform.OS !== "web") handleFocus(state === "active");
  });
  return () => sub.remove();
});
onlineManager.setOnline(true);

export default function RootLayout() {
  const [fontsLoaded] = useFonts({ Geist_400Regular, Geist_500Medium, Geist_600SemiBold, GeistMono_500Medium });
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            // A 401 or 404 will not fix itself; anything else gets one more try.
            retry: (count, e) => !(e instanceof ApiError && (e.status === 401 || e.status === 404)) && count < 1,
          },
        },
      }),
  );

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <PrefsProvider>
            <SessionProvider>
              <ThemeProvider>
                <ToastProvider>
                  <Root fontsLoaded={fontsLoaded} />
                </ToastProvider>
              </ThemeProvider>
            </SessionProvider>
          </PrefsProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function Root({ fontsLoaded }: { fontsLoaded: boolean }) {
  const { status } = useSession();
  const { ready } = usePrefs();
  const { scheme, c } = useTheme();
  const loaded = fontsLoaded && ready && status !== "loading";
  const signedIn = status === "signed-in";

  useEffect(() => {
    if (loaded) SplashScreen.hideAsync();
  }, [loaded]);

  if (!loaded) return null;

  const base = scheme === "dark" ? DarkTheme : DefaultTheme;
  const navTheme = {
    ...base,
    colors: { ...base.colors, background: c.bg, card: c.bg, text: c.text, border: c.border, primary: c.text },
  };
  const sheet = { presentation: "modal" as const, contentStyle: { backgroundColor: c.surface } };

  return (
    <NavigationTheme value={navTheme}>
      <StatusBar style={scheme === "dark" ? "light" : "dark"} />
      <AppStateProvider enabled={signedIn}>
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg } }}>
          <Stack.Protected guard={signedIn}>
            <Stack.Screen name="(app)" />
            <Stack.Screen name="item/[id]" options={sheet} />
            <Stack.Screen name="add" options={sheet} />
            <Stack.Screen name="lists" options={sheet} />
            <Stack.Screen name="list-edit" options={sheet} />
            <Stack.Screen name="income" options={sheet} />
          </Stack.Protected>
          <Stack.Protected guard={!signedIn}>
            <Stack.Screen name="sign-in" />
            <Stack.Screen name="sign-up" />
          </Stack.Protected>
        </Stack>
      </AppStateProvider>
    </NavigationTheme>
  );
}
