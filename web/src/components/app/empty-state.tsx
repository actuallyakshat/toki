"use client";

import { useRouter } from "next/navigation";
import { TokiButton } from "@/components/shared/buttons";
import { useApp } from "./app-context";

export function EmptyState() {
  const router = useRouter();
  const { openModal } = useApp();
  return (
    <div className="mx-auto flex max-w-md flex-col items-start px-4 py-16 sm:py-24">
      <span aria-hidden className="font-display text-[46px] font-medium leading-none text-border">
        時
      </span>
      <h2 className="mt-4 text-[22px] font-semibold leading-tight">Nothing here yet.</h2>
      <p className="mt-3 text-[15px] leading-relaxed text-text-muted">
        Paste a product link, or install the extension and press Add on any store.
      </p>
      <p className="mt-2 text-[13px] text-text-muted">Prices update when the Toki extension runs in your browser.</p>
      <div className="mt-6 flex flex-wrap gap-3">
        <TokiButton onClick={() => openModal("add")}>Paste a link</TokiButton>
        <TokiButton variant="secondary" onClick={() => router.push("/app/settings/extension")}>
          Install the extension
        </TokiButton>
      </div>
    </div>
  );
}
