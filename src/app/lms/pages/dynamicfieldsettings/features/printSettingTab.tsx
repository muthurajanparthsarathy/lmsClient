"use client";

// Dynamic Field Settings ▸ Print Setting.
//
// A print layout describes how a printed page is drawn: header text, logos,
// typography, watermark, signature/seal and footer. Pages that print ask the
// server to RESOLVE the layout for whichever client they are printing for.
//
// The scope rule is the feature, and the list is grouped to make it visible:
//
//   Common          one per institution, used by every client without its own
//   <client name>   that client's layout, which overrides the common one
//
// So an institution can have one house style and let individual clients
// deviate, without every page needing to know which is which.
//
// ── On the styling ────────────────────────────────────────────────────────
// The orange theme lives in two internal stylesheets below (PAGE_CSS and
// MODAL_CSS) plus inline styles on the few elements where the accent must
// survive regardless of stylesheet order. Both sheets are namespaced — .ps-page
// for the list, .ps-root for the dialog — so nothing here can leak into other
// screens that share Modal / Field / Input.
//
// The dialog is sized with :has(), which matches ONLY the Radix dialog that
// contains .ps-root. That keeps the shared Modal component untouched while
// still giving this one screen a 90vw × 90vh working area.

import React, { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast, Toaster } from "sonner";
import {
  Building2,
  ChevronDown,
  ChevronsDownUp,
  ChevronsUpDown,
  Droplets,
  Eye,
  FileText,
  Globe2,
  Image as ImageIcon,
  Layout,
  Loader2,
  Minus,
  Pencil,
  Plus,
  Printer,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  SquareDashedMousePointer,
  Target,
  Trash2,
  Type as TypeIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { http as apiClient } from "@/lib/http";
import {
  Modal,
  Field,
  Input,
  Textarea,
  EmptyState,
  SkeletonTable,
} from "@/app/lms/shared/ui";
import {
  TabCard,
  TabCardHeader,
  CountPill,
  ConfirmDeleteModal,
  RowIconButton,
  TH_CLASS,
  TD_CLASS,
} from "./ui";
import { usePermissions } from "@/hooks/usePermissions";
import { PERMISSION_IDS } from "@/app/lms/pages/usermanagement/components/permissions/index";
import {
  fetchPrintSettings,
  printSettingService,
  type PrintSetting,
  type PrintAssetField,
  type PrintSettingFiles,
  type TextStyle,
} from "../api/printSetting";
import PrintSettingPreview, { printTest } from "./PrintSettingPreview";
import PrintCanvasEditor, { clearDesignerHistory, useDesignerHistory } from "./PrintCanvasEditor";
import PrintCanvasSheet from "./PrintCanvasSheet";
import { seedCanvas } from "@/app/lms/shared/print/printLayout";

const PERMISSION_FN = "Print Setting";

interface ClientOption {
  _id: string;
  clientCompany: string;
  status?: string;
}

const COMMON = "__common__";

/** The step cards, in order — the list "Expand all" restores. */
const ALL_STEPS = [1, 2, 3, 4, 5];

/* ── Palette ─────────────────────────────────────────────────────────────────
   Declared once in JS as well as CSS, because a handful of elements (the modal
   title tile, the Save button, the active segment) take the accent as an inline
   style. Those are the pieces where the orange IS the design, so they are
   pinned twice rather than left to depend on stylesheet order.               */
const O = {
  base: "#F97316",
  deep: "#EA580C",
  dark: "#C2410C",
  darker: "#9A3412",
  tint: "#FFF7ED",
  tintWarm: "#FFF4EA",
  line: "#FFE4CC",
  lineStrong: "#FDBA8C",
  ink: "#1F2937",
  muted: "#6B7280",
  well: "#F9FAFB",
} as const;

const ALIGNMENTS = ["left", "center", "right"] as const;
const ORIENTATIONS = ["portrait", "landscape"] as const;
const MARGIN_SIDES = ["top", "bottom", "left", "right"] as const;
const WATERMARK_POSITIONS = ["center", "top", "bottom", "diagonal"] as const;

/** A watermark spans the page, so its sizes start where body text stops. */
const WATERMARK_FONT_SIZES = [
  "24px",
  "32px",
  "40px",
  "48px",
  "64px",
  "80px",
  "96px",
  "120px",
  "160px",
];

const FONT_FAMILIES = [
  "Arial, sans-serif",
  "Inter, sans-serif",
  "Georgia, serif",
  "Times New Roman, serif",
  "Courier New, monospace",
];
const FONT_SIZES = ["10px", "11px", "12px", "14px", "16px", "18px", "20px", "24px", "28px"];

/** Weight as CSS spells it, so the value can go straight into a style. */
const FONT_WEIGHTS = [
  { value: "normal", label: "Regular" },
  { value: "500", label: "Medium" },
  { value: "600", label: "Semibold" },
  { value: "bold", label: "Bold" },
];

/** The "spacing" the brief asks for: CSS letter-spacing, in plain steps. */
const LETTER_SPACINGS = [
  { value: "normal", label: "Normal" },
  { value: "0.5px", label: "Wide" },
  { value: "1px", label: "Wider" },
  { value: "2px", label: "Widest" },
];

// Kept as constants so the literal braces are never parsed as JSX expressions.
const FOOTER_HINT = "Tokens: {{date}} · {{page}} · {{totalPages}}";
const FOOTER_PLACEHOLDER = "Generated on {{date}} | Page {{page}} of {{totalPages}}";

/* ── Internal stylesheet: the list ───────────────────────────────────────── */

const PAGE_CSS = `
  .ps-page thead th {
    background: ${O.tint} !important;
    color: ${O.darker} !important;
    border-bottom: 1px solid ${O.line} !important;
    letter-spacing: .04em;
  }
  .ps-page tbody tr { border-bottom: 1px solid #F3F4F6 !important; }
  .ps-page tbody tr:hover { background: #FFFBF6 !important; }

  .ps-search {
    height: 38px;
    border: 1px solid ${O.line};
    border-radius: 10px;
    background: #FFFFFF;
    transition: border-color .15s, box-shadow .15s;
  }
  .ps-search:focus-within {
    border-color: ${O.base};
    box-shadow: 0 0 0 3px rgba(249, 115, 22, .15);
  }
  .ps-search svg { color: ${O.deep}; }

  .ps-scope-tile {
    display: inline-flex; align-items: center; justify-content: center;
    width: 28px; height: 28px; border-radius: 8px; flex-shrink: 0;
  }
  .ps-scope-common { background: ${O.tint}; color: ${O.deep}; border: 1px solid ${O.line}; }
  .ps-scope-client { background: #F3F4F6; color: #4B5563; border: 1px solid #E5E7EB; }

  .ps-chip {
    display: inline-flex; align-items: center;
    padding: 2px 8px; border-radius: 999px;
    font-size: 10px; font-weight: 600; line-height: 1.6;
    background: ${O.tint}; color: ${O.darker}; border: 1px solid ${O.line};
  }
  .ps-pill-on {
    display: inline-block;
    padding: 2px 9px; border-radius: 999px; font-size: 10px; font-weight: 700;
    background: ${O.base}; color: #FFFFFF;
  }
  .ps-pill-off {
    display: inline-block;
    padding: 2px 9px; border-radius: 999px; font-size: 10px; font-weight: 700;
    background: #E5E7EB; color: #6B7280;
  }

  .ps-page .ps-add {
    background: ${O.base} !important;
    border-color: ${O.base} !important;
    color: #FFFFFF !important;
    box-shadow: 0 1px 2px rgba(194, 65, 12, .25);
  }
  .ps-page .ps-add:hover { background: ${O.deep} !important; border-color: ${O.deep} !important; }

  .ps-note {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 3px 10px; border-radius: 999px;
    background: ${O.tint}; border: 1px solid ${O.line};
    color: ${O.darker}; font-size: 11px; font-weight: 500;
  }
`;

/* ── Internal stylesheet: the dialog ─────────────────────────────────────── */

const MODAL_CSS = `
  /* ── 98% of the viewport, both axes. Matches only the dialog holding
        .ps-root, so every other Modal in the app keeps its own size.

        The × --ui-scale-inv is not decoration: globals.css renders the whole
        app at zoom: .95 on desktop, and zoom scales viewport units too, so a
        plain 98vw lands at ~93% of the actual screen. Multiplying by the
        inverse that globals.css publishes gives a real 98% and keeps working
        if that knob is ever retuned (it is 1 on mobile, where the zoom is
        off, so this is a no-op there). ── */
  [role="dialog"]:has(.ps-root) {
    width: calc(98vw * var(--ui-scale-inv, 1)) !important;
    max-width: calc(98vw * var(--ui-scale-inv, 1)) !important;
    height: calc(98vh * var(--ui-scale-inv, 1)) !important;
    max-height: calc(98vh * var(--ui-scale-inv, 1)) !important;
    border: 0 !important;
    border-radius: 18px !important;
    overflow: hidden !important;
    box-shadow: 0 28px 70px rgba(124, 45, 18, .30), 0 2px 8px rgba(17, 24, 39, .10) !important;
  }

  /* Title bar → orange band. Kept deliberately short: it is a label, and every
     pixel it takes is one the form below does not get. */
  [role="dialog"]:has(.ps-root) > div:nth-of-type(1) {
    background: linear-gradient(120deg, ${O.base} 0%, ${O.deep} 55%, ${O.dark} 100%) !important;
    border-bottom: 0 !important;
    padding: 8px 16px !important;
    align-items: center !important;
  }
  [role="dialog"]:has(.ps-root) > div:nth-of-type(1) button {
    color: #FFFFFF !important;
    background: rgba(255, 255, 255, .18) !important;
    border-radius: 8px !important;
    margin: 0 !important;
    padding: 5px !important;
  }
  [role="dialog"]:has(.ps-root) > div:nth-of-type(1) button:hover {
    background: rgba(255, 255, 255, .34) !important;
  }

  /* Body → no padding; the two columns own their own scroll. */
  [role="dialog"]:has(.ps-root) > div:nth-of-type(2) {
    padding: 0 !important;
    overflow: hidden !important;
    background: ${O.tintWarm} !important;
  }

  /* Action bar. */
  [role="dialog"]:has(.ps-root) > div:last-child {
    background: #FFFFFF !important;
    border-top: 1px solid ${O.line} !important;
    padding: 12px 22px !important;
  }

  /* ── Two-column shell ── */
  .ps-root {
    display: grid;
    grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr);
    height: 100%;
    min-height: 0;
    color: ${O.ink};
  }
  @media (max-width: 1100px) {
    .ps-root { grid-template-columns: minmax(0, 1fr); }
    .ps-pane-preview { border-left: 0 !important; border-top: 1px solid ${O.line}; }
  }

  .ps-pane-form {
    min-height: 0;
    overflow-y: auto;
    padding: 16px 18px 24px;
    background: #FFFFFF;
  }
  .ps-pane-preview {
    min-height: 0;
    overflow-y: auto;
    padding: 16px 18px 24px;
    background: ${O.tintWarm};
    border-left: 1px solid ${O.line};
  }

  /* Thin orange scrollbars, so the two panes read as one surface. */
  .ps-pane-form::-webkit-scrollbar,
  .ps-pane-preview::-webkit-scrollbar { width: 8px; }
  .ps-pane-form::-webkit-scrollbar-thumb,
  .ps-pane-preview::-webkit-scrollbar-thumb {
    background: ${O.lineStrong}; border-radius: 999px;
    border: 2px solid transparent; background-clip: content-box;
  }
  .ps-pane-form::-webkit-scrollbar-thumb:hover,
  .ps-pane-preview::-webkit-scrollbar-thumb:hover {
    background: ${O.base}; background-clip: content-box;
  }

  /* ── Scope banner. One line of context, sized like one. ── */
  .ps-banner {
    display: flex; align-items: center; gap: 8px;
    padding: 6px 10px; margin-bottom: 9px;
    border-radius: 9px;
    background: ${O.tint};
    border: 1px solid ${O.line};
    border-left: 3px solid ${O.base};
  }
  .ps-banner-icon {
    display: inline-flex; align-items: center; justify-content: center;
    width: 22px; height: 22px; border-radius: 6px; flex-shrink: 0;
    background: ${O.base}; color: #FFFFFF;
  }
  .ps-banner-text {
    min-width: 0; font-size: 11px; color: ${O.darker}; line-height: 1.35;
  }
  .ps-banner-text b { font-weight: 700; }

  /* ── Section card ── */
  .ps-section {
    background: #FFFFFF;
    border: 1px solid #EFEFEF;
    border-radius: 13px;
    margin-bottom: 12px;
    overflow: hidden;
    box-shadow: 0 1px 2px rgba(17, 24, 39, .05);
  }
  .ps-section-head {
    display: flex; align-items: center; gap: 12px;
    padding: 11px 14px;
    background: linear-gradient(180deg, ${O.tint} 0%, #FFFDFB 100%);
    border-bottom: 1px solid ${O.line};
  }
  /* A collapsed card is one flat bar — no border under a head with nothing
     beneath it. */
  .ps-section:not(.is-open) .ps-section-head { border-bottom: 0; }

  /* The title is the toggle. It sits beside the section switch rather than
     wrapping it, so tapping "Show header" never also collapses the card. */
  .ps-section-btn {
    flex: 1; min-width: 0;
    display: flex; align-items: center; gap: 10px;
    padding: 0; margin: 0; border: 0; background: transparent;
    font: inherit; text-align: left; cursor: pointer;
    font-size: 13.5px; font-weight: 700; color: ${O.darker};
  }
  .ps-section-btn:focus-visible {
    outline: 2px solid ${O.base}; outline-offset: 3px; border-radius: 8px;
  }
  .ps-section-icon {
    display: inline-flex; align-items: center; justify-content: center;
    width: 30px; height: 30px; border-radius: 9px; flex-shrink: 0;
    background: ${O.base}; color: #FFFFFF;
    box-shadow: 0 2px 5px rgba(234, 88, 12, .35);
  }
  .ps-section-step {
    font-size: 10px; font-weight: 700; color: ${O.deep};
    background: #FFFFFF; border: 1px solid ${O.line};
    border-radius: 999px; padding: 1px 7px; flex-shrink: 0;
  }
  /* Leads the row, before the section icon. Collapsed points right, expanded
     points down — the direction is the state, so the card reads as open or
     closed from the arrow alone without comparing it to its neighbours. */
  .ps-section-chev {
    width: 21px; height: 21px; flex-shrink: 0;
    color: ${O.deep}; stroke-width: 2.5;
    transform: rotate(-90deg);
    transition: transform .2s ease;
  }
  .ps-section.is-open .ps-section-chev { transform: rotate(0deg); }
  .ps-section-body { padding: 13px 14px 15px; }

  /* Expand / collapse all. The arrow leads, because it is what carries the
     meaning — the double chevron says "all of them" at a glance, which the
     word alone does not. Sized well above the label so it reads as the icon
     for the action rather than decoration on it. */
  .ps-steps-bar {
    display: flex; align-items: center; justify-content: flex-end;
    gap: 6px; margin-bottom: 9px;
  }
  .ps-steps-btn {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 4px 12px 4px 9px; border-radius: 999px; cursor: pointer;
    font-size: 11.5px; font-weight: 700;
    background: #FFFFFF; border: 1px solid ${O.line}; color: ${O.deep};
    transition: background .15s, color .15s, border-color .15s;
  }
  .ps-steps-btn:hover { background: ${O.base}; border-color: ${O.base}; color: #FFFFFF; }
  .ps-steps-icon { width: 19px; height: 19px; flex-shrink: 0; stroke-width: 2.4; }

  .ps-subpanel {
    margin-top: 11px;
    padding: 11px;
    border-radius: 10px;
    background: #FFFBF7;
    border: 1px dashed ${O.lineStrong};
  }
  .ps-subpanel-title {
    display: flex; align-items: center; gap: 6px;
    margin: 0 0 9px; font-size: 11px; font-weight: 700;
    text-transform: uppercase; letter-spacing: .05em; color: ${O.deep};
  }
  /* A sub-panel whose heading carries its own control, e.g. Logo Yes/No. */
  .ps-subpanel-head {
    display: flex; align-items: center; justify-content: space-between;
    gap: 12px; margin-bottom: 10px;
  }

  /* Yes / No pair */
  .ps-yesno { display: inline-flex; gap: 0; flex-shrink: 0; }
  .ps-yesno-btn {
    min-width: 46px; height: 28px; cursor: pointer;
    font-size: 12px; font-weight: 700; color: #4B5563;
    background: #FFFFFF; border: 1px solid #E7E7E7;
    transition: all .15s;
  }
  .ps-yesno-btn:first-child { border-radius: 8px 0 0 8px; }
  .ps-yesno-btn:last-child { border-radius: 0 8px 8px 0; margin-left: -1px; }
  .ps-yesno-btn:hover { border-color: ${O.lineStrong}; }

  /* Slider + its readout */
  .ps-slider { display: flex; align-items: center; gap: 9px; height: 38px; }
  .ps-slider input[type="range"] { flex: 1; min-width: 0; }
  .ps-slider-value {
    min-width: 50px; text-align: center; flex-shrink: 0;
    font-size: 11.5px; font-weight: 700; color: ${O.deep};
    background: ${O.tint}; border: 1px solid ${O.line};
    border-radius: 999px; padding: 3px 0;
    font-variant-numeric: tabular-nums;
  }

  /* The line a disabled section shows in place of its fields. */
  .ps-hint-row {
    margin: 0; padding: 9px 11px; border-radius: 9px;
    background: ${O.well}; border: 1px dashed #D9DDE3;
    font-size: 12px; color: ${O.muted};
  }

  /* ── Controls ── */
  .ps-root label {
    color: ${O.muted} !important;
    font-size: 12px !important;
    font-weight: 600 !important;
    margin-bottom: 5px !important;
  }
  .ps-root label span { color: ${O.deep} !important; }

  .ps-root input:not([type="checkbox"]):not([type="range"]):not([type="color"]):not([type="file"]),
  .ps-root select,
  .ps-root textarea {
    width: 100%;
    height: 38px;
    border: 1px solid #E7E7E7 !important;
    border-radius: 9px !important;
    background: #FFFFFF !important;
    color: ${O.ink} !important;
    font-size: 13px !important;
    padding: 0 10px;
    transition: border-color .15s, box-shadow .15s;
  }
  .ps-root textarea { height: auto; min-height: 58px; padding: 8px 10px; line-height: 1.45; }
  .ps-root select { cursor: pointer; }
  .ps-root input:focus,
  .ps-root select:focus,
  .ps-root textarea:focus {
    border-color: ${O.base} !important;
    box-shadow: 0 0 0 3px rgba(249, 115, 22, .16) !important;
    outline: none !important;
  }
  .ps-root input::placeholder, .ps-root textarea::placeholder { color: #B6BCC6; }
  .ps-root input[type="range"] { height: auto; padding: 0; accent-color: ${O.base}; }
  .ps-root input[type="checkbox"] { height: auto; width: auto; accent-color: ${O.base}; }

  .ps-root input[type="file"] {
    height: auto; padding: 0; border: 0 !important; background: transparent !important;
    font-size: 11px; color: ${O.muted};
  }
  .ps-root input[type="file"]::file-selector-button {
    background: ${O.tint}; color: ${O.deep};
    border: 1px solid ${O.line}; border-radius: 7px;
    padding: 4px 10px; margin-right: 8px;
    font-weight: 700; font-size: 11px; cursor: pointer;
    transition: background .15s;
  }
  .ps-root input[type="file"]::file-selector-button:hover { background: ${O.line}; }

  .ps-color {
    display: flex; align-items: center; gap: 8px;
    height: 38px; padding: 0 8px;
    border: 1px solid #E7E7E7; border-radius: 9px; background: #FFFFFF;
  }
  .ps-color:focus-within { border-color: ${O.base}; box-shadow: 0 0 0 3px rgba(249,115,22,.16); }
  .ps-color-swatch {
    width: 24px !important; height: 24px !important; flex-shrink: 0;
    padding: 0 !important; border: 1px solid #E7E7E7 !important; border-radius: 6px !important;
    background: transparent !important; cursor: pointer;
  }
  /* flex:1 + width:auto, because the generic input rule above sets width:100%
     and a 100%-wide flex item pushes the swatch out of the box. */
  .ps-color-hex {
    flex: 1; min-width: 0; width: auto !important;
    height: 24px !important; border: 0 !important; box-shadow: none !important;
    padding: 0 !important; font-size: 12.5px !important;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace !important;
    text-transform: uppercase;
  }
  .ps-color-hex:focus { box-shadow: none !important; }

  /* Switch */
  .ps-switch {
    display: inline-flex; align-items: center; gap: 8px;
    font-size: 12px; font-weight: 600; color: ${O.darker};
    background: transparent; border: 0; cursor: pointer; padding: 0;
  }
  .ps-switch-track {
    position: relative; width: 38px; height: 21px; border-radius: 999px;
    background: #D8DCE2; transition: background .18s; flex-shrink: 0;
  }
  .ps-switch-track.is-on { background: ${O.base}; box-shadow: inset 0 0 0 1px ${O.deep}; }
  .ps-switch-thumb {
    position: absolute; top: 2.5px; width: 16px; height: 16px;
    border-radius: 999px; background: #FFFFFF; transition: left .18s;
    box-shadow: 0 1px 3px rgba(17, 24, 39, .30);
  }

  /* Segmented */
  .ps-seg-group { display: flex; gap: 6px; }
  .ps-seg {
    flex: 1; height: 38px; border-radius: 9px; cursor: pointer;
    border: 1px solid #E7E7E7; background: #FFFFFF; color: #4B5563;
    font-size: 13px; transition: all .15s;
  }
  .ps-seg:hover { border-color: ${O.lineStrong}; background: ${O.tint}; }

  /* Checkbox row. This IS a <label>, so every property the generic
     ".ps-root label" rule sets with !important has to be won back here. */
  .ps-check {
    display: inline-flex !important; align-items: center; gap: 7px;
    font-size: 12.5px !important; font-weight: 500 !important;
    color: #374151 !important; cursor: pointer;
    margin-bottom: 0 !important;
    padding: 6px 11px; border-radius: 9px;
    background: #FFFFFF; border: 1px solid #E7E7E7; transition: all .15s;
  }
  .ps-check:hover { border-color: ${O.lineStrong}; background: ${O.tint}; }
  .ps-check.is-on {
    border-color: ${O.base}; background: ${O.tint};
    color: ${O.darker} !important; font-weight: 600 !important;
  }

  /* Asset tile */
  .ps-asset {
    border: 1px solid #EFEFEF; border-radius: 10px; padding: 10px;
    background: #FFFFFF; transition: border-color .15s;
  }
  .ps-asset:hover { border-color: ${O.lineStrong}; }
  .ps-asset-name { font-size: 12px; font-weight: 700; color: ${O.ink}; margin: 0; }
  .ps-asset-hint { font-size: 10.5px; color: #9CA3AF; margin: 2px 0 0; }
  .ps-asset-thumb {
    height: 40px; width: auto; max-width: 100%;
    object-fit: contain; border-radius: 6px;
    border: 1px solid ${O.line}; background: #FFFFFF; padding: 2px;
  }
  .ps-asset-preview {
    display: flex; align-items: center; gap: 9px;
    margin-top: 8px; flex-wrap: wrap;
  }
  .ps-asset-remove {
    display: inline-flex; align-items: center; gap: 5px;
    padding: 4px 10px; border-radius: 999px; cursor: pointer;
    font-size: 11px; font-weight: 700;
    background: #FFFFFF; border: 1px solid #FCA5A5; color: #DC2626;
    transition: background .15s, color .15s, border-color .15s;
  }
  .ps-asset-remove:hover { background: #DC2626; border-color: #DC2626; color: #FFFFFF; }

  /* Number with − / + */
  .ps-stepper {
    display: flex; align-items: center; height: 38px;
    /* A three-digit number needs nothing like the full column. */
    max-width: 150px;
    border: 1px solid #E7E7E7; border-radius: 9px;
    background: #FFFFFF; overflow: hidden;
  }
  .ps-stepper:focus-within {
    border-color: ${O.base}; box-shadow: 0 0 0 3px rgba(249, 115, 22, .16);
  }
  .ps-stepper-btn {
    display: inline-flex; align-items: center; justify-content: center;
    width: 32px; height: 100%; flex-shrink: 0; cursor: pointer;
    background: ${O.tint}; border: 0; color: ${O.deep};
    transition: background .15s, color .15s;
  }
  .ps-stepper-btn:hover { background: ${O.base}; color: #FFFFFF; }
  .ps-stepper input.ps-stepper-input {
    flex: 1; min-width: 0; width: auto !important; height: 100% !important;
    border: 0 !important; border-radius: 0 !important; box-shadow: none !important;
    text-align: center; padding: 0 2px !important;
    font-variant-numeric: tabular-nums; font-weight: 600;
  }
  .ps-stepper input.ps-stepper-input:focus { box-shadow: none !important; }
  .ps-stepper-suffix {
    padding-right: 8px; font-size: 11.5px; font-weight: 600; color: ${O.muted};
  }

  /* Grids.
     align-items:start is what makes a row of mixed controls line up: without
     it a 38px select stretches to match a 58px textarea beside it, and the
     two labels no longer sit on the same line.
     Each section uses ONE grid for all its fields, so column 1/2/3 stay in
     the same place from row to row instead of every row re-splitting the
     width to suit its own field count. */
  .ps-grid-2, .ps-grid-3, .ps-grid-4 { display: grid; align-items: start; }
  .ps-grid-2 { gap: 11px; grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .ps-grid-3 { gap: 11px; grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .ps-grid-4 { gap: 9px; grid-template-columns: repeat(4, minmax(0, 1fr)); }
  /* A field that should occupy two of the three columns — the footer's token
     line needs the room, and this keeps it on the same tracks as the rest. */
  .ps-span-2 { grid-column: span 2; }
  @media (max-width: 720px) {
    .ps-grid-2, .ps-grid-3, .ps-grid-4 { grid-template-columns: minmax(0, 1fr); }
    .ps-span-2 { grid-column: auto; }
  }

  /* ── Preview pane ── */
  .ps-preview-bar {
    display: flex; align-items: center; justify-content: space-between;
    gap: 10px; margin-bottom: 10px; flex-wrap: wrap;
  }
  .ps-preview-title {
    display: flex; align-items: center; gap: 7px; margin: 0;
    font-size: 13.5px; font-weight: 700; color: ${O.darker};
  }
  .ps-preview-badge {
    font-size: 10.5px; font-weight: 700; letter-spacing: .03em;
    padding: 3px 9px; border-radius: 999px;
    background: #FFFFFF; border: 1px solid ${O.line}; color: ${O.deep};
  }
  .ps-refresh {
    display: inline-flex; align-items: center; gap: 5px;
    padding: 4px 10px; border-radius: 999px; cursor: pointer;
    font-size: 11px; font-weight: 700;
    background: #FFFFFF; border: 1px solid ${O.line}; color: ${O.deep};
    transition: background .15s, color .15s, border-color .15s;
  }
  .ps-refresh:hover { background: ${O.base}; border-color: ${O.base}; color: #FFFFFF; }

  .ps-mode-btn {
    display: inline-flex; align-items: center; gap: 5px;
    padding: 4px 11px; border-radius: 999px; cursor: pointer;
    font-size: 11px; font-weight: 700;
    background: #FFFFFF; border: 1px solid ${O.line}; color: ${O.deep};
    transition: background .15s, color .15s, border-color .15s;
  }
  .ps-mode-btn:hover { background: ${O.tint}; border-color: ${O.lineStrong}; }
  .ps-mode-btn[aria-pressed="true"] {
    background: ${O.base}; border-color: ${O.base}; color: #FFFFFF;
    box-shadow: 0 1px 3px rgba(234, 88, 12, .30);
  }

  /* The designer takes the wider column and the pane's full height. */
  @media (min-width: 1101px) {
    .ps-root.is-design { grid-template-columns: minmax(0, 1fr) minmax(0, 1.7fr); }
  }
  .ps-root.is-design .ps-pane-preview { display: flex; flex-direction: column; }

  .ps-paper-well {
    border-radius: 13px; padding: 16px;
    background: repeating-linear-gradient(45deg, #FFFFFF 0 10px, #FFFAF5 10px 20px);
    border: 1px solid ${O.line};
  }
  .ps-preview-note { margin: 10px 0 0; font-size: 10.5px; line-height: 1.5; color: #9A8878; }

  /* ── Action bar ── */
  .ps-actions { display: flex; width: 100%; align-items: center; justify-content: space-between; gap: 12px; }
  .ps-actions-right { display: flex; align-items: center; gap: 10px; }
  .ps-btn-ghost {
    border-color: ${O.line} !important;
    color: ${O.deep} !important;
    background: #FFFFFF !important;
  }
  .ps-btn-ghost:hover { background: ${O.tint} !important; }
  .ps-btn-save {
    background: ${O.base} !important;
    border-color: ${O.base} !important;
    color: #FFFFFF !important;
    box-shadow: 0 2px 6px rgba(234, 88, 12, .35);
  }
  .ps-btn-save:hover:not(:disabled) { background: ${O.deep} !important; border-color: ${O.deep} !important; }
  .ps-btn-save:disabled { opacity: .55; }
`;

const titleCase = (value: string) =>
  value ? value.charAt(0).toUpperCase() + value.slice(1) : value;

/** Where each uploadable asset's saved URL lives on the document. */
const assetUrlOf = (draft: Partial<PrintSetting>, field: PrintAssetField) => {
  switch (field) {
    case "leftLogo":
      return draft.logoSettings?.leftLogoUrl;
    case "rightLogo":
      return draft.logoSettings?.rightLogoUrl;
    case "signature":
      return draft.signature?.signatureUrl;
    case "seal":
      return draft.signature?.sealUrl;
    default:
      return draft.watermarkSettings?.watermarkUrl;
  }
};

/**
 * Which header logo slots a position uses. The uploads live in the Header
 * section and follow this, so a layout set to "left" never shows a right-logo
 * picker that would upload a file the page will not print.
 */
const logoSlots = (position?: string) => ({
  left: position !== "right",
  right: position === "right" || position === "both",
});

const clientIdOf = (setting: PrintSetting): string | null => {
  const value = setting.clientId;
  if (!value) return null;
  return typeof value === "string" ? value : value._id;
};

const clientNameOf = (setting: PrintSetting): string => {
  const value = setting.clientId;
  if (!value) return "Common (all clients)";
  if (typeof value === "string") return "Client";
  return value.clientCompany || "Client";
};

const emptyDraft = (): Partial<PrintSetting> => ({
  clientId: null,
  status: "active",
  headerData: {
    name: "",
    text: "",
    description: "",
    showLogo: true,
    alignment: "left",
    logoPosition: "left",
    logoPlacement: "corner",
    background: "#FFFFFF",
  },
  footerData: { text: FOOTER_PLACEHOLDER, alignment: "center" },
  pageSettings: {
    pageSize: "A4",
    orientation: "portrait",
    showHeader: true,
    showFooter: true,
    margins: { top: 12, bottom: 12, left: 12, right: 12 },
  },
  typography: {
    headerData: {
      family: "Inter, sans-serif",
      size: "16px",
      weight: "bold",
      color: "#1F2937",
      align: "left",
      letterSpacing: "normal",
    },
    headerDescription: {
      family: "Inter, sans-serif",
      size: "11px",
      weight: "normal",
      color: "#6B7280",
      align: "left",
      letterSpacing: "normal",
    },
    footerData: {
      family: "Inter, sans-serif",
      size: "12px",
      weight: "normal",
      color: "#6B7280",
      align: "center",
      letterSpacing: "normal",
    },
  },
  logoSettings: {
    showLeftLogo: true,
    showRightLogo: false,
    leftLogoSize: "medium",
    rightLogoSize: "medium",
    leftLogoHeight: 44,
    rightLogoHeight: 44,
  },
  watermarkSettings: {
    showWatermark: false,
    type: "text",
    opacity: 25,
    rotation: 0,
    scale: 100,
    size: "medium",
    text: "CONFIDENTIAL",
    position: "center",
    fontStyle: "italic",
    fontWeight: "normal",
    fontSize: "64px",
    letterSpacing: "normal",
    imageWidth: 260,
    fontFamily: "Inter, sans-serif",
    color: "#9CA3AF",
  },
  footerSetting: {
    showSignatory: true,
    showDate: true,
    showSeal: true,
    signatoryPosition: 1,
    datePosition: 2,
    sealPosition: 3,
  },
});

export default function PrintSettingTab() {
  const queryClient = useQueryClient();
  const { can } = usePermissions();
  const allowed = can(PERMISSION_IDS.ADMIN_DYNAMIC_FIELD_SETTINGS, PERMISSION_FN);

  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<PrintSetting | null>(null);
  const [draft, setDraft] = useState<Partial<PrintSetting>>(emptyDraft());
  const [files, setFiles] = useState<PrintSettingFiles>({});
  const [open, setOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<PrintSetting | null>(null);
  const [previewNonce, setPreviewNonce] = useState(0);
  // Which step cards are expanded. Step 1 alone, so the form opens short
  // enough to see all six headings at once instead of a wall of inputs.
  const [openSteps, setOpenSteps] = useState<number[]>([1]);
  /** Saved images the user has cleared — told to the server on save. */
  const [removedAssets, setRemovedAssets] = useState<PrintAssetField[]>([]);
  /** Anything typed, picked or cleared since the dialog opened. */
  const [dirty, setDirty] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  /** The drag-and-drop designer replaces the flat preview while on. */
  const [designMode, setDesignMode] = useState(false);
  const designerHistory = useDesignerHistory();

  const settingsQuery = useQuery({
    queryKey: ["print-settings"],
    queryFn: fetchPrintSettings,
    enabled: allowed,
  });

  // Only loaded while the dialog is open — the picker is the only consumer.
  const clientsQuery = useQuery({
    queryKey: ["print-settings", "clients"],
    queryFn: async (): Promise<ClientOption[]> => {
      const response = await apiClient.get("/client-management/getAll");
      const raw = response.data?.clients ?? response.data?.data ?? response.data ?? [];
      return (Array.isArray(raw) ? raw : []).map((item: ClientOption) => ({
        _id: item._id,
        clientCompany: item.clientCompany,
        status: item.status,
      }));
    },
    enabled: allowed && open,
  });

  const settings = useMemo(() => settingsQuery.data ?? [], [settingsQuery.data]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return settings;
    return settings.filter((setting) =>
      [setting.title, setting.description, clientNameOf(setting), setting.status]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(needle))
    );
  }, [settings, query]);

  // Which client ids already have a layout — the picker hides them, because
  // the server rejects a second one anyway and a 409 is a worse way to learn.
  const takenClientIds = useMemo(() => {
    const taken = new Set<string>();
    for (const setting of settings) {
      if (editing && setting._id === editing._id) continue;
      const id = clientIdOf(setting);
      if (id) taken.add(id);
    }
    return taken;
  }, [settings, editing]);

  const commonTaken = useMemo(
    () =>
      settings.some(
        (setting) => !clientIdOf(setting) && (!editing || setting._id !== editing._id)
      ),
    [settings, editing]
  );

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["print-settings"] });
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      // `title` is no longer a form field — the brief dropped it — but it is
      // what the list column shows, so it follows the header title rather
      // than leaving every row blank.
      const payload: Partial<PrintSetting> = {
        ...draft,
        title: draft.headerData?.text?.trim() || "Print layout",
      };
      // The server reads multipart text fields up to 1 MB.
      if (JSON.stringify(payload.canvasElements ?? []).length > 900_000) {
        throw new Error("The layout is too large — remove or shrink images added in the designer.");
      }
      if (editing) {
        return printSettingService.update(editing._id, payload, files, removedAssets);
      }
      return printSettingService.create(payload, files);
    },
    onSuccess: () => {
      toast.success(editing ? "Print setting updated" : "Print setting created");
      invalidate();
      closeModal();
    },
    onError: (error: Error) => toast.error(error.message || "Could not save"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => printSettingService.remove(id),
    onSuccess: () => {
      toast.success("Print setting deleted");
      invalidate();
      setDeleteTarget(null);
    },
    onError: (error: Error) => toast.error(error.message || "Could not delete"),
  });

  const openCreate = () => {
    setEditing(null);
    setDraft(emptyDraft());
    setFiles({});
    setRemovedAssets([]);
    setDirty(false);
    setOpenSteps([1]);
    setDesignMode(false);
    clearDesignerHistory(designerHistory);
    setOpen(true);
  };

  const openEdit = (setting: PrintSetting) => {
    setEditing(setting);
    setDraft({ ...setting, clientId: clientIdOf(setting) });
    setFiles({});
    setRemovedAssets([]);
    setDirty(false);
    setOpenSteps([1]);
    setDesignMode(false);
    clearDesignerHistory(designerHistory);
    setOpen(true);
  };

  const stepOpen = (step: number) => openSteps.includes(step);
  const toggleStep = (step: number) =>
    setOpenSteps((current) =>
      current.includes(step) ? current.filter((n) => n !== step) : [...current, step]
    );

  /**
   * Where a cleared image's URL lives, so removing one updates the preview at
   * once rather than only after the save round-trips.
   */
  const clearAssetUrl = (
    current: Partial<PrintSetting>,
    field: PrintAssetField
  ): Partial<PrintSetting> => {
    switch (field) {
      case "leftLogo":
        return { ...current, logoSettings: { ...current.logoSettings, leftLogoUrl: "" } };
      case "rightLogo":
        return { ...current, logoSettings: { ...current.logoSettings, rightLogoUrl: "" } };
      case "signature":
        return { ...current, signature: { ...current.signature, signatureUrl: "" } };
      case "seal":
        return { ...current, signature: { ...current.signature, sealUrl: "" } };
      default:
        return {
          ...current,
          watermarkSettings: { ...current.watermarkSettings, watermarkUrl: "" },
        };
    }
  };

  /**
   * Clear an image: drop any staged file, blank the stored URL locally, and
   * remember to tell the server on save. Uploading a replacement was
   * previously the only way to change an image, which left no way at all to
   * say "no image".
   */
  const removeAsset = (field: PrintAssetField) => {
    setFiles((current) => ({ ...current, [field]: null }));
    setDraft((current) => clearAssetUrl(current, field));
    setRemovedAssets((current) =>
      current.includes(field) ? current : [...current, field]
    );
    setDirty(true);
  };

  const closeModal = () => {
    setOpen(false);
    setEditing(null);
    setFiles({});
    setRemovedAssets([]);
    setDirty(false);
    setConfirmClose(false);
  };

  /**
   * Closing throws away everything typed since the dialog opened, and this
   * form is long enough that the loss is real. An untouched form closes
   * straight away — a confirmation nobody needs is just a second click.
   */
  const requestClose = () => {
    if (dirty) setConfirmClose(true);
    else closeModal();
  };

  /**
   * Back to where this dialog started — a blank layout when adding, the saved
   * one when editing. Picked-but-unsaved files go too: they are part of the
   * edit being discarded, and leaving them staged would upload them on the
   * next save of a layout that no longer references them.
   */
  const resetDraft = () => {
    setDraft(editing ? { ...editing, clientId: clientIdOf(editing) } : emptyDraft());
    setFiles({});
    clearDesignerHistory(designerHistory);
    toast.success(editing ? "Reverted to the saved layout" : "Form reset");
  };

  // Reset the file inputs whenever the dialog closes, so a picked-then-cancelled
  // logo is not silently uploaded on the next save.
  useEffect(() => {
    if (!open) setFiles({});
  }, [open]);

  /**
   * Blob URLs for images chosen but not yet uploaded.
   *
   * Without these the preview can only show what Cloudinary already has, so
   * every logo looks missing until you save — which is exactly the wrong
   * moment to find out it was the wrong file. These make the picked file
   * visible immediately, in the preview AND in the print test.
   */
  const localAssetUrls = useMemo(() => {
    const map: Partial<Record<PrintAssetField, string>> = {};
    for (const [field, file] of Object.entries(files)) {
      if (file) map[field as PrintAssetField] = URL.createObjectURL(file);
    }
    return map;
  }, [files]);

  // An un-revoked blob URL pins its file in memory for the life of the
  // document, so each set is released as soon as it is replaced.
  useEffect(
    () => () => {
      for (const url of Object.values(localAssetUrls)) URL.revokeObjectURL(url);
    },
    [localAssetUrls]
  );

  /** The draft with any just-picked files overlaid — what the preview renders. */
  const previewSetting = useMemo<Partial<PrintSetting>>(() => {
    const local = localAssetUrls;
    if (Object.keys(local).length === 0) return draft;
    return {
      ...draft,
      logoSettings: {
        ...draft.logoSettings,
        ...(local.leftLogo ? { leftLogoUrl: local.leftLogo } : {}),
        ...(local.rightLogo ? { rightLogoUrl: local.rightLogo } : {}),
      },
      signature: {
        ...draft.signature,
        ...(local.signature ? { signatureUrl: local.signature } : {}),
        ...(local.seal ? { sealUrl: local.seal } : {}),
      },
      watermarkSettings: {
        ...draft.watermarkSettings,
        ...(local.watermark ? { watermarkUrl: local.watermark } : {}),
      },
    };
  }, [draft, localAssetUrls]);

  // Until the first canvas edit, the designer shows a layout generated from the form.
  const seededCanvas = useMemo(() => seedCanvas(previewSetting), [previewSetting]);
  const hasCanvas = !!draft.canvasElements?.length;
  const canvasElements = hasCanvas ? draft.canvasElements ?? [] : seededCanvas;

  /**
   * Every field edit routes through these two.
   *
   * `dirty` drives the close confirmation, and a confirmation that misses an
   * edit is worse than none — so the flag is set in the same place the value
   * changes rather than inferred by diffing the draft afterwards.
   */
  const updateDraft: typeof setDraft = (value) => {
    setDirty(true);
    setDraft(value);
  };

  const stageFile = (field: PrintAssetField, file: File | null) => {
    setDirty(true);
    setFiles((current) => ({ ...current, [field]: file }));
  };

  const patch = <K extends keyof PrintSetting>(key: K, value: PrintSetting[K]) =>
    updateDraft((current) => ({ ...current, [key]: value }));

  const patchSection = (
    section:
      | "headerData"
      | "footerData"
      | "pageSettings"
      | "logoSettings"
      | "watermarkSettings"
      | "footerSetting"
      | "signature",
    key: string,
    value: unknown
  ) =>
    updateDraft((current) => ({
      ...current,
      [section]: { ...(current[section] as Record<string, unknown>), [key]: value },
    }));

  const patchMargin = (side: (typeof MARGIN_SIDES)[number], value: number) =>
    updateDraft((current) => ({
      ...current,
      pageSettings: {
        ...current.pageSettings,
        margins: { ...current.pageSettings?.margins, [side]: value },
      },
    }));

  const patchTypography = (
    group: "headerData" | "headerDescription" | "footerData",
    key: string,
    value: string
  ) =>
    updateDraft((current) => ({
      ...current,
      typography: {
        ...current.typography,
        [group]: { ...current.typography?.[group], [key]: value },
      },
    }));

  /**
   * Logo position drives two things at once: which slots print, and the
   * showLeftLogo / showRightLogo flags the document also carries. Writing
   * both here keeps them from disagreeing — a stored layout that says
   * "position: both" but "showRightLogo: false" has no defensible meaning.
   */
  const setLogoPosition = (position: string) =>
    updateDraft((current) => {
      const slots = logoSlots(position);
      return {
        ...current,
        headerData: {
          ...current.headerData,
          logoPosition: position as NonNullable<PrintSetting["headerData"]>["logoPosition"],
        },
        logoSettings: {
          ...current.logoSettings,
          showLeftLogo: slots.left,
          showRightLogo: slots.right,
        },
      };
    });

  if (!allowed) {
    return (
      <TabCard>
        <EmptyState
          icon={Printer}
          title="No access"
          message="You don't have permission to manage print settings."
          className="py-16"
        />
      </TabCard>
    );
  }

  const scopeValue =
    draft.clientId == null
      ? COMMON
      : typeof draft.clientId === "string"
        ? draft.clientId
        : draft.clientId._id;

  const scopeName =
    scopeValue === COMMON
      ? "Common (all clients)"
      : (clientsQuery.data ?? []).find((client) => client._id === scopeValue)
          ?.clientCompany || "this client";

  const headerSlots = logoSlots(draft.headerData?.logoPosition);
  const bothSides = draft.headerData?.logoPosition === "both";
  // !== false, so a layout saved before the Yes/No gate existed still shows
  // the logo it was set up with.
  const showLogo = draft.headerData?.showLogo !== false;
  const markType = draft.watermarkSettings?.type || "text";

  return (
    <div className="ps-page">
      {/* The app-wide toaster is react-hot-toast; this tab's messages use sonner. */}
      <Toaster position="top-right" richColors closeButton />
      {/* Internal stylesheet for the list, scoped to .ps-page. */}
      <style dangerouslySetInnerHTML={{ __html: PAGE_CSS }} />

      <TabCard>
        <TabCardHeader
          icon={Printer}
          title="Print settings"
          subtitle="Header, footer, logos and watermark for printed pages — per client, or one common layout."
          actions={
            <>
              <CountPill
                value={settings.length}
                label={settings.length === 1 ? "layout" : "layouts"}
              />
              <Button size="sm" className="ps-add" onClick={openCreate}>
                <Plus className="h-4 w-4" />
                Add print setting
              </Button>
            </>
          }
        />

        <div className="flex flex-wrap items-center gap-2.5 border-b border-hairline px-5 py-3">
          <div className="ps-search flex min-w-0 max-w-md flex-1 items-center gap-2 px-3">
            <Search aria-hidden className="size-4 shrink-0" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search title, client or status…"
              className="min-w-0 flex-1 bg-transparent text-[13px] text-body outline-none placeholder:text-faint"
            />
          </div>
          {!commonTaken ? (
            <span className="ps-note">
              <Globe2 aria-hidden className="size-3.5" />
              No common layout yet — clients without their own will print unstyled.
            </span>
          ) : null}
        </div>

        {settingsQuery.isLoading ? (
          <SkeletonTable rows={4} cols={5} />
        ) : settingsQuery.isError ? (
          <EmptyState
            icon={Printer}
            title="Could not load print settings"
            message={(settingsQuery.error as Error)?.message || "Please try again."}
            className="py-12"
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Printer}
            title={query ? "No matches" : "No print settings yet"}
            message={
              query
                ? "No layout matches that search."
                : "Add a common layout first — every client without its own will use it."
            }
            className="py-12"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse">
              <thead>
                <tr>
                  <th className={TH_CLASS}>Scope</th>
                  <th className={TH_CLASS}>Title</th>
                  <th className={TH_CLASS}>Page</th>
                  <th className={TH_CLASS}>Shows</th>
                  <th className={TH_CLASS}>Status</th>
                  <th className={`${TH_CLASS} text-right`}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((setting) => {
                  const isCommon = !clientIdOf(setting);
                  return (
                    <tr key={setting._id}>
                      <td className={TD_CLASS}>
                        <span className="flex items-center gap-2.5">
                          <span
                            aria-hidden
                            className={
                              isCommon
                                ? "ps-scope-tile ps-scope-common"
                                : "ps-scope-tile ps-scope-client"
                            }
                          >
                            {isCommon ? (
                              <Globe2 className="size-3.5" />
                            ) : (
                              <Building2 className="size-3.5" />
                            )}
                          </span>
                          <span className="font-semibold text-heading">
                            {clientNameOf(setting)}
                          </span>
                        </span>
                      </td>
                      <td className={TD_CLASS}>
                        <span className="block max-w-56 truncate font-medium">
                          {setting.title || "—"}
                        </span>
                        {setting.description ? (
                          <span className="block max-w-56 truncate text-[11px] text-subtle">
                            {setting.description}
                          </span>
                        ) : null}
                      </td>
                      <td className={`${TD_CLASS} whitespace-nowrap`}>
                        {setting.pageSettings?.pageSize || "A4"} ·{" "}
                        {titleCase(setting.pageSettings?.orientation || "portrait")}
                      </td>
                      <td className={TD_CLASS}>
                        <span className="flex flex-wrap gap-1">
                          {setting.pageSettings?.showHeader ? (
                            <span className="ps-chip">Header</span>
                          ) : null}
                          {setting.pageSettings?.showFooter ? (
                            <span className="ps-chip">Footer</span>
                          ) : null}
                          {setting.watermarkSettings?.showWatermark ? (
                            <span className="ps-chip">Watermark</span>
                          ) : null}
                          {setting.footerSetting?.showSeal ? (
                            <span className="ps-chip">Seal</span>
                          ) : null}
                          {setting.canvasElements?.length ? (
                            <span className="ps-chip">Custom layout</span>
                          ) : null}
                        </span>
                      </td>
                      <td className={TD_CLASS}>
                        <span
                          className={setting.status === "active" ? "ps-pill-on" : "ps-pill-off"}
                        >
                          {titleCase(setting.status || "")}
                        </span>
                      </td>
                      <td className={`${TD_CLASS} text-right`}>
                        <div className="flex items-center justify-end gap-1">
                          <RowIconButton label="Edit" onClick={() => openEdit(setting)}>
                            <Pencil className="h-4 w-4" />
                          </RowIconButton>
                          <RowIconButton
                            label="Delete"
                            danger
                            onClick={() => setDeleteTarget(setting)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </RowIconButton>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Add / edit: form on the left, live preview on the right ────── */}
        <Modal
          open={open}
          onClose={saveMutation.isPending ? () => {} : requestClose}
          hideClose={saveMutation.isPending}
          size="full"
          title={
            <span className="flex items-center gap-2.5">
              <span
                aria-hidden
                className="flex size-8 shrink-0 items-center justify-center rounded-lg"
                style={{
                  background: "rgba(255,255,255,0.20)",
                  color: "#FFFFFF",
                  boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.35)",
                }}
              >
                <Printer className="size-4" />
              </span>
              <span className="min-w-0">
                <span
                  className="block text-[14px] font-bold leading-tight"
                  style={{ color: "#FFFFFF" }}
                >
                  {editing ? "Edit print setting" : "Add print setting"}
                </span>
                <span
                  className="block text-[11px] font-normal leading-tight"
                  style={{ color: "rgba(255,255,255,0.82)" }}
                >
                  Configure the report layout — it applies to every page printed for
                  this scope.
                </span>
              </span>
            </span>
          }
          footer={
            // w-full + space-between overrides the shared footer's justify-end,
            // putting Print test on the left without touching the shared Modal.
            <div className="ps-actions">
              <div className="ps-actions-right">
                <Button
                  variant="outline"
                  className="ps-btn-ghost"
                  onClick={resetDraft}
                  disabled={saveMutation.isPending}
                >
                  <RotateCcw className="h-4 w-4" />
                  Reset
                </Button>
                <Button
                  variant="outline"
                  className="ps-btn-ghost"
                  onClick={() => {
                    try {
                      // previewSetting, not draft — the print view has to show
                      // the file you just picked, same as the preview does.
                      printTest(previewSetting);
                    } catch (error) {
                      toast.error(
                        (error as Error).message || "Could not open the print view"
                      );
                    }
                  }}
                >
                  <Printer className="h-4 w-4" />
                  Print preview
                </Button>
              </div>
              <div className="ps-actions-right">
                <Button
                  variant="outline"
                  onClick={requestClose}
                  disabled={saveMutation.isPending}
                >
                  Cancel
                </Button>
                <Button
                  className="ps-btn-save"
                  onClick={() => saveMutation.mutate()}
                  disabled={saveMutation.isPending || !draft.headerData?.text?.trim()}
                >
                  {saveMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Saving…
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4" />
                      Save settings
                    </>
                  )}
                </Button>
              </div>
            </div>
          }
        >
          {/* Internal stylesheet for the dialog, scoped to .ps-root. */}
          <style dangerouslySetInnerHTML={{ __html: MODAL_CSS }} />

          <div className={designMode ? "ps-root is-design" : "ps-root"}>
            {/* ── Form ──────────────────────────────────────────────────── */}
            <div className="ps-pane-form">
              <div className="ps-banner">
                <span aria-hidden className="ps-banner-icon">
                  {scopeValue === COMMON ? (
                    <Globe2 className="size-3.5" />
                  ) : (
                    <Building2 className="size-3.5" />
                  )}
                </span>
                <span className="ps-banner-text">
                  Editing the layout for <b>{scopeName}</b>.{" "}
                  {scopeValue === COMMON
                    ? "Every client without its own layout prints with this one."
                    : "This overrides the common layout for this client only."}
                </span>
              </div>

              {hasCanvas ? (
                <div className="ps-banner">
                  <span aria-hidden className="ps-banner-icon">
                    <SquareDashedMousePointer className="size-3.5" />
                  </span>
                  <span className="ps-banner-text" style={{ flex: 1 }}>
                    <b>Custom layout.</b> Positions come from the drag &amp; drop designer; text,
                    images and styles still come from this form.
                  </span>
                  <button
                    type="button"
                    className="ps-steps-btn"
                    onClick={() => {
                      updateDraft((current) => ({ ...current, canvasElements: [] }));
                      clearDesignerHistory(designerHistory);
                      setDesignMode(false);
                    }}
                  >
                    Use standard layout
                  </button>
                </div>
              ) : null}

              <div className="ps-steps-bar">
                <button
                  type="button"
                  className="ps-steps-btn"
                  onClick={() => setOpenSteps(ALL_STEPS)}
                >
                  <ChevronsUpDown aria-hidden className="ps-steps-icon" />
                  Expand all
                </button>
                <button
                  type="button"
                  className="ps-steps-btn"
                  onClick={() => setOpenSteps([])}
                >
                  <ChevronsDownUp aria-hidden className="ps-steps-icon" />
                  Collapse all
                </button>
              </div>

              <Section
                step={1}
                icon={Target}
                title="Scope & identity"
                open={stepOpen(1)}
                onToggle={() => toggleStep(1)}
              >
                <div className="ps-grid-2">
                  <Field label="Client" required>
                    <select
                      value={scopeValue}
                      onChange={(event) =>
                        patch(
                          "clientId",
                          (event.target.value === COMMON
                            ? null
                            : event.target.value) as PrintSetting["clientId"]
                        )
                      }
                    >
                      <option value={COMMON} disabled={commonTaken}>
                        Common (all clients){commonTaken ? " — already exists" : ""}
                      </option>
                      {(clientsQuery.data ?? [])
                        .filter((client) => !takenClientIds.has(client._id))
                        .map((client) => (
                          <option key={client._id} value={client._id}>
                            {client.clientCompany}
                          </option>
                        ))}
                    </select>
                  </Field>
                  <Field label="Status">
                    <select
                      value={draft.status || "active"}
                      onChange={(event) =>
                        patch("status", event.target.value as PrintSetting["status"])
                      }
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </Field>
                </div>
              </Section>

              <Section
                step={2}
                icon={Layout}
                title="Header"
                open={stepOpen(2)}
                onToggle={() => toggleStep(2)}
                toggle={{
                  label: "Show header",
                  checked: !!draft.pageSettings?.showHeader,
                  onChange: (value) => patchSection("pageSettings", "showHeader", value),
                }}
              >
                {/* Each run of text is followed immediately by the style that
                    governs it, so the thing being styled is never off-screen
                    from the controls styling it. */}
                <Field label="Header title">
                  <Input
                    value={draft.headerData?.text || ""}
                    onChange={(event) =>
                      patchSection("headerData", "text", event.target.value)
                    }
                    placeholder="Institution or client name"
                  />
                </Field>
                <StylePanel
                  title="Header title style"
                  value={draft.typography?.headerData}
                  onChange={(key, value) => patchTypography("headerData", key, value)}
                />

                <div style={{ marginTop: 13 }}>
                  <Field label="Header description">
                    <Textarea
                      value={draft.headerData?.description || ""}
                      onChange={(event) =>
                        patchSection("headerData", "description", event.target.value)
                      }
                      rows={2}
                      placeholder="Address, tagline or any sub-line under the title"
                    />
                  </Field>
                </div>
                <StylePanel
                  title="Description style"
                  value={draft.typography?.headerDescription}
                  onChange={(key, value) =>
                    patchTypography("headerDescription", key, value)
                  }
                />

                {/* Logo. One gate, and nothing below it until the answer is
                    Yes — turning it off hides the fields without discarding
                    the upload, so switching back restores what was there. */}
                <div className="ps-subpanel">
                  <div className="ps-subpanel-head">
                    <p className="ps-subpanel-title" style={{ margin: 0 }}>
                      <ImageIcon aria-hidden className="size-3.5" />
                      Logo
                    </p>
                    <YesNo
                      value={showLogo}
                      onChange={(value) => patchSection("headerData", "showLogo", value)}
                    />
                  </div>

                  {showLogo ? (
                    <>
                      <div className="ps-grid-2">
                        <Field label="Logo position">
                          <select
                            value={draft.headerData?.logoPosition || "left"}
                            onChange={(event) => setLogoPosition(event.target.value)}
                          >
                            <option value="left">Left</option>
                            <option value="right">Right</option>
                            <option value="both">Both sides</option>
                          </select>
                        </Field>
                        <Field label="Logo placement">
                          <select
                            value={draft.headerData?.logoPlacement || "corner"}
                            onChange={(event) =>
                              patchSection("headerData", "logoPlacement", event.target.value)
                            }
                          >
                            <option value="corner">Corner — pinned to the page edge</option>
                            <option value="center">Center — next to the text</option>
                          </select>
                        </Field>
                      </div>

                      <div className="ps-grid-2" style={{ marginTop: 11 }}>
                        {bothSides ? (
                          // "Both sides" is one crest shown twice, so it takes
                          // one upload. Two would only invite them to drift.
                          <AssetPicker
                            label="Logo"
                            hint="Prints on both sides of the header"
                            url={assetUrlOf(previewSetting, "leftLogo")}
                            height={draft.logoSettings?.leftLogoHeight ?? 44}
                            onHeight={(value) =>
                              patchSection("logoSettings", "leftLogoHeight", value)
                            }
                            onPick={(file) => stageFile("leftLogo", file)}
                            onRemove={() => removeAsset("leftLogo")}
                          />
                        ) : (
                          <>
                            {headerSlots.left ? (
                              <AssetPicker
                                label="Left logo"
                                hint="Prints at the left of the header"
                                url={assetUrlOf(previewSetting, "leftLogo")}
                                height={draft.logoSettings?.leftLogoHeight ?? 44}
                                onHeight={(value) =>
                                  patchSection("logoSettings", "leftLogoHeight", value)
                                }
                                onPick={(file) => stageFile("leftLogo", file)}
                                onRemove={() => removeAsset("leftLogo")}
                              />
                            ) : null}
                            {headerSlots.right ? (
                              <AssetPicker
                                label="Right logo"
                                hint="Prints at the right of the header"
                                url={assetUrlOf(previewSetting, "rightLogo")}
                                height={draft.logoSettings?.rightLogoHeight ?? 44}
                                onHeight={(value) =>
                                  patchSection("logoSettings", "rightLogoHeight", value)
                                }
                                onPick={(file) => stageFile("rightLogo", file)}
                                onRemove={() => removeAsset("rightLogo")}
                              />
                            ) : null}
                          </>
                        )}
                      </div>
                    </>
                  ) : null}
                </div>

                {/* Background closes the header customisation area, as the
                    brief places it — after the description style. */}
                <div className="ps-grid-3" style={{ marginTop: 11 }}>
                  <Field label="Background color">
                    <ColorInput
                      value={draft.headerData?.background || "#FFFFFF"}
                      onChange={(value) =>
                        patchSection("headerData", "background", value)
                      }
                    />
                  </Field>
                </div>
              </Section>

              <Section
                step={3}
                icon={FileText}
                title="Footer"
                open={stepOpen(3)}
                onToggle={() => toggleStep(3)}
                toggle={{
                  label: "Show footer",
                  checked: !!draft.pageSettings?.showFooter,
                  onChange: (value) => patchSection("pageSettings", "showFooter", value),
                }}
              >
                {/* Text first, its style directly under it — the same shape as
                    the header's two runs. Alignment lives in the style panel
                    now, beside the rest of the typography. */}
                <Field label="Footer text" hint={FOOTER_HINT}>
                  <Input
                    value={draft.footerData?.text || ""}
                    onChange={(event) =>
                      patchSection("footerData", "text", event.target.value)
                    }
                    placeholder={FOOTER_PLACEHOLDER}
                  />
                </Field>
                <StylePanel
                  title="Footer text style"
                  value={draft.typography?.footerData}
                  onChange={(key, value) => patchTypography("footerData", key, value)}
                />

                <div className="ps-subpanel">
                  <p className="ps-subpanel-title">Signature row</p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    <Check
                      label="Signatory"
                      checked={!!draft.footerSetting?.showSignatory}
                      onChange={(value) =>
                        patchSection("footerSetting", "showSignatory", value)
                      }
                    />
                    <Check
                      label="Date"
                      checked={!!draft.footerSetting?.showDate}
                      onChange={(value) => patchSection("footerSetting", "showDate", value)}
                    />
                    <Check
                      label="Seal"
                      checked={!!draft.footerSetting?.showSeal}
                      onChange={(value) => patchSection("footerSetting", "showSeal", value)}
                    />
                  </div>
                </div>

                {/* The footer's own images, beside the switches that decide
                    whether they print at all. A picker is only offered while
                    its switch is on, for the same reason as the logo slots. */}
                {draft.footerSetting?.showSignatory || draft.footerSetting?.showSeal ? (
                  <div className="ps-subpanel">
                    <p className="ps-subpanel-title">
                      <ImageIcon aria-hidden className="size-3.5" />
                      Footer images
                    </p>
                    <div className="ps-grid-2">
                      {draft.footerSetting?.showSignatory ? (
                        <AssetPicker
                          label="Signature"
                          hint="Prints above the signatory line"
                          url={assetUrlOf(previewSetting, "signature")}
                          height={draft.signature?.signatureHeight ?? 36}
                          onHeight={(value) =>
                            patchSection("signature", "signatureHeight", value)
                          }
                          onPick={(file) => stageFile("signature", file)}
                          onRemove={() => removeAsset("signature")}
                        />
                      ) : null}
                      {draft.footerSetting?.showSeal ? (
                        <AssetPicker
                          label="Seal / stamp"
                          hint="Prints in the middle of the signature row"
                          url={assetUrlOf(previewSetting, "seal")}
                          height={draft.signature?.sealHeight ?? 56}
                          onHeight={(value) => patchSection("signature", "sealHeight", value)}
                          onPick={(file) => stageFile("seal", file)}
                          onRemove={() => removeAsset("seal")}
                        />
                      ) : null}
                    </div>
                    <p className="ps-preview-note">
                      Stored in Cloudinary. A newly chosen image reaches the preview
                      only after saving.
                    </p>
                  </div>
                ) : null}
              </Section>

              <Section
                step={4}
                icon={Droplets}
                title="Watermark"
                open={stepOpen(4)}
                onToggle={() => toggleStep(4)}
                toggle={{
                  label: "Enable watermark",
                  checked: !!draft.watermarkSettings?.showWatermark,
                  onChange: (value) =>
                    patchSection("watermarkSettings", "showWatermark", value),
                }}
              >
                {/* Disabled means nothing below the switch — there is no point
                    configuring a stamp that will not print. */}
                {!draft.watermarkSettings?.showWatermark ? (
                  <p className="ps-hint-row">
                    Watermark is off. Turn it on to choose a text or image stamp.
                  </p>
                ) : (
                  <>
                    <Field label="Watermark type">
                      <div className="ps-seg-group">
                        {(["text", "image"] as const).map((value) => {
                          const active = (markType || "text") === value;
                          return (
                            <button
                              key={value}
                              type="button"
                              className="ps-seg"
                              onClick={() =>
                                patchSection("watermarkSettings", "type", value)
                              }
                              style={
                                active
                                  ? {
                                      background: O.base,
                                      borderColor: O.base,
                                      color: "#FFFFFF",
                                      fontWeight: 700,
                                    }
                                  : undefined
                              }
                            >
                              {titleCase(value)}
                            </button>
                          );
                        })}
                      </div>
                    </Field>

                    {markType === "image" ? (
                      <div style={{ marginTop: 11 }}>
                        <div className="ps-grid-2">
                          <AssetPicker
                            label="Watermark image"
                            hint="Printed behind the page content"
                            url={assetUrlOf(previewSetting, "watermark")}
                            onPick={(file) => stageFile("watermark", file)}
                            onRemove={() => removeAsset("watermark")}
                          />
                        </div>
                        <div className="ps-grid-3" style={{ marginTop: 11 }}>
                          {/* px rather than a percentage of something you
                              cannot see — the printed width is the thing
                              actually being chosen. Hidden until there is an
                              image, for the same reason Printed height is. */}
                          {assetUrlOf(previewSetting, "watermark") ? (
                            <NumberStepper
                              label="Image width"
                              suffix="px"
                              min={16}
                              max={2000}
                              step={10}
                              value={draft.watermarkSettings?.imageWidth ?? 260}
                              onChange={(value) =>
                                patchSection("watermarkSettings", "imageWidth", value)
                              }
                            />
                          ) : null}
                          <SliderField
                            label="Opacity"
                            suffix="%"
                            min={0}
                            max={100}
                            value={draft.watermarkSettings?.opacity ?? 10}
                            onChange={(value) =>
                              patchSection("watermarkSettings", "opacity", value)
                            }
                          />
                          <SliderField
                            label="Rotation"
                            suffix="°"
                            min={-180}
                            max={180}
                            value={draft.watermarkSettings?.rotation ?? 0}
                            onChange={(value) =>
                              patchSection("watermarkSettings", "rotation", value)
                            }
                          />
                          <Field label="Position">
                            <select
                              value={draft.watermarkSettings?.position || "center"}
                              onChange={(event) =>
                                patchSection(
                                  "watermarkSettings",
                                  "position",
                                  event.target.value
                                )
                              }
                            >
                              {WATERMARK_POSITIONS.map((value) => (
                                <option key={value} value={value}>
                                  {titleCase(value)}
                                </option>
                              ))}
                            </select>
                          </Field>
                        </div>
                      </div>
                    ) : (
                      <div style={{ marginTop: 11 }}>
                        <Field label="Watermark text">
                          <Input
                            value={draft.watermarkSettings?.text || ""}
                            onChange={(event) =>
                              patchSection("watermarkSettings", "text", event.target.value)
                            }
                            placeholder="CONFIDENTIAL"
                          />
                        </Field>

                        <div className="ps-subpanel">
                          <p className="ps-subpanel-title">
                            <TypeIcon aria-hidden className="size-3.5" />
                            Watermark text style
                          </p>
                          <div className="ps-grid-3">
                          <Field label="Font family">
                            <select
                              value={
                                draft.watermarkSettings?.fontFamily || FONT_FAMILIES[0]
                              }
                              onChange={(event) =>
                                patchSection(
                                  "watermarkSettings",
                                  "fontFamily",
                                  event.target.value
                                )
                              }
                            >
                              {FONT_FAMILIES.map((family) => (
                                <option key={family} value={family}>
                                  {family.split(",")[0]}
                                </option>
                              ))}
                            </select>
                          </Field>
                          {/* px, the same vocabulary the header and footer
                              style panels use — a watermark is text, and it
                              should be described the way other text is. */}
                          <Field label="Font size">
                            <select
                              value={draft.watermarkSettings?.fontSize || "64px"}
                              onChange={(event) =>
                                patchSection(
                                  "watermarkSettings",
                                  "fontSize",
                                  event.target.value
                                )
                              }
                            >
                              {Array.from(
                                new Set([
                                  ...WATERMARK_FONT_SIZES,
                                  draft.watermarkSettings?.fontSize || "64px",
                                ])
                              )
                                .sort((a, b) => parseFloat(a) - parseFloat(b))
                                .map((value) => (
                                <option key={value} value={value}>
                                  {value}
                                </option>
                              ))}
                            </select>
                          </Field>
                          <Field label="Font weight">
                            <select
                              value={draft.watermarkSettings?.fontWeight || "normal"}
                              onChange={(event) =>
                                patchSection(
                                  "watermarkSettings",
                                  "fontWeight",
                                  event.target.value
                                )
                              }
                            >
                              {FONT_WEIGHTS.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </Field>
                          <Field label="Text color">
                            <ColorInput
                              value={draft.watermarkSettings?.color || "#9CA3AF"}
                              onChange={(value) =>
                                patchSection("watermarkSettings", "color", value)
                              }
                            />
                          </Field>
                          <Field label="Font style">
                            <select
                              value={draft.watermarkSettings?.fontStyle || "italic"}
                              onChange={(event) =>
                                patchSection(
                                  "watermarkSettings",
                                  "fontStyle",
                                  event.target.value
                                )
                              }
                            >
                              <option value="normal">Normal</option>
                              <option value="italic">Italic</option>
                            </select>
                          </Field>
                          <Field label="Letter spacing">
                            <select
                              value={draft.watermarkSettings?.letterSpacing || "normal"}
                              onChange={(event) =>
                                patchSection(
                                  "watermarkSettings",
                                  "letterSpacing",
                                  event.target.value
                                )
                              }
                            >
                              {LETTER_SPACINGS.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </Field>
                          <Field label="Position">
                            <select
                              value={draft.watermarkSettings?.position || "center"}
                              onChange={(event) =>
                                patchSection(
                                  "watermarkSettings",
                                  "position",
                                  event.target.value
                                )
                              }
                            >
                              {WATERMARK_POSITIONS.map((value) => (
                                <option key={value} value={value}>
                                  {titleCase(value)}
                                </option>
                              ))}
                            </select>
                          </Field>
                          </div>

                          <div className="ps-grid-2" style={{ marginTop: 11 }}>
                            <SliderField
                              label="Opacity"
                              suffix="%"
                              min={0}
                              max={100}
                              value={draft.watermarkSettings?.opacity ?? 10}
                              onChange={(value) =>
                                patchSection("watermarkSettings", "opacity", value)
                              }
                            />
                            <SliderField
                              label="Rotation"
                              suffix="°"
                              min={-180}
                              max={180}
                              value={draft.watermarkSettings?.rotation ?? 0}
                              onChange={(value) =>
                                patchSection("watermarkSettings", "rotation", value)
                              }
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </Section>

              <Section
                step={5}
                icon={FileText}
                title="Page & margins"
                open={stepOpen(5)}
                onToggle={() => toggleStep(5)}
              >
                <div className="ps-grid-2">
                  <Field label="Page size">
                    <select
                      value={draft.pageSettings?.pageSize || "A4"}
                      onChange={(event) =>
                        patchSection("pageSettings", "pageSize", event.target.value)
                      }
                    >
                      <option value="A4">A4</option>
                      <option value="A3">A3</option>
                      <option value="Letter">Letter</option>
                    </select>
                  </Field>
                  <Field label="Orientation">
                    <div className="ps-seg-group">
                      {ORIENTATIONS.map((value) => {
                        const active =
                          (draft.pageSettings?.orientation || "portrait") === value;
                        return (
                          <button
                            key={value}
                            type="button"
                            className="ps-seg"
                            onClick={() =>
                              patchSection("pageSettings", "orientation", value)
                            }
                            style={
                              active
                                ? {
                                    background: O.base,
                                    borderColor: O.base,
                                    color: "#FFFFFF",
                                    fontWeight: 700,
                                  }
                                : undefined
                            }
                          >
                            {titleCase(value)}
                          </button>
                        );
                      })}
                    </div>
                  </Field>
                </div>

                <div className="ps-subpanel">
                  <p className="ps-subpanel-title">Margins (mm)</p>
                  <div className="ps-grid-4">
                    {MARGIN_SIDES.map((side) => (
                      <Field key={side} label={titleCase(side)}>
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          value={String(draft.pageSettings?.margins?.[side] ?? 12)}
                          onChange={(event) =>
                            patchMargin(
                              side,
                              Math.max(0, Math.min(100, Number(event.target.value)))
                            )
                          }
                        />
                      </Field>
                    ))}
                  </div>
                </div>
              </Section>

            </div>

            {/* ── Live preview ──────────────────────────────────────────── */}
            <div className="ps-pane-preview">
              <div className="ps-preview-bar">
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <button
                    type="button"
                    className="ps-mode-btn"
                    aria-pressed={designMode}
                    onClick={() => setDesignMode((value) => !value)}
                  >
                    <SquareDashedMousePointer aria-hidden className="size-3.5" />
                    {designMode ? "Done" : "Drag & drop"}
                  </button>
                  <p className="ps-preview-title">
                    <Eye aria-hidden className="size-4" />
                    {designMode ? "Layout designer" : "Live preview"}
                  </p>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span className="ps-preview-badge">
                    {draft.pageSettings?.pageSize || "A4"} ·{" "}
                    {titleCase(draft.pageSettings?.orientation || "portrait")}
                  </span>
                  {/* The preview is already live on every keystroke; this only
                      forces a remount, which is the one thing that reloads an
                      image whose URL has not changed. */}
                  <button
                    type="button"
                    className="ps-refresh"
                    onClick={() => setPreviewNonce((value) => value + 1)}
                  >
                    <RefreshCw aria-hidden className="size-3.5" />
                    Refresh
                  </button>
                </div>
              </div>

              {designMode ? (
                <PrintCanvasEditor
                  key={previewNonce}
                  setting={previewSetting}
                  elements={canvasElements}
                  committed={hasCanvas}
                  history={designerHistory}
                  onElementsChange={(next) =>
                    updateDraft((current) => ({ ...current, canvasElements: next }))
                  }
                  onSettingChange={updateDraft}
                  onPickAsset={stageFile}
                />
              ) : (
                <div className="ps-paper-well">
                  {hasCanvas ? (
                    <PrintCanvasSheet
                      key={previewNonce}
                      setting={previewSetting}
                      elements={canvasElements}
                    />
                  ) : (
                    <PrintSettingPreview key={previewNonce} setting={previewSetting} />
                  )}
                </div>
              )}

              {designMode ? null : (
                <p className="ps-preview-note">
                  The table and figures are sample content, shown so the header, footer and
                  watermark can be judged in place. Only the layout is saved.
                </p>
              )}
            </div>
          </div>
        </Modal>

        {/* Closing discards the whole form, so it asks — but only when there
            is something to discard. */}
        <Modal
          open={confirmClose}
          onClose={() => setConfirmClose(false)}
          size="sm"
          title="Discard changes?"
          footer={
            <div className="flex items-center gap-3">
              <Button variant="outline" onClick={() => setConfirmClose(false)}>
                Keep editing
              </Button>
              <Button
                onClick={closeModal}
                style={{
                  backgroundColor: "#DC2626",
                  borderColor: "#DC2626",
                  color: "#FFFFFF",
                }}
              >
                <Trash2 className="h-4 w-4" />
                Discard
              </Button>
            </div>
          }
        >
          <p className="text-sm text-body">
            {editing
              ? "Your edits to this layout have not been saved. Closing now loses them."
              : "This layout has not been saved. Closing now loses everything entered."}
          </p>
        </Modal>

        <ConfirmDeleteModal
          open={!!deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget._id)}
          title="Delete print setting"
          entityName={deleteTarget ? clientNameOf(deleteTarget) : ""}
          message={
            deleteTarget && !clientIdOf(deleteTarget)
              ? "This is the common layout. Clients without their own will print with no layout until another is added."
              : "This client will fall back to the common layout."
          }
          isPending={deleteMutation.isPending}
        />
      </TabCard>
    </div>
  );
}

/* ── Small local pieces ──────────────────────────────────────────────────── */

/**
 * One collapsible step card.
 *
 * The heading is the expand/collapse control, and the section switch ("Show
 * header") is a SIBLING of it rather than a child — a button inside a button
 * is invalid HTML, and it would also mean every tap on the switch collapsed
 * the card you were about to edit.
 *
 * The body unmounts when closed rather than hiding with CSS. The fields are
 * controlled by `draft`, so nothing is lost, and an unmounted <select> can't
 * be reached by keyboard the way a display:none one still can't but a
 * visibility-hidden one can.
 */
function Section({
  step,
  icon: Icon,
  title,
  toggle,
  open,
  onToggle,
  children,
}: {
  /** Shown as a small numbered pill — the form is long, and the numbers give
   *  the two panes a shared vocabulary when someone is talking through it. */
  step: number;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  /** Section-level on/off, rendered at the right of the heading. */
  toggle?: { label: string; checked: boolean; onChange: (value: boolean) => void };
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  const bodyId = `ps-step-${step}`;
  return (
    <section className={open ? "ps-section is-open" : "ps-section"}>
      <div className="ps-section-head">
        <button
          type="button"
          className="ps-section-btn"
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={onToggle}
        >
          <ChevronDown aria-hidden className="ps-section-chev" />
          <span aria-hidden className="ps-section-icon">
            <Icon className="size-4" />
          </span>
          {title}
          <span className="ps-section-step">{step}</span>
        </button>
        {toggle ? (
          <Switch
            label={toggle.label}
            checked={toggle.checked}
            onChange={toggle.onChange}
          />
        ) : null}
      </div>
      {open ? (
        <div id={bodyId} className="ps-section-body">
          {children}
        </div>
      ) : null}
    </section>
  );
}

/**
 * Every knob for one styled run of text, in one panel.
 *
 * The header title, the header description and the footer each get their own
 * instance directly beneath the input they govern, which is the whole reason
 * this is a component rather than three hand-rolled grids: they must not drift
 * apart as fields are added.
 */
function StylePanel({
  title,
  value,
  onChange,
}: {
  title: string;
  value?: TextStyle;
  onChange: (key: keyof TextStyle, value: string) => void;
}) {
  return (
    <div className="ps-subpanel">
      <p className="ps-subpanel-title">
        <TypeIcon aria-hidden className="size-3.5" />
        {title}
      </p>
      <div className="ps-grid-3">
        <Field label="Font family">
          <select
            value={value?.family || FONT_FAMILIES[0]}
            onChange={(event) => onChange("family", event.target.value)}
          >
            {FONT_FAMILIES.map((family) => (
              <option key={family} value={family}>
                {family.split(",")[0]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Font size">
          <select
            value={value?.size || "14px"}
            onChange={(event) => onChange("size", event.target.value)}
          >
            {Array.from(new Set([...FONT_SIZES, value?.size || "14px"]))
              .sort((a, b) => parseFloat(a) - parseFloat(b))
              .map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Font weight">
          <select
            value={value?.weight || "normal"}
            onChange={(event) => onChange("weight", event.target.value)}
          >
            {FONT_WEIGHTS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Text color">
          <ColorInput
            value={value?.color || "#1F2937"}
            onChange={(next) => onChange("color", next)}
          />
        </Field>
        <Field label="Alignment">
          <select
            value={value?.align || "left"}
            onChange={(event) => onChange("align", event.target.value)}
          >
            {ALIGNMENTS.map((option) => (
              <option key={option} value={option}>
                {titleCase(option)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Letter spacing">
          <select
            value={value?.letterSpacing || "normal"}
            onChange={(event) => onChange("letterSpacing", event.target.value)}
          >
            {LETTER_SPACINGS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>
      </div>
    </div>
  );
}

/**
 * A Yes/No pair, for gates where a switch reads as ambiguous. "Logo: Yes/No"
 * says what the two states ARE; a bare toggle only says it is on.
 */
function YesNo({
  value,
  onChange,
}: {
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="ps-yesno">
      {[
        { label: "Yes", on: true },
        { label: "No", on: false },
      ].map((option) => (
        <button
          key={option.label}
          type="button"
          aria-pressed={value === option.on}
          className="ps-yesno-btn"
          onClick={() => onChange(option.on)}
          style={
            value === option.on
              ? { background: O.base, borderColor: O.base, color: "#FFFFFF" }
              : undefined
          }
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/**
 * A slider paired with its number, because neither alone is enough: the slider
 * is how you find the value you want and the readout is how you say it exactly.
 */
function SliderField({
  label,
  suffix,
  min,
  max,
  value,
  onChange,
}: {
  label: string;
  suffix: string;
  min: number;
  max: number;
  value: number;
  onChange: (value: number) => void;
}) {
  const clamp = (next: number) => Math.max(min, Math.min(max, next));
  return (
    <Field label={label}>
      <div className="ps-slider">
        <input
          type="range"
          min={min}
          max={max}
          value={value}
          onChange={(event) => onChange(clamp(Number(event.target.value)))}
        />
        <span className="ps-slider-value">
          {value}
          {suffix}
        </span>
      </div>
    </Field>
  );
}

/**
 * One uploadable image, rendered inside whichever section owns it.
 *
 * `height` is optional because only the header logos are scaled here — the
 * signature and seal print at a fixed size, and the watermark carries its own
 * width control beside the rest of its settings.
 */
function AssetPicker({
  label,
  hint,
  url,
  height,
  onHeight,
  onPick,
  onRemove,
}: {
  label: string;
  hint: string;
  url?: string;
  height?: number;
  onHeight?: (value: number) => void;
  onPick: (file: File | null) => void;
  onRemove: () => void;
}) {
  // Bumped on removal so the <input type=file> remounts. Without it the input
  // keeps the cleared filename, and re-picking the SAME file fires no change
  // event — the one case where removal would appear not to work.
  const [nonce, setNonce] = React.useState(0);

  return (
    <div className="ps-asset">
      <p className="ps-asset-name">{label}</p>
      <p className="ps-asset-hint">{hint}</p>

      {url ? (
        <div className="ps-asset-preview">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt={label} className="ps-asset-thumb" />
          <button
            type="button"
            className="ps-asset-remove"
            onClick={() => {
              onRemove();
              setNonce((value) => value + 1);
            }}
          >
            <Trash2 aria-hidden className="size-3.5" />
            Remove
          </button>
        </div>
      ) : null}

      <input
        key={nonce}
        type="file"
        accept="image/*"
        onChange={(event) => onPick(event.target.files?.[0] ?? null)}
        style={{ marginTop: 8, display: "block" }}
      />

      {/* Only once there IS an image. Sizing nothing is a control that cannot
          do anything, and it reads as a setting you have forgotten to fill in.
          `url` covers a staged pick as well as a saved one. */}
      {onHeight && url ? (
        <div style={{ marginTop: 9 }}>
          <NumberStepper
            label="Printed height"
            suffix="px"
            min={8}
            max={400}
            step={2}
            value={height ?? 44}
            onChange={onHeight}
          />
        </div>
      ) : null}
    </div>
  );
}

/**
 * A number with − / + beside it.
 *
 * Sizes are in px now rather than small/medium/large, and a bare number field
 * makes nudging one awkward: you have to select, retype and re-read. The
 * buttons are how you tune it; the field is how you set it exactly.
 */
function NumberStepper({
  label,
  suffix,
  min,
  max,
  step,
  value,
  onChange,
}: {
  label: string;
  suffix: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (value: number) => void;
}) {
  const clamp = (next: number) => Math.max(min, Math.min(max, next));
  return (
    <Field label={label}>
      <div className="ps-stepper">
        <button
          type="button"
          className="ps-stepper-btn"
          aria-label={`Decrease ${label}`}
          onClick={() => onChange(clamp(value - step))}
        >
          <Minus aria-hidden className="size-3.5" />
        </button>
        <input
          type="number"
          min={min}
          max={max}
          value={String(value)}
          onChange={(event) => onChange(clamp(Number(event.target.value)))}
          className="ps-stepper-input"
        />
        <span className="ps-stepper-suffix">{suffix}</span>
        <button
          type="button"
          className="ps-stepper-btn"
          aria-label={`Increase ${label}`}
          onClick={() => onChange(clamp(value + step))}
        >
          <Plus aria-hidden className="size-3.5" />
        </button>
      </div>
    </Field>
  );
}

/** Swatch + hex field, kept in step so either half can be edited. */
function ColorInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="ps-color">
      <input
        type="color"
        aria-label="Pick a colour"
        value={/^#[0-9a-f]{6}$/i.test(value) ? value : "#000000"}
        onChange={(event) => onChange(event.target.value)}
        className="ps-color-swatch"
      />
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="ps-color-hex"
        spellCheck={false}
      />
    </div>
  );
}

function Switch({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="ps-switch"
    >
      <span aria-hidden className={checked ? "ps-switch-track is-on" : "ps-switch-track"}>
        <span className="ps-switch-thumb" style={{ left: checked ? 19 : 2.5 }} />
      </span>
      {label}
    </button>
  );
}

function Check({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className={checked ? "ps-check is-on" : "ps-check"}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      {label}
    </label>
  );
}
