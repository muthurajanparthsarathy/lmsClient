// AddCourseSettingsPopup/components/Step1BasicConfig.tsx
import React, { useCallback } from 'react';
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Building,
  Layers,
  Box,
  ListTree,
  BookOpen,
  Hash,
  Clock,
  Calendar,
  Info,
  ChevronLeft,
  GraduationCap,
  Briefcase,
  Users,
  Building2,
  Plus,
  X
} from 'lucide-react';
import InfoTooltip from '@/components/ui/reusabletooltip';
import { ValidationMessage } from '../../pages/coursestructure/components/ValidationMessage';
import { FormData, ValidationErrors, Client, Service, Category, CourseClientConfig } from '../../pages/coursestructure/components/types';
 
interface Step1BasicConfigProps {
  formData: FormData;
  setFormData: React.Dispatch<React.SetStateAction<FormData>>;
  validationErrors: ValidationErrors;
  setValidationErrors: React.Dispatch<React.SetStateAction<ValidationErrors>>;
  clientList: Client[];
  isClientsLoading: boolean;
  services: Service[];
  isLoadingServices: boolean;
  filteredServices: Service[];
  selectedService: Service | undefined;
  filteredServiceModels: any[];
  categoriesData: { categories: Category[]; allCategories: Category[] } | undefined;
  isLoadingCategories: boolean;
  availableCourseNames: string[];
  isCustomCourseName: boolean;
  setIsCustomCourseName: (value: boolean) => void;
  customCourseName: string;
  setCustomCourseName: (value: string) => void;
  currentTime: Date;
  totalCourses?: number;
  isEditMode?: boolean;
}
 
