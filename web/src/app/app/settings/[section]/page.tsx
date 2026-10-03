"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTheme } from "next-themes";
import { notFound, useParams, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useApp } from "@/components/app/app-context";
import { IncomeForm } from "@/components/app/income-form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/motion/select";
import { Switch } from "@/components/motion/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/motion/tabs";
import { useToast } from "@/components/providers/toast-provider";
import { TokiButton } from "@/components/shared/buttons";
import { GridSizeToggle } from "@/components/shared/grid-size-toggle";
import { ApiError, api } from "@/lib/api";
import { meKey } from "@/lib/hooks/use-session";
import { findSettingsSection } from "@/lib/settings-sections";
import type { AlertMode, Profile } from "@/lib/types";

const CURRENCIES = [
  { code: "INR", label: "Indian rupee (INR)" },
  { code: "USD", label: "US dollar (USD)" },
  { code: "EUR", label: "Euro (EUR)" },
  { code: "GBP", label: "British pound (GBP)" },
];

const SEGMENT_LIST = "rounded-[var(--radius-control)] border border-border p-1 [&_[role=tab]]:rounded-[4px] [&_[role=tab]]:text-[13px]";

/** One setting across the full width: what it is on the left, its control on the right. */
function Row({ label, hint, children, stack = false }: { label: string; hint?: ReactNode; children: ReactNode; stack?: boolean }) {
  return (
    <div
      className={
        stack
          ? "grid gap-4 border-b border-border py-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:gap-16"
          : "flex flex-col gap-3 border-b border-border py-5 sm:flex-row sm:items-center sm:justify-between sm:gap-10"
      }
    >
      <div className="min-w-0">
        <p className="text-[13px] font-medium">{label}</p>
        {hint && <p className="mt-1 max-w-xl text-[12px] leading-relaxed text-text-muted">{hint}</p>}
      </div>
      <div className={stack ? "min-w-0" : "shrink-0"}>{children}</div>
    </div>
  );
}

const code = "rounded bg-surface-sunk px-1.5 py-0.5 font-mono text-[12px]";

