"use client";

/**
 * SmartCliffLoader — premium full-screen loading state.
 *
 * The SmartCliff wordmark (untouched: Poppins 800, tight tracking) fades and
 * scales into view, a soft neon magenta orb appears beside it and breathes,
 * and a few tiny pink particles drift around the mark. Pure CSS — no
 * libraries, seamless loop, honors prefers-reduced-motion.
 *
 * Usage: render conditionally while something loads, e.g.
 *   if (booting) return <SmartCliffLoader />;
 * `fullscreen={false}` renders it as a block that fills its parent instead of
 * a fixed overlay.
 */

const CSS = `
.scl-root{position:fixed; inset:0; z-index:9999; display:grid; place-items:center; background:#000; overflow:hidden;
  font-family:var(--font-poppins), 'Poppins', -apple-system, 'Segoe UI', sans-serif;}
.scl-root.inline{position:relative; inset:auto; z-index:auto; width:100%; height:100%; min-height:280px;}
.scl-stage{position:relative; display:flex; align-items:center; gap:22px;}
.scl-logo{font-weight:800; font-size:clamp(30px,6vw,54px); letter-spacing:-0.02em; color:#fff; line-height:1;
  animation:scl-logo-in 1.1s cubic-bezier(0.2,0,0,1) both;}
@keyframes scl-logo-in{from{opacity:0; transform:scale(0.94);} 60%{opacity:1;} to{opacity:1; transform:scale(1);}}
.scl-orb{position:relative; width:clamp(42px,7vw,66px); height:clamp(42px,7vw,66px); border-radius:50%;
  background:radial-gradient(circle at 32% 28%, #ff5c8a 0%, #ff2e63 45%, #e60f52 100%);
  animation:scl-orb-in 0.9s 0.45s cubic-bezier(0.2,0,0,1) both, scl-orb-pulse 2.6s 1.35s ease-in-out infinite;}
.scl-orb::before{content:""; position:absolute; inset:-34%; border-radius:50%;
  background:radial-gradient(circle, rgba(255,46,99,0.55) 0%, rgba(255,46,99,0.22) 45%, transparent 70%);
  filter:blur(10px); animation:scl-glow 2.6s 1.35s ease-in-out infinite;}
@keyframes scl-orb-in{from{opacity:0; transform:scale(0.4);} to{opacity:1; transform:scale(1);}}
@keyframes scl-orb-pulse{0%,100%{transform:scale(1);} 50%{transform:scale(1.09);}}
@keyframes scl-glow{0%,100%{opacity:0.75;} 50%{opacity:1;}}
.scl-p{position:absolute; border-radius:50%; background:#ff2e63; box-shadow:0 0 8px 1px rgba(255,46,99,0.5);
  opacity:0; animation:scl-p-drift var(--dur) var(--delay) ease-in-out infinite;}
.scl-p:nth-child(3){width:7px; height:7px; right:-46px; top:38%; --dur:5.2s; --delay:1.2s;}
.scl-p:nth-child(4){width:4px; height:4px; left:-56px; top:66%; --dur:6.4s; --delay:1.7s;}
.scl-p:nth-child(5){width:3px; height:3px; left:18%; top:-34px; --dur:7.1s; --delay:2.3s;}
.scl-p:nth-child(6){width:5px; height:5px; right:8%; bottom:-38px; --dur:5.8s; --delay:2.9s;}
.scl-p:nth-child(7){width:3px; height:3px; left:42%; bottom:-26px; --dur:6.9s; --delay:3.4s;}
@keyframes scl-p-drift{0%{opacity:0; transform:translate(0,0);} 18%{opacity:0.9;}
  50%{opacity:0.55; transform:translate(9px,-12px);} 82%{opacity:0.9;} 100%{opacity:0; transform:translate(-6px,8px);}}
@media (prefers-reduced-motion: reduce){
  .scl-logo,.scl-orb,.scl-orb::before,.scl-p{animation-duration:0.01s; animation-iteration-count:1;}
  .scl-orb,.scl-logo{opacity:1; transform:none;}
  .scl-p{display:none;}
}
`;

export default function SmartCliffLoader({ fullscreen = true }: { fullscreen?: boolean }) {
  return (
    <div className={`scl-root${fullscreen ? "" : " inline"}`} role="status" aria-label="SmartCliff is loading">
      <style>{CSS}</style>
      <div className="scl-stage">
        <span className="scl-logo">SmartCliff</span>
        <span className="scl-orb" aria-hidden />
        <span className="scl-p" aria-hidden />
        <span className="scl-p" aria-hidden />
        <span className="scl-p" aria-hidden />
        <span className="scl-p" aria-hidden />
        <span className="scl-p" aria-hidden />
      </div>
    </div>
  );
}
