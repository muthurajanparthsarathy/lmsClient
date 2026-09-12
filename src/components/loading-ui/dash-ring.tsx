"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface DashRingProps extends React.SVGProps<SVGSVGElement> {
  /** Stroke thickness of the ring. Default 3. */
  strokeWidth?: number;
}

/**
 * DashRing — a lightweight dashed circular loading spinner.
 *
 * Size is controlled via className (e.g. `size-14`, `w-6 h-6`).
 * Color follows the current text color (`currentColor`), so wrap it in a
 * coloured element or pass a `text-*` class to recolor it.
 *
 * Usage:
 *   <DashRing className="size-14 text-orange-500" />
 */
export function DashRing({
  className,
  strokeWidth = 3,
  ...props
}: DashRingProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      role="status"
      aria-label="Loading"
      className={cn("size-6 animate-spin text-current", className)}
      {...props}
    >
      {/* faint track */}
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        className="opacity-20"
      />
      {/* moving dash */}
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray="44"
        strokeDashoffset="34"
      />
    </svg>
  );
}

export default DashRing;
