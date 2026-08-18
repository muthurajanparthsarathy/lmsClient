"use client";

import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import {
  Target, Users, BookOpen, FileText,
  Eye, Download, RefreshCw, Trash2, MoreVertical, ExternalLink,
  Search, X, Plus, Folder, Link, Bookmark, Video, FileArchive,
  File, MonitorPlay, Edit2, Layout, ChevronRight, Home, ChevronDown,
  ArrowLeft, Maximize2, Minimize2, Code2, Wifi, UserRound, PenLine,
  FileSpreadsheet, Image as ImageIcon, FileAudio, FileVideo,
  Presentation, FileCode, FileType, Globe, Music, SlidersHorizontal,
  ClipboardList, ArrowUpDown, ArrowUp, ArrowDown,
} from "lucide-react";
import type {
  CourseNode, FolderItem, UploadedFile, ContentData, FileTypeConfig,
  BreadcrumbItem, FolderNavState,
} from "./Types";
import { isFolderItem } from "./Types";
import ProblemSolving from "../../../../component/ProblemSolving";
import TestYourSkills from "./youdo/TestYourSkills";
import Assessment from "./youdo/Assessment";
// SelfWork mock component no longer used — You Do > Self Work now reuses
// the same <ProblemSolving> UI that We Do > Assignments uses, so the data
// flow, search/filter/pagination, exercise creation, and student-side
// rendering all come for free.
// import SelfWork from "./youdo/SelfWork";
import { PageCreationModal, type PageBlock, type PagesPayload, type HierarchyInfo } from "./Pagecreationmodal";
import { entityApi } from "@/apiServices/coursesData";

// ─── Design tokens ─────────────────────────────────────────────────────────────
const T = {
  orange: "#E8640C",
  orangeDark: "#C95308",
  orangeDeep: "#A6440B",
  orangeGlow: "rgba(232,100,12,0.18)",
  orangeLight: "rgba(232,100,12,0.08)",
  orangeMid: "rgba(232,100,12,0.14)",
  textMain: "#0F172A",
  textSub: "#334155",
  textMuted: "#475569",
  textHint: "#64748B",
  border: "#eef0f4",
  bg: "#ffffff",
  pageBg: "#f8fafc",
  warm: "#fff7f1",
};

const TAB_META = {
  I_Do: {
    label: "I Do",
    icon: <Wifi size={14} strokeWidth={2.2} />,
    img: "/icons/ido.png",
    color: "#E8640C",
    bg: "rgba(232,100,12,0.10)",
    shadow: "rgba(232,100,12,0.30)",
  },
  We_Do: {
    label: "We Do",
    icon: <Users size={14} strokeWidth={2.2} />,
    img: "/icons/wedo.png",
    color: "#3B82F6",
    bg: "rgba(59,130,246,0.10)",
    shadow: "rgba(59,130,246,0.36)",
  },
  You_Do: {
    label: "You Do",
    icon: <UserRound size={14} strokeWidth={2.2} />,
    img: "/icons/youdo.png",
    color: "#10B981",
    bg: "rgba(16,185,129,0.10)",
    shadow: "rgba(16,185,129,0.36)",
  },
} as const;

// ─── Types ────────────────────────────────────────────────────────────────────
interface PageEntry {
  _id: string; title: string; combinedCode: string;
  pageCount?: number; createdAt?: string; isMultiPage?: boolean;
}

interface ViewingPage { code: string; title: string; pageCount?: number }

interface CourseContentProps {
  selectedNode: CourseNode | null;
  activeTab: "I_Do" | "We_Do" | "You_Do" | null;
  activeSubcategory: string;
  subcategories: {
    I_Do: Array<{ key: string; label: string; icon: React.ReactNode; component: string | null }>;
    We_Do: Array<{ key: string; label: string; icon: React.ReactNode; component: string | null }>;
    You_Do: Array<{ key: string; label: string; icon: React.ReactNode; component: string | null }>;
  };
  contentData: Record<string, ContentData>;
  breadcrumbs: BreadcrumbItem[];
  fileTypes: FileTypeConfig[];
  currentFolderContents: { folders: FolderItem[]; files: UploadedFile[] };
  folderNavState: FolderNavState;
  courseId: string;
  courseStructureName: string;
  configuredLanguages?: { coreProgram?: string[]; frontend?: string[]; database?: string[] };
  /**
   * Resources by Batch — the batch selected in the strip above this content.
   * "" for a course without batches, or when the open section is shared.
   *
   * It arrives as a prop (rather than being read from `resourceBatch`'s module
   * state inside the children) so that switching batches re-renders this
   * subtree. Without that, the We Do / You Do views kept the exercise list they
   * had mounted with and only corrected themselves when some unrelated
   * interaction forced a re-render.
   */
  activeBatchId?: string;
  /** Right corner of the I Do / We Do / You Do tab row — the batch picker. */
  tabBarRight?: React.ReactNode;
  pedagogy?: Record<string, any>;
  onTabChange: (tab: "I_Do" | "We_Do" | "You_Do") => void;
  onSubcategoryChange: (sub: string, component: string | null) => void;
  onResourceModalOpen: (groupId?: string, groupName?: string) => void;
  onFileClick: (file: UploadedFile, tab: "I_Do" | "We_Do" | "You_Do" | null, sub: string) => void;
  onNavigateToFolder: (id: string, name: string) => void;
  onNavigateUp: () => void;
  onNavigateToRoot?: () => void;
  onNavigateToFolderLevel?: (folderName: string, index: number) => void;
  onEditFolder: (folder: FolderItem) => void;
  onDeleteFolder: (folder: FolderItem) => void;
  onDeleteFile: (fileId: string, name: string) => void;
  onDeletePage?: (pageId: string, name: string) => void;
  onUpdateFile: (file: UploadedFile, tab: "I_Do" | "We_Do" | "You_Do", sub: string) => void;
  onEditGroup?: (group: { groupId: string; groupName: string; groupDescription?: string; folders: FolderItem[]; files: UploadedFile[]; subGroups?: SubGroupSeed[] }) => void;
  getParentNodeName: (node: CourseNode, type: string) => string;
  getFolderItemCount: (folderId: string) => number;
  getFolderTotalSize: (folderId: string) => number;
  onPageCreated?: () => Promise<void>;
  onBulkDelete: (items: Array<{ type: "file" | "folder" | "page"; id: string; name: string; folderItem?: FolderItem }>) => Promise<void>;
}

// ─── Combined Item Type for ordered rendering ──────────────────────────────────
type CombinedItem =
  | { type: 'folder'; data: FolderItem; sortDate: string }
  | { type: 'file'; data: UploadedFile; sortDate: string };

// Recursive sub-group tree node — used when passing nested sub-groups to the
// edit modal so the full group-inside-group structure is visible.
export type SubGroupSeed = {
  groupId: string;
  groupName: string;
  description: string;
  files: UploadedFile[];
  folders: FolderItem[];
  subGroups: SubGroupSeed[];
};

