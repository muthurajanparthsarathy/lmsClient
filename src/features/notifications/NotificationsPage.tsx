'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Roboto } from 'next/font/google';
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
import { notificationsService, Notification, notificationKeys } from '@/apiServices/notifications';
import { StudentLayout } from '@/app/lms/component/student/student-layout';
import DashboardLayout from '@/app/lms/component/layout';
import { StaffLayout } from '@/app/lms/component/stafflayout/staff-layout';
import { usePermissions } from '@/hooks/usePermissions';
import { PERMISSION_IDS } from '@/components/permissions';
import TableFooter from '@/app/lms/shared/listing/TableFooter';
import { HeaderStats } from '@/app/lms/shared/ui/HeaderStats';

const roboto = Roboto({
  weight: ['400', '500', '700'],
  subsets: ['latin'],
  display: 'swap',
});

// Orange theme tokens based on your sample
const T = {
  orange: '#F27757', 
  orangeDark: '#E0623F', 
  orangeGlow: 'rgba(242,119,87,0.22)', 
  orangeLight: 'rgba(242,119,87,0.08)',
  textMain: '#1a1a2e', 
  textSub: '#6b6b7e', 
  textMuted: '#8b8b9e', 
  textHint: '#bcbccc', 
  border: '#ecedf1', 
  bg: '#ffffff', 
  pageBg: '#f8f8fa',
  dark: { 
    bg: '#1a1a2e', 
    surface: '#222240', 
    card: '#252545', 
    border: '#2e2e4a', 
    textMain: '#e8e8f0', 
    textSub: '#a0a0b8', 
    textMuted: '#6b6b88', 
    textHint: '#4a4a66', 
    pageBg: '#12121f' 
  }
};

