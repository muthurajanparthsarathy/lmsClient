"use client";
import { useRef, useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Check, Loader2, Send, Upload, Trash2, UserPlus, GraduationCap, ShieldCheck, ChevronDown, BookOpen, Building, Users, Briefcase, Building2, Layers, X } from "lucide-react";
import { toast } from "sonner";
import { User, Role, UserFormData, ApiPermission } from "./types";
import { PermissionModal } from "@/app/lms/component/PermissionModal";
import { BulkPermissionModal } from "@/app/lms/component/BulkPermissionModal";
import BulkUploadModal from "@/app/lms/component/BulkUploadModal";
import { type ServiceMapping, type MasterDataEntry } from "@/apiServices/serviceMappingService";
import { type Degree } from "@/apiServices/dynamicFields/degreeService";
import { useClientsQuery, useDegreesQuery, useServiceMappingsQuery } from "@/queries/referenceData";
import { queryKeys } from "@/lib/queryKeys";
import { StatusPill } from "../../../shared/ui";
import { roleTone } from "./permissions";
import { UserAvatar } from "./UserAvatar";

// ─── Service-mapping hierarchy config (mirrors the Service Mapping wizard) ─────
// Top → bottom order the cascade is rendered/validated in. A parent always
// precedes its children so child options can depend on the chosen parent.
const LEVEL_ORDER = ['Batch', 'Degree', 'Department', 'Semester', 'Section', 'Phase'];

// Which UserFormData field stores each level's chosen value.
const LEVEL_FIELD: Record<string, string> = {
  Batch: 'batch',
  Degree: 'degree',
  Department: 'department',
  Semester: 'semester',
  Section: 'section',
  Phase: 'phase',
};

// Separator used by Service Mapping for composite group keys ("Degree ▸ Department").
// Must match PATH_SEP in the Service Mapping wizard so section/phase lookups line up.
const HIERARCHY_PATH_SEP = ' ▸ ';

// ─── FieldKit-aligned control recipes (tokens only) ───────────────────────────
// Compact sizing — h-9 (36px) inputs, xs labels, tighter padding. Tightened
// from h-10 / text-sm to bring the whole form under viewport height so the
// modal no longer needs its inner scroll for typical role states.
const LABEL_CLS = "mb-1 block text-xs font-medium text-body";
const INPUT_CLS =
  "h-9 w-full rounded-control border border-hairline-strong bg-surface px-2.5 text-sm text-body " +
  "placeholder:text-faint transition-colors hover:border-line-hover focus:border-brand focus:outline-none " +
  "focus:ring-2 focus:ring-brand/15 disabled:cursor-not-allowed disabled:bg-ink-50 disabled:text-subtle";
const DROPDOWN_TRIGGER_CLS =
  "h-9 w-full flex items-center justify-between gap-2 rounded-control border border-hairline-strong " +
  "bg-surface px-2.5 text-sm transition-colors hover:border-line-hover focus:border-brand focus:outline-none " +
  "focus:ring-2 focus:ring-brand/15 disabled:cursor-not-allowed disabled:bg-ink-50 disabled:text-subtle";
const DROPDOWN_MENU_CLS =
  "absolute z-dropdown mt-1.5 w-full max-h-60 overflow-y-auto rounded-tile border border-hairline bg-surface shadow-lg p-1";
const DROPDOWN_ITEM_CLS =
  "flex items-center gap-2 rounded-chip px-2.5 py-2 text-sm cursor-pointer transition-colors duration-150";

interface UserModalsProps {
  institutionId: string | null;
  showAddUserModal: boolean;
  setShowAddUserModal: (show: boolean) => void;
  showSuccessModal: boolean;
  setShowSuccessModal: (show: boolean) => void;
  showDeleteModal: boolean;
  setShowDeleteModal: (show: boolean) => void;
  showPermissionModal: boolean;
  setShowPermissionModal: (show: boolean) => void;
  showBulkUploadModal: boolean;
  setShowBulkUploadModal: (show: boolean) => void;
  showBulkPermissionModal: boolean;
  setShowBulkPermissionModal: (show: boolean) => void;
  showViewDetailsModal: boolean;
  setShowViewDetailsModal: (show: boolean) => void;
  newUser: UserFormData;
  setNewUser: (user: UserFormData) => void;
  newUserId: string;
  userToDelete: User | null;
  selectedUserForPermission: User | null;
  setSelectedUserForPermission: (user: User | null) => void;
  selectedUserForDetails: User | null;
  setSelectedUserForDetails: (user: User | null) => void;
  selectedUserForBulkPermissions: User | null;
  setSelectedUserForBulkPermissions: (user: User | null) => void;
  roles: Role[];
  isLoadingRoles: boolean;
  basedOn: string | null;
  userPermissions: ApiPermission[];
  allUsers: User[];
  onAddUserSubmit: (e: React.FormEvent) => Promise<void>;
  onConfirmDelete: () => void;
  onConfigurePermissions: () => void;
  isDeleting: boolean;
  isEditing: boolean;
  canBulkUpload: boolean;
  canBulkPermission: boolean;
  isSubmitting?: boolean;
  onSubmitSuccess?: () => void;
}

// Client type (from Client Management). Only identity/type is needed now — the
// hierarchy comes from Service Mapping, not the embedded client.services array.
interface Client {
  _id: string;
  clientCompany: string;
  description?: string;
  status?: string;
  type?: ('college' | 'company')[];
}

