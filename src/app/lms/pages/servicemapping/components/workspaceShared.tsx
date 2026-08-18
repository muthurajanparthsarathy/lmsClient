"use client";
import React from "react";
import { ChevronRight } from "lucide-react";
import type { ServiceMapping, MappedClientRef } from "@/apiServices/serviceMappingService";
import type { StatusPillTone } from "../../../shared/ui";

// Presentation-only helpers shared by the Service Mapping workspace (table view,
// hierarchy card view, filter drawer and detail panel). No data or business
// logic here — the view builds row view-models from the mappings and hands them
// down. Extraction is defensive: a mapping's shape varies by flow (degree /
// placement / flat), so absent levels simply yield empty arrays.

export interface MappingHierarchy {
  degrees: string[];
  departments: string[];
  sections: string[];
  semesters: string[];
  batches: string[];
  phases: string[];
}

export interface MappingRowVM {
  id: string;
  clientId: string;
  clientName: string;
  serviceCode: string;
  service: string;
  models: string[];
  year: string;
  status: "active" | "inactive";
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
  updatedBy?: string;
  hierarchy: MappingHierarchy;
  courseCount: number;
  courseNames: string[];
  mapping: ServiceMapping;
  client: MappedClientRef;
}

// ── Level extraction from masterData ─────────────────────────────────────────
const levelValues = (mapping: ServiceMapping, level: string): string[] => {
  const out = new Set<string>();
  (mapping.masterData || []).forEach((e) => {
    if ((e.level || "").trim().toLowerCase() === level) {
      (e.values || []).forEach((v) => { if (v) out.add(v); });
    }
  });
  return Array.from(out);
};

export function extractHierarchy(mapping: ServiceMapping): MappingHierarchy {
  return {
    degrees: levelValues(mapping, "degree"),
    departments: levelValues(mapping, "department"),
    sections: levelValues(mapping, "section"),
    semesters: levelValues(mapping, "semester"),
    batches: levelValues(mapping, "batch"),
    phases: levelValues(mapping, "phase"),
  };
}

export function buildRowVM(mapping: ServiceMapping, client: MappedClientRef): MappingRowVM {
  const courses = mapping.courses || [];
  return {
    id: mapping._id,
    clientId: client._id,
    clientName: client.clientCompany || "N/A",
    serviceCode: mapping.serviceCode || "",
    service: mapping.service || "",
    models: (mapping.serviceModels || []).filter(Boolean),
    year: mapping.year || "",
    status: mapping.status,
    createdAt: mapping.createdAt,
    updatedAt: mapping.updatedAt,
    createdBy: mapping.createdBy,
    updatedBy: mapping.updatedBy,
    hierarchy: extractHierarchy(mapping),
    courseCount: courses.length,
    courseNames: courses.map((c) => c.courseName).filter(Boolean) as string[],
    mapping,
    client,
  };
}

// ── Tints ────────────────────────────────────────────────────────────────────
const AVATARS = [
  "bg-info-50 text-info-700",
  "bg-brand-wash text-brand-strong",
  "bg-success-50 text-success-700",
  "bg-warn-50 text-warn-700",
  "bg-danger-50 text-danger-700",
];
const tintHash = (s: string) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
};
export const avatarClass = (name: string) => AVATARS[tintHash(name) % AVATARS.length];

const MODEL_TONES: Record<string, string> = {
  "placement training": "bg-brand-wash text-brand-strong",
  "degree program": "bg-brand-wash text-brand-strong",
  skilling: "bg-info-50 text-info-700",
  td: "bg-success-50 text-success-700",
  htd: "bg-warn-50 text-warn-700",
};
const MODEL_FALLBACK = [
  "bg-brand-wash text-brand-strong",
  "bg-info-50 text-info-700",
  "bg-success-50 text-success-700",
  "bg-warn-50 text-warn-700",
];
export const modelTone = (m: string) =>
  MODEL_TONES[m.trim().toLowerCase()] || MODEL_FALLBACK[tintHash(m) % MODEL_FALLBACK.length];

export const statusTone = (status: "active" | "inactive"): StatusPillTone =>
  status === "active" ? "success" : "neutral";

