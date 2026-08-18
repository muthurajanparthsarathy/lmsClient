"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import dynamic from 'next/dynamic';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import {
  FileCode,
  Folder,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  Code2,
  Terminal,
  RefreshCw,
  AlertCircle,
  Loader2,
  ExternalLink,
  ChevronDown,
  X,
  Search,
  FileJson,
  ZoomIn,
  ZoomOut,
  SplitSquareVertical,
  SplitSquareHorizontal,
  Eye,
  EyeOff,
  MonitorPlay,
  FileText,
  Palette,
  Star,
  Monitor,
  CheckCircle,
  ArrowRight
} from 'lucide-react';

// Dynamic imports
const MonacoEditor = dynamic(() => import('@monaco-editor/react'), {
  ssr: false,
  loading: () => <div className="w-full h-full flex items-center justify-center bg-white dark:bg-[#1e1e1e]">Loading editor...</div>
});

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

interface FrontendSubmission {
  _id?: string;
  exerciseId?: string;
  questionId?: string;
  files?: FileType[];
  folders?: FolderType[];
  status?: string;
  score?: number;
  feedback?: string;
  submittedAt?: string;
  attemptCount?: number;
  participantName?: string;
  participantEmail?: string;
}

interface StaffFrontendReviewProps {
  onBack: () => void;
  title: string;
  submission?: FrontendSubmission;
  questionTitle?: string;
  questionDescription?: string;
  initialFiles?: FileType[];
  initialFolders?: FolderType[];
  isLoadingSubmission?: boolean;
  selectedLanguages?: string[];
  exerciseId?: string;
  exerciseName?: string;
  participantId?: string;
  questionId?: string;
  category?: string;
  subcategory?: string;
}

const StaffFrontendReview: React.FC<StaffFrontendReviewProps> = ({
  onBack,
  questionTitle,
  questionId,
  category,
  subcategory,
  submission,
  title,
  initialFiles,
  initialFolders,
  isLoadingSubmission = false,
  selectedLanguages = []
}) => {
  // Theme state
  const [theme, setTheme] = useState<'vs-dark' | 'light'>('light');
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);

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

  const colors = theme === 'light' ? lightColors : darkColors;

  // Default files (empty preview state)
  const defaultFiles: FileType[] = [
    {
      id: 'preview-placeholder',
      filename: 'preview.html',
      content: `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>No Submission</title>
    <style>
        body {
            font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            margin: 0;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
        }
        .message-container {
            text-align: center;
            padding: 2rem;
            background: rgba(255,255,255,0.1);
            border-radius: 1rem;
            backdrop-filter: blur(10px);
            max-width: 500px;
            margin: 1rem;
        }
        h1 { margin-bottom: 1rem; font-size: 2rem; }
        p { font-size: 1.1rem; line-height: 1.6; opacity: 0.9; }
        .icon { font-size: 4rem; margin-bottom: 1rem; }
    </style>
</head>
<body>
    <div class="message-container">
        <div class="icon">📁</div>
        <h1>No Submission Available</h1>
        <p>The student has not submitted any code for this question yet.</p>
    </div>
</body>
</html>`,
      language: 'html',
      path: '/preview.html',
      folderPath: '/',
      isEntryPoint: true,
      lastModified: new Date()
    }
  ];

  const defaultFolders: FolderType[] = [
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
  ];

  // State for files and folders - PRIORITIZE submission prop data
  const [files, setFiles] = useState<FileType[]>(() => {
    // First check if we have submission with files
    if (submission && submission.files && submission.files.length > 0) {
      return submission.files.map(file => ({
        ...file,
        lastModified: file.lastModified ? new Date(file.lastModified) : new Date(),
        isDirty: false
      }));
    }
    // Then check initialFiles
    if (initialFiles && initialFiles.length > 0) {
      return initialFiles.map(file => ({
        ...file,
        lastModified: file.lastModified ? new Date(file.lastModified) : new Date(),
        isDirty: false
      }));
    }
    return defaultFiles;
  });

  const [folders, setFolders] = useState<FolderType[]>(() => {
    if (submission && submission.folders && submission.folders.length > 0) {
      return submission.folders.map(folder => ({
        ...folder,
        isOpen: folder.isOpen !== undefined ? folder.isOpen : true,
        children: folder.children || [],
        folderChildren: folder.folderChildren || []
      }));
    }
    if (initialFolders && initialFolders.length > 0) {
      return initialFolders.map(folder => ({
        ...folder,
        isOpen: folder.isOpen !== undefined ? folder.isOpen : true,
        children: folder.children || [],
        folderChildren: folder.folderChildren || []
      }));
    }
    return defaultFolders;
  });

  const [activeFileId, setActiveFileId] = useState<string>(() => {
    // Find HTML file or entry point
    const htmlFile = files.find(f => f.language === 'html' && f.isEntryPoint);
    if (htmlFile) return htmlFile.id;
    const anyHtml = files.find(f => f.language === 'html');
    if (anyHtml) return anyHtml.id;
    if (files.length > 0) return files[0].id;
    return 'preview-placeholder';
  });

  const [srcDoc, setSrcDoc] = useState<string>('');
  const [showFileTree, setShowFileTree] = useState(true);
  const [showPreview, setShowPreview] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPreviewFile, setCurrentPreviewFile] = useState<string>('');
  const [editorZoom, setEditorZoom] = useState(100);
  const [showOutput, setShowOutput] = useState(false);
  const [layout, setLayout] = useState<'horizontal' | 'vertical'>('horizontal');
  const [openFiles, setOpenFiles] = useState<string[]>(() => {
    const htmlFile = files.find(f => f.language === 'html');
    return htmlFile ? [htmlFile.id] : (files.length > 0 ? [files[0].id] : ['preview-placeholder']);
  });
  const [selectedFolderPath, setSelectedFolderPath] = useState<string>('/');
  
  // Collapsible sections state
  const [isExplorerCollapsed, setIsExplorerCollapsed] = useState(false);
  const [isEditorCollapsed, setIsEditorCollapsed] = useState(false);
  const [isPreviewCollapsed, setIsPreviewCollapsed] = useState(false);
  const [explorerWidth, setExplorerWidth] = useState(260);
  const [previewWidth, setPreviewWidth] = useState(50);
  const [isResizingExplorer, setIsResizingExplorer] = useState(false);
  const [isResizingPreview, setIsResizingPreview] = useState(false);
  
  const explorerStartXRef = useRef(0);
  const explorerStartWidthRef = useRef(260);
  const previewStartXRef = useRef(0);
  const previewStartWidthRef = useRef(50);

  const activeFile = files.find(f => f.id === activeFileId) || files[0];


