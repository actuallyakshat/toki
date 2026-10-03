"use client";

import { ExternalLink, RefreshCw, Trash2, X } from "lucide-react";
import { useState } from "react";
import { Drawer } from "@/components/motion/drawer";
import { Input } from "@/components/motion/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/motion/select";
import { useToast } from "@/components/providers/toast-provider";
import { TokiButton, TokiButtonLink } from "@/components/shared/buttons";
import { DeltaChip } from "@/components/shared/delta-chip";
import { PriceFigure } from "@/components/shared/price-figure";
import { ProductImage } from "@/components/shared/product-image";
import { formatDayMonth, formatMoney, isCooling, retailerName, timeAgo } from "@/lib/format";
import { useItems, useRefreshItem, useUpdateItem } from "@/lib/hooks/use-wishlist";
import { minorToInput, parseMinor } from "@/lib/money-input";
import type { AlertRule, Item } from "@/lib/types";
import { useApp } from "./app-context";
import { HistoryChart } from "./history-chart";

const COOLING_DAYS = 30;

export function ItemDetail() {
  const { list, selectedItemId, closeItem } = useApp();
  const items = useItems(list?.id);
  const current = items.data?.find((i) => i.id === selectedItemId);
  // Keep the last item mounted while the drawer slides out.
  const [shown, setShown] = useState<Item | undefined>(current);
  if (current && current !== shown) setShown(current);

  return (
    <Drawer
      open={Boolean(current)}
      onOpenChange={(open) => !open && closeItem()}
      ariaLabel="Item details"
      className="w-[540px] max-w-full overflow-y-auto bg-surface"
    >
      {shown && <DetailBody key={shown.id} item={shown} onClose={closeItem} />}
    </Drawer>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[12px] text-text-muted">{label}</dt>
      <dd className="tnum mt-0.5 text-[15px] font-medium">{value}</dd>
    </div>
  );
}

function checkLine(item: Item): string {
  const { last_check_status: status, last_checked_at: at } = item.product;
  if (status === "failed") return "The last check failed. Toki will try again.";
  if (!at || status === "pending") return "Toki has not checked this price yet.";
  return `Checked ${timeAgo(at)}`;
}

