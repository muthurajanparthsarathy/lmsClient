"use client";
import React, { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { RotateCcw } from "lucide-react";

// Inline filter panel for the Service Mapping workspace — expands on the SAME
// screen under the toolbar (no drawer/modal). The exposed fields mirror the
// list's own columns (Client · Year · Status), so a filter always corresponds
// to something visible in a row. Free-text search across service / model / etc.
// lives in the toolbar's search box.

export interface WorkspaceFilters {
  client: string;
  year: string;
  status: string;
}

export const EMPTY_WS_FILTERS: WorkspaceFilters = {
  client: "", year: "", status: "",
};

interface Option { value: string; label: string }

interface MappingWorkspaceFilterPanelProps {
  open: boolean;
  onClose: () => void;
  current: WorkspaceFilters;
  clientOptions: Option[];
  yearOptions: Option[];
  onApply: (filters: WorkspaceFilters) => void;
  onReset: () => void;
}

const SELECT_CLS =
  "w-full h-9 px-3 rounded-control border border-hairline-strong bg-surface text-sm text-body " +
  "focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/15 transition-colors duration-150";

const STATUS_OPTIONS: Option[] = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
];

function Field({ label, value, onChange, allLabel, options }: { label: string; value: string; onChange: (v: string) => void; allLabel: string; options: Option[] }) {
  return (
    <div>
      <span className="block text-2xs font-semibold uppercase tracking-wider text-subtle mb-1.5">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className={SELECT_CLS}>
        <option value="">{allLabel}</option>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

export function MappingWorkspaceFilterPanel({
  open, onClose, current,
  clientOptions, yearOptions,
  onApply, onReset,
}: MappingWorkspaceFilterPanelProps) {
  const [draft, setDraft] = useState<WorkspaceFilters>(current);

  useEffect(() => {
    if (open) setDraft(current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const set = (key: keyof WorkspaceFilters) => (v: string) => setDraft((d) => ({ ...d, [key]: v }));
  const draftActive = Object.values(draft).some(Boolean);

  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
          className="overflow-hidden"
        >
          <div className="mt-3 rounded-xl border border-hairline bg-surface shadow-xs p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3 mb-4">
              <h3 className="text-sm font-semibold text-heading">Filters</h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => { setDraft(EMPTY_WS_FILTERS); onReset(); }}
                  disabled={!draftActive}
                  className="inline-flex items-center gap-1.5 h-8 px-3 rounded-control border border-hairline-strong bg-surface text-xs font-medium text-body hover:bg-row-hover hover:text-heading disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-150"
                >
                  <RotateCcw size={13} /> Reset
                </button>
                <button
                  type="button"
                  onClick={() => { onApply(draft); onClose(); }}
                  className="inline-flex items-center h-8 px-3.5 rounded-control bg-brand-strong text-white text-xs font-semibold shadow-xs hover:bg-brand-800 transition-colors duration-150"
                >
                  Apply Filters
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <Field label="Client" value={draft.client} onChange={set("client")} allLabel="All clients" options={clientOptions} />
              <Field label="Academic Year" value={draft.year} onChange={set("year")} allLabel="All years" options={yearOptions} />
              <Field label="Status" value={draft.status} onChange={set("status")} allLabel="Any status" options={STATUS_OPTIONS} />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default MappingWorkspaceFilterPanel;
