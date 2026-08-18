'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Degree, degreeService, Department } from '@/apiServices/dynamicFields/degreeService';
import { useDegreesQuery } from '@/queries/referenceData';
import {
  Plus, Trash2, ChevronRight, ArrowLeft,
  GraduationCap, Building2, Search,
  Layers, Hash, FileText, School, CalendarClock, Loader2,
} from 'lucide-react';
import { UserTable } from '@/components/ui/alterationTable';
import { Button } from '@/components/ui/button';
import {
  Modal,
  Toolbar,
  EmptyState,
  Field,
  Input,
  Textarea,
  SkeletonTable,
  StatusPill,
} from '@/app/lms/shared/ui';
import { TabCard, TabCardHeader, CountPill } from './ui';
import { usePermissions } from '@/hooks/usePermissions';
import { PERMISSION_IDS } from '@/components/permissions';

// ─── Shared small bits ──────────────────────────────────────────────────────

const selectCls =
  'h-10 w-full rounded-control border border-hairline-strong bg-surface px-3 text-sm text-body transition-colors ' +
  'hover:border-line-hover focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15';

const DegreeStatusPill = ({ status }: { status: 'active' | 'inactive' }) => (
  <StatusPill tone={status === 'active' ? 'success' : 'neutral'} dot>
    {status === 'active' ? 'Active' : 'Inactive'}
  </StatusPill>
);

const StatusToggle = ({
  value,
  onChange,
}: {
  value: 'active' | 'inactive';
  onChange: (v: 'active' | 'inactive') => void;
}) => (
  <div className="flex gap-2">
    {(['active', 'inactive'] as const).map(s => (
      <button
        key={s}
        type="button"
        onClick={() => onChange(s)}
        className={`flex h-10 flex-1 items-center justify-center gap-1.5 rounded-control border text-sm font-medium transition-colors duration-150 ${value === s
            ? s === 'active'
              ? 'border-success-500/40 bg-success-50 text-success-700'
              : 'border-hairline-strong bg-ink-100 text-ink-700'
            : 'border-hairline-strong text-faint hover:bg-row-hover hover:text-body'
          }`}
      >
        <span className={`h-1.5 w-1.5 rounded-full ${s === 'active' ? 'bg-success-500' : 'bg-ink-400'}`} />
        {s === 'active' ? 'Active' : 'Inactive'}
      </button>
    ))}
  </div>
);

// ─── Department Form Modal ──────────────────────────────────────────────────

const DepartmentModal = ({
  isOpen,
  onClose,
  onSuccess,
  degreeId,
  editingDepartment,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  degreeId: string;
  editingDepartment?: Department | null;
}) => {
  const [formData, setFormData] = useState({
    departmentName: '',
    departmentCode: '',
    description: '',
    status: 'active' as 'active' | 'inactive',
  });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (editingDepartment) {
      setFormData({
        departmentName: editingDepartment.departmentName,
        departmentCode: editingDepartment.departmentCode,
        description: editingDepartment.description || '',
        status: editingDepartment.status,
      });
    } else {
      setFormData({
        departmentName: '',
        departmentCode: '',
        description: '',
        status: 'active',
      });
    }
  }, [editingDepartment]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (editingDepartment) {
        await degreeService.updateDepartment(degreeId, editingDepartment._id!, formData);
      } else {
        await degreeService.addDepartment(degreeId, formData);
      }
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error saving department:', error);
      alert('Failed to save department');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title={editingDepartment ? 'Edit department' : 'Add department'}
      description={
        editingDepartment
          ? 'Update the department details below.'
          : 'Add a new department to this degree.'
      }
      size="sm"
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button type="submit" form="department-form" disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving…
              </>
            ) : editingDepartment ? (
              'Update department'
            ) : (
              'Add department'
            )}
          </Button>
        </>
      }
    >
      <form id="department-form" onSubmit={handleSubmit} className="space-y-4">
        <Field label="Department name" required>
          <Input
            type="text"
            required
            value={formData.departmentName}
            onChange={e => setFormData(prev => ({ ...prev, departmentName: e.target.value }))}
            placeholder="e.g. Computer Science"
          />
        </Field>

        <Field label="Department code" required>
          <Input
            type="text"
            required
            value={formData.departmentCode}
            onChange={e => setFormData(prev => ({ ...prev, departmentCode: e.target.value }))}
            placeholder="e.g. CS"
          />
        </Field>

        <Field label="Description">
          <Textarea
            value={formData.description}
            onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
            className="min-h-20 resize-none"
            rows={2}
            placeholder="Description of the department"
          />
        </Field>

        <Field label="Status">
          <StatusToggle value={formData.status} onChange={s => setFormData(prev => ({ ...prev, status: s }))} />
        </Field>
      </form>
    </Modal>
  );
};

