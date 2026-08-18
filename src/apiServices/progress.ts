// apiServices/progress.ts
import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5533';

export interface StudentProgress {
  visitedNodes: string[];
  openedResources: string[];
  completedExercises: string[];
  lastVisitedNode: string;
  lastVisitedAt: Date | null;
}

/**
 * Record a node visit (when user clicks on module/submodule/topic/subtopic)
 */
export const recordNodeVisit = async (
  userId: string,
  courseId: string,
  nodeId: string,
  nodeName?: string,
  nodeType?: string
): Promise<{ success: boolean }> => {
  try {
    const token = localStorage.getItem('smartcliff_token');
    if (!token) return { success: false };

    const response = await axios.patch(
      `${API_BASE_URL}/progress/${userId}/courses/${courseId}/visit-node`,
      { nodeId, nodeName: nodeName || nodeId, nodeType: nodeType || '' },
      { headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, timeout: 5000 }
    );
    return { success: response.data.success };
  } catch (error) {
    return { success: false };
  }
};

/**
 * Record a resource open (when user opens PDF, video, PPT, ZIP, link, etc.)
 * Returns the created activity-log id so the caller can stamp a close time / view
 * duration on that exact record later.
 */
export const recordResourceOpen = async (
  userId: string,
  courseId: string,
  resourceId: string,
  resourceName?: string,
  resourceType?: string,
  method?: string,   // 'I_Do' | 'We_Do' | 'You_Do'
  nodeName?: string, // associated module/topic name
  nodeType?: string  // 'module' | 'submodule' | 'topic' | 'subtopic'
): Promise<{ success: boolean; logId?: string | null }> => {
  try {
    const token = localStorage.getItem('smartcliff_token');
    if (!token) return { success: false };

    const response = await axios.patch(
      `${API_BASE_URL}/progress/${userId}/courses/${courseId}/open-resource`,
      {
        resourceId,
        resourceName: resourceName || resourceId,
        resourceType: resourceType || '',
        method: method || null,
        nodeName: nodeName || null,
        nodeType: nodeType || null,
      },
      { headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, timeout: 5000 }
    );
    return { success: response.data.success, logId: response.data?.data?.logId ?? null };
  } catch (error) {
    return { success: false };
  }
};

/**
 * Record a resource close — stamps the view duration (seconds) + close time on the
 * resource_open log created at open time.
 * Pass { keepalive: true } for the tab-close / page-hide path so the request still
 * goes out while the page is unloading.
 */
export const recordResourceClose = async (
  userId: string,
  courseId: string,
  logId: string,
  durationSec: number,
  opts?: { keepalive?: boolean }
): Promise<void> => {
  try {
    const token = localStorage.getItem('smartcliff_token');
    const url = `${API_BASE_URL}/progress/${userId}/courses/${courseId}/close-resource`;
    const payload = { logId, duration: durationSec, closedAt: new Date().toISOString() };

    if (opts?.keepalive) {
      await fetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(payload),
        keepalive: true,
      });
      return;
    }

    await axios.patch(url, payload, {
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      timeout: 5000,
    });
  } catch {
    // best effort
  }
};

/**
 * Record when a student selects an I Do / We Do / You Do method tab
 */
export const recordMethodSelect = async (
  userId: string,
  courseId: string,
  method: string,
  nodeId?: string,
  nodeName?: string
): Promise<void> => {
  try {
    const token = localStorage.getItem('smartcliff_token');
    if (!token) return;
    await axios.patch(
      `${API_BASE_URL}/progress/${userId}/courses/${courseId}/select-method`,
      { method, nodeId: nodeId || null, nodeName: nodeName || null },
      { headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, timeout: 5000 }
    );
  } catch { }
};

/**
 * Record when a student selects a subcategory/activity (Presentation, Practice, etc.)
 */
export const recordActivitySelect = async (
  userId: string,
  courseId: string,
  method: string,
  activity: string,
  nodeId?: string,
  nodeName?: string
): Promise<void> => {
  try {
    const token = localStorage.getItem('smartcliff_token');
    if (!token) return;
    await axios.patch(
      `${API_BASE_URL}/progress/${userId}/courses/${courseId}/select-activity`,
      { method, activity, nodeId: nodeId || null, nodeName: nodeName || null },
      { headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, timeout: 5000 }
    );
  } catch { }
};

/**
 * Fetch student progress for a specific course
 */
export const fetchStudentProgress = async (
  userId: string,
  courseId: string
): Promise<StudentProgress | null> => {
  try {
    const token = localStorage.getItem('smartcliff_token');
    
    if (!token) {
      console.warn('No auth token found, cannot fetch progress');
      return null;
    }

    const response = await axios.get(
      `${API_BASE_URL}/progress/${userId}/courses/${courseId}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      }
    );

    if (response.data.success && response.data.data?.progress) {
      return response.data.data.progress;
    }
    
    return {
      visitedNodes: [],
      openedResources: [],
      completedExercises: [],
      lastVisitedNode: '',
      lastVisitedAt: null
    };
  } catch (error) {
    console.error('Failed to fetch student progress:', error);
    return null;
  }
};