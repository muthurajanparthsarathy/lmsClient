'use client';
import { getToken } from "@/lib/session";

import { useRef, useState, useCallback } from 'react';
import { setSharedScreenStream, markScreenCaptureStarting, clearScreenCaptureInProgress } from './screenStreamStore';

const CLOUDINARY_CLOUD_NAME = 'dusxfgvhi';
const CLOUDINARY_UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/video/upload`;
const CLOUDINARY_PRESET = 'dusxfgvhi';
const BACKEND_API_URL = 'https://lmsserver-yeve.onrender.com';

export interface RecordingOptions {
  courseId?: string;
  exerciseId?: string;
  studentId?: string;
  category?: string;
  subcategory?: string;  // needed to store recording under the right exercise slot
  withCamera?: boolean;  // overlay camera PiP on screen recording
  cameraOnly?: boolean;  // record ONLY camera feed (no screen capture)
}

/**
 * Shared proctoring recording hook used by MCQ and db-queryEditor.
 *
 * Three modes driven by RecordingOptions:
 *  1. cameraOnly: true                    → face-only recording (no getDisplayMedia)
 *  2. withCamera: true                    → screen + camera PiP composite
 *  3. neither                             → screen only
 *
 * All modes upload to Cloudinary then POST the URL to /assessment/recording
 * so GET /exercise/status can return it to reviewSubmission.
 */
export function useScreenRecording() {
  const mediaRecorderRef  = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const screenStreamRef   = useRef<MediaStream | null>(null);
  const cameraStreamRef   = useRef<MediaStream | null>(null);
  const animFrameRef      = useRef<number | null>(null);

  const [isRecording,    setIsRecording]    = useState(false);
  const [isSaving,       setIsSaving]       = useState(false);
  const [recordingUrl,   setRecordingUrl]   = useState<string | null>(null);
  const [recordingError, setRecordingError] = useState<string | null>(null);

  // ── Stop all media streams ────────────────────────────────────────────────
  const stopAllStreams = useCallback(() => {
    screenStreamRef.current?.getTracks().forEach(t => t.stop());
    cameraStreamRef.current?.getTracks().forEach(t => t.stop());
    setSharedScreenStream(null); // stop sharing the (now-stopped) stream with the broadcaster
    screenStreamRef.current = null;
    cameraStreamRef.current = null;
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
  }, []);

  // ── Upload blob → Cloudinary → persist URL to backend ────────────────────
  const saveRecording = useCallback(async (blob: Blob, opts: RecordingOptions): Promise<string | null> => {
    if (blob.size === 0) return null;
    setIsSaving(true);
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const prefix    = opts.cameraOnly ? 'face' : 'screen';
      const filename  = `youdo_${prefix}_${opts.courseId || 'c'}_${opts.studentId || 's'}_${timestamp}.webm`;

      const fd = new FormData();
      fd.append('file', blob, filename);
      fd.append('upload_preset', CLOUDINARY_PRESET);
      fd.append('cloud_name',   CLOUDINARY_CLOUD_NAME);
      fd.append('folder',       'you_do_assessments');
      fd.append('tags',         `you_do,assessment,course:${opts.courseId},student:${opts.studentId}`);

      const res = await fetch(CLOUDINARY_UPLOAD_URL, { method: 'POST', body: fd });
      if (!res.ok) throw new Error(`Cloudinary ${res.status}`);

      const data = await res.json();
      const url: string = data.secure_url;
      setRecordingUrl(url);

      // Persist URL in backend so reviewSubmission can retrieve it via GET /exercise/status
      const token = getToken() || localStorage.getItem('token') || '';
      await fetch(`${BACKEND_API_URL}/assessment/recording`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          courseId:     opts.courseId,
          exerciseId:   opts.exerciseId,
          studentId:    opts.studentId,
          recordingUrl: url,
          category:     opts.category    || 'You_Do',
          subcategory:  opts.subcategory || 'assessments',
          timestamp:    new Date().toISOString(),
        }),
      });

      return url;
    } catch (err: any) {
      console.error('saveRecording error:', err);
      setRecordingError(err?.message || 'Upload failed');
      return null;
    } finally {
      setIsSaving(false);
    }
  }, []);

  // ── Shared: build a MediaRecorder from a stream and wire up onstop ────────
  const _attachRecorder = useCallback((stream: MediaStream, opts: RecordingOptions) => {
    const mimeType =
      ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']
        .find(t => MediaRecorder.isTypeSupported(t)) || 'video/webm';

    const mr = new MediaRecorder(stream, {
      mimeType,
      videoBitsPerSecond: 2_000_000,
      audioBitsPerSecond:   128_000,
    });
    recordedChunksRef.current = [];
    mr.ondataavailable = e => { if (e.data.size > 0) recordedChunksRef.current.push(e.data); };
    mr.onstop = async () => {
      stopAllStreams();
      const blob = new Blob(recordedChunksRef.current, { type: mimeType });
      await saveRecording(blob, opts);
    };
    mr.onerror = err => console.error('MediaRecorder error:', err);
    mr.start(1000);
    mediaRecorderRef.current = mr;
    setIsRecording(true);
  }, [saveRecording, stopAllStreams]);

  // ── Mode A: camera-only recording ────────────────────────────────────────
  const startCameraOnlyRecording = useCallback(async (opts: RecordingOptions): Promise<boolean> => {
    try {
      const camStream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' },
        audio: true,
      });
      cameraStreamRef.current = camStream;

      // Canvas: camera feed + timestamp overlay
      const canvas = document.createElement('canvas');
      canvas.width  = 640;
      canvas.height = 480;
      const ctx = canvas.getContext('2d')!;

      const camVid = document.createElement('video');
      camVid.srcObject = camStream;
      camVid.autoplay  = true;
      camVid.muted     = true;
      await new Promise<void>(resolve => { camVid.onloadedmetadata = () => resolve(); });
      camVid.play().catch(() => {});

      const draw = () => {
        ctx.fillStyle = '#111';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Mirror the camera (natural selfie view)
        ctx.save();
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
        if (camVid.videoWidth) ctx.drawImage(camVid, 0, 0, canvas.width, canvas.height);
        ctx.restore();

        // REC badge (top-left)
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.beginPath(); ctx.roundRect(8, 8, 74, 22, 4); ctx.fill();
        ctx.fillStyle = '#ef4444';
        ctx.beginPath(); ctx.arc(18, 19, 5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.font = 'bold 11px Arial';
        ctx.fillText('REC', 27, 23);

        // Timestamp (bottom-right)
        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        const ts = new Date().toLocaleTimeString();
        const tw = ctx.measureText(ts).width;
        ctx.fillRect(canvas.width - tw - 16, canvas.height - 24, tw + 12, 18);
        ctx.fillStyle = '#fff'; ctx.font = '11px Arial';
        ctx.fillText(ts, canvas.width - tw - 10, canvas.height - 10);

        // Watermark
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.font = '10px Arial';
        const wm = `You Do Assessment · Face Recording`;
        ctx.fillText(wm, 8, canvas.height - 8);

        animFrameRef.current = requestAnimationFrame(draw);
      };
      draw();

      // Capture canvas + mic audio
      const canvasStream = canvas.captureStream(15);
      const audioTrack = camStream.getAudioTracks()[0];
      if (audioTrack) canvasStream.addTrack(audioTrack);

      _attachRecorder(canvasStream, opts);

      // Auto-stop if camera track ends
      camStream.getVideoTracks()[0]?.addEventListener('ended', () => stopRecording());

      return true;
    } catch (err: any) {
      console.error('startCameraOnlyRecording error:', err);
      setRecordingError(err?.message || 'Could not start camera recording');
      stopAllStreams();
      return false;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [_attachRecorder, stopAllStreams]);

  // ── Mode B/C: screen recording (+ optional camera PiP) ───────────────────
  const startScreenRecording = useCallback(async (opts: RecordingOptions): Promise<boolean> => {
    try {
      // 1. Capture screen — flag the open prompt so the broadcaster waits for
      //    THIS stream instead of opening a second prompt.
      markScreenCaptureStarting();
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: { width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 15 } } as any,
        audio: true,
      });
      screenStreamRef.current = screenStream;
      // Publish for the Live Screen broadcaster to REUSE (no second prompt).
      setSharedScreenStream(screenStream);

      // 2. Optional camera overlay
      let cameraStream: MediaStream | null = null;
      if (opts.withCamera) {
        try {
          cameraStream = await navigator.mediaDevices.getUserMedia({
            video: { width: 320, height: 240, facingMode: 'user' },
            audio: false, // screen audio is enough
          });
          cameraStreamRef.current = cameraStream;
        } catch {
          console.warn('Camera access denied; recording without camera overlay.');
        }
      }

      // 3. Build composite canvas
      const canvas = document.createElement('canvas');
      canvas.width  = 1280;
      canvas.height = 720;
      const ctx = canvas.getContext('2d')!;

      const screenVid = document.createElement('video');
      screenVid.srcObject = screenStream;
      screenVid.autoplay  = true;
      screenVid.muted     = true;
      await new Promise<void>(resolve => { screenVid.onloadedmetadata = () => resolve(); });
      screenVid.play().catch(() => {});

      let camVid: HTMLVideoElement | null = null;
      if (cameraStream) {
        camVid = document.createElement('video');
        camVid.srcObject = cameraStream;
        camVid.autoplay  = true;
        camVid.muted     = true;
        await new Promise<void>(resolve => { camVid!.onloadedmetadata = () => resolve(); });
        camVid.play().catch(() => {});
      }

      const draw = () => {
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw screen content
        if (screenVid.videoWidth) {
          const ar = screenVid.videoWidth / screenVid.videoHeight;
          const w  = canvas.width;
          const h  = w / ar;
          ctx.drawImage(screenVid, 0, (canvas.height - h) / 2, w, h);
        }

        // Camera PiP — bottom-right corner (mirrored, rounded border)
        if (camVid && cameraStream) {
          const cw = 200, ch = 150;
          const cx = canvas.width  - cw - 12;
          const cy = canvas.height - ch - 12;

          // Shadow / border
          ctx.fillStyle = 'rgba(0,0,0,0.7)';
          ctx.beginPath();
          ctx.roundRect(cx - 3, cy - 3, cw + 6, ch + 6, 10);
          ctx.fill();

          // Draw mirrored camera
          ctx.save();
          ctx.beginPath();
          ctx.roundRect(cx, cy, cw, ch, 8);
          ctx.clip();
          ctx.translate(cx + cw, cy);
          ctx.scale(-1, 1);
          ctx.drawImage(camVid, 0, 0, cw, ch);
          ctx.restore();

          // REC dot
          ctx.fillStyle = '#ef4444';
          ctx.beginPath(); ctx.arc(cx + 10, cy + 12, 5, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#fff'; ctx.font = 'bold 10px Arial';
          ctx.fillText(new Date().toLocaleTimeString(), cx + 20, cy + 16);
        }

        // Watermark bottom-left
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.font = '11px Arial';
        const wm = `You Do Assessment · ${opts.courseId || ''} · ${new Date().toLocaleTimeString()}`;
        ctx.fillText(wm, 8, canvas.height - 8);

        animFrameRef.current = requestAnimationFrame(draw);
      };
      draw();

      // 4. Canvas stream + audio
      const canvasStream = canvas.captureStream(15);
      const audioTrack =
        screenStream.getAudioTracks()[0] ||
        cameraStream?.getAudioTracks()[0];
      if (audioTrack) canvasStream.addTrack(audioTrack);

      _attachRecorder(canvasStream, opts);

      // Auto-stop when user stops screen share
      screenStream.getVideoTracks()[0]?.addEventListener('ended', () => stopRecording());

      return true;
    } catch (err: any) {
      console.error('startScreenRecording error:', err);
      setRecordingError(err?.message || 'Could not start screen recording');
      clearScreenCaptureInProgress();
      stopAllStreams();
      return false;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [_attachRecorder, stopAllStreams]);

  // ── Public: startRecording — routes to the right mode ────────────────────
  const startRecording = useCallback(async (opts: RecordingOptions = {}): Promise<boolean> => {
    setRecordingError(null);
    if (opts.cameraOnly) {
      return startCameraOnlyRecording(opts);
    }
    return startScreenRecording(opts);
  }, [startCameraOnlyRecording, startScreenRecording]);

  // ── Stop recording ────────────────────────────────────────────────────────
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop(); // triggers onstop → saveRecording
    } else {
      stopAllStreams();
    }
    setIsRecording(false);
  }, [stopAllStreams]);

  return {
    isRecording,
    isSaving,
    recordingUrl,
    recordingError,
    startRecording,
    stopRecording,
  };
}
