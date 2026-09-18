// Small confirmation / choice dialogs for the Programming form.
// Extracted 2026-08-30 from ProgrammingQuestionForm.tsx.
//
// Every dialog uses the shared `.lms-modal-backdrop` / `.lms-modal` shell so
// the visual chrome (backdrop, blur, border, radius) stays consistent — see
// `programming/styles.ts`. The DifficultyPopup + DiffSwitchDialog rely on the
// difficulty color tokens from `programming/constants.ts` (DS).

import React from 'react';
import {
  X, AlertTriangle, Settings, ArrowLeftRight, ArrowRight, Check,
  Trash2, CheckCircle2, Sparkles, ChevronRight,
} from 'lucide-react';
import type { Diff } from '../types';
import { DS } from '../constants';

export const CloseConfirmDialog: React.FC<{
  hasUnsavedChanges: boolean; hasSavedQuestions: boolean;
  onConfirm: () => void; onCancel: () => void;
}> = ({ hasUnsavedChanges, hasSavedQuestions, onConfirm, onCancel }) => (
  <div className="lms-modal-backdrop">
    <div className="lms-modal">
      <div className="lms-modal-header" style={{ background: hasUnsavedChanges ? 'var(--lms-warning-bg)' : 'var(--lms-bg-surface)' }}>
        <div className="lms-modal-icon" style={{ background: hasUnsavedChanges ? 'var(--lms-warning-bg)' : 'var(--lms-bg-surface2)', border: `1.5px solid ${hasUnsavedChanges ? 'var(--lms-warning-bdr)' : 'var(--lms-border)'}` }}>
          <X size={16} style={{ color: hasUnsavedChanges ? 'var(--lms-warning)' : 'var(--lms-text-sec)' }} />
        </div>
        <div>
          <h2 style={{ fontFamily: 'var(--lms-font)', fontSize: 14, fontWeight: 700, color: 'var(--lms-text-main)' }}>
            {hasUnsavedChanges ? 'Unsaved Changes' : 'Close Form?'}
          </h2>
          <p style={{ fontFamily: 'var(--lms-font)', fontSize: 11, color: 'var(--lms-text-muted)', marginTop: 2 }}>
            {hasUnsavedChanges ? 'You have unsaved changes' : 'Are you sure you want to close?'}
          </p>
        </div>
      </div>
      <div className="lms-modal-body">
        <p style={{ fontFamily: 'var(--lms-font)', fontSize: 12, color: 'var(--lms-text-sec)', lineHeight: 1.6 }}>
          {hasUnsavedChanges
            ? <><span>The current question has </span><strong style={{ color: 'var(--lms-warning)' }}>unsaved changes</strong><span> that will be lost if you close now.</span>{hasSavedQuestions && <span style={{ display: 'block', marginTop: 8, color: 'var(--lms-text-muted)' }}>Previously saved questions will remain intact.</span>}</>
            : hasSavedQuestions ? <>Are you sure you want to close? Your saved questions will remain intact.</>
              : <>Are you sure you want to close this form? No questions have been saved yet.</>
          }
        </p>
        {hasUnsavedChanges && (
          <div style={{ marginTop: 12, display: 'flex', alignItems: 'flex-start', gap: 8, padding: '10px 12px', background: 'var(--lms-warning-bg)', border: '1.5px solid var(--lms-warning-bdr)', borderRadius: 'var(--lms-radius-md)' }}>
            <AlertTriangle size={12} style={{ color: 'var(--lms-warning)', marginTop: 2, flexShrink: 0 }} />
            <p style={{ fontFamily: 'var(--lms-font)', fontSize: 11, color: 'var(--lms-warning)' }}>
              Tip: Click <strong>Cancel</strong> to go back and save your changes first.
            </p>
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <button onClick={onCancel} className="lms-cancel-btn" style={{ flex: 1 }}>Keep Editing</button>
          <button onClick={onConfirm} className="lms-btn lms-btn-orange" style={{ flex: 1, justifyContent: 'center', background: hasUnsavedChanges ? 'var(--lms-warning)' : 'var(--lms-text-main)', boxShadow: 'none', borderColor: 'transparent' }}>
            <X size={13} />{hasUnsavedChanges ? 'Discard & Close' : 'Yes, Close'}
          </button>
        </div>
      </div>
    </div>
  </div>
);

export const EditExerciseConfirmDialog: React.FC<{
  exerciseName?: string; onConfirm: () => void; onCancel: () => void;
}> = ({ exerciseName, onConfirm, onCancel }) => (
  <div className="lms-modal-backdrop">
    <div className="lms-modal">
      <div className="lms-modal-header" style={{ background: 'var(--lms-orange-50)', borderBottom: '1.5px solid var(--lms-orange-100)' }}>
        <div className="lms-modal-icon" style={{ background: 'var(--lms-orange-100)', border: '1.5px solid var(--lms-orange-100)' }}>
          <Settings size={16} style={{ color: 'var(--lms-orange)' }} />
        </div>
        <div>
          <h2 style={{ fontFamily: 'var(--lms-font)', fontSize: 14, fontWeight: 700, color: 'var(--lms-text-main)' }}>Edit Exercise Settings?</h2>
          <p style={{ fontFamily: 'var(--lms-font)', fontSize: 11, color: 'var(--lms-text-muted)', marginTop: 2 }}>This will close the question form</p>
        </div>
      </div>
      <div className="lms-modal-body">
        <p style={{ fontFamily: 'var(--lms-font)', fontSize: 12, color: 'var(--lms-text-sec)', lineHeight: 1.6 }}>
          Do you want to edit the settings for <strong style={{ color: 'var(--lms-text-main)' }}>"{exerciseName || 'this exercise'}"</strong>?
          <span style={{ display: 'block', marginTop: 8, color: 'var(--lms-text-muted)' }}>The question form will be closed and you'll be taken to the exercise settings. Any unsaved question changes will be lost.</span>
        </p>
        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <button onClick={onCancel} className="lms-cancel-btn" style={{ flex: 1 }}>Cancel</button>
          <button onClick={onConfirm} className="lms-btn lms-btn-ghost-orange" style={{ flex: 1, justifyContent: 'center' }}>
            <Settings size={13} /> Yes, Edit Exercise
          </button>
        </div>
      </div>
    </div>
  </div>
);

export const DiffSwitchDialog: React.FC<{
  fromDiff: Diff; toDiff: Diff; remainingInTo: number; onConfirm: (d: Diff) => void; onCancel: () => void;
}> = ({ fromDiff, toDiff, remainingInTo, onConfirm, onCancel }) => {
  const toDS = DS[toDiff]; const fromDS = DS[fromDiff];
  return (
    <div className="lms-modal-backdrop">
      <div className="lms-modal">
        <div className="lms-modal-header">
          <div className="lms-modal-icon" style={{ background: 'var(--lms-info-bg)', border: '1.5px solid var(--lms-info-bdr)' }}>
            <ArrowLeftRight size={16} style={{ color: 'var(--lms-info)' }} />
          </div>
          <div>
            <h2 style={{ fontFamily: 'var(--lms-font)', fontSize: 14, fontWeight: 700, color: 'var(--lms-text-main)' }}>Switch Difficulty?</h2>
            <p style={{ fontFamily: 'var(--lms-font)', fontSize: 11, color: 'var(--lms-text-muted)', marginTop: 2 }}>You're about to change the active difficulty</p>
          </div>
        </div>
        <div className="lms-modal-body">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderRadius: 'var(--lms-radius-md)', background: fromDS.bg, border: `1.5px solid ${fromDS.border}` }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: fromDS.dot, flexShrink: 0 }} />
              <span style={{ fontFamily: 'var(--lms-font)', fontSize: 12, fontWeight: 700, color: fromDS.text, textTransform: 'capitalize' }}>{fromDiff}</span>
              <span style={{ fontSize: 10, color: 'var(--lms-text-muted)', marginLeft: 'auto' }}>Current</span>
            </div>
            <ArrowRight size={14} style={{ color: 'var(--lms-text-hint)', flexShrink: 0 }} />
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderRadius: 'var(--lms-radius-md)', background: toDS.bg, border: `2px solid ${toDS.border}` }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: toDS.dot, flexShrink: 0 }} />
              <span style={{ fontFamily: 'var(--lms-font)', fontSize: 12, fontWeight: 700, color: toDS.text, textTransform: 'capitalize' }}>{toDiff}</span>
            </div>
          </div>
          <div style={{ padding: '10px 12px', background: 'var(--lms-bg-surface)', border: '1.5px solid var(--lms-border)', borderRadius: 'var(--lms-radius-md)' }}>
            <p style={{ fontFamily: 'var(--lms-font)', fontSize: 12, color: 'var(--lms-text-sec)', lineHeight: 1.6 }}>
              Switching to <strong style={{ color: toDS.text, textTransform: 'capitalize' }}>{toDiff}</strong>{' '}
              {remainingInTo > 0
                ? <>will start adding questions for that difficulty. <span style={{ display: 'block', marginTop: 4, color: 'var(--lms-text-muted)' }}>{remainingInTo} Question{remainingInTo !== 1 ? 's' : ''} remaining.</span></>
                : <>will take you to existing <strong style={{ color: toDS.text, textTransform: 'capitalize' }}>{toDiff}</strong> questions to review or update.</>
              }
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button onClick={() => onCancel()} className="lms-cancel-btn" style={{ flex: 1 }}>Cancel</button>
            <button onClick={() => onConfirm(toDiff)} className="lms-btn" style={{ flex: 1, justifyContent: 'center', ...toDS.solid, border: 'none', boxShadow: 'none' }}>
              <Check size={13} /> Switch to <span style={{ textTransform: 'capitalize', marginLeft: 2 }}>{toDiff}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export const DeleteConfirmDialog: React.FC<{
  questionTitle: string; onConfirm: () => void; onCancel: () => void;
}> = ({ questionTitle, onConfirm, onCancel }) => (
  <div className="lms-modal-backdrop">
    <div className="lms-modal">
      <div className="lms-modal-header" style={{ background: 'var(--lms-danger-bg)', borderBottom: '1.5px solid var(--lms-danger-bdr)' }}>
        <div className="lms-modal-icon" style={{ background: 'var(--lms-danger-bg)', border: '1.5px solid var(--lms-danger-bdr)' }}>
          <AlertTriangle size={16} style={{ color: 'var(--lms-danger)' }} />
        </div>
        <div>
          <h2 style={{ fontFamily: 'var(--lms-font)', fontSize: 14, fontWeight: 700, color: 'var(--lms-text-main)' }}>Delete Question?</h2>
          <p style={{ fontFamily: 'var(--lms-font)', fontSize: 11, color: 'var(--lms-text-muted)', marginTop: 2 }}>This action cannot be undone</p>
        </div>
      </div>
      <div className="lms-modal-body">
        <p style={{ fontFamily: 'var(--lms-font)', fontSize: 12, color: 'var(--lms-text-sec)', lineHeight: 1.6, marginBottom: 4 }}>
          Are you sure you want to delete <strong style={{ color: 'var(--lms-text-main)' }}>"{questionTitle || 'this question'}"</strong>?
        </p>
        <p style={{ fontFamily: 'var(--lms-font)', fontSize: 11, color: 'var(--lms-danger)', fontWeight: 600 }}>This will permanently remove it.</p>
        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <button onClick={onCancel} className="lms-cancel-btn" style={{ flex: 1 }}>Cancel</button>
          <button onClick={onConfirm} className="lms-btn" style={{ flex: 1, justifyContent: 'center', background: 'var(--lms-danger)', color: 'white', border: 'none', boxShadow: 'none' }}>
            <Trash2 size={13} /> Yes, Delete
          </button>
        </div>
      </div>
    </div>
  </div>
);

