"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, Home } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ConsoleBreadcrumb, ConsoleStudent } from "./types";

interface AppHeaderProps {
  crumbs: ConsoleBreadcrumb[];
  /** Home crumb doubles as the console's exit — the header has no separate
   *  Back button, so the trail's home icon carries that job. */
  onHome?: () => void;
  student: ConsoleStudent | null;
  students: ConsoleStudent[];
  onStudentChange: (id: string) => void;
  /** 1-based position of the current STUDENT. The arrows beside it step
   *  through learners and never touch the selected question — question
   *  navigation lives in QuestionHeader. */
  studentPosition: number;
  studentTotal: number;
  onPrevStudent: () => void;
  onNextStudent: () => void;
  canPrevStudent: boolean;
  canNextStudent: boolean;
}

/**
 * Round student portrait. Falls back to initials when there is no usable image
 * AND when a URL that looked usable fails to load — without the error hook a
 * broken src just renders an empty circle, which is what a stored "default"
 * placeholder used to do here.
 */
function StudentAvatar({
  student,
  size,
}: {
  student: ConsoleStudent | null;
  size: number;
}) {
  const [failed, setFailed] = useState(false);
  const src = student?.avatarUrl;

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (src && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={student?.name || ""}
        // Supabase serves these public objects cross-origin; `no-referrer`
        // keeps the request working under the app's COEP header.
        //
        // NOT lazy-loaded: these are 22-32px and always on screen when
        // rendered, and inside the picker's scroll container the browser
        // deferred them indefinitely — every avatar stayed unfetched, which
        // looks identical to "this student has no photo".
        referrerPolicy="no-referrer"
        decoding="async"
        onError={() => setFailed(true)}
        style={{ width: size, height: size }}
        className="shrink-0 rounded-full border border-[#E5E7EB] object-cover"
      />
    );
  }

  return (
    <span
      style={{ width: size, height: size, fontSize: Math.round(size * 0.36) }}
      className="flex shrink-0 items-center justify-center rounded-full bg-[#E4EEFF] font-bold text-[#0667F9]"
      // A stored photo that would not load is worth saying out loud: silently
      // showing initials is exactly what made this look like "no photo on the
      // account" when the account did have one.
      title={failed && src ? `Profile image failed to load: ${src}` : undefined}
    >
      {student?.initials || "?"}
    </span>
  );
}

