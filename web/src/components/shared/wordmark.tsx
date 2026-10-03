import Link from "next/link";
import { cn } from "@/lib/utils";

export function Wordmark({ className, href = "/" }: { className?: string; href?: string }) {
  return (
    <Link href={href} className={cn("inline-flex items-baseline gap-1.5 rounded-md", className)} aria-label="Toki home">
      <span className="font-display text-[17px] font-semibold tracking-[-0.04em]">Toki</span>
      <span aria-hidden className="text-[13px] text-text-muted">時</span>
    </Link>
  );
}
