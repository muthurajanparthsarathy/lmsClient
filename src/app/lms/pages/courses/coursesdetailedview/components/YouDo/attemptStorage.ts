// ─── Attempt offline queue (IndexedDB) ────────────────────────────────────
// A tiny durable store for answer writes that couldn't reach the server.
// The queue lives across page reloads, browser restarts, and OS crashes —
// as long as the user's browser profile survives, so does the queue.
//
// Contract:
//   enqueue()  → append a pending answer to the store, resolve immediately.
//                Non-blocking; the caller can update the UI as if saved.
//   flush()    → iterate every pending row for the current attempt and try
//                to POST it. On 2xx, delete the row. On network / 5xx, leave
//                it queued for the next flush.
//   count()    → cheap read for the ConnectionStatusBanner.
//   dropAll()  → post-submit cleanup so a submitted attempt doesn't leave
//                orphan rows sitting in IndexedDB forever.
//
// Idempotency:
//   Every enqueue() call generates a UUID `clientEventId`. The client sends
//   it with the request; if the same event is flushed twice (queued locally
//   AND fired directly and both succeed, for example) the server's existing
//   in-place question replace makes that safe — you can't create a duplicate
//   answer row.
//
// Failure mode:
//   IndexedDB is not universally supported (private-window Firefox blocks
//   opens; strict enterprise policies can too). Every operation is wrapped
//   in try/catch and falls back to a null-queue mode: enqueue swallows,
//   count reports 0, flush is a no-op. The caller (`saveAnswer` in
//   useAttemptSession) always attempts the network write directly too, so
//   the fallback is "no offline recovery" — degradation, not failure.

import { openDB, type IDBPDatabase } from "idb";

const DB_NAME = "lms-attempt-recovery";
const DB_VERSION = 1;
const STORE = "pendingAnswers";

export type PendingAnswer = {
  clientEventId: string;
  attemptId: string;
  exerciseId: string;
  questionId: string;
  endpoint: string;         // e.g. "/courses/answers/submit" or ".../submit-multiple-files"
  payload: Record<string, any>; // full body the server expects
  createdAt: number;        // ms since epoch, for oldest-first flush
};

// Composite key so every (attempt, question, event) is unique. clientEventId
// keeps two different edits of the same question distinguishable so the
// queue doesn't drop the second edit if the first is still pending.
type PendingKey = [attemptId: string, questionId: string, clientEventId: string];

let dbPromise: Promise<IDBPDatabase> | null = null;
let ioBroken = false; // sticky flag — once opening the DB fails once, stop trying (see failure mode above)

function getDb(): Promise<IDBPDatabase> | null {
  if (ioBroken) return null;
  if (typeof window === "undefined" || !("indexedDB" in window)) {
    ioBroken = true;
    return null;
  }
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE)) {
          const store = db.createObjectStore(STORE, {
            keyPath: ["attemptId", "questionId", "clientEventId"],
          });
          // Cheap "all rows for one attempt" reads for flush() and count().
          store.createIndex("byAttempt", "attemptId", { unique: false });
        }
      },
    }).catch((err) => {
      console.warn("[attemptStorage] IndexedDB unavailable, offline queue disabled:", err);
      ioBroken = true;
      dbPromise = null;
      // Return a permanently-rejecting promise so callers hit the catch()
      // and the outer helpers treat this as null-queue mode.
      throw err;
    });
  }
  return dbPromise;
}

/** Generate a UUID that's safe on old browsers where crypto.randomUUID is absent. */
export function newClientEventId(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
  } catch { /* fall through */ }
  // RFC-4122 v4-ish fallback. Adequate for local dedup keys — not cryptographic.
  return "cev-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/** Append a pending answer to the queue. Never throws — safe to `void enqueue(…)`. */
export async function enqueue(item: PendingAnswer): Promise<void> {
  const db = getDb();
  if (!db) return;
  try {
    const d = await db;
    await d.put(STORE, item);
  } catch (err) {
    console.warn("[attemptStorage] enqueue failed:", err);
  }
}

/** How many pending items are queued for one attempt. Cheap read for the banner. */
export async function count(attemptId: string): Promise<number> {
  const db = getDb();
  if (!db) return 0;
  try {
    const d = await db;
    return d.countFromIndex(STORE, "byAttempt", attemptId);
  } catch {
    return 0;
  }
}

/**
 * Iterate every pending row for one attempt and hand it to `sender`. On a
 * truthy resolve, the row is deleted; on a falsy resolve or a throw, it's
 * kept for the next flush.
 *
 * Returns `{ sent, kept, failed }` for the caller (typically the banner).
 */
export async function flush(
  attemptId: string,
  sender: (row: PendingAnswer) => Promise<boolean>,
): Promise<{ sent: number; kept: number; failed: number }> {
  const db = getDb();
  if (!db) return { sent: 0, kept: 0, failed: 0 };
  let sent = 0;
  let kept = 0;
  let failed = 0;
  try {
    const d = await db;
    // Read ONCE then iterate — avoids holding an IDB cursor open across
    // network awaits, which some browsers auto-close.
    const rows: PendingAnswer[] = await d.getAllFromIndex(STORE, "byAttempt", attemptId);
    // Oldest first so ordering matches the student's edits.
    rows.sort((a, b) => a.createdAt - b.createdAt);
    for (const row of rows) {
      try {
        const ok = await sender(row);
        if (ok) {
          await d.delete(STORE, [row.attemptId, row.questionId, row.clientEventId] as PendingKey);
          sent++;
        } else {
          kept++;
        }
      } catch (err) {
        console.warn("[attemptStorage] flush row failed, will retry:", err);
        failed++;
      }
    }
  } catch (err) {
    console.warn("[attemptStorage] flush pass failed:", err);
  }
  return { sent, kept, failed };
}

/** Delete every row for one attempt. Called after a successful final submit. */
export async function dropAll(attemptId: string): Promise<void> {
  const db = getDb();
  if (!db) return;
  try {
    const d = await db;
    const keys = await d.getAllKeysFromIndex(STORE, "byAttempt", attemptId);
    const tx = d.transaction(STORE, "readwrite");
    await Promise.all(keys.map((k) => tx.store.delete(k)));
    await tx.done;
  } catch (err) {
    console.warn("[attemptStorage] dropAll failed:", err);
  }
}
