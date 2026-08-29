"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import ReactDOM from "react-dom";
import { useRouter } from "next/navigation";
import { useSectionHref } from "@/lib/sectionRoute";
import {
  Bell,
  Inbox,
  CheckCircle2,
  MessageSquare,
  ShieldAlert,
  FileText,
  IndianRupee,
  BookOpen,
  Megaphone,
  Info,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { notificationsService, notificationKeys, type Notification } from "@/apiServices/notifications";

// Header notification bell — surfaces the EXISTING notification system
// (same `notificationsService` data used by the sidebar/TopBar). Do not
// add a second polling / storage / websocket path here.

// ── Time helpers ─────────────────────────────────────────────────────────
const MS_HOUR = 60 * 60 * 1000;
const MS_DAY = 24 * MS_HOUR;

function formatWhen(iso: string): string {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diff = Date.now() - then;
  if (diff < 60_000) return "just now";
  if (diff < MS_HOUR) return `${Math.floor(diff / 60_000)} min`;
  if (diff < MS_DAY) return `${Math.floor(diff / MS_HOUR)} hr`;
  if (diff < 2 * MS_DAY) return "Yesterday";
  const days = Math.floor(diff / MS_DAY);
  if (days < 7) return `${days} d`;
  try {
    return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
  } catch { return ""; }
}

function isToday(iso: string): boolean {
  if (!iso) return false;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return false;
  return Date.now() - then < MS_DAY;
}

// ── Icon / tint variant per notification ─────────────────────────────────
// Tangerine-first: neutral notifications ride the brand tone. Semantic
// statuses (success = green, error = red) stay their own color so the
// meaning survives the theme.
type IconVariant = {
  Icon: React.ComponentType<{ size?: number; color?: string }>;
  bg: string;
  fg: string;
};

const readMeta = (n: Notification): Record<string, any> => {
  const m: any = n.metadata;
  if (!m) return {};
  if (m instanceof Map) return Object.fromEntries(m);
  return typeof m === "object" ? m : {};
};

// Palette (matches the app's tangerine re-theme; see MEMORY).
const ACCENT = "#F97316";
const ACCENT_STRONG = "#C2410C";
const ACCENT_ACTIVE = "#EA580C";
const ACCENT_HOVER = "#9A3412";
const ACCENT_SOFT = "#FFF7ED";
const ACCENT_BORDER = "#FED7AA";
const UNREAD_BG = "#FFFBF8";
const TEXT_STRONG = "#111827";
const TEXT_MUTED = "#64748B";
const TEXT_LABEL = "#4B5563";
const TEXT_INACTIVE = "#475569";
const BORDER = "#E5E7EB";

function iconFor(n: Notification): IconVariant {
  const meta = readMeta(n);
  const kind = String(meta.kind || "").toLowerCase();
  const title = (n.title || "").toLowerCase();
  const rel = n.relatedEntity;
  const type = n.type;

  // Semantic statuses keep their meaning color.
  if (type === "success" || rel === "assignment")
    return { Icon: CheckCircle2, bg: "#DCFCE7", fg: "#16A34A" };
  if (type === "error")
    return { Icon: ShieldAlert, bg: "#FEE2E2", fg: "#DC2626" };

  // Highest-priority: explicit intent from server metadata / title.
  if (kind === "payment" || title.includes("payment"))
    return { Icon: IndianRupee, bg: "#DCFCE7", fg: "#16A34A" };
  if (kind === "comment" || title.includes("comment") || title.includes("mention"))
    return { Icon: MessageSquare, bg: ACCENT_SOFT, fg: ACCENT_ACTIVE };
  if (kind === "security" || type === "warning" || title.includes("sign-in") || title.includes("security"))
    return { Icon: ShieldAlert, bg: ACCENT_SOFT, fg: ACCENT_ACTIVE };
  if (kind === "report" || title.includes("report"))
    return { Icon: FileText, bg: ACCENT_SOFT, fg: ACCENT_ACTIVE };

  switch (rel) {
    case "enrollment":
    case "course":
      return { Icon: BookOpen, bg: ACCENT_SOFT, fg: ACCENT_ACTIVE };
    case "announcement":
      return { Icon: Megaphone, bg: ACCENT_SOFT, fg: ACCENT_ACTIVE };
    default: break;
  }
  if (type === "info") return { Icon: Info, bg: ACCENT_SOFT, fg: ACCENT_ACTIVE };

  return { Icon: Bell, bg: ACCENT_SOFT, fg: ACCENT_ACTIVE };
}

// One-time stylesheet the portal uses for hover / focus / animation /
// scrollbar. Kept scoped by class prefix so it can't collide.
const PANEL_STYLE_ID = "nbp-style-v2";
function ensurePanelStyle() {
  if (typeof document === "undefined") return;
  if (document.getElementById(PANEL_STYLE_ID)) return;
  const s = document.createElement("style");
  s.id = PANEL_STYLE_ID;
  s.textContent = `
    .nbp-row { transition: background-color 120ms ease; }
    .nbp-row:hover { background-color: #F8FAFC; }
    .nbp-row.nbp-unread:hover { background-color: #FFF4EB; }
    .nbp-row:focus-visible { outline: 2px solid ${ACCENT}; outline-offset: -2px; }
    .nbp-link { transition: color 120ms ease, background-color 120ms ease; }
    .nbp-link:hover { color: ${ACCENT_HOVER}; }
    .nbp-link:focus-visible { outline: 2px solid ${ACCENT}; outline-offset: 2px; border-radius: 4px; }
    .nbp-tab { transition: color 120ms ease, background-color 120ms ease; }
    .nbp-tab:hover { color: ${ACCENT_STRONG}; }
    .nbp-tab:focus-visible { outline: 2px solid ${ACCENT}; outline-offset: -2px; }
    .nbp-bell:focus-visible { outline: 2px solid ${ACCENT}; outline-offset: 2px; }
    .nbp-footer-link { transition: background-color 120ms ease, color 120ms ease; }
    .nbp-footer-link:hover { background-color: ${ACCENT_SOFT}; color: ${ACCENT_HOVER}; }
    .nbp-scroll { scrollbar-width: thin; scrollbar-color: #CBD5E1 transparent; }
    .nbp-scroll::-webkit-scrollbar { width: 6px; }
    .nbp-scroll::-webkit-scrollbar-track { background: transparent; }
    .nbp-scroll::-webkit-scrollbar-thumb { background: #CBD5E1; border-radius: 3px; }
    .nbp-scroll::-webkit-scrollbar-thumb:hover { background: #94A3B8; }
    @keyframes nbp-in { from { opacity: 0; transform: scale(0.97); } to { opacity: 1; transform: scale(1); } }
    .nbp-anim { animation: nbp-in 140ms ease-out; transform-origin: top right; }
    @media (prefers-reduced-motion: reduce) { .nbp-anim { animation: none; } }
    .nbp-truncate { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  `;
  document.head.appendChild(s);
}

// ── Component ────────────────────────────────────────────────────────────
export const NotificationBell: React.FC = () => {
  const qc = useQueryClient();
  const router = useRouter();
  const sectionHref = useSectionHref();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"all" | "unread">("all");
  const btnRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);

  useEffect(() => { ensurePanelStyle(); }, []);

  const { data } = useQuery({
    queryKey: notificationKeys.all,
    queryFn: () => notificationsService.fetchNotifications(),
    refetchOnWindowFocus: true,
    staleTime: 30 * 1000,
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

  const grouped = useMemo(() => {
    const src = tab === "unread" ? notifications.filter(n => !n.isRead) : notifications;
    const capped = src.slice(0, 20);
    const today: Notification[] = [];
    const earlier: Notification[] = [];
    capped.forEach(n => (isToday(n.createdAt) ? today : earlier).push(n));
    return { today, earlier, empty: capped.length === 0 };
  }, [notifications, tab]);

  const handleNotifClick = (n: Notification) => {
    if (!n.isRead) markRead.mutate(n._id);
    const m = readMeta(n);

    const redirectUrl = typeof m.redirectUrl === "string" ? m.redirectUrl : "";
    if (redirectUrl) {
      setOpen(false);
      router.push(redirectUrl);
      return;
    }
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
      router.push(`${sectionHref("manageUsers")}?${q}`);
    }
  };

  // Position + outside-click + Escape close (with focus return).
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
      if (
        btnRef.current && !btnRef.current.contains(t) &&
        !t.closest?.(".nbp-panel")
      ) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        requestAnimationFrame(() => btnRef.current?.focus());
      }
    };
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const [vw, setVw] = useState<number>(typeof window !== "undefined" ? window.innerWidth : 1440);
  useEffect(() => {
    const onResize = () => setVw(window.innerWidth);
    if (typeof window !== "undefined") {
      window.addEventListener("resize", onResize);
      return () => window.removeEventListener("resize", onResize);
    }
  }, []);
  const isNarrow = vw < 440;
  const panelWidth = isNarrow ? Math.max(0, vw - 24) : 400;
  const clampedRight = pos
    ? isNarrow ? 12 : Math.min(pos.right, Math.max(12, vw - (panelWidth + 12)))
    : 0;

  const bellBtnStyle: React.CSSProperties = {
    position: "relative",
    width: 38, height: 38, borderRadius: "50%",
    border: `1px solid ${open ? ACCENT_BORDER : "#e8e4eb"}`,
    background: open ? ACCENT_SOFT : "#fff",
    display: "flex", alignItems: "center", justifyContent: "center",
    cursor: "pointer", color: open ? ACCENT_ACTIVE : "#475569", flexShrink: 0,
  };

  return (
    <>
      <button
        ref={btnRef}
        className="nbp-bell"
        onClick={() => setOpen(o => !o)}
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
        aria-haspopup="dialog"
        aria-expanded={open}
        title="Notifications"
        style={bellBtnStyle}
      >
        <Bell size={17} />
        {unread > 0 && (
          <span
            aria-hidden="true"
            style={{
              position: "absolute", top: -2, right: -2,
              minWidth: 16, height: 16, padding: "0 4px",
              borderRadius: 999, background: ACCENT_STRONG, color: "#fff",
              fontSize: 10, fontWeight: 700, lineHeight: 1,
              display: "flex", alignItems: "center", justifyContent: "center",
              border: "2px solid #fff",
            }}
          >
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && pos && typeof document !== "undefined" && ReactDOM.createPortal(
        <div
          className="nbp-panel nbp-anim"
          role="dialog"
          aria-modal="false"
          aria-label="Notifications"
          style={{
            position: "fixed", top: pos.top, right: clampedRight,
            width: panelWidth, maxWidth: "calc(100vw - 24px)",
            maxHeight: "min(500px, calc(100vh - 88px))",
            background: "#fff",
            border: `1px solid ${BORDER}`, borderRadius: 14,
            boxShadow: "0 12px 32px rgba(15, 23, 42, 0.12)",
            overflow: "hidden", zIndex: 100000,
            display: "flex", flexDirection: "column",
            // Inherit the LMS font stack — do not pin our own family.
          }}
        >
          {/* ── Header ────────────────────────────────────────────────── */}
          <div
            style={{
              padding: "0 16px", height: 56, flexShrink: 0,
              display: "flex", alignItems: "center", justifyContent: "space-between",
              gap: 12,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{
                fontSize: "18px",
                fontWeight: 600,
                lineHeight: "24px",
                fontFamily: "inherit",
                letterSpacing: "normal",
                margin: 0,
                color: TEXT_STRONG,
              }}>
                Notifications
              </span>
              {unread > 0 && (
                <span
                  aria-hidden="true"
                  style={{
                    minWidth: 18, height: 18, padding: "0 5px",
                    borderRadius: 999, background: ACCENT_STRONG, color: "#fff",
                    fontSize: 11, fontWeight: 600, lineHeight: 1,
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                  }}
                >
                  {unread > 99 ? "99+" : unread}
                </span>
              )}
            </div>
            {unread > 0 && (
              <button
                type="button"
                className="nbp-link"
                onClick={() => markAll.mutate()}
                disabled={markAll.isPending}
                style={{
                  fontSize: 13, fontWeight: 500, color: ACCENT_STRONG,
                  background: "transparent", border: "none",
                  cursor: markAll.isPending ? "wait" : "pointer",
                  padding: "4px 2px", fontFamily: "inherit",
                }}
              >
                Mark all as read
              </button>
            )}
          </div>

          {/* ── Tabs ─────────────────────────────────────────────────── */}
          <div
            role="tablist"
            aria-label="Notification filters"
            style={{
              display: "flex", height: 40, flexShrink: 0,
              borderBottom: `1px solid ${BORDER}`, padding: "0 12px",
              background: "#fff",
            }}
          >
            {(["all", "unread"] as const).map(t => {
              const active = tab === t;
              return (
                <button
                  key={t}
                  role="tab"
                  aria-selected={active}
                  tabIndex={active ? 0 : -1}
                  className="nbp-tab"
                  onClick={() => setTab(t)}
                  onKeyDown={(e) => {
                    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
                      e.preventDefault();
                      setTab(t === "all" ? "unread" : "all");
                    }
                  }}
                  style={{
                    flex: 1,
                    background: "transparent",
                    border: "none",
                    color: active ? ACCENT_STRONG : TEXT_INACTIVE,
                    fontSize: 13, fontWeight: 500, cursor: "pointer",
                    position: "relative", height: "100%",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontFamily: "inherit",
                  }}
                >
                  {t === "all" ? "All" : "Unread"}
                  {active && (
                    <span
                      aria-hidden="true"
                      style={{
                        position: "absolute", left: 10, right: 10, bottom: -1,
                        height: 2, background: ACCENT, borderRadius: 2,
                      }}
                    />
                  )}
                </button>
              );
            })}
          </div>

          {/* ── Scroll area ──────────────────────────────────────────── */}
          <div className="nbp-scroll" style={{ overflowY: "auto", flex: 1, minHeight: 0 }}>
            {grouped.empty ? (
              <div style={{
                padding: "40px 24px", textAlign: "center", color: "#94A3B8",
              }}>
                <Inbox size={24} style={{ margin: "0 auto 10px", display: "block" }} />
                <div style={{ fontSize: 13, fontWeight: 500, color: "#64748B" }}>
                  {tab === "unread" ? "You're all caught up" : "No notifications yet"}
                </div>
              </div>
            ) : (
              <>
                {grouped.today.length > 0 && <SectionLabel>Today</SectionLabel>}
                {grouped.today.map(n => (
                  <NotificationRow key={n._id} n={n} onClick={handleNotifClick} />
                ))}
                {grouped.earlier.length > 0 && <SectionLabel>Earlier</SectionLabel>}
                {grouped.earlier.map(n => (
                  <NotificationRow key={n._id} n={n} onClick={handleNotifClick} />
                ))}
              </>
            )}
          </div>

          {/* ── Footer ───────────────────────────────────────────────── */}
          <div
            style={{
              height: 44, borderTop: `1px solid ${BORDER}`,
              display: "flex", alignItems: "stretch", flexShrink: 0,
            }}
          >
            <button
              type="button"
              className="nbp-footer-link nbp-link"
              onClick={() => {
                setOpen(false);
                router.push("/lms/pages/notifications");
              }}
              style={{
                flex: 1, background: "transparent", border: "none", cursor: "pointer",
                fontSize: 13, fontWeight: 500, color: ACCENT_STRONG,
                display: "flex", alignItems: "center", justifyContent: "center",
                gap: 6, fontFamily: "inherit",
              }}
            >
              View all notifications
              <span aria-hidden="true">→</span>
            </button>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      height: 30, padding: "0 12px",
      fontSize: 12, fontWeight: 600, color: TEXT_LABEL,
      lineHeight: "30px", letterSpacing: "0.02em",
      background: "#FAFAFA",
      borderBottom: `1px solid ${BORDER}`,
    }}>
      {children}
    </div>
  );
}

