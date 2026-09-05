"use client";

import { Download, RefreshCw, SlidersHorizontal } from "lucide-react";
import { relDate } from "@/features/ld-dashboard/lib/format";

/**
 * Page title, the two actions and the freshness stamp.
 *
 * Customize and Export are wired to the console's existing implementations —
 * the Report Designer overlay and the report print/export pipeline — rather
 * than being new buttons that do nothing.
 */
export function OverviewHeader({
  onCustomize,
  onExport,
  onRefresh,
  updatedAt,
  busy,
  exportBusy,
}: {
  onCustomize: () => void;
  onExport: () => void;
  onRefresh: () => void;
  updatedAt: number;
  busy: boolean;
  exportBusy: boolean;
}) {
  return (
    <div className="ldo-head">
      <div>
        <h1>L&amp;D Overview</h1>
        <p>Training performance, skill development &amp; industry readiness</p>
      </div>
      <div className="ldo-head-r">
        <button type="button" className="ldo-btn" onClick={onCustomize} title="Open the Report Designer to pick activities, sub-categories and columns">
          <SlidersHorizontal size={14} strokeWidth={2} aria-hidden />
          Customize
        </button>
        <button type="button" className="ldo-btn primary" onClick={onExport} disabled={exportBusy} title="Export this overview">
          <Download size={14} strokeWidth={2} aria-hidden />
          {exportBusy ? "Preparing…" : "Export"}
        </button>
        <span className="ldo-stamp">
          {updatedAt ? `Updated ${relDate(new Date(updatedAt).toISOString()).toLowerCase()}` : "Not loaded yet"}
          <button
            type="button"
            className="ldo-btn icon"
            onClick={onRefresh}
            disabled={busy}
            aria-label="Refresh dashboard data"
            title="Refresh"
          >
            <RefreshCw size={14} strokeWidth={2} className={busy ? "ldo-spin" : undefined} aria-hidden />
          </button>
        </span>
      </div>
    </div>
  );
}
