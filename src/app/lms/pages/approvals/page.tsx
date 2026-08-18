"use client";

/**
 * Admin-side Approvals — client-based, person-specific flow.
 *
 * Chains view is a three-step drill-down:
 *   Clients → (one client's) Courses → Set Approval.
 * The Queue tab (items waiting on the signed-in user) is unchanged apart
 * from the payload it consumes — its filtering is now person-specific
 * server-side, so a manager sees only requests actually pinned to them.
 *
 * Layout: the page adopts the shared "non-scrolling shell + inner
 * scrollable table body + sticky pager footer" recipe (the same one the
 * Client Management and Service Mapping listings use). The root becomes
 * a flex column that consumes DashboardLayout's <main> height, the
 * header + tabs + toolbar render as natural-height siblings, and each
 * tab's card is `flex flex-1 min-h-0 flex-col` so its body scrolls
 * INSIDE the card while the TableFooter sits below the body at
 * natural height. `min-h-0` on every level is load-bearing — dropping
 * any of them collapses the chain and the footer is pushed off-screen.
 *
 * Data sources reused as-is:
 *   • GET /client-management/getAll        — institution's clients
 *   • GET /courses-structure/getAll        — institution's courses (filter
 *                                             by clientId in the browser;
 *                                             no per-client server endpoint
 *                                             exists, this matches how
 *                                             coursestructure/page already
 *                                             correlates courses to clients)
 *   • GET /approvals/pending               — the caller's actual queue
 *   • GET/PUT /courses/:id/approval-hierarchy — hierarchy config
 *
 * Set Approval opens ApprovalHierarchyModal, which now renders per-level
 * Role + Person dropdowns (users filtered by the selected role, loaded in
 * one payload alongside the hierarchy).
 */

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import DashboardLayout from "../../component/layout";
import ApprovalHierarchyModal from "../../component/ApprovalHierarchyModal";
import TableFooter from "@/app/lms/shared/listing/TableFooter";
import { ArrowLeft, ChevronRight, Search, Users } from "lucide-react";
import { api } from "@/lib/apiClient";
import { queryKeys } from "@/lib/queryKeys";
import { useClients } from "@/apiServices/clientManagementService";
import { courseStructuresSummaryQuery } from "@/apiServices/createCourseStucture";
import { readStoredUserData } from "../../shared/ui/navItems";

interface PendingApproval {
  exerciseId: string;
  exerciseName?: string;
  courseId?: string;
  tabType?: string;
  subcategory?: string;
  step?: { order?: number; roleName?: string; userId?: string | null; userName?: string };
  currentStep?: number;
  totalSteps?: number;
  initiatedAt?: string;
  // > 0 means the trainer re-requested approval after a reject.
  resubmissionCount?: number;
  approvalScope?: string;
}

interface CourseRow {
  _id: string;
  courseName?: string;
  courseCode?: string;
  clientId?: string;
  clientName?: string;
  approvalHierarchy?: {
    // steps now carry userName as well — the person actually assigned.
    steps?: { order?: number; roleId?: string; roleName?: string; userId?: string | null; userName?: string }[];
  };
  // Name of the institution's L&D default approver role, or null when the
  // institution has none (then there is NO fallback chain to display).
  defaultApproverRole?: string | null;
}

interface ClientRow {
  _id: string;
  clientCompany?: string;
  status?: string;
}

const fmtDate = (iso?: string): string => {
  if (!iso) return "—";
  const d = new Date(iso);
  return isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
};

const tabLabel = (t?: string): string =>
  t === "You_Do" ? "Assessment" : t === "We_Do" ? "Assignment" : t || "—";

type Tab = "queue" | "chains";

