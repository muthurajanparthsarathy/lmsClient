"use client";

import { useEffect, useMemo, useState } from "react";
import DOMPurify from "dompurify";
import { Code, FileCheck2, FlaskConical, Loader2, Lock, Play, RotateCcw } from "lucide-react";
import { C } from "./tokens";
import CodeTabs from "./CodeTabs";
// CodeToolbar (language dropdown + Multi-file / Single file chip + Run Code +
// Reset) has been retired. Its only two live actions — Run Code and Reset —
// now sit inline on the file-tab strip beside "Main.java", so the toolbar row
// is gone entirely. Language switching was already read-only for review
// (single-submission-single-language) so no functionality is lost.
import CodeEditor from "./CodeEditor";
import FileExplorer from "./FileExplorer";
import LanguageMark from "./LanguageMark";
import type { CodeTabId, ConsoleFile, ConsoleTestCase } from "./types";

interface CodeWorkspaceProps {
  activeTab: CodeTabId;
  onTabChange: (tab: CodeTabId) => void;

  /** The submission's files. One entry for a single-file answer, many for a
   *  project — either way the editor only ever shows ONE file's content. */
  files: ConsoleFile[];
  selectedPath: string;
  onSelectFile: (path: string) => void;
  onFileContentChange: (path: string, content: string) => void;

  language: string;
  languages: string[];
  onLanguageChange: (language: string) => void;
  /** Maps a console language key to a Monaco language id. */
  toMonacoLanguage: (language: string) => string;

  onRun: () => void;
  onReset: () => void;
  running: boolean;

  projectName: string;
  descriptionHtml: string;
  constraints: string[];
  hints: string[];
  testCases: ConsoleTestCase[];
  solution: string;

  /** Editor slab height in the normal (non-fullscreen) layout. */
  editorHeight: number;
  expanded: boolean;
  onToggleExpand: () => void;
}

function EmptyPanel({
  icon: Icon,
  title,
  hint,
  height,
}: {
  icon: typeof Code;
  title: string;
  hint: string;
  height: number | string;
}) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-2 bg-white px-6 text-center"
      style={{ height }}
    >
      <span className="flex h-11 w-11 items-center justify-center rounded-[10px] border border-[#E5E7EB] bg-[#F8FAFE]">
        <Icon className="h-5 w-5 text-[#8090AF]" />
      </span>
      <span className="text-[13.5px] font-semibold text-[#39496B]">{title}</span>
      <span className="max-w-[320px] text-[12.5px] font-medium text-[#8090AF]">{hint}</span>
    </div>
  );
}

