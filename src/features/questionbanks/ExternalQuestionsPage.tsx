'use client';

/**
 * External (Other Platform) Question Bank — admin listing.
 *
 * Same table + filter + create/edit shell as the internal QuestionBanksPage,
 * wired to the GLOBAL OtherPlatformQuestion collection. Reuses every listing
 * primitive (QuestionsTable, QuestionFilterPanel, HeaderStats, TableFooter,
 * QuestionDetailDrawer, ProgrammingWorkspace, CreateQuestionModal, MCQFields)
 * so the two banks look identical to the user; only the queries and mutations
 * differ.
 *
 * Access: role-gated to admin / super_admin (this bank is shared by every
 * institution — the sidebar and providers.tsx enforce the same check at the
 * shell level so anyone else is 403'd before the page even mounts).
 */

import { Loading } from "@/components/loading-ui/loading";
import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import {
  useOtherPlatformBankPageQuery,
  useInvalidateOtherPlatformBank,
  useDeleteOtherPlatformQuestionMutation,
  useToggleOtherPlatformQuestionStatusMutation,
} from '@/queries/questionBank';

// Broad category → stored discriminator, same rules as the internal page.
const CATEGORY_TO_QUESTION_TYPE: Record<string, 'programming' | 'frontend' | 'database'> = {
  core: 'programming',
  frontend: 'frontend',
  database: 'database',
};
const questionTypeFromCategory = (category?: string): 'programming' | 'frontend' | 'database' =>
  CATEGORY_TO_QUESTION_TYPE[(category as string) || 'core'] || 'programming';
const categoryFromQuestionType = (questionType?: string): 'core' | 'frontend' | 'database' => {
  const v = (questionType || '').toLowerCase();
  if (v === 'frontend') return 'frontend';
  if (v === 'database') return 'database';
  return 'core';
};
const isMcqType = (questionType?: string) =>
  (questionType || '').toLowerCase() === 'mcq';

