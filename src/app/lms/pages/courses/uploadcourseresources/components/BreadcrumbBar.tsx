"use client";

import React, { useState } from "react";
import { ChevronRight, Navigation } from "lucide-react";
import type { HierarchyInfo } from "./Pagecreationmodal";

// ─── Design tokens ─────────────────────────────────────────────────────────────
const T = {
  orange:      "#F27757",
  orangeDark:  "#E0623F",
  orangeLight: "rgba(242,119,87,0.08)",
  textMain:    "#1a1a2e",
  textSub:     "#6b6b7e",
  textMuted:   "#8b8b9e",
  textHint:    "#bcbccc",
  border:      "#ece9f1",
  bg:          "#ffffff",
  pageBg:      "#faf9fc",
};

const CRUMB_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  course:    { bg: "rgba(242,119,87,0.08)",  text: "#C95530", dot: "#F27757" },
  module:    { bg: "rgba(242,119,87,0.12)",  text: "#E0623F", dot: "#F27757" },
  submodule: { bg: "rgba(99,102,241,0.08)",  text: "#4338ca", dot: "#818cf8" },
  topic:     { bg: "rgba(16,185,129,0.08)",  text: "#047857", dot: "#34d399" },
  subtopic:  { bg: "rgba(245,158,11,0.08)",  text: "#b45309", dot: "#fbbf24" },
  tab:       { bg: "rgba(59,130,246,0.08)",  text: "#1d4ed8", dot: "#60a5fa" },
};

// ─── Types ─────────────────────────────────────────────────────────────────────
export interface BreadcrumbCrumb {
  label: string;      // truncated display text
  fullLabel: string;  // full text shown in tooltip & confirm
  type: string;
  id?: string;        // present = clickable/navigable
}

