"use client";

// Tiny vendor-ish glyph for a language. A stand-in for the real logo so the
// toolbar and the file explorer need no image assets and no extra CDN request,
// and so both places mark a file the same way.

const PALETTE: Record<string, [string, string]> = {
  java: ["#EA6C2D", "#FFFFFF"],
  python: ["#3776AB", "#FFD43B"],
  javascript: ["#F7DF1E", "#7A6D08"],
  typescript: ["#3178C6", "#FFFFFF"],
  c: ["#5C6BC0", "#FFFFFF"],
  cpp: ["#00599C", "#FFFFFF"],
  csharp: ["#68217A", "#FFFFFF"],
  sql: ["#00758F", "#FFFFFF"],
  plsql: ["#00758F", "#FFFFFF"],
  html: ["#E44D26", "#FFFFFF"],
  css: ["#2965F1", "#FFFFFF"],
  json: ["#8A8A8A", "#FFFFFF"],
  markdown: ["#4B5563", "#FFFFFF"],
  go: ["#00ADD8", "#FFFFFF"],
  rust: ["#B7410E", "#FFFFFF"],
  php: ["#777BB4", "#FFFFFF"],
};

const GLYPH: Record<string, string> = {
  cpp: "C+",
  csharp: "C#",
  javascript: "JS",
  typescript: "TS",
  markdown: "M",
};

/** Maps a filename to the language key this component (and Monaco) uses. */
export function languageFromFilename(name: string): string {
  const ext = (name.split(".").pop() || "").toLowerCase();
  const byExt: Record<string, string> = {
    java: "java",
    py: "python",
    js: "javascript",
    jsx: "javascript",
    mjs: "javascript",
    ts: "typescript",
    tsx: "typescript",
    c: "c",
    h: "c",
    cpp: "cpp",
    cc: "cpp",
    hpp: "cpp",
    cs: "csharp",
    sql: "sql",
    html: "html",
    htm: "html",
    css: "css",
    json: "json",
    md: "markdown",
    go: "go",
    rs: "rust",
    php: "php",
    txt: "plaintext",
  };
  return byExt[ext] || "plaintext";
}

export default function LanguageMark({
  language,
  size = 19,
}: {
  language: string;
  size?: number;
}) {
  const key = (language || "").toLowerCase();
  const [bg, fg] = PALETTE[key] || ["#8FA0BE", "#FFFFFF"];
  const glyph = GLYPH[key] || (key[0] || "?").toUpperCase();

  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-[4px] font-black leading-none"
      style={{
        width: size,
        height: size,
        background: bg,
        color: fg,
        fontSize: Math.max(8, Math.round(size * 0.5)),
      }}
      aria-hidden
    >
      {glyph}
    </span>
  );
}
