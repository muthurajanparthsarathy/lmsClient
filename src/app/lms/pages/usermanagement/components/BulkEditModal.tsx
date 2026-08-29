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
  UserCog, Info, ArrowLeft, Users, Plus,
} from "lucide-react";
import { toast } from "sonner";
import { bulkAddServiceToUsers } from "@/apiServices/userService";
import { type ServiceMapping } from "@/apiServices/serviceMappingService";
import { useClientsQuery, useServiceMappingsQuery } from "@/queries/referenceData";
import { Role, User } from "./types";

// ─── Local helpers ────────────────────────────────────────────────────────────
interface Client { _id: string; clientCompany: string; status?: string; type?: ("college" | "company")[]; }

interface RowResult {
  userId: string;
  email: string;
  status: "added" | "already_mapped" | "error";
  reason?: string;
}

// One normalized service entry a user already holds: the legacy single fields
// plus every services[] element. "All of a user's services" is this union.
type ServiceEntry = { mappingId: string; serviceModel: string; clientName: string };
const userServices = (u: User): ServiceEntry[] => {
  const out: ServiceEntry[] = [];
  if (u.serviceModel || u.serviceMappingId) {
    out.push({
      mappingId: u.serviceMappingId || "",
      serviceModel: u.serviceModel || "",
      clientName: u.clientName || "",
    });
  }
  (u.services || []).forEach((s) => {
    out.push({
      mappingId: s.serviceMappingId || "",
      serviceModel: s.serviceModel || "",
      clientName: s.clientName || "",
    });
  });
  // Dedup by mappingId when present, else by model+client name.
  const seen = new Set<string>();
  return out.filter((e) => {
    const key = e.mappingId || `${e.serviceModel}::${e.clientName}`;
    if (!key.trim() || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const serviceNames = (u: User): string[] =>
  Array.from(new Set(userServices(u).map((e) => e.serviceModel).filter(Boolean)));

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
  type Stage = "pick" | "target" | "preview" | "results";
  const [stage, setStage] = useState<Stage>("pick");

  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());

  // Pick-user filters
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filterRoleId, setFilterRoleId] = useState<string>("");
  const [filterClientName, setFilterClientName] = useState<string>("");
  const [filterService, setFilterService] = useState<string>("");

  // Destination: client scope (optional pick, defaults to the users' shared
  // client) + the service to ADD (required).
  const [targetClientId, setTargetClientId] = useState<string>("");
  const [targetService, setTargetService] = useState<string>("");

  // Single-open dropdown coordinator — opening any dropdown closes any other.
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const isOpenDd = (id: string) => openDropdown === id;
  const toggleDd = (id: string) => setOpenDropdown((cur) => (cur === id ? null : id));
  const closeDd = () => setOpenDropdown(null);

  // Preview-stage selection — subset of "Will Add" rows.
  const [previewSelectedIds, setPreviewSelectedIds] = useState<Set<string>>(new Set());

  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<RowResult[] | null>(null);

  const { data: clientsData } = useClientsQuery(isOpen);
  const { data: mappingsData } = useServiceMappingsQuery(isOpen);
  const clients = (clientsData ?? []) as Client[];
  const mappings = (mappingsData ?? []) as ServiceMapping[];

  // Reset the whole flow on open/close.
  useEffect(() => {
    if (!isOpen) return;
    setStage("pick");
    setSelectedUserIds(new Set());
    setSearch(""); setDebouncedSearch("");
    setFilterRoleId(""); setFilterClientName(""); setFilterService("");
    setTargetClientId(""); setTargetService("");
    setOpenDropdown(null);
    setPreviewSelectedIds(new Set());
    setBusy(false); setResults(null);
  }, [isOpen]);

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
      // Service filter matches ANY of the user's services (legacy + array).
      if (filterService && !serviceNames(u).includes(filterService)) return false;
      if (q) {
        const hay = [
          u.firstName, u.lastName, u.email, u.role, u.clientName,
          ...serviceNames(u),
        ].map((v) => (v || "").toLowerCase()).join(" ");
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [existingUsers, debouncedSearch, filterRoleId, filterClientName, filterService]);

  const clientFilterOptions = useMemo(() => {
    const s = new Set<string>();
    existingUsers.forEach((u) => { if (u.clientName) s.add(u.clientName); });
    return Array.from(s).sort();
  }, [existingUsers]);
  const serviceFilterOptions = useMemo(() => {
    const s = new Set<string>();
    existingUsers.forEach((u) => {
      if (filterClientName && (u.clientName || "") !== filterClientName) return;
      serviceNames(u).forEach((n) => s.add(n));
    });
    return Array.from(s).sort();
  }, [existingUsers, filterClientName]);

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

  // ── Destination reference data ────────────────────────────────────────────
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

  // A service pick is required; the mapping id must resolve too (the server
  // stores/queries by mapping id, not the display name).
  const hasRequiredTargets = !isBlank(targetService) && !!targetMapping?._id;

  const selectedUsers = useMemo(
    () => existingUsers.filter((u) => selectedUserIds.has(u.id)),
    [existingUsers, selectedUserIds]
  );

  // ── Preview rows: Will Add vs Already Mapped ──────────────────────────────
  type PreviewRow = {
    user: User;
    alreadyMapped: boolean;
    currentServices: string[];
  };

  const previewRows: PreviewRow[] = useMemo(() => {
    const targetMappingId = targetMapping?._id ? String(targetMapping._id) : "";
    const targetClientName = targetClient?.clientCompany || "";
    return selectedUsers.map((u) => {
      const entries = userServices(u);
      const alreadyMapped = entries.some((e) => {
        if (targetMappingId && e.mappingId) return e.mappingId === targetMappingId;
        return (
          !!targetService &&
          e.serviceModel === targetService &&
          (!e.clientName || !targetClientName || e.clientName === targetClientName)
        );
      });
      return { user: u, alreadyMapped, currentServices: serviceNames(u) };
    });
  }, [selectedUsers, targetService, targetMapping, targetClient]);

  const willAdd = previewRows.filter((r) => !r.alreadyMapped);
  const alreadyMappedRows = previewRows.filter((r) => r.alreadyMapped);

  const allWillAddSelected =
    willAdd.length > 0 && willAdd.every((r) => previewSelectedIds.has(r.user.id));
  const toggleAllWillAdd = () => {
    setPreviewSelectedIds((prev) => {
      const next = new Set(prev);
      if (allWillAddSelected) willAdd.forEach((r) => next.delete(r.user.id));
      else willAdd.forEach((r) => next.add(r.user.id));
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

  useEffect(() => {
    if (stage !== "preview") return;
    setPreviewSelectedIds(new Set(willAdd.map((r) => r.user.id)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);

  // On first entry to the destination stage, if every selected user shares one
  // client, pre-fill the client scope with it (by id, else by name).
  useEffect(() => {
    if (stage !== "target") return;
    if (targetClientId) return;
    const ids = new Set(selectedUsers.map((u) => u.clientId).filter(Boolean));
    if (ids.size === 1) {
      setTargetClientId([...ids][0] as string);
      return;
    }
    const names = new Set(selectedUsers.map((u) => u.clientName).filter(Boolean));
    if (names.size === 1 && clients.length > 0) {
      const name = [...names][0] as string;
      const c = clients.find((cl) => cl.clientCompany === name);
      if (c) setTargetClientId(c._id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, clients]);

  // ── Apply: ONE bulk request adds the service to every selected row ───────
  const handleConfirm = async () => {
    const token = getToken();
    if (!token) { toast.error("Not authenticated"); return; }
    if (!targetMapping?._id || !targetClient) { toast.error("Pick a client and service first"); return; }
    const ids = willAdd.filter((r) => previewSelectedIds.has(r.user.id)).map((r) => r.user.id);
    if (!ids.length) { toast.error("Select at least one user"); return; }

    setBusy(true); setResults(null);
    try {
      const resp = await bulkAddServiceToUsers(
        ids,
        {
          serviceMappingId: String(targetMapping._id),
          serviceModel: targetService,
          clientId: targetClient._id,
          clientName: targetClient.clientCompany,
        },
        token
      );
      const byId = new Map(selectedUsers.map((u) => [u.id, u]));
      const out: RowResult[] = (resp.results || []).map((r) => ({
        userId: r.userId,
        email: r.email || byId.get(r.userId)?.email || "",
        status: r.status,
        reason: r.reason,
      }));
      // Rows the admin left out or that were Already Mapped client-side are
      // reported too, so the summary accounts for every previewed row.
      alreadyMappedRows.forEach((r) => {
        out.push({ userId: r.user.id, email: r.user.email, status: "already_mapped", reason: "Already had this service" });
      });

      setResults(out);
      setStage("results");
      const added = out.filter((r) => r.status === "added").length;
      if (added) { toast.success(`Service added to ${added} user${added !== 1 ? "s" : ""}`); onComplete(); }
      else toast.error("No users were updated");
    } catch (err: any) {
      toast.error(getApiErrorMessage(err, "Failed to add service"));
    } finally {
      setBusy(false);
    }
  };

  // ── Reusable dropdown that respects the shared open coordinator ──────────
  const Dropdown = ({
    id, label, icon, value, placeholder, disabled, children,
  }: {
    id: string;
    label: React.ReactNode;
    icon: React.ReactNode;
    value?: string;
    placeholder: string;
    disabled?: boolean;
    children: React.ReactNode;
  }) => {
    const open = isOpenDd(id);
    return (
      <div>
        <Label className="mb-1.5 block text-sm font-medium text-body">{label}</Label>
        <div className="relative">
          <button
            type="button"
            disabled={disabled}
            onClick={() => toggleDd(id)}
            className="h-10 w-full flex items-center justify-between gap-2 rounded-control border border-hairline-strong bg-surface px-3 text-sm transition-colors hover:border-line-hover focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15 disabled:cursor-not-allowed disabled:bg-ink-50 disabled:text-subtle"
          >
            <span className="flex items-center gap-2 min-w-0">
              {icon}
              <span className={`truncate ${value ? "text-body" : "text-faint"}`}>{value || placeholder}</span>
            </span>
            <ChevronDown size={15} className={`text-faint transition-transform ${open ? "rotate-180" : ""}`} />
          </button>
          {open && (
            <>
              <div className="fixed inset-0 z-dropdown" onClick={closeDd} aria-hidden />
              <div className="absolute z-dropdown mt-1.5 w-full max-h-60 overflow-y-auto rounded-tile border border-hairline bg-surface shadow-lg p-1">
                {children}
              </div>
            </>
          )}
        </div>
      </div>
    );
  };

  const stageTitle = {
    pick: "Reassign Client / Service — Select users",
    target: "Reassign Client / Service — Choose service to add",
    preview: "Reassign Client / Service — Review changes",
    results: "Reassign Client / Service — Completed",
  }[stage];

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <Dialog open={isOpen} onOpenChange={(o) => { if (!o && !busy) onClose(); }}>
      <DialogContent
        className="!max-w-none flex flex-col gap-0 p-0 overflow-hidden rounded-2xl shadow-2xl bg-surface"
        style={{ width: "95vw", height: "95vh" }}
        showCloseButton={false}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader className="px-6 pt-4 pb-3 border-b border-hairline">
          <div className="flex items-center justify-between gap-3">
            <DialogTitle className="text-base font-semibold text-heading text-left flex items-center gap-2">
              <span className="w-7 h-7 rounded-tile bg-brand-wash flex items-center justify-center">
                <UserCog className="h-3.5 w-3.5 text-brand-strong" />
              </span>
              {stageTitle}
            </DialogTitle>
            <DialogClose
              aria-label="Close"
              className="inline-flex items-center justify-center h-8 w-8 rounded-full border border-danger-500 bg-danger-500 text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-danger-500/40"
            >
              <X className="h-3.5 w-3.5" />
            </DialogClose>
          </div>
          <DialogDescription className="sr-only">
            Pick users from the roster, choose a service to add, then preview and confirm. Users keep every service they already have.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-hidden px-6 py-5 flex flex-col">
          {/* ── Stage 1 · Select users ──────────────────────────────────── */}
          {stage === "pick" && (
            <div className="flex-1 min-h-0 flex flex-col gap-3">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <Label className="mb-1.5 block text-sm font-medium text-body">Search</Label>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-faint pointer-events-none" />
                    <input
                      type="text"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      onFocus={closeDd}
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
                  id="filterRole"
                  label="Filter by role"
                  icon={<ShieldCheck size={14} className="text-subtle" />}
                  value={roles.find((r) => r._id === filterRoleId)?.renameRole}
                  placeholder="Any role"
                >
                  <button type="button" onClick={() => { setFilterRoleId(""); closeDd(); }}
                    className={`w-full text-left rounded-chip px-2.5 py-2 text-sm ${!filterRoleId ? "bg-brand-wash text-heading" : "text-body hover:bg-row-hover"}`}>
                    <span className="text-faint">Any role</span>
                  </button>
                  {roles.map((r) => (
                    <button key={r._id} type="button"
                      onClick={() => { setFilterRoleId(r._id); closeDd(); }}
                      className={`w-full text-left rounded-chip px-2.5 py-2 text-sm ${filterRoleId === r._id ? "bg-brand-wash text-heading" : "text-body hover:bg-row-hover"}`}>
                      {r.renameRole}
                    </button>
                  ))}
                </Dropdown>
                <Dropdown
                  id="filterClient"
                  label="Filter by client"
                  icon={<Building2 size={14} className="text-subtle" />}
                  value={filterClientName}
                  placeholder="Any client"
                >
                  <button type="button" onClick={() => { setFilterClientName(""); setFilterService(""); closeDd(); }}
                    className={`w-full text-left rounded-chip px-2.5 py-2 text-sm ${!filterClientName ? "bg-brand-wash text-heading" : "text-body hover:bg-row-hover"}`}>
                    <span className="text-faint">Any client</span>
                  </button>
                  {clientFilterOptions.map((c) => (
                    <button key={c} type="button"
                      onClick={() => { setFilterClientName(c); setFilterService(""); closeDd(); }}
                      className={`w-full text-left rounded-chip px-2.5 py-2 text-sm ${filterClientName === c ? "bg-brand-wash text-heading" : "text-body hover:bg-row-hover"}`}>
                      {c}
                    </button>
                  ))}
                </Dropdown>
                <Dropdown
                  id="filterService"
                  label="Filter by service"
                  icon={<Briefcase size={14} className="text-subtle" />}
                  value={filterService}
                  placeholder="Any service"
                >
                  <button type="button" onClick={() => { setFilterService(""); closeDd(); }}
                    className={`w-full text-left rounded-chip px-2.5 py-2 text-sm ${!filterService ? "bg-brand-wash text-heading" : "text-body hover:bg-row-hover"}`}>
                    <span className="text-faint">Any service</span>
                  </button>
                  {serviceFilterOptions.length === 0 ? (
                    <p className="px-3 py-2 text-xs text-faint">No services on the shown users</p>
                  ) : serviceFilterOptions.map((s) => (
                    <button key={s} type="button"
                      onClick={() => { setFilterService(s); closeDd(); }}
                      className={`w-full text-left rounded-chip px-2.5 py-2 text-sm ${filterService === s ? "bg-brand-wash text-heading" : "text-body hover:bg-row-hover"}`}>
                      {s}
                    </button>
                  ))}
                </Dropdown>
              </div>

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

              <div className="flex-1 min-h-0 border border-hairline rounded-tile overflow-hidden">
                <div className="h-full overflow-auto">
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
                        <th className="px-2 py-2 text-left">Role</th>
                        <th className="px-2 py-2 text-left">Client</th>
                        <th className="px-2 py-2 text-left">Current Services</th>
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
                        const svcNames = serviceNames(u);
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
                            <td className="px-2 py-2 text-subtle max-w-[240px]">
                              {svcNames.length ? (
                                <span className="flex flex-wrap gap-1">
                                  {svcNames.map((n) => (
                                    <span key={n} className="inline-flex items-center rounded-full border border-hairline bg-canvas px-1.5 py-0.5 text-2xs">
                                      {n}
                                    </span>
                                  ))}
                                </span>
                              ) : (
                                <span className="text-faint">—</span>
                              )}
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

          {/* ── Stage 2 · Choose service to add ─────────────────────────── */}
          {stage === "target" && (
            <div className="flex-1 min-h-0 overflow-y-auto space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Dropdown
                  id="targetClient"
                  label={<>Client <span className="text-2xs font-normal text-faint">(defaults to the users&apos; client)</span></>}
                  icon={<Building2 size={14} className="text-subtle" />}
                  value={targetClient?.clientCompany}
                  placeholder="Select client"
                >
                  {clients.map((c) => (
                    <button key={c._id} type="button"
                      onClick={() => { setTargetClientId(c._id); setTargetService(""); closeDd(); }}
                      className={`w-full text-left rounded-chip px-2.5 py-2 text-sm ${targetClientId === c._id ? "bg-brand-wash text-heading" : "text-body hover:bg-row-hover"}`}>
                      {c.clientCompany}
                    </button>
                  ))}
                </Dropdown>

                <Dropdown
                  id="targetService"
                  label={<>Service to Add <span className="text-danger-500">*</span></>}
                  icon={<Briefcase size={14} className="text-subtle" />}
                  value={targetService}
                  placeholder={targetClientId ? "Select a service" : "Pick client first"}
                  disabled={!targetClientId}
                >
                  {targetServiceOptions.length === 0 ? (
                    <p className="px-3 py-2 text-xs text-faint">No services for this client</p>
                  ) : targetServiceOptions.map((s) => (
                    <button key={s} type="button"
                      onClick={() => { setTargetService(s); closeDd(); }}
                      className={`w-full text-left rounded-chip px-2.5 py-2 text-sm ${targetService === s ? "bg-brand-wash text-heading" : "text-body hover:bg-row-hover"}`}>
                      {s}
                    </button>
                  ))}
                </Dropdown>
              </div>

              {/* What will happen — one plain sentence, no jargon. */}
              {targetService && (
                <div className="rounded-tile border border-success-500/25 bg-success-50 px-3 py-2 text-xs text-success-700 flex items-start gap-2">
                  <Plus className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  <span>
                    <span className="font-semibold">{targetService}</span> will be ADDED to the selected users.
                    They keep every service they already have — nothing is removed or replaced.
                  </span>
                </div>
              )}
            </div>
          )}

          {/* ── Stage 3 · Review changes ─────────────────────────────────── */}
          {stage === "preview" && (
            <div className="flex-1 min-h-0 flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-full border border-hairline bg-surface px-2.5 py-1 text-2xs font-semibold text-heading">
                  Selected <span className="tabular-nums">{selectedUsers.length}</span>
                </span>
                <span className="inline-flex items-center gap-1 rounded-full border border-success-500/25 bg-success-50 px-2.5 py-1 text-2xs font-semibold text-success-700">
                  Yet to add <span className="tabular-nums">{willAdd.length}</span>
                </span>
                <span className="inline-flex items-center gap-1 rounded-full border border-warn-500/25 bg-warn-50 px-2.5 py-1 text-2xs font-semibold text-warn-700">
                  Existing users <span className="tabular-nums">{alreadyMappedRows.length}</span>
                </span>
                <span className="text-2xs text-subtle ml-1">Existing services stay untouched.</span>
              </div>

              <div className="flex-1 min-h-0 border border-hairline rounded-tile overflow-hidden">
                <div className="h-full overflow-auto">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 z-20 bg-surface">
                      <tr className="text-2xs font-semibold uppercase tracking-wider text-subtle border-b border-hairline">
                        <th className="px-3 py-2 w-8 text-left">
                          <input
                            type="checkbox"
                            checked={allWillAddSelected}
                            onChange={toggleAllWillAdd}
                            disabled={willAdd.length === 0}
                            aria-label="Select all rows"
                            className="h-3.5 w-3.5 rounded border-hairline-strong accent-brand-strong disabled:opacity-40"
                          />
                        </th>
                        <th className="px-2 py-2 text-left">User</th>
                        <th className="px-2 py-2 text-left">Current Services</th>
                        <th className="px-2 py-2 text-left">Service to Add</th>
                        <th className="px-3 py-2 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-hairline">
                      {(() => {
                        const chunks = ([
                          { title: "Yet to Add", tone: "success", rows: willAdd },
                          { title: "Existing Users", tone: "warn", rows: alreadyMappedRows },
                        ] as { title: string; tone: "success" | "warn"; rows: PreviewRow[] }[]).filter((c) => c.rows.length > 0);
                        return chunks.map((chunk) => (
                          <Fragment key={chunk.title}>
                            <tr>
                              <td colSpan={5} className={`sticky top-8 z-10 border-l-4 ${chunk.tone === "success" ? "border-l-success-500" : "border-l-warn-500"} bg-canvas px-3 py-2 text-2xs font-semibold uppercase tracking-wider text-subtle`}>
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
                                      aria-label={`Include ${r.user.email}`}
                                      className="h-3.5 w-3.5 rounded border-hairline-strong accent-brand-strong disabled:opacity-40"
                                    />
                                  </td>
                                  <td className="px-2 py-2 font-medium text-body whitespace-nowrap max-w-[220px] truncate">
                                    <div className="truncate">{[r.user.firstName, r.user.lastName].filter(Boolean).join(" ") || "—"}</div>
                                    <div className="text-2xs text-subtle truncate">{r.user.email}</div>
                                  </td>
                                  <td className="px-2 py-2 text-subtle max-w-[280px]">
                                    {r.currentServices.length ? (
                                      <span className="flex flex-wrap gap-1">
                                        {r.currentServices.map((n) => (
                                          <span key={n} className="inline-flex items-center rounded-full border border-hairline bg-canvas px-1.5 py-0.5 text-2xs">
                                            {n}
                                          </span>
                                        ))}
                                      </span>
                                    ) : (
                                      <span className="text-faint">No services yet</span>
                                    )}
                                  </td>
                                  <td className="px-2 py-2 whitespace-nowrap max-w-[200px] truncate">
                                    <span className="inline-flex items-center gap-1 rounded-full border border-brand/30 bg-brand-wash px-1.5 py-0.5 text-2xs font-semibold text-brand-strong">
                                      <Plus className="h-3 w-3" /> {targetService}
                                    </span>
                                  </td>
                                  <td className="px-3 py-2 text-right whitespace-nowrap">
                                    {r.alreadyMapped ? (
                                      <span className="inline-flex items-center gap-1 rounded-full border border-warn-500/20 bg-warn-50 px-2 py-0.5 text-2xs font-semibold text-warn-700">
                                        <Info className="h-3 w-3" /> Existing user
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 rounded-full border border-success-500/20 bg-success-50 px-2 py-0.5 text-2xs font-semibold text-success-700">
                                        <CheckCircle className="h-3 w-3" /> Yet to add
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
                <p className="text-xs text-center text-subtle flex items-center justify-center gap-1.5">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Adding service…
                </p>
              )}
            </div>
          )}

          {/* ── Stage 4 · Results ────────────────────────────────────────── */}
          {/* Results stage scrolls as a whole — it's a summary, not a work list. */}
          {stage === "results" && results && (() => {
            const added = results.filter((r) => r.status === "added").length;
            const skipped = results.filter((r) => r.status === "already_mapped").length;
            const errored = results.filter((r) => r.status === "error").length;
            return (
              <div className="flex-1 min-h-0 overflow-y-auto space-y-3">
                <div className="rounded-tile border border-success-500/25 bg-success-50 px-4 py-3">
                  <p className="text-sm font-semibold text-success-700 flex items-center gap-2">
                    <CheckCircle className="h-4 w-4" /> Service Added
                  </p>
                  <p className="text-xs text-heading mt-1">
                    <span className="font-semibold tabular-nums">{added}</span> user{added === 1 ? "" : "s"} got{" "}
                    <span className="font-semibold">{targetService}</span> ·{" "}
                    <span className="font-semibold tabular-nums">{skipped}</span> already had it ·{" "}
                    <span className="font-semibold tabular-nums">{errored}</span> error{errored === 1 ? "" : "s"}
                  </p>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: "Added", n: added, cls: "border-success-500/20 bg-success-50 text-success-700" },
                    { label: "Already had it", n: skipped, cls: "border-warn-500/20 bg-warn-50 text-warn-700" },
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
                      {r.status === "added" ? <CheckCircle className="h-3.5 w-3.5 text-success-500 flex-shrink-0" />
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

        <DialogFooter className="bg-surface px-6 pb-4 pt-3 border-t border-hairline">
          <div className="flex w-full justify-between items-center gap-3">
            <div>
              {(stage === "target" || stage === "preview") && (
                <Button
                  type="button"
                  onClick={() => {
                    closeDd();
                    if (stage === "target") setStage("pick");
                    else if (stage === "preview") setStage("target");
                  }}
                  disabled={busy}
                  className="h-9 px-4 text-xs font-semibold rounded-control inline-flex items-center gap-1.5 bg-brand-wash text-brand-strong hover:bg-brand-wash/80 border border-brand/40 shadow-none disabled:opacity-50"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Back
                </Button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => onClose()}
                disabled={busy}
                className="h-9 px-4 text-xs font-semibold rounded-control"
              >
                {stage === "results" ? "Done" : "Cancel"}
              </Button>
              {stage === "pick" && (
                <Button
                  onClick={() => { closeDd(); setStage("target"); }}
                  disabled={selectedUserIds.size === 0}
                  className="h-9 px-4 text-xs font-semibold rounded-control"
                >
                  Continue
                </Button>
              )}
              {stage === "target" && (
                <Button
                  onClick={() => { closeDd(); setStage("preview"); }}
                  disabled={!hasRequiredTargets}
                  className="h-9 px-4 text-xs font-semibold rounded-control"
                >
                  Review Changes
                </Button>
              )}
              {stage === "preview" && (
                // Wrapping span carries the tooltip — a disabled button
                // swallows pointer events in some browsers, so the hover
                // hint must live on the wrapper to always show.
                <span
                  title={
                    willAdd.length === 0
                      ? "All selected users already have this service — go back and choose a different service."
                      : previewSelectedIds.size === 0
                        ? "Tick at least one user in the list above."
                        : `Adds ${targetService} to the ${previewSelectedIds.size} ticked user${previewSelectedIds.size === 1 ? "" : "s"}.`
                  }
                >
                  <Button
                    onClick={handleConfirm}
                    disabled={busy || previewSelectedIds.size === 0}
                    className="h-9 px-4 text-xs font-semibold rounded-control"
                  >
                    {busy ? (
                      <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Adding…</>
                    ) : (
                      <><Plus className="h-3.5 w-3.5" /> Add Service to {previewSelectedIds.size} User{previewSelectedIds.size === 1 ? "" : "s"}</>
                    )}
                  </Button>
                </span>
              )}
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