// ─── Degree Form Modal ─────────────────────────────────────────────────────

const DegreeFormModal = ({
  isOpen,
  onClose,
  onSuccess,
  editingDegree,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editingDegree?: Degree | null;
}) => {
  const [formData, setFormData] = useState({
    degreeName: '',
    degreeCode: '',
    numberOfSemesters: '' as number | string,
    duration: '' as number | string,
    description: '',
    status: 'active' as 'active' | 'inactive',
    departments: [] as Array<{
      departmentName: string;
      departmentCode: string;
      description: string;
      status: 'active' | 'inactive';
    }>,
  });

  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (editingDegree) {
      setFormData({
        degreeName: editingDegree.degreeName,
        degreeCode: editingDegree.degreeCode,
        numberOfSemesters: editingDegree.numberOfSemesters ?? '',
        duration: editingDegree.duration ?? '',
        description: editingDegree.description || '',
        status: editingDegree.status,
        departments: editingDegree.departments.map(dept => ({
          departmentName: dept.departmentName,
          departmentCode: dept.departmentCode,
          description: dept.description || '',
          status: dept.status,
        })),
      });
    } else {
      setFormData({
        degreeName: '',
        degreeCode: '',
        numberOfSemesters: '',
        duration: '',
        description: '',
        status: 'active',
        departments: [],
      });
    }
  }, [editingDegree]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const payload = {
        ...formData,
        numberOfSemesters: Number(formData.numberOfSemesters),
        // Optional — send a number when filled, otherwise omit it entirely.
        duration:
          String(formData.duration).trim() === '' ? undefined : Number(formData.duration),
      };
      if (editingDegree) {
        await degreeService.updateDegree(editingDegree._id, {
          degreeName: payload.degreeName,
          degreeCode: payload.degreeCode,
          numberOfSemesters: payload.numberOfSemesters,
          duration: payload.duration,
          description: payload.description,
          status: payload.status,
          departments: payload.departments,
        });
      } else {
        await degreeService.createDegree(payload);
      }
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error saving degree:', error);
      alert('Failed to save degree');
    } finally {
      setIsLoading(false);
    }
  };

  const addDepartment = () => {
    setFormData(prev => ({
      ...prev,
      departments: [
        ...prev.departments,
        { departmentName: '', departmentCode: '', description: '', status: 'active' },
      ],
    }));
  };

  const removeDepartment = (index: number) => {
    setFormData(prev => ({
      ...prev,
      departments: prev.departments.filter((_, i) => i !== index),
    }));
  };

  const updateDepartment = (index: number, field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      departments: prev.departments.map((dept, i) => (i === index ? { ...dept, [field]: value } : dept)),
    }));
  };

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title={editingDegree ? 'Edit degree' : 'Add degree'}
      description="Define the degree and its departments."
      size="lg"
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button type="submit" form="degree-form" disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving…
              </>
            ) : editingDegree ? (
              'Save changes'
            ) : (
              'Create degree'
            )}
          </Button>
        </>
      }
    >
      <form id="degree-form" onSubmit={handleSubmit} className="space-y-4">
        {/* Degree details */}
        <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2">
          <Field label="Degree name" required>
            <Input
              type="text"
              required
              value={formData.degreeName}
              onChange={e => setFormData(prev => ({ ...prev, degreeName: e.target.value }))}
              placeholder="e.g. Bachelor of Science"
            />
          </Field>
          <Field label="Degree code" required>
            <Input
              type="text"
              required
              value={formData.degreeCode}
              onChange={e => setFormData(prev => ({ ...prev, degreeCode: e.target.value }))}
              placeholder="e.g. BSC"
            />
          </Field>
          <Field label="Number of semesters" required>
            <Input
              type="number"
              required
              min={1}
              leading={Layers}
              value={formData.numberOfSemesters}
              onChange={e => setFormData(prev => ({ ...prev, numberOfSemesters: e.target.value }))}
              placeholder="e.g. 6"
            />
          </Field>
          <Field label="Number of years" hint="Optional — leave blank if not applicable.">
            <Input
              type="number"
              min={1}
              leading={GraduationCap}
              value={formData.duration}
              onChange={e => setFormData(prev => ({ ...prev, duration: e.target.value }))}
              placeholder="e.g. 3"
            />
          </Field>
          <Field label="Status">
            <StatusToggle
              value={formData.status}
              onChange={s => setFormData(prev => ({ ...prev, status: s }))}
            />
          </Field>
        </div>

        <Field label="Description">
          <Textarea
            value={formData.description}
            onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
            className="min-h-20 resize-none"
            rows={2}
            placeholder="Description of the degree"
          />
        </Field>

        {/* Departments section */}
        <div className="border-t border-hairline pt-4">
          <div className="mb-3 flex items-center gap-2">
            <h3 className="text-sm font-semibold text-heading">Departments</h3>
            {formData.departments.length > 0 && (
              <span className="rounded-full bg-ink-100 px-2 py-0.5 text-xs font-medium tabular-nums text-ink-700">
                {formData.departments.length}
              </span>
            )}
          </div>

          {formData.departments.length === 0 ? (
            <div className="flex flex-wrap items-center gap-3 rounded-tile border border-dashed border-hairline-strong bg-canvas px-4 py-3">
              <Building2 className="h-4 w-4 flex-shrink-0 text-faint" />
              <p className="text-sm text-subtle">No departments added yet</p>
              <Button type="button" size="sm" onClick={addDepartment}>
                <Plus className="h-4 w-4" />
                Add department
              </Button>
            </div>
          ) : (
            <>
              <div className="space-y-3">
                {formData.departments.map((dept, index) => (
                  <div
                    key={index}
                    className="rounded-tile border border-hairline bg-canvas p-4"
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-subtle">
                        <span className="flex h-5 w-5 items-center justify-center rounded-chip bg-brand-wash text-2xs font-bold text-brand-strong tabular-nums">
                          {index + 1}
                        </span>
                        Department
                      </span>
                      <button
                        type="button"
                        aria-label="Remove department"
                        onClick={() => removeDepartment(index)}
                        className="rounded-chip p-1.5 text-subtle transition-colors duration-150 hover:bg-danger-50 hover:text-danger-700"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2">
                      <Field label="Department name" required>
                        <Input
                          type="text"
                          required
                          value={dept.departmentName}
                          onChange={e => updateDepartment(index, 'departmentName', e.target.value)}
                          placeholder="e.g. Computer Science"
                        />
                      </Field>
                      <Field label="Department code" required>
                        <Input
                          type="text"
                          required
                          value={dept.departmentCode}
                          onChange={e => updateDepartment(index, 'departmentCode', e.target.value)}
                          placeholder="e.g. CS"
                        />
                      </Field>
                      <div className="sm:col-span-2">
                        <Field label="Description">
                          <Input
                            type="text"
                            value={dept.description}
                            onChange={e => updateDepartment(index, 'description', e.target.value)}
                            placeholder="Department description"
                          />
                        </Field>
                      </div>
                      <Field label="Status">
                        <select
                          value={dept.status}
                          onChange={e => updateDepartment(index, 'status', e.target.value)}
                          className={selectCls}
                        >
                          <option value="active">Active</option>
                          <option value="inactive">Inactive</option>
                        </select>
                      </Field>
                    </div>
                  </div>
                ))}
              </div>

              {/* Dashed/ghost button — only when departments already exist */}
              <button
                type="button"
                onClick={addDepartment}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-tile border border-dashed border-hairline-strong px-3 py-2.5 text-sm font-medium text-subtle transition-colors duration-150 hover:border-brand-500/40 hover:bg-brand-wash hover:text-brand-strong"
              >
                <Plus className="h-4 w-4" />
                Add department
              </button>
            </>
          )}
        </div>
      </form>
    </Modal>
  );
};

