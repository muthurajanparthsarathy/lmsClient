"use client";
import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, FolderTree, Loader2, Plus, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UserTable } from "@/components/ui/alterationTable";
import {
  categoryService,
  fetchCategories,
} from "@/app/lms/pages/dynamicfieldsettings/api/category";
import {
  Modal,
  Toolbar,
  EmptyState,
  Field,
  Input,
  Textarea,
} from "@/app/lms/shared/ui";
import { TabCard, TabCardHeader, CountPill, ConfirmDeleteModal } from "./ui";
import { usePermissions } from "@/hooks/usePermissions";
import { PERMISSION_IDS } from "@/app/lms/pages/usermanagement/components/permissions/index";

interface Category {
  _id: string;
  categoryName: string;
  categoryDescription: string;
  categoryCode: string;
  courseNames: string[];
  createdAt?: string;
  updatedAt?: string;
}

interface ModulePermissions {
  courseManagement: {
    create: boolean;
    edit: boolean;
    delete: boolean;
    report: boolean;
  };
  userManagement: {
    create: boolean;
    edit: boolean;
    delete: boolean;
    report: boolean;
  };
  testAccess: {
    create: boolean;
    edit: boolean;
    delete: boolean;
    report: boolean;
  };
}

interface Column<T> {
  key: string;
  // A node, not just a string: the selection column puts a checkbox in
  // the header. The shared UserTable already types it this way.
  label: React.ReactNode;
  width: string;
  align: "left" | "center" | "right";
  renderCell?: (item: T) => React.ReactNode;
  // Keeps a click inside the cell (the row checkbox) from also firing the
  // table's row-click handler. Mirrors the shared UserTable's ColumnConfig.
  stopRowClick?: boolean;
}

interface ActionButtons {
  edit?: (item: Category) => void;
  delete?: (item: Category) => void;
  permissions?: (item: Category) => void;
}

