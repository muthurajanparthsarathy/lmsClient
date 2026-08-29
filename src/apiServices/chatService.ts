const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5533";

// Get all chat sessions for the authenticated user
export const getChatSessions = async (token: string) => {
  try {
    const response = await fetch(`${API_URL}/api/chat/sessions`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `Failed to fetch chat sessions: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching chat sessions:', error);
    throw error;
  }
};

// Create a new chat session
export const createChatSession = async (sessionData: {
  title?: string;
  context?: any;
  initialMessage?: boolean;
}, token: string) => {
  try {
    const response = await fetch(`${API_URL}/api/chat/sessions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(sessionData)
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `Failed to create chat session: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error creating chat session:', error);
    throw error;
  }
};

// Add a message to an existing chat session
export const addMessage = async (sessionId: string, messageData: {
  content: string;
  role: 'user' | 'assistant';
  metadata?: any;
}, token: string) => {
  try {
    const response = await fetch(`${API_URL}/api/chat/sessions/${sessionId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(messageData)
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `Failed to add message: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error adding message:', error);
    throw error;
  }
};

// Update a chat session's title
export const updateSessionTitle = async (sessionId: string, title: string, token: string) => {
  try {
    const response = await fetch(`${API_URL}/api/chat/sessions/${sessionId}/title`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ title })
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `Failed to update session title: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error updating session title:', error);
    throw error;
  }
};

// Delete a chat session
export const deleteChatSession = async (sessionId: string, token: string) => {
  try {
    const response = await fetch(`${API_URL}/api/chat/sessions/${sessionId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `Failed to delete chat session: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error deleting chat session:', error);
    throw error;
  }
};

// Clear all chat sessions (optional)
export const clearAllSessions = async (token: string) => {
  try {
    const response = await fetch(`${API_URL}/api/chat/sessions`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `Failed to clear all sessions: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error clearing all sessions:', error);
    throw error;
  }
};

// Toggle archive status of a session (optional)
export const toggleArchiveSession = async (sessionId: string, isArchived: boolean, token: string) => {
  try {
    const response = await fetch(`${API_URL}/api/chat/sessions/${sessionId}/archive`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ isArchived })
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `Failed to archive session: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error archiving session:', error);
    throw error;
  }
};

// Get a specific chat session by ID (optional)
export const getChatSession = async (sessionId: string, token: string) => {
  try {
    const response = await fetch(`${API_URL}/api/chat/sessions/${sessionId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `Failed to fetch chat session: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching chat session:', error);
    throw error;
  }
};