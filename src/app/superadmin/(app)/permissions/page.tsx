'use client';
import React, { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Lock, Save, KeyRound, Users, Loader2 } from 'lucide-react';
import { getAllInstitutions } from '@/apiServices/superadmin/institutionService';
import { getAllRoles } from '@/apiServices/superadmin/roleService';
import { ModuleEntry, getRolePermissions, saveRolePermissions } from '@/apiServices/superadmin/permissionService';
import { toApiError } from '@/lib/superAdminApiClient';
import { showSuccessToast, showErrorToast } from '@/components/ui/toastUtils';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader, Panel, FieldSelect, useConfirm } from '../../_components/ui';

export default function PermissionsPage() {
  const queryClient = useQueryClient();
  const [institutionId, setInstitutionId] = useState('');
  const [roleId, setRoleId] = useState('');
  const [draft, setDraft] = useState<ModuleEntry[]>([]);
  const { confirm, ConfirmHost } = useConfirm();

  const { data: instData } = useQuery({ queryKey: ['superadmin', 'institutions'], queryFn: getAllInstitutions });
  const institutions = instData?.institutions || [];

  const { data: roleData } = useQuery({
    queryKey: ['superadmin', 'roles', institutionId],
    queryFn: () => getAllRoles(institutionId),
    enabled: !!institutionId,
  });
  const roles = roleData?.roles || [];

  const { data: permData, isLoading } = useQuery({
    queryKey: ['superadmin', 'permissions', institutionId, roleId],
    queryFn: () => getRolePermissions(institutionId, roleId),
    enabled: !!institutionId && !!roleId,
  });

  useEffect(() => { if (permData?.modules) setDraft(permData.modules); }, [permData]);

  const saveMutation = useMutation({
    mutationFn: (modules: { permissionKey: string; isActive: boolean }[]) => saveRolePermissions(institutionId, roleId, modules),
    onSuccess: (res) => {
      showSuccessToast(`Saved — applied to ${res.affectedUsers} user(s)`);
      queryClient.invalidateQueries({ queryKey: ['superadmin', 'permissions', institutionId, roleId] });
    },
    onError: (err) => showErrorToast(toApiError(err).message),
  });

  const toggleModule = (key: string) => {
    setDraft((prev) => prev.map((m) => (m.permissionKey === key && !m.locked ? { ...m, isActive: !m.isActive } : m)));
  };

  const handleSave = async () => {
    const affected = permData?.affectedUserCount ?? 0;
    const enabledCount = draft.filter((m) => m.isActive).length;
    const ok = await confirm({
      title: 'Apply permission changes',
      description: `This will apply ${enabledCount} enabled module(s) to ${affected} existing user(s) with this role. Continue?`,
      confirmLabel: 'Apply Changes',
    });
    if (!ok) return;
    saveMutation.mutate(draft.map((m) => ({ permissionKey: m.permissionKey, isActive: m.isActive })));
  };

  return (
    <div>
      <PageHeader
        title="Permission Management"
        description="Select an institution and role, then enable the modules that role can access."
      />

      <div className="mb-6 flex flex-wrap gap-3">
        <FieldSelect value={institutionId} onChange={(v) => { setInstitutionId(v); setRoleId(''); }} className="w-full max-w-xs">
          <option value="">Select institution...</option>
          {institutions.map((inst) => <option key={inst._id} value={inst._id}>{inst.inst_name}</option>)}
        </FieldSelect>
        <FieldSelect value={roleId} onChange={setRoleId} disabled={!institutionId} className="w-full max-w-xs">
          <option value="">Select role...</option>
          {roles.map((r) => <option key={r._id} value={r._id}>{r.renameRole || r.originalRole}</option>)}
        </FieldSelect>
      </div>

      {institutionId && roleId && (
        <Panel className="p-5">
          {isLoading ? (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 9 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-lg" />)}
            </div>
          ) : (
            <>
              {permData && (
                <div className="mb-4 flex items-center gap-2 rounded-lg border border-border bg-muted/50 px-4 py-2.5 text-sm text-muted-foreground">
                  <Users className="h-4 w-4" />
                  Saving applies to <span className="font-semibold text-foreground">{permData.affectedUserCount}</span> existing user(s) with this role.
                </div>
              )}

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {draft.map((mod) => (
                  <div
                    key={mod.permissionKey}
                    className={`flex items-center justify-between rounded-lg border px-3.5 py-3 transition-colors ${
                      mod.isActive ? 'border-primary/30 bg-primary/5' : 'border-border bg-card'
                    }`}
                  >
                    <div className="flex items-center gap-2 text-sm">
                      <span className={`flex h-7 w-7 items-center justify-center rounded-md ${mod.isActive ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'}`}>
                        <KeyRound className="h-3.5 w-3.5" />
                      </span>
                      <span className="font-medium text-foreground">{mod.permissionName}</span>
                      {mod.locked && <Lock className="h-3 w-3 text-muted-foreground" />}
                    </div>
                    <Switch checked={mod.isActive} disabled={mod.locked} onCheckedChange={() => toggleModule(mod.permissionKey)} />
                  </div>
                ))}
              </div>

              <div className="mt-5 flex items-center gap-3">
                <Button onClick={handleSave} disabled={saveMutation.isPending}>
                  {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {saveMutation.isPending ? 'Saving...' : 'Save Permissions'}
                </Button>
                <span className="text-xs text-muted-foreground">
                  {draft.filter((m) => m.isActive).length} of {draft.length} modules enabled
                </span>
              </div>
            </>
          )}
        </Panel>
      )}

      <ConfirmHost />
    </div>
  );
}