// ─── Folder Breadcrumb Component ───────────────────────────────────────────────
const FolderBreadcrumbBar: React.FC<{
  folderNavState: FolderNavState;
  groupName?: string;
  onGroupClick?: () => void;
  onNavigateUp: () => void;
  onNavigateToRoot?: () => void;
  onNavigateToFolderLevel?: (folderName: string, index: number) => void;
}> = ({ folderNavState, groupName, onGroupClick, onNavigateUp, onNavigateToRoot, onNavigateToFolderLevel }) => {
  const isInsideFolder = folderNavState.currentFolderId !== null;
  const folderPath = folderNavState.currentFolderPath || [];

  if (!isInsideFolder && folderPath.length === 0) return null;

  return (
    <div
      className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2"
      style={{ borderBottom: `1px solid ${T.border}` }}
    >
      <div className="flex items-center gap-1 overflow-x-auto flex-1" style={{ scrollbarWidth: "none" }}>
        {/* Root — always orange, always navigable */}
        <button
          onClick={() => onNavigateToRoot?.()}
          className="flex-shrink-0 text-[11px] font-semibold cursor-pointer"
          style={{ color: "#FB923C", background: "none", border: "none" }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "#EA580C"; (e.currentTarget as HTMLElement).style.textDecoration = "underline"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "#FB923C"; (e.currentTarget as HTMLElement).style.textDecoration = "none"; }}
        >
          Root
        </button>

        {/* Group crumb — shown when the current folder lives inside a group.
            Clicking it routes back to root (where the group accordion lives)
            and opens that group's dropdown. */}
        {groupName && (
          <div className="flex items-center gap-1 flex-shrink-0">
            <span style={{ color: T.textHint, fontSize: 11 }}>›</span>
            <button
              onClick={() => onGroupClick?.()}
              className="flex items-center gap-1 text-[11px] max-w-[140px] truncate cursor-pointer"
              style={{ color: "#FB923C", fontWeight: 500, background: "none", border: "none" }}
              title={groupName}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "#EA580C"; (e.currentTarget as HTMLElement).style.textDecoration = "underline"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "#FB923C"; (e.currentTarget as HTMLElement).style.textDecoration = "none"; }}
            >
              <Folder size={11} strokeWidth={2.2} style={{ flexShrink: 0 }} />
              {groupName}
            </button>
          </div>
        )}

        {folderPath.map((segment, idx) => {
          const isLast = idx === folderPath.length - 1;
          return (
            <div key={idx} className="flex items-center gap-1 flex-shrink-0">
              <span style={{ color: T.textHint, fontSize: 11 }}>›</span>
              <button
                onClick={() => onNavigateToFolderLevel?.(segment, idx)}
                className="text-[11px] max-w-[120px] truncate cursor-pointer"
                style={{
                  color: "#FB923C",
                  fontWeight: isLast ? 700 : 500,
                  background: "none",
                  border: "none",
                  textDecoration: isLast ? "underline" : "none",
                  textUnderlineOffset: 2,
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "#EA580C"; (e.currentTarget as HTMLElement).style.textDecoration = "underline"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "#FB923C"; (e.currentTarget as HTMLElement).style.textDecoration = isLast ? "underline" : "none"; }}
              >
                {segment}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function openPageInNewTab(code: string) {
  const t = window.open("", "_blank");
  if (!t) { alert("Popup blocked."); return; }
  t.document.open(); t.document.write(code); t.document.close();
}

const normKey = (r: string) => r.toLowerCase().replace(/\s+/g, "_");

// MongoDB Extended JSON sometimes ships `_id` (and similar fields) as
// `{ $oid: "..." }` instead of a flat string. Normalise to a plain string so
// it can be used as a Map key / object key consistently.
const normalizeId = (val: any): string => {
  if (val == null) return "";
  if (typeof val === "string") return val;
  if (typeof val === "object") {
    if (typeof val.$oid === "string") return val.$oid;
    if (typeof val.oid === "string") return val.oid;
    if (typeof val.toString === "function") {
      const s = val.toString();
      if (s && s !== "[object Object]") return s;
    }
  }
  return String(val);
};
const fmtSize = (b: number) => {
  if (!b) return "—";
  const k = 1024, s = ["B", "KB", "MB", "GB"], i = Math.floor(Math.log(b) / Math.log(k));
  return `${parseFloat((b / Math.pow(k, i)).toFixed(1))} ${s[i]}`;
};

// Used for aggregate sizes on Folder/Group rows. Always at least "0 KB"
// so the column never reads as empty for grouped/nested content.
const fmtFolderSize = (b: number): string => {
  if (!b || b <= 0) return "0 KB";
  const kb = b / 1024;
  if (kb < 1024) return `${kb < 10 ? kb.toFixed(1) : Math.round(kb)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb < 10 ? mb.toFixed(1) : Math.round(mb)} MB`;
  const gb = mb / 1024;
  return `${gb < 10 ? gb.toFixed(1) : Math.round(gb)} GB`;
};

const formatDateTime = (dateInput: any): string => {
  if (!dateInput) return "—";
  const raw = typeof dateInput === "object" && (dateInput as any).$date ? (dateInput as any).$date : dateInput;
  const d = new Date(raw);
  if (isNaN(d.getTime())) return "—";
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const stripHtml = (html: string): string =>
  html ? html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim() : "";

const getFileMeta = (type: string, name?: string, isRef?: boolean) => {
  const lt = (type || "").toLowerCase(), ext = (name || "").split(".").pop()?.toLowerCase();
  const s = 16;

  if (lt === "page") return { img: "/icons/page.png", icon: <Layout size={s} strokeWidth={1.9} />, color: "#6366f1", bg: "rgba(99,102,241,0.10)", label: "PAGE" };
  if (lt.includes("url") || lt.includes("link")) return { img: "/icons/link.png", icon: <Globe size={s} strokeWidth={1.9} />, color: "#0ea5e9", bg: "rgba(14,165,233,0.10)", label: "LINK" };
  if ((isRef === true || String(isRef) === "true") && !lt) return { icon: <Bookmark size={s} strokeWidth={1.9} />, color: "#8b5cf6", bg: "rgba(139,92,246,0.10)", label: "REF" };
  if (lt.includes("pdf") || ext === "pdf") return { img: "/icons/pdf.png", icon: <FileText size={s} strokeWidth={1.9} />, color: "#dc2626", bg: "rgba(220,38,38,0.10)", label: "PDF" };
  if (lt.includes("ppt") || ["ppt", "pptx", "key"].includes(ext || "")) return { img: "/icons/ppt.png", icon: <Presentation size={s} strokeWidth={1.9} />, color: "#ea580c", bg: "rgba(234,88,12,0.10)", label: (ext || "ppt").toUpperCase() };
  if (lt.includes("doc") || ["doc", "docx", "rtf", "odt"].includes(ext || "")) return { icon: <FileType size={s} strokeWidth={1.9} />, color: "#2563eb", bg: "rgba(37,99,235,0.10)", label: (ext || "doc").toUpperCase() };
  if (lt.includes("xls") || lt.includes("sheet") || ["xls", "xlsx", "csv", "ods"].includes(ext || "")) return { icon: <FileSpreadsheet size={s} strokeWidth={1.9} />, color: "#059669", bg: "rgba(5,150,105,0.10)", label: (ext || "xls").toUpperCase() };
  if (lt === "txt" || ext === "txt" || ext === "md") return { icon: <FileText size={s} strokeWidth={1.9} />, color: "#64748b", bg: "rgba(100,116,139,0.10)", label: (ext || "txt").toUpperCase() };
  if (lt.includes("video") || ["mp4", "avi", "mov", "mkv", "webm", "flv"].includes(ext || "")) return { img: "/icons/video.png", icon: <FileVideo size={s} strokeWidth={1.9} />, color: "#8b5cf6", bg: "rgba(139,92,246,0.10)", label: (ext || "video").toUpperCase() };
  if (lt.includes("audio") || ["mp3", "wav", "flac", "ogg", "m4a", "aac"].includes(ext || "")) return { icon: <FileAudio size={s} strokeWidth={1.9} />, color: "#db2777", bg: "rgba(219,39,119,0.10)", label: (ext || "audio").toUpperCase() };
  if (lt.includes("image") || ["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp"].includes(ext || "")) return { icon: <ImageIcon size={s} strokeWidth={1.9} />, color: "#14b8a6", bg: "rgba(20,184,166,0.10)", label: (ext || "img").toUpperCase() };
  if (lt.includes("zip") || ["zip", "rar", "7z", "tar", "gz"].includes(ext || "")) return { img: "/icons/zip.png", icon: <FileArchive size={s} strokeWidth={1.9} />, color: "#d97706", bg: "rgba(217,119,6,0.10)", label: (ext || "zip").toUpperCase() };
  if (["js", "jsx", "ts", "tsx", "py", "java", "cpp", "c", "cs", "go", "rb", "php", "html", "css", "json", "xml", "yml", "yaml", "sql", "sh"].includes(ext || "")) return { img: "/icons/page.png", icon: <FileCode size={s} strokeWidth={1.9} />, color: "#0891b2", bg: "rgba(8,145,178,0.10)", label: (ext || "code").toUpperCase() };
  if (isRef === true || String(isRef) === "true") return { icon: <Bookmark size={s} strokeWidth={1.9} />, color: "#8b5cf6", bg: "rgba(139,92,246,0.10)", label: "REF" };

  return { icon: <File size={s} strokeWidth={1.9} />, color: "#64748b", bg: "rgba(100,116,139,0.10)", label: (ext || "file").toUpperCase() };
};

// ─── Try it Yourself injector ──────────────────────────────────────────────────
function injectTryItButtonsLocal(html: string): string {
  if (!html || !html.includes('playground-wrapper')) return html

  const injectedScript = `
<script>
(function() {
  function buildEditorPage(htmlCode, cssCode, jsCode, activeTab) {
    var safeHtml = htmlCode.replace(/\\\\/g,'\\\\\\\\').replace(/\`/g,'\\\\' + '\`').replace(/\\$/g,'\\\\$')
    var safeCss  = cssCode.replace(/\\\\/g,'\\\\\\\\').replace(/\`/g,'\\\\' + '\`').replace(/\\$/g,'\\\\$')
    var safeJs   = jsCode.replace(/\\\\/g,'\\\\\\\\').replace(/\`/g,'\\\\' + '\`').replace(/\\$/g,'\\\\$')

    return '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Try it Yourself</title><style>' +
      '*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}' +
      'html,body{height:100%;font-family:Consolas,"Fira Code","Courier New",monospace;background:#1e1e1e;color:#d4d4d4;overflow:hidden}' +
      '.topbar{display:flex;align-items:center;gap:12px;padding:0 16px;background:#252526;border-bottom:2px solid #1a1a1a;height:52px;flex-shrink:0}' +
      '.topbar-left{display:flex;align-items:center;gap:8px;flex:1}' +
      '.topbar-icon{width:28px;height:28px;border-radius:6px;background:#4CAF82;display:flex;align-items:center;justify-content:center}' +
      '.topbar-title{font-family:Arial,sans-serif;font-size:14px;font-weight:700;color:#fff}' +
      '.run-btn{display:flex;align-items:center;gap:8px;padding:8px 22px;background:#4CAF82;color:#fff;border:none;border-radius:6px;font-size:14px;font-weight:700;cursor:pointer;font-family:Arial,sans-serif;transition:background .15s;flex-shrink:0}' +
      '.run-btn:hover{background:#3d9e6e}' +
      '.size-label{font-family:Arial,sans-serif;font-size:12px;color:#858585;flex-shrink:0}' +
      '.main{display:flex;height:calc(100vh - 52px)}' +
      '.editor-side{width:50%;display:flex;flex-direction:column;border-right:3px solid #1a1a1a;background:#1e1e1e}' +
      '.tabs{display:flex;background:#252526;border-bottom:1px solid #1a1a1a;padding:0 8px}' +
      '.tab{padding:10px 18px;font-family:Arial,sans-serif;font-size:12px;font-weight:600;cursor:pointer;border:none;background:transparent;color:#858585;border-bottom:2px solid transparent;transition:all .15s}' +
      '.tab.active{color:#fff;border-bottom-color:#4CAF82;background:#1e1e1e}' +
      '.tab:hover:not(.active){color:#ccc}' +
      '.editor-area{flex:1;overflow:hidden;position:relative}' +
      'textarea{width:100%;height:100%;background:#1e1e1e;color:#d4d4d4;border:none;outline:none;padding:20px;font-family:Consolas,"Fira Code","Courier New",monospace;font-size:14px;line-height:1.75;resize:none;tab-size:2;position:absolute;top:0;left:0}' +
      '.preview-side{width:50%;display:flex;flex-direction:column;background:#fff}' +
      '.preview-bar{display:flex;align-items:center;justify-content:space-between;padding:8px 16px;background:#f3f3f3;border-bottom:1px solid #ddd;font-family:Arial,sans-serif;font-size:12px;color:#666;flex-shrink:0}' +
      'iframe#preview{flex:1;border:none;width:100%;background:#fff}' +
      '</style></head><body>' +
      '<div class="topbar">' +
        '<div class="topbar-left">' +
          '<div class="topbar-icon"><svg width="14" height="14" viewBox="0 0 16 16"><polygon points="2,1 14,8 2,15" fill="white"/></svg></div>' +
          '<span class="topbar-title">Try it Yourself</span>' +
        '</div>' +
        '<span class="size-label" id="size-lbl">Result Size: — </span>' +
        '<button class="run-btn" onclick="runCode()"><svg width="12" height="12" viewBox="0 0 16 16"><polygon points="2,1 14,8 2,15" fill="white"/></svg>Run &#9658;</button>' +
      '</div>' +
      '<div class="main">' +
        '<div class="editor-side">' +
          '<div class="tabs">' +
            '<button class="tab" id="tab-html" onclick="switchTab(\'html\')">HTML</button>' +
            '<button class="tab" id="tab-css" onclick="switchTab(\'css\')">CSS</button>' +
            '<button class="tab" id="tab-js" onclick="switchTab(\'js\')">JS</button>' +
          '</div>' +
          '<div class="editor-area">' +
            '<textarea id="ta-html" spellcheck="false"></textarea>' +
            '<textarea id="ta-css" spellcheck="false" style="display:none"></textarea>' +
            '<textarea id="ta-js" spellcheck="false" style="display:none"></textarea>' +
          '</div>' +
        '</div>' +
        '<div class="preview-side">' +
          '<div class="preview-bar"><span>Result</span><span id="size-lbl2"></span></div>' +
          '<iframe id="preview" sandbox="allow-scripts allow-same-origin"></iframe>' +
        '</div>' +
      '</div>' +
      '<script>' +
        'var DATA={html:' + JSON.stringify(htmlCode) + ',css:' + JSON.stringify(cssCode) + ',js:' + JSON.stringify(jsCode) + ',activeTab:' + JSON.stringify(activeTab) + '};' +
        'document.getElementById("ta-html").value=DATA.html||"";' +
        'document.getElementById("ta-css").value=DATA.css||"";' +
        'document.getElementById("ta-js").value=DATA.js||"";' +
        'function switchTab(n){' +
          '["html","css","js"].forEach(function(k){' +
            'document.getElementById("ta-"+k).style.display=k===n?"block":"none";' +
            'document.getElementById("tab-"+k).classList.toggle("active",k===n);' +
          '});' +
        '}' +
        'function buildDoc(){' +
          'var h=document.getElementById("ta-html").value;' +
          'var c=document.getElementById("ta-css").value;' +
          'var j=document.getElementById("ta-js").value;' +
          'if(c.trim()){if(h.indexOf("</head>")!==-1)h=h.replace("</head>","<style>"+c+"</style></head>");else h="<style>"+c+"</style>"+h;}' +
          'if(j.trim()){if(h.indexOf("</body>")!==-1)h=h.replace("</body>","<scr"+"ipt>"+j+"</scr"+"ipt></body>");else h+="<scr"+"ipt>"+j+"</scr"+"ipt>";}' +
          'return h;' +
        '}' +
        'function runCode(){' +
          'var frame=document.getElementById("preview");' +
          'frame.srcdoc=buildDoc();' +
          'frame.onload=function(){' +
            'try{var w=frame.contentWindow.innerWidth,h=frame.contentWindow.innerHeight;' +
            'var s="Result Size: "+w+" x "+h;' +
            'document.getElementById("size-lbl").textContent=s;' +
            'document.getElementById("size-lbl2").textContent=s;}catch(e){}' +
          '};' +
        '}' +
        'document.querySelectorAll("textarea").forEach(function(ta){' +
          'ta.addEventListener("keydown",function(e){' +
            'if(e.key==="Tab"){e.preventDefault();var s=ta.selectionStart;ta.value=ta.value.substring(0,s)+"  "+ta.value.substring(ta.selectionEnd);ta.selectionStart=ta.selectionEnd=s+2;}' +
          '});' +
        '});' +
        'switchTab(DATA.activeTab||"html");' +
        'window.onload=function(){runCode();};' +
      '<\\/script>' +
      '</body></html>'
  }

  function decodeSrcdocAttr(encoded) {
    return encoded
      .replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'")
  }

  function extractParts(fullHtml) {
    var htmlCode = fullHtml
    var cssCode  = ''
    var jsCode   = ''

    var styleRe = /<style[^>]*>([\\s\\S]*?)<\\/style>/gi
    var sm
    while ((sm = styleRe.exec(fullHtml)) !== null) {
      cssCode += sm[1].trim() + '\\n'
    }

    var scriptRe = /<script[^>]*>([\\s\\S]*?)<\\/script>/gi
    var scm
    while ((scm = scriptRe.exec(fullHtml)) !== null) {
      var inner = scm[1].trim()
      if (inner) jsCode += inner + '\\n'
    }

    var cleanHtml = fullHtml
      .replace(/<style[^>]*>[\\s\\S]*?<\\/style>/gi, '')
      .replace(/<script[^>]*>[\\s\\S]*?<\\/script>/gi, '')
      .trim()

    return { html: cleanHtml || fullHtml, css: cssCode.trim(), js: jsCode.trim() }
  }

  function buildCodeDisplay(code, lang) {
    var escaped = code.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    var colored = escaped
    if (lang === 'css') {
      colored = escaped
        .replace(/(\\\/\\*[\\s\\S]*?\\*\\\/)/g,'<span style="color:#6a9955">$1</span>')
        .replace(/([.#]?[\\w][\\w-]*)(\\s*\\{)/g,'<span style="color:#d7ba7d">$1</span>$2')
        .replace(/([\\w-]+)(\\s*:)(\\s*)/g,'<span style="color:#9cdcfe">$1</span>$2$3')
        .replace(/(:[ \\s]*)([^;{}\\n<]+)/g, function(m,p1,p2){ return p1+'<span style="color:#ce9178">'+p2+'</span>' })
    } else if (lang === 'html') {
      colored = escaped
        .replace(/(&lt;!--[\\s\\S]*?--&gt;)/g,'<span style="color:#6a9955">$1</span>')
        .replace(/(&lt;\\/?)([\\w]+)/g,'$1<span style="color:#4ec9b0">$2</span>')
        .replace(/([\\w-]+)(=&quot;)/g,'<span style="color:#9cdcfe">$1</span>=&quot;')
        .replace(/=(&quot;[^&]*&quot;)/g,'=<span style="color:#ce9178">$1</span>')
    } else {
      colored = escaped
        .replace(/(\\\/\\/[^\\n]*)/g,'<span style="color:#6a9955">$1</span>')
        .replace(/\\b(var|let|const|function|return|if|else|for|while|new|typeof)\\b/g,'<span style="color:#c586c0">$1</span>')
        .replace(/(&quot;[^&]*&quot;|&#39;[^&]*&#39;)/g,'<span style="color:#ce9178">$1</span>')
    }
    return colored
  }

  function processPlaygrounds() {
    var wrappers = document.querySelectorAll('.playground-wrapper')
    wrappers.forEach(function(wrapper) {
      var iframe = wrapper.querySelector('iframe[srcdoc]')
      if (!iframe) return

      var rawSrcdoc = iframe.getAttribute('srcdoc') || ''
      var decoded   = decodeSrcdocAttr(rawSrcdoc)
      var parts     = extractParts(decoded)

      var _stampedTab = wrapper.getAttribute('data-active-tab') || ''
      var _primaryTab = wrapper.getAttribute('data-primary-tab') || 'auto'
      var activeTab = _stampedTab || (_primaryTab !== 'auto' ? _primaryTab : 'html')
      var activeCode = activeTab === 'css' ? parts.css : activeTab === 'js' ? parts.js : parts.html
      var displayLang = activeTab

      var displayCode = buildCodeDisplay(activeCode || parts.html, displayLang)
      var langLabel   = activeTab.toUpperCase()
      var langColor   = activeTab==='css'?'#264de4':activeTab==='js'?'#f7df1e':activeTab==='html'?'#e44d26':'#888'
      var langBg      = activeTab==='css'?'rgba(38,77,228,.12)':activeTab==='js'?'rgba(247,223,30,.15)':'rgba(228,77,38,.12)'

      var newHtml = '<div style="border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;font-family:inherit;margin:0">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 16px;background:#f8fafc;border-bottom:1px solid #e2e8f0">' +
          '<div style="display:flex;align-items:center;gap:8px">' +
            '<span style="width:10px;height:10px;border-radius:50%;background:#ff5f57;display:inline-block"></span>' +
            '<span style="width:10px;height:10px;border-radius:50%;background:#ffbd2e;display:inline-block"></span>' +
            '<span style="width:10px;height:10px;border-radius:50%;background:#28c840;display:inline-block"></span>' +
          '</div>' +
          '<span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:4px;background:'+langBg+';color:'+langColor+'">'+langLabel+'</span>' +
        '</div>' +
        '<div style="background:#1e1e1e;overflow-x:auto;border-left:4px solid '+langColor+'">' +
          '<pre style="margin:0;padding:20px 24px;font-family:Consolas,Fira Code,Courier New,monospace;font-size:13.5px;line-height:1.8;color:#d4d4d4;white-space:pre-wrap;word-break:break-all">' +
            '<code>' + displayCode + '</code>' +
          '</pre>' +
        '</div>' +
        '<div style="padding:12px 16px;background:#f8fafc;border-top:1px solid #e2e8f0;display:flex;align-items:center;justify-content:space-between">' +
          '<span style="font-size:11px;color:#9ca3af">Interactive Playground</span>' +
          '<button class="try-it-btn" style="display:inline-flex;align-items:center;gap:7px;padding:9px 20px;background:#4CAF82;color:#fff;border:none;border-radius:7px;font-size:13.5px;font-weight:700;cursor:pointer;font-family:Arial,sans-serif;transition:background .15s;box-shadow:0 2px 8px rgba(76,175,130,.3)">' +
            '<svg width="11" height="11" viewBox="0 0 16 16"><polygon points="2,1 14,8 2,15" fill="white"/></svg>' +
            'Try it Yourself &raquo;' +
          '</button>' +
        '</div>' +
      '</div>'

      var div = document.createElement('div')
      div.style.cssText = 'margin:1.5rem 0;border-radius:12px;overflow:hidden;background:#f0f0f0;padding:20px;'
      div.innerHTML = newHtml
      wrapper.parentNode.replaceChild(div, wrapper)

      var btn = div.querySelector('.try-it-btn')
      if (btn) {
        btn.addEventListener('mouseenter', function() { btn.style.background='#3d9e6e' })
        btn.addEventListener('mouseleave', function() { btn.style.background='#4CAF82' })
        btn.addEventListener('click', function() {
          var editorPage = buildEditorPage(parts.html, parts.css, parts.js, activeTab)
          var t = window.open('', '_blank')
          if (!t) { alert('Popup blocked. Please allow popups for this site.'); return }
          t.document.open()
          t.document.write(editorPage)
          t.document.close()
        })
      }
    })
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', processPlaygrounds)
  } else {
    processPlaygrounds()
  }
})();
<\/script>
`

  if (html.includes('</body>')) {
    return html.replace('</body>', injectedScript + '</body>')
  }
  return html + injectedScript
}

// ─── Inline Page Viewer ────────────────────────────────────────────────────────
const InlinePageViewer: React.FC<{
  page: ViewingPage;
  onBack: () => void;
  onNewTab: () => void;
}> = ({ page, onBack, onNewTab }) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const hasCodeBlocks = page.code.includes("playground-wrapper") || page.code.includes("allow-scripts");

  return (
    <div
      className="flex flex-col h-full overflow-hidden"
      style={{
        background: T.bg,
        position: isFullscreen ? "fixed" : "relative",
        inset: isFullscreen ? 0 : undefined,
        zIndex: isFullscreen ? 9999 : undefined,
      }}
    >
      <div
        className="flex-shrink-0 flex items-center justify-between px-4 py-2.5 gap-3"
        style={{
          borderBottom: `1px solid ${T.border}`,
          background: T.bg,
          borderLeft: `3px solid #6366f1`,
        }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <button
            onClick={onBack}
            className="flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all"
            style={{ background: T.pageBg, color: T.textSub, border: `1px solid ${T.border}` }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = T.orange; (e.currentTarget as HTMLElement).style.color = T.orange; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = T.border; (e.currentTarget as HTMLElement).style.color = T.textSub; }}
          >
            <ArrowLeft size={12} strokeWidth={2.5} />
            Back
          </button>

          <div className="flex items-center gap-2 min-w-0">
            <div
              className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: "rgba(99,102,241,0.10)", border: "1px solid rgba(99,102,241,0.18)" }}
            >
              <Layout size={13} style={{ color: "#6366f1" }} />
            </div>
            <span className="text-[12.5px] font-bold truncate" style={{ color: T.textMain }}>
              {page.title}
            </span>
            {page.pageCount && page.pageCount > 1 && (
              <span
                className="flex-shrink-0 text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-widest"
                style={{ background: "rgba(99,102,241,0.10)", color: "#6366f1", border: "1px solid rgba(99,102,241,0.18)" }}
              >
                {page.pageCount} pages
              </span>
            )}
            {hasCodeBlocks && (
              <span
                className="flex-shrink-0 flex items-center gap-1 text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-widest"
                style={{ background: "rgba(16,185,129,0.10)", color: "#059669", border: "1px solid rgba(16,185,129,0.20)" }}
              >
                <Code2 size={8} />
                Interactive
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          {hasCodeBlocks && (
            <div
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-medium"
              style={{ background: "rgba(16,185,129,0.08)", color: "#059669", border: "1px solid rgba(16,185,129,0.18)" }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse inline-block" />
              Code runners active
            </div>
          )}
          <button
            onClick={() => setIsFullscreen(v => !v)}
            title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
            className="p-1.5 rounded-lg transition-all"
            style={{ color: T.textHint, background: T.pageBg, border: `1px solid ${T.border}` }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "#6366f1"; (e.currentTarget as HTMLElement).style.borderColor = "#6366f1"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = T.textHint; (e.currentTarget as HTMLElement).style.borderColor = T.border; }}
          >
            {isFullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
          </button>
          <button
            onClick={onNewTab}
            title="Open in new tab"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all"
            style={{ background: "rgba(99,102,241,0.09)", color: "#6366f1", border: "1px solid rgba(99,102,241,0.20)" }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "rgba(99,102,241,0.18)"}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "rgba(99,102,241,0.09)"}
          >
            <ExternalLink size={11} />
            New Tab
          </button>
        </div>
      </div>

      {!loaded && (
        <div
          className="absolute inset-x-0 top-[52px] bottom-0 flex flex-col items-center justify-center gap-3 z-10"
          style={{ background: T.bg }}
        >
          <div className="flex gap-1.5">
            {[0, 1, 2].map(i => (
              <div
                key={i}
                className="w-2 h-2 rounded-full"
                style={{
                  background: "#6366f1",
                  animation: `ivBounce 0.9s ease-in-out ${i * 0.15}s infinite alternate`,
                }}
              />
            ))}
          </div>
          <span className="text-[11px] font-medium" style={{ color: T.textHint }}>Loading page…</span>
        </div>
      )}

      <iframe
        ref={iframeRef}
        srcDoc={injectTryItButtonsLocal(page.code)}
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
        title={page.title}
        onLoad={() => setLoaded(true)}
        className="flex-1 w-full border-none"
        style={{
          opacity: loaded ? 1 : 0,
          transition: "opacity 0.25s ease",
          background: "#ffffff",
          minHeight: 0,
        }}
      />
    </div>
  );
};

// ─── DropMenu Components ───────────────────────────────────────────────────────
const DropMenu: React.FC<{
  children: React.ReactNode;
  upward?: boolean;
  fixedPos?: { top: number; right: number };
}> = ({ children, upward, fixedPos }) => (
  <div
    style={{
      position: fixedPos ? "fixed" : "absolute",
      ...(fixedPos
        ? { top: upward ? undefined : fixedPos.top, bottom: upward ? window.innerHeight - fixedPos.top : undefined, right: fixedPos.right }
        : { right: 0, ...(upward ? { bottom: "calc(100% + 6px)" } : { top: "calc(100% + 6px)" }) }),
      width: 176,
      zIndex: 9999,
      overflow: "hidden",
      background: T.bg, border: `1px solid ${T.border}`, borderRadius: 12,
      boxShadow: "0 10px 32px rgba(0,0,0,0.10), 0 2px 8px rgba(0,0,0,0.05)",
      padding: 4, animation: "ccDropIn 0.14s cubic-bezier(0.16,1,0.3,1) both",
    }}
    onClick={e => e.stopPropagation()}
  >
    {children}
  </div>
);

const DropItem: React.FC<{
  icon: React.ReactNode; label: string; color?: string; divider?: boolean; onClick: () => void;
}> = ({ icon, label, color, divider, onClick }) => (
  <button
    type="button" onClick={onClick}
    className="flex items-center gap-2 w-full px-2.5 py-2 text-[11px] font-semibold rounded-lg"
    style={{
      color: color || T.textSub, borderTop: divider ? `1px solid ${T.border}` : "none",
      marginTop: divider ? 3 : 0, transition: "all 0.12s", background: "transparent",
    }}
    onMouseEnter={e => {
      (e.currentTarget as HTMLElement).style.background = color ? `${color}10` : T.pageBg;
      (e.currentTarget as HTMLElement).style.color = color || T.textMain;
    }}
    onMouseLeave={e => {
      (e.currentTarget as HTMLElement).style.background = "transparent";
      (e.currentTarget as HTMLElement).style.color = color || T.textSub;
    }}
  >
    {icon}{label}
  </button>
);

// ─── GroupEditModal ────────────────────────────────────────────────────────────
// Lists files and folders inside a group; user can rename inline or mark for
// deletion. Changes (deletes) are committed only when Save is clicked.
const GroupEditModal: React.FC<{
  group: { groupId: string; groupName: string; files: UploadedFile[]; folders: FolderItem[] };
  onClose: () => void;
  onDeleteFile: (fileId: string, name: string) => void;
  onDeleteFolder: (folder: FolderItem) => void;
}> = ({ group, onClose, onDeleteFile, onDeleteFolder }) => {
  type EntryKey = string;
  const folderKey = (f: FolderItem): EntryKey => `folder:${f.id}`;
  const fileKey = (f: UploadedFile): EntryKey => `file:${f.id}`;

  const initialNames: Record<EntryKey, string> = useMemo(() => {
    const m: Record<EntryKey, string> = {};
    group.folders.forEach(f => { m[folderKey(f)] = f.name; });
    group.files.forEach(f => { m[fileKey(f)] = f.name; });
    return m;
  }, [group]);

  const [names, setNames] = useState<Record<EntryKey, string>>(initialNames);
  const [deleted, setDeleted] = useState<Set<EntryKey>>(new Set());
  const [saving, setSaving] = useState(false);

  const toggleDelete = (key: EntryKey) => {
    setDeleted(prev => {
      const s = new Set(prev);
      s.has(key) ? s.delete(key) : s.add(key);
      return s;
    });
  };

  const updateName = (key: EntryKey, v: string) => {
    setNames(prev => ({ ...prev, [key]: v }));
  };

  const isDirty =
    deleted.size > 0 ||
    Object.keys(names).some(k => (names[k] || "").trim() !== (initialNames[k] || "").trim());

  const handleSave = () => {
    setSaving(true);
    try {
      // Commit deletions — folders first, then files. Renames are tracked but
      // require parent-side wiring (no batch rename API at this layer).
      group.folders.forEach(f => { if (deleted.has(folderKey(f))) onDeleteFolder(f); });
      group.files.forEach(f => { if (deleted.has(fileKey(f))) onDeleteFile(f.id, f.name); });
    } finally {
      setSaving(false);
      onClose();
    }
  };

  const renderRow = (key: EntryKey, kind: "folder" | "file", meta: any, originalName: string) => {
    const isDel = deleted.has(key);
    const currentName = names[key] ?? originalName;
    const renamed = currentName.trim() !== originalName.trim();
    return (
      <div
        key={key}
        style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "8px 12px",
          borderBottom: `1px solid ${T.border}`,
          background: isDel ? "rgba(239,68,68,0.05)" : "#fff",
          opacity: isDel ? 0.75 : 1,
        }}
      >
        <div style={{
          width: 22, height: 22, borderRadius: 6, flexShrink: 0,
          background: kind === "folder" ? T.orangeLight : `${meta.color}16`,
          border: kind === "folder" ? `1px solid ${T.orange}30` : `1px solid ${meta.color}28`,
          color: kind === "folder" ? T.orange : meta.color,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          {kind === "folder"
            ? <Folder size={12} strokeWidth={1.8} />
            : (meta.img
              ? <img src={meta.img} alt={meta.label} style={{ width: 14, height: 14, objectFit: "contain" }} />
              : React.cloneElement(meta.icon as React.ReactElement, { size: 12 }))}
        </div>

        <input
          type="text"
          value={currentName}
          disabled={isDel}
          onChange={e => updateName(key, e.target.value)}
          style={{
            flex: 1, minWidth: 0,
            fontSize: 12.5, fontWeight: 600, color: T.textMain,
            padding: "6px 10px",
            borderRadius: 7,
            border: `1px solid ${renamed && !isDel ? T.orange : T.border}`,
            background: isDel ? T.pageBg : "#fff",
            outline: "none",
            transition: "border-color 0.15s ease, box-shadow 0.15s ease",
            textDecoration: isDel ? "line-through" : "none",
          }}
          onFocus={e => {
            if (isDel) return;
            (e.currentTarget as HTMLElement).style.borderColor = T.orange;
            (e.currentTarget as HTMLElement).style.boxShadow = `0 0 0 3px ${T.orangeLight}`;
          }}
          onBlur={e => {
            (e.currentTarget as HTMLElement).style.borderColor = renamed && !isDel ? T.orange : T.border;
            (e.currentTarget as HTMLElement).style.boxShadow = "none";
          }}
        />

        <span style={{
          fontSize: 9.5, fontWeight: 700, padding: "2px 7px", borderRadius: 4,
          textTransform: "uppercase", letterSpacing: "0.05em",
          color: T.textHint, border: `1px solid ${T.border}`,
          flexShrink: 0, whiteSpace: "nowrap",
        }}>
          {kind === "folder" ? "Folder" : (meta.label || "File")}
        </span>

        <button
          type="button"
          onClick={() => toggleDelete(key)}
          title={isDel ? "Undo delete" : "Mark for deletion"}
          style={{
            width: 28, height: 28, borderRadius: 7, flexShrink: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: isDel ? "rgba(239,68,68,0.10)" : "transparent",
            border: `1px solid ${isDel ? "rgba(239,68,68,0.32)" : T.border}`,
            color: isDel ? "#ef4444" : T.textHint,
            cursor: "pointer", transition: "all 0.13s",
          }}
          onMouseEnter={e => {
            const el = e.currentTarget as HTMLElement;
            el.style.background = isDel ? "rgba(239,68,68,0.18)" : "rgba(239,68,68,0.08)";
            el.style.color = "#ef4444";
            el.style.borderColor = "rgba(239,68,68,0.32)";
          }}
          onMouseLeave={e => {
            const el = e.currentTarget as HTMLElement;
            el.style.background = isDel ? "rgba(239,68,68,0.10)" : "transparent";
            el.style.color = isDel ? "#ef4444" : T.textHint;
            el.style.borderColor = isDel ? "rgba(239,68,68,0.32)" : T.border;
          }}
        >
          <Trash2 size={13} />
        </button>
      </div>
    );
  };

  const items = group.folders.length + group.files.length;

  return (
    <div
      className="fixed inset-0 z-[500] flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.40)", backdropFilter: "blur(3px)" }}
      onClick={onClose}
    >
      <div
        className="rounded-2xl shadow-2xl flex flex-col"
        style={{
          background: T.bg, border: `1px solid ${T.border}`,
          width: 520, maxWidth: "94vw", maxHeight: "80vh",
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", gap: 12,
          padding: "16px 20px",
          borderBottom: `1px solid ${T.border}`,
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: 9, flexShrink: 0,
            background: T.orangeLight, border: `1px solid ${T.orange}30`,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Folder size={15} style={{ color: T.orange }} strokeWidth={2} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 14, fontWeight: 700, color: T.textMain,
              letterSpacing: "-0.008em",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              Edit group: {group.groupName}
            </div>
            <div style={{ fontSize: 11.5, color: T.textMuted, marginTop: 2 }}>
              {items} item{items !== 1 ? "s" : ""} — rename or delete, then Save
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              width: 28, height: 28, borderRadius: 8, border: `1px solid ${T.border}`,
              background: "transparent", color: T.textHint, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "all 0.13s",
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.background = T.pageBg;
              (e.currentTarget as HTMLElement).style.color = T.textSub;
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.background = "transparent";
              (e.currentTarget as HTMLElement).style.color = T.textHint;
            }}
          >
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <div style={{
          flex: 1, overflowY: "auto", minHeight: 80,
          background: "#fff",
        }}>
          {items === 0 ? (
            <div style={{ padding: "32px 16px", textAlign: "center", color: T.textHint, fontSize: 12.5 }}>
              This group has no items.
            </div>
          ) : (
            <>
              {group.folders.map(f => renderRow(folderKey(f), "folder", null, f.name))}
              {group.files.map(f => {
                const isRef = f.isReference === true || String(f.isReference) === "true";
                const meta = getFileMeta(f.type || "", f.name, isRef);
                return renderRow(fileKey(f), "file", meta, f.name);
              })}
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8,
          padding: "12px 16px",
          borderTop: `1px solid ${T.border}`,
          background: T.pageBg,
        }}>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            style={{
              padding: "8px 14px", borderRadius: 9,
              fontSize: 12, fontWeight: 600, color: T.textSub,
              background: T.bg, border: `1px solid ${T.border}`,
              cursor: saving ? "not-allowed" : "pointer",
              transition: "all 0.13s",
            }}
            onMouseEnter={e => { if (!saving) (e.currentTarget as HTMLElement).style.background = T.pageBg; }}
            onMouseLeave={e => { if (!saving) (e.currentTarget as HTMLElement).style.background = T.bg; }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !isDirty}
            style={{
              padding: "8px 16px", borderRadius: 9,
              fontSize: 12, fontWeight: 700, color: "#fff",
              background: isDirty ? T.orange : "rgba(232,100,12,0.45)",
              border: "none",
              cursor: saving || !isDirty ? "not-allowed" : "pointer",
              transition: "background 0.15s ease",
            }}
            onMouseEnter={e => { if (isDirty && !saving) (e.currentTarget as HTMLElement).style.background = T.orangeDark; }}
            onMouseLeave={e => { if (isDirty && !saving) (e.currentTarget as HTMLElement).style.background = T.orange; }}
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Sort options ──────────────────────────────────────────────────────────────
export type SortKey =
  | "date_desc" | "date_asc"
  | "name_asc"  | "name_desc"
  | "size_desc" | "size_asc"
  | "type_asc";

const SORT_OPTIONS: { key: SortKey; label: string; icon: React.ReactNode }[] = [
  { key: "date_desc", label: "Date (Newest)",  icon: <ArrowDown  size={11} /> },
  { key: "date_asc",  label: "Date (Oldest)",  icon: <ArrowUp    size={11} /> },
  { key: "name_asc",  label: "Name (A → Z)",   icon: <ArrowUp    size={11} /> },
  { key: "name_desc", label: "Name (Z → A)",   icon: <ArrowDown  size={11} /> },
  { key: "size_desc", label: "Size (Largest)",  icon: <ArrowDown  size={11} /> },
  { key: "size_asc",  label: "Size (Smallest)", icon: <ArrowUp    size={11} /> },
  { key: "type_asc",  label: "Type (A → Z)",    icon: <ArrowUpDown size={11} /> },
];

// ─── FilterSection ────────────────────────────────────────────────────────────
const FilterSection: React.FC<{
  fileTypes: FileTypeConfig[];
  allFiles: UploadedFile[];
  currentFolders: FolderItem[];
  activeFilters: { fileTypes: string[]; searchFilter: string };
  onFilterChange: (f: { fileTypes: string[]; searchFilter: string }) => void;
  onResourceModalOpen: (groupId?: string, groupName?: string) => void;
  sortBy: SortKey;
  onSortChange: (s: SortKey) => void;
}> = ({ fileTypes, allFiles, currentFolders, activeFilters, onFilterChange, onResourceModalOpen, sortBy, onSortChange }) => {
  const [search, setSearch] = useState(activeFilters.searchFilter);

  useEffect(() => {
    const t = setTimeout(() => onFilterChange({ ...activeFilters, searchFilter: search }), 300);
    return () => clearTimeout(t);
  }, [search]);

  const avail = useMemo(() => {
    const s = new Set<string>();
    if (currentFolders.length > 0) s.add("folder");
    allFiles.forEach(f => {
      const lt = (f.type || "").toLowerCase(), ln = (f.name || "").toLowerCase();
      if (lt === "page") { s.add("page"); return; }
      if (lt.includes("url") || lt.includes("link")) { s.add("url"); return; }
      if (f.isReference === true || String(f.isReference) === "true") { s.add("reference"); return; }
      if (lt.includes("pdf") || ln.endsWith(".pdf")) { s.add("pdf"); return; }
      if (lt.includes("ppt") || ln.match(/\.pptx?$/i)) { s.add("ppt"); return; }
      if (lt.includes("wordprocessingml") || lt.includes("msword") || lt.includes("opendocument.text") || ln.match(/\.(docx?|odt|rtf|ocx)$/i)) { s.add("word"); return; }
      if (lt.includes("video") || ln.match(/\.(mp4|avi|mov|mkv|webm)$/i)) { s.add("video"); return; }
      if (lt.includes("image") || ln.match(/\.(png|jpg|jpeg|gif|webp|svg|bmp)$/i)) { s.add("image"); return; }
      if (lt.includes("zip") || ln.match(/\.(zip|rar|7z|tar|gz)$/i)) { s.add("zip"); return; }
    });
    return [...s];
  }, [allFiles, currentFolders]);

  const FM: Record<string, { icon: React.ReactNode; color: string; img?: string }> = {
    page: { icon: <Layout size={10} />, color: "#6366f1", img: "/icons/page.png" },
    folder: { icon: <Folder size={10} />, color: T.orange, img: "/icons/folder.png" },
    url: { icon: <Link size={10} />, color: "#10b981", img: "/icons/link.png" },
    reference: { icon: <Bookmark size={10} />, color: "#8b5cf6", img: "/icons/bookmark.png" },
    pdf: { icon: <FileText size={10} />, color: "#ef4444", img: "/icons/pdf.png" },
    video: { icon: <Video size={10} />, color: "#8b5cf6", img: "/icons/video.png" },
    zip: { icon: <FileArchive size={10} />, color: "#f59e0b", img: "/icons/zip.png" },
    ppt: { icon: <MonitorPlay size={10} />, color: "#f97316", img: "/icons/ppt.png" },
    word: { icon: <FileType size={10} />, color: "#2563eb" },
    image: { icon: <ImageIcon size={10} />, color: "#14b8a6" },
  };
  
  const lbl = (t: string) => {
    const LABELS: Record<string, string> = { page: "Pages", folder: "Folders", url: "URLs", reference: "References", pdf: "PDFs", ppt: "Slides", video: "Videos", zip: "ZIPs", word: "Docs", image: "Images" };
    if (LABELS[t]) return LABELS[t];
    const c = fileTypes.find(f => f.key === t);
    return c?.label || (t.charAt(0).toUpperCase() + t.slice(1));
  };
  
  const tog = (t: string) =>
    onFilterChange({
      ...activeFilters,
      fileTypes: activeFilters.fileTypes.includes(t)
        ? activeFilters.fileTypes.filter(x => x !== t)
        : [...activeFilters.fileTypes, t],
    });

  const [dropOpen, setDropOpen] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);
  const [sortOpen, setSortOpen] = useState(false);
  const sortRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!dropOpen) return;
    const h = (e: MouseEvent) => { if (dropRef.current && !dropRef.current.contains(e.target as Node)) setDropOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [dropOpen]);

  useEffect(() => {
    if (!sortOpen) return;
    const h = (e: MouseEvent) => { if (sortRef.current && !sortRef.current.contains(e.target as Node)) setSortOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [sortOpen]);

  const isDefaultSort = sortBy === "date_desc";
  const activeSortLabel = SORT_OPTIONS.find(o => o.key === sortBy)?.label ?? "Date (Newest)";

  const activeCount = activeFilters.fileTypes.length;

  return (
    <div className="flex items-center gap-2 w-full">
      <div className="relative flex-1 min-w-0">
        <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: search ? T.orange : T.textHint }} />
        <input
          type="text"
          placeholder="Search files"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-8 pr-6 py-2 text-[12px] font-medium outline-none"
          style={{ background: T.pageBg, border: `1px solid ${T.border}`, borderRadius: 10, color: T.textMain, fontFamily: "inherit" }}
          onFocus={e => { e.currentTarget.style.borderColor = T.orange; e.currentTarget.style.boxShadow = `0 0 0 3px ${T.orangeLight}`; e.currentTarget.style.background = T.bg; }}
          onBlur={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.background = T.pageBg; }}
        />
        {search && (
          <button type="button" onClick={() => { setSearch(""); onFilterChange({ ...activeFilters, searchFilter: "" }); }}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded" style={{ color: T.textHint }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = T.orange}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = T.textHint}>
            <X size={10} />
          </button>
        )}
      </div>

      {activeCount > 0 && (
        <div className="flex items-center gap-1 flex-shrink-0">
          {activeFilters.fileTypes.map(t => {
            const m = FM[t] || { color: T.orange };
            return (
              <span
                key={t}
                className="flex items-center gap-1 pl-2 pr-1 py-1 rounded-lg text-[10.5px] font-bold"
                style={{ background: `${m.color}14`, color: m.color, border: `1.5px solid ${m.color}40` }}
              >
                {m.img
                  ? <img src={m.img} alt={t} style={{ width: 12, height: 12, objectFit: "contain" }} />
                  : <span>{m.icon}</span>}
                {lbl(t)}
                <button
                  type="button"
                  onClick={() => tog(t)}
                  className="ml-0.5 p-0.5 rounded flex items-center justify-center"
                  style={{ color: m.color, opacity: 0.7 }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.opacity = "1"}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity = "0.7"}
                >
                  <X size={9} strokeWidth={2.5} />
                </button>
              </span>
            );
          })}
          <button
            type="button"
            onClick={() => onFilterChange({ ...activeFilters, fileTypes: [] })}
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10.5px] font-bold transition-all flex-shrink-0"
            style={{ background: "rgba(239,68,68,0.08)", color: "#ef4444", border: "1.5px solid rgba(239,68,68,0.22)" }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "rgba(239,68,68,0.14)"}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "rgba(239,68,68,0.08)"}
          >
            <X size={10} strokeWidth={2.5} />
            Clear
          </button>
        </div>
      )}

      <div className="relative flex-shrink-0" ref={dropRef}>
        <button
          type="button"
          onClick={() => setDropOpen(v => !v)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[11.5px] font-semibold transition-all"
          style={{
            background: dropOpen || activeCount > 0 ? T.orangeLight : T.bg,
            border: `1px solid ${dropOpen || activeCount > 0 ? T.orange : T.border}`,
            color: dropOpen || activeCount > 0 ? T.orange : T.textSub,
            boxShadow: dropOpen ? `0 0 0 3px ${T.orangeLight}` : "none",
          }}
          onMouseEnter={e => { if (!dropOpen && activeCount === 0) { (e.currentTarget as HTMLElement).style.borderColor = T.orange; (e.currentTarget as HTMLElement).style.color = T.orange; } }}
          onMouseLeave={e => { if (!dropOpen && activeCount === 0) { (e.currentTarget as HTMLElement).style.borderColor = T.border; (e.currentTarget as HTMLElement).style.color = T.textSub; } }}
        >
          <SlidersHorizontal size={13} />
          <span>Filter</span>
          {activeCount > 0 && (
            <span className="flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-black text-white"
              style={{ background: T.orange }}>
              {activeCount}
            </span>
          )}
        </button>

        {dropOpen && (
          <div
            className="absolute right-0 top-[calc(100%+6px)] z-50 rounded-2xl overflow-hidden"
            style={{
              background: T.bg,
              border: `1.5px solid ${T.border}`,
              boxShadow: "0 12px 32px rgba(0,0,0,0.12)",
              minWidth: 180,
            }}
          >
            <div className="flex items-center justify-between px-3.5 pt-3 pb-2" style={{ borderBottom: `1px solid ${T.border}` }}>
              <span className="text-[11px] font-black uppercase tracking-wider" style={{ color: T.textMuted }}>Filter by type</span>
              {activeCount > 0 && (
                <button
                  type="button"
                  onClick={() => { onFilterChange({ ...activeFilters, fileTypes: [] }); setDropOpen(false); }}
                  className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                  style={{ color: "#ef4444", background: "rgba(239,68,68,0.08)" }}
                >
                  Clear all
                </button>
              )}
            </div>

            <div className="px-2 pt-1.5 pb-1">
              <button
                type="button"
                onClick={() => { onFilterChange({ ...activeFilters, fileTypes: [] }); setDropOpen(false); }}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-[11.5px] font-bold transition-all"
                style={{
                  background: activeCount === 0 ? T.orangeLight : "transparent",
                  color: activeCount === 0 ? T.orange : T.textSub,
                }}
                onMouseEnter={e => { if (activeCount !== 0) (e.currentTarget as HTMLElement).style.background = T.pageBg; }}
                onMouseLeave={e => { if (activeCount !== 0) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
              >
                <div className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0"
                  style={{ background: activeCount === 0 ? T.orange : T.pageBg, border: `1.5px solid ${activeCount === 0 ? T.orange : T.border}` }}>
                  {activeCount === 0
                    ? <svg width="9" height="7" viewBox="0 0 9 7" fill="none"><path d="M1 3.5L3.5 6L8 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    : null}
                </div>
                All resources
              </button>

              {avail.length === 0 && (
                <p className="text-center text-[11px] py-3" style={{ color: T.textHint }}>No resources yet</p>
              )}

              {avail.map(t => {
                const on = activeFilters.fileTypes.includes(t);
                const m = FM[t] || { icon: <File size={11} />, color: T.orange };
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => tog(t)}
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-[11.5px] font-bold transition-all"
                    style={{
                      background: on ? `${m.color}10` : "transparent",
                      color: on ? m.color : T.textSub,
                    }}
                    onMouseEnter={e => { if (!on) (e.currentTarget as HTMLElement).style.background = T.pageBg; }}
                    onMouseLeave={e => { if (!on) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                  >
                    <div
                      className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 transition-all"
                      style={{ background: on ? m.color : "transparent", border: `1.5px solid ${on ? m.color : "#cfd4dc"}` }}
                    >
                      {on && <svg width="9" height="7" viewBox="0 0 9 7" fill="none"><path d="M1 3.5L3.5 6L8 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                    </div>
                    {m.img
                      ? <img src={m.img} alt={t} style={{ width: 16, height: 16, objectFit: "contain", flexShrink: 0 }} />
                      : <span style={{ color: on ? m.color : T.textHint, flexShrink: 0 }}>{m.icon}</span>}
                    {lbl(t)}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── Sort By ── */}
      <div className="relative flex-shrink-0" ref={sortRef}>
        <button
          type="button"
          onClick={() => setSortOpen(v => !v)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[11.5px] font-semibold transition-all"
          style={{
            background: sortOpen || !isDefaultSort ? T.orangeLight : T.bg,
            border: `1px solid ${sortOpen || !isDefaultSort ? T.orange : T.border}`,
            color: sortOpen || !isDefaultSort ? T.orange : T.textSub,
            boxShadow: sortOpen ? `0 0 0 3px ${T.orangeLight}` : "none",
          }}
          onMouseEnter={e => { if (!sortOpen && isDefaultSort) { (e.currentTarget as HTMLElement).style.borderColor = T.orange; (e.currentTarget as HTMLElement).style.color = T.orange; } }}
          onMouseLeave={e => { if (!sortOpen && isDefaultSort) { (e.currentTarget as HTMLElement).style.borderColor = T.border; (e.currentTarget as HTMLElement).style.color = T.textSub; } }}
        >
          <ArrowUpDown size={13} />
          <span>Sort</span>
          {!isDefaultSort && (
            <span className="hidden sm:inline text-[10px] font-bold max-w-[80px] truncate" style={{ color: T.orange }}>
              · {activeSortLabel}
            </span>
          )}
        </button>

        {sortOpen && (
          <div
            className="absolute right-0 top-[calc(100%+6px)] z-50 rounded-2xl overflow-hidden"
            style={{
              background: T.bg,
              border: `1.5px solid ${T.border}`,
              boxShadow: "0 12px 32px rgba(0,0,0,0.12)",
              minWidth: 175,
            }}
          >
            <div className="flex items-center justify-between px-3.5 pt-3 pb-2" style={{ borderBottom: `1px solid ${T.border}` }}>
              <span className="text-[11px] font-black uppercase tracking-wider" style={{ color: T.textMuted }}>Sort by</span>
              {!isDefaultSort && (
                <button
                  type="button"
                  onClick={() => { onSortChange("date_desc"); setSortOpen(false); }}
                  className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                  style={{ color: "#ef4444", background: "rgba(239,68,68,0.08)" }}
                >
                  Reset
                </button>
              )}
            </div>
            <div className="px-2 pt-1.5 pb-1">
              {SORT_OPTIONS.map(opt => {
                const active = sortBy === opt.key;
                return (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => { onSortChange(opt.key); setSortOpen(false); }}
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-[11.5px] font-bold transition-all"
                    style={{
                      background: active ? T.orangeLight : "transparent",
                      color: active ? T.orange : T.textSub,
                    }}
                    onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = T.pageBg; }}
                    onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                  >
                    <div
                      className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 transition-all"
                      style={{ background: active ? T.orange : "transparent", border: `1.5px solid ${active ? T.orange : "#cfd4dc"}`, color: active ? "#fff" : T.textHint }}
                    >
                      {active
                        ? <svg width="9" height="7" viewBox="0 0 9 7" fill="none"><path d="M1 3.5L3.5 6L8 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        : opt.icon}
                    </div>
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <button
        onClick={() => onResourceModalOpen()}
        className="flex-shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[11.5px] font-semibold text-white"
        style={{ background: T.orange, transition: "background 0.15s ease" }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = T.orangeDark; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = T.orange; }}
      >
        <Plus size={12} strokeWidth={2.5} />
        <span className="hidden sm:inline">Add Resource</span>
        <span className="sm:hidden">Add</span>
      </button>
    </div>
  );
};

// ─── FileList Component ────────────────────────────────────────────────────────
const FileList: React.FC<{
  folders: FolderItem[];
  files: UploadedFile[];
  combinedOrder: CombinedItem[];
  activeTab: "I_Do" | "We_Do" | "You_Do" | null;
  activeSubcategory: string;
  getFolderItemCount: (id: string) => number;
  getFolderTotalSize: (id: string) => number;
  onFolderClick: (id: string, name: string) => void;
  onFileClick: (file: UploadedFile, tab: "I_Do" | "We_Do" | "You_Do" | null, sub: string) => void;
  onEditFolder: (f: FolderItem) => void;
  onDeleteFolder: (f: FolderItem) => void;
  onDeleteFile: (id: string, name: string) => void;
  onUpdateFile: (file: UploadedFile, tab: "I_Do" | "We_Do" | "You_Do", sub: string) => void;
  onEditGroup?: (group: { groupId: string; groupName: string; groupDescription?: string; folders: FolderItem[]; files: UploadedFile[]; subGroups?: SubGroupSeed[] }) => void;
  onNavigateUp: () => void;
  folderNavState: FolderNavState;
  onDeletePage?: (pageId: string, name: string) => void;
  onEditPage: (data: { id: string; title: string; blocks: PageBlock[]; code: string }) => void;
  onPageClick: (page: ViewingPage) => void;
  onBulkDelete: (items: Array<{ type: "file" | "folder" | "page"; id: string; name: string; folderItem?: FolderItem }>) => Promise<void>;
  onResourceModalOpen: (groupId?: string, groupName?: string) => void;
  onShowToast?: (message: string, type?: "success" | "error") => void;
  autoExpandGroupId?: string | null;
  onAutoExpandHandled?: () => void;
}> = ({
  folders, files, combinedOrder, activeTab, activeSubcategory, getFolderItemCount, getFolderTotalSize,
  onFolderClick, onFileClick, onEditFolder, onDeleteFolder, onDeleteFile, onUpdateFile,
  onEditGroup,
  onNavigateUp,
  folderNavState,
  onDeletePage,
  onEditPage,
  onPageClick,
  onBulkDelete,
  onResourceModalOpen,
  onShowToast,
  autoExpandGroupId,
  onAutoExpandHandled,
}) => {
    const [openDrop, setOpenDrop] = useState<string | null>(null);
    const [dropUpward, setDropUpward] = useState(false);
    const [dropPosition, setDropPosition] = useState<{ top: number; right: number } | null>(null);
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
    const [editingGroup, setEditingGroup] = useState<{
      groupId: string;
      groupName: string;
      files: UploadedFile[];
      folders: FolderItem[];
    } | null>(null);
    const [groupDeleteConfirm, setGroupDeleteConfirm] = useState<{
      groupId: string;
      groupName: string;
      items: Array<{ type: "file" | "folder" | "page"; id: string; name: string; folderItem?: FolderItem }>;
    } | null>(null);
    const [bulkProgress, setBulkProgress] = useState<{
      active: boolean;
      label: string;
      percent: number;
    }>({ active: false, label: "", percent: 0 });

    const toggleGroup = (groupId: string) => {
      setExpandedGroups(prev => {
        const s = new Set(prev);
        s.has(groupId) ? s.delete(groupId) : s.add(groupId);
        return s;
      });
    };

    // When the breadcrumb's group crumb routes back to root, open that group's
    // accordion, then clear the request so manual collapse/expand still works.
    useEffect(() => {
      if (!autoExpandGroupId) return;
      setExpandedGroups(prev => {
        if (prev.has(autoExpandGroupId)) return prev;
        const s = new Set(prev);
        s.add(autoExpandGroupId);
        return s;
      });
      onAutoExpandHandled?.();
    }, [autoExpandGroupId]);

    const folderGroupMap = useMemo(() => {
      const map: Record<string, FolderItem[]> = {};
      folders.forEach(f => {
        const gid = (f as any).parentGroupId as string | undefined;
        if (!gid) return;
        if (!map[gid]) map[gid] = [];
        map[gid].push(f);
      });
      return map;
    }, [folders]);

    useEffect(() => {
      const h = (e: MouseEvent) => { if (!(e.target as Element).closest(".dd-w")) setOpenDrop(null); };
      document.addEventListener("mousedown", h);
      return () => document.removeEventListener("mousedown", h);
    }, []);

    const tog = (id: string, e: React.MouseEvent) => {
      e.preventDefault(); e.stopPropagation();
      if (openDrop === id) { setOpenDrop(null); setDropPosition(null); return; }
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const shouldGoUp = window.innerHeight - rect.bottom < 180;
      setDropUpward(shouldGoUp);
      setDropPosition({
        top: shouldGoUp ? rect.top - 4 : rect.bottom + 4,
        right: window.innerWidth - rect.right,
      });
      setOpenDrop(id);
    };

    const allPageEntries = files.filter(f => (f.type || "").toLowerCase() === "page");
    const normal = files.filter(f => (f.type || "").toLowerCase() !== "page");

    // Split pages by whether they belong to a group. Group-bound pages
    // (those with a groupId) get routed into their group row alongside any
    // files in that group; ungrouped pages render at the top of the list
    // as before.
    const pages = allPageEntries.filter(f => !f.groupId);
    const groupedPages = allPageEntries.filter(f => !!f.groupId);

    const standaloneFiles = normal.filter(f => !f.groupId);
    const groupedNormalFiles = normal.filter(f => !!f.groupId);

    // Build the group map from both group-bound files AND group-bound pages.
    const fileGroupMap: Record<string, { groupId: string; groupName: string; description: string; files: UploadedFile[]; parentGroupId?: string }> = {};
    const seedGroup = (gid: string, src: UploadedFile) => {
      if (!fileGroupMap[gid]) fileGroupMap[gid] = { groupId: gid, groupName: "", description: "", files: [] };
      if (!fileGroupMap[gid].groupName && src.groupName) fileGroupMap[gid].groupName = src.groupName;
      if (!fileGroupMap[gid].description && (src as any).description) fileGroupMap[gid].description = (src as any).description;
      if (!fileGroupMap[gid].parentGroupId && src.parentGroupId) fileGroupMap[gid].parentGroupId = src.parentGroupId;
    };
    groupedNormalFiles.forEach(file => {
      const gid = file.groupId!;
      seedGroup(gid, file);
      fileGroupMap[gid].files.push(file);
    });
    groupedPages.forEach(page => {
      const gid = page.groupId!;
      seedGroup(gid, page);
      fileGroupMap[gid].files.push(page);
    });
    // Apply the fallback label only when no entry in the group carried a name
    Object.values(fileGroupMap).forEach(g => { if (!g.groupName) g.groupName = "Untitled group"; });
    const fileGroupList = Object.values(fileGroupMap);

    // Separate top-level groups from sub-groups (groups nested inside another group).
    // Sub-groups have parentGroupId set; top-level groups don't.
    const topLevelGroupList = fileGroupList.filter(g => !g.parentGroupId);
    const subGroupsByParent = new Map<string, typeof fileGroupList>();
    fileGroupList.filter(g => !!g.parentGroupId).forEach(g => {
      const pid = g.parentGroupId!;
      if (!subGroupsByParent.has(pid)) subGroupsByParent.set(pid, []);
      subGroupsByParent.get(pid)!.push(g);
    });

    const empty = folders.length === 0 && files.length === 0;

    const uniquePages = useMemo(() => {
      const pageMap = new Map();
      pages.forEach(page => {
        if (!pageMap.has(page.id)) {
          pageMap.set(page.id, page);
        }
      });
      return Array.from(pageMap.values());
    }, [pages]);

    const allIds = [
      ...uniquePages.map(f => `page-${f.id}`),
      ...folders.map(f => `folder-${f.id}`),
      ...topLevelGroupList.map(g => `group-${g.groupId}`),
      ...standaloneFiles.map(f => `file-${f.id}`),
    ];
    const allSelected = allIds.length > 0 && allIds.every(id => selected.has(id));
    const someSelected = allIds.some(id => selected.has(id));

    const toggleSelect = (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      setSelected(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
    };
    const toggleAll = (e: React.MouseEvent) => {
      e.stopPropagation();
      setSelected(allSelected ? new Set() : new Set(allIds));
    };

    // Runs a bulk delete with an animated progress bar and a SINGLE consolidated
    // toaster at completion. The progress is animated client-side (the bulk
    // API resolves once at the end) — start at 0, ease toward 95% across the
    // estimated duration, then snap to 100% on completion before the toaster.
    const runDeleteWithProgress = async (
      label: string,
      items: Array<{ type: "file" | "folder" | "page"; id: string; name: string; folderItem?: FolderItem }>
    ) => {
      if (items.length === 0) return;
      setBulkProgress({ active: true, label, percent: 0 });

      const estimatedMs = Math.max(900, items.length * 380);
      const startedAt = Date.now();
      let stopped = false;
      const tick = () => {
        if (stopped) return;
        const elapsed = Date.now() - startedAt;
        const pct = Math.min(95, Math.round((elapsed / estimatedMs) * 95));
        setBulkProgress(prev => (prev.active ? { ...prev, percent: pct } : prev));
        if (pct < 95) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);

      let ok = true;
      try {
        await onBulkDelete(items);
      } catch {
        ok = false;
      } finally {
        stopped = true;
        setBulkProgress(prev => ({ ...prev, percent: 100 }));
        // Hold 100% briefly so the bar visibly completes, then hide + single toast.
        setTimeout(() => {
          setBulkProgress({ active: false, label: "", percent: 0 });
          if (onShowToast) {
            onShowToast(
              ok
                ? `${items.length} item${items.length === 1 ? "" : "s"} deleted successfully`
                : "Some items failed to delete",
              ok ? "success" : "error"
            );
          }
        }, 420);
      }
    };

    const handleBulkDelete = async () => {
      setConfirmBulkDelete(false);
      const items: Array<{ type: "file" | "folder" | "page"; id: string; name: string; folderItem?: FolderItem }> = [];
      for (const id of selected) {
        if (id.startsWith("page-")) {
          const realId = id.replace("page-", "");
          const file = uniquePages.find(f => f.id === realId);
          if (file) items.push({ type: "page", id: realId, name: file.name });
        } else if (id.startsWith("folder-")) {
          const realId = id.replace("folder-", "");
          const folder = folders.find(f => f.id === realId);
          if (folder) items.push({ type: "folder", id: realId, name: folder.name, folderItem: folder });
        } else if (id.startsWith("group-")) {
          const groupId = id.replace("group-", "");
          const group = fileGroupList.find(g => g.groupId === groupId);
          if (group) {
            const collectGroup = (gid: string, files: UploadedFile[]) => {
              files.forEach(f => items.push({ type: "file", id: f.id, name: f.name }));
              (folderGroupMap[gid] || []).forEach(fo => items.push({ type: "folder", id: fo.id, name: fo.name, folderItem: fo }));
              (subGroupsByParent.get(gid) || []).forEach(sg => collectGroup(sg.groupId, sg.files));
            };
            collectGroup(groupId, group.files);
          }
        } else {
          const realId = id.replace("file-", "");
          const file = standaloneFiles.find(f => f.id === realId);
          if (file) items.push({ type: "file", id: realId, name: file.name });
        }
      }
      setSelected(new Set());
      await runDeleteWithProgress("Deleting selected items…", items);
    };

    const handleGroupDeleteConfirmed = async () => {
      if (!groupDeleteConfirm) return;
      const { items, groupName } = groupDeleteConfirm;
      setGroupDeleteConfirm(null);
      await runDeleteWithProgress(`Deleting group "${groupName}"…`, items);
    };

    const FONT_STACK = "'Poppins', 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    const rowBase: React.CSSProperties = {
      display: "grid", gridTemplateColumns: "28px minmax(0,1fr) 90px 110px 90px 80px",
      gap: 14, alignItems: "center", borderBottom: `1px solid ${T.border}`,
      padding: "8px 20px", transition: "background 0.15s ease",
      fontFamily: FONT_STACK,
      WebkitFontSmoothing: "antialiased",
      MozOsxFontSmoothing: "grayscale",
      background: T.bg,
      minHeight: 40,
    };

    // Helper to render a file row (used for pages, standalone files, and group child files)
const renderFileRow = (file: UploadedFile, isPage: boolean = false, extraRowStyle?: React.CSSProperties) => {
  const combinedCode = (file as any)._combinedCode || "";
  const pageCount = (file as any)._pageCount ?? 1;
  const isRef = file.isReference === true || String(file.isReference) === "true";
  const isUrl = (file.type || "").includes("url") || (file.type || "").includes("link");
  const furl = typeof file.url === "string" ? file.url : (file.url as any)?.base || "";
  const fileDate = (file as any).updatedAt || (file as any).createdAt || (file as any).uploadedAt || "";
  const meta = isPage
    ? { img: "/icons/page.png", icon: <Layout size={16} strokeWidth={1.9} />, color: "#6366f1", bg: "rgba(99,102,241,0.10)", label: "PAGE" }
    : getFileMeta(file.type || "", file.name, isRef);
  const { img, color, label } = meta as any;
  const hasCode = combinedCode.includes("playground-wrapper") || combinedCode.includes("allow-scripts");

  return (
    <div
      key={file.id}
      className="group/page"
      style={{
        ...rowBase,
        gridTemplateColumns: "28px minmax(0,1fr) 90px 110px 90px 80px",
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.background = "#f8fafc";
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.background = T.bg;
      }}
    >
      {/* ── Checkbox ── */}
      <div
        className="flex items-center justify-center"
        onClick={e => toggleSelect(isPage ? `page-${file.id}` : `file-${file.id}`, e)}
      >
        <div
          className="w-[15px] h-[15px] rounded-[4px] flex items-center justify-center cursor-pointer flex-shrink-0"
          style={{
            background: selected.has(isPage ? `page-${file.id}` : `file-${file.id}`) ? color : "transparent",
            border: `1.5px solid ${selected.has(isPage ? `page-${file.id}` : `file-${file.id}`) ? color : "#cfd4dc"}`,
            transition: "all 0.15s",
          }}
        >
          {selected.has(isPage ? `page-${file.id}` : `file-${file.id}`) && (
            <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
              <path d="M1 3.5L3.5 6L8 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </div>
      </div>

      {/* ── Name ── */}
      <div className="flex items-center gap-2.5 min-w-0">
        {img ? (
          <div className="flex-shrink-0 flex items-center justify-center" style={{ width: 22, height: 22 }}>
            <img src={img} alt={label || "file"} style={{ width: 20, height: 20, objectFit: "contain", display: "block" }} />
          </div>
        ) : (
          <div
            className="flex-shrink-0 flex items-center justify-center"
            style={{
              width: 22, height: 22, borderRadius: 6,
              background: `linear-gradient(135deg, ${color}22 0%, ${color}0d 100%)`,
              border: `1px solid ${color}30`,
              color,
            }}
          >
            {React.cloneElement(meta.icon as React.ReactElement, { size: 12 })}
          </div>
        )}

        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span
              className="truncate"
              style={{
                fontSize: 12.5, fontWeight: 600, color: T.textMain,
                letterSpacing: "-0.005em", lineHeight: 1.3,
                ...(isUrl ? { cursor: "pointer", textDecoration: "underline", textUnderlineOffset: "3px" } : {}),
              }}
              onClick={e => {
                if (!isPage) {
                  e.preventDefault();
                  e.stopPropagation();
                  onFileClick(file, activeTab, activeSubcategory);
                }
              }}
              onMouseEnter={e => {
                if (!isPage) (e.currentTarget as HTMLElement).style.color = color;
              }}
              onMouseLeave={e => {
                if (!isPage) (e.currentTarget as HTMLElement).style.color = T.textMain;
              }}
            >
              {file.name}
            </span>
            {hasCode && (
              <span
                className="flex-shrink-0 flex items-center gap-1"
                style={{
                  fontSize: 9.5, fontWeight: 800, padding: "2px 7px", borderRadius: 4,
                  textTransform: "uppercase", letterSpacing: "0.07em",
                  background: "rgba(16,185,129,0.12)", color: "#047857",
                  border: "1px solid rgba(16,185,129,0.26)",
                }}
              >
                <Code2 size={9} />
                Code
              </span>
            )}
          </div>

          {(file as any).description && stripHtml((file as any).description).trim() && (
            <span
              className="truncate"
              style={{
                fontSize: 10.5, fontWeight: 500, color: T.textHint,
                marginTop: 1, letterSpacing: "-0.002em", lineHeight: 1.35,
                maxWidth: "100%",
              }}
              title={stripHtml((file as any).description)}
            >
              {stripHtml((file as any).description).slice(0, 140)}
              {stripHtml((file as any).description).length > 140 ? "…" : ""}
            </span>
          )}

          <div className="flex items-center gap-1.5" style={{ marginTop: 1 }}>
            {isPage ? (
              <span style={{ fontSize: 10.5, fontWeight: 500, color: T.textHint, letterSpacing: "-0.002em" }}>
                Click to view inline{pageCount > 1 && ` · ${pageCount} pages`}
              </span>
            ) : (
              <>
                {isRef && (
                  <span style={{
                    fontSize: 9, fontWeight: 800, padding: "2px 6px", borderRadius: 4,
                    textTransform: "uppercase", letterSpacing: "0.08em",
                    background: "rgba(139,92,246,0.12)", color: "#7c3aed",
                    border: "1px solid rgba(139,92,246,0.26)",
                  }}>REF</span>
                )}
                {file.tags?.slice(0, 3).map((tag, i) => (
                  <span
                    key={i}
                    className="flex items-center gap-1"
                    style={{
                      fontSize: 10, fontWeight: 800, padding: "2px 7px", borderRadius: 5,
                      background: `${tag.tagColor}16`, color: tag.tagColor,
                      border: `1px solid ${tag.tagColor}30`, letterSpacing: "0.01em",
                    }}
                  >
                    <span className="w-1 h-1 rounded-full" style={{ background: tag.tagColor }} />
                    {tag.tagName}
                  </span>
                ))}
                {(file.tags?.length ?? 0) > 3 && (
                  <span style={{ fontSize: 10.5, fontWeight: 600, color: T.textHint }}>
                    +{(file.tags?.length ?? 0) - 3}
                  </span>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Type ── */}
      <div className="flex items-center">
        {label && (
          <span style={{
            fontSize: 10.5, fontWeight: 700, padding: "2px 7px", borderRadius: 5,
            textTransform: "uppercase", letterSpacing: "0.05em",
            background: "transparent", color: T.textHint,
            border: `1px solid ${T.border}`,
            whiteSpace: "nowrap",
          }}>
            {label}
          </span>
        )}
      </div>

      {/* ── Date Modified ── */}
      <div style={{ fontSize: 11.5, fontWeight: 600, color: T.textMuted, letterSpacing: "-0.004em" }}>
        {formatDateTime(fileDate)}
      </div>

      {/* ── Size ── */}
      <div style={{ fontSize: 12.5, fontWeight: 700, color: T.textSub, letterSpacing: "-0.006em" }}>
        {isPage ? (pageCount > 1 ? `${pageCount} pages` : "1 page") : fmtSize(file.size || 0)}
      </div>

      {/* ── Actions ── */}
      <div className="flex items-center justify-center gap-1 relative dd-w">
        {isPage ? (
          <>
            <button
              type="button"
              onClick={e => tog(`page-${file.id}`, e)}
              className="p-1.5 rounded-lg"
              style={{ color: T.textHint, transition: "all 0.13s" }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.background = "rgba(99,102,241,0.10)";
                (e.currentTarget as HTMLElement).style.color = "#6366f1";
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.background = "transparent";
                (e.currentTarget as HTMLElement).style.color = T.textHint;
              }}
            >
              <MoreVertical size={14} />
            </button>
            {openDrop === `page-${file.id}` && (
              <DropMenu upward={dropUpward} fixedPos={dropPosition ?? undefined}>
                <DropItem icon={<Eye size={12} />} label="View Inline" onClick={() => { onPageClick({ code: combinedCode, title: file.name, pageCount }); setOpenDrop(null); }} />
                <DropItem icon={<RefreshCw size={12} />} label="Update" color="#f97316" onClick={() => {
                  onEditPage({ id: file.id, title: file.name, blocks: (file as any)._blocks ?? [], code: combinedCode });
                  setOpenDrop(null);
                }} />
                <DropItem icon={<ExternalLink size={12} />} label="Open in New Tab" onClick={() => { openPageInNewTab(combinedCode); setOpenDrop(null); }} />
                <DropItem icon={<Trash2 size={12} />} label="Delete" color="#ef4444" divider onClick={() => { onDeletePage?.(file.id, file.name); setOpenDrop(null); }} />
              </DropMenu>
            )}
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={e => tog(`file-${file.id}`, e)}
              className="p-1.5 rounded-lg"
              style={{ color: T.textHint, transition: "all 0.13s" }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.background = `${color}14`;
                (e.currentTarget as HTMLElement).style.color = color;
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.background = "transparent";
                (e.currentTarget as HTMLElement).style.color = T.textHint;
              }}
            >
              <MoreVertical size={14} />
            </button>
            {openDrop === `file-${file.id}` && (
              <DropMenu upward={dropUpward} fixedPos={dropPosition ?? undefined}>
                <DropItem icon={isUrl ? <ExternalLink size={12} /> : <Eye size={12} />} label={isUrl ? "Open Link" : "Preview"} onClick={() => { onFileClick(file, activeTab, activeSubcategory); setOpenDrop(null); }} />
                {!isUrl && (
                  <DropItem icon={<Download size={12} />} label="Download" onClick={() => {
                    const a = document.createElement("a");
                    a.href = furl; a.download = file.name || "download";
                    document.body.appendChild(a); a.click(); document.body.removeChild(a);
                    setOpenDrop(null);
                  }} />
                )}
                <DropItem icon={<RefreshCw size={12} />} label="Update" color="#f97316" onClick={() => { onUpdateFile(file, activeTab || "I_Do", activeSubcategory); setOpenDrop(null); }} />
                <DropItem icon={<Trash2 size={12} />} label="Delete" color="#ef4444" divider onClick={() => { onDeleteFile(file.id, file.name); setOpenDrop(null); }} />
              </DropMenu>
            )}
          </>
        )}
      </div>
    </div>
  );
};

    // Helper to render a folder row
   const renderFolderRow = (folder: FolderItem) => (
  <div
    key={folder.id}
    onClick={() => onFolderClick(folder.id, folder.name)}
    className="group/row cursor-pointer"
    style={{
      ...rowBase,
      gridTemplateColumns: "28px minmax(0,1fr) 90px 110px 90px 80px",
    }}
    onMouseEnter={e => {
      (e.currentTarget as HTMLElement).style.background = "#f8fafc";
    }}
    onMouseLeave={e => {
      (e.currentTarget as HTMLElement).style.background = T.bg;
    }}
  >
    {/* ── Checkbox ── */}
    <div className="flex items-center justify-center" onClick={e => toggleSelect(`folder-${folder.id}`, e)}>
      <div
        className="w-[15px] h-[15px] rounded-[4px] flex items-center justify-center cursor-pointer flex-shrink-0"
        style={{
          background: selected.has(`folder-${folder.id}`) ? T.orange : "transparent",
          border: `1.5px solid ${selected.has(`folder-${folder.id}`) ? T.orange : "#cfd4dc"}`,
          transition: "all 0.15s",
        }}
      >
        {selected.has(`folder-${folder.id}`) && (
          <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
            <path d="M1 3.5L3.5 6L8 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>
    </div>

    {/* ── Name ── */}
    <div className="flex items-center gap-2.5 min-w-0">
      <div className="flex-shrink-0 flex items-center justify-center" style={{ width: 22, height: 22 }}>
        <img src="/icons/folder.png" alt="Folder" style={{ width: 22, height: 22, objectFit: "contain", display: "block" }} />
      </div>
      <div className="flex flex-col min-w-0">
        <span className="truncate" style={{ fontSize: 12.5, fontWeight: 600, color: T.textMain, letterSpacing: "-0.005em", lineHeight: 1.3 }}>
          {folder.name}
        </span>
        <span style={{ fontSize: 10.5, fontWeight: 500, color: T.textHint, marginTop: 1, letterSpacing: "-0.002em" }}>
          {getFolderItemCount(folder.id)} item{getFolderItemCount(folder.id) === 1 ? "" : "s"}
        </span>
        {folder.tags?.length > 0 && (
          <div className="flex items-center gap-1 mt-1.5">
            {folder.tags.map((tag, i) => (
              <span key={i} style={{
                fontSize: 10, fontWeight: 800, padding: "2px 7px", borderRadius: 5,
                background: `${tag.tagColor}16`, color: tag.tagColor,
                border: `1px solid ${tag.tagColor}30`, letterSpacing: "0.01em",
              }}>
                {tag.tagName}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>

    {/* ── Type ── */}
    <div className="flex items-center">
      <span style={{
        fontSize: 10.5, fontWeight: 700, padding: "2px 7px", borderRadius: 5,
        textTransform: "uppercase", letterSpacing: "0.05em",
        background: "transparent", color: T.textHint,
        border: `1px solid ${T.border}`,
        whiteSpace: "nowrap",
      }}>
        Folder
      </span>
    </div>

    {/* ── Date Modified ── */}
    <div style={{ fontSize: 11.5, fontWeight: 600, color: T.textMuted, letterSpacing: "-0.004em" }}>
      {formatDateTime((folder as any).updatedAt || (folder as any).createdAt || (folder as any).uploadedAt || "")}
    </div>

    {/* ── Size (total bytes of every file inside, recursive) ── */}
    <div style={{ fontSize: 12, fontWeight: 600, color: T.textMuted }}>
      {fmtFolderSize(getFolderTotalSize(folder.id))}
    </div>

    {/* ── Actions ── */}
    <div className="flex items-center justify-center relative dd-w">
      <button
        type="button"
        onClick={e => tog(`folder-${folder.id}`, e)}
        className="p-1.5 rounded-lg"
        style={{ color: T.textHint, transition: "all 0.13s" }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLElement).style.background = T.orangeLight;
          (e.currentTarget as HTMLElement).style.color = T.orange;
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLElement).style.background = "transparent";
          (e.currentTarget as HTMLElement).style.color = T.textHint;
        }}
      >
        <MoreVertical size={14} />
      </button>
      {openDrop === `folder-${folder.id}` && (
        <DropMenu upward={dropUpward} fixedPos={dropPosition ?? undefined}>
          <DropItem icon={<Edit2 size={12} />} label="Edit Folder" onClick={() => { onEditFolder(folder); setOpenDrop(null); }} />
          <DropItem icon={<Trash2 size={12} />} label="Delete" color="#ef4444" divider onClick={() => { onDeleteFolder(folder); setOpenDrop(null); }} />
        </DropMenu>
      )}
    </div>
  </div>
);

    // Recursive sub-group renderer. depth=1 for the first level inside a top-level group,
    // 2 for groups inside that, and so on. Each level adds 28px of left padding so the
    // nesting is visually obvious. Each sub-group has its own "+ Add resource to this group"
    // button so the user can keep nesting groups inside groups.
    // Recursively builds a tree of sub-groups under `gid` so the edit modal
    // can show the full group-inside-group structure.
    const buildSubGroupTree = (gid: string): SubGroupSeed[] =>
      (subGroupsByParent.get(gid) || []).map(sg => ({
        groupId: sg.groupId,
        groupName: sg.groupName,
        description: sg.description,
        files: sg.files,
        folders: folderGroupMap[sg.groupId] || [],
        subGroups: buildSubGroupTree(sg.groupId),
      }));

    const renderSubGroup = (subGroup: typeof fileGroupList[number], depth: number): React.ReactNode => {
      const isSubExpanded = expandedGroups.has(subGroup.groupId);
      const subFolders = folderGroupMap[subGroup.groupId] || [];
      const nestedSubGroups = subGroupsByParent.get(subGroup.groupId) || [];
      const subTotalSize = subGroup.files.reduce((s, f) => s + (Number(f.size) || 0), 0)
        + subFolders.reduce((s, f) => s + getFolderTotalSize(f.id), 0)
        + nestedSubGroups.reduce((s, ng) =>
            s + ng.files.reduce((ss, f) => ss + (Number(f.size) || 0), 0)
              + (folderGroupMap[ng.groupId] || []).reduce((ss, f) => ss + getFolderTotalSize(f.id), 0),
            0,
          );
      const subDate = [...subGroup.files.map((x: any) => x.updatedAt || x.createdAt || ""), ...subFolders.map((x: any) => x.updatedAt || x.createdAt || "")]
        .filter(Boolean)
        .reduce((latest, cur) => { const a = new Date(latest).getTime(), b = new Date(cur).getTime(); return isNaN(b) ? latest : (isNaN(a) || b > a ? cur : latest); }, "");

      const headerPad = 24 + 28 * depth;       // depth 1 → 52, depth 2 → 80
      const contentPad = headerPad + 28;        // depth 1 → 80, depth 2 → 108

      return (
        <div key={subGroup.groupId}>
          {/* Sub-group header row */}
          <div
            className="cursor-pointer"
            style={{
              display: "grid",
              gridTemplateColumns: "28px minmax(0,1fr) 90px 110px 90px 80px",
              gap: 14, alignItems: "center",
              borderBottom: `1px solid ${T.border}`,
              padding: `6px 20px 6px ${headerPad}px`,
              background: T.bg, minHeight: 36,
              fontFamily: "'Poppins','Poppins',-apple-system,sans-serif",
            }}
            onClick={e => { e.stopPropagation(); toggleGroup(subGroup.groupId); }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "#f8fafc"}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = T.bg}
          >
            <div />
            <div className="flex items-center gap-2.5 min-w-0">
              <div style={{ fontSize: 9, color: T.textHint, flexShrink: 0, marginRight: -4 }}>├</div>
              <div style={{ width: 20, height: 20, borderRadius: 5, flexShrink: 0, background: T.orangeLight, border: `1px solid ${T.orange}30`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Folder size={11} style={{ color: T.orange }} strokeWidth={1.8} />
              </div>
              <div style={{ transform: isSubExpanded ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.2s cubic-bezier(0.4,0,0.2,1)", color: isSubExpanded ? T.orange : T.textHint, flexShrink: 0 }}>
                <ChevronRight size={13} strokeWidth={2.2} />
              </div>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: isSubExpanded ? T.orange : T.textMain, letterSpacing: "-0.005em" }}>
                {subGroup.groupName}
              </span>
            </div>
            <div className="flex items-center">
              <span style={{ fontSize: 10.5, fontWeight: 700, padding: "2px 7px", borderRadius: 5, textTransform: "uppercase" as const, letterSpacing: "0.05em", background: "transparent", color: T.textHint, border: `1px solid ${T.border}`, whiteSpace: "nowrap" as const }}>
                Group
              </span>
            </div>
            <div style={{ fontSize: 11.5, fontWeight: 600, color: T.textMuted }}>
              {formatDateTime(subDate)}
            </div>
            <div style={{ fontSize: 12, fontWeight: 600, color: T.textMuted }}>
              {fmtFolderSize(subTotalSize)}
            </div>
            {/* Three-dots menu for sub-group — same Open/Edit/Delete as top-level groups */}
            <div className="flex items-center justify-center relative dd-w" onClick={e => e.stopPropagation()}>
              <button
                type="button"
                onClick={e => tog(`group-menu-${subGroup.groupId}`, e)}
                className="p-1.5 rounded-lg"
                style={{ color: T.textHint, transition: "all 0.13s" }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.background = T.orangeLight;
                  (e.currentTarget as HTMLElement).style.color = T.orange;
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.background = "transparent";
                  (e.currentTarget as HTMLElement).style.color = T.textHint;
                }}
              >
                <MoreVertical size={14} />
              </button>
              {openDrop === `group-menu-${subGroup.groupId}` && (
                <DropMenu upward={dropUpward} fixedPos={dropPosition ?? undefined}>
                  <DropItem
                    icon={isSubExpanded ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
                    label={isSubExpanded ? "Close" : "Open"}
                    onClick={() => { toggleGroup(subGroup.groupId); setOpenDrop(null); }}
                  />
                  <DropItem icon={<Edit2 size={12} />} label="Edit" onClick={() => {
                    if (onEditGroup) {
                      onEditGroup({
                        groupId: subGroup.groupId,
                        groupName: subGroup.groupName,
                        groupDescription: subGroup.description,
                        folders: subFolders,
                        files: subGroup.files,
                        subGroups: buildSubGroupTree(subGroup.groupId),
                      });
                    } else {
                      setEditingGroup({
                        groupId: subGroup.groupId,
                        groupName: subGroup.groupName,
                        files: subGroup.files,
                        folders: subFolders,
                      });
                    }
                    setOpenDrop(null);
                  }} />
                  <DropItem
                    icon={<Trash2 size={12} />}
                    label="Delete"
                    color="#ef4444"
                    divider
                    onClick={() => {
                      const items: Array<{ type: "file" | "folder" | "page"; id: string; name: string; folderItem?: FolderItem }> = [];
                      const collectDeep = (gid: string, files: UploadedFile[], folders: FolderItem[]) => {
                        folders.forEach(f => items.push({ type: "folder", id: f.id, name: f.name, folderItem: f }));
                        files.forEach(f => items.push({ type: "file", id: f.id, name: f.name }));
                        (subGroupsByParent.get(gid) || []).forEach(ng =>
                          collectDeep(ng.groupId, ng.files, folderGroupMap[ng.groupId] || []),
                        );
                      };
                      collectDeep(subGroup.groupId, subGroup.files, subFolders);
                      setGroupDeleteConfirm({ groupId: subGroup.groupId, groupName: subGroup.groupName, items });
                      setOpenDrop(null);
                    }}
                  />
                </DropMenu>
              )}
            </div>
          </div>
          {/* Sub-group expanded content */}
          {isSubExpanded && (
            <div style={{ background: T.bg, borderBottom: `1px solid ${T.border}` }}>
              {subFolders.map((folder) => (
                <div
                  key={folder.id}
                  style={{
                    display: "grid", gridTemplateColumns: "28px minmax(0,1fr) 90px 110px 90px 80px",
                    gap: 14, alignItems: "center", borderBottom: `1px solid ${T.border}`,
                    padding: `6px 20px 6px ${contentPad}px`, background: T.bg, minHeight: 36, cursor: "pointer",
                  }}
                  onClick={e => { e.stopPropagation(); onFolderClick(folder.id, folder.name); }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "#f8fafc"}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = T.bg}
                >
                  <div />
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div style={{ fontSize: 9, color: T.textHint, flexShrink: 0, marginRight: -4 }}>├</div>
                    <div style={{ width: 20, height: 20, borderRadius: 5, flexShrink: 0, background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.28)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Folder size={11} style={{ color: "#F59E0B" }} strokeWidth={1.8} />
                    </div>
                    <span className="truncate" style={{ fontSize: 12.5, fontWeight: 600, color: T.textMain }}>{folder.name}/</span>
                  </div>
                  <div className="flex items-center"><span style={{ fontSize: 10.5, fontWeight: 700, padding: "2px 7px", borderRadius: 5, textTransform: "uppercase" as const, letterSpacing: "0.05em", background: "transparent", color: T.textHint, border: `1px solid ${T.border}` }}>Folder</span></div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: T.textMuted }}>{formatDateTime((folder as any).updatedAt || (folder as any).createdAt || "")}</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: T.textSub }}>{fmtFolderSize(getFolderTotalSize(folder.id))}</div>
                  <div />
                </div>
              ))}
              {/* Nested sub-groups inside this sub-group (recursive) */}
              {nestedSubGroups.map(ng => renderSubGroup(ng, depth + 1))}
              {subGroup.files.map((file, fi) => {
                const isSubLast = fi === subGroup.files.length - 1;
                const subMeta = getFileMeta(file.type || "", file.name, file.isReference === true || String(file.isReference) === "true") as any;
                return (
                  <div
                    key={file.id}
                    style={{
                      display: "grid", gridTemplateColumns: "28px minmax(0,1fr) 90px 110px 90px 80px",
                      gap: 14, alignItems: "center",
                      borderBottom: `1px solid ${T.border}`,
                      padding: `6px 20px 6px ${contentPad}px`,
                      background: T.bg, minHeight: 36,
                    }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "#f8fafc"}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = T.bg}
                  >
                    <div />
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div style={{ fontSize: 9, color: T.textHint, flexShrink: 0, marginRight: -4 }}>{isSubLast ? "└" : "├"}</div>
                      {subMeta.img ? (
                        <div style={{ width: 20, height: 20, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <img src={subMeta.img} alt={subMeta.label} style={{ width: 18, height: 18, objectFit: "contain" }} />
                        </div>
                      ) : (
                        <div style={{ width: 20, height: 20, borderRadius: 5, flexShrink: 0, background: `${subMeta.color}16`, border: `1px solid ${subMeta.color}28`, display: "flex", alignItems: "center", justifyContent: "center", color: subMeta.color }}>
                          {React.cloneElement(subMeta.icon as React.ReactElement, { size: 11 })}
                        </div>
                      )}
                      <span className="truncate" style={{ fontSize: 12.5, fontWeight: 600, color: T.textMain, cursor: "pointer" }}
                        onClick={e => { e.stopPropagation(); onFileClick(file, activeTab, activeSubcategory); }}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = subMeta.color}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = T.textMain}
                      >
                        {file.name}
                      </span>
                    </div>
                    <div className="flex items-center"><span style={{ fontSize: 10.5, fontWeight: 700, padding: "2px 7px", borderRadius: 5, textTransform: "uppercase" as const, letterSpacing: "0.05em", background: "transparent", color: T.textHint, border: `1px solid ${T.border}` }}>{subMeta.label}</span></div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: T.textMuted }}>{formatDateTime((file as any).updatedAt || (file as any).createdAt || (file as any).uploadedAt || "")}</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: T.textSub }}>{fmtSize(file.size || 0)}</div>
                    <div className="flex items-center justify-center gap-1 relative dd-w">
                      <button type="button" onClick={e => tog(`file-${file.id}`, e)} className="p-1.5 rounded-lg" style={{ color: T.textHint, transition: "all 0.13s" }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = `${subMeta.color}14`; (e.currentTarget as HTMLElement).style.color = subMeta.color; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = T.textHint; }}>
                        <MoreVertical size={14} />
                      </button>
                      {openDrop === `file-${file.id}` && (
                        <DropMenu upward={dropUpward} fixedPos={dropPosition ?? undefined}>
                          <DropItem icon={<Eye size={12} />} label="Preview" onClick={() => { onFileClick(file, activeTab, activeSubcategory); setOpenDrop(null); }} />
                          <DropItem icon={<Download size={12} />} label="Download" onClick={() => {
                            const furl = typeof file.url === "string" ? file.url : (file.url as any)?.base || "";
                            const a = document.createElement("a"); a.href = furl; a.download = file.name || "download"; document.body.appendChild(a); a.click(); document.body.removeChild(a);
                            setOpenDrop(null);
                          }} />
                          <DropItem icon={<RefreshCw size={12} />} label="Update" color="#f97316" onClick={() => { onUpdateFile(file, activeTab || "I_Do", activeSubcategory); setOpenDrop(null); }} />
                          <DropItem icon={<Trash2 size={12} />} label="Delete" color="#ef4444" divider onClick={() => { onDeleteFile(file.id, file.name); setOpenDrop(null); }} />
                        </DropMenu>
                      )}
                    </div>
                  </div>
                );
              })}
              {/* Add resource to this sub-group — enables further nesting (group inside group). */}
              <div style={{ padding: `8px 18px 10px ${contentPad - 2}px`, borderTop: `1px solid ${T.border}` }}>
                <button
                  type="button"
                  onClick={e => { e.stopPropagation(); onResourceModalOpen(subGroup.groupId, subGroup.groupName); }}
                  style={{
                    fontSize: 11, fontWeight: 700, padding: "5px 12px", borderRadius: 7,
                    background: T.orangeLight, color: T.orange, border: `1px solid ${T.orange}30`,
                    cursor: "pointer", transition: "all 0.13s",
                  }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = T.orangeMid}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = T.orangeLight}
                >
                  + Add resource to this group
                </button>
              </div>
            </div>
          )}
        </div>
      );
    };

    // Helper to render a group accordion row
    const renderGroupRow = (group: { groupId: string; groupName: string; description: string; files: UploadedFile[]; folders?: FolderItem[] }) => {
      const isExpanded = expandedGroups.has(group.groupId);
      const isSelected = selected.has(`group-${group.groupId}`);

      // ── Date Modified: pick the most-recent timestamp across every file and folder
      //    in the group (not just files[0], which is empty for folder-only groups). ──
      const pickDate = (x: any): string =>
        x?.updatedAt || x?.createdAt || x?.uploadedAt || "";
      const dateCandidates: string[] = [
        ...group.files.map(pickDate),
        ...(group.folders || []).map(pickDate),
      ].filter(Boolean);
      const groupDate = dateCandidates.length
        ? dateCandidates.reduce((latest, cur) => {
            const a = new Date(latest).getTime();
            const b = new Date(cur).getTime();
            return isNaN(b) ? latest : (isNaN(a) || b > a ? cur : latest);
          }, dateCandidates[0])
        : "";

      // Recursively walk a group and all its nested sub-groups to compute
      // total size / item count for the count + size badges.
      const sumGroupRecursive = (gid: string, files: UploadedFile[], folders: FolderItem[]): { size: number; count: number } => {
        let size = files.reduce((s, f) => s + (Number(f.size) || 0), 0)
          + folders.reduce((s, f) => s + getFolderTotalSize(f.id), 0);
        let count = files.length + folders.reduce((s, f) => s + getFolderItemCount(f.id), 0);
        for (const ng of subGroupsByParent.get(gid) || []) {
          const r = sumGroupRecursive(ng.groupId, ng.files, folderGroupMap[ng.groupId] || []);
          size += r.size; count += r.count;
        }
        return { size, count };
      };
      const { size: groupTotalSize, count: groupItemCount } = sumGroupRecursive(
        group.groupId, group.files, group.folders || [],
      );

      return (
        <div key={group.groupId}>
          {/* Group header row */}
        {/* Group header row */}
<div
  className="group/row cursor-pointer"
  style={{
    ...rowBase,
    gridTemplateColumns: "28px minmax(0,1fr) 90px 110px 90px 80px",
    background: T.bg,
  }}
  onClick={() => toggleGroup(group.groupId)}
  onMouseEnter={e => {
    (e.currentTarget as HTMLElement).style.background = "#f8fafc";
  }}
  onMouseLeave={e => {
    (e.currentTarget as HTMLElement).style.background = T.bg;
  }}
>
  {/* ── Checkbox ── */}
  <div className="flex items-center justify-center" onClick={e => toggleSelect(`group-${group.groupId}`, e)}>
    <div
      className="w-[15px] h-[15px] rounded-[4px] flex items-center justify-center cursor-pointer flex-shrink-0"
      style={{
        background: isSelected ? T.orange : "transparent",
        border: `1.5px solid ${isSelected ? T.orange : "#cfd4dc"}`,
        transition: "all 0.15s",
      }}
    >
      {isSelected && (
        <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
          <path d="M1 3.5L3.5 6L8 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </div>
  </div>

  {/* ── Name + description ── */}
  <div className="flex items-center gap-2.5 min-w-0">
    <div
      className="flex-shrink-0 flex items-center justify-center"
      style={{ width: 22, height: 22, borderRadius: 6, background: T.orangeLight, border: `1px solid ${T.orange}30` }}
    >
      <Folder size={12} style={{ color: T.orange }} strokeWidth={1.8} />
    </div>
    <div className="flex flex-col min-w-0">
      <div className="flex items-center gap-1.5 flex-wrap">
        <div style={{
          transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)",
          transition: "transform 0.2s cubic-bezier(0.4,0,0.2,1)",
          color: isExpanded ? T.orange : T.textHint,
          flexShrink: 0,
        }}>
          <ChevronRight size={14} strokeWidth={2.2} />
        </div>
        <span style={{
          fontSize: 12.5, fontWeight: 600, color: isExpanded ? T.orange : T.textMain,
          letterSpacing: "-0.005em", lineHeight: 1.3, cursor: "pointer",
        }}>
          {group.groupName}
        </span>
        {/* <span style={{
          fontSize: 9.5, fontWeight: 600, padding: "1px 6px", borderRadius: 4,
          color: T.textHint, border: `1px solid ${T.border}`,
        }}>
          {groupItemCount} file{groupItemCount !== 1 ? "s" : ""}
        </span> */}
      </div>
      {group.description && stripHtml(group.description).trim() && (
        <span
          style={{
            fontSize: 10.5, fontWeight: 500, color: T.textHint,
            marginTop: 1, letterSpacing: "-0.002em", lineHeight: 1.35,
          }}
          title={stripHtml(group.description)}
        >
          {stripHtml(group.description).slice(0, 140)}
          {stripHtml(group.description).length > 140 ? "…" : ""}
        </span>
      )}
    </div>
  </div>

  {/* ── Type ── */}
  <div className="flex items-center">
    <span style={{
      fontSize: 10.5, fontWeight: 700, padding: "2px 7px", borderRadius: 5,
      textTransform: "uppercase", letterSpacing: "0.05em",
      background: "transparent", color: T.textHint,
      border: `1px solid ${T.border}`,
      whiteSpace: "nowrap",
    }}>
      Group
    </span>
  </div>

  {/* ── Date Modified ── */}
  <div style={{ fontSize: 11.5, fontWeight: 600, color: T.textMuted, letterSpacing: "-0.004em" }}>
    {formatDateTime(groupDate)}
  </div>

  {/* ── Size (recursive total across every file + folder in the group) ── */}
  <div style={{ fontSize: 12, fontWeight: 600, color: T.textMuted }}>
    {fmtFolderSize(groupTotalSize)}
  </div>

  {/* ── Actions ── */}
  <div className="flex items-center justify-center relative dd-w">
    <button
      type="button"
      onClick={e => tog(`group-menu-${group.groupId}`, e)}
      className="p-1.5 rounded-lg"
      style={{ color: T.textHint, transition: "all 0.13s" }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.background = T.orangeLight;
        (e.currentTarget as HTMLElement).style.color = T.orange;
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.background = "transparent";
        (e.currentTarget as HTMLElement).style.color = T.textHint;
      }}
    >
      <MoreVertical size={14} />
    </button>
    {openDrop === `group-menu-${group.groupId}` && (
      <DropMenu upward={dropUpward} fixedPos={dropPosition ?? undefined}>
        <DropItem
          icon={isExpanded ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
          label={isExpanded ? "Close" : "Open"}
          onClick={() => { toggleGroup(group.groupId); setOpenDrop(null); }}
        />
        <DropItem icon={<Edit2 size={12} />} label="Edit" onClick={() => {
          if (onEditGroup) {
            onEditGroup({
              groupId: group.groupId,
              groupName: group.groupName,
              groupDescription: group.description,
              folders: group.folders || [],
              files: group.files,
              subGroups: buildSubGroupTree(group.groupId),
            });
          } else {
            setEditingGroup({
              groupId: group.groupId,
              groupName: group.groupName,
              files: group.files,
              folders: group.folders || [],
            });
          }
          setOpenDrop(null);
        }} />
        <DropItem
          icon={<Trash2 size={12} />}
          label="Delete"
          color="#ef4444"
          divider
          onClick={() => {
            const items: Array<{ type: "file" | "folder" | "page"; id: string; name: string; folderItem?: FolderItem }> = [];
            const collectDeep = (gid: string, files: UploadedFile[], folders: FolderItem[]) => {
              folders.forEach(f => items.push({ type: "folder", id: f.id, name: f.name, folderItem: f }));
              files.forEach(f => items.push({ type: "file", id: f.id, name: f.name }));
              (subGroupsByParent.get(gid) || []).forEach(sg =>
                collectDeep(sg.groupId, sg.files, folderGroupMap[sg.groupId] || []),
              );
            };
            collectDeep(group.groupId, group.files, group.folders || []);
            setGroupDeleteConfirm({ groupId: group.groupId, groupName: group.groupName, items });
            setOpenDrop(null);
          }}
        />
      </DropMenu>
    )}
  </div>
</div>
          {/* Expanded file list */}
          {isExpanded && (
            <div style={{ background: T.bg, borderBottom: `1px solid ${T.border}` }}>
              {/* Folders inside the group */}
              {group.folders && group.folders.map((folder, fi) => {
                const isLastFolder = fi === (group.folders!.length - 1) && group.files.length === 0;
                return (
                  <div
                    key={folder.id}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "28px minmax(0,1fr) 90px 110px 90px 80px",
                      gap: 14, alignItems: "center",
                      borderBottom: `1px solid ${T.border}`,
                      padding: "6px 20px 6px 52px",
                      transition: "background 0.15s ease",
                      fontFamily: FONT_STACK,
                      cursor: "pointer",
                      background: T.bg,
                      minHeight: 36,
                    }}
                    onClick={e => { e.stopPropagation(); onFolderClick(folder.id, folder.name); }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLElement).style.background = "#f8fafc";
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLElement).style.background = T.bg;
                    }}
                  >
                    <div />
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div style={{ fontSize: 9, color: T.textHint, flexShrink: 0, marginRight: -4 }}>
                        {isLastFolder ? "└" : "├"}
                      </div>
                      <div style={{
                        width: 20, height: 20, borderRadius: 5, flexShrink: 0,
                        background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.28)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        <Folder size={11} style={{ color: "#F59E0B" }} strokeWidth={1.8} />
                      </div>
                      <span className="truncate" style={{ fontSize: 12.5, fontWeight: 600, color: T.textMain }}>
                        {folder.name}/
                      </span>
                    </div>
                    {/* ── Type ── */}
                    <div className="flex items-center">
                      <span style={{
                        fontSize: 10.5, fontWeight: 700, padding: "2px 7px", borderRadius: 5,
                        textTransform: "uppercase", letterSpacing: "0.05em",
                        background: "transparent", color: T.textHint,
                        border: `1px solid ${T.border}`,
                        whiteSpace: "nowrap",
                      }}>
                        Folder
                      </span>
                    </div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: T.textMuted }}>
                      {formatDateTime((folder as any).updatedAt || (folder as any).createdAt || "")}
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: T.textSub }}>
                      {fmtFolderSize(getFolderTotalSize(folder.id))}
                    </div>
                    <div className="flex items-center justify-center">
                      <button
                        type="button"
                        onClick={e => { e.stopPropagation(); onFolderClick(folder.id, folder.name); }}
                        style={{ fontSize: 10.5, fontWeight: 700, padding: "4px 9px", borderRadius: 7, background: "rgba(245,158,11,0.10)", color: "#d97706", border: "1px solid rgba(245,158,11,0.22)", transition: "all 0.13s" }}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "rgba(245,158,11,0.18)"}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "rgba(245,158,11,0.10)"}
                      >
                        Open
                      </button>
                    </div>
                  </div>
                );
              })}
              {/* Sub-groups nested inside this group (recursive — supports unlimited depth) */}
              {(subGroupsByParent.get(group.groupId) || []).map((subGroup) => renderSubGroup(subGroup, 1))}
              {group.files.map((file, fi) => {
                const isLast = fi === group.files.length - 1;
                const { color } = getFileMeta(file.type || "", file.name, file.isReference === true || String(file.isReference) === "true") as any;
                return (
                  <div
                    key={file.id}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "28px minmax(0,1fr) 90px 110px 90px 80px",
                      gap: 14, alignItems: "center",
                      borderBottom: isLast ? "none" : `1px solid ${T.border}`,
                      padding: "6px 20px 6px 52px",
                      transition: "background 0.15s ease",
                      fontFamily: FONT_STACK,
                      background: T.bg,
                      minHeight: 36,
                    }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLElement).style.background = "#f8fafc";
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLElement).style.background = T.bg;
                    }}
                  >
                    {/* Empty checkbox placeholder */}
                    <div />
                    {/* File name + icon */}
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div style={{ fontSize: 9, color: T.textHint, flexShrink: 0, marginRight: -4 }}>
                        {fi === group.files.length - 1 ? "└" : "├"}
                      </div>
                      {(() => {
                        const meta = getFileMeta(file.type || "", file.name, file.isReference === true || String(file.isReference) === "true") as any;
                        return meta.img ? (
                          <div style={{ width: 20, height: 20, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <img src={meta.img} alt={meta.label} style={{ width: 18, height: 18, objectFit: "contain" }} />
                          </div>
                        ) : (
                          <div style={{
                            width: 20, height: 20, borderRadius: 5, flexShrink: 0,
                            background: `${meta.color}16`, border: `1px solid ${meta.color}28`,
                            display: "flex", alignItems: "center", justifyContent: "center", color: meta.color,
                          }}>
                            {React.cloneElement(meta.icon as React.ReactElement, { size: 11 })}
                          </div>
                        );
                      })()}
                      <div className="flex flex-col min-w-0">
                        <span
                          className="truncate"
                          style={{ fontSize: 12.5, fontWeight: 600, color: T.textMain, cursor: "pointer" }}
                          onClick={e => { e.stopPropagation(); onFileClick(file, activeTab, activeSubcategory); }}
                          onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = color}
                          onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = T.textMain}
                        >
                          {file.name}
                        </span>
                        {(file as any).description && stripHtml((file as any).description).trim() && (
                          <span
                            className="truncate"
                            style={{
                              fontSize: 10.5, fontWeight: 500, color: T.textHint,
                              marginTop: 1, letterSpacing: "-0.002em", lineHeight: 1.35,
                              maxWidth: "100%",
                            }}
                            title={stripHtml((file as any).description)}
                          >
                            {stripHtml((file as any).description).slice(0, 140)}
                            {stripHtml((file as any).description).length > 140 ? "…" : ""}
                          </span>
                        )}
                        {file.tags && file.tags.length > 0 && (
                          <div className="flex items-center gap-1 mt-0.5">
                            {file.tags.slice(0, 2).map((tag, ti) => (
                              <span key={ti} style={{ fontSize: 9, fontWeight: 800, padding: "1px 5px", borderRadius: 4, background: `${tag.tagColor}16`, color: tag.tagColor, border: `1px solid ${tag.tagColor}30` }}>{tag.tagName}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    {/* ── Type ── */}
                    {(() => {
                      const meta = getFileMeta(file.type || "", file.name, file.isReference === true || String(file.isReference) === "true") as any;
                      return (
                        <div className="flex items-center">
                          <span style={{
                            fontSize: 10.5, fontWeight: 700, padding: "2px 7px", borderRadius: 5,
                            textTransform: "uppercase", letterSpacing: "0.05em",
                            background: "transparent", color: T.textHint,
                            border: `1px solid ${T.border}`,
                            whiteSpace: "nowrap",
                          }}>
                            {meta.label}
                          </span>
                        </div>
                      );
                    })()}
                    {/* Date */}
                    <div style={{ fontSize: 11, fontWeight: 600, color: T.textMuted }}>
                      {formatDateTime((file as any).updatedAt || (file as any).createdAt || (file as any).uploadedAt || "")}
                    </div>
                    {/* Size */}
                    <div style={{ fontSize: 12, fontWeight: 700, color: T.textSub }}>
                      {fmtSize(file.size || 0)}
                    </div>
                    {/* Actions */}
                    <div className="flex items-center justify-center gap-1 relative dd-w">
                      <button type="button" onClick={e => tog(`file-${file.id}`, e)} className="p-1.5 rounded-lg" style={{ color: T.textHint, transition: "all 0.13s" }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = `${color}14`; (e.currentTarget as HTMLElement).style.color = color; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = T.textHint; }}>
                        <MoreVertical size={14} />
                      </button>
                      {openDrop === `file-${file.id}` && (
                        <DropMenu upward={dropUpward} fixedPos={dropPosition ?? undefined}>
                          <DropItem icon={<Eye size={12} />} label="Preview" onClick={() => { onFileClick(file, activeTab, activeSubcategory); setOpenDrop(null); }} />
                          <DropItem icon={<Download size={12} />} label="Download" onClick={() => {
                            const furl = typeof file.url === "string" ? file.url : (file.url as any)?.base || "";
                            const a = document.createElement("a"); a.href = furl; a.download = file.name || "download"; document.body.appendChild(a); a.click(); document.body.removeChild(a);
                            setOpenDrop(null);
                          }} />
                          <DropItem icon={<RefreshCw size={12} />} label="Update" color="#f97316" onClick={() => { onUpdateFile(file, activeTab || "I_Do", activeSubcategory); setOpenDrop(null); }} />
                          <DropItem icon={<Trash2 size={12} />} label="Delete" color="#ef4444" divider onClick={() => { onDeleteFile(file.id, file.name); setOpenDrop(null); }} />
                        </DropMenu>
                      )}
                    </div>
                  </div>
                );
              })}
              {/* Add resource to group — opens the NotionResourceModal picker
                  so the user can add a Folder / File / Page / URL / Reference
                  inside this group. */}
              <div style={{ padding: "8px 18px 10px 50px", borderTop: `1px solid ${T.border}` }}>
                <button
                  type="button"
                  // Pass BOTH the groupId and groupName so the picker (and
                  // whichever upload/create modal it leads to next) can
                  // (a) attach the new resource to this exact group on the server
                  // (b) reflect the group as the current parent in its breadcrumb
                  onClick={e => { e.stopPropagation(); onResourceModalOpen(group.groupId, group.groupName); }}
                  style={{
                    fontSize: 11, fontWeight: 700, padding: "5px 12px", borderRadius: 7,
                    background: T.orangeLight, color: T.orange, border: `1px solid ${T.orange}30`,
                    cursor: "pointer", transition: "all 0.13s",
                  }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = T.orangeMid}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = T.orangeLight}
                >
                  + Add resource to this group
                </button>
              </div>
            </div>
          )}
        </div>
      );
    };

    return (
      <div className="flex flex-col h-full" style={{ background: T.bg }}>
        {someSelected && (
          <div className="flex-shrink-0 flex items-center justify-between px-4 py-2" style={{ background: "rgba(239,68,68,0.06)", borderBottom: `1px solid rgba(239,68,68,0.18)`, borderLeft: "2.5px solid #ef4444" }}>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold" style={{ color: "#ef4444" }}>{selected.size} item{selected.size > 1 ? "s" : ""} selected</span>
              <button type="button" onClick={() => setSelected(new Set())} className="text-[10px] font-semibold px-2 py-0.5 rounded" style={{ color: T.textHint, background: T.pageBg, border: `1px solid ${T.border}` }}>Clear</button>
            </div>
            <button
              type="button"
              onClick={() => setConfirmBulkDelete(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold text-white"
              style={{ background: "#ef4444", boxShadow: "0 3px 10px rgba(239,68,68,0.25)" }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "#dc2626"}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "#ef4444"}
            >
              <Trash2 size={12} />
              Delete {selected.size > 1 ? `${selected.size} items` : "1 item"}
            </button>
          </div>
        )}

        {editingGroup && (
          <GroupEditModal
            group={editingGroup}
            onClose={() => setEditingGroup(null)}
            onDeleteFile={onDeleteFile}
            onDeleteFolder={onDeleteFolder}
          />
        )}

        {groupDeleteConfirm && (
          <div className="fixed inset-0 z-[500] flex items-center justify-center" style={{ background: "rgba(0,0,0,0.35)", backdropFilter: "blur(3px)" }} onClick={() => setGroupDeleteConfirm(null)}>
            <div className="rounded-2xl p-6 w-[340px] shadow-2xl" style={{ background: T.bg, border: `1px solid ${T.border}` }} onClick={e => e.stopPropagation()}>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(239,68,68,0.10)", border: "1px solid rgba(239,68,68,0.20)" }}>
                  <Trash2 size={18} style={{ color: "#ef4444" }} />
                </div>
                <div>
                  <p className="text-[13px] font-bold" style={{ color: T.textMain }}>
                    Delete group "{groupDeleteConfirm.groupName}"?
                  </p>
                  <p className="text-[11px] font-medium mt-0.5" style={{ color: T.textMuted }}>
                    {groupDeleteConfirm.items.length} item{groupDeleteConfirm.items.length === 1 ? "" : "s"} will be removed. This cannot be undone.
                  </p>
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <button type="button" onClick={() => setGroupDeleteConfirm(null)}
                  className="flex-1 py-2 rounded-xl text-[12px] font-bold"
                  style={{ background: T.pageBg, color: T.textSub, border: `1px solid ${T.border}` }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = T.warm}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = T.pageBg}
                >Cancel</button>
                <button type="button" onClick={handleGroupDeleteConfirmed}
                  className="flex-1 py-2 rounded-xl text-[12px] font-bold text-white"
                  style={{ background: "#ef4444" }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "#dc2626"}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "#ef4444"}
                >Yes, Delete</button>
              </div>
            </div>
          </div>
        )}

        {bulkProgress.active && (
          <div
            className="fixed inset-0 z-[600] flex items-center justify-center"
            style={{ background: "rgba(15,23,42,0.35)", backdropFilter: "blur(3px)" }}
          >
            <div
              className="rounded-2xl shadow-2xl"
              style={{
                width: 360, maxWidth: "92vw",
                background: T.bg, border: `1px solid ${T.border}`,
                padding: "20px 22px",
              }}
            >
              <div className="flex items-center gap-3" style={{ marginBottom: 14 }}>
                <div style={{
                  width: 34, height: 34, borderRadius: 10, flexShrink: 0,
                  background: "rgba(239,68,68,0.10)", border: "1px solid rgba(239,68,68,0.20)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <Trash2 size={16} style={{ color: "#ef4444" }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: T.textMain }}>
                    {bulkProgress.label}
                  </div>
                  <div style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>
                    Please wait — do not close this window.
                  </div>
                </div>
              </div>

              <div style={{
                width: "100%", height: 8, borderRadius: 999,
                background: T.pageBg, overflow: "hidden",
                border: `1px solid ${T.border}`,
              }}>
                <div
                  style={{
                    width: `${bulkProgress.percent}%`,
                    height: "100%",
                    background: `linear-gradient(90deg, ${T.orange} 0%, ${T.orangeDark} 100%)`,
                    transition: "width 0.18s linear",
                  }}
                />
              </div>
              <div style={{ marginTop: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 10.5, fontWeight: 600, color: T.textHint, letterSpacing: "0.02em" }}>
                  {bulkProgress.percent < 100 ? "Deleting…" : "Finalizing…"}
                </span>
                <span style={{ fontSize: 12, fontWeight: 700, color: T.orange }}>
                  {bulkProgress.percent}%
                </span>
              </div>
            </div>
          </div>
        )}

        {confirmBulkDelete && (
          <div className="fixed inset-0 z-[500] flex items-center justify-center" style={{ background: "rgba(0,0,0,0.35)", backdropFilter: "blur(3px)" }} onClick={() => setConfirmBulkDelete(false)}>
            <div className="rounded-2xl p-6 w-[320px] shadow-2xl" style={{ background: T.bg, border: `1px solid ${T.border}` }} onClick={e => e.stopPropagation()}>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(239,68,68,0.10)", border: "1px solid rgba(239,68,68,0.20)" }}>
                  <Trash2 size={18} style={{ color: "#ef4444" }} />
                </div>
                <div>
                  <p className="text-[13px] font-bold" style={{ color: T.textMain }}>Delete {selected.size} item{selected.size > 1 ? "s" : ""}?</p>
                  <p className="text-[11px] font-medium mt-0.5" style={{ color: T.textMuted }}>This action cannot be undone.</p>
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <button type="button" onClick={() => setConfirmBulkDelete(false)}
                  className="flex-1 py-2 rounded-xl text-[12px] font-bold"
                  style={{ background: T.pageBg, color: T.textSub, border: `1px solid ${T.border}` }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = T.warm}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = T.pageBg}
                >Cancel</button>
                <button type="button" onClick={handleBulkDelete}
                  className="flex-1 py-2 rounded-xl text-[12px] font-bold text-white"
                  style={{ background: "#ef4444" }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "#dc2626"}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "#ef4444"}
                >Yes, Delete</button>
              </div>
            </div>
          </div>
        )}

    {/* Header */}
