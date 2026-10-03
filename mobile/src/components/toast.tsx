import * as Haptics from "expo-haptics";
import { CircleAlert, CircleCheck, Info } from "lucide-react-native";
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { Platform, Pressable, View } from "react-native";
import Animated, { FadeOutDown, LinearTransition, SlideInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FullWindowOverlay } from "react-native-screens";
import { easeOut, useTheme } from "@/theme/theme";
import { radius } from "@/theme/tokens";
import { T } from "./text";

export interface ToastInput {
  status: "success" | "error" | "info";
  title: string;
  description?: string;
  action?: { label: string; onPress: () => void };
}

interface Toast extends ToastInput {
  id: number;
}

type Notify = (t: ToastInput) => void;

const ToastContext = createContext<Notify>(() => {});

const MAX = 3;
const DURATION = 4000;

/** The animated toast stack: newest at the bottom, above the tab bar, with an optional Undo. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const next = useRef(0);

  const dismiss = useCallback((id: number) => setToasts((all) => all.filter((t) => t.id !== id)), []);

  const notify = useCallback<Notify>(
    (input) => {
      const id = ++next.current;
      setToasts((all) => [...all.slice(-(MAX - 1)), { ...input, id }]);
      void Haptics.notificationAsync(
        input.status === "error" ? Haptics.NotificationFeedbackType.Error : Haptics.NotificationFeedbackType.Success,
      );
      setTimeout(() => dismiss(id), input.action ? DURATION + 2000 : DURATION);
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={notify}>
      {children}
      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToast(): Notify {
  return useContext(ToastContext);
}

function ToastStack({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: number) => void }) {
  const insets = useSafeAreaInsets();
  if (toasts.length === 0) return null;
  const stack = (
    <View style={{ pointerEvents: "box-none", position: "absolute", left: 12, right: 12, bottom: insets.bottom + 72, gap: 8 }}>
      {toasts.map((t) => (
        <ToastRow key={t.id} toast={t} onDismiss={() => onDismiss(t.id)} />
      ))}
    </View>
  );
  // On iOS, sheets sit in their own window; the overlay keeps toasts visible above them.
  return Platform.OS === "ios" ? <FullWindowOverlay>{stack}</FullWindowOverlay> : stack;
}

function ToastRow({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const { c } = useTheme();
  const Icon = toast.status === "error" ? CircleAlert : toast.status === "success" ? CircleCheck : Info;
  const tint = toast.status === "error" ? c.up : toast.status === "success" ? c.down : c.textMuted;
  return (
    <Animated.View
      entering={SlideInDown.duration(260).easing(easeOut)}
      exiting={FadeOutDown.duration(180)}
      layout={LinearTransition.duration(180)}
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
    >
      <Pressable
        onPress={onDismiss}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          paddingVertical: 12,
          paddingHorizontal: 14,
          borderRadius: radius.control,
          borderWidth: 1,
          borderColor: c.border,
          backgroundColor: c.surface,
        }}
      >
        <Icon size={18} color={tint} />
        <View style={{ flex: 1 }}>
          <T weight="medium">{toast.title}</T>
          {toast.description ? (
            <T size="caption" tone="muted" numberOfLines={2}>
              {toast.description}
            </T>
          ) : null}
        </View>
        {toast.action && (
          <Pressable
            onPress={() => {
              toast.action?.onPress();
              onDismiss();
            }}
            hitSlop={8}
            accessibilityRole="button"
            style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.button, backgroundColor: c.surfaceSunk }}
          >
            <T weight="medium">{toast.action.label}</T>
          </Pressable>
        )}
      </Pressable>
    </Animated.View>
  );
}
