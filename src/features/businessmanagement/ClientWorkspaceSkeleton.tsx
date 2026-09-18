"use client";

import { useSidebar } from '@/app/lms/component/dashboard-context';

/** Content-only once the persistent sidebar is mounted; full shell on first load. */
export default function ClientWorkspaceSkeleton({ showTabs = true }: { showTabs?: boolean }) {
    const { hasSidebar } = useSidebar();
    return (
        <div role="status" aria-label="Loading page content" aria-busy="true" className={hasSidebar ? 'flex h-full min-h-0' : 'flex h-screen gap-3 bg-canvas p-3'}>
            <span className="sr-only">Loading page content…</span>
            {!hasSidebar && <aside aria-hidden="true" className="hidden w-[244px] shrink-0 space-y-4 p-3 md:block">
                <div className="h-12 rounded-xl bg-ink-100 animate-pulse" />
                {Array.from({ length: 8 }, (_, i) => <div key={i} className="h-8 rounded-control bg-ink-100 animate-pulse" />)}
            </aside>}
            <div aria-hidden="true" className={`min-w-0 flex-1 overflow-hidden bg-surface px-4 py-5 sm:px-8 ${hasSidebar ? '' : 'rounded-[18px] border border-hairline'}`}>
                {showTabs && <div className="mb-5 flex gap-5 border-b border-hairline pb-4">
                    <div className="h-5 w-36 rounded bg-ink-100 animate-pulse" />
                    <div className="h-5 w-32 rounded bg-ink-100 animate-pulse" />
                </div>}
                <div className="mb-4 h-5 w-24 rounded bg-ink-100 animate-pulse" />
                <div className="mb-3 flex justify-between gap-4">
                    <div className="h-8 w-80 max-w-[60%] rounded-control bg-ink-100 animate-pulse" />
                    <div className="h-8 w-28 rounded-control bg-ink-100 animate-pulse" />
                </div>
                <div className="h-10 bg-canvas" />
                {Array.from({ length: 8 }, (_, i) => (
                    <div key={i} className="flex h-12 items-center gap-6 border-b border-hairline">
                        <div className="size-6 shrink-0 rounded-full bg-ink-100 animate-pulse" />
                        <div className="h-3 w-1/4 rounded bg-ink-100 animate-pulse" />
                        <div className="h-3 flex-1 rounded bg-ink-100 animate-pulse" />
                        <div className="h-3 w-1/5 rounded bg-ink-100 animate-pulse" />
                    </div>
                ))}
            </div>
        </div>
    )
}
