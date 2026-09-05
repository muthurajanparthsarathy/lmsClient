"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, X, ArrowLeft, ChevronRight, ChevronDown, Check,
  GraduationCap, Dumbbell, Users, HelpCircle, Download, SearchX,
  Printer, FileSpreadsheet, FileText, Layers,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import DashboardLayout from "@/app/lms/component/layout";
import { StaffLayout } from "@/app/lms/component/stafflayout/staff-layout";
import { pageEnter } from "@/app/lms/shared/ui";
import TableFooter from "@/app/lms/shared/listing/TableFooter";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
  DropdownMenuLabel, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { headersFor } from "./components/gradeHelpers";
import { ExerciseCells, StudentCells, QuestionCells } from "./components/GradeRows";
import StudentDetailsDrawer from "./components/StudentDetailsDrawer";
import { api } from "@/app/lms/pages/clientmanagement/lib/apiClient";
import { courseDataApi } from "@/apiServices/coursesData";
import { CourseSidebar } from "@/app/lms/pages/courses/uploadcourseresources/components/Coursesidebar";
import { transformToCourseNodes, findPathToNode } from "@/app/lms/pages/courses/uploadcourseresources/components/courseTree";
import type { CourseNode } from "@/app/lms/pages/courses/uploadcourseresources/components/Types";

// The Poppins next/font wrapper this file used to declare is gone — the root
// layout self-hosts the same font app-wide, so this page inherits it via the
// shell just like Course Setup and User Management do.

