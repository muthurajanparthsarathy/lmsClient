'use client';
import { getToken } from "@/lib/session";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import {
  Code,
  CheckCircle,
  Loader2,
  Terminal,
  Trash2,
  Play,
  RotateCcw,
  Maximize2,
  Minimize2,
  X as XIcon,
  AlertCircle,
  FileText,
  HelpCircle,
  Award,
  Clock,
  ArrowLeft,
  GraduationCap,
  Flag,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { toast } from 'react-toastify';
import Script from 'next/script';

const MonacoEditor = dynamic(
  () => import('@monaco-editor/react'),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-orange-600 animate-spin mx-auto mb-2" />
          <p className="text-xs text-gray-500">Loading Editor...</p>
        </div>
      </div>
    )
  }
);

// Piston API configuration
const PISTON_API_URL = process.env.NEXT_PUBLIC_PISTON_URL || "https://emkc.org/api/v2/piston/execute";

// Types
interface LogEntry {
  id: string;
  type: 'stdout' | 'stderr' | 'system' | 'error' | 'warning' | 'success' | 'info';
  content: string;
  timestamp: number;
}

interface ProgrammingQuestionProps {
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
  onBack?: () => void;
  theme?: 'light' | 'dark';
  registerSubmit?: (fn: () => void | Promise<void>) => void;
  // Q-meta props injected by combined/page.tsx so we can render Q# in the
  // title and the Flag button in the problem-description header — replacing
  // the wasteful 52px Q-meta strip above.
  questionNumber?: number;
  totalQuestions?: number;
  isFlagged?: boolean;
  onFlagToggle?: () => void;
  // Only show the per-question marks badge when the exercise is graded
  isGraded?: boolean;
}

// Helper to get Piston language config
const getPistonLanguage = (language: string): { language: string; version: string } => {
  const languageMap: { [key: string]: { language: string; version: string } } = {
    javascript: { language: "javascript", version: "18.15.0" },
    python: { language: "python", version: "3.10.0" },
    java: { language: "java", version: "15.0.2" },
    cpp: { language: "cpp", version: "10.2.0" },
    c: { language: "c", version: "10.2.0" },
    csharp: { language: "csharp", version: "6.12.0" },
    typescript: { language: "typescript", version: "5.0.3" }
  };
  return languageMap[language.toLowerCase()] || { language: "python", version: "3.10.0" };
};

// Interactive Terminal Component (same as CodeEditor)
const InteractiveTerminal = ({
  isOpen,
  onClose,
  logs,
  isRunning,
  language,
  onClear,
  theme = "light"
}: {
  isOpen: boolean;
  onClose: () => void;
  logs: LogEntry[];
  isRunning: boolean;
  language: string;
  onClear: () => void;
  theme?: "light" | "dark";
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  if (!isOpen) return null;

  const themeClasses = theme === 'dark'
    ? 'bg-slate-950 text-slate-300 border-slate-800'
    : 'bg-white text-gray-800 border-gray-300';

  return (
    <div className={`fixed z-[100] flex flex-col shadow-2xl rounded-lg overflow-hidden border transition-all duration-300 ease-in-out ${themeClasses}`}
      style={{ bottom: '20px', right: '20px', width: '600px', height: '400px' }}>
      <div className={`flex items-center justify-between px-4 py-2 border-b ${theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-gray-100 border-gray-300'}`}>
        <div className="flex items-center gap-2.5">
          <Terminal className={`w-4 h-4 ${theme === 'dark' ? 'text-emerald-500' : 'text-green-600'}`} />
          <div>
            <span className={`text-xs font-bold ${theme === 'dark' ? 'text-slate-200' : 'text-gray-800'}`}>Console Output</span>
            <span className={`text-[10px] ${theme === 'dark' ? 'text-slate-500' : 'text-gray-600'} font-mono uppercase ml-2`}>
              {language || 'unknown'} • {isRunning ? 'Running...' : 'Idle'}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onClear}
            className={`h-6 w-6 flex items-center justify-center rounded transition-colors ${theme === 'dark' ? 'text-slate-500 hover:text-slate-300 hover:bg-slate-800' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200'}`}
            title="Clear"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onClose}
            className={`h-6 w-6 flex items-center justify-center rounded transition-colors ${theme === 'dark' ? 'text-slate-500 hover:text-red-400 hover:bg-slate-800' : 'text-gray-500 hover:text-red-600 hover:bg-gray-200'}`}
            title="Close"
          >
            <XIcon className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div
        ref={scrollRef}
        className={`flex-1 overflow-y-auto p-4 font-mono text-xs space-y-1 scrollbar-thin ${theme === 'dark' ? 'bg-slate-950 text-slate-300 scrollbar-thumb-slate-700' : 'bg-white text-gray-800 scrollbar-thumb-gray-300'}`}
      >
        {logs.length === 0 && !isRunning && (
          <div className={`italic ${theme === 'dark' ? 'text-slate-600' : 'text-gray-500'}`}>
            Ready to execute. Click 'Run' to start.
          </div>
        )}

        {logs.map((log) => (
          <div key={log.id} className="break-all whitespace-pre-wrap leading-relaxed">
            {log.type === 'stdout' && <span className={theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}>{log.content}</span>}
            {log.type === 'stderr' && <span className="text-rose-600 dark:text-rose-400">{log.content}</span>}
            {log.type === 'system' && <span className={`italic select-none ${theme === 'dark' ? 'text-emerald-400' : 'text-green-600'}`}>➜ {log.content}</span>}
            {log.type === 'error' && <span className="text-red-600 dark:text-red-400">{log.content}</span>}
            {log.type === 'warning' && <span className="text-yellow-600 dark:text-yellow-400">{log.content}</span>}
            {log.type === 'success' && <span className="text-green-600 dark:text-green-400">{log.content}</span>}
            {log.type === 'info' && <span className="text-blue-600 dark:text-blue-400">{log.content}</span>}
          </div>
        ))}

        {isRunning && (
          <div className="flex items-center gap-2 mt-2">
            <Loader2 className="w-3 h-3 text-emerald-500 animate-spin" />
            <span className={theme === 'dark' ? 'text-slate-500' : 'text-gray-500'}>Executing...</span>
          </div>
        )}
      </div>
    </div>
  );
};

