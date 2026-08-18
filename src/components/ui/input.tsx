import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "file:text-body placeholder:text-faint selection:bg-brand-200 selection:text-heading border-hairline-strong flex h-9 w-full min-w-0 rounded-control border bg-surface px-3 py-1 text-base text-body shadow-xs transition-[color,box-shadow,border-color] duration-150 outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        "hover:border-line-hover focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/15",
        "aria-invalid:ring-danger-500/20 aria-invalid:border-danger-500",
        className
      )}
      {...props}
    />
  )
}

export { Input }