// ─── Floating-label modern select ─────────────────────────────────────────
// Small custom listbox. The plain HTML <select> renders the OS chrome (the
// dropdown menu isn't styleable), which read as "old" on this design
// system. This is the same button + portal-less popover pattern the shared
// ODropdown uses in the assessment wizards — no external deps, keyboard-
// friendly, brand-styled, with a floating label that lifts to a small chip
// at the top of the field once a value is picked (Material-style; the
// label doubles as the field's context so the button text can stay
// value-only).
type FloatingSelectOption = { value: string; label: string };
function FloatingSelect({
  label, value, onChange, options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: FloatingSelectOption[];
}) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const active = options.find(o => o.value === value) || options[0];
  // Label floats when a real (non-default) value is picked OR while the
  // menu is open — mirrors the standard Material text-field behaviour.
  const isDefault = value === options[0]?.value;
  const floated = open || !isDefault;

  return (
    <div className="relative">
      <button
        ref={btnRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
        className={`relative inline-flex items-center h-8 min-w-[140px] pl-3 pr-8 rounded-control border text-xs font-medium transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-brand/15 ${
          !isDefault
            ? "border-brand bg-brand-wash text-brand-strong"
            : open
              ? "border-brand bg-surface text-heading"
              : "border-hairline-strong bg-surface text-body hover:bg-row-hover hover:text-heading"
        }`}
      >
        {/* Floating label — sits inside the field when the trailing button
            is at its default value, lifts to a small chip on the border
            when a real value is picked or the menu is open. Kept in the
            painted flow (position:absolute) so its animation reads as one
            element moving, not two swapping. */}
        <span
          className={`pointer-events-none absolute left-2 select-none transition-all duration-150 ${
            floated
              ? "-top-1.5 text-2xs font-semibold px-1 leading-none bg-surface " + (!isDefault ? "text-brand-strong" : "text-subtle")
              : "top-1/2 -translate-y-1/2 text-xs text-faint font-medium"
          }`}
        >
          {label}
        </span>
        {/* Value — only shown once the label has floated up, otherwise the
            label reads AS the value. */}
        {floated && <span className="truncate">{active?.label ?? ""}</span>}
        <ChevronDown
          size={14}
          className={`absolute right-2 top-1/2 -translate-y-1/2 transition-transform duration-150 ${open ? "rotate-180" : ""} ${!isDefault ? "text-brand-strong" : "text-faint"}`}
        />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            ref={menuRef}
            role="listbox"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.12 }}
            className="absolute z-popover mt-1 right-0 min-w-full w-max max-w-[220px] rounded-tile border border-hairline bg-surface shadow-lg py-1 overflow-hidden"
          >
            {options.map(opt => {
              const on = opt.value === value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  role="option"
                  aria-selected={on}
                  onClick={() => { onChange(opt.value); setOpen(false); }}
                  className={`w-full flex items-center gap-2 px-2.5 py-2 text-sm font-medium text-left transition-colors duration-150 ${
                    on ? "bg-brand-wash text-brand-strong" : "text-body hover:bg-row-hover hover:text-heading"
                  }`}
                >
                  <span className="flex-1 truncate">{opt.label}</span>
                  {on && <Check size={14} className="text-brand-strong shrink-0" />}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Floating-label multi-select ─────────────────────────────────────────
// Same visual language as FloatingSelect, but the menu is a checklist and
// the button's value is a string[]. Used by the Activity filter: both
// options default to checked so the initial render lists every exercise
// (rather than the trainer having to opt-in to see any rows), and the button
// summarises the picked set — one selected → that option's label, both
// selected → the joinAll fallback ("Assignment/Assessment"), none selected →
// treated the same as both (no filter applied) so an accidental deselect
// can't empty the whole list. `defaultAll` compares by length: when the
// current value covers every option, the field is styled as "at rest"
// (default state, no orange border) — otherwise it is "filtered" and lifts
// to brand orange.
type FloatingMultiSelectOption = { value: string; label: string };
function FloatingMultiSelect({
  label, value, onChange, options, joinAll,
}: {
  label: string;
  value: string[];
  onChange: (v: string[]) => void;
  options: FloatingMultiSelectOption[];
  joinAll?: string;
}) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // "At rest" when all options are picked (or none — see the type
  // comment). The button then reads as the neutral default state.
  const isAll = value.length === 0 || value.length === options.length;
  const summary = (() => {
    if (isAll) return joinAll || options.map(o => o.label).join("/");
    if (value.length === 1) {
      const one = options.find(o => o.value === value[0]);
      return one?.label || label;
    }
    return `${value.length} selected`;
  })();
  const floated = open || !isAll || value.length !== options.length;

  const toggle = (v: string) => {
    const has = value.includes(v);
    // Effective set (empty is treated as "all", so unhide it into the real
    // array before toggling so the click always changes something visible).
    const base = value.length === 0 ? options.map(o => o.value) : value;
    const next = has ? base.filter(x => x !== v) : [...base, v];
    onChange(next);
  };

  return (
    <div className="relative">
      <button
        ref={btnRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
        className={`relative inline-flex items-center h-8 min-w-[160px] pl-3 pr-8 rounded-control border text-xs font-medium transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-brand/15 ${
          !isAll
            ? "border-brand bg-brand-wash text-brand-strong"
            : open
              ? "border-brand bg-surface text-heading"
              : "border-hairline-strong bg-surface text-body hover:bg-row-hover hover:text-heading"
        }`}
      >
        <span
          className={`pointer-events-none absolute left-2 select-none transition-all duration-150 ${
            floated
              ? "-top-1.5 text-2xs font-semibold px-1 leading-none bg-surface " + (!isAll ? "text-brand-strong" : "text-subtle")
              : "top-1/2 -translate-y-1/2 text-xs text-faint font-medium"
          }`}
        >
          {label}
        </span>
        {floated && <span className="truncate">{summary}</span>}
        <ChevronDown
          size={14}
          className={`absolute right-2 top-1/2 -translate-y-1/2 transition-transform duration-150 ${open ? "rotate-180" : ""} ${!isAll ? "text-brand-strong" : "text-faint"}`}
        />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            ref={menuRef}
            role="listbox"
            aria-multiselectable="true"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.12 }}
            className="absolute z-popover mt-1 right-0 min-w-full w-max max-w-[260px] rounded-tile border border-hairline bg-surface shadow-lg py-1 overflow-hidden"
          >
            {options.map(opt => {
              const on = value.length === 0 || value.includes(opt.value);
              return (
                <button
                  key={opt.value}
                  type="button"
                  role="option"
                  aria-selected={on}
                  onClick={() => toggle(opt.value)}
                  className={`w-full flex items-center gap-2 px-2.5 py-2 text-sm font-medium text-left transition-colors duration-150 ${
                    on ? "bg-brand-wash text-brand-strong" : "text-body hover:bg-row-hover hover:text-heading"
                  }`}
                >
                  {/* Native-style checkbox glyph, brand-tinted when on. */}
                  <span
                    aria-hidden="true"
                    className={`inline-flex items-center justify-center size-4 rounded border transition-colors duration-150 shrink-0 ${
                      on ? "border-brand-strong bg-brand-strong" : "border-hairline-strong bg-surface"
                    }`}
                  >
                    {on && <Check size={11} strokeWidth={3} className="text-white" />}
                  </span>
                  <span className="flex-1 truncate">{opt.label}</span>
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * Props for embedding this flow inside another screen.
 *
 * The Grade action on the We_Do Assignment / You_Do Assessment menus opens
 * this flow IN PLACE — same URL, same syllabus rail, only the content panel
 * swaps — exactly the way "Manage Exercise" opens the question list. Embedded
 * mode therefore takes its context from props instead of the URL, and returns
 * its content bare so the host screen's shell is the only shell.
 *
 * With no props this is the standalone route (`/lms/pages/grades/<courseId>`
 * and its section mirrors), which reads the same context from the URL and
 * wraps itself in the admin shell. Both modes share every line below.
 */
export interface GradesFlowProps {
  /** Render bare (no shell) for a host screen that already has one. */
  embedded?: boolean;
  /** Course to grade. Falls back to the `grades/<id>` path segment. */
  courseId?: string;
  /** Jump straight to this exercise. Falls back to `?exerciseId=`. */
  exerciseId?: string;
  /** Tab to open on. Falls back to `?openTab=`. */
  openTab?: "exercises" | "students" | "questions";
  /** Embedded Back handler. Falls back to `?returnTo=` / router.back(). */
  onBack?: () => void;
}

// Main Component
export default function GradesFlow({
  embedded = false,
  courseId: courseIdProp,
  exerciseId: exerciseIdProp,
  openTab: openTabProp,
  onBack,
}: GradesFlowProps = {}) {
  const router = useRouter();
  // Where the trainer came from — the Course Actions Grade menu stamps this
  // as `?returnTo=<encoded URL>` so the top-level Back button can go BACK
  // there (usually `/lms/pages/coursestructure?openMappingId=…`) instead of
  // to the client picker at /lms/pages/grades, which the trainer never
  // wants to see. Only accept path-only URLs (must start with "/") so a
  // stray external value can't turn this into an open-redirect.
  const searchParams = useSearchParams();
  const rawReturnTo = searchParams?.get("returnTo") || "";
  const returnTo = rawReturnTo.startsWith("/") ? rawReturnTo : "";
  // Deep-link: `?exerciseId=X&openTab=students` lets a caller (the You_Do
  // Assessment three-dot menu, or We_Do Assignment's) jump straight to
  // the student list for one specific exercise, skipping the exercises
  // picker step. `Back` from students still returns to exercises inside
  // the same page — the deep-link only preloads the state, doesn't
  // hijack the back navigation.
  // Props win over the URL so the embedded host can drive the flow directly.
  const deepLinkExerciseId = exerciseIdProp || searchParams?.get("exerciseId") || "";
  const deepLinkOpenTab = openTabProp
    || (searchParams?.get("openTab") as "exercises" | "students" | "questions" | null)
    || null;

  // Needed by the Overall report, which fetches each exercise's student list
  // on demand (through the cache) rather than mounting a query per exercise.
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<"exercises" | "students" | "questions">("exercises");
  const [courseId, setCourseId] = useState<string | null>(courseIdProp ?? null);
  const [selectedExercise, setSelectedExercise] = useState<any>(null);
  const [selectedStudent, setSelectedStudent] = useState<any>(null);

  // Filter states
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  // Activity is a MULTI-select now — both We_Do and You_Do are checked by
  // default so the initial list shows every exercise on the course. Empty
  // and full-set both mean "no filter applied" (see FloatingMultiSelect).
  const SECTION_OPTIONS_ALL = ["We_Do", "You_Do"] as const;
  const [sectionFilter, setSectionFilter] = useState<string[]>([...SECTION_OPTIONS_ALL]);
  const [difficultyFilter, setDifficultyFilter] = useState("all");
  // Filters live inline on the toolbar now — no drawer, no toggle.
  const [passFailFilter, setPassFailFilter] = useState("all");

  // Presentation-only state (selection + drawers)
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [detailStudent, setDetailStudent] = useState<any>(null);


  // Extract courseId from URL. (Pre-existing pattern — this route reads the
  // dynamic segment off window.location rather than useParams(); left as-is,
  // out of scope for this pass.)
  useEffect(() => {
    if (courseIdProp) return; // embedded host already told us the course
    if (typeof window !== 'undefined') {
      const path = window.location.pathname;
      const parts = path.split('/');
      const courseIdIndex = parts.indexOf('grades') + 1;
      if (courseIdIndex < parts.length) {
        setCourseId(parts[courseIdIndex]);
      }
    }
  }, [courseIdProp]);

  // ── Syllabus rail ──────────────────────────────────────────────────────
  // When Grade is opened from INSIDE the course syllabus screen (the We_Do
  // Assignment / You_Do Assessment three-dot menus on
  // `…/uploadcourseresources`), the trainer is mid-journey inside one node of
  // the syllabus. Swapping the left rail out for the generic admin sidebar
  // there loses their place, so we mount the SAME CourseSidebar the resources
  // screen uses, inside the same StaffLayout shell.
  //
  // The signal is `returnTo` pointing back at an uploadcourseresources URL —
  // that param is only stamped by those in-syllabus menus, and it carries the
  // nodeId the trainer had open. Grade reached any other way (the course-row
  // Actions menu on the Course Structure list, or the standalone
  // /lms/pages/grades picker) has no such origin and keeps the admin shell.
  const syllabusReturn = useMemo(() => {
    if (!returnTo.includes("uploadcourseresources")) return null;
    // `returnTo` is already validated as path-only above, so a fixed base is
    // enough — and avoids touching `window` during the server prerender.
    try {
      const url = new URL(returnTo, "http://localhost");
      return { path: url.pathname, params: url.searchParams };
    } catch { return null; }
  }, [returnTo]);
  const showSyllabusRail = !!syllabusReturn;
  const syllabusNodeId = syllabusReturn?.params.get("nodeId") || "";

  // Same query the resources screen uses, so arriving from it is a cache hit
  // (identical key: ["course-light", id, activeBatchId]) and the rail paints
  // with no spinner. Disabled entirely when we're not showing the rail.
  const { data: courseLightResponse } = useQuery({
    ...courseDataApi.getLight(courseId || ""),
    enabled: showSyllabusRail && !!courseId,
  });
  const syllabusTree = useMemo<CourseNode[]>(
    () => (courseLightResponse?.data ? transformToCourseNodes(courseLightResponse.data) : []),
    [courseLightResponse?.data],
  );

  // Rail-local UI state. Deliberately NOT persisted to the `lms_expanded_nodes`
  // / `lms_selected_node_id` localStorage keys the resources screen writes:
  // those are global (not course-scoped), and having a read-only rail write to
  // them would clobber the trainer's real navigation state on the screen they
  // are about to return to.
  const [railExpanded, setRailExpanded] = useState<Set<string>>(new Set());
  const [railWidth, setRailWidth] = useState(280);
  const [railSearch, setRailSearch] = useState("");
  const [railResizing, setRailResizing] = useState(false);

  // Open the tree to the node the trainer came from, once, when it lands.
  const railSeededRef = useRef(false);
  useEffect(() => {
    if (railSeededRef.current || !syllabusTree.length) return;
    railSeededRef.current = true;
    const seed = new Set<string>([syllabusTree[0].id]);
    if (syllabusNodeId) {
      findPathToNode(syllabusTree, syllabusNodeId)?.forEach(id => seed.add(id));
    }
    setRailExpanded(seed);
  }, [syllabusTree, syllabusNodeId]);

  const railSelectedNode = useMemo(() => {
    if (!syllabusNodeId || !syllabusTree.length) return null;
    const walk = (nodes: CourseNode[]): CourseNode | null => {
      for (const n of nodes) {
        if (n.id === syllabusNodeId) return n;
        const hit = n.children && walk(n.children);
        if (hit) return hit;
      }
      return null;
    };
    return walk(syllabusTree);
  }, [syllabusTree, syllabusNodeId]);

  // Drag-to-resize, same clamp the resources screen uses.
  useEffect(() => {
    if (!railResizing) return;
    const onMove = (e: MouseEvent) => setRailWidth(Math.min(500, Math.max(200, e.clientX)));
    const onUp = () => setRailResizing(false);
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
  }, [railResizing]);

  // Clicking a node leaves Grades and reopens the syllabus screen on that
  // node — the rail here is a way back into the course, not a second place to
  // grade from. Rebuilt off `returnTo` so every other param the trainer had
  // (activeTab, subcategory, batch) round-trips; only nodeId is swapped.
  const openSyllabusNode = (node: CourseNode) => {
    if (!syllabusReturn) return;
    const next = new URLSearchParams(syllabusReturn.params);
    next.set("nodeId", node.id);
    router.push(`${syllabusReturn.path}?${next.toString()}`);
  };

  // ── Data queries ───────────────────────────────────────────────────────
  // Three-level drill-down (exercises → students → questions), each keyed by
  // its parent selection so revisiting an already-viewed exercise/student
  // paints from cache instead of refetching. `courseData` hits a route that
  // 404s on this server build (verified live) — the endpoint predates this
  // pass and its result (page title/breadcrumb) already has a fallback, so
  // behavior is unchanged: preserved as-is rather than guessing the intended
  // replacement route.
  const courseDataQuery = useQuery<any>({
    queryKey: ["grades", "course", courseId],
    queryFn: () => api.get(`/course/${courseId}`),
    enabled: !!courseId,
  });
  const courseData = courseDataQuery.data?.data?.course ?? null;

  const exercisesQuery = useQuery<any[]>({
    queryKey: ["grades", "exercises", courseId],
    queryFn: async () => {
      const res: any = await api.get(`/course/${courseId}/exercises`);
      if (!res?.success) throw new Error("Failed to load exercises");
      return res.data?.exercises || [];
    },
    enabled: !!courseId,
  });
  const exercises = exercisesQuery.data ?? [];

  // Deep-link hydration: when the URL says `exerciseId=X&openTab=students`
  // AND the exercises list has landed, pick that row and jump to the
  // Students tab. Fires ONCE per deep-link visit (guarded by the ref so
  // hitting Back inside the page doesn't re-trigger the jump). If the id
  // doesn't match anything in the current course's exercises the effect
  // does nothing — the exercises picker stays visible and the trainer
  // can see the list as if they arrived without a deep link.
  const deepLinkAppliedRef = useRef<string | null>(null);
  // True when a deep link brings the trainer straight to Students or Questions
  // without ever seeing the Exercises picker. Back on the Students tab drills
  // up to Exercises by default, but when the trainer never opened Exercises
  // in the first place that "up" step lands them at a list they didn't ask
  // to see — so we treat Back as "exit to returnTo" in that case, and only
  // fall back to the drill trail once they've actually visited Exercises
  // (either by clicking the Exercises breadcrumb chip or by drilling deeper
  // to Questions and coming back through the trail).
  const bypassedExercisesRef = useRef<boolean>(
    !!(deepLinkExerciseId && (deepLinkOpenTab === "students" || deepLinkOpenTab === "questions")),
  );
  useEffect(() => {
    if (!deepLinkExerciseId) return;
    if (deepLinkAppliedRef.current === deepLinkExerciseId) return;
    if (!exercises || exercises.length === 0) return;
    const ex = exercises.find((e: any) => (e._id || e.id) === deepLinkExerciseId);
    if (!ex) return;
    deepLinkAppliedRef.current = deepLinkExerciseId;
    setSelectedExercise(ex);
    if (deepLinkOpenTab === "students" || deepLinkOpenTab === "questions") {
      setActiveTab(deepLinkOpenTab);
    } else {
      setActiveTab("students");
    }
  }, [deepLinkExerciseId, deepLinkOpenTab, exercises]);

  const studentsQuery = useQuery<any[]>({
    queryKey: ["grades", "students", courseId, selectedExercise?._id],
    queryFn: async () => {
      const res: any = await api.get(`/exercises/${courseId}/${selectedExercise._id}/students`);
      if (!res?.success) throw new Error("Failed to load students");
      return res.data?.students || [];
    },
    enabled: !!courseId && !!selectedExercise,
    // Marks and submissions change the moment a student submits or a trainer
    // grades, so this must revalidate rather than trust a cached copy — the
    // app-wide default is `refetchOnMount: false`, which meant a browser that
    // had loaded this list once kept painting it for the whole staleTime and
    // never noticed newer scores. "always" is invisible when data is already
    // cached: React Query keeps showing it and swaps in the fresh response
    // when it lands, so there is no skeleton and no navigation overlay.
    refetchOnMount: "always" as const,
  });
  const students = studentsQuery.data ?? [];

  const questionsQuery = useQuery<any[]>({
    queryKey: ["grades", "questions", courseId, selectedStudent?._id, selectedExercise?._id],
    queryFn: async () => {
      const res: any = await api.get(
        `/course/${courseId}/student/${selectedStudent._id}/exercise/${selectedExercise._id}/questions`
      );
      if (!res?.success) throw new Error("Failed to load questions");
      return res.data?.questions || [];
    },
    enabled: !!courseId && !!selectedStudent && !!selectedExercise,
    // Marks and submissions change the moment a student submits or a trainer
    // grades, so this must revalidate rather than trust a cached copy — the
    // app-wide default is `refetchOnMount: false`, which meant a browser that
    // had loaded this list once kept painting it for the whole staleTime and
    // never noticed newer scores. "always" is invisible when data is already
    // cached: React Query keeps showing it and swaps in the fresh response
    // when it lands, so there is no skeleton and no navigation overlay.
    refetchOnMount: "always" as const,
  });
  const questions = questionsQuery.data ?? [];

  // Single loading flag mirroring the old shared `loading` state — only the
  // active tab's query drives the skeleton.
  const loading =
    activeTab === "exercises" ? exercisesQuery.isPending :
    activeTab === "students" ? studentsQuery.isPending :
    questionsQuery.isPending;

  // Get filtered data based on active tab and filters
  const filteredData = useMemo(() => {
    const data = activeTab === "exercises" ? exercises :
      activeTab === "students" ? students :
        questions;

    if (!data || data.length === 0) return [];

    return data.filter((item: any) => {
      // Search filter
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        let matchesSearch = false;

        if (activeTab === "exercises") {
          matchesSearch =
            (item.exerciseName?.toLowerCase().includes(searchLower) ?? false) ||
            (item.entity?.title?.toLowerCase().includes(searchLower) ?? false);
        } else if (activeTab === "students") {
          matchesSearch =
            (item.name?.toLowerCase().includes(searchLower) ?? false) ||
            (item.email?.toLowerCase().includes(searchLower) ?? false);
        } else if (activeTab === "questions") {
          matchesSearch =
            (item.title?.toLowerCase().includes(searchLower) ?? false) ||
            (item.description?.toLowerCase().includes(searchLower) ?? false);
        }

        if (!matchesSearch) return false;
      }

      // Status filter
      if (statusFilter !== "all") {
        let matchesStatus = false;

        if (activeTab === "exercises") {
          matchesStatus = item.status === statusFilter;
        } else if (activeTab === "students") {
          // Match against the DERIVED two-state status so the filter
          // agrees with the badge on the row: a student with server
          // status "in_progress" but real marks reads as Completed
          // (see the derivation in StudentCells), and picking
          // "Completed" here surfaces them.
          {
            const p = item.exerciseProgress || {};
            const raw = String(p.status || "").toLowerCase();
            const serverDone = raw === "completed" || raw === "evaluated" || raw === "submitted";
            // Same derivation as StudentCells / the exporter — see the note
            // there on why the totals are summed from questionAttempts.
            const atts: any[] = Array.isArray(p.questionAttempts) ? p.questionAttempts : [];
            const total = atts.length
              ? atts.reduce((sum, q) => sum + (Number(q?.score) || 0), 0)
              : Number(p.overallScore) || 0;
            const totalQ = Number(
              p.questionsTotal ?? p.totalQuestions ?? selectedExercise?.totalQuestions
              ?? selectedExercise?.questions?.length ?? atts.length ?? 0,
            ) || 0;
            const attendedQ = Number(
              p.questionsAttempted ?? p.attemptedQuestions ?? p.attendedQuestions
              ?? p.completedCount ?? p.completedQuestions ?? p.answeredQuestions
              ?? (Number(p.completionPercentage) > 0 && totalQ > 0
                    ? Math.round((Number(p.completionPercentage) / 100) * totalQ) : 0),
            ) || 0;
            const derived = serverDone || total > 0 || attendedQ > 0 ? "completed" : "not_started";
            matchesStatus = derived === statusFilter;
          }
        } else if (activeTab === "questions") {
          // Two-state match — presence/absence of studentAttempt maps to
          // the "Submitted / Not attempted" badge on the row, and picking
          // "submitted" surfaces every attempted question (the row cell
          // reads submitted for any studentAttempt, so the filter reads
          // the same way).
          const attempted = !!item.studentAttempt;
          matchesStatus = statusFilter === "submitted" ? attempted
            : statusFilter === "not_attempted" ? !attempted
              : true;
        }

        if (!matchesStatus) return false;
      }

      // Pass/Fail filter for students tab
      if (activeTab === "students" && passFailFilter !== "all") {
        const isPassing = item.exerciseProgress?.isPassing;
        if (passFailFilter === "pass" && !isPassing) return false;
        if (passFailFilter === "fail" && isPassing !== false) return false;
      }

      // Section filter (for exercises only)
      if (activeTab === "exercises" && sectionFilter.length > 0 && sectionFilter.length < SECTION_OPTIONS_ALL.length) {
        // Empty or full-set = no filter. A subset filters strictly by
        // whether the row's section is in the picked list.
        if (!sectionFilter.includes(item.section)) return false;
      }

      // Difficulty filter (for questions only)
      if (activeTab === "questions" && difficultyFilter !== "all") {
        if (item.difficulty !== difficultyFilter) return false;
      }

      return true;
    });
  }, [activeTab, exercises, students, questions, searchTerm, statusFilter, sectionFilter, difficultyFilter, passFailFilter]);

  // ── Pagination ─────────────────────────────────────────────────────────
  // Auto-fit page size — same pattern Course Setup and Client Management
  // use. Measures the table wrapper's height and picks the largest page
  // size whose rows still fit inside it, so the pager sits flush at the
  // bottom of the panel with no in-body scroll. Rows that don't fit spill
  // to the next page. Client-side slicing: the queries above already
  // fetched the whole list, so page changes are instant.
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const tableCardRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = tableCardRef.current;
    if (!el) return;
    // Reserved chrome inside the workspace card. Numbers here are the
    // TRUE rendered heights including borders and subpixel padding — the
    // earlier estimates undershot enough that the last row was landing
    // half-clipped under the footer's top-border line:
    //   • header  h-9 + border-b            ≈ 40px
    //   • footer  border-t + py-2 + content ≈ 44px
    //   • row     h-11 + border-b (+subpx)  ≈ 46px
    // SAFETY (12px) is one row's worth of border-plus-cushion — small
    // enough to avoid losing a whole slot, large enough that when the
    // real container is one pixel shorter than the ideal, the last row
    // still renders fully instead of half-hiding under the pager rule.
    const HEADER_H = 40;
    const FOOTER_H = 44;
    const ROW_H = 46;
    const SAFETY = 12;
    // Floor of 7 rows. Auto-fit alone was landing on 6 in the embedded panel,
    // which wastes a visible slot and pushes a 20-student list to four pages.
    // The body scrolls (see the table wrapper) rather than clipping, so when a
    // short viewport genuinely cannot show seven the extra row is still
    // reachable instead of hidden under the pager.
    const MIN_ROWS = 7;
    const compute = () => {
      const budget = Math.max(0, el.clientHeight - HEADER_H - FOOTER_H - SAFETY);
      const fits = Math.max(MIN_ROWS, Math.min(50, Math.floor(budget / ROW_H)));
      setPageSize((prev) => (prev === fits ? prev : fits));
    };
    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(el);
    return () => ro.disconnect();
  }, [activeTab]); // remeasure on tab switch (row heights are the same but the container may resize with new content)
  const totalFiltered = filteredData.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const rangeStart = totalFiltered === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const rangeEnd = Math.min(safePage * pageSize, totalFiltered);
  const pagedData = useMemo(
    () => filteredData.slice((safePage - 1) * pageSize, safePage * pageSize),
    [filteredData, safePage, pageSize],
  );
  // Reset to page 1 on any filter / search / sort / tab change so the
  // trainer doesn't land on an out-of-range page after narrowing. Section
  // is depended on via its stringified form because it's now a string[] —
  // setState always hands out a fresh array reference, but only length /
  // ordering matter for "did the filter actually change".
  const sectionFilterKey = sectionFilter.slice().sort().join(",");
  useEffect(() => { setCurrentPage(1); }, [
    activeTab, searchTerm, statusFilter, sectionFilterKey, difficultyFilter, passFailFilter,
  ]);
  useEffect(() => { setCurrentPage((p) => Math.min(p, totalPages)); }, [totalPages]);

  const handleSelectExercise = (exercise: any) => {
    setSelectedExercise(exercise);
    setActiveTab("students");
    setStatusFilter("all");
    setPassFailFilter("all");
    setSearchTerm("");
    setSelectedIds([]);
  };

  const handleSelectStudent = (student: any) => {
    setSelectedStudent(student);
    setActiveTab("questions");
    setStatusFilter("all");
    setDifficultyFilter("all");
    setSearchTerm("");
    setSelectedIds([]);
  };

  const handleBackToExercises = () => {
    // The trainer chose to open the Exercises tab — the deep-linked bypass
    // no longer applies. Subsequent Back-from-Students should now drill up
    // to Exercises normally instead of exiting to returnTo.
    bypassedExercisesRef.current = false;
    setActiveTab("exercises");
    setSelectedExercise(null);
    setSelectedStudent(null);
    setSearchTerm("");
    setStatusFilter("all");
    setSectionFilter([...SECTION_OPTIONS_ALL]);
    setDifficultyFilter("all");
    setPassFailFilter("all");
    setSelectedIds([]);
  };

  const handleBackToStudents = () => {
    setActiveTab("students");
    setSelectedStudent(null);
    setSearchTerm("");
    setStatusFilter("all");
    setDifficultyFilter("all");
    setPassFailFilter("all");
    setSelectedIds([]);
  };

  // Get filter options based on active tab
  const getFilterOptions = () => {
    switch (activeTab) {
      case "exercises":
        return {
          statusOptions: [
            { value: "all", label: "All Status" },
            { value: "active", label: "Active" },
            { value: "inactive", label: "Inactive" }
          ],
          sectionOptions: [
            { value: "all", label: "All Sections" },
            { value: "I_Do", label: "I Do" },
            { value: "We_Do", label: "We Do" },
            { value: "You_Do", label: "You Do" }
          ]
        };
      case "students":
        return {
          // Two-state model (Completed / Not Started) — matches the row
          // status badge. "In Progress" and the redundant "Evaluated"
          // entry are gone; anything the trainer wants to see as done
          // lands under Completed.
          statusOptions: [
            { value: "all", label: "All Status" },
            { value: "completed", label: "Completed" },
            { value: "not_started", label: "Not Started" },
          ],
          passFailOptions: [
            { value: "all", label: "All Students" },
            { value: "pass", label: "Pass" },
            { value: "fail", label: "Fail" }
          ]
        };
      case "questions":
        return {
          // Two-state model — matches the on-screen Status column (which now
          // reads Submitted / Not attempted, having replaced the older
          // Solved / Partially Solved / Failed / Not Attempted split). The
          // filter must offer the same set the row can show, or picking a
          // value that doesn't map to a badge just silently empties the list.
          statusOptions: [
            { value: "all", label: "All Status" },
            { value: "submitted", label: "Submitted" },
            { value: "not_attempted", label: "Not attempted" },
          ],
          difficultyOptions: [
            { value: "all", label: "All Difficulty" },
            { value: "easy", label: "Easy" },
            { value: "medium", label: "Medium" },
            { value: "hard", label: "Hard" }
          ]
        };
      default:
        return { statusOptions: [], sectionOptions: [], difficultyOptions: [] };
    }
  };

  const filterOptions = getFilterOptions();

  const clearAllFilters = () => {
    setSearchTerm("");
    setStatusFilter("all");
    setSectionFilter([...SECTION_OPTIONS_ALL]);
    setDifficultyFilter("all");
    setPassFailFilter("all");
  };

  // Section is "active" (a filter is applied) when only ONE of the two
  // options is picked. Both picked or nothing picked = "no filter".
  const sectionFiltered = sectionFilter.length > 0 && sectionFilter.length < SECTION_OPTIONS_ALL.length;
  const hasActiveFilters = statusFilter !== "all" || sectionFiltered || difficultyFilter !== "all" || passFailFilter !== "all";
  const activeFilterCount =
    (statusFilter !== "all" ? 1 : 0) + (sectionFiltered ? 1 : 0) +
    (difficultyFilter !== "all" ? 1 : 0) + (passFailFilter !== "all" ? 1 : 0);

  // ── Breadcrumb path — DRILL trail only (Course › Exercise › Student › Tab) ──
  //
  // Dashboard and Grades used to lead this trail. They were link chips that
  // pointed back at /lms/pages/studentdashboard and /lms/pages/grades — the
  // client/course picker. That picker no longer belongs in a trainer's flow:
  // Grade is entered per-course from the Course Actions dropdown on
  // /lms/pages/coursestructure (course context already in hand), so linking
  // BACK to a picker would send the trainer somewhere they didn't come from.
  //
  // Trail is empty on the first exercises view (no course name yet, nothing
  // to drill from). The Back button in the toolbar still handles the drill.
  const crumbs = useMemo(() => {
    const items: { title: string; icon: React.ElementType; onClick?: () => void }[] = [];
    // Embedded, the host already names the course and the section above this
    // panel, so the trail carries only what the host does NOT show: which
    // assignment is being graded, and — once drilled in — whose answers these
    // are. Standalone keeps the course crumb, since nothing else supplies it.
    if (!embedded && courseData) items.push({ title: courseData.name || "Course", icon: GraduationCap });
    if (selectedExercise) items.push({ title: selectedExercise.exerciseName, icon: Dumbbell, onClick: handleBackToExercises });
    if (selectedStudent) items.push({ title: selectedStudent.name, icon: Users, onClick: handleBackToStudents });
    // Tab leaf only when there's a drill above it — a lone "Exercises" crumb
    // with nothing before it read as trivial.
    if (items.length > 0) {
      items.push({
        title: activeTab === "exercises" ? "Exercises" : activeTab === "students" ? "Students" : "Questions",
        icon: activeTab === "exercises" ? Dumbbell : activeTab === "students" ? Users : HelpCircle,
      });
    }
    return items;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [embedded, courseData, selectedExercise, selectedStudent, activeTab]);

  // ── Summary chips per tab ──
  const chips = useMemo(() => {
    if (activeTab === "exercises") {
      const active = exercises.filter(e => (e.status || "active") === "active").length;
      return [
        { label: "Exercises", value: exercises.length, dot: "bg-brand-500" },
        { label: "Active", value: active, dot: "bg-success-500" },
        // Neutral gray dot — the strip already carries brand-orange (Exercises),
        // green (Active), and gray (Points). A fourth blue dot for Questions
        // was the only off-palette accent on this row and pulled the eye
        // toward "info" for a count that isn't semantically an info state.
        { label: "Questions", value: exercises.reduce((s, e) => s + (e.totalQuestions || 0), 0), dot: "bg-ink-400" },
        { label: "Points", value: exercises.reduce((s, e) => s + (e.totalPoints || 0), 0), dot: "bg-ink-400" },
      ];
    }
    if (activeTab === "students") {
      const passing = students.filter(s => s.exerciseProgress?.isPassing).length;
      const failing = students.filter(s => s.exerciseProgress?.isPassing === false && (s.exerciseProgress?.overallScore || 0) > 0).length;
      const avg = students.length ? Math.round(students.reduce((a, s) => a + (s.exerciseProgress?.completionPercentage || 0), 0) / students.length) : 0;
      return [
        { label: "Students", value: students.length, dot: "bg-brand-500" },
        { label: "Passing", value: passing, dot: "bg-success-500" },
        { label: "Failing", value: failing, dot: "bg-danger-500" },
        { label: "Avg progress", value: `${avg}%`, dot: "bg-ink-400" },
      ];
    }
    const solved = questions.filter(q => q.studentAttempt?.status === "solved").length;
    const partial = questions.filter(q => q.studentAttempt?.status === "partially_solved").length;
    const failed = questions.filter(q => q.studentAttempt?.status === "failed").length;
    return [
      { label: "Questions", value: questions.length, dot: "bg-brand-500" },
      { label: "Solved", value: solved, dot: "bg-success-500" },
      { label: "Partial", value: partial, dot: "bg-warn-500" },
      { label: "Failed", value: failed, dot: "bg-danger-500" },
    ];
  }, [activeTab, exercises, students, questions]);

  // ── Selection (students tab) + CSV export ──
  const rowId = (item: any) => item._id || item.id;
  const allVisibleIds = filteredData.map(rowId);
  const allSelected = allVisibleIds.length > 0 && allVisibleIds.every(id => selectedIds.includes(id));
  const someSelected = allVisibleIds.some(id => selectedIds.includes(id));
  const toggleAll = () => setSelectedIds(allSelected ? selectedIds.filter(id => !allVisibleIds.includes(id)) : Array.from(new Set([...selectedIds, ...allVisibleIds])));
  const toggleOne = (id: string) => setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  // ── Rows-to-export helper ─────────────────────────────────────────────
  // Reused by the bulk-select "Export" buttons, the toolbar Export
  // dropdown, and the Print handler. Priority: explicit selection > the
  // current filtered set > every row. Columns match the on-screen table
  // for that tab so a print/export never disagrees with what is visible.
  const buildExportRows = () => {
    // Exercises tab — the assignment/assessment list. Selection wins,
    // otherwise the currently filtered set (respects search + We_Do /
    // You_Do filter). "Type" column carries the section (Assignment /
    // Assessment) so an export of the mixed list keeps the split visible
    // even without the on-screen filter chip.
    if (activeTab === "exercises") {
      const source: any[] = selectedIds.length
        ? exercises.filter((e: any) => selectedIds.includes(rowId(e)))
        : filteredData;
      return source.map((e: any, i: number) => ({
        "#": i + 1,
        Type: e.section === "We_Do" ? "Assignment"
          : e.section === "You_Do" ? "Assessment"
          : "Exercise",
        "Assignment/Assessment": e.exerciseName || "",
        "Total Questions": Number(e.totalQuestions) || 0,
        "Total Marks": Number(e.totalPoints) || 0,
        Status: String(e.status || "active").replace(/\b\w/g, (c: string) => c.toUpperCase()),
      }));
    }
    // Questions tab — one row per question on this student's attempt.
    // Columns mirror the on-screen QuestionCells: #, Question, Difficulty,
    // Mark Scored (X/Y), Attempts, Status (Submitted / Not attempted).
    if (activeTab === "questions") {
      return filteredData.map((q: any, i: number) => ({
        "#": i + 1,
        Question: q.title || "",
        Difficulty: (q.difficulty || "medium").replace(/\b\w/g, (c: string) => c.toUpperCase()),
        "Mark Scored": `${q.studentAttempt?.score || 0}/${q.score || 0}`,
        Attempts: q.studentAttempt?.attempts || 0,
        Status: q.studentAttempt ? "Submitted" : "Not attempted",
      }));
    }
    // Students tab — bulk selection wins, otherwise the current filtered
    // set, otherwise the full list.
    const source: any[] =
      selectedIds.length ? students.filter(s => selectedIds.includes(rowId(s)))
        : activeTab === "students" ? filteredData
          : students;
    return source.map((s, i) => studentExportRow(s, i, selectedExercise));
  };

  // One student → one export row. Extracted from buildExportRows so the
  // Overall report (which walks EVERY exercise, not just the selected one)
  // derives its student rows through exactly the same rules — a single
  // definition means a nested Overall row can never disagree with the
  // per-exercise Student List it mirrors.
  //
  // `exercise` is passed in rather than read off `selectedExercise` because
  // Overall has a different exercise in hand on every iteration.
  const studentExportRow = (s: any, i: number, exercise: any) => {
    const p = s.exerciseProgress || {};
    // Mirrors StudentCells exactly so an export can never disagree with the
    // table it was taken from: totals summed from the per-question attempts
    // (per-question scores are strings, so the server's own `overallScore`
    // reduce used to concatenate rather than add), and the real
    // `questionsTotal` / `questionsAttempted` field names.
    const atts: any[] = Array.isArray(p.questionAttempts) ? p.questionAttempts : [];
    const scoreTotal = atts.length
      ? atts.reduce((sum, q) => sum + (Number(q?.score) || 0), 0)
      : Number(p.overallScore) || 0;
    // From `totalMaxScore`, not summed from the attempts — their
    // `totalScore` is null on stored records. See the note in StudentCells.
    const scoreMax = Number(p.totalMaxScore) || Number(exercise?.totalPoints) || 0;
    const pct = scoreMax > 0 ? (scoreTotal / scoreMax) * 100 : 0;
    const totalQ = Number(
      p.questionsTotal ?? p.totalQuestions ?? exercise?.totalQuestions
      ?? exercise?.questions?.length ?? atts.length ?? 0,
    ) || 0;
    const attendedQ = Number(
      p.questionsAttempted ?? p.attemptedQuestions ?? p.attendedQuestions
      ?? p.completedCount ?? p.completedQuestions ?? p.answeredQuestions
      ?? (Number(p.completionPercentage) > 0 && totalQ > 0
            ? Math.round((Number(p.completionPercentage) / 100) * totalQ) : 0),
    ) || 0;
    const gradeLabel = pct >= 85 ? "Excellent" : pct >= 60 ? "Good" : pct >= 40 ? "Average" : (scoreTotal > 0 ? "Poor" : "—");
    const serverStatus = String(p.status || "").toLowerCase();
    const submittedByServer = serverStatus === "completed" || serverStatus === "evaluated" || serverStatus === "submitted";
    const status = submittedByServer || scoreTotal > 0 || attendedQ > 0
      ? "Completed" : "Not Started";
    return {
      "#": i + 1,
      "Student Name": s.name || "",
      Email: s.email || "",
      // One column, matching the merged on-screen "Attended" cell.
      Attended: `${attendedQ}/${totalQ}`,
      Marks: scoreMax > 0 ? `${scoreTotal}/${scoreMax}` : "—",
      Grade: gradeLabel,
      Status: status,
    };
  };

  // ── Overall report data ───────────────────────────────────────────────
  // The nested "every exercise + its student list underneath" shape. Walks
  // the exercises the trainer currently has in view (selection first, then
  // the We_Do / You_Do filter and search — so an Overall taken while the
  // Activity filter reads "Assignment" covers assignments only), and fetches
  // each one's student list through the same endpoint the Students tab uses.
  //
  // Requests go out in parallel but through the React Query cache, so an
  // exercise the trainer has already opened costs nothing to include, and a
  // failed fetch degrades to an empty student list for that exercise rather
  // than failing the whole report.
  const buildOverallData = async () => {
    // Apply the We_Do / You_Do filter to the exercise source on EVERY tab.
    // `filteredData` only carries it while the Exercises tab is the active
    // one — drilled into a student, `filteredData` holds students, so an
    // Overall taken from there used to silently widen back to every
    // activity on the course. The trainer's Activity pick has to survive
    // the drill, or "filter to We Do, then Overall" quietly lies.
    const sectionScoped = (list: any[]) =>
      sectionFilter.length > 0 && sectionFilter.length < SECTION_OPTIONS_ALL.length
        ? list.filter((e: any) => sectionFilter.includes(e.section))
        : list;
    const source: any[] = selectedIds.length
      // An explicit tick is explicit intent — those rows were already
      // visible under the filter, so they are taken as picked.
      ? exercises.filter((e: any) => selectedIds.includes(rowId(e)))
      : activeTab === "exercises" ? filteredData : sectionScoped(exercises);
    if (!source.length) return [];
    return Promise.all(source.map(async (ex: any) => {
      const exId = ex._id || ex.id;
      let list: any[] = [];
      try {
        list = await queryClient.fetchQuery({
          queryKey: ["grades", "students", courseId, exId],
          queryFn: async () => {
            const res: any = await api.get(`/exercises/${courseId}/${exId}/students`);
            if (!res?.success) throw new Error("Failed to load students");
            return res.data?.students || [];
          },
        });
      } catch {
        list = [];
      }
      return {
        exercise: {
          name: ex.exerciseName || "Unnamed Exercise",
          kind: ex.section === "We_Do" ? "Assignment"
            : ex.section === "You_Do" ? "Assessment"
            : "Exercise",
          section: ex.section || "",
          totalQuestions: Number(ex.totalQuestions) || 0,
          totalMarks: Number(ex.totalPoints) || 0,
        },
        students: (list || []).map((s: any, i: number) => studentExportRow(s, i, ex)),
      };
    }));
  };

  // ── Report header — the meta strip PDF / XLSX / Print all share ──
  // Assignment vs Assessment comes from the exercise's We_Do / You_Do
  // section (missing → "Exercise"). Same wording the header rules on the
  // Exercises tab use for the Activity column label, so trainers see the
  // same term twice. Hoisted above the exporters so every one of them can
  // call buildReportMeta() without a use-before-define lint warning —
  // JavaScript closures are fine here at runtime, but the file reads more
  // naturally with helpers defined before their callers.
  const activityKind = selectedExercise?.section === "We_Do" ? "Assignment"
    : selectedExercise?.section === "You_Do" ? "Assessment"
      : "Exercise";

  // Which Activity filter produced this report. Every export and print
  // stamps this line, so a "We Do only" PDF says so on its face rather
  // than looking like a short full list — the trainer filters to We Do,
  // prints, files it, and the sheet still explains itself weeks later.
  // `onlySection` is non-null only when exactly one of the two boxes is
  // ticked; both (or neither) is the unfiltered default.
  const onlySection = sectionFilter.length === 1 ? sectionFilter[0] : null;
  const activityFilterLabel = onlySection === "We_Do" ? "We Do (Assignment) only"
    : onlySection === "You_Do" ? "You Do (Assessment) only"
      : "All — We Do (Assignment) + You Do (Assessment)";
  // Short form for filenames: course_we_do_exercise_list.xlsx
  const activityFilterSlug = onlySection === "We_Do" ? "_we_do"
    : onlySection === "You_Do" ? "_you_do" : "";
  // Chip-length form for the Export / Print menu headings, so the trainer
  // reads the scope BEFORE clicking rather than discovering it in the file.
  const activityScopeShort = onlySection === "We_Do" ? "We Do only"
    : onlySection === "You_Do" ? "You Do only" : "All activities";

  const buildReportMeta = () => ({
    course: courseData?.name || "Course",
    activityKind,
    exerciseName: selectedExercise?.exerciseName || "",
    studentName: activeTab === "questions" ? (selectedStudent?.name || "") : "",
    activityFilter: activityFilterLabel,
    generatedAt: new Date().toLocaleString(),
    rowCount: (typeof filteredData !== "undefined" ? filteredData.length : 0),
  });

  // File slug — tab-aware: exercise_list on the Exercises tab,
  // student_list on the Students tab, <student>_questions on Questions.
  // Includes the selection count when the user is exporting a picked
  // subset so a "3_selected" file cannot be confused with the full list.
  const exportSlug = () => {
    const base = activeTab === "exercises" ? "exercise_list"
      : activeTab === "questions"
        ? `${(selectedStudent?.name || "student").replace(/\s+/g, "_")}_questions`
        : "student_list";
    const selectedFlag = selectedIds.length ? `_${selectedIds.length}_selected` : "";
    // Activity slug only on the Exercises tab — that is the only list the
    // We_Do / You_Do filter actually narrows, so tagging a student-list
    // filename with "_we_do" would claim a filter that did not apply to it.
    const activityFlag = activeTab === "exercises" ? activityFilterSlug : "";
    return `${(courseData?.name || "course").replace(/\s+/g, "_")}_${
      selectedExercise?.exerciseName ? selectedExercise.exerciseName.replace(/\s+/g, "_") + "_" : ""
    }${base}${activityFlag}${selectedFlag}`;
  };

  // Blob → download. Was routed through `file-saver`, whose ESM build
  // exposes `saveAs` on the module default rather than as a named export
  // under this bundler — `import("file-saver")` therefore destructured
  // `undefined` and every Excel click threw "saveAs is not a function".
  // An anchor + object URL is the same three lines file-saver runs for
  // modern browsers anyway, with no interop guesswork. Revoked on the
  // next tick because Safari cancels an in-flight download when the URL
  // is revoked synchronously.
  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  // CSV — sanitises quotes, one row per record, header row derived from
  // the object keys so column order never drifts from the on-screen table.
  const exportCsv = () => {
    const rows = buildExportRows();
    if (!rows.length) return;
    const headers = Object.keys(rows[0]);
    const csv = [headers.join(","), ...rows.map(r => headers.map(h => `"${String((r as any)[h]).replace(/"/g, '""')}"`).join(","))].join("\n");
    downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8;" }), `${exportSlug()}.csv`);
  };

  // XLSX — real Excel file via exceljs. Layout, top to bottom:
  //   • Course name (bold, 14pt)
  //   • Assignment/Assessment: <exercise>       (10pt subtle)
  //   • Student: <name>                          (Questions tab only)
  //   • Report / generated / row count meta line
  //   • blank spacer
  //   • column header row (bold, gray fill, frozen)
  //   • data rows
  // Numeric columns are right-aligned so they sort correctly in Excel.
  const exportXlsx = async () => {
    const rows = buildExportRows();
    if (!rows.length) return;
    const { default: ExcelJS } = await import("exceljs");
    const headers = Object.keys(rows[0]);
    const meta = buildReportMeta();
    const listLabel = activeTab === "exercises" ? "Exercise List"
      : activeTab === "questions" ? "Question List"
      : "Student List";
    const NUMERIC = new Set(["#", "Total Questions", "Total Marks", "Attended", "Marks", "Mark Scored", "Attempts"]);

    const wb = new ExcelJS.Workbook();
    wb.creator = "LMS";
    wb.created = new Date();
    const ws = wb.addWorksheet(listLabel.slice(0, 31)); // Excel caps sheet names at 31 chars

    // Title block — build row-by-row so we know exactly where the column
    // header lands (needed for the freeze pane below).
    const titleLines: { text: string; bold?: boolean; size?: number; color?: string }[] = [];
    titleLines.push({ text: meta.course, bold: true, size: 14, color: "FF111827" });
    if (meta.exerciseName) {
      titleLines.push({ text: `${meta.activityKind}: ${meta.exerciseName}`, size: 10, color: "FF374151" });
    }
    if (meta.studentName) {
      titleLines.push({ text: `Student: ${meta.studentName}`, size: 10, color: "FF374151" });
    }
    if (activeTab === "exercises") {
      titleLines.push({ text: `Activity: ${meta.activityFilter}`, size: 10, color: "FF374151" });
    }
    titleLines.push({
      text: `Report: ${listLabel} · Generated on ${meta.generatedAt} · ${rows.length} row${rows.length === 1 ? "" : "s"}`,
      size: 9,
      color: "FF6B7280",
    });

    titleLines.forEach(line => {
      const r = ws.addRow([line.text]);
      r.getCell(1).font = { bold: !!line.bold, size: line.size, color: { argb: line.color || "FF111827" } };
    });
    ws.addRow([]); // spacer between title block and the data table

    // Header row.
    const headerRowIdx = ws.rowCount + 1;
    const headerRow = ws.addRow(headers);
    headerRow.font = { bold: true, color: { argb: "FF374151" } };
    headerRow.alignment = { vertical: "middle" };
    headerRow.eachCell(cell => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF9FAFB" } };
      cell.border = { bottom: { style: "thin", color: { argb: "FFE5E7EB" } } };
    });

    // Data rows — right-align numeric columns and use array-of-values so
    // Excel infers types (integers stay numeric, sortable).
    rows.forEach(r => {
      const row = ws.addRow(headers.map(h => (r as any)[h]));
      headers.forEach((h, i) => {
        if (NUMERIC.has(h)) row.getCell(i + 1).alignment = { horizontal: "right" };
      });
    });

    // Auto-fit column widths using the longest value seen in each column,
    // clamped so a runaway exercise name cannot blow the sheet out.
    headers.forEach((h, i) => {
      let max = h.length;
      for (let r = headerRowIdx + 1; r <= ws.rowCount; r++) {
        const len = String(ws.getRow(r).getCell(i + 1).value ?? "").length;
        if (len > max) max = len;
      }
      ws.getColumn(i + 1).width = Math.min(60, Math.max(12, max + 2));
    });

    ws.views = [{ state: "frozen", ySplit: headerRowIdx }];

    const buf = await wb.xlsx.writeBuffer();
    downloadBlob(
      new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
      `${exportSlug()}.xlsx`,
    );
  };

  // Print / PDF — writes the table into a fresh window and triggers the
  // browser's print dialog. The user picks a real printer or "Save as
  // PDF" from there, so both entry points (Print button, Export → PDF)
  // route through the same handler. Same approach Course Setup uses for
  // its per-client print bundles.
  // PDF — direct download via jsPDF + autotable (both already in
  // package.json). Was routed through the print window before, which
  // meant the user had to pick "Save as PDF" in the OS dialog. Now the
  // browser downloads the .pdf on click, matching the trainer's ask.
  // Same rows/columns as the CSV so nothing drifts between formats.
  const exportPdf = async () => {
    const rows = buildExportRows();
    if (!rows.length) return;
    const [{ default: jsPDF }, autotableMod] = await Promise.all([
      import("jspdf"),
      import("jspdf-autotable"),
    ]);
    const autoTable = (autotableMod as any).default || (autotableMod as any);
    const headers = Object.keys(rows[0]);
    const meta = buildReportMeta();
    const listLabel = activeTab === "exercises" ? "Exercise List"
      : activeTab === "questions" ? "Question List"
      : "Student List";
    const rowNoun = activeTab === "exercises"
      ? `exercise${rows.length === 1 ? "" : "s"}`
      : activeTab === "questions"
        ? `question${rows.length === 1 ? "" : "s"}`
        : `student${rows.length === 1 ? "" : "s"}`;

    // Landscape so the widest column set (Students) fits without wrapping.
    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });

    // Header block — five explicit lines so nothing about WHICH data this
    // report describes is left to guessing:
    //   1. Course name (large)
    //   2. "Assignment: <name>" or "Assessment: <name>" — kind + exercise name
    //   3. "Student: <name>"   — only on the Questions tab
    //   4. "Report: <List type>"
    //   5. Timestamp + row count
    let y = 44;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(17, 24, 39);
    doc.text(meta.course, 40, y);
    y += 20;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(55, 65, 81);
    if (meta.exerciseName) {
      doc.text(`${meta.activityKind}: ${meta.exerciseName}`, 40, y);
      y += 16;
    }
    if (meta.studentName) {
      doc.text(`Student: ${meta.studentName}`, 40, y);
      y += 16;
    }
    doc.text(`Report: ${listLabel}`, 40, y);
    y += 16;
    // Activity filter — only meaningful on the Exercises tab, which is the
    // list the We_Do / You_Do pick narrows.
    if (activeTab === "exercises") {
      doc.text(`Activity: ${meta.activityFilter}`, 40, y);
      y += 16;
    }
    doc.setFontSize(9);
    doc.setTextColor(120, 120, 120);
    doc.text(`Generated on ${meta.generatedAt}  ·  ${rows.length} ${rowNoun}`, 40, y);
    y += 10;
    doc.setTextColor(0);

    // Column alignment — numeric columns right-aligned. Different sets
    // between tabs so we build the map from the header names rather than
    // hardcoding indices.
    const NUMERIC = new Set(["#", "Total Questions", "Total Marks", "Attended", "Marks", "Mark Scored", "Attempts"]);
    const columnStyles: Record<number, { halign: "left" | "right" | "center" }> = {};
    headers.forEach((h, i) => {
      if (NUMERIC.has(h)) columnStyles[i] = { halign: "right" };
    });

    autoTable(doc, {
      startY: y + 8,
      head: [headers],
      body: rows.map(r => headers.map(h => String((r as any)[h] ?? ""))),
      styles: { fontSize: 9, cellPadding: 6, overflow: "linebreak" },
      headStyles: { fillColor: [249, 250, 251], textColor: 55, fontStyle: "bold", lineWidth: 0.5, lineColor: [229, 231, 235] },
      alternateRowStyles: { fillColor: [252, 252, 253] },
      columnStyles,
      margin: { top: y + 8, left: 30, right: 30, bottom: 30 },
    });
    doc.save(`${exportSlug()}.pdf`);
  };

  const openPrintWindow = () => {
    const rows = buildExportRows();
    if (!rows.length) return;
    const headers = Object.keys(rows[0]);
    const meta = buildReportMeta();
    const listLabel = activeTab === "exercises" ? "Exercise List"
      : activeTab === "questions" ? "Question List"
      : "Student List";
    const rowNoun = activeTab === "exercises"
      ? `exercise${rows.length === 1 ? "" : "s"}`
      : activeTab === "questions"
        ? `question${rows.length === 1 ? "" : "s"}`
        : `student${rows.length === 1 ? "" : "s"}`;
    // Numeric-column set matches the PDF exporter so both formats align
    // the same columns. Derived by header NAME so the mapping survives
    // when the columns change between tabs.
    const NUMERIC = new Set(["#", "Total Questions", "Total Marks", "Attended", "Marks", "Mark Scored", "Attempts"]);
    const escape = (s: string) => String(s).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    })[c] || c);
    // Header block — mirrors the PDF exporter above. Explicit rows for
    // Course, Assignment/Assessment name, Student name (Questions tab
    // only), then a small meta line with the timestamp + row count.
    const heading = `
      <h1>${escape(meta.course)}</h1>
      ${meta.exerciseName ? `<div class="meta"><span class="lbl">${escape(meta.activityKind)}:</span> ${escape(meta.exerciseName)}</div>` : ""}
      ${meta.studentName ? `<div class="meta"><span class="lbl">Student:</span> ${escape(meta.studentName)}</div>` : ""}
      <div class="meta"><span class="lbl">Report:</span> ${escape(listLabel)}</div>
      ${activeTab === "exercises" ? `<div class="meta"><span class="lbl">Activity:</span> ${escape(meta.activityFilter)}</div>` : ""}
      <div class="sub">Printed on ${escape(meta.generatedAt)} · ${rows.length} ${rowNoun}</div>
    `;
    const html = `
      <html><head><meta charset="utf-8"><title>${escape(meta.course + " — " + listLabel)}</title>
      <style>
        *{box-sizing:border-box;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Poppins',sans-serif}
        body{margin:24px;color:#111827}
        h1{font-size:18px;font-weight:700;margin:0 0 6px}
        .meta{font-size:12px;color:#374151;margin:2px 0}
        .meta .lbl{color:#6b7280;font-weight:600;margin-right:4px}
        .sub{font-size:11px;color:#9ca3af;margin:8px 0 16px}
        table{width:100%;border-collapse:collapse;font-size:12px}
        th,td{text-align:left;padding:8px 10px;border-bottom:1px solid #e5e7eb;vertical-align:top}
        th{background:#f9fafb;font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:#6b7280;font-weight:600}
        tr{page-break-inside:avoid}
        .num{text-align:right;font-variant-numeric:tabular-nums}
        @page{margin:14mm}
      </style></head><body>
        ${heading}
        <table>
          <thead><tr>${headers.map(h => `<th${NUMERIC.has(h) ? ' class="num"' : ""}>${escape(h)}</th>`).join("")}</tr></thead>
          <tbody>${rows.map(r => `<tr>${headers.map(h => `<td${NUMERIC.has(h) ? ' class="num"' : ""}>${escape(String((r as any)[h] ?? ""))}</td>`).join("")}</tr>`).join("")}</tbody>
        </table>
      </body></html>`;
    printHtml(html);
  };

  // Shared "open a window, write this document, fire the print dialog".
  // Both the normal and the Overall print route through here so the popup
  // handling (blocked-popup guard, readyState race) lives in one place.
  const printHtml = (html: string) => {
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.open();
    win.document.write(html);
    win.document.close();
    const doPrint = () => { try { win.focus(); win.print(); } catch { /* popup closed */ } };
    if (win.document.readyState === "complete") setTimeout(doPrint, 100);
    else win.onload = () => setTimeout(doPrint, 100);
  };

  // ── Overall report — every exercise, with its student list underneath ──
  // Shared bits first: the escaper, the student column set, and the shared
  // stylesheet the Overall print uses.
  const OVERALL_STUDENT_COLS = ["#", "Student Name", "Email", "Attended", "Marks", "Grade", "Status"];
  const OVERALL_NUMERIC = new Set(["#", "Attended", "Marks"]);
  const htmlEscape = (s: string) => String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[c] || c);

  // Overall PRINT — one section per exercise: a header strip naming the
  // activity (with its We Do / You Do kind, question count and total marks)
  // followed by that exercise's student table. Sections avoid breaking
  // across pages where they fit; an exercise with no enrolled students
  // prints an explicit "No students" line rather than an empty table, so
  // the reader can tell "nobody enrolled" from "data failed to load".
  const printOverall = async () => {
    const data = await buildOverallData();
    if (!data.length) return;
    const meta = buildReportMeta();
    const totalStudents = data.reduce((n, d) => n + d.students.length, 0);
    const sections = data.map((d, i) => `
      <section class="ex">
        <div class="exhead">
          <span class="idx">${i + 1}</span>
          <span class="kind ${d.exercise.section === "We_Do" ? "wedo" : d.exercise.section === "You_Do" ? "youdo" : ""}">${htmlEscape(d.exercise.kind)}</span>
          <span class="exname">${htmlEscape(d.exercise.name)}</span>
          <span class="exmeta">${d.exercise.totalQuestions} question${d.exercise.totalQuestions === 1 ? "" : "s"} · ${d.exercise.totalMarks} mark${d.exercise.totalMarks === 1 ? "" : "s"} · ${d.students.length} student${d.students.length === 1 ? "" : "s"}</span>
        </div>
        ${d.students.length ? `
        <table>
          <thead><tr>${OVERALL_STUDENT_COLS.map(h => `<th${OVERALL_NUMERIC.has(h) ? ' class="num"' : ""}>${htmlEscape(h)}</th>`).join("")}</tr></thead>
          <tbody>${d.students.map(r => `<tr>${OVERALL_STUDENT_COLS.map(h => `<td${OVERALL_NUMERIC.has(h) ? ' class="num"' : ""}>${htmlEscape(String((r as any)[h] ?? ""))}</td>`).join("")}</tr>`).join("")}</tbody>
        </table>` : `<p class="empty">No students enrolled for this activity.</p>`}
      </section>`).join("");
    const html = `
      <html><head><meta charset="utf-8"><title>${htmlEscape(meta.course + " — Overall Report")}</title>
      <style>
        *{box-sizing:border-box;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Poppins',sans-serif}
        body{margin:24px;color:#111827}
        h1{font-size:18px;font-weight:700;margin:0 0 6px}
        .meta{font-size:12px;color:#374151;margin:2px 0}
        .meta .lbl{color:#6b7280;font-weight:600;margin-right:4px}
        .sub{font-size:11px;color:#9ca3af;margin:8px 0 18px}
        .ex{margin:0 0 22px;page-break-inside:avoid}
        .exhead{display:flex;align-items:center;gap:8px;padding:8px 10px;background:#f9fafb;border:1px solid #e5e7eb;border-bottom:none;border-radius:6px 6px 0 0}
        .idx{font-size:11px;font-weight:700;color:#9ca3af;min-width:16px}
        .kind{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;padding:2px 7px;border-radius:999px;background:#f3f4f6;color:#4b5563}
        .kind.wedo{background:#eff6ff;color:#1d4ed8}
        .kind.youdo{background:#fff7ed;color:#c2410c}
        .exname{font-size:13px;font-weight:600;color:#111827}
        .exmeta{margin-left:auto;font-size:10px;color:#9ca3af;white-space:nowrap}
        table{width:100%;border-collapse:collapse;font-size:11px;border:1px solid #e5e7eb}
        th,td{text-align:left;padding:6px 10px;border-bottom:1px solid #f3f4f6;vertical-align:top}
        th{background:#fcfcfd;font-size:9px;text-transform:uppercase;letter-spacing:.06em;color:#6b7280;font-weight:600}
        tbody tr:last-child td{border-bottom:none}
        tr{page-break-inside:avoid}
        .num{text-align:right;font-variant-numeric:tabular-nums}
        .empty{margin:0;padding:12px 10px;font-size:11px;color:#9ca3af;border:1px solid #e5e7eb;border-top:none;background:#fff}
        @page{margin:14mm}
      </style></head><body>
        <h1>${htmlEscape(meta.course)}</h1>
        <div class="meta"><span class="lbl">Report:</span> Overall — activities with student results</div>
        <div class="meta"><span class="lbl">Activity:</span> ${htmlEscape(meta.activityFilter)}</div>
        <div class="sub">Printed on ${htmlEscape(meta.generatedAt)} · ${data.length} activit${data.length === 1 ? "y" : "ies"} · ${totalStudents} student record${totalStudents === 1 ? "" : "s"}</div>
        ${sections}
      </body></html>`;
    printHtml(html);
  };

  // Overall filename slug — mirrors exportSlug's shape but names the
  // report rather than the tab, since Overall is the same document
  // regardless of which tab the trainer launched it from.
  const overallSlug = () =>
    `${(courseData?.name || "course").replace(/\s+/g, "_")}_overall_report${
      activityFilterSlug
    }${selectedIds.length ? `_${selectedIds.length}_selected` : ""}`;

  // Overall EXCEL — one sheet, exercises stacked with their student tables
  // indented underneath. An exercise header row is bold on a tinted fill so
  // the sections stay scannable when the sheet is scrolled; the student
  // header repeats per section because Excel has no notion of a repeating
  // sub-table header.
  const exportOverallXlsx = async () => {
    const data = await buildOverallData();
    if (!data.length) return;
    const { default: ExcelJS } = await import("exceljs");
    const meta = buildReportMeta();
    const totalStudents = data.reduce((n, d) => n + d.students.length, 0);

    const wb = new ExcelJS.Workbook();
    wb.creator = "LMS";
    wb.created = new Date();
    const ws = wb.addWorksheet("Overall Report");

    const title = ws.addRow([meta.course]);
    title.getCell(1).font = { bold: true, size: 14, color: { argb: "FF111827" } };
    const act = ws.addRow([`Activity: ${meta.activityFilter}`]);
    act.getCell(1).font = { size: 10, color: { argb: "FF374151" } };
    const sub = ws.addRow([
      `Overall report · Generated on ${meta.generatedAt} · ${data.length} activit${data.length === 1 ? "y" : "ies"} · ${totalStudents} student record${totalStudents === 1 ? "" : "s"}`,
    ]);
    sub.getCell(1).font = { size: 9, color: { argb: "FF6B7280" } };
    ws.addRow([]);

    data.forEach((d, i) => {
      // Exercise banner — index, kind, name, then the counts.
      const ex = ws.addRow([
        `${i + 1}. [${d.exercise.kind}] ${d.exercise.name}`,
        "", "", "",
        `${d.exercise.totalQuestions} Q`,
        `${d.exercise.totalMarks} marks`,
        `${d.students.length} students`,
      ]);
      ex.font = { bold: true, size: 11, color: { argb: "FF111827" } };
      ex.eachCell({ includeEmpty: true }, cell => {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          // We Do → blue tint, You Do → orange tint, anything else neutral.
          fgColor: {
            argb: d.exercise.section === "We_Do" ? "FFEFF6FF"
              : d.exercise.section === "You_Do" ? "FFFFF7ED"
              : "FFF3F4F6",
          },
        };
        cell.border = { bottom: { style: "thin", color: { argb: "FFE5E7EB" } } };
      });

      if (!d.students.length) {
        const none = ws.addRow(["", "No students enrolled for this activity."]);
        none.getCell(2).font = { italic: true, size: 9, color: { argb: "FF9CA3AF" } };
        ws.addRow([]);
        return;
      }

      const head = ws.addRow(["", ...OVERALL_STUDENT_COLS]);
      head.font = { bold: true, size: 9, color: { argb: "FF6B7280" } };
      head.eachCell({ includeEmpty: false }, cell => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFCFCFD" } };
        cell.border = { bottom: { style: "thin", color: { argb: "FFE5E7EB" } } };
      });

      d.students.forEach(r => {
        const row = ws.addRow(["", ...OVERALL_STUDENT_COLS.map(h => (r as any)[h])]);
        OVERALL_STUDENT_COLS.forEach((h, ci) => {
          if (OVERALL_NUMERIC.has(h)) row.getCell(ci + 2).alignment = { horizontal: "right" };
        });
      });
      ws.addRow([]);
    });

    // Fixed widths — the indent column is narrow, then the student columns
    // in their on-screen order. Sized to the widest value each realistically
    // holds rather than measured, since the sheet mixes banner rows (which
    // span) with table rows and a measured fit would be skewed by the banner.
    ws.getColumn(1).width = 3;
    [6, 26, 34, 12, 12, 12, 14].forEach((w, i) => { ws.getColumn(i + 2).width = w; });

    const buf = await wb.xlsx.writeBuffer();
    downloadBlob(
      new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
      `${overallSlug()}.xlsx`,
    );
  };

  // Overall CSV — flat file with an "Activity" / "Type" column repeated on
  // every student row. CSV has no sections, so denormalising is the only
  // shape that stays machine-readable (and pivots cleanly in Excel).
  const exportOverallCsv = async () => {
    const data = await buildOverallData();
    if (!data.length) return;
    const headers = ["Type", "Assignment/Assessment", ...OVERALL_STUDENT_COLS];
    const lines: string[][] = [];
    data.forEach(d => {
      if (!d.students.length) {
        lines.push([d.exercise.kind, d.exercise.name, "", "No students enrolled", "", "", "", "", ""]);
        return;
      }
      d.students.forEach(r => {
        lines.push([d.exercise.kind, d.exercise.name, ...OVERALL_STUDENT_COLS.map(h => String((r as any)[h] ?? ""))]);
      });
    });
    const csv = [headers, ...lines]
      .map(cols => cols.map(c => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8;" }), `${overallSlug()}.csv`);
  };

  // Overall PDF — one autotable per exercise, each preceded by a banner
  // row drawn as a single-cell table so it shares the table's page-break
  // handling. `didDrawPage` is not needed: autotable chains off the previous
  // table's finalY, and starts a new page on its own when a section runs out
  // of room.
  const exportOverallPdf = async () => {
    const data = await buildOverallData();
    if (!data.length) return;
    const [{ default: jsPDF }, autotableMod] = await Promise.all([
      import("jspdf"),
      import("jspdf-autotable"),
    ]);
    const autoTable = (autotableMod as any).default || (autotableMod as any);
    const meta = buildReportMeta();
    const totalStudents = data.reduce((n, d) => n + d.students.length, 0);

    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });

    let y = 44;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(17, 24, 39);
    doc.text(meta.course, 40, y);
    y += 18;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(55, 65, 81);
    doc.text("Report: Overall — activities with student results", 40, y);
    y += 15;
    doc.text(`Activity: ${meta.activityFilter}`, 40, y);
    y += 15;
    doc.setFontSize(9);
    doc.setTextColor(120, 120, 120);
    doc.text(
      `Generated on ${meta.generatedAt}  ·  ${data.length} activit${data.length === 1 ? "y" : "ies"}  ·  ${totalStudents} student record${totalStudents === 1 ? "" : "s"}`,
      40, y,
    );
    doc.setTextColor(0);
    let cursorY = y + 16;

    const columnStyles: Record<number, { halign: "left" | "right" }> = {};
    OVERALL_STUDENT_COLS.forEach((h, i) => {
      if (OVERALL_NUMERIC.has(h)) columnStyles[i] = { halign: "right" };
    });

    data.forEach((d, i) => {
      // Banner — a one-row, one-column table so autotable owns the page
      // breaks for it too (a raw doc.text() here could strand a heading at
      // the bottom of a page with its table pushed to the next one).
      autoTable(doc, {
        startY: cursorY,
        body: [[
          `${i + 1}.  [${d.exercise.kind}]  ${d.exercise.name}`
          + `        ${d.exercise.totalQuestions} Q · ${d.exercise.totalMarks} marks · ${d.students.length} student${d.students.length === 1 ? "" : "s"}`,
        ]],
        theme: "plain",
        styles: {
          fontSize: 10,
          fontStyle: "bold",
          cellPadding: 6,
          textColor: [17, 24, 39],
          fillColor: d.exercise.section === "We_Do" ? [239, 246, 255]
            : d.exercise.section === "You_Do" ? [255, 247, 237]
            : [243, 244, 246],
        },
        margin: { left: 30, right: 30 },
      });
      cursorY = (doc as any).lastAutoTable.finalY;

      if (!d.students.length) {
        autoTable(doc, {
          startY: cursorY,
          body: [["No students enrolled for this activity."]],
          theme: "plain",
          styles: { fontSize: 9, fontStyle: "italic", textColor: [156, 163, 175], cellPadding: 6 },
          margin: { left: 30, right: 30 },
        });
        cursorY = (doc as any).lastAutoTable.finalY + 14;
        return;
      }

      autoTable(doc, {
        startY: cursorY,
        head: [OVERALL_STUDENT_COLS],
        body: d.students.map(r => OVERALL_STUDENT_COLS.map(h => String((r as any)[h] ?? ""))),
        styles: { fontSize: 8.5, cellPadding: 5, overflow: "linebreak" },
        headStyles: { fillColor: [252, 252, 253], textColor: 85, fontStyle: "bold", lineWidth: 0.5, lineColor: [229, 231, 235] },
        alternateRowStyles: { fillColor: [252, 252, 253] },
        columnStyles,
        margin: { left: 30, right: 30, bottom: 30 },
      });
      cursorY = (doc as any).lastAutoTable.finalY + 14;
    });

    doc.save(`${overallSlug()}.pdf`);
  };

  const pageTitle = courseData?.name || "Grades";
  const contextLabel =
    activeTab === "exercises" ? "Exercises"
      // Students tab reads as a plain "Student List" — the trainer already
      // sees the exercise name in the drill breadcrumb above, so echoing
      // "Students · <Exercise>" here was noise.
      : activeTab === "students" ? "Student List"
        : `Questions · ${selectedStudent?.name || "Student"}`;

  const searchPlaceholder =
    activeTab === "exercises" ? "Search exercises…" :
      activeTab === "students" ? "Search students by name or email…" :
        "Search questions…";

  const totalForTab = activeTab === "exercises" ? exercises.length : activeTab === "students" ? students.length : questions.length;

  // Content — mounted INSIDE DashboardLayout below so it shares the admin
  // shell with Course Setup / User Management / Client Management. Container
  // geometry mirrors User Management exactly:
  //   • Outer `min-h-full h-full flex flex-col` gives the flex chain a
  //     DEFINITE height (the parent panel is `h-full`, but not a flex
  //     container, so `flex-1` inside needs this bridge to work).
  //   • Inner `motion.div` uses `flex flex-1 min-h-0 flex-col` — the padded
  //     column that carries the heading, toolbar, and table stack.
  //
  // Without the outer wrapper the whole panel scrolled and the pagination
  // fell below the fold. With it, only the table body scrolls and the pager
  // stays pinned inside the panel viewport, always visible.
  const pageContent = (
    <div className="min-h-full h-full flex flex-col">
    {/* Horizontal gutter: embedded, the host panel already supplies one, so
        the responsive px-6/px-8 ladder stacked on top of it and pulled the
        table in from the right edge — noticeably narrower than the Manage
        Exercise view in the same slot, which uses a flat px-4. Match that
        there; the standalone route keeps the wider page gutter. */}
    <motion.div
      variants={pageEnter}
      initial="hidden"
      animate="visible"
      className={`flex flex-1 min-h-0 flex-col pt-3 pb-3 text-body ${
        embedded ? "px-4" : "px-4 sm:px-6 lg:px-8"
      }`}
    >
      {/* ── Command bar ── */}
      <header className="shrink-0">
        {/* Slim heading — matches Course Setup's exact scale so both admin
            pages read as one design system. Back arrow lives on the left of
            the same row so it doesn't cost a second line of height. */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={() => {
                // Drill trail first: Questions → Students → Exercises. Once we
                // leave the Exercises tab, Back returns to whatever page
                // launched the flow (via `returnTo`, so any query on that
                // page — openMappingId, filters — round-trips). No returnTo →
                // router.back() lets browser history handle it, rather than
                // dumping the trainer at the client picker.
                //
                // Exception on the Students tab: when the trainer deep-linked
                // straight into a specific exercise's student list (Grade
                // button from an Assignment / Assessment dropdown), the
                // Exercises picker was never part of their journey — drilling
                // "up" to it would drop them at a list of every exercise on
                // the course, which is not where they came from. In that
                // case Back exits to returnTo (or router.back()) instead.
                // `bypassedExercisesRef` clears itself the moment the trainer
                // opens Exercises for real (via the breadcrumb chip or by
                // drilling deeper and coming back), so the drill trail takes
                // over from that point on.
                // Embedded: leaving the flow hands control back to the host
                // screen (which swaps its panel back to the exercise list)
                // instead of navigating the browser anywhere.
                const leave = () => {
                  if (onBack) return onBack();
                  if (returnTo) return router.push(returnTo);
                  return router.back();
                };
                if (activeTab === "questions") return handleBackToStudents();
                if (activeTab === "students") {
                  if (bypassedExercisesRef.current) return leave();
                  return handleBackToExercises();
                }
                return leave();
              }}
              className="inline-flex size-8 items-center justify-center rounded-control text-subtle hover:bg-row-hover hover:text-heading transition-colors duration-150 shrink-0"
              title="Back"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            {/* The drill trail IS the heading. It used to sit on its own
                row above a separate "Student List" / "Question List" title,
                which cost a line of height to say something the last crumb
                already said. Now: ← Testing › ARAVINDRAJ G › Questions, one
                row. Every crumb but the last is clickable and walks back up
                the drill; the last is the current view. */}
            {crumbs.length > 0 ? (
              <nav
                className="flex items-center gap-1 text-xs min-w-0 overflow-x-auto custom-scrollbar"
                aria-label="Breadcrumb"
              >
                {crumbs.map((c, i) => {
                  const last = i === crumbs.length - 1;
                  const Icon = c.icon;
                  return (
                    <React.Fragment key={i}>
                      <button
                        type="button"
                        onClick={c.onClick}
                        disabled={!c.onClick}
                        className={`inline-flex items-center gap-1 whitespace-nowrap rounded-chip px-1.5 py-0.5 transition-colors ${
                          last ? "text-heading font-semibold" : c.onClick ? "text-subtle hover:text-brand-strong" : "text-faint"
                        }`}
                      >
                        <Icon className="w-3 h-3" />{c.title}
                      </button>
                      {!last && <ChevronRight className="w-3 h-3 text-faint shrink-0" />}
                    </React.Fragment>
                  );
                })}
              </nav>
            ) : (
              // No drill yet (the exercises picker) — nothing to trail, so
              // fall back to the plain page title.
              <div className="min-w-0">
                <h1
                  className={`font-semibold text-heading tracking-[-0.01em] leading-tight truncate ${
                    embedded ? "text-sm" : "text-base sm:text-lg"
                  }`}
                >
                  {pageTitle}
                </h1>
              </div>
            )}
          </div>

        </div>

        {/* One toolbar — search left · Section select · Filter right. Slim
            `h-8` compact bar with `text-xs` placeholder, exactly matching
            Course Setup / User Management. Mirrors those pages' cluster
            layout so the eye lands on the same controls in the same places. */}
        <div className="mt-1.5 flex items-center gap-2 flex-wrap min-w-0">
          <div className="relative flex-1 min-w-[220px] max-w-md">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-faint pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full h-8 pl-8 pr-8 rounded-control border border-hairline-strong bg-surface text-xs text-body placeholder:text-faint focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/15 transition-colors duration-150"
            />
            {searchTerm && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => setSearchTerm("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex size-5 items-center justify-center rounded-chip text-faint hover:bg-ink-100 hover:text-heading transition-colors duration-150"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>

          {/* All filters live inline as FloatingSelects — one row of
              modern pickers instead of a Filter button that opens a
              drawer. Which selects are shown depends on the active tab:
                • Exercises: Section (We Do / You Do), Status
                • Students:  Status, Pass / Fail
                • Questions: Status, Difficulty
              The trainer changes any filter without leaving the toolbar. */}
          <div className="ml-auto flex items-center gap-1.5 flex-wrap">
            {/* Export + Print — directly after the search box and ahead of
                the filters, giving the toolbar a single left-to-right reading
                order: search · Export · Print · filters. They act on the
                CURRENT selection first — with checkboxes ticked, only the
                selected rows go out — and otherwise on whatever the search
                and filters have narrowed to. That way "overall" export and
                "selected" export share the same buttons; nothing extra to
                learn on either side. Now enabled for every tab (Exercises,
                Students, Questions). */}
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  {/* Coloured Export — success-tone (green), the design
                      system's palette for "data download" style actions.
                      Stands out from the neutral Print sibling next to
                      it, so the trainer's eye lands on the primary
                      download choice first. Label tells the trainer up
                      front whether the click hits the whole visible list
                      or just their selection — "Export (3)" reads as
                      "you're about to export 3 rows", so nothing ambiguous
                      about scope. */}
                  <button
                    type="button"
                    aria-label={
                      activeTab === "exercises" ? "Export exercise list"
                        : activeTab === "questions" ? "Export question list"
                          : "Export student list"
                    }
                    className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-control border border-success-500/30 bg-success-50 text-success-700 text-xs font-semibold hover:bg-success-50/70 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-success-500/30"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">
                      Export{selectedIds.length ? ` (${selectedIds.length})` : ""}
                    </span>
                    <ChevronDown className="w-3 h-3" />
                  </button>
                </DropdownMenuTrigger>
                {/* Two groups, same as Print below:
                      NORMAL  — just the list currently on screen
                      OVERALL — every activity WITH its student list nested
                                underneath, one section per exercise
                    Overall is offered on every tab because it always
                    describes the same document (the whole course), and
                    a trainer drilled into one student still wants a
                    one-click way to take the full picture. */}
                <DropdownMenuContent align="end" sideOffset={6} className="w-56">
                  <DropdownMenuLabel className="text-2xs uppercase tracking-wider text-faint font-semibold">
                    Normal — {activeTab === "exercises" ? activityScopeShort : activeTab === "questions" ? "question list" : "student list"}
                  </DropdownMenuLabel>
                  {/* Excel first — the format the trainer's ask names
                      explicitly ("xl"). Green tone matches the header
                      button. */}
                  <DropdownMenuItem onClick={exportXlsx} className="cursor-pointer">
                    <FileSpreadsheet className="h-4 w-4 text-success-700" /> Excel (.xlsx)
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={exportCsv} className="cursor-pointer">
                    <FileSpreadsheet className="h-4 w-4 text-ink-500" /> CSV
                  </DropdownMenuItem>
                  {/* PDF downloads DIRECTLY via jsPDF + autotable — no
                      more print dialog + Save-as-PDF dance. Same
                      column set as the other formats. */}
                  <DropdownMenuItem onClick={exportPdf} className="cursor-pointer">
                    <FileText className="h-4 w-4 text-danger-500" /> PDF
                  </DropdownMenuItem>

                  <DropdownMenuSeparator />
                  <DropdownMenuLabel className="text-2xs uppercase tracking-wider text-faint font-semibold">
                    Overall — {activityScopeShort} + students
                  </DropdownMenuLabel>
                  <DropdownMenuItem onClick={exportOverallXlsx} className="cursor-pointer">
                    <Layers className="h-4 w-4 text-success-700" /> Excel (.xlsx)
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={exportOverallCsv} className="cursor-pointer">
                    <Layers className="h-4 w-4 text-ink-500" /> CSV
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={exportOverallPdf} className="cursor-pointer">
                    <Layers className="h-4 w-4 text-danger-500" /> PDF
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Print is a dropdown now, mirroring Export's two groups:
                    Normal  — prints exactly what the table shows
                    Overall — prints every activity with its student list
                              nested underneath (the shape the trainer
                              sketched: exercise header, then its students) */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    aria-label="Print options"
                    className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-control border border-hairline-strong bg-surface text-xs font-medium text-body hover:bg-row-hover hover:text-heading transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/15"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">
                      Print{selectedIds.length ? ` (${selectedIds.length})` : ""}
                    </span>
                    <ChevronDown className="w-3 h-3" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" sideOffset={6} className="w-56">
                  <DropdownMenuItem onClick={openPrintWindow} className="cursor-pointer">
                    <Printer className="h-4 w-4 text-ink-500" />
                    <div className="flex flex-col">
                      <span>Normal print</span>
                      <span className="text-2xs text-faint">
                        {activeTab === "exercises" ? activityScopeShort
                          : activeTab === "questions" ? "This question list"
                            : "This student list"}
                      </span>
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={printOverall} className="cursor-pointer">
                    <Layers className="h-4 w-4 text-brand-strong" />
                    <div className="flex flex-col">
                      <span>Overall print</span>
                      <span className="text-2xs text-faint">{activityScopeShort} + their students</span>
                    </div>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {activeTab === "exercises" && (
              <>
                <FloatingMultiSelect
                  label="Activity"
                  value={sectionFilter}
                  onChange={setSectionFilter}
                  options={[
                    { value: "We_Do", label: "Assignment" },
                    { value: "You_Do", label: "Assessment" },
                  ]}
                  // When both checkboxes are ticked (the default), the
                  // trigger button reads "All" — a simple summary that
                  // stands in for the compound "Assignment/Assessment"
                  // which was too long to fit the button cleanly. The
                  // TABLE column header still writes out "Assignment/
                  // Assessment" (see the activityLabel derivation below)
                  // because that's the field's actual identity in the
                  // grid; the picker chip is just the summary.
                  joinAll="All"
                />
                <FloatingSelect
                  label="Status"
                  value={statusFilter}
                  onChange={setStatusFilter}
                  options={filterOptions.statusOptions || [{ value: "all", label: "All status" }]}
                />
              </>
            )}
            {activeTab === "students" && (
              <>
                <FloatingSelect
                  label="Status"
                  value={statusFilter}
                  onChange={setStatusFilter}
                  options={filterOptions.statusOptions || [{ value: "all", label: "All status" }]}
                />
                <FloatingSelect
                  label="Result"
                  value={passFailFilter}
                  onChange={setPassFailFilter}
                  options={filterOptions.passFailOptions || [{ value: "all", label: "All students" }]}
                />
              </>
            )}
            {activeTab === "questions" && (
              <>
                <FloatingSelect
                  label="Status"
                  value={statusFilter}
                  onChange={setStatusFilter}
                  options={filterOptions.statusOptions || [{ value: "all", label: "All status" }]}
                />
                <FloatingSelect
                  label="Difficulty"
                  value={difficultyFilter}
                  onChange={setDifficultyFilter}
                  options={filterOptions.difficultyOptions || [{ value: "all", label: "All difficulty" }]}
                />
              </>
            )}
            {/* "Clear all" button removed — filters are two small selects,
                each easy enough to reset individually, so the shortcut
                added visual noise for a case that rarely needs one click.
                The empty-state row still offers its own "Clear filters"
                affordance for the specific "your filter hid everything"
                moment. `clearAllFilters` stays defined for that use. */}
          </div>
        </div>

        {/* Summary chip strip removed — the trainer's ask was to strip
            visual badges off this surface so it matches User Management,
            which has no chip strip either. Counts are still shown at the
            bottom of the table ("Showing N of M exercises") so the page-
            level total isn't lost.
            `chips` is still computed above so the Student and Question tabs
            can reintroduce the strip cleanly if needed later. */}
      </header>

      {/* ── Table workspace ─────────────────────────────────────────────
          Edge-to-edge scroll body. The old wrapper carried `rounded-tile
          border border-hairline bg-surface shadow-xs` which drew a card
          around the list — Client Management and User Management leave the
          table flush against the shell's panel walls (no side border, no
          card), and the trainer asked for the same on Grades. The header
          stays sticky inside the scroll container; the count strip at the
          bottom sits as a sibling to the scroll body, matching UM's pager
          placement (below the scroll, outside its overflow). */}
      {/* Embedded, the table breaks OUT of this column's px-4 gutter with a
          matching -mx-4 so it runs edge to edge, the way the Manage Exercise
          list does in the same slot. The header and toolbar above keep the
          gutter — only the table is full-bleed, which is what makes the two
          screens read as the same surface. Standalone keeps the inset table. */}
      <div
        ref={tableCardRef}
        className={`mt-3 flex-1 min-h-0 flex flex-col ${embedded ? "-mx-4" : ""}`}
      >
        {/* Contextual column label — the leading Exercises-tab header renames
            to match the Activity filter: We Do → Assignment, You Do →
            Assessment, All → the generic "Exercise" (both kinds are in the
            list). Passed into headersFor so every use of the header spec
            (thead + loading skeleton + empty-state colSpan) reads the same
            value. */}
        {(() => {
          // Header follows the multi-select: one option ticked reads as its
          // singular name, both (or none = default) reads as the compound
          // "Assignment/Assessment".
          const onlyWeDo = sectionFilter.length === 1 && sectionFilter[0] === "We_Do";
          const onlyYouDo = sectionFilter.length === 1 && sectionFilter[0] === "You_Do";
          const activityLabel = onlyWeDo ? "Assignment" : onlyYouDo ? "Assessment" : "Assignment/Assessment";
          const cols = headersFor(activeTab, { activityLabel });
          // Checkbox column is offered on both Exercises and Students tabs
          // (Questions doesn't drill further so bulk-print of a subset is
          // not useful there). colSpan mirrors that same rule so the
          // empty-state row spans the full width.
          const selectable = activeTab === "exercises" || activeTab === "students";
          const colSpan = cols.length + (selectable ? 1 : 0);
          return (
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          {/* Vertical scroll is the safety valve for the 7-row floor above:
              auto-fit still decides the page size for any container tall
              enough, so this normally has nothing to scroll. It only engages
              when the panel is too short for seven rows, where scrolling is
              strictly better than clipping the last row under the pager.
              Horizontal stays hidden — table-layout:fixed + the per-column
              widths in <colgroup> below keep content from pushing sideways. */}
          <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
            <table className="w-full text-left text-sm" style={{ tableLayout: "fixed" }}>
              {/* Column widths per tab. Sum to 100% so the table fits its
                  container exactly with no horizontal overflow. Cells that
                  hold long text (Name, Email) use `truncate` + `title` for
                  hover tooltips. */}
              {activeTab === "students" && (
                // NINE columns: the row-select checkbox (rendered by the
                // page separately from the cells component) sits before
                // everything else, so the colgroup MUST declare it too —
                // without it the browser reverted to auto sizing for the
                // last columns and Actions slid off the right edge.
                //
                // Was TEN, back when Questions and Attended were separate
                // columns. After they merged into one `attempted/total` cell
                // the spec still declared ten, so the nine real columns only
                // claimed 92 % and the table rendered visibly short of its
                // container — the "table is only ~90 % wide" report.
                //
                // Checkbox(4) + #(3) + Name(20) + Email(23) + Attended(10)
                //   + Marks(10) + Grade(9) + Status(13) + Actions(8) = 100 %.
                <colgroup>
                  <col style={{ width: "4%" }} />
                  <col style={{ width: "3%" }} />
                  <col style={{ width: "20%" }} />
                  <col style={{ width: "23%" }} />
                  <col style={{ width: "10%" }} />
                  <col style={{ width: "10%" }} />
                  <col style={{ width: "9%" }} />
                  <col style={{ width: "13%" }} />
                  <col style={{ width: "8%" }} />
                </colgroup>
              )}
              {activeTab === "exercises" && (
                // Checkbox(4) + #(3) + Activity name (auto) +
                // Total Questions(13) + Total Marks(12) + Actions(14).
                // Numeric columns are widened enough that the restored
                // "Total X" headers stay on one line at any width.
                <colgroup>
                  <col style={{ width: "4%" }} />
                  <col style={{ width: "3%" }} />
                  <col />
                  <col style={{ width: "13%" }} />
                  <col style={{ width: "12%" }} />
                  <col style={{ width: "14%" }} />
                </colgroup>
              )}
              {activeTab === "questions" && (
                // Questions: #(3) + Question (auto) + Difficulty(12) +
                // Mark Scored(12) + Attempts(10) + Status(15) = ~52 % of
                // fixed + the rest for the question title. Same sizing
                // discipline as the other two tabs.
                <colgroup>
                  <col style={{ width: "3%" }} />
                  <col />
                  <col style={{ width: "12%" }} />
                  <col style={{ width: "12%" }} />
                  <col style={{ width: "10%" }} />
                  <col style={{ width: "15%" }} />
                </colgroup>
              )}
              <thead className="sticky top-0 z-10 bg-canvas border-b border-hairline">
                <tr>
                  {selectable && (
                    <th className="w-10 pl-4 pr-2 py-2.5">
                      <input type="checkbox" aria-label="Select all" checked={allSelected} ref={el => { if (el) el.indeterminate = someSelected && !allSelected; }} onChange={toggleAll} disabled={loading || filteredData.length === 0} className="size-4 rounded border-hairline-strong accent-brand" />
                    </th>
                  )}
                  {cols.map((h, i) => (
                    <th key={i} className={`py-2.5 px-3 text-2xs font-semibold uppercase tracking-wider text-subtle whitespace-nowrap ${h.align === 'right' ? 'text-right' : ''}`}>{h.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i} className="border-b border-hairline">
                      {selectable && <td className="pl-4 pr-2 py-3"><div className="size-4 rounded bg-ink-100 animate-pulse" /></td>}
                      {cols.map((_, j) => (
                        <td key={j} className="px-3 py-3">
                          {j === 0 && activeTab !== "exercises"
                            ? <div className="flex items-center gap-2.5"><div className="size-8 rounded-full bg-ink-100 animate-pulse" /><div className="h-3.5 w-32 rounded bg-ink-100 animate-pulse" /></div>
                            : <div className="h-3.5 rounded bg-ink-100 animate-pulse" style={{ width: `${40 + ((i + j) % 4) * 15}%` }} />}
                        </td>
                      ))}
                    </tr>
                  ))
                ) : pagedData.length === 0 ? (
                  <tr>
                    <td colSpan={colSpan}>
                      <div className="flex flex-col items-center justify-center text-center py-16">
                        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-wash text-brand-strong mb-3">
                          {activeTab === "exercises" ? <Dumbbell className="h-6 w-6" /> : activeTab === "students" ? <Users className="h-6 w-6" /> : <HelpCircle className="h-6 w-6" />}
                        </span>
                        <h3 className="text-base font-semibold text-heading">
                          {activeTab === "exercises" && !(searchTerm || hasActiveFilters)
                            ? "There are no exercises to grade"
                            : `No ${activeTab} found`}
                        </h3>
                        <p className="mt-1 text-sm text-subtle max-w-sm">
                          {(searchTerm || hasActiveFilters)
                            ? "No results match your search or filters."
                            : activeTab === "exercises"
                              ? "Create an assignment or assessment first. Once learners submit, grading data will appear here."
                              : `There are no ${activeTab} to show here yet.`}
                        </p>
                        {(searchTerm || hasActiveFilters) && (
                          <button onClick={clearAllFilters} className="mt-4 inline-flex items-center gap-1.5 h-9 px-4 rounded-control border border-hairline-strong bg-surface text-sm font-semibold text-body hover:bg-row-hover transition-colors"><SearchX className="h-4 w-4" /> Clear filters</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  pagedData.map((item: any, idx: number) => {
                    const id = rowId(item);
                    const clickable = activeTab === "exercises" || activeTab === "students";
                    return (
                      <motion.tr
                        key={id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.15, delay: Math.min(idx, 12) * 0.012 }}
                        onClick={() => { if (activeTab === "exercises") handleSelectExercise(item); else if (activeTab === "students") handleSelectStudent(item); }}
                        className={`group border-b border-hairline last:border-0 transition-colors ${selectedIds.includes(id) ? "bg-brand-wash/50" : "hover:bg-row-hover"} ${clickable ? "cursor-pointer" : ""}`}
                      >
                        {selectable && (
                          <td className="pl-4 pr-2 py-3" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              aria-label={`Select ${item.exerciseName || item.name || "row"}`}
                              checked={selectedIds.includes(id)}
                              onChange={() => toggleOne(id)}
                              className="size-4 rounded border-hairline-strong accent-brand"
                            />
                          </td>
                        )}
                        {/* `index` is the ABSOLUTE position across pages
                            (not the page-local iterator) so the leading `#`
                            column continues from where the previous page
                            left off — page 2 starts at row 9, not row 1. */}
                        {(() => {
                          const absoluteIndex = (safePage - 1) * pageSize + idx;
                          if (activeTab === "exercises")
                            return <ExerciseCells item={item} index={absoluteIndex} />;
                          if (activeTab === "students")
                            return <StudentCells item={item} index={absoluteIndex} selectedExercise={selectedExercise} onDetails={() => setDetailStudent(item)} />;
                          return <QuestionCells item={item} index={absoluteIndex} />;
                        })()}
                      </motion.tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pager — shared TableFooter (same widget User Management and
              Course Setup use), sitting BELOW the scroll body so it's
              always in view. Trainer navigates 10 rows/page rather than
              scrolling through everything. A tiny "Showing N-M of T" label
              sits on the left so the range stays visible next to the
              buttons — the shared TableFooter renders only the centered
              pager, so the range strip is a sibling. */}
          {/* Footer — count on the left, pager CENTERED, empty balance
              on the right. Uses a 1fr/auto/1fr grid so the pager is
              mathematically centred regardless of how wide the count
              text is. Was `justify-between` before, which pinned the
              pager to the right corner. */}
          {!loading && totalFiltered > 0 && (
            <div className="shrink-0 grid grid-cols-[1fr_auto_1fr] items-center gap-3 border-t border-hairline px-1 py-2">
              <p className="text-2xs text-subtle tabular-nums truncate">
                Showing <span className="font-semibold text-body">{rangeStart}-{rangeEnd}</span> of {totalFiltered} {activeTab}
                {(searchTerm || hasActiveFilters) && " (filtered)"}
              </p>
              <div className="flex justify-center">
                {totalPages > 1 && (
                  <TableFooter
                    from={rangeStart}
                    to={rangeEnd}
                    total={totalFiltered}
                    pageSize={pageSize}
                    onPageSize={() => { /* fixed size — matches User Management */ }}
                    currentPage={safePage}
                    totalPages={totalPages}
                    onPage={setCurrentPage}
                  />
                )}
              </div>
              <div />
            </div>
          )}
        </div>
          );
        })()}
      </div>

      {/* ── Bulk bar (rows selected on Exercises or Students) ──
          Floats over the workspace. Excel + PDF + Print all act on the
          SAME selection because `buildExportRows()` reads `selectedIds`
          first (see that helper), so the trainer picks a subset once and
          all three actions honour it. Only mounted on tabs that CAN
          select (Exercises, Students) — Questions has no checkbox
          column, so the bar can never appear there. */}
      <AnimatePresence>
        {(activeTab === "exercises" || activeTab === "students") && selectedIds.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
            className="fixed bottom-5 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 rounded-2xl border border-hairline-strong bg-surface px-3 py-2 shadow-xl"
          >
            <span className="inline-flex items-center gap-2 pl-1 text-sm font-medium text-heading">
              <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-brand-strong px-1.5 text-2xs font-bold text-white tabular-nums">{selectedIds.length}</span>
              selected
            </span>
            <div className="h-5 w-px bg-hairline" />
            <button
              type="button"
              onClick={exportXlsx}
              title="Export the selected rows as Excel"
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-control border border-success-500/25 bg-success-50 text-sm font-semibold text-success-700 hover:bg-success-50/70 transition-colors"
            >
              <FileSpreadsheet className="h-4 w-4" /> Export Excel
            </button>
            <button
              type="button"
              onClick={exportPdf}
              title="Export the selected rows as PDF"
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-control border border-danger-500/25 bg-danger-50 text-sm font-semibold text-danger-700 hover:bg-danger-50/70 transition-colors"
            >
              <FileText className="h-4 w-4" /> Export PDF
            </button>
            {/* Print on the bulk bar carries the same Normal / Overall
                split as the toolbar, so a trainer who has already picked
                rows never has to go back up to the toolbar to choose the
                nested report — both honour the selection. */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  title="Print the selected rows"
                  className="inline-flex items-center gap-1.5 h-8 px-3 rounded-control border border-hairline-strong bg-surface text-sm font-semibold text-body hover:bg-row-hover hover:text-heading transition-colors"
                >
                  <Printer className="h-4 w-4" /> Print
                  <ChevronDown className="h-3 w-3" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="center" side="top" sideOffset={6} className="w-52">
                <DropdownMenuItem onClick={openPrintWindow} className="cursor-pointer">
                  <Printer className="h-4 w-4 text-ink-500" /> Normal print
                </DropdownMenuItem>
                <DropdownMenuItem onClick={printOverall} className="cursor-pointer">
                  <Layers className="h-4 w-4 text-brand-strong" /> Overall print
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <button type="button" onClick={() => setSelectedIds([])} className="inline-flex items-center h-8 px-2.5 rounded-control text-sm font-medium text-subtle hover:bg-row-hover hover:text-heading transition-colors">Clear</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filter drawer removed — every filter is now an inline FloatingSelect
          on the toolbar (Section, Status, Pass / Fail, Difficulty), so
          there's no separate "Filters" surface to open. `showFilters`
          state is retained but unused; it drops out at the next cleanup. */}

      {/* ── Student details drawer ── */}
      <StudentDetailsDrawer student={detailStudent} selectedExercise={selectedExercise} onClose={() => setDetailStudent(null)} onViewQuestions={(s) => { setDetailStudent(null); handleSelectStudent(s); }} />
    </motion.div>
    </div>
  );

  // Embedded in a host screen (the We_Do / You_Do Grade action) — that screen
  // already provides the syllabus rail and workspace panel, so return the
  // content bare. Wrapping again would nest two shells and re-introduce the
  // full-page swap this mode exists to avoid.
  if (embedded) return <>{pageContent}</>;

  // Two shells, picked by where the trainer came from (see the syllabus-rail
  // block above):
  //
  //   • From inside the course syllabus (We_Do / You_Do three-dot ▸ Grade) →
  //     StaffLayout carrying the SAME CourseSidebar tree the resources screen
  //     shows, so the left rail does not change under them mid-task.
  //   • Any other entry (course-row Actions ▸ Grade, the standalone
  //     /lms/pages/grades picker) → the admin DashboardLayout, unchanged.
  if (showSyllabusRail) {
    return (
      <StaffLayout
        fullBleed
        sidebar={
          <div
            className="relative flex flex-col h-full flex-shrink-0"
            style={{
              width: `${railWidth}px`,
              overflow: "hidden",
              transition: railResizing ? "none" : "width 0.2s ease",
            }}
          >
            <CourseSidebar
              courseData={syllabusTree}
              selectedNode={railSelectedNode}
              expandedNodes={railExpanded}
              sidebarWidth={railWidth}
              searchQuery={railSearch}
              courseName={courseLightResponse?.data?.courseName || "Course"}
              moduleCount={syllabusTree[0]?.children?.length || 0}
              onNodeSelect={openSyllabusNode}
              onToggleNode={(id) => setRailExpanded(prev => {
                const next = new Set(prev);
                if (next.has(id)) next.delete(id); else next.add(id);
                return next;
              })}
              onExpandAll={() => {
                const ids = new Set<string>();
                const walk = (nodes: CourseNode[]) => nodes.forEach(n => {
                  if (n.children?.length) { ids.add(n.id); walk(n.children); }
                });
                walk(syllabusTree);
                setRailExpanded(ids);
              }}
              onCollapseAll={() => setRailExpanded(new Set())}
              onSidebarWidthChange={setRailWidth}
              onSearchChange={setRailSearch}
              isLoading={!syllabusTree.length}
              onMouseDown={(e) => { setRailResizing(true); e.preventDefault(); }}
            />
          </div>
        }
      >
        {pageContent}
      </StaffLayout>
    );
  }

  // Wrapped in the same DashboardLayout as User Management and Course Setup
  // so the Grades detail page carries the admin shell (sidebar, floating
  // workspace panel, canvas background) — was a full-screen bespoke page
  // before this pass, which is the difference the trainer flagged.
  return <DashboardLayout>{pageContent}</DashboardLayout>;
}
