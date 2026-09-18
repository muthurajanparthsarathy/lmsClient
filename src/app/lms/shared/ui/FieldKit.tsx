"use client";

import * as React from "react";
import * as Popover from "@radix-ui/react-popover";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import { Command } from "cmdk";
import { Check, ChevronsUpDown, Search, X, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/* ──────────────────────────────────────────────────────────────────────────
   Field — label + control + error/hint wrapper
   ────────────────────────────────────────────────────────────────────────── */

export interface FieldProps {
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  htmlFor?: string;
  children: React.ReactNode;
}

export function Field({
  label,
  required = false,
  error,
  hint,
  htmlFor,
  children,
}: FieldProps) {
  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="mb-1.5 block text-sm font-medium text-body"
      >
        {label}
        {required ? <span className="ml-0.5 text-brand-strong">*</span> : null}
      </label>
      {children}
      {error ? (
        <p className="mt-1 text-xs text-danger-700">{error}</p>
      ) : hint ? (
        <p className="mt-1 text-xs text-faint">{hint}</p>
      ) : null}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Input / Textarea
   ────────────────────────────────────────────────────────────────────────── */

const inputBaseClasses =
  "h-10 w-full rounded-control border border-hairline-strong bg-surface px-3 text-sm text-body placeholder:text-faint transition-colors focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15 disabled:cursor-not-allowed disabled:bg-ink-50 disabled:text-subtle";

const inputInvalidClasses =
  "border-danger-500 focus:border-danger-500 focus:ring-danger-500/15";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  leading?: LucideIcon;
  invalid?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  function Input({ leading: Leading, invalid = false, className, ...props }, ref) {
    const input = (
      <input
        ref={ref}
        aria-invalid={invalid || undefined}
        className={cn(
          inputBaseClasses,
          Leading && "pl-9",
          invalid && inputInvalidClasses,
          className
        )}
        {...props}
      />
    );

    if (!Leading) return input;

    return (
      <div className="relative">
        <Leading className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint" />
        {input}
      </div>
    );
  }
);

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  function Textarea({ invalid = false, className, ...props }, ref) {
    return (
      <textarea
        ref={ref}
        aria-invalid={invalid || undefined}
        className={cn(
          inputBaseClasses,
          "h-auto min-h-24 py-2.5",
          invalid && inputInvalidClasses,
          className
        )}
        {...props}
      />
    );
  }
);

export interface DateInputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

/**
 * Styled native date input. `type` defaults to "date" but can be overridden
 * (e.g. "datetime-local", "month") since the chrome is identical.
 */
export const DateInput = React.forwardRef<HTMLInputElement, DateInputProps>(
  function DateInput({ invalid = false, className, type = "date", ...props }, ref) {
    return (
      <input
        ref={ref}
        type={type}
        aria-invalid={invalid || undefined}
        className={cn(
          inputBaseClasses,
          "cursor-pointer [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-60 [&::-webkit-calendar-picker-indicator]:transition-opacity [&::-webkit-calendar-picker-indicator]:hover:opacity-100",
          invalid && inputInvalidClasses,
          className
        )}
        {...props}
      />
    );
  }
);

/* ──────────────────────────────────────────────────────────────────────────
   SearchableSelect / MultiSelect — Radix Popover + cmdk list
   ────────────────────────────────────────────────────────────────────────── */

export interface SelectOption {
  value: string;
  label: string;
}

const triggerBaseClasses =
  "flex w-full items-center justify-between gap-2 rounded-control border border-hairline-strong bg-surface px-3 text-left text-sm transition-colors focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15 disabled:cursor-not-allowed disabled:bg-ink-50 disabled:text-subtle";

const popoverContentClasses =
  "z-popover w-[var(--radix-popover-trigger-width)] overflow-hidden rounded-tile border border-hairline-strong bg-surface p-0 shadow-lg data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0";

const optionItemClasses =
  "flex cursor-pointer select-none items-center gap-2 rounded-chip px-2.5 py-2 text-sm text-body data-[selected=true]:bg-brand-wash data-[selected=true]:text-heading";

interface CommandSearchProps {
  placeholder?: string;
}

function CommandSearch({ placeholder = "Search…" }: CommandSearchProps) {
  return (
    <div className="flex items-center gap-2 border-b border-hairline px-3">
      <Search className="size-4 shrink-0 text-faint" />
      <Command.Input
        placeholder={placeholder}
        className="h-9 w-full bg-transparent text-sm text-body outline-none placeholder:text-faint"
      />
    </div>
  );
}

export interface SearchableSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  invalid?: boolean;
  clearable?: boolean;
}

