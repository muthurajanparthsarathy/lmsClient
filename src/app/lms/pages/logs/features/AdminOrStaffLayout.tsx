"use client";
import { useEffect, useState } from "react";
import DashboardLayout from "@/app/lms/component/layout";
import { StaffLayout } from "@/app/lms/component/stafflayout/staff-layout";
import { Loading } from "@/components/loading-ui/loading";
import { getSessionItem, SESSION_KEYS } from "@/lib/session";

/**
 * Renders a page inside the shell its SIGNED-IN ROLE belongs to.
 *
 * Pages reachable by both an admin and a trainer must not hardcode one shell.
 * The two rails are built differently — the admin rail groups Client
 * Management + Service Mapping under "Business Management" and Dynamic
 * Settings + Audit Logs under "System Settings" (buildNavForStoredUser), while
 * the staff rail lists the pages flat and injects its own "Report" entry. A
 * page that pins StaffLayout therefore *changes the whole sidebar out from
 * under an admin* the moment they open it: Audit Logs did exactly that, while
 * its sibling under the same System Settings heading (Dynamic Settings) uses
 * DashboardLayout, so the rail reshaped itself between two neighbouring items.
 *
 * The role test is the one UserManagementPage already uses, reading the same
 * `smartcliff_roleValue` session key.
 */
const ADMIN_SHELL_ROLES = ["admin", "ldhead", "subhead", "programcoordinator"];

export function AdminOrStaffLayout({
  children,
  fullBleed = false,
  noBuiltInPadding = false,
}: {
  children: React.ReactNode;
  /** Forwarded to StaffLayout; DashboardLayout owns its own content box. */
  fullBleed?: boolean;
  noBuiltInPadding?: boolean;
}) {
  // null = not read yet. Rendering either shell before the role is known would
  // mount the wrong sidebar and then swap it, which is the flicker this exists
  // to avoid.
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    setRole(getSessionItem(SESSION_KEYS.roleValue) ?? "");
  }, []);

  if (role === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loading size="size-8" />
      </div>
    );
  }

  return ADMIN_SHELL_ROLES.includes(role) ? (
    <DashboardLayout>{children}</DashboardLayout>
  ) : (
    <StaffLayout fullBleed={fullBleed} noBuiltInPadding={noBuiltInPadding}>
      {children}
    </StaffLayout>
  );
}
