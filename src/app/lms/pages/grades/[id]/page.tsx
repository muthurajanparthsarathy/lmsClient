"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, X, ArrowLeft, ChevronRight, ChevronDown, Check,
  GraduationCap, Dumbbell, Users, HelpCircle, Download, SearchX,
  Printer, FileSpreadsheet, FileText,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import DashboardLayout from "@/app/lms/component/layout";
import { pageEnter } from "@/app/lms/shared/ui";
import TableFooter from "@/app/lms/shared/listing/TableFooter";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { headersFor } from "../components/gradeHelpers";
import { ExerciseCells, StudentCells, QuestionCells } from "../components/GradeRows";
import StudentDetailsDrawer from "../components/StudentDetailsDrawer";
import { api } from "@/lib/apiClient";

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
        className={`relative inline-flex items-center h-10 min-w-[140px] pl-3 pr-8 rounded-control border text-sm font-medium transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-brand/15 ${
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
              : "top-1/2 -translate-y-1/2 text-sm text-faint font-medium"
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
        className={`relative inline-flex items-center h-10 min-w-[160px] pl-3 pr-8 rounded-control border text-sm font-medium transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-brand/15 ${
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
              : "top-1/2 -translate-y-1/2 text-sm text-faint font-medium"
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

// Main Component
export default function ExerciseStudentsQuestionsFlow() {
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
  const deepLinkExerciseId = searchParams?.get("exerciseId") || "";
  const deepLinkOpenTab = (searchParams?.get("openTab") as "exercises" | "students" | "questions" | null) || null;

  const [activeTab, setActiveTab] = useState<"exercises" | "students" | "questions">("exercises");
  const [courseId, setCourseId] = useState<string | null>(null);
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
    if (typeof window !== 'undefined') {
      const path = window.location.pathname;
      const parts = path.split('/');
      const courseIdIndex = parts.indexOf('grades') + 1;
      if (courseIdIndex < parts.length) {
        setCourseId(parts[courseIdIndex]);
      }
    }
  }, []);

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
            const total = p.overallScore || 0;
            const totalQ = Number(p.totalQuestions ?? selectedExercise?.totalQuestions ?? selectedExercise?.questions?.length ?? 0) || 0;
            const attendedQ = Number(
              p.attemptedQuestions ?? p.attendedQuestions ?? p.completedCount ?? p.completedQuestions ?? p.answeredQuestions
              ?? (typeof p.completionPercentage === "number" && totalQ > 0 ? Math.round((p.completionPercentage / 100) * totalQ) : 0),
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
    const compute = () => {
      const budget = Math.max(0, el.clientHeight - HEADER_H - FOOTER_H - SAFETY);
      const fits = Math.max(3, Math.min(50, Math.floor(budget / ROW_H)));
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
    if (courseData) items.push({ title: courseData.name || "Course", icon: GraduationCap });
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
  }, [courseData, selectedExercise, selectedStudent, activeTab]);

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
  // Reused by the bulk-select "Export CSV" button, the toolbar Export
  // dropdown, and the Print handler. Priority: explicit selection > the
  // current filtered set > every student. Columns match the on-screen
  // Student List: #, Name, Email, Total Questions, Attended, Marks
  // Scored, Grade, Status.
  const buildExportRows = () => {
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
    return source.map((s, i) => {
      const p = s.exerciseProgress || {};
      const scoreMax = p.totalMaxScore || selectedExercise?.totalPoints || 0;
      const scoreTotal = p.overallScore || 0;
      const pct = scoreMax > 0 ? (scoreTotal / scoreMax) * 100 : 0;
      const totalQ = Number(p.totalQuestions ?? selectedExercise?.totalQuestions ?? selectedExercise?.questions?.length ?? 0) || 0;
      const attendedQ = Number(
        p.attemptedQuestions ?? p.attendedQuestions ?? p.completedCount ?? p.completedQuestions ?? p.answeredQuestions
        ?? (typeof p.completionPercentage === "number" && totalQ > 0 ? Math.round((p.completionPercentage / 100) * totalQ) : 0),
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
        "Total Questions": totalQ,
        Attended: attendedQ,
        Marks: scoreMax > 0 ? `${scoreTotal}/${scoreMax}` : "",
        Grade: gradeLabel,
        Status: status,
      };
    });
  };

  // CSV — sanitises quotes, one row per student, header row derived from
  // the object keys so column order never drifts from the on-screen table.
  const exportCsv = () => {
    const rows = buildExportRows();
    if (!rows.length) return;
    const headers = Object.keys(rows[0]);
    const csv = [headers.join(","), ...rows.map(r => headers.map(h => `"${String((r as any)[h]).replace(/"/g, '""')}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    // Filename slug is tab-aware: student_list for the Students tab,
    // <student>_questions for the Questions drill.
    const suffix = activeTab === "questions"
      ? `${(selectedStudent?.name || "student").replace(/\s+/g, "_")}_questions`
      : "student_list";
    a.download = `${(courseData?.name || "course").replace(/\s+/g, "_")}_${selectedExercise?.exerciseName ? selectedExercise.exerciseName.replace(/\s+/g, "_") + "_" : ""}${suffix}.csv`;
    a.click();
    URL.revokeObjectURL(url);
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
  // ── Report header — the meta strip on both PDF and Print ──
  // Assignment vs Assessment comes from the exercise's We_Do / You_Do
  // section (missing → "Exercise"). Same wording the header rules on the
  // Exercises tab use for the Activity column label, so trainers see the
  // same term twice.
  const activityKind = selectedExercise?.section === "We_Do" ? "Assignment"
    : selectedExercise?.section === "You_Do" ? "Assessment"
      : "Exercise";
  const buildReportMeta = () => ({
    course: courseData?.name || "Course",
    activityKind,
    exerciseName: selectedExercise?.exerciseName || "",
    studentName: activeTab === "questions" ? (selectedStudent?.name || "") : "",
    generatedAt: new Date().toLocaleString(),
    rowCount: (typeof filteredData !== "undefined" ? filteredData.length : 0),
  });

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
    const listLabel = activeTab === "questions" ? "Question List" : "Student List";
    const rowNoun = activeTab === "questions"
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
    doc.setFontSize(9);
    doc.setTextColor(120, 120, 120);
    doc.text(`Generated on ${meta.generatedAt}  ·  ${rows.length} ${rowNoun}`, 40, y);
    y += 10;
    doc.setTextColor(0);

    // Column alignment — numeric columns right-aligned. Different sets
    // between tabs so we build the map from the header names rather than
    // hardcoding indices.
    const NUMERIC = new Set(["#", "Total Questions", "Attended", "Marks", "Mark Scored", "Attempts"]);
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
    const suffix = activeTab === "questions"
      ? `${(selectedStudent?.name || "student").replace(/\s+/g, "_")}_questions`
      : "student_list";
    const fname = `${meta.course.replace(/\s+/g, "_")}_${meta.exerciseName ? meta.exerciseName.replace(/\s+/g, "_") + "_" : ""}${suffix}.pdf`;
    doc.save(fname);
  };

  const openPrintWindow = () => {
    const rows = buildExportRows();
    if (!rows.length) return;
    const headers = Object.keys(rows[0]);
    const meta = buildReportMeta();
    const listLabel = activeTab === "questions" ? "Question List" : "Student List";
    const rowNoun = activeTab === "questions"
      ? `question${rows.length === 1 ? "" : "s"}`
      : `student${rows.length === 1 ? "" : "s"}`;
    // Numeric-column set matches the PDF exporter so both formats align
    // the same columns. Derived by header NAME so the mapping survives
    // when the columns change between tabs.
    const NUMERIC = new Set(["#", "Total Questions", "Attended", "Marks", "Mark Scored", "Attempts"]);
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
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.open();
    win.document.write(html);
    win.document.close();
    const doPrint = () => { try { win.focus(); win.print(); } catch { /* popup closed */ } };
    if (win.document.readyState === "complete") setTimeout(doPrint, 100);
    else win.onload = () => setTimeout(doPrint, 100);
  };

  // Kept for the bulk-select action bar's "Export CSV" — same code path,
  // its own callable name for readability at the call site.
  const exportSelected = exportCsv;

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
    <motion.div
      variants={pageEnter}
      initial="hidden"
      animate="visible"
      className="flex flex-1 min-h-0 flex-col px-4 sm:px-6 lg:px-8 pt-3 pb-3 text-body"
    >
      {/* ── Command bar ── */}
      <header className="shrink-0">
        {/* Drill breadcrumb — rendered only when there's actually a drill
            trail to show (Course › Exercise › Student). Empty on the first
            Exercises view so the header opens flush against the toolbar,
            matching User Management's slim top layout. */}
        {crumbs.length > 0 && (
          <div className="pt-1 pb-2">
            <nav className="flex items-center gap-1 text-xs overflow-x-auto custom-scrollbar" aria-label="Breadcrumb">
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
          </div>
        )}

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
                if (activeTab === "questions") return handleBackToStudents();
                if (activeTab === "students") return handleBackToExercises();
                if (returnTo) return router.push(returnTo);
                return router.back();
              }}
              className="inline-flex size-8 items-center justify-center rounded-control text-subtle hover:bg-row-hover hover:text-heading transition-colors duration-150 shrink-0"
              title="Back"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="min-w-0">
              {/* On the Students tab the page title becomes just "Student
                  List" — a single-line heading rather than "Grades" + a
                  "Student List" subtitle stacked underneath (which read
                  as two labels for the same page). The Questions drill
                  keeps the two-line title/subtitle because the subtitle
                  there carries the student's name. */}
              {/* Single-line title on both drill tabs:
                    Students  → "Student List"
                    Questions → "Question List"
                  Subtitle dropped on Questions too — the student's name
                  still shows in the drill breadcrumb above, so echoing
                  it here was pure duplication. */}
              <h1 className="text-base sm:text-lg font-semibold text-heading tracking-[-0.01em] leading-tight truncate">
                {activeTab === "students" ? "Student List"
                  : activeTab === "questions" ? "Question List"
                    : pageTitle}
              </h1>
            </div>
          </div>

          {/* Top-right cluster — Export + Print. Placed on the heading row
              (not the search toolbar) so they read as PAGE-level actions,
              matching Client Management's top-right corner treatment.
              Shown on the Students AND Questions tabs — buildExportRows
              picks up the active tab's data, filename builders too. */}
          {(activeTab === "students" || activeTab === "questions") && (
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  {/* Coloured Export — success-tone (green), the design
                      system's palette for "data download" style actions.
                      Stands out from the neutral Print sibling next to
                      it, so the trainer's eye lands on the primary
                      download choice first. */}
                  <button
                    type="button"
                    aria-label={activeTab === "questions" ? "Export question list" : "Export student list"}
                    className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-control border border-success-500/30 bg-success-50 text-success-700 text-xs font-semibold hover:bg-success-50/70 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-success-500/30"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Export</span>
                    <ChevronDown className="w-3 h-3" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" sideOffset={6} className="w-40">
                  <DropdownMenuItem onClick={exportCsv} className="cursor-pointer">
                    <FileSpreadsheet className="h-4 w-4 text-success-700" /> CSV
                  </DropdownMenuItem>
                  {/* PDF downloads DIRECTLY via jsPDF + autotable — no
                      more print dialog + Save-as-PDF dance. Same
                      column set as the CSV. */}
                  <DropdownMenuItem onClick={exportPdf} className="cursor-pointer">
                    <FileText className="h-4 w-4 text-danger-500" /> PDF
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <button
                type="button"
                onClick={openPrintWindow}
                title={activeTab === "questions" ? "Print the question list" : "Print the student list"}
                className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-control border border-hairline-strong bg-surface text-xs font-medium text-body hover:bg-row-hover hover:text-heading transition-colors duration-150"
              >
                <Printer className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Print</span>
              </button>
            </div>
          )}
        </div>

        {/* One toolbar — search left · Section select · Filter right. Slim
            `h-8` compact bar with `text-xs` placeholder, exactly matching
            Course Setup / User Management. Mirrors those pages' cluster
            layout so the eye lands on the same controls in the same places. */}
        <div className="mt-3 flex items-center gap-2 flex-wrap min-w-0">
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
                {/* Export + Print moved out of the search toolbar and onto
                    the heading row's right corner — see the top-right
                    cluster above. Only the filters stay here. */}
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
      <div ref={tableCardRef} className="mt-3 flex-1 min-h-0 flex flex-col">
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
          const colSpan = cols.length + (activeTab === "students" ? 1 : 0);
          return (
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          {/* No scroll: overflow-hidden on both axes. The auto-fit page size
              picks how many rows fit and everything else spills to the next
              page, so the body never needs a vertical scrollbar; table-
              layout:fixed + per-column widths (via <colgroup> below) keeps
              content from ever pushing sideways. */}
          <div className="flex-1 min-h-0 overflow-hidden">
            <table className="w-full text-left text-sm" style={{ tableLayout: "fixed" }}>
              {/* Column widths per tab. Sum to 100% so the table fits its
                  container exactly with no horizontal overflow. Cells that
                  hold long text (Name, Email) use `truncate` + `title` for
                  hover tooltips. */}
              {activeTab === "students" && (
                // TEN columns: the row-select checkbox (rendered by the
                // page separately from the cells component) sits before
                // everything else, so the colgroup MUST declare it too —
                // without it the browser reverted to auto sizing for the
                // last columns and Actions slid off the right edge.
                //
                // Checkbox(4) + #(3) + Name(19) + Email(21) + Questions(9)
                //   + Attended(8) + Marks(8) + Grade(8) + Status(12)
                //   + Actions(8) = 100 %.
                <colgroup>
                  <col style={{ width: "4%" }} />
                  <col style={{ width: "3%" }} />
                  <col style={{ width: "19%" }} />
                  <col style={{ width: "21%" }} />
                  <col style={{ width: "9%" }} />
                  <col style={{ width: "8%" }} />
                  <col style={{ width: "8%" }} />
                  <col style={{ width: "8%" }} />
                  <col style={{ width: "12%" }} />
                  <col style={{ width: "8%" }} />
                </colgroup>
              )}
              {activeTab === "exercises" && (
                // #(3) + Activity name (auto) + Total Questions(13) +
                // Total Marks(12) + Actions(14). Numeric columns widened
                // from 10 % → 13/12 % so the newly-restored "Total X"
                // headers fit on one line at all viewport widths.
                <colgroup>
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
                  {activeTab === "students" && (
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
                      {activeTab === "students" && <td className="pl-4 pr-2 py-3"><div className="size-4 rounded bg-ink-100 animate-pulse" /></td>}
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
                        <h3 className="text-base font-semibold text-heading">No {activeTab} found</h3>
                        <p className="mt-1 text-sm text-subtle max-w-sm">
                          {(searchTerm || hasActiveFilters) ? "No results match your search or filters." : `There are no ${activeTab} to show here yet.`}
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
                        {activeTab === "students" && (
                          <td className="pl-4 pr-2 py-3" onClick={(e) => e.stopPropagation()}>
                            <input type="checkbox" aria-label={`Select ${item.name}`} checked={selectedIds.includes(id)} onChange={() => toggleOne(id)} className="size-4 rounded border-hairline-strong accent-brand" />
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

      {/* ── Bulk bar (students selection) ── */}
      <AnimatePresence>
        {activeTab === "students" && selectedIds.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
            className="fixed bottom-5 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 rounded-2xl border border-hairline-strong bg-surface px-3 py-2 shadow-xl"
          >
            <span className="inline-flex items-center gap-2 pl-1 text-sm font-medium text-heading">
              <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-brand-strong px-1.5 text-2xs font-bold text-white tabular-nums">{selectedIds.length}</span>
              selected
            </span>
            <div className="h-5 w-px bg-hairline" />
            {/* CSV + PDF side by side — both act on the SAME selection
                because `buildExportRows()` reads `selectedIds` first (see
                that helper). Icons and colour cues match the toolbar's
                Export dropdown so the trainer sees the same treatment
                in both places. */}
            <button
              type="button"
              onClick={exportSelected}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-control border border-success-500/25 bg-success-50 text-sm font-semibold text-success-700 hover:bg-success-50/70 transition-colors"
            >
              <FileSpreadsheet className="h-4 w-4" /> Export CSV
            </button>
            <button
              type="button"
              onClick={exportPdf}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-control border border-danger-500/25 bg-danger-50 text-sm font-semibold text-danger-700 hover:bg-danger-50/70 transition-colors"
            >
              <FileText className="h-4 w-4" /> Export PDF
            </button>
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

  // Wrapped in the same DashboardLayout as User Management and Course Setup
  // so the Grades detail page carries the admin shell (sidebar, floating
  // workspace panel, canvas background) — was a full-screen bespoke page
  // before this pass, which is the difference the trainer flagged.
  return <DashboardLayout>{pageContent}</DashboardLayout>;
}
