"use client";

import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { SignUpForm } from "@/components/motion/signup-form";
import { ApiError, api } from "@/lib/api";
import { meKey } from "@/lib/hooks/use-session";

export function SignupForm() {
  const router = useRouter();
  const qc = useQueryClient();
  const [error, setError] = useState<string>();

  return (
    <SignUpForm
      simple
      title="Create your Toki account"
      description="You get a wishlist called Wishlist. Add products to it from any store."
      submitLabel="Create account"
      errorMessage={error}
      className="max-w-md rounded-[var(--radius-card)] border-0 bg-surface p-7 shadow-card"
      onSubmit={async ({ name, email, password }) => {
        setError(undefined);
        try {
          await api.signup({ name: name.trim(), email: email.trim(), password });
        } catch (e) {
          setError(
            e instanceof ApiError && e.code === "email_taken"
              ? "That email already has an account. Log in instead."
              : e instanceof ApiError
                ? e.message
                : "Toki could not create the account. Try again.",
          );
          throw e;
        }
        qc.removeQueries({ queryKey: meKey });
        router.push("/app");
      }}
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-foreground underline underline-offset-4">
            Log in
          </Link>
        </>
      }
    />
  );
}
