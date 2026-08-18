import React from 'react';
import { BookOpen, Users, TrendingUp, Building2 } from 'lucide-react';
import { StatCard, Skeleton, SkeletonTable } from '../../../shared/ui';

// Loading state that holds the exact geometry of the loaded dashboard — KPI
// row, insights card, both chart rows, and the directory table — so nothing
// jumps when the analytics payload lands.

function ChartCardSkeleton({ bodyHeight, className = '' }: { bodyHeight: number; className?: string }) {
    return (
        <div className={`rounded-xl border border-hairline bg-surface p-5 shadow-xs ${className}`} aria-hidden="true">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="mt-2 h-3 w-56" />
            <div className="mt-4 space-y-3" style={{ height: bodyHeight }}>
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
            </div>
        </div>
    );
}

export function DashboardSkeleton() {
    return (
        <div className="mt-6 space-y-6" aria-hidden="true">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard loading label="Total Courses" value={0} icon={BookOpen} hint=" " />
                <StatCard loading label="Total Learners" value={0} icon={Users} hint=" " />
                <StatCard loading label="Learner Engagement" value={0} icon={TrendingUp} hint=" " />
                <StatCard loading label="Clients" value={0} icon={Building2} hint=" " />
            </div>

            <div className="rounded-xl border border-hairline bg-surface p-5 shadow-xs">
                <Skeleton className="h-4 w-28" />
                <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
                    {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="flex items-start gap-3 rounded-tile border border-hairline bg-canvas px-4 py-3">
                            <Skeleton className="h-9 w-9 shrink-0 rounded-chip" />
                            <div className="min-w-0 flex-1">
                                <Skeleton className="h-2.5 w-24" />
                                <Skeleton className="mt-2 h-3.5 w-4/5" />
                                <Skeleton className="mt-2 h-3 w-2/3" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                <ChartCardSkeleton bodyHeight={320} className="lg:col-span-2" />
                <div className="rounded-xl border border-hairline bg-surface p-5 shadow-xs">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="mt-2 h-3 w-40" />
                    <div className="mt-6 flex items-center justify-center">
                        <div className="h-40 w-40 rounded-full border-[14px] border-ink-100 animate-pulse" />
                    </div>
                    <div className="mt-6 space-y-3">
                        <Skeleton className="h-3 w-full" />
                        <Skeleton className="h-3 w-5/6" />
                        <Skeleton className="h-3 w-2/3" />
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                <div className="rounded-xl border border-hairline bg-surface p-5 shadow-xs">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="mt-2 h-3 w-44" />
                    <div className="mt-5 space-y-4">
                        <Skeleton className="h-3 w-full" />
                        <Skeleton className="h-3 w-4/5" />
                        <Skeleton className="h-3 w-3/5" />
                    </div>
                </div>
                <ChartCardSkeleton bodyHeight={240} className="lg:col-span-2" />
            </div>

            <div className="overflow-hidden rounded-xl border border-hairline bg-surface shadow-xs">
                <div className="border-b border-hairline px-4 pb-4 pt-5">
                    <Skeleton className="h-4 w-36" />
                    <Skeleton className="mt-2 h-3 w-52" />
                </div>
                <div className="flex min-h-14 items-center border-b border-hairline px-4 py-3">
                    <Skeleton className="h-9 w-64 rounded-control" />
                </div>
                <SkeletonTable rows={6} cols={6} />
            </div>
        </div>
    );
}
