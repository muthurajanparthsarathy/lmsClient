import DashboardLayout from "@/app/lms/component/layout";

/**
 * Shell for the whole POC console.
 *
 * A real route-group layout, so every current and future /lms/pages/poc/* page
 * gets the shell without a per-page wrapper — the bug class this avoids is the
 * one the rest of the app has, where shell selection is copy-pasted into seven
 * page files and a new role silently falls through to the trainer rail.
 *
 * It mounts DashboardLayout, whose rail is derived from the signed-in
 * account's OWN permissions via `buildNavForStoredUser` — there is no POC
 * sidebar constant any more. A POC sees exactly the modules an admin granted
 * it in Assign Permission, and "POC Dashboard" is one of those modules
 * (permission key `pocdashboard`, routed here by PERMISSION_ROUTES).
 */
export default function PocConsoleLayout({ children }: { children: React.ReactNode }) {
  return <DashboardLayout>{children}</DashboardLayout>;
}
