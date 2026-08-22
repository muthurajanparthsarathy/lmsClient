"use client";
import { getToken } from "@/lib/session";

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import axios from 'axios';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import {
  Save, Play, FolderOpen, FileCode, FileText, Folder,
  ChevronLeft, ChevronRight, Plus, Trash2,
  Download, Maximize2, Minimize2,
  Code2, Palette, Terminal, RefreshCw, CheckCircle,
  AlertCircle, Loader2, ExternalLink, FolderPlus,
  ChevronDown, Edit2, X, Search,
  FilePlus, Star, MoreVertical,
  FileJson, FileImage, Upload, Move, Copy,
  Settings, ZoomIn, ZoomOut, PanelLeftClose, PanelLeftOpen,
  SplitSquareVertical, SplitSquareHorizontal, FileSymlink,
  History, Undo, Redo, GitBranch, Bug, CheckSquare,
  BookOpen, Lightbulb, HelpCircle, Bell, User,
  Grid, List, LayoutDashboard, Copy as CopyIcon,
  Share2, Heart, Bookmark, Filter, SortAsc,
  Eye, EyeOff, Lock, Unlock, Shield,
  Upload as UploadIcon,
  Moon,
  Sun,
  Clock,
  Camera,
  Video,
  Monitor,
  ShieldAlert,
  ShieldCheck,
  LogOut,
  AlertTriangle,
  CheckCircle2,
  ArrowUpDown,
  GripVertical,
  Columns,
  MonitorPlay,
  Sidebar,
  Zap,
  MousePointerClick,
  Mic,
  MicOff,
  ArrowLeft,
  ArrowRight,
  Check,
  SkipForward
} from 'lucide-react';
import RichTextDisplay from '../RichTextDisplay';
import ExerciseInfoModals, { ExerciseInfoButtons } from './ExerciseInfoModals';

// Dynamic imports
const MonacoEditor = dynamic(() => import('@monaco-editor/react'), {
  ssr: false,
  loading: () => <div className="w-full h-full flex items-center justify-center bg-white dark:bg-[#1e1e1e]">Loading editor...</div>
});

// Enhanced Types
interface FileType {
  id: string;
  filename: string;
  content: string;
  language: 'html' | 'css' | 'javascript' | 'json' | 'text' | 'markdown' | 'xml';
  path: string;
  folderPath: string;
  isEntryPoint?: boolean;
  lastModified?: Date;
  size?: number;
  isDirty?: boolean;
}

interface FolderType {
  id: string;
  name: string;
  path: string;
  parentPath: string;
  children: string[];
  folderChildren: string[];
  isOpen?: boolean;
  depth: number;
}

interface SecuritySettings {
  timerEnabled?: boolean;
  timerType?: string;
  timerDuration?: number;
  cameraMicEnabled?: boolean;
  restrictMinimize?: boolean;
  fullScreenMode?: boolean;
  tabSwitchAllowed?: boolean;
  maxTabSwitches?: number;
  disableClipboard?: boolean;
  screenRecordingEnabled?: boolean;
}

interface FrontendCompilerProps {
  onBack: () => void;
  title: string;
  questions?: any[];
  exerciseId: string;
  courseId: string;
  category: string;
  subcategory: string;
  selectedProgrammingLanguage?: string;
  entityId: string;
  entityType: string;
  attemptLimitEnabled?: boolean;
  maxAttempts?: number;
  initialFiles?: FileType[];
  initialFolders?: FolderType[];
  isLoadingSubmission?: boolean;
  initialQuestionIndex?: number;
  security?: SecuritySettings;
  selectedLanguages?: string[];
  level: string;
  exerciseData?: any;  // ← ADD THIS
}

