"use client";

import { ChevronDown, SquareTerminal, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ConsoleLogLine {
  type: "stdin" | "stdout" | "stderr" | "system";
  content: string;
}

interface InputOutputPanelProps {
  open: boolean;
  onToggle: () => void;
  stdin: string;
  onStdinChange: (value: string) => void;
  lines: ConsoleLogLine[];
  onClear: () => void;
  running: boolean;
  /** Rendered when the runtime is blocked on a live `input()` prompt. */
  awaitingInput?: boolean;
  onSubmitInput?: (value: string) => void;
}

const LINE_TONE: Record<ConsoleLogLine["type"], string> = {
  stdin: "text-[#7FB2FF]",
  stdout: "text-[#D6E2F0]",
  stderr: "text-[#FF8B8B]",
  system: "text-[#7C8DA3]",
};

export default function InputOutputPanel({
  open,
  onToggle,
  stdin,
  onStdinChange,
  lines,
  onClear,
  running,
  awaitingInput,
  onSubmitInput,
}: InputOutputPanelProps) {
  return (
    <section className="flex-none overflow-hidden rounded-[10px] border border-[#DEE7F3] bg-white">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex h-[51px] w-full items-center justify-between px-4 transition-colors hover:bg-[#F8FAFE]"
      >
        <span className="flex items-center gap-2.5">
          <span className="flex h-[26px] w-[26px] items-center justify-center rounded-[7px] bg-[#F1F5FB]">
            <SquareTerminal className="h-[15px] w-[15px] text-[#39496B]" />
          </span>
          <span className="text-[14px] font-bold text-[#0B1437]">
            Input / Output (stdin / stdout)
          </span>
          {running && (
            <span className="rounded-full bg-[#FDF0DF] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#DE8100]">
              running
            </span>
          )}
          {awaitingInput && (
            <span className="rounded-full bg-[#E4F7EE] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#12A15C]">
              waiting for input
            </span>
          )}
        </span>
        <ChevronDown
          className={cn(
            "h-[18px] w-[18px] text-[#53658C] transition-transform duration-200",
            open && "rotate-180",
          )}
        />
      </button>

      {open && (
        <div className="grid grid-cols-2 divide-x divide-[#E7EEF8] border-t border-[#E7EEF8]">
          <div className="flex min-w-0 flex-col">
            <div className="flex h-[34px] items-center justify-between border-b border-[#E7EEF8] bg-[#F8FAFE] px-3">
              <span className="text-[11px] font-bold uppercase tracking-wide text-[#66789C]">
                stdin
              </span>
            </div>
            <textarea
              value={stdin}
              onChange={(e) => onStdinChange(e.target.value)}
              onKeyDown={(e) => {
                if (awaitingInput && e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  onSubmitInput?.(stdin);
                }
              }}
              spellCheck={false}
              placeholder={
                awaitingInput
                  ? "Program is waiting — type a line and press Enter"
                  : "Standard input passed to the program when you press Run Code…"
              }
              aria-label="Standard input"
              className="h-[168px] resize-none bg-white p-3 font-mono text-[12.5px] leading-[1.6] text-[#39496B] outline-none placeholder:font-sans placeholder:text-[#A6B4CC]"
            />
          </div>

          <div className="flex min-w-0 flex-col">
            <div className="flex h-[34px] items-center justify-between border-b border-[#E7EEF8] bg-[#F8FAFE] px-3">
              <span className="text-[11px] font-bold uppercase tracking-wide text-[#66789C]">
                stdout
              </span>
              <button
                type="button"
                onClick={onClear}
                title="Clear output"
                aria-label="Clear output"
                className="flex h-[22px] w-[22px] items-center justify-center rounded-[5px] text-[#8090AF] transition-colors hover:bg-white hover:text-[#DE3450]"
              >
                <Trash2 className="h-[13px] w-[13px]" />
              </button>
            </div>
            <div className="h-[168px] overflow-auto bg-[#182331] p-3 font-mono text-[12.5px] leading-[1.6] custom-scrollbar">
              {lines.length === 0 ? (
                <span className="text-[#5F7285]">
                  Output will appear here after you run the code.
                </span>
              ) : (
                lines.map((l, i) => (
                  <div
                    key={i}
                    className={cn("whitespace-pre-wrap break-words", LINE_TONE[l.type])}
                  >
                    {l.type === "stdin" ? `› ${l.content}` : l.content}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
