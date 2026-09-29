"use client"

import * as React from "react"
import * as SelectPrimitive from "@radix-ui/react-select"
import { CheckIcon, ChevronDownIcon, ChevronUpIcon } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils"

function Select({
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Root>) {
  return <SelectPrimitive.Root data-slot="select" {...props} />
}

function SelectGroup({
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Group>) {
  return <SelectPrimitive.Group data-slot="select-group" {...props} />
}

function SelectValue({
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Value>) {
  return <SelectPrimitive.Value data-slot="select-value" {...props} />
}
function SelectTrigger({
  className,
  size = "default",
  children,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Trigger> & {
  size?: "sm" | "default";
}) {
  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      data-size={size}
      /* make it a ‘group’ so children can react to data‑state */
      className={cn(
        "group flex w-fit items-center justify-between gap-2 cursor-pointer text-body rounded-control border border-hairline-strong bg-surface px-3 py-2",
        "text-xs sm:text-xs h-8 select-none outline-none",
        "transition-colors duration-150 hover:border-line-hover focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/15",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    >
      {children}

      {/* ▾ icon rotates when menu opens */}
      <SelectPrimitive.Icon asChild>

        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 320 512"
          /* same sizing & color you had before + the rotation hack */
          className="size-4 fill-ink-500 opacity-70
               transition-transform duration-100
               group-data-[state=open]:rotate-180"
        >
          <path d="M137.4 374.6c12.5 12.5 32.8 12.5 45.3 0l128-128c9.2-9.2 11.9-22.9 6.9-34.9s-16.6-19.8-29.6-19.8L32 192c-12.9 0-24.6 7.8-29.6 19.8s-2.2 25.7 6.9 34.9l128 128z" />
        </svg>
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
}
function SelectContent({
  children,
  position = "popper",
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Content>) {
  return (
    <SelectPrimitive.Portal>
      <AnimatePresence>
        {/* Radix gives `data-state="open" | "closed"` on Content.
            We use `asChild` so motion.div receives those props
            and AnimatePresence handles mount/unmount.            */}
        <SelectPrimitive.Content
          // forceMount
          asChild
          position={position}
          {...props}
        >
          <motion.div
            initial={{ opacity: 0, scaleY: 0.95 }}
            animate={{ opacity: 1, scaleY: 1 }}
            exit={{ opacity: 0, scaleY: 0.95 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            style={{ originY: 0 }}
            className={cn(
              "z-popover min-w-[8rem] overflow-y-auto cursor-pointer rounded-tile border border-hairline bg-surface text-body shadow-lg",
              position === "popper" &&
              "data-[side=bottom]:translate-y-1 data-[side=top]:-translate-y-1",
              className
            )}
          >
            {children}
          </motion.div>
        </SelectPrimitive.Content>
      </AnimatePresence>
    </SelectPrimitive.Portal>
  );
}

function SelectLabel({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Label>) {
  return (
    <SelectPrimitive.Label
      data-slot="select-label"
      className={cn("text-faint px-2 cursor-pointer py-1.5 text-xs", className)}
      {...props}
    />
  )
}
function SelectItem({
  children,
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Item>) {
  return (
    <SelectPrimitive.Item asChild {...props}>
      {/* Framer Motion wrapper for ripple‑ish tap */}
      <motion.div
        whileTap={{ scale: 0.97 }}
        className={cn(
          "relative flex w-full cursor-default select-none items-center gap-2 cursor-pointer rounded-chip py-1.5 pl-2 pr-8 text-xs text-body",
          "focus:bg-row-hover focus:text-heading data-[highlighted]:bg-row-hover data-[highlighted]:text-heading",
          "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
          className
        )}
      >
        <span className="absolute right-2 flex size-3.5 items-center justify-center">
          <SelectPrimitive.ItemIndicator>
            <CheckIcon className="size-4 text-brand-strong" />
          </SelectPrimitive.ItemIndicator>
        </span>
        <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
      </motion.div>
    </SelectPrimitive.Item>
  );
}

function SelectSeparator({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Separator>) {
  return (
    <SelectPrimitive.Separator
      data-slot="select-separator"
      className={cn("bg-hairline pointer-events-none cursor-pointer -mx-1 my-1 h-px", className)}
      {...props}
    />
  )
}

function SelectScrollUpButton({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollUpButton>) {
  return (
    <SelectPrimitive.ScrollUpButton
      data-slot="select-scroll-up-button"
      className={cn(
        "flex cursor-default items-center cursor-pointer justify-center py-1",
        className
      )}
      {...props}
    >
      <ChevronUpIcon className="size-4" />
    </SelectPrimitive.ScrollUpButton>
  )
}

function SelectScrollDownButton({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollDownButton>) {
  return (
    <SelectPrimitive.ScrollDownButton
      data-slot="select-scroll-down-button"
      className={cn(
        "flex cursor-default items-center justify-center py-1",
        className
      )}
      {...props}
    >
      <ChevronDownIcon className="size-4" />
    </SelectPrimitive.ScrollDownButton>
  )
}

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
}
