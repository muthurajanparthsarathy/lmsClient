"use client";
import { getToken } from "@/lib/session";
import { useEffect, useRef, useState } from "react";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Upload, Download, X, CheckCircle, XCircle, Loader2, Building2, Briefcase, ShieldCheck, FileSpreadsheet, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { addUser } from "@/apiServices/userService";
import { type ServiceMapping, type MasterDataEntry } from "@/apiServices/serviceMappingService";
import { type Degree } from "@/apiServices/dynamicFields/degreeService";
import { useClientsQuery, useDegreesQuery, useServiceMappingsQuery } from "@/queries/referenceData";
import { Role } from "./types";

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

interface Client { _id: string; clientCompany: string; status?: string; type?: ("college" | "company")[]; }

interface RowResult { row: number; email: string; status: "created" | "exists" | "error"; reason?: string; }

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
  onComplete: () => void;
}

export default function BulkUserModal({ isOpen, onClose, roles, onComplete }: BulkUserModalProps) {
  const [roleId, setRoleId] = useState("");
  const [clientId, setClientId] = useState("");
  const [serviceModel, setServiceModel] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<RowResult[] | null>(null);

  // Reference data — shared cache entries (src/queries/referenceData.ts), the
  // same ones the Add/Edit User modal reads, so opening this modal after that
  // one costs zero extra requests within the stale window.
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

  // Reset the form whenever the modal opens
  useEffect(() => {
    if (!isOpen) return;
    setRoleId(""); setClientId(""); setServiceModel(""); setFile(null); setResults(null); setProgress(0); setBusy(false);
  }, [isOpen]);

  // ── Cascade (client → service model → mapping → levels) ──
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

  // A representative sample value for each level, kept consistent down the tree.
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

  const canProceed = Boolean(roleId && clientId && serviceModel && selectedMapping);

  // ── Download a template matching the selected mapping ──
  const downloadTemplate = async () => {
    if (!selectedMapping) { toast.error("Select role, client and service model first"); return; }
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

    // Reference sheet: allowed values per level so the filler knows what's valid.
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

    const buf = await wb.xlsx.writeBuffer();
    const safe = (s: string) => (s || "").replace(/[^\w]+/g, "_").slice(0, 24);
    saveAs(new Blob([buf]), `bulk_users_${safe(selectedClient?.clientCompany || "client")}_${safe(serviceModel)}.xlsx`);
  };

  const pickFile = (f: File | null) => {
    if (!f) return;
    if (!/\.(xlsx|xls)$/i.test(f.name)) { toast.error("Please upload an .xlsx file"); return; }
    if (f.size > 5 * 1024 * 1024) { toast.error("File must be under 5MB"); return; }
    setFile(f); setResults(null);
  };

  // ── Parse + create ──
  const handleUpload = async () => {
    if (!canProceed) { toast.error("Select role, client and service model"); return; }
    if (!file) { toast.error("Choose a filled template first"); return; }
    const token = getToken();
    if (!token) { toast.error("Not authenticated"); return; }

    setBusy(true); setResults(null); setProgress(0);
    try {
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(await file.arrayBuffer());
      const ws = wb.worksheets[0];
      if (!ws) { toast.error("No sheet found in the file"); setBusy(false); return; }

      // Map each column index → field via the header row.
      const headerRow = ws.getRow(1);
      const colField: Record<number, string> = {};
      const colDefs = [
        ...BASE_COLS.map((c) => ({ header: c.header, field: c.field })),
        ...enabledLevels.map((l) => ({ header: l, field: LEVEL_FIELD[l] })),
      ];
      const fieldByHeader: Record<string, string> = {};
      colDefs.forEach((c) => { fieldByHeader[norm(c.header)] = c.field; });
      headerRow.eachCell((cell, col) => {
        const f = fieldByHeader[norm(String(cell.value ?? ""))];
        if (f) colField[col] = f;
      });

      // Collect data rows
      const rows: { rowNo: number; data: Record<string, string> }[] = [];
      ws.eachRow((row, rowNo) => {
        if (rowNo === 1) return;
        const data: Record<string, string> = {};
        let any = false;
        row.eachCell((cell, col) => {
          const f = colField[col];
          if (!f) return;
          let v = cell.value as any;
          if (v && typeof v === "object" && "text" in v) v = v.text; // rich text / hyperlink
          const str = v == null ? "" : String(v).trim();
          if (str) any = true;
          data[f] = str;
        });
        if (any) rows.push({ rowNo, data });
      });

      if (!rows.length) { toast.error("No data rows found"); setBusy(false); return; }

      const derivedType: "degree-program" | "skilling" | undefined =
        selectedClient?.type?.includes("college") ? "degree-program"
          : selectedClient?.type?.includes("company") ? "skilling" : undefined;

      const out: RowResult[] = [];
      for (let i = 0; i < rows.length; i++) {
        const { rowNo, data } = rows[i];
        const email = data.email || "";
        // Validate required base + every enabled level
        const missing: string[] = [];
        if (!data.firstName) missing.push("First Name");
        if (!data.lastName) missing.push("Last Name");
        if (!email) missing.push("Email");
        // Degree + department are required when the chosen mapping is a degree
        // program (it enables those levels); section and every other level stay
        // optional. Placement / skilling mappings require nothing beyond the base.
        (["Degree", "Department"] as string[]).forEach((l) => {
          if (enabledLevels.includes(l) && !data[LEVEL_FIELD[l]]) missing.push(l);
        });
        if (missing.length) {
          out.push({ row: rowNo, email, status: "error", reason: `Missing: ${missing.join(", ")}` });
          setProgress(Math.round(((i + 1) / rows.length) * 100));
          continue;
        }

        const userData: any = {
          email,
          firstName: data.firstName,
          lastName: data.lastName,
          phone: data.phone || "",
          gender: data.gender || "Male",
          password: data.password || DEFAULT_PASSWORD,
          role: roleId,
          status: "active",
          clientName: selectedClient?.clientCompany,
          clientId,
          serviceModel,
        };
        if (derivedType) userData.studentType = derivedType;
        enabledLevels.forEach((l) => { userData[LEVEL_FIELD[l]] = data[LEVEL_FIELD[l]]; });

        try {
          await addUser(userData, token);
          out.push({ row: rowNo, email, status: "created" });
        } catch (err: any) {
          const msg = getApiErrorMessage(err, "Failed");
          out.push({ row: rowNo, email, status: /exist/i.test(msg) ? "exists" : "error", reason: msg });
        }
        setProgress(Math.round(((i + 1) / rows.length) * 100));
      }

      setResults(out);
      const created = out.filter((r) => r.status === "created").length;
      if (created) { toast.success(`${created} user${created !== 1 ? "s" : ""} created`); onComplete(); }
      else toast.error("No users were created — check the results");
    } catch (e) {
      console.error(e);
      toast.error("Could not read the file. Use the provided template.");
    } finally {
      setBusy(false);
    }
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

  // Presentational step marker — derived from the same state the flow already
  // tracks (configure → upload → results), no state of its own.
  const currentStep = results ? 3 : canProceed ? 2 : 1;
  const steps = ["Configure", "Upload", "Results"];

  return (
    <Dialog open={isOpen} onOpenChange={(o) => { if (!o && !busy) onClose(); }}>
      <DialogContent className="sm:max-w-[640px] max-h-[88vh] flex flex-col gap-0 p-0 overflow-hidden">
        <DialogHeader className="border-b border-hairline px-5 py-4">
          <DialogTitle className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-tile bg-brand-wash flex items-center justify-center">
              <FileSpreadsheet className="h-4 w-4 text-brand-strong" />
            </span>
            Bulk add users
          </DialogTitle>
          <DialogDescription>
            Pick the role, client and service model, download the matching template, fill it, and upload.
          </DialogDescription>
          <div className="flex items-center gap-2 pt-1" aria-hidden="true">
            {steps.map((s, i) => (
              <div key={s} className="flex items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1.5 h-6 pl-1 pr-2.5 rounded-full text-2xs font-semibold transition-colors duration-150 ${
                    currentStep === i + 1
                      ? "bg-brand-wash text-brand-strong"
                      : currentStep > i + 1
                        ? "bg-success-50 text-success-700"
                        : "bg-ink-100 text-subtle"
                  }`}
                >
                  <span className={`w-4 h-4 rounded-full text-[10px] flex items-center justify-center font-bold ${
                    currentStep === i + 1
                      ? "bg-brand-strong text-white"
                      : currentStep > i + 1
                        ? "bg-success-500 text-white"
                        : "bg-ink-200 text-ink-700"
                  }`}>
                    {i + 1}
                  </span>
                  {s}
                </span>
                {i < steps.length - 1 && <span className="w-4 h-px bg-ink-200" />}
              </div>
            ))}
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Selectors */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Dropdown label="Role" icon={<ShieldCheck size={14} className="text-subtle" />}
              value={selectedRole?.renameRole} placeholder="Select role" open={roleOpen} setOpen={setRoleOpen}>
              {roles.length === 0 ? <p className="px-3 py-2 text-xs text-faint">No roles</p> :
                roles.map((r) => (
                  <button key={r._id} type="button"
                    onClick={() => { setRoleId(r._id); setRoleOpen(false); }}
                    className={`w-full text-left rounded-chip px-2.5 py-2 text-sm transition-colors duration-150 ${roleId === r._id ? "bg-brand-wash text-heading" : "text-body hover:bg-row-hover"}`}>
                    {r.renameRole}
                  </button>
                ))}
            </Dropdown>

            <Dropdown label="Client" icon={<Building2 size={14} className="text-subtle" />}
              value={selectedClient?.clientCompany} placeholder="Select client" open={clientOpen} setOpen={setClientOpen}>
              {clients.length === 0 ? <p className="px-3 py-2 text-xs text-faint">No clients</p> :
                clients.map((c) => (
                  <button key={c._id} type="button"
                    onClick={() => { setClientId(c._id); setServiceModel(""); setClientOpen(false); }}
                    className={`w-full text-left rounded-chip px-2.5 py-2 text-sm transition-colors duration-150 ${clientId === c._id ? "bg-brand-wash text-heading" : "text-body hover:bg-row-hover"}`}>
                    {c.clientCompany}
                  </button>
                ))}
            </Dropdown>

            <Dropdown label="Service model" icon={<Briefcase size={14} className="text-subtle" />}
              value={serviceModel} placeholder={clientId ? "Select model" : "Pick client first"}
              open={modelOpen} setOpen={setModelOpen} disabled={!clientId}>
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

          {/* Structure hint + template */}
          {canProceed && (
            <div className="rounded-tile border border-brand-500/20 bg-brand-wash p-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-heading">Template columns</p>
                <p className="text-2xs text-subtle truncate">
                  {[...BASE_COLS.map((c) => c.header), ...enabledLevels].join(" · ")}
                </p>
              </div>
              <Button onClick={downloadTemplate} variant="outline" size="sm" className="flex items-center gap-1.5 text-xs flex-shrink-0">
                <Download className="h-3.5 w-3.5" /> Template
              </Button>
            </div>
          )}

          {/* Dropzone */}
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
                  <button type="button" onClick={(e) => { e.stopPropagation(); setFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                    className="text-xs text-subtle hover:text-danger-700 inline-flex items-center gap-1 transition-colors duration-150">
                    <X className="h-3 w-3" /> Remove
                  </button>
                </div>
              ) : (
                <div className="space-y-1">
                  <Upload className="h-7 w-7 text-faint mx-auto" />
                  <p className="text-sm font-medium text-heading">Click to upload the filled template</p>
                  <p className="text-xs text-subtle">.xlsx up to 5MB</p>
                </div>
              )}
            </div>
          )}

          {/* Progress */}
          {busy && (
            <div className="space-y-2">
              <div className="w-full bg-ink-100 rounded-full h-2 overflow-hidden">
                <div className="h-2 rounded-full bg-brand-strong transition-all" style={{ width: `${progress}%` }} />
              </div>
              <p className="text-xs text-center text-subtle flex items-center justify-center gap-1.5">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Creating users… {progress}%
              </p>
            </div>
          )}

          {/* Results */}
          {results && (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: "Created", n: results.filter((r) => r.status === "created").length, cls: "border-success-500/20 bg-success-50 text-success-700" },
                  { label: "Already existed", n: results.filter((r) => r.status === "exists").length, cls: "border-warn-500/20 bg-warn-50 text-warn-700" },
                  { label: "Errors", n: results.filter((r) => r.status === "error").length, cls: "border-danger-500/20 bg-danger-50 text-danger-700" },
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
          )}
        </div>

        <DialogFooter className="border-t border-hairline bg-surface px-5 py-3.5">
          <div className="flex w-full justify-between items-center">
            <Button variant="outline" size="sm" onClick={onClose} disabled={busy}>
              {results ? "Close" : "Cancel"}
            </Button>
            {!results && (
              <Button onClick={handleUpload} disabled={!canProceed || !file || busy} size="sm">
                {busy ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Uploading…</>
                  : <><Upload className="h-3.5 w-3.5" /> Upload &amp; create</>}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
