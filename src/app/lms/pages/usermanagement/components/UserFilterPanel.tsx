"use client";
import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { RotateCcw } from "lucide-react";

// The inline Filter panel — expands on the SAME screen right under the toolbar
// (no slide-over drawer). Every control writes to the same filter state in
// page.tsx that feeds the users query, so opening/closing it changes nothing
// about how filtering works; it only reveals/hides the controls in place.

interface RoleOption {
  value: string;
  label: string;
  icon?: React.ComponentType<{ className?: string; size?: number }>;
  color?: string;
}

interface UserFilterPanelProps {
  open: boolean;
  onClose: () => void;

  roleOptions: RoleOption[];
  selectedRoles: string[];
  setSelectedRoles: (v: string[]) => void;

  selectedStatus: string;
  setSelectedStatus: (v: string) => void;

  selectedDegree: string;
  setSelectedDegree: (v: string) => void;
  selectedDepartment: string;
  setSelectedDepartment: (v: string) => void;
  selectedYear: string;
  setSelectedYear: (v: string) => void;

  degreeOptions: string[];
  departmentOptions: string[];
  yearOptions: string[];

  basedOn: string | null;
  activeCount: number;
  onClear: () => void;
}

const SELECT_CLS =
  "w-full h-9 px-3 rounded-control border border-hairline-strong bg-surface text-sm text-body " +
  "focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/15 transition-colors duration-150";

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <span className="block text-2xs font-semibold uppercase tracking-wider text-subtle mb-1.5">
        {label}
      </span>
      {children}
    </div>
  );
}

function NativeSelect({
  value,
  onChange,
  allLabel,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  allLabel: string;
  options: string[];
}) {
  return (
    <select value={value || ""} onChange={(e) => onChange(e.target.value)} className={SELECT_CLS}>
      <option value="">{allLabel}</option>
      {options.map((opt) => (
        <option key={opt} value={opt}>
          {opt}
        </option>
      ))}
    </select>
  );
}

export function UserFilterPanel({
  open,
  onClose,
  roleOptions,
  selectedRoles,
  setSelectedRoles,
  selectedStatus,
  setSelectedStatus,
  selectedDegree,
  setSelectedDegree,
  selectedDepartment,
  setSelectedDepartment,
  selectedYear,
  setSelectedYear,
  degreeOptions,
  departmentOptions,
  yearOptions,
  basedOn,
  activeCount,
  onClear,
}: UserFilterPanelProps) {
  const isCollege = basedOn === "college";

  const toggleRole = (id: string) => {
    setSelectedRoles(
      selectedRoles.includes(id)
        ? selectedRoles.filter((r) => r !== id)
        : [...selectedRoles, id]
    );
  };

  const statusOptions = [
    { value: "", label: "All" },
    { value: "active", label: "Active" },
    { value: "inactive", label: "Inactive" },
  ];

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
            {/* Panel header */}
            <div className="flex items-center justify-between gap-3 mb-4">
              <h3 className="text-sm font-semibold text-heading">Filters</h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClear}
                  disabled={activeCount === 0}
                  className="inline-flex items-center gap-1.5 h-8 px-3 rounded-control border border-hairline-strong bg-surface text-xs font-medium text-body hover:bg-row-hover hover:text-heading disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-150"
                >
                  <RotateCcw size={13} /> Clear all
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex items-center h-8 px-3.5 rounded-control bg-brand-strong text-white text-xs font-semibold shadow-xs hover:bg-brand-800 transition-colors duration-150"
                >
                  Done
                </button>
              </div>
            </div>

            {/* Role — toggleable chips (wrap inline) */}
            <div className="mb-4">
              <Labeled label="Role">
                {roleOptions.length === 0 ? (
                  <p className="text-sm text-subtle">No roles available.</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {roleOptions.map((opt) => {
                      const checked = selectedRoles.includes(opt.value);
                      const Icon = opt.icon;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => toggleRole(opt.value)}
                          className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-full border text-xs font-medium transition-colors duration-150 ${
                            checked
                              ? "border-brand-500/40 bg-brand-wash text-brand-strong"
                              : "border-hairline-strong bg-surface text-body hover:bg-row-hover hover:text-heading"
                          }`}
                        >
                          {Icon && <Icon className={checked ? "text-brand-strong" : opt.color || "text-subtle"} size={14} />}
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </Labeled>
            </div>

            {/* Selects */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Labeled label="Status">
                <div className="inline-flex p-0.5 rounded-control border border-hairline-strong bg-surface w-full h-9">
                  {statusOptions.map((opt) => {
                    const active = (selectedStatus || "") === opt.value;
                    return (
                      <button
                        key={opt.value || "all"}
                        type="button"
                        onClick={() => setSelectedStatus(opt.value)}
                        className={`flex-1 rounded-chip text-xs font-semibold transition-colors duration-150 ${
                          active ? "bg-brand-wash text-brand-strong" : "text-subtle hover:text-heading"
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </Labeled>

              {isCollege && (
                <>
                  <Labeled label="Degree">
                    <NativeSelect
                      value={selectedDegree === "all" ? "" : selectedDegree}
                      onChange={setSelectedDegree}
                      allLabel="All degrees"
                      options={degreeOptions}
                    />
                  </Labeled>
                  <Labeled label="Department">
                    <NativeSelect
                      value={selectedDepartment === "all" ? "" : selectedDepartment}
                      onChange={setSelectedDepartment}
                      allLabel="All departments"
                      options={departmentOptions}
                    />
                  </Labeled>
                  <Labeled label="Year">
                    <NativeSelect
                      value={selectedYear === "all" ? "" : selectedYear}
                      onChange={setSelectedYear}
                      allLabel="All years"
                      options={yearOptions}
                    />
                  </Labeled>
                </>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default UserFilterPanel;
