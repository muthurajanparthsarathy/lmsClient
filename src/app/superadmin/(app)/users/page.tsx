'use client';
import React, { Suspense, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Trash2, Ban, CheckCircle2, Users as UsersIcon, Loader2, KeyRound, Pencil, MoreHorizontal,
  UserCheck, UserX, ShieldCheck,
} from 'lucide-react';
import { getAllInstitutions, getInstitutionPermissions } from '@/apiServices/superadmin/institutionService';
import { getAllRoles } from '@/apiServices/superadmin/roleService';
import {
  UserInput, SuperAdminUserRow, EmbeddedPermission,
  getAllUsers, createUser, updateUser, deleteUser, updateUserStatus,
  getUserPermissions, updateUserPermissions,
} from '@/apiServices/superadmin/userService';
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
import { PermissionModal } from '@/app/lms/pages/usermanagement/components/PermissionModal';
import {
  PageHeader, Panel, EmptyState, FieldSelect, StatusBadge, SearchInput, MetricCard, Toolbar, RefreshButton,
  useSort, SortLabel, useConfirm,
  tableHeadClass, tableCellClass, tableRowClass, RowActions, RowIdentity, usePagination, PaginationBar,
} from '../../_components/ui';
import { useClientScope, BackToClients } from '../../_components/ClientScope';

const emptyForm = { role: '', firstName: '', lastName: '', email: '', phone: '', password: '' };
const emptyEdit = { role: '', firstName: '', lastName: '', phone: '', status: 'active' as 'active' | 'inactive' };

