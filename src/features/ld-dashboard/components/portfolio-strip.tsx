"use client";

/**
 * Portfolio counts — Clients / Courses / Students / Trainers.
 *
 * These are cards, per the agreed design — but deliberately a WEIGHT BELOW the
 * KPI row beneath them. The earlier slim strip existed to stop "3 clients"
 * claiming the same real estate as "5 at-risk students": counts are *scope
 * context* (what you are looking at), while completion / score / risk /
 * activity are *outcomes* (how it is going). Cards give the counts their own
 * surface without surrendering that distinction — the value here is text-3xl
 * (24px) against the KPI cards' text-4xl (30px), so the eye still lands on the
 * outcomes first.
 */

import { Building2, GraduationCap, Library, UserCog } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Icon } from "../types";
import { count, plural } from "../lib/format";
import type { DashboardModel } from "../types";

interface Item {
  icon: Icon;
  label: string;
  value: string;
  detail: string;
  href: string;
}

export function PortfolioStrip({ model }: { model: DashboardModel }) {
  // Each count opens the list it counts. The client/course selection lives
  // above the hash router, so it survives the jump and the destination opens
  // already narrowed to what was on screen here — never the full record set.
  const items: Item[] = [
    {
      icon: Building2,
      label: "Clients",
      value: count(model.clients),
      detail: plural(model.courses, "course"),
      href: "#clients",
    },
    {
      icon: Library,
      label: "Courses",
      value: count(model.courses),
      detail: `${model.activeCourses} with learners`,
      href: "#courses",
    },
    {
      icon: GraduationCap,
      label: "Students",
      value: count(model.students),
      detail: `${count(model.completed)} completed`,
      href: "#perf-progress",
    },
    {
      icon: UserCog,
      label: "Trainers",
      value: count(model.trainers),
      detail: "on course rosters",
      href: "#trainers",
    },
  ];

  return (
    <section
      aria-label="Portfolio scope"
      className="grid grid-cols-2 gap-3 sm:gap-4 @3xl:grid-cols-4"
    >
      {items.map((it) => (
        <a
          key={it.label}
          href={it.href}
          className={cn(
            "group flex min-w-0 items-center gap-3.5 rounded-tile border border-hairline bg-surface p-4 shadow-sm outline-none sm:p-5",
            "transition-colors duration-fast hover:border-brand-500/40 hover:bg-row-hover focus-visible:ring-2 focus-visible:ring-brand-500/40 dark:hover:bg-ink-800/60",
          )}
        >
          {/* Orange at rest, not only on hover — the icon tile is the card's
              one piece of brand colour and it should read as such standing still. */}
          <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-chip bg-brand-100 text-brand-500 dark:bg-brand-500/15 dark:text-brand-400">
            <it.icon size={20} strokeWidth={2.1} aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-3xl leading-none font-semibold tabular-nums text-heading">
              {it.value}
            </p>
            <p className="mt-1.5 truncate text-sm font-medium text-body">{it.label}</p>
            <p className="mt-0.5 truncate text-2xs text-subtle">{it.detail}</p>
          </div>
        </a>
      ))}
    </section>
  );
}
