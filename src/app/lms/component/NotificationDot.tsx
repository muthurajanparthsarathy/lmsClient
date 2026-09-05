"use client";

import { useQuery } from "@tanstack/react-query";
import { notificationsService, notificationKeys } from "@/app/lms/pages/notifications/api/notifications";

// A small blinking red dot that surfaces the unread-notification count in the
// sidebar. Same data source as the former NotificationBell (30 s refresh), so
// there's no new machinery — just a tiny mount point that renders a pulse when
// unread > 0 and nothing when the inbox is clear.
export function NotificationDot() {
  const { data } = useQuery({
    queryKey: notificationKeys.all,
    queryFn: () => notificationsService.fetchNotifications(),
    refetchOnWindowFocus: true,
    staleTime: 30 * 1000,
    refetchInterval: 30 * 1000,
  });
  const unread = data?.unreadCount || 0;
  if (unread <= 0) return null;
  return (
    <span
      className="relative ml-1 inline-flex h-2 w-2 shrink-0"
      title={`${unread} unread notification${unread === 1 ? "" : "s"}`}
      aria-label={`${unread} unread notifications`}
    >
      {/* Outer pulse ring — animate-ping fades and expands so the dot reads
          as "new activity" rather than a static badge. */}
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
      <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
    </span>
  );
}

export default NotificationDot;
