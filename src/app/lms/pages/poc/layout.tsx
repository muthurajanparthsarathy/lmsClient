import DashboardLayout from "@/app/lms/component/layout";

/**
 * Shell for the whole POC console.
 *
 * A real route-group layout, so every current and future /lms/pages/poc/* page
 * gets the shell without a per-page wrapper — the bug class this avoids is the
 * one the rest of the app has, where shell selection is copy-pasted into seven
 * page files and a new role silently falls through to the trainer rail.
 *
 * It mounts DashboardLayout, but a POC does NOT get the admin sidebar: the rail
 * derives its items through `buildNavForStoredUser`, which returns the
 * dedicated POC_NAV_ITEMS for this role. Same chrome and design system, an
 * entirely different navigation structure — not the admin nav with entries
 * hidden.
 */
export default function PocConsoleLayout({ children }: { children: React.ReactNode }) {
  return <DashboardLayout>{children}</DashboardLayout>;
}
