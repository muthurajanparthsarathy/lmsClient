// SelectAssessmentContentStep.tsx
// Final step of the Create Assessment flow.
// Lets the teacher pick which course topics/subtopics the assessment covers
// (from the live course hierarchy), write assessment instructions, and review
// the security settings carried over from the Security step. The selected
// topics + instructions are persisted on the exercise so the student attend
// flow can scope and brief the test.
//
// Restyled 2026-09-01 to match the ExerciseSettings design system —
// two `SectionHeading` groups ("Covered topics" and "Instructions"), the
// step body wrapped in `StepShell`, and the descriptive subtitle sentences
// under each card title moved into an `InfoTooltip` on the heading.
import React, { useMemo, useState, useEffect, useRef } from "react";
import {
  Search, Folder, ChevronRight, ChevronDown, X, Info,
  Lock, MonitorSmartphone, Copy, RefreshCw, ScanFace, Shield, Eye, Check, Video,
} from "lucide-react";
import { SectionHeading, StepShell, InfoTooltip } from './UIComponents';

const ACCENT = "#7c3aed";
const ACCENT_BG = "#ede9fe";

export interface SelectedTopic { id: string; title: string; level: number; }

interface TreeNode {
  id: string;
  title: string;
  level: number;
  children: TreeNode[];
}

// Build a uniform tree out of the course's modules/subModules/topics/subTopics.
function buildTree(modules: any[]): TreeNode[] {
  const node = (raw: any, level: number): TreeNode => {
    const children: TreeNode[] = [];
    ;(raw?.subModules || []).forEach((c: any) => children.push(node(c, level + 1)));
    ;(raw?.topics || []).forEach((c: any) => children.push(node(c, level + 1)));
    ;(raw?.subTopics || []).forEach((c: any) => children.push(node(c, level + 1)));
    return {
      id: String(raw?._id || raw?.id || raw?.title || Math.random().toString(36).slice(2)),
      title: raw?.title || raw?.name || "Untitled",
      level,
      children,
    };
  };
  return (modules || []).map((m) => node(m, 0));
}

// Flatten for collecting all descendant ids of a node.
function descendantIds(node: TreeNode): string[] {
  return node.children.reduce<string[]>((acc, c) => [...acc, c.id, ...descendantIds(c)], []);
}

// Collect the ids of every node that has a selected descendant — i.e. the
// ancestors that must be expanded so a deeply-nested selected checkbox is
// actually visible (used to auto-reveal selections when editing).
function ancestorsOfSelected(nodes: TreeNode[], selectedIds: Set<string>): string[] {
  const result: string[] = [];
  const walk = (node: TreeNode): boolean => {
    let hasSelectedDesc = false;
    node.children.forEach((c) => { if (walk(c)) hasSelectedDesc = true; });
    if (hasSelectedDesc) result.push(node.id);
    return selectedIds.has(node.id) || hasSelectedDesc;
  };
  nodes.forEach(walk);
  return result;
}

interface Props {
  D: any;
  modules: any[];
  selectedTopics: SelectedTopic[];
  onChangeSelected: (next: SelectedTopic[]) => void;
  instructions: string;
  onChangeInstructions: (v: string) => void;
  securitySettings?: Record<string, any>;
  TipTapEditor: React.FC<any>;
}

// Security rows surfaced as a read-only summary (label + which formData key drives it).
const SECURITY_ROWS: { key: string; label: string; icon: React.ReactNode }[] = [
  { key: "preventBrowserClose", label: "Browser Lock", icon: <Lock size={15} /> },
  { key: "requireFullscreen", label: "Full Screen", icon: <MonitorSmartphone size={15} /> },
  { key: "preventCopyPaste", label: "Disable Copy Paste", icon: <Copy size={15} /> },
  { key: "preventTabSwitch", label: "Tab Switch Detection", icon: <RefreshCw size={15} /> },
  { key: "multipleFaceDetection", label: "Multiple Face Detection", icon: <ScanFace size={15} /> },
  { key: "faceMonitoringDetection", label: "Face Monitoring", icon: <Eye size={15} /> },
  { key: "enableFaceVerification", label: "AI Proctoring", icon: <Shield size={15} /> },
  { key: "screenRecordingEnabled", label: "Screen Recording", icon: <Video size={15} /> },
];

