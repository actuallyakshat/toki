import Link from "next/link";
import { ThemeToggle } from "@/components/motion/theme-toggle";
import { Wordmark } from "@/components/shared/wordmark";

const LINK = "shrink-0 transition-colors duration-[var(--dur-base)] hover:text-text";

export function LandingNav() {
  return (
    <nav aria-label="Main" className="relative w-full px-4 py-4 sm:px-6">
      <div className="mx-auto flex h-9 max-w-6xl items-center justify-between gap-2 sm:gap-6">
        <Wordmark className="shrink-0" />
        <div className="hidden min-w-0 flex-1 items-center justify-center gap-6 text-[13px] text-text-faint sm:flex">
          <a href="#how" className={LINK}>How it works</a>
          <a href="#time" className={LINK}>Time view</a>
          <a href="#self-host" className={`${LINK} hidden md:inline`}>Self-host</a>
        </div>
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
          <ThemeToggle
            variant="circle"
            className="size-8 rounded-full text-text-faint transition-colors hover:bg-surface-sunk hover:text-text"
            iconClassName="size-4"
          />
          <Link href="/login" className={`${LINK} px-2 text-[13px] text-text-faint`}>
            Log in
          </Link>
          <Link
            href="/signup"
            className="rounded-full border border-border px-3.5 py-1 text-[13px] font-medium text-text transition-colors duration-[var(--dur-base)] hover:bg-surface-sunk"
          >
            Sign up
          </Link>
        </div>
      </div>
    </nav>
  );
}
