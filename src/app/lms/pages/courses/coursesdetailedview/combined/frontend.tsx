"use client";
import { getToken } from "@/lib/session";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Code,
  Flag,
  CheckCircle,
  Loader2,
  Terminal,
  Trash2,
  Play,
  RotateCcw,
  Maximize2,
  Minimize2,
  X as XIcon,
  Monitor,
  Layout,
  Palette,
  Eye,
  RefreshCw,
  FileText,
  FileCode,
  FileJson,
  FilePlus,
  Folder,
  FolderPlus,
  ChevronDown,
  ChevronRight,
  Edit2,
  Save,
  Search,
  MoreVertical,
  Upload,
  Download,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
  SplitSquareVertical,
  SplitSquareHorizontal,
  Star,
  Plus,
  Copy as CopyIcon,
  ExternalLink,
  AlertCircle,
  History,
  BookOpen,
  HelpCircle,
  ChevronLeft,
  ChevronUp,
  Menu,
  X,
  EyeOff,
  ZoomIn,
  ZoomOut,
  ArrowLeft,
  ArrowRight,
  Check,
  AlertTriangle,
  Info
} from 'lucide-react';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import dynamic from 'next/dynamic';
import RichTextDisplay from '@/app/lms/component/RichTextDisplay';

const MonacoEditor = dynamic(
  () => import('@monaco-editor/react'),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-orange-600 animate-spin" />
      </div>
    )
  }
);

// Types
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

interface LogEntry {
  id: string;
  type: 'stdout' | 'stderr' | 'system' | 'error' | 'warning' | 'success' | 'info';
  content: string;
  timestamp: number;
}

interface FrontendQuestionProps {
  question: any;
  courseId: string;
  exerciseId: string;
  category: string;
  subcategory: string;
  nodeId: string;
  nodeName: string;
  nodeType: string;
  studentId: string;
  onComplete: () => void;
  onNext: () => void;
  isLastQuestion: boolean;
  theme?: 'light' | 'dark';
  registerSubmit?: (fn: () => void | Promise<void>) => void;
  // Question number + flag, surfaced in the Question sidebar (the parent no
  // longer renders the 52px Q-meta row for frontend questions).
  questionNumber?: number;
  totalQuestions?: number;
  isFlagged?: boolean;
  onFlagToggle?: () => void;
}

