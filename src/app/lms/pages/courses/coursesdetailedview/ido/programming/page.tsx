"use client"

import React, { Suspense } from "react"
import { Loader2 } from "lucide-react"
import MultiFileProgrammingPage from "@/app/lms/component/student/multi-file/MultiFileProgrammingPage"

// Dedicated reload-safe URL for I Do multi-file programming exercises.
export default function IDoProgrammingPage() {
  return (
    <Suspense
      fallback={
        <div className="w-full h-screen bg-white flex items-center justify-center">
          <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
        </div>
      }
    >
      <MultiFileProgrammingPage fixedCategory="I_Do" />
    </Suspense>
  )
}
