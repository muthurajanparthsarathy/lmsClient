'use client';

/**
 * External Assessment → Participants.
 *
 * Two ways in, as specified: a single-participant form, and an Excel/CSV bulk
 * upload. The upload is TWO-PHASE — it always runs the server's `?mode=validate`
 * dry run first and shows the admin exactly which rows will land and which are
 * rejected (invalid email, missing name, duplicate in file, already invited)
 * before anything is written.
 *
 * These people are NOT LMS users. Adding one here writes to
 * `externalparticipants` only; nothing reaches User Management.
 */

import React, { useMemo, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Plus, Upload, Trash2, Mail, Search, X, Users, Link2,
  AlertTriangle, CheckCircle2, Clock, Loader2, FileSpreadsheet, Send,
} from 'lucide-react';
import toast from 'react-hot-toast';
import TableFooter from '@/app/lms/shared/listing/TableFooter';
import { pageEnter } from '@/app/lms/shared/ui';
import { usePermissions } from '@/hooks/usePermissions';
import { PERMISSION_IDS } from '@/app/lms/pages/usermanagement/components/permissions/index';
import {
  externalAssessmentApi,
  externalAssessmentKeys,
  type ExternalAssessment,
  type ExternalParticipant,
  type BulkUploadResult,
} from '@/apiServices/externalAssessment';

const ORANGE = '#E8640C';
const ITEMS_PER_PAGE = 10;

const rowBase: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0,1.4fr) minmax(0,1.6fr) 110px 100px 110px 110px 70px',
  gap: 8,
  alignItems: 'center',
  padding: '0 12px',
  transition: 'background-color 0.15s',
};

const ATTEMPT_META: Record<string, { label: string; color: string; bg: string }> = {
  not_started: { label: 'Not Started', color: '#6b7280', bg: 'rgba(107,114,128,0.10)' },
  in_progress: { label: 'In Progress', color: '#b45309', bg: 'rgba(245,158,11,0.12)' },
  submitted: { label: 'Submitted', color: '#059669', bg: 'rgba(5,150,105,0.10)' },
  expired: { label: 'Expired', color: '#dc2626', bg: 'rgba(220,38,38,0.10)' },
};

const INVITE_META: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  sent: { label: 'Sent', color: '#059669', icon: CheckCircle2 },
  pending: { label: 'Pending', color: '#b45309', icon: Clock },
  failed: { label: 'Failed', color: '#dc2626', icon: AlertTriangle },
};

const formatDate = (iso?: string | null) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};

