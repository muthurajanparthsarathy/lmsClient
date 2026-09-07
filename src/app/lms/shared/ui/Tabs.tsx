"use client";

import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

const EASE_STANDARD: [number, number, number, number] = [0.2, 0, 0, 1];

/* The active-tab value lives in context so each trigger can decide whether it
   owns the motion underline; the layoutId is scoped per TabsList with a React
   id so two Tabs instances on one page never fight over the same pill. */
const TabsValueContext = React.createContext<string | undefined>(undefined);
const TabsListContext = React.createContext<string>("tab-underline");

export interface TabsProps
  extends React.ComponentPropsWithoutRef<typeof TabsPrimitive.Root> {
  children: React.ReactNode;
}

export function Tabs({
  value,
  defaultValue,
  onValueChange,
  children,
  ...props
}: TabsProps) {
  const [internalValue, setInternalValue] = React.useState(defaultValue);
  const activeValue = value !== undefined ? value : internalValue;

  const handleValueChange = (next: string) => {
    setInternalValue(next);
    onValueChange?.(next);
  };

  return (
    <TabsValueContext.Provider value={activeValue}>
      <TabsPrimitive.Root
        value={activeValue}
        onValueChange={handleValueChange}
        {...props}
      >
        {children}
      </TabsPrimitive.Root>
    </TabsValueContext.Provider>
  );
}

export interface TabsListProps
  extends React.ComponentPropsWithoutRef<typeof TabsPrimitive.List> {
  children: React.ReactNode;
}

export function TabsList({ className, children, ...props }: TabsListProps) {
  const layoutId = React.useId();

  return (
    <TabsListContext.Provider value={layoutId}>
      <TabsPrimitive.List
        className={cn("flex items-center border-b border-hairline", className)}
        {...props}
      >
        {children}
      </TabsPrimitive.List>
    </TabsListContext.Provider>
  );
}

export interface TabsTriggerProps
  extends React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger> {
  children: React.ReactNode;
}

export function TabsTrigger({
  className,
  value,
  children,
  ...props
}: TabsTriggerProps) {
  const activeValue = React.useContext(TabsValueContext);
  const layoutId = React.useContext(TabsListContext);
  const isActive = activeValue === value;

  return (
    <TabsPrimitive.Trigger
      value={value}
      className={cn(
        "relative mr-5 h-10 px-1 text-sm font-medium text-subtle transition-colors hover:text-body focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/15 data-[state=active]:text-heading disabled:pointer-events-none disabled:opacity-50",
        className
      )}
      {...props}
    >
      {children}
      {isActive ? (
        <motion.span
          layoutId={layoutId}
          className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-brand-500"
          transition={{ type: "tween", duration: 0.18, ease: EASE_STANDARD }}
        />
      ) : null}
    </TabsPrimitive.Trigger>
  );
}

export interface TabsContentProps
  extends React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content> {
  children: React.ReactNode;
}

export function TabsContent({ className, children, ...props }: TabsContentProps) {
  return (
    <TabsPrimitive.Content
      className={cn("mt-4 focus-visible:outline-none", className)}
      {...props}
    >
      {children}
    </TabsPrimitive.Content>
  );
}
