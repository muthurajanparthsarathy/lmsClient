/**
 * The configuration drawer's sections, in priority order. Shared by the
 * drawer (which renders them), the icon rail (which navigates them) and the
 * container (which tracks the active one), so the three can never disagree
 * about what exists.
 */

import {
    Award,
    Columns3,
    LayoutList,
    Microscope,
    Route,
    ScrollText,
    Tags,
    Users,
    type LucideIcon,
} from "lucide-react";

export type DrawerSectionId =
    | "scope"
    | "learners"
    | "stages"
    | "subcats"
    | "grades"
    | "sections"
    | "columns"
    | "drilldown";

export const DRAWER_SECTIONS: { id: DrawerSectionId; n: number; label: string; icon: LucideIcon }[] = [
    { id: "scope", n: 1, label: "Scope", icon: ScrollText },
    { id: "learners", n: 2, label: "Learners", icon: Users },
    { id: "stages", n: 3, label: "Learning Stages", icon: Route },
    { id: "subcats", n: 4, label: "Activity Types", icon: Tags },
    { id: "grades", n: 5, label: "Grade Bands", icon: Award },
    { id: "sections", n: 6, label: "Include in Report", icon: LayoutList },
    { id: "columns", n: 7, label: "Roster Columns", icon: Columns3 },
    { id: "drilldown", n: 8, label: "Drill-down", icon: Microscope },
];

export const sectionDomId = (id: DrawerSectionId) => `prd-section-${id}`;