export function SearchableSelect({
  value,
  onChange,
  options,
  placeholder = "Select…",
  disabled = false,
  invalid = false,
  clearable = false,
}: SearchableSelectProps) {
  const [open, setOpen] = React.useState(false);
  const listId = React.useId();
  const selected = options.find((option) => option.value === value);

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          disabled={disabled}
          aria-invalid={invalid || undefined}
          className={cn(
            triggerBaseClasses,
            "h-10",
            invalid && inputInvalidClasses
          )}
        >
          <span
            className={cn("truncate", selected ? "text-body" : "text-faint")}
          >
            {selected ? selected.label : placeholder}
          </span>
          <span className="flex shrink-0 items-center gap-1">
            {clearable && selected && !disabled ? (
              <span
                role="button"
                aria-label="Clear selection"
                tabIndex={-1}
                onPointerDown={(event) => {
                  event.stopPropagation();
                  event.preventDefault();
                }}
                onClick={(event) => {
                  event.stopPropagation();
                  onChange("");
                }}
                className="rounded-[4px] p-0.5 text-faint transition-colors hover:bg-ink-100 hover:text-body"
              >
                <X className="size-3.5" />
              </span>
            ) : null}
            <ChevronsUpDown className="size-4 text-faint" />
          </span>
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          className={popoverContentClasses}
        >
          <Command>
            <CommandSearch />
            <Command.List id={listId} className="max-h-64 overflow-auto p-1">
              <Command.Empty className="px-3 py-6 text-center text-sm text-subtle">
                No results found.
              </Command.Empty>
              {options.map((option) => (
                <Command.Item
                  key={option.value}
                  value={option.value}
                  keywords={[option.label]}
                  onSelect={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                  className={optionItemClasses}
                >
                  <span className="flex-1 truncate">{option.label}</span>
                  {value === option.value ? (
                    <Check className="size-4 shrink-0 text-brand-strong" />
                  ) : null}
                </Command.Item>
              ))}
            </Command.List>
          </Command>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

export interface MultiSelectProps {
  value: string[];
  onChange: (value: string[]) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  invalid?: boolean;
  clearable?: boolean;
}

export function MultiSelect({
  value,
  onChange,
  options,
  placeholder = "Select…",
  disabled = false,
  invalid = false,
  clearable = false,
}: MultiSelectProps) {
  const [open, setOpen] = React.useState(false);
  const listId = React.useId();
  const selected = options.filter((option) => value.includes(option.value));

  const toggle = (optionValue: string) => {
    onChange(
      value.includes(optionValue)
        ? value.filter((item) => item !== optionValue)
        : [...value, optionValue]
    );
  };

  const remove = (optionValue: string) => {
    onChange(value.filter((item) => item !== optionValue));
  };

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          disabled={disabled}
          aria-invalid={invalid || undefined}
          className={cn(
            triggerBaseClasses,
            "min-h-10 py-1.5",
            invalid && inputInvalidClasses
          )}
        >
          {selected.length > 0 ? (
            <span className="flex flex-1 flex-wrap items-center gap-1.5">
              {selected.map((option) => (
                <span
                  key={option.value}
                  className="flex items-center gap-1 rounded-chip border border-brand-500/20 bg-brand-wash py-0.5 pl-2 pr-1 text-xs font-medium text-brand-strong"
                >
                  <span className="max-w-40 truncate">{option.label}</span>
                  {!disabled ? (
                    <span
                      role="button"
                      aria-label={`Remove ${option.label}`}
                      tabIndex={-1}
                      onPointerDown={(event) => {
                        event.stopPropagation();
                        event.preventDefault();
                      }}
                      onClick={(event) => {
                        event.stopPropagation();
                        remove(option.value);
                      }}
                      className="rounded-[4px] p-0.5 transition-colors hover:bg-brand-wash-hover"
                    >
                      <X className="size-3" />
                    </span>
                  ) : null}
                </span>
              ))}
            </span>
          ) : (
            <span className="truncate text-faint">{placeholder}</span>
          )}
          <span className="flex shrink-0 items-center gap-1">
            {clearable && selected.length > 0 && !disabled ? (
              <span
                role="button"
                aria-label="Clear all"
                tabIndex={-1}
                onPointerDown={(event) => {
                  event.stopPropagation();
                  event.preventDefault();
                }}
                onClick={(event) => {
                  event.stopPropagation();
                  onChange([]);
                }}
                className="rounded-[4px] p-0.5 text-faint transition-colors hover:bg-ink-100 hover:text-body"
              >
                <X className="size-3.5" />
              </span>
            ) : null}
            <ChevronsUpDown className="size-4 text-faint" />
          </span>
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          className={popoverContentClasses}
        >
          <Command>
            <CommandSearch />
            <Command.List id={listId} className="max-h-64 overflow-auto p-1">
              <Command.Empty className="px-3 py-6 text-center text-sm text-subtle">
                No results found.
              </Command.Empty>
              {options.map((option) => {
                const isChecked = value.includes(option.value);
                return (
                  <Command.Item
                    key={option.value}
                    value={option.value}
                    keywords={[option.label]}
                    onSelect={() => toggle(option.value)}
                    className={optionItemClasses}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        "flex size-4 shrink-0 items-center justify-center rounded-[4px] border transition-colors",
                        isChecked
                          ? "border-brand-strong bg-brand-strong text-white"
                          : "border-line-muted bg-surface"
                      )}
                    >
                      {isChecked ? (
                        <Check className="size-3" strokeWidth={3} />
                      ) : null}
                    </span>
                    <span className="flex-1 truncate">{option.label}</span>
                  </Command.Item>
                );
              })}
            </Command.List>
          </Command>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Checkbox / Switch — styled Radix wrappers
   ────────────────────────────────────────────────────────────────────────── */

export type CheckboxProps = React.ComponentPropsWithoutRef<
  typeof CheckboxPrimitive.Root
>;

export const Checkbox = React.forwardRef<
  React.ComponentRef<typeof CheckboxPrimitive.Root>,
  CheckboxProps
>(function Checkbox({ className, ...props }, ref) {
  return (
    <CheckboxPrimitive.Root
      ref={ref}
      className={cn(
        "flex size-4.5 shrink-0 items-center justify-center rounded-[5px] border border-line-muted bg-surface transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/15 data-[state=checked]:border-brand-strong data-[state=checked]:bg-brand-strong data-[state=checked]:text-white disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator className="flex items-center justify-center text-current">
        <Check className="size-3" strokeWidth={3} />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
});

export type SwitchProps = React.ComponentPropsWithoutRef<
  typeof SwitchPrimitive.Root
>;

export const Switch = React.forwardRef<
  React.ComponentRef<typeof SwitchPrimitive.Root>,
  SwitchProps
>(function Switch({ className, ...props }, ref) {
  return (
    <SwitchPrimitive.Root
      ref={ref}
      className={cn(
        "inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/15 data-[state=checked]:bg-brand-strong data-[state=unchecked]:bg-ink-200 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb className="pointer-events-none block size-4 translate-x-0.5 rounded-full bg-white shadow-sm transition-transform data-[state=checked]:translate-x-[18px]" />
    </SwitchPrimitive.Root>
  );
});

/* ──────────────────────────────────────────────────────────────────────────
   RadioGroup / RadioItem — plain styled inputs, context-wired
   ────────────────────────────────────────────────────────────────────────── */

interface RadioGroupContextValue {
  name: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

const RadioGroupContext = React.createContext<RadioGroupContextValue | null>(
  null
);

export interface RadioGroupProps {
  value: string;
  onChange: (value: string) => void;
  name?: string;
  disabled?: boolean;
  className?: string;
  children: React.ReactNode;
}

export function RadioGroup({
  value,
  onChange,
  name,
  disabled = false,
  className,
  children,
}: RadioGroupProps) {
  const autoName = React.useId();

  return (
    <RadioGroupContext.Provider
      value={{ name: name ?? autoName, value, onChange, disabled }}
    >
      <div role="radiogroup" className={cn("flex flex-col gap-2.5", className)}>
        {children}
      </div>
    </RadioGroupContext.Provider>
  );
}

export interface RadioItemProps {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
  className?: string;
}

export function RadioItem({
  value,
  label,
  description,
  disabled = false,
  className,
}: RadioItemProps) {
  const context = React.useContext(RadioGroupContext);
  if (!context) {
    throw new Error("RadioItem must be used inside a RadioGroup");
  }

  const isDisabled = disabled || context.disabled;
  const isChecked = context.value === value;

  return (
    <label
      className={cn(
        "flex items-start gap-2.5",
        isDisabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
        className
      )}
    >
      <input
        type="radio"
        className="peer sr-only"
        name={context.name}
        value={value}
        checked={isChecked}
        disabled={isDisabled}
        onChange={() => context.onChange(value)}
      />
      <span
        aria-hidden
        className={cn(
          "mt-0.5 flex size-4.5 shrink-0 items-center justify-center rounded-full border bg-surface transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-brand/15",
          isChecked ? "border-brand-strong" : "border-line-muted"
        )}
      >
        {isChecked ? (
          <span className="size-2.5 rounded-full bg-brand-strong" />
        ) : null}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium text-body">{label}</span>
        {description ? (
          <span className="mt-0.5 block text-xs text-subtle">{description}</span>
        ) : null}
      </span>
    </label>
  );
}
