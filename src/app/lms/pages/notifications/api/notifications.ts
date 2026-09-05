import axios from 'axios';
import { toast } from 'react-hot-toast';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5533';

interface EnrolledByInfo {
  id: string;
  name: string;
  email: string;
  isPopulated: boolean;
}

export interface Notification {
  _id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error' | 'enrollment';
  relatedEntity: 'course' | 'assignment' | 'announcement' | 'enrollment' | 'system';
  isRead: boolean;
  // Added isFavorite to match backend
  isFavorite: boolean;
  createdAt: string;
  updatedAt?: string;
  expiresAt?: string;
  metadata?: Record<string, any>;
  enrolledBy?: string | any;
  enrolledByInfo?: EnrolledByInfo;
  relatedEntityId?: {
    $oid: string;
  };
}

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string | Array<{ key: string; value: string }>;
  error?: string;
}

interface NotificationsResponse {
  data: Notification[];
  notifications: Notification[];
  unreadCount?: number;
  totalCount?: number;
  totalPages?: number;
  currentPage?: number;
}

interface MarkAsReadResponse {
  success: boolean;
  message?: string;
}

interface DeleteResponse {
  success: boolean;
  message?: string;
}

interface ToggleFavoriteResponse {
  success: boolean;
  message?: string;
  data: {
    isFavorite: boolean;
    notification: Notification;
  };
}

interface NotificationsCache {
  notifications: Notification[];
  unreadCount: number;
  totalCount: number;
  lastUpdated: number;
  version: number;
}

// Cache configuration
const CACHE_DURATION = 10 * 1000; // 10 seconds
const BACKGROUND_REFRESH_INTERVAL = 10 * 1000; // 10 seconds (more frequent for real-time feel)

class NotificationsService {
  private static instance: NotificationsService;
  private cache: NotificationsCache | null = null;
  private cacheTimestamp: number = 0;
  private cacheVersion: number = 0;
  private backgroundRefreshTimer: NodeJS.Timeout | null = null;
  // Polling is OPT-IN: only the notifications page enables it (via
  // setPollingEnabled) for its 5-second real-time feel while open. It used
  // to default on and self-start from the first fetch, which left a
  // 12-requests/minute interval running for the life of the tab even though
  // the bell renders exclusively from its React Query data (the bell now
  // refreshes itself with a 30s refetchInterval instead).
  private pollingEnabled: boolean = false;
  private lastPollTime: number = 0;
  private pollIntervalMs: number = 5000; // Poll every 5 seconds

  private constructor() {}

  static getInstance(): NotificationsService {
    if (!NotificationsService.instance) {
      NotificationsService.instance = new NotificationsService();
    }
    return NotificationsService.instance;
  }

  private getToken(): string | null {
    return localStorage.getItem('smartcliff_token');
  }

  // Start background polling for new notifications
  startPolling() {
    if (this.backgroundRefreshTimer) {
      clearInterval(this.backgroundRefreshTimer);
    }

    this.backgroundRefreshTimer = setInterval(async () => {
      await this.pollForNewNotifications();
    }, this.pollIntervalMs);
  }

  // Stop polling
  stopPolling() {
    if (this.backgroundRefreshTimer) {
      clearInterval(this.backgroundRefreshTimer);
      this.backgroundRefreshTimer = null;
    }
  }

  // Poll for new notifications
  private async pollForNewNotifications() {
    const now = Date.now();
    
    // Only poll if enough time has passed since last successful poll
    if (now - this.lastPollTime < this.pollIntervalMs) {
      return;
    }

    if (!this.pollingEnabled || !this.cache) {
      return;
    }

    try {
      const freshData = await this.fetchNotificationsFromAPI();
      
      // Check if there are new notifications
      const oldIds = new Set(this.cache.notifications.map(n => n._id));
      const newNotifications = freshData.notifications.filter(n => !oldIds.has(n._id));
      
      if (newNotifications.length > 0) {
        // Add new notifications to cache (newest first)
        this.cache.notifications = [...newNotifications, ...this.cache.notifications];
        this.cache.unreadCount += newNotifications.filter(n => !n.isRead).length;
        this.cache.totalCount = this.cache.notifications.length;
        this.cache.lastUpdated = now;
        this.cacheVersion++;

        // Notify UI
        window.dispatchEvent(new CustomEvent('notificationsUpdated', {
          detail: {
            notifications: this.cache.notifications,
            unreadCount: this.cache.unreadCount,
            version: this.cacheVersion,
            event: 'new-notifications',
            newNotifications: newNotifications
          }
        }));

        // Show toast for each new notification
        newNotifications.forEach(notification => {
          this.showNotificationToast(notification);
        });
      } else if (freshData.unreadCount !== this.cache.unreadCount) {
        // Update unread count if changed (e.g., read on another device)
        this.cache.unreadCount = freshData.unreadCount || 0;
        this.cache.lastUpdated = now;
        this.cacheVersion++;
        
        window.dispatchEvent(new CustomEvent('notificationsUpdated', {
          detail: {
            notifications: this.cache.notifications,
            unreadCount: this.cache.unreadCount,
            version: this.cacheVersion,
            event: 'unread-count-updated'
          }
        }));
      }

      this.lastPollTime = now;
    } catch (error) {
      console.warn('Polling failed:', error);
    }
  }

