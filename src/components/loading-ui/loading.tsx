"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Swirling } from "./swirling";

const COLOR_MAP = {
  blue: "text-orange-500",
  orange: "text-orange-500",
  gray: "text-gray-400",
} as const;

export type LoadingColor = keyof typeof COLOR_MAP;

export interface LoadingProps {
  /** Optional text shown under the spinner. */
  label?: string;
  /** Spinner size class. Default "size-10". */
  size?: string;
  /** Spinner color theme. Default "orange". */
  color?: LoadingColor;
  /** Fill the parent and center the spinner. Default true. */
  fullHeight?: boolean;
  /** Extra classes for the wrapper. */
  className?: string;
  /** Extra classes for the spinner (overrides color). */
  spinnerClassName?: string;
}

/**
 * Loading — the single, app-wide loading indicator (uses <Swirling/>).
 *
 * Examples:
 *   <Loading />                                  // centered, orange
 *   <Loading color="blue" label="Loading…" />    // blue
 *   <Loading size="size-6" fullHeight={false} /> // inline
 */
export function Loading({
  label,
  size = "size-10",
  color = "orange",
  fullHeight = true,
  className,
  spinnerClassName,
}: LoadingProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3",
        fullHeight && "w-full h-full min-h-[120px]",
        className
      )}
    >
      <Swirling className={cn(size, COLOR_MAP[color], spinnerClassName)} />
      {label && (
        <span className="text-sm font-medium text-gray-500">{label}</span>
      )}
    </div>
  );
}

export default Loading;