// Same programming-payload shaper as the internal page — this bank's schema is
// identical (see server/models/Courses/QuestionbankModal.js).
const buildProgrammingPayload = (question: Partial<Question>) => {
  const category = (question.category as 'core' | 'frontend' | 'database') || 'core';
  const base = {
    questionCategory: (question.questionCategory || 'Programming').trim() || 'Programming',
    questionType: questionTypeFromCategory(category),
    isActive: question.isActive !== undefined ? question.isActive : true,
    title: question.title || '',
    description: question.description || '',
    difficulty: (['easy', 'medium', 'hard'].includes(question.difficulty as string)
      ? question.difficulty
      : 'medium') as 'easy' | 'medium' | 'hard',
    category,
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
  if (category === 'frontend') return { ...base, constraints: question.constraints || [] };
  if (category === 'database') {
    return {
      ...base,
      sampleQuery: question.sampleQuery || '',
      expectedResult: question.expectedResult || '',
    };
  }
  return base;
};

const dateCutoff = (d: string): number => {
  const day = 86400000;
  if (d === '7') return Date.now() - 7 * day;
  if (d === '30') return Date.now() - 30 * day;
  if (d === '90') return Date.now() - 90 * day;
  if (d === 'year') return new Date(new Date().getFullYear(), 0, 1).getTime();
  return 0;
};
const inMarksRange = (score: number, range: string): boolean => {
  if (range === '1-5') return score >= 1 && score <= 5;
  if (range === '6-10') return score >= 6 && score <= 10;
  if (range === '11-20') return score >= 11 && score <= 20;
  if (range === '20+') return score > 20;
  return true;
};
const scoreOf = (q: Question): number =>
  (q.questionType || '').toLowerCase() === 'mcq' ? (q.mcqQuestionScore || 10) : (q.score || 0);

export default function ExternalQuestionsPage() {
  const [userRole, setUserRole] = useState<string | null>(null);
  const refreshQuestions = useInvalidateOtherPlatformBank();
  const deleteQuestionMutation = useDeleteOtherPlatformQuestionMutation();
  const toggleStatusMutation = useToggleOtherPlatformQuestionStatusMutation();

  const [isSavingMcq, setIsSavingMcq] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showProgrammingWorkspace, setShowProgrammingWorkspace] = useState(false);
  const [editingDraft, setEditingDraft] = useState<ProgrammingDraft | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [selectedQuestionType, setSelectedQuestionType] = useState<'MCQ' | 'Programming'>('MCQ');

  const [filters, setFilters] = useState({
    questionType: '', category: '', difficulty: '', isActive: '', search: '',
    createdBy: '', marks: '', date: '',
  });
  const [previewQuestion, setPreviewQuestion] = useState<Question | null>(null);
  const [density, setDensity] = useState<'list' | 'compact'>('list');
  const [selectedRows, setSelectedRows] = useState<Record<string, Question>>({});
  const selectedIds = useMemo(() => Object.keys(selectedRows), [selectedRows]);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(filters.search), 300);
    return () => clearTimeout(t);
  }, [filters.search]);

  useEffect(() => {
    const role = localStorage.getItem('smartcliff_roleValue');
    setUserRole(role);
  }, []);

  // Reset to page 1 on filter change — same during-render pattern the internal
  // page uses, for the same reason (fires ONE request for page 1 rather than
  // one for page N plus one for page 1).
  const filterSignature = JSON.stringify([
    filters.questionType, filters.category, filters.difficulty, filters.isActive,
    filters.createdBy, filters.marks, filters.date, debouncedSearch,
  ]);
  const [lastFilterSignature, setLastFilterSignature] = useState(filterSignature);
  if (lastFilterSignature !== filterSignature) {
    setLastFilterSignature(filterSignature);
    setCurrentPage(1);
  }

  // The External endpoint's filters are `questionType` (exact), `category`,
  // `difficulty` (mcqQuestionDifficulty), `isActive`, `createdBy` and `search`.
  // Marks / created-date are applied CLIENT-side over the page — same visible
  // behavior as the internal page, kept off the wire because the server
  // endpoint doesn't accept those axes yet.
  const queryParams = useMemo(
    () => ({
      page: currentPage,
      limit: pageSize,
      questionType: filters.questionType,
      category: filters.category,
      difficulty: filters.difficulty,
      isActive: filters.isActive,
      createdBy: filters.createdBy,
      search: debouncedSearch,
    }),
    [
      currentPage, pageSize, filters.questionType, filters.category,
      filters.difficulty, filters.isActive, filters.createdBy, debouncedSearch,
    ],
  );

  const { data: pageData, isLoading: isListLoading } = useOtherPlatformBankPageQuery(queryParams);
  const isLoading = isListLoading || isSavingMcq;
  const pageQuestions = useMemo(() => pageData?.questions ?? [], [pageData]);
  const categories = useMemo(() => pageData?.facets.categories ?? [], [pageData]);
  const createdByOptions = useMemo(() => pageData?.facets.createdBy ?? [], [pageData]);

  const createdAfter = useMemo(() => dateCutoff(filters.date), [filters.date]);

  // Filter chip label maps — unchanged from the internal page.
  const MARKS_LABEL: Record<string, string> = {
    '1-5': '1–5 marks', '6-10': '6–10 marks', '11-20': '11–20 marks', '20+': '20+ marks',
  };
  const DATE_LABEL: Record<string, string> = {
    '7': 'Last 7 days', '30': 'Last 30 days', '90': 'Last 90 days', year: 'This year',
  };

  // Client-side pass over the current page for the two axes the server doesn't
  // filter on yet — marks and created-date.
  const clientFilteredQuestions = useMemo(() => {
    if (!filters.marks && !createdAfter) return pageQuestions;
    return pageQuestions.filter((q) => {
      if (filters.marks && !inMarksRange(scoreOf(q), filters.marks)) return false;
      if (createdAfter) {
        const c = q.createdAt ? new Date(q.createdAt).getTime() : 0;
        if (!(Boolean(c) && c >= createdAfter)) return false;
      }
      return true;
    });
  }, [pageQuestions, filters.marks, createdAfter]);

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

  const matchesCurrentFilters = useCallback((q: Question) => {
    if (filters.questionType) {
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

  // ── MCQ save ── External bank is JSON-only (no image uploads). FormData
  // arriving with files is refused up front so authored options don't end up
  // with dead imageUrl values.
  const handleMCQSave = async (formData: FormData) => {
    try {
      setIsSavingMcq(true);
      let hasFiles = false;
      let questionsDataRaw: string | null = null;
      for (const [key, value] of formData.entries()) {
        if (value instanceof File) hasFiles = true;
        else if (key === 'questionsData') questionsDataRaw = value as string;
      }
      if (hasFiles) {
        showToast(
          'Image uploads on the External bank aren\'t supported yet — remove the images or save on the Internal bank.',
          'error',
        );
        return;
      }
      if (!questionsDataRaw) throw new Error('Missing questionsData in save payload');
      const parsed = JSON.parse(questionsDataRaw);
      const question = Array.isArray(parsed) ? parsed[0] : parsed;
      const result: any = editingQuestion?._id
        ? await questionBankService.updateOtherPlatformQuestion(editingQuestion._id, question)
        : await questionBankService.createOtherPlatformQuestion(question);
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

  const handleEditQuestion = (question: Question) => {
    setEditingQuestion(question);
    const mcq = isMcqType(question.questionType);
    setSelectedQuestionType(mcq ? 'MCQ' : 'Programming');
    if (mcq) {
      setShowCreateModal(true);
      return;
    }
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

  const handleToggleStatus = async (id: string, status: boolean) => {
    try {
      await toggleStatusMutation.mutateAsync({ id, isActive: status });
      showToast(`Question ${status ? 'activated' : 'deactivated'}`, 'success');
    } catch {
      showToast('Failed to update status', 'error');
    }
  };

  const stats = useMemo(() => {
    const s = pageData?.facets.stats;
    return [
      { label: 'Total', value: s?.total ?? 0 },
      { label: 'MCQ', value: s?.mcq ?? 0 },
      { label: 'Programming', value: s?.programming ?? 0 },
      { label: 'Active', value: s?.active ?? 0 },
    ];
  }, [pageData]);

  const activeFilterCount = [
    filters.questionType, filters.category, filters.difficulty, filters.isActive,
    filters.createdBy, filters.marks, filters.date,
  ].filter(v => v !== '').length;
  const hasActiveFilters = activeFilterCount > 0 || filters.search !== '';
  const clearFilters = () =>
    setFilters({
      questionType: '', category: '', difficulty: '', isActive: '', search: '',
      createdBy: '', marks: '', date: '',
    });

  const filterChips: { key: string; label: string; onRemove: () => void }[] = [
    ...(filters.questionType ? [{ key: 'type', label: filters.questionType, onRemove: () => setFilters(f => ({ ...f, questionType: '' })) }] : []),
    ...(filters.category ? [{ key: 'cat', label: filters.category, onRemove: () => setFilters(f => ({ ...f, category: '' })) }] : []),
    ...(filters.difficulty ? [{ key: 'diff', label: filters.difficulty.charAt(0).toUpperCase() + filters.difficulty.slice(1), onRemove: () => setFilters(f => ({ ...f, difficulty: '' })) }] : []),
    ...(filters.marks ? [{ key: 'marks', label: MARKS_LABEL[filters.marks] || filters.marks, onRemove: () => setFilters(f => ({ ...f, marks: '' })) }] : []),
    ...(filters.isActive ? [{ key: 'status', label: filters.isActive === 'true' ? 'Active' : 'Inactive', onRemove: () => setFilters(f => ({ ...f, isActive: '' })) }] : []),
    ...(filters.createdBy ? [{ key: 'by', label: filters.createdBy, onRemove: () => setFilters(f => ({ ...f, createdBy: '' })) }] : []),
    ...(filters.date ? [{ key: 'date', label: DATE_LABEL[filters.date] || filters.date, onRemove: () => setFilters(f => ({ ...f, date: '' })) }] : []),
  ];

  const visibleSelected = useMemo(
    () => Object.entries(selectedRows).filter(([, q]) => matchesCurrentFilters(q)),
    [selectedRows, matchesCurrentFilters],
  );
  const selectedVisible = useMemo(() => visibleSelected.map(([id]) => id), [visibleSelected]);
  const selectedVisibleRows = useMemo(() => visibleSelected.map(([, q]) => q), [visibleSelected]);

  const handleSelectionChange = useCallback((ids: string[]) => {
    setSelectedRows(prev => {
      const onPage = new Map(clientFilteredQuestions.map((q, i) => [q._id || `q-${i}`, q]));
      const next: Record<string, Question> = {};
      for (const id of ids) {
        const row = onPage.get(id) ?? prev[id];
        if (row) next[id] = row;
      }
      return next;
    });
  }, [clientFilteredQuestions]);

  const bulkArchive = async () => {
    if (!selectedVisible.length) return;
    for (const id of selectedVisible) {
      try { await questionBankService.toggleOtherPlatformQuestionStatus(id, false); } catch { /* keep going */ }
    }
    showToast(`${selectedVisible.length} question${selectedVisible.length > 1 ? 's' : ''} archived`, 'success');
    setSelectedRows({});
    refreshQuestions();
  };
  const bulkDelete = async () => {
    if (!selectedVisible.length) return;
    if (!confirm(`Delete ${selectedVisible.length} selected question${selectedVisible.length > 1 ? 's' : ''}? This cannot be undone.`)) return;
    for (const id of selectedVisible) {
      try { await questionBankService.deleteOtherPlatformQuestion(id); } catch { /* keep going */ }
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
      try {
        const CHUNK = 200;
        const collected: Question[] = [];
        for (let p = 1; collected.length < totalFiltered; p++) {
          const res: any = await questionBankService.getAllOtherPlatformQuestions({
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
    a.download = `external-questions-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`Exported ${rows.length} question${rows.length > 1 ? 's' : ''}`, 'success');
  };

  const tableMaxH = 'none';

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
        if (updatingId) await questionBankService.updateOtherPlatformQuestion(updatingId, payload);
        else await questionBankService.createOtherPlatformQuestion(payload);
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

  const pageContent = (
    <div className="flex h-full min-h-0 min-w-0 flex-col">
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
        <div className="flex flex-wrap items-start justify-between gap-4 md:flex-nowrap">
          <div className="min-w-0 flex-1">
            <h1 className="text-base font-semibold tracking-[-0.01em] text-heading sm:text-lg">
              External Question Bank
            </h1>
          </div>
          <HeaderStats loading={isLoading} items={stats} skeletonCount={4} />
        </div>

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
        </div>

        <QuestionFilterPanel
          open={showFilters}
          onClose={() => setShowFilters(false)}
          current={{ type: filters.questionType, category: filters.category, difficulty: filters.difficulty, marks: filters.marks, status: filters.isActive, createdBy: filters.createdBy, date: filters.date }}
          categoryOptions={categories.map((c) => ({ value: c, label: c }))}
          createdByOptions={createdByOptions.map((c) => ({ value: c, label: c }))}
          onApply={(f) => setFilters((prev) => ({ ...prev, questionType: f.type, category: f.category, difficulty: f.difficulty, marks: f.marks, isActive: f.status, createdBy: f.createdBy, date: f.date }))}
          onReset={clearFilters}
        />

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

        <div className="mt-4 flex flex-1 min-h-0 flex-col overflow-hidden rounded-xl border border-hairline bg-surface shadow-xs">
          <QuestionsTable
            questions={clientFilteredQuestions}
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
            canView
            canEdit
            canDelete
            canToggle
            canCreate
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

      <QuestionDetailDrawer
        question={previewQuestion}
        onClose={() => setPreviewQuestion(null)}
        onEdit={(q) => {
          setPreviewQuestion(null);
          handleEditQuestion(q);
        }}
        canEdit
      />

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

      {premiumCreate && (
        <CreateQuestionModal
          qType={premiumCreate}
          bankSource="external"
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

  // Admin / super-admin only — the External bank is GLOBAL, so writes cross
  // every tenant. The sidebar hides the entry for other roles and providers.tsx
  // already gates the route, but this deep-link guard keeps the URL from
  // rendering the page shell for anyone who slips past both.
  const canView =
    userRole === 'admin' ||
    userRole === 'superadmin' ||
    userRole === 'superadministrator';
  if (!canView) {
    return (
      <DashboardLayout>
        <div className="flex h-full items-center justify-center p-8 text-sm text-subtle">
          Access restricted — the External bank is admin-only.
        </div>
      </DashboardLayout>
    );
  }

  return <DashboardLayout>{pageContent}</DashboardLayout>;
}
