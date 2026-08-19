"use client"

// Self-contained course sidebar — brand card (with collapse chevron) + menu search +
// course hierarchy ALONE + identity foot with the account menu. Deliberately NOT the
// shared StudentSidebar: no Dashboard/Courses/Notifications nav rows, just the tree.

import React, { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Search, ChevronDown, LogOut, BookOpen, Layers, UserRound, Undo2 } from "lucide-react"
import { staffRouteForCurrentCourse, studentRouteForCurrentCourse } from "@/app/lms/component/useAccountMenu"

const ACCENT = "#F97316"
const FONT = "'Poppins','Roboto',system-ui,-apple-system,sans-serif"

interface CourseSidebarProps {
  /** Shown in the brand card instead of the app name — mirrors the
      upload-resources sidebar, which leads with the course, not "SmartCliff". */
  courseName: string
  moduleCount: number
  sidebarSearch: string
  onSearchChange: (v: string) => void
  onLogout: () => void
  /** Collapses the rail (the brand-card chevron, L&D style). */
  onCollapse?: () => void
  children: React.ReactNode // the <Sidebar/> hierarchy tree
}

export const CourseSidebar: React.FC<CourseSidebarProps> = ({
  courseName, moduleCount, sidebarSearch, onSearchChange, onLogout, onCollapse, children,
}) => {
  const router = useRouter()
  const [info, setInfo] = useState({ name: "Student", role: "Student", letter: "S", enrolled: 0, streak: 0 })
  const [email, setEmail] = useState("")
  const [menuOpen, setMenuOpen] = useState(false)
  const [dummy, setDummy] = useState(false)
  const [origRole, setOrigRole] = useState("")
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    try {
      const raw = localStorage.getItem("smartcliff_roleSwitch")
      if (raw) {
        const d = JSON.parse(raw)
        setDummy(!!d.isDummyStudent)
        setOrigRole(d.originalRenameRole || d.originalRole || "")
      }
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    if (!menuOpen) return
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener("mousedown", close)
    return () => document.removeEventListener("mousedown", close)
  }, [menuOpen])

  const isStaff = !/student/i.test(info.role)
  const switchToStudent = () => {
    try {
      const u = JSON.parse(localStorage.getItem("smartcliff_userData") || "{}")
      localStorage.setItem("smartcliff_roleSwitch", JSON.stringify({
        isDummyStudent: true,
        originalRole: u.role?.roleName || "",
        originalRenameRole: u.role?.renameRole || "",
        switchTimestamp: Date.now(),
      }))
      localStorage.setItem("smartcliff_isDummyStudent", "true")
      setMenuOpen(false)
      router.push(studentRouteForCurrentCourse())
      setTimeout(() => window.dispatchEvent(new Event("storage")), 100)
    } catch { /* ignore */ }
  }
  const switchBack = () => {
    try {
      localStorage.removeItem("smartcliff_roleSwitch")
      localStorage.removeItem("smartcliff_isDummyStudent")
      setMenuOpen(false)
      const back = staffRouteForCurrentCourse()
      router.push(back || "/lms/pages/admindashboard")
      setTimeout(() => window.dispatchEvent(new Event("storage")), 100)
    } catch { /* ignore */ }
  }

  useEffect(() => {
    try {
      const raw = localStorage.getItem("smartcliff_userData")
      if (!raw) return
      const u = JSON.parse(raw)
      const courses: any[] = u.courses || []
      const lastWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      const streak = Math.min(
        courses.filter(c => new Date(c.lastAccessed || c.updatedAt || Date.now()) >= lastWeek).length,
        7,
      )
      setInfo({
        name: `${u.firstName || ""} ${u.lastName || ""}`.trim() || "Student",
        role: u.role?.renameRole || "Student",
        letter: (u.firstName?.[0] || "S").toUpperCase(),
        enrolled: courses.length,
        streak,
      })
      if (u.email) setEmail(u.email)
    } catch { /* ignore */ }
  }, [])

  return (
    // Transparent root: on desktop the rail sits FLAT on the gray canvas
    // (floating-workspace language); the mobile drawer's own white wrapper
    // still provides a solid surface there.
    <div className="h-full w-full flex flex-col bg-transparent overflow-hidden" style={{ fontFamily: FONT }}>
      {/* Course card — raised white block on the gray rail, like every shell.
          Leads with the course (icon + name + module count), matching the
          upload-resources sidebar, not the app brand. The chevron collapses
          the rail (same control as the L&D brand card). */}
      <div className="flex-shrink-0 px-3 pt-3 pb-1.5">
        <div className="flex items-center gap-2.5 rounded-[14px] border border-[#E4E7EC] bg-white px-3 py-2 shadow-[0_1px_2px_rgba(16,24,40,.04)]">
          <div
            className="w-[34px] h-[34px] rounded-[10px] flex items-center justify-center flex-shrink-0 shadow-sm"
            style={{ background: `linear-gradient(135deg, ${ACCENT}, #FB923C)` }}
          >
            <BookOpen className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-bold tracking-tight text-gray-900 truncate leading-tight m-0">
              {courseName || "Course"}
            </p>
            <div className="flex items-center gap-1 mt-0.5">
              <Layers className="w-2.5 h-2.5 text-gray-400 flex-shrink-0" strokeWidth={2} />
              <span className="text-[11px] font-medium text-gray-400 truncate">
                {moduleCount} module{moduleCount !== 1 ? "s" : ""}
              </span>
            </div>
          </div>
          {onCollapse && (
            <button
              type="button"
              onClick={onCollapse}
              aria-label="Collapse navigation"
              className="ml-auto inline-grid place-items-center w-6 h-6 rounded-[7px] flex-shrink-0 text-gray-400 hover:bg-[#E9EBF0] hover:text-gray-600 transition-colors"
            >
              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M15 6l-6 6 6 6" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Menu search — filters the hierarchy */}
      <div className="px-4 pb-2 flex-shrink-0">
        <div className="flex items-center gap-2 h-9 px-3 rounded-[10px] bg-white border border-[#E4E7EC] focus-within:border-orange-300 transition-colors">
          <Search className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" strokeWidth={2} />
          <input
            value={sidebarSearch}
            onChange={e => onSearchChange(e.target.value)}
            placeholder="Search menu..."
            className="flex-1 min-w-0 bg-transparent text-[14px] text-gray-700 placeholder:text-gray-400 outline-none"
          />
          <kbd className="flex-shrink-0 text-[11.5px] font-semibold text-gray-400 bg-white border border-gray-200 rounded px-1.5 py-0.5 leading-none">⌘K</kbd>
        </div>
      </div>

      {/* Hierarchy (tree) — the only nav in this sidebar */}
      <div className="flex-1 min-h-0 overflow-y-auto sbd-scroll">
        {children}
      </div>

      {/* Identity — flat row at the rail's bottom (the L&D rail-foot pattern);
          the menu opens UPWARD with the account actions that used to live in
          the top bar's profile chip. */}
      <div ref={menuRef} className="relative flex-shrink-0 px-3 pb-3 pt-1.5">
        {menuOpen && (
          <div className="absolute bottom-[62px] left-3 right-3 z-30 rounded-xl border border-[#E4E7EC] bg-white shadow-[0_12px_32px_rgba(0,0,0,0.14)] p-1.5">
            <div className="px-2.5 py-2 border-b border-gray-100 mb-1">
              <p className="text-[14px] font-bold text-gray-900 truncate">{info.name}</p>
              {email && <p className="text-[12px] text-gray-500 truncate mt-0.5">{email}</p>}
              <span className={`inline-flex mt-1.5 px-1.5 py-0.5 rounded text-[11px] font-bold ${dummy ? "bg-amber-50 text-amber-700" : "bg-orange-50 text-orange-600"}`}>
                {dummy ? "⚡ Student View" : info.role}
              </span>
            </div>
            {isStaff && !dummy && (
              <button
                onClick={switchToStudent}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left hover:bg-orange-50 transition-colors"
              >
                <UserRound size={14} className="text-orange-500 flex-shrink-0" />
                <span className="text-[13.5px] font-semibold text-orange-600">Switch to Student</span>
              </button>
            )}
            {dummy && (
              <button
                onClick={switchBack}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left hover:bg-amber-50 transition-colors"
              >
                <Undo2 size={14} className="text-amber-600 flex-shrink-0" />
                <span className="text-[13.5px] font-semibold text-amber-700">Back to {origRole || "staff"}</span>
              </button>
            )}
            <button
              onClick={() => { setMenuOpen(false); router.push("/lms/pages/studentdashboard/student/profile") }}
              className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left hover:bg-gray-50 transition-colors"
            >
              <UserRound size={14} className="text-gray-500 flex-shrink-0" />
              <span className="text-[13.5px] font-medium text-gray-800">My Profile</span>
            </button>
            <button
              onClick={() => { setMenuOpen(false); onLogout() }}
              className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left hover:bg-red-50 transition-colors"
            >
              <LogOut size={14} className="text-red-500 flex-shrink-0" />
              <span className="text-[13.5px] font-semibold text-red-600">Logout</span>
            </button>
          </div>
        )}
        <button
          onClick={() => setMenuOpen(v => !v)}
          className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl hover:bg-[#E9EBF0] transition-colors"
        >
          <div
            className="w-[34px] h-[34px] rounded-full flex items-center justify-center text-white text-[13px] font-bold flex-shrink-0 shadow-sm"
            style={{ background: `linear-gradient(135deg, ${ACCENT}, #FB923C)` }}
          >
            {info.letter}
          </div>
          <div className="flex-1 min-w-0 text-left">
            <p className="text-[14px] font-semibold text-gray-900 truncate leading-tight">{info.name}</p>
            <p className={`text-[12px] truncate mt-0.5 ${dummy ? "text-amber-600 font-semibold" : "text-gray-500"}`}>
              {dummy ? "⚡ Student View" : info.role}
            </p>
          </div>
          <ChevronDown className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${menuOpen ? "rotate-180" : ""}`} />
        </button>
      </div>

    </div>
  )
}
