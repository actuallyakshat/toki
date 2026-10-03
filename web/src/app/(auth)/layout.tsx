import { cookies } from "next/headers";
import { AuthShell } from "@/components/auth/auth-shell";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  // With a session cookie the visitor is probably signed in: hold the form back until /api/me answers.
  const maybeSignedIn = (await cookies()).has("toki_session");
  return <AuthShell maybeSignedIn={maybeSignedIn}>{children}</AuthShell>;
}