export const DifficultyPopup: React.FC<{
  completedDiff: Diff; availableNext: { diff: Diff; remaining: number }[];
  onSelect: (d: Diff) => void; onClose: () => void;
}> = ({ completedDiff, availableNext, onSelect, onClose }) => {
  const s = DS[completedDiff];
  return (
    <div className="lms-modal-backdrop">
      <div className="lms-modal" style={{ maxWidth: 440 }}>
        <div className="lms-modal-header" style={{ background: s.bg, borderBottom: `1.5px solid ${s.border}` }}>
          <div className="lms-modal-icon" style={{ ...s.solid }}>
            <CheckCircle2 size={18} style={{ color: 'white' }} />
          </div>
          <div>
            <h2 style={{ fontFamily: 'var(--lms-font)', fontSize: 15, fontWeight: 700, color: s.text, textTransform: 'capitalize' }}>
              {completedDiff} Questions Complete! 🎉
            </h2>
            <p style={{ fontFamily: 'var(--lms-font)', fontSize: 11, color: 'var(--lms-text-muted)', marginTop: 2 }}>All slots for this difficulty are filled.</p>
          </div>
        </div>
        <div className="lms-modal-body">
          {availableNext.length > 0 ? (
            <>
              <p style={{ fontFamily: 'var(--lms-font)', fontSize: 13, fontWeight: 600, color: 'var(--lms-text-main)', marginBottom: 10 }}>Choose next difficulty to continue:</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {availableNext.map(({ diff, remaining }) => {
                  const ds = DS[diff];
                  return (
                    <button key={diff} onClick={() => onSelect(diff)}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderRadius: 'var(--lms-radius-md)', border: `2px solid ${ds.border}`, background: ds.bg, cursor: 'pointer', fontFamily: 'var(--lms-font)', transition: 'all 0.15s' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: ds.dot }} />
                        <span style={{ fontFamily: 'var(--lms-font)', fontSize: 13, fontWeight: 700, color: ds.text, textTransform: 'capitalize' }}>{diff}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ ...ds.pill, fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20 }}>{remaining} remaining</span>
                        <ChevronRight size={13} style={{ color: ds.text }} />
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <Sparkles size={28} style={{ color: 'var(--lms-success)', margin: '0 auto 8px' }} />
              <p style={{ fontFamily: 'var(--lms-font)', fontSize: 14, fontWeight: 700, color: 'var(--lms-text-main)' }}>All difficulties complete!</p>
              <p style={{ fontFamily: 'var(--lms-font)', fontSize: 12, color: 'var(--lms-text-muted)', marginTop: 4 }}>All question slots have been filled.</p>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
            <button onClick={onClose} className="lms-cancel-btn">{availableNext.length === 0 ? 'Close' : 'Cancel'}</button>
            {availableNext.length === 0 && (
              <button onClick={onClose} className="lms-btn lms-btn-orange">
                <Check size={13} /> Done
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
