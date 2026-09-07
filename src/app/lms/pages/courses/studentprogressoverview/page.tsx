"use client";
import { getToken } from "@/lib/session";
import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";

const API_BASE = "https://lmsserver-yeve.onrender.com";

/* ─── Google Font injection ─────────────────────────────────────── */
const FONT_URL =
  "https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap";

function usePoppins() {
  useEffect(() => {
    if (document.querySelector(`link[href="${FONT_URL}"]`)) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = FONT_URL;
    document.head.appendChild(link);
  }, []);
}

/* ─── API fetch ─────────────────────────────────────────────────── */
function useAnalytics() {
  const [data, setData]       = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    const token = getToken() || localStorage.getItem("token") || "";
    fetch(`${API_BASE}/analytics/staff/analytics/students`, {
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    })
      .then(async (r) => {
        if (!r.ok) throw new Error(`Server error ${r.status}`);
        const json = await r.json();
        setData(json?.data || null);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return { data, loading, error };
}

/* ─── Helpers: compute single % from a pedagogy section ─────────── */
function sectionAvg(section: Record<string, any> | undefined): number {
  if (!section || typeof section !== "object") return 0;
  const categories = Object.values(section);
  if (categories.length === 0) return 0;
  const sum = categories.reduce((acc: number, cat: any) => acc + (cat?.percentage ?? 0), 0);
  return Math.round(sum / categories.length);
}

function buildStudent(raw: any, idx: number) {
  const student = raw.student || {};
  const progress = raw.progress || {};
  const iDo    = sectionAvg(progress.I_Do);
  const weDo   = sectionAvg(progress.We_Do);
  const youDo  = sectionAvg(progress.You_Do);
  const overall = progress.overall ?? Math.round((iDo + weDo + youDo) / 3);
  const name = `${student.firstName || ""} ${student.lastName || ""}`.trim() || "Unknown";
  const studentId = (student._id || "").toString();
  return { id: idx + 1, studentId, name, email: student.email || "", iDo, weDo, youDo, overall };
}

function statusOf(v: number) {
  if (v >= 85) return { status: "Excellent",       msg: "Outstanding!" };
  if (v >= 70) return { status: "Good",             msg: "Well Done!" };
  if (v >= 50) return { status: "Fair",             msg: "Can Improve" };
  return            { status: "Needs Attention",    msg: "Focus Required" };
}

/* ─── Colour helpers ─────────────────────────────────────────────── */
const barColor = (v: number) => v >= 85 ? "#4CAF50" : v >= 70 ? "#3B82F6" : v >= 50 ? "#FFA726" : "#EF5350";
const dotColor = (v: number) => v >= 85 ? "#4CAF50" : v >= 70 ? "#3B82F6" : v >= 50 ? "#FFA726" : "#EF5350";

const statusTheme: Record<string, { bg: string; color: string; border: string }> = {
  "Excellent":       { bg: "#F0FBF1", color: "#27AE60", border: "#B7EFC5" },
  "Good":            { bg: "#EEF6FF", color: "#2563EB", border: "#BFDBFE" },
  "Fair":            { bg: "#FFFBEB", color: "#D97706", border: "#FDE68A" },
  "Needs Attention": { bg: "#FFF1F1", color: "#DC2626", border: "#FECACA" },
};

const GUIDE = [
  { dot: "#EF5350", label: "Needs Attention", range: "0 – 49%" },
  { dot: "#FFA726", label: "Fair",            range: "50 – 69%" },
  { dot: "#42A5F5", label: "Good",            range: "70 – 84%" },
  { dot: "#66BB6A", label: "Excellent",       range: "85 – 100%" },
];

const AVATAR_BG = ["#EDE0FF","#FFE0E0","#DFF3FF","#DDFFF0","#FFF6DC","#FFE0F5","#DCF0FF"];
const AVATAR_FG = ["#7C3AED","#DC2626","#0369A1","#065F46","#92400E","#BE185D","#1D4ED8"];

const F = "'Poppins', sans-serif";
const T = (extra: React.CSSProperties = {}): React.CSSProperties => ({ fontFamily: F, ...extra });

/* ─── Small primitives ───────────────────────────────────────────── */
const Avatar = ({ name, i }: { name: string; i: number }) => {
  const initials = name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  return (
    <div style={{
      width: 38, height: 38, borderRadius: "50%", flexShrink: 0,
      background: AVATAR_BG[i % AVATAR_BG.length],
      color: AVATAR_FG[i % AVATAR_FG.length],
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: F, fontWeight: 700, fontSize: 13, letterSpacing: 0.5,
    }}>{initials}</div>
  );
};

const Bar = ({ v }: { v: number }) => (
  <div style={{ height: 7, borderRadius: 99, background: "#EEECF8", marginTop: 5, overflow: "hidden" }}>
    <div style={{ height: "100%", width: `${v}%`, borderRadius: 99, background: barColor(v), transition: "width .4s ease" }} />
  </div>
);

/* ─── Icons ──────────────────────────────────────────────────────── */
const IcoUsers = ({ c = "#7C3AED", s = 20 }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>
  </svg>
);
const IcoBook = ({ c = "#16A34A", s = 20 }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/>
  </svg>
);
const IcoGroup = ({ c = "#2563EB", s = 20 }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>
  </svg>
);
const IcoPerson = ({ c = "#EA580C", s = 20 }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>
  </svg>
);
const IcoPie = ({ c = "#7C3AED", s = 20 }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21.21 15.89A10 10 0 118 2.83"/><path d="M22 12A10 10 0 0012 2v10z"/>
  </svg>
);
const IcoDownload = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
  </svg>
);
const IcoSearch = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#AAAAAA" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </svg>
);
const IcoFilter = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
  </svg>
);
const IcoChevDown = ({ c = "#9CA3AF" }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9"/>
  </svg>
);
const IcoChevLeft = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 18 9 12 15 6"/>
  </svg>
);
const IcoChevRight = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6"/>
  </svg>
);
const IcoDots = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="5" r="1" fill="#9CA3AF"/><circle cx="12" cy="12" r="1" fill="#9CA3AF"/><circle cx="12" cy="19" r="1" fill="#9CA3AF"/>
  </svg>
);
const IcoGradCap = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/>
  </svg>
);
const IcoInfo = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
  </svg>
);
const IcoHelp = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
);

