"use client"
import { getToken } from "@/lib/session";

import { useState, useRef, useEffect } from "react"
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { X, Send, Bot, User, Loader2, Maximize2, Minimize2, ArrowUpDown, Plus, Trash2, Clock, History, MoreVertical, RefreshCw, Copy, Check, Download, Bookmark, AlertCircle, FileText } from "lucide-react"

// --- FIX: UNCOMMENTED/ADDED THE ACTUAL API IMPORT ---
import { createNote } from "@/apiServices/notesPanelService" 
// ----------------------------------------------------

interface Message {
  content: string
  role: "user" | "assistant"
  timestamp: Date
  metadata?: {
    context?: {
      topicTitle?: string
      fileName?: string
      fileType?: string
      isDocumentView?: boolean
    }
  }
  id?: string
}

interface ChatSession {
  _id?: string
  sessionId: string
  title: string
  messages: Message[]
  context?: {
    topicTitle?: string
    fileName?: string
    fileType?: string
    isDocumentView?: boolean
  }
  isArchived?: boolean
  lastMessageAt: Date
  messageCount: number
  createdAt?: Date
  updatedAt?: Date
}

interface AIChatProps {
  isOpen: boolean
  onClose: () => void
  embedded?: boolean
  context?: {
    topicTitle?: string
    fileName?: string
    fileType?: string
    isDocumentView?: boolean
  }
}

type ExpandMode = "compact" | "expanded" | "fullscreen"

const GEMINI_API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY ?? ""
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent?key=${GEMINI_API_KEY}`;
const generateLocalFallback = (userInput: string): string => {
  const messageLower = userInput.toLowerCase();
  
  if (messageLower.includes('hello') || messageLower.includes('hi')) {
    return "Hello! I'm your AI assistant powered by Gemini. I'm here to help you learn, create, and explore new ideas!";
  }
  
  if (userInput.includes('?')) {
    return `That's a great question about "${userInput.substring(0, 50)}...". I'd love to help you explore this topic further!`;
  }
  
  const fallbacks = [
    `Thanks for sharing your thoughts about "${userInput.substring(0, 50)}...". Let's dive deeper into this!`,
    `Interesting! Regarding "${userInput.substring(0, 50)}...", what specific aspect would you like to learn more about?`,
    `I appreciate your message about "${userInput.substring(0, 50)}...". This sounds like a wonderful topic to explore together!`
  ];
  
  return fallbacks[Math.floor(Math.random() * fallbacks.length)];
}

const LONG_MESSAGE_THRESHOLD = 400;

// Generate unique ID function
const generateUniqueId = () => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

