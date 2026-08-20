"use client";

// Shared tree-selector consumed by PermissionModal and BulkPermissionModal.
//
// Renders `PERMISSION_TREE` as expandable rows: container → page → function.
// The selection state is a flat map keyed by page id (`Record<pageId, Set<fnId>>`)
// — the same shape storage uses — so callers can persist without any
// transformation. A page with no function children is still selectable
// (page-level access).
//
// UX rules encoded here:
//   1. Toggling a page ON auto-selects every function whose `defaultSelected`
//      is true (per spec: Export User, View Details, View Client Mapping,
//      My Calendar, Manage Holidays, Mark, Analytics, Manage, Start).
//   2. Toggling a page OFF clears all its functions and removes the entry.
//   3. Toggling a container acts on every page under it (cascade).
//   4. Container checkboxes are tri-state: none / some / all children granted.
//   5. Selecting a function without the parent page auto-enables the page.

import { useMemo, useState, type ReactNode } from "react";
import { Check, ChevronDown, ChevronRight } from "lucide-react";
import {
  PERMISSION_TREE,
  type PermissionCategory,
  type PermissionNode,
} from "@/config/permissions.tree";
import { categoryOf, walkTree } from "@/config/permissions.helpers";

// A page is "allowed" when the institution allow-list contains its id OR any
// of its aliases (so legacy stored ids like "admin-coursemanagement" resolve
// to the renamed tree page "admin-course-manage").
function pageAllowed(node: PermissionNode, allowedIds?: string[]): boolean {
  if (!allowedIds) return true;
  const ids = new Set(allowedIds.map((s) => s.trim().toLowerCase()));
  if (ids.has(node.id.trim().toLowerCase())) return true;
  return (node.aliases ?? []).some((a) => ids.has(a.trim().toLowerCase()));
}

// A function is "allowed" when the per-page allow-list contains its id OR any
// alias — same reasoning as pageAllowed but for the leaf level.
function fnAllowed(
  node: PermissionNode,
  perPageAllow: string[] | undefined,
): boolean {
  if (!perPageAllow) return true;
  const ids = new Set(perPageAllow.map((s) => s.trim().toLowerCase()));
  if (ids.has(node.id.trim().toLowerCase())) return true;
  return (node.aliases ?? []).some((a) => ids.has(a.trim().toLowerCase()));
}

// Whether a subtree renders anything after filtering — used to hide empty
// containers so their siblings don't appear (visually) nested underneath.
function branchHasVisibleContent(
  node: PermissionNode,
  q: string,
  allowedIds?: string[],
): boolean {
  if (!nodeMatchesSearch(node, q)) return false;
  if (node.kind === "page") return pageAllowed(node, allowedIds);
  if (!node.children?.length) return false;
  return node.children.some((c) => branchHasVisibleContent(c, q, allowedIds));
}

// ─── Public selection shape ───────────────────────────────────────────────

export type SelectionState = Record<string, Set<string>>;

export interface TreeSelectorProps {
  selection: SelectionState;
  onChange: (next: SelectionState) => void;
  /** "all" | "admin" | "staff" | "student" — narrows the visible roots. */
  category?: PermissionCategory | "all";
  /** Search filter — matches container / page / function names. */
  search?: string;
  /** When provided, hides tree ids not in the list (institution allow-list). */
  allowedIds?: string[];
  /** When provided, hides functions per page not in the given id set. */
  allowedFunctions?: Record<string, string[]>;
}

// ─── Derived helpers ──────────────────────────────────────────────────────

// Pages under a subtree, breadth-first.
function pagesUnder(node: PermissionNode): PermissionNode[] {
  const out: PermissionNode[] = [];
  const stack: PermissionNode[] = [node];
  while (stack.length) {
    const n = stack.shift()!;
    if (n.kind === "page") out.push(n);
    if (n.children?.length) stack.push(...n.children);
  }
  return out;
}

function defaultFnIds(page: PermissionNode): string[] {
  return (page.children ?? [])
    .filter((c) => c.kind === "function" && c.defaultSelected)
    .map((c) => c.id);
}

// Container check state: "none" | "some" | "all"
function branchState(
  branch: PermissionNode,
  selection: SelectionState,
): "none" | "some" | "all" {
  const pages = pagesUnder(branch);
  if (!pages.length) return "none";
  let granted = 0;
  for (const p of pages) if (selection[p.id]) granted++;
  if (granted === 0) return "none";
  if (granted === pages.length) return "all";
  return "some";
}