export default function SettingsSectionPage() {
  const params = useParams<{ section: string }>();
  const section = findSettingsSection(params.section);
  const router = useRouter();
  const qc = useQueryClient();
  const notify = useToast();
  const { user, profile } = useApp();
  const { theme, setTheme } = useTheme();

  const save = useMutation({
    mutationFn: (patch: Partial<Profile>) => api.updateProfile(patch),
    onMutate: async (patch) => {
      await qc.cancelQueries({ queryKey: meKey });
      const previous = qc.getQueryData(meKey);
      qc.setQueryData(meKey, (old: { user: unknown; profile: Profile } | undefined) =>
        old && { ...old, profile: { ...old.profile, ...patch } },
      );
      return { previous };
    },
    onError: (e, _p, ctx) => {
      qc.setQueryData(meKey, ctx?.previous);
      notify({ status: "error", title: "Toki could not save that setting", description: e instanceof ApiError ? e.message : "Try again." });
    },
    onSuccess: () => notify({ status: "success", title: "Settings saved" }),
  });

  const logout = useMutation({
    mutationFn: api.logout,
    onSettled: () => {
      qc.clear();
      router.replace("/");
    },
  });

  if (!section) notFound();

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Breadcrumb bar, after monocode's settings view. */}
      <div className="flex h-11 shrink-0 items-center gap-2 border-b border-border px-4 text-[13px] sm:px-8">
        <span className="text-text-faint">Settings</span>
        <span aria-hidden className="text-text-faint/60">/</span>
        <span className="truncate">{section.label}</span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-24 pt-8 sm:px-8">
        <h1 className="text-[22px] leading-tight sm:text-[28px]">{section.label}</h1>
        <p className="mt-1.5 max-w-2xl text-[13px] leading-relaxed text-text-muted">{section.description}</p>

        <div className="mt-6 border-t border-border">
          {section.id === "general" && (
            <>
              <Row label="Name">
                <p className="text-[13px] text-text-muted">{user.name}</p>
              </Row>
              <Row label="Email">
                <p className="break-all text-[13px] text-text-muted">{user.email}</p>
              </Row>
              <Row label="Currency" hint="Prices, totals and alerts use this currency.">
                <div className="w-full sm:w-64">
                  <Select value={profile.currency} onValueChange={(currency) => save.mutate({ currency })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a currency" />
                    </SelectTrigger>
                    <SelectContent>
                      {CURRENCIES.map((c) => (
                        <SelectItem key={c.code} value={c.code}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </Row>
              <Row label="Log out" hint="Ends this session on this browser. The extension stays signed in until you log out there.">
                <TokiButton variant="outline" size="sm" onClick={() => logout.mutate()} disabled={logout.isPending}>
                  Log out
                </TokiButton>
              </Row>
            </>
          )}

          {section.id === "appearance" && (
            <>
              <Row label="Theme" hint="System follows your browser.">
                <Tabs variant="segment" value={theme ?? "system"} onValueChange={setTheme}>
                  <TabsList className={SEGMENT_LIST} wrapperClassName="w-auto">
                    {["system", "light", "dark"].map((t) => (
                      <TabsTrigger key={t} value={t} className="px-3 capitalize" indicatorClassName="rounded-[4px]">
                        {t}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </Tabs>
              </Row>
              <Row label="Card size" hint="How big product cards are on the wishlist, All items and Bought.">
                <GridSizeToggle />
              </Row>
            </>
          )}

          {section.id === "hours" && (
            <Row stack label="Salary and hours" hint="Toki divides each price by your hourly pay. Under an hour it shows minutes. Past 48 hours it shows workdays.">
              <div className="max-w-xl">
                <IncomeForm submitLabel="Save salary" onSaved={() => notify({ status: "success", title: "Salary saved" })} />
              </div>
            </Row>
          )}

          {section.id === "alerts" && (
            <>
              <Row label="Email me about price drops">
                <Switch
                  checked={profile.email_alerts}
                  onCheckedChange={(email_alerts) => save.mutate({ email_alerts })}
                  ariaLabel="Email me about price drops"
                />
              </Row>
              <div className={profile.email_alerts ? "" : "pointer-events-none opacity-50"}>
                <Row
                  label="How often"
                  hint={profile.alert_mode === "digest" ? "One email each Monday at 9:00 IST with every drop from the week." : "An email as soon as a price drops."}
                >
                  <Tabs variant="segment" value={profile.alert_mode} onValueChange={(v) => save.mutate({ alert_mode: v as AlertMode })}>
                    <TabsList className={SEGMENT_LIST} wrapperClassName="w-auto">
                      <TabsTrigger value="instant" className="px-4" indicatorClassName="rounded-[4px]">
                        Instant
                      </TabsTrigger>
                      <TabsTrigger value="digest" className="px-4" indicatorClassName="rounded-[4px]">
                        Weekly digest
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
                </Row>
              </div>
            </>
          )}

          {section.id === "extension" && (
            <ol className="grid border-border md:grid-cols-2 xl:grid-cols-3">
              {[
                <>
                  In the Toki folder, build the extension and find the output folder <code className={code}>extension/.output/chrome-mv3</code>.
                </>,
                <>
                  Open <code className={code}>chrome://extensions</code> and turn on Developer mode.
                </>,
                <>
                  Choose Load unpacked and select the <code className={code}>chrome-mv3</code> folder.
                </>,
                <>Open the Toki extension, log in with this account, and turn on price tracking.</>,
                <>Press Add on any product page to save it to your list.</>,
              ].map((step, i) => (
                <li key={i} className="border-b border-border py-5 md:pr-8">
                  <span className="font-mono text-[12px] tabular-nums text-text-faint">{String(i + 1).padStart(2, "0")}</span>
                  <p className="mt-2 text-[13px] leading-relaxed">{step}</p>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
}
