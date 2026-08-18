"use client";

import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import {
  X, FolderPlus, File as FileIcon, Upload,
  ChevronRight, CheckCircle2, AlertCircle, Home,
  Pencil, Trash2, Eye, Download, ChevronDown,
  FolderOpen, Plus,
} from "lucide-react";
import type { HierarchyInfo } from "./Pagecreationmodal";
import TipTapEditor from "@/app/lms/component/tiptopEditor";
import {
  buildAllowedRules, getFileExt, partitionFiles, fmtLimit,
  LEGACY_ALLOWED_TYPES, type MaxSizeByType,
} from "./resourceFileFormats";

/* ─── Design tokens — exact match with CourseSidebar ─────────────────────── */
const T = {
  bg: "#ffffff",
  surface: "#ffffff",
  surfaceEl: "#f8fafc",
  surfaceHov: "#f4f5f7",
  surfaceAct: "rgba(232,100,12,0.07)",
  border: "#eef0f4",
  borderSub: "#e5e7eb",
  borderAcc: "rgba(232,100,12,0.22)",
  acc: "#E8640C",
  accDark: "#C8520A",
  accLight: "rgba(232,100,12,0.09)",
  accGlow: "rgba(232,100,12,0.18)",
  accGrad: "linear-gradient(135deg,#F08243 0%,#E8640C 100%)",
  text: "#0F172A",
  textSub: "#334155",
  textFaint: "#64748B",
  textGhost: "#94A3B8",
  green: "#059669",
  greenLight: "rgba(5,150,105,0.09)",
  red: "#DC2626",
  redLight: "rgba(220,38,38,0.09)",
  blue: "#2563EB",
  font: "'Poppins','DM Sans','Segoe UI',sans-serif",
};

/* ─── Types ───────────────────────────────────────────────────────────────── */
// `isExisting` flags folders that were seeded from the server (edit mode).
// These must NOT be recreated on submit — the server already has them and
// would return 400 "already exists".
interface SessionFolder { name: string; children: SessionFolder[]; isExisting?: boolean }

interface AssignedFile {
  id: string;
  file: File;
  targetPath: string[];
  displayName: string;
  isEditingName: boolean;
  editNameValue: string;
  isExisting?: boolean;
}

interface ModalToast { msg: string; ok: boolean }