// ─── Tick control ─────────────────────────────────────────────────────────

function Tick({
  state,
  onClick,
  size = 14,
}: {
  state: "none" | "some" | "all";
  onClick: (e: React.MouseEvent) => void;
  size?: number;
}) {
  const on = state !== "none";
  return (
    <div
      onClick={onClick}
      role="checkbox"
      aria-checked={state === "all" ? true : state === "some" ? "mixed" : false}
      style={{ width: size, height: size }}
      className={`shrink-0 rounded border-2 flex items-center justify-center cursor-pointer transition-colors ${
        on
          ? "bg-orange-500 border-transparent"
          : "border-gray-300 dark:border-gray-600 hover:border-gray-400 bg-white dark:bg-gray-800"
      }`}
    >
      {state === "all" && (
        <Check style={{ width: size * 0.6, height: size * 0.6 }} className="text-white" strokeWidth={3} />
      )}
      {state === "some" && (
        <span style={{ width: size * 0.5, height: 2 }} className="bg-white rounded" />
      )}
    </div>
  );
}

// ─── Selection mutators ───────────────────────────────────────────────────

function togglePage(
  sel: SelectionState,
  page: PermissionNode,
  filterFns?: string[],
): SelectionState {
  const next = { ...sel };
  if (next[page.id]) {
    delete next[page.id];
  } else {
    const defaults = defaultFnIds(page);
    const usable = filterFns
      ? defaults.filter((d) => filterFns.includes(d))
      : defaults;
    next[page.id] = new Set(usable);
  }
  return next;
}

function toggleFunction(
  sel: SelectionState,
  page: PermissionNode,
  fnId: string,
): SelectionState {
  const next = { ...sel };
  const bag = new Set(next[page.id] ?? []);
  if (bag.has(fnId)) bag.delete(fnId);
  else bag.add(fnId);
  // Enabling a function implies enabling its page; clearing every function
  // leaves page-level access intact so the user still has the screen open.
  next[page.id] = bag;
  return next;
}

function toggleBranch(
  sel: SelectionState,
  branch: PermissionNode,
  filterPages?: string[],
  filterFns?: Record<string, string[]>,
): SelectionState {
  const state = branchState(branch, sel);
  const next = { ...sel };
  const pages = pagesUnder(branch).filter(
    (p) => !filterPages || filterPages.includes(p.id),
  );
  if (state === "all") {
    for (const p of pages) delete next[p.id];
  } else {
    for (const p of pages) {
      if (next[p.id]) continue;
      const defaults = defaultFnIds(p);
      const usable = filterFns?.[p.id]
        ? defaults.filter((d) => filterFns[p.id].includes(d))
        : defaults;
      next[p.id] = new Set(usable);
    }
  }
  return next;
}

// ─── Filter / search ──────────────────────────────────────────────────────

function nodeMatchesSearch(node: PermissionNode, q: string): boolean {
  if (!q) return true;
  const hay = [node.name, node.id, ...(node.aliases ?? [])].join(" ").toLowerCase();
  if (hay.includes(q)) return true;
  return (node.children ?? []).some((c) => nodeMatchesSearch(c, q));
}

function isInCategory(
  node: PermissionNode,
  parents: PermissionNode[],
  cat: PermissionCategory | "all",
): boolean {
  if (cat === "all") return true;
  return categoryOf([...parents, node]) === cat;
}

// ─── Indentation ──────────────────────────────────────────────────────────
//
// ONE step per nesting level, applied ONCE — by the wrapper a parent puts
// around its children. Rows themselves keep a constant padding and never add
// `depth * n` of their own.
//
// That double-count is what this replaces. Containers indented at
// `8 + depth * 18` INSIDE a wrapper already offset by `12 + depth * 18`, while
// pages used a different step (`depth * 16`) and their function grid a third
// (`20 + depth * 16`). The steps disagreed and the depth was counted twice, so
// by the third level a function's checkbox landed slightly LEFT of its own
// page's checkbox — "Add Client" sitting outdented from "Client Management".
//
// The target, with every level exactly one step in from its parent:
//
//   Business Management
//       Client Management
//           Add Client
//
const INDENT_STEP = 20;

// Row geometry, so the offsets below are derived rather than eyeballed.
// A container/page row starts at ROW_PAD and renders a chevron plus the flex
// gap before its checkbox. A function row has neither — it carries its own
// label padding instead. Every children wrapper draws a 1px rail, which sits
// inside its margin and pushes content over by that much.
const ROW_PAD = 8;
const CHEVRON_W = 16;
const ROW_GAP = 8;
const FN_LABEL_PAD = 8;
const RAIL_W = 1;
// A function label carries `border` (transparent until selected) — 1px that
// still occupies layout, so it counts toward the offset like the rail does.
const FN_LABEL_BORDER = 1;

