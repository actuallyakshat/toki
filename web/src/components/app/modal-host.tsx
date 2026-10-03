"use client";

import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { MorphingModal } from "@/components/motion/morphing-modal";
import { StatefulButton } from "@/components/motion/button";
import { Input } from "@/components/motion/input";
import { useToast } from "@/components/providers/toast-provider";
import { ApiError } from "@/lib/api";
import { useCreateList, useUpdateList } from "@/lib/hooks/use-wishlist";
import { Switch } from "@/components/motion/switch";
import { TokiButton } from "@/components/shared/buttons";
import { IconPanel, IconTrigger } from "@/components/shared/icon-picker";
import { DEFAULT_LIST_ICON } from "@/lib/list-icon-value";
import { setMode } from "@/lib/mode";
import { useApp } from "./app-context";
import { AddItemFlow, useAddFlow } from "./add-item-flow";
import { IncomeForm } from "./income-form";

/** One morphing modal for add, salary and new list. Escape and the backdrop close it. */
export function ModalHost() {
  const { modal, closeModal, setListId } = useApp();
  const flow = useAddFlow();
  const viewId = modal === "add" ? `add-${flow.step}` : modal;

  useEffect(() => {
    if (!modal) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeModal();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [modal, closeModal]);

  const close = () => {
    closeModal();
    flow.reset();
  };

  return (
    <MorphingModal
      viewId={viewId}
      onClose={close}
      placement="center"
      className="max-w-md rounded-[var(--radius-card)] border-0 bg-surface"
    >
      {modal === "add" && <AddItemFlow flow={flow} onClose={close} />}
      {modal === "income" && <IncomeView onClose={close} />}
      {modal === "share" && <ShareView onClose={close} />}
      {modal === "new-list" && <NewListView onClose={close} onCreated={setListId} />}
      {modal === "edit-list" && <EditListView onClose={close} />}
    </MorphingModal>
  );
}

function ViewHeader({ title, hint, onClose }: { title: string; hint?: string; onClose: () => void }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-4">
      <div>
        <h2 className="text-[17px] font-semibold">{title}</h2>
        {hint && <p className="mt-1 text-[13px] text-text-muted">{hint}</p>}
      </div>
      <button type="button" onClick={onClose} aria-label="Close" className="grid size-8 shrink-0 place-items-center rounded-full text-text-muted hover:bg-muted">
        <X className="size-4" aria-hidden />
      </button>
    </div>
  );
}

function IncomeView({ onClose }: { onClose: () => void }) {
  return (
    <div>
      <ViewHeader
        title="What does an hour of your work cost?"
        hint="Toki divides each price by your hourly pay to show it as time."
        onClose={onClose}
      />
      <IncomeForm
        submitLabel="Show prices in hours"
        onSaved={() => {
          setMode("time");
          onClose();
        }}
      />
    </div>
  );
}

function NewListView({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const create = useCreateList();
  const notify = useToast();
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState(DEFAULT_LIST_ICON);
  const [picking, setPicking] = useState(false);
  const [error, setError] = useState<string>();

  return (
    <div>
      <ViewHeader title="Create a list" hint="Lists keep things apart, like Home or Gifts." onClose={onClose} />
      <form
        noValidate
        className="flex flex-col gap-3"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!name.trim()) {
            setError("Enter a name for the list.");
            return;
          }
          try {
            const list = await create.mutateAsync({ name: name.trim(), emoji: emoji.trim() || undefined });
            onCreated(list.id);
            notify({ status: "success", title: "List created", description: list.name });
            onClose();
          } catch (err) {
            setError(err instanceof ApiError ? err.message : "Toki could not create the list. Try again.");
          }
        }}
      >
        <div className="grid grid-cols-[5.5rem_1fr] gap-2">
          <IconTrigger value={emoji} open={picking} onToggle={() => setPicking((p) => !p)} />
          <Input label="Name" value={name} onChange={setName} error={error} reserveErrorLine={!picking} autoFocus autoComplete="off" />
        </div>
        {picking && (
          <IconPanel
            value={emoji}
            onSelect={(next) => {
              setEmoji(next);
              setPicking(false);
            }}
            onClose={() => setPicking(false)}
          />
        )}
        <StatefulButton
          type="submit"
          state={create.isPending ? "loading" : "idle"}
          loadingText="Creating"
          className="w-full rounded-[var(--radius-control)]"
        >
          Create list
        </StatefulButton>
      </form>
    </div>
  );
}

