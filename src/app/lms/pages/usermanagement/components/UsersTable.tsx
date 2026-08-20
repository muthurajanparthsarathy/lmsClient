"use client";
import React, { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import { StatusPill } from "../../../shared/ui";
import { UserAvatar } from "./UserAvatar";
import { roleTone } from "./permissions";
import { User } from "./types";

// The User Management data grid — purpose-built for this page (not the shared
// DataTable) so the header can stick and the body can fill the viewport and
// scroll on its own. It owns NO data or business logic: selection, sorting,
// status toggles and row actions all arrive as props from page.tsx.
//
// Its METRICS are deliberately DataTable's, so this directory and the Client
// Management listing read as the same table on two routes: 44px header, 48px
// row, 28px avatar, one line per row. Email used to sit under the name in a
// two-line cell, which cost 16px of row height on every row and left the
// address in a different place than every other listing puts it — it is now
// its own column, exactly as in Client Management.

type SortDir = "asc" | "desc";

interface UsersTableProps {
  users: User[];
  isLoading: boolean;
  skeletonRows: number;
  sortKey: string;
  sortDir: SortDir;
  onSort: (key: string) => void;
  selectedIds: string[];
  onToggleOne: (id: string) => void;
  allPageSelected: boolean;
  somePageSelected: boolean;
  onToggleAllPage: () => void;
  renderStatus: (user: User) => React.ReactNode;
  renderActions: (user: User) => React.ReactNode;
  emptyState: React.ReactNode;
  // When false, the Actions column (both header and every row cell) is not
  // rendered at all — used when the signed-in admin holds no row-level action
  // permissions, so an empty column doesn't sit there taking width.
  showActionsColumn?: boolean;
}

// Per-column widths. The table renders with `table-layout: fixed`, so these
// widths ARE the layout: cells clip and ellipsize instead of stretching, which
// is what keeps every row exactly one line tall and the table inside its
// container (no horizontal scrollbar) — the Client Management arrangement.
//
// Every column is a percentage and they sum to exactly 100, so the table
// fills its container edge-to-edge with no horizontal scrollbar. Size each
// column to its widest CONTENT *and its header label* — under fixed layout +
// the wrapper's overflow-hidden there is no reflow to save a column that is
// too narrow, the text is simply cut off.
const COL = {
  check: "w-[4%] pl-4 sm:pl-5 pr-0 text-left",
  user: "w-[22%] px-3 text-left",
  // Email was hoarding space that Phone and Actions needed.
  email: "w-[26%] px-3 text-left",
  // Phone bumped up so 10-digit numbers stop hugging the column's left edge.
  phone: "w-[14%] px-3 text-left hidden lg:table-cell",
  // Role holds a fixed pill; the longest label ("Super Administrator")
  // fits inside ~150 px, so 12 % is enough on typical viewports.
  role: "w-[12%] px-3 text-left",
  status: "w-[14%] px-3 text-right whitespace-nowrap",
  // 8 % keeps the 28 px kebab safely inside the list — under 6 % the
  // browser was expanding this column past its declared width to fit
  // the button + right gutter, spilling past the container edge.
  actions: "w-[8%] pl-2 pr-4 sm:pr-5 text-right",
};

const HEAD_CELL =
  "h-8 text-[10px] font-semibold uppercase tracking-wider text-subtle align-middle bg-canvas border-b border-hairline whitespace-nowrap";
// 44px — matches the shared DataTable's compact row height.
const BODY_CELL = "h-11 align-middle";
// Skeleton bar, matching DataTable's.
const BAR = "h-3 rounded bg-ink-100 animate-pulse";

function SortButton({
  label,
  columnKey,
  active,
  dir,
  onSort,
}: {
  label: string;
  columnKey: string;
  active: boolean;
  dir: SortDir;
  onSort: (key: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSort(columnKey)}
      className="inline-flex items-center gap-1.5 uppercase tracking-wider hover:text-heading transition-colors duration-150"
    >
      {label}
      {active ? (
        dir === "asc" ? (
          <ChevronUp size={13} className="text-brand" />
        ) : (
          <ChevronDown size={13} className="text-brand" />
        )
      ) : (
        <ChevronsUpDown size={13} className="text-line-muted" />
      )}
    </button>
  );
}

export function UsersTable({
  users,
  isLoading,
  skeletonRows,
  sortKey,
  sortDir,
  onSort,
  selectedIds,
  onToggleOne,
  allPageSelected,
  somePageSelected,
  onToggleAllPage,
  renderStatus,
  renderActions,
  emptyState,
  showActionsColumn = true,
}: UsersTableProps) {
  const headerCheckboxRef = useRef<HTMLInputElement>(null);

  // Native checkboxes can't express "some but not all" declaratively.
  useEffect(() => {
    if (headerCheckboxRef.current) {
      headerCheckboxRef.current.indeterminate = somePageSelected && !allPageSelected;
    }
  }, [somePageSelected, allPageSelected]);

  // checkbox + user + email + phone + role + status (+ actions when shown)
  const COL_SPAN = 6 + (showActionsColumn ? 1 : 0);

  return (
    <div
      // flex-1 min-h-0 absorbs the vertical space between the toolbar and the
      // pagination footer.
      //
      // overflow-y-auto, NOT overflow-hidden: the page size is a fixed 10 now
      // rather than auto-fitted to this element's height, so on a short
      // viewport the last rows no longer fit. Hidden would drop them with no
      // scrollbar and no other clue — the user would just see 7 of 10 rows and
      // a footer claiming 10. The sticky header stays pinned inside the scroll
      // container. overflow-x stays clipped: table-layout is fixed at 100 %
      // width, so there is nothing to scroll sideways to.
      className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden"
    >
      <table className="w-full border-collapse" style={{ tableLayout: "fixed" }}>
        <thead className="sticky top-0 z-sticky">
          <tr>
            <th className={`${HEAD_CELL} ${COL.check}`}>
              <input
                ref={headerCheckboxRef}
                type="checkbox"
                aria-label="Select all rows on this page"
                checked={allPageSelected}
                onChange={onToggleAllPage}
                disabled={isLoading || users.length === 0}
                className="size-4 rounded border-hairline-strong accent-brand cursor-pointer align-middle disabled:opacity-40"
              />
            </th>
            <th className={`${HEAD_CELL} ${COL.user}`}>
              <SortButton label="User" columnKey="name" active={sortKey === "name"} dir={sortDir} onSort={onSort} />
            </th>
            {/* Not sortable — the directory endpoint sorts on name, phone, role
                and status only, and Client Management's Email column is
                likewise a read-only column. */}
            <th className={`${HEAD_CELL} ${COL.email}`}>Email</th>
            <th className={`${HEAD_CELL} ${COL.phone}`}>
              <SortButton label="Phone" columnKey="phone" active={sortKey === "phone"} dir={sortDir} onSort={onSort} />
            </th>
            <th className={`${HEAD_CELL} ${COL.role}`}>
              <SortButton label="Role" columnKey="role" active={sortKey === "role"} dir={sortDir} onSort={onSort} />
            </th>
            <th className={`${HEAD_CELL} ${COL.status}`}>
              <SortButton label="Status" columnKey="status" active={sortKey === "status"} dir={sortDir} onSort={onSort} />
            </th>
            {showActionsColumn && (
              <th className={`${HEAD_CELL} ${COL.actions}`}>Actions</th>
            )}
          </tr>
        </thead>

        <tbody>
          {isLoading ? (
            Array.from({ length: Math.max(6, Math.min(skeletonRows, 14)) }).map((_, i) => (
              <tr key={i} className="border-b border-hairline">
                <td className={`${COL.check} ${BODY_CELL}`}>
                  <div className="size-4 rounded bg-ink-100 animate-pulse" style={{ animationDelay: `${i * 55}ms` }} />
                </td>
                <td className={`${COL.user} ${BODY_CELL}`}>
                  <div className="flex items-center gap-2.5">
                    <div className="size-7 rounded-full bg-ink-100 animate-pulse flex-shrink-0" style={{ animationDelay: `${i * 55}ms` }} />
                    <div className={`${BAR} w-[70%]`} style={{ animationDelay: `${i * 55}ms` }} />
                  </div>
                </td>
                <td className={`${COL.email} ${BODY_CELL}`}>
                  <div className={`${BAR} w-[85%]`} style={{ animationDelay: `${i * 55}ms` }} />
                </td>
                <td className={`${COL.phone} ${BODY_CELL}`}>
                  <div className={`${BAR} w-[70%]`} style={{ animationDelay: `${i * 55}ms` }} />
                </td>
                <td className={`${COL.role} ${BODY_CELL}`}>
                  <div className="h-6 w-[80%] rounded-full bg-ink-100 animate-pulse" style={{ animationDelay: `${i * 55}ms` }} />
                </td>
                <td className={`${COL.status} ${BODY_CELL}`}>
                  <div className="ml-auto h-6 w-[75%] rounded-full bg-ink-100 animate-pulse" style={{ animationDelay: `${i * 55}ms` }} />
                </td>
                {showActionsColumn && (
                  <td className={`${COL.actions} ${BODY_CELL}`}>
                    <div className="ml-auto size-4 rounded bg-ink-100 animate-pulse" style={{ animationDelay: `${i * 55}ms` }} />
                  </td>
                )}
              </tr>
            ))
          ) : users.length === 0 ? (
            <tr>
              <td colSpan={COL_SPAN} className="py-12">
                {emptyState}
              </td>
            </tr>
          ) : (
            users.map((user, i) => {
              const isSelected = selectedIds.includes(user.id);
              const fullName = `${user.firstName} ${user.lastName}`.trim();
              return (
                <motion.tr
                  key={user.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.16, delay: Math.min(i, 10) * 0.02 }}
                  className={`group border-b border-hairline last:border-0 transition-colors duration-150 ${
                    isSelected ? "bg-brand-wash/50 hover:bg-brand-wash" : "hover:bg-row-hover"
                  }`}
                >
                  <td className={`${COL.check} ${BODY_CELL}`}>
                    <input
                      type="checkbox"
                      aria-label={`Select ${fullName}`}
                      checked={isSelected}
                      onChange={() => onToggleOne(user.id)}
                      className="size-4 rounded border-hairline-strong accent-brand cursor-pointer align-middle"
                    />
                  </td>
                  <td className={`${COL.user} ${BODY_CELL} text-[12px] font-medium text-heading`}>
                    <div className="flex items-center gap-2 min-w-0">
                      <UserAvatar name={user.firstName} size="xs" />
                      {/* Long values ellipsize with the full value in the
                          tooltip, rather than stretching the row. */}
                      <span className="truncate" title={fullName}>{fullName}</span>
                    </div>
                  </td>
                  <td className={`${COL.email} ${BODY_CELL}`}>
                    <span className="text-[12px] text-subtle truncate block" title={user.email || undefined}>
                      {user.email || "—"}
                    </span>
                  </td>
                  <td className={`${COL.phone} ${BODY_CELL}`}>
                    <span className="text-[12px] text-body tabular-nums truncate block">{user.phone || "—"}</span>
                  </td>
                  <td className={`${COL.role} ${BODY_CELL}`}>
                    {/* max-w-full + an inner truncate: the pill is a fixed-height
                        capsule, so a long role must clip INSIDE it — wrapping
                        would break out of it vertically and cost the row its
                        48px. The ellipsis has to live on a text element; a flex
                        container clips without the "…". */}
                    <StatusPill tone={roleTone(user.role)} className="max-w-full">
                      <span className="truncate" title={user.role}>{user.role}</span>
                    </StatusPill>
                  </td>
                  <td className={`${COL.status} ${BODY_CELL}`}>{renderStatus(user)}</td>
                  {showActionsColumn && (
                    <td className={`${COL.actions} ${BODY_CELL}`}>
                      <div className="flex justify-end">{renderActions(user)}</div>
                    </td>
                  )}
                </motion.tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

export default UsersTable;
