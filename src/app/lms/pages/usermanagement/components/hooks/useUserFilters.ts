"use client";

// Everything that decides WHICH users the directory shows: the search box and
// its scope, the five filters, the sort and the page.
//
// These belong together because they are one thing to the server — they are
// assembled into `queryParams` and sent to getUserAccessPaginated, which does
// the searching, filtering, sorting and slicing in Mongo. Splitting them across
// the page made it easy to add a filter and forget to reset the page or extend
// the selection predicate.

import { useState, useEffect, useMemo, useCallback } from "react";
import type { Role, User } from "../types";
import { getRoleIcon, getRoleColor, type SearchField } from "../userManagement.constants";

export interface FilterChip {
  key: string;
  label: string;
  onRemove: () => void;
}

export function useUserFilters(roles: Role[]) {
  const [currentPage, setCurrentPage] = useState(1);
  // A FIXED 10 rows per page.
  //
  // This used to default to 25 and then auto-fit to the wrapper's height, so
  // the row count changed with the window and no two screens showed the same
  // page. A stable, predictable page is worth more here than filling every
  // pixel — "page 3" should mean the same 10 users on a laptop and a monitor.
  // The footer's page-size control still overrides it per session.
  const [pageSize, setPageSize] = useState(10);

  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [searchField, setSearchField] = useState<SearchField>("all");
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<string>("");
  const [selectedDegree, setSelectedDegree] = useState<string>("");
  const [selectedDepartment, setSelectedDepartment] = useState<string>("");
  const [selectedYear, setSelectedYear] = useState<string>("");

  const [sortKey, setSortKey] = useState<string>("");
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearchTerm(searchTerm), 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Changing a filter goes back to page 1. This adjusts state DURING render
  // rather than in an effect: as an effect it committed the new filter with
  // the OLD page number first, so a filter change while on page 3 fired a
  // request for page 3 and then immediately a second one for page 1. React
  // re-runs this render before committing, so only the page-1 request is ever
  // made.
  const filterSignature = JSON.stringify([
    debouncedSearchTerm, searchField, selectedRoles, selectedStatus,
    selectedDegree, selectedDepartment, selectedYear,
  ]);
  const [lastFilterSignature, setLastFilterSignature] = useState(filterSignature);
  if (lastFilterSignature !== filterSignature) {
    setLastFilterSignature(filterSignature);
    setCurrentPage(1);
  }

  // ── The directory read ─────────────────────────────────────────────────────
  // The page used to pull EVERY user in the institution and filter, sort and
  // slice the array in the browser. That works at 179 users and collapses at
  // 100,000: a ~300 MB response, parsed and held in React state, before a
  // single row is drawn. The search, the six filters, the sort and the slice
  // now all run in Mongo, and one page crosses the wire.
  const queryParams = useMemo(
    () => ({
      page: currentPage,
      limit: pageSize,
      search: debouncedSearchTerm,
      searchField,
      roles: selectedRoles,
      status: selectedStatus,
      degree: selectedDegree,
      department: selectedDepartment,
      year: selectedYear,
      sortKey,
      sortDir,
    }),
    [currentPage, pageSize, debouncedSearchTerm, searchField, selectedRoles, selectedStatus,
      selectedDegree, selectedDepartment, selectedYear, sortKey, sortDir],
  );

  const clearAllFilters = () => {
    setSelectedRoles([]);
    setSelectedStatus("");
    setSelectedDegree("");
    setSelectedDepartment("");
    setSelectedYear("");
    setSearchTerm("");
    setSearchField("all");
    setCurrentPage(1);
  };

  const hasActiveFilters = () => {
    return selectedRoles.length > 0 || selectedStatus !== "" ||
      selectedDegree !== "" || selectedDepartment !== "" ||
      selectedYear !== "" || searchTerm !== "";
  };

  // Use role _id for filtering
  const dynamicRoleOptions = roles.map(role => ({
    value: role._id,
    label: role.renameRole,
    icon: getRoleIcon(role.renameRole),
    color: getRoleColor(role.renameRole)
  }));

  const toggleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  // Does this row still match the active filters?
  //
  // Selection spans pages, and off-page rows are no longer in memory — so the
  // page keeps the selected ROW next to its id and re-runs this over those
  // rows. Same rule as before ("a selection survives only while it still
  // matches"), evaluated against the handful of selected users instead of the
  // whole directory.
  const matchesCurrentFilters = useCallback((user: User) => {
    const q = debouncedSearchTerm.toLowerCase();
    const has = (v?: string) => (v || '').toLowerCase().includes(q);
    // Mirrors the scoped $or in getUserAccessPaginated field for field, so a
    // selection survives exactly as long as the server would still return it.
    const searchable: Record<SearchField, (string | undefined)[]> = {
      user: [user.firstName, user.lastName],
      email: [user.email],
      phone: [user.phone],
      role: [user.role],
      all: [user.firstName, user.lastName, user.email, user.phone,
        user.degree, user.department, user.role],
    };
    const matchesSearch = !debouncedSearchTerm || searchable[searchField].some(has);
    const matchesRoles = selectedRoles.length === 0 || selectedRoles.includes(user.roleId);
    const matchesStatus = !selectedStatus || selectedStatus === "all" || user.status === selectedStatus;
    const matchesDegree = !selectedDegree || selectedDegree === "all" || user.degree === selectedDegree;
    const matchesDepartment = !selectedDepartment || selectedDepartment === "all" || user.department === selectedDepartment;
    const matchesYear = !selectedYear || selectedYear === "all" || user.year === selectedYear;
    return matchesSearch && matchesRoles && matchesStatus && matchesDegree && matchesDepartment && matchesYear;
  }, [debouncedSearchTerm, searchField, selectedRoles, selectedStatus, selectedDegree, selectedDepartment, selectedYear]);

  // A filter counts as active only when it holds a real value ("all" and "" both
  // mean "no filter", matching how the users query interprets them).
  const isSet = (v: string) => !!v && v !== "all";
  const activeFilterCount =
    (selectedRoles.length ? 1 : 0) +
    (isSet(selectedStatus) ? 1 : 0) +
    (isSet(selectedDegree) ? 1 : 0) +
    (isSet(selectedDepartment) ? 1 : 0) +
    (isSet(selectedYear) ? 1 : 0);

  // Removable chips for the applied filters (search has its own input, so it is
  // not chipped here). Each chip's remove clears exactly that filter.
  const filterChips: FilterChip[] = [
    ...selectedRoles.map((id) => ({
      key: `role-${id}`,
      label: roles.find((r) => r._id === id)?.renameRole || "Role",
      onRemove: () => setSelectedRoles(selectedRoles.filter((r) => r !== id)),
    })),
    ...(isSet(selectedStatus) ? [{ key: "status", label: selectedStatus === "active" ? "Active" : "Inactive", onRemove: () => setSelectedStatus("") }] : []),
    ...(isSet(selectedDegree) ? [{ key: "degree", label: selectedDegree, onRemove: () => setSelectedDegree("") }] : []),
    ...(isSet(selectedDepartment) ? [{ key: "dept", label: selectedDepartment, onRemove: () => setSelectedDepartment("") }] : []),
    ...(isSet(selectedYear) ? [{ key: "year", label: selectedYear, onRemove: () => setSelectedYear("") }] : []),
  ];

  return {
    // paging
    currentPage, setCurrentPage, pageSize, setPageSize,
    // search
    searchTerm, setSearchTerm, debouncedSearchTerm, searchField, setSearchField,
    // filters
    selectedRoles, setSelectedRoles,
    selectedStatus, setSelectedStatus,
    selectedDegree, setSelectedDegree,
    selectedDepartment, setSelectedDepartment,
    selectedYear, setSelectedYear,
    // sort
    sortKey, sortDir, toggleSort,
    // derived
    queryParams, dynamicRoleOptions, matchesCurrentFilters,
    activeFilterCount, filterChips, clearAllFilters, hasActiveFilters,
  };
}