const SelectAssessmentContentStep: React.FC<Props> = ({
  D, modules, selectedTopics, onChangeSelected, instructions, onChangeInstructions,
  securitySettings = {}, TipTapEditor,
}) => {
  const tree = useMemo(() => buildTree(modules), [modules]);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    // Expand the first level by default so the hierarchy is visible.
    const s = new Set<string>();
    buildTree(modules).forEach((n) => s.add(n.id));
    return s;
  });

  const selectedIds = useMemo(() => new Set(selectedTopics.map((t) => t.id)), [selectedTopics]);

  // When editing, selected nodes may sit deep inside collapsed branches and be
  // invisible. Auto-expand every ancestor of a selected node the first time
  // selections arrive with a built tree, so the ticked checkboxes are visible.
  // Runs once (ref-guarded) so the user can freely collapse afterwards.
  const didAutoExpandRef = useRef(false);
  useEffect(() => {
    if (didAutoExpandRef.current) return;
    if (!tree.length || selectedIds.size === 0) return;
    const anc = ancestorsOfSelected(tree, selectedIds);
    if (anc.length) setExpanded((prev) => new Set([...prev, ...anc]));
    didAutoExpandRef.current = true;
  }, [tree, selectedIds]);

  const toggleExpand = (id: string) =>
    setExpanded((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const toggleSelect = (node: TreeNode) => {
    const isSel = selectedIds.has(node.id);
    if (isSel) {
      // Deselect this node and all its descendants.
      const remove = new Set([node.id, ...descendantIds(node)]);
      onChangeSelected(selectedTopics.filter((t) => !remove.has(t.id)));
    } else {
      // Select this node + all descendants (so picking a parent picks its children).
      const add: SelectedTopic[] = [{ id: node.id, title: node.title, level: node.level }];
      const collect = (n: TreeNode) => n.children.forEach((c) => { add.push({ id: c.id, title: c.title, level: c.level }); collect(c); });
      collect(node);
      const existing = new Set(selectedTopics.map((t) => t.id));
      onChangeSelected([...selectedTopics, ...add.filter((t) => !existing.has(t.id))]);
    }
  };

  // A node is "checked" if selected; "indeterminate" if some (not all) descendants selected.
  const checkState = (node: TreeNode): "checked" | "indeterminate" | "none" => {
    if (selectedIds.has(node.id)) return "checked";
    const desc = descendantIds(node);
    if (desc.length && desc.some((id) => selectedIds.has(id))) return "indeterminate";
    return "none";
  };

  const matches = (title: string) => !search.trim() || title.toLowerCase().includes(search.trim().toLowerCase());
  // A node is visible if it matches the search OR any descendant matches.
  const nodeVisible = (node: TreeNode): boolean =>
    matches(node.title) || node.children.some(nodeVisible);

  const renderNode = (node: TreeNode): React.ReactNode => {
    if (!nodeVisible(node)) return null;
    const state = checkState(node);
    const hasChildren = node.children.length > 0;
    const isOpen = expanded.has(node.id) || !!search.trim();
    return (
      <div key={node.id}>
        <div
          className="flex items-center gap-1.5 py-1.5 rounded-lg hover:bg-[#faf9ff] transition-colors"
          style={{ paddingLeft: node.level * 18 + 4 }}
        >
          {hasChildren ? (
            <button type="button" onClick={() => toggleExpand(node.id)} className="w-4 h-4 flex items-center justify-center flex-shrink-0" style={{ color: D.textMuted }}>
              {isOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
            </button>
          ) : (
            <span className="w-4 flex-shrink-0" />
          )}
          <button
            type="button"
            onClick={() => toggleSelect(node)}
            className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0 border transition-all"
            style={{
              borderColor: state === "none" ? "#cbd5e1" : ACCENT,
              background: state === "checked" ? ACCENT : state === "indeterminate" ? ACCENT_BG : "#fff",
            }}
          >
            {state === "checked" && <Check size={11} className="text-white" strokeWidth={3} />}
            {state === "indeterminate" && <span style={{ width: 8, height: 2, background: ACCENT, borderRadius: 1 }} />}
          </button>
          <Folder size={13} style={{ color: D.textMuted, flexShrink: 0 }} />
          <span
            className="text-[13px] cursor-pointer select-none truncate"
            style={{ color: state === "checked" ? ACCENT : D.textMain, fontWeight: node.level === 0 ? 600 : 500 }}
            onClick={() => toggleSelect(node)}
            title={node.title}
          >
            {node.title}
          </span>
        </div>
        {hasChildren && isOpen && node.children.map(renderNode)}
      </div>
    );
  };

  return (
    <StepShell>
      {/* ── Covered topics ────────────────────────────────────────────────── */}
      <SectionHeading
        right={
          <div className="relative" style={{ width: 240 }}>
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: D.textMuted }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search topics…"
              className="w-full pl-7 pr-3 h-9 text-[12px] rounded-lg outline-none"
              style={{ background: "#fff", border: `1px solid ${D.border2}`, color: D.textMain }}
            />
          </div>
        }
      >
        <span className="inline-flex items-center gap-1">
          Covered topics <span style={{ color: D.orange, fontWeight: 700 }}>*</span>
          <InfoTooltip content="Select one or more topics and subtopics for this assessment." />
        </span>
      </SectionHeading>

      <div className="grid grid-cols-2 gap-4">
        {/* Tree */}
        <div className="rounded-xl p-2 overflow-y-auto ca-dark-scroll" style={{ border: `1px solid ${D.border2}`, minHeight: 280, maxHeight: 360, background: "#fff" }}>
          {tree.length === 0 ? (
            <div className="h-full flex items-center justify-center text-xs" style={{ color: D.textMuted, minHeight: 240 }}>No course hierarchy found.</div>
          ) : (
            tree.map(renderNode)
          )}
        </div>

        {/* Selected panel */}
        <div className="rounded-xl p-3 flex flex-col" style={{ border: `1px solid ${D.border2}`, minHeight: 280, maxHeight: 360, background: D.surface }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[13px] font-semibold" style={{ color: D.textMain }}>
              Selected <span style={{ color: D.textMuted }}>({selectedTopics.length})</span>
            </span>
            {selectedTopics.length > 0 && (
              <button type="button" onClick={() => onChangeSelected([])} className="text-[12px] font-semibold" style={{ color: ACCENT }}>Clear All</button>
            )}
          </div>
          <div className="flex-1 overflow-y-auto ca-dark-scroll">
            {selectedTopics.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-center px-4" style={{ color: D.textMuted }}>No topics selected yet. Pick topics from the hierarchy on the left.</div>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {selectedTopics.map((t) => (
                  <span key={t.id} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[12px] font-medium" style={{ background: ACCENT_BG, color: ACCENT }}>
                    {t.title}
                    <button type="button" onClick={() => onChangeSelected(selectedTopics.filter((s) => s.id !== t.id))}><X size={11} /></button>
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center gap-1.5 mt-2 pt-2 text-[11px]" style={{ borderTop: `1px solid ${D.border}`, color: D.textMuted }}>
            <Info size={12} /> You can select multiple topics and subtopics
          </div>
        </div>
      </div>

      {/* ── Instructions ─────────────────────────────────────────────────── */}
      <div style={{ marginTop: 20 }}>
        <SectionHeading>
          <span className="inline-flex items-center gap-1">
            Instructions <span style={{ color: D.orange, fontWeight: 700 }}>*</span>
            <InfoTooltip content="Provide clear instructions for the assessment." />
          </span>
        </SectionHeading>
        <TipTapEditor
          value={instructions}
          onChange={(v: string) => onChangeInstructions(v)}
          placeholder="Enter instructions for the assessment…"
          minHeight="220px"
          maxHeight="400px"
          showToolbar
          editable
        />
      </div>
    </StepShell>
  );
};

export default SelectAssessmentContentStep;
