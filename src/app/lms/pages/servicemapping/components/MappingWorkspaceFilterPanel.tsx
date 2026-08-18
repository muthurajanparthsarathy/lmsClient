"use client";
import React, { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { RotateCcw } from "lucide-react";

// Inline filter panel for the Service Mapping workspace — expands on the SAME
// screen under the toolbar (no drawer/modal). DRAFT model: edits stay local
// until "Apply Filters" commits them to the view's filter state; Reset clears
// the draft and the committed filters; Apply commits and collapses the panel.

export interface WorkspaceFilters {
  client: string;
  service: string;
  model: string;
  year: string;
  status: string;
  degree: string;
  department: string;
  section: string;
  semester: string;
}

export const EMPTY_WS_FILTERS: WorkspaceFilters = {
  client: "", service: "", model: "", year: "", status: "",
  degree: "", department: "", section: "", semester: "",
};

interface Option { value: string; label: string }

interface MappingWorkspaceFilterPanelProps {
  open: boolean;
  onClose: () => void;
  current: WorkspaceFilters;
  clientOptions: Option[];
  serviceOptions: Option[];
  modelOptions: Option[];
  yearOptions: Option[];
  degreeOptions: Option[];
  departmentOptions: Option[];
  sectionOptions: Option[];
  semesterOptions: Option[];
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
  clientOptions, serviceOptions, modelOptions, yearOptions,
  degreeOptions, departmentOptions, sectionOptions, semesterOptions,
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
              <Field label="Degree" value={draft.degree} onChange={set("degree")} allLabel="All degrees" options={degreeOptions} />
              <Field label="Department" value={draft.department} onChange={set("department")} allLabel="All departments" options={departmentOptions} />
              <Field label="Section" value={draft.section} onChange={set("section")} allLabel="All sections" options={sectionOptions} />
              <Field label="Semester" value={draft.semester} onChange={set("semester")} allLabel="All semesters" options={semesterOptions} />
              <Field label="Academic Year" value={draft.year} onChange={set("year")} allLabel="All years" options={yearOptions} />
              <Field label="Service" value={draft.service} onChange={set("service")} allLabel="All services" options={serviceOptions} />
              <Field label="Service Model" value={draft.model} onChange={set("model")} allLabel="All service models" options={modelOptions} />
              <Field label="Status" value={draft.status} onChange={set("status")} allLabel="Any status" options={STATUS_OPTIONS} />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default MappingWorkspaceFilterPanel;
