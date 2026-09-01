"use client";
import { Loading } from "@/components/loading-ui/loading";
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
    BookOpen, Users, ChevronRight, Search, GraduationCap,
    ArrowUpRight, LayoutGrid, AlertCircle, X, SlidersHorizontal,
    Layers, ChevronLeft,
} from 'lucide-react';
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import DataTable, { type Column } from '@/app/lms/shared/listing/DataTable';
import TableFooter from '@/app/lms/shared/listing/TableFooter';
import { useClientsPage, type Client } from '@/apiServices/clientManagementService';
import {
    useCoursesQuery,
    useFilteredCourses,
    getAuthToken,
    getCurrentUserIdFromAuth,
    Course
} from '../.../../../../../apiServices/studentcoursepage';
import { courseStructuresSummaryQuery } from '@/apiServices/createCourseStucture';
import { businessModelFullName } from '@/features/clientmanagement/lib';
import DashboardLayout from '../../component/layout';
import { StaffLayout } from '../../component/stafflayout/staff-layout';
import { StudentLayout } from '../../component/student/student-layout';

const defaultCategories = ["All", "Web Development", "Data Science", "Mobile Development", "Design", "Cloud Computing", "Marketing", "Security"];

// Interface for user data
interface Permission {
    permissionName: string;
    permissionKey: string;
    permissionFunctionality: string[];
    icon: string;
    color: string;
    description: string;
    isActive: boolean;
    order: number;
    _id: string;
    createdAt: string;
    updatedAt: string;
}

interface UserData {
    _id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: {
        _id: string;
        originalRole: string;
        renameRole: string;
        roleValue: string;
    } | string;
    permissions?: Permission[];
    [key: string]: any;
}

// Helper function to get user data from localStorage
const getCurrentUser = (): { valid: boolean; user: UserData | null } => {
    try {
        const userDataString = localStorage.getItem("smartcliff_userData");
        if (!userDataString) {
            return { valid: false, user: null };
        }

        const userData: UserData = JSON.parse(userDataString);
        return { valid: true, user: userData };
    } catch (error) {
        console.error("Error getting user data from localStorage:", error);
        return { valid: false, user: null };
    }
};

// Helper function to determine if user is a student
const isStudentUser = (): boolean => {
    try {
        const userResult = getCurrentUser();
        if (!userResult.valid || !userResult.user) return false;

        const user = userResult.user;
        let userRole = '';

        // Get role value from user data
        if (typeof user.role === 'object' && user.role !== null) {
            userRole = (user.role as any).roleValue ||
                (user.role as any).originalRole ||
                (user.role as any).renameRole || '';
        } else if (typeof user.role === 'string') {
            userRole = user.role;
        }

        // Also check localStorage for role value
        const storedRoleValue = localStorage.getItem("smartcliff_roleValue") ||
            localStorage.getItem("smartcliff_originalRole") ||
            localStorage.getItem("smartcliff_role") || '';

        userRole = userRole || storedRoleValue;

        // Check if role contains 'student' (case-insensitive)
        const isStudent = userRole.toLowerCase().includes('student');
        console.log("User role check:", {
            roleFromUser: userRole,
            storedRoleValue,
            isStudent
        });

        return isStudent;
    } catch (error) {
        console.error("Error checking user role:", error);
        return false;
    }
};

// Helper function to determine if user is admin
const isAdminUser = (): boolean => {
    try {
        const userResult = getCurrentUser();
        if (!userResult.valid || !userResult.user) return false;

        const user = userResult.user;
        let userRole = '';

        // Get role value from user data
        if (typeof user.role === 'object' && user.role !== null) {
            userRole = (user.role as any).roleValue ||
                (user.role as any).originalRole ||
                (user.role as any).renameRole || '';
        } else if (typeof user.role === 'string') {
            userRole = user.role;
        }

        // Also check localStorage for role value
        const storedRoleValue = localStorage.getItem("smartcliff_roleValue") || '';

        userRole = userRole || storedRoleValue;

        // Check if role contains 'admin' (case-insensitive)
        return userRole.toLowerCase().includes('admin');
    } catch (error) {
        console.error("Error checking admin role:", error);
        return false;
    }
};

// Helper function to get institution ID
const getInstitutionId = (): string | null => {
    try {
        return localStorage.getItem("smartcliff_institution");
    } catch (error) {
        console.error("Error getting institution ID:", error);
        return null;
    }
};

// Course-level → tone (Beginner / Intermediate / Advanced).
const levelTone = (level?: string): { chip: string; label: string } => {
    switch ((level || '').toLowerCase()) {
        case 'beginner': return { chip: 'bg-success-50 text-success-700 ring-success-500/20', label: level || '' };
        case 'intermediate': return { chip: 'bg-warn-50 text-warn-700 ring-warn-500/20', label: level || '' };
        case 'advanced': return { chip: 'bg-danger-50 text-danger-700 ring-danger-500/20', label: level || '' };
        default: return { chip: 'bg-ink-100 text-ink-700 ring-ink-500/20', label: level || '—' };
    }
};

const FALLBACK_IMG = "https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=400&h=240&fit=crop&auto=format";

// ── Admin drill-down helpers ─────────────────────────────────────────────────
// The three levels are derived from the ONE course-structures summary payload
// the admin branch already fetches — no extra network round-trips. Level-1
// clients are the unique clientId set across all summarised courses; level-2
// services are the unique mappingId set within one client; level-3 is the
// filtered course list. Courses that have no clientId/mappingId (legacy data)
// bucket under a synthetic "Unassigned" client so they stay reachable.

type Level = 'clients' | 'services' | 'courses';

const UNASSIGNED_CLIENT_ID = '__unassigned_client__';
const UNASSIGNED_MAPPING_ID = '__unassigned_mapping__';

interface ClientBucket {
    id: string;
    name: string;
    // Distinct mappings under this client and total courses — surfaced on the
    // card so the user knows what they are about to drill into.
    serviceCount: number;
    courseCount: number;
    // Any distinctive labels observed across the client's courses (up to two)
    // to hint at what services it runs without needing an extra fetch.
    serviceTypes: string[];
}

interface ServiceBucket {
    id: string;
    // A mapping doesn't carry its own display label in the course summary, so
    // fall back to the most informative field on the underlying courses.
    label: string;
    // First non-empty coursePath — e.g. "B.E ▸ CSE ▸ A ▸ 3" — so services
    // under one client can be told apart when the labels match.
    hierarchyHint?: string;
    category?: string;
    serviceModal?: string;
    courseCount: number;
}