/* ─── Helpers ─────────────────────────────────────────────────────────────── */
function fmtSize(bytes: number) {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

function getExtColor(name: string) {
  const ext = getFileExt(name);
  const map: Record<string, string> = {
    pdf: "#EF4444", ppt: "#F97316", pptx: "#F97316",
    doc: "#2563EB", docx: "#2563EB",
    mp4: "#0891B2", mov: "#0891B2", avi: "#0891B2",
    png: "#7C3AED", jpg: "#7C3AED", jpeg: "#7C3AED",
    txt: "#64748B", mp3: "#D97706", wav: "#D97706",
  };
  return { ext: ext || "file", color: map[ext] ?? T.acc };
}

function collectAllFolderPaths(folders: SessionFolder[], prefix: string[]): string[][] {
  const r: string[][] = [];
  for (const f of folders) {
    const p = [...prefix, f.name];
    // Skip server-existing folders — they don't need to be created. We still
    // recurse so a newly-created subfolder inside an existing folder is
    // captured with its full path.
    if (!f.isExisting) r.push(p);
    if (f.children.length) r.push(...collectAllFolderPaths(f.children, p));
  }
  return r;
}

function getFoldersAtPath(folders: SessionFolder[], path: string[]): SessionFolder[] {
  if (!path.length) return folders;
  const node = folders.find(f => f.name === path[0]);
  if (!node) return [];
  return getFoldersAtPath(node.children, path.slice(1));
}

/* ─── Folder icon (minimal, matches sidebar tone) ────────────────────────── */
const FolderIcon: React.FC<{ size?: number; color?: string }> = ({
  size = 16, color = "#D97706",
}) => (
  <svg width={size} height={size * 0.85} viewBox="0 0 20 17" fill="none">
    <path d="M1 3C1 1.9 1.9 1 3 1H8L10 3.5H17C18.1 3.5 19 4.4 19 5.5V14C19 15.1 18.1 16 17 16H3C1.9 16 1 15.1 1 14V3Z"
      fill={color} opacity="0.90" />
    <path d="M1 6H19V14C19 15.1 18.1 16 17 16H3C1.9 16 1 15.1 1 14V6Z"
      fill={color} />
    <path d="M1 6H19V8.5C19 8.5 13 10 10 10C7 10 1 8.5 1 8.5V6Z"
      fill="rgba(255,255,255,0.15)" />
  </svg>
);

/* ─── Toggle ──────────────────────────────────────────────────────────────── */
const Toggle: React.FC<{
  checked: boolean; onChange: (v: boolean) => void;
  label: string; icon?: React.ReactNode; disabled?: boolean;
}> = ({ checked, onChange, label, icon, disabled }) => (
  <button
    type="button"
    onClick={() => !disabled && onChange(!checked)}
    disabled={disabled}
    style={{
      display: "flex", alignItems: "center", gap: 8,
      cursor: disabled ? "not-allowed" : "pointer",
      opacity: disabled ? 0.45 : 1,
      background: "none", border: "none", padding: 0, textAlign: "left",
    }}
  >
    <div style={{
      width: 32, height: 17, borderRadius: 9, flexShrink: 0, position: "relative",
      background: checked ? T.acc : T.borderSub,
      transition: "background 0.18s",
      boxShadow: checked ? `0 0 0 2px ${T.accLight}` : "none",
    }}>
      <div style={{
        position: "absolute", top: 2, left: checked ? 16 : 2,
        width: 13, height: 13, borderRadius: 7,
        background: "#fff", transition: "left 0.18s",
        boxShadow: "0 1px 3px rgba(0,0,0,0.22)",
      }} />
    </div>
    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
      {icon && <span style={{ color: checked ? T.acc : T.textGhost, display: "flex" }}>{icon}</span>}
      <span style={{
        fontFamily: T.font, fontSize: 11.5, fontWeight: 500,
        color: checked ? T.textSub : T.textFaint,
        userSelect: "none",
      }}>{label}</span>
    </div>
  </button>
);

/* ─── Props ───────────────────────────────────────────────────────────────── */
export interface UploadOptions {
  showToStudent: boolean;
  allowDownload: boolean;
  createdAt: string;
  parentGroupId?: string;
  groupName?: string;
  groupDescription?: string;
  outerGroupId?: string;
}

export interface FileUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (files: File[], groupName: string, description: string, targetPath: string[], onProgress: (pct: number) => void, options?: UploadOptions) => Promise<void>;
  onCreateFolder: (name: string, parentPath: string[], options?: { createdAt: string; parentGroupId?: string; groupName?: string; groupDescription?: string }) => Promise<void>;
  currentFolderPath?: string[];
  parentGroupId?: string;
  onSuccess?: () => void;

  // When the modal is opened via "Add files to this group", parentGroupName
  // carries the existing group's display name so the breadcrumb can show
  // "Root › <Group Name>" instead of just "Root", and so newly-uploaded files
  // can be stamped with the SAME groupName as the rest of the group.
  parentGroupName?: string;
  isLoading?: boolean;
  hierarchyInfo?: HierarchyInfo;
  onNavigateTo?: (nodeId: string) => void;
  editMode?: boolean;
  initialFileName?: string;
  initialDescription?: string;
  initialShowToStudent?: boolean;
  initialAllowDownload?: boolean;
  // ── Existing-content seeding for edit mode ───────────────────────────────
  // initialFiles: flat list of files that already exist on the server.
  //   `path` is the parent folder path (relative to the modal root); omit for root.
  // initialFolders: flat list of folders that already exist on the server,
  //   reconstructed into a nested tree on open.
  // onDeleteFile: fired when the user removes an existing file row/chip.
  initialFiles?: Array<{ name: string; size?: string | number; path?: string[] }>;
  initialFolders?: Array<{ name: string; path: string[] }>;
  onDeleteFile?: (name: string, path: string[]) => void;
  // Mirrors onDeleteFile but for existing folders. The parent queues the
  // deletion and processes it on Save Changes — the server-side deleteFolder
  // call cascades to all files/subfolders inside it.
  onDeleteFolder?: (name: string, path: string[]) => void;
  /**
   * Course Setup config keys this course enabled — e.g. `["ppt", "pdf"]`.
   * Drives the accepted-type chips, the browse dialog's filter and the
   * drag & drop validation, so a type the course didn't enable cannot be
   * added by any route. Omitted (legacy course with no saved config) →
   * LEGACY_ALLOWED_TYPES.
   */
  allowedTypes?: string[];
  /**
   * Per-type "Max file size" from Course Setup, in MB — e.g. `{ ppt: 2, pdf: 3 }`.
   * A file over its own type's ceiling is rejected before it can be queued, so
   * the limit holds for drag & drop the same as for browsing. Types absent from
   * the map are unlimited.
   */
  maxSizeByType?: MaxSizeByType;
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════════════════ */
export const FileUploadModal: React.FC<FileUploadModalProps> = ({
  isOpen, onClose, onSubmit, onCreateFolder,
  currentFolderPath = [], parentGroupId, parentGroupName,
  isLoading = false,
  editMode = false,
  initialFileName, initialDescription,
  initialShowToStudent, initialAllowDownload,
  initialFiles, initialFolders, onDeleteFile, onDeleteFolder, onSuccess,
  allowedTypes, maxSizeByType,
}) => {

  // The single gate every entry route checks: the <input accept>, the browse
  // dialog and the drop handler all read from this, so there's no way in for a
  // type the course didn't enable.
  // Presence, not length: an empty array means "this course enabled no file
  // types", which must accept nothing. Only an omitted prop is a legacy caller
  // with no config to go on.
  const allowedRules = useMemo(
    () => buildAllowedRules(allowedTypes ?? LEGACY_ALLOWED_TYPES, maxSizeByType),
    [allowedTypes, maxSizeByType]
  );

  const [fileName, setFileName] = useState("");
  const [fileDescription, setFileDescription] = useState("");
  const [nameError, setNameError] = useState("");
  const [isDragOver, setIsDragOver] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [sessionFolders, setSessionFolders] = useState<SessionFolder[]>([]);
  const [selectedFolderPath, setSelectedFolderPath] = useState<string[]>([]);
  const [showFolderInput, setShowFolderInput] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [assignedFiles, setAssignedFiles] = useState<AssignedFile[]>([]);
  const [showCloseWarning, setShowCloseWarning] = useState(false);
  const [modalToast, setModalToast] = useState<ModalToast | null>(null);
  const [showToStudent, setShowToStudent] = useState(true);
  const [allowDownload, setAllowDownload] = useState(false);
  const [progressStep, setProgressStep] = useState("");
  const [creationDone, setCreationDone] = useState(false);
  // Pending X-click awaiting Yes/No confirmation. Captures everything needed
  // to perform the removal on Yes — id for files, path+name for folders, plus
  // an isExisting flag so the parent is only notified for server-side items.
  const [confirmRemove, setConfirmRemove] = useState<
    | { kind: "file"; id: string; name: string; path: string[]; isExisting: boolean }
    | { kind: "folder"; name: string; path: string[]; isExisting: boolean }
    | null
  >(null);

  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  const showModalToast = useCallback((msg: string, ok: boolean) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setModalToast({ msg, ok });
    toastTimer.current = setTimeout(() => setModalToast(null), 3000);
  }, []);

  const hasWork = editMode ? !!fileName.trim() : (assignedFiles.length > 0 || sessionFolders.length > 0);
  const hasFolders = sessionFolders.length > 0;
  const busy = isSubmitting || isLoading;
  const done = uploadProgress === 100;

  const lvFolders = getFoldersAtPath(sessionFolders, selectedFolderPath);
  const lvFiles = assignedFiles.filter(af => af.targetPath.join("/") === selectedFolderPath.join("/"));
  const isEmpty = lvFolders.length === 0 && lvFiles.length === 0;

  /* ESC */
  useEffect(() => {
    if (!isOpen) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") handleClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [isOpen, hasWork]);

  /* Reset / seed */
  useEffect(() => {
    if (!isOpen) {
      setFileName(""); setFileDescription(""); setNameError("");
      setIsDragOver(false); setIsSubmitting(false); setUploadProgress(0);
      setSessionFolders([]); setSelectedFolderPath([]);
      setShowFolderInput(false); setNewFolderName("");
      setAssignedFiles([]); setShowCloseWarning(false); setModalToast(null);
      setShowToStudent(true); setAllowDownload(false);
      setProgressStep(""); setCreationDone(false);
      setConfirmRemove(null);
      if (toastTimer.current) clearTimeout(toastTimer.current);
    } else if (editMode) {
      if (initialFileName !== undefined) setFileName(initialFileName);
      if (initialDescription !== undefined) setFileDescription(initialDescription);
      if (initialShowToStudent !== undefined) setShowToStudent(initialShowToStudent);
      if (initialAllowDownload !== undefined) setAllowDownload(initialAllowDownload);

      // ── Always pre-populate the explorer with existing data ─────────────────
      // The explorer should mirror what the user would see after a fresh upload —
      // folder rows for every existing folder, file rows for every existing file,
      // regardless of whether the resource is a single file or a group. The
      // single-file chip above the drop zone is shown IN ADDITION to the row.

      // Rebuild SessionFolder tree from the flat [{name,path}] list.
      // Sort by path depth ascending so each parent exists before its child.
      // Every seeded folder is flagged `isExisting:true` so the submit loop
      // doesn't try to recreate it on the server.
      if (initialFolders && initialFolders.length) {
        const sorted = [...initialFolders].sort((a, b) => a.path.length - b.path.length);
        const insert = (nodes: SessionFolder[], pl: string[], name: string): SessionFolder[] => {
          if (!pl.length) {
            if (nodes.find(n => n.name === name)) return nodes;
            return [...nodes, { name, children: [], isExisting: true }];
          }
          return nodes.map(n =>
            n.name === pl[0] ? { ...n, children: insert(n.children, pl.slice(1), name) } : n
          );
        };
        let tree: SessionFolder[] = [];
        for (const f of sorted) tree = insert(tree, f.path, f.name);
        setSessionFolders(tree);
      }

      // Seed assignedFiles from initialFiles with isExisting=true.
      // We construct a placeholder File (no bytes) and override `size` so the
      // row's existing fmtSize(af.file.size) display still works.
      if (initialFiles && initialFiles.length) {
        const seeded: AssignedFile[] = initialFiles.map((f, i) => {
          const placeholder = new File([], f.name);
          const numericSize =
            f.size === undefined
              ? 0
              : typeof f.size === "string"
                ? parseInt(f.size, 10) || 0
                : f.size;
          if (numericSize > 0) {
            try { Object.defineProperty(placeholder, "size", { value: numericSize, configurable: true }); } catch { }
          }
          return {
            id: `existing-${i}-${Date.now()}-${Math.random()}`,
            file: placeholder,
            targetPath: f.path ?? [],
            displayName: f.name,
            isEditingName: false,
            editNameValue: f.name,
            isExisting: true,
          };
        });
        setAssignedFiles(seeded);
      }
    }
  }, [isOpen]);

  /* Auto-fill name */
  useEffect(() => {
    if (assignedFiles.length === 1 && !hasFolders && !fileName) {
      const n = assignedFiles[0].file.name;
      setFileName(n.includes(".") ? n.slice(0, n.lastIndexOf(".")) : n);
    } else if (assignedFiles.length === 0 && !hasFolders && !editMode) {
      setFileName("");
    }
  }, [assignedFiles.length, hasFolders, editMode]);

  /* Focus folder input */
  useEffect(() => {
    if (showFolderInput) setTimeout(() => folderInputRef.current?.focus(), 60);
  }, [showFolderInput]);

  /* Folder management */
  const addFolderToSession = useCallback((name: string, atPath: string[]) => {
    setSessionFolders(prev => {
      const insert = (nodes: SessionFolder[], pl: string[]): SessionFolder[] => {
        if (!pl.length) {
          if (nodes.find(n => n.name === name)) return nodes;
          return [...nodes, { name, children: [] }];
        }
        return nodes.map(n => n.name === pl[0] ? { ...n, children: insert(n.children, pl.slice(1)) } : n);
      };
      return insert(prev, atPath);
    });
  }, []);

  const renameFolderAtPath = useCallback((atPath: string[], oldName: string, newName: string) => {
    setSessionFolders(prev => {
      const rename = (nodes: SessionFolder[], pl: string[]): SessionFolder[] => {
        if (!pl.length) return nodes.map(n => n.name === oldName ? { ...n, name: newName } : n);
        return nodes.map(n => n.name === pl[0] ? { ...n, children: rename(n.children, pl.slice(1)) } : n);
      };
      return rename(prev, atPath);
    });
  }, []);

  const deleteFolderAtPath = useCallback((atPath: string[], name: string) => {
    setSessionFolders(prev => {
      const del = (nodes: SessionFolder[], pl: string[]): SessionFolder[] => {
        if (!pl.length) return nodes.filter(n => n.name !== name);
        return nodes.map(n => n.name === pl[0] ? { ...n, children: del(n.children, pl.slice(1)) } : n);
      };
      return del(prev, atPath);
    });
    const fp = [...atPath, name].join("/");
    setAssignedFiles(prev => prev.filter(af => {
      const p = af.targetPath.join("/");
      return p !== fp && !p.startsWith(fp + "/");
    }));
  }, []);

  const addFiles = useCallback((incoming: File[]) => {
    const snap = [...selectedFolderPath];
    const { allowed, blockedMessage } = partitionFiles(incoming, allowedRules);
    if (blockedMessage) showModalToast(blockedMessage, false);
    if (!allowed.length) return;
    setAssignedFiles(prev => {
      const existing = new Set(prev.map(af => af.targetPath.join("/") + "::" + af.file.name + af.file.size));
      return [...prev, ...allowed
        .filter(f => !existing.has(snap.join("/") + "::" + f.name + f.size))
        .map(f => ({
          id: `af-${Date.now()}-${Math.random()}`,
          file: f, targetPath: snap,
          displayName: f.name, isEditingName: false, editNameValue: f.name,
        }))];
    });
  }, [selectedFolderPath, showModalToast, allowedRules]);

  const startEdit = (id: string) => setAssignedFiles(prev => prev.map(af => af.id === id ? { ...af, isEditingName: true, editNameValue: af.displayName } : af));
  const updateEdit = (id: string, v: string) => setAssignedFiles(prev => prev.map(af => af.id === id ? { ...af, editNameValue: v } : af));
  const commitEdit = (id: string) => setAssignedFiles(prev => prev.map(af => af.id === id ? { ...af, isEditingName: false, displayName: af.editNameValue.trim() || af.displayName } : af));
  const cancelEdit = (id: string) => setAssignedFiles(prev => prev.map(af => af.id === id ? { ...af, isEditingName: false } : af));
  const removeFile = (id: string) => setAssignedFiles(prev => prev.filter(af => af.id !== id));

  // Runs the actual removal after the user clicks Yes on the confirmation
  // dialog. For files: updates assignedFiles + notifies parent for existing
  // ones. For folders: cascade-removes the SessionFolder subtree + nested
  // files from local state, then notifies parent for existing ones. Parent
  // queues the deletion and only persists it when Save Changes is clicked.
  const performConfirmedRemoval = () => {
    if (!confirmRemove) return;
    if (confirmRemove.kind === "file") {
      removeFile(confirmRemove.id);
      if (confirmRemove.isExisting && onDeleteFile) {
        onDeleteFile(confirmRemove.name, confirmRemove.path);
      }
    } else {
      deleteFolderAtPath(confirmRemove.path, confirmRemove.name);
      if (confirmRemove.isExisting && onDeleteFolder) {
        onDeleteFolder(confirmRemove.name, confirmRemove.path);
      }
      showModalToast(`"${confirmRemove.name}" removed`, true);
    }
    setConfirmRemove(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setIsDragOver(false);
    addFiles(Array.from(e.dataTransfer.files));
  };
  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    addFiles(Array.from(e.target.files || []));
    e.target.value = "";
  };

  const handleCreateFolder = () => {
    const name = newFolderName.trim();
    if (!name) return;
    addFolderToSession(name, selectedFolderPath);
    setNewFolderName("");
    setShowFolderInput(false);
    showModalToast(`"${name}" folder created`, true);
  };

  const navigateInto = (name: string) => setSelectedFolderPath(prev => [...prev, name]);
  const navigateTo = (i: number) => setSelectedFolderPath(prev => i < 0 ? [] : prev.slice(0, i + 1));

  const handleClose = () => {
    if (isSubmitting) return;
    const hasPending = assignedFiles.length > 0 || sessionFolders.length > 0;
    hasPending ? setShowCloseWarning(true) : onClose();
  };
  const handleForceClose = () => { setShowCloseWarning(false); onClose(); };

  const handleSubmit = async () => {

    if (!editMode && !assignedFiles.length && !hasFolders) return;
    if (!fileName.trim()) {
      setNameError(editMode ? "Name is required." : (hasFolders || assignedFiles.length > 1 ? "Group name required." : "File name required."));
      return;
    }

    setNameError("");
    setIsSubmitting(true);
    setUploadProgress(0);
    setProgressStep("Starting…");
    setCreationDone(false);

    // Metadata-only / pure-deletion / pure-rename path for edit mode.
    // Trigger when there's nothing NEW to upload (seeded existing entries don't
    // count). This still calls onSubmit so the parent can process pending
    // deletions and persist metadata changes (name/description/visibility).
    const hasNewFiles = assignedFiles.some(af => !af.isExisting);
    const hasNewFolders = collectAllFolderPaths(sessionFolders, []).length > 0;
    if (editMode && !hasNewFiles && !hasNewFolders) {
      setProgressStep("Saving…");
      const metaOpts: UploadOptions = { showToStudent, allowDownload, createdAt: new Date().toISOString() };
      try { await onSubmit([], fileName.trim(), fileDescription.trim(), [...currentFolderPath], () => { }, metaOpts); }
      catch { }
      // Second one (main upload path):
      setUploadProgress(100); setProgressStep("All done!"); setCreationDone(true);
      setTimeout(() => { setIsSubmitting(false); if (onSuccess) onSuccess(); else onClose(); }, 500);
      return;
    }

    const capturedGroupName = fileName.trim();
    const capturedDescription = fileDescription.trim();
    const capturedBasePath = [...currentFolderPath];
    const capturedFolderPaths = collectAllFolderPaths(sessionFolders, []);

    const pathGroupMap = new Map<string, { path: string[]; files: File[] }>();
    // Only NEW files are uploaded. Existing (seeded) rows are placeholder File
    // objects with no real bytes — they represent server-side files that are
    // already saved and must not be re-uploaded.
    assignedFiles.filter(af => !af.isExisting).forEach(af => {
      const key = af.targetPath.join("/") || "__root__";
      if (!pathGroupMap.has(key)) pathGroupMap.set(key, { path: af.targetPath, files: [] });
      const rawName = af.displayName.trim() || af.file.name;
      const origExt = af.file.name.includes(".") ? "." + af.file.name.split(".").pop() : "";
      const finalName = rawName.includes(".") ? rawName : rawName + origExt;
      const outFile = finalName !== af.file.name ? new window.File([af.file], finalName, { type: af.file.type }) : af.file;
      pathGroupMap.get(key)!.files.push(outFile);
    });
    const capturedFileGroups = Array.from(pathGroupMap.values());

    const validParentGroupId = typeof parentGroupId === "string" && parentGroupId.length > 0 ? parentGroupId : undefined;
    const isAddingToExisting = !!validParentGroupId;
    const isGroupScenario = hasFolders || assignedFiles.length > 1;
    // When multiple files/folders are added to an existing group, create a NEW
    // sub-group instead of dumping them all directly into the parent group.
    const isSubGroupScenario = isAddingToExisting && isGroupScenario && !!capturedGroupName;
    const effectiveGroupId = isSubGroupScenario
      ? crypto.randomUUID()
      : (validParentGroupId ?? (isGroupScenario && capturedGroupName ? crypto.randomUUID() : undefined));

    // groupName resolution:
    //   - isSubGroupScenario: the user-typed name becomes the sub-group name.
    //   - isAddingToExisting (single file): stamp the EXISTING group's name so
    //     the new file shares the same groupName as the rest of the group.
    //   - new group scenario: use the user-typed name as the new group's name.
    //   - single-file standalone: no groupName.
    const uploadOptions: UploadOptions = {
      showToStudent, allowDownload,
      createdAt: new Date().toISOString(),
      parentGroupId: effectiveGroupId,
      groupName: isSubGroupScenario
        ? capturedGroupName
        : (isAddingToExisting
          ? (parentGroupName || undefined)
          : (isGroupScenario ? (capturedGroupName || undefined) : undefined)),
      groupDescription: isSubGroupScenario
        ? (capturedDescription || undefined)
        : (isAddingToExisting || !isGroupScenario ? undefined : capturedDescription || undefined),
      outerGroupId: isSubGroupScenario ? validParentGroupId : undefined,
    };

    const totalTasks = capturedFolderPaths.length + capturedFileGroups.length;
    let completedTasks = 0;
    const finishTask = (label: string) => {
      completedTasks++;
      setUploadProgress(totalTasks > 0 ? Math.min(Math.round((completedTasks / totalTasks) * 100), 99) : 99);
      setProgressStep(label);
    };

    for (const relPath of capturedFolderPaths) {
      const fn = relPath[relPath.length - 1];
      setProgressStep(`Creating "${fn}"…`);
      const isTop = relPath.length === 1;
      try {
        await onCreateFolder(fn, [...capturedBasePath, ...relPath.slice(0, -1)], {
          createdAt: uploadOptions.createdAt,
          parentGroupId: isTop ? effectiveGroupId : undefined,
          groupName: isTop ? uploadOptions.groupName : undefined,
          groupDescription: isTop ? uploadOptions.groupDescription : undefined,
        });
      } catch { }
      finishTask(`"${fn}" created`);
    }

    for (const { path, files } of capturedFileGroups) {
      const label = files.length === 1 ? `Uploading "${files[0].name}"…` : `Uploading ${files.length} files…`;
      setProgressStep(label);
      const filesAtRoot = path.length === 0;
      const perFileOpts: UploadOptions = {
        ...uploadOptions,
        parentGroupId: filesAtRoot ? uploadOptions.parentGroupId : undefined,
        groupName: filesAtRoot ? uploadOptions.groupName : undefined,
        groupDescription: filesAtRoot ? uploadOptions.groupDescription : undefined,
      };
      try {
        await onSubmit(files, hasFolders ? "" : capturedGroupName, capturedDescription,
          [...capturedBasePath, ...path], () => { }, perFileOpts);
      } catch { }
      finishTask(files.length === 1 ? `"${files[0].name}" uploaded` : `${files.length} files uploaded`);
    }

    // ── EDIT MODE: flush pending deletions even with no new files ────────────
    // The file-group loop above invokes the parent's onSubmit per uploaded
    // group, and the parent processes its pending-deletion queue on the FIRST
    // such call. When the user only adds new folders + deletes existing items
    // (no new files), capturedFileGroups is empty, so onSubmit would never run
    // and the deletion queue would be silently dropped on Save Changes.
    //
    // The metadata-only branch above doesn't catch this case either — it only
    // fires when BOTH new files and new folders are absent. Adding a new
    // folder makes hasNewFolders=true and skips that branch.
    //
    // So: in edit mode, if we reached this point without ever calling
    // onSubmit, fire it once with an empty file array. The parent's deletion
    // queue gets flushed; nothing new is uploaded.
    if (editMode && capturedFileGroups.length === 0) {
      setProgressStep("Saving changes…");
      try {
        await onSubmit(
          [],
          hasFolders ? "" : capturedGroupName,
          capturedDescription,
          [...capturedBasePath],
          () => { },
          uploadOptions,
        );
      } catch { }
    }

    setUploadProgress(100); setProgressStep("All done!"); setCreationDone(true);
    setTimeout(() => { setIsSubmitting(false); if (onSuccess) onSuccess(); else onClose(); }, 500);
  };

  if (!isOpen) return null;

  const totalFolders = collectAllFolderPaths(sessionFolders, []).length;
  const totalAssigned = assignedFiles.length;
  const isGroup = hasFolders || totalAssigned > 1;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        .fum * { box-sizing:border-box; font-family:'Poppins','DM Sans','Segoe UI',sans-serif; }
        .fum-input { outline:none; transition:border-color .15s,box-shadow .15s; }
        .fum-input:focus { border-color:rgba(232,100,12,.45) !important; box-shadow:0 0 0 3px rgba(232,100,12,.09) !important; }
        .fum-row { transition:background .13s; }
        .fum-row:hover { background:#f6f7f9 !important; }
        .fum-btn { transition:background .14s,border-color .14s,color .14s; cursor:pointer; }
        .fum-btn:hover:not(:disabled) { border-color:rgba(232,100,12,.35) !important; color:${T.acc} !important; background:#fdf5f0 !important; }
        .fum-scroll { scrollbar-width:thin; scrollbar-color:#d4d8df transparent; }
        .fum-scroll::-webkit-scrollbar { width:4px; }
        .fum-scroll::-webkit-scrollbar-thumb { background:#d4d8df; border-radius:4px; }
        @keyframes fumIn  { from{opacity:0;transform:scale(.97) translateY(8px)} to{opacity:1;transform:scale(1) translateY(0)} }
        @keyframes fumBg  { from{opacity:0} to{opacity:1} }
        @keyframes fumSpin{ from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes fumPop { from{opacity:0;transform:translateY(-4px)} to{opacity:1;transform:translateY(0)} }
      `}</style>

      {/* Remove confirmation — fires for every X click on any file/folder/chip.
          Yes runs performConfirmedRemoval which removes from local state and
          (for existing items) tells the parent to queue a server delete. No
          dismisses the dialog and keeps the item in place. */}
      {confirmRemove && (
        <div className="fum" style={{
          position: "fixed", inset: 0, zIndex: 202,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: "rgba(15,23,42,0.55)", backdropFilter: "blur(5px)",
        }} onClick={() => setConfirmRemove(null)}>
          <div style={{
            background: T.bg, borderRadius: 14, border: `1px solid ${T.border}`,
            boxShadow: "0 20px 48px rgba(0,0,0,0.18)",
            padding: "20px", maxWidth: 340, width: "calc(100% - 32px)",
            animation: "fumIn .18s ease both",
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", gap: 12, alignItems: "flex-start", marginBottom: 16 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 9, flexShrink: 0,
                background: T.redLight, border: `1px solid rgba(220,38,38,0.22)`,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <Trash2 size={17} color={T.red} />
              </div>
              <div>
                <p style={{ fontSize: 13, fontWeight: 600, color: T.text, margin: "0 0 3px", fontFamily: T.font }}>
                  Remove Item?
                </p>
                <p style={{ fontSize: 11.5, color: T.textFaint, margin: 0, lineHeight: 1.5, fontFamily: T.font }}>
                  This item will be removed after you save changes.
                </p>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="fum-btn" onClick={() => setConfirmRemove(null)} style={{
                flex: 1, padding: "8px 0", borderRadius: 8, fontSize: 12, fontWeight: 600,
                background: T.surfaceEl, color: T.textSub, border: `1px solid ${T.border}`,
                cursor: "pointer", fontFamily: T.font,
              }}>No</button>
              <button className="fum-btn" onClick={performConfirmedRemoval} style={{
                flex: 1, padding: "8px 0", borderRadius: 8, fontSize: 12, fontWeight: 600,
                background: T.red, color: "#fff", border: `1px solid ${T.red}`,
                cursor: "pointer", fontFamily: T.font,
              }}>Yes</button>
            </div>
          </div>
        </div>
      )}

      {/* Discard warning */}
      {showCloseWarning && (
        <div className="fum" style={{
          position: "fixed", inset: 0, zIndex: 201,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: "rgba(15,23,42,0.55)", backdropFilter: "blur(5px)",
        }} onClick={() => setShowCloseWarning(false)}>
          <div style={{
            background: T.bg, borderRadius: 14, border: `1px solid ${T.border}`,
            boxShadow: "0 20px 48px rgba(0,0,0,0.18)",
            padding: "20px", maxWidth: 340, width: "calc(100% - 32px)",
            animation: "fumIn .18s ease both",
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", gap: 12, alignItems: "flex-start", marginBottom: 16 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 9, flexShrink: 0,
                background: "rgba(217,119,6,0.09)", border: "1px solid rgba(217,119,6,0.22)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <AlertCircle size={17} color="#D97706" />
              </div>
              <div>
                <p style={{ fontSize: 13, fontWeight: 600, color: T.text, margin: "0 0 3px" }}>Discard changes?</p>
                <p style={{ fontSize: 11.5, color: T.textFaint, margin: 0, lineHeight: 1.5 }}>
                  {totalFolders > 0 && <><b style={{ color: "#D97706" }}>{totalFolders}</b> folder{totalFolders !== 1 ? "s" : ""}, </>}
                  <b style={{ color: "#D97706" }}>{totalAssigned}</b> file{totalAssigned !== 1 ? "s" : ""} not uploaded.
                </p>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="fum-btn" onClick={handleForceClose} style={{
                flex: 1, padding: "8px 0", borderRadius: 8, fontSize: 12, fontWeight: 600,
                background: T.redLight, color: T.red, border: `1px solid rgba(220,38,38,0.2)`,
                cursor: "pointer",
              }}>Discard & close</button>
              <button className="fum-btn" onClick={() => setShowCloseWarning(false)} style={{
                flex: 1, padding: "8px 0", borderRadius: 8, fontSize: 12, fontWeight: 600,
                background: T.acc, color: "#fff", border: `1px solid ${T.acc}`,
                cursor: "pointer",
              }}>Keep editing</button>
            </div>
          </div>
        </div>
      )}

      {/* Backdrop */}
      <div style={{
        position: "fixed", inset: 0, zIndex: 70,
        background: "rgba(15,23,42,0.45)", backdropFilter: "blur(3px)",
        animation: "fumBg .16s ease both",
        display: "flex", alignItems: "center", justifyContent: "center",
      }} onClick={isSubmitting ? undefined : handleClose}>

        {/* Modal */}
        <div className="fum" style={{
          position: "relative",
          width: 1160, maxWidth: "calc(100vw - 24px)",
          height: "90vh", maxHeight: "90vh",
          background: T.bg, borderRadius: 16,
          border: `1px solid ${T.border}`,
          boxShadow: "0 24px 60px rgba(0,0,0,0.18)",
          display: "flex", flexDirection: "column",
          overflow: "hidden",
          animation: "fumIn .20s cubic-bezier(0.16,1,0.3,1) both",
        }} onClick={e => e.stopPropagation()}>

          {/* Progress overlay */}
          {isSubmitting && (
            <div style={{
              position: "absolute", inset: 0, zIndex: 40,
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              gap: 20, padding: "32px 40px",
              background: "rgba(255,255,255,0.96)", backdropFilter: "blur(4px)",
              borderRadius: 16,
            }}>
              <div style={{ position: "relative" }}>
                {creationDone ? (
                  <div style={{
                    width: 56, height: 56, borderRadius: 14,
                    background: T.greenLight, border: `1.5px solid ${T.green}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <CheckCircle2 size={26} color={T.green} strokeWidth={1.8} />
                  </div>
                ) : (
                  <div style={{ position: "relative", width: 56, height: 56 }}>
                    <div style={{
                      width: 56, height: 56, borderRadius: 14,
                      background: T.accLight, border: `1.5px solid ${T.borderAcc}`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <Upload size={22} color={T.acc} strokeWidth={1.6} />
                    </div>
                    <svg style={{ position: "absolute", inset: 0, animation: "fumSpin 1s linear infinite" }} width="56" height="56" viewBox="0 0 56 56">
                      <circle cx="28" cy="28" r="24" fill="none" stroke={`${T.acc}20`} strokeWidth="3" />
                      <circle cx="28" cy="28" r="24" fill="none" stroke={T.acc} strokeWidth="3" strokeDasharray="37 113" strokeLinecap="round" />
                    </svg>
                  </div>
                )}
              </div>
              <div style={{ textAlign: "center" }}>
                <p style={{ fontSize: 15, fontWeight: 600, color: creationDone ? T.green : T.text, margin: "0 0 4px", fontFamily: T.font }}>
                  {progressStep}
                </p>
                <p style={{ fontSize: 11.5, color: T.textFaint, margin: 0, fontFamily: T.font }}>
                  {creationDone ? "Closing…" : "Please wait — do not close this window"}
                </p>
              </div>
              <div style={{ width: "100%", maxWidth: 320 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontSize: 11, color: T.textFaint, fontFamily: T.font }}>Progress</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: creationDone ? T.green : T.acc, fontFamily: T.font, fontVariantNumeric: "tabular-nums" }}>
                    {uploadProgress}%
                  </span>
                </div>
                <div style={{ height: 6, background: T.border, borderRadius: 99, overflow: "hidden" }}>
                  <div style={{
                    height: 6, borderRadius: 99, width: `${uploadProgress}%`,
                    background: creationDone
                      ? `linear-gradient(90deg,${T.green},#047857)`
                      : T.accGrad,
                    transition: "width .45s cubic-bezier(0.4,0,0.2,1)",
                  }} />
                </div>
              </div>
            </div>
          )}

          {/* Toast */}
          {modalToast && (
            <div style={{
              position: "absolute", right: 12, top: 52, zIndex: 35,
              display: "flex", alignItems: "center", gap: 7,
              padding: "7px 12px", borderRadius: 8,
              background: modalToast.ok ? "#0c2218" : "#220c0c",
              border: `1px solid ${modalToast.ok ? T.green : T.red}`,
              animation: "fumPop .15s ease both",
              maxWidth: 260,
            }}>
              {modalToast.ok
                ? <CheckCircle2 size={13} color={T.green} />
                : <AlertCircle size={13} color={T.red} />}
              <span style={{ fontSize: 11.5, fontWeight: 500, color: modalToast.ok ? T.green : T.red, fontFamily: T.font }}>
                {modalToast.msg}
              </span>
            </div>
          )}

          {/* ── Header ── */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "11px 20px",
            borderBottom: `1px solid ${T.border}`,
            background: T.surface, flexShrink: 0,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{
                width: 30, height: 30, borderRadius: 8,
                background: T.accGrad,
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
              }}>
                <Upload size={13} color="#fff" strokeWidth={2} />
              </div>
              <div>
                <p style={{ fontSize: 13.5, fontWeight: 600, color: T.text, margin: 0, fontFamily: T.font }}>
                  {editMode ? "Edit Resource" : "Upload Files"}
                </p>
                <p style={{ fontSize: 11, color: T.textFaint, margin: 0, fontFamily: T.font }}>
                  {editMode ? "Update metadata or add new files" : "Add files and folders · virtual until submitted"}
                </p>
              </div>
            </div>
            {!isSubmitting && (
              <button onClick={handleClose} style={{
                width: 28, height: 28, borderRadius: 7, flexShrink: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
                background: T.surfaceEl, border: `1px solid ${T.border}`,
                cursor: "pointer", color: T.textFaint,
              }}
                className="fum-btn"
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = T.red; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = T.textFaint; }}
              >
                <X size={13} strokeWidth={2} />
              </button>
            )}
          </div>

          {/* Breadcrumb showing upload destination */}
          {(() => {
            // Build the breadcrumb path segments
            const breadcrumbSegments: Array<{ label: string; isGroup?: boolean; isFolder?: boolean }> = [];

            // Add current folder path segments (from hierarchy)
            if (currentFolderPath && currentFolderPath.length > 0) {
              currentFolderPath.forEach(segment => {
                breadcrumbSegments.push({ label: segment, isFolder: true });
              });
            }

            // Add parent group name if it exists
            if (parentGroupName) {
              breadcrumbSegments.push({ label: parentGroupName, isGroup: true });
            }

            // Add selected folder path segments (from modal explorer)
            selectedFolderPath.forEach(segment => {
              breadcrumbSegments.push({ label: segment, isFolder: true });
            });

            // Determine the final destination label
            const destinationLabel = breadcrumbSegments.length > 0
              ? breadcrumbSegments[breadcrumbSegments.length - 1].label
              : "Root";

            // Get folder icon color based on segment type
            const getSegmentColor = (segment: { isGroup?: boolean; isFolder?: boolean }) => {
              if (segment.isGroup) return "#2563EB"; // Blue for groups
              if (segment.isFolder) return "#D97706"; // Orange for folders
              return T.acc; // Accent for root
            };

            return (
              <div style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                padding: "8px 20px",
                borderBottom: `1px solid ${T.border}`,
                background: T.surfaceEl,
                flexShrink: 0,
              }}>
                {/* Location icon */}
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  marginRight: 8,
                  flexShrink: 0,
                }}>
                  <FolderIcon size={14} color={T.acc} />
                  <span style={{
                    fontSize: 10.5,
                    fontWeight: 600,
                    color: T.textFaint,
                    fontFamily: T.font,
                    textTransform: "uppercase" as React.CSSProperties["textTransform"],
                    letterSpacing: "0.04em",
                  }}>
                    Saving to:
                  </span>
                </div>

                {/* Breadcrumb segments */}
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  flex: 1,
                  overflow: "hidden",
                }}>
                  {/* Root breadcrumb */}
                  <div style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    padding: "3px 8px",
                    borderRadius: 6,
                    background: breadcrumbSegments.length === 0 ? T.accLight : "transparent",
                    border: breadcrumbSegments.length === 0 ? `1px solid ${T.borderAcc}` : "1px solid transparent",
                    cursor: "default",
                    flexShrink: 0,
                  }}>
                    <Home size={10} color={T.acc} />
                    <span style={{
                      fontSize: 11,
                      fontWeight: breadcrumbSegments.length === 0 ? 600 : 500,
                      color: breadcrumbSegments.length === 0 ? T.acc : T.textSub,
                      fontFamily: T.font,
                    }}>
                      Root
                    </span>
                  </div>

                  {/* Path segments */}
                  {breadcrumbSegments.map((segment, index) => (
                    <React.Fragment key={index}>
                      <ChevronRight size={10} color={T.textGhost} style={{ flexShrink: 0 }} />
                      <div style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                        padding: "3px 8px",
                        borderRadius: 6,
                        background: index === breadcrumbSegments.length - 1 ? T.accLight : "transparent",
                        border: index === breadcrumbSegments.length - 1 ? `1px solid ${T.borderAcc}` : "1px solid transparent",
                        cursor: "default",
                        flexShrink: 0,
                        maxWidth: 160,
                        overflow: "hidden",
                      }}>
                        {segment.isGroup ? (
                          <FolderOpen size={11} color={getSegmentColor(segment)} />
                        ) : (
                          <FolderIcon size={12} color={getSegmentColor(segment)} />
                        )}
                        <span
                          title={segment.label}
                          style={{
                            fontSize: 11,
                            fontWeight: index === breadcrumbSegments.length - 1 ? 600 : 500,
                            color: index === breadcrumbSegments.length - 1 ? T.acc : T.textSub,
                            fontFamily: T.font,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {segment.label}
                        </span>

                        {/* Badge for segment type */}
                        <span style={{
                          fontSize: 8,
                          fontWeight: 600,
                          padding: "1px 4px",
                          borderRadius: 3,
                          background: segment.isGroup ? "rgba(37,99,235,0.1)" : "rgba(217,119,6,0.08)",
                          color: segment.isGroup ? "#2563EB" : "#D97706",
                          border: segment.isGroup ? "1px solid rgba(37,99,235,0.2)" : "1px solid rgba(217,119,6,0.18)",
                          fontFamily: T.font,
                          textTransform: "uppercase",
                          letterSpacing: "0.04em",
                          flexShrink: 0,
                        }}>
                          {segment.isGroup ? "group" : "folder"}
                        </span>
                      </div>
                    </React.Fragment>
                  ))}
                </div>

                {/* File count indicator */}
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  marginLeft: "auto",
                  flexShrink: 0,
                }}>
                  <span style={{
                    fontSize: 10.5,
                    color: T.textGhost,
                    fontFamily: T.font,
                  }}>
                    {totalAssigned > 0 && `${totalAssigned} file${totalAssigned !== 1 ? 's' : ''}`}
                    {totalAssigned > 0 && totalFolders > 0 && ' · '}
                    {totalFolders > 0 && `${totalFolders} folder${totalFolders !== 1 ? 's' : ''}`}
                  </span>
                </div>
              </div>
            );
          })()}
          {/* ── Scrollable body ── */}
          <div className="fum-scroll" style={{ flex: 1, overflowY: "auto", minHeight: 0, display: "flex", flexDirection: "column" }}>

            {/* ① Metadata */}
            <div style={{
              padding: "14px 20px",
              borderBottom: `1px solid ${T.border}`,
              display: "flex", flexDirection: "column", gap: 10,
              flexShrink: 0, background: T.surface,
            }}>
              {/* Name */}
              <div>
                <label style={{ display: "block", fontSize: 10.5, fontWeight: 600, letterSpacing: "0.04em", color: T.textFaint, marginBottom: 5, textTransform: "uppercase" as React.CSSProperties["textTransform"], fontFamily: T.font }}>
                  {isGroup ? "Group Name" : "File Name"} <span style={{ color: T.red }}>*</span>
                </label>
                <input
                  className="fum-input"
                  type="text" value={fileName}
                  onChange={e => { setFileName(e.target.value); if (nameError) setNameError(""); }}
                  placeholder={isGroup ? "Enter group name…" : "Enter file name…"}
                  disabled={busy}
                  style={{
                    width: "100%", padding: "7px 10px", fontSize: 13, fontWeight: 500,
                    borderRadius: 8, border: `1px solid ${nameError ? T.red : T.border}`,
                    background: T.surfaceEl, color: T.text, fontFamily: T.font,
                  }}
                />
                {nameError && <p style={{ fontSize: 11, color: T.red, margin: "4px 0 0", fontFamily: T.font }}>{nameError}</p>}
              </div>
              {/* Description */}
              <div>
                <label style={{ display: "block", fontSize: 10.5, fontWeight: 600, letterSpacing: "0.04em", color: T.textFaint, marginBottom: 5, textTransform: "uppercase" as React.CSSProperties["textTransform"], fontFamily: T.font }}>
                  Description <span style={{ fontSize: 10, color: T.textGhost, fontWeight: 400, letterSpacing: 0, textTransform: "none" as React.CSSProperties["textTransform"] }}>optional</span>
                </label>
                <div style={{ borderRadius: 8, overflow: "hidden", border: `1px solid ${T.border}` }}>
                  <TipTapEditor
                    value={fileDescription}
                    onChange={(html: string) => setFileDescription(html)}
                    placeholder="Add a description…"
                    minHeight="52px" maxHeight="96px"
                    showToolbar={!busy} editable={!busy}
                  />
                </div>
              </div>
            </div>

            {/* ② Toolbar */}
            <div style={{
              display: "flex", alignItems: "center", gap: 6, padding: "8px 20px",
              borderBottom: `1px solid ${T.border}`, background: T.surface, flexShrink: 0,
            }}>
              {/* New Folder */}
              <div style={{ position: "relative" }}>
                <button
                  type="button"
                  className="fum-btn"
                  onClick={() => { setShowFolderInput(v => !v); setNewFolderName(""); }}
                  disabled={busy}
                  style={{
                    display: "flex", alignItems: "center", gap: 6, padding: "5px 10px",
                    borderRadius: 7, fontSize: 11.5, fontWeight: 500,
                    background: showFolderInput ? T.accLight : T.surfaceEl,
                    border: `1px solid ${showFolderInput ? T.borderAcc : T.border}`,
                    color: showFolderInput ? T.acc : T.textSub,
                    cursor: "pointer",
                  }}
                >
                  <FolderIcon size={14} color={showFolderInput ? T.acc : "#D97706"} />
                  New Folder
                </button>
                {showFolderInput && (
                  <div style={{
                    position: "absolute", top: "calc(100% + 6px)", left: 0,
                    width: 220, background: T.bg,
                    border: `1px solid ${T.border}`, borderRadius: 10,
                    boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
                    padding: 12, zIndex: 30, animation: "fumPop .15s ease both",
                  }}>
                    {/* Arrow */}
                    <div style={{ position: "absolute", top: -6, left: 14, width: 10, height: 6, overflow: "hidden" }}>
                      <div style={{ width: 10, height: 10, background: T.bg, border: `1px solid ${T.border}`, borderRadius: 2, transform: "rotate(45deg) translate(-1px,3px)" }} />
                    </div>
                    <p style={{ fontSize: 11.5, fontWeight: 600, color: T.text, margin: "0 0 8px", fontFamily: T.font }}>
                      New folder {selectedFolderPath.length > 0 && <span style={{ color: T.acc }}>in {selectedFolderPath[selectedFolderPath.length - 1]}</span>}
                    </p>
                    <input
                      ref={folderInputRef}
                      className="fum-input"
                      type="text" value={newFolderName}
                      onChange={e => setNewFolderName(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") handleCreateFolder(); if (e.key === "Escape") setShowFolderInput(false); }}
                      placeholder="Folder name…"
                      style={{
                        width: "100%", padding: "6px 9px", fontSize: 12, borderRadius: 7,
                        border: `1px solid ${T.border}`, background: T.surfaceEl,
                        color: T.text, marginBottom: 8, fontFamily: T.font,
                      }}
                    />
                    <button
                      type="button"
                      onClick={handleCreateFolder}
                      disabled={!newFolderName.trim()}
                      style={{
                        width: "100%", padding: "6px 0", borderRadius: 7,
                        fontSize: 12, fontWeight: 600, color: "#fff",
                        background: T.acc, border: "none", cursor: "pointer",
                        opacity: newFolderName.trim() ? 1 : 0.4,
                      }}
                    >Create</button>
                  </div>
                )}
              </div>

              {/* Browse Files */}
              <button
                type="button"
                className="fum-btn"
                onClick={() => fileInputRef.current?.click()}
                disabled={busy}
                style={{
                  display: "flex", alignItems: "center", gap: 6, padding: "5px 10px",
                  borderRadius: 7, fontSize: 11.5, fontWeight: 500,
                  background: T.surfaceEl, border: `1px solid ${T.border}`,
                  color: T.textSub, cursor: "pointer",
                }}
              >
                <FileIcon size={13} strokeWidth={1.8} /> Browse Files
              </button>
              <input ref={fileInputRef} type="file" multiple accept={allowedRules.accept} style={{ display: "none" }} onChange={handleFileInput} />

              <span style={{ fontSize: 11, color: T.textGhost, fontFamily: T.font }}>or drag &amp; drop below</span>

              {/* Progress chip */}
              {busy && (
                <span style={{
                  marginLeft: "auto", display: "flex", alignItems: "center", gap: 6,
                  padding: "3px 10px", borderRadius: 6, background: T.accLight,
                  fontSize: 11, fontWeight: 600, color: T.acc, fontFamily: T.font,
                }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", border: `2px solid ${T.borderAcc}`, borderTopColor: T.acc, animation: "fumSpin .8s linear infinite" }} />
                  {done ? "Done ✓" : `${uploadProgress}%`}
                </span>
              )}
            </div>

            {/* ③ Breadcrumb */}
            {(() => {
              // When opened via "Add files to this group", we render the group
              // as the current parent in the breadcrumb so the user can clearly
              // see where the file will land. The group segment is the
              // "deepest" parent unless the user has navigated into a session
              // sub-folder inside the modal.
              const showGroupSegment = !!(parentGroupId && parentGroupName);
              const innermostLabel = selectedFolderPath.length > 0
                ? selectedFolderPath[selectedFolderPath.length - 1]
                : showGroupSegment
                  ? parentGroupName!
                  : ([...currentFolderPath].slice(-1)[0] ?? "Root");
              return (
                <div style={{
                  display: "flex", alignItems: "center", gap: 4, padding: "6px 20px",
                  borderBottom: `1px solid ${T.border}`, background: T.surfaceEl, flexShrink: 0,
                }}>
                  <button onClick={() => navigateTo(-1)} style={{
                    display: "flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 500,
                    color: selectedFolderPath.length || showGroupSegment ? T.blue : T.acc,
                    background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: T.font,
                  }}>
                    <Home size={11} /> Root
                  </button>
                  {showGroupSegment && (
                    <React.Fragment>
                      <ChevronRight size={10} color={T.textGhost} />
                      <span
                        title={parentGroupName!}
                        style={{
                          fontSize: 11,
                          fontWeight: selectedFolderPath.length ? 500 : 600,
                          // When no sub-folder is selected, the group IS the
                          // current parent — highlight it the same way the
                          // active path segment is normally highlighted.
                          color: selectedFolderPath.length ? T.blue : T.acc,
                          fontFamily: T.font,
                          maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                          // Non-navigable: groups are virtual, you can't drill
                          // into them inside the modal.
                          cursor: "default",
                        }}
                      >
                        {parentGroupName}
                      </span>
                    </React.Fragment>
                  )}
                  {selectedFolderPath.map((seg, i) => (
                    <React.Fragment key={i}>
                      <ChevronRight size={10} color={T.blue} />
                      <button onClick={() => navigateTo(i)} style={{
                        fontSize: 11, fontWeight: i === selectedFolderPath.length - 1 ? 600 : 500,
                        color: i === selectedFolderPath.length - 1 ? T.blue : T.blue,
                        background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: T.font,
                        maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      }}>{seg}</button>
                    </React.Fragment>
                  ))}
                  <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 4 }}>
                    <span style={{ fontSize: 10.5, color: T.textGhost, fontFamily: T.font }}>Saving to:</span>
                    <span style={{ fontSize: 10.5, fontWeight: 600, color: T.acc, fontFamily: T.font }}>
                      {innermostLabel}
                    </span>
                  </div>
                </div>
              );
            })()}

            {/* Single-file edit chip — shown above the drop zone when in edit
                mode with exactly one initialFile and no initialFolders.
                Visibility is DERIVED from assignedFiles: the chip stays as
                long as the seeded existing entry is still present. Clicking X
                removes that entry, which also removes the row in the explorer.
                Both UIs are always in sync. */}
            {(() => {
              const isSingleFileEdit =
                editMode &&
                !!initialFiles && initialFiles.length === 1 &&
                (!initialFolders || initialFolders.length === 0);
              if (!isSingleFileEdit) return null;
              const existing = initialFiles![0];
              // The seeded existing AssignedFile (single-file edit has only one).
              const matchAf = assignedFiles.find(af => af.isExisting);
              if (!matchAf) return null;
              const { color } = getExtColor(existing.name);
              return (
                <div style={{
                  padding: "10px 20px",
                  borderBottom: `1px solid ${T.border}`,
                  background: T.surface,
                  flexShrink: 0,
                }}>
                  <div style={{
                    display: "inline-flex", alignItems: "center", gap: 8,
                    padding: "6px 10px", borderRadius: 8,
                    background: T.surfaceEl, border: `1px solid ${T.border}`,
                    maxWidth: "100%",
                  }}>
                    <div style={{
                      width: 24, height: 24, borderRadius: 6, flexShrink: 0,
                      background: `${color}10`, border: `1px solid ${color}20`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <FileIcon size={12} color={color} strokeWidth={1.8} />
                    </div>
                    <span style={{
                      fontSize: 12, fontWeight: 500, color: T.text, fontFamily: T.font,
                      maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>
                      {existing.name}
                    </span>
                    <button
                      type="button"
                      className="fum-btn"
                      onClick={() => {
                        // Ask for confirmation first; actual removal happens
                        // in performConfirmedRemoval if the user clicks Yes.
                        setConfirmRemove({
                          kind: "file",
                          id: matchAf.id,
                          name: existing.name,
                          path: existing.path ?? [],
                          isExisting: true,
                        });
                      }}
                      disabled={busy}
                      style={{
                        width: 18, height: 18, borderRadius: 4, flexShrink: 0,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        background: "none", border: "none",
                        cursor: busy ? "not-allowed" : "pointer", color: T.textGhost,
                      }}
                      onMouseEnter={e => { if (!busy) (e.currentTarget as HTMLElement).style.color = T.red; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = T.textGhost; }}
                    >
                      <X size={11} />
                    </button>
                  </div>
                </div>
              );
            })()}

            {/* ④ Explorer / Drop zone */}
            <div
              ref={dropRef}
              style={{
                flex: 1, minHeight: 200, position: "relative",
                background: isDragOver ? "rgba(232,100,12,0.03)" : T.bg,
                transition: "background .14s",
              }}
              onDragOver={e => { e.preventDefault(); setIsDragOver(true); }}
              onDragLeave={e => { if (!dropRef.current?.contains(e.relatedTarget as Node)) setIsDragOver(false); }}
              onDrop={handleDrop}
            >
              {/* Drag overlay */}
              {isDragOver && (
                <div style={{
                  position: "absolute", inset: 0, zIndex: 10,
                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                  gap: 12, pointerEvents: "none",
                  background: "rgba(232,100,12,0.04)",
                  border: `2px dashed ${T.acc}`,
                  borderRadius: 6,
                }}>
                  <div style={{
                    width: 56, height: 56, borderRadius: 14,
                    background: T.accLight, border: `2px dashed ${T.acc}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <Upload size={24} color={T.acc} strokeWidth={1.5} />
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <p style={{ fontSize: 15, fontWeight: 600, color: T.acc, margin: "0 0 3px", fontFamily: T.font }}>Release to add files</p>
                    <p style={{ fontSize: 11.5, color: T.textFaint, margin: 0, fontFamily: T.font }}>
                      Into: <b style={{ color: T.acc }}>{selectedFolderPath.length ? selectedFolderPath[selectedFolderPath.length - 1] : "Root"}</b>
                    </p>
                  </div>
                </div>
              )}

              {/* Empty state */}
              {isEmpty && !isDragOver && (
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "center",
                  minHeight: 220, padding: "20px 32px", cursor: "pointer",
                }} onClick={() => fileInputRef.current?.click()}>
                  <div style={{
                    width: "100%", display: "flex", flexDirection: "column", alignItems: "center",
                    gap: 14, padding: "36px 32px", borderRadius: 12,
                    border: `1.5px dashed ${T.borderSub}`,
                    background: T.bg,
                    transition: "border-color .15s, background .15s",
                  }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLElement).style.borderColor = T.borderAcc;
                      (e.currentTarget as HTMLElement).style.background = T.accLight;
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLElement).style.borderColor = T.borderSub;
                      (e.currentTarget as HTMLElement).style.background = T.bg;
                    }}
                  >
                    {/* Upload icon cluster */}
                    <div style={{ position: "relative", width: 52, height: 52 }}>
                      <div style={{
                        width: 52, height: 52, borderRadius: 13,
                        background: T.surfaceEl,
                        border: `1.5px solid ${T.border}`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        <Upload size={22} color={T.textGhost} strokeWidth={1.5} />
                      </div>
                      {/* small file badges */}
                      <div style={{ position: "absolute", top: -6, right: -8, width: 20, height: 20, borderRadius: 5, background: "#EF4444", border: "2px solid #fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <FileIcon size={9} color="#fff" strokeWidth={2} />
                      </div>
                      <div style={{ position: "absolute", bottom: -5, left: -8, width: 18, height: 18, borderRadius: 4, background: "#3B82F6", border: "2px solid #fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <FileIcon size={8} color="#fff" strokeWidth={2} />
                      </div>
                    </div>
                    <div style={{ textAlign: "center" }}>
                      {/* No accepted formats at all — the course turned every
                          upload type off. Say so instead of inviting a drop
                          that can only be rejected. */}
                      {allowedRules.chips.length === 0 ? (
                        <p style={{ fontSize: 13, fontWeight: 600, color: T.textFaint, margin: 0, fontFamily: T.font }}>
                          No file types are enabled for this course
                          <span style={{ display: "block", fontSize: 11.5, fontWeight: 400, marginTop: 4 }}>
                            Enable one in Course Setup › Resource Type to upload files here
                          </span>
                        </p>
                      ) : (
                        <>
                          <p style={{ fontSize: 14, fontWeight: 600, color: T.text, margin: "0 0 4px", fontFamily: T.font }}>
                            {selectedFolderPath.length
                              ? `Drop files into "${selectedFolderPath[selectedFolderPath.length - 1]}"`
                              : "Drag & drop files here"}
                          </p>
                          <p style={{ fontSize: 12, color: T.textFaint, margin: "0 0 10px", fontFamily: T.font }}>
                            or{" "}
                            <span style={{ color: T.acc, fontWeight: 600, textDecoration: "underline", textUnderlineOffset: 2 }}>
                              click to browse
                            </span>
                            {" "}from your computer
                          </p>
                          {/* Accepted types — exactly what Course Setup enabled */}
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 5, flexWrap: "wrap" }}>
                            {allowedRules.chips.map(({ label, color, limit }) => (
                              <span key={label} style={{
                                fontSize: 10, fontWeight: 600, padding: "2px 7px", borderRadius: 4,
                                background: `${color}10`, color, border: `1px solid ${color}20`,
                                fontFamily: T.font, letterSpacing: "0.02em",
                              }}>
                                {label}
                                {/* Each type carries its own ceiling, so the
                                    limit belongs on the chip, not in one shared
                                    "max N MB" line that would be wrong for the
                                    other types. */}
                                {limit ? (
                                  <span style={{ fontWeight: 500, opacity: 0.75 }}> · {fmtLimit(limit)}</span>
                                ) : null}
                              </span>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Content list */}
              {!isEmpty && (
                <div style={{ display: "flex", flexDirection: "column" }}>
                  {/* Drop hint strip */}
                  <div
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                      padding: "6px 20px", borderBottom: `1px solid ${T.border}`,
                      background: T.surfaceEl, cursor: "pointer",
                    }}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload size={11} color={T.textGhost} />
                    <span style={{ fontSize: 10.5, fontWeight: 500, color: T.textFaint, fontFamily: T.font }}>
                      Drop more or <span style={{ color: T.acc }}>browse</span>
                    </span>
                  </div>

                  {/* Folder rows */}
                  {lvFolders.map(folder => {
                    const filesInside = assignedFiles.filter(af =>
                      af.targetPath.length > selectedFolderPath.length &&
                      af.targetPath.slice(0, selectedFolderPath.length + 1).join("/") === [...selectedFolderPath, folder.name].join("/")
                    ).length;
                    return (
                      <div
                        key={folder.name}
                        className="fum-row"
                        style={{
                          display: "flex", alignItems: "center", gap: 10,
                          padding: "9px 20px", borderBottom: `1px solid ${T.border}`,
                          background: T.bg, cursor: "pointer",
                        }}
                        onClick={() => navigateInto(folder.name)}
                      >
                        <FolderIcon size={18} color="#D97706" />
                        <span style={{ flex: 1, fontSize: 12.5, fontWeight: 500, color: T.text, fontFamily: T.font, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {folder.name}
                        </span>
                        {filesInside > 0 && (
                          <span style={{ fontSize: 10.5, color: T.textFaint, fontFamily: T.font }}>{filesInside} file{filesInside !== 1 ? "s" : ""}</span>
                        )}
                        <span style={{
                          fontSize: 9.5, fontWeight: 600, padding: "1px 6px", borderRadius: 4,
                          background: "rgba(217,119,6,0.08)", color: "#B45309",
                          border: "1px solid rgba(217,119,6,0.18)", fontFamily: T.font,
                        }}>virtual</span>
                        <div style={{ display: "flex", alignItems: "center", gap: 2 }} onClick={e => e.stopPropagation()}>
                          <button
                            type="button"
                            className="fum-btn"
                            disabled={busy}
                            onClick={() => {
                              const n = window.prompt("Rename:", folder.name);
                              if (n?.trim() && n.trim() !== folder.name) { renameFolderAtPath(selectedFolderPath, folder.name, n.trim()); showModalToast(`Renamed to "${n.trim()}"`, true); }
                            }}
                            style={{ width: 24, height: 24, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", background: "none", border: "none", cursor: "pointer", color: T.textGhost }}
                          ><Pencil size={11} /></button>
                          <button
                            type="button"
                            className="fum-btn"
                            disabled={busy}
                            onClick={() => setConfirmRemove({
                              kind: "folder",
                              name: folder.name,
                              path: selectedFolderPath,
                              isExisting: !!folder.isExisting,
                            })}
                            style={{ width: 24, height: 24, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", background: "none", border: "none", cursor: "pointer", color: T.textGhost }}
                          ><Trash2 size={11} /></button>
                        </div>
                        <ChevronRight size={13} color={T.textGhost} />
                      </div>
                    );
                  })}

                  {/* File rows */}
                  {lvFiles.map(af => {
                    const { ext, color } = getExtColor(af.file.name);
                    return (
                      <div
                        key={af.id}
                        className="fum-row"
                        style={{
                          display: "flex", alignItems: "center", gap: 10,
                          padding: "8px 20px", borderBottom: `1px solid ${T.border}`,
                          background: T.bg,
                        }}
                      >
                        <div style={{
                          width: 30, height: 30, borderRadius: 7, flexShrink: 0,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          background: `${color}10`, border: `1px solid ${color}20`,
                        }}>
                          <FileIcon size={13} color={color} strokeWidth={1.8} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          {af.isEditingName && !af.isExisting ? (
                            <input
                              className="fum-input"
                              type="text" value={af.editNameValue} autoFocus
                              onChange={e => updateEdit(af.id, e.target.value)}
                              onBlur={() => commitEdit(af.id)}
                              onKeyDown={e => { if (e.key === "Enter") commitEdit(af.id); if (e.key === "Escape") cancelEdit(af.id); }}
                              style={{
                                width: "100%", padding: "3px 7px", fontSize: 12, fontWeight: 500,
                                borderRadius: 6, border: `1.5px solid ${T.acc}`,
                                background: T.surfaceEl, color: T.text, fontFamily: T.font,
                              }}
                            />
                          ) : (
                            <p style={{ margin: 0, fontSize: 12.5, fontWeight: 500, color: T.text, fontFamily: T.font, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {af.displayName}
                            </p>
                          )}
                          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
                            <span style={{
                              fontSize: 9, fontWeight: 700, padding: "1px 5px", borderRadius: 3,
                              background: `${color}12`, color, textTransform: "uppercase",
                              fontFamily: T.font,
                            }}>{ext}</span>
                            <span style={{ fontSize: 10.5, color: T.textFaint, fontFamily: T.font }}>{fmtSize(af.file.size)}</span>
                          </div>
                        </div>

                        {/* "saved" pill — existing rows only, styled like "virtual" but blue */}
                        {af.isExisting && (
                          <span style={{
                            fontSize: 9.5, fontWeight: 600, padding: "1px 6px", borderRadius: 4,
                            background: "rgba(37,99,235,0.08)", color: "#1D4ED8",
                            border: "1px solid rgba(37,99,235,0.18)", fontFamily: T.font,
                            flexShrink: 0,
                          }}>saved</span>
                        )}

                        {/* Per-file progress — NEW files only (existing files never show progress) */}
                        {busy && !af.isExisting && (
                          <div style={{ flexShrink: 0, minWidth: 48, textAlign: "right" }}>
                            <span style={{ fontSize: 10, fontWeight: 600, color: done ? T.green : T.acc, fontFamily: T.font }}>
                              {done ? "✓" : `${uploadProgress}%`}
                            </span>
                            <div style={{ height: 3, width: 48, background: T.border, borderRadius: 99, overflow: "hidden", marginTop: 3 }}>
                              <div style={{ height: 3, width: `${uploadProgress}%`, background: done ? T.green : T.acc, borderRadius: 99, transition: "width .3s" }} />
                            </div>
                          </div>
                        )}

                        {/* Existing row: only Trash2 — no pencil, no progress, always visible */}
                        {af.isExisting ? (
                          <div style={{ display: "flex", alignItems: "center", gap: 2, flexShrink: 0 }}>
                            <button
                              type="button" className="fum-btn"
                              disabled={busy}
                              onClick={() => setConfirmRemove({
                                kind: "file",
                                id: af.id,
                                name: af.displayName,
                                path: af.targetPath,
                                isExisting: true,
                              })}
                              style={{ width: 24, height: 24, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", background: "none", border: "none", cursor: busy ? "not-allowed" : "pointer", color: T.textGhost }}
                              onMouseEnter={e => { if (!busy) (e.currentTarget as HTMLElement).style.color = T.red; }}
                              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = T.textGhost; }}
                            >
                              <Trash2 size={11} />
                            </button>
                          </div>
                        ) : (
                          /* New row: pencil + trash, hidden during upload */
                          !busy && (
                            <div style={{ display: "flex", alignItems: "center", gap: 2, flexShrink: 0 }}>
                              <button type="button" className="fum-btn" onClick={() => startEdit(af.id)}
                                style={{ width: 24, height: 24, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", background: "none", border: "none", cursor: "pointer", color: T.textGhost }}>
                                <Pencil size={11} />
                              </button>
                              <button type="button" className="fum-btn"
                                onClick={() => setConfirmRemove({
                                  kind: "file",
                                  id: af.id,
                                  name: af.displayName,
                                  path: af.targetPath,
                                  isExisting: false,
                                })}
                                style={{ width: 24, height: 24, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", background: "none", border: "none", cursor: "pointer", color: T.textGhost }}
                                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = T.red; }}
                                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = T.textGhost; }}>
                                <Trash2 size={11} />
                              </button>
                            </div>
                          )
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            {/* ── End scrollable body ── */}
          </div>

          {/* ⑤ Visibility Settings — OUTSIDE scroll area, always visible above footer */}
          <div style={{
            display: "flex", alignItems: "center", gap: 24, padding: "11px 20px",
            borderTop: `1px solid ${T.border}`, background: T.bg,
            flexShrink: 0,
          }}>
            <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.06em", color: T.textGhost, textTransform: "uppercase" as React.CSSProperties["textTransform"], fontFamily: T.font, flexShrink: 0 }}>
              Visibility
            </span>
            <div style={{ width: 1, height: 16, background: T.border, flexShrink: 0 }} />
            <Toggle
              checked={showToStudent}
              onChange={setShowToStudent}
              label="Show to Students"
              icon={<Eye size={11} />}
              disabled={busy}
            />
            <Toggle
              checked={allowDownload}
              onChange={setAllowDownload}
              label="Allow Download"
              icon={<Download size={11} />}
              disabled={busy}
            />
          </div>

          {/* ── Footer ── */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "10px 20px", borderTop: `1px solid ${T.border}`,
            background: T.surface, flexShrink: 0,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {hasWork && (
                <span style={{ fontSize: 11, color: T.textFaint, fontFamily: T.font }}>
                  {totalFolders > 0 && <><b style={{ color: T.acc }}>{totalFolders}</b> folder{totalFolders !== 1 ? "s" : ""} · </>}
                  <b style={{ color: T.acc }}>{totalAssigned}</b> file{totalAssigned !== 1 ? "s" : ""}
                </span>
              )}
              {!hasWork && (
                <span style={{ fontSize: 11, color: T.textGhost, fontFamily: T.font }}>
                  <kbd style={{ padding: "1px 5px", borderRadius: 4, background: T.surfaceEl, border: `1px solid ${T.border}`, fontSize: 10, fontFamily: "monospace", color: T.textFaint }}>ESC</kbd>{" "}to close
                </span>
              )}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button
                type="button"
                className="fum-btn"
                onClick={handleClose}
                disabled={busy}
                style={{
                  padding: "6px 14px", borderRadius: 7, fontSize: 12, fontWeight: 500,
                  background: T.surfaceEl, border: `1px solid ${T.border}`,
                  color: T.textSub, cursor: "pointer",
                  opacity: busy ? 0.4 : 1,
                }}
              >Cancel</button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!hasWork || busy}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "6px 16px", borderRadius: 7, fontSize: 12.5, fontWeight: 600,
                  background: hasWork ? T.acc : T.borderSub,
                  color: "#fff", border: "none", cursor: hasWork ? "pointer" : "not-allowed",
                  boxShadow: hasWork ? `0 2px 10px ${T.accGlow}` : "none",
                  transition: "background .14s, box-shadow .14s",
                  opacity: !hasWork || busy ? 0.45 : 1,
                }}
                onMouseEnter={e => { if (hasWork && !busy) (e.currentTarget as HTMLElement).style.background = T.accDark; }}
                onMouseLeave={e => { if (hasWork && !busy) (e.currentTarget as HTMLElement).style.background = T.acc; }}
              >
                <Upload size={13} strokeWidth={2} />
                {editMode ? "Save Changes" : "Upload"}
              </button>
            </div>
          </div>

        </div>
      </div>
    </>
  );
};