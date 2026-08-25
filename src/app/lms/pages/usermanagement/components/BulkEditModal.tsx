"use client";
import { getToken } from "@/lib/session";
import { Fragment, useEffect, useMemo, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  X, CheckCircle, XCircle, Loader2, Building2, Briefcase, ShieldCheck, ChevronDown, Search,
  UserCog, Info, ArrowRight, Users,
} from "lucide-react";
import { toast } from "sonner";
import { updateUser } from "@/apiServices/userService";
import { type ServiceMapping } from "@/apiServices/serviceMappingService";
import { useClientsQuery, useServiceMappingsQuery } from "@/queries/referenceData";
import { Role, User } from "./types";

// ─── Local helpers ────────────────────────────────────────────────────────────
interface Client { _id: string; clientCompany: string; status?: string; type?: ("college" | "company")[]; }

interface RowResult {
  userId: string;
  email: string;
  status: "updated" | "already_mapped" | "error";
  reason?: string;
}

const getApiErrorMessage = (error: any, fallback: string): string => {
  const data = error?.response?.data;
  const msg = data?.message;
  if (Array.isArray(msg) && msg[0]?.value) return msg[0].value;
  if (typeof msg === "string" && msg.trim()) return msg;
  return fallback;
};

const isBlank = (v?: string | null) => !v || !v.trim();

interface BulkEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  roles: Role[];
  existingUsers: User[];
  onComplete: () => void;
}

