'use client';
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ShieldCheck, ChevronsLeft, ChevronsRight, MoreVertical, UserCircle, LogOut, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { NAV_SECTIONS, NavItem } from './nav';
import { useSuperAdminAuthStore } from '@/stores/superAdminAuthStore';
import { superAdminLogout } from '@/apiServices/superadmin/authService';
import { clearAllStorage } from '@/lib/session';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const isActiveHref = (pathname: string | null, href: string) =>
  pathname === href || pathname?.startsWith(href + '/');

// Flat nav — no section labels and no collapsible parents: every destination
// is a direct item, matching the app's other rails. Parents with children
// (Client Management) contribute their children directly.
const FLAT_NAV: NavItem[] = NAV_SECTIONS.flatMap((s) =>
  s.items.flatMap((e) => (e.children?.length ? e.children : [{ label: e.label, href: e.href!, icon: e.icon }]))
);

const initials = (name?: string) =>
  (name || 'PO').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();

// ── A leaf link ─────────────────────────────────────────────────────────────
function NavLink({ item, nested, collapsed, onNavigate }: { item: NavItem; nested?: boolean; collapsed?: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  const active = isActiveHref(pathname, item.href);
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      title={collapsed ? item.label : undefined}
      className={cn(
        // Matched to the L&D rail (.ldx-nav): 13px/500, 10px radius, cool
        // grays, orange accent on the active white pill.
        'sa-transition group relative flex items-center rounded-[10px] border text-[13px] font-medium',
        collapsed ? 'h-10 w-10 justify-center' : cn('gap-[11px] px-2.5 py-2', nested && 'pl-9'),
        active
          ? 'border-[#E4E7EC] bg-white font-semibold text-[#F97316] shadow-[0_1px_2px_rgba(16,24,40,.06)]'
          : 'border-transparent text-[#374151] hover:bg-[#E9EBF0] hover:text-[#111827]'
      )}
    >
      <Icon className={cn('h-4 w-4 shrink-0', active ? 'text-[#F97316]' : 'opacity-85 group-hover:opacity-100')} />
      {!collapsed && <span className="truncate">{item.label}</span>}
    </Link>
  );
}

// (The collapsible "Client Management" parent is gone — its children are flat
// top-level items now, via FLAT_NAV above.)

// ── Shared body (desktop + mobile drawer) ───────────────────────────────────
export function SidebarBody({ collapsed = false, onNavigate, onToggleCollapse }: { collapsed?: boolean; onNavigate?: () => void; onToggleCollapse?: () => void }) {
  const router = useRouter();
  const { superAdmin, clearSession } = useSuperAdminAuthStore();

  const handleLogout = async () => {
    try { await superAdminLogout(); } catch { /* token may be gone */ }
    clearSession();
    // Store-level clearSession only drops the superadmin token — it also
    // runs on a failed verify, so it stays narrow. An explicit sign-out
    // wipes everything.
    clearAllStorage();
    router.push('/superadmin/login');
  };

  return (
    <div className="relative flex h-full flex-col bg-transparent">
      {/* Brand card — a raised block on the canvas, floating-workspace style.
          It hosts the collapse toggle, like the app's other rails — no more
          floating handle overhanging the sidebar edge. */}
      <div className={cn('px-3 pt-3 pb-2.5', collapsed && 'px-2')}>
        <div className={cn(
          'flex items-center gap-2.5 rounded-[14px] border border-[#E4E7EC] bg-white px-3 py-2 shadow-[0_1px_2px_rgba(16,24,40,.04)]',
          collapsed && 'flex-col justify-center gap-1.5 px-1.5 py-2'
        )}>
          <div
            className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[10px] text-white"
            style={{ background: 'linear-gradient(145deg,#FB8C3C,#F97316)' }}
          >
            <ShieldCheck className="h-[18px] w-[18px]" />
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1 leading-tight">
              <div className="truncate text-[13.5px] font-bold tracking-[-0.01em] text-[#111827]">Super Admin</div>
              <div className="truncate text-[10.5px] text-[#6B7280]">Platform Console</div>
            </div>
          )}
          {onToggleCollapse && (
            <button
              onClick={onToggleCollapse}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              className="sa-transition flex h-6 w-6 shrink-0 items-center justify-center rounded-[7px] text-[#6B7280] hover:bg-[#E9EBF0] hover:text-[#374151]"
            >
              {collapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
            </button>
          )}
        </div>
      </div>

      {/* Flat items — no section labels, no submenu nesting */}
      <nav className={cn('flex-1 space-y-0.5 overflow-y-auto py-4', collapsed ? 'flex flex-col items-center gap-0.5 space-y-0 px-2' : 'px-3')}>
        {FLAT_NAV.map((item) => (
          <NavLink key={item.href} item={item} collapsed={collapsed} onNavigate={onNavigate} />
        ))}
      </nav>

      {/* Identity row — bottom-left, flat, reference-style. This is now the
          home of the account menu (incl. the console's ONLY Logout), which
          used to live in the retired topbar's avatar dropdown. */}
      <div className={cn('border-t border-[#EAECF0]', collapsed ? 'p-2' : 'p-3')}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className={cn(
                'sa-transition flex w-full items-center rounded-[10px] outline-none hover:bg-[#E9EBF0]',
                collapsed ? 'justify-center p-1.5' : 'gap-2.5 px-1.5 py-1.5'
              )}
            >
              <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-[#F97316] text-[11.5px] font-bold text-white">
                {initials(superAdmin?.name)}
              </span>
              {!collapsed && (
                <>
                  <span className="min-w-0 flex-1 text-left leading-tight">
                    <span className="block truncate text-[12.5px] font-semibold text-[#111827]">{superAdmin?.name ?? 'Super Admin'}</span>
                    <span className="block truncate text-[10.5px] text-[#6B7280]">{superAdmin?.email ?? ''}</span>
                  </span>
                  <MoreVertical className="h-4 w-4 shrink-0 rotate-90 text-[#6B7280]" />
                </>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="w-56">
            <DropdownMenuItem onClick={() => { onNavigate?.(); router.push('/superadmin/profile'); }}>
              <UserCircle className="mr-2 h-4 w-4" /> Profile
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => { onNavigate?.(); router.push('/superadmin/admins'); }}>
              <Users className="mr-2 h-4 w-4" /> Super Admins
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
              <LogOut className="mr-2 h-4 w-4" /> Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

// Kept for the mobile drawer in SuperAdminTopbar (always expanded).
export function SidebarNavContent({ onNavigate }: { onNavigate?: () => void }) {
  return <SidebarBody onNavigate={onNavigate} />;
}

export default function SuperAdminSidebar() {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    setCollapsed(localStorage.getItem('sa-sidebar-collapsed') === '1');
  }, []);
  const toggle = () => setCollapsed((c) => {
    const next = !c;
    localStorage.setItem('sa-sidebar-collapsed', next ? '1' : '0');
    return next;
  });

  return (
    // Flat on the canvas — no right border; the white workspace panel's own
    // edge marks the boundary. 252px = the L&D rail's width.
    <aside className={cn('hidden h-full min-h-0 shrink-0 lg:flex', collapsed ? 'w-[76px]' : 'w-[252px]')}>
      <SidebarBody collapsed={collapsed} onToggleCollapse={toggle} />
    </aside>
  );
}
