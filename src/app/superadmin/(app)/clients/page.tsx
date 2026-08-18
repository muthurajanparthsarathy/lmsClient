'use client';
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Users as UsersIcon, MoreHorizontal, ShieldCheck, HardDrive, Eye, Landmark, BookOpen, KeyRound,
  Plus, Trash2, Ban, CheckCircle2, Loader2, Filter,
} from 'lucide-react';
import {
  getAllInstitutions, Institution, InstitutionInput,
  createInstitution, deleteInstitution, updateInstitutionStatus,
  getInstitutionPermissions, updateInstitutionPermissions, InstitutionPermission,
} from '@/apiServices/superadmin/institutionService';
import { toApiError } from '@/lib/superAdminApiClient';
import { PermissionModal } from '@/app/lms/component/PermissionModal';
import { cn } from '@/lib/utils';
import { showSuccessToast, showErrorToast } from '@/components/ui/toastUtils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Panel, EmptyState, StatusBadge, SearchInput, FieldSelect, MetricCard, Toolbar, RefreshButton,
  useSort, SortLabel, useConfirm, tableHeadClass, tableCellClass, tableRowClass, RowActions, RowIdentity,
  usePagination, PaginationBar,
} from '../../_components/ui';

const DEFAULT_BASED_ON = 'General';
const emptyForm: InstitutionInput = { inst_name: '', inst_owner: '', phone: '', address: '', basedOn: DEFAULT_BASED_ON };

// Page-scoped table type — roomier than the console-wide 13px/11px defaults
// (tailwind-merge keeps the later size).
const cellCls = cn(tableCellClass, 'py-2 text-[14.5px]');
const headCls = cn(tableHeadClass, 'text-xs');

// Metric numbers at 23px — a touch lighter than the shared card's 26px.
const metricValue = (v: React.ReactNode) => <span className="text-[23px] leading-tight">{v}</span>;

