"use client";

/**
 * The narrow icon rail between the modal edge and the drawer. One icon per
 * drawer section; clicking scrolls the drawer there (and re-opens it when
 * collapsed), so the rail is the whole navigation once the drawer is folded
 * away. Collapse / expand lives at the bottom.
 */

import React from "react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { DRAWER_SECTIONS, type DrawerSectionId } from "./controls/sections";

export function DesignerRail({
    active,
    collapsed,
    onJump,
    onToggleCollapse,
}: {
    active: DrawerSectionId;
    collapsed: boolean;
    onJump: (id: DrawerSectionId) => void;
    onToggleCollapse: () => void;
}) {
    return (
        <nav className="flex w-[54px] flex-shrink-0 flex-col items-center border-r border-hairline bg-surface py-2" aria-label="Report designer sections">
            <div className="flex flex-col items-center gap-0.5">
                {DRAWER_SECTIONS.map((s) => {
                    const on = s.id === active && !collapsed;
                    const Icon = s.icon;
                    return (
                        <button
                            key={s.id}
                            type="button"
                            onClick={() => onJump(s.id)}
                            title={`${s.n}. ${s.label}`}
                            aria-label={`${s.n}. ${s.label}`}
                            aria-current={on ? "true" : undefined}
                            className={`relative flex h-9 w-9 items-center justify-center rounded-control transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/30 ${
                                on ? "bg-brand-wash text-brand-500" : "text-subtle hover:bg-row-hover hover:text-body"
                            }`}
                        >
                            {on ? <span className="absolute -left-2 top-2 h-5 w-[3px] rounded-r-full bg-brand-500" aria-hidden /> : null}
                            <Icon className="h-[17px] w-[17px]" strokeWidth={1.9} aria-hidden />
                        </button>
                    );
                })}
            </div>
            <button
                type="button"
                onClick={onToggleCollapse}
                title={collapsed ? "Expand configuration" : "Collapse configuration"}
                aria-label={collapsed ? "Expand configuration" : "Collapse configuration"}
                aria-expanded={!collapsed}
                className="mt-auto flex h-9 w-9 items-center justify-center rounded-control text-subtle transition-colors hover:bg-row-hover hover:text-body focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/30"
            >
                {collapsed ? <PanelLeftOpen className="h-4 w-4" aria-hidden /> : <PanelLeftClose className="h-4 w-4" aria-hidden />}
            </button>
        </nav>
    );
}

export default DesignerRail;
