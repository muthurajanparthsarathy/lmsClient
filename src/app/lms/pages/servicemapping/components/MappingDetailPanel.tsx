"use client";
import React from "react";
import { Pencil, Plus, Trash2, Layers, BookOpen, ArrowRight, Clock, UserCog } from "lucide-react";
import { Drawer } from "../../../shared/ui";
import { ClientAvatar, modelTone, fmtDate, type MappingRowVM } from "./workspaceShared";

// Right-side details panel for a selected mapping — the user inspects the full
// hierarchy, linked services and configuration without leaving the page.
// Presentation only; every action calls back into the view's existing handlers.

interface MappingDetailPanelProps {
  open: boolean;
  onClose: () => void;
  vm: MappingRowVM | null;
  siblings: MappingRowVM[]; // the client's other mappings (linked services)
  onEdit: (vm: MappingRowVM) => void;
  onMapService: (vm: MappingRowVM) => void;
  onDelete: (vm: MappingRowVM) => void;
  onViewClient: (vm: MappingRowVM) => void;
  onSelectSibling: (vm: MappingRowVM) => void;
  // Per-action permission flags — hide the footer buttons and top quick-action
  // chips when the signed-in user isn't allowed to perform them.
  canEdit?: boolean;
  canMap?: boolean;
  canDelete?: boolean;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="text-2xs font-semibold uppercase tracking-wider text-faint mb-2">{title}</h4>
      {children}
    </div>
  );
}

function TreeRow({ label, values, tone, depth }: { label: string; values: string[]; tone: string; depth: number }) {
  if (!values.length) return null;
  return (
    <div className="flex items-start gap-2" style={{ paddingLeft: depth * 16 }}>
      {depth > 0 && <span className="mt-2 w-3 h-px bg-line-strong flex-shrink-0" aria-hidden="true" />}
      <div className="flex items-center gap-2 flex-wrap py-1">
        <span className="text-2xs font-semibold uppercase tracking-wide text-faint w-16 flex-shrink-0">{label}</span>
        {values.map((v) => (
          <span key={v} className={`inline-flex items-center h-[22px] px-2 rounded-chip text-2xs font-medium ${tone}`}>{v}</span>
        ))}
      </div>
    </div>
  );
}

