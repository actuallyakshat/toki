"use client";

import { Clock, CheckCheck, LayoutGrid, List as ListIcon, Moon, Pencil, Plus, Search, Settings, Tag } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { CommandPalette, type CommandItem } from "@/components/motion/command-palette";
import { useThemeToggle } from "@/components/motion/theme-toggle";
import { useItems } from "@/lib/hooks/use-wishlist";
import { useApp } from "./app-context";

export function CommandMenu() {
  const router = useRouter();
  const { list, lists, setListId, mode, requestMode, openModal, openItem, paletteOpen, setPaletteOpen } = useApp();
  const items = useItems(list?.id);
  const { toggle: toggleTheme, isDark } = useThemeToggle({ variant: "circle" });

  const commands = useMemo<CommandItem[]>(() => {
    const actions: CommandItem[] = [
      { id: "add", label: "Add an item", group: "Actions", icon: Plus, keywords: ["new", "paste", "link"], onSelect: () => openModal("add") },
      {
        id: "mode",
        label: mode === "time" ? "Show prices in rupees" : "Show prices in hours of work",
        group: "Actions",
        icon: Clock,
        keywords: ["time", "currency", "hours", "toggle"],
        onSelect: () => requestMode(mode === "time" ? "money" : "time"),
      },
      {
        id: "theme",
        label: isDark ? "Switch to light theme" : "Switch to dark theme",
        group: "Actions",
        icon: Moon,
        keywords: ["dark", "light", "night"],
        onSelect: toggleTheme,
      },
      { id: "new-list", label: "Create a list", group: "Actions", icon: ListIcon, onSelect: () => openModal("new-list") },
      { id: "edit-list", label: "Edit this list", group: "Actions", icon: Pencil, keywords: ["rename", "icon", "emoji"], onSelect: () => openModal("edit-list") },
      { id: "go-wishlist", label: "Go to wishlist", group: "Go to", icon: Tag, onSelect: () => router.push("/app") },
      { id: "go-all", label: "Go to all items", group: "Go to", icon: LayoutGrid, keywords: ["every", "products", "lists"], onSelect: () => router.push("/app/all") },
      { id: "go-bought", label: "Go to bought", group: "Go to", icon: CheckCheck, onSelect: () => router.push("/app/bought") },
      { id: "go-settings", label: "Go to settings", group: "Go to", icon: Settings, onSelect: () => router.push("/app/settings") },
    ];
    const switchList: CommandItem[] = lists
      .filter((l) => l.id !== list?.id)
      .map((l) => ({
        id: `list-${l.id}`,
        label: `Switch to ${l.name}`,
        group: "Lists",
        icon: ListIcon,
        onSelect: () => {
          setListId(l.id);
          router.push("/app");
        },
      }));
    const found: CommandItem[] = (items.data ?? []).map((i) => ({
      id: `item-${i.id}`,
      label: i.product.title,
      group: "Items",
      icon: Search,
      keywords: [i.product.retailer],
      onSelect: () => {
        router.push("/app");
        openItem(i.id);
      },
    }));
    return [...actions, ...switchList, ...found];
  }, [items.data, lists, list?.id, mode, isDark, toggleTheme, requestMode, openModal, openItem, setListId, router]);

  return (
    <CommandPalette
      open={paletteOpen}
      onOpenChange={setPaletteOpen}
      items={commands}
      placeholder="Search items, switch lists, or run an action"
      emptyMessage="Nothing matches. Try a product name or an action such as Add an item."
    />
  );
}