/** How far a container/page row's checkbox sits from that row's left edge. */
const ROW_TICK_X = ROW_PAD + CHEVRON_W + ROW_GAP;                        // 32
/** Margin on a children wrapper — one step, less the rail it draws. */
const CHILD_WRAP_INDENT = INDENT_STEP - RAIL_W;                          // 19
/** Margin on a page's function grid — one step past that page's checkbox. */
const FN_GRID_INDENT =
    ROW_TICK_X + INDENT_STEP - RAIL_W - FN_LABEL_PAD - FN_LABEL_BORDER; // 42

// ─── Rendering ────────────────────────────────────────────────────────────

interface RowState {
  expanded: Record<string, boolean>;
  setExpanded: (next: Record<string, boolean>) => void;
}

function ContainerRow({
  node,
  parents,
  selection,
  onChange,
  rowState,
  allowedIds,
  allowedFunctions,
  q,
  depth,
}: {
  node: PermissionNode;
  parents: PermissionNode[];
  selection: SelectionState;
  onChange: (s: SelectionState) => void;
  rowState: RowState;
  allowedIds?: string[];
  allowedFunctions?: Record<string, string[]>;
  q: string;
  depth: number;
}) {
  const isOpen = rowState.expanded[node.id] ?? true;
  const state = branchState(node, selection);
  // Distinguish root roles (Admin/Trainer/Student) from nested containers
  // (Business Management, Course Management) so the hierarchy reads at a
  // glance instead of relying on indentation alone.
  const isRoot = depth === 0;
  return (
    <div className={isRoot ? "mb-3" : "mb-2"}>
      <div
        className={
          isRoot
            ? "flex items-center gap-2 px-2 py-2 rounded-md bg-gray-100/70 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700"
            : "flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer"
        }
        style={{ paddingLeft: ROW_PAD }}
      >
        <button
          type="button"
          onClick={() =>
            rowState.setExpanded({ ...rowState.expanded, [node.id]: !isOpen })
          }
          className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
        >
          {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>
        <Tick
          state={state}
          onClick={(e) => {
            e.stopPropagation();
            onChange(
              toggleBranch(
                selection,
                node,
                allowedIds,
                allowedFunctions,
              ),
            );
          }}
        />
        <span
          className={
            isRoot
              ? "text-sm font-bold uppercase tracking-wide text-gray-800 dark:text-gray-100"
              : "text-sm font-semibold text-gray-900 dark:text-gray-100"
          }
        >
          {node.name}
        </span>
        {state !== "none" && (
          <span className="ml-auto text-[10px] font-semibold text-orange-600 dark:text-orange-400 uppercase tracking-wide">
            {state === "all" ? "all" : "partial"}
          </span>
        )}
      </div>
      {isOpen && node.children?.length ? (
        // Left-border rail makes the parent → child relationship unambiguous
        // even when siblings render at the same indent depth.
        <div
          className="mt-1 border-l border-gray-200 dark:border-gray-700"
          style={{ marginLeft: CHILD_WRAP_INDENT }}
        >
          {node.children.map((child) =>
            renderNode({
              node: child,
              parents: [...parents, node],
              selection,
              onChange,
              rowState,
              allowedIds,
              allowedFunctions,
              q,
              depth: depth + 1,
            }),
          )}
        </div>
      ) : null}
    </div>
  );
}

// A page row carries no depth of its own: whatever container wraps it has
// already applied the indent for this level.
function PageRow({
  node,
  selection,
  onChange,
  rowState,
  allowedFunctions,
}: {
  node: PermissionNode;
  selection: SelectionState;
  onChange: (s: SelectionState) => void;
  rowState: RowState;
  allowedFunctions?: Record<string, string[]>;
}) {
  const enabled = !!selection[node.id];
  // Resolve the per-page allow-list via node.id first, then any alias — so an
  // institution config saved under the legacy id still constrains functions.
  const fnFilter =
    allowedFunctions?.[node.id] ??
    (node.aliases ?? []).map((a) => allowedFunctions?.[a]).find(Boolean);
  const functions = (node.children ?? [])
    .filter((c) => c.kind === "function")
    .filter((c) => fnAllowed(c, fnFilter));
  const grantedCount = selection[node.id]?.size ?? 0;
  const totalFns = functions.length;
  const isOpen = rowState.expanded[node.id] ?? enabled;
  return (
    <div className="mb-1.5">
      <div
        className={`flex items-center gap-2 px-2 py-1.5 rounded-md ${
          enabled
            ? "bg-orange-50 dark:bg-orange-950/30"
            : "hover:bg-gray-50 dark:hover:bg-gray-800/50"
        }`}
        style={{ paddingLeft: ROW_PAD }}
      >
        {totalFns > 0 ? (
          <button
            type="button"
            onClick={() =>
              rowState.setExpanded({ ...rowState.expanded, [node.id]: !isOpen })
            }
            className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
          >
            {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
        ) : (
          <span className="w-4 h-4" />
        )}
        <Tick
          state={
            enabled
              ? grantedCount === totalFns && totalFns > 0
                ? "all"
                : totalFns === 0
                  ? "all"
                  : grantedCount > 0
                    ? "some"
                    : "all"
              : "none"
          }
          onClick={(e) => {
            e.stopPropagation();
            onChange(togglePage(selection, node, fnFilter));
          }}
        />
        <span
          className={`text-sm ${enabled ? "font-semibold text-gray-900 dark:text-gray-100" : "text-gray-700 dark:text-gray-300"}`}
        >
          {node.name}
        </span>
        {totalFns > 0 && enabled && (
          <span className="ml-auto text-[10px] font-semibold text-orange-600 dark:text-orange-400">
            {grantedCount}/{totalFns}
          </span>
        )}
      </div>
      {isOpen && functions.length > 0 && (
        <div
          className="mt-1 grid grid-cols-1 sm:grid-cols-2 gap-1 border-l border-gray-200 dark:border-gray-700"
          style={{ marginLeft: FN_GRID_INDENT }}
        >
          {functions.map((f) => {
            const on = selection[node.id]?.has(f.id) ?? false;
            return (
              <label
                key={f.id}
                onClick={() => onChange(toggleFunction(selection, node, f.id))}
                className={`flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer border ${
                  on
                    ? "bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800 text-orange-700 dark:text-orange-300"
                    : "border-transparent hover:bg-gray-50 dark:hover:bg-gray-800/50 text-gray-600 dark:text-gray-400"
                }`}
              >
                <Tick state={on ? "all" : "none"} onClick={(e) => { e.stopPropagation(); onChange(toggleFunction(selection, node, f.id)); }} size={12} />
                <span className="text-xs font-medium leading-none">
                  {f.name}
                  {f.defaultSelected && (
                    <span className="ml-1.5 text-[9px] uppercase tracking-wide text-emerald-600 dark:text-emerald-400 font-bold">default</span>
                  )}
                </span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}

function renderNode(args: {
  node: PermissionNode;
  parents: PermissionNode[];
  selection: SelectionState;
  onChange: (s: SelectionState) => void;
  rowState: RowState;
  allowedIds?: string[];
  allowedFunctions?: Record<string, string[]>;
  q: string;
  depth: number;
}): ReactNode {
  const { node, allowedIds, q } = args;
  if (!nodeMatchesSearch(node, q)) return null;
  if (node.kind === "container") {
    // Hide the whole container when nothing under it survives filtering — the
    // old behavior of leaving an empty heading made subsequent siblings appear
    // (visually) nested under it.
    if (!branchHasVisibleContent(node, q, allowedIds)) return null;
    return <ContainerRow key={node.id} {...args} />;
  }
  if (node.kind === "page") {
    if (!pageAllowed(node, allowedIds)) return null;
    return <PageRow key={node.id} node={node} selection={args.selection} onChange={args.onChange} rowState={args.rowState} allowedFunctions={args.allowedFunctions} />;
  }
  return null;
}

// ─── Component ────────────────────────────────────────────────────────────

export function TreePermissionSelector({
  selection,
  onChange,
  category = "all",
  search = "",
  allowedIds,
  allowedFunctions,
}: TreeSelectorProps) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const q = search.trim().toLowerCase();

  // Root containers, filtered by category.
  const roots = useMemo(() => {
    return PERMISSION_TREE.filter((root) => isInCategory(root, [], category));
  }, [category]);

  return (
    <div className="text-sm">
      {roots.map((root) =>
        renderNode({
          node: root,
          parents: [],
          selection,
          onChange,
          rowState: { expanded, setExpanded },
          allowedIds,
          allowedFunctions,
          q,
          depth: 0,
        }),
      )}
    </div>
  );
}

// ─── (De)serializers for the flat storage shape ───────────────────────────

// Convert the stored `[{ id, permissionFunctionality }]` array into the
// SelectionState the tree uses. Legacy stored ids and function labels resolve
// via `findPage` / aliases at read time; on save we always emit the tree ids.
//
// Match strategy for the page (in order):
//   1. stored.id equals a tree page id
//   2. stored.id equals any tree page's alias
//   3. stored.permissionKey equals a tree page's `key`
//   4. stored.permissionKey equals a tree page id or alias
// Rules (3) + (4) are what make real DB rows work — the stored shape carries
// permissionKey + no `id`, and without a key fallback every row is dropped.
export function selectionFromStored(
  stored: Array<{
    id?: string;
    permissionKey?: string;
    permissionFunctionality?: string[];
    isActive?: boolean;
  }>,
): SelectionState {
  const out: SelectionState = {};
  const pages: PermissionNode[] = [];
  walkTree((n) => {
    if (n.kind === "page") pages.push(n);
  });
  const norm = (s: string) => s.trim().toLowerCase();

  const resolvePage = (
    idField?: string,
    keyField?: string,
    nameField?: string,
  ): PermissionNode | undefined => {
    // Prefer id, then alias, then key. When the key matches multiple pages
    // (admin-profile / staff-profile / student-profile all use "profile"),
    // disambiguate by `permissionName` — the tree pages' unique display names
    // (e.g. "Trainer Profile", "Student Notification") are what we emitted
    // on save, so a round-trip lands on the correct scope.
    if (idField) {
      const id = norm(idField);
      const byId = pages.find((p) => norm(p.id) === id);
      if (byId) return byId;
      const byAlias = pages.find((p) =>
        (p.aliases ?? []).some((a) => norm(a) === id),
      );
      if (byAlias) return byAlias;
    }
    if (keyField) {
      const key = norm(keyField);
      const keyMatches = pages.filter((p) => p.key && norm(p.key) === key);
      if (keyMatches.length === 1) return keyMatches[0];
      if (keyMatches.length > 1 && nameField) {
        const name = norm(nameField);
        const byName = keyMatches.find(
          (p) =>
            norm(p.name) === name ||
            (p.aliases ?? []).some((a) => norm(a) === name),
        );
        if (byName) return byName;
      }
      if (keyMatches.length >= 1) return keyMatches[0];
      const byIdViaKey = pages.find(
        (p) =>
          norm(p.id) === key ||
          (p.aliases ?? []).some((a) => norm(a) === key),
      );
      if (byIdViaKey) return byIdViaKey;
    }
    return undefined;
  };

  for (const s of stored) {
    if (s.isActive === false) continue;
    const page = resolvePage(s.id, s.permissionKey, (s as any).permissionName);
    if (!page) continue;
    const bag = new Set<string>();
    const fns = (page.children ?? []).filter((c) => c.kind === "function");
    for (const stLabel of s.permissionFunctionality ?? []) {
      const match = fns.find(
        (f) =>
          norm(f.id) === norm(stLabel) ||
          (f.aliases ?? []).some((a) => norm(a) === norm(stLabel)),
      );
      if (match) bag.add(match.id);
    }
    // Preserve page-level access even when none of the stored function labels
    // survived the tree cull — the row itself is still granted.
    out[page.id] = bag;
  }
  return out;
}

// Emit the storage shape from a SelectionState. Each selected page becomes
// one entry; a page with no functions still emits an entry (page-level
// access). Order stable = tree order.
export function storedFromSelection(
  selection: SelectionState,
): Array<{
  id: string;
  permissionName: string;
  permissionKey: string;
  permissionFunctionality: string[];
  icon: string;
  color: string;
  description: string;
  isActive: boolean;
  order: number;
}> {
  const order: string[] = [];
  const meta: Record<string, PermissionNode> = {};
  walkTree((n) => {
    if (n.kind === "page") {
      order.push(n.id);
      meta[n.id] = n;
    }
  });
  const out: Array<any> = [];
  order.forEach((id, idx) => {
    if (!selection[id]) return;
    const n = meta[id];
    out.push({
      id: n.id,
      permissionName: n.name,
      permissionKey: n.key || n.id,
      permissionFunctionality: Array.from(selection[id]),
      icon: n.icon || "Shield",
      color: n.color || "slate",
      description: n.description || "",
      isActive: true,
      order: idx,
    });
  });
  return out;
}