  private showNotificationToast(notification: Notification) {
    const iconMap: Record<string, string> = {
      'course': '📚',
      'enrollment': '✅',
      'announcement': '📢',
      'assignment': '📝',
      'system': '⚙️',
      'success': '✅',
      'warning': '⚠️',
      'error': '❌',
      'info': 'ℹ️'
    };

    const icon = iconMap[notification.relatedEntity] || iconMap[notification.type] || '🔔';

    toast.success(`${notification.message}`, { 
      duration: 4000,
      position: 'top-right',
      style: {
        background: '#f0f9ff',
        border: '1px solid #bae6fd',
      }
    });
  }

  /**
   * ONE page of the caller's notifications.
   *
   * The list grows for the life of an account and the page rendered every row,
   * so this is the growth that had no ceiling. The filter and the search run in
   * Mongo now; `unreadCount` still counts the WHOLE list, not the filtered set,
   * exactly as the badge always did.
   */
  async fetchNotificationsPage(params: {
    page: number;
    limit: number;
    filter?: string;
    search?: string;
  }): Promise<NotificationsResponse & { totalPages: number }> {
    const token = this.getToken();
    if (!token) throw new Error('No authentication token found');

    const query: Record<string, string> = {
      page: String(params.page),
      limit: String(params.limit),
    };
    if (params.filter && params.filter !== 'all') query.filter = params.filter;
    if (params.search?.trim()) query.search = params.search.trim();

    const response = await axios.get(`${API_BASE_URL}/get/notifications`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      params: query,
    });
    const body = response.data;
    if (!body.success) throw new Error((body.message as string) || 'Failed to fetch notifications');
    const d = body.data || {};
    return {
      notifications: d.notifications || [],
      unreadCount: d.unreadCount || 0,
      totalCount: d.totalCount || 0,
      totalPages: d.totalPages || 1,
    } as NotificationsResponse & { totalPages: number };
  }

  private async fetchNotificationsFromAPI(): Promise<NotificationsResponse> {
    const token = this.getToken();
    if (!token) {
      throw new Error('No authentication token found');
    }

    try {
      const response = await axios.get(`${API_BASE_URL}/get/notifications`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const data: ApiResponse<NotificationsResponse> = response.data;

      if (!data.success) {
        throw new Error(data.message as string || 'Failed to fetch notifications');
      }

      let notifications: Notification[] = [];
      let unreadCount = 0;
      let totalCount = 0;

      if (Array.isArray(data.data?.notifications)) {
        notifications = data.data.notifications;
        unreadCount = data.data.unreadCount ?? notifications.filter(n => !n.isRead).length;
        totalCount = data.data.totalCount ?? notifications.length;
      } else if (data.data && Array.isArray((data.data as any).notifications)) {
         // Handle nested structure if slightly different
         const d = data.data as any;
         notifications = d.notifications;
         unreadCount = d.unreadCount ?? notifications.filter(n => !n.isRead).length;
         totalCount = d.totalCount ?? notifications.length;
      }

      // Sort by date (newest first)
      const sortedNotifications = notifications.sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      return {
        data: sortedNotifications,
        notifications: sortedNotifications,
        unreadCount,
        totalCount,
      };
    } catch (error) {
      console.error('API Error fetching notifications:', error);
      throw error;
    }
  }

  /**
   * Immutable snapshot of the internal cache. The mutation paths above edit
   * `this.cache` in place — returning that same object reference made React
   * Query's structural sharing conclude "nothing changed" on refetch, so the
   * bell frequently didn't re-render on fresh data.
   */
  private snapshot(cache: NotificationsCache): NotificationsCache {
    return { ...cache, notifications: [...cache.notifications] };
  }

  async fetchNotifications(forceRefresh = false): Promise<NotificationsCache> {
    const now = Date.now();

    // Return cached data if valid and not forcing refresh
    if (!forceRefresh && this.cache && (now - this.cacheTimestamp) < CACHE_DURATION) {
      // Polling can only be armed while a cache exists; if the notifications
      // page enabled it before this first fetch resolved, start it now.
      if (this.pollingEnabled && !this.backgroundRefreshTimer) {
        this.startPolling();
      }
      return this.snapshot(this.cache);
    }

    try {
      const apiData = await this.fetchNotificationsFromAPI();

      // The interval poll used to be the only path that toasted newly
      // arrived notifications. Refreshes now flow through here (the bell's
      // refetchInterval), so keep that behavior: toast anything not present
      // in the previous cache. First-ever load stays silent — toasting the
      // whole history would be noise.
      if (this.cache) {
        const oldIds = new Set(this.cache.notifications.map(n => n._id));
        apiData.notifications
          .filter(n => !oldIds.has(n._id) && !n.isRead)
          .forEach(n => this.showNotificationToast(n));
      }

      this.cache = {
        notifications: apiData.notifications,
        unreadCount: apiData.unreadCount || 0,
        totalCount: apiData.totalCount || 0,
        lastUpdated: now,
        version: this.cacheVersion + 1,
      };
      this.cacheVersion++;
      this.cacheTimestamp = now;

      // See the cached-path comment: only the notifications page arms this.
      if (this.pollingEnabled && !this.backgroundRefreshTimer) {
        this.startPolling();
      }

      return this.snapshot(this.cache);
    } catch (error) {
      // If we have cached data and API fails, return cached data
      if (this.cache) {
        console.warn('Using cached notifications due to API error');
        return this.snapshot(this.cache);
      }
      throw error;
    }
  }

  // Enable/disable polling
  setPollingEnabled(enabled: boolean) {
    this.pollingEnabled = enabled;
    if (!enabled && this.backgroundRefreshTimer) {
      this.stopPolling();
    } else if (enabled && !this.backgroundRefreshTimer && this.cache) {
      this.startPolling();
    }
  }

  async markAsRead(notificationId: string): Promise<MarkAsReadResponse> {
    const token = this.getToken();
    if (!token) throw new Error('No authentication token found');

    try {
      const response = await axios.put(
        `${API_BASE_URL}/notifications/${notificationId}/read`,
        {},
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const data: ApiResponse<MarkAsReadResponse> = response.data;

      if (!data.success) {
        throw new Error(data.message as string || 'Failed to mark as read');
      }

      // Update cache if exists
      if (this.cache) {
        this.cache.notifications = this.cache.notifications.map(notif =>
          notif._id === notificationId ? { ...notif, isRead: true } : notif
        );
        this.cache.unreadCount = Math.max(0, this.cache.unreadCount - 1);
        this.cache.lastUpdated = Date.now();
        this.cacheVersion++;

        // Notify subscribers
        window.dispatchEvent(new CustomEvent('notificationsUpdated', {
          detail: { 
            notifications: this.cache.notifications, 
            unreadCount: this.cache.unreadCount,
            version: this.cacheVersion 
          }
        }));
      }

      return data.data || { success: true };
    } catch (error) {
      // Fallback: Update cache locally even if API fails (Optimistic UI)
      if (this.cache) {
        const notification = this.cache.notifications.find(n => n._id === notificationId);
        if (notification && !notification.isRead) {
          this.cache.notifications = this.cache.notifications.map(notif =>
            notif._id === notificationId ? { ...notif, isRead: true } : notif
          );
          this.cache.unreadCount = Math.max(0, this.cache.unreadCount - 1);
          this.cache.lastUpdated = Date.now();
          this.cacheVersion++;

          window.dispatchEvent(new CustomEvent('notificationsUpdated', {
            detail: { 
              notifications: this.cache.notifications, 
              unreadCount: this.cache.unreadCount, 
              version: this.cacheVersion 
            }
          }));
        }
      }
      throw error;
    }
  }

  // --- NEW: Toggle Favorite Notification ---
  async toggleFavorite(notificationId: string): Promise<ToggleFavoriteResponse> {
    const token = this.getToken();
    if (!token) throw new Error('No authentication token found');

    try {
      const response = await axios.put(
        `${API_BASE_URL}/favorite/notifications/${notificationId}`,
        {},
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );
      
      const data: ApiResponse<ToggleFavoriteResponse> = response.data;

      if (!data.success) {
        throw new Error(data.message as string || 'Failed to toggle favorite');
      }

      // Update Cache immediately
      if (this.cache) {
        this.cache.notifications = this.cache.notifications.map(notif =>
          notif._id === notificationId ? { ...notif, isFavorite: !notif.isFavorite } : notif
        );
        this.cache.lastUpdated = Date.now();
        this.cacheVersion++;

        // Notify UI to re-render
        window.dispatchEvent(new CustomEvent('notificationsUpdated', {
          detail: { 
            notifications: this.cache.notifications, 
            unreadCount: this.cache.unreadCount, 
            version: this.cacheVersion 
          }
        }));
      }

      return data.data as any; // Cast to ensure type compatibility
    } catch (error) {
      console.error('Error toggling favorite:', error);
      throw error;
    }
  }

  async markAllAsRead(): Promise<MarkAsReadResponse> {
    const token = this.getToken();
    if (!token) throw new Error('No authentication token found');

    try {
      const response = await axios.put(
        `${API_BASE_URL}/notifications/read-all`,
        {},
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const data: ApiResponse<MarkAsReadResponse> = response.data;

      if (!data.success) {
        throw new Error(data.message as string || 'Failed to mark all as read');
      }

      // Update cache if exists
      if (this.cache) {
        this.cache.notifications = this.cache.notifications.map(notif => ({
          ...notif,
          isRead: true
        }));
        this.cache.unreadCount = 0;
        this.cache.lastUpdated = Date.now();
        this.cacheVersion++;

        window.dispatchEvent(new CustomEvent('notificationsUpdated', {
          detail: { 
            notifications: this.cache.notifications, 
            unreadCount: this.cache.unreadCount, 
            version: this.cacheVersion 
          }
        }));
      }

      return data.data || { success: true };
    } catch (error) {
      // Fallback: Update cache locally
      if (this.cache) {
        this.cache.notifications = this.cache.notifications.map(notif => ({
          ...notif,
          isRead: true
        }));
        this.cache.unreadCount = 0;
        this.cache.lastUpdated = Date.now();
        this.cacheVersion++;

        window.dispatchEvent(new CustomEvent('notificationsUpdated', {
          detail: { 
            notifications: this.cache.notifications, 
            unreadCount: this.cache.unreadCount, 
            version: this.cacheVersion 
          }
        }));
      }
      throw error;
    }
  }

  async deleteNotification(notificationId: string): Promise<DeleteResponse> {
    const token = this.getToken();
    if (!token) throw new Error('No authentication token found');

    try {
      const response = await axios.delete(
        `${API_BASE_URL}/delete-one/notifications/${notificationId}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const data: ApiResponse<DeleteResponse> = response.data;

      if (!data.success) {
        throw new Error(data.message as string || 'Failed to delete notification');
      }

      // Update cache if exists
      if (this.cache) {
        const deletedNotification = this.cache.notifications.find(n => n._id === notificationId);
        
        this.cache.notifications = this.cache.notifications.filter(
          notif => notif._id !== notificationId
        );
        
        if (deletedNotification && !deletedNotification.isRead) {
          this.cache.unreadCount = Math.max(0, this.cache.unreadCount - 1);
        }
        
        this.cache.totalCount = this.cache.notifications.length;
        this.cache.lastUpdated = Date.now();
        this.cacheVersion++;

        window.dispatchEvent(new CustomEvent('notificationsUpdated', {
          detail: { 
            notifications: this.cache.notifications, 
            unreadCount: this.cache.unreadCount, 
            version: this.cacheVersion 
          }
        }));
      }

      return data.data || { success: true };
    } catch (error) {
      console.error('Error deleting notification:', error);
      throw error;
    }
  }

  async deleteAllNotifications(): Promise<DeleteResponse> {
    const token = this.getToken();
    if (!token) throw new Error('No authentication token found');

    try {
      const response = await axios.delete(
        `${API_BASE_URL}/delete-all/notifications`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const data: ApiResponse<DeleteResponse> = response.data;

      if (!data.success) {
        throw new Error(data.message as string || 'Failed to delete all notifications');
      }

      // Clear cache
      this.cache = {
        notifications: [],
        unreadCount: 0,
        totalCount: 0,
        lastUpdated: Date.now(),
        version: this.cacheVersion + 1,
      };
      this.cacheVersion++;

      window.dispatchEvent(new CustomEvent('notificationsUpdated', {
        detail: { 
          notifications: [], 
          unreadCount: 0, 
          version: this.cacheVersion 
        }
      }));

      return data.data || { success: true };
    } catch (error) {
      console.error('Error deleting all notifications:', error);
      throw error;
    }
  }

  invalidateCache() {
    this.cache = null;
    this.cacheTimestamp = 0;
    this.cacheVersion = 0;
    this.stopPolling();
  }
}

// Export singleton instance
export const notificationsService = NotificationsService.getInstance();

// Export types
export type { NotificationsResponse, MarkAsReadResponse, DeleteResponse };

// React Query hooks wrapper keys
export const notificationKeys = {
  all: ['notifications'] as const,
  lists: () => [...notificationKeys.all, 'list'] as const,
  list: (filters: any) => [...notificationKeys.lists(), { filters }] as const,
  details: () => [...notificationKeys.all, 'detail'] as const,
  detail: (id: string) => [...notificationKeys.details(), id] as const,
  stats: () => [...notificationKeys.all, 'stats'] as const,
};