<div style={{
  display: "grid",
  gridTemplateColumns: "28px minmax(0,1fr) 90px 110px 90px 80px",
  gap: 14,
  padding: "12px 20px",
  background: "#fafbfc",
  borderBottom: `1px solid ${T.border}`,
  fontFamily: FONT_STACK,
  WebkitFontSmoothing: "antialiased",
  MozOsxFontSmoothing: "grayscale",
}}>
  {/* Checkbox placeholder */}
  <div className="flex items-center justify-center">
    <div
      onClick={toggleAll}
      className="w-[15px] h-[15px] rounded-[4px] flex items-center justify-center cursor-pointer flex-shrink-0"
      style={{
        background: allSelected ? T.orange : "transparent",
        border: `1.5px solid ${allSelected ? T.orange : someSelected ? T.orange : "#B3BAC5"}`,
        transition: "all 0.15s",
      }}
    >
      {allSelected && (
        <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
          <path d="M1 3.5L3.5 6L8 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
      {!allSelected && someSelected && (
        <div className="w-2 h-0.5 rounded" style={{ background: T.orange }} />
      )}
    </div>
  </div>

  {/* Column headers — now exactly 5 to fill the remaining 5 columns */}
  {[
    ["Name",          "text-left"],
    ["Type",          "text-left"],
    ["Date Modified", "text-left"],
    ["Size",          "text-left"],
    ["Actions",       "text-center"],
  ].map(([h, a]) => (
    <div key={h} className={a} style={{
      fontSize: 11, fontWeight: 600, letterSpacing: "0.04em",
      color: T.textHint,
    }}>
      {h}
    </div>
  ))}
</div>

        {/* COMBINED ORDERED LIST - folders, groups, standalone files, pages */}
        <div className="flex-1 min-h-0 overflow-y-auto" style={{ scrollbarWidth: "thin", scrollbarColor: `${T.border} transparent`, paddingBottom: "50px" }}>
          {(() => {
            const seenGroups = new Set<string>();
            // Groups are a Level-0 concept only. Once the user has navigated INTO any
            // folder (Level 1+), we render plain folder/file rows and never resurface
            // the group accordion — even if descendants carry an inherited parentGroupId.
            const isAtRootLevel = folderNavState.currentFolderId === null;
            return combinedOrder.map((item, index) => {
              if (item.type === 'folder') {
                const folder = item.data as FolderItem;
                const gid = (folder as any).parentGroupId as string | undefined;
                if (gid && isAtRootLevel) {
                  // If this gid belongs to a sub-group, skip — it renders inside its parent group
                  if (fileGroupMap[gid]?.parentGroupId) return null;
                  // Folder belongs to a top-level group — render the group accordion once
                  if (seenGroups.has(gid)) return null;
                  seenGroups.add(gid);
                  const groupFolders = folderGroupMap[gid] || [];
                  const groupFiles   = fileGroupMap[gid]?.files || [];
                  // Prefer any folder/file in this group that carries the user-typed name; fall back to a neutral label
                  const folderWithName = groupFolders.find(f => !!(f as any).groupName);
                  const folderWithDesc = groupFolders.find(f => !!(f as any).groupDescription);
                  const fgName = fileGroupMap[gid]?.groupName;
                  const groupName    = (folderWithName as any)?.groupName || (fgName && fgName !== "Untitled group" ? fgName : "") || "Untitled group";
                  const groupDesc    = (folderWithDesc as any)?.groupDescription || fileGroupMap[gid]?.description || "";
                  return <React.Fragment key={`group-${gid}-${index}`}>{renderGroupRow({ groupId: gid, groupName, description: groupDesc, files: groupFiles, folders: groupFolders })}</React.Fragment>;
                }
                return <React.Fragment key={`folder-${folder.id}-${index}`}>{renderFolderRow(folder)}</React.Fragment>;
              }
              const file = item.data as UploadedFile;
              const isPage = (file.type || "").toLowerCase() === "page";
              // Standalone render when the entry has no group context, or
              // we're inside a nested folder where group rows are suppressed.
              // (Group-bound pages now route into their group, same as files.)
              if (!file.groupId || !isAtRootLevel) {
                return <React.Fragment key={`file-${file.id}-${index}`}>{renderFileRow(file, isPage)}</React.Fragment>;
              }
              // Skip files whose group is a sub-group — they render inside their parent group
              if (fileGroupMap[file.groupId]?.parentGroupId) return null;
              if (seenGroups.has(file.groupId)) return null;
              seenGroups.add(file.groupId);
              const group = fileGroupMap[file.groupId];
              if (!group) return <React.Fragment key={`file-${file.id}-${index}`}>{renderFileRow(file, isPage)}</React.Fragment>;
              const groupFolders = folderGroupMap[file.groupId] || [];
              return <React.Fragment key={`group-${group.groupId}-${index}`}>{renderGroupRow({ ...group, folders: groupFolders })}</React.Fragment>;
            });
          })()}

          {empty && (
            <div className="flex flex-col items-center justify-center py-20 text-center" style={{ animation: "ccFadeIn 0.3s ease-out both" }}>
              <div className="relative w-14 h-14 rounded-2xl flex items-center justify-center mb-4" style={{ background: T.orangeLight, border: `1.5px dashed ${T.orange}40` }}>
                <FileText size={22} style={{ color: T.orange }} strokeWidth={1.5} />
                <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center" style={{ background: T.orange, color: "#fff" }}><Plus size={9} strokeWidth={3} /></div>
              </div>
              <p className="text-[14px] font-bold" style={{ color: T.textMain }}>No content yet</p>
              <p className="text-[11px] mt-1.5 font-medium max-w-[220px] leading-relaxed" style={{ color: T.textMuted }}>Upload files or create folders to organise your course materials</p>
            </div>
          )}
        </div>
      </div>
    );
  };

