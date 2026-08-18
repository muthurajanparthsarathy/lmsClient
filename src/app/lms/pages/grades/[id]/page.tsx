"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Poppins } from "next/font/google";
import {
  Search, X, SlidersHorizontal, ArrowLeft, ChevronRight, Home, BookOpen,
  GraduationCap, Dumbbell, Users, HelpCircle, Download, SearchX,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { Drawer } from "@/app/lms/shared/ui";
import { headersFor } from "../components/gradeHelpers";
import { ExerciseCells, StudentCells, QuestionCells } from "../components/GradeRows";
import FilterSelect from "../components/FilterSelect";
import StudentDetailsDrawer from "../components/StudentDetailsDrawer";
import { api } from "@/lib/apiClient";

const poppins = Poppins({ subsets: ["latin"], weight: ["400", "500", "600", "700"], display: "swap" });

// Main Component
export default function ExerciseStudentsQuestionsFlow() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"exercises" | "students" | "questions">("exercises");
  const [courseId, setCourseId] = useState<string | null>(null);
  const [selectedExercise, setSelectedExercise] = useState<any>(null);
  const [selectedStudent, setSelectedStudent] = useState<any>(null);

  // Filter states
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sectionFilter, setSectionFilter] = useState("all");
  const [difficultyFilter, setDifficultyFilter] = useState("all");
  const [showFilters, setShowFilters] = useState(false);
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
          matchesStatus = item.exerciseProgress?.status === statusFilter;
        } else if (activeTab === "questions") {
          matchesStatus = item.studentAttempt?.status === statusFilter;
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
      if (activeTab === "exercises" && sectionFilter !== "all") {
        if (item.section !== sectionFilter) return false;
      }

      // Difficulty filter (for questions only)
      if (activeTab === "questions" && difficultyFilter !== "all") {
        if (item.difficulty !== difficultyFilter) return false;
      }

      return true;
    });
  }, [activeTab, exercises, students, questions, searchTerm, statusFilter, sectionFilter, difficultyFilter, passFailFilter]);

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
    setSectionFilter("all");
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
          statusOptions: [
            { value: "all", label: "All Status" },
            { value: "completed", label: "Completed" },
            { value: "in_progress", label: "In Progress" },
            { value: "not_started", label: "Not Started" },
            { value: "evaluated", label: "Evaluated" }
          ],
          passFailOptions: [
            { value: "all", label: "All Students" },
            { value: "pass", label: "Pass" },
            { value: "fail", label: "Fail" }
          ]
        };
      case "questions":
        return {
          statusOptions: [
            { value: "all", label: "All Status" },
            { value: "solved", label: "Solved" },
            { value: "partially_solved", label: "Partially Solved" },
            { value: "failed", label: "Failed" },
            { value: "not_attempted", label: "Not Attempted" }
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
    setSectionFilter("all");
    setDifficultyFilter("all");
    setPassFailFilter("all");
  };

  const hasActiveFilters = statusFilter !== "all" || sectionFilter !== "all" || difficultyFilter !== "all" || passFailFilter !== "all";
  const activeFilterCount =
    (statusFilter !== "all" ? 1 : 0) + (sectionFilter !== "all" ? 1 : 0) +
    (difficultyFilter !== "all" ? 1 : 0) + (passFailFilter !== "all" ? 1 : 0);

  // ── Breadcrumb path (Course › Exercise › Student › Tab) ──
  const crumbs = useMemo(() => {
    const items: { title: string; icon: React.ElementType; onClick?: () => void }[] = [
      { title: "Dashboard", icon: Home, onClick: () => router.push('/lms/pages/studentdashboard') },
      { title: "Grades", icon: BookOpen, onClick: () => router.push('/lms/pages/grades') },
    ];
    if (courseData) items.push({ title: courseData.name || "Course", icon: GraduationCap });
    if (selectedExercise) items.push({ title: selectedExercise.exerciseName, icon: Dumbbell, onClick: handleBackToExercises });
    if (selectedStudent) items.push({ title: selectedStudent.name, icon: Users, onClick: handleBackToStudents });
    items.push({
      title: activeTab === "exercises" ? "Exercises" : activeTab === "students" ? "Students" : "Questions",
      icon: activeTab === "exercises" ? Dumbbell : activeTab === "students" ? Users : HelpCircle,
    });
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
        { label: "Questions", value: exercises.reduce((s, e) => s + (e.totalQuestions || 0), 0), dot: "bg-info-500" },
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

  const exportSelected = () => {
    const chosen = students.filter(s => selectedIds.includes(rowId(s)));
    const rows = (chosen.length ? chosen : students).map(s => {
      const p = s.exerciseProgress || {};
      const max = p.totalMaxScore || selectedExercise?.totalPoints || 0;
      return {
        Name: s.name || "", Email: s.email || "",
        "Progress %": p.completionPercentage ?? 0,
        Score: p.overallScore ?? 0, Max: max,
        Result: p.isPassing ? "Pass" : (p.overallScore ? "Fail" : "No attempt"),
        Status: p.status || "not_started",
      };
    });
    if (!rows.length) return;
    const headers = Object.keys(rows[0]);
    const csv = [headers.join(","), ...rows.map(r => headers.map(h => `"${String((r as any)[h]).replace(/"/g, '""')}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `grades_${selectedExercise?.exerciseName || "students"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const pageTitle = courseData?.name || "Gradebook";
  const contextLabel =
    activeTab === "exercises" ? "Exercises"
      : activeTab === "students" ? `Students · ${selectedExercise?.exerciseName || "Exercise"}`
        : `Questions · ${selectedStudent?.name || "Student"}`;

  const searchPlaceholder =
    activeTab === "exercises" ? "Search exercises…" :
      activeTab === "students" ? "Search students by name or email…" :
        "Search questions…";

  const totalForTab = activeTab === "exercises" ? exercises.length : activeTab === "students" ? students.length : questions.length;

  return (
    <div className={`${poppins.className} h-screen flex flex-col bg-canvas overflow-hidden text-body`}>
      {/* ── Command bar ── */}
      <header className="shrink-0 bg-surface border-b border-hairline">
        {/* Breadcrumb */}
        <div className="px-5 pt-2.5">
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

        {/* Title + toolbar */}
        <div className="px-5 py-2.5 flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={() => activeTab === "questions" ? handleBackToStudents() : activeTab === "students" ? handleBackToExercises() : router.push('/lms/pages/grades')}
            className="h-9 w-9 flex items-center justify-center rounded-control text-subtle hover:bg-row-hover hover:text-heading transition-colors shrink-0"
            title="Back"
          >
            <ArrowLeft className="w-4.5 h-4.5" />
          </button>
          <div className="min-w-0">
            <h1 className="text-lg font-semibold text-heading tracking-[-0.01em] leading-tight truncate">{pageTitle}</h1>
            <p className="text-2xs text-subtle leading-tight">{contextLabel}</p>
          </div>

          <div className="ml-auto flex items-center gap-2">
            {/* Search */}
            <div className="relative w-44 sm:w-64">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={searchPlaceholder}
                className="h-9 w-full rounded-control border border-hairline-strong bg-surface pl-8 pr-8 text-sm text-body placeholder:text-faint transition-colors focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15"
              />
              {searchTerm && (
                <button type="button" aria-label="Clear" onClick={() => setSearchTerm("")} className="absolute right-2 top-1/2 inline-flex size-6 -translate-y-1/2 items-center justify-center rounded-chip text-faint hover:bg-ink-100 hover:text-heading transition-colors"><X className="h-3.5 w-3.5" /></button>
              )}
            </div>
            {/* Filter */}
            <button
              type="button"
              onClick={() => setShowFilters(true)}
              className={`relative inline-flex h-9 items-center gap-1.5 rounded-control border px-3 text-sm font-medium transition-colors ${
                hasActiveFilters ? "border-brand bg-brand-wash text-brand-strong" : "border-hairline-strong bg-surface text-body hover:bg-row-hover"
              }`}
            >
              <SlidersHorizontal className="h-4 w-4" />
              <span className="hidden sm:inline">Filter</span>
              {activeFilterCount > 0 && <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-strong px-1 text-2xs font-bold tabular-nums text-white">{activeFilterCount}</span>}
            </button>
          </div>
        </div>

        {/* Summary chips */}
        <div className="px-5 pb-2.5 flex items-center gap-2 flex-wrap">
          {chips.map(c => (
            <span key={c.label} className="inline-flex items-center gap-1.5 h-7 rounded-full border border-hairline bg-canvas px-2.5 text-xs font-medium text-body">
              <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />
              {c.label}
              <span className="tabular-nums font-semibold text-heading">{c.value}</span>
            </span>
          ))}
        </div>
      </header>

      {/* ── Table workspace ── */}
      <div className="flex-1 min-h-0 px-5 py-4 flex flex-col">
        <div className="flex-1 min-h-0 rounded-tile border border-hairline bg-surface shadow-xs flex flex-col overflow-hidden">
          <div className="flex-1 min-h-0 overflow-auto custom-scrollbar">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 z-10 bg-canvas border-b border-hairline">
                <tr>
                  {activeTab === "students" && (
                    <th className="w-10 pl-4 pr-2 py-2.5">
                      <input type="checkbox" aria-label="Select all" checked={allSelected} ref={el => { if (el) el.indeterminate = someSelected && !allSelected; }} onChange={toggleAll} disabled={loading || filteredData.length === 0} className="size-4 rounded border-hairline-strong accent-brand" />
                    </th>
                  )}
                  {headersFor(activeTab).map((h, i) => (
                    <th key={i} className={`py-2.5 px-3 text-2xs font-semibold uppercase tracking-wider text-subtle whitespace-nowrap ${h.align === 'right' ? 'text-right' : ''}`}>{h.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i} className="border-b border-hairline">
                      {activeTab === "students" && <td className="pl-4 pr-2 py-3"><div className="size-4 rounded bg-ink-100 animate-pulse" /></td>}
                      {headersFor(activeTab).map((_, j) => (
                        <td key={j} className="px-3 py-3">
                          {j === 0 && activeTab !== "exercises"
                            ? <div className="flex items-center gap-2.5"><div className="size-8 rounded-full bg-ink-100 animate-pulse" /><div className="h-3.5 w-32 rounded bg-ink-100 animate-pulse" /></div>
                            : <div className="h-3.5 rounded bg-ink-100 animate-pulse" style={{ width: `${40 + ((i + j) % 4) * 15}%` }} />}
                        </td>
                      ))}
                    </tr>
                  ))
                ) : filteredData.length === 0 ? (
                  <tr>
                    <td colSpan={headersFor(activeTab).length + (activeTab === "students" ? 1 : 0)}>
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
                  filteredData.map((item: any, idx: number) => {
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
                        {activeTab === "exercises" && <ExerciseCells item={item} index={idx} />}
                        {activeTab === "students" && <StudentCells item={item} index={idx} selectedExercise={selectedExercise} onDetails={() => setDetailStudent(item)} />}
                        {activeTab === "questions" && <QuestionCells item={item} index={idx} />}
                      </motion.tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          <div className="shrink-0 flex items-center justify-between gap-3 border-t border-hairline bg-canvas px-4 py-2">
            <p className="text-2xs text-subtle tabular-nums">
              Showing <span className="font-semibold text-body">{filteredData.length}</span> of {totalForTab} {activeTab}
              {(searchTerm || hasActiveFilters) && " (filtered)"}
            </p>
          </div>
        </div>
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
            <button type="button" onClick={exportSelected} className="inline-flex items-center gap-1.5 h-8 px-3 rounded-control text-sm font-semibold text-body hover:bg-row-hover transition-colors"><Download className="h-4 w-4" /> Export CSV</button>
            <button type="button" onClick={() => setSelectedIds([])} className="inline-flex items-center h-8 px-2.5 rounded-control text-sm font-medium text-subtle hover:bg-row-hover hover:text-heading transition-colors">Clear</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Filter drawer ── */}
      <Drawer
        open={showFilters}
        onClose={() => setShowFilters(false)}
        width="md"
        title="Filters"
        description={`Refine the ${activeTab} list. Filters never change saved data.`}
        footer={
          <>
            <button type="button" onClick={clearAllFilters} disabled={!hasActiveFilters} className="inline-flex items-center h-9 px-3.5 rounded-control border border-hairline-strong bg-surface text-sm font-medium text-body hover:bg-row-hover disabled:opacity-40 disabled:pointer-events-none transition-colors">Reset</button>
            <button type="button" onClick={() => setShowFilters(false)} className="inline-flex items-center h-9 px-4 rounded-control bg-brand-strong text-white text-sm font-semibold shadow-xs hover:bg-brand-800 transition-colors">Apply filters</button>
          </>
        }
      >
        <div className="space-y-6">
          <FilterSelect label="Status" value={statusFilter} onChange={setStatusFilter} options={filterOptions.statusOptions} />
          {activeTab === "students" && filterOptions.passFailOptions && (
            <FilterSelect label="Pass / Fail" value={passFailFilter} onChange={setPassFailFilter} options={filterOptions.passFailOptions} />
          )}
          {activeTab === "exercises" && filterOptions.sectionOptions && (
            <FilterSelect label="Section" value={sectionFilter} onChange={setSectionFilter} options={filterOptions.sectionOptions} />
          )}
          {activeTab === "questions" && filterOptions.difficultyOptions && (
            <FilterSelect label="Difficulty" value={difficultyFilter} onChange={setDifficultyFilter} options={filterOptions.difficultyOptions} />
          )}
        </div>
      </Drawer>

      {/* ── Student details drawer ── */}
      <StudentDetailsDrawer student={detailStudent} selectedExercise={selectedExercise} onClose={() => setDetailStudent(null)} onViewQuestions={(s) => { setDetailStudent(null); handleSelectStudent(s); }} />
    </div>
  );
}
