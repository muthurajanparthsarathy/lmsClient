'use client';

/**
 * External → Assessment — the list.
 *
 * Mirrors the You_Do Assessment list (search + status filter + Refresh +
 * Create on one toolbar, a CSS-grid table on the DataTable rhythm — h-8
 * canvas header, 44px hairline-bounded rows — and a portal row menu) so the
 * two screens read as one system.
 *
 * The differences are all data, not design: these assessments belong to no
 * course, their participants are not LMS users, and every call goes to
 * /api/admin/external.
 *
 * Unlike the You_Do list this uses React Query MUTATIONS with key-factory
 * invalidation rather than manual refetch(), so a delete or an edit updates
 * every dependent view without a hand-rolled refresh.
 */

import React, { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Search, X, Plus, RefreshCw, FileText, MoreVertical, Pencil, Trash2,
  Users, ListChecks, Clock, AlertTriangle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import DashboardLayout from '@/app/lms/component/layout';
import TableFooter from '@/app/lms/shared/listing/TableFooter';
import { pageEnter } from '@/app/lms/shared/ui';
import { usePermissions } from '@/hooks/usePermissions';
import { PERMISSION_IDS } from '@/app/lms/pages/usermanagement/components/permissions/index';
import {
  externalAssessmentApi,
  externalAssessmentKeys,
  type ExternalAssessment,
} from '@/apiServices/externalAssessment';
import CreateExternalAssessmentModal from './CreateExternalAssessmentModal';
import ExternalQuestionsPanel from './ExternalQuestionsPanel';
import ExternalParticipantsPanel from './ExternalParticipantsPanel';

const ITEMS_PER_PAGE = 10;

// Grid template mirrors the You_Do list's rowBase, retuned for these columns:
// Name (flex) · Schedule · Duration · Questions · Participants · Status · Actions
const rowBase: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0,2fr) 150px 90px 90px 100px 100px 60px',
  gap: 8,
  alignItems: 'center',
  padding: '0 12px',
  transition: 'background-color 0.15s',
};

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  draft: { label: 'Draft', color: '#b45309', bg: 'rgba(245,158,11,0.12)' },
  published: { label: 'Published', color: '#059669', bg: 'rgba(5,150,105,0.10)' },
  archived: { label: 'Archived', color: '#6b7280', bg: 'rgba(107,114,128,0.10)' },
};

