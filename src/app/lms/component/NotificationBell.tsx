"use client";

import React, { useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom";
import { useRouter } from "next/navigation";
import { useSectionHref } from "@/lib/sectionRoute";
import { Bell, CheckCheck, Inbox } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { notificationsService, notificationKeys, type Notification } from "@/apiServices/notifications";

// Reusable notification bell — surfaces the EXISTING notification system
// (same `notificationsService` data used by the navbar/TopBar). No new mechanism;
// this just renders the existing notifications where a header lacks the bell.

const timeAgo = (d: string): string => {
  if (!d) return "";
  const diff = Date.now() - new Date(d).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 7) return `${days}d ago`;
  try {
    return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
  } catch {
    return "";
  }
};

export const NotificationBell: React.FC = () => {
  const qc = useQueryClient();
  const router = useRouter();
  const sectionHref = useSectionHref();
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);

  const { data } = useQuery({
    queryKey: notificationKeys.all,
    queryFn: () => notificationsService.fetchNotifications(),
    refetchOnWindowFocus: true,
    staleTime: 30 * 1000,
    // Background freshness. Replaces the notifications service's old
    // self-starting 5s interval (12 req/min for the life of the tab whose
    // results this bell never rendered) with one visible refresh per 30s;
    // pauses automatically while the tab is hidden.
    refetchInterval: 30 * 1000,
  });

  const markRead = useMutation({
    mutationFn: (id: string) => notificationsService.markAsRead(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: notificationKeys.all }),
  });
  const markAll = useMutation({
    mutationFn: () => notificationsService.markAllAsRead(),
    onSuccess: () => qc.invalidateQueries({ queryKey: notificationKeys.all }),
  });

  const notifications: Notification[] = data?.notifications || [];
  const unread = data?.unreadCount || 0;

  // Clicking a retest-request notification → Manage Users page, Request List tab
  const handleNotifClick = (n: Notification) => {
    if (!n.isRead) markRead.mutate(n._id);
    const m: Record<string, any> = (n.metadata as any) || {};
    const isRetest =
      m.kind === "retest_request" ||
      !!m.requestId ||
      (n.title || "").toLowerCase().includes("retest");
    if (isRetest && m.courseId && m.exerciseId) {
      setOpen(false);
      const q = new URLSearchParams({
        courseId: String(m.courseId),
        exerciseId: String(m.exerciseId),
        assessmentName: String(m.exerciseName || ""),
        subcategory: String(m.subcategory || ""),
        nodeId: String(m.nodeId || ""),
        nodeType: String(m.nodeType || ""),
        tab: "requests",
      }).toString();
      // The bell rides along on both the Courses and the Course Structure copy
      // of the upload screen, so the retest request opens in whichever section
      // the user is already in.
      router.push(`${sectionHref("manageUsers")}?${q}`);
    }
  };

  useEffect(() => {
    if (!open) return;
    const update = () => {
      const el = btnRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setPos({ top: r.bottom + 8, right: window.innerWidth - r.right });
    };
    update();
    const close = (e: MouseEvent) => {
      const t = e.target as Element;
      if (btnRef.current && !btnRef.current.contains(t) && !t.closest?.(".notif-bell-pop")) {
        setOpen(false);
      }
    };
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    document.addEventListener("mousedown", close);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
      document.removeEventListener("mousedown", close);
    };
  }, [open]);

  return (
    <>
      <button
        ref={btnRef}
        onClick={() => setOpen(o => !o)}
        title="Notifications"
        style={{
          position: "relative", width: 38, height: 38, borderRadius: "50%",
          border: "1px solid #e8e4eb", background: open ? "#FFF4F1" : "#fff",
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer", color: "#475569", flexShrink: 0,
        }}
      >
        <Bell size={17} />
        {unread > 0 && (
          <span style={{
            position: "absolute", top: -2, right: -2, minWidth: 16, height: 16, padding: "0 4px",
            borderRadius: 999, background: "#ef4444", color: "#fff", fontSize: 9, fontWeight: 700,
            display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid #fff",
          }}>
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && pos && typeof document !== "undefined" && ReactDOM.createPortal(
        <div
          className="notif-bell-pop"
          style={{
            /* Clamp so the 360px panel never runs off the LEFT edge when the
               bell sits near it (e.g. on the L&D sidebar rail). */
            position: "fixed", top: pos.top, zIndex: 100000,
            right: Math.min(pos.right, Math.max(12, window.innerWidth - 372)),
            width: 360, maxWidth: "calc(100vw - 24px)", background: "#fff",
            border: "1px solid #e9eaf0", borderRadius: 14,
            boxShadow: "0 16px 44px rgba(0,0,0,0.16)", overflow: "hidden",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", borderBottom: "1px solid #f1f5f9" }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: "#1a1a2e" }}>Notifications</span>
            {unread > 0 && (
              <button
                onClick={() => markAll.mutate()}
                style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 600, color: "#F97316", background: "transparent", border: "none", cursor: "pointer" }}
              >
                <CheckCheck size={13} /> Mark all read
              </button>
            )}
          </div>
          <div style={{ maxHeight: 380, overflowY: "auto" }}>
            {notifications.length === 0 ? (
              <div style={{ padding: "32px 16px", textAlign: "center", color: "#94a3b8" }}>
                <Inbox size={22} style={{ margin: "0 auto 8px" }} />
                <div style={{ fontSize: 12.5 }}>No notifications yet</div>
              </div>
            ) : (
              notifications.slice(0, 20).map((n) => (
                <button
                  key={n._id}
                  onClick={() => handleNotifClick(n)}
                  style={{
                    display: "block", width: "100%", textAlign: "left", padding: "11px 14px",
                    border: "none", borderBottom: "1px solid #f5f6f8", cursor: "pointer",
                    background: n.isRead ? "#fff" : "#FFF7ED",
                  }}
                >
                  <div style={{ display: "flex", gap: 8 }}>
                    <span style={{ width: 7, height: 7, borderRadius: "50%", marginTop: 5, flexShrink: 0, background: n.isRead ? "transparent" : "#F97316" }} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 700, color: "#1a1a2e" }}>{n.title || "Notification"}</div>
                      <div style={{ fontSize: 12, color: "#64748b", marginTop: 2, lineHeight: 1.4 }}>{n.message}</div>
                      <div style={{ fontSize: 10.5, color: "#a0a6b3", marginTop: 4 }}>{timeAgo(n.createdAt)}</div>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  );
};

export default NotificationBell;
