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
  GraduationCap
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
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-2" />
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
  theme = 'light'
}) => {
  // State
  const [code, setCode] = useState("");
  const [selectedLanguage, setSelectedLanguage] = useState("python");
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

  // Initialize code from question
  useEffect(() => {
    if (question) {
      const initialCode = question.solutions?.startedCode || question.solutions?.staetedCode;
      if (initialCode) {
        setCode(initialCode);
      } else {
        setCode(getInitialCode(selectedLanguage));
      }

      // Set available languages
      if (question.allowedLanguages && question.allowedLanguages.length > 0) {
        setAvailableLanguages(question.allowedLanguages);
      } else if (question.solutions?.language) {
        setAvailableLanguages([question.solutions.language.toLowerCase()]);
      }

      // Set language
      if (question.solutions?.language) {
        setSelectedLanguage(question.solutions.language.toLowerCase());
      }
    }
  }, [question]);

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
    try {
      // Use Pyodide for Python
      if (selectedLanguage.toLowerCase() === 'python' && pyodideReady && pyodideRef.current) {
        try {
          pyodideRef.current.setStdout({
            batched: (msg: string) => addTerminalLog('stdout', msg)
          });
          pyodideRef.current.setStderr({
            batched: (msg: string) => addTerminalLog('stderr', msg)
          });

          await pyodideRef.current.runPythonAsync(code);
          return { output: "" };
        } catch (err: any) {
          return { output: "", error: err.message };
        }
      }

      // Use Piston API for other languages
      const pistonLang = getPistonLanguage(selectedLanguage);
      const currentCode = editorInstanceRef.current ? editorInstanceRef.current.getValue() : code;

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
      await executeCode();
      addTerminalLog('success', '✅ Execution completed');
    } catch (error) {
      addTerminalLog('error', `Error: ${error}`);
    } finally {
      setIsRunning(false);
    }
  };

  // Submit code
  const submitCode = async () => {
    setIsSubmitting(true);
    clearTerminal();
    setShowTerminal(true);

    try {
      const currentCode = editorInstanceRef.current ? editorInstanceRef.current.getValue() : code;
      const token = getToken() || localStorage.getItem('token') || '';

      addTerminalLog('system', '📤 Submitting solution...');

      const formData = new FormData();
      formData.append('courseId', courseId);
      formData.append('exerciseId', exerciseId);
      formData.append('questionId', question._id);
      formData.append('code', currentCode);
      formData.append('score', (question.points || 100).toString());
      formData.append('status', 'submitted');
      formData.append('category', category);
      formData.append('subcategory', subcategory);
      formData.append('nodeId', nodeId);
      formData.append('nodeName', nodeName);
      formData.append('nodeType', nodeType);
      formData.append('language', selectedLanguage);

      const response = await fetch('http://localhost:5533/courses/answers/submit', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData,
      });

      if (response.ok) {
        addTerminalLog('success', '🎉 Solution submitted successfully!');
        toast.success('Solution submitted!');
        onComplete();

        if (!isLastQuestion) {
          setTimeout(() => onNext(), 1500);
        }
      } else {
        throw new Error('Submission failed');
      }
    } catch (error: any) {
      addTerminalLog('error', `❌ ${error.message}`);
      toast.error('Submission failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

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
    const initialCode = question.solutions?.startedCode || question.solutions?.staetedCode || getInitialCode(selectedLanguage);
    setCode(initialCode);
    if (editorInstanceRef.current) editorInstanceRef.current.setValue(initialCode);
    addTerminalLog('system', 'Code reset to initial state');
    toast.info('Code reset');
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

      <InteractiveTerminal
        isOpen={showTerminal}
        onClose={() => setShowTerminal(false)}
        logs={terminalLogs}
        isRunning={isRunning}
        language={selectedLanguage}
        onClear={clearTerminal}
        theme={theme}
      />

      {/* Header - Exactly like CodeEditor */}
      <div className={`flex items-center justify-between px-4 py-2 border-b ${theme === 'dark' ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white'}`}>
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className={`p-1.5 rounded-lg transition-colors ${theme === 'dark' ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-600'}`}
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          {/* <div className="flex items-center gap-2">
            <div className={`w-6 h-6 rounded-md flex items-center justify-center ${theme === 'dark' ? 'bg-blue-900/30' : 'bg-blue-100'}`}>
              <GraduationCap className={`w-3.5 h-3.5 ${theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}`} />
            </div>
            <span className={`text-sm font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              {question.title || 'Programming Question'}
            </span>
            <div className="flex items-center gap-2 ml-2">
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getDifficultyColor(question.difficulty)}`}>
                {question.difficulty || 'Medium'}
              </span>
              {question.points && (
                <span className={`text-xs px-2 py-0.5 rounded-full flex items-center gap-1 ${theme === 'dark' ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600'}`}>
                  <Award className="w-3 h-3" />
                  {question.points} pts
                </span>
              )}
            </div>
          </div> */}
        </div>

        <div className="flex items-center gap-2">
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

          {/* Console Button */}
          <button
            onClick={() => setShowTerminal(true)}
            className={`h-7 px-2 text-xs border rounded flex items-center gap-1 ${theme === 'dark' ? 'border-gray-600 hover:bg-gray-700' : 'border-gray-300 hover:bg-gray-50'}`}
          >
            <Terminal className="w-3 h-3" />
            Console
          </button>

          {/* Run Button */}
          <button
            onClick={runCode}
            disabled={isRunning}
            className={`h-7 px-3 text-xs rounded flex items-center gap-1 ${theme === 'dark' ? 'bg-blue-600 hover:bg-blue-500' : 'bg-blue-500 hover:bg-blue-600'} text-white disabled:opacity-50`}
          >
            {isRunning ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
            Run
          </button>

          {/* Submit Button */}
          <button
            onClick={submitCode}
            disabled={isSubmitting}
            className={`h-7 px-3 text-xs rounded flex items-center gap-1 ${theme === 'dark' ? 'bg-green-600 hover:bg-green-500' : 'bg-green-500 hover:bg-green-600'} text-white disabled:opacity-50`}
          >
            {isSubmitting ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}
            {isLastQuestion ? 'Complete' : 'Submit'}
          </button>

          {/* Reset Button */}
          <button
            onClick={resetCode}
            className={`h-7 w-7 flex items-center justify-center border rounded ${theme === 'dark' ? 'border-gray-600 hover:bg-gray-700' : 'border-gray-300 hover:bg-gray-50'}`}
            title="Reset Code"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          {/* Fullscreen Button */}
          <button
            onClick={toggleFullscreen}
            className={`h-7 w-7 flex items-center justify-center border rounded ${theme === 'dark' ? 'border-gray-600 hover:bg-gray-700' : 'border-gray-300 hover:bg-gray-50'}`}
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Main Content - Split View */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Problem Description */}
        <div className={`w-2/5 border-r overflow-y-auto ${theme === 'dark' ? 'border-gray-700 bg-gray-900' : 'border-gray-200 bg-white'}`}>
          <div className="p-5 space-y-4">
            {/* Title */}
            <div>
              <h2 className={`text-base font-bold leading-snug ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                {question.title || 'Programming Question'}
              </h2>
              <div className="flex items-center gap-2 mt-1.5">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getDifficultyColor(question.difficulty)}`}>
                  {question.difficulty || 'Medium'}
                </span>
                {question.points && (
                  <span className={`text-xs px-2 py-0.5 rounded-full flex items-center gap-1 ${theme === 'dark' ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600'}`}>
                    <Award className="w-3 h-3" />
                    {question.points} pts
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
                  <div key={i} className={`text-xs p-2 rounded ${theme === 'dark' ? 'bg-blue-900/20 text-blue-300' : 'bg-blue-50 text-blue-700'}`}>
                    💡 {hint.hintText}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Panel - Code Editor */}
        <div className="flex-1 flex flex-col">
          <div className={`px-3 py-1.5 border-b ${theme === 'dark' ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-gray-50'}`}>
            <div className="flex items-center gap-2">
              <Code className={`w-3.5 h-3.5 ${theme === 'dark' ? 'text-blue-400' : 'text-blue-500'}`} />
              <span className={`text-xs font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>Code Editor</span>
              <span className={`text-[10px] ${theme === 'dark' ? 'text-gray-500' : 'text-gray-500'}`}>({formatLanguageName(selectedLanguage)})</span>
            </div>
          </div>
          <div className="flex-1">
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
        </div>
      </div>
    </div>
  );
};

export default ProgrammingQuestion;