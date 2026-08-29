"use client"
import { getToken } from "@/lib/session";

// Dedicated, reload-safe page wrapper for We Do / I Do multi-file programming.
//
// Mirrors how You Do programming works (youdo/programming/page.tsx + CodeEditor):
//   • Reads exerciseId / courseId / category / subcategory / etc. from the URL.
//   • Hydrates instantly from localStorage ("currentProgrammingExercise") set by
//     the launcher; falls back to fetching by exerciseId from the backend.
//   • Renders MultiFileCodeEditor with the right props.
//   • Back / Close / Breadcrumb navigations router.push back to the course view.
//
// The category is passed in as a prop (the wedo/ and ido/ route files are thin
// shells that fix it to "We_Do" or "I_Do").

import React, { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Loader2 } from "lucide-react"
import MultiFileCodeEditor from "@/app/lms/component/student/multi-file-code-editor"

// Same env-aware backend resolution as the editor uses for its API calls.
const API = (() => {
  const env = process.env.NEXT_PUBLIC_API_URL
  if (env) return env.replace(/\/+$/, "")
  if (typeof window !== "undefined" && /^(localhost|127\.|0\.0\.0\.0)/.test(window.location.hostname)) {
    return "http://localhost:5533"
  }
  return "https://lms-server-3-wedg.onrender.com"
})()

interface MultiFileProgrammingPageProps {
  fixedCategory: "We_Do" | "I_Do"
}

export default function MultiFileProgrammingPage({ fixedCategory }: MultiFileProgrammingPageProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [exerciseData, setExerciseData] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [courseId, setCourseId] = useState("")
  const [courseName, setCourseName] = useState("Course")
  const [hierarchy, setHierarchy] = useState<string[]>([])

  const subcategory = searchParams.get("subcategory") || ""
  // URL category wins (so a refresh stays authoritative), but the route file's
  // fixedCategory is the safe default for that route.
  const category = (searchParams.get("category") || fixedCategory) as "We_Do" | "I_Do"
  const exerciseName = searchParams.get("exerciseName") || ""
  const urlCourseId = searchParams.get("courseId") || ""
  const urlCourseName = searchParams.get("courseName") || ""
  const exerciseId = searchParams.get("exerciseId") || ""
  const nodeId = searchParams.get("nodeId") || ""
  const nodeName = searchParams.get("nodeName") || ""
  const nodeType = searchParams.get("nodeType") || ""
  const hierarchyParam = searchParams.get("hierarchy") || ""

  useEffect(() => {
    const load = async () => {
      setIsLoading(true)

      // 1) Fastest path — exercise blob stashed by the launcher (handleExerciseSelect).
      try {
        const stored = localStorage.getItem("currentProgrammingExercise")
        if (stored) {
          const parsed = JSON.parse(stored)
          // Only accept the cached blob if its _id matches this URL — otherwise a
          // stale entry from a different exercise would overwrite our context.
          if (!exerciseId || !parsed?._id || parsed._id === exerciseId) {
            setExerciseData(parsed)
            setCourseId(urlCourseId || parsed.courseId || parsed.context?.courseId || "")
            setCourseName(urlCourseName || parsed.courseName || "Course")
            if (hierarchyParam) setHierarchy(hierarchyParam.split(",").map((s: string) => s.trim()).filter(Boolean))
            else if (parsed.context?.hierarchy) setHierarchy(parsed.context.hierarchy)
            setIsLoading(false)
            return
          }
        }
      } catch { /* fall through to API */ }

      // 2) Reload-after-storage-cleared path — fetch by id from the URL.
      if (!exerciseId) { setIsLoading(false); return }
      try {
        const token = getToken() || localStorage.getItem("token") || ""
        const res = await fetch(`${API}/exercise/${exerciseId}`, {
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        })
        if (res.ok) {
          const data = await res.json()
          const ex = data.data?.exercise || data.data || data
          if (ex?._id) {
            setExerciseData(ex)
            setCourseId(urlCourseId || ex.courseId || "")
            setCourseName(urlCourseName || ex.courseName || "Course")
            if (hierarchyParam) setHierarchy(hierarchyParam.split(",").map((s: string) => s.trim()).filter(Boolean))
          }
        }
      } catch (err) {
        console.error("Failed to fetch programming exercise:", err)
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [exerciseId, urlCourseId, urlCourseName, hierarchyParam])

  const handleBack = () => {
    localStorage.removeItem("currentProgrammingExercise")
    if (!courseId) { router.back(); return }

    // The course detail page restores the sidebar selection + tab + subcategory
    // ONLY when these three query params are present (see the
    // ?restoreNodeId / method / activity branch in coursesdetailedview/[id]/page.tsx).
    // Without them, the page lands on Course Overview with nothing selected.
    const method = category === "We_Do" ? "we-do" : category === "I_Do" ? "i-do" : "you-do"
    const qs = new URLSearchParams()
    if (nodeId) qs.set("restoreNodeId", nodeId)
    qs.set("method", method)
    if (subcategory) qs.set("activity", subcategory)
    router.push(`/lms/pages/courses/coursesdetailedview/${courseId}?${qs.toString()}`)
  }

  if (isLoading) {
    return (
      <div className="w-full h-screen bg-white flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
      </div>
    )
  }

  if (!exerciseData) {
    return (
      <div className="w-full h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-500 mb-4">Failed to load exercise data.</p>
          <button onClick={handleBack} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Go Back</button>
        </div>
      </div>
    )
  }

  const exerciseInfo = exerciseData.exerciseInformation || {}

  return (
    <div className="w-full h-screen overflow-hidden">
      <MultiFileCodeEditor
        exercise={exerciseData}
        courseId={courseId}
        courseName={courseName}
        nodeId={nodeId || exerciseData.context?.nodeId || ""}
        nodeName={nodeName || exerciseInfo.exerciseName || exerciseName}
        nodeType={nodeType || exerciseData.context?.nodeType || ""}
        subcategory={subcategory}
        category={category}
        hierarchy={hierarchy}
        onBack={handleBack}
        onCloseExercise={handleBack}
        onNavigateToBreadcrumb={handleBack}
      />
    </div>
  )
}
