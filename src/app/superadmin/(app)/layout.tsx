import React from 'react';
import SuperAdminGuard from '../_components/SuperAdminGuard';
import SuperAdminSidebar from '../_components/SuperAdminSidebar';
import CommandPalette from '../_components/CommandPalette';
import { SuperAdminMobileNav } from '../_components/SuperAdminPanelChrome';

/**
 * Floating-workspace shell (matches the LMS shells): the sa-theme's slate
 * canvas runs under everything, the sidebar sits flat on it, and the pages
 * live inside a white rounded panel inset by a gutter on its top, right and
 * bottom. The old sticky topbar is retired — the ⌘K palette self-registers
 * its hotkey and is mounted here, the mobile nav trigger floats in the panel
 * corner, page titles render inside the panel, and the account menu (incl.
 * Logout) moved to the sidebar's bottom identity row.
 */
export default function SuperAdminAppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SuperAdminGuard>
      {/* Explicit L&D-shell values (not sa-theme tokens): the shell must look
          identical to the other consoles' rails; only the PAGES keep the
          indigo sa-theme. */}
      <div className="flex h-screen overflow-hidden bg-[#F5F6F8] text-foreground">
        <SuperAdminSidebar />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col p-3.5 pl-0 max-lg:p-2.5 max-lg:pl-2.5">
          <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-[18px] border border-[#E4E7EC] bg-white shadow-[0_1px_2px_rgba(16,24,40,.04)]">
            <SuperAdminMobileNav />
            <CommandPalette />
            {/* No layout-injected heading: each page renders its own single
                PageHeader (title only) — two headings was one too many. */}
            <main className="sc-panel-scroll min-h-0 flex-1 overflow-y-auto p-6">
              {children}
            </main>
          </div>
        </div>
      </div>
    </SuperAdminGuard>
  );
}