export default function ExternalParticipantsPanel({
  assessment,
  onBack,
}: {
  assessment: ExternalAssessment;
  onBack: () => void;
}) {
  const queryClient = useQueryClient();
  const { can } = usePermissions();
  const PAGE = PERMISSION_IDS.ADMIN_EXTERNAL_ASSESSMENT;
  const canAdd = can(PAGE, 'Add Participant');
  const canBulk = can(PAGE, 'Bulk Upload');

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<ExternalParticipant | null>(null);

  const key = externalAssessmentKeys.participants(assessment._id);
  const { data, isLoading, error } = useQuery({
    queryKey: key,
    queryFn: () => externalAssessmentApi.listParticipants(assessment._id),
    staleTime: 30 * 1000,
    refetchOnWindowFocus: false,
  });

  const participants = data?.participants ?? [];
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: key });
    queryClient.invalidateQueries({ queryKey: externalAssessmentKeys.lists() });
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return participants;
    return participants.filter(
      (p) =>
        p.firstName?.toLowerCase().includes(q) ||
        p.lastName?.toLowerCase().includes(q) ||
        p.email?.toLowerCase().includes(q),
    );
  }, [participants, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const rangeStart = filtered.length === 0 ? 0 : (safePage - 1) * ITEMS_PER_PAGE + 1;
  const rangeEnd = Math.min(safePage * ITEMS_PER_PAGE, filtered.length);
  const pageRows = filtered.slice((safePage - 1) * ITEMS_PER_PAGE, safePage * ITEMS_PER_PAGE);

  const pendingCount = participants.filter((p) => p.invitationStatus !== 'sent').length;
  const isDraft = assessment.status !== 'published';

  const deleteMutation = useMutation({
    mutationFn: (id: string) => externalAssessmentApi.deleteParticipant(assessment._id, id),
    onSuccess: () => {
      toast.success('Participant removed', { position: 'top-right', duration: 1800 });
      invalidate();
      setConfirmDelete(null);
    },
    onError: (e: any) => toast.error(e?.message || 'Could not remove the participant', { position: 'top-right', duration: 4000 }),
  });

  const resendMutation = useMutation({
    mutationFn: (id: string) => externalAssessmentApi.resendInvitation(assessment._id, id),
    onSuccess: (r: any) => {
      toast.success(r?.message || 'Invitation sent', { position: 'top-right', duration: 2200 });
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message || 'Could not send the invitation', { position: 'top-right', duration: 4000 }),
  });

  const sendAllMutation = useMutation({
    mutationFn: () => externalAssessmentApi.sendPendingInvitations(assessment._id),
    onSuccess: (r: any) => {
      toast.success(r?.message || 'Invitations sent', { position: 'top-right', duration: 2600 });
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message || 'Could not send invitations', { position: 'top-right', duration: 4000 }),
  });

  const copyLink = async (p: ExternalParticipant) => {
    try {
      const { link } = await externalAssessmentApi.getParticipantLink(assessment._id, p._id);
      await navigator.clipboard.writeText(link);
      toast.success('Assessment link copied', { position: 'top-right', duration: 1800 });
    } catch (e: any) {
      toast.error(e?.message || 'No active link for this participant', { position: 'top-right', duration: 3500 });
    }
  };

  return (
    <div className="min-h-full h-full flex flex-col">
      <motion.div
        variants={pageEnter} initial="hidden" animate="visible"
        className="flex flex-1 min-h-0 flex-col px-4 sm:px-6 lg:px-8 pt-3 pb-3 text-body"
      >
        <header className="shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button" onClick={onBack} title="Back to assessments"
              className="inline-flex size-8 items-center justify-center rounded-control text-subtle hover:bg-row-hover hover:text-heading transition-colors shrink-0"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="min-w-0">
              <h1 className="text-base font-semibold text-heading leading-tight truncate">
                {assessment.assessmentName}
              </h1>
              <p className="text-[11px] text-subtle">
                Participants · <span className="tabular-nums">{participants.length}</span> invited
              </p>
            </div>
          </div>

          {/* Draft warning — invitations cannot go out until published, and an
              admin adding twenty people to a draft should know that up front. */}
          {isDraft && (
            <div className="mt-2.5 flex items-start gap-2 rounded-tile border border-warn-500/20 bg-warn-50 px-3 py-2">
              <AlertTriangle size={14} className="mt-0.5 shrink-0 text-warn-700" />
              <p className="text-[11px] text-warn-700 leading-relaxed">
                This assessment is a <strong>draft</strong>. Participants can be added now, but no
                invitation emails will be sent until it is published.
              </p>
            </div>
          )}

          <div className="mt-2.5 flex items-center gap-2 flex-wrap min-w-0">
            <div className="relative flex-1 min-w-[220px] max-w-md">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-faint pointer-events-none" />
              <input
                placeholder="Search by name or email…"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="h-8 w-full pl-8 pr-8 rounded-control border border-hairline-strong bg-surface text-xs text-body placeholder:text-faint focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/15 transition-colors"
              />
              {search && (
                <button
                  type="button" aria-label="Clear search" onClick={() => setSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex size-5 items-center justify-center rounded-chip text-faint hover:bg-ink-100 hover:text-heading transition-colors"
                >
                  <X size={12} />
                </button>
              )}
            </div>

            <div className="ml-auto flex items-center gap-1.5 flex-wrap">
              {!isDraft && pendingCount > 0 && (
                <button
                  type="button"
                  onClick={() => sendAllMutation.mutate()}
                  disabled={sendAllMutation.isPending}
                  className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-control border border-success-500/30 bg-success-50 text-success-700 text-xs font-semibold hover:bg-success-50/70 disabled:opacity-60 transition-colors"
                >
                  {sendAllMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                  Send {pendingCount} pending
                </button>
              )}
              {canBulk && (
                <button
                  type="button"
                  onClick={() => setShowUpload(true)}
                  className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-control border border-hairline-strong bg-surface text-xs font-medium text-body hover:bg-row-hover hover:text-heading transition-colors"
                >
                  <Upload size={13} /> <span className="hidden sm:inline">Bulk Upload</span>
                </button>
              )}
            </div>

            <span className="hidden sm:inline-block h-5 w-px bg-hairline-strong mx-0.5" aria-hidden />

            {canAdd && (
              <button
                type="button"
                onClick={() => setShowForm(true)}
                className="inline-flex items-center gap-1.5 h-8 px-3.5 rounded-control bg-brand-strong text-white shadow-sm hover:bg-brand-800 transition-colors shrink-0"
              >
                <Plus size={14} strokeWidth={2.4} />
                <span className="text-xs font-semibold">Add Participant</span>
              </button>
            )}
          </div>
        </header>

        {/* ── Table ── */}
        <div className="mt-3 flex-1 min-h-0 flex flex-col overflow-hidden">
          {error ? (
            <div className="m-4 p-4 rounded-tile border border-danger-500/20 bg-danger-50 text-center">
              <AlertTriangle className="mx-auto h-5 w-5 text-danger-700" />
              <p className="mt-2 text-sm font-medium text-danger-700">
                {(error as any)?.message || 'Could not load participants'}
              </p>
            </div>
          ) : (
            <>
              <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
                <div style={rowBase} className="h-8 border-b border-hairline bg-canvas sticky top-0 z-10">
                  {['Name', 'Email', 'Phone', 'Added', 'Invitation', 'Attempt', 'Result'].map((h) => (
                    <div key={h} className="text-[10px] font-semibold uppercase tracking-wider text-subtle">{h}</div>
                  ))}
                </div>

                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} style={{ ...rowBase, height: 44 }} className="border-b border-hairline">
                      {Array.from({ length: 7 }).map((__, j) => (
                        <div key={j} className="h-3 rounded bg-ink-100 animate-pulse" style={{ width: `${50 + ((i + j) % 3) * 14}%` }} />
                      ))}
                    </div>
                  ))
                ) : filtered.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-wash text-brand-strong border border-dashed border-brand-500/40">
                      <Users size={22} strokeWidth={1.5} />
                    </span>
                    <p className="mt-4 text-sm font-bold text-heading">
                      {search ? 'No matching participants' : 'No participants yet'}
                    </p>
                    <p className="mt-1 text-[11px] text-subtle max-w-[280px] leading-relaxed">
                      {search
                        ? 'Try a different name or email.'
                        : 'Add them one at a time, or upload a spreadsheet. They do not need an LMS account.'}
                    </p>
                  </div>
                ) : (
                  pageRows.map((p, idx) => {
                    const att = ATTEMPT_META[p.attemptStatus] || ATTEMPT_META.not_started;
                    const inv = INVITE_META[p.invitationStatus] || INVITE_META.pending;
                    const InvIcon = inv.icon;
                    const isLast = idx === pageRows.length - 1;
                    return (
                      <div
                        key={p._id}
                        style={{ ...rowBase, height: 44 }}
                        className={`group ${isLast ? '' : 'border-b border-hairline'} bg-surface hover:bg-row-hover transition-colors`}
                      >
                        <div className="min-w-0">
                          <span className="text-xs font-semibold text-heading truncate block">
                            {`${p.firstName} ${p.lastName || ''}`.trim()}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <span className="text-[11px] text-subtle truncate block" title={p.email}>{p.email}</span>
                        </div>
                        <div className="text-[11px] text-body truncate">{p.phone || '—'}</div>
                        <div className="text-[11px] text-body">{formatDate(p.createdAt)}</div>
                        <div>
                          <span
                            className="inline-flex items-center gap-1 h-5 rounded-full px-2 text-[10px] font-semibold"
                            style={{ color: inv.color, background: `${inv.color}18` }}
                            title={p.invitationError || undefined}
                          >
                            <InvIcon size={10} /> {inv.label}
                          </span>
                        </div>
                        <div>
                          <span
                            className="inline-flex items-center h-5 rounded-full px-2 text-[10px] font-semibold"
                            style={{ background: att.bg, color: att.color }}
                          >
                            {att.label}
                          </span>
                        </div>
                        <div className="flex items-center justify-end gap-0.5">
                          {p.attemptStatus === 'submitted' && p.score !== null && p.score !== undefined ? (
                            <span className="text-[11px] font-semibold tabular-nums text-heading mr-1">
                              {p.score}/{p.maxScore ?? 0}
                            </span>
                          ) : null}
                          <div className="flex items-center transition-opacity">
                            {!isDraft && (
                              <>
                                <button
                                  type="button" title="Copy assessment link" onClick={() => copyLink(p)}
                                  className="inline-flex size-6 items-center justify-center rounded-control text-subtle hover:bg-ink-100 hover:text-heading transition-colors"
                                >
                                  <Link2 size={12} />
                                </button>
                                <button
                                  type="button" title="Resend invitation"
                                  onClick={() => resendMutation.mutate(p._id)}
                                  disabled={resendMutation.isPending}
                                  className="inline-flex size-6 items-center justify-center rounded-control text-subtle hover:bg-ink-100 hover:text-heading transition-colors"
                                >
                                  <Mail size={12} />
                                </button>
                              </>
                            )}
                            <button
                              type="button" title="Remove participant" onClick={() => setConfirmDelete(p)}
                              className="inline-flex size-6 items-center justify-center rounded-control text-subtle hover:bg-danger-50 hover:text-danger-700 transition-colors"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {!isLoading && filtered.length > 0 && (
                <div className="shrink-0 grid grid-cols-[1fr_auto_1fr] items-center gap-3 border-t border-hairline px-1 py-2">
                  <p className="text-2xs text-subtle tabular-nums truncate">
                    Showing <span className="font-semibold text-body">{rangeStart}-{rangeEnd}</span> of {filtered.length}
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
            </>
          )}
        </div>
      </motion.div>

      {showForm && (
        <AddParticipantForm
          assessmentId={assessment._id}
          onClose={() => setShowForm(false)}
          onAdded={invalidate}
        />
      )}

      {showUpload && (
        <BulkUploadDialog
          assessmentId={assessment._id}
          onClose={() => setShowUpload(false)}
          onImported={invalidate}
        />
      )}

      {confirmDelete && (
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center p-4"
          style={{ background: 'rgba(30,41,59,0.55)', backdropFilter: 'blur(4px)' }}
          onMouseDown={(e) => { if (e.target === e.currentTarget) setConfirmDelete(null); }}
        >
          <div className="w-full max-w-sm rounded-2xl bg-surface p-5 shadow-2xl">
            <h3 className="text-sm font-bold text-heading">Remove this participant?</h3>
            <p className="mt-1 text-xs text-subtle leading-relaxed">
              <span className="font-semibold text-body">{confirmDelete.email}</span> will lose access —
              their invitation link stops working immediately, and any attempt is deleted.
            </p>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button" onClick={() => setConfirmDelete(null)}
                className="h-8 px-3 rounded-control border border-hairline-strong bg-surface text-xs font-medium text-body hover:bg-row-hover transition-colors"
              >
                Cancel
              </button>
              <button
                type="button" disabled={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate(confirmDelete._id)}
                className="h-8 px-3 rounded-control bg-danger-500 text-white text-xs font-semibold hover:bg-danger-700 disabled:opacity-60 transition-colors"
              >
                {deleteMutation.isPending ? 'Removing…' : 'Remove'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Add one participant ──────────────────────────────────────────────────

function AddParticipantForm({
  assessmentId, onClose, onAdded,
}: { assessmentId: string; onClose: () => void; onAdded: () => void }) {
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', phone: '' });
  const [err, setErr] = useState<Record<string, string>>({});

  const mutation = useMutation({
    mutationFn: () => externalAssessmentApi.addParticipant(assessmentId, form),
    onSuccess: (r: any) => {
      toast.success(r?.message || 'Participant added', { position: 'top-right', duration: 2400 });
      onAdded();
      onClose();
    },
    onError: (e: any) =>
      toast.error(e?.message || 'Could not add the participant', { position: 'top-right', duration: 4000 }),
  });

  const submit = () => {
    const next: Record<string, string> = {};
    if (!form.firstName.trim()) next.firstName = 'First name is required';
    if (!form.email.trim()) next.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) next.email = 'Enter a valid email address';
    setErr(next);
    if (Object.keys(next).length) return;
    mutation.mutate();
  };

  const field =
    'w-full h-9 px-3 rounded-control border border-hairline-strong bg-surface text-xs text-body placeholder:text-faint focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/15 transition-colors';
  const label = 'block text-[11px] font-semibold text-heading mb-1.5';

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center p-4"
      style={{ background: 'rgba(30,41,59,0.55)', backdropFilter: 'blur(6px)' }}
      onMouseDown={(e) => { if (e.target === e.currentTarget && !mutation.isPending) onClose(); }}
    >
      <div className="w-full max-w-md rounded-2xl bg-surface overflow-hidden shadow-2xl">
        <header className="flex items-center justify-between px-5 py-3 border-b border-hairline">
          <h3 className="text-sm font-bold text-heading">Add Participant</h3>
          <button
            type="button" onClick={() => !mutation.isPending && onClose()} aria-label="Close"
            className="inline-flex size-8 items-center justify-center rounded-control text-subtle hover:bg-row-hover hover:text-heading transition-colors"
          >
            <X size={16} />
          </button>
        </header>

        <div className="px-5 py-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label}>First Name <span className="text-danger-500">*</span></label>
              <input
                className={field} value={form.firstName} autoFocus
                onChange={(e) => { setForm({ ...form, firstName: e.target.value }); setErr({ ...err, firstName: '' }); }}
              />
              {err.firstName && <p className="mt-1 text-[10px] font-medium text-danger-700">{err.firstName}</p>}
            </div>
            <div>
              <label className={label}>Last Name</label>
              <input className={field} value={form.lastName}
                onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
            </div>
          </div>
          <div>
            <label className={label}>Email <span className="text-danger-500">*</span></label>
            <input
              type="email" className={field} value={form.email}
              onChange={(e) => { setForm({ ...form, email: e.target.value }); setErr({ ...err, email: '' }); }}
              placeholder="participant@example.com"
            />
            {err.email && <p className="mt-1 text-[10px] font-medium text-danger-700">{err.email}</p>}
            <p className="mt-1 text-[10px] text-subtle">The invitation link is sent here.</p>
          </div>
          <div>
            <label className={label}>Phone</label>
            <input className={field} value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
        </div>

        <footer className="flex items-center justify-end gap-2 px-5 py-3 border-t border-hairline">
          <button
            type="button" onClick={() => !mutation.isPending && onClose()}
            className="h-8 px-3 rounded-control border border-hairline-strong bg-surface text-xs font-medium text-body hover:bg-row-hover transition-colors"
          >
            Cancel
          </button>
          <button
            type="button" onClick={submit} disabled={mutation.isPending}
            className="inline-flex items-center gap-1.5 h-8 px-4 rounded-control text-white text-xs font-semibold shadow-sm disabled:opacity-60 transition-colors"
            style={{ background: ORANGE }}
          >
            {mutation.isPending && <Loader2 size={14} className="animate-spin" />}
            {mutation.isPending ? 'Adding…' : 'Add & Invite'}
          </button>
        </footer>
      </div>
    </div>
  );
}

// ─── Bulk upload ──────────────────────────────────────────────────────────
// Always validates first. The admin sees the row-by-row verdict and presses
// Import to commit — nothing is written until then.

function BulkUploadDialog({
  assessmentId, onClose, onImported,
}: { assessmentId: string; onClose: () => void; onImported: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [report, setReport] = useState<BulkUploadResult | null>(null);
  const [dragging, setDragging] = useState(false);

  const validateMutation = useMutation({
    mutationFn: (f: File) => externalAssessmentApi.bulkUpload(assessmentId, f, true),
    onSuccess: (r: any) => setReport(r?.data ?? null),
    onError: (e: any) => toast.error(e?.message || 'Could not read the file', { position: 'top-right', duration: 4000 }),
  });

  const importMutation = useMutation({
    mutationFn: (f: File) => externalAssessmentApi.bulkUpload(assessmentId, f, false),
    onSuccess: (r: any) => {
      toast.success(r?.message || 'Participants imported', { position: 'top-right', duration: 3200 });
      onImported();
      onClose();
    },
    onError: (e: any) => toast.error(e?.message || 'Import failed', { position: 'top-right', duration: 4000 }),
  });

  const pick = (f: File | null) => {
    setFile(f);
    setReport(null);
    if (f) validateMutation.mutate(f);
  };

  const busy = validateMutation.isPending || importMutation.isPending;

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center p-4"
      style={{ background: 'rgba(30,41,59,0.55)', backdropFilter: 'blur(6px)' }}
      onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}
    >
      <div
        className="w-full max-w-lg rounded-2xl bg-surface overflow-hidden shadow-2xl flex flex-col"
        style={{ maxHeight: '88vh' }}
      >
        <header className="flex items-center justify-between px-5 py-3 border-b border-hairline shrink-0">
          <div>
            <h3 className="text-sm font-bold text-heading">Bulk Upload Participants</h3>
            <p className="text-[10px] text-subtle mt-0.5">.xlsx, .xls or .csv · up to 500 rows</p>
          </div>
          <button
            type="button" onClick={() => !busy && onClose()} aria-label="Close"
            className="inline-flex size-8 items-center justify-center rounded-control text-subtle hover:bg-row-hover hover:text-heading transition-colors"
          >
            <X size={16} />
          </button>
        </header>

        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-3">
          {/* Expected columns — stated up front, since a wrong header is the
              most common reason an upload comes back all-invalid. */}
          <div className="rounded-tile border border-hairline bg-canvas p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-subtle mb-1.5">Expected columns</p>
            <code className="text-[11px] text-body font-mono">firstName · lastName · email · phone</code>
            <p className="mt-1.5 text-[10px] text-subtle leading-relaxed">
              Header matching ignores case, spaces and underscores — <code className="font-mono">First Name</code>,{' '}
              <code className="font-mono">firstname</code> and <code className="font-mono">first_name</code> all work.
              Only <strong>firstName</strong> and <strong>email</strong> are required.
            </p>
          </div>

          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault(); setDragging(false);
              const f = e.dataTransfer.files?.[0];
              if (f) pick(f);
            }}
            onClick={() => !busy && inputRef.current?.click()}
            className="rounded-tile border-2 border-dashed p-6 text-center cursor-pointer transition-colors"
            style={{
              borderColor: dragging ? ORANGE : '#d1d5db',
              background: dragging ? 'rgba(232,100,12,0.04)' : 'transparent',
            }}
          >
            <input
              ref={inputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
              onChange={(e) => pick(e.target.files?.[0] ?? null)}
            />
            {file ? (
              <div className="flex items-center justify-center gap-2">
                <FileSpreadsheet size={18} className="text-success-700" />
                <span className="text-xs font-semibold text-heading truncate max-w-[240px]">{file.name}</span>
              </div>
            ) : (
              <>
                <Upload size={22} className="mx-auto text-faint" />
                <p className="mt-2 text-xs font-semibold text-heading">Drop a file here, or click to browse</p>
                <p className="mt-0.5 text-[10px] text-subtle">Checked before anything is imported</p>
              </>
            )}
          </div>

          {validateMutation.isPending && (
            <div className="flex items-center justify-center gap-2 py-3 text-xs text-subtle">
              <Loader2 size={14} className="animate-spin" /> Checking rows…
            </div>
          )}

          {report && (
            <div className="space-y-2">
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: 'Rows', value: report.summary.total, color: '#6b7280' },
                  { label: 'Ready', value: report.summary.valid, color: '#059669' },
                  { label: 'Problems', value: report.summary.invalid, color: '#dc2626' },
                ].map((s) => (
                  <div key={s.label} className="rounded-tile border border-hairline p-2.5 text-center">
                    <div className="text-lg font-extrabold tabular-nums" style={{ color: s.color }}>{s.value}</div>
                    <div className="text-[10px] font-medium text-subtle">{s.label}</div>
                  </div>
                ))}
              </div>

              {report.errors.length > 0 && (
                <div className="rounded-tile border border-danger-500/20 bg-danger-50 overflow-hidden">
                  <p className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-danger-700 border-b border-danger-500/20">
                    Rows that will be skipped
                  </p>
                  <ul className="max-h-40 overflow-y-auto divide-y divide-danger-500/10">
                    {report.errors.map((e, i) => (
                      <li key={i} className="flex items-start gap-2 px-3 py-1.5">
                        <span className="text-[10px] font-bold tabular-nums text-danger-700 shrink-0 w-10">
                          {e.row ? `#${e.row}` : '—'}
                        </span>
                        <span className="text-[11px] text-danger-700 min-w-0 flex-1 break-words">
                          {e.email && <span className="font-medium">{e.email} — </span>}{e.reason}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {report.summary.valid === 0 && (
                <p className="text-[11px] text-danger-700 font-medium text-center">
                  Nothing to import — fix the file and try again.
                </p>
              )}
            </div>
          )}
        </div>

        <footer className="flex items-center justify-end gap-2 px-5 py-3 border-t border-hairline shrink-0">
          <button
            type="button" onClick={() => !busy && onClose()}
            className="h-8 px-3 rounded-control border border-hairline-strong bg-surface text-xs font-medium text-body hover:bg-row-hover transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!file || busy || !report || report.summary.valid === 0}
            onClick={() => file && importMutation.mutate(file)}
            className="inline-flex items-center gap-1.5 h-8 px-4 rounded-control text-white text-xs font-semibold shadow-sm disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            style={{ background: ORANGE }}
          >
            {importMutation.isPending && <Loader2 size={14} className="animate-spin" />}
            {importMutation.isPending
              ? 'Importing…'
              : report
                ? `Import ${report.summary.valid} participant${report.summary.valid === 1 ? '' : 's'}`
                : 'Import'}
          </button>
        </footer>
      </div>
    </div>
  );
}
