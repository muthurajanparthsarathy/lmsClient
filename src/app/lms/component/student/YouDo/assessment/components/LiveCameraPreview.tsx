'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Camera, CameraOff, Minus } from 'lucide-react';

interface LiveCameraPreviewProps {
  /** Show the preview only when the assessment is active */
  isActive: boolean;
  /** Which corner to anchor to */
  corner?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
}

/**
 * Floating live camera preview shown to the student during the assessment.
 * Used when enableFaceVerification is true.
 *
 * Key implementation note:
 * The <video> element is ALWAYS in the DOM (never conditionally rendered).
 * srcObject is assigned in a dedicated useEffect that runs AFTER the stream
 * is stored in state, guaranteeing videoRef.current is not null.
 */
const LiveCameraPreview: React.FC<LiveCameraPreviewProps> = ({
  isActive,
  corner = 'bottom-right',
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  // Store the stream in state so the srcObject-assignment effect
  // fires AFTER the video element is in the DOM
  const [stream,    setStream]    = useState<MediaStream | null>(null);
  const [status,    setStatus]    = useState<'idle' | 'starting' | 'active' | 'error'>('idle');
  const [minimised, setMinimised] = useState(false);

  // ── 1. Request camera when isActive becomes true ──────────────────────────
  useEffect(() => {
    if (!isActive) {
      // Stop and clean up
      stream?.getTracks().forEach(t => t.stop());
      setStream(null);
      setStatus('idle');
      return;
    }

    setStatus('starting');

    let cancelled = false;
    navigator.mediaDevices
      .getUserMedia({ video: { width: 640, height: 480, facingMode: 'user' }, audio: false })
      .then(s => {
        if (cancelled) { s.getTracks().forEach(t => t.stop()); return; }
        setStream(s);
        setStatus('active');
      })
      .catch(err => {
        if (!cancelled) {
          console.warn('LiveCameraPreview: camera error', err);
          setStatus('error');
        }
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive]);

  // ── 2. Assign stream to the <video> element AFTER it has rendered ─────────
  // This effect runs whenever `stream` or `status` changes.
  // By the time status === 'active', the video element is in the DOM.
  useEffect(() => {
    if (!videoRef.current || !stream) return;
    if (videoRef.current.srcObject === stream) return; // already assigned
    videoRef.current.srcObject = stream;
    videoRef.current.play().catch(() => {});
  }, [stream, status]);

  // ── 3. Clean up stream when component unmounts ────────────────────────────
  useEffect(() => {
    return () => {
      stream?.getTracks().forEach(t => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!isActive) return null;

  // ── Corner position ───────────────────────────────────────────────────────
  const pos: React.CSSProperties =
    corner === 'bottom-right' ? { bottom: 84, right: 16 } :
    corner === 'bottom-left'  ? { bottom: 84, left:  16 } :
    corner === 'top-right'    ? { top:    16, right: 16 } :
                                { top:    16, left:  16 };

  // ── Minimised → small red dot ─────────────────────────────────────────────
  if (minimised) {
    return (
      <>
        <div
          title="Camera active — click to expand"
          onClick={() => setMinimised(false)}
          style={{
            position: 'fixed', zIndex: 9991, cursor: 'pointer',
            ...pos,
            width: 36, height: 36,
            borderRadius: '50%',
            background: 'rgba(0,0,0,0.78)',
            border: '2px solid rgba(239,68,68,0.85)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 0 4px rgba(239,68,68,0.18)',
            animation: 'lcp_pulse 2s ease-in-out infinite',
          }}
        >
          <Camera size={14} style={{ color: '#ef4444' }} />
        </div>
        <style>{`@keyframes lcp_pulse{0%,100%{box-shadow:0 0 0 4px rgba(239,68,68,0.18);}50%{box-shadow:0 0 0 8px rgba(239,68,68,0.05);}}`}</style>
      </>
    );
  }

  return (
    <>
      <div
        style={{
          position: 'fixed', zIndex: 9991,
          ...pos,
          width: 180, height: 140,
          borderRadius: 12,
          overflow: 'hidden',
          background: '#111',
          boxShadow: '0 8px 32px rgba(0,0,0,0.55), 0 0 0 2px rgba(239,68,68,0.55)',
          border: '2px solid rgba(239,68,68,0.6)',
        }}
      >
        {/* ── The video element is ALWAYS rendered so the ref is always valid ── */}
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
            transform: 'scaleX(-1)', // mirror (selfie view)
            display: 'block',
            // Hide visually until stream is active; never unmount the element
            opacity: status === 'active' ? 1 : 0,
            transition: 'opacity 0.3s',
          }}
        />

        {/* Spinner overlay while starting */}
        {status === 'starting' && (
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: '#111',
          }}>
            <div style={{
              width: 22, height: 22, borderRadius: '50%',
              border: '2.5px solid rgba(255,255,255,0.15)',
              borderTopColor: '#ef4444',
              animation: 'lcp_spin 0.7s linear infinite',
            }} />
          </div>
        )}

        {/* Error overlay */}
        {status === 'error' && (
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            gap: 5, padding: 10, background: '#111',
          }}>
            <CameraOff size={20} style={{ color: '#ef4444' }} />
            <span style={{ fontSize: 10, color: '#ef4444', fontWeight: 600, textAlign: 'center', lineHeight: 1.3 }}>
              Camera unavailable
            </span>
          </div>
        )}

        {/* Top bar: LIVE dot + minimise button */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '4px 7px',
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.72), transparent)',
          zIndex: 2,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{
              width: 7, height: 7, borderRadius: '50%',
              background: '#ef4444',
              animation: 'lcp_blink 1.4s ease-in-out infinite',
              boxShadow: '0 0 4px rgba(239,68,68,0.7)',
            }} />
            <span style={{ fontSize: 9, fontWeight: 800, color: '#fff', letterSpacing: '0.08em' }}>LIVE</span>
          </div>

          <button
            onClick={() => setMinimised(true)}
            title="Minimise"
            style={{
              background: 'rgba(255,255,255,0.14)', border: 'none', borderRadius: 4,
              width: 18, height: 18, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: 0, color: '#fff',
            }}
          >
            <Minus size={10} />
          </button>
        </div>

        {/* Bottom label */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          padding: '3px 7px 4px',
          background: 'linear-gradient(to top, rgba(0,0,0,0.65), transparent)',
          display: 'flex', alignItems: 'center', gap: 4,
          zIndex: 2,
        }}>
          <Camera size={9} style={{ color: 'rgba(255,255,255,0.55)', flexShrink: 0 }} />
          <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', fontWeight: 500 }}>
            Camera monitoring active
          </span>
        </div>
      </div>

      <style>{`
        @keyframes lcp_spin  { to { transform: rotate(360deg); } }
        @keyframes lcp_blink { 0%,100%{ opacity:1; } 50%{ opacity:0.3; } }
      `}</style>
    </>
  );
};

export default LiveCameraPreview;
