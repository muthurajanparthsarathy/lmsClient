'use client';

import { useEffect, useRef } from 'react';
import { getActiveCameraStream } from './mediaRegistry';

interface UseFaceProctorOptions {
  /** Run detection only while the assessment is active. */
  isActive: boolean;
  /** "Multiple Face Detection" setting — escalate when >1 person is seen. */
  multiFaceEnabled: boolean;
  /** Warnings allowed before auto-submit for multiple faces. */
  multiFaceLimit: number;
  /** "Face Monitoring Detection" setting — escalate when NO face is seen. */
  noFaceEnabled: boolean;
  /** Warnings allowed before auto-submit for a missing face. */
  noFaceLimit: number;
  /** How often to sample the webcam, in seconds. */
  intervalSeconds?: number;
  /** Fired on each warning (before the limit). */
  onWarning?: (info: { reason: string; count: number; limit: number }) => void;
  /** Fired once when a monitor reaches its limit. */
  onLimitReached?: (reason: string) => void;
  /** Where the face-api model weights are served from (default /models). */
  modelUri?: string;
}

const NO_FACE = 'Face not detected';
const MULTI_FACE = 'Multiple person detected';

/**
 * Webcam face proctoring with two INDEPENDENT monitors, each its own toggle +
 * limit:
 *  - **Multiple Face Detection** (`multiFaceEnabled`): >1 face → warn up to
 *    `multiFaceLimit`, then auto-submit ("Multiple person detected").
 *  - **Face Monitoring Detection** (`noFaceEnabled`): 0 faces → warn up to
 *    `noFaceLimit`, then auto-submit ("Face not detected").
 * Exactly one face resets both counters. A monitor that's off is ignored
 * entirely (no warning, no submit).
 *
 * Reuses the existing camera stream from the media registry (opening a 2nd
 * camera returns black frames). face-api is imported lazily; the hook fails open.
 */
