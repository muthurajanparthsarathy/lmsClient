"use client"

import { createContext, useContext, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { usePathname, useRouter } from 'next/navigation'
import { BarChart3, Building2, Layers } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/app/lms/shared/ui/Tabs'
import { usePermissions } from '@/hooks/usePermissions'
import { PERMISSION_IDS } from '@/app/lms/pages/usermanagement/components/permissions/index'

/* Module-level navigation for Business Management: Client Management /
 * Service Mapping / Reports.
 *
 * This is mounted by `app/lms/pages/layout.tsx` — a Next.js layout, so it
 * survives every client-side transition BETWEEN the three routes. The pages
 * themselves must NOT render it, or each tab switch would unmount the strip
 * and the active indicator would blink and re-animate from scratch.
 *
 * Present ONLY as long as the sidebar collapses these three routes under one
 * "Business Management" entry with no subitems — the tabs are the user's only
 * way to switch between them. If the sidebar later re-adds subitems, drop the
 * strip to avoid two navigation systems for the same pages.
 */
const WORKSPACE_TABS = [
    { value: 'clientmanagement', label: 'Client Management', icon: Building2, permission: PERMISSION_IDS.ADMIN_CLIENT_MANAGEMENT },
    { value: 'servicemapping', label: 'Service Mapping', icon: Layers, permission: PERMISSION_IDS.ADMIN_SERVICE_MAPPING },
    // Reports reads the same records Service Mapping does, so it's gated on
    // that permission rather than inventing a new key the Super Admin's
    // permission tree would not know how to grant.
    { value: 'businessreports', label: 'Reports', icon: BarChart3, permission: PERMISSION_IDS.ADMIN_SERVICE_MAPPING },
] as const

/** The three routes the strip switches between, and nothing else. An EXACT
 *  match on purpose: `/lms/pages/clientmanagement/<id>` is a drill-down to one
 *  client's full details, which has never carried the tab strip and reads as
 *  its own screen. */
export function isBusinessWorkspaceRoute(pathname: string): boolean {
    const path = pathname.split(/[?#]/)[0].replace(/\/$/, '')
    return WORKSPACE_TABS.some((tab) => path === `/lms/pages/${tab.value}`)
}

/* ── Page-specific primary action ────────────────────────────────────────────
 *
 * "+ Add Client" / "+ Add Service" sit inline at the far right of the tab
 * strip, but they belong to the PAGE — they open that page's own modal and are
 * gated on that page's own permission. Since the strip now lives above the
 * routes, a page hands its button up through this slot: the strip renders an
 * empty host div, and the page portals into it.
 *
 * A portal rather than layout state: the host element is created once with the
 * strip and never changes, so a tab switch swaps the button contents with no
 * intermediate frame where the corner is empty. */
const ActionHostContext = createContext<HTMLElement | null>(null)

/** Renders `children` into the tab strip's top-right action slot. A no-op when
 *  the page is rendered outside the workspace chrome. */
export function WorkspaceActionSlot({ children }: { children: ReactNode }) {
    const host = useContext(ActionHostContext)
    return host ? createPortal(children, host) : null
}

export default function BusinessWorkspaceChrome({ children }: { children: ReactNode }) {
    const pathname = usePathname()
    const router = useRouter()
    const { can } = usePermissions()
    const [actionHost, setActionHost] = useState<HTMLDivElement | null>(null)
    const activeTab = pathname.startsWith('/lms/pages/servicemapping') ? 'servicemapping'
        : pathname.startsWith('/lms/pages/businessreports') ? 'businessreports'
        : 'clientmanagement'

    return (
        <Tabs
            value={activeTab}
            onValueChange={(value) => router.push(`/lms/pages/${value}`)}
            activationMode="manual"
            className="flex h-full min-h-0 min-w-0 flex-col"
        >
            {/* pt-14 on mobile clears the shell's floating hamburger
                  (top-3 left-4, md:hidden). Desktop keeps pt-3 so the
                  tab strip sits close to the top of the panel.
                  `flex justify-between` gives the CTA slot a home on
                  the far right without breaking the tab strip's
                  active-underline. Wraps only on very narrow viewports. */}
            <div className="no-print shrink-0 px-4 sm:px-6 md:px-8 pt-14 md:pt-3 flex items-center justify-between gap-3 flex-wrap">
                <TabsList aria-label="Business management sections" className="gap-1 overflow-x-auto overflow-y-hidden">
                    {WORKSPACE_TABS.filter((tab) => tab.value === activeTab || can(tab.permission)).map((tab) => (
                        <TabsTrigger
                            key={tab.value}
                            value={tab.value}
                            className="mr-0 inline-flex items-center gap-2 whitespace-nowrap rounded-t-lg px-3.5 text-sm font-bold tracking-tight text-subtle hover:bg-row-hover hover:text-heading data-[state=active]:bg-brand-wash data-[state=active]:text-brand-strong"
                        >
                            <tab.icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                            {tab.label}
                        </TabsTrigger>
                    ))}
                </TabsList>
                <div ref={setActionHost} className="ml-auto flex shrink-0 items-center" />
            </div>
            <TabsContent value={activeTab} className="mt-0 min-h-0 min-w-0 flex-1">
                <ActionHostContext.Provider value={actionHost}>
                    {children}
                </ActionHostContext.Provider>
            </TabsContent>
        </Tabs>
    )
}