/** Rename the current list or change its icon. A list that still has an emoji keeps it until an icon is picked. */
function EditListView({ onClose }: { onClose: () => void }) {
  const { list } = useApp();
  const update = useUpdateList();
  const notify = useToast();
  const [name, setName] = useState(list?.name ?? "");
  const [emoji, setEmoji] = useState(list?.emoji || DEFAULT_LIST_ICON);
  const [picking, setPicking] = useState(false);
  const [error, setError] = useState<string>();

  if (!list) return null;

  return (
    <div>
      <ViewHeader title="Edit list" hint="Change the name or the icon. Items stay where they are." onClose={onClose} />
      <form
        noValidate
        className="flex flex-col gap-3"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!name.trim()) {
            setError("Enter a name for the list.");
            return;
          }
          try {
            await update.mutateAsync({ id: list.id, name: name.trim(), emoji });
            notify({ status: "success", title: "List updated", description: name.trim() });
            onClose();
          } catch (err) {
            setError(err instanceof ApiError ? err.message : "Toki could not save the list. Try again.");
          }
        }}
      >
        <div className="grid grid-cols-[5.5rem_1fr] gap-2">
          <IconTrigger value={emoji} open={picking} onToggle={() => setPicking((p) => !p)} />
          <Input label="Name" value={name} onChange={setName} error={error} reserveErrorLine={!picking} autoFocus autoComplete="off" />
        </div>
        {picking && (
          <IconPanel
            value={emoji}
            onSelect={(next) => {
              setEmoji(next);
              setPicking(false);
            }}
            onClose={() => setPicking(false)}
          />
        )}
        <StatefulButton
          type="submit"
          state={update.isPending ? "loading" : "idle"}
          loadingText="Saving"
          className="w-full rounded-[var(--radius-control)]"
        >
          Save changes
        </StatefulButton>
      </form>
    </div>
  );
}

function ShareView({ onClose }: { onClose: () => void }) {
  const { list } = useApp();
  const update = useUpdateList();
  const notify = useToast();
  if (!list) return null;
  const shared = list.visibility === "link";
  const link = `${window.location.origin}/s/${list.share_slug}`;

  return (
    <div>
      <ViewHeader title={`Share ${list.name}`} hint="People with the link see the items and prices, not your notes or targets." onClose={onClose} />
      <div className="flex items-center justify-between gap-4">
        <p className="text-[13px] font-medium">Anyone with the link can view</p>
        <Switch
          checked={shared}
          ariaLabel="Anyone with the link can view this list"
          onCheckedChange={(on) =>
            update.mutate(
              { id: list.id, visibility: on ? "link" : "private" },
              { onError: () => notify({ status: "error", title: "Toki could not change sharing", description: "Try again." }) },
            )
          }
        />
      </div>
      {shared && (
        <div className="mt-4 flex items-center gap-2 rounded-[var(--radius-control)] bg-surface-sunk p-2 pl-3">
          <span className="min-w-0 flex-1 truncate text-[13px]">{link}</span>
          <TokiButton
            size="sm"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(link);
                notify({ status: "success", title: "Link copied", description: list.name });
              } catch {
                notify({ status: "error", title: "Toki could not copy the link", description: "Select the link and copy it by hand." });
              }
            }}
          >
            Copy link
          </TokiButton>
        </div>
      )}
    </div>
  );
}
