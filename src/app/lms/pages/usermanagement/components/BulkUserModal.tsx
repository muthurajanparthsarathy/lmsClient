"use client";
import { getToken } from "@/lib/session";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Download, X, CheckCircle, XCircle, Loader2, Building2, Briefcase, ShieldCheck, FileSpreadsheet, ChevronDown, UserPlus, AlertTriangle, Copy, Info, Eye } from "lucide-react";
import { toast } from "sonner";
import { addUser } from "@/app/lms/pages/usermanagement/api/userService";
import { type ServiceMapping, type MasterDataEntry } from "@/app/lms/pages/servicemapping/api/serviceMappingService";
import { type Degree } from "@/app/lms/pages/dynamicfieldsettings/api/degreeService";
import { useClientsQuery, useDegreesQuery, useServiceMappingsQuery } from "@/queries/referenceData";
import { Role, User } from "./types";

// ─── Hierarchy config (mirrors the single Add User cascade) ───────────────────
const LEVEL_ORDER = ["Batch", "Degree", "Department", "Semester", "Section", "Phase"];
const LEVEL_FIELD: Record<string, string> = {
  Batch: "batch", Degree: "degree", Department: "department",
  Semester: "semester", Section: "section", Phase: "phase",
};
const HIERARCHY_PATH_SEP = " ▸ ";

// User columns that always appear in the template, in order.
const BASE_COLS: { header: string; field: string; required: boolean; sample: string }[] = [
  { header: "First Name", field: "firstName", required: true, sample: "John" },
  { header: "Last Name", field: "lastName", required: true, sample: "Doe" },
  { header: "Email", field: "email", required: true, sample: "john.doe@example.com" },
  { header: "Phone", field: "phone", required: false, sample: "9876543210" },
  { header: "Gender", field: "gender", required: false, sample: "Male" },
  { header: "Password", field: "password", required: false, sample: "Changeme@123" },
];

const DEFAULT_PASSWORD = "Changeme@123";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface Client { _id: string; clientCompany: string; status?: string; type?: ("college" | "company")[]; }

interface RowResult { row: number; email: string; status: "created" | "exists" | "error"; reason?: string; }

// Per-row classification for the preview. Read-only viewer — no per-row picks;
// only rows in the "new" bucket get created, everything else is auto-skipped.
type RowCategory = "new" | "existing" | "invalid" | "duplicate";

type PreviewRow = {
  rowNo: number;
  data: Record<string, string>;
  missing: string[];
  category: RowCategory;
  reason?: string;
};

const norm = (s: string) => String(s || "").trim().toLowerCase().replace(/\s+/g, "");

const getApiErrorMessage = (error: any, fallback: string): string => {
  const data = error?.response?.data;
  const msg = data?.message;
  if (Array.isArray(msg) && msg[0]?.value) return msg[0].value;
  if (typeof msg === "string" && msg.trim()) return msg;
  return fallback;
};

interface BulkUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  roles: Role[];
  existingUsers?: User[];
  onComplete: () => void;
}

