"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { Loader } from "@/components/motion/loader";
import { Wordmark } from "@/components/shared/wordmark";
import { useMe } from "@/lib/hooks/use-session";

/**
 * Centered frame for login and signup. Signed-in visitors go straight to the app. When a session
 * cookie exists, a loader stands in for the form while the session is checked, so it never flashes.
 */
export function AuthShell({ children, maybeSignedIn }: { children: ReactNode; maybeSignedIn: boolean }) {
  const router = useRouter();
  const { data, isPending } = useMe();
  useEffect(() => {
    if (data) router.replace("/app");
  }, [data, router]);

  const checking = Boolean(data) || (maybeSignedIn && isPending);

  return (
    <main className="flex min-h-dvh flex-col items-center px-4 py-8">
      <Wordmark />
      <div className="flex w-full flex-1 items-center justify-center py-10">
        {checking ? (
          <div role="status" className="flex flex-col items-center gap-4 text-[13px] text-text-muted">
            <Loader variant="dots" size={28} label="Opening your wishlist" />
            <span aria-hidden>Opening your wishlist</span>
          </div>
        ) : (
          children
        )}
      </div>
    </main>
  );
}
