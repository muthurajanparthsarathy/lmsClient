"use client";

import React, { useState } from "react";
import {
  User, BookOpen, CheckSquare, ChevronRight,
  Clock, Plus, Circle, CheckCircle2, Flame, Target,
} from "lucide-react";
import type { YouDoProps } from "./TestYourSkills";

// ─── Design tokens ────────────────────────────────────────────────────────────
const T = {
  orange: "#f97316",
  orangeDark: "#ea580c",
  orangeLight: "rgba(249,115,22,0.08)",
  orangeGlow: "rgba(249,115,22,0.22)",
  purple: "#8b5cf6",
  purpleLight: "rgba(139,92,246,0.08)",
  textMain: "#1a1a2e",
  textSub: "#6b6b7e",
  textMuted: "#8b8b9e",
  textHint: "#bcbccc",
  border: "#ece9f1",
  bg: "#ffffff",
  pageBg: "#faf9fc",
  warm: "#fff7ed",
};

// ─── Mock data ────────────────────────────────────────────────────────────────
const MOCK_TASKS = [
  { id: "t1", title: "Read Chapter 3",                   done: true,  priority: "high",   eta: "20 min" },
  { id: "t2", title: "Complete practice problems 1–10",  done: true,  priority: "high",   eta: "30 min" },
  { id: "t3", title: "Watch supplementary video",        done: false, priority: "medium", eta: "15 min" },
  { id: "t4", title: "Write summary notes",              done: false, priority: "medium", eta: "25 min" },
  { id: "t5", title: "Attempt challenge question",       done: false, priority: "low",    eta: "10 min" },
];

const PRIO_META: Record<string, { color: string; bg: string }> = {
  high:   { color: "#ef4444", bg: "rgba(239,68,68,0.09)" },
  medium: { color: "#f97316", bg: "rgba(249,115,22,0.09)" },
  low:    { color: "#059669", bg: "rgba(5,150,105,0.09)" },
};

