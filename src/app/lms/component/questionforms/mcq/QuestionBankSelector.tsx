import React, { useState, useEffect, useMemo } from 'react';
import { X, Search, Filter, Loader, Check, ChevronRight, ChevronLeft, ChevronDown, BookOpen, Code, Database, Layout, AlertCircle, Plus, List, LayoutGrid } from 'lucide-react';
import { useQuestionBankQuery, useOtherPlatformQuestionBankQuery } from '@/queries/questionBank';
import { PROBLEM_TYPES } from '../../questionbank/create/createShared';
// IMPORTANT: use react-hot-toast (the same toaster mounted in app/layout.tsx).
// react-toastify's ToastContainer is NOT mounted in this app, so toasts from
// "react-toastify" never render — that was the bug that made the quota
// warnings appear silent to teachers picking questions from the bank.
import toast from 'react-hot-toast';
import { Question } from '../../QuestionsView';

// Open-slot quota passed by the parent so the selector can block over-selection.
// 'general' → one total cap (any difficulty); 'difficulty' → per-difficulty caps.
export type SelectionQuota =
  | { mode: 'general'; remainingTotal: number }
  | { mode: 'difficulty'; remainingByDifficulty: { easy: number; medium: number; hard: number } };

interface QuestionBankSelectorProps {
  exerciseData: {
    exerciseId: string;
    exerciseName: string;
    exerciseLevel: string;
    nodeId: string;
    nodeName: string;
    subcategory: string;
    nodeType: string;
    fullExerciseData: any;
    exerciseType: string;
      onEditQuestion?: (question: any) => void;  // ADD THIS

    
  };
  tabType: string;
  onClose: () => void;
  onBack?: () => void;
  onSelect: (selectedQuestions: Question[]) => void;
  existingQuestionIds: string[];
  existingQuestions: Question[];
  // ✅ NEW: Add filterType prop to filter by question type
  filterByType?: 'mcq' | 'programming' | 'frontend' | 'database' | 'all';
  // Selection quota (opt-in) — blocks ticking beyond the exercise's open slots.
  selectionQuota?: SelectionQuota;
  // Opened from a difficulty-scoped authoring slot, the picker starts focused
  // on the difficulty being filled; the rail buttons still let the teacher
  // pick other cells (and Clear All still resets to 'all').
  initialDifficultyFilter?: 'easy' | 'medium' | 'hard';
  // Which bank to read: the institution's own bank (default) or the SEPARATE
  // Other Platform bank collection. Same UI, different data source.
  bankSource?: 'bank' | 'otherPlatform';
  // Optional context passed by some callers (currently informational).
  remainingQuestions?: number;
  marksPerQuestion?: number;
}

