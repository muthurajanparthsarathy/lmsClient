import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-control text-sm font-medium cursor-pointer transition-[color,background-color,border-color,box-shadow,transform] duration-150 ease-standard disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-brand/30 aria-invalid:ring-danger-500/20 aria-invalid:border-danger-500",
  {
    variants: {
      variant: {
        default:
          "bg-brand-strong text-white shadow-xs hover:bg-brand-800 active:scale-[.98]",
        destructive:
          "bg-danger-700 text-white shadow-xs hover:bg-danger-700/90 active:scale-[.98] focus-visible:ring-danger-500/30",
        outline:
          "border border-hairline-strong bg-surface text-body shadow-xs hover:bg-row-hover hover:text-heading",
        secondary:
          "bg-ink-100 text-heading shadow-xs hover:bg-ink-200",
        ghost:
          "text-body hover:bg-row-hover hover:text-heading",
        link: "text-brand-strong underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        sm: "h-8 rounded-chip gap-1.5 px-3 has-[>svg]:px-2.5",
        lg: "h-10 px-6 has-[>svg]:px-4",
        icon: "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
