"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface SwirlingProps extends React.SVGProps<SVGSVGElement> {
  /** Stroke thickness of the ring. Default 4. */
  strokeWidth?: number;
}

/**
 * Swirling — a tapered, gradient swirl loading spinner.
 *
 * Size is controlled via className (e.g. `size-24`, `size-10`).
 * Color follows the current text color (`currentColor`); pass a `text-*`
 * class to recolor it.
 *
 * Usage:
 *   <Swirling className="size-24 text-blue-500" />
 *   <Swirling className="size-10 text-orange-500" />
 */
export function Swirling({
  className,
  strokeWidth = 4,
  ...props
}: SwirlingProps) {
  // Unique gradient id so multiple spinners on one page don't collide.
  const gradId = React.useId();

  return (
    <svg
      viewBox="0 0 50 50"
      fill="none"
      role="status"
      aria-label="Loading"
      className={cn("size-6 animate-spin text-current", className)}
      {...props}
    >
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="1" />
        </linearGradient>
      </defs>

      {/* faint full track */}
      <circle
        cx="25"
        cy="25"
        r="20"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        className="opacity-15"
      />

      {/* tapered swirl arc (¾ turn) */}
      <path
        d="M25 5 a20 20 0 1 1 -20 20"
        stroke={`url(#${gradId})`}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </svg>
  );
}

export default Swirling;
