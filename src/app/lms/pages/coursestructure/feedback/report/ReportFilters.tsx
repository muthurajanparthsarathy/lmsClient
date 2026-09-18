// ReportFilters — shared filter bar + data hook for BOTH feedback report
// pages (report/generate and report analysis).
//
// The bar renders in a FIXED order — Degree, Batch, Department, Section,
// Semester, then Trainer — do not reorder:
//   • Degree     — read-only, from the course doc (degree courses only)
//   • Batch      — which batch's forms + audience (always shown)
//   • Department — read-only, from the course doc (degree courses only)
//   • Section    — degree-program courses only; filters RESPONSES by the
//                  responding student's `section` field on their user doc
//   • Semester   — degree-program courses only; same mechanism via `semester`
//   • Trainer    — All (default, merges every listed form) or one form
//
// The feedback documents don't store semester/section — the responding
// STUDENT's user doc does, so those two filters work by mapping each
// response's studentId onto the batch roster. Anonymous responses carry no
// identity: when a semester/section filter is active they are excluded and
// counted, and the bar shows a small note.

'use client';

import { useCourseRosterQuery } from '@/queries/courseRoster';
import React, { useEffect, useMemo, useState } from 'react';
import { Feedback } from '../types/feedback';
import { useGetAllFeedback } from '../hooks/useFeedback';

// ── Types ────────────────────────────────────────────────────────────────────
type BatchInfo = {
  batchId: string;
  batchName: string;
  users: any[]; // populated batch user entries
};

type CourseMeta = {
  studentType: string;
  degree: string;
  department: string;
  sections: string[];
  courseSemester: string;
  batches: BatchInfo[];
};

type StudentInfo = {
  id: string;
  name: string;
  section: string;
  semester: string;
  batchName: string;
};

export type TrainerOption = {
  feedbackId: string;
  trainerName: string;
  title: string;
  label: string;
};

export type ReportFiltersState = ReturnType<typeof useReportFilters>;

const roleNameOf = (u: any) =>
  String(
    typeof u?.role === 'string' ? u.role : u?.role?.renameRole || u?.role?.name || ''
  ).toLowerCase();

