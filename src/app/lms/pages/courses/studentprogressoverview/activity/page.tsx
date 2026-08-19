"use client";
import { getToken } from "@/lib/session";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

const API_BASE = "https://lmsserver-yeve.onrender.com";

/* ─── Google Font ───────────────────────────────────────────────── */
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

const F = "'Poppins', sans-serif";
const T = (extra: React.CSSProperties = {}): React.CSSProperties => ({ fontFamily: F, ...extra });

const barColor = (v: number) => (v >= 85 ? "#4CAF50" : v >= 70 ? "#3B82F6" : v >= 50 ? "#FFA726" : "#EF5350");

const TYPE_META: Record<string, { title: string; sub: string; accent: string; accentBg: string }> = {
  I_Do:  { title: "I Do Activity",  sub: "Documents & MCQ performance", accent: "#16A34A", accentBg: "#DCFCE7" },
  We_Do: { title: "We Do Activity", sub: "Assignments & scores",        accent: "#2563EB", accentBg: "#DBEAFE" },
  You_Do:{ title: "You Do Activity",sub: "Assessments & scores",        accent: "#EA580C", accentBg: "#FFEDD5" },
};

/* ─── Primitives ────────────────────────────────────────────────── */
const Bar = ({ v }: { v: number }) => (
  <div style={{ height: 7, borderRadius: 99, background: "#EEECF8", marginTop: 5, overflow: "hidden", width: 110 }}>
    <div style={{ height: "100%", width: `${v}%`, borderRadius: 99, background: barColor(v), transition: "width .4s ease" }} />
  </div>
);

const StatCard = ({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) => (
  <div style={{
    flex: "1 1 0", minWidth: 0, background: "#fff", borderRadius: 14, border: "1px solid #EDE9F8",
    padding: "16px 20px", boxShadow: "0 1px 4px rgba(100,80,180,.04)",
  }}>
    <p style={T({ margin: 0, fontSize: 12, fontWeight: 500, color: "#9CA3AF" })}>{label}</p>
    <p style={T({ margin: "3px 0 1px", fontSize: 26, fontWeight: 700, color, lineHeight: 1.15 })}>{value}</p>
    <p style={T({ margin: 0, fontSize: 11, fontWeight: 400, color: "#C4BEDD" })}>{sub}</p>
  </div>
);

const IcoBack = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
  </svg>
);

const StatusPill = ({ attempted, pct }: { attempted: boolean; pct: number }) => {
  const theme = !attempted
    ? { bg: "#F4F4F6", color: "#9CA3AF", border: "#E5E7EB", label: "Not Attempted" }
    : pct >= 85 ? { bg: "#F0FBF1", color: "#27AE60", border: "#B7EFC5", label: "Excellent" }
    : pct >= 70 ? { bg: "#EEF6FF", color: "#2563EB", border: "#BFDBFE", label: "Good" }
    : pct >= 50 ? { bg: "#FFFBEB", color: "#D97706", border: "#FDE68A", label: "Fair" }
    :             { bg: "#FFF1F1", color: "#DC2626", border: "#FECACA", label: "Needs Attention" };
  return (
    <span style={T({
      display: "inline-block", background: theme.bg, color: theme.color,
      border: `1px solid ${theme.border}`, borderRadius: 20, padding: "3px 11px", fontSize: 11, fontWeight: 600,
    })}>{theme.label}</span>
  );
};

