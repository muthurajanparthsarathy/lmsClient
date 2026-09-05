'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Bell,
  Trash2,
  Info,
  AlertCircle,
  CheckCheck,
  Eye,
  BookOpen,
  X,
  RefreshCw,
  CheckSquare,
  Star,
  Search,
  CheckCircle,
  Mail,
  AlertTriangle,
  MessageSquare,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { notificationsService, Notification, notificationKeys } from '@/app/lms/pages/notifications/api/notifications';
import { StudentLayout } from '@/app/lms/component/student/student-layout';
import DashboardLayout from '@/app/lms/component/layout';
import { StaffLayout } from '@/app/lms/component/stafflayout/staff-layout';
import { usePermissions } from '@/hooks/usePermissions';
import { PERMISSION_IDS } from '@/app/lms/pages/usermanagement/components/permissions/index';
import TableFooter from '@/app/lms/shared/listing/TableFooter';

// Notifications workspace — repainted onto the same design system as Client
// Management and Course Structure. All colours, spacing and control sizes
// come from the shared token set (`bg-surface`, `text-heading`, `text-body`,
// `text-subtle`, `text-faint`, `border-hairline[-strong]`, `bg-brand-strong`,
// `bg-brand-wash`, `hover:bg-row-hover`, `rounded-control|chip|tile`). The
// theme swap is handled by the shared ThemeProvider via those tokens — the
// old localStorage/matchMedia/100ms-interval scaffolding is gone, and so is
// the private Roboto declaration (Poppins is inherited from the root layout).
//
// User-facing changes: slim heading + HeaderStats chips · standard search
// (h-8 px-2 rounded-control) · secondary tool cluster (Refresh · Mark all ·
// Delete all — icon-and-label buttons in the same h-8 pill shape as CM) ·
// tab bar restyled to a token-driven underline row · notification rows are
// flat on the panel (no card chrome), rows split by a hairline · pagination
// via the shared TableFooter component — same one CM uses.

const getUserRole = (): string | null => {
  try {
    const roleValue = localStorage.getItem('smartcliff_roleValue');
    if (roleValue) return roleValue.toLowerCase();

    const userData = localStorage.getItem('smartcliff_userData');
    if (userData) {
      const user = JSON.parse(userData);
      if (typeof user.role === 'object' && user.role !== null) {
        return (user.role.roleValue || user.role.originalRole || user.role.renameRole || '').toLowerCase();
      } else if (typeof user.role === 'string') {
        return user.role.toLowerCase();
      }
    }

    return null;
  } catch {
    return null;
  }
};

