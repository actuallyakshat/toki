import { redirect } from "next/navigation";

/** Settings open on their first section. Each section has its own page under /app/settings/[section]. */
export default function SettingsIndex() {
  redirect("/app/settings/general");
}