export default function AppHeader({
  crumbs,
  onHome,
  student,
  students,
  onStudentChange,
  studentPosition,
  studentTotal,
  onPrevStudent,
  onNextStudent,
  canPrevStudent,
  canNextStudent,
}: AppHeaderProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!pickerOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPickerOpen(false);
      }
    };
    const onEsc = (e: KeyboardEvent) => e.key === "Escape" && setPickerOpen(false);
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, [pickerOpen]);

  return (
    <header className="flex h-[62px] flex-none items-center border-b border-[#E5E7EB] bg-white px-4">
      {/* No product brand here — the LMS shell already carries it, and the
          space buys the breadcrumb enough room to show real titles instead of
          collapsing the middle of the trail away. */}
      <nav aria-label="Breadcrumb" className="flex min-w-0 flex-1 items-center overflow-hidden">
        <ol className="flex min-w-0 flex-nowrap items-center">
          <li className="flex shrink-0 items-center">
            <button
              type="button"
              onClick={onHome}
              title="Back"
              aria-label="Back"
              className="flex h-6 w-6 items-center justify-center rounded-[6px] text-[#53658C] transition-colors hover:bg-[#F1F6FE] hover:text-[#0667F9]"
            >
              <Home className="h-[14px] w-[14px]" />
            </button>
          </li>
          {crumbs.map((crumb, i) => {
            const last = i === crumbs.length - 1;
            return (
              <li key={`${crumb.label}-${i}`} className="flex min-w-0 items-center">
                <ChevronRight
                  className="mx-0.5 h-[13px] w-[13px] shrink-0 text-[#C6D2E4]"
                  aria-hidden
                />
                <button
                  type="button"
                  onClick={crumb.onClick}
                  disabled={!crumb.onClick}
                  title={crumb.title ?? crumb.label}
                  className={cn(
                    // Every crumb stays on screen and truncates individually,
                    // so the trail reads "Module … › Topic … › Exercise"
                    // rather than hiding whole levels behind one "…".
                    "truncate rounded px-1 py-0.5 text-[12px] leading-[16px] transition-colors",
                    last
                      ? "max-w-[220px] shrink-0 font-semibold text-[#0B1437]"
                      : "min-w-[52px] max-w-[170px] font-medium text-[#66789C]",
                    crumb.onClick && "hover:bg-[#F1F6FE] hover:text-[#0667F9]",
                  )}
                >
                  {crumb.label}
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      <div className="flex shrink-0 items-center gap-2.5 pl-3">
        {/* Student identity + picker */}
        <div className="relative" ref={pickerRef}>
          <button
            type="button"
            onClick={() => setPickerOpen((v) => !v)}
            aria-haspopup="listbox"
            aria-expanded={pickerOpen}
            title="Switch student"
            className="flex items-center gap-2 rounded-[8px] py-0.5 pl-0.5 pr-1 transition-colors hover:bg-[#F5F9FF]"
          >
            <StudentAvatar student={student} size={32} />
            <span className="text-left leading-none">
              <span className="block max-w-[130px] truncate text-[12.5px] font-bold text-[#0B1437]">
                {student?.name || "No student"}
              </span>
              <span className="mt-[2px] block text-[10.5px] font-medium text-[#8090AF]">
                {student?.role || "Student"}
              </span>
            </span>
            <ChevronDown className="h-[14px] w-[14px] shrink-0 text-[#8090AF]" />
          </button>

          {pickerOpen && students.length > 0 && (
            <ul
              role="listbox"
              className="absolute right-0 top-[calc(100%+6px)] z-[70] max-h-[320px] w-[248px] overflow-y-auto rounded-[9px] border border-[#E5E7EB] bg-white py-1 shadow-[0_10px_30px_rgba(11,20,55,0.12)]"
            >
              {students.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={s.id === student?.id}
                    onClick={() => {
                      onStudentChange(s.id);
                      setPickerOpen(false);
                    }}
                    className={cn(
                      "flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-[12.5px] transition-colors",
                      s.id === student?.id
                        ? "bg-[#EEF5FF] font-semibold text-[#0667F9]"
                        : "font-medium text-[#39496B] hover:bg-[#F5F9FF]",
                    )}
                  >
                    <StudentAvatar student={s} size={22} />
                    <span className="truncate">{s.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* STUDENT navigation — never question navigation. */}
        <div className="flex items-center overflow-hidden rounded-[8px] border border-[#E5E7EB] bg-white">
          <button
            type="button"
            onClick={onPrevStudent}
            disabled={!canPrevStudent}
            title="Previous student"
            aria-label="Previous student"
            className="flex h-[30px] w-[28px] items-center justify-center text-[#53658C] transition-colors hover:bg-[#F1F6FE] hover:text-[#0667F9] disabled:cursor-not-allowed disabled:text-[#C6D2E4] disabled:hover:bg-transparent"
          >
            <ChevronLeft className="h-[15px] w-[15px]" />
          </button>
          <span className="flex h-[30px] min-w-[52px] items-center justify-center border-x border-[#E7EEF8] px-1.5 text-[12px] font-semibold tabular-nums text-[#0B1437]">
            {studentPosition} / {studentTotal}
          </span>
          <button
            type="button"
            onClick={onNextStudent}
            disabled={!canNextStudent}
            title="Next student"
            aria-label="Next student"
            className="flex h-[30px] w-[28px] items-center justify-center text-[#53658C] transition-colors hover:bg-[#F1F6FE] hover:text-[#0667F9] disabled:cursor-not-allowed disabled:text-[#C6D2E4] disabled:hover:bg-transparent"
          >
            <ChevronRight className="h-[15px] w-[15px]" />
          </button>
        </div>
      </div>
    </header>
  );
}
