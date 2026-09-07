"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Users } from "lucide-react";
import { count } from "@/features/ld-dashboard/lib/format";
import { Card, Chip, Empty, MeterCell, Skeleton, Sparkline } from "./primitives";
import type { CourseHealthRow, OverviewModel, Tone } from "../types";

/**
 * Course Health — the bottom of the drill-down path.
 *
 * Dense on purpose: 44px rows, subtle in-cell bars and one status badge, so a
 * head can scan twenty courses without scrolling. The course name opens the
 * console's existing Course Delivery report scoped to that course, which is
 * why the row is a button rather than decoration.
 */

const STATUS_TONE: Record<string, Tone> = {
  Strong: "success",
  "On Track": "info",
  Attention: "warning",
  "At Risk": "danger",
};

const PAGE = 6;

export function CourseHealthTable({
  model,
  onOpenCourse,
}: {
  model: OverviewModel | null;
  onOpenCourse?: (row: CourseHealthRow) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  if (!model) {
    return (
      <Card title="Course Health">
        <div style={{ display: "grid", gap: 8 }}>
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} h={40} />)}
        </div>
      </Card>
    );
  }

  if (model.courses.length === 0) {
    return (
      <Card title="Course Health">
        <Empty title="No training data available for the selected filters." hint="Try widening the client or course filter." />
      </Card>
    );
  }

  const rows = expanded ? model.courses : model.courses.slice(0, PAGE);
  const more = model.courses.length - rows.length;

  return (
    <Card title="Course Health" sub={`${model.courses.length} course${model.courses.length === 1 ? "" : "s"} in scope`}>
      <div className="ldo-tblwrap">
        <table className="ldo-tbl">
          <thead>
            <tr>
              <th>Course</th>
              <th>Learners</th>
              <th>Course Progress</th>
              <th>Practice Completion</th>
              <th>Skill Mastery</th>
              <th>Industry Readiness</th>
              <th>Status</th>
              <th>Trend</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>
                  <button
                    type="button"
                    className="ldo-cname"
                    onClick={() => onOpenCourse?.(r)}
                    title={`Open the Course Delivery report for ${r.name}`}
                  >
                    {r.name}
                    <small>{r.client}</small>
                  </button>
                </td>
                <td className="num">
                  <span className="ldo-learners">
                    <Users size={13} strokeWidth={1.9} aria-hidden />
                    {count(r.learners)}
                  </span>
                </td>
                <td><MeterCell value={r.progress} /></td>
                <td><MeterCell value={r.practice} /></td>
                <td><MeterCell value={r.mastery} /></td>
                <td><MeterCell value={r.readiness} /></td>
                <td>
                  {r.status ? (
                    <Chip tone={STATUS_TONE[r.status] ?? "neutral"}>{r.status}</Chip>
                  ) : (
                    <Chip tone="neutral">No data</Chip>
                  )}
                </td>
                <td>
                  {r.spark.length > 1 ? (
                    <Sparkline
                      points={r.spark}
                      tone={r.status === "At Risk" ? "danger" : r.status === "Attention" ? "warning" : "success"}
                      width={62}
                    />
                  ) : (
                    <span style={{ color: "var(--muted)", fontSize: 11 }}>—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {model.courses.length > PAGE ? (
        <button type="button" className="ldo-more" onClick={() => setExpanded((v) => !v)}>
          {expanded ? (
            <>Show fewer courses <ChevronUp size={13} strokeWidth={2.2} aria-hidden /></>
          ) : (
            <>View all {model.courses.length} courses ({more} more) <ChevronDown size={13} strokeWidth={2.2} aria-hidden /></>
          )}
        </button>
      ) : null}
    </Card>
  );
}