const FrontendQuestion: React.FC<FrontendQuestionProps> = ({
  question,
  courseId,
  exerciseId,
  category,
  subcategory,
  nodeId,
  nodeName,
  nodeType,
  studentId,
  onComplete,
  onNext,
  isLastQuestion,
  theme = 'light',
  registerSubmit,
  questionNumber,
  totalQuestions,
  isFlagged,
  onFlagToggle
}) => {
  // Tracks which question's starter files we've already loaded. The parent
  // (combined page) rebuilds the `question` object on every render (timer ticks),
  // so without this guard the init effect below would reset `files` every second
  // and wipe any file the student just created.
  const initializedQuestionIdRef = useRef<string | null>(null);
  // State
  const [files, setFiles] = useState<FileType[]>([]);
  const [folders, setFolders] = useState<FolderType[]>([
    {
      id: 'folder-root',
      name: 'Root',
      path: '/',
      parentPath: '',
      children: [],
      folderChildren: [],
      isOpen: true,
      depth: 0
    }
  ]);
  const [activeFileId, setActiveFileId] = useState<string>('');
  const [selectedTab, setSelectedTab] = useState<'editor' | 'preview'>('editor');
  const [isRunning, setIsRunning] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showTerminal, setShowTerminal] = useState(false);
  const [terminalLogs, setTerminalLogs] = useState<LogEntry[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [srcDoc, setSrcDoc] = useState<string>('');
  const [previewKey, setPreviewKey] = useState(Date.now());
  const [showFileTree, setShowFileTree] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreatingFile, setIsCreatingFile] = useState(false);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFileTempName, setNewFileTempName] = useState('');
  const [newFolderTempName, setNewFolderTempName] = useState('');
  const [selectedFolderPath, setSelectedFolderPath] = useState<string>('/');
  const [openFiles, setOpenFiles] = useState<string[]>([]);
  const [editorZoom, setEditorZoom] = useState(100);
  const [currentPreviewFile, setCurrentPreviewFile] = useState<string>('');
  const [showQuestionDetails, setShowQuestionDetails] = useState(false);
  // Draggable width (px) for the Question sidebar. Drag the handle on its right edge.
  const [sidebarWidth, setSidebarWidth] = useState(320);
  const [isResizingQuestionSidebar, setIsResizingQuestionSidebar] = useState(false);
  const qSidebarResizeRef = useRef({ startX: 0, startWidth: 320 });
  const startQuestionSidebarResize = (e: React.MouseEvent) => {
    e.preventDefault();
    // If the sidebar is collapsed, dragging the handle opens it and resizes
    // starting from the collapsed width (so the drag works in both states).
    const currentWidth = showQuestionDetails ? sidebarWidth : 48;
    if (!showQuestionDetails) setShowQuestionDetails(true);
    qSidebarResizeRef.current = { startX: e.clientX, startWidth: currentWidth };
    setIsResizingQuestionSidebar(true);
  };
  useEffect(() => {
    if (!isResizingQuestionSidebar) return;
    const onMove = (e: MouseEvent) => {
      const delta = e.clientX - qSidebarResizeRef.current.startX;
      const next = Math.min(Math.max(200, qSidebarResizeRef.current.startWidth + delta), 640);
      setSidebarWidth(next);
    };
    const onUp = () => setIsResizingQuestionSidebar(false);
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    document.body.style.cursor = 'ew-resize';
    document.body.style.userSelect = 'none';
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizingQuestionSidebar]);
  const [layout, setLayout] = useState<'horizontal' | 'vertical'>('horizontal');
  const [isLoadingPrevious, setIsLoadingPrevious] = useState(false);

  // Rename functionality
  const [renameTarget, setRenameTarget] = useState<{
    id: string;
    type: 'file' | 'folder';
    name: string;
    path: string;
  } | null>(null);
  const [tempRenameValue, setTempRenameValue] = useState('');

  // Context menu
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    type: 'file' | 'folder';
    id: string;
    name: string;
  } | null>(null);

  // Refs
  const previewFrameRef = useRef<HTMLIFrameElement>(null);

  // Colors based on theme
  const colors = theme === 'light' ? {
    background: '#ffffff',
    sidebar: '#f8f9fa',
    activityBar: '#e9ecef',
    editorGroup: '#ffffff',
    tabActive: '#ffffff',
    tabInactive: '#f5f5f5',
    border: '#dee2e6',
    text: '#212529',
    textSecondary: '#6c757d',
    primary: '#007acc',
    success: '#28a745',
    warning: '#ffc107',
    error: '#dc3545',
    info: '#17a2b8',
    accent: '#4ec9b0',
    hoverBg: '#e9ecef',
    selectedBg: '#e3f2fd',
    statusBar: '#e9ecef'
  } : {
    background: '#1e1e1e',
    sidebar: '#252526',
    activityBar: '#333333',
    editorGroup: '#1e1e1e',
    tabActive: '#2d2d30',
    tabInactive: '#2d2d2d',
    border: '#3e3e42',
    text: '#e9ecef',
    textSecondary: '#adb5bd',
    primary: '#007acc',
    success: '#28a745',
    warning: '#ffc107',
    error: '#dc3545',
    info: '#17a2b8',
    accent: '#4ec9b0',
    hoverBg: '#2a2d2e',
    selectedBg: '#094771',
    statusBar: '#007acc'
  };

  // Initialize
  useEffect(() => {
    // Only (re)load starter files when we switch to a DIFFERENT question.
    // The parent passes a new `question` object reference on every render, so
    // keying off the stable _id prevents wiping student-created files.
    const qId = question?._id || question?.id || null;
    if (initializedQuestionIdRef.current === qId) return;
    initializedQuestionIdRef.current = qId;

    const initialFiles: FileType[] = [];

    // Code Setup's starterCode (html/css/javascript) takes priority over the
    // legacy solutions.htmlCode/cssCode/jsCode fields.
    const starterHtml = question.starterCode?.html || question.solutions?.htmlCode;
    const starterCss = question.starterCode?.css || question.solutions?.cssCode;
    const starterJs = question.starterCode?.javascript || question.solutions?.jsCode;

    if (starterHtml) {
      const htmlFile: FileType = {
        id: 'file-html',
        filename: 'index.html',
        content: starterHtml,
        language: 'html',
        path: '/index.html',
        folderPath: '/',
        isEntryPoint: true,
        lastModified: new Date()
      };
      initialFiles.push(htmlFile);
    }
    if (starterCss) {
      const cssFile: FileType = {
        id: 'file-css',
        filename: 'styles.css',
        content: starterCss,
        language: 'css',
        path: '/styles.css',
        folderPath: '/',
        lastModified: new Date()
      };
      initialFiles.push(cssFile);
    }
    if (starterJs) {
      const jsFile: FileType = {
        id: 'file-js',
        filename: 'script.js',
        content: starterJs,
        language: 'javascript',
        path: '/script.js',
        folderPath: '/',
        lastModified: new Date()
      };
      initialFiles.push(jsFile);
    }

    setFiles(initialFiles);
    if (initialFiles.length > 0) {
      const entryPoint = initialFiles.find(f => f.isEntryPoint) || initialFiles[0];
      setActiveFileId(entryPoint.id);
      setOpenFiles([entryPoint.id]);
    }

    setTimeout(() => {
      compileCode();
    }, 100);
  }, [question]);

  // Terminal functions
  const addTerminalLog = (type: LogEntry['type'], content: string) => {
    setTerminalLogs(prev => [...prev, {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}-${prev.length}`,
      type,
      content,
      timestamp: Date.now()
    }]);
  };

  const clearTerminal = () => setTerminalLogs([]);

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

    const styleRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi;
    const styleMatches = htmlFile.content.matchAll(styleRegex);
    for (const match of styleMatches) {
      cssContent += match[1] + '\n';
    }

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
  // Only include:
  //   1. Inline <script>...</script> blocks (no src) — always
  //   2. External <script src="..."></script> blocks WHERE the referenced file
  //      actually exists in the workspace. Missing files are silently skipped
  //      so a stale `<script src="script.js">` in the HTML doesn't cause us
  //      to bundle every random JS file from the folder.
  const combineJsForHtmlFile = useCallback((htmlFile: FileType) => {
    let jsContent = '';
    const htmlFolderPath = htmlFile.folderPath;

    const scriptRegex = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
    let match;

    while ((match = scriptRegex.exec(htmlFile.content)) !== null) {
      const attrs = match[1] || '';
      const inlineCode = match[2] || '';
      const srcMatch = attrs.match(/\bsrc\s*=\s*["']([^"']+)["']/i);

      if (!srcMatch) {
        // Inline script — include as-is
        if (inlineCode.trim()) {
          jsContent += inlineCode + '\n\n';
        }
        continue;
      }

      const src = srcMatch[1];
      // Skip external/CDN scripts — iframe sandbox would block them anyway
      if (/^(https?:)?\/\//i.test(src)) continue;

      // Resolve the referenced file. Match by full path or by filename in
      // the same folder as the HTML (mirrors the CSS resolution logic).
      const referencedFilename = src.split('/').pop() || src;
      const jsFile = files.find(f => {
        if (f.language !== 'javascript') return false;
        if (src.includes('/')) {
          return f.path === src ||
                 f.path === `/${src}` ||
                 f.path.endsWith(src);
        }
        return f.folderPath === htmlFolderPath && f.filename === referencedFilename;
      });

      if (jsFile) {
        jsContent += `/* ${jsFile.filename} */\n${jsFile.content}\n\n`;
      }
      // else: referenced file doesn't exist — skip silently, don't pull in
      // unrelated JS files from the folder.
    }

    return jsContent;
  }, [files]);

  // Generate safe srcDoc for iframe preview - FIXED WITH LINK INTERCEPTION
  const generateSrcDocForFile = useCallback((htmlFile: FileType) => {
    if (!htmlFile || htmlFile.language !== 'html') {
      return createNotFoundPage(htmlFile?.filename || 'File not found');
    }

    const linkedCssFiles = findLinkedCssFiles(htmlFile.content);
    const cssContent = combineCssForHtmlFile(htmlFile, linkedCssFiles);
    const jsContent = combineJsForHtmlFile(htmlFile);

    // Get all HTML files for navigation
    const allHtmlFiles = files.filter(f => f.language === 'html');

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <base href="about:blank">
          <style>
            ${cssContent}
            
            /* Basic reset and styles */
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
              line-height: 1.6;
              color: #333;
            }
            
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
              z-index: 1000;
            }
            .vscode-preview-nav-title {
              font-weight: 600;
              color: #333333;
              font-size: 14px;
            }
            .vscode-preview-status {
              margin-left: auto;
              font-size: 12px;
              color: #4ec9b0;
              display: flex;
              align-items: center;
              gap: 6px;
            }
            
            /* Link interception warning */
            .link-warning-overlay {
              position: fixed;
              top: 0;
              left: 0;
              right: 0;
              bottom: 0;
              background: rgba(0, 0, 0, 0.7);
              display: none;
              justify-content: center;
              align-items: center;
              z-index: 9999;
            }
            .link-warning {
              background: white;
              padding: 30px;
              border-radius: 8px;
              max-width: 400px;
              text-align: center;
              box-shadow: 0 5px 20px rgba(0, 0, 0, 0.2);
            }
            .link-warning h3 {
              color: #e74c3c;
              margin-bottom: 15px;
            }
            .link-warning p {
              color: #666;
              margin-bottom: 20px;
              line-height: 1.5;
            }
            .link-warning button {
              background: #007acc;
              color: white;
              border: none;
              padding: 10px 20px;
              border-radius: 4px;
              cursor: pointer;
              font-size: 14px;
            }
            
            /* Make external links visually distinct */
            a[href^="http"]:not([href*="localhost"]),
            a[href^="https"]:not([href*="localhost"]),
            a[href^="//"] {
              position: relative;
              border-bottom: 1px dashed #ff6b6b;
            }
            a[href^="http"]:not([href*="localhost"]):after,
            a[href^="https"]:not([href*="localhost"]):after,
            a[href^="//"]:after {
              content: "↗";
              font-size: 0.8em;
              margin-left: 3px;
              color: #e74c3c;
            }
          </style>
        </head>
        <body>
          <div class="vscode-preview-nav">
            <div class="vscode-preview-nav-title">${htmlFile.filename}</div>
            <div class="vscode-preview-status">
              <div class="w-2 h-2 rounded-full bg-green-500"></div>
              Live Preview
            </div>
          </div>
          
          ${htmlFile.content}
          
          <!-- Link warning overlay -->
          <div class="link-warning-overlay" id="linkWarningOverlay">
            <div class="link-warning">
              <h3>External Link Blocked</h3>
              <p id="linkWarningText">External links are disabled in the preview for security reasons.</p>
              <button onclick="hideLinkWarning()">Continue</button>
            </div>
          </div>
          
          <script>
            ${jsContent}

            // SAFE NAVIGATION SYSTEM
            (function() {
              const htmlFiles = ${JSON.stringify(allHtmlFiles.map(f => ({
      id: f.id,
      filename: f.filename,
      content: f.content
    }))).replace(/<\/script>/gi, '<\\/script>').replace(/<!--/g, '<\\!--')};
              
              // Function to show link warning
              function showLinkWarning(url) {
                const overlay = document.getElementById('linkWarningOverlay');
                const text = document.getElementById('linkWarningText');
                if (overlay && text) {
                  text.textContent = 'External navigation to "' + url + '" is disabled in the preview for security reasons.';
                  overlay.style.display = 'flex';
                }
                console.warn('External navigation blocked:', url);
              }
              
              function hideLinkWarning() {
                const overlay = document.getElementById('linkWarningOverlay');
                if (overlay) {
                  overlay.style.display = 'none';
                }
              }
              
              // Global function for external links
              window.showLinkWarning = showLinkWarning;
              window.hideLinkWarning = hideLinkWarning;
              
              // Intercept ALL link clicks
              document.addEventListener('click', function(e) {
                let target = e.target;
                
                // Find the closest anchor tag
                while (target && target.tagName !== 'A') {
                  target = target.parentElement;
                  if (!target) break;
                }
                
                if (target && target.tagName === 'A' && target.hasAttribute('href')) {
                  const href = target.getAttribute('href');
                  
                  // Check for external links (http/https)
                  if (href && (href.startsWith('http://') || href.startsWith('https://') || href.startsWith('//'))) {
                    e.preventDefault();
                    e.stopPropagation();
                    showLinkWarning(href);
                    return false;
                  }
                  
                  // Check for local file links
                  if (href && !href.startsWith('#') && !href.startsWith('javascript:') && 
                      !href.startsWith('mailto:') && !href.startsWith('tel:')) {
                    
                    e.preventDefault();
                    e.stopPropagation();
                    
                    // Try to find matching HTML file
                    const normalizedHref = href.replace(/^\\.?\\//, '');
                    const targetFile = htmlFiles.find(f => 
                      normalizedHref === f.filename || 
                      f.filename === normalizedHref ||
                      f.filename.endsWith('/' + normalizedHref)
                    );
                    
                    if (targetFile) {
                      // Navigate to local HTML file
                      window.parent.postMessage({
                        type: 'NAVIGATE_TO_FILE',
                        fileName: targetFile.filename,
                        fileId: targetFile.id
                      }, '*');
                    } else {
                      // Not a local HTML file
                      showLinkWarning(href);
                    }
                    return false;
                  }
                }
              });
              
              // Intercept form submissions
              document.addEventListener('submit', function(e) {
                if (e.target && e.target.tagName === 'FORM' && e.target.action) {
                  const action = e.target.getAttribute('action');
                  if (action && !action.startsWith('javascript:')) {
                    e.preventDefault();
                    e.stopPropagation();
                    showLinkWarning('Form submission to: ' + action);
                    return false;
                  }
                }
              });
              
              // Prevent window.open
              const originalWindowOpen = window.open;
              window.open = function(url, target, features) {
                if (url && !url.startsWith('javascript:')) {
                  showLinkWarning(url);
                  return null;
                }
                return originalWindowOpen.apply(this, arguments);
              };
              
              // Prevent navigation via location
              window.addEventListener('beforeunload', function(e) {
                // Only prevent if not initiated by our own navigation
                if (!window._isInternalNavigation) {
                  e.preventDefault();
                  e.returnValue = '';
                }
              });
              
              // Set up for dynamically added content
              const observer = new MutationObserver(function(mutations) {
                mutations.forEach(function(mutation) {
                  if (mutation.addedNodes.length > 0) {
                    // Links will be caught by event delegation above
                  }
                });
              });
              
              observer.observe(document.body, {
                childList: true,
                subtree: true
              });
              
              // Mark all external links for visual indication
              setTimeout(function() {
                const links = document.querySelectorAll('a[href]');
                links.forEach(link => {
                  const href = link.getAttribute('href');
                  if (href && (href.startsWith('http://') || href.startsWith('https://') || href.startsWith('//'))) {
                    if (!href.includes('localhost')) {
                      link.style.borderBottom = '1px dashed #ff6b6b';
                      link.addEventListener('click', function(e) {
                        e.preventDefault();
                        e.stopPropagation();
                        showLinkWarning(href);
                      });
                    }
                  }
                });
              }, 100);
            })();
            
            // ========== ORIGINAL CONSOLE LOGGING ==========
            const originalLog = console.log;
            const originalError = console.error;
            const originalWarn = console.warn;
            const originalInfo = console.info;
            
            console.log = function(...args) {
              originalLog.apply(console, args);
              window.parent.postMessage({ 
                type: 'log', 
                level: 'log', 
                args: args.map(arg => String(arg)) 
              }, '*');
            };
            
            console.error = function(...args) {
              originalError.apply(console, args);
              window.parent.postMessage({ 
                type: 'log', 
                level: 'error', 
                args: args.map(arg => String(arg)) 
              }, '*');
            };
            
            console.warn = function(...args) {
              originalWarn.apply(console, args);
              window.parent.postMessage({ 
                type: 'log', 
                level: 'warn', 
                args: args.map(arg => String(arg)) 
              }, '*');
            };
            
            console.info = function(...args) {
              originalInfo.apply(console, args);
              window.parent.postMessage({ 
                type: 'log', 
                level: 'info', 
                args: args.map(arg => String(arg)) 
              }, '*');
            };
            
            window.addEventListener('error', function(e) {
              window.parent.postMessage({
                type: 'log',
                level: 'error',
                args: ['JavaScript Error: ' + e.message + ' at ' + e.filename + ':' + e.lineno]
              }, '*');
            });
            
            document.addEventListener('DOMContentLoaded', function() {
              console.info('Preview loaded: ${htmlFile.filename}');
            });
          </script>
        </body>
      </html>
    `;
  }, [findLinkedCssFiles, combineCssForHtmlFile, combineJsForHtmlFile, files]);

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
                min-height: calc(100vh * var(--ui-scale-inv, 1));
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
            <button class="btn" onclick="window.parent.postMessage({type: 'CREATE_FILE', fileName: 'index.html'}, '*')">Create index.html</button>
        </div>
    </body>
    </html>
  `, []);

  // Compile code function
  const compileCode = useCallback(() => {
    setIsRunning(true);

    const allFiles = files;
    const activeFile = allFiles.find(f => f.id === activeFileId);
    const isActiveFileHtml = activeFile?.language === 'html';

    const previewFile = isActiveFileHtml ? activeFile :
      allFiles.find(f => f.language === 'html' && f.isEntryPoint) ||
      allFiles.find(f => f.language === 'html') ||
      null;

    if (!previewFile) {
      setSrcDoc(createNotFoundPage('index.html'));
      setCurrentPreviewFile('No HTML file');
      setTimeout(() => {
        setIsRunning(false);
        addTerminalLog('warning', '⚠️ No HTML file found. Create an HTML file to preview your project.');
      }, 100);
      return;
    }

    const newSrcDoc = generateSrcDocForFile(previewFile);
    setSrcDoc(newSrcDoc);
    setCurrentPreviewFile(previewFile.filename);
    setPreviewKey(Date.now());

    addTerminalLog('info', '🔄 Compiling code...');

    setTimeout(() => {
      setIsRunning(false);
      addTerminalLog('success', '✅ Preview updated successfully');
    }, 300);
  }, [files, activeFileId, generateSrcDocForFile, createNotFoundPage]);

  // Handle file content change
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

  // Create new file
  const createNewFile = useCallback(() => {
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

    const getDefaultContent = (lang: FileType['language'], name: string) => {
      const baseName = name.replace(/\.[^/.]+$/, '');
      switch (lang) {
        case 'html':
          return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${baseName}</title>
    <link rel="stylesheet" href="styles.css">
</head>
<body>
    <h1>${baseName}</h1>
    <p>Start building your project here!</p>
    <script src="script.js"></script>
</body>
</html>`;
        case 'css':
          return `/* ${fileName} */
body {
    font-family: Arial, sans-serif;
    margin: 0;
    padding: 0;
}`;
        case 'javascript':
          return `// ${fileName}
console.log('${fileName} loaded');

// Your JavaScript code here`;
        default:
          return `# ${fileName}\n\nStart writing here...`;
      }
    };

    const newFile: FileType = {
      id: uniqueId,
      filename: fileName,
      content: getDefaultContent(language, fileName),
      language,
      path: fullPath,
      folderPath: selectedFolderPath,
      lastModified: new Date(),
      isEntryPoint: language === 'html' && files.filter(f => f.language === 'html').length === 0
    };

    setFiles(prev => [...prev, newFile]);
    setActiveFileId(newFile.id);
    if (!openFiles.includes(newFile.id)) {
      setOpenFiles(prev => [...prev, newFile.id]);
    }
    cancelFileCreation();

    toast.success(`Created ${fileName}`);

    if (language === 'html') {
      setTimeout(compileCode, 100);
    }
  }, [newFileTempName, selectedFolderPath, files, openFiles, compileCode]);

  // Create new folder
  const createNewFolder = useCallback(() => {
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

    const folderPath = selectedFolderPath === '/' ? `/${folderName}` : `${selectedFolderPath}/${folderName}`;

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
      parentPath: selectedFolderPath,
      children: [],
      folderChildren: [],
      isOpen: true,
      depth: selectedFolderPath === '/' ? 0 : selectedFolderPath.split('/').filter(Boolean).length
    };

    setFolders(prev => [...prev, newFolder]);
    cancelFolderCreation();
    setSelectedFolderPath(folderPath);

    toast.success(`Created folder ${folderName}`);
  }, [newFolderTempName, selectedFolderPath, folders, files]);

  // Cancel file creation
  const cancelFileCreation = useCallback(() => {
    setIsCreatingFile(false);
    setNewFileTempName('');
  }, []);

  // Cancel folder creation
  const cancelFolderCreation = useCallback(() => {
    setIsCreatingFolder(false);
    setNewFolderTempName('');
  }, []);

  // Start creating a new file
  const startCreatingFile = useCallback(() => {
    setIsCreatingFile(true);
    setNewFileTempName('');
  }, []);

  // Start creating a new folder
  const startCreatingFolder = useCallback(() => {
    setIsCreatingFolder(true);
    setNewFolderTempName('');
  }, []);

  // Delete file
  const deleteFile = useCallback((fileId: string) => {
    const fileToDelete = files.find(f => f.id === fileId);
    if (!fileToDelete) return;

    if (fileToDelete.isEntryPoint && files.filter(f => f.language === 'html').length > 1) {
      const otherHtmlFiles = files.filter(f => f.language === 'html' && f.id !== fileId);
      if (otherHtmlFiles.length > 0) {
        setFiles(prev => prev.map(f =>
          f.id === otherHtmlFiles[0].id ? { ...f, isEntryPoint: true } : f
        ));
      }
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

    setOpenFiles(prev => prev.filter(id => id !== fileId));
    toast.success(`Deleted ${fileToDelete.filename}`);
  }, [files, activeFileId]);

  // Delete folder
  const deleteFolder = useCallback((folderId: string) => {
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

  // Toggle folder open/close
  const toggleFolder = useCallback((folderId: string) => {
    setFolders(prev => prev.map(folder =>
      folder.id === folderId ? { ...folder, isOpen: !folder.isOpen } : folder
    ));
  }, []);

  // Handle folder selection
  const handleFolderSelect = useCallback((folderPath: string) => {
    setSelectedFolderPath(folderPath);
  }, []);

  // Set file as entry point
  const setAsEntryPoint = useCallback((fileId: string) => {
    if (files.find(f => f.id === fileId)?.language !== 'html') {
      toast.error("Only HTML files can be entry points");
      return;
    }

    setFiles(prev => prev.map(file => ({
      ...file,
      isEntryPoint: file.id === fileId
    })));
    toast.success("Set as entry point");

    setTimeout(compileCode, 100);
  }, [files, compileCode]);

  // Reset all code
  const resetCode = useCallback(() => {
    if (window.confirm("Are you sure you want to reset all files? This will delete all your work.")) {
      setFiles([]);
      setActiveFileId('');
      setOpenFiles([]);
      setSrcDoc('');
      addTerminalLog('system', 'All files reset');
      toast.info('All files reset. Start fresh!');
    }
  }, []);

  // Get language icon
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

  // Rename functionality
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

  // Load previous submission
  const loadPreviousSubmission = useCallback(async () => {
    setIsLoadingPrevious(true);
    try {
      const token = getToken() || localStorage.getItem('token') || '';

      if (!token) {
        toast.error("Authentication token missing");
        return;
      }

      const response = await fetch(
        `http://localhost:5533/courses/answers/previous-submission?courseId=${courseId}&exerciseId=${exerciseId}&questionId=${question._id}&category=${category}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        if (response.status === 404) {
          // No previous submission yet — perfectly normal, skip silently
          return;
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.success && data.data) {
        const submission = data.data;

        // Transform files
        const transformedFiles: FileType[] = (submission.files || []).map((file: any, index: number) => {
          let language: FileType['language'] = file.language as FileType['language'];
          if (!language && file.filename) {
            const ext = file.filename.split('.').pop()?.toLowerCase();
            if (ext === 'html' || ext === 'htm') language = 'html';
            else if (ext === 'css') language = 'css';
            else if (ext === 'js') language = 'javascript';
            else if (ext === 'json') language = 'json';
            else if (ext === 'xml') language = 'xml';
            else if (ext === 'md' || ext === 'markdown') language = 'markdown';
            else if (ext === 'txt') language = 'text';
            else language = 'text';
          }

          return {
            id: file.id || `file-${Date.now()}-${index}`,
            filename: file.filename || `file${index}.txt`,
            content: file.content || '',
            language: language || 'text',
            path: file.path || `/${file.filename}`,
            folderPath: file.folderPath || '/',
            isEntryPoint: file.isEntryPoint || false,
            lastModified: file.lastModified ? new Date(file.lastModified) : new Date(),
            size: file.size || (file.content ? Buffer.byteLength(file.content, 'utf8') : 0),
            isDirty: false
          };
        });

        // Transform folders
        const transformedFolders: FolderType[] = (submission.folders || []).map((folder: any, index: number) => {
          const path = folder.path || `/${folder.name}`;
          let parentPath = folder.parentPath || '/';
          // A folder must never be its own parent (e.g. the root '/'), otherwise
          // the recursive file-tree renderer (getSubfolders → renderFolder) loops
          // forever → "Maximum call stack size exceeded".
          if (path === parentPath) parentPath = '';

          return {
            id: folder.id || `folder-${Date.now()}-${index}`,
            name: folder.name || `folder${index}`,
            path: path,
            parentPath: parentPath,
            children: [],
            folderChildren: [],
            isOpen: true,
            depth: folder.depth || (path.split('/').filter(Boolean).length - 1)
          };
        });

        // Update state
        setFiles(transformedFiles);
        setFolders(transformedFolders);

        if (transformedFiles.length > 0) {
          const entryPoint = transformedFiles.find(f => f.isEntryPoint);
          const htmlFile = transformedFiles.find(f => f.language === 'html');
          const firstFileId = transformedFiles[0].id;
          const newActiveFileId = entryPoint?.id || htmlFile?.id || firstFileId;

          setActiveFileId(newActiveFileId);
          setOpenFiles([newActiveFileId]);
        }

        // Silent restore — no toast (auto-restore on reopen should be invisible)
        // Trigger preview compilation
        setTimeout(() => {
          compileCode();
        }, 100);
      } else {
        // No data — nothing to restore, skip silently
      }
    } catch (error: any) {
      console.error("Error loading previous submission:", error);
      // Only surface real errors to the user (404 is handled above; other failures
      // during auto-restore would be confusing, so log-only)
      // toast.error(`Failed to load previous submission: ${error.message}`);
    } finally {
      setIsLoadingPrevious(false);
    }
  }, [courseId, exerciseId, category, question._id, compileCode]);

  // Auto-restore the student's previously saved files/folders for this question
  // when they re-open the combined exercise (resume where they left off).
  // loadPreviousSubmission already fetches + setFiles/setFolders; it was only
  // wired to a (commented-out) button before, so stored work never reappeared.
  // Runs once per question; if no submission exists it keeps the starter files.
  const restoredQuestionIdRef = useRef<string | null>(null);
  useEffect(() => {
    const qId = question?._id || question?.id || null;
    if (!qId || restoredQuestionIdRef.current === qId) return;
    restoredQuestionIdRef.current = qId;
    loadPreviousSubmission();
  }, [question, loadPreviousSubmission]);

  // Handle iframe messages - UPDATED WITH NAVIGATION
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === 'log') {
        const level = event.data.level;
        const message = event.data.args.join(' ');

        let type: LogEntry['type'] = 'info';
        switch (level) {
          case 'error': type = 'error'; break;
          case 'warn': type = 'warning'; break;
          case 'log': type = 'stdout'; break;
          case 'info': type = 'info'; break;
        }

        addTerminalLog(type, message);
      }

      if (event.data.type === 'CREATE_FILE') {
        startCreatingFile();
      }

      // Handle navigation to other HTML files
      if (event.data.type === 'NAVIGATE_TO_FILE') {
        const { fileName, fileId } = event.data;

        // Find the target file by ID or filename
        const targetFile = files.find(f =>
          f.id === fileId ||
          f.filename.toLowerCase() === fileName.toLowerCase() ||
          f.filename.toLowerCase().endsWith(fileName.toLowerCase())
        );

        if (targetFile && targetFile.language === 'html') {
          // Update the preview to show the target file
          setCurrentPreviewFile(targetFile.filename);
          const newSrcDoc = generateSrcDocForFile(targetFile);
          setSrcDoc(newSrcDoc);
          setPreviewKey(Date.now());

          // Also switch to the file in editor if it exists
          setActiveFileId(targetFile.id);
          if (!openFiles.includes(targetFile.id)) {
            setOpenFiles(prev => [...prev, targetFile.id]);
          }

          toast.info(`Navigated to ${targetFile.filename}`, {
            autoClose: 2000,
            hideProgressBar: true
          });
        } else {
          toast.error(`Could not find HTML file: ${fileName}`);
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [files, folders, startCreatingFile, generateSrcDocForFile, openFiles]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // F2 to rename
      if (e.key === 'F2') {
        e.preventDefault();
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
      }

      // Escape to close context menu or cancel rename
      if (e.key === 'Escape') {
        if (contextMenu) {
          setContextMenu(null);
        }
        if (renameTarget) {
          cancelRename();
        }
      }

      // Ctrl/Cmd + N for new file
      if ((e.ctrlKey || e.metaKey) && e.key === 'n' && !e.shiftKey) {
        e.preventDefault();
        startCreatingFile();
      }

      // Ctrl/Cmd + Shift + N for new folder
      if ((e.ctrlKey || e.metaKey) && e.key === 'N' && e.shiftKey) {
        e.preventDefault();
        startCreatingFolder();
      }

      // Ctrl/Cmd + Enter to run
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        compileCode();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeFileId, files, contextMenu, renameTarget, cancelRename, startCreatingFile, startCreatingFolder, compileCode]);

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

  // Auto-compile on file changes
  useEffect(() => {
    const timeout = setTimeout(compileCode, 500);
    return () => clearTimeout(timeout);
  }, [files, compileCode]);

  // Toggle fullscreen
  const toggleFullscreen = async () => {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      await document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  // Render file tree
  const renderFileTree = useCallback(() => {
    const getFilesInFolder = (folderPath: string) => {
      return files.filter(file => file.folderPath === folderPath);
    };

    const getSubfolders = (folderPath: string) => {
      // Exclude self-referential folders (path === parentPath) so a folder can
      // never be its own child — guards the recursion below against bad data.
      return folders.filter(folder => folder.parentPath === folderPath && folder.path !== folderPath);
    };

    const renderFolder = (folder: FolderType, depth: number = 0, visited: Set<string> = new Set()) => {
      // Cycle guard: if we've already rendered this folder path in the current
      // branch, stop — prevents "Maximum call stack size exceeded" on cyclic data.
      if (visited.has(folder.path)) return null;
      visited = new Set(visited).add(folder.path);
      const folderFiles = getFilesInFolder(folder.path);
      const subfolders = getSubfolders(folder.path);
      const isSelected = selectedFolderPath === folder.path;
      const isCreatingFileHere = isCreatingFile && selectedFolderPath === folder.path;
      const isCreatingFolderHere = isCreatingFolder && selectedFolderPath === folder.path;
      const isRenaming = renameTarget?.id === folder.id && renameTarget?.type === 'folder';

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
                  if (e.key === 'Enter') handleRenameSubmit();
                  if (e.key === 'Escape') cancelRename();
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
          <div
            className={`flex items-center gap-2 px-2 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded cursor-pointer text-sm ${isSelected ? 'bg-orange-50 dark:bg-orange-900/20' : ''}`}
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
            <span className={`text-xs ${theme === 'light' ? 'text-[#666666] bg-gray-200' : 'text-[#858585] bg-gray-800'} px-1.5 py-0.5 rounded`}>
              {folderFiles.length + subfolders.length}
            </span>
          </div>

          {folder.isOpen && (
            <div>
              {subfolders.map(subfolder => renderFolder(subfolder, depth + 1, visited))}

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
                      if (e.key === 'Enter') createNewFolder();
                      if (e.key === 'Escape') cancelFolderCreation();
                    }}
                    onBlur={() => {
                      setTimeout(() => {
                        if (newFolderTempName.trim()) {
                          createNewFolder();
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
                  <div key={file.id}
                    className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer text-sm group ${activeFileId === file.id
                      ? 'bg-orange-50 dark:bg-orange-900/20'
                      : 'hover:bg-gray-100 dark:hover:bg-gray-800'
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
                      <Star size={12} className="flex-shrink-0 text-yellow-500" title="Entry Point" />
                    )}

                    {file.isDirty && !isRenamingFile && (
                      <div className="w-1.5 h-1.5 rounded-full flex-shrink-0 bg-orange-500" />
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
                        className="p-0.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
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
                          className="p-0.5 hover:bg-red-500 hover:text-white rounded"
                          title="Delete"
                        >
                          <Trash2 size={10} className="currentColor" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}

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
                      if (e.key === 'Enter') createNewFile();
                      if (e.key === 'Escape') cancelFileCreation();
                    }}
                    onBlur={() => {
                      setTimeout(() => {
                        if (newFileTempName.trim()) {
                          createNewFile();
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

    const rootFiles = getFilesInFolder('/');
    const rootFolders = getSubfolders('/');
    const isRootSelected = selectedFolderPath === '/';
    const isCreatingFileInRoot = isCreatingFile && selectedFolderPath === '/';
    const isCreatingFolderInRoot = isCreatingFolder && selectedFolderPath === '/';

    return (
      <div className="space-y-0.5 p-2">
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
                ? 'bg-orange-50 dark:bg-orange-900/20'
                : 'hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
              onClick={() => {
                setActiveFileId(file.id);
                if (!openFiles.includes(file.id)) {
                  setOpenFiles(prev => [...prev, file.id]);
                }
                setSelectedFolderPath('/');
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
              <span className={`flex-1 truncate ${theme === 'light' ? 'text-[#333333]' : 'text-[#cccccc]'}`}>
                {file.filename}
              </span>

              {file.isEntryPoint && (
                <Star
                  size={12}
                  className="flex-shrink-0 text-yellow-500"
                  title="Entry Point"
                  onClick={(e) => {
                    e.stopPropagation();
                    setAsEntryPoint(file.id);
                  }}
                />
              )}

              {file.isDirty && !isRenaming && (
                <div
                  className="w-1.5 h-1.5 rounded-full flex-shrink-0 bg-orange-500"
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
                    className="p-0.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
                    title="Entry point (click to change)"
                  >
                    <Star size={10} className="text-yellow-500" />
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
                  className="p-0.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
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
                    className="p-0.5 hover:bg-red-500 hover:text-white rounded"
                    title="Delete"
                  >
                    <Trash2 size={10} className="currentColor" />
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {isCreatingFolderInRoot && (
          <div className="flex items-center gap-2 px-2 py-1.5">
            <FolderPlus size={14} className="flex-shrink-0 text-[#4ec9b0]" />
            <input
              type="text"
              value={newFolderTempName}
              onChange={(e) => setNewFolderTempName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') createNewFolder();
                if (e.key === 'Escape') cancelFolderCreation();
              }}
              onBlur={() => {
                setTimeout(() => {
                  if (newFolderTempName.trim()) {
                    createNewFolder();
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

        {isCreatingFileInRoot && (
          <div className="flex items-center gap-2 px-2 py-1.5">
            <FilePlus size={14} className="flex-shrink-0 text-[#666666]" />
            <input
              type="text"
              value={newFileTempName}
              onChange={(e) => setNewFileTempName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') createNewFile();
                if (e.key === 'Escape') cancelFileCreation();
              }}
              onBlur={() => {
                setTimeout(() => {
                  if (newFileTempName.trim()) {
                    createNewFile();
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

        {rootFolders.map(folder => renderFolder(folder, 0))}

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
  }, [files, folders, activeFileId, toggleFolder, getLanguageIcon, openFiles, selectedFolderPath, isCreatingFile, isCreatingFolder, newFileTempName, newFolderTempName, handleFolderSelect, createNewFile, cancelFileCreation, createNewFolder, cancelFolderCreation, theme, renameTarget, tempRenameValue, handleRenameSubmit, cancelRename, deleteFile, setAsEntryPoint]);

  // Submit code
  const submitCode = async () => {
    setIsSubmitting(true);

    try {
      const token = getToken() || localStorage.getItem('token') || '';

      // Store structured files/folders via submit-multiple-files — exactly like the
      // standalone frontendCompiler.tsx (and the combined SQL question). The backend
      // then persists files:[]/folders:[] instead of a flattened code blob.
      // The backend rejects empty files, so keep only files that have content.
      const validFiles = files.filter(f => f.filename && (f.content ?? '') !== '' && f.language);
      if (validFiles.length === 0) {
        toast.warning('Add at least one file with content before submitting.');
        setIsSubmitting(false);
        return;
      }

      const payloadFiles = validFiles.map(file => ({
        id: file.id,
        filename: file.filename,
        content: file.content,
        language: file.language,
        path: file.path,
        folderPath: file.folderPath,
        isEntryPoint: file.isEntryPoint || false,
        lastModified: file.lastModified || new Date().toISOString(),
        size: file.size || (file.content ? Buffer.byteLength(file.content, 'utf8') : 0),
      }));

      const payloadFolders = folders.map(folder => ({
        id: folder.id,
        name: folder.name,
        path: folder.path,
        parentPath: folder.parentPath,
        depth: folder.depth,
      }));

      const response = await fetch('http://localhost:5533/courses/answers/submit-multiple-files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          courseId,
          exerciseId,
          questionId: question._id,
          questionTitle: question.title || 'Frontend Question',
          exerciseName: question.exerciseName || 'Frontend Exercise',
          category,
          subcategory,
          selectedProgrammingLanguage: 'html/css/javascript',
          nodeId,
          nodeName,
          nodeType: 'frontend',
          files: payloadFiles,
          folders: payloadFolders,
          status: 'submitted',
          score: 0,
          attemptCount: 1,
          studentId: studentId || 'unknown_student',
          projectStructure: {
            totalFiles: payloadFiles.length,
            htmlFiles: payloadFiles.filter(f => f.language === 'html').length,
            cssFiles: payloadFiles.filter(f => f.language === 'css').length,
            jsFiles: payloadFiles.filter(f => f.language === 'javascript').length,
            entryPoints: payloadFiles.filter(f => f.isEntryPoint).map(f => f.filename),
            folderCount: payloadFolders.length,
            hasFolders: payloadFolders.length > 0,
          },
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (response.ok && data.success !== false) {
        addTerminalLog('success', '✅ Frontend code submitted successfully!');
        toast.success('Frontend submission saved!');
        onComplete();

        setTimeout(() => {
          onNext();
        }, 1500);
      } else {
        throw new Error(data.message || 'Submission failed');
      }
    } catch (error: any) {
      console.error("Submission error:", error);
      addTerminalLog('error', `❌ ${error.message || error}`);
      toast.error(error.message || 'Submission failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Expose submit to parent (combined page bottom-bar "Submit Question")
  useEffect(() => {
    registerSubmit?.(submitCode);
  });

  // Terminal Component
  const InteractiveTerminal = () => {
    if (!showTerminal) return null;

    return (
      <div className="fixed bottom-4 right-4 w-96 h-64 bg-gray-900 text-white rounded-lg shadow-2xl border border-gray-700 flex flex-col z-50">
        <div className="flex items-center justify-between px-3 py-2 border-b border-gray-700">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-green-400" />
            <span className="text-sm font-medium">Console Output</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={clearTerminal}
              className="p-1 hover:bg-gray-800 rounded"
              title="Clear"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setShowTerminal(false)}
              className="p-1 hover:bg-gray-800 rounded"
              title="Close"
            >
              <XIcon className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-2 font-mono text-xs">
          {terminalLogs.length === 0 && !isRunning && (
            <div className="text-gray-500 italic">Console output will appear here...</div>
          )}
          {terminalLogs.map((log) => (
            <div key={log.id} className="break-all whitespace-pre-wrap leading-relaxed">
              {log.type === 'stdout' && <span className="text-gray-300">{log.content}</span>}
              {log.type === 'stderr' && <span className="text-red-400">{log.content}</span>}
              {log.type === 'system' && <span className="text-blue-400">➜ {log.content}</span>}
              {log.type === 'error' && <span className="text-red-400">{log.content}</span>}
              {log.type === 'warning' && <span className="text-yellow-400">{log.content}</span>}
              {log.type === 'success' && <span className="text-green-400">{log.content}</span>}
              {log.type === 'info' && <span className="text-blue-400">{log.content}</span>}
            </div>
          ))}
          {isRunning && (
            <div className="flex items-center gap-2 mt-2">
              <Loader2 className="w-3 h-3 text-green-500 animate-spin" />
              <span className="text-gray-500">Running code...</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  const activeFile = files.find(f => f.id === activeFileId);

  return (
    <div className="h-full flex flex-col" style={{ backgroundColor: colors.background }}>
      <ToastContainer
        position="bottom-right"
        autoClose={3000}
        theme={theme === 'light' ? 'light' : 'dark'}
      />

      <InteractiveTerminal />

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
          {contextMenu.type === 'folder' && (
            <>
              <button
                className="flex items-center gap-2 w-full px-3 py-1.5 text-sm hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors"
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
                className="flex items-center gap-2 w-full px-3 py-1.5 text-sm hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors"
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

          <button
            className="flex items-center gap-2 w-full px-3 py-1.5 text-sm hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors"
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

          {contextMenu.type === 'file' && (
            <>
              <button
                className="flex items-center gap-2 w-full px-3 py-1.5 text-sm hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors"
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
                className="flex items-center gap-2 w-full px-3 py-1.5 text-sm hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors"
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
                className="flex items-center gap-2 w-full px-3 py-1.5 text-sm hover:bg-red-500 hover:text-white transition-colors"
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

          {contextMenu.type === 'folder' && (
            <>
              <button
                className="flex items-center gap-2 w-full px-3 py-1.5 text-sm hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors"
                style={{ color: colors.text }}
                onClick={() => {
                  const folder = folders.find(f => f.id === contextMenu.id);
                  if (folder) {
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

              <div className="h-px my-1" style={{ backgroundColor: colors.border }} />

              <button
                className="flex items-center gap-2 w-full px-3 py-1.5 text-sm hover:bg-red-500 hover:text-white transition-colors"
                style={{ color: colors.text }}
                onClick={() => {
                  const folder = folders.find(f => f.id === contextMenu.id);
                  if (folder) {
                    deleteFolder(folder.id);
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

      {/* Main Container with Sidebar */}
      <div className="flex-1 flex overflow-hidden">
        {/* Question Sidebar (resizable — drag the handle on its right edge) */}
        <div
          className="h-full border-r flex flex-col"
          style={{
            width: showQuestionDetails ? sidebarWidth : 48,
            flexShrink: 0,
            transition: isResizingQuestionSidebar ? 'none' : 'width 0.3s ease',
            backgroundColor: colors.sidebar,
            borderColor: colors.border
          }}
        >
          <div className="p-3 border-b flex items-center justify-between" style={{ borderColor: colors.border }}>
            {showQuestionDetails ? (
              <>
                <div className="flex items-center gap-2">
                  <BookOpen size={16} style={{ color: colors.primary }} />
                  <span className="text-sm font-medium" style={{ color: colors.text }}>
                    Question
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  {onFlagToggle && (
                    <button
                      onClick={onFlagToggle}
                      className="p-1 rounded transition-colors hover:bg-gray-200"
                      style={{ color: isFlagged ? '#f59e0b' : colors.textSecondary }}
                      title={isFlagged ? 'Unflag this question' : 'Flag this question'}
                    >
                      <Flag size={15} fill={isFlagged ? '#f59e0b' : 'none'} />
                    </button>
                  )}
                  <button
                    onClick={() => setShowQuestionDetails(false)}
                    className="p-1 hover:bg-gray-200 rounded transition-colors"
                    style={{ color: colors.textSecondary }}
                    title="Hide Question"
                  >
                    <ChevronLeft size={16} />
                  </button>
                </div>
              </>
            ) : (
              <button
                onClick={() => setShowQuestionDetails(true)}
                className="w-full flex items-center justify-center p-1 hover:bg-gray-200 rounded transition-colors"
                style={{ color: colors.textSecondary }}
                title="Show Question"
              >
                <ChevronRight size={16} />
              </button>
            )}
          </div>

          {/* Question Content */}
          {showQuestionDetails && (
            <div className="flex-1 overflow-y-auto p-4">
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold mb-2" style={{ color: colors.text }}>
                    {questionNumber != null ? `${questionNumber}. ` : ''}{question.title || 'Frontend Question'}
                  </h3>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded text-xs font-medium">
                      Frontend
                    </span>
                    <span className="text-xs" style={{ color: colors.textSecondary }}>
                      {question.difficulty || 'Medium'}
                    </span>
                  </div>
                </div>

                {/* Left Panel - Problem Description */}
                <div className="mb-6">
                  <h3 className="text-sm font-semibold text-gray-900 mb-2">Description</h3>
                  <RichTextDisplay
                    content={
                      // Match frontendCompiler.tsx: render the first content block's
                      // value. `description.text` is an array of blocks, so passing it
                      // straight to RichTextDisplay showed "[object Object]".
                      question.description?.text?.[0]?.value ||
                      (typeof question.description === 'string' ? question.description : '') ||
                      (typeof question.description?.text === 'string' ? question.description.text : '') ||
                      ''
                    }
                    className="text-sm text-gray-700 whitespace-pre-wrap"
                  />
                </div>
                {question.example && (
                  <div>
                    <h4 className="text-sm font-medium mb-2" style={{ color: colors.text }}>
                      Example
                    </h4>
                    <div
                      className="text-sm whitespace-pre-wrap p-3 rounded border"
                      style={{
                        color: colors.text,
                        backgroundColor: theme === 'light' ? '#f8f9fa' : '#2d2d2d',
                        borderColor: colors.border
                      }}
                      dangerouslySetInnerHTML={{ __html: question.example }}
                    />
                  </div>
                )}

                {question.constraints && question.constraints.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium mb-2" style={{ color: colors.text }}>
                      Requirements
                    </h4>
                    <ul className="space-y-1">
                      {question.constraints.map((constraint: string, idx: number) => (
                        <li key={idx} className="flex items-start gap-2 text-sm" style={{ color: colors.text }}>
                          <span className="text-green-500 mt-0.5">•</span>
                          <span>{constraint}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* <div className="p-3 rounded border" style={{
                  backgroundColor: theme === 'light' ? '#e7f3ff' : '#1a365d',
                  borderColor: theme === 'light' ? '#b3d7ff' : '#2d3748'
                }}>
                  <h4 className="text-sm font-medium mb-2 flex items-center gap-2" style={{ color: colors.primary }}>
                    <HelpCircle size={14} />
                    Tips
                  </h4>
                  <ul className="space-y-1 text-xs" style={{ color: colors.textSecondary }}>
                    <li className="flex items-start gap-2">
                      <span>•</span>
                      <span>External links in preview are blocked for security</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span>•</span>
                      <span>Right-click files/folders for more options</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span>•</span>
                      <span>Press F2 to rename selected item</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span>•</span>
                      <span>Links to local HTML files will work within the preview</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span>•</span>
                      <span>Set an HTML file as entry point for preview</span>
                    </li>
                  </ul>
                </div> */}
              </div>
            </div>
          )}
        </div>

        {/* Drag handle to resize the Question sidebar — works even when collapsed
            (dragging it open expands the sidebar). */}
        <div
          onMouseDown={startQuestionSidebarResize}
          className="cursor-ew-resize flex-shrink-0 hover:bg-orange-500 transition-colors"
          style={{ width: 4, backgroundColor: isResizingQuestionSidebar ? '#fb923c' : 'transparent' }}
          title="Drag to resize"
        />

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Top Header */}
          <div className="px-3 py-1.5 border-b flex items-center justify-between" style={{ borderColor: colors.border }}>
            <div className="flex items-center gap-1.5">
              <Code className="w-3.5 h-3.5 text-purple-500" />
              <h2 className="text-sm font-semibold" style={{ color: colors.text }}>
                Frontend Editor
              </h2>
            </div>

            <div className="flex items-center gap-2">
              {/* <button
                onClick={() => setShowTerminal(true)}
                className="h-7 px-2 text-xs border rounded flex items-center gap-1 hover:opacity-90 transition-opacity"
                style={{ borderColor: colors.border, color: colors.text }}
              >
                <Terminal className="w-3 h-3" />
                Console
              </button> */}
              {/*               
              <button
                onClick={startCreatingFile}
                className="h-7 px-2 text-xs border rounded flex items-center gap-1 hover:opacity-90 transition-opacity"
                style={{ borderColor: colors.border, color: colors.text }}
              >
                <FilePlus className="w-3 h-3" />
                New File
              </button>
              
              <button
                onClick={startCreatingFolder}
                className="h-7 px-2 text-xs border rounded flex items-center gap-1 hover:opacity-90 transition-opacity"
                style={{ borderColor: colors.border, color: colors.text }}
              >
                <FolderPlus className="w-3 h-3" />
                New Folder
              </button> */}

              {/* <button
                onClick={loadPreviousSubmission}
                disabled={isLoadingPrevious}
                className="h-7 px-2 text-xs border rounded flex items-center gap-1 hover:opacity-90 disabled:opacity-50 transition-opacity"
                style={{ borderColor: colors.border, color: colors.text }}
                title="Load Previous Submission"
              >
                {isLoadingPrevious ? <Loader2 className="w-3 h-3 animate-spin" /> : <History className="w-3 h-3" />}
                {isLoadingPrevious ? 'Loading...' : 'Load Previous'}
              </button> */}

              <button
                onClick={() => {
                  const htmlFile = files.find(f => f.language === 'html' && f.isEntryPoint) ||
                    files.find(f => f.language === 'html') ||
                    files[0];

                  if (htmlFile) {
                    const newWindow = window.open('', '_blank');
                    if (newWindow) {
                      const htmlContent = generateSrcDocForFile(htmlFile);
                      newWindow.document.open();
                      newWindow.document.write(htmlContent);
                      newWindow.document.close();
                      toast.success('Opened in new tab');
                    }
                  } else {
                    toast.error('No HTML file found to open');
                  }
                }}
                disabled={files.length === 0}
                className="h-7 px-2 text-xs border rounded flex items-center gap-1 hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ borderColor: colors.border, color: colors.text }}
                title="Open Preview in New Tab"
              >
                <ExternalLink className="w-3 h-3" />
                Open Tab
              </button>

              {/* Output — opens the Preview panel from the right and refreshes it */}
              <button
                onClick={() => {
                  setSelectedTab('preview');
                  compileCode();
                }}
                disabled={isRunning || files.length === 0}
                className="h-7 px-2.5 text-xs bg-orange-500 text-white rounded hover:bg-orange-600 disabled:opacity-50 flex items-center gap-1"
                title="Show Output"
              >
                {isRunning ? <Loader2 className="w-3 h-3 animate-spin" /> : <Eye className="w-3 h-3" />}
                Output
              </button>

              <button
                onClick={toggleFullscreen}
                className="w-7 h-7 flex items-center justify-center border rounded hover:opacity-90 transition-opacity"
                style={{ borderColor: colors.border, color: colors.text }}
              >
                {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {/* Main Editor Area */}
          <div className="flex-1 flex overflow-hidden">
            {/* Activity Bar */}
            <div className="w-12 flex flex-col items-center py-3 gap-4" style={{
              backgroundColor: colors.activityBar,
              borderRight: `1px solid ${colors.border}`
            }}>
              <button
                onClick={() => setShowFileTree(!showFileTree)}
                className="p-2 rounded hover:bg-gray-200 transition-colors"
                style={{ color: colors.textSecondary }}
                title="Explorer"
              >
                <Folder size={20} />
              </button>

              <button
                onClick={() => setSelectedTab(selectedTab === 'preview' ? 'editor' : 'preview')}
                className={`p-2 rounded transition-colors ${selectedTab === 'preview' ? 'bg-orange-100 text-orange-600' : 'hover:bg-gray-200'}`}
                style={{
                  color: selectedTab === 'preview' ? colors.primary : colors.textSecondary,
                  backgroundColor: selectedTab === 'preview' ? (theme === 'light' ? '#e3f2fd' : '#094771') : 'transparent'
                }}
                title={selectedTab === 'preview' ? 'Switch to Editor' : 'Switch to Preview'}
              >
                {selectedTab === 'preview' ? <FileCode size={20} /> : <Eye size={20} />}
              </button>

              <div className="flex-1"></div>

              <button
                onClick={compileCode}
                className="p-2 rounded hover:bg-gray-200 transition-colors"
                style={{ color: colors.textSecondary }}
                title="Run"
              >
                <Play size={20} />
              </button>

              <button
                onClick={() => setEditorZoom(prev => Math.min(prev + 10, 200))}
                className="p-2 rounded hover:bg-gray-200 transition-colors"
                style={{ color: colors.textSecondary }}
                title="Zoom In"
              >
                <ZoomIn size={20} />
              </button>

              <button
                onClick={() => setEditorZoom(prev => Math.max(prev - 10, 50))}
                className="p-2 rounded hover:bg-gray-200 transition-colors"
                style={{ color: colors.textSecondary }}
                title="Zoom Out"
              >
                <ZoomOut size={20} />
              </button>
            </div>

            {/* File Tree Sidebar */}
            {showFileTree && (
              <div className="w-64 flex flex-col" style={{
                backgroundColor: colors.sidebar,
                borderRight: `1px solid ${colors.border}`
              }}>
                <div className="px-3 py-2 border-b flex items-center justify-between" style={{ borderColor: colors.border }}>
                  <div className="text-xs font-semibold uppercase tracking-wider" style={{ color: colors.textSecondary }}>
                    Explorer
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={startCreatingFolder}
                      className="p-1 hover:bg-gray-200 rounded transition-colors"
                      style={{ color: colors.textSecondary }}
                      title="New Folder"
                    >
                      <FolderPlus size={14} />
                    </button>
                    <button
                      onClick={startCreatingFile}
                      className="p-1 hover:bg-gray-200 rounded transition-colors"
                      style={{ color: colors.textSecondary }}
                      title="New File"
                    >
                      <FilePlus size={14} />
                    </button>
                    <button
                      onClick={compileCode}
                      className="p-1 hover:bg-gray-200 rounded transition-colors"
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

            {/* Editor Area */}
            <div className="flex-1 flex flex-col">
              {/* Editor Tabs */}
              <div className="flex items-center border-b" style={{
                backgroundColor: colors.editorGroup,
                borderColor: colors.border
              }}>
                <div className="flex items-center flex-1 overflow-x-auto">
                  {files
                    .filter(file => openFiles.includes(file.id))
                    .map(file => {
                      const isActive = activeFileId === file.id;
                      return (
                        <div
                          key={file.id}
                          className={`group flex items-center gap-2 px-4 py-2 border-r text-sm cursor-pointer min-w-[150px] max-w-[200px] ${isActive
                            ? 'border-t-2'
                            : 'hover:bg-gray-100'
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

                          {/* X button to close tab */}
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
                            className="p-0.5 rounded hover:bg-gray-200 opacity-0 group-hover:opacity-100 transition-opacity"
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
                  <div className="text-xs px-2 py-1 rounded" style={{
                    backgroundColor: theme === 'light' ? '#e5e5e5' : '#2d2d2d',
                    color: colors.textSecondary
                  }}>
                    {editorZoom}%
                  </div>
                </div>
              </div>

              {/* Editor + Preview side-by-side (like student/frontendCompiler.tsx) */}
              <div className="flex-1 relative flex overflow-hidden">
                {/* Editor — always visible on left */}
                <div className="flex-1 relative min-w-0">
                  {!activeFile ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-8">
                      <FilePlus className="w-16 h-16 text-gray-300 mb-4" />
                      <h3 className="text-lg font-medium text-gray-700 mb-2">No file selected</h3>
                      <p className="text-gray-500 text-center mb-6">
                        Create a new file or select an existing one to start coding
                      </p>
                      <button
                        onClick={startCreatingFile}
                        className="px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600 flex items-center gap-2"
                      >
                        <FilePlus className="w-4 h-4" />
                        Create New File
                      </button>
                    </div>
                  ) : (
                    <MonacoEditor
                      language={activeFile.language}
                      theme={theme === 'light' ? 'vs' : 'vs-dark'}
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
                        mouseWheelZoom: true,
                        padding: { top: 10 },
                        lineNumbers: 'on',
                        glyphMargin: true,
                        folding: true,
                        scrollbar: {
                          vertical: 'visible',
                          horizontal: 'visible',
                          useShadows: false
                        }
                      }}
                    />
                  )}
                </div>

                {/* Preview — slides in on right when Output is clicked */}
                {selectedTab === 'preview' && (
                  <div className="flex flex-col border-l" style={{ width: '50%', borderColor: colors.border, backgroundColor: colors.editorGroup }}>
                    <div className="px-3 py-2 border-b flex items-center justify-between" style={{
                      borderColor: colors.border,
                      backgroundColor: colors.editorGroup
                    }}>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium" style={{ color: colors.text }}>Output</span>
                        <span className="text-xs px-2 py-0.5 rounded bg-green-100 text-green-800">
                          {currentPreviewFile || 'No file'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={compileCode}
                          className="p-1.5 hover:bg-gray-100 rounded transition-colors"
                          style={{ color: colors.textSecondary }}
                          title="Refresh Preview"
                        >
                          <RefreshCw size={14} />
                        </button>

                        <button
                          onClick={() => {
                            const htmlFile = files.find(f => f.language === 'html' && f.isEntryPoint) ||
                              files.find(f => f.language === 'html') ||
                              files[0];

                            if (htmlFile) {
                              const newWindow = window.open('', '_blank');
                              if (newWindow) {
                                const htmlContent = generateSrcDocForFile(htmlFile);
                                newWindow.document.open();
                                newWindow.document.write(htmlContent);
                                newWindow.document.close();
                                toast.success('Opened in new tab');
                              }
                            } else {
                              toast.error('No HTML file found to open');
                            }
                          }}
                          disabled={files.length === 0}
                          className="p-1.5 hover:bg-gray-100 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          style={{ color: colors.textSecondary }}
                          title="Open in New Tab"
                        >
                          <ExternalLink size={14} />
                        </button>

                        <button
                          onClick={() => setIsFullscreen(!isFullscreen)}
                          className="p-1.5 hover:bg-gray-100 rounded transition-colors"
                          style={{ color: colors.textSecondary }}
                          title="Toggle Fullscreen"
                        >
                          {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                        </button>

                        <button
                          onClick={() => setSelectedTab('editor')}
                          className="p-1.5 hover:bg-gray-100 rounded transition-colors"
                          style={{ color: colors.textSecondary }}
                          title="Close Output"
                        >
                          <XIcon size={14} />
                        </button>
                      </div>
                    </div>

                    <div className="flex-1 relative">
                      {isRunning ? (
                        <div className="absolute inset-0 flex items-center justify-center" style={{ backgroundColor: colors.background }}>
                          <div className="text-center">
                            <Loader2 className="w-8 h-8 text-gray-400 animate-spin mx-auto mb-2" />
                            <p className="text-sm" style={{ color: colors.textSecondary }}>Loading preview...</p>
                          </div>
                        </div>
                      ) : isFullscreen ? (
                        <div className="fixed inset-0 z-50" style={{ backgroundColor: colors.background }}>
                          <div className="h-12 border-b flex items-center justify-between px-4" style={{
                            borderColor: colors.border,
                            backgroundColor: colors.sidebar
                          }}>
                            <span style={{ color: colors.text }}>Fullscreen Preview - {currentPreviewFile}</span>
                            <button
                              onClick={() => setIsFullscreen(false)}
                              className="p-2 hover:bg-gray-100 rounded"
                              style={{ color: colors.text }}
                            >
                              <XIcon size={16} />
                            </button>
                          </div>
                          <iframe
                            key={previewKey}
                            ref={previewFrameRef}
                            srcDoc={srcDoc}
                            title="Preview"
                            className="w-full h-[calc(100vh-3rem)] border-0"
                            sandbox="allow-scripts allow-same-origin"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                      ) : (
                        <iframe
                          key={previewKey}
                          ref={previewFrameRef}
                          srcDoc={srcDoc}
                          title="Preview"
                          className="w-full h-full border-0"
                          sandbox="allow-scripts allow-same-origin"
                          referrerPolicy="no-referrer"
                        />
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Status Bar */}
              <div className="px-3 py-1.5 border-t flex items-center justify-between text-xs" style={{
                borderColor: colors.border,
                backgroundColor: theme === 'light' ? '#e5e5e5' : '#2d2d2d'
              }}>
                <div className="flex items-center gap-4" style={{ color: colors.textSecondary }}>
                  <button
                    onClick={() => setShowTerminal(true)}
                    className="flex items-center gap-1 hover:text-orange-600 transition-colors"
                  >
                    <Terminal size={12} />
                    <span>Output</span>
                  </button>
                  {activeFile && (
                    <div className="flex items-center gap-1">
                      <span>{activeFile.language.toUpperCase()}</span>
                      {activeFile.isEntryPoint && <Star size={10} className="text-yellow-500" />}
                    </div>
                  )}
                  <span>Ln {activeFile ? activeFile.content.split('\n').length : 0}, Col 1</span>
                </div>
                <div className="flex items-center gap-3" style={{ color: colors.textSecondary }}>
                  <button
                    onClick={() => setLayout(layout === 'horizontal' ? 'vertical' : 'horizontal')}
                    className="hover:text-orange-600 transition-colors"
                    title="Toggle Layout"
                  >
                    {layout === 'horizontal' ? <SplitSquareHorizontal size={12} /> : <SplitSquareVertical size={12} />}
                  </button>
                  <button
                    onClick={() => setSelectedTab(selectedTab === 'preview' ? 'editor' : 'preview')}
                    className="hover:text-orange-600 transition-colors"
                    title="Toggle Preview"
                  >
                    {selectedTab === 'preview' ? <PanelLeftClose size={12} /> : <PanelLeftOpen size={12} />}
                  </button>
                  <span className="text-green-500">● Live</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FrontendQuestion;