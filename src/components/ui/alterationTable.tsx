import { Edit, Key, Loader2, Trash2, ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useState } from "react";

interface ColumnConfig {
  key: string;
  label: string | React.ReactNode;
  width?: string;
  align?: 'left' | 'center' | 'right';
  renderCell?: (user: any) => React.ReactNode;
  stopRowClick?: boolean;
}

interface UserTableProps {
  users: any[];
  isLoading: boolean;
  columns: ColumnConfig[];
  actionButtons?: {
    edit?: (user: any) => void;
    permissions?: (user: any) => void;
    delete?: (user: any) => void;
  };
  pagination?: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    itemsPerPage: number;
    onPageChange: (page: number) => void;
    // Noun shown in the "Showing X to Y of Z <label>" footer. Defaults to
    // "Course Structures" so existing callers stay unchanged; pass "Clients",
    // "Users", etc. per page.
    itemLabel?: string;
  };
  onToggleStatus?: (userId: string, status: "active" | "inactive") => void;
  onRowClick?: (user: any) => void;
  fixedLayout?: boolean;
  fillHeight?: boolean;
}

export const UserTable = ({
  users,
  isLoading,
  columns,
  actionButtons,
  pagination,
  onToggleStatus,
  onRowClick,
  fixedLayout,
  fillHeight,
}: UserTableProps) => {
  const [dropdownOpen, setDropdownOpen] = useState<string | null>(null);

  const handlePageChange = (page: number) => {
    if (pagination) {
      pagination.onPageChange(page);
    }
  };

  const handleActionClick = (action: (user: any) => void, user: any) => {
    setDropdownOpen(null); // Close dropdown when action is clicked
    action(user);
  };

  const handleDropdownOpenChange = (open: boolean, userId: string) => {
    setDropdownOpen(open ? userId : null);
  };

  const renderPageButtons = () => {
    if (!pagination) return null;

    const { currentPage, totalPages } = pagination;
    const buttons = [];
    const maxVisiblePages = 5;

    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) {
        buttons.push(i);
      }
    } else {
      buttons.push(1);

      if (currentPage > 3) {
        buttons.push('...');
      }

      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);

      for (let i = start; i <= end; i++) {
        if (!buttons.includes(i)) buttons.push(i);
      }

      if (currentPage < totalPages - 2) {
        buttons.push('...');
      }

      if (!buttons.includes(totalPages)) {
        buttons.push(totalPages);
      }
    }

    return buttons.map((page, index) => {
      if (page === '...') {
        return (
          <Button
            key={`ellipsis-${index}`}
            variant="ghost"
            size="sm"
            className="w-8 h-8 p-0 cursor-default text-xs text-gray-500 dark:text-gray-400 font-normal"
            disabled
          >
            ...
          </Button>
        );
      }

      return (
        <Button
          key={page}
          variant={pagination.currentPage === page ? "default" : "ghost"}
          size="sm"
          onClick={() => handlePageChange(Number(page))}
          className={`w-8 h-8 p-0 cursor-pointer text-xs transition-all font-medium ${
            pagination.currentPage === page 
              ? 'bg-blue-600 text-white shadow-sm dark:bg-blue-600' 
              : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
          }`}
          disabled={isLoading}
        >
          {page}
        </Button>
      );
    });
  };

  return (
    <div className={fillHeight ? "h-full min-h-0 flex flex-col" : "space-y-4"}>
      <div
        className={
          fillHeight
            ? "flex-1 min-h-0 overflow-auto bg-white dark:bg-gray-800 [&_[data-slot=table-container]]:overflow-visible"
            : "overflow-hidden bg-white dark:bg-gray-800"
        }
      >
        <Table className={fixedLayout ? "w-full table-fixed" : "min-w-full"}>
          <TableHeader className={fillHeight ? "sticky top-0 z-10 bg-white dark:bg-gray-800 shadow-sm" : ""}>
            <TableRow className="border-b border-gray-300 dark:border-gray-700">
              {columns.map((column) => (
                <TableHead
                  key={column.key}
                  className={`px-2 py-2 whitespace-nowrap ${
                    column.width || ''
                  }`}
                  style={{
                    textAlign: column.align || 'left',
                    width: column.width || 'auto'
                  }}
                >
                  <span className="text-xs font-semibold text-gray-1300 dark:text-gray-300 tracking-wide font-inter">
                    {column.label}
                  </span>
                </TableHead>
              ))}
              {actionButtons && (
                <TableHead className="px-2 py-2 w-12 text-center">
                  <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 tracking-wide font-inter">
                    Actions
                  </span>
                </TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: pagination?.itemsPerPage || 5 }).map((_, index) => (
                <motion.tr
                  key={`skeleton-${index}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.3 }}
                  className="border-b border-gray-100 dark:border-gray-700"
                >
                  {columns.map((column) => (
                    <TableCell key={`skeleton-cell-${column.key}-${index}`} className="px-3 py-2">
                      <div className="h-4 bg-gradient-to-r from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-600 rounded animate-pulse font-sans"></div>
                    </TableCell>
                  ))}
                  {actionButtons && (
                    <TableCell className="px-3 py-2">
                      <div className="flex justify-center">
                        <div className="h-6 w-6 bg-gradient-to-r from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-600 rounded animate-pulse"></div>
                      </div>
                    </TableCell>
                  )}
                </motion.tr>
              ))
            ) : users.length > 0 ? (
              users.map((user, index) => (
                <TableRow
                  key={user.id || `user-${index}`}
                  onClick={onRowClick ? () => onRowClick(user) : undefined}
                  className={`border-b border-gray-100 dark:border-gray-700 transition-colors last:border-b-0 ${
                    onRowClick
                      ? 'cursor-pointer hover:bg-indigo-50/70 dark:hover:bg-indigo-900/20'
                      : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                  }`}
                >
                  {columns.map((column, colIndex) => (
                    <TableCell
                      key={`${user.id || index}-${column.key || colIndex}`}
                      onClick={column.stopRowClick ? (e) => e.stopPropagation() : undefined}
                      className={`px-3 py-2 whitespace-nowrap ${fixedLayout ? 'overflow-hidden' : ''} ${
                        column.align === 'center' ? 'text-center' :
                        column.align === 'right' ? 'text-right' : 'text-left'
                      }`}
                    >
                      <span className="text-sm font-normal text-gray-700 dark:text-gray-300 font-sans">
                        {column.renderCell
                          ? column.renderCell(user)
                          : user[column.key]}
                      </span>
                    </TableCell>
                  ))}
                  {actionButtons && (
                    <TableCell className="px-3 py-2 whitespace-nowrap text-center">
                      <div className="flex justify-center">
                        <DropdownMenu
                          open={dropdownOpen === (user.id || `user-${index}`)}
                          onOpenChange={(open) => handleDropdownOpenChange(open, user.id || `user-${index}`)}
                        >
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 opacity-70 hover:opacity-100 transition-opacity font-sans text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
                            >
                              <MoreHorizontal className="h-3.5 w-3.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent 
                            align="center" 
                            className="w-40 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700"
                          >
                            {actionButtons.edit && (
                              <DropdownMenuItem
                                onClick={() => handleActionClick(actionButtons.edit!, user)}
                                className="flex items-center justify-center gap-2 cursor-pointer text-sm font-sans text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 focus:bg-gray-100 dark:focus:bg-gray-700"
                              >
                                <Edit className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                                Edit
                              </DropdownMenuItem>
                            )}
                            {actionButtons.permissions && (
                              <DropdownMenuItem
                                onClick={() => handleActionClick(actionButtons.permissions!, user)}
                                className="flex items-center justify-center gap-2 cursor-pointer text-sm font-sans text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 focus:bg-gray-100 dark:focus:bg-gray-700"
                              >
                                <Key className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                                Permissions
                              </DropdownMenuItem>
                            )}
                            {actionButtons.delete && (
                              <DropdownMenuItem
                                onClick={() => handleActionClick(actionButtons.delete!, user)}
                                className="flex items-center justify-center gap-2 cursor-pointer text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 focus:bg-gray-100 dark:focus:bg-gray-700 focus:text-red-600 dark:focus:text-red-400"
                              >
                                <Trash2 className="h-4 w-4" />
                                Delete
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))
            ) : (
              <TableRow key="no-data-row">
                <TableCell 
                  colSpan={columns.length + (actionButtons ? 1 : 0)} 
                  className="px-4 py-8 text-center"
                >
                  <div className="flex flex-col items-center justify-center text-gray-400 dark:text-gray-500 font-sans">
                    <div className="rounded-full bg-gray-100 dark:bg-gray-800 p-3 mb-3">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">No users found</p>
                    <p className="text-xs font-normal text-gray-400 dark:text-gray-500">No data matches your current criteria</p>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {pagination && pagination.totalItems > 0 && (
        <div data-pagination-bar className="flex-shrink-0 flex items-center justify-between px-4 py-2 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 font-sans">
          <div className="text-sm font-normal text-gray-600 dark:text-gray-400">
            Showing <span className="font-semibold text-gray-900 dark:text-gray-100">{((pagination.currentPage - 1) * pagination.itemsPerPage) + 1}</span> to{" "}
            <span className="font-semibold text-gray-900 dark:text-gray-100">{Math.min(pagination.currentPage * pagination.itemsPerPage, pagination.totalItems)}</span> of{" "}
            <span className="font-semibold text-gray-900 dark:text-gray-100">{pagination.totalItems}</span> {pagination.itemLabel || "Course Structures"}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(pagination.currentPage - 1)}
              disabled={pagination.currentPage === 1 || isLoading}
              className="flex items-center gap-2 cursor-pointer text-sm font-medium px-3 py-2 h-9 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800"
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>

            <div className="flex items-center gap-1">
              {renderPageButtons()}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(pagination.currentPage + 1)}
              disabled={pagination.currentPage === pagination.totalPages || isLoading}
              className="flex items-center gap-2 cursor-pointer text-sm font-medium px-3 py-2 h-9 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};