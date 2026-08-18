'use client';

import { Loading } from "@/components/loading-ui/loading";
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  AlertCircle, ChevronDown, CircleCheck,
  ListChecks, Plus, SlidersHorizontal, Terminal, X,
  Search, MoreHorizontal, Download, List, Rows3, Trash2, Power,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import MCQFields from '@/app/lms/component/questionbank/MCQFields';
import CreateQuestionModal from '@/app/lms/component/questionbank/create/CreateQuestionModal';
import { questionBankService } from '@/apiServices/questionBankService';
import { Question } from '@/apiServices/type/question';
import DashboardLayout from '@/app/lms/component/layout';
import { StaffLayout } from '@/app/lms/component/stafflayout/staff-layout';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { easeStandard, pageEnter } from '@/app/lms/shared/ui';
import ProgrammingWorkspace, {
  coerceDraft,
  type ProgrammingDraft,
  type PublishOutcome,
} from './ProgrammingWorkspace';
import QuestionsTable from './QuestionsTable';
import QuestionDetailDrawer from './QuestionDetailDrawer';
import QuestionFilterPanel from './QuestionFilterPanel';
import TableFooter from '@/app/lms/shared/listing/TableFooter';
import { HeaderStats } from '@/app/lms/shared/ui/HeaderStats';
import { getDifficulty, getQuestionTitleText } from './lib';
import { usePermissions } from '@/hooks/usePermissions';
import { PERMISSION_IDS } from '@/components/permissions';
import {
  useQuestionBankPageQuery,
  useInvalidateQuestionBank,
  useDeleteQuestionMutation,
  useToggleQuestionStatusMutation,
} from '@/queries/questionBank';

// ─── Category (sub-type) ⇄ stored questionType discriminator ───────────────────
// The Question Bank stores the *specific* type in `questionType` so that Core,
// Frontend and Database questions are distinguishable downstream (the assessment
// flow already expects 'programming' | 'frontend' | 'database' | 'mcq').
// `questionCategory` is the broad bucket and is always "Programming" for this modal.
const CATEGORY_TO_QUESTION_TYPE: Record<string, 'programming' | 'frontend' | 'database'> = {
  core: 'programming',
  frontend: 'frontend',
  database: 'database',
};

const questionTypeFromCategory = (category?: string): 'programming' | 'frontend' | 'database' =>
  CATEGORY_TO_QUESTION_TYPE[(category as string) || 'core'] || 'programming';

// The sub-type isn't persisted separately, so derive it back from questionType when editing.
const categoryFromQuestionType = (questionType?: string): 'core' | 'frontend' | 'database' => {
  const v = (questionType || '').toLowerCase();
  if (v === 'frontend') return 'frontend';
  if (v === 'database') return 'database';
  return 'core';
};

// Case-insensitive so both new ('mcq') and legacy ('MCQ') data are handled.
const isMcqType = (questionType?: string) => (questionType || '').toLowerCase() === 'mcq';

// ─── Payload builder — only sends fields relevant to the chosen category ──────
const buildProgrammingPayload = (question: Partial<Question>) => {
  const category = (question.category as 'core' | 'frontend' | 'database') || 'core';

  const base = {
    // Broad bucket. Defaults to "Programming"; the workspace's Basic
    // Information → Category field can file it somewhere else.
    questionCategory: (question.questionCategory || 'Programming').trim() || 'Programming',
    // Specific type — derived from the Core / Frontend / Database selector.
    questionType: questionTypeFromCategory(category),
    isActive: question.isActive !== undefined ? question.isActive : true,
    title: question.title || '',
    description: question.description || '',
    difficulty: (['easy', 'medium', 'hard'].includes(question.difficulty as string)
      ? question.difficulty
      : 'medium') as 'easy' | 'medium' | 'hard',
    category,
    // Editable in the workspace, so they have to be sent.
    sampleInput: question.sampleInput || '',
    sampleOutput: question.sampleOutput || '',
    score: question.score || 0,
    constraints: question.constraints || [],
    hints: (question.hints || []).map((h: any, idx: number) => ({
      hintText: h.hintText || '',
      isPublic: h.isPublic || false,
      sequence: h.sequence || idx + 1,
    })),
  };

  if (category === 'core') {
    return {
      ...base,
      testCases: (question.testCases || []).map((tc: any) => ({
        input: tc.input || '',
        expectedOutput: tc.expectedOutput || '',
        isSample: tc.isSample || false,
        isHidden: tc.isHidden || false,
        explanation: tc.explanation || '',
      })),
      solutions: question.solutions || { startedCode: '', functionName: '', language: 'javascript' },
    };
  }

  if (category === 'frontend') {
    return {
      ...base,
      constraints: question.constraints || [],
    };
  }

  if (category === 'database') {
    return {
      ...base,
      sampleQuery: question.sampleQuery || '',  // ✅ Make sure this is included
      expectedResult: question.expectedResult || '',  // ✅ Make sure this is included
    };
  }

  return base;
};

