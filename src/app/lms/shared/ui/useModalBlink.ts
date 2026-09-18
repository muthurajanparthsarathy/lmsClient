"use client";

import * as React from "react";

/* A modal that refuses overlay-click dismissal still has to answer the click.
   Swallowing it silently is worse than closing: the user gets no signal, tries
   again harder, and concludes the dialog is stuck. This hook owns that answer —
   a ref to pin on the dialog element, and a `blink()` to call from whichever
   handler swallowed the dismiss. The visual lives in `.modal-blink`
   (globals.css) so the kit Modal and the shadcn Dialog blink identically.

   Restarting a CSS animation takes the class removed, a reflow forced, then the
   class re-added. Without the reflow the browser coalesces the remove and the
   add into no mutation at all, so a second click landing while the first blink
   is still playing would do nothing — and that impatient double-click is
   exactly the moment the feedback matters most. */
export function useModalBlink<T extends HTMLElement = HTMLDivElement>() {
  const ref = React.useRef<T | null>(null);

  const blink = React.useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.classList.remove("modal-blink");
    void el.offsetWidth; // force reflow — see note above
    el.classList.add("modal-blink");
  }, []);

  return { ref, blink };
}