export function useFaceProctor({
  isActive,
  multiFaceEnabled,
  multiFaceLimit,
  noFaceEnabled,
  noFaceLimit,
  intervalSeconds = 4,
  onWarning,
  onLimitReached,
  modelUri = '/models',
}: UseFaceProctorOptions) {
  const onWarningRef = useRef(onWarning);
  const onLimitRef = useRef(onLimitReached);
  useEffect(() => { onWarningRef.current = onWarning; }, [onWarning]);
  useEffect(() => { onLimitRef.current = onLimitReached; }, [onLimitReached]);

  const multiCountRef = useRef(0);
  const noFaceCountRef = useRef(0);
  const firedRef = useRef(false);

  useEffect(() => {
    if (!isActive || (!multiFaceEnabled && !noFaceEnabled)) return;

    let cancelled = false;
    let stream: MediaStream | null = null;
    let ownsStream = false;
    let video: HTMLVideoElement | null = null;
    let timer: ReturnType<typeof setInterval> | null = null;

    multiCountRef.current = 0;
    noFaceCountRef.current = 0;
    firedRef.current = false;
    const multiLimit = Math.max(1, multiFaceLimit || 3);
    const noFaceLim = Math.max(1, noFaceLimit || 3);

    const cleanup = () => {
      if (timer) clearInterval(timer);
      timer = null;
      // Only stop the camera if WE opened it — never kill the shared
      // proctoring preview/recorder stream.
      if (ownsStream && stream) { stream.getTracks().forEach(t => t.stop()); }
      stream = null;
      if (video) {
        try { video.pause(); } catch { /* noop */ }
        video.srcObject = null;
        if (video.parentNode) video.parentNode.removeChild(video);
        video = null;
      }
    };

    (async () => {
      try {
        const faceapi: any = await import('@vladmandic/face-api');
        if (!faceapi.nets.tinyFaceDetector.isLoaded) {
          await faceapi.nets.tinyFaceDetector.loadFromUri(modelUri);
        }
        if (cancelled) return;

        // Reuse an already-open camera (proctoring preview/recorder). Opening a
        // SECOND camera on the same device frequently returns black frames →
        // false "Face not detected". Wait briefly for the shared stream, then
        // fall back to our own only if none appears.
        let shared = getActiveCameraStream();
        for (let i = 0; i < 12 && !shared && !cancelled; i++) {
          await new Promise(r => setTimeout(r, 400));
          shared = getActiveCameraStream();
        }
        if (cancelled) return;

        if (shared && shared.getVideoTracks().some(t => t.readyState === 'live')) {
          stream = shared;
          ownsStream = false;
        } else {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { width: 640, height: 480, facingMode: 'user' }, audio: false,
          });
          ownsStream = true;
        }
        if (cancelled) { cleanup(); return; }

        // Off-screen but ATTACHED to the DOM — a detached <video> often never
        // decodes frames, so detection would run on a blank frame.
        video = document.createElement('video');
        video.muted = true;
        video.autoplay = true;
        video.setAttribute('playsinline', 'true');
        video.style.cssText = 'position:fixed;left:-10px;bottom:-10px;width:1px;height:1px;opacity:0;pointer-events:none;';
        document.body.appendChild(video);
        video.srcObject = stream;
        await video.play().catch(() => { /* autoplay guard */ });

        await new Promise<void>((resolve) => {
          if (!video || (video.readyState >= 2 && video.videoWidth > 0)) return resolve();
          const onReady = () => { video?.removeEventListener('loadeddata', onReady); resolve(); };
          video.addEventListener('loadeddata', onReady);
          setTimeout(resolve, 3000); // safety: never hang
        });
        if (cancelled) return;

        // Larger inputSize + lower threshold so a 2nd, smaller/farther face is
        // actually detected (otherwise it reads 0 faces → wrong "Face not
        // detected" instead of "Multiple person detected").
        const opts = new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.4 });

        const sample = async () => {
          if (cancelled || firedRef.current || !video) return;
          if (video.readyState < 2 || !video.videoWidth || !video.videoHeight) return;

          let faces = 1;
          try {
            const dets = await faceapi.detectAllFaces(video, opts);
            faces = Array.isArray(dets) ? dets.length : 0;
          } catch {
            return; // skip a bad frame rather than warning on it
          }
          if (cancelled || firedRef.current) return;

          // Counts are CUMULATIVE across the assessment: they accumulate toward
          // the limit and do NOT reset when a single face reappears (so 2/3 stays
          // 2/3, and the next violation becomes 3/3 — not 1/3 again).
          if (faces > 1 && multiFaceEnabled) {
            multiCountRef.current += 1;
            const count = multiCountRef.current;
            // Show every warning up to and including limit/limit, THEN submit.
            if (count > multiLimit) {
              firedRef.current = true;
              onLimitRef.current?.(MULTI_FACE);
              cleanup();
            } else {
              onWarningRef.current?.({ reason: MULTI_FACE, count, limit: multiLimit });
            }
          } else if (faces === 0 && noFaceEnabled) {
            noFaceCountRef.current += 1;
            const count = noFaceCountRef.current;
            // Show every warning up to and including limit/limit, THEN submit.
            if (count > noFaceLim) {
              firedRef.current = true;
              onLimitRef.current?.(NO_FACE);
              cleanup();
            } else {
              onWarningRef.current?.({ reason: NO_FACE, count, limit: noFaceLim });
            }
          }
          // faces === 1 (or a disabled monitor's violation) → keep counts (cumulative).
        };

        timer = setInterval(sample, Math.max(1, intervalSeconds) * 1000);
      } catch (err) {
        // Camera/model unavailable — fail open, never block the exam.
        console.warn('useFaceProctor: disabled —', err);
      }
    })();

    return () => { cancelled = true; cleanup(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, multiFaceEnabled, multiFaceLimit, noFaceEnabled, noFaceLimit, intervalSeconds, modelUri]);
}
