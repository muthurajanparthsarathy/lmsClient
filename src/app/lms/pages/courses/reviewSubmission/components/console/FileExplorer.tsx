"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Folder, FolderOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import LanguageMark from "./LanguageMark";
import type { ConsoleFile } from "./types";

type TreeNode =
  | { kind: "folder"; name: string; path: string; children: TreeNode[] }
  | { kind: "file"; name: string; path: string; language: string };

/**
 * Builds the folder hierarchy from the submission's REAL file paths — no
 * invented folders. "src/services/UserService.java" becomes
 * src ▸ services ▸ UserService.java.
 */
export function buildTree(files: ConsoleFile[]): TreeNode[] {
  const root: TreeNode[] = [];

  for (const file of files) {
    const clean = file.path.replace(/^\/+/, "");
    const segments = clean.split("/").filter(Boolean);
    const fileName = segments.pop() || file.name;

    let level = root;
    let prefix = "";
    for (const segment of segments) {
      prefix = prefix ? `${prefix}/${segment}` : segment;
      let folder = level.find(
        (n): n is Extract<TreeNode, { kind: "folder" }> =>
          n.kind === "folder" && n.name === segment,
      );
      if (!folder) {
        folder = { kind: "folder", name: segment, path: prefix, children: [] };
        level.push(folder);
      }
      level = folder.children;
    }
    level.push({
      kind: "file",
      name: fileName,
      path: file.path,
      language: file.language,
    });
  }

  // Folders before files, each alphabetical — the ordering every IDE uses.
  const sort = (nodes: TreeNode[]): TreeNode[] => {
    nodes.sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === "folder" ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    for (const n of nodes) if (n.kind === "folder") sort(n.children);
    return nodes;
  };

  return sort(root);
}

interface FileExplorerProps {
  files: ConsoleFile[];
  selectedPath: string;
  onSelect: (path: string) => void;
  /** Label for the tree root, e.g. the question title. */
  projectName?: string;
}

export default function FileExplorer({
  files,
  selectedPath,
  onSelect,
  projectName = "submission",
}: FileExplorerProps) {
  const tree = useMemo(() => buildTree(files), [files]);

  const allFolders = useMemo(() => {
    const paths: string[] = [];
    const walk = (nodes: TreeNode[]) => {
      for (const n of nodes) {
        if (n.kind === "folder") {
          paths.push(n.path);
          walk(n.children);
        }
      }
    };
    walk(tree);
    return paths;
  }, [tree]);

  // Everything starts expanded: a grader opening a submission wants to see what
  // was handed in, not click through to find it.
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [rootOpen, setRootOpen] = useState(true);

  // A different submission is a different tree — drop stale collapse state.
  useEffect(() => {
    setCollapsed(new Set());
    setRootOpen(true);
  }, [allFolders.join("|")]);

  const toggle = (path: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });

  const renderNodes = (nodes: TreeNode[], depth: number) =>
    nodes.map((node) => {
      const indent = 10 + depth * 12;

      if (node.kind === "folder") {
        const open = !collapsed.has(node.path);
        return (
          <li key={node.path}>
            <button
              type="button"
              onClick={() => toggle(node.path)}
              aria-expanded={open}
              title={node.path}
              className="flex h-[29px] w-full items-center gap-1.5 pr-2 text-left text-[12.5px] font-medium text-[#39496B] transition-colors hover:bg-[#EDF3FD]"
              style={{ paddingLeft: indent }}
            >
              {open ? (
                <ChevronDown className="h-[13px] w-[13px] shrink-0 text-[#8090AF]" />
              ) : (
                <ChevronRight className="h-[13px] w-[13px] shrink-0 text-[#8090AF]" />
              )}
              {open ? (
                <FolderOpen className="h-[14px] w-[14px] shrink-0 text-[#6E8CBF]" />
              ) : (
                <Folder className="h-[14px] w-[14px] shrink-0 text-[#6E8CBF]" />
              )}
              <span className="truncate">{node.name}</span>
            </button>
            {open && <ul>{renderNodes(node.children, depth + 1)}</ul>}
          </li>
        );
      }

      const active = node.path === selectedPath;
      return (
        <li key={node.path}>
          <button
            type="button"
            onClick={() => onSelect(node.path)}
            aria-current={active ? "true" : undefined}
            title={node.path}
            className={cn(
              "relative flex h-[29px] w-full items-center gap-1.5 pr-2 text-left text-[12.5px] transition-colors",
              active
                ? "bg-[#EEF5FF] font-semibold text-[#0667F9]"
                : "font-medium text-[#39496B] hover:bg-[#EDF3FD]",
            )}
            style={{ paddingLeft: indent + 15 }}
          >
            {active && (
              <span className="absolute inset-y-0 left-0 w-[2px] bg-[#0667F9]" aria-hidden />
            )}
            <LanguageMark language={node.language} size={14} />
            <span className="truncate">{node.name}</span>
          </button>
        </li>
      );
    });

  return (
    <div className="flex w-[220px] shrink-0 flex-col overflow-hidden border-r border-[#E7EEF8] bg-[#FBFCFE]">
      <div className="flex h-[30px] flex-none items-center border-b border-[#E7EEF8] px-3">
        <span className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-[#8090AF]">
          Explorer
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto py-1 custom-scrollbar">
        <ul>
          <li>
            <button
              type="button"
              onClick={() => setRootOpen((v) => !v)}
              aria-expanded={rootOpen}
              title={projectName}
              className="flex h-[29px] w-full items-center gap-1.5 px-2 text-left text-[12px] font-bold uppercase tracking-[0.04em] text-[#53658C] transition-colors hover:bg-[#EDF3FD]"
            >
              {rootOpen ? (
                <ChevronDown className="h-[13px] w-[13px] shrink-0 text-[#8090AF]" />
              ) : (
                <ChevronRight className="h-[13px] w-[13px] shrink-0 text-[#8090AF]" />
              )}
              <span className="truncate">{projectName}</span>
            </button>
            {rootOpen && <ul>{renderNodes(tree, 1)}</ul>}
          </li>
        </ul>
      </div>
    </div>
  );
}
