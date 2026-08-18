"use client";

import React from "react";
import { Layers, Info, Users, AlertTriangle, ChevronDown, Check } from "lucide-react";
import type { ResourceBatchContext } from "@/apiServices/resourceBatch";

// ─── Design tokens (matched to BreadcrumbBar.tsx) ──────────────────────────────
const T = {
  orange:      "#F27757",
  orangeDark:  "#E0623F",
  orangeLight: "rgba(242,119,87,0.08)",
  textMain:    "#1a1a2e",
  textSub:     "#6b6b7e",
  textMuted:   "#8b8b9e",
  border:      "#ece9f1",
  bg:          "#ffffff",
  pageBg:      "#faf9fc",
  info:        "#1d4ed8",
  infoBg:      "rgba(59,130,246,0.07)",
  infoBorder:  "rgba(59,130,246,0.22)",
  warn:        "#b45309",
  warnBg:      "rgba(245,158,11,0.08)",
  warnBorder:  "rgba(245,158,11,0.28)",
};

const LABELS: Record<string, string> = {
  I_Do: "I Do",
  We_Do: "We Do",
  You_Do: "You Do",
};

interface ResourceBatchStripProps {
  ctx: ResourceBatchContext | null | undefined;
  /** The section the user is currently looking at, so the strip can say whether it is batch-wise. */
  activeTab: "I_Do" | "We_Do" | "You_Do" | null;
  activeBatchId: string;
  onSelectBatch: (batchId: string) => void;
  /**
   * Whether staff may CHANGE the batch here, as opposed to just being told
   * which one they are in.
   *
   * The Courses route is a place to work inside a course, not to administer its
   * batches, so it names the batch and nothing more. Switching lives on the
   * Course Structure route. False makes this read-only for staff; students never
   * get a picker either way.
   */
  canSwitchBatch?: boolean;
}

/**
 * Resources by Batch — the one row that tells the user WHOSE resources they are
 * looking at, and lets staff switch.
 *
 * It renders three different things because the feature has three shapes:
 *
 *   no-batches → a plain note that the course has no batches and everything is
 *                course-level. The spec asks for the section to be hidden or to
 *                explain itself; explaining is better here, because otherwise a
 *                trainer who expected a batch picker just sees nothing and
 *                cannot tell whether it is missing or not applicable.
 *   shared     → a note that one set serves every batch. Still no picker —
 *                showing one would imply uploads differ per batch when they do
 *                not.
 *   batch-wise → the picker, plus which elements actually differ. Uploads land
 *                in the selected batch and NOWHERE else, so the selection has
 *                to stay visible while working, not hide behind a menu.
 *
 * Students never see a picker — their batch comes from their enrolment and the
 * server ignores anything they send. The strip just names their batch so an
 * empty screen reads as "nothing uploaded for my batch yet" rather than "this
 * page is broken".
 */
