"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  BookOpen,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  File as FileIcon,
  FileText,
  FolderOpen,
  Layers,
  Library,
  Loader2,
  LogOut,
  Search,
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { getToken, clearAllStorage } from "@/lib/session";
import { postLogout } from "@/app/lms/pages/logs/api/activityLog";
import { logoutUser } from "@/apiServices/tokenVerify";

import type { CourseNode } from "./Types";

/* ─── Constants ─────────────────────────────────────────────────────────────── */
const OPEN_W             = 260;
const COLLAPSED_W        = 56;
const COLLAPSE_BREAKPOINT = 80;

/* ─── Design tokens — light theme ──────────────────────────────────────────── */
const T = {
  // Flat rail: the sidebar body is TRANSPARENT so the app's gray canvas shows
  // through (floating-workspace theme); raised elements use `surface` white.
  bg:           "transparent",
  surface:      "#ffffff",
  surfaceEl:    "#f8fafc",
  surfaceHov:   "#f4f5f7",
  surfaceAct:   "rgba(232,100,12,0.08)",
  border:       "#eef0f4",
  borderSub:    "#e5e7eb",
  borderAcc:    "rgba(232,100,12,0.24)",
  acc:          "#E8640C",
  accBright:    "#E8640C",
  accLight:     "rgba(232,100,12,0.10)",
  accGlow:      "rgba(232,100,12,0.16)",
  accGrad:      "linear-gradient(135deg,#F08243 0%,#E8640C 100%)",
  text:         "#0F172A",
  textSub:      "#334155",
  textFaint:    "#64748B",
  textGhost:    "#94A3B8",
  success:      "#059669",
  font:         "'Poppins','DM Sans','Segoe UI',sans-serif",
};

/* ─── Per-type tones ────────────────────────────────────────────────────────── */
const typeTones: Record<CourseNode["type"], { icon: string; label: string }> = {
  course:    { icon: T.acc,        label: T.acc },
  module:    { icon: T.textSub,    label: T.textSub },
  submodule: { icon: T.textSub,    label: T.textSub },
  topic:     { icon: T.textFaint,  label: T.textFaint },
  subtopic:  { icon: T.textFaint,  label: T.textFaint },
};

const toneFor = (type: CourseNode["type"]) => typeTones[type] ?? typeTones.topic;

/* ─── Helpers ───────────────────────────────────────────────────────────────── */
const formatType = (type: CourseNode["type"]) =>
  type === "submodule" ? "Sub Module" : type.charAt(0).toUpperCase() + type.slice(1);