export default function CategoryManagementPage() {
  // Parent-tab access is already gated in DynamicFieldSettingsPage on the
  // 'Course Category' functionality; reuse it here for the row actions so
  // read-only users still see the list but not the mutating controls.
  const { can } = usePermissions();
  const canAdd = can(PERMISSION_IDS.ADMIN_DYNAMIC_FIELD_SETTINGS, 'Course Category');
  const canEdit = canAdd;
  const canDelete = canAdd;

  const [currentPage, setCurrentPage] = useState(1);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(
    null
  );
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  // Ids rather than rows: selection survives paging, and the row objects
  // are replaced wholesale every time the query refetches.
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [newCategoryId, setNewCategoryId] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<string>("");
  const [dataVersion, setDataVersion] = useState(0);

  const categoriesPerPage = 5;
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    categoryName: "",
    categoryDescription: "",
    categoryCode: "",
    courseNames: [] as string[],
  });

  const [modulePermissions, setModulePermissions] = useState<ModulePermissions>(
    {
      courseManagement: {
        create: false,
        edit: false,
        delete: false,
        report: false,
      },
      userManagement: {
        create: false,
        edit: false,
        delete: false,
        report: false,
      },
      testAccess: {
        create: false,
        edit: false,
        delete: false,
        report: false,
      },
    }
  );

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchTerm, selectedStatus]);

  // Fetch categories with pagination and filters
  // Update your existing fetch query to include better search and filter logic
  const {
    data: categoriesData,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: [
      "categories",
      currentPage,
      debouncedSearchTerm,
      selectedStatus,
      dataVersion,
    ],
    queryFn: async () => {
      const { categories } = await fetchCategories();

      // Enhanced filtering logic
      const filteredCategories = categories.filter((category: Category) => {
        // Search term matching (case-insensitive)
        const searchTermMatch = debouncedSearchTerm
          ? [
            category.categoryName,
            category.categoryDescription,
            category.categoryCode,
            ...category.courseNames,
          ].some(
            (field) =>
              field &&
              field
                .toString()
                .toLowerCase()
                .includes(debouncedSearchTerm.toLowerCase())
          )
          : true;

        // Status filter matching
        const statusMatch =
          !selectedStatus ||
          selectedStatus === "all";

        return searchTermMatch && statusMatch;
      });

      // Sorting (optional - by name alphabetically)
      const sortedCategories = [...filteredCategories].sort((a, b) =>
        a.categoryName.localeCompare(b.categoryName)
      );

      // Pagination
      const startIndex = (currentPage - 1) * categoriesPerPage;
      const endIndex = startIndex + categoriesPerPage;
      const paginatedCategories = sortedCategories.slice(startIndex, endIndex);

      const totalPages = Math.ceil(sortedCategories.length / categoriesPerPage);

      return {
        categories: paginatedCategories,
        allCategories: categories,
        filteredCategories: sortedCategories,
        pagination: {
          currentPage,
          totalPages,
          totalCategories: sortedCategories.length,
          hasNextPage: currentPage < totalPages,
          hasPrevPage: currentPage > 1,
        },
      };
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const value = inputValue.trim();
      if (value && !tags.includes(value)) {
        setTags((prev) => [...prev, value]);
      }
      setInputValue("");
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags((prev) => prev.filter((tag) => tag !== tagToRemove));
  };

  // Mutations
  const createMutation = useMutation({
    mutationFn: categoryService.createCategory,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      setNewCategoryId(data._id);
      setShowAddModal(false);
      setShowSuccessModal(true);
      resetForm();
      toast.success("Category created successfully");
    },
    onError: (error) => {
      toast.error("Failed to create category");
      console.error("Error creating category:", error);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: typeof formData }) =>
      categoryService.updateCategory(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      setShowAddModal(false);
      setShowSuccessModal(true);
      resetForm();
      toast.success("Category updated successfully");
    },
    onError: (error) => {
      toast.error("Failed to update category");
      console.error("Error updating category:", error);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: categoryService.deleteCategory,
    // `id` is the mutation variable — the row just deleted may also have
    // been ticked, and leaving it in the set would keep it in the count.
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      setShowDeleteModal(false);
      setSelectedIds((prev) => {
        if (!prev.has(id)) return prev;
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      toast.success("Category deleted successfully");
    },
    onError: (error) => {
      toast.error("Failed to delete category");
      console.error("Error deleting category:", error);
    },
  });

  const bulkDeleteMutation = useMutation({
    // There is no bulk endpoint, so this is N deletes. allSettled rather
    // than all: one category that refuses to go (still attached to a
    // course) must not abandon the rest half-done, and the toast needs the
    // counts to say what actually happened.
    mutationFn: async (ids: string[]) => {
      const results = await Promise.allSettled(
        ids.map((id) => categoryService.deleteCategory(id)),
      );
      return { total: ids.length, failed: results.filter((r) => r.status === 'rejected').length };
    },
    onSuccess: ({ total, failed }) => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      setShowBulkDeleteModal(false);
      setSelectedIds(new Set());
      const noun = (n: number) => (n === 1 ? "category" : "categories");
      if (failed === 0) toast.success(`${total} ${noun(total)} deleted`);
      else if (failed === total) toast.error(`Could not delete ${failed === 1 ? "that category" : `any of the ${total} categories`}`);
      else toast.warning(`${total - failed} of ${total} deleted — ${failed} could not be removed`);
    },
    onError: (error) => {
      toast.error("Failed to delete the selected categories");
      console.error("Error bulk-deleting categories:", error);
    },
  });

  // Form handlers
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const formDataWithCourses = {
      ...formData,
      courseNames: tags,
    };

    if (selectedCategory) {
      updateMutation.mutate({
        id: selectedCategory._id,
        data: formDataWithCourses,
      });
    } else {
      createMutation.mutate(formDataWithCourses);
    }
  };

  const handleEdit = (category: Category) => {
    setSelectedCategory(category);
    setFormData({
      categoryName: category.categoryName,
      categoryDescription: category.categoryDescription,
      categoryCode: category.categoryCode,
      courseNames: category.courseNames || [],
    });
    setTags(category.courseNames || []);
    setShowAddModal(true);
  };

  const handleDelete = (category: Category) => {
    setSelectedCategory(category);
    setShowDeleteModal(true);
  };

  const confirmDelete = () => {
    if (selectedCategory) {
      deleteMutation.mutate(selectedCategory._id);
    }
  };

  const resetForm = () => {
    setFormData({
      categoryName: "",
      categoryDescription: "",
      categoryCode: "",
      courseNames: [],
    });
    setTags([]);
    setSelectedCategory(null);
  };

  const openAddModal = () => {
    resetForm();
    setShowAddModal(true);
  };

  const closeAddModal = () => {
    setShowAddModal(false);
    resetForm();
  };

  const currentCategories = categoriesData?.categories || [];
  const pagination = categoriesData?.pagination || {
    currentPage: 1,
    totalPages: 1,
    totalCategories: 0,
    hasNextPage: false,
    hasPrevPage: false,
  };

  // Selection is over the CURRENT PAGE for the header toggle, but the set
  // itself spans pages — tick three here, page on, tick two more, delete
  // all five.
  const pageIds: string[] = currentCategories.map((c: Category) => c._id);
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.has(id));
  const somePageSelected = pageIds.some((id) => selectedIds.has(id));

  const toggleOne = (id: string) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const togglePage = () =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allPageSelected) pageIds.forEach((id) => next.delete(id));
      else pageIds.forEach((id) => next.add(id));
      return next;
    });

  const CHECKBOX_CLASS =
    "h-4 w-4 cursor-pointer accent-brand-600 align-middle disabled:cursor-not-allowed";

  // Table columns
  const columns: Column<Category>[] = [
    // Offered only to someone who can actually delete — a checkbox whose
    // only action is unavailable is just a dead control.
    ...(canDelete
      ? [{
          key: "_select",
          // The header toggles THIS PAGE only. A control that silently
          // selected all 66 from a 5-row view, sitting next to a delete
          // button, is a trap.
          label: (
            <input
              type="checkbox"
              aria-label={allPageSelected ? "Clear selection on this page" : "Select all on this page"}
              checked={allPageSelected}
              ref={(el) => { if (el) el.indeterminate = !allPageSelected && somePageSelected; }}
              onChange={togglePage}
              className={CHECKBOX_CLASS}
            />
          ),
          width: "44px",
          align: "center" as const,
          stopRowClick: true,
          renderCell: (category: Category) => (
            <input
              type="checkbox"
              aria-label={`Select ${category.categoryName}`}
              checked={selectedIds.has(category._id)}
              onChange={() => toggleOne(category._id)}
              className={CHECKBOX_CLASS}
            />
          ),
        }]
      : []),
    {
      key: "categoryName",
      label: "Name",
      width: "25%",
      align: "left",
      renderCell: (category: Category) => (
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-heading">
            {category.categoryName}
          </p>
          {category.categoryCode ? (
            <p className="truncate text-xs text-faint">{category.categoryCode}</p>
          ) : null}
        </div>
      ),
    },
    {
      key: "categoryDescription",
      label: "Description",
      width: "25%",
      align: "left",
      renderCell: (category: Category) => (
        <span
          className="block max-w-[320px] truncate text-sm text-body"
          title={category.categoryDescription}
        >
          {category.categoryDescription || "—"}
        </span>
      ),
    },
    {
      key: "courseNames",
      label: "Courses",
      width: "25%",
      align: "left",
      renderCell: (category: Category) => (
        <div className="flex flex-wrap items-center gap-1.5">
          {category.courseNames?.length ? (
            category.courseNames.map((course) => (
              <span
                key={course}
                className="inline-flex items-center rounded-chip border border-brand-500/20 bg-brand-wash px-2 py-0.5 text-xs font-medium text-brand-strong"
              >
                {course}
              </span>
            ))
          ) : (
            <span className="text-sm text-faint">—</span>
          )}
        </div>
      ),
    },
  ];

  // UserTable renders only the row-action entries that are truthy — leaving
  // `edit`/`delete` unset hides the corresponding buttons rather than showing a
  // disabled one.
  const actionButtons: ActionButtons = {
    ...(canEdit ? { edit: handleEdit } : {}),
    ...(canDelete ? { delete: handleDelete } : {}),
  };

  const isFiltered = Boolean(debouncedSearchTerm);
  const showEmpty = !isLoading && currentCategories.length === 0;
  const savePending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="pb-6">
      <TabCard>
        <TabCardHeader
          icon={FolderTree}
          title="Course categories"
          subtitle="Group courses under shared categories and codes"
          actions={
            canAdd ? (
              <Button onClick={openAddModal}>
                <Plus className="h-4 w-4" />
                Add category
              </Button>
            ) : null
          }
        />

        <Toolbar
          search={{
            value: searchTerm,
            onChange: setSearchTerm,
            placeholder: "Search name, code or courses…",
          }}
          filters={
            <CountPill value={pagination.totalCategories} label="categories" />
          }
        />

        {/* Selection bar — only on screen while something is ticked, so the
            toolbar keeps its usual shape the rest of the time. */}
        {selectedIds.size > 0 && (
          <div className="flex flex-wrap items-center gap-3 border-t border-hairline bg-brand-wash/60 px-4 py-2.5">
            <span className="text-sm font-semibold text-heading tabular-nums">
              {selectedIds.size} selected
            </span>
            <div className="ml-auto flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setSelectedIds(new Set())}>
                Clear
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setShowBulkDeleteModal(true)}
                disabled={bulkDeleteMutation.isPending}
              >
                {bulkDeleteMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : null}
                Delete selected
              </Button>
            </div>
          </div>
        )}

        {showEmpty ? (
          isFiltered ? (
            <EmptyState
              icon={Search}
              title={`No matches for “${debouncedSearchTerm}”`}
              message="Try a different name, code, description or course."
              secondaryAction={
                <Button variant="outline" onClick={() => setSearchTerm("")}>
                  Clear search
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={FolderTree}
              title="No categories yet"
              message="Create your first category to start grouping courses."
              primaryAction={
                canAdd ? (
                  <Button onClick={openAddModal}>
                    <Plus className="h-4 w-4" />
                    Add category
                  </Button>
                ) : undefined
              }
            />
          )
        ) : (
          <div className="overflow-x-auto">
            <UserTable
              users={currentCategories}
              isLoading={isLoading}
              columns={columns}
              actionButtons={actionButtons}
              pagination={{
                currentPage: currentPage,
                totalPages: pagination.totalPages,
                totalItems: pagination.totalCategories,
                itemsPerPage: categoriesPerPage,
                onPageChange: (page) => setCurrentPage(page),
                itemLabel: "categories",
              }}
            />
          </div>
        )}
      </TabCard>

      {/* Add / Edit modal */}
      <Modal
        open={showAddModal}
        onClose={closeAddModal}
        title={selectedCategory ? "Edit category" : "Add category"}
        description={
          selectedCategory
            ? "Update the category details below."
            : "Create a new category for your institution."
        }
        size="md"
        footer={
          <>
            <Button type="button" variant="outline" onClick={closeAddModal}>
              Cancel
            </Button>
            <Button type="submit" form="category-form" disabled={savePending}>
              {savePending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : selectedCategory ? (
                "Update category"
              ) : (
                "Create category"
              )}
            </Button>
          </>
        }
      >
        <form id="category-form" onSubmit={handleSubmit} className="space-y-4">
          <Field label="Category name" required>
            <Input
              type="text"
              value={formData.categoryName}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  categoryName: e.target.value,
                })
              }
              placeholder="Enter category name"
              required
            />
          </Field>

          <Field
            label="Course names"
            hint="Type a course name and press Enter to add it."
          >
            <Input
              placeholder="Type course name and press Enter…"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            {tags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 rounded-chip border border-brand-500/20 bg-brand-wash py-0.5 pl-2 pr-1 text-xs font-medium text-brand-strong"
                  >
                    {tag}
                    <button
                      type="button"
                      aria-label={`Remove ${tag}`}
                      onClick={() => handleRemoveTag(tag)}
                      className="rounded-[4px] p-0.5 transition-colors hover:bg-brand-wash-hover"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </Field>

          <Field label="Description">
            <Textarea
              value={formData.categoryDescription}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  categoryDescription: e.target.value,
                })
              }
              placeholder="Enter category description"
              rows={3}
            />
          </Field>
        </form>
      </Modal>

      {/* Success modal */}
      <Modal
        open={showSuccessModal}
        onClose={() => setShowSuccessModal(false)}
        size="sm"
        hideClose
        footer={
          <Button onClick={() => setShowSuccessModal(false)}>Close</Button>
        }
      >
        <div className="flex flex-col items-center px-1 py-2 text-center">
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-tile bg-success-50">
            <Check className="h-5 w-5 text-success-700" />
          </div>
          <h3 className="text-md font-semibold text-heading">
            {selectedCategory
              ? "Category updated successfully"
              : "Category created successfully"}
          </h3>
          <div className="mt-4 w-full rounded-tile border border-hairline bg-canvas px-4 py-3 text-left">
            <p className="text-sm text-body">
              <span className="font-medium text-heading">Category ID:</span>{" "}
              <span className="tabular-nums">{newCategoryId}</span>
            </p>
            {tags.length > 0 && (
              <div className="mt-2">
                <p className="text-sm font-medium text-heading">Course names:</p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {tags.map((course) => (
                    <span
                      key={course}
                      className="inline-flex items-center rounded-chip border border-hairline-strong px-2 py-0.5 text-xs text-body"
                    >
                      {course}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </Modal>

      {/* Delete confirmation */}
      <ConfirmDeleteModal
        open={showBulkDeleteModal}
        onClose={() => setShowBulkDeleteModal(false)}
        onConfirm={() => bulkDeleteMutation.mutate([...selectedIds])}
        title={`Delete ${selectedIds.size} ${selectedIds.size === 1 ? "category" : "categories"}?`}
        message="Deleting a category does not delete its courses, but they will no longer be grouped under it. This cannot be undone."
        isPending={bulkDeleteMutation.isPending}
        confirmLabel={`Delete ${selectedIds.size}`}
      />

      <ConfirmDeleteModal
        open={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={confirmDelete}
        title="Delete category"
        entityName={selectedCategory?.categoryName}
        isPending={deleteMutation.isPending}
      />
    </div>
  );
}
