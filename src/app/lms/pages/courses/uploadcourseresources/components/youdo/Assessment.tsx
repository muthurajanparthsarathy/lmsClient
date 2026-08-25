"use client";
import { getToken } from "@/lib/session";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSectionHref } from "@/lib/sectionRoute";
import SmartCliffRingLoader from "@/components/SmartCliffRingLoader";
import ReactDOM from "react-dom";
import {
  FileText, CheckCircle, Clock, BarChart2,
  ChevronRight, MoreVertical, Plus, Edit2, Trash2,
  List, Code, Layers, Brain, FlaskConical, PenLine, Settings,
  X, AlertTriangle, ChevronLeft, ChevronsLeft, ChevronRight as ChevronRightIcon, ChevronsRight,
  Check, Calendar, Search, RefreshCw, Activity, Users, LayoutDashboard,
  GraduationCap,
} from "lucide-react";
import { toast } from "react-hot-toast";
import { useQuery } from "@tanstack/react-query";
import TableFooter from "@/app/lms/shared/listing/TableFooter";
import { getCurrentUser } from "@/apiServices/tokenVerify";
import type { YouDoProps } from "./TestYourSkills";
import CreateAssessmentModal from "./CreateAssessmentModal";
import { exerciseApi, EntityType } from "@/apiServices/exercise";
import { resubmitExerciseForApproval } from "@/apiServices/userService";
import { useYouDoExercises } from "@/apiServices/hooks/useYouDoExercises";
import AddQuestionForm from "@/app/lms/component/student/YouDo/assessment/questionforms/AddQuestionForm";
import QuestionsTest from "./QuestionsTest";

// ─── Design tokens ────────────────────────────────────────────────────────────
// Brand palette. Keys are named `blue*` for historical reasons — this file
// carries ~60 references and renaming every one is churn without benefit —
// but the values are the app's brand orange (see globals.css: brand-500
// through brand-wash), so the whole assessment surface (Create button,
// active-search chip, hover fills, filter panel, focus ring, empty-state
// tile, pagination active pill) reads as one orange theme instead of the
// out-of-palette indigo it used to be.
const T = {
  blue: "#f97316",          // brand-500 — the primary action tone
  blueDark: "#c2540f",      // brand-700 — hover / pressed
  blueLight: "rgba(249,115,22,0.08)",  // wash background
  blueMid: "rgba(249,115,22,0.15)",    // chip background
  blueGlow: "rgba(249,115,22,0.22)",   // soft glow for CTA shadow
  textMain: "#1a1a2e",
  textSub: "#6b6b7e",
  textMuted: "#8b8b9e",
  textHint: "#bcbccc",
  border: "#ece9f1",
  bg: "#ffffff",
  pageBg: "#ffffff",
  warm: "#fff7f1",          // brand-wash equivalent (was the old indigo hue)
  red: "#ef4444",
  redLight: "rgba(239,68,68,0.1)",
  emerald: "#10b981",
  amber: "#f59e0b",
};

// ─── Types ────────────────────────────────────────────────────────────────────
interface AssessmentRecord {
  id: string;
  _id?: string;
  name: string;
  testType: "mock" | "final" | "practice";
  totalMarks: number;
  questions: number;
  scoring: "testcase" | "ai" | "manual" | "hybrid" | "—";
  level: "beginner" | "intermediate" | "expert";
  status: "active" | "draft" | "ended";
  startDate: string;
  endDate?: string;
  createdAt?: string;
  subcategory?: string;
  isSectionBased: boolean;
  // Approval workflow snapshot for the creator's view. `null` means the
  // exercise has no workflow attached (nothing to show). Otherwise the trainer
  // sees a pill so they know why students can't see it yet.
  approvalStatus?: "in_progress" | "approved" | "rejected" | null;
  approvalStepRole?: string | null;
  // Latest rejection message (comment on the step that rejected the workflow).
  // Non-empty ⇒ we render a "See rejection" callout + a Resubmit action.
  rejectionMessage?: string | null;
  rejectedByRole?: string | null;
  // True when an approver rejected individual questions (per-question rejects
  // don't flip the workflow's overallStatus). Either this or a rejected
  // workflow enables "Request Approval".
  hasRejectedQuestions: boolean;
  // > 0 while in_progress means the current run is a re-request after a
  // reject — the pill reads "Re-requested" instead of "Waiting".
  resubmissionCount: number;
  /**
   * True once at least one student has ever started this assessment (an
   * ExamSession row exists). Stamped by the server on the list endpoint.
   * The row is never deleted, so this stays `true` for the rest of the
   * assessment's life — even after the schedule ends — which matches the
   * product rule: hide the Live Dashboard menu entry until someone joins,
   * then keep it visible permanently.
   *
   * Undefined on legacy responses that predate the field: treat as `false`
   * (dashboard hidden), the safer default.
   */
  hasParticipants?: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const TEST_TYPE_META: Record<string, { label: string; color: string; bg: string }> = {
  mock: { label: "Mock", color: "#8b5cf6", bg: "rgba(139,92,246,0.09)" },
  final: { label: "Final", color: "#ef4444", bg: "rgba(239,68,68,0.09)" },
  practice: { label: "Practice", color: "#10b981", bg: "rgba(16,185,129,0.09)" },
};

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  active: { label: "Active", color: "#059669", bg: "rgba(5,150,105,0.09)" },
  draft: { label: "Draft", color: "#f59e0b", bg: "rgba(245,158,11,0.09)" },
  ended: { label: "Ended", color: T.textMuted, bg: T.pageBg },
};

const SCORING_META: Record<string, { label: string; icon: React.ReactNode; color: string; bg: string }> = {
  testcase: { label: "Test Case", icon: <FlaskConical size={10} />, color: "#059669", bg: "rgba(5,150,105,0.09)" },
  ai: { label: "AI Eval", icon: <Brain size={10} />, color: "#6366f1", bg: "rgba(99,102,241,0.09)" },
  manual: { label: "Manual", icon: <PenLine size={10} />, color: "#f97316", bg: "rgba(249,115,22,0.09)" },
  hybrid: { label: "Hybrid", icon: <Layers size={10} />, color: "#8b5cf6", bg: "rgba(139,92,246,0.09)" },
};

const LEVEL_COLORS: Record<string, string> = {
  beginner: "#10b981",
  intermediate: "#f59e0b",
  expert: "#ef4444",
};

const ITEMS_PER_PAGE = 10;

const getEntityType = (nodeType: string): EntityType => {
  switch (nodeType) {
    case 'module': return 'modules';
    case 'submodule': return 'submodules';
    case 'topic': return 'topics';
    case 'subtopic': return 'subtopics';
    default: return 'topics';
  }
};

// Moved out of the component body so the `assessments` useMemo can reference
// it from above. The function is pure — it doesn't read any component state
// or hooks — so this is a no-op behavior change, only a scoping change.
const transformExerciseToAssessment = (ex: any): AssessmentRecord => {
  const src = ex?.exerciseInformation ? ex : (ex?._doc || ex || {});
  const info = src.exerciseInformation || {};
  const config = src.questionConfiguration || {};

  let testType: AssessmentRecord["testType"] = "mock";
  if (info.testType === "final") testType = "final";
  else if (info.testType === "practice") testType = "practice";

  let scoring: AssessmentRecord["scoring"] = "—";
  if (ex.exerciseType === "Programming" || ex.exerciseType === "Combined") {
    const progConfig = config.programmingQuestionConfiguration;
    if (progConfig?.scoreSettings) {
      const scoreType = progConfig.scoreSettings.scoreType;
      if (scoreType === 'evenMarks') scoring = "testcase";
      else if (scoreType === 'separateMarks') scoring = "manual";
      else if (scoreType === 'levelBasedMarks') scoring = "hybrid";
    }
  }

  let questions = 0;
  if (config.mcqQuestionConfiguration) questions += config.mcqQuestionConfiguration.totalMcqQuestions || 0;
  if (config.programmingQuestionConfiguration) {
    const prog = config.programmingQuestionConfiguration;
    if (prog.questionConfigType === 'general') questions += prog.generalQuestionCount || 0;
    else {
      const counts = prog.levelBasedCounts || { easy: 0, medium: 0, hard: 0 };
      questions += (counts.easy || 0) + (counts.medium || 0) + (counts.hard || 0);
    }
  }

  let status: AssessmentRecord["status"] = "draft";
  const startDate = src.availabilityPeriod?.startDate;
  const endDate = src.availabilityPeriod?.endDate;
  const now = new Date();
  if (startDate) {
    const start = new Date(startDate);
    if (start <= now) {
      if (endDate) { const end = new Date(endDate); status = end >= now ? "active" : "ended"; }
      else status = "active";
    }
  }

  const wf = src.approvalWorkflow;
  let approvalStatus: AssessmentRecord["approvalStatus"] = null;
  let approvalStepRole: string | null = null;
  let rejectionMessage: string | null = null;
  let rejectedByRole: string | null = null;
  if (wf && Array.isArray(wf.steps) && wf.steps.length > 0) {
    approvalStatus = wf.overallStatus || "in_progress";
    if (approvalStatus === "in_progress") {
      const idx = (wf.currentStep || 1) - 1;
      approvalStepRole = wf.steps[idx]?.roleName || null;
    } else if (approvalStatus === "rejected") {
      const rejStep = wf.steps.find((s: any) => s.status === "rejected");
      rejectionMessage = rejStep?.comment || null;
      rejectedByRole = rejStep?.roleName || null;
    }
  }

  return {
    id: info.exerciseId || src._id || ex._id,
    _id: src._id || ex._id,
    name: info.exerciseName || "Untitled Assessment",
    testType, totalMarks: info.totalMarks || 0, questions, scoring,
    level: info.exerciseLevel || "beginner", status,
    startDate: startDate ? new Date(startDate).toLocaleDateString() : "",
    endDate: endDate ? new Date(endDate).toLocaleDateString() : "",
    createdAt: src.createdAt, subcategory: src.subcategory,
    isSectionBased: src.isSectionBased || false,
    approvalStatus,
    approvalStepRole,
    rejectionMessage,
    rejectedByRole,
    hasRejectedQuestions: Array.isArray(src.questions) &&
      src.questions.some((q: any) => q?.approval?.status === "rejected"),
    resubmissionCount: wf?.resubmissionCount || 0,
    // Passed straight through from the You_Do list endpoint. See the
    // AssessmentRecord interface note above for why this stays permanently
    // true once flipped.
    hasParticipants: !!src.hasParticipants,
  };
};

