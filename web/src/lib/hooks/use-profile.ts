"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/components/providers/toast-provider";
import { api } from "@/lib/api";
import { failureToast, setOptimistic } from "@/lib/optimistic";
import { meKey, type MeData } from "./use-session";
import type { Profile } from "@/lib/types";

/**
 * Instant settings save: toggles flip before the server answers, roll back with an error toast.
 * Forms that show the failure inline pass `toastErrors: false`.
 */
export function useUpdateProfile({ toastErrors = true } = {}) {
  const qc = useQueryClient();
  const notify = useToast();
  const mutation = useMutation({
    mutationFn: (patch: Partial<Profile>) => api.updateProfile(patch),
    onMutate: async (patch) => ({
      previous: await setOptimistic<MeData>(qc, meKey, (old) =>
        old ? { ...old, profile: { ...old.profile, ...patch } } : old,
      ),
    }),
    onError: (e, patch, ctx) => {
      qc.setQueryData(meKey, ctx?.previous);
      if (toastErrors) failureToast(notify, "Toki could not save that setting", e, () => mutation.mutate(patch));
    },
    onSuccess: ({ profile }) => {
      qc.setQueryData<MeData>(meKey, (old) => (old ? { ...old, profile } : old));
    },
  });
  return mutation;
}
