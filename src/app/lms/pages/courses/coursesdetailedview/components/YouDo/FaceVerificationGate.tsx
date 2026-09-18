'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Camera, CameraOff, CheckCircle, AlertCircle, Loader2, UserCheck } from 'lucide-react';

interface FaceVerificationGateProps {
  isOpen: boolean;
  onVerified: () => void;
  onCancel: () => void;
  theme?: 'light' | 'dark';
}

/**
 * Shows a live camera feed and requires the student to confirm their face
 * is visible before the assessment starts.
 *
 * Key fix: the <video> element is ALWAYS in the DOM so videoRef is never null.
 * srcObject is assigned in a dedicated useEffect that runs after the stream
 * is stored in state (i.e. after React has rendered the video element).
 */
const FaceVerificationGate: React.FC<FaceVerificationGateProps> = ({
  isOpen,
  onVerified,
  onCancel,
  theme = 'light',
}) => {
  const videoRef  = useRef<HTMLVideoElement>(null);

  // Store stream in state so the srcObject effect fires after render
  const [stream,   setStream]   = useState<MediaStream | null>(null);
  const [status,   setStatus]   = useState<'requesting' | 'ready' | 'error'>('requesting');
  const [errorMsg, setErrorMsg] = useState('');

  // ── 1. Request camera when gate opens ────────────────────────────────────
  useEffect(() => {
    if (!isOpen) {
      stream?.getTracks().forEach(t => t.stop());
      setStream(null);
      setStatus('requesting');
      setErrorMsg('');
      return;
    }

    setStatus('requesting');
    setErrorMsg('');

    let cancelled = false;
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'user', width: 640, height: 480 }, audio: false })
      .then(s => {
        if (cancelled) { s.getTracks().forEach(t => t.stop()); return; }
        setStream(s);   // triggers re-render → video element becomes visible
        setStatus('ready');
      })
      .catch(err => {
        if (cancelled) return;
        console.error('FaceVerificationGate camera error:', err);
        setErrorMsg(
          err?.name === 'NotAllowedError'
            ? 'Camera permission was denied. Please allow camera access in your browser settings and try again.'
            : 'Could not access camera. Please ensure a camera is connected and try again.'
        );
        setStatus('error');
      });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // ── 2. Assign stream to <video> AFTER it is in the DOM ───────────────────
  // Runs whenever stream or status changes — by then the video element
  // with ref={videoRef} is guaranteed to be mounted.
  useEffect(() => {
    if (!videoRef.current || !stream) return;
    if (videoRef.current.srcObject === stream) return; // already set
    videoRef.current.srcObject = stream;
    videoRef.current.play().catch(() => {});
  }, [stream, status]);

  // ── 3. Clean up on unmount ────────────────────────────────────────────────
  useEffect(() => {
    return () => { stream?.getTracks().forEach(t => t.stop()); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleProceed = () => {
    stream?.getTracks().forEach(t => t.stop());
    setStream(null);
    onVerified();
  };

  const handleCancel = () => {
    stream?.getTracks().forEach(t => t.stop());
    setStream(null);
    onCancel();
  };

  if (!isOpen) return null;

  const isDark = theme === 'dark';

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 99999,
      background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }}>
      <div style={{
        background: isDark ? '#1e2028' : '#fff',
        borderRadius: 18,
        boxShadow: '0 24px 64px rgba(0,0,0,0.28)',
        width: '100%', maxWidth: 520,
        padding: 28,
        fontFamily: "'Poppins', -apple-system, sans-serif",
        color: isDark ? '#e2e8f0' : '#111827',
      }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12,
            background: 'rgba(99,102,241,0.12)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <UserCheck size={22} style={{ color: '#6366f1' }} />
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800 }}>Face Verification Required</div>
            <div style={{ fontSize: 12, color: isDark ? '#94a3b8' : '#6b7280', marginTop: 2 }}>
              Camera access is mandatory for this assessment
            </div>
          </div>
        </div>

        {/* Camera area */}
        <div style={{
          borderRadius: 12, overflow: 'hidden',
          background: isDark ? '#0f1117' : '#f1f5f9',
          aspectRatio: '4/3', position: 'relative',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: 18,
          border: `2px solid ${
            status === 'ready'  ? '#6366f1' :
            status === 'error'  ? '#ef4444' :
            isDark ? '#374151' : '#e2e8f0'
          }`,
        }}>

          {/* ── Video element is ALWAYS in the DOM ── */}
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              transform: 'scaleX(-1)', // mirror
              display: 'block',
              // Fade in once ready; never unmount
              opacity: status === 'ready' ? 1 : 0,
              transition: 'opacity 0.35s ease',
            }}
          />

          {/* Requesting overlay */}
          {status === 'requesting' && (
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              gap: 10,
              color: isDark ? '#94a3b8' : '#6b7280',
              background: isDark ? '#0f1117' : '#f1f5f9',
            }}>
              <Loader2 size={32} style={{ animation: 'fvg_spin 1s linear infinite' }} />
              <div style={{ fontSize: 13 }}>Requesting camera access…</div>
            </div>
          )}

          {/* Error overlay */}
          {status === 'error' && (
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              gap: 8, padding: '0 24px', textAlign: 'center',
              background: isDark ? '#0f1117' : '#f1f5f9',
            }}>
              <CameraOff size={36} style={{ color: '#ef4444' }} />
              <div style={{ fontSize: 13, color: '#ef4444', fontWeight: 600 }}>Camera Unavailable</div>
              <div style={{ fontSize: 12, color: isDark ? '#94a3b8' : '#6b7280', lineHeight: 1.5 }}>
                {errorMsg}
              </div>
            </div>
          )}

          {/* Live indicator — shown on top of video when ready */}
          {status === 'ready' && (
            <div style={{
              position: 'absolute', top: 10, left: 10, zIndex: 2,
              display: 'flex', alignItems: 'center', gap: 5,
              background: 'rgba(0,0,0,0.55)', borderRadius: 20,
              padding: '3px 10px',
            }}>
              <div style={{
                width: 7, height: 7, borderRadius: '50%',
                background: '#ef4444',
                animation: 'fvg_pulse 1.2s ease-in-out infinite',
              }} />
              <span style={{ fontSize: 11, color: '#fff', fontWeight: 600 }}>LIVE</span>
            </div>
          )}
        </div>

        {/* Instructions */}
        {status === 'ready' && (
          <div style={{
            background: isDark ? 'rgba(99,102,241,0.1)' : 'rgba(99,102,241,0.06)',
            border: `1px solid ${isDark ? 'rgba(99,102,241,0.3)' : 'rgba(99,102,241,0.2)'}`,
            borderRadius: 10, padding: '10px 14px',
            marginBottom: 18, display: 'flex', alignItems: 'flex-start', gap: 10,
          }}>
            <CheckCircle size={15} style={{ color: '#6366f1', marginTop: 1, flexShrink: 0 }} />
            <div style={{ fontSize: 12, color: isDark ? '#a5b4fc' : '#4338ca', lineHeight: 1.5 }}>
              Your camera is active. Please ensure your face is clearly visible and well-lit.
              The camera will remain on for the duration of the assessment for proctoring.
            </div>
          </div>
        )}

        {status === 'error' && (
          <div style={{
            background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)',
            borderRadius: 10, padding: '10px 14px',
            marginBottom: 18, display: 'flex', alignItems: 'flex-start', gap: 10,
          }}>
            <AlertCircle size={15} style={{ color: '#ef4444', marginTop: 1, flexShrink: 0 }} />
            <div style={{ fontSize: 12, color: '#dc2626', lineHeight: 1.5 }}>
              Camera access is required to start this assessment.
              You cannot proceed without camera permission.
            </div>
          </div>
        )}

        {/* Buttons */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={handleCancel}
            style={{
              flex: 1, padding: '11px 16px', borderRadius: 9,
              border: `1.5px solid ${isDark ? '#374151' : '#e5e7eb'}`,
              background: 'transparent',
              color: isDark ? '#9ca3af' : '#6b7280',
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleProceed}
            disabled={status !== 'ready'}
            style={{
              flex: 2, padding: '11px 16px', borderRadius: 9, border: 'none',
              background: status === 'ready' ? '#6366f1' : (isDark ? '#374151' : '#e5e7eb'),
              color: status === 'ready' ? '#fff' : (isDark ? '#6b7280' : '#9ca3af'),
              fontSize: 13, fontWeight: 700,
              cursor: status === 'ready' ? 'pointer' : 'not-allowed',
              fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
              transition: 'all 0.2s',
            }}
          >
            <UserCheck size={15} />
            {status === 'requesting' ? 'Waiting for camera…' :
             status === 'error'      ? 'Camera required' :
                                       'Face Verified — Start Assessment'}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes fvg_spin  { to { transform: rotate(360deg); } }
        @keyframes fvg_pulse { 0%,100%{ opacity:1; } 50%{ opacity:0.4; } }
      `}</style>
    </div>
  );
};

export default FaceVerificationGate;
