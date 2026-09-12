"use client"

import type { ReactNode } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { BarChart3, Building2, Layers } from 'lucide-react'
import DashboardLayout from '@/app/lms/component/layout'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/app/lms/shared/ui/Tabs'
import { usePermissions } from '@/hooks/usePermissions'
import { PERMISSION_IDS } from '@/app/lms/pages/usermanagement/components/permissions/index'

const WORKSPACE_TABS = [
    { value: 'clientmanagement', label: 'Client Management', icon: Building2, permission: PERMISSION_IDS.ADMIN_CLIENT_MANAGEMENT },
    { value: 'servicemapping', label: 'Service Mapping', icon: Layers, permission: PERMISSION_IDS.ADMIN_SERVICE_MAPPING },
    // Reporting across both lists. It reads the same records Service Mapping
    // does, so it is gated on that permission rather than inventing a new one
    // the Super Admin's permission tree would not know how to grant.
    { value: 'businessreports', label: 'Reports', icon: BarChart3, permission: PERMISSION_IDS.ADMIN_SERVICE_MAPPING },
] as const

export default function ClientManagementWorkspace({ children }: { children: ReactNode }) {
    const pathname = usePathname()
    const router = useRouter()
    const { can } = usePermissions()
    const activeTab = pathname.startsWith('/lms/pages/servicemapping') ? 'servicemapping'
        : pathname.startsWith('/lms/pages/businessreports') ? 'businessreports'
        : 'clientmanagement'

    return (
        <DashboardLayout>
            <Tabs
                value={activeTab}
                onValueChange={(value) => router.push(`/lms/pages/${value}`)}
                activationMode="manual"
                className="flex h-full min-h-0 min-w-0 flex-col"
            >
                <div className="no-print shrink-0 px-4 sm:px-6 md:px-8 pt-14 md:pt-3">
                    {/* These three are the workspace's top-level navigation, so
                        they are weighted more than the shared tab's default: bold,
                        slightly tighter, and the active one sits in a brand wash
                        rather than being marked by the underline alone.

                        Every class here that restates one from the shared trigger
                        (mr, px, font, the text colours) is an override, not a
                        duplicate — cn() runs through tailwind-merge, so the later
                        one replaces the earlier rather than both landing in the
                        list and the cascade deciding. */}
                    <TabsList aria-label="Client management sections" className="gap-1 overflow-x-auto overflow-y-hidden">
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
                </div>
                <TabsContent value={activeTab} className="mt-0 min-h-0 min-w-0 flex-1">
                    {children}
                </TabsContent>
            </Tabs>
        </DashboardLayout>
    )
}