function DetailBody({ item, onClose }: { item: Item; onClose: () => void }) {
  const { mode, income } = useApp();
  const update = useUpdateItem();
  const refresh = useRefreshItem();
  const notify = useToast();
  const { product } = item;
  const currency = product.currency;
  const cooling = isCooling(item.cooling_until) ? item.cooling_until : null;

  const [target, setTarget] = useState(minorToInput(item.target_price_minor));
  const [targetError, setTargetError] = useState<string>();
  const [note, setNote] = useState(item.note);
  const [percent, setPercent] = useState(String(item.alert_rule.type === "percent_drop" ? item.alert_rule.percent : 10));

  const patch = (body: Parameters<typeof update.mutate>[0]["patch"], onSuccess?: () => void) =>
    update.mutate({ id: item.id, patch: body }, { onSuccess });

  const saveTarget = () => {
    const trimmed = target.trim();
    if (!trimmed) {
      patch({ target_price_minor: null }, () => notify({ status: "success", title: "Target removed", description: product.title }));
      setTargetError(undefined);
      return;
    }
    const minor = parseMinor(trimmed);
    if (!minor) {
      setTargetError("Enter the price you want to pay, for example 11999.");
      return;
    }
    setTargetError(undefined);
    patch({ target_price_minor: minor }, () =>
      notify({ status: "success", title: "Target saved", description: `${formatMoney(minor, currency)} for ${product.title}` }),
    );
  };

  const setRule = (rule: AlertRule) => patch({ alert_rule: rule });

  const waitThirtyDays = () => {
    if (cooling) {
      patch({ cooling_until: null }, () => notify({ status: "success", title: "Waiting stopped", description: product.title }));
      return;
    }
    const until = new Date(Date.now() + COOLING_DAYS * 86_400_000).toISOString();
    patch({ cooling_until: until }, () =>
      notify({ status: "success", title: "Waiting 30 days", description: `Cooling off until ${formatDayMonth(until)}` }),
    );
  };

  const leave = (status: "bought" | "removed") => {
    const title = status === "bought" ? "Marked as bought" : "Removed from Toki";
    update.mutate(
      { id: item.id, patch: { status } },
      {
        onSuccess: () => {
          onClose();
          notify({
            status: "success",
            title,
            description: product.title,
            action: { label: "Undo", onClick: () => update.mutate({ id: item.id, patch: { status: "wanted" } }) },
          });
        },
      },
    );
  };

  const queueRefresh = () =>
    refresh.mutate(item.id, {
      onSuccess: () => notify({ status: "info", title: "Price check queued", description: "Toki will check this price on the next run of your extension." }),
    });

  return (
    <div className="flex flex-col gap-6 p-5 sm:p-7">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[13px] text-text-muted">{retailerName(product.retailer, product.url)}</p>
        <button type="button" onClick={onClose} aria-label="Close details" className="grid size-9 place-items-center rounded-full text-text-muted hover:bg-muted">
          <X className="size-5" aria-hidden />
        </button>
      </div>

      <ProductImage src={product.image_url} alt={product.title} className="max-h-[420px] [&_img]:max-h-[420px] [&_img]:object-contain" />

      <div>
        <h2 className="text-[17px] font-semibold leading-snug">{product.title}</h2>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
          <PriceFigure minor={product.current_price_minor} currency={currency} mode={mode} income={income} className="text-[32px] font-medium leading-none" />
          <DeltaChip changeMinor={item.stats.change_since_added_minor} currency={currency} />
        </div>
        {!product.in_stock && <p className="mt-2 text-[13px] text-up">Out of stock right now.</p>}
        {cooling && <p className="mt-2 text-[13px] text-text-muted">Cooling off until {formatDayMonth(cooling)}.</p>}
        <p className="mt-2 text-[12px] text-text-muted">{checkLine(item)}</p>
      </div>

      <dl className="grid grid-cols-3 gap-4 rounded-image bg-surface-sunk p-4">
        <Stat label="Lowest" value={formatMoney(item.stats.lowest_minor, currency)} />
        <Stat label="Highest" value={formatMoney(item.stats.highest_minor, currency)} />
        <Stat label="Added at" value={formatMoney(item.added_price_minor, currency)} />
      </dl>

      <section aria-label="Price history">
        <h3 className="mb-2 text-[15px] font-semibold">Price history</h3>
        <HistoryChart item={item} />
      </section>

      <section aria-label="Price alerts" className="flex flex-col gap-3">
        <h3 className="text-[15px] font-semibold">Price alerts</h3>
        <form
          className="flex items-start gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            saveTarget();
          }}
        >
          <div className="flex-1">
            <Input
              label="Target price (₹)"
              inputMode="numeric"
              autoComplete="off"
              value={target}
              onChange={setTarget}
              error={targetError}
              reserveErrorLine
            />
          </div>
          <TokiButton type="submit" variant="secondary" className="mt-6">
            Save target
          </TokiButton>
        </form>
        <div>
          <p className="mb-1.5 text-[12px] text-text-muted">Email me when</p>
          <Select
            value={item.alert_rule.type}
            onValueChange={(v) =>
              setRule(v === "percent_drop" ? { type: "percent_drop", percent: Number(percent) || 10 } : ({ type: v } as AlertRule))
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Choose a rule" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any_drop">The price drops at all</SelectItem>
              <SelectItem value="below_target">The price reaches my target</SelectItem>
              <SelectItem value="percent_drop">The price falls by a percentage</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {item.alert_rule.type === "percent_drop" && (
          <Input
            label="Percent below the price you added it at"
            inputMode="numeric"
            value={percent}
            onChange={setPercent}
            onBlur={() => {
              const n = Math.round(Number(percent));
              if (n >= 1 && n <= 99) setRule({ type: "percent_drop", percent: n });
            }}
            reserveErrorLine
          />
        )}
      </section>

      <Input
        label="Note"
        value={note}
        onChange={setNote}
        onBlur={() => note !== item.note && patch({ note })}
        placeholder="Why you want it, or what to compare"
        maxLength={500}
      />

      <div className="flex flex-wrap gap-2 border-t border-border pt-5">
        <TokiButton onClick={() => leave("bought")}>Mark as bought</TokiButton>
        <TokiButton variant="secondary" onClick={waitThirtyDays}>
          {cooling ? "Stop waiting" : "Wait 30 days"}
        </TokiButton>
        <TokiButton variant="secondary" onClick={queueRefresh} disabled={refresh.isPending}>
          <RefreshCw className="size-4" aria-hidden />
          Refresh price
        </TokiButton>
        <TokiButtonLink href={product.url} target="_blank" rel="noreferrer" variant="secondary">
          <ExternalLink className="size-4" aria-hidden />
          Open in store
        </TokiButtonLink>
        <TokiButton variant="ghost" onClick={() => leave("removed")} className="text-up hover:text-up">
          <Trash2 className="size-4" aria-hidden />
          Remove
        </TokiButton>
      </div>
    </div>
  );
}
