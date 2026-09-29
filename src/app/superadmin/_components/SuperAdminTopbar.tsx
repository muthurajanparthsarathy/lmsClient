'use client';
import React, { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { LogOut, UserCircle, ChevronRight, Search, Menu, Users } from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { useSuperAdminAuthStore } from '@/stores/superAdminAuthStore';
import { superAdminLogout } from '@/apiServices/superadmin/authService';
import { clearAllStorage } from '@/lib/session';
import { flatNav, NAV_SUBTITLES } from './nav';
import { SidebarNavContent } from './SuperAdminSidebar';
import CommandPalette from './CommandPalette';

const initials = (name?: string) =>
  (name || 'SA')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

export default function SuperAdminTopbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { superAdmin, clearSession } = useSuperAdminAuthStore();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const current = flatNav.find((n) => pathname === n.href || pathname?.startsWith(n.href + '/'));
  const subtitle = current ? NAV_SUBTITLES[current.href] : undefined;

  const handleLogout = async () => {
    try {
      await superAdminLogout();
    } catch {
      /* token may already be gone server-side */
    }
    clearSession();
    // Store-level clearSession only drops the superadmin token — it also
    // runs on a failed verify, so it stays narrow. An explicit sign-out
    // wipes everything.
    clearAllStorage();
    router.push('/superadmin/login');
  };

  return (
    <>
      <CommandPalette />

      <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-border bg-background/80 px-4 backdrop-blur-md sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <button
            onClick={() => setMobileNavOpen(true)}
            className="sa-transition flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground lg:hidden"
            aria-label="Open navigation menu"
          >
            <Menu className="h-4.5 w-4.5" />
          </button>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-sm">
              <span className="text-muted-foreground">Console</span>
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" />
              <span className="font-semibold text-foreground">{current?.label ?? 'Dashboard'}</span>
            </div>
            {subtitle && <p className="hidden truncate text-xs text-muted-foreground sm:block">{subtitle}</p>}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))}
            className="sa-transition hidden items-center gap-2 rounded-md border border-border bg-background px-3 py-1.5 text-sm text-muted-foreground hover:border-ring/40 hover:text-foreground sm:flex"
            aria-label="Open command palette"
          >
            <Search className="h-3.5 w-3.5" />
            Search
            <kbd className="ml-2 rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium">⌘K</kbd>
          </button>

          <DropdownMenu>
            <DropdownMenuTrigger className="sa-transition flex items-center gap-2 rounded-full outline-none hover:opacity-90">
              <Avatar className="h-8 w-8 ring-1 ring-border">
                <AvatarFallback className="bg-sidebar-primary text-xs font-semibold text-sidebar-primary-foreground">
                  {initials(superAdmin?.name)}
                </AvatarFallback>
              </Avatar>
              <span className="hidden text-sm font-medium text-foreground sm:inline">{superAdmin?.name ?? 'Super Admin'}</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="flex flex-col">
                <span className="text-sm font-medium">{superAdmin?.name}</span>
                <span className="text-xs font-normal text-muted-foreground">{superAdmin?.email}</span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => router.push('/superadmin/profile')}>
                <UserCircle className="mr-2 h-4 w-4" /> Profile
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push('/superadmin/admins')}>
                <Users className="mr-2 h-4 w-4" /> Super Admins
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
                <LogOut className="mr-2 h-4 w-4" /> Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent side="left" className="w-64 p-0 [&>button]:hidden">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <div className="flex h-full flex-col bg-sidebar">
            <SidebarNavContent onNavigate={() => setMobileNavOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
