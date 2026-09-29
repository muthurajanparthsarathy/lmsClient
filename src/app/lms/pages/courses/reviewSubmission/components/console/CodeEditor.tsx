"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Check, Copy, Loader2, Maximize2, Minimize2 } from "lucide-react";
import { C } from "./tokens";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => (
    <div
      className="flex h-full w-full items-center justify-center text-xs text-[#7C8DA3]"
      style={{ background: C.editorBg }}
    >
      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading editor…
    </div>
  ),
});

export const EDITOR_THEME = "smartcliff-console-dark";

/** VS-Code-dark-alike tuned to the console's navy slab (#182331). */
export function defineConsoleTheme(monaco: any) {
  monaco.editor.defineTheme(EDITOR_THEME, {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "", foreground: "D6E2F0" },
      { token: "comment", foreground: "5F7285", fontStyle: "italic" },
      { token: "keyword", foreground: "4FA6F5" },
      { token: "keyword.control", foreground: "C08CE0" },
      { token: "number", foreground: "B5CEA8" },
      { token: "string", foreground: "E2896B" },
      { token: "type", foreground: "5FD0C4" },
      { token: "type.identifier", foreground: "5FD0C4" },
      { token: "identifier", foreground: "D6E2F0" },
      { token: "delimiter", foreground: "A6B6C9" },
      { token: "operator", foreground: "A6B6C9" },
      { token: "annotation", foreground: "D8C06A" },
    ],
    colors: {
      "editor.background": C.editorBg,
      "editor.foreground": "#D6E2F0",
      "editorGutter.background": C.editorBg,
      "editorLineNumber.foreground": "#5A6B80",
      "editorLineNumber.activeForeground": "#9FB2C7",
      "editor.lineHighlightBackground": "#1E2C3C",
      "editor.lineHighlightBorder": "#00000000",
      "editorIndentGuide.background1": "#26364A",
      "editorIndentGuide.activeBackground1": "#3A4D63",
      "editor.selectionBackground": "#2C4B6E",
      "editorWidget.background": "#1E2C3C",
      "scrollbarSlider.background": "#2B3B4D80",
      "scrollbarSlider.hoverBackground": "#33465CB0",
      "scrollbarSlider.activeBackground": "#3C5270",
      "editorOverviewRuler.border": "#00000000",
    },
  });
}

interface CodeEditorProps {
  value: string;
  language: string;
  height: number | string;
  readOnly?: boolean;
  onChange?: (value: string) => void;
  onCopy?: () => void;
  expanded: boolean;
  onToggleExpand: () => void;
}

export default function CodeEditor({
  value,
  language,
  height,
  readOnly = true,
  onChange,
  onCopy,
  expanded,
  onToggleExpand,
}: CodeEditorProps) {
  const [copied, setCopied] = useState(false);
  const Expand = expanded ? Minimize2 : Maximize2;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value || "");
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
      onCopy?.();
    } catch {
      /* clipboard blocked (insecure origin / permissions) — silently ignore */
    }
  };

  return (
    <div
      className="relative w-full"
      style={{ height, background: C.editorBg }}
    >
      {/* Both buttons blend into the slab so they read as editor chrome. */}
      <div className="absolute right-3 top-3 z-10 flex items-center gap-1.5">
        <button
          type="button"
          onClick={handleCopy}
          title={copied ? "Copied" : "Copy code"}
          aria-label="Copy code"
          className="flex h-[26px] w-[26px] items-center justify-center rounded-[6px] bg-[#22303F] text-[#8FA3B8] transition-colors hover:bg-[#2C3D50] hover:text-white"
        >
          {copied ? (
            <Check className="h-[14px] w-[14px] text-[#4ADE80]" />
          ) : (
            <Copy className="h-[14px] w-[14px]" />
          )}
        </button>
        <button
          type="button"
          onClick={onToggleExpand}
          title={expanded ? "Exit fullscreen" : "Fullscreen editor"}
          aria-label={expanded ? "Exit fullscreen" : "Fullscreen editor"}
          className="flex h-[26px] w-[26px] items-center justify-center rounded-[6px] bg-[#22303F] text-[#8FA3B8] transition-colors hover:bg-[#2C3D50] hover:text-white"
        >
          <Expand className="h-[14px] w-[14px]" />
        </button>
      </div>

      <MonacoEditor
        height="100%"
        language={language}
        theme={EDITOR_THEME}
        value={value}
        beforeMount={defineConsoleTheme}
        onChange={(v) => onChange?.(v ?? "")}
        options={{
          readOnly,
          domReadOnly: readOnly,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          fontSize: 14,
          lineHeight: 21,
          padding: { top: 14, bottom: 14 },
          lineNumbers: "on",
          lineNumbersMinChars: 3,
          lineDecorationsWidth: 12,
          glyphMargin: false,
          folding: false,
          renderLineHighlight: "none",
          overviewRulerLanes: 0,
          scrollbar: { verticalScrollbarSize: 10, horizontalScrollbarSize: 10 },
          fontFamily:
            "'JetBrains Mono', 'Fira Code', 'Cascadia Mono', Consolas, monospace",
          fontLigatures: true,
          automaticLayout: true,
        }}
      />
    </div>
  );
}
