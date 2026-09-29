"use client"

// VS Code-style cross-file content search. Plain substring match (case-insensitive
// by default; toggle to case-sensitive with `Aa`). Clicking a hit opens that file
// in a new tab — line-jump in Monaco is a future enhancement.

import { useMemo, useState } from "react"
import { Search, CaseSensitive, X } from "lucide-react"
import type { FileNode } from "./types"

interface SearchPanelProps {
  files: FileNode[]
  onOpenFile: (id: string) => void
}

interface Match {
  file: FileNode
  line: number
  text: string
  start: number
  end: number
}

export default function SearchPanel({ files, onOpenFile }: SearchPanelProps) {
  const [query, setQuery] = useState("")
  const [caseSensitive, setCaseSensitive] = useState(false)

  const results: Match[] = useMemo(() => {
    if (!query.trim()) return []
    const needle = caseSensitive ? query : query.toLowerCase()
    const hits: Match[] = []
    for (const f of files) {
      const lines = (f.content || "").split("\n")
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        const hay = caseSensitive ? line : line.toLowerCase()
        const idx = hay.indexOf(needle)
        if (idx !== -1 && hits.length < 200) {
          hits.push({ file: f, line: i + 1, text: line, start: idx, end: idx + needle.length })
        }
      }
      if (hits.length >= 200) break
    }
    return hits
  }, [query, caseSensitive, files])

  const grouped = useMemo(() => {
    const g: Record<string, Match[]> = {}
    for (const r of results) (g[r.file.path] ||= []).push(r)
    return g
  }, [results])

  return (
    <div className="flex flex-col h-full min-h-0" style={{ background: "#fafafa" }}>
      <div className="flex items-center justify-between px-2 py-1.5 border-b" style={{ borderColor: "#e5e7eb" }}>
        <span className="text-2xs font-semibold uppercase tracking-wide text-gray-500">Search</span>
        <button
          onClick={() => setCaseSensitive((v) => !v)}
          title="Match case"
          className="p-1 rounded"
          style={{ background: caseSensitive ? "#e0e7ff" : "transparent", color: caseSensitive ? "#4338ca" : "#6b7280" }}
        >
          <CaseSensitive size={13} />
        </button>
      </div>

      <div className="px-2 pt-2 pb-1 flex-shrink-0">
        <div className="relative">
          <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search across files"
            className="w-full pl-7 pr-7 py-1 text-xs rounded outline-none"
            style={{ background: "#fff", border: "1px solid #d1d5db" }}
            autoFocus
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-gray-200"
              title="Clear"
            >
              <X size={11} className="text-gray-500" />
            </button>
          )}
        </div>
      </div>

      <div className="px-2 text-2xs text-gray-500">
        {query.trim() ? `${results.length} result${results.length === 1 ? "" : "s"}${results.length >= 200 ? " (limit)" : ""} in ${Object.keys(grouped).length} file${Object.keys(grouped).length === 1 ? "" : "s"}` : "Type to search…"}
      </div>

      <div className="flex-1 overflow-auto py-1">
        {Object.entries(grouped).map(([path, hits]) => (
          <div key={path}>
            <div className="px-2 py-1 text-2xs font-semibold text-gray-700 truncate" title={path}>{hits[0].file.filename} <span className="font-normal text-gray-400">{path}</span></div>
            {hits.map((m, i) => (
              <button
                key={i}
                onClick={() => onOpenFile(m.file.id)}
                className="w-full text-left px-3 py-0.5 text-xs hover:bg-indigo-50 flex items-center gap-2"
                style={{ fontFamily: "ui-monospace, monospace" }}
              >
                <span className="text-gray-400 flex-shrink-0">{m.line}</span>
                <span className="truncate text-gray-800">
                  {m.text.slice(0, m.start)}
                  <mark style={{ background: "#fde68a", padding: 0 }}>{m.text.slice(m.start, m.end)}</mark>
                  {m.text.slice(m.end)}
                </span>
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