// The single Clients page — Add Client lives in the header (absorbed from the
// retired /superadmin/institutions page), and each row's 3-dot menu holds both
// lifecycle actions (activate / deactivate / delete) and the per-client
// drill-ins (Roles / Permissions / Users / Resources).
export default function ClientsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<InstitutionInput>(emptyForm);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [ownerFilter, setOwnerFilter] = useState('');
  const [pageSize, setPageSize] = useState(5);
  const [details, setDetails] = useState<Institution | null>(null);
  const [permInst, setPermInst] = useState<Institution | null>(null);
  const { confirm, ConfirmHost } = useConfirm();

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['superadmin', 'institutions'],
    queryFn: getAllInstitutions,
  });
  const institutions = data?.institutions || [];

  const owners = Array.from(new Set(institutions.map((i) => i.inst_owner).filter(Boolean))).sort();
  const totalUsers = institutions.reduce((s, i) => s + (i.userCount || 0), 0);
  const totalCourses = institutions.reduce((s, i) => s + (i.courseCount || 0), 0);
  const activeCount = institutions.filter((i) => i.status === 'active').length;

  const filtered = institutions.filter((inst) => {
    const q = search.toLowerCase();
    const matchesSearch =
      inst.inst_name.toLowerCase().includes(q) ||
      inst.inst_owner.toLowerCase().includes(q) ||
      inst.inst_id.toLowerCase().includes(q);
    const matchesStatus = !statusFilter || inst.status === statusFilter;
    const matchesOwner = !ownerFilter || inst.inst_owner === ownerFilter;
    return matchesSearch && matchesStatus && matchesOwner;
  });

  const { sorted, sortKey, sortDir, toggleSort } = useSort(filtered, {
    name: (i) => i.inst_name,
    owner: (i) => i.inst_owner,
    phone: (i) => i.phone,
    users: (i) => i.userCount,
    courses: (i) => i.courseCount,
    status: (i) => i.status,
  });
  const { pageItems, page, setPage, totalPages, rangeStart, rangeEnd, total } = usePagination(sorted, pageSize);

  const openClientPage = (pageName: 'roles' | 'users' | 'resources', inst: { _id: string; inst_name: string }) =>
    router.push(`/superadmin/${pageName}?institution=${inst._id}&name=${encodeURIComponent(inst.inst_name)}`);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['superadmin', 'institutions'] });

  const createMutation = useMutation({
    mutationFn: () => createInstitution(form),
    onSuccess: () => { showSuccessToast('Client created'); setOpen(false); setForm(emptyForm); invalidate(); },
    onError: (err) => showErrorToast(toApiError(err).message),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteInstitution(id),
    onSuccess: () => { showSuccessToast('Client deleted'); invalidate(); },
    onError: (err) => showErrorToast(toApiError(err).message),
  });
  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'active' | 'suspended' }) => updateInstitutionStatus(id, status),
    onSuccess: () => { showSuccessToast('Status updated'); invalidate(); },
    onError: (err) => showErrorToast(toApiError(err).message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.inst_name || !form.inst_owner || !form.phone || !form.address) {
      showErrorToast('Name, owner, phone and address are required');
      return;
    }
    createMutation.mutate();
  };

  const filtersActive = !!(search || statusFilter || ownerFilter);
  const resetFilters = () => { setSearch(''); setStatusFilter(''); setOwnerFilter(''); setPage(1); };

  return (
    // Fills main's content area; only the table wrapper inside the Panel
    // scrolls. The shared panel heading is gone — the page owns its ONE
    // heading row below (title left, Add action right).
    <div className="flex h-full min-h-0 flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-[17px] font-bold tracking-[-0.02em] text-[#111827]">Clients</h1>
        <Button onClick={() => { setForm(emptyForm); setOpen(true); }}>
          <Plus className="h-4 w-4" /> Add Client
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[88px] rounded-xl" />)
        ) : (
          <>
            <MetricCard icon={Landmark} label="Total Clients" value={metricValue(institutions.length)} iconClass="bg-primary/10 text-primary" />
            <MetricCard icon={UsersIcon} label="Total Users" value={metricValue(totalUsers)} iconClass="bg-chart-2/10 text-chart-2" />
            <MetricCard icon={BookOpen} label="Total Courses" value={metricValue(totalCourses)} iconClass="bg-[var(--success-bg)] text-[var(--success-fg)]" />
            <MetricCard icon={ShieldCheck} label="Active Clients" value={metricValue(activeCount)} iconClass="bg-chart-4/15 text-chart-4" />
          </>
        )}
      </div>

      <Panel className="flex min-h-0 flex-1 flex-col">
        <Toolbar className="shrink-0">
          <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search clients..." className="w-full sm:max-w-xs" />
          <div className="flex flex-wrap items-center gap-2">
            <FieldSelect value={statusFilter} onChange={(v) => { setStatusFilter(v); setPage(1); }} className="w-36">
              <option value="">All Status</option>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
            </FieldSelect>
            <FieldSelect value={ownerFilter} onChange={(v) => { setOwnerFilter(v); setPage(1); }} className="w-40">
              <option value="">All Owners</option>
              {owners.map((o) => <option key={o} value={o}>{o}</option>)}
            </FieldSelect>
            <Button variant="outline" className="h-9" onClick={resetFilters} disabled={!filtersActive} title="Clear filters">
              <Filter className="h-4 w-4" /> Filter
            </Button>
            <RefreshButton onClick={() => refetch()} spinning={isFetching} />
          </div>
        </Toolbar>

        {isLoading ? (
          <div className="space-y-2 p-4">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-md" />)}</div>
        ) : institutions.length === 0 ? (
          <EmptyState icon={UsersIcon} title="No clients yet" description="Add your first client to get started." />
        ) : total === 0 ? (
          <EmptyState icon={UsersIcon} title="No matches" description="No clients match the current filters." />
        ) : (
          <>
            {/* The ONLY scroll region on the page — rows scroll, toolbar and
                pagination stay pinned. */}
            <div className="min-h-0 flex-1 overflow-y-auto">
              <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className={headCls}><SortLabel label="Client" sortKey="name" activeKey={sortKey} dir={sortDir} onSort={toggleSort} /></TableHead>
                  <TableHead className={headCls}><SortLabel label="Owner" sortKey="owner" activeKey={sortKey} dir={sortDir} onSort={toggleSort} /></TableHead>
                  <TableHead className={headCls}><SortLabel label="Phone" sortKey="phone" activeKey={sortKey} dir={sortDir} onSort={toggleSort} /></TableHead>
                  <TableHead className={headCls}><SortLabel label="Users" sortKey="users" activeKey={sortKey} dir={sortDir} onSort={toggleSort} /></TableHead>
                  <TableHead className={headCls}><SortLabel label="Courses" sortKey="courses" activeKey={sortKey} dir={sortDir} onSort={toggleSort} /></TableHead>
                  <TableHead className={headCls}><SortLabel label="Status" sortKey="status" activeKey={sortKey} dir={sortDir} onSort={toggleSort} /></TableHead>
                  <TableHead className={cn(headCls, 'text-right')}>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageItems.map((inst) => (
                  <TableRow key={inst._id} className={tableRowClass}>
                    <TableCell className={cellCls}>
                      <RowIdentity initial={inst.inst_name.charAt(0)} primary={inst.inst_name} secondary={inst.inst_id} />
                    </TableCell>
                    <TableCell className={cn(cellCls, 'text-muted-foreground')}>{inst.inst_owner}</TableCell>
                    <TableCell className={cn(cellCls, 'text-muted-foreground')}>{inst.phone}</TableCell>
                    <TableCell className={cn(cellCls, 'text-muted-foreground')}>{inst.userCount}</TableCell>
                    <TableCell className={cn(cellCls, 'text-muted-foreground')}>{inst.courseCount}</TableCell>
                    <TableCell className={cellCls}>
                      <StatusBadge status={inst.status === 'active' ? 'success' : 'danger'}>{inst.status}</StatusBadge>
                    </TableCell>
                    <TableCell className={cellCls}>
                      <RowActions>
                        <DropdownMenu modal={false}>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" title="Manage client"><MoreHorizontal className="h-4 w-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-52">
                            <DropdownMenuItem onClick={() => setDetails(inst)}>
                              <Eye className="h-4 w-4" /> View Details
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => openClientPage('roles', inst)}>
                              <ShieldCheck className="h-4 w-4" /> Role Management
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setPermInst(inst)}>
                              <KeyRound className="h-4 w-4" /> Permission Management
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              disabled={!inst.hasPermissions}
                              title={inst.hasPermissions ? undefined : 'Set Permission Management first'}
                              onClick={() => openClientPage('users', inst)}
                            >
                              <UsersIcon className="h-4 w-4" /> User Management
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              disabled={!inst.hasPermissions}
                              title={inst.hasPermissions ? undefined : 'Set Permission Management first'}
                              onClick={() => openClientPage('resources', inst)}
                            >
                              <HardDrive className="h-4 w-4" /> Resource Management
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => statusMutation.mutate({ id: inst._id, status: inst.status === 'active' ? 'suspended' : 'active' })}>
                              {inst.status === 'active' ? <><Ban className="h-4 w-4" /> Deactivate</> : <><CheckCircle2 className="h-4 w-4" /> Activate</>}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              variant="destructive"
                              onClick={async () => {
                                const ok = await confirm({
                                  title: 'Delete client',
                                  description: `Delete "${inst.inst_name}"? This cannot be undone.`,
                                  confirmLabel: 'Delete',
                                  destructive: true,
                                });
                                if (ok) deleteMutation.mutate(inst._id);
                              }}
                            >
                              <Trash2 className="h-4 w-4" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </RowActions>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              </Table>
            </div>
            <PaginationBar
              rangeStart={rangeStart} rangeEnd={rangeEnd} total={total}
              page={page} totalPages={totalPages} onPageChange={setPage}
              pageSize={pageSize} onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
              pageSizeOptions={[5, 10, 25, 50]}
            />
          </>
        )}
      </Panel>

      {/* View Details */}
      <Dialog open={!!details} onOpenChange={(o) => !o && setDetails(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Client Details</DialogTitle></DialogHeader>
          {details && (
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-3 border-b border-border pb-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent text-sm font-semibold text-accent-foreground">
                  {details.inst_name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="font-semibold text-foreground">{details.inst_name}</div>
                  <div className="text-xs text-muted-foreground">{details.inst_id}</div>
                </div>
              </div>
              {[
                ['Owner', details.inst_owner],
                ['Phone', details.phone],
                ['Users', String(details.userCount)],
                ['Courses', String(details.courseCount)],
                ['Plan', details.subscription?.plan || '—'],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4">
                  <span className="text-muted-foreground">{k}</span>
                  <span className="text-right font-medium text-foreground">{v}</span>
                </div>
              ))}
              <div className="mt-2 grid grid-cols-3 gap-2">
                <Button variant="outline" size="sm" onClick={() => { const d = details; setDetails(null); openClientPage('roles', d); }}>Roles</Button>
                <Button variant="outline" size="sm" onClick={() => { const d = details; setDetails(null); openClientPage('users', d); }}>Users</Button>
                <Button variant="outline" size="sm" onClick={() => { const d = details; setDetails(null); openClientPage('resources', d); }}>Resources</Button>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetails(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Permission Management — set which permissions this institution may use
          (per Student/Staff/Admin role category). Limits the Add User modal. */}
      {permInst && (
        <PermissionModal
          isOpen={!!permInst}
          onClose={() => setPermInst(null)}
          userId=""
          userName={permInst.inst_name}
          userEmail={permInst.inst_id}
          saveLabel="Save Permissions"
          loadPermissions={() => getInstitutionPermissions(permInst._id).then((r) => r.permissions)}
          savePermissions={async (perms) => {
            await updateInstitutionPermissions(permInst._id, perms as InstitutionPermission[]);
            // Refresh the allow-list (Add User modal) and the institutions list
            // (so the User/Resource Management items un-disable right away).
            queryClient.invalidateQueries({ queryKey: ['superadmin', 'institution-permissions', permInst._id], refetchType: 'all' });
            queryClient.invalidateQueries({ queryKey: ['superadmin', 'institutions'], refetchType: 'all' });
          }}
        />
      )}

      {/* Add Client — same form/flow the retired institutions page had */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Add Client</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="inst_name">Institution Name</Label>
              <Input id="inst_name" value={form.inst_name} onChange={(e) => setForm({ ...form, inst_name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="inst_owner">Owner Name</Label>
              <Input id="inst_owner" value={form.inst_owner} onChange={(e) => setForm({ ...form, inst_owner: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="address">Address</Label>
              <Input id="address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Create Client
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmHost />
    </div>
  );
}