// Add this effect to initialize from submission prop
useEffect(() => {
  if (submission && submission.files && submission.files.length > 0) {
    console.log('StaffFrontendReview - Initializing from submission:', {
      questionId: submission.questionId,
      filesCount: submission.files.length
    });
    
    setFiles(submission.files.map(file => ({
      ...file,
      lastModified: file.lastModified ? new Date(file.lastModified) : new Date(),
      isDirty: false
    })));
    
    setFolders(submission.folders?.map(folder => ({
      ...folder,
      isOpen: folder.isOpen !== undefined ? folder.isOpen : true,
      children: folder.children || [],
      folderChildren: folder.folderChildren || []
    })) || []);
    
    const htmlFile = submission.files.find(f => f.language === 'html');
    if (htmlFile) {
      setActiveFileId(htmlFile.id);
      setOpenFiles([htmlFile.id]);
    } else if (submission.files.length > 0) {
      setActiveFileId(submission.files[0].id);
      setOpenFiles([submission.files[0].id]);
    }
  } else if (initialFiles && initialFiles.length > 0) {
    console.log('StaffFrontendReview - Initializing from initialFiles:', {
      filesCount: initialFiles.length
    });
    
    setFiles(initialFiles.map(file => ({
      ...file,
      lastModified: file.lastModified ? new Date(file.lastModified) : new Date(),
      isDirty: false
    })));
    
    setFolders(initialFolders?.map(folder => ({
      ...folder,
      isOpen: folder.isOpen !== undefined ? folder.isOpen : true,
      children: folder.children || [],
      folderChildren: folder.folderChildren || []
    })) || []);
    
    const htmlFile = initialFiles.find(f => f.language === 'html');
    if (htmlFile) {
      setActiveFileId(htmlFile.id);
      setOpenFiles([htmlFile.id]);
    } else if (initialFiles.length > 0) {
      setActiveFileId(initialFiles[0].id);
      setOpenFiles([initialFiles[0].id]);
    }
  }
}, [submission, initialFiles, initialFolders]); // This will run when submission or initialFiles changes
  // Handle explorer resize
  const handleExplorerResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizingExplorer(true);
    explorerStartXRef.current = e.clientX;
    explorerStartWidthRef.current = explorerWidth;
  };

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

  // Handle preview resize
  const handlePreviewResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizingPreview(true);
    previewStartXRef.current = e.clientX;
    previewStartWidthRef.current = previewWidth;
  };

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

  // Find linked CSS files
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
  const combineJsForHtmlFile = useCallback((htmlFile: FileType) => {
    let jsContent = '';
    const htmlFolderPath = htmlFile.folderPath;

    const scriptRegex = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
    let match;
    while ((match = scriptRegex.exec(htmlFile.content)) !== null) {
      if (!match[0].includes('src=')) {
        jsContent += match[1] + '\n\n';
      }
    }

    const jsFiles = files.filter(f =>
      f.language === 'javascript' && f.folderPath === htmlFolderPath
    );

    jsFiles.forEach(jsFile => {
      jsContent += jsFile.content + '\n\n';
    });

    return jsContent;
  }, [files]);

  // Generate srcDoc for iframe preview
  const generateSrcDocForFile = useCallback((htmlFile: FileType) => {
    if (!htmlFile || htmlFile.language !== 'html') {
      return createNotFoundPage(htmlFile?.filename || 'File not found');
    }

    const linkedCssFiles = findLinkedCssFiles(htmlFile.content);
    const cssContent = combineCssForHtmlFile(htmlFile, linkedCssFiles);
    const jsContent = combineJsForHtmlFile(htmlFile);

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

  // Compile code function
  const compileCode = useCallback(() => {
    const allFiles = files;
    const activeFileForPreview = allFiles.find(f => f.id === activeFileId);
    const isActiveFileHtml = activeFileForPreview?.language === 'html';

    const previewFile = isActiveFileHtml ? activeFileForPreview :
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
  }, [files, activeFileId, generateSrcDocForFile]);

  // Auto-compile on files change
  useEffect(() => {
    const timeout = setTimeout(compileCode, 500);
    return () => clearTimeout(timeout);
  }, [files, compileCode]);

  // Message handling for navigation
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === 'NAVIGATE_TO_FILE') {
        const { fileName } = event.data;
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
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [files, generateSrcDocForFile]);

  // Get language icon
  const getLanguageIcon = useCallback((language: string) => {
    switch (language) {
      case 'html': return <FileCode className="text-[#e34c26]" size={14} />;
      case 'css': return <Palette className="text-[#264de4]" size={14} />;
      case 'javascript': return <Terminal className="text-[#f0db4f]" size={14} />;
      case 'json': return <FileJson className="text-[#4ec9b0]" size={14} />;
      default: return <FileText className={theme === 'light' ? "text-[#333333]" : "text-[#cccccc]"} size={14} />;
    }
  }, [theme]);

  // Render file tree (read-only)
  const renderFileTree = useCallback(() => {
    const getFilesInFolder = (folderPath: string) => {
      return files.filter(file => file.folderPath === folderPath);
    };

    const getSubfolders = (folderPath: string) => {
      return folders.filter(folder => folder.parentPath === folderPath);
    };

    const renderFolder = (folder: FolderType, depth: number = 0) => {
      const folderFiles = getFilesInFolder(folder.path);
      const subfolders = getSubfolders(folder.path);

      return (
        <div key={folder.id} className="mt-0.5">
          <div
            className={`flex items-center gap-2 px-2 py-1.5 hover:bg-[${colors.hoverBg}] rounded cursor-pointer text-sm`}
            style={{ marginLeft: `${depth * 12}px` }}
            onClick={() => {
              setSelectedFolderPath(folder.path);
              setFolders(prev => prev.map(f =>
                f.id === folder.id ? { ...f, isOpen: !f.isOpen } : f
              ));
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

          {folder.isOpen && (
            <div>
              {subfolders.map(subfolder => renderFolder(subfolder, depth + 1))}
              {folderFiles.map(file => (
                <div
                  key={file.id}
                  className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer text-sm group ${activeFileId === file.id ? `bg-[${colors.selectedBg}]` : `hover:bg-[${colors.hoverBg}]`}`}
                  style={{ marginLeft: `${(depth + 1) * 12}px` }}
                  onClick={() => {
                    setActiveFileId(file.id);
                    if (!openFiles.includes(file.id)) {
                      setOpenFiles(prev => [...prev, file.id]);
                    }
                  }}
                >
                  {getLanguageIcon(file.language)}
                  <span className={`flex-1 truncate ${theme === 'light' ? 'text-[#333333]' : 'text-[#cccccc]'}`}>{file.filename}</span>
                  {file.isEntryPoint && (
                    <Star size={12} className="flex-shrink-0 text-[#dcdcaa]" title="Entry Point" />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      );
    };

    const rootFiles = getFilesInFolder('/');
    const rootFolders = getSubfolders('/');

    // Sort rootFiles to show HTML first
    const sortedRootFiles = [...rootFiles].sort((a, b) => {
      if (a.language === 'html' && b.language !== 'html') return -1;
      if (a.language !== 'html' && b.language === 'html') return 1;
      return 0;
    });

    return (
      <div className="space-y-0.5 p-2">
        {sortedRootFiles.map(file => (
          <div
            key={file.id}
            className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer text-sm group ${activeFileId === file.id ? `bg-[${colors.selectedBg}]` : `hover:bg-[${colors.hoverBg}]`}`}
            onClick={() => {
              setActiveFileId(file.id);
              if (!openFiles.includes(file.id)) {
                setOpenFiles(prev => [...prev, file.id]);
              }
              setSelectedFolderPath('/');
            }}
          >
            {getLanguageIcon(file.language)}
            <span className={`flex-1 truncate ${theme === 'light' ? 'text-[#333333]' : 'text-[#cccccc]'}`}>{file.filename}</span>
            {file.isEntryPoint && (
              <Star size={12} className="flex-shrink-0 text-[#dcdcaa]" title="Entry Point" />
            )}
          </div>
        ))}
        {rootFolders.map(folder => renderFolder(folder, 0))}
      </div>
    );
  }, [files, folders, activeFileId, openFiles, getLanguageIcon, theme, colors, selectedFolderPath]);

  // Loading state
  if (isLoadingSubmission) {
    return (
      <div className="flex flex-col h-screen items-center justify-center" style={{ backgroundColor: colors.background }}>
        <Loader2 className="animate-spin mb-4" size={40} style={{ color: colors.primary }} />
        <p style={{ color: colors.textSecondary }}>Loading student submission...</p>
      </div>
    );
  }

  // Main render
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
          <div className="flex items-center gap-3">
            <div className="text-sm font-medium" style={{ color: colors.text }}>{title || questionTitle || "Frontend Submission"}</div>
            <div className="text-xs px-2 py-0.5 rounded" style={{
              backgroundColor: theme === 'light' ? '#e5e5e5' : '#2d2d2d',
              color: colors.textSecondary
            }}>
              Student Submission • Read Only
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <input
              type="text"
              placeholder="Search files..."
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
          
          <button
            onClick={() => setIsModalOpen(true)}
            className="p-1.5 hover:bg-[#d5d5d5] dark:hover:bg-[#2d2d2d] rounded transition-colors"
            style={{ color: colors.textSecondary }}
            title="Open Full Page View"
          >
            <Maximize2 size={16} /> 
          </button>
          
          <button
            onClick={() => setTheme(theme === 'light' ? 'vs-dark' : 'light')}
            className="p-2 rounded hover:bg-[#d5d5d5] dark:hover:bg-[#2d2d2d] transition-colors"
            style={{ color: colors.textSecondary }}
            title={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} Mode`}
          >
            {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
          </button>

          <button
            onClick={() => setShowPreview(!showPreview)}
            className={`p-2 rounded hover:bg-[#d5d5d5] dark:hover:bg-[#2d2d2d] transition-colors ${!showPreview ? 'bg-[#007acc] hover:bg-[#0062a3] text-white' : ''}`}
            style={{ color: showPreview ? colors.textSecondary : 'white' }}
            title={`${showPreview ? 'Hide' : 'Show'} Preview`}
          >
            {showPreview ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>

          <button
            onClick={() => {
              const newWindow = window.open('', '_blank');
              if (newWindow && activeFile && activeFile.language === 'html') {
                const htmlContent = generateSrcDocForFile(activeFile);
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
            title="Refresh Preview"
          >
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      {/* Main Content */}
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
                        Student Files
                      </div>
                    </div>
                    <div className="text-xs" style={{ color: colors.textSecondary }}>
                      {files.length} files
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto">
                    {renderFileTree()}
                  </div>

                  <div className="px-3 py-1.5 border-t text-xs" style={{
                    borderColor: colors.border,
                    backgroundColor: theme === 'light' ? '#e5e5e5' : '#2d2d2d'
                  }}>
                    <div className="flex items-center justify-between" style={{ color: colors.textSecondary }}>
                      <span>Read Only Mode</span>
                      <span>{folders.length} folders</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
            
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
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenFiles(prev => prev.filter(id => id !== file.id));
                              if (activeFileId === file.id && openFiles.filter(id => id !== file.id).length > 0) {
                                setActiveFileId(openFiles.filter(id => id !== file.id)[0]);
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
                <MonacoEditor
                  language={activeFile.language}
                  theme={theme}
                  value={activeFile.content}
                  options={{
                    fontSize: 14 * (editorZoom / 100),
                    minimap: { enabled: true },
                    wordWrap: 'on',
                    automaticLayout: true,
                    scrollBeyondLastLine: false,
                    tabSize: 2,
                    insertSpaces: true,
                    readOnly: true,
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
                  <span className="text-[#4ec9b0]">● Read Only</span>
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
                  <span className="text-sm font-medium" style={{ color: colors.text }}>Live Preview</span>
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
                        if (newWindow && activeFile && activeFile.language === 'html') {
                          const htmlContent = generateSrcDocForFile(activeFile);
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
                      sandbox="allow-scripts allow-same-origin allow-forms allow-modals"
                      className="w-full h-[calc(100vh-3rem)] border-0"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                ) : (
                  <iframe
                    srcDoc={srcDoc}
                    title="preview"
                    sandbox="allow-scripts allow-same-origin allow-forms allow-modals"
                    className="w-full h-full border-0"
                    referrerPolicy="no-referrer"
                  />
                )}
              </div>

              <div className="px-3 py-1.5 border-t text-xs" style={{
                borderColor: colors.border,
                backgroundColor: theme === 'light' ? '#e5e5e5' : '#2d2d2d'
              }}>
                <div className="flex items-center justify-between" style={{ color: colors.textSecondary }}>
                  <span>Safe Navigation: <span className="text-[#4ec9b0]">Active</span></span>
                  <span>Student Submission • Read Only</span>
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
      
      {/* Full Screen Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="relative bg-white dark:bg-gray-900 w-full h-full flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Student Submission - Full View</h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                <X size={20} className="text-gray-500 dark:text-gray-400" />
              </button>
            </div>
            
            {/* Modal Body - Recreating the main view without outer layout */}
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Modal Top Bar */}
              <div className="flex items-center justify-between px-3 py-2 border-b" style={{
                backgroundColor: colors.activityBar,
                borderColor: colors.border
              }}>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-3">
                    <div className="text-sm font-medium" style={{ color: colors.text }}>{title || questionTitle || "Frontend Submission"}</div>
                    <div className="text-xs px-2 py-0.5 rounded" style={{
                      backgroundColor: theme === 'light' ? '#e5e5e5' : '#2d2d2d',
                      color: colors.textSecondary
                    }}>
                      Student Submission • Read Only
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Search files..."
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

                  <button
                    onClick={() => setTheme(theme === 'light' ? 'vs-dark' : 'light')}
                    className="p-2 rounded hover:bg-[#d5d5d5] dark:hover:bg-[#2d2d2d] transition-colors"
                    style={{ color: colors.textSecondary }}
                    title={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} Mode`}
                  >
                    {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
                  </button>

                  <button
                    onClick={() => setShowPreview(!showPreview)}
                    className={`p-2 rounded hover:bg-[#d5d5d5] dark:hover:bg-[#2d2d2d] transition-colors ${!showPreview ? 'bg-[#007acc] hover:bg-[#0062a3] text-white' : ''}`}
                    style={{ color: showPreview ? colors.textSecondary : 'white' }}
                    title={`${showPreview ? 'Hide' : 'Show'} Preview`}
                  >
                    {showPreview ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>

                  <button
                    onClick={() => {
                      const newWindow = window.open('', '_blank');
                      if (newWindow && activeFile && activeFile.language === 'html') {
                        const htmlContent = generateSrcDocForFile(activeFile);
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
                    title="Refresh Preview"
                  >
                    <RefreshCw size={14} /> Refresh
                  </button>
                </div>
              </div>

              {/* Modal Main Content */}
              <div className="flex-1 flex overflow-hidden">
                {/* Explorer Sidebar */}
                <div className="w-64 flex-shrink-0 border-r overflow-y-auto" style={{
                  backgroundColor: colors.sidebar,
                  borderColor: colors.border
                }}>
                  <div className="px-3 py-2 border-b flex items-center justify-between" style={{ borderColor: colors.border }}>
                    <div className="text-xs font-semibold uppercase tracking-wider" style={{ color: colors.textSecondary }}>
                      Student Files
                    </div>
                    <div className="text-xs" style={{ color: colors.textSecondary }}>
                      {files.length} files
                    </div>
                  </div>
                  <div className="p-2">
                    {renderFileTree()}
                  </div>
                </div>

                {/* Editor and Preview Split */}
                <div className="flex-1 flex overflow-hidden">
                  {/* Editor */}
                  <div className="flex-1 flex flex-col overflow-hidden border-r" style={{ borderColor: colors.border }}>
                    <div className="px-3 py-2 border-b bg-gray-50 dark:bg-gray-800 flex items-center justify-between" style={{ borderColor: colors.border }}>
                      <div className="flex items-center gap-2">
                        {getLanguageIcon(activeFile.language)}
                        <span className="text-sm font-medium" style={{ color: colors.text }}>{activeFile.filename}</span>
                        {activeFile.isEntryPoint && <Star size={14} className="text-yellow-500" />}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setEditorZoom(prev => Math.min(prev + 10, 200))}
                          className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
                        >
                          <ZoomIn size={14} />
                        </button>
                        <button
                          onClick={() => setEditorZoom(prev => Math.max(prev - 10, 50))}
                          className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
                        >
                          <ZoomOut size={14} />
                        </button>
                        <span className="text-xs text-gray-500">{editorZoom}%</span>
                      </div>
                    </div>
                    <div className="flex-1">
                      <MonacoEditor
                        language={activeFile.language}
                        theme={theme}
                        value={activeFile.content}
                        options={{
                          fontSize: 14 * (editorZoom / 100),
                          minimap: { enabled: false },
                          wordWrap: 'on',
                          automaticLayout: true,
                          readOnly: true,
                          scrollBeyondLastLine: false,
                          padding: { top: 10 }
                        }}
                      />
                    </div>
                  </div>

                  {/* Preview */}
                  {showPreview && (
                    <div className="flex-1 flex flex-col overflow-hidden">
                      <div className="px-3 py-2 border-b flex items-center justify-between" style={{ borderColor: colors.border, backgroundColor: colors.editorGroup }}>
                        <div className="flex items-center gap-2">
                          <MonitorPlay size={14} style={{ color: colors.textSecondary }} />
                          <span className="text-sm font-medium" style={{ color: colors.text }}>Live Preview</span>
                          <span className="text-xs px-2 py-0.5 rounded bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300">
                            {currentPreviewFile || 'No file'}
                          </span>
                        </div>
                        <button
                          onClick={compileCode}
                          className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
                          title="Refresh Preview"
                        >
                          <RefreshCw size={14} style={{ color: colors.textSecondary }} />
                        </button>
                      </div>
                      <div className="flex-1">
                        <iframe
                          srcDoc={srcDoc}
                          title="modal-preview"
                          sandbox="allow-scripts allow-same-origin allow-forms allow-modals"
                          className="w-full h-full border-0"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Helper components
const Moon = ({ size, className }: { size?: number; className?: string }) => (
  <svg className={className} width={size || 24} height={size || 24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </svg>
);

const Sun = ({ size, className }: { size?: number; className?: string }) => (
  <svg className={className} width={size || 24} height={size || 24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="5" />
    <line x1="12" y1="1" x2="12" y2="3" />
    <line x1="12" y1="21" x2="12" y2="23" />
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
    <line x1="1" y1="12" x2="3" y2="12" />
    <line x1="21" y1="12" x2="23" y2="12" />
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
  </svg>
);

export default StaffFrontendReview;