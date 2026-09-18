"use client"

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react"
import dynamic from 'next/dynamic'
import {
  Play, Settings, Maximize2, Minimize2, ChevronLeft,
  Type, Palette, Terminal, Eye, X,
  LayoutTemplate, FileCode
} from "lucide-react"

// Dynamically import Monaco Editor
const MonacoEditor = dynamic(() => import('@monaco-editor/react'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-gray-50 text-gray-400 text-xs">
      Loading Editor...
    </div>
  )
})

interface AdminFrontendCompilerProps {
  onBack?: () => void
  title?: string
  codeAnswer?: string // Expecting JSON string: {"html":"...","css":"...","js":"..."}
  readOnly?: boolean
  theme?: string
  selectedLanguages?: string[]
}

export default function AdminFrontendCompiler({
  onBack,
  title = "Frontend Review",
  codeAnswer = "",
  readOnly = false,
  theme: initialTheme = "light",
  selectedLanguages = ["html", "css", "javascript"]
}: AdminFrontendCompilerProps) {

  // --- 1. CONFIG & NORMALIZATION (FIXED) ---
  const normalizedLanguages = useMemo(() => {
    return selectedLanguages.map(l => {
      const lower = l.toLowerCase().trim();
      // FIX: Explicitly map 'js' to 'javascript' so the tab system recognizes it
      if (lower === 'js') return 'javascript'; 
      return lower;
    });
  }, [selectedLanguages]);

  const enableBootstrap = normalizedLanguages.includes('bootstrap');

  // --- STATE ---
  const [activeTab, setActiveTab] = useState<'html' | 'css' | 'javascript'>('html');
  const [htmlCode, setHtmlCode] = useState("");
  const [cssCode, setCssCode] = useState("");
  const [jsCode, setJsCode] = useState("");
  const [output, setOutput] = useState("");

  // UI Preferences
  const [theme, setTheme] = useState(initialTheme);
  const [fontSize, setFontSize] = useState(14);
  const [showSettings, setShowSettings] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const editorRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // --- 2. TABS LOGIC ---
  const availableTabs = useMemo(() => {
    const allTabs = [
      { key: 'html' as const, label: 'HTML', icon: <Type className="w-3 h-3" />, color: 'text-orange-500' },
      { key: 'css' as const, label: 'CSS', icon: <Palette className="w-3 h-3" />, color: 'text-blue-500' },
      { key: 'javascript' as const, label: 'JS', icon: <Terminal className="w-3 h-3" />, color: 'text-yellow-500' }
    ];

    // Filter tabs based on normalizedLanguages
    return allTabs.filter(tab =>
      normalizedLanguages.includes(tab.key) ||
      // Fallback for things like "html5" matching "html"
      normalizedLanguages.some(lang => lang.includes(tab.key))
    );
  }, [normalizedLanguages]);

  // Set initial active tab safely
  useEffect(() => {
    if (availableTabs.length > 0) {
        // If current active tab is NOT in available tabs, switch to the first available one
        const isCurrentTabAvailable = availableTabs.some(tab => tab.key === activeTab);
        if (!isCurrentTabAvailable) {
            setActiveTab(availableTabs[0].key);
        }
    }
  }, [availableTabs, activeTab]);

  // --- PARSE INPUT CODE ---
  useEffect(() => {
    if (codeAnswer) {
      try {
        // Try parsing JSON format
        const parsed = JSON.parse(codeAnswer);
        setHtmlCode(parsed.html || "");
        setCssCode(parsed.css || "");
        setJsCode(parsed.js || "");
      } catch (e) {
        // Fallback for plain text or errors (assume HTML)
        console.warn("Failed to parse frontend code, using raw:", e);
        setHtmlCode(codeAnswer);
      }
    }
  }, [codeAnswer]);

  // --- COMPILE ---
  const compileCode = useCallback(() => {
    // Bootstrap 5.3 CDN Links
    const bootstrapCss = enableBootstrap 
      ? '<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">' 
      : '';
      
    const bootstrapJs = enableBootstrap 
      ? '<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script>' 
      : '';

    const fullHtml = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          ${bootstrapCss}
          <style>
            /* Basic Reset */
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; padding: 1rem; }
            ${cssCode}
          </style>
      </head>
      <body>
          ${htmlCode}
          
          ${bootstrapJs}
          <script>
             try {
                ${jsCode}
             } catch (e) {
                console.error(e);
             }
          </script>
      </body>
      </html>`;
      
    setOutput(fullHtml);
  }, [htmlCode, cssCode, jsCode, enableBootstrap]);

  // Auto-compile on load and changes (debounce)
  useEffect(() => {
    const timeout = setTimeout(compileCode, 600);
    return () => clearTimeout(timeout);
  }, [htmlCode, cssCode, jsCode, compileCode]);

  const toggleFullscreen = async () => {
    if (!editorRef.current) return;
    try {
      if (!isFullscreen) await editorRef.current.requestFullscreen();
      else await document.exitFullscreen();
    } catch (error) { setIsFullscreen(!isFullscreen); }
  };

  const getCurrentCode = () => {
    switch (activeTab) {
      case 'html': return htmlCode;
      case 'css': return cssCode;
      case 'javascript': return jsCode;
      default: return "";
    }
  };

  const handleCodeChange = (value: string | undefined) => {
    if (readOnly) return;
    const val = value || "";
    switch (activeTab) {
      case 'html': setHtmlCode(val); break;
      case 'css': setCssCode(val); break;
      case 'javascript': setJsCode(val); break;
    }
  };

  const editorOpts = {
    fontSize,
    wordWrap: 'on' as const,
    minimap: { enabled: false },
    automaticLayout: true,
    padding: { top: 16 } as const,
    scrollBeyondLastLine: false,
    fontFamily: 'JetBrains Mono, Menlo, Monaco, Consolas, monospace',
    fontLigatures: true,
    readOnly: readOnly,
    lineHeight: 1.5
  };

  // Theme Variables
  const bgMain = theme === 'dark' ? 'bg-[#1e1e1e]' : 'bg-slate-50';
  const bgPanel = theme === 'dark' ? 'bg-[#252526]' : 'bg-white';
  const textMain = theme === 'dark' ? 'text-slate-200' : 'text-slate-800';
  const border = theme === 'dark' ? 'border-slate-700' : 'border-slate-200';
  const headerBg = theme === 'dark' ? 'bg-[#2d2d2d]' : 'bg-white';

  // Tab Styling
  const getTabClass = (tabName: string, colorClass: string) => {
    const isActive = activeTab === tabName;
    if (theme === 'dark') {
      return isActive
        ? `bg-[#1e1e1e] ${colorClass} border-b-2 border-blue-500`
        : 'text-slate-400 hover:text-slate-200 hover:bg-[#333]';
    }
    return isActive
      ? `bg-white ${colorClass} border-b-2 border-blue-500`
      : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100';
  };

  // --- RENDER EMPTY STATE ---
  if (availableTabs.length === 0) {
    return (
      <div className={`${bgMain} ${textMain} w-full h-full flex flex-col items-center justify-center p-4`}>
        <div className="text-center">
          <FileCode size={48} className="text-gray-400 mb-4 mx-auto" />
          <h3 className="text-lg font-semibold text-gray-600 mb-2">No Languages Available</h3>
          <p className="text-sm text-gray-500">
            No frontend languages are selected for this exercise.
          </p>
        </div>
      </div>
    );
  }

  // --- MAIN RENDER ---
  return (
    <div ref={editorRef} className={`${bgMain} ${textMain} w-full h-full flex flex-col transition-colors duration-300 font-sans overflow-hidden ${isFullscreen ? "fixed inset-0 z-[100]" : "relative"}`}>

      {/* HEADER */}
      <div className={`flex items-center justify-between px-4 h-12 border-b shrink-0 ${headerBg} ${border} shadow-sm z-20`}>
        <div className="flex items-center gap-4">
          {onBack && (
            <button onClick={onBack} className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-all shadow-sm active:scale-95">
              <ChevronLeft className="w-3.5 h-3.5" /> Back
            </button>
          )}
          <div className="flex items-center gap-2">
            <div className={`p-1.5 rounded-md ${theme === 'dark' ? 'bg-blue-900/30 text-blue-400' : 'bg-blue-50 text-blue-600'}`}>
              <LayoutTemplate className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xs font-bold leading-none tracking-tight">{title}</h1>
                {enableBootstrap && (
                  <span className="text-[9px] bg-purple-100 text-purple-700 px-1.5 rounded font-bold border border-purple-200">BS 5.3</span>
                )}
              </div>
              <span className="text-[10px] opacity-60 font-medium">Frontend Visualizer</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!readOnly && (
            <button onClick={compileCode} className="h-7 px-3 bg-slate-900 hover:bg-slate-800 text-white text-[10px] font-semibold rounded-md shadow flex items-center gap-2 transition-all active:scale-95">
              <Play className="w-3 h-3 fill-current" /> Run
            </button>
          )}

          <div className="h-4 w-px bg-slate-300 mx-1" />

          <div className="relative">
            <button onClick={() => setShowSettings(!showSettings)} className="p-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors">
              <Settings className="w-3.5 h-3.5" />
            </button>
            {showSettings && (
              <div className="absolute top-8 right-0 w-56 bg-white border border-slate-200 rounded-lg shadow-xl p-3 z-50">
                <div className="flex justify-between items-center mb-3 pb-2 border-b border-slate-100">
                  <span className="text-[10px] font-bold text-slate-900 uppercase">Settings</span>
                  <X className="w-3 h-3 text-slate-400 cursor-pointer" onClick={() => setShowSettings(false)} />
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="text-[10px] font-semibold text-slate-500 block mb-1.5">Theme</label>
                    <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-md">
                      <button onClick={() => setTheme('light')} className={`text-[10px] py-1 rounded-sm ${theme === 'light' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500'}`}>Light</button>
                      <button onClick={() => setTheme('dark')} className={`text-[10px] py-1 rounded-sm ${theme === 'dark' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500'}`}>Dark</button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
          <button onClick={toggleFullscreen} className="p-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors">
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* MAIN CONTENT SPLIT (TOP/BOTTOM) */}
      <div className={`flex-1 flex flex-col min-w-0 h-full ${theme === 'dark' ? 'bg-[#1e1e1e]' : 'bg-slate-50'}`}>

        {/* TOP HALF: EDITOR (60%) */}
        <div className={`h-[60%] flex flex-col ${bgPanel} border-b ${border} relative shadow-sm`}>
          {/* Editor Tabs */}
          <div className={`flex items-center px-2 pt-2 border-b ${border} gap-1 ${theme === 'dark' ? 'bg-[#252526]' : 'bg-slate-50'}`}>
            {availableTabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-4 py-2 text-[11px] font-semibold rounded-t-lg transition-all ${getTabClass(tab.key, tab.color)}`}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>
          {/* Editor Container */}
          <div className="flex-1 relative">
            <MonacoEditor
              language={activeTab}
              value={getCurrentCode()}
              onChange={handleCodeChange}
              theme={theme === 'dark' ? 'vs-dark' : 'light'}
              options={editorOpts}
            />
          </div>
        </div>

        {/* BOTTOM HALF: PREVIEW (40%) */}
        <div className="flex-1 overflow-hidden relative bg-white">
          <div className="absolute top-0 right-0 z-10 p-2 pointer-events-none">
            <div className="bg-white/90 backdrop-blur-sm border border-slate-200 rounded-md text-[9px] font-bold text-slate-500 px-2 py-1 flex items-center gap-1.5 shadow-sm">
              <Eye className="w-3 h-3 text-emerald-500" />
              <span>PREVIEW</span>
            </div>
          </div>
          <iframe
            ref={iframeRef}
            srcDoc={output}
            title="Preview"
            className="w-full h-full border-0 block"
            sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-modals"
          />
        </div>
      </div>
    </div>
  )
}