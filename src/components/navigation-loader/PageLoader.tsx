'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import SmartCliffRingLoader from '@/components/SmartCliffRingLoader';

// Full-screen route-change overlay. Portalled to <body> so it always sits above
// every modal (which live at z-50 in this app). The backdrop is translucent
// WHITE with a light blur — deliberately see-through, so the incoming page is
// visible assembling underneath and the wait reads as real progress rather
// than a curtain (the old cream + heavy blur hid everything). Centerpiece:
// the SmartCliff ring loader (breathing brand mark inside thin rings with a
// travelling gradient arc). The loader stays mounted, so fast navigations
// reveal it mid-orbit instantly instead of replaying its entrance each time.
export function PageLoader({ visible }: { visible: boolean }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!mounted || typeof document === 'undefined') return null;

  return createPortal(
    <div
      role="status"
      aria-busy={visible}
      aria-live="polite"
      aria-label="Loading page"
      data-nav-loader-overlay="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(255,255,255,0.62)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        pointerEvents: visible ? 'auto' : 'none',
        opacity: visible ? 1 : 0,
        transition: visible
          ? 'opacity 140ms cubic-bezier(0.4, 0, 0.2, 1)'
          : 'opacity 180ms cubic-bezier(0.4, 0, 0.2, 1)',
        userSelect: visible ? 'none' : 'auto',
      }}
    >
      {/* entrance={false}: the overlay's own fade reveals the loader; a
          one-shot entrance animation on a permanently-mounted element can
          freeze at its invisible first frame. */}
      <SmartCliffRingLoader title="Loading" subtitle="Just a moment..." entrance={false} />
    </div>,
    document.body,
  );
}