export default function NotificationsPage() {
  const [userRole, setUserRole] = useState<string | null>(null);
  const [isRoleLoading, setIsRoleLoading] = useState(true);

  // Notification is page-level only in the tree — anyone who has the page
  // in any of the three scoped ids can edit. Sub-functions were retired.
  const { can } = usePermissions();
  const canEdit =
    can(PERMISSION_IDS.ADMIN_NOTIFICATION) ||
    can(PERMISSION_IDS.STAFF_NOTIFICATION) ||
    can(PERMISSION_IDS.STUDENT_NOTIFICATION);

  const [activeFilter, setActiveFilter] = useState('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  // The search runs on the SERVER now, so it has to be debounced — otherwise
  // every keystroke is a request.
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery), 400);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const queryClient = useQueryClient();
  const router = useRouter();

  // Page-by-page pagination via React Query — one page per request, swapped
  // in place; keepPreviousData holds the previous rows so the list never
  // flashes empty between page clicks.
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // Auto-fit page size to the visible panel — same behaviour as Client
  // Management / Course Structure. A ResizeObserver on the list container
  // measures the available height and picks the largest page size whose
  // rows all fit without an inner scroll bar, so the user can page through
  // the inbox instead of scrolling one long list. Turns off the moment
  // the user picks a page size manually — respect their choice.
  const listCardRef = useRef<HTMLDivElement | null>(null);
  const [autoFitPageSize, setAutoFitPageSize] = useState(true);
  useEffect(() => {
    if (!autoFitPageSize) return;
    const el = listCardRef.current;
    if (!el) return;
    // Row height matches the notification row (py-2.5 + inner chip/icon).
    // FOOTER_H matches the shared TableFooter's rendered height. SAFETY
    // subtracts half a row so the last row never lands right at the
    // pagination border and clip (the parent is overflow-hidden — no
    // scrollbar surfaces the missing row).
    const HEADER_H = 0;
    const FOOTER_H = 44;
    const ROW_H = 44;
    const SAFETY = Math.round(ROW_H / 2);
    const compute = () => {
      const budget = Math.max(0, el.clientHeight - HEADER_H - FOOTER_H - SAFETY);
      const fits = Math.max(3, Math.min(50, Math.floor(budget / ROW_H)));
      setPageSize((prev) => (prev === fits ? prev : fits));
    };
    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(el);
    return () => ro.disconnect();
  }, [autoFitPageSize]);

  // Changing the filter or the search returns to page 1 (still-in-render so
  // the request that fires uses the reset page instead of the old one).
  const filterKey = `${activeFilter}::${debouncedSearch}`;
  const [lastFilterKey, setLastFilterKey] = useState(filterKey);
  if (lastFilterKey !== filterKey) {
    setLastFilterKey(filterKey);
    setCurrentPage(1);
  }

  const {
    data: pageData,
    isLoading,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: notificationKeys.list({ filter: activeFilter, search: debouncedSearch, page: currentPage, limit: pageSize }),
    queryFn: () =>
      notificationsService.fetchNotificationsPage({
        page: currentPage,
        limit: pageSize,
        filter: activeFilter,
        search: debouncedSearch,
      }),
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: true,
    enabled: !!userRole,
    placeholderData: keepPreviousData,
  });

  const notificationsData = useMemo(
    () => ({
      notifications: pageData?.notifications ?? [],
      unreadCount: pageData?.unreadCount ?? 0,
      totalCount: pageData?.totalCount ?? 0,
      totalPages: pageData?.totalPages ?? 1,
    }),
    [pageData],
  );

  const totalPages = notificationsData.totalPages;
  const totalCount = notificationsData.totalCount;
  const safePage = Math.min(currentPage, totalPages || 1);
  const rangeFrom = totalCount === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const rangeTo = Math.min(safePage * pageSize, totalCount);

  useEffect(() => {
    const initializeRole = () => {
      const role = getUserRole();
      setUserRole(role);
      setIsRoleLoading(false);
    };

    initializeRole();

    const handleStorageChange = () => {
      const newRole = getUserRole();
      setUserRole(newRole);
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  useEffect(() => {
    if (userRole) {
      notificationsService.setPollingEnabled(true);
    }
    return () => notificationsService.setPollingEnabled(false);
  }, [userRole]);

  useEffect(() => {
    // The service dispatches 'notificationsUpdated' (this listener was
    // registered under 'notificationsUpdate' and never fired). It became
    // load-bearing once fetchNotifications started returning immutable
    // snapshots: without it, the 5s poll this page arms would toast a new
    // notification while the rendered list stayed frozen until the next
    // refetch. Note: no toast here — the service's poll already toasts each
    // new notification itself; a second one would be a duplicate.
    const handleNotificationsUpdate = (event: CustomEvent) => {
      queryClient.setQueryData(notificationKeys.all, {
        notifications: event.detail.notifications,
        unreadCount: event.detail.unreadCount,
        totalCount: event.detail.notifications.length,
        lastUpdated: Date.now(),
        version: event.detail.version,
      });
    };

    window.addEventListener('notificationsUpdated', handleNotificationsUpdate as EventListener);
    return () => {
      window.removeEventListener('notificationsUpdated', handleNotificationsUpdate as EventListener);
    };
  }, [queryClient]);

  const markAsReadMutation = useMutation({
    mutationFn: (notificationId: string) => notificationsService.markAsRead(notificationId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: notificationKeys.all }),
  });

  const toggleFavoriteMutation = useMutation({
    mutationFn: (notificationId: string) => notificationsService.toggleFavorite(notificationId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
      const isFav = data?.data?.isFavorite ?? false;
      toast.success(isFav ? 'Added to favorites' : 'Removed from favorites', {
        icon: isFav ? '⭐' : '🗑️',
        duration: 1500,
      });
    },
    onError: () => toast.error('Failed to update favorite status'),
  });

  const deleteNotificationMutation = useMutation({
    mutationFn: (notificationId: string) => notificationsService.deleteNotification(notificationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
      toast.success('Deleted');
    },
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: () => notificationsService.markAllAsRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
      toast.success('All marked as read');
    },
  });

  const deleteAllNotificationsMutation = useMutation({
    mutationFn: () => notificationsService.deleteAllNotifications(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
      toast.success('Inbox cleared');
    },
  });

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.isRead) {
      markAsReadMutation.mutate(notification._id);
    }
    // If the sender attached a redirectUrl (approval-reject notifications do,
    // pointing to the exact assessment row with `highlightExerciseId`), open
    // it in the same tab. Fall back to expand-in-place for older items.
    const meta: any = notification.metadata || {};
    const redirectUrl: string | null =
      meta?.redirectUrl || (meta instanceof Map ? meta.get?.('redirectUrl') : null) || null;
    if (redirectUrl && typeof redirectUrl === 'string') {
      router.push(redirectUrl);
      return;
    }
    setExpandedId(expandedId === notification._id ? null : notification._id);
  };

  const filteredNotifications = notificationsData.notifications;
  const unreadCount = notificationsData?.unreadCount || 0;

  const formatEmailDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    if (isToday) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const getIconForType = (type: string, entity: string) => {
    if (entity === 'course') return <BookOpen className="h-3.5 w-3.5 text-brand-strong" />;
    if (entity === 'assignment') return <CheckCircle className="h-3.5 w-3.5 text-success-700" />;
    if (entity === 'message') return <MessageSquare className="h-3.5 w-3.5 text-info-700" />;
    if (type === 'error') return <AlertCircle className="h-3.5 w-3.5 text-danger-600" />;
    if (type === 'warning') return <AlertTriangle className="h-3.5 w-3.5 text-warn-600" />;
    return <Info className="h-3.5 w-3.5 text-subtle" />;
  };

  // Entity/type → chip palette. Uses the app's semantic tone tokens so the
  // dark theme is handled without a manual swap.
  const getTypeChip = (type: string, entity: string) => {
    if (entity === 'course') return 'bg-brand-wash text-brand-strong ring-brand-500/25';
    if (entity === 'assignment') return 'bg-success-50 text-success-700 ring-success-500/20';
    if (entity === 'message') return 'bg-info-50 text-info-700 ring-info-500/20';
    if (type === 'error') return 'bg-danger-50 text-danger-700 ring-danger-500/20';
    if (type === 'warning') return 'bg-warn-50 text-warn-700 ring-warn-500/20';
    return 'bg-ink-100 text-ink-700 ring-ink-500/15';
  };

  const pageContent = (
    <div className="flex flex-col h-full min-h-0 min-w-0 px-4 sm:px-6 md:px-8 pt-3 pb-3">
      {/* Slim heading — matches Client Management / Course Structure.
          Total / Unread chip strip removed; the count already surfaces in
          the pagination footer, and the Unread tab carries its own badge. */}
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-base sm:text-lg font-semibold text-heading tracking-[-0.01em]">Notifications</h1>
      </div>

      {/* Toolbar — search on the left, secondary cluster on the right.
          Same h-8 pill shape, same rounded-control radius, same border /
          hover tokens as Client Management. */}
      <div className="mt-3 flex items-center gap-2 flex-wrap min-w-0">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-faint pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search notifications by title or message…"
            className="w-full h-8 pl-8 pr-8 rounded-control border border-hairline-strong bg-surface text-xs text-body placeholder:text-faint focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/15 transition-colors duration-150"
          />
          {searchQuery && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex size-5 items-center justify-center rounded-chip text-faint hover:bg-ink-100 hover:text-heading transition-colors duration-150"
            >
              <X size={12} />
            </button>
          )}
        </div>

        <div className="ml-auto flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isRefetching}
            title="Refresh notifications"
            className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-control border border-hairline-strong bg-surface text-xs font-medium text-body hover:bg-row-hover hover:text-heading transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefetching ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{isRefetching ? 'Refreshing…' : 'Refresh'}</span>
          </button>

          {canEdit && unreadCount > 0 && (
            <button
              type="button"
              onClick={() => markAllAsReadMutation.mutate()}
              disabled={markAllAsReadMutation.isPending}
              title="Mark all as read"
              className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-control border border-hairline-strong bg-surface text-xs font-medium text-body hover:bg-row-hover hover:text-heading transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">
                {markAllAsReadMutation.isPending ? 'Processing…' : 'Mark all read'}
              </span>
            </button>
          )}

          {canEdit && filteredNotifications.length > 0 && (
            <button
              type="button"
              onClick={() => {
                if (confirm('Delete all currently visible notifications?')) {
                  deleteAllNotificationsMutation.mutate();
                }
              }}
              disabled={deleteAllNotificationsMutation.isPending}
              title="Delete all notifications"
              className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-control border border-danger-500/30 bg-danger-50 text-xs font-semibold text-danger-700 hover:bg-danger-100 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">
                {deleteAllNotificationsMutation.isPending ? 'Deleting…' : 'Delete All'}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Filter tabs — token-driven underline row. Same h-8 rhythm as the
          toolbar above so the two rows read as one control block. The
          overflow-x fallback lets the row scroll on narrow viewports, but
          the scrollbar is hidden — `scrollbar-hide` used to live here but
          the utility isn't defined in this project, so the row showed a
          horizontal bar right under the tabs on some breakpoints. The
          arbitrary variants below suppress the bar in Chrome/Firefox
          without touching the scroll behaviour. */}
      <div className="mt-3 flex items-center gap-1 overflow-x-auto [&::-webkit-scrollbar]:hidden [scrollbar-width:none] border-b border-hairline flex-shrink-0">
        {[
          { id: 'all', label: 'All', icon: Bell },
          { id: 'unread', label: 'Unread', icon: Eye },
          { id: 'favorite', label: 'Favorites', icon: Star },
          { id: 'read', label: 'Read', icon: CheckSquare },
          { id: 'course', label: 'Courses', icon: BookOpen },
          { id: 'assignment', label: 'Assignments', icon: CheckCircle },
          { id: 'message', label: 'Messages', icon: MessageSquare },
          { id: 'system', label: 'System', icon: Info },
        ].map((tab) => {
          const active = activeFilter === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveFilter(tab.id)}
              className={`inline-flex items-center gap-1.5 h-8 px-3 -mb-px border-b-2 text-xs font-medium whitespace-nowrap transition-colors duration-150 ${
                active
                  ? 'border-brand text-brand-strong'
                  : 'border-transparent text-subtle hover:text-heading'
              }`}
            >
              <tab.icon className={`w-3.5 h-3.5 ${active ? 'text-brand-strong' : 'text-faint'}`} />
              {tab.label}
              {tab.id === 'unread' && unreadCount > 0 && (
                <span
                  className={`inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-2xs font-bold tabular-nums ${
                    active ? 'bg-brand-strong text-white' : 'bg-ink-100 text-ink-700'
                  }`}
                >
                  {unreadCount}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* List panel — no card chrome (matches CM/CS), rows separated by a
          single hairline. flex-1 min-h-0 flex-col so the scroll region
          flexes while the pagination footer keeps its natural height.
          The ref feeds the auto-fit page-size observer above — measuring
          THIS box tells the effect how many rows fit without scroll. */}
      <div ref={listCardRef} className="mt-2 flex flex-1 min-h-0 flex-col overflow-hidden">
        <div className="flex-1 min-h-0 overflow-y-auto">
          {isLoading ? (
            <div className="p-8 text-center text-subtle text-sm">Loading your inbox…</div>
          ) : filteredNotifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-subtle">
              <div className="h-14 w-14 rounded-full flex items-center justify-center mb-4 bg-ink-100">
                {searchQuery ? (
                  <Search className="h-6 w-6 text-faint" />
                ) : activeFilter === 'favorite' ? (
                  <Star className="h-6 w-6 text-brand-strong" />
                ) : (
                  <Mail className="h-6 w-6 text-faint" />
                )}
              </div>
              <p className="text-sm font-medium text-heading">
                {searchQuery
                  ? 'No results found'
                  : activeFilter === 'favorite'
                    ? 'No favorite notifications'
                    : activeFilter === 'read'
                      ? 'No read notifications'
                      : "You're all caught up!"}
              </p>
              <p className="text-xs text-subtle mt-1">
                {searchQuery ? 'Try different keywords or clear your search.' : 'No notifications in this tab.'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-hairline">
              {filteredNotifications.map((notification) => {
                const isExpanded = expandedId === notification._id;
                const isRead = notification.isRead;
                return (
                  <div
                    key={notification._id}
                    className={`group relative cursor-pointer transition-colors duration-150 ${
                      isExpanded ? 'bg-brand-wash' : 'bg-surface hover:bg-row-hover'
                    }`}
                    onClick={() => handleNotificationClick(notification)}
                  >
                    <div className="flex items-center px-4 py-2.5 gap-3">
                      {canEdit && (
                        <button
                          type="button"
                          className="flex-shrink-0 inline-flex items-center justify-center size-6 rounded-chip hover:bg-ink-100 transition-colors duration-150 z-20"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleFavoriteMutation.mutate(notification._id);
                          }}
                          title={notification.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                        >
                          <Star
                            className={`h-4 w-4 transition-colors duration-150 ${
                              notification.isFavorite ? 'text-brand-strong' : 'text-faint'
                            }`}
                            fill={notification.isFavorite ? 'currentColor' : 'none'}
                          />
                        </button>
                      )}

                      <div className="flex flex-1 items-center min-w-0 gap-3 overflow-hidden">
                        <div
                          className={`w-32 md:w-40 flex-shrink-0 inline-flex items-center gap-1.5 truncate px-2 py-0.5 rounded-chip text-2xs font-semibold ring-1 ring-inset ${getTypeChip(
                            notification.type,
                            notification.relatedEntity,
                          )}`}
                        >
                          {getIconForType(notification.type, notification.relatedEntity)}
                          <span className="truncate">
                            {notification.relatedEntity
                              ? notification.relatedEntity.charAt(0).toUpperCase() + notification.relatedEntity.slice(1)
                              : 'System'}
                          </span>
                        </div>

                        <div className="flex-1 truncate flex items-center text-xs min-w-0">
                          <span
                            className={`mr-2 truncate ${!isRead ? 'font-semibold text-heading' : 'text-body'}`}
                            title={notification.title}
                          >
                            {notification.title}
                          </span>
                          <span className="hidden sm:inline truncate text-subtle" title={notification.message}>
                            — {notification.message}
                          </span>
                        </div>
                      </div>

                      <div className="flex-shrink-0 flex items-center justify-end w-24 pl-2">
                        <div className="hidden group-hover:flex items-center gap-1 mr-2">
                          {canEdit && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteNotificationMutation.mutate(notification._id);
                              }}
                              className="inline-flex items-center justify-center size-6 rounded-chip text-faint hover:bg-danger-50 hover:text-danger-600 transition-colors duration-150"
                              title="Delete"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleNotificationClick(notification);
                            }}
                            className="inline-flex items-center justify-center size-6 rounded-chip text-faint hover:bg-brand-wash hover:text-brand-strong transition-colors duration-150"
                            title="View details"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        <span
                          className={`text-2xs group-hover:hidden ${
                            !isRead ? 'font-semibold text-brand-strong' : 'text-subtle'
                          }`}
                        >
                          {formatEmailDate(notification.createdAt)}
                        </span>
                      </div>
                    </div>

                    {isExpanded && (
                      <div
                        className="px-4 pb-4 pl-14 pr-4 border-t border-hairline bg-surface cursor-default"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="pt-4">
                          <div className="flex items-start justify-between mb-3">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="text-sm font-semibold text-heading">{notification.title}</h3>
                                {notification.isFavorite && (
                                  <span className="inline-flex h-5 items-center rounded-full px-2 text-2xs font-semibold bg-brand-wash text-brand-strong ring-1 ring-inset ring-brand-500/25">
                                    Favorite
                                  </span>
                                )}
                              </div>
                              <p className="text-2xs text-subtle mt-1">
                                From: <span className="font-medium text-body">System Admin</span>
                                <span className="mx-2 text-faint">•</span>
                                {new Date(notification.createdAt).toLocaleString()}
                              </p>
                            </div>
                          </div>

                          <div className="text-xs leading-relaxed whitespace-pre-wrap text-body">
                            {notification.message}
                          </div>

                          {notification.metadata && Object.keys(notification.metadata).length > 0 && (
                            <div className="mt-4 rounded-tile p-3 border border-hairline bg-canvas">
                              <h4 className="text-2xs font-semibold uppercase tracking-wider mb-2 text-subtle">
                                Technical Details
                              </h4>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-y-2 text-xs">
                                {Object.entries(notification.metadata).map(([key, value]) => (
                                  <div key={key} className="flex gap-2">
                                    <span className="font-medium min-w-[100px] text-subtle">{key}:</span>
                                    <span className="break-all text-body">{String(value)}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Pagination footer — shared TableFooter, same as CM / User Mgmt.
            Only rendered when the current filter has at least one row so
            the empty state stays clean. */}
        {!isLoading && totalCount > 0 && (
          <TableFooter
            from={rangeFrom}
            to={rangeTo}
            total={totalCount}
            pageSize={pageSize}
            onPageSize={(n) => {
              // Manual pick pins the size and stops the auto-fit observer
              // from overriding on the next resize — respect the choice.
              setAutoFitPageSize(false);
              setPageSize(n);
              setCurrentPage(1);
            }}
            currentPage={safePage}
            totalPages={totalPages || 1}
            onPage={(p) => setCurrentPage(p)}
          />
        )}
      </div>
    </div>
  );

  if (isRoleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-canvas">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-strong" />
      </div>
    );
  }

  if (userRole === 'admin' || userRole === 'ldhead' || userRole === 'subhead' || userRole === 'programcoordinator') {
    return <DashboardLayout>{pageContent}</DashboardLayout>;
  }

  if (userRole === 'student') {
    return <StudentLayout>{pageContent}</StudentLayout>;
  }

  // All other roles (faculty, staff, etc.) get StaffLayout.
  return <StaffLayout>{pageContent}</StaffLayout>;
}