// Helper function to get user role (consistent with courses page)
const getUserRole = (): string | null => {
  try {
    const roleValue = localStorage.getItem('smartcliff_roleValue');
    if (roleValue) return roleValue.toLowerCase();
    
    // Fallback: try to get from userData
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
  // State for role-based layout
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

  // ── The notification feed ────────────────────────────────────────────────
  // Page-by-page pagination via React Query — each page click fetches ONLY
  // that page (the server paginates in Mongo via ?page=&limit=). The list
  // was previously an infinite-scroll useInfiniteQuery, but with a growing
  // inbox that effectively kept accumulating rows in memory as the user
  // scrolled. Traditional pagination fetches one page's worth per request
  // (20 rows per page) and swaps them in place — no accumulation.
  //
  // `unreadCount` still counts the WHOLE list rather than the filtered set —
  // the badge never depended on the active tab, and the server keeps that
  // branch outside the filter.
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

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
    enabled: !!userRole, // Only fetch when role is determined
    // Keep the previous page's rows visible while the next page loads so the
    // list doesn't flash empty between page clicks.
    placeholderData: keepPreviousData,
  });

  const notificationsData = useMemo(() => ({
    notifications: pageData?.notifications ?? [],
    unreadCount: pageData?.unreadCount ?? 0,
    totalCount: pageData?.totalCount ?? 0,
    totalPages: pageData?.totalPages ?? 1,
  }), [pageData]);

  const totalPages = notificationsData.totalPages;
  const totalCount = notificationsData.totalCount;
  const safePage = Math.min(currentPage, totalPages || 1);
  const rangeFrom = totalCount === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const rangeTo = Math.min(safePage * pageSize, totalCount);

  // Theme state - initialize from localStorage or system preference
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  // Get user role from localStorage on component mount
  useEffect(() => {
    const initializeRole = () => {
      const role = getUserRole();
      console.log('Notifications page - User role:', role);
      setUserRole(role);
      setIsRoleLoading(false);
    };
    
    initializeRole();
    
    // Listen for role changes
    const handleStorageChange = () => {
      const newRole = getUserRole();
      setUserRole(newRole);
    };
    
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Initialize theme and listen for theme changes
  useEffect(() => {
    // Function to update theme based on current state
    const updateTheme = () => {
      // Check localStorage first
      const storedTheme = localStorage.getItem('theme') as 'light' | 'dark';
      
      if (storedTheme) {
        setTheme(storedTheme);
        // Apply theme to HTML element
        if (storedTheme === 'dark') {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
      } else {
        // Fallback to system preference
        const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        const initialTheme = systemPrefersDark ? 'dark' : 'light';
        setTheme(initialTheme);
        
        if (systemPrefersDark) {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
      }
    };

    // Initial update
    updateTheme();

    // Listen for theme changes from localStorage (for cross-tab synchronization)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'theme') {
        const newTheme = e.newValue as 'light' | 'dark';
        if (newTheme) {
          setTheme(newTheme);
          if (newTheme === 'dark') {
            document.documentElement.classList.add('dark');
          } else {
            document.documentElement.classList.remove('dark');
          }
        }
      }
    };

    // Listen for custom theme change events (from navbar)
    const handleThemeChange = (event: CustomEvent) => {
      const newTheme = event.detail.theme;
      setTheme(newTheme);
      
      // Apply theme to HTML element
      if (newTheme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    };

    // Listen for theme change from navbar (using a custom event)
    window.addEventListener('themeChange', handleThemeChange as EventListener);
    window.addEventListener('storage', handleStorageChange);

    // Also check for theme changes every 100ms (as a fallback)
    const interval = setInterval(() => {
      const currentStoredTheme = localStorage.getItem('theme') as 'light' | 'dark';
      if (currentStoredTheme && currentStoredTheme !== theme) {
        setTheme(currentStoredTheme);
        if (currentStoredTheme === 'dark') {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
      }
    }, 100);

    return () => {
      window.removeEventListener('themeChange', handleThemeChange as EventListener);
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, [theme]);

  // --- Real-time & Polling ---
  useEffect(() => {
    if (userRole) { // Only enable polling when role is determined
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

  // --- Mutations ---
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
            duration: 1500
        });
    },
    onError: () => toast.error("Failed to update favorite status")
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

  // --- Helpers ---
  const handleNotificationClick = (notification: Notification) => {
    if (!notification.isRead) {
      markAsReadMutation.mutate(notification._id);
    }
    // If the sender attached a redirectUrl (approval-reject notifications do,
    // pointing to the exact assessment row with `highlightExerciseId`), open
    // it in the same tab. Fall back to expand-in-place for older items.
    const meta: any = notification.metadata || {};
    const redirectUrl: string | null = meta?.redirectUrl || (meta instanceof Map ? meta.get?.('redirectUrl') : null) || null;
    if (redirectUrl && typeof redirectUrl === 'string') {
      router.push(redirectUrl);
      return;
    }
    setExpandedId(expandedId === notification._id ? null : notification._id);
  };

  // (The filter and search that used to live here now run in Mongo — see the
  // infinite query above, which passes them as `filter` and `search`. The
  // server port is a copy of this predicate, including the rule that any
  // value other than all/unread/read/favorite matches relatedEntity OR type.)
  const filteredNotifications = notificationsData.notifications;
  const unreadCount = notificationsData?.unreadCount || 0;

  const formatEmailDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    
    if (isToday) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const getIconForType = (type: string, entity: string) => {
    if (entity === 'course') return <BookOpen className="h-4 w-4" style={{ color: T.orange }} />;
    if (entity === 'assignment') return <CheckCircle className="h-4 w-4" style={{ color: T.orange }} />;
    if (entity === 'message') return <MessageSquare className="h-4 w-4" style={{ color: T.orange }} />;
    if (type === 'error') return <AlertCircle className="h-4 w-4 text-red-500 dark:text-red-400" />;
    if (type === 'warning') return <AlertTriangle className="h-4 w-4 text-yellow-500 dark:text-yellow-400" />;
    return <Info className="h-4 w-4" style={{ color: theme === 'dark' ? T.dark.textMuted : T.textMuted }} />;
  };

  // Color classes for different notification types
  const getTypeColorClasses = (type: string, entity: string) => {
    if (entity === 'course') return `bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300 border-orange-200 dark:border-orange-800`;
    if (entity === 'assignment') return `bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 border-green-200 dark:border-green-800`;
    if (entity === 'message') return `bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 border-purple-200 dark:border-purple-800`;
    if (type === 'error') return 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 border-red-200 dark:border-red-800';
    if (type === 'warning') return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800';
    return 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-300 border-gray-200 dark:border-gray-700';
  };

  // Page content — Client-Management-style workspace: gray canvas outer
  // gutter (`px-4 sm:px-6 md:px-8 pt-5 pb-4`), then a slim header row
  // (title + HeaderStats chips), then the search/action toolbar, then ONE
  // white rounded card that contains the tabs + list + pagination footer.
  // The card is `flex-1 min-h-0 flex-col` so it exactly fills the panel
  // height and the list scrolls INSIDE it — the outer page never scrolls,
  // matching Clients / Services / Users. Theme-driven inline styles are
  // preserved on the row-level UI (the notification cards themselves).
  const pageContent = (
    <div className={`flex flex-col h-full min-h-0 min-w-0 px-4 sm:px-6 md:px-8 pt-5 pb-4 ${roboto.className}`}>

      {/* Header row: title + right-aligned stat chips (chips reserve
          `mr-8` for the shell's corner NotificationBell — no more `pr-14`
          hack). flex-nowrap on md+ so the heading column shrinks first
          instead of pushing the chip strip onto a new row. */}
      <div className="flex items-start justify-between gap-4 flex-wrap md:flex-nowrap">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl sm:text-2xl font-semibold text-heading tracking-[-0.01em]">Notifications</h1>
          <p className="text-sm text-subtle mt-0.5 hidden sm:block">Review, filter and clear system notifications.</p>
        </div>
        <HeaderStats
          loading={isLoading && totalCount === 0}
          skeletonCount={2}
          items={[
            { label: 'Total', value: totalCount },
            { label: 'Unread', value: unreadCount },
          ]}
        />
      </div>

      {/* One toolbar — search + actions (Refresh · Mark all · Delete all).
          Same shape as the toolbar on Client Management: search takes the
          flex slot, action buttons wrap at narrow widths. */}
      <div className="mt-4 flex items-center gap-2 flex-wrap min-w-0">
        <div className="relative flex-1 min-w-0 max-w-xl">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-faint pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search notifications by title or message…"
            className="w-full h-10 pl-10 pr-9 rounded-control border border-hairline-strong bg-surface text-sm text-body placeholder:text-faint focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/15 transition-colors duration-150"
          />
          {searchQuery && (
            <button type="button" aria-label="Clear search" onClick={() => setSearchQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 inline-flex size-6 items-center justify-center rounded-chip text-faint hover:bg-ink-100 hover:text-heading transition-colors duration-150"><X size={14} /></button>
          )}
        </div>

        <button
          type="button"
          onClick={() => refetch()}
          disabled={isRefetching}
          title="Refresh notifications"
          className="inline-flex items-center gap-1.5 h-10 px-3.5 rounded-control border border-hairline-strong bg-surface text-sm font-medium text-body shadow-xs hover:bg-row-hover hover:text-heading transition-colors duration-150 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isRefetching ? 'animate-spin' : ''}`} style={{ color: T.orange }} />
          <span className="hidden sm:inline">{isRefetching ? 'Refreshing…' : 'Refresh'}</span>
        </button>

        {canEdit && unreadCount > 0 && (
          <button
            type="button"
            onClick={() => markAllAsReadMutation.mutate()}
            disabled={markAllAsReadMutation.isPending}
            title="Mark all as read"
            className="inline-flex items-center gap-1.5 h-10 px-3.5 rounded-control text-white text-sm font-semibold shadow-xs transition-colors duration-150 disabled:opacity-50"
            style={{ background: T.orange }}
            onMouseEnter={(e) => (e.currentTarget.style.background = T.orangeDark)}
            onMouseLeave={(e) => (e.currentTarget.style.background = T.orange)}
          >
            <CheckCheck className="w-4 h-4" />
            <span className="hidden sm:inline">{markAllAsReadMutation.isPending ? 'Processing…' : 'Mark all read'}</span>
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
            className="inline-flex items-center gap-1.5 h-10 px-3.5 rounded-control text-sm font-semibold shadow-xs transition-colors duration-150 disabled:opacity-50"
            style={{
              background: theme === 'dark' ? 'rgba(239,68,68,0.14)' : '#fee2e2',
              color: theme === 'dark' ? '#f87171' : '#dc2626',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = theme === 'dark' ? 'rgba(239,68,68,0.22)' : '#fecaca')}
            onMouseLeave={(e) => (e.currentTarget.style.background = theme === 'dark' ? 'rgba(239,68,68,0.14)' : '#fee2e2')}
          >
            <Trash2 className="w-4 h-4" />
            <span className="hidden sm:inline">{deleteAllNotificationsMutation.isPending ? 'Deleting…' : 'Delete All'}</span>
          </button>
        )}
      </div>

      {/* ── White card ── contains tabs + list + pagination footer.
          flex-1 min-h-0 flex-col so the tab bar and footer keep their
          natural heights while the list scrolls inside its own flex-1
          region. rounded-xl + border + shadow-xs matches every other
          admin listing (Clients, Services, Users, Question Bank). */}
      <div className="mt-4 flex flex-1 min-h-0 flex-col bg-surface rounded-xl border border-hairline shadow-xs overflow-hidden">

      {/* COMPACT Tabs */}
      <div className="flex items-center px-2 border-b overflow-x-auto scrollbar-hide flex-shrink-0"
           style={{
             background: theme === 'dark' ? T.dark.bg : T.bg,
             borderColor: theme === 'dark' ? T.dark.border : T.border
           }}>
        {[
          { id: 'all', label: 'All', icon: Bell },
          { id: 'unread', label: 'Unread', count: unreadCount, icon: Eye },
          { id: 'favorite', label: 'Favorites', icon: Star },
          { id: 'read', label: 'Read', icon: CheckSquare },
          { id: 'course', label: 'Courses', icon: BookOpen },
          { id: 'assignment', label: 'Assignments', icon: CheckCircle },
          { id: 'message', label: 'Messages', icon: MessageSquare },
          { id: 'system', label: 'System', icon: Info }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveFilter(tab.id)}
            className="group flex items-center gap-2 px-3 py-2 text-sm font-medium border-b-2 transition-all whitespace-nowrap"
            style={{
              borderColor: activeFilter === tab.id ? T.orange : 'transparent',
              color: activeFilter === tab.id 
                ? T.orange 
                : theme === 'dark' ? T.dark.textMuted : T.textMuted,
              background: activeFilter === tab.id && theme === 'dark' 
                ? 'rgba(242,119,87,0.12)' 
                : activeFilter === tab.id 
                  ? T.orangeLight 
                  : 'transparent'
            }}
          >
            <tab.icon className="h-4 w-4" style={{ 
              color: activeFilter === tab.id ? T.orange : theme === 'dark' ? T.dark.textHint : T.textHint 
            }} />
            {tab.label}
            {tab.id === 'unread' && unreadCount > 0 && (
              <span className="ml-1 text-xs px-1.5 py-0.5 rounded-full"
                    style={{ 
                      background: activeFilter === tab.id ? T.orange : (theme === 'dark' ? T.dark.border : T.border),
                      color: activeFilter === tab.id ? 'white' : (theme === 'dark' ? T.dark.textSub : T.textSub)
                    }}>
                {unreadCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Notification List — page-by-page pagination.
          Each page click below fetches only that page's rows (React Query
          with keepPreviousData so the current rows stay visible while the
          next page loads instead of flashing empty). */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="p-8 text-center" style={{ color: theme === 'dark' ? T.dark.textMuted : T.textMuted }}>
            Loading your inbox...
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full" style={{ color: theme === 'dark' ? T.dark.textMuted : T.textMuted }}>
            {searchQuery ? (
              <>
                <div className="h-16 w-16 rounded-full flex items-center justify-center mb-4"
                     style={{ background: theme === 'dark' ? T.dark.surface : T.border }}>
                  <Search className="h-8 w-8" style={{ color: theme === 'dark' ? T.dark.textHint : T.textHint }} />
                </div>
                <p className="text-lg font-medium">No results found</p>
                <p className="text-sm">Try different keywords or clear your search.</p>
              </>
            ) : (
              <>
                <div className="h-16 w-16 rounded-full flex items-center justify-center mb-4"
                     style={{ background: theme === 'dark' ? T.dark.surface : T.border }}>
                  {activeFilter === 'favorite' ? (
                    <Star className="h-8 w-8" style={{ color: T.orange }} />
                  ) : (
                    <Mail className="h-8 w-8" style={{ color: theme === 'dark' ? T.dark.textHint : T.textHint }} />
                  )}
                </div>
                <p className="text-lg font-medium">
                  {activeFilter === 'favorite' ? 'No favorite notifications' : 
                   activeFilter === 'read' ? 'No read notifications' : 
                   "You're all caught up!"}
                </p>
                <p className="text-sm">No notifications in this tab.</p>
              </>
            )}
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: theme === 'dark' ? T.dark.border : T.border }}>
            {filteredNotifications.map((notification) => {
              const isExpanded = expandedId === notification._id;
              const isRead = notification.isRead;
              
              return (
                <div 
                  key={notification._id}
                  className="group relative transition-all duration-200 cursor-pointer"
                  style={{ 
                    background: isExpanded 
                      ? theme === 'dark' 
                        ? 'rgba(242,119,87,0.08)' 
                        : T.orangeLight
                      : theme === 'dark'
                        ? T.dark.bg
                        : T.bg,
                    borderColor: theme === 'dark' ? T.dark.border : T.border
                  }}
                  onClick={() => handleNotificationClick(notification)}
                  onMouseEnter={e => {
                    if (!isExpanded) {
                      e.currentTarget.style.background = theme === 'dark' ? T.dark.card : '#f7f7f9';
                    }
                  }}
                  onMouseLeave={e => {
                    if (!isExpanded) {
                      e.currentTarget.style.background = theme === 'dark' ? T.dark.bg : T.bg;
                    }
                  }}
                >
                  {/* Collapsed View (Row) */}
                  <div className="flex items-center px-4 py-3 gap-4">
                    
                    {/* Star Toggle Button — gated on edit_notifications */}
                    {canEdit && (
                      <button
                        className="flex-shrink-0 p-1 rounded-full transition-colors z-20"
                        style={{ background: 'transparent' }}
                        onClick={(e) => {
                            e.stopPropagation();
                            toggleFavoriteMutation.mutate(notification._id);
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = theme === 'dark' ? T.dark.surface : T.border}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        title={notification.isFavorite ? "Remove from favorites" : "Add to favorites"}
                      >
                        <Star
                          className="h-5 w-5 transition-colors"
                          style={{
                            color: notification.isFavorite ? T.orange : (theme === 'dark' ? T.dark.textHint : T.textHint),
                            fill: notification.isFavorite ? T.orange : 'none'
                          }}
                        />
                      </button>
                    )}

                    {/* Content Section */}
                    <div className="flex flex-1 items-center min-w-0 gap-4 overflow-hidden">
                      {/* Type Badge */}
                      <div className={`w-32 md:w-40 flex-shrink-0 flex items-center gap-2 truncate px-2 py-1 rounded-md text-xs font-medium border ${getTypeColorClasses(notification.type, notification.relatedEntity)}`}>
                        {getIconForType(notification.type, notification.relatedEntity)}
                        <span className="truncate">
                          {notification.relatedEntity ? 
                            notification.relatedEntity.charAt(0).toUpperCase() + notification.relatedEntity.slice(1) : 
                            'System'}
                        </span>
                      </div>

                      {/* Title & Preview */}
                      <div className="flex-1 truncate flex items-center text-sm">
                        <span className="mr-2 truncate"
                              style={{ 
                                fontWeight: !isRead ? 700 : 400,
                                color: !isRead 
                                  ? theme === 'dark' ? T.dark.textMain : T.textMain
                                  : theme === 'dark' ? T.dark.textSub : T.textSub
                              }}>
                          {notification.title}
                        </span>
                        <span className="hidden sm:inline truncate"
                              style={{ color: theme === 'dark' ? T.dark.textMuted : T.textMuted }}>
                          - {notification.message}
                        </span>
                      </div>
                    </div>

                    {/* Date & Hover Actions */}
                    <div className="flex-shrink-0 flex items-center justify-end w-24 pl-2">
                      {/* Hover Actions */}
                      <div className="hidden group-hover:flex items-center gap-2 mr-2">
                        {canEdit && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteNotificationMutation.mutate(notification._id);
                            }}
                            className="p-1.5 rounded-full transition-colors"
                            style={{ background: 'transparent' }}
                            onMouseEnter={e => {
                              e.currentTarget.style.background = theme === 'dark' ? T.dark.surface : T.border;
                              (e.currentTarget.firstChild as HTMLElement).style.color = '#ef4444';
                            }}
                            onMouseLeave={e => {
                              e.currentTarget.style.background = 'transparent';
                              (e.currentTarget.firstChild as HTMLElement).style.color = theme === 'dark' ? T.dark.textMuted : T.textMuted;
                            }}
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4 transition-colors"
                                    style={{ color: theme === 'dark' ? T.dark.textMuted : T.textMuted }} />
                          </button>
                        )}

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleNotificationClick(notification);
                          }}
                          className="p-1.5 rounded-full transition-colors"
                          style={{ background: 'transparent' }}
                          onMouseEnter={e => {
                            e.currentTarget.style.background = theme === 'dark' ? T.dark.surface : T.border;
                            (e.currentTarget.firstChild as HTMLElement).style.color = T.orange;
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.background = 'transparent';
                            (e.currentTarget.firstChild as HTMLElement).style.color = theme === 'dark' ? T.dark.textMuted : T.textMuted;
                          }}
                          title="View Details"
                        >
                          <Eye className="h-4 w-4 transition-colors"
                               style={{ color: theme === 'dark' ? T.dark.textMuted : T.textMuted }} />
                        </button>
                      </div>
                      
                      {/* Date */}
                      <span className="text-xs group-hover:hidden"
                            style={{ 
                              fontWeight: !isRead ? 600 : 400,
                              color: !isRead 
                                ? T.orange 
                                : theme === 'dark' ? T.dark.textMuted : T.textMuted
                            }}>
                        {formatEmailDate(notification.createdAt)}
                      </span>
                    </div>
                  </div>

                  {/* Expanded View */}
                  {isExpanded && (
                    <div className="px-4 pb-4 pl-14 pr-4 border-t cursor-default"
                         style={{ 
                           background: theme === 'dark' ? T.dark.bg : T.bg,
                           borderColor: theme === 'dark' ? T.dark.border : T.border 
                         }}
                         onClick={(e) => e.stopPropagation()}>
                      <div className="pt-4 animate-fadeIn">
                        <div className="flex items-start justify-between mb-4">
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="text-lg font-semibold"
                                  style={{ color: theme === 'dark' ? T.dark.textMain : T.textMain }}>
                                {notification.title}
                              </h3>
                              {notification.isFavorite && (
                                <span className="px-2 py-0.5 rounded-full text-xs border"
                                      style={{ 
                                        background: T.orangeLight,
                                        color: T.orange,
                                        borderColor: T.orange
                                      }}>
                                  Favorite
                                </span>
                              )}
                            </div>
                            <p className="text-xs mt-1"
                               style={{ color: theme === 'dark' ? T.dark.textMuted : T.textMuted }}>
                              From: <span className="font-medium"
                                         style={{ color: theme === 'dark' ? T.dark.textSub : T.textSub }}>System Admin</span> 
                              <span className="mx-2" style={{ color: theme === 'dark' ? T.dark.border : T.border }}>•</span> 
                              {new Date(notification.createdAt).toLocaleString()}
                            </p>
                          </div>
                        </div>

                        <div className="text-sm leading-relaxed whitespace-pre-wrap"
                             style={{ color: theme === 'dark' ? T.dark.textSub : T.textSub }}>
                          {notification.message}
                        </div>

                        {/* Metadata */}
                        {notification.metadata && Object.keys(notification.metadata).length > 0 && (
                          <div className="mt-6 rounded-lg p-4 border"
                               style={{ 
                                 background: theme === 'dark' ? T.dark.surface : '#f7f7f9',
                                 borderColor: theme === 'dark' ? T.dark.border : T.border
                               }}>
                            <h4 className="text-xs font-medium uppercase tracking-wider mb-2"
                                style={{ color: theme === 'dark' ? T.dark.textMuted : T.textMuted }}>
                              Technical Details
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-y-2 text-sm">
                              {Object.entries(notification.metadata).map(([key, value]) => (
                                <div key={key} className="flex gap-2">
                                  <span className="font-medium min-w-[100px]"
                                        style={{ color: theme === 'dark' ? T.dark.textMuted : T.textMuted }}>
                                    {key}:
                                  </span>
                                  <span className="break-all"
                                        style={{ color: theme === 'dark' ? T.dark.textSub : T.textSub }}>
                                    {String(value)}
                                  </span>
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

        {/* Pagination footer — count on the left, page-size + prev/next
            window on the right. Sits INSIDE the card at the bottom so the
            list scroll region above is bounded by it. Only rendered when
            the current filter has at least one row so the empty state
            stays clean. */}
        {!isLoading && totalCount > 0 && (
          <div className="flex-shrink-0" style={{ background: theme === 'dark' ? T.dark.bg : T.bg, borderColor: theme === 'dark' ? T.dark.border : T.border }}>
            <TableFooter
              from={rangeFrom}
              to={rangeTo}
              total={totalCount}
              pageSize={pageSize}
              onPageSize={(n) => { setPageSize(n); setCurrentPage(1); }}
              currentPage={safePage}
              totalPages={totalPages || 1}
              onPage={(p) => setCurrentPage(p)}
            />
          </div>
        )}
      </div>{/* /card */}
    </div>
  );

  // Show loading state while determining role
  if (isRoleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center"
           style={{ background: theme === 'dark' ? T.dark.pageBg : T.pageBg }}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2"
             style={{ borderColor: T.orange }}></div>
      </div>
    );
  }

  // Conditionally wrap with appropriate layout based on user role
  if (userRole === 'admin' || userRole === 'ldhead' || userRole === 'subhead' || userRole === 'programcoordinator') {
    return <DashboardLayout>{pageContent}</DashboardLayout>;
  }
  
  if (userRole === 'student') {
    return <StudentLayout>{pageContent}</StudentLayout>;
  }
  
  // All other roles (programcoordinator, faculty, staff, etc.) get StaffLayout
  return <StaffLayout>{pageContent}</StaffLayout>;
}