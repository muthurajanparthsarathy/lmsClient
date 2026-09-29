"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import {
  X, FileText, Video, FileArchive, Link2, BookOpen, FolderPlus,
  Search, File, Presentation, FilePlus2, Star, Info, Sparkles,
} from "lucide-react";
import type { FileTypeConfig, CourseNode } from "./Types";
import { PageCreationModal, type PageBlock, type HierarchyInfo, type PagesPayload } from "./Pagecreationmodal";
import { PlainBreadcrumb, type PlainCrumb } from "./PlainBreadcrumb";

// ─── Design tokens ─────────────────────────────────────────────────────────────
const T = {
  orange:      "#F27757",
  orangeDark:  "#E0623F",
  orangeLight: "rgba(242,119,87,0.08)",
  orangeMid:   "rgba(242,119,87,0.15)",
  textMain:    "#1a1a2e",
  textSub:     "#6b6b7e",
  textMuted:   "#8b8b9e",
  textHint:    "#bcbccc",
  border:      "#ece9f1",
  bg:          "#ffffff",
  pageBg:      "#faf9fc",
  warm:        "#fff8f6",
};

// ─── Props ─────────────────────────────────────────────────────────────────────
interface NotionResourceModalProps {
  isOpen: boolean;
  onClose: () => void;
  fileTypes: FileTypeConfig[];
  // Notes / AI — shown in their own "Student Used Feature" section below the
  // main picker, and only when the Super Admin enabled at least one of them
  // for this institution (see Resource Management). Empty/omitted → section
  // is hidden entirely.
  studentFeatureItems?: { key: string; label: string; description: string; icon: React.ReactNode; color: string }[];
  selectedNode: CourseNode | null;
  activeTab: "I_Do" | "We_Do" | "You_Do" | null;
  activeSubcategory: string;
  currentFolderPath: string[];
  onSelectType: (typeKey: string) => void;
  onCreateFolder: () => void;
  onOpenFileUploadModal: () => void;
  onCreatePage?: (blocks: PageBlock[], title: string, hierarchyInfo?: HierarchyInfo) => void;
  hierarchyInfo?: HierarchyInfo;
  onPageCreated?: () => Promise<void>;
  onNavigateTo?: (nodeId: string) => void;
  /**
   * Plain non-clickable breadcrumb crumbs (Course > Module > … > Group >
   * Folder > Subfolder) rendered at the top of the picker so the user can
   * see exactly where the resource they're about to create will land.
   * Parent builds this from hierarchyInfo + group context + currentFolderPath.
   */
  pathCrumbs?: PlainCrumb[];
}

// ─── Picker items ──────────────────────────────────────────────────────────────
/**
 * The upload types the "File" card stands for. The card is a doorway into the
 * file upload modal, which itself only offers the types the course enabled — so
 * with none of these enabled the card would open an empty modal and is hidden.
 * Notes / AI are deliberately absent: they're "Student Used Feature" items with
 * their own section, and must not keep the File card alive on their own.
 */
const FILE_CARD_TYPES = ["video", "ppt", "pdf", "image", "zip"] as const;

type PickerItem = {
  key: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  badge?: string;
  /**
   * Which enabled resource-type keys this card needs. `undefined` → structural
   * card (Folder / Page / Reference), always shown: course setup has no switch
   * for them, so there is nothing to gate them on.
   */
  requires?: readonly string[];
};

const PICKER_ITEMS: PickerItem[] = [
  { key: "folder",        label: "Folder",       description: "Organise files into named folders",          icon: <FolderPlus />, color: "#F27757" },
  { key: "file",          label: "File",          description: "Upload PDF, PPT, Video, ZIP and more",       icon: <File />,       color: "#3b82f6", requires: FILE_CARD_TYPES },
  { key: "page_creation", label: "Page",          description: "Build rich content with editable blocks",    icon: <FilePlus2 />,  color: "#6366f1", badge: "Live Edit" },
  { key: "url",           label: "URL",           description: "Link to external websites or articles",      icon: <Link2 />,      color: "#10b981", requires: ["url"] },
  { key: "reference",     label: "Reference",     description: "Add supplementary reference materials",      icon: <BookOpen />,   color: "#8b5cf6" },
];

