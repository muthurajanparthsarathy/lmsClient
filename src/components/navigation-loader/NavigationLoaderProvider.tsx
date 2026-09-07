'use client';

// Global route-change loader for the Next.js App Router.
//
// How it works
// ────────────
// START signals (any of these mean "the user just initiated a navigation"):
//   1. Click on any same-origin <a> element (covers every next/link Link)
//   2. router.push / router.replace — caught via history.pushState/replaceState patch
//   3. Browser back / forward — caught via popstate
//
// PATHNAME changes only. A same-pathname transition that only rewrites the
// query string is in-page state sync (the resources page mirrors its selected
// node / tab / subcategory into the URL on every syllabus click) — the page
// stays mounted and its sections carry their own loaders. Painting the global
// overlay for those made every syllabus click flash the already-visible page,
// then cover it with "Loading… Just a moment" seconds later.
//
// STOP has two layers:
//   A) usePathname/useSearchParams change → the new route committed. Fast-path:
//      if nothing is loading right now, hide immediately.
//   B) Otherwise enter post-commit mode: overlay stays up while React Query
//      is busy OR any DOM loading indicator (role="status", .animate-pulse)
//      is visible. Sliding idle-settle window means chained fetches also
//      keep the overlay up. Hard cap MAX_HOLD_MS guards against runaway.

import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, Suspense,
} from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useIsFetching, useIsMutating, useQueryClient } from '@tanstack/react-query';
import { PageLoader } from './PageLoader';

interface Ctx {
  isNavigating: boolean;
  /** Manually mark a navigation as starting (rarely needed — auto-detected). */
  start: () => void;
  /** Manually stop the loader (rarely needed). */
  stop: () => void;
}

const NavigationLoaderContext = createContext<Ctx | null>(null);

const SHOW_DELAY_MS = 150;             // don't paint the overlay before this
const MIN_VISIBLE_MS = 300;            // once painted, stay at least this long
const POST_COMMIT_IDLE_SETTLE_MS = 500; // ms of continuous idle needed to conclude "fully loaded"
const MAX_HOLD_MS = 8000;              // absolute ceiling from first paint

// Inner listener that reads usePathname + useSearchParams. Wrapped in Suspense
// by the provider because useSearchParams requires a boundary during prerender.
function LocationChangeListener({ onChange }: { onChange: () => void }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const serialized = `${pathname}?${searchParams?.toString() ?? ''}`;
  useEffect(() => {
    onChange();
  }, [serialized, onChange]);
  return null;
}