export default function BulkUserModal({ isOpen, onClose, roles, existingUsers = [], onComplete }: BulkUserModalProps) {
  const [roleId, setRoleId] = useState("");
  const [clientId, setClientId] = useState("");
  const [serviceModel, setServiceModel] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<RowResult[] | null>(null);
  const [previewRows, setPreviewRows] = useState<PreviewRow[] | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [validating, setValidating] = useState(false);
  // Whether the nested Preview sub-modal is open. Auto-flips true after a
  // successful parse; closes with the sub-modal's X and reopens via the
  // Preview button in the main modal's header.
  const [previewOpen, setPreviewOpen] = useState(false);

  const { data: clientsData } = useClientsQuery(isOpen);
  const { data: mappingsData } = useServiceMappingsQuery(isOpen);
  const { data: degreesData } = useDegreesQuery(isOpen);
  const clients = (clientsData ?? []) as Client[];
  const mappings = (mappingsData ?? []) as ServiceMapping[];
  const degreesList = (degreesData ?? []) as Degree[];

  const [roleOpen, setRoleOpen] = useState(false);
  const [clientOpen, setClientOpen] = useState(false);
  const [modelOpen, setModelOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    setRoleId(""); setClientId(""); setServiceModel(""); setFile(null); setResults(null); setProgress(0); setBusy(false);
    setPreviewRows(null); setParseError(null); setValidating(false); setPreviewOpen(false);
  }, [isOpen]);

  const selectedClient = clients.find((c) => c._id === clientId);
  const clientMappings = clientId
    ? mappings.filter((m) => (typeof m.client === "string" ? m.client : m.client?._id) === clientId)
    : [];
  const serviceModelOptions = Array.from(new Set(
    clientMappings.flatMap((m) => (m.serviceModels?.length ? m.serviceModels : [m.service])).filter(Boolean)
  ));
  const selectedMapping = clientMappings.find(
    (m) => (m.serviceModels || []).includes(serviceModel) || m.service === serviceModel
  ) || null;

  const md: MasterDataEntry[] = selectedMapping?.masterData || [];
  const hasConfigured = (lvl: string) => md.some((e) => e.level === lvl && (e.values?.length ?? 0) > 0);
  const enabledLevels: string[] = selectedMapping
    ? LEVEL_ORDER.filter((l) =>
        selectedMapping.hierarchy?.some((h) => h.level === l && h.enabled) &&
        (l === "Semester" || hasConfigured(l)))
    : [];

  const flatVals = (lvl: string): string[] => {
    const noGroup = md.filter((e) => e.level === lvl && !e.group).flatMap((e) => e.values || []);
    return (noGroup.length ? noGroup : md.filter((e) => e.level === lvl).flatMap((e) => e.values || []));
  };
  const groupVals = (lvl: string, group: string): string[] =>
    md.filter((e) => e.level === lvl && e.group === group).flatMap((e) => e.values || []);
  const semestersFromDegree = (degreeName: string): string[] => {
    const deg = degreesList.find((d) => d.degreeName === degreeName);
    return Array.from({ length: deg?.numberOfSemesters || 0 }, (_, i) => String(i + 1));
  };

  const sampleFor = (): Record<string, string> => {
    const out: Record<string, string> = {};
    const deg = flatVals("Degree")[0] || "";
    const dept = deg ? (groupVals("Department", deg)[0] || "") : (flatVals("Department")[0] || "");
    out.Batch = flatVals("Batch")[0] || "2024-2028";
    out.Degree = deg;
    out.Department = dept;
    const sems = (deg ? groupVals("Semester", deg) : flatVals("Semester"));
    out.Semester = (sems.length ? sems : semestersFromDegree(deg))[0] || "1";
    const secComposite = deg && dept ? groupVals("Section", `${deg}${HIERARCHY_PATH_SEP}${dept}`) : [];
    out.Section = (secComposite[0] || groupVals("Section", dept)[0] || flatVals("Section")[0] || "A");
    const phaseComposite = enabledLevels.includes("Degree") && deg && dept
      ? groupVals("Phase", `${deg}${HIERARCHY_PATH_SEP}${dept}`) : [];
    out.Phase = (phaseComposite[0] || groupVals("Phase", out.Batch)[0] || flatVals("Phase")[0] || "Phase 1");
    return out;
  };

  // Service is optional (spec Section 2 / 22). Role + Client is all that's required.
  const canProceed = Boolean(roleId && clientId);

  const existingEmailSet = useMemo(
    () => new Set(existingUsers.map((u) => (u.email || "").trim().toLowerCase()).filter(Boolean)),
    [existingUsers]
  );

  const downloadTemplate = async () => {
    if (!canProceed) { toast.error("Select role and client first"); return; }
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Users");
    const headers = [...BASE_COLS.map((c) => c.header), ...enabledLevels];
    ws.addRow(headers);
    const sample = sampleFor();
    const sampleRow = [...BASE_COLS.map((c) => c.sample), ...enabledLevels.map((l) => sample[l] || "")];
    ws.addRow(sampleRow);
    ws.getRow(1).font = { bold: true };
    ws.getRow(1).eachCell((cell) => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEFF3FF" } };
    });
    ws.columns.forEach((col) => { col.width = 20; });

    if (enabledLevels.length > 0) {
      const ref = wb.addWorksheet("Allowed values");
      ref.addRow(["Level", "Allowed values"]);
      ref.getRow(1).font = { bold: true };
      enabledLevels.forEach((l) => {
        let vals: string[] = [];
        if (l === "Batch" || l === "Degree") vals = flatVals(l);
        else if (l === "Semester") {
          const deg = flatVals("Degree")[0] || "";
          vals = (deg ? groupVals("Semester", deg) : flatVals("Semester"));
          if (!vals.length) vals = semestersFromDegree(deg);
        } else {
          vals = Array.from(new Set(md.filter((e) => e.level === l).flatMap((e) => e.values || [])));
        }
        ref.addRow([l, vals.join(", ")]);
      });
      ref.columns.forEach((c, i) => { c.width = i === 0 ? 16 : 60; });
    }

    const buf = await wb.xlsx.writeBuffer();
    const safe = (s: string) => (s || "").replace(/[^\w]+/g, "_").slice(0, 24);
    saveAs(new Blob([buf]), `bulk_users_${safe(selectedClient?.clientCompany || "client")}_${safe(serviceModel || "any")}.xlsx`);
  };

  const pickFile = (f: File | null) => {
    if (!f) return;
    if (!/\.(xlsx|xls)$/i.test(f.name)) { toast.error("Please upload an .xlsx file"); return; }
    if (f.size > 5 * 1024 * 1024) { toast.error("File must be under 5MB"); return; }
    setFile(f); setResults(null); setPreviewRows(null); setParseError(null); setPreviewOpen(false);
    void parseFileToPreview(f);
  };

  const parseFileToPreview = async (f: File) => {
    if (!canProceed) {
      setParseError("Pick a role and client first, then the file.");
      return;
    }
    setBusy(true); setValidating(true); setParseError(null);
    try {
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(await f.arrayBuffer());
      const ws = wb.worksheets[0];
      if (!ws) { setParseError("No sheet found in the file"); return; }

      const headerRow = ws.getRow(1);
      const colField: Record<number, string> = {};
      const colDefs = [
        ...BASE_COLS.map((c) => ({ header: c.header, field: c.field })),
        ...enabledLevels.map((l) => ({ header: l, field: LEVEL_FIELD[l] })),
      ];
      const fieldByHeader: Record<string, string> = {};
      colDefs.forEach((c) => { fieldByHeader[norm(c.header)] = c.field; });
      headerRow.eachCell((cell, col) => {
        const fld = fieldByHeader[norm(String(cell.value ?? ""))];
        if (fld) colField[col] = fld;
      });

      const raw: { rowNo: number; data: Record<string, string>; missing: string[] }[] = [];
      ws.eachRow((row, rowNo) => {
        if (rowNo === 1) return;
        const data: Record<string, string> = {};
        let any = false;
        row.eachCell((cell, col) => {
          const fld = colField[col];
          if (!fld) return;
          let v = cell.value as any;
          if (v && typeof v === "object" && "text" in v) v = v.text;
          const str = v == null ? "" : String(v).trim();
          if (str) any = true;
          data[fld] = str;
        });
        if (!any) return;
        const missing: string[] = [];
        if (!data.firstName) missing.push("First Name");
        if (!data.lastName) missing.push("Last Name");
        if (!data.email) missing.push("Email");
        (["Degree", "Department"] as string[]).forEach((l) => {
          if (enabledLevels.includes(l) && !data[LEVEL_FIELD[l]]) missing.push(l);
        });
        raw.push({ rowNo, data, missing });
      });

      if (!raw.length) { setParseError("No data rows found"); return; }

      const emailCounts = new Map<string, number>();
      raw.forEach((r) => {
        const em = (r.data.email || "").trim().toLowerCase();
        if (em) emailCounts.set(em, (emailCounts.get(em) || 0) + 1);
      });

      const classified: PreviewRow[] = raw.map((r) => {
        const email = (r.data.email || "").trim();
        const emailLc = email.toLowerCase();
        if (r.missing.length) {
          return { ...r, category: "invalid", reason: `Missing: ${r.missing.join(", ")}` };
        }
        if (email && !EMAIL_RE.test(email)) {
          return { ...r, category: "invalid", reason: "Invalid email format" };
        }
        if (emailLc && (emailCounts.get(emailLc) || 0) > 1) {
          return { ...r, category: "duplicate", reason: "Email appears more than once in this file" };
        }
        if (emailLc && existingEmailSet.has(emailLc)) {
          return { ...r, category: "existing", reason: "Existing user — will be skipped" };
        }
        return { ...r, category: "new" };
      });

      setPreviewRows(classified);
      // Auto-open the preview sub-modal as soon as the parse finishes so the
      // admin lands directly on the review screen. The X on that sub-modal
      // returns them here; the Preview button in this modal's header
      // re-opens it without re-uploading.
      setPreviewOpen(true);
    } catch (e) {
      console.error(e);
      setParseError("Could not read the file. Use the provided template.");
    } finally {
      setBusy(false); setValidating(false);
    }
  };

  const groups = useMemo(() => {
    const empty: Record<RowCategory, PreviewRow[]> = { new: [], existing: [], invalid: [], duplicate: [] };
    if (!previewRows) return empty;
    return previewRows.reduce((acc, r) => { acc[r.category].push(r); return acc; }, empty);
  }, [previewRows]);

  const counts = {
    total: previewRows?.length || 0,
    new: groups.new.length,
    existing: groups.existing.length,
    invalid: groups.invalid.length,
    duplicate: groups.duplicate.length,
  };

  // ── Create — no per-row picks. Every row in the "new" bucket is created;
  // existing/duplicate/invalid rows are always skipped and reported.
  const handleCreate = async () => {
    if (!previewRows) { toast.error("Upload a file first"); return; }
    if (!canProceed) { toast.error("Select role and client"); return; }
    if (groups.new.length === 0) { toast.error("No new users to add — every parsed row is existing, duplicate or invalid."); return; }
    const token = getToken();
    if (!token) { toast.error("Not authenticated"); return; }

    setBusy(true); setResults(null); setProgress(0);
    const derivedType: "degree-program" | "skilling" | undefined =
      selectedClient?.type?.includes("college") ? "degree-program"
        : selectedClient?.type?.includes("company") ? "skilling" : undefined;

    const out: RowResult[] = [];
    const toCreate = groups.new;
    // Skipped rows count in the final summary so nothing is silently dropped.
    const skipped: RowResult[] = [
      ...groups.existing.map<RowResult>((r) => ({ row: r.rowNo, email: r.data.email || "", status: "exists", reason: "Existing user" })),
      ...groups.duplicate.map<RowResult>((r) => ({ row: r.rowNo, email: r.data.email || "", status: "error", reason: r.reason || "Duplicate in file" })),
      ...groups.invalid.map<RowResult>((r) => ({ row: r.rowNo, email: r.data.email || "", status: "error", reason: r.reason || "Invalid row" })),
    ];

    for (let i = 0; i < toCreate.length; i++) {
      const row = toCreate[i];
      const email = row.data.email || "";
      const userData: any = {
        email, firstName: row.data.firstName, lastName: row.data.lastName,
        phone: row.data.phone || "", gender: row.data.gender || "Male",
        password: row.data.password || DEFAULT_PASSWORD,
        role: roleId, status: "active",
        clientName: selectedClient?.clientCompany, clientId,
      };
      if (serviceModel) userData.serviceModel = serviceModel;
      if (selectedMapping?._id) userData.serviceMappingId = selectedMapping._id;
      if (derivedType) userData.studentType = derivedType;
      enabledLevels.forEach((l) => { userData[LEVEL_FIELD[l]] = row.data[LEVEL_FIELD[l]]; });
      try {
        await addUser(userData, token);
        out.push({ row: row.rowNo, email, status: "created" });
      } catch (err: any) {
        const msg = getApiErrorMessage(err, "Failed");
        out.push({ row: row.rowNo, email, status: /exist/i.test(msg) ? "exists" : "error", reason: msg });
      }
      setProgress(Math.round(((i + 1) / toCreate.length) * 100));
    }

    const combined = [...out, ...skipped];
    setResults(combined);
    const created = out.filter((r) => r.status === "created").length;
    if (created) { toast.success(`${created} user${created !== 1 ? "s" : ""} created`); onComplete(); }
    else toast.error("No users were created — check the results");
    setBusy(false);
  };

  const selectedRole = roles.find((r) => r._id === roleId);

  const Dropdown = ({
    label, icon, value, placeholder, open, setOpen, disabled, children,
  }: any) => (
    <div>
      <Label className="mb-1.5 block text-sm font-medium text-body">{label}</Label>
      <div className="relative">
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen((o: boolean) => !o)}
          className="h-10 w-full flex items-center justify-between gap-2 rounded-control border border-hairline-strong bg-surface px-3 text-sm transition-colors hover:border-line-hover focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15 disabled:cursor-not-allowed disabled:bg-ink-50 disabled:text-subtle"
        >
          <span className="flex items-center gap-2 min-w-0">
            {icon}
            <span className={`truncate ${value ? "text-body" : "text-faint"}`}>{value || placeholder}</span>
          </span>
          <ChevronDown size={15} className={`text-faint transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
        {open && (
          <div className="absolute z-dropdown mt-1.5 w-full max-h-52 overflow-y-auto rounded-tile border border-hairline bg-surface shadow-lg p-1">
            {children}
          </div>
        )}
      </div>
    </div>
  );

  // ── Read-only preview row ─────────────────────────────────────────────────
  const renderPreviewRow = (r: PreviewRow) => (
    <tr key={r.rowNo} className="text-xs hover:bg-row-hover">
      <td className="px-3 py-2 w-12 text-faint tabular-nums">#{r.rowNo}</td>
      <td className="px-2 py-2 font-medium text-body whitespace-nowrap max-w-[180px] truncate">
        {[r.data.firstName, r.data.lastName].filter(Boolean).join(" ") || "—"}
      </td>
      <td className="px-2 py-2 text-subtle whitespace-nowrap max-w-[240px] truncate">
        {r.data.email || "(no email)"}
      </td>
      <td className="px-2 py-2 text-subtle whitespace-nowrap max-w-[140px] truncate">
        {selectedRole?.renameRole || "—"}
      </td>
      <td className="px-2 py-2 text-subtle whitespace-nowrap max-w-[160px] truncate">
        {selectedClient?.clientCompany || "—"}
      </td>
      <td className="px-2 py-2 text-subtle whitespace-nowrap max-w-[160px] truncate">
        {serviceModel || <span className="text-faint">—</span>}
      </td>
      <td className="px-3 py-2 text-right whitespace-nowrap">
        {r.category === "new" && (
          <span className="inline-flex items-center gap-1 rounded-full border border-success-500/20 bg-success-50 px-2 py-0.5 text-2xs font-semibold text-success-700">
            <CheckCircle className="h-3 w-3" /> Yet to add
          </span>
        )}
        {r.category === "existing" && (
          <span className="inline-flex items-center gap-1 rounded-full border border-warn-500/20 bg-warn-50 px-2 py-0.5 text-2xs font-semibold text-warn-700">
            <Info className="h-3 w-3" /> Existing user
          </span>
        )}
        {r.category === "invalid" && (
          <span className="inline-flex items-center gap-1 rounded-full border border-danger-500/20 bg-danger-50 px-2 py-0.5 text-2xs font-semibold text-danger-700" title={r.reason}>
            <AlertTriangle className="h-3 w-3" /> {r.reason || "Invalid"}
          </span>
        )}
        {r.category === "duplicate" && (
          <span className="inline-flex items-center gap-1 rounded-full border border-warn-500/20 bg-warn-50 px-2 py-0.5 text-2xs font-semibold text-warn-700" title={r.reason}>
            <Copy className="h-3 w-3" /> Duplicate in file
          </span>
        )}
      </td>
    </tr>
  );

  const groupOrder: { key: RowCategory; title: string; tone: "success" | "warn" | "danger" }[] = [
    { key: "new", title: "New Users", tone: "success" },
    { key: "existing", title: "Existing Users", tone: "warn" },
    { key: "duplicate", title: "Duplicate Emails in File", tone: "warn" },
    { key: "invalid", title: "Invalid Rows", tone: "danger" },
  ];

  const groupHeader = (title: string, count: number, tone: "success" | "warn" | "danger") => {
    const border = tone === "success" ? "border-l-success-500"
      : tone === "warn" ? "border-l-warn-500"
      : "border-l-danger-500";
    return (
      <tr>
        <td colSpan={7} className={`sticky top-8 z-10 border-l-4 ${border} bg-canvas px-3 py-2 text-2xs font-semibold uppercase tracking-wider text-subtle`}>
          {title} <span className="text-heading tabular-nums">({count})</span>
        </td>
      </tr>
    );
  };

  return (
    <>
      {/* ── Main modal — Step 1 (config + upload) ─────────────────────────── */}
      <Dialog open={isOpen} onOpenChange={(o) => { if (!o && !busy) onClose(); }}>
        <DialogContent
          className="!max-w-none flex flex-col gap-0 p-0 overflow-hidden rounded-2xl shadow-2xl bg-surface"
          style={{ width: "95vw", height: "95vh" }}
          showCloseButton={false}
          onInteractOutside={(e) => e.preventDefault()}
        >
          {/* Header — title on the left; Template + Preview + X on the right */}
          <DialogHeader className="px-6 pt-4 pb-3 border-b border-hairline">
            <div className="flex items-start justify-between gap-3">
              <DialogTitle className="text-base font-semibold text-heading text-left flex items-center gap-2">
                <span className="w-7 h-7 rounded-tile bg-brand-wash flex items-center justify-center">
                  <FileSpreadsheet className="h-3.5 w-3.5 text-brand-strong" />
                </span>
                Bulk Upload
              </DialogTitle>
              <div className="flex items-center gap-1.5">
                {canProceed && (
                  <button
                    type="button"
                    onClick={downloadTemplate}
                    aria-label="Download template"
                    className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-control border border-hairline-strong bg-surface text-xs font-medium text-body hover:bg-row-hover hover:text-heading transition-colors duration-150"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Template</span>
                  </button>
                )}
                {previewRows && previewRows.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setPreviewOpen(true)}
                    aria-label="Open preview"
                    className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-control border border-brand text-xs font-semibold text-brand-strong bg-brand-wash hover:bg-brand-wash/70 transition-colors duration-150"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Preview</span>
                    <span className="tabular-nums">({counts.total})</span>
                  </button>
                )}
                <DialogClose
                  aria-label="Close"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-danger-500 bg-danger-500 text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-danger-500/40 disabled:pointer-events-none"
                >
                  <X className="h-3.5 w-3.5" />
                </DialogClose>
              </div>
            </div>
            <DialogDescription className="sr-only">
              Pick role and client, upload the filled template, then review the parsed rows in the preview before creating any accounts.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5 space-y-4">
            {/* Config selectors — Role * / Client * / Service (Service unmarked) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Dropdown
                label={<>Role <span className="text-brand-strong">*</span></>}
                icon={<ShieldCheck size={14} className="text-subtle" />}
                value={selectedRole?.renameRole} placeholder="Select role" open={roleOpen} setOpen={setRoleOpen}
              >
                {roles.length === 0 ? <p className="px-3 py-2 text-xs text-faint">No roles</p> :
                  roles.map((r) => (
                    <button key={r._id} type="button"
                      onClick={() => { setRoleId(r._id); setRoleOpen(false); }}
                      className={`w-full text-left rounded-chip px-2.5 py-2 text-sm transition-colors duration-150 ${roleId === r._id ? "bg-brand-wash text-heading" : "text-body hover:bg-row-hover"}`}>
                      {r.renameRole}
                    </button>
                  ))}
              </Dropdown>

              <Dropdown
                label={<>Client <span className="text-brand-strong">*</span></>}
                icon={<Building2 size={14} className="text-subtle" />}
                value={selectedClient?.clientCompany} placeholder="Select client" open={clientOpen} setOpen={setClientOpen}
              >
                {clients.length === 0 ? <p className="px-3 py-2 text-xs text-faint">No clients</p> :
                  clients.map((c) => (
                    <button key={c._id} type="button"
                      onClick={() => { setClientId(c._id); setServiceModel(""); setClientOpen(false); }}
                      className={`w-full text-left rounded-chip px-2.5 py-2 text-sm transition-colors duration-150 ${clientId === c._id ? "bg-brand-wash text-heading" : "text-body hover:bg-row-hover"}`}>
                      {c.clientCompany}
                    </button>
                  ))}
              </Dropdown>

              <Dropdown
                label="Service"
                icon={<Briefcase size={14} className="text-subtle" />}
                value={serviceModel} placeholder={clientId ? "Optional — leave blank to skip" : "Pick client first"}
                open={modelOpen} setOpen={setModelOpen} disabled={!clientId}
              >
                <button type="button"
                  onClick={() => { setServiceModel(""); setModelOpen(false); }}
                  className={`w-full text-left rounded-chip px-2.5 py-2 text-sm transition-colors duration-150 ${!serviceModel ? "bg-brand-wash text-heading" : "text-body hover:bg-row-hover"}`}>
                  <span className="text-faint">— No service —</span>
                </button>
                {serviceModelOptions.length === 0 ? <p className="px-3 py-2 text-xs text-faint">No mappings for this client</p> :
                  serviceModelOptions.map((m) => (
                    <button key={m} type="button"
                      onClick={() => { setServiceModel(m); setModelOpen(false); }}
                      className={`w-full text-left rounded-chip px-2.5 py-2 text-sm transition-colors duration-150 ${serviceModel === m ? "bg-brand-wash text-heading" : "text-body hover:bg-row-hover"}`}>
                      {m}
                    </button>
                  ))}
              </Dropdown>
            </div>

            {/* Dropzone (before results) */}
            {!results && (
              <div
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-tile p-6 text-center cursor-pointer transition-colors duration-150 ${file ? "border-success-500/50 bg-success-50" : "border-hairline-strong hover:border-line-hover hover:bg-canvas"} ${!canProceed ? "opacity-50 pointer-events-none" : ""}`}
              >
                <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden"
                  onChange={(e) => pickFile(e.target.files?.[0] || null)} />
                {file ? (
                  <div className="space-y-1">
                    <CheckCircle className="h-7 w-7 text-success-500 mx-auto" />
                    <p className="text-sm font-medium text-heading">{file.name}</p>
                    <button type="button" onClick={(e) => { e.stopPropagation(); setFile(null); setPreviewRows(null); setPreviewOpen(false); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                      className="text-xs text-subtle hover:text-danger-700 inline-flex items-center gap-1 transition-colors duration-150">
                      <X className="h-3 w-3" /> Remove
                    </button>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <FileSpreadsheet className="h-7 w-7 text-faint mx-auto" />
                    <p className="text-sm font-medium text-heading">Click to select the filled template</p>
                    <p className="text-xs text-subtle">.xlsx up to 5MB · preview opens automatically · Role & Client required, Service optional</p>
                  </div>
                )}
              </div>
            )}

            {/* Validating strip */}
            {validating && (
              <div className="rounded-tile border border-hairline bg-canvas px-3 py-2 text-xs text-subtle flex items-center gap-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-brand-strong" />
                Validating users…
              </div>
            )}

            {/* Parse error banner */}
            {parseError && !previewRows && (
              <div className="rounded-tile border border-danger-500/30 bg-danger-50 text-danger-700 px-3 py-2 text-xs">
                {parseError}
              </div>
            )}

            {/* At-a-glance summary chips — kept on the main modal after parse
                so admin knows what awaits inside the Preview without opening it. */}
            {previewRows && !results && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-full border border-hairline bg-surface px-2.5 py-1 text-2xs font-semibold text-heading">
                  Total <span className="tabular-nums">{counts.total}</span>
                </span>
                <span className="inline-flex items-center gap-1 rounded-full border border-success-500/25 bg-success-50 px-2.5 py-1 text-2xs font-semibold text-success-700">
                  <CheckCircle className="h-3 w-3" /> New <span className="tabular-nums">{counts.new}</span>
                </span>
                <span className="inline-flex items-center gap-1 rounded-full border border-warn-500/25 bg-warn-50 px-2.5 py-1 text-2xs font-semibold text-warn-700">
                  <Info className="h-3 w-3" /> Existing users <span className="tabular-nums">{counts.existing}</span>
                </span>
                <span className="inline-flex items-center gap-1 rounded-full border border-warn-500/25 bg-warn-50 px-2.5 py-1 text-2xs font-semibold text-warn-700">
                  <Copy className="h-3 w-3" /> Duplicates <span className="tabular-nums">{counts.duplicate}</span>
                </span>
                <span className="inline-flex items-center gap-1 rounded-full border border-danger-500/25 bg-danger-50 px-2.5 py-1 text-2xs font-semibold text-danger-700">
                  <AlertTriangle className="h-3 w-3" /> Invalid <span className="tabular-nums">{counts.invalid}</span>
                </span>
              </div>
            )}

            {/* Results — post-submit summary in the spec's wording. */}
            {results && (() => {
              const created = results.filter((r) => r.status === "created").length;
              const existed = results.filter((r) => r.status === "exists").length;
              const errored = results.filter((r) => r.status === "error").length;
              return (
                <div className="space-y-3">
                  <div className="rounded-tile border border-success-500/25 bg-success-50 px-4 py-3">
                    <p className="text-sm font-semibold text-success-700 flex items-center gap-2">
                      <CheckCircle className="h-4 w-4" /> Bulk Upload Completed
                    </p>
                    <p className="text-xs text-heading mt-1">
                      <span className="font-semibold tabular-nums">{created}</span> user{created === 1 ? "" : "s"} added ·{" "}
                      <span className="font-semibold tabular-nums">{existed}</span> existing user{existed === 1 ? "" : "s"} skipped ·{" "}
                      <span className="font-semibold tabular-nums">{errored}</span> invalid record{errored === 1 ? "" : "s"} skipped
                    </p>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: "Created", n: created, cls: "border-success-500/20 bg-success-50 text-success-700" },
                      { label: "Already existed", n: existed, cls: "border-warn-500/20 bg-warn-50 text-warn-700" },
                      { label: "Errors", n: errored, cls: "border-danger-500/20 bg-danger-50 text-danger-700" },
                    ].map((s) => (
                      <div key={s.label} className={`rounded-tile border p-2.5 text-center ${s.cls}`}>
                        <p className="text-lg font-bold tabular-nums">{s.n}</p>
                        <p className="text-2xs font-medium">{s.label}</p>
                      </div>
                    ))}
                  </div>
                  <div className="max-h-48 overflow-y-auto border border-hairline rounded-tile divide-y divide-hairline">
                    {results.map((r, i) => (
                      <div key={i} className="flex items-center gap-2 px-3 py-1.5 text-xs">
                        {r.status === "created" ? <CheckCircle className="h-3.5 w-3.5 text-success-500 flex-shrink-0" />
                          : <XCircle className={`h-3.5 w-3.5 flex-shrink-0 ${r.status === "exists" ? "text-warn-500" : "text-danger-500"}`} />}
                        <span className="text-faint tabular-nums">Row {r.row}</span>
                        <span className="font-medium text-body truncate">{r.email || "—"}</span>
                        {r.reason && <span className="text-faint truncate ml-auto">{r.reason}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>

          <DialogFooter className="bg-surface px-6 pb-4 pt-3 border-t border-hairline">
            <div className="flex w-full justify-end items-center">
              <Button
                variant="outline"
                onClick={onClose}
                disabled={busy}
                className="h-9 px-4 text-xs font-semibold rounded-control"
              >
                {results ? "Done" : "Close"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Nested full-screen Preview sub-modal ─────────────────────────── */}
      {/* Opens automatically after a successful parse; closes with X and
          reopens via the Preview button in the main modal's header. */}
      <Dialog open={previewOpen && !!previewRows && !results} onOpenChange={(o) => { if (!o && !busy) setPreviewOpen(false); }}>
        <DialogContent
          className="!max-w-none flex flex-col gap-0 p-0 overflow-hidden rounded-2xl shadow-2xl bg-surface"
          style={{ width: "95vw", height: "95vh" }}
          showCloseButton={false}
          onInteractOutside={(e) => e.preventDefault()}
        >
          <DialogHeader className="px-6 pt-4 pb-3 border-b border-hairline">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <DialogTitle className="text-base font-semibold text-heading text-left flex items-center gap-2">
                  <span className="w-7 h-7 rounded-tile bg-brand-wash flex items-center justify-center">
                    <FileSpreadsheet className="h-3.5 w-3.5 text-brand-strong" />
                  </span>
                  Bulk Upload Preview
                </DialogTitle>
                <DialogDescription className="mt-1 text-2xs text-subtle">
                  Read-only list of every parsed row. Only rows marked <span className="font-semibold text-success-700">Yet to add</span> will be added.
                </DialogDescription>
              </div>
              <div className="flex items-center gap-2">
                <div className="hidden sm:flex flex-wrap items-center gap-1.5">
                  <span className="inline-flex items-center gap-1 rounded-full border border-hairline bg-surface px-2 py-0.5 text-2xs font-semibold text-heading">
                    Total <span className="tabular-nums">{counts.total}</span>
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full border border-success-500/25 bg-success-50 px-2 py-0.5 text-2xs font-semibold text-success-700">
                    New <span className="tabular-nums">{counts.new}</span>
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full border border-warn-500/25 bg-warn-50 px-2 py-0.5 text-2xs font-semibold text-warn-700">
                    Existing users <span className="tabular-nums">{counts.existing}</span>
                  </span>
                </div>
                <DialogClose
                  aria-label="Close preview"
                  className="inline-flex items-center gap-1.5 h-8 px-3 rounded-control border border-danger-500 bg-danger-500 text-xs font-semibold text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-danger-500/40"
                >
                  <X className="h-3.5 w-3.5" />
                  Close Preview
                </DialogClose>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-hidden px-6 py-4 flex flex-col gap-3">
            {/* Helper line only when there is actually something to add —
                "click Add 0 Users" reads as nonsense when every row is an
                existing / duplicate / invalid one. */}
            {counts.new > 0 && (
              <p className="flex-shrink-0 text-2xs text-subtle">
                Not added yet — click <span className="font-semibold text-heading">Add {counts.new} User{counts.new === 1 ? "" : "s"}</span> to add the “Yet to add” rows. Other rows are skipped.
              </p>
            )}

            <div className="flex-1 min-h-0 border border-hairline rounded-tile overflow-hidden">
              <div className="h-full overflow-auto">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 z-20 bg-surface">
                    <tr className="text-2xs font-semibold uppercase tracking-wider text-subtle border-b border-hairline">
                      <th className="px-3 py-2 w-12 text-left">#</th>
                      <th className="px-2 py-2 text-left">Name</th>
                      <th className="px-2 py-2 text-left">Email</th>
                      <th className="px-2 py-2 text-left">Role</th>
                      <th className="px-2 py-2 text-left">Client</th>
                      <th className="px-2 py-2 text-left">Service</th>
                      <th className="px-3 py-2 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-hairline">
                    {groupOrder.filter((g) => groups[g.key].length > 0).map((g) => (
                      <Fragment key={g.key}>
                        {groupHeader(g.title, groups[g.key].length, g.tone)}
                        {groups[g.key].map(renderPreviewRow)}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {busy && (
              <div className="space-y-2 flex-shrink-0">
                <div className="w-full bg-ink-100 rounded-full h-2 overflow-hidden">
                  <div className="h-2 rounded-full bg-brand-strong transition-all" style={{ width: `${progress}%` }} />
                </div>
                <p className="text-xs text-center text-subtle flex items-center justify-center gap-1.5">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Creating users… {progress}%
                </p>
              </div>
            )}
          </div>

          <DialogFooter className="bg-surface px-6 pb-4 pt-3 border-t border-hairline">
            <div className="flex w-full justify-between items-center">
              <Button
                variant="outline"
                onClick={() => { if (!busy) setPreviewOpen(false); }}
                disabled={busy}
                className="h-9 px-4 text-xs font-semibold rounded-control"
              >
                Cancel
              </Button>
              <span
                title={counts.new === 0 ? "Every row is an existing, duplicate or invalid user — upload a file with new emails to add users." : undefined}
              >
                <Button
                  onClick={handleCreate}
                  disabled={!canProceed || counts.new === 0 || busy}
                  className="h-9 px-4 text-xs font-semibold rounded-control"
                >
                  {busy ? (
                    <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Creating…</>
                  ) : counts.new === 0 ? (
                    <><Info className="h-3.5 w-3.5" /> No New Users to Add</>
                  ) : (
                    <><UserPlus className="h-3.5 w-3.5" /> Add {counts.new} User{counts.new === 1 ? "" : "s"}</>
                  )}
                </Button>
              </span>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
