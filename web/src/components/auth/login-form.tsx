"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Lock, Mail } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { StatefulButton } from "@/components/motion/button";
import { Input } from "@/components/motion/input";
import { ApiError, api } from "@/lib/api";
import { meKey } from "@/lib/hooks/use-session";

type State = "idle" | "loading" | "success" | "error";

export function LoginForm() {
  const router = useRouter();
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [state, setState] = useState<State>("idle");
  const [error, setError] = useState<string>();
  const [missing, setMissing] = useState<{ email?: string; password?: string }>({});

  async function submit(e: FormEvent) {
    e.preventDefault();
    const next = {
      email: email.trim() ? undefined : "Enter your email.",
      password: password ? undefined : "Enter your password.",
    };
    setMissing(next);
    if (next.email || next.password) return;
    setState("loading");
    setError(undefined);
    try {
      await api.login({ email: email.trim(), password });
      setState("success");
      qc.removeQueries({ queryKey: meKey });
      router.push("/app");
    } catch (err) {
      setState("error");
      setError(
        err instanceof ApiError && err.code === "invalid_credentials"
          ? "The email or password is wrong. Check both and try again."
          : err instanceof ApiError
            ? err.message
            : "Toki could not log you in. Try again.",
      );
    }
  }

  return (
    <form
      noValidate
      onSubmit={submit}
      className="flex w-full max-w-md flex-col gap-5 rounded-[var(--radius-card)] bg-surface p-7 shadow-card"
    >
      <div>
        <h1 className="text-[22px] font-semibold">Welcome back</h1>
        <p className="mt-1 text-[13px] text-text-muted">Log in to see your wishlist.</p>
      </div>
      <div className="flex flex-col gap-1">
        <Input
          label="Email"
          type="email"
          inputMode="email"
          autoComplete="email"
          leftIcon={<Mail />}
          value={email}
          onChange={setEmail}
          error={missing.email}
          reserveErrorLine
          disabled={state === "loading"}
        />
        <Input
          label="Password"
          type="password"
          autoComplete="current-password"
          leftIcon={<Lock />}
          value={password}
          onChange={setPassword}
          error={missing.password}
          reserveErrorLine
          disabled={state === "loading"}
        />
      </div>
      {error && (
        <p role="alert" className="rounded-2xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-[12px] text-destructive">
          {error}
        </p>
      )}
      <StatefulButton
        type="submit"
        size="lg"
        state={state}
        loadingText="Logging in"
        successText="Logged in"
        errorText="Try again"
        className="w-full rounded-[var(--radius-control)]"
      >
        Log in
      </StatefulButton>
      <p className="text-center text-[13px] text-text-muted">
        New to Toki?{" "}
        <Link href="/signup" className="font-medium text-foreground underline underline-offset-4">
          Create an account
        </Link>
      </p>
    </form>
  );
}
