"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { Input } from "@/components/motion/input";
import { Switch } from "@/components/motion/switch";
import { StatefulButton } from "@/components/motion/button";
import { errorMessage } from "@/lib/api";
import type { Income } from "@/lib/format";
import { useDeviceIncome, saveDeviceIncome } from "@/lib/income";
import { useUpdateProfile } from "@/lib/hooks/use-profile";
import { minorToInput, parseMinor } from "@/lib/money-input";
import { useApp } from "./app-context";

/** Monthly in-hand salary and weekly hours, with the option to keep both on this device. */
export function IncomeForm({
  submitLabel,
  onSaved,
  onDraftChange,
  secondaryAction,
}: {
  submitLabel: string;
  onSaved?: () => void;
  /** The salary and hours as typed, or null while either is not usable yet. */
  onDraftChange?: (draft: Income | null) => void;
  /** Rendered under the submit button, e.g. a way to skip. */
  secondaryAction?: ReactNode;
}) {
  const { profile, income } = useApp();
  const device = useDeviceIncome();
  const save = useUpdateProfile({ toastErrors: false });

  const [salary, setSalary] = useState(minorToInput(income?.monthly_income_minor));
  const [hours, setHours] = useState(String(income?.hours_per_week ?? 45));
  const [deviceOnly, setDeviceOnly] = useState(profile.income_storage === "device" || (!income && device !== null));
  const [errors, setErrors] = useState<{ salary?: string; hours?: string; form?: string }>({});
  const [state, setState] = useState<"idle" | "loading" | "success" | "error">("idle");

  function draft(nextSalary: string, nextHours: string) {
    const monthly = parseMinor(nextSalary);
    const weekly = Number(nextHours);
    onDraftChange?.(monthly && weekly >= 1 && weekly <= 100 ? { monthly_income_minor: monthly, hours_per_week: weekly } : null);
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    const monthly = parseMinor(salary);
    const weekly = Number(hours);
    const next = {
      salary: monthly ? undefined : "Enter your monthly in-hand salary, for example 85000.",
      hours: weekly >= 1 && weekly <= 100 ? undefined : "Enter hours per week between 1 and 100.",
    };
    setErrors(next);
    if (!monthly || next.hours) return;

    const patch = deviceOnly
      ? { income_storage: "device" as const, monthly_income_minor: null, hours_per_week: null }
      : { income_storage: "server" as const, monthly_income_minor: monthly, hours_per_week: weekly };
    // Optimistic: hours apply before the server answers. Device income saves now;
    // the hook rolls the profile back if the save fails, and the form shows why.
    saveDeviceIncome(deviceOnly ? { monthly_income_minor: monthly, hours_per_week: weekly } : null);
    setState("loading");
    save.mutate(patch, {
      onSuccess: () => {
        setState("success");
        setErrors({});
        onSaved?.();
        setTimeout(() => setState("idle"), 1200);
      },
      onError: (err) => {
        setState("error");
        setErrors({ form: errorMessage(err, "Toki could not save your salary. Try again.") });
      },
    });
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <Input
          label="Monthly in-hand salary (₹)"
          inputMode="numeric"
          autoComplete="off"
          value={salary}
          onChange={(v) => {
            setSalary(v);
            draft(v, hours);
          }}
          error={errors.salary}
          reserveErrorLine
        />
        <Input
          label="Hours you work per week"
          inputMode="numeric"
          autoComplete="off"
          value={hours}
          onChange={(v) => {
            setHours(v);
            draft(salary, v);
          }}
          error={errors.hours}
          reserveErrorLine
        />
      </div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[13px] font-medium">Keep my salary on this device only</p>
          <p className="mt-0.5 text-[12px] text-text-muted">
            Toki saves it in this browser and works out hours here. The server stores no salary.
          </p>
        </div>
        <Switch checked={deviceOnly} onCheckedChange={setDeviceOnly} ariaLabel="Keep my salary on this device only" />
      </div>
      {errors.form && (
        <p role="alert" className="rounded-2xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-[12px] text-destructive">
          {errors.form}
        </p>
      )}
      <StatefulButton
        type="submit"
        state={state}
        loadingText="Saving"
        successText="Saved"
        errorText="Try again"
        className="w-full rounded-[var(--radius-control)]"
      >
        {submitLabel}
      </StatefulButton>
      {secondaryAction}
    </form>
  );
}