function UsersPageInner() {
  const queryClient = useQueryClient();
  const { institutionId: scopedId, name: scopedName, scoped } = useClientScope();
  const [institutionId, setInstitutionId] = useState(scopedId);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [pageSize, setPageSize] = useState(10);
  const { confirm, ConfirmHost } = useConfirm();

  // Add User
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [addPermOpen, setAddPermOpen] = useState(false);
  const [addPerms, setAddPerms] = useState<EmbeddedPermission[]>([]);

  // Edit User
  const [editUser, setEditUser] = useState<SuperAdminUserRow | null>(null);
  const [editForm, setEditForm] = useState(emptyEdit);

  // Assign Permission (existing user)
  const [permUser, setPermUser] = useState<SuperAdminUserRow | null>(null);

  const { data: instData } = useQuery({ queryKey: ['superadmin', 'institutions'], queryFn: getAllInstitutions });
  const institutions = instData?.institutions || [];

  const { data: roleData } = useQuery({
    queryKey: ['superadmin', 'roles', institutionId],
    queryFn: () => getAllRoles(institutionId),
    enabled: !!institutionId,
  });
  const roles = roleData?.roles || [];

  // The institution's permission allow-list (set via Clients → Permission
  // Management). When non-empty, the Add User / Assign Permission modals are
  // limited to these permission ids; empty → full catalog (not yet configured).
  const { data: instPermData } = useQuery({
    queryKey: ['superadmin', 'institution-permissions', institutionId],
    queryFn: () => getInstitutionPermissions(institutionId),
    enabled: !!institutionId,
    // The allow-list is edited on the Clients page; the global config caches for
    // 5 min and doesn't refetch on mount, so force a fresh read here so newly
    // added permissions always appear.
    staleTime: 0,
    refetchOnMount: 'always',
  });
  // The institution's allow-list ids. Passed to the permission modal as-is:
  // an empty list means "no permissions available" (nothing shows) until the
  // super admin configures Permission Management for this institution.
  // undefined only while the query is still loading (→ modal not yet limited).
  const allowedIds = instPermData
    ? (instPermData.permissions.map((p) => p.id).filter(Boolean) as string[])
    : undefined;
  // Per-permission allowed function ids — so the Add User / Assign Permission
  // modals only offer the functions the institution enabled.
  const allowedFunctions = instPermData
    ? Object.fromEntries(
        instPermData.permissions
          .filter((p) => p.id)
          .map((p) => [p.id as string, p.permissionFunctionality || []])
      )
    : undefined;

  const { data: userData, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['superadmin', 'users', institutionId],
    queryFn: () => getAllUsers(institutionId),
    enabled: !!institutionId,
  });
  const users = userData?.users || [];
  const roleName = (u: SuperAdminUserRow) => u.role?.renameRole || u.role?.originalRole || '';
  const activeUsers = users.filter((u) => u.status === 'active').length;
  const roleCount = new Set(users.map((u) => u.role?._id).filter(Boolean)).size;

  const filtered = users.filter((u) => {
    const q = search.toLowerCase();
    const matchesSearch =
      u.firstName?.toLowerCase().includes(q) ||
      u.lastName?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q) ||
      u.userId?.toLowerCase().includes(q);
    const matchesStatus = !statusFilter || u.status === statusFilter;
    const matchesRole = !roleFilter || u.role?._id === roleFilter;
    return matchesSearch && matchesStatus && matchesRole;
  });
  const { sorted, sortKey, sortDir, toggleSort } = useSort(filtered, {
    name: (u) => `${u.firstName} ${u.lastName || ''}`.trim(),
    email: (u) => u.email || '',
    phone: (u) => u.phone || '',
    role: (u) => roleName(u),
    status: (u) => u.status,
  });
  const { pageItems, page, setPage, totalPages, rangeStart, rangeEnd, total } = usePagination(sorted, pageSize);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['superadmin', 'users', institutionId] });

  const createMutation = useMutation({
    mutationFn: () => createUser({
      institution: institutionId,
      ...form,
      permissions: addPerms.length ? addPerms : undefined,
    } as UserInput),
    onSuccess: () => { showSuccessToast('User created'); closeAdd(); invalidate(); },
    onError: (err) => showErrorToast(toApiError(err).message),
  });
  const updateMutation = useMutation({
    mutationFn: () => updateUser(editUser!._id, editForm),
    onSuccess: () => { showSuccessToast('User updated'); setEditUser(null); invalidate(); },
    onError: (err) => showErrorToast(toApiError(err).message),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteUser(id),
    onSuccess: () => { showSuccessToast('User deleted'); invalidate(); },
    onError: (err) => showErrorToast(toApiError(err).message),
  });
  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'active' | 'inactive' }) => updateUserStatus(id, status),
    onSuccess: () => { showSuccessToast('Status updated'); invalidate(); },
    onError: (err) => showErrorToast(toApiError(err).message),
  });

  const closeAdd = () => { setOpen(false); setAddPermOpen(false); setForm(emptyForm); setAddPerms([]); };

  const openEdit = (u: SuperAdminUserRow) => {
    setEditForm({
      role: u.role?._id || '',
      firstName: u.firstName || '',
      lastName: u.lastName || '',
      phone: u.phone || '',
      status: u.status,
    });
    setEditUser(u);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.role || !form.firstName || !form.email || !form.phone || !form.password) {
      showErrorToast('Role, name, email, phone and password are required');
      return;
    }
    createMutation.mutate();
  };

  return (
    <div className="space-y-6">
      {scoped && <BackToClients name={scopedName} />}
      <PageHeader
        title="User Management"
        description={scoped ? `Add and manage users for ${scopedName || 'this client'}.` : 'Select a client, then add and manage its users.'}
        actions={
          <>
            {!scoped && (
              <FieldSelect value={institutionId} onChange={(v) => { setInstitutionId(v); setSearch(''); setPage(1); }} className="w-full sm:w-56">
                <option value="">Select client...</option>
                {institutions.map((inst) => <option key={inst._id} value={inst._id}>{inst.inst_name}</option>)}
              </FieldSelect>
            )}
            <Button onClick={() => { setForm(emptyForm); setAddPerms([]); setOpen(true); }} disabled={!institutionId}><Plus className="h-4 w-4" /> Add User</Button>
          </>
        }
      />

      {institutionId && !isLoading && users.length > 0 && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <MetricCard icon={UsersIcon} label="Total Users" value={users.length} caption="In this client" iconClass="bg-primary/10 text-primary" />
          <MetricCard icon={UserCheck} label="Active" value={activeUsers} caption="Enabled accounts" iconClass="bg-[var(--success-bg)] text-[var(--success-fg)]" captionClass="text-[var(--success-fg)]" />
          <MetricCard icon={UserX} label="Inactive" value={users.length - activeUsers} caption="Disabled accounts" iconClass="bg-[var(--danger-bg)] text-destructive" />
          <MetricCard icon={ShieldCheck} label="Roles" value={roleCount} caption="Distinct roles" iconClass="bg-chart-4/15 text-chart-4" />
        </div>
      )}

      {institutionId && (
        <Panel>
          <Toolbar>
            <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search by name, email or ID..." className="w-full sm:max-w-xs" />
            <div className="flex flex-wrap items-center gap-2">
              <FieldSelect value={statusFilter} onChange={(v) => { setStatusFilter(v); setPage(1); }} className="w-36">
                <option value="">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </FieldSelect>
              <FieldSelect value={roleFilter} onChange={(v) => { setRoleFilter(v); setPage(1); }} className="w-40">
                <option value="">All Roles</option>
                {roles.map((r) => <option key={r._id} value={r._id}>{r.renameRole || r.originalRole}</option>)}
              </FieldSelect>
              <RefreshButton onClick={() => refetch()} spinning={isFetching} />
            </div>
          </Toolbar>

          {isLoading ? (
            <div className="space-y-2 p-4">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-md" />)}</div>
          ) : users.length === 0 ? (
            <EmptyState icon={UsersIcon} title="No users yet" description="Add the first user for this institution." />
          ) : total === 0 ? (
            <EmptyState icon={UsersIcon} title="No matches" description="No users match the current filters." />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className={tableHeadClass}><SortLabel label="Name" sortKey="name" activeKey={sortKey} dir={sortDir} onSort={toggleSort} /></TableHead>
                    <TableHead className={tableHeadClass}><SortLabel label="Email" sortKey="email" activeKey={sortKey} dir={sortDir} onSort={toggleSort} /></TableHead>
                    <TableHead className={tableHeadClass}><SortLabel label="Phone" sortKey="phone" activeKey={sortKey} dir={sortDir} onSort={toggleSort} /></TableHead>
                    <TableHead className={tableHeadClass}><SortLabel label="Role" sortKey="role" activeKey={sortKey} dir={sortDir} onSort={toggleSort} /></TableHead>
                    <TableHead className={tableHeadClass}><SortLabel label="Status" sortKey="status" activeKey={sortKey} dir={sortDir} onSort={toggleSort} /></TableHead>
                    <TableHead className={cn(tableHeadClass, 'text-right')}>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pageItems.map((u) => (
                    <TableRow key={u._id} className={tableRowClass}>
                      <TableCell className={tableCellClass}>
                        <RowIdentity initial={u.firstName?.charAt(0) || '?'} primary={`${u.firstName} ${u.lastName || ''}`.trim()} secondary={u.userId} />
                      </TableCell>
                      <TableCell className={cn(tableCellClass, 'text-muted-foreground')}>{u.email}</TableCell>
                      <TableCell className={cn(tableCellClass, 'text-muted-foreground')}>{u.phone}</TableCell>
                      <TableCell className={cn(tableCellClass, 'text-muted-foreground')}>{u.role?.renameRole || u.role?.originalRole || '-'}</TableCell>
                      <TableCell className={tableCellClass}>
                        <StatusBadge status={u.status === 'active' ? 'success' : 'danger'}>{u.status}</StatusBadge>
                      </TableCell>
                      <TableCell className={tableCellClass}>
                        <RowActions>
                          {/* modal={false}: without it, opening a Dialog (Edit /
                              Assign Permission / delete-confirm) from a menu item
                              leaves pointer-events:none stuck on <body> and the
                              page freezes until refresh (known Radix issue). */}
                          <DropdownMenu modal={false}>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" title="Actions">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              <DropdownMenuItem onClick={() => openEdit(u)}>
                                <Pencil className="h-4 w-4" /> Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => statusMutation.mutate({ id: u._id, status: u.status === 'active' ? 'inactive' : 'active' })}
                              >
                                {u.status === 'active'
                                  ? <><Ban className="h-4 w-4" /> Set Inactive</>
                                  : <><CheckCircle2 className="h-4 w-4" /> Set Active</>}
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setPermUser(u)}>
                                <KeyRound className="h-4 w-4" /> Assign Permission
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                variant="destructive"
                                onClick={async () => {
                                  const ok = await confirm({
                                    title: 'Delete user',
                                    description: `Delete user "${(u.firstName + ' ' + (u.lastName || '')).trim()}"? This cannot be undone.`,
                                    confirmLabel: 'Delete',
                                    destructive: true,
                                  });
                                  if (ok) deleteMutation.mutate(u._id);
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

      {/* Add User */}
      <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : closeAdd())}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Add User</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Role</Label>
              <FieldSelect value={form.role} onChange={(v) => setForm({ ...form, role: v })} className="w-full">
                <option value="">Select role...</option>
                {roles.map((r) => <option key={r._id} value={r._id}>{r.renameRole || r.originalRole}</option>)}
              </FieldSelect>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="firstName">First Name</Label>
                <Input id="firstName" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lastName">Last Name</Label>
                <Input id="lastName" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="uphone">Phone</Label>
              <Input id="uphone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="upassword">Password</Label>
              <Input id="upassword" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </div>

            <div className="space-y-1.5">
              <Label>Permissions</Label>
              <button
                type="button"
                onClick={() => setAddPermOpen(true)}
                className="flex w-full items-center justify-between rounded-md border border-border px-3 py-2 text-left text-sm transition-colors hover:bg-accent/50"
              >
                <span className="flex items-center gap-2 text-foreground">
                  <KeyRound className="h-4 w-4 text-primary" /> Set Permissions
                </span>
                <span className="text-xs text-muted-foreground">{addPerms.length} selected</span>
              </button>
              <p className="text-xs text-muted-foreground">Opens the same permission modal as User Management.</p>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeAdd}>Cancel</Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Create User
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit User */}
      <Dialog open={!!editUser} onOpenChange={(o) => !o && setEditUser(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Edit User</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); if (!editForm.firstName) { showErrorToast('First name is required'); return; } updateMutation.mutate(); }} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Role</Label>
              <FieldSelect value={editForm.role} onChange={(v) => setEditForm({ ...editForm, role: v })} className="w-full">
                <option value="">Select role...</option>
                {roles.map((r) => <option key={r._id} value={r._id}>{r.renameRole || r.originalRole}</option>)}
              </FieldSelect>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="efirst">First Name</Label>
                <Input id="efirst" value={editForm.firstName} onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="elast">Last Name</Label>
                <Input id="elast" value={editForm.lastName} onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ephone">Phone</Label>
              <Input id="ephone" value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <FieldSelect value={editForm.status} onChange={(v) => setEditForm({ ...editForm, status: v as 'active' | 'inactive' })} className="w-full">
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </FieldSelect>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditUser(null)}>Cancel</Button>
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Assign Permission for an existing user — same modal as admin User Management */}
      {permUser && (
        <PermissionModal
          isOpen={!!permUser}
          onClose={() => setPermUser(null)}
          userId={permUser._id}
          userName={`${permUser.firstName} ${permUser.lastName || ''}`.trim()}
          userEmail={permUser.email}
          roleName={permUser.role?.renameRole || permUser.role?.originalRole}
          allowedIds={allowedIds}
          allowedFunctions={allowedFunctions}
          loadPermissions={() => getUserPermissions(permUser._id).then((r) => r.permissions)}
          savePermissions={(perms) => updateUserPermissions(permUser._id, perms as EmbeddedPermission[])}
        />
      )}

      {/* Add User → collect permissions locally (user does not exist yet) */}
      {addPermOpen && (
        <PermissionModal
          isOpen={addPermOpen}
          onClose={() => setAddPermOpen(false)}
          userId=""
          userName={form.firstName || 'New user'}
          userEmail={form.email || ''}
          // `form.role` is the role _id — resolve it to a name so a learner
          // being created gets the same Student-only catalog Assign Permission
          // gives an existing one.
          roleName={(() => {
            const r = roles.find((x: { _id: string }) => x._id === form.role);
            return r ? (r.renameRole || r.originalRole) : undefined;
          })()}
          saveLabel="Apply"
          allowedIds={allowedIds}
          allowedFunctions={allowedFunctions}
          loadPermissions={async () => addPerms}
          savePermissions={(perms) => { setAddPerms(perms as EmbeddedPermission[]); }}
        />
      )}

      <ConfirmHost />
    </div>
  );
}

export default function UsersPage() {
  return (
    <Suspense fallback={null}>
      <UsersPageInner />
    </Suspense>
  );
}