// ─── Main Degree Management Component ──────────────────────────────────────

export default function DegreeManagementTab() {
  // Parent tab is already gated on 'Degree Management'; reuse the check here
  // so read-only users see the list without the create/edit/delete affordances.
  const { can } = usePermissions();
  const canAdd = can(PERMISSION_IDS.ADMIN_DYNAMIC_FIELD_SETTINGS, 'Degree Management');
  const canEdit = canAdd;
  const canDelete = canAdd;

  const queryClient = useQueryClient();
  const FIVE_MIN = 5 * 60 * 1000;
  const { data: degrees = [], isLoading } = useDegreesQuery(true, FIVE_MIN);
  const refreshDegrees = () => queryClient.invalidateQueries({ queryKey: ['degrees'] });
  const [searchTerm, setSearchTerm] = useState('');
  const [showDegreeForm, setShowDegreeForm] = useState(false);
  const [editingDegree, setEditingDegree] = useState<Degree | null>(null);
  const [showDepartmentModal, setShowDepartmentModal] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null);
  const [selectedDegreeId, setSelectedDegreeId] = useState<string>('');
  // When set, the panel swaps from the degree list to the department view for
  // this degree (master → detail), instead of expanding rows inline.
  const [manageDeptDegreeId, setManageDeptDegreeId] = useState<string | null>(null);

  const handleDeleteDegree = async (id: string) => {
    if (!confirm('Are you sure you want to delete this degree?')) return;
    try {
      await degreeService.deleteDegree(id);
      await refreshDegrees();
    } catch (error) {
      console.error('Error deleting degree:', error);
      alert('Failed to delete degree');
    }
  };

  const handleDeleteDepartment = async (degreeId: string, departmentId: string) => {
    if (!confirm('Are you sure you want to delete this department?')) return;
    try {
      await degreeService.removeDepartment(degreeId, departmentId);
      await refreshDegrees();
    } catch (error) {
      console.error('Error deleting department:', error);
      alert('Failed to delete department');
    }
  };

  const openAddDepartment = (degreeId: string) => {
    setSelectedDegreeId(degreeId);
    setEditingDepartment(null);
    setShowDepartmentModal(true);
  };

  const openEditDepartment = (degreeId: string, department: Department) => {
    setSelectedDegreeId(degreeId);
    setEditingDepartment(department);
    setShowDepartmentModal(true);
  };

  const filteredDegrees = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return degrees;
    return degrees.filter(
      d => d.degreeName.toLowerCase().includes(q) || d.degreeCode.toLowerCase().includes(q)
    );
  }, [degrees, searchTerm]);

  const totalDepartments = useMemo(
    () => degrees.reduce((sum, d) => sum + d.departments.length, 0),
    [degrees]
  );
  const activeDegrees = useMemo(() => degrees.filter(d => d.status === 'active').length, [degrees]);

  // The degree currently being managed in the department (detail) view. Read from
  // the live `degrees` list so it stays in sync after add/edit/delete.
  const manageDeptDegree = manageDeptDegreeId
    ? degrees.find(d => d._id === manageDeptDegreeId) || null
    : null;

  // ── Table columns (flat, professional — same UserTable as Client management) ──
  const degreeColumns = [
    {
      key: 'degree', label: 'Degree', align: 'left' as const, width: '30%',
      renderCell: (d: Degree) => (
        <div className="flex min-w-0 items-center gap-3 py-1">
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-tile bg-brand-wash">
            <GraduationCap className="h-4 w-4 text-brand-strong" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-heading">{d.degreeName}</p>
            <span className="flex items-center gap-1 text-xs text-faint">
              <Hash className="h-3 w-3" />
              {d.degreeCode}
            </span>
          </div>
        </div>
      ),
    },
    {
      key: 'sems', label: 'Semesters', align: 'center' as const, width: '12%',
      renderCell: (d: Degree) => (
        <span className="text-sm tabular-nums text-body">{d.numberOfSemesters}</span>
      ),
    },
    {
      key: 'years', label: 'Years', align: 'center' as const, width: '10%',
      renderCell: (d: Degree) => (
        <span className="text-sm tabular-nums text-body">{d.duration ?? '—'}</span>
      ),
    },
    {
      key: 'departments', label: 'Departments', align: 'center' as const, width: '18%',
      renderCell: (d: Degree) => (
        <button
          type="button"
          onClick={() => setManageDeptDegreeId(d._id)}
          className="inline-flex h-7 items-center gap-1.5 rounded-chip border border-brand-500/20 bg-brand-wash pl-2.5 pr-2 text-xs font-medium text-brand-strong transition-colors duration-150 hover:bg-brand-wash-hover"
          title="Manage departments"
        >
          <Building2 className="h-3.5 w-3.5" />
          <span className="whitespace-nowrap tabular-nums">
            {d.departments.length} dept{d.departments.length !== 1 ? 's' : ''}
          </span>
          <ChevronRight className="h-3.5 w-3.5 opacity-70" />
        </button>
      ),
    },
    {
      key: 'status', label: 'Status', align: 'center' as const, width: '14%',
      renderCell: (d: Degree) => <DegreeStatusPill status={d.status} />,
    },
  ];
  // Only include the row actions the user is allowed to trigger — UserTable
  // hides an action button whenever its handler is undefined.
  const degreeActions = {
    ...(canEdit
      ? { edit: (d: Degree) => { setEditingDegree(d); setShowDegreeForm(true); } }
      : {}),
    ...(canDelete ? { delete: (d: Degree) => handleDeleteDegree(d._id) } : {}),
  };

  const deptColumns = [
    {
      key: 'department', label: 'Department', align: 'left' as const, width: '30%',
      renderCell: (dep: Department) => (
        <div className="flex min-w-0 items-center gap-2.5 py-1">
          <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-chip bg-info-50">
            <FileText className="h-3.5 w-3.5 text-info-700" />
          </div>
          <span className="truncate text-sm font-medium text-heading">{dep.departmentName}</span>
        </div>
      ),
    },
    {
      key: 'code', label: 'Code', align: 'center' as const, width: '18%',
      renderCell: (dep: Department) => (
        <span className="text-sm text-subtle">{dep.departmentCode}</span>
      ),
    },
    {
      key: 'description', label: 'Description', align: 'left' as const, width: '34%',
      renderCell: (dep: Department) => (
        <span className="block max-w-[280px] truncate text-sm text-subtle" title={dep.description || undefined}>
          {dep.description || '—'}
        </span>
      ),
    },
    {
      key: 'status', label: 'Status', align: 'center' as const, width: '18%',
      renderCell: (dep: Department) => <DegreeStatusPill status={dep.status} />,
    },
  ];
  const deptActions = manageDeptDegree
    ? {
      ...(canEdit
        ? { edit: (dep: Department) => openEditDepartment(manageDeptDegree._id, dep) }
        : {}),
      ...(canDelete
        ? { delete: (dep: Department) => handleDeleteDepartment(manageDeptDegree._id, dep._id!) }
        : {}),
    }
    : undefined;

  return (
    // Fixed-height panel: the header/toolbar stay put and only the list below
    // scrolls, so the page as a whole no longer scrolls.
    <TabCard className="h-full">
      {manageDeptDegree ? (
        // ─── Department (detail) view ───────────────────────────────────────
        <>
          <div className="flex-shrink-0 border-b border-hairline px-5 py-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <button
                  type="button"
                  onClick={() => setManageDeptDegreeId(null)}
                  className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-control border border-hairline-strong bg-surface text-subtle transition-colors duration-150 hover:border-line-hover hover:text-heading"
                  title="Back to degrees"
                  aria-label="Back to degrees"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-tile bg-brand-wash">
                  <Building2 className="h-4.5 w-4.5 text-brand-strong" />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="truncate text-md font-semibold text-heading">Departments</h2>
                    <ChevronRight className="h-3.5 w-3.5 text-line-muted" />
                    <span className="truncate text-md font-semibold text-brand-strong">
                      {manageDeptDegree.degreeName}
                    </span>
                    <DegreeStatusPill status={manageDeptDegree.status} />
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5">
                    <span className="flex items-center gap-1 text-xs text-subtle">
                      <Hash className="h-3 w-3 text-faint" />
                      {manageDeptDegree.degreeCode}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-subtle tabular-nums">
                      <Layers className="h-3 w-3 text-faint" />
                      {manageDeptDegree.numberOfSemesters} sem{manageDeptDegree.numberOfSemesters !== 1 ? 's' : ''}
                    </span>
                    {manageDeptDegree.duration ? (
                      <span className="flex items-center gap-1 text-xs text-subtle tabular-nums">
                        <CalendarClock className="h-3 w-3 text-faint" />
                        {manageDeptDegree.duration} yr{manageDeptDegree.duration !== 1 ? 's' : ''}
                      </span>
                    ) : null}
                    <span className="flex items-center gap-1 text-xs text-subtle tabular-nums">
                      <Building2 className="h-3 w-3 text-faint" />
                      {manageDeptDegree.departments.length} dept{manageDeptDegree.departments.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
              </div>
              {canAdd && (
                <Button onClick={() => openAddDepartment(manageDeptDegree._id)} className="flex-shrink-0">
                  <Plus className="h-4 w-4" />
                  Add department
                </Button>
              )}
            </div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col overflow-auto">
            {manageDeptDegree.departments.length === 0 ? (
              <EmptyState
                icon={Building2}
                title="No departments yet"
                message={`Add the first department for ${manageDeptDegree.degreeName}.`}
                className="flex-1"
                primaryAction={
                  canAdd ? (
                    <Button onClick={() => openAddDepartment(manageDeptDegree._id)}>
                      <Plus className="h-4 w-4" />
                      Add department
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              <UserTable
                fillHeight
                isLoading={false}
                users={manageDeptDegree.departments}
                columns={deptColumns}
                actionButtons={deptActions}
              />
            )}
          </div>
        </>
      ) : (
        // ─── Degree (list) view ─────────────────────────────────────────────
        <>
          <TabCardHeader
            icon={School}
            title="Degree management"
            subtitle={
              isLoading
                ? 'Loading degrees…'
                : `${degrees.length} degree${degrees.length !== 1 ? 's' : ''} · ${activeDegrees} active · ${totalDepartments} department${totalDepartments !== 1 ? 's' : ''}`
            }
            actions={
              canAdd ? (
                <Button
                  onClick={() => {
                    setEditingDegree(null);
                    setShowDegreeForm(true);
                  }}
                >
                  <Plus className="h-4 w-4" />
                  Add degree
                </Button>
              ) : null
            }
          />

          <Toolbar
            search={{
              value: searchTerm,
              onChange: setSearchTerm,
              placeholder: 'Search degrees…',
            }}
            filters={<CountPill value={filteredDegrees.length} label="degrees" />}
          />

          {/* Content — the only scrolling region */}
          <div className="flex min-h-0 flex-1 flex-col overflow-auto">
            {isLoading ? (
              <SkeletonTable rows={6} cols={5} />
            ) : degrees.length === 0 ? (
              <EmptyState
                icon={GraduationCap}
                title="No degrees found"
                message="Get started by creating your first degree."
                className="flex-1"
                primaryAction={
                  canAdd ? (
                    <Button
                      onClick={() => {
                        setEditingDegree(null);
                        setShowDegreeForm(true);
                      }}
                    >
                      <Plus className="h-4 w-4" />
                      Create degree
                    </Button>
                  ) : undefined
                }
              />
            ) : filteredDegrees.length === 0 ? (
              <EmptyState
                icon={Search}
                title={`No matches for “${searchTerm}”`}
                message="Try a different name or code."
                className="flex-1"
                secondaryAction={
                  <Button variant="outline" onClick={() => setSearchTerm('')}>
                    Clear search
                  </Button>
                }
              />
            ) : (
              <UserTable
                fillHeight
                isLoading={false}
                users={filteredDegrees}
                columns={degreeColumns}
                actionButtons={degreeActions}
              />
            )}
          </div>
        </>
      )}

      {/* Modals */}
      <DegreeFormModal
        isOpen={showDegreeForm}
        onClose={() => setShowDegreeForm(false)}
        onSuccess={refreshDegrees}
        editingDegree={editingDegree}
      />

      <DepartmentModal
        isOpen={showDepartmentModal}
        onClose={() => setShowDepartmentModal(false)}
        onSuccess={refreshDegrees}
        degreeId={selectedDegreeId}
        editingDepartment={editingDepartment}
      />
    </TabCard>
  );
}