export const ResourceBatchStrip: React.FC<ResourceBatchStripProps> = ({
  ctx,
  activeTab,
  activeBatchId,
  onSelectBatch,
  canSwitchBatch = true,
}) => {
  if (!ctx) return null;

  const wrap = (children: React.ReactNode) => (
    <div
      className="flex flex-wrap items-center gap-2 px-4 py-2 flex-shrink-0"
      style={{ borderBottom: `1px solid ${T.border}`, background: T.pageBg }}
    >
      {children}
    </div>
  );

  const note = (
    tone: "info" | "warn",
    icon: React.ReactNode,
    text: React.ReactNode,
  ) => (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-[10.5px] font-semibold"
      style={{
        background: tone === "warn" ? T.warnBg : T.infoBg,
        color: tone === "warn" ? T.warn : T.info,
        border: `1px solid ${tone === "warn" ? T.warnBorder : T.infoBorder}`,
      }}
    >
      {icon}
      {text}
    </span>
  );

  // ── Course without batches ────────────────────────────────────────────────
  if (ctx.mode === "no-batches") {
    return wrap(
      note(
        "info",
        <Info size={11} style={{ flexShrink: 0 }} />,
        "This course does not use batches — resources are managed at the course level.",
      ),
    );
  }

  // ── Batches exist, but one resource set serves all of them ────────────────
  if (ctx.mode === "shared") {
    return wrap(
      <>
        {note(
          "info",
          <Users size={11} style={{ flexShrink: 0 }} />,
          <>
            Shared across all {ctx.batches.length} batches — upload once, every batch sees it.
          </>,
        )}
      </>,
    );
  }

  // ── Batch-wise ────────────────────────────────────────────────────────────
  const tabIsBatchWise = !!activeTab && ctx.batchwiseElements.includes(activeTab as any);

  // A student with no batch on this course would otherwise get a blank screen
  // with no explanation of why.
  if (ctx.isStudent && !ctx.activeBatchId) {
    return wrap(
      note(
        "warn",
        <AlertTriangle size={11} style={{ flexShrink: 0 }} />,
        "You are not enrolled in a batch on this course, so batch resources are unavailable. Ask your trainer to enrol you.",
      ),
    );
  }

  if (ctx.isStudent) {
    return wrap(
      <>
        <span className="inline-flex items-center gap-1.5 text-[10.5px] font-bold" style={{ color: T.textSub }}>
          <Layers size={12} style={{ color: T.orange }} />
          Batch
        </span>
        <span
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10.5px] font-bold"
          style={{
            background: T.orangeLight,
            color: T.orangeDark,
            border: `1px solid ${T.orange}35`,
          }}
        >
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: T.orange }} />
          {ctx.activeBatchName}
        </span>
        {tabIsBatchWise &&
          note(
            "info",
            <Info size={11} style={{ flexShrink: 0 }} />,
            <>Showing your batch&rsquo;s {LABELS[activeTab!] ?? activeTab} resources.</>,
          )}
      </>,
    );
  }

  const batchLabel = (
    <span className="inline-flex items-center gap-1.5 text-[10.5px] font-bold" style={{ color: T.textSub }}>
      <Layers size={12} style={{ color: T.orange }} />
      Batch
    </span>
  );

  // Staff, read-only: name the batch, offer no way to change it. Which batch
  // that is still comes from the same resolution as everywhere else — the
  // remembered selection when there is one, otherwise the server's choice — so
  // this reads the same material the switcher would have landed on.
  if (!canSwitchBatch) {
    const current =
      ctx.batches.find((b) => b.id && b.id === (activeBatchId || ctx.activeBatchId))?.name ||
      ctx.activeBatchName;
    return wrap(
      <>
        {batchLabel}
        <span
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10.5px] font-bold"
          style={{
            background: T.orangeLight,
            color: T.orangeDark,
            border: `1px solid ${T.orange}35`,
          }}
        >
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: T.orange }} />
          {current || "—"}
        </span>
        {tabIsBatchWise
          ? note(
              "warn",
              <AlertTriangle size={11} style={{ flexShrink: 0 }} />,
              <>{LABELS[activeTab!] ?? activeTab} is batch-wise</>,
            )
          : note(
              "info",
              <Info size={11} style={{ flexShrink: 0 }} />,
              <>
                {activeTab ? `${LABELS[activeTab] ?? activeTab} is shared` : "Shared"} — every batch sees
                it. Batch-wise here: {ctx.batchwiseElements.map((e) => LABELS[e] ?? e).join(", ")}.
              </>,
            )}
      </>,
    );
  }

  // A SHARED section serves every batch the same resources, so switching batch
  // changes nothing on screen. The chips stay visible — they still say which
  // batches exist and which one is current — but go inert, instead of inviting a
  // click that silently reloads the identical list.
  const canPickBatch = tabIsBatchWise;

  const sharedLabel = activeTab ? `${LABELS[activeTab] ?? activeTab} is shared` : "This section is shared";

  // Staff picker.
  return wrap(
    <>
      {batchLabel}

      {/* One tab per batch. A batch with a null id has no container yet (its
          Batches page was never opened), so it is shown but not selectable —
          filing anything under it would write to a bucket no reader looks in. */}
      <div
        className="inline-flex rounded-lg overflow-hidden"
        style={{ border: `1px solid ${T.border}`, background: T.bg }}
      >
        {ctx.batches.map((b, i) => {
          const hasContainer = !!b.id;
          const selectable = hasContainer && canPickBatch;
          // Still mark the current batch while shared, so the row keeps telling
          // the user where they are — it just cannot be changed from here.
          const isActive = hasContainer && b.id === (activeBatchId || ctx.activeBatchId);
          return (
            <button
              key={b.id || `${b.name}-${i}`}
              type="button"
              disabled={!selectable}
              title={
                !hasContainer
                  ? `${b.name} has no batch container yet — open the course's Batches page once to create it`
                  : !canPickBatch
                    ? `${sharedLabel} — every batch sees the same resources, so there is no batch to switch to`
                    : `Work in ${b.name}`
              }
              onClick={() => selectable && onSelectBatch(b.id as string)}
              className="inline-flex items-center gap-1.5 px-3 py-1 text-[10.5px] font-bold transition-colors"
              style={{
                // While shared, the current batch is shown in the quieter
                // "informational" treatment used by the read-only strip rather
                // than the solid fill that reads as an active control.
                background: isActive ? (canPickBatch ? T.orange : T.orangeLight) : "transparent",
                color: isActive
                  ? (canPickBatch ? "#ffffff" : T.orangeDark)
                  : selectable
                    ? T.textSub
                    : T.textMuted,
                borderLeft: i === 0 ? undefined : `1px solid ${T.border}`,
                cursor: selectable ? "pointer" : "not-allowed",
              }}
            >
              {isActive && (
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ background: canPickBatch ? "#ffffff" : T.orange }}
                />
              )}
              {b.name}
            </button>
          );
        })}
      </div>

      {tabIsBatchWise
        ? note(
            "warn",
            <AlertTriangle size={11} style={{ flexShrink: 0 }} />,
            <>
              {LABELS[activeTab!] ?? activeTab} is batch-wise
            </>,
          )
        : note(
            "info",
            <Info size={11} style={{ flexShrink: 0 }} />,
            <>
              {activeTab ? `${LABELS[activeTab] ?? activeTab} is shared` : "Shared"} — every batch sees
              it. Batch-wise here: {ctx.batchwiseElements.map((e) => LABELS[e] ?? e).join(", ")}.
            </>,
          )}
    </>,
  );
};