// ─── TabBar Component ──────────────────────────────────────────────────────────
const TabBar: React.FC<{
  selectedNode: CourseNode | null;
  activeTab: "I_Do" | "We_Do" | "You_Do" | null;
  activeSubcategory: string;
  subcategories: CourseContentProps["subcategories"];
  onTabChange: (tab: "I_Do" | "We_Do" | "You_Do") => void;
  onSubcategoryChange: (sub: string, component: string | null) => void;
  /** Right-aligned content sharing the tab row (the batch-scope picker). */
  rightSlot?: React.ReactNode;
}> = ({ selectedNode, activeTab, activeSubcategory, subcategories, onTabChange, onSubcategoryChange, rightSlot }) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const btnRefs = useRef<Partial<Record<string, HTMLButtonElement>>>({});

  const handleTabClick = (tabKey: "I_Do" | "We_Do" | "You_Do") => {
    if (!selectedNode) return;
    if (activeTab !== tabKey) {
      onTabChange(tabKey);
      const subs = subcategories[tabKey] || [];
      if (subs.length > 0) onSubcategoryChange(subs[0].key, subs[0].component);
    }
  };

  // Per-tab icon (lucide outline icons).
  const TabIcon: Record<"I_Do" | "We_Do" | "You_Do", React.ComponentType<any>> = {
    I_Do: UserRound,
    We_Do: Users,
    You_Do: ClipboardList,
  };

  return (
    <div
      className="flex-shrink-0"
      style={{
        background: T.bg,
        borderBottom: `1px solid ${T.border}`,
        position: "relative",
        zIndex: 30,
        padding: "0 16px",
      }}
    >
      <div
        ref={trackRef}
        className="flex items-stretch"
        style={{ position: "relative" }}
      >
        {(["I_Do", "We_Do", "You_Do"] as const).map((tabKey, idx) => {
          const cfg = TAB_META[tabKey];
          const isSel = activeTab === tabKey;
          const isDis = !selectedNode;
          const Icon = TabIcon[tabKey];
          const restColor = isDis ? "#B3BAC5" : "#1E293B";
          const textColor = isSel ? T.orange : restColor;

          return (
            <React.Fragment key={tabKey}>
              <button
                ref={el => { if (el) btnRefs.current[tabKey] = el; }}
                onClick={() => handleTabClick(tabKey)}
                disabled={isDis}
                className="flex items-center justify-center select-none"
                style={{
                  gap: 7,
                  padding: "12px 28px 11px",
                  fontSize: 12.5,
                  fontWeight: 600,
                  letterSpacing: "-0.005em",
                  fontFamily: "'Poppins', 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                  WebkitFontSmoothing: "antialiased",
                  border: "none",
                  background: "transparent",
                  color: textColor,
                  opacity: isDis ? 0.5 : 1,
                  cursor: isDis ? "not-allowed" : "pointer",
                  transition: "color 0.18s ease",
                  position: "relative",
                  whiteSpace: "nowrap",
                  outline: "none",
                }}
                onMouseEnter={e => {
                  if (isDis || isSel) return;
                  (e.currentTarget as HTMLElement).style.color = T.orange;
                  const iconEl = (e.currentTarget as HTMLElement).querySelector<HTMLElement>("[data-tab-icon]");
                  if (iconEl) iconEl.style.color = T.orange;
                }}
                onMouseLeave={e => {
                  if (isDis || isSel) return;
                  (e.currentTarget as HTMLElement).style.color = restColor;
                  const iconEl = (e.currentTarget as HTMLElement).querySelector<HTMLElement>("[data-tab-icon]");
                  if (iconEl) iconEl.style.color = restColor;
                }}
              >
                <span
                  data-tab-icon
                  style={{
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                    color: textColor, transition: "color 0.18s ease",
                  }}
                >
                  <Icon size={14} strokeWidth={2} />
                </span>
                <span style={{ lineHeight: 1 }}>{cfg.label}</span>

                {/* Active underline indicator */}
                {isSel && (
                  <span
                    aria-hidden
                    style={{
                      position: "absolute",
                      left: 22, right: 22, bottom: -1,
                      height: 3,
                      borderRadius: "3px 3px 0 0",
                      background: T.orange,
                      transition: "opacity 0.18s ease",
                    }}
                  />
                )}
              </button>

              {/* Vertical divider between tabs */}
              {idx < 2 && (
                <span
                  aria-hidden
                  style={{
                    alignSelf: "center",
                    width: 1,
                    height: 24,
                    background: T.border,
                    flexShrink: 0,
                  }}
                />
              )}
            </React.Fragment>
          );
        })}

        {rightSlot && (
          <div className="flex items-center" style={{ marginLeft: "auto" }}>
            {rightSlot}
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Main CourseContent Component ─────────────────────────────────────────────
export const CourseContent: React.FC<CourseContentProps> = ({
  selectedNode, activeTab, activeSubcategory, subcategories, contentData,
  breadcrumbs, fileTypes, currentFolderContents, folderNavState,
  courseId, courseStructureName, pedagogy, activeBatchId = "", tabBarRight,
  onTabChange, onSubcategoryChange, onResourceModalOpen, onFileClick,
  onNavigateToFolder, onNavigateUp, onNavigateToRoot, onNavigateToFolderLevel,
  onEditFolder, onDeleteFolder, onDeleteFile, configuredLanguages,
  onDeletePage = (pageId: string, name: string) => {
    console.warn("onDeletePage not implemented by parent. pageId:", pageId, "name:", name)
  },
  onUpdateFile, onEditGroup, getParentNodeName, getFolderItemCount, getFolderTotalSize, onPageCreated, onBulkDelete
}) => {
  const [activeFilters, setActiveFilters] = useState({ fileTypes: [] as string[], searchFilter: "" });
  const [sortBy, setSortBy] = useState<SortKey>("date_desc");
  const [viewingPage, setViewingPage] = useState<ViewingPage | null>(null);
  const [editingPage, setEditingPage] = useState<{
    id: string; title: string; blocks: PageBlock[]; code: string;
  } | null>(null);
  const [localPageOverrides, setLocalPageOverrides] = useState<Record<string, {
    combinedCode: string;
    title: string;
    blocks: any[];
    pageCount: number;
  }>>({});
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);

  const showToast = useCallback((message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  useEffect(() => {
    setLocalPageOverrides({});
  }, [activeTab, activeSubcategory, selectedNode?.id]);

  useEffect(() => { setViewingPage(null); }, [activeTab, activeSubcategory, selectedNode?.id]);

  const hierarchyInfo: HierarchyInfo | undefined = selectedNode
    ? {
      courseId,
      courseName: courseStructureName || "",
      moduleId: selectedNode.type === "module" ? selectedNode.id : undefined,
      moduleName: selectedNode.type === "module" ? selectedNode.name : getParentNodeName(selectedNode, "module") || undefined,
      subModuleId: selectedNode.type === "submodule" ? selectedNode.id : undefined,
      subModuleName: selectedNode.type === "submodule" ? selectedNode.name : getParentNodeName(selectedNode, "submodule") || undefined,
      topicId: selectedNode.type === "topic" ? selectedNode.id : undefined,
      topicName: selectedNode.type === "topic" ? selectedNode.name : getParentNodeName(selectedNode, "topic") || undefined,
      subTopicId: selectedNode.type === "subtopic" ? selectedNode.id : undefined,
      subTopicName: selectedNode.type === "subtopic" ? selectedNode.name : getParentNodeName(selectedNode, "subtopic") || undefined,
      tabType: activeTab || undefined,
      subcategory: activeSubcategory || undefined,
      folderPath: folderNavState.currentFolderPath ?? [],
      nodeType: selectedNode.type as HierarchyInfo["nodeType"],
    }
    : undefined;

  const isValidSub = subcategories[activeTab as "I_Do" | "We_Do" | "You_Do"]?.some(s => s.key === activeSubcategory);

  // ── Breadcrumb group name ─────────────────────────────────────────────────
  // When the user has navigated INTO a folder that belongs to a group, surface
  // that group's name so the breadcrumb reads "Root › <Group> › <folder>…".
  // Display-only — resolved from the same fields the root group row uses
  // (folders carry `parentGroupId`, files carry `groupId`; the human name lives
  // on `groupName`). Returns "" for ungrouped folders or at root.
  const currentGroup = useMemo<{ id: string; name: string } | null>(() => {
    const fid = folderNavState.currentFolderId;
    if (!selectedNode || !activeTab || !fid) return null;
    const subcatData = (contentData[selectedNode.id]?.[activeTab]?.[activeSubcategory] || []) as (FolderItem | UploadedFile)[];
    const rootFolders = subcatData.filter((i): i is FolderItem => isFolderItem(i) && !i.parentId);
    const containsId = (folder: FolderItem, id: string): boolean =>
      folder.id === id || (folder.subfolders || []).some(sf => containsId(sf, id));
    const rootAncestor = rootFolders.find(rf => containsId(rf, fid));
    const gid = rootAncestor?.parentGroupId;
    if (!gid) return null;
    // Prefer any sibling folder in the group that carries the user-typed name,
    // else any group file, else the ancestor's own groupName.
    const namedFolder = rootFolders.find(f => f.parentGroupId === gid && !!f.groupName);
    const namedFile = subcatData.find(
      (i): i is UploadedFile =>
        !isFolderItem(i) && ((i.groupId === gid) || (i.parentGroupId === gid)) && !!i.groupName,
    );
    const name = namedFolder?.groupName || namedFile?.groupName || rootAncestor?.groupName || "Untitled group";
    return { id: gid, name };
  }, [selectedNode, activeTab, activeSubcategory, contentData, folderNavState.currentFolderId]);

  // Group whose accordion should auto-open after the breadcrumb routes back to
  // root (set when the user clicks the group crumb). FileList consumes + clears it.
  const [autoExpandGroupId, setAutoExpandGroupId] = useState<string | null>(null);

  const handleGroupCrumbClick = useCallback(() => {
    if (!currentGroup) return;
    const gid = currentGroup.id;
    onNavigateToRoot?.();       // route to where the group accordion lives
    setAutoExpandGroupId(gid);  // …and open that group's dropdown
  }, [currentGroup, onNavigateToRoot]);

  // Group-aware wrapper for the generic "Add Resource" buttons (toolbar + empty
  // state). A group row's own "+ Add" passes the group explicitly; the generic
  // buttons don't — so when the user has navigated INTO a group's folder we
  // carry `currentGroup` through. This keeps the group in the picker breadcrumb
  // ("…› Group › Folder") regardless of which add button was used.
  const handleResourceModalOpen = useCallback(
    (groupId?: string, groupName?: string) => {
      if (groupId) { onResourceModalOpen(groupId, groupName); return; }
      if (currentGroup) { onResourceModalOpen(currentGroup.id, currentGroup.name); return; }
      onResourceModalOpen();
    },
    [onResourceModalOpen, currentGroup],
  );

  const allFiles = useMemo(() => {
    // Pages come exclusively from pedagogy below — exclude any stale page entries
    // that currentFolderContents.files might already carry to prevent duplicates.
    const combined = currentFolderContents.files.filter(
      f => (f.type || "").toLowerCase() !== "page"
    );

    // Normalise the current folder path to a comparable string.
    // Root level   → ""
    // FolderA      → "FolderA"
    // Nested       → "FolderA/FolderB"
    const currentPathStr = (folderNavState.currentFolderPath ?? []).join("/");

    if (activeTab && activeSubcategory && pedagogy) {
      const sec = pedagogy[activeTab];
      if (sec) {
        const raw = Object.keys(sec).find(k => normKey(k) === activeSubcategory);
        const element = raw ? sec[raw] : null;

        if (element) {
          // ── Collect every page in this subcategory along with the folder
          //    path it actually lives at on the backend. Pages can be in
          //    two places:
          //      1) element.pages[]                  → root pages (path = [])
          //      2) element.folders[*].pages[]       → folder pages
          //         element.folders[*].subfolders[*].pages[]   → nested
          //    The backend stores folder-bound pages *inside* the folder's
          //    nested pages[] array (see server `createPage`), so we have
          //    to walk the folder tree to find them — top-level pages[]
          //    alone is not enough.
          // ─────────────────────────────────────────────────────────────
          type PageEntry = { page: any; pathArr: string[] };
          const collected: PageEntry[] = [];

          // 1) root pages
          (Array.isArray(element.pages) ? element.pages : []).forEach((p: any) => {
            if (p) collected.push({ page: p, pathArr: [] });
          });

          // 2) folder-nested pages — recurse through folders/subfolders
          const walk = (folders: any[], parentPath: string[]) => {
            if (!Array.isArray(folders)) return;
            folders.forEach((folder: any) => {
              const folderName = folder?.name;
              if (!folderName) return;
              const here = [...parentPath, folderName];

              if (Array.isArray(folder?.pages)) {
                folder.pages.forEach((p: any) => {
                  if (p) collected.push({ page: p, pathArr: here });
                });
              }
              if (Array.isArray(folder?.subfolders)) {
                walk(folder.subfolders, here);
              }
            });
          };
          walk(element.folders, []);

          // ── Now filter to the current folder level + de-duplicate by _id.
          //    A page is shown only when its stored folder path matches the
          //    folder the user is currently standing in. Group-bound pages
          //    (those with a groupId on the page record itself) are then
          //    routed into their group row downstream — we just propagate
          //    the field along.
          const pagesMap = new Map<string, any>();
          collected.forEach(({ page, pathArr }) => {
            const pid = normalizeId(page?._id);
            if (!pid || pagesMap.has(pid)) return;

            // Trust where the backend placed the page (pathArr from the walk
            // above). If the page record also carries a stored folderPath, we
            // log a mismatch only to aid debugging — pathArr always wins for
            // display purposes.
            const pagePathStr = pathArr.join("/");
            if (pagePathStr === currentPathStr) {
              pagesMap.set(pid, { ...page, __id: pid, __pathArr: pathArr });
            }
          });

          Array.from(pagesMap.values()).forEach((p: any) => {
            const pid: string = p.__id;
            const override = localPageOverrides[pid];
            combined.push({
              id: pid,
              name: override?.title ?? p.title ?? "Untitled Page",
              type: "page",
              url: "",
              size: 0,
              uploadedAt: p.createdAt || new Date().toISOString(),
              tags: [],
              subcategory: activeSubcategory,
              folderId: folderNavState.currentFolderId ?? null,
              // Group context — read straight off the page record now that
              // the backend stores it (see `createPage` controller + page
              // sub-schemas). The grouping logic in FileListArea uses this
              // to place the page inside its group row.
              groupId: p.groupId ?? undefined,
              groupName: p.groupName ?? undefined,
              _combinedCode: override?.combinedCode ?? p.combinedCode ?? "",
              _pageCount: override?.pageCount ?? p.pageCount ?? 1,
            } as any);
          });
        }
      }
    }

    return combined;
  }, [currentFolderContents.files, pedagogy, activeTab, activeSubcategory, localPageOverrides, folderNavState]);

  // FIXED: Combined order that sorts everything by date
  const filteredContent = useMemo(() => {
    let folders = currentFolderContents.folders;
    let files = allFiles;
    const q = activeFilters.searchFilter.toLowerCase();
    
    if (q) { 
      folders = folders.filter(f => f.name.toLowerCase().includes(q)); 
      files = files.filter(f => (f.name || "").toLowerCase().includes(q)); 
    }
    
    if (activeFilters.fileTypes.length > 0) {
      const match = (f: UploadedFile) => {
        const lt = (f.type || "").toLowerCase(), ln = (f.name || "").toLowerCase();
        return activeFilters.fileTypes.some(t => {
          switch (t) {
            case "page": return lt === "page";
            case "folder": return false;
            case "url": return lt.includes("url") || lt.includes("link");
            case "reference": return f.isReference === true || String(f.isReference) === "true";
            case "pdf": return lt.includes("pdf") || ln.endsWith(".pdf");
            case "ppt": return lt.includes("ppt") || !!ln.match(/\.pptx?$/i);
            case "word": return lt.includes("wordprocessingml") || lt.includes("msword") || lt.includes("opendocument.text") || !!ln.match(/\.(docx?|odt|rtf|ocx)$/i);
            case "image": return lt.includes("image") || !!ln.match(/\.(png|jpe?g|gif|webp|svg|bmp|avif)$/i);
            case "video": return lt.includes("video") || !!ln.match(/\.(mp4|avi|mov|mkv|webm)$/i);
            case "zip": return lt.includes("zip") || !!ln.match(/\.(zip|rar|7z|tar|gz)$/i);
            default: return lt.includes(t);
          }
        });
      };
      if (!activeFilters.fileTypes.includes("folder")) folders = [];
      files = files.filter(match);
    }
    
    const toDateMs = (value: any): number => {
      if (!value) return 0;
      const raw = typeof value === "object" && value.$date ? value.$date : value;
      const ms = new Date(raw).getTime();
      return Number.isNaN(ms) ? 0 : ms;
    };
    const pickSortDate = (item: any) => item?.updatedAt || item?.createdAt || item?.uploadedAt || "";

    // Create combined items array with real sort dates only
    const combined: CombinedItem[] = [];
    
    folders.forEach(folder => {
      const sortDate = pickSortDate(folder);
      combined.push({ type: 'folder', data: folder, sortDate: sortDate || "" });
    });
    
    files.forEach(file => {
      const sortDate = pickSortDate(file);
      combined.push({ type: 'file', data: file, sortDate: sortDate || "" });
    });
    
    // Sort by user-selected key
    const getName = (item: CombinedItem) =>
      item.type === 'folder' ? (item.data as FolderItem).name : (item.data as UploadedFile).name || "";
    const getSize = (item: CombinedItem) =>
      item.type === 'folder' ? getFolderTotalSize((item.data as FolderItem).id) : (item.data as UploadedFile).size || 0;
    const getType = (item: CombinedItem) => {
      if (item.type === 'folder') return "FOLDER";
      const f = item.data as UploadedFile;
      return getFileMeta(f.type || "", f.name, f.isReference === true || String(f.isReference) === "true").label;
    };

    combined.sort((a, b) => {
      switch (sortBy) {
        case "date_desc": return toDateMs(b.sortDate) - toDateMs(a.sortDate);
        case "date_asc":  return toDateMs(a.sortDate) - toDateMs(b.sortDate);
        case "name_asc":  return getName(a).localeCompare(getName(b), undefined, { sensitivity: "base" });
        case "name_desc": return getName(b).localeCompare(getName(a), undefined, { sensitivity: "base" });
        case "size_desc": return getSize(b) - getSize(a);
        case "size_asc":  return getSize(a) - getSize(b);
        case "type_asc":  return getType(a).localeCompare(getType(b), undefined, { sensitivity: "base" });
        default:          return toDateMs(b.sortDate) - toDateMs(a.sortDate);
      }
    });

    return {
      folders,
      files,
      combinedOrder: combined,
    };
  }, [currentFolderContents.folders, allFiles, activeFilters.fileTypes, activeFilters.searchFilter, sortBy, getFolderTotalSize]);

  const { folders: ff, files: ft, combinedOrder } = filteredContent;
  const hasContent = combinedOrder.length > 0;

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ fontFamily: "'Poppins',-apple-system,sans-serif" }}>

      {/* ── Breadcrumbs ── */}
      <div className="flex-shrink-0 px-5" style={{ background: T.bg }}>
        <div className="flex items-center gap-0.5 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
          {breadcrumbs.map((crumb, i) => {
            const isLast = i === breadcrumbs.length - 1;
            return (
              <div key={`${crumb.id}-${i}`} className="flex items-center gap-0.5 flex-shrink-0">
                {i > 0 && <ChevronRight size={9} style={{ color: T.textHint, margin: "0 1px" }} />}
                {crumb.path
                  ? <a href={crumb.path} className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] font-semibold"
                    style={{ color: T.textSub, transition: "all 0.15s" }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = T.orange; (e.currentTarget as HTMLElement).style.background = T.orangeLight; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = T.textSub; (e.currentTarget as HTMLElement).style.background = "transparent"; }}>
                    {i === 0 && <Home size={11} />}
                    <span className="max-w-[130px] truncate">{crumb.label}</span>
                  </a>
                  : <span className="px-2.5 py-1 rounded-lg text-[11px] font-semibold max-w-[150px] truncate"
                    style={{ color: isLast ? T.orange : T.textSub, background: isLast ? T.orangeLight : "transparent", border: isLast ? `1px solid ${T.orange}20` : "1px solid transparent" }}>
                    {crumb.label}
                  </span>
                }
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Tab bar ── */}
      <TabBar
        selectedNode={selectedNode} activeTab={activeTab}
        activeSubcategory={activeSubcategory} subcategories={subcategories}
        onTabChange={tab => { setViewingPage(null); onTabChange(tab); }}
        onSubcategoryChange={(s, c) => { setViewingPage(null); onSubcategoryChange(s, c); }}
        rightSlot={tabBarRight}
      />

      {/* ── Subcategory underline tab bar ── */}
      {activeTab && selectedNode && (() => {
        const subs = subcategories[activeTab] ?? [];
        if (!subs.length) return null;
        const tabData = contentData[selectedNode.id]?.[activeTab] ?? {};
        return (
          <div
            className="flex-shrink-0 flex items-stretch overflow-x-auto"
            style={{ background: T.bg, scrollbarWidth: "none", padding: "0 16px" }}
          >
            {subs.map(sub => {
              const isActive = activeSubcategory === sub.key;
              const count = (tabData[sub.key] ?? []).length;
              const ACTIVE_TEXT = "#1E293B";
              const INACTIVE_TEXT = "#475569";
              const labelColor = isActive ? ACTIVE_TEXT : INACTIVE_TEXT;
              const iconColor = isActive ? T.orange : INACTIVE_TEXT;
              return (
                <button
                  key={sub.key}
                  onClick={() => { setViewingPage(null); onSubcategoryChange(sub.key, sub.component); }}
                  className="flex-shrink-0 flex items-center select-none"
                  style={{
                    gap: 7,
                    padding: "10px 16px 9px",
                    fontSize: 12.5,
                    fontWeight: 600,
                    letterSpacing: "-0.005em",
                    fontFamily: "'Poppins', 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                    WebkitFontSmoothing: "antialiased",
                    background: "transparent",
                    border: "none",
                    color: labelColor,
                    cursor: "pointer",
                    position: "relative",
                    transition: "color 0.18s ease",
                    outline: "none",
                  }}
                  onMouseEnter={e => {
                    if (isActive) return;
                    (e.currentTarget as HTMLElement).style.color = T.orange;
                    const iconEl = (e.currentTarget as HTMLElement).querySelector<HTMLElement>("[data-sub-icon]");
                    if (iconEl) iconEl.style.color = T.orange;
                  }}
                  onMouseLeave={e => {
                    if (isActive) return;
                    (e.currentTarget as HTMLElement).style.color = INACTIVE_TEXT;
                    const iconEl = (e.currentTarget as HTMLElement).querySelector<HTMLElement>("[data-sub-icon]");
                    if (iconEl) iconEl.style.color = INACTIVE_TEXT;
                  }}
                >
                  {sub.icon && (
                    <span
                      data-sub-icon
                      style={{
                        display: "inline-flex", alignItems: "center", justifyContent: "center",
                        color: iconColor, transition: "color 0.18s ease",
                      }}
                    >
                      {React.cloneElement(sub.icon as React.ReactElement, { size: 14, strokeWidth: 2 })}
                    </span>
                  )}
                  <span style={{ lineHeight: 1 }}>{sub.label}</span>

                  {count > 0 && (
                    <span
                      style={{
                        display: "inline-flex", alignItems: "center", justifyContent: "center",
                        minWidth: 18, height: 18, padding: "0 6px",
                        borderRadius: 999,
                        background: isActive ? "rgba(232,100,12,0.14)" : "#F1F5F9",
                        color: isActive ? T.orange : INACTIVE_TEXT,
                        fontSize: 10.5,
                        fontWeight: 700,
                        letterSpacing: 0,
                        marginLeft: 2,
                      }}
                    >
                      {count}
                    </span>
                  )}

                  {/* Bottom indicator — orange for active, soft gray for inactive */}
                  <span
                    aria-hidden
                    style={{
                      position: "absolute",
                      left: 14, right: 14, bottom: 0,
                      height: 3,
                      borderRadius: "3px 3px 0 0",
                      background: isActive
                        ? `linear-gradient(90deg, ${T.orange} 0%, ${T.orange} 70%, rgba(232,100,12,0.35) 100%)`
                        : "transparent",
                      transition: "background 0.18s ease",
                    }}
                  />
                </button>
              );
            })}
          </div>
        );
      })()}

      {/* ── Body ── */}
      <div className="flex-1 min-h-0 overflow-hidden" style={{ background: T.pageBg }}>
        <div className="h-full flex flex-col overflow-hidden" style={{ background: T.bg }}>

          {!selectedNode ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-10" style={{ animation: "ccFadeIn 0.4s ease-out both" }}>
              <div className="grid grid-cols-3 gap-3 max-w-md w-full">
                {([
                  { icon: <Target size={20} />, color: TAB_META.I_Do.color, bg: TAB_META.I_Do.bg, title: "I Do", desc: "Teacher-led instruction" },
                  { icon: <Users size={20} />, color: TAB_META.We_Do.color, bg: TAB_META.We_Do.bg, title: "We Do", desc: "Guided practice" },
                  { icon: <BookOpen size={20} />, color: TAB_META.You_Do.color, bg: TAB_META.You_Do.bg, title: "You Do", desc: "Independent work" },
                ] as any[]).map(item => (
                  <div key={item.title} className="p-4 rounded-2xl text-center"
                    style={{ background: item.bg, border: `1.5px solid ${item.color}18`, transition: "all 0.22s" }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; (e.currentTarget as HTMLElement).style.boxShadow = `0 8px 20px ${item.color}18`; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = "none"; (e.currentTarget as HTMLElement).style.boxShadow = "none"; }}>
                    <div className="w-10 h-10 mx-auto mb-3 rounded-xl flex items-center justify-center" style={{ background: `${item.color}14`, color: item.color }}>{item.icon}</div>
                    <h4 className="text-[12px] font-bold tracking-tight" style={{ color: T.textMain }}>{item.title}</h4>
                    <p className="text-[10.5px] mt-1 font-medium leading-relaxed" style={{ color: T.textMuted }}>{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>

          ) : !activeTab ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-10" style={{ animation: "ccFadeIn 0.3s ease-out both" }}>
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4" style={{ background: T.orangeLight, border: `1.5px solid ${T.orange}20` }}>
                <Target size={22} style={{ color: T.orange }} strokeWidth={1.5} />
              </div>
              <h3 className="text-[16px] font-bold mb-1.5 tracking-tight" style={{ color: T.textMain }}>Select a Pedagogy Type</h3>
              <p className="text-[12px] font-medium max-w-xs leading-relaxed" style={{ color: T.textMuted }}>Hover over I Do, We Do, or You Do to choose an activity.</p>
            </div>

          ) : activeTab && !activeSubcategory ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-10" style={{ animation: "ccFadeIn 0.3s ease-out both" }}>
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
                style={{ background: TAB_META[activeTab].bg, border: `1.5px solid ${TAB_META[activeTab].color}20` }}>
                <span style={{ color: TAB_META[activeTab].color }}>{TAB_META[activeTab].icon}</span>
              </div>
              <h3 className="text-[16px] font-bold mb-1.5 tracking-tight" style={{ color: T.textMain }}>Select an Activity</h3>
              <p className="text-[12px] font-medium max-w-xs leading-relaxed" style={{ color: T.textMuted }}>
                Hover over <span style={{ color: TAB_META[activeTab].color, fontWeight: 800 }}>{activeTab.replace("_", " ")}</span> to pick a subcategory.
              </p>
            </div>

          ) : activeTab === "We_Do" && activeSubcategory && isValidSub ? (
            <ProblemSolving
              // Batch in the key: We Do assignments are per-batch, and this view
              // keeps its own exercise list in local state.
              key={`${activeTab}-${activeSubcategory}-${activeBatchId || "shared"}`}
              nodeId={selectedNode!.id}
              nodeName={selectedNode!.name}
              subcategory={activeSubcategory}
              subcategoryLabel={subcategories[activeTab].find(s => s.key === activeSubcategory)?.label || activeSubcategory}
              contentData={contentData[selectedNode!.id]?.[activeTab]?.[activeSubcategory] || []}
              folderNavigationState={folderNavState}
              hierarchyData={{
                courseName: courseStructureName || "",
                moduleName: selectedNode!.type === "module" ? selectedNode!.name : getParentNodeName(selectedNode!, "module"),
                submoduleName: selectedNode!.type === "submodule" ? selectedNode!.name : getParentNodeName(selectedNode!, "submodule"),
                topicName: selectedNode!.type === "topic" ? selectedNode!.name : getParentNodeName(selectedNode!, "topic"),
                subtopicName: selectedNode!.type === "subtopic" ? selectedNode!.name : getParentNodeName(selectedNode!, "subtopic"),
                nodeType: selectedNode!.type,
                level: selectedNode!.level,
              }}
              nodeType={selectedNode!.type}
              activeTab={activeTab}
              courseId={courseId}
              configuredLanguages={configuredLanguages}
            />

          ) : activeTab === "You_Do" && activeSubcategory && isValidSub ? (
            (() => {
               const youDoBaseProps = {
  nodeId: selectedNode!.id,
  nodeName: selectedNode!.name,
  subcategory: activeSubcategory,
  subcategoryLabel: subcategories["You_Do"].find(s => s.key === activeSubcategory)?.label || activeSubcategory,
  courseId,
  nodeType: selectedNode!.type,
  configuredLanguages,
  // Resources by Batch — see the `key`s below.
  batchId: activeBatchId,
  hierarchyData: {
    courseName: courseStructureName || "",
    moduleName: selectedNode!.type === "module" ? selectedNode!.name : getParentNodeName(selectedNode!, "module"),
    submoduleName: selectedNode!.type === "submodule" ? selectedNode!.name : getParentNodeName(selectedNode!, "submodule"),
    topicName: selectedNode!.type === "topic" ? selectedNode!.name : getParentNodeName(selectedNode!, "topic"),
    subtopicName: selectedNode!.type === "subtopic" ? selectedNode!.name : getParentNodeName(selectedNode!, "subtopic"),
    nodeType: selectedNode!.type,
    level: selectedNode!.level,
  },
};
// The batch belongs in the key. These views hold their own pagination, search
// and selection state, and batch 1's row selection means nothing in batch 2 —
// remounting on a batch switch is both cheaper to reason about and what makes
// the list's query key change in the same commit as the strip.
if (activeSubcategory === "test_your_skills") return <TestYourSkills key={`you_do-${activeSubcategory}-${activeBatchId || "shared"}`} {...youDoBaseProps} />;
if (activeSubcategory === "assesment") return <Assessment key={`you_do-${activeSubcategory}-${activeBatchId || "shared"}`} {...youDoBaseProps} />;
// You Do > Self Work now reuses the SAME ProblemSolving UI as We Do > Assignments.
// Data isolation is automatic — the backend filters by (section=You_Do, subcategory=self_work)
// so nothing leaks to/from We Do > Assignments. Students will see these on the
// detailed view via the existing pedagogy-method + activity flow (no extra wiring).
if (activeSubcategory === "self_work") return (
  <ProblemSolving
    key={`${activeTab}-${activeSubcategory}-${activeBatchId || "shared"}`}
    {...youDoBaseProps}
    activeTab={activeTab}
  />
);              return null;
            })()

          ) : viewingPage ? (
            <InlinePageViewer
              page={viewingPage}
              onBack={() => setViewingPage(null)}
              onNewTab={() => openPageInNewTab(viewingPage.code)}
            />

          ) : hasContent ? (
            <div className="flex flex-col h-full overflow-hidden">
              <div className="flex-shrink-0 px-4 py-2.5"
                style={{ borderBottom: `1px solid ${T.border}`, background: T.bg }}>
                <FilterSection fileTypes={fileTypes} allFiles={allFiles} currentFolders={currentFolderContents.folders}
                  activeFilters={activeFilters} onFilterChange={setActiveFilters} onResourceModalOpen={handleResourceModalOpen}
                  sortBy={sortBy} onSortChange={setSortBy} />
              </div>
              {(folderNavState.currentFolderId !== null || folderNavState.currentFolderPath.length > 0) && (
                <FolderBreadcrumbBar
                  folderNavState={folderNavState}
                  groupName={currentGroup?.name || ""}
                  onGroupClick={handleGroupCrumbClick}
                  onNavigateUp={onNavigateUp}
                  onNavigateToRoot={onNavigateToRoot}
                  onNavigateToFolderLevel={onNavigateToFolderLevel}
                />
              )}
              <div className="flex-1 min-h-0 overflow-hidden">
                <FileList
                  folders={ff} 
                  files={ft} 
                  combinedOrder={combinedOrder}
                  activeTab={activeTab} 
                  activeSubcategory={activeSubcategory}
                  getFolderItemCount={getFolderItemCount}
                  getFolderTotalSize={getFolderTotalSize}
                  onFolderClick={onNavigateToFolder}
                  onFileClick={onFileClick} 
                  onEditFolder={onEditFolder} 
                  onDeleteFolder={onDeleteFolder}
                  onDeleteFile={onDeleteFile}
                  onUpdateFile={onUpdateFile}
                  onEditGroup={onEditGroup}
                  onNavigateUp={onNavigateUp}
                  folderNavState={folderNavState}
                  onPageClick={setViewingPage}
                  onEditPage={(data) => {
                    setViewingPage(null);
                    setEditingPage(data);
                  }}
                  onDeletePage={async (pageId, name) => {
                    try {
                      await onDeletePage(pageId, name);
                      await onPageCreated?.();
                      showToast(`"${name}" deleted`);
                    } catch {
                      showToast("Failed to delete page.", "error");
                    }
                  }}
                  onBulkDelete={onBulkDelete}
                  onResourceModalOpen={handleResourceModalOpen}
                  onShowToast={showToast}
                  autoExpandGroupId={autoExpandGroupId}
                  onAutoExpandHandled={() => setAutoExpandGroupId(null)}
                />
              </div>
            </div>

          ) : (
            // Empty state — but if the user is inside a folder, keep the breadcrumb
            // so they can still navigate back. Without it, an empty folder is a dead-end.
            <div className="flex flex-col h-full overflow-hidden">
              {(folderNavState.currentFolderId !== null || folderNavState.currentFolderPath.length > 0) && (
                <div style={{ paddingTop: 10, background: T.bg }}>
                  <FolderBreadcrumbBar
                    folderNavState={folderNavState}
                    groupName={currentGroup?.name || ""}
                    onGroupClick={handleGroupCrumbClick}
                    onNavigateUp={onNavigateUp}
                    onNavigateToRoot={onNavigateToRoot}
                    onNavigateToFolderLevel={onNavigateToFolderLevel}
                  />
                </div>
              )}
              <div className="flex-1 min-h-0 flex flex-col items-center justify-center py-16 text-center" style={{ animation: "ccFadeIn 0.3s ease-out both" }}>
                <div className="relative w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
                  style={{ background: T.orangeLight, border: `1.5px dashed ${T.orange}40` }}>
                  <FileText size={22} style={{ color: T.orange }} strokeWidth={1.5} />
                </div>
                <h3 className="text-[16px] font-bold mb-1.5 tracking-tight" style={{ color: T.textMain }}>It's quiet here</h3>
                <p className="text-[12px] font-medium mb-5 max-w-[240px] leading-relaxed" style={{ color: T.textMuted }}>Start by adding resources to organise your course content.</p>
                {activeTab === "I_Do" && (
                  <button onClick={() => handleResourceModalOpen()}
                    className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-[11px] font-bold text-white"
                    style={{ background: T.orange, boxShadow: `0 4px 12px ${T.orangeGlow}`, transition: "all 0.18s" }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = T.orangeDark; (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = T.orange; (e.currentTarget as HTMLElement).style.transform = "none"; }}>
                    <Plus size={13} strokeWidth={2.5} />Add Resource
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {editingPage && (
        <PageCreationModal
          onBack={() => setEditingPage(null)}
          isEditing={true}
          onConfirm={async (payload) => {
            if (!selectedNode || !activeTab) return;
            try {
              await entityApi.updatePage(
                (selectedNode.type ?? hierarchyInfo?.nodeType) as
                  "module" | "submodule" | "topic" | "subtopic",
                selectedNode.id,
                editingPage.id,
                {
                  title: payload.pages[0]?.name ?? editingPage.title,
                  blocks: payload.pages[0]?.blocks,
                  htmlContent: payload.combinedHtml,
                  pages: payload.pages,
                  tabType: activeTab,
                  subcategory: activeSubcategory,
                  folderPath: folderNavState.currentFolderPath ?? [],
                }
              );

              setLocalPageOverrides(prev => ({
                ...prev,
                [editingPage.id]: {
                  combinedCode: payload.combinedHtml,
                  title: payload.pages[0]?.name ?? editingPage.title,
                  blocks: payload.pages[0]?.blocks ?? [],
                  pageCount: payload.pages.length ?? 1,
                },
              }));

              setEditingPage(null);
              setViewingPage(null);
              onPageCreated?.();
              showToast("Page updated successfully");

            } catch (e) {
              console.error("Failed to update page:", e);
              showToast("Failed to save edits.", "error");
            }
          }}
          initialTitle={editingPage.title}
          initialBlocks={editingPage.blocks}
          hierarchyInfo={hierarchyInfo}
        />
      )}

      {toast && (
        <div
          style={{
            position: "fixed",
            top: 24,
            right: 24,
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "12px 20px",
            borderRadius: 12,
            fontFamily: "'Poppins', -apple-system, sans-serif",
            fontSize: 13,
            fontWeight: 600,
            color: "#fff",
            background: toast.type === "success"
              ? "linear-gradient(135deg, #10b981 0%, #059669 100%)"
              : "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
            boxShadow: toast.type === "success"
              ? "0 8px 24px rgba(16,185,129,0.35)"
              : "0 8px 24px rgba(239,68,68,0.35)",
            animation: "toastSlideIn 0.25s cubic-bezier(0.16,1,0.3,1) both",
            minWidth: 220,
            maxWidth: 360,
          }}
        >
          <div
            style={{
              flexShrink: 0,
              width: 22,
              height: 22,
              borderRadius: "50%",
              background: "rgba(255,255,255,0.25)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 12,
            }}
          >
            {toast.type === "success" ? "✓" : "✕"}
          </div>
          <span style={{ flex: 1 }}>{toast.message}</span>
          <button
            onClick={() => setToast(null)}
            style={{
              flexShrink: 0,
              background: "rgba(255,255,255,0.20)",
              border: "none",
              borderRadius: 6,
              color: "#fff",
              cursor: "pointer",
              padding: "2px 7px",
              fontSize: 12,
              fontWeight: 700,
              lineHeight: 1.6,
            }}
          >
            ✕
          </button>
          <div
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              height: 3,
              borderRadius: "0 0 12px 12px",
              background: "rgba(255,255,255,0.45)",
              animation: "toastProgress 3s linear forwards",
            }}
          />
        </div>
      )}

      <style jsx global>{`
        @keyframes ccFadeIn  { from { opacity:0; transform:translateY(8px)  } to { opacity:1; transform:translateY(0)  } }
        @keyframes ccDropIn  { from { opacity:0; transform:scale(.95) translateY(-4px) } to { opacity:1; transform:scale(1) translateY(0) } }
        @keyframes ccBadgeUp { from { opacity:0; transform:translateY(3px)  } to { opacity:1; transform:translateY(0)  } }
        @keyframes ivBounce  { from { transform:translateY(0); opacity:0.4  } to { transform:translateY(-5px); opacity:1 } }
        @keyframes toastSlideIn {
          from { opacity: 0; transform: translateY(16px) scale(0.95); }
          to   { opacity: 1; transform: translateY(0)    scale(1);    }
        }
        @keyframes toastProgress {
          from { width: 100%; }
          to   { width: 0%;   }
        }
      `}</style>
    </div>
  );
};