// "10 Sep 2026, 10:00 AM" — spelled month, because 10/09 is ambiguous.
const formatSchedule = (date?: string | null, time?: string) => {
  if (!date) return '—';
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return '—';
  const day = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  if (!time) return day;
  const [h, m] = time.split(':').map(Number);
  if (!Number.isFinite(h)) return day;
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${day}, ${h12}:${String(m || 0).padStart(2, '0')} ${suffix}`;
};

export default function ExternalAssessmentPage() {
  const queryClient = useQueryClient();
  const { can } = usePermissions();
  const PAGE = PERMISSION_IDS.ADMIN_EXTERNAL_ASSESSMENT;

  const canCreate = can(PAGE, 'Create Assessment');
  const canEdit = can(PAGE, 'Edit');
  const canDelete = can(PAGE, 'Delete');
  const canQuestions = can(PAGE, 'Questions');
  const canParticipants = can(PAGE, 'Participants');

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<ExternalAssessment | null>(null);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<ExternalAssessment | null>(null);

  // In-place panel swaps, exactly like the You_Do list swaps to QuestionsTest
  // and GradesFlow: the shell stays mounted and only this panel changes.
  const [questionsFor, setQuestionsFor] = useState<ExternalAssessment | null>(null);
  const [participantsFor, setParticipantsFor] = useState<ExternalAssessment | null>(null);

  const listKey = externalAssessmentKeys.list({ status });
  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: listKey,
    // Search is filtered client-side (the list is small and it keeps typing
    // instant); status goes to the server so the key stays meaningful.
    queryFn: () => externalAssessmentApi.list({ status, limit: 200 }),
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const assessments = data?.assessments ?? [];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return assessments;
    return assessments.filter(
      (a) =>
        a.assessmentName?.toLowerCase().includes(q) ||
        a.description?.toLowerCase().includes(q),
    );
  }, [assessments, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const rangeStart = filtered.length === 0 ? 0 : (safePage - 1) * ITEMS_PER_PAGE + 1;
  const rangeEnd = Math.min(safePage * ITEMS_PER_PAGE, filtered.length);
  const pageRows = filtered.slice((safePage - 1) * ITEMS_PER_PAGE, safePage * ITEMS_PER_PAGE);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => externalAssessmentApi.remove(id),
    onSuccess: () => {
      toast.success('Assessment deleted', { position: 'top-right', duration: 1800 });
      // Invalidate the whole namespace: a deleted assessment's questions,
      // participants and results caches are all stale now too.
      queryClient.invalidateQueries({ queryKey: externalAssessmentKeys.all });
      setConfirmDelete(null);
    },
    onError: (err: any) =>
      toast.error(err?.message || 'Could not delete the assessment', {
        position: 'top-right',
        duration: 4000,
      }),
  });

  // ── The wizard ──
  //
  // Declared HERE, above the early returns below, and rendered in both
  // branches. It used to sit only in the main return, so "Edit assessment"
  // from inside the questions panel set `showModal` while nothing was mounted
  // to read it: nothing opened, and the wizard then sprang up on Back, when
  // the main branch finally rendered with the flag still true.
  //
  // One element, one piece of state — rendering it in two places keeps the two
  // entry points from drifting.
  const wizard = (
    <CreateExternalAssessmentModal
      open={showModal}
      editing={editing}
      onClose={() => { setShowModal(false); setEditing(null); }}
      onSaved={(saved) => {
        queryClient.invalidateQueries({ queryKey: externalAssessmentKeys.all });
        // The questions panel holds the assessment as a STATE SNAPSHOT, not as
        // query data, so an edit made from inside it would otherwise leave the
        // quota rail and the details modal reading the pre-edit configuration
        // until the user navigated out and back in.
        if (saved && questionsFor && saved._id === questionsFor._id) {
          setQuestionsFor(saved);
        }
      }}
    />
  );

  // ── In-place panels ──
  if (questionsFor) {
    return (
      <DashboardLayout>
        <ExternalQuestionsPanel
          assessment={questionsFor}
          onBack={() => {
            setQuestionsFor(null);
            queryClient.invalidateQueries({ queryKey: externalAssessmentKeys.lists() });
          }}
          // "Assessment Details" on the authoring rail reopens the wizard on
          // this assessment, matching the You_Do form's Edit Exercise button.
          onEditAssessment={() => { setEditing(questionsFor); setShowModal(true); }}
        />
        {wizard}
      </DashboardLayout>
    );
  }
  if (participantsFor) {
    return (
      <DashboardLayout>
        <ExternalParticipantsPanel
          assessment={participantsFor}
          onBack={() => {
            setParticipantsFor(null);
            queryClient.invalidateQueries({ queryKey: externalAssessmentKeys.lists() });
          }}
        />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="min-h-full h-full flex flex-col">
        <motion.div
          variants={pageEnter}
          initial="hidden"
          animate="visible"
          className="flex flex-1 min-h-0 flex-col px-4 sm:px-6 lg:px-8 pt-3 pb-3 text-body"
        >
          {/* ── Header ── */}
          <header className="shrink-0">
            <h1 className="text-base sm:text-lg font-semibold text-heading tracking-[-0.01em] leading-tight">
              External Assessment
            </h1>
            <p className="mt-0.5 text-xs text-subtle">
              Assessments for participants outside the LMS — invited by email, no account needed.
            </p>

            {/* ── Toolbar ── search · status · refresh │ create ── */}
            <div className="mt-2.5 flex items-center gap-2 flex-wrap min-w-0">
              <div className="relative flex-1 min-w-[220px] max-w-md">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-faint pointer-events-none" />
                <input
                  placeholder="Search assessments…"
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                  className="h-8 w-full pl-8 pr-8 rounded-control border border-hairline-strong bg-surface text-xs text-body placeholder:text-faint focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/15 transition-colors duration-150"
                />
                {search && (
                  <button
                    type="button"
                    aria-label="Clear search"
                    onClick={() => setSearch('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex size-5 items-center justify-center rounded-chip text-faint hover:bg-ink-100 hover:text-heading transition-colors duration-150"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>

              <select
                value={status}
                onChange={(e) => { setStatus(e.target.value); setPage(1); }}
                className={`h-8 rounded-control border border-hairline-strong bg-surface px-2.5 text-xs font-medium text-body focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15 transition-colors duration-150 ${status ? 'border-brand bg-brand-wash text-brand-strong' : ''}`}
                style={{ minWidth: 120 }}
              >
                <option value="">All Status</option>
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="archived">Archived</option>
              </select>

              <div className="ml-auto flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => refetch()}
                  title="Refresh"
                  className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-control border border-hairline-strong bg-surface text-xs font-medium text-body hover:bg-row-hover hover:text-heading transition-colors duration-150"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
                  <span className="hidden sm:inline">Refresh</span>
                </button>
              </div>

              <span className="hidden sm:inline-block h-5 w-px bg-hairline-strong mx-0.5" aria-hidden />

              {canCreate && (
                <button
                  type="button"
                  onClick={() => { setEditing(null); setShowModal(true); }}
                  className="inline-flex items-center gap-1.5 h-8 px-3.5 rounded-control bg-brand-strong text-white shadow-sm hover:bg-brand-800 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30 flex-shrink-0"
                >
                  <Plus size={14} strokeWidth={2.4} />
                  <span className="text-xs font-semibold">Create Assessment</span>
                </button>
              )}
            </div>

            {search && (
              <div className="flex items-center gap-2 pt-2 flex-wrap min-w-0">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-brand-strong">Filtering:</span>
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="inline-flex items-center gap-1 h-6 px-2 rounded-full border border-brand-500/30 bg-brand-wash text-2xs font-medium text-brand-strong hover:bg-brand-100 transition-colors duration-150"
                >
                  &quot;{search}&quot; <X size={11} />
                </button>
                <span className="text-2xs ml-auto text-subtle tabular-nums">
                  {filtered.length} result{filtered.length !== 1 ? 's' : ''}
                </span>
              </div>
            )}
          </header>

          {/* ── Body ── */}
          <div className="mt-3 flex-1 min-h-0 flex flex-col">
            {error ? (
              <div className="m-4 p-4 rounded-tile border border-danger-500/20 bg-danger-50 text-center">
                <AlertTriangle className="mx-auto h-5 w-5 text-danger-700" />
                <p className="mt-2 text-sm font-medium text-danger-700">
                  {(error as any)?.message || 'Could not load assessments'}
                </p>
                <button onClick={() => refetch()} className="mt-2 text-xs font-semibold underline text-danger-700">
                  Try again
                </button>
              </div>
            ) : (
              <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
                  {/* Header row */}
                  <div style={rowBase} className="h-8 border-b border-hairline bg-canvas sticky top-0 z-10">
                    {['Assessment Name', 'Starts', 'Duration', 'Questions', 'Participants', 'Status', ''].map((h, i) => (
                      <div key={i} className="text-[10px] font-semibold uppercase tracking-wider text-subtle">{h}</div>
                    ))}
                  </div>

                  {isLoading ? (
                    Array.from({ length: 6 }).map((_, i) => (
                      <div key={i} style={{ ...rowBase, height: 44 }} className="border-b border-hairline">
                        {Array.from({ length: 7 }).map((__, j) => (
                          <div key={j} className="h-3 rounded bg-ink-100 animate-pulse" style={{ width: `${45 + ((i + j) % 4) * 12}%` }} />
                        ))}
                      </div>
                    ))
                  ) : filtered.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                      <div className="relative w-14 h-14 rounded-2xl flex items-center justify-center mb-4 bg-brand-wash border border-dashed border-brand-500/40">
                        <FileText size={22} className="text-brand-strong" strokeWidth={1.5} />
                        <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center bg-brand-strong text-white">
                          <Plus size={10} strokeWidth={3} />
                        </div>
                      </div>
                      <p className="text-sm font-bold text-heading mb-1">
                        {search || status ? 'No matching assessments' : 'No External Assessments Yet'}
                      </p>
                      <p className="text-[11px] font-medium mb-5 max-w-[260px] leading-relaxed text-subtle">
                        {search || status
                          ? 'Try a different search or status filter.'
                          : 'Create one, add questions, then invite participants by email — they need no LMS account.'}
                      </p>
                      {canCreate && !search && !status && (
                        <button
                          onClick={() => { setEditing(null); setShowModal(true); }}
                          className="inline-flex items-center gap-1.5 h-9 px-5 rounded-control bg-brand-strong text-white text-xs font-bold shadow-sm hover:bg-brand-800 transition-colors"
                        >
                          <Plus size={12} strokeWidth={2.5} /> Create Assessment
                        </button>
                      )}
                    </div>
                  ) : (
                    pageRows.map((a, idx) => {
                      const meta = STATUS_META[a.status] || STATUS_META.draft;
                      const isLast = idx === pageRows.length - 1;
                      return (
                        <div
                          key={a._id}
                          style={{ ...rowBase, height: 44 }}
                          className={`${isLast ? '' : 'border-b border-hairline'} bg-surface hover:bg-row-hover transition-colors duration-150`}
                        >
                          <div className="min-w-0">
                            <span className="text-xs font-semibold text-heading truncate block" title={a.assessmentName}>
                              {a.assessmentName}
                            </span>
                          </div>
                          <div className="text-[11px] text-body truncate" title={formatSchedule(a.startDate, a.startTime)}>
                            {formatSchedule(a.startDate, a.startTime)}
                          </div>
                          <div className="text-[11px] text-body tabular-nums flex items-center gap-1">
                            <Clock size={11} className="text-faint" />{a.durationMinutes ?? 0}m
                          </div>
                          <div className="text-[11px] text-body tabular-nums">{a.totalQuestions ?? 0}</div>
                          <div className="text-[11px] text-body tabular-nums">{a.participantCount ?? 0}</div>
                          <div>
                            <span
                              className="inline-flex items-center h-5 rounded-full px-2 text-[10px] font-bold"
                              style={{ background: meta.bg, color: meta.color }}
                            >
                              {meta.label}
                            </span>
                          </div>
                          <div className="relative flex justify-end">
                            <button
                              type="button"
                              aria-label="Row actions"
                              onClick={() => setMenuFor(menuFor === a._id ? null : a._id)}
                              className="inline-flex size-7 items-center justify-center rounded-control text-subtle hover:bg-ink-100 hover:text-heading transition-colors"
                            >
                              <MoreVertical size={14} />
                            </button>
                            {menuFor === a._id && (
                              <>
                                {/* Click-away scrim — plain fixed overlay rather
                                    than a document listener, so one click both
                                    closes the menu and is swallowed. */}
                                <div className="fixed inset-0 z-40" onClick={() => setMenuFor(null)} />
                                <div className="absolute right-0 top-8 z-50 w-52 rounded-tile border border-hairline bg-surface shadow-lg py-1">
                                  {canQuestions && (
                                    <button
                                      type="button"
                                      onClick={() => { setMenuFor(null); setQuestionsFor(a); }}
                                      className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-body hover:bg-row-hover hover:text-heading transition-colors text-left"
                                    >
                                      <ListChecks size={14} className="text-info-600" /> Manage Questions
                                    </button>
                                  )}
                                  {canParticipants && (
                                    <button
                                      type="button"
                                      onClick={() => { setMenuFor(null); setParticipantsFor(a); }}
                                      className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-body hover:bg-row-hover hover:text-heading transition-colors text-left"
                                    >
                                      <Users size={14} className="text-success-700" /> Participants
                                    </button>
                                  )}
                                  {canEdit && (
                                    <button
                                      type="button"
                                      onClick={() => { setMenuFor(null); setEditing(a); setShowModal(true); }}
                                      className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-body hover:bg-row-hover hover:text-heading transition-colors text-left"
                                    >
                                      <Pencil size={14} className="text-subtle" /> Edit
                                    </button>
                                  )}
                                  {canDelete && (
                                    <>
                                      <div className="my-1 h-px bg-hairline" />
                                      <button
                                        type="button"
                                        onClick={() => { setMenuFor(null); setConfirmDelete(a); }}
                                        className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-danger-700 hover:bg-danger-50 transition-colors text-left"
                                      >
                                        <Trash2 size={14} /> Delete
                                      </button>
                                    </>
                                  )}
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {!isLoading && filtered.length > 0 && (
                  <div className="shrink-0 grid grid-cols-[1fr_auto_1fr] items-center gap-3 border-t border-hairline px-1 py-2">
                    <p className="text-2xs text-subtle tabular-nums truncate">
                      Showing <span className="font-semibold text-body">{rangeStart}-{rangeEnd}</span> of {filtered.length} assessments
                    </p>
                    <div className="flex justify-center">
                      {totalPages > 1 && (
                        <TableFooter
                          from={rangeStart} to={rangeEnd} total={filtered.length}
                          pageSize={ITEMS_PER_PAGE} onPageSize={() => {}}
                          currentPage={safePage} totalPages={totalPages} onPage={setPage}
                        />
                      )}
                    </div>
                    <div />
                  </div>
                )}
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {wizard}

      {/* Delete confirmation — names the assessment and warns about the
          participants, because deleting also closes every invitation link. */}
      {confirmDelete && (
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center p-4"
          style={{ background: 'rgba(30,41,59,0.55)', backdropFilter: 'blur(4px)' }}
          onMouseDown={(e) => { if (e.target === e.currentTarget) setConfirmDelete(null); }}
        >
          <div className="w-full max-w-sm rounded-2xl bg-surface p-5 shadow-2xl">
            <div className="flex items-start gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-danger-50 text-danger-700">
                <Trash2 size={16} />
              </span>
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-heading">Delete this assessment?</h3>
                <p className="mt-1 text-xs text-subtle leading-relaxed">
                  <span className="font-semibold text-body">{confirmDelete.assessmentName}</span> will be
                  removed from the list and every participant&apos;s invitation link will stop working.
                  Submitted results are kept.
                </p>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDelete(null)}
                className="h-8 px-3 rounded-control border border-hairline-strong bg-surface text-xs font-medium text-body hover:bg-row-hover transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate(confirmDelete._id)}
                className="h-8 px-3 rounded-control bg-danger-500 text-white text-xs font-semibold hover:bg-danger-700 disabled:opacity-60 transition-colors"
              >
                {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
