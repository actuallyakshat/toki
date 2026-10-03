"use client";

import { Link2, X } from "lucide-react";
import { useState } from "react";
import { StatefulButton } from "@/components/motion/button";
import { Input } from "@/components/motion/input";
import { ProductImage } from "@/components/shared/product-image";
import { TokiButton } from "@/components/shared/buttons";
import { useToast } from "@/components/providers/toast-provider";
import { ApiError, api } from "@/lib/api";
import { formatMoney, retailerName } from "@/lib/format";
import { useAddItem } from "@/lib/hooks/use-wishlist";
import { parseMinor } from "@/lib/money-input";
import type { Capture } from "@/lib/types";
import { useApp } from "./app-context";

export type AddStep = "paste" | "preview" | "manual";

export interface AddFlowState {
  step: AddStep;
  setStep: (s: AddStep) => void;
  url: string;
  setUrl: (v: string) => void;
  capture: Capture | null;
  setCapture: (c: Capture | null) => void;
  reset: () => void;
}

/** State lives outside the views because the modal remounts its content on every view change. */
export function useAddFlow(): AddFlowState {
  const [step, setStep] = useState<AddStep>("paste");
  const [url, setUrl] = useState("");
  const [capture, setCapture] = useState<Capture | null>(null);
  return {
    step,
    setStep,
    url,
    setUrl,
    capture,
    setCapture,
    reset: () => {
      setStep("paste");
      setUrl("");
      setCapture(null);
    },
  };
}

function Header({ title, onClose, hint }: { title: string; onClose: () => void; hint?: string }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-4">
      <div>
        <h2 className="text-[17px] font-semibold">{title}</h2>
        {hint && <p className="mt-1 text-[13px] text-text-muted">{hint}</p>}
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="grid size-8 shrink-0 place-items-center rounded-full text-text-muted hover:bg-muted"
      >
        <X className="size-4" aria-hidden />
      </button>
    </div>
  );
}

export function AddItemFlow({ flow, onClose }: { flow: AddFlowState; onClose: () => void }) {
  if (flow.step === "paste") return <PasteStep flow={flow} onClose={onClose} />;
  if (flow.step === "manual") return <ManualStep flow={flow} onClose={onClose} />;
  return <PreviewStep flow={flow} onClose={onClose} />;
}

function PasteStep({ flow, onClose }: { flow: AddFlowState; onClose: () => void }) {
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState<string>();

  async function read() {
    const url = flow.url.trim();
    if (!/^https?:\/\//i.test(url)) {
      setError("Paste a full product link that starts with https://.");
      return;
    }
    setState("loading");
    setError(undefined);
    try {
      const { capture } = await api.extract(url);
      flow.setCapture(capture);
      flow.setStep("preview");
    } catch (e) {
      if (e instanceof ApiError && e.code === "extract_failed") {
        flow.setStep("manual");
        return;
      }
      setState("error");
      setError(e instanceof ApiError ? e.message : "Toki could not read that link. Try again.");
    }
  }

  return (
    <div>
      <Header title="Add an item" hint="Paste a product link from any store." onClose={onClose} />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          read();
        }}
        className="flex flex-col gap-3"
      >
        <Input
          label="Product link"
          type="url"
          inputMode="url"
          autoFocus
          autoComplete="off"
          placeholder="https://www.amazon.in/dp/…"
          leftIcon={<Link2 />}
          value={flow.url}
          onChange={flow.setUrl}
          error={error}
          reserveErrorLine
        />
        <StatefulButton
          type="submit"
          state={state}
          loadingText="Reading the page"
          errorText="Try again"
          className="w-full rounded-[var(--radius-control)]"
        >
          Read the page
        </StatefulButton>
      </form>
    </div>
  );
}

