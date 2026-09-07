  import axios from 'axios';

  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://lmsserver-yeve.onrender.com';

  // Configure axios instance
  const apiClient = axios.create({
    baseURL: API_BASE_URL,
    headers: {
      'Content-Type': 'application/json',
    },
    timeout: 10000,
  });

  // Note: Token handling removed from interceptor - will be passed from component
  apiClient.interceptors.request.use((config) => {
    return config;
  });

  // Add response interceptor for better error handling
  apiClient.interceptors.response.use(
    (response) => response,
    (error) => {
      return Promise.reject(error);
    }
  );

  export interface NoteAnchor {
    page?: number
    timestamp?: number
  }

  export interface Note {
    _id: string
    title: string
    content: string
    createdAt: string
    updatedAt: string
    lastEdited: string
    tags: string[]
    isPinned: boolean
    color: string
    resourceId?: string
    resourceType?: 'pdf' | 'ppt' | 'video'
    anchor?: NoteAnchor
  }

  export interface NotesResponse {
    success: boolean
    data: Note[]
    message?: string
  }

  export interface NoteResponse {
    success: boolean
    data: Note
    message?: string
  }

  // Enhanced caching with version tracking
  let notesCache: Note[] | null = null;
  let cacheTimestamp: number = 0;
  let cacheVersion: number = 0;
  const CACHE_DURATION = 15 * 60 * 1000; // 15 minutes
  const BACKGROUND_REFRESH_INTERVAL = 2 * 60 * 1000; // 2 minutes

  // Store for tracking data changes
  let lastDataHash: string = '';
  let backgroundRefreshTimer: NodeJS.Timeout | null = null;

  // Helper function to create a simple hash of data
  const createDataHash = (data: any): string => {
    return JSON.stringify(data).length.toString() + data.length.toString();
  };

  // Start background refresh for live updates
  const startBackgroundRefresh = (token: string) => {
    if (backgroundRefreshTimer) {
      clearInterval(backgroundRefreshTimer);
    }

    backgroundRefreshTimer = setInterval(async () => {
      try {
        // Only do background refresh if we have cached data
        if (notesCache) {
          const response = await apiClient.get('/getAll/notes', {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });
          const newNotes = response.data.data;
          const newHash = createDataHash(newNotes);

          // If data changed, update cache and increment version
          if (newHash !== lastDataHash) {
            notesCache = newNotes;
            cacheTimestamp = Date.now();
            cacheVersion++;
            lastDataHash = newHash;

            // Trigger a custom event to notify components
            window.dispatchEvent(new CustomEvent('notesDataUpdated', {
              detail: { notes: newNotes, version: cacheVersion }
            }));
          }
        }
      } catch (error) {
        console.warn('Background refresh failed:', error);
      }
    }, BACKGROUND_REFRESH_INTERVAL);
  };

  // Stop background refresh
  const stopBackgroundRefresh = () => {
    if (backgroundRefreshTimer) {
      clearInterval(backgroundRefreshTimer);
      backgroundRefreshTimer = null;
    }
  };

  // Enhanced fetchNotes function - token passed as parameter
  export const fetchNotes = async (token: string, forceRefresh = false): Promise<Note[]> => {
    const now = Date.now();

    if (!forceRefresh && notesCache && (now - cacheTimestamp) < CACHE_DURATION) {
      if (!backgroundRefreshTimer) {
        startBackgroundRefresh(token);
      }
      return notesCache;
    }

    try {
      const response = await apiClient.get('/getAll/notes', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      
      // Fix: Handle different response structures
      let notes: Note[];
      
      if (response.data && Array.isArray(response.data.data)) {
        // If data is directly in response.data.data
        notes = response.data.data;
      } else if (response.data && response.data.notes) {
        // If notes are nested in user object
        notes = response.data.notes;
      } else {
        // Fallback to empty array
        notes = [];
      }

      const newHash = createDataHash(notes);
      notesCache = notes;
      cacheTimestamp = now;
      lastDataHash = newHash;

      if (forceRefresh || !cacheVersion) {
        cacheVersion++;
      }

      startBackgroundRefresh(token);
      return notes;
    } catch (error) {
      if (notesCache) {
        console.warn('Using cached data due to API error:', error);
        return notesCache;
      }
      throw error;
    }
  };

  // Function to invalidate notes cache
  export const invalidateNotesCache = () => {
    notesCache = null;
    cacheTimestamp = 0;
    cacheVersion = 0;
    lastDataHash = '';
    stopBackgroundRefresh();
  };

  // Enhanced createNote function - token passed as parameter
  export const createNote = async (noteData: Partial<Note>, token: string): Promise<Note> => {
    try {
      const response = await apiClient.post('/create/notes', noteData, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      // Invalidate cache to force fresh data on next request
      invalidateNotesCache();

      return response.data.data;
    } catch (error: any) {
      console.error('Error creating note:', error);
      
      // Enhanced error handling
      if (error.response?.data?.message) {
        const errorMessages = error.response.data.message;
        if (Array.isArray(errorMessages)) {
          const errorMessage = errorMessages.map((msg: { value: string }) => msg.value).join(', ');
          throw new Error(errorMessage);
        } else {
          throw new Error(errorMessages);
        }
      }
      
      throw new Error(error.message || 'Failed to create note');
    }
  };

  // Enhanced updateNote function - token passed as parameter
  export const updateNote = async (noteId: string, noteData: Partial<Note>, token: string): Promise<Note> => {
    try {
      const response = await apiClient.put(`/update/notes/${noteId}`, noteData, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      // Invalidate cache to force fresh data on next request
      invalidateNotesCache();

      return response.data.data;
    } catch (error: any) {
      console.error('Error updating note:', error);
      
      if (error.response?.data?.message) {
        const errorMessages = error.response.data.message;
        if (Array.isArray(errorMessages)) {
          const errorMessage = errorMessages.map((msg: { value: string }) => msg.value).join(', ');
          throw new Error(errorMessage);
        } else {
          throw new Error(errorMessages);
        }
      }
      
      throw new Error(error.message || 'Failed to update note');
    }
  };

  // Enhanced deleteNote function - token passed as parameter
  export const deleteNote = async (noteId: string, token: string): Promise<void> => {
    try {
      await apiClient.delete(`/delete/notes/ById/${noteId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      // Invalidate cache to force fresh data on next request
      invalidateNotesCache();
    } catch (error: any) {
      console.error('Error deleting note:', error);
      
      if (error.response?.data?.message) {
        const errorMessages = error.response.data.message;
        if (Array.isArray(errorMessages)) {
          const errorMessage = errorMessages.map((msg: { value: string }) => msg.value).join(', ');
          throw new Error(errorMessage);
        } else {
          throw new Error(errorMessages);
        }
      }
      
      throw new Error(error.message || 'Failed to delete note');
    }
  };
  // Get single note by ID - token passed as parameter
  // Add this to your notesService.ts
  export const getNoteById = async (noteId: string, token: string): Promise<Note> => {
    try {
      const response = await apiClient.get(`/getById/notes/${noteId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      
      return response.data.data;
    } catch (error: any) {
      console.error('Error fetching note by ID:', error);
      
      if (error.response?.data?.message) {
        throw new Error(error.response.data.message);
      }
      
      throw new Error(error.message || 'Failed to fetch note');
    }
  };
  // Enhanced togglePinNote function - token passed as parameter
    export const togglePinNote = async (noteId: string, token: string): Promise<Note> => {
      try {
        const response = await apiClient.put(`/toggle-pin/notes/${noteId}`, {}, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        // Invalidate cache to force fresh data on next request
        invalidateNotesCache();

        return response.data.data;
      } catch (error: any) {
        console.error('Error toggling pin:', error);
        
        if (error.response?.data?.message) {
          const errorMessages = error.response.data.message;
          if (Array.isArray(errorMessages)) {
            const errorMessage = errorMessages.map((msg: { value: string }) => msg.value).join(', ');
            throw new Error(errorMessage);
          } else {
            throw new Error(errorMessages);
          }
        }
        
        throw new Error(error.message || 'Failed to toggle pin');
      }
    };

  // Fetch notes anchored to a specific resource (PDF/PPT/Video). Bypasses the
  // global 15-min cache since viewers need fresh anchor data on open.
  export const fetchNotesByResource = async (
    resourceId: string,
    type: 'pdf' | 'ppt' | 'video',
    token: string
  ): Promise<Note[]> => {
    if (!resourceId) return [];
    try {
      const response = await apiClient.get(
        `/notes/byResource/${encodeURIComponent(resourceId)}?type=${type}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = response.data?.data;
      return Array.isArray(data) ? data : [];
    } catch (error: any) {
      console.error('Error fetching notes by resource:', error);
      return [];
    }
  };

  // Search notes - token passed as parameter
  export const searchNotes = async (query: string, token: string): Promise<Note[]> => {
    try {
      const response = await apiClient.get(`/notes/search?q=${encodeURIComponent(query)}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      return response.data.data;
    } catch (error: any) {
      console.error('Error searching notes:', error);
      throw new Error(error.message || 'Search failed');
    }
  };

  // Get notes by tags - token passed as parameter
  export const getNotesByTags = async (tags: string[], token: string): Promise<Note[]> => {
    try {
      const response = await apiClient.post('/notes/by-tags', { tags }, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      return response.data.data;
    } catch (error: any) {
      console.error('Error fetching notes by tags:', error);
      throw new Error(error.message || 'Failed to fetch notes by tags');
    }
  };

  // Cleanup function for component unmount
  export const cleanupNotesService = () => {
    stopBackgroundRefresh();
  };

  // Get cache info
  export const getNotesCacheInfo = () => ({
    hasCache: !!notesCache,
    cacheAge: notesCache ? Date.now() - cacheTimestamp : 0,
    cacheSize: notesCache ? notesCache.length : 0,
    version: cacheVersion
  });

  // Export for testing or direct use
  export default {
    fetchNotes,
    createNote,
    updateNote,
    deleteNote,
    togglePinNote,
    searchNotes,
    getNotesByTags,
    invalidateNotesCache,
    cleanupNotesService,
    getNotesCacheInfo
  };