// ─── Location breadcrumb helper ─────────────────────────────────────────────────
/**
 * Builds a simple "Course › Module › … › Folder" path from the hierarchy so the
 * user can see exactly where the new resource will be created. Parent academic
 * levels become clickable when an `onNavigate` handler is supplied; the current
 * (last) level always renders as plain, non-clickable text.
 */
function buildPlainPathCrumbs(
  h: HierarchyInfo | undefined,
  opts: {
    tab?: "I_Do" | "We_Do" | "You_Do" | null;
    subcategory?: string;
    folderPath?: string[];
    onNavigate?: (nodeId: string) => void;
  } = {}
): PlainCrumb[] {
  if (!h) return [];

  const crumbs: PlainCrumb[] = [];
  const nav = opts.onNavigate;
  const push = (label?: string | null, id?: string) => {
    if (!label) return;
    crumbs.push({ label, onClick: nav && id ? () => nav(id) : undefined });
  };

  // Academic hierarchy: Course → Module → Sub-Module → Topic → Sub-Topic
  push(h.courseName, h.courseId);
  push(h.moduleName, h.moduleId);
  push(h.subModuleName, h.subModuleId);
  push(h.topicName, h.topicId);
  push(h.subTopicName, h.subTopicId);

  // Section (I Do / We Do / You Do) and its subcategory
  const tab = h.tabType ?? opts.tab;
  if (tab) push(tab.replace(/_/g, " "));

  const subcategory = h.subcategory ?? opts.subcategory;
  if (subcategory) push(subcategory);

  // Group, then the current folder navigation path
  push(h.groupName, h.groupId);

  const folders = (h.folderPath && h.folderPath.length ? h.folderPath : opts.folderPath) ?? [];
  folders.forEach(folder => push(folder));

  return crumbs;
}