export function fmtDate(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

// ── Presentational pieces ────────────────────────────────────────────────────

export function ClientAvatar({ name, size = "md" }: { name: string; size?: "sm" | "md" | "lg" }) {
  const dim = size === "lg" ? "w-11 h-11 text-sm" : size === "sm" ? "w-6 h-6 text-2xs" : "w-9 h-9 text-xs";
  return (
    <span
      className={`${dim} rounded-full flex items-center justify-center font-semibold flex-shrink-0 ${avatarClass(name)}`}
      aria-hidden="true"
    >
      {name.charAt(0).toUpperCase() || "C"}
    </span>
  );
}

function HierarchyStep({ label, values, tone }: { label: string; values: string[]; tone: string }) {
  if (!values.length) return null;
  const shown = values.slice(0, 3);
  const extra = values.length - shown.length;
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-faint">{label}</span>
      <span className="flex items-center gap-1">
        {shown.map((v) => (
          <span key={v} className={`inline-flex items-center h-[20px] px-1.5 rounded-chip text-2xs font-medium whitespace-nowrap ${tone}`}>
            {v}
          </span>
        ))}
        {extra > 0 && (
          <span className="inline-flex items-center h-[20px] px-1 rounded-chip bg-ink-100 text-ink-600 text-2xs font-semibold">+{extra}</span>
        )}
      </span>
    </span>
  );
}

// The relationship chain: Client → Degree → Department → Section → Semester →
// Service → Course. Empty levels are skipped, so a flat flow reads simply as
// Client → Service → Course.
export function HierarchyChain({ vm, className = "" }: { vm: MappingRowVM; className?: string }) {
  const steps: React.ReactNode[] = [];
  const h = vm.hierarchy;
  const push = (node: React.ReactNode) => {
    if (steps.length) steps.push(<ChevronRight key={`sep-${steps.length}`} size={13} className="text-line-muted flex-shrink-0" />);
    steps.push(node);
  };

  push(
    <span key="client" className="inline-flex items-center gap-1.5">
      <ClientAvatar name={vm.clientName} size="sm" />
      <span className="text-xs font-semibold text-heading whitespace-nowrap max-w-[140px] truncate" title={vm.clientName}>{vm.clientName}</span>
    </span>
  );
  if (h.degrees.length) push(<HierarchyStep key="deg" label="Degree" values={h.degrees} tone="bg-brand-wash text-brand-strong" />);
  if (h.departments.length) push(<HierarchyStep key="dep" label="Dept" values={h.departments} tone="bg-info-50 text-info-700" />);
  if (h.sections.length) push(<HierarchyStep key="sec" label="Sec" values={h.sections} tone="bg-ink-100 text-ink-700" />);
  if (h.semesters.length) push(<HierarchyStep key="sem" label="Sem" values={h.semesters} tone="bg-success-50 text-success-700" />);
  if (h.phases.length) push(<HierarchyStep key="ph" label="Phase" values={h.phases} tone="bg-warn-50 text-warn-700" />);
  if (h.batches.length && !h.degrees.length) push(<HierarchyStep key="bat" label="Batch" values={h.batches} tone="bg-ink-100 text-ink-700" />);
  if (vm.service) push(
    <span key="svc" className="inline-flex items-center gap-1.5">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-faint">Service</span>
      <span className="inline-flex items-center h-[20px] px-1.5 rounded-chip bg-brand-100 text-brand-700 text-2xs font-semibold whitespace-nowrap">{vm.service}</span>
    </span>
  );
  if (vm.courseCount > 0) push(
    <span key="crs" className="inline-flex items-center gap-1 text-2xs font-medium text-subtle whitespace-nowrap">
      {vm.courseCount} course{vm.courseCount > 1 ? "s" : ""}
    </span>
  );

  return <div className={`flex items-center gap-2 flex-wrap ${className}`}>{steps}</div>;
}

// A compact one-line hierarchy summary for dense table rows.
export function hierarchySummary(vm: MappingRowVM): string {
  const h = vm.hierarchy;
  const parts: string[] = [];
  if (h.degrees.length) parts.push(h.degrees.slice(0, 2).join(", ") + (h.degrees.length > 2 ? "…" : ""));
  if (h.departments.length) parts.push(h.departments.slice(0, 2).join(", ") + (h.departments.length > 2 ? "…" : ""));
  if (h.semesters.length) parts.push("Sem " + h.semesters.slice(0, 2).join(", "));
  if (h.phases.length) parts.push(h.phases.length + " phase" + (h.phases.length > 1 ? "s" : ""));
  if (!parts.length && h.batches.length) parts.push(h.batches.length + " batch" + (h.batches.length > 1 ? "es" : ""));
  return parts.join(" · ");
}