function NotificationRow({ n, onClick }: { n: Notification; onClick: (n: Notification) => void }) {
  const variant = iconFor(n);
  const { Icon } = variant;
  const unreadClass = n.isRead ? "" : "nbp-unread";
  return (
    <button
      type="button"
      className={`nbp-row ${unreadClass}`}
      onClick={() => onClick(n)}
      style={{
        display: "flex", width: "100%", textAlign: "left",
        padding: "8px 12px", gap: 10,
        alignItems: "flex-start",
        background: n.isRead ? "#FFFFFF" : UNREAD_BG,
        border: "none", borderBottom: `1px solid ${BORDER}`,
        cursor: "pointer", minHeight: 68,
        fontFamily: "inherit",
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 36, height: 36, borderRadius: "50%",
          background: variant.bg, color: variant.fg,
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0, marginTop: 1,
        }}
      >
        <Icon size={18} color={variant.fg} />
      </span>

      <div style={{
        flex: 1, minWidth: 0,
        display: "flex", flexDirection: "column", gap: 1,
      }}>
        <div style={{
          display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8,
        }}>
          <span
            className="nbp-truncate"
            style={{
              fontSize: 14, fontWeight: 600, color: TEXT_STRONG, lineHeight: "18px",
              flex: 1, minWidth: 0,
            }}
          >
            {n.title || "Notification"}
          </span>
          <span style={{
            fontSize: 11, fontWeight: 400, color: TEXT_MUTED, flexShrink: 0,
            whiteSpace: "nowrap", lineHeight: "18px",
          }}>
            {formatWhen(n.createdAt)}
          </span>
        </div>
        <span
          className="nbp-truncate"
          style={{
            fontSize: 12, fontWeight: 400, color: TEXT_MUTED, lineHeight: "17px",
          }}
        >
          {n.message}
        </span>
      </div>

      <span
        aria-label={n.isRead ? undefined : "Unread"}
        style={{
          width: 7, height: 7, borderRadius: "50%", marginTop: 6,
          background: n.isRead ? "transparent" : ACCENT,
          flexShrink: 0,
        }}
      />
    </button>
  );
}

export default NotificationBell;
