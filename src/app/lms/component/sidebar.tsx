"use client";
import { getToken } from "@/lib/session";

import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
    X,
    BookOpen,
    ChevronDown,
    LogOut,
    User as UserIcon,
    Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSidebar } from "./layout";
import { logoutUser } from "@/apiServices/tokenVerify";
import { postLogout } from "@/apiServices/activityLog";
import NotificationDot from "./NotificationDot";
// The permission → route derivation (types, icon lookup, admin whitelist and
// the Business Management merge) lives in ONE shared pure module so the
// command palette can never disagree with the sidebar.
import {
    buildNavForStoredUser,
    groupSidebarItems,
    USER_DATA_KEY,
    type SidebarItem,
    type UserData,
    type UserPermission,
} from "../shared/ui/navItems";

interface SidebarProps {
    className?: string;
}

// Rail geometry + the one spring every width/pill move shares.
// 268, not 244: at 244 the label box came out ~150px once the 18px icon, the
// 12px gap, the chevron and the submenu indent were subtracted — and the
// longest real labels ("Attendance Management", "Business Management") need
// ~165px at text-sm. They truncated in the live nav, which reads as unfinished.
const EXPANDED_W = 268;
const COLLAPSED_W = 64;
const sidebarSpring = { type: "spring" as const, stiffness: 400, damping: 34 };