export function MappingDetailPanel({
  open, onClose, vm, siblings,
  onEdit, onMapService, onDelete, onViewClient, onSelectSibling,
  canEdit = true, canMap = true, canDelete = true,
}: MappingDetailPanelProps) {
  const h = vm?.hierarchy;
  const hasHierarchy = h && (h.degrees.length || h.departments.length || h.sections.length || h.semesters.length || h.phases.length || h.batches.length);
  // Drop the footer entirely when neither footer action is allowed — an empty
  // action bar still occupies vertical space.
  const showFooter = Boolean(vm) && (canEdit || canDelete);

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width="lg"
      title={vm ? "Mapping details" : "Details"}
      footer={showFooter && vm ? (
        <>
          {canDelete && (
            <button
              type="button"
              onClick={() => onDelete(vm)}
              className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-control border border-hairline-strong bg-surface text-sm font-medium text-danger-700 hover:bg-danger-50 hover:border-danger-500/30 transition-colors duration-150"
            >
              <Trash2 size={14} /> Delete
            </button>
          )}
          {canEdit && (
            <button
              type="button"
              onClick={() => onEdit(vm)}
              className="inline-flex items-center gap-1.5 h-9 px-4 rounded-control bg-brand-strong text-white text-sm font-semibold shadow-xs hover:bg-brand-800 transition-colors duration-150"
            >
              <Pencil size={14} /> Edit mapping
            </button>
          )}
        </>
      ) : undefined}
    >
      {!vm ? (
        <p className="text-sm text-subtle">No mapping selected.</p>
      ) : (
        <div className="space-y-6">
          {/* Identity */}
          <div className="flex items-start gap-3">
            <ClientAvatar name={vm.clientName} size="lg" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-base font-semibold text-heading truncate">{vm.clientName}</p>
                <span className={`inline-flex items-center gap-1.5 h-[22px] px-2 rounded-chip text-2xs font-medium border ${vm.status === "active" ? "bg-success-50 text-success-700 border-success-500/20" : "bg-ink-100 text-ink-500 border-ink-200"}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${vm.status === "active" ? "bg-success-500" : "bg-ink-400"}`} />
                  {vm.status === "active" ? "Active" : "Inactive"}
                </span>
              </div>
              <div className="flex items-center gap-1.5 mt-1">
                {vm.serviceCode && <span className="inline-flex items-center h-[20px] px-1.5 rounded-chip bg-ink-100 text-ink-700 text-[11px] font-semibold tabular-nums">{vm.serviceCode}</span>}
                <span className="text-sm text-subtle">{vm.service || "—"}</span>
              </div>
            </div>
          </div>

          {/* Quick actions — "Map another service" gated by canMap; the
              "View client mappings" chip stays as long as the drawer is open
              (the drawer itself is gated behind View Full Details). */}
          <div className="flex items-center gap-2 flex-wrap">
            {canMap && (
              <button type="button" onClick={() => onMapService(vm)} className="inline-flex items-center gap-1.5 h-8 px-3 rounded-control border border-hairline-strong bg-surface text-xs font-medium text-body hover:bg-row-hover hover:text-heading transition-colors duration-150"><Plus size={13} className="text-brand-500" /> Map another service</button>
            )}
            <button type="button" onClick={() => onViewClient(vm)} className="inline-flex items-center gap-1.5 h-8 px-3 rounded-control border border-hairline-strong bg-surface text-xs font-medium text-body hover:bg-row-hover hover:text-heading transition-colors duration-150"><Layers size={13} /> All client mappings</button>
          </div>

          {/* Hierarchy tree */}
          <Section title="Academic hierarchy">
            {hasHierarchy ? (
              <div className="rounded-tile border border-hairline bg-canvas p-3 space-y-0.5">
                <TreeRow label="Client" values={[vm.clientName]} tone="bg-surface text-heading border border-hairline-strong" depth={0} />
                <TreeRow label="Degree" values={h!.degrees} tone="bg-brand-wash text-brand-strong" depth={1} />
                <TreeRow label="Dept" values={h!.departments} tone="bg-info-50 text-info-700" depth={2} />
                <TreeRow label="Section" values={h!.sections} tone="bg-ink-100 text-ink-700" depth={3} />
                <TreeRow label="Semester" values={h!.semesters} tone="bg-success-50 text-success-700" depth={4} />
                <TreeRow label="Phase" values={h!.phases} tone="bg-warn-50 text-warn-700" depth={1} />
                <TreeRow label="Batch" values={h!.batches} tone="bg-ink-100 text-ink-700" depth={1} />
              </div>
            ) : (
              <p className="text-sm text-subtle">This is a flat mapping — no academic hierarchy configured.</p>
            )}
          </Section>

          {/* Service */}
          <Section title="Service">
            <div className="rounded-tile border border-hairline bg-canvas p-3 space-y-2.5">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs text-subtle">Service</span>
                <span className="text-sm font-medium text-heading">{vm.service || "—"}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs text-subtle">Service models</span>
                <div className="flex items-center gap-1.5 flex-wrap justify-end">
                  {vm.models.length ? vm.models.map((m) => <span key={m} className={`inline-flex items-center h-[22px] px-2 rounded-chip text-2xs font-medium ${modelTone(m)}`}>{m}</span>) : <span className="text-sm text-subtle">—</span>}
                </div>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs text-subtle">Academic year</span>
                <span className="text-sm font-medium text-heading tabular-nums">{vm.year || "—"}</span>
              </div>
            </div>
          </Section>

          {/* Courses */}
          <Section title={`Courses (${vm.courseCount})`}>
            {vm.courseNames.length ? (
              <div className="flex flex-wrap gap-1.5">
                {vm.courseNames.map((c, i) => (
                  <span key={`${c}-${i}`} className="inline-flex items-center gap-1.5 h-[24px] px-2.5 rounded-chip bg-brand-wash text-brand-strong text-2xs font-medium"><BookOpen size={12} /> {c}</span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-subtle">No courses configured yet — finish the course setup via Edit.</p>
            )}
          </Section>

          {/* Linked services (client's other mappings) */}
          {siblings.length > 0 && (
            <Section title={`Linked services (${siblings.length})`}>
              <div className="space-y-1.5">
                {siblings.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => onSelectSibling(s)}
                    className="w-full flex items-center justify-between gap-3 h-11 px-3 rounded-control border border-hairline bg-surface hover:bg-row-hover hover:border-line-hover transition-colors duration-150 text-left"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-heading truncate">{s.service || "—"}</p>
                      <p className="text-2xs text-subtle truncate">{s.models.join(", ") || "—"}{s.year ? ` · ${s.year}` : ""}</p>
                    </div>
                    <ArrowRight size={14} className="text-faint flex-shrink-0" />
                  </button>
                ))}
              </div>
            </Section>
          )}

          {/* Configuration */}
          <Section title="Configuration">
            <div className="rounded-tile border border-hairline bg-canvas p-3 space-y-2.5">
              {vm.updatedBy && (
                <div className="flex items-center justify-between gap-3">
                  <span className="inline-flex items-center gap-1.5 text-xs text-subtle"><UserCog size={13} /> Last updated by</span>
                  <span className="text-sm font-medium text-heading truncate max-w-[220px]" title={vm.updatedBy}>{vm.updatedBy}</span>
                </div>
              )}
              {vm.createdBy && (
                <div className="flex items-center justify-between gap-3">
                  <span className="inline-flex items-center gap-1.5 text-xs text-subtle"><UserCog size={13} /> Configured by</span>
                  <span className="text-sm font-medium text-heading truncate max-w-[220px]" title={vm.createdBy}>{vm.createdBy}</span>
                </div>
              )}
              <div className="flex items-center justify-between gap-3">
                <span className="inline-flex items-center gap-1.5 text-xs text-subtle"><Clock size={13} /> Last updated</span>
                <span className="text-sm font-medium text-heading">{fmtDate(vm.updatedAt || vm.createdAt)}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="inline-flex items-center gap-1.5 text-xs text-subtle"><Clock size={13} /> Created</span>
                <span className="text-sm font-medium text-heading">{fmtDate(vm.createdAt)}</span>
              </div>
            </div>
          </Section>
        </div>
      )}
    </Drawer>
  );
}

export default MappingDetailPanel;
