// ─── Assessment media registry (safety net) ─────────────────────────────────
// The assessment flow captures the camera/screen from many places (proctoring
// recording, face verification, live-camera preview, per-player recorders, the
// Live Screen broadcaster). Each is *supposed* to stop its own stream, but a
// single missed cleanup leaves the webcam light / screen-share bar on after the
// test.
//
// This module transparently records EVERY MediaStream returned by
// getUserMedia / getDisplayMedia, so we can force-release them all when the
// test tears down — a guaranteed backstop regardless of which component forgot.
// The wrapper is a thin pass-through and never changes capture behaviour.

const activeStreams = new Set<MediaStream>();
// Camera streams (video via getUserMedia) tracked separately so the face
// proctor can reuse an already-open camera instead of opening a 2nd one
// (a second camera open often returns black frames).
const cameraStreams = new Set<MediaStream>();
let installed = false;

function remember(stream: MediaStream): MediaStream {
  try {
    if (stream && typeof stream.getTracks === "function") {
      activeStreams.add(stream);
      // Drop it from the set once all its tracks have ended (normal cleanup).
      stream.getTracks().forEach((t) => {
        t.addEventListener("ended", () => {
          if (stream.getTracks().every((x) => x.readyState === "ended")) {
            activeStreams.delete(stream);
          }
        });
      });
    }
  } catch { /* never let tracking break a capture */ }
  return stream;
}

/** Idempotently wrap getUserMedia/getDisplayMedia to track captured streams. */
export function installMediaRegistry(): void {
  if (installed) return;
  if (typeof navigator === "undefined" || !navigator.mediaDevices) return;
  installed = true;

  const md = navigator.mediaDevices;

  if (typeof md.getUserMedia === "function") {
    const orig = md.getUserMedia.bind(md);
    md.getUserMedia = (constraints?: MediaStreamConstraints) =>
      orig(constraints).then((s) => {
        remember(s);
        // Track camera streams so the face proctor can reuse one.
        try {
          if (constraints && (constraints as any).video && s.getVideoTracks().length) {
            cameraStreams.add(s);
            s.getVideoTracks().forEach((t) =>
              t.addEventListener("ended", () => cameraStreams.delete(s))
            );
          }
        } catch { /* ignore */ }
        return s;
      });
  }
  if (typeof (md as any).getDisplayMedia === "function") {
    const orig = (md as any).getDisplayMedia.bind(md);
    (md as any).getDisplayMedia = (constraints?: any) =>
      orig(constraints).then(remember);
  }
}

/** Force-stop every camera/screen stream captured during the assessment. */
export function stopAllAssessmentMedia(): void {
  activeStreams.forEach((s) => {
    try { s.getTracks().forEach((t) => t.stop()); } catch { /* ignore */ }
  });
  activeStreams.clear();
  cameraStreams.clear();
}

/** Most-recently-opened live camera stream, for reuse (e.g. face proctoring). */
export function getActiveCameraStream(): MediaStream | null {
  const arr = Array.from(cameraStreams);
  for (let i = arr.length - 1; i >= 0; i--) {
    const s = arr[i];
    if (s.getVideoTracks().some((t) => t.readyState === "live")) return s;
  }
  return null;
}

// Install on import so it is active before any capture in the assessment bundle.
installMediaRegistry();