// Main Component - Exactly like CodeEditor but for Programming Questions
const ProgrammingQuestion: React.FC<ProgrammingQuestionProps> = ({
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
  onBack,
  theme = 'light',
  registerSubmit,
  questionNumber,
  totalQuestions,
  isFlagged,
  onFlagToggle,
  isGraded = true,
}) => {
  // State
  const [code, setCode] = useState("");
  const [selectedLanguage, setSelectedLanguage] = useState("python");
  // Tracks which question we've already initialised. The parent
  // (combined/page.tsx) rebuilds `question` every second when the timer ticks,
  // so without this guard the init effect below would wipe the student's
  // typing on every tick.
  const initializedQuestionIdRef = useRef<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showTerminal, setShowTerminal] = useState(false);
  const [terminalLogs, setTerminalLogs] = useState<LogEntry[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pyodideReady, setPyodideReady] = useState(false);
  const pyodideRef = useRef<any>(null);

  // Refs
  const editorInstanceRef = useRef<any>(null);
  const inputResolverRef = useRef<((value: string) => void) | null>(null);
  const [isWaitingForInput, setIsWaitingForInput] = useState(false);

  // Available languages
  const [availableLanguages, setAvailableLanguages] = useState<string[]>(["python", "javascript", "java", "cpp", "c", "csharp"]);

  // Problem-description sidebar — resizable + collapsible (matches the
  // pattern used by combined/frontend.tsx). When collapsed the sidebar
  // shrinks to a 48px rail; the right-edge handle still grabs and dragging
  // it open expands the panel.
  const [showQuestionDetails, setShowQuestionDetails] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(400);
  const [isResizingQuestionSidebar, setIsResizingQuestionSidebar] = useState(false);
  const qSidebarResizeRef = useRef({ startX: 0, startWidth: 400 });

  const startQuestionSidebarResize = (e: React.MouseEvent) => {
    e.preventDefault();
    const currentWidth = showQuestionDetails ? sidebarWidth : 48;
    if (!showQuestionDetails) setShowQuestionDetails(true);
    qSidebarResizeRef.current = { startX: e.clientX, startWidth: currentWidth };
    setIsResizingQuestionSidebar(true);
  };

  useEffect(() => {
    if (!isResizingQuestionSidebar) return;
    const onMove = (e: MouseEvent) => {
      const delta = e.clientX - qSidebarResizeRef.current.startX;
      const next = Math.min(720, Math.max(220, qSidebarResizeRef.current.startWidth + delta));
      setSidebarWidth(next);
    };
    const onUp = () => setIsResizingQuestionSidebar(false);
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
  }, [isResizingQuestionSidebar]);

  // Pyodide initialization
  const initPyodide = async () => {
    if (!pyodideReady && (window as any).loadPyodide) {
      try {
        const pyodide = await (window as any).loadPyodide({
          indexURL: "https://cdn.jsdelivr.net/pyodide/v0.25.0/full/"
        });
        pyodideRef.current = pyodide;
        setPyodideReady(true);

        // Setup async input for Python
        (window as any).getReactInput = () => new Promise((resolve) => {
          setIsWaitingForInput(true);
          inputResolverRef.current = resolve;
        });
      } catch (e) {
        console.error("Pyodide Load Error", e);
      }
    }
  };

  // Kick Pyodide off as soon as the component mounts (in case the <Script> tag
  // already loaded pyodide.js but our onLoad missed the event — e.g. nav back
  // to this page). Also retries every 500 ms for up to 10 seconds in case
  // loadPyodide isn't on window yet. Cancels cleanly on unmount.
  useEffect(() => {
    let cancelled = false;
    let tries = 0;
    const tick = () => {
      if (cancelled || pyodideReady || pyodideRef.current) return;
      if ((window as any).loadPyodide) {
        initPyodide();
        return;
      }
      tries++;
      if (tries < 20) setTimeout(tick, 500);
    };
    tick();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Per-language filename helper (mirrors the in-browser run path's mapping).
  // Used by both the submit payload (so files are stored with the right name)
  // and the restore path (so we can pick out the saved file by extension).
  const filenameForLanguage = useCallback((lang: string, codeStr: string = ''): string => {
    const l = lang.toLowerCase();
    if (l === 'java') {
      const match = codeStr.match(/public\s+class\s+(\w+)/);
      return match ? `${match[1]}.java` : 'Main.java';
    }
    const extMap: Record<string, string> = {
      python: 'main.py', javascript: 'main.js', typescript: 'main.ts',
      cpp: 'main.cpp', c: 'main.c', csharp: 'main.cs',
    };
    return extMap[l] || `main.${l}`;
  }, []);

  // Initialize per-question state.
  //
  // Storage model (matches multi-file-code-editor.tsx):
  //   • On Submit Question we POST the editor content as a FILES payload to
  //     /courses/answers/submit-multiple-files (same endpoint code-server uses).
  //   • On question switch we GET /courses/answers/previous-submission for
  //     THAT specific question. If saved files exist we restore the editor
  //     from the first file's content; otherwise we start fresh (empty).
  //
  // Navigating Next/Prev therefore behaves like VS Code workspaces per question:
  //   • Next to an unanswered question → empty editor
  //   • Prev (or Next) back to a question you already submitted → restored
  //
  // Guarded by `initializedQuestionIdRef` so the parent's 1-second timer ticks
  // (which rebuild the question object) don't wipe the student's typing.
  useEffect(() => {
    if (!question) return;
    const qid = question._id || null;
    if (qid && initializedQuestionIdRef.current === qid) return;
    initializedQuestionIdRef.current = qid;

    // Reset editor first — Code Setup's starterCode (or the legacy
    // solutions.startedCode) shows immediately while the restore fetch runs;
    // a found previous submission overrides it below.
    setCode(question.starterCode || question.solutions?.startedCode || question.solutions?.staetedCode || '');

    // Set available languages
    if (question.allowedLanguages && question.allowedLanguages.length > 0) {
      setAvailableLanguages(question.allowedLanguages);
    } else if (question.solutions?.language) {
      setAvailableLanguages([question.solutions.language.toLowerCase()]);
    }

    // Set default language from question (the restore step may override it)
    if (question.solutions?.language) {
      setSelectedLanguage(question.solutions.language.toLowerCase());
    }

    // Try to restore the student's previously saved files for THIS question.
    // 404 / empty data → silent (fresh editor); other errors → log only.
    let cancelled = false;
    (async () => {
      if (!qid || !courseId || !exerciseId || !category) return;
      try {
        const token = getToken() || localStorage.getItem('token') || '';
        if (!token) return;
        const res = await fetch(
          `http://localhost:5533/courses/answers/previous-submission?courseId=${courseId}&exerciseId=${exerciseId}&questionId=${qid}&category=${category}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (!res.ok) return; // 404 — never submitted, keep blank
        const data = await res.json();
        if (!data?.success || !data?.data) return;
        const saved = data.data;

        // Prefer saved language; otherwise infer from the entry-point file
        const savedLang: string | undefined = saved.selectedProgrammingLanguage;
        const filesArr: any[] = Array.isArray(saved.files) ? saved.files : [];

        if (filesArr.length > 0) {
          const entry = filesArr.find(f => f?.isEntryPoint) || filesArr[0];
          const restoredCode = entry?.content ?? '';
          if (cancelled) return;
          setCode(restoredCode);
          if (editorInstanceRef.current) editorInstanceRef.current.setValue(restoredCode);
          if (savedLang) setSelectedLanguage(savedLang.toLowerCase());
          return;
        }
        // Older submissions only stored a flat `code` string — restore that too
        if (typeof saved.code === 'string' && saved.code.length > 0) {
          if (cancelled) return;
          setCode(saved.code);
          if (editorInstanceRef.current) editorInstanceRef.current.setValue(saved.code);
          if (savedLang) setSelectedLanguage(savedLang.toLowerCase());
        }
      } catch (err) {
        // Network/parse errors are non-fatal — keep the editor empty
        console.warn('Previous submission restore failed (silent):', err);
      }
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question, courseId, exerciseId, category]);

  // Get initial code template
  const getInitialCode = (lang: string): string => {
    const templates: { [key: string]: string } = {
      python: `# Write your solution here
def solution():
    # Your code here
    pass

# Test your solution
if __name__ == "__main__":
    result = solution()
    print(result)`,
      javascript: `// Write your solution here
function solution() {
    // Your code here
}

// Test your solution
console.log(solution());`,
      java: `// Write your solution here
public class Main {
    public static void main(String[] args) {
        // Your code here
    }
}`,
      cpp: `#include <iostream>
using namespace std;

int main() {
    // Your code here
    return 0;
}`,
      c: `#include <stdio.h>

int main() {
    // Your code here
    return 0;
}`,
      csharp: `using System;

class Program {
    static void Main() {
        // Your code here
    }
}`,
      typescript: `// Write your solution here
function solution(): void {
    // Your code here
}

solution();`
    };
    return templates[lang] || templates.python;
  };

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

  // Execute code - exactly like CodeEditor
  const executeCode = async (input: string = ""): Promise<{ output: string; error?: string }> => {
    // Always run the LATEST text in the editor — `code` state can lag a tick
    // behind keystrokes, so pulling straight from the Monaco instance prevents
    // "I typed `print('hi')` and pressed Run but got no output" surprises.
    const currentCode = editorInstanceRef.current ? editorInstanceRef.current.getValue() : code;

    try {
      // Use Pyodide for Python (only when it has finished loading in-browser)
      if (selectedLanguage.toLowerCase() === 'python' && pyodideReady && pyodideRef.current) {
        try {
          pyodideRef.current.setStdout({
            batched: (msg: string) => addTerminalLog('stdout', msg)
          });
          pyodideRef.current.setStderr({
            batched: (msg: string) => addTerminalLog('stderr', msg)
          });

          await pyodideRef.current.runPythonAsync(currentCode);
          return { output: "" };
        } catch (err: any) {
          addTerminalLog('stderr', err.message || String(err));
          return { output: "", error: err.message };
        }
      }

      // Python without Pyodide ready, or any other language → Piston API
      const pistonLang = getPistonLanguage(selectedLanguage);

      const getFileName = (lang: string, codeStr: string): string => {
        if (lang === 'java') {
          const match = codeStr.match(/public\s+class\s+(\w+)/);
          return match ? `${match[1]}.java` : 'Main.java';
        }
        const extMap: Record<string, string> = {
          python: 'main.py', javascript: 'main.js', typescript: 'main.ts',
          cpp: 'main.cpp', c: 'main.c', csharp: 'main.cs'
        };
        return extMap[lang] || 'main';
      };

      const requestBody = {
        language: pistonLang.language,
        version: pistonLang.version,
        files: [{ name: getFileName(pistonLang.language, currentCode), content: currentCode }],
        stdin: input || "",
        args: [],
        compile_timeout: 10000,
        run_timeout: 5000
      };

      const response = await fetch(PISTON_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      const data = await response.json();

      if (data.run) {
        if (data.run.output) addTerminalLog('stdout', data.run.output.trim());
        if (data.run.stderr) addTerminalLog('stderr', data.run.stderr);
        return { output: data.run.output?.trim() || "", error: data.run.stderr };
      }
      return { output: "", error: "Execution failed" };
    } catch (error) {
      console.error("Execution error:", error);
      addTerminalLog('error', `Execution error: ${error}`);
      return { output: "", error: `Execution error: ${error}` };
    }
  };

  // Run code - just execute what user typed
  const runCode = async () => {
    setIsRunning(true);
    setShowTerminal(true);
    clearTerminal();

    try {
      addTerminalLog('system', `🚀 Running ${selectedLanguage} code...`);
      // No noisy "which runtime am I using" log — students don't care, they
      // just want their output. If Pyodide is ready it runs in-browser; if not
      // we fall through to the Piston remote runner. Either way, the
      // print() output ends up in this console.
      await executeCode();
      // (No "Execution completed" log — the output itself is the confirmation.)
    } catch (error) {
      addTerminalLog('error', `Error: ${error}`);
    } finally {
      setIsRunning(false);
    }
  };

  // Submit code — stores as a STRUCTURED FILES payload (not a flat string),
  // so the backend can round-trip exactly what the student wrote when they
  // navigate back to this question. Mirrors multi-file-code-editor.tsx.
  const submitCode = async () => {
    setIsSubmitting(true);
    clearTerminal();
    // Note: do NOT auto-open the console on submit — only Run opens it.

    try {
      const currentCode = editorInstanceRef.current ? editorInstanceRef.current.getValue() : code;
      const token = getToken() || localStorage.getItem('token') || '';

      addTerminalLog('system', '📤 Submitting solution...');

      // Build a single-file workspace payload from the editor content.
      // The filename is derived from the selected language so the backend
      // stores it under a predictable name (e.g. main.py / Main.java / main.cpp).
      const filename = filenameForLanguage(selectedLanguage, currentCode);
      const filePath = `/${filename}`;
      const fileEntry = {
        id: `file-${Date.now()}`,
        filename,
        content: currentCode,
        language: selectedLanguage,
        path: filePath,
        folderPath: '/',
        isEntryPoint: true,
        lastModified: new Date(),
      };

      const payload = {
        courseId,
        exerciseId,
        questionId: question._id,
        questionTitle: question?.title || `Question ${(questionNumber ?? 1)}`,
        exerciseName: (question as any)?.exerciseName,
        category,
        subcategory,
        selectedProgrammingLanguage: selectedLanguage,
        nodeId,
        nodeName,
        nodeType,
        files: [fileEntry],
        folders: [],
        status: 'submitted',
        score: 0, // server scores; client never sets this
        isTestSubmission: false, // per-question save — never flips the exercise
      };

      const response = await fetch('http://localhost:5533/courses/answers/submit-multiple-files', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => ({}));

      if (response.ok && (data?.success ?? true)) {
        addTerminalLog('success', '🎉 Solution submitted successfully!');
        toast.success('Solution submitted!');
        onComplete();

        if (!isLastQuestion) {
          setTimeout(() => onNext(), 1500);
        }
      } else {
        throw new Error(data?.message || 'Submission failed');
      }
    } catch (error: any) {
      addTerminalLog('error', `❌ ${error.message}`);
      toast.error('Submission failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Expose submit to parent (combined page bottom-bar "Submit Question")
  useEffect(() => {
    registerSubmit?.(submitCode);
  });

  // Editor functions
  const handleEditorChange = (value: string | undefined) => {
    setCode(value || "");
  };

  const handleEditorDidMount = (editor: any) => {
    editorInstanceRef.current = editor;
    if (code) editor.setValue(code);
    editor.updateOptions({
      fontSize: 14,
      tabSize: 2,
      minimap: { enabled: true },
      theme: theme === 'dark' ? 'vs-dark' : 'vs'
    });
    editor.focus();
  };

  const resetCode = () => {
    // Always empty — no starter template, no boilerplate.
    setCode('');
    if (editorInstanceRef.current) editorInstanceRef.current.setValue('');
    addTerminalLog('system', 'Editor cleared');
    toast.info('Editor cleared');
  };

  const toggleFullscreen = async () => {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      await document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const getLanguage = (lang: string) => {
    const map: { [key: string]: string } = {
      javascript: 'javascript', typescript: 'typescript', python: 'python',
      java: 'java', cpp: 'cpp', c: 'c', csharp: 'csharp'
    };
    return map[lang] || 'python';
  };

  const formatLanguageName = (lang: string) => {
    const names: { [key: string]: string } = {
      javascript: 'JavaScript', typescript: 'TypeScript', python: 'Python',
      java: 'Java', cpp: 'C++', c: 'C', csharp: 'C#'
    };
    return names[lang] || lang;
  };

  const getDifficultyColor = (difficulty: string) => {
    const colors: { [key: string]: string } = {
      easy: 'bg-green-100 text-green-800',
      medium: 'bg-yellow-100 text-yellow-800',
      hard: 'bg-red-100 text-red-800'
    };
    return colors[difficulty?.toLowerCase()] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className={`h-full flex flex-col ${theme === 'dark' ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-900'}`}>
      <Script
        src="https://cdn.jsdelivr.net/pyodide/v0.25.0/full/pyodide.js"
        onLoad={initPyodide}
        strategy="afterInteractive"
      />

      {/* (Floating InteractiveTerminal removed — Console Output now renders
           INSIDE the editor column, below Monaco. See the panel rendered
           in the right column further down.) */}

      {/* Main Content - Split View
          (Top header with Console / Run / Submit / Reset row removed —
           Language selector + Run + Fullscreen now live inside the editor
           header below; final Submit is handled by the bottom-nav button.) */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Problem Description (resizable + collapsible).
            Width is driven by state, transitions smoothly when toggling open/closed,
            and the drag handle to the right of it (rendered below) lets the user
            adjust width — or drag it open from the collapsed 48px rail. */}
        <div
          className={`overflow-y-auto flex-shrink-0 ${theme === 'dark' ? 'bg-gray-900' : 'bg-white'}`}
          style={{
            width: showQuestionDetails ? sidebarWidth : 48,
            transition: isResizingQuestionSidebar ? 'none' : 'width 0.3s ease',
          }}
        >
          {!showQuestionDetails ? (
            // Collapsed rail — small expand button + vertical hint
            <div className="flex flex-col items-center pt-3 gap-3">
              <button
                onClick={() => setShowQuestionDetails(true)}
                title="Show problem"
                className={`flex items-center justify-center w-8 h-8 rounded-md border transition-colors ${theme === 'dark' ? 'border-gray-600 text-gray-400 hover:bg-gray-700' : 'border-gray-300 text-gray-500 hover:bg-gray-50'}`}
              >
                <PanelLeftOpen size={14} />
              </button>
              {questionNumber != null && (
                <div className={`text-xs font-bold ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                  Q{questionNumber}
                </div>
              )}
              <div
                className={`text-[10px] font-semibold tracking-wider ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}
                style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', marginTop: 8 }}
              >
                PROBLEM
              </div>
            </div>
          ) : (
          <div className="p-5 space-y-4">
            {/* Title — Q# prefix + Close (left) + Flag (right) */}
            <div>
              <div className="flex items-start justify-between gap-3">
                <h2 className={`text-base font-bold leading-snug flex-1 min-w-0 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                  {questionNumber != null ? `${questionNumber}. ` : ''}{question.title || 'Programming Question'}
                </h2>
                <button
                  onClick={() => setShowQuestionDetails(false)}
                  title="Hide problem"
                  className={`flex-shrink-0 flex items-center justify-center w-7 h-7 rounded-md border transition-colors ${theme === 'dark' ? 'border-gray-600 text-gray-400 hover:bg-gray-700' : 'border-gray-300 text-gray-500 hover:bg-gray-50'}`}
                >
                  <PanelLeftClose size={13} />
                </button>
                {onFlagToggle && (
                  <button
                    onClick={onFlagToggle}
                    title={isFlagged ? 'Unflag question' : 'Flag question'}
                    className={`flex-shrink-0 flex items-center justify-center w-7 h-7 rounded-md border transition-colors ${
                      isFlagged
                        ? 'border-amber-400 bg-amber-50 text-amber-500'
                        : theme === 'dark'
                          ? 'border-gray-600 text-gray-400 hover:bg-gray-700'
                          : 'border-gray-300 text-gray-500 hover:bg-gray-50'
                    }`}
                  >
                    <Flag size={13} fill={isFlagged ? '#f59e0b' : 'none'} />
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2 mt-1.5">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getDifficultyColor(question.difficulty)}`}>
                  {question.difficulty || 'Medium'}
                </span>
                {/* Marks badge — shown only when the exercise is graded AND
                    the question has a mark value assigned. Sits next to the
                    difficulty badge so the student sees them together. */}
                {isGraded && (question.points ?? question.marks ?? question.mark) && (
                  <span className={`text-xs px-2 py-0.5 rounded-full flex items-center gap-1 font-medium ${theme === 'dark' ? 'bg-amber-900/30 text-amber-300 border border-amber-700/40' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
                    <Award className="w-3 h-3" />
                    {question.points ?? question.marks ?? question.mark} {(question.points ?? question.marks ?? question.mark) === 1 ? 'mark' : 'marks'}
                  </span>
                )}
              </div>
            </div>

            <div>
              <h3 className={`text-sm font-semibold mb-2 flex items-center gap-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                <FileText className="w-4 h-4" />
                Description
              </h3>
              <div
                className={`text-sm leading-relaxed ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}
                dangerouslySetInnerHTML={{
                  __html: typeof question.description === 'string'
                    ? question.description
                    : question.description?.text || 'Solve the programming problem.'
                }}
              />
            </div>

            {/* Sample Input/Output */}
            {(question.sampleInput || question.sampleOutput) && (
              <div>
                <h3 className={`text-sm font-semibold mb-2 flex items-center gap-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                  <Terminal className="w-4 h-4" />
                  Sample
                </h3>
                <div className="space-y-2">
                  {question.sampleInput && (
                    <div>
                      <div className={`text-xs font-medium mb-1 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>Input:</div>
                      <pre className={`text-xs p-2 rounded font-mono ${theme === 'dark' ? 'bg-gray-800 border border-gray-700' : 'bg-gray-100 border border-gray-200'}`}>
                        {question.sampleInput}
                      </pre>
                    </div>
                  )}
                  {question.sampleOutput && (
                    <div>
                      <div className={`text-xs font-medium mb-1 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>Output:</div>
                      <pre className={`text-xs p-2 rounded font-mono ${theme === 'dark' ? 'bg-gray-800 border border-gray-700' : 'bg-gray-100 border border-gray-200'}`}>
                        {question.sampleOutput}
                      </pre>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Constraints */}
            {question.constraints && question.constraints.length > 0 && (
              <div>
                <h3 className={`text-sm font-semibold mb-2 flex items-center gap-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                  <AlertCircle className="w-4 h-4" />
                  Constraints
                </h3>
                <ul className="space-y-1 text-xs pl-5 list-disc">
                  {question.constraints.map((c: string, i: number) => (
                    <li key={i} className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>{c}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Hints */}
            {question.hints && question.hints.filter((h: any) => h.isPublic).length > 0 && (
              <div>
                <h3 className={`text-sm font-semibold mb-2 flex items-center gap-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                  <HelpCircle className="w-4 h-4" />
                  Hints
                </h3>
                {question.hints.filter((h: any) => h.isPublic).map((hint: any, i: number) => (
                  <div key={i} className={`text-xs p-2 rounded ${theme === 'dark' ? 'bg-orange-900/20 text-orange-300' : 'bg-orange-50 text-orange-700'}`}>
                    💡 {hint.hintText}
                  </div>
                ))}
              </div>
            )}
          </div>
          )}
        </div>

        {/* Drag handle to resize the Problem sidebar — works even when collapsed
            (dragging it open expands the sidebar). */}
        <div
          onMouseDown={startQuestionSidebarResize}
          className="cursor-ew-resize flex-shrink-0 hover:bg-orange-500 transition-colors"
          style={{
            width: 4,
            backgroundColor: isResizingQuestionSidebar ? '#fb923c' : (theme === 'dark' ? '#374151' : '#e5e7eb'),
          }}
          title="Drag to resize"
        />

        {/* Right Panel - Code Editor */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Editor header — hosts the Code Editor label on the left and the
              Language selector + Run + Fullscreen controls on the right
              (moved here from the removed top header row). */}
          <div className={`px-3 py-1.5 border-b flex items-center justify-between ${theme === 'dark' ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-gray-50'}`}>
            <div className="flex items-center gap-2 min-w-0">
              <Code className={`w-3.5 h-3.5 flex-shrink-0 ${theme === 'dark' ? 'text-orange-400' : 'text-orange-500'}`} />
              <span className={`text-xs font-medium truncate ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>Code Editor</span>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {/* Language Selector */}
              <select
                value={selectedLanguage}
                onChange={(e) => setSelectedLanguage(e.target.value)}
                className={`h-7 text-xs border rounded px-2 ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
              >
                {availableLanguages.map((lang) => (
                  <option key={lang} value={lang}>{formatLanguageName(lang)}</option>
                ))}
              </select>

              {/* Run */}
              <button
                onClick={runCode}
                disabled={isRunning}
                className={`h-7 px-3 text-xs rounded flex items-center gap-1 ${theme === 'dark' ? 'bg-orange-600 hover:bg-orange-500' : 'bg-orange-500 hover:bg-orange-600'} text-white disabled:opacity-50`}
              >
                {isRunning ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                Run
              </button>

              {/* Fullscreen */}
              <button
                onClick={toggleFullscreen}
                title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
                className={`h-7 w-7 flex items-center justify-center border rounded ${theme === 'dark' ? 'border-gray-600 hover:bg-gray-700' : 'border-gray-300 hover:bg-gray-50'}`}
              >
                {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
          {/* Editor + inline Console Output stacked vertically.
              Console slides UP from the bottom of the editor area only (it
              stays inside this column — not full-width, not floating). */}
          <div className="flex-1 flex flex-col min-h-0">
            <div className="flex-1 min-h-0">
              <MonacoEditor
                key={`editor-${selectedLanguage}`}
                height="100%"
                language={getLanguage(selectedLanguage)}
                value={code}
                onChange={handleEditorChange}
                onMount={handleEditorDidMount}
                theme={theme === 'dark' ? 'vs-dark' : 'vs'}
                options={{
                  minimap: { enabled: true },
                  fontSize: 14,
                  tabSize: 2,
                  automaticLayout: true,
                  wordWrap: 'on',
                  scrollBeyondLastLine: false
                }}
              />
            </div>

            {showTerminal && (
              <div
                className={`flex flex-col flex-shrink-0 border-t ${theme === 'dark' ? 'bg-slate-950 border-slate-800' : 'bg-white border-gray-300'}`}
                style={{ height: 240, animation: 'console-slide-up 0.25s ease-out' }}
              >
                {/* Console header */}
                <div className={`flex items-center justify-between px-3 py-1.5 border-b ${theme === 'dark' ? 'border-slate-800 bg-slate-900' : 'border-gray-200 bg-gray-50'}`}>
                  <div className="flex items-center gap-2">
                    <Terminal className={`w-3.5 h-3.5 ${theme === 'dark' ? 'text-emerald-500' : 'text-green-600'}`} />
                    <span className={`text-xs font-semibold ${theme === 'dark' ? 'text-slate-200' : 'text-gray-800'}`}>Console Output</span>
                    <span className={`text-[10px] font-mono uppercase ${theme === 'dark' ? 'text-slate-500' : 'text-gray-500'}`}>
                      {selectedLanguage} • {isRunning ? 'Running...' : 'Idle'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={clearTerminal}
                      title="Clear"
                      className={`h-6 w-6 flex items-center justify-center rounded transition-colors ${theme === 'dark' ? 'text-slate-500 hover:text-slate-300 hover:bg-slate-800' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200'}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setShowTerminal(false)}
                      title="Close"
                      className={`h-6 w-6 flex items-center justify-center rounded transition-colors ${theme === 'dark' ? 'text-slate-500 hover:text-red-400 hover:bg-slate-800' : 'text-gray-500 hover:text-red-600 hover:bg-gray-200'}`}
                    >
                      <XIcon className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Console body */}
                <div className={`flex-1 overflow-y-auto p-3 font-mono text-xs space-y-1 ${theme === 'dark' ? 'bg-slate-950 text-slate-300' : 'bg-white text-gray-800'}`}>
                  {terminalLogs.length === 0 && !isRunning && (
                    <div className={`italic ${theme === 'dark' ? 'text-slate-600' : 'text-gray-500'}`}>
                      Click Run to execute your code.
                    </div>
                  )}
                  {terminalLogs.map((log) => (
                    <div key={log.id} className="break-all whitespace-pre-wrap leading-relaxed">
                      {log.type === 'stdout' && <span className={theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}>{log.content}</span>}
                      {log.type === 'stderr' && <span className="text-rose-600 dark:text-rose-400">{log.content}</span>}
                      {log.type === 'system' && <span className={`italic select-none ${theme === 'dark' ? 'text-emerald-400' : 'text-green-600'}`}>➜ {log.content}</span>}
                      {log.type === 'error' && <span className="text-red-600 dark:text-red-400">{log.content}</span>}
                      {log.type === 'warning' && <span className="text-yellow-600 dark:text-yellow-400">{log.content}</span>}
                      {log.type === 'success' && <span className="text-green-600 dark:text-green-400">{log.content}</span>}
                      {log.type === 'info' && <span className="text-blue-600 dark:text-blue-400">{log.content}</span>}
                    </div>
                  ))}
                  {isRunning && (
                    <div className="flex items-center gap-2 mt-2">
                      <Loader2 className="w-3 h-3 text-emerald-500 animate-spin" />
                      <span className={theme === 'dark' ? 'text-slate-500' : 'text-gray-500'}>Executing...</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes console-slide-up {
          from { transform: translateY(100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default ProgrammingQuestion;