export function NavigationLoaderProvider({ children }: { children: React.ReactNode }) {
  const [isVisible, setIsVisible] = useState(false);

  // ── Refs (do not trigger renders) ─────────────────────────────────────────
  const pendingRef = useRef(false);                     // route change intent seen but not yet committed
  const showTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const maxHoldTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const graceExpiryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shownAtRef = useRef<number | null>(null);       // when overlay first painted
  const postCommitUntilRef = useRef(0);                 // performance.now() cutoff — 0 means "no active window"
  const lastCommittedHrefRef = useRef<string>('');      // updated by LocationChangeListener; used by popstate diff

  // ── React Query global activity ───────────────────────────────────────────
  // Re-renders the provider whenever the count changes; that is by design so
  // the effect below re-evaluates "should we still be visible?".
  const fetching = useIsFetching();
  const mutating = useIsMutating();
  const rqBusy = fetching + mutating > 0;
  const queryClient = useQueryClient();

  // ── DOM-visible loading state ─────────────────────────────────────────────
  // Some page-level loading UI (e.g. "Loading course map…", "Loading Course
  // Content") is driven by local component state that flips AFTER React Query
  // settles. So we also watch the DOM for known loading signals. The shared
  // <Loading> primitive renders <Swirling> which has role="status"; Tailwind
  // skeletons use animate-pulse. Our own overlay is excluded via a data attr.
  const [domBusyTick, setDomBusyTick] = useState(0);
  const domBusyRef = useRef(false);
  const domObserverActiveRef = useRef(false);

  // Combined "app is busy" signal.
  const isBusy = rqBusy || domBusyRef.current;

  // Latest isBusy captured in a ref so timers can read it without stale closures.
  const isBusyRef = useRef(isBusy);
  useEffect(() => { isBusyRef.current = isBusy; }, [isBusy]);

  // ── Small helpers ─────────────────────────────────────────────────────────
  const clearShowTimer = () => {
    if (showTimerRef.current) { clearTimeout(showTimerRef.current); showTimerRef.current = null; }
  };
  const clearHideTimer = () => {
    if (hideTimerRef.current) { clearTimeout(hideTimerRef.current); hideTimerRef.current = null; }
  };
  const clearMaxHoldTimer = () => {
    if (maxHoldTimerRef.current) { clearTimeout(maxHoldTimerRef.current); maxHoldTimerRef.current = null; }
  };
  const clearGraceExpiryTimer = () => {
    if (graceExpiryTimerRef.current) { clearTimeout(graceExpiryTimerRef.current); graceExpiryTimerRef.current = null; }
  };

  // ── DOM scan ──────────────────────────────────────────────────────────────
  // Cheap: two querySelectorAll calls, debounced by the observer.
  const scanDomForLoading = useCallback((): boolean => {
    if (typeof document === 'undefined') return false;
    // role="status"    → shared <Loading>/<Swirling> primitive
    // .animate-pulse   → Tailwind skeletons
    // .animate-spin    → lucide Loader2-style spinners
    // [class*="skeleton"] → custom skeleton blocks (e.g. the course sidebar's
    //                       sb-skeleton placeholders, which use neither
    //                       Tailwind animation classes nor role="status")
    const selectors = ['[role="status"]', '.animate-pulse', '.animate-spin', '[class*="skeleton"]'];
    for (const sel of selectors) {
      const nodes = document.querySelectorAll(sel);
      for (let i = 0; i < nodes.length; i++) {
        const el = nodes[i] as Element;
        // Skip our own overlay (and anything nested inside it).
        if ((el as any).closest?.('[data-nav-loader-overlay="true"]')) continue;
        // Visibility check that works for BOTH HTML and SVG.
        //   - offsetWidth/offsetHeight are 0 for inline SVGs (like <Swirling>),
        //     so we can't rely on them.
        //   - getBoundingClientRect() reflects the actual laid-out size for
        //     both element types.
        //   - As a fallback for detached elements (rect all zeros because
        //     display:none somewhere in ancestry), also check the connected
        //     flag: if the node isn't in the live document at all, ignore it.
        if (!el.isConnected) continue;
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) continue;
        return true;
      }
    }
    return false;
  }, []);

  // ── DOM observer — only active during nav / post-commit ─────────────────
  // Installed when a nav starts, torn down when the overlay hides. Zero cost
  // when the app is idle.
  const installDomObserver = useCallback(() => {
    if (typeof document === 'undefined') return;
    if (domObserverActiveRef.current) return;
    domObserverActiveRef.current = true;

    let debounce: ReturnType<typeof setTimeout> | null = null;
    const rescan = () => {
      const next = scanDomForLoading();
      if (next !== domBusyRef.current) {
        domBusyRef.current = next;
        setDomBusyTick(t => t + 1); // triggers the isBusy effect
      }
    };
    const scheduled = () => {
      if (debounce) return;
      debounce = setTimeout(() => { debounce = null; rescan(); }, 60);
    };

    const observer = new MutationObserver(scheduled);
    observer.observe(document.body, { childList: true, subtree: true });
    // Prime once, deferred to a microtask. installDomObserver can be called
    // synchronously from patchedPushState, which itself may run inside a
    // useInsertionEffect (some libraries call router.push there). Scheduling
    // a state update from inside useInsertionEffect throws — deferring the
    // first rescan lets the effect finish before setDomBusyTick fires.
    let primed: ReturnType<typeof queueMicrotask> | number | null = null;
    if (typeof queueMicrotask === 'function') {
      queueMicrotask(() => {
        if (domObserverActiveRef.current) rescan();
      });
    } else {
      primed = setTimeout(() => {
        if (domObserverActiveRef.current) rescan();
      }, 0) as unknown as number;
    }

    // Stash the cleanup on the ref so we can call it from uninstallDomObserver.
    (domObserverActiveRef as any).cleanup = () => {
      observer.disconnect();
      if (debounce) clearTimeout(debounce);
      if (primed !== null) clearTimeout(primed as number);
      domObserverActiveRef.current = false;
      (domObserverActiveRef as any).cleanup = null;
    };
  }, [scanDomForLoading]);

  const uninstallDomObserver = useCallback(() => {
    const cleanup = (domObserverActiveRef as any).cleanup as (() => void) | null;
    if (cleanup) cleanup();
    domBusyRef.current = false;
  }, []);

  // ── Hide ──────────────────────────────────────────────────────────────────
  /**
   * Unconditional hide. Enforces MIN_VISIBLE_MS if the overlay has already
   * painted, otherwise just cancels the pending show without any paint.
   */
  const scheduleHide = useCallback(() => {
    // Cancel any pending show — if we never painted, nothing to do.
    if (showTimerRef.current) {
      clearShowTimer();
      pendingRef.current = false;
      postCommitUntilRef.current = 0;
      clearMaxHoldTimer();
      clearGraceExpiryTimer();
      uninstallDomObserver();
      return;
    }
    if (hideTimerRef.current) return; // already scheduled

    pendingRef.current = false;
    postCommitUntilRef.current = 0;

    const elapsed = shownAtRef.current ? Date.now() - shownAtRef.current : 0;
    const remaining = Math.max(0, MIN_VISIBLE_MS - elapsed);
    hideTimerRef.current = setTimeout(() => {
      setIsVisible(false);
      shownAtRef.current = null;
      hideTimerRef.current = null;
      clearMaxHoldTimer();
      clearGraceExpiryTimer();
      uninstallDomObserver();
    }, remaining);
  }, [uninstallDomObserver]);

  // ── Start ─────────────────────────────────────────────────────────────────
  const start = useCallback(() => {
    if (pendingRef.current) return; // already tracking one nav
    pendingRef.current = true;
    clearHideTimer();
    clearShowTimer();
    clearMaxHoldTimer();
    clearGraceExpiryTimer();
    postCommitUntilRef.current = 0;

    // Start watching the DOM for external loading indicators from now until
    // the overlay hides — the sidebar / content spinners flip their state
    // asynchronously and RQ alone is not enough to detect "fully ready".
    installDomObserver();

    showTimerRef.current = setTimeout(() => {
      setIsVisible(true);
      shownAtRef.current = Date.now();
      showTimerRef.current = null;
      // Arm hard cap the moment the overlay actually paints.
      maxHoldTimerRef.current = setTimeout(() => {
        if (process.env.NODE_ENV !== 'production') {
          // eslint-disable-next-line no-console
          console.warn('[nav-loader] max hold (' + MAX_HOLD_MS + 'ms) reached — forcing hide');
        }
        scheduleHide();
      }, MAX_HOLD_MS);
    }, SHOW_DELAY_MS);
  }, [scheduleHide, installDomObserver]);

  // Kept for the public Ctx — matches previous API.
  const stop = useCallback(() => scheduleHide(), [scheduleHide]);

  // ── Location change handler ───────────────────────────────────────────────
  // Route committed. Fast-path if idle; else enter post-commit sliding window.
  const onLocationChange = useCallback(() => {
    // Always refresh the "last committed URL" reference, whether we were
    // tracking a nav or not — the popstate handler depends on this being fresh.
    if (typeof window !== 'undefined') {
      lastCommittedHrefRef.current = window.location.pathname + window.location.search;
    }
    if (!pendingRef.current) return;
    let raf1 = 0;
    let raf2 = 0;
    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        pendingRef.current = false;

        // Force a fresh DOM scan — the observer may not have fired yet for
        // skeleton elements the new route just mounted.
        if (domObserverActiveRef.current) {
          domBusyRef.current = scanDomForLoading();
        }
        // Read live RQ counts (closure values would be stale).
        const rqNow = queryClient.isFetching() + queryClient.isMutating();
        const combinedBusy = rqNow > 0 || domBusyRef.current;

        // Fast-path: nothing loading at commit → hide immediately, cancelling
        // any pending show. Prevents the anti-flicker guarantee from breaking.
        if (!combinedBusy) {
          scheduleHide();
          return;
        }

        // Otherwise enter post-commit mode. The isBusy effect below is now the
        // authority on when to hide.
        postCommitUntilRef.current = (typeof performance !== 'undefined' ? performance.now() : Date.now()) + POST_COMMIT_IDLE_SETTLE_MS;
      });
    });
    void raf1; void raf2;
  }, [scheduleHide, queryClient, scanDomForLoading]);

  // ── The core "should we still be visible?" decision ───────────────────────
  // Post-commit sliding-window semantics: while the app is busy (RQ OR DOM),
  // push the deadline forward. Only schedule a hide once busy=false has held
  // continuously for POST_COMMIT_IDLE_SETTLE_MS. MAX_HOLD_MS is the cap.
  useEffect(() => {
    if (pendingRef.current) return; // still waiting for route commit
    if (!postCommitUntilRef.current) return; // not in post-commit mode
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();

    if (isBusy) {
      postCommitUntilRef.current = now + POST_COMMIT_IDLE_SETTLE_MS;
      clearGraceExpiryTimer();
      return;
    }

    // Idle. Schedule hide for when the deadline elapses. If more activity
    // starts before then, the isBusy=true branch cancels this timer and
    // slides the deadline forward.
    const remaining = Math.max(0, postCommitUntilRef.current - now);
    clearGraceExpiryTimer();
    graceExpiryTimerRef.current = setTimeout(() => {
      graceExpiryTimerRef.current = null;
      if (!pendingRef.current && !isBusyRef.current) {
        scheduleHide();
      }
    }, remaining + 30);
  }, [isBusy, domBusyTick, scheduleHide]);

  // ── Initial page load (hard reload / direct URL) ──────────────────────────
  // A hard load never fires a nav-intent signal, but the page still spends
  // visible time hydrating and fetching — users would watch the sidebar
  // skeleton and content spinner assemble piece by piece. Treat mount as an
  // already-committed navigation: paint the overlay immediately and let the
  // same sliding-window settle logic decide when the page is actually ready.
  const initialLoadHandledRef = useRef(false);
  useEffect(() => {
    if (initialLoadHandledRef.current) return;
    initialLoadHandledRef.current = true;

    installDomObserver();
    setIsVisible(true);
    shownAtRef.current = Date.now();

    // Hard cap for the initial load as well.
    clearMaxHoldTimer();
    maxHoldTimerRef.current = setTimeout(() => {
      if (process.env.NODE_ENV !== 'production') {
        // eslint-disable-next-line no-console
        console.warn('[nav-loader] initial-load max hold (' + MAX_HOLD_MS + 'ms) reached — forcing hide');
      }
      scheduleHide();
    }, MAX_HOLD_MS);

    // Enter post-commit mode directly (there is no pending route change).
    postCommitUntilRef.current = (typeof performance !== 'undefined' ? performance.now() : Date.now()) + POST_COMMIT_IDLE_SETTLE_MS;
    // Nudge the decision effect so it evaluates even if RQ/DOM state hasn't
    // changed yet on this tick.
    setDomBusyTick(t => t + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Install navigation-intent detectors on mount ──────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // (1) Global anchor click interception. Runs on capture so we win over
    //     stopPropagation in downstream handlers.
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented) return;
      if (e.button !== 0) return; // left-click only
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return; // new-tab combos

      let el: HTMLElement | null = e.target as HTMLElement | null;
      while (el && el.tagName !== 'A') el = el.parentElement;
      if (!el) return;
      const anchor = el as HTMLAnchorElement;
      const href = anchor.getAttribute('href');
      if (!href) return;
      if (anchor.target && anchor.target !== '' && anchor.target !== '_self') return;
      if (anchor.hasAttribute('download')) return;
      if (anchor.getAttribute('data-nav-loader-skip') === 'true') return;

      let url: URL;
      try { url = new URL(anchor.href, window.location.href); } catch { return; }
      if (url.origin !== window.location.origin) return;

      // Query-only changes on the same pathname are in-page state sync — the
      // page stays mounted, so its own section loaders are the right feedback.
      if (url.pathname === window.location.pathname) return;

      start();
    };
    document.addEventListener('click', onClick, true);

    // (2) Patch history so router.push/replace fires the loader without the
    //     rest of the app opting in.
    const origPush = window.history.pushState;
    const origReplace = window.history.replaceState;
    window.history.pushState = function patchedPushState(this: History, ...args: Parameters<History['pushState']>) {
      const nextUrl = args[2];
      if (nextUrl != null) {
        try {
          const target = new URL(String(nextUrl), window.location.href);
          // Pathname change only — query-only rewrites are in-page state sync.
          if (target.pathname !== window.location.pathname) {
            start();
          }
        } catch { /* noop */ }
      }
      return origPush.apply(this, args);
    };
    window.history.replaceState = function patchedReplaceState(this: History, ...args: Parameters<History['replaceState']>) {
      const nextUrl = args[2];
      if (nextUrl != null) {
        try {
          const target = new URL(String(nextUrl), window.location.href);
          // Pathname change only — query-only rewrites are in-page state sync.
          if (target.pathname !== window.location.pathname) {
            start();
          }
        } catch { /* noop */ }
      }
      return origReplace.apply(this, args);
    };

    // Seed the last-committed reference so the very first popstate has a
    // baseline to compare against even before any router.push fires.
    lastCommittedHrefRef.current = window.location.pathname + window.location.search;

    // (3) Back / forward. Guard against hash-only pops or same-URL history
    //     entries: those never trigger a usePathname/useSearchParams change,
    //     so pendingRef would stay stuck until MAX_HOLD (8 s), suppressing
    //     every subsequent nav intent via the "already tracking" early-return.
    //     We compare against the LAST COMMITTED URL (kept fresh by
    //     onLocationChange) so a router.push followed by a legitimate back-nav
    //     is not mis-detected as a no-op pop.
    const onPopState = () => {
      // Same rule as push/replace: only a PATHNAME change is a page navigation.
      // Back/forward between query states of the same page (node/tab history
      // on the resources page) repaints in place with section-local loaders.
      const nextPath = window.location.pathname;
      const lastPath = lastCommittedHrefRef.current.split('?')[0];
      if (nextPath === lastPath) return;
      start();
    };
    window.addEventListener('popstate', onPopState);

    return () => {
      document.removeEventListener('click', onClick, true);
      window.history.pushState = origPush;
      window.history.replaceState = origReplace;
      window.removeEventListener('popstate', onPopState);
      clearShowTimer();
      clearHideTimer();
      clearMaxHoldTimer();
      clearGraceExpiryTimer();
    };
  }, [start]);

  const value = useMemo<Ctx>(() => ({
    isNavigating: isVisible,
    start,
    stop,
  }), [isVisible, start, stop]);

  return (
    <NavigationLoaderContext.Provider value={value}>
      {/* useSearchParams requires a Suspense boundary during prerender. */}
      <Suspense fallback={null}>
        <LocationChangeListener onChange={onLocationChange} />
      </Suspense>
      {children}
      <PageLoader visible={isVisible} />
    </NavigationLoaderContext.Provider>
  );
}

export function useNavigationLoader(): Ctx {
  const ctx = useContext(NavigationLoaderContext);
  if (!ctx) {
    // Safe no-op fallback so hook use never crashes if provider is missing.
    return {
      isNavigating: false,
      start: () => { /* noop */ },
      stop: () => { /* noop */ },
    };
  }
  return ctx;
}