export default function BulkEditModal({ isOpen, onClose, roles, existingUsers, onComplete }: BulkEditModalProps) {
  // Step-tracker — three explicit stages so the admin always knows where they are.
  type Stage = "pick" | "target" | "preview" | "results";
  const [stage, setStage] = useState<Stage>("pick");

  // Selection state — Set of user ids so it survives filter/search changes.
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());

  // Pick-user filters
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filterRoleId, setFilterRoleId] = useState<string>("");
  const [filterClientName, setFilterClientName] = useState<string>("");
  const [filterRoleOpen, setFilterRoleOpen] = useState(false);
  const [filterClientOpen, setFilterClientOpen] = useState(false);

  // Target — blank means "leave unchanged" for that field.
  const [targetRoleId, setTargetRoleId] = useState<string>("");
  const [targetClientId, setTargetClientId] = useState<string>("");
  const [targetService, setTargetService] = useState<string>("");
  const [targetRoleOpen, setTargetRoleOpen] = useState(false);
  const [targetClientOpen, setTargetClientOpen] = useState(false);
  const [targetServiceOpen, setTargetServiceOpen] = useState(false);

  // Preview-stage selection (which rows will actually be updated — always a
  // subset of "Will Update" rows; Already-Mapped rows are never selectable).
  const [previewSelectedIds, setPreviewSelectedIds] = useState<Set<string>>(new Set());

  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<RowResult[] | null>(null);

  // Reference data — reused from the same shared cache as BulkUserModal / UserModals
  const { data: clientsData } = useClientsQuery(isOpen);
  const { data: mappingsData } = useServiceMappingsQuery(isOpen);
  const clients = (clientsData ?? []) as Client[];
  const mappings = (mappingsData ?? []) as ServiceMapping[];

  // Reset the whole flow on open/close so the modal never remembers the prior run.
  useEffect(() => {
    if (!isOpen) return;
    setStage("pick");
    setSelectedUserIds(new Set());
    setSearch(""); setDebouncedSearch("");
    setFilterRoleId(""); setFilterClientName("");
    setTargetRoleId(""); setTargetClientId(""); setTargetService("");
    setPreviewSelectedIds(new Set());
    setBusy(false); setProgress(0); setResults(null);
  }, [isOpen]);

  // Debounce search for the roster filter (mirrors the page's own search)
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 250);
    return () => clearTimeout(t);
  }, [search]);

  // ── Roster filtering (pick stage) ─────────────────────────────────────────
  const filteredUsers = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    return existingUsers.filter((u) => {
      if (filterRoleId && u.roleId !== filterRoleId) return false;
      if (filterClientName && (u.clientName || "") !== filterClientName) return false;
      if (q) {
        const hay = [
          u.firstName, u.lastName, u.email, u.role, u.clientName, u.serviceModel,
        ].map((v) => (v || "").toLowerCase()).join(" ");
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [existingUsers, debouncedSearch, filterRoleId, filterClientName]);

  // Deduped list of client names present on existing users — the pick-stage
  // client filter (independent of the target-client dropdown below).
  const clientFilterOptions = useMemo(() => {
    const s = new Set<string>();
    existingUsers.forEach((u) => { if (u.clientName) s.add(u.clientName); });
    return Array.from(s).sort();
  }, [existingUsers]);

  const allFilteredSelected =
    filteredUsers.length > 0 && filteredUsers.every((u) => selectedUserIds.has(u.id));
  const toggleAllFiltered = () => {
    setSelectedUserIds((prev) => {
      const next = new Set(prev);
      if (allFilteredSelected) filteredUsers.forEach((u) => next.delete(u.id));
      else filteredUsers.forEach((u) => next.add(u.id));
      return next;
    });
  };
  const toggleOneUser = (id: string) => {
    setSelectedUserIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // ── Target-stage reference data ───────────────────────────────────────────
  const targetClient = clients.find((c) => c._id === targetClientId);
  const clientMappings = targetClientId
    ? mappings.filter((m) => (typeof m.client === "string" ? m.client : m.client?._id) === targetClientId)
    : [];
  const targetServiceOptions = Array.from(new Set(
    clientMappings.flatMap((m) => (m.serviceModels?.length ? m.serviceModels : [m.service])).filter(Boolean)
  )) as string[];
  const targetMapping = clientMappings.find(
    (m) => (m.serviceModels || []).includes(targetService) || m.service === targetService
  ) || null;

  // At least one target field must be non-blank OR the flow can't proceed.
  const hasAnyTarget = !isBlank(targetRoleId) || !isBlank(targetClientId) || !isBlank(targetService);

  const selectedUsers = useMemo(
    () => existingUsers.filter((u) => selectedUserIds.has(u.id)),
    [existingUsers, selectedUserIds]
  );

  // ── Preview-stage row classification ──────────────────────────────────────
  type PreviewRow = {
    user: User;
    changed: { role: boolean; client: boolean; service: boolean };
    alreadyMapped: boolean;
    newRoleLabel: string;
    newClientLabel: string;
    newServiceLabel: string;
  };

  const rolesById = useMemo(() => {
    const m = new Map<string, Role>();
    roles.forEach((r) => m.set(r._id, r));
    return m;
  }, [roles]);

  const previewRows: PreviewRow[] = useMemo(() => {
    const newRoleName = targetRoleId ? (rolesById.get(targetRoleId)?.renameRole || "") : "";
    const newClientName = targetClient?.clientCompany || "";
    const newService = targetService || "";
    return selectedUsers.map((u) => {
      const changedRole = !isBlank(targetRoleId) && targetRoleId !== u.roleId;
      const changedClient = !isBlank(newClientName) && newClientName !== (u.clientName || "");
      const changedService = !isBlank(newService) && newService !== (u.serviceModel || "");
      const anyChange = changedRole || changedClient || changedService;
      return {
        user: u,
        changed: { role: changedRole, client: changedClient, service: changedService },
        alreadyMapped: !anyChange,
        newRoleLabel: newRoleName || "—",
        newClientLabel: newClientName || "—",
        newServiceLabel: newService || "—",
      };
    });
  }, [selectedUsers, targetRoleId, targetClientId, targetService, targetClient, targetService, rolesById]);

  const willUpdate = previewRows.filter((r) => !r.alreadyMapped);
  const alreadyMappedRows = previewRows.filter((r) => r.alreadyMapped);

  // Preview select-all only affects "Will Update" rows — Already-Mapped ones
  // can never be selected (Section 15 dedup guarantee).
  const allWillUpdateSelected =
    willUpdate.length > 0 && willUpdate.every((r) => previewSelectedIds.has(r.user.id));
  const toggleAllWillUpdate = () => {
    setPreviewSelectedIds((prev) => {
      const next = new Set(prev);
      if (allWillUpdateSelected) willUpdate.forEach((r) => next.delete(r.user.id));
      else willUpdate.forEach((r) => next.add(r.user.id));
      return next;
    });
  };
  const togglePreviewOne = (id: string) => {
    setPreviewSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // Seed preview selection with every "Will Update" row every time we enter the
  // preview stage — the admin can then un-check the ones they want to skip.
  useEffect(() => {
    if (stage !== "preview") return;
    setPreviewSelectedIds(new Set(willUpdate.map((r) => r.user.id)));
    // Intentional: only reseed on entering the stage, not on every selection change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);

  // ── Save (apply updates) ──────────────────────────────────────────────────
  const handleConfirm = async () => {
    if (!previewRows.length) { toast.error("No users to update"); return; }
    const token = getToken();
    if (!token) { toast.error("Not authenticated"); return; }
    const toUpdate = previewRows.filter((r) => previewSelectedIds.has(r.user.id) && !r.alreadyMapped);
    if (!toUpdate.length) { toast.error("Select at least one user to update"); return; }

    setBusy(true); setResults(null); setProgress(0);
    const out: RowResult[] = [];

    // Non-selected "Will Update" rows still count as "skipped by admin" — we
    // don't surface them separately; only submitted rows are reported. But
    // Already-Mapped rows are always reported so the admin sees the count.
    for (let i = 0; i < toUpdate.length; i++) {
      const row = toUpdate[i];
      const u = row.user;
      const patch: any = {};
      // Full replay of the mutable fields so the server sees a complete update:
      // firstName/lastName/email/phone/gender/status are echoed unchanged, then
      // any target field overrides the current value.
      patch.firstName = u.firstName;
      patch.lastName = u.lastName;
      patch.email = u.email;
      patch.phone = u.phone;
      patch.gender = u.gender;
      patch.status = u.status;
      // Role — either the target or the current one, so nothing is nulled.
      patch.role = row.changed.role ? targetRoleId : u.roleId;

      // Client + service transfer — the trickiest part. When the client
      // changes, the hierarchy fields (degree/department/section/semester/
      // phase) that used to point at the old client's mapping become
      // meaningless, so they're cleared — mirrors the reset the single-user
      // Edit dropdown already does when its client picker changes.
      if (row.changed.client) {
        patch.clientId = targetClient?._id || "";
        patch.clientName = targetClient?.clientCompany || "";
        patch.degree = "";
        patch.department = "";
        patch.section = "";
        patch.semester = "";
        patch.phase = "";
        // Auto-derive studentType from the new client's type — same rule the
        // Add User modal uses when its client dropdown changes.
        const derivedType: "degree-program" | "skilling" | undefined =
          targetClient?.type?.includes("college") ? "degree-program"
            : targetClient?.type?.includes("company") ? "skilling" : undefined;
        if (derivedType) patch.studentType = derivedType;
      }

      // Service — if targeted, apply. If we changed client but not service,
      // clear the old service too (it belonged to the old client's mapping).
      if (row.changed.service) {
        patch.serviceModel = targetService;
        if (targetMapping?._id) patch.serviceMappingId = targetMapping._id;
      } else if (row.changed.client) {
        patch.serviceModel = "";
        patch.serviceMappingId = "";
      }

      try {
        await updateUser(u.id, patch, token);
        out.push({ userId: u.id, email: u.email, status: "updated" });
      } catch (err: any) {
        const msg = getApiErrorMessage(err, "Failed");
        out.push({ userId: u.id, email: u.email, status: "error", reason: msg });
      }
      setProgress(Math.round(((i + 1) / toUpdate.length) * 100));
    }

    // Report Already-Mapped rows too so the admin sees the dedup count.
    alreadyMappedRows.forEach((r) => {
      out.push({ userId: r.user.id, email: r.user.email, status: "already_mapped", reason: "Already mapped" });
    });

    setResults(out);
    setStage("results");
    const updated = out.filter((r) => r.status === "updated").length;
    if (updated) { toast.success(`${updated} user${updated !== 1 ? "s" : ""} updated`); onComplete(); }
    else toast.error("No users were updated");
    setBusy(false);
  };

  // ── Reusable dropdown (same shape as BulkUserModal's local Dropdown) ─────
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
          <div className="absolute z-dropdown mt-1.5 w-full max-h-60 overflow-y-auto rounded-tile border border-hairline bg-surface shadow-lg p-1">
            {children}
          </div>
        )}
      </div>
    </div>
  );

  const stepPill = (idx: number, label: string, active: boolean, done: boolean) => (
    <div className={`flex items-center gap-2 ${active ? "text-heading" : done ? "text-success-700" : "text-faint"}`}>
      <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-2xs font-semibold ${
        active ? "bg-brand-strong text-white"
        : done ? "bg-success-500 text-white"
        : "bg-ink-100 text-subtle"
      }`}>
        {done ? <CheckCircle className="h-3 w-3" /> : idx}
      </span>
      <span className="text-xs font-medium">{label}</span>
    </div>
  );

  // ── Render — one panel per stage inside the fixed shell ───────────────────
  return (
    <Dialog open={isOpen} onOpenChange={(o) => { if (!o && !busy) onClose(); }}>
      <DialogContent
        className="w-[calc(100vw-32px)] sm:max-w-[1200px] h-[90vh] flex flex-col gap-0 p-0 overflow-hidden rounded-2xl shadow-2xl bg-surface"
        showCloseButton={false}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader className="px-5 pt-4 pb-2.5">
          <DialogTitle className="text-base font-semibold text-heading text-left flex items-center gap-2">
            <span className="w-7 h-7 rounded-tile bg-brand-wash flex items-center justify-center">
              <UserCog className="h-3.5 w-3.5 text-brand-strong" />
            </span>
            Bulk Edit Users
          </DialogTitle>
          <DialogDescription className="sr-only">
            Pick users from the roster, choose a target Role / Client / Service, then preview and confirm the update.
          </DialogDescription>
          <DialogClose
            aria-label="Close"
            className="absolute top-3.5 right-4 inline-flex h-8 w-8 items-center justify-center rounded-full border border-hairline-strong bg-surface text-subtle transition-colors hover:bg-row-hover hover:text-heading focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/30 disabled:pointer-events-none"
          >
            <X className="h-3.5 w-3.5" />
          </DialogClose>
          {/* Step tracker */}
          <div className="mt-2 flex items-center gap-3">
            {stepPill(1, "Pick users", stage === "pick", stage !== "pick")}
            <ArrowRight className="h-3 w-3 text-faint" />
            {stepPill(2, "Choose target", stage === "target", stage === "preview" || stage === "results")}
            <ArrowRight className="h-3 w-3 text-faint" />
            {stepPill(3, "Preview & confirm", stage === "preview" || stage === "results", stage === "results")}
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* ── Stage 1 · Pick users ─────────────────────────────────────── */}
          {stage === "pick" && (
            <div className="space-y-3">
              {/* Toolbar: search + role filter + client filter */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <Label className="mb-1.5 block text-sm font-medium text-body">Search</Label>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-faint pointer-events-none" />
                    <input
                      type="text"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Name, email, role, client, service…"
                      className="h-10 w-full pl-8 pr-8 rounded-control border border-hairline-strong bg-surface text-sm text-body placeholder:text-faint focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15"
                    />
                    {search && (
                      <button
                        type="button"
                        aria-label="Clear search"
                        onClick={() => setSearch("")}
                        className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex size-5 items-center justify-center rounded-chip text-faint hover:bg-ink-100 hover:text-heading"
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>
                </div>
                <Dropdown
                  label="Filter by role"
                  icon={<ShieldCheck size={14} className="text-subtle" />}
                  value={roles.find((r) => r._id === filterRoleId)?.renameRole}
                  placeholder="Any role"
                  open={filterRoleOpen}
                  setOpen={setFilterRoleOpen}
                >
                  <button type="button" onClick={() => { setFilterRoleId(""); setFilterRoleOpen(false); }}
                    className={`w-full text-left rounded-chip px-2.5 py-2 text-sm ${!filterRoleId ? "bg-brand-wash text-heading" : "text-body hover:bg-row-hover"}`}>
                    <span className="text-faint">Any role</span>
                  </button>
                  {roles.map((r) => (
                    <button key={r._id} type="button"
                      onClick={() => { setFilterRoleId(r._id); setFilterRoleOpen(false); }}
                      className={`w-full text-left rounded-chip px-2.5 py-2 text-sm ${filterRoleId === r._id ? "bg-brand-wash text-heading" : "text-body hover:bg-row-hover"}`}>
                      {r.renameRole}
                    </button>
                  ))}
                </Dropdown>
                <Dropdown
                  label="Filter by client"
                  icon={<Building2 size={14} className="text-subtle" />}
                  value={filterClientName}
                  placeholder="Any client"
                  open={filterClientOpen}
                  setOpen={setFilterClientOpen}
                >
                  <button type="button" onClick={() => { setFilterClientName(""); setFilterClientOpen(false); }}
                    className={`w-full text-left rounded-chip px-2.5 py-2 text-sm ${!filterClientName ? "bg-brand-wash text-heading" : "text-body hover:bg-row-hover"}`}>
                    <span className="text-faint">Any client</span>
                  </button>
                  {clientFilterOptions.map((c) => (
                    <button key={c} type="button"
                      onClick={() => { setFilterClientName(c); setFilterClientOpen(false); }}
                      className={`w-full text-left rounded-chip px-2.5 py-2 text-sm ${filterClientName === c ? "bg-brand-wash text-heading" : "text-body hover:bg-row-hover"}`}>
                      {c}
                    </button>
                  ))}
                </Dropdown>
              </div>

              {/* Count strip */}
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs">
                  <span className="inline-flex items-center gap-1 rounded-full border border-hairline bg-surface px-2.5 py-1 text-2xs font-semibold text-heading">
                    <Users className="h-3 w-3" />
                    {selectedUserIds.size} selected
                  </span>
                  <span className="text-2xs text-subtle">of {filteredUsers.length} shown · {existingUsers.length} total</span>
                </div>
                {selectedUserIds.size > 0 && (
                  <button type="button" onClick={() => setSelectedUserIds(new Set())}
                    className="text-2xs font-semibold text-subtle hover:text-heading hover:underline">
                    Clear selection
                  </button>
                )}
              </div>

              {/* Roster table */}
              <div className="border border-hairline rounded-tile overflow-hidden">
                <div className="max-h-[52vh] overflow-auto">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 z-10 bg-surface">
                      <tr className="text-2xs font-semibold uppercase tracking-wider text-subtle border-b border-hairline">
                        <th className="px-3 py-2 w-8 text-left">
                          <input
                            type="checkbox"
                            checked={allFilteredSelected}
                            onChange={toggleAllFiltered}
                            disabled={filteredUsers.length === 0}
                            aria-label="Select all filtered users"
                            className="h-3.5 w-3.5 rounded border-hairline-strong accent-brand-strong disabled:opacity-40"
                          />
                        </th>
                        <th className="px-2 py-2 text-left">User</th>
                        <th className="px-2 py-2 text-left">Email</th>
                        <th className="px-2 py-2 text-left">Current Role</th>
                        <th className="px-2 py-2 text-left">Current Client</th>
                        <th className="px-2 py-2 text-left">Current Service</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-hairline">
                      {filteredUsers.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-3 py-6 text-center text-xs text-subtle">
                            No users match the current filters.
                          </td>
                        </tr>
                      ) : filteredUsers.map((u) => {
                        const checked = selectedUserIds.has(u.id);
                        return (
                          <tr key={u.id} className={`${checked ? "bg-brand-wash/40" : "hover:bg-row-hover"}`}>
                            <td className="px-3 py-2">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleOneUser(u.id)}
                                aria-label={`Select ${u.firstName} ${u.lastName}`}
                                className="h-3.5 w-3.5 rounded border-hairline-strong accent-brand-strong"
                              />
                            </td>
                            <td className="px-2 py-2 font-medium text-body whitespace-nowrap max-w-[180px] truncate">
                              {[u.firstName, u.lastName].filter(Boolean).join(" ") || "—"}
                            </td>
                            <td className="px-2 py-2 text-subtle whitespace-nowrap max-w-[220px] truncate">
                              {u.email || "—"}
                            </td>
                            <td className="px-2 py-2 text-subtle whitespace-nowrap max-w-[140px] truncate">
                              {u.role || "—"}
                            </td>
                            <td className="px-2 py-2 text-subtle whitespace-nowrap max-w-[160px] truncate">
                              {u.clientName || <span className="text-faint">—</span>}
                            </td>
                            <td className="px-2 py-2 text-subtle whitespace-nowrap max-w-[160px] truncate">
                              {u.serviceModel || <span className="text-faint">—</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ── Stage 2 · Choose target ──────────────────────────────────── */}
          {stage === "target" && (
            <div className="space-y-4">
              <div className="rounded-tile border border-brand-500/25 bg-brand-wash px-3 py-2 text-xs text-heading flex items-start gap-2">
                <Info className="h-4 w-4 text-brand-strong flex-shrink-0 mt-0.5" />
                <span>
                  Choose one or more target fields. Any field left blank keeps its current value on
                  every selected user. Users whose current values already match every non-blank target
                  will be marked <span className="font-semibold">Already Mapped</span> and skipped.
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Dropdown
                  label="New Role"
                  icon={<ShieldCheck size={14} className="text-subtle" />}
                  value={roles.find((r) => r._id === targetRoleId)?.renameRole}
                  placeholder="— Leave unchanged —"
                  open={targetRoleOpen}
                  setOpen={setTargetRoleOpen}
                >
                  <button type="button" onClick={() => { setTargetRoleId(""); setTargetRoleOpen(false); }}
                    className={`w-full text-left rounded-chip px-2.5 py-2 text-sm ${!targetRoleId ? "bg-brand-wash text-heading" : "text-body hover:bg-row-hover"}`}>
                    <span className="text-faint">— Leave unchanged —</span>
                  </button>
                  {roles.map((r) => (
                    <button key={r._id} type="button"
                      onClick={() => { setTargetRoleId(r._id); setTargetRoleOpen(false); }}
                      className={`w-full text-left rounded-chip px-2.5 py-2 text-sm ${targetRoleId === r._id ? "bg-brand-wash text-heading" : "text-body hover:bg-row-hover"}`}>
                      {r.renameRole}
                    </button>
                  ))}
                </Dropdown>

                <Dropdown
                  label="New Client"
                  icon={<Building2 size={14} className="text-subtle" />}
                  value={targetClient?.clientCompany}
                  placeholder="— Leave unchanged —"
                  open={targetClientOpen}
                  setOpen={setTargetClientOpen}
                >
                  <button type="button"
                    onClick={() => { setTargetClientId(""); setTargetService(""); setTargetClientOpen(false); }}
                    className={`w-full text-left rounded-chip px-2.5 py-2 text-sm ${!targetClientId ? "bg-brand-wash text-heading" : "text-body hover:bg-row-hover"}`}>
                    <span className="text-faint">— Leave unchanged —</span>
                  </button>
                  {clients.map((c) => (
                    <button key={c._id} type="button"
                      onClick={() => { setTargetClientId(c._id); setTargetService(""); setTargetClientOpen(false); }}
                      className={`w-full text-left rounded-chip px-2.5 py-2 text-sm ${targetClientId === c._id ? "bg-brand-wash text-heading" : "text-body hover:bg-row-hover"}`}>
                      {c.clientCompany}
                    </button>
                  ))}
                </Dropdown>

                <Dropdown
                  label="New Service"
                  icon={<Briefcase size={14} className="text-subtle" />}
                  value={targetService}
                  placeholder={targetClientId ? "— Leave unchanged —" : "Pick client first"}
                  open={targetServiceOpen}
                  setOpen={setTargetServiceOpen}
                  disabled={!targetClientId}
                >
                  <button type="button"
                    onClick={() => { setTargetService(""); setTargetServiceOpen(false); }}
                    className={`w-full text-left rounded-chip px-2.5 py-2 text-sm ${!targetService ? "bg-brand-wash text-heading" : "text-body hover:bg-row-hover"}`}>
                    <span className="text-faint">— Leave unchanged —</span>
                  </button>
                  {targetServiceOptions.length === 0 ? (
                    <p className="px-3 py-2 text-xs text-faint">No services for this client</p>
                  ) : targetServiceOptions.map((s) => (
                    <button key={s} type="button"
                      onClick={() => { setTargetService(s); setTargetServiceOpen(false); }}
                      className={`w-full text-left rounded-chip px-2.5 py-2 text-sm ${targetService === s ? "bg-brand-wash text-heading" : "text-body hover:bg-row-hover"}`}>
                      {s}
                    </button>
                  ))}
                </Dropdown>
              </div>

              {/* Selected-count strip so admin knows what they're about to preview */}
              <div className="rounded-tile border border-hairline bg-canvas px-3 py-2 text-xs text-subtle flex items-center gap-2">
                <Users className="h-3.5 w-3.5" />
                <span><span className="font-semibold text-heading">{selectedUsers.length}</span> user{selectedUsers.length === 1 ? "" : "s"} selected for this bulk edit.</span>
              </div>
            </div>
          )}

          {/* ── Stage 3 · Preview & confirm ──────────────────────────────── */}
          {stage === "preview" && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-full border border-hairline bg-surface px-2.5 py-1 text-2xs font-semibold text-heading">
                  Selected <span className="tabular-nums">{selectedUsers.length}</span>
                </span>
                <span className="inline-flex items-center gap-1 rounded-full border border-success-500/25 bg-success-50 px-2.5 py-1 text-2xs font-semibold text-success-700">
                  Will update <span className="tabular-nums">{willUpdate.length}</span>
                </span>
                <span className="inline-flex items-center gap-1 rounded-full border border-warn-500/25 bg-warn-50 px-2.5 py-1 text-2xs font-semibold text-warn-700">
                  Already mapped <span className="tabular-nums">{alreadyMappedRows.length}</span>
                </span>
              </div>

              <div className="rounded-tile border border-brand-500/25 bg-brand-wash px-3 py-2 text-xs text-heading flex items-start gap-2">
                <Info className="h-4 w-4 text-brand-strong flex-shrink-0 mt-0.5" />
                <span>
                  These users have not been updated yet. Review the changes below and click{" "}
                  <span className="font-semibold">Update {previewSelectedIds.size} User{previewSelectedIds.size === 1 ? "" : "s"}</span>.
                </span>
              </div>

              <div className="border border-hairline rounded-tile overflow-hidden">
                <div className="max-h-[52vh] overflow-auto">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 z-20 bg-surface">
                      <tr className="text-2xs font-semibold uppercase tracking-wider text-subtle border-b border-hairline">
                        <th className="px-3 py-2 w-8 text-left">
                          <input
                            type="checkbox"
                            checked={allWillUpdateSelected}
                            onChange={toggleAllWillUpdate}
                            disabled={willUpdate.length === 0}
                            aria-label="Select all rows that will update"
                            className="h-3.5 w-3.5 rounded border-hairline-strong accent-brand-strong disabled:opacity-40"
                          />
                        </th>
                        <th className="px-2 py-2 text-left">User</th>
                        <th className="px-2 py-2 text-left">Role · Current → New</th>
                        <th className="px-2 py-2 text-left">Client · Current → New</th>
                        <th className="px-2 py-2 text-left">Service · Current → New</th>
                        <th className="px-3 py-2 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-hairline">
                      {(() => {
                        // Render Will-Update first, then Already-Mapped, with
                        // a divider between them.
                        const chunks: { title: string; tone: "success" | "warn"; rows: PreviewRow[] }[] = [
                          { title: "Will Update", tone: "success", rows: willUpdate },
                          { title: "Already Mapped", tone: "warn", rows: alreadyMappedRows },
                        ].filter((c) => c.rows.length > 0);
                        return chunks.map((chunk) => (
                          <Fragment key={chunk.title}>
                            <tr>
                              <td colSpan={6} className={`sticky top-8 z-10 border-l-4 ${chunk.tone === "success" ? "border-l-success-500" : "border-l-warn-500"} bg-canvas px-3 py-2 text-2xs font-semibold uppercase tracking-wider text-subtle`}>
                                {chunk.title} <span className="text-heading tabular-nums">({chunk.rows.length})</span>
                              </td>
                            </tr>
                            {chunk.rows.map((r) => {
                              const canPick = !r.alreadyMapped;
                              const checked = previewSelectedIds.has(r.user.id);
                              return (
                                <tr key={r.user.id} className={`text-xs ${checked && canPick ? "bg-brand-wash/40" : "hover:bg-row-hover"} ${r.alreadyMapped ? "opacity-90" : ""}`}>
                                  <td className="px-3 py-2">
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      disabled={!canPick}
                                      onChange={() => togglePreviewOne(r.user.id)}
                                      aria-label={`Include ${r.user.email} in update`}
                                      className="h-3.5 w-3.5 rounded border-hairline-strong accent-brand-strong disabled:opacity-40"
                                    />
                                  </td>
                                  <td className="px-2 py-2 font-medium text-body whitespace-nowrap max-w-[200px] truncate">
                                    <div className="truncate">{[r.user.firstName, r.user.lastName].filter(Boolean).join(" ") || "—"}</div>
                                    <div className="text-2xs text-subtle truncate">{r.user.email}</div>
                                  </td>
                                  <td className={`px-2 py-2 whitespace-nowrap max-w-[220px] ${r.changed.role ? "text-heading font-medium" : "text-subtle"}`}>
                                    <span className="truncate">{r.user.role || "—"}</span>
                                    <ArrowRight className="inline h-3 w-3 mx-1 text-faint" />
                                    <span className={`truncate ${r.changed.role ? "text-brand-strong" : ""}`}>{r.newRoleLabel}</span>
                                  </td>
                                  <td className={`px-2 py-2 whitespace-nowrap max-w-[220px] ${r.changed.client ? "text-heading font-medium" : "text-subtle"}`}>
                                    <span className="truncate">{r.user.clientName || "—"}</span>
                                    <ArrowRight className="inline h-3 w-3 mx-1 text-faint" />
                                    <span className={`truncate ${r.changed.client ? "text-brand-strong" : ""}`}>{r.newClientLabel}</span>
                                  </td>
                                  <td className={`px-2 py-2 whitespace-nowrap max-w-[220px] ${r.changed.service ? "text-heading font-medium" : "text-subtle"}`}>
                                    <span className="truncate">{r.user.serviceModel || "—"}</span>
                                    <ArrowRight className="inline h-3 w-3 mx-1 text-faint" />
                                    <span className={`truncate ${r.changed.service ? "text-brand-strong" : ""}`}>{r.newServiceLabel}</span>
                                  </td>
                                  <td className="px-3 py-2 text-right whitespace-nowrap">
                                    {r.alreadyMapped ? (
                                      <span className="inline-flex items-center gap-1 rounded-full border border-warn-500/20 bg-warn-50 px-2 py-0.5 text-2xs font-semibold text-warn-700">
                                        <Info className="h-3 w-3" /> Already Mapped
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 rounded-full border border-success-500/20 bg-success-50 px-2 py-0.5 text-2xs font-semibold text-success-700">
                                        <CheckCircle className="h-3 w-3" /> Will Update
                                      </span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </Fragment>
                        ));
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>

              {busy && (
                <div className="space-y-2">
                  <div className="w-full bg-ink-100 rounded-full h-2 overflow-hidden">
                    <div className="h-2 rounded-full bg-brand-strong transition-all" style={{ width: `${progress}%` }} />
                  </div>
                  <p className="text-xs text-center text-subtle flex items-center justify-center gap-1.5">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Updating users… {progress}%
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ── Stage 4 · Results ────────────────────────────────────────── */}
          {stage === "results" && results && (() => {
            const updated = results.filter((r) => r.status === "updated").length;
            const skipped = results.filter((r) => r.status === "already_mapped").length;
            const errored = results.filter((r) => r.status === "error").length;
            return (
              <div className="space-y-3">
                <div className="rounded-tile border border-success-500/25 bg-success-50 px-4 py-3">
                  <p className="text-sm font-semibold text-success-700 flex items-center gap-2">
                    <CheckCircle className="h-4 w-4" /> Bulk Edit Completed
                  </p>
                  <p className="text-xs text-heading mt-1">
                    <span className="font-semibold tabular-nums">{updated}</span> user{updated === 1 ? "" : "s"} updated ·{" "}
                    <span className="font-semibold tabular-nums">{skipped}</span> skipped (already mapped) ·{" "}
                    <span className="font-semibold tabular-nums">{errored}</span> error{errored === 1 ? "" : "s"}
                  </p>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: "Updated", n: updated, cls: "border-success-500/20 bg-success-50 text-success-700" },
                    { label: "Already mapped", n: skipped, cls: "border-warn-500/20 bg-warn-50 text-warn-700" },
                    { label: "Errors", n: errored, cls: "border-danger-500/20 bg-danger-50 text-danger-700" },
                  ].map((s) => (
                    <div key={s.label} className={`rounded-tile border p-2.5 text-center ${s.cls}`}>
                      <p className="text-lg font-bold tabular-nums">{s.n}</p>
                      <p className="text-2xs font-medium">{s.label}</p>
                    </div>
                  ))}
                </div>
                <div className="max-h-64 overflow-y-auto border border-hairline rounded-tile divide-y divide-hairline">
                  {results.map((r, i) => (
                    <div key={i} className="flex items-center gap-2 px-3 py-1.5 text-xs">
                      {r.status === "updated" ? <CheckCircle className="h-3.5 w-3.5 text-success-500 flex-shrink-0" />
                        : <XCircle className={`h-3.5 w-3.5 flex-shrink-0 ${r.status === "already_mapped" ? "text-warn-500" : "text-danger-500"}`} />}
                      <span className="font-medium text-body truncate">{r.email || "—"}</span>
                      {r.reason && <span className="text-faint truncate ml-auto">{r.reason}</span>}
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>

        {/* Footer — actions depend on the stage. */}
        <DialogFooter className="bg-surface px-5 pb-4 pt-2">
          <div className="flex w-full justify-between items-center">
            <Button
              variant="outline"
              onClick={() => {
                if (stage === "target") setStage("pick");
                else if (stage === "preview") setStage("target");
                else onClose();
              }}
              disabled={busy}
              className="h-9 px-4 text-xs font-semibold rounded-control"
            >
              {stage === "pick" || stage === "results" ? (results ? "Done" : "Cancel") : "Back"}
            </Button>

            {stage === "pick" && (
              <Button
                onClick={() => setStage("target")}
                disabled={selectedUserIds.size === 0}
                className="h-9 px-4 text-xs font-semibold rounded-control"
              >
                Next · Choose target →
              </Button>
            )}
            {stage === "target" && (
              <Button
                onClick={() => setStage("preview")}
                disabled={!hasAnyTarget}
                className="h-9 px-4 text-xs font-semibold rounded-control"
              >
                Next · Preview →
              </Button>
            )}
            {stage === "preview" && (
              <Button
                onClick={handleConfirm}
                disabled={busy || previewSelectedIds.size === 0}
                className="h-9 px-4 text-xs font-semibold rounded-control"
              >
                {busy ? (
                  <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Updating…</>
                ) : (
                  <><UserCog className="h-3.5 w-3.5" /> Update {previewSelectedIds.size} User{previewSelectedIds.size === 1 ? "" : "s"}</>
                )}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
