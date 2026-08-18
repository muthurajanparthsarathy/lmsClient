"use client"

import dynamic from "next/dynamic"
import { useEffect, useRef } from "react"
import { X, Circle } from "lucide-react"
import { LANGUAGE_CONFIG, detectLanguageFromFilename } from "@/lib/codeLanguages"
import type { FileNode } from "./types"

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), { ssr: false })

// Map our language ids to Monaco's language ids.
const monacoLang = (file: FileNode): string => {
  const l = file.language === "text" ? detectLanguageFromFilename(file.filename) : file.language
  const map: Record<string, string> = {
    python: "python", javascript: "javascript", typescript: "typescript",
    java: "java", cpp: "cpp", c: "c", go: "go",
  }
  return map[l as string] || "plaintext"
}

interface MonacoTabsProps {
  openFiles: FileNode[] // files with an open tab, in tab order
  activeFileId: string | null
  theme?: "light" | "dark"
  // The line to highlight (1-based) while the visualizer is stepping, and the
  // file it belongs to. When highlightFileId differs from the active tab we
  // still highlight if it happens to be the active file.
  highlightLine?: number | null
  readOnly?: boolean
  onSelectTab: (id: string) => void
  onCloseTab: (id: string) => void
  onChange: (id: string, value: string) => void
}

export default function MonacoTabs(props: MonacoTabsProps) {
  const { openFiles, activeFileId, theme = "light", highlightLine, readOnly, onSelectTab, onCloseTab, onChange } = props
  const editorRef = useRef<any>(null)
  const monacoRef = useRef<any>(null)
  const decorationsRef = useRef<string[]>([])

  const active = openFiles.find((f) => f.id === activeFileId) || null

  // Apply / clear the executing-line decoration whenever the highlight changes.
  useEffect(() => {
    const editor = editorRef.current
    const monaco = monacoRef.current
    if (!editor || !monaco) return
    if (highlightLine && highlightLine > 0) {
      decorationsRef.current = editor.deltaDecorations(decorationsRef.current, [
        {
          range: new monaco.Range(highlightLine, 1, highlightLine, 1),
          options: {
            isWholeLine: true,
            className: "viz-exec-line",
            glyphMarginClassName: "viz-exec-glyph",
          },
        },
      ])
      editor.revealLineInCenterIfOutsideViewport(highlightLine)
    } else {
      decorationsRef.current = editor.deltaDecorations(decorationsRef.current, [])
    }
  }, [highlightLine, activeFileId])

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Tab bar */}
      <div className="flex items-stretch overflow-x-auto flex-shrink-0 border-b" style={{ borderColor: "#e5e7eb", background: "#f9fafb" }}>
        {openFiles.length === 0 && (
          <div className="px-3 py-2 text-[11px] text-gray-400">Open a file from the Explorer</div>
        )}
        {openFiles.map((f) => {
          const isActive = f.id === activeFileId
          const color = f.language !== "text" ? LANGUAGE_CONFIG[f.language]?.color : "#9ca3af"
          return (
            <div
              key={f.id}
              onClick={() => onSelectTab(f.id)}
              className="group flex items-center gap-2 px-3 py-1.5 cursor-pointer border-r flex-shrink-0"
              style={{
                borderColor: "#e5e7eb",
                background: isActive ? "#ffffff" : "transparent",
                borderBottom: isActive ? "2px solid " + (color || "#6366f1") : "2px solid transparent",
              }}
              title={f.path}
            >
              <Circle size={8} style={{ color: color || "#9ca3af", fill: color || "#9ca3af" }} />
              <span className={`text-[12px] ${isActive ? "text-gray-900 font-semibold" : "text-gray-500"}`}>{f.filename}</span>
              <button
                onClick={(e) => { e.stopPropagation(); onCloseTab(f.id) }}
                className="opacity-0 group-hover:opacity-100 hover:bg-gray-200 rounded"
              >
                <X size={12} className="text-gray-500" />
              </button>
            </div>
          )
        })}
      </div>

      {/* Editor */}
      <div className="flex-1 min-h-0 relative">
        {active ? (
          <MonacoEditor
            key={active.id}
            height="100%"
            language={monacoLang(active)}
            theme={theme === "dark" ? "vs-dark" : "vs"}
            value={active.content}
            onChange={(val) => onChange(active.id, val ?? "")}
            onMount={(editor, monaco) => { editorRef.current = editor; monacoRef.current = monaco }}
            options={{
              readOnly,
              fontSize: 13,
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              glyphMargin: true,
              automaticLayout: true,
              tabSize: 4,
              lineNumbersMinChars: 3,
              renderLineHighlight: "all",
            }}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-sm text-gray-400">No file open</div>
        )}
      </div>

      {/* Executing-line highlight styles for the visualizer */}
      <style jsx global>{`
        .viz-exec-line { background: rgba(250, 204, 21, 0.28); }
        .viz-exec-glyph { background: #f59e0b; width: 4px !important; margin-left: 3px; border-radius: 2px; }
      `}</style>
    </div>
  )
}