const initials = (value: string) => {
  const words = value.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "C";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0]}${words[1][0]}`.toUpperCase();
};

const containsSelected = (node: CourseNode, selectedId: string | null): boolean =>
  !!selectedId &&
  !!node.children?.some(
    (child) => child.id === selectedId || containsSelected(child, selectedId),
  );

type SearchMatch = { node: CourseNode; trail: string[] };
const buildMatches = (
  nodes: CourseNode[],
  q: string,
  trail: string[] = [],
): SearchMatch[] => {
  const out: SearchMatch[] = [];
  for (const node of nodes) {
    const nextTrail = node.type === "course" ? trail : [...trail, node.name];
    if (node.type !== "course" && node.name.toLowerCase().includes(q))
      out.push({ node, trail });
    if (node.children?.length)
      out.push(...buildMatches(node.children, q, nextTrail));
  }
  return out;
};

/* ─── Node icon ─────────────────────────────────────────────────────────────── */
const NodeIcon = ({
  type,
  size,
  color,
}: {
  type: CourseNode["type"];
  size: number;
  color?: string;
}) => {
  const c = color ?? toneFor(type).icon;
  const props = { size, strokeWidth: 1.8, color: c };
  if (type === "course")    return <BookOpen  {...props} />;
  if (type === "module")    return <Library   {...props} />;
  if (type === "submodule") return <FolderOpen {...props} />;
  if (type === "topic")     return <FileText  {...props} />;
  return <FileIcon {...props} />;
};

/* ─── Font + global styles ──────────────────────────────────────────────────── */
const FontImport = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
    .sb-sidebar * { box-sizing: border-box; }
    .sb-sidebar { font-family: 'Poppins', 'DM Sans', 'Segoe UI', sans-serif; -webkit-font-smoothing: antialiased; }
    .sb-row { transition: background .16s ease, color .16s ease; cursor: pointer; }
    .sb-input { outline: none; transition: border-color .15s ease, box-shadow .15s ease; }
    .sb-input:focus { border-color: rgba(232,100,12,.4) !important; box-shadow: 0 0 0 3px rgba(232,100,12,.10) !important; }
    .sb-scroll { scrollbar-width: thin; scrollbar-color: #d4d8df transparent; }
    .sb-scroll::-webkit-scrollbar { width: 4px; }
    .sb-scroll::-webkit-scrollbar-thumb { background: #d4d8df; border-radius: 4px; }
    .sb-skeleton { animation: sbPulse 1.4s ease-in-out infinite; }
    @keyframes sbPulse { 0%,100%{opacity:1} 50%{opacity:.35} }
    @keyframes sbFadeIn { from{opacity:0;transform:translateY(4px)} to{opacity:1;transform:translateY(0)} }
    @keyframes sbSpin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
    .sb-icon-btn { transition: background .15s, border-color .15s, color .15s; }
    .sb-icon-btn:hover { background: #f4f5f7 !important; border-color: #e5e7eb !important; color: #E8640C !important; }
    .sb-chip-btn { transition: background .15s, border-color .15s, color .15s; }
    .sb-chip-btn:hover { background: #f4f5f7 !important; border-color: #e5e7eb !important; color: #E8640C !important; }
    .sb-node-row { transition: background .15s ease, color .15s ease, box-shadow .15s ease; }
    /* Unselected hover — subtle neutral tint (per syllabus-sidebar spec). */
    .sb-node-row:hover { background: #F8FAFC !important; }
    /* Selected row is a raised white pill (matches the main admin sidebar);
       hover keeps it white so the pill doesn't strobe between fills. */
    .sb-node-row.sb-node-selected:hover { background: #ffffff !important; }
    /* Slim tangerine active-rail on the left edge of the selected row. */
    .sb-node-row.sb-node-selected::before {
      content: "";
      position: absolute;
      left: -1px;
      top: 8px;
      bottom: 8px;
      width: 3px;
      background: #F97316;
      border-radius: 0 3px 3px 0;
    }
  `}</style>
);

/* ─── Loading skeleton ──────────────────────────────────────────────────────── */
const LoadingSidebar = ({ width }: { width: number }) => (
  <div
    className="sb-sidebar"
    style={{
      width,
      height: "100%",
      display: "flex",
      flexDirection: "column",
      background: T.bg,
    }}
  >
    <FontImport />
    <div style={{ padding: "12px 12px 10px", borderBottom: `1px solid ${T.border}` }}>
      <div className="sb-skeleton" style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 32, height: 32, borderRadius: 9, background: T.surfaceEl }} />
        <div style={{ flex: 1 }}>
          <div style={{ width: "60%", height: 8, borderRadius: 4, background: T.surfaceEl, marginBottom: 6 }} />
          <div style={{ width: "85%", height: 11, borderRadius: 4, background: T.surfaceEl }} />
        </div>
      </div>
    </div>
    <div style={{ padding: "10px 10px 8px", borderBottom: `1px solid ${T.border}` }}>
      <div className="sb-skeleton" style={{ height: 32, borderRadius: 8, background: T.surfaceEl, marginBottom: 8 }} />
      <div style={{ display: "flex", gap: 6 }}>
        <div className="sb-skeleton" style={{ flex: 1, height: 28, borderRadius: 7, background: T.surfaceEl }} />
        <div className="sb-skeleton" style={{ flex: 1, height: 28, borderRadius: 7, background: T.surfaceEl }} />
      </div>
    </div>
    <div style={{ flex: 1, padding: "8px 8px", display: "flex", flexDirection: "column", gap: 6 }}>
      {Array.from({ length: 7 }).map((_, i) => (
        <div
          key={i}
          className="sb-skeleton"
          style={{
            height: 38, borderRadius: 8, background: T.surfaceEl,
            marginLeft: `${Math.min(i % 4, 3) * 12}px`,
          }}
        />
      ))}
    </div>
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
      padding: "12px", borderTop: `1px solid ${T.border}`,
      fontSize: 11.5, color: T.textFaint, fontFamily: T.font,
    }}>
      <Loader2 size={14} style={{ animation: "sbSpin .8s linear infinite", color: T.acc }} />
      Loading course map…
    </div>
  </div>
);