/* ─── Content ───────────────────────────────────────────────────── */
function ActivityContent() {
  usePoppins();
  const router = useRouter();
  const sp = useSearchParams();

  const courseId    = sp.get("courseId") || "";
  const studentId   = sp.get("studentId") || "";
  const studentName = sp.get("studentName") || "Student";
  const type        = sp.get("type") || "I_Do";

  const meta = TYPE_META[type] || TYPE_META.I_Do;

  const [data, setData]       = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    if (!courseId || !studentId) { setError("Missing course or student."); setLoading(false); return; }
    const token = getToken() || localStorage.getItem("token") || "";
    fetch(`${API_BASE}/analytics/staff/analytics/student-activity/${courseId}/${studentId}`, {
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    })
      .then(async (r) => {
        if (!r.ok) throw new Error(`Server error ${r.status}`);
        const json = await r.json();
        setData(json?.data || null);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [courseId, studentId]);

  const section = data?.[type] || {};
  const rows: any[] = useMemo(() => {
    if (type === "I_Do")  return section.documents || [];
    if (type === "We_Do") return section.assignments || [];
    return section.assessments || [];
  }, [section, type]);

  const summary = section.summary || {};

  /* ── Loading / error ── */
  if (loading) return (
    <div style={T({ background: "#F7F6FB", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" })}>
      <div style={{ textAlign: "center" }}>
        <div style={{ width: 40, height: 40, border: "3px solid #EDE9F8", borderTop: "3px solid #7C3AED", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 12px" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <p style={T({ color: "#9CA3AF", fontSize: 13 })}>Loading activity…</p>
      </div>
    </div>
  );
  if (error) return (
    <div style={T({ background: "#F7F6FB", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 14 })}>
      <p style={T({ color: "#DC2626", fontWeight: 600, fontSize: 14 })}>{error}</p>
      <button onClick={() => router.back()} style={T({ display: "flex", alignItems: "center", gap: 7, background: "#fff", border: "1.5px solid #DDD6FE", borderRadius: 9, padding: "9px 16px", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#7C3AED" })}>
        <IcoBack /> Go Back
      </button>
    </div>
  );

  const isIDo = type === "I_Do";

  return (
    <div style={T({ background: "#F7F6FB", minHeight: "100vh", padding: "26px 30px" })}>

      {/* ── Back button ── */}
      <button
        onClick={() => router.back()}
        style={T({ display: "inline-flex", alignItems: "center", gap: 7, background: "#fff", border: "1.5px solid #DDD6FE", borderRadius: 9, padding: "8px 14px", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#7C3AED", boxShadow: "0 1px 3px rgba(100,80,180,.08)", marginBottom: 18 })}
      >
        <IcoBack /> Back to Overview
      </button>

      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
        <div style={{ width: 48, height: 48, borderRadius: 12, background: meta.accentBg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <div style={{ width: 14, height: 14, borderRadius: "50%", background: meta.accent }} />
        </div>
        <div>
          <h1 style={T({ margin: 0, fontSize: 20, fontWeight: 700, color: "#111827" })}>{meta.title}</h1>
          <p style={T({ margin: "3px 0 0", fontSize: 12, fontWeight: 400, color: "#9CA3AF" })}>
            <strong style={{ color: "#6B7280" }}>{studentName}</strong> · {data?.course?.courseName || "Course"} · {meta.sub}
          </p>
        </div>
      </div>

      {/* ── Summary cards ── */}
      <div style={{ display: "flex", gap: 12, marginBottom: 22 }}>
        <StatCard label={isIDo ? "Total Documents" : "Total Items"} value={String(summary.total ?? rows.length)} sub={isIDo ? "With MCQs" : "Configured"} color="#111827" />
        <StatCard label="Attempted" value={String(summary.attempted ?? 0)} sub={`of ${summary.total ?? rows.length}`} color={meta.accent} />
        <StatCard label={isIDo ? "Avg Completion" : "Avg Score"} value={`${isIDo ? (summary.avgCompletion ?? 0) : (summary.avgPercentage ?? 0)}%`} sub="Across all items" color="#7C3AED" />
      </div>

      {/* ── Table ── */}
      <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #EDE9F8", boxShadow: "0 2px 10px rgba(100,80,180,.05)", overflow: "hidden" }}>
        {/* header */}
        <div style={{
          display: "grid",
          gridTemplateColumns: isIDo ? "44px 2.2fr 1.3fr 1.2fr 1.3fr 1.1fr" : "44px 2.2fr 1.3fr 1.2fr 1.4fr 1.1fr",
          padding: "12px 20px", background: "#FAFAFA", borderBottom: "1px solid #F3F0FB", gap: 8, alignItems: "center",
        }}>
          {(isIDo
            ? ["#", "Document", "Location", "MCQ Correct", "Completion", "Status"]
            : ["#", type === "We_Do" ? "Assignment" : "Assessment", "Location", "Marks", "Score", "Status"]
          ).map((h) => (
            <span key={h} style={T({ fontSize: 12, fontWeight: 600, color: "#374151" })}>{h}</span>
          ))}
        </div>

        {/* empty */}
        {rows.length === 0 && (
          <div style={T({ textAlign: "center", padding: "48px 20px", color: "#9CA3AF", fontSize: 13 })}>
            {isIDo ? "No documents with MCQs in this course." : `No ${type === "We_Do" ? "assignments" : "assessments"} configured in this course.`}
          </div>
        )}

        {/* rows */}
        {rows.map((row, i) => {
          const pct = isIDo ? (row.completionPercentage || 0) : (row.percentage || 0);
          const attempted = isIDo ? (row.attemptedMcq > 0 || row.completionPercentage > 0) : row.attempted;
          return (
            <div
              key={row.fileId || row.exerciseId || i}
              style={{
                display: "grid",
                gridTemplateColumns: isIDo ? "44px 2.2fr 1.3fr 1.2fr 1.3fr 1.1fr" : "44px 2.2fr 1.3fr 1.2fr 1.4fr 1.1fr",
                padding: "13px 20px", borderBottom: i < rows.length - 1 ? "1px solid #F7F5FC" : "none",
                alignItems: "center", gap: 8,
              }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = "#FDFCFF")}
              onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = "transparent")}
            >
              <span style={T({ fontSize: 13, color: "#9CA3AF", fontWeight: 500 })}>{i + 1}</span>

              {/* name */}
              <div style={{ minWidth: 0 }}>
                <p style={T({ margin: 0, fontSize: 13, fontWeight: 600, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" })}>
                  {isIDo ? row.fileName : row.exerciseName}
                </p>
                <p style={T({ margin: 0, fontSize: 11, fontWeight: 400, color: "#9CA3AF" })}>{row.subcategory}</p>
              </div>

              {/* location */}
              <span style={T({ fontSize: 12, fontWeight: 400, color: "#6B7280", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" })}>
                {row.location || "—"}
              </span>

              {/* marks / mcq correct */}
              <span style={T({ fontSize: 13, fontWeight: 600, color: "#374151" })}>
                {isIDo
                  ? `${row.correctMcq} / ${row.totalMcq}`
                  : `${row.scoredMarks} / ${row.totalMarks}`}
              </span>

              {/* completion / score bar */}
              <div>
                <span style={T({ fontSize: 13, fontWeight: 600, color: "#374151" })}>{pct}%</span>
                <Bar v={pct} />
              </div>

              {/* status */}
              <div><StatusPill attempted={attempted} pct={pct} /></div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const Spinner = () => (
  <div style={{ minHeight: "100vh", background: "#F7F6FB", display: "flex", alignItems: "center", justifyContent: "center" }}>
    <div style={{ width: 40, height: 40, border: "3px solid #EDE9F8", borderTop: "3px solid #7C3AED", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
  </div>
);

export default function StudentActivityPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <ActivityContent />
    </Suspense>
  );
}
