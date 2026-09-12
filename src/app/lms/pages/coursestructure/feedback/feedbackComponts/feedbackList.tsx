// components/FeedbackList.tsx

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  useGetAllFeedback,
  useDeleteFeedback,
  useToggleFeedbackStatus,
} from '../hooks/useFeedback';
import { Feedback, QuestionType } from '../types/feedback';
import {
  Plus,
  Edit,
  Trash2,
  Eye,
  Power,
  Search,
  Calendar,
  Users,
  Star,
  AlertCircle,
  RefreshCw,
  Type,
  MessageSquare,
  ChevronRight,
  Clock,
  FileText,
  BarChart3,
  ListChecks,
} from 'lucide-react';
import { format } from 'date-fns';
import { FeedbackViewModal } from './FeedbackViewModal';
import { FeedbackResponsesModal } from './FeedbackResponsesModal';
import { useCourseRosterQuery } from '@/queries/courseRoster';

interface FeedbackListProps {
  courseId?: string;
  onEdit?: (feedback: Feedback) => void;
  onView?: (feedback: Feedback) => void;
  onCreate?: () => void;
}

export const FeedbackList: React.FC<FeedbackListProps> = ({
  courseId,
  onEdit,
  onView,
  onCreate,
}) => {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');
  // Batches expanded in the table — the table lists batches; clicking a
  // batch row drops down its individual forms.
  const [expandedBatches, setExpandedBatches] = useState<Set<string>>(new Set());
  const toggleBatch = (key: string) =>
    setExpandedBatches((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  const [selectedFeedback, setSelectedFeedback] = useState<Feedback | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showResponsesModal, setShowResponsesModal] = useState(false);

  const {
    data: feedbacks,
    isLoading,
    error,
    isError,
    isFetching,
    refetch,
  } = useGetAllFeedback(courseId);

  // Map of userId → UNIQUE batch names in this course. A trainer can appear in
  // several batch entries, so names are de-duplicated (case-insensitive).
  // batchOrder keeps the course's batch order for the grouped list.
  // Map of userId → UNIQUE batch names in this course. A trainer can appear in
  // several batch entries, so names are de-duplicated (case-insensitive).
  // batchOrder keeps the course's batch order for the grouped list.
  // Derived from the shared roster entry (queries/courseRoster.ts) — this used
  // to be its own raw fetch of the FULL course payload.
  const { data: roster } = useCourseRosterQuery(courseId || '');
  const { batchesByUser, batchOrder } = useMemo(() => {
    const batches = roster?.batchAndParticipants || [];
    const map = new Map<string, string[]>();
    const order: string[] = [];
    batches.forEach((b: any) => {
      const batchName = (b?.batchName || '').trim();
      if (!batchName) return;
      if (!order.some((n) => n.toLowerCase() === batchName.toLowerCase())) {
        order.push(batchName);
      }
      (b?.users || []).forEach((entry: any) => {
        const u = entry?.user || entry;
        const id = String(u?._id || u?.id || '');
        if (!id) return;
        const prev = map.get(id) || [];
        if (!prev.some((n) => n.toLowerCase() === batchName.toLowerCase())) {
          prev.push(batchName);
        }
        map.set(id, prev);
      });
    });
    return { batchesByUser: map, batchOrder: order };
  }, [roster]);

  useEffect(() => {
    if (courseId) {
      refetch();
    }
  }, [courseId, refetch]);

  const filteredFeedbacks = useMemo(() => {
    if (!feedbacks || !Array.isArray(feedbacks)) return [];
    return feedbacks.filter((fb) =>
      fb.feedbackTitle?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [feedbacks, searchTerm]);

  // Group forms by batch: each batch is a section header and its forms are
  // listed under it (a batch with two forms shows both together). Forms carry
  // the batch picked at creation; legacy forms without one use their
  // trainer's batches instead (appearing under each), and forms with no
  // trainer/batch fall into a trailing "No batch" group.
  const groupedFeedbacks = useMemo(() => {
    const groups: { batch: string | null; items: Feedback[] }[] = [];
    const idx = new Map<string, number>();
    const push = (batch: string | null, fb: Feedback) => {
      const key = (batch ?? '__none__').toLowerCase();
      let i = idx.get(key);
      if (i === undefined) {
        i = groups.length;
        idx.set(key, i);
        groups.push({ batch, items: [] });
      }
      groups[i].items.push(fb);
    };
    // Seed with the course's batch order so sections follow it.
    batchOrder.forEach((name) => {
      idx.set(name.toLowerCase(), groups.length);
      groups.push({ batch: name, items: [] });
    });
    filteredFeedbacks.forEach((fb) => {
      // Forms created since batch selection became mandatory carry their
      // batch directly — group by it. Older forms without a stored batch
      // fall back to the batches their trainer teaches.
      const storedBatch = (fb.batchName || '').trim();
      if (storedBatch) {
        push(storedBatch, fb);
        return;
      }
      const trainerId = (fb as any).trainerId ? String((fb as any).trainerId) : '';
      const names = trainerId ? batchesByUser.get(trainerId) || [] : [];
      if (names.length === 0) push(null, fb);
      else names.forEach((n) => push(n, fb));
    });
    return groups.filter((g) => g.items.length > 0);
  }, [filteredFeedbacks, batchesByUser, batchOrder]);


  const deleteMutation = useDeleteFeedback();
  const toggleStatusMutation = useToggleFeedbackStatus();

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id);
    setShowDeleteModal(false);
  };

  const handleToggleStatus = (id: string, isActive: boolean) => {
    toggleStatusMutation.mutate({
      id,
      data: { isActive: !isActive },
    });
  };

  const handleViewFeedback = (feedback: Feedback) => {
    setSelectedFeedback(feedback);
    setShowViewModal(true);
    if (onView) onView(feedback);
  };

  const handleViewResponses = (feedback: Feedback) => {
    setSelectedFeedback(feedback);
    setShowResponsesModal(true);
  };

  const getStatusBadge = (isActive: boolean, isPublished: boolean) => {
    if (!isActive) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400">
          <span className="w-1.5 h-1.5 rounded-full bg-gray-400"></span>
          Inactive
        </span>
      );
    }
    if (isPublished) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
          Published
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
        Draft
      </span>
    );
  };

  const getQuestionTypeIcon = (type: QuestionType) => {
    switch (type) {
      case 'rating':
        return <Star className="h-3 w-3" />;
      case 'text':
      default:
        return <FileText className="h-3 w-3" />;
    }
  };

  const getTypeLabel = (type: QuestionType) => {
    switch (type) {
      case 'rating':
        return '⭐ Rating';
      case 'text':
      default:
        return '📝 Text';
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-blue-600 border-t-transparent"></div>
      </div>
    );
  }

  if (isError || error) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm p-8">
        <div className="text-red-600 flex flex-col items-center gap-3">
          <AlertCircle className="h-10 w-10" />
          <div className="text-center">
            <h3 className="text-base font-semibold">Error Loading Feedbacks</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {error?.message || 'Failed to load feedback data'}
            </p>
            <button
              onClick={() => refetch()}
              className="mt-3 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition-colors flex items-center gap-1.5"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  const totalCount = Array.isArray(feedbacks) ? feedbacks.length : 0;
  const publishedCount = Array.isArray(feedbacks) ? feedbacks.filter((fb) => fb.isPublished).length : 0;
  const activeCount = Array.isArray(feedbacks) ? feedbacks.filter((fb) => fb.isActive).length : 0;

  return (
    <>
      <div>
        {/* Toolbar: search + stats + actions */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2 mb-3">
          <div className="relative w-full lg:max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
            <input
              type="text"
              placeholder="Search feedback forms..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 h-7 text-[12px] border border-gray-200 dark:border-gray-700 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder:text-gray-400"
            />
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-3 text-[11px] text-gray-500 dark:text-gray-400">
              <span>
                Total <span className="font-semibold text-gray-900 dark:text-gray-100">{totalCount}</span>
              </span>
              <span className="h-3 w-px bg-gray-200 dark:bg-gray-700" />
              <span>
                Published <span className="font-semibold text-emerald-600 dark:text-emerald-400">{publishedCount}</span>
              </span>
              <span className="h-3 w-px bg-gray-200 dark:bg-gray-700" />
              <span>
                Active <span className="font-semibold text-indigo-600 dark:text-indigo-400">{activeCount}</span>
              </span>
            </div>
            <button
              onClick={() => refetch()}
              className="p-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              title="Refresh"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onCreate}
              className="inline-flex items-center gap-1.5 h-7 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-[12px] font-medium transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Feedback
            </button>
          </div>
        </div>

        {/* Batch table — one row per batch; clicking it drops down that
            batch's individual forms in a nested table. */}
        <div className="overflow-x-auto border border-gray-200 dark:border-gray-800 rounded-md">
          <table className="w-full border-collapse">
            <thead className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-800">
              <tr>
                <th className="px-4 py-2 text-left text-[11px] font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                  Batch
                </th>
                <th className="px-4 py-2 text-left text-[11px] font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                  Total Feedbacks
                </th>
                <th className="px-4 py-2 text-left text-[11px] font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                  Published
                </th>
                <th className="px-4 py-2 text-left text-[11px] font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                  Responses
                </th>
                <th className="px-4 py-2 text-right text-[11px] font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
              {!Array.isArray(feedbacks) || groupedFeedbacks.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <FileText className="h-8 w-8 text-gray-300 dark:text-gray-600" />
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {!Array.isArray(feedbacks) ? 'No feedback data available' : 'No feedback forms found'}
                      </p>
                      {courseId && (
                        <button
                          onClick={() => refetch()}
                          className="text-blue-600 hover:text-blue-700 text-sm flex items-center gap-1"
                        >
                          <RefreshCw className="h-3 w-3" />
                          Refresh
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                groupedFeedbacks.map((group) => {
                  const key = group.batch ?? '__none__';
                  const open = expandedBatches.has(key);
                  const publishedInBatch = group.items.filter((f) => f.isPublished).length;
                  const responsesInBatch = group.items.reduce(
                    (s, f) => s + (f.statistics?.totalStudents || 0),
                    0
                  );
                  return (
                    <React.Fragment key={key}>
                      {/* Batch row */}
                      <tr
                        onClick={() => toggleBatch(key)}
                        className={`cursor-pointer transition-colors ${
                          open
                            ? 'bg-blue-50/60 dark:bg-blue-900/15'
                            : 'hover:bg-gray-50 dark:hover:bg-gray-800/30'
                        }`}
                      >
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <ChevronRight
                              className={`h-3.5 w-3.5 shrink-0 transition-transform ${
                                open ? 'rotate-90 text-blue-600 dark:text-blue-400' : 'text-gray-400'
                              }`}
                            />
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold rounded-full bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                              <Users className="h-3 w-3" />
                              {group.batch || 'No batch'}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                          {group.items.length}
                          <span className="ml-1 text-[11px] text-gray-400">
                            {group.items.length === 1 ? 'form' : 'forms'}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-emerald-600 dark:text-emerald-400 font-medium">
                          {publishedInBatch}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                          {responsesInBatch}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-right">
                          <span
                            className={`inline-flex items-center gap-1 h-7 px-2.5 rounded-md text-[11px] font-semibold border transition-colors ${
                              open
                                ? 'bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700'
                                : 'bg-white text-blue-600 border-blue-200 hover:bg-blue-50 dark:bg-transparent dark:text-blue-400 dark:border-blue-800'
                            }`}
                          >
                            {open ? 'Hide feedback' : 'View feedback'}
                            <ChevronRight
                              className={`h-3.5 w-3.5 transition-transform ${
                                open ? 'rotate-90' : ''
                              }`}
                            />
                          </span>
                        </td>
                      </tr>

                      {/* Dropdown — the batch's individual forms live in an
                          indented card with a blue accent line tying it to
                          the batch row above; the bottom padding gives clear
                          air before the next batch row. */}
                      {open && (
                        <tr className="bg-blue-50/40 dark:bg-blue-900/10">
                          <td colSpan={5} className="px-4 pt-1 pb-4">
                            <div className="ml-1.5 pl-3 border-l-2 border-blue-300 dark:border-blue-700">
                              <div className="overflow-x-auto bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg shadow-sm">
                                <table className="w-full border-collapse">
                                  <thead className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-800">
                                    <tr>
                                      <th className="px-4 py-2 text-left text-[11px] font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                                        Feedback Title
                                      </th>
                                      <th className="px-4 py-2 text-left text-[11px] font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                                        Questions
                                      </th>
                                      <th className="px-4 py-2 text-left text-[11px] font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                                        Responses
                                      </th>
                                      <th className="px-4 py-2 text-left text-[11px] font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                                        Status
                                      </th>
                                      <th className="px-4 py-2 text-left text-[11px] font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                                        Created
                                      </th>
                                      <th className="px-4 py-2 text-right text-[11px] font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                                        Actions
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                                    {group.items.map((feedback) => (
                    <tr
                      key={`${key}-${feedback._id}`}
                      className="hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors group"
                    >
                      <td className="px-4 py-2.5">
                        <p className="text-sm font-medium text-gray-900 dark:text-white line-clamp-1">
                          {feedback.feedbackTitle || 'Untitled'}
                        </p>
                        {(feedback as any).trainerName && (
                          <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-1">
                            Trainer:{' '}
                            <span className="font-medium text-gray-600 dark:text-gray-300">
                              {(feedback as any).trainerName}
                            </span>
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <span
                          className={`text-sm ${
                            (feedback.questions?.length || 0) === 0
                              ? 'text-gray-400 dark:text-gray-600'
                              : 'text-gray-700 dark:text-gray-300'
                          }`}
                        >
                          {feedback.questions?.length || 0}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <div>
                          <span
                            className={`text-sm ${
                              (feedback.statistics?.totalStudents || 0) === 0
                                ? 'text-gray-400 dark:text-gray-600'
                                : 'font-medium text-gray-900 dark:text-white'
                            }`}
                          >
                            {feedback.statistics?.totalStudents || 0}
                          </span>
                          {feedback.statistics?.averageRating > 0 && (
                            <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                              ★ {feedback.statistics.averageRating.toFixed(1)}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        {getStatusBadge(feedback.isActive, feedback.isPublished)}
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {feedback.createdAt ? format(new Date(feedback.createdAt), 'MMM d, yyyy') : 'N/A'}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-0.5">
                          <button
                            onClick={() => {
                              const q = new URLSearchParams({
                                feedbackId: feedback._id,
                                ...(courseId ? { courseId } : {}),
                              }).toString();
                              router.push(`/lms/pages/coursestructure/feedback/questions?${q}`);
                            }}
                            className="p-1.5 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors"
                            title="Manage Questions"
                          >
                            <ListChecks className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleViewResponses(feedback)}
                            className="p-1.5 text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors"
                            title="View Responses"
                          >
                            <MessageSquare className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => {
                              const q = new URLSearchParams({
                                feedbackId: feedback._id,
                                ...(courseId ? { courseId } : {}),
                              }).toString();
                              router.push(`/lms/pages/coursestructure/feedback/report/generate?${q}`);
                            }}
                            className="p-1.5 text-gray-400 hover:text-violet-600 dark:hover:text-violet-400 rounded-lg hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-colors"
                            title="Report"
                          >
                            <BarChart3 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleViewFeedback(feedback)}
                            className="p-1.5 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                            title="View Details"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => onEdit?.(feedback)}
                            className="p-1.5 text-gray-400 hover:text-amber-600 dark:hover:text-amber-400 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors"
                            title="Edit"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleToggleStatus(feedback._id, feedback.isActive)}
                            className={`p-1.5 rounded-lg transition-colors ${
                              feedback.isActive
                                ? 'text-emerald-600 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/20'
                                : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                            }`}
                            title={feedback.isActive ? 'Deactivate' : 'Activate'}
                          >
                            <Power className="h-4 w-4" />
                          </button>
                          <span className="w-px h-4 bg-gray-200 dark:bg-gray-700 mx-1" />
                          <button
                            onClick={() => {
                              setSelectedFeedback(feedback);
                              setShowDeleteModal(true);
                            }}
                            className="p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Delete Modal */}
        {showDeleteModal && selectedFeedback && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-900 rounded-xl max-w-md w-full p-6 shadow-xl">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-red-50 dark:bg-red-900/20 rounded-full">
                  <Trash2 className="h-5 w-5 text-red-600 dark:text-red-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Delete Feedback
                </h3>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                Are you sure you want to delete "<span className="font-medium text-gray-900 dark:text-white">{selectedFeedback.feedbackTitle}</span>"? This action cannot be undone.
              </p>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowDeleteModal(false)}
                  className="px-4 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDelete(selectedFeedback._id)}
                  className="px-4 py-1.5 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* View Modal */}
      <FeedbackViewModal
        feedback={selectedFeedback}
        isOpen={showViewModal}
        onClose={() => {
          setShowViewModal(false);
          setSelectedFeedback(null);
        }}
      />

      {/* Responses Modal */}
      <FeedbackResponsesModal
        feedback={selectedFeedback}
        isOpen={showResponsesModal}
        onClose={() => {
          setShowResponsesModal(false);
          setSelectedFeedback(null);
        }}
      />
    </>
  );
};