// components/FeedbackResponsesModal.tsx

import React, { useState, useMemo } from 'react';
import {
  X,
  Star,
  User,
  Mail,
  Calendar,
  ChevronLeft,
  MessageSquare,
  FileText,
  Download,
  Search,
  ArrowUp,
  ArrowDown,
  Eye,
  Users,
} from 'lucide-react';
import { Poppins } from 'next/font/google';
import { Feedback, QuestionType } from '../types/feedback';
import { format } from 'date-fns';

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});

interface FeedbackResponsesModalProps {
  feedback: Feedback | null;
  isOpen: boolean;
  onClose: () => void;
}

interface StudentResponse {
  _id: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  answers: Array<{
    questionText: string;
    questionType: QuestionType;
    answer: any;
    reason?: string;
    _id: string;
  }>;
  overallReason: string;
  overallRating: number;
  isAnonymous: boolean;
  submittedAt: string;
}

const thinScroll =
  '[scrollbar-width:thin] [scrollbar-color:#cbd5e1_transparent] ' +
  '[&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent ' +
  '[&::-webkit-scrollbar-thumb]:bg-gray-300 [&::-webkit-scrollbar-thumb]:rounded-full ' +
  'hover:[&::-webkit-scrollbar-thumb]:bg-gray-400';

// Normalize to a 0–1 fraction so tone/label work for any scale (1–5, 1–10…)
const ratingFraction = (rating: number, max: number) => {
  if (!max || max <= 0) return 0;
  return Math.max(0, Math.min(1, rating / max));
};

const ratingTone = (rating: number, max: number) => {
  const f = ratingFraction(rating, max);
  if (f >= 0.8) return 'text-emerald-700 bg-emerald-50';
  if (f >= 0.6) return 'text-indigo-700 bg-indigo-50';
  if (f >= 0.4) return 'text-amber-700 bg-amber-50';
  if (f >= 0.2) return 'text-orange-700 bg-orange-50';
  return 'text-red-700 bg-red-50';
};

const ratingLabel = (rating: number, max: number) => {
  const f = ratingFraction(rating, max);
  if (f >= 0.8) return 'Excellent';
  if (f >= 0.6) return 'Good';
  if (f >= 0.4) return 'Average';
  if (f >= 0.2) return 'Poor';
  return 'Very Poor';
};

const stripHtml = (s: string) => {
  if (!s) return '';
  if (typeof window === 'undefined') return s.replace(/<[^>]*>/g, '');
  const tmp = document.createElement('div');
  tmp.innerHTML = s;
  return (tmp.textContent || tmp.innerText || '').trim();
};