const deriveClientBuckets = (courses: Course[]): ClientBucket[] => {
    const map = new Map<string, ClientBucket & { _mappingIds: Set<string>; _serviceTypeSet: Set<string> }>();
    for (const c of courses) {
        const anyC = c as any;
        const id = String(anyC.clientId || '') || UNASSIGNED_CLIENT_ID;
        const name = String(anyC.clientName || '').trim() || (id === UNASSIGNED_CLIENT_ID ? 'Unassigned' : 'Unnamed client');
        let bucket = map.get(id);
        if (!bucket) {
            bucket = {
                id,
                name,
                serviceCount: 0,
                courseCount: 0,
                serviceTypes: [],
                _mappingIds: new Set<string>(),
                _serviceTypeSet: new Set<string>(),
            };
            map.set(id, bucket);
        }
        bucket.courseCount += 1;
        const mid = String(anyC.mappingId || '') || UNASSIGNED_MAPPING_ID;
        bucket._mappingIds.add(mid);
        const st = String(anyC.serviceType || '').trim();
        if (st) bucket._serviceTypeSet.add(st);
    }
    return Array.from(map.values())
        .map(({ _mappingIds, _serviceTypeSet, ...rest }) => ({
            ...rest,
            serviceCount: _mappingIds.size,
            serviceTypes: Array.from(_serviceTypeSet).slice(0, 2),
        }))
        // Latest added client first. `id` is the Mongo ObjectId whose first
        // 4 bytes encode the creation timestamp, so a lexicographic desc
        // sort on the id string equals "newest first" without needing the
        // course-structures summary to carry a client createdAt of its
        // own. The synthetic "Unassigned" bucket is a sentinel — it isn't a
        // real client, so pin it to the end regardless of sort direction.
        .sort((a, b) => {
            if (a.id === UNASSIGNED_CLIENT_ID) return 1;
            if (b.id === UNASSIGNED_CLIENT_ID) return -1;
            return b.id.localeCompare(a.id);
        });
};

const deriveServiceBuckets = (courses: Course[], clientId: string): ServiceBucket[] => {
    const map = new Map<string, ServiceBucket>();
    for (const c of courses) {
        const anyC = c as any;
        const cid = String(anyC.clientId || '') || UNASSIGNED_CLIENT_ID;
        if (cid !== clientId) continue;
        const mid = String(anyC.mappingId || '') || UNASSIGNED_MAPPING_ID;
        let bucket = map.get(mid);
        if (!bucket) {
            const st = String(anyC.serviceType || '').trim();
            const cat = String(anyC.category || '').trim();
            bucket = {
                id: mid,
                label: st || cat || (mid === UNASSIGNED_MAPPING_ID ? 'Unassigned mapping' : 'Service'),
                hierarchyHint: String(anyC.coursePath || '').trim() || undefined,
                category: cat || undefined,
                serviceModal: String(anyC.serviceModal || '').trim() || undefined,
                courseCount: 0,
            };
            map.set(mid, bucket);
        }
        bucket.courseCount += 1;
        // Keep the first non-empty coursePath we see; that's usually the most
        // representative for that mapping's hierarchy location.
        if (!bucket.hierarchyHint) {
            const cp = String(anyC.coursePath || '').trim();
            if (cp) bucket.hierarchyHint = cp;
        }
    }
    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
};

// Level-aware breadcrumb — Dashboard › Grades › [Client › [Service]]. The
// intermediate segments are clickable so the user can jump out of the
// drill-down without having to press Back three times.
function Breadcrumbs({
    level,
    clientName,
    serviceLabel,
    onGoClients,
    onGoServices,
}: {
    level: Level;
    clientName?: string;
    serviceLabel?: string;
    onGoClients?: () => void;
    onGoServices?: () => void;
}) {
    const router = useRouter();
    return (
        <nav className="flex items-center gap-1.5 text-xs mb-2" aria-label="Breadcrumb">
            <button
                type="button"
                onClick={() => router.push('/lms/pages/studentdashboard')}
                className="inline-flex items-center gap-1 text-subtle font-medium hover:text-brand-strong transition-colors"
            >
                <BookOpen className="w-3 h-3" /> Dashboard
            </button>
            <ChevronRight className="w-3 h-3 text-faint" />
            {level === 'clients' ? (
                <span className="inline-flex items-center gap-1 text-heading font-semibold">Grades</span>
            ) : (
                <button
                    type="button"
                    onClick={onGoClients}
                    className="inline-flex items-center gap-1 text-subtle font-medium hover:text-brand-strong transition-colors"
                >
                    Grades
                </button>
            )}
            {level !== 'clients' && (
                <>
                    <ChevronRight className="w-3 h-3 text-faint" />
                    {level === 'services' ? (
                        <span className="inline-flex items-center gap-1 text-heading font-semibold truncate max-w-[220px]">{clientName || 'Client'}</span>
                    ) : (
                        <button
                            type="button"
                            onClick={onGoServices}
                            className="inline-flex items-center gap-1 text-subtle font-medium hover:text-brand-strong transition-colors truncate max-w-[220px]"
                        >
                            {clientName || 'Client'}
                        </button>
                    )}
                </>
            )}
            {level === 'courses' && (
                <>
                    <ChevronRight className="w-3 h-3 text-faint" />
                    <span className="inline-flex items-center gap-1 text-heading font-semibold truncate max-w-[220px]">{serviceLabel || 'Service'}</span>
                </>
            )}
        </nav>
    );
}

