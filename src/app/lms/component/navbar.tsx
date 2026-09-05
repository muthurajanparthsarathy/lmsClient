"use client";
import { getToken } from "@/lib/session";
import {
  Bell,
  Search,
  User,
  BookOpen,
  Settings,
  HelpCircle,
  LogOut,
  Loader2,
  Sparkles,
  MessageSquare,
  Zap,
  X,
  ChevronDown,
  ChevronRight,
  Menu,
  Plus,
  UserPlus,
  Layers,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAccountMenu } from "./useAccountMenu";
import { notificationsService } from "@/app/lms/pages/notifications/api/notifications";
import { cn } from "@/lib/utils";
import { useSidebar } from "./layout";
import { CommandPalette } from "../shared/ui/CommandPalette";

// Notification keys for React Query
const notificationKeys = {
  all: ['notifications'] as const,
  lists: () => [...notificationKeys.all, 'list'] as const,
  list: (filters: string) => [...notificationKeys.lists(), { filters }] as const,
  details: () => [...notificationKeys.all, 'detail'] as const,
  detail: (id: string) => [...notificationKeys.details(), id] as const,
};

// Known route keys → display names for the breadcrumb; anything unknown is
// title-cased from the raw segment.
const BREADCRUMB_NAMES: Record<string, string> = {
  usermanagement: "User Management",
  coursestructure: "Course Management",
  admindashboard: "Dashboard",
  dynamicfieldsettings: "Dynamic Fields",
  clientmanagement: "Clients",
  servicemapping: "Services",
  questionbanks: "Question Banks",
  calendar: "Calendar",
  profile: "Profile",
};

const titleCaseSegment = (segment: string): string =>
  segment
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

interface StudentNavbarProps {
  onMenuClick?: () => void;
  onAIClick?: () => void;
  onSummaryClick?: () => void;
  isSidebarOpen?: boolean;
  activeRoute?: string;
}

