'use client';
import React, { Suspense, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, ShieldCheck, Loader2, MoreHorizontal } from 'lucide-react';
import { getAllInstitutions } from '@/apiServices/superadmin/institutionService';
import { Role, getAllRoles, createRole, updateRole, deleteRole } from '@/apiServices/superadmin/roleService';
import { toApiError } from '@/lib/superAdminApiClient';
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
  PageHeader, Panel, EmptyState, FieldSelect, SearchInput, Toolbar, RefreshButton, useSort, SortLabel,
  useConfirm, tableHeadClass, tableCellClass, tableRowClass, RowActions, usePagination, PaginationBar,
} from '../../_components/ui';
import { useClientScope, BackToClients } from '../../_components/ClientScope';
import { cn } from '@/lib/utils';

function RolesPageInner() {
  const queryClient = useQueryClient();
  const { institutionId: scopedId, name: scopedName, scoped } = useClientScope();
  const [institutionId, setInstitutionId] = useState(scopedId);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Role | null>(null);
  const [form, setForm] = useState({ originalRole: '', renameRole: '' });
  const [search, setSearch] = useState('');
  const [pageSize, setPageSize] = useState(10);
  const { confirm, ConfirmHost } = useConfirm();

  const { data: instData } = useQuery({ queryKey: ['superadmin', 'institutions'], queryFn: getAllInstitutions });
  const institutions = instData?.institutions || [];

  const { data: roleData, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['superadmin', 'roles', institutionId],
    queryFn: () => getAllRoles(institutionId),
    enabled: !!institutionId,
  });
  const roles = roleData?.roles || [];
  const filtered = roles.filter((r) => {
    const q = search.toLowerCase();
    return (
      r.originalRole?.toLowerCase().includes(q) ||
      r.renameRole?.toLowerCase().includes(q) ||
      String(r.roleValue ?? '').toLowerCase().includes(q)
    );
  });
  const { sorted, sortKey, sortDir, toggleSort } = useSort(filtered, {
    name: (r) => r.originalRole || '',
    display: (r) => r.renameRole || '',
    value: (r) => r.roleValue ?? '',
  });
  const { pageItems, page, setPage, totalPages, rangeStart, rangeEnd, total } = usePagination(sorted, pageSize);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['superadmin', 'roles', institutionId] });

  const createMutation = useMutation({
    mutationFn: () => createRole({ institution: institutionId, originalRole: form.originalRole, renameRole: form.renameRole }),
    onSuccess: () => { showSuccessToast('Role created'); close(); invalidate(); },
    onError: (err) => showErrorToast(toApiError(err).message),
  });
  const updateMutation = useMutation({
    mutationFn: () => updateRole(editing!._id, { originalRole: form.originalRole, renameRole: form.renameRole }),
    onSuccess: () => { showSuccessToast('Role updated'); close(); invalidate(); },
    onError: (err) => showErrorToast(toApiError(err).message),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteRole(id),
    onSuccess: () => { showSuccessToast('Role deleted'); invalidate(); },
    onError: (err) => showErrorToast(toApiError(err).message),
  });

  const openCreate = () => { setEditing(null); setForm({ originalRole: '', renameRole: '' }); setOpen(true); };
  const openEdit = (role: Role) => { setEditing(role); setForm({ originalRole: role.originalRole, renameRole: role.renameRole || role.originalRole }); setOpen(true); };
  const close = () => { setOpen(false); setEditing(null); setForm({ originalRole: '', renameRole: '' }); };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.originalRole) { showErrorToast('Role name is required'); return; }
    editing ? updateMutation.mutate() : createMutation.mutate();
  };

  return (
    <div>
      {scoped && <BackToClients name={scopedName} />}
      <PageHeader
        title="Role Management"
        description={scoped ? `Manage roles for ${scopedName || 'this client'}.` : 'Select a client to manage its roles.'}
        actions={<Button onClick={openCreate} disabled={!institutionId}><Plus className="h-4 w-4" /> Add Role</Button>}
      />

      {!scoped && (
        <div className="mb-4">
          <FieldSelect value={institutionId} onChange={setInstitutionId} className="w-full max-w-sm">
            <option value="">Select client...</option>
            {institutions.map((inst) => <option key={inst._id} value={inst._id}>{inst.inst_name}</option>)}
          </FieldSelect>
        </div>
      )}

      {institutionId && (
        <Panel>
          <Toolbar>
            <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search roles..." className="w-full sm:max-w-xs" />
            <RefreshButton onClick={() => refetch()} spinning={isFetching} />
          </Toolbar>

          {isLoading ? (
            <div className="space-y-2 p-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-md" />)}</div>
          ) : roles.length === 0 ? (
            <EmptyState icon={ShieldCheck} title="No roles yet" description="Create a role for this institution to begin." />
          ) : total === 0 ? (
            <EmptyState icon={ShieldCheck} title="No matches" description="No roles match the current search." />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className={tableHeadClass}><SortLabel label="Role Name" sortKey="name" activeKey={sortKey} dir={sortDir} onSort={toggleSort} /></TableHead>
                    <TableHead className={tableHeadClass}><SortLabel label="Display Name" sortKey="display" activeKey={sortKey} dir={sortDir} onSort={toggleSort} /></TableHead>
                    <TableHead className={tableHeadClass}><SortLabel label="Role Value" sortKey="value" activeKey={sortKey} dir={sortDir} onSort={toggleSort} /></TableHead>
                    <TableHead className={cn(tableHeadClass, 'text-right')}>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pageItems.map((role) => (
                    <TableRow key={role._id} className={tableRowClass}>
                      <TableCell className={cn(tableCellClass, 'font-medium text-foreground')}>{role.originalRole}</TableCell>
                      <TableCell className={cn(tableCellClass, 'text-muted-foreground')}>{role.renameRole}</TableCell>
                      <TableCell className={cn(tableCellClass, 'text-muted-foreground')}>{role.roleValue}</TableCell>
                      <TableCell className={tableCellClass}>
                        <RowActions>
                          <DropdownMenu modal={false}>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" title="Actions"><MoreHorizontal className="h-4 w-4" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-40">
                              <DropdownMenuItem onClick={() => openEdit(role)}>
                                <Pencil className="h-4 w-4" /> Edit
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                variant="destructive"
                                onClick={async () => {
                                  const ok = await confirm({
                                    title: 'Delete role',
                                    description: `Delete role "${role.originalRole}"? Users with this role keep it assigned but it will no longer be selectable.`,
                                    confirmLabel: 'Delete',
                                    destructive: true,
                                  });
                                  if (ok) deleteMutation.mutate(role._id);
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
      )}

      <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : close())}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{editing ? 'Edit Role' : 'Add Role'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="originalRole">Role Name</Label>
              <Input id="originalRole" value={form.originalRole} onChange={(e) => setForm({ ...form, originalRole: e.target.value })} placeholder="e.g. Coordinator" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="renameRole">Display Name (optional)</Label>
              <Input id="renameRole" value={form.renameRole} onChange={(e) => setForm({ ...form, renameRole: e.target.value })} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={close}>Cancel</Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="h-4 w-4 animate-spin" />}
                {editing ? 'Save Changes' : 'Create Role'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmHost />
    </div>
  );
}

export default function RolesPage() {
  return (
    <Suspense fallback={null}>
      <RolesPageInner />
    </Suspense>
  );
}