/* ─── Stat Card ───────────────────────────────────────────────────── */
const StatCard = ({ iconBg, icon, title, value, valueColor, sub }: {
  iconBg: string; icon: React.ReactNode; title: string; value: string; valueColor: string; sub: string;
}) => (
  <div style={{
    flex: "1 1 0", minWidth: 0,
    background: "#fff", borderRadius: 14,
    border: "1px solid #EDE9F8",
    padding: "18px 20px",
    display: "flex", alignItems: "center", gap: 14,
    boxShadow: "0 1px 4px rgba(100,80,180,.04)",
  }}>
    <div style={{
      width: 46, height: 46, borderRadius: "50%", flexShrink: 0,
      background: iconBg,
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>{icon}</div>
    <div>
      <p style={T({ margin: 0, fontSize: 12, fontWeight: 500, color: "#9CA3AF" })}>{title}</p>
      <p style={T({ margin: "2px 0 1px", fontSize: 26, fontWeight: 700, color: valueColor, lineHeight: 1.15 })}>{value}</p>
      <p style={T({ margin: 0, fontSize: 11, fontWeight: 400, color: "#C4BEDD" })}>{sub}</p>
    </div>
  </div>
);

const PER_PAGE = 10;

/* ─── Main component ──────────────────────────────────────────────── */
export default function StudentProgressOverview() {
  usePoppins();
  const router = useRouter();

  const { data, loading, error } = useAnalytics();

  const [selectedCourseId, setSelectedCourseId] = useState<string>(
    () => (typeof window !== "undefined" ? sessionStorage.getItem("spo_courseId") || "" : "")
  );
  const [courseDropOpen,   setCourseDropOpen]   = useState(false);
  const [search,           setSearch]           = useState("");
  const [page,             setPage]             = useState(1);
  const [activeTab,        setActiveTab]        = useState<"All" | "I_Do" | "We_Do" | "You_Do">("All");
  const [menu,             setMenu]             = useState<{ id: number; x: number; y: number } | null>(null);

  const openActivity = (type: string, studentId: string, studentName: string) => {
    setMenu(null);
    if (!studentId) return;
    const params = new URLSearchParams({
      courseId: selectedCourseId,
      studentId,
      studentName,
      type,
    });
    router.push(`/lms/pages/courses/studentprogressoverview/activity?${params.toString()}`);
  };

  /* Build course list from analytics data */
  const courses: Array<{ id: string; name: string }> = useMemo(() => {
    if (!data?.courses) return [];
    return data.courses.map((c: any) => ({
      id:   c.course._id.toString(),
      name: c.course.courseName || "Unnamed Course",
    }));
  }, [data]);

  /* Auto-select first course (only if nothing saved in session) */
  useEffect(() => {
    if (courses.length === 0) return;
    const saved = sessionStorage.getItem("spo_courseId");
    if (saved && courses.some((c) => c.id === saved)) {
      setSelectedCourseId(saved);
    } else if (!selectedCourseId) {
      setSelectedCourseId(courses[0].id);
      sessionStorage.setItem("spo_courseId", courses[0].id);
    }
  }, [courses]);

  /* Build student rows for selected course */
  const students = useMemo(() => {
    if (!data?.courses || !selectedCourseId) return [];
    const courseEntry = data.courses.find((c: any) => c.course._id.toString() === selectedCourseId);
    if (!courseEntry) return [];
    return (courseEntry.students || []).map((raw: any, i: number) => {
      const base = buildStudent(raw, i);
      const { status, msg } = statusOf(base.overall);
      return { ...base, status, msg };
    });
  }, [data, selectedCourseId]);

  const selectedCourseName = useMemo(() =>
    courses.find((c) => c.id === selectedCourseId)?.name || "Select Course",
    [courses, selectedCourseId]
  );

  /* Search + sort by overall (default) */
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    const rows = students.filter(
      (s) => s.name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q)
    );
    return [...rows].sort((a, b) => b.overall - a.overall);
  }, [students, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const pageRows   = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const avg = (key: "iDo" | "weDo" | "youDo" | "overall") =>
    students.length === 0 ? 0 : Math.round(students.reduce((a, s) => a + s[key], 0) / students.length);

  /* Reset page when filters change */
  useEffect(() => { setPage(1); }, [search, selectedCourseId, activeTab]);

  /* ── Loading / Error states ── */
  if (loading) return (
    <div style={T({ background: "#F7F6FB", minHeight: "calc(100vh * var(--ui-scale-inv, 1))", display: "flex", alignItems: "center", justifyContent: "center" })}>
      <div style={T({ textAlign: "center" })}>
        <div style={{ width: 40, height: 40, border: "3px solid #EDE9F8", borderTop: "3px solid #7C3AED", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 12px" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <p style={T({ color: "#9CA3AF", fontSize: 13 })}>Loading student analytics…</p>
      </div>
    </div>
  );

  if (error) return (
    <div style={T({ background: "#F7F6FB", minHeight: "calc(100vh * var(--ui-scale-inv, 1))", display: "flex", alignItems: "center", justifyContent: "center" })}>
      <div style={{ background: "#fff", border: "1px solid #FECACA", borderRadius: 14, padding: "24px 32px", textAlign: "center" }}>
        <p style={T({ color: "#DC2626", fontWeight: 600, fontSize: 14 })}>Failed to load analytics</p>
        <p style={T({ color: "#9CA3AF", fontSize: 12, marginTop: 4 })}>{error}</p>
      </div>
    </div>
  );

  return (
    <div style={T({ background: "#F7F6FB", minHeight: "calc(100vh * var(--ui-scale-inv, 1))", padding: "28px 30px" })}>
      <style>{`
        html, body { scrollbar-color: #4B5563 #1F2937; scrollbar-width: thin; }
        html::-webkit-scrollbar, body::-webkit-scrollbar { width: 12px; height: 12px; }
        html::-webkit-scrollbar-track, body::-webkit-scrollbar-track { background: #1F2937; }
        html::-webkit-scrollbar-thumb, body::-webkit-scrollbar-thumb {
          background: #4B5563; border-radius: 8px; border: 2px solid #1F2937;
        }
        html::-webkit-scrollbar-thumb:hover, body::-webkit-scrollbar-thumb:hover { background: #6B7280; }
      `}</style>

      {/* ── TOP BAR ───────────────────────────────────────────────── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 22 }}>
        <div>
          <h1 style={T({ margin: 0, fontSize: 20, fontWeight: 700, color: "#111827", display: "flex", alignItems: "center", gap: 7 })}>
            Student Progress Overview
            <span style={{ cursor: "pointer", display: "flex", alignItems: "center" }}><IcoHelp /></span>
          </h1>
          <p style={T({ margin: "4px 0 0", fontSize: 12, fontWeight: 400, color: "#9CA3AF" })}>
            Track overall performance of students across I Do, We Do &amp; You Do
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {/* Course selector — moved into top bar (replaces Performance Guide) */}
          <div style={{ position: "relative" }}>
            <p style={T({ margin: "0 0 4px", fontSize: 10, fontWeight: 500, color: "#9CA3AF" })}>Select Course</p>
            <div
              onClick={() => setCourseDropOpen((o) => !o)}
              style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                background: "#fff", border: "2px solid #7C3AED", borderRadius: 9,
                padding: "8px 12px", minWidth: 240, cursor: "pointer",
                boxShadow: "0 1px 6px rgba(124,58,237,.10)",
                userSelect: "none",
              }}
            >
              <IcoGradCap />
              <span style={T({ fontSize: 13, fontWeight: 600, color: "#111827", flex: 1 })}>
                {selectedCourseName}
              </span>
              <IcoChevDown c="#7C3AED" />
            </div>

            {courseDropOpen && courses.length > 0 && (
              <div style={{
                position: "absolute", top: "100%", right: 0, zIndex: 100,
                background: "#fff", border: "1.5px solid #EDE9F8", borderRadius: 10,
                boxShadow: "0 8px 24px rgba(100,80,180,.12)", minWidth: 240,
                marginTop: 4, overflow: "hidden",
              }}>
                {courses.map((c) => (
                  <div
                    key={c.id}
                    onClick={() => { setSelectedCourseId(c.id); sessionStorage.setItem("spo_courseId", c.id); setCourseDropOpen(false); }}
                    style={T({
                      padding: "10px 14px", fontSize: 13, fontWeight: 500,
                      color: c.id === selectedCourseId ? "#7C3AED" : "#374151",
                      background: c.id === selectedCourseId ? "#F5F3FF" : "transparent",
                      cursor: "pointer",
                      borderBottom: "1px solid #F3F0FB",
                    })}
                    onMouseEnter={(e) => { if (c.id !== selectedCourseId) (e.currentTarget as HTMLElement).style.background = "#FAFAFA"; }}
                    onMouseLeave={(e) => { if (c.id !== selectedCourseId) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                  >
                    {c.name}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Export button */}
          <button style={T({
            display: "flex", alignItems: "center", gap: 7,
            background: "#fff", border: "1.5px solid #DDD6FE", borderRadius: 9,
            padding: "9px 16px", cursor: "pointer",
            fontSize: 13, fontWeight: 600, color: "#7C3AED",
            boxShadow: "0 1px 3px rgba(100,80,180,.08)",
            alignSelf: "flex-end",
          })}>
            <IcoDownload /> Export Report
          </button>
        </div>
      </div>

      {/* ── STAT CARDS ────────────────────────────────────────────── */}
      <div style={{ display: "flex", gap: 12, marginBottom: 22 }}>
        <StatCard iconBg="#EDE9FF" icon={<IcoUsers />}                       title="Total Students"     value={String(students.length)}   valueColor="#111827" sub="Enrolled in course" />
        <StatCard iconBg="#DCFCE7" icon={<IcoBook   c="#16A34A" s={20} />}   title="I Do Overall"       value={`${avg("iDo")}%`}          valueColor="#16A34A" sub="Average Score" />
        <StatCard iconBg="#DBEAFE" icon={<IcoGroup  c="#2563EB" s={20} />}   title="We Do Overall"      value={`${avg("weDo")}%`}         valueColor="#2563EB" sub="Average Score" />
        <StatCard iconBg="#FFEDD5" icon={<IcoPerson c="#EA580C" s={20} />}   title="You Do Overall"     value={`${avg("youDo")}%`}        valueColor="#EA580C" sub="Average Score" />
        <StatCard iconBg="#EDE9FF" icon={<IcoPie />}                         title="Overall Performance" value={`${avg("overall")}%`}     valueColor="#7C3AED" sub="Course Average" />
      </div>

      {/* ── TABLE CARD ────────────────────────────────────────────── */}
      <div style={{
        background: "#fff", borderRadius: 16,
        border: "1px solid #EDE9F8",
        boxShadow: "0 2px 10px rgba(100,80,180,.05)",
        overflow: "hidden",
      }}>

        {/* Pedagogy tabs */}
        <div style={{
          display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr",
          borderBottom: "1px solid #F3F0FB",
        }}>
          {([
            { key: "All",   label: "All",           sub: "(Overall Summary)",      color: "#7C3AED", bg: "#EDE9FF" },
            { key: "I_Do",  label: "I Do Overall",  sub: "(All Learning Content)", color: "#16A34A", bg: "#DCFCE7" },
            { key: "We_Do", label: "We Do Overall", sub: "(Assignments)",       color: "#2563EB", bg: "#DBEAFE" },
            { key: "You_Do",label: "You Do Overall",sub: "(Assessments)",          color: "#EA580C", bg: "#FFEDD5" },
          ] as const).map((t) => {
            const active = activeTab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                style={T({
                  background: active ? t.bg : "#fff",
                  border: "none",
                  borderBottom: active ? `3px solid ${t.color}` : "3px solid transparent",
                  padding: "14px 16px",
                  cursor: "pointer",
                  textAlign: "center",
                  transition: "background .15s",
                })}
                onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLElement).style.background = "#FAFAFA"; }}
                onMouseLeave={(e) => { if (!active) (e.currentTarget as HTMLElement).style.background = "#fff"; }}
              >
                <p style={T({ margin: 0, fontSize: 13, fontWeight: 700, color: active ? t.color : "#374151" })}>{t.label}</p>
                <p style={T({ margin: "2px 0 0", fontSize: 11, fontWeight: 400, color: active ? t.color : "#9CA3AF", opacity: active ? 0.85 : 1 })}>{t.sub}</p>
              </button>
            );
          })}
        </div>

        {/* Search bar */}
        <div style={{
          display: "flex", alignItems: "center",
          padding: "14px 20px", borderBottom: "1px solid #F3F0FB",
        }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            background: "#F9F8FD", border: "1.5px solid #EDE9F8", borderRadius: 9,
            padding: "8px 13px", flex: 1,
          }}>
            <IcoSearch />
            <input
              value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by student name or email..."
              style={T({ border: "none", background: "transparent", outline: "none", fontSize: 12, color: "#374151", width: "100%", fontWeight: 400 })}
            />
          </div>
        </div>

        {/* Table header */}
        {(() => {
          const isAll = activeTab === "All";
          const pedagogyMeta = {
            I_Do:  { h: "I Do Overall",   sub: "(All Learning Content)" },
            We_Do: { h: "We Do Overall",  sub: "(All Activities)" },
            You_Do:{ h: "You Do Overall", sub: "(Assessments)" },
          };
          const cols = isAll
            ? [
                { h: "#",                   sub: "",                                   info: false },
                { h: "Student",             sub: "",                                   info: false },
                { h: pedagogyMeta.I_Do.h,   sub: pedagogyMeta.I_Do.sub,                info: true  },
                { h: pedagogyMeta.We_Do.h,  sub: pedagogyMeta.We_Do.sub,               info: true  },
                { h: pedagogyMeta.You_Do.h, sub: pedagogyMeta.You_Do.sub,              info: true  },
                { h: "Overall Performance", sub: "",                                   info: false },
                { h: "Status",              sub: "",                                   info: false },
                { h: "Action",              sub: "",                                   info: false },
              ]
            : [
                { h: "#",                                              sub: "",                                                          info: false },
                { h: "Student",                                        sub: "",                                                          info: false },
                { h: pedagogyMeta[activeTab as "I_Do"|"We_Do"|"You_Do"].h, sub: pedagogyMeta[activeTab as "I_Do"|"We_Do"|"You_Do"].sub, info: true  },
                // "Overall Performance" intentionally omitted on single-
                // pedagogy tabs — the column duplicates information already
                // shown in the dedicated pedagogy column and made the
                // narrower view feel cluttered. Visible only on the "All"
                // tab where it summarises across all three pedagogies.
                { h: "Status",                                         sub: "",                                                          info: false },
                { h: "Action",                                         sub: "",                                                          info: false },
              ];
          return (
            <div style={{
              display: "grid",
              gridTemplateColumns: isAll
                ? "44px 1.9fr 1.15fr 1.15fr 1.15fr 1fr 1.1fr 52px"
                : "44px 1.9fr 1.6fr 1.1fr 110px",
              padding: "10px 20px", background: "#FAFAFA",
              borderBottom: "1px solid #F3F0FB", gap: 8, alignItems: "end",
            }}>
              {cols.map((col) => (
                <div key={col.h}>
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <span style={T({ fontSize: 12, fontWeight: 600, color: "#374151" })}>{col.h}</span>
                    {col.info && <span style={{ display: "flex", alignItems: "center", opacity: .7 }}><IcoInfo /></span>}
                  </div>
                  {col.sub && <p style={T({ margin: 0, fontSize: 10, fontWeight: 400, color: "#9CA3AF" })}>{col.sub}</p>}
                </div>
              ))}
            </div>
          );
        })()}

        {/* Empty state */}
        {pageRows.length === 0 && (
          <div style={T({ textAlign: "center", padding: "48px 20px", color: "#9CA3AF", fontSize: 13 })}>
            {students.length === 0 ? "No students enrolled in this course yet." : "No students match your search."}
          </div>
        )}

        {/* Rows */}
        {pageRows.map((s, i) => {
          const st = statusTheme[s.status] || statusTheme["Fair"];
          const globalIdx = (page - 1) * PER_PAGE + i;
          const isAll = activeTab === "All";
          const pedagogyVal = activeTab === "I_Do" ? s.iDo : activeTab === "We_Do" ? s.weDo : activeTab === "You_Do" ? s.youDo : 0;
          return (
            <div
              key={s.id}
              style={{
                display: "grid",
                gridTemplateColumns: isAll
                  ? "44px 1.9fr 1.15fr 1.15fr 1.15fr 1fr 1.1fr 52px"
                  : "44px 1.9fr 1.6fr 1.1fr 110px",
                padding: "13px 20px",
                borderBottom: i < pageRows.length - 1 ? "1px solid #F7F5FC" : "none",
                alignItems: "center", gap: 8,
                transition: "background .15s",
              }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = "#FDFCFF")}
              onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = "transparent")}
            >
              <span style={T({ fontSize: 13, color: "#9CA3AF", fontWeight: 500 })}>{globalIdx + 1}</span>

              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Avatar name={s.name} i={globalIdx} />
                <div>
                  <p style={T({ margin: 0, fontSize: 13, fontWeight: 600, color: "#111827" })}>{s.name}</p>
                  <p style={T({ margin: 0, fontSize: 11, fontWeight: 400, color: "#9CA3AF" })}>{s.email}</p>
                </div>
              </div>

              {isAll ? (
                <>
                  <div>
                    <span style={T({ fontSize: 13, fontWeight: 600, color: "#374151" })}>{s.iDo}%</span>
                    <Bar v={s.iDo} />
                  </div>
                  <div>
                    <span style={T({ fontSize: 13, fontWeight: 600, color: "#374151" })}>{s.weDo}%</span>
                    <Bar v={s.weDo} />
                  </div>
                  <div>
                    <span style={T({ fontSize: 13, fontWeight: 600, color: "#374151" })}>{s.youDo}%</span>
                    <Bar v={s.youDo} />
                  </div>
                </>
              ) : (
                <div>
                  <span style={T({ fontSize: 13, fontWeight: 600, color: "#374151" })}>{pedagogyVal}%</span>
                  <Bar v={pedagogyVal} />
                </div>
              )}

              {/* Overall Performance cell — only in the "All" tab. Header
                  drops the column on single-pedagogy tabs (see cols above),
                  so the row cell has to drop in lockstep or the grid shifts. */}
              {isAll && (
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={T({ fontSize: 14, fontWeight: 700, color: "#111827" })}>{s.overall}%</span>
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: dotColor(s.overall), flexShrink: 0 }} />
                </div>
              )}

              <div>
                <span style={T({
                  display: "inline-block",
                  background: st.bg, color: st.color,
                  border: `1px solid ${st.border}`,
                  borderRadius: 20, padding: "3px 11px",
                  fontSize: 11, fontWeight: 600,
                })}>{s.status}</span>
                <p style={T({ margin: "3px 0 0", fontSize: 11, fontWeight: 400, color: "#9CA3AF" })}>{s.msg}</p>
              </div>

              <div style={{ display: "flex", justifyContent: "center" }}>
                {isAll ? (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                      setMenu((m) => (m?.id === s.id ? null : { id: s.id, x: r.right, y: r.bottom }));
                    }}
                    style={{ background: menu?.id === s.id ? "#F3F0FB" : "none", border: "none", cursor: "pointer", padding: 4, borderRadius: 6, display: "flex", alignItems: "center" }}
                  >
                    <IcoDots />
                  </button>
                ) : (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      openActivity(activeTab, s.studentId, s.name);
                    }}
                    style={T({
                      background: "#fff",
                      border: "1.5px solid #DDD6FE",
                      borderRadius: 8,
                      padding: "6px 12px",
                      cursor: "pointer",
                      fontSize: 12,
                      fontWeight: 600,
                      color: "#7C3AED",
                      whiteSpace: "nowrap",
                    })}
                  >
                    View Details
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {/* Pagination footer */}
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "13px 20px", borderTop: "1px solid #F3F0FB", background: "#FAFAFA",
        }}>
          <span style={T({ fontSize: 12, fontWeight: 400, color: "#9CA3AF" })}>
            Showing {filtered.length === 0 ? 0 : (page - 1) * PER_PAGE + 1} to {Math.min(page * PER_PAGE, filtered.length)} of {filtered.length} student{filtered.length !== 1 ? "s" : ""}
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              style={{ width: 32, height: 32, borderRadius: 8, border: "1.5px solid #EDE9F8", background: "#fff", cursor: page === 1 ? "default" : "pointer", opacity: page === 1 ? 0.4 : 1, display: "flex", alignItems: "center", justifyContent: "center" }}
            ><IcoChevLeft /></button>

            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
              .reduce<(number | "…")[]>((acc, p, idx, arr) => {
                if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push("…");
                acc.push(p);
                return acc;
              }, [])
              .map((p, idx) =>
                p === "…" ? (
                  <span key={`dots-${idx}`} style={T({ fontSize: 13, color: "#9CA3AF", padding: "0 4px" })}>…</span>
                ) : (
                  <button
                    key={p} onClick={() => setPage(p as number)}
                    style={T({
                      width: 32, height: 32, borderRadius: 8, cursor: "pointer",
                      border: page === p ? "none" : "1.5px solid #EDE9F8",
                      background: page === p ? "#7C3AED" : "#fff",
                      color: page === p ? "#fff" : "#374151",
                      fontWeight: 600, fontSize: 13,
                      display: "flex", alignItems: "center", justifyContent: "center",
                    })}
                  >{p}</button>
                )
              )}

            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              style={{ width: 32, height: 32, borderRadius: 8, border: "1.5px solid #EDE9F8", background: "#fff", cursor: page === totalPages ? "default" : "pointer", opacity: page === totalPages ? 0.4 : 1, display: "flex", alignItems: "center", justifyContent: "center" }}
            ><IcoChevRight /></button>
          </div>
        </div>
      </div>

      {/* ── ACTION DROPDOWN (fixed, escapes table overflow) ──────────── */}
      {menu && (() => {
        const row = filtered.find((r) => r.id === menu.id);
        if (!row) return null;
        const items = [
          { label: "I Do Activity",  type: "I_Do",  dot: "#16A34A", sub: "Documents & MCQs" },
          { label: "We Do Activity", type: "We_Do", dot: "#2563EB", sub: "Assignments & scores" },
          { label: "You Do Activity",type: "You_Do",dot: "#EA580C", sub: "Assessments & scores" },
        ];
        return (
          <>
            <div onClick={() => setMenu(null)} style={{ position: "fixed", inset: 0, zIndex: 200 }} />
            <div style={{
              position: "fixed", top: menu.y + 6, left: Math.max(12, menu.x - 200), zIndex: 201,
              background: "#fff", border: "1px solid #EDE9F8", borderRadius: 12,
              boxShadow: "0 12px 30px rgba(100,80,180,.18)", minWidth: 200, overflow: "hidden", padding: "5px 0",
            }}>
              <p style={T({ margin: 0, padding: "7px 14px 6px", fontSize: 10, fontWeight: 600, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: 0.5 })}>
                {row.name.split(" ")[0]}'s Activity
              </p>
              {items.map((it) => (
                <div
                  key={it.type}
                  onClick={() => openActivity(it.type, row.studentId, row.name)}
                  style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 14px", cursor: "pointer" }}
                  onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = "#FAFAFA")}
                  onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = "transparent")}
                >
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: it.dot, flexShrink: 0 }} />
                  <div>
                    <p style={T({ margin: 0, fontSize: 13, fontWeight: 600, color: "#374151" })}>{it.label}</p>
                    <p style={T({ margin: 0, fontSize: 10, fontWeight: 400, color: "#9CA3AF" })}>{it.sub}</p>
                  </div>
                </div>
              ))}
            </div>
          </>
        );
      })()}
    </div>
  );
}