function truncate(s: string | undefined, max = 24): string {
  if (!s) return "";
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

/** Build crumb list from HierarchyInfo */
export function buildCrumbsFromHierarchy(h: HierarchyInfo): BreadcrumbCrumb[] {
  const crumbs: BreadcrumbCrumb[] = [];
  if (h.courseName)    crumbs.push({ label: truncate(h.courseName),    fullLabel: `Course: ${h.courseName}`,          type: "course",    id: h.courseId });
  if (h.moduleName)    crumbs.push({ label: truncate(h.moduleName),    fullLabel: `Module: ${h.moduleName}`,          type: "module",    id: h.moduleId });
  if (h.subModuleName) crumbs.push({ label: truncate(h.subModuleName), fullLabel: `Sub-Module: ${h.subModuleName}`,   type: "submodule", id: h.subModuleId });
  if (h.topicName)     crumbs.push({ label: truncate(h.topicName),     fullLabel: `Topic: ${h.topicName}`,           type: "topic",     id: h.topicId });
  if (h.subTopicName)  crumbs.push({ label: truncate(h.subTopicName),  fullLabel: `Sub-Topic: ${h.subTopicName}`,    type: "subtopic",  id: h.subTopicId });
  if (h.tabType)       crumbs.push({ label: h.tabType.replace(/_/g, " "), fullLabel: `Section: ${h.tabType.replace(/_/g, " ")}`, type: "tab" });
  return crumbs;
}

// ─── BreadcrumbBar ─────────────────────────────────────────────────────────────
interface BreadcrumbBarProps {
  crumbs: BreadcrumbCrumb[];
  /** Called with the node id when user confirms navigation */
  onNavigate?: (nodeId: string) => void;
}

export const BreadcrumbBar: React.FC<BreadcrumbBarProps> = ({ crumbs, onNavigate }) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [confirm, setConfirm]       = useState<{ id: string; fullLabel: string } | null>(null);

  if (!crumbs.length) return null;

  return (
    <>
      {/* ── Crumb strip ─────────────────────────────────────────────────────── */}
      <div
        className="flex flex-wrap items-center gap-1 px-4 py-2 flex-shrink-0"
        style={{ borderBottom: `1px solid ${T.border}`, background: T.pageBg }}
      >
        {crumbs.map((crumb, i) => {
          const c      = CRUMB_COLORS[crumb.type] ?? { bg: T.pageBg, text: T.textSub, dot: T.border };
          const canNav = !!onNavigate && !!crumb.id;
          const isHov  = hoveredIdx === i;

          return (
            <React.Fragment key={i}>
              {i > 0 && <ChevronRight size={9} style={{ color: T.textHint, flexShrink: 0 }} />}

              {/* Pill wrapper — relative so tooltip stays attached */}
              <div className="relative" style={{ zIndex: isHov ? 10 : "auto" }}>
                <span
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold transition-all duration-150 select-none"
                  style={{
                    background: isHov && canNav ? `${c.dot}22` : c.bg,
                    color:      c.text,
                    border:     `1px solid ${isHov && canNav ? c.dot + "55" : c.dot + "25"}`,
                    cursor:     canNav ? "pointer" : "default",
                    boxShadow:  isHov && canNav ? `0 2px 8px ${c.dot}22` : "none",
                    transform:  isHov && canNav ? "translateY(-1px)" : "none",
                  }}
                  onMouseEnter={() => canNav && setHoveredIdx(i)}
                  onMouseLeave={() => setHoveredIdx(null)}
                  onClick={() => canNav && setConfirm({ id: crumb.id!, fullLabel: crumb.fullLabel })}
                >
                  <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: c.dot }} />
                  {crumb.label}
                  {canNav && isHov && (
                    <Navigation size={8} style={{ color: c.text, opacity: 0.7, marginLeft: 1 }} />
                  )}
                </span>

                {/* Hover tooltip */}
                {isHov && canNav && (
                  <div
                    className="absolute pointer-events-none whitespace-nowrap px-2.5 py-1.5 rounded-xl text-[10.5px] font-semibold"
                    style={{
                      bottom: "calc(100% + 8px)",
                      left:   "50%",
                      transform: "translateX(-50%)",
                      background: "#1a1a2e",
                      color:      "#fff",
                      boxShadow:  "0 6px 20px rgba(0,0,0,0.30)",
                      zIndex:     9999,
                    }}
                  >
                    <span style={{ color: "rgba(255,255,255,0.55)", fontWeight: 400 }}>Click to navigate → </span>
                    {crumb.fullLabel}
                    {/* Caret */}
                    <div style={{
                      position: "absolute", top: "100%", left: "50%", transform: "translateX(-50%)",
                      width: 0, height: 0,
                      borderLeft:  "5px solid transparent",
                      borderRight: "5px solid transparent",
                      borderTop:   "5px solid #1a1a2e",
                    }} />
                  </div>
                )}
              </div>
            </React.Fragment>
          );
        })}
      </div>

      {/* ── Confirmation dialog (fixed, overlays the whole modal) ────────────── */}
      {confirm && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center"
          style={{ background: "rgba(15,15,30,0.55)", backdropFilter: "blur(4px)" }}
          onClick={() => setConfirm(null)}
        >
          <div
            className="flex flex-col gap-3.5 p-5 rounded-2xl"
            style={{
              background:  T.bg,
              border:      `1.5px solid ${T.border}`,
              boxShadow:   "0 20px 50px rgba(0,0,0,0.22)",
              maxWidth:    340,
              width:       "calc(100vw - 40px)",
              fontFamily:  "'Poppins',-apple-system,sans-serif",
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Icon + title */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: T.orangeLight, border: `1.5px solid ${T.orange}25` }}>
                <Navigation size={18} style={{ color: T.orange }} />
              </div>
              <div>
                <p className="text-[13.5px] font-bold" style={{ color: T.textMain }}>Navigate away?</p>
                <p className="text-[11px] mt-0.5" style={{ color: T.textMuted }}>
                  Go to <span style={{ color: T.orange, fontWeight: 700 }}>{confirm.fullLabel}</span>?
                </p>
              </div>
            </div>

            <p className="text-[11.5px] leading-relaxed" style={{ color: T.textSub }}>
              This will close the modal and take you to that level. Any unsaved changes will be lost.
            </p>

            {/* Actions */}
            <div className="flex gap-2">
              <button
                className="flex-1 py-1.5 rounded-lg text-[12px] font-bold transition-all"
                style={{ background: T.pageBg, border: `1.5px solid ${T.border}`, color: T.textSub }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "#f0eef6"}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = T.pageBg}
                onClick={() => setConfirm(null)}
              >
                Stay here
              </button>
              <button
                className="flex-1 py-1.5 rounded-lg text-[12px] font-bold text-white transition-all"
                style={{ background: T.orange, boxShadow: `0 3px 12px rgba(242,119,87,0.32)` }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = T.orangeDark}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = T.orange}
                onClick={() => { onNavigate!(confirm.id); setConfirm(null); }}
              >
                Yes, go there
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default BreadcrumbBar;