// Created-Date filter presets → earliest createdAt that still passes (0 = off).
const dateCutoff = (d: string): number => {
  const day = 86400000;
  if (d === '7') return Date.now() - 7 * day;
  if (d === '30') return Date.now() - 30 * day;
  if (d === '90') return Date.now() - 90 * day;
  if (d === 'year') return new Date(new Date().getFullYear(), 0, 1).getTime();
  return 0;
};

// Whether a question's marks (score) fall in a range bucket.
const inMarksRange = (score: number, range: string): boolean => {
  if (range === '1-5') return score >= 1 && score <= 5;
  if (range === '6-10') return score >= 6 && score <= 10;
  if (range === '11-20') return score >= 11 && score <= 20;
  if (range === '20+') return score > 20;
  return true;
};

// MCQ score defaults to 10, programming to its own score (mirrors lib.getScore).
const scoreOf = (q: Question): number =>
  (q.questionType || '').toLowerCase() === 'mcq' ? (q.mcqQuestionScore || 10) : (q.score || 0);

// ─── Component ────────────────────────────────────────────────────────────────
export default function QuestionBankPage() {
  const [userRole, setUserRole] = useState<string | null>(null);
  // Question Bank appears in both admin and staff shells, so accept either
  // permission scope for each functionality.
  const { can } = usePermissions();
  const canCreate =
    can(PERMISSION_IDS.ADMIN_QUESTION_BANKS, 'Create Question') ||
    can(PERMISSION_IDS.STAFF_QUESTION_BANKS, 'Create Question');
  const canView =
    can(PERMISSION_IDS.ADMIN_QUESTION_BANKS, 'View Details') ||
    can(PERMISSION_IDS.STAFF_QUESTION_BANKS, 'View Details');
  const canEdit =
    can(PERMISSION_IDS.ADMIN_QUESTION_BANKS, 'Edit') ||
    can(PERMISSION_IDS.STAFF_QUESTION_BANKS, 'Edit');
  const canDelete =
    can(PERMISSION_IDS.ADMIN_QUESTION_BANKS, 'Delete') ||
    can(PERMISSION_IDS.STAFF_QUESTION_BANKS, 'Delete');
  const canToggle =
    can(PERMISSION_IDS.ADMIN_QUESTION_BANKS, 'Deactivate') ||
    can(PERMISSION_IDS.STAFF_QUESTION_BANKS, 'Deactivate');
  const refreshQuestions = useInvalidateQuestionBank();
  const deleteQuestionMutation = useDeleteQuestionMutation();
  const toggleStatusMutation = useToggleQuestionStatusMutation();
  // Saving an MCQ through the modal still blocks the page the way it did
  // before, so keep a local flag ORed into the list's own loading state.
  const [isSavingMcq, setIsSavingMcq] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showProgrammingWorkspace, setShowProgrammingWorkspace] = useState(false);
  // Non-null while the workspace is editing one existing programming question.
  const [editingDraft, setEditingDraft] = useState<ProgrammingDraft | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [selectedQuestionType, setSelectedQuestionType] = useState<'MCQ' | 'Programming'>('MCQ');

  const [filters, setFilters] = useState({
    questionType: '', category: '', difficulty: '', isActive: '', search: '',
    createdBy: '', marks: '', date: '',
  });


  // Presentation-only: the question shown in the right-side preview drawer.
  // Holds the row object itself, handed over by the table — never an id looked
  // up in a list, which is what lets it keep working now that only one page of
  // rows is in memory at a time.
  const [previewQuestion, setPreviewQuestion] = useState<Question | null>(null);
  // Presentation-only: list density (roomy vs dense).
  const [density, setDensity] = useState<'list' | 'compact'>('list');

  // Selection keeps the ROW, not just the id: it spans pages, and with the
  // bank paginated the rows for other pages are no longer in memory — the bulk
  // actions and "Export selected" both need the question objects themselves.
  const [selectedRows, setSelectedRows] = useState<Record<string, Question>>({});
  const selectedIds = useMemo(() => Object.keys(selectedRows), [selectedRows]);

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // The search box filtered on every keystroke while the whole bank sat in
  // memory. It is a request now, so it is debounced — short enough to still
  // feel like typing into a filter.
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(filters.search), 300);
    return () => clearTimeout(t);
  }, [filters.search]);

  // ── Lifecycle ──
  useEffect(() => {
    const role = localStorage.getItem('smartcliff_roleValue');
    setUserRole(role);
  }, []);

  // Changing a filter goes back to page 1. This adjusts state DURING render
  // rather than in an effect: as an effect it would commit the new filter with
  // the OLD page number first, so changing a filter while on page 3 fires a
  // request for page 3 and then immediately a second one for page 1. React
  // re-runs this render before committing, so only the page-1 request is made.
  const filterSignature = JSON.stringify([
    filters.questionType, filters.category, filters.difficulty, filters.isActive,
    filters.createdBy, filters.marks, filters.date, debouncedSearch,
  ]);
  const [lastFilterSignature, setLastFilterSignature] = useState(filterSignature);
  if (lastFilterSignature !== filterSignature) {
    setLastFilterSignature(filterSignature);
    setCurrentPage(1);
  }

  // Cutoff computed HERE, not on the server: the presets ("last 7 days", "this
  // year") are derived from the user's local clock. Memoised on the preset
  // alone — recomputing `Date.now()` every render would mint a new query key
  // every render and refetch forever.
  const createdAfter = useMemo(() => dateCutoff(filters.date), [filters.date]);

  const queryParams = useMemo(
    () => ({
      page: currentPage,
      limit: pageSize,
      questionType: filters.questionType,
      category: filters.category,
      difficulty: filters.difficulty,
      isActive: filters.isActive,
      createdBy: filters.createdBy,
      marks: filters.marks,
      ...(createdAfter ? { createdAfter } : {}),
      search: debouncedSearch,
    }),
    [
      currentPage, pageSize, filters.questionType, filters.category,
      filters.difficulty, filters.isActive, filters.createdBy, filters.marks,
      createdAfter, debouncedSearch,
    ],
  );

  // ── The bank read ──
  // The page used to pull the institution's ENTIRE embedded questions[] array
  // — 114,576 bytes for 89 questions, growing with the bank — and render every
  // row. The filters, the search and the sort now run on the server and one
  // page crosses the wire. The predicate below was NOT reimplemented there
  // from scratch: getAllQuestionsbank holds a field-for-field port of this
  // page's own `filteredQuestions`, checked against it over live data across
  // every filter, every page size and every deep page.
  const { data: pageData, isLoading: isListLoading } = useQuestionBankPageQuery(queryParams);

  // `keepPreviousData` keeps `isLoading` false once the first page has landed,
  // so paging and filtering swap rows in place instead of flashing the
  // skeleton — the MCQ save is still allowed to block the page as it always
  // did.
  const isLoading = isListLoading || isSavingMcq;

  const pageQuestions = useMemo(() => pageData?.questions ?? [], [pageData]);

  // Facets come from the server over the WHOLE bank, not this page: the
  // Category and Created By dropdowns and the four header chips would
  // otherwise shrink to whatever 25 rows happen to be on screen. `categories`
  // additionally feeds the MCQ modal and the programming workspace, which
  // offer it as the Category field's options.
  const categories = useMemo(() => pageData?.facets.categories ?? [], [pageData]);

  // ── Pagination ── All four numbers are the server's. `totalFiltered` is the
  // count of rows matching the filters, which is what the footer's
  // `filteredQuestions.length` used to be.
  const totalFiltered = pageData?.total ?? 0;
  const totalPages = pageData?.totalPages ?? 1;
  const safePage = Math.min(currentPage, totalPages);
  const rangeStart = totalFiltered === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const rangeEnd = Math.min(safePage * pageSize, totalFiltered);

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(t);
    }
  }, [toast]);

  // ── The filter predicate ──
  // The list itself is filtered on the server now; this survives because
  // selection spans pages and a selected row on some other page still has to
  // be tested against the current filters. Same rule the intersection with
  // `filteredQuestions` used to enforce — "a selection survives only while it
  // still matches" — evaluated over the handful of selected rows instead of
  // the whole bank. Kept field-for-field identical to the server's port.
  const matchesCurrentFilters = useCallback((q: Question) => {
    if (filters.questionType) {
      // The dropdown offers the broad buckets MCQ / Programming; "Programming"
      // matches every non-MCQ sub-type (programming / frontend / database).
      if (filters.questionType === 'MCQ' ? !isMcqType(q.questionType) : isMcqType(q.questionType)) return false;
    }
    if (filters.category && q.questionCategory !== filters.category) return false;
    if (filters.difficulty && q.difficulty !== filters.difficulty) return false;
    if (filters.isActive !== '' && q.isActive !== (filters.isActive === 'true')) return false;
    if (filters.createdBy && q.createdBy !== filters.createdBy) return false;
    if (filters.marks && !inMarksRange(scoreOf(q), filters.marks)) return false;
    if (createdAfter) {
      const c = q.createdAt ? new Date(q.createdAt).getTime() : 0;
      if (!(Boolean(c) && c >= createdAfter)) return false;
    }
    if (debouncedSearch) {
      const s = debouncedSearch.toLowerCase();
      if (!(
        (isMcqType(q.questionType) ? q.questionTitle : q.title)?.toLowerCase().includes(s) ||
        q.description?.toLowerCase().includes(s) ||
        q.questionCategory?.toLowerCase().includes(s)
      )) return false;
    }
    return true;
  }, [
    filters.questionType, filters.category, filters.difficulty, filters.isActive,
    filters.createdBy, filters.marks, createdAfter, debouncedSearch,
  ]);

  const showToast = (message: string, type: 'success' | 'error') => setToast({ message, type });

  const closeModal = () => {
    setShowCreateModal(false);
    setEditingQuestion(null);
  };

  // ── MCQ save (FormData path) ──
  // Routed through questionBankService instead of a bare fetch: the two
  // endpoints were hardcoded to http://localhost:5533, so this save could only
  // ever work against a local server. The service already wraps the exact same
  // POST/PUT multipart calls behind NEXT_PUBLIC_API_URL.
  const handleMCQSave = async (formData: FormData) => {
    try {
      setIsSavingMcq(true);
      const result: any = editingQuestion?._id
        ? await questionBankService.updateQuestion(editingQuestion._id, formData)
        : await questionBankService.createQuestion(formData);

      if (result?.success) {
        showToast(`Question ${editingQuestion ? 'updated' : 'saved'} successfully`, 'success');
        closeModal();
        await refreshQuestions();
      } else {
        throw new Error(result?.message || 'Failed to save question');
      }
    } catch (error: any) {
      showToast(`Failed to save MCQ: ${error.message || 'Unknown error'}`, 'error');
    } finally {
      setIsSavingMcq(false);
    }
  };

  // ── Edit / Delete / Toggle ──
  const handleEditQuestion = (question: Question) => {
    setEditingQuestion(question);
    const mcq = isMcqType(question.questionType);
    setSelectedQuestionType(mcq ? 'MCQ' : 'Programming');

    if (mcq) {
      setShowCreateModal(true);
      return;
    }

    // Programming questions open in the workspace, seeded with this one record.
    // The sub-type (Core / Frontend / Database) is restored from questionType.
    setEditingDraft(
      coerceDraft({
        ...question,
        category: categoryFromQuestionType(question.questionType),
      }),
    );
    setShowProgrammingWorkspace(true);
  };

  const handleDeleteQuestion = async (id: string) => {
    if (!confirm('Are you sure you want to delete this question?')) return;
    try {
      await deleteQuestionMutation.mutateAsync(id);
      showToast('Question deleted successfully', 'success');
    } catch {
      showToast('Failed to delete question', 'error');
    }
  };

  // The optimistic flip and the on-failure re-sync both live in the mutation
  // (see queries/questionBank.ts) — same behavior the inline setQuestions /
  // loadQuestions pair provided.
  const handleToggleStatus = async (id: string, status: boolean) => {
    try {
      await toggleStatusMutation.mutateAsync({ id, isActive: status });
      showToast(`Question ${status ? 'activated' : 'deactivated'}`, 'success');
    } catch {
      showToast('Failed to update status', 'error');
    }
  };

  // ── Stats ── Counted server-side over the whole bank, which is what these
  // four chips always showed — they are deliberately NOT scoped to the filters
  // or to the visible page.
  const stats = useMemo(() => {
    const s = pageData?.facets.stats;
    return [
      { label: 'Total', value: s?.total ?? 0 },
      { label: 'MCQ', value: s?.mcq ?? 0 },
      { label: 'Programming', value: s?.programming ?? 0 },
      { label: 'Active', value: s?.active ?? 0 },
    ];
  }, [pageData]);

  // ── Presentation-only derivations ──
  const activeFilterCount = [
    filters.questionType, filters.category, filters.difficulty, filters.isActive,
    filters.createdBy, filters.marks, filters.date,
  ].filter(v => v !== '').length;
  const hasActiveFilters = activeFilterCount > 0 || filters.search !== '';

  const clearFilters = () =>
    setFilters({ questionType: '', category: '', difficulty: '', isActive: '', search: '', createdBy: '', marks: '', date: '' });

  // Unique authors for the Created-By filter — over the whole bank, same as
  // the categories above.
  const createdByOptions = useMemo(() => pageData?.facets.createdBy ?? [], [pageData]);

  // Active-filter chips (search has its own box).
  const MARKS_LABEL: Record<string, string> = { '1-5': '1–5 marks', '6-10': '6–10 marks', '11-20': '11–20 marks', '20+': '20+ marks' };
  const DATE_LABEL: Record<string, string> = { '7': 'Last 7 days', '30': 'Last 30 days', '90': 'Last 90 days', year: 'This year' };
  const filterChips: { key: string; label: string; onRemove: () => void }[] = [
    ...(filters.questionType ? [{ key: 'type', label: filters.questionType, onRemove: () => setFilters(f => ({ ...f, questionType: '' })) }] : []),
    ...(filters.category ? [{ key: 'cat', label: filters.category, onRemove: () => setFilters(f => ({ ...f, category: '' })) }] : []),
    ...(filters.difficulty ? [{ key: 'diff', label: filters.difficulty.charAt(0).toUpperCase() + filters.difficulty.slice(1), onRemove: () => setFilters(f => ({ ...f, difficulty: '' })) }] : []),
    ...(filters.marks ? [{ key: 'marks', label: MARKS_LABEL[filters.marks] || filters.marks, onRemove: () => setFilters(f => ({ ...f, marks: '' })) }] : []),
    ...(filters.isActive ? [{ key: 'status', label: filters.isActive === 'true' ? 'Active' : 'Inactive', onRemove: () => setFilters(f => ({ ...f, isActive: '' })) }] : []),
    ...(filters.createdBy ? [{ key: 'by', label: filters.createdBy, onRemove: () => setFilters(f => ({ ...f, createdBy: '' })) }] : []),
    ...(filters.date ? [{ key: 'date', label: DATE_LABEL[filters.date] || filters.date, onRemove: () => setFilters(f => ({ ...f, date: '' })) }] : []),
  ];

  // Selected rows that still match the current filters. This used to be the
  // selected ids intersected with the loaded list; the off-page rows are no
  // longer loaded, so the retained row objects are re-tested directly. Keyed
  // entries, not a `.map()` over values — the table falls back to a positional
  // key for a row with no _id, and that key cannot be re-derived later.
  const visibleSelected = useMemo(
    () => Object.entries(selectedRows).filter(([, q]) => matchesCurrentFilters(q)),
    [selectedRows, matchesCurrentFilters],
  );
  const selectedVisible = useMemo(() => visibleSelected.map(([id]) => id), [visibleSelected]);
  const selectedVisibleRows = useMemo(() => visibleSelected.map(([, q]) => q), [visibleSelected]);

  // The table hands back the ids it wants selected; re-attach each one to its
  // row, taking it from the current page or from what is already retained.
  // The key derivation mirrors QuestionsTable's own (`_id`, else position).
  const handleSelectionChange = useCallback((ids: string[]) => {
    setSelectedRows(prev => {
      const onPage = new Map(pageQuestions.map((q, i) => [q._id || `q-${i}`, q]));
      const next: Record<string, Question> = {};
      for (const id of ids) {
        const row = onPage.get(id) ?? prev[id];
        if (row) next[id] = row;
      }
      return next;
    });
  }, [pageQuestions]);

  // ── Bulk actions — loop the SAME single-item service calls (no new endpoints) ──
  const bulkArchive = async () => {
    if (!selectedVisible.length) return;
    for (const id of selectedVisible) {
      try { await questionBankService.toggleQuestionStatus(id, false); } catch { /* keep going */ }
    }
    showToast(`${selectedVisible.length} question${selectedVisible.length > 1 ? 's' : ''} archived`, 'success');
    setSelectedRows({});
    refreshQuestions();
  };
  const bulkDelete = async () => {
    if (!selectedVisible.length) return;
    if (!confirm(`Delete ${selectedVisible.length} selected question${selectedVisible.length > 1 ? 's' : ''}? This cannot be undone.`)) return;
    for (const id of selectedVisible) {
      try { await questionBankService.deleteQuestion(id); } catch { /* keep going */ }
    }
    showToast(`${selectedVisible.length} question${selectedVisible.length > 1 ? 's' : ''} deleted`, 'success');
    setSelectedRows({});
    refreshQuestions();
  };
  const exportCsv = async (scope: 'all' | 'selected') => {
    let rows: Question[];
    if (scope === 'selected') {
      rows = selectedVisibleRows;
    } else {
      // "Export all" has always meant every row matching the current filters,
      // not the rows on screen — so fetch the whole filtered set. Exporting
      // `pageQuestions` here would silently truncate the file to one page.
      //
      // Walked in chunks rather than asked for in one call because the
      // endpoint caps a page at 5000 rows: a bank past the cap would hand back
      // a short file that still looks complete.
      try {
        const CHUNK = 5000;
        const collected: Question[] = [];
        for (let p = 1; collected.length < totalFiltered; p++) {
          const res: any = await questionBankService.getAllQuestions({
            ...queryParams, page: p, limit: CHUNK,
          });
          const batch: Question[] = res.questions || [];
          if (!batch.length) break;
          collected.push(...batch);
        }
        rows = collected;
      } catch {
        showToast('Failed to export', 'error');
        return;
      }
    }
    if (!rows.length) { showToast('Nothing to export', 'error'); return; }
    const esc = (v: unknown) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const header = ['Title', 'Type', 'Category', 'Difficulty', 'Marks', 'Status', 'Created By', 'Created'];
    const lines = [header.join(','), ...rows.map(q => [
      getQuestionTitleText(q), q.questionType, q.questionCategory, getDifficulty(q), scoreOf(q),
      q.isActive ? 'Active' : 'Inactive', q.createdBy || '', q.createdAt || '',
    ].map(esc).join(','))];
    const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `questions-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`Exported ${rows.length} question${rows.length > 1 ? 's' : ''}`, 'success');
  };

  // Legacy: the list body used a viewport-height calc so the row scroll
  // fitted the screen. It now fills the flex-1 slot inside a panel-height
  // column instead (h-full/flex chain below), so this value is unused;
  // kept only so QuestionsTable's `maxBodyHeight` prop shape doesn't need
  // a signature change. The `flex-1 min-h-0 overflow-auto` on the body
  // ignores it entirely.
  const tableMaxH = 'none';

  // CREATE goes through the premium Create Question modal; the classic
  // MCQFields / ProgrammingWorkspace surfaces stay wired for EDIT only.
  const [premiumCreate, setPremiumCreate] = useState<null | 'programming' | 'mcq'>(null);

  const openCreateMcq = () => {
    setEditingQuestion(null);
    setPremiumCreate('mcq');
  };

  const openCreateProgramming = () => {
    setEditingQuestion(null);
    setEditingDraft(null);
    setPremiumCreate('programming');
  };

  const closeProgrammingWorkspace = () => {
    setShowProgrammingWorkspace(false);
    setEditingDraft(null);
    setEditingQuestion(null);
  };

  // Publishes each ready draft through the existing single-question endpoint —
  // there is no bulk endpoint — and reports the result per question. Category
  // and Active come from the workspace's shared Basic Information block.
  const publishProgrammingDrafts = async (
    drafts: ProgrammingDraft[],
    meta: { questionCategory: string; isActive: boolean },
  ): Promise<PublishOutcome[]> => {
    const updatingId = editingDraft ? editingQuestion?._id : undefined;
    const results: PublishOutcome[] = [];

    for (const draft of drafts) {
      try {
        const payload = buildProgrammingPayload({
          ...draft,
          questionCategory: meta.questionCategory,
          isActive: meta.isActive,
        } as any);
        if (updatingId) await questionBankService.updateQuestion(updatingId, payload);
        else await questionBankService.createQuestion(payload);
        results.push({ localId: draft.localId, title: draft.title, ok: true });
      } catch (error: any) {
        results.push({
          localId: draft.localId,
          title: draft.title,
          ok: false,
          error: error?.response?.data?.message || error?.message || 'Request failed',
        });
      }
    }

    const okCount = results.filter((r) => r.ok).length;
    const failCount = results.length - okCount;

    if (updatingId) {
      if (okCount) {
        showToast('Question updated successfully', 'success');
        closeProgrammingWorkspace();
      } else {
        showToast(results[0]?.error || 'Failed to update question', 'error');
      }
    } else if (okCount && !failCount) {
      showToast(`Published ${okCount} question${okCount === 1 ? '' : 's'}`, 'success');
    } else if (okCount && failCount) {
      showToast(`Published ${okCount}, ${failCount} failed`, 'error');
    } else {
      showToast('No questions were published', 'error');
    }

    if (okCount) await refreshQuestions();
    return results;
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // Panel-height layout (matches Client Management / User Management): the
  // page fills its parent shell's `<main>` box and the ONLY thing that
  // scrolls is the question list body. Header, toolbar, filter chips and
  // the pagination footer stay put. h-full + min-h-0 + flex-col is the
  // chain that lets the table card below claim the remaining space via
  // `flex-1 min-h-0`; `min-h-screen` (the old value) forced the wrapper
  // past the panel and turned the whole panel into a scroll surface.
  const pageContent = (
    <div className="flex h-full min-h-0 min-w-0 flex-col">

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.18, ease: easeStandard }}
            className="fixed right-4 top-4 z-toast"
          >
            <div className="flex items-center gap-2.5 rounded-tile border border-hairline bg-surface px-3.5 py-2.5 shadow-lg">
              {toast.type === 'success'
                ? <CircleCheck size={16} className="shrink-0 text-success-500" aria-hidden="true" />
                : <AlertCircle size={16} className="shrink-0 text-danger-500" aria-hidden="true" />}
              <span className="text-sm font-medium text-heading">{toast.message}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        variants={pageEnter}
        initial="hidden"
        animate="visible"
        className="flex min-h-0 flex-1 flex-col px-4 sm:px-6 md:px-8 pt-5 pb-4"
      >
        {/* ── Slim header + compact stat chips ──
            Right-side chips use the shared HeaderStats primitive so the strip
            reserves the same `mr-8` clearance as every other admin listing
            page. Without that gap the last chip (Active) slides under the
            corner-pinned NotificationBell rendered by DashboardLayout /
            StaffLayout. flex-nowrap on the desktop rail lets the heading
            column shrink instead of pushing the chip strip onto a new line. */}
        <div className="flex flex-wrap items-start justify-between gap-4 md:flex-nowrap">
          <div className="min-w-0 flex-1">
            <h1 className="text-base font-semibold tracking-[-0.01em] text-heading sm:text-lg">Question Bank</h1>
          </div>
          <HeaderStats loading={isLoading} items={stats} skeletonCount={4} />
        </div>

        {/* ── One toolbar: search · Filter · density toggle · overflow · Create ── */}
        <div className="mt-4 flex items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
            <input
              type="text"
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              placeholder="Search questions by title, description or category…"
              className="h-10 w-full rounded-control border border-hairline-strong bg-surface pl-10 pr-9 text-sm text-body placeholder:text-faint transition-colors duration-150 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15"
            />
            {filters.search && (
              <button type="button" aria-label="Clear search" onClick={() => setFilters({ ...filters, search: '' })} className="absolute right-2.5 top-1/2 inline-flex size-6 -translate-y-1/2 items-center justify-center rounded-chip text-faint transition-colors duration-150 hover:bg-ink-100 hover:text-heading"><X size={14} /></button>
            )}
          </div>

          <button
            type="button"
            onClick={() => setShowFilters((v) => !v)}
            aria-expanded={showFilters}
            className={`relative inline-flex h-10 items-center gap-1.5 rounded-control border px-3.5 text-sm font-medium shadow-xs transition-colors duration-150 ${activeFilterCount > 0 || showFilters ? 'border-brand bg-brand-wash text-brand-strong' : 'border-hairline-strong bg-surface text-body hover:bg-row-hover hover:text-heading'}`}
          >
            <SlidersHorizontal className="h-4 w-4" />
            <span className="hidden sm:inline">Filter</span>
            {activeFilterCount > 0 && <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-strong px-1 text-2xs font-bold tabular-nums text-white">{activeFilterCount}</span>}
          </button>

          <div className="hidden h-10 items-center rounded-control border border-hairline-strong bg-surface p-0.5 sm:flex" role="group" aria-label="Density">
            <button type="button" onClick={() => setDensity('list')} aria-pressed={density === 'list'} title="List view" className={`flex h-8 w-8 items-center justify-center rounded-chip transition-colors duration-150 ${density === 'list' ? 'bg-brand-wash text-brand-strong' : 'text-faint hover:text-heading'}`}><List className="h-4 w-4" /></button>
            <button type="button" onClick={() => setDensity('compact')} aria-pressed={density === 'compact'} title="Compact view" className={`flex h-8 w-8 items-center justify-center rounded-chip transition-colors duration-150 ${density === 'compact' ? 'bg-brand-wash text-brand-strong' : 'text-faint hover:text-heading'}`}><Rows3 className="h-4 w-4" /></button>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" aria-label="More actions" className="inline-flex h-10 items-center justify-center rounded-control border border-hairline-strong bg-surface px-2.5 text-body shadow-xs transition-colors duration-150 hover:bg-row-hover hover:text-heading"><MoreHorizontal className="h-4 w-4" /></button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" sideOffset={6} className="w-52">
              <DropdownMenuItem onSelect={() => { void exportCsv('all'); }} className="cursor-pointer"><Download className="h-4 w-4" /> Export all (CSV)</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Primary — Create Question (MCQ / Programming). Both items keep their
              exact open-modal side effects. */}
          {canCreate && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.98 }}
                  className="flex h-10 flex-shrink-0 items-center gap-2 rounded-control bg-brand-strong pl-3.5 pr-3 text-white shadow-xs transition-colors duration-150 ease-standard hover:bg-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30"
                >
                  <Plus size={16} strokeWidth={2.4} />
                  <span className="hidden text-sm font-semibold sm:inline">Create Question</span>
                  <span className="ml-0.5 hidden h-4 w-px bg-white/30 sm:block" aria-hidden="true" />
                  <ChevronDown size={15} strokeWidth={2.4} className="opacity-90" />
                </motion.button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" sideOffset={6} className="w-72 p-1.5">
                <DropdownMenuItem onSelect={openCreateMcq} className="items-start gap-3 rounded-tile p-2.5">
                  <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-tile bg-info-50"><ListChecks size={16} className="text-info-700" /></span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-heading">MCQ question</span>
                    <span className="mt-0.5 block text-xs text-subtle">Choice, matching, ordering, numeric and more</span>
                  </span>
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={openCreateProgramming} className="items-start gap-3 rounded-tile p-2.5">
                  <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-tile bg-brand-wash"><Terminal size={16} className="text-brand-strong" /></span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-heading">Programming question</span>
                    <span className="mt-0.5 block text-xs text-subtle">Core programming, frontend and database</span>
                  </span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {/* ── Inline filter panel (same screen) ── */}
        <QuestionFilterPanel
          open={showFilters}
          onClose={() => setShowFilters(false)}
          current={{ type: filters.questionType, category: filters.category, difficulty: filters.difficulty, marks: filters.marks, status: filters.isActive, createdBy: filters.createdBy, date: filters.date }}
          categoryOptions={categories.map((c) => ({ value: c, label: c }))}
          createdByOptions={createdByOptions.map((c) => ({ value: c, label: c }))}
          onApply={(f) => setFilters((prev) => ({ ...prev, questionType: f.type, category: f.category, difficulty: f.difficulty, marks: f.marks, isActive: f.status, createdBy: f.createdBy, date: f.date }))}
          onReset={clearFilters}
        />

        {/* ── Active filter chips ── */}
        {filterChips.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {filterChips.map((chip) => (
              <span key={chip.key} className="inline-flex h-7 items-center gap-1.5 rounded-full border border-brand-500/30 bg-brand-wash pl-2.5 pr-1.5 text-xs font-medium text-brand-strong">
                {chip.label}
                <button type="button" aria-label={`Remove ${chip.label} filter`} onClick={chip.onRemove} className="inline-flex size-4 items-center justify-center rounded-full transition-colors duration-150 hover:bg-brand-500/20"><X size={11} /></button>
              </span>
            ))}
            <button type="button" onClick={clearFilters} className="ml-0.5 text-xs font-medium text-subtle transition-colors duration-150 hover:text-heading">Clear all</button>
          </div>
        )}

        {/* ── Question list (the hero) ──
            flex-1 min-h-0 flex-col so the card fills whatever height is left
            after the header/toolbar/chips. Inside, QuestionsTable's row
            body claims flex-1 (its own overflow-auto), and the pagination
            footer keeps its natural height pinned at the bottom. */}
        <div className="mt-4 flex flex-1 min-h-0 flex-col overflow-hidden rounded-xl border border-hairline bg-surface shadow-xs">
          <QuestionsTable
            questions={pageQuestions}
            isLoading={isLoading}
            isFiltered={hasActiveFilters}
            density={density}
            selectedIds={selectedIds}
            onSelectionChange={handleSelectionChange}
            onPreview={setPreviewQuestion}
            onEdit={handleEditQuestion}
            onDelete={handleDeleteQuestion}
            onToggleStatus={handleToggleStatus}
            onClearFilters={clearFilters}
            onCreateMcq={openCreateMcq}
            onCreateProgramming={openCreateProgramming}
            maxBodyHeight={tableMaxH}
            canView={canView}
            canEdit={canEdit}
            canDelete={canDelete}
            canToggle={canToggle}
            canCreate={canCreate}
          />
          {!isLoading && totalFiltered > 0 && (
            <TableFooter
              from={rangeStart}
              to={rangeEnd}
              total={totalFiltered}
              pageSize={pageSize}
              onPageSize={(n) => { setPageSize(n); setCurrentPage(1); }}
              currentPage={safePage}
              totalPages={totalPages}
              onPage={setCurrentPage}
            />
          )}
        </div>
      </motion.div>

      {/* Floating bulk actions — appear only after selecting questions. Rendered
          outside the animated wrapper so `fixed` stays viewport-relative. */}
      <AnimatePresence>
        {selectedVisible.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 16, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: 16, x: '-50%' }}
            transition={{ duration: 0.2, ease: easeStandard }}
            className="fixed bottom-6 left-1/2 z-dropdown flex items-center gap-3 rounded-full bg-ink-900 py-2 pl-4 pr-2 text-white shadow-xl"
          >
            <span className="whitespace-nowrap text-xs font-semibold tabular-nums">{selectedVisible.length} selected</span>
            <span className="h-4 w-px bg-white/20" />
            <button type="button" onClick={bulkArchive} className="inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium text-white/90 transition-colors duration-150 hover:bg-white/10 hover:text-white"><Power size={13} /> Archive</button>
            <button type="button" onClick={() => { void exportCsv('selected'); }} className="inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium text-white/90 transition-colors duration-150 hover:bg-white/10 hover:text-white"><Download size={13} /> Export</button>
            <button type="button" onClick={bulkDelete} className="inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium text-danger-500 transition-colors duration-150 hover:bg-danger-500/15"><Trash2 size={13} /> Delete</button>
            <button type="button" aria-label="Clear selection" onClick={() => setSelectedRows({})} className="inline-flex size-7 items-center justify-center rounded-full text-white/70 transition-colors duration-150 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"><X size={14} /></button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Preview drawer */}
      <QuestionDetailDrawer
        question={previewQuestion}
        onClose={() => setPreviewQuestion(null)}
        onEdit={(q) => {
          setPreviewQuestion(null);
          handleEditQuestion(q);
        }}
        canEdit={canEdit}
      />

      {/* MCQ Modal */}
      {showCreateModal && selectedQuestionType === 'MCQ' && (
        <MCQFields
          initialData={editingQuestion ? [editingQuestion] : null}
          isEditing={!!editingQuestion}
          questionId={editingQuestion?._id}
          onClose={closeModal}
          onSave={handleMCQSave}
          isSaving={false}
          saveProgress={0}
          saveMessage=""
          categories={categories}
        />
      )}

      {/* Programming workspace — kept for EDITING existing questions */}
      <AnimatePresence>
        {showProgrammingWorkspace && (
          <ProgrammingWorkspace
            categories={categories}
            editingDraft={editingDraft}
            onClose={closeProgrammingWorkspace}
            onPublish={publishProgrammingDrafts}
          />
        )}
      </AnimatePresence>

      {/* Create Question — premium modal (Programming / MCQ). Refreshes the
          list on every successful save so new questions appear immediately. */}
      {premiumCreate && (
        <CreateQuestionModal
          qType={premiumCreate}
          onClose={() => setPremiumCreate(null)}
          onCreated={refreshQuestions}
        />
      )}
    </div>
  );

  if (userRole === null) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loading size="size-8" />
      </div>
    );
  }

  // fullBleed on the staff shell removes its default `p-4` wrapper around
  // children so this page's own `h-full` chain reaches an ancestor with a
  // definite height (main is `flex-1 min-h-0 overflow-hidden` in fullBleed
  // mode). Padding is owned by the motion.div inside pageContent already.
  return userRole === 'admin' ||  userRole === 'ldhead' || userRole === 'subhead' || userRole === 'programcoordinator'
    ? <DashboardLayout>{pageContent}</DashboardLayout>
    : <StaffLayout fullBleed>{pageContent}</StaffLayout>;
}