// ── Hook ─────────────────────────────────────────────────────────────────────
export function useReportFilters(
  courseId: string,
  feedbackId: string,
  feedback: Feedback | undefined
) {
  const { data: allFeedbacks } = useGetAllFeedback(courseId);

  // ── Course doc: batches (populated users), type, sections, semester ──
  // Derived from the shared roster entry (queries/courseRoster.ts) — this used
  // to be its own raw fetch of the FULL course payload.
  const { data: roster } = useCourseRosterQuery(courseId || '');
  const courseMeta: CourseMeta | null = useMemo(() => {
    const course: any = roster;
    if (!course) return null;
    return {
      studentType: String(course?.studentType || ''),
      degree: String(course?.degree || '').trim(),
      department: String(course?.department || '').trim(),
      sections: ((course?.sections || []) as any[])
        .map((s) => String(s || '').trim())
        .filter(Boolean),
      courseSemester: String(course?.semester || '').trim(),
      batches: ((course?.batchAndParticipants || []) as any[])
        .filter((b) => String(b?.batchName || '').trim())
        .map((b) => ({
          batchId: String(b?._id || ''),
          batchName: String(b.batchName).trim(),
          users: b?.users || [],
        })),
    };
  }, [roster]);

  const isDegree = courseMeta?.studentType === 'degree-program';

  // ── Filter state ──
  const [batchSel, setBatchSel] = useState<string>('');
  const [semSel, setSemSel] = useState<string>('all');
  const [secSel, setSecSel] = useState<string>('all');
  const [trainerSel, setTrainerSel] = useState<string>('all');

  // Default batch = the batch of the form the page was opened with.
  useEffect(() => {
    if (!courseMeta || batchSel) return;
    const names = courseMeta.batches.map((b) => b.batchName);
    if (names.length === 0) return;
    const fbBatch = String((feedback as any)?.batchName || '').trim();
    setBatchSel(
      fbBatch && names.some((n) => n.toLowerCase() === fbBatch.toLowerCase())
        ? names.find((n) => n.toLowerCase() === fbBatch.toLowerCase())!
        : names[0]
    );
  }, [courseMeta, feedback, batchSel]);

  const changeBatch = (name: string) => {
    setBatchSel(name);
    // Trainers belong to a batch — a new batch means a new trainer list.
    setTrainerSel('all');
    setSemSel('all');
    setSecSel('all');
  };

  const selectedBatch = useMemo(
    () =>
      courseMeta?.batches.find(
        (b) => b.batchName.toLowerCase() === batchSel.toLowerCase()
      ) || null,
    [courseMeta, batchSel]
  );

  // ── Roster maps ──
  // studentId → info for the SELECTED batch (drives section/semester filters
  // and the audience). Track names come from every batch so the workbook's
  // Track column stays right even for stray respondents.
  const { studentInfoById, batchNameByStudent, batchMemberIds } = useMemo(() => {
    const info = new Map<string, StudentInfo>();
    const trackMap = new Map<string, string>();
    const memberIds = new Set<string>();
    (courseMeta?.batches || []).forEach((b) => {
      b.users.forEach((entry: any) => {
        const u = entry?.user;
        const id = String(u?._id || entry?.user || '');
        if (!id) return;
        trackMap.set(id, b.batchName);
        if (selectedBatch && b.batchName === selectedBatch.batchName) {
          memberIds.add(id);
          if (u?._id) {
            info.set(id, {
              id,
              name:
                `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email || '—',
              section: String(u.section || '').trim(),
              semester: String(u.semester || '').trim(),
              batchName: b.batchName,
            });
          }
        }
      });
    });
    return { studentInfoById: info, batchNameByStudent: trackMap, batchMemberIds: memberIds };
  }, [courseMeta, selectedBatch]);

  // ── Filter options ──
  const batchOptions = (courseMeta?.batches || []).map((b) => b.batchName);

  const sectionOptions = useMemo(() => {
    if (!isDegree) return [];
    const set = new Set((courseMeta?.sections || []).map((s) => s));
    // Sections seen on students but missing from the course config still count.
    studentInfoById.forEach((s) => {
      if (s.section && roleFilterIsStudent(s, studentInfoById)) set.add(s.section);
    });
    return Array.from(set);
  }, [isDegree, courseMeta, studentInfoById]);

  const semesterOptions = useMemo(() => {
    if (!isDegree) return [];
    const set = new Set<string>();
    if (courseMeta?.courseSemester) set.add(courseMeta.courseSemester);
    studentInfoById.forEach((s) => {
      if (s.semester) set.add(s.semester);
    });
    return Array.from(set);
  }, [isDegree, courseMeta, studentInfoById]);

  // Forms of the selected batch: stored batch name/id match, or (legacy forms
  // without a batch) the trainer being a member of the batch.
  const trainerOptions: TrainerOption[] = useMemo(() => {
    if (!Array.isArray(allFeedbacks)) return [];
    return (allFeedbacks as any[])
      .filter((fb) => {
        const fbBatch = String(fb.batchName || '').trim().toLowerCase();
        if (fbBatch) return fbBatch === batchSel.toLowerCase();
        const fbBatchId = fb.batchId ? String(fb.batchId) : '';
        if (fbBatchId && selectedBatch?.batchId) return fbBatchId === selectedBatch.batchId;
        const tid = fb.trainerId ? String(fb.trainerId) : '';
        if (!tid) return false;
        return batchMemberIds.size === 0 ? true : batchMemberIds.has(tid);
      })
      .map((fb) => ({
        feedbackId: String(fb._id),
        trainerName: fb.trainerName || 'No trainer',
        title: fb.feedbackTitle || 'Untitled',
        label: `${fb.trainerName || 'No trainer'} — ${fb.feedbackTitle || 'Untitled'}`,
      }));
  }, [allFeedbacks, batchSel, selectedBatch, batchMemberIds]);

  // ── The filtered feedback document every report computation runs on ──
  const { activeFeedback, anonymousExcluded } = useMemo(() => {
    if (!feedback) return { activeFeedback: feedback, anonymousExcluded: 0 };

    // 1) Which forms feed the report.
    let base: Feedback;
    if (trainerSel !== 'all') {
      const doc = ((allFeedbacks as any[]) || []).find(
        (fb) => String(fb._id) === trainerSel
      );
      base = ((doc as any) || feedback) as Feedback;
    } else {
      const ids = new Set(trainerOptions.map((o) => o.feedbackId));
      const forms = ((allFeedbacks as any[]) || []).filter((fb) =>
        ids.has(String(fb._id))
      );
      if (forms.length <= 1) {
        base = (forms[0] as any) || feedback;
      } else {
        // Merge: union of questions (by type + text) + every form's
        // responses. Report builders match answers by questionText, so
        // shared questions aggregate across trainers.
        const seen = new Set<string>();
        const questions: any[] = [];
        forms.forEach((fb: any) =>
          (fb.questions || []).forEach((q: any) => {
            const key = `${q.questionType}::${q.questionText}`;
            if (!seen.has(key)) {
              seen.add(key);
              questions.push(q);
            }
          })
        );
        base = {
          ...feedback,
          feedbackTitle: 'All Trainers',
          trainerName: '',
          questions,
          studentResponses: forms.flatMap((fb: any) => fb.studentResponses || []),
        } as Feedback;
      }
    }

    // 2) Section / semester response filtering (degree courses).
    const secActive = isDegree && secSel !== 'all';
    const semActive = isDegree && semSel !== 'all';
    if (!secActive && !semActive) return { activeFeedback: base, anonymousExcluded: 0 };

    let anon = 0;
    const filtered = ((base.studentResponses || []) as any[]).filter((r) => {
      const info = studentInfoById.get(String(r.studentId));
      if (r.isAnonymous || !info) {
        anon += 1; // no identity → can't attribute to a section/semester
        return false;
      }
      if (secActive && info.section.toLowerCase() !== secSel.toLowerCase()) return false;
      if (semActive && info.semester.toLowerCase() !== semSel.toLowerCase()) return false;
      return true;
    });
    return {
      activeFeedback: { ...base, studentResponses: filtered } as Feedback,
      anonymousExcluded: anon,
    };
  }, [
    feedback,
    allFeedbacks,
    trainerOptions,
    trainerSel,
    isDegree,
    secSel,
    semSel,
    studentInfoById,
  ]);

  // ── Audience: students of the selected batch passing the filters ──
  const audience = useMemo(() => {
    const out: { id: string; name: string }[] = [];
    if (!selectedBatch) return out;
    selectedBatch.users.forEach((entry: any) => {
      const u = entry?.user;
      if (!u?._id) return;
      if (roleNameOf(u) !== 'student') return;
      const section = String(u.section || '').trim();
      const semester = String(u.semester || '').trim();
      if (isDegree && secSel !== 'all' && section.toLowerCase() !== secSel.toLowerCase())
        return;
      if (isDegree && semSel !== 'all' && semester.toLowerCase() !== semSel.toLowerCase())
        return;
      out.push({
        id: String(u._id),
        name: `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email || '—',
      });
    });
    return out;
  }, [selectedBatch, isDegree, secSel, semSel]);

  const respondedIds = useMemo(
    () =>
      new Set(
        ((activeFeedback?.studentResponses || []) as any[]).map((r) =>
          String(r.studentId)
        )
      ),
    [activeFeedback]
  );

  const notSubmitted = useMemo(
    () => audience.filter((a) => !respondedIds.has(a.id)),
    [audience, respondedIds]
  );

  return {
    loading: !courseMeta,
    isDegree,
    // Fixed course context shown read-only in the bar
    degree: courseMeta?.degree || '',
    department: courseMeta?.department || '',
    // state + setters
    batchSel,
    changeBatch,
    semSel,
    setSemSel,
    secSel,
    setSecSel,
    trainerSel,
    setTrainerSel,
    // options
    batchOptions,
    semesterOptions,
    sectionOptions,
    trainerOptions,
    // derived data for the report
    activeFeedback,
    audience,
    notSubmitted,
    batchNameByStudent,
    anonymousExcluded,
  };
}

// Placeholder used above so sectionOptions can share the roster map without
// re-walking roles; students were already role-filtered into the audience,
// but the section list should include every batch member's section.
function roleFilterIsStudent(_s: StudentInfo, _map: Map<string, StudentInfo>) {
  return true;
}

// ── Filter bar UI ────────────────────────────────────────────────────────────
const selectCls =
  'h-8 px-2 text-[12px] border border-gray-200 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-colors';
const filterLabelCls =
  'text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider';

export const ReportFilterBar: React.FC<{ rf: ReportFiltersState }> = ({ rf }) => {
  const {
    isDegree,
    degree,
    department,
    batchSel,
    changeBatch,
    semSel,
    setSemSel,
    secSel,
    setSecSel,
    trainerSel,
    setTrainerSel,
    batchOptions,
    semesterOptions,
    sectionOptions,
    trainerOptions,
    anonymousExcluded,
  } = rf;

  // Degree and Department come from the course — fixed context, not filters.
  const readOnlyField = (label: string, value: string) => (
    <div className="flex flex-col gap-0.5">
      <label className={filterLabelCls}>{label}</label>
      <div
        className={`${selectCls} inline-flex items-center bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300 cursor-default max-w-[220px] truncate`}
        title={value || `No ${label.toLowerCase()} on this course`}
      >
        {value || '—'}
      </div>
    </div>
  );

  return (
    <div className="px-4 py-2 border-b border-gray-100 dark:border-gray-800 flex items-end gap-4 flex-wrap flex-shrink-0">
      {/* Fixed order — Degree, Batch, Department, Section, Semester. */}

      {/* 1. Degree — degree courses only, read-only */}
      {isDegree && readOnlyField('Degree', degree)}

      {/* 2. Batch */}
      <div className="flex flex-col gap-0.5">
        <label className={filterLabelCls}>Batch</label>
        <select
          value={batchSel}
          onChange={(e) => changeBatch(e.target.value)}
          className={selectCls}
        >
          {batchOptions.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </div>

      {/* 3. Department — degree courses only, read-only */}
      {isDegree && readOnlyField('Department', department)}

      {/* 4. Section — degree courses only */}
      {isDegree && (
        <div className="flex flex-col gap-0.5">
          <label className={filterLabelCls}>Section</label>
          <select
            value={secSel}
            onChange={(e) => setSecSel(e.target.value)}
            className={selectCls}
          >
            <option value="all">All sections</option>
            {sectionOptions.map((s) => (
              <option key={s} value={s}>
                Section {s}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* 5. Semester — degree courses only */}
      {isDegree && (
        <div className="flex flex-col gap-0.5">
          <label className={filterLabelCls}>Semester</label>
          <select
            value={semSel}
            onChange={(e) => setSemSel(e.target.value)}
            className={selectCls}
          >
            <option value="all">All semesters</option>
            {semesterOptions.map((s) => (
              <option key={s} value={s}>
                Sem {s}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Trainer */}
      <div className="flex flex-col gap-0.5">
        <label className={filterLabelCls}>Trainer</label>
        <select
          value={trainerSel}
          onChange={(e) => setTrainerSel(e.target.value)}
          className={`${selectCls} max-w-[260px]`}
        >
          <option value="all">All trainers</option>
          {trainerOptions.map((opt) => (
            <option key={opt.feedbackId} value={opt.feedbackId}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Anonymous exclusion note */}
      {anonymousExcluded > 0 && (
        <span className="pb-1.5 text-[10px] text-amber-600 dark:text-amber-400">
          {anonymousExcluded} anonymous / unmatched response
          {anonymousExcluded === 1 ? '' : 's'} not included in this filter
        </span>
      )}
    </div>
  );
};