export const FeedbackResponsesModal: React.FC<FeedbackResponsesModalProps> = ({
  feedback,
  isOpen,
  onClose,
}) => {
  const [selectedStudent, setSelectedStudent] = useState<StudentResponse | null>(null);
  const [view, setView] = useState<'list' | 'detail'>('list');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'rating' | 'date'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const studentResponses = feedback?.studentResponses || [];
  const questions = feedback?.questions || [];

  // Derive the overall rating scale from the questions' actual maxRating.
  // Falls back to 5 (typical default in this app) if none of the questions
  // declare one.
  const ratingScale = useMemo(() => {
    const maxes = questions
      .map((q) => q.ratingConfig?.maxRating)
      .filter((n): n is number => typeof n === 'number' && n > 0);
    if (maxes.length === 0) return 5;
    return Math.max(...maxes);
  }, [questions]);

  const totalResponses = studentResponses.length;
  const averageOverallRating =
    totalResponses > 0
      ? studentResponses.reduce((acc, r) => acc + (r.overallRating || 0), 0) / totalResponses
      : 0;

  const filteredStudents = useMemo(() => {
    let filtered = studentResponses;
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (s) =>
          s.studentName?.toLowerCase().includes(term) ||
          s.studentEmail?.toLowerCase().includes(term) ||
          s.answers.some((a) => a.answer?.toString().toLowerCase().includes(term))
      );
    }
    filtered = [...filtered].sort((a, b) => {
      let cmp = 0;
      switch (sortBy) {
        case 'name':
          cmp = (a.studentName || '').localeCompare(b.studentName || '');
          break;
        case 'rating':
          cmp = (a.overallRating || 0) - (b.overallRating || 0);
          break;
        case 'date':
          cmp = new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime();
          break;
      }
      return sortOrder === 'asc' ? cmp : -cmp;
    });
    return filtered;
  }, [studentResponses, searchTerm, sortBy, sortOrder]);

  if (!feedback || !isOpen) return null;

  // Group questions by category for the detail view.
  const groupedAnswersForDetail = (student: StudentResponse) => {
    const groups: { category: string | null; rows: typeof student.answers }[] = [];
    const map = new Map<string, number>();
    student.answers.forEach((ans) => {
      const q = questions.find((q) => q.questionText === ans.questionText);
      const cat = (q as any)?.category?.trim?.() || null;
      const key = cat || '__ungrouped__';
      let idx = map.get(key);
      if (idx === undefined) {
        idx = groups.length;
        map.set(key, idx);
        groups.push({ category: cat, rows: [] });
      }
      groups[idx].rows.push(ans);
    });
    return groups;
  };

  const closeAndReset = () => {
    setView('list');
    setSelectedStudent(null);
    onClose();
  };

  const exportCsv = () => {
    const csv = [
      ['Student Name', 'Email', 'Rating', 'Submitted At', ...questions.map((q) => q.questionText)],
      ...studentResponses.map((s) => [
        s.isAnonymous ? 'Anonymous' : s.studentName,
        s.isAnonymous ? '' : s.studentEmail,
        s.overallRating || '',
        s.submittedAt ? format(new Date(s.submittedAt), 'MMM d, yyyy') : '',
        ...s.answers.map((a) => stripHtml(a.answer?.toString() || '').replace(/,/g, ' ')),
      ]),
    ];
    const csvContent = csv.map((row) => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `feedback_responses_${feedback.feedbackTitle}.csv`;
    a.click();
  };

  // ── Shared modal shell — both views render inside this so width/height
  // ── stay constant and the list↔detail transition is seamless.
  return (
    <div
      className={`${poppins.className} fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/50 backdrop-blur-sm`}
      onClick={closeAndReset}
    >
      <div
        className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-800 w-full max-w-5xl h-[92vh] max-h-[92vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header (changes between views) ── */}
        {view === 'list' ? (
          <div className="flex-shrink-0 flex items-center justify-between px-5 py-3 border-b border-gray-200 dark:border-gray-800">
            <div className="min-w-0">
              <h2 className="text-[14px] font-semibold text-gray-900 dark:text-white tracking-tight">
                Student Responses
              </h2>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate mt-0.5">
                {feedback.feedbackTitle}
              </p>
            </div>
            <button
              onClick={closeAndReset}
              aria-label="Close"
              className="p-1.5 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-800 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          selectedStudent && (
            <div className="flex-shrink-0 flex items-center justify-between px-5 py-3 border-b border-gray-200 dark:border-gray-800">
              <div className="flex items-center gap-2 min-w-0">
                <button
                  onClick={() => {
                    setView('list');
                    setSelectedStudent(null);
                  }}
                  className="p-1.5 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-800 transition-colors"
                  aria-label="Back to list"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <div className="w-7 h-7 rounded-full bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center text-[12px] font-semibold text-indigo-700 dark:text-indigo-300">
                  {selectedStudent.isAnonymous
                    ? 'A'
                    : (selectedStudent.studentName || '?').charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <h2 className="text-[14px] font-semibold text-gray-900 dark:text-white tracking-tight truncate">
                    {selectedStudent.isAnonymous ? 'Anonymous Student' : selectedStudent.studentName}
                  </h2>
                  {!selectedStudent.isAnonymous && selectedStudent.studentEmail && (
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate flex items-center gap-1 mt-0.5">
                      <Mail className="h-3 w-3" />
                      {selectedStudent.studentEmail}
                    </p>
                  )}
                </div>
              </div>
              <button
                onClick={closeAndReset}
                aria-label="Close"
                className="p-1.5 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-800 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )
        )}

        {/* ── Body ── */}
        {view === 'list' ? (
          <ListBody
            totalResponses={totalResponses}
            averageOverallRating={averageOverallRating}
            questionsCount={questions.length}
            ratingScale={ratingScale}
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            sortBy={sortBy}
            setSortBy={setSortBy}
            sortOrder={sortOrder}
            setSortOrder={setSortOrder}
            exportCsv={exportCsv}
            filteredStudents={filteredStudents}
            onView={(s) => {
              setSelectedStudent(s);
              setView('detail');
            }}
          />
        ) : (
          selectedStudent && (
            <DetailBody
              student={selectedStudent}
              groupedAnswers={groupedAnswersForDetail(selectedStudent)}
              ratingScale={ratingScale}
              questions={questions}
            />
          )
        )}

        {/* ── Footer ── */}
        <div className="flex-shrink-0 px-5 py-2.5 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/60 flex items-center justify-between gap-3">
          <span className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
            {view === 'list'
              ? `Showing ${filteredStudents.length} of ${totalResponses} response${
                  totalResponses !== 1 ? 's' : ''
                }`
              : selectedStudent?.submittedAt
              ? `Submitted ${format(new Date(selectedStudent.submittedAt), 'MMM d, yyyy h:mm a')}`
              : ''}
          </span>
          <div className="flex items-center gap-2">
            {view === 'detail' && (
              <button
                onClick={() => {
                  setView('list');
                  setSelectedStudent(null);
                }}
                className="h-7 px-3 text-[12px] font-medium text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors"
              >
                Back to list
              </button>
            )}
            <button
              onClick={closeAndReset}
              className="h-7 px-3 text-[12px] font-medium text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// List body — toolbar + table of responses
// ─────────────────────────────────────────────────────────────────────────────
interface ListBodyProps {
  totalResponses: number;
  averageOverallRating: number;
  questionsCount: number;
  ratingScale: number;
  searchTerm: string;
  setSearchTerm: (v: string) => void;
  sortBy: 'name' | 'rating' | 'date';
  setSortBy: (v: 'name' | 'rating' | 'date') => void;
  sortOrder: 'asc' | 'desc';
  setSortOrder: (v: 'asc' | 'desc') => void;
  exportCsv: () => void;
  filteredStudents: StudentResponse[];
  onView: (s: StudentResponse) => void;
}

const ListBody: React.FC<ListBodyProps> = ({
  totalResponses,
  averageOverallRating,
  questionsCount,
  ratingScale,
  searchTerm,
  setSearchTerm,
  sortBy,
  setSortBy,
  sortOrder,
  setSortOrder,
  exportCsv,
  filteredStudents,
  onView,
}) => {
  return (
    <div className="flex-1 min-h-0 flex flex-col bg-white dark:bg-gray-900">
      {/* Stat strip + Export */}
      <div className="flex-shrink-0 flex items-center justify-between gap-3 px-5 py-2.5 border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-center gap-4 text-[11px] text-gray-500 dark:text-gray-400">
          <span>
            Total <span className="font-semibold text-gray-900 dark:text-gray-100">{totalResponses}</span>
          </span>
          <span className="h-3 w-px bg-gray-200 dark:bg-gray-700" />
          <span className="inline-flex items-center gap-1">
            Avg{' '}
            <Star className="h-3 w-3 text-amber-500 fill-amber-500" />
            <span className="font-semibold text-gray-900 dark:text-gray-100">
              {averageOverallRating > 0
                ? `${averageOverallRating.toFixed(1)} / ${ratingScale}`
                : 'N/A'}
            </span>
          </span>
          <span className="h-3 w-px bg-gray-200 dark:bg-gray-700" />
          <span>
            Questions <span className="font-semibold text-gray-900 dark:text-gray-100">{questionsCount}</span>
          </span>
        </div>
        <button
          onClick={exportCsv}
          className="inline-flex items-center gap-1.5 h-7 px-3 text-[12px] font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-md transition-colors"
        >
          <Download className="h-3.5 w-3.5" />
          Export CSV
        </button>
      </div>

      {/* Toolbar: search + sort */}
      <div className="flex-shrink-0 flex flex-col md:flex-row md:items-center gap-2 px-5 py-2.5 border-b border-gray-100 dark:border-gray-800">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by name, email or answer…"
            className="w-full h-8 pl-8 pr-3 text-[12px] border border-gray-200 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-gray-500 dark:text-gray-400">Sort</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="h-7 px-2 text-[12px] border border-gray-200 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="date">Date</option>
            <option value="name">Name</option>
            <option value="rating">Rating</option>
          </select>
          <button
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            className="h-7 w-7 inline-flex items-center justify-center border border-gray-200 dark:border-gray-700 rounded-md text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            title={sortOrder === 'asc' ? 'Ascending' : 'Descending'}
          >
            {sortOrder === 'asc' ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      {/* Table */}
      <div className={`flex-1 min-h-0 overflow-auto px-5 py-3 ${thinScroll}`}>
        {totalResponses === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-6">
            <Users className="h-10 w-10 text-gray-300 dark:text-gray-600 mb-3" />
            <h3 className="text-[14px] font-semibold text-gray-900 dark:text-white">
              No responses yet
            </h3>
            <p className="text-[12px] text-gray-500 dark:text-gray-400 mt-1">
              Students haven't submitted any responses for this feedback yet.
            </p>
          </div>
        ) : filteredStudents.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-6">
            <Search className="h-10 w-10 text-gray-300 dark:text-gray-600 mb-3" />
            <h3 className="text-[14px] font-semibold text-gray-900 dark:text-white">
              No matches
            </h3>
            <p className="text-[12px] text-gray-500 dark:text-gray-400 mt-1">
              Try a different search term.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto border border-gray-200 dark:border-gray-800 rounded-md">
            <table className="w-full border-collapse">
              <thead className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-800">
                <tr>
                  <th className="px-3 py-2 text-left text-[10px] font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider border-r border-gray-200 dark:border-gray-800 w-10">
                    #
                  </th>
                  <th className="px-4 py-2 text-left text-[10px] font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider border-r border-gray-200 dark:border-gray-800">
                    Student
                  </th>
                  <th className="px-4 py-2 text-left text-[10px] font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider border-r border-gray-200 dark:border-gray-800">
                    Email
                  </th>
                  <th className="px-4 py-2 text-left text-[10px] font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider border-r border-gray-200 dark:border-gray-800 w-28">
                    Rating
                  </th>
                  <th className="px-4 py-2 text-left text-[10px] font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider border-r border-gray-200 dark:border-gray-800 w-32">
                    Submitted
                  </th>
                  <th className="px-4 py-2 text-right text-[10px] font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider w-32">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {filteredStudents.map((student, index) => (
                  <tr
                    key={student._id || index}
                    className="hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors cursor-pointer"
                    onClick={() => onView(student)}
                  >
                    <td className="px-3 py-2.5 whitespace-nowrap text-[11px] font-mono text-gray-400 dark:text-gray-500 border-r border-gray-100 dark:border-gray-800">
                      {String(index + 1).padStart(2, '0')}
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap border-r border-gray-100 dark:border-gray-800">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center text-indigo-700 dark:text-indigo-300 font-semibold text-[11px]">
                          {student.isAnonymous
                            ? 'A'
                            : (student.studentName || '?').charAt(0).toUpperCase()}
                        </div>
                        <span className="text-[13px] font-medium text-gray-900 dark:text-white">
                          {student.isAnonymous ? 'Anonymous' : student.studentName || '—'}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap text-[12px] text-gray-600 dark:text-gray-300 border-r border-gray-100 dark:border-gray-800">
                      {student.isAnonymous ? '—' : student.studentEmail || '—'}
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap border-r border-gray-100 dark:border-gray-800">
                      {student.overallRating > 0 ? (
                        <span
                          className={`inline-flex items-center gap-1 text-[11px] font-semibold px-1.5 py-0.5 rounded ${ratingTone(
                            student.overallRating,
                            ratingScale
                          )}`}
                        >
                          <Star className="h-3 w-3 fill-current" />
                          {student.overallRating.toFixed(1)}
                          <span className="font-normal opacity-60">/{ratingScale}</span>
                        </span>
                      ) : (
                        <span className="text-[12px] text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap text-[11px] text-gray-500 dark:text-gray-400 border-r border-gray-100 dark:border-gray-800">
                      {student.submittedAt
                        ? format(new Date(student.submittedAt), 'MMM d, yyyy')
                        : 'N/A'}
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onView(student);
                        }}
                        className="inline-flex items-center gap-1 h-7 px-2.5 text-[11px] font-medium text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-md transition-colors"
                      >
                        <Eye className="h-3 w-3" />
                        View details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Detail body — answers grouped by category
// ─────────────────────────────────────────────────────────────────────────────
interface DetailBodyProps {
  student: StudentResponse;
  groupedAnswers: { category: string | null; rows: StudentResponse['answers'] }[];
  ratingScale: number;
  questions: Feedback['questions'];
}

const DetailBody: React.FC<DetailBodyProps> = ({
  student,
  groupedAnswers,
  ratingScale,
  questions,
}) => {
  const renderAnswer = (a: StudentResponse['answers'][number]) => {
    if (a.questionType === 'rating') {
      const v = Number(a.answer) || 0;
      // Per-question max so a 1–5 question doesn't get colored against a 1–10 scale.
      const q = questions.find((qq) => qq.questionText === a.questionText);
      const perQMax = q?.ratingConfig?.maxRating ?? ratingScale;
      return (
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-gray-900 dark:text-white">
            <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
            {v} <span className="font-normal text-gray-400">/ {perQMax}</span>
          </span>
          <span
            className={`text-[10px] font-medium px-1.5 py-0.5 rounded uppercase tracking-wide ${ratingTone(
              v,
              perQMax
            )}`}
          >
            {ratingLabel(v, perQMax)}
          </span>
        </div>
      );
    }
    const html = a.answer?.toString() || '';
    const plain = stripHtml(html);
    if (!plain) {
      return <span className="text-[12px] text-gray-400">No answer provided</span>;
    }
    return (
      <div
        className="text-[13px] text-gray-700 dark:text-gray-300 leading-relaxed prose prose-sm max-w-none"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  };

  const renderReason = (reason?: string) => {
    if (!reason || !stripHtml(reason)) return null;
    return (
      <div className="mt-1.5 text-[12px] text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-800/40 border-l-2 border-indigo-300 dark:border-indigo-700 pl-2 py-1">
        <span className="font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide text-[10px] mr-1">
          Reason
        </span>
        <span dangerouslySetInnerHTML={{ __html: reason }} />
      </div>
    );
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-white dark:bg-gray-900">
      {/* Quick stats strip */}
      <div className="flex-shrink-0 flex items-center gap-4 px-5 py-2.5 border-b border-gray-100 dark:border-gray-800 text-[11px] text-gray-500 dark:text-gray-400">
        <span className="inline-flex items-center gap-1">
          <Calendar className="h-3 w-3" />
          {student.submittedAt
            ? format(new Date(student.submittedAt), 'MMM d, yyyy h:mm a')
            : 'N/A'}
        </span>
        <span className="h-3 w-px bg-gray-200 dark:bg-gray-700" />
        <span className="inline-flex items-center gap-1">
          Overall{' '}
          {student.overallRating > 0 ? (
            <span className="inline-flex items-center gap-1 font-semibold text-gray-900 dark:text-gray-100">
              <Star className="h-3 w-3 text-amber-500 fill-amber-500" />
              {student.overallRating.toFixed(1)} / {ratingScale}
            </span>
          ) : (
            <span className="font-semibold text-gray-400">N/A</span>
          )}
        </span>
        <span className="h-3 w-px bg-gray-200 dark:bg-gray-700" />
        <span>
          {student.isAnonymous ? (
            <span className="text-gray-500">Anonymous</span>
          ) : (
            <span className="text-emerald-600 dark:text-emerald-400 font-medium">Identified</span>
          )}
        </span>
      </div>

      {/* Answers */}
      <div className={`flex-1 min-h-0 overflow-y-auto px-5 py-4 ${thinScroll}`}>
        {groupedAnswers.length === 0 ? (
          <div className="text-[12px] text-gray-400 text-center py-8">No answers recorded</div>
        ) : (
          groupedAnswers.map((group, gIdx) => (
            <div
              key={(group.category ?? '__ungrouped__') + gIdx}
              className={gIdx > 0 ? 'mt-5 pt-5 border-t border-gray-100 dark:border-gray-800' : ''}
            >
              {group.category && (
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-indigo-700 dark:text-indigo-300">
                    {group.category}
                  </span>
                  <span className="h-px flex-1 bg-gradient-to-r from-indigo-200 to-transparent dark:from-indigo-800" />
                  <span className="text-[10px] text-gray-400">
                    {group.rows.length} question{group.rows.length !== 1 ? 's' : ''}
                  </span>
                </div>
              )}
              <div className="divide-y divide-gray-100 dark:divide-gray-800">
                {group.rows.map((a, i) => (
                  <div key={a._id || i} className="py-3">
                    <div className="flex items-start gap-3">
                      <span className="text-[10px] font-mono text-gray-400 dark:text-gray-500 mt-0.5 w-6 shrink-0">
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5">
                          <p className="text-[13px] font-medium text-gray-900 dark:text-white">
                            {a.questionText}
                          </p>
                          <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 uppercase tracking-wide">
                            {a.questionType === 'rating' ? (
                              <Star className="h-3 w-3" />
                            ) : (
                              <FileText className="h-3 w-3" />
                            )}
                            {a.questionType === 'rating' ? 'Rating' : 'Text'}
                          </span>
                        </div>
                        {renderAnswer(a)}
                        {renderReason(a.reason)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}

        {/* Overall reason */}
        {student.overallReason && stripHtml(student.overallReason) && (
          <div className="mt-5 pt-5 border-t border-gray-100 dark:border-gray-800">
            <div className="flex items-center gap-2 mb-2">
              <MessageSquare className="w-3.5 h-3.5 text-indigo-500" />
              <p className="text-[13px] font-medium text-gray-900 dark:text-white">
                Overall comments
              </p>
            </div>
            <div
              className="text-[13px] text-gray-700 dark:text-gray-300 leading-relaxed bg-indigo-50/40 dark:bg-indigo-900/20 border-l-2 border-indigo-300 dark:border-indigo-700 pl-3 py-2 prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: student.overallReason }}
            />
          </div>
        )}
      </div>
    </div>
  );
};
