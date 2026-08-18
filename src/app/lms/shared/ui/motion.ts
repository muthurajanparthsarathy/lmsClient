"use client";

import { useEffect, useState } from "react";
import type { Variants } from "framer-motion";

/* ── Motion tokens ──────────────────────────────────────────────────────────
   One easing, three durations — mirrors --ease-standard / --duration-* in
   globals.css. Nothing in the console animates slower than 240ms. */

/** The console's single easing curve (matches `ease-standard`). */
export const easeStandard: [number, number, number, number] = [0.2, 0, 0, 1];

/** Duration tokens in seconds (framer-motion units): 120 / 180 / 240ms. */
export const durations = {
  fast: 0.12,
  base: 0.18,
  slow: 0.24,
} as const;

/* ── Variants ───────────────────────────────────────────────────────────────
   Usage: <motion.div variants={fadeInUp} initial="hidden" animate="visible" />
   Parents using listStagger propagate "visible" to children automatically. */

/** Simple opacity fade. */
export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: durations.base, ease: easeStandard },
  },
};

/** Fade with an 8px rise. */
export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: durations.base, ease: easeStandard },
  },
};

/** Fade with a gentle scale from .98 — modals, popovers, cards. */
export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.98 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: durations.base, ease: easeStandard },
  },
};

/** Parent container for staggered lists. Pair children with `listItem`.
    Stagger ONCE on mount — never re-stagger on filter/sort. */
export const listStagger: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.03 },
  },
};

/** Child variant for items inside a `listStagger` parent. */
export const listItem: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: durations.base, ease: easeStandard },
  },
};

/** Page-root mount transition: fade + 4px rise over 200ms. */
export const pageEnter: Variants = {
  hidden: { opacity: 0, y: 4 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.2, ease: easeStandard },
  },
};

/* ── Reduced motion ─────────────────────────────────────────────────────────
   MotionSafe usage notes:
   - Preferred: wrap the app shell once in <MotionConfig reducedMotion="user">
     (from framer-motion) and every motion.* component inside honours the OS
     setting automatically — transforms are skipped, opacity still animates.
   - Manual gating where a variant would still distract:
       const reduced = usePrefersReducedMotion();
       <motion.div
         variants={reduced ? undefined : fadeInUp}
         initial={reduced ? false : "hidden"}
         animate="visible"
       />
     Passing `initial={false}` mounts the element in its final state. */

/** True when the OS requests reduced motion. SSR-safe (false on the server). */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(query.matches);
    const onChange = (event: MediaQueryListEvent) => setReduced(event.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  return reduced;
}