// ─── NotionResourceModal ───────────────────────────────────────────────────────
export const NotionResourceModal: React.FC<NotionResourceModalProps> = ({
  isOpen, onClose, fileTypes, studentFeatureItems = [], selectedNode, activeTab, activeSubcategory,
  currentFolderPath, onSelectType, onCreateFolder, onOpenFileUploadModal,
  onCreatePage, hierarchyInfo, onPageCreated, onNavigateTo, pathCrumbs,
}) => {
  const [search,        setSearch]        = useState("");
  const [hoveredKey,    setHoveredKey]    = useState<string | null>(null);
  const [showPageModal, setShowPageModal] = useState(false);
  const [favorites,     setFavorites]     = useState<Set<string>>(new Set());
  const [infoKey,       setInfoKey]       = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const toggleFav = (key: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFavorites(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });
  };

  useEffect(() => {
    if (isOpen) { setSearch(""); setTimeout(() => searchRef.current?.focus(), 120); }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [isOpen, onClose]);

  /**
   * The cards this course actually gets. `fileTypes` has already been narrowed
   * by the parent to the types the course enabled in Course Setup (which is
   * itself narrowed by the service mapping and the institution's Resource
   * Management), so gating on it keeps the chain Super Admin → mapping →
   * course setup → picker intact with no second source of truth.
   *
   * The "File" card also takes its description from the enabled types, so it
   * never advertises a format the upload modal won't accept.
   */
  const availableItems = useMemo(() => {
    const enabled = new Set(fileTypes.map(t => t.key));
    const fileLabels = FILE_CARD_TYPES.filter(k => enabled.has(k))
      .map(k => fileTypes.find(t => t.key === k)?.label ?? k);

    return PICKER_ITEMS
      .filter(item => !item.requires || item.requires.some(k => enabled.has(k)))
      .map(item =>
        item.key === "file" && fileLabels.length > 0
          ? { ...item, description: `Upload ${fileLabels.join(", ")}` }
          : item
      );
  }, [fileTypes]);

  if (!isOpen) return null;

  const filtered = availableItems.filter(item =>
    item.label.toLowerCase().includes(search.toLowerCase()) ||
    item.description.toLowerCase().includes(search.toLowerCase())
  );
  const filteredStudentFeatures = studentFeatureItems.filter(item =>
    item.label.toLowerCase().includes(search.toLowerCase()) ||
    item.description.toLowerCase().includes(search.toLowerCase())
  );

  const handleSelect = (key: string) => {
    if (key === "folder")             { onClose(); onCreateFolder(); }
    else if (key === "file")          { onClose(); onOpenFileUploadModal(); }
    else if (key === "page_creation") { setShowPageModal(true); }
    else                              { onClose(); onSelectType(key); }
  };

  type PickerCardItem = { key: string; label: string; description: string; icon: React.ReactNode; color: string; badge?: string };
  const renderCard = (item: PickerCardItem) => {
    const isHov  = hoveredKey === item.key;
    const isFav  = favorites.has(item.key);
    const isInfo = infoKey === item.key;

    return (
      <div
        key={item.key}
        className="relative flex flex-col items-center rounded-xl cursor-pointer select-none"
        style={{
          background: T.bg,
          border: `1.5px solid ${isHov ? item.color : T.border}`,
          boxShadow: isHov
            ? `0 8px 24px ${item.color}22, 0 1px 4px rgba(0,0,0,0.05)`
            : "0 1px 3px rgba(0,0,0,0.05)",
          transform: isHov ? "translateY(-3px)" : "none",
          transition: "all 0.18s cubic-bezier(0.4,0,0.2,1)",
          padding: "16px 10px 12px",
        }}
        onMouseEnter={() => { setHoveredKey(item.key); setInfoKey(null); }}
        onMouseLeave={() => setHoveredKey(null)}
        onClick={() => handleSelect(item.key)}
      >
        {/* Top colour accent bar */}
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, height: 2.5,
          borderRadius: "10px 10px 0 0",
          background: isHov ? item.color : "transparent",
          transition: "background 0.18s",
        }} />

        {/* Icon bubble */}
        <div
          className="flex items-center justify-center mb-3"
          style={{
            width: 44, height: 44, borderRadius: 12,
            background: isHov ? `${item.color}16` : `${item.color}0e`,
            border: `1.5px solid ${item.color}${isHov ? "45" : "22"}`,
            color: item.color,
            boxShadow: isHov ? `0 4px 14px ${item.color}22` : "none",
            transform: isHov ? "scale(1.08)" : "scale(1)",
            transition: "all 0.18s cubic-bezier(0.4,0,0.2,1)",
            flexShrink: 0,
          }}
        >
          {React.cloneElement(item.icon as React.ReactElement, { size: 20, strokeWidth: 1.7 })}
        </div>

        {/* Label */}
        <p
          style={{
            fontSize: 12.5,
            fontWeight: 700,
            textAlign: "center",
            lineHeight: 1.2,
            color: isHov ? item.color : T.textMain,
            marginBottom: 2,
            transition: "color 0.15s",
          }}
        >
          {item.label}
        </p>

        {/* Badge */}
        {item.badge && (
          <span
            style={{
              fontSize: 7.5,
              fontWeight: 800,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              padding: "2px 5px",
              borderRadius: 5,
              background: `${item.color}14`,
              color: item.color,
              border: `1px solid ${item.color}28`,
              marginBottom: 4,
            }}
          >
            {item.badge}
          </span>
        )}

        {/* Star + Info row */}
        <div
          className="flex items-center gap-1 mt-2"
          onClick={e => e.stopPropagation()}
        >
          {/* ⭐ Star */}
          <button
            type="button"
            title={isFav ? "Unfavourite" : "Favourite"}
            onClick={e => toggleFav(item.key, e)}
            className="flex items-center justify-center transition-all"
            style={{
              width: 26, height: 26, borderRadius: 7,
              background: isFav ? "rgba(245,158,11,0.10)" : "transparent",
              border: `1px solid ${isFav ? "#f59e0b44" : T.border}`,
              color: isFav ? "#f59e0b" : T.textHint,
            }}
            onMouseEnter={e => {
              if (!isFav) {
                (e.currentTarget as HTMLElement).style.background = "rgba(245,158,11,0.08)";
                (e.currentTarget as HTMLElement).style.color = "#f59e0b";
                (e.currentTarget as HTMLElement).style.borderColor = "#f59e0b44";
              }
            }}
            onMouseLeave={e => {
              if (!isFav) {
                (e.currentTarget as HTMLElement).style.background = "transparent";
                (e.currentTarget as HTMLElement).style.color = T.textHint;
                (e.currentTarget as HTMLElement).style.borderColor = T.border;
              }
            }}
          >
            <Star size={11} fill={isFav ? "#f59e0b" : "none"} strokeWidth={isFav ? 0 : 1.8} />
          </button>

          {/* ℹ Info */}
          <div className="relative">
            <button
              type="button"
              title="What is this?"
              onClick={e => { e.stopPropagation(); setInfoKey(isInfo ? null : item.key); }}
              className="flex items-center justify-center transition-all"
              style={{
                width: 26, height: 26, borderRadius: 7,
                background: isInfo ? `${item.color}12` : "transparent",
                border: `1px solid ${isInfo ? item.color + "38" : T.border}`,
                color: isInfo ? item.color : T.textHint,
              }}
              onMouseEnter={e => {
                if (!isInfo) {
                  (e.currentTarget as HTMLElement).style.background = `${item.color}0d`;
                  (e.currentTarget as HTMLElement).style.color = item.color;
                  (e.currentTarget as HTMLElement).style.borderColor = `${item.color}38`;
                }
              }}
              onMouseLeave={e => {
                if (!isInfo) {
                  (e.currentTarget as HTMLElement).style.background = "transparent";
                  (e.currentTarget as HTMLElement).style.color = T.textHint;
                  (e.currentTarget as HTMLElement).style.borderColor = T.border;
                }
              }}
            >
              <Info size={11} />
            </button>

            {/* Tooltip */}
            {isInfo && (
              <div
                style={{
                  position: "absolute",
                  bottom: "calc(100% + 7px)",
                  left: "50%",
                  transform: "translateX(-50%)",
                  width: 140,
                  background: "#1a1a2e",
                  color: "#fff",
                  borderRadius: 9,
                  padding: "7px 9px",
                  fontSize: 10.5,
                  lineHeight: 1.45,
                  textAlign: "center",
                  boxShadow: "0 8px 20px rgba(0,0,0,0.26)",
                  pointerEvents: "none",
                  zIndex: 30,
                }}
              >
                {item.description}
                <div style={{
                  position: "absolute", top: "100%", left: "50%",
                  transform: "translateX(-50%)",
                  width: 0, height: 0,
                  borderLeft: "5px solid transparent",
                  borderRight: "5px solid transparent",
                  borderTop: "5px solid #1a1a2e",
                }} />
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const handlePageConfirm = async (payload: PagesPayload) => {
    setShowPageModal(false); onClose();
    const p = payload.pages?.[0];
    onCreatePage?.(p?.blocks ?? [], p?.name ?? "Untitled", hierarchyInfo);
    await onPageCreated?.();
  };

  return (
    <>
      <div
        className="fixed inset-0 z-[60] flex items-center justify-center"
        style={{ animation: "nrmFadeIn 0.18s ease-out both" }}
      >
        {/* Overlay */}
        <div className="absolute inset-0 bg-black/40 backdrop-blur-[3px]" onClick={onClose} />

        {/* Modal shell */}
        <div
          className="relative flex flex-col overflow-hidden"
          style={{
            width: 880, maxWidth: "calc(100vw - 32px)",
            height: "86vh", maxHeight: "86vh",
            background: T.bg, borderRadius: 22,
            border: `1.5px solid ${T.border}`,
            boxShadow: "0 24px 60px rgba(0,0,0,0.18)",
            animation: "nrmSlideUp 0.22s cubic-bezier(0.16,1,0.3,1) both",
            fontFamily: "'Poppins',-apple-system,sans-serif",
          }}
          onClick={e => e.stopPropagation()}
        >

          {/* ── Header ──────────────────────────────────────────────────────── */}
          <div
            className="relative overflow-hidden flex-shrink-0"
            style={{
              background: "linear-gradient(140deg,#F27757 0%,#E86440 48%,#D95830 100%)",
              padding: "11px 14px 13px",
              borderRadius: "20px 20px 0 0",
            }}
          >
            {/* Decorative rings */}
            <svg
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 0 }}
              viewBox="0 0 680 72" fill="none"
            >
              <circle cx="648" cy="-12" r="72"  stroke="rgba(255,255,255,0.16)" strokeWidth="1.2" />
              <circle cx="648" cy="-12" r="120" stroke="rgba(255,255,255,0.08)" strokeWidth="1.2" />
              <circle cx="32"  cy="90"  r="55"  stroke="rgba(255,255,255,0.10)" strokeWidth="1.2" />
            </svg>

            <div className="relative z-[1] flex items-center justify-between gap-3">
              {/* Icon + title block */}
              <div className="flex items-center gap-2.5">
                <div
                  className="flex-shrink-0 flex items-center justify-center"
                  style={{
                    width: 32, height: 32, borderRadius: 10,
                    background: "rgba(255,255,255,0.20)",
                    border: "1px solid rgba(255,255,255,0.28)",
                  }}
                >
                  <Sparkles size={15} color="#fff" strokeWidth={1.8} />
                </div>
                <div>
                  <h2
                    className="leading-tight"
                    style={{
                      fontSize: 15,
                      fontWeight: 700,
                      color: "#fff",
                      letterSpacing: "-0.01em",
                    }}
                  >
                    Add a new resource
                  </h2>
                  <p style={{ fontSize: 11, color: "rgba(255,255,255,0.68)", marginTop: 1, fontWeight: 500 }}>
                    Choose what you'd like to create or upload
                  </p>
                </div>
              </div>

              {/* Close */}
              <button
                onClick={onClose}
                className="flex-shrink-0 flex items-center justify-center transition-all"
                style={{
                  width: 28, height: 28, borderRadius: 8,
                  background: "rgba(255,255,255,0.18)",
                  border: "1px solid rgba(255,255,255,0.25)",
                  color: "rgba(255,255,255,0.85)",
                }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.30)"}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.18)"}
              >
                <X size={13} />
              </button>
            </div>
          </div>

          {/* ── Location breadcrumb ──────────────────────────────────────────
             Simple path from Course down to the current folder so the user
             knows exactly where the new resource will be created. Uses the
             crumbs supplied by the parent, otherwise builds them from the
             hierarchy + active tab / subcategory / folder context. */}
          {(() => {
            const crumbs =
              pathCrumbs && pathCrumbs.length > 0
                ? pathCrumbs
                : buildPlainPathCrumbs(hierarchyInfo, {
                    tab: activeTab,
                    subcategory: activeSubcategory,
                    folderPath: currentFolderPath,
                    onNavigate: onNavigateTo,
                  });
            return crumbs.length > 0 ? (
              <PlainBreadcrumb crumbs={crumbs} prefix="Saving to:" />
            ) : null;
          })()}

          {/* ── Search ──────────────────────────────────────────────────────── */}
          {/* <div
            className="flex-shrink-0 px-5 py-2.5"
            style={{ borderBottom: `1px solid ${T.border}`, background: T.bg }}
          >
            <div className="relative">
              <Search
                size={12}
                className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                style={{ color: T.textHint }}
              />
              <input
                ref={searchRef}
                type="text"
                placeholder="Search…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full outline-none transition-all"
                style={{
                  paddingLeft: 30, paddingRight: search ? 28 : 10,
                  paddingTop: 7, paddingBottom: 7,
                  fontSize: 12.5,
                  background: T.pageBg,
                  border: `1.5px solid ${T.border}`,
                  borderRadius: 9,
                  color: T.textMain,
                  fontFamily: "inherit",
                }}
                onFocus={e => { e.currentTarget.style.borderColor = T.orange; e.currentTarget.style.boxShadow = `0 0 0 3px ${T.orangeLight}`; }}
                onBlur={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.boxShadow = "none"; }}
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded"
                  style={{ color: T.textHint }}
                >
                  <X size={11} />
                </button>
              )}
            </div>
          </div> */}

          {/* ── Card grid ───────────────────────────────────────────────────── */}
          <div
            className="flex-1 overflow-y-auto"
            style={{
              padding: "20px 20px",
              scrollbarWidth: "thin",
              scrollbarColor: `${T.border} transparent`,
            }}
          >
            {filtered.length === 0 && filteredStudentFeatures.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <div
                  className="flex items-center justify-center mb-3"
                  style={{ width: 44, height: 44, borderRadius: 14, background: T.orangeLight }}
                >
                  <Search size={18} style={{ color: T.orange }} />
                </div>
                <p className="text-[13px] font-bold" style={{ color: T.textMain }}>
                  No matches for &ldquo;{search}&rdquo;
                </p>
                <p className="text-[11.5px] mt-1" style={{ color: T.textMuted }}>Try a different keyword</p>
              </div>
            ) : (
              <>
              {filtered.length > 0 && (
              <div
                className="grid gap-3"
                style={{ gridTemplateColumns: `repeat(${Math.min(filtered.length, 5)}, 1fr)` }}
              >
                {filtered.map(renderCard)}
              </div>
              )}

              {/* ── Student Used Feature (Notes / AI) ──────────────────────
                  Only rendered when the Super Admin enabled at least one of
                  them for this institution's Resource Management. */}
              {filteredStudentFeatures.length > 0 && (
                <>
                  <div
                    style={{
                      display: "flex", alignItems: "center", gap: 8,
                      margin: filtered.length > 0 ? "16px 0 10px" : "0 0 10px",
                    }}
                  >
                    <span style={{
                      fontSize: 10.5, fontWeight: 800, letterSpacing: "0.06em",
                      textTransform: "uppercase", color: T.textMuted,
                    }}>
                      Student Used Feature
                    </span>
                    <div style={{ flex: 1, height: 1, background: T.border }} />
                  </div>
                  <div
                    className="grid gap-3"
                    style={{ gridTemplateColumns: `repeat(${Math.min(filteredStudentFeatures.length, 5)}, 1fr)` }}
                  >
                    {filteredStudentFeatures.map(renderCard)}
                  </div>
                </>
              )}
              </>
            )}
          </div>

          {/* ── Footer ──────────────────────────────────────────────────────── */}
          <div
            className="flex-shrink-0 flex items-center justify-between px-5 py-2.5"
            style={{ borderTop: `1px solid ${T.border}`, background: T.pageBg }}
          >
            <div className="flex items-center gap-1.5">
              <kbd
                className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold"
                style={{ background: T.bg, border: `1px solid ${T.border}`, color: T.textMuted }}
              >
                ESC
              </kbd>
              <span className="text-[10.5px]" style={{ color: T.textMuted }}>to close</span>
            </div>
            <span className="text-[10.5px]" style={{ color: T.textHint }}>
              {filtered.length} resource type{filtered.length !== 1 ? "s" : ""}
            </span>
          </div>
        </div>

        <style jsx global>{`
          @keyframes nrmFadeIn  { from { opacity: 0 } to { opacity: 1 } }
          @keyframes nrmSlideUp { from { opacity: 0; transform: scale(.97) translateY(10px) } to { opacity: 1; transform: scale(1) translateY(0) } }
        `}</style>
      </div>

      {showPageModal && (
        <PageCreationModal
          onBack={() => setShowPageModal(false)}
          onConfirm={handlePageConfirm}
          hierarchyInfo={hierarchyInfo}
          pathCrumbs={pathCrumbs}
        />
      )}
    </>
  );
};

export default NotionResourceModal;