export default function GradePage() {
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedCategory, setSelectedCategory] = useState("All");
    const [authToken, setAuthToken] = useState<string | null>(null);
    const [userId, setUserId] = useState<string | null>(null);
    const [institutionId, setInstitutionId] = useState<string | null>(null);
    const [categories, setCategories] = useState<string[]>(defaultCategories);
    const [isStudent, setIsStudent] = useState<boolean>(false);
    const [isAdmin, setIsAdmin] = useState<boolean>(false);
    const [userRole, setUserRole] = useState<string | null>(null);
    const router = useRouter();
    const searchParams = useSearchParams();
    const pathname = usePathname();

    // ── Admin drill-down state ──────────────────────────────────────────────
    // The URL is the source of truth so the level survives a reload and browser
    // Back moves through Courses → Services → Clients. Query params only:
    //   /lms/pages/grades                             → Clients
    //   /lms/pages/grades?clientId=X                  → Services (of X)
    //   /lms/pages/grades?clientId=X&mappingId=Y      → Courses (of Y)
    const selectedClientId = searchParams?.get('clientId') || null;
    const selectedMappingId = searchParams?.get('mappingId') || null;
    const level: Level = selectedMappingId ? 'courses' : (selectedClientId ? 'services' : 'clients');

    // Preserve the direction of the last navigation so AnimatePresence knows
    // which way to slide (drill-in = -1, drill-out = +1). Ref-like via state
    // because AnimatePresence reads it during the exit animation.
    const [slideDir, setSlideDir] = useState<1 | -1>(-1);

    const setQuery = useCallback(
        (next: { clientId?: string | null; mappingId?: string | null }, direction: 1 | -1) => {
            const params = new URLSearchParams(searchParams?.toString() || '');
            if (Object.prototype.hasOwnProperty.call(next, 'clientId')) {
                if (next.clientId) params.set('clientId', next.clientId); else params.delete('clientId');
            }
            if (Object.prototype.hasOwnProperty.call(next, 'mappingId')) {
                if (next.mappingId) params.set('mappingId', next.mappingId); else params.delete('mappingId');
            }
            setSlideDir(direction);
            // Clear the level-scoped filters when moving between levels — a
            // filter chosen at level N almost never applies at level N±1.
            setSearchTerm('');
            setSelectedCategory('All');
            const qs = params.toString();
            router.replace(qs ? `${pathname}?${qs}` : (pathname || '/lms/pages/grades'), { scroll: false } as any);
        },
        [pathname, router, searchParams],
    );

    const goToClients = useCallback(() => setQuery({ clientId: null, mappingId: null }, 1), [setQuery]);
    const goToServicesOf = useCallback((clientId: string) => setQuery({ clientId, mappingId: null }, -1), [setQuery]);
    const goToServicesFromCourses = useCallback(() => setQuery({ mappingId: null }, 1), [setQuery]);
    const goToCoursesOf = useCallback((mappingId: string) => setQuery({ mappingId }, -1), [setQuery]);

    // Get user role from localStorage on component mount
    useEffect(() => {
        const role = localStorage.getItem('smartcliff_roleValue');
        setUserRole(role);
        setInstitutionId(getInstitutionId());
    }, []);

    useEffect(() => {
        const fetchUserData = async () => {
            try {
                const token = getAuthToken();
                setAuthToken(token);
                const currentUserId = getCurrentUserIdFromAuth();
                setUserId(currentUserId);
                setInstitutionId(getInstitutionId());

                // Check user roles
                const studentCheck = isStudentUser();
                const adminCheck = isAdminUser();

                setIsStudent(studentCheck);
                setIsAdmin(adminCheck);

                console.log("Role check:", {
                    isStudent: studentCheck,
                    isAdmin: adminCheck,
                    userId: currentUserId,
                    institutionId: getInstitutionId()
                });

                // Listen for storage changes (role switches)
                const handleStorageChange = () => {
                    const newRole = localStorage.getItem('smartcliff_roleValue');
                    setUserRole(newRole);
                    setInstitutionId(getInstitutionId());

                    // Re-check roles
                    const newStudentCheck = isStudentUser();
                    const newAdminCheck = isAdminUser();
                    setIsStudent(newStudentCheck);
                    setIsAdmin(newAdminCheck);
                };

                window.addEventListener('storage', handleStorageChange);

                return () => {
                    window.removeEventListener('storage', handleStorageChange);
                };
            } catch (error) {
                console.error('Error in fetchUserData:', error);
            }
        };

        fetchUserData();
    }, []);

    // Admin drill-down data sources — three separate queries so nothing
    // heavy loads on the Clients screen:
    //   Level 1 (Clients) : useClientsPage — SERVER-PAGINATED. One page of
    //                       clients per request; navigating between pages
    //                       fetches only that page's slice.
    //   Level 2 (Services) : the course-structures summary. Enabled only
    //                       when the user has drilled in (`level !==
    //                       'clients'`), so the initial Clients view no
    //                       longer downloads the whole institution catalog.
    //                       We still derive services/courses from that
    //                       payload — but it's opt-in and comes bounded by
    //                       the mapping/client filter applied client-side.
    //   Level 3 (Courses)  : same summary payload; the mapping filter
    //                       narrows it. Client-side pagination is added on
    //                       top so the render never dumps everything.
    //
    // Clients-list local pagination state — only affects Level 1. Filters
    // (search / selectedCategory) reset back to page 1 when they change.
    const [clientsPage, setClientsPage] = useState(1);
    const [clientsPageSize, setClientsPageSize] = useState(20);
    const clientListFilterKey = `${searchTerm.trim()}::${selectedCategory}`;
    const [lastClientListFilterKey, setLastClientListFilterKey] = useState(clientListFilterKey);
    if (isAdmin && lastClientListFilterKey !== clientListFilterKey) {
        setLastClientListFilterKey(clientListFilterKey);
        setClientsPage(1);
    }

    // Both the search AND the model filter go to the server. Filtering this
    // list in the browser is not an option: the endpoint is paged, so a local
    // filter would narrow only the rows on screen while the count chip and the
    // pager went on describing the whole unfiltered set.
    const clientsPageQuery = useClientsPage(
        {
            search: searchTerm.trim() || undefined,
            businessModel: selectedCategory !== 'All' ? selectedCategory : undefined,
        },
        clientsPage,
        clientsPageSize,
    );
    // Only actually fire the request while the user is on the Clients
    // screen — the useClientsPage hook doesn't take an `enabled` flag, so
    // we surface data conditionally instead. The query is cheap and
    // React Query dedups it if the user comes back to Level 1.
    const clientsPageData = isAdmin && level === 'clients' ? clientsPageQuery.data : undefined;
    const clientsList: Client[] = clientsPageData?.data ?? [];
    const clientsTotal = clientsPageData?.total ?? 0;
    const clientsTotalPages = clientsPageData?.totalPages ?? 1;
    const clientsSafePage = Math.min(clientsPage, clientsTotalPages || 1);
    const clientsRangeFrom = clientsTotal === 0 ? 0 : (clientsSafePage - 1) * clientsPageSize + 1;
    const clientsRangeTo = Math.min(clientsSafePage * clientsPageSize, clientsTotal);
    const isLoadingClientsList = isAdmin && level === 'clients' && clientsPageQuery.isPending;

    // Course-structures summary — the source for Level 2 (services) and
    // Level 3 (courses). Gated on `level !== 'clients'` so it stays
    // unfetched while the user is on the Clients screen.
    const adminCoursesQuery = useQuery({
        ...courseStructuresSummaryQuery(),
        enabled: isAdmin && level !== 'clients' && !!authToken && !!institutionId,
    });
    const allCourses: Course[] = useMemo(() => {
        const list = (adminCoursesQuery.data as any[] | undefined) || [];
        return list.filter((course: any) => course.institution === institutionId);
    }, [adminCoursesQuery.data, institutionId]);
    const isLoadingCourses = isAdmin && adminCoursesQuery.isPending;
    const coursesError = adminCoursesQuery.isError ? 'Failed to load courses' : null;

    // For non-admin users, use the existing query hook
    const filters = {
        searchTerm,
        selectedCategory,
    };

    // Non-admins get the enrolment-filtered list, in one request — the
    // endpoint does not page, so there is nothing to scroll-load. The search
    // term is applied client-side by useFilteredCourses below and no longer
    // takes part in the query key.
    const {
        data: userCoursesData,
        isLoading: userCoursesLoading,
        error: userCoursesError,
        isError: userCoursesIsError,
        refetch
    } = useCoursesQuery(
        !isAdmin ? authToken : null,
        !isAdmin ? userId : null
    );

    // Determine which courses to display based on role
    const displayedCourses = useMemo(() => {
        if (isAdmin) {
            return allCourses;
        } else {
            return userCoursesData || [];
        }
    }, [isAdmin, allCourses, userCoursesData]);

    // ── Admin drill-down derivations ────────────────────────────────────────
    // Level 1: unique clients across ALL admin courses.
    const clientBuckets = useMemo(
        () => (isAdmin ? deriveClientBuckets(allCourses) : []),
        [isAdmin, allCourses],
    );
    // Level 2: unique services under the selected client (scoped to that client
    // only, so the counts reflect what the user will see when they drill in).
    const serviceBuckets = useMemo(
        () => (isAdmin && selectedClientId ? deriveServiceBuckets(allCourses, selectedClientId) : []),
        [isAdmin, allCourses, selectedClientId],
    );
    // Level 3: the courses attached to the selected mapping (still institution-
    // scoped upstream, so no leakage across tenants).
    const scopedCoursesForMapping = useMemo(() => {
        if (!isAdmin || !selectedMappingId) return [] as Course[];
        return allCourses.filter((c: any) => {
            const mid = String(c.mappingId || '') || UNASSIGNED_MAPPING_ID;
            const cid = String(c.clientId || '') || UNASSIGNED_CLIENT_ID;
            return mid === selectedMappingId && (!selectedClientId || cid === selectedClientId);
        });
    }, [isAdmin, allCourses, selectedClientId, selectedMappingId]);

    // The current client/service (for the header + breadcrumb captions).
    const currentClient = useMemo(
        () => (selectedClientId ? clientBuckets.find((c) => c.id === selectedClientId) : undefined),
        [clientBuckets, selectedClientId],
    );
    const currentService = useMemo(
        () => (selectedMappingId ? serviceBuckets.find((s) => s.id === selectedMappingId) : undefined),
        [serviceBuckets, selectedMappingId],
    );

    // Category dropdown is level-aware — the options change with the level so
    // the same control means something useful at each step (client type at L1,
    // service type at L2, courseLevel at L3). Non-admins keep the legacy
    // serviceType-across-courses behavior.
    const uniqueServiceTypes = useMemo(() => {
        // Non-admin path — unchanged.
        if (!isAdmin) {
            if (displayedCourses.length === 0) return [];
            return Array.from(
                new Set(displayedCourses.map(course => course.serviceType).filter(Boolean))
            );
        }
        // Admin — depends on the current level.
        if (level === 'clients') {
            // Straight from the response facet, which lists every model in the
            // WHOLE result set rather than just the page on screen. The old
            // source here was clientBuckets, derived from the course summary --
            // and that query is disabled at this level, so it was always empty
            // and the dropdown fell back to a hardcoded list of course topics
            // no client is ever tagged with.
            return clientsPageData?.facets?.businessModels ?? [];
        }
        if (level === 'services') {
            const set = new Set<string>();
            serviceBuckets.forEach((s) => { if (s.label) set.add(s.label); });
            return Array.from(set);
        }
        // Courses level: filter by courseLevel (Beginner/Intermediate/Advanced).
        const set = new Set<string>();
        scopedCoursesForMapping.forEach((c) => { if (c.courseLevel) set.add(c.courseLevel); });
        return Array.from(set);
    }, [isAdmin, level, displayedCourses, clientsPageData, serviceBuckets, scopedCoursesForMapping]);

    useEffect(() => {
        if (uniqueServiceTypes.length > 0) {
            setCategories(["All", ...uniqueServiceTypes]);
        } else {
            // Only the non-admin path still needs the placeholder list; every
            // admin level derives its options from real data now.
            setCategories(isAdmin ? ["All"] : defaultCategories);
        }
    }, [uniqueServiceTypes, isAdmin]);

    // The Clients filter is the one place where the value SENT and the text
    // SHOWN differ: the server matches on the code ("B2I"), while the row and
    // this dropdown read the full name ("business to institution").
    const filterOptions = useMemo(
        () => categories.map((c) => ({
            value: c,
            label: isAdmin && level === 'clients' && c !== 'All' ? businessModelFullName(c) : c,
        })),
        [categories, isAdmin, level],
    );

    // The control means something different at each level, so a selection made
    // on one must not survive into the next -- a model code left applied to the
    // Services list matches no service and would silently empty the screen.
    const [lastFilterLevel, setLastFilterLevel] = useState<Level>(level);
    if (lastFilterLevel !== level) {
        setLastFilterLevel(level);
        if (selectedCategory !== 'All') setSelectedCategory('All');
    }

    const filteredCourses = useFilteredCourses(displayedCourses, filters);

    // ── Admin: level-scoped filtered rows ───────────────────────────────────
    // Clients rows come STRAIGHT from the paginated /client-management/getAll
    // (useClientsPage): BOTH the search and the business-model filter ship as
    // query params and the server returns just that page's slice, already
    // filtered. There is nothing to narrow again here — and narrowing locally
    // would desynchronise the visible rows from the count chip and the pager.
    const filteredClients: Client[] = clientsList;

    const filteredServices = useMemo(() => {
        if (!isAdmin || level !== 'services') return [] as ServiceBucket[];
        const q = searchTerm.trim().toLowerCase();
        return serviceBuckets.filter((s) => {
            if (q) {
                const hay = `${s.label} ${s.category || ''} ${s.serviceModal || ''} ${s.hierarchyHint || ''}`.toLowerCase();
                if (!hay.includes(q)) return false;
            }
            if (selectedCategory !== 'All' && s.label !== selectedCategory) return false;
            return true;
        });
    }, [isAdmin, level, serviceBuckets, searchTerm, selectedCategory]);

    // Admin, Courses level: reuse the same client-side course filter the
    // non-admin path uses, but pointed at the mapping-scoped course list.
    const filteredAdminCourses = useFilteredCourses(scopedCoursesForMapping, filters);

    const handleStartCourse = (courseId: string) => {
        console.log("Role-based navigation check - isStudent:", isStudent, "isAdmin:", isAdmin);
        router.push(`/lms/pages/grades/${courseId}`);
    };

    const handleRetry = () => {
        if (isAdmin) {
            adminCoursesQuery.refetch();
        } else {
            refetch();
        }
    };

    // "Loading" for the toolbar meter + skeleton screen — level-aware so
    // the Clients screen no longer waits for the (now unfetched) course
    // summary. Levels 2/3 wait on the course summary as before.
    const showCourseLoading = isAdmin
        ? (level === 'clients' ? isLoadingClientsList : isLoadingCourses)
        : (userCoursesLoading && !userCoursesData);
    const hasError = isAdmin ? !!coursesError : userCoursesIsError;
    const errorMessage = isAdmin ? coursesError : (userCoursesError as any)?.message;

    // Level-aware display copy for the admin path — the header, empty state
    // and search placeholder all pivot on what the user is looking at right
    // now (clients / services / courses). Non-admin messages are unchanged.
    const getDisplayMessage = () => {
        if (isAdmin) {
            if (level === 'clients') {
                return {
                    title: 'Clients',
                    description: 'Choose a client to see the services they run — grades roll up from there.',
                    emptyMessage: 'No clients found',
                    emptySubMessage: 'Once a client is added and has course structures, it will appear here.',
                    searchPlaceholder: 'Search clients by name…',
                    filterLabel: 'Service type',
                };
            }
            if (level === 'services') {
                return {
                    title: currentClient?.name || 'Services',
                    description: 'Pick a service to open its courses.',
                    emptyMessage: 'No services found for this client',
                    emptySubMessage: 'Add a service mapping for this client to see it here.',
                    searchPlaceholder: 'Search services…',
                    filterLabel: 'Service type',
                };
            }
            return {
                title: currentService?.label || currentClient?.name || 'Courses',
                description: 'Open a course to review its assessment grades.',
                emptyMessage: 'No courses under this service',
                emptySubMessage: 'Add a course structure under this service mapping to see it here.',
                searchPlaceholder: 'Search courses by name…',
                filterLabel: 'Course level',
            };
        } else if (isStudent) {
            return {
                title: 'My Enrolled Courses',
                description: 'Select a course to view your grades',
                emptyMessage: 'No enrolled courses found',
                emptySubMessage: 'You are not enrolled in any courses yet. Contact your administrator.',
                searchPlaceholder: 'Search courses by name…',
                filterLabel: 'Category',
            };
        } else {
            return {
                title: 'My Assigned Courses',
                description: 'Select a course to manage grades',
                emptyMessage: 'No assigned courses found',
                emptySubMessage: 'You are not assigned to any courses yet.',
                searchPlaceholder: 'Search courses by name…',
                filterLabel: 'Category',
            };
        }
    };

    const displayInfo = getDisplayMessage();
    const roleLabel = isAdmin ? 'Admin' : isStudent ? 'Student' : 'Staff';
    const countLabel = isAdmin ? 'institution' : isStudent ? 'enrolled' : 'assigned';

    // The right-hand count chip reflects the current level. Non-admin still
    // reads as "N enrolled" / "N assigned" so their view is unchanged.
    const primaryChip = isAdmin
        ? level === 'clients'
            // Users icon for the "N clients" count — the client icon is
            // deliberately absent from the heading (see HeaderIcon /
            // clientColumns). `clientsTotal` is the server's whole-set count
            // for the current search, not just the visible page.
            ? { icon: Users, label: `${clientsTotal} clients` }
            : level === 'services'
                ? { icon: Layers, label: `${serviceBuckets.length} services` }
                : { icon: BookOpen, label: `${scopedCoursesForMapping.length} courses` }
        : { icon: BookOpen, label: `${displayedCourses.length} ${countLabel}` };

    // Result count for the toolbar's right-aligned meter — matches whichever
    // filtered list is currently rendered. At Level 1 this is the server's
    // whole-set total for the current search, not just the visible page.
    const resultCount = isAdmin
        ? level === 'clients' ? clientsTotal
            : level === 'services' ? filteredServices.length
                : filteredAdminCourses.length
        : filteredCourses.length;
    const resultNoun = isAdmin
        ? level === 'clients' ? (resultCount === 1 ? 'client' : 'clients')
            : level === 'services' ? (resultCount === 1 ? 'service' : 'services')
                : (resultCount === 1 ? 'course' : 'courses')
        : (resultCount === 1 ? 'course' : 'courses');

    // Icon for the header tile — adapts to the level so the visual anchors
    // the user in the drill-down at a glance. Level=clients deliberately
    // has no tile at all (see the JSX below): the "client" icon was noisy
    // in both the title row and the table's first column, so it's dropped
    // from both places.
    const HeaderIcon = isAdmin
        ? level === 'services' ? Layers : GraduationCap
        : GraduationCap;
    const showHeaderIcon = !(isAdmin && level === 'clients');
    // Capitalised alias so the icon component reads as a component in JSX
    // (safer than <primaryChip.icon /> across parsers).
    const PrimaryChipIcon = primaryChip.icon;

    // Any level-scoped filter/search is active — drives DataTable's empty state
    // ("no results" vs "no data") so the message and hint match the situation.
    const hasClientFilters = Boolean(searchTerm.trim()) || selectedCategory !== 'All';

    // ── DataTable column configs (admin drill-down levels) ───────────────
    // Fixed-layout tables (width percentages sum to 100%), so cells clip and
    // ellipsize instead of pushing the table past the card. Row click is
    // wired inside the render (a plain `<button>` inside the row that spans
    // the row via absolute positioning would fight the fixed layout, so the
    // primary cell hosts the button and the trailing chevron cell hosts a
    // second button targeting the same handler).
    const clientColumns: Column<Client>[] = [
        {
            key: 'name',
            label: 'Client',
            className: 'w-[48%] px-4',
            render: (c) => (
                <button
                    type="button"
                    onClick={() => goToServicesOf(c._id)}
                    className="group flex items-center gap-3 min-w-0 text-left"
                >
                    <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-heading group-hover:text-brand-strong transition-colors">{c.clientCompany}</span>
                        {c.description && (
                            <span className="block truncate text-2xs text-subtle mt-0.5">{c.description}</span>
                        )}
                    </span>
                </button>
            ),
        },
        {
            key: 'businessModel',
            label: 'Model',
            className: 'w-[16%] px-4',
            render: (c) => (
                <span className="truncate text-xs text-body">{c.businessModel || '—'}</span>
            ),
        },
        {
            key: 'status',
            label: 'Status',
            className: 'w-[14%] px-4',
            render: (c) => (
                <span className={`inline-flex h-5 items-center rounded-full px-2 text-2xs font-semibold ring-1 ring-inset ${c.status === 'active' ? 'bg-success-50 text-success-700 ring-success-500/20' : 'bg-ink-100 text-ink-700 ring-ink-500/20'}`}>
                    {c.status === 'active' ? 'Active' : 'Inactive'}
                </span>
            ),
        },
        {
            key: 'action',
            label: 'Action',
            className: 'w-[22%] px-4 text-right',
            render: (c) => (
                <button
                    type="button"
                    onClick={() => goToServicesOf(c._id)}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-brand-strong hover:underline"
                >
                    View services <ChevronRight className="w-3.5 h-3.5" />
                </button>
            ),
        },
    ];

    const serviceColumns: Column<ServiceBucket>[] = [
        {
            key: 'label',
            label: 'Service',
            className: 'w-[46%] px-4',
            render: (s) => (
                <button
                    type="button"
                    onClick={() => goToCoursesOf(s.id)}
                    className="group flex items-center gap-3 min-w-0 text-left"
                >
                    <span className="h-9 w-9 rounded-tile bg-brand-wash text-brand-strong flex items-center justify-center flex-shrink-0">
                        <Layers className="w-4 h-4" />
                    </span>
                    <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-heading group-hover:text-brand-strong transition-colors">{s.label}</span>
                        {s.hierarchyHint && (
                            <span className="block truncate text-2xs text-faint mt-0.5" title={s.hierarchyHint}>{s.hierarchyHint}</span>
                        )}
                    </span>
                </button>
            ),
        },
        {
            key: 'category',
            label: 'Category',
            className: 'w-[18%] px-4',
            render: (s) => (
                <span className="truncate text-xs text-body">{s.category || '—'}</span>
            ),
        },
        {
            key: 'courses',
            label: 'Courses',
            className: 'w-[14%] px-4 text-center',
            render: (s) => (
                <span className="inline-flex items-center gap-1 h-6 rounded-chip bg-ink-100 px-2 text-xs font-semibold text-ink-700 tabular-nums">
                    <BookOpen className="w-3 h-3 text-faint" />{s.courseCount}
                </span>
            ),
        },
        {
            key: 'action',
            label: 'Action',
            className: 'w-[22%] px-4 text-right',
            render: (s) => (
                <button
                    type="button"
                    onClick={() => goToCoursesOf(s.id)}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-brand-strong hover:underline"
                >
                    View courses <ChevronRight className="w-3.5 h-3.5" />
                </button>
            ),
        },
    ];

    const courseColumns: Column<Course>[] = [
        {
            key: 'name',
            label: 'Course',
            className: 'w-[54%] px-4',
            render: (course) => (
                <button
                    type="button"
                    onClick={() => handleStartCourse(course._id)}
                    className="group flex items-center gap-3 min-w-0 text-left"
                >
                    <span className="h-9 w-14 rounded-tile bg-ink-100 flex-shrink-0 overflow-hidden">
                        <img
                            src={course.courseImage || FALLBACK_IMG}
                            alt=""
                            className="w-full h-full object-cover"
                            onError={(e) => { e.currentTarget.src = FALLBACK_IMG; }}
                        />
                    </span>
                    <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-heading group-hover:text-brand-strong transition-colors">{course.courseName}</span>
                        {course.serviceType && (
                            <span className="block truncate text-2xs text-subtle mt-0.5">{course.serviceType}</span>
                        )}
                    </span>
                </button>
            ),
        },
        {
            key: 'level',
            label: 'Level',
            className: 'w-[20%] px-4',
            render: (course) => {
                const lvl = levelTone(course.courseLevel);
                return course.courseLevel ? (
                    <span className={`inline-flex h-5 items-center rounded-full px-2 text-2xs font-semibold ring-1 ring-inset ${lvl.chip}`}>{lvl.label}</span>
                ) : (
                    <span className="text-2xs text-faint">—</span>
                );
            },
        },
        {
            key: 'action',
            label: 'Action',
            className: 'w-[26%] px-4 text-right',
            render: (course) => (
                <button
                    type="button"
                    onClick={() => handleStartCourse(course._id)}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-brand-strong hover:underline"
                >
                    Open gradebook <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
            ),
        },
    ];

    // Page content — enterprise course-selection workspace (the gradebook entry).
    // Outer background is white (`bg-surface`) so the whole page reads as one
    // continuous white surface; the DataTable card below still uses a hairline
    // border to separate itself from the header row without needing a gray
    // gutter to sit on.
    const pageContent = (
        <div className="h-full flex flex-col bg-surface">
            {/* Header */}
            <div className="flex-shrink-0 bg-surface border-b border-hairline px-5 md:px-7 pt-3 pb-3">
                <Breadcrumbs
                    level={isAdmin ? level : 'clients'}
                    clientName={currentClient?.name}
                    serviceLabel={currentService?.label}
                    onGoClients={goToClients}
                    onGoServices={goToServicesFromCourses}
                />

                <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-3 min-w-0">
                        {/* Back arrow only appears once the user has drilled in.
                            Sits before the icon tile so it reads as "go up one
                            level" rather than as a page-level back button. */}
                        {isAdmin && level !== 'clients' && (
                            <button
                                type="button"
                                aria-label="Back one level"
                                onClick={() => (level === 'services' ? goToClients() : goToServicesFromCourses())}
                                className="h-9 w-9 rounded-full border border-hairline-strong bg-surface text-subtle hover:text-heading hover:bg-row-hover transition-colors flex items-center justify-center flex-shrink-0"
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </button>
                        )}
                        {showHeaderIcon && (
                            <div className="h-10 w-10 rounded-tile bg-brand-wash text-brand-strong flex items-center justify-center flex-shrink-0">
                                <HeaderIcon className="w-[22px] h-[22px]" strokeWidth={2} />
                            </div>
                        )}
                        <div className="min-w-0">
                            <h1 className="text-lg font-semibold text-heading tracking-[-0.01em] leading-tight truncate">{displayInfo.title}</h1>
                            <p className="text-xs text-subtle leading-tight mt-0.5">{displayInfo.description}</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 h-7 rounded-full border border-hairline bg-surface px-2.5 text-xs font-medium text-body">
                            <Users className="w-3.5 h-3.5 text-faint" />{roleLabel}
                        </span>
                        <span className="inline-flex items-center gap-1.5 h-7 rounded-full border border-hairline bg-surface px-2.5 text-xs font-medium text-body tabular-nums">
                            <PrimaryChipIcon className="w-3.5 h-3.5 text-faint" />{primaryChip.label}
                        </span>
                    </div>
                </div>

                {/* One toolbar — search + level-scoped filter */}
                <div className="mt-3 flex items-center gap-2 flex-wrap">
                    <div className="relative flex-1 min-w-[200px] max-w-md">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
                        <input
                            type="text"
                            placeholder={displayInfo.searchPlaceholder}
                            className="h-9 w-full rounded-control border border-hairline-strong bg-surface pl-9 pr-8 text-sm text-body placeholder:text-faint transition-colors focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                        {searchTerm && (
                            <button type="button" aria-label="Clear search" onClick={() => setSearchTerm("")} className="absolute right-2 top-1/2 inline-flex size-6 -translate-y-1/2 items-center justify-center rounded-chip text-faint hover:bg-ink-100 hover:text-heading transition-colors"><X className="h-3.5 w-3.5" /></button>
                        )}
                    </div>

                    <div className="relative">
                        <SlidersHorizontal className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-faint" />
                        <select
                            aria-label={displayInfo.filterLabel}
                            title={displayInfo.filterLabel}
                            className="h-9 rounded-control border border-hairline-strong bg-surface pl-8 pr-8 text-sm text-body focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15 min-w-[150px] appearance-none cursor-pointer"
                            value={selectedCategory}
                            onChange={(e) => setSelectedCategory(e.target.value)}
                        >
                            {filterOptions.map(option => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                        </select>
                    </div>

                    <span className="ml-auto text-2xs text-subtle tabular-nums">
                        {showCourseLoading ? 'Loading…' : `${resultCount} ${resultNoun}`}
                    </span>
                </div>
            </div>

            {/* Content region — for admin the DataTable card fills the
                panel and owns its own scroll (Client-Management pattern),
                so the outer div is flex-col with min-h-0 and NO scroll.
                For non-admins the legacy card grid keeps its overflow-y-auto
                scroll behavior (rendered inside its own wrapper below). */}
            <div className="flex-1 min-h-0 flex flex-col px-5 md:px-7 py-5">
                <AnimatePresence mode="wait">
                    {/* Card-grid skeleton is only meaningful for non-admins
                        (they still render the card grid). Admin flows go
                        through the DataTable card below, which shows its
                        OWN in-table skeleton via `isLoading={…}` — so we
                        skip this outer skeleton when isAdmin, otherwise
                        the drill-down never gets a chance to render its
                        card while the query is pending. */}
                    {showCourseLoading && !isAdmin ? (
                        <motion.div key="loading" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                            {Array.from({ length: 8 }).map((_, i) => (
                                <div key={i} className="rounded-tile border border-hairline bg-surface overflow-hidden shadow-xs">
                                    <div className="h-28 bg-ink-100 animate-pulse" style={{ animationDelay: `${i * 60}ms` }} />
                                    <div className="p-3.5 space-y-2">
                                        <div className="h-3.5 w-3/4 rounded bg-ink-100 animate-pulse" />
                                        <div className="h-3 w-1/2 rounded bg-ink-100 animate-pulse" />
                                        <div className="h-6 w-full rounded-chip bg-ink-100 animate-pulse mt-2" />
                                    </div>
                                </div>
                            ))}
                        </motion.div>
                    ) : hasError ? (
                        <motion.div key="error" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center justify-center text-center py-16">
                            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-danger-50 text-danger-700 mb-3"><AlertCircle className="h-7 w-7" /></span>
                            <h3 className="text-base font-semibold text-heading">Error loading courses</h3>
                            <p className="mt-1 text-sm text-subtle max-w-sm">{errorMessage || 'Something went wrong'}</p>
                            <button onClick={handleRetry} className="mt-4 inline-flex items-center gap-1.5 h-9 px-4 rounded-control bg-brand-strong text-white text-sm font-semibold shadow-xs hover:bg-brand-800 transition-colors">Try again</button>
                        </motion.div>
                    ) : filteredCourses.length === 0 && !userId && !isAdmin ? (
                        <motion.div key="no-user" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center justify-center text-center py-16">
                            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-ink-100 text-subtle mb-3"><Users className="h-7 w-7" /></span>
                            <h3 className="text-base font-semibold text-heading">User not identified</h3>
                            <p className="mt-1 text-sm text-subtle">Please log in to view courses</p>
                            <button onClick={() => router.push('/login')} className="mt-4 inline-flex items-center gap-1.5 h-9 px-4 rounded-control bg-brand-strong text-white text-sm font-semibold shadow-xs hover:bg-brand-800 transition-colors">Go to login</button>
                        </motion.div>
                    ) : isAdmin ? (
                        // ── Admin drill-down ─────────────────────────────────
                        // Client-Management-style list rows via the shared
                        // DataTable primitive. The whole list lives inside ONE
                        // white card (rounded-xl border shadow-xs) that fills
                        // the panel height (flex-1 min-h-0), so the tables get
                        // fillHeight and scroll internally — the outer page
                        // never scrolls, matching Clients / Services / Users.
                        // A single AnimatePresence still keys on `level`, so
                        // the level swap remains a smooth horizontal slide.
                        <AnimatePresence mode="wait" custom={slideDir}>
                            <motion.div
                                key={level}
                                custom={slideDir}
                                variants={{
                                    enter: (dir: 1 | -1) => ({ opacity: 0, x: 24 * dir }),
                                    center: { opacity: 1, x: 0 },
                                    exit: (dir: 1 | -1) => ({ opacity: 0, x: -24 * dir }),
                                }}
                                initial="enter"
                                animate="center"
                                exit="exit"
                                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                                className="flex flex-1 min-h-0 flex-col"
                            >
                                <div className="flex flex-1 min-h-0 flex-col bg-surface rounded-xl border border-hairline shadow-xs overflow-hidden">
                                    {level === 'clients' && (
                                        <>
                                            <DataTable<Client>
                                                rows={filteredClients}
                                                columns={clientColumns}
                                                rowKey={(r) => r._id}
                                                sortKey={null}
                                                sortDir="asc"
                                                onSort={() => {}}
                                                isLoading={isLoadingClientsList}
                                                isFiltered={Boolean(searchTerm.trim())}
                                                fixedLayout
                                                fillHeight
                                                emptyTitle={searchTerm.trim() ? 'No clients match your search' : displayInfo.emptyMessage}
                                                emptyHint={searchTerm.trim() ? 'Try widening or clearing it to see more.' : displayInfo.emptySubMessage}
                                            />
                                            {!isLoadingClientsList && clientsTotal > 0 && (
                                                <div className="flex-shrink-0">
                                                    <TableFooter
                                                        from={clientsRangeFrom}
                                                        to={clientsRangeTo}
                                                        total={clientsTotal}
                                                        pageSize={clientsPageSize}
                                                        onPageSize={(n) => { setClientsPageSize(n); setClientsPage(1); }}
                                                        currentPage={clientsSafePage}
                                                        totalPages={clientsTotalPages || 1}
                                                        onPage={(p) => setClientsPage(p)}
                                                    />
                                                </div>
                                            )}
                                        </>
                                    )}
                                    {level === 'services' && (
                                        <DataTable<ServiceBucket>
                                            rows={filteredServices}
                                            columns={serviceColumns}
                                            rowKey={(r) => r.id}
                                            sortKey={null}
                                            sortDir="asc"
                                            onSort={() => {}}
                                            isLoading={isLoadingCourses}
                                            isFiltered={hasClientFilters}
                                            fixedLayout
                                            fillHeight
                                            emptyTitle={hasClientFilters ? 'No services match your filters' : displayInfo.emptyMessage}
                                            emptyHint={hasClientFilters ? 'Try widening or clearing them to see more.' : displayInfo.emptySubMessage}
                                        />
                                    )}
                                    {level === 'courses' && (
                                        <DataTable<Course>
                                            rows={filteredAdminCourses}
                                            columns={courseColumns}
                                            rowKey={(r) => r._id}
                                            sortKey={null}
                                            sortDir="asc"
                                            onSort={() => {}}
                                            isLoading={isLoadingCourses}
                                            isFiltered={hasClientFilters}
                                            fixedLayout
                                            fillHeight
                                            emptyTitle={hasClientFilters ? 'No courses match your filters' : displayInfo.emptyMessage}
                                            emptyHint={hasClientFilters ? 'Try widening or clearing them to see more.' : displayInfo.emptySubMessage}
                                        />
                                    )}
                                </div>
                            </motion.div>
                        </AnimatePresence>
                    ) : filteredCourses.length === 0 ? (
                        <motion.div key="empty" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center justify-center text-center py-16">
                            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-wash text-brand-strong mb-3"><GraduationCap className="h-7 w-7" /></span>
                            <h3 className="text-base font-semibold text-heading">{displayInfo.emptyMessage}</h3>
                            <p className="mt-1 text-sm text-subtle max-w-sm">{displayInfo.emptySubMessage}</p>
                            <p className="mt-1 text-xs text-faint">Please contact your administrator for access.</p>
                            <button onClick={() => router.push('/lms')} className="mt-4 inline-flex items-center gap-1.5 h-9 px-4 rounded-control border border-hairline-strong bg-surface text-sm font-semibold text-body hover:bg-row-hover transition-colors">Go to dashboard</button>
                        </motion.div>
                    ) : (
                        // ── Non-admin: unchanged flat course grid ───────────
                        <div key="courses">
                            <motion.div
                                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
                                initial="hidden"
                                animate="visible"
                                variants={{ visible: { transition: { staggerChildren: 0.04 } } }}
                            >
                                {filteredCourses.map((course: Course) => {
                                    const lvl = levelTone(course.courseLevel);
                                    return (
                                        <motion.button
                                            type="button"
                                            key={course._id}
                                            variants={{ hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0 } }}
                                            whileHover={{ y: -3 }}
                                            transition={{ type: 'spring', stiffness: 300, damping: 24 }}
                                            onClick={() => handleStartCourse(course._id)}
                                            className="group text-left rounded-tile border border-hairline bg-surface overflow-hidden shadow-xs hover:shadow-md hover:border-brand-300 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30"
                                        >
                                            <div className="relative h-28 overflow-hidden bg-ink-100">
                                                <img
                                                    src={course.courseImage || FALLBACK_IMG}
                                                    alt={course.courseName}
                                                    className="w-full h-full object-cover group-hover:scale-[1.04] transition-transform duration-300"
                                                    onError={(e) => { e.currentTarget.src = FALLBACK_IMG; }}
                                                />
                                                {course.courseLevel && (
                                                    <span className={`absolute top-2 left-2 inline-flex h-5 items-center rounded-full px-2 text-2xs font-semibold ring-1 ring-inset backdrop-blur-sm ${lvl.chip}`}>
                                                        {lvl.label}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="p-3.5">
                                                <h3 className="text-sm font-semibold text-heading line-clamp-2 leading-snug group-hover:text-brand-strong transition-colors">{course.courseName}</h3>
                                                {course.serviceType && (
                                                    <span className="mt-1 inline-flex items-center gap-1 text-2xs font-medium text-subtle">
                                                        <LayoutGrid className="w-3 h-3 text-faint" />{course.serviceType}
                                                    </span>
                                                )}
                                                <div className="mt-3 flex items-center justify-between border-t border-hairline pt-2.5">
                                                    <span className="text-xs font-semibold text-brand-strong">Open gradebook</span>
                                                    <ArrowUpRight className="w-4 h-4 text-faint group-hover:text-brand-strong group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
                                                </div>
                                            </div>
                                        </motion.button>
                                    );
                                })}
                            </motion.div>

                            {/* End of results (non-admin) */}
                            {filteredCourses.length > 0 && (
                                <div className="text-center py-6">
                                    <span className="inline-flex items-center gap-2 rounded-full border border-hairline bg-surface px-4 py-1.5 text-xs text-subtle">
                                        <BookOpen className="w-3.5 h-3.5 text-faint" />
                                        You&apos;ve viewed all {isStudent ? 'enrolled' : 'assigned'} courses ({filteredCourses.length})
                                    </span>
                                </div>
                            )}
                        </div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );

    // Show loading state while determining role
    if (userRole === null) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-surface">
                <Loading size="size-8" />
            </div>
        );
    }

    // Conditionally wrap with appropriate layout based on user role.
    //
    // Students MUST land in StudentLayout, same as every other student route
    // (courses, notifications, profile, feedback, calendar all branch this
    // way). Before this, a student reaching Grades from the dashboard's
    // "My Grades" button fell through to StaffLayout and got the staff rail —
    // a different set of entries under different labels, none of it driven by
    // the student's own permissions, so the sidebar appeared to change
    // identity from one page to the next.
    if (userRole === 'admin' || userRole === 'ldhead' || userRole === 'subhead' || userRole === 'programcoordinator') {
        return <DashboardLayout>{pageContent}</DashboardLayout>;
    }

    if (userRole === 'student' || isStudent) {
        return <StudentLayout>{pageContent}</StudentLayout>;
    }

    // All other roles (faculty, staff, etc.) get StaffLayout
    return <StaffLayout>{pageContent}</StaffLayout>;
}