export function Navbar({
  onMenuClick,
  onAIClick,
  onSummaryClick,
}: StudentNavbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const { isCollapsed, setIsCollapsed, hasSidebar } = useSidebar();
  const [showAISubmenu, setShowAISubmenu] = useState(false);
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  // Refs for click outside detection
  const aiRef = useRef<HTMLDivElement>(null);
  const notificationRef = useRef<HTMLDivElement>(null);

  // Current user, sign-out and the role-switch state all live in one shared
  // hook so this navbar and the other shells cannot drift apart.
  const {
    user,
    userLoading,
    getUserInitials,
    getFullName,
    isLoggingOut,
    handleLogout,
  } = useAccountMenu();

  // Fetch notifications
  const { data: notificationsData, isLoading: notificationsLoading } = useQuery({
    queryKey: notificationKeys.all,
    queryFn: () => notificationsService.fetchNotifications(),
    refetchOnWindowFocus: true,
    staleTime: 30 * 1000, // 30 seconds
    enabled: typeof window !== 'undefined' && !!getToken(),
  });

  // Mutation for marking notifications as read
  const markAsReadMutation = useMutation({
    mutationFn: (notificationId: string) =>
      notificationsService.markAsRead(notificationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: () => notificationsService.markAllAsRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
      toast.success("All notifications marked as read");
    },
  });

  // Click outside handlers
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (aiRef.current && !aiRef.current.contains(event.target as Node)) {
        setShowAISubmenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Breadcrumb derived from the pathname: everything after /lms/pages, each
  // segment linked to its accumulated path.
  const breadcrumbs = useMemo(() => {
    if (!pathname) return [];
    const marker = "/lms/pages/";
    const idx = pathname.indexOf(marker);
    if (idx === -1) return [];
    const segments = pathname.slice(idx + marker.length).split("/").filter(Boolean);
    let acc = pathname.slice(0, idx + marker.length - 1); // "…/lms/pages"
    return segments.map((segment) => {
      acc += `/${segment}`;
      const key = segment.toLowerCase();
      // Long opaque ids (Mongo ObjectIds and friends) read as noise — label
      // them as the detail level instead of title-casing 24 hex chars.
      const label = BREADCRUMB_NAMES[key]
        ?? (/^[0-9a-f]{16,}$/i.test(segment) ? "Details" : titleCaseSegment(segment));
      return { label, href: acc };
    });
  }, [pathname]);

  // Notification handlers
  const handleNotificationClick = (notification: any) => {
    markAsReadMutation.mutate(notification._id);
    // You can add navigation logic here based on notification type
    if (notification.link) {
      router.push(notification.link);
    }
  };

  const navbarTextStyle = {
    fontFamily: "var(--font-poppins), 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    fontStyle: "normal" as const,
    fontWeight: 400,
    // Semantic token (ink-700) instead of the old hardcoded rgb(80,82,88) —
    // inline style wins over any text-* class, so this is THE navbar text color.
    color: "var(--body)",
    fontSize: "13px",
    lineHeight: "normal" as const,
  };

  const logoTextStyle = {
    fontFamily: "var(--font-poppins), 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    fontStyle: "normal" as const,
    fontWeight: 600,
    color: "var(--heading)",
    fontSize: "14px",
    lineHeight: "normal" as const,
  };

  // Get notifications data
  const notifications = notificationsData?.notifications || [];
  const unreadCount = notificationsData?.unreadCount || 0;

  return (
    <header className="bg-surface border-b border-hairline h-14 flex items-center gap-3 px-4 relative flex-shrink-0">
      {/* Left side — sidebar toggle + breadcrumb (dashboard) or logo (standalone) */}
      <div className="flex items-center gap-1.5 min-w-0 relative z-10">
        {hasSidebar ? (
          <>
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="h-9 w-9 rounded-lg hover:bg-row-hover transition-colors duration-150 flex items-center justify-center text-body flex-shrink-0"
              title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              <Menu className="w-[18px] h-[18px]" />
            </button>

            {/* Breadcrumb */}
            {breadcrumbs.length > 0 && (
              <nav aria-label="Breadcrumb" className="hidden md:flex items-center gap-1 min-w-0 ml-1">
                {breadcrumbs.map((crumb, index) => {
                  const isLast = index === breadcrumbs.length - 1;
                  return (
                    <span key={crumb.href} className="flex items-center gap-1 min-w-0">
                      {index > 0 && (
                        <ChevronRight className="w-3.5 h-3.5 text-faint flex-shrink-0" />
                      )}
                      {isLast ? (
                        <span className="text-sm font-medium text-heading truncate">
                          {crumb.label}
                        </span>
                      ) : (
                        <Link
                          href={crumb.href}
                          className="text-sm text-subtle hover:text-heading transition-colors duration-150 truncate"
                        >
                          {crumb.label}
                        </Link>
                      )}
                    </span>
                  );
                })}
              </nav>
            )}
          </>
        ) : (
          <>
            {/* Hamburger Menu (for mobile) */}
            {onMenuClick && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onMenuClick}
                className="h-8 w-8 p-0 lg:hidden"
              >
                <Menu className="w-4 h-4" />
              </Button>
            )}

            {/* Logo Section */}
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-b from-brand-400 to-brand-600 rounded-tile flex items-center justify-center shadow-sm">
                <BookOpen className="w-4 h-4 text-white" />
              </div>
              <span style={logoTextStyle} className="text-heading hidden sm:block">
                SmartCliff
              </span>
            </div>
          </>
        )}
      </div>

      <div className="flex-1" />

      {/* Right side — search, quick create, notifications, help, user menu */}
      <div className="flex items-center gap-2 relative z-10">
        {/* Command palette launcher.
            This was a 256px search-SHAPED button, which is why pages that own a
            real filter field (Service Mapping, User Management) appeared to have
            two search boxes side by side — users could not tell which one
            filtered the table. It never was a search input; it only ever opened
            the ⌘K palette. Reduced to an icon so it stops competing with the
            page's own search, and it now matches the notification/help/settings
            group it sits in. The shortcut and the palette are unchanged. */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setPaletteOpen(true)}
          aria-label="Search (Ctrl+K)"
          title="Search  ⌘K"
          className="hidden lg:flex h-9 w-9 rounded-lg hover:bg-row-hover transition-colors text-subtle"
        >
          <Search className="w-[18px] h-[18px]" />
        </Button>

        {/* Mobile search */}
        <Button
          variant="ghost"
          size="sm"
          className="lg:hidden h-9 w-9 rounded-lg hover:bg-row-hover transition-colors text-subtle"
          onClick={() => setShowMobileSearch(!showMobileSearch)}
        >
          {showMobileSearch ? <X className="w-4 h-4" /> : <Search className="w-4 h-4" />}
        </Button>

        {/* Quick create */}
        {hasSidebar && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              {/* Secondary, not primary. A filled brand button here competed
                  head-on with every page's own primary CTA ("New Mapping",
                  "Add User") — two identical orange buttons ~150px apart, so
                  neither read as THE action. The page owns the primary; this
                  global shortcut steps down to an outline. */}
              <Button className="h-9 px-3 gap-1.5 rounded-control border border-hairline-strong bg-surface hover:bg-row-hover hover:border-line-hover active:scale-[.98] text-body text-sm font-medium transition-colors duration-150 shadow-none">
                <Plus className="w-4 h-4 text-subtle" />
                <span className="hidden sm:inline">New</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              sideOffset={8}
              className="w-52 bg-surface border border-hairline-strong rounded-tile shadow-lg p-1.5 z-popover"
            >
              <DropdownMenuItem
                onClick={() => router.push('/lms/pages/usermanagement')}
                className="flex items-center gap-2.5 px-2.5 py-2 text-sm font-medium text-body rounded-chip hover:bg-row-hover transition-colors cursor-pointer"
              >
                <UserPlus className="w-4 h-4 text-subtle" />
                New User
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => router.push('/lms/pages/servicemapping')}
                className="flex items-center gap-2.5 px-2.5 py-2 text-sm font-medium text-body rounded-chip hover:bg-row-hover transition-colors cursor-pointer"
              >
                <Layers className="w-4 h-4 text-subtle" />
                New Service
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => router.push('/lms/pages/coursestructure')}
                className="flex items-center gap-2.5 px-2.5 py-2 text-sm font-medium text-body rounded-chip hover:bg-row-hover transition-colors cursor-pointer"
              >
                <BookOpen className="w-4 h-4 text-subtle" />
                New Course
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* AI Assistant (if provided) */}
        {onAIClick && (
          <div className="relative hidden sm:block" ref={aiRef}>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAISubmenu(!showAISubmenu)}
              className="h-8 px-3 rounded-lg hover:bg-row-hover transition-colors text-subtle flex items-center gap-1"
            >
              <Sparkles className="w-4 h-4" />
              <span style={navbarTextStyle} className="hidden md:inline">
                AI Assistant
              </span>
              <ChevronDown className={cn("w-3 h-3 transition-transform", showAISubmenu ? "rotate-180" : "")} />
            </Button>

            {/* AI Submenu */}
            {showAISubmenu && (
              <div className="absolute top-full right-0 mt-2 w-48 bg-surface rounded-tile shadow-lg border border-hairline-strong z-popover">
                <button
                  onClick={() => {
                    onAIClick();
                    setShowAISubmenu(false);
                  }}
                  className="w-full flex items-center gap-2 p-3 hover:bg-row-hover text-left"
                >
                  <MessageSquare className="w-4 h-4 text-subtle" />
                  <div>
                    <p style={navbarTextStyle} className="font-medium">Chat Assistant</p>
                    <p style={{ ...navbarTextStyle, fontSize: "11px" }} className="text-subtle">
                      Ask questions instantly
                    </p>
                  </div>
                </button>
                {onSummaryClick && (
                  <button
                    onClick={() => {
                      onSummaryClick();
                      setShowAISubmenu(false);
                    }}
                    className="w-full flex items-center gap-2 p-3 hover:bg-row-hover text-left border-t border-hairline"
                  >
                    <Zap className="w-4 h-4 text-subtle" />
                    <div>
                      <p style={navbarTextStyle} className="font-medium">Generate Summary</p>
                      <p style={{ ...navbarTextStyle, fontSize: "11px" }} className="text-subtle">
                        Summarize content
                      </p>
                    </div>
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Notifications with dynamic count */}
        <div className="relative" ref={notificationRef}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="relative h-9 w-9 rounded-lg hover:bg-row-hover transition-colors text-subtle"
              >
                <Bell className="w-[18px] h-[18px]" />
                {unreadCount > 0 && (
                  <Badge className="absolute -top-0.5 -right-0.5 w-5 h-5 flex items-center justify-center text-2xs font-bold bg-danger-500 text-white border-2 border-surface rounded-full p-0 min-w-5">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </Badge>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className="w-[340px] bg-surface border border-hairline-strong shadow-lg rounded-xl p-0 overflow-hidden z-popover"
              align="end"
              sideOffset={8}
              forceMount
            >
              <div className="px-4 py-3 border-b border-hairline flex justify-between items-center bg-canvas">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-heading">
                    Notifications
                  </span>
                  {unreadCount > 0 && (
                    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-wash px-1.5 text-2xs font-semibold text-brand-strong">
                      {unreadCount}
                    </span>
                  )}
                </div>
                {unreadCount > 0 && (
                  <button
                    onClick={() => markAllAsReadMutation.mutate()}
                    className="text-brand-strong hover:text-brand-800 text-xs font-medium transition-colors duration-150"
                  >
                    Mark all as read
                  </button>
                )}
              </div>

              <div className="max-h-80 overflow-y-auto [scrollbar-width:thin]">
                {notificationsLoading ? (
                  <div className="p-6 text-center">
                    <Loader2 className="w-4 h-4 animate-spin mx-auto text-subtle" />
                  </div>
                ) : notifications.length === 0 ? (
                  <div className="px-6 py-10 text-center">
                    <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-tile bg-brand-wash">
                      <Bell className="h-5 w-5 text-brand-strong" />
                    </div>
                    <p className="text-sm font-medium text-heading">All caught up</p>
                    <p className="mt-0.5 text-xs text-subtle">No notifications right now.</p>
                  </div>
                ) : (
                  notifications.map((notification: any) => (
                    <DropdownMenuItem
                      key={notification._id}
                      onClick={() => handleNotificationClick(notification)}
                      className={cn(
                        "flex items-start gap-3 px-4 py-3 rounded-none transition-colors duration-150 cursor-pointer border-b border-hairline last:border-b-0",
                        !notification.isRead
                          ? "bg-brand-wash hover:bg-brand-wash-hover"
                          : "hover:bg-row-hover"
                      )}
                    >
                      <div className={cn(
                        "w-2 h-2 rounded-full mt-1.5 flex-shrink-0",
                        !notification.isRead ? "bg-brand" : "bg-ink-300"
                      )} />
                      <div className="flex-1 min-w-0">
                        <p className={cn(
                          "text-sm font-medium truncate",
                          !notification.isRead ? "text-heading" : "text-body"
                        )}>
                          {notification.title}
                        </p>
                        <p className="text-xs text-subtle mt-0.5 line-clamp-2">
                          {notification.message}
                        </p>
                        {notification.createdAt && (
                          <p className="text-2xs text-faint mt-1">
                            {new Date(notification.createdAt).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </p>
                        )}
                      </div>
                    </DropdownMenuItem>
                  ))
                )}
              </div>

              {notifications.length > 0 && (
                <div className="p-2 border-t border-hairline bg-canvas">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full h-8 text-xs font-medium text-subtle hover:text-heading"
                    onClick={() => router.push('/notifications')}
                  >
                    View all notifications
                  </Button>
                </div>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Help */}
        <Button
          variant="ghost"
          size="sm"
          className="h-9 w-9 rounded-lg hover:bg-row-hover transition-colors text-subtle"
        >
          <HelpCircle className="w-[18px] h-[18px]" />
        </Button>

        {/* Settings */}
        <Button
          variant="ghost"
          size="sm"
          className="h-9 w-9 rounded-lg hover:bg-row-hover transition-colors text-subtle"
        >
          <Settings className="w-[18px] h-[18px]" />
        </Button>

        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="relative h-9 w-9 rounded-full hover:bg-row-hover transition-colors p-0 ml-0.5"
              disabled={userLoading}
            >
              {userLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <span className="relative inline-flex">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={user?.profile} alt={getFullName()} />
                    {/* brand-strong (700), not 500: white text on #F97316 is 2.8:1 — AA fail */}
                    <AvatarFallback className="bg-brand-strong text-white font-semibold text-xs">
                      {getUserInitials()}
                    </AvatarFallback>
                  </Avatar>
                  {/* Online presence dot */}
                  <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-success-500 rounded-full ring-2 ring-surface" />
                </span>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-64 bg-surface border border-hairline-strong shadow-lg rounded-tile p-2 z-popover"
            align="end"
            forceMount
          >
            <DropdownMenuLabel className="font-normal p-0 mb-2">
              <div className="flex items-center gap-3 p-3 bg-surface-sunken rounded-chip">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={user?.profile} alt={getFullName()} />
                  <AvatarFallback className="bg-brand-strong text-white font-semibold">
                    {getUserInitials()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col">
                  <p
                    style={{ ...navbarTextStyle, fontWeight: 600 }}
                    className="text-heading"
                  >
                    {getFullName()}
                  </p>
                  <p
                    style={{ ...navbarTextStyle, fontSize: "12px" }}
                    className="text-subtle"
                  >
                    {user?.email || "Loading..."}
                  </p>
                  <div className="flex items-center gap-1 mt-1">
                    <div className="w-2 h-2 bg-success-500 rounded-full"></div>
                    <span
                      style={{ ...navbarTextStyle, fontSize: "12px", color: "var(--color-success-700)" }}
                    >
                      {user?.role?.renameRole || "User"}
                    </span>
                  </div>
                </div>
              </div>
            </DropdownMenuLabel>

            <DropdownMenuItem
              className="flex items-center gap-3 p-2 rounded-chip hover:bg-row-hover transition-colors cursor-pointer"
              onClick={() => router.push('/profile')}
            >
              <User className="w-4 h-4 text-subtle" />
              <span style={navbarTextStyle} className="text-body">
                Profile
              </span>
            </DropdownMenuItem>

            <DropdownMenuItem className="flex items-center gap-3 p-2 rounded-chip hover:bg-row-hover transition-colors cursor-pointer">
              <Settings className="w-4 h-4 text-subtle" />
              <span style={navbarTextStyle} className="text-body">
                Settings
              </span>
            </DropdownMenuItem>

            <DropdownMenuItem className="flex items-center gap-3 p-2 rounded-chip hover:bg-row-hover transition-colors cursor-pointer">
              <HelpCircle className="w-4 h-4 text-subtle" />
              <span style={navbarTextStyle} className="text-body">
                Help & Support
              </span>
            </DropdownMenuItem>

            <DropdownMenuSeparator className="my-1 bg-hairline-strong" />

            <DropdownMenuItem
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="flex items-center gap-3 p-3 rounded-chip hover:bg-danger-50 transition-colors duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoggingOut ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <LogOut className="w-4 h-4 text-danger-700" />
              )}
              <span style={navbarTextStyle} className="text-body">
                {isLoggingOut ? "Signing Out..." : "Sign Out"}
              </span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Mobile Search Overlay */}
      {showMobileSearch && (
        <div className="absolute inset-0 bg-surface z-overlay flex items-center px-4 animate-in fade-in slide-in-from-top-2 border-b border-hairline-strong">
          <Search className="w-5 h-5 text-faint mr-3" />
          <input
            autoFocus
            type="text"
            placeholder="Search..."
            style={navbarTextStyle}
            className="flex-1 bg-transparent border-none outline-none text-base text-heading placeholder:text-faint h-full"
          />
          <button
            onClick={() => setShowMobileSearch(false)}
            className="p-2 bg-ink-100 rounded-lg ml-2"
          >
            <X className="w-5 h-5 text-subtle" />
          </button>
        </div>
      )}

      {/* Global command palette (⌘K / Ctrl+K) */}
      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        onSignOut={handleLogout}
      />
    </header>
  );
}