// ─── Component ────────────────────────────────────────────────────────────────
export default function SelfWork({ nodeName, subcategoryLabel, hierarchyData }: YouDoProps) {
  const [tasks, setTasks] = useState(MOCK_TASKS);

  const toggleTask = (id: string) =>
    setTasks(prev => prev.map(t => t.id === id ? { ...t, done: !t.done } : t));

  const done = tasks.filter(t => t.done).length;
  const pct  = Math.round((done / tasks.length) * 100);

  const stats = [
    { label: "Total Tasks",  value: tasks.length, color: T.orange, icon: <CheckSquare size={15} /> },
    { label: "Completed",    value: done,          color: "#059669", icon: <CheckCircle2 size={15} /> },
    { label: "Remaining",    value: tasks.length - done, color: T.purple, icon: <Circle size={15} /> },
    { label: "Est. Time",    value: `${tasks.filter(t => !t.done).reduce((a, t) => a + parseInt(t.eta), 0)} min`, color: "#f59e0b", icon: <Clock size={15} /> },
  ];

  return (
    <div
      className="flex flex-col h-full overflow-hidden"
      style={{ fontFamily: "'Poppins',-apple-system,sans-serif", background: T.bg }}
    >
      {/* ── Header ── */}
      <div
        className="flex-shrink-0 px-6 py-4"
        style={{ background: T.bg, borderBottom: `1px solid ${T.border}`, borderLeft: `3px solid ${T.orange}` }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: T.orangeLight, border: `1px solid ${T.orange}25` }}
          >
            <User size={18} style={{ color: T.orange }} />
          </div>
          <div className="min-w-0">
            <h2 className="text-[15px] font-extrabold tracking-tight" style={{ color: T.textMain }}>
              {subcategoryLabel}
            </h2>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-[10px] font-semibold" style={{ color: T.textHint }}>
                {hierarchyData.courseName}
              </span>
              {nodeName && (
                <>
                  <ChevronRight size={8} style={{ color: T.textHint }} />
                  <span className="text-[10px] font-semibold" style={{ color: T.orange }}>{nodeName}</span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Body ── */}
      <div
        className="flex-1 min-h-0 overflow-y-auto p-6"
        style={{ scrollbarWidth: "thin", scrollbarColor: `${T.border} transparent` }}
      >
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {stats.map((s, i) => (
            <div
              key={i}
              className="p-4 rounded-2xl"
              style={{ background: T.bg, border: `1px solid ${T.border}`, transition: "all 0.18s" }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = `0 4px 16px ${s.color}18`; (e.currentTarget as HTMLElement).style.borderColor = `${s.color}30`; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = "none"; (e.currentTarget as HTMLElement).style.borderColor = T.border; }}
            >
              <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-2" style={{ background: `${s.color}12`, color: s.color }}>
                {s.icon}
              </div>
              <div className="text-[18px] font-extrabold" style={{ color: T.textMain }}>{s.value}</div>
              <div className="text-[10.5px] font-medium mt-0.5" style={{ color: T.textMuted }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Progress bar */}
        <div
          className="rounded-2xl p-5 mb-6"
          style={{ background: T.bg, border: `1px solid ${T.border}` }}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Flame size={16} style={{ color: T.orange }} />
              <span className="text-[12px] font-extrabold" style={{ color: T.textMain }}>Overall Progress</span>
            </div>
            <span className="text-[13px] font-extrabold" style={{ color: pct === 100 ? "#059669" : T.orange }}>
              {pct}%
            </span>
          </div>
          <div className="w-full h-2.5 rounded-full overflow-hidden" style={{ background: T.pageBg }}>
            <div
              className="h-full rounded-full"
              style={{
                width: `${pct}%`,
                background: pct === 100
                  ? "linear-gradient(90deg,#059669,#10b981)"
                  : `linear-gradient(90deg,${T.orange},${T.orangeDark})`,
                boxShadow: `0 0 8px ${T.orangeGlow}`,
                transition: "width 0.5s cubic-bezier(0.34,1.3,0.64,1)",
              }}
            />
          </div>
          <div className="flex items-center justify-between mt-2">
            <span className="text-[10px] font-medium" style={{ color: T.textHint }}>
              {done} of {tasks.length} tasks completed
            </span>
            {pct === 100 && (
              <span
                className="flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full"
                style={{ background: "rgba(5,150,105,0.09)", color: "#059669" }}
              >
                <Target size={9} />
                All done!
              </span>
            )}
          </div>
        </div>

        {/* Task checklist */}
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-[12px] font-extrabold uppercase tracking-widest" style={{ color: T.textMuted }}>
            Task Checklist
          </h3>
          <button
            className="flex items-center gap-1 text-[10.5px] font-bold px-2.5 py-1 rounded-lg"
            style={{ color: T.orange, background: T.orangeLight, border: `1px solid ${T.orange}25` }}
            onClick={() => alert("Add task (not yet implemented)")}
          >
            <Plus size={10} />
            Add Task
          </button>
        </div>

        <div className="flex flex-col gap-2">
          {tasks.map(task => {
            const pm = PRIO_META[task.priority] ?? PRIO_META.medium;
            return (
              <div
                key={task.id}
                className="flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer"
                style={{
                  background: T.bg,
                  border: `1.5px solid ${task.done ? "rgba(5,150,105,0.20)" : T.border}`,
                  opacity: task.done ? 0.72 : 1,
                  transition: "all 0.18s",
                }}
                onClick={() => toggleTask(task.id)}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = T.warm}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = T.bg}
              >
                {/* Checkbox */}
                <div
                  className="flex-shrink-0 w-5 h-5 rounded-md flex items-center justify-center"
                  style={{
                    background: task.done ? "#059669" : "transparent",
                    border: `2px solid ${task.done ? "#059669" : T.border}`,
                    transition: "all 0.15s",
                  }}
                >
                  {task.done && (
                    <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                      <path d="M1 4L4 7L9 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>

                {/* Label */}
                <span
                  className="flex-1 text-[12px] font-semibold"
                  style={{
                    color: task.done ? T.textHint : T.textMain,
                    textDecoration: task.done ? "line-through" : "none",
                    transition: "all 0.15s",
                  }}
                >
                  {task.title}
                </span>

                {/* Priority badge */}
                <span
                  className="flex-shrink-0 text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest"
                  style={{ background: pm.bg, color: pm.color }}
                >
                  {task.priority}
                </span>

                {/* ETA */}
                <span
                  className="flex-shrink-0 flex items-center gap-1 text-[10px] font-medium"
                  style={{ color: T.textHint }}
                >
                  <Clock size={9} />
                  {task.eta}
                </span>
              </div>
            );
          })}
        </div>

        {/* Study materials hint */}
        <div
          className="mt-6 rounded-2xl p-5 flex items-center gap-4"
          style={{
            background: T.purpleLight,
            border: `1px solid rgba(139,92,246,0.18)`,
          }}
        >
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: "rgba(139,92,246,0.12)", color: T.purple }}
          >
            <BookOpen size={18} />
          </div>
          <div>
            <p className="text-[12px] font-bold" style={{ color: T.textMain }}>Study Materials</p>
            <p className="text-[11px] font-medium mt-0.5" style={{ color: T.textMuted }}>
              Refer to the <strong>I Do</strong> tab for uploaded resources to support this self-work session.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