export default function CodeWorkspace({
  activeTab,
  onTabChange,
  files,
  selectedPath,
  onSelectFile,
  onFileContentChange,
  language,
  languages,
  onLanguageChange,
  toMonacoLanguage,
  onRun,
  onReset,
  running,
  projectName,
  descriptionHtml,
  constraints,
  hints,
  testCases,
  solution,
  editorHeight,
  expanded,
  onToggleExpand,
}: CodeWorkspaceProps) {
  // DOMPurify touches `window`, so keep the raw string until the client mounts.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const safeDescription = useMemo(
    () => (mounted && descriptionHtml ? DOMPurify.sanitize(descriptionHtml) : ""),
    [mounted, descriptionHtml],
  );

  const activeFile = useMemo(
    () => files.find((f) => f.path === selectedPath) || files[0] || null,
    [files, selectedPath],
  );

  // Explorer only earns its 220px when there is a project to browse.
  const isProject = files.length > 1;
  const panelHeight = editorHeight;

  return (
    <section className="flex flex-none flex-col overflow-hidden rounded-[8px] border border-[#E5E7EB] bg-white">
      <CodeTabs active={activeTab} onChange={onTabChange} />

      {activeTab === "editor" && (
        <>
          {activeFile ? (
            <div className="flex" style={{ height: panelHeight }}>
              {isProject && (
                <FileExplorer
                  files={files}
                  selectedPath={activeFile.path}
                  onSelect={onSelectFile}
                  projectName={projectName}
                />
              )}

              <div className="flex min-w-0 flex-1 flex-col">
                {/* Open-file tab. Review is one file at a time, so there is a
                    single tab and nothing to close. Run Code + Reset used to
                    live on their own toolbar row above; they now share this
                    row so the trainer sees the file name and the two actions
                    on a single horizontal line. */}
                <div className="flex h-[34px] flex-none items-stretch justify-between border-b border-[#E7EEF8] bg-[#F8FAFE] pr-2">
                  <span className="relative flex items-center gap-1.5 border-r border-[#E7EEF8] bg-white px-3 text-[12.5px] font-medium text-[#0B1437]">
                    <span
                      className="absolute inset-x-0 top-0 h-[2px] bg-[#0667F9]"
                      aria-hidden
                    />
                    <LanguageMark language={activeFile.language} size={14} />
                    <span className="max-w-[240px] truncate" title={activeFile.path}>
                      {activeFile.name}
                    </span>
                  </span>

                  {/* Right-aligned action pair — same green Play + outlined
                      Reset the toolbar carried, just moved inline. Handlers,
                      disabled state, and running spinner are unchanged. */}
                  <div className="flex items-center gap-2 self-center">
                    <button
                      type="button"
                      onClick={onRun}
                      disabled={running || !activeFile?.content.trim()}
                      className="flex h-[26px] items-center gap-1.5 rounded-[6px] bg-[#09B96D] px-3 text-[12px] font-semibold text-white transition-colors hover:bg-[#059A5A] disabled:cursor-not-allowed disabled:bg-[#9CE0C3]"
                    >
                      {running ? (
                        <Loader2 className="h-[13px] w-[13px] animate-spin" />
                      ) : (
                        <Play className="h-[13px] w-[13px] fill-current" />
                      )}
                      {running ? "Running…" : "Run Code"}
                    </button>
                    <button
                      type="button"
                      onClick={onReset}
                      className="flex h-[26px] items-center gap-1.5 rounded-[6px] border border-[#E5E7EB] bg-white px-2.5 text-[12px] font-medium text-[#39496B] transition-colors hover:border-[#B9CDEA] hover:bg-[#F7FAFF]"
                    >
                      <RotateCcw className="h-[13px] w-[13px]" />
                      Reset
                    </button>
                  </div>
                </div>

                <div className="min-h-0 flex-1">
                  <CodeEditor
                    // Remount per file so Monaco never carries one file's
                    // undo stack or scroll position into another.
                    key={activeFile.path}
                    value={activeFile.content}
                    language={toMonacoLanguage(activeFile.language)}
                    height="100%"
                    readOnly={false}
                    onChange={(v) => onFileContentChange(activeFile.path, v)}
                    expanded={expanded}
                    onToggleExpand={onToggleExpand}
                  />
                </div>
              </div>
            </div>
          ) : (
            <div
              className="flex flex-col items-center justify-center gap-2 text-center"
              style={{ height: panelHeight, background: C.editorBg }}
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-[10px] bg-[#22303F]">
                <Code className="h-6 w-6 text-[#6C8099]" />
              </span>
              <span className="text-[13.5px] font-semibold text-[#A9BBCE]">
                No code submitted
              </span>
              <span className="max-w-[340px] text-[12.5px] font-medium text-[#6C8099]">
                The student has not submitted any code for this question yet.
              </span>
            </div>
          )}
        </>
      )}

      {activeTab === "problem" && (
        <div
          className="overflow-y-auto bg-white px-5 py-4 custom-scrollbar"
          style={{ height: panelHeight + 50 }}
        >
          {safeDescription ? (
            <div
              className="text-[13.5px] leading-[1.7] text-[#39496B] [&_code]:rounded [&_code]:bg-[#F1F5FB] [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[12.5px] [&_h1]:text-[15px] [&_h1]:font-bold [&_h2]:text-[14px] [&_h2]:font-bold [&_h3]:text-[13.5px] [&_h3]:font-semibold [&_img]:max-w-full [&_li]:my-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-2 [&_pre]:overflow-x-auto [&_pre]:rounded-[8px] [&_pre]:bg-[#F1F5FB] [&_pre]:p-3 [&_strong]:font-semibold [&_strong]:text-[#0B1437] [&_ul]:list-disc [&_ul]:pl-5"
              dangerouslySetInnerHTML={{ __html: safeDescription }}
            />
          ) : (
            <p className="text-[13px] font-medium text-[#8090AF]">
              No problem statement was recorded for this question.
            </p>
          )}

          {constraints.length > 0 && (
            <div className="mt-5">
              <h3 className="text-[13px] font-bold text-[#0B1437]">Constraints</h3>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-[13px] text-[#39496B]">
                {constraints.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            </div>
          )}

          {hints.length > 0 && (
            <div className="mt-5">
              <h3 className="text-[13px] font-bold text-[#0B1437]">Hints</h3>
              <ul className="mt-2 space-y-1.5">
                {hints.map((h, i) => (
                  <li
                    key={i}
                    className="rounded-[8px] border border-[#FDF0DF] bg-[#FFFBF5] px-3 py-2 text-[12.5px] text-[#8A5A11]"
                  >
                    {h}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {activeTab === "testcases" &&
        (testCases.length > 0 ? (
          <div
            className="overflow-y-auto bg-white px-5 py-4 custom-scrollbar"
            style={{ height: panelHeight + 50 }}
          >
            <ul className="space-y-2.5">
              {testCases.map((tc, i) => (
                <li key={i} className="overflow-hidden rounded-[8px] border border-[#E5E7EB]">
                  <div className="flex items-center justify-between border-b border-[#E7EEF8] bg-[#F8FAFE] px-3 py-1.5">
                    <span className="text-[12.5px] font-bold text-[#0B1437]">
                      Test Case {i + 1}
                    </span>
                    {tc.isHidden && (
                      <span className="inline-flex items-center gap-1 rounded-[5px] bg-[#EEF2F8] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#66789C]">
                        <Lock className="h-[10px] w-[10px]" />
                        Hidden
                      </span>
                    )}
                  </div>
                  <dl className="grid grid-cols-2 divide-x divide-[#E7EEF8]">
                    <div className="min-w-0 px-3 py-2">
                      <dt className="text-[11px] font-semibold uppercase tracking-wide text-[#8090AF]">
                        Input
                      </dt>
                      <dd className="mt-1 max-h-24 overflow-auto whitespace-pre-wrap break-words font-mono text-[12px] text-[#39496B]">
                        {tc.input || "—"}
                      </dd>
                    </div>
                    <div className="min-w-0 px-3 py-2">
                      <dt className="text-[11px] font-semibold uppercase tracking-wide text-[#8090AF]">
                        Expected Output
                      </dt>
                      <dd className="mt-1 max-h-24 overflow-auto whitespace-pre-wrap break-words font-mono text-[12px] text-[#39496B]">
                        {tc.expectedOutput || "—"}
                      </dd>
                    </div>
                  </dl>
                  {tc.explanation && (
                    <p className="border-t border-[#E7EEF8] px-3 py-2 text-[12px] italic text-[#66789C]">
                      {tc.explanation}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <EmptyPanel
            icon={FlaskConical}
            title="No test cases"
            hint="This question was authored without test cases."
            height={panelHeight + 50}
          />
        ))}

      {activeTab === "solution" &&
        (solution.trim() ? (
          <CodeEditor
            value={solution}
            language={toMonacoLanguage(language)}
            height={panelHeight + 50}
            readOnly
            expanded={expanded}
            onToggleExpand={onToggleExpand}
          />
        ) : (
          <EmptyPanel
            icon={FileCheck2}
            title="No reference solution"
            hint="No model answer was attached to this question."
            height={panelHeight + 50}
          />
        ))}
    </section>
  );
}
