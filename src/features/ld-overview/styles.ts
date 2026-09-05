/**
 * L&D Overview — scoped stylesheet.
 *
 * Injected once by LDOverviewPage, the same pattern the rest of this console
 * uses (LDX_CSS / LDC_CSS). Every colour is a variable declared on .ldx
 * in LDLayout, so the page inherits the SmartCliff orange, the ink ramp and
 * dark mode without redeclaring a single hex value.
 *
 * Density follows the approved reference: 16–20px card padding, 12px radius,
 * 30px KPI values, 13–14px card titles, 11–12px supporting text and 44px table
 * rows — deliberately tighter than the app's default card language so an L&D
 * head sees the whole picture without scrolling for it.
 */
export const LDO_CSS = `
.ldo{--ldo-gap:14px; --ldo-pad:16px; --ldo-r:12px;
  /* Categorical chart ramp. LDC_CSS declares the same names inside the
     L&D console; repeating them here keeps the feature self-sufficient if
     it is ever mounted outside that shell. */
  --ch1:#eb6834; --ch2:#2a78d6; --ch3:#1baf7a; --ch4:#eda100; --ch5:#4a3aa7; display:flex; flex-direction:column; gap:var(--ldo-gap); padding-bottom:18px;}
/* The slice that Export snapshots — same rhythm as the page, but a separate
   class so .ldo is never nested inside itself. */
.ldo-body{display:flex; flex-direction:column; gap:var(--ldo-gap); min-width:0;}
.ldo *{box-sizing:border-box;}

/* ── card ──────────────────────────────────────────────────────────────── */
.ldo-card{background:var(--surface); border:1px solid var(--border); border-radius:var(--ldo-r); padding:var(--ldo-pad); box-shadow:var(--shadow-xs); min-width:0;}
.ldo-card-h{display:flex; align-items:center; gap:8px; margin:0 0 12px;}
.ldo-card-h h2{margin:0; font-size:13.5px; font-weight:650; letter-spacing:-.01em; color:var(--ink);}
.ldo-card-h .sub{font-size:11px; color:var(--muted); font-weight:500;}
.ldo-card-h .right{margin-left:auto; display:flex; align-items:center; gap:6px;}
.ldo-link{font-size:11px; font-weight:650; color:var(--accent-ink); text-decoration:none; display:inline-flex; align-items:center; gap:2px;}
.ldo-link:hover{text-decoration:underline;}

/* ── header ────────────────────────────────────────────────────────────── */
.ldo-head{display:flex; align-items:flex-start; gap:16px; flex-wrap:wrap; padding-right:44px;}
.ldo-head h1{margin:0; font-size:22px; font-weight:680; letter-spacing:-.025em; color:var(--ink); line-height:1.2;}
.ldo-head p{margin:4px 0 0; font-size:12.5px; color:var(--muted);}
.ldo-head-r{margin-left:auto; display:flex; align-items:center; gap:8px; flex-wrap:wrap;}
.ldo-btn{display:inline-flex; align-items:center; gap:6px; height:34px; padding:0 13px; font:inherit; font-size:12.5px; font-weight:600; color:var(--ink2); background:var(--surface); border:1px solid var(--border); border-radius:9px; cursor:pointer; white-space:nowrap; transition:border-color .14s, color .14s, background .14s;}
.ldo-btn:hover{border-color:color-mix(in srgb,var(--accent) 40%,var(--border)); color:var(--ink);}
.ldo-btn:focus-visible{outline:2px solid var(--accent); outline-offset:1px;}
.ldo-btn.primary{background:var(--accent); border-color:var(--accent); color:#fff;}
.ldo-btn.primary:hover{filter:brightness(1.05); color:#fff;}
.ldo-btn:disabled{opacity:.55; cursor:not-allowed;}
.ldo-btn.icon{width:34px; padding:0; justify-content:center;}
.ldo-stamp{display:inline-flex; align-items:center; gap:7px; font-size:11px; color:var(--muted); white-space:nowrap;}
.ldo-spin{animation:ldo-spin 1s linear infinite;}
@keyframes ldo-spin{to{transform:rotate(360deg);}}

/* ── report scope: filters + summary line ──────────────────────────────────
   Reports Overview leads with the SCOPE choice — Client → Course → Time
   Period — because on a reporting page the L&D head picks the scope BEFORE
   they read a metric. The portfolio-count strip that used to sit above these
   filters was removed for the same reason: Dashboard already shows those
   numbers, and repeating them here pushed the actual controls below the fold. */
.ldo-filters{display:flex; align-items:flex-end; gap:10px; flex-wrap:wrap;}
/* Widen the three pickers in this row only. The shared FloatingPicker keeps
   its default sizing on every other page in the console — hence the scoped
   nth-child overrides here instead of touching the component itself. */
.ldo-filters > *:nth-child(1){flex:0 0 auto; min-width:290px;}
.ldo-filters > *:nth-child(2){flex:0 0 auto; min-width:340px;}
.ldo-filters > *:nth-child(3){flex:0 0 auto; min-width:230px;}


/* ── KPI row ───────────────────────────────────────────────────────────────
   Five equal columns on desktop, and an executive-density card: ~168px tall,
   14/16px padding, a 30px value with the sparkline BESIDE it (not stacked
   under it, which is what was making the tiles bulky). The card is a flex
   column with the footer on margin-top:auto, so the divider line sits at the
   same y on all five cards no matter how long a caption wraps. Grid stretch
   then keeps every card exactly the same height. */
.ldo-kpis{display:grid; grid-template-columns:repeat(5,minmax(0,1fr)); gap:12px; align-items:stretch;}
.ldo-kpi{display:flex; flex-direction:column; min-height:140px; min-width:0; width:100%; text-align:left; text-decoration:none; color:inherit; font:inherit; background:var(--surface); border:1px solid var(--border); border-radius:12px; padding:14px 16px; box-shadow:var(--shadow-xs); cursor:pointer; transition:border-color .14s, box-shadow .14s;}
.ldo-kpi:hover{border-color:color-mix(in srgb,var(--accent) 35%,var(--border)); box-shadow:var(--shadow-sm);}
.ldo-kpi:focus-visible{outline:2px solid var(--accent); outline-offset:2px;}
.ldo-kpi-t{display:flex; align-items:center; gap:8px; margin-bottom:10px;}
/* The title must not wrap: a second title line would push every card taller. */
.ldo-kpi-t h3{margin:0; min-width:0; font-size:13px; font-weight:600; color:var(--ink2); letter-spacing:-.012em; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;}
.ldo-ico{flex:0 0 auto; width:32px; height:32px; border-radius:99px; display:grid; place-items:center;}
.ldo-kpi-v{display:flex; align-items:center; gap:8px; min-height:32px;}
.ldo-kpi-v b{font-size:30px; font-weight:700; line-height:1; letter-spacing:-.035em; color:var(--ink); font-variant-numeric:tabular-nums;}
.ldo-kpi-c{margin:6px 0 10px; font-size:11.5px; line-height:1.35; color:var(--muted);}
.ldo-kpi-c b{font-weight:680; color:var(--ink2); font-variant-numeric:tabular-nums;}
/* Second caption line — smaller and muted, so "Assignments + Assessments
   completed" reads as a qualifier and not as a second metric. */
.ldo-kpi-c small{display:block; margin-top:1px; font-size:10.5px; line-height:1.3; color:var(--muted);}
/* Sits at the right of the VALUE row, inside the 32px line box, so it costs no
   card height at all. */
.ldo-spark{margin-left:auto; flex:0 0 auto; display:block;}

/* ── tone tints (icons, chips) ─────────────────────────────────────────── */
.t-brand{background:var(--wash); color:var(--accent-ink);}
.t-success{background:color-mix(in srgb,var(--good) 13%,transparent); color:var(--good-ink);}
.t-warning{background:color-mix(in srgb,var(--warn) 15%,transparent); color:var(--warn);}
.t-danger{background:color-mix(in srgb,var(--bad) 12%,transparent); color:var(--bad);}
.t-info{background:color-mix(in srgb,var(--ch2) 12%,transparent); color:var(--ch2);}
.t-neutral{background:color-mix(in srgb,var(--muted) 11%,transparent); color:var(--muted);}

/* ── analysis rows ─────────────────────────────────────────────────────── */
.ldo-row-a{display:grid; grid-template-columns:1fr 1fr 1fr; gap:var(--ldo-gap); align-items:stretch;}
.ldo-row-b{display:grid; grid-template-columns:.9fr 1.3fr 1.15fr; gap:var(--ldo-gap); align-items:stretch;}

/* ── learning journey ──────────────────────────────────────────────────── */
/* ── Paired stage-progress cards ───────────────────────────────────────────
   Shared shell for Learning Journey (Completion) + Industry Readiness
   (Performance). Same padding, same header shape, same stage layout, same
   footer height — so both cards line up as a matched pair. */
.ldo-spc{background:var(--surface); border:1px solid var(--border); border-radius:12px; padding:16px 18px; display:flex; flex-direction:column; min-width:0; box-shadow:var(--shadow-xs);}
.ldo-spc-h{margin:0 0 14px;}
.ldo-spc-title{display:flex; align-items:center; gap:8px; flex-wrap:wrap;}
.ldo-spc-title h2{margin:0; font-size:16px; font-weight:700; letter-spacing:-.015em; color:var(--ink); line-height:1.25;}
.ldo-spc-badge{display:inline-flex; align-items:center; height:20px; padding:0 8px; border-radius:99px; font-size:9.5px; font-weight:700; letter-spacing:.06em;}
.ldo-spc-badge.t-info{background:color-mix(in srgb,var(--ch2) 12%,transparent); color:var(--ch2);}
.ldo-spc-badge.t-success{background:color-mix(in srgb,var(--good) 14%,transparent); color:var(--good-ink);}
.ldo-spc-info{display:inline-flex; align-items:center; justify-content:center; width:16px; height:16px; border-radius:99px; color:var(--muted); cursor:help;}
.ldo-spc-info:hover{color:var(--ink2);}
.ldo-spc-sub{margin:4px 0 0; font-size:11.5px; color:var(--muted); line-height:1.35;}

/* Stage grid — three cells with a small arrow between, matching Learning
   Journey's original geometry so the two cards align to the pixel. */
.ldo-spc-stages{flex:1 1 auto; display:grid; grid-template-columns:1fr auto 1fr auto 1fr; align-items:start; gap:6px;}
.ldo-spc-stage{text-align:center; min-width:0; padding:6px 4px 0; display:flex; flex-direction:column; align-items:center;}
.ldo-spc-ring{margin:0 auto 8px; width:50px; height:50px; border-radius:99px; display:grid; place-items:center; border:1.5px solid var(--grid); background:var(--surface); transition:border-color .14s;}
.ldo-spc-ring svg{opacity:.9;}
.ldo-spc-stage b{display:block; font-size:14px; font-weight:650; color:var(--ink); letter-spacing:-.005em; line-height:1.2;}
.ldo-spc-stage small{display:block; margin-top:2px; font-size:11px; color:var(--muted); line-height:1.3;}
.ldo-spc-v{display:inline-flex; align-items:baseline; gap:3px; margin-top:9px; font-size:22px; font-weight:700; letter-spacing:-.03em; font-variant-numeric:tabular-nums; line-height:1; color:var(--ink);}
.ldo-spc-v em{font-style:normal; font-size:10.5px; font-weight:500; color:var(--muted); margin-left:2px; letter-spacing:0;}
.ldo-spc-v.na{color:var(--muted); font-size:20px;}
.ldo-spc-bar{display:block; width:100px; max-width:80%; height:5px; margin:8px auto 0; border-radius:99px; background:var(--grid); overflow:hidden;}
.ldo-spc-bar.na{background:color-mix(in srgb,var(--muted) 12%,var(--grid));}
.ldo-spc-bar i{display:block; height:100%; border-radius:99px;}
.ldo-spc-hint{display:block; margin-top:6px; font-size:10px; color:var(--muted); line-height:1.3; max-width:110px;}
.ldo-spc-arrow{align-self:center; margin-top:22px; color:var(--muted); opacity:.55;}

/* Footer info strip — light-blue on completion, light-green on performance. */

/* ── distribution ──────────────────────────────────────────────────────── */
.ldo-dist{display:grid; grid-template-columns:auto 1fr; gap:14px; align-items:center;}
.ldo-donut{position:relative; width:132px; height:132px; flex:0 0 auto;}
.ldo-donut-c{position:absolute; inset:0; display:grid; place-content:center; text-align:center;}
.ldo-donut-c b{display:block; font-size:20px; font-weight:700; letter-spacing:-.03em; color:var(--ink); line-height:1.1; font-variant-numeric:tabular-nums;}
.ldo-donut-c span{font-size:10px; color:var(--muted);}
.ldo-legend{display:grid; gap:1px; min-width:0;}
.ldo-leg{display:flex; align-items:center; gap:8px; padding:5px 7px; border-radius:8px; text-decoration:none; color:inherit; border:1px solid transparent; transition:background .14s, border-color .14s;}
.ldo-leg:hover{background:var(--page); border-color:var(--grid);}
.ldo-leg i{width:8px; height:8px; border-radius:99px; flex:0 0 auto;}
.ldo-leg span{font-size:11.5px; color:var(--ink2); font-weight:500; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;}
.ldo-leg b{margin-left:auto; font-size:11.5px; font-weight:680; color:var(--ink); font-variant-numeric:tabular-nums; white-space:nowrap;}
.ldo-leg em{font-style:normal; font-size:11px; color:var(--muted); font-variant-numeric:tabular-nums;}

/* ── practice health ───────────────────────────────────────────────────── */
.ldo-health{display:grid; grid-template-columns:repeat(auto-fit,minmax(78px,1fr)); gap:10px;}
.ldo-metric{text-align:center; min-width:0;}
.ldo-metric .ldo-ico{margin:0 auto 7px; width:32px; height:32px;}
.ldo-metric b{display:block; font-size:17px; font-weight:680; color:var(--ink); letter-spacing:-.025em; font-variant-numeric:tabular-nums;}
.ldo-metric span{display:block; margin-top:2px; font-size:10.5px; line-height:1.3; color:var(--muted);}

/* ── priority actions ──────────────────────────────────────────────────── */
.ldo-acts{display:grid; gap:1px;}
.ldo-act{display:flex; align-items:center; gap:10px; padding:6px 8px; border-radius:9px; text-decoration:none; color:inherit; border:1px solid transparent; transition:background .14s, border-color .14s;}
.ldo-act:hover{background:var(--page); border-color:var(--grid);}
.ldo-act-n{flex:0 0 auto; min-width:38px; height:24px; padding:0 7px; border-radius:7px; display:grid; place-items:center; font-size:12px; font-weight:700; font-variant-numeric:tabular-nums;}
.ldo-act-t{min-width:0; flex:1 1 auto;}
.ldo-act-t b{display:block; font-size:12px; font-weight:600; color:var(--ink); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;}
.ldo-act-t small{display:block; font-size:10.5px; color:var(--muted); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;}
.ldo-act .chev{flex:0 0 auto; color:var(--muted); opacity:.6;}
.ldo-cta{margin-top:11px; display:flex; align-items:center; justify-content:center; gap:7px; height:34px; border-radius:9px; background:var(--accent); color:#fff; font-size:12.5px; font-weight:650; text-decoration:none; transition:filter .14s;}
.ldo-cta:hover{filter:brightness(1.06); color:#fff;}

/* ── course health table ───────────────────────────────────────────────── */
.ldo-tblwrap{overflow-x:auto;}
.ldo-tbl{width:100%; border-collapse:collapse; min-width:860px;}
.ldo-tbl th{position:sticky; top:0; z-index:1; background:var(--surface); text-align:left; font-size:10.5px; font-weight:650; letter-spacing:.04em; text-transform:uppercase; color:var(--muted); padding:0 10px 8px; border-bottom:1px solid var(--border); white-space:nowrap;}
.ldo-tbl td{padding:0 10px; height:44px; border-bottom:1px solid var(--grid); font-size:12px; color:var(--ink2); vertical-align:middle;}
.ldo-tbl tr:last-child td{border-bottom:0;}
.ldo-tbl tbody tr:hover td{background:var(--page);}
.ldo-tbl .num{font-variant-numeric:tabular-nums;}
.ldo-cname{display:inline-flex; align-items:center; gap:7px; font-size:12.5px; font-weight:600; color:var(--ink); text-decoration:none; background:none; border:0; padding:0; font-family:inherit; cursor:pointer; text-align:left;}
.ldo-cname:hover{color:var(--accent-ink); text-decoration:underline;}
.ldo-cname small{display:block; font-weight:500; font-size:10.5px; color:var(--muted);}
.ldo-learners{display:inline-flex; align-items:center; gap:6px; color:var(--ink2); font-variant-numeric:tabular-nums;}
.ldo-cell{display:flex; align-items:center; gap:8px; min-width:96px;}
.ldo-cell b{flex:0 0 34px; font-size:12px; font-weight:650; color:var(--ink); font-variant-numeric:tabular-nums;}
.ldo-track{flex:1 1 auto; height:4px; border-radius:99px; background:var(--grid); overflow:hidden; min-width:36px;}
.ldo-track i{display:block; height:100%; border-radius:99px;}
.ldo-chip{display:inline-flex; align-items:center; padding:2px 8px; border-radius:99px; font-size:10.5px; font-weight:680; white-space:nowrap;}
.ldo-more{width:100%; margin-top:10px; height:32px; border:1px solid var(--border); border-radius:9px; background:var(--surface); color:var(--ink2); font:inherit; font-size:12px; font-weight:600; cursor:pointer; display:inline-flex; align-items:center; justify-content:center; gap:6px;}
.ldo-more:hover{border-color:color-mix(in srgb,var(--accent) 35%,var(--border)); color:var(--accent-ink);}

/* ── states ────────────────────────────────────────────────────────────── */
.ldo-empty{display:flex; flex-direction:column; align-items:center; justify-content:center; gap:5px; padding:26px 14px; text-align:center; color:var(--muted); font-size:12px;}
.ldo-empty b{font-size:12.5px; font-weight:600; color:var(--ink2);}
.ldo-err{border:1px solid color-mix(in srgb,var(--bad) 35%,var(--border)); border-radius:var(--ldo-r); background:color-mix(in srgb,var(--bad) 6%,var(--surface)); color:var(--bad); padding:14px 16px; font-size:12.5px; font-weight:600;}
.ldo-sk{background:var(--grid); border-radius:8px; animation:ldo-pulse 1.5s ease-in-out infinite;}
@keyframes ldo-pulse{0%,100%{opacity:1;} 50%{opacity:.45;}}

.dark .ldo{--ch1:#d95926; --ch2:#3987e5; --ch3:#199e70; --ch4:#c98500; --ch5:#9085e9;}

/* ── responsive ────────────────────────────────────────────────────────── */
@media (max-width:1439px){
  .ldo-kpis{gap:10px;}
  .ldo-kpi{padding:13px 14px;}
  .ldo-kpi-v b{font-size:27px;}
  .ldo-kpi-c{font-size:11px; line-height:1.3; margin-bottom:8px;}
  .ldo-kpi-c small{font-size:10px;}
  .ldo-ico{width:30px; height:30px;}
  .ldo-kpi-t{margin-bottom:8px;}
}
/* Five across down to 1280px (the shell's 252px rail leaves ~1000px of content
   there, so each card still clears 185px). Below that, three. */
@media (max-width:1279px){
  .ldo-kpis{grid-template-columns:repeat(3,minmax(0,1fr));}
}
@media (max-width:1400px){
  .ldo-row-a, .ldo-row-b{grid-template-columns:repeat(2,minmax(0,1fr));}
  .ldo-row-a > :nth-child(3), .ldo-row-b > :nth-child(3){grid-column:1 / -1;}
}
@media (max-width:900px){
  .ldo-kpis{grid-template-columns:repeat(2,minmax(0,1fr));}
  .ldo-kpi{min-height:0;}
  .ldo-row-a, .ldo-row-b{grid-template-columns:minmax(0,1fr);}
  .ldo-row-a > :nth-child(3), .ldo-row-b > :nth-child(3){grid-column:auto;}
  .ldo-dist{grid-template-columns:minmax(0,1fr); justify-items:center;}
  .ldo-legend{width:100%;}
  .ldo-head{padding-right:0;}
}
@media (max-width:560px){
  .ldo-kpis{grid-template-columns:minmax(0,1fr);}
  .ldo-journey{grid-template-columns:minmax(0,1fr); gap:12px;}
  .ldo-arrow{display:none;}
  .ldo-head-r{width:100%;}
  /* Mobile — every filter takes the row on its own. */
  .ldo-filters > *:nth-child(1),
  .ldo-filters > *:nth-child(2),
  .ldo-filters > *:nth-child(3){flex:1 1 100%; min-width:0;}
}

/* ── print ─────────────────────────────────────────────────────────────── */
@media print{
  .ldo-head-r, .ldo-filters, .ldo-more, .ldo-cta{display:none !important;}
  .ldo-card, .ldo-kpi{break-inside:avoid; box-shadow:none !important;}
  .ldo-ico, .ldo-chip, .ldo-track i, .ldo-leg i, .ldo-act-n{-webkit-print-color-adjust:exact; print-color-adjust:exact;}
}
`;