// --- HELPER: SWITCH ---
const ToggleSwitch = ({ checked, onChange, label }: { checked: boolean, onChange: (v: boolean) => void, label?: string }) => (
  <div className="flex items-center justify-between cursor-pointer group" onClick={() => onChange(!checked)}>
    {label && <span className="text-xs font-medium text-gray-600 group-hover:text-gray-800 transition-colors">{label}</span>}
    <div className={`w-10 h-5 flex items-center rounded-full p-1 duration-300 ease-in-out ${checked ? 'bg-blue-600' : 'bg-gray-300'}`}>
      <div className={`bg-white w-3.5 h-3.5 rounded-full shadow-md transform duration-300 ease-in-out ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
    </div>
  </div>
);

// --- SECURITY AGREEMENT MODAL ---
const SecurityAgreementModal = ({
  isOpen,
  onAgree,
  onCancel,
  securitySettings,
  theme = "light"
}: {
  isOpen: boolean;
  onAgree: () => void;
  onCancel: () => void;
  securitySettings: SecuritySettings;
  theme?: "light" | "dark";
}) => {
  if (!isOpen) return null;

  const themeClasses = theme === 'dark'
    ? 'bg-gray-900 text-white border-gray-700'
    : 'bg-white text-gray-900 border-gray-300';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className={`w-full max-w-lg rounded-xl shadow-2xl border p-6 ${themeClasses}`}>
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
            <ShieldCheck className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold">Assessment Security Agreement</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">Please review and agree to the security measures</p>
          </div>
        </div>

        <div className="space-y-4 mb-6">
          <div className={`p-4 rounded-lg ${theme === 'dark' ? 'bg-gray-800' : 'bg-gray-50'}`}>
            <h3 className="font-semibold mb-2 flex items-center gap-2">
              <Monitor className="w-4 h-4" /> Security Features
            </h3>
            <ul className="space-y-2 text-sm">
              {securitySettings.timerEnabled ? (
                <li className="flex items-center gap-2">
                  <Clock className="w-3 h-3 text-blue-500" />
                  <span>Timed Assessment: {securitySettings.timerDuration || 60} minutes</span>
                </li>
              ) : (
                <li className="flex items-center gap-2 text-gray-400">
                  <Clock className="w-3 h-3" />
                  <span>Timed Assessment: Disabled</span>
                </li>
              )}

              {securitySettings.fullScreenMode ? (
                <li className="flex items-center gap-2">
                  <Maximize2 className="w-3 h-3 text-purple-500" />
                  <span>Full Screen Mode Required</span>
                </li>
              ) : (
                <li className="flex items-center gap-2 text-gray-400">
                  <Maximize2 className="w-3 h-3" />
                  <span>Full Screen Mode: Optional</span>
                </li>
              )}

              {securitySettings.cameraMicEnabled ? (
                <li className="flex items-center gap-2">
                  <Camera className="w-3 h-3 text-green-500" />
                  <span>Camera & Microphone Monitoring</span>
                </li>
              ) : (
                <li className="flex items-center gap-2 text-gray-400">
                  <Camera className="w-3 h-3" />
                  <span>Camera & Microphone: Disabled</span>
                </li>
              )}

              {securitySettings.screenRecordingEnabled ? (
                <li className="flex items-center gap-2">
                  <Video className="w-3 h-3 text-red-500" />
                  <span>Screen Recording Active</span>
                </li>
              ) : (
                <li className="flex items-center gap-2 text-gray-400">
                  <Video className="w-3 h-3" />
                  <span>Screen Recording: Disabled</span>
                </li>
              )}

              {securitySettings.tabSwitchAllowed === false ? (
                <li className="flex items-center gap-2">
                  <Lock className="w-3 h-3 text-yellow-500" />
                  <span>Tab Switching Restricted</span>
                </li>
              ) : (
                <li className="flex items-center gap-2 text-gray-400">
                  <Lock className="w-3 h-3" />
                  <span>Tab Switching: Allowed</span>
                </li>
              )}

              {securitySettings.disableClipboard ? (
                <li className="flex items-center gap-2">
                  <AlertTriangle className="w-3 h-3 text-orange-500" />
                  <span>Copy/Paste Disabled</span>
                </li>
              ) : (
                <li className="flex items-center gap-2 text-gray-400">
                  <AlertTriangle className="w-3 h-3" />
                  <span>Copy/Paste: Allowed</span>
                </li>
              )}
            </ul>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className={`flex-1 py-2.5 px-4 rounded-lg font-medium border transition-colors ${theme === 'dark'
              ? 'border-gray-700 text-gray-300 hover:bg-gray-800'
              : 'border-gray-300 text-gray-700 hover:bg-gray-100'}`}
          >
            Cancel Assessment
          </button>
          <button
            onClick={onAgree}
            className="flex-1 py-2.5 px-4 rounded-lg font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
          >
            <ShieldCheck className="w-4 h-4" />
            I Understand & Agree
          </button>
        </div>
      </div>
    </div>
  );
};

// --- SUBMISSION SUCCESS MODAL ---
const SubmissionSuccessModal = ({
  isOpen,
  onConfirm,
  theme = "light"
}: {
  isOpen: boolean;
  onConfirm: () => void;
  theme?: "light" | "dark";
}) => {
  if (!isOpen) return null;

  const themeClasses = theme === 'dark'
    ? 'bg-gray-900 text-white border-gray-700'
    : 'bg-white text-gray-900 border-gray-300';

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className={`w-full max-w-md rounded-xl shadow-2xl border p-6 ${themeClasses}`}>
        <div className="flex flex-col items-center text-center gap-4 mb-6">
          <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
            <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <h2 className="text-2xl font-bold mb-2">Assessment Submitted Successfully!</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Your assessment has been submitted. You will be redirected to the course page.
            </p>
          </div>
        </div>

        <div className={`mb-6 p-4 rounded-lg ${theme === 'dark' ? 'bg-gray-800' : 'bg-gray-50'}`}>
          <h4 className="font-semibold mb-2 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" /> What happens next?
          </h4>
          <ul className="text-sm space-y-2">
            <li className="flex items-start gap-2">
              <div className="mt-0.5">✓</div>
              <span>All your answers have been saved</span>
            </li>
            <li className="flex items-start gap-2">
              <div className="mt-0.5">✓</div>
              <span>Recording has been stopped</span>
            </li>
            <li className="flex items-start gap-2">
              <div className="mt-0.5">✓</div>
              <span>Security monitoring has ended</span>
            </li>
            <li className="flex items-start gap-2">
              <div className="mt-0.5">✓</div>
              <span>You will be redirected automatically in 3 seconds...</span>
            </li>
          </ul>
        </div>

        <button
          onClick={onConfirm}
          className="w-full py-3 px-4 rounded-lg font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
        >
          <span>Continue to Course Now</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

// --- CLOUDINARY CONFIG ---
const CLOUDINARY_CLOUD_NAME = "dusxfgvhi";
const CLOUDINARY_UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/video/upload`;
const CLOUDINARY_PRESET = "dusxfgvhi";

const FrontendCompiler: React.FC<FrontendCompilerProps> = ({
  onBack,
  title,
  questions = [],
  exerciseId,
  courseId,
  category,
  subcategory,
  selectedProgrammingLanguage,
  entityId,
  entityType,
  attemptLimitEnabled = false,
  maxAttempts = 3,
  initialFiles,
  initialFolders,
  isLoadingSubmission = false,
  initialQuestionIndex = 0,
  security = {},
  selectedLanguages = [],
  level,
  exerciseData,  // ← ADD THIS
}) => {
  const router = useRouter();

  // ─── selectedLanguages → allowed file extensions ───────────────────────────
  // The exercise config (programmingSettings.selectedLanguages) caps which file
  // types a student can create. If selectedLanguages is empty/undefined, allow
  // the default html/css/js trio. Extensions like .json / .md / .txt / .xml are
  // always allowed (auxiliary files).
  const { allowedExtensions, allowedLanguageLabels } = useMemo(() => {
    const langs = (Array.isArray(selectedLanguages) ? selectedLanguages : [])
      .map(l => String(l).toLowerCase().trim())
      .filter(Boolean);

    const langToExts: Record<string, string[]> = {
      html: ['html', 'htm'],
      css: ['css'],
      javascript: ['js', 'javascript', 'jsx'],
      js: ['js', 'javascript', 'jsx'],
      typescript: ['ts', 'tsx'],
      ts: ['ts', 'tsx'],
    };
    const langToLabel: Record<string, string> = {
      html: 'HTML', css: 'CSS', javascript: 'JavaScript', js: 'JavaScript',
      typescript: 'TypeScript', ts: 'TypeScript',
    };

    // Always allow auxiliary files alongside whatever languages are enabled
    const auxiliary = ['json', 'md', 'markdown', 'txt', 'xml'];

    if (langs.length === 0) {
      // No restriction configured → default behaviour (allow all three)
      return {
        allowedExtensions: new Set(['html', 'htm', 'css', 'js', 'javascript', 'jsx', ...auxiliary]),
        allowedLanguageLabels: ['HTML', 'CSS', 'JavaScript'] as string[],
      };
    }

    const exts = new Set<string>(auxiliary);
    const labels = new Set<string>();
    for (const l of langs) {
      (langToExts[l] || []).forEach(e => exts.add(e));
      if (langToLabel[l]) labels.add(langToLabel[l]);
    }
    return {
      allowedExtensions: exts,
      allowedLanguageLabels: Array.from(labels),
    };
  }, [selectedLanguages]);

  // Returns { ok: true } when the filename's extension is permitted, else
  // { ok: false, message } describing why and what is allowed.
  const checkExtensionAllowed = (filename: string): { ok: true } | { ok: false; message: string } => {
    const trimmed = (filename || '').trim();
    if (!trimmed) return { ok: false, message: 'Please enter a file name.' };
    if (!trimmed.includes('.')) {
      return {
        ok: false,
        message: `Filename needs an extension. This exercise allows: ${allowedLanguageLabels.join(', ')}.`,
      };
    }
    const ext = trimmed.split('.').pop()!.toLowerCase();
    if (allowedExtensions.has(ext)) return { ok: true };
    return {
      ok: false,
      message: `.${ext} files are not allowed for this exercise. Allowed: ${allowedLanguageLabels.join(', ')}.`,
    };
  };
  // Add these state variables for collapsible sections
  const [isExplorerCollapsed, setIsExplorerCollapsed] = useState(false);
  const [isEditorCollapsed, setIsEditorCollapsed] = useState(false);
  const [isPreviewCollapsed, setIsPreviewCollapsed] = useState(false);
  const [explorerWidth, setExplorerWidth] = useState(260);
  const [isResizingExplorer, setIsResizingExplorer] = useState(false);
  const [isResizingPreview, setIsResizingPreview] = useState(false);
  const [isTestSubmitted, setIsTestSubmitted] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);   // ← ADD
  const [showOverviewModal, setShowOverviewModal] = useState(false); // ← ADD
  const explorerStartXRef = useRef(0);
  const explorerStartWidthRef = useRef(260);
  const previewStartXRef = useRef(0);
  const previewStartWidthRef = useRef(50);
  // Log initial props
  console.log("FrontendCompiler props:", {
    hasInitialFiles: !!initialFiles,
    initialFilesCount: initialFiles?.length || 0,
    hasInitialFolders: !!initialFolders,
    initialFoldersCount: initialFolders?.length || 0,
    isLoadingSubmission,
    courseId,
    exerciseId,
    category
  });
  // Handle explorer resize start
  const handleExplorerResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizingExplorer(true);
    explorerStartXRef.current = e.clientX;
    explorerStartWidthRef.current = explorerWidth;
  };

  // Handle explorer resize move
  useEffect(() => {
    const handleExplorerResizeMove = (e: MouseEvent) => {
      if (!isResizingExplorer) return;

      const delta = e.clientX - explorerStartXRef.current;
      const newWidth = Math.min(Math.max(180, explorerStartWidthRef.current + delta), 400);
      setExplorerWidth(newWidth);
    };

    const handleExplorerResizeEnd = () => {
      setIsResizingExplorer(false);
    };

    if (isResizingExplorer) {
      document.addEventListener('mousemove', handleExplorerResizeMove);
      document.addEventListener('mouseup', handleExplorerResizeEnd);
      document.body.style.cursor = 'ew-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleExplorerResizeMove);
      document.removeEventListener('mouseup', handleExplorerResizeEnd);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizingExplorer]);

  // Handle preview resize start
  const handlePreviewResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizingPreview(true);
    previewStartXRef.current = e.clientX;
    previewStartWidthRef.current = previewWidth;
  };

  // Handle preview resize move
  useEffect(() => {
    const handlePreviewResizeMove = (e: MouseEvent) => {
      if (!isResizingPreview) return;

      const containerWidth = document.querySelector('.main-content-container')?.clientWidth || window.innerWidth;
      const delta = (e.clientX - previewStartXRef.current) / containerWidth * 100;
      const newWidth = Math.min(Math.max(30, previewStartWidthRef.current + delta), 70);
      setPreviewWidth(newWidth);
    };

    const handlePreviewResizeEnd = () => {
      setIsResizingPreview(false);
    };

    if (isResizingPreview) {
      document.addEventListener('mousemove', handlePreviewResizeMove);
      document.addEventListener('mouseup', handlePreviewResizeEnd);
      document.body.style.cursor = 'ew-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handlePreviewResizeMove);
      document.removeEventListener('mouseup', handlePreviewResizeEnd);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizingPreview]);
  // ---------------------------------------------------------------------------
  // 1. SECURITY & MODE CHECK
  // ---------------------------------------------------------------------------
  // We Do component — security/assessment mode never runs here. Only the YouDo
  // frontendCompiler (under YouDo/assessment/components) runs proctoring.
  const isAssessmentMode = false;


  const handleFinalSubmit = async () => {
    if (isTestSubmitted || isSubmitting) return;
    setIsSubmitting(true);

    try {
      const token = getToken() || localStorage.getItem('token') || '';

      // First save current question's files
      const questionId = getQuestionId();
      if (courseId && exerciseId && questionId) {
        const savePayload = {
          courseId,
          exerciseId,
          questionId,
          questionTitle: currentQuestion?.title || `Question ${currentQuestionIndex + 1}`,
          exerciseName: title,
          category,
          subcategory,
          selectedProgrammingLanguage: selectedProgrammingLanguage || 'html/css/javascript',
          nodeId: entityId,
          nodeName: title,
          nodeType: entityType,
          files: files.map(file => ({
            id: file.id,
            filename: file.filename,
            content: file.content,
            language: file.language,
            path: file.path,
            folderPath: file.folderPath,
            isEntryPoint: file.isEntryPoint || false,
            lastModified: file.lastModified || new Date()
          })),
          folders: folders.map(folder => ({
            id: folder.id,
            name: folder.name,
            path: folder.path,
            parentPath: folder.parentPath,
            depth: folder.depth
          })),
          status: 'submitted',
          score: 0,
          attemptCount: (userAttempts[questionId] || 0) + 1,
          isTestSubmission: true,  // ← marks testSubmissions++
        };

        await axios.post(
          'https://lmsserver-yeve.onrender.com/courses/answers/submit-multiple-files',
          savePayload,
          {
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            timeout: 30000
          }
        );
      }

      setIsTestSubmitted(true);
      try { sessionStorage.setItem('lms_submit_toast', `"${title}" submitted successfully`); } catch {}
      setTimeout(() => { performExit(); }, 800);

    } catch (error: any) {
      console.error('Final submit error:', error);
      toast.error(`❌ Submission failed: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };



  const activeSecurity = useMemo(() => {
    if (!isAssessmentMode) {
      return {
        timerEnabled: false,
        cameraMicEnabled: false,
        restrictMinimize: false,
        fullScreenMode: false,
        tabSwitchAllowed: true,
        disableClipboard: false,
        maxTabSwitches: 9999,
        screenRecordingEnabled: false
      };
    }
    return {
      timerEnabled: security.timerEnabled,
      cameraMicEnabled: security.cameraMicEnabled,
      restrictMinimize: security.restrictMinimize,
      fullScreenMode: security.fullScreenMode,
      tabSwitchAllowed: security.tabSwitchAllowed,
      maxTabSwitches: security.maxTabSwitches || 3,
      disableClipboard: security.disableClipboard,
      screenRecordingEnabled: security.screenRecordingEnabled || false
    };
  }, [isAssessmentMode, security]);

  const activeAttemptLimit = isAssessmentMode ? attemptLimitEnabled : false;

  // Theme state
  const [theme, setTheme] = useState<'vs-dark' | 'light'>('light');

  // Light mode colors
  const lightColors = {
    background: '#ffffff',
    sidebar: '#f3f3f3',
    activityBar: '#e4e4e4',
    editorGroup: '#ffffff',
    tabActive: '#ffffff',
    tabInactive: '#f5f5f5',
    border: '#d4d4d4',
    text: '#333333',
    textSecondary: '#666666',
    primary: '#007acc',
    success: '#4ec9b0',
    warning: '#dcdcaa',
    error: '#f48771',
    info: '#9cdcfe',
    accent: '#4ec9b0',
    hoverBg: '#e5e5e5',
    selectedBg: '#e3f2fd',
    statusBar: '#e4e4e4'
  };

  // Dark mode colors
  const darkColors = {
    background: '#1e1e1e',
    sidebar: '#252526',
    activityBar: '#333333',
    editorGroup: '#1e1e1e',
    tabActive: '#2d2d30',
    tabInactive: '#2d2d2d',
    border: '#3e3e42',
    text: '#cccccc',
    textSecondary: '#858585',
    primary: '#007acc',
    success: '#4ec9b0',
    warning: '#dcdcaa',
    error: '#f48771',
    info: '#9cdcfe',
    accent: '#4ec9b0',
    hoverBg: '#2a2d2e',
    selectedBg: '#094771',
    statusBar: '#007acc'
  };

  // Use colors based on theme
  const colors = theme === 'light' ? lightColors : darkColors;



  // Add this new component before the FrontendCompiler component

  // --- QUESTION SIDEBAR COMPONENT WITH EXPAND/COLLAPSE ---
  const QuestionSidebar = ({
    isOpen,
    onClose,
    question,
    currentIndex,
    totalQuestions,
    onNavigate,
    theme = "light"
  }: {
    isOpen: boolean;
    onClose: () => void;
    question: any;
    currentIndex: number;
    totalQuestions: number;
    onNavigate: (direction: 'prev' | 'next') => void;
    theme?: "light" | "dark";
  }) => {
    const [sidebarWidth, setSidebarWidth] = useState(384); // 96 * 4 = 384px (w-96)
    const [isResizing, setIsResizing] = useState(false);
    const [isCollapsed, setIsCollapsed] = useState(false);
    const startXRef = useRef(0);
    const startWidthRef = useRef(384);

    if (!isOpen) return null;

    const themeClasses = theme === 'dark'
      ? 'bg-gray-900 text-white border-gray-700'
      : 'bg-white text-gray-900 border-gray-300';

    const [modalImage, setModalImage] = useState<{ url: string; alt: string } | null>(null);

    // Add this useEffect to expose the openImageModal function globally
    useEffect(() => {
      // Expose the function globally so images can call it
      (window as any).openImageModal = (url: string, alt: string) => {
        setModalImage({ url, alt });
      };

      return () => {
        delete (window as any).openImageModal;
      };
    }, []);

    // Add this useEffect to handle Escape key to close modal
    useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape' && modalImage) {
          setModalImage(null);
        }
      };

      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }, [modalImage]);

    const ImageModal = ({ image, onClose }: { image: { url: string; alt: string } | null; onClose: () => void }) => {
      useEffect(() => {
        document.body.style.overflow = image ? 'hidden' : 'unset';
        return () => { document.body.style.overflow = 'unset'; };
      }, [image]);

      if (!image) return null;

      return (
        <div
          className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={onClose}
        >
          <div
            className="relative flex flex-col rounded-xl shadow-2xl border overflow-hidden"
            style={{
              width: '560px',
              height: '500px',
              maxWidth: '90vw',
              maxHeight: '85vh',
              backgroundColor: theme === 'vs-dark' ? '#1e1e1e' : '#ffffff',
              borderColor: theme === 'vs-dark' ? '#3e3e42' : '#d4d4d4'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-4 py-2.5 border-b flex-shrink-0"
              style={{
                height: '42px',
                backgroundColor: theme === 'vs-dark' ? '#2d2d30' : '#f3f3f3',
                borderColor: theme === 'vs-dark' ? '#3e3e42' : '#d4d4d4'
              }}
            >
              <span className="text-xs font-semibold truncate" style={{ color: colors.text }}>
                🖼️ {image.alt || 'Question Image'}
              </span>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <button
                  onClick={() => window.open(image.url, '_blank')}
                  className="h-6 px-2 text-2xs rounded flex items-center gap-1 transition-colors"
                  style={{ backgroundColor: colors.hoverBg, color: colors.text }}
                >
                  <Maximize2 size={10} />
                  Full
                </button>
                <button
                  onClick={onClose}
                  className="h-6 w-6 flex items-center justify-center rounded transition-colors hover:bg-red-100"
                  style={{ color: colors.textSecondary }}
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            {/* Scrollable Image Area */}
            <div
              className="flex-1 overflow-auto flex items-center justify-center"
              style={{
                height: 'calc(500px - 42px)',
                backgroundColor: theme === 'vs-dark' ? '#141414' : '#f0f0f0'
              }}
            >
              <img
                src={image.url}
                alt={image.alt}
                style={{
                  maxWidth: '100%',
                  maxHeight: '100%',
                  width: 'auto',
                  height: 'auto',
                  objectFit: 'contain',
                  borderRadius: '4px',
                  display: 'block'
                }}
              />
            </div>
          </div>
        </div>
      );
    };
    // Helper function to render description blocks with clickable images
    const renderDescriptionBlocks = (description: any): string => {
      if (!description) return 'No description provided';

      // Escape HTML helper
      const escapeHtml = (text: string): string => {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
      };

      // If description is a string
      if (typeof description === 'string') {
        return `<div class="text-block">${escapeHtml(description)}</div>`;
      }

      // If description has contentBlocks array
      if (Array.isArray(description.contentBlocks)) {
        return description.contentBlocks.map((block: any) => {
          if (block.type === 'text') {
            return `<div class="text-block">${escapeHtml(block.value || '')}</div>`;
          }
          if (block.type === 'code') {
            const escaped = (block.value || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            const bgColor = block.bgColor || '#f5f5f5';
            return `<pre style="background:${bgColor};border-radius:8px;padding:10px 14px;font-size:12px;font-family:ui-monospace,monospace;overflow-x:auto;line-height:1.6;margin:6px 0"><code>${escaped}</code></pre>`;
          }
          if (block.type === 'image') {
            const alignMap: { [key: string]: string } = { 'left': 'flex-start', 'center': 'center', 'right': 'flex-end' };
            const justifyContent = alignMap[block.alignment] || 'flex-start';
            const maxWidth = block.sizePercent || 100;
            return `<div style="display:flex;justify-content:${justifyContent};margin:6px 0">
                  <img src="${block.url}" alt="" style="max-width:${maxWidth}%;border-radius:8px;border:1px solid #e4e4ed;cursor:pointer" 
                       onclick="window.openImageModal('${block.url}', 'Question Image')" />
                </div>`;
          }
          return '';
        }).join('');
      }

      // If description has text array
      if (Array.isArray(description.text)) {
        return description.text.map((block: any) => {
          if (block.type === 'text') {
            return `<div class="text-block">${escapeHtml(block.value || '')}</div>`;
          }
          if (block.type === 'code') {
            const escaped = (block.value || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            const bgColor = block.bgColor || '#f5f5f5';
            return `<pre style="background:${bgColor};border-radius:8px;padding:10px 14px;font-size:12px;font-family:ui-monospace,monospace;overflow-x:auto;line-height:1.6;margin:6px 0"><code>${escaped}</code></pre>`;
          }
          if (block.type === 'image') {
            const alignMap: { [key: string]: string } = { 'left': 'flex-start', 'center': 'center', 'right': 'flex-end' };
            const justifyContent = alignMap[block.alignment] || 'flex-start';
            const maxWidth = block.sizePercent || 100;
            return `<div style="display:flex;justify-content:${justifyContent};margin:6px 0">
                  <img src="${block.url}" alt="" style="max-width:${maxWidth}%;border-radius:8px;border:1px solid #e4e4ed;cursor:pointer" 
                       onclick="window.openImageModal('${block.url}', 'Question Image')" />
                </div>`;
          }
          return '';
        }).join('');
      }

      // If description is an object with text string
      if (typeof description.text === 'string') {
        let html = `<div class="text-block">${escapeHtml(description.text)}</div>`;
        if (description.imageUrl) {
          const alignMap: { [key: string]: string } = { 'left': 'flex-start', 'center': 'center', 'right': 'flex-end' };
          const justifyContent = alignMap[description.imageAlignment] || 'flex-start';
          const maxWidth = description.imageSizePercent || 100;
          html += `<div style="display:flex;justify-content:${justifyContent};margin:6px 0">
                <img src="${description.imageUrl}" style="max-width:${maxWidth}%;border-radius:8px;border:1px solid #e4e4ed;cursor:pointer" 
                     onclick="window.openImageModal('${description.imageUrl}', 'Question Image')" />
              </div>`;
        }
        return html;
      }

      // Fallback
      return '<div>No description provided</div>';
    };
    const getDifficultyColor = (difficulty: string) => {
      switch (difficulty?.toLowerCase()) {
        case 'easy': return 'text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-900/30';
        case 'medium': return 'text-yellow-600 bg-yellow-100 dark:text-yellow-400 dark:bg-yellow-900/30';
        case 'hard': return 'text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-900/30';
        default: return 'text-gray-600 bg-gray-100 dark:text-gray-400 dark:bg-gray-800';
      }
    };

    // Handle resize start
    const handleResizeStart = (e: React.MouseEvent) => {
      e.preventDefault();
      setIsResizing(true);
      startXRef.current = e.clientX;
      startWidthRef.current = sidebarWidth;
    };

    // Handle resize move
    useEffect(() => {
      const handleResizeMove = (e: MouseEvent) => {
        if (!isResizing) return;

        const delta = startXRef.current - e.clientX;
        const newWidth = Math.min(Math.max(280, startWidthRef.current + delta), 600);
        setSidebarWidth(newWidth);
      };

      const handleResizeEnd = () => {
        setIsResizing(false);
      };

      if (isResizing) {
        document.addEventListener('mousemove', handleResizeMove);
        document.addEventListener('mouseup', handleResizeEnd);
        document.body.style.cursor = 'ew-resize';
        document.body.style.userSelect = 'none';
      }

      return () => {
        document.removeEventListener('mousemove', handleResizeMove);
        document.removeEventListener('mouseup', handleResizeEnd);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };
    }, [isResizing]);

    // Toggle collapse
    const toggleCollapse = () => {
      setIsCollapsed(!isCollapsed);
    };

    return (
      <>
        {/* Resize Handle (only when not collapsed) */}
        {!isCollapsed && (
          <div
            className="fixed left-0 top-0 bottom-0 w-1 cursor-ew-resize hover:bg-blue-500 transition-colors z-50"
            style={{
              left: `${sidebarWidth - 2}px`,
              backgroundColor: isResizing ? '#007acc' : 'transparent',
            }}
            onMouseDown={handleResizeStart}
          />
        )}

        {/* Sidebar Content */}
        <div
          className="fixed inset-y-0 right-0 shadow-2xl border-l transform transition-all duration-300 ease-in-out z-50 overflow-hidden flex flex-col"
          style={{
            width: isCollapsed ? '48px' : `${sidebarWidth}px`,
            backgroundColor: theme === 'dark' ? '#1e1e1e' : '#ffffff',
            borderColor: theme === 'dark' ? '#3e3e42' : '#d4d4d4',
            boxShadow: '-4px 0 15px rgba(0, 0, 0, 0.1)',
            transition: 'width 0.3s ease-in-out'
          }}
        >
          {/* Header with Collapse Toggle */}
          <div className="flex items-center justify-between p-3 border-b flex-shrink-0" style={{
            borderColor: theme === 'dark' ? '#3e3e42' : '#d4d4d4',
            backgroundColor: theme === 'dark' ? '#2d2d30' : '#f3f3f3'
          }}>
            {!isCollapsed ? (
              <>
                <div className="flex items-center gap-2">
                  <BookOpen size={18} className={theme === 'dark' ? 'text-blue-400' : 'text-blue-600'} />
                  <h2 className="font-semibold" style={{ color: theme === 'dark' ? '#ffffff' : '#333333' }}>
                    Question {currentIndex + 1}
                  </h2>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={toggleCollapse}
                    className="p-1.5 hover:bg-[#d5d5d5] dark:hover:bg-[#3e3e42] rounded transition-colors"
                    style={{ color: theme === 'dark' ? '#858585' : '#666666' }}
                    title="Collapse Sidebar"
                  >
                    <ChevronRight size={16} />
                  </button>
                  <button
                    onClick={onClose}
                    className="p-1.5 hover:bg-[#d5d5d5] dark:hover:bg-[#3e3e42] rounded transition-colors"
                    style={{ color: theme === 'dark' ? '#858585' : '#666666' }}
                    title="Close Sidebar"
                  >
                    <X size={16} />
                  </button>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center w-full gap-3">
                <button
                  onClick={toggleCollapse}
                  className="p-2 hover:bg-[#d5d5d5] dark:hover:bg-[#3e3e42] rounded transition-colors"
                  style={{ color: theme === 'dark' ? '#858585' : '#666666' }}
                  title="Expand Sidebar"
                >
                  <ChevronLeft size={18} />
                </button>
                <div className="text-xs font-medium transform -rotate-90 whitespace-nowrap" style={{ color: theme === 'dark' ? '#858585' : '#666666' }}>
                  Q{currentIndex + 1}/{totalQuestions}
                </div>
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-[#d5d5d5] dark:hover:bg-[#3e3e42] rounded transition-colors mt-auto"
                  style={{ color: theme === 'dark' ? '#858585' : '#666666' }}
                  title="Close Sidebar"
                >
                  <X size={16} />
                </button>
              </div>
            )}
          </div>

          {/* Content - Only show when not collapsed */}
          {!isCollapsed && (
            <>
              <div className="overflow-y-auto flex-1 p-4" style={{
                backgroundColor: theme === 'dark' ? '#1e1e1e' : '#ffffff',
                color: theme === 'dark' ? '#cccccc' : '#333333'
              }}>
                {/* Question Title */}
                {question?.title && (
                  <div className="mb-4">
                    <h3 className="text-sm font-medium mb-2" style={{ color: theme === 'dark' ? '#858585' : '#666666' }}>
                      Title
                    </h3>
                    <p className="text-base font-semibold">{question.title}</p>
                  </div>
                )}

                {/* Metadata Badges */}
                <div className="flex flex-wrap gap-2 mb-4">
                  {question?.difficulty && (
                    <span className={`text-xs px-2 py-1 rounded-full ${getDifficultyColor(question.difficulty)}`}>
                      {question.difficulty}
                    </span>
                  )}
                  {question?.score && (
                    <span className="text-xs px-2 py-1 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                      Mark: {question.score}
                    </span>
                  )}
                </div>

                {/* Description */}
                {/* Description */}
                {question?.description && (
                  <div className="mb-4">
                    <h3 className="text-sm font-medium mb-2" style={{ color: theme === 'dark' ? '#858585' : '#666666' }}>
                      Description
                    </h3>
                    <RichTextDisplay
                      content={question.description.text?.[0]?.value || question.description.text?.[0]?.value || ''}
                      className="text-sm whitespace-pre-wrap"
                    />
                  </div>
                )}

                {/* Sample Input/Output */}
                {(question?.sampleInput || question?.sampleOutput) && (
                  <div className="mb-4">
                    <h3 className="text-sm font-medium mb-2" style={{ color: theme === 'dark' ? '#858585' : '#666666' }}>
                      Sample
                    </h3>
                    {question.sampleInput && (
                      <div className="mb-2">
                        <div className="text-xs font-medium mb-1" style={{ color: theme === 'dark' ? '#858585' : '#666666' }}>
                          Input:
                        </div>
                        <pre className="p-2 rounded text-xs font-mono" style={{
                          backgroundColor: theme === 'dark' ? '#2d2d30' : '#f5f5f5',
                          border: `1px solid ${theme === 'dark' ? '#3e3e42' : '#e0e0e0'}`
                        }}>
                          {question.sampleInput}
                        </pre>
                      </div>
                    )}
                    {question.sampleOutput && (
                      <div>
                        <div className="text-xs font-medium mb-1" style={{ color: theme === 'dark' ? '#858585' : '#666666' }}>
                          Output:
                        </div>
                        <pre className="p-2 rounded text-xs font-mono" style={{
                          backgroundColor: theme === 'dark' ? '#2d2d30' : '#f5f5f5',
                          border: `1px solid ${theme === 'dark' ? '#3e3e42' : '#e0e0e0'}`
                        }}>
                          {question.sampleOutput}
                        </pre>
                      </div>
                    )}
                  </div>
                )}

                {/* Constraints */}
                {question?.constraints && question.constraints.length > 0 && (
                  <div className="mb-4">
                    <h3 className="text-sm font-medium mb-2" style={{ color: theme === 'dark' ? '#858585' : '#666666' }}>
                      Constraints
                    </h3>
                    <ul className="list-disc pl-5 space-y-1 text-sm">
                      {question.constraints.map((constraint: string, index: number) => (
                        <li key={index}>{constraint}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Hints */}
                {question?.hints && question.hints.length > 0 && (
                  <div className="mb-4">
                    <h3 className="text-sm font-medium mb-2 flex items-center gap-1">
                      <Lightbulb size={14} className="text-yellow-500" />
                      <span style={{ color: theme === 'dark' ? '#858585' : '#666666' }}>Hints ({question.hints.length})</span>
                    </h3>
                    <ul className="space-y-2">
                      {question.hints.map((hint: any, index: number) => {
                        let hintText = '';
                        let isPublic = true;
                        let pointsDeduction = 0;

                        if (typeof hint === 'object') {
                          hintText = hint.hintText || '';
                          isPublic = hint.isPublic !== undefined ? hint.isPublic : true;
                          pointsDeduction = hint.pointsDeduction || 0;
                        } else {
                          hintText = hint;
                        }

                        if (!isPublic) return null;

                        return (
                          <li key={index} className="text-sm p-3 rounded" style={{
                            backgroundColor: theme === 'dark' ? '#2d2d30' : '#fff9e6',
                            border: `1px solid ${theme === 'dark' ? '#3e3e42' : '#ffd700'}`
                          }}>
                            <div className="flex items-start gap-2">
                              <span className="text-yellow-500">💡</span>
                              <div className="flex-1">
                                <div className="mb-1">{hintText}</div>
                                {pointsDeduction > 0 && (
                                  <div className="text-xs mt-1" style={{ color: theme === 'dark' ? '#858585' : '#999' }}>
                                    Points deduction: {pointsDeduction}
                                  </div>
                                )}
                              </div>
                            </div>
                          </li>
                        );
                      })}

                      {question.hints.filter((h: any) => typeof h === 'object' ? h.isPublic : true).length === 0 && (
                        <li className="text-sm p-2 text-center italic" style={{ color: theme === 'dark' ? '#858585' : '#999' }}>
                          No public hints available
                        </li>
                      )}
                    </ul>
                  </div>
                )}

                {/* Test Cases Info */}
                {question?.testCases && question.testCases.length > 0 && (
                  <div className="mb-4">
                    <h3 className="text-sm font-medium mb-2" style={{ color: theme === 'dark' ? '#858585' : '#666666' }}>
                      Test Cases ({question.testCases.length})
                    </h3>
                    <div className="space-y-2">
                      {question.testCases.slice(0, 3).map((testCase: any, index: number) => (
                        <div key={index} className="text-xs p-2 rounded" style={{
                          backgroundColor: theme === 'dark' ? '#2d2d30' : '#f5f5f5',
                          border: `1px solid ${theme === 'dark' ? '#3e3e42' : '#e0e0e0'}`
                        }}>
                          <div className="font-medium mb-1">Test {index + 1}</div>
                          <div>Input: {testCase.input || 'N/A'}</div>
                          <div>Expected: {testCase.expectedOutput || 'N/A'}</div>
                        </div>
                      ))}
                      {question.testCases.length > 3 && (
                        <div className="text-xs text-center mt-1" style={{ color: theme === 'dark' ? '#858585' : '#666666' }}>
                          +{question.testCases.length - 3} more test cases
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Empty State */}
                {!question && (
                  <div className="text-center py-8" style={{ color: theme === 'dark' ? '#858585' : '#666666' }}>
                    <BookOpen size={48} className="mx-auto mb-3 opacity-30" />
                    <p>No question details available</p>
                  </div>
                )}
              </div>

              {/* Footer with Navigation */}
              <div className="flex-shrink-0 p-4 border-t" style={{
                borderColor: theme === 'dark' ? '#3e3e42' : '#d4d4d4',
                backgroundColor: theme === 'dark' ? '#2d2d30' : '#f3f3f3'
              }}>
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => onNavigate('prev')}
                    disabled={currentIndex === 0}
                    className="flex items-center gap-1 px-3 py-1.5 rounded text-sm disabled:opacity-50 transition-colors hover:bg-[#d5d5d5] dark:hover:bg-[#3e3e42]"
                    style={{ color: theme === 'dark' ? '#cccccc' : '#333333' }}
                  >
                    <ChevronLeft size={14} />
                    Previous
                  </button>
                  <span className="text-xs" style={{ color: theme === 'dark' ? '#858585' : '#666666' }}>
                    {currentIndex + 1} / {totalQuestions}
                  </span>
                  <button
                    onClick={() => onNavigate('next')}
                    disabled={currentIndex === totalQuestions - 1}
                    className="flex items-center gap-1 px-3 py-1.5 rounded text-sm disabled:opacity-50 transition-colors hover:bg-[#d5d5d5] dark:hover:bg-[#3e3e42]"
                    style={{ color: theme === 'dark' ? '#cccccc' : '#333333' }}
                  >
                    Next
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Image Modal */}
        <ImageModal
          image={modalImage}
          onClose={() => setModalImage(null)}
          theme={theme}
        />
      </>
    );
  };
  // Default files (used when no previous submission exists)
  const defaultFiles: FileType[] = [
    {
      id: 'file-1-index-html',
      filename: 'index.html',
      content: `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>My Project</title>
    <link rel="stylesheet" href="styles.css">
</head>
<body>
    <div class="container">
        <header class="header">
            <h1>Welcome to Your Project</h1>
            <p class="subtitle">Start building your amazing project here!</p>
        </header>
        
        <main class="content">
            <section class="card">
                <h2>Getting Started</h2>
                <p>Edit the HTML, CSS, and JavaScript files to create your project.</p>
                <button class="btn" onclick="showAlert()">Click Me</button>
            </section>
            
            <section class="card">
                <h2>Features</h2>
                <ul class="feature-list">
                    <li>Live Preview</li>
                    <li>Multi-file Support</li>
                    <li>Folder Organization</li>
                    <li>VS Code-like Interface</li>
                </ul>
            </section>
        </main>
        
        <footer class="footer">
            <p>Built with ❤️ using Frontend Compiler</p>
        </footer>
    </div>
    
    <script src="script.js"></script>
</body>
</html>`,
      language: 'html',
      path: '/index.html',
      folderPath: '/',
      isEntryPoint: true,
      lastModified: new Date()
    },
    {
      id: 'file-2-styles-css',
      filename: 'styles.css',
      content: `/* Main Styles */
:root {
    --primary-color: #007acc;
    --secondary-color: #f5f5f5;
    --accent-color: #4ec9b0;
    --text-color: #333333;
    --bg-color: #ffffff;
    --card-bg: #f9f9f9;
    --border-color: #e0e0e0;
}

* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    background-color: var(--bg-color);
    color: var(--text-color);
    line-height: 1.6;
    min-height: 100vh;
}

.container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 2rem;
}

.header {
    text-align: center;
    margin-bottom: 3rem;
    padding-bottom: 2rem;
    border-bottom: 2px solid var(--border-color);
}

.header h1 {
    font-size: 2.5rem;
    color: var(--accent-color);
    margin-bottom: 1rem;
}

.subtitle {
    font-size: 1.2rem;
    color: #666666;
}

.content {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 2rem;
    margin-bottom: 3rem;
}

.card {
    background: var(--card-bg);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    padding: 1.5rem;
    transition: transform 0.3s ease, box-shadow 0.3s ease;
}

.card:hover {
    transform: translateY(-5px);
    box-shadow: 0 10px 20px rgba(0, 0, 0, 0.1);
}

.card h2 {
    color: var(--primary-color);
    margin-bottom: 1rem;
    font-size: 1.5rem;
}

.feature-list {
    list-style: none;
    padding-left: 0;
}

.feature-list li {
    padding: 0.5rem 0;
    border-bottom: 1px solid var(--border-color);
    position: relative;
    padding-left: 1.5rem;
}

.feature-list li:before {
    content: "✓";
    color: var(--accent-color);
    position: absolute;
    left: 0;
}

.btn {
    background: var(--primary-color);
    color: white;
    border: none;
    padding: 0.8rem 1.5rem;
    border-radius: 4px;
    cursor: pointer;
    font-size: 1rem;
    transition: background 0.3s ease;
    margin-top: 1rem;
}

.btn:hover {
    background: #0062a3;
}

.footer {
    text-align: center;
    padding: 2rem;
    border-top: 1px solid var(--border-color);
    color: #666666;
    font-size: 0.9rem;
}

/* Responsive Design */
@media (max-width: 768px) {
    .container {
        padding: 1rem;
    }
    
    .header h1 {
        font-size: 2rem;
    }
    
    .content {
        grid-template-columns: 1fr;
    }
}`,
      language: 'css',
      path: '/styles.css',
      folderPath: '/',
      lastModified: new Date()
    },
    {
      id: 'file-3-script-js',
      filename: 'script.js',
      content: `// Main JavaScript File
console.log('Project loaded successfully!');

// Show welcome alert
function showAlert() {
    alert('🎉 Hello! Welcome to your project!');
    
    // Update button text
    const btn = document.querySelector('.btn');
    if (btn) {
        const originalText = btn.textContent;
        btn.textContent = 'Clicked!';
        btn.style.backgroundColor = '#4ec9b0';
        
        // Reset after 2 seconds
        setTimeout(() => {
            btn.textContent = originalText;
            btn.style.backgroundColor = '';
        }, 2000);
    }
}

// Add animation to cards on load
document.addEventListener('DOMContentLoaded', function() {
    const cards = document.querySelectorAll('.card');
    cards.forEach((card, index) => {
        card.style.opacity = '0';
        card.style.transform = 'translateY(20px)';
        
        setTimeout(() => {
            card.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
            card.style.opacity = '1';
            card.style.transform = 'translateY(0)';
        }, index * 200);
    });
    
    // Add click handler to all cards
    cards.forEach(card => {
        card.addEventListener('click', function() {
            this.style.borderColor = '#4ec9b0';
            setTimeout(() => {
                this.style.borderColor = '';
            }, 1000);
        });
    });
    
    // Log feature list
    const features = document.querySelectorAll('.feature-list li');
    console.log(\`Found \${features.length} features:\`);
    features.forEach((feature, i) => {
        console.log(\`\${i + 1}. \${feature.textContent}\`);
    });
});

// Utility functions
function formatDate(date = new Date()) {
    return date.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

function getRandomColor() {
    const colors = ['#007acc', '#4ec9b0', '#c586c0', '#dcdcaa', '#ce9178'];
    return colors[Math.floor(Math.random() * colors.length)];
}

// Export functions for use in browser console
window.projectUtils = {
    showAlert,
    formatDate,
    getRandomColor,
    reloadPage: () => location.reload()
};

console.log('Project utilities available at window.projectUtils');`,
      language: 'javascript',
      path: '/script.js',
      folderPath: '/',
      lastModified: new Date()
    }
  ];

  const defaultFolders: FolderType[] = [
    {
      id: 'folder-1-assets',
      name: 'assets',
      path: '/assets',
      parentPath: '/',
      children: [],
      folderChildren: [],
      isOpen: true,
      depth: 0
    },
    {
      id: 'folder-2-components',
      name: 'components',
      path: '/components',
      parentPath: '/',
      children: [],
      folderChildren: [],
      isOpen: false,
      depth: 0
    },
    {
      id: 'folder-3-utils',
      name: 'utils',
      path: '/utils',
      parentPath: '/',
      children: [],
      folderChildren: [],
      isOpen: false,
      depth: 0
    }
  ];

  // VS Code-like state - Initialize with either initial data or defaults
  const [files, setFiles] = useState<FileType[]>(() => {
    if (initialFiles && initialFiles.length > 0) {
      console.log("Setting initial files from props:", initialFiles.length);
      return initialFiles.map(file => ({
        ...file,
        lastModified: file.lastModified || new Date(),
        isDirty: false
      }));
    }
    console.log("Using default files");
    // Filter the pre-loaded defaults by the exercise's selectedLanguages so the
    // student doesn't see (and get confused by) files for languages they're not
    // allowed to author.
    const cssAllowed = allowedExtensions.has('css');
    const jsAllowed = allowedExtensions.has('js');
    const filtered = defaultFiles.filter(f => {
      const ext = (f.filename.split('.').pop() || '').toLowerCase();
      return allowedExtensions.has(ext);
    });
    // Adjust the index.html so it doesn't reference styles.css / script.js when
    // those files were filtered out — avoids broken <link>/<script> tags in preview.
    return filtered.map(f => {
      if (f.filename !== 'index.html') return f;
      let content = f.content;
      if (!cssAllowed) {
        content = content.replace(/<link[^>]*href=["']styles\.css["'][^>]*>\s*/gi, '');
      }
      if (!jsAllowed) {
        content = content.replace(/<script[^>]*src=["']script\.js["'][^>]*><\/script>\s*/gi, '');
      }
      return { ...f, content };
    });
  });


  const [folders, setFolders] = useState<FolderType[]>(() => {
    if (initialFolders && initialFolders.length > 0) {
      console.log("Setting initial folders from props:", initialFolders.length);
      return initialFolders.map(folder => ({
        ...folder,
        isOpen: folder.isOpen !== undefined ? folder.isOpen : true,
        children: folder.children || [],
        folderChildren: folder.folderChildren || []
      }));
    }
    console.log("Using default folders");
    return defaultFolders;
  });
  const [activeFileId, setActiveFileId] = useState<string>(() => {
    if (initialFiles && initialFiles.length > 0) {
      // Find entry point or first HTML file or first file
      const entryPoint = initialFiles.find(f => f.isEntryPoint);
      const htmlFile = initialFiles.find(f => f.language === 'html');
      return entryPoint?.id || htmlFile?.id || initialFiles[0]?.id || '';
    }
    return 'file-1-index-html';
  });

  const [srcDoc, setSrcDoc] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(isLoadingSubmission);
  const [showFileTree, setShowFileTree] = useState(true);
  const [showPreview, setShowPreview] = useState(true);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(initialQuestionIndex);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showNewFileForm, setShowNewFileForm] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [newFilePath, setNewFilePath] = useState('/');
  const [isRenaming, setIsRenaming] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [userAttempts, setUserAttempts] = useState<{ [key: string]: number }>({});
  const [currentPreviewFile, setCurrentPreviewFile] = useState<string>('');
  const [showNewFolderForm, setShowNewFolderForm] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderPath, setNewFolderPath] = useState('/');
  const [editorZoom, setEditorZoom] = useState(100);
  const [showProblems, setShowProblems] = useState(false);
  const [showOutput, setShowOutput] = useState(false);
  const [showExtensions, setShowExtensions] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(250);
  const [previewWidth, setPreviewWidth] = useState(50);
  const [layout, setLayout] = useState<'horizontal' | 'vertical'>('horizontal');
  const [openFiles, setOpenFiles] = useState<string[]>(() => {
    if (initialFiles && initialFiles.length > 0) {
      return [activeFileId];
    }
    return ['file-1-index-html'];
  });
  const [selectedFolderPath, setSelectedFolderPath] = useState<string>('/');
  const [isCreatingFile, setIsCreatingFile] = useState<boolean>(false);
  const [newFileTempName, setNewFileTempName] = useState<string>('');
  const [newFileTempPath, setNewFileTempPath] = useState<string>('');
  const [isCreatingFolder, setIsCreatingFolder] = useState<boolean>(false);
  const [newFolderTempName, setNewFolderTempName] = useState<string>('');
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    type: 'file' | 'folder';
    id: string;
    name: string;
  } | null>(null);

  const [renameTarget, setRenameTarget] = useState<{
    id: string;
    type: 'file' | 'folder';
    name: string;
    path: string;
  } | null>(null);

  const [tempRenameValue, setTempRenameValue] = useState('');
  const [isLoadingPrevious, setIsLoadingPrevious] = useState(false);

  // Security state
  const [tabSwitchCount, setTabSwitchCount] = useState(0);
  const [isTerminated, setIsTerminated] = useState(false);
  const [terminationReason, setTerminationReason] = useState("");
  const [isLocked, setIsLocked] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [hasStarted, setHasStarted] = useState(!isAssessmentMode);
  const [hasAgreedToSecurity, setHasAgreedToSecurity] = useState(!isAssessmentMode);
  const [showSecurityAgreement, setShowSecurityAgreement] = useState(false);
  const [showSubmissionSuccess, setShowSubmissionSuccess] = useState(false);
  const [autoRedirectTimer, setAutoRedirectTimer] = useState<NodeJS.Timeout | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [micEnabled, setMicEnabled] = useState(true);
  const [autoRun, setAutoRun] = useState(true);
  const [fontSize, setFontSize] = useState(15);
  const [showSettings, setShowSettings] = useState(false);
  const [isUIFullscreen, setIsUIFullscreen] = useState(false);
  const [showQuestionSidebar, setShowQuestionSidebar] = useState(true);

  // Recording refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const isRecordingStartedRef = useRef(false);
  const screenVideoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const combinedStreamRef = useRef<MediaStream | null>(null);

  const currentQuestion = questions[currentQuestionIndex] || {};

  // Helper function to get question ID
  const getQuestionId = useCallback(() => {
    if (!currentQuestion) return null;

    const possibleIds = [
      currentQuestion._id,
      currentQuestion.id,
      currentQuestion.questionId,
      currentQuestion.question_id,
      currentQuestion.questionID
    ];

    const foundId = possibleIds.find(id => id && id.toString().trim() !== '');

    if (!foundId) {
      console.warn('No question ID found in:', currentQuestion);
      return `question-${currentQuestionIndex}`;
    }

    return foundId.toString();
  }, [currentQuestion, currentQuestionIndex]);

  const activeFile = files.find(f => f.id === activeFileId) || files[0];

  // ---------------------------------------------------------------------------
  // SECURITY FUNCTIONS
  // ---------------------------------------------------------------------------

  const handleSecurityAgreement = async () => {
    if (isLocked) {
      setTerminationReason("This exercise has been locked. Please contact your instructor.");
      setIsTerminated(true);
      return;
    }

    setHasAgreedToSecurity(true);
    setHasStarted(true);

    if (activeSecurity.fullScreenMode) {
      try {
        await document.documentElement.requestFullscreen();
      } catch (error) {
        console.error('Fullscreen error:', error);
        toast.error('Fullscreen required. Please enable it manually.');
        return;
      }
    }

    if ((activeSecurity.screenRecordingEnabled || activeSecurity.cameraMicEnabled) && !isRecordingStartedRef.current) {
      try {
        isRecordingStartedRef.current = true;

        if (activeSecurity.screenRecordingEnabled) {
          await startScreenRecording();
        } else if (activeSecurity.cameraMicEnabled) {
          await startCameraRecording();
        }

        toast.success(`Assessment started with ${activeSecurity.screenRecordingEnabled ? 'screen recording' : 'camera monitoring'}`, { autoClose: 3000 });
      } catch (error) {
        console.error('Recording start error:', error);
        toast.warning('Could not start recording, but assessment will continue');
      }
    } else {
      toast.success('Assessment started', { autoClose: 3000 });
    }

    if (activeSecurity.timerEnabled && activeSecurity.timerDuration) {
      setTimeLeft(activeSecurity.timerDuration * 60);
    }
  };

  const handleCancelAssessment = () => {
    setHasStarted(false);
    onBack();
  };

  const cleanupAllMedia = useCallback(() => {
    console.log('🧹 Cleaning up all media streams...');

    if (mediaRecorderRef.current && isRecording) {
      try {
        mediaRecorderRef.current.stop();
        setIsRecording(false);
      } catch (e) {
        console.error('Error stopping recorder:', e);
      }
    }

    if (cameraStream) {
      cameraStream.getTracks().forEach(track => {
        track.stop();
        track.enabled = false;
      });
      setCameraStream(null);
    }

    if (screenStream) {
      screenStream.getTracks().forEach(track => {
        track.stop();
        track.enabled = false;
      });
      setScreenStream(null);
    }

    if (combinedStreamRef.current) {
      combinedStreamRef.current.getTracks().forEach(track => {
        track.stop();
        track.enabled = false;
      });
      combinedStreamRef.current = null;
    }

    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach(t => {
        t.stop();
        t.enabled = false;
      });
      videoRef.current.srcObject = null;
    }

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => { });
    }

    isRecordingStartedRef.current = false;
  }, [cameraStream, screenStream, isRecording]);

  const performExit = useCallback(async () => {
    if (isAssessmentMode && hasStarted && currentQuestionIndex === questions.length - 1) {
      try {
        const token = getToken() || localStorage.getItem('token') || '';

        await axios.post('https://lmsserver-yeve.onrender.com/exercise/lock', {
          courseId,
          exerciseId,
          category,
          subcategory,
          status: 'completed',
          reason: 'user_exited_after_completion'
        }, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        console.log('✅ Exercise finalized as completed');
      } catch (error) {
        console.error('Failed to finalize exercise completion:', error);
      }
    }

    cleanupAllMedia();

    if (recordedChunksRef.current.length > 0) {
      try {
        await saveRecordingSilently();
      } catch (error) {
        console.log('Recording save failed silently:', error);
      }
    }

    if (autoRedirectTimer) {
      clearTimeout(autoRedirectTimer);
      setAutoRedirectTimer(null);
    }

    localStorage.removeItem('currentFrontendExercise');
    if (onBack) { onBack(); } else { router.push(`/lms/pages/courses/coursesdetailedview/${courseId}`); }
  }, [cleanupAllMedia, courseId, router, autoRedirectTimer, isAssessmentMode, hasStarted, currentQuestionIndex, questions.length, exerciseId, category, subcategory]);

  const saveRecordingSilently = async (): Promise<boolean> => {
    if (recordedChunksRef.current.length === 0) {
      return true;
    }

    try {
      const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });

      if (blob.size === 0) {
        return true;
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const recordingType = activeSecurity.screenRecordingEnabled ? 'screen' : 'camera';
      const filename = `${recordingType}_recording_${courseId}_${exerciseId}_${timestamp}.webm`;

      const formData = new FormData();
      formData.append('file', blob, filename);
      formData.append('upload_preset', CLOUDINARY_PRESET);
      formData.append('cloud_name', CLOUDINARY_CLOUD_NAME);
      formData.append('folder', 'assessments');

      const response = await fetch(CLOUDINARY_UPLOAD_URL, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error(`Upload failed with status: ${response.status}`);
      }

      recordedChunksRef.current = [];
      return true;

    } catch (error) {
      console.error('Silent recording save error:', error);
      return false;
    }
  };

  const handleTermination = useCallback(async (reason: string) => {
    if (!isAssessmentMode) return;

    console.log('🚫 Terminating assessment:', reason);

    cleanupAllMedia();

    if (recordedChunksRef.current.length > 0) {
      try {
        await saveRecordingSilently();
      } catch (error) {
        console.log('Recording save failed on termination:', error);
      }
    }

    setIsTerminated(true);
    setIsLocked(true);
    setHasStarted(false);
    setTerminationReason(reason);

    try {
      const token = getToken() || localStorage.getItem('token') || '';
      await axios.post('https://lmsserver-yeve.onrender.com/exercise/lock', {
        courseId,
        exerciseId,
        category,
        subcategory,
        status: 'completed',
        reason: reason || 'Assessment completed by user'
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log("✅ Exercise marked as completed in backend");
    } catch (err) {
      console.error("Failed to mark exercise as completed:", err);
    }
  }, [isAssessmentMode, courseId, exerciseId, category, subcategory, cleanupAllMedia]);

  const startScreenRecording = async () => {
    try {
      console.log('🔴 Starting screen recording...');

      if (!screenStream) {
        const displayStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: micEnabled
        });

        console.log('✅ Screen stream obtained:', displayStream.id);
        setScreenStream(displayStream);

        displayStream.getVideoTracks()[0].onended = () => {
          console.log('🛑 User stopped screen sharing');
          stopRecording();
        };
      }

      let cameraStream: MediaStream | null = null;
      if (activeSecurity.cameraMicEnabled && !this.cameraStream) {
        try {
          cameraStream = await navigator.mediaDevices.getUserMedia({
            video: {
              width: { ideal: 320 },
              height: { ideal: 240 },
              frameRate: { ideal: 15 }
            },
            audio: micEnabled
          });
          console.log('✅ Camera stream obtained:', cameraStream.id);
          setCameraStream(cameraStream);

          if (videoRef.current) {
            videoRef.current.srcObject = cameraStream;
            videoRef.current.play().catch(console.error);
          }
        } catch (err) {
          console.warn("Camera access failed:", err);
          toast.warning("Camera access denied. Screen recording will continue without camera.");
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = 1920;
      canvas.height = 1080;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas context not available');

      canvasRef.current = canvas;

      const screenVideo = document.createElement('video');
      screenVideo.srcObject = screenStream;
      screenVideo.autoplay = true;
      screenVideo.playsInline = true;
      screenVideo.onloadedmetadata = () => {
        screenVideo.play().catch(console.error);
      };
      screenVideoRef.current = screenVideo;

      const cameraVideo = document.createElement('video');
      if (cameraStream) {
        cameraVideo.srcObject = cameraStream;
        cameraVideo.autoplay = true;
        cameraVideo.playsInline = true;
        cameraVideo.onloadedmetadata = () => {
          cameraVideo.play().catch(console.error);
        };
      }

      const drawFrame = () => {
        if (!ctx) return;

        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        if (screenVideo.videoWidth > 0 && screenVideo.videoHeight > 0) {
          const screenAspect = screenVideo.videoWidth / screenVideo.videoHeight;
          const canvasAspect = canvas.width / canvas.height;

          let drawWidth, drawHeight, drawX, drawY;

          if (screenAspect > canvasAspect) {
            drawWidth = canvas.width;
            drawHeight = canvas.width / screenAspect;
            drawX = 0;
            drawY = (canvas.height - drawHeight) / 2;
          } else {
            drawHeight = canvas.height;
            drawWidth = canvas.height * screenAspect;
            drawX = (canvas.width - drawWidth) / 2;
            drawY = 0;
          }

          ctx.drawImage(screenVideo, drawX, drawY, drawWidth, drawHeight);
        }

        if (cameraVideo && cameraVideo.srcObject && activeSecurity.cameraMicEnabled) {
          const camWidth = 320;
          const camHeight = 240;
          const padding = 20;

          ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
          ctx.fillRect(
            canvas.width - camWidth - padding,
            padding,
            camWidth + 10,
            camHeight + 10
          );

          ctx.drawImage(
            cameraVideo,
            canvas.width - camWidth - padding + 5,
            padding + 5,
            camWidth,
            camHeight
          );

          ctx.fillStyle = 'white';
          ctx.font = '14px Arial';
          ctx.fillText(
            new Date().toLocaleTimeString(),
            canvas.width - camWidth - padding + 10,
            padding + 20
          );
        }

        animationFrameRef.current = requestAnimationFrame(drawFrame);
      };

      drawFrame();

      const canvasStream = canvas.captureStream(15);

      if (screenStream?.getAudioTracks().length > 0) {
        canvasStream.addTrack(screenStream.getAudioTracks()[0]);
      } else if (cameraStream?.getAudioTracks().length > 0) {
        canvasStream.addTrack(cameraStream.getAudioTracks()[0]);
      }

      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9'
        : MediaRecorder.isTypeSupported('video/webm')
          ? 'video/webm'
          : MediaRecorder.isTypeSupported('video/mp4')
            ? 'video/mp4'
            : '';

      if (!mimeType) {
        throw new Error('No supported MIME type found for recording');
      }

      const mediaRecorder = new MediaRecorder(canvasStream, {
        mimeType,
        videoBitsPerSecond: 2500000
      });

      mediaRecorderRef.current = mediaRecorder;
      recordedChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
      };

      mediaRecorder.onerror = (event) => {
        console.error('❌ MediaRecorder error:', event);
        toast.error("Recording error occurred");
      };

      mediaRecorder.start(1000);
      setIsRecording(true);

      console.log('✅ Recording started successfully');
      toast.success("Screen recording started", { autoClose: 3000 });

    } catch (error) {
      console.error('❌ Screen recording error:', error);
      toast.error("Could not start screen recording. Please check permissions.");
    }
  };

  const startCameraRecording = async () => {
    if (!activeSecurity.cameraMicEnabled) return;

    try {
      console.log('📹 Starting camera recording...');

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 }
        },
        audio: micEnabled
      });

      setCameraStream(stream);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(console.error);
      }

      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9'
        : MediaRecorder.isTypeSupported('video/webm')
          ? 'video/webm'
          : MediaRecorder.isTypeSupported('video/mp4')
            ? 'video/mp4'
            : '';

      const mediaRecorder = new MediaRecorder(stream, { mimeType });

      recordedChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        console.log('📹 Camera recording stopped');
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(1000);
      setIsRecording(true);

      console.log('✅ Camera recording started');
      toast.success("Camera recording started");

    } catch (error) {
      console.error("Camera recording error:", error);
      toast.error("Failed to start camera recording");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      console.log('🛑 Stopping recording...');
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  // Security effects
  useEffect(() => {
    if (!hasStarted || !activeSecurity.timerEnabled || !timeLeft) return;

    const timer = setInterval(() => {
      setTimeLeft(p => {
        if (p !== null && p <= 0) {
          clearInterval(timer);
          handleTermination("Time Limit Exceeded");
          return 0;
        }
        return p !== null ? p - 1 : null;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [activeSecurity.timerEnabled, hasStarted, timeLeft, handleTermination]);

  useEffect(() => {
    if (!hasStarted || isTerminated || isLocked || !isAssessmentMode) return;

    const handleVisibility = () => {
      if (document.hidden) {
        setTabSwitchCount(c => {
          const newCount = c + 1;

          if (!activeSecurity.tabSwitchAllowed) {
            handleTermination("Tab switching is strictly prohibited.");
            return newCount;
          }

          if (activeSecurity.tabSwitchAllowed && activeSecurity.maxTabSwitches && newCount > activeSecurity.maxTabSwitches) {
            handleTermination(`Tab switch limit (${activeSecurity.maxTabSwitches}) exceeded.`);
            return newCount;
          }

          const limitText = activeSecurity.maxTabSwitches ? `/${activeSecurity.maxTabSwitches}` : '';
          toast.warn(`Warning: Tab switch detected! (${newCount}${limitText})`);

          return newCount;
        });
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [activeSecurity, hasStarted, isTerminated, isLocked, isAssessmentMode, handleTermination]);

  useEffect(() => {
    if (!hasStarted || !activeSecurity.disableClipboard || !isAssessmentMode) return;

    const preventCopyPaste = (e: ClipboardEvent) => {
      e.preventDefault();
      toast.error("Copy/Paste is disabled in assessment mode");
    };

    document.addEventListener('copy', preventCopyPaste);
    document.addEventListener('paste', preventCopyPaste);
    document.addEventListener('cut', preventCopyPaste);

    return () => {
      document.removeEventListener('copy', preventCopyPaste);
      document.removeEventListener('paste', preventCopyPaste);
      document.removeEventListener('cut', preventCopyPaste);
    };
  }, [activeSecurity.disableClipboard, hasStarted, isAssessmentMode]);

  useEffect(() => {
    if (!hasStarted || !activeSecurity.fullScreenMode || !isAssessmentMode) return;

    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        toast.error("Full screen mode is required! Returning to full screen...");
        setTimeout(() => {
          document.documentElement.requestFullscreen().catch(() => {
            handleTermination("Failed to maintain full screen mode");
          });
        }, 1000);
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, [activeSecurity.fullScreenMode, hasStarted, isAssessmentMode, handleTermination]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupAllMedia();
    };
  }, [cleanupAllMedia]);

  // Check exercise status
  useEffect(() => {
    const checkExerciseStatus = async () => {
      if (!isAssessmentMode || !courseId || !exerciseId) return;

      try {
        const token = getToken() || localStorage.getItem('token') || '';
        const response = await axios.get('https://lmsserver-yeve.onrender.com/exercise/status', {
          params: { courseId, exerciseId, category, subcategory },
          headers: { Authorization: `Bearer ${token}` }
        });

        if (response.data.success) {
          const { isLocked, status } = response.data.data;

          if (isLocked || status === 'terminated' || status === 'completed') {
            setIsLocked(true);
            setHasStarted(false);
            if (status === 'completed') {
              setTerminationReason("This assessment has already been completed. You cannot retake it.");
            } else {
              setTerminationReason("This exercise is locked. You have been terminated or have already completed it.");
            }
            setIsTerminated(true);
            setShowSecurityAgreement(false);
          }
        }
      } catch (error) {
        console.error("Status check failed", error);
      }
    };

    checkExerciseStatus();
  }, [courseId, exerciseId, category, subcategory, isAssessmentMode]);

  // ---------------------------------------------------------------------------
  // FILE TREE FUNCTIONS - FIXED TO PREVENT RECURSION
  // ---------------------------------------------------------------------------

  // // Function to load previous submission
  // const loadPreviousSubmission = useCallback(async () => {
  //   const questionId = getQuestionId();
  //   if (!questionId || !courseId || !exerciseId || !category) {
  //     toast.error("Missing information to load previous submission");
  //     return;
  //   }

  //   setIsLoadingPrevious(true);
  //   try {
  //     const token = getToken() || localStorage.getItem('token') || '';

  //     if (!token) {
  //       toast.error("Authentication token missing");
  //       return;
  //     }

  //     const response = await fetch(
  //       `https://lmsserver-yeve.onrender.com/courses/answers/previous-submission?courseId=${courseId}&exerciseId=${exerciseId}&questionId=${questionId}&category=${category}`,
  //       {
  //         headers: {  
  //           'Authorization': `Bearer ${token}`,
  //           'Content-Type': 'application/json'
  //         }
  //       }
  //     );

  //     if (!response.ok) {
  //       throw new Error(`HTTP error! status: ${response.status}`);
  //     }

  //     const data = await response.json();
  //     console.log("Previous submission response:", data);

  //     if (data.success && data.data) {
  //       const submission = data.data;

  //       // Transform files
  //       const transformedFiles: FileType[] = (submission.files || []).map((file: any, index: number) => {
  //         let language: FileType['language'] = file.language as FileType['language'];
  //         if (!language && file.filename) {
  //           const ext = file.filename.split('.').pop()?.toLowerCase();
  //           if (ext === 'html' || ext === 'htm') language = 'html';
  //           else if (ext === 'css') language = 'css';
  //           else if (ext === 'js') language = 'javascript';
  //           else if (ext === 'json') language = 'json';
  //           else if (ext === 'xml') language = 'xml';
  //           else if (ext === 'md' || ext === 'markdown') language = 'markdown';
  //           else if (ext === 'txt') language = 'text';
  //           else language = 'text';
  //         }

  //         return {
  //           id: file.id || `file-${Date.now()}-${index}`,
  //           filename: file.filename || `file${index}.txt`,
  //           content: file.content || '',
  //           language: language || 'text',
  //           path: file.path || `/${file.filename}`,
  //           folderPath: file.folderPath || '/',
  //           isEntryPoint: file.isEntryPoint || false,
  //           lastModified: file.lastModified ? new Date(file.lastModified) : new Date(),
  //           size: file.size || (file.content ? Buffer.byteLength(file.content, 'utf8') : 0),
  //           isDirty: false
  //         };
  //       });

  //       // Transform folders
  //       const transformedFolders: FolderType[] = (submission.folders || []).map((folder: any, index: number) => {
  //         const path = folder.path || `/${folder.name}`;
  //         const parentPath = folder.parentPath || '/';

  //         return {
  //           id: folder.id || `folder-${Date.now()}-${index}`,
  //           name: folder.name || `folder${index}`,
  //           path: path,
  //           parentPath: parentPath,
  //           children: [],
  //           folderChildren: [],
  //           isOpen: true,
  //           depth: folder.depth || (path.split('/').filter(Boolean).length - 1)
  //         };
  //       });

  //       // If we have files but no folders, create a root folder
  //       if (transformedFiles.length > 0 && transformedFolders.length === 0) {
  //         transformedFolders.push({
  //           id: 'folder-root',
  //           name: 'Root',
  //           path: '/',
  //           parentPath: '',
  //           children: [],
  //           folderChildren: [],
  //           isOpen: true,
  //           depth: 0
  //         });
  //       }

  //       console.log("Setting transformed data:", {
  //         files: transformedFiles.length,
  //         folders: transformedFolders.length
  //       });

  //       // Update state
  //       setFiles(transformedFiles);
  //       setFolders(transformedFolders);

  //       if (transformedFiles.length > 0) {
  //         const entryPoint = transformedFiles.find(f => f.isEntryPoint);
  //         const htmlFile = transformedFiles.find(f => f.language === 'html');
  //         const firstFileId = transformedFiles[0].id;
  //         const newActiveFileId = entryPoint?.id || htmlFile?.id || firstFileId;

  //         setActiveFileId(newActiveFileId);
  //         setOpenFiles([newActiveFileId]);
  //       }

  //       toast.success(`Loaded previous submission with ${transformedFiles.length} files and ${transformedFolders.length} folders`);

  //       // Trigger preview compilation
  //       setTimeout(() => {
  //         compileCode();
  //       }, 100);
  //     } else {
  //       toast.info("No previous submission found");
  //     }
  //   } catch (error: any) {
  //     console.error("Error loading previous submission:", error);
  //     toast.error(`Failed to load previous submission: ${error.message}`);
  //   } finally {
  //     setIsLoadingPrevious(false);
  //   }
  // }, [courseId, exerciseId, category, getQuestionId]);

  // // Auto-load previous submission on mount if initial data wasn't provided
  // useEffect(() => {
  //   if (!initialFiles || initialFiles.length === 0) {
  //     const timeout = setTimeout(() => {
  //       loadPreviousSubmission();
  //     }, 500);

  //     return () => clearTimeout(timeout);
  //   }
  // }, [initialFiles, loadPreviousSubmission]);

  // Helper function to get folder path for display
  const getFolderPathForDisplay = (path: string) => {
    if (path === '/') return 'Root';
    return path.split('/').filter(Boolean).join(' → ');
  };

  // Function to handle opening new window with a specific file
  const handleOpenInNewWindowWithFile = useCallback((fileName: string) => {
    const normalizedFileName = fileName.replace(/^\.?\//, '');
    const targetFile = files.find(f =>
      f.filename.toLowerCase() === normalizedFileName.toLowerCase() ||
      f.filename.toLowerCase().endsWith(normalizedFileName.toLowerCase())
    );

    if (targetFile) {
      const htmlContent = generateCompleteHtmlForNewWindow(targetFile);
      const newWindow = window.open();
      if (newWindow) {
        newWindow.document.write(htmlContent);
        newWindow.document.close();
      }
    } else {
      toast.error(`File "${fileName}" not found`);
    }
  }, [files]);

  // Compile code function
  const compileCode = useCallback(() => {
    const allFiles = files;
    const activeFile = allFiles.find(f => f.id === activeFileId);
    const isActiveFileHtml = activeFile?.language === 'html';

    const previewFile = isActiveFileHtml ? activeFile :
      allFiles.find(f => f.language === 'html' && f.isEntryPoint) ||
      allFiles.find(f => f.language === 'html') ||
      null;

    if (!previewFile) {
      setSrcDoc(`<!DOCTYPE html><html><body style="background:#ffffff;color:#333333;padding:20px;font-family:'Segoe UI',sans-serif;"><h1>No HTML file found</h1></body></html>`);
      setCurrentPreviewFile('No HTML file');
      return;
    }

    const newSrcDoc = generateSrcDocForFile(previewFile);
    setSrcDoc(newSrcDoc);
    setCurrentPreviewFile(previewFile.filename);
  }, [files, activeFileId]);

  // Find linked CSS files in HTML content
  const findLinkedCssFiles = useCallback((htmlContent: string) => {
    const linkedFiles: Array<{ filename: string, path: string }> = [];
    const linkRegex = /<link[^>]*rel=["']stylesheet["'][^>]*href=["']([^"']+)["'][^>]*>/gi;
    let match;

    while ((match = linkRegex.exec(htmlContent)) !== null) {
      const href = match[1];
      if (href && !href.startsWith('http') && href.endsWith('.css')) {
        linkedFiles.push({
          filename: href.split('/').pop() || href,
          path: href
        });
      }
    }

    return linkedFiles;
  }, []);

  // Combine CSS for HTML file
  const combineCssForHtmlFile = useCallback((htmlFile: FileType, linkedCssFiles: Array<{ filename: string, path: string }>) => {
    let cssContent = '';
    const htmlFolderPath = htmlFile.folderPath;

    // 1. Include inline styles from the HTML file itself
    const styleRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi;
    const styleMatches = htmlFile.content.matchAll(styleRegex);
    for (const match of styleMatches) {
      cssContent += match[1] + '\n';
    }

    // 2. Include linked CSS files
    linkedCssFiles.forEach(linkedCss => {
      const cssFile = files.find(f => {
        if (f.language === 'css') {
          if (linkedCss.path.includes('/')) {
            return f.path === linkedCss.path ||
              f.path === `/${linkedCss.path}` ||
              f.path.endsWith(linkedCss.path);
          } else {
            return f.folderPath === htmlFolderPath && f.filename === linkedCss.filename;
          }
        }
        return false;
      });

      if (cssFile) {
        cssContent += `/* ${cssFile.filename} */\n${cssFile.content}\n`;
      }
    });

    return cssContent;
  }, [files]);

  // Combine JS for HTML file
  const combineJsForHtmlFile = useCallback((htmlFile: FileType) => {
    let jsContent = '';
    const htmlFolderPath = htmlFile.folderPath;

    // Get inline scripts from HTML
    const scriptRegex = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
    let match;

    while ((match = scriptRegex.exec(htmlFile.content)) !== null) {
      if (!match[0].includes('src=')) {
        jsContent += match[1] + '\n\n';
      }
    }

    // Get JS files from same folder
    const jsFiles = files.filter(f =>
      f.language === 'javascript' && f.folderPath === htmlFolderPath
    );

    jsFiles.forEach(jsFile => {
      jsContent += jsFile.content + '\n\n';
    });

    return jsContent;
  }, [files]);

  // Generate complete HTML for new window
  const generateCompleteHtmlForNewWindow = useCallback((targetFile: FileType) => {
    const allHtmlFiles = files.filter(f => f.language === 'html');
    const cssContent = combineCssForHtmlFile(targetFile, findLinkedCssFiles(targetFile.content));

    // Get JavaScript content
    const jsContent = combineJsForHtmlFile(targetFile);

    // Prepare files data for JavaScript
    const filesDataForJs = files.map(f => ({
      id: f.id,
      filename: f.filename,
      content: f.content,
      language: f.language,
      isHtml: f.language === 'html',
      cssContent: f.language === 'css' ? f.content : '',
      jsContent: f.language === 'javascript' ? f.content : ''
    }));

    return `
  <!DOCTYPE html>
  <html>
  <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${targetFile.filename} - Preview</title>
      <base href="about:blank">
      <style>
          ${cssContent}
          
          /* Navigation styles */
          .vscode-preview-nav {
            background: #f3f3f3;
            padding: 12px 20px;
            border-bottom: 1px solid #d4d4d4;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            display: flex;
            align-items: center;
            gap: 20px;
            position: sticky;
            top: 0;
            z-index: 100;
          }
          .vscode-preview-nav-title {
            font-weight: 600;
            color: #333333;
            font-size: 14px;
          }
          .vscode-preview-nav-tabs {
            display: flex;
            gap: 2px;
            background: #e5e5e5;
            border-radius: 4px;
            padding: 2px;
          }
          .vscode-preview-nav-tab {
            padding: 6px 12px;
            font-size: 13px;
            color: #666666;
            cursor: pointer;
            border-radius: 2px;
            transition: all 0.2s ease;
            text-decoration: none;
            border: none;
            background: transparent;
          }
          .vscode-preview-nav-tab:hover {
            background: #d5d5d5;
            color: #333333;
          }
          .vscode-preview-nav-tab.active {
            background: #ffffff;
            color: #007acc;
            font-weight: 500;
          }
          .vscode-preview-status {
            margin-left: auto;
            font-size: 12px;
            color: #4ec9b0;
            display: flex;
            align-items: center;
            gap: 6px;
          }
          body {
            margin: 0;
            padding: 0;
            background: #ffffff;
            color: #333333;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          }
      </style>
  </head>
  <body>
      <div id="main-content">
        ${targetFile.content}
      </div>
      
      <script>
          // Store all files data for navigation
          const allFilesData = ${JSON.stringify(filesDataForJs).replace(/</g, '\\u003c')};
          
          // Function to execute scripts in an element
          function executeScripts(element) {
            const scripts = element.querySelectorAll('script');
            scripts.forEach(oldScript => {
              const newScript = document.createElement('script');
              if (oldScript.src) {
                newScript.src = oldScript.src;
              } else {
                try {
                  // Use eval to execute script content immediately
                  eval(oldScript.textContent);
                } catch (error) {
                  console.error('Error executing script:', error);
                }
              }
              newScript.type = oldScript.type || 'text/javascript';
              newScript.async = oldScript.async;
              
              // Copy all attributes
              Array.from(oldScript.attributes).forEach(attr => {
                newScript.setAttribute(attr.name, attr.value);
              });
              
              // Only append if it has src
              if (oldScript.src) {
                oldScript.parentNode.replaceChild(newScript, oldScript);
              } else {
                // Remove the script tag after executing
                oldScript.remove();
              }
            });
          }
          
          function interceptLinkClicks() {
            document.addEventListener('click', function(e) {
              let target = e.target;
              while (target && target.tagName !== 'A') {
                if (target.parentElement) {
                  target = target.parentElement;
                } else {
                  break;
                }
              }
              
              if (target && target.tagName === 'A' && target.href) {
                const href = target.getAttribute('href');
                
                if (href && !href.startsWith('http') && !href.startsWith('//') && !href.startsWith('mailto:') && !href.startsWith('tel:')) {
                  const htmlFile = allFilesData.find(f => 
                    f.isHtml && (
                      href === f.filename ||
                      href === './' + f.filename ||
                      href === '/' + f.filename ||
                      href.includes(f.filename)
                    )
                  );
                  
                  if (htmlFile) {
                    e.preventDefault();
                    e.stopPropagation();
                    navigateToFile(htmlFile.filename);
                    return false;
                  }
                  
                  if (!href.startsWith('#') && !href.startsWith('javascript:')) {
                    e.preventDefault();
                    e.stopPropagation();
                    alert('External navigation is disabled in preview. This would navigate to: ' + href);
                    return false;
                  }
                }
              }
            });
          }
          
          function navigateToFile(fileName) {
            const targetFileData = allFilesData.find(f => f.filename === fileName && f.isHtml);
            if (!targetFileData) {
              console.error('File not found:', fileName);
              return;
            }
            
            // Update active tab
            document.querySelectorAll('.vscode-preview-nav-tab').forEach(tab => {
              tab.classList.remove('active');
              if (tab.textContent.trim() === fileName) {
                tab.classList.add('active');
              }
            });
            
            // Update page title
            document.title = fileName + ' - Preview';
            
            // Update content
            const mainContent = document.getElementById('main-content');
            if (mainContent) {
              // Set new content
              mainContent.innerHTML = targetFileData.content;
              
              // Execute scripts from the new content
              executeScripts(mainContent);
              
              // Re-apply link click interception
              interceptLinkClicks();
              
              console.log('Navigated to:', fileName);
            }
          }
          
          // Make navigateToFile available globally
          window.navigateToFile = navigateToFile;
          
          // Initialize
          document.addEventListener('DOMContentLoaded', function() {
            interceptLinkClicks();
            
            // Execute scripts from the initial content
            executeScripts(document.getElementById('main-content'));
            
            console.info('New window preview loaded:', '${targetFile.filename}');
          });
      </script>
      
      <!-- Include JavaScript content in a separate script tag -->
      <script>
        ${jsContent}
      </script>
  </body>
  </html>
`;
  }, [files, combineCssForHtmlFile, findLinkedCssFiles, combineJsForHtmlFile]);

  // Generate srcDoc for iframe preview
  const generateSrcDocForFile = useCallback((htmlFile: FileType) => {
    if (!htmlFile || htmlFile.language !== 'html') {
      return createNotFoundPage(htmlFile?.filename || 'File not found');
    }

    const linkedCssFiles = findLinkedCssFiles(htmlFile.content);
    const cssContent = combineCssForHtmlFile(htmlFile, linkedCssFiles);
    const jsContent = combineJsForHtmlFile(htmlFile);
    const allHtmlFiles = files.filter(f => f.language === 'html');

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            ${cssContent}
            
            .vscode-preview-nav {
              background: #f3f3f3;
              padding: 12px 20px;
              border-bottom: 1px solid #d4d4d4;
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
              display: flex;
              align-items: center;
              gap: 20px;
            }
            .vscode-preview-nav-title {
              font-weight: 600;
              color: #333333;
              font-size: 14px;
            }
            .vscode-preview-nav-tabs {
              display: flex;
              gap: 2px;
              background: #e5e5e5;
              border-radius: 4px;
              padding: 2px;
            }
            .vscode-preview-nav-tab {
              padding: 6px 12px;
              font-size: 13px;
              color: #666666;
              cursor: pointer;
              border-radius: 2px;
              transition: all 0.2s ease;
              text-decoration: none;
              border: none;
              background: transparent;
            }
            .vscode-preview-nav-tab:hover {
              background: #d5d5d5;
              color: #333333;
            }
            .vscode-preview-nav-tab.active {
              background: #ffffff;
              color: #007acc;
              font-weight: 500;
            }
            .vscode-preview-status {
              margin-left: auto;
              font-size: 12px;
              color: #4ec9b0;
              display: flex;
              align-items: center;
              gap: 6px;
            }
            body {
              margin: 0;
              background: #ffffff;
              color: #333333;
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            }
          </style>
        </head>
        <body>
          ${htmlFile.content}
          
          <script>
            ${jsContent}
            
            function navigateToFile(fileName) {
              if (window.parent && window.parent !== window) {
                window.parent.postMessage({
                  type: 'NAVIGATE_TO_FILE',
                  fileName: fileName
                }, '*');
              } else {
                console.log('Would navigate to:', fileName);
              }
              return false;
            }
            
            // Light mode console styling
            const originalLog = console.log;
            console.log = function(...args) {
              const timestamp = new Date().toLocaleTimeString();
              const styledArgs = args.map(arg => 
                typeof arg === 'string' ? \`%c\${arg}\` : arg
              );
              const styles = args.map(() => 'color: #4ec9b0;');
              originalLog(\`%c[\${timestamp}]\`, 'color: #666666;', ...styledArgs);
            };
            
            console.info = function(...args) {
              const timestamp = new Date().toLocaleTimeString();
              originalLog(\`%c[\${timestamp}] INFO:\`, 'color: #007acc;', ...args);
            };
            
            console.warn = function(...args) {
              const timestamp = new Date().toLocaleTimeString();
              originalLog(\`%c[\${timestamp}] WARN:\`, 'color: #dcdcaa;', ...args);
            };
            
            console.error = function(...args) {
              const timestamp = new Date().toLocaleTimeString();
              originalLog(\`%c[\${timestamp}] ERROR:\`, 'color: #f48771;', ...args);
            };
            
            document.addEventListener('DOMContentLoaded', function() {
              console.info('Preview loaded:', '${htmlFile.filename}');
            });
          </script>
        </body>
      </html>
    `;
  }, [files, findLinkedCssFiles, combineCssForHtmlFile, combineJsForHtmlFile]);

  // Create 404 page
  const createNotFoundPage = useCallback((missingFile: string) => `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>File Not Found</title>
        <style>
            body { 
                background: #ffffff; 
                color: #333333; 
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                display: flex;
                align-items: center;
                justify-content: center;
                min-height: 100vh;
                margin: 0;
                padding: 20px;
            }
            .not-found {
                text-align: center;
                max-width: 500px;
                padding: 40px;
                background: #f9f9f9;
                border-radius: 8px;
                border: 1px solid #e0e0e0;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
            }
            .error-code {
                font-size: 48px;
                color: #f48771;
                margin-bottom: 20px;
            }
            h1 {
                color: #333333;
                margin-bottom: 20px;
                font-size: 24px;
            }
            p {
                color: #666666;
                margin-bottom: 30px;
                line-height: 1.6;
            }
            .btn {
                background: #007acc;
                color: white;
                border: none;
                padding: 12px 24px;
                border-radius: 4px;
                cursor: pointer;
                font-size: 14px;
                transition: background 0.3s;
            }
            .btn:hover {
                background: #0062a3;
            }
        </style>
    </head>
    <body>
        <div class="not-found">
            <div class="error-code">404</div>
            <h1>File Not Found</h1>
            <p>The file <strong>"${missingFile}"</strong> could not be found.</p>
            <button class="btn" onclick="history.back()">Go Back</button>
        </div>
    </body>
    </html>
  `, []);

  // Message handling
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === 'NAVIGATE_TO_FILE') {
        const { fileName } = event.data;
        const isInNewWindow = !event.source || (event.source as Window) !== window;

        if (isInNewWindow) {
          handleOpenInNewWindowWithFile(fileName);
          return;
        }

        const normalizedFileName = fileName.replace(/^\.?\//, '');
        const targetFile = files.find(f =>
          f.filename.toLowerCase() === normalizedFileName.toLowerCase() ||
          f.filename.toLowerCase().endsWith(normalizedFileName.toLowerCase())
        );

        if (targetFile) {
          setActiveFileId(targetFile.id);
          setCurrentPreviewFile(targetFile.filename);
          const newSrcDoc = generateSrcDocForFile(targetFile);
          setSrcDoc(newSrcDoc);
          toast.info(`Navigated to ${targetFile.filename}`, {
            autoClose: 2000,
            hideProgressBar: true
          });
        }
      }

      if (event.data.type === 'CREATE_FILE') {
        const { fileName } = event.data;
        const normalizedFileName = fileName.replace(/^\.?\//, '');

        const uniqueId = `file-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const extension = normalizedFileName.split('.').pop()?.toLowerCase();
        let language: FileType['language'] = 'html';

        if (extension === 'css') language = 'css';
        if (extension === 'js' || extension === 'javascript') language = 'javascript';
        if (extension === 'json') language = 'json';
        if (extension === 'md') language = 'markdown';
        if (extension === 'txt') language = 'text';
        if (extension === 'xml') language = 'xml';

        const newFile: FileType = {
          id: uniqueId,
          filename: normalizedFileName,
          content: getDefaultContent(language, normalizedFileName),
          language,
          path: '/',
          folderPath: '/',
          lastModified: new Date()
        };

        setFiles(prev => [...prev, newFile]);
        setActiveFileId(newFile.id);
        toast.success(`Created ${normalizedFileName}`);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [files, folders, handleOpenInNewWindowWithFile, generateSrcDocForFile]);

  // Get default content for new files
  const getDefaultContent = useCallback((language: FileType['language'], filename: string) => {
    const name = filename.replace(/\.[^/.]+$/, '');
    switch (language) {
      case 'html':
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${name}</title>
    <link rel="stylesheet" href="styles.css">
</head>
<body>
    <div class="container">
        <h1>${name}</h1>
        <p>Start building your ${name} page here!</p>
    </div>
    <script src="script.js"></script>
</body>
</html>`;
      case 'css':
        return `/* ${filename} */
.${name.toLowerCase().replace(/[^a-z0-9]/g, '-')} {
    /* Add your styles here */
}`;
      case 'javascript':
        return `// ${filename}
console.log('${filename} loaded');

// Your JavaScript code here
function init${name.charAt(0).toUpperCase() + name.slice(1)}() {
    console.log('${name} initialized');
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', init${name.charAt(0).toUpperCase() + name.slice(1)});`;
      case 'json':
        return `{
  "${name}": {
    "example": "data"
  }
}`;
      default:
        return `# ${filename}\n\nStart writing here...`;
    }
  }, []);

  // Auto-compile
  useEffect(() => {
    const timeout = setTimeout(compileCode, 500);
    return () => clearTimeout(timeout);
  }, [files, compileCode]);

  // File operations
  const handleFileContentChange = useCallback((content: string) => {
    setFiles(prev => prev.map(file =>
      file.id === activeFileId ? {
        ...file,
        content,
        lastModified: new Date(),
        isDirty: true
      } : file
    ));
  }, [activeFileId]);

  // Function to start creating a new folder
  const startCreatingFolder = useCallback(() => {
    setIsCreatingFolder(true);
    setNewFolderTempName('');
  }, []);

  // Function to create a new folder
  const createNewFolderInPlace = useCallback(() => {
    const folderName = newFolderTempName.trim();

    if (!folderName) {
      cancelFolderCreation();
      return;
    }

    if (folderName.includes('/') || folderName.includes('\\')) {
      toast.error("Folder name cannot contain slashes");
      cancelFolderCreation();
      return;
    }

    const parentPath = selectedFolderPath;
    const folderPath = parentPath === '/' ? `/${folderName}` : `${parentPath}/${folderName}`;

    const existingFolder = folders.find(f => f.path === folderPath);
    if (existingFolder) {
      toast.error(`Folder "${folderName}" already exists`);
      cancelFolderCreation();
      return;
    }

    const existingFile = files.find(f => f.path === folderPath);
    if (existingFile) {
      toast.error(`A file with name "${folderName}" already exists`);
      cancelFolderCreation();
      return;
    }

    const newFolder: FolderType = {
      id: `folder-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: folderName,
      path: folderPath,
      parentPath: parentPath,
      children: [],
      folderChildren: [],
      isOpen: true,
      depth: parentPath === '/' ? 0 : parentPath.split('/').filter(Boolean).length
    };

    setFolders(prev => [...prev, newFolder]);
    cancelFolderCreation();
    setSelectedFolderPath(folderPath);

    toast.success(`Created folder ${folderName} in ${parentPath === '/' ? 'root' : parentPath}`);
  }, [newFolderTempName, selectedFolderPath, folders, files]);

  // Function to cancel folder creation
  const cancelFolderCreation = useCallback(() => {
    setIsCreatingFolder(false);
    setNewFolderTempName('');
  }, []);

  // Create new folder (legacy)
  const createNewFolder = useCallback(() => {
    if (!newFolderName.trim()) {
      toast.error("Please enter a folder name");
      return;
    }

    if (newFolderName.includes('/') || newFolderName.includes('\\')) {
      toast.error("Folder name cannot contain slashes");
      return;
    }

    const parentPath = newFolderPath;
    const folderPath = parentPath === '/' ? `/${newFolderName}` : `${parentPath}/${newFolderName}`;

    const existingFolder = folders.find(f => f.path === folderPath);
    if (existingFolder) {
      toast.error(`Folder "${newFolderName}" already exists`);
      return;
    }

    const existingFile = files.find(f => f.path === folderPath);
    if (existingFile) {
      toast.error(`A file with name "${newFolderName}" already exists`);
      return;
    }

    const newFolder: FolderType = {
      id: `folder-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: newFolderName.trim(),
      path: folderPath,
      parentPath: parentPath,
      children: [],
      folderChildren: [],
      isOpen: true,
      depth: parentPath === '/' ? 0 : parentPath.split('/').filter(Boolean).length
    };

    setFolders(prev => [...prev, newFolder]);
    setNewFolderName('');
    setNewFolderPath('/');
    setShowNewFolderForm(false);
    toast.success(`Created folder ${newFolderName} in ${parentPath === '/' ? 'root' : parentPath}`);
  }, [newFolderName, newFolderPath, folders, files]);

  // Toggle folder open/close
  const toggleFolder = useCallback((folderId: string) => {
    setFolders(prev => prev.map(folder =>
      folder.id === folderId ? { ...folder, isOpen: !folder.isOpen } : folder
    ));
  }, []);

  // Add new file (legacy)
  const addNewFile = useCallback(() => {
    if (!newFileName.trim()) {
      toast.error("Please enter a file name");
      return;
    }

    // Enforce exercise's selectedLanguages restriction
    const check = checkExtensionAllowed(newFileName);
    if (!check.ok) {
      toast.error(check.message);
      return;
    }

    const extension = newFileName.split('.').pop()?.toLowerCase();
    let language: FileType['language'] = 'html';

    if (extension === 'css') language = 'css';
    if (extension === 'js' || extension === 'javascript') language = 'javascript';
    if (extension === 'json') language = 'json';
    if (extension === 'md') language = 'markdown';
    if (extension === 'txt') language = 'text';
    if (extension === 'xml') language = 'xml';

    const folderPath = newFilePath;
    const fullPath = folderPath === '/' ? `/${newFileName}` : `${folderPath}/${newFileName}`;

    const existingFile = files.find(f => f.path === fullPath);
    if (existingFile) {
      toast.error(`File "${newFileName}" already exists at this location`);
      return;
    }

    const uniqueId = `file-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newFile: FileType = {
      id: uniqueId,
      filename: newFileName.trim(),
      content: getDefaultContent(language, newFileName),
      language,
      path: fullPath,
      folderPath: folderPath,
      lastModified: new Date()
    };

    setFiles(prev => [...prev, newFile]);
    setActiveFileId(newFile.id);
    setNewFileName('');
    setNewFilePath('/');
    setShowNewFileForm(false);
    toast.success(`Created ${newFileName} in ${folderPath === '/' ? 'root' : folderPath}`);
  }, [newFileName, newFilePath, files, getDefaultContent]);

  // Delete file
  const deleteFile = useCallback((fileId: string) => {
    const fileToDelete = files.find(f => f.id === fileId);
    if (!fileToDelete) return;

    if (fileToDelete.isEntryPoint) {
      toast.error("Cannot delete entry point file");
      return;
    }

    if (files.length <= 1) {
      toast.error("Cannot delete the last file");
      return;
    }

    const newFiles = files.filter(f => f.id !== fileId);
    setFiles(newFiles);

    if (activeFileId === fileId) {
      setActiveFileId(newFiles[0].id);
    }

    toast.success(`Deleted ${fileToDelete.filename}`);
  }, [files, activeFileId]);

  // Rename file
  const renameFile = useCallback(() => {
    if (!renameValue.trim() || !isRenaming) return;

    const file = files.find(f => f.id === isRenaming);
    if (!file) return;

    // Enforce exercise's selectedLanguages restriction
    const check = checkExtensionAllowed(renameValue);
    if (!check.ok) {
      toast.error(check.message);
      return;
    }

    const newPath = `${file.folderPath}/${renameValue}`;
    const existingFile = files.find(f => f.path === newPath && f.id !== isRenaming);

    if (existingFile) {
      toast.error("A file with this name already exists");
      return;
    }

    setFiles(prev => prev.map(file =>
      file.id === isRenaming ? {
        ...file,
        filename: renameValue,
        path: newPath,
        lastModified: new Date()
      } : file
    ));

    setIsRenaming(null);
    setRenameValue('');
    toast.success("File renamed");
  }, [isRenaming, renameValue, files]);

  // Set file as entry point
  const setAsEntryPoint = useCallback((fileId: string) => {
    setFiles(prev => prev.map(file => ({
      ...file,
      isEntryPoint: file.id === fileId
    })));
    toast.success("Set as entry point");
  }, []);

  // Function to create a new file in the selected folder
  const createNewFileInSelectedFolder = useCallback(() => {
    const fileName = newFileTempName.trim();

    if (!fileName) {
      cancelFileCreation();
      return;
    }

    if (!selectedFolderPath) {
      toast.error("Please select a folder first");
      cancelFileCreation();
      return;
    }

    if (selectedFolderPath !== '/') {
      const folderExists = folders.some(folder => folder.path === selectedFolderPath);
      if (!folderExists) {
        toast.error("Selected folder doesn't exist");
        cancelFileCreation();
        return;
      }
    }

    // Enforce exercise's selectedLanguages restriction
    const check = checkExtensionAllowed(fileName);
    if (!check.ok) {
      toast.error(check.message);
      cancelFileCreation();
      return;
    }

    const extension = fileName.split('.').pop()?.toLowerCase();
    let language: FileType['language'] = 'html';

    if (extension === 'css') language = 'css';
    if (extension === 'js' || extension === 'javascript') language = 'javascript';
    if (extension === 'json') language = 'json';
    if (extension === 'md') language = 'markdown';
    if (extension === 'txt') language = 'text';
    if (extension === 'xml') language = 'xml';

    const fullPath = selectedFolderPath === '/' ? `/${fileName}` : `${selectedFolderPath}/${fileName}`;

    const existingFile = files.find(f => f.path === fullPath);
    if (existingFile) {
      toast.error(`File "${fileName}" already exists`);
      cancelFileCreation();
      return;
    }

    const uniqueId = `file-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newFile: FileType = {
      id: uniqueId,
      filename: fileName,
      content: getDefaultContent(language, fileName),
      language,
      path: fullPath,
      folderPath: selectedFolderPath,
      lastModified: new Date()
    };

    setFiles(prev => [...prev, newFile]);
    setActiveFileId(newFile.id);
    if (!openFiles.includes(newFile.id)) {
      setOpenFiles(prev => [...prev, newFile.id]);
    }

    cancelFileCreation();

    if (selectedFolderPath !== '/') {
      const parentFolder = folders.find(f => f.path === selectedFolderPath);
      if (parentFolder && !parentFolder.isOpen) {
        toggleFolder(parentFolder.id);
      }
    }

    toast.success(`Created ${fileName} in ${selectedFolderPath === '/' ? 'root' : selectedFolderPath}`);
  }, [newFileTempName, selectedFolderPath, folders, files, getDefaultContent, openFiles, toggleFolder]);

  // Function to cancel file creation
  const cancelFileCreation = useCallback(() => {
    setIsCreatingFile(false);
    setNewFileTempName('');
    setNewFileTempPath('');
  }, []);

  // Function to start creating a new file
  const startCreatingFile = useCallback(() => {
    if (!selectedFolderPath) {
      toast.error("Please select a folder first");
      return;
    }

    setIsCreatingFile(true);
    setNewFileTempPath(selectedFolderPath);
    setNewFileTempName('');
  }, [selectedFolderPath]);

  // Update the folder selection logic
  const handleFolderSelect = useCallback((folderPath: string) => {
    setSelectedFolderPath(folderPath);

    if (isCreatingFile) {
      setNewFileTempPath(folderPath);
    }
  }, [isCreatingFile]);

  // Add keyboard shortcut for creating new file
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'n' && !e.shiftKey) {
        e.preventDefault();
        startCreatingFile();
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'N' && e.shiftKey) {
        e.preventDefault();
        startCreatingFolder();
      }

      if (e.key === 'Escape') {
        if (isCreatingFile) {
          e.preventDefault();
          cancelFileCreation();
        }
        if (isCreatingFolder) {
          e.preventDefault();
          cancelFolderCreation();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isCreatingFile, isCreatingFolder, startCreatingFile, startCreatingFolder, cancelFileCreation, cancelFolderCreation]);

  // Update the toggleFolder function to also select the folder
  const toggleFolderWithSelection = useCallback((folderId: string) => {
    const folder = folders.find(f => f.id === folderId);
    if (folder) {
      setSelectedFolderPath(folder.path);
      toggleFolder(folder.id);
    }
  }, [folders, toggleFolder]);

  // Handle file drop
  const handleFileDrop = useCallback((fileId: string, targetFolderPath: string) => {
    const file = files.find(f => f.id === fileId);
    if (!file) return;

    if (file.folderPath === targetFolderPath) return;

    const newPath = targetFolderPath === '/' ? `/${file.filename}` : `${targetFolderPath}/${file.filename}`;

    const existingFile = files.find(f => f.path === newPath && f.id !== fileId);
    if (existingFile) {
      toast.error(`A file with this name already exists in the target folder`);
      return;
    }

    setFiles(prev => prev.map(f =>
      f.id === fileId ? {
        ...f,
        folderPath: targetFolderPath,
        path: newPath,
        lastModified: new Date()
      } : f
    ));

    toast.success(`Moved ${file.filename} to ${targetFolderPath === '/' ? 'root' : targetFolderPath}`);
  }, [files]);

  const handleRenameSubmit = useCallback(() => {
    if (!renameTarget || !tempRenameValue.trim()) {
      cancelRename();
      return;
    }

    const newName = tempRenameValue.trim();

    if (renameTarget.type === 'file') {
      // Rename file
      const file = files.find(f => f.id === renameTarget.id);
      if (!file) {
        cancelRename();
        return;
      }

      // Validate filename
      if (newName.includes('/') || newName.includes('\\')) {
        toast.error("File name cannot contain slashes");
        cancelRename();
        return;
      }

      // Enforce exercise's selectedLanguages restriction
      const check = checkExtensionAllowed(newName);
      if (!check.ok) {
        toast.error(check.message);
        cancelRename();
        return;
      }

      // Check for existing file with same name in same folder
      const existingFile = files.find(f =>
        f.folderPath === file.folderPath &&
        f.filename === newName &&
        f.id !== file.id
      );
      if (existingFile) {
        toast.error(`File "${newName}" already exists in this folder`);
        cancelRename();
        return;
      }

      // Update file
      setFiles(prev => prev.map(f =>
        f.id === file.id ? {
          ...f,
          filename: newName,
          path: `${file.folderPath}/${newName}`,
          lastModified: new Date(),
          isDirty: true
        } : f
      ));

      toast.success(`Renamed to ${newName}`);

    } else {
      // Rename folder
      const folder = folders.find(f => f.id === renameTarget.id);
      if (!folder) {
        cancelRename();
        return;
      }

      // Validate folder name
      if (newName.includes('/') || newName.includes('\\')) {
        toast.error("Folder name cannot contain slashes");
        cancelRename();
        return;
      }

      const newPath = folder.parentPath === '/' ? `/${newName}` : `${folder.parentPath}/${newName}`;

      // Check for existing folder with same name in same parent
      const existingFolder = folders.find(f =>
        f.parentPath === folder.parentPath &&
        f.name === newName &&
        f.id !== folder.id
      );
      if (existingFolder) {
        toast.error(`Folder "${newName}" already exists here`);
        cancelRename();
        return;
      }

      // Check for existing file with same name in same parent
      const existingFile = files.find(f =>
        f.folderPath === folder.parentPath &&
        f.filename === newName
      );
      if (existingFile) {
        toast.error(`A file with name "${newName}" already exists here`);
        cancelRename();
        return;
      }

      // Update folder and all its subfolders and files
      const oldPath = folder.path;
      const pathPrefix = oldPath === '/' ? '' : oldPath;

      // Update folder name
      setFolders(prev => prev.map(f =>
        f.id === folder.id ? {
          ...f,
          name: newName,
          path: newPath
        } : f
      ));

      // Update subfolder paths
      setFolders(prev => prev.map(f => {
        if (f.path.startsWith(oldPath + '/') && f.id !== folder.id) {
          const relativePath = f.path.substring(oldPath.length);
          return {
            ...f,
            path: newPath + relativePath,
            parentPath: f.parentPath === oldPath ? newPath : f.parentPath.replace(oldPath, newPath)
          };
        }
        return f;
      }));

      // Update file paths in this folder and subfolders
      setFiles(prev => prev.map(f => {
        if (f.folderPath.startsWith(oldPath)) {
          const newFolderPath = f.folderPath.replace(oldPath, newPath);
          return {
            ...f,
            folderPath: newFolderPath,
            path: `${newFolderPath}/${f.filename}`,
            lastModified: new Date()
          };
        }
        return f;
      }));

      toast.success(`Renamed folder to ${newName}`);
    }

    cancelRename();
  }, [renameTarget, tempRenameValue, files, folders]);

  const cancelRename = useCallback(() => {
    setRenameTarget(null);
    setTempRenameValue('');
  }, []);

  const handleDeleteFolder = useCallback((folderId: string) => {
    const folder = folders.find(f => f.id === folderId);
    if (!folder) return;

    // Check if folder is empty
    const folderFiles = files.filter(f => f.folderPath === folder.path);
    const subfolders = folders.filter(f => f.parentPath === folder.path);

    if (folderFiles.length > 0 || subfolders.length > 0) {
      if (!window.confirm(`Delete folder "${folder.name}" and all its contents (${folderFiles.length} files, ${subfolders.length} folders)?`)) {
        return;
      }
    }

    // Delete all files in this folder and subfolders
    const filesToDelete = files.filter(f => f.folderPath.startsWith(folder.path));
    const newFiles = files.filter(f => !filesToDelete.map(fd => fd.id).includes(f.id));

    // Delete the folder and all subfolders
    const foldersToDelete = [folderId, ...folders.filter(f => f.path.startsWith(folder.path + '/')).map(f => f.id)];
    const newFolders = folders.filter(f => !foldersToDelete.includes(f.id));

    setFiles(newFiles);
    setFolders(newFolders);

    // Clean up open files
    const openFilesToRemove = filesToDelete.map(f => f.id);
    setOpenFiles(prev => prev.filter(id => !openFilesToRemove.includes(id)));

    // Update active file if needed
    if (openFilesToRemove.includes(activeFileId) && newFiles.length > 0) {
      setActiveFileId(newFiles[0].id);
    }

    // Reset selected folder if it was deleted
    if (selectedFolderPath.startsWith(folder.path)) {
      setSelectedFolderPath('/');
    }

    toast.success(`Deleted folder "${folder.name}" and its contents`);
  }, [files, folders, activeFileId, openFiles, selectedFolderPath]);

  // Trigger rename with F2 key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault();

        // If a file is selected, start renaming it
        if (activeFileId) {
          const file = files.find(f => f.id === activeFileId);
          if (file) {
            setRenameTarget({
              id: file.id,
              type: 'file',
              name: file.filename,
              path: file.folderPath
            });
            setTempRenameValue(file.filename);
          }
        }

        // If a folder is selected, start renaming it
        else if (selectedFolderPath && selectedFolderPath !== '/') {
          const folder = folders.find(f => f.path === selectedFolderPath);
          if (folder) {
            setRenameTarget({
              id: folder.id,
              type: 'folder',
              name: folder.name,
              path: folder.parentPath
            });
            setTempRenameValue(folder.name);
          }
        }
      }

      // Close context menu with Escape
      if (e.key === 'Escape') {
        if (contextMenu) {
          setContextMenu(null);
        }
        if (renameTarget) {
          cancelRename();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeFileId, selectedFolderPath, files, folders, contextMenu, renameTarget, cancelRename]);

  // Close context menu when clicking elsewhere
  useEffect(() => {
    const handleClick = () => {
      if (contextMenu) {
        setContextMenu(null);
      }
    };

    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, [contextMenu]);

  // Submit function
  const handleSubmit = async () => {
    const questionId = getQuestionId();

    if (!courseId || !exerciseId || !questionId) {
      toast.error("❌ Missing required IDs");
      return;
    }

    const currentAttempts = userAttempts[questionId] || 0;
    if (attemptLimitEnabled && currentAttempts >= maxAttempts) {
      toast.error(`❌ Maximum attempts (${maxAttempts}) reached`);
      return;
    }

    setIsSubmitting(true);

    try {
      const token = getToken() || localStorage.getItem('token') || '';

      if (!token) {
        toast.error("❌ Authentication token missing");
        return;
      }

      // ── Is this the last question? ──────────────────────────────────────────
      const isLastQuestion = currentQuestionIndex === questions.length - 1;

      const payload = {
        courseId,
        exerciseId,
        questionId,
        questionTitle: currentQuestion?.title || `Question ${currentQuestionIndex + 1}`,
        exerciseName: title,
        category,
        subcategory,
        selectedProgrammingLanguage: selectedProgrammingLanguage || 'html/css/javascript',
        nodeId: entityId,
        nodeName: title,
        nodeType: entityType,
        files: files.map(file => ({
          id: file.id,
          filename: file.filename,
          content: file.content,
          language: file.language,
          path: file.path,
          folderPath: file.folderPath,
          isEntryPoint: file.isEntryPoint || false,
          lastModified: file.lastModified || new Date()
        })),
        folders: folders.map(folder => ({
          id: folder.id,
          name: folder.name,
          path: folder.path,
          parentPath: folder.parentPath,
          depth: folder.depth
        })),
        status: 'submitted',
        score: 0,
        attemptCount: currentAttempts + 1,
        // ── NEW: mark testSubmission on last question ──────────────────────────
        ...(isLastQuestion && { isTestSubmission: true }),
      };

      const response = await axios.post(
        'https://lmsserver-yeve.onrender.com/courses/answers/submit-multiple-files',
        payload,
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          timeout: 30000
        }
      );

      if (response.data.success) {
        setUserAttempts(prev => ({
          ...prev,
          [questionId]: currentAttempts + 1
        }));

        // ── Show different message on last question ────────────────────────────
        if (isLastQuestion) {
          toast.success(`✅ Exercise submitted successfully!`);
        } else {
          toast.success(`✅ Submitted ${response.data.data.fileCount} files successfully!`);
          setTimeout(() => {
            setCurrentQuestionIndex(prev => prev + 1);
          }, 1500);
        }
      } else {
        toast.error(`❌ Submission failed: ${response.data.message}`);
      }
    } catch (error: any) {
      console.error("❌ Submission error:", error);
      toast.error(`❌ Error: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Local storage
  const saveFilesLocally = useCallback(() => {
    const questionId = getQuestionId();
    const projectData = {
      files,
      folders,
      timestamp: new Date().toISOString(),
      questionId,
      exerciseId,
      courseId,
      activeFileId
    };
    localStorage.setItem(`project_${exerciseId}_${questionId || 'default'}`, JSON.stringify(projectData));
    toast.success("Project saved locally");
  }, [files, folders, getQuestionId, exerciseId, courseId, activeFileId]);

  const loadLocalFiles = useCallback(() => {
    const questionId = getQuestionId();
    const saved = localStorage.getItem(`project_${exerciseId}_${questionId || 'default'}`);
    if (saved) {
      try {
        const data = JSON.parse(saved);
        setFiles(data.files);
        setFolders(data.folders);
        if (data.files.length > 0) {
          setActiveFileId(data.activeFileId || data.files[0].id);
        }
        toast.success("Project loaded from local storage");
      } catch (error) {
        toast.error("Failed to load project");
      }
    }
  }, [getQuestionId, exerciseId]);

  // Get language icon with theme support
  const getLanguageIcon = useCallback((language: string) => {
    const iconColor = theme === 'light' ? {
      html: '#e34c26',
      css: '#264de4',
      javascript: '#f0db4f',
      json: '#4ec9b0',
      xml: '#f06529',
      markdown: '#666666',
      default: '#333333'
    } : {
      html: '#e34c26',
      css: '#264de4',
      javascript: '#f0db4f',
      json: '#4ec9b0',
      xml: '#f06529',
      markdown: '#858585',
      default: '#cccccc'
    };

    switch (language) {
      case 'html': return <FileCode className="text-[#e34c26]" size={14} />;
      case 'css': return <Palette className="text-[#264de4]" size={14} />;
      case 'javascript': return <Terminal className="text-[#f0db4f]" size={14} />;
      case 'json': return <FileJson className="text-[#4ec9b0]" size={14} />;
      case 'xml': return <FileCode className="text-[#f06529]" size={14} />;
      case 'markdown': return <FileText className={theme === 'light' ? "text-[#666666]" : "text-[#858585]"} size={14} />;
      default: return <FileText className={theme === 'light' ? "text-[#333333]" : "text-[#cccccc]"} size={14} />;
    }
  }, [theme]);

  // ---------------------------------------------------------------------------
  // FIXED RENDER FILE TREE FUNCTION - NO RECURSION
  // ---------------------------------------------------------------------------
  const renderFileTree = useCallback(() => {
    // Helper function to get files in a specific folder
    const getFilesInFolder = (folderPath: string) => {
      return files.filter(file => file.folderPath === folderPath);
    };

    // Helper function to get subfolders of a specific folder
    const getSubfolders = (folderPath: string) => {
      return folders.filter(folder => folder.parentPath === folderPath);
    };

    // Main render function for a folder
    const renderFolder = (folder: FolderType, depth: number = 0) => {
      const folderFiles = getFilesInFolder(folder.path);
      const subfolders = getSubfolders(folder.path);
      const isSelected = selectedFolderPath === folder.path;
      const isCreatingFileHere = isCreatingFile && newFileTempPath === folder.path;
      const isCreatingFolderHere = isCreatingFolder && selectedFolderPath === folder.path;
      const isRenaming = renameTarget?.id === folder.id && renameTarget?.type === 'folder';

      // For renaming folder
      if (isRenaming) {
        return (
          <div key={folder.id} className="mt-0.5">
            <div
              className="flex items-center gap-2 px-2 py-1.5"
              style={{ marginLeft: `${depth * 12}px` }}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <ChevronDown
                size={12}
                className={`transition-transform flex-shrink-0 ${folder.isOpen ? 'rotate-0' : '-rotate-90'} ${theme === 'light' ? 'text-[#666666]' : 'text-[#858585]'}`}
              />
              <Folder size={14} className="flex-shrink-0 text-[#4ec9b0]" />
              <input
                type="text"
                value={tempRenameValue}
                onChange={(e) => setTempRenameValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleRenameSubmit();
                  }
                  if (e.key === 'Escape') {
                    e.preventDefault();
                    cancelRename();
                  }
                }}
                onBlur={() => {
                  setTimeout(() => {
                    if (tempRenameValue.trim() && tempRenameValue !== folder.name) {
                      handleRenameSubmit();
                    } else {
                      cancelRename();
                    }
                  }, 100);
                }}
                className={`flex-1 bg-transparent border-b border-[#4ec9b0] outline-none ${theme === 'light' ? 'text-[#333333]' : 'text-[#cccccc]'} text-sm px-1`}
                autoFocus
                ref={(input) => {
                  if (input) {
                    input.focus();
                    input.select();
                  }
                }}
              />
            </div>
          </div>
        );
      }

      return (
        <div key={folder.id} className="mt-0.5">
          {/* Folder row */}
          <div
            className={`flex items-center gap-2 px-2 py-1.5 hover:bg-[${colors.hoverBg}] rounded cursor-pointer text-sm ${isSelected ? `bg-[${colors.selectedBg}]` : ''}`}
            style={{ marginLeft: `${depth * 12}px` }}
            onClick={() => {
              handleFolderSelect(folder.path);
              toggleFolder(folder.id);
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setContextMenu({
                x: e.clientX,
                y: e.clientY,
                type: 'folder',
                id: folder.id,
                name: folder.name
              });
            }}
            onDoubleClick={(e) => {
              if (e.detail === 2) {
                e.stopPropagation();
                setRenameTarget({
                  id: folder.id,
                  type: 'folder',
                  name: folder.name,
                  path: folder.parentPath
                });
                setTempRenameValue(folder.name);
              }
            }}
          >
            <ChevronDown
              size={12}
              className={`transition-transform flex-shrink-0 ${folder.isOpen ? 'rotate-0' : '-rotate-90'} ${theme === 'light' ? 'text-[#666666]' : 'text-[#858585]'}`}
            />
            <Folder size={14} className="flex-shrink-0 text-[#4ec9b0]" />
            <span className={`flex-1 truncate ${theme === 'light' ? 'text-[#333333]' : 'text-[#cccccc]'}`}>{folder.name}</span>
            <span className={`text-xs ${theme === 'light' ? 'text-[#666666] bg-[#e5e5e5]' : 'text-[#858585] bg-[#2d2d2d]'} px-1.5 py-0.5 rounded`}>
              {folderFiles.length + subfolders.length}
            </span>
          </div>

          {/* Folder contents - only show if folder is open */}
          {folder.isOpen && (
            <div>
              {/* Render subfolders */}
              {subfolders.map(subfolder => renderFolder(subfolder, depth + 1))}

              {/* New folder input field */}
              {isCreatingFolderHere && (
                <div
                  className="flex items-center gap-2 px-2 py-1.5"
                  style={{ marginLeft: `${(depth + 1) * 12}px` }}
                >
                  <FolderPlus size={14} className="flex-shrink-0 text-[#4ec9b0]" />
                  <input
                    type="text"
                    value={newFolderTempName}
                    onChange={(e) => setNewFolderTempName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        createNewFolderInPlace();
                      }
                      if (e.key === 'Escape') {
                        e.preventDefault();
                        cancelFolderCreation();
                      }
                    }}
                    onBlur={() => {
                      setTimeout(() => {
                        if (newFolderTempName.trim()) {
                          createNewFolderInPlace();
                        } else {
                          cancelFolderCreation();
                        }
                      }, 100);
                    }}
                    className={`flex-1 bg-transparent border-b border-[#4ec9b0] outline-none ${theme === 'light' ? 'text-[#333333]' : 'text-[#cccccc]'} text-sm px-1`}
                    placeholder="Folder name"
                    autoFocus
                  />
                </div>
              )}

              {/* Render files in folder */}
              {folderFiles.map(file => {
                const isRenamingFile = renameTarget?.id === file.id && renameTarget?.type === 'file';

                if (isRenamingFile) {
                  return (
                    <div
                      key={file.id}
                      className="flex items-center gap-2 px-2 py-1.5"
                      style={{ marginLeft: `${(depth + 1) * 12}px` }}
                      onMouseDown={(e) => e.stopPropagation()}
                    >
                      {getLanguageIcon(file.language)}
                      <input
                        type="text"
                        value={tempRenameValue}
                        onChange={(e) => setTempRenameValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleRenameSubmit();
                          }
                          if (e.key === 'Escape') {
                            e.preventDefault();
                            cancelRename();
                          }
                        }}
                        onBlur={() => {
                          setTimeout(() => {
                            if (tempRenameValue.trim() && tempRenameValue !== file.filename) {
                              handleRenameSubmit();
                            } else {
                              cancelRename();
                            }
                          }, 100);
                        }}
                        className={`flex-1 bg-transparent border-b border-[#007acc] outline-none ${theme === 'light' ? 'text-[#333333]' : 'text-[#cccccc]'} text-sm px-1`}
                        autoFocus
                        ref={(input) => {
                          if (input) {
                            input.focus();
                            input.select();
                          }
                        }}
                      />
                    </div>
                  );
                }

                return (
                  <div key={file.id}
                    className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer text-sm group ${activeFileId === file.id
                      ? `bg-[${colors.selectedBg}]`
                      : `hover:bg-[${colors.hoverBg}]`
                      }`}
                    style={{ marginLeft: `${(depth + 1) * 12}px` }}
                    onClick={() => {
                      setActiveFileId(file.id);
                      if (!openFiles.includes(file.id)) {
                        setOpenFiles(prev => [...prev, file.id]);
                      }
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setContextMenu({
                        x: e.clientX,
                        y: e.clientY,
                        type: 'file',
                        id: file.id,
                        name: file.filename
                      });
                    }}
                    onDoubleClick={(e) => {
                      if (e.detail === 2) {
                        e.stopPropagation();
                        setRenameTarget({
                          id: file.id,
                          type: 'file',
                          name: file.filename,
                          path: file.folderPath
                        });
                        setTempRenameValue(file.filename);
                      }
                    }}
                  >
                    {getLanguageIcon(file.language)}
                    <span className={`flex-1 truncate ${theme === 'light' ? 'text-[#333333]' : 'text-[#cccccc]'}`}>{file.filename}</span>

                    {file.isEntryPoint && (
                      <Star size={12} className="flex-shrink-0 text-[#dcdcaa]" title="Entry Point" />
                    )}

                    {file.isDirty && !isRenamingFile && (
                      <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: colors.primary }} />
                    )}

                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setRenameTarget({
                            id: file.id,
                            type: 'file',
                            name: file.filename,
                            path: file.folderPath
                          });
                          setTempRenameValue(file.filename);
                        }}
                        className="p-0.5 hover:bg-[#d5d5d5] dark:hover:bg-[#3e3e42] rounded"
                        title="Rename (F2)"
                      >
                        <Edit2 size={10} className={theme === 'light' ? 'text-[#666666]' : 'text-[#858585]'} />
                      </button>

                      {!file.isEntryPoint && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteFile(file.id);
                          }}
                          className="p-0.5 hover:bg-[#e53935] hover:text-white rounded"
                          title="Delete"
                        >
                          <Trash2 size={10} className="currentColor" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* New file input field */}
              {isCreatingFileHere && (
                <div
                  className="flex items-center gap-2 px-2 py-1.5"
                  style={{ marginLeft: `${(depth + 1) * 12}px` }}
                >
                  <FilePlus size={14} className="flex-shrink-0 text-[#666666]" />
                  <input
                    type="text"
                    value={newFileTempName}
                    onChange={(e) => setNewFileTempName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        createNewFileInSelectedFolder();
                      }
                      if (e.key === 'Escape') {
                        e.preventDefault();
                        cancelFileCreation();
                      }
                    }}
                    onBlur={() => {
                      setTimeout(() => {
                        if (newFileTempName.trim()) {
                          createNewFileInSelectedFolder();
                        } else {
                          cancelFileCreation();
                        }
                      }, 100);
                    }}
                    className={`flex-1 bg-transparent border-b border-[#007acc] outline-none ${theme === 'light' ? 'text-[#333333]' : 'text-[#cccccc]'} text-sm px-1`}
                    placeholder="File name (e.g., app.js)"
                    autoFocus
                  />
                </div>
              )}
            </div>
          )}
        </div>
      );
    };

    // Get root level files and folders
    const rootFiles = getFilesInFolder('/');
    const rootFolders = getSubfolders('/');
    const isRootSelected = selectedFolderPath === '/';
    const isCreatingFileInRoot = isCreatingFile && newFileTempPath === '/';
    const isCreatingFolderInRoot = isCreatingFolder && selectedFolderPath === '/';

    return (
      <div className="space-y-0.5 p-2">
        {/* Root files */}
        {rootFiles.map(file => {
          const isRenaming = renameTarget?.id === file.id && renameTarget?.type === 'file';

          if (isRenaming) {
            return (
              <div
                key={file.id}
                className="flex items-center gap-2 px-2 py-1.5"
                onMouseDown={(e) => e.stopPropagation()}
              >
                {getLanguageIcon(file.language)}
                <input
                  type="text"
                  value={tempRenameValue}
                  onChange={(e) => setTempRenameValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleRenameSubmit();
                    if (e.key === 'Escape') cancelRename();
                  }}
                  onBlur={() => {
                    setTimeout(() => {
                      if (tempRenameValue.trim() && tempRenameValue !== file.filename) {
                        handleRenameSubmit();
                      } else {
                        cancelRename();
                      }
                    }, 100);
                  }}
                  className={`flex-1 bg-transparent border-b border-[#007acc] outline-none ${theme === 'light' ? 'text-[#333333]' : 'text-[#cccccc]'} text-sm px-1`}
                  autoFocus
                  ref={(input) => {
                    if (input) {
                      input.focus();
                      input.select();
                    }
                  }}
                />
              </div>
            );
          }

          return (
            <div
              key={file.id}
              className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer text-sm group ${activeFileId === file.id
                ? `bg-[${colors.selectedBg}]`
                : `hover:bg-[${colors.hoverBg}]`
                }`}
              onClick={() => {
                setActiveFileId(file.id);
                if (!openFiles.includes(file.id)) {
                  setOpenFiles(prev => [...prev, file.id]);
                }
                setSelectedFolderPath('/'); // Select root when clicking root file
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setContextMenu({
                  x: e.clientX,
                  y: e.clientY,
                  type: 'file',
                  id: file.id,
                  name: file.filename
                });
              }}
              onDoubleClick={(e) => {
                if (e.detail === 2) { // Double-click detection
                  e.stopPropagation();
                  setRenameTarget({
                    id: file.id,
                    type: 'file',
                    name: file.filename,
                    path: file.folderPath
                  });
                  setTempRenameValue(file.filename);
                }
              }}
            >
              {getLanguageIcon(file.language)}
              <span className={`flex-1 truncate ${theme === 'light' ? 'text-[#333333]' : 'text-[#cccccc]'}`}>
                {file.filename}
              </span>

              {file.isEntryPoint && (
                <Star
                  size={12}
                  className="flex-shrink-0 text-[#dcdcaa]"
                  title="Entry Point"
                  onClick={(e) => {
                    e.stopPropagation();
                    setAsEntryPoint(file.id);
                  }}
                />
              )}

              {file.isDirty && !isRenaming && (
                <div
                  className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: colors.primary }}
                  title="Unsaved changes"
                />
              )}

              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {file.isEntryPoint && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setAsEntryPoint(file.id);
                    }}
                    className="p-0.5 hover:bg-[#d5d5d5] dark:hover:bg-[#3e3e42] rounded"
                    title="Entry point (click to change)"
                  >
                    <Star size={10} className="text-[#dcdcaa]" />
                  </button>
                )}

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setRenameTarget({
                      id: file.id,
                      type: 'file',
                      name: file.filename,
                      path: file.folderPath
                    });
                    setTempRenameValue(file.filename);
                  }}
                  className="p-0.5 hover:bg-[#d5d5d5] dark:hover:bg-[#3e3e42] rounded"
                  title="Rename (F2)"
                >
                  <Edit2 size={10} className={theme === 'light' ? 'text-[#666666]' : 'text-[#858585]'} />
                </button>

                {!file.isEntryPoint && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteFile(file.id);
                    }}
                    className="p-0.5 hover:bg-[#e53935] hover:text-white rounded"
                    title="Delete"
                  >
                    <Trash2 size={10} className="currentColor" />
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {/* New folder input field for root */}
        {isCreatingFolderInRoot && (
          <div className="flex items-center gap-2 px-2 py-1.5">
            <FolderPlus size={14} className="flex-shrink-0 text-[#4ec9b0]" />
            <input
              type="text"
              value={newFolderTempName}
              onChange={(e) => setNewFolderTempName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  createNewFolderInPlace();
                }
                if (e.key === 'Escape') {
                  e.preventDefault();
                  cancelFolderCreation();
                }
              }}
              onBlur={() => {
                setTimeout(() => {
                  if (newFolderTempName.trim()) {
                    createNewFolderInPlace();
                  } else {
                    cancelFolderCreation();
                  }
                }, 100);
              }}
              className={`flex-1 bg-transparent border-b border-[#4ec9b0] outline-none ${theme === 'light' ? 'text-[#333333]' : 'text-[#cccccc]'} text-sm px-1`}
              placeholder="Folder name"
              autoFocus
            />
          </div>
        )}

        {/* New file input field for root */}
        {isCreatingFileInRoot && (
          <div className="flex items-center gap-2 px-2 py-1.5">
            <FilePlus size={14} className="flex-shrink-0 text-[#666666]" />
            <input
              type="text"
              value={newFileTempName}
              onChange={(e) => setNewFileTempName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  createNewFileInSelectedFolder();
                }
                if (e.key === 'Escape') {
                  e.preventDefault();
                  cancelFileCreation();
                }
              }}
              onBlur={() => {
                setTimeout(() => {
                  if (newFileTempName.trim()) {
                    createNewFileInSelectedFolder();
                  } else {
                    cancelFileCreation();
                  }
                }, 100);
              }}
              className={`flex-1 bg-transparent border-b border-[#007acc] outline-none ${theme === 'light' ? 'text-[#333333]' : 'text-[#cccccc]'} text-sm px-1`}
              placeholder="File name (e.g., app.js)"
              autoFocus
            />
          </div>
        )}

        {/* Root folders */}
        {rootFolders.map(folder => renderFolder(folder, 0))}

        {/* "No folder selected" message */}
        {!isCreatingFile && !isCreatingFolder && !renameTarget && (
          <div className={`text-xs ${theme === 'light' ? 'text-[#666666]' : 'text-[#858585]'} italic px-2 py-3 text-center`}>
            {selectedFolderPath === '/'
              ? "Root folder selected. Click 'New File' or 'New Folder' to create."
              : `Selected: ${selectedFolderPath.split('/').pop()} folder`
            }
          </div>
        )}
      </div>
    );
  }, [files, folders, activeFileId, toggleFolder, getLanguageIcon, openFiles, selectedFolderPath, isCreatingFile, isCreatingFolder, newFileTempPath, newFileTempName, newFolderTempName, handleFolderSelect, createNewFileInSelectedFolder, cancelFileCreation, createNewFolderInPlace, cancelFolderCreation, theme, colors, renameTarget, tempRenameValue, handleRenameSubmit, cancelRename, deleteFile, setAsEntryPoint]);

  // ---------------------------------------------------------------------------
  // RENDER CONDITIONS
  // ---------------------------------------------------------------------------
  if (isTerminated || isLocked) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-white p-4">
        <div className="bg-white p-8 rounded-xl border border-red-200 max-w-md text-center shadow-lg">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2 text-gray-900">
            {terminationReason?.includes('completed') ? 'Assessment Completed' : 'Access Terminated'}
          </h2>
          <p className="text-red-600 mb-6">
            {terminationReason || "You have been locked out of this exercise."}
          </p>
          <button onClick={performExit} className="bg-gray-800 px-6 py-2 rounded-lg hover:bg-gray-900 text-white font-bold transition-colors">
            Exit to Course
          </button>
        </div>
      </div>
    );
  }

  if (showSubmissionSuccess) {
    return (
      <SubmissionSuccessModal
        isOpen={showSubmissionSuccess}
        onConfirm={performExit}
        theme={theme === 'vs-dark' ? 'dark' : 'light'}
      />
    );
  }

  if (!hasStarted && isAssessmentMode) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-white relative">
        <div className="max-w-xl w-full bg-white p-8 rounded-xl shadow-2xl border border-gray-200 flex flex-col max-h-[90vh]">

          <div className="mb-6">
            <h1 className="text-2xl font-bold mb-2 text-blue-600">{title}</h1>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-red-100 text-red-700 text-xs border border-red-200 uppercase font-bold flex items-center gap-2">
                <ShieldAlert size={12} /> Assessment Mode
              </span>
            </div>
            <p className="text-gray-600 mt-2 text-sm">Please review the security settings before starting.</p>
          </div>

          <div className="space-y-3 mb-8 text-sm flex-1 overflow-y-auto pr-2">

            {activeSecurity.timerEnabled && (
              <div className="flex items-center gap-3 bg-gray-50 p-3 rounded border border-gray-200">
                <Clock className="text-amber-500 shrink-0" size={20} />
                <div className="flex flex-col">
                  <span className="font-bold text-gray-900">Time Limit Enforced</span>
                  <span className="text-xs text-gray-600">Total duration: {activeSecurity.timerDuration} minutes.</span>
                </div>
              </div>
            )}

            {activeSecurity.fullScreenMode && (
              <div className="flex items-center gap-3 bg-gray-50 p-3 rounded border border-gray-200">
                <Maximize2 className="text-blue-500 shrink-0" size={20} />
                <div className="flex flex-col">
                  <span className="font-bold text-gray-900">Full Screen Required</span>
                  <span className="text-xs text-gray-600">Exiting full screen mode may terminate the session.</span>
                </div>
              </div>
            )}

            {activeSecurity.cameraMicEnabled && (
              <div className="flex items-center gap-3 bg-gray-50 p-3 rounded border border-gray-200">
                <Camera className="text-purple-500 shrink-0" size={20} />
                <div className="flex flex-col">
                  <span className="font-bold text-gray-900">Camera Monitoring</span>
                  <span className="text-xs text-gray-600">Webcam access is required and will be recorded.</span>
                </div>
              </div>
            )}

            {activeSecurity.screenRecordingEnabled && (
              <div className="flex items-center gap-3 bg-gray-50 p-3 rounded border border-gray-200">
                <Monitor className="text-green-500 shrink-0" size={20} />
                <div className="flex flex-col">
                  <span className="font-bold text-gray-900">Screen Recording</span>
                  <span className="text-xs text-gray-600">Your screen will be recorded with camera overlay.</span>
                </div>
              </div>
            )}

            <div className="flex items-center gap-3 bg-gray-50 p-3 rounded border border-gray-200">
              <Eye className="text-orange-500 shrink-0" size={20} />
              <div className="flex flex-col">
                <span className="font-bold text-gray-900">Tab Focus Monitoring</span>
                <span className="text-xs text-gray-600">
                  {!activeSecurity.tabSwitchAllowed
                    ? "Strict Mode: Tab switching is strictly prohibited."
                    : `Allowed with limit: Max ${activeSecurity.maxTabSwitches || 'unlimited'} switches.`
                  }
                </span>
              </div>
            </div>

            {activeSecurity.disableClipboard && (
              <div className="flex items-center gap-3 bg-gray-50 p-3 rounded border border-gray-200">
                <MousePointerClick className="text-pink-500 shrink-0" size={20} />
                <div className="flex flex-col">
                  <span className="font-bold text-gray-900">Clipboard Disabled</span>
                  <span className="text-xs text-gray-600">Copy, Cut, and Paste actions are blocked.</span>
                </div>
              </div>
            )}

            {activeAttemptLimit && (
              <div className="flex items-center gap-3 bg-gray-50 p-3 rounded border border-gray-200">
                <AlertTriangle className="text-red-500 shrink-0" size={20} />
                <div className="flex flex-col">
                  <span className="font-bold text-gray-900">Attempt Limit</span>
                  <span className="text-xs text-gray-600">You have a maximum of {maxAttempts} submission attempts.</span>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="flex items-center gap-3 mb-2">
                <ShieldCheck className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-gray-900">Security Agreement</h3>
              </div>
              <p className="text-xs text-gray-600 mb-3">
                By clicking "Start Assessment", you agree to all security measures listed above.
                Violations may result in immediate termination of your assessment.
              </p>
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <CheckCircle className="w-3 h-3 text-green-500" />
                <span>I understand and agree to the security requirements</span>
              </div>
            </div>

            <button onClick={handleSecurityAgreement} className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-colors flex items-center justify-center gap-2">
              <span>Start Assessment</span> <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // MAIN RENDER
  // ---------------------------------------------------------------------------
  return (
    <div className="flex flex-col h-screen" style={{ backgroundColor: colors.background }}>
      <ToastContainer
        position="bottom-right"
        autoClose={3000}
        theme={theme === 'light' ? 'light' : 'dark'}
        toastStyle={{
          backgroundColor: colors.sidebar,
          color: colors.text,
          border: `1px solid ${colors.border}`
        }}
      />

      {/* Top Activity Bar */}
      <div className="flex items-center justify-between px-3 py-2 border-b" style={{
        backgroundColor: colors.activityBar,
        borderColor: colors.border
      }}>
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-1.5 hover:bg-[#d5d5d5] dark:hover:bg-[#2d2d2d] rounded transition-colors"
            style={{ color: colors.textSecondary }}
            title="Go Back"
          >
            <ChevronLeft size={16} />
          </button>

          <div className="flex items-center gap-3">
            <div className="text-sm font-medium" style={{ color: colors.text }}>{title}</div>
            <div className="text-xs px-2 py-0.5 rounded" style={{
              backgroundColor: theme === 'light' ? '#e5e5e5' : '#2d2d2d',
              color: colors.textSecondary
            }}>
              Q{currentQuestionIndex + 1}/{questions.length}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Security indicators */}
          {isAssessmentMode && (
            <>
              {activeSecurity.timerEnabled && timeLeft !== null && (
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded font-mono font-medium ${timeLeft < 60 ? 'bg-red-600 animate-pulse text-white' : 'bg-gray-900 text-amber-400'}`}>
                  <Clock size={14} /> {formatTime(timeLeft)}
                </div>
              )}

              {isRecording && (
                <div className="flex items-center gap-1.5 bg-red-600 text-white px-2 py-1 rounded text-xs font-medium animate-pulse">
                  <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                  <span>REC</span>
                  <span className="text-xs">({activeSecurity.screenRecordingEnabled ? 'Screen' : 'Camera'})</span>
                </div>
              )}

              {tabSwitchCount > 0 && activeSecurity.tabSwitchAllowed && (
                <div className={`flex items-center gap-1 px-2 py-1 rounded text-xs ${tabSwitchCount >= (activeSecurity.maxTabSwitches || 3) ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                  <Eye size={12} />
                  <span>Tab Switches: {tabSwitchCount}/{activeSecurity.maxTabSwitches || 3}</span>
                </div>
              )}

              {/* Camera Preview */}
              {activeSecurity.cameraMicEnabled && cameraStream && (
                <div className="relative">
                  <div className="w-20 h-12 bg-black rounded border border-gray-300 overflow-hidden">
                    <video
                      ref={videoRef}
                      autoPlay
                      muted
                      playsInline
                      className="w-full h-full object-cover"
                      onError={(e) => console.error('Video error:', e)}
                    />
                  </div>
                  {!micEnabled && (
                    <div className="absolute bottom-1 right-1">
                      <MicOff className="w-3 h-3 text-red-500 bg-white rounded-full p-0.5" />
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          <div className="h-5 w-px" style={{ backgroundColor: colors.border, margin: '0 8px' }}></div><div className="h-5 w-px" style={{ backgroundColor: colors.border, margin: '0 8px' }}></div>

          {/* ── Exercise Info Buttons ── */}
          <ExerciseInfoButtons
            onDetailsClick={() => setShowDetailsModal(true)}
            onOverviewClick={() => setShowOverviewModal(true)}
          />

          <div className="h-5 w-px" style={{ backgroundColor: colors.border, margin: '0 8px' }}></div>

          <div className="relative">
            <input
              type="text"
              placeholder="Search files (Ctrl+P)"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="px-3 py-1 text-sm rounded w-64 focus:outline-none focus:ring-2 focus:ring-blue-500"
              style={{
                backgroundColor: theme === 'light' ? '#f5f5f5' : '#2d2d2d',
                color: colors.text,
                border: `1px solid ${colors.border}`
              }}
            />
            <Search size={14} className="absolute right-2 top-1.5" style={{ color: colors.textSecondary }} />
          </div>



          {/* Load Previous Submission Button */}
          {/* <button
            onClick={loadPreviousSubmission}
            disabled={isLoadingPrevious}
            className="px-3 py-1.5 text-sm rounded flex items-center gap-2 hover:opacity-90 disabled:opacity-50 transition-opacity"
            style={{ backgroundColor: '#dcdcaa', color: '#333333' }}
            title="Load Previous Submission"
          >
            {isLoadingPrevious ? <Loader2 size={14} className="animate-spin" /> : <History size={14} />}
            {isLoadingPrevious ? 'Loading...' : 'Load Previous'}
          </button> */}

          <button
            onClick={() => setTheme(theme === 'light' ? 'vs-dark' : 'light')}
            className="p-2 rounded hover:bg-[#d5d5d5] dark:hover:bg-[#2d2d2d] transition-colors"
            style={{ color: colors.textSecondary }}
            title={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} Mode`}
          >
            {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
          </button>

          {/* Preview Toggle Button */}
          <button
            onClick={() => setShowPreview(!showPreview)}
            className={`p-2 rounded hover:bg-[#d5d5d5] dark:hover:bg-[#2d2d2d] transition-colors ${!showPreview ? 'bg-[#007acc] hover:bg-[#0062a3] text-white' : ''}`}
            style={{ color: showPreview ? colors.textSecondary : 'white' }}
            title={`${showPreview ? 'Hide' : 'Show'} Preview`}
          >
            {showPreview ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
          <button
            onClick={() => setShowQuestionSidebar(!showQuestionSidebar)}
            className={`p-2 rounded hover:bg-[#d5d5d5] dark:hover:bg-[#2d2d2d] transition-colors ${showQuestionSidebar ? 'bg-[#007acc] hover:bg-[#0062a3] text-white' : ''}`}
            style={{ color: showQuestionSidebar ? 'white' : colors.textSecondary }}
            title={`${showQuestionSidebar ? 'Hide' : 'Show'} Question Details`}
          >
            <BookOpen size={16} />
          </button>
          {/* Open in New Tab Button */}
          <button
            onClick={() => {
              const newWindow = window.open('', '_blank');
              if (newWindow && activeFile) {
                const htmlContent = generateCompleteHtmlForNewWindow(activeFile);
                newWindow.document.open();
                newWindow.document.write(htmlContent);
                newWindow.document.close();
              }
            }}
            className="p-2 rounded hover:bg-[#d5d5d5] dark:hover:bg-[#2d2d2d] transition-colors"
            style={{ color: colors.textSecondary }}
            title="Open in New Tab"
          >
            <ExternalLink size={16} />
          </button>

          <button
            onClick={compileCode}
            className="px-3 py-1.5 text-sm rounded flex items-center gap-2 hover:opacity-90 transition-opacity"
            style={{ backgroundColor: colors.primary, color: 'white' }}
            title="Run (Ctrl+Enter)"
          >
            <Play size={14} /> Run
          </button>

          {/* Save current question files */}
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="px-3 py-1.5 text-sm rounded flex items-center gap-2 hover:opacity-90 disabled:opacity-50 transition-opacity"
            style={{ backgroundColor: '#4ec9b0', color: 'white' }}
            title="Save current question files"
          >
            {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {isSubmitting ? 'Submit...' : 'Submit'}
          </button>

          {/* Submit Exercise — final submission */}
          {!isTestSubmitted ? (
            <button
              onClick={handleFinalSubmit}
              disabled={isSubmitting}
              className="px-3  text-sm rounded flex items-center gap-2 hover:opacity-90 disabled:opacity-50 transition-opacity"
              style={{ backgroundColor: '#16a34a', color: 'white' }}
              title="Submit entire exercise"
            >
              {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
              Submit Exercise
            </button>
          ) : (
            <span className="flex items-center gap-2 px-3 py-1.5 text-sm rounded"
              style={{ backgroundColor: '#dcfce7', color: '#16a34a', border: '1px solid #86efac' }}>
              <CheckCircle size={14} /> Submitted
            </span>
          )}
          {/* Exit button */}
          {/* <button
            onClick={performExit}
            className={`px-3 py-1.5 rounded text-xs font-medium border transition-colors ${isAssessmentMode
              ? "bg-red-100 text-red-700 border-red-200 hover:bg-red-200"
              : "bg-gray-800 border-gray-700 hover:bg-gray-900 text-white"
              }`}
          >
            <LogOut size={14} className="inline mr-1" />
            {isAssessmentMode ? "Finish" : "Exit"}
          </button> */}
        </div>
      </div>

      {/* Main Content */}
      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden main-content-container">
        {/* Explorer Section */}
        {!isExplorerCollapsed && (
          <>
            <div
              className="flex flex-col flex-shrink-0 relative"
              style={{ width: showFileTree ? `${explorerWidth}px` : '0px', transition: 'width 0.2s ease' }}
            >
              {showFileTree && (
                <div className="h-full flex flex-col" style={{
                  backgroundColor: colors.sidebar,
                  borderRight: `1px solid ${colors.border}`,
                  width: `${explorerWidth}px`
                }}>
                  <div className="px-3 py-2 border-b flex items-center justify-between" style={{ borderColor: colors.border }}>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setIsExplorerCollapsed(true)}
                        className="p-1 hover:bg-[#d5d5d5] dark:hover:bg-[#2d2d2d] rounded transition-colors"
                        style={{ color: colors.textSecondary }}
                        title="Collapse Explorer"
                      >
                        <ChevronLeft size={16} />
                      </button>
                      <div className="text-xs font-semibold uppercase tracking-wider" style={{ color: colors.textSecondary }}>
                        Explorer
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={startCreatingFolder}
                        className="p-1 hover:bg-[#d5d5d5] dark:hover:bg-[#2d2d2d] rounded transition-colors"
                        style={{ color: colors.textSecondary }}
                        title="New Folder"
                      >
                        <FolderPlus size={14} />
                      </button>
                      <button
                        onClick={startCreatingFile}
                        className="p-1 hover:bg-[#d5d5d5] dark:hover:bg-[#2d2d2d] rounded transition-colors"
                        style={{ color: colors.textSecondary }}
                        title="New File"
                      >
                        <FilePlus size={14} />
                      </button>
                      <button
                        onClick={loadLocalFiles}
                        className="p-1 hover:bg-[#d5d5d5] dark:hover:bg-[#2d2d2d] rounded transition-colors"
                        style={{ color: colors.textSecondary }}
                        title="Refresh"
                      >
                        <RefreshCw size={14} />
                      </button>
                    </div>
                  </div>

                  {/* File Tree */}
                  <div className="flex-1 overflow-y-auto">
                    {renderFileTree()}
                  </div>

                  {/* Status Bar */}
                  <div className="px-3 py-1.5 border-t text-xs" style={{
                    borderColor: colors.border,
                    backgroundColor: theme === 'light' ? '#e5e5e5' : '#2d2d2d'
                  }}>
                    <div className="flex items-center justify-between" style={{ color: colors.textSecondary }}>
                      <span>{files.length} files</span>
                      <span>{folders.length} folders</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Resize Handle for Explorer */}
            {showFileTree && !isExplorerCollapsed && (
              <div
                className="w-1 cursor-ew-resize hover:bg-blue-500 transition-colors flex-shrink-0"
                style={{ backgroundColor: isResizingExplorer ? '#007acc' : 'transparent' }}
                onMouseDown={handleExplorerResizeStart}
              />
            )}
          </>
        )}

        {/* Collapsed Explorer Indicator */}
        {isExplorerCollapsed && (
          <div className="w-10 flex-shrink-0 flex flex-col items-center py-4 gap-2 border-r" style={{
            backgroundColor: colors.sidebar,
            borderColor: colors.border
          }}>
            <button
              onClick={() => setIsExplorerCollapsed(false)}
              className="p-2 hover:bg-[#d5d5d5] dark:hover:bg-[#2d2d2d] rounded transition-colors"
              style={{ color: colors.textSecondary }}
              title="Expand Explorer"
            >
              <ChevronRight size={18} />
            </button>
            <Folder size={20} style={{ color: colors.textSecondary }} />
            <div className="text-xs font-mono" style={{ color: colors.textSecondary }}>
              {files.length}
            </div>
          </div>
        )}

        {/* Editor and Preview Container */}
        <div className="flex-1 flex overflow-hidden">
          {/* Editor Section */}
          {!isEditorCollapsed && (
            <div
              className="flex flex-col h-full"
              style={{
                width: !isPreviewCollapsed && showPreview ? `${100 - previewWidth}%` : '100%',
                transition: 'width 0.2s ease'
              }}
            >
              {/* Editor Tabs */}
              <div className="flex items-center border-b" style={{
                backgroundColor: colors.editorGroup,
                borderColor: colors.border
              }}>
                <div className="flex items-center flex-1 overflow-x-auto">
                  <button
                    onClick={() => setIsEditorCollapsed(true)}
                    className="p-2 hover:bg-[#d5d5d5] dark:hover:bg-[#2d2d2d] rounded transition-colors mr-1"
                    style={{ color: colors.textSecondary }}
                    title="Collapse Editor"
                  >
                    <ChevronRight size={14} />
                  </button>
                  {files
                    .filter(file => openFiles.includes(file.id))
                    .map(file => {
                      const isActive = activeFileId === file.id;
                      return (
                        <div
                          key={file.id}
                          className={`group flex items-center gap-2 px-4 py-2 border-r text-sm cursor-pointer min-w-[150px] max-w-[200px] ${isActive
                            ? 'border-t-2'
                            : 'hover:bg-[#e5e5e5] dark:hover:bg-[#2d2d2d]'
                            }`}
                          style={{
                            backgroundColor: isActive ? colors.tabActive : colors.tabInactive,
                            borderTopColor: isActive ? colors.primary : 'transparent',
                            borderRightColor: colors.border,
                            color: isActive ? colors.text : colors.textSecondary
                          }}
                          onClick={() => setActiveFileId(file.id)}
                        >
                          {getLanguageIcon(file.language)}
                          <span className="flex-1 truncate">{file.filename}</span>

                          {file.isDirty && (
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: colors.primary }}></div>
                          )}

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenFiles(prev => prev.filter(id => id !== file.id));

                              if (activeFileId === file.id) {
                                const remainingOpenFiles = openFiles.filter(id => id !== file.id);
                                if (remainingOpenFiles.length > 0) {
                                  setActiveFileId(remainingOpenFiles[0]);
                                } else {
                                  setActiveFileId(files[0].id);
                                }
                              }
                            }}
                            className="p-0.5 rounded hover:bg-[#d5d5d5] dark:hover:bg-[#3e3e42] opacity-0 group-hover:opacity-100 transition-opacity"
                            style={{ color: colors.textSecondary }}
                            title="Close Tab"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      );
                    })}
                </div>

                <div className="flex items-center px-2 gap-1">
                  <button
                    onClick={() => setEditorZoom(prev => Math.min(prev + 10, 200))}
                    className="p-1.5 hover:bg-[#d5d5d5] dark:hover:bg-[#2d2d2d] rounded transition-colors"
                    style={{ color: colors.textSecondary }}
                    title="Zoom In"
                  >
                    <ZoomIn size={14} />
                  </button>
                  <button
                    onClick={() => setEditorZoom(prev => Math.max(prev - 10, 50))}
                    className="p-1.5 hover:bg-[#d5d5d5] dark:hover:bg-[#2d2d2d] rounded transition-colors"
                    style={{ color: colors.textSecondary }}
                    title="Zoom Out"
                  >
                    <ZoomOut size={14} />
                  </button>
                  <div className="text-xs px-2 py-1 rounded" style={{
                    backgroundColor: theme === 'light' ? '#e5e5e5' : '#2d2d2d',
                    color: colors.textSecondary
                  }}>
                    {editorZoom}%
                  </div>
                </div>
              </div>

              {/* Editor */}
              <div className="flex-1 relative">
                {isLoading || isLoadingSubmission ? (
                  <div className="absolute inset-0 flex items-center justify-center" style={{ backgroundColor: colors.background }}>
                    <div className="text-center">
                      <Loader2 className="animate-spin mx-auto mb-2" size={24} style={{ color: colors.primary }} />
                      <div className="text-sm" style={{ color: colors.textSecondary }}>
                        {isLoadingPrevious ? 'Loading previous submission...' : 'Loading project...'}
                      </div>
                    </div>
                  </div>
                ) : isRenaming ? (
                  <div className="absolute inset-0 flex items-center justify-center z-10" style={{
                    backgroundColor: theme === 'light' ? 'rgba(255, 255, 255, 0.9)' : 'rgba(30, 30, 30, 0.9)'
                  }}>
                    <div className="p-4 rounded-lg shadow-lg" style={{
                      backgroundColor: colors.sidebar,
                      border: `1px solid ${colors.border}`
                    }}>
                      <h3 className="font-semibold mb-2" style={{ color: colors.text }}>Rename File</h3>
                      <input
                        type="text"
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        className="px-3 py-2 rounded w-64 mb-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        style={{
                          backgroundColor: colors.background,
                          color: colors.text,
                          border: `1px solid ${colors.border}`
                        }}
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') renameFile();
                          if (e.key === 'Escape') setIsRenaming(null);
                        }}
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={renameFile}
                          className="px-3 py-1 rounded hover:opacity-90 transition-opacity"
                          style={{ backgroundColor: colors.primary, color: 'white' }}
                        >
                          Rename
                        </button>
                        <button
                          onClick={() => setIsRenaming(null)}
                          className="px-3 py-1 rounded hover:bg-[#d5d5d5] dark:hover:bg-[#2d2d2d] transition-colors"
                          style={{ color: colors.text, border: `1px solid ${colors.border}` }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <MonacoEditor
                    language={activeFile.language}
                    theme={theme}
                    value={activeFile.content}
                    onChange={handleFileContentChange}
                    options={{
                      fontSize: 14 * (editorZoom / 100),
                      minimap: { enabled: true },
                      wordWrap: 'on',
                      automaticLayout: true,
                      scrollBeyondLastLine: false,
                      tabSize: 2,
                      insertSpaces: true,
                      formatOnPaste: true,
                      formatOnType: true,
                      renderLineHighlight: 'all',
                      cursorBlinking: 'smooth',
                      cursorSmoothCaretAnimation: 'on',
                      mouseWheelZoom: true,
                      padding: { top: 10 },
                      lineNumbers: 'on',
                      glyphMargin: true,
                      folding: true,
                      lineDecorationsWidth: 10,
                      overviewRulerBorder: false,
                      scrollbar: {
                        vertical: 'visible',
                        horizontal: 'visible',
                        useShadows: false
                      }
                    }}
                  />
                )}
              </div>

              {/* Status Bar */}
              <div className="px-3 py-1.5 border-t flex items-center justify-between text-xs" style={{
                borderColor: colors.border,
                backgroundColor: theme === 'light' ? '#e5e5e5' : '#2d2d2d'
              }}>
                <div className="flex items-center gap-4" style={{ color: colors.textSecondary }}>
                  <button
                    onClick={() => setShowOutput(!showOutput)}
                    className="flex items-center gap-1 hover:text-[#007acc] transition-colors"
                  >
                    <Terminal size={12} />
                    <span>Output</span>
                  </button>
                  <div className="flex items-center gap-1">
                    <span>{activeFile.language.toUpperCase()}</span>
                    {activeFile.isEntryPoint && <Star size={10} className="text-[#dcdcaa]" />}
                  </div>
                  <span>Ln {activeFile.content.split('\n').length}, Col 1</span>
                </div>
                <div className="flex items-center gap-3" style={{ color: colors.textSecondary }}>
                  <button
                    onClick={() => setLayout(layout === 'horizontal' ? 'vertical' : 'horizontal')}
                    className="hover:text-[#007acc] transition-colors"
                    title="Toggle Layout"
                  >
                    {layout === 'horizontal' ? <SplitSquareHorizontal size={12} /> : <SplitSquareVertical size={12} />}
                  </button>
                  <span className="text-[#4ec9b0]">● Live</span>
                </div>
              </div>
            </div>
          )}

          {/* Collapsed Editor Indicator */}
          {isEditorCollapsed && (
            <div className="w-10 flex-shrink-0 flex flex-col items-center py-4 gap-2 border-r" style={{
              backgroundColor: colors.sidebar,
              borderColor: colors.border
            }}>
              <button
                onClick={() => setIsEditorCollapsed(false)}
                className="p-2 hover:bg-[#d5d5d5] dark:hover:bg-[#2d2d2d] rounded transition-colors"
                style={{ color: colors.textSecondary }}
                title="Expand Editor"
              >
                <ChevronLeft size={18} />
              </button>
              <Code2 size={20} style={{ color: colors.textSecondary }} />
              <div className="text-xs font-mono" style={{ color: colors.textSecondary }}>
                {activeFile?.filename?.split('.').pop()?.toUpperCase() || 'JS'}
              </div>
            </div>
          )}

          {/* Resize Handle for Preview */}
          {!isEditorCollapsed && !isPreviewCollapsed && showPreview && (
            <div
              className="w-1 cursor-ew-resize hover:bg-blue-500 transition-colors flex-shrink-0"
              style={{ backgroundColor: isResizingPreview ? '#007acc' : 'transparent' }}
              onMouseDown={handlePreviewResizeStart}
            />
          )}







          {/* Preview Section */}
          {!isPreviewCollapsed && showPreview && (
            <div
              className="flex flex-col border-l h-full"
              style={{
                width: `${previewWidth}%`,
                backgroundColor: colors.editorGroup,
                borderColor: colors.border,
                transition: 'width 0.2s ease'
              }}
            >
              <div className="px-3 py-2 border-b flex items-center justify-between" style={{ borderColor: colors.border }}>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsPreviewCollapsed(true)}
                    className="p-1.5 hover:bg-[#d5d5d5] dark:hover:bg-[#2d2d2d] rounded transition-colors"
                    style={{ color: colors.textSecondary }}
                    title="Collapse Preview"
                  >
                    <ChevronRight size={16} />
                  </button>
                  <span className="text-sm font-medium" style={{ color: colors.text }}>Preview</span>
                  <span className="text-xs px-2 py-0.5 rounded" style={{
                    backgroundColor: theme === 'light' ? '#e5e5e5' : '#2d2d2d',
                    color: '#4ec9b0'
                  }}>
                    {currentPreviewFile || 'No file'}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={compileCode}
                    className="p-1.5 hover:bg-[#d5d5d5] dark:hover:bg-[#2d2d2d] rounded transition-colors"
                    style={{ color: colors.textSecondary }}
                    title="Refresh Preview"
                  >
                    <RefreshCw size={14} />
                  </button>
                  <button
                    onClick={() => {
                      setTimeout(() => {
                        const newWindow = window.open('', '_blank');
                        if (newWindow) {
                          const htmlContent = generateCompleteHtmlForNewWindow(activeFile);
                          newWindow.document.open();
                          newWindow.document.write(htmlContent);
                          newWindow.document.close();
                        }
                      }, 100);
                    }}
                    className="p-1.5 hover:bg-[#d5d5d5] dark:hover:bg-[#2d2d2d] rounded transition-colors"
                    style={{ color: colors.textSecondary }}
                    title="Open in New Window"
                  >
                    <ExternalLink size={14} />
                  </button>
                  <button
                    onClick={() => setIsFullscreen(!isFullscreen)}
                    className="p-1.5 hover:bg-[#d5d5d5] dark:hover:bg-[#2d2d2d] rounded transition-colors"
                    style={{ color: colors.textSecondary }}
                    title="Toggle Fullscreen"
                  >
                    {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                  </button>
                </div>
              </div>

              <div className="flex-1 relative">
                {isFullscreen ? (
                  <div className="fixed inset-0 z-50" style={{ backgroundColor: colors.background }}>
                    <div className="h-12 border-b flex items-center justify-between px-4" style={{
                      borderColor: colors.border,
                      backgroundColor: colors.sidebar
                    }}>
                      <span style={{ color: colors.text }}>Fullscreen Preview - {activeFile.filename}</span>
                      <button
                        onClick={() => setIsFullscreen(false)}
                        className="p-2 hover:bg-[#d5d5d5] dark:hover:bg-[#2d2d2d] rounded transition-colors"
                        style={{ color: colors.text }}
                      >
                        <X size={16} />
                      </button>
                    </div>
                    <iframe
                      srcDoc={srcDoc}
                      title="preview"
                      sandbox="allow-scripts allow-same-origin allow-forms"
                      className="w-full h-[calc(100vh-3rem)] border-0"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                ) : (
                  <iframe
                    srcDoc={srcDoc}
                    title="preview"
                    sandbox="allow-scripts allow-same-origin allow-forms"
                    className="w-full h-full border-0"
                    referrerPolicy="no-referrer"
                  />
                )}
              </div>

              {/* Preview Status */}
              <div className="px-3 py-1.5 border-t text-xs" style={{
                borderColor: colors.border,
                backgroundColor: theme === 'light' ? '#e5e5e5' : '#2d2d2d'
              }}>
                <div className="flex items-center justify-between" style={{ color: colors.textSecondary }}>
                  <span>Safe Navigation: <span className="text-[#4ec9b0]">Active</span></span>
                  <span>All links stay within preview</span>
                </div>
              </div>
            </div>
          )}

          {/* Collapsed Preview Indicator */}
          {isPreviewCollapsed && showPreview && (
            <div className="w-10 flex-shrink-0 flex flex-col items-center py-4 gap-2 border-l" style={{
              backgroundColor: colors.sidebar,
              borderColor: colors.border
            }}>
              <button
                onClick={() => setIsPreviewCollapsed(false)}
                className="p-2 hover:bg-[#d5d5d5] dark:hover:bg-[#2d2d2d] rounded transition-colors"
                style={{ color: colors.textSecondary }}
                title="Expand Preview"
              >
                <ChevronLeft size={18} />
              </button>
              <MonitorPlay size={20} style={{ color: colors.textSecondary }} />
              <div className="text-xs font-mono" style={{ color: colors.textSecondary }}>
                PREV
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Question Info */}
      {currentQuestion && (
        <div className="border-t px-3 py-2" style={{
          backgroundColor: colors.sidebar,
          borderColor: colors.border
        }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="text-sm font-medium" style={{ color: colors.text }}>
                {currentQuestion.title || `Question ${currentQuestionIndex + 1}`}
              </div>
              {currentQuestion.difficulty && (
                <span className={`text-xs px-2 py-0.5 rounded ${currentQuestion.difficulty === 'easy' ? 'text-[#4ec9b0] bg-[#e3f5f2]' :
                  currentQuestion.difficulty === 'medium' ? 'text-[#dcdcaa] bg-[#f5f5e3]' :
                    'text-[#f48771] bg-[#f5e3e3]'
                  }`}>
                  {currentQuestion.difficulty}
                </span>
              )}
              {attemptLimitEnabled && (
                <span className="text-xs px-2 py-0.5 rounded" style={{
                  backgroundColor: theme === 'light' ? '#e5e5e5' : '#2d2d2d',
                  color: colors.textSecondary
                }}>
                  Attempts: {userAttempts[getQuestionId()] || 0}/{maxAttempts}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentQuestionIndex(Math.max(0, currentQuestionIndex - 1))}
                disabled={currentQuestionIndex === 0}
                className="p-1.5 hover:bg-[#d5d5d5] dark:hover:bg-[#2d2d2d] rounded disabled:opacity-50 transition-colors"
                style={{ color: colors.textSecondary }}
                title="Previous Question"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="text-sm" style={{ color: colors.textSecondary }}>
                {currentQuestionIndex + 1} / {questions.length}
              </span>
              <button
                onClick={() => setCurrentQuestionIndex(Math.min(questions.length - 1, currentQuestionIndex + 1))}
                disabled={currentQuestionIndex === questions.length - 1}
                className="p-1.5 hover:bg-[#d5d5d5] dark:hover:bg-[#2d2d2d] rounded disabled:opacity-50 transition-colors"
                style={{ color: colors.textSecondary }}
                title="Next Question"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Question Sidebar Overlay */}
      {showQuestionSidebar && (
        <QuestionSidebar
          isOpen={showQuestionSidebar}
          onClose={() => setShowQuestionSidebar(false)}
          question={currentQuestion}
          currentIndex={currentQuestionIndex}
          totalQuestions={questions.length}
          onNavigate={(direction) => {
            if (direction === 'prev' && currentQuestionIndex > 0) {
              setCurrentQuestionIndex(currentQuestionIndex - 1);
            } else if (direction === 'next' && currentQuestionIndex < questions.length - 1) {
              setCurrentQuestionIndex(currentQuestionIndex + 1);
            }
          }}
          theme={theme === 'vs-dark' ? 'dark' : 'light'}
        />
      )}
      {/* Context Menu */}
      {contextMenu && (
        <div
          className="fixed z-50 shadow-lg rounded border py-1 min-w-[160px]"
          style={{
            left: Math.min(contextMenu.x, window.innerWidth - 200),
            top: Math.min(contextMenu.y, window.innerHeight - 200),
            backgroundColor: colors.sidebar,
            borderColor: colors.border,
            zIndex: 1000,
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
          }}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          {/* New File option */}
          {contextMenu.type === 'folder' && (
            <>
              <button
                className="flex items-center gap-2 w-full px-3 py-1.5 text-sm hover:bg-[#d5d5d5] dark:hover:bg-[#2d2d2e] transition-colors"
                style={{ color: colors.text }}
                onClick={() => {
                  const folder = folders.find(f => f.id === contextMenu.id);
                  if (folder) {
                    handleFolderSelect(folder.path);
                    startCreatingFile();
                  }
                  setContextMenu(null);
                }}
              >
                <FilePlus size={14} />
                New File
              </button>
              <button
                className="flex items-center gap-2 w-full px-3 py-1.5 text-sm hover:bg-[#d5d5d5] dark:hover:bg-[#2d2d2e] transition-colors"
                style={{ color: colors.text }}
                onClick={() => {
                  const folder = folders.find(f => f.id === contextMenu.id);
                  if (folder) {
                    handleFolderSelect(folder.path);
                    startCreatingFolder();
                  }
                  setContextMenu(null);
                }}
              >
                <FolderPlus size={14} />
                New Folder
              </button>
              <div className="h-px my-1" style={{ backgroundColor: colors.border }} />
            </>
          )}

          {/* Rename option */}
          <button
            className="flex items-center gap-2 w-full px-3 py-1.5 text-sm hover:bg-[#d5d5d5] dark:hover:bg-[#2d2d2e] transition-colors"
            style={{ color: colors.text }}
            onClick={() => {
              if (contextMenu.type === 'file') {
                const file = files.find(f => f.id === contextMenu.id);
                if (file) {
                  setRenameTarget({
                    id: contextMenu.id,
                    type: 'file',
                    name: file.filename,
                    path: file.folderPath
                  });
                  setTempRenameValue(file.filename);
                }
              } else {
                const folder = folders.find(f => f.id === contextMenu.id);
                if (folder) {
                  setRenameTarget({
                    id: contextMenu.id,
                    type: 'folder',
                    name: folder.name,
                    path: folder.parentPath
                  });
                  setTempRenameValue(folder.name);
                }
              }
              setContextMenu(null);
            }}
          >
            <Edit2 size={14} />
            Rename
          </button>

          {/* File-specific options */}
          {contextMenu.type === 'file' && (
            <>
              <button
                className="flex items-center gap-2 w-full px-3 py-1.5 text-sm hover:bg-[#d5d5d5] dark:hover:bg-[#2d2d2e] transition-colors"
                style={{ color: colors.text }}
                onClick={() => {
                  const file = files.find(f => f.id === contextMenu.id);
                  if (file) {
                    setAsEntryPoint(file.id);
                  }
                  setContextMenu(null);
                }}
              >
                <Star size={14} />
                Set as Entry Point
              </button>

              <button
                className="flex items-center gap-2 w-full px-3 py-1.5 text-sm hover:bg-[#d5d5d5] dark:hover:bg-[#2d2d2e] transition-colors"
                style={{ color: colors.text }}
                onClick={() => {
                  const file = files.find(f => f.id === contextMenu.id);
                  if (file) {
                    // Open in new window
                    const newWindow = window.open('', '_blank');
                    if (newWindow) {
                      const htmlContent = generateCompleteHtmlForNewWindow(file);
                      newWindow.document.open();
                      newWindow.document.write(htmlContent);
                      newWindow.document.close();
                    }
                  }
                  setContextMenu(null);
                }}
              >
                <ExternalLink size={14} />
                Open in New Window
              </button>

              <button
                className="flex items-center gap-2 w-full px-3 py-1.5 text-sm hover:bg-[#d5d5d5] dark:hover:bg-[#2d2d2e] transition-colors"
                style={{ color: colors.text }}
                onClick={() => {
                  const file = files.find(f => f.id === contextMenu.id);
                  if (file) {
                    // Download file
                    const blob = new Blob([file.content], { type: 'text/plain' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = file.filename;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                  }
                  setContextMenu(null);
                }}
              >
                <Download size={14} />
                Download
              </button>

              <div className="h-px my-1" style={{ backgroundColor: colors.border }} />

              <button
                className="flex items-center gap-2 w-full px-3 py-1.5 text-sm hover:bg-[#e53935] hover:text-white transition-colors"
                style={{ color: colors.text }}
                onClick={() => {
                  deleteFile(contextMenu.id);
                  setContextMenu(null);
                }}
              >
                <Trash2 size={14} />
                Delete
              </button>
            </>
          )}

          {/* Folder-specific options */}
          {contextMenu.type === 'folder' && (
            <>
              <button
                className="flex items-center gap-2 w-full px-3 py-1.5 text-sm hover:bg-[#d5d5d5] dark:hover:bg-[#2d2d2e] transition-colors"
                style={{ color: colors.text }}
                onClick={() => {
                  const folder = folders.find(f => f.id === contextMenu.id);
                  if (folder) {
                    // Expand/collapse
                    toggleFolder(folder.id);
                  }
                  setContextMenu(null);
                }}
              >
                {folders.find(f => f.id === contextMenu.id)?.isOpen ? (
                  <>
                    <ChevronDown size={14} />
                    Collapse
                  </>
                ) : (
                  <>
                    <ChevronRight size={14} />
                    Expand
                  </>
                )}
              </button>

              <button
                className="flex items-center gap-2 w-full px-3 py-1.5 text-sm hover:bg-[#d5d5d5] dark:hover:bg-[#2d2d2e] transition-colors"
                style={{ color: colors.text }}
                onClick={() => {
                  const folder = folders.find(f => f.id === contextMenu.id);
                  if (folder) {
                    // Copy path
                    navigator.clipboard.writeText(folder.path);
                    toast.success(`Copied path: ${folder.path}`);
                  }
                  setContextMenu(null);
                }}
              >
                <CopyIcon size={14} />
                Copy Path
              </button>

              <div className="h-px my-1" style={{ backgroundColor: colors.border }} />

              <button
                className="flex items-center gap-2 w-full px-3 py-1.5 text-sm hover:bg-[#e53935] hover:text-white transition-colors"
                style={{ color: colors.text }}
                onClick={() => {
                  const folder = folders.find(f => f.id === contextMenu.id);
                  if (folder) {
                    handleDeleteFolder(folder.id);
                  }
                  setContextMenu(null);
                }}
              >
                <Trash2 size={14} />
                Delete Folder
              </button>
            </>
          )}
        </div>
      )}


      <ExerciseInfoModals
        exercise={exerciseData}
        showDetailsModal={showDetailsModal}
        setShowDetailsModal={setShowDetailsModal}
        showOverviewModal={showOverviewModal}
        setShowOverviewModal={setShowOverviewModal}
        solvedQuestions={new Set<number>()}
      />
    </div>
  );
};

// Helper function to format time
const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export default FrontendCompiler;