export const UserModals: React.FC<UserModalsProps> = ({
  institutionId,
  showAddUserModal, setShowAddUserModal,
  showSuccessModal, setShowSuccessModal,
  showDeleteModal, setShowDeleteModal,
  showPermissionModal, setShowPermissionModal,
  showBulkUploadModal, setShowBulkUploadModal,
  showBulkPermissionModal, setShowBulkPermissionModal,
  showViewDetailsModal, setShowViewDetailsModal,
  newUser, setNewUser, newUserId, userToDelete,
  selectedUserForPermission, setSelectedUserForPermission,
  selectedUserForDetails, setSelectedUserForDetails,
  selectedUserForBulkPermissions, setSelectedUserForBulkPermissions,
  roles, isLoadingRoles, basedOn, userPermissions, allUsers,
  onAddUserSubmit, onConfirmDelete, onConfigurePermissions,
  isDeleting, isEditing, canBulkUpload, canBulkPermission,
  isSubmitting = false,
  onSubmitSuccess,
}) => {
  const queryClient = useQueryClient();

  const [isRoleDropdownOpen, setIsRoleDropdownOpen] = useState(false);
  const [isGenderDropdownOpen, setIsGenderDropdownOpen] = useState(false);
  const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false);
  const [isDegreeDropdownOpen, setIsDegreeDropdownOpen] = useState(false);
  const [isDepartmentDropdownOpen, setIsDepartmentDropdownOpen] = useState(false);
  const [isSemesterDropdownOpen, setIsSemesterDropdownOpen] = useState(false);
  const [isSectionDropdownOpen, setIsSectionDropdownOpen] = useState(false);
  const [isBatchDropdownOpen, setIsBatchDropdownOpen] = useState(false);
  const [isYearDropdownOpen, setIsYearDropdownOpen] = useState(false);
  const [isStudentTypeDropdownOpen, setIsStudentTypeDropdownOpen] = useState(false);
  const [isClientDropdownOpen, setIsClientDropdownOpen] = useState(false);
  const [isServiceModelDropdownOpen, setIsServiceModelDropdownOpen] = useState(false);
  // Which specific mapping the "Service Model" pick resolved to — a client can have
  // several services sharing a model name (multiple degree programs), so the pick is
  // tracked by mapping id, not by the (ambiguous) model name.
  const [selectedMappingId, setSelectedMappingId] = useState<string>('');
  const [isPhaseDropdownOpen, setIsPhaseDropdownOpen] = useState(false);

  // Reference data (clients / service mappings / degrees) — shared cache
  // entries (src/queries/referenceData.ts), loaded once the Add/Edit modal
  // opens and reused across BulkUserModal + reopenings. Previously each open
  // re-fetched all three into local state.
  const { data: clientsData, isLoading: isLoadingClients } = useClientsQuery(showAddUserModal);
  const { data: mappingsData, isLoading: isLoadingMappings } = useServiceMappingsQuery(showAddUserModal);
  const { data: degreesData } = useDegreesQuery(showAddUserModal);
  const clients = (clientsData ?? []) as Client[];
  const mappings = (mappingsData ?? []) as ServiceMapping[];
  const degreesList = (degreesData ?? []) as Degree[];

  const roleDropdownRef = useRef<HTMLDivElement>(null);
  const genderDropdownRef = useRef<HTMLDivElement>(null);
  const statusDropdownRef = useRef<HTMLDivElement>(null);
  const degreeDropdownRef = useRef<HTMLDivElement>(null);
  const departmentDropdownRef = useRef<HTMLDivElement>(null);
  const semesterDropdownRef = useRef<HTMLDivElement>(null);
  const sectionDropdownRef = useRef<HTMLDivElement>(null);
  const batchDropdownRef = useRef<HTMLDivElement>(null);
  const yearDropdownRef = useRef<HTMLDivElement>(null);
  const studentTypeDropdownRef = useRef<HTMLDivElement>(null);
  const clientDropdownRef = useRef<HTMLDivElement>(null);
  const serviceModelDropdownRef = useRef<HTMLDivElement>(null);
  const phaseDropdownRef = useRef<HTMLDivElement>(null);

  // ─── Service-mapping-driven cascade ──────────────────────────────────────────
  // The whole structure comes from Service Mapping: pick a client → a service model
  // → the hierarchy levels + values that mapping configured. Every enabled level is
  // required, filled top → bottom, with each child's options scoped to the chosen
  // parent (departments per degree, sections per degree▸department, and so on).

  const uniq = (arr: (string | undefined)[]) =>
    Array.from(new Set(arr.filter((v): v is string => !!v)));

  // Resolve by id (new) or by name (editing an existing user, where only the name is stored)
  const selectedClient =
    clients.find(c => c._id === newUser.clientId) ||
    clients.find(c => c.clientCompany === newUser.clientName);
  const selectedClientId = selectedClient?._id;

  // Client type — kept only for the small "College / Company" indicator chip.
  const isCollegeClient = !!selectedClient?.type?.includes('college');
  const isCompanyClient = !!selectedClient?.type?.includes('company');

  const clientIdOf = (m: ServiceMapping) =>
    typeof m.client === 'string' ? m.client : m.client?._id;

  // Every mapping configured for the selected client.
  const clientMappings = selectedClientId
    ? mappings.filter(m => clientIdOf(m) === selectedClientId)
    : [];

  // One option PER mapping — a client (e.g. Karpagam) can have several degree-program
  // services that all share the model name "Degree Program", so they must NOT
  // collapse. Each is labelled with its degree and its service id (in brackets) to
  // tell them apart; the specific mapping is tracked by id (selectedMappingId), while
  // newUser.serviceModel keeps the plain model name for saving/display.
  const modelNameOf = (m: ServiceMapping): string =>
    (m.serviceModels?.length ? m.serviceModels[0] : m.service) || 'Service';
  const degreeOf = (m: ServiceMapping): string =>
    (m.masterData || []).find(e => e.level === 'Degree')?.values?.[0] || '';
  const serviceLabelOf = (m: ServiceMapping): string =>
    `${modelNameOf(m)}${degreeOf(m) ? ` · ${degreeOf(m)}` : ''} (${m.serviceCode || '—'})`;

  const serviceModelOptions = clientMappings.map(serviceLabelOf);

  // The mapping behind the chosen service — by id when picked here, else matched by
  // model name (+ the user's degree) so editing an existing student still resolves.
  const selectedMapping =
    clientMappings.find(m => m._id === selectedMappingId) ||
    clientMappings.find(m =>
      (modelNameOf(m) === newUser.serviceModel || (m.serviceModels || []).includes(newUser.serviceModel || '')) &&
      (!newUser.degree ||
        (m.masterData || []).some(e => e.level === 'Degree' && (e.values || []).includes(newUser.degree || '')))
    ) || null;

  const selectedServiceLabel = selectedMapping ? serviceLabelOf(selectedMapping) : (newUser.serviceModel || '');

  // Master-data lookups — values come straight from the mapping.
  const md: MasterDataEntry[] = selectedMapping?.masterData || [];

  // Whether the mapping actually configured any value for a level. A level can be
  // flagged enabled but hold no values (e.g. a stale Phase toggle); such levels
  // must NOT appear in Add User.
  const hasConfiguredValues = (lvl: string): boolean =>
    md.some(e => e.level === lvl && (e.values?.length ?? 0) > 0);

  // Sem 1..N derived from the degree's semester count in Degree Management.
  const semestersFromDegree = (degreeName: string): string[] => {
    const deg = degreesList.find(d => d.degreeName === degreeName);
    const n = deg?.numberOfSemesters || 0;
    return Array.from({ length: n }, (_, i) => String(i + 1));
  };

  // Enabled hierarchy levels for the chosen mapping, ordered top → bottom. Only
  // levels that are both enabled AND actually configured with values are shown —
  // except Semester, which is always derivable from the degree's length.
  //
  // Degree flow: a student is placed by degree ▸ department ▸ section (section
  // only when the service enables it). Placement Training: placed by PHASE, and
  // a phase IS a course (its name is the course name), so picking a phase picks
  // the course. Phase is gated the same way as the others — it shows ONLY when
  // the mapping has Phase enabled with values, so a phase-less placement asks
  // nothing beyond client + service model, while a phased one asks which phase.
  // Batch and Semester remain intentionally uncollected.
  const ENROLL_LEVELS = ['Degree', 'Department', 'Section', 'Phase'];
  const enabledLevels: string[] = selectedMapping
    ? LEVEL_ORDER.filter(l =>
        ENROLL_LEVELS.includes(l) &&
        selectedMapping.hierarchy?.some(h => h.level === l && h.enabled) &&
        hasConfiguredValues(l)
      )
    : [];

  const flatVals = (lvl: string): string[] => {
    const noGroup = md.filter(e => e.level === lvl && !e.group).flatMap(e => e.values || []);
    if (noGroup.length) return uniq(noGroup);
    return uniq(md.filter(e => e.level === lvl).flatMap(e => e.values || []));
  };
  const groupVals = (lvl: string, group: string): string[] =>
    uniq(md.filter(e => e.level === lvl && e.group === group).flatMap(e => e.values || []));

  // Options for a level given the choices already made above it.
  const optionsForLevel = (level: string): string[] => {
    if (!selectedMapping) return [];
    let out: string[] = [];
    switch (level) {
      case 'Batch': out = flatVals('Batch'); break;
      case 'Degree': out = flatVals('Degree'); break;
      case 'Department':
        out = newUser.degree ? groupVals('Department', newUser.degree) : flatVals('Department');
        break;
      case 'Semester': {
        // Prefer the mapping's saved semesters; otherwise derive sem 1..N from the
        // selected degree's length (Degree Management).
        const saved = newUser.degree ? groupVals('Semester', newUser.degree) : flatVals('Semester');
        out = saved.length ? saved : (newUser.degree ? semestersFromDegree(newUser.degree) : []);
        break;
      }
      case 'Section': {
        // Prefer the sections that actually RUN COURSES for this degree ▸
        // department, read from the mapping's own course paths
        // ("BE ▸ IT ▸ a ▸ 1"). Master data is a superset: a section can be
        // created in the wizard and then never given a course, and offering it
        // here would enrol a student into a section with nothing to study.
        //
        // Real example this fixes: b2i-deg-be-4 stores
        //   Section group="BE ▸ IT"         values=["a","b"]
        //   Section group="BE ▸ Mechanical" values=["a","b"]
        // but only Mechanical ▸ a has any courses, which is exactly why the
        // hierarchy screen lists one section for Mechanical and two for IT.
        // This makes the dropdown agree with that screen.
        //
        // Splitting the path is safe HERE specifically because the wizard strips
        // PATH_SEP out of section names on entry, so a segment can never contain
        // the separator. Do not copy this parse to paths built elsewhere.
        if (newUser.degree && newUser.department) {
          const prefix = `${newUser.degree}${HIERARCHY_PATH_SEP}${newUser.department}${HIERARCHY_PATH_SEP}`;
          const fromCourses = uniq(
            ((selectedMapping?.courses || []) as { path?: string }[])
              .map(c => String(c?.path || ''))
              .filter(p => p.startsWith(prefix))
              .map(p => p.slice(prefix.length).split(HIERARCHY_PATH_SEP)[0].trim())
              .filter(Boolean)
          );
          if (fromCourses.length) { out = fromCourses; break; }

          // No courses laid out yet — fall back to what the wizard configured.
          const composite = groupVals('Section', `${newUser.degree}${HIERARCHY_PATH_SEP}${newUser.department}`);
          if (composite.length) { out = composite; break; }
        }
        out = newUser.department ? groupVals('Section', newUser.department) : flatVals('Section');
        break;
      }
      case 'Phase': {
        const degreeBased = enabledLevels.includes('Degree');
        if (degreeBased && newUser.degree && newUser.department) {
          const c = groupVals('Phase', `${newUser.degree}${HIERARCHY_PATH_SEP}${newUser.department}`);
          if (c.length) { out = c; break; }
        }
        out = newUser.batch ? groupVals('Phase', newUser.batch) : flatVals('Phase');
        break;
      }
      default: out = flatVals(level);
    }
    // Keep the currently-saved value selectable when editing legacy data.
    const cur = (newUser as unknown as Record<string, string>)[LEVEL_FIELD[level]];
    if (cur && !out.includes(cur)) out = [cur, ...out];
    return out;
  };

  // Set a level's value and clear every deeper level so stale children don't linger.
  const setLevelValue = (level: string, value: string) => {
    const idx = LEVEL_ORDER.indexOf(level);
    const patch: Record<string, string> = { [LEVEL_FIELD[level]]: value };
    LEVEL_ORDER.slice(idx + 1).forEach(l => { patch[LEVEL_FIELD[l]] = ''; });
    setNewUser({ ...newUser, ...patch });
  };

  const handleClickOutside = (event: MouseEvent) => {
    const dropdowns = [
      { ref: roleDropdownRef, setter: setIsRoleDropdownOpen },
      { ref: genderDropdownRef, setter: setIsGenderDropdownOpen },
      { ref: statusDropdownRef, setter: setIsStatusDropdownOpen },
      { ref: degreeDropdownRef, setter: setIsDegreeDropdownOpen },
      { ref: departmentDropdownRef, setter: setIsDepartmentDropdownOpen },
      { ref: semesterDropdownRef, setter: setIsSemesterDropdownOpen },
      { ref: sectionDropdownRef, setter: setIsSectionDropdownOpen },
      { ref: batchDropdownRef, setter: setIsBatchDropdownOpen },
      { ref: yearDropdownRef, setter: setIsYearDropdownOpen },
      { ref: studentTypeDropdownRef, setter: setIsStudentTypeDropdownOpen },
      { ref: clientDropdownRef, setter: setIsClientDropdownOpen },
      { ref: serviceModelDropdownRef, setter: setIsServiceModelDropdownOpen },
      { ref: phaseDropdownRef, setter: setIsPhaseDropdownOpen },
    ];
    dropdowns.forEach(({ ref, setter }) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setter(false);
    });
  };

  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setNewUser({ ...newUser, [name]: value });
  };

  // Helper function to check if selected role is student
  const isStudentRole = () => {
    const selectedRole = roles.find(role => role._id === newUser.roleId);
    if (!selectedRole) return false;
    const roleName = selectedRole.renameRole?.toLowerCase() || '';
    const originalRole = selectedRole.originalRole?.toLowerCase() || '';
    return roleName.includes('student') || originalRole.includes('student');
  };

  // The service model + degree ▸ department ▸ section cascade below is shown for
  // students only. Degree + department are REQUIRED when the chosen service is a
  // "degree program" (its mapping enables those levels); section + roll number stay
  // optional, and non-student roles force nothing.
  const isStudent = isStudentRole();
  const requiredLevels = isStudent
    ? (['Degree', 'Department'] as string[]).filter(l => enabledLevels.includes(l))
    : [];
  const missingRequired = requiredLevels.filter(
    l => !((newUser as unknown as Record<string, string>)[LEVEL_FIELD[l]] || '').trim()
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUser.roleId) { toast.error("Please select a role"); return; }
    // Degree + department are required for a student on a degree-program service.
    // Everything else — section, roll number, and all fields for non-students — is
    // optional. A filled client / service / hierarchy still feeds auto-enrolment.
    if (missingRequired.length > 0) {
      toast.error(`${missingRequired[0]} is required for a student on a degree program`);
      return;
    }
    try {
      await onAddUserSubmit(e);
      if (onSubmitSuccess) {
        onSubmitSuccess();
      }
    } catch (error) {
      console.error('Error submitting user:', error);
    }
  };

  const renderDropdown = (label: React.ReactNode, icon: React.ReactNode, value: string, options: string[], isOpen: boolean, setIsOpen: (open: boolean) => void, onChange: (value: string) => void, ref: React.RefObject<HTMLDivElement | null>, placeholder: string, isLoading?: boolean) => (
    <div ref={ref}>
      <Label className={LABEL_CLS}>{label}</Label>
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          disabled={isSubmitting || isLoading}
          className={DROPDOWN_TRIGGER_CLS}
        >
          <span className="flex items-center gap-2 min-w-0 flex-1">
            {icon}
            <span className={`flex-1 text-left truncate ${value ? "text-body" : "text-faint"}`}>{value || placeholder}</span>
          </span>
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin text-faint" />
          ) : (
            <ChevronDown className={`h-4 w-4 text-faint transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          )}
        </button>
        {isOpen && !isLoading && (
          <div className={DROPDOWN_MENU_CLS}>
            {options.length === 0 ? (
              <div className="px-3 py-2.5 text-xs text-subtle text-center">No options available</div>
            ) : (
              options.map(option => (
                <div
                  key={option}
                  className={`${DROPDOWN_ITEM_CLS} ${value === option ? 'bg-brand-wash text-heading' : 'text-body hover:bg-row-hover'}`}
                  onClick={() => { onChange(option); setIsOpen(false); }}
                >
                  {icon}
                  <span className="flex-1 truncate">{option}</span>
                  {value === option && <Check className="h-4 w-4 text-brand-strong" />}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );

  // Per-level UI wiring for the dynamic hierarchy cascade.
  const levelDropdownState: Record<string, { open: boolean; setOpen: (o: boolean) => void; ref: React.RefObject<HTMLDivElement | null> }> = {
    Batch: { open: isBatchDropdownOpen, setOpen: setIsBatchDropdownOpen, ref: batchDropdownRef },
    Degree: { open: isDegreeDropdownOpen, setOpen: setIsDegreeDropdownOpen, ref: degreeDropdownRef },
    Department: { open: isDepartmentDropdownOpen, setOpen: setIsDepartmentDropdownOpen, ref: departmentDropdownRef },
    Semester: { open: isSemesterDropdownOpen, setOpen: setIsSemesterDropdownOpen, ref: semesterDropdownRef },
    Section: { open: isSectionDropdownOpen, setOpen: setIsSectionDropdownOpen, ref: sectionDropdownRef },
    Phase: { open: isPhaseDropdownOpen, setOpen: setIsPhaseDropdownOpen, ref: phaseDropdownRef },
  };
  const LEVEL_ICONS: Record<string, React.ReactNode> = {
    Batch: <Users className="h-4 w-4 text-subtle" />,
    Degree: <GraduationCap className="h-4 w-4 text-subtle" />,
    Department: <Building className="h-4 w-4 text-subtle" />,
    Semester: <BookOpen className="h-4 w-4 text-subtle" />,
    Section: <Layers className="h-4 w-4 text-subtle" />,
    Phase: <Briefcase className="h-4 w-4 text-subtle" />,
  };

  return (
    <>
      {/* Add/Edit User Modal — refactored to a larger centred rounded
          dialog per the reference layout: wider max-w, generous rounding,
          split header/body/footer with clear dividers, and a bordered
          inner card wrapping the form. Fields, labels, dropdowns, and
          handlers are untouched — only the surrounding shell changed. */}
      <Dialog open={showAddUserModal} onOpenChange={(open) => { if (!open) setShowAddUserModal(false); }}>
        {/* Fixed height + matching width — Create User and Bulk Upload
            modals now open at the exact same footprint (820 × 85vh) so
            toggling between them doesn't feel like the modal is jumping
            in size. Body flex-1 handles scroll when the form exceeds
            the reserved height. */}
        <DialogContent
          className="w-[calc(100vw-32px)] sm:max-w-[820px] h-[85vh] flex flex-col gap-0 p-0 overflow-hidden rounded-2xl shadow-2xl bg-surface"
          showCloseButton={false}
          // A part-filled account form is easy to lose to a stray backdrop
          // click, so only the header X / Cancel close it. (Bulk-parity
          // hardening from the 24-8 delivery.)
          onInteractOutside={(e) => e.preventDefault()}
        >
          {/* Header — compact: smaller vertical padding and a base-sized
              title so the header eats less of the viewport. Built-in
              Radix close is disabled above; we render our own pill-shaped
              close-in-a-circle to match the reference. */}
          <DialogHeader className="px-5 pt-4 pb-2.5">
            <DialogTitle className="text-base font-semibold text-heading text-left">
              {isEditing ? "Edit user" : "Create new user"}
            </DialogTitle>
            {/* Circled X — subtle grey ring around the icon, matches the
                reference's pill-shaped close control. Positioned top-right
                via absolute so header padding stays clean. */}
            <DialogClose
              aria-label="Close"
              className="absolute top-3.5 right-4 inline-flex h-8 w-8 items-center justify-center rounded-full border border-hairline-strong bg-surface text-subtle transition-colors hover:bg-row-hover hover:text-heading focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/30 disabled:pointer-events-none"
            >
              <X className="h-3.5 w-3.5" />
            </DialogClose>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-5 pb-4 pt-1">
            {/* Single bordered card wrapping the whole form — matches the
                reference's nested container. Grey wash under the card was
                removed so the modal and the card share one clean surface
                instead of a fighting double-tone. */}
            {/* Compact inner card — reduced padding + section spacing so
                the whole form fits without inner scroll for common role
                states (only student-on-degree-program still overflows). */}
            <div className="rounded-2xl border border-hairline bg-surface p-4">
              <form onSubmit={handleSubmit} className="space-y-3.5">
                <div className="space-y-2.5">

                {/* Role + Client — paired in a 2-col grid when the role is
                    a student (Client is required in that state, so both
                    dropdowns are always shown together). Role stretches
                    full-width when no Client sibling is present, so
                    non-student roles still get a wide dropdown for names
                    like "L&D Manager" and "POC" that need the room. */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3.5 gap-y-2.5">
                <div ref={roleDropdownRef} className={isStudent ? '' : 'sm:col-span-2'}>
                  <Label className={LABEL_CLS}>Role Assignment <span className="text-brand-strong">*</span></Label>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setIsRoleDropdownOpen(!isRoleDropdownOpen)}
                      disabled={isSubmitting}
                      className={DROPDOWN_TRIGGER_CLS}
                    >
                      <span className="flex items-center gap-2 min-w-0 flex-1">
                        <ShieldCheck className="h-4 w-4 text-subtle" />
                        <span className={`flex-1 text-left truncate ${newUser.roleId ? "text-body" : "text-faint"}`}>
                          {roles.find(role => role._id === newUser.roleId)?.renameRole || "Select Role"}
                        </span>
                      </span>
                      <ChevronDown className={`h-4 w-4 text-faint transition-transform ${isRoleDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>
                    {isRoleDropdownOpen && (
                      <div className={DROPDOWN_MENU_CLS}>
                        {isLoadingRoles ? (
                          <div className="flex items-center justify-center py-2.5 px-3"><Loader2 className="h-4 w-4 animate-spin text-subtle" /><span className="ml-2 text-xs text-subtle">Loading roles...</span></div>
                        ) : roles.length > 0 ? (
                          roles.map(role => (
                            <div key={role._id} className={`${DROPDOWN_ITEM_CLS} ${newUser.roleId === role._id ? 'bg-brand-wash text-heading' : 'text-body hover:bg-row-hover'}`} onClick={() => {
                                // Client + its cascade belong to students only — clear
                                // them when switching to any non-student role.
                                const nextIsStudent =
                                  (role.renameRole?.toLowerCase() || '').includes('student') ||
                                  (role.originalRole?.toLowerCase() || '').includes('student');
                                if (!nextIsStudent) setSelectedMappingId('');
                                setNewUser({
                                  ...newUser,
                                  roleId: role._id,
                                  role: role.renameRole,
                                  ...(nextIsStudent ? {} : {
                                    clientName: '',
                                    clientId: '',
                                    studentType: undefined,
                                    serviceModel: '',
                                    degree: '',
                                    batch: '',
                                    semester: '',
                                    department: '',
                                    section: '',
                                    phase: '',
                                  }),
                                });
                                setIsRoleDropdownOpen(false);
                                setIsClientDropdownOpen(false);
                              }}>
                              <ShieldCheck className="h-4 w-4 text-subtle" />
                              <div className="flex-1 min-w-0"><div className="font-medium truncate">{role.renameRole}</div><div className="text-xs text-faint truncate">{role.originalRole}</div></div>
                              {newUser.roleId === role._id && <Check className="h-4 w-4 text-brand-strong" />}
                            </div>
                          ))
                        ) : (<div className="text-xs text-subtle py-2.5 px-3 text-center">No roles available</div>)}
                      </div>
                    )}
                  </div>
                </div>

                {/* ─── Client Dropdown (student role only) ─────────────────────── */}
                {isStudent && (
                  <div ref={clientDropdownRef}>
                    <Label className={LABEL_CLS}>Client <span className="text-brand-strong">*</span></Label>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setIsClientDropdownOpen(!isClientDropdownOpen)}
                        disabled={isSubmitting || isLoadingClients}
                        className={DROPDOWN_TRIGGER_CLS}
                      >
                        <span className="flex items-center gap-2 min-w-0 flex-1">
                          <Building2 className="h-4 w-4 text-subtle" />
                          <span className={`flex-1 text-left truncate ${newUser.clientName ? "text-body" : "text-faint"}`}>
                            {newUser.clientName || "Select Client"}
                          </span>
                        </span>
                        {isLoadingClients ? (
                          <Loader2 className="h-4 w-4 animate-spin text-faint" />
                        ) : (
                          <ChevronDown className={`h-4 w-4 text-faint transition-transform ${isClientDropdownOpen ? 'rotate-180' : ''}`} />
                        )}
                      </button>
                      {isClientDropdownOpen && !isLoadingClients && (
                        <div className={DROPDOWN_MENU_CLS}>
                          {clients.length === 0 ? (
                            <div className="px-3 py-2.5 text-xs text-subtle text-center">No clients available</div>
                          ) : (
                            clients.map(client => (
                              <div
                                key={client._id}
                                className={`${DROPDOWN_ITEM_CLS} ${newUser.clientName === client.clientCompany ? 'bg-brand-wash text-heading' : 'text-body hover:bg-row-hover'}`}
                                onClick={() => {
                                  // Auto-derive student type from the client's type
                                  const derivedType: 'degree-program' | 'skilling' | undefined =
                                    client.type?.includes('college')
                                      ? 'degree-program'
                                      : client.type?.includes('company')
                                      ? 'skilling'
                                      : undefined;
                                  setSelectedMappingId('');
                                  setNewUser({
                                    ...newUser,
                                    clientName: client.clientCompany,
                                    clientId: client._id,
                                    // reset the whole cascade when the client changes
                                    studentType: derivedType,
                                    serviceModel: '',
                                    degree: '',
                                    batch: '',
                                    semester: '',
                                    department: '',
                                    section: '',
                                    phase: '',
                                  });
                                  setIsClientDropdownOpen(false);
                                }}
                              >
                                <Building2 className="h-4 w-4 text-subtle" />
                                <span className="flex-1 truncate">{client.clientCompany}</span>
                                {client.status && (
                                  <StatusPill tone={client.status === 'active' ? 'success' : 'neutral'} className="h-5 px-2 text-2xs">
                                    {client.status}
                                  </StatusPill>
                                )}
                                {newUser.clientName === client.clientCompany && <Check className="h-4 w-4 text-brand-strong" />}
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
                </div>

                {/* ─── Client type indicator (derived from the selected client) ─── */}
                {newUser.clientName && (isCollegeClient || isCompanyClient) && (
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-subtle">Client type:</span>
                    {isCollegeClient && (
                      <StatusPill tone="info" className="h-5 px-2 text-2xs">
                        <GraduationCap className="h-3 w-3" /> College
                      </StatusPill>
                    )}
                    {isCompanyClient && (
                      <StatusPill tone="warn" className="h-5 px-2 text-2xs">
                        <Building2 className="h-3 w-3" /> Company
                      </StatusPill>
                    )}
                  </div>
                )}

                {/* ─── Service Model + hierarchy cascade — students only ─────────
                    A student is placed on a client's service (e.g. a degree
                    program). Picking the service reveals the degree ▸ department ▸
                    section cascade below; degree + department are required for a
                    degree-program service, the rest is optional. Non-student roles
                    stay basics + role + client. */}
                {isStudent && newUser.clientName && (
                  serviceModelOptions.length > 0 ? (
                    renderDropdown(
                      "Service Model", <Briefcase className="h-4 w-4 text-subtle" />, selectedServiceLabel, serviceModelOptions,
                      isServiceModelDropdownOpen, setIsServiceModelDropdownOpen,
                      (value) => {
                        const m = clientMappings.find(cm => serviceLabelOf(cm) === value) || null;
                        setSelectedMappingId(m?._id || '');
                        setNewUser({
                          ...newUser,
                          // Keep the plain model name for saving; the service id is only
                          // for telling duplicate services apart in the dropdown.
                          serviceModel: m ? modelNameOf(m) : value,
                          // Persist the exact mapping too — enrolment needs to know
                          // WHICH of a client's same-named services this user is in.
                          serviceMappingId: m?._id || '',
                          // reset the whole hierarchy when the service changes
                          degree: '', batch: '', semester: '', department: '', section: '', phase: '',
                        });
                      },
                      serviceModelDropdownRef, "Select Service Model", isLoadingMappings
                    )
                  ) : (
                    <p className="text-xs text-warn-700">
                      No service mappings configured for this client.
                    </p>
                  )
                )}

                {/* ─── Hierarchy cascade — degree ▸ department ▸ section ── */}
                {isStudent && newUser.serviceModel && enabledLevels.length > 0 && (
                  <div className="grid grid-cols-2 gap-x-3.5 gap-y-2.5">
                    {enabledLevels.map((level) => (
                      <div key={level} className={enabledLevels.length === 1 ? 'col-span-2' : ''}>
                        {renderDropdown(
                          requiredLevels.includes(level)
                            ? <>{level} <span className="text-danger-600">*</span></>
                            : level,
                          LEVEL_ICONS[level],
                          (newUser as unknown as Record<string, string>)[LEVEL_FIELD[level]] || '',
                          optionsForLevel(level),
                          levelDropdownState[level].open,
                          levelDropdownState[level].setOpen,
                          (value) => setLevelValue(level, value),
                          levelDropdownState[level].ref,
                          `Select ${level}`
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Roll / register number — optional, shown for students */}
                {isStudent && (
                  <div>
                    <Label className={LABEL_CLS}>Roll Number</Label>
                    <input
                      name="rollNumber"
                      type="text"
                      value={newUser.rollNumber || ''}
                      placeholder="Enter roll / register number (optional)"
                      onChange={handleInputChange}
                      disabled={isSubmitting}
                      className={INPUT_CLS}
                    />
                  </div>
                )}
              </div>

              {/* Profile section — the border-t divider keeps the visual
                  grouping; the "Profile" text label was noise on top of it. */}
              <div className="space-y-2.5 border-t border-hairline pt-3">
                {/* Name Fields - Always visible */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3.5 gap-y-2.5">
                  <div>
                    <Label className={LABEL_CLS}>First Name <span className="text-brand-strong">*</span></Label>
                    <input
                      name="firstName"
                      type="text"
                      value={newUser.firstName}
                      placeholder="First Name"
                      onChange={handleInputChange}
                      disabled={isSubmitting}
                      className={INPUT_CLS}
                      required
                    />
                  </div>
                  <div>
                    <Label className={LABEL_CLS}>Last Name <span className="text-brand-strong">*</span></Label>
                    <input
                      name="lastName"
                      type="text"
                      value={newUser.lastName}
                      placeholder="Last Name"
                      onChange={handleInputChange}
                      disabled={isSubmitting}
                      className={INPUT_CLS}
                      required
                    />
                  </div>
                </div>

                {/* Email + Phone — paired into a two-column grid so the
                    profile fields all share the same rhythm (first/last
                    name above already did; email/phone were stacked
                    single-column). Collapses to one column below sm. */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3.5 gap-y-2.5">
                  <div>
                    <Label className={LABEL_CLS}>Email Address <span className="text-brand-strong">*</span></Label>
                    <input
                      name="email"
                      type="email"
                      value={newUser.email}
                      placeholder="Enter Email Address"
                      onChange={handleInputChange}
                      disabled={isSubmitting}
                      className={INPUT_CLS}
                      required
                    />
                  </div>
                  <div>
                    <Label className={LABEL_CLS}>Phone Number <span className="text-brand-strong">*</span></Label>
                    <input
                      name="phone"
                      type="tel"
                      value={newUser.phone}
                      placeholder="Enter phone number"
                      onChange={handleInputChange}
                      disabled={isSubmitting}
                      className={INPUT_CLS}
                      required
                    />
                  </div>
                </div>

                {/* Gender Dropdown - Always visible */}
                <div ref={genderDropdownRef}>
                  <Label className={LABEL_CLS}>Gender <span className="text-brand-strong">*</span></Label>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setIsGenderDropdownOpen(!isGenderDropdownOpen)}
                      disabled={isSubmitting}
                      className={DROPDOWN_TRIGGER_CLS}
                    >
                      <span className="flex items-center gap-2 min-w-0 flex-1">
                        {newUser.gender === "Male" && <span className="text-info-700 text-sm">♂</span>}{newUser.gender === "Female" && <span className="text-danger-700 text-sm">♀</span>}
                        <span className="capitalize flex-1 text-left text-body">{newUser.gender}</span>
                      </span>
                      <ChevronDown className={`h-4 w-4 text-faint transition-transform ${isGenderDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>
                    {isGenderDropdownOpen && (
                      <div className={DROPDOWN_MENU_CLS}>
                        {["Male", "Female"].map(gender => (
                          <div key={gender} className={`${DROPDOWN_ITEM_CLS} ${newUser.gender === gender ? 'bg-brand-wash text-heading' : 'text-body hover:bg-row-hover'}`} onClick={() => { setNewUser({ ...newUser, gender: gender as "Male" | "Female" }); setIsGenderDropdownOpen(false); }}>
                            <span className={gender === "Male" ? "text-info-700" : "text-danger-700"}>{gender === "Male" ? "♂" : "♀"}</span><span className="flex-1">{gender}</span>{newUser.gender === gender && <Check className="h-4 w-4 text-brand-strong" />}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Batch / Degree / Department / Semester / Section / Phase are now
                  rendered by the service-mapping cascade above (right under the
                  Service Model select), so nothing hierarchy-related lives here. */}

              {(!isEditing) && (
                <div className="space-y-2.5 border-t border-hairline pt-3">
                  {/* Password + Status paired 2-col so the account section
                      matches the profile section's grid rhythm. */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3.5 gap-y-2.5">
                    <div>
                      <Label className={LABEL_CLS}>Password</Label>
                      <input
                        name="password"
                        type="password"
                        value={newUser.password}
                        onChange={handleInputChange}
                        disabled={isSubmitting}
                        className={INPUT_CLS}
                        placeholder="Enter password..."
                      />
                    </div>
                    <div ref={statusDropdownRef}>
                    <Label className={LABEL_CLS}>Status</Label>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setIsStatusDropdownOpen(!isStatusDropdownOpen)}
                        disabled={isSubmitting}
                        className={DROPDOWN_TRIGGER_CLS}
                      >
                        <span className="flex items-center gap-2 min-w-0 flex-1">
                          <span className={`inline-block w-2 h-2 rounded-full ${newUser.status === "active" ? "bg-success-500" : "bg-danger-500"}`} />
                          <span className="capitalize flex-1 text-left text-body">{newUser.status === "active" ? "Active" : "Inactive"}</span>
                        </span>
                        <ChevronDown className={`h-4 w-4 text-faint transition-transform ${isStatusDropdownOpen ? 'rotate-180' : ''}`} />
                      </button>
                      {isStatusDropdownOpen && (
                        <div className={DROPDOWN_MENU_CLS}>
                          {["active", "inactive"].map(status => (
                            <div key={status} className={`${DROPDOWN_ITEM_CLS} ${newUser.status === status ? 'bg-brand-wash text-heading' : 'text-body hover:bg-row-hover'}`} onClick={() => { setNewUser({ ...newUser, status: status as "active" | "inactive" }); setIsStatusDropdownOpen(false); }}>
                              <span className={`w-2 h-2 rounded-full ${status === "active" ? "bg-success-500" : "bg-danger-500"}`} />
                              <span className="flex-1 capitalize">{status}</span>
                              {newUser.status === status && <Check className="h-4 w-4 text-brand-strong" />}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  </div>
                </div>
              )}
              </form>
            </div>
          </div>
          {/* Bottom action area — matches the reference's borderless
              foot: no divider above, everything just sits on the modal's
              surface. Bulk Upload stays on the left as a tertiary action;
              Cancel + Create are the right-aligned secondary/primary
              pair the spec calls out. */}
          <DialogFooter className="bg-surface px-5 pb-4 pt-2">
            <div className="flex items-center justify-between w-full gap-3">
              <div className="flex items-center gap-2">
                {canBulkUpload && !isSubmitting && (
                  <Button
                    onClick={() => { setShowAddUserModal(false); setShowBulkUploadModal(true); }}
                    variant="outline"
                    size="sm"
                    className="flex items-center gap-1.5 h-9 px-3.5 text-xs font-semibold rounded-control"
                  >
                    <Upload className="h-3.5 w-3.5" />
                    Bulk Upload
                  </Button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => setShowAddUserModal(false)}
                  disabled={isSubmitting}
                  className="h-9 px-4 text-xs font-semibold rounded-control"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={
                    // Role is required; for a student on a degree program, degree +
                    // department are required too. Everything else stays optional.
                    !newUser.roleId ||
                    isSubmitting ||
                    missingRequired.length > 0
                  }
                  className="h-9 px-4 text-xs font-semibold rounded-control"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {isEditing ? "Updating..." : "Creating..."}
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      {isEditing ? "Update" : "Create"}
                    </>
                  )}
                </Button>
              </div>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Success Modal */}
      <Dialog open={showSuccessModal} onOpenChange={setShowSuccessModal}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-tile bg-success-50 flex items-center justify-center flex-shrink-0">
                <Check className="h-5 w-5 text-success-700" />
              </div>
              <div className="min-w-0">
                <DialogTitle>
                  {isEditing ? "User Updated Successfully" : "User Created Successfully"}
                </DialogTitle>
                <DialogDescription className="mt-1">
                  {isEditing ? "The user account has been updated successfully." : "The user account has been created and is ready to use."}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="rounded-tile border border-hairline bg-surface-sunken p-4 space-y-1.5">
            <p className="text-sm text-body"><span className="font-medium text-heading">User ID:</span> {newUserId}</p>
            {newUser.clientName && <p className="text-sm text-body"><span className="font-medium text-heading">Client:</span> {newUser.clientName}</p>}
            {newUser.serviceModel && <p className="text-sm text-body"><span className="font-medium text-heading">Service Model:</span> {newUser.serviceModel}</p>}
            {newUser.batch && <p className="text-sm text-body"><span className="font-medium text-heading">Batch:</span> {newUser.batch}</p>}
            {newUser.degree && <p className="text-sm text-body"><span className="font-medium text-heading">Degree:</span> {newUser.degree}</p>}
            {newUser.department && <p className="text-sm text-body"><span className="font-medium text-heading">Department:</span> {newUser.department}</p>}
            {newUser.semester && <p className="text-sm text-body"><span className="font-medium text-heading">Semester:</span> {newUser.semester}</p>}
            {newUser.section && <p className="text-sm text-body"><span className="font-medium text-heading">Section:</span> {newUser.section}</p>}
            {newUser.phase && <p className="text-sm text-body"><span className="font-medium text-heading">Phase:</span> {newUser.phase}</p>}
            <p className="text-xs text-faint pt-1">The user will receive login credentials via email.</p>
          </div>
          <DialogFooter className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <Button variant="outline" onClick={() => setShowSuccessModal(false)} className="w-full sm:w-auto">Close</Button>
            {!isEditing && <Button onClick={onConfigurePermissions} className="w-full sm:w-auto">Configure Permissions</Button>}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-tile bg-danger-50 flex items-center justify-center flex-shrink-0">
                <Trash2 className="h-5 w-5 text-danger-700" />
              </div>
              <div className="min-w-0">
                <DialogTitle>Confirm Deletion</DialogTitle>
                <DialogDescription className="mt-1">
                  Are you sure you want to delete this user? This action cannot be undone.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="rounded-tile border border-hairline bg-surface-sunken p-4">
            <p className="text-sm text-body"><span className="font-medium text-heading">User:</span> {userToDelete?.firstName} {userToDelete?.lastName}</p>
            <p className="text-xs text-subtle mt-1">Email: {userToDelete?.email}</p>
          </div>
          <DialogFooter className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <Button variant="outline" onClick={() => setShowDeleteModal(false)} disabled={isDeleting}>Cancel</Button>
            <Button variant="destructive" onClick={onConfirmDelete} disabled={isDeleting}>
              {isDeleting ? <><Loader2 className="h-4 w-4 animate-spin" />Deleting...</> : "Delete User"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Details Modal */}
      <Dialog open={showViewDetailsModal} onOpenChange={setShowViewDetailsModal}>
        <DialogContent className="sm:max-w-[640px] max-h-[88vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <UserAvatar name={selectedUserForDetails?.firstName} size="lg" />
              <div className="min-w-0">
                <DialogTitle className="truncate">
                  {selectedUserForDetails?.firstName} {selectedUserForDetails?.lastName}
                </DialogTitle>
                <DialogDescription className="mt-0.5">Complete information for this user account</DialogDescription>
              </div>
            </div>
          </DialogHeader>
          {selectedUserForDetails && (
            <div className="space-y-4">
              <div className="rounded-tile border border-hairline bg-surface-sunken p-4">
                <h3 className="text-2xs font-semibold uppercase tracking-wider text-subtle mb-3 flex items-center gap-1.5">
                  <UserPlus className="h-3.5 w-3.5" /> Basic Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-3">
                  <div><p className="text-2xs font-medium uppercase tracking-wide text-faint">Full Name</p><p className="text-sm text-heading mt-0.5">{selectedUserForDetails.firstName} {selectedUserForDetails.lastName}</p></div>
                  <div><p className="text-2xs font-medium uppercase tracking-wide text-faint">Email Address</p><p className="text-sm text-heading mt-0.5 break-all">{selectedUserForDetails.email}</p></div>
                  <div><p className="text-2xs font-medium uppercase tracking-wide text-faint">Phone Number</p><p className="text-sm text-heading mt-0.5 tabular-nums">{selectedUserForDetails.phone}</p></div>
                  <div><p className="text-2xs font-medium uppercase tracking-wide text-faint">Gender</p><p className="text-sm text-heading mt-0.5 capitalize">{selectedUserForDetails.gender}</p></div>
                  <div><p className="text-2xs font-medium uppercase tracking-wide text-faint">Role</p><div className="mt-1"><StatusPill tone={roleTone(selectedUserForDetails.role)}>{selectedUserForDetails.role}</StatusPill></div></div>
                  <div><p className="text-2xs font-medium uppercase tracking-wide text-faint">Status</p><div className="mt-1"><StatusPill tone={selectedUserForDetails.status === "active" ? "success" : "danger"} dot>{selectedUserForDetails.status === "active" ? "Active" : "Inactive"}</StatusPill></div></div>
                  {selectedUserForDetails.clientName && (<div><p className="text-2xs font-medium uppercase tracking-wide text-faint">Client</p><p className="text-sm text-heading mt-0.5">{selectedUserForDetails.clientName}</p></div>)}
                  {selectedUserForDetails.lastLogin && (<div><p className="text-2xs font-medium uppercase tracking-wide text-faint">Last Login</p><p className="text-sm text-heading mt-0.5">{selectedUserForDetails.lastLogin}</p></div>)}
                </div>
              </div>

              {/* Academic Information - Only show for Student roles */}
              {isStudentRole() && (
                <div className="rounded-tile border border-hairline bg-surface-sunken p-4">
                  <h3 className="text-2xs font-semibold uppercase tracking-wider text-subtle mb-3 flex items-center gap-1.5">
                    <GraduationCap className="h-3.5 w-3.5" /> Academic Information
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-3">
                    {selectedUserForDetails.batch && (<div><p className="text-2xs font-medium uppercase tracking-wide text-faint">Batch</p><p className="text-sm text-heading mt-0.5">{selectedUserForDetails.batch}</p></div>)}
                    {selectedUserForDetails.studentType === 'degree-program' && (
                      <>
                        {selectedUserForDetails.degree && (<div><p className="text-2xs font-medium uppercase tracking-wide text-faint">Degree</p><p className="text-sm text-heading mt-0.5">{selectedUserForDetails.degree}</p></div>)}
                        {selectedUserForDetails.department && (<div><p className="text-2xs font-medium uppercase tracking-wide text-faint">Department</p><p className="text-sm text-heading mt-0.5">{selectedUserForDetails.department}</p></div>)}
                        {selectedUserForDetails.year && (<div><p className="text-2xs font-medium uppercase tracking-wide text-faint">Year</p><p className="text-sm text-heading mt-0.5">{selectedUserForDetails.year}</p></div>)}
                        {selectedUserForDetails.semester && (<div><p className="text-2xs font-medium uppercase tracking-wide text-faint">Semester</p><p className="text-sm text-heading mt-0.5">Semester {selectedUserForDetails.semester}</p></div>)}
                        {selectedUserForDetails.section && (<div><p className="text-2xs font-medium uppercase tracking-wide text-faint">Section</p><p className="text-sm text-heading mt-0.5">{selectedUserForDetails.section}</p></div>)}
                      </>
                    )}
                    {selectedUserForDetails.studentType && (
                      <div><p className="text-2xs font-medium uppercase tracking-wide text-faint">Student Type</p><p className="text-sm text-heading mt-0.5 capitalize">{selectedUserForDetails.studentType === 'degree-program' ? 'Degree Program' : 'Skilling'}</p></div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowViewDetailsModal(false)} className="w-full sm:w-auto">Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Permission Modal */}
      {showPermissionModal && selectedUserForPermission && (
        <PermissionModal
          isOpen={showPermissionModal}
          onClose={() => {
            setShowPermissionModal(false);
            setSelectedUserForPermission(null);
          }}
          userId={selectedUserForPermission.id}
          userName={`${selectedUserForPermission.firstName} ${selectedUserForPermission.lastName}`}
          userEmail={selectedUserForPermission.email}
          roleName={selectedUserForPermission.role}
        />
      )}

      {/* Bulk Upload Modal */}
      {canBulkUpload && showBulkUploadModal && (
        <BulkUploadModal
          isOpen={showBulkUploadModal}
          onClose={() => setShowBulkUploadModal(false)}
          roles={roles}
          isLoadingRoles={isLoadingRoles}
          onSuccess={() => queryClient.invalidateQueries({ queryKey: queryKeys.users.all })}
        />
      )}

      {/* Bulk Permission Modal */}
      {canBulkPermission && showBulkPermissionModal && (
        <BulkPermissionModal
          isOpen={showBulkPermissionModal}
          onClose={() => {
            setShowBulkPermissionModal(false);
            setSelectedUserForBulkPermissions(null);
          }}
          availableUsers={allUsers}
          roles={roles}
          basedOn={basedOn}
          preSelectedUser={selectedUserForBulkPermissions}
        />
      )}
    </>
  );
};