// In-rail dropdown for long option lists (Topic/Tags). A native <select>'s
// popup is OS-rendered — with many options it overflows the screen and cannot
// be styled or height-capped. This panel expands inline inside the scrollable
// filters rail with its own max-height scroll, so it can never escape the modal.
const FilterDropdown: React.FC<{
  label: string;
  allLabel: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}> = ({ label, allLabel, value, options, onChange }) => {
  const [open, setOpen] = useState(false);
  const current = value === 'all' ? allLabel : (options.find(o => o.value === value)?.label ?? value);
  return (
    <div>
      <div className="mb-1.5 text-[12px] font-semibold text-heading">{label}</div>
      <button type="button" onClick={() => setOpen(o => !o)}
        className="flex h-9 w-full items-center justify-between rounded-[10px] border border-[#E5E7EB] bg-white px-2.5 text-[12.5px] text-body focus:outline-none focus:border-brand">
        <span className="truncate">{current}</span>
        <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-faint transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="mt-1 max-h-44 overflow-y-auto rounded-[10px] border border-[#E5E7EB] bg-white p-1 shadow-sm">
          {[{ value: 'all', label: allLabel }, ...options].map(o => (
            <button key={o.value} type="button"
              onClick={() => { onChange(o.value); setOpen(false); }}
              className={`flex w-full items-center justify-between rounded-[8px] px-2 py-1.5 text-left text-[12px] ${o.value === value ? 'bg-orange-50 font-semibold text-brand-strong' : 'text-body hover:bg-row-hover'}`}>
              <span className="truncate">{o.label}</span>
              {o.value === value && <Check className="h-3.5 w-3.5 shrink-0" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const QuestionBankSelector: React.FC<QuestionBankSelectorProps> = ({
  exerciseData,
  tabType,
  onClose,
  onBack,
  onSelect,
  existingQuestionIds,
  existingQuestions = [],
  filterByType = 'all', // ✅ Default to 'all' to show all question types
  selectionQuota,
  initialDifficultyFilter,
  bankSource = 'bank',
}) => {
  // Both banks are cached (queries/questionBank.ts) instead of re-fetched on
  // every open. That matters most for the other-platform bank: one shared
  // 9.19 MB document that this picker pulled again from each of its ~10 call
  // sites. `enabled` keeps the request pattern identical to the old
  // `bankSource === 'otherPlatform' ? … : …` branch — only one ever runs.
  const isOtherPlatform = bankSource === 'otherPlatform';
  const PAGE_SIZE = 25;
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'mcq' | 'programming' | 'frontend' | 'database'>(filterByType);
  const [selectedQuestions, setSelectedQuestions] = useState<Set<string>>(new Set());
  // With server pagination a selected question may no longer be on the current
  // page, but `onSelect` must still emit the FULL objects. Every selection
  // stores its row here (it is on screen at the moment it is ticked), so the
  // emit and the per-difficulty quota counting no longer depend on the row
  // still being in `questions`.
  const [selectedById, setSelectedById] = useState<Map<string, Question>>(new Map());
  const rememberSelected = (ids: Set<string>, pool: Question[]) =>
    setSelectedById(prev => {
      const next = new Map(prev);
      pool.forEach(q => { if (ids.has(q._id)) next.set(q._id, q); });
      Array.from(next.keys()).forEach(id => { if (!ids.has(id)) next.delete(id); });
      return next;
    });
  const [selectAll, setSelectAll] = useState(false);

  // ── Premium picker filters (two-panel redesign) ──
  const [selectedProblemTypes, setSelectedProblemTypes] = useState<Set<string>>(new Set());
  const [difficultyFilter, setDifficultyFilter] = useState<'all' | 'easy' | 'medium' | 'hard'>(initialDifficultyFilter ?? 'all');
  const [topicFilter, setTopicFilter] = useState<string>('all');
  const [tagFilter, setTagFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'relevance' | 'title' | 'difficulty'>('relevance');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');

  const qbIdOf = (q: any) => `QB-${(q?._id || '').toString().slice(-6).toUpperCase()}`;

  // ── Data source ─────────────────────────────────────────────────────────────
  // The other-platform bank is 5148 questions, so it is paginated and filtered
  // ON THE SERVER — the modal used to pull all 10.3 MB and render every row.
  // The authored bank is a couple of hundred at most and stays client-side,
  // sharing the questionbanks page's cache entry.
  //
  // A debounce keeps typing from firing a request per keystroke; every other
  // filter applies immediately.
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchTerm), 300);
    return () => clearTimeout(t);
  }, [searchTerm]);

  // Any filter change invalidates the current page number.
  const effectiveType = filterByType !== 'all' ? filterByType : filterType;
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, effectiveType, difficultyFilter, topicFilter, tagFilter, sortBy, selectedProblemTypes]);

  const serverParams = useMemo(
    () => ({
      page,
      limit: PAGE_SIZE,
      search: debouncedSearch || undefined,
      questionType: effectiveType !== 'all' ? effectiveType : undefined,
      problemTypes: selectedProblemTypes.size ? Array.from(selectedProblemTypes).join(',') : undefined,
      railDifficulty: difficultyFilter !== 'all' ? difficultyFilter : undefined,
      topic: topicFilter !== 'all' ? topicFilter : undefined,
      tag: tagFilter !== 'all' ? tagFilter : undefined,
      sort: sortBy !== 'relevance' ? sortBy : undefined,
    }),
    [page, debouncedSearch, effectiveType, selectedProblemTypes, difficultyFilter, topicFilter, tagFilter, sortBy],
  );

  const pagedQuery = useOtherPlatformQuestionBankQuery(serverParams, isOtherPlatform);
  const authoredQuery = useQuestionBankQuery(!isOtherPlatform);
  const activeQuery: any = isOtherPlatform ? pagedQuery : authoredQuery;
  const loading = activeQuery.isLoading;

  // The picker's own Question type (from QuestionsView) is structurally looser
  // than the service's; the objects are the same rows either way.
  const questions: Question[] = useMemo(() => {
    const rows = isOtherPlatform
      ? ((pagedQuery.data?.questions || []) as any[])
      : ((authoredQuery.data || []) as any[]);
    return rows.filter((q: any) => q.isActive !== false) as Question[];
  }, [isOtherPlatform, pagedQuery.data, authoredQuery.data]);


  // Update filterType when prop changes
  useEffect(() => {
    if (filterByType !== 'all') {
      setFilterType(filterByType);
    }
  }, [filterByType]);

  // An empty bank used to raise a toast from the fetcher; keep that, once per
  // resolved fetch rather than on every render.
  useEffect(() => {
    if (!activeQuery.isLoading && !activeQuery.isError && questions.length === 0) {
      toast('No questions found in question bank', { icon: 'ℹ️' });
    }
  }, [activeQuery.isLoading, activeQuery.isError, questions.length]);

  useEffect(() => {
    if (activeQuery.isError) {
      const error: any = activeQuery.error;
      console.error('Error fetching question bank:', error);
      toast.error(error?.response?.data?.message || 'Failed to load question bank');
    }
  }, [activeQuery.isError, activeQuery.error]);

  // Helper function to calculate string similarity
  const calculateStringSimilarity = (str1: string, str2: string): number => {
    if (!str1 || !str2) return 0;
    if (str1 === str2) return 1;
    
    const words1 = str1.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    const words2 = str2.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    
    if (words1.length === 0 || words2.length === 0) return 0;
    
    const commonWords = words1.filter(w => words2.includes(w));
    const totalWords = new Set([...words1, ...words2]);
    
    return commonWords.length / totalWords.size;
  };

  const getQuestionTitle = (question: any): string => {
    // Handle different formats of mcqQuestionTitle
    if (question.mcqQuestionTitle) {
      // Case 1: It's an object with a text property (like in your data)
      if (typeof question.mcqQuestionTitle === 'object' && question.mcqQuestionTitle !== null) {
        if (question.mcqQuestionTitle.text) {
          return question.mcqQuestionTitle.text.replace(/<[^>]*>/g, '').trim();
        }
        // Case 2: It's an array of content blocks
        if (Array.isArray(question.mcqQuestionTitle)) {
          return question.mcqQuestionTitle
            .filter((cb: any) => cb.type === 'text')
            .map((cb: any) => (cb.value || '').replace(/<[^>]*>/g, '').trim())
            .filter(Boolean)
            .join(' ');
        }
      }
      // Case 3: It's a string
      if (typeof question.mcqQuestionTitle === 'string') {
        return question.mcqQuestionTitle.replace(/<[^>]*>/g, '').trim();
      }
    }
    
    // Fallback to other title fields
    const title = question.questionText || question.title || '';
    
    if (typeof title === 'string') {
      return title.replace(/<[^>]*>/g, '').trim();
    }
    
    if (Array.isArray(title)) {
      return title
        .filter((cb: any) => cb.type === 'text')
        .map((cb: any) => (cb.value || '').replace(/<[^>]*>/g, '').trim())
        .filter(Boolean)
        .join(' ');
    }
    
    return 'Untitled Question';
  };

  const getQuestionDescription = (question: any): string => {
    if (question.questionType?.toLowerCase() === 'mcq') {
      const desc = question.mcqQuestionDescription;
      
      // Handle object with text property
      if (desc && typeof desc === 'object' && desc !== null) {
        if (desc.text) {
          return desc.text.replace(/<[^>]*>/g, '').trim();
        }
        if (Array.isArray(desc)) {
          return desc
            .filter((cb: any) => cb.type === 'text')
            .map((cb: any) => (cb.value || '').replace(/<[^>]*>/g, '').trim())
            .filter(Boolean)
            .join(' ');
        }
      }
      
      // Handle string
      if (typeof desc === 'string') {
        return desc.replace(/<[^>]*>/g, '').trim();
      }
      
      return 'Multiple Choice Question';
    }
    
    const description = question.description;
    if (typeof description === 'string') {
      return description.replace(/<[^>]*>/g, '').substring(0, 120);
    }
    
    if (description && typeof description === 'object' && description !== null) {
      if (description.text) {
        return description.text.replace(/<[^>]*>/g, '').substring(0, 120);
      }
      if (Array.isArray(description)) {
        const text = description
          .filter((b: any) => b.type === 'text')
          .map((b: any) => b.value || '')
          .join(' ')
          .replace(/<[^>]*>/g, '')
          .trim();
        return text.substring(0, 120) || 'No description provided';
      }
    }
    
    return 'No description provided';
  };

  // Check if a question is duplicate with existing questions
  const isDuplicate = (bankQuestion: Question): boolean => {
    // First check by ID
    if (existingQuestionIds.includes(bankQuestion._id)) {
      return true;
    }
    
    const bankTitle = getQuestionTitle(bankQuestion).toLowerCase().trim();
    
    // Check against each existing question
    return existingQuestions.some(existingQ => {
      const existingTitle = getQuestionTitle(existingQ).toLowerCase().trim();
      
      // Exact title match
      if (existingTitle === bankTitle) {
        return true;
      }
      
      // Similarity check for longer titles
      if (existingTitle.length > 20 && bankTitle.length > 20) {
        const similarity = calculateStringSimilarity(existingTitle, bankTitle);
        return similarity > 0.8;
      }
      
      return false;
    });
  };

  const getFilteredQuestions = () => {
    const arr = questions.filter(q => {
      // ✅ First filter by type if filterByType is specified
      const questionType = q.questionType?.toLowerCase() || '';

      // If filterByType is not 'all', only show questions of that type
      if (filterByType !== 'all' && questionType !== filterByType) {
        return false;
      }

      // Search filter — matches title, description, QB id, problem type,
      // topics and tags (per the "keyword, topic, or ID" placeholder).
      const title = getQuestionTitle(q);
      const description = getQuestionDescription(q);
      const searchLower = searchTerm.toLowerCase();
      const pt: string = (q as any).problemType || '';
      const qTopics: string[] = Array.isArray((q as any).topics) ? (q as any).topics : [];
      const qTags: string[] = Array.isArray((q as any).tags) ? (q as any).tags : [];
      const matchesSearch = searchTerm === '' ||
        (title && title.toLowerCase().includes(searchLower)) ||
        (description && description.toLowerCase().includes(searchLower)) ||
        qbIdOf(q).toLowerCase().includes(searchLower) ||
        pt.toLowerCase().includes(searchLower) ||
        qTopics.some(t => t.toLowerCase().includes(searchLower)) ||
        qTags.some(t => t.toLowerCase().includes(searchLower));

      // Type filter (for UI filtering within the filtered type)
      const matchesType = filterType === 'all' || questionType === filterType;

      // Premium filter rail
      if (selectedProblemTypes.size > 0 && !selectedProblemTypes.has(pt)) return false;
      if (difficultyFilter !== 'all' && getQuestionDifficulty(q) !== difficultyFilter) return false;
      if (topicFilter !== 'all' && !qTopics.some(t => String(t).trim().toLowerCase() === topicFilter)) return false;
      if (tagFilter !== 'all' && !qTags.some(t => String(t).trim().toLowerCase() === tagFilter)) return false;

      return matchesSearch && matchesType;
    });

    if (sortBy === 'title') {
      arr.sort((a, b) => getQuestionTitle(a).localeCompare(getQuestionTitle(b)));
    } else if (sortBy === 'difficulty') {
      const rank: Record<string, number> = { easy: 0, medium: 1, hard: 2 };
      arr.sort((a, b) => rank[getQuestionDifficulty(a)] - rank[getQuestionDifficulty(b)]);
    }
    return arr;
  };

  // ── Selection quota helpers ──
  const getQuestionDifficulty = (q: any): 'easy' | 'medium' | 'hard' => {
    const d = (q?.difficulty || q?.mcqQuestionDifficulty || 'medium').toString().toLowerCase();
    return d === 'easy' || d === 'hard' ? d : 'medium';
  };

  const countSelectedByDifficulty = (diff: 'easy' | 'medium' | 'hard') =>
    Array.from(selectedQuestions).reduce((n, id) => {
      // Look in the accumulated map first — a selection made on an earlier
      // page is no longer in `questions`.
      const q = selectedById.get(id) || questions.find(x => x._id === id);
      return q && getQuestionDifficulty(q) === diff ? n + 1 : n;
    }, 0);

  // Selected-per-difficulty tally computed ONCE per render for the row-level
  // "quota full" disable — calling countSelectedByDifficulty per row would be
  // O(selected × page). Same source of truth: the accumulated selectedById
  // map, falling back to the current page's rows.
  const selectedDiffTally = useMemo(() => {
    const tally = { easy: 0, medium: 0, hard: 0 };
    selectedQuestions.forEach(id => {
      const q = selectedById.get(id) || questions.find(x => x._id === id);
      if (q) tally[getQuestionDifficulty(q)] += 1;
    });
    return tally;
  }, [selectedQuestions, selectedById, questions]);

  const handleSelectAll = () => {
    // For the paginated bank this is the CURRENT PAGE, which is the sane
    // reading of "select all" — ticking all 5148 matches is never what the
    // teacher means, and the quota below would reject almost all of them.
    const filtered = filteredQuestions;
    if (selectAll) {
      setSelectedQuestions(new Set());
      setSelectedById(new Map());
      setSelectAll(false);
      return;
    }

    if (!selectionQuota) {
      const all = new Set(filtered.map(q => q._id));
      setSelectedQuestions(all);
      rememberSelected(all, filtered);
      setSelectAll(true);
      return;
    }

    // Respect the open-slot quota when selecting all.
    const newSelected = new Set<string>();
    if (selectionQuota.mode === 'general') {
      for (const q of filtered) {
        if (newSelected.size >= selectionQuota.remainingTotal) break;
        newSelected.add(q._id);
      }
    } else {
      const used = { easy: 0, medium: 0, hard: 0 };
      for (const q of filtered) {
        const d = getQuestionDifficulty(q);
        if (used[d] < (selectionQuota.remainingByDifficulty[d] ?? 0)) {
          newSelected.add(q._id);
          used[d] += 1;
        }
      }
    }
    setSelectedQuestions(newSelected);
    rememberSelected(newSelected, filtered);
    setSelectAll(false);
    if (newSelected.size < filtered.length) {
      toast('Selected up to the available open slots.', { icon: 'ℹ️' });
    }
  };

  const handleSelectQuestion = (questionId: string) => {
    const isSelected = selectedQuestions.has(questionId);

    // Enforce the exercise's open-slot quota when ticking (deselecting is always allowed).
    // Toasts here are intentionally clear and stay on screen for ~5s so the
    // teacher sees exactly WHY a question was rejected and WHAT to do next.
    if (!isSelected && selectionQuota) {
      const q = questions.find(x => x._id === questionId);
      if (selectionQuota.mode === 'general') {
        if (selectedQuestions.size >= selectionQuota.remainingTotal) {
          const msg = selectionQuota.remainingTotal > 0
            ? `Exercise quota reached — only ${selectionQuota.remainingTotal} slot(s) open in total. Deselect one of the questions you've already ticked before picking another.`
            : 'No open slots left in this exercise. Remove an existing question (or increase the configured count) before adding more from the bank.';
          toast(msg, { icon: '⚠️', duration: 5000, style: { maxWidth: 420 } });
          return;
        }
      } else {
        const diff = getQuestionDifficulty(q);
        const limit = selectionQuota.remainingByDifficulty[diff] ?? 0;
        const label = diff.charAt(0).toUpperCase() + diff.slice(1);
        if (limit === 0) {
          // This difficulty isn't configured at all for this exercise
          const openOther = (['easy', 'medium', 'hard'] as const)
            .filter(d => d !== diff && (selectionQuota.remainingByDifficulty[d] ?? 0) > 0)
            .map(d => `${d.charAt(0).toUpperCase() + d.slice(1)}`)
            .join(' / ');
          toast(
            openOther
              ? `This exercise doesn't accept ${label} questions. Open slots are for: ${openOther}.`
              : `This exercise doesn't accept ${label} questions and no other difficulty slots remain.`,
            { icon: '⚠️', duration: 5000, style: { maxWidth: 460 } },
          );
          return;
        }
        if (countSelectedByDifficulty(diff) >= limit) {
          // This difficulty IS configured but the teacher has already ticked the max
          const openOther = (['easy', 'medium', 'hard'] as const)
            .filter(d => d !== diff)
            .map(d => ({ d, rem: (selectionQuota.remainingByDifficulty[d] ?? 0) - countSelectedByDifficulty(d) }))
            .filter(x => x.rem > 0)
            .map(x => `${x.d.charAt(0).toUpperCase() + x.d.slice(1)} (${x.rem})`)
            .join(', ');
          toast(
            `${label} quota is full — you've already selected ${limit} of ${limit} allowed ${label.toLowerCase()} question${limit === 1 ? '' : 's'} for this exercise.` +
            (openOther
              ? ` You can still pick from: ${openOther}. Or deselect a ${label.toLowerCase()} question to swap.`
              : ` Deselect a ${label.toLowerCase()} question to swap, or change the exercise's per-difficulty quota.`),
            { icon: '⚠️', duration: 6000, style: { maxWidth: 520 } },
          );
          return;
        }
      }
    }

    const newSelected = new Set(selectedQuestions);
    if (isSelected) newSelected.delete(questionId);
    else newSelected.add(questionId);
    setSelectedQuestions(newSelected);
    rememberSelected(newSelected, questions);
    setSelectAll(false);
  };

  const handleAddSelected = () => {
    // From the accumulated map, so questions ticked on an earlier page are
    // still emitted in full.
    const selectedQuestionsList = Array.from(selectedQuestions)
      .map(id => selectedById.get(id) || questions.find(q => q._id === id))
      .filter(Boolean) as Question[];
    onSelect(selectedQuestionsList);
  };

  const getQuestionTypeIcon = (type?: string) => {
    const typeLower = type?.toLowerCase() || '';
    switch(typeLower) {
      case 'mcq': return <BookOpen className="h-4 w-4 text-purple-600" />;
      case 'programming': return <Code className="h-4 w-4 text-blue-600" />;
      case 'frontend': return <Layout className="h-4 w-4 text-amber-600" />;
      case 'database': return <Database className="h-4 w-4 text-emerald-600" />;
      default: return <BookOpen className="h-4 w-4 text-gray-600" />;
    }
  };

  const getDifficultyBadge = (difficulty?: string) => {
    const d = (difficulty || '').toLowerCase();
    if (d === 'easy')   return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    if (d === 'hard')   return 'bg-rose-100 text-rose-700 border-rose-200';
    if (d === 'medium') return 'bg-amber-100 text-amber-700 border-amber-200';
    return '';
  };

  const getQuestionTypeBadge = (type?: string) => {
    const typeLower = type?.toLowerCase() || '';
    const styles: Record<string, string> = {
      mcq: 'bg-purple-100 text-purple-800 border-purple-200',
      programming: 'bg-blue-100 text-blue-800 border-blue-200',
      frontend: 'bg-amber-100 text-amber-800 border-amber-200',
      database: 'bg-emerald-100 text-emerald-800 border-emerald-200'
    };
    return styles[typeLower] || 'bg-gray-100 text-gray-800 border-gray-200';
  };

  // For the paginated source the server has already applied every filter and
  // the sort, so the page is the list. Re-running the client predicate over it
  // would be a no-op at best and could hide rows if the two ever drifted.
  const filteredQuestions = isOtherPlatform ? questions : getFilteredQuestions();
  // Result count: the server's total across ALL pages, not just this one.
  const resultCount = isOtherPlatform ? (pagedQuery.data?.total ?? 0) : filteredQuestions.length;
  const totalPages = Math.max(1, Math.ceil(resultCount / PAGE_SIZE));

  // Get header title based on filter type + bank source
  const getHeaderTitle = () => {
    const prefix = bankSource === 'otherPlatform' ? 'Other Platform ' : '';
    if (filterByType === 'programming') return `${prefix}Programming Bank`;
    if (filterByType === 'mcq') return `${prefix}MCQ Bank`;
    if (filterByType === 'frontend') return `${prefix}Frontend Bank`;
    if (filterByType === 'database') return `${prefix}Database Bank`;
    return `${prefix}Question Bank`;
  };

  // ── Filter-rail derived data (counts computed within the type scope) ──
  const scopeQuestions = questions.filter(q => {
    const t = q.questionType?.toLowerCase() || '';
    if (filterByType !== 'all' && t !== filterByType) return false;
    if (filterByType === 'all' && filterType !== 'all' && t !== filterType) return false;
    return true;
  });
  // Facets must describe the WHOLE bank, not the current page — the server
  // counts them over the type-scoped set and ships them with each page.
  const serverFacets = isOtherPlatform ? pagedQuery.data?.facets : undefined;
  const problemTypeCounts: Record<string, number> = serverFacets?.problemTypeCounts ?? {};
  const difficultyCounts = (serverFacets?.difficultyCounts ?? { easy: 0, medium: 0, hard: 0 }) as Record<'easy' | 'medium' | 'hard', number>;
  if (!serverFacets) {
    scopeQuestions.forEach(q => {
      const pt = (q as any).problemType || '';
      if (pt) problemTypeCounts[pt] = (problemTypeCounts[pt] || 0) + 1;
    });
    scopeQuestions.forEach(q => { difficultyCounts[getQuestionDifficulty(q)] += 1; });
  }
  // Topic/Tag dropdown options: dedupe case-insensitively on a canonical
  // lowercase value, display a Title Case label, and sort by label so
  // mixed-case or kebab-case data can never split or scramble the list.
  const OPTION_ACRONYMS = new Set(['bfs', 'dfs', 'dp', 'sql', 'oop', 'api']);
  const prettyOptionLabel = (s: string) =>
    s.trim().replace(/-/g, ' ').split(/\s+/)
      .map(w => OPTION_ACRONYMS.has(w.toLowerCase()) ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  const buildOptions = (values: string[]) => {
    const seen = new Map<string, string>();
    values.forEach(v => {
      const key = String(v || '').trim().toLowerCase();
      if (key && !seen.has(key)) seen.set(key, prettyOptionLabel(String(v)));
    });
    return Array.from(seen, ([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  };
  const topicOptions = serverFacets
    ? buildOptions(serverFacets.topics.map(t => t.label))
    : buildOptions(scopeQuestions.flatMap(q => Array.isArray((q as any).topics) ? (q as any).topics : []));
  const tagOptions = serverFacets
    ? buildOptions(serverFacets.tags.map(t => t.label))
    : buildOptions(scopeQuestions.flatMap(q => Array.isArray((q as any).tags) ? (q as any).tags : []));
  const toggleProblemType = (pt: string) =>
    setSelectedProblemTypes(prev => {
      const next = new Set(prev);
      if (next.has(pt)) next.delete(pt); else next.add(pt);
      return next;
    });
  const clearAllFilters = () => {
    setSearchTerm('');
    setSelectedProblemTypes(new Set());
    setDifficultyFilter('all');
    setTopicFilter('all');
    setTagFilter('all');
    if (filterByType === 'all') setFilterType('all');
  };
  const anyFilterActive = searchTerm !== '' || selectedProblemTypes.size > 0 || difficultyFilter !== 'all'
    || topicFilter !== 'all' || tagFilter !== 'all' || (filterByType === 'all' && filterType !== 'all');
  const DIFF_ACCENT: Record<'easy' | 'medium' | 'hard', { on: string; off: string }> = {
    easy:   { on: 'border-emerald-300 bg-emerald-50 text-emerald-700', off: 'border-[#D7DCE5] bg-white text-emerald-600 hover:bg-emerald-50/60' },
    medium: { on: 'border-amber-300 bg-amber-50 text-amber-700',       off: 'border-[#D7DCE5] bg-white text-amber-600 hover:bg-amber-50/60' },
    hard:   { on: 'border-rose-300 bg-rose-50 text-rose-700',          off: 'border-[#D7DCE5] bg-white text-rose-600 hover:bg-rose-50/60' },
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="flex h-[min(940px,94vh)] w-[min(1400px,96vw)] flex-col overflow-hidden rounded-[18px] border border-[#E8EAF2] bg-white shadow-[0_20px_60px_rgba(16,24,40,0.12)]">
        {/* Header — compact, fixed */}
        <div className="flex h-[54px] shrink-0 items-center justify-between border-b border-[#E8EAF2] bg-white px-5">
          <div className="flex items-center gap-2.5">
            {onBack && (
              <button
                onClick={onBack}
                className="flex items-center gap-1 rounded-[8px] border border-brand-500/30 bg-brand-wash px-2 py-1 text-[11.5px] font-semibold text-brand-strong transition-colors hover:bg-brand-wash-hover"
              >
                <ChevronLeft className="h-3 w-3" />
                Back
              </button>
            )}
            <div className="flex h-8 w-8 items-center justify-center rounded-[8px] bg-brand-wash text-brand-strong">
              <Database className="h-4 w-4" />
            </div>
            <div className="flex items-baseline gap-2">
              <h2 className="text-[14px] font-bold leading-none text-heading">{getHeaderTitle()} – Add Questions</h2>
              <p className="hidden text-[11.5px] leading-none text-[#6B7280] md:block">
                Assignment: <span className="font-medium text-body">{exerciseData.exerciseName}</span>
              </p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-faint transition-colors hover:bg-row-hover hover:text-subtle" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body — filters rail + question list, independent scrolls */}
        <div className="flex min-h-0 flex-1 gap-3 p-3">
          {/* ── Filters rail ── */}
          <aside className="w-[26%] min-w-[225px] shrink-0 overflow-y-auto rounded-[14px] border border-[#E8EAF2] p-3.5">
            <div className="mb-3 flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-[13px] font-bold text-heading"><Filter className="h-3.5 w-3.5 text-brand-strong" /> Filters</span>
              {anyFilterActive && (
                <button onClick={clearAllFilters} className="text-[11.5px] font-semibold text-brand-strong hover:underline">Clear All</button>
              )}
            </div>

            <div className="mb-4">
              <div className="mb-1.5 text-[12px] font-semibold text-heading">Search</div>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-faint" />
                <input
                  type="text"
                  placeholder="Search by keyword, topic, or ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="h-9 w-full rounded-[10px] border border-[#E5E7EB] bg-white pl-8 pr-3 text-[12.5px] text-body placeholder:text-faint focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/15"
                />
              </div>
            </div>

            {filterByType === 'all' ? (
              <div className="mb-4">
                <div className="mb-1.5 text-[12px] font-semibold text-heading">Question Type</div>
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value as any)}
                  className="h-9 w-full rounded-[10px] border border-[#E5E7EB] bg-white px-2.5 text-[12.5px] text-body focus:outline-none focus:border-brand"
                >
                  <option value="all">All Types</option>
                  <option value="mcq">MCQ</option>
                  <option value="programming">Programming</option>
                  <option value="frontend">Frontend</option>
                  <option value="database">Database</option>
                </select>
              </div>
            ) : (
              <div className="mb-4">
                <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${getQuestionTypeBadge(filterByType)}`}>
                  Showing: {filterByType.toUpperCase()}
                </span>
              </div>
            )}

            <div className="mb-4">
              <div className="mb-1.5 text-[12px] font-semibold text-heading">Problem Type</div>
              <div className="space-y-1">
                {PROBLEM_TYPES.map(pt => (
                  <label key={pt.key} className="flex cursor-pointer items-center justify-between rounded-[8px] px-1.5 py-1 hover:bg-row-hover">
                    <span className="flex items-center gap-2 text-[12px] text-body">
                      <input type="checkbox" className="h-3.5 w-3.5"
                        checked={selectedProblemTypes.has(pt.key)}
                        onChange={() => toggleProblemType(pt.key)} />
                      {pt.label}
                    </span>
                    <span className="rounded-full bg-[#F3F4F8] px-1.5 py-px text-[10.5px] font-semibold text-subtle">{problemTypeCounts[pt.key] || 0}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="mb-4">
              <div className="mb-1.5 text-[12px] font-semibold text-heading">Difficulty Level</div>
              <div className="grid grid-cols-3 gap-1.5">
                {(['easy', 'medium', 'hard'] as const).map(d => (
                  <button key={d} type="button"
                    onClick={() => setDifficultyFilter(prev => prev === d ? 'all' : d)}
                    className={`h-8 rounded-[8px] border text-[11px] font-semibold capitalize transition-colors ${difficultyFilter === d ? DIFF_ACCENT[d].on : DIFF_ACCENT[d].off}`}>
                    {d} {difficultyCounts[d]}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-4">
              <FilterDropdown label="Topic" allLabel="All Topics" value={topicFilter}
                options={topicOptions} onChange={setTopicFilter} />
            </div>

            <div>
              <FilterDropdown label="Tags" allLabel="All Tags" value={tagFilter}
                options={tagOptions} onChange={setTagFilter} />
            </div>
          </aside>

          {/* ── Question list panel ── */}
          <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-[14px] border border-[#E8EAF2]">
            <div className="flex h-[44px] shrink-0 items-center justify-between border-b border-[#E8EAF2] px-3.5">
              <span className="flex items-center gap-1.5 text-[13px] font-bold text-heading">
                <Database className="h-3.5 w-3.5 text-brand-strong" />
                Questions ({resultCount})
              </span>
              <div className="flex items-center gap-2.5">
                <span className="hidden text-[11.5px] text-subtle lg:block">{resultCount} questions found</span>
                <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)}
                  className="h-8 rounded-[8px] border border-[#E5E7EB] bg-white px-2 text-[11.5px] text-body focus:outline-none focus:border-brand">
                  <option value="relevance">Sort by: Relevance</option>
                  <option value="title">Sort by: Title A–Z</option>
                  <option value="difficulty">Sort by: Difficulty</option>
                </select>
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => setViewMode('list')} title="List view"
                    className={`flex h-7 w-7 items-center justify-center rounded-[7px] border transition-colors ${viewMode === 'list' ? 'border-brand-500/40 bg-brand-wash text-brand-strong' : 'border-[#E5E7EB] bg-white text-faint hover:text-subtle'}`}>
                    <List className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" onClick={() => setViewMode('grid')} title="Grid view"
                    className={`flex h-7 w-7 items-center justify-center rounded-[7px] border transition-colors ${viewMode === 'grid' ? 'border-brand-500/40 bg-brand-wash text-brand-strong' : 'border-[#E5E7EB] bg-white text-faint hover:text-subtle'}`}>
                    <LayoutGrid className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>

        {/* Question List */}
        <div className="flex-1 overflow-y-auto px-3 py-3">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader className="h-8 w-8 animate-spin text-brand-strong" />
            </div>
          ) : filteredQuestions.length === 0 ? (
            <div className="text-center py-12">
              <BookOpen className="h-12 w-12 mx-auto text-gray-300 mb-3" />
              <h3 className="text-sm font-medium text-gray-900 mb-1">No questions found</h3>
              <p className="text-sm text-gray-500">
                {questions.length === 0
                  ? `Question bank is empty`
                  : searchTerm || (filterByType === 'all' && filterType !== 'all')
                    ? 'Try adjusting your filters'
                    : `No ${filterByType !== 'all' ? filterByType : ''} questions found in the bank`}
              </p>
            </div>
          ) : (
            <div className={viewMode === 'grid' ? 'grid grid-cols-2 gap-2.5' : 'space-y-2.5'}>
              {filteredQuestions.map((question) => {
                const title = getQuestionTitle(question);
                const description = getQuestionDescription(question);
                const isDuplicateQuestion = isDuplicate(question);
                const isSelected = selectedQuestions.has(question._id);
                const diff = getQuestionDifficulty(question);
                // Ticking this row would exceed the open-slot quota — disable
                // it with a visible reason instead of letting the click bounce
                // off handleSelectQuestion's toast (which stays as the hard
                // backstop and explains the cross-difficulty alternatives).
                const rowQuotaFull = !isSelected && !!selectionQuota && (
                  selectionQuota.mode === 'difficulty'
                    ? selectedDiffTally[diff] >= (selectionQuota.remainingByDifficulty[diff] ?? 0)
                    : selectedQuestions.size >= selectionQuota.remainingTotal
                );
                const rowDisabled = isDuplicateQuestion || rowQuotaFull;
                const pills: { label: string; cls: string }[] = [];
                if ((question as any).problemType) pills.push({ label: (question as any).problemType, cls: 'border-indigo-100 bg-indigo-50 text-indigo-600' });
                (Array.isArray((question as any).topics) ? (question as any).topics : []).slice(0, 2).forEach((t: string) => pills.push({ label: t, cls: 'border-purple-100 bg-purple-50 text-purple-600' }));
                (Array.isArray((question as any).tags) ? (question as any).tags : []).slice(0, 2).forEach((t: string) => pills.push({ label: t, cls: 'border-gray-200 bg-gray-50 text-gray-500' }));

                return (
                  <div
                    key={question._id}
                    onClick={() => !rowDisabled && handleSelectQuestion(question._id)}
                    className={`rounded-[12px] border p-3.5 transition-all ${
                      rowDisabled
                        ? 'cursor-not-allowed border-[#E8EAF2] opacity-50'
                        : isSelected
                          ? 'cursor-pointer border-brand-500/50 bg-brand-wash/40'
                          : 'cursor-pointer border-[#E8EAF2] bg-white hover:border-brand-500/40 hover:shadow-xs'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => !rowDisabled && handleSelectQuestion(question._id)}
                        disabled={rowDisabled}
                        className="mt-1 h-3.5 w-3.5 shrink-0 accent-brand-500 disabled:opacity-50"
                        onClick={(e) => e.stopPropagation()}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex min-w-0 items-center gap-1.5">
                          <span className="shrink-0 font-mono text-[10.5px] font-semibold text-subtle">Q. ID: {qbIdOf(question)}</span>
                          <span className="text-faint">•</span>
                          <span className="truncate text-[13px] font-bold text-heading">{title}</span>
                          {isDuplicateQuestion && <span className="shrink-0 text-[10.5px] font-medium text-amber-500">· exists</span>}
                          {!isDuplicateQuestion && rowQuotaFull && <span className="shrink-0 text-[10.5px] font-medium text-amber-600">· quota full</span>}
                        </div>
                        <p className="mt-0.5 truncate text-[12px] text-subtle">{description || '—'}</p>
                        {pills.length > 0 && (
                          <div className="mt-1.5 flex flex-wrap items-center gap-1">
                            {pills.map((p, i) => (
                              <span key={`${p.label}-${i}`} className={`inline-flex rounded-full border px-1.5 py-px text-[10px] font-medium ${p.cls}`}>{p.label}</span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className={`inline-flex h-6 items-center rounded-full border px-2 text-[10.5px] font-semibold capitalize ${getDifficultyBadge(diff)}`}>{diff}</span>
                        <button
                          type="button"
                          disabled={rowDisabled}
                          onClick={(e) => { e.stopPropagation(); if (!rowDisabled) handleSelectQuestion(question._id); }}
                          className={`inline-flex h-7 items-center gap-1 rounded-[8px] border px-2.5 text-[11.5px] font-semibold transition-colors disabled:cursor-not-allowed ${
                            isSelected
                              ? 'border-brand-500/50 bg-brand-strong text-white'
                              : 'border-brand-500/40 bg-white text-brand-strong hover:bg-brand-wash'
                          }`}
                        >
                          {isSelected ? <Check className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                          {isSelected ? 'Added' : 'Add'}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pager — only for the server-paginated bank. The authored bank is
              small enough to stay on one scrolling list, exactly as before. */}
          {isOtherPlatform && !loading && resultCount > 0 && totalPages > 1 && (
            <div className="mt-3 flex items-center justify-between border-t border-[#E8EAF2] pt-2.5">
              <span className="text-[11.5px] text-subtle">
                Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, resultCount)} of {resultCount}
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page <= 1 || pagedQuery.isFetching}
                  className="h-7 rounded-[7px] border border-[#D7DCE5] bg-white px-2.5 text-[11.5px] font-semibold text-body transition-colors hover:bg-row-hover disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Previous
                </button>
                <span className="px-1 text-[11.5px] tabular-nums text-subtle">
                  Page {page} of {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages || pagedQuery.isFetching}
                  className="h-7 rounded-[7px] border border-[#D7DCE5] bg-white px-2.5 text-[11.5px] font-semibold text-body transition-colors hover:bg-row-hover disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
          </div>
        </div>

        {/* Footer — sticky, compact */}
        <div className="flex h-[52px] shrink-0 items-center justify-between border-t border-[#E8EAF2] bg-white px-4">
          <div className="flex items-center gap-2">
            <span className={`inline-flex h-7 items-center gap-1.5 rounded-[8px] px-2.5 text-[12px] font-semibold ${selectedQuestions.size > 0 ? 'bg-brand-wash text-brand-strong' : 'bg-[#F3F4F8] text-subtle'}`}>
              <Check className="h-3.5 w-3.5" />
              {selectedQuestions.size} question{selectedQuestions.size !== 1 ? 's' : ''} selected
            </span>
            {selectionQuota && (
              <span className="text-[11px] text-subtle">
                {selectionQuota.mode === 'general'
                  ? `${selectedQuestions.size}/${selectionQuota.remainingTotal} open slot${selectionQuota.remainingTotal !== 1 ? 's' : ''}`
                  : (['easy', 'medium', 'hard'] as const)
                      .filter(d => selectionQuota.remainingByDifficulty[d] > 0)
                      .map(d => `${d.charAt(0).toUpperCase() + d.slice(1)} ${countSelectedByDifficulty(d)}/${selectionQuota.remainingByDifficulty[d]}`)
                      .join(' · ')}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="h-9 rounded-[10px] border border-[#D7DCE5] bg-white px-4 text-[12.5px] font-semibold text-body transition-colors hover:bg-row-hover"
            >
              Cancel
            </button>
            <button
              onClick={handleAddSelected}
              disabled={selectedQuestions.size === 0}
              className="inline-flex h-9 items-center gap-1.5 rounded-[10px] bg-brand-strong px-4 text-[12.5px] font-semibold text-white shadow-xs transition-colors hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Selected Questions ({selectedQuestions.size})
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuestionBankSelector;