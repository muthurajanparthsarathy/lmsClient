"use client";

/**
 * SmartCliffRingLoader — premium circular loading state.
 *
 * The SmartCliff mark (orange gradient tile + book icon, unchanged) sits in a
 * breathing white circle, surrounded by thin subtle rings and one gradient
 * "comet" arc travelling clockwise. Below: a stable title + subtitle.
 * Setting `done` plays the completion transition — rings expand and fade, a
 * clean radial burst of tiny strokes spreads outward, the core settles — and
 * `onComplete` fires when it finishes (~1.2s), so the caller can reveal the
 * final screen. Pure CSS animation, no libraries, honors reduced motion.
 *
 * Usage:
 *   <SmartCliffRingLoader
 *     title="Preparing your plan"
 *     subtitle="Setting up your plan and analyzing your goals..."
 *     done={isReady}
 *     doneTitle="Plan ready"
 *     onComplete={() => setShowResult(true)}
 *   />
 */

import { useEffect, useRef, type ReactNode } from "react";

const CSS = `
.scr-root{position:relative; display:flex; flex-direction:column; align-items:center; font-family:var(--font-poppins),'Poppins',-apple-system,'Segoe UI',sans-serif;}
.scr-stage{position:relative; width:220px; height:220px;}
.scr-stage svg{position:absolute; inset:0; overflow:visible;}
/* Entrance is OPT-IN (.scr-entrance): a permanently-mounted overlay (the
   route loader) must never depend on a one-shot animation for its resting
   state — if that animation freezes or never runs, the whole stage is pinned
   invisible at the from-frame. Without the class, everything rests at full
   opacity and only the infinite animations (arc, breathe) run. */
.scr-entrance .scr-stage,.scr-entrance .scr-text{animation:scr-in .8s cubic-bezier(.2,0,0,1) both;}
.scr-entrance .scr-text{animation-delay:.25s;}
@keyframes scr-in{from{opacity:0; transform:scale(.94);} to{opacity:1; transform:scale(1);}}
.scr-ring-outer{opacity:.35;}
.scr-ring-dash{opacity:.45; transform-origin:50% 50%; animation:scr-slow-rot 26s linear infinite;}
@keyframes scr-slow-rot{to{transform:rotate(360deg);}}
.scr-arc{transform-origin:50% 50%; animation:scr-arc-rot 1.6s linear infinite;}
@keyframes scr-arc-rot{to{transform:rotate(360deg);}}
.scr-core{position:absolute; inset:50%; width:96px; height:96px; transform:translate(-50%,-50%); display:grid; place-items:center; border-radius:50%; background:var(--surface,#fff); box-shadow:0 1px 2px rgba(16,24,40,.05),0 12px 30px -12px rgba(16,24,40,.14);}
.scr-core-inner{display:grid; place-items:center; animation:scr-breathe 2.6s ease-in-out infinite;}
@keyframes scr-breathe{0%,100%{transform:scale(1);} 50%{transform:scale(1.04);}}
/* The ACTUAL SmartCliff mark — the coral ribbon "P" (same paths the favicon
   and the original page loader use), sitting directly on the white core just
   like the favicon's white circle. */
.scr-logo{width:48px; height:48px; display:grid; place-items:center;}
.scr-logo svg{width:48px; height:48px; fill:#F0553B; stroke:none;}
.scr-text{margin-top:26px; text-align:center; position:relative;}
.scr-title{font-size:15.5px; font-weight:600; color:var(--heading,#111827); letter-spacing:-.01em; position:relative;}
.scr-sub{margin-top:5px; font-size:12.5px; color:var(--subtle,#6B7280);}
.scr-title span,.scr-sub span{transition:opacity .3s ease;}
.scr-done-title{position:absolute; left:50%; transform:translateX(-50%); top:0; white-space:nowrap; opacity:0;}
.scr-root.done .scr-rings{transform-origin:50% 50%; animation:scr-rings-out .65s cubic-bezier(.2,0,0,1) both;}
@keyframes scr-rings-out{to{transform:scale(1.28); opacity:0;}}
.scr-burst{position:absolute; inset:0; pointer-events:none;}
.scr-burst b{position:absolute; left:50%; top:50%; transform:rotate(var(--a));}
.scr-burst b i{display:block; width:9px; height:2px; border-radius:2px; background:#F97316; opacity:0;}
.scr-root.done .scr-burst b i{animation:scr-burst .85s cubic-bezier(.16,.6,.2,1) both; animation-delay:var(--d);}
@keyframes scr-burst{0%{opacity:0; transform:translateX(52px) scaleX(.6);} 22%{opacity:.9;} 100%{opacity:0; transform:translateX(126px) scaleX(1);}}
.scr-root.done .scr-core-inner{animation:none;}
.scr-root.done .scr-core{animation:scr-core-final .7s .35s cubic-bezier(.2,0,0,1) both;}
@keyframes scr-core-final{50%{transform:translate(-50%,-50%) scale(1.07);} 100%{transform:translate(-50%,-50%) scale(1.02);}}
.scr-root.done .scr-loading-copy{opacity:0;}
.scr-root.done .scr-done-title{opacity:1;}
@media (prefers-reduced-motion: reduce){.scr-arc,.scr-ring-dash,.scr-core-inner{animation:none !important;}}
`;

const BURST_STROKES = Array.from({ length: 24 }, (_, i) => ({
  angle: i * 15,
  delay: (i % 6) * 0.03,
}));

export default function SmartCliffRingLoader({
  title = "Preparing your plan",
  subtitle = "Setting up your plan and analyzing your goals...",
  doneTitle = "Ready",
  done = false,
  entrance = true,
  onComplete,
  logo,
}: {
  title?: string;
  subtitle?: string;
  doneTitle?: string;
  /** Flip to true to play the completion transition (burst + settle). */
  done?: boolean;
  /** Play the one-shot fade/scale entrance. Set false when the loader stays
      permanently mounted and is revealed by an overlay fade (route loader). */
  entrance?: boolean;
  /** Fires once, after the completion transition has finished (~1.2s). */
  onComplete?: () => void;
  /** Optional replacement for the center mark. Defaults to the SmartCliff tile. */
  logo?: ReactNode;
}) {
  const firedRef = useRef(false);
  useEffect(() => {
    if (!done || firedRef.current || !onComplete) return;
    firedRef.current = true;
    const t = setTimeout(onComplete, 1200);
    return () => clearTimeout(t);
  }, [done, onComplete]);

  return (
    <div className={`scr-root${done ? " done" : ""}${entrance ? " scr-entrance" : ""}`} role="status" aria-label={done ? doneTitle : title}>
      <style>{CSS}</style>
      <div className="scr-stage">
        <svg viewBox="0 0 220 220" className="scr-rings" aria-hidden>
          <defs>
            <linearGradient id="scr-arcgrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#F97316" stopOpacity="0" />
              <stop offset="55%" stopColor="#F97316" stopOpacity="0.65" />
              <stop offset="100%" stopColor="#F0701F" stopOpacity="1" />
            </linearGradient>
          </defs>
          <circle className="scr-ring-outer" cx="110" cy="110" r="92" fill="none" stroke="#D8DCE3" strokeWidth="1" />
          <circle className="scr-ring-dash" cx="110" cy="110" r="82" fill="none" stroke="#CBD1D9" strokeWidth="1" strokeDasharray="2 7" />
          <circle cx="110" cy="110" r="70" fill="none" stroke="#E7EAEF" strokeWidth="3" />
          <g className="scr-arc">
            <circle
              cx="110" cy="110" r="70" fill="none"
              stroke="url(#scr-arcgrad)" strokeWidth="3" strokeLinecap="round"
              strokeDasharray="122 318" transform="rotate(-90 110 110)"
            />
          </g>
        </svg>

        <div className="scr-burst" aria-hidden>
          {BURST_STROKES.map((s) => (
            <b key={s.angle} style={{ "--a": `${s.angle}deg`, "--d": `${s.delay}s` } as React.CSSProperties}>
              <i />
            </b>
          ))}
        </div>

        <div className="scr-core">
          <div className="scr-core-inner">
            {logo ?? (
              <span className="scr-logo" aria-hidden>
                {/* The P mark — two ribbon facets (same geometry as the
                    favicon and the original route loader). */}
                <svg viewBox="0 0 100 100">
                  {/* Bowl: over-the-top ribbon hooking down the right side */}
                  <path d="M33 22 L56 13 L74 27 L74 50 L57 58 L57 38 Z" />
                  {/* Stem: slanted parallelogram */}
                  <path d="M33 47 L50 38 L50 80 L33 89 Z" />
                </svg>
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="scr-text">
        <div className="scr-title">
          <span className="scr-loading-copy">{title}</span>
          <span className="scr-done-title">{doneTitle}</span>
        </div>
        <div className="scr-sub">
          <span className="scr-loading-copy">{subtitle}</span>
        </div>
      </div>
    </div>
  );
}