// ─── Delete Confirmation Modal ────────────────────────────────────────────────
const DeleteConfirmModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  assessmentName: string;
  isDeleting: boolean;
}> = ({ isOpen, onClose, onConfirm, assessmentName, isDeleting }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center z-[1000]" style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
      <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden" style={{ boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
        <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: T.border }}>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: T.redLight }}>
              <AlertTriangle size={16} style={{ color: T.red }} />
            </div>
            <h3 className="text-base font-bold" style={{ color: T.textMain }}>Delete Assessment</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 transition-colors">
            <X size={16} style={{ color: T.textMuted }} />
          </button>
        </div>
        <div className="p-5">
          <p className="text-sm" style={{ color: T.textSub }}>
            Are you sure you want to delete <span className="font-semibold" style={{ color: T.textMain }}>"{assessmentName}"</span>?
          </p>
          <p className="text-xs mt-2" style={{ color: T.textMuted }}>
            This action cannot be undone. All student submissions and data associated with this assessment will be permanently deleted.
          </p>
        </div>
        <div className="flex items-center justify-end gap-3 p-4 border-t" style={{ borderColor: T.border, background: T.pageBg }}>
          <button
            onClick={onClose}
            disabled={isDeleting}
            className="px-4 py-2 rounded-lg text-sm font-semibold transition-all"
            style={{ color: T.textSub, background: T.bg, border: `1px solid ${T.border}` }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isDeleting}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition-all flex items-center gap-2"
            style={{ background: T.red }}
          >
            {isDeleting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Deleting...
              </>
            ) : (
              <>
                <Trash2 size={14} />
                Delete
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Portal Dropdown ──────────────────────────────────────────────────────────
const PortalDropMenu: React.FC<{
  anchorEl: HTMLElement | null;
  onClose: () => void;
  children: React.ReactNode;
}> = ({ anchorEl, onClose, children }) => {
  // Compute position from the anchor rect BEFORE first paint — otherwise the
  // menu briefly renders at (0,0) with only `position:fixed` set, then jumps
  // to the anchor once useEffect runs. useLayoutEffect fires synchronously
  // after DOM mutation and before the browser paints, so the initial render
  // shows the menu in its final spot with no visible "buffer" flash.
  const [style, setStyle] = React.useState<React.CSSProperties>(() => {
    if (!anchorEl) return {};
    const rect = anchorEl.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const menuH = 200;
    return spaceBelow < menuH
      ? { position: "fixed", right: window.innerWidth - rect.right, bottom: window.innerHeight - rect.top + 4, zIndex: 9999 }
      : { position: "fixed", right: window.innerWidth - rect.right, top: rect.bottom + 4, zIndex: 9999 };
  });

  React.useLayoutEffect(() => {
    if (!anchorEl) return;
    const rect = anchorEl.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const menuH = 200;
    setStyle(
      spaceBelow < menuH
        ? { position: "fixed", right: window.innerWidth - rect.right, bottom: window.innerHeight - rect.top + 4, zIndex: 9999 }
        : { position: "fixed", right: window.innerWidth - rect.right, top: rect.bottom + 4, zIndex: 9999 }
    );
  }, [anchorEl]);

  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        !(e.target as Element).closest(".asm-dd") &&
        !(e.target as Element).closest(".portal-dropmenu")
      ) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  if (!anchorEl) return null;

  return ReactDOM.createPortal(
    <div
      className="portal-dropmenu"
      style={{
        ...style,
        background: T.bg,
        border: `1px solid ${T.border}`,
        borderRadius: 12,
        boxShadow: "0 10px 32px rgba(0,0,0,0.12)",
        padding: 4,
        minWidth: 148,
        animation: "asmFadeIn 0.12s cubic-bezier(0.16,1,0.3,1) both",
      }}
    >
      {children}
    </div>,
    document.body
  );
};

// ─── DropItem Component ───────────────────────────────────────────────────────
const DropItem: React.FC<{
  icon: React.ReactNode; label: string; color?: string; divider?: boolean; onClick: () => void;
}> = ({ icon, label, color, divider, onClick }) => (
  <button
    type="button" onClick={onClick}
    className="flex items-center gap-2 w-full px-2.5 py-2 text-[11px] font-semibold rounded-lg"
    style={{
      color: color || T.textSub,
      borderTop: divider ? `1px solid ${T.border}` : "none",
      marginTop: divider ? 3 : 0,
      background: "transparent", transition: "all 0.12s",
    }}
    onMouseEnter={e => {
      (e.currentTarget as HTMLElement).style.background = color ? `${color}10` : T.pageBg;
      (e.currentTarget as HTMLElement).style.color = color || T.textMain;
    }}
    onMouseLeave={e => {
      (e.currentTarget as HTMLElement).style.background = "transparent";
      (e.currentTarget as HTMLElement).style.color = color || T.textSub;
    }}
  >
    {icon}{label}
  </button>
);

// ─── Pagination Component ─────────────────────────────────────────────────────
const Pagination: React.FC<{
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalItems: number;
  itemsPerPage: number;
}> = ({ currentPage, totalPages, onPageChange, totalItems, itemsPerPage }) => {
  if (totalPages <= 1) return null;

  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t" style={{ borderColor: T.border, background: T.bg }}>
      <div className="text-[10px] font-medium" style={{ color: T.textMuted }}>
        Showing {startItem} to {endItem} of {totalItems} assessments
      </div>
      <div className="flex items-center gap-1">
        <button onClick={() => onPageChange(1)} disabled={currentPage === 1} className="p-1.5 rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed" style={{ color: currentPage === 1 ? T.textMuted : T.textSub }} title="First page">
          <ChevronsLeft size={14} />
        </button>
        <button onClick={() => onPageChange(currentPage - 1)} disabled={currentPage === 1} className="p-1.5 rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed" style={{ color: currentPage === 1 ? T.textMuted : T.textSub }} title="Previous page">
          <ChevronLeft size={14} />
        </button>
        <div className="flex items-center gap-1 px-2">
          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            let pageNum: number;
            if (totalPages <= 5) pageNum = i + 1;
            else if (currentPage <= 3) pageNum = i + 1;
            else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
            else pageNum = currentPage - 2 + i;
            return (
              <button key={pageNum} onClick={() => onPageChange(pageNum)} className="min-w-[28px] h-7 px-2 rounded-lg text-[11px] font-semibold transition-all" style={{ background: currentPage === pageNum ? T.blue : 'transparent', color: currentPage === pageNum ? '#fff' : T.textSub }}>
                {pageNum}
              </button>
            );
          })}
        </div>
        <button onClick={() => onPageChange(currentPage + 1)} disabled={currentPage === totalPages} className="p-1.5 rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed" style={{ color: currentPage === totalPages ? T.textMuted : T.textSub }} title="Next page">
          <ChevronRightIcon size={14} />
        </button>
        <button onClick={() => onPageChange(totalPages)} disabled={currentPage === totalPages} className="p-1.5 rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed" style={{ color: currentPage === totalPages ? T.textMuted : T.textSub }} title="Last page">
          <ChevronsRight size={14} />
        </button>
      </div>
    </div>
  );
};

