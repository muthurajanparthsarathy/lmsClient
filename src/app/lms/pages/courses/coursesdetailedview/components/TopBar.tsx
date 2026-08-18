// components/TopBar.tsx
import React, { useState, useEffect, useRef } from "react"
import {
  FileText,
  Bell,
  EyeSlash,
  CircleNotch,
} from "@phosphor-icons/react"
import { T } from "./types/constants"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { notificationsService } from "@/apiServices/notifications"
import { notificationKeys } from "@/apiServices/notifications"

interface TopBarProps {
  items: Array<{ label: string; icon?: React.ComponentType<any>; onClick?: () => void; isLast?: boolean }>
  onAIClick: () => void
  onSummaryClick: () => void
  onMenuClick: () => void
  onNotesClick?: () => void
  onHideHeader?: () => void
  /** Left slot — the pedagogy MainTabs render here so header + tabs are ONE row. */
  tabs?: React.ReactNode
}

export const TopBar: React.FC<TopBarProps> = ({ items, onAIClick, onSummaryClick, onMenuClick, onNotesClick, onHideHeader, tabs }) => {
  const queryClient = useQueryClient()
  const [showNotificationsDropdown, setShowNotificationsDropdown] = useState(false)
  const [notesLoading, setNotesLoading] = useState(false)
  const notificationRef = useRef<HTMLDivElement>(null)

  // Fetch notifications
  const { data: notificationsData } = useQuery({
    queryKey: notificationKeys.all,
    queryFn: () => notificationsService.fetchNotifications(),
    refetchOnWindowFocus: true,
    staleTime: 30 * 1000,
    // The course view mounts no shell layout (and so no corner bell) — this
    // interval is the route's only background delivery of new notifications
    // now that the notifications service no longer self-polls every 5s.
    refetchInterval: 30 * 1000,
    enabled: typeof window !== 'undefined' && !!localStorage.getItem("smartcliff_token"),
  })

  const markAsReadMutation = useMutation({
    mutationFn: (notificationId: string) => notificationsService.markAsRead(notificationId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: notificationKeys.all }),
  })

  const markAllAsReadMutation = useMutation({
    mutationFn: () => notificationsService.markAllAsRead(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: notificationKeys.all }),
  })

  // The account/profile menu now lives at the bottom of the course sidebar
  // (CourseSidebar.tsx) — this bar only keeps the page-action icons.
  useEffect(() => {
    try {
      const saved = localStorage.getItem('theme') as 'light' | 'dark'
      const sys = window.matchMedia('(prefers-color-scheme: dark)').matches
      const t = saved || (sys ? 'dark' : 'light')
      if (t === 'dark') document.documentElement.classList.add('dark')
      else document.documentElement.classList.remove('dark')
    } catch { }
  }, [])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (notificationRef.current && !notificationRef.current.contains(e.target as Node)) setShowNotificationsDropdown(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const notifications = notificationsData?.notifications || []
  const unreadCount = notificationsData?.unreadCount || 0

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '0 20px', height: 48,
      background: T.bg, flexShrink: 0,
      position: 'relative', borderBottom: `1px solid ${T.border}`
    }}>

      {/* Left slot: the pedagogy tabs live in this same 48px row (tabs left,
          action icons right). Stretch so the active underline sits on the
          bar's own bottom border. */}
      <div style={{ flex: 1, minWidth: 0, alignSelf: 'stretch', display: 'flex', alignItems: 'stretch' }}>
        {tabs}
      </div>

      {/* Icon Action Group */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>

        {/* Hide Header */}
        {onHideHeader && (
          <button
            onClick={onHideHeader}
            title="Hide header"
            style={{
              width: 38, height: 38, borderRadius: 9, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: 'none', background: 'transparent',
              color: '#64748b', cursor: 'pointer', transition: 'all .15s',
            }}
            onMouseEnter={e => {
              const el = e.currentTarget as HTMLElement
              el.style.background = '#f1f5f9'; el.style.color = '#ef4444'
            }}
            onMouseLeave={e => {
              const el = e.currentTarget as HTMLElement
              el.style.background = 'transparent'; el.style.color = '#64748b'
            }}
          >
            {/* Phosphor EyeSlash — cleaner slash style */}
            <EyeSlash size={18} weight="regular" />
          </button>
        )}

        {/* Notes */}
        <button
          onClick={() => {
            if (!onNotesClick || notesLoading) return
            setNotesLoading(true)
            onNotesClick()
            const timer = setTimeout(() => setNotesLoading(false), 1200)
            return () => clearTimeout(timer)
          }}
          title="Notes"
          style={{
            width: 38, height: 38, borderRadius: 9, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: 'none', background: 'transparent',
            color: '#64748b', cursor: 'pointer', transition: 'all .15s',
          }}
          onMouseEnter={e => {
            const el = e.currentTarget as HTMLElement
            el.style.background = '#f1f5f9'; el.style.color = '#1e293b'
          }}
          onMouseLeave={e => {
            const el = e.currentTarget as HTMLElement
            el.style.background = 'transparent'; el.style.color = '#64748b'
          }}
        >
          {notesLoading
            ? (
              /* Phosphor CircleNotch spins cleanly */
              <CircleNotch size={18} weight="bold" style={{ animation: 'spin 0.7s linear infinite' }} />
            ) : (
              /* Phosphor FileText — slightly richer than lucide's version */
              <FileText size={18} weight="regular" />
            )
          }
        </button>

        {/* Notifications */}
        <div ref={notificationRef} style={{ position: 'relative' }}>
          <button
            onClick={() => setShowNotificationsDropdown(!showNotificationsDropdown)}
            title="Notifications"
            style={{
              position: 'relative', width: 38, height: 38, borderRadius: 9,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: 'none',
              background: showNotificationsDropdown ? '#f1f5f9' : 'transparent',
              color: showNotificationsDropdown ? '#1e293b' : '#64748b',
              cursor: 'pointer', transition: 'all .15s',
            }}
            onMouseEnter={e => {
              if (!showNotificationsDropdown) {
                const el = e.currentTarget as HTMLElement
                el.style.background = '#f1f5f9'; el.style.color = '#1e293b'
              }
            }}
            onMouseLeave={e => {
              if (!showNotificationsDropdown) {
                const el = e.currentTarget as HTMLElement
                el.style.background = 'transparent'; el.style.color = '#64748b'
              }
            }}
          >
            {/* Phosphor Bell — available in "duotone" weight for a premium feel when active */}
            <Bell
              size={18}
              weight={showNotificationsDropdown ? 'duotone' : 'regular'}
            />
            {unreadCount > 0 && (
              <span style={{
                position: 'absolute', top: -2, right: -2,
                height: 16, minWidth: 16,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                borderRadius: 9999, background: '#ef4444',
                color: '#fff', fontSize: '10.5px', fontWeight: 'bold', padding: '0 3px',
                border: '1.5px solid #fff',
              }}>
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {/* Notifications Dropdown */}
          {showNotificationsDropdown && (
            <>
              <div style={{ position: 'fixed', inset: 0, zIndex: 10 }} onClick={() => setShowNotificationsDropdown(false)} />
              <div style={{
                position: 'absolute', right: 0, top: 'calc(100% + 8px)',
                width: 320, borderRadius: 12, background: T.bg,
                border: `1px solid ${T.line}`,
                boxShadow: '0 10px 30px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)',
                zIndex: 11, overflow: 'hidden', animation: 'fadeIn .15s ease both',
              }}>
                {/* Header */}
                <div style={{
                  padding: '10px 14px', borderBottom: `1px solid ${T.line}`,
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                  <div>
                    <h3 style={{ fontSize: '14.5px', fontWeight: 700, color: T.textMain }}>Notifications</h3>
                    {unreadCount > 0 && (
                      <p style={{ fontSize: '11.5px', color: T.textMuted, marginTop: 2 }}>{unreadCount} unread</p>
                    )}
                  </div>
                  {unreadCount > 0 && (
                    <button
                      onClick={() => markAllAsReadMutation.mutate()}
                      style={{
                        fontSize: '11.5px', fontWeight: 600, color: '#F97316',
                        background: 'transparent', border: 'none', cursor: 'pointer',
                      }}
                    >
                      Mark all read
                    </button>
                  )}
                </div>

                {/* List */}
                <div style={{ maxHeight: 320, overflowY: 'auto' }}>
                  {notifications.length === 0 ? (
                    <div style={{ padding: '30px 20px', textAlign: 'center' }}>
                      {/* Phosphor Bell with duotone weight for empty state */}
                      <Bell size={24} weight="duotone" style={{ color: T.textMuted, opacity: 0.4, marginBottom: 8 }} />
                      <p style={{ fontSize: '12.5px', color: T.textMuted }}>No notifications</p>
                    </div>
                  ) : (
                    notifications.map((n) => (
                      <div
                        key={n._id}
                        onClick={() => markAsReadMutation.mutate(n._id)}
                        style={{
                          padding: '10px 14px', borderBottom: `1px solid ${T.line}`,
                          cursor: 'pointer', transition: 'background .12s',
                          background: !n.isRead ? 'rgba(249,115,22,0.04)' : 'transparent',
                          display: 'flex', gap: 10,
                        }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = T.pageBg }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = !n.isRead ? 'rgba(249,115,22,0.04)' : 'transparent' }}
                      >
                        <div style={{
                          width: 6, height: 6, borderRadius: '50%',
                          background: !n.isRead ? '#F97316' : '#cbd5e1',
                          marginTop: 6, flexShrink: 0,
                        }} />
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <p style={{
                            fontSize: '12.5px', fontWeight: !n.isRead ? 700 : 500,
                            color: !n.isRead ? T.textMain : T.textSub, marginBottom: 2,
                          }}>
                            {n.title}
                          </p>
                          <p style={{ fontSize: '11.5px', color: T.textMuted, lineHeight: 1.4 }}>
                            {n.message}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          )}
        </div>{/* end notifications */}
      </div>{/* end icon action group */}

      {/* Animations */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}