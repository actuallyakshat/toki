"use client";

import { createContext, useContext, type ReactNode } from "react";
import {
  AnimatedToastStack,
  useAnimatedToastStack,
  type ToastInput,
} from "@/components/motion/animated-toast-stack";

type Notify = (toast: ToastInput) => string;

const ToastContext = createContext<Notify | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const { toasts, showToast, dismissToast } = useAnimatedToastStack({ defaultDuration: 4200, limit: 4 });
  return (
    <ToastContext.Provider value={showToast}>
      {children}
      <AnimatedToastStack
        toasts={toasts}
        onDismiss={dismissToast}
        position="bottom-center"
        placement="fixed"
        maxVisible={3}
      />
    </ToastContext.Provider>
  );
}

/** Fire-and-forget toast. Every optimistic mutation rolls back and calls this on failure. */
export function useToast(): Notify {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside ToastProvider");
  return ctx;
}