/* ─── Icon button ───────────────────────────────────────────────────────────── */
const IconBtn: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = ({ children, style, ...rest }) => (
  <button
    type="button"
    className="sb-icon-btn"
    style={{
      width: 30, height: 30, borderRadius: 8, flexShrink: 0,
      display: "flex", alignItems: "center", justifyContent: "center",
      border: `1px solid ${T.border}`, background: T.surface,
      cursor: "pointer", color: T.textFaint, padding: 0,
      ...style,
    }}
    {...rest}
  >
    {children}
  </button>
);

/* ─── Section label ─────────────────────────────────────────────────────────── */
const SectionLabel = ({ label }: { label: string }) => (
  <div style={{
    fontFamily: T.font, fontSize: 11, fontWeight: 600,
    letterSpacing: "0.05em", textTransform: "uppercase" as const,
    color: T.textGhost, padding: "12px 16px 6px",
  }}>
    {label}
  </div>
);

/* ─── Tree node ─────────────────────────────────────────────────────────────── */
interface TreeNodeProps {
  node: CourseNode;
  depth: number;
  selectedNode: CourseNode | null;
  expandedNodes: Set<string>;
  onNodeSelect: (node: CourseNode) => void;
  onToggleNode: (id: string) => void;
}

const TreeNode: React.FC<TreeNodeProps> = ({
  node, depth, selectedNode, expandedNodes, onNodeSelect, onToggleNode,
}) => {
  const [hover, setHover] = useState(false);
  const tone       = toneFor(node.type);
  const hasChildren = !!node.children?.length;
  const isExpanded  = expandedNodes.has(node.id);
  const isSelected  = selectedNode?.id === node.id;
  const activeBranch = !isSelected && containsSelected(node, selectedNode?.id ?? null);
  const isLeaf = !hasChildren;

  const select = () => {
    onNodeSelect(node);
    if (hasChildren && !isExpanded) onToggleNode(node.id);
  };

  const indentPx = depth * 12;
  // Sized to match the app's other sidebars (13px nav rows).
  const iconBox   = depth === 0 ? 24 : 20;
  const iconSize  = depth === 0 ? 15 : 13;
  const fontSize  = depth === 0 ? 13.5 : 13;

  return (
    <div style={{ animation: "sbFadeIn .16s ease both" }}>
      {/* Row */}
      <div
        className={`sb-node-row${isSelected ? " sb-node-selected" : ""}`}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        onClick={select}
        style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "6px 10px 6px 0",
          marginLeft: 8 + indentPx,
          marginRight: 8,
          borderRadius: 10,
          // Selected pill — raised white on the gray rail (matches the main
          // admin sidebar's selection idiom: white fill + hairline border +
          // subtle shadow carry "selected"; the tangerine still appears in
          // the icon/text tone and the slim ::before rail).
          background: isSelected ? "#ffffff" : "transparent",
          border: isSelected ? "1px solid #E4E7EC" : "1px solid transparent",
          boxShadow: isSelected ? "0 1px 2px rgba(15, 23, 42, 0.04)" : "none",
          cursor: "pointer",
          userSelect: "none",
          position: "relative",
        }}
      >
        {/* Vertical tree line — light gray guide beside child syllabus items. */}
        {depth > 0 && (
          <span style={{
            position: "absolute",
            top: 0, bottom: 0, width: 1,
            left: -indentPx + 4,
            background: "#E2E8F0",
          }} />
        )}

        {/* Expand/collapse or dot */}
        <div style={{
          width: 20, height: 20, flexShrink: 0, marginLeft: 8,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          {hasChildren ? (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onToggleNode(node.id); }}
              style={{
                width: 18, height: 18, borderRadius: 5, border: "none",
                background: "transparent",
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", padding: 0,
                color: isSelected ? T.acc : T.textFaint,
                flexShrink: 0,
                transition: "transform .15s ease, color .15s ease",
                transform: isExpanded ? "rotate(0deg)" : "rotate(0deg)",
              }}
              aria-label={isExpanded ? `Collapse ${node.name}` : `Expand ${node.name}`}
            >
              {isExpanded
                ? <ChevronDown size={12} strokeWidth={2} />
                : <ChevronRight size={12} strokeWidth={2} />}
            </button>
          ) : (
            <span style={{
              width: isSelected ? 6 : 4, height: isSelected ? 6 : 4,
              borderRadius: "50%",
              background: isSelected ? "#F97316" : "#94A3B8",
              display: "block",
            }} />
          )}
        </div>

        {/* Type icon */}
        <div style={{
          width: isSelected ? 18 : iconBox, height: isSelected ? 18 : iconBox,
          flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: "transparent",
          transition: "color .15s",
        }}>
          <NodeIcon
            type={node.type}
            size={isSelected ? 18 : iconSize + 2}
            color={isSelected ? "#EA580C" : "#64748B"}
          />
        </div>

        {/* Label */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: T.font,
            fontSize,
            fontWeight: isSelected ? 600 : 500,
            // Selected uses the strong-tangerine text tone; unselected keeps
            // the neutral slate (T.textSub === #334155).
            color: isSelected ? "#C2410C" : T.textSub,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            lineHeight: 1.3,
            transition: "color .15s",
          }}>
            {node.name}
          </div>

        </div>
      </div>

      {/* Children */}
      {hasChildren && isExpanded && (
        <div style={{ animation: "sbFadeIn .16s ease both" }}>
          {node.children!.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              selectedNode={selectedNode}
              expandedNodes={expandedNodes}
              onNodeSelect={onNodeSelect}
              onToggleNode={onToggleNode}
            />
          ))}
        </div>
      )}
    </div>
  );
};

