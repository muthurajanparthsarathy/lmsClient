"use client";

/**
 * Account avatar + dropdown for the L&D console top bar.
 *
 * Same slot, same behaviour as the admin navbar's user menu — it just lives in
 * the L&D shell's fixed filter bar and routes Profile to the console's own
 * `#profile` view, because the console is hash-routed rather than a set of
 * pages. All of the behaviour (current user, role switch, sign out) comes from
 * the shared useAccountMenu hook, so this menu cannot drift from the others.
 */

import {
  HelpCircle,
  Loader2,
  LogOut,
  Settings,
  User,
  UserCheck2,
  Zap,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAccountMenu } from "../useAccountMenu";

/** `rail` swaps the avatar trigger for a compact overflow button, for use in the
    sidebar footer — the identity is already spelled out beside it there, so a
    second avatar would just repeat it. The MENU is identical either way. */
export default function LDAccountMenu({ variant = "topbar" }: { variant?: "topbar" | "rail" } = {}) {
  const {
    user,
    userLoading,
    getUserInitials,
    getFullName,
    isLoggingOut,
    handleLogout,
    isDummyStudent,
    originalRoleInfo,
    isActualStudent,
    switchToStudent,
    switchBackToOriginal,
  } = useAccountMenu({ returnTo: "/lms/pages/lddashboard", stayOnSwitch: true });

  const goToProfile = () => {
    // Hash-routed console: the shell's own Profile & Access view.
    window.location.hash = "profile";
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="ldx-acct"
          aria-label="Account menu"
          disabled={userLoading}
        >
          {userLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : variant === "rail" ? (
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
              <circle cx="12" cy="5" r="1.6" />
              <circle cx="12" cy="12" r="1.6" />
              <circle cx="12" cy="19" r="1.6" />
            </svg>
          ) : (
            <span className="relative inline-flex">
              <Avatar className="h-8 w-8">
                <AvatarImage src={user?.profile} alt={getFullName()} />
                {/* brand-strong (700), not 500: white on #F97316 is 2.8:1 — AA fail */}
                <AvatarFallback className="bg-brand-strong text-white font-semibold text-xs">
                  {getUserInitials()}
                </AvatarFallback>
              </Avatar>
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-success-500 rounded-full ring-2 ring-surface" />
            </span>
          )}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        className="w-64 bg-surface border border-hairline-strong shadow-lg rounded-tile p-2 z-popover"
        align="end"
        sideOffset={8}
        forceMount
      >
        <DropdownMenuLabel className="font-normal p-0 mb-2">
          <div className="flex items-center gap-3 p-3 bg-surface-sunken rounded-chip">
            <Avatar className="h-10 w-10">
              <AvatarImage src={user?.profile} alt={getFullName()} />
              <AvatarFallback className="bg-brand-strong text-white font-semibold">
                {getUserInitials()}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col min-w-0">
              <p className="text-[13px] font-semibold text-heading truncate">
                {getFullName()}
              </p>
              <p className="text-[12px] text-subtle truncate">
                {user?.email || "Loading..."}
              </p>
              <div className="flex items-center gap-1 mt-1">
                <span className="w-2 h-2 bg-success-500 rounded-full" />
                <span className="text-[12px] text-subtle truncate">
                  {isDummyStudent
                    ? "Student view"
                    : user?.role?.renameRole || "Account"}
                </span>
              </div>
            </div>
          </div>
        </DropdownMenuLabel>

        {/* Role switch. A real student has nothing to preview. */}
        {!isActualStudent && !isDummyStudent ? (
          <DropdownMenuItem
            className="flex items-center gap-3 p-2 rounded-chip hover:bg-row-hover transition-colors cursor-pointer"
            onClick={switchToStudent}
          >
            <UserCheck2 className="w-4 h-4 text-brand-strong" />
            <span className="flex flex-col">
              <span className="text-[13px] text-body">Switch to Student</span>
              <span className="text-[11px] text-subtle">Preview student experience</span>
            </span>
          </DropdownMenuItem>
        ) : null}

        {isDummyStudent && originalRoleInfo ? (
          <DropdownMenuItem
            className="flex items-center gap-3 p-2 rounded-chip hover:bg-row-hover transition-colors cursor-pointer"
            onClick={switchBackToOriginal}
          >
            <Zap className="w-4 h-4 text-brand-strong" />
            <span className="flex flex-col">
              <span className="text-[13px] text-body">
                Back to {originalRoleInfo.renameRole || "your role"}
              </span>
              <span className="text-[11px] text-subtle">Return to original role</span>
            </span>
          </DropdownMenuItem>
        ) : null}

        {!isActualStudent || isDummyStudent ? (
          <DropdownMenuSeparator className="my-1 bg-hairline-strong" />
        ) : null}

        <DropdownMenuItem
          className="flex items-center gap-3 p-2 rounded-chip hover:bg-row-hover transition-colors cursor-pointer"
          onClick={goToProfile}
        >
          <User className="w-4 h-4 text-subtle" />
          <span className="text-[13px] text-body">Profile</span>
        </DropdownMenuItem>

        <DropdownMenuItem className="flex items-center gap-3 p-2 rounded-chip hover:bg-row-hover transition-colors cursor-pointer">
          <Settings className="w-4 h-4 text-subtle" />
          <span className="text-[13px] text-body">Settings</span>
        </DropdownMenuItem>

        <DropdownMenuItem className="flex items-center gap-3 p-2 rounded-chip hover:bg-row-hover transition-colors cursor-pointer">
          <HelpCircle className="w-4 h-4 text-subtle" />
          <span className="text-[13px] text-body">Help &amp; Support</span>
        </DropdownMenuItem>

        <DropdownMenuSeparator className="my-1 bg-hairline-strong" />

        <DropdownMenuItem
          onClick={handleLogout}
          disabled={isLoggingOut}
          className="flex items-center gap-3 p-3 rounded-chip hover:bg-danger-50 transition-colors duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoggingOut ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <LogOut className="w-4 h-4 text-danger-700" />
          )}
          <span className="text-[13px] text-body">
            {isLoggingOut ? "Signing Out..." : "Sign Out"}
          </span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
