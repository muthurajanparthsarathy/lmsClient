"use client";

/**
 * Program-coordinator shell — floating-workspace layout, matching the rest of
 * the product: gray canvas, flat sidebar, page content in a white rounded
 * panel inset by a gray gutter, internal panel scroll. The old top navbar
 * (Navbarpro) is retired: its only REAL functions moved — logout + identity
 * to the sidebar footer (now showing the actual signed-in user instead of the
 * hard-coded "John Doe"), notifications to the shared NotificationBell pinned
 * in the panel corner. The fake search/Teams/Apps buttons had no behavior and
 * were dropped. The useSidebarpro API is unchanged.
 */

import { createContext, useContext, useState } from "react";
import { Sidebarpro } from "./sidebar";
import NotificationBell from "@/app/lms/component/NotificationBell";
import { ToastContainer } from "react-toastify";

// Create context for sidebar state
const SidebarContext = createContext<{
    isCollapsed: boolean;
    setIsCollapsed: (collapsed: boolean) => void;
}>({
    isCollapsed: true,
    setIsCollapsed: () => { },
});

export const useSidebarpro = () => useContext(SidebarContext);

export default function DashboardLayoutlms({
    children,
}: {
    children: React.ReactNode;
}) {
    const [isCollapsed, setIsCollapsed] = useState(true); // Default closed

    return (
        <SidebarContext.Provider value={{ isCollapsed, setIsCollapsed }}>
            <ToastContainer
                position="top-right"
                autoClose={5000}
                hideProgressBar={false}
                newestOnTop={false}
                closeOnClick
                rtl={false}
                pauseOnFocusLoss
                draggable
                pauseOnHover
            />
            <div className="h-screen flex bg-[#F5F6F8]">
                {/* Sidebar — flat on the gray canvas */}
                <aside className="flex-shrink-0 h-full">
                    <Sidebarpro />
                </aside>

                {/* Floating white workspace panel */}
                <div className="flex min-w-0 flex-1 flex-col overflow-hidden p-3.5 pl-0 max-md:p-2.5 max-md:pl-2.5">
                    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-[18px] border border-[#E4E7EC] bg-white shadow-[0_1px_2px_rgba(16,24,40,.04)]">
                        {/* Notifications sit alone in the panel's top-right corner. */}
                        <div className="absolute top-3 right-4 z-30">
                            <NotificationBell />
                        </div>
                        <main className="sc-panel-scroll min-h-0 flex-1 overflow-y-auto p-3">
                            <div className="mx-auto">
                                {children}
                            </div>
                        </main>
                    </div>
                </div>
            </div>
        </SidebarContext.Provider>
    );
}