export const Step1BasicConfig: React.FC<Step1BasicConfigProps> = ({
  formData,
  setFormData,
  validationErrors,
  setValidationErrors,
  clientList,
  isClientsLoading,
  services,
  filteredServices,
  selectedService,
  filteredServiceModels,
  categoriesData,
  isLoadingCategories,
  availableCourseNames,
  isCustomCourseName,
  setIsCustomCourseName,
  customCourseName,
  setCustomCourseName,
  currentTime
}) => {
  // Helper function to get client name by ID
  const getClientName = useCallback((clientId: string) => {
    const client = clientList.find(c => c._id === clientId);
    return client?.clientCompany || '';
  }, [clientList]);

  // ─── Client Management driven cascade (all options come from the client) ─────
  // Client → Service Type → Service Modal, then (College: Degree → Semester →
  // Departments+Sections) | (Company: Batches). Type is not shown, only used.
  const uniq = (arr: (string | undefined)[]) =>
    Array.from(new Set(arr.filter((v): v is string => !!v)));

  const selectedClientData = clientList.find(c => c._id === formData.client);
  const clientServices = selectedClientData?.services ?? [];

  // What to show is driven by what's actually MAPPED to the client (Client
  // Management no longer stores a client "type"). If any service has degree
  // programs → show the degree-program config; if any has batches → show batches.
  const isDegreeProgram = clientServices.some(s => (s.degreePrograms?.length ?? 0) > 0);
  const isSkilling = clientServices.some(s => (s.batches?.length ?? 0) > 0);

  // Service type = unique service names. A name can span several service
  // entries (e.g. STC has 3 "business to institution" entries), so we aggregate
  // modals / degree programs / batches across ALL entries of that type.
  const clientServiceTypeOptions = uniq(clientServices.map(s => s.service));
  const servicesForType = clientServices.filter(s => s.service === formData.serviceTypeName);

  // Service modal = union of modals across all entries of that service type
  const clientServiceModalOptions = uniq(servicesForType.flatMap(s => s.serviceModals ?? []));

  // Narrow to the chosen modal (if any); otherwise use every entry of that type
  const selectedModal = formData.serviceModelName || '';
  const servicesForModal = selectedModal
    ? servicesForType.filter(s => (s.serviceModals ?? []).includes(selectedModal))
    : servicesForType;

  // Batch blocks across the matching service entries. Each block:
  // { batch, degree, departments: [{ department, sections, semester }] }
  const servicePrograms = servicesForModal.flatMap(s => s.degreePrograms ?? []);
  const clientBatchOptions = uniq(servicePrograms.map(p => p.batch));
  // Company clients: batch-only, from the service's batches
  const companyBatchOptions = uniq(servicesForModal.flatMap(s => s.batches ?? []));

  // Options for a given block's batch/degree
  const degreesForBatch = (batch?: string) =>
    uniq(servicePrograms.filter(p => !batch || p.batch === batch).map(p => p.degree));

  const deptOptionsFor = (batch?: string, degree?: string): { department: string; sections: string[]; semesters: string[] }[] => {
    const map = new Map<string, { sections: Set<string>; semesters: Set<string> }>();
    servicePrograms
      .filter(p => (!batch || p.batch === batch) && p.degree === degree)
      .forEach(p => (p.departments ?? []).forEach(d => {
        const dept = d.department;
        if (!dept) return;
        if (!map.has(dept)) map.set(dept, { sections: new Set(), semesters: new Set() });
        const e = map.get(dept)!;
        (d.sections ?? []).forEach(s => e.sections.add(s));
        (d.semesters ?? []).forEach(s => e.semesters.add(s));
      }));
    return Array.from(map.entries()).map(([department, v]) => ({
      department, sections: Array.from(v.sections), semesters: Array.from(v.semesters),
    }));
  };

  // ─── Multiple client-configuration blocks ───
  // Always work with at least one block for the UI.
  const configs: CourseClientConfig[] = (formData.clientConfigurations && formData.clientConfigurations.length)
    ? formData.clientConfigurations
    : [{ batch: '', degree: '', departmentSections: [] }];

  // Persist the blocks + keep the legacy single fields in sync with block #1
  const commitConfigs = (next: CourseClientConfig[]) => {
    const first = next[0] || { batch: '', degree: '', departmentSections: [] };
    setFormData(prev => ({
      ...prev,
      clientConfigurations: next,
      batch: first.batch || '',
      degree: first.degree || '',
      departmentSections: first.departmentSections || [],
      department: first.departmentSections?.[0]?.department || '',
      sections: Array.from(new Set((first.departmentSections || []).flatMap(d => d.sections))),
      semester: first.departmentSections?.[0]?.semesters?.[0] || '',
    }));
  };

  const updateConfig = (i: number, patch: Partial<CourseClientConfig>) =>
    commitConfigs(configs.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  const addConfig = () =>
    commitConfigs([...configs, { batch: '', degree: '', departmentSections: [] }]);
  const removeConfig = (i: number) =>
    commitConfigs(configs.length <= 1 ? configs : configs.filter((_, idx) => idx !== i));
  const changeConfigBatch = (i: number, batch: string) =>
    commitConfigs(configs.map((c, idx) => (idx === i ? { batch, degree: '', departmentSections: [] } : c)));
  const changeConfigDegree = (i: number, degree: string) =>
    commitConfigs(configs.map((c, idx) => (idx === i ? { ...c, degree, departmentSections: [] } : c)));

  const toggleConfigDept = (i: number, dept: string) =>
    commitConfigs(configs.map((c, idx) => {
      if (idx !== i) return c;
      const list = c.departmentSections || [];
      const exists = list.some(d => d.department === dept);
      return {
        ...c,
        departmentSections: exists
          ? list.filter(d => d.department !== dept)
          : [...list, { department: dept, sections: [], semesters: [] }],
      };
    }));

  // Toggle a semester the course applies to, under a department (from the client's list)
  const toggleConfigSemester = (i: number, dept: string, sem: string) =>
    commitConfigs(configs.map((c, idx) => {
      if (idx !== i) return c;
      return {
        ...c,
        departmentSections: (c.departmentSections || []).map(d => {
          if (d.department !== dept) return d;
          const sems = d.semesters || [];
          return { ...d, semesters: sems.includes(sem) ? sems.filter(s => s !== sem) : [...sems, sem] };
        }),
      };
    }));

  const toggleConfigSection = (i: number, dept: string, sec: string) =>
    commitConfigs(configs.map((c, idx) => {
      if (idx !== i) return c;
      return {
        ...c,
        departmentSections: (c.departmentSections || []).map(d => {
          if (d.department !== dept) return d;
          const has = d.sections.includes(sec);
          return { ...d, sections: has ? d.sections.filter(s => s !== sec) : [...d.sections, sec] };
        }),
      };
    }));
 
  // Helper function to get service name by ID
  const getServiceName = useCallback((serviceId: string) => {
    const service = services.find(s => String(s.id) === String(serviceId));
    return service?.name || '';
  }, [services]);
 
  // Helper function to get service model name by ID
  const getServiceModelName = useCallback((modelId: string) => {
    const model = filteredServiceModels.find(m => String(m.id) === String(modelId));
    if (model?.name) {
      return model.name;
    }
 
    if (selectedService?.serviceModals) {
      const foundModel = selectedService.serviceModals.find(
        m => String(m.id) === String(modelId)
      );
      if (foundModel?.name) {
        return foundModel.name;
      }
    }
 
    for (const service of services) {
      const foundModel = service.serviceModals?.find(
        m => String(m.id) === String(modelId)
      );
      if (foundModel?.name) {
        return foundModel.name;
      }
    }
 
    return '';
  }, [filteredServiceModels, selectedService, services]);
 
  // Helper function to get category name by ID
  const getCategoryName = useCallback((categoryId: string) => {
    const category = categoriesData?.allCategories?.find(c => c._id === categoryId);
    return category?.categoryName || '';
  }, [categoriesData]);

  return (
    <div className="w-full space-y-5 font-sans">
      {/* First Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <SelectField
          label="Course Client"
          icon={Building}
          value={formData.client}
          onValueChange={(value) => {
            // Derive the course's student type from what's mapped to the client
            // so the manage-participants flow routes correctly (degree → hierarchy).
            const picked = clientList.find(c => c._id === value)
            const pickedServices = picked?.services ?? []
            const derivedType: 'degree-program' | 'skilling' | '' =
              pickedServices.some(s => (s.degreePrograms?.length ?? 0) > 0) ? 'degree-program'
                : pickedServices.some(s => (s.batches?.length ?? 0) > 0) ? 'skilling'
                  : ''
            setFormData(prev => ({
              ...prev,
              client: value,
              clientName: getClientName(value),
              // reset the whole client-driven cascade when the client changes
              modal: '',
              serviceTypeName: '',
              duration: '',
              serviceModelName: '',
              studentType: derivedType,
              batch: '',
              skillingBatches: [],
              degree: '',
              department: '',
              semester: '',
              sections: [],
              departmentSections: [],
            }));
            setValidationErrors(prev => ({ ...prev, client: undefined }));
          }}
          placeholder={isClientsLoading ? "Loading clients..." : "Select client"}
          error={validationErrors.client}
          disabled={isClientsLoading}
          options={clientList.map(c => ({
            value: c._id,
            label: c.clientCompany
          }))}
          tooltip="Select the client for this course"
        />
 
        <SelectField
          label="Service Type"
          icon={Layers}
          value={formData.serviceTypeName || ''}
          onValueChange={(value) => {
            setFormData(prev => ({
              ...prev,
              // Client Management stores service by name (no id)
              modal: value,
              serviceTypeName: value,
              duration: '',
              serviceModelName: '',
              courseid: '',
              // reset the client-driven cascade when the service changes
              degree: '',
              semester: '',
              department: '',
              sections: [],
              departmentSections: [],
              batch: '',
              skillingBatches: [],
            }));
            setValidationErrors(prev => ({
              ...prev,
              modal: undefined,
              duration: undefined
            }));
          }}
          placeholder={formData.client ? "Select service type" : "Select client first"}
          error={validationErrors.modal}
          disabled={!formData.client}
          options={clientServiceTypeOptions.map(s => ({ value: s, label: s }))}
          tooltip="Service types configured for the selected client"
        />

        <SelectField
          label="Service Model"
          icon={Box}
          value={formData.serviceModelName || ''}
          onValueChange={(value) => {
            setFormData(prev => ({
              ...prev,
              duration: value,
              serviceModelName: value,
              // the modal narrows the degree/batch data — reset the cascade
              degree: '',
              semester: '',
              department: '',
              sections: [],
              departmentSections: [],
              batch: '',
            }));
            setValidationErrors(prev => ({ ...prev, duration: undefined }));
          }}
          placeholder={formData.serviceTypeName ? "Select service model" : "Select service type first"}
          error={validationErrors.duration}
          disabled={!formData.serviceTypeName}
          options={clientServiceModalOptions.map(m => ({ value: m, label: m }))}
          tooltip="Service modals configured under the selected service type"
        />
      </div>
 
      {/* Second Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <SelectField
          label="Course Category"
          icon={ListTree}
          value={formData.categoryName}
          onValueChange={(value) => {
            setFormData(prev => ({
              ...prev,
              categoryName: value,
              selectedCourseName: '',
              title: '',
              categoryDisplayName: getCategoryName(value)
            }));
            setIsCustomCourseName(false);
            setCustomCourseName('');
            setValidationErrors(prev => ({ ...prev, categoryName: undefined }));
          }}
          placeholder="Select category"
          error={validationErrors.categoryName}
          isLoading={isLoadingCategories}
          options={
            categoriesData?.allCategories?.map(c => ({
              value: c._id,
              label: c.categoryName
            })) || []
          }
          tooltip="Select the category"
        />
 
        <div className="space-y-1.5">
          <LabelWithTooltip
            label="Course Name"
            icon={BookOpen}
            required
            tooltip="Select from available courses or choose 'Others' to enter custom name"
          />
 
          {!isCustomCourseName ? (
            <Select
              value={formData.selectedCourseName}
              onValueChange={(value) => {
                if (value === "others") {
                  setIsCustomCourseName(true);
                  setFormData(prev => ({
                    ...prev,
                    selectedCourseName: '',
                    title: ''
                  }));
                } else {
                  setFormData(prev => ({
                    ...prev,
                    selectedCourseName: value,
                    title: value
                  }));
                }
                setValidationErrors(prev => ({
                  ...prev,
                  selectedCourseName: undefined
                }));
              }}
              disabled={!formData.categoryName}
            >
              <SelectTrigger
                className={`w-full h-9 px-3 text-sm font-medium font-sans bg-white dark:bg-gray-800 text-slate-800 dark:text-gray-200 rounded-lg ${
                  validationErrors.selectedCourseName
                    ? 'border-red-500 dark:border-red-400'
                    : 'border-slate-300 dark:border-gray-700'
                }`}
              >
                <SelectValue
                  placeholder={
                    !formData.categoryName
                      ? "Select category first"
                      : availableCourseNames.length === 0
                      ? "No courses available"
                      : "Select course name"
                  }
                />
              </SelectTrigger>
 
              <SelectContent className="font-sans bg-white dark:bg-gray-800 border-slate-300 dark:border-gray-700 rounded-lg">
                {!formData.categoryName ? (
                  <div className="px-3 py-2 text-sm text-slate-500 dark:text-gray-400 font-medium">
                    Please select a category first
                  </div>
                ) : availableCourseNames.length === 0 ? (
                  <div className="px-3 py-2 text-sm text-slate-500 dark:text-gray-400 font-medium">
                    No courses available for this category
                  </div>
                ) : (
                  <>
                    {availableCourseNames.map(name => (
                      <SelectItem key={name} value={name}>
                        {name}
                      </SelectItem>
                    ))}
                    <div className="border-t border-slate-200 dark:border-gray-700 my-1"></div>
                    <SelectItem
                      value="others"
                      className="font-medium text-blue-600 dark:text-blue-400"
                    >
                      Others (Custom Name)
                    </SelectItem>
                  </>
                )}
              </SelectContent>
            </Select>
          ) : (
            <div className="space-y-2">
              <Input
                type="text"
                placeholder="Enter custom course name"
                value={customCourseName}
                onChange={(e) => {
                  setCustomCourseName(e.target.value);
                  setFormData(prev => ({
                    ...prev,
                    selectedCourseName: e.target.value,
                    title: e.target.value
                  }));
                  setValidationErrors(prev => ({
                    ...prev,
                    selectedCourseName: undefined
                  }));
                }}
                className={`w-full h-9 px-3 text-sm font-medium font-sans bg-white dark:bg-gray-800 rounded-lg ${
                  validationErrors.selectedCourseName
                    ? 'border-red-500'
                    : 'border-slate-300'
                }`}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsCustomCourseName(false);
                  setCustomCourseName('');
                  setFormData(prev => ({
                    ...prev,
                    selectedCourseName: '',
                    title: ''
                  }));
                }}
                className="h-7 px-3 text-xs gap-1"
              >
                <ChevronLeft className="h-3 w-3" /> Back to course list
              </Button>
            </div>
          )}
 
          {validationErrors.selectedCourseName && (
            <ValidationMessage message={validationErrors.selectedCourseName} />
          )}
        </div>
 
        <div className="space-y-1.5">
          <LabelWithTooltip
            label="Course ID"
            icon={Hash}
            required
            tooltip="Auto-generated ID"
          />
          <Input
            type="text"
            value={formData.courseid || ''}
            readOnly
            className="w-full h-9 px-3 text-sm font-medium bg-slate-100 dark:bg-gray-700 cursor-not-allowed rounded-lg font-mono"
          />
 
          {formData.client && formData.serviceTypeName && formData.serviceModelName && !formData.courseid && (
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
              Unable to generate course ID
            </p>
          )}
        </div>
      </div>
 
      {/* ─── Client-based dynamic configuration (shown after a client is chosen) ─── */}
      {formData.client && (
        <div className="bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-xl p-4 shadow-sm space-y-4">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-indigo-500 dark:text-indigo-400" />
            <h4 className="text-sm font-bold text-slate-800 dark:text-gray-200">
              Client Configuration
            </h4>
            <span className="text-xs font-medium text-slate-400 dark:text-gray-500">
              (based on {formData.clientName || 'selected client'})
            </span>
          </div>

          {/* ─── College: multiple client-configuration blocks ─── */}
          {isDegreeProgram && (
            <>
              {servicePrograms.length === 0 && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  {formData.serviceTypeName
                    ? 'This service has no degree program data configured.'
                    : 'Select a service type to load degree programs.'}
                </p>
              )}

              <div className="flex items-center justify-between">
                <LabelWithTooltip
                  label="Client Configurations"
                  icon={Building}
                  required={false}
                  tooltip="A course can serve multiple batch + degree combinations. Add one configuration per batch/degree."
                />
                <button
                  type="button"
                  onClick={addConfig}
                  disabled={!formData.serviceTypeName}
                  className="text-xs font-medium text-indigo-600 hover:text-indigo-800 disabled:text-gray-300 flex items-center gap-1"
                >
                  <Plus className="h-3.5 w-3.5" /> Add configuration
                </button>
              </div>

              {configs.map((cfg, ci) => {
                const degreeOptions = degreesForBatch(cfg.batch);
                const departmentSectionOptions = deptOptionsFor(cfg.batch, cfg.degree);
                const isDeptSelected = (dept: string) => (cfg.departmentSections || []).some(d => d.department === dept);
                const isSectionSelected = (dept: string, sec: string) =>
                  (cfg.departmentSections || []).find(d => d.department === dept)?.sections.includes(sec) ?? false;
                return (
                  <div key={ci} className="rounded-lg border border-slate-200 dark:border-gray-700 bg-slate-50/50 dark:bg-gray-800/40 p-3 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-wide">
                        Configuration {ci + 1}
                      </span>
                      {configs.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeConfig(ci)}
                          className="w-6 h-6 rounded-md border border-slate-200 bg-white flex items-center justify-center text-gray-400 hover:border-red-200 hover:text-red-500 hover:bg-red-50 transition-colors"
                          aria-label="Remove configuration"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>

                    {/* Batch + Degree */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      <SelectField
                        label="Batch"
                        icon={Users}
                        value={cfg.batch || ''}
                        onValueChange={(value) => changeConfigBatch(ci, value)}
                        placeholder={clientBatchOptions.length ? 'Select batch' : 'No batches for this service'}
                        disabled={clientBatchOptions.length === 0}
                        options={clientBatchOptions.map(b => ({ value: b, label: b }))}
                        tooltip="Batches configured for the selected service"
                        required={false}
                      />
                      <SelectField
                        label="Degree"
                        icon={GraduationCap}
                        value={cfg.degree || ''}
                        onValueChange={(value) => changeConfigDegree(ci, value)}
                        placeholder={cfg.batch ? 'Select degree' : 'Select batch first'}
                        disabled={!cfg.batch}
                        options={degreeOptions.map(d => ({ value: d, label: d }))}
                        tooltip="Degrees available for the selected batch"
                        required={false}
                      />
                    </div>

                    {/* Departments & sections (each with its semester) */}
                    <div className="space-y-1.5">
                      <LabelWithTooltip
                        label="Departments & Sections"
                        icon={Building}
                        required={false}
                        tooltip="Tick departments and pick their sections — semester comes per department from the client"
                      />
                      {!cfg.degree ? (
                        <p className="text-xs text-slate-500 dark:text-gray-400">Select a degree first</p>
                      ) : departmentSectionOptions.length === 0 ? (
                        <p className="text-xs text-amber-600 dark:text-amber-400">No departments configured for the selected degree.</p>
                      ) : (
                        <div className="space-y-2">
                          {departmentSectionOptions.map(({ department, sections, semesters }) => {
                            const deptChecked = isDeptSelected(department);
                            const selDept = (cfg.departmentSections || []).find(d => d.department === department);
                            return (
                              <div key={department} className="rounded-lg border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2">
                                <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-gray-200 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={deptChecked}
                                    onChange={() => toggleConfigDept(ci, department)}
                                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 accent-blue-600"
                                  />
                                  {department}
                                </label>
                                {deptChecked && (
                                  <div className="mt-2 pl-6 space-y-2">
                                    {/* Sections */}
                                    <div className="flex flex-wrap gap-2 items-center">
                                      <span className="text-[10px] text-slate-400">Sections</span>
                                      {sections.length === 0 ? (
                                        <span className="text-xs text-slate-400">None configured</span>
                                      ) : (
                                        sections.map((sec) => {
                                          const secChecked = isSectionSelected(department, sec);
                                          return (
                                            <label
                                              key={sec}
                                              className={`flex items-center gap-1.5 px-2.5 h-8 rounded-lg border cursor-pointer text-xs font-medium select-none transition-colors ${
                                                secChecked
                                                  ? 'border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-400 dark:bg-blue-900/20 dark:text-blue-300'
                                                  : 'border-slate-300 bg-white text-slate-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 hover:border-slate-400'
                                              }`}
                                            >
                                              <input
                                                type="checkbox"
                                                checked={secChecked}
                                                onChange={() => toggleConfigSection(ci, department, sec)}
                                                className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 accent-blue-600"
                                              />
                                              {sec}
                                            </label>
                                          );
                                        })
                                      )}
                                    </div>
                                    {/* Semesters — choose which of the client's semesters apply */}
                                    <div className="flex flex-wrap gap-2 items-center">
                                      <span className="text-[10px] text-slate-400">Semesters</span>
                                      {semesters.length === 0 ? (
                                        <span className="text-xs text-slate-400">None configured</span>
                                      ) : (
                                        semesters.map((sem) => {
                                          const semChecked = (selDept?.semesters || []).includes(sem);
                                          return (
                                            <label
                                              key={sem}
                                              className={`flex items-center gap-1.5 px-2.5 h-8 rounded-lg border cursor-pointer text-xs font-medium select-none transition-colors ${
                                                semChecked
                                                  ? 'border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-400 dark:bg-blue-900/20 dark:text-blue-300'
                                                  : 'border-slate-300 bg-white text-slate-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 hover:border-slate-400'
                                              }`}
                                            >
                                              <input
                                                type="checkbox"
                                                checked={semChecked}
                                                onChange={() => toggleConfigSemester(ci, department, sem)}
                                                className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 accent-blue-600"
                                              />
                                              Sem {sem}
                                            </label>
                                          );
                                        })
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </>
          )}

          {/* ─── Company: multi-select batches (checkboxes) ─── */}
          {isSkilling && (
            <div className="space-y-1.5">
              <LabelWithTooltip
                label="Batch"
                icon={Users}
                required={false}
                tooltip="Select one or more batches configured for this client"
              />
              {companyBatchOptions.length === 0 ? (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  {formData.serviceTypeName ? 'This service has no batches configured.' : 'Select a service type first.'}
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {companyBatchOptions.map((b) => {
                    const checked = (formData.skillingBatches || []).includes(b);
                    return (
                      <label
                        key={b}
                        className={`flex items-center gap-2 px-3 h-9 rounded-lg border cursor-pointer text-sm font-medium select-none transition-colors ${
                          checked
                            ? 'border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-400 dark:bg-blue-900/20 dark:text-blue-300'
                            : 'border-slate-300 bg-white text-slate-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 hover:border-slate-400'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {
                            setFormData(prev => {
                              const current = prev.skillingBatches || [];
                              const next = current.includes(b)
                                ? current.filter(x => x !== b)
                                : [...current, b];
                              return { ...prev, skillingBatches: next };
                            });
                          }}
                          className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 accent-blue-600"
                        />
                        {b}
                      </label>
                    );
                  })}
                </div>
              )}
              {(formData.skillingBatches?.length || 0) > 0 && (
                <p className="text-xs text-slate-500 dark:text-gray-400">
                  {formData.skillingBatches!.length} batch
                  {formData.skillingBatches!.length > 1 ? 'es' : ''} selected
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* DateTime Section */}
      <div className="bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-xl p-4 shadow-sm">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label className="text-sm font-semibold text-slate-700 dark:text-gray-300 flex items-center gap-1">
              <Clock className="h-4 w-4 text-green-500 dark:text-green-400" />
              Current Date & Time
            </Label>
            <div className="flex items-center gap-2 bg-white dark:bg-gray-800 border border-slate-300 dark:border-gray-700 rounded-lg px-3 py-2">
              <Calendar className="h-4 w-4 text-slate-500 dark:text-gray-400" />
              <input
                type="text"
                readOnly
                value={currentTime.toLocaleString()}
                className="flex-1 text-sm font-medium text-slate-800 dark:text-gray-200 bg-transparent outline-none"
              />
            </div>
          </div>
        </div>
      </div>
 
      {/* Info Alert */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500 dark:border-blue-400 p-3 rounded-r-lg flex items-start gap-2">
        <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
        <div>
          <h4 className="text-sm font-bold text-blue-900 dark:text-blue-300">
            Course Setup
          </h4>
          <p className="text-xs font-medium text-blue-700 dark:text-blue-300 mt-0.5">
            Fill all required fields marked with{' '}
            <span className="text-red-500 dark:text-red-400 font-semibold">*</span> to continue
          </p>
        </div>
      </div>
    </div>
  );
};
 
// Helper sub-components
const LabelWithTooltip: React.FC<{
  label: string;
  icon: any;
  required?: boolean;
  tooltip: string;
}> = ({ label, icon: Icon, required, tooltip }) => (
  <div className="flex items-center gap-1.5">
    <Label className="text-sm font-semibold text-slate-700 dark:text-gray-300 flex items-center gap-1 font-sans">
      <Icon className="h-4 w-4 text-blue-500 dark:text-blue-400" />
      {label} {required && <span className="text-red-500 dark:text-red-400">*</span>}
    </Label>
    <InfoTooltip content={tooltip} />
  </div>
);
 
const SelectField: React.FC<{
  label: string;
  icon: any;
  value: string;
  onValueChange: (value: string) => void;
  placeholder: string;
  error?: string;
  disabled?: boolean;
  isLoading?: boolean;
  options: Array<{ value: string; label: string }>;
  tooltip: string;
  required?: boolean;
}> = ({
  label,
  icon,
  value,
  onValueChange,
  placeholder,
  error,
  disabled,
  isLoading,
  options,
  tooltip,
  required = true
}) => (
  <div className="space-y-1.5">
    <LabelWithTooltip label={label} icon={icon} required={required} tooltip={tooltip} />
    <Select value={value} onValueChange={onValueChange} disabled={disabled}>
      <SelectTrigger
        className={`w-full h-9 px-3 text-sm font-medium font-sans bg-white dark:bg-gray-800 rounded-lg ${
          error ? 'border-red-500 dark:border-red-400' : 'border-slate-300 dark:border-gray-700'
        }`}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className="font-sans bg-white dark:bg-gray-800 border-slate-300 dark:border-gray-700 rounded-lg">
        {isLoading ? (
          <div className="px-3 py-2 text-sm text-slate-500 dark:text-gray-400">
            Loading...
          </div>
        ) : options.length === 0 ? (
          <div className="px-3 py-2 text-sm text-slate-500 dark:text-gray-400">
            No options available
          </div>
        ) : (
          options.map(opt => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))
        )}
      </SelectContent>
    </Select>
    {error && <ValidationMessage message={error} />}
  </div>
);
 