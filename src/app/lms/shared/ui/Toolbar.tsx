"use client";

import * as React from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ToolbarSearch {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export interface ToolbarProps {
  search?: ToolbarSearch;
  filters?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

export function Toolbar({ search, filters, actions, className }: ToolbarProps) {
  return (
    <div
      className={cn(
        "flex min-h-14 flex-wrap items-center gap-3 border-b border-hairline px-4 py-3",
        className
      )}
    >
      {search ? (
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint" />
          <input
            type="text"
            value={search.value}
            onChange={(event) => search.onChange(event.target.value)}
            placeholder={search.placeholder ?? "Search…"}
            className="h-9 w-64 rounded-control border border-hairline-strong bg-surface pl-9 pr-3 text-sm text-body placeholder:text-faint transition-colors focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15"
          />
        </div>
      ) : null}
      {filters ? (
        <div className="flex flex-wrap items-center gap-2">{filters}</div>
      ) : null}
      <div className="flex-1" />
      {actions ? (
        <div className="flex items-center gap-2">{actions}</div>
      ) : null}
    </div>
  );
}
