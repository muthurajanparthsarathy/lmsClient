"use client";

// Global command palette (⌘K / Ctrl+K) — cmdk list inside a Radix Dialog.
// Items are derived from localStorage `smartcliff_userData` through the SAME
// pure helpers the sidebar uses (navItems.ts), so the palette can never offer
// a route the sidebar would not.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import { Command } from "cmdk";
import { motion } from "framer-motion";
import { Search, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import {
    buildSidebarItems,
    groupSidebarItems,
    isAdminRole,
    readStoredUserData,
    type NavGroup,
    type SidebarItem,
} from "./navItems";

export interface CommandPaletteProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** Wire the host's existing sign-out handler (e.g. the navbar's handleLogout). */
    onSignOut?: () => void;
    className?: string;
}

/** Tiny state helper so any host can mount a palette with one line. */
export function useCommandPalette() {
    const [open, setOpen] = useState(false);
    return { open, setOpen };
}

interface PaletteEntry {
    title: string;
    href: string;
    icon: SidebarItem["icon"];
    /** Extra terms cmdk should match against (parent title for children). */
    keywords: string;
}

// A merged parent (Business Management) navigates to its first child; list the
// parent AND each child so both tabs are reachable and searchable.
const flattenGroup = (group: NavGroup): PaletteEntry[] => {
    const entries: PaletteEntry[] = [];
    group.items.forEach((item) => {
        entries.push({ title: item.title, href: item.href, icon: item.icon, keywords: group.label });
        (item.children || []).forEach((child) => {
            entries.push({
                title: child.title,
                href: child.href,
                icon: child.icon,
                keywords: `${group.label} ${item.title}`,
            });
        });
    });
    return entries;
};

export function CommandPalette({ open, onOpenChange, onSignOut, className }: CommandPaletteProps) {
    const router = useRouter();
    const [groups, setGroups] = useState<NavGroup[]>([]);

    // ⌘K / Ctrl+K global toggle
    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
                e.preventDefault();
                onOpenChange(!open);
            }
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [open, onOpenChange]);

    // Re-derive on every open so a changed user/permission set is picked up.
    useEffect(() => {
        if (!open) return;
        const userData = readStoredUserData();
        if (userData?.permissions) {
            const items = buildSidebarItems(userData.permissions, isAdminRole(userData));
            setGroups(groupSidebarItems(items));
        } else {
            setGroups([]);
        }
    }, [open]);

    const go = (href: string) => {
        onOpenChange(false);
        router.push(href);
    };

    return (
        <Dialog.Root open={open} onOpenChange={onOpenChange}>
            <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 z-modal bg-ink-900/40" />
                <Dialog.Content
                    aria-describedby={undefined}
                    className={cn(
                        "fixed left-1/2 top-[14%] z-modal w-[560px] max-w-[calc(100vw-2rem)] -translate-x-1/2 outline-none",
                        className
                    )}
                >
                    <Dialog.Title className="sr-only">Command palette</Dialog.Title>
                    <motion.div
                        initial={{ opacity: 0, scale: 0.98, y: -6 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}
                        className="overflow-hidden rounded-xl border border-hairline bg-surface shadow-xl"
                    >
                        <Command loop>
                            {/* Input row */}
                            <div className="flex items-center gap-2.5 border-b border-hairline px-4">
                                <Search className="h-4 w-4 flex-shrink-0 text-faint" />
                                <Command.Input
                                    autoFocus
                                    placeholder="Search pages and actions…"
                                    className="h-12 flex-1 bg-transparent text-base text-heading outline-none placeholder:text-faint"
                                />
                                <kbd className="flex h-5 flex-shrink-0 items-center rounded border border-hairline-strong bg-canvas px-1.5 text-2xs font-medium text-subtle">
                                    esc
                                </kbd>
                            </div>

                            <Command.List className="max-h-[320px] overflow-y-auto p-2 [scrollbar-width:thin]">
                                <Command.Empty className="py-10 text-center text-sm text-subtle">
                                    No results found.
                                </Command.Empty>

                                {groups.map((group) => (
                                    <Command.Group
                                        key={group.label}
                                        heading={group.label}
                                        className="[&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:text-2xs [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-faint"
                                    >
                                        {flattenGroup(group).map((entry) => {
                                            const Icon = entry.icon;
                                            return (
                                                <Command.Item
                                                    key={`${group.label}-${entry.title}`}
                                                    value={`${group.label} ${entry.title}`}
                                                    keywords={[entry.keywords, entry.href]}
                                                    onSelect={() => go(entry.href)}
                                                    className="flex h-10 cursor-pointer items-center gap-3 rounded-lg px-2.5 text-sm text-body transition-colors duration-150 data-[selected=true]:bg-brand-wash data-[selected=true]:text-brand-strong"
                                                >
                                                    <Icon className="h-[17px] w-[17px] flex-shrink-0" />
                                                    <span className="flex-1 truncate">{entry.title}</span>
                                                </Command.Item>
                                            );
                                        })}
                                    </Command.Group>
                                ))}

                                {onSignOut && (
                                    <Command.Group
                                        heading="Account"
                                        className="[&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:text-2xs [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-faint"
                                    >
                                        <Command.Item
                                            value="account sign out log out"
                                            onSelect={() => {
                                                onOpenChange(false);
                                                onSignOut();
                                            }}
                                            className="flex h-10 cursor-pointer items-center gap-3 rounded-lg px-2.5 text-sm text-danger-700 transition-colors duration-150 data-[selected=true]:bg-danger-50"
                                        >
                                            <LogOut className="h-[17px] w-[17px] flex-shrink-0" />
                                            <span className="flex-1 truncate">Sign out</span>
                                        </Command.Item>
                                    </Command.Group>
                                )}
                            </Command.List>

                            {/* Footer hint row */}
                            <div className="flex h-9 items-center gap-4 border-t border-hairline bg-canvas px-4 text-2xs text-faint">
                                <span className="flex items-center gap-1.5">
                                    <kbd className="flex h-4 items-center rounded border border-hairline-strong bg-surface px-1 font-medium">↑↓</kbd>
                                    navigate
                                </span>
                                <span className="flex items-center gap-1.5">
                                    <kbd className="flex h-4 items-center rounded border border-hairline-strong bg-surface px-1 font-medium">↵</kbd>
                                    open
                                </span>
                                <span className="flex items-center gap-1.5">
                                    <kbd className="flex h-4 items-center rounded border border-hairline-strong bg-surface px-1 font-medium">esc</kbd>
                                    close
                                </span>
                            </div>
                        </Command>
                    </motion.div>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
}
