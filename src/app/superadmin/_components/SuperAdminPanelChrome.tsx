'use client';
import React, { useState } from 'react';
import { usePathname } from 'next/navigation';
import { Menu } from 'lucide-react';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { flatNav, NAV_SUBTITLES } from './nav';
import { SidebarNavContent } from './SuperAdminSidebar';

/**
 * Chrome for the floating workspace panel — the pieces the retired topbar
 * used to own. The console has no bell (Notifications is a sidebar route), so
 * the panel corner hosts only the mobile nav trigger.
 */

/** Mobile nav trigger — floats in the panel's top-right corner (below lg the
    rail is hidden); opens the same Sheet drawer the old topbar rendered. */
export function SuperAdminMobileNav() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="sa-transition absolute top-4 right-4 z-30 flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-sm hover:text-foreground lg:hidden"
        aria-label="Open navigation menu"
      >
        <Menu className="h-4.5 w-4.5" />
      </button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-64 p-0 [&>button]:hidden">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <div className="flex h-full flex-col bg-sidebar">
            <SidebarNavContent onNavigate={() => setOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

/** Page title inside the panel — replaces the old topbar's "Console › page"
    trail, which most pages relied on as their only visible title. */
export function SuperAdminPageHeading() {
  const pathname = usePathname();
  const current = flatNav.find((n) => pathname === n.href || pathname?.startsWith(n.href + '/'));
  if (!current) return null;
  const subtitle = NAV_SUBTITLES[current.href];
  return (
    // Sized like the L&D console's page headers (17px/700 title, 13px sub).
    <div className="mb-5">
      <h1 className="text-[17px] font-bold tracking-[-0.02em] text-[#111827]">{current.label}</h1>
      {subtitle && <p className="mt-1 text-[13px] text-[#374151]">{subtitle}</p>}
    </div>
  );
}