export default ResourceBatchStrip;

/* ═══════════════════════════════════════════════════════════════════════════
   BatchScopeBar — the strip's replacement (2026-08 UX).

   No banner row. Batch-wiseness is DYNAMIC per course config (any of
   I Do / We Do / You Do can be batch-wise — ctx.batchwiseElements decides):

     • Course has no batches → render NOTHING (there is nothing to scope to).
     • Active tab SHARED (common to every batch) → the SAME row, but the
       select is inert: it reads "All batches" and cannot be opened, and the
       ⓘ explains that this section is common. Rendering nothing used to make
       We Do / You Do look like the batch feature had failed to load; showing
       a disabled control says "not applicable here" out loud.
     • Active tab BATCH-WISE → a compact "Batch" select in the right corner.
       - The FIRST time a batch-wise tab is opened without a user-confirmed
         batch (per course, per session), a popup asks which batch to work
         in; the pick fills the select. Closing the popup keeps the current
         batch and counts as confirming it.
       - Students and read-only staff get a small label naming their batch
         instead of a select — never a picker.
   Uploads keep filing through the same onSelectBatch/activeBatchId wiring.
   ═══════════════════════════════════════════════════════════════════════ */

const CONFIRM_KEY = "lms_batch_confirmed";

export const BatchScopeBar: React.FC<ResourceBatchStripProps & { courseId: string }> = ({
  ctx,
  activeTab,
  activeBatchId,
  onSelectBatch,
  canSwitchBatch = true,
  courseId,
}) => {
  const [confirmed, setConfirmed] = React.useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    try { return sessionStorage.getItem(`${CONFIRM_KEY}:${courseId}`) === "1"; } catch { return true; }
  });
  const [popupOpen, setPopupOpen] = React.useState(false);

  const isBatchwiseMode = !!ctx && ctx.mode !== "no-batches" && ctx.mode !== "shared";
  const tabIsBatchWise =
    isBatchwiseMode && !!activeTab && !!ctx && ctx.batchwiseElements.includes(activeTab);
  const staffPicker = !!ctx && !ctx.isStudent && canSwitchBatch && ctx.canSelectBatch !== false;
  const effectiveId = activeBatchId || ctx?.activeBatchId || "";
  const effectiveName =
    (ctx?.batches || []).find((b) => b.id && b.id === effectiveId)?.name || ctx?.activeBatchName || "—";

  const markConfirmed = React.useCallback(() => {
    setConfirmed(true);
    try { sessionStorage.setItem(`${CONFIRM_KEY}:${courseId}`, "1"); } catch { /* in-memory is enough */ }
  }, [courseId]);

  // Picking "Select batch" un-chooses: back to the placeholder, and the
  // batch-wise tab re-asks via the popup.
  const unconfirm = React.useCallback(() => {
    setConfirmed(false);
    try { sessionStorage.removeItem(`${CONFIRM_KEY}:${courseId}`); } catch { /* in-memory is enough */ }
  }, [courseId]);

  // Opening a batch-wise tab with no user-confirmed batch → ask which batch.
  React.useEffect(() => {
    if (staffPicker && tabIsBatchWise && !confirmed) setPopupOpen(true);
  }, [staffPicker, tabIsBatchWise, confirmed]);

  // Custom dropdown (replaces the native <select> — the browser list looked
  // out of place) + hover tooltip state. Hooks live above the early return.
  const [ddOpen, setDdOpen] = React.useState(false);
  const [infoOpen, setInfoOpen] = React.useState(false);
  const ddRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (!ddOpen) return;
    const close = (e: MouseEvent) => {
      if (ddRef.current && !ddRef.current.contains(e.target as Node)) setDdOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [ddOpen]);

  // A course without batches has nothing to scope to, so the row stays absent.
  // A course WITH batches always shows the row — batch-wise tabs get a live
  // select, shared tabs get the same control disabled.
  if (!ctx || ctx.mode === "no-batches" || !(ctx.batches || []).length) return null;

  const pick = (id: string) => {
    onSelectBatch(id);
    markConfirmed();
    setPopupOpen(false);
  };

  const tabLabel = (activeTab && LABELS[activeTab]) || "This section";
  const batchwiseNames = (ctx.batchwiseElements || []).map((e) => LABELS[e] ?? e).join(", ");

  // ⓘ before the badge — hover shows a styled card explaining WHY this
  // select exists (native title tooltips are slow and plain).
  const info = (
    <span
      className="relative inline-flex items-center"
      onMouseEnter={() => setInfoOpen(true)}
      onMouseLeave={() => setInfoOpen(false)}
    >
      <span
        className="inline-flex items-center cursor-help"
        style={{ color: T.textMuted }}
        aria-label={tabIsBatchWise ? "Why a batch selection?" : "Why is the batch selection disabled?"}
      >
        <Info size={13} />
      </span>
      {infoOpen && (
        <span
          role="tooltip"
          style={{
            position: "absolute", top: "calc(100% + 8px)", right: -10, zIndex: 60,
            width: 264, background: "#fff",
            border: `1px solid ${T.border}`, borderRadius: 10,
            boxShadow: "0 12px 32px rgba(0,0,0,0.12)",
            padding: "10px 12px", fontSize: 11, lineHeight: 1.55,
            color: T.textSub, fontWeight: 500, whiteSpace: "normal", textAlign: "left",
          }}
        >
          <b style={{ display: "block", color: T.textMain, marginBottom: 3 }}>
            {tabLabel} is {tabIsBatchWise ? "batch-wise" : "common to all batches"}
          </b>
          {tabIsBatchWise ? (
            <>
              Each batch has its own set of {tabLabel} resources. Pick a batch to view and
              upload that batch&rsquo;s resources — uploads go only to the selected batch.
            </>
          ) : (
            <>
              One set of {tabLabel} resources serves every batch — upload once and all{" "}
              {ctx.batches.length} batches see it. There is no batch to choose here, so the
              selector is disabled.
              {batchwiseNames ? <> Batch-wise on this course: {batchwiseNames}.</> : null}
            </>
          )}
        </span>
      )}
    </span>
  );

  // Badge reads INTO the control next to it as one sentence:
  // "I Do resources for batch → [Batch I]", or, when the section is common,
  // "We Do resources for → [All batches]". Tab name is dynamic (whichever of
  // I Do / We Do / You Do the course config marks batch-wise).
  const label = (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10.5px] font-bold whitespace-nowrap"
      style={
        tabIsBatchWise
          ? { background: T.orangeLight, color: T.orangeDark, border: `1px solid ${T.orange}35` }
          : { background: T.infoBg, color: T.info, border: `1px solid ${T.infoBorder}` }
      }
    >
      <Layers size={12} />
      {tabLabel} resources for {tabIsBatchWise ? "batch" : "every batch"}
    </span>
  );

  // ── Shared section: same row, inert control ───────────────────────────────
  // Everyone (staff and students alike) sees the batch selector fixed on
  // "All batches" — there is nothing to pick, and the disabled state plus the
  // ⓘ say so rather than leaving a blank corner.
  if (!tabIsBatchWise) {
    return (
      <div className="flex items-center gap-2">
        {info}
        {label}
        <span
          className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold whitespace-nowrap"
          aria-disabled="true"
          title={`${tabLabel} is common — every batch sees the same resources, so there is no batch to select`}
          style={{
            background: T.pageBg,
            border: `1.5px solid ${T.border}`,
            borderRadius: 8,
            color: T.textMuted,
            padding: "5px 10px",
            maxWidth: 220,
            cursor: "not-allowed",
          }}
        >
          <Users size={12} style={{ flexShrink: 0 }} />
          <span className="truncate">All batches</span>
          <ChevronDown size={13} style={{ color: T.textMuted, flexShrink: 0, opacity: 0.5 }} />
        </span>
      </div>
    );
  }

  // Students / read-only staff: name the batch, no picker.
  if (!staffPicker) {
    return (
      <div className="flex items-center gap-2">
        {info}
        {label}
        <span
          className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10.5px] font-bold whitespace-nowrap"
          style={{ background: T.bg, color: T.textMain, border: `1px solid ${T.border}` }}
        >
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: T.orange }} />
          {ctx.isStudent && !ctx.activeBatchId ? "Not enrolled in a batch" : effectiveName}
        </span>
      </div>
    );
  }

  return (
    <>
      {/* Inline batch select — shares the tab row, right-aligned. Until the
          teacher explicitly picks (select or popup), it shows the
          "Select batch" placeholder rather than silently displaying the
          server-default batch as if it had been chosen. */}
      <div className="flex items-center gap-2">
        {info}
        {label}
        <div ref={ddRef} className="relative">
          <button
            type="button"
            onClick={() => setDdOpen((o) => !o)}
            className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold cursor-pointer"
            style={{
              background: T.bg,
              border: `1.5px solid ${ddOpen ? T.orange : T.border}`,
              borderRadius: 8,
              color: confirmed && effectiveId ? T.textMain : T.textMuted,
              padding: "5px 10px",
              maxWidth: 220,
              transition: "border-color 0.15s",
            }}
            aria-haspopup="listbox"
            aria-expanded={ddOpen}
            aria-label="Batch to work in"
          >
            <span className="truncate">{confirmed && effectiveId ? effectiveName : "Select batch"}</span>
            <ChevronDown
              size={13}
              style={{ color: T.textMuted, flexShrink: 0, transform: ddOpen ? "rotate(180deg)" : undefined, transition: "transform 0.15s" }}
            />
          </button>

          {ddOpen && (
            <div
              role="listbox"
              style={{
                position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 60,
                minWidth: 190, background: "#fff",
                border: `1px solid ${T.border}`, borderRadius: 10,
                boxShadow: "0 12px 32px rgba(0,0,0,0.14)", padding: 4,
              }}
            >
              {[
                { id: "", name: "Select batch", selectable: true, noContainer: false },
                ...ctx.batches.map((b) => ({ id: b.id || "", name: b.name, selectable: !!b.id, noContainer: !b.id })),
              ].map((o, i) => {
                const isSel = o.id ? (confirmed && o.id === effectiveId) : !confirmed;
                return (
                  <button
                    key={o.id || `opt-${i}`}
                    type="button"
                    role="option"
                    aria-selected={isSel}
                    disabled={!o.selectable}
                    onClick={() => {
                      setDdOpen(false);
                      if (!o.selectable) return;
                      if (o.id) pick(o.id); else unconfirm();
                    }}
                    className="w-full flex items-center gap-2 text-left"
                    style={{
                      padding: "7px 10px", borderRadius: 7,
                      fontSize: 11.5, fontWeight: 600, border: "none",
                      color: !o.selectable ? T.textMuted : isSel ? T.orangeDark : T.textMain,
                      background: isSel ? T.orangeLight : "transparent",
                      cursor: o.selectable ? "pointer" : "not-allowed",
                      transition: "background 0.12s",
                    }}
                    onMouseEnter={(e) => { if (o.selectable && !isSel) (e.currentTarget as HTMLElement).style.background = "#F5F6F8"; }}
                    onMouseLeave={(e) => { if (!isSel) (e.currentTarget as HTMLElement).style.background = isSel ? T.orangeLight : "transparent"; }}
                  >
                    <span className="truncate">{o.name}</span>
                    {o.noContainer && <span style={{ fontSize: 9.5, color: T.textMuted, marginLeft: "auto", flexShrink: 0 }}>no container</span>}
                    {isSel && <Check size={13} style={{ color: T.orange, marginLeft: "auto", flexShrink: 0 }} />}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* First-entry popup: choose the batch before working batch-wise. */}
      {popupOpen && (
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center p-4"
          style={{ background: "rgba(15,23,42,0.45)" }}
          onClick={() => { markConfirmed(); setPopupOpen(false); }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Select batch"
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#fff",
              border: `1px solid ${T.border}`,
              borderRadius: 16,
              boxShadow: "0 24px 60px rgba(0,0,0,0.18)",
              width: "100%",
              maxWidth: 420,
              padding: 20,
            }}
          >
            <div className="flex items-center gap-2.5 mb-1">
              <span
                className="flex items-center justify-center flex-shrink-0"
                style={{ width: 34, height: 34, borderRadius: 10, background: T.orangeLight, color: T.orangeDark }}
              >
                <Layers size={16} />
              </span>
              <div style={{ fontSize: 14.5, fontWeight: 700, color: T.textMain }}>
                {(activeTab && LABELS[activeTab]) || "This section"} keeps separate resources per batch
              </div>
            </div>
            <p style={{ fontSize: 12, color: T.textSub, margin: "6px 0 14px", lineHeight: 1.5 }}>
              Choose which batch to work in — uploads here go to the selected batch only.
            </p>
            <div className="grid gap-2">
              {ctx.batches.map((b, i) => {
                const selectable = !!b.id;
                const isCurrent = selectable && b.id === effectiveId;
                return (
                  <button
                    key={b.id || `${b.name}-${i}`}
                    type="button"
                    disabled={!selectable}
                    onClick={() => selectable && pick(b.id as string)}
                    className="flex items-center gap-2 text-left transition-colors"
                    style={{
                      padding: "10px 12px",
                      borderRadius: 10,
                      border: `1.5px solid ${isCurrent ? T.orange : T.border}`,
                      background: isCurrent ? T.orangeLight : T.bg,
                      color: selectable ? T.textMain : T.textMuted,
                      fontSize: 12.5,
                      fontWeight: 600,
                      cursor: selectable ? "pointer" : "not-allowed",
                    }}
                    title={selectable ? `Work in ${b.name}` : `${b.name} has no batch container yet — open the course's Batches page once to create it`}
                  >
                    <span
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ background: isCurrent ? T.orange : T.border }}
                    />
                    {b.name}
                    {!selectable && <span style={{ fontSize: 10.5, color: T.textMuted }}>· no container yet</span>}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
