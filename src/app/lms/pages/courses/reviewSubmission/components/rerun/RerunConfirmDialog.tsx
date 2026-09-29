'use client';

// RerunConfirmDialog — the Yes / No gate that sits in front of every Rerun.
//
// Rerun overwrites stored scores for real students, so it must never fire on a
// single stray click. Both entry points on the Live Dashboard (the toolbar's
// "Rerun all" button and each row's ⋮ ▸ Rerun) open this first; only "Yes"
// opens the RerunDialog that actually loads context and executes.

import React from 'react';
import { Zap, AlertTriangle } from 'lucide-react';

export interface RerunConfirmDialogProps {
  open: boolean;
  /** Name of the single learner being rerun, when this is a per-row rerun. */
  studentName?: string;
  onYes: () => void;
  onNo: () => void;
}

export function RerunConfirmDialog({ open, studentName, onYes, onNo }: RerunConfirmDialogProps) {
  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="rerun-confirm-title"
      onClick={onNo}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(3px)',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#fff', borderRadius: 16, width: 'min(420px, 92vw)',
          boxShadow: '0 24px 48px rgba(15,23,42,0.28)', overflow: 'hidden',
          fontFamily: "'Poppins','Inter',sans-serif",
        }}
      >
        <div style={{ padding: '20px 22px 6px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10, flexShrink: 0,
            background: 'rgba(232,100,12,0.10)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <AlertTriangle size={18} style={{ color: '#E8640C' }} />
          </div>
          <div>
            <div id="rerun-confirm-title" style={{ fontSize: 15, fontWeight: 700, color: '#0F172A' }}>
              Are you sure you want to rerun?
            </div>
            <div style={{ fontSize: 12.5, color: '#64748b', marginTop: 4, lineHeight: 1.5 }}>
              {studentName
                ? <>Stored code for <strong style={{ color: '#334155' }}>{studentName}</strong> will be re-executed against the current test cases and the score overwritten.</>
                : <>Every student&apos;s stored code will be re-executed against the current test cases and their scores overwritten.</>}
              {' '}Previous scores are kept in the audit history.
            </div>
          </div>
        </div>

        <div style={{ padding: '14px 22px 18px', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button
            type="button"
            onClick={onNo}
            style={{
              padding: '8px 18px', borderRadius: 8, border: '1px solid #e5e7eb',
              background: '#fff', color: '#334155', fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
            }}
          >
            No
          </button>
          <button
            type="button"
            autoFocus
            onClick={onYes}
            style={{
              padding: '8px 18px', borderRadius: 8, border: 'none',
              background: 'linear-gradient(135deg, #E8640C, #C8520A)',
              color: '#fff', fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: 6,
              boxShadow: '0 4px 12px rgba(232,100,12,0.28)',
            }}
          >
            <Zap size={13} /> Yes
          </button>
        </div>
      </div>
    </div>
  );
}
