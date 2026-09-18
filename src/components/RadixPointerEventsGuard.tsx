"use client";

import { useEffect } from "react";

// Any Radix Popper-anchored content (DropdownMenu, Select, Popover,
// ContextMenu, Menubar, HoverCard, Tooltip) mounts inside this wrapper while
// open, and Radix unmounts it on close (no forceMount is used anywhere in
// this app). Dialog / AlertDialog content carries role="dialog" /
// "alertdialog" with data-state directly. Together these cover every
// overlay primitive in use — deliberately NOT matching bare
// `[data-state="open"]` (Accordion, Tabs, Switch etc. use the same attribute
// for non-overlay state and would make a stuck lock look "still open").
const OPEN_OVERLAY_SELECTOR =
  '[role="dialog"][data-state="open"], ' +
  '[role="alertdialog"][data-state="open"], ' +
  "[data-radix-popper-content-wrapper]";

/**
 * Radix's modal primitives each lock <body> with `pointer-events: none`
 * while open and restore it on close. Nothing coordinates two of them
 * sharing a moment, though — this app's row-actions menus close a
 * DropdownMenu and open a Dialog (delete/edit confirmation) from the same
 * click, so one primitive's open effect and the other's close effect land in
 * the same tick. Whichever runs last wins, and once in a while the winner is
 * the DropdownMenu's stale "locked" write clobbering the Dialog's "restore"
 * — leaving `pointer-events: none` on <body> forever after the dialog
 * itself closes. Nothing on the page is broken; every click is just landing
 * on a wall nobody meant to leave up. Reported on User Management (Add User
 * unclickable after closing the delete confirmation) but the pairing exists
 * anywhere a menu action opens a dialog, so the fix is global rather than a
 * per-modal patch.
 *
 * Mount once, near the root. Watches <body>'s style attribute; whenever it
 * locks to `pointer-events: none` and, a beat later, no overlay is actually
 * open anymore, clears it.
 */
export function RadixPointerEventsGuard() {
  useEffect(() => {
    let releaseTimer: ReturnType<typeof setTimeout> | null = null;

    const release = () => {
      releaseTimer = null;
      if (document.body.style.pointerEvents !== "none") return;
      if (document.querySelector(OPEN_OVERLAY_SELECTOR)) return; // a modal genuinely is open — leave it
      document.body.style.pointerEvents = "";
    };

    const scheduleCheck = () => {
      if (releaseTimer) clearTimeout(releaseTimer);
      // Give Radix's own open/close effects a beat to land before deciding
      // the lock is actually stuck rather than mid-handoff.
      releaseTimer = setTimeout(release, 150);
    };

    const observer = new MutationObserver((mutations) => {
      if (mutations.some((m) => m.attributeName === "style")) scheduleCheck();
    });
    observer.observe(document.body, { attributes: true, attributeFilter: ["style"] });

    return () => {
      observer.disconnect();
      if (releaseTimer) clearTimeout(releaseTimer);
    };
  }, []);

  return null;
}

export default RadixPointerEventsGuard;
