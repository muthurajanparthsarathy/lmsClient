'use client';

import React, { useState } from 'react';
import { Zap } from 'lucide-react';
import { RerunDialog, RerunDialogProps } from './RerunDialog';

type RerunButtonProps = Omit<RerunDialogProps, 'open' | 'onClose'> & {
  variant?: 'primary' | 'ghost' | 'icon';
  label?: string;
  title?: string;
  className?: string;
};

/**
 * Drop-in Rerun button. Handles its own dialog state.
 * - variant "primary": header CTA (orange filled)
 * - variant "ghost":   toolbar action (bordered white)
 * - variant "icon":    per-row compact icon
 */
export function RerunButton({
  variant = 'ghost',
  label = 'Rerun',
  title,
  className,
  onCompleted,
  ...dialogProps
}: RerunButtonProps) {
  const [open, setOpen] = useState(false);

  const base: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    fontFamily: "'Poppins','Inter',sans-serif",
    fontWeight: 600, cursor: 'pointer',
    transition: 'background-color 120ms, box-shadow 120ms, color 120ms',
  };
  const styleFor = (): React.CSSProperties => {
    if (variant === 'primary') {
      return {
        ...base,
        padding: '8px 14px', borderRadius: 8,
        background: 'linear-gradient(135deg, #E8640C, #C8520A)',
        color: '#fff', fontSize: 12.5, border: 'none',
        boxShadow: '0 4px 12px rgba(232,100,12,0.24)',
      };
    }
    if (variant === 'icon') {
      return {
        ...base,
        width: 30, height: 30, borderRadius: 8,
        justifyContent: 'center',
        background: '#fff', color: '#E8640C',
        border: '1px solid #f2d2b8',
      };
    }
    return {
      ...base,
      padding: '7px 12px', borderRadius: 8,
      background: '#fff', color: '#334155', fontSize: 12,
      border: '1px solid #e5e7eb',
    };
  };

  return (
    <>
      <button
        type="button"
        className={className}
        style={styleFor()}
        title={title || 'Re-run scoring against current test cases'}
        onClick={(e) => { e.stopPropagation(); setOpen(true); }}
      >
        <Zap size={variant === 'icon' ? 14 : 13} />
        {variant !== 'icon' && label}
      </button>
      <RerunDialog
        {...dialogProps}
        open={open}
        onClose={() => setOpen(false)}
        onCompleted={onCompleted}
      />
    </>
  );
}