/* ─── Props ─────────────────────────────────────────────────────────────────── */
interface Props {
  courseData:           CourseNode[];
  selectedNode:         CourseNode | null;
  expandedNodes:        Set<string>;
  sidebarWidth:         number;
  searchQuery:          string;
  courseName:           string;
  moduleCount:          number;
  onNodeSelect:         (node: CourseNode) => void;
  onToggleNode:         (id: string) => void;
  onSidebarWidthChange: (width: number) => void;
  onSearchChange:       (query: string) => void;
  onMouseDown:          (event: React.MouseEvent) => void;
  onExpandAll?:         () => void;
  onCollapseAll?:       () => void;
  isLoading?:           boolean;
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN EXPORT
   ═══════════════════════════════════════════════════════════════════════════ */
export const CourseSidebar: React.FC<Props> = ({
  courseData,
  selectedNode,
  expandedNodes,
  sidebarWidth,
  searchQuery,
  courseName,
  moduleCount,
  onNodeSelect,
  onToggleNode,
  onSidebarWidthChange,
  onSearchChange,
  onMouseDown,
  onExpandAll,
  onCollapseAll,
  isLoading = false,
}) => {
  const router = useRouter();
  const isCollapsed = sidebarWidth <= COLLAPSE_BREAKPOINT;

  // Back goes to the section the user actually came in through. This screen is
  // mounted by two routes — /lms/pages/courses/uploadcourseresources and
  // /lms/pages/coursestructure/uploadcourseresources — so a hard-coded
  // "/lms/pages/courses" dropped anyone who arrived via Course Structure onto a
  // page they had never visited. Mirrors `useParentSection` in the page.
  const pathname = usePathname() || "";
  const back = pathname.startsWith("/lms/pages/coursestructure")
    ? { href: "/lms/pages/coursestructure", title: "Back to course management" }
    : { href: "/lms/pages/courses", title: "Back to courses" };

  // Signed-in profile for the footer row (replaces the old selected-node
  // status) — same identity + real logout flow as the app's other sidebars.
  const [account, setAccount] = useState({ name: "User", role: "", initial: "U" });
  const [signingOut, setSigningOut] = useState(false);
  useEffect(() => {
    try {
      const u = JSON.parse(localStorage.getItem("smartcliff_userData") || "null");
      if (u) {
        setAccount({
          name: `${u.firstName || ""} ${u.lastName || ""}`.trim() || "User",
          role: u.role?.renameRole || u.role?.originalRole || "",
          initial: (u.firstName?.charAt(0) || "U").toUpperCase(),
        });
      }
    } catch { /* keep defaults */ }
  }, []);
  const handleLogout = async () => {
    setSigningOut(true);
    const token = getToken();
    try {
      // postLogout must run while the token is still stored — it records the
      // session duration in the activity log.
      await postLogout();
      if (token) await logoutUser(token);
    } catch (e) {
      console.error("Logout error:", e);
    } finally {
      clearAllStorage();
      window.location.href = "/login";
    }
  };

  const roots = useMemo(
    () =>
      courseData[0]?.type === "course"
        ? courseData[0].children ?? []
        : courseData,
    [courseData],
  );

  const matches = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return q ? buildMatches(courseData, q) : [];
  }, [courseData, searchQuery]);

  if (isLoading) return <LoadingSidebar width={sidebarWidth} />;

  /* ── COLLAPSED ── */
  if (isCollapsed) {
    return (
      <div
        className="sb-sidebar"
        style={{
          width: sidebarWidth, height: "100%",
          display: "flex", flexDirection: "column",
          alignItems: "center", gap: 10,
          background: T.bg,
          padding: "10px 0",
        }}
      >
        <FontImport />

        {/* Expand button */}
        <button
          type="button"
          className="sb-icon-btn"
          onClick={() => onSidebarWidthChange(OPEN_W)}
          style={{
            width: 34, height: 34, borderRadius: 9,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: T.accLight,
            border: `0.5px solid ${T.borderAcc}`,
            cursor: "pointer", color: T.acc,
          }}
          title="Expand sidebar"
        >
          <ChevronRight size={16} strokeWidth={2} />
        </button>

        {/* Back */}
        <IconBtn onClick={() => router.push(back.href)} title={back.title}>
          <ArrowLeft size={13} strokeWidth={2} />
        </IconBtn>

        {/* Course initials */}
        <div style={{
          width: 34, height: 34, borderRadius: 9, flexShrink: 0,
          background: T.accGrad,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontFamily: T.font, fontSize: 12, fontWeight: 700, color: "#fff",
        }}>
          {initials(courseName)}
        </div>

        {/* Selected node icon */}
        {selectedNode && (
          <div
            title={selectedNode.name}
            style={{
              width: 34, height: 34, borderRadius: 9,
              display: "flex", alignItems: "center", justifyContent: "center",
              background: T.accLight, border: `0.5px solid ${T.borderAcc}`,
            }}
          >
            <NodeIcon type={selectedNode.type} size={16} color={T.acc} />
          </div>
        )}

        {/* Bottom: signed-in avatar + logout (mirrors the expanded footer) */}
        <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
          <div style={{
            width: 30, height: 30, borderRadius: "50%",
            background: "#111827",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: T.font, fontSize: 11, fontWeight: 600, color: "#fff",
          }}>
            {account.initial}
          </div>
          <IconBtn onClick={handleLogout} title="Sign out" disabled={signingOut}>
            {signingOut
              ? <Loader2 size={13} style={{ animation: "sbSpin .8s linear infinite" }} />
              : <LogOut size={13} strokeWidth={2} />}
          </IconBtn>
        </div>
      </div>
    );
  }

  /* ── EXPANDED ── */
  return (
    <div
      className="sb-sidebar"
      style={{
        width: sidebarWidth, height: "100%",
        display: "flex", flexDirection: "column",
        background: T.bg,
        position: "relative",
      }}
    >
      <FontImport />

      {/* ── Header — raised white course card on the gray rail ── */}
      <div style={{ padding: "12px 12px 6px", flexShrink: 0 }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          background: T.surface,
          border: "1px solid #E4E7EC",
          borderRadius: 14,
          boxShadow: "0 1px 2px rgba(16,24,40,.04)",
          padding: "10px 10px",
        }}>

          {/* Course icon */}
          <div style={{
            width: 36, height: 36, borderRadius: 10, flexShrink: 0,
            background: T.accGrad,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <BookOpen size={15} strokeWidth={2} color="#fff" />
          </div>

          {/* Course name + module count */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontFamily: T.font, fontSize: 14, fontWeight: 700,
              color: T.text,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              lineHeight: 1.25,
            }}>
              {courseName || "Course"}
            </div>
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 4, marginTop: 3,
            }}>
              <Layers size={10} color={T.textFaint} strokeWidth={2} />
              <span style={{
                fontFamily: T.font, fontSize: 11, fontWeight: 500,
                color: T.textFaint,
              }}>
                {moduleCount} modules
              </span>
            </div>
          </div>

          {/* Back + collapse buttons */}
          <div style={{ display: "flex", gap: 4 }}>
            <IconBtn
              onClick={() => router.push(back.href)}
              title={back.title}
            >
              <ArrowLeft size={12} strokeWidth={2} />
            </IconBtn>
            <IconBtn
              onClick={() => onSidebarWidthChange(COLLAPSED_W)}
              title="Collapse sidebar"
            >
              <ChevronLeft size={12} strokeWidth={2} />
            </IconBtn>
          </div>
        </div>
      </div>

      {/* Search box and Expand/Collapse chips were removed by request — the
          tree is compact enough to browse directly, and collapse lives on the
          course card. The search-results branch below only activates if a
          parent ever drives `searchQuery` externally. */}

      {/* ── Scrollable tree / search results ── */}
      <div
        className="sb-scroll"
        style={{ flex: 1, overflowY: "auto", paddingBottom: 8 }}
      >
        {searchQuery.trim() ? (
          /* Search results */
          matches.length ? (
            <div style={{ padding: "6px 8px", display: "flex", flexDirection: "column", gap: 4 }}>
              <SectionLabel label={`${matches.length} result${matches.length !== 1 ? "s" : ""}`} />
              {matches.map(({ node, trail }) => {
                const tone = toneFor(node.type);
                const isSel = selectedNode?.id === node.id;
                return (
                  <button
                    key={`${node.id}-${trail.join("/")}`}
                    type="button"
                    className="sb-row"
                    onClick={() => onNodeSelect(node)}
                    style={{
                      width: "100%", textAlign: "left",
                      display: "flex", alignItems: "center", gap: 10,
                      padding: "9px 10px", borderRadius: 8,
                      background: isSel ? T.surfaceAct : T.surface,
                      border: `1px solid ${isSel ? T.borderAcc : T.border}`,
                      cursor: "pointer",
                    }}
                  >
                    <div style={{
                      width: 28, height: 28, borderRadius: 7, flexShrink: 0,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      background: isSel ? T.accLight : T.surfaceEl,
                      border: `1px solid ${T.border}`,
                    }}>
                      <NodeIcon type={node.type} size={14} color={isSel ? T.acc : tone.icon} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontFamily: T.font, fontSize: 12.5, fontWeight: 600,
                        color: isSel ? T.acc : T.text,
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      }}>
                        {node.name}
                      </div>
                      {trail.length > 0 && (
                        <div style={{
                          fontFamily: T.font, fontSize: 10.5, color: T.textFaint,
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                          marginTop: 1,
                        }}>
                          {trail.join(" › ")}
                        </div>
                      )}
                    </div>
                    <ChevronRight
                      size={13} strokeWidth={2}
                      style={{ color: isSel ? T.acc : T.textFaint, flexShrink: 0 }}
                    />
                  </button>
                );
              })}
            </div>
          ) : (
            /* No results */
            <div style={{
              padding: "32px 16px", textAlign: "center",
              display: "flex", flexDirection: "column", alignItems: "center", gap: 10,
            }}>
              <div style={{
                width: 44, height: 44, borderRadius: 11,
                background: T.surfaceEl,
                border: `1px solid ${T.border}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                color: T.acc,
              }}>
                <Search size={18} strokeWidth={1.8} />
              </div>
              <div style={{ fontFamily: T.font, fontSize: 13, fontWeight: 600, color: T.text }}>
                No results
              </div>
              <div style={{ fontFamily: T.font, fontSize: 11.5, color: T.textFaint, lineHeight: 1.6 }}>
                Try a different keyword to find modules, topics, or lessons.
              </div>
            </div>
          )
        ) : roots.length ? (
          /* Tree */
          <div style={{ paddingTop: 6 }}>
            <SectionLabel label="Syllabus" />
            {roots.map((node) => (
              <TreeNode
                key={node.id}
                node={node}
                depth={0}
                selectedNode={selectedNode}
                expandedNodes={expandedNodes}
                onNodeSelect={onNodeSelect}
                onToggleNode={onToggleNode}
              />
            ))}
          </div>
        ) : (
          /* Empty state */
          <div style={{
            padding: "32px 16px", textAlign: "center",
            display: "flex", flexDirection: "column", alignItems: "center", gap: 10,
          }}>
            <div style={{
              width: 44, height: 44, borderRadius: 11,
              background: T.surfaceEl,
              border: `1px solid ${T.border}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              color: T.acc,
            }}>
              <Library size={18} strokeWidth={1.8} />
            </div>
            <div style={{ fontFamily: T.font, fontSize: 13, fontWeight: 600, color: T.text }}>
              No course structure yet
            </div>
            <div style={{ fontFamily: T.font, fontSize: 11.5, color: T.textFaint, lineHeight: 1.6 }}>
              Add modules and topics to start organizing this course.
            </div>
          </div>
        )}
      </div>

      {/* ── Footer: signed-in profile + logout — matches the app sidebars ── */}
      <div style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "12px 14px",
        borderTop: "1px solid #E4E7EC",
        flexShrink: 0,
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
          background: "#111827",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontFamily: T.font, fontSize: 12, fontWeight: 600, color: "#fff",
        }}>
          {account.initial}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: T.font, fontSize: 13, fontWeight: 600, color: T.text,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {account.name}
          </div>
          <div style={{
            fontFamily: T.font, fontSize: 11, color: T.textFaint,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {account.role || "Signed in"}
          </div>
        </div>
        <button
          type="button"
          className="sb-icon-btn"
          onClick={handleLogout}
          disabled={signingOut}
          title="Sign out"
          style={{
            width: 30, height: 30, borderRadius: 8, flexShrink: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            border: "1px solid #E4E7EC", background: T.surface,
            cursor: "pointer", color: T.textFaint, padding: 0,
            opacity: signingOut ? 0.6 : 1,
          }}
        >
          {signingOut
            ? <Loader2 size={13} style={{ animation: "sbSpin .8s linear infinite" }} />
            : <LogOut size={13} strokeWidth={2} />}
        </button>
      </div>

      {/* ── Drag-resize handle ── */}
      <div
        onMouseDown={onMouseDown}
        style={{
          position: "absolute", right: -4, top: 0,
          width: 8, height: "100%",
          cursor: "col-resize",
          display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 10,
        }}
      >
        <div style={{
          width: 2, height: 40, borderRadius: 2,
          background: T.accLight,
        }} />
      </div>
    </div>
  );
};