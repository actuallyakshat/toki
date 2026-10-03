"use client";

import { PanelLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import {
  AnimatedSidebarInset,
  AnimatedSidebarProvider,
  AnimatedSidebarTrigger,
} from "@/components/motion/animated-sidebar";
import { Loader } from "@/components/motion/loader";
import { Wordmark } from "@/components/shared/wordmark";
import { ApiError } from "@/lib/api";
import { useMe } from "@/lib/hooks/use-session";
import { AppProvider } from "./app-context";
import { AppSidebar } from "./app-sidebar";
import { CommandMenu } from "./command-menu";
import { ItemDetail } from "./item-detail";
import { ModalHost } from "./modal-host";

/** Verifies the session, then renders the rail, the page, and the global overlays. */
export function AppShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const me = useMe();
  const signedOut = me.error instanceof ApiError && me.error.status === 401;

  useEffect(() => {
    if (signedOut) router.replace("/login");
  }, [signedOut, router]);

  if (!me.data) {
    return (
      <div className="grid min-h-dvh place-items-center">
        {me.isError && !signedOut ? (
          <div className="max-w-sm px-6 text-center">
            <h1 className="text-[17px] font-semibold">Toki could not load your account</h1>
            <p className="mt-2 text-[13px] text-text-muted">
              Check that the server is running, then{" "}
              <button type="button" onClick={() => me.refetch()} className="font-medium text-text underline underline-offset-4">
                try again
              </button>
              .
            </p>
          </div>
        ) : (
          <Loader variant="dots" size={28} label="Loading your wishlist" />
        )}
      </div>
    );
  }

  return (
    <AppProvider user={me.data.user} profile={me.data.profile}>
      <AnimatedSidebarProvider defaultOpen={false} style={{ "--sidebar-width": "16rem", "--sidebar-width-icon": "4.25rem" }}>
        <AppSidebar />
        <AnimatedSidebarInset className="h-dvh min-h-0 min-w-0 overflow-hidden">
          <div className="flex items-center gap-2 px-3 pt-3 md:hidden">
            <AnimatedSidebarTrigger className="text-text-muted hover:bg-muted" aria-label="Open menu">
              <PanelLeft className="size-5" aria-hidden />
            </AnimatedSidebarTrigger>
            <Wordmark href="/app" />
          </div>
          <div className="flex min-h-0 flex-1 flex-col">{children}</div>
        </AnimatedSidebarInset>
      </AnimatedSidebarProvider>
      <CommandMenu />
      <ItemDetail />
      <ModalHost />
    </AppProvider>
  );
}