export default function AIChat({ isOpen, onClose, embedded = false, context }: AIChatProps) {
  const [sessions, setSessions] = useState<ChatSession[]>([
    {
      sessionId: "default_1",
      title: "Gemini AI",
      messages: [
        {
          content: "Hello! I'm your AI assistant powered by Gemini. How can I help you today?",
          role: "assistant",
          timestamp: new Date(),
          id: generateUniqueId()
        }
      ],
      lastMessageAt: new Date(),
      messageCount: 1
    }
  ])
  
  const [currentSessionId, setCurrentSessionId] = useState<string>("default_1")
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [expandMode, setExpandMode] = useState<ExpandMode>("compact")
  const [showHistorySidebar, setShowHistorySidebar] = useState(false)
  const [showSessionMenu, setShowSessionMenu] = useState(false)
  const [isStreaming, setIsStreaming] = useState<boolean>(false)
  const [streamingMessage, setStreamingMessage] = useState<string>("")
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null)
  const [aiStatus, setAiStatus] = useState<"connected" | "disconnected" | "checking">("checking")
  const [apiError, setApiError] = useState<string | null>(null)
  
  // --- NEW STATES FOR SAVE TO NOTES MODAL ---
  const [showSaveToNotesModal, setShowSaveToNotesModal] = useState(false)
  const [noteContent, setNoteContent] = useState("")
  const [noteTitle, setNoteTitle] = useState("")
  const [isSavingNote, setIsSavingNote] = useState(false)
  const [noteSaveSuccess, setNoteSaveSuccess] = useState(false)
  // -----------------------------------------
  
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const sessionMenuRef = useRef<HTMLDivElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  const currentSession = sessions.find(s => s.sessionId === currentSessionId)
  const messages = currentSession?.messages || []

  const testAIConnection = async () => {
    try {
      setAiStatus("checking");
      setApiError(null);
      
      const testResponse = await fetch(GEMINI_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [{ 
            parts: [{ text: "Hello" }], 
            role: "user" 
          }],
          generationConfig: {
            maxOutputTokens: 10
          }
        })
      });
      
      if (testResponse.ok) {
        setAiStatus("connected");
        return true;
      } else {
        const errorData = await testResponse.json();
        setApiError(errorData.error?.message || "API connection failed");
        setAiStatus("disconnected");
        return false;
      }
    } catch (error) {
      console.error('Connection test failed:', error);
      setApiError("Network error. Please check your connection.");
      setAiStatus("disconnected");
      return false;
    }
  };

  const callGeminiAI = async (userInput: string): Promise<string> => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    abortControllerRef.current = new AbortController();
    setApiError(null);
    
    try {
      const conversationHistory = currentSession?.messages.map(msg => ({
        role: msg.role === "user" ? "user" : "model",
        parts: [{ text: msg.content }]
      })) || [];
      
      const currentUserMessage = {
        role: "user" as const,
        parts: [{ text: userInput }]
      };
      
      const allMessages = [...conversationHistory, currentUserMessage];
      
      const response = await fetch(GEMINI_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: allMessages,
          generationConfig: {
            temperature: 0.7,
            topK: 1,
            topP: 0.95,
            maxOutputTokens: 2048,
          }
        }),
        signal: abortControllerRef.current.signal
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('API error response:', errorText);
        throw new Error(`API request failed: ${response.status}`);
      }

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (!text) {
        throw new Error("No response generated from AI");
      }
      
      return text;
      
    } catch (error: any) {
      if (error.name === 'AbortError') {
        return "Request was cancelled.";
      }
      
      setApiError(error.message || "Failed to connect to AI service");
      return generateLocalFallback(userInput);
    }
  };

  const handleSend = async () => {
    const finalInput = input.trim()
    if (!finalInput || isLoading) return

    const userMessage: Message = {
      content: finalInput,
      role: "user",
      timestamp: new Date(),
      metadata: { context },
      id: generateUniqueId()
    }

    setSessions(prev => prev.map(session => 
      session.sessionId === currentSessionId 
        ? {
            ...session,
            messages: [...session.messages, userMessage],
            lastMessageAt: new Date(),
            messageCount: session.messageCount + 1,
            title: session.messages.length === 0 ? 
              finalInput.substring(0, 30) + (finalInput.length > 30 ? '...' : '') : 
              session.title
          }
        : session
    ))
    
    setInput("")
    setIsLoading(true)
    
    try {
      const aiResponseContent = await callGeminiAI(finalInput)
      
      const aiResponse: Message = {
        content: aiResponseContent,
        role: "assistant",
        timestamp: new Date(),
        metadata: { context },
        id: generateUniqueId()
      }

      setSessions(prev => prev.map(session => 
        session.sessionId === currentSessionId 
          ? {
              ...session,
              messages: [...session.messages, aiResponse],
              lastMessageAt: new Date(),
              messageCount: session.messageCount + 1
            }
          : session
      ))
      
    } catch (error: any) {
      console.error('Error in chat:', error)
      const errorResponse: Message = {
        content: "I'm having trouble connecting to the AI service. Please check your connection and try again.",
        role: "assistant",
        timestamp: new Date(),
        metadata: { context },
        id: generateUniqueId()
      }

      setSessions(prev => prev.map(session => 
        session.sessionId === currentSessionId 
          ? {
              ...session,
              messages: [...session.messages, errorResponse],
              lastMessageAt: new Date(),
              messageCount: session.messageCount + 1
            }
          : session
      ))
    } finally {
      setIsLoading(false)
    }
  }

  const quickSuggestions = [
    "Explain quantum computing",
    "Help me write a poem",
    "What is machine learning?",
    "Give me study tips"
  ]

  const createNewSession = () => {
    const newSession: ChatSession = {
      sessionId: `chat_${Date.now()}`,
      title: "New Chat",
      messages: [{
        content: "Hello! I'm your AI assistant. How can I help you today?",
        role: "assistant",
        timestamp: new Date(),
        metadata: { context },
        id: generateUniqueId()
      }],
      context: context,
      lastMessageAt: new Date(),
      messageCount: 1
    }
    
    const updatedSessions = [newSession, ...sessions]
    setSessions(updatedSessions)
    setCurrentSessionId(newSession.sessionId)
    setShowSessionMenu(false)
    setApiError(null)
  }

  const switchSession = (sessionId: string) => {
    setCurrentSessionId(sessionId)
    setApiError(null)
  }

  const deleteSession = (sessionId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    
    if (sessions.length <= 1) {
      return
    }
    
    const updatedSessions = sessions.filter(s => s.sessionId !== sessionId)
    setSessions(updatedSessions)
    
    if (sessionId === currentSessionId) {
      setCurrentSessionId(updatedSessions[0]?.sessionId || "")
    }
  }

  const clearCurrentChat = () => {
    const updatedSessions = sessions.map(session => {
      if (session.sessionId === currentSessionId) {
        return {
          ...session,
          title: "New Chat",
          messages: [{
            content: "Hello! I'm your AI assistant. How can I help you today?",
            role: "assistant",
            timestamp: new Date(),
            metadata: { context },
            id: generateUniqueId()
          }],
          lastMessageAt: new Date(),
          messageCount: 1
        }
      }
      return session
    })
    
    setSessions(updatedSessions)
    setShowSessionMenu(false)
    setApiError(null)
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleHeightExpand = () => {
    if (expandMode === "compact") {
      setExpandMode("expanded")
    } else if (expandMode === "expanded") {
      setExpandMode("compact")
    } else {
      setExpandMode("fullscreen")
    }
  }

  const handleFullMaximize = () => {
    if (expandMode === "fullscreen") {
      setExpandMode("compact")
    } else {
      setExpandMode("fullscreen")
    }
  }

  const getContainerClasses = () => {
    if (embedded) {
      return "relative w-full h-full bg-white flex flex-col overflow-hidden"
    }
    const baseClasses = "fixed bg-white flex flex-col z-50 transition-all duration-300 shadow-xl border border-gray-200 rounded-lg overflow-hidden"
    switch (expandMode) {
      case "compact":
        return `${baseClasses} w-96 h-[500px] bottom-0 right-6 rounded-b-lg`
      case "expanded":
        return `${baseClasses} w-[500px] h-[600px] bottom-0 right-6 rounded-b-lg`
      case "fullscreen":
        return `${baseClasses} w-full h-full top-0 left-0 right-0 bottom-0 rounded-none border-0`
    }
  }

  const formatDate = (date: Date) => {
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / (1000 * 60))
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    
    if (diffMins < 1) return "Just now"
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' })
  }

  const handleCopyMessage = async (content: string, messageId?: string) => {
    try {
      await navigator.clipboard.writeText(content)
      if (messageId) {
        setCopiedMessageId(messageId)
        setTimeout(() => setCopiedMessageId(null), 2000)
      }
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  const handleDownloadMessage = (content: string, title: string = "AI Chat") => {
    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${title.replace(/[^a-z0-9]/gi, '_')}-${new Date().toISOString().split('T')[0]}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  // --- REVISED FUNCTION FOR SAVE TO NOTES ---
  const handleSaveToNotes = (content: string, messageId?: string, defaultTitle: string = "AI Chat Note") => {
    // Use the current session title or default
    const noteTitle = currentSession?.title || defaultTitle;
    
    // Set up modal with the content
    setNoteContent(content);
    setNoteTitle(`[AI Chat] ${noteTitle}`);
    setShowSaveToNotesModal(true);
  }
// --- REVISED saveNoteToPanel FUNCTION ---
const saveNoteToPanel = async () => {
  if (!noteTitle.trim() || !noteContent.trim()) return;

  setIsSavingNote(true);
  
  try {
    // Get token from localStorage
    const token = getToken();
    
    // Prepare note data - ensure it matches your API expected format
    const noteData = {
      title: noteTitle,
      content: noteContent,
      tags: ['ai-chat'],
      isPinned: false,
      color: "#ffffff",
      // Add any other required fields based on your API
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    console.log('Saving note with data:', noteData); // Debug log
    
    // Make the API call to create note
    let createdNote;
    
    if (token) {
      // Call with token if authentication is required
      createdNote = await createNote(noteData, token);
    } else {
      // Call without token if authentication is not required
      createdNote = await createNote(noteData);
    }
    
    console.log('Created note response:', createdNote); // Debug log
    
    if (!createdNote || !createdNote._id) {
      throw new Error('No note ID returned from API');
    }
    
    // Store the created note ID and full note in localStorage
    localStorage.setItem('lastCreatedNoteId', createdNote._id);
    localStorage.setItem('lastCreatedNote', JSON.stringify(createdNote));
    
    // Also store in a notes array to ensure it's available
    const existingNotes = JSON.parse(localStorage.getItem('aiChatNotes') || '[]');
    const updatedNotes = [createdNote, ...existingNotes];
    localStorage.setItem('aiChatNotes', JSON.stringify(updatedNotes));
    
    // Show success notification
    setNoteSaveSuccess(true);
    setShowSaveToNotesModal(false);
    
    // Dispatch events to notify other components with proper data
    window.dispatchEvent(new CustomEvent('notesDataUpdated', {
      detail: { 
        action: 'created', 
        noteId: createdNote._id,
        noteTitle: noteTitle,
        noteContent: noteContent,
        note: createdNote,
        timestamp: new Date().toISOString()
      }
    }));
    
    // Dispatch refresh event
    window.dispatchEvent(new CustomEvent('refreshNotes', {
      detail: { 
        source: 'ai-chat',
        noteId: createdNote._id
      }
    }));

    // Also trigger a custom event that your notes panel might be listening for
    window.dispatchEvent(new CustomEvent('aiChatNoteSaved', {
      detail: {
        note: createdNote,
        fromChat: true
      }
    }));

  } catch (error: any) {
    console.error('Error saving note:', error);
    setApiError(`Failed to save note: ${error.message}`);
    
    // Fallback: Try to save note in localStorage as backup
    try {
      const fallbackNote = {
        _id: `local_${Date.now()}`,
        title: noteTitle,
        content: noteContent,
        tags: ['ai-chat'],
        isPinned: false,
        color: "#ffffff",
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      localStorage.setItem('lastCreatedNoteId', fallbackNote._id);
      localStorage.setItem('lastCreatedNote', JSON.stringify(fallbackNote));
      
      // Still show success but with localStorage backup
      setNoteSaveSuccess(true);
      setShowSaveToNotesModal(false);
      
      window.dispatchEvent(new CustomEvent('notesDataUpdated', {
        detail: { 
          action: 'created', 
          noteId: fallbackNote._id,
          noteTitle: noteTitle,
          source: 'localStorage'
        }
      }));
      
    } catch (fallbackError) {
      console.error('Fallback save also failed:', fallbackError);
    }
  } finally {
    setIsSavingNote(false);
  }
};

  const getAIStatusColor = () => {
    switch (aiStatus) {
      case "connected": return "bg-green-500"
      case "disconnected": return "bg-red-500"
      case "checking": return "bg-yellow-500"
      default: return "bg-gray-500"
    }
  }

  const getAIStatusText = () => {
    switch (aiStatus) {
      case "connected": return "Online"
      case "disconnected": return "Offline"
      case "checking": return "Checking..."
      default: return "Unknown"
    }
  }

  const retryAIConnection = async () => {
    await testAIConnection()
  }

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, streamingMessage])

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus()
      }, 100)
      testAIConnection()
    }
  }, [isOpen])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (sessionMenuRef.current && !sessionMenuRef.current.contains(event.target as Node)) {
        setShowSessionMenu(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  if (!isOpen) return null

  return (
    <>
      {expandMode === "fullscreen" && (
        <div className="fixed inset-0 bg-black/10 z-40" onClick={onClose} />
      )}
      
      <div className={`${getContainerClasses()}${!embedded ? ` ${expandMode === "fullscreen" ? 'z-50' : 'z-40'}` : ''}`}>
        {/* 简洁头部 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 bg-gradient-to-br from-blue-500 to-purple-500 rounded-lg flex items-center justify-center">
              <Bot className="w-4 h-4 text-white" />
            </div>
            
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-gray-800">
                {currentSession?.title || "AI Chat"}
              </h3>
              <div className="flex items-center gap-1">
                <div className={`w-2 h-2 rounded-full ${getAIStatusColor()}`}></div>
                <span className="text-xs text-gray-500">{getAIStatusText()}</span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowHistorySidebar(!showHistorySidebar)}
              className="p-1.5 hover:bg-gray-100 rounded transition-colors text-gray-600"
              title="History"
            >
              <History className="w-4 h-4" />
            </button>
            
            <div className="relative" ref={sessionMenuRef}>
              <button
                onClick={() => setShowSessionMenu(!showSessionMenu)}
                className="p-1.5 hover:bg-gray-100 rounded transition-colors text-gray-600"
                title="Menu"
              >
                <MoreVertical className="w-4 h-4" />
              </button>
              
              {showSessionMenu && (
                <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-50 py-1">
                  <button
                    onClick={createNewSession}
                    className="w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    New Chat
                  </button>
                  <button
                    onClick={clearCurrentChat}
                    className="w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Clear Chat
                  </button>
                  <div className="h-px bg-gray-200 my-1"></div>
                  {currentSession && (
                    <button
                      onClick={() => deleteSession(currentSessionId)}
                      className="w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Delete Session
                    </button>
                  )}
                </div>
              )}
            </div>
            
            <button
              onClick={handleHeightExpand}
              className="p-1.5 hover:bg-gray-100 rounded transition-colors text-gray-600"
              title={expandMode === "expanded" ? "Compact" : "Expand"}
            >
              <ArrowUpDown className="w-4 h-4" />
            </button>
            
            <button
              onClick={handleFullMaximize}
              className="p-1.5 hover:bg-gray-100 rounded transition-colors text-gray-600"
              title={expandMode === "fullscreen" ? "Exit fullscreen" : "Fullscreen"}
            >
              {expandMode === "fullscreen" ? (
                <Minimize2 className="w-4 h-4" />
              ) : (
                <Maximize2 className="w-4 h-4" />
              )}
            </button>

            <button
              onClick={onClose}
              className="p-1.5 hover:bg-gray-100 rounded transition-colors text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {apiError && (
          <div className="px-3 py-2 bg-red-50 border-b border-red-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-500" />
              <span className="text-sm text-red-700">{apiError}</span>
            </div>
            <button
              onClick={retryAIConnection}
              className="text-xs text-red-600 hover:text-red-800 hover:bg-red-100 px-2 py-1 rounded transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        <div className="flex flex-1 overflow-hidden bg-white">
          {showHistorySidebar && expandMode !== "compact" && (
            <div className="w-56 border-r border-gray-200 flex flex-col bg-white">
              <div className="p-3 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <History className="w-4 h-4 text-gray-500" />
                    <h3 className="text-sm font-medium text-gray-700">History</h3>
                    <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                      {sessions.length}
                    </span>
                  </div>
                  <button
                    onClick={createNewSession}
                    className="p-1 hover:bg-gray-100 rounded transition-colors text-gray-600"
                    title="New chat"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
              
              <div className="flex-1 overflow-y-auto p-2">
                <div className="space-y-1">
                  {sessions.map((session) => {
                    const isActive = session.sessionId === currentSessionId
                    const latestMessage = session.messages[session.messages.length - 1]?.content || ""
                    
                    return (
                      <div
                        key={session.sessionId}
                        onClick={() => switchSession(session.sessionId)}
                        className={`p-2 rounded-lg cursor-pointer transition-colors group relative ${
                          isActive
                            ? "bg-blue-50 border border-blue-200"
                            : "hover:bg-gray-50 border border-transparent hover:border-gray-200"
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                                isActive ? 'bg-blue-500' : 'bg-gray-300'
                              }`}></div>
                              <h4 className="text-sm font-medium text-gray-800 truncate">
                                {session.title}
                              </h4>
                            </div>
                            
                            {latestMessage && (
                              <p className="text-xs text-gray-500 truncate ml-4 mt-1">
                                {latestMessage.substring(0, 40)}{latestMessage.length > 40 ? '...' : ''}
                              </p>
                            )}
                            
                            <div className="flex items-center justify-between mt-1 ml-4">
                              <div className="flex items-center gap-1">
                                <Clock className="w-3 h-3 text-gray-400" />
                                <span className="text-xs text-gray-500">
                                  {formatDate(session.lastMessageAt)}
                                </span>
                              </div>
                              <span className="text-xs text-gray-400">
                                {session.messageCount}
                              </span>
                            </div>
                          </div>
                          
                          {sessions.length > 1 && (
                            <button
                              onClick={(e) => deleteSession(session.sessionId, e)}
                              className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-100 rounded text-gray-400 hover:text-red-600 transition-all ml-1"
                              title="Delete"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          <div className="flex-1 flex flex-col min-h-0">
            <div className="flex-1 overflow-y-auto p-2 bg-white">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center py-8">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center mb-4">
                    <Bot className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-2">Hello! I'm Gemini AI</h3>
                  <p className="text-gray-600 text-center mb-6 text-sm max-w-xs">
                    I can help with explanations, creative writing, problem-solving, and more.
                  </p>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {quickSuggestions.map((suggestion, index) => (
                      <button
                        key={index}
                        onClick={() => setInput(suggestion)}
                        className="px-3 py-1.5 text-xs bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-gray-700"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {messages.map((message, index) => {
                    const isUser = message.role === "user"
                    const isLongAssistantMessage = !isUser && message.content.length > LONG_MESSAGE_THRESHOLD;
                    
                    return (
                      <div
                        key={message.id || index}
                        className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}
                      >
                        {!isUser && (
                          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center flex-shrink-0 mt-1">
                            <Bot className="w-3 h-3 text-white" />
                          </div>
                        )}
                        
                        <div className={`relative ${isUser ? "max-w-[80%]" : "max-w-[85%]"}`}>
                          <div className={`relative rounded-lg p-3 ${
                            isUser
                              ? "bg-blue-600 text-white"
                              : "bg-white border border-gray-200"
                          }`}
                          >
                            <div className="text-sm leading-relaxed">

                              {/* --- TOP ACTIONS --- */}
                              {isLongAssistantMessage && (
                                <div className="flex items-center justify-end pb-2 mb-2 border-b border-gray-100">
                                  <div className="flex items-center gap-1">
                                    <button
                                      onClick={() => handleCopyMessage(message.content, message.id)}
                                      className="p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                                      title="Copy"
                                    >
                                      {copiedMessageId === message.id ? (
                                        <Check className="w-3 h-3" />
                                      ) : (
                                        <Copy className="w-3 h-3" />
                                      )}
                                    </button>
                                    
                                    <button
                                      onClick={() => handleDownloadMessage(message.content, currentSession?.title || "AI Chat")}
                                      className="p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                                      title="Download"
                                    >
                                      <Download className="w-3.5 h-3.5" />
                                    </button>
                                    
                                    <button
                                      onClick={() => handleSaveToNotes(message.content, message.id, currentSession?.title || "AI Chat Note")}
                                      className="p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                                      title="Save to Notes"
                                    >
                                      <Bookmark className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                              )}
                              {/* ------------------- */}
                              
                              <ReactMarkdown
                                remarkPlugins={[remarkGfm]}
                                components={{
                                  br: () => <br className="my-1" />, 
                                  p: ({ node, ...props }) => <p className="mb-3 last:mb-0" {...props} />,
                                  ul: ({ node, ...props }) => <ul className="list-disc list-inside space-y-1 my-2 pl-4" {...props} />,
                                  ol: ({ node, ...props }) => <ol className="list-decimal list-inside space-y-1 my-2 pl-4" {...props} />,
                                  li: ({ node, children, ...props }) => {
                                    const isOnlyChildParagraph = (children as any[])?.length === 1 && (children as any[])[0]?.type === 'p';
                                    
                                    return (
                                      <li className="pl-1" {...props}>
                                        {isOnlyChildParagraph ? (children as any[])[0].props.children : children}
                                      </li>
                                    );
                                  },
                                  a: ({ node, ...props }) => <a className={`${isUser ? 'text-blue-200 hover:text-white' : 'text-blue-500 hover:text-blue-700'} underline`} target="_blank" rel="noopener noreferrer" {...props} />,
                                  code: ({ node, inline, className, children, ...props }) => {
                                    const isBlock = !inline
                                    return (
                                      <code 
                                        className={`${isBlock ? 'block p-3 mt-2 mb-3 bg-gray-100 text-gray-800 rounded-lg overflow-x-auto text-xs' : 'bg-gray-200 text-gray-800 px-1 py-0.5 rounded text-xs'}`} 
                                        {...props}
                                      >
                                        {children}
                                      </code>
                                    )
                                  },
                                  h1: ({ node, ...props }) => <h1 className="text-lg font-bold mt-4 mb-2" {...props} />,
                                  h2: ({ node, ...props }) => <h2 className="text-base font-semibold mt-4 mb-2" {...props} />,
                                }}
                              >
                                {message.content}
                              </ReactMarkdown>
                            </div>
                            
                            {/* --- BOTTOM ACTIONS --- */}
                            <div className={`mt-2 pt-2 border-t flex items-center justify-between ${
                              isUser 
                                ? "border-blue-400/30" 
                                : "border-gray-200"
                            }`}>
                              <div className="flex items-center gap-2">
                                <p className={`text-xs ${isUser ? "text-blue-100" : "text-gray-500"}`}>
                                  {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </p>
                              </div>
                              
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => handleCopyMessage(message.content, message.id)}
                                  className={`p-1 rounded transition-colors ${
                                    isUser
                                      ? "text-blue-100 hover:text-white hover:bg-blue-500/30"
                                      : "text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                                  }`}
                                  title="Copy"
                                >
                                  {copiedMessageId === message.id ? (
                                    <Check className="w-3.5 h-3.5" />
                                  ) : (
                                    <Copy className="w-3.5 h-3.5" />
                                  )}
                                </button>
                                
                                {!isUser && (
                                  <>
                                    <button
                                      onClick={() => handleDownloadMessage(message.content, currentSession?.title || "AI Chat")}
                                      className="p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                                      title="Download"
                                    >
                                      <Download className="w-3.5 h-3.5" />
                                    </button>
                                    
                                    <button
                                      onClick={() => handleSaveToNotes(message.content, message.id, currentSession?.title || "AI Chat Note")}
                                      className="p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                                      title="Save to Notes"
                                    >
                                      <Bookmark className="w-3.5 h-3.5" />
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                            {/* ---------------------- */}

                          </div>
                        </div>
                        
                        {isUser && (
                          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-gray-600 to-gray-700 flex items-center justify-center flex-shrink-0 mt-1">
                            <User className="w-3 h-3 text-white" />
                          </div>
                        )}
                      </div>
                    )
                  })}
                  
                  {isLoading && (
                    <div className="flex gap-1 justify-start">
                      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center flex-shrink-0 mt-1">
                        <Bot className="w-3 h-3 text-white" />
                      </div>
                      <div className="bg-white border border-gray-200 rounded-lg p-3">
                        <div className="flex items-center gap-3">
                          <div className="flex space-x-1">
                            <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce"></div>
                            <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                            <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                          </div>
                          <span className="text-sm text-gray-700">Thinking...</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
              
              <div ref={messagesEndRef} className="h-4" />
            </div>

            <div className="border-t border-gray-200 bg-white p-3">
              <div className="flex gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Ask Gemini AI..."
                  className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  disabled={isLoading}
                />
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || isLoading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* --- SAVE TO NOTES MODAL --- */}
      {showSaveToNotesModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[120]">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 border border-gray-200 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gray-50 rounded-lg flex items-center justify-center">
                  <Bookmark className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-800">Save to Notes</h3>
                  <p className="text-sm text-gray-500 mt-1">Save your AI conversation</p>
                </div>
              </div>
              <button 
                onClick={() => setShowSaveToNotesModal(false)} 
                className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Note title *</label>
                <input 
                  type="text" 
                  value={noteTitle} 
                  onChange={(e) => setNoteTitle(e.target.value)} 
                  maxLength={50} 
                  className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-sm" 
                  placeholder="Enter note title..." 
                  autoFocus 
                />
                <p className="text-xs text-gray-500 mt-2 text-right">{noteTitle.length}/50 characters</p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Bot className="w-4 h-4 text-blue-500" />
                    <span className="text-sm font-medium text-gray-700">Preview</span>
                  </div>
                  <span className="text-xs text-gray-500">{noteContent.length} characters</span>
                </div>
                <div className="text-sm text-gray-600 max-h-48 overflow-y-auto leading-relaxed whitespace-pre-wrap p-4 bg-gray-50 rounded-lg border border-gray-200">
                  {noteContent}
                </div>
              </div>
            </div>

            <div className="flex gap-3 justify-end mt-6 pt-4 border-t border-gray-200">
              <button 
                onClick={() => setShowSaveToNotesModal(false)} 
                className="px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-all border border-gray-300"
              >
                Cancel
              </button>
              <button 
                onClick={saveNoteToPanel} 
                disabled={!noteTitle.trim() || isSavingNote}
                className="px-4 py-2.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2 font-medium"
              >
                {isSavingNote ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    Save Note
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- SUCCESS NOTIFICATION --- */}
      {noteSaveSuccess && (
        <div className="fixed top-4 right-4 bg-white text-gray-800 px-5 py-4 rounded-xl shadow-2xl z-[130] max-w-sm animate-in slide-in-from-right border border-gray-200">
          <div className="flex items-start gap-4">
            <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
              <Check className="w-4 h-4 text-green-600" />
            </div>
            <div className="flex-1">
              <p className="font-semibold">Note Saved Successfully!</p>
              <p className="text-sm opacity-90 mt-1">Your conversation has been added to notes.</p>
              <button
                onClick={() => {
                  onClose();
                  setNoteSaveSuccess(false);
                  window.dispatchEvent(new CustomEvent('force-open-notes-in-viewer'));
                  window.dispatchEvent(new CustomEvent('open-notes-panel'));
                  const noteId = localStorage.getItem('lastCreatedNoteId');
                  if (noteId) window.dispatchEvent(new CustomEvent('notes-data-updated', { detail: { action: 'created', noteId: noteId } }));
                  window.dispatchEvent(new CustomEvent('refreshNotes'));
                }}
                className="mt-3 px-4 py-2 bg-blue-50 hover:bg-blue-100 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-2 w-full justify-center"
              >
                <FileText className="w-4 h-4" />
                Open Notes Panel
              </button>
            </div>
            <button 
              onClick={() => setNoteSaveSuccess(false)} 
              className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </>
  )
}