'use client';
import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Trash2, Ban, CheckCircle2, ShieldCheck, Loader2, Pencil, MoreHorizontal,
  UserCheck, UserX,
} from 'lucide-react';
import {
  SuperAdminAccount, SuperAdminAccountInput,
  getAllSuperAdmins, createSuperAdmin, updateSuperAdmin, updateSuperAdminStatus, deleteSuperAdmin,
} from '@/apiServices/superadmin/superAdminUserService';
import { toApiError } from '@/lib/superAdminApiClient';
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
  PageHeader, Panel, EmptyState, FieldSelect, StatusBadge, SearchInput, MetricCard, Toolbar, RefreshButton,
  useSort, SortLabel, useConfirm, tableHeadClass, tableCellClass, tableRowClass, RowActions, RowIdentity,
  usePagination, PaginationBar,
} from '../../_components/ui';

const emptyForm: SuperAdminAccountInput = { name: '', email: '', phone: '', password: '', status: 'active' };

export default function SuperAdminsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [pageSize, setPageSize] = useState(10);
  const { confirm, ConfirmHost } = useConfirm();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<SuperAdminAccount | null>(null);
  const [form, setForm] = useState<SuperAdminAccountInput>(emptyForm);

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['superadmin', 'admins'],
    queryFn: getAllSuperAdmins,
  });
  const admins = data?.admins || [];
  const activeCount = admins.filter((a) => a.status === 'active').length;

  const filtered = admins.filter((a) => {
    const q = search.toLowerCase();
    const matchesSearch =
      a.name?.toLowerCase().includes(q) ||
      a.email?.toLowerCase().includes(q) ||
      (a.phone || '').toLowerCase().includes(q);
    const matchesStatus = !statusFilter || a.status === statusFilter;
    return matchesSearch && matchesStatus;
  });
  const { sorted, sortKey, sortDir, toggleSort } = useSort(filtered, {
    name: (a) => a.name || '',
    email: (a) => a.email || '',
    phone: (a) => a.phone || '',
    status: (a) => a.status,
  });
  const { pageItems, page, setPage, totalPages, rangeStart, rangeEnd, total } = usePagination(sorted, pageSize);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['superadmin', 'admins'] });

  const saveMutation = useMutation({
    mutationFn: () => editing ? updateSuperAdmin(editing._id, form) : createSuperAdmin(form),
    onSuccess: () => { showSuccessToast(editing ? 'Super admin updated' : 'Super admin created'); close(); invalidate(); },
    onError: (err) => showErrorToast(toApiError(err).message),
  });
  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'active' | 'inactive' }) => updateSuperAdminStatus(id, status),
    onSuccess: () => { showSuccessToast('Status updated'); invalidate(); },
    onError: (err) => showErrorToast(toApiError(err).message),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteSuperAdmin(id),
    onSuccess: () => { showSuccessToast('Super admin deleted'); invalidate(); },
    onError: (err) => showErrorToast(toApiError(err).message),
  });

  const openCreate = () => { setEditing(null); setForm(emptyForm); setOpen(true); };
  const openEdit = (a: SuperAdminAccount) => {
    setEditing(a);
    setForm({ name: a.name, email: a.email, phone: a.phone || '', password: '', status: a.status });
    setOpen(true);
  };
  const close = () => { setOpen(false); setEditing(null); setForm(emptyForm); };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.email || (!editing && !form.password)) {
      showErrorToast('Name, email and password are required');
      return;
    }
    saveMutation.mutate();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Super Admins"
        description="Manage the platform accounts that can sign in to this console."
        actions={<Button onClick={openCreate}><Plus className="h-4 w-4" /> Add Super Admin</Button>}
      />

      <div className="grid grid-cols-3 gap-4">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-[88px] rounded-xl" />)
        ) : (
          <>
            <MetricCard icon={ShieldCheck} label="Total Super Admins" value={admins.length} caption="Platform accounts" iconClass="bg-primary/10 text-primary" />
            <MetricCard icon={UserCheck} label="Active" value={activeCount} caption="Can sign in" iconClass="bg-[var(--success-bg)] text-[var(--success-fg)]" captionClass="text-[var(--success-fg)]" />
            <MetricCard icon={UserX} label="Inactive" value={admins.length - activeCount} caption="Sign-in disabled" iconClass="bg-[var(--danger-bg)] text-destructive" />
          </>
        )}
      </div>

      <Panel>
        <Toolbar>
          <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search by name, email or phone..." className="w-full sm:max-w-xs" />
          <div className="flex flex-wrap items-center gap-2">
            <FieldSelect value={statusFilter} onChange={(v) => { setStatusFilter(v); setPage(1); }} className="w-36">
              <option value="">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </FieldSelect>
            <RefreshButton onClick={() => refetch()} spinning={isFetching} />
          </div>
        </Toolbar>

        {isLoading ? (
          <div className="space-y-2 p-4">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-md" />)}</div>
        ) : admins.length === 0 ? (
          <EmptyState icon={ShieldCheck} title="No super admins" description="Add the first platform account." />
        ) : total === 0 ? (
          <EmptyState icon={ShieldCheck} title="No matches" description="No super admins match the current filters." />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className={tableHeadClass}><SortLabel label="Name" sortKey="name" activeKey={sortKey} dir={sortDir} onSort={toggleSort} /></TableHead>
                  <TableHead className={tableHeadClass}><SortLabel label="Email" sortKey="email" activeKey={sortKey} dir={sortDir} onSort={toggleSort} /></TableHead>
                  <TableHead className={tableHeadClass}><SortLabel label="Phone" sortKey="phone" activeKey={sortKey} dir={sortDir} onSort={toggleSort} /></TableHead>
                  <TableHead className={tableHeadClass}><SortLabel label="Status" sortKey="status" activeKey={sortKey} dir={sortDir} onSort={toggleSort} /></TableHead>
                  <TableHead className={cn(tableHeadClass, 'text-right')}>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageItems.map((a) => (
                  <TableRow key={a._id} className={tableRowClass}>
                    <TableCell className={tableCellClass}>
                      <RowIdentity initial={a.name?.charAt(0) || '?'} primary={a.name} secondary={a.email} />
                    </TableCell>
                    <TableCell className={cn(tableCellClass, 'text-muted-foreground')}>{a.email}</TableCell>
                    <TableCell className={cn(tableCellClass, 'text-muted-foreground')}>{a.phone || '—'}</TableCell>
                    <TableCell className={tableCellClass}>
                      <StatusBadge status={a.status === 'active' ? 'success' : 'danger'}>{a.status}</StatusBadge>
                    </TableCell>
                    <TableCell className={tableCellClass}>
                      <RowActions>
                        <DropdownMenu modal={false}>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" title="Actions"><MoreHorizontal className="h-4 w-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44">
                            <DropdownMenuItem onClick={() => openEdit(a)}>
                              <Pencil className="h-4 w-4" /> Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => statusMutation.mutate({ id: a._id, status: a.status === 'active' ? 'inactive' : 'active' })}>
                              {a.status === 'active' ? <><Ban className="h-4 w-4" /> Set Inactive</> : <><CheckCircle2 className="h-4 w-4" /> Set Active</>}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              variant="destructive"
                              onClick={async () => {
                                const ok = await confirm({
                                  title: 'Delete super admin',
                                  description: `Delete "${a.name}"? This cannot be undone.`,
                                  confirmLabel: 'Delete',
                                  destructive: true,
                                });
                                if (ok) deleteMutation.mutate(a._id);
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
            <PaginationBar
              rangeStart={rangeStart} rangeEnd={rangeEnd} total={total}
              page={page} totalPages={totalPages} onPageChange={setPage}
              pageSize={pageSize} onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
            />
          </>
        )}
      </Panel>

      {/* Add / Edit */}
      <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : close())}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{editing ? 'Edit Super Admin' : 'Add Super Admin'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">Name</Label>
              <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={form.email} disabled={!!editing} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              {editing && <p className="text-xs text-muted-foreground">Email can&apos;t be changed.</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">{editing ? 'New Password (leave blank to keep)' : 'Password'}</Label>
              <Input id="password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <FieldSelect value={form.status!} onChange={(v) => setForm({ ...form, status: v as 'active' | 'inactive' })} className="w-full">
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </FieldSelect>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={close}>Cancel</Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                {editing ? 'Save Changes' : 'Create Super Admin'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmHost />
    </div>
  );
}
