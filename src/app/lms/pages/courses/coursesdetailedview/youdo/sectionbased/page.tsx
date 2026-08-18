"use client";
import { getToken } from "@/lib/session";

// ════════════════════════════════════════════════════════════════════════════
// You-Do · Section-Based test route
// ----------------------------------------------------------------------------
// Landing route for section-based (Part A / Part B …) assessments started from
// the You-Do instructions page. Reads the exercise from localStorage (written
// by the instructions page) with a fresh fetch-by-id fallback, then renders the
// full-screen SectionBasedTestPage. Being a real route, a reload keeps the test.
// ════════════════════════════════════════════════════════════════════════════

import React, { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import SectionBasedTestPage from "@/app/lms/component/student/YouDo/assessment/components/SectionBasedTestPage";

const API_BASE = "http://localhost:5533";

const Spinner = () => (
  <div className="w-full h-screen bg-white flex items-center justify-center">
    <Loader2 className="w-12 h-12 text-gray-900 animate-spin" />
  </div>
);

const SectionBasedContent = () => {
  const router = useRouter();
  const searchParams = useSearchParams();

  const exerciseId = searchParams.get("exerciseId") || "";
  const courseId = searchParams.get("courseId") || "";
  const subcategory = searchParams.get("subcategory") || "Assessment";
  const category = searchParams.get("category") || "You_Do";
  const nodeId = searchParams.get("nodeId") || "";
  const securityAck = searchParams.get("securityAck") === "1";

  const [exercise, setExercise] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // 1) localStorage first (stashed by the instructions page → instant render).
  useEffect(() => {
    try {
      const raw = localStorage.getItem("currentSectionBasedExercise");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && (!exerciseId || String(parsed._id) === exerciseId)) setExercise(parsed);
      }
    } catch { /* ignore */ }
  }, [exerciseId]);

  // 2) Fetch the full, fresh exercise so sectionConfigs / questions are complete.
  useEffect(() => {
    if (!exerciseId) { setLoading(false); return; }
    let cancelled = false;
    (async () => {
      try {
        const token = getToken() || localStorage.getItem("token") || "";
        const res = await fetch(`${API_BASE}/exercise/${exerciseId}`, {
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        });
        if (res.ok) {
          const data = await res.json();
          const full = data?.data?.exercise || data?.data || data?.exercise || data;
          if (!cancelled && full?._id) setExercise((prev: any) => ({ ...(prev || {}), ...full }));
        }
      } catch { /* keep localStorage copy */ }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [exerciseId]);

  const handleClose = () => {
    try { window.close(); } catch { /* not script-opened */ }
    router.back();
  };

  if (loading && !exercise) return <Spinner />;
  if (!exercise) {
    return (
      <div className="w-full h-screen bg-white flex items-center justify-center text-gray-500">
        Assessment not found.
      </div>
    );
  }

  return (
    <SectionBasedTestPage
      exercise={exercise}
      courseId={courseId}
      nodeId={nodeId}
      category={category}
      subcategory={subcategory}
      skipSecurityModal={securityAck}
      onClose={handleClose}
      onSubmit={() => {
        try { sessionStorage.setItem("lms_submit_toast", "Assessment submitted successfully!"); } catch { /* ignore */ }
        handleClose();
      }}
    />
  );
};

export default function YouDoSectionBasedPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <SectionBasedContent />
    </Suspense>
  );
}
