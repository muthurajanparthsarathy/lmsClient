"use client";

/**
 * Admin shell — floating-workspace layout (same pattern as the L&D console and
 * student shells): one continuous gray canvas, the sidebar flat on it, and the
 * page content inside a white rounded panel inset by a gray gutter on its top,
 * right and bottom. There is NO top navbar anymore — its jobs moved:
 *   collapse toggle → sidebar brand card · notifications → bell pinned in the
 *   panel corner · ⌘K CommandPalette → mounted here (it registers its own
 *   hotkey) · breadcrumbs/"New" menu/Help/Settings icons → retired (all their
 *   targets are one click away in the sidebar or the account menu).
 * The public API is unchanged: default-export DashboardLayout + useSidebar(),
 * so the ~30 pages that wrap themselves in this shell keep compiling as-is.
 */

import { createContext, useContext, useEffect, useState } from "react";
import { Menu } from "lucide-react";
import { Sidebar } from "./sidebar";
import { CommandPalette } from "../shared/ui/CommandPalette";
import { useAccountMenu } from "./useAccountMenu";
import NotificationBell from "./NotificationBell";
import { ToastContainer } from "react-toastify";
import { Poppins } from "next/font/google";
import { useSyncPermissions } from "@/hooks/useSyncPermissions";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
  variable: "--font-poppins",
});

// Create context for sidebar state
const SidebarContext = createContext<{
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
  hasSidebar: boolean;
}>({
  isCollapsed: true,
  setIsCollapsed: () => { },
  hasSidebar: false,
});

export const useSidebar = () => useContext(SidebarContext);

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Expanded by default on desktop (matches the design); collapsed on mobile.
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const { handleLogout } = useAccountMenu();

  // Re-fetch this session's permissions on every LMS page mount so a
  // just-issued grant (from another admin) shows up without a re-login.
  useSyncPermissions();

  useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      setIsCollapsed(true);
    }
  }, []);

  return (
    <SidebarContext.Provider value={{ isCollapsed, setIsCollapsed, hasSidebar: true }}>
      <div
        className={`${poppins.variable} h-screen flex bg-surface-sunken`}
        style={{ fontFamily: "var(--font-poppins), 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}
      >
        {/* Full-height sidebar, flat on the gray canvas */}
        <aside className="flex-shrink-0 h-full">
          <Sidebar />
        </aside>

        {/* Floating white workspace: the canvas shows through as a gutter on
            the panel's top, right and bottom edges, flowing from the rail. */}
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden p-3.5 pl-0 max-md:p-2.5 max-md:pl-2.5">
          <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-[18px] border border-hairline bg-surface shadow-xs">

            {/* Mobile only: reopens the sidebar overlay (the old navbar burger). */}
            <button
              type="button"
              onClick={() => setIsCollapsed(false)}
              aria-label="Open navigation"
              className="absolute top-3 left-4 z-30 inline-flex h-9 w-9 items-center justify-center rounded-full border border-hairline bg-surface text-body shadow-xs md:hidden"
            >
              <Menu className="h-[18px] w-[18px]" strokeWidth={2} />
            </button>

            {/* overflow-x-hidden is explicit: without it, overflow-y-auto
                alone computes overflow-x to auto per CSS spec, and any child
                that overflows produces a page-level horizontal scrollbar. */}
            <main className="sc-panel-scroll min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
              {/* Notifications sit inside the panel's top-right corner, but as
                  an absolute anchored to a relative wrapper INSIDE the scroll
                  flow — the bell scrolls up with the content instead of
                  staying pinned over it, which is what the admin dashboard's
                  Refresh row (and everything else on tall pages) used to slide
                  awkwardly beneath.
                  `h-full` (not min-h-full) so child pages using their own
                  h-full chain to fit the viewport can resolve — CSS percentage
                  heights need a definite parent height, and min-height does
                  not provide one. Overflowing children still bubble scroll up
                  to <main>, so tall pages behave the same as before. */}
              <div className="relative h-full">
                <div className="absolute top-3 right-4 z-30">
                  <NotificationBell />
                </div>
                {children}
              </div>
            </main>
          </div>
        </div>
      </div>

      {/* Global command palette (⌘K / Ctrl+K) — used to be mounted by the
          navbar; it registers its own hotkey, so mounting it here keeps the
          shortcut alive with no visible trigger. */}
      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        onSignOut={handleLogout}
      />

      <ToastContainer
        position="top-right"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
      />
    </SidebarContext.Provider>
  );
}
