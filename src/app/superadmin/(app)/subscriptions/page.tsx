'use client';
import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Loader2, CreditCard, MoreHorizontal } from 'lucide-react';
import {
  SubscriptionRow, SubscriptionInput, getSubscriptions, upsertSubscription,
} from '@/apiServices/superadmin/subscriptionService';
import { toApiError } from '@/lib/superAdminApiClient';
import { showSuccessToast, showErrorToast } from '@/components/ui/toastUtils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import {
  PageHeader, EmptyState, FieldSelect, StatusBadge, SearchInput, Toolbar, RefreshButton,
  useSort, SortLabel, RowActions, tableHeadClass, tableCellClass, tableRowClass, usePagination, PaginationBar,
} from '../../_components/ui';
import { cn } from '@/lib/utils';

const PLANS = ['standard', 'professional', 'enterprise'];
const emptyForm: SubscriptionInput = { institution: '', plan: 'standard', status: 'active', storageQuotaMB: 5000, maxUsers: 0, amount: 0, expiryDate: '' };

export default function SubscriptionsPage() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [isNew, setIsNew] = useState(false);
  const [form, setForm] = useState<SubscriptionInput>(emptyForm);
  const [instName, setInstName] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [planFilter, setPlanFilter] = useState('');
  const [pageSize, setPageSize] = useState(10);

  const { data, isLoading, isFetching, refetch } = useQuery({ queryKey: ['superadmin', 'subscriptions'], queryFn: getSubscriptions });
  const rows = data?.rows || [];

  // Empty when the client has no subscription yet — shown as "Not subscribed",
  // never defaulted to active/standard.
  const subStatus = (r: SubscriptionRow) => r.subscription?.status || '';

  const filtered = rows.filter((r) => {
    const q = search.toLowerCase();
    const matchesSearch =
      r.institution.inst_name.toLowerCase().includes(q) ||
      r.institution.inst_id.toLowerCase().includes(q);
    const matchesStatus = !statusFilter || subStatus(r) === statusFilter;
    const matchesPlan = !planFilter || r.subscription?.plan === planFilter;
    return matchesSearch && matchesStatus && matchesPlan;
  });
  const { sorted, sortKey, sortDir, toggleSort } = useSort(filtered, {
    name: (r) => r.institution.inst_name,
    plan: (r) => r.subscription?.plan || '',
    amount: (r) => r.subscription?.amount ?? -1,
    maxUsers: (r) => r.subscription?.maxUsers ?? -1,
    status: (r) => subStatus(r),
  });
  const { pageItems, page, setPage, totalPages, rangeStart, rangeEnd, total } = usePagination(sorted, pageSize);

  const saveMutation = useMutation({
    mutationFn: () => upsertSubscription(form),
    onSuccess: () => {
      showSuccessToast('Subscription saved');
      setOpen(false);
      queryClient.invalidateQueries({ queryKey: ['superadmin', 'subscriptions'] });
      queryClient.invalidateQueries({ queryKey: ['superadmin', 'institutions'] });
    },
    onError: (err) => showErrorToast(toApiError(err).message),
  });

  const openEdit = (row: SubscriptionRow) => {
    setInstName(row.institution.inst_name);
    setForm({
      institution: row.institution._id,
      plan: row.subscription?.plan || 'standard',
      status: row.subscription?.status || 'active',
      storageQuotaMB: row.subscription?.storageQuotaMB ?? 5000,
      maxUsers: row.subscription?.maxUsers ?? 0,
      amount: row.subscription?.amount ?? 0,
      expiryDate: row.subscription?.expiryDate ? row.subscription.expiryDate.slice(0, 10) : '',
    });
    setIsNew(!row.subscription);
    setOpen(true);
  };

  return (
    <div className="space-y-5">
      <PageHeader title="Payment & Subscriptions" description="Plans, storage quotas and payment status for each client." />

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <Toolbar>
          <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search clients..." className="w-full sm:max-w-xs" />
          <div className="flex flex-wrap items-center gap-2">
            <FieldSelect value={statusFilter} onChange={(v) => { setStatusFilter(v); setPage(1); }} className="w-36">
              <option value="">All Status</option>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
            </FieldSelect>
            <FieldSelect value={planFilter} onChange={(v) => { setPlanFilter(v); setPage(1); }} className="w-40">
              <option value="">All Plans</option>
              {PLANS.map((p) => <option key={p} value={p} className="capitalize">{p}</option>)}
            </FieldSelect>
            <RefreshButton onClick={() => refetch()} spinning={isFetching} />
          </div>
        </Toolbar>

        {isLoading ? (
          <div className="space-y-2 p-4">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-md" />)}</div>
        ) : rows.length === 0 ? (
          <EmptyState icon={CreditCard} title="No institutions" description="Add an institution to manage its subscription." />
        ) : total === 0 ? (
          <EmptyState icon={CreditCard} title="No matches" description="No subscriptions match the current filters." />
        ) : (
          <>
            <Table className="w-full table-fixed">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className={cn(tableHeadClass, 'w-[24%]')}><SortLabel label="Institution" sortKey="name" activeKey={sortKey} dir={sortDir} onSort={toggleSort} /></TableHead>
                  <TableHead className={cn(tableHeadClass, 'w-[13%]')}><SortLabel label="Plan" sortKey="plan" activeKey={sortKey} dir={sortDir} onSort={toggleSort} /></TableHead>
                  <TableHead className={cn(tableHeadClass, 'w-[13%]')}>Storage</TableHead>
                  <TableHead className={cn(tableHeadClass, 'w-[12%]')}><SortLabel label="Max Users" sortKey="maxUsers" activeKey={sortKey} dir={sortDir} onSort={toggleSort} /></TableHead>
                  <TableHead className={cn(tableHeadClass, 'w-[13%]')}><SortLabel label="Amount" sortKey="amount" activeKey={sortKey} dir={sortDir} onSort={toggleSort} /></TableHead>
                  <TableHead className={cn(tableHeadClass, 'w-[15%]')}><SortLabel label="Status" sortKey="status" activeKey={sortKey} dir={sortDir} onSort={toggleSort} /></TableHead>
                  <TableHead className={cn(tableHeadClass, 'w-[10%] text-right')}>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageItems.map((row) => {
                  const sub = row.subscription;
                  return (
                    <TableRow key={row.institution._id} className={tableRowClass}>
                      <TableCell className={tableCellClass}>
                        <div className="break-words font-medium text-foreground">{row.institution.inst_name}</div>
                        <div className="text-xs text-muted-foreground">{row.institution.inst_id}</div>
                      </TableCell>
                      <TableCell className={cn(tableCellClass, 'capitalize text-muted-foreground')}>{sub?.plan || '—'}</TableCell>
                      <TableCell className={cn(tableCellClass, 'text-muted-foreground')}>{sub ? `${(sub.storageQuotaMB / 1000).toFixed(1)} GB` : '—'}</TableCell>
                      <TableCell className={cn(tableCellClass, 'text-muted-foreground')}>{sub ? (sub.maxUsers ? sub.maxUsers : 'Unlimited') : '—'}</TableCell>
                      <TableCell className={cn(tableCellClass, 'text-muted-foreground')}>{sub ? (sub.amount ? sub.amount.toLocaleString() : '0') : '—'}</TableCell>
                      <TableCell className={tableCellClass}>
                        {sub
                          ? <StatusBadge status={sub.status === 'active' ? 'success' : 'danger'}>{sub.status}</StatusBadge>
                          : <StatusBadge status="neutral">Not subscribed</StatusBadge>}
                      </TableCell>
                      <TableCell className={tableCellClass}>
                        <RowActions>
                          <DropdownMenu modal={false}>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" title="Actions"><MoreHorizontal className="h-4 w-4" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              <DropdownMenuItem onClick={() => openEdit(row)}>
                                {sub
                                  ? <><Pencil className="h-4 w-4" /> Edit Subscription</>
                                  : <><Plus className="h-4 w-4" /> Add Subscription</>}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </RowActions>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            <PaginationBar
              rangeStart={rangeStart} rangeEnd={rangeEnd} total={total}
              page={page} totalPages={totalPages} onPageChange={setPage}
              pageSize={pageSize} onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
            />
          </>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{isNew ? 'Add' : 'Edit'} Subscription — {instName}</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(); }} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Plan</Label>
                <FieldSelect value={form.plan!} onChange={(v) => setForm({ ...form, plan: v })} className="w-full">
                  {PLANS.map((p) => <option key={p} value={p} className="capitalize">{p}</option>)}
                </FieldSelect>
              </div>
              <div className="space-y-1.5">
                <Label>Amount</Label>
                <Input type="number" min={0} value={form.amount} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Storage Quota (MB)</Label>
                <Input type="number" min={0} value={form.storageQuotaMB} onChange={(e) => setForm({ ...form, storageQuotaMB: Number(e.target.value) })} />
              </div>
              <div className="space-y-1.5">
                <Label>Max Users (0 = ∞)</Label>
                <Input type="number" min={0} value={form.maxUsers} onChange={(e) => setForm({ ...form, maxUsers: Number(e.target.value) })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Status</Label>
                <FieldSelect value={form.status!} onChange={(v) => setForm({ ...form, status: v as 'active' | 'suspended' })} className="w-full">
                  <option value="active">active</option>
                  <option value="suspended">suspended</option>
                </FieldSelect>
              </div>
              <div className="space-y-1.5">
                <Label>Expiry Date</Label>
                <Input type="date" value={form.expiryDate} onChange={(e) => setForm({ ...form, expiryDate: e.target.value })} />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />} {isNew ? 'Add Subscription' : 'Save'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
