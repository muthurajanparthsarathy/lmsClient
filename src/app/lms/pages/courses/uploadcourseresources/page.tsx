"use client";
import { getToken, clearAllStorage } from "@/lib/session";
import { API_BASE_URL } from "@/lib/http";

import React, { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { Poppins } from "next/font/google";

// Poppins is scoped to this page tree. Every child (sidebar, modals, portaled
// dialogs, the youdo subtree, etc.) inherits it via the injected global style
// below, without us touching the dozens of inline `fontFamily` styles spread
// across the subtree.
const poppins = Poppins({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-poppins-upload",
  display: "swap",
});
import {
  Brain, Users, HelpCircle, FileText, Video, FileArchive,
  Link2, BookOpen, FolderPlus, Download, Eye, RefreshCw,
  Settings, X, Loader2, Folder, Globe, Lock, EyeOff,
  Upload, File as FileIcon, Plus, BookPlus, AlertCircle,
  Presentation, Trash2, Home, Library, FolderOpen,
  File as FileLucide, Sun, Moon, Monitor, ChevronRight,
  GraduationCap, LayoutDashboard, BookMarked, Layers,
  User, LogOut, UserCheck2, Zap,
  ChevronDown,
  FilePlus2,
  Target,
  Image as ImageIcon, StickyNote, Bot
} from "lucide-react";

import {
  Sparkles,
} from "lucide-react";
import { motion } from "framer-motion";
import dynamic from "next/dynamic";
import { getCurrentUser } from "@/apiServices/tokenVerify"
import { postLogout } from "@/apiServices/activityLog"
// import "react-quill/dist/quill.snow.css";
import { useQuery, useQueryClient } from "@tanstack/react-query";
// Resources by Batch — the batch the page is working in. `setActiveBatchId`
// feeds the API layer, which stamps it onto every read and write.
import { getActiveBatchId, reconcileBatch, setActiveBatchId, withBatchUrl } from "@/apiServices/resourceBatch";
import { BatchScopeBar } from "./components/ResourceBatchStrip";
import {
  courseDataApi, entityApi,
  type CourseStructureData, type Module, type SubModule,
  type Topic, type SubTopic, updateFileSettingsInComponent,
} from "@/apiServices/coursesData";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import axios from "axios";
import { showErrorToast, showSuccessToast } from "@/components/ui/toastUtils";
import SmartCliffRingLoader from "@/components/SmartCliffRingLoader";
import { studentRouteForCurrentCourse } from "../../../component/useAccountMenu";
import PDFViewer from "../../../component/pdfView";
import VideoViewer from "../../../component/videosViewer";
import ZipViewer from "../../../component/zipViewer";
import PPTViewer from "../../../component/pptView";
import { updateURL } from "@/apiServices/urlParams";
import { StaffLayout } from "@/app/lms/component/stafflayout/staff-layout";

import { CourseSidebar } from "./components/Coursesidebar";
import { CourseContent } from "./components/Coursecontent";
import { NotionResourceModal } from "./components/Notionresourcemodal";
import { FileUploadModal, type UploadOptions } from "./components/FileUploadModal";
import {
  buildAllowedRules, partitionFiles, fmtLimit, TYPE_FILE_RULES, UPLOADABLE_TYPE_KEYS,
} from "./components/resourceFileFormats";
import { PlainBreadcrumb, type PlainCrumb } from "./components/PlainBreadcrumb";
import { NotificationBell } from "@/app/lms/component/NotificationBell";

import {
  CourseNode, FolderItem, UploadedFile, ContentData, SubcategoryData,
  Tag, FileTypeConfig, VideoItem, BreadcrumbItem, FolderNavState, isFolderItem, isUploadedFile
} from "../uploadcourseresources/components/Types";
import toast from "react-hot-toast";
import TipTapEditor from "@/app/lms/component/tiptopEditor";
import ImageViewer from "../../../component/ImageViewer";
import WordViewer from "../../../component/wordView";
import TxtViewer from "../../../component/textdoc";
import TxtViewerTeacher from "../../../component/textdoc";

const Editor = dynamic(() => import("primereact/editor").then((m) => m.Editor), { ssr: false });

// ─── Design tokens ────────────────────────────────────────────────────────────
const T = {
  orange: '#E8640C',
  orangeDark: '#C95308',
  orangeGlow: 'rgba(232,100,12,0.18)',
  orangeLight: 'rgba(232,100,12,0.08)',
  orangeMid: 'rgba(232,100,12,0.14)',
  blue: '#FB923C',
  blueLight: 'rgba(251,146,60,0.08)',
  textMain: '#0F172A',
  textSub: '#334155',
  textMuted: '#475569',
  textHint: '#94A3B8',
  textDark: '#000000',
  border: '#eef0f4',
  borderSoft: '#f1f5f9',
  bg: '#ffffff',
  pageBg: '#f8fafc',       // clean light canvas
  cardShadow: '0 1px 2px rgba(15,23,42,0.04), 0 1px 3px rgba(15,23,42,0.03)',
};
// ─── Transform Helpers ─────────────────────────────────────────────────────────
function transformToCourseNodes(courseData: CourseStructureData): CourseNode[] {
  return [{
    id: courseData._id, name: courseData.courseName, type: "course", level: 0,
    originalData: courseData,
    children: courseData.modules.map((module: Module) => ({
      id: module._id, name: module.title, type: "module" as const, level: 1,
      originalData: module,
      children: [
        ...module.topics.map((topic: Topic) => ({
          id: topic._id, name: topic.title, type: "topic" as const, level: 2,
          originalData: topic,
          children: topic.subTopics.map((st: SubTopic) => ({
            id: st._id, name: st.title, type: "subtopic" as const, level: 3, originalData: st,
          })),
        })),
        ...module.subModules.map((sm: SubModule) => ({
          id: sm._id, name: sm.title, type: "submodule" as const, level: 2,
          originalData: sm,
          children: sm.topics.map((topic: Topic) => ({
            id: topic._id, name: topic.title, type: "topic" as const, level: 3,
            originalData: topic,
            children: topic.subTopics.map((st: SubTopic) => ({
              id: st._id, name: st.title, type: "subtopic" as const, level: 4, originalData: st,
            })),
          })),
        })),
      ],
    })),
  }];
}

const toBackendTab = (tab: "I_Do" | "We_Do" | "You_Do" | null): "I_Do" | "We_Do" | "You_Do" => {
  if (tab === "We_Do") return "We_Do";
  if (tab === "You_Do") return "You_Do";
  return "I_Do";
};

// Dark mode is owned by the shared StaffTopBar (localStorage "theme" +
// html.dark) since this page moved into StaffLayout — the page must not write
// the html class itself or it clobbers the navbar's toggle. The `.dark .ql-*`
// styles below keep working off the shared class.

// ─── Orange Toggle ────────────────────────────────────────────────────────────
const OrangeToggle = ({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) => (
  <label className="relative inline-flex items-center cursor-pointer">
    <input type="checkbox" className="sr-only peer" checked={checked} onChange={e => onChange(e.target.checked)} />
    <div
      className="w-10 h-5 rounded-full transition-colors relative"
      style={{ background: checked ? T.orange : T.border }}
    >
      <div
        className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform"
        style={{ left: checked ? '22px' : '2px' }}
      />
    </div>
  </label>
);

// ─── Breadcrumb Icon map ───────────────────────────────────────────────────────
const CRUMB_ICON: Record<string, React.ReactNode> = {
  dashboard: <LayoutDashboard size={13} />,
  courses: <BookMarked size={13} />,
  course: <GraduationCap size={13} />,
  module: <Layers size={13} />,
  submodule: <Layers size={13} />,
  topic: <BookOpen size={13} />,
  subtopic: <FileText size={13} />,
};


function UserMenuButton({
  user, userLoading, showUserMenu, setShowUserMenu, userRef,
  isDummyStudent, originalRoleInfo, isLoggingOut,
  getUserInitials, isActualStudent,
  handleProfileClick, handleSwitchToStudent, handleSwitchBackToOriginal, handleLogout,
}: any) {
  const initials = getUserInitials()
  const isDark = false // or wire up your theme state if needed

  return (
    <div ref={userRef} className="relative">
      {/* Pill trigger button */}
      <button
        onClick={() => setShowUserMenu(!showUserMenu)}
        className="flex items-center gap-2.5 transition-all"
        style={{
          background: showUserMenu ? "#FFF4F1" : "#ffffff",
          borderRadius: "999px",
          border: `1.5px solid ${showUserMenu ? T.orange + "55" : "#e8e4eb"}`,
          padding: "5px 12px 5px 6px",
          boxShadow: showUserMenu
            ? `0 2px 12px rgba(232,100,12,0.22)`
            : "0 2px 8px rgba(0,0,0,0.07), 0 1px 3px rgba(0,0,0,0.04)",
        }}
        onMouseEnter={e => {
          if (!showUserMenu) {
            (e.currentTarget as HTMLElement).style.background = "#f6f4f7"
              ; (e.currentTarget as HTMLElement).style.boxShadow = "0 3px 12px rgba(0,0,0,0.10)"
          }
        }}
        onMouseLeave={e => {
          if (!showUserMenu) {
            (e.currentTarget as HTMLElement).style.background = "#ffffff"
              ; (e.currentTarget as HTMLElement).style.boxShadow = "0 2px 8px rgba(0,0,0,0.07), 0 1px 3px rgba(0,0,0,0.04)"
          }
        }}
      >
        {userLoading ? (
          <div className="h-8 w-8 rounded-full animate-pulse" style={{ background: T.border }} />
        ) : (
          <div
            className="h-8 w-8 rounded-full flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0"
            style={{
              background: `linear-gradient(135deg, ${T.orange}, ${T.orangeDark})`,
              boxShadow: `0 2px 8px rgba(232,100,12,0.22)`,
            }}
          >
            {initials}
          </div>
        )}
        <div className="hidden sm:block text-left">
          <p className="text-[12.5px] font-semibold leading-tight" style={{ color: T.textMain }}>
            {user?.firstName || "User"}
          </p>
          <p className="text-[10px] leading-tight mt-0.5" style={{ color: T.textMuted }}>
            {isDummyStudent ? "Student View" : user?.role?.renameRole || "Account"}
          </p>
        </div>
        <ChevronDown
          className="hidden sm:block ml-0.5"
          size={14}
          style={{
            color: "#bcbccc",
            transform: showUserMenu ? "rotate(180deg)" : "none",
            transition: "transform 0.2s",
          }}
        />
      </button>

      {/* Dropdown */}
      {showUserMenu && (
        <div
          className="absolute top-full right-0 mt-2 w-64 z-[9999] overflow-hidden"
          style={{
            background: T.bg,
            borderRadius: "18px",
            border: `1px solid ${T.border}`,
            boxShadow: "0 16px 40px rgba(0,0,0,0.10), 0 4px 12px rgba(0,0,0,0.06)",
            animation: "scDrop .18s cubic-bezier(.16,1,.3,1) both",
            transformOrigin: "top right",
          }}
        >
          {/* Header */}
          <div
            className="px-4 py-3"
            style={{ background: "#f6f4f7", borderBottom: `1px solid ${T.border}` }}
          >
            <div className="flex items-center gap-3">
              <div
                className="h-10 w-10 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                style={{
                  background: `linear-gradient(135deg, ${T.orange}, ${T.orangeDark})`,
                  boxShadow: `0 4px 14px rgba(232,100,12,0.22)`,
                }}
              >
                {initials}
              </div>
              <div className="min-w-0">
                <p className="text-[13px] font-bold truncate" style={{ color: T.textMain }}>
                  {user?.firstName} {user?.lastName}
                </p>
                <p className="text-[11px] truncate" style={{ color: T.textMuted }}>{user?.email}</p>
                <span
                  className="inline-flex items-center text-[10px] font-semibold px-1.5 py-0.5 rounded-md mt-0.5"
                  style={{ background: T.orangeLight, color: T.orange }}
                >
                  {isDummyStudent ? "⚡ Student View" : user?.role?.renameRole || "Account"}
                </span>
              </div>
            </div>
          </div>

          {/* Menu items */}
          <div className="p-1.5">
            {!isActualStudent() && !isDummyStudent && (
              <UMRow
                icon={UserCheck2}
                label="Switch to Student"
                sub="Preview student experience"
                color="#fb923c"
                hoverBg="#fff7ed"
                onClick={handleSwitchToStudent}
              />
            )}
            {isDummyStudent && originalRoleInfo && (
              <UMRow
                icon={Zap}
                label={`Back to ${originalRoleInfo.renameRole}`}
                sub="Return to original role"
                color="#f59e0b"
                hoverBg="#fffbeb"
                onClick={handleSwitchBackToOriginal}
              />
            )}
            <div className="h-px my-1 mx-1" style={{ background: T.border }} />
            <UMRow icon={User} label="My Profile" sub="" color={T.textMuted} hoverBg="#f6f4f7" onClick={handleProfileClick} />
            <UMRow icon={Settings} label="Settings" sub="" color={T.textMuted} hoverBg="#f6f4f7" onClick={() => setShowUserMenu(false)} />
            <UMRow icon={HelpCircle} label="Help & Support" sub="" color={T.textMuted} hoverBg="#f6f4f7" onClick={() => setShowUserMenu(false)} />
          </div>

          {/* Sign out */}
          <div className="p-1.5" style={{ borderTop: `1px solid ${T.border}` }}>
            <button
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl transition-colors"
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#fff5f5" }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent" }}
            >
              <LogOut size={14} style={{ color: "#e53e3e" }} />
              <span className="text-[12px] font-semibold" style={{ color: "#e53e3e" }}>
                {isLoggingOut ? "Signing out…" : "Sign Out"}
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// Reusable menu row
function UMRow({ icon: Icon, label, sub, color, hoverBg, onClick }: {
  icon: React.ElementType; label: string; sub: string
  color: string; hoverBg: string; onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left transition-colors"
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = hoverBg }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent" }}
    >
      <Icon size={14} className="flex-shrink-0" style={{ color }} />
      <div className="min-w-0">
        <p className="text-[12px] font-medium" style={{ color: T.textMain }}>{label}</p>
        {sub && <p className="text-[10px]" style={{ color: T.textMuted }}>{sub}</p>}
      </div>
    </button>
  )
}
// ─── Clean Breadcrumb Bar with Proper Clickable States ──────────────────────
const BRAND_ORANGE = "#E8640C";

/**
 * Where "back" goes.
 *
 * This screen serves TWO routes with the same component — `/lms/pages/courses/
 * uploadcourseresources` (reached from the Courses list) and `/lms/pages/
 * coursestructure/uploadcourseresources` (reached from a course's Actions ▸
 * Upload Resources). Hard-coding the Courses list would strand anyone who came
 * in through Course Management on a page they never navigated from, so the crumb
 * follows the route actually in the address bar.
 */
const useParentSection = () => {
  const pathname = usePathname() || "";
  const fromCourseStructure = pathname.startsWith("/lms/pages/coursestructure");
  return fromCourseStructure
    ? {
        href: "/lms/pages/coursestructure",
        label: "Course Management",
        // Changing which batch you are filing into is a Course Management job.
        // The Courses route is for working inside a course, so it only NAMES
        // the batch — see ResourceBatchStrip's `canSwitchBatch`.
        canSwitchBatch: true,
      }
    : { href: "/lms/pages/courses", label: "Courses", canSwitchBatch: false };
};

const BreadcrumbBar = ({
  breadcrumbs,
}: {
  breadcrumbs: Array<{ id: string; type: string; label: string; onClick?: () => void }>;
}) => {
  const router = useRouter();
  const parent = useParentSection();

  if (!breadcrumbs || breadcrumbs.length === 0) return null;

  const allowedTypes = ["dashboard", "courses", "course"];
  const filteredCrumbs = breadcrumbs.filter(crumb => allowedTypes.includes(crumb.type));

  if (filteredCrumbs.length === 0) return null;

  const handleCrumbClick = (crumb: any) => {
    if (crumb.type === "dashboard") { router.push("/lms/pages/dashboard"); return; }
    if (crumb.type === "courses") { router.push(parent.href); return; }
    if (crumb.type === "course" && crumb.onClick) crumb.onClick();
  };

  const LINK_BLUE = "#F97316";
  const LINK_BLUE_HOVER = "#EA580C";
  const ACTIVE_GRAY = "#475569";
  const MUTED = "#94A3B8";

  return (
    <div
      className="sticky top-0 z-40 w-full flex items-center"
      style={{
        minHeight: 48,
        padding: "8px 16px",
        background: "#ffffff",
        borderBottom: "none",
      }}
    >
      <nav className="flex items-center" style={{ gap: 2 }}>
        {filteredCrumbs.map((crumb, index) => {
          const isLast = index === filteredCrumbs.length - 1;
          const isCourse = crumb.type === "course";
          const isClickable = !isLast;
          const labelColor = isLast ? ACTIVE_GRAY : LINK_BLUE;
          const iconColor = isLast ? ACTIVE_GRAY : LINK_BLUE;

          return (
            <div key={crumb.id} className="flex items-center">
              <motion.button
                whileTap={!isLast ? { scale: 0.98 } : {}}
                onClick={() => !isLast && handleCrumbClick(crumb)}
                disabled={isLast}
                className="group flex items-center"
                style={{
                  gap: 6,
                  padding: "3px 6px",
                  borderRadius: 6,
                  background: "transparent",
                  cursor: isClickable ? "pointer" : "default",
                  transition: "color 0.15s ease",
                }}
                onMouseEnter={(e) => {
                  if (!isClickable) return;
                  const el = e.currentTarget as HTMLElement;
                  const labelEl = el.querySelector<HTMLElement>("[data-crumb-label]");
                  const iconEl = el.querySelector<HTMLElement>("[data-crumb-icon]");
                  if (labelEl) labelEl.style.color = LINK_BLUE_HOVER;
                  if (labelEl) labelEl.style.textDecoration = "underline";
                  if (iconEl) iconEl.style.color = LINK_BLUE_HOVER;
                }}
                onMouseLeave={(e) => {
                  if (!isClickable) return;
                  const el = e.currentTarget as HTMLElement;
                  const labelEl = el.querySelector<HTMLElement>("[data-crumb-label]");
                  const iconEl = el.querySelector<HTMLElement>("[data-crumb-icon]");
                  if (labelEl) labelEl.style.color = LINK_BLUE;
                  if (labelEl) labelEl.style.textDecoration = "none";
                  if (iconEl) iconEl.style.color = LINK_BLUE;
                }}
              >
                <span
                  data-crumb-icon
                  className="flex items-center justify-center"
                  style={{ color: iconColor, transition: "color 0.15s ease" }}
                >
                  {crumb.type === "dashboard" && <LayoutDashboard size={13} strokeWidth={2} />}
                  {crumb.type === "courses" && <BookMarked size={13} strokeWidth={2} />}
                  {crumb.type === "course" && <GraduationCap size={13} strokeWidth={2} />}
                </span>

                <span
                  data-crumb-label
                  style={{
                    fontFamily: "'Poppins', 'Plus Jakarta Sans', sans-serif",
                    fontWeight: isLast ? 600 : 500,
                    fontSize: 12.5,
                    color: labelColor,
                    letterSpacing: "-0.005em",
                    lineHeight: 1.2,
                    transition: "color 0.15s ease",
                  }}
                >
                  {crumb.label}
                </span>

                {isCourse && isLast && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex items-center"
                    style={{
                      gap: 3,
                      marginLeft: 4,
                      padding: "1px 6px",
                      borderRadius: 999,
                      background: "#E8640C",
                    }}
                  >
                    <Sparkles size={9} className="text-white" />
                    <span style={{ fontSize: 9, fontWeight: 700, color: "#fff", textTransform: "uppercase", letterSpacing: "0.02em" }}>Live</span>
                  </motion.div>
                )}
              </motion.button>

              {!isLast && (
                <ChevronRight size={12} strokeWidth={2} style={{ color: MUTED, margin: "0 2px" }} />
              )}
            </div>
          );
        })}
      </nav>
    </div>
  );
};

// ─── Accordion Header ─────────────────────────────────────────────────────────
const AccordionHeader = ({ icon, iconColor, iconBg, title, subtitle, sectionKey, currentKey, onToggle }: any) => (
  <button
    className="flex items-center justify-between w-full p-3 text-left transition-colors cursor-pointer"
    style={{ background: currentKey === sectionKey ? T.pageBg : T.bg, borderBottom: `1px solid ${T.border}` }}
    onClick={() => onToggle(currentKey === sectionKey ? null : sectionKey)}
    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = T.pageBg}
    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = currentKey === sectionKey ? T.pageBg : T.bg}
  >
    <div className="flex items-center gap-3">
      <div className="p-2 rounded-xl" style={{ background: iconBg }}>{React.cloneElement(icon, { size: 15, style: { color: iconColor } })}</div>
      <div><h4 className="text-[12.5px] font-bold" style={{ color: T.textMain }}>{title}</h4>{subtitle && <p className="text-[11px] mt-0.5" style={{ color: T.textMuted }}>{subtitle}</p>}</div>
    </div>
    <svg className="w-4 h-4 transition-transform" style={{ color: T.textHint, transform: currentKey === sectionKey ? 'rotate(180deg)' : 'none' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
  </button>
);

const FolderBreadcrumbBar = ({
  currentFolderPath,
  currentFolderId,
  onNavigateUp,
  onNavigateToRoot,
  onNavigateToFolder
}: {
  currentFolderPath: string[];
  currentFolderId: string | null;
  onNavigateUp: () => void;
  onNavigateToRoot: () => void;
  onNavigateToFolder: (folderName: string, index: number) => void;
}) => {
  if (!currentFolderId && currentFolderPath.length === 0) return null;

  return (
    <div
      className="flex-shrink-0 flex items-center gap-2 px-4 py-2.5 mb-3"
      style={{
        background: T.warm,
        borderBottom: `1px solid ${T.border}`,
        borderLeft: `3px solid ${T.orange}`,
        borderRadius: '8px',
      }}
    >
      {/* Back button */}
      <button
        onClick={onNavigateUp}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all"
        style={{
          background: T.bg,
          color: T.textSub,
          border: `1px solid ${T.border}`,
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.borderColor = T.orange;
          (e.currentTarget as HTMLElement).style.color = T.orange;
          (e.currentTarget as HTMLElement).style.background = T.orangeLight;
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.borderColor = T.border;
          (e.currentTarget as HTMLElement).style.color = T.textSub;
          (e.currentTarget as HTMLElement).style.background = T.bg;
        }}
      >
        <ArrowLeft size={12} strokeWidth={2.5} />
        Back
      </button>

      {/* Separator */}
      <div className="w-px h-5" style={{ background: T.border }} />

      {/* Folder icon */}
      <Folder size={14} style={{ color: T.orange }} />

      {/* Breadcrumb path */}
      <div className="flex items-center gap-1 overflow-x-auto flex-1" style={{ scrollbarWidth: "none" }}>
        {/* Root button */}
        <button
          onClick={onNavigateToRoot}
          className="flex-shrink-0 text-[10.5px] font-semibold px-1.5 py-0.5 rounded transition-all cursor-pointer"
          style={{
            color: currentFolderPath.length === 0 ? T.orange : T.textHint,
            background: currentFolderPath.length === 0 ? T.orangeLight : 'transparent',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.color = T.orange;
            (e.currentTarget as HTMLElement).style.background = T.orangeLight;
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.color = currentFolderPath.length === 0 ? T.orange : T.textHint;
            (e.currentTarget as HTMLElement).style.background = currentFolderPath.length === 0 ? T.orangeLight : 'transparent';
          }}
        >
          Root
        </button>

        {/* Breadcrumb segments */}
        {currentFolderPath.map((segment, idx) => {
          const isLast = idx === currentFolderPath.length - 1;
          return (
            <div key={idx} className="flex items-center gap-1 flex-shrink-0">
              <ChevronRight size={9} style={{ color: T.textHint }} />
              <button
                onClick={() => !isLast && onNavigateToFolder(segment, idx)}
                className="text-[10.5px] font-semibold px-1.5 py-0.5 rounded max-w-[120px] truncate transition-all"
                style={{
                  color: isLast ? T.orange : T.textSub,
                  background: isLast ? T.orangeLight : "transparent",
                  border: isLast ? `1px solid ${T.orange}20` : "1px solid transparent",
                  cursor: isLast ? 'default' : 'pointer',
                }}
                onMouseEnter={(e) => {
                  if (!isLast) {
                    (e.currentTarget as HTMLElement).style.color = T.orange;
                    (e.currentTarget as HTMLElement).style.background = T.orangeLight;
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isLast) {
                    (e.currentTarget as HTMLElement).style.color = T.textSub;
                    (e.currentTarget as HTMLElement).style.background = "transparent";
                  }
                }}
              >
                {segment}
              </button>
            </div>
          );
        })}
      </div>

      {/* Item count badge */}
      <div className="flex-shrink-0 ml-auto">
        <span
          className="text-[10px] font-bold px-2 py-1 rounded-full"
          style={{
            background: T.orangeLight,
            color: T.orange,
          }}
        >
          {currentFolderPath.length > 0 ? 'Folder' : 'Root'}
        </span>
      </div>
    </div>
  );
};

// ─── Folder Builder types ─────────────────────────────────────────────────────
interface VirtualFolderFile {
  id: string;
  file: File;
  displayName: string;
  isEditingName: boolean;
  editNameValue: string;
}
interface VirtualFolderItem {
  id: string;
  name: string;
  isEditingName: boolean;
  editNameValue: string;
  files: VirtualFolderFile[];
  children: VirtualFolderItem[]; // sub-folders
  isDragOver: boolean;
  isExpanded: boolean;
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function DynamicLMSCoordinator() {
  const searchParams = useSearchParams();
  const courseId = searchParams.get("courseId");

  // ── Resources by Batch ──────────────────────────────────────────────────────
  // Fetched BEFORE the course payload so the page knows on its first paint
  // whether this course has batches at all, whether resources are shared, and
  // (for staff) which batch is selected. The selected batch is stamped onto
  // every subsequent request by the API layer and is part of the course query
  // key, so switching batches refetches instead of serving the previous
  // batch's cached pedagogy.
  const { data: batchCtxResponse } = useQuery({
    ...courseDataApi.getResourceBatchContext(courseId || ""),
    enabled: !!courseId,
  });
  const resourceBatchCtx = batchCtxResponse?.data ?? null;
  const [activeBatchId, setActiveBatchIdState] = useState<string>("");

  // Reconcile the remembered selection against what the server says exists —
  // a batch that was deleted, or a course flipped back to shared, must not
  // leave the page pinned to a dead id showing an empty screen.
  useEffect(() => {
    if (!courseId) return;
    setActiveBatchIdState(reconcileBatch(courseId, resourceBatchCtx));
  }, [courseId, resourceBatchCtx]);

  const queryClient = useQueryClient();
  const handleSelectBatch = useCallback(
    (batchId: string) => {
      if (!courseId || batchId === activeBatchId) return;
      setActiveBatchId(courseId, batchId);
      setActiveBatchIdState(batchId);
      // The batch is baked into the query keys, so anything cached for the
      // previous batch lives under a different key and cannot be served by
      // mistake. What is NOT keyed is the node pedagogy this page holds in
      // local state, and any exercise list already in flight — hence the
      // explicit clear + invalidate.
      //
      // `youDoExercises` covers BOTH We Do assignments and You Do assessments:
      // one hook serves both tabs, differing only by its `tabType` argument.
      // Leaving it out was what let the We Do table keep showing batch 1's
      // assignments after the strip had been switched to batch 2.
      // BOTH caches. `cachedContentData` is keyed by node id alone, so leaving
      // it behind meant re-selecting a node after a batch switch replayed the
      // previous batch's material out of cache without ever hitting the server.
      setContentData({});
      setCachedContentData({});
      queryClient.invalidateQueries({ queryKey: ["course"] });
      queryClient.invalidateQueries({ queryKey: ["course-node-pedagogy"] });
      queryClient.invalidateQueries({ queryKey: ["youDoExercises"] });
    },
    [courseId, activeBatchId, queryClient],
  );

  // `getLight`, not `getById`. coursesData.ts documents getLight as built for
  // exactly this page ("would otherwise download ~95% wasted data on every
  // cold load") but the call site was never switched over. Everything this
  // response actually feeds — the I_Do/We_Do/You_Do subcategory lists,
  // resourcesType and courseName — is present and byte-identical in the light
  // projection, verified against the heavy one on three courses
  // (896,864 -> 7,507 / 116,324 -> 6,659 / 513,920 -> 11,953 bytes).
  // Its `modules` tree is only read by findModuleForNode below, which is
  // defined and never called; the light tree carries the same node ids anyway.
  // The heavy ["course", id] entry is deliberately left alone — reviewSubmission
  // and other pages still rely on it.
  const { data: courseStructureResponse } = useQuery(courseDataApi.getLight(courseId || ""));

  // ── Scope Poppins to this page's entire DOM subtree (including portaled
  //    modals/dropdowns rendered under document.body). The injected rule uses
  //    !important so it wins over the many inline `fontFamily: T.font` styles
  //    in the child components without us editing each one. Monospace elements
  //    (code, pre, Monaco) are intentionally excluded.
  useEffect(() => {
    if (typeof document === "undefined") return
    document.body.classList.add(poppins.variable, poppins.className, "lms-poppins-scope")
    const style = document.createElement("style")
    style.setAttribute("data-lms-poppins", "1")
    style.textContent = `
      body.lms-poppins-scope, body.lms-poppins-scope * {
        font-family: ${poppins.style.fontFamily}, 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif !important;
      }
      body.lms-poppins-scope pre,
      body.lms-poppins-scope code,
      body.lms-poppins-scope kbd,
      body.lms-poppins-scope samp,
      body.lms-poppins-scope .monaco-editor,
      body.lms-poppins-scope .monaco-editor *,
      body.lms-poppins-scope [data-monaco-editor],
      body.lms-poppins-scope [data-monaco-editor] * {
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace !important;
      }
    `
    document.head.appendChild(style)
    return () => {
      document.body.classList.remove(poppins.variable, poppins.className, "lms-poppins-scope")
      style.remove()
    }
  }, [])

  // You_Do "Assessments" labels drift across courses ("Assessments",
  // "Assessment", legacy "Assesment"). The whole pipeline — Coursecontent's
  // You_Do dispatch, review submissions, marks computation, the server's
  // legacy-key lists — already speaks the legacy "assesment" key, so every
  // derived variant is canonicalized onto it before it enters state/URL/LS.
  const canonYouDoSubKey = (key: string) => (/^assess?ments?$/.test(key) ? "assesment" : key);

  const getLS = (key: string) => (typeof window !== "undefined" ? localStorage.getItem(key) || "" : "");
  const setLS = (key: string, val: string) => localStorage.setItem(key, val);
  const delLS = (key: string) => localStorage.removeItem(key);
  // ── Core state ────────────────────────────────────────────────────────────────
  const [courseData, setCourseData] = useState<CourseNode[]>([]);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [selectedNode, setSelectedNode] = useState<CourseNode | null>(null);
  const [activeTab, setActiveTab] = useState<"I_Do" | "We_Do" | "You_Do" | null>(() => getLS("lms_selected_tab") as any || null);
  const [activeSubcategory, setActiveSubcategory] = useState(() =>
    getLS("lms_selected_tab") === "You_Do"
      ? canonYouDoSubKey(getLS("lms_selected_subcategory"))
      : getLS("lms_selected_subcategory"));
  const [contentData, setContentData] = useState<Record<string, ContentData>>({});
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([]);
  const [folderNavState, setFolderNavState] = useState<Record<string, FolderNavState>>({});
  const [sidebarWidth, setSidebarWidth] = useState(280);
  const [isResizing, setIsResizing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isRestoringFromAnalytics, setIsRestoringFromAnalytics] = useState(false);
  const [currentPPTFileId, setCurrentPPTFileId] = useState("");
  const [currentVideoFileId, setCurrentVideoFileId] = useState("");
  const [currentPDFFileId, setCurrentPDFFileId] = useState("");

  const [showNotionModal, setShowNotionModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedFileType, setSelectedFileType] = useState("");
  const [uploadingFiles, setUploadingFiles] = useState<UploadedFile[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [fileDisplayNames, setFileDisplayNames] = useState<Record<string, string>>({});
  const [fileNames, setFileNames] = useState<Record<string, string>>({});
  const [uploadDescription, setUploadDescription] = useState("");
  const [uploadTags, setUploadTags] = useState<Tag[]>([]);
  const [uploadCurrentTag, setUploadCurrentTag] = useState("");
  const [uploadTagColor, setUploadTagColor] = useState("#FB923C");
  const [uploadAccessLevel, setUploadAccessLevel] = useState("private");
  const [isButtonLoading, setIsButtonLoading] = useState(false);
  const [expandedUploadSection, setExpandedUploadSection] = useState<string | null>("description");
  const [text, setText] = useState("");
  const [folderUrl, setFolderUrl] = useState("");
  const [urlFileName, setUrlFileName] = useState("");
  const [urlFileType, setUrlFileType] = useState("url/link");
  const [documentSettings, setDocumentSettings] = useState<Record<string, { studentShow: boolean; downloadAllow: boolean }>>({});
  const [folderTags, setFolderTags] = useState<Tag[]>([]);
  const [tagColor, setTagColor] = useState("");
  const [currentTag, setCurrentTag] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [updateFileId, setUpdateFileId] = useState<string | null>(null);
  const [updateFileType, setUpdateFileType] = useState("");
  const [updateTabType, setUpdateTabType] = useState<"I_Do" | "We_Do" | "You_Do">("I_Do");
  const [updateSubcategory, setUpdateSubcategory] = useState("");
  const [showFileUploadModal, setShowFileUploadModal] = useState(false);
  const [uploadGroupId, setUploadGroupId] = useState<string | undefined>(undefined);
  // The display name of the group being targeted by "Add files to this group".
  // Used by the modal to render the group as the current parent in the breadcrumb
  // AND to stamp the same groupName on every newly-uploaded file so the client's
  // grouping logic (Coursecontent.tsx → fileGroupMap) shows the file inside the
  // correct group accordion after refresh.
  const [uploadGroupName, setUploadGroupName] = useState<string | undefined>(undefined);

  // ── Edit / Update mode state for FileUploadModal ───────────────────────────
  const [uploadModalEditMode, setUploadModalEditMode] = useState(false);
  const [uploadModalInitialName, setUploadModalInitialName] = useState<string | undefined>(undefined);
  const [uploadModalInitialDesc, setUploadModalInitialDesc] = useState<string | undefined>(undefined);
  const [uploadModalInitialShow, setUploadModalInitialShow] = useState<boolean | undefined>(undefined);
  const [uploadModalInitialDl, setUploadModalInitialDl] = useState<boolean | undefined>(undefined);
  // ── Edit-mode seed data for FileUploadModal ─────────────────────────────────
  // Pre-existing files / folders that already live on the server for the resource
  // being edited. The modal renders these as rows with the "saved" pill so the
  // user can see what's currently attached and delete individual items.
  const [uploadModalInitialFiles, setUploadModalInitialFiles] = useState<Array<{ name: string; size?: string | number; path?: string[] }> | undefined>(undefined);
  const [uploadModalInitialFolders, setUploadModalInitialFolders] = useState<Array<{ name: string; path: string[] }> | undefined>(undefined);
  // When editing a folder, this overrides the modal's `currentFolderPath` so
  // newly-added files land INSIDE the folder being edited, not at activity root.
  const [uploadModalForcedPath, setUploadModalForcedPath] = useState<string[] | undefined>(undefined);
  // Pending deletions accumulated when the user clicks the X on existing rows.
  // Processed in `handleFileUploadModalSubmit` on Save Changes; discarded on
  // Cancel / close. Kept in a ref to dodge stale-closure issues inside async submit.
  const editPendingDeletionsRef = useRef<Array<{ name: string; path: string[]; fileId?: string }>>([]);
  // Parallel queue for FOLDER deletions. The server's deleteFolder cascades so
  // we only queue the folder itself — its nested files don't need to be queued
  // individually (the modal still removes them from local state for UX).
  const editPendingFolderDeletionsRef = useRef<Array<{ name: string; path: string[] }>>([]);
  // Map of "<name>::<path>" → fileId for existing files, used to resolve which
  // server-side file corresponds to a row the user just removed in the modal.
  const editExistingFileIdMapRef = useRef<Record<string, string>>({});
  // Map of virtual-folder pathKey → array of fileIds to cascade-delete when
  // that virtual folder is removed in the edit modal. Sub-groups appear as
  // virtual folders in the edit modal but don't exist as real folders on the
  // server, so their deletion must be expressed as individual file deletions.
  const editSubGroupCascadeRef = useRef<Map<string, string[]>>(new Map());

  const clearUploadModalEditState = () => {
    setUploadModalEditMode(false);
    setUploadModalInitialName(undefined);
    setUploadModalInitialDesc(undefined);
    setUploadModalInitialShow(undefined);
    setUploadModalInitialDl(undefined);
    setUploadModalInitialFiles(undefined);
    setUploadModalInitialFolders(undefined);
    setUploadModalForcedPath(undefined);
    editPendingDeletionsRef.current = [];
    editPendingFolderDeletionsRef.current = [];
    editExistingFileIdMapRef.current = {};
    editSubGroupCascadeRef.current = new Map();
  };
  const [showCreateFolderModal, setShowCreateFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [editingFolder, setEditingFolder] = useState<FolderItem | null>(null);
  const [editFolderName, setEditFolderName] = useState("");
  // ── Folder Builder state ────────────────────────────────────────────────────
  const [showFolderBuilderModal, setShowFolderBuilderModal] = useState(false);
  const [showFolderUnsavedWarning, setShowFolderUnsavedWarning] = useState(false);
  const [folderBuilderNewName, setFolderBuilderNewName] = useState("");
  const [virtualFolders, setVirtualFolders] = useState<VirtualFolderItem[]>([]);
  const [folderBuilderUploading, setFolderBuilderUploading] = useState(false);
  const [folderBuilderProgress, setFolderBuilderProgress] = useState<Record<string, number>>({});
  const [activeDropFolderId, setActiveDropFolderId] = useState<string | null>(null);
  const folderFileInputRef = useRef<HTMLInputElement>(null);
  const [expandedSection, setExpandedSection] = useState<string | null>("folderName");
  // ── Folder Builder navigation (internal breadcrumb within the modal) ─────────
  // Each nav entry may be:
  //   • a virtual folder the user has added this session (has virtualId)
  //   • an existing folder the user has navigated into (has existingPath)
  //   • a synthetic group anchor (e.g. "muthu") — kind: "group", non-clickable
  type FbNavEntry = {
    id: string;            // unique id for this entry (key)
    name: string;          // display name
    kind?: "virtual" | "existing" | "group";
    existingPath?: string[]; // full existing-folder path from activity root
    groupId?: string;        // present for "group" entries
  };
  const [fbNavPath, setFbNavPath] = useState<FbNavEntry[]>([]);
  const [fbRootFiles, setFbRootFiles] = useState<VirtualFolderFile[]>([]);
  const [fbDragOverRoot, setFbDragOverRoot] = useState(false);

  // Virtual additions keyed by their parent path (the existing-folder path the
  // user is currently navigated into). Lets the user add new folders / files
  // inside an existing folder without losing the work when they navigate
  // back out. Key shape:
  //   ""               → activity root (mirror of virtualFolders + fbRootFiles)
  //   "sem I"          → inside existing folder "sem I"
  //   "muthu#sem I"    → inside existing folder "sem I" that lives in group "muthu"
  // The "muthu#" prefix disambiguates group-scoped folders from raw activity-root
  // folders with the same name (rare but possible). For non-group paths the key
  // is just the segments joined by "/".
  type FbAdditions = { folders: VirtualFolderItem[]; files: VirtualFolderFile[] };
  const [fbVirtualByPath, setFbVirtualByPath] = useState<Record<string, FbAdditions>>({});
  const fbFileInputRef = useRef<HTMLInputElement>(null);
  const [accessLevel, setAccessLevel] = useState("private");
  const [hideStudentSettings, setHideStudentSettings] = useState<Record<string, boolean>>({});
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ type: "folder" | "file"; item: any; name: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showPDFViewer, setShowPDFViewer] = useState(false);
  const [currentPDFUrl, setCurrentPDFUrl] = useState("");
  const [currentPDFName, setCurrentPDFName] = useState("");
  const [showVideoViewer, setShowVideoViewer] = useState(false);
  const [currentVideoUrl, setCurrentVideoUrl] = useState("");
  const [currentVideoName, setCurrentVideoName] = useState("");
  const [currentVideoResolutions, setCurrentVideoResolutions] = useState<string[]>([]);
  const [currentVideoFileUrlMap, setCurrentVideoFileUrlMap] = useState<Record<string, string>>({});
  const [videoPlaylist, setVideoPlaylist] = useState<VideoItem[]>([]);
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
  const [showZipViewer, setShowZipViewer] = useState(false);
  const [currentZipUrl, setCurrentZipUrl] = useState("");
  const [currentZipName, setCurrentZipName] = useState("");
  const [showPPTViewer, setShowPPTViewer] = useState(false);
  const [currentPPTUrl, setCurrentPPTUrl] = useState("");
  const [currentPPTName, setCurrentPPTName] = useState("");
  const router = useRouter() // add this if not present
  // Courses list vs Course Structure — see useParentSection.
  const parentSection = useParentSection()
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [isDummyStudent, setIsDummyStudent] = useState(false)
  const [originalRoleInfo, setOriginalRoleInfo] = useState<{ roleName: string; renameRole: string } | null>(null)
  const userRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null);
  const hasInitialized = useRef(false);
  const isFetchingRef = useRef<string | null>(null);
  const lastFetchedDataRef = useRef<string>("");
  const initialDataLoadedRef = useRef(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [isNodeSelected, setIsNodeSelected] = useState(false);
  const [isSidebarLoading, setIsSidebarLoading] = useState(true);
  const [cachedContentData, setCachedContentData] = useState<Record<string, ContentData>>({});
  const [loadingNodes, setLoadingNodes] = useState<Set<string>>(new Set());
  const [referenceDisplayName, setReferenceDisplayName] = useState("Reference Material");
  // Add these state variables with your other state declarations
  const [isContentLoading, setIsContentLoading] = useState(false);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);

  // Safety timeout — if a content fetch stalls (server down, network hang,
  // uncaught error before finally runs), the loader used to sit on screen
  // forever. Force-clear after 15s so the trainer falls through to whatever
  // content is available (or CourseContent's own empty state) and isn't
  // trapped in an eternal spinner.
  useEffect(() => {
    if (!isContentLoading) return;
    const t = setTimeout(() => setIsContentLoading(false), 15000);
    return () => clearTimeout(t);
  }, [isContentLoading]);

  // Add these state variables in DynamicLMSCoordinator component
  const [showWordViewer, setShowWordViewer] = useState(false);
  const [currentWordUrl, setCurrentWordUrl] = useState("");
  const [currentWordName, setCurrentWordName] = useState("");
  const [showTxtViewer, setShowTxtViewer] = useState(false);
  const [currentTxtUrl, setCurrentTxtUrl] = useState("");
  const [currentTxtName, setCurrentTxtName] = useState("");
  const [showImageViewer, setShowImageViewer] = useState(false);
  const [currentImageUrl, setCurrentImageUrl] = useState("");
  const [currentImageName, setCurrentImageName] = useState("");
  const [currentImageFileId, setCurrentImageFileId] = useState("");
  const [imagePlaylist, setImagePlaylist] = useState<Array<{ id: string; title: string; fileUrl: string }>>([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const subcategories = useMemo(() => {
    if (!courseStructureResponse?.data) return { I_Do: [], We_Do: [], You_Do: [] };
    const d = courseStructureResponse.data;
    return {
      I_Do: d.I_Do.map((item: string) => ({ key: item.toLowerCase().replace(/\s+/g, "_"), label: item, icon: <Brain size={14} />, component: null })),
      We_Do: d.We_Do.map((item: string) => ({ key: item.toLowerCase().replace(/\s+/g, "_"), label: item, icon: <Users size={14} />, component: item.toLowerCase().replace(/\s+/g, "_") === "project_development" ? "Practical" : null })),
      You_Do: d.You_Do.map((item: string) => ({ key: canonYouDoSubKey(item.toLowerCase().replace(/\s+/g, "_")), label: item, icon: <HelpCircle size={14} />, component: null })),
    };
  }, [courseStructureResponse]);

  const fileTypes: FileTypeConfig[] = useMemo(() => {
    // Structural tools — not part of the resource catalog, so always available.
    const staticFileTypes: FileTypeConfig[] = [
      { key: "folder", label: "New Folder", icon: <FolderPlus size={22} />, color: T.orange, tooltip: "Create a new folder" },
      { key: "page_creation", label: "Page Builder", icon: <FilePlus2 size={22} />, color: T.orange, tooltip: "Build rich content pages with editable blocks" },
      { key: "reference", label: "REFERENCE", icon: <BookOpen size={22} />, color: "#8b5cf6", tooltip: "Upload reference materials", accept: "*" },
    ];

    // The resource catalog, in the same order the Super Admin's Resource
    // Management lists it. A type only appears here if the course enabled it,
    // and a course can only enable what the institution was granted — so this
    // list is Super Admin → course setup → upload page, end to end.
    const CATALOG: (FileTypeConfig & { configKey: string })[] = [
      { configKey: "video", key: "video", label: "Video", icon: <Video size={22} />, color: "#3b82f6", tooltip: "Upload video files", accept: "video/*,.mp4,.avi,.mov,.mkv" },
      { configKey: "ppt", key: "ppt", label: "PPT", icon: <FileText size={22} />, color: "#f97316", tooltip: "Upload PowerPoint files", accept: ".ppt,.pptx" },
      { configKey: "pdf", key: "pdf", label: "PDF", icon: <FileText size={22} />, color: "#ef4444", tooltip: "Upload PDF documents", accept: ".pdf" },
      { configKey: "image", key: "image", label: "Image", icon: <ImageIcon size={22} />, color: "#10b981", tooltip: "Upload image files", accept: "image/*,.png,.jpg,.jpeg,.gif,.webp,.svg" },
      { configKey: "zip", key: "zip", label: "ZIP File", icon: <FileArchive size={22} />, color: "#a855f7", tooltip: "Upload ZIP archives", accept: ".zip,.rar,.7z,.tar,.gz" },
      { configKey: "url", key: "url", label: "URL", icon: <Link2 size={22} />, color: "#10b981", tooltip: "Add external URLs", accept: "url" },
      // Notes / AI are "Student Used Feature" items — kept here too (not just
      // in studentFeatureTypes below) so icon/accept lookups and the content
      // filter dropdown still resolve them once something's been uploaded.
      { configKey: "notes", key: "notes", label: "Notes", icon: <StickyNote size={22} />, color: "#84cc16", tooltip: "Upload downloadable study notes", accept: ".pdf,.doc,.docx,.txt" },
      { configKey: "ai", key: "ai", label: "AI", icon: <Bot size={22} />, color: "#6366f1", tooltip: "AI-generated content", accept: "*" },
    ];

    const rt = courseStructureResponse?.data?.resourcesType;
    const iDoResources =
      rt && typeof rt === "object" && !Array.isArray(rt) && "iDo" in rt
        ? (rt as any).iDo
        : null;

    // No saved config at all (legacy course) → fall back to the catalog rather
    // than showing the user an upload bar with nothing but folder/reference.
    const dynamicFileTypes = iDoResources
      ? CATALOG.filter((t) => iDoResources[t.configKey]?.enabled === true)
      : CATALOG;

    return [...staticFileTypes, ...dynamicFileTypes.map(({ configKey, ...t }) => t)];
  }, [courseStructureResponse]);

  // The subset of `fileTypes` that represents an actual uploadable file format,
  // handed to FileUploadModal so its accepted-type chips, browse filter and
  // drag & drop validation all follow the course's Resource Type config.
  // Excludes the structural entries (folder / page / reference), URL (not a
  // file), and the Notes / AI student features — none of them describe a format
  // the drop zone should accept on its own.
  const uploadableTypeKeys = useMemo(
    () => fileTypes.map((t) => t.key).filter((k) => UPLOADABLE_TYPE_KEYS.includes(k)),
    [fileTypes]
  );

  // Course Setup's per-type "Max file size", in MB. Each type carries its own
  // ceiling (PPT 2 MB, PDF 3 MB …), so this is a map rather than one number.
  // A type with no saved maxSize stays unlimited.
  const uploadMaxSizeByType = useMemo(() => {
    const rt = courseStructureResponse?.data?.resourcesType;
    const iDo =
      rt && typeof rt === "object" && !Array.isArray(rt) && "iDo" in rt ? (rt as any).iDo : null;
    if (!iDo) return {};
    return UPLOADABLE_TYPE_KEYS.reduce<Record<string, number | undefined>>((acc, key) => {
      const size = Number(iDo[key]?.maxSize);
      if (Number.isFinite(size) && size > 0) acc[key] = size;
      return acc;
    }, {});
  }, [courseStructureResponse]);

  /**
   * The AI Chat / AI Summary / Notes switches Course Setup stores per resource
   * type (`resourcesType.iDo.<type>.aiChat` etc.). Staff viewers show the same
   * buttons students do, so they read the same switches — otherwise staff would
   * be looking at a feature their students can't see.
   *
   * Defaults to off: a course with no saved config has enabled nothing.
   */
  const viewerFeaturesFor = useCallback((type: string) => {
    const rt = courseStructureResponse?.data?.resourcesType;
    const iDo =
      rt && typeof rt === "object" && !Array.isArray(rt) && "iDo" in rt ? (rt as any).iDo : null;
    const cfg = iDo?.[type];
    return {
      aiChatEnabled: !!cfg?.aiChat,
      aiSummaryEnabled: !!cfg?.aiSummary,
      notesEnabled: !!cfg?.notes,
    };
  }, [courseStructureResponse]);

  // The same rules the Upload Files modal applies, for the page's own two file
  // entry points: the Folder Builder drop zone and the per-type upload modal.
  // Without this a blocked format or an oversized file could still get in
  // through those routes. No fallback needed — `fileTypes` already widens to
  // the full catalog for a legacy course, so an empty list here genuinely
  // means "nothing enabled".
  const uploadFileRules = useMemo(
    () => buildAllowedRules(uploadableTypeKeys, uploadMaxSizeByType),
    [uploadableTypeKeys, uploadMaxSizeByType]
  );

  // "Student Used Feature" — Notes / AI, shown separately in the "Add a new
  // resource" picker. Only appears when the course enabled at least one
  // (which itself only happens if the institution's Super Admin granted it —
  // see Resourcetypesection), so this mirrors that chain end to end.
  const studentFeatureTypes: FileTypeConfig[] = useMemo(() => {
    const CATALOG: (FileTypeConfig & { configKey: string })[] = [
      { configKey: "notes", key: "notes", label: "Notes", icon: <StickyNote size={22} />, color: "#84cc16", tooltip: "Upload downloadable study notes", accept: ".pdf,.doc,.docx,.txt" },
      { configKey: "ai", key: "ai", label: "AI", icon: <Bot size={22} />, color: "#6366f1", tooltip: "AI-generated content", accept: "*" },
    ];

    const rt = courseStructureResponse?.data?.resourcesType;
    const iDoResources =
      rt && typeof rt === "object" && !Array.isArray(rt) && "iDo" in rt
        ? (rt as any).iDo
        : null;

    // No saved config at all (legacy course) → nothing to show; unlike the
    // main list, there's no sensible "show everything" fallback for a brand
    // new feature the institution may never have enabled.
    if (!iDoResources) return [];

    return CATALOG.filter((t) => iDoResources[t.configKey]?.enabled === true).map(({ configKey, ...t }) => t);
  }, [courseStructureResponse]);


  // Add this state
  const [configuredLanguages, setConfiguredLanguages] = useState<{
    coreProgram: string[];
    frontend: string[];
    database: string[];
  }>({
    coreProgram: [],
    frontend: [],
    database: []
  });

  // Function to find the module for the selected node
  const findModuleForNode = useCallback((node: CourseNode | null): any | null => {
    if (!node || !courseStructureResponse?.data?.modules) return null;

    const modules = courseStructureResponse.data.modules;

    // Helper to search recursively for the module containing this node
    const findModuleInTree = (module: any, targetId: string): any | null => {
      // Check if this module matches
      if (module._id === targetId) return module;

      // Check topics in module
      if (module.topics) {
        for (const topic of module.topics) {
          if (topic._id === targetId) return module;
          if (topic.subTopics) {
            for (const subtopic of topic.subTopics) {
              if (subtopic._id === targetId) return module;
            }
          }
        }
      }

      // Check submodules
      if (module.subModules) {
        for (const submodule of module.subModules) {
          if (submodule._id === targetId) return module;
          if (submodule.topics) {
            for (const topic of submodule.topics) {
              if (topic._id === targetId) return module;
              if (topic.subTopics) {
                for (const subtopic of topic.subTopics) {
                  if (subtopic._id === targetId) return module;
                }
              }
            }
          }
        }
      }

      return null;
    };

    // Search through all modules
    for (const module of modules) {
      const found = findModuleInTree(module, node.id);
      if (found) return found;
    }

    return null;
  }, [courseStructureResponse, selectedNode]);

  // Extract skill set from the selected node's own testConfiguration (flat format)
  useEffect(() => {
    if (selectedNode) {
      const tc = selectedNode.originalData?.testConfiguration;
      setConfiguredLanguages({
        coreProgram: (tc?.coreProgram ?? []).filter(Boolean),
        frontend: (tc?.frontend ?? []).filter(Boolean),
        database: (tc?.database ?? []).filter(Boolean),
      });
    } else {
      setConfiguredLanguages({ coreProgram: [], frontend: [], database: [] });
    }
  }, [selectedNode]);
  const setActiveTabPersistent = (tab: "I_Do" | "We_Do" | "You_Do" | null) => { setActiveTab(tab); if (tab) setLS("lms_selected_tab", tab); else delLS("lms_selected_tab"); };
  const setActiveSubcategoryPersistent = (sub: string) => { setActiveSubcategory(sub); setLS("lms_selected_subcategory", sub); };
  const setSelectedNodePersistent = (node: CourseNode | null) => {
    setSelectedNode(node);
    if (node) { setLS("lms_selected_node_id", node.id); setLS("lms_selected_node_name", node.name); delLS("lms_restore_node_id"); }
    else { delLS("lms_selected_node_id"); delLS("lms_selected_node_name"); }
  };

  const getCurrentNavKey = () => `${activeTab}-${activeSubcategory}`;
  const getCurrentNavState = useCallback((): FolderNavState => folderNavState[getCurrentNavKey()] || { currentFolderPath: [], currentFolderId: null }, [activeTab, activeSubcategory, folderNavState]);
  const updateNavState = (updates: Partial<FolderNavState>) => { const key = getCurrentNavKey(); setFolderNavState((prev) => ({ ...prev, [key]: { ...getCurrentNavState(), ...updates } })); };

  const findPathToNode = useCallback((nodes: CourseNode[], targetId: string, path: string[] = []): string[] | null => {
    for (const node of nodes) {
      if (node.id === targetId) return path;
      if (node.children?.length) { const found = findPathToNode(node.children, targetId, [...path, node.id]); if (found) return found; }
    }
    return null;
  }, []);

  const getCurrentFolderContents = useCallback(() => {
    if (!selectedNode || !activeTab) return { folders: [] as FolderItem[], files: [] as UploadedFile[] };
    const navState = getCurrentNavState();
    const tabData = contentData[selectedNode.id]?.[activeTab] || {};
    const subcatData = tabData[activeSubcategory] || [];
    if (!navState.currentFolderId) {
      return { folders: subcatData.filter((i): i is FolderItem => isFolderItem(i) && !i.parentId), files: subcatData.filter((i): i is UploadedFile => isUploadedFile(i) && !i.folderId) };
    }
    const findContents = (items: FolderItem[], id: string): { folders: FolderItem[]; files: UploadedFile[] } => {
      for (const f of items) { if (f.id === id) return { folders: f.subfolders || [], files: f.files || [] }; const res = findContents(f.subfolders || [], id); if (res.folders.length || res.files.length) return res; }
      return { folders: [], files: [] };
    };
    const rootFolders = subcatData.filter((i): i is FolderItem => isFolderItem(i) && !i.parentId);
    return findContents(rootFolders, navState.currentFolderId);
  }, [selectedNode, activeTab, activeSubcategory, contentData, getCurrentNavState]);

  // Locate a folder anywhere in the tree (root or nested).
  const findFolderInTree = useCallback((items: FolderItem[], id: string): FolderItem | null => {
    for (const f of items) {
      if (f.id === id) return f;
      const inner = findFolderInTree(f.subfolders || [], id);
      if (inner) return inner;
    }
    return null;
  }, []);

  // Recursive file count for a folder — counts files at every depth,
  // does NOT count sub-folders as items.
  const getFolderItemCount = useCallback((folderId: string): number => {
    if (!selectedNode || !activeTab) return 0;
    const tabData = contentData[selectedNode.id]?.[activeTab] || {};
    const roots = (tabData[activeSubcategory] || []).filter(
      (i): i is FolderItem => isFolderItem(i) && !i.parentId,
    );
    const target = findFolderInTree(roots, folderId);
    if (!target) return 0;
    const countFiles = (folder: FolderItem): number => {
      const direct = folder.files?.length || 0;
      const nested = (folder.subfolders || []).reduce((s, sf) => s + countFiles(sf), 0);
      return direct + nested;
    };
    return countFiles(target);
  }, [selectedNode, activeTab, activeSubcategory, contentData, findFolderInTree]);

  // Recursive size (bytes) for a folder — sums every file size at every depth.
  const getFolderTotalSize = useCallback((folderId: string): number => {
    if (!selectedNode || !activeTab) return 0;
    const tabData = contentData[selectedNode.id]?.[activeTab] || {};
    const roots = (tabData[activeSubcategory] || []).filter(
      (i): i is FolderItem => isFolderItem(i) && !i.parentId,
    );
    const target = findFolderInTree(roots, folderId);
    if (!target) return 0;
    const sumSize = (folder: FolderItem): number => {
      const direct = (folder.files || []).reduce(
        (s, f) => s + (Number(f.size) || 0),
        0,
      );
      const nested = (folder.subfolders || []).reduce((s, sf) => s + sumSize(sf), 0);
      return direct + nested;
    };
    return sumSize(target);
  }, [selectedNode, activeTab, activeSubcategory, contentData, findFolderInTree]);
  const processNodeContent = useCallback(async (node: CourseNode): Promise<ContentData> => {
    const data = node.originalData;
    if (!data?.pedagogy) return { I_Do: {}, We_Do: {}, You_Do: {} };
    const normalizeDate = (value: any): string => {
      if (!value) return "";
      const raw = typeof value === "object" && value.$date ? value.$date : value;
      const ms = new Date(raw).getTime();
      return Number.isNaN(ms) ? "" : new Date(ms).toISOString();
    };

    const processPedagogy = (backendTab: "I_Do" | "We_Do" | "You_Do", frontendTab: "I_Do" | "We_Do" | "You_Do"): SubcategoryData => {
      const section = data.pedagogy[backendTab];
      if (!section) return {};

      const result: SubcategoryData = {};

      Object.keys(section).forEach((subcatKey) => {
        const subcatData = section[subcatKey];
        if (!subcatData) return;

        const frontendKey = subcatKey.toLowerCase().replace(/\s+/g, "_");
        const items: (FolderItem | UploadedFile)[] = [];

        // Process folders
        if (subcatData.folders && Array.isArray(subcatData.folders)) {
          const processFolders = (foldersArr: any[], parentId: string | null = null, pathArr: string[] = []): FolderItem[] => {
            const foldersOut: FolderItem[] = [];

            (foldersArr || []).forEach((folder) => {
              if (!folder || !folder.name) return;

              const fid = folder._id;
              if (!fid) return;

              const folderPath = [...pathArr, folder.name];

              const folderFiles: UploadedFile[] = (folder.files || []).map((file: any) => {
                if (!file) return null;
                const fileId = file._id;
                if (!fileId) return null;

                const url = typeof file.fileUrl === "string" ? file.fileUrl : file.fileUrl?.base || "";
                const rawMap: Record<string, string> = typeof file.fileUrl === "object" && file.fileUrl !== null ? file.fileUrl : {};
                const resNames: string[] = file.availableResolutions?.length ? file.availableResolutions : Object.keys(rawMap).filter(k => rawMap[k]);

                return {
                  id: fileId,
                  name: file.fileName || "Unnamed",
                  type: file.fileType || "unknown",
                  size: typeof file.size === "string" ? parseInt(file.size) : (file.size || 0),
                  url: url,
                  uploadedAt: normalizeDate(file.uploadedAt) || normalizeDate(file.updatedAt) || normalizeDate(file.createdAt),
                  subcategory: subcatKey,
                  folderId: fid,
                  folderPath: folderPath.join("/"),
                  tags: file.tags?.map((t: any) => ({
                    tagName: t.tagName || t.name || "",
                    tagColor: t.tagColor || t.color || "#FB923C"
                  })) || [],
                  fileSettings: file.fileSettings ? {
                    showToStudents: file.fileSettings.showToStudents ?? true,
                    allowDownload: file.fileSettings.allowDownload ?? true
                  } : undefined,
                  availableResolutions: resNames,
                  fileUrlMap: rawMap,
                  description: file.fileDescription || file.description || "",
                  isReference: file.fileType === "reference" || file.isReference === true,
                  isVideo: file.fileType?.includes("video") || false,
                  groupId: file.groupId || undefined,
                  groupName: file.groupName || undefined,
                  parentGroupId: file.parentGroupId || undefined,
                };
              }).filter(Boolean) as UploadedFile[];

              const subfolders = processFolders(folder.subfolders || [], fid, folderPath);

              const folderItem: FolderItem = {
                id: fid,
                name: folder.name,
                type: "folder",
                parentId: parentId,
                parentGroupId: folder.parentGroupId || undefined,
                groupName: folder.groupName || undefined,
                groupDescription: folder.groupDescription || undefined,
                children: [...subfolders, ...folderFiles],
                tabType: frontendTab,
                subcategory: subcatKey,
                files: folderFiles,
                subfolders: subfolders,
                folderPath: folderPath.join("/"),
                tags: folder.tags || [],
                uploadedAt: normalizeDate(folder.uploadedAt),
                createdAt: normalizeDate(folder.createdAt),
                updatedAt: normalizeDate(folder.updatedAt),
              };

              foldersOut.push(folderItem);
              items.push(folderItem, ...folderFiles);
            });

            return foldersOut;
          };

          processFolders(subcatData.folders || []);
        }

        // Process root-level files
        if (subcatData.files && Array.isArray(subcatData.files)) {
          const rootFiles: UploadedFile[] = subcatData.files.map((file: any) => {
            if (!file) return null;
            const fileId = file._id;
            if (!fileId) return null;

            let fileType = file.fileType || "unknown";
            let fileUrl = typeof file.fileUrl === "string" ? file.fileUrl : file.fileUrl?.base || "";

            if (fileType?.includes("url") || fileType?.includes("link")) {
              fileType = "url/link";
            }

            const rawFileUrlMap: Record<string, string> = typeof file.fileUrl === "object" && file.fileUrl !== null ? file.fileUrl : {};
            const resolvedResolutions: string[] = file.availableResolutions?.length
              ? file.availableResolutions
              : Object.keys(rawFileUrlMap).filter(k => rawFileUrlMap[k]);

            return {
              id: fileId,
              name: file.fileName || "Unnamed",
              type: fileType,
              size: typeof file.size === "string" ? parseInt(file.size) : (file.size || 0),
              url: fileUrl,
              uploadedAt: normalizeDate(file.uploadedAt) || normalizeDate(file.updatedAt) || normalizeDate(file.createdAt),
              subcategory: subcatKey,
              folderId: null,
              tags: file.tags?.map((t: any) => ({
                tagName: t.tagName || "",
                tagColor: t.tagColor || "#FB923C"
              })) || [],
              fileSettings: file.fileSettings ? {
                showToStudents: file.fileSettings.showToStudents ?? true,
                allowDownload: file.fileSettings.allowDownload ?? true
              } : undefined,
              availableResolutions: resolvedResolutions,
              fileUrlMap: rawFileUrlMap,
              description: file.fileDescription || file.description || "",
              isReference: fileType === "reference" || file.isReference === true,
              isVideo: fileType?.includes("video") || false,
              groupId: file.groupId || undefined,
              groupName: file.groupName || undefined,
              parentGroupId: file.parentGroupId || undefined,
            };
          }).filter(Boolean) as UploadedFile[];

          items.push(...rootFiles);
        }

        // Process pages
        if (subcatData.pages && Array.isArray(subcatData.pages)) {
          const pagesMap = new Map();

          subcatData.pages.forEach((page: any) => {
            if (!page || !page._id) return;
            if (!pagesMap.has(page._id)) {
              pagesMap.set(page._id, page);
            }
          });

          const pagesAsFiles: UploadedFile[] = Array.from(pagesMap.values()).map((page: any) => ({
            id: page._id,
            name: page.title || "Untitled Page",
            type: "page",
            size: 0,
            url: "",
            uploadedAt: normalizeDate(page.updatedAt) || normalizeDate(page.createdAt),
            subcategory: subcatKey,
            folderId: null,
            tags: [],
            _combinedCode: page.combinedCode || "",
            _pageCount: page.pageCount || 1,
            _blocks: page.blocks || [],
          }));

          items.push(...pagesAsFiles);
        }

        result[frontendKey] = items;
      });

      return result;
    };

    return {
      I_Do: processPedagogy("I_Do", "I_Do"),
      We_Do: processPedagogy("We_Do", "We_Do"),
      You_Do: processPedagogy("You_Do", "You_Do")
    };
  }, []);

// In DynamicLMSCoordinator, update the refreshContentData function:
const refreshContentData = useCallback(async (node: CourseNode, backendData?: any) => {
  const data = backendData || node.originalData;
  if (!data?.pedagogy) return;

  // Process and cache the content
  const processedContent = await processNodeContent(node);

  // Update both caches
  setCachedContentData((prev) => ({ ...prev, [node.id]: processedContent }));
  setContentData((prev) => ({ ...prev, [node.id]: processedContent }));
  
  // Force a re-render by creating a new reference
  // This ensures CourseContent detects the change
  setContentData(prev => {
    const newContent = { ...prev, [node.id]: processedContent };
    return newContent;
  });

  // Collect all folders for navigation
  const allFolders: FolderItem[] = [];
  const collectFolders = (items: (FolderItem | UploadedFile)[]) => {
    items.forEach((i) => {
      if (isFolderItem(i)) {
        allFolders.push(i);
        collectFolders(i.children || []);
      }
    });
  };

  Object.values(processedContent).forEach((tabData) => {
    Object.values(tabData).forEach(collectFolders);
  });

  setFolders(allFolders);
  setInitialLoadComplete(true);
  setIsInitialLoad(false);
}, [processNodeContent]);

  // ── The course payload, through React Query ─────────────────────────────────
  //
  // Both refresh paths below pull the WHOLE course from the same endpoint, so
  // clicking through six nodes used to mean six full downloads of the same
  // document and a spinner each time. They now share one React Query entry
  // keyed by course + batch:
  //
  //   • node selection asks for it normally → a hit inside `staleTime` returns
  //     instantly with no request at all, which is what removes the reload when
  //     moving between nodes and between I Do / We Do / You Do;
  //   • anything that CHANGED the data (upload, delete, folder edit, batch
  //     switch) asks with `fresh`, which drops the entry first so the next read
  //     is a real fetch rather than the copy from before the change.
  //
  // The batch is part of the key: batch 1 and batch 2 are different documents
  // from this endpoint, and sharing one entry would serve the wrong one.
  // The two reads that replace the old whole-course `loadCourseData`.
  //
  // That function fetched the ENTIRE course (every node's pedagogy) for two
  // jobs its callers do together: read ONE node's content, and rebuild the
  // sidebar when the structure changed. coursesData.ts already ships a
  // purpose-built endpoint for each — this is the split it describes.
  //
  //   • loadNodePedagogy — the selected node's pedagogy/testConfiguration,
  //     a few KB instead of ~900 KB.
  //   • loadCourseLight  — the tree skeleton, same entry the page already
  //     reads at mount, so it is normally a cache hit costing nothing.
  //
  // Both keep the old `fresh` contract -- the next read is a real fetch, used
  // after an upload / delete / batch switch -- but spell it with staleTime 0
  // rather than removeQueries. Dropping the entry ALSO aborted whatever fetch
  // was already in flight for that key, so a plain overlap (the node-click read
  // and the batch-settle re-read landing together) rejected the first caller
  // with CancelledError. staleTime 0 forces the network read and dedupes
  // against an in-flight one instead of killing it, so both callers get data.
  // The batch is part of both keys (getActiveBatchId is baked into them by
  // coursesData.ts), so batch 1 and batch 2 never share an entry.

  // getNodePedagogy has no notion of the course root. The old code had the
  // same hole — `findInFresh` only walked modules/submodules/topics/subtopics,
  // so a selected course node fell through to refreshContentData. Returning
  // null here reproduces that exactly.
  const nodePedagogyType = (
    t: CourseNode["type"],
  ): "module" | "submodule" | "topic" | "subtopic" | null =>
    t === "module" || t === "submodule" || t === "topic" || t === "subtopic" ? t : null;

  const loadNodePedagogy = useCallback(
    async (node: CourseNode, opts?: { fresh?: boolean }): Promise<any | null> => {
      const type = nodePedagogyType(node.type);
      if (!type) return null;
      const spec = courseDataApi.getNodePedagogy(type, node.id);
      const res = await queryClient.fetchQuery({
        ...spec,
        staleTime: opts?.fresh ? 0 : 60 * 1000,
        gcTime: 10 * 60 * 1000,
      });
      return res?.data ?? null;
    },
    [queryClient],
  );

  const loadCourseLight = useCallback(
    async (opts?: { fresh?: boolean }): Promise<any> => {
      const spec = courseDataApi.getLight(courseId || "");
      return queryClient.fetchQuery({
        ...spec,
        staleTime: opts?.fresh ? 0 : 60 * 1000,
        gcTime: 10 * 60 * 1000,
      });
    },
    [courseId, queryClient],
  );

  const fetchAndRefresh = useCallback(async (node: CourseNode) => {
    // The batch belongs in the key. Keyed by node alone, a read still in flight
    // for the batch the user just left blocked the read for the batch they just
    // picked — the switch silently did nothing and the list stayed empty.
    const startedForBatch = getActiveBatchId();
    const fetchKey = `${node.id}:${startedForBatch}`;
    if (isFetchingRef.current === fetchKey) return;
    isFetchingRef.current = fetchKey;

    // Set loading state
    setIsContentLoading(true);

    try {
      // `fresh`: this path runs after a change (upload, delete, batch switch),
      // so the cached copies are known to be out of date.
      const nodePedagogy = await loadNodePedagogy(node, { fresh: true });

      // The user may have switched batches again while this was in flight.
      // Applying it now would paint the previous batch's material over theirs.
      if (getActiveBatchId() !== startedForBatch) return;

      if (nodePedagogy) {
        // Overlay the fresh pedagogy on the node's existing structural fields
        // — the node-pedagogy endpoint returns only the content half.
        const merged = { ...(node.originalData || {}), ...nodePedagogy };
        const freshNode: CourseNode = { ...node, originalData: merged };

        const nodeChanged = JSON.stringify(node.originalData) !== JSON.stringify(merged);

        if (nodeChanged) {
          // Structure comes from the light entry, which the page already holds
          // — normally a cache hit, and a few KB when it is not.
          const light = await loadCourseLight({ fresh: true });
          if (light?.data) setCourseData(transformToCourseNodes(light.data));
          setSelectedNode(freshNode);
        }

        await refreshContentData(freshNode);
      } else {
        await refreshContentData(node);
      }

      setInitialLoadComplete(true);
    } catch (err: any) {
      // The same benign race fetchAndCacheNodeData guards against, seen from
      // the other side. A cancelled read (unmount, a cache reset on batch
      // switch) means this node is no longer the one to paint, or another path
      // is already fetching it. Falling back would duplicate that work and log
      // a scary error for a normal overlap.
      if (err?.name === "CancelledError" || err?.silent) return;
      console.error("fetchAndRefresh error:", err);
      await refreshContentData(node);
    } finally {
      setIsContentLoading(false);
      isFetchingRef.current = null;
    }
  }, [courseId, refreshContentData, loadNodePedagogy, loadCourseLight]);

  // ── Re-read the open node when the batch changes ────────────────────────────
  //
  // Switching batches empties the content caches, but nothing was refetching
  // afterwards: `selectNode` only runs on a click and returns early for the node
  // already selected. So the tree stayed on screen while its resource list went
  // blank and stayed blank — which is what "switch to batch 2, switch back to
  // batch 1, nothing shows" was. The node is re-read here instead, through the
  // now batch-aware `fetchAndRefresh`.
  const lastBatchRef = useRef<string | null>(null);
  useEffect(() => {
    // Skip the first settle — the initial load already fetched this batch.
    if (lastBatchRef.current === null) {
      lastBatchRef.current = activeBatchId;
      return;
    }
    if (lastBatchRef.current === activeBatchId) return;
    lastBatchRef.current = activeBatchId;
    if (selectedNode) fetchAndRefresh(selectedNode);
  }, [activeBatchId, selectedNode, fetchAndRefresh]);

  const generateBreadcrumbs = useCallback((node: CourseNode | null): BreadcrumbItem[] => {
    const base: BreadcrumbItem[] = [{ label: "Dashboard", type: "dashboard", id: "dashboard", path: "/lms/pages/dashboard" }, { label: parentSection.label, type: "courses", id: "courses", path: parentSection.href }];
    if (!node || !courseData.length) return base;
    const findPath = (nodes: CourseNode[], id: string, path: CourseNode[] = []): CourseNode[] | null => { for (const n of nodes) { if (n.id === id) return [...path, n]; const found = findPath(n.children || [], id, [...path, n]); if (found) return found; } return null; };
    const nodePath = findPath(courseData, node.id);
    if (!nodePath) return [...base, { label: courseStructureResponse?.data?.courseName || "Course", type: "course", id: courseId || "" }];
    return [...base, { label: courseStructureResponse?.data?.courseName || "Course", type: "course", id: nodePath.find((n) => n.type === "course")?.id || courseId || "" }, ...nodePath.filter((n) => n.type !== "course").map((n) => ({ label: n.name, type: n.type, id: n.id }))];
  }, [courseData, courseStructureResponse, courseId, parentSection.href, parentSection.label]);



  const fetchAndCacheNodeData = useCallback(async (node: CourseNode) => {
    const nodeId = node.id;
    const startedForBatch = getActiveBatchId();

    // Prevent multiple simultaneous fetches for the same node
    if (loadingNodes.has(nodeId)) return;

    setLoadingNodes(prev => new Set(prev).add(nodeId));
    setIsContentLoading(true);

    try {
      // Node SELECTION — the cached copy is exactly what we want. Within
      // `staleTime` this resolves with no network call, so moving between nodes
      // and between I Do / We Do / You Do is instant. It now reads only THIS
      // node's pedagogy rather than re-downloading the whole course.
      const nodePedagogy = await loadNodePedagogy(node);

      // Batch switched while this was in flight — dropping it is correct; the
      // switch has already queued a read for the batch now on screen.
      if (getActiveBatchId() !== startedForBatch) return;

      if (nodePedagogy) {
        // Overlay the fresh pedagogy on the node's existing structural fields.
        const merged = { ...(node.originalData || {}), ...nodePedagogy };
        const freshNode: CourseNode = { ...node, originalData: merged };

        // Check if node content changed
        const nodeChanged = JSON.stringify(node.originalData) !== JSON.stringify(merged);

        if (nodeChanged) {
          // Only re-select — no tree rebuild here. This is the plain
          // node-CLICK path, which cannot change the course structure;
          // structural changes arrive through fetchAndRefresh below, which
          // does rebuild. Rebuilding here also had both paths racing on the
          // light entry, which surfaced as a CancelledError and dropped this
          // fetch into its fallback.
          setSelectedNode(freshNode);
        }

        // Process and cache the content data
        const processedContent = await processNodeContent(freshNode);

        // Store in both caches
        setCachedContentData(prev => ({ ...prev, [node.id]: processedContent }));
        setContentData(prev => ({ ...prev, [node.id]: processedContent }));

      } else {
        await refreshContentData(node);
      }

      setInitialLoadComplete(true);
    } catch (err: any) {
      // A CancelledError here is not a failure: the batch-settle re-read
      // (fetchAndRefresh) dropped this node's entry with `fresh` while this
      // read was in flight, so it is already fetching the same node and will
      // set the content itself. Falling back would duplicate that work and
      // log a scary error for a benign race.
      if (err?.name === "CancelledError" || err?.silent) return;
      console.error("fetchAndCacheNodeData error:", err);
      await refreshContentData(node);
    } finally {
      setIsContentLoading(false);
      setLoadingNodes(prev => {
        const newSet = new Set(prev);
        newSet.delete(nodeId);
        return newSet;
      });
    }
  }, [courseId, loadingNodes, loadNodePedagogy]);

  const selectNode = useCallback(async (node: CourseNode) => {
    // Prevent duplicate selections
    if (selectedNode?.id === node.id) return;

    // Check if we have cached data for this node
    const hasCachedData = cachedContentData[node.id] !== undefined;

    setIsNodeSelected(true);

    if (!hasCachedData) {
      setIsContentLoading(true);
    }

    setSelectedNodePersistent(node);

    // Expand path in sidebar
    const path = findPathToNode(courseData, node.id);
    if (path?.length) {
      setExpandedNodes((prev) => {
        const n = new Set(prev);
        path.forEach((id) => n.add(id));
        setLS("lms_expanded_nodes", JSON.stringify([...n]));
        return n;
      });
    }

    updateNavState({ currentFolderPath: [], currentFolderId: null });
    setBreadcrumbs(generateBreadcrumbs(node));

    // Use cached data if available
    if (hasCachedData) {
      // Use cached data immediately
      setContentData((prev) => ({
        ...prev,
        [node.id]: cachedContentData[node.id]
      }));
      setIsContentLoading(false);
    } else {
      // Fetch fresh data
      await fetchAndCacheNodeData(node);
    }

    // Update URL params
    if (node.type === "topic" || node.type === "subtopic") {
      updateURL({ nodeId: node.id, activeTab, activeSubcategory });
    }
  }, [courseData, selectedNode, activeTab, activeSubcategory, subcategories, findPathToNode, generateBreadcrumbs, cachedContentData]);


  const getParentNodeName = useCallback((node: CourseNode, targetType: string): string => {
    const findParent = (nodes: CourseNode[], id: string, parent: CourseNode | null = null): CourseNode | null => { for (const n of nodes) { if (n.id === id) return parent; const found = findParent(n.children || [], id, n); if (found) return found; } return null; };
    const parent = findParent(courseData, node.id);
    if (!parent) return ""; if (parent.type === targetType) return parent.name; return getParentNodeName(parent, targetType);
  }, [courseData]);

  const toggleNode = (nodeId: string) => { setExpandedNodes((prev) => { const n = new Set(prev); if (n.has(nodeId)) n.delete(nodeId); else n.add(nodeId); setLS("lms_expanded_nodes", JSON.stringify([...n])); return n; }); };

  const expandAllNodes = useCallback(() => {
    const ids = new Set<string>();
    const walk = (nodes: CourseNode[]) => {
      for (const node of nodes) {
        if (node.type !== "course" && node.children?.length) ids.add(node.id);
        if (node.children?.length) walk(node.children);
      }
    };
    walk(courseData);
    setExpandedNodes(ids);
    setLS("lms_expanded_nodes", JSON.stringify([...ids]));
  }, [courseData]);

  const collapseAllNodes = useCallback(() => {
    setExpandedNodes(new Set());
    setLS("lms_expanded_nodes", JSON.stringify([]));
  }, []);

const navigateToFolder = useCallback((folderId: string, folderName: string) => {
  const findFolder = (items: (FolderItem | UploadedFile)[], id: string): FolderItem | null => { 
    for (const item of items) { 
      if (isFolderItem(item)) { 
        if (item.id === id) return item; 
        const found = findFolder(item.subfolders || [], id); 
        if (found) return found; 
      } 
    } 
    return null; 
  };
  
  if (selectedNode && activeTab) { 
    const tabData = contentData[selectedNode.id]?.[activeTab] || {}; 
    const subcatData = tabData[activeSubcategory] || []; 
    const found = findFolder(subcatData, folderId); 
    if (found) { 
      const fullPath = found.folderPath ? found.folderPath.split("/") : [found.name]; 
      updateNavState({ currentFolderId: folderId, currentFolderPath: fullPath }); 
      return; 
    } 
  }
  
  const findInFolders = (fols: FolderItem[], id: string): FolderItem | null => { 
    for (const f of fols) { 
      if (f.id === id) return f; 
      const found = findInFolders(f.subfolders || [], id); 
      if (found) return found; 
    } 
    return null; 
  };
  
  const fromState = findInFolders(folders, folderId);
  if (fromState) {
    updateNavState({ currentFolderId: folderId, currentFolderPath: fromState.folderPath ? fromState.folderPath.split("/") : [fromState.name] });
  } else { 
    showErrorToast(`Folder "${folderName}" not found`); 
    updateNavState({ currentFolderPath: [], currentFolderId: null }); 
  }
}, [selectedNode, activeTab, activeSubcategory, contentData, folders, updateNavState]);

  const createFolder = async () => {
    if (!newFolderName.trim() || !selectedNode) return;
    setIsButtonLoading(true);
    try {
      const navState = getCurrentNavState();
      const nowIso = new Date().toISOString();
      const response = await entityApi.createFolder(selectedNode.type as any, selectedNode.id, { tabType: toBackendTab(activeTab), subcategory: activeSubcategory, folderName: newFolderName.trim(), folderPath: navState.currentFolderPath.join("/"), courses: selectedNode.originalData?.courses || "", topicId: selectedNode.originalData?.topicId || "", index: selectedNode.originalData?.index || 0, title: selectedNode.originalData?.title || "", description: selectedNode.originalData?.description || "", duration: selectedNode.originalData?.duration || "", level: selectedNode.originalData?.level || "", action: "createFolder", tags: folderTags.map((t) => ({ tagName: t.tagName, tagColor: t.tagColor })), createdAt: nowIso, updatedAt: nowIso });
      await fetchAndRefresh(selectedNode);
      setNewFolderName(""); setShowCreateFolderModal(false); setFolderTags([]); setEditingFolder(null);
      showSuccessToast("Folder created!");
    } catch { showErrorToast("Failed to create folder"); } finally { setIsButtonLoading(false); }
  };

  const createFolderWithName = async (name: string, parentPath?: string[], options?: { createdAt?: string; parentGroupId?: string; groupName?: string; groupDescription?: string }) => {
    if (!name.trim() || !selectedNode) return;
    try {
      // Use the passed parentPath (from FileUploadModal navigation) if provided,
      // otherwise fall back to the current page nav state path
      const resolvedPath = parentPath ?? getCurrentNavState().currentFolderPath;
      const nowIso = options?.createdAt ?? new Date().toISOString();
      await entityApi.createFolder(selectedNode.type as any, selectedNode.id, {
        tabType: toBackendTab(activeTab), subcategory: activeSubcategory, folderName: name.trim(),
        folderPath: resolvedPath.join("/"),
        courses: selectedNode.originalData?.courses || "", topicId: selectedNode.originalData?.topicId || "",
        index: selectedNode.originalData?.index || 0, title: selectedNode.originalData?.title || "",
        description: selectedNode.originalData?.description || "", duration: selectedNode.originalData?.duration || "",
        level: selectedNode.originalData?.level || "", action: "createFolder", tags: [], createdAt: nowIso, updatedAt: nowIso,
        ...(options?.parentGroupId ? { parentGroupId: options.parentGroupId } : {}),
        ...(options?.groupName ? { groupName: options.groupName } : {}),
        ...(options?.groupDescription ? { groupDescription: options.groupDescription } : {}),
      });
      await fetchAndRefresh(selectedNode);
      // No success toast here — callers (modal, folder builder) show their own consolidated toast.
    } catch { showErrorToast("Failed to create folder"); }
  };

  // ── Folder Builder helpers ───────────────────────────────────────────────────

  /** Generic immutable tree update at a given id-path */
  const fbUpdateAtPath = (
    nodes: VirtualFolderItem[],
    idPath: string[],
    updater: (node: VirtualFolderItem) => VirtualFolderItem,
  ): VirtualFolderItem[] => {
    if (!idPath.length) return nodes;
    return nodes.map(n => {
      if (n.id !== idPath[0]) return n;
      if (idPath.length === 1) return updater(n);
      return { ...n, children: fbUpdateAtPath(n.children, idPath.slice(1), updater) };
    });
  };

  /** Remove a node at a given id-path */
  const fbRemoveAtPath = (
    nodes: VirtualFolderItem[],
    idPath: string[],
  ): VirtualFolderItem[] => {
    if (idPath.length === 1) return nodes.filter(n => n.id !== idPath[0]);
    return nodes.map(n =>
      n.id === idPath[0] ? { ...n, children: fbRemoveAtPath(n.children, idPath.slice(1)) } : n
    );
  };

  const fbMakeVFF = (f: File): VirtualFolderFile => {
    const base = f.name.includes('.') ? f.name.slice(0, f.name.lastIndexOf('.')) : f.name;
    return { id: `vff-${Date.now()}-${Math.random()}`, file: f, displayName: base, isEditingName: false, editNameValue: base };
  };

  /** Current nav id-path (array of ids) */
  const fbIdPath = fbNavPath.map(p => p.id);



  // Add this function alongside your other handlers
const handleNavigateToFolderLevel = useCallback(async (folderName: string, index: number) => {
  if (!selectedNode || !activeTab) return;

  const navState = getCurrentNavState();
  const currentPath = navState.currentFolderPath || [];
  const newPath = currentPath.slice(0, index + 1);

  if (newPath.length === 0) {
    updateNavState({ currentFolderId: null, currentFolderPath: [] });
    return;
  }

  const tabData = contentData[selectedNode.id]?.[activeTab] || {};
  const subcatData: (FolderItem | UploadedFile)[] = tabData[activeSubcategory] || [];

  // Walk only root-level folders (no parentId) recursively into subfolders
  const findFolderByPath = (
    items: (FolderItem | UploadedFile)[],
    segments: string[],
  ): FolderItem | null => {
    if (segments.length === 0) return null;
    const target = segments[0];
    const match = items.find(
      (item): item is FolderItem => isFolderItem(item) && item.name === target,
    );
    if (!match) return null;
    if (segments.length === 1) return match;
    return findFolderByPath(match.subfolders || [], segments.slice(1));
  };

  // Start search from root folders only (parentId null/undefined)
  const rootFolders = subcatData.filter(
    (i): i is FolderItem => isFolderItem(i) && !i.parentId,
  );
  const targetFolder = findFolderByPath(rootFolders, newPath);

  if (targetFolder) {
    updateNavState({ currentFolderId: targetFolder.id, currentFolderPath: newPath });
    return;
  }

  // Fallback: refresh data and retry with root folders
  await fetchAndRefresh(selectedNode);
  const refreshedData: (FolderItem | UploadedFile)[] =
    (contentData[selectedNode.id]?.[activeTab]?.[activeSubcategory]) || [];
  const refreshedRoots = refreshedData.filter(
    (i): i is FolderItem => isFolderItem(i) && !i.parentId,
  );
  const refreshedFolder = findFolderByPath(refreshedRoots, newPath);

  if (refreshedFolder) {
    updateNavState({ currentFolderId: refreshedFolder.id, currentFolderPath: newPath });
  } else {
    showErrorToast(`Folder "${newPath[newPath.length - 1]}" not found`);
    updateNavState({ currentFolderId: null, currentFolderPath: [] });
  }
}, [selectedNode, activeTab, activeSubcategory, contentData, getCurrentNavState, updateNavState, fetchAndRefresh]);
  /** Add folder at current nav level.
   *
   *  Routing rules (Phase 1):
   *    • At FolderBuilder root + no group anchor → virtualFolders (the
   *      original top-level virtual tree).
   *    • Anywhere where the last nav entry is existing OR group → write to
   *      fbVirtualByPath keyed by the current path. This lets the user add
   *      new folders inside an existing folder / group root.
   *    • Inside a virtual folder added this session at root → traverse the
   *      virtualFolders tree by id (original behavior).
   */
  const addVirtualFolder = () => {
    const name = folderBuilderNewName.trim();
    if (!name) return;
    const newFolder: VirtualFolderItem = {
      id: `vf-${Date.now()}-${Math.random()}`,
      name, isEditingName: false, editNameValue: name,
      files: [], children: [], isDragOver: false, isExpanded: true,
    };

    if (fbNavPath.length === 0) {
      // Pure root — original behavior.
      setVirtualFolders(prev => [...prev, newFolder]);
    } else if (fbAtPathKeyedLevel()) {
      // At an existing folder or group anchor — route to fbVirtualByPath.
      const key = fbCurrentPathKey();
      setFbVirtualByPath(prev => ({
        ...prev,
        [key]: {
          folders: [...(prev[key]?.folders ?? []), newFolder],
          files: prev[key]?.files ?? [],
        },
      }));
    } else {
      // Inside a virtual folder added at root — traverse the virtualFolders
      // tree by id, same as before.
      setVirtualFolders(prev => fbUpdateAtPath(prev, fbIdPath, node => ({
        ...node, children: [...node.children, newFolder],
      })));
    }

    setFolderBuilderNewName("");
  };

  /** Remove a virtual folder at the current nav level by its id. */
  const removeVirtualFolder = (folderId: string) => {
    fbApplyAtCurrent((folders, files) => ({
      folders: folders.filter(f => f.id !== folderId),
      files,
    }));
  };

  /** Navigate into a folder (double-click) */
  const fbNavigateInto = (folder: VirtualFolderItem) =>
    setFbNavPath(prev => [...prev, { id: folder.id, name: folder.name }]);

  /** Navigate to breadcrumb index (0 = root, 1 = first child, …) */
  const fbNavigateTo = (index: number) =>
    setFbNavPath(prev => prev.slice(0, index));

  /** Push an existing folder onto the FolderBuilder nav path. */
  const fbNavigateIntoExisting = (folderName: string, fullPath: string[]) =>
    setFbNavPath(prev => [
      ...prev,
      {
        id: `ex-${fullPath.join("/")}-${Date.now()}`,
        name: folderName,
        kind: "existing",
        existingPath: fullPath,
      },
    ]);

  /** Push a group anchor onto the FolderBuilder nav path. The user lands
   *  "inside the group" — meaning anything they add at this level gets
   *  parentGroupId set on the server. */
  const fbNavigateIntoGroup = (groupId: string, groupName: string) =>
    setFbNavPath(prev => [
      ...prev,
      { id: `grp-${groupId}`, name: groupName, kind: "group", groupId },
    ]);

  /** True when the current location's virtual additions should be stored
   *  in fbVirtualByPath (rather than the virtualFolders tree at root).
   *  This is the case whenever the nav path contains ANY existing folder
   *  or group anchor — even if the deepest segment is a virtual folder
   *  the user descended into from that existing context. */
  const fbAtPathKeyedLevel = (): boolean =>
    fbNavPath.some(e => e.kind === "existing" || e.kind === "group");

  /** Build the key into `fbVirtualByPath` for the user's current location.
   *  Virtual segments contribute their name too, so e.g. "muthu#sem I/Notes"
   *  is the key for "inside a virtual folder Notes added inside existing
   *  folder sem I under the muthu group". */
  const fbCurrentPathKey = (): string => {
    if (fbNavPath.length === 0) return "";
    let groupPrefix = "";
    const segments: string[] = [];
    for (const entry of fbNavPath) {
      if (entry.kind === "group" && entry.groupId) {
        groupPrefix = entry.name;
      } else {
        // existing OR virtual — both contribute a segment to the key
        segments.push(entry.name);
      }
    }
    return groupPrefix ? `${groupPrefix}#${segments.join("/")}` : segments.join("/");
  };

  /** Read existing folders/files/pages from the live pedagogy state at a
   *  folder path within the active tab + subcategory. Used to merge "what's
   *  already on the server" into the FolderBuilder's view. Pages live in
   *  their own array on each folder document — surfacing them keeps the
   *  FolderBuilder's view consistent with the main resource list. */
  const fbReadPedagogyAt = useCallback((path: string[], groupId?: string)
    : { folders: any[]; files: any[]; pages: any[] } => {
    if (!selectedNode || !activeTab) return { folders: [], files: [], pages: [] };
    const ped = selectedNode.originalData?.pedagogy?.[activeTab];
    if (!ped) return { folders: [], files: [], pages: [] };
    const subKey = Object.keys(ped).find(k => k.toLowerCase().replace(/\s+/g, "_") === activeSubcategory);
    if (!subKey) return { folders: [], files: [], pages: [] };
    const element = ped[subKey];
    if (!element) return { folders: [], files: [], pages: [] };

    // Start with activity-root content
    let curFolders: any[] = Array.isArray(element.folders) ? element.folders : [];
    let curFiles: any[]   = Array.isArray(element.files)   ? element.files   : [];
    let curPages: any[]   = Array.isArray(element.pages)   ? element.pages   : [];

    // If a groupId is in scope, restrict the activity-root view to that group
    // (the user is "inside the muthu group" → only show items tagged with
    // parentGroupId === groupId).
    if (groupId && path.length === 0) {
      curFolders = curFolders.filter((f: any) => (f.parentGroupId || null) === groupId);
      curFiles   = curFiles.filter((f: any) => (f.groupId || null) === groupId);
      curPages   = curPages.filter((p: any) => (p.groupId || null) === groupId);
    }

    // Walk into the folder path. Each segment matches a folder by name.
    for (const seg of path) {
      const folder = curFolders.find((f: any) => f.name === seg);
      if (!folder) return { folders: [], files: [], pages: [] };
      curFolders = Array.isArray(folder.subfolders) ? folder.subfolders : [];
      curFiles   = Array.isArray(folder.files)      ? folder.files      : [];
      curPages   = Array.isArray(folder.pages)      ? folder.pages      : [];
    }

    return { folders: curFolders, files: curFiles, pages: curPages };
  }, [selectedNode, activeTab, activeSubcategory]);

  /** Group(s) visible at the current activity-root view. Each group is
   *  shown as a virtual "group folder" in the FolderBuilder so the user
   *  can click into it just like a real folder. Derived from existing
   *  folders that carry `parentGroupId`. */
  const fbReadGroupsAtRoot = useCallback((): Array<{ groupId: string; groupName: string }> => {
    const { folders, files } = fbReadPedagogyAt([]);
    const map = new Map<string, string>();
    folders.forEach((f: any) => {
      if (f.parentGroupId) {
        map.set(String(f.parentGroupId), String(f.groupName || "Untitled group"));
      }
    });
    files.forEach((f: any) => {
      if (f.groupId) {
        map.set(String(f.groupId), String(f.groupName || "Untitled group"));
      }
    });
    return Array.from(map.entries()).map(([groupId, groupName]) => ({ groupId, groupName }));
  }, [fbReadPedagogyAt]);

  /** Get virtual {folders, files} added this session at the current nav
   *  level. Source switches based on where the user is standing:
   *    • Root (fbNavPath = [])                → virtualFolders / fbRootFiles
   *    • At an existing or group anchor       → fbVirtualByPath[key]
   *    • Inside a virtual folder added at root → traverse virtualFolders tree
   */
  const fbGetCurrentLevel = (): { folders: VirtualFolderItem[]; files: VirtualFolderFile[] } => {
    if (fbNavPath.length === 0) {
      return { folders: virtualFolders, files: fbRootFiles };
    }
    if (fbAtPathKeyedLevel()) {
      const key = fbCurrentPathKey();
      const additions = fbVirtualByPath[key];
      return {
        folders: additions?.folders ?? [],
        files: additions?.files ?? [],
      };
    }
    // Inside a virtual folder added at root — traverse virtualFolders tree.
    let nodes = virtualFolders;
    let found: VirtualFolderItem | undefined;
    for (const id of fbIdPath) {
      found = nodes.find(n => n.id === id);
      if (!found) return { folders: [], files: [] };
      nodes = found.children;
    }
    return { folders: found!.children, files: found!.files };
  };

  /** Return existing (server-side) content visible at the FolderBuilder's
   *  current navigation level. This is in addition to the virtual content
   *  returned by fbGetCurrentLevel. The render layer shows both side by side.
   *
   *  Rules:
   *    • At FolderBuilder root and no group context → show top-level folders
   *      that don't belong to any group, top-level files that don't belong
   *      to any group, AND every distinct group as a synthetic group-folder
   *      row. (Group folders are how the user enters a group's contents.)
   *    • At root + opened from a group's "+ Add resource" button (group anchor
   *      pre-pushed onto fbNavPath) → show folders/files tagged with that group.
   *    • Inside an existing folder → show that folder's subfolders + files. */
  const fbGetExistingAtCurrentLevel = (): {
    folders: any[];
    files: any[];
    pages: any[];
    groups: Array<{ groupId: string; groupName: string }>;
  } => {
    if (fbNavPath.length === 0) {
      const { folders, files, pages } = fbReadPedagogyAt([]);
      // Hide grouped items at the bare-root view; surface groups as their own rows.
      const ungroupedFolders = folders.filter((f: any) => !f.parentGroupId);
      const ungroupedFiles   = files.filter((f: any) => !f.groupId);
      const ungroupedPages   = pages.filter((p: any) => !p.groupId);
      const groups = fbReadGroupsAtRoot();
      return { folders: ungroupedFolders, files: ungroupedFiles, pages: ungroupedPages, groups };
    }
    const last = fbNavPath[fbNavPath.length - 1];

    // Inside a group anchor — list every activity-root folder/file/page
    // tagged with that group as if they were children of the group.
    if (last.kind === "group" && last.groupId) {
      const { folders, files, pages } = fbReadPedagogyAt([], last.groupId);
      return { folders, files, pages, groups: [] };
    }

    // Inside an existing folder — show its real subfolders + files + pages.
    if (last.kind === "existing" && last.existingPath) {
      const { folders, files, pages } = fbReadPedagogyAt(last.existingPath);
      return { folders, files, pages, groups: [] };
    }

    // Inside a virtual folder added this session — nothing exists on the
    // server here yet.
    return { folders: [], files: [], pages: [], groups: [] };
  };

  /** Add files at current nav level. Same routing rules as addVirtualFolder. */
  const fbAddFilesHere = (incoming: File[]) => {
    // Same gate as the Upload Files modal — the Folder Builder is just another
    // way into the same course, so it can't accept a format the course didn't
    // enable, or a file over that type's size limit.
    const { allowed: files, blockedMessage } = partitionFiles(incoming, uploadFileRules);
    if (blockedMessage) showErrorToast(blockedMessage);
    if (!files.length) return;

    const toAdd = files.map(fbMakeVFF);

    if (fbNavPath.length === 0) {
      // Pure root — original behavior.
      setFbRootFiles(prev => {
        const existing = new Set(prev.map(f => f.file.name + f.file.size));
        return [...prev, ...toAdd.filter(f => !existing.has(f.file.name + f.file.size))];
      });
    } else if (fbAtPathKeyedLevel()) {
      // At an existing folder or group anchor — write to fbVirtualByPath.
      const key = fbCurrentPathKey();
      setFbVirtualByPath(prev => {
        const existing = new Set((prev[key]?.files ?? []).map(f => f.file.name + f.file.size));
        return {
          ...prev,
          [key]: {
            folders: prev[key]?.folders ?? [],
            files: [...(prev[key]?.files ?? []), ...toAdd.filter(f => !existing.has(f.file.name + f.file.size))],
          },
        };
      });
    } else {
      // Inside a virtual folder added at root — traverse virtualFolders tree.
      setVirtualFolders(prev => fbUpdateAtPath(prev, fbIdPath, node => {
        const existing = new Set(node.files.map(f => f.file.name + f.file.size));
        return { ...node, files: [...node.files, ...toAdd.filter(f => !existing.has(f.file.name + f.file.size))] };
      }));
    }
  };

  /** Apply a mutation to {folders, files} at the user's current FolderBuilder
   *  location. Centralises the routing so every helper below just describes
   *  WHAT to change — not WHERE the change should be written.
   *
   *  Branches:
   *    • Root (fbNavPath = [])          → virtualFolders / fbRootFiles
   *    • Existing or group anchor level → fbVirtualByPath[key]
   *    • Inside a virtual folder at root → virtualFolders tree (via id path)
   */
  const fbApplyAtCurrent = (
    updater: (folders: VirtualFolderItem[], files: VirtualFolderFile[]) =>
      { folders: VirtualFolderItem[]; files: VirtualFolderFile[] }
  ) => {
    if (fbNavPath.length === 0) {
      // Update virtualFolders + fbRootFiles in parallel.
      const next = updater(virtualFolders, fbRootFiles);
      setVirtualFolders(next.folders);
      setFbRootFiles(next.files);
      return;
    }
    if (fbAtPathKeyedLevel()) {
      const key = fbCurrentPathKey();
      setFbVirtualByPath(prev => {
        const cur = prev[key] ?? { folders: [], files: [] };
        return { ...prev, [key]: updater(cur.folders, cur.files) };
      });
      return;
    }
    setVirtualFolders(prev => fbUpdateAtPath(prev, fbIdPath, node => {
      const next = updater(node.children, node.files);
      return { ...node, children: next.folders, files: next.files };
    }));
  };

  /** Remove a file at current nav level */
  const fbRemoveFile = (fileId: string) => {
    fbApplyAtCurrent((folders, files) => ({
      folders,
      files: files.filter(f => f.id !== fileId),
    }));
  };

  /** Rename a file at current nav level */
  const fbStartRenameFile = (fileId: string) => {
    fbApplyAtCurrent((folders, files) => ({
      folders,
      files: files.map(f => f.id === fileId
        ? { ...f, isEditingName: true, editNameValue: f.displayName }
        : f),
    }));
  };
  const fbUpdateFileName = (fileId: string, val: string) => {
    fbApplyAtCurrent((folders, files) => ({
      folders,
      files: files.map(f => f.id === fileId ? { ...f, editNameValue: val } : f),
    }));
  };
  const fbCommitFileName = (fileId: string) => {
    fbApplyAtCurrent((folders, files) => ({
      folders,
      files: files.map(f => f.id === fileId
        ? { ...f, isEditingName: false, displayName: f.editNameValue.trim() || f.displayName }
        : f),
    }));
  };
  const fbCancelFileName = (fileId: string) => {
    fbApplyAtCurrent((folders, files) => ({
      folders,
      files: files.map(f => f.id === fileId ? { ...f, isEditingName: false } : f),
    }));
  };

  /** Rename a folder at current nav level */
  const fbStartRenameFolder = (folderId: string) => {
    fbApplyAtCurrent((folders, files) => ({
      folders: folders.map(f => f.id === folderId
        ? { ...f, isEditingName: true, editNameValue: f.name }
        : f),
      files,
    }));
  };
  const fbUpdateFolderName = (folderId: string, val: string) => {
    fbApplyAtCurrent((folders, files) => ({
      folders: folders.map(f => f.id === folderId ? { ...f, editNameValue: val } : f),
      files,
    }));
    // Also keep nav name in sync if this folder is currently navigated-into
    setFbNavPath(prev => prev.map(p => p.id === folderId ? { ...p, name: val } : p));
  };
  const fbCommitFolderName = (folderId: string) => {
    fbApplyAtCurrent((folders, files) => ({
      folders: folders.map(f => f.id === folderId
        ? { ...f, isEditingName: false, name: f.editNameValue.trim() || f.name }
        : f),
      files,
    }));
    setFbNavPath(prev => prev.map(p => {
      if (p.id !== folderId) return p;
      const trimmed = (p.name || "").trim();
      return trimmed ? { ...p, name: trimmed } : p;
    }));
  };
  const fbCancelFolderName = (folderId: string) =>
    fbApplyAtCurrent((folders, files) => ({
      folders: folders.map(f => f.id === folderId ? { ...f, isEditingName: false } : f),
      files,
    }));

  /** Count all folders + file-upload entries (for progress tracking) */
  const fbFlattenTree = (
    nodes: VirtualFolderItem[],
    basePath: string[],
    result: Array<{ serverPath: string[]; files: VirtualFolderFile[] }> = [],
  ) => {
    for (const n of nodes) {
      const p = [...basePath, n.name.trim()];
      result.push({ serverPath: p, files: n.files });
      fbFlattenTree(n.children, p, result);
    }
    return result;
  };

  /** Count total items for unsaved-changes check. Considers both the
   *  root virtual tree AND virtual additions stored at non-root paths. */
  const fbHasWork = (): boolean => {
    if (virtualFolders.length > 0 || fbRootFiles.length > 0) return true;
    for (const k in fbVirtualByPath) {
      const v = fbVirtualByPath[k];
      if (v && (v.folders.length > 0 || v.files.length > 0)) return true;
    }
    return false;
  };

  /** Count total deep folders + files across both stores. */
  const fbCountAll = () => {
    const countFiles = (nodes: VirtualFolderItem[]): number =>
      nodes.reduce((s, n) => s + n.files.length + countFiles(n.children), 0);
    const countFolders = (nodes: VirtualFolderItem[]): number =>
      nodes.reduce((s, n) => s + 1 + countFolders(n.children), 0);

    let folderTotal = countFolders(virtualFolders);
    let fileTotal   = countFiles(virtualFolders) + fbRootFiles.length;
    for (const k in fbVirtualByPath) {
      const v = fbVirtualByPath[k];
      if (!v) continue;
      folderTotal += countFolders(v.folders);
      fileTotal   += countFiles(v.folders) + v.files.length;
    }
    return { folders: folderTotal, files: fileTotal };
  };

  // Legacy aliases used by existing code that hasn't changed
  const toggleVFExpanded = (id: string) =>
    setVirtualFolders(prev => prev.map(vf => vf.id === id ? { ...vf, isExpanded: !vf.isExpanded } : vf));
  const startEditVFName = (id: string) =>
    setVirtualFolders(prev => prev.map(vf => vf.id === id ? { ...vf, isEditingName: true, editNameValue: vf.name } : vf));
  const updateVFName = (id: string, val: string) =>
    setVirtualFolders(prev => prev.map(vf => vf.id === id ? { ...vf, editNameValue: val } : vf));
  const commitVFName = (id: string) =>
    setVirtualFolders(prev => prev.map(vf =>
      vf.id === id ? { ...vf, isEditingName: false, name: vf.editNameValue.trim() || vf.name } : vf));
  const cancelVFNameEdit = (id: string) =>
    setVirtualFolders(prev => prev.map(vf => vf.id === id ? { ...vf, isEditingName: false } : vf));
  const setVFDragOver = (id: string, over: boolean) =>
    setVirtualFolders(prev => prev.map(vf => vf.id === id ? { ...vf, isDragOver: over } : vf));
  const addFilesToVF = (folderId: string, files: File[]) =>
    setVirtualFolders(prev => prev.map(vf => {
      if (vf.id !== folderId) return vf;
      const existing = new Set(vf.files.map(f => f.file.name + f.file.size));
      const added = files.filter(f => !existing.has(f.name + f.size)).map(fbMakeVFF);
      return { ...vf, files: [...vf.files, ...added] };
    }));
  const removeFileFromVF = (folderId: string, fileId: string) =>
    setVirtualFolders(prev => prev.map(vf =>
      vf.id === folderId ? { ...vf, files: vf.files.filter(f => f.id !== fileId) } : vf));
  const startEditVFFile = (folderId: string, fileId: string) =>
    setVirtualFolders(prev => prev.map(vf => vf.id === folderId
      ? { ...vf, files: vf.files.map(f => f.id === fileId ? { ...f, isEditingName: true, editNameValue: f.displayName } : f) } : vf));
  const updateVFFileName = (folderId: string, fileId: string, val: string) =>
    setVirtualFolders(prev => prev.map(vf => vf.id === folderId
      ? { ...vf, files: vf.files.map(f => f.id === fileId ? { ...f, editNameValue: val } : f) } : vf));
  const commitVFFileName = (folderId: string, fileId: string) =>
    setVirtualFolders(prev => prev.map(vf => vf.id === folderId
      ? { ...vf, files: vf.files.map(f => f.id === fileId ? { ...f, isEditingName: false, displayName: f.editNameValue.trim() || f.displayName } : f) } : vf));
  const cancelVFFileEdit = (folderId: string, fileId: string) =>
    setVirtualFolders(prev => prev.map(vf => vf.id === folderId
      ? { ...vf, files: vf.files.map(f => f.id === fileId ? { ...f, isEditingName: false } : f) } : vf));

  const closeFolderBuilder = (goBack = true) => {
    setShowFolderBuilderModal(false);
    if (goBack) setShowNotionModal(true);
    setVirtualFolders([]);
    setFbRootFiles([]);
    setFbNavPath([]);
    setFbVirtualByPath({}); // Phase 1: also reset per-path virtual additions
    setFolderBuilderNewName("");
    setFolderBuilderProgress({});
    setShowFolderUnsavedWarning(false);
  };

  const uploadVirtualFolders = async () => {
    if (!selectedNode || !fbHasWork()) return;
    const navState = getCurrentNavState();
    setFolderBuilderUploading(true);

    // Helper: upload a batch of files to a server path
    const uploadFileBatch = async (files: VirtualFolderFile[], serverPath: string[], progressKey: string) => {
      if (!files.length) return;
      const fd = new FormData();
      if (selectedNode.originalData) {
        fd.append("courses", selectedNode.originalData.courses || "");
        fd.append("topicId", selectedNode.originalData.topicId || "");
        fd.append("index", String(selectedNode.originalData.index || 0));
        fd.append("title", selectedNode.originalData.title || "");
      }
      fd.append("tabType", toBackendTab(activeTab));
      fd.append("subcategory", activeSubcategory);
      fd.append("isUpdate", "false");
      fd.append("showToStudents", "true");
      fd.append("allowDownload", "true");
      const fp = serverPath.join("/");
      if (fp) fd.append("folderPath", fp);
      // Tag uploads with the group context when the FolderBuilder was
      // opened via "+ Add resource to this group". Root-level files end
      // up rendered inside the group row via Coursecontent's grouping
      // logic; folder-nested files inherit their parent folder's group
      // anyway so the extra tag is a no-op there.
      if (uploadGroupId) fd.append("groupId", uploadGroupId);
      if (uploadGroupName) fd.append("groupName", uploadGroupName);
      files.forEach(({ file, displayName }) => {
        const ext = file.name.includes('.') ? '.' + file.name.split('.').pop() : '';
        const base = displayName.trim() || (file.name.includes('.') ? file.name.slice(0, file.name.lastIndexOf('.')) : file.name);
        const finalName = base + ext;
        const renamed = finalName !== file.name ? new window.File([file], finalName, { type: file.type }) : file;
        fd.append("files", renamed);
      });
      await entityApi.updateEntity(
        selectedNode.type as any, selectedNode.id, fd,
        (evt: any) => {
          if (evt?.total) {
            const pct = Math.min(Math.round((evt.loaded / evt.total) * 100), 98);
            setFolderBuilderProgress(prev => ({ ...prev, [progressKey]: pct }));
          }
        },
      );
      setFolderBuilderProgress(prev => ({ ...prev, [progressKey]: 100 }));
    };

    try {
      // 1️⃣  Upload root-level files (no folder needed)
      if (fbRootFiles.length > 0) {
        await uploadFileBatch(fbRootFiles, navState.currentFolderPath, "__root__");
      }

      // 2️⃣  Flatten tree → create each folder then upload its files
      const flat = fbFlattenTree(virtualFolders, navState.currentFolderPath);
      const initProgress: Record<string, number> = { __root__: 0 };
      flat.forEach((_, i) => { initProgress[`flat-${i}`] = 0; });
      setFolderBuilderProgress(initProgress);

      for (let i = 0; i < flat.length; i++) {
        const { serverPath, files } = flat[i];
        const folderName = serverPath[serverPath.length - 1];
        const parentPath = serverPath.slice(0, -1);
        try {
          // Pass through the group context so the new folder is tagged
          // with parentGroupId on the server when the FolderBuilder was
          // opened via a group's "+ Add resource" action. Top-level group
          // folders only — nested folders inside an existing folder don't
          // need parentGroupId (they inherit context from their parent).
          const isTopLevel = parentPath.length === 0;
          await createFolderWithName(
            folderName,
            parentPath,
            (isTopLevel && uploadGroupId)
              ? { parentGroupId: uploadGroupId, groupName: uploadGroupName }
              : undefined,
          );
          if (files.length > 0) {
            await uploadFileBatch(files, serverPath, `flat-${i}`);
          } else {
            setFolderBuilderProgress(prev => ({ ...prev, [`flat-${i}`]: 100 }));
          }
        } catch {
          showErrorToast(`Failed to create/upload "${folderName}"`);
        }
      }

      // 3️⃣  Upload virtual additions stored at non-root paths.
      //
      //     fbVirtualByPath holds the work the user did while standing
      //     inside an existing folder, a group anchor, or any descendant
      //     of those. The key encodes the path:
      //         "<groupName>#<seg1>/<seg2>/..."   (group-scoped)
      //         "<seg1>/<seg2>/..."                (no group)
      //         "<groupName>#"                     (group root, no segments)
      //
      //     We resolve the groupName back to a groupId by scanning the
      //     activity-root pedagogy state, then upload each addition at
      //     its correct server folderPath.
      const groupIdByName = new Map<string, string>();
      fbReadGroupsAtRoot().forEach(g => groupIdByName.set(g.groupName, g.groupId));

      const byPathEntries = Object.entries(fbVirtualByPath).filter(([, v]) =>
        v && (v.folders.length > 0 || v.files.length > 0)
      );
      for (const [pathKey, additions] of byPathEntries) {
        const hashIdx = pathKey.indexOf("#");
        const groupPrefix = hashIdx >= 0 ? pathKey.slice(0, hashIdx) : "";
        const segmentsStr = hashIdx >= 0 ? pathKey.slice(hashIdx + 1) : pathKey;
        const basePath = segmentsStr ? segmentsStr.split("/").filter(Boolean) : [];
        const groupId = groupPrefix ? groupIdByName.get(groupPrefix) : undefined;
        // Combine the activity's current nav prefix (if any) with this key's
        // basePath. In practice the picker resets currentFolderPath to [] when
        // a group is in scope, but we honour it here for robustness.
        const serverBase = [...navState.currentFolderPath, ...basePath];

        // (a) loose files at this path
        if (additions.files.length > 0) {
          const progKey = `byPath-${pathKey}-files`;
          setFolderBuilderProgress(prev => ({ ...prev, [progKey]: 0 }));
          // Pass groupId via formData on the file uploads when relevant.
          // The existing uploadFileBatch closure reads uploadGroupId from
          // closure scope — but here we want THIS key's group, not whatever
          // uploadGroupId currently is. For now, only tag with groupId when
          // basePath is empty (files dropped at group root).
          await uploadFileBatch(additions.files, serverBase, progKey);
        }

        // (b) folder tree at this path
        const flatByPath = fbFlattenTree(additions.folders, serverBase);
        for (let i = 0; i < flatByPath.length; i++) {
          const { serverPath, files: ffiles } = flatByPath[i];
          const folderName = serverPath[serverPath.length - 1];
          const parentPath = serverPath.slice(0, -1);
          try {
            // Tag with parentGroupId only when this folder is being created
            // at the group's root level (parent path equals serverBase and
            // serverBase reaches the group root itself, i.e. basePath = []).
            const isGroupRoot = groupId && basePath.length === 0 && parentPath.length === navState.currentFolderPath.length;
            await createFolderWithName(
              folderName,
              parentPath,
              isGroupRoot
                ? { parentGroupId: groupId, groupName: groupPrefix }
                : undefined,
            );
            const progKey = `byPath-${pathKey}-flat-${i}`;
            if (ffiles.length > 0) {
              setFolderBuilderProgress(prev => ({ ...prev, [progKey]: 0 }));
              await uploadFileBatch(ffiles, serverPath, progKey);
            } else {
              setFolderBuilderProgress(prev => ({ ...prev, [progKey]: 100 }));
            }
          } catch {
            showErrorToast(`Failed to create/upload "${folderName}"`);
          }
        }
      }

      await fetchAndRefresh(selectedNode);
      const { folders, files } = fbCountAll();
      closeFolderBuilder(false);
      showSuccessToast(`${folders} folder${folders !== 1 ? 's' : ''} · ${files} file${files !== 1 ? 's' : ''} created!`);
    } finally {
      setFolderBuilderUploading(false);
    }
  };

  const saveEditFolder = async () => {
    if (!editingFolder || !editFolderName.trim() || !selectedNode) return;
    try {
      const navState = getCurrentNavState();
      const response = await entityApi.updateFolder(
        selectedNode.type as any,
        selectedNode.id,
        {
          tabType: toBackendTab(activeTab),
          subcategory: activeSubcategory,
          folderName: editFolderName.trim(),
          folderPath: navState.currentFolderPath.join("/"),
          originalFolderName: editingFolder.name,
          courses: selectedNode.originalData?.courses || "",
          topicId: selectedNode.originalData?.topicId || "",
          action: "updateFolder",
          tags: folderTags.map((t) => ({ tagName: t.tagName, tagColor: t.tagColor })) // ← ADD THIS
        }
      );
      await fetchAndRefresh(selectedNode);
      setShowCreateFolderModal(false);
      setEditingFolder(null);
      setEditFolderName("");
      setFolderTags([]);
      showSuccessToast("Updated successfully");
    } catch {
      showErrorToast("Failed to update folder");
      await refreshContentData(selectedNode);
    }
  };

  // deleteFolder — replace both refresh calls
  const deleteFolder = async (folder: FolderItem) => {
    if (!selectedNode) return;
    setIsDeleting(true);
    try {
      const pathParts = (folder.folderPath || folder.name).split("/").filter(Boolean);
      const folderName = pathParts.pop();
      await entityApi.deleteFolder(selectedNode.type as any, selectedNode.id, {
        tabType: toBackendTab(activeTab),
        subcategory: activeSubcategory,
        folderName: folderName || "",
        folderPath: pathParts.join("/"),
        courses: selectedNode.originalData?.courses || "",
        action: "deleteFolder",
      });
      await fetchAndRefresh(selectedNode);       // ← server fetch first
      setShowDeleteConfirm(false);
      setDeleteTarget(null);
      showSuccessToast(`Folder "${folder.name}" deleted!`);
    } catch {
      showErrorToast("Failed to delete folder");
      await fetchAndRefresh(selectedNode);
    } finally {
      setIsDeleting(false);
    }
  };

  // deleteFile — replace refresh call
  const deleteFile = async (fileId: string) => {
    if (!selectedNode) return;
    setIsDeleting(true);
    try {
      const navState = getCurrentNavState();
      await entityApi.deleteFile(selectedNode.type as any, selectedNode.id, {
        tabType: toBackendTab(activeTab),
        subcategory: activeSubcategory,
        folderPath: navState.currentFolderPath.join("/"),
        action: "deleteFile",
        updateFileId: fileId,
      });
      await fetchAndRefresh(selectedNode);       // ← server fetch first
      setShowDeleteConfirm(false);
      setDeleteTarget(null);
      showSuccessToast("File deleted!");
    } catch {
      showErrorToast("Failed to delete file");
    } finally {
      setIsDeleting(false);
    }
  };

  // handleDeletePage — replace refresh call


  const resetUploadModalStates = () => {
    setShowUploadModal(false);
    setSelectedFileType("");
    setUploadingFiles([]);
    setUpdateFileId(null);
    setFileNames({});
    setSelectedFiles([]);
    setUploadDescription("");
    setUploadTags([]);
    setUploadCurrentTag("");
    setUploadTagColor("#FB923C");
    setUploadAccessLevel("private");
    setFolderUrl("");
    setUrlFileName("");
    setUrlFileType("url/link");
    setIsButtonLoading(false);
    setText("");
    setFileDisplayNames({});
    setReferenceDisplayName("Reference Material"); // ← add this
  };
  const handleFileSelection = (rawFiles: FileList | null) => {
    if (!rawFiles?.length) return;

    // This modal is scoped to one chosen type, so it validates against that
    // type alone — picking "PDF" and dropping a .mp4 is wrong even when the
    // course also enabled Video, and a 3.5 MB file is wrong when PDF is capped
    // at 3 MB. Types with no format rule (reference, which accepts anything)
    // pass through untouched.
    let files: File[] = Array.from(rawFiles);
    if (TYPE_FILE_RULES[selectedFileType]) {
      const rules = buildAllowedRules([selectedFileType], uploadMaxSizeByType);
      const { allowed, blockedMessage } = partitionFiles(files, rules);
      if (blockedMessage) showErrorToast(blockedMessage);
      if (!allowed.length) return;
      files = allowed;
    }

    if (updateFileId) {
      // UPDATE MODE — replace existing selection with new file
      const existingFileName = fileDisplayNames[updateFileId] || "";

      setSelectedFiles([]);
      setUploadingFiles([]);

      const newDisplay: Record<string, string> = {};
      const newSelectedFiles = Array.from(files);

      newSelectedFiles.forEach((f) => {
        newDisplay[f.name] = existingFileName || (selectedFileType === "reference" ? (referenceDisplayName.trim() || "Reference Material") : f.name);
      });

      setFileDisplayNames({ ...newDisplay });
      setSelectedFiles(newSelectedFiles);

      const newUploadingFiles: UploadedFile[] = newSelectedFiles.map((f, i) => ({
        id: `${Date.now()}-${i}-${Math.random()}`,
        name: newDisplay[f.name] || f.name,
        progress: 0,
        status: "preparing" as const,
        subcategory: activeSubcategory,
        folderId: getCurrentNavState().currentFolderId,
        type: f.type || "unknown",
        size: f.size,
        url: "",
        uploadedAt: new Date(),
        tags: [],
        folderPath: getCurrentNavState().currentFolderPath.join("/"),
        isReference: selectedFileType === "reference",
        isVideo: f.type.startsWith("video/"),
      }));

      setUploadingFiles(newUploadingFiles);

      newUploadingFiles.forEach((u) => {
        let p = 0;
        const interval = setInterval(() => {
          p += 10;
          if (p < 100) {
            setUploadingFiles((prev) =>
              prev.map((f) =>
                f.id === u.id ? { ...f, progress: p, status: "uploading" } : f
              )
            );
          } else {
            clearInterval(interval);
            setUploadingFiles((prev) =>
              prev.map((f) =>
                f.id === u.id ? { ...f, progress: 100, status: "ready" } : f
              )
            );
          }
        }, 100);
      });

    } else {
      // NEW FILE MODE — allow multiple files
      const newDisplay: Record<string, string> = {};
      const newSelectedFiles = Array.from(files);

      newSelectedFiles.forEach((f) => {
        if (selectedFileType === "reference") {
          // Carry over the pre-typed reference name; append original extension
          const ext = f.name.includes(".") ? "." + f.name.split(".").pop() : "";
          const baseName = referenceDisplayName.trim() || "Reference Material";
          newDisplay[f.name] = baseName + ext;
        } else {
          newDisplay[f.name] = f.name;
        }
      });

      setFileDisplayNames((prev) => ({ ...prev, ...newDisplay }));
      setSelectedFiles(newSelectedFiles);

      const newUploadingFiles: UploadedFile[] = newSelectedFiles.map((f, i) => ({
        id: `${Date.now()}-${i}`,
        name: newDisplay[f.name] || f.name,
        progress: 0,
        status: "preparing" as const,
        subcategory: activeSubcategory,
        folderId: getCurrentNavState().currentFolderId,
        type: f.type || "unknown",
        size: f.size,
        url: "",
        uploadedAt: new Date(),
        tags: [],
        folderPath: getCurrentNavState().currentFolderPath.join("/"),
        isReference: selectedFileType === "reference",
        isVideo: f.type.startsWith("video/"),
      }));

      setUploadingFiles((prev) => [...prev, ...newUploadingFiles]);

      newUploadingFiles.forEach((u) => {
        let p = 0;
        const interval = setInterval(() => {
          p += 10;
          if (p < 100) {
            setUploadingFiles((prev) =>
              prev.map((f) =>
                f.id === u.id ? { ...f, progress: p, status: "uploading" } : f
              )
            );
          } else {
            clearInterval(interval);
            setUploadingFiles((prev) =>
              prev.map((f) =>
                f.id === u.id ? { ...f, progress: 100, status: "ready" } : f
              )
            );
          }
        }, 100);
      });
    }
  };
  // Add this useEffect to reset file input when selections are cleared
  useEffect(() => {
    if (uploadingFiles.length === 0 && fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [uploadingFiles]);
  const handleFileUpload = async (files: FileList | null, tabType: "I_Do" | "We_Do" | "You_Do" | null, subcategory: string) => {
    if (!files || !selectedNode) return;

    const navState = getCurrentNavState();
    const formData = new FormData();

    // Add hierarchy info
    if (selectedNode.originalData) {
      formData.append("courses", selectedNode.originalData.courses || "");
      formData.append("topicId", selectedNode.originalData.topicId || "");
      formData.append("index", String(selectedNode.originalData.index || 0));
      formData.append("title", selectedNode.originalData.title || "");
    }

    // Add file type
    if (selectedFileType) formData.append("selectedFileType", selectedFileType);

    // Add file settings
    const fileId = updateFileId || "temp";
    const fSettings = documentSettings[fileId];
    formData.append("showToStudents", fSettings ? String(fSettings.studentShow) : "true");
    formData.append("allowDownload", fSettings ? String(fSettings.downloadAllow) : "true");

    // Add files
    Array.from(files).forEach((f) => formData.append("files", f));

    // Add tab and subcategory info
    formData.append("tabType", toBackendTab(tabType));
    formData.append("subcategory", subcategory);

    // Add folder path
    const fp = navState.currentFolderPath.join("/");
    if (fp) formData.append("folderPath", fp);

    // Add tags and description
    const validTags = uploadTags.filter(t => t.tagName && t.tagName.trim());
    if (validTags.length) formData.append("tags", JSON.stringify(validTags));
    if (uploadDescription) formData.append("fileDescription", uploadDescription);

    formData.append("isUpdate", "false");

    // Carry the group context (set when the picker was opened via a group
    // row's "+ Add resource to this group" button) through to the server so
    // Reference / generic file uploads via this inline UploadModal land
    // inside the group instead of at activity root.
    if (uploadGroupId)   formData.append("groupId", uploadGroupId);
    if (uploadGroupName) formData.append("groupName", uploadGroupName);

    try {
      const response = await entityApi.updateEntity(selectedNode.type as any, selectedNode.id, formData);
      if (response.data) {
        setUploadingFiles((prev) => prev.map((f) => f.status === "uploading" ? { ...f, status: "completed", progress: 100 } : f));
        await fetchAndRefresh(selectedNode);
        setUploadingFiles([]);
        resetUploadModalStates();
        showSuccessToast("Upload completed!");
      }
    } catch (err: any) {
      setUploadingFiles((prev) => prev.map((f) => f.status === "uploading" ? { ...f, status: "error" } : f));
      setIsButtonLoading(false);
      const _msg = axios.isAxiosError(err) ? (typeof err.response?.data?.message === "string" ? err.response?.data?.message : JSON.stringify(err.response?.data ?? err.message)) : (err?.message || String(err));
      showErrorToast(`Upload failed: ${_msg}`);
    }
  };

  // Drain any pending "remove existing file" AND "remove existing folder"
  // actions queued by the modal's X buttons. Files first (so individual file
  // deletes succeed before any cascading folder delete touches them), then
  // folders (which cascade-delete contents on the server). Errors are swallowed
  // per-entry so a single failure can't block the rest of the save.
  const processPendingDeletions = async (modalBasePath: string[]) => {
    if (!selectedNode) return;

    // ── File deletions ─────────────────────────────────────────────────────
    const filesPending = editPendingDeletionsRef.current;
    for (const del of filesPending) {
      if (!del.fileId) continue;
      const absPath = [...modalBasePath, ...del.path].filter(Boolean).join("/");
      try {
        await entityApi.deleteFile(selectedNode.type as any, selectedNode.id, {
          tabType: toBackendTab(activeTab),
          subcategory: activeSubcategory,
          folderPath: absPath,
          action: "deleteFile",
          updateFileId: del.fileId,
        });
      } catch {
        // continue with the remaining deletions
      }
    }
    editPendingDeletionsRef.current = [];

    // ── Folder deletions (cascade on server) ───────────────────────────────
    const foldersPending = editPendingFolderDeletionsRef.current;
    for (const del of foldersPending) {
      // For folders: del.path is the folder's PARENT path (matching the
      // signature of the modal's deleteFolderAtPath helper). Build the
      // absolute parent path the same way file deletions do.
      const absParentPath = [...modalBasePath, ...del.path].filter(Boolean).join("/");
      try {
        await entityApi.deleteFolder(selectedNode.type as any, selectedNode.id, {
          tabType: toBackendTab(activeTab),
          subcategory: activeSubcategory,
          folderName: del.name,
          folderPath: absParentPath,
          courses: selectedNode.originalData?.courses || "",
          action: "deleteFolder",
        });
      } catch {
        // continue with the remaining deletions
      }
    }
    editPendingFolderDeletionsRef.current = [];
  };

  const handleFileUploadModalSubmit = async (
    incomingFiles: File[],
    groupName: string,
    description: string,
    targetFolderPath?: string[],
    onProgress?: (pct: number) => void,
    options?: UploadOptions,
  ) => {
    if (!selectedNode) return;

    // Path that represents the modal's working root on the server. For folder
    // edit this is forced to the folder being edited so deletions/uploads
    // resolve to the right server location.
    const modalBasePath = uploadModalForcedPath ?? getCurrentNavState().currentFolderPath;

    // ── EDIT MODE: file update (opened via "Update" on a file row) ─────────────
    if (updateFileId) {
      // Special case: the user removed the existing file with X and didn't
      // drop a replacement → treat as a pure delete of the resource.
      const pending = editPendingDeletionsRef.current;
      const fileWasRemoved = pending.some(p => p.fileId === updateFileId);
      if (fileWasRemoved && incomingFiles.length === 0) {
        try {
          await entityApi.deleteFile(selectedNode.type as any, selectedNode.id, {
            tabType: toBackendTab(updateTabType),
            subcategory: updateSubcategory,
            folderPath: modalBasePath.join("/"),
            action: "deleteFile",
            updateFileId,
          });
          await fetchAndRefresh(selectedNode);
          showSuccessToast("File deleted!");
        } catch (err: any) {
          const msg = axios.isAxiosError(err)
            ? (typeof err.response?.data?.message === "string" ? err.response?.data?.message : JSON.stringify(err.response?.data ?? err.message))
            : (err?.message || String(err));
          showErrorToast(`Delete failed: ${msg}`);
        }
        setUpdateFileId(null);
        clearUploadModalEditState();
        return;
      }
      const navState = getCurrentNavState();
      const formData = new FormData();
      if (selectedNode?.originalData) {
        formData.append("courses", selectedNode.originalData.courses || "");
        formData.append("topicId", selectedNode.originalData.topicId || "");
        formData.append("index", String(selectedNode.originalData.index || 0));
        formData.append("title", selectedNode.originalData.title || "");
      }
      formData.append("tabType", toBackendTab(updateTabType));
      formData.append("subcategory", updateSubcategory);
      formData.append("isUpdate", "true");
      formData.append("updateFileId", updateFileId);
      const isMetaOnly = incomingFiles.length === 0;
      formData.append("metadataOnly", String(isMetaOnly));
      if (incomingFiles.length > 0) {
        // Build replacement file with the user-entered name
        const f = incomingFiles[0];
        const newBaseName = (groupName || f.name).replace(/\.[^/.]+$/, "");
        const ext = f.name.includes(".") ? "." + f.name.split(".").pop() : "";
        const finalName = newBaseName + ext;
        const outFile = finalName !== f.name ? new window.File([f], finalName, { type: f.type }) : f;
        formData.append("files", outFile);
        formData.append("updateFileName", finalName);
      } else {
        formData.append("updateFileName", groupName.trim());
      }
      const fShow = options?.showToStudent ?? true;
      const fDl   = options?.allowDownload ?? false;
      formData.append("showToStudents", String(fShow));
      formData.append("allowDownload", String(fDl));
      const fp = navState.currentFolderPath.join("/");
      if (fp) formData.append("folderPath", fp);
      if (description) formData.append("fileDescription", description);
      try {
        await entityApi.updateEntity(
          selectedNode.type as any, selectedNode.id, formData,
          onProgress ? (evt) => { if (evt.total) onProgress(Math.min(Math.round((evt.loaded / evt.total) * 100), 98)); } : undefined,
        );
        onProgress?.(100);
        await fetchAndRefresh(selectedNode);
        showSuccessToast(isMetaOnly ? "File updated!" : "File replaced successfully!");
      } catch (err: any) {
        const msg = axios.isAxiosError(err)
          ? (typeof err.response?.data?.message === "string" ? err.response?.data?.message : JSON.stringify(err.response?.data ?? err.message))
          : (err?.message || String(err));
        showErrorToast(`Update failed: ${msg}`);
      }
      setUpdateFileId(null);
      clearUploadModalEditState();
      return;
    }

    // ── EDIT MODE: folder rename + deletions + optional new files ─────────────
    if (editingFolder && uploadModalEditMode) {
      const navState = getCurrentNavState();
      const newName = groupName.trim();
      // 1. Rename the folder if the name changed (rename uses the folder's
      //    parent path, which is the page's nav state — NOT modalBasePath which
      //    points at the folder itself).
      if (newName && newName !== editingFolder.name) {
        try {
          await entityApi.updateFolder(
            selectedNode.type as any,
            selectedNode.id,
            {
              tabType: toBackendTab(activeTab),
              subcategory: activeSubcategory,
              folderName: newName,
              folderPath: navState.currentFolderPath.join("/"),
              originalFolderName: editingFolder.name,
              courses: selectedNode.originalData?.courses,
              topicId: selectedNode.originalData?.topicId,
              index: selectedNode.originalData?.index,
              title: selectedNode.originalData?.title,
            },
          );
        } catch (err: any) {
          showErrorToast(`Rename failed: ${axios.isAxiosError(err) ? err.response?.data?.message : err.message}`);
        }
      }
      // 2. Apply any pending deletions of files inside this folder.
      await processPendingDeletions(modalBasePath);
      // 3. If the user didn't add any new files, we're done — refresh and close.
      if (incomingFiles.length === 0) {
        await fetchAndRefresh(selectedNode);
        setEditingFolder(null);
        clearUploadModalEditState();
        showSuccessToast("Folder updated!");
        return;
      }
      // 4. Otherwise fall through to the upload logic below, which will push
      //    the new files to the folder (modal already resolved their server path).
      setEditingFolder(null);
      clearUploadModalEditState();
    }

    // ── EDIT MODE: group edit OR plain "save with no new content" ─────────────
    // When we get here in edit mode (editMode true, not a single-file edit, no
    // editingFolder), the user is editing a group. We still need to flush any
    // pending deletions even if no new files are being uploaded.
    if (uploadModalEditMode && !editingFolder && !updateFileId) {
      const hadDeletions =
        editPendingDeletionsRef.current.length > 0 ||
        editPendingFolderDeletionsRef.current.length > 0;
      await processPendingDeletions(modalBasePath);
      if (incomingFiles.length === 0) {
        if (hadDeletions) {
          await fetchAndRefresh(selectedNode);
          showSuccessToast("Saved!");
        }
        clearUploadModalEditState();
        return;
      }
      // Has new files → fall through to add-to-group flow below.
    }

    // ── CREATE / ADD TO GROUP mode ─────────────────────────────────────────────
    if (!incomingFiles.length) return;
    // Use the targetFolderPath from the modal's navigation; fall back to page nav state
    const resolvedPath = targetFolderPath ?? getCurrentNavState().currentFolderPath;
    const isGroup = incomingFiles.length > 1;
    // The modal is the sole authority on group membership. If it didn't pass parentGroupId,
    // the files are NOT part of any group (e.g. nested files inside a folder, or single-file uploads).
    const groupId = options?.parentGroupId;

    // Rename each file to carry the user-typed name (single file only)
    const renamed = incomingFiles.map((f) => {
      if (!isGroup && groupName) {
        const ext = f.name.includes(".") ? "." + f.name.split(".").pop() : "";
        // Strip any extension the user may have typed in groupName to avoid doubling (e.g. "file.docx" + ".docx")
        const baseName = groupName.includes(".")
          ? groupName.slice(0, groupName.lastIndexOf("."))
          : groupName;
        const finalName = baseName + ext;
        return finalName !== f.name ? new window.File([f], finalName, { type: f.type }) : f;
      }
      return f;
    });

    const formData = new FormData();
    if (selectedNode.originalData) {
      formData.append("courses", selectedNode.originalData.courses || "");
      formData.append("topicId", selectedNode.originalData.topicId || "");
      formData.append("index", String(selectedNode.originalData.index || 0));
      formData.append("title", selectedNode.originalData.title || "");
    }
    formData.append("tabType", toBackendTab(activeTab));
    formData.append("subcategory", activeSubcategory);
    formData.append("isUpdate", "false");
    formData.append("showToStudents", String(options?.showToStudent ?? true));
    formData.append("allowDownload", String(options?.allowDownload ?? false));
    if (options?.createdAt) formData.append("createdAt", options.createdAt);
    if (description) formData.append("fileDescription", description);
    if (groupId) formData.append("groupId", groupId);
    if (options?.outerGroupId) formData.append("parentGroupId", options.outerGroupId);
    // groupName for DB: use options.groupName (set for new groups only; undefined for existing groups)
    if (options?.groupName) formData.append("groupName", options.groupName);
    const fp = resolvedPath.join("/");
    if (fp) formData.append("folderPath", fp);
    renamed.forEach(f => formData.append("files", f));

    try {
      const response = await entityApi.updateEntity(
        selectedNode.type as any,
        selectedNode.id,
        formData,
        onProgress
          ? (evt) => {
            if (evt.total) {
              const pct = Math.min(Math.round((evt.loaded / evt.total) * 100), 98);
              onProgress(pct);
            }
          }
          : undefined,
      );
      if (response.data) {
        onProgress?.(100);
        await fetchAndRefresh(selectedNode);
        // No success toast here — the modal already showed a single optimistic toast before closing.
      }
    } catch (err: any) {
      const msg = axios.isAxiosError(err)
        ? (typeof err.response?.data?.message === "string" ? err.response?.data?.message : JSON.stringify(err.response?.data ?? err.message))
        : (err?.message || String(err));
      showErrorToast(`Upload failed: ${msg}`);
    }
  };

  const buildFullHierarchyInfo = useCallback((): HierarchyInfo | undefined => {
    if (!selectedNode || !courseData.length) return undefined;
    const findNodePath = (nodes: CourseNode[], targetId: string, path: CourseNode[] = []): CourseNode[] | null => { for (const node of nodes) { if (node.id === targetId) return [...path, node]; if (node.children?.length) { const found = findNodePath(node.children, targetId, [...path, node]); if (found) return found; } } return null; };
    const path = findNodePath(courseData, selectedNode.id) ?? [selectedNode];
    const navState = getCurrentNavState();
    const courseNode = path.find((n) => n.type === "course"); const moduleNode = path.find((n) => n.type === "module"); const submoduleNode = path.find((n) => n.type === "submodule"); const topicNode = path.find((n) => n.type === "topic"); const subtopicNode = path.find((n) => n.type === "subtopic");
    return {
      courseId: courseNode?.id ?? courseData[0]?.id ?? "",
      courseName: courseNode?.name ?? courseStructureResponse?.data?.courseName ?? "",
      moduleId: moduleNode?.id, moduleName: moduleNode?.name,
      subModuleId: submoduleNode?.id, subModuleName: submoduleNode?.name,
      topicId: topicNode?.id, topicName: topicNode?.name,
      subTopicId: subtopicNode?.id, subTopicName: subtopicNode?.name,
      tabType: activeTab ?? undefined,
      subcategory: activeSubcategory || undefined,
      folderPath: navState.currentFolderPath.length > 0 ? navState.currentFolderPath : undefined,
      folderId: navState.currentFolderId ?? undefined,
      nodeType: selectedNode.type,
      // Group context — populated when the picker was opened from a group's
      // "Add" action. Carries through to entityApi.createPage so the new
      // page is attached to that group instead of the activity root.
      groupId: uploadGroupId,
      groupName: uploadGroupName,
    };
  }, [selectedNode, courseData, courseStructureResponse, activeTab, activeSubcategory, getCurrentNavState, uploadGroupId, uploadGroupName]);

  /**
   * Build a plain top-to-bottom display breadcrumb for the resource-creation
   * modals (NotionResourceModal / PageCreationModal / URL+Reference upload
   * modal). Shape:
   *
   *   Course > Module > [SubModule] > [Topic] > [SubTopic] > Tab > Subcategory
   *          > [Group]  > [folder] > [subfolder] > ...
   *
   * All segments are display-only here — clicks are wired up only in the
   * FolderBuilder modal's own breadcrumb (which has its own builder).
   */
  const buildFullPathCrumbs = useCallback((): Array<{ label: string }> => {
    const hi = buildFullHierarchyInfo();
    if (!hi) return [];
    const out: Array<{ label: string }> = [];
    if (hi.courseName)    out.push({ label: hi.courseName });
    if (hi.moduleName)    out.push({ label: hi.moduleName });
    if (hi.subModuleName) out.push({ label: hi.subModuleName });
    if (hi.topicName)     out.push({ label: hi.topicName });
    if (hi.subTopicName)  out.push({ label: hi.subTopicName });
    if (hi.tabType)       out.push({ label: hi.tabType.replace(/_/g, " ") });
    if (hi.subcategory)   out.push({ label: hi.subcategory });
    if (uploadGroupName)  out.push({ label: uploadGroupName });
    const navState = getCurrentNavState();
    (navState.currentFolderPath ?? []).forEach(seg => {
      if (seg) out.push({ label: seg });
    });
    return out;
  }, [buildFullHierarchyInfo, uploadGroupName, getCurrentNavState]);

  const handleFileUpdate = async (files: FileList | null) => {
    // If no files selected and we're in update mode, update metadata only
    if ((!files || files.length === 0) && updateFileId) {
      const navState = getCurrentNavState();
      const formData = new FormData();

      // Add hierarchy info
      if (selectedNode?.originalData) {
        formData.append("courses", selectedNode.originalData.courses || "");
        formData.append("topicId", selectedNode.originalData.topicId || "");
        formData.append("index", String(selectedNode.originalData.index || 0));
        formData.append("title", selectedNode.originalData.title || "");
      }

      // Add update metadata
      formData.append("tabType", toBackendTab(updateTabType));
      formData.append("subcategory", updateSubcategory);
      formData.append("isUpdate", "true");
      formData.append("updateFileId", updateFileId);
      formData.append("updateFileName", fileDisplayNames[updateFileId] || "");
      formData.append("metadataOnly", "true"); // Flag to indicate metadata-only update

      // Add file settings
      const fSettings = documentSettings[updateFileId] || { studentShow: true, downloadAllow: true };
      formData.append("showToStudents", String(fSettings.studentShow));
      formData.append("allowDownload", String(fSettings.downloadAllow));

      // Add folder path
      const fp = navState.currentFolderPath.join("/");
      if (fp) formData.append("folderPath", fp);

      // Add tags and description
      if (uploadTags.length) formData.append("tags", JSON.stringify(uploadTags));
      if (uploadDescription) formData.append("fileDescription", uploadDescription); // Make sure this is sent

      try {
        const response = await entityApi.updateEntity(selectedNode.type as any, selectedNode.id, formData);
        await fetchAndRefresh(selectedNode);
        setUploadingFiles([]);
        resetUploadModalStates();
        showSuccessToast("File metadata updated successfully!");
        setIsButtonLoading(false);
      } catch (err: any) {
        setIsButtonLoading(false);
        showErrorToast(`Update failed: ${axios.isAxiosError(err) ? err.response?.data?.message : err.message}`);
      }
      return;
    }


    // If files are selected, proceed with file content update
    if (!files || !selectedNode || !updateFileId || files.length !== 1) {
      if (updateFileId) {
        setIsButtonLoading(false);
        showErrorToast("Please select a file to update");
      }
      return;
    }

    const file = files[0];
    const navState = getCurrentNavState();
    const formData = new FormData();

    // Add hierarchy info
    if (selectedNode.originalData) {
      formData.append("courses", selectedNode.originalData.courses || "");
      formData.append("topicId", selectedNode.originalData.topicId || "");
      formData.append("index", String(selectedNode.originalData.index || 0));
      formData.append("title", selectedNode.originalData.title || "");
    }

    // Add file and update info
    formData.append("files", file);
    formData.append("tabType", toBackendTab(updateTabType));
    formData.append("subcategory", updateSubcategory);
    formData.append("isUpdate", "true");
    formData.append("updateFileId", updateFileId);
    formData.append("updateFileName", fileDisplayNames[updateFileId] || "");
    formData.append("metadataOnly", "false");

    // Add file settings
    const fSettings = documentSettings[updateFileId] || { studentShow: true, downloadAllow: true };
    formData.append("showToStudents", String(fSettings.studentShow));
    formData.append("allowDownload", String(fSettings.downloadAllow));

    // Add folder path
    const fp = navState.currentFolderPath.join("/");
    if (fp) formData.append("folderPath", fp);

    // Add tags and description
    if (uploadTags.length) formData.append("tags", JSON.stringify(uploadTags));
    if (uploadDescription) formData.append("fileDescription", uploadDescription);

    try {
      const response = await entityApi.updateEntity(selectedNode.type as any, selectedNode.id, formData);
      await fetchAndRefresh(selectedNode);
      setUploadingFiles([]);
      resetUploadModalStates();
      showSuccessToast("File updated successfully!");
      setIsButtonLoading(false);
    } catch (err: any) {
      setIsButtonLoading(false);
      showErrorToast(`Update failed: ${axios.isAxiosError(err) ? err.response?.data?.message : err.message}`);
    }
  };

  const initiateFileUpdate = (file: UploadedFile, tabType: "I_Do" | "We_Do" | "You_Do", subcategory: string) => {
    setUpdateFileId(file.id);
    setUpdateTabType(tabType);
    setUpdateSubcategory(subcategory);

    // Open FileUploadModal pre-filled with the file's existing data
    setUploadModalEditMode(true);
    setUploadModalInitialName(file.name || "");
    setUploadModalInitialDesc(file.description || "");
    setUploadModalInitialShow(file.fileSettings?.showToStudents ?? true);
    setUploadModalInitialDl(file.fileSettings?.allowDownload ?? false);

    // Seed the existing file as a single row in the modal explorer. Path is
    // empty because for single-file edit the modal's currentFolderPath already
    // resolves to the file's parent (the page's nav state at the time Edit was clicked).
    const filePath: string[] = [];
    setUploadModalInitialFiles([{ name: file.name || "", size: file.size, path: filePath }]);
    setUploadModalInitialFolders([]);
    // Track the fileId so onDeleteFile can route to the right server delete.
    editExistingFileIdMapRef.current = {
      [`${file.name || ""}::${filePath.join("/")}`]: file.id,
    };
    editPendingDeletionsRef.current = [];
    editPendingFolderDeletionsRef.current = [];

    setShowFileUploadModal(true);
  };
  useEffect(() => {
    if (showUploadModal && uploadDescription) {
      // Force a small delay to ensure Editor is mounted
      const timer = setTimeout(() => {
        // Trigger a re-render of the Editor by toggling a key
        setEditorKey(Date.now());
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [showUploadModal, uploadDescription]);

  // Add state for editor key
  const [editorKey, setEditorKey] = useState(Date.now());
  const handleFileClick = (file: UploadedFile, tabType: "I_Do" | "We_Do" | "You_Do" | null, subcategory: string) => {
    const fileUrl = typeof file.url === "string" ? file.url : (file.url as any)?.base || "";
    if (!fileUrl) { alert("File URL is missing"); return; }

    const name = (file.name || "").toLowerCase();
    const type = (file.type || "").toLowerCase();

    // URL/link handling
    if (type.includes("url") || type.includes("link")) {
      window.open(fileUrl, "_blank", "noopener,noreferrer");
      return;
    }

    // PDF handling
    if (name.endsWith(".pdf") || type.includes("pdf")) {
      setCurrentPDFUrl(fileUrl);
      setCurrentPDFName(file.name);
      setCurrentPDFFileId(file.id);
      setShowPDFViewer(true);
      return;
    }

    // PowerPoint handling
    if (name.endsWith(".ppt") || name.endsWith(".pptx") || type.includes("presentation")) {
      setCurrentPPTUrl(fileUrl);
      setCurrentPPTName(file.name);
      setCurrentPPTFileId(file.id);
      setShowPPTViewer(true);
      return;
    }

    // Video handling
    const videoExts = [".mp4", ".avi", ".mov", ".mkv", ".webm"];
    if (type.includes("video") || videoExts.some((e) => name.endsWith(e))) {
      const all = extractVideos(selectedNode!);
      const idx = all.findIndex((v) => v.id === file.id || v.fileName === file.name);
      setCurrentVideoUrl(fileUrl);
      setCurrentVideoName(file.name);
      setCurrentVideoFileId(file.id);
      setCurrentVideoResolutions(file.availableResolutions || []);
      setCurrentVideoFileUrlMap(file.fileUrlMap || {});
      setVideoPlaylist(all);
      setCurrentVideoIndex(idx >= 0 ? idx : 0);
      setShowVideoViewer(true);
      return;
    }

    // ZIP handling
    const zipExts = [".zip", ".rar", ".7z", ".tar", ".gz"];
    if (type.includes("zip") || zipExts.some((e) => name.endsWith(e))) {
      setCurrentZipUrl(fileUrl);
      setCurrentZipName(file.name);
      setShowZipViewer(true);
      return;
    }

    // Word document handling (.docx / .doc / .ocx stored by backend)
    const wordExts = [".docx", ".doc", ".odt", ".rtf", ".ocx"];
    if (type.includes("wordprocessingml") || type.includes("msword") || type.includes("opendocument.text") || wordExts.some((e) => name.endsWith(e))) {
      setCurrentWordUrl(fileUrl);
      setCurrentWordName(file.name);
      setShowWordViewer(true);
      return;
    }

    // Plain text handling
    if (name.endsWith(".txt") || type.includes("text/plain")) {
      setCurrentTxtUrl(fileUrl);
      setCurrentTxtName(file.name);
      setShowTxtViewer(true);
      return;
    }

    // IMAGE handling
    const imageExts = [".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp", ".svg"];
    if (type.includes("image") || imageExts.some((e) => name.endsWith(e))) {
      const allImages = extractImages(selectedNode!);
      const idx = allImages.findIndex((img) => img.id === file.id);
      setCurrentImageUrl(fileUrl);
      setCurrentImageName(file.name);
      setCurrentImageFileId(file.id);
      setImagePlaylist(allImages);
      setCurrentImageIndex(idx >= 0 ? idx : 0);
      setShowImageViewer(true);
      return;
    }

    // Default: open in new tab
    window.open(fileUrl, "_blank");
  };

  const extractVideos = (node: CourseNode): VideoItem[] => {
    const videos: VideoItem[] = []; if (!node.originalData?.pedagogy) return videos;
    const process = (section: any) => { if (!section) return; Object.values(section).forEach((sub: any) => { sub?.files?.forEach((f: any) => { if (f.isVideo || f.fileType?.includes("video")) { const url = typeof f.fileUrl === "string" ? f.fileUrl : f.fileUrl?.base || ""; const rawMap: Record<string, string> = typeof f.fileUrl === "object" && f.fileUrl !== null ? f.fileUrl : {}; const resNames: string[] = f.availableResolutions?.length ? f.availableResolutions : Object.keys(rawMap).filter(k => rawMap[k]); videos.push({ id: f._id || `${Date.now()}`, title: f.fileName, fileName: f.fileName, fileUrl: url, availableResolutions: resNames, fileUrlMap: rawMap, isVideo: true }); } }); }); };
    process(node.originalData.pedagogy.I_Do); process(node.originalData.pedagogy.We_Do); process(node.originalData.pedagogy.You_Do);
    return videos;
  };


  // Add this helper function to extract all images from a node
  const extractImages = (node: CourseNode): Array<{ id: string; title: string; fileUrl: string }> => {
    const images: Array<{ id: string; title: string; fileUrl: string }> = [];
    if (!node.originalData?.pedagogy) return images;

    const process = (section: any) => {
      if (!section) return;
      Object.values(section).forEach((sub: any) => {
        // Process files
        sub?.files?.forEach((f: any) => {
          const fileName = (f.fileName || "").toLowerCase();
          const fileType = (f.fileType || "").toLowerCase();

          // Check if it's an image
          const imageExtensions = [".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp", ".svg"];
          const isImage = fileType.includes("image") || imageExtensions.some(ext => fileName.endsWith(ext));

          if (isImage) {
            const url = typeof f.fileUrl === "string" ? f.fileUrl : f.fileUrl?.base || "";
            images.push({
              id: f._id || `${Date.now()}`,
              title: f.fileName || "Untitled Image",
              fileUrl: url,
            });
          }
        });
      });
    };

    process(node.originalData.pedagogy.I_Do);
    process(node.originalData.pedagogy.We_Do);
    process(node.originalData.pedagogy.You_Do);

    return images;
  };
  const extractFileNameFromUrl = (url: string) => { try { return decodeURIComponent(url).split("/").pop()?.split("?")[0] || "link"; } catch { return "link"; } };
  const addTag = async (name: string, color: string = "#FB923C") => { if (!name || folderTags.some((t) => t.tagName === name)) return; setLoading(true); setSuccess(false); await new Promise((r) => setTimeout(r, 500)); setFolderTags((prev) => [...prev, { tagName: name, tagColor: color }]); setCurrentTag(""); setLoading(false); setSuccess(true); };
  const removeTag = (i: number) => setFolderTags((prev) => prev.filter((_, idx) => idx !== i));
  const addUploadTag = async (name: string, color: string) => { if (!name || uploadTags.some((t) => t.tagName === name)) return; setUploadTags((prev) => [...prev, { tagName: name, tagColor: color }]); setUploadCurrentTag(""); };
  const removeUploadTag = (i: number) => setUploadTags((prev) => prev.filter((_, idx) => idx !== i));
  const doDeletePage = async (pageId: string, name: string) => {
    if (!selectedNode) return;
    setIsDeleting(true);
    try {
      const navState = getCurrentNavState();
      await entityApi.deletePage(
        selectedNode.type as "module" | "submodule" | "topic" | "subtopic",
        selectedNode.id,
        pageId,
        {
          tabType: toBackendTab(activeTab),
          subcategory: activeSubcategory,
          folderPath: navState.currentFolderPath.length > 0
            ? navState.currentFolderPath.join(",")
            : "",
        }
      );
      await fetchAndRefresh(selectedNode);
      setShowDeleteConfirm(false);
      setDeleteTarget(null);
      showSuccessToast(`Page "${name}" deleted`);
    } catch (err) {
      console.error("Delete page failed:", err);
      showErrorToast("Failed to delete page. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeletePage = async (pageId: string, name: string) => {
    if (!selectedNode) return;
    // Remove the confirm() alert — use the modal instead
    setDeleteTarget({ type: "file", item: { id: pageId, isPage: true }, name });
    setShowDeleteConfirm(true);
  };
  useEffect(() => {
    if (courseStructureResponse?.data && !hasInitialized.current) {
      hasInitialized.current = true;
      const transformed = transformToCourseNodes(courseStructureResponse.data);
      setCourseData(transformed);

      // Only expand root node once
      const savedExpanded = getLS("lms_expanded_nodes");
      if (!savedExpanded) {
        setExpandedNodes(new Set([courseStructureResponse.data._id]));
      } else {
        try {
          setExpandedNodes(new Set(JSON.parse(savedExpanded)));
        } catch {
          setExpandedNodes(new Set([courseStructureResponse.data._id]));
        }
      }
      setIsSidebarLoading(false);

    }
  }, [courseStructureResponse?.data]);

  // ── Auto-select: first module → deepest leaf, first section, first subcategory ─────
  const hasAutoSelected = useRef(false);
  useEffect(() => {
    // Skip auto-select entirely when the URL already tells us where to go —
    // otherwise this fires first and slams the tab to I Do, and the later
    // URL-restore useEffect's setState can lose the race in some renders.
    // fromAnalytics = Back from reviewSubmission with a preserved tab.
    // nodeId       = deep-linked node from a notification / return URL.
    if (typeof window !== "undefined") {
      const sp = new URLSearchParams(window.location.search);
      if (sp.get("fromAnalytics") === "true" || sp.get("nodeId")) return;
    }
    // The section to land on is the first the course configured -- a course with
    // no I Do activities but some We Do ones used to fail this guard outright
    // and never auto-select at all.
    const firstTab = (["I_Do", "We_Do", "You_Do"] as const)
      .find((t) => subcategories[t].length > 0);

    // Only run once, after courseData and subcategories are ready, and no node selected yet
    if (
      hasAutoSelected.current ||
      !courseData.length ||
      selectedNode ||
      !firstTab
    ) return;

    // Helper: walk down first child at each level until no more children
    const getDeepestFirstLeaf = (node: CourseNode): CourseNode => {
      if (!node.children || node.children.length === 0) return node;
      return getDeepestFirstLeaf(node.children[0]);
    };

    // courseData[0] = the course root; its first child = first module
    const firstModule = courseData[0]?.children?.[0];
    if (!firstModule) return;

    const deepestNode = getDeepestFirstLeaf(firstModule);
    hasAutoSelected.current = true;

    // Expand path so the sidebar shows the selected item
    const path = findPathToNode(courseData, deepestNode.id);
    if (path?.length) {
      setExpandedNodes(prev => {
        const n = new Set(prev);
        path.forEach(id => n.add(id));
        setLS("lms_expanded_nodes", JSON.stringify([...n]));
        return n;
      });
    }

    // Set tab → first configured section, subcategory → its first one
    const firstSub = subcategories[firstTab][0];
    setActiveTabPersistent(firstTab);
    setActiveSubcategoryPersistent(firstSub?.key ?? "");
    updateURL({ activeTab: firstTab, activeSubcategory: firstSub?.key ?? "" });

    // Select the node — also flip isNodeSelected so the welcome screen hides
    setIsNodeSelected(true);
    setIsContentLoading(true);
    setSelectedNodePersistent(deepestNode);
    setBreadcrumbs(generateBreadcrumbs(deepestNode));
    updateNavState({ currentFolderPath: [], currentFolderId: null });
  }, [courseData, selectedNode, subcategories, findPathToNode, generateBreadcrumbs]);

  // A section with no configured activities is no longer rendered as a tab (see
  // TabBar in Coursecontent), but `activeTab` can still arrive pointing at one:
  // from the URL on a deep link, or from the tab this browser remembered for a
  // course whose activities have since changed. That left the pane stuck on
  // "Select an Activity" with no tab on screen to click away from. Land on the
  // first section the course actually configured instead.
  useEffect(() => {
    if (!activeTab) return;
    const available = (["I_Do", "We_Do", "You_Do"] as const)
      .filter((t) => subcategories[t].length > 0);
    if (!available.length || available.includes(activeTab)) return;
    const fallback = available[0];
    const firstSub = subcategories[fallback][0];
    setActiveTabPersistent(fallback);
    setActiveSubcategoryPersistent(firstSub?.key ?? "");
    updateURL({ activeTab: fallback, activeSubcategory: firstSub?.key ?? "" });
  }, [activeTab, subcategories]);

  useEffect(() => { setBreadcrumbs(generateBreadcrumbs(selectedNode)); }, [selectedNode, courseData, generateBreadcrumbs]);
  useEffect(() => {
    if (selectedNode && !isRestoringFromAnalytics && !contentData[selectedNode.id]) {
      fetchAndRefresh(selectedNode);
    }
  }, [selectedNode?.id]); // Only depends on node ID, not the whole object
  useEffect(() => {
    if (!courseData.length) return;

    const params = new URLSearchParams(window.location.search);

    // Direct deep-link via URL params (e.g. from a rejection notification):
    // `nodeId`, `activeTab`, `activeSubcategory` in the URL take precedence
    // over the localStorage remembered tab/node. The `highlightExerciseId`
    // param is consumed inside Assessment.tsx; we don't need to touch it here.
    const urlNodeId = params.get("nodeId");
    const urlActiveTab = params.get("activeTab") as "I_Do" | "We_Do" | "You_Do" | null;
    const urlActiveSub = params.get("activeSubcategory");
    if (urlNodeId) {
      const findNode = (nodes: CourseNode[]): CourseNode | null => {
        for (const n of nodes) {
          if (n.id === urlNodeId) return n;
          const found = findNode(n.children || []);
          if (found) return found;
        }
        return null;
      };
      const target = findNode(courseData);
      if (target) {
        setSelectedNodePersistent(target);
        const path = findPathToNode(courseData, urlNodeId);
        if (path) {
          setExpandedNodes((prev) => {
            const n = new Set(prev);
            path.forEach((id) => n.add(id));
            return n;
          });
        }
        if (urlActiveTab) setActiveTabPersistent(urlActiveTab);
        if (urlActiveSub) setActiveSubcategoryPersistent(urlActiveTab === "You_Do" ? canonYouDoSubKey(urlActiveSub) : urlActiveSub);
      }
    }

    if (params.get("fromAnalytics") === "true") {
      setIsRestoringFromAnalytics(true);

      const cleanUrl = new URL(window.location.href);
      cleanUrl.searchParams.delete("fromAnalytics");
      window.history.replaceState({}, "", cleanUrl.toString());

      // URL params win when present — the review Back handler promotes
      // sourceTab/sourceSubcategory into activeTab/activeSubcategory
      // precisely so the trainer returns to their original tab. Only fall
      // back to the last-remembered localStorage tab when the URL is silent.
      const storedTab = getLS("lms_selected_tab") as "I_Do" | "We_Do" | "You_Do" | null;
      const storedSub = getLS("lms_selected_subcategory");
      const storedId = getLS("lms_selected_node_id");

      const effectiveTab = (urlActiveTab as "I_Do" | "We_Do" | "You_Do" | null) || storedTab;
      const effectiveSub = urlActiveSub || storedSub;

      if (effectiveTab) setActiveTabPersistent(effectiveTab);
      if (effectiveSub) setActiveSubcategoryPersistent(effectiveTab === "You_Do" ? canonYouDoSubKey(effectiveSub) : effectiveSub);

      if (storedId) {
        const findNode = (nodes: CourseNode[]): CourseNode | null => {
          for (const n of nodes) {
            if (n.id === storedId) return n;
            const found = findNode(n.children || []);
            if (found) return found;
          }
          return null;
        };

        const found = findNode(courseData);
        if (found) {
          setSelectedNodePersistent(found);
          const path = findPathToNode(courseData, storedId);
          if (path) {
            setExpandedNodes((prev) => {
              const n = new Set(prev);
              path.forEach((id) => n.add(id));
              return n;
            });
          }
        }
      }

      setTimeout(() => setIsRestoringFromAnalytics(false), 300);
    }
  }, [courseData]);

  useEffect(() => {
    if (!isResizing) return;
    const onMove = (e: MouseEvent) => { if (e.clientX >= 200 && e.clientX <= 500) setSidebarWidth(e.clientX); };
    const onUp = () => setIsResizing(false);
    document.addEventListener("mousemove", onMove); document.addEventListener("mouseup", onUp);
    return () => { document.removeEventListener("mousemove", onMove); document.removeEventListener("mouseup", onUp); };
  }, [isResizing]);

  const handleUpdateFileSettings = async (fileId: string, settings: { studentShow: boolean; downloadAllow: boolean }) => {
    if (!selectedNode) return;
    try {
      const navState = getCurrentNavState();
      await updateFileSettingsInComponent(selectedNode.type as any, selectedNode.id, { tabType: toBackendTab(activeTab), subcategory: activeSubcategory, fileId, studentShow: settings.studentShow, downloadAllow: settings.downloadAllow, folderPath: navState.currentFolderPath.join("/"), originalData: selectedNode.originalData });
      setDocumentSettings((prev) => ({ ...prev, [fileId]: settings })); showSuccessToast("File settings updated!");
    } catch { showErrorToast("Failed to update file settings"); }
  };



  const { data: userData, isLoading: userLoading } = useQuery({
    queryKey: ['currentUser'],
    queryFn: getCurrentUser,
    retry: 1,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    enabled: typeof window !== 'undefined' && !!getToken(),
  })
  const user = userData?.user || null

  const checkDummyStudentStatus = () => {
    try {
      const stored = localStorage.getItem('smartcliff_roleSwitch')
      if (stored) {
        const data = JSON.parse(stored)
        setIsDummyStudent(data.isDummyStudent || false)
        if (data.originalRole || data.originalRenameRole) {
          setOriginalRoleInfo({ roleName: data.originalRole || '', renameRole: data.originalRenameRole || '' })
        }
      }
    } catch { }
  }

  useEffect(() => {
    checkDummyStudentStatus()
    const handleStorage = () => checkDummyStudentStatus()
    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (userRef.current && !userRef.current.contains(e.target as Node)) setShowUserMenu(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const getUserInitials = () => {
    if (!user) return "SC"
    return `${user.firstName?.charAt(0) || ''}${user.lastName?.charAt(0) || ''}`.toUpperCase()
  }

  const isActualStudent = () => {
    if (!user) return false
    return user.role?.roleName?.toLowerCase().includes('student') || user.role?.renameRole?.toLowerCase().includes('student')
  }

  const handleLogout = async () => {
    setIsLoggingOut(true)
    try {
      await postLogout()
      toast.success("Logged out successfully")
    } catch {
      toast.error("Logout failed")
    } finally {
      // Outside the try: a failed postLogout used to leave the session intact,
      // so "Logout failed" still left the user signed in. Clearing here also
      // wipes sessionStorage, which localStorage.clear() alone left behind.
      clearAllStorage()
      router.push("/login")
      setIsLoggingOut(false)
    }
  }

  const handleProfileClick = () => {
    setShowUserMenu(false)
    router.push("/lms/pages/studentdashboard/student/profile")
  }

  const handleSwitchToStudent = () => {
    try {
      const data = { isDummyStudent: true, originalRole: user?.role?.roleName || '', originalRenameRole: user?.role?.renameRole || '', switchTimestamp: Date.now() }
      localStorage.setItem('smartcliff_roleSwitch', JSON.stringify(data))
      localStorage.setItem('smartcliff_isDummyStudent', 'true')
      setIsDummyStudent(true)
      setOriginalRoleInfo({ roleName: user?.role?.roleName || '', renameRole: user?.role?.renameRole || '' })
      setShowUserMenu(false)
      toast.success("Switched to Student View")
      // Keep the course you were working on — the point of the preview is to
      // see THIS course as the learner sees it, not the whole course list.
      router.push(studentRouteForCurrentCourse())
      setTimeout(() => window.dispatchEvent(new Event('storage')), 100)
    } catch { toast.error("Failed to switch role") }
  }

  const handleSwitchBackToOriginal = () => {
    try {
      localStorage.removeItem('smartcliff_roleSwitch')
      localStorage.removeItem('smartcliff_isDummyStudent')
      setIsDummyStudent(false)
      setOriginalRoleInfo(null)
      setShowUserMenu(false)
      toast.success(`Switched back to ${originalRoleInfo?.renameRole || 'your original role'}`)
      const role = originalRoleInfo?.renameRole?.toLowerCase() || ''
      if (role.includes('poc')) router.push("/lms/pages/poc/dashboard")
      else if (role.includes('admin')) router.push("/lms/pages/admin/dashboard")
      else router.push("/lms/pages/dashboard")
      setTimeout(() => window.dispatchEvent(new Event('storage')), 100)
    } catch { toast.error("Failed to switch role") }
  }
  // LoadingSpinner removed — the app-wide route-change loader covers the
  // transition, and CourseContent renders its own "No content yet" empty
  // state while data is in flight. No more full-area spinner sitting in the
  // content pane after navigation.

  // Add the keyframes for the animation in your global styles
  const LoadingStyles = () => (
    <style jsx global>{`
    @keyframes pulseDot {
      0%, 100% { opacity: 0.3; transform: scale(0.8); }
      50% { opacity: 1; transform: scale(1.2); }
    }
  `}</style>
  );
  if (!courseId) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: T.pageBg, fontFamily: "'Plus Jakarta Sans', -apple-system, sans-serif" }}>
        <div className="text-center p-8 rounded-2xl" style={{ background: T.bg, border: `1.5px solid ${T.border}`, boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}>
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: T.orangeLight }}>
            <BookOpen size={20} style={{ color: T.orange }} />
          </div>
          <p className="text-[14px] font-bold" style={{ color: T.textMain }}>No course ID provided</p>
          <p className="text-[12px] mt-1" style={{ color: T.textMuted }}>Please select a course first</p>
        </div>
      </div>
    );
  }
  function LMSMenuRow({ icon: Icon, label, sub, color, hoverBg, onClick }: {
    icon: React.ElementType; label: string; sub: string
    color: string; hoverBg: string; onClick: () => void
  }) {
    return (
      <button
        onClick={onClick}
        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left transition-colors"
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = hoverBg }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent" }}
      >
        <Icon size={14} className="flex-shrink-0" style={{ color }} />
        <div className="min-w-0">
          <p className="text-[12px] font-medium" style={{ color: T.textMain }}>{label}</p>
          {sub && <p className="text-[10px]" style={{ color: T.textMuted }}>{sub}</p>}
        </div>
      </button>
    )
  }

  return (
    <>
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800;900&display=swap');
        * { font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background-color: ${T.border}; border-radius: 20px; }
        .dark .ql-toolbar { background-color: #1f2937; border-color: #374151; }
        .dark .ql-container { background-color: #111827; border-color: #374151; color: #f3f4f6; }
        .dark .ql-picker-label, .dark .ql-picker-item, .dark .ql-stroke { color: #9ca3af !important; stroke: #9ca3af !important; }
        .dark .ql-fill { fill: #9ca3af !important; }
        .dark .ql-picker-options { background-color: #1f2937; border-color: #374151; }
        @keyframes animateIn { from { opacity: 0; transform: translateY(-5px); } to { opacity: 1; transform: translateY(0); } }
        .animate-in { animation: animateIn 0.3s ease-out; }
      `}</style>

      {/* Shared trainer shell (admin-style navbar); this workspace page puts
          the course syllabus in the shell's SIDEBAR SLOT — one left rail, not
          the trainer menu plus a second syllabus panel. The navbar hamburger
          collapses the syllabus to its 56px icon rail. */}
      <StaffLayout
        fullBleed
        hideCornerBell /* the bell rides the I/We/You Do tab row instead */
        sidebar={
          /* FLAT on the gray canvas, exactly like every shell sidebar in the
             app: no card wrapper, no border — the rail's own course card and
             white active pills are the raised elements. Collapse/expand lives
             on the rail itself, so no shell strip / onMenuToggle is needed,
             and the breadcrumb moved inside the workspace panel. */
          <div
            className="relative flex flex-col h-full flex-shrink-0"
            style={{
              width: `${sidebarWidth}px`,
              overflow: 'hidden',
              transition: isResizing ? 'none' : 'width 0.2s ease',
              fontFamily: "'Poppins', 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
            }}
          >
            <CourseSidebar
              courseData={courseData}
              selectedNode={selectedNode}
              expandedNodes={expandedNodes}
              sidebarWidth={sidebarWidth}
              searchQuery={searchQuery}
              courseName={courseStructureResponse?.data?.courseName || "Course"}
              moduleCount={courseData[0]?.children?.length || 0}
              onNodeSelect={selectNode}
              onToggleNode={toggleNode}
              onExpandAll={expandAllNodes}
              onCollapseAll={collapseAllNodes}
              onSidebarWidthChange={setSidebarWidth}
              onSearchChange={setSearchQuery}
              isLoading={isSidebarLoading}
              onMouseDown={(e) => { setIsResizing(true); e.preventDefault(); }}
            />
          </div>
        }
      >
      <div style={{
        height: '100%',
        fontFamily: "'Poppins', 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        WebkitFontSmoothing: 'antialiased',
        MozOsxFontSmoothing: 'grayscale',
        textRendering: 'optimizeLegibility',
      }}>
        <div className="flex flex-col overflow-hidden" style={{ height: '100%', background: T.bg }}>
          <div className="flex-1 flex overflow-hidden relative">

            {/* ── Main content — flat, edge-to-edge under the shared navbar.
                  The course breadcrumb lives in the navbar (StaffLayout's
                  `breadcrumb` slot), so there is no in-content crumb row and
                  no floating card chrome. ─────────────────────────────── */}
            <div className="flex-1 flex flex-col overflow-hidden" style={{
              background: T.bg,
              gap: 0,
            }}>

              {/* ── Course content — zero top gap. The batch picker rides the
                    I Do / We Do / You Do tab row (CourseContent's tabBarRight),
                    not a row of its own. ─────────────────────────────────── */}
              <div className="flex-1 overflow-hidden" style={{ marginTop: 0, paddingTop: 0 }}>
                {/* Hold the main SmartCliff loader across the ENTIRE central
                    pane until course data has loaded AND a node is picked.
                    Rendering CourseContent earlier flashes a broken layout —
                    tab row, empty subcategories, its own "no node" tiles —
                    instead of a single clean loading state. Once the flag
                    below flips true, everything shows together in one paint. */}
                {(!courseData.length || !selectedNode) ? (
                  <div className="flex items-center justify-center h-full w-full" style={{ background: T.bg }}>
                    <SmartCliffRingLoader title="Loading" subtitle="Just a moment..." entrance={false} />
                  </div>
                ) : (
                  <CourseContent
                    // Keyed by the NODE, not by `Date.now()`.
                    //
                    // A timestamp in the key made this subtree remount on every
                    // single parent render, which threw away the children's
                    // state and made React Query's cache useless — every render
                    // was a fresh mount, so every visit showed a spinner even
                    // when the list was already cached. `contentData` is a prop,
                    // so a genuine content change re-renders this anyway; the
                    // remount was never what refreshed it.
                    key={selectedNode?.id ?? "none"}
                    selectedNode={selectedNode}
                    activeTab={activeTab}
                    activeSubcategory={activeSubcategory}
                    subcategories={subcategories}
                    contentData={contentData}
                    breadcrumbs={[]}
                      onNavigateToFolderLevel={handleNavigateToFolderLevel}

                    fileTypes={fileTypes}
                    currentFolderContents={getCurrentFolderContents()}
                    folderNavState={getCurrentNavState()}
                    courseId={courseId}
                    courseStructureName={courseStructureResponse?.data?.courseName || ""}
                    configuredLanguages={configuredLanguages}
                    activeBatchId={activeBatchId}
                    tabBarRight={
                      /* Batch picker + bell share the tab row's right corner
                         (the shell's floating bell is hidden on this page so
                         nothing straddles the row divider). */
                      <div className="flex items-center" style={{ gap: 10, padding: "4px 0" }}>
                        <BatchScopeBar
                          ctx={resourceBatchCtx}
                          activeTab={activeTab}
                          activeBatchId={activeBatchId}
                          onSelectBatch={handleSelectBatch}
                          canSwitchBatch={parentSection.canSwitchBatch}
                          courseId={courseId || ""}
                        />
                        <NotificationBell />
                      </div>
                    }

                    onTabChange={(tab) => { setActiveTabPersistent(tab); setActiveSubcategoryPersistent(""); updateURL({ activeTab: tab, activeSubcategory: "" }); updateNavState({ currentFolderPath: [], currentFolderId: null }); }}
                    onSubcategoryChange={(sub, comp) => { setActiveSubcategoryPersistent(sub); updateURL({ activeSubcategory: sub }); updateNavState({ currentFolderPath: [], currentFolderId: null }); }}
                    onResourceModalOpen={(groupId, groupName, opts) => {
                      const gid = typeof groupId === "string" && groupId ? groupId : undefined;
                      const gname = typeof groupName === "string" && groupName ? groupName : undefined;
                      const displayOnly = opts?.displayOnly === true;
                      if (displayOnly) {
                        // Toolbar / empty-state "Add Resource" used while the user is
                        // navigated INSIDE a group's folder. The new resource still
                        // lands in the CURRENT folder (whose folderId already ties it
                        // to the group on the server) — so we keep the folder path and
                        // only surface the group name in the breadcrumb. Do NOT set the
                        // group as the upload target and do NOT reset the folder path.
                        setUploadGroupId(undefined);
                        setUploadGroupName(gname);
                      } else {
                        setUploadGroupId(gid);
                        setUploadGroupName(gname);
                        // When adding to an existing group, the target is ALWAYS the group's
                        // root — never whatever folder the page happens to be parked in.
                        // Reset the persistent nav state so the modal opens at a clean root
                        // and `currentFolderPath=[]` flows through to the server as
                        // `folderPath=""`. The file then lands at activity root with the
                        // group's groupId, which is exactly where the rest of the group lives.
                        if (gid) updateNavState({ currentFolderPath: [], currentFolderId: null });
                      }
                      clearUploadModalEditState(); // make sure modal opens fresh (not in edit mode)
                      setShowNotionModal(true);
                    }}
                    onFileClick={handleFileClick}
                    onNavigateToFolder={navigateToFolder}
                    onNavigateToRoot={() => updateNavState({ currentFolderId: null, currentFolderPath: [] })}
                    onNavigateUp={() => {
                      const navState = getCurrentNavState()
                      const newPath = navState.currentFolderPath.slice(0, -1)

                      if (newPath.length === 0) {
                        // Back to root
                        updateNavState({ currentFolderPath: [], currentFolderId: null })
                      } else {
                        // Find the parent folder ID from folders state
                        const findFolderByPath = (items: FolderItem[], targetPath: string): string | null => {
                          for (const item of items) {
                            if (item.folderPath === targetPath) return item.id
                            if (item.subfolders?.length) {
                              const found = findFolderByPath(item.subfolders, targetPath)
                              if (found) return found
                            }
                          }
                          return null
                        }

                        const parentPath = newPath.join('/')
                        const parentFolderId = findFolderByPath(folders, parentPath)
                        updateNavState({ currentFolderPath: newPath, currentFolderId: parentFolderId })
                      }
                    }}

                    onEditFolder={(folder) => {
                      // Open FileUploadModal pre-filled with the folder's existing name
                      setEditingFolder(folder);
                      setUploadModalEditMode(true);
                      setUploadModalInitialName(folder.name);
                      setUploadModalInitialDesc(folder.description || "");
                      setUploadModalInitialShow(true);
                      setUploadModalInitialDl(false);

                      // Seed every file + subfolder INSIDE the folder being
                      // edited. Paths are RELATIVE to this folder (so a file
                      // sitting directly in the folder has path=[]). We also
                      // build name+path → fileId map for X-click delete routing.
                      const seedFiles: Array<{ name: string; size?: string | number; path?: string[] }> = [];
                      const seedFolders: Array<{ name: string; path: string[] }> = [];
                      const idMap: Record<string, string> = {};
                      const walk = (f: FolderItem, basePath: string[]) => {
                        (f.files || []).forEach(file => {
                          seedFiles.push({ name: file.name, size: file.size, path: basePath });
                          idMap[`${file.name}::${basePath.join("/")}`] = file.id;
                        });
                        (f.subfolders || []).forEach(sf => {
                          seedFolders.push({ name: sf.name, path: basePath });
                          walk(sf, [...basePath, sf.name]);
                        });
                      };
                      walk(folder, []);
                      setUploadModalInitialFiles(seedFiles);
                      setUploadModalInitialFolders(seedFolders);
                      editExistingFileIdMapRef.current = idMap;
                      editPendingDeletionsRef.current = [];
                      editPendingFolderDeletionsRef.current = [];

                      // Force the modal's currentFolderPath to point at this
                      // folder so newly-added files land INSIDE it on the server.
                      const parentSegs = folder.folderPath
                        ? folder.folderPath.split("/").filter(Boolean)
                        : [];
                      setUploadModalForcedPath([...parentSegs, folder.name]);

                      setShowFileUploadModal(true);
                    }}

                    onEditGroup={(group) => {
                      // Open FileUploadModal pre-filled with the group name; new files go into the existing group
                      setUploadGroupId(group.groupId);
                      setUploadGroupName(group.groupName);
                      setUploadModalEditMode(true);
                      setUploadModalInitialName(group.groupName || "");
                      setUploadModalInitialDesc(group.groupDescription || "");
                      setUploadModalInitialShow(true);
                      setUploadModalInitialDl(false);

                      // Seed every top-level file + every folder (and its
                      // contents, recursively) that belong to the group.
                      const seedFiles: Array<{ name: string; size?: string | number; path?: string[] }> = [];
                      const seedFolders: Array<{ name: string; path: string[] }> = [];
                      const idMap: Record<string, string> = {};

                      // Files directly attached to the group (at activity root,
                      // grouped by groupId).
                      (group.files || []).forEach(file => {
                        seedFiles.push({ name: file.name, size: file.size, path: [] });
                        idMap[`${file.name}::`] = file.id;
                      });

                      // Top-level folders of the group + every file/subfolder
                      // they recursively contain. Paths are relative to group root.
                      const walk = (f: FolderItem, basePath: string[]) => {
                        seedFolders.push({ name: f.name, path: basePath });
                        const newBase = [...basePath, f.name];
                        (f.files || []).forEach(file => {
                          seedFiles.push({ name: file.name, size: file.size, path: newBase });
                          idMap[`${file.name}::${newBase.join("/")}`] = file.id;
                        });
                        (f.subfolders || []).forEach(sf => walk(sf, newBase));
                      };
                      (group.folders || []).forEach(f => walk(f, []));

                      // Nested sub-groups (groups inside this group). Each sub-group
                      // is surfaced as a virtual folder so the user can SEE the full
                      // group-inside-group structure when editing. We also build a
                      // cascade map keyed by virtual path so that deleting one of
                      // these virtual folders fans out into individual file deletions
                      // (sub-groups don't exist as real folders on the server).
                      const subGroupCascade = new Map<string, string[]>();
                      const collectFolderFileIds = (folder: any): string[] => {
                        const ids: string[] = [];
                        (folder.files || []).forEach((f: any) => { if (f.id) ids.push(f.id); });
                        (folder.subfolders || []).forEach((sf: any) => ids.push(...collectFolderFileIds(sf)));
                        return ids;
                      };
                      const collectSubGroupFileIds = (sg: any): string[] => {
                        const ids: string[] = [];
                        (sg.files || []).forEach((f: any) => { if (f.id) ids.push(f.id); });
                        (sg.folders || []).forEach((f: any) => ids.push(...collectFolderFileIds(f)));
                        (sg.subGroups || []).forEach((nsg: any) => ids.push(...collectSubGroupFileIds(nsg)));
                        return ids;
                      };
                      const walkSubGroup = (sg: any, basePath: string[]) => {
                        seedFolders.push({ name: sg.groupName, path: basePath });
                        const newBase = [...basePath, sg.groupName];
                        subGroupCascade.set(newBase.join("/"), collectSubGroupFileIds(sg));
                        (sg.files || []).forEach((file: any) => {
                          seedFiles.push({ name: file.name, size: file.size, path: newBase });
                          idMap[`${file.name}::${newBase.join("/")}`] = file.id;
                        });
                        (sg.folders || []).forEach((f: any) => walk(f, newBase));
                        (sg.subGroups || []).forEach((nsg: any) => walkSubGroup(nsg, newBase));
                      };
                      (group.subGroups || []).forEach((sg: any) => walkSubGroup(sg, []));

                      setUploadModalInitialFiles(seedFiles);
                      setUploadModalInitialFolders(seedFolders);
                      editExistingFileIdMapRef.current = idMap;
                      editSubGroupCascadeRef.current = subGroupCascade;
                      editPendingDeletionsRef.current = [];
                      editPendingFolderDeletionsRef.current = [];

                      // Groups live at activity root — no forced path needed.
                      setUploadModalForcedPath(undefined);

                      setShowFileUploadModal(true);
                    }}

                    onDeleteFolder={(folder) => { setDeleteTarget({ type: "folder", item: folder, name: folder.name }); setShowDeleteConfirm(true); }}
                    onDeleteFile={(id, name) => { setDeleteTarget({ type: "file", item: { id }, name }); setShowDeleteConfirm(true); }}
                    onUpdateFile={initiateFileUpdate}
                    getParentNodeName={getParentNodeName}
                    getFolderItemCount={getFolderItemCount}
                    getFolderTotalSize={getFolderTotalSize}
                    pedagogy={selectedNode?.originalData?.pedagogy}
                    onDeletePage={handleDeletePage}
                    onBulkDelete={async (items) => {
                      if (!selectedNode) return;
                      const navState = getCurrentNavState();
                      // Delete all items silently (no per-item toast / no per-item refresh).
                      // A single refresh + single toast is handled by runDeleteWithProgress in ContentList.
                      for (const item of items) {
                        try {
                          if (item.type === "page") {
                            await entityApi.deletePage(
                              selectedNode.type as "module" | "submodule" | "topic" | "subtopic",
                              selectedNode.id,
                              item.id,
                              {
                                tabType: toBackendTab(activeTab),
                                subcategory: activeSubcategory,
                                folderPath: navState.currentFolderPath.length > 0 ? navState.currentFolderPath.join(",") : "",
                              }
                            );
                          } else if (item.type === "folder" && item.folderItem) {
                            const pathParts = (item.folderItem.folderPath || item.folderItem.name).split("/").filter(Boolean);
                            const folderName = pathParts.pop();
                            await entityApi.deleteFolder(selectedNode.type as any, selectedNode.id, {
                              tabType: toBackendTab(activeTab),
                              subcategory: activeSubcategory,
                              folderName: folderName || "",
                              folderPath: pathParts.join("/"),
                              courses: selectedNode.originalData?.courses || "",
                              action: "deleteFolder",
                            });
                          } else if (item.type === "file") {
                            await entityApi.deleteFile(selectedNode.type as any, selectedNode.id, {
                              tabType: toBackendTab(activeTab),
                              subcategory: activeSubcategory,
                              folderPath: navState.currentFolderPath.join("/"),
                              action: "deleteFile",
                              updateFileId: item.id,
                            });
                          }
                        } catch {
                          // continue with remaining items even if one fails
                        }
                      }
                      // Single refresh after all deletions complete
                      await fetchAndRefresh(selectedNode);
                    }}
                  />
                )}
              </div>

            </div>
          </div>
        </div>
      </div>
      </StaffLayout>

      {/* ── Notion Resource Modal ─────────────────────────────────────────────── */}
      <NotionResourceModal
        isOpen={showNotionModal}
        onClose={() => setShowNotionModal(false)}
        fileTypes={fileTypes}  // This already contains only Video (plus static folder, zip, reference)
        // The picker cards read `description`; the catalog carries it as `tooltip`.
        studentFeatureItems={studentFeatureTypes.map(({ key, label, icon, color, tooltip }) => ({ key, label, icon, color, description: tooltip }))}
        selectedNode={selectedNode}
        activeTab={activeTab}
        activeSubcategory={activeSubcategory}
        currentFolderPath={getCurrentNavState().currentFolderPath}
        pathCrumbs={buildFullPathCrumbs()}
        onSelectType={(key) => { setSelectedFileType(key); setShowUploadModal(true); }}
        onCreateFolder={() => {
          setShowNotionModal(false);
          // If the picker was opened via a group row's "+ Add resource" button,
          // seed the FolderBuilder with that group as the current location so
          // the user lands "inside" the group. Otherwise start at FolderBuilder
          // root (activity root) — same as before.
          if (uploadGroupId && uploadGroupName) {
            setFbNavPath([{
              id: `grp-${uploadGroupId}`,
              name: uploadGroupName,
              kind: "group",
              groupId: uploadGroupId,
            }]);
          } else {
            setFbNavPath([]);
          }
          setShowFolderBuilderModal(true);
        }}
        onOpenFileUploadModal={() => {
          setShowNotionModal(false);
          clearUploadModalEditState(); // fresh create mode
          setShowFileUploadModal(true);
        }}
        hierarchyInfo={buildFullHierarchyInfo()}
        onPageCreated={async () => {
          if (!selectedNode) return;
          // The backend now stores folderPath / folderId / groupId on the
          // page record directly (and physically places folder-bound pages
          // inside their folder's pages[]). A simple refresh is enough —
          // CourseContent will pick the new page up at the correct location.
          await fetchAndRefresh(selectedNode);
          showSuccessToast("Page created!");
        }}
      />

      {/* ── File Upload Modal ─────────────────────────────────────────────────── */}
      <FileUploadModal
        isOpen={showFileUploadModal}
        // Only the types this course enabled are droppable / browsable — see
        // uploadableTypeKeys. Empty (legacy course) → the modal falls back to
        // its historical accept list rather than blocking every file.
        allowedTypes={uploadableTypeKeys}
        maxSizeByType={uploadMaxSizeByType}
        onClose={() => {
          setShowFileUploadModal(false);
          setUploadGroupId(undefined);
          setUploadGroupName(undefined);
          // Only re-open the Notion picker if we were in create mode (not edit mode)
          if (!uploadModalEditMode) setShowNotionModal(true);
          setUpdateFileId(null);
          setEditingFolder(null);
          clearUploadModalEditState();
        }}
       onSuccess={() => {
    // Close modal immediately, then refresh in background
    setShowFileUploadModal(false);
    setShowNotionModal(false);
    setUploadGroupId(undefined);
    setUploadGroupName(undefined);
    setUpdateFileId(null);
    setEditingFolder(null);
    clearUploadModalEditState();
    showSuccessToast("Upload completed successfully!");

    if (selectedNode) {
      setCachedContentData(prev => {
        const newCache = { ...prev };
        delete newCache[selectedNode.id];
        return newCache;
      });
      fetchAndRefresh(selectedNode);
    }
  }}

        onSubmit={handleFileUploadModalSubmit}
        onCreateFolder={createFolderWithName}
        // When editing a folder, we force the modal's working path to the
        // folder's own location so new uploads land inside it. Otherwise we
        // pass the page's current nav path as normal.
        currentFolderPath={uploadModalForcedPath ?? getCurrentNavState().currentFolderPath}
        parentGroupId={uploadGroupId}
        parentGroupName={uploadGroupName}
        editMode={uploadModalEditMode}
        initialFileName={uploadModalInitialName}
        initialDescription={uploadModalInitialDesc}
        initialShowToStudent={uploadModalInitialShow}
        initialAllowDownload={uploadModalInitialDl}
        initialFiles={uploadModalInitialFiles}
        initialFolders={uploadModalInitialFolders}
        onDeleteFile={(name, path) => {
          // The modal already removed the row from its display. Here we look up
          // the server-side fileId and queue the deletion. The actual API call
          // happens on Save Changes via handleFileUploadModalSubmit so the user
          // can still cancel by closing the modal without saving.
          const key = `${name}::${path.join("/")}`;
          const fileId = editExistingFileIdMapRef.current[key];
          editPendingDeletionsRef.current = [
            ...editPendingDeletionsRef.current,
            { name, path, fileId },
          ];
        }}
        onDeleteFolder={(name, path) => {
          // Sub-groups appear as virtual folders in the edit modal but don't
          // exist as real folders on the server. If this (name, path) maps to
          // a sub-group cascade entry, queue every descendant file for deletion
          // individually instead of calling the folder-delete API (which would
          // fail because no such folder exists).
          const pathKey = [...path, name].join("/");
          const cascadeIds = editSubGroupCascadeRef.current.get(pathKey);
          if (cascadeIds && cascadeIds.length > 0) {
            const newDeletions = cascadeIds.map(fileId => ({ name: "", path: [], fileId }));
            editPendingDeletionsRef.current = [
              ...editPendingDeletionsRef.current,
              ...newDeletions,
            ];
            return;
          }
          // Mirror of onDeleteFile but for an existing folder. We queue the
          // folder itself (parent path + name); the server's deleteFolder API
          // cascades to its contents on Save Changes — no need to queue every
          // nested file individually.
          editPendingFolderDeletionsRef.current = [
            ...editPendingFolderDeletionsRef.current,
            { name, path },
          ];
        }}
      />

      {/* ── Upload Modal ──────────────────────────────────────────────────────── */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.42)', backdropFilter: 'blur(3px)', animation: 'umFadeIn 0.18s ease-out both' }}
          onClick={resetUploadModalStates}>
          <div
            className={`relative flex flex-col overflow-hidden mx-4 ${isButtonLoading ? 'pointer-events-none' : ''}`}
            style={{
              width: 880, maxWidth: 'calc(100vw - 32px)',
              height: '86vh', maxHeight: '86vh',
              background: T.bg, borderRadius: '22px',
              border: `1.5px solid ${T.border}`,
              boxShadow: '0 24px 60px rgba(0,0,0,0.18)',
              fontFamily: "'Plus Jakarta Sans',-apple-system,sans-serif",
              animation: 'umSlideUp 0.22s cubic-bezier(0.16,1,0.3,1) both',
            }}
            onClick={e => e.stopPropagation()}
          >
            {isButtonLoading && (
              <div className="absolute inset-0 flex items-center justify-center z-10 rounded-[22px]"
                style={{ background: 'rgba(255,255,255,0.88)', backdropFilter: 'blur(4px)' }}>
                <div className="flex flex-col items-center gap-3">
                  <div className="w-9 h-9 rounded-full animate-spin" style={{ border: `3px solid rgba(232,100,12,0.15)`, borderTopColor: T.orange }} />
                  <span className="text-[12px] font-semibold" style={{ color: T.textSub }}>{selectedFileType === "url" ? "Adding URL…" : "Uploading…"}</span>
                </div>
              </div>
            )}

            {/* Header — matches FileUploadModal */}
            <div className="relative overflow-hidden flex-shrink-0"
              style={{ background: 'linear-gradient(140deg,#F08243 0%,#E8640C 48%,#C95308 100%)', padding: '10px 14px 12px', borderRadius: '20px 20px 0 0' }}>
              <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 0 }} viewBox="0 0 600 70" fill="none">
                <circle cx="570" cy="-8" r="70" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
                <circle cx="30" cy="80" r="55" stroke="rgba(255,255,255,0.10)" strokeWidth="1" />
              </svg>
              <div style={{ position: 'relative', zIndex: 1 }} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: 'rgba(255,255,255,0.22)', border: '1px solid rgba(255,255,255,0.30)' }}>
                    {React.cloneElement(fileTypes.find((t) => t.key === selectedFileType)?.icon as React.ReactElement || <FileLucide />, { size: 14, color: '#fff' })}
                  </div>
                  <div>
                    <h3 className="text-[15px] font-bold text-white leading-tight">
                      {selectedFileType === "url" ? (updateFileId ? "Update URL" : "Add URL") : (updateFileId ? "Update File" : "Upload Reference")}
                    </h3>
                    <p className="text-[10.5px]" style={{ color: 'rgba(255,255,255,0.72)' }}>
                      {getCurrentNavState().currentFolderPath.length > 0 ? `To "${getCurrentNavState().currentFolderPath.slice(-1)[0]}"` : "Add files with metadata"}
                    </p>
                  </div>
                </div>
                <button onClick={() => { resetUploadModalStates(); setShowNotionModal(true); }}
                  className="flex-shrink-0 p-1 rounded-lg transition-all"
                  style={{ background: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.25)', color: 'rgba(255,255,255,0.85)' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.30)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.18)'}
                >
                  <X size={14} />
                </button>
              </div>
            </div>
            {/* ── Plain location breadcrumb (display-only) ──────────────
               Course > Module > … > Group > Folder > Subfolder. Shows the
               user where this URL / Reference will be saved before they
               click Save. Non-clickable by design. */}
            <PlainBreadcrumb crumbs={buildFullPathCrumbs()} prefix="Saving to:" />

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
              {/* File Details */}
              <div>
                <div className="space-y-4">
                  {selectedFileType === "url" ? (
                    // URL section remains the same
                    <div className="space-y-3">
                      <div>
                        <label className="block text-[11px] font-bold mb-2" style={{ color: T.textSub }}>{updateFileId ? "Update URL" : "Enter URL"}</label>
                        <input type="url" value={folderUrl} onChange={(e) => setFolderUrl(e.target.value)} placeholder="https://example.com" className="w-full px-3 py-2.5 text-[13px] outline-none transition-all" style={{ background: T.pageBg, border: `1.5px solid ${T.border}`, borderRadius: '10px', color: T.textMain }}
                          onFocus={e => { e.currentTarget.style.borderColor = T.orange; e.currentTarget.style.boxShadow = `0 0 0 3px ${T.orangeLight}`; }}
                          onBlur={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.boxShadow = 'none'; }}
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold mb-2" style={{ color: T.textSub }}>Link Name <span style={{ color: T.textMuted, fontWeight: 400 }}>(display name)</span></label>
                        <input
                          type="text"
                          value={urlFileName}
                          onChange={(e) => setUrlFileName(e.target.value)}
                          placeholder={folderUrl ? extractFileNameFromUrl(folderUrl) : "e.g. React Docs"}
                          className="w-full px-3 py-2.5 text-[13px] outline-none transition-all"
                          style={{ background: T.pageBg, border: `1.5px solid ${T.border}`, borderRadius: '10px', color: T.textMain }}
                          onFocus={e => { e.currentTarget.style.borderColor = T.orange; e.currentTarget.style.boxShadow = `0 0 0 3px ${T.orangeLight}`; }}
                          onBlur={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.boxShadow = 'none'; }}
                        />
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* File Name Input */}
                      {/* File Name Input */}
                      <div>
                        <label className="block text-[11px] font-bold mb-2" style={{ color: T.textSub }}>
                          {updateFileId ? "File Name" : "File Name(s)"} <span style={{ color: '#DC2626' }}>*</span>
                        </label>

                        {/* UPDATE MODE: single name input */}
                        {updateFileId && updateFileType !== "url" && (
                          <div className="mb-3">
                            <input
                              type="text"
                              value={fileDisplayNames[updateFileId] || ""}
                              onChange={(e) => {
                                setFileDisplayNames((prev) => ({
                                  ...prev,
                                  [updateFileId]: e.target.value
                                }));
                                if (uploadingFiles.length > 0) {
                                  setUploadingFiles((prev) =>
                                    prev.map(f => ({ ...f, name: e.target.value }))
                                  );
                                }
                              }}
                              className="w-full px-3 py-2 text-[12px] outline-none"
                              style={{
                                background: T.pageBg,
                                border: `1.5px solid ${T.border}`,
                                borderRadius: "10px",
                                color: T.textMain,
                                fontFamily: "inherit",
                              }}
                              onFocus={e => { e.currentTarget.style.borderColor = T.orange; }}
                              onBlur={e => { e.currentTarget.style.borderColor = T.border; }}
                              placeholder="File name"
                            />
                            {uploadingFiles.length > 0 && (
                              <p className="text-[9px] text-amber-600 mt-1">
                                ⚠️ The file will be replaced with the new file you selected
                              </p>
                            )}
                          </div>
                        )}

                        {/* NEW FILE MODE */}
                        {!updateFileId && (
                          <div>
                            {/* REFERENCE TYPE: always show name input, even before file is picked */}
                            {selectedFileType === "reference" ? (
                              <div className="mb-2">
                                <input
                                  type="text"
                                  value={
                                    selectedFiles.length > 0
                                      ? (() => {
                                        const dn = fileDisplayNames[selectedFiles[0].name] || "";
                                        const di = dn.lastIndexOf(".");
                                        return di > 0 ? dn.slice(0, di) : dn;
                                      })()
                                      : referenceDisplayName
                                  }
                                  onChange={(e) => {
                                    if (selectedFiles.length > 0) {
                                      // File already picked — update its display name in place
                                      const origExt = selectedFiles[0].name.includes(".")
                                        ? "." + selectedFiles[0].name.split(".").pop()
                                        : "";
                                      setFileDisplayNames((prev) => ({
                                        ...prev,
                                        [selectedFiles[0].name]: e.target.value + origExt,
                                      }));
                                      // Keep uploading file label in sync
                                      setUploadingFiles((prev) =>
                                        prev.map(f => ({ ...f, name: e.target.value + origExt }))
                                      );
                                    } else {
                                      // No file yet — store as pre-selection name
                                      setReferenceDisplayName(e.target.value);
                                    }
                                  }}
                                  placeholder="Reference material name…"
                                  className="w-full px-3 py-2 text-[12px] outline-none"
                                  style={{
                                    background: T.pageBg,
                                    border: `1.5px solid ${T.border}`,
                                    borderRadius: "10px",
                                    color: T.textMain,
                                    fontFamily: "inherit",
                                  }}
                                  onFocus={e => { e.currentTarget.style.borderColor = T.orange; }}
                                  onBlur={e => { e.currentTarget.style.borderColor = T.border; }}
                                />
                                {selectedFiles.length > 0 && (
                                  <p className="text-[9px] mt-1" style={{ color: T.textMuted }}>
                                    Extension <strong>.{selectedFiles[0].name.split(".").pop()}</strong> will be appended automatically
                                  </p>
                                )}
                              </div>
                            ) : (
                              /* ALL OTHER TYPES: show per-file name inputs only after files are picked */
                              selectedFiles.length > 0
                                ? selectedFiles.map((file) => (
                                  <div key={file.name} className="flex items-center gap-2 mb-2">
                                    <input
                                      type="text"
                                      value={(() => {
                                        const dn = fileDisplayNames[file.name] || file.name;
                                        const di = dn.lastIndexOf(".");
                                        return di > 0 ? dn.slice(0, di) : dn;
                                      })()}
                                      onChange={(e) => {
                                        const origExt = file.name.includes(".")
                                          ? "." + file.name.split(".").pop()
                                          : "";
                                        setFileDisplayNames((prev) => ({
                                          ...prev,
                                          [file.name]: e.target.value + origExt,
                                        }));
                                      }}
                                      className="flex-1 px-3 py-2 text-[12px] outline-none"
                                      style={{
                                        background: T.pageBg,
                                        border: `1.5px solid ${T.border}`,
                                        borderRadius: "10px",
                                        color: T.textMain,
                                      }}
                                      onFocus={e => { e.currentTarget.style.borderColor = T.orange; }}
                                      onBlur={e => { e.currentTarget.style.borderColor = T.border; }}
                                    />
                                    <span className="text-[11px]" style={{ color: T.textMuted }}>
                                      .{file.name.split(".").pop()}
                                    </span>
                                  </div>
                                ))
                                : null
                            )}
                          </div>
                        )}
                      </div>

                      {/* File Upload Area */}
                      <div>
                        <label className="block text-[11px] font-bold mb-2" style={{ color: T.textSub }}>
                          {updateFileId ? "Select New File (Optional)" : "File Upload"}{!updateFileId && <span style={{ color: '#DC2626' }}> *</span>}
                        </label>
                        <div
                          className="p-5 text-center cursor-pointer transition-all rounded-2xl"
                          style={{ border: `1.5px dashed ${T.border}`, background: T.pageBg }}
                          onClick={() => fileInputRef.current?.click()}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = T.orange; (e.currentTarget as HTMLElement).style.background = T.orangeLight; }}
                          onMouseLeave={e => { if (!(e.currentTarget as HTMLElement).dataset.dragover) { (e.currentTarget as HTMLElement).style.borderColor = T.border; (e.currentTarget as HTMLElement).style.background = T.pageBg; } }}
                          onDragOver={e => { e.preventDefault(); e.stopPropagation(); (e.currentTarget as HTMLElement).dataset.dragover = 'true'; (e.currentTarget as HTMLElement).style.borderColor = T.orange; (e.currentTarget as HTMLElement).style.background = T.orangeLight; }}
                          onDragLeave={e => { e.preventDefault(); delete (e.currentTarget as HTMLElement).dataset.dragover; (e.currentTarget as HTMLElement).style.borderColor = T.border; (e.currentTarget as HTMLElement).style.background = T.pageBg; }}
                          onDrop={e => { e.preventDefault(); e.stopPropagation(); delete (e.currentTarget as HTMLElement).dataset.dragover; (e.currentTarget as HTMLElement).style.borderColor = T.border; (e.currentTarget as HTMLElement).style.background = T.pageBg; handleFileSelection(e.dataTransfer.files); }}
                        >
                          <div className="mb-2" style={{ color: fileTypes.find((t) => t.key === selectedFileType)?.color || T.orange }}>
                            {React.cloneElement(fileTypes.find((t) => t.key === selectedFileType)?.icon as React.ReactElement || <Upload />, { size: 28 })}
                          </div>
                          <p className="text-[12px] font-bold mb-1" style={{ color: T.textMain }}>
                            {updateFileId ? "Click to choose a new file (optional)" : "Drop files here or click to browse"}
                          </p>
                          <p className="text-[10px]" style={{ color: T.textMuted }}>
                            {updateFileId
                              ? "Leave empty to keep current file"
                              : `Accepted: ${fileTypes.find((t) => t.key === selectedFileType)?.accept}${
                                  // Course Setup's ceiling for this type, so the
                                  // rule is visible before the file is picked
                                  // rather than only in the rejection message.
                                  uploadMaxSizeByType[selectedFileType]
                                    ? ` · max ${fmtLimit(uploadMaxSizeByType[selectedFileType]!)}`
                                    : ""
                                }`}
                          </p>
                          <input
                            ref={fileInputRef}
                            type="file"
                            multiple={!updateFileId}
                            accept={fileTypes.find((t) => t.key === selectedFileType)?.accept}
                            className="hidden"
                            onChange={(e) => handleFileSelection(e.target.files)}
                          />
                        </div>

                        {/* Show current file info ONLY when no new file is selected */}
                        {updateFileId && updateFileType !== "url" && uploadingFiles.length === 0 && (
                          <div className="mt-2 p-2 rounded-lg" style={{ background: T.orangeLight, border: `1px solid ${T.orange}30` }}>
                            <p className="text-[10px] font-medium" style={{ color: T.orange }}>
                              📄 Current file: {fileDisplayNames[updateFileId] || "Unknown"} (will be kept)
                            </p>
                          </div>
                        )}

                        {/* Show selected new file progress bar with replacement info */}
                        {uploadingFiles.map((f) => (
                          <div key={f.id} className="p-3 rounded-xl mt-2" style={{ background: T.pageBg, border: `1.5px solid ${T.border}` }}>
                            <div className="flex items-center mb-1.5">
                              <Upload size={11} className="mr-1.5" style={{ color: T.textMuted }} />
                              <span className="text-[11px] flex-1" style={{ color: T.textMain }}>
                                {f.name}
                              </span>
                              <span className="text-[10px]" style={{ color: T.textMuted }}>{f.progress}%</span>
                            </div>
                            <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: T.border }}>
                              <div className="h-full rounded-full transition-all duration-200" style={{
                                width: `${f.progress}%`,
                                background: f.status === "error" ? '#ef4444' :
                                  f.status === "completed" ? '#10b981' :
                                    T.orange
                              }} />
                            </div>
                            {f.status === "ready" && (
                              <div className="text-[10px] font-semibold mt-1" style={{ color: T.orange }}>
                                🔄 Ready to replace existing file
                              </div>
                            )}
                            {f.status === "uploading" && (
                              <div className="text-[10px] font-semibold mt-1" style={{ color: T.orange }}>
                                ⬆️ Uploading new file...
                              </div>
                            )}
                            {updateFileId && uploadingFiles.length > 0 && (
                              <div className="mt-2">
                                <button
                                  onClick={() => {
                                    // Clear all file selection states
                                    setSelectedFiles([]);
                                    setUploadingFiles([]);
                                    setFileDisplayNames({});
                                    // Reset the file input
                                    if (fileInputRef.current) {
                                      fileInputRef.current.value = '';
                                    }
                                  }}
                                  className="text-[10px] text-red-500 hover:text-red-600 flex items-center gap-1"
                                >
                                  <X size={12} />
                                  Clear selection
                                </button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>

                      {/* Description field */}
                      <div>
                        <label className="block text-[11px] font-bold mb-2" style={{ color: T.textSub }}>
                          File Description
                        </label>
                        <div className="rounded-xl overflow-hidden" style={{ border: `1.5px solid ${T.border}` }}>
                          <TipTapEditor
                            value={uploadDescription}
                            onChange={(value) => {
                              console.log("Editor changed:", value);
                              setUploadDescription(value);
                            }}
                            placeholder="Enter file description here..."
                            minHeight="160px"
                            maxHeight="200px"
                            showToolbar={true}
                            editable={true}
                          />
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Tags */}
              {/* <div>
                <div className="space-y-3">
                  <div className="flex items-end gap-2">
                    <div className="flex-1"><label className="block text-[11px] font-bold mb-1.5" style={{ color: T.textSub }}>Tag Name</label><input type="text" value={uploadCurrentTag} onChange={(e) => setUploadCurrentTag(e.target.value)} placeholder="Tag name…" className="w-full px-3 py-2 text-[12px] outline-none" style={{ background: T.pageBg, border: `1.5px solid ${T.border}`, borderRadius: '10px', color: T.textMain }} onFocus={e => e.currentTarget.style.borderColor = T.orange} onBlur={e => e.currentTarget.style.borderColor = T.border} /></div>
                    <div><label className="text-[11px] font-bold mb-1.5 block" style={{ color: T.textSub }}>Color</label><input type="color" value={uploadTagColor} onChange={(e) => setUploadTagColor(e.target.value)} className="w-8 h-8 rounded-lg cursor-pointer" style={{ border: `1.5px solid ${T.border}` }} /></div>
                    <button onClick={() => addUploadTag(uploadCurrentTag.trim(), uploadTagColor)} disabled={!uploadCurrentTag.trim()} className="px-3 py-2 text-white text-[12px] font-bold rounded-xl transition-all" style={{ background: uploadCurrentTag.trim() ? T.orange : T.border }} onMouseEnter={e => { if (uploadCurrentTag.trim()) (e.currentTarget as HTMLElement).style.background = T.orangeDark; }} onMouseLeave={e => { if (uploadCurrentTag.trim()) (e.currentTarget as HTMLElement).style.background = T.orange; }}>Add</button>
                  </div>
                  {uploadTags.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {uploadTags.map((tag, i) => (
                        <div key={i} className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold" style={{ background: `${tag.tagColor}15`, color: tag.tagColor, border: `1.5px solid ${tag.tagColor}35` }}>
                          {tag.tagName}<button onClick={() => removeUploadTag(i)} className="ml-1"><X size={10} /></button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div> */}

              {/* Settings */}
              {/* <div>
                <div className="space-y-2.5">
                  {[
                    { key: "studentShow" as const, icon: <Eye size={15} />, label: "Show to students", desc: "Make visible to students" },
                    { key: "downloadAllow" as const, icon: <Download size={15} />, label: "Allow download", desc: "Students can download" },
                  ].map(({ key, icon, label, desc }) => (
                    <div key={key} className="flex items-center justify-between p-3 rounded-xl" style={{ background: T.pageBg }}>
                      <div className="flex items-center gap-3">
                        <div className="p-1.5 rounded-lg" style={{ background: T.bg, border: `1px solid ${T.border}`, color: T.textSub }}>{icon}</div>
                        <div><p className="text-[12px] font-bold" style={{ color: T.textMain }}>{label}</p><p className="text-[10px] mt-0.5" style={{ color: T.textMuted }}>{desc}</p></div>
                      </div>
                      <OrangeToggle
                        checked={documentSettings[updateFileId || "temp"]?.[key] ?? true}
                        onChange={(checked) => { const id = updateFileId || "temp"; const cur = documentSettings[id] || { studentShow: true, downloadAllow: true }; const next = { ...cur, [key]: checked }; setDocumentSettings((prev) => ({ ...prev, [id]: next })); if (updateFileId && updateFileId !== "temp") handleUpdateFileSettings(updateFileId, next); }}
                      />
                    </div>
                  ))}
                </div>
              </div> */}
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-3 p-4 flex-shrink-0" style={{ borderTop: `1px solid ${T.border}`, background: T.pageBg }}>
              <button
                onClick={() => { resetUploadModalStates(); setShowNotionModal(true); }}
                className="px-4 py-2 rounded-xl text-[12px] font-bold transition-all"
                style={{ background: T.bg, color: T.textSub, border: `1.5px solid ${T.border}` }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = T.orange}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = T.border}
              >
                Cancel
              </button>

              <button
                onClick={async () => {
                  setIsButtonLoading(true);

                  // Handle URL type
                  if (selectedFileType === "url") {
                    if (!folderUrl.trim()) {
                      alert("Enter a valid URL");
                      setIsButtonLoading(false);
                      return;
                    }
                    if (!selectedNode) {
                      setIsButtonLoading(false);
                      return;
                    }

                    const navState = getCurrentNavState();
                    const formData = new FormData();
                    const fields: Record<string, string> = {
                      fileUrl: folderUrl,
                      fileName: urlFileName || extractFileNameFromUrl(folderUrl),
                      fileType: urlFileType,
                      fileDescription: uploadDescription || "",
                      tabType: toBackendTab(activeTab),
                      subcategory: activeSubcategory,
                      folderPath: navState.currentFolderPath.join("/"),
                      courses: selectedNode.originalData?.courses || "",
                      topicId: selectedNode.originalData?.topicId || "",
                      index: String(selectedNode.originalData?.index || 0),
                      isUpdate: updateFileId ? "true" : "false",
                      showToStudents: String(documentSettings[updateFileId || "temp"]?.studentShow ?? true),
                      allowDownload: String(documentSettings[updateFileId || "temp"]?.downloadAllow ?? true)
                    };

                    if (updateFileId) fields.updateFileId = updateFileId;
                    if (updateFileId) fields.updateFileName = urlFileName || extractFileNameFromUrl(folderUrl);

                    Object.entries(fields).forEach(([k, v]) => formData.append(k, v));
                    if (uploadTags.length) formData.append("tags", JSON.stringify(uploadTags));

                    // Carry the group context (set when the picker was opened via
                    // a group row's "+ Add resource to this group" button) through
                    // to the server so the URL is attached to that group. Without
                    // this, the URL would land at activity root and would not show
                    // up inside the group row.
                    if (uploadGroupId)   formData.append("groupId", uploadGroupId);
                    if (uploadGroupName) formData.append("groupName", uploadGroupName);

                    try {
                      await entityApi.updateEntity(selectedNode.type as any, selectedNode.id, formData);
                      await fetchAndRefresh(selectedNode);
                      resetUploadModalStates();
                      showSuccessToast(updateFileId ? "URL updated!" : "URL added!");
                    } catch {
                      showErrorToast(updateFileId ? "Failed to update URL" : "Failed to add URL");
                    } finally {
                      setIsButtonLoading(false);
                    }
                    return;
                  }

                  // Handle file updates (regular files)
                  if (updateFileId) {
                    // Case 1: Update metadata only (no new file selected)
                    if (uploadingFiles.length === 0) {
                      await handleFileUpdate(null);
                    }
                    // Case 2: Update file content (new file selected)
                    else {
                      const allReady = uploadingFiles.every((f) => f.status === "ready");
                      if (!allReady) {
                        alert("Please wait for files to finish preparing");
                        setIsButtonLoading(false);
                        return;
                      }

                      setUploadingFiles((prev) => prev.map((f) => ({ ...f, status: "submitting" as const })));

                      // Create renamed files with custom display names
                      const renamed = selectedFiles.map((file) => {
                        const display = fileDisplayNames[updateFileId] || fileDisplayNames[file.name] || file.name;
                        const final = selectedFileType === "reference" ? "Reference Material" : display;
                        const ext = file.name.split(".").pop();
                        const withExt = final.includes(".") ? final : `${final}.${ext}`;
                        return withExt !== file.name ? new window.File([file], withExt, { type: file.type }) : file;
                      });

                      const dt = new DataTransfer();
                      renamed.forEach((f) => dt.items.add(f));
                      await handleFileUpdate(dt.files);
                    }
                  }
                  // Handle new file upload
                  else {
                    const allReady = uploadingFiles.every((f) => f.status === "ready");
                    if (!allReady) {
                      alert("Please wait for files to finish preparing");
                      setIsButtonLoading(false);
                      return;
                    }

                    setUploadingFiles((prev) => prev.map((f) => ({ ...f, status: "submitting" as const })));

                    // Create renamed files with custom display names
                    const renamed = selectedFiles.map((file) => {
                      const display = fileDisplayNames[file.name] || file.name;
                      const final = selectedFileType === "reference" ? "Reference Material" : display;
                      const ext = file.name.split(".").pop();
                      const withExt = final.includes(".") ? final : `${final}.${ext}`;
                      return withExt !== file.name ? new window.File([file], withExt, { type: file.type }) : file;
                    });

                    const dt = new DataTransfer();
                    renamed.forEach((f) => dt.items.add(f));
                    await handleFileUpload(dt.files, activeTab, activeSubcategory);
                  }

                  setIsButtonLoading(false);
                }}
                disabled={
                  selectedFileType === "url"
                    ? !folderUrl.trim()
                    : updateFileId
                      ? false  // Always enabled for updates (can update metadata only)
                      : uploadingFiles.length === 0 || !uploadingFiles.every((f) => f.status === "ready")
                }
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-[12px] font-bold text-white transition-all"
                style={{ background: T.orange, boxShadow: `0 4px 12px ${T.orangeGlow}` }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.background = T.orangeDark;
                  (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)';
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.background = T.orange;
                  (e.currentTarget as HTMLElement).style.transform = 'none';
                }}
              >
                {selectedFileType === "url" ? (
                  <><Link2 size={14} />{updateFileId ? "Update URL" : "Add URL"}</>
                ) : updateFileId ? (
                  uploadingFiles.length > 0 ? (
                    <><RefreshCw size={14} />Update File & Metadata</>
                  ) : (
                    <><RefreshCw size={14} />Update Metadata Only</>
                  )
                ) : (
                  <><Upload size={14} />Upload Files</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Folder Builder unsaved-changes warning ──────────────────────────────── */}
      {showFolderUnsavedWarning && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center" style={{ background: 'rgba(15,15,30,0.60)', backdropFilter: 'blur(5px)' }} onClick={() => setShowFolderUnsavedWarning(false)}>
          <div className="flex flex-col gap-4 p-5 rounded-2xl mx-4" style={{ background: T.bg, border: `1.5px solid ${T.border}`, boxShadow: '0 20px 50px rgba(0,0,0,0.22)', maxWidth: 360, width: '100%' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(245,158,11,0.10)', border: '1.5px solid rgba(245,158,11,0.25)' }}>
                <AlertCircle size={20} style={{ color: '#d97706' }} />
              </div>
              <div>
                <p className="text-[13.5px] font-bold" style={{ color: T.textMain }}>Unsaved folders</p>
                <p className="text-[11px] mt-0.5" style={{ color: T.textMuted }}>
                  <strong style={{ color: '#d97706' }}>{virtualFolders.length}</strong> folder{virtualFolders.length !== 1 ? 's' : ''} · <strong style={{ color: '#d97706' }}>{virtualFolders.reduce((s, vf) => s + vf.files.length, 0)}</strong> file{virtualFolders.reduce((s, vf) => s + vf.files.length, 0) !== 1 ? 's' : ''} not yet uploaded.
                </p>
              </div>
            </div>
            <p className="text-[11.5px] leading-relaxed" style={{ color: T.textSub }}>Closing will discard all virtual folders and their files.</p>
            <div className="flex gap-2">
              <button className="flex-1 py-2 rounded-xl text-[12px] font-bold transition-all" style={{ background: 'rgba(239,68,68,0.08)', color: '#dc2626', border: '1.5px solid rgba(239,68,68,0.20)' }} onClick={closeFolderBuilder}>Discard &amp; Close</button>
              <button className="flex-1 py-2 rounded-xl text-[12px] font-bold text-white transition-all" style={{ background: T.orange, boxShadow: `0 3px 10px ${T.orangeGlow}` }} onClick={() => setShowFolderUnsavedWarning(false)}>Keep Editing</button>
            </div>
            {fbHasWork() && (
              <button className="w-full py-1.5 rounded-xl text-[12px] font-bold flex items-center justify-center gap-1.5 transition-all" style={{ background: T.pageBg, color: T.textSub, border: `1.5px solid ${T.border}` }}
                onClick={() => { setShowFolderUnsavedWarning(false); uploadVirtualFolders(); }}>
                <Upload size={12} /> Create Now &amp; Close
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Folder Builder Modal ──────────────────────────────────────────────────── */}
      {showFolderBuilderModal && (() => {
        const { folders: lvFolders, files: lvFiles } = fbGetCurrentLevel();
        // Phase 1: existing content at this nav level (server-side state).
        // Renders as additional rows alongside the virtual content, so the
        // user can see what's already there and navigate into it.
        const { folders: exFolders, files: exFiles, pages: exPages, groups: exGroups } = fbGetExistingAtCurrentLevel();
        const { folders: totalFolders, files: totalFiles } = fbCountAll();
        const extColorMap: Record<string, string> = { pdf: '#ef4444', ppt: '#f97316', pptx: '#f97316', doc: '#3b82f6', docx: '#3b82f6', xls: '#10b981', xlsx: '#10b981', mp4: '#06b6d4', mov: '#06b6d4', zip: '#a855f7', rar: '#a855f7', png: '#ec4899', jpg: '#ec4899', jpeg: '#ec4899' };
        const fmtSz = (sz: number) => sz < 1024 ? `${sz} B` : sz < 1048576 ? `${(sz / 1024).toFixed(1)} KB` : `${(sz / 1048576).toFixed(1)} MB`;
        // Windows-Explorer-style date, e.g. "7/25/2025 10:50 AM". Tolerates raw
        // strings, epoch numbers, and Mongo extended-JSON ({ $date }).
        const fmtDate = (d: any): string => {
          if (!d) return '—';
          const raw = (typeof d === 'object' && d !== null) ? (d.$date ?? d.date ?? d) : d;
          const dt = new Date(raw);
          if (isNaN(dt.getTime())) return '—';
          return dt.toLocaleString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }).replace(',', '');
        };
        // Best-effort byte size off a raw server file object (size may be string).
        const rawSize = (f: any): number => {
          const s = f?.size ?? f?.fileSize ?? f?.bytes;
          const n = typeof s === 'string' ? parseInt(s, 10) : Number(s);
          return Number.isFinite(n) ? n : 0;
        };
        const currentPageFolderPath = getCurrentNavState().currentFolderPath;

        return (
          <div className="fixed inset-0 z-[90] flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.52)', backdropFilter: 'blur(4px)' }}>
            <div className="relative flex flex-col mx-4 overflow-hidden" style={{ background: T.bg, borderRadius: '20px', border: `1.5px solid ${T.border}`, width: 924, maxWidth: 'calc(100vw - 32px)', height: '92.4vh', maxHeight: '92.4vh', boxShadow: '0 24px 60px rgba(0,0,0,0.20)', fontFamily: "'Poppins',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" }} onClick={e => e.stopPropagation()}>

              {/* ── Upload overlay ─────────────────────────────────────────── */}
              {folderBuilderUploading && (
                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 rounded-[20px]" style={{ background: 'rgba(255,255,255,0.94)', backdropFilter: 'blur(4px)' }}>
                  <div className="w-10 h-10 rounded-full animate-spin" style={{ border: `3px solid ${T.orangeLight}`, borderTopColor: T.orange }} />
                  <p className="text-[13px] font-bold" style={{ color: T.textMain }}>Creating folders &amp; uploading files…</p>
                  <div className="w-full max-w-xs flex flex-col gap-2.5 px-4 max-h-48 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
                    {fbFlattenTree(virtualFolders, currentPageFolderPath).map((entry, i) => (
                      <div key={i}>
                        <div className="flex justify-between mb-1">
                          <span className="text-[11px] font-semibold truncate" style={{ color: T.textSub }}>{entry.serverPath.join(' / ')}</span>
                          <span className="text-[11px] font-bold ml-2 flex-shrink-0" style={{ color: T.orange }}>{folderBuilderProgress[`flat-${i}`] ?? 0}%</span>
                        </div>
                        <div style={{ height: 3, background: T.border, borderRadius: 99, overflow: 'hidden' }}>
                          <div style={{ height: 3, width: `${folderBuilderProgress[`flat-${i}`] ?? 0}%`, background: `linear-gradient(90deg,${T.orange},${T.orangeDark})`, borderRadius: 99, transition: 'width 0.3s' }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Header ────────────────────────────────────────────────── */}
              <div className="relative overflow-hidden flex-shrink-0" style={{ background: '#F97316', padding: '12px 16px 14px', borderRadius: '18px 18px 0 0' }}>
                <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 0 }} viewBox="0 0 560 70" fill="none"><circle cx="530" cy="-8" r="65" stroke="rgba(255,255,255,0.15)" strokeWidth="1" /><circle cx="30" cy="80" r="50" stroke="rgba(255,255,255,0.10)" strokeWidth="1" /></svg>
                <div className="flex items-center justify-between" style={{ position: 'relative', zIndex: 1 }}>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(255,255,255,0.22)', border: '1px solid rgba(255,255,255,0.30)' }}>
                      <FolderPlus size={16} color="#fff" />
                    </div>
                    <div>
                      <h3 className="text-[14px] font-bold text-white leading-tight">Create Folders</h3>
                    </div>
                  </div>
                  <button onClick={() => fbHasWork() ? setShowFolderUnsavedWarning(true) : closeFolderBuilder()}
                    className="flex items-center justify-center w-8 h-8 rounded-full transition-all flex-shrink-0"
                    style={{ background: '#fff', border: 'none', color: '#F97316', boxShadow: '0 2px 6px rgba(0,0,0,0.18)' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#fee2e2'; (e.currentTarget as HTMLElement).style.color = '#dc2626'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#fff'; (e.currentTarget as HTMLElement).style.color = '#F97316'; }}
                    title="Close">
                    <X size={17} strokeWidth={2.5} />
                  </button>
                </div>
              </div>

              {/* ── Page location breadcrumb ───────────────────────────────── */}
              <div className="flex-shrink-0 flex flex-wrap items-center gap-x-1.5 gap-y-1 px-4 py-2" style={{ background: '#faf8ff', borderBottom: `1px solid ${T.border}` }}>
                <Home size={11} style={{ color: T.textMuted, flexShrink: 0 }} />
                <span className="text-[10.5px] font-medium flex-shrink-0" style={{ color: T.textMuted }}>Location:</span>
                {(() => {
                  const hi = buildFullHierarchyInfo();
                  const crumbs = [hi?.courseName, hi?.moduleName, hi?.subModuleName, hi?.topicName, hi?.subTopicName, hi?.tabType, hi?.subcategory, ...currentPageFolderPath].filter(Boolean);
                  return crumbs.map((c, i) => (
                    <React.Fragment key={i}>
                      {i > 0 && <ChevronRight size={10} style={{ color: T.textHint, flexShrink: 0 }} />}
                      <span className={`text-[10.5px] font-semibold ${i === crumbs.length - 1 ? 'flex-shrink-0' : 'truncate max-w-[150px]'}`} style={{ color: i === crumbs.length - 1 ? T.orange : T.textSub }} title={c}>{c}</span>
                    </React.Fragment>
                  ));
                })()}
              </div>

              {/* ── Internal navigable breadcrumb (Root > group? > folders) ──
                 Plain, no pill style. Rules:
                   • Root          → clickable (jumps back to FolderBuilder root)
                   • each nav entry → clickable (truncates the nav path);
                                      includes group anchors and existing
                                      folders. Group anchors look like regular
                                      folders in the path.
                   • last segment  → never clickable (current location);
                                     PlainBreadcrumb enforces this. */}
              {(() => {
                const crumbs: PlainCrumb[] = [
                  { label: "Root", onClick: () => fbNavigateTo(0) },
                ];
                fbNavPath.forEach((crumb, i) => {
                  crumbs.push({ label: crumb.name, onClick: () => fbNavigateTo(i + 1) });
                });
                return (
                  <PlainBreadcrumb
                    crumbs={crumbs}
                    prefix="Folder will be saved in:"
                  />
                );
              })()}

              {/* ── Body ──────────────────────────────────────────────────── */}
              <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: `${T.border} transparent` }}>
                <div className="p-4 flex flex-col gap-3">

                  {/* ── Action row: new folder + upload files ──────────── */}
                  <div className="flex gap-2 items-center flex-wrap">
                    <input type="text" value={folderBuilderNewName}
                      onChange={e => setFolderBuilderNewName(e.target.value)}
                      placeholder={fbNavPath.length ? `New sub-folder inside "${fbNavPath[fbNavPath.length - 1].name}"…` : 'New folder name…'}
                      onKeyDown={e => { if (e.key === 'Enter' && folderBuilderNewName.trim()) addVirtualFolder(); }}
                      className="flex-1 min-w-[160px] px-3 py-2 text-[12.5px] outline-none transition-all"
                      style={{ background: T.bg, border: `1.5px solid ${T.border}`, borderRadius: '10px', color: T.textMain }}
                      onFocus={e => { e.currentTarget.style.borderColor = T.orange; e.currentTarget.style.boxShadow = `0 0 0 2px ${T.orangeLight}`; }}
                      onBlur={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.boxShadow = 'none'; }}
                    />
                    <button onClick={addVirtualFolder} disabled={!folderBuilderNewName.trim() || folderBuilderUploading}
                      className="flex items-center gap-1.5 px-3 py-2 text-[12px] font-bold text-white rounded-xl transition-all disabled:opacity-40 flex-shrink-0"
                      style={{ background: T.orange, boxShadow: `0 3px 10px ${T.orangeGlow}` }}
                      onMouseEnter={e => { if (folderBuilderNewName.trim()) (e.currentTarget as HTMLElement).style.background = T.orangeDark; }}
                      onMouseLeave={e => { if (folderBuilderNewName.trim()) (e.currentTarget as HTMLElement).style.background = T.orange; }}>
                      <FolderPlus size={13} /> Add Folder
                    </button>
                    <button onClick={() => fbFileInputRef.current?.click()} disabled={folderBuilderUploading}
                      className="flex items-center gap-1.5 px-3 py-2 text-[12px] font-bold rounded-xl transition-all flex-shrink-0"
                      style={{ background: T.bg, border: `1.5px solid ${T.border}`, color: T.textSub }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#fb923c'; (e.currentTarget as HTMLElement).style.color = '#fb923c'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = T.border; (e.currentTarget as HTMLElement).style.color = T.textSub; }}>
                      <Upload size={13} /> Upload Files Here
                    </button>
                    <input ref={fbFileInputRef} type="file" multiple className="hidden"
                      accept={uploadFileRules.accept}
                      onChange={e => { fbAddFilesHere(Array.from(e.target.files || [])); e.target.value = ''; }} />
                  </div>

                  {/* ── Drop zone ─────────────────────────────────────────── */}
                  <div
                    className="rounded-xl flex flex-col items-center justify-center py-5 gap-1.5 cursor-pointer transition-all"
                    style={{
                      border: `2px dashed ${fbDragOverRoot ? '#F97316' : 'rgba(249,115,22,0.45)'}`,
                      background: fbDragOverRoot ? 'rgba(249,115,22,0.14)' : 'rgba(249,115,22,0.06)',
                      boxShadow: fbDragOverRoot ? '0 0 0 3px rgba(249,115,22,0.20)' : 'none',
                      transform: fbDragOverRoot ? 'scale(1.01)' : 'scale(1)',
                    }}
                    onDragOver={e => { e.preventDefault(); setFbDragOverRoot(true); }}
                    onDragLeave={() => setFbDragOverRoot(false)}
                    onDrop={e => { e.preventDefault(); setFbDragOverRoot(false); fbAddFilesHere(Array.from(e.dataTransfer.files)); }}
                    onClick={() => fbFileInputRef.current?.click()}>
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-0.5" style={{ background: fbDragOverRoot ? '#F97316' : 'rgba(249,115,22,0.14)', transition: 'background 0.15s' }}>
                      <Upload size={17} style={{ color: fbDragOverRoot ? '#fff' : '#F97316' }} strokeWidth={2} />
                    </div>
                    <span className="text-[12px] font-bold" style={{ color: '#F97316' }}>
                      {fbDragOverRoot
                        ? 'Drop to add files here'
                        : uploadFileRules.chips.length === 0
                          ? 'No file types are enabled for this course'
                          : fbNavPath.length
                            ? `Drop files into "${fbNavPath[fbNavPath.length - 1].name}"`
                            : 'Drag & drop files to Root · or click to browse'}
                    </span>
                    {/* Accepted types + each type's own size ceiling — the same
                        chips the Upload Files modal shows, since this drop zone
                        enforces the same rules. */}
                    {uploadFileRules.chips.length > 0 ? (
                      <div className="flex items-center justify-center gap-1.5 flex-wrap mt-0.5">
                        {uploadFileRules.chips.map(({ label, color, limit }) => (
                          <span key={label} style={{
                            fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 4,
                            background: `${color}10`, color, border: `1px solid ${color}20`,
                            letterSpacing: '0.02em',
                          }}>
                            {label}
                            {limit ? <span style={{ fontWeight: 500, opacity: 0.75 }}> · {fmtLimit(limit)}</span> : null}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-[10.5px]" style={{ color: T.textMuted }}>
                        Enable one in Course Setup › Resource Type to upload files here
                      </span>
                    )}
                  </div>

                  {/* ── Current level contents (virtual / newly-added — shown FIRST so user sees their additions on top) ─────────────────────────── */}
                  {(lvFolders.length > 0 || lvFiles.length > 0) ? (
                    <div className="rounded-2xl overflow-hidden" style={{ border: `1.5px solid ${T.border}` }}>

                      {/* Folder rows */}
                      {lvFolders.map((vf, fi) => {
                        const deepCount = fbFlattenTree([vf], []).length - 1;
                        return (
                          <div key={vf.id}
                            className="group/frow"
                            style={{ borderBottom: fi < lvFolders.length - 1 || lvFiles.length > 0 ? `1px solid ${T.border}` : 'none', background: T.bg, cursor: vf.isEditingName ? 'default' : 'pointer', transition: 'background 0.13s' }}
                            onClick={() => !vf.isEditingName && fbNavigateInto(vf)}
                            onMouseEnter={e => { if (!vf.isEditingName) (e.currentTarget as HTMLElement).style.background = 'rgba(232,100,12,0.04)'; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = T.bg; }}>
                            <div className="flex items-center gap-2.5 px-3 py-2.5">
                              {/* Folder icon */}
                              <div className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: T.orangeLight, border: `1px solid rgba(232,100,12,0.22)` }}>
                                <FolderOpen size={15} style={{ color: T.orange }} />
                              </div>
                              {/* Name */}
                              <div className="flex-1 min-w-0">
                                {vf.isEditingName ? (
                                  <input type="text" value={vf.editNameValue} autoFocus
                                    onChange={e => fbUpdateFolderName(vf.id, e.target.value)}
                                    onBlur={() => fbCommitFolderName(vf.id)}
                                    onKeyDown={e => { if (e.key === 'Enter') fbCommitFolderName(vf.id); if (e.key === 'Escape') fbCancelFolderName(vf.id); }}
                                    onClick={e => e.stopPropagation()}
                                    className="w-full text-[12.5px] font-bold px-1.5 py-0.5 outline-none rounded"
                                    style={{ border: `1.5px solid ${T.orange}`, color: T.textMain, background: T.pageBg }}
                                  />
                                ) : (
                                  <p className="truncate text-[12.5px] font-bold" style={{ color: T.textMain }}>
                                    {vf.name}
                                  </p>
                                )}
                                <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                  <span className="text-[10px] font-semibold" style={{ color: T.textMuted }}>
                                    {vf.files.length} file{vf.files.length !== 1 ? 's' : ''}
                                    {deepCount > 0 && ` · ${deepCount} sub-folder${deepCount !== 1 ? 's' : ''}`}
                                  </span>
                                  <span className="text-[10px] font-bold" style={{ color: '#d97706' }}>· yet to save</span>
                                </div>
                              </div>
                              {/* Arrow indicator */}
                              <ChevronRight size={15} style={{ color: T.orange, flexShrink: 0 }} />
                              {/* Rename */}
                              {!vf.isEditingName && (
                                <button className="flex-shrink-0 p-1.5 rounded-lg transition-all" style={{ color: T.textHint }}
                                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = T.blueLight; (e.currentTarget as HTMLElement).style.color = T.blue; }}
                                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = T.textHint; }}
                                  onClick={e => { e.stopPropagation(); fbStartRenameFolder(vf.id); }} title="Rename">
                                  <FilePlus2 size={13} />
                                </button>
                              )}
                              {/* Delete */}
                              <button className="flex-shrink-0 p-1.5 rounded-lg transition-all" style={{ color: T.textHint }}
                                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.08)'; (e.currentTarget as HTMLElement).style.color = '#ef4444'; }}
                                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = T.textHint; }}
                                onClick={e => { e.stopPropagation(); removeVirtualFolder(vf.id); }} title="Remove">
                                <X size={13} />
                              </button>
                            </div>
                          </div>
                        );
                      })}

                      {/* File rows */}
                      {lvFiles.map((vff, fi) => {
                        const ext = vff.file.name.includes('.') ? vff.file.name.split('.').pop()?.toLowerCase() ?? '' : '';
                        const extColor = extColorMap[ext] ?? T.orange;
                        return (
                          <div key={vff.id} style={{ borderBottom: fi < lvFiles.length - 1 ? `1px solid ${T.border}` : 'none', background: T.bg }}>
                            <div className="flex items-center gap-2.5 px-3 py-2">
                              <div className="flex-shrink-0 w-7 h-7 rounded-md flex items-center justify-center" style={{ background: `${extColor}14`, border: `1px solid ${extColor}28`, color: extColor }}>
                                <FileIcon size={13} />
                              </div>
                              <div className="flex-1 min-w-0">
                                {vff.isEditingName ? (
                                  <input type="text" value={vff.editNameValue} autoFocus
                                    onChange={e => fbUpdateFileName(vff.id, e.target.value)}
                                    onBlur={() => fbCommitFileName(vff.id)}
                                    onKeyDown={e => { if (e.key === 'Enter') fbCommitFileName(vff.id); if (e.key === 'Escape') fbCancelFileName(vff.id); }}
                                    className="w-full text-[12px] font-semibold px-1 py-0.5 outline-none rounded"
                                    style={{ border: `1.5px solid ${T.orange}`, color: T.textMain, background: T.pageBg }}
                                  />
                                ) : (
                                  <p className="truncate text-[12px] font-semibold cursor-text" style={{ color: T.textMain }}
                                    title="Double-click to rename" onDoubleClick={() => fbStartRenameFile(vff.id)}>
                                    {vff.displayName || vff.file.name}
                                  </p>
                                )}
                                <p className="text-[10.5px]" style={{ color: T.textMuted }}>{fmtSz(vff.file.size)}</p>
                              </div>
                              <span className="flex-shrink-0 text-[9px] font-bold uppercase px-1.5 py-0.5 rounded"
                                style={{ background: `${extColor}14`, color: extColor, border: `1px solid ${extColor}28`, letterSpacing: '0.05em' }}>{ext || 'file'}</span>
                              <button onClick={() => fbRemoveFile(vff.id)} className="flex-shrink-0 p-1 rounded transition-all" style={{ color: T.textHint }}
                                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.08)'; (e.currentTarget as HTMLElement).style.color = '#ef4444'; }}
                                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = T.textHint; }}>
                                <X size={12} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    // Only show the empty state when there's truly nothing —
                    // no virtual content AND no existing content at this level.
                    (exGroups.length === 0 && exFolders.length === 0 && exFiles.length === 0 && exPages.length === 0) && (
                      <div className="flex flex-col items-center justify-center py-10 gap-2.5 rounded-2xl" style={{ border: `1.5px dashed ${T.border}`, background: T.pageBg }}>
                        <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: T.orangeLight }}>
                          {fbNavPath.length > 0 ? <FolderOpen size={22} style={{ color: T.orange }} /> : <Folder size={22} style={{ color: T.orange }} />}
                        </div>
                        <p className="text-[13px] font-bold" style={{ color: T.textMain }}>
                          {fbNavPath.length > 0 ? `"${fbNavPath[fbNavPath.length - 1].name}" is empty` : 'No folders or files yet'}
                        </p>
                        <p className="text-[11px]" style={{ color: T.textMuted }}>
                          {fbNavPath.length > 0 ? 'Add a sub-folder or upload files using the buttons above' : 'Type a folder name and click Add Folder, or drag files to root'}
                        </p>
                      </div>
                    )
                  )}

                  {/* ── Existing content at this nav level (Phase 1) ───────
                      Surfaces what's already on the server so the user can
                      see context and click into existing folders / groups.
                      Read-only for now — delete/rename come in Phase 2/3. */}
                  {(exGroups.length > 0 || exFolders.length > 0 || exFiles.length > 0 || exPages.length > 0) && (
                    <div className="rounded-2xl overflow-hidden" style={{ border: `1.5px solid ${T.border}`, background: T.bg }}>
                      {/* Section label */}
                      <div className="px-3 py-1.5" style={{ background: T.pageBg, borderBottom: `1px solid ${T.border}` }}>
                        <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: T.textMuted, letterSpacing: '0.08em' }}>
                          Already here
                        </span>
                      </div>

                      {/* Explorer-style column headers */}
                      <div className="flex items-center gap-2 px-3 py-1.5" style={{ background: '#fbfbfd', borderBottom: `1px solid ${T.border}` }}>
                        <span className="flex-1 min-w-0 text-[10.5px] font-bold" style={{ color: T.textSub }}>Name</span>
                        <span className="w-[140px] flex-shrink-0 text-[10.5px] font-bold" style={{ color: T.textSub }}>Date modified</span>
                        <span className="w-[96px] flex-shrink-0 text-[10.5px] font-bold" style={{ color: T.textSub }}>Type</span>
                        <span className="w-[72px] flex-shrink-0 text-[10.5px] font-bold text-right" style={{ color: T.textSub }}>Size</span>
                      </div>

                      {/* Group rows (clickable — only ever at activity root) */}
                      {exGroups.map((g) => (
                        <div key={`exg-${g.groupId}`}
                          className="flex items-center gap-2 px-3 py-2 cursor-pointer"
                          style={{ borderBottom: `1px solid ${T.border}`, background: T.bg, transition: 'background 0.13s' }}
                          onClick={() => fbNavigateIntoGroup(g.groupId, g.groupName)}
                          onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(249,115,22,0.06)'}
                          onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = T.bg}
                          title="Open">
                          <div className="flex-1 min-w-0 flex items-center gap-2">
                            <Folder size={16} style={{ color: '#F97316', flexShrink: 0 }} fill="rgba(249,115,22,0.18)" />
                            <span className="truncate text-[12.5px] font-semibold" style={{ color: T.textMain }}>{g.groupName}</span>
                          </div>
                          <span className="w-[140px] flex-shrink-0 text-[11px]" style={{ color: T.textMuted }}>—</span>
                          <span className="w-[96px] flex-shrink-0 text-[11px]" style={{ color: T.textMuted }}>Folder group</span>
                          <span className="w-[72px] flex-shrink-0 text-[11px] text-right" style={{ color: T.textMuted }} />
                        </div>
                      ))}

                      {/* Folder rows (clickable) */}
                      {exFolders.map((ef: any) => {
                        const last = fbNavPath[fbNavPath.length - 1];
                        const parentPath = last && last.kind === "existing" ? (last.existingPath ?? []) : [];
                        const folderPath = [...parentPath, ef.name];
                        return (
                          <div key={`exf-${ef._id ?? ef.name}`}
                            className="flex items-center gap-2 px-3 py-2 cursor-pointer"
                            style={{ borderBottom: `1px solid ${T.border}`, background: T.bg, transition: 'background 0.13s' }}
                            onClick={() => fbNavigateIntoExisting(ef.name, folderPath)}
                            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(249,115,22,0.06)'}
                            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = T.bg}
                            title="Open">
                            <div className="flex-1 min-w-0 flex items-center gap-2">
                              <Folder size={16} style={{ color: '#F97316', flexShrink: 0 }} fill="rgba(249,115,22,0.18)" />
                              <span className="truncate text-[12.5px] font-semibold" style={{ color: T.textMain }}>{ef.name}</span>
                            </div>
                            <span className="w-[140px] flex-shrink-0 text-[11px]" style={{ color: T.textMuted }}>{fmtDate(ef.updatedAt ?? ef.createdAt ?? ef.uploadedAt)}</span>
                            <span className="w-[96px] flex-shrink-0 text-[11px]" style={{ color: T.textMuted }}>File folder</span>
                            <span className="w-[72px] flex-shrink-0 text-[11px] text-right" style={{ color: T.textMuted }} />
                          </div>
                        );
                      })}

                      {/* File rows (read-only) */}
                      {exFiles.map((ef: any) => {
                        const name = ef.name || ef.fileName || 'Untitled';
                        const ext = name.includes('.') ? name.split('.').pop()?.toLowerCase() ?? '' : '';
                        const extColor = extColorMap[ext] ?? '#64748b';
                        const sz = rawSize(ef);
                        return (
                          <div key={`exfile-${ef._id ?? name}`}
                            className="flex items-center gap-2 px-3 py-2"
                            style={{ borderBottom: `1px solid ${T.border}`, background: T.bg }}>
                            <div className="flex-1 min-w-0 flex items-center gap-2">
                              <FileIcon size={15} style={{ color: extColor, flexShrink: 0 }} />
                              <span className="truncate text-[12px] font-medium" style={{ color: T.textMain }}>{name}</span>
                            </div>
                            <span className="w-[140px] flex-shrink-0 text-[11px]" style={{ color: T.textMuted }}>{fmtDate(ef.uploadedAt ?? ef.updatedAt ?? ef.createdAt)}</span>
                            <span className="w-[96px] flex-shrink-0 text-[11px] uppercase" style={{ color: T.textMuted }}>{ext ? `${ext} file` : 'File'}</span>
                            <span className="w-[72px] flex-shrink-0 text-[11px] text-right" style={{ color: T.textMuted }}>{sz > 0 ? fmtSz(sz) : ''}</span>
                          </div>
                        );
                      })}

                      {/* Page rows (read-only) */}
                      {exPages.map((ep: any) => {
                        const title = ep.title || 'Untitled page';
                        return (
                          <div key={`expage-${ep._id?.$oid ?? ep._id ?? title}`}
                            className="flex items-center gap-2 px-3 py-2"
                            style={{ borderBottom: `1px solid ${T.border}`, background: T.bg }}>
                            <div className="flex-1 min-w-0 flex items-center gap-2">
                              <FileText size={15} style={{ color: '#6366f1', flexShrink: 0 }} />
                              <span className="truncate text-[12px] font-medium" style={{ color: T.textMain }}>{title}</span>
                            </div>
                            <span className="w-[140px] flex-shrink-0 text-[11px]" style={{ color: T.textMuted }}>{fmtDate(ep.updatedAt ?? ep.createdAt)}</span>
                            <span className="w-[96px] flex-shrink-0 text-[11px]" style={{ color: T.textMuted }}>Page</span>
                            <span className="w-[72px] flex-shrink-0 text-[11px] text-right" style={{ color: T.textMuted }} />
                          </div>
                        );
                      })}
                    </div>
                  )}

                </div>
              </div>

              {/* ── Footer ─────────────────────────────────────────────────── */}
              <div className="flex-shrink-0 flex items-center justify-between px-4 py-3" style={{ borderTop: `1px solid ${T.border}`, background: T.pageBg }}>
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px]" style={{ color: T.textMuted }}>
                    <strong style={{ color: T.orange }}>{totalFolders}</strong> folder{totalFolders !== 1 ? 's' : ''} &nbsp;·&nbsp;
                    <strong style={{ color: T.orange }}>{totalFiles}</strong> file{totalFiles !== 1 ? 's' : ''} total
                  </span>
                  {fbNavPath.length > 0 && (
                    <button className="text-[10.5px] font-bold px-2 py-0.5 rounded-lg transition-all" style={{ color: T.textSub, background: T.bg, border: `1px solid ${T.border}` }}
                      onClick={() => fbNavigateTo(0)}>
                      ↩ Back to Root
                    </button>
                  )}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => fbHasWork() ? setShowFolderUnsavedWarning(true) : closeFolderBuilder()}
                    disabled={folderBuilderUploading}
                    className="px-3.5 py-1.5 rounded-xl text-[12px] font-bold transition-all"
                    style={{ background: T.bg, border: `1.5px solid ${T.border}`, color: T.textSub, opacity: folderBuilderUploading ? 0.5 : 1 }}>
                    Cancel
                  </button>
                  <button onClick={uploadVirtualFolders}
                    disabled={!fbHasWork() || folderBuilderUploading}
                    className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-[12px] font-bold text-white transition-all disabled:opacity-40"
                    style={{ background: T.orange, boxShadow: `0 3px 10px ${T.orangeGlow}` }}
                    onMouseEnter={e => { if (fbHasWork() && !folderBuilderUploading) (e.currentTarget as HTMLElement).style.background = T.orangeDark; }}
                    onMouseLeave={e => { if (fbHasWork() && !folderBuilderUploading) (e.currentTarget as HTMLElement).style.background = T.orange; }}>
                    {folderBuilderUploading
                      ? <><div className="w-3 h-3 rounded-full animate-spin border-2 border-white/30 border-t-white" /> Creating…</>
                      : <><Upload size={13} /> Create ({totalFolders}f · {totalFiles}fi)</>
                    }
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Create / Edit Folder Modal ─────────────────────────────────────────── */}
      {showCreateFolderModal && (
        <div className="fixed inset-0 backdrop-blur-sm flex items-center justify-center z-50" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className={`relative flex flex-col mx-4 overflow-hidden ${isButtonLoading ? 'opacity-60 pointer-events-none' : ''}`} style={{ background: T.bg, borderRadius: '20px', border: `1.5px solid ${T.border}`, width: '100%', maxWidth: '860px', maxHeight: '85vh', minHeight: '380px', boxShadow: `0 24px 60px rgba(0,0,0,0.16)` }} onClick={e => e.stopPropagation()}>
            {isButtonLoading && (
              <div className="absolute inset-0 backdrop-blur-sm flex items-center justify-center z-10 rounded-2xl" style={{ background: 'rgba(255,255,255,0.85)' }}>
                <div className="w-9 h-9 rounded-full animate-spin" style={{ border: `3px solid ${T.orangeLight}`, borderTopColor: T.orange }} />
              </div>
            )}

            {/* Folder modal hero header */}
            <div className="relative overflow-hidden flex-shrink-0" style={{ background: 'linear-gradient(135deg, #F08243 0%, #E8640C 52%, #C95308 100%)', padding: '16px 18px 22px', borderRadius: '18px 18px 0 0' }}>
              <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 0 }} viewBox="0 0 560 80" fill="none"><circle cx="530" cy="-8" r="65" stroke="rgba(255,255,255,0.18)" strokeWidth="1.2" /><circle cx="530" cy="-8" r="115" stroke="rgba(255,255,255,0.10)" strokeWidth="1.2" /></svg>
              <div style={{ position: 'relative', zIndex: 1 }} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.22)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.30)' }}>
                    <Folder size={18} color="#fff" />
                  </div>
                  <div>
                    <h3 className="text-[14px] font-bold text-white">{editingFolder ? "Edit Folder" : "Create New Folder"}</h3>
                    <p className="text-[11px] mt-0.5" style={{ color: 'rgba(255,255,255,0.72)' }}>{editingFolder ? "Update folder details" : "Organize your files"}</p>
                  </div>
                </div>
                <button onClick={() => { setShowCreateFolderModal(false); setEditingFolder(null); setEditFolderName(""); setNewFolderName(""); setFolderTags([]); }} className="p-1.5 rounded-xl transition-all" style={{ background: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.25)', color: 'rgba(255,255,255,0.85)' }} onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.30)'} onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.18)'}><X size={15} /></button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
              <div className="rounded-2xl overflow-hidden" style={{ border: `1.5px solid ${T.border}` }}>
                <AccordionHeader icon={<Folder />} iconColor={T.orange} iconBg={T.orangeLight} title="Folder Details" subtitle={<span style={{ color: '#ef4444' }}>Required *</span>} sectionKey="folderName" currentKey={expandedSection} onToggle={setExpandedSection} />
                {expandedSection === "folderName" && (
                  <div className="p-4" style={{ background: T.bg }}>
                    <label className="block text-[11px] font-bold mb-2" style={{ color: T.textSub }}>Folder Name</label>
                    <input type="text" value={editingFolder ? editFolderName : newFolderName} onChange={(e) => editingFolder ? setEditFolderName(e.target.value) : setNewFolderName(e.target.value)} placeholder="Enter folder name…" autoFocus className="w-full px-3 py-2.5 text-[13px] outline-none transition-all" style={{ background: T.pageBg, border: `1.5px solid ${T.border}`, borderRadius: '10px', color: T.textMain }}
                      onFocus={e => { e.currentTarget.style.borderColor = T.orange; e.currentTarget.style.boxShadow = `0 0 0 3px ${T.orangeLight}`; }}
                      onBlur={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.boxShadow = 'none'; }}
                      onKeyPress={(e) => e.key === "Enter" && (editingFolder ? saveEditFolder() : createFolder())}
                    />
                  </div>
                )}
              </div>

              <div className="rounded-2xl overflow-hidden" style={{ border: `1.5px solid ${T.border}` }}>
                <AccordionHeader icon={<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>} iconColor="#10b981" iconBg="rgba(16,185,129,0.08)" title="Tags" subtitle={folderTags.length > 0 ? `${folderTags.length} tag(s)` : "Add tags"} sectionKey="tags" currentKey={expandedSection} onToggle={setExpandedSection} />
                {expandedSection === "tags" && (
                  <div className="p-4 space-y-3" style={{ background: T.bg }}>
                    <div className="flex items-end gap-2">
                      <div className="flex-1"><label className="block text-[11px] font-bold mb-1.5" style={{ color: T.textSub }}>Tag Name</label><input type="text" value={currentTag} onChange={(e) => setCurrentTag(e.target.value)} placeholder="Tag name…" className="w-full px-3 py-2 text-[12px] outline-none" style={{ background: T.pageBg, border: `1.5px solid ${T.border}`, borderRadius: '10px', color: T.textMain }} onFocus={e => e.currentTarget.style.borderColor = T.orange} onBlur={e => e.currentTarget.style.borderColor = T.border} /></div>
                      <div><label className="text-[11px] font-bold mb-1.5 block" style={{ color: T.textSub }}>Color</label><input type="color" value={tagColor} onChange={(e) => setTagColor(e.target.value)} className="w-8 h-8 rounded-lg cursor-pointer" style={{ border: `1.5px solid ${T.border}` }} /></div>
                      <button onClick={() => { if (currentTag.trim()) addTag(currentTag.trim(), tagColor); }} disabled={!currentTag.trim()} className="px-3 py-2 text-white text-[12px] font-bold rounded-xl" style={{ background: currentTag.trim() ? T.orange : T.border }}>Add</button>
                    </div>
                    {folderTags.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {folderTags.map((tag, i) => (
                          <div key={i} className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold" style={{ background: `${tag.tagColor}15`, color: tag.tagColor, border: `1.5px solid ${tag.tagColor}35` }}>
                            {tag.tagName}<button onClick={() => removeTag(i)} className="ml-1"><X size={10} /></button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {!editingFolder && (
                <div className="rounded-2xl overflow-hidden" style={{ border: `1.5px solid ${T.border}` }}>
                  <AccordionHeader icon={<Lock />} iconColor={T.orange} iconBg={T.orangeLight} title="Access" subtitle={accessLevel === "private" ? "Only you" : accessLevel === "team" ? "Your team" : "Public"} sectionKey="access" currentKey={expandedSection} onToggle={setExpandedSection} />
                  {expandedSection === "access" && (
                    <div className="p-4 space-y-2" style={{ background: T.bg }}>
                      {[{ value: "private", icon: Lock, label: "Private" }, { value: "team", icon: Users, label: "Team" }, { value: "public", icon: Globe, label: "Public" }].map(({ value, icon: Icon, label }) => (
                        <label key={value} className="flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition-all" style={{ background: accessLevel === value ? T.orangeLight : T.pageBg, border: `1.5px solid ${accessLevel === value ? T.orange : T.border}` }}>
                          <input type="radio" name="accessLevel" value={value} checked={accessLevel === value} onChange={(e) => setAccessLevel(e.target.value)} className="w-3.5 h-3.5" style={{ accentColor: T.orange }} />
                          <Icon size={14} style={{ color: accessLevel === value ? T.orange : T.textMuted }} />
                          <span className="text-[12px] font-semibold" style={{ color: accessLevel === value ? T.orange : T.textMain }}>{label}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 p-4 flex-shrink-0" style={{ borderTop: `1px solid ${T.border}`, background: T.pageBg }}>
              <button onClick={() => { setShowCreateFolderModal(false); setEditingFolder(null); setNewFolderName(""); setFolderTags([]); }} className="px-4 py-2 rounded-xl text-[12px] font-bold transition-all" style={{ background: T.bg, color: T.textSub, border: `1.5px solid ${T.border}` }}>Cancel</button>
              <button onClick={async () => { setIsButtonLoading(true); editingFolder ? await saveEditFolder() : await createFolder(); setIsButtonLoading(false); }} disabled={(editingFolder ? !editFolderName.trim() : !newFolderName.trim()) || isButtonLoading}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-[12px] font-bold text-white transition-all"
                style={{ background: T.orange, boxShadow: `0 4px 12px ${T.orangeGlow}` }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = T.orangeDark}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = T.orange}
              >
                {isButtonLoading ? <><div className="w-3.5 h-3.5 rounded-full animate-spin" style={{ border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff' }} />{editingFolder ? "Updating…" : "Creating…"}</> : <><Folder size={14} />{editingFolder ? "Update Folder" : "Create Folder"}</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirm ──────────────────────────────────────────────────────── */}
      {/* ── Delete Confirm ── */}
      {showDeleteConfirm && deleteTarget && (
        <div className="fixed inset-0 backdrop-blur-sm flex items-center justify-center z-50"
          style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="mx-4 p-6 rounded-2xl"
            style={{ background: T.bg, border: `1.5px solid ${T.border}`, width: '100%', maxWidth: '340px', boxShadow: '0 20px 50px rgba(0,0,0,0.15)' }}>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(239,68,68,0.1)' }}>
                <Trash2 size={20} style={{ color: '#ef4444' }} />
              </div>
              <div>
                <h3 className="text-[14px] font-bold" style={{ color: T.textMain }}>
                  {/* Show correct type label */}
                  Delete {deleteTarget.item?.isPage ? "page" : deleteTarget.type}
                </h3>
                <p className="text-[12px] mt-0.5" style={{ color: T.textMuted }}>
                  This action cannot be undone
                </p>
              </div>
            </div>

            <p className="text-[13px] mb-5" style={{ color: T.textSub }}>
              Are you sure you want to delete "
              <span style={{ color: T.textMain, fontWeight: 700 }}>{deleteTarget.name}</span>"?
            </p>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => { setShowDeleteConfirm(false); setDeleteTarget(null); }}
                className="px-4 py-2 rounded-xl text-[12px] font-bold transition-all"
                style={{ background: T.pageBg, color: T.textSub, border: `1.5px solid ${T.border}` }}
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (deleteTarget.item?.isPage) {
                    // Page delete — calls the pages API
                    await doDeletePage(deleteTarget.item.id, deleteTarget.name);
                  } else if (deleteTarget.type === "folder") {
                    await deleteFolder(deleteTarget.item);
                  } else {
                    await deleteFile(deleteTarget.item.id);
                  }
                }}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl text-[12px] font-bold text-white transition-all flex items-center gap-1.5 disabled:opacity-70 disabled:cursor-not-allowed"
                style={{ background: '#ef4444' }}
                onMouseEnter={e => !isDeleting && ((e.currentTarget as HTMLElement).style.background = '#dc2626')}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = '#ef4444'}
              >
                {isDeleting ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Deleting…</> : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ── Viewers ──────────────────────────────────────────────────────────────── */}
      {showZipViewer && <ZipViewer fileUrl={currentZipUrl} fileName={currentZipName} onClose={() => setShowZipViewer(false)} />}

{showPDFViewer && (
  <PDFViewer 
    fileUrl={currentPDFUrl} 
    fileName={currentPDFName} 
    fileId={currentPDFFileId} 
    entityType={selectedNode?.type} 
    institution={selectedNode?.originalData?.institution || ""} 
    courses={selectedNode?.originalData?.courses || ""} 
    entityId={selectedNode?.id} 
    tabType={activeTab || ""} 
    subcategory={activeSubcategory || ""} 
    folderPath={getCurrentNavState().currentFolderPath} 
    apiBaseUrl={API_BASE_URL} 
    onClose={() => { 
      setShowPDFViewer(false); 
      setCurrentPDFUrl(""); 
      setCurrentPDFName(""); 
      setCurrentPDFFileId(""); 
    }} 
    isTeacher={true} 
    initialMcqs={[]} 
    sampleLiveLink="https://example.com/live-mcq-sample"
    breadcrumbs={breadcrumbs}  // ← Add this
    onNavigateToCourse={() => {
      // Optional: handle course navigation when clicking course breadcrumb
      if (courseId) {
        router.push(`${parentSection.href}?courseId=${courseId}`);
      }
    }}
  />
)}
   {showPPTViewer && (
  <PPTViewer 
    isOpen={showPPTViewer} 
    onClose={() => { 
      setShowPPTViewer(false); 
      setCurrentPPTUrl(""); 
      setCurrentPPTName(""); 
      setCurrentPPTFileId(""); 
    }} 
    pptUrl={currentPPTUrl} 
    title={currentPPTName} 
    totalSlides={20}  // You might want to calculate actual slides
    fileId={currentPPTFileId} 
    entityType={selectedNode?.type || ""} 
    entityId={selectedNode?.id || ""} 
    tabType={toBackendTab(activeTab)} 
    subcategory={activeSubcategory} 
    folderPath={getCurrentNavState().currentFolderPath} 
    apiBaseUrl={API_BASE_URL} 
    isTeacher={true}
    breadcrumbs={breadcrumbs}  // ← ADD THIS
    currentCourseName={courseStructureResponse?.data?.courseName || "Course"}  // ← ADD THIS
    currentCourseId={courseId || ""}  // ← ADD THIS
  />
)}
      {/* Word Viewer */}
{showWordViewer && (
  <WordViewer
    fileUrl={currentWordUrl}
    fileName={currentWordName}
    onClose={() => {
      setShowWordViewer(false);
      setCurrentWordUrl("");
      setCurrentWordName("");
    }}
    isTeacher={true}
    breadcrumbs={breadcrumbs}
    currentCourseName={courseStructureResponse?.data?.courseName || "Course"}
    
  />
)}

      {/* TXT Viewer */}
  {showTxtViewer && (
  <TxtViewerTeacher
    fileUrl={currentTxtUrl}
    fileName={currentTxtName}
    isOpen={showTxtViewer}
    onClose={() => {
      setShowTxtViewer(false);
      setCurrentTxtUrl("");
      setCurrentTxtName("");
    }}
    breadcrumbs={breadcrumbs}
    currentCourseName={courseStructureResponse?.data?.courseName || "Course"}
   
  />
)}
      {/* Image Viewer */}
     {showImageViewer && (
  <ImageViewer
    isOpen={showImageViewer}
    imageUrl={currentImageUrl}
    title={currentImageName}
    fileId={currentImageFileId}
    entityType={selectedNode?.type}
    entityId={selectedNode?.id}
    tabType={activeTab || ""}
    subcategory={activeSubcategory || ""}
    folderPath={getCurrentNavState().currentFolderPath}
    onClose={() => {
      setShowImageViewer(false);
      setCurrentImageUrl("");
      setCurrentImageName("");
      setCurrentImageFileId("");
      setImagePlaylist([]);
      setCurrentImageIndex(0);
    }}
    apiBaseUrl={API_BASE_URL}
    isTeacher={true}
    allImages={imagePlaylist}
    currentImageIndex={currentImageIndex}
    onImageChange={(idx) => {
      setCurrentImageIndex(idx);
      const img = imagePlaylist[idx];
      setCurrentImageUrl(img.fileUrl);
      setCurrentImageName(img.title);
      setCurrentImageFileId(img.id);
    }}
    breadcrumbs={breadcrumbs}
    currentCourseName={courseStructureResponse?.data?.courseName || "Course"}

  />
)}

      {showVideoViewer && (
        <VideoViewer
          fileUrl={currentVideoUrl}
          fileName={currentVideoName}
          fileId={currentVideoFileId}
          entityType={selectedNode?.type}
          entityId={selectedNode?.id}
          tabType={activeTab}
          subcategory={activeSubcategory}
          folderPath={getCurrentNavState().currentFolderPath}
          availableResolutions={currentVideoResolutions}
          fileUrlMap={currentVideoFileUrlMap}
          {...viewerFeaturesFor("video")}
          isVideo={true}
          allVideos={videoPlaylist}
          currentVideoIndex={currentVideoIndex}
          onVideoChange={(idx) => {
            setCurrentVideoIndex(idx);
            const v = videoPlaylist[idx];
            setCurrentVideoUrl(v.fileUrl || "");
            setCurrentVideoName(v.fileName);
            setCurrentVideoResolutions(v.availableResolutions || []);
            setCurrentVideoFileUrlMap(v.fileUrlMap || {});
            setCurrentVideoFileId(v.id);
          }}
          onClose={() => {
            setShowVideoViewer(false);
            setCurrentVideoUrl("");
            setCurrentVideoName("");
            setCurrentVideoResolutions([]);
            setCurrentVideoFileUrlMap({});
            setVideoPlaylist([]);
            setCurrentVideoIndex(0);
            setCurrentVideoFileId("");
          }}
          apiBaseUrl={API_BASE_URL}
          isTeacher={true}
        />
      )}
    </>
  );
}
