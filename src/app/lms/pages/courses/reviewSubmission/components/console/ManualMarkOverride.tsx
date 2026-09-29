"use client";

import { ChevronDown, ChevronUp, Info } from "lucide-react";

interface ManualMarkOverrideProps {
  /** Verbatim text of the input; `page.tsx` owns the committed number. */
  value: string;
  onValueChange: (value: string) => void;
  onCommit: () => void;
  onStep: (delta: number) => void;
  max: number;
  /**
   * True only when the exercise is auto-evaluated (test-case or AI): there is
   * already a machine score, so typing here is genuinely OPTIONAL — an
   * override.
   *
   * On a manually-evaluated exercise (and on legacy exercises with no stored
   * method, which the console grades manually) this mark IS the grade, so
   * calling it optional was simply wrong.
   */
  optional?: boolean;
  disabled?: boolean;
}

export default function ManualMarkOverride({
  value,
  onValueChange,
  onCommit,
  onStep,
  max,
  optional,
  disabled,
}: ManualMarkOverrideProps) {
  return (
    <section className="rounded-[12px] border border-[#F3DCBD] bg-[#FFFCF7] px-4 pb-3.5 pt-3">
      <div className="flex items-start justify-between gap-2">
        <span className="flex items-center gap-1.5">
          <span className="text-[12.5px] font-bold text-[#DE8100]">
            Manual Mark Override{optional ? " (Optional)" : ""}
          </span>
          <span
            title={
              optional
                ? "This question already has an auto-evaluated score. Enter a mark here only to override it."
                : "This exercise is graded manually — this mark is the grade."
            }
            className="flex h-[16px] w-[16px] items-center justify-center rounded-full text-[#0667F9]"
          >
            <Info className="h-[15px] w-[15px]" />
          </span>
        </span>
        <span className="shrink-0 pt-[1px] text-[11.5px] font-medium text-[#8090AF]">
          Maximum: {max}
        </span>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <div className="flex h-[40px] w-[145px] items-center overflow-hidden rounded-[8px] border border-[#DEE7F3] bg-white focus-within:border-[#0667F9]">
          <input
            type="text"
            inputMode="decimal"
            autoComplete="off"
            aria-label={`Manual mark out of ${max}`}
            value={value}
            disabled={disabled}
            onChange={(e) => onValueChange(e.target.value)}
            onBlur={onCommit}
            className="h-full min-w-0 flex-1 bg-transparent px-3 text-[16px] font-semibold text-[#0B1437] outline-none disabled:cursor-not-allowed disabled:text-[#8090AF]"
          />
          <span className="flex h-full flex-col border-l border-[#E7EEF8]">
            <button
              type="button"
              onClick={() => onStep(1)}
              disabled={disabled}
              aria-label="Increase mark"
              className="flex flex-1 items-center justify-center px-1.5 text-[#53658C] transition-colors hover:bg-[#F1F6FE] hover:text-[#0667F9] disabled:cursor-not-allowed"
            >
              <ChevronUp className="h-[13px] w-[13px]" />
            </button>
            <button
              type="button"
              onClick={() => onStep(-1)}
              disabled={disabled}
              aria-label="Decrease mark"
              className="flex flex-1 items-center justify-center border-t border-[#E7EEF8] px-1.5 text-[#53658C] transition-colors hover:bg-[#F1F6FE] hover:text-[#0667F9] disabled:cursor-not-allowed"
            >
              <ChevronDown className="h-[13px] w-[13px]" />
            </button>
          </span>
        </div>
        <span className="text-[20px] font-bold tracking-[-0.01em] text-[#0B1437]">
          / {max}
        </span>
      </div>

      <p className="mt-2.5 text-[11.5px] font-medium leading-[1.5] text-[#53658C]">
        You can adjust the final mark for this question manually.
      </p>
    </section>
  );
}
