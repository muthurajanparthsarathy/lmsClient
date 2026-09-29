"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Loader2, Play, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import LanguageMark from "./LanguageMark";

interface CodeToolbarProps {
  language: string;
  languages: string[];
  onLanguageChange: (language: string) => void;
  onRun: () => void;
  onReset: () => void;
  running: boolean;
  runDisabled?: boolean;
  /** Drives the read-only project-type chip. It is a LABEL, not a menu —
   *  browsing the project's files is the explorer's job. */
  fileCount: number;
}

const LANGUAGE_LABELS: Record<string, string> = {
  java: "Java",
  python: "Python",
  javascript: "JavaScript",
  typescript: "TypeScript",
  c: "C",
  cpp: "C++",
  csharp: "C#",
  sql: "SQL",
  plsql: "PL/SQL",
};

export function languageLabel(lang: string): string {
  const key = (lang || "").toLowerCase();
  return LANGUAGE_LABELS[key] || (lang ? lang[0].toUpperCase() + lang.slice(1) : "Code");
}

export default function CodeToolbar({
  language,
  languages,
  onLanguageChange,
  onRun,
  onReset,
  running,
  runDisabled,
  fileCount,
}: CodeToolbarProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  const options = languages.length > 0 ? languages : [language].filter(Boolean);

  return (
    <div className="flex h-[42px] flex-none items-center justify-between border-b border-[#E7EEF8] px-3">
      <div className="flex min-w-0 items-center gap-2">
      <div className="relative" ref={ref}>
        <button
          type="button"
          onClick={() => options.length > 1 && setOpen((v) => !v)}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label="Language"
          className={cn(
            "flex h-[28px] items-center gap-1.5 rounded-[6px] border border-[#E5E7EB] bg-white px-2 text-[12.5px] font-medium text-[#39496B] transition-colors",
            options.length > 1 ? "hover:border-[#B9CDEA] hover:bg-[#F7FAFF]" : "cursor-default",
          )}
        >
          <LanguageMark language={language} size={16} />
          <span className="text-left">{languageLabel(language)}</span>
          {options.length > 1 && <ChevronDown className="h-[14px] w-[14px] text-[#8090AF]" />}
        </button>

        {open && (
          <ul
            role="listbox"
            className="absolute left-0 top-[calc(100%+6px)] z-40 w-[176px] overflow-hidden rounded-[9px] border border-[#DEE7F3] bg-white py-1 shadow-[0_10px_30px_rgba(11,20,55,0.12)]"
          >
            {options.map((l) => (
              <li key={l}>
                <button
                  type="button"
                  role="option"
                  aria-selected={l === language}
                  onClick={() => {
                    onLanguageChange(l);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] transition-colors",
                    l === language
                      ? "bg-[#EEF5FF] font-semibold text-[#0667F9]"
                      : "font-medium text-[#39496B] hover:bg-[#F5F9FF]",
                  )}
                >
                  <LanguageMark language={l} size={16} />
                  {languageLabel(l)}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

        <span className="shrink-0 rounded-[5px] bg-[#EEF2F8] px-2 py-[3px] text-[10.5px] font-semibold text-[#66789C]">
          {fileCount > 1 ? "Multi-file project" : "Single file"}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onRun}
          disabled={running || runDisabled}
          className="flex h-[28px] items-center gap-1.5 rounded-[6px] bg-[#09B96D] px-3 text-[12.5px] font-semibold text-white transition-colors hover:bg-[#059A5A] disabled:cursor-not-allowed disabled:bg-[#9CE0C3]"
        >
          {running ? (
            <Loader2 className="h-[14px] w-[14px] animate-spin" />
          ) : (
            <Play className="h-[14px] w-[14px] fill-current" />
          )}
          {running ? "Running…" : "Run Code"}
        </button>
        <button
          type="button"
          onClick={onReset}
          className="flex h-[28px] items-center gap-1.5 rounded-[6px] border border-[#E5E7EB] bg-white px-2.5 text-[12.5px] font-medium text-[#39496B] transition-colors hover:border-[#B9CDEA] hover:bg-[#F7FAFF]"
        >
          <RotateCcw className="h-[14px] w-[14px]" />
          Reset
        </button>
      </div>
    </div>
  );
}