export default function ApprovalsPage() {
  const [tab, setTab] = useState<Tab>("queue");

  // ── Queue ──────────────────────────────────────────────────────────────
  // Per-user data, so the key carries the stored user id (a shared browser
  // must never paint another account's queue from cache).
  const [userId] = useState<string | null>(() => readStoredUserData()?._id ?? null);
  const queueQuery = useQuery<{ success?: boolean; data?: PendingApproval[] }>({
    queryKey: queryKeys.approvals.pending(userId),
    queryFn: () => api.get("/approvals/pending"),
    enabled: !!userId,
    staleTime: 30_000,
    // Approvals are acted on from OTHER pages (view-resources) that don't
    // invalidate this key — match the old fetch-per-mount freshness.
    refetchOnMount: "always",
  });
  const items: PendingApproval[] = useMemo(
    () => (Array.isArray(queueQuery.data?.data) ? queueQuery.data.data : []),
    [queueQuery.data],
  );
  const qLoading = queueQuery.isPending;
  const qError = queueQuery.isError
    ? (queueQuery.error as Error)?.message || "Could not load approvals"
    : "";

  // ── Chains: two-step drill-down ────────────────────────────────────────
  // selectedClient=null → showing the Clients list.
  // selectedClient=<row> → showing that client's Courses list.
  // Both lists ride the app's shared caches (clientManagementKeys.lists()
  // and ['courseStructures','summary']), loaded lazily on first entry into
  // the Chains tab — mutations elsewhere (Business Management client CRUD,
  // course saves, hierarchy saves) invalidate them, which the page's old
  // private raw-fetch copies never noticed.
  const clientsQuery = useClients({ enabled: tab === "chains" });
  const clients: ClientRow[] = (clientsQuery.data as ClientRow[] | undefined) ?? [];
  const clientsLoading = tab === "chains" && clientsQuery.isPending;
  const clientsLoaded = clientsQuery.isSuccess;
  const clientsError = clientsQuery.isError
    ? (clientsQuery.error as Error)?.message || "Could not load clients"
    : "";

  const coursesQuery = useQuery({
    ...courseStructuresSummaryQuery(),
    enabled: tab === "chains",
  });
  const courses: CourseRow[] = (coursesQuery.data as CourseRow[] | undefined) ?? [];
  const coursesLoading = tab === "chains" && coursesQuery.isPending;
  const coursesLoaded = coursesQuery.isSuccess;
  const coursesError = coursesQuery.isError
    ? (coursesQuery.error as Error)?.message || "Could not load courses"
    : "";

  const [selectedClient, setSelectedClient] = useState<ClientRow | null>(null);
  const [modalCourse, setModalCourse] = useState<CourseRow | null>(null);
  const [search, setSearch] = useState("");

  // ── Pagination ─────────────────────────────────────────────────────────
  // One shared page size (user's display preference), one page counter per
  // list. Each counter is clamped by an effect below when its list shrinks
  // (search filter tightens, drill-in switches to a smaller client, etc.).
  const [pageSize, setPageSize] = useState<number>(10);
  const [queuePage, setQueuePage] = useState<number>(1);
  const [clientsPage, setClientsPage] = useState<number>(1);
  const [coursesPage, setCoursesPage] = useState<number>(1);

  // ── Derived ────────────────────────────────────────────────────────────
  const q = search.trim().toLowerCase();

  const filteredClients = useMemo(() => {
    const list = q
      ? clients.filter((c) => (c.clientCompany || "").toLowerCase().includes(q))
      : clients;
    return [...list].sort((a, b) =>
      (a.clientCompany || "").localeCompare(b.clientCompany || ""),
    );
  }, [clients, q]);

  // Approx count of courses per client — used to nudge managers toward the
  // clients they still have work in without a second endpoint call.
  const courseCountByClient = useMemo(() => {
    const map = new Map<string, number>();
    courses.forEach((c) => {
      const key = c.clientId ? String(c.clientId) : "";
      if (!key) return;
      map.set(key, (map.get(key) || 0) + 1);
    });
    return map;
  }, [courses]);

  const coursesForSelectedClient = useMemo(() => {
    if (!selectedClient) return [];
    const clientId = String(selectedClient._id);
    const list = courses.filter((c) => String(c.clientId || "") === clientId);
    if (!q) return list;
    return list.filter(
      (c) =>
        (c.courseName || "").toLowerCase().includes(q) ||
        (c.courseCode || "").toLowerCase().includes(q),
    );
  }, [courses, selectedClient, q]);

  // ── Paginated slices ───────────────────────────────────────────────────
  // The state counter is clamped INLINE here — using a useEffect to reset
  // the page would run only after commit/paint, so a search that shrinks
  // the list past the current page flashes an empty tbody for one frame
  // before the effect resets to page 1. `safeXPage` derives from the
  // just-computed totalPages and is fed to both the slice AND the pager,
  // so the render is coherent on the same tick. `setXPage` in
  // `onPageSize` still resets the state to 1 so the pager doesn't stay
  // on a lingering out-of-range state value.
  const queueTotal = items.length;
  const queueTotalPages = Math.max(1, Math.ceil(queueTotal / pageSize));
  const safeQueuePage = Math.min(queuePage, queueTotalPages);
  const queueSlice = useMemo(
    () => items.slice((safeQueuePage - 1) * pageSize, safeQueuePage * pageSize),
    [items, safeQueuePage, pageSize],
  );

  const clientsTotal = filteredClients.length;
  const clientsTotalPages = Math.max(1, Math.ceil(clientsTotal / pageSize));
  const safeClientsPage = Math.min(clientsPage, clientsTotalPages);
  const clientsSlice = useMemo(
    () => filteredClients.slice((safeClientsPage - 1) * pageSize, safeClientsPage * pageSize),
    [filteredClients, safeClientsPage, pageSize],
  );

  const coursesTotal = coursesForSelectedClient.length;
  const coursesTotalPages = Math.max(1, Math.ceil(coursesTotal / pageSize));
  const safeCoursesPage = Math.min(coursesPage, coursesTotalPages);
  const coursesSlice = useMemo(
    () =>
      coursesForSelectedClient.slice(
        (safeCoursesPage - 1) * pageSize,
        safeCoursesPage * pageSize,
      ),
    [coursesForSelectedClient, safeCoursesPage, pageSize],
  );

  const tabBtn = (id: Tab, label: string) => (
    <button
      type="button"
      onClick={() => {
        setTab(id);
        // Clear the drill-in when leaving Chains so re-entering starts on
        // the Clients list — the requirement's "first-level view".
        if (id !== "chains") setSelectedClient(null);
        setSearch("");
      }}
      className={`px-3.5 py-2 text-sm rounded-t-md border-b-2 -mb-px transition-colors ${
        tab === id
          ? "border-orange-500 text-orange-700 font-bold"
          : "border-transparent text-gray-500 hover:text-gray-800"
      }`}
    >
      {label}
    </button>
  );

  // Compact renderer for a course row's current approval chain.
  const renderChain = (course: CourseRow) => {
    const steps = (course.approvalHierarchy?.steps || [])
      .slice()
      .sort((a, b) => (a.order || 0) - (b.order || 0));
    if (steps.length > 0) {
      return (
        <div className="mt-1 text-[11px] text-gray-500">
          {steps
            .map(
              (s, i) =>
                `${i + 1}. ${s.roleName || "?"}${
                  s.userName ? ` (${s.userName})` : " — no person set"
                }`,
            )
            .join("  →  ")}
          {"  →  Students"}
        </div>
      );
    }
    return course.defaultApproverRole ? (
      <div className="mt-1 text-[11px] font-medium text-amber-600">
        1. {course.defaultApproverRole} (default) → Students
      </div>
    ) : (
      <div className="mt-1 text-[11px] font-medium text-red-600">
        No approval chain — set approvers
      </div>
    );
  };

  // Small helper — the sticky-thead <th> class pattern. Border/bg on the
  // <th> (not the <tr>) because Chrome scrolls a sticky <tr>'s own border
  // out from under the sticky content.
  const thCls =
    "px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wide text-gray-400 bg-white border-b border-gray-100";

  return (
    <DashboardLayout>
      {/* Root flex column — consumes <main>'s bounded height so children
          can share it. h-full/min-h-0/flex-col are all load-bearing. */}
      <div className="flex flex-col h-full min-h-0 min-w-0 p-6 max-w-6xl">
        {/* Title header — natural height, sits above the card. */}
        <div className="shrink-0 mb-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
            Approvals
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-gray-900">
            Approvals
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Review items waiting on you, and configure who approves for each course, per client.
          </p>
        </div>

        {/* Tab strip — natural height. */}
        <div className="shrink-0 flex gap-1 border-b border-gray-200 mb-4">
          {tabBtn("queue", "Queue")}
          {tabBtn("chains", "Approval chains")}
        </div>

        {/* Chains toolbar (search / breadcrumb / back) — natural height,
            outside the card so the card can be the sole scroll+pager. */}
        {tab === "chains" && !selectedClient && (
          <div className="shrink-0 mb-3 flex items-center gap-3">
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search clients…"
                className="w-72 pl-8 pr-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500/40"
              />
            </div>
            <span className="ml-auto text-xs text-gray-400">
              Pick a client to see its courses.
            </span>
          </div>
        )}
        {tab === "chains" && selectedClient && (
          <div className="shrink-0 mb-3 flex items-center gap-3 flex-wrap">
            <button
              type="button"
              onClick={() => {
                setSelectedClient(null);
                setSearch("");
              }}
              className="inline-flex items-center gap-1 text-xs font-semibold text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> All clients
            </button>
            <div className="text-sm text-gray-400">/</div>
            <div className="text-sm font-semibold text-gray-900">
              {selectedClient.clientCompany || "Unnamed client"}
            </div>
            <div className="relative ml-auto">
              <Search className="w-4 h-4 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search this client's courses…"
                className="w-72 pl-8 pr-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500/40"
              />
            </div>
          </div>
        )}

        {/* ── Queue card ── */}
        {tab === "queue" && (
          <div className="flex flex-1 min-h-0 flex-col rounded-xl border border-gray-200 bg-white overflow-hidden">
            {/* Card header — natural height, doesn't participate in scroll */}
            <div className="shrink-0 flex items-center gap-3 px-4 py-3 border-b border-gray-100">
              <h2 className="text-xs font-bold uppercase tracking-wide text-gray-500">
                Waiting on you
              </h2>
              {!qLoading && !qError && (
                <span className="ml-auto text-xs font-semibold text-gray-400">
                  {queueTotal} item{queueTotal === 1 ? "" : "s"}
                </span>
              )}
            </div>

            {/* Scroll body */}
            <div className="flex-1 min-h-0 overflow-y-auto">
              {qLoading && (
                <div className="px-4 py-10 text-center text-sm text-gray-400">Loading…</div>
              )}
              {!qLoading && qError && (
                <div className="px-4 py-8 text-center text-sm text-red-600">{qError}</div>
              )}
              {!qLoading && !qError && queueTotal === 0 && (
                <div className="px-4 py-12 text-center">
                  <p className="text-sm font-semibold text-gray-700">Nothing waiting on you</p>
                  <p className="mt-1 text-xs text-gray-400">
                    Items appear here when an assessment or assignment reaches the level you were
                    personally assigned to approve.
                  </p>
                </div>
              )}
              {!qLoading && !qError && queueTotal > 0 && (
                <table className="w-full text-sm">
                  <thead className="sticky top-0 z-10">
                    <tr>
                      <th className={thCls}>Item</th>
                      <th className={thCls}>Type</th>
                      <th className={thCls}>Category</th>
                      <th className={thCls}>Step</th>
                      <th className={thCls}>Requested</th>
                      <th className={thCls} />
                    </tr>
                  </thead>
                  <tbody>
                    {queueSlice.map((it) => (
                      <tr key={it.exerciseId} className="border-t border-gray-100 hover:bg-orange-50/40">
                        <td className="px-4 py-3 font-semibold text-gray-900">
                          <span className="inline-flex items-center gap-1.5 flex-wrap">
                            {it.exerciseName || "Untitled"}
                            {(it.resubmissionCount || 0) > 0 && (
                              <span
                                title="The trainer addressed earlier feedback and re-requested approval."
                                className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-violet-100 text-violet-700 border border-violet-200"
                              >
                                Re-request
                              </span>
                            )}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-600">{tabLabel(it.tabType)}</td>
                        <td className="px-4 py-3 text-gray-600">{it.subcategory || "—"}</td>
                        <td className="px-4 py-3 text-gray-600 tabular-nums">
                          {it.currentStep || 1} of {it.totalSteps || 1}
                          {it.step?.roleName ? ` · ${it.step.roleName}` : ""}
                          {it.step?.userName ? ` · ${it.step.userName}` : ""}
                        </td>
                        <td className="px-4 py-3 text-gray-500 tabular-nums">
                          {fmtDate(it.initiatedAt)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {it.courseId && (
                            <a
                              className="text-xs font-semibold text-orange-700 hover:underline"
                              href={`/lms/pages/coursestructure/view-resources?courseId=${it.courseId}&tabType=${it.tabType || "You_Do"}`}
                            >
                              Review →
                            </a>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Pager — natural height, always visible below the scroll body */}
            {!qLoading && !qError && (
              <TableFooter
                from={queueTotal === 0 ? 0 : (safeQueuePage - 1) * pageSize + 1}
                to={Math.min(safeQueuePage * pageSize, queueTotal)}
                total={queueTotal}
                pageSize={pageSize}
                onPageSize={(n) => {
                  setPageSize(n);
                  setQueuePage(1);
                }}
                currentPage={safeQueuePage}
                totalPages={queueTotalPages}
                onPage={setQueuePage}
              />
            )}
          </div>
        )}

        {/* ── Chains: Clients list ── */}
        {tab === "chains" && !selectedClient && (
          <div className="flex flex-1 min-h-0 flex-col rounded-xl border border-gray-200 bg-white overflow-hidden">
            <div className="flex-1 min-h-0 overflow-y-auto">
              {/* React 18 fires the fetch effect after paint, so the first
                  render commits with loading=false / loaded=false / rows=[].
                  Treat "not-yet-loaded" the same as "loading" so the card
                  never flashes empty in that one-frame window. */}
              {(clientsLoading || (!clientsError && !clientsLoaded)) && (
                <div className="px-4 py-10 text-center text-sm text-gray-400">
                  Loading clients…
                </div>
              )}
              {!clientsLoading && clientsError && (
                <div className="px-4 py-8 text-center text-sm text-red-600">
                  {clientsError}
                </div>
              )}
              {!clientsLoading && !clientsError && clientsLoaded && clientsTotal === 0 && (
                <div className="px-4 py-12 text-center text-sm text-gray-500">
                  No clients found.
                </div>
              )}
              {!clientsLoading && !clientsError && clientsTotal > 0 && (
                <table className="w-full text-sm">
                  <tbody>
                    {clientsSlice.map((cl) => {
                      const n = courseCountByClient.get(String(cl._id)) || 0;
                      const inactive = cl.status && cl.status !== "active";
                      return (
                        <tr
                          key={cl._id}
                          className="border-t border-gray-100 first:border-t-0 hover:bg-orange-50/40 cursor-pointer"
                          onClick={() => {
                            setSelectedClient(cl);
                            setSearch("");
                          }}
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <span className="w-8 h-8 rounded-full bg-orange-50 text-orange-700 border border-orange-200 flex items-center justify-center text-xs font-bold flex-shrink-0">
                                {(cl.clientCompany || "?").charAt(0).toUpperCase()}
                              </span>
                              <div className="min-w-0">
                                <div className="font-semibold text-gray-900 truncate">
                                  {cl.clientCompany || "Unnamed client"}
                                </div>
                                <div className="text-[11px] text-gray-500 flex items-center gap-2">
                                  <span className="inline-flex items-center gap-1">
                                    <Users className="w-3 h-3" />
                                    {coursesLoaded ? (
                                      <>{n} course{n === 1 ? "" : "s"}</>
                                    ) : (
                                      <>Loading courses…</>
                                    )}
                                  </span>
                                  {inactive && (
                                    <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-500 border border-gray-200">
                                      Inactive
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-orange-700">
                              Open <ChevronRight className="w-3.5 h-3.5" />
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {!clientsLoading && !clientsError && (
              <TableFooter
                from={clientsTotal === 0 ? 0 : (safeClientsPage - 1) * pageSize + 1}
                to={Math.min(safeClientsPage * pageSize, clientsTotal)}
                total={clientsTotal}
                pageSize={pageSize}
                onPageSize={(n) => {
                  setPageSize(n);
                  setClientsPage(1);
                }}
                currentPage={safeClientsPage}
                totalPages={clientsTotalPages}
                onPage={setClientsPage}
              />
            )}
          </div>
        )}

        {/* ── Chains: Courses list for the selected client ── */}
        {tab === "chains" && selectedClient && (
          <div className="flex flex-1 min-h-0 flex-col rounded-xl border border-gray-200 bg-white overflow-hidden">
            <div className="flex-1 min-h-0 overflow-y-auto">
              {coursesLoading && (
                <div className="px-4 py-10 text-center text-sm text-gray-400">
                  Loading courses…
                </div>
              )}
              {!coursesLoading && coursesError && (
                <div className="px-4 py-8 text-center text-sm text-red-600">
                  {coursesError}
                </div>
              )}
              {!coursesLoading && !coursesError && coursesTotal === 0 && (
                <div className="px-4 py-12 text-center text-sm text-gray-500">
                  {q
                    ? `No courses match "${search}" under this client.`
                    : `No courses for ${selectedClient.clientCompany || "this client"}.`}
                </div>
              )}
              {!coursesLoading && !coursesError && coursesTotal > 0 && (
                <table className="w-full text-sm">
                  <tbody>
                    {coursesSlice.map((c) => (
                      <tr
                        key={c._id}
                        className="border-t border-gray-100 first:border-t-0 hover:bg-orange-50/40"
                      >
                        <td className="px-4 py-3">
                          <div className="font-semibold text-gray-900">
                            {c.courseName || "Untitled course"}
                          </div>
                          <div className="text-xs text-gray-400">{c.courseCode || "—"}</div>
                          {renderChain(c)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => setModalCourse(c)}
                            className="text-xs font-semibold text-orange-700 hover:underline"
                          >
                            Set Approval →
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {!coursesLoading && !coursesError && (
              <TableFooter
                from={coursesTotal === 0 ? 0 : (safeCoursesPage - 1) * pageSize + 1}
                to={Math.min(safeCoursesPage * pageSize, coursesTotal)}
                total={coursesTotal}
                pageSize={pageSize}
                onPageSize={(n) => {
                  setPageSize(n);
                  setCoursesPage(1);
                }}
                currentPage={safeCoursesPage}
                totalPages={coursesTotalPages}
                onPage={setCoursesPage}
              />
            )}
          </div>
        )}
      </div>

      {/* Person-specific hierarchy editor. courseName/clientName pass through
          for the header — the modal is otherwise fully self-contained. */}
      <ApprovalHierarchyModal
        open={!!modalCourse}
        courseId={modalCourse?._id || ""}
        courseName={modalCourse?.courseName}
        clientName={modalCourse?.clientName || selectedClient?.clientCompany}
        onClose={() => {
          setModalCourse(null);
          // No manual refetch: the modal's save mutation invalidates the
          // 'courseStructures' root (hierarchy lives on the course doc), so
          // the summary query refreshes itself only when something was
          // actually saved — a plain cancel no longer re-downloads the list.
        }}
      />
    </DashboardLayout>
  );
}