function PreviewStep({ flow, onClose }: { flow: AddFlowState; onClose: () => void }) {
  const { list, closeModal } = useApp();
  const add = useAddItem();
  const notify = useToast();
  const [target, setTarget] = useState("");
  const [error, setError] = useState<string>();
  const capture = flow.capture;
  if (!capture) return null;

  async function submit() {
    if (!capture) return;
    const targetMinor = target.trim() ? parseMinor(target) : undefined;
    if (target.trim() && !targetMinor) {
      setError("Enter the price you want to pay, for example 11999.");
      return;
    }
    try {
      const item = await add.mutateAsync({
        url: capture.source_url,
        list_id: list?.id,
        capture,
        target_price_minor: targetMinor ?? undefined,
      });
      notify({ status: "success", title: "Added to Toki", description: item.product.title });
      closeModal();
      flow.reset();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Toki could not add this item. Try again.");
    }
  }

  return (
    <div>
      <Header title="Add to your wishlist" onClose={onClose} />
      <div className="flex gap-3 rounded-[var(--radius-image)] bg-surface-sunk p-2.5">
        <div className="w-24 shrink-0">
          <ProductImage src={capture.image_url} alt="" placeholderClassName="aspect-square" className="rounded-xl" />
        </div>
        <div className="min-w-0 py-1">
          <p className="text-[12px] text-text-muted">{retailerName(capture.retailer, capture.source_url)}</p>
          <p className="mt-0.5 line-clamp-2 text-[13px] font-medium leading-snug">{capture.title}</p>
          <p className="figure tnum mt-1.5 text-[17px] font-semibold">{formatMoney(capture.price_minor, capture.currency)}</p>
        </div>
      </div>
      <div className="mt-4">
        <Input
          label="Target price, optional"
          inputMode="numeric"
          autoComplete="off"
          placeholder="Email me when it drops to"
          value={target}
          onChange={setTarget}
          error={error}
          reserveErrorLine
        />
      </div>
      <div className="mt-2 flex gap-2">
        <TokiButton variant="ghost" onClick={() => flow.setStep("paste")}>
          Use another link
        </TokiButton>
        <StatefulButton
          type="button"
          onClick={submit}
          state={add.isPending ? "loading" : "idle"}
          loadingText="Adding"
          className="flex-1 rounded-[var(--radius-control)]"
        >
          Add to Toki
        </StatefulButton>
      </div>
    </div>
  );
}

function ManualStep({ flow, onClose }: { flow: AddFlowState; onClose: () => void }) {
  const { list, closeModal } = useApp();
  const add = useAddItem();
  const notify = useToast();
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [errors, setErrors] = useState<{ title?: string; price?: string; form?: string }>({});

  async function submit() {
    const minor = parseMinor(price);
    const next = {
      title: title.trim() ? undefined : "Enter the product name.",
      price: minor ? undefined : "Enter the price in rupees, for example 12999.",
    };
    setErrors(next);
    if (next.title || !minor) return;
    const url = flow.url.trim();
    try {
      const item = await add.mutateAsync({
        url,
        list_id: list?.id,
        capture: {
          source_url: url,
          title: title.trim(),
          image_url: "",
          price_minor: minor,
          currency: "INR",
          original_price_minor: null,
          in_stock: true,
          retailer: "generic",
        },
      });
      notify({ status: "success", title: "Added to Toki", description: item.product.title });
      closeModal();
      flow.reset();
    } catch (e) {
      setErrors({ form: e instanceof ApiError ? e.message : "Toki could not add this item. Try again." });
    }
  }

  return (
    <div>
      <Header
        title="Enter the details"
        hint="Toki could not read a price on this page. Enter it below."
        onClose={onClose}
      />
      <div className="flex flex-col gap-1">
        <Input label="Product name" value={title} onChange={setTitle} error={errors.title} reserveErrorLine autoComplete="off" />
        <Input
          label="Price (₹)"
          inputMode="numeric"
          value={price}
          onChange={setPrice}
          error={errors.price}
          reserveErrorLine
          autoComplete="off"
        />
      </div>
      {errors.form && (
        <p role="alert" className="mb-2 rounded-2xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-[12px] text-destructive">
          {errors.form}
        </p>
      )}
      <div className="flex gap-2">
        <TokiButton variant="ghost" onClick={() => flow.setStep("paste")}>
          Use another link
        </TokiButton>
        <StatefulButton
          type="button"
          onClick={submit}
          state={add.isPending ? "loading" : "idle"}
          loadingText="Adding"
          className="flex-1 rounded-[var(--radius-control)]"
        >
          Add to Toki
        </StatefulButton>
      </div>
    </div>
  );
}