// ─── Section Picker Modal ─────────────────────────────────────────────────────
const SectionPickerModal: React.FC<{
  exercise: any;
  onClose: () => void;
  onPick: (sectionCfg: any, sectionMeta: any) => void;
}> = ({ exercise, onClose, onPick }) => {
  const sectionConfigs = exercise?.sectionConfigs || {};
  const allQuestions: any[] = exercise?.questions || [];

  const countBySectionId: Record<string, { mcq: number; programming: number }> = {};
  allQuestions.forEach((q: any) => {
    if (q.sectionId) {
      if (!countBySectionId[q.sectionId]) countBySectionId[q.sectionId] = { mcq: 0, programming: 0 };
      if (q.questionType === 'mcq') countBySectionId[q.sectionId].mcq++;
      if (q.questionType === 'programming') countBySectionId[q.sectionId].programming++;
    }
  });

  const sections: any[] = Object.keys(sectionConfigs)
    .map((key) => {
      const cfg = sectionConfigs[key] || {};
      const sectionId = cfg.id || key;
      const exerciseType: string = cfg.exerciseType || 'MCQ';
      const counts = countBySectionId[sectionId] || { mcq: 0, programming: 0 };

      const mcqLimit = cfg.mcqConfig?.generalQuestionCount || 0;
      const mcqCount = counts.mcq;
      const mcqFull = mcqLimit > 0 && mcqCount >= mcqLimit;

      const pc = cfg.programmingConfig || {};
      let progLimit = 0;
      if (pc.questionConfigType === 'general') progLimit = pc.generalQuestionCount || 0;
      else {
        const lb = pc.levelBasedCounts || {};
        progLimit = (lb.easy || 0) + (lb.medium || 0) + (lb.hard || 0);
      }
      const progCount = counts.programming;
      const progFull = progLimit > 0 && progCount >= progLimit;

      let isFull = false;
      if (exerciseType === 'MCQ') isFull = mcqFull;
      if (exerciseType === 'Programming') isFull = progFull;
      if (exerciseType === 'Combined') isFull = mcqFull && progFull;

      return {
        id: sectionId, name: cfg.name || key, order: cfg.sectionNumber ?? 0,
        totalMarks: cfg.totalMarks ?? 0, description: cfg.description || '',
        exerciseType, mcqLimit, mcqCount, mcqFull,
        progLimit, progCount, progFull, isFull, _cfg: cfg,
      };
    })
    .sort((a, b) => (a.order || 0) - (b.order || 0));

  const typeMeta: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
    MCQ: { label: "MCQ", color: "#6366f1", bg: "rgba(99,102,241,0.10)", icon: <List size={11} /> },
    Programming: { label: "Programming", color: "#059669", bg: "rgba(5,150,105,0.10)", icon: <Code size={11} /> },
    Combined: { label: "Combined", color: "#8b5cf6", bg: "rgba(139,92,246,0.10)", icon: <Layers size={11} /> },
    Other: { label: "Other", color: "#f59e0b", bg: "rgba(245,158,11,0.10)", icon: <FlaskConical size={11} /> },
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4" style={{ background: 'rgba(15,15,30,0.55)', backdropFilter: 'blur(3px)' }} onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-lg overflow-hidden" style={{ boxShadow: '0 20px 56px rgba(0,0,0,0.25)' }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: T.border, background: T.blueLight }}>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: T.bg }}>
              <Layers size={15} style={{ color: T.blue }} />
            </div>
            <div>
              <h3 className="text-sm font-bold" style={{ color: T.textMain }}>Select Section</h3>
              <p className="text-[10.5px]" style={{ color: T.textMuted }}>{exercise?.exerciseInformation?.exerciseName}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white"><X size={15} style={{ color: T.textMuted }} /></button>
        </div>
        <div className="p-4 max-h-[60vh] overflow-y-auto" style={{ background: T.pageBg }}>
          {sections.length === 0 ? (
            <div className="text-center py-10 text-xs" style={{ color: T.textMuted }}>No sections found.</div>
          ) : (
            <div className="flex flex-col gap-2">
              {sections.map((sec: any, idx: number) => {
                const tm = typeMeta[sec.exerciseType] || typeMeta.MCQ;
                return (
                  <button
                    key={sec.id || idx}
                    onClick={() => !sec.isFull && onPick(sec._cfg, sec)}
                    disabled={sec.isFull}
                    className="text-left p-3 rounded-xl flex items-center gap-3 transition-all"
                    style={{ background: sec.isFull ? '#f9f9fb' : T.bg, border: `1px solid ${sec.isFull ? '#e0e0e0' : T.border}`, cursor: sec.isFull ? 'not-allowed' : 'pointer', opacity: sec.isFull ? 0.65 : 1 }}
                    onMouseEnter={e => { if (!sec.isFull) { (e.currentTarget as HTMLElement).style.borderColor = T.blue; (e.currentTarget as HTMLElement).style.boxShadow = `0 4px 16px ${T.blueGlow}`; } }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = sec.isFull ? '#e0e0e0' : T.border; (e.currentTarget as HTMLElement).style.boxShadow = 'none'; }}
                  >
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 text-[11px] font-extrabold" style={{ background: sec.isFull ? '#efefef' : T.blueLight, color: sec.isFull ? T.textMuted : T.blue }}>
                      {sec.order || idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[12.5px] font-bold truncate" style={{ color: sec.isFull ? T.textMuted : T.textMain }}>{sec.name}</span>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wide flex-shrink-0" style={{ background: tm.bg, color: tm.color }}>{tm.icon}{tm.label}</span>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        {sec.mcqLimit > 0 && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold" style={{ background: sec.mcqFull ? '#fee2e2' : 'rgba(99,102,241,0.08)', color: sec.mcqFull ? T.red : '#6366f1' }}>
                            <List size={8} />MCQ {sec.mcqCount}/{sec.mcqLimit}{sec.mcqFull && ' ✓'}
                          </span>
                        )}
                        {sec.progLimit > 0 && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold" style={{ background: sec.progFull ? '#fee2e2' : 'rgba(5,150,105,0.08)', color: sec.progFull ? T.red : '#059669' }}>
                            <Code size={8} />Prog {sec.progCount}/{sec.progLimit}{sec.progFull && ' ✓'}
                          </span>
                        )}
                        <span className="text-[9px]" style={{ color: T.textMuted }}>{sec.totalMarks} marks</span>
                      </div>
                    </div>
                    <div className="flex-shrink-0">
                      {sec.isFull ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[9px] font-black" style={{ background: '#fee2e2', color: T.red }}>Full</span>
                      ) : (
                        <ChevronRight size={14} style={{ color: T.textHint }} />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Type Picker Modal ────────────────────────────────────────────────────────
const TypePickerModal: React.FC<{
  section: any;
  onClose: () => void;
  onBack: () => void;
  onPick: (type: 'MCQ' | 'Programming') => void;
}> = ({ section, onClose, onBack, onPick }) => {
  const mcqFull = section?.mcqFull || false;
  const progFull = section?.progFull || false;
  const mcqCount = section?.mcqCount || 0;
  const mcqLimit = section?.mcqLimit || 0;
  const progCount = section?.progCount || 0;
  const progLimit = section?.progLimit || 0;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4" style={{ background: 'rgba(15,15,30,0.55)', backdropFilter: 'blur(3px)' }} onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden" style={{ boxShadow: '0 20px 56px rgba(0,0,0,0.25)' }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: T.border, background: 'rgba(139,92,246,0.10)' }}>
          <div className="flex items-center gap-2">
            <button onClick={onBack} className="p-1 rounded-lg hover:bg-white" title="Back"><ChevronLeft size={14} style={{ color: T.textMuted }} /></button>
            <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: T.bg }}><Layers size={15} style={{ color: '#8b5cf6' }} /></div>
            <div>
              <h3 className="text-sm font-bold" style={{ color: T.textMain }}>Question Type</h3>
              <p className="text-[10.5px]" style={{ color: T.textMuted }}>Section: {section?.name} (Combined)</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white"><X size={15} style={{ color: T.textMuted }} /></button>
        </div>
        <div className="p-4 grid grid-cols-2 gap-3" style={{ background: T.pageBg }}>
          <button
            onClick={() => !mcqFull && onPick('MCQ')}
            disabled={mcqFull}
            className="p-4 rounded-xl flex flex-col items-center gap-2 transition-all relative"
            style={{ background: mcqFull ? '#f9f9fb' : T.bg, border: `1px solid ${mcqFull ? '#e0e0e0' : T.border}`, cursor: mcqFull ? 'not-allowed' : 'pointer', opacity: mcqFull ? 0.6 : 1 }}
            onMouseEnter={e => { if (!mcqFull) { (e.currentTarget as HTMLElement).style.borderColor = '#6366f1'; (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 16px rgba(99,102,241,0.22)'; } }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = mcqFull ? '#e0e0e0' : T.border; (e.currentTarget as HTMLElement).style.boxShadow = 'none'; }}
          >
            {mcqFull && <span className="absolute top-2 right-2 text-[8px] font-black px-1.5 py-0.5 rounded-full" style={{ background: '#fee2e2', color: T.red }}>Full</span>}
            <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: mcqFull ? '#efefef' : 'rgba(99,102,241,0.10)' }}><List size={22} style={{ color: mcqFull ? T.textMuted : '#6366f1' }} /></div>
            <div className="text-[12px] font-bold" style={{ color: mcqFull ? T.textMuted : T.textMain }}>MCQ Question</div>
            <div className="text-[10px] font-semibold" style={{ color: mcqFull ? T.red : T.textMuted }}>{mcqLimit > 0 ? `${mcqCount} / ${mcqLimit} added` : `${mcqCount} added`}</div>
            {mcqLimit > 0 && (
              <div className="w-full h-1 rounded-full overflow-hidden" style={{ background: '#e4e4ed' }}>
                <div className="h-full rounded-full" style={{ width: `${Math.min(100, (mcqCount / mcqLimit) * 100)}%`, background: mcqFull ? T.red : '#6366f1' }} />
              </div>
            )}
          </button>
          <button
            onClick={() => !progFull && onPick('Programming')}
            disabled={progFull}
            className="p-4 rounded-xl flex flex-col items-center gap-2 transition-all relative"
            style={{ background: progFull ? '#f9f9fb' : T.bg, border: `1px solid ${progFull ? '#e0e0e0' : T.border}`, cursor: progFull ? 'not-allowed' : 'pointer', opacity: progFull ? 0.6 : 1 }}
            onMouseEnter={e => { if (!progFull) { (e.currentTarget as HTMLElement).style.borderColor = '#059669'; (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 16px rgba(5,150,105,0.22)'; } }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = progFull ? '#e0e0e0' : T.border; (e.currentTarget as HTMLElement).style.boxShadow = 'none'; }}
          >
            {progFull && <span className="absolute top-2 right-2 text-[8px] font-black px-1.5 py-0.5 rounded-full" style={{ background: '#fee2e2', color: T.red }}>Full</span>}
            <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: progFull ? '#efefef' : 'rgba(5,150,105,0.10)' }}><Code size={22} style={{ color: progFull ? T.textMuted : '#059669' }} /></div>
            <div className="text-[12px] font-bold" style={{ color: progFull ? T.textMuted : T.textMain }}>Programming</div>
            <div className="text-[10px] font-semibold" style={{ color: progFull ? T.red : T.textMuted }}>{progLimit > 0 ? `${progCount} / ${progLimit} added` : `${progCount} added`}</div>
            {progLimit > 0 && (
              <div className="w-full h-1 rounded-full overflow-hidden" style={{ background: '#e4e4ed' }}>
                <div className="h-full rounded-full" style={{ width: `${Math.min(100, (progCount / progLimit) * 100)}%`, background: progFull ? T.red : '#059669' }} />
              </div>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Completeness checker ──────────────────────────────────────────────────────
const isAssessmentComplete = (ex: any): boolean => {
  if (!ex) return false;

  // ── 1. Basic settings ─────────────────────────────────────────────────────
  if (!ex.exerciseType) return false;
  const info = ex.exerciseInformation || {};
  if (!info.exerciseName?.trim()) return false;
  if (!ex.availabilityPeriod?.startDate) return false;
  // Marks are only required for graded exercises — non-graded ones
  // (isGraded === false) legitimately carry totalMarks = 0.
  if (ex.isGraded !== false
      && (info.totalMarks ?? 0) <= 0 && (info.totalMarksMCQ ?? 0) <= 0) return false;

  // Scope-aware baseline (mirrors the server): for "settings_and_questions",
  // require at least one actual question. Without this, an exercise saved
  // before any question-count is configured would silently pass the per-type
  // checks below (they only trigger when `maxQ > 0`).
  const scope = ex.availabilityPeriod?.approvalScope || 'settings';
  const hasQuestions = Array.isArray(ex.questions) && ex.questions.length > 0;
  if (scope === 'settings_and_questions' && !hasQuestions) return false;

  // ── 2. Questions completeness ─────────────────────────────────────────────
  if (ex.isSectionBased) {
    const sectionConfigs: Record<string, any> = ex.sectionConfigs || {};
    const allQuestions: any[] = ex.questions || [];

    const countBySectionId: Record<string, { mcq: number; prog: number }> = {};
    allQuestions.forEach((q: any) => {
      const sid = q.sectionId;
      if (!sid) return;
      if (!countBySectionId[sid]) countBySectionId[sid] = { mcq: 0, prog: 0 };
      if (q.questionType === 'mcq') countBySectionId[sid].mcq++;
      if (q.questionType === 'programming' || q.questionType === 'database' || q.questionType === 'others') countBySectionId[sid].prog++;
    });

    for (const key of Object.keys(sectionConfigs)) {
      const cfg = sectionConfigs[key] || {};
      const sectionId = cfg.id || key;
      const exerciseType: string = cfg.exerciseType || 'MCQ';
      const counts = countBySectionId[sectionId] || { mcq: 0, prog: 0 };

      if (exerciseType === 'MCQ' || exerciseType === 'Combined') {
        const mcqLimit: number = cfg.mcqConfig?.generalQuestionCount || 0;
        if (mcqLimit > 0 && counts.mcq < mcqLimit) return false;
      }
      if (exerciseType === 'Programming' || exerciseType === 'Combined') {
        const pc = cfg.programmingConfig || {};
        const lb = pc.levelBasedCounts || {};
        const progLimit: number = pc.questionConfigType === 'general'
          ? (pc.generalQuestionCount || 0)
          : ((lb.easy || 0) + (lb.medium || 0) + (lb.hard || 0));
        if (progLimit > 0 && counts.prog < progLimit) return false;
      }
    }
    return true;
  }

  // Regular (non-section-based) exercise
  const qc = ex.questionConfiguration || {};
  const mcqCfg: any = qc.mcqQuestionConfiguration;
  const progCfg: any = qc.programmingQuestionConfiguration;
  const questions: any[] = ex.questions || [];
  const mcqQs = questions.filter((q: any) => q.questionType === 'mcq');
  const progQs = questions.filter((q: any) =>
    q.questionType === 'programming' || q.questionType === 'database' || q.questionType === 'others'
  );

  if (ex.exerciseType === 'MCQ') {
    const maxQ: number = mcqCfg?.totalMcqQuestions ?? 0;
    if (maxQ > 0 && mcqQs.length < maxQ) return false;
  } else if (ex.exerciseType === 'Programming') {
    const ct = progCfg?.questionConfigType;
    const lc = progCfg?.levelBasedCounts ?? progCfg?.selectionLevelCounts ?? {};
    const maxQ: number = ct === 'general'
      ? (progCfg?.generalQuestionCount ?? 0)
      : ((lc.easy ?? 0) + (lc.medium ?? 0) + (lc.hard ?? 0));
    if (maxQ > 0 && progQs.length < maxQ) return false;
  } else if (ex.exerciseType === 'Combined') {
    const ct = progCfg?.questionConfigType;
    const lc = progCfg?.levelBasedCounts ?? progCfg?.selectionLevelCounts ?? {};
    const progMax: number = ct === 'general'
      ? (progCfg?.generalQuestionCount ?? 0)
      : ((lc.easy ?? 0) + (lc.medium ?? 0) + (lc.hard ?? 0));
    const maxQ = (mcqCfg?.totalMcqQuestions ?? 0) + progMax;
    const curQ = mcqQs.length + progQs.length;
    if (maxQ > 0 && curQ < maxQ) return false;
  }

  return true;
};

// ─── Main Component ───────────────────────────────────────────────────────────
export default function Assessment({
  nodeId, nodeName, subcategory, subcategoryLabel,
  courseId, nodeType, hierarchyData, configuredLanguages, batchId,
}: YouDoProps) {
  const router = useRouter();
  // Manage Users opens under the section this screen was reached through.
  const sectionHref = useSectionHref();
  const searchParams = useSearchParams();
  // Deep-link: notifications from a rejection carry `highlightExerciseId` so
  // the trainer lands directly on the row. Kept in a ref so it can be cleared
  // after the first highlight fades — we don't want the URL param to keep
  // re-triggering the animation on unrelated re-renders.
  const highlightExerciseId = searchParams?.get("highlightExerciseId") || null;
  const [rejectionViewer, setRejectionViewer] = useState<AssessmentRecord | null>(null);
  // Source-of-truth for the list moved out of local state into React Query
  // (see `useYouDoExercises` hook below). `assessments` / `rawExercises` are
  // now derived via `useMemo` and stay referentially stable across renders
  // when the underlying data hasn't changed.
  const [showModal, setShowModal] = useState(false);
  const [editingAsm, setEditingAsm] = useState<AssessmentRecord | null>(null);

  // ── CHANGED: openDrop now tracks id + anchor element ──
  const [openDrop, setOpenDrop] = useState<{ id: string; el: HTMLElement } | null>(null);

  // ── React Query owns the exercises list ──
  // The parent page subscribes to the SAME query key during a restore-from-
  // analytics navigation, so the loader the parent shows stays up until this
  // hook resolves. After the first successful fetch, switching back to this
  // node within `staleTime` (60 s) hydrates instantly from cache.
  const {
    data: exercisesData,
    isLoading: isExercisesLoading,
    isFetching: isExercisesFetching,
    error: exercisesError,
    refetch: refetchExercises,
  } = useYouDoExercises({
    entityType: getEntityType(nodeType),
    entityId: nodeId,
    tabType: "You_Do",
    subcategory,
    // Part of this list's identity: batch 1 and batch 2 have genuinely
    // different assessments at the same node.
    batchId,
  });

  const rawExercises = useMemo(() => exercisesData?.exercises ?? [], [exercisesData]);
  const assessments = useMemo(
    () => rawExercises.map(transformExerciseToAssessment),
    [rawExercises],
  );

  // Preserve the names the JSX further down already uses (`isLoading`,
  // `error`) without changing the rendering branches.
  const isLoading = isExercisesLoading;
  const error = exercisesError ? (exercisesError as Error).message ?? "Failed to load assessments" : null;

  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; id: string; name: string; _id?: string }>({
    isOpen: false, id: "", name: "", _id: undefined
  });
  const [isDeleting, setIsDeleting] = useState(false);
  const [showQuestionsTest, setShowQuestionsTest] = useState(false);
  const [selectedAssessmentForTest, setSelectedAssessmentForTest] = useState<any>(null);
  // The FULL exercise doc that pairs with the slim `selectedAssessmentForTest`
  // record — carries sectionConfigs / questionSource / customSources that the
  // slim view record drops. Handed to QuestionsTest as `preloadedExercise`.
  const [selectedFullExercise, setSelectedFullExercise] = useState<any>(null);
  const [addQ, setAddQ] = useState<{
    step: 'section' | 'type' | 'form' | null;
    exercise?: any;
    section?: any;
    questionType?: 'MCQ' | 'Programming';
  }>({ step: null });
  const [loadingFullExercise, setLoadingFullExercise] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  // Mock/Final tab strip. The "mock" tab also catches legacy values
  // (practice/blank) so no existing record is hidden by the two-tab split.
  const [activeTestTab, setActiveTestTab] = useState<'mock' | 'final'>('mock');
  const [filterStatus, setFilterStatus] = useState<string>('');

  // Mock/Final split is a student-only affordance. Trainers/admins see one
  // combined Assessment list — the tab strip and the mock/final filter both
  // gate on this. Respects the role-switch localStorage flag so a trainer
  // previewing as a student still sees the split.
  const { data: __userData } = useQuery({
    queryKey: ['currentUser'],
    queryFn: getCurrentUser,
    retry: 1,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    enabled: typeof window !== 'undefined' && !!getToken(),
  });
  const isStudentView = useMemo(() => {
    try {
      if (typeof window !== 'undefined') {
        const raw = localStorage.getItem('smartcliff_roleSwitch');
        if (raw && JSON.parse(raw)?.isDummyStudent) return true;
      }
    } catch {}
    const u: any = (__userData as any)?.user || null;
    const rn = u?.role?.roleName?.toLowerCase() || '';
    const rr = u?.role?.renameRole?.toLowerCase() || '';
    return rn.includes('student') || rr.includes('student');
  }, [__userData]);

  // ── CHANGED: outside-click handler also ignores portal-dropmenu clicks ──
  React.useEffect(() => {
    const h = (e: MouseEvent) => {
      if (
        !(e.target as Element).closest(".asm-dd") &&
        !(e.target as Element).closest(".portal-dropmenu")
      ) setOpenDrop(null);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  // ── CHANGED: toggleDrop stores the button element as anchor ──
  const toggleDrop = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (openDrop?.id === id) { setOpenDrop(null); return; }
    setOpenDrop({ id, el: e.currentTarget as HTMLElement });
  };

  useEffect(() => { setCurrentPage(1); }, [assessments.length, searchQuery, activeTestTab, filterStatus]);

  // Deep-links (highlightExerciseId) must land on the tab that actually
  // contains the highlighted row, or the flash animation plays off-screen.
  // One-shot: the URL param survives refetches, and re-applying it would yank
  // the user back after they manually switch tabs.
  const highlightTabAppliedRef = useRef(false);
  useEffect(() => {
    if (!highlightExerciseId || highlightTabAppliedRef.current) return;
    const hit = assessments.find(a => a._id === highlightExerciseId || a.id === highlightExerciseId);
    if (hit) {
      highlightTabAppliedRef.current = true;
      setActiveTestTab(hit.testType === 'final' ? 'final' : 'mock');
    }
  }, [highlightExerciseId, assessments]);

  const filtered = useMemo(() => {
    return assessments.filter(asm => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!asm.name.toLowerCase().includes(q) && !asm.id.toLowerCase().includes(q)) return false;
      }
      if (isStudentView && (activeTestTab === 'final' ? asm.testType !== 'final' : asm.testType === 'final')) return false;
      if (filterStatus) {
        const rawEx = rawExercises.find((e: any) => (e._id || e.id) === (asm._id || asm.id));
        const complete = isAssessmentComplete(rawEx);
        if (filterStatus === 'complete' && !complete) return false;
        if (filterStatus === 'incomplete' && complete) return false;
      }
      return true;
    });
  }, [assessments, rawExercises, searchQuery, activeTestTab, filterStatus, isStudentView]);

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const currentAssessments = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  // Per-tab counts for the Mock/Final strip. Mirrors the tab filter above:
  // everything that isn't "final" counts under Mock.
  const tabCounts = useMemo(() => {
    const finals = assessments.filter(a => a.testType === 'final').length;
    return { mock: assessments.length - finals, final: finals };
  }, [assessments]);

  // `transformExerciseToAssessment` lives at module scope above — it doesn't
  // touch component state and was needed earlier in the render than its
  // previous in-component declaration allowed.
  // `fetchExercises` is gone too: the React Query hook owns the fetch
  // lifecycle now; any code path that previously called `fetchExercises()`
  // calls `refetchExercises()` instead and gets the same outcome (with the
  // bonus of cache dedupe across components).

  const handleSave = useCallback(async (payload: any) => {
    try {
      await refetchExercises();
      // Land on the tab the assessment was saved under — the modal's Exercise
      // Details step still lets the user flip Mock ⇄ Final before finishing.
      const savedType = payload?.exerciseInformation?.testType;
      if (savedType === 'final' || savedType === 'mock') setActiveTestTab(savedType);
      // No success toast here — CreateAssessmentModal already fired one for the
      // write it performed, and both landing together was two toasts for one
      // action. The error below stays: a refetch failure is this component's
      // own problem, and the modal knows nothing about it.
    } catch (err: any) {
      toast.error(err.message || 'Failed to save assessment');
    } finally {
      setShowModal(false);
      setEditingAsm(null);
    }
  }, [refetchExercises, editingAsm]);

  const openDeleteModal = (id: string, name: string, _id?: string) => {
    setDeleteModal({ isOpen: true, id, name, _id });
    setOpenDrop(null);
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await exerciseApi.deleteExercise(getEntityType(nodeType), nodeId, deleteModal._id || deleteModal.id, 'You_Do', subcategory);
      // Trigger a refetch so the React Query cache (shared with the parent
      // page) reflects the deletion. Previously this used a local
      // `setAssessments(prev => prev.filter(...))` optimistic remove; with
      // the data source moved into the cache, a refetch is the canonical
      // update path. The list paints from cache while the refetch runs in
      // the background, so the deleted row disappears immediately if
      // present in the response.
      await refetchExercises();
      toast.success('Assessment deleted successfully');
      setDeleteModal({ isOpen: false, id: "", name: "", _id: undefined });
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete assessment');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleEdit = (asm: AssessmentRecord) => {
    setEditingAsm(asm);
    setShowModal(true);
    setOpenDrop(null);
  };

  const handleAddQuestion = async (asm: AssessmentRecord) => {
    setOpenDrop(null);
    setLoadingFullExercise(true);
    try {
      const exId = asm._id || asm.id;
      const res = await exerciseApi.getExerciseById(exId);
      const full = res?.data?.exercise || res?.exercise || (res?.data && !Array.isArray(res.data) ? res.data : null) || res;
      if (!full) { toast.error('Could not load exercise details'); return; }
      if (full.isSectionBased) setAddQ({ step: 'section', exercise: full });
      else setAddQ({ step: 'form', exercise: full });
    } catch (err: any) {
      toast.error(err?.message || 'Failed to load exercise details');
    } finally {
      setLoadingFullExercise(false);
    }
  };

  const closeAddQ = () => setAddQ({ step: null });

  // Explicit resubmit: resets the workflow to step 1 (in_progress) and flips
  // every question approval back to pending on the server, so the approver
  // sees Approve/Reject again on both the assessment row and each question.
  const [resubmittingId, setResubmittingId] = useState<string | null>(null);
  const handleResubmit = async (asm: AssessmentRecord) => {
    setOpenDrop(null);
    const token = getToken();
    if (!token) { toast.error("You're not signed in — please log in again."); return; }
    setResubmittingId(asm._id || asm.id);
    try {
      const resp = await resubmitExerciseForApproval({
        entityType: getEntityType(nodeType) as any,
        entityId: nodeId,
        tabType: "You_Do",
        subcategory,
        exerciseId: String(asm._id || asm.id),
      }, token);
      toast.success(resp?.message || "Resubmitted for approval");
      await refetchExercises();
    } catch (err: any) {
      toast.error(err?.message || "Failed to resubmit for approval");
    } finally {
      setResubmittingId(null);
    }
  };

  const handleManageQuestion = (asm: AssessmentRecord) => {
    // Just open the view. QuestionsTest re-fetches the full exercise itself
    // (see QuestionsTest.tsx line 475), so the pre-fetch we used to do here
    // was duplicate work — it succeeded silently on the happy path and only
    // ever surfaced as "Failed to load assessment details" on the sad path.
    // Handing over the row record AND the raw full exercise (already in
    // memory from useYouDoExercises) lets QuestionsTest mount with real
    // `sectionConfigs` on frame one instead of waiting for its own fetch —
    // and if that fetch comes back without sectionConfigs (some code paths
    // strip Map fields), the preloaded copy still keeps the Section Picker
    // populated so section-based assessments don't fall to "No sections
    // found".
    setOpenDrop(null);
    setSelectedAssessmentForTest(asm);
    const rawEx = rawExercises.find(
      (e: any) => (e._id || e.id) === (asm._id || asm.id),
    );
    setSelectedFullExercise(rawEx || null);
    setShowQuestionsTest(true);
  };

  const buildAddQExerciseData = () => {
    const ex = addQ.exercise;
    if (!ex) return null;

    let effectiveExerciseType: string = ex.exerciseType;
    if (addQ.section) {
      if (addQ.section.exerciseType === 'Combined' && addQ.questionType) effectiveExerciseType = addQ.questionType;
      else effectiveExerciseType = addQ.section.exerciseType;
    }

    const currentSectionId = addQ.section?.id || null;
    const currentSectionName = addQ.section?.name || null;
    const allQuestions: any[] = ex.questions || [];
    const sectionQuestions = currentSectionId
      ? allQuestions.filter((q: any) => {
          if (q.sectionId && q.sectionId === currentSectionId) return true;
          if (!q.sectionId && q.sectionName && q.sectionName === currentSectionName) return true;
          return false;
        })
      : allQuestions;

    let fullExerciseData: any = {
      ...ex, exerciseType: effectiveExerciseType, hierarchyData,
      questions: sectionQuestions, currentSectionId, currentSectionName,
    };

    if (addQ.section) {
      const sec = addQ.section;
      const mcqCfg = sec.mcqConfig || {};
      const progCfg = sec.programmingConfig || {};
      // mcqSectionMarks = TOTAL marks for the MCQ part of this section
      // Note: mcqCfg.scoreSettings.equalDistribution = marks PER QUESTION (not total),
      //       so we must NOT use it as a stand-in for the total section marks.
      const mcqSectionMarks = sec.mcqSectionMarks ?? (sec.exerciseType === 'MCQ' ? sec.totalMarks : 0) ?? 0;
      const progSectionMarks = sec.programmingSectionMarks ?? (sec.exerciseType === 'Programming' ? sec.totalMarks : 0) ?? 0;
      const mcqGenCount = mcqCfg.generalQuestionCount || 0;
      const mcqScoringType = mcqCfg?.scoreSettings?.scoreType || 'equalDistribution';
      // equalDistribution in sectionConfig.mcqConfig = marks per question directly
      const mcqMarksPerQ: number =
        mcqCfg?.scoreSettings?.equalDistribution ||
        (mcqGenCount > 0 ? Math.floor(mcqSectionMarks / mcqGenCount) : 0);
      const mcqQuestionConfiguration = { scoringType: mcqScoringType, marksPerQuestion: mcqMarksPerQ, totalMcqQuestions: mcqGenCount, attemptLimitEnabled: mcqCfg.attemptLimitEnabled, submissionAttempts: mcqCfg.submissionAttempts };
      // ── Programming config — only relevant when section exerciseType is Programming or Combined ──
      const pc = progCfg;
      const cfgType = pc.questionConfigType || 'general';

      const lvlCounts    = pc.levelBasedCounts    || { easy: 0, medium: 0, hard: 0 };
      const selCounts    = pc.selectionLevelCounts || { easy: 0, medium: 0, hard: 0 };
      const lvlScoring   = pc.levelScoring || {};

      // level-based: read marksPerQuestion directly from levelScoring (already per-question)
      const levelScoringConfiguration: any = {};
      const levelBasedMarks: any = {};
      (['easy', 'medium', 'hard'] as const).forEach((d) => {
        const s     = lvlScoring[d] || {};
        const count = (cfgType === 'selectionLevel' ? selCounts[d] : lvlCounts[d]) || 0;
        const mpq   = s.marksPerQuestion || 0;
        levelScoringConfiguration[d] = {
          type: s.type || 'level_specific',
          marksPerQuestion: mpq,
          questionCount: count,
          totalMarks: mpq * count,
        };
        levelBasedMarks[d] = mpq;
      });

      // general: scoreSettings.equalDistribution = marks PER QUESTION (same pattern as MCQ)
      const progGenCount: number = pc.generalQuestionCount || 0;
      const generalMarksPerQuestion: number =
        pc.scoreSettings?.equalDistribution ||
        (progGenCount > 0 ? Math.floor(progSectionMarks / progGenCount) : 0);

      const programmingQuestionConfiguration = {
        questionConfigType: cfgType,
        generalQuestionCount: progGenCount,
        generalMarksPerQuestion,
        levelBasedCounts: lvlCounts,
        selectionLevelCounts: selCounts,
        questionFlow: pc.questionFlow || 'freeFlow',
        attemptLimitEnabled: pc.attemptLimitEnabled,
        submissionAttempts: pc.submissionAttempts,
        scoreSettings: {
          ...(pc.scoreSettings || {}),
          levelScoringConfiguration,
          levelBasedMarks,
          evenMarks: generalMarksPerQuestion,  // same value, used as fallback in form
        },
      };
      const effTotalMarks = effectiveExerciseType === 'MCQ' ? mcqSectionMarks : effectiveExerciseType === 'Programming' ? progSectionMarks : sec.totalMarks || 0;
      fullExerciseData = {
        ...fullExerciseData,
        questionConfiguration: { ...(ex.questionConfiguration || {}), mcqQuestionConfiguration, programmingQuestionConfiguration },
        exerciseInformation: { ...(ex.exerciseInformation || {}), totalMarks: effTotalMarks, totalMarksMCQ: mcqSectionMarks, totalMarksProgramming: progSectionMarks },
        totalMarksMCQ: mcqSectionMarks, totalMarksProgramming: progSectionMarks,
      };
    }

    return {
      exerciseId: ex._id, _id: ex._id,
      exerciseName: ex.exerciseInformation?.exerciseName,
      exerciseLevel: ex.exerciseInformation?.exerciseLevel || 'intermediate',
      selectedLanguages: ex.exerciseInformation?.selectedLanguages || [],
      nodeId, nodeName, subcategory, nodeType, fullExerciseData,
      exerciseType: effectiveExerciseType,
      programmingSettings: ex.programmingSettings,
      subcategoryLabel, currentSectionId, currentSectionName,
    };
  };

  const stats = [
    { icon: <FileText size={14} />, label: "Total", value: assessments.length, color: T.blue },
    { icon: <CheckCircle size={14} />, label: "Active", value: assessments.filter(a => a.status === "active").length, color: "#059669" },
    { icon: <Clock size={14} />, label: "Draft", value: assessments.filter(a => a.status === "draft").length, color: "#f59e0b" },
    { icon: <BarChart2 size={14} />, label: "Ended", value: assessments.filter(a => a.status === "ended").length, color: "#8b5cf6" },
  ];

  // Grid row layout — tokenised heights (h-8 header, h-11 body) so the
  // list reads as one system with Client Management / User Management /
  // Service Mapping. Padding-based row heights were replaced by fixed
  // heights so the DataTable rhythm is exact.
  const rowBase: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "minmax(0,1fr) minmax(0,2fr) 80px 110px 90px 80px 60px",
    gap: 8, alignItems: "center", padding: "0 12px",
    transition: "background-color 0.15s",
  };

  // Manage Questions has priority over the assessment-list loader. Without
  // this order swap, when the user finishes Save & Finish on the create
  // wizard and immediately clicks Manage Questions, a background refetch
  // (fired from the modal's onClose) could flip `isLoading` true and the
  // Assessment loader would blank out the questions view — the user
  // reported it as "click Manage Questions, Loading Assessment shown
  // instead of loading questions". QuestionsTest owns its own loader.
  if (showQuestionsTest && selectedAssessmentForTest) {
    return (
      <QuestionsTest
        assessment={selectedAssessmentForTest}
        preloadedExercise={selectedFullExercise}
        onBack={() => { setShowQuestionsTest(false); setSelectedAssessmentForTest(null); setSelectedFullExercise(null); refetchExercises(); }}
        nodeId={nodeId} nodeName={nodeName} subcategory={subcategory}
        nodeType={nodeType} tabType="You_Do" hierarchyData={hierarchyData}
      />
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-16" style={{ background: T.bg }}>
        <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: T.blue, borderTopColor: 'transparent' }} />
        <p className="text-xs mt-3" style={{ color: T.textMuted }}>Loading Assessment…</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ fontFamily: "'Poppins','Poppins',-apple-system,sans-serif", background: T.bg }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap');`}</style>

      {/* ── Header bar ── */}
      <div className="flex-shrink-0" style={{ background: T.bg, borderBottom: `1px solid ${T.border}` }}>

        {/* ── Mock / Final test tabs — student-only ── */}
        {isStudentView && (
        <div className="flex items-end gap-1 px-4" style={{ borderBottom: `1px solid ${T.border}` }}>
          {([
            { key: 'mock', label: 'Mock Test', meta: TEST_TYPE_META.mock },
            { key: 'final', label: 'Final Test', meta: TEST_TYPE_META.final },
          ] as const).map(t => {
            const active = activeTestTab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setActiveTestTab(t.key)}
                className="flex items-center gap-1.5 px-3 py-2 text-[12px] transition-all"
                style={{
                  color: active ? t.meta.color : T.textMuted,
                  fontWeight: active ? 700 : 500,
                  background: 'transparent', border: 'none', cursor: 'pointer',
                  borderBottom: `2px solid ${active ? t.meta.color : 'transparent'}`,
                  marginBottom: -1,
                }}
                onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.color = T.textSub; }}
                onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.color = T.textMuted; }}
              >
                {t.label}
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                  style={{ background: active ? t.meta.bg : T.pageBg, color: active ? t.meta.color : T.textMuted }}>
                  {tabCounts[t.key]}
                </span>
              </button>
            );
          })}
        </div>
        )}

        {/* ── Toolbar — Client Management pattern: h-8 tokened controls,
            search on the left, secondary tools on the right pushed via
            ml-auto, primary action separated by a slim vertical divider.
            Same shape We_Do assignments and every other admin list use. */}
        <div className="px-3 sm:px-4 md:px-6 pt-3 pb-2 flex items-center gap-2 flex-wrap min-w-0">
          {/* Search */}
          <div className="relative flex-1 min-w-[220px] max-w-md">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-faint pointer-events-none" />
            <input
              placeholder="Search assessments…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="h-8 w-full pl-8 pr-8 rounded-control border border-hairline-strong bg-surface text-xs text-body placeholder:text-faint focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/15 transition-colors duration-150"
            />
            {searchQuery && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex size-5 items-center justify-center rounded-chip text-faint hover:bg-ink-100 hover:text-heading transition-colors duration-150"
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* Status filter — brand-wash active state matches CM */}
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className={`h-8 rounded-control border border-hairline-strong bg-surface px-2.5 text-xs font-medium text-body focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15 transition-colors duration-150 ${filterStatus ? 'border-brand bg-brand-wash text-brand-strong' : ''}`}
            style={{ minWidth: 120 }}
          >
            <option value="">All Status</option>
            <option value="complete">Complete</option>
            <option value="incomplete">Incomplete</option>
          </select>

          {/* Secondary cluster — pushed right */}
          <div className="ml-auto flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => refetchExercises()}
              title="Refresh"
              className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-control border border-hairline-strong bg-surface text-xs font-medium text-body hover:bg-row-hover hover:text-heading transition-colors duration-150"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isExercisesFetching ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>

          {/* Divider before primary — matches CM/We_Do */}
          <span className="hidden sm:inline-block h-5 w-px bg-hairline-strong mx-0.5" aria-hidden />

          {/* Create Assessment — primary */}
          <button
            type="button"
            onClick={() => { setEditingAsm(null); setShowModal(true); }}
            className="inline-flex items-center gap-1.5 h-8 px-3.5 rounded-control bg-brand-strong text-white shadow-sm hover:bg-brand-800 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30 flex-shrink-0"
          >
            <Plus size={14} strokeWidth={2.4} />
            <span className="text-xs font-semibold">Create Assessment</span>
          </button>
        </div>

        {/* Active search chip — same design as We_Do assignments so both
            listings read as one system. */}
        {searchQuery && (
          <div className="flex items-center gap-2 px-3 sm:px-4 md:px-6 pb-2 flex-wrap min-w-0">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-brand-strong">Filtering:</span>
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="inline-flex items-center gap-1 h-6 px-2 rounded-full border border-brand-500/30 bg-brand-wash text-2xs font-medium text-brand-strong hover:bg-brand-100 transition-colors duration-150"
            >
              "{searchQuery}" <X size={11} />
            </button>
            <span className="text-2xs ml-auto text-subtle tabular-nums">
              {filtered.length} result{filtered.length !== 1 ? 's' : ''}
            </span>
          </div>
        )}
      </div>

      {/* ── Body ── flex column so the row region can flex-1 while the
          pagination footer keeps its natural height pinned at the bottom.
          Previously the whole body was `overflow-y-auto` with the footer
          inline, so with few rows the pager rode up under the last row
          instead of sitting at the workspace edge. */}
      <div className="flex-1 min-h-0 flex flex-col">

        {error && (
          <div className="mx-4 mt-4 p-3 rounded-lg text-center flex-shrink-0" style={{ background: '#fee2e2', color: '#dc2626' }}>
            <p className="text-sm font-medium">{error}</p>
            <button onClick={() => refetchExercises()} className="mt-2 text-xs font-semibold underline">Try Again</button>
          </div>
        )}

        {/* Scroll region — takes all remaining space; only the rows scroll. */}
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden" style={{ scrollbarWidth: "thin", scrollbarColor: `${T.border} transparent` }}>

        {/* {assessments.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 pb-0">
            {stats.map((s, i) => (
              <div key={i} className="p-4 rounded-2xl" style={{ background: T.bg, border: `1px solid ${T.border}`, transition: "all 0.18s" }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = `0 4px 16px ${s.color}18`; (e.currentTarget as HTMLElement).style.borderColor = `${s.color}30`; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = "none"; (e.currentTarget as HTMLElement).style.borderColor = T.border; }}
              >
                <div className="w-7 h-7 rounded-lg flex items-center justify-center mb-2" style={{ background: `${s.color}12`, color: s.color }}>{s.icon}</div>
                <div className="text-[17px] font-extrabold" style={{ color: T.textMain }}>{s.value}</div>
                <div className="text-[10px] font-medium mt-0.5" style={{ color: T.textMuted }}>{s.label}</div>
              </div>
            ))}
          </div>
        )} */}

        {/* ── Table — DataTable rhythm on tokens (h-8 canvas header +
            hairline dividers). Card chrome dropped to match CM's flat
            panel; horizontal gutter comes from the surrounding wrapper. */}
        <div className="px-3 sm:px-4 md:px-6">

          {/* Header row — h-8 bg-canvas, uppercase text-subtle labels */}
          <div style={rowBase} className="h-8 border-b border-hairline bg-canvas">
            {["Assessment ID", "Assessment Name", "Test Type", "Created", "Level", "Status", "Actions"].map(h => (
              <div key={h} className="text-[10px] font-semibold uppercase tracking-wider text-subtle">{h}</div>
            ))}
          </div>

          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center" style={{ animation: "asmFadeIn 0.3s ease-out both" }}>
              <div className="relative w-14 h-14 rounded-2xl flex items-center justify-center mb-4" style={{ background: T.blueLight, border: `1.5px dashed ${T.blue}40` }}>
                <FileText size={22} style={{ color: T.blue }} strokeWidth={1.5} />
                <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center" style={{ background: T.blue, color: "#fff" }}><Plus size={10} strokeWidth={3} /></div>
              </div>
              <p className="text-[14px] font-bold mb-1" style={{ color: T.textMain }}>
                No {isStudentView ? (activeTestTab === 'final' ? 'Final ' : 'Mock ') : ''}Tests Yet
              </p>
              <p className="text-[11px] font-medium mb-5 max-w-[220px] leading-relaxed" style={{ color: T.textMuted }}>
                Create your first {isStudentView ? (activeTestTab === 'final' ? 'final ' : 'mock ') : ''}test to start evaluating students.
              </p>
              <button
                onClick={() => { setEditingAsm(null); setShowModal(true); }}
                className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-[11px] font-bold text-white"
                style={{ background: T.blue, boxShadow: `0 4px 12px ${T.blueGlow}`, transition: "all 0.18s" }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = T.blueDark; (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = T.blue; (e.currentTarget as HTMLElement).style.transform = "none"; }}
              >
                <Plus size={12} strokeWidth={2.5} />Create Assessment
              </button>
            </div>
          ) : (
            <>
              {currentAssessments.map((asm, idx) => {
                const tm = TEST_TYPE_META[asm.testType] ?? TEST_TYPE_META.mock;
                const rawEx = rawExercises.find((e: any) => (e._id || e.id) === (asm._id || asm.id));
                const complete = isAssessmentComplete(rawEx);
                const isLast = idx === currentAssessments.length - 1;

                const isHighlighted = highlightExerciseId && (asm._id === highlightExerciseId || asm.id === highlightExerciseId);
                return (
                  <div
                    key={asm._id || asm.id || `row-${idx}`}
                    // h-11 hairline-bounded row on tokens — same rhythm as
                    // Client Management. Highlight state still uses the
                    // brand-wash tint the search-jump animation expects.
                    className={`${isLast ? '' : 'border-b border-hairline'} ${isHighlighted ? 'bg-brand-wash' : 'bg-surface hover:bg-row-hover'} transition-colors duration-150`}
                    style={{ ...rowBase, height: 44, animation: isHighlighted ? 'asmRowFlash 2.2s ease-out 1' : undefined }}
                  >
                    {/* Assessment ID */}
                    <div className="min-w-0">
                      <span className="text-[11px] font-mono truncate block" style={{ color: '#64748b' }}>{asm.id}</span>
                    </div>

                    {/* Name + approval status pill (visible to the creator
                        until the workflow finishes; hidden once studentVisible=true
                        wins over on the server and overallStatus === 'approved'
                        keeps the pill in place as a subtle green marker). */}
                    <div className="min-w-0 flex items-center gap-2">
                      <span className="text-[12px] font-semibold truncate" style={{ color: T.textMain }}>{asm.name}</span>
                      {asm.approvalStatus && (() => {
                        const isReRequest = asm.approvalStatus === 'in_progress' && asm.resubmissionCount > 0;
                        const meta = asm.approvalStatus === 'approved'
                          ? { label: 'Approved', color: '#059669', bg: 'rgba(5,150,105,0.10)' }
                          : asm.approvalStatus === 'rejected'
                            ? { label: 'Rejected', color: '#dc2626', bg: 'rgba(220,38,38,0.10)' }
                            : isReRequest
                              ? { label: asm.approvalStepRole ? `Re-requested · ${asm.approvalStepRole}` : 'Re-requested', color: '#6d28d9', bg: 'rgba(109,40,217,0.10)' }
                              : { label: asm.approvalStepRole ? `Waiting: ${asm.approvalStepRole}` : 'Waiting Approval', color: '#b45309', bg: 'rgba(245,158,11,0.12)' };
                        return (
                          <span
                            title={
                              asm.approvalStatus === 'in_progress'
                                ? `${isReRequest ? 'Approval re-requested' : 'Pending approval'}${asm.approvalStepRole ? ` from ${asm.approvalStepRole}` : ''} — students cannot see this yet.`
                                : asm.approvalStatus === 'approved'
                                  ? 'Approved — visible to students.'
                                  : 'Rejected — not visible to students.'
                            }
                            style={{
                              display: 'inline-flex', alignItems: 'center', gap: 4,
                              padding: '2px 7px', borderRadius: 999,
                              fontSize: 9, fontWeight: 700, whiteSpace: 'nowrap',
                              background: meta.bg, color: meta.color,
                              flexShrink: 0,
                            }}
                          >
                            <Clock size={9} strokeWidth={2.5} />
                            {meta.label}
                          </span>
                        );
                      })()}
                    </div>

                    {/* Test Type — plain text */}
                    <div>
                      <span className="text-[11px] font-medium" style={{ color: T.textSub }}>{tm.label}</span>
                    </div>

                    {/* Created */}
                    <div className="flex items-center gap-1.5" style={{ fontSize: 11, fontWeight: 500, color: '#475569' }}>
                      <Calendar size={11} style={{ color: '#bcbccc', flexShrink: 0 }} />
                      <span>{asm.createdAt ? new Date(asm.createdAt).toLocaleDateString('en-GB') : '—'}</span>
                    </div>

                    {/* Level — plain text */}
                    <div>
                      <span className="text-[11px] font-medium capitalize" style={{ color: T.textSub }}>
                        {asm.level}
                      </span>
                    </div>

                    {/* Status — Complete / Incomplete badge */}
                    <div>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 5,
                        padding: '3px 8px', borderRadius: 6,
                        fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap',
                        background: complete ? 'rgba(34,197,94,0.08)' : 'rgba(242,119,87,0.08)',
                        color: complete ? '#16a34a' : '#e0623f',
                        border: `1px solid ${complete ? 'rgba(34,197,94,0.2)' : 'rgba(242,119,87,0.2)'}`,
                      }}>
                        {complete
                          ? <CheckCircle size={12} strokeWidth={2.5} style={{ color: '#22c55e', flexShrink: 0 }} />
                          : <AlertTriangle size={12} strokeWidth={2.5} style={{ color: '#F27757', flexShrink: 0 }} />
                        }
                        <span>{complete ? 'Complete' : 'Incomplete'}</span>
                      </span>
                    </div>

                    {/* ── CHANGED: Actions — portal-based dropdown ── */}
                    <div className="flex items-center justify-end asm-dd">
                      <button
                        type="button"
                        onClick={e => toggleDrop(asm.id, e)}
                        className="p-1.5 rounded-lg"
                        style={{ color: T.textHint, transition: "all 0.12s" }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = T.pageBg; (e.currentTarget as HTMLElement).style.color = T.textMain; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = T.textHint; }}
                      >
                        <MoreVertical size={13} />
                      </button>

                      {openDrop?.id === asm.id && (
                        <PortalDropMenu anchorEl={openDrop.el} onClose={() => setOpenDrop(null)}>
                          {/* Dashboard — first item so trainers can jump to
                              live monitoring / reports for the assessment
                              directly from the row. Deep-links with the same
                              context payload the other row actions use so the
                              Live Dashboard page can scope itself correctly. */}
                          {/* Every ordinary menu row now inherits the default
                              neutral text tone (T.textSub) so Dashboard, Manage
                              Questions, Manage Users, Edit and Request Approval
                              all read as one consistent menu. Only Delete keeps
                              a semantic red — destructive action stays visually
                              distinct. */}
                          {/* Dashboard is gated on `hasParticipants` — the
                              server flips this true the moment ANY student
                              joins the test (an ExamSession row exists), and
                              never unsets it, so the entry appears exactly
                              when it becomes useful and stays visible for the
                              rest of the assessment's life. Nothing to
                              dashboard when no student has ever started. */}
                          {/* Dashboard + Grade are gated on the SAME
                              `hasParticipants` flag and paired as sibling
                              menu items — one conditional block so it's
                              impossible for one to appear without the
                              other. Server flips hasParticipants true the
                              moment any student has an ExamSession row and
                              never unsets it. */}
                          {asm.hasParticipants && (
                            <>
                              <DropItem
                                icon={<LayoutDashboard size={11} />} label="Dashboard"
                                onClick={() => {
                                  setOpenDrop(null);
                                  const q = new URLSearchParams({
                                    exerciseId: asm._id || asm.id || '',
                                    assessmentId: asm._id || asm.id || '',
                                    assessmentName: asm.name || '',
                                    nodeId: nodeId || '',
                                    nodeType: nodeType || '',
                                    subcategory: subcategoryLabel || subcategory || '',
                                    courseId: courseId || '',
                                    moduleName: hierarchyData?.moduleName || '',
                                    submoduleName: hierarchyData?.submoduleName || '',
                                    topicName: hierarchyData?.topicName || nodeName || '',
                                    subtopicName: hierarchyData?.subtopicName || '',
                                    tabType: 'You_Do',
                                  }).toString();
                                  router.push(`${sectionHref("liveDashboard")}?${q}`);
                                }}
                              />
                              <DropItem
                                icon={<GraduationCap size={11} />} label="Grade"
                                onClick={() => {
                                  setOpenDrop(null);
                                  if (!courseId) {
                                    toast.error('Course context is missing — cannot open the grades view for this assessment.');
                                    return;
                                  }
                                  const here = typeof window !== 'undefined'
                                    ? `${window.location.pathname}${window.location.search}${window.location.hash}`
                                    : '';
                                  const q = new URLSearchParams({
                                    exerciseId: asm._id || asm.id || '',
                                    openTab: 'students',
                                    ...(here ? { returnTo: here } : {}),
                                  }).toString();
                                  router.push(`/lms/pages/grades/${courseId}?${q}`);
                                }}
                              />
                            </>
                          )}
                          {/* "Review Submission" entry removed: the review-submission
                              page is being repurposed for per-student grading
                              triggered from the Live Dashboard's StudentRow
                              "Check Answers" menu item, so the courses-page
                              dropdown shouldn't lead to the (now bypassed)
                              participants-list view. */}
                          {/* Manage Questions — shown whenever the assessment
                              has already been through the question-setup
                              step of the wizard (has questions saved, or is
                              section-based with sections defined). The
                              earlier `{complete && ...}` gate over-hid the
                              row: `isAssessmentComplete(rawEx)` requires
                              schedule + marks + question counts to all
                              agree, and returned false on some rows the
                              user considered "done" (e.g. approvalScope =
                              settings_and_questions with the question set
                              still empty). Fall back to the raw-exercise
                              lookup because `asm` is the slim view record
                              and its `questions` field is a number, not the
                              full array. */}
                          {(
                            complete
                              || (asm.questions ?? 0) > 0
                              || (rawEx?.sectionConfigs && Object.keys(rawEx.sectionConfigs).length > 0)
                              || (Array.isArray(rawEx?.questions) && rawEx.questions.length > 0)
                          ) && (
                            <DropItem
                              icon={<Settings size={11} />} label="Manage Questions"
                              onClick={() => handleManageQuestion(asm)}
                            />
                          )}
                          <DropItem
                            icon={<Users size={11} />} label="Manage Users"
                            onClick={() => {
                              setOpenDrop(null);
                              // Manage Users now houses the live-dashboard controls
                              // too (Reports, Message All, Live Screens, per-row
                              // Check Answer / Send Message), so it needs the full
                              // hierarchy context — not just courseId/moduleName —
                              // to build the deep links into reviewSubmission /
                              // liveScreens / liveDashboard (Reports view).
                              const q = new URLSearchParams({
                                exerciseId: asm._id || asm.id || '',
                                assessmentId: asm._id || asm.id || '',
                                assessmentName: asm.name || '',
                                nodeId: nodeId || '',
                                nodeType: nodeType || '',
                                subcategory: subcategoryLabel || subcategory || '',
                                courseId: courseId || '',
                                moduleName: hierarchyData?.moduleName || '',
                                submoduleName: hierarchyData?.submoduleName || '',
                                topicName: hierarchyData?.topicName || nodeName || '',
                                subtopicName: hierarchyData?.subtopicName || '',
                                tabType: 'You_Do',
                              }).toString();
                              router.push(`${sectionHref("manageUsers")}?${q}`);
                            }}
                          />
                          <DropItem
                            icon={<Edit2 size={11} />} label="Edit"
                            onClick={() => handleEdit(asm)}
                          />
                          {asm.approvalStatus === "rejected" && (
                            <DropItem
                              icon={<AlertTriangle size={11} />}
                              label="See rejection"
                              color="#dc2626"
                              onClick={() => { setOpenDrop(null); setRejectionViewer(asm); }}
                            />
                          )}
                          {(asm.approvalStatus === "rejected" || asm.hasRejectedQuestions) && (
                            <DropItem
                              icon={<RefreshCw size={11} className={resubmittingId === (asm._id || asm.id) ? "animate-spin" : ""} />}
                              label={resubmittingId === (asm._id || asm.id) ? "Requesting…" : "Request Approval"}
                              onClick={() => { if (!resubmittingId) handleResubmit(asm); }}
                            />
                          )}
                          <DropItem
                            icon={<Trash2 size={11} />} label="Delete"
                            color="#ef4444" divider
                            onClick={() => openDeleteModal(asm.id, asm.name, asm._id)}
                          />
                        </PortalDropMenu>
                      )}
                    </div>
                  </div>
                );
              })}

            </>
          )}
        </div>
        </div>{/* /scroll region */}

        {/* Pagination — pinned OUTSIDE the scroll region so it always sits
            at the workspace's bottom edge, regardless of how many rows are
            loaded. `flex-shrink-0` keeps it out of the flex-1 space above. */}
        {filtered.length > 0 && (
          <div className="flex-shrink-0 border-t border-hairline bg-surface px-3 sm:px-4 md:px-6">
            <TableFooter
              from={filtered.length === 0 ? 0 : (currentPage - 1) * ITEMS_PER_PAGE + 1}
              to={Math.min(currentPage * ITEMS_PER_PAGE, filtered.length)}
              total={filtered.length}
              pageSize={ITEMS_PER_PAGE}
              onPageSize={() => { /* ITEMS_PER_PAGE is a constant here — page size is fixed for now. */ }}
              currentPage={currentPage}
              totalPages={totalPages || 1}
              onPage={(p) => setCurrentPage(Math.min(Math.max(1, p), totalPages || 1))}
            />
          </div>
        )}
      </div>

      {/* ── Modals ── */}
      {showModal && (
        <CreateAssessmentModal
          // Refetch on close too: per-step "Save" persists via updateYouDoExercise
          // but doesn't call onSave (only "Save & Finish" does). Without this, the
          // React Query cache stays stale and a Save-then-Close shows the old data.
          onClose={async () => { setShowModal(false); setEditingAsm(null); await refetchExercises(); }}
          onSave={handleSave}
          nodeId={nodeId} nodeName={nodeName} nodeType={nodeType}
          subcategory={subcategory} courseId={courseId} hierarchyData={hierarchyData}
          configuredLanguages={configuredLanguages}
          isEditing={!!editingAsm}
          defaultTestType={activeTestTab}
          exercise_Id={editingAsm?._id || editingAsm?.id}
          exerciseData={
            editingAsm
              ? rawExercises.find(e => (e._id || e.id) === (editingAsm._id || editingAsm.id))
              : undefined
          }
          tabType="You_Do"
        />
      )}

      <DeleteConfirmModal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, id: "", name: "", _id: undefined })}
        onConfirm={handleDelete}
        assessmentName={deleteModal.name}
        isDeleting={isDeleting}
      />

      {/* Overlay while Manage Test / Add Question fetches the full exercise.
          Same branded SmartCliff loader used across the app so the trainer
          gets consistent "please wait" feedback — no more mystery pause and
          no bespoke small spinner. */}
      {loadingFullExercise && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.62)', backdropFilter: 'blur(4px)' }}>
          <SmartCliffRingLoader title="Loading" subtitle="Just a moment..." entrance={false} />
        </div>
      )}

      {addQ.step === 'section' && addQ.exercise && (
        <SectionPickerModal
          exercise={addQ.exercise}
          onClose={closeAddQ}
          onPick={(sectionCfg, sectionMeta) => {
            const merged = { ...sectionCfg, ...sectionMeta };
            if ((sectionCfg.exerciseType || '').toLowerCase() === 'combined') setAddQ(prev => ({ ...prev, step: 'type', section: merged }));
            else setAddQ(prev => ({ ...prev, step: 'form', section: merged }));
          }}
        />
      )}

      {addQ.step === 'type' && addQ.section && (
        <TypePickerModal
          section={addQ.section}
          onClose={closeAddQ}
          onBack={() => setAddQ(prev => ({ ...prev, step: 'section', section: undefined, questionType: undefined }))}
          onPick={(type) => setAddQ(prev => ({ ...prev, step: 'form', questionType: type }))}
        />
      )}

      {addQ.step === 'form' && (() => {
        const exData = buildAddQExerciseData();
        if (!exData) return null;
        return (
          <AddQuestionForm
            key={`addq-${exData.exerciseId}-${addQ.section?.id || 'no-section'}-${addQ.questionType || ''}`}
            exerciseData={exData}
            tabType="You_Do"
            sectionData={addQ.section}
            onClose={async () => { closeAddQ(); await refetchExercises(); }}
            onSave={async () => { await refetchExercises(); }}
            showTypeSelector={(exData.exerciseType || '').toLowerCase() === 'combined'}
            shouldRefreshOnMount={true}
          />
        );
      })()}

      {/* Rejection message viewer — shown when the trainer clicks "See rejection". */}
      {rejectionViewer && (
        <div className="fixed inset-0 flex items-center justify-center z-[1000]" style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden" style={{ boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
            <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: T.border }}>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: T.redLight }}>
                  <AlertTriangle size={16} style={{ color: T.red }} />
                </div>
                <h3 className="text-base font-bold" style={{ color: T.textMain }}>Rejection message</h3>
              </div>
              <button onClick={() => setRejectionViewer(null)} className="p-1 rounded-lg hover:bg-gray-100 transition-colors">
                <X size={16} style={{ color: T.textMuted }} />
              </button>
            </div>
            <div className="p-5">
              <p className="text-xs uppercase tracking-wide font-semibold mb-1" style={{ color: T.textMuted }}>
                Rejected by {rejectionViewer.rejectedByRole || 'approver'}
              </p>
              <p className="text-sm font-semibold mb-3" style={{ color: T.textMain }}>{rejectionViewer.name}</p>
              <div className="p-3 rounded-lg text-sm whitespace-pre-wrap" style={{ background: 'rgba(245,158,11,0.08)', color: T.textMain, border: `1px solid rgba(245,158,11,0.2)` }}>
                {rejectionViewer.rejectionMessage || '(no message provided)'}
              </div>
              <p className="text-xs mt-3" style={{ color: T.textMuted }}>
                Edit the assessment to address the feedback, then use "Request Approval" in the row menu — it goes back through the chain as a re-request.
              </p>
            </div>
            <div className="flex items-center justify-end gap-3 p-4 border-t" style={{ borderColor: T.border, background: T.pageBg }}>
              <button
                onClick={() => setRejectionViewer(null)}
                className="px-4 py-2 rounded-lg text-sm font-semibold transition-all"
                style={{ color: T.textSub, background: T.bg, border: `1px solid ${T.border}` }}
              >
                Close
              </button>
              <button
                onClick={() => { const target = rejectionViewer; setRejectionViewer(null); handleEdit(target); }}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition-all flex items-center gap-2"
                style={{ background: T.blue }}
              >
                <Edit2 size={14} />
                Edit assessment
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes asmFadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes asmRowFlash {
          0%   { background: rgba(99,102,241,0.20); }
          40%  { background: rgba(99,102,241,0.12); }
          100% { background: rgba(99,102,241,0.06); }
        }
      `}</style>
    </div>
  );
}