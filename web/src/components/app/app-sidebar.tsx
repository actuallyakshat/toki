"use client";

import { CheckCheck, ChevronLeft, LayoutGrid, Plus, Settings } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  AnimatedSidebar,
  AnimatedSidebarClose,
  AnimatedSidebarContent,
  AnimatedSidebarFooter,
  AnimatedSidebarGroup,
  AnimatedSidebarGroupContent,
  AnimatedSidebarGroupLabel,
  AnimatedSidebarHeader,
  AnimatedSidebarMenu,
  AnimatedSidebarMenuButton,
  AnimatedSidebarMenuItem,
  AnimatedSidebarRail,
  AnimatedSidebarTrigger,
} from "@/components/motion/animated-sidebar";
import { ThemeToggle } from "@/components/motion/theme-toggle";
import { PanelLeft, X } from "lucide-react";
import { SETTINGS_SECTIONS, settingsHref } from "@/lib/settings-sections";
import { ListIcon } from "@/components/shared/list-icon";
import { useApp } from "./app-context";

const SETTINGS_GROUPS = [...new Set(SETTINGS_SECTIONS.map((s) => s.group))];

/** Folded icon rail on desktop, a sheet on mobile. */
export function AppSidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const { lists, list, setListId, openModal } = useApp();
  const inSettings = pathname.startsWith("/app/settings");

  return (
    <AnimatedSidebar ariaLabel="Toki" collapsible="icon" variant="sidebar" panelClassName="bg-background">
      <AnimatedSidebarHeader className="p-3 pb-2">
        <div className="flex min-h-11 items-center gap-3 overflow-hidden px-1">
          <AnimatedSidebarTrigger className="hidden shrink-0 text-text-muted hover:bg-muted md:inline-flex" aria-label="Fold or unfold the sidebar">
            <PanelLeft className="size-5" aria-hidden />
          </AnimatedSidebarTrigger>
          <Link
            href="/"
            className="rounded-md font-display text-[17px] font-semibold tracking-[-0.04em] group-data-[state=collapsed]/sidebar:hidden"
          >
            Toki
          </Link>
          <AnimatedSidebarClose className="ml-auto text-text-muted hover:bg-muted md:hidden">
            <X className="size-4" aria-hidden />
          </AnimatedSidebarClose>
        </div>
      </AnimatedSidebarHeader>

      <AnimatedSidebarContent className="px-2 pt-1">
        {inSettings ? (
          // Settings swap the sidebar for their own grouped nav, after monocode.
          SETTINGS_GROUPS.map((group, gi) => (
            <AnimatedSidebarGroup key={group} className={gi > 0 ? "pt-2" : undefined}>
              <AnimatedSidebarGroupLabel>{group}</AnimatedSidebarGroupLabel>
              <AnimatedSidebarGroupContent>
                <AnimatedSidebarMenu>
                  {SETTINGS_SECTIONS.filter((s) => s.group === group).map((section) => (
                    <AnimatedSidebarMenuItem key={section.id}>
                      <AnimatedSidebarMenuButton
                        isActive={pathname === settingsHref(section.id)}
                        icon={<section.icon className="size-4" />}
                        onSelect={() => router.push(settingsHref(section.id))}
                      >
                        {section.label}
                      </AnimatedSidebarMenuButton>
                    </AnimatedSidebarMenuItem>
                  ))}
                </AnimatedSidebarMenu>
              </AnimatedSidebarGroupContent>
            </AnimatedSidebarGroup>
          ))
        ) : (
          <>
        <AnimatedSidebarGroup>
          <AnimatedSidebarGroupLabel>Lists</AnimatedSidebarGroupLabel>
          <AnimatedSidebarGroupContent>
            <AnimatedSidebarMenu>
              {lists.map((l) => (
                <AnimatedSidebarMenuItem key={l.id}>
                  <AnimatedSidebarMenuButton
                    isActive={pathname === "/app" && list?.id === l.id}
                    icon={<ListIcon value={l.emoji} />}
                    badge={l.item_count > 0 ? l.item_count : undefined}
                    onSelect={() => {
                      setListId(l.id);
                      router.push("/app");
                    }}
                  >
                    {l.name}
                  </AnimatedSidebarMenuButton>
                </AnimatedSidebarMenuItem>
              ))}
              <AnimatedSidebarMenuItem>
                <AnimatedSidebarMenuButton icon={<Plus className="size-4" />} onSelect={() => openModal("new-list")}>
                  New list
                </AnimatedSidebarMenuButton>
              </AnimatedSidebarMenuItem>
            </AnimatedSidebarMenu>
          </AnimatedSidebarGroupContent>
        </AnimatedSidebarGroup>

        <AnimatedSidebarGroup className="pt-2">
          <AnimatedSidebarGroupLabel>Library</AnimatedSidebarGroupLabel>
          <AnimatedSidebarGroupContent>
            <AnimatedSidebarMenu>
              <AnimatedSidebarMenuItem>
                <AnimatedSidebarMenuButton
                  isActive={pathname === "/app/all"}
                  icon={<LayoutGrid className="size-4" />}
                  onSelect={() => router.push("/app/all")}
                >
                  All items
                </AnimatedSidebarMenuButton>
              </AnimatedSidebarMenuItem>
              <AnimatedSidebarMenuItem>
                <AnimatedSidebarMenuButton
                  isActive={pathname === "/app/bought"}
                  icon={<CheckCheck className="size-4" />}
                  onSelect={() => router.push("/app/bought")}
                >
                  Bought
                </AnimatedSidebarMenuButton>
              </AnimatedSidebarMenuItem>
              <AnimatedSidebarMenuItem>
                <AnimatedSidebarMenuButton
                  isActive={pathname.startsWith("/app/settings")}
                  icon={<Settings className="size-4" />}
                  onSelect={() => router.push("/app/settings")}
                >
                  Settings
                </AnimatedSidebarMenuButton>
              </AnimatedSidebarMenuItem>
            </AnimatedSidebarMenu>
          </AnimatedSidebarGroupContent>
        </AnimatedSidebarGroup>
          </>
        )}
      </AnimatedSidebarContent>

      <AnimatedSidebarFooter className="border-none p-3">
        {inSettings ? (
          <AnimatedSidebarMenu>
            <AnimatedSidebarMenuItem>
              <AnimatedSidebarMenuButton icon={<ChevronLeft className="size-4" />} onSelect={() => router.push("/app")}>
                Back
              </AnimatedSidebarMenuButton>
            </AnimatedSidebarMenuItem>
          </AnimatedSidebarMenu>
        ) : (
          <ThemeToggle
            variant="circle"
            className="size-11 rounded-xl text-text-muted hover:bg-muted hover:text-text"
            iconClassName="size-5"
          />
        )}
      </AnimatedSidebarFooter>
      <AnimatedSidebarRail />
    </AnimatedSidebar>
  );
}