export function Sidebar({ className }: SidebarProps) {
    const pathname = usePathname();
    const router = useRouter();
    const { isCollapsed, setIsCollapsed } = useSidebar();
    const [isMobile, setIsMobile] = useState(false);
    const [userPermissions, setUserPermissions] = useState<UserPermission[]>([]);
    const [sidebarItems, setSidebarItems] = useState<SidebarItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [hoveredItem, setHoveredItem] = useState<string | null>(null);
    const [currentUser, setCurrentUser] = useState<UserData | null>(null);
    const [showUserMenu, setShowUserMenu] = useState(false);
    const [isLoggingOut, setIsLoggingOut] = useState(false);
    // Submenus the user has explicitly toggled. A key absent here falls back to
    // "open while you are inside that section", so the submenu is there when it
    // is relevant without the user having to open it first.
    const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({});

    // Check if mobile view
    useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth < 768);
        };

        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    // Load user permissions from localStorage
    useEffect(() => {
        const loadUserPermissions = () => {
            try {
                const userDataString = localStorage.getItem(USER_DATA_KEY);

                if (!userDataString) {
                    console.error("No user data found in localStorage");
                    setLoading(false);
                    return;
                }

                const userData: UserData = JSON.parse(userDataString);
                setCurrentUser(userData);

                setUserPermissions(userData?.permissions || []);
                // Roles with a dedicated static console (POC) get theirs;
                // everyone else keeps the permission-derived rail. Going
                // through the shared helper rather than buildSidebarItems is
                // what stops a POC's stale admin permission keys rendering the
                // admin rail on any page that mounts this shell.
                setSidebarItems(buildNavForStoredUser(userData));
            } catch (error) {
                console.error("Error loading user data from localStorage:", error);
                setSidebarItems([]);
            } finally {
                setLoading(false);
            }
        };

        loadUserPermissions();
    }, []);

    // Handle sidebar item click — no side effects beyond navigation.
    // (The Recents section that lived here was removed; the localStorage
    // purge in clearUserData still cleans up any legacy stored entries.)
    const handleItemClick = (item: SidebarItem) => {
        if (isMobile) setIsCollapsed(true);
        router.push(item.href);
    };

    const handleSignOut = async () => {
        setIsLoggingOut(true);
        const token = getToken();
        try {
            await postLogout();
            if (token) await logoutUser(token);
        } catch (error) {
            console.error("Logout error:", error);
        } finally {
            // Clear every smartcliff_* key plus cached query data
            const keysToRemove: string[] = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && (key.startsWith('smartcliff') || key.includes('rq-cache') || key.includes('react-query') || key.includes('tanstack'))) {
                    keysToRemove.push(key);
                }
            }
            keysToRemove.forEach(key => localStorage.removeItem(key));
            window.location.href = "/login";
        }
    };

    const userFullName = currentUser
        ? `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim() || 'User'
        : 'User';
    const userRoleLabel = currentUser?.role?.renameRole || currentUser?.role?.originalRole || 'User';
    const userInitial = (currentUser?.firstName?.charAt(0) || 'U').toUpperCase();

    const onRoute = (href: string) =>
        pathname === href || pathname?.startsWith(href + '/');

    const navGroups = groupSidebarItems(sidebarItems);

    return (
        <TooltipPrimitive.Provider delayDuration={200} skipDelayDuration={100}>
            <motion.div
                initial={false}
                animate={{ width: isCollapsed ? COLLAPSED_W : EXPANDED_W }}
                transition={sidebarSpring}
                className={cn(
                    // Flat on the gray canvas (floating-workspace shell): no
                    // surface, no right border. The mobile overlay keeps a
                    // solid surface so content can't bleed through it.
                    "relative z-40 h-full flex flex-col overflow-hidden",
                    isMobile && !isCollapsed ? "fixed top-0 left-0 shadow-xl bg-surface" : "bg-transparent",
                    className
                )}
            >
                {/* Brand card — a raised white block on the gray rail. It also
                    hosts the collapse toggle, which used to live in the (now
                    removed) navbar's hamburger. */}
                <div className={cn("flex-shrink-0 overflow-hidden", isCollapsed ? "px-2 pt-3 pb-1" : "px-3 pt-3 pb-1")}>
                    <div className={cn(
                        "flex items-center rounded-[14px] border border-hairline bg-surface shadow-xs",
                        isCollapsed ? "flex-col gap-1.5 px-1 py-2" : "gap-2.5 px-3 py-2"
                    )}>
                        <div className="w-8 h-8 bg-gradient-to-b from-brand-400 to-brand-600 rounded-tile flex items-center justify-center flex-shrink-0 shadow-sm">
                            <BookOpen className="w-[17px] h-[17px] text-white" />
                        </div>
                        {!isCollapsed && (
                            <div className="min-w-0 flex-1 whitespace-nowrap">
                                <p className="text-md font-bold tracking-[-0.01em] text-heading leading-tight">
                                    SmartCliff
                                </p>
                                <p className="text-2xs text-subtle truncate leading-tight">
                                    {userRoleLabel}
                                </p>
                            </div>
                        )}
                        <button
                            type="button"
                            aria-label={isCollapsed ? "Expand navigation" : "Collapse navigation"}
                            aria-expanded={!isCollapsed}
                            onClick={() => setIsCollapsed(!isCollapsed)}
                            className="flex-shrink-0 inline-flex h-6 w-6 items-center justify-center rounded-control text-faint hover:bg-row-hover hover:text-body transition-colors"
                        >
                            <ChevronDown className={cn(
                                "w-4 h-4 transition-transform duration-150",
                                isCollapsed ? "-rotate-90" : "rotate-90"
                            )} />
                        </button>
                    </div>
                </div>

                {/* Scrollable middle: grouped nav */}
                <div className="flex-1 overflow-y-auto overflow-x-hidden pt-3 pb-3 [scrollbar-width:thin]">
                    {loading ? (
                        <div className="px-4 py-2">
                            <div className="animate-pulse space-y-3">
                                {[...Array(6)].map((_, i) => (
                                    <div key={i} className="flex items-center gap-3">
                                        <div className="w-8 h-8 bg-ink-100 rounded-lg flex-shrink-0" />
                                        {!isCollapsed && <div className="h-3.5 bg-ink-100 rounded w-28" />}
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <nav className="px-3 space-y-0.5">
                            {/* Group labels are not rendered — a flat list,
                                matching the app's other rails. groupSidebarItems
                                still orders the items. */}
                            {navGroups.map((group) => (
                                <div key={group.label}>
                                    <div className="space-y-0.5">
                                        {group.items.map((item) => {
                                            const Icon = item.icon;
                                            // Children are real routes now, so the parent
                                            // counts as active when ANY of its pages is open —
                                            // its own href only points at the first child.
                                            const isActive = onRoute(item.href) ||
                                                (item.children || []).some((c) => onRoute(c.href));
                                            const itemKey = item.permissionKey || item.href;
                                            // The collapsed rail has no room for a submenu,
                                            // so there the parent stays a plain link and the
                                            // pages are reached through it instead.
                                            const subItems = isCollapsed ? [] : (item.children || []);
                                            // Show the section's tabs (Clients / Services) by default so the
                                            // submenu is visible without having to expand it first; the user
                                            // can still collapse it with the chevron.
                                            const submenuOpen = subItems.length > 0 && (openMenus[itemKey] ?? true);

                                            const row = (
                                                <div
                                                    onClick={() => handleItemClick(item)}
                                                    className={cn(
                                                        "relative flex items-center rounded-[10px] cursor-pointer group transition-colors duration-150 border",
                                                        isCollapsed
                                                            ? "justify-center w-9 h-9 mx-auto"
                                                            : "justify-between gap-3 pl-3 pr-2 h-9",
                                                        // White raised pill on the gray rail; hover one step
                                                        // darker than the canvas so it stays visible there.
                                                        isActive
                                                            ? "bg-surface border-hairline shadow-xs"
                                                            : "border-transparent hover:bg-line"
                                                    )}
                                                >
                                                    <div className={cn("flex items-center", isCollapsed ? "" : "gap-3 min-w-0")}>
                                                        <Icon className={cn(
                                                            "w-[18px] h-[18px] flex-shrink-0",
                                                            isActive
                                                                ? "text-heading"
                                                                : "text-subtle group-hover:text-body"
                                                        )} />
                                                        {!isCollapsed && (
                                                            <span className={cn(
                                                                "text-sm truncate whitespace-nowrap flex items-center gap-1",
                                                                // Both states read in normal weight — the raised
                                                                // white pill + shadow already carries "selected",
                                                                // and heavy weight on every row made the rail
                                                                // feel loud.
                                                                isActive
                                                                    ? "text-heading font-medium"
                                                                    : "text-body font-normal"
                                                            )}>
                                                                {item.title}
                                                                {/* Red blinking unread indicator, only for the
                                                                    Notification entry — mounted here so the dot
                                                                    lives beside the label text (not the icon)
                                                                    and reads as "N unread" at a glance. */}
                                                                {item.permissionKey === 'notifications' && (
                                                                    <NotificationDot />
                                                                )}
                                                            </span>
                                                        )}
                                                    </div>
                                                    {/* Selection is carried by bg-brand-wash ALONE. There used to
                                                        be three markers competing here — a left bar, the wash,
                                                        and a trailing dot — so a parent and its active child were
                                                        marked two different ways, and the dot read as a
                                                        notification badge rather than "you are here". The chevron
                                                        below is disclosure, not selection. */}
                                                    {!isCollapsed && subItems.length > 0 && (
                                                        <button
                                                            type="button"
                                                            aria-label={submenuOpen ? `Collapse ${item.title}` : `Expand ${item.title}`}
                                                            aria-expanded={submenuOpen}
                                                            onClick={(e) => {
                                                                // Without this the parent row's own click
                                                                // handler would navigate away as it opens.
                                                                e.stopPropagation();
                                                                setOpenMenus(prev => ({ ...prev, [itemKey]: !submenuOpen }));
                                                            }}
                                                            className="p-0.5 rounded hover:bg-black/5 flex-shrink-0"
                                                        >
                                                            <ChevronDown className={cn(
                                                                "w-3.5 h-3.5 transition-transform duration-150",
                                                                submenuOpen && "rotate-180",
                                                                isActive ? "text-heading" : "text-faint"
                                                            )} />
                                                        </button>
                                                    )}
                                                </div>
                                            );

                                            return (
                                                <div key={itemKey}>
                                                    {isCollapsed ? (
                                                        <TooltipPrimitive.Root>
                                                            <TooltipPrimitive.Trigger asChild>
                                                                {row}
                                                            </TooltipPrimitive.Trigger>
                                                            <TooltipPrimitive.Portal>
                                                                <TooltipPrimitive.Content
                                                                    side="right"
                                                                    sideOffset={12}
                                                                    className="z-popover rounded-chip bg-ink-800 px-3 py-1.5 text-xs font-medium text-white shadow-md whitespace-nowrap select-none"
                                                                >
                                                                    {item.title}
                                                                </TooltipPrimitive.Content>
                                                            </TooltipPrimitive.Portal>
                                                        </TooltipPrimitive.Root>
                                                    ) : (
                                                        row
                                                    )}

                                                    {/* Tabs of the section, as their own rows. The rule down the
                                                        left ties them to the parent so a long list still reads as
                                                        one group. */}
                                                    {submenuOpen && (
                                                        <div className="mt-0.5 mb-1 ml-[27px] pl-2.5 border-l border-hairline space-y-0.5">
                                                            {subItems.map((child) => {
                                                                const ChildIcon = child.icon;
                                                                const childActive = onRoute(child.href);
                                                                return (
                                                                    <div
                                                                        key={child.href}
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            handleItemClick(child);
                                                                        }}
                                                                        className={cn(
                                                                            "flex items-center gap-2.5 h-8 px-2 rounded-[8px] cursor-pointer group transition-colors duration-150 border",
                                                                            childActive
                                                                                ? "bg-surface border-hairline shadow-xs"
                                                                                : "border-transparent hover:bg-line"
                                                                        )}
                                                                    >
                                                                        <ChildIcon className={cn(
                                                                            "w-[15px] h-[15px] flex-shrink-0",
                                                                            childActive
                                                                                ? "text-heading"
                                                                                : "text-faint group-hover:text-body"
                                                                        )} />
                                                                        <span className={cn(
                                                                            "text-sm truncate whitespace-nowrap",
                                                                            childActive
                                                                                ? "text-heading font-medium"
                                                                                : "text-body font-normal"
                                                                        )}>
                                                                            {child.title}
                                                                        </span>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}

                        </nav>
                    )}
                </div>

                {/* User card (bottom) */}
                <div className={cn("flex-shrink-0 border-t border-hairline", isCollapsed ? "p-2" : "p-3")}>
                    <DropdownMenu open={showUserMenu} onOpenChange={setShowUserMenu}>
                        <DropdownMenuTrigger asChild>
                            <button
                                // Flat identity row (no card box), reference-style.
                                className={cn(
                                    "w-full flex items-center rounded-tile transition-colors duration-150",
                                    isCollapsed
                                        ? "justify-center p-1.5 hover:bg-line"
                                        : "gap-2.5 p-2 hover:bg-line"
                                )}
                            >
                                <div className="w-8 h-8 rounded-full bg-ink-900 flex items-center justify-center flex-shrink-0">
                                    <span className="text-white text-xs font-semibold">{userInitial}</span>
                                </div>
                                {!isCollapsed && (
                                    <>
                                        <div className="flex-1 min-w-0 text-left whitespace-nowrap">
                                            <p className="text-sm font-semibold text-heading truncate leading-tight">
                                                {userFullName}
                                            </p>
                                            <p className="text-2xs text-subtle truncate leading-tight mt-0.5">
                                                {userRoleLabel}
                                            </p>
                                        </div>
                                        <ChevronDown className={cn(
                                            "w-4 h-4 text-faint flex-shrink-0 transition-transform duration-150",
                                            showUserMenu && "rotate-180"
                                        )} />
                                    </>
                                )}
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                            side="top"
                            align="start"
                            sideOffset={8}
                            className="w-52 bg-surface border border-hairline-strong rounded-tile shadow-lg p-1.5 z-popover"
                        >
                            <DropdownMenuItem
                                onClick={() => { setShowUserMenu(false); router.push('/lms/pages/profile'); }}
                                className="flex items-center gap-2.5 px-2.5 py-2 text-sm font-medium text-body rounded-chip hover:bg-row-hover transition-colors cursor-pointer"
                            >
                                <UserIcon className="w-4 h-4 text-subtle" />
                                Profile
                            </DropdownMenuItem>
                            <DropdownMenuSeparator className="my-1 bg-hairline" />
                            <DropdownMenuItem
                                onSelect={(e) => {
                                    // Keep the menu open so the signing-out spinner is
                                    // visible until the redirect lands.
                                    e.preventDefault();
                                    handleSignOut();
                                }}
                                disabled={isLoggingOut}
                                className="flex items-center gap-2.5 px-2.5 py-2 text-sm font-medium text-danger-700 rounded-chip hover:bg-danger-50 transition-colors cursor-pointer disabled:opacity-60"
                            >
                                {isLoggingOut
                                    ? <Loader2 className="w-4 h-4 animate-spin" />
                                    : <LogOut className="w-4 h-4 text-danger-700" />}
                                {isLoggingOut ? "Signing out..." : "Sign Out"}
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </motion.div>

            {isMobile && !isCollapsed && (
                <Button
                    variant="ghost"
                    size="icon"
                    className="fixed top-4 right-4 w-10 h-10 rounded-full bg-surface shadow-lg hover:bg-row-hover z-overlay border border-hairline-strong"
                    onClick={() => setIsCollapsed(true)}
                >
                    <X className="h-5 w-5" />
                </Button>
            )}

            {isMobile && !isCollapsed && (
                <div
                    className="fixed inset-0 bg-black/50 z-30 md:hidden"
                    onClick={() => setIsCollapsed(true)}
                />
            )}
        </TooltipPrimitive.Provider>
    );
}

// Export utility functions if needed elsewhere
export const getCurrentUser = (): UserData | null => {
    try {
        const userDataString = localStorage.getItem(USER_DATA_KEY);
        return userDataString ? JSON.parse(userDataString) : null;
    } catch (error) {
        console.error("Error getting user data:", error);
        return null;
    }
};

export const updateUserData = (updatedData: Partial<UserData>) => {
    try {
        const currentUserData = getCurrentUser();
        if (currentUserData) {
            const newUserData = { ...currentUserData, ...updatedData };
            localStorage.setItem(USER_DATA_KEY, JSON.stringify(newUserData));
        }
    } catch (error) {
        console.error("Error updating user data:", error);
    }
};

export const clearUserData = () => {
    localStorage.removeItem(USER_DATA_KEY);
    localStorage.removeItem("smartcliff_token");
    localStorage.removeItem("smartcliff_recent_sidebar_items");
};
