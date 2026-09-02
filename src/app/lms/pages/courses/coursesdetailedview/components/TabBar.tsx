// components/TabBar.tsx  (also contains TopBar — kept for backward compat)
import React, { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { ChevronRight, Layout, Bot, Sparkles, Sun, Moon, User, Settings, LogOut, BookOpen, ChevronDown, Eye, Users, ClipboardList } from "lucide-react"
import { T, FONT_PRIMARY } from "./types/constants"
import { userPermission } from "@/apiServices/tokenVerify"
import { postLogout } from "@/apiServices/activityLog"
import { RoleSwitchState } from "./types/types"
import { staffRouteForCurrentCourse, studentRouteForCurrentCourse } from "@/app/lms/component/useAccountMenu"
import { useQueryClient } from "@tanstack/react-query"
import { clearAllStorage } from "@/lib/session"

interface TopBarProps {
  items: Array<{ label: string; icon?: React.ComponentType<any>; onClick?: () => void; isLast?: boolean }>
  onAIClick: () => void
  onSummaryClick: () => void
  onMenuClick: () => void
  showAIChat?: boolean
  showSummary?: boolean
}

export const TopBar: React.FC<TopBarProps> = ({ items, onAIClick, onSummaryClick, onMenuClick, showAIChat = false, showSummary = false }) => {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [userOpen, setUserOpen] = useState(false)
  const [isDummyStudent, setIsDummyStudent] = useState(false)
  const [originalRoleInfo, setOriginalRoleInfo] = useState<{ roleName: string; renameRole: string } | null>(null)
  const [user, setUser] = useState<{ firstName: string; lastName: string; email: string; role: { roleName: string; renameRole: string } } | null>(null)
  const [theme, setThemeState] = useState<'light' | 'dark'>('light')
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const userRef = useRef<HTMLDivElement>(null)

  const checkDummyStatus = () => {
    try {
      const raw = localStorage.getItem('smartcliff_roleSwitch')
      if (raw) {
        const d: RoleSwitchState = JSON.parse(raw)
        setIsDummyStudent(d.isDummyStudent || false)
        if (d.originalRole || d.originalRenameRole) {
          setOriginalRoleInfo({ roleName: d.originalRole || '', renameRole: d.originalRenameRole || '' })
        }
      } else {
        setIsDummyStudent(false)
        setOriginalRoleInfo(null)
      }
    } catch { }
  }

  useEffect(() => {
    try {
      const saved = localStorage.getItem('theme') as 'light' | 'dark'
      const sys = window.matchMedia('(prefers-color-scheme: dark)').matches
      const t = saved || (sys ? 'dark' : 'light')
      setThemeState(t)
      if (t === 'dark') document.documentElement.classList.add('dark')
      else document.documentElement.classList.remove('dark')
    } catch { }
    checkDummyStatus()
    try {
      const raw = localStorage.getItem('smartcliff_userData') || localStorage.getItem('smartcliff_user') || localStorage.getItem('currentUser')
      if (raw) setUser(JSON.parse(raw))
    } catch { }
  }, [])

  useEffect(() => {
    const h = () => checkDummyStatus()
    window.addEventListener('storage', h)
    return () => window.removeEventListener('storage', h)
  }, [])

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (userRef.current && !userRef.current.contains(e.target as Node)) setUserOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const toggleTheme = () => {
    const n = theme === 'light' ? 'dark' : 'light'
    setThemeState(n)
    if (n === 'dark') document.documentElement.classList.add('dark')
    else document.documentElement.classList.remove('dark')
    localStorage.setItem('theme', n)
  }

  // Helper function to clear all localStorage items including React Query cache
  const clearLocalStorage = () => {
    // Sign-out wipe. The old hand-maintained key list only covered
    // `smartcliff_*` and cache keys, so everything else the app writes
    // survived into the next session. See clearAllStorage in lib/session.
    clearAllStorage()
  }

  // Helper function to clear React Query cache
  const clearReactQueryCache = () => {
    try {
      // Clear the React Query client cache
      queryClient.clear()
      
      // Remove React Query persisted cache from localStorage
      const reactQueryKeys = [
        "smartcliff:rq-cache:v1",
        "rq-cache:v1",
        "react-query:cache",
        "tanstack:cache",
        "smartcliff:rq-cache"
      ]
      
      reactQueryKeys.forEach(key => {
        localStorage.removeItem(key)
      })

      // Remove any other cache items that might be in localStorage
      const keysToRemove: string[] = []
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && (key.includes('rq-cache') || key.includes('react-query') || key.includes('tanstack') || key.includes('smartcliff:rq'))) {
          keysToRemove.push(key)
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key))

      console.log('React Query cache cleared successfully')
    } catch (error) {
      console.error('Error clearing React Query cache:', error)
    }
  }

  const handleLogout = async () => {
    setIsLoggingOut(true)
    try {
      // Clear React Query cache first
      clearReactQueryCache()

      await postLogout()
      
      // Clear all localStorage items
      clearLocalStorage()
      
      router.push('/login')
    } catch (error) {
      // Ensure cache is cleared even on error
      clearReactQueryCache()
      clearLocalStorage()
      console.error('Logout error:', error)
    } finally {
      setIsLoggingOut(false)
    }
  }

  const handleSwitchToStudent = () => {
    try {
      const d: RoleSwitchState = {
        isDummyStudent: true,
        originalRole: user?.role?.roleName || '',
        originalRenameRole: user?.role?.renameRole || '',
        switchTimestamp: Date.now()
      }
      localStorage.setItem('smartcliff_roleSwitch', JSON.stringify(d))
      localStorage.setItem('smartcliff_isDummyStudent', 'true')
      setIsDummyStudent(true)
      setOriginalRoleInfo({ roleName: user?.role?.roleName || '', renameRole: user?.role?.renameRole || '' })
      setUserOpen(false)
      // Already on this course — stay on it, now rendered as the learner sees it.
      router.push(studentRouteForCurrentCourse())
      setTimeout(() => window.dispatchEvent(new Event('storage')), 100)
    } catch { }
  }

  const handleSwitchBack = () => {
    try {
      localStorage.removeItem('smartcliff_roleSwitch')
      localStorage.removeItem('smartcliff_isDummyStudent')
      setIsDummyStudent(false)
      setOriginalRoleInfo(null)
      setUserOpen(false)
      // Return to the staff side of the SAME course rather than a dashboard the
      // role may not even have permission for.
      const backToCourse = staffRouteForCurrentCourse()
      if (backToCourse) router.push(backToCourse)
      else {
        const r = originalRoleInfo?.renameRole?.toLowerCase() || ''
        if (r.includes('poc')) router.push('/lms/pages/poc/dashboard')
        else if (r.includes('admin')) router.push('/lms/pages/admin/dashboard')
        else router.push('/lms/pages/dashboard')
      }
      setTimeout(() => window.dispatchEvent(new Event('storage')), 100)
    } catch { }
  }

  const isActualStudent = () => {
    if (user) {
      if (user.role?.roleName?.toLowerCase().includes('student')) return true
      if (user.role?.renameRole?.toLowerCase().includes('student')) return true
    }
    try {
      const renameRole = localStorage.getItem('smartcliff_renameRole')
      if (renameRole?.toLowerCase().includes('student')) return true
      const roleVal = localStorage.getItem('smartcliff_roleValue')
      if (roleVal?.toLowerCase().includes('student')) return true
    } catch { }
    return false
  }

  const getInitials = () => {
    if (!user) return 'SC'
    return `${user.firstName?.charAt(0) || ''}${user.lastName?.charAt(0) || ''}`.toUpperCase()
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      padding: '0 14px', height: 50,
      background: '#FFF7ED', flexShrink: 0, position: 'relative',
      fontFamily: FONT_PRIMARY,
      WebkitFontSmoothing: 'antialiased',
    }}>
      <button onClick={onMenuClick} className="lg:hidden"
        style={{ padding: 6, borderRadius: 8, border: `1px solid ${T.border}`, background: 'transparent', cursor: 'pointer', color: T.textMuted, display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: 4 }}>
        <Layout size={15} />
      </button>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', minWidth: 0, overflow: 'hidden' }}>
        {items.map((item, i) => {
          const isLast = item.isLast || i === items.length - 1
          const isNav = i <= 1
          return (
            <React.Fragment key={i}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                padding: '0',
                cursor: !isLast ? 'pointer' : 'default',
                flexShrink: 0
              }}
                onClick={item.onClick}
              >
                {item.icon && (
                  <item.icon size={10} style={{ color: isLast ? '#F97316' : '#6b7280', flexShrink: 0 }} />
                )}
                <span style={{
                  fontSize: isLast ? '13px' : '12px',
                  fontWeight: isLast ? 700 : 500,
                  color: isLast ? '#9A3412' : '#4b5563',
                  padding: '1px 2px', borderRadius: 4,
                  background: isLast ? 'rgba(249,115,22,0.10)' : 'transparent',
                  transition: 'all .12s',
                  whiteSpace: 'nowrap',
                  textDecoration: item.onClick && !isLast ? 'none' : 'none',
                }}>
                  {item.label}
                </span>
              </div>
              {!isLast && <ChevronRight size={9} style={{ color: '#9ca3af', flexShrink: 0, margin: '0 2px' }} />}
            </React.Fragment>
          )
        })}
      </div>

      {/* Right actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
        <button
          onClick={onSummaryClick}
          style={{
            display: 'flex', alignItems: 'center', gap: 5, padding: '5px 11px',
            borderRadius: 8, border: `1px solid ${showSummary ? T.orange : T.border}`,
            background: showSummary ? T.orangeTint : 'transparent',
            color: showSummary ? T.orange : T.textMuted,
            fontSize: '13px', fontWeight: 600, cursor: 'pointer', transition: 'all .15s',
          }}
        >
          <Sparkles size={12} /><span className="hidden sm:inline">Summary</span>
        </button>
        <button
          onClick={onAIClick}
          style={{
            display: 'flex', alignItems: 'center', gap: 5, padding: '5px 11px',
            borderRadius: 8, border: `1px solid ${showAIChat ? T.orange : T.border}`,
            background: showAIChat ? T.orangeTint : 'transparent',
            color: showAIChat ? T.orange : T.textMuted,
            fontSize: '13px', fontWeight: 600, cursor: 'pointer', transition: 'all .15s',
          }}
        >
          <Bot size={12} /><span className="hidden sm:inline">Ask AI</span>
        </button>

        {/* User dropdown */}
        <div ref={userRef} style={{ position: 'relative' }}>
          <button
            onClick={() => setUserOpen(v => !v)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px',
              borderRadius: 8, border: `1px solid ${userOpen ? T.orange : T.border}`,
              background: userOpen ? T.orangeTint : 'transparent',
              cursor: 'pointer', transition: 'all .15s',
            }}
          >
            <div style={{
              width: 26, height: 26, borderRadius: 8,
              background: `linear-gradient(135deg,${T.orange},${T.orangeDark})`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '11.5px', fontWeight: 700, color: '#fff',
            }}>
              {getInitials()}
            </div>
            <ChevronDown size={11} style={{ color: T.textMuted, transition: 'transform .15s', transform: userOpen ? 'rotate(180deg)' : 'none' }} />
          </button>

          {userOpen && (
            <div style={{
              position: 'absolute', top: '100%', right: 0, marginTop: 6,
              background: '#fff', borderRadius: 12, border: `1px solid ${T.border}`,
              boxShadow: '0 8px 32px rgba(0,0,0,0.12)', zIndex: 100,
              minWidth: 210, overflow: 'hidden',
              animation: 'fadeIn .15s ease both',
            }}>
              {/* User info */}
              <div style={{ padding: '12px 14px', borderBottom: `1px solid ${T.line}`, background: T.pageBg }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 34, height: 34, borderRadius: 10, background: `linear-gradient(135deg,${T.orange},${T.orangeDark})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13.5px', fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                    {getInitials()}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: T.textMain, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {user ? `${user.firstName} ${user.lastName}` : 'Student'}
                    </p>
                    <p style={{ margin: 0, fontSize: '12px', color: T.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {user?.email || ''}
                    </p>
                  </div>
                </div>
                {isDummyStudent && (
                  <div style={{ marginTop: 8, padding: '4px 8px', borderRadius: 6, background: 'rgba(249,115,22,0.10)', border: `1px solid rgba(249,115,22,0.25)` }}>
                    <span style={{ fontSize: '11.5px', fontWeight: 600, color: T.orange }}>👁 Viewing as Student</span>
                  </div>
                )}
              </div>

              <div style={{ padding: '6px' }}>
                <button onClick={() => { setUserOpen(false); router.push('/lms/pages/studentdashboard/student/profile') }}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '8px 10px', borderRadius: 8, border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left', transition: 'background .12s' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = T.pageBg }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}>
                  <User size={13} style={{ color: T.inkMuted, flexShrink: 0 }} />
                  <span style={{ fontSize: '13.5px', fontWeight: 500, color: T.textMain }}>My Profile</span>
                </button>
                <button onClick={() => setUserOpen(false)}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '8px 10px', borderRadius: 8, border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left', transition: 'background .12s' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = T.pageBg }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}>
                  <Settings size={13} style={{ color: T.inkMuted, flexShrink: 0 }} />
                  <span style={{ fontSize: '13.5px', fontWeight: 500, color: T.textMain }}>Settings</span>
                </button>
                <button onClick={() => setUserOpen(false)}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '8px 10px', borderRadius: 8, border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left', transition: 'background .12s' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = T.pageBg }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}>
                  <BookOpen size={13} style={{ color: T.inkMuted, flexShrink: 0 }} />
                  <span style={{ fontSize: '13.5px', fontWeight: 500, color: T.textMain }}>Help & Support</span>
                </button>

                {!isActualStudent() && !isDummyStudent && (
                  <button onClick={handleSwitchToStudent}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '8px 10px', borderRadius: 8, border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left', transition: 'background .12s' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(249,115,22,0.06)' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}>
                    <Eye size={13} style={{ color: T.orange, flexShrink: 0 }} />
                    <span style={{ fontSize: '13.5px', fontWeight: 600, color: T.orange }}>View as Student</span>
                  </button>
                )}
                {isDummyStudent && (
                  <button onClick={handleSwitchBack}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '8px 10px', borderRadius: 8, border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left', transition: 'background .12s' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(249,115,22,0.06)' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}>
                    <Eye size={13} style={{ color: T.orange, flexShrink: 0 }} />
                    <span style={{ fontSize: '13.5px', fontWeight: 600, color: T.orange }}>Switch Back to {originalRoleInfo?.renameRole || 'Admin'}</span>
                  </button>
                )}
              </div>
              <div style={{ padding: '6px', borderTop: `1px solid ${T.line}` }}>
                <button onClick={handleLogout} disabled={isLoggingOut}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '8px 10px', borderRadius: 8, border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left', transition: 'background .12s' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.06)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}>
                  <LogOut size={13} style={{ color: '#ef4444', flexShrink: 0 }} />
                  <span style={{ fontSize: '13.5px', fontWeight: 600, color: '#ef4444' }}>{isLoggingOut ? 'Signing out…' : 'Sign Out'}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── TabBar ────────────────────────────────────────────────────────────────────
// Descriptive tooltip copy per the spec — browsers surface these on hover
// AND on keyboard focus (both native for `title` + `aria-label`). Kept as
// a lookup so both MainTabs (rendered above) and any consumer that wants
// to echo the same text below stay in sync.
export const TAB_TOOLTIP: Record<"Overview" | "I_Do" | "We_Do" | "You_Do", string> = {
  Overview: "Course summary",
  I_Do: "Instructor demonstration",
  We_Do: "Guided practice",
  You_Do: "Independent practice",
}

// Overview tab config
const OVERVIEW_CFG = {
  label: "Overview",
  icon: <img src="/icons/overview.png" alt="Overview"
    style={{
      width: 18,
      height: 18,
      objectFit: 'contain',
      display: 'block',
      background: '#ffffff',
      borderRadius: 4,
      padding: 2,
    }}
    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
  />,
  color: T.orange,         // orange — blends with site theme
  bg: "rgba(249,115,22,0.10)",
  shadow: "rgba(249,115,22,0.30)",
} as const
const TAB_CFG = {
  I_Do: {
    label: "I Do",
    icon: <User size={14} style={{ display: 'block' }} />,
    color: "#F97316",
    bg: "rgba(249,115,22,0.09)",
    shadow: "rgba(249,115,22,0.30)"
  },
  We_Do: {
    label: "We Do",
    icon: <Users size={14} style={{ display: 'block' }} />,
    color: "#F97316",
    bg: "rgba(249,115,22,0.09)",
    shadow: "rgba(249,115,22,0.30)"
  },
  You_Do: {
    label: "You Do",
    icon: <ClipboardList size={14} style={{ display: 'block' }} />,
    color: "#F97316",
    bg: "rgba(249,115,22,0.09)",
    shadow: "rgba(249,115,22,0.30)"
  },
} as const
type TabKey = keyof typeof TAB_CFG
type AnyTabKey = "Overview" | TabKey

interface MainTabsProps {
  selectedNode: boolean
  activeTab: string | null           // "Overview" | "I_Do" | "We_Do" | "You_Do"
  subcategories: {
    I_Do: Array<{ key: string; label: string; icon?: React.ReactNode; component: any }>
    We_Do: Array<{ key: string; label: string; icon?: React.ReactNode; component: any }>
    You_Do: Array<{ key: string; label: string; icon?: React.ReactNode; component: any }>
  }
  onTabChange: (tab: string) => void
  onSubcategoryChange: (sub: string, component: any) => void
  onOverviewClick?: () => void       // called when Overview tab is clicked
}

// Main pedagogy tabs (Overview / I Do / We Do / You Do), rendered INSIDE the
// TopBar's left slot so the header is a single row — tabs left, action icons
// right. The active underline hugs the TopBar's own bottom border.
export const MainTabs: React.FC<MainTabsProps> = ({
  selectedNode, activeTab, subcategories, onTabChange, onSubcategoryChange, onOverviewClick,
}) => {
  // All tabs: Overview first, then the 3 method tabs
  const allTabs: Array<{ key: AnyTabKey; label: string; icon: React.ReactNode; color: string; bg: string; shadow: string }> = [
    { key: "Overview", ...OVERVIEW_CFG },
    ...(Object.entries(TAB_CFG) as [TabKey, typeof TAB_CFG[TabKey]][]).map(([k, v]) => ({ key: k as AnyTabKey, ...v })),
  ]

  const [prevTab, setPrevTab] = React.useState<string | null>(null)
  const [isAnimating, setIsAnimating] = React.useState(false)

  const handleTabClick = (tabKey: string, isOverview: boolean, subs: any[]) => {
    if (tabKey === activeTab) return
    setPrevTab(activeTab)
    setIsAnimating(true)
    setTimeout(() => setIsAnimating(false), 300)

    if (isOverview) {
      onTabChange("Overview")
      if (onOverviewClick) onOverviewClick()
    } else {
      onTabChange(tabKey)
      if (subs.length > 0) onSubcategoryChange(subs[0].key, subs[0].component)
    }
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'stretch', gap: 6,
      height: '100%', minWidth: 0,
      overflowX: 'auto', scrollbarWidth: 'none',
      fontFamily: FONT_PRIMARY, WebkitFontSmoothing: 'antialiased',
    }}>
      {allTabs.map((tab, idx) => {
        const isOverview = tab.key === "Overview"
        const isSel = activeTab === tab.key
        const isDis = !selectedNode && tab.key !== "Overview"
        const isFirstTab = idx === 0
        const subs = isOverview ? [] : (subcategories[tab.key as TabKey] ?? [])

        return (
          <React.Fragment key={tab.key}>
            {!isFirstTab && (
              <span style={{
                alignSelf: 'center',
                width: 1,
                height: 22,
                background: '#e2e8f0',
                flexShrink: 0,
              }} />
            )}
            <button
              disabled={isDis}
              onClick={() => handleTabClick(tab.key, isOverview, subs)}
              title={TAB_TOOLTIP[tab.key as keyof typeof TAB_TOOLTIP] || tab.label}
              aria-label={`${tab.label} — ${TAB_TOOLTIP[tab.key as keyof typeof TAB_TOOLTIP] || ''}`.trim()}
              style={{
                flex: '0 0 auto',
                // Label sinks to the BOTTOM of the tall (48px) TopBar
                // button so its underline sits right next to the
                // horizontal hairline — same visual rhythm as the
                // shorter Assignment tab.
                display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 6,
                padding: '0 14px',
                height: '100%',
                fontSize: 14,
                fontWeight: 500,
                // Underline moved OFF the button — now lives on the
                // inner label span so it hugs the text width (same rule
                // as the Assignment subcategory tab). Prevents the
                // orange rule from stretching across the button's full
                // click area.
                border: 'none',
                background: 'transparent',
                color: isSel ? '#F97316' : isDis ? '#B3BAC5' : '#111827',
                cursor: isDis ? 'not-allowed' : 'pointer',
                opacity: isDis ? 0.45 : 1,
                transition: 'color 0.2s ease',
                whiteSpace: 'nowrap',
                borderRadius: 0,
                boxShadow: 'none',
                transform: isAnimating && prevTab === tab.key ? 'scale(0.97)' : 'scale(1)',
              }}
              onMouseEnter={e => {
                if (!isSel && !isDis) e.currentTarget.style.color = '#F97316'
              }}
              onMouseLeave={e => {
                if (!isSel) e.currentTarget.style.color = isDis ? '#B3BAC5' : '#111827'
              }}
            >
              {/* Label wrapper carries the 3px orange underline that
                  hugs the icon+text width and sits directly on top of
                  the TopBar's own borderBottom (marginBottom: -1). */}
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                // Larger padding pushes the LABEL text upward from the
                // bottom of the button while the underline stays near
                // the horizontal line (marginBottom does the "little
                // above" lift). Text now sits a comfortable distance
                // above the underline instead of hugging it.
                paddingBottom: 8,
                borderBottom: isSel ? '3px solid #F97316' : '3px solid transparent',
                marginBottom: 2,
              }}>
                {tab.key !== 'Overview' && (
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    width: 16, height: 16, borderRadius: 6,
                    background: 'transparent',
                    flexShrink: 0,
                    opacity: isSel ? 1 : 0.6,
                    transition: 'opacity 0.2s ease',
                  }}>
                    {tab.icon}
                  </span>
                )}
                <span style={{ display: 'inline-block' }}>{tab.label}</span>
              </span>
            </button>
          </React.Fragment>
        )
      })}
    </div>
  )
}

interface TabBarProps {
  selectedNode: boolean
  activeTab: string | null           // "Overview" | "I_Do" | "We_Do" | "You_Do"
  activeSubcategory: string
  subcategories: {
    I_Do: Array<{ key: string; label: string; icon?: React.ReactNode; component: any }>
    We_Do: Array<{ key: string; label: string; icon?: React.ReactNode; component: any }>
    You_Do: Array<{ key: string; label: string; icon?: React.ReactNode; component: any }>
  }
  onTabChange: (tab: string) => void
  onSubcategoryChange: (sub: string, component: any) => void
  onOverviewClick?: () => void       // kept for API compatibility (used by MainTabs)
  // Optional third-level row (e.g. You Do → Assessment → Mock / Final).
  // Rendered with the exact styling of the subcategory row so the
  // tab rows line up identically.
  thirdLevel?: {
    tabs: Array<{ key: string; label: string; count?: number; color?: string }>
    active: string
    onChange: (key: string) => void
  }
}

// Secondary rows only — the main Overview/I Do/We Do/You Do row moved into the
// TopBar (see MainTabs above), so this renders just the subcategory row and the
// optional third-level row, and nothing at all when neither applies.
export const TabBar: React.FC<TabBarProps> = ({
  activeTab, activeSubcategory, subcategories,
  onSubcategoryChange, thirdLevel,
}) => {
  const hasSubs = !!activeTab && activeTab !== "Overview" && (subcategories[activeTab as TabKey] ?? []).length > 0
  const hasThird = !!thirdLevel && thirdLevel.tabs.length > 0
  if (!hasSubs && !hasThird) return null

  return (
    <div style={{
      flexShrink: 0, background: '#FFF7ED',
      // Edge-to-edge hairline sits on the OUTER wrapper (not the
      // padded row) so the line spans the full viewport width, exactly
      // like the TopBar's own borderBottom under I Do / We Do / You Do.
      borderBottom: `1px solid ${T.border}`,
      fontFamily: FONT_PRIMARY, WebkitFontSmoothing: 'antialiased',
    }}>
      {/* Subcategory tabs */}
      {activeTab && activeTab !== "Overview" && (subcategories[activeTab as TabKey] ?? []).length > 0 && (
      <div style={{
        display: 'flex', alignItems: 'flex-end', gap: 6,
        // Shared responsive gutter — matches TopBar + toolbar. Vertical
        // padding kept as-is (5px top, 0 bottom) so the active
        // underline sits flush on the row's own hairline divider.
        paddingBlock: '5px 0px',
        paddingInline: 'clamp(16px, 2vw, 32px)',
        width: '100%', boxSizing: 'border-box',
        position: 'relative',
        overflowX: 'auto', scrollbarWidth: 'none',
        background: '#ffffff',
        // Row's own borderBottom draws the edge-to-edge hairline below
        // Assessment / Test Your Skills — same rule that sits under I Do
        // / We Do / You Do above. Previously we leaned on the outer
        // wrapper's border, but when the third-level row rendered
        // beneath, the wrapper's border sat at the very bottom and the
        // subcategory row appeared to have no line under it.
        borderBottom: `1px solid ${T.border}`,
        animation: 'subcategorySlide 0.35s cubic-bezier(0.22, 1, 0.36, 1)',
      }}>
        {/* No inner divider — the outer wrapper's borderBottom carries
            the full-width hairline already, and the active-tab underline
            below sits directly on top of it. */}
          {(subcategories[activeTab as TabKey] ?? []).map((sub, idx) => {
            const tabCfg = TAB_CFG[activeTab as TabKey]
            const isActive = activeSubcategory === sub.key
            const isFirstSub = idx === 0
            return (
              <React.Fragment key={sub.key}>
                {!isFirstSub && (
                  <span style={{
                    alignSelf: 'center',
                    width: 1,
                    height: 24,
                    background: '#e2e8f0',
                    flexShrink: 0,
                  }} />
                )}
<button
  onClick={() => onSubcategoryChange(sub.key, sub.component)}
  style={{
    flex: '0 0 auto',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
    padding: '0 16px',
    height: 34,
    fontSize: 13.5,
    fontWeight: 500,
    border: 'none',
    // Underline moved OFF the button (used to be `borderBottom` on
    // this element, which stretched under the full padded click area
    // — the user wants it to start exactly under the "A" of the
    // label). It now lives on the inner label span below.
    background: 'transparent',
    color: isActive ? '#F97316' : '#111827',
    cursor: 'pointer',
    transition: 'all 0.25s cubic-bezier(0.22, 1, 0.36, 1)',
    whiteSpace: 'nowrap',
    borderRadius: 0,
    boxShadow: 'none',
    animation: `pillSlideIn 0.3s cubic-bezier(0.22, 1, 0.36, 1) ${idx * 60}ms both`,
  }}
  onMouseEnter={e => {
    if (!isActive) {
      e.currentTarget.style.transform = 'translateY(-2px)'
      e.currentTarget.style.color = '#F97316'
    }
  }}
  onMouseLeave={e => {
    if (!isActive) {
      e.currentTarget.style.transform = 'translateY(0)'
      e.currentTarget.style.color = '#111827'
    }
  }}
>
  {/* Label span carries the 3px orange underline so it hugs the
      text width — starts exactly under the first letter, ends at
      the last, never bleeds into the button's click padding. The
      1px negative margin drops the underline onto the row's
      hairline instead of sitting a pixel above it. */}
  <span style={{
    display: 'inline-flex', alignItems: 'center', gap: 6,
    paddingBottom: 6,
    borderBottom: isActive ? '3px solid #F97316' : '3px solid transparent',
    marginBottom: -1,
  }}>
    {sub.label}
    {/* Show count badge if available */}
    {sub.component?.subItems?.length > 0 && (
      <span style={{
        padding: '1px 6px',
        borderRadius: 10,
        fontSize: '12.5px', fontWeight: 700,
        background: isActive ? 'rgba(249,115,22,0.12)' : '#f1f5f9',
        color: isActive ? '#F97316' : '#64748b',
      }}>
        {sub.component.subItems.length}
      </span>
    )}
  </span>
</button>
              </React.Fragment>
            )
          })}
        </div>
      )}

      {/* Third-level row (You Do → Assessment → Mock / Final) — shares
          the same clamp gutter as the subcategory row above so Mock
          starts on the exact same left guideline as Test Your Skills /
          Assessment / the TopBar Overview tab / the toolbar search. */}
      {thirdLevel && thirdLevel.tabs.length > 0 && (
        <div style={{
          display: 'flex', alignItems: 'flex-end', gap: 6,
          paddingBlock: '5px 0px',
          paddingInline: 'clamp(16px, 2vw, 32px)',
          width: '100%', boxSizing: 'border-box',
          position: 'relative',
          overflowX: 'auto', scrollbarWidth: 'none',
          background: '#ffffff',
          animation: 'subcategorySlide 0.35s cubic-bezier(0.22, 1, 0.36, 1)',
        }}>
          {/* Divider line (aligned with left/right padding) — matches
              TopBar borderBottom so the row's hairline reads the same
              weight/color as the primary nav's. */}
          <div style={{
            position: 'absolute',
            left: 'clamp(16px, 2vw, 32px)',
            right: 'clamp(16px, 2vw, 32px)',
            bottom: 0,
            height: 1,
            background: T.border,
            pointerEvents: 'none',
          }} />
          {thirdLevel.tabs.map((sub, idx) => {
            const isActive = thirdLevel.active === sub.key
            const isFirstSub = idx === 0
            // Per-tab accent (adaptive to the site palette) — falls back to orange.
            const accent = sub.color || '#F97316'
            return (
              <React.Fragment key={sub.key}>
                {!isFirstSub && (
                  <span style={{
                    alignSelf: 'center',
                    width: 1,
                    height: 24,
                    background: '#e2e8f0',
                    flexShrink: 0,
                  }} />
                )}
                <button
                  onClick={() => thirdLevel.onChange(sub.key)}
                  style={{
                    flex: '0 0 auto',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    padding: '0 16px',
                    height: 34,
                    fontSize: 13.5,
                    fontWeight: 500,
                    border: 'none',
                    borderBottom: isActive ? `3px solid ${accent}` : '3px solid transparent',
                    background: 'transparent',
                    color: isActive ? accent : '#111827',
                    cursor: 'pointer',
                    transition: 'all 0.25s cubic-bezier(0.22, 1, 0.36, 1)',
                    whiteSpace: 'nowrap',
                    borderRadius: 0,
                    boxShadow: 'none',
                    animation: `pillSlideIn 0.3s cubic-bezier(0.22, 1, 0.36, 1) ${idx * 60}ms both`,
                  }}
                  onMouseEnter={e => {
                    if (!isActive) {
                      e.currentTarget.style.transform = 'translateY(-2px)'
                      e.currentTarget.style.color = accent
                    }
                  }}
                  onMouseLeave={e => {
                    if (!isActive) {
                      e.currentTarget.style.transform = 'translateY(0)'
                      e.currentTarget.style.color = '#111827'
                    }
                  }}
                >
                  {sub.label}
                  {typeof sub.count === 'number' && (
                    <span style={{
                      marginLeft: 6,
                      padding: '1px 6px',
                      borderRadius: 10,
                      fontSize: '12.5px', fontWeight: 700,
                      // 8-digit hex appends ~12% alpha for a soft tinted badge.
                      background: isActive ? `${accent}1F` : '#f1f5f9',
                      color: isActive ? accent : '#64748b',
                    }}>
                      {sub.count}
                    </span>
                  )}
                </button>
              </React.Fragment>
            )
          })}
        </div>
      )}
    </div>
  )
}