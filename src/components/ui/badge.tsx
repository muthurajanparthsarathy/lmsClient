import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-chip border px-2 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none focus-visible:ring-2 focus-visible:ring-brand/30 aria-invalid:ring-danger-500/20 aria-invalid:border-danger-500 transition-colors duration-150 overflow-hidden",
  {
    variants: {
      variant: {
        default:
          "border-brand-500/20 bg-brand-wash text-brand-strong [a&]:hover:bg-brand-wash-hover",
        secondary:
          "border-transparent bg-ink-100 text-ink-700 [a&]:hover:bg-ink-200",
        destructive:
          "border-danger-500/20 bg-danger-50 text-danger-700 [a&]:hover:bg-danger-50/80",
        outline:
          "border-hairline-strong text-body [a&]:hover:bg-row-hover [a&]:hover:text-heading",
        success:
          "border-success-500/20 bg-success-50 text-success-700",
        warning:
          "border-warn-500/20 bg-warn-50 text-warn-700",
        info:
          "border-info-500/20 bg-info-50 text-info-700",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "span"

  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
