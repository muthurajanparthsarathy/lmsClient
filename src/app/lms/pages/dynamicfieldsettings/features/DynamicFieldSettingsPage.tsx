"use client"

import React, { useState, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import { BookAIcon, Users, Settings2, GraduationCap, ChevronRight, Printer, Layers } from 'lucide-react'
import DashboardLayout from '@/app/lms/component/layout'
import { Tabs, TabsList, TabsTrigger, EmptyState, Skeleton, SkeletonTable, pageEnter } from '@/app/lms/shared/ui'
import { TabCard } from './ui'
import CourseserviceServicemodal from './courseserviceServicemodal'
import CategoryManagementPage from './categoryTab'
import PedagogyManagementComponent from './PedagogyComponent'
import DegreeManagementTab from './degreeManagement'
import PrintSettingTab from './printSettingTab'
import { usePermissions } from '@/hooks/usePermissions'
import { PERMISSION_IDS } from '@/app/lms/pages/usermanagement/components/permissions/index'

// Define types for the tab
type Tab = {
    key: string
    label: string
    icon?: React.ComponentType<{ className?: string }>
    component: React.ComponentType
}

// Define tab configuration
const tabConfig = {
    'Service Modal': {
        label: 'Service Model',
        icon: Users,
        component: CourseserviceServicemodal,
        permissionKey: 'Service Modal'
    },
    // 'Client Modal' removed — clients are managed by the standalone Client
    // Management module, not from Dynamic Field Settings.
    'Course Category': {
        label: 'Course Category',
        icon: BookAIcon,
        component: CategoryManagementPage,
        permissionKey: 'Course Category'
    },
    'Pedagogy': {
        label: 'Pedagogy',
        icon: Layers,
        component: PedagogyManagementComponent,
        permissionKey: 'Pedagogy'
    },
    'Degree Management': {
        label: 'Degree Management',
        icon: GraduationCap,
        component: DegreeManagementTab,
        permissionKey: 'Degree Management'
    },
    'Print Setting': {
        label: 'Print Setting',
        icon: Printer,
        component: PrintSettingTab,
        permissionKey: 'Print Setting'
    }
}

// Shared page heading — eyebrow, title and one-line description.
function PageHeading() {
    return (
        <div className="flex flex-shrink-0 items-center gap-3 pl-12 md:pl-0">
            <div className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-brand-500/15 bg-brand-wash md:flex">
                <Settings2 className="h-5 w-5 text-brand-strong" />
            </div>
            <div className="min-w-0">
            <nav className="flex items-center gap-1.5 text-2xs" aria-label="Breadcrumb">
                <span className="uppercase tracking-wider text-faint">System</span>
                <ChevronRight size={12} className="text-line-muted" />
                <span className="uppercase tracking-wider font-medium text-subtle">Settings</span>
            </nav>
            <h1 className="mt-0.5 text-xl font-semibold text-heading tracking-[-0.02em]">
                Dynamic Field Settings
            </h1>
            <p className="mt-0.5 text-xs text-subtle">
                Manage your institution’s services, academic structure and print layouts.
            </p>
            </div>
        </div>
    )
}

export default function Page() {
    const [activeTab, setActiveTab] = useState<string>('Service Modal')
    // Central permissions hook — reads the same storage the login flow writes,
    // and matches on the full canonical id so this tab list stays in step with
    // PermissionModal/BulkPermissionModal's `admin-dynamic-field-settings`
    // entry and its per-functionality grants.
    const { can, isReady } = usePermissions()

    // Available tabs are recomputed whenever the permissions snapshot changes
    // (initial read, storage event from another tab, or explicit refresh).
    const availableTabs = useMemo<Tab[]>(() => {
        if (!isReady) return []
        return Object.entries(tabConfig)
            .filter(([, config]) => can(PERMISSION_IDS.ADMIN_DYNAMIC_FIELD_SETTINGS, config.permissionKey))
            .map(([tabKey, config]) => ({
                key: tabKey,
                label: config.label,
                icon: config.icon,
                component: config.component,
            }))
    }, [can, isReady])

    // Keep the active tab valid when the available set shrinks/changes.
    useEffect(() => {
        if (availableTabs.length > 0 && !availableTabs.some(t => t.key === activeTab)) {
            setActiveTab(availableTabs[0].key)
        }
    }, [availableTabs, activeTab])

    // Get the active tab component
    const ActiveTabComponent = availableTabs.find(tab => tab.key === activeTab)?.component

    if (!isReady) {
        return (
            <DashboardLayout>
                <div className="h-full min-h-0 min-w-0 flex flex-col p-4 md:p-5">
                    <PageHeading />

                    {/* Tab-bar ghost */}
                    <div className="mt-5 flex items-center gap-6 border-b border-hairline pb-3 flex-shrink-0">
                        {Object.keys(tabConfig).map((key) => (
                            <Skeleton key={key} className="h-4 w-24" />
                        ))}
                    </div>

                    {/* Panel ghost matching the table geometry */}
                    <div className="mt-5">
                        <TabCard>
                            <div className="flex items-center justify-between border-b border-hairline px-5 py-4">
                                <div className="flex items-center gap-3">
                                    <Skeleton className="h-9 w-9 rounded-tile" />
                                    <div>
                                        <Skeleton className="h-4 w-40" />
                                        <Skeleton className="mt-1.5 h-3 w-56" />
                                    </div>
                                </div>
                                <Skeleton className="h-9 w-28 rounded-control" />
                            </div>
                            <SkeletonTable rows={5} cols={4} />
                        </TabCard>
                    </div>
                </div>
            </DashboardLayout>
        )
    }

    // Check if user has access to any tab
    if (availableTabs.length === 0) {
        return (
            <DashboardLayout>
                <div className="h-full min-h-0 min-w-0 flex flex-col p-4 md:p-5">
                    <PageHeading />

                    {/* Disabled tab bar — the tabs exist, this account can't open them */}
                    <div className="mt-5 flex items-center gap-6 overflow-x-auto border-b border-hairline flex-shrink-0" role="tablist" aria-disabled>
                        {Object.entries(tabConfig).map(([tabKey, config]) => (
                            <button
                                key={tabKey}
                                disabled
                                className="flex h-10 cursor-not-allowed items-center gap-2 whitespace-nowrap px-1 text-sm font-medium text-faint"
                            >
                                {config.icon && <config.icon className="h-4 w-4" />}
                                {config.label}
                            </button>
                        ))}
                    </div>

                    <div className="mt-5">
                        <TabCard>
                            <EmptyState
                                icon={Settings2}
                                title="No access"
                                message="You don't have permission to access Dynamic Field Management features."
                                className="py-16"
                                secondaryAction={
                                    <div className="rounded-tile border border-hairline bg-canvas px-4 py-3 text-left">
                                        <p className="text-xs text-subtle">
                                            Required permission:{' '}
                                            <span className="font-medium text-heading">dynamicfieldsettings</span>
                                        </p>
                                        <p className="mt-1 text-xs text-faint">
                                            Contact your administrator to request access.
                                        </p>
                                    </div>
                                }
                            />
                        </TabCard>
                    </div>
                </div>
            </DashboardLayout>
        )
    }

    return (
        <DashboardLayout>
            {/* Fill the viewport and never let the page itself scroll — the heading
                and tab bar stay pinned while each tab's content scrolls on its own. */}
            <motion.div
                variants={pageEnter}
                initial="hidden"
                animate="visible"
                className="h-full min-h-0 min-w-0 flex flex-col p-4 md:p-5"
            >
                <PageHeading />

                {/* Tab navigation (pinned) */}
                <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4 min-w-0 flex-shrink-0">
                    <TabsList aria-label="Dynamic field settings" className="gap-1 overflow-x-auto overflow-y-hidden rounded-lg border border-hairline bg-canvas p-1">
                        {availableTabs.map((tab) => (
                            <TabsTrigger key={tab.key} id={`settings-tab-${tab.key.replaceAll(' ', '-')}`} aria-controls="settings-panel" value={tab.key} className="mr-0 h-9 shrink-0 rounded-md px-3 text-xs whitespace-nowrap data-[state=active]:bg-surface data-[state=active]:text-brand-strong data-[state=active]:shadow-xs [&>span:last-child:not(:first-child)]:hidden">
                                <span className="flex items-center gap-1.5">
                                    {tab.icon && <tab.icon className="h-4 w-4" />}
                                    {tab.label}
                                </span>
                            </TabsTrigger>
                        ))}
                    </TabsList>
                </Tabs>

                {/* Tab content — the single scroll region. Components that fill
                    height (e.g. Degree Management) scroll their own list inside;
                    taller tabs scroll here as a whole. */}
                <div id="settings-panel" role="tabpanel" aria-labelledby={`settings-tab-${activeTab.replaceAll(' ', '-')}`} tabIndex={0} className="flex-1 min-h-0 overflow-y-auto pt-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30">
                    {ActiveTabComponent && <ActiveTabComponent />}
                </div>
            </motion.div>
        </DashboardLayout>
    )
}
