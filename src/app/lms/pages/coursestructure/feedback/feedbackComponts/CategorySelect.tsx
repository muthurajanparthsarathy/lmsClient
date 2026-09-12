// components/CategorySelect.tsx
//
// Custom category dropdown — pick-or-add, with per-item rename/delete and
// question counts. Newly added categories appear in the list immediately
// (with a "New" badge) even before any question uses them.

import React, { useState, useEffect, useRef } from 'react';
import { Check, ChevronDown, FolderPlus, Pencil, Trash2, X } from 'lucide-react';

export interface CategorySelectProps {
  value: string;
  onChange: (val: string) => void;
  categories: string[];
  /** Number of questions currently using each category (0 = brand new). */
  questionCounts: Record<string, number>;
  onAddCategory: (cat: string) => void;
  onDeleteCategory: (cat: string) => void;
  onRenameCategory: (oldName: string, newName: string) => void;
}

export const CategorySelect: React.FC<CategorySelectProps> = ({
  value,
  onChange,
  categories,
  questionCounts,
  onAddCategory,
  onDeleteCategory,
  onRenameCategory,
}) => {
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newCat, setNewCat] = useState('');
  // Inline-rename state — only one row is editable at a time.
  const [editingCat, setEditingCat] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const addInputRef = useRef<HTMLInputElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
        setAdding(false);
        setNewCat('');
        setEditingCat(null);
        setEditingValue('');
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        setAdding(false);
        setNewCat('');
        setEditingCat(null);
        setEditingValue('');
      }
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  useEffect(() => {
    if (adding) addInputRef.current?.focus();
  }, [adding]);

  useEffect(() => {
    if (editingCat !== null) {
      editInputRef.current?.focus();
      editInputRef.current?.select();
    }
  }, [editingCat]);

  const beginEdit = (cat: string) => {
    setEditingCat(cat);
    setEditingValue(cat);
    setAdding(false);
  };

  const commitEdit = () => {
    if (editingCat === null) return;
    const trimmed = editingValue.trim();
    if (!trimmed || trimmed === editingCat) {
      setEditingCat(null);
      setEditingValue('');
      return;
    }
    onRenameCategory(editingCat, trimmed);
    setEditingCat(null);
    setEditingValue('');
  };

  const commitNew = () => {
    const trimmed = newCat.trim();
    if (!trimmed) {
      setAdding(false);
      return;
    }
    // Case-insensitive reuse of an existing category
    const existing = categories.find((c) => c.toLowerCase() === trimmed.toLowerCase());
    if (existing) {
      onChange(existing);
    } else {
      onAddCategory(trimmed);
      onChange(trimmed);
    }
    setNewCat('');
    setAdding(false);
    // Keep the dropdown open so the user sees the category appear in the
    // list (selected, with a "New" badge) instead of it seeming to vanish.
  };

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full h-9 px-3 text-[13px] flex items-center justify-between border border-gray-200 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900 text-left text-gray-900 dark:text-white hover:border-gray-300 dark:hover:border-gray-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
      >
        <span className={value ? '' : 'text-gray-400'}>
          {value || 'Select or add category'}
        </span>
        <ChevronDown
          className={`h-3.5 w-3.5 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="absolute z-20 mt-1 w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg overflow-hidden">
          <div className="max-h-56 overflow-y-auto [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-gray-300 [&::-webkit-scrollbar-thumb]:rounded-full">
            {/* Clear option */}
            {value && (
              <button
                type="button"
                onClick={() => {
                  onChange('');
                  setOpen(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-[12px] text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors border-b border-gray-100 dark:border-gray-800"
              >
                <X className="h-3.5 w-3.5 text-gray-400" />
                Clear category
              </button>
            )}

            {categories.length === 0 ? (
              <div className="px-3 py-3 text-[11px] text-center text-gray-400 dark:text-gray-500">
                No categories yet — use “Add new category” below
              </div>
            ) : (
              categories.map((cat) => {
                const selected = cat === value;
                const editing = editingCat === cat;
                const count = questionCounts[cat] ?? 0;

                if (editing) {
                  // Inline rename row — replaces the normal row layout while active.
                  return (
                    <div
                      key={cat}
                      className="flex items-center gap-1 px-2 py-1.5 bg-indigo-50/60 dark:bg-indigo-900/20 border-y border-indigo-100 dark:border-indigo-900/40"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        ref={editInputRef}
                        type="text"
                        value={editingValue}
                        onChange={(e) => setEditingValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            commitEdit();
                          } else if (e.key === 'Escape') {
                            e.preventDefault();
                            setEditingCat(null);
                            setEditingValue('');
                          }
                        }}
                        className="flex-1 h-7 px-2 text-[12px] border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                      />
                      <button
                        type="button"
                        onClick={commitEdit}
                        className="h-7 w-7 inline-flex items-center justify-center text-white bg-indigo-600 hover:bg-indigo-700 rounded transition-colors"
                        title="Save"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingCat(null);
                          setEditingValue('');
                        }}
                        className="h-7 w-7 inline-flex items-center justify-center text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
                        title="Cancel"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                }

                return (
                  <div
                    key={cat}
                    className={`group flex items-center justify-between px-3 py-1.5 text-[13px] cursor-pointer transition-colors ${
                      selected
                        ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300'
                        : 'text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800'
                    }`}
                    onClick={() => {
                      onChange(cat);
                      setOpen(false);
                    }}
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      {selected ? (
                        <Check className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
                      ) : (
                        <span className="h-3.5 w-3.5 shrink-0" />
                      )}
                      <span className="truncate">{cat}</span>
                      {count === 0 ? (
                        <span className="shrink-0 text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-300">
                          New
                        </span>
                      ) : (
                        <span className="shrink-0 text-[10px] text-gray-400 dark:text-gray-500">
                          {count} {count === 1 ? 'question' : 'questions'}
                        </span>
                      )}
                    </span>
                    <span className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          beginEdit(cat);
                        }}
                        className="p-0.5 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded"
                        title="Rename category"
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (
                            count === 0 ||
                            window.confirm(
                              `Delete category "${cat}"? Its ${count} question${
                                count === 1 ? '' : 's'
                              } will become uncategorized.`
                            )
                          ) {
                            onDeleteCategory(cat);
                          }
                        }}
                        className="p-0.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded"
                        title="Delete category"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </span>
                  </div>
                );
              })
            )}
          </div>

          {/* Add-new footer */}
          <div className="border-t border-gray-100 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-900/60">
            {adding ? (
              <div className="p-1.5">
                <div className="flex items-center gap-1">
                  <input
                    ref={addInputRef}
                    type="text"
                    value={newCat}
                    onChange={(e) => setNewCat(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        commitNew();
                      } else if (e.key === 'Escape') {
                        setAdding(false);
                        setNewCat('');
                      }
                    }}
                    placeholder="New category name"
                    className="flex-1 h-7 px-2 text-[12px] border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={commitNew}
                    className="h-7 w-7 inline-flex items-center justify-center text-white bg-indigo-600 hover:bg-indigo-700 rounded transition-colors"
                    title="Add"
                  >
                    <Check className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAdding(false);
                      setNewCat('');
                    }}
                    className="h-7 w-7 inline-flex items-center justify-center text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
                    title="Cancel"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                <p className="px-0.5 pt-1 text-[10px] text-gray-400 dark:text-gray-500">
                  Press Enter or ✓ — the category is added to this list and selected.
                </p>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setAdding(true)}
                className="w-full flex items-center gap-1.5 px-3 py-2 text-[12px] font-medium text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors"
              >
                <FolderPlus className="h-3.5 w-3.5" />
                Add new category
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
