"use client"

import { useState, useRef, useEffect, useCallback, useMemo } from "react"
import {
  X,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  Settings,
  FileText,
  Sparkles,
  RotateCcw,
  RotateCw,
  Menu,
  MessageCircle,
  Settings2,
  ChevronDown,
} from "lucide-react"
import NotesPanel from "./notes-panel"
import SummaryChat from "./summary-chat"
import AIChat from "./ai-chat"
import AnchorNoteIndicator, { formatTs, getTimestampAnchors } from "./AnchorNoteIndicator"
import { fetchNotesByResource, type Note } from "../../../../apiServices/notesPanelService"
import MCQDisplayOverlay from "./MCQDisplayOverlay"

interface VideoPlayerProps {
  isOpen: boolean
  onClose: () => void
  videoUrl: string
  title?: string
  hasPrev?: boolean
  hasNext?: boolean
  onPrev?: () => void
  onNext?: () => void
  videoList?: Array<{
    id: string
    title: string
    duration: string
    thumbnail?: string
  }>
  onNotesClick?: () => void
  showNotesPanel?: boolean
  onNotesStateChange?: (isOpen: boolean) => void

  // Props for resolution handling
  availableResolutions?: string[]
  fileUrlMap?: Record<string, string>
  onResolutionChange?: (resolution: string, url: string) => void

  // AI feature flags from resourcesType
  aiChatEnabled?: boolean
  aiSummaryEnabled?: boolean
  
  // Notes feature flag from resourcesType
  notesEnabled?: boolean

  // MCQ props
  mcqQuestions?: any[]

  hierarchy?: string[]
  currentItemTitle?: string

  // Stable id used to anchor contextual notes to this video (optional).
  fileId?: string
}

// Helper function to detect if URL is a streaming service
const isStreamingUrl = (url: string): boolean => {
  const lowerUrl = url.toLowerCase();
  return lowerUrl.includes('youtube.com') ||
    lowerUrl.includes('youtu.be') ||
    lowerUrl.includes('vimeo.com') ||
    lowerUrl.includes('dailymotion.com') ||
    lowerUrl.includes('twitch.tv') ||
    lowerUrl.includes('wistia.com');
};

// Helper function to get YouTube embed URL
const getYouTubeEmbedUrl = (url: string): string => {
  const regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
  const match = url.match(regExp);
  const videoId = (match && match[7].length === 11) ? match[7] : null;
  if (videoId) {
    return `https://www.youtube.com/embed/${videoId}?autoplay=1`;
  }
  return url;
};

// Helper function to get Vimeo embed URL
const getVimeoEmbedUrl = (url: string): string => {
  const regExp = /(?:vimeo\.com\/)(?:channels\/|groups\/[^\/]*\/videos\/|album\/\d+\/video\/|)(\d+)(?:$|\/|\?)/;
  const match = url.match(regExp);
  const videoId = match ? match[1] : null;
  if (videoId) {
    return `https://player.vimeo.com/video/${videoId}?autoplay=1`;
  }
  return url;
};

// Resolution priority order (highest quality first)
const RESOLUTION_PRIORITY: Record<string, number> = {
  '1080p': 5,
  '720p': 4,
  '480p': 3,
  '360p': 2,
  '240p': 1,
  'base': 0,
};

// Format resolution for display
const formatResolution = (res: string): string => {
  if (res === 'base') return 'Auto';
  if (res === '1080p') return '1080p';
  if (res === '720p') return '720p';
  if (res === '480p') return '480p';
  if (res === '360p') return '360p';
  if (res === '240p') return '240p';
  return res;
};

export default function VideoPlayer({
  isOpen,
  onClose,
  videoUrl,
  title = "Video",
  hasPrev = false,
  hasNext = false,
  onPrev = () => { },
  onNext = () => { },
  videoList = [],
  onNotesClick,
  showNotesPanel = false,
  onNotesStateChange,
  availableResolutions = [],
  fileUrlMap = {},
  onResolutionChange,
  aiChatEnabled = false,
  aiSummaryEnabled = false,
  notesEnabled = false,
  mcqQuestions: mcqQuestionsProp = [],
  hierarchy = [],
  currentItemTitle = "",
  fileId,
}: VideoPlayerProps) {
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [volume, setVolume] = useState(1)
  const [isMuted, setIsMuted] = useState(false)
  const [playbackRate, setPlaybackRate] = useState(1)
  const [showControls, setShowControls] = useState(true)
  const [isStreaming, setIsStreaming] = useState(false)
  const [embedUrl, setEmbedUrl] = useState("")
  
  // Resolution state
  const [currentResolution, setCurrentResolution] = useState<string>("base")
  const [currentVideoSource, setCurrentVideoSource] = useState(videoUrl)
  const [showResolutionMenu, setShowResolutionMenu] = useState(false)

  // Panel states
  const [showAISubmenu, setShowAISubmenu] = useState(false)
  const [summaryOpen, setSummaryOpen] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [notesOpen, setNotesOpen] = useState(false)
  const [aiOpen, setAiOpen] = useState(false)
  const [splitPosition, setSplitPosition] = useState(60)
  const isResizingRef = useRef(false)

  // ── Anchored notes (contextual, per-timestamp)
  const [resourceNotes, setResourceNotes] = useState<Note[]>([])
  const [pendingFilterNoteId, setPendingFilterNoteId] = useState<string | null>(null)
  const [notesVersion, setNotesVersion] = useState(0)
  useEffect(() => {
    if (!fileId) return
    const token = typeof window !== 'undefined' ? localStorage.getItem('smartcliff_token') : null
    if (!token) return
    let cancelled = false
    fetchNotesByResource(fileId, 'video', token).then(list => {
      if (!cancelled) setResourceNotes(list)
    })
    return () => { cancelled = true }
  }, [fileId, notesVersion])
  const notesWasOpen = useRef(false)
  useEffect(() => {
    if (notesWasOpen.current && !notesOpen && fileId) setNotesVersion(v => v + 1)
    notesWasOpen.current = notesOpen
  }, [notesOpen, fileId])

  // Determine which AI features are enabled
  const showAIButton = aiChatEnabled || aiSummaryEnabled
  const showAIChatOption = aiChatEnabled
  const showAISummaryOption = aiSummaryEnabled
  const showNotesButton = notesEnabled

  // Debug: Log feature flags
  useEffect(() => {
    console.log("VideoPlayer - Feature Flags:", {
      aiChatEnabled,
      aiSummaryEnabled,
      notesEnabled,
      showAIButton,
      showAIChatOption,
      showAISummaryOption,
      showNotesButton
    });
  }, [aiChatEnabled, aiSummaryEnabled, notesEnabled]);

  // Debug: Log available resolutions
  useEffect(() => {
    console.log("VideoPlayer - availableResolutions:", availableResolutions);
    console.log("VideoPlayer - fileUrlMap keys:", Object.keys(fileUrlMap));
    console.log("VideoPlayer - videoUrl:", videoUrl);
  }, [availableResolutions, fileUrlMap, videoUrl]);

  // Sort resolutions by quality (highest first)
  const sortedResolutions = useMemo(() => {
    // First check if we have resolutions from availableResolutions prop
    let resolutions = [...availableResolutions];
    
    // If no resolutions in availableResolutions but fileUrlMap has keys, use those
    if (resolutions.length === 0 && Object.keys(fileUrlMap).length > 0) {
      resolutions = Object.keys(fileUrlMap);
      console.log("Using fileUrlMap keys as resolutions:", resolutions);
    }
    
    // Filter out any resolutions that don't have URLs
    resolutions = resolutions.filter(res => {
      if (res === 'base') return true;
      return fileUrlMap[res] !== undefined;
    });
    
    // Sort by priority
    return resolutions.sort((a, b) => 
      (RESOLUTION_PRIORITY[b] || 0) - (RESOLUTION_PRIORITY[a] || 0)
    );
  }, [availableResolutions, fileUrlMap]);

  // ─── MCQ State ──────────────────────────────────────────────────────────────
  const normalizeOptions = (options: any[]): any[] => {
    if (!options) return [];
    return options.map(opt => {
      if (opt.text !== undefined) return opt;
      const chars = Object.entries(opt)
        .filter(([k]) => !isNaN(Number(k)))
        .sort(([a], [b]) => Number(a) - Number(b))
        .map(([, v]) => v)
        .join('');
      return { ...opt, text: chars };
    });
  };

  const [mcqQuestions] = useState<any[]>(() => {
    const normalized = (mcqQuestionsProp || []).map(q => ({
      ...q,
      mcqQuestion: q.mcqQuestion
        ? { ...q.mcqQuestion, options: normalizeOptions(q.mcqQuestion.options || []) }
        : q.mcqQuestion
    }));
    return normalized;
  });

  const [activeMcqGroup, setActiveMcqGroup] = useState<{ timestamp: number; questions: any[] } | null>(null)
  const triggeredTimestamps = useRef<Set<number>>(new Set())

  const videoRef = useRef<HTMLVideoElement>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const playerRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const controlsTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  // ─── Resolution Change Handler ─────────────────────────────────────────────
  const handleResolutionChange = (resolution: string) => {
    console.log(`Changing resolution to: ${resolution}`);
    
    let newUrl: string | undefined;
    
    if (resolution === 'base') {
      // Use the original video URL for base resolution
      newUrl = videoUrl;
    } else {
      // Get the URL from fileUrlMap for the selected resolution
      newUrl = fileUrlMap[resolution];
    }
    
    if (!newUrl) {
      console.error(`No URL found for resolution: ${resolution}`);
      // Try to use videoUrl as fallback
      newUrl = videoUrl;
    }
    
    const wasPlaying = isPlaying;
    const currentTimeToSave = videoRef.current?.currentTime || 0;
    
    setCurrentResolution(resolution);
    setCurrentVideoSource(newUrl);
    setShowResolutionMenu(false);
    
    if (onResolutionChange) {
      onResolutionChange(resolution, newUrl);
    }
    
    // Restore playback position and state
    setTimeout(() => {
      if (videoRef.current) {
        videoRef.current.currentTime = currentTimeToSave;
        if (wasPlaying) {
          videoRef.current.play().catch(err => console.log("Playback error:", err));
        }
      }
    }, 100);
  };

  // ─── Find ALL MCQ questions at a matching timestamp ────────────────────────
  const getMcqAtTime = useCallback((time: number) => {
    if (!mcqQuestions.length) return null;

    for (const q of mcqQuestions) {
      if (!q.isActive) continue;
      const ts = q.videoTimestamp ?? q.timestamp;
      if (ts === undefined || ts === null) continue;

      if (Math.abs(time - ts) < 0.1 && !triggeredTimestamps.current.has(ts)) {
        const groupQuestions = mcqQuestions.filter(mq => {
          if (!mq.isActive) return false;
          const mqTs = mq.videoTimestamp ?? mq.timestamp;
          return Math.abs(mqTs - ts) < 0.05;
        });

        return { timestamp: ts, questions: groupQuestions };
      }
    }
    return null;
  }, [mcqQuestions]);

  // ─── MCQ-aware time update handler ─────────────────────────────────────────
  const handleTimeUpdate = () => {
    if (isStreaming || !videoRef.current) return;
    const time = videoRef.current.currentTime;
    setCurrentTime(time);

    if (activeMcqGroup) return;

    const match = getMcqAtTime(time);
    if (match) {
      videoRef.current.pause();
      setIsPlaying(false);
      setActiveMcqGroup(match);
    }
  };

  // ─── Resume after MCQ completion ───────────────────────────────────────────
  const handleMcqResume = () => {
    if (!activeMcqGroup || !videoRef.current) return;
    triggeredTimestamps.current.add(activeMcqGroup.timestamp);
    setActiveMcqGroup(null);
    videoRef.current.currentTime = activeMcqGroup.timestamp + 0.6;
    videoRef.current.play();
    setIsPlaying(true);
  };

  // ─── Dismiss/skip MCQ ──────────────────────────────────────────────────────
  const handleMcqDismiss = () => {
    if (!activeMcqGroup || !videoRef.current) return;
    triggeredTimestamps.current.add(activeMcqGroup.timestamp);
    setActiveMcqGroup(null);
    videoRef.current.currentTime = activeMcqGroup.timestamp + 0.6;
    videoRef.current.play();
    setIsPlaying(true);
  };

  // ─── Reset triggered timestamps on seek backward ───────────────────────────
  const handleSeeked = () => {
    if (!videoRef.current) return;
    const seekTime = videoRef.current.currentTime;
    const toRemove: number[] = [];
    triggeredTimestamps.current.forEach(ts => {
      if (ts >= seekTime - 0.1) toRemove.push(ts);
    });
    toRemove.forEach(ts => triggeredTimestamps.current.delete(ts));
  };

  // Sync with parent state when showNotesPanel prop changes. Notes off for this
  // resource type keeps the panel shut regardless of what the parent asks for.
  useEffect(() => {
    setNotesOpen(notesEnabled && showNotesPanel)
  }, [showNotesPanel, notesEnabled])

  // Check if URL is streaming and set up embed URL
  useEffect(() => {
    const streaming = isStreamingUrl(videoUrl);
    setIsStreaming(streaming);

    if (streaming) {
      if (videoUrl.includes('youtube.com') || videoUrl.includes('youtu.be')) {
        setEmbedUrl(getYouTubeEmbedUrl(videoUrl));
      } else if (videoUrl.includes('vimeo.com')) {
        setEmbedUrl(getVimeoEmbedUrl(videoUrl));
      } else {
        setEmbedUrl(videoUrl);
      }
    }
  }, [videoUrl])

  // Update video source when props change
  useEffect(() => {
    setCurrentVideoSource(videoUrl);
    setCurrentResolution('base');
    setShowResolutionMenu(false);
  }, [videoUrl]);

  // Resize handlers for split screen
  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    isResizingRef.current = true;
    document.addEventListener('mousemove', handleResize);
    document.addEventListener('mouseup', handleResizeEnd);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  const handleResize = (e: MouseEvent) => {
    if (!isResizingRef.current || !containerRef.current) return;
    const containerRect = containerRef.current.getBoundingClientRect();
    const newPosition = ((e.clientX - containerRect.left) / containerRect.width) * 100;
    const clampedPosition = Math.max(30, Math.min(70, newPosition));
    setSplitPosition(clampedPosition);
  };

  const handleResizeEnd = () => {
    isResizingRef.current = false;
    document.removeEventListener('mousemove', handleResize);
    document.removeEventListener('mouseup', handleResizeEnd);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  };

  const handleSplitPreset = (position: number) => {
    setSplitPosition(position);
  };

  const handleNotesClick = () => {
    const newNotesOpenState = !notesOpen;
    setAiOpen(false);
    setSidebarOpen(false);
    setSummaryOpen(false);
    setShowAISubmenu(false);
    onNotesClick?.();
    onNotesStateChange?.(newNotesOpenState);
  }

  const handleNotesPanelClose = () => {
    onNotesStateChange?.(false);
  };

  const handleClose = () => {
    setSidebarOpen(false);
    setAiOpen(false);
    setSummaryOpen(false);
    setShowAISubmenu(false);
    onNotesStateChange?.(false);
    onClose();
  };

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    const secs = Math.floor(seconds % 60)
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const handlePlayPause = () => {
    if (isStreaming) return;
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause()
      } else {
        videoRef.current.play()
      }
      setIsPlaying(!isPlaying)
    }
  }

  const handleSeek = (time: number) => {
    if (isStreaming) return;
    if (videoRef.current) {
      videoRef.current.currentTime = time
      setCurrentTime(time)
    }
  }

  const handleVolumeChange = (value: number) => {
    if (isStreaming) return;
    if (videoRef.current) {
      videoRef.current.volume = value
      setVolume(value)
      setIsMuted(value === 0)
    }
  }

  const handleToggleMute = () => {
    if (isStreaming) return;
    if (videoRef.current) {
      videoRef.current.muted = !isMuted
      setIsMuted(!isMuted)
    }
  }

  const handlePlaybackRateChange = (rate: number) => {
    if (isStreaming) return;
    if (videoRef.current) {
      videoRef.current.playbackRate = rate
      setPlaybackRate(rate)
    }
  }

  const handleFullscreen = async () => {
    if (!playerRef.current) return
    try {
      if (!isFullscreen) {
        await playerRef.current.requestFullscreen()
      } else {
        await document.exitFullscreen()
      }
      setIsFullscreen(!isFullscreen)
    } catch (error) {
      console.error('Fullscreen error:', error)
    }
  }

  const handleLoadedMetadata = () => {
    if (isStreaming) return;
    if (videoRef.current) {
      setDuration(videoRef.current.duration)
    }
  }

  const handleEnded = () => {
    if (isStreaming) return;
    setIsPlaying(false)
    if (hasNext) {
      onNext()
    }
  }

  const handleAISubmenuClick = (type: 'summary' | 'chat') => {
    if (type === 'summary') {
      setSummaryOpen(true)
      setAiOpen(false)
    } else {
      setAiOpen(true)
    }
    setShowAISubmenu(false)
    setNotesOpen(false)
    onNotesStateChange?.(false)
  }

  const handleAIClose = () => {
    setAiOpen(false);
  }

  const handleSummaryClose = () => {
    setSummaryOpen(false);
  }

  const handleMenuClick = () => {
    setSidebarOpen(prev => !prev);
    setNotesOpen(false);
    setAiOpen(false);
    setSummaryOpen(false);
    setShowAISubmenu(false);
    onNotesStateChange?.(false);
  };

  const showControlsTemporarily = () => {
    setShowControls(true)
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current)
    }
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying && !isStreaming) setShowControls(false)
    }, 3000)
  }

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (!isOpen) return
      if (activeMcqGroup) return

      switch (e.key) {
        case ' ':
        case 'k':
          if (!isStreaming) {
            e.preventDefault()
            handlePlayPause()
          }
          break
        case 'f':
          e.preventDefault()
          handleFullscreen()
          break
        case 'm':
          if (!isStreaming) {
            e.preventDefault()
            handleToggleMute()
          }
          break
        case 'ArrowLeft':
          if (!isStreaming) {
            e.preventDefault()
            handleSeek(Math.max(0, currentTime - 10))
          }
          break
        case 'ArrowRight':
          if (!isStreaming) {
            e.preventDefault()
            handleSeek(Math.min(duration, currentTime + 10))
          }
          break
        case 'Escape':
          e.preventDefault()
          if (sidebarOpen || notesOpen || aiOpen) {
            setSidebarOpen(false)
            setNotesOpen(false)
            setAiOpen(false)
            onNotesStateChange?.(false);
          } else if (isFullscreen) {
            handleFullscreen()
          } else {
            onClose()
          }
          break
      }
    }

    document.addEventListener('keydown', handleKeyPress)
    return () => document.removeEventListener('keydown', handleKeyPress)
  }, [isOpen, isPlaying, currentTime, duration, sidebarOpen, notesOpen, aiOpen, isFullscreen, isStreaming, activeMcqGroup])

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  // Reset panels and MCQ state when video changes
  useEffect(() => {
    setSidebarOpen(false)
    setNotesOpen(false)
    setAiOpen(false)
    setActiveMcqGroup(null)
    triggeredTimestamps.current = new Set()
    onNotesStateChange?.(false);
  }, [videoUrl])

  useEffect(() => {
    return () => {
      document.removeEventListener('mousemove', handleResize);
      document.removeEventListener('mouseup', handleResizeEnd);
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current)
      }
    };
  }, []);

  if (!isOpen) return null

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0
  const showResolutionSelector = sortedResolutions.length > 0 && !isStreaming

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 bg-gray-900 flex flex-col"
    >
      {/* Top Navigation Bar */}
      <div
        className="w-full flex items-center justify-between bg-white/95 backdrop-blur-lg shadow-sm border-b border-gray-200/80 px-4 py-3"
        style={{ height: '60px', zIndex: 60 }}
      >
        {/* Left section */}
        <div className="flex items-center gap-3 truncate">
          <button
            onClick={handleClose}
            className="flex items-center justify-center w-8 h-8 rounded-lg bg-white border border-gray-300 shadow-sm hover:bg-gray-50 hover:text-gray-700 transition-all cursor-pointer flex-shrink-0"
            title="Back"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <div className="flex items-center gap-2 text-gray-800 font-semibold truncate">
            <FileText className="w-4 h-4 text-orange-600 flex-shrink-0" />
            <span className="text-sm truncate">{title}</span>
          </div>
        </div>

        {/* Right section */}
        <div className="flex items-center gap-2">
          {/* Notes Button - Only show if notesEnabled is true */}
          {showNotesButton && (
            <button
              onClick={handleNotesClick}
              className={`flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg font-medium transition-all duration-300 cursor-pointer whitespace-nowrap border
                ${notesOpen
                  ? 'bg-orange-600 text-white shadow-md border-orange-700'
                  : 'bg-white text-gray-700 hover:bg-orange-50 hover:text-orange-800 border-gray-300 shadow-sm'
                }`}
            >
              <FileText className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="text-xs sm:text-sm truncate">Notes</span>
            </button>
          )}

          {/* AI Assistant with Submenu - Only show if any AI feature is enabled */}
          {showAIButton && (
            <div
              className="relative"
              onMouseEnter={() => setShowAISubmenu(true)}
              onMouseLeave={() => setShowAISubmenu(false)}
            >
              <button
                className={`h-10 px-3 rounded-lg transition-all duration-200 flex items-center gap-2 relative border
                  ${(aiOpen || summaryOpen)
                    ? 'bg-gradient-to-r from-orange-600 to-orange-500 text-white shadow-md border-orange-700'
                    : 'bg-white text-gray-700 hover:bg-orange-50 hover:text-orange-800 border-gray-300 shadow-sm hover:border-orange-300'
                  }`}
                title="AI Assistant"
              >
                <Sparkles className="w-4 h-4" />
                <span className="text-sm font-medium">AI</span>
                <span className="absolute -top-1 -right-1 min-w-[18px] h-4 px-1 rounded-full flex items-center justify-center text-[9px] font-bold bg-gradient-to-r from-orange-600 to-orange-500 text-white shadow-sm border-2 border-white">
                  New
                </span>
              </button>

              {showAISubmenu && (
                <div
                  className="absolute top-full left-1/2 transform -translate-x-1/2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50"
                  onMouseEnter={() => setShowAISubmenu(true)}
                  onMouseLeave={() => setShowAISubmenu(false)}
                >
                  {/* Only show Summary option if enabled */}
                  {showAISummaryOption && (
                    <button
                      onClick={() => handleAISubmenuClick('summary')}
                      className="w-full justify-start h-9 px-3 rounded-none transition-all duration-200 hover:bg-orange-50 text-gray-700 hover:text-orange-800 flex items-center gap-2"
                    >
                      <FileText className="w-4 h-4" />
                      <span className="text-sm font-medium">Summary</span>
                    </button>
                  )}
                  
                  {/* Only show Chat option if enabled */}
                  {showAIChatOption && (
                    <button
                      onClick={() => handleAISubmenuClick('chat')}
                      className="w-full justify-start h-9 px-3 rounded-none transition-all duration-200 hover:bg-orange-50 text-gray-700 hover:text-orange-800 flex items-center gap-2"
                    >
                      <MessageCircle className="w-4 h-4" />
                      <span className="text-sm font-medium">Chat</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Menu Button */}
          <button
            onClick={handleMenuClick}
            className="flex items-center gap-2 px-3 py-2 rounded-lg font-medium bg-white text-gray-700 hover:bg-gray-50 transition-all cursor-pointer border border-gray-300 shadow-sm"
          >
            <Menu className="w-4 h-4" />
            <span className="text-sm">Menu</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex bg-white" style={{ height: 'calc(100vh - 60px)' }}>
        {/* Video Player Area */}
        <div
          className="flex items-center justify-center bg-black transition-all duration-200 relative"
          style={{
            width: notesOpen ? `${splitPosition}%` : '100%',
            overflow: 'hidden',
          }}
        >
          <div
            ref={playerRef}
            className="w-full h-full relative"
            onClick={showControlsTemporarily}
          >
            {/* Streaming Video */}
            {isStreaming ? (
              <iframe
                ref={iframeRef}
                src={embedUrl}
                title={title}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                frameBorder="0"
              />
            ) : (
              /* Direct Video File */
              <video
                key={currentVideoSource}
                ref={videoRef}
                src={currentVideoSource}
                className="w-full h-full object-contain"
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleLoadedMetadata}
                onEnded={handleEnded}
                onSeeked={handleSeeked}
                onClick={(e) => {
                  e.stopPropagation()
                  if (!isStreaming && !activeMcqGroup) handlePlayPause()
                }}
              />
            )}

            {/* Contextual notes indicator (fires when playback hits an anchored timestamp) */}
            {notesEnabled && fileId && resourceNotes.length > 0 && !isStreaming && (
              <AnchorNoteIndicator
                notes={resourceNotes}
                mode="timestamp"
                currentValue={currentTime}
                windowSec={1}
                onOpenPanel={(noteId) => {
                  setPendingFilterNoteId(noteId || null)
                  setNotesOpen(true)
                  onNotesStateChange?.(true)
                }}
              />
            )}

            {/* Controls Overlay */}
            {showControls && !isStreaming && !activeMcqGroup && (
              <div
                className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Center Play/Pause Button */}
                {!isPlaying && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <button
                      onClick={handlePlayPause}
                      className="bg-black/50 hover:bg-black/70 text-white rounded-full p-4 transition-all transform hover:scale-110"
                    >
                      <Play className="w-12 h-12 ml-1" />
                    </button>
                  </div>
                )}

                {/* Bottom Controls */}
                <div className="absolute bottom-0 left-0 right-0 p-4 space-y-3">
                  {/* Progress Bar */}
                  <div className="relative group">
                    <div className="h-1 bg-gray-600 rounded-full cursor-pointer relative">
                      <div
                        className="h-full bg-red-600 rounded-full relative"
                        style={{ width: `${progress}%` }}
                      >
                        <div className="absolute right-0 top-1/2 transform -translate-y-1/2 w-3 h-3 bg-red-600 rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                      {/* Anchored-note ticks */}
                      {notesEnabled && fileId && duration > 0 && getTimestampAnchors(resourceNotes).map(({ note, timestamp }) => {
                        const pct = Math.min(100, Math.max(0, (timestamp / duration) * 100))
                        return (
                          <button
                            key={note._id}
                            onClick={(e) => {
                              e.stopPropagation()
                              handleSeek(timestamp)
                              setPendingFilterNoteId(note._id)
                              setNotesOpen(true)
                              onNotesStateChange?.(true)
                            }}
                            title={`${formatTs(timestamp)} — ${note.title || 'Untitled note'}`}
                            style={{
                              position: 'absolute',
                              left: `${pct}%`,
                              top: '50%',
                              transform: 'translate(-50%, -50%)',
                              width: 8,
                              height: 8,
                              borderRadius: '50%',
                              background: '#F97316',
                              border: '1.5px solid white',
                              boxShadow: '0 0 0 1px rgba(0,0,0,0.35)',
                              cursor: 'pointer',
                              zIndex: 2,
                              padding: 0,
                            }}
                          />
                        )
                      })}
                    </div>
                    <input
                      type="range"
                      min="0"
                      max={duration}
                      value={currentTime}
                      onChange={(e) => handleSeek(parseFloat(e.target.value))}
                      className="absolute inset-0 w-full h-3 opacity-0 cursor-pointer"
                    />
                  </div>

                  {/* Control Buttons */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <button
                        onClick={handlePlayPause}
                        className="text-white hover:bg-white/20 p-2 rounded transition-colors"
                      >
                        {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                      </button>

                      <button
                        onClick={onPrev}
                        disabled={!hasPrev}
                        className="text-white hover:bg-white/20 p-2 rounded transition-colors disabled:opacity-30"
                      >
                        <RotateCcw className="w-5 h-5" />
                      </button>
                      <button
                        onClick={onNext}
                        disabled={!hasNext}
                        className="text-white hover:bg-white/20 p-2 rounded transition-colors disabled:opacity-30"
                      >
                        <RotateCw className="w-5 h-5" />
                      </button>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={handleToggleMute}
                          className="text-white hover:bg-white/20 p-2 rounded transition-colors"
                        >
                          {isMuted || volume === 0 ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                        </button>
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.1"
                          value={volume}
                          onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                          className="w-20 accent-white"
                        />
                      </div>

                      <div className="text-white text-sm font-mono">
                        {formatTime(currentTime)} / {formatTime(duration)}
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      {/* Resolution Selector */}
                      {showResolutionSelector && (
                        <div className="relative">
                          <button
                            onClick={() => setShowResolutionMenu(!showResolutionMenu)}
                            className="flex items-center gap-1 text-white hover:bg-white/20 px-2 py-1.5 rounded transition-colors text-xs"
                            title="Change quality"
                          >
                            <Settings2 className="w-4 h-4" />
                            <span>{formatResolution(currentResolution)}</span>
                            <ChevronDown className="w-3 h-3" />
                          </button>
                          
                          {showResolutionMenu && (
                            <div className="absolute bottom-full right-0 mb-2 w-40 bg-black/90 backdrop-blur-sm rounded-lg shadow-lg border border-gray-700 py-1 z-50">
                              {sortedResolutions.map((res) => (
                                <button
                                  key={res}
                                  onClick={() => handleResolutionChange(res)}
                                  className={`w-full text-left px-3 py-2 text-xs transition-colors ${
                                    currentResolution === res
                                      ? 'bg-orange-700 text-white'
                                      : 'text-gray-300 hover:bg-white/10'
                                  }`}
                                >
                                  {formatResolution(res)}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      <select
                        value={playbackRate}
                        onChange={(e) => handlePlaybackRateChange(parseFloat(e.target.value))}
                        className="bg-black/80 text-white border border-gray-600 rounded px-2 py-1 text-sm"
                      >
                        <option value={0.25}>0.25x</option>
                        <option value={0.5}>0.5x</option>
                        <option value={0.75}>0.75x</option>
                        <option value={1}>1x</option>
                        <option value={1.25}>1.25x</option>
                        <option value={1.5}>1.5x</option>
                        <option value={2}>2x</option>
                      </select>

                      <button className="text-white hover:bg-white/20 p-2 rounded transition-colors">
                        <Settings className="w-5 h-5" />
                      </button>

                      <button
                        onClick={handleFullscreen}
                        className="text-white hover:bg-white/20 p-2 rounded transition-colors"
                      >
                        {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* MCQ Overlay */}
            {activeMcqGroup && (
              <MCQDisplayOverlay
                questions={activeMcqGroup.questions}
                timestamp={activeMcqGroup.timestamp}
                onResume={handleMcqResume}
                onDismiss={handleMcqDismiss}
              />
            )}
          </div>
        </div>

        {/* Resize Handle */}
        {notesOpen && notesEnabled && (
          <div
            className="w-2 bg-gray-300 hover:bg-orange-600 active:bg-orange-700 cursor-col-resize transition-colors duration-200 flex items-center justify-center relative"
            onMouseDown={handleResizeStart}
            style={{ zIndex: 40 }}
          >
            <div className="flex flex-col gap-1">
              <div className="w-1 h-3 bg-gray-500 rounded" />
              <div className="w-1 h-3 bg-gray-500 rounded" />
              <div className="w-1 h-3 bg-gray-500 rounded" />
            </div>
          </div>
        )}

        {/* Notes Panel */}
        {notesOpen && notesEnabled && (
          <div
            className="bg-white transition-all duration-200 overflow-hidden"
            style={{ width: `${100 - splitPosition}%` }}
          >
            <NotesPanel
              isOpen={true}
              onClose={handleNotesPanelClose}
              isDraggable={false}
              initialNoteData={localStorage.getItem('lastCreatedNote')}
              resourceContext={fileId ? {
                resourceId: fileId,
                resourceType: 'video',
                currentAnchor: { timestamp: currentTime },
                onJumpTo: (a) => { if (a.timestamp != null) handleSeek(a.timestamp) },
                onNotesChanged: () => setNotesVersion(v => v + 1),
              } : null}
              filterNoteId={pendingFilterNoteId}
            />
          </div>
        )}
      </div>

      {/* Sidebar Menu */}
      {sidebarOpen && (
        <div
          className="fixed top-0 right-0 h-full w-80 bg-white/95 backdrop-blur-lg shadow-2xl z-50 p-6 border-l border-gray-200"
          style={{ marginTop: '60px', height: 'calc(100vh - 60px)' }}
        >
          <button
            onClick={() => setSidebarOpen(false)}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/80 shadow-md hover:bg-gray-100 transition-all cursor-pointer"
          >
            <X className="w-5 h-5 text-gray-700" />
          </button>

          <div className="mt-3 mb-6 text-center">
            <div className="flex items-center justify-center gap-2">
              <Settings className="w-5 h-5 text-gray-700" />
              <h2 className="text-base font-semibold text-gray-800">Video Control</h2>
            </div>
            <p className="text-xs text-gray-500 mt-1">Adjust playback, speed & layout options</p>
          </div>

          <div className="mt-8 w-full">
            <h3 className="font-semibold mb-3 text-sm uppercase text-gray-600 border-b border-gray-300 pb-1">
              Playback Control
            </h3>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm text-gray-700">Playback Speed</label>
                <select
                  value={playbackRate}
                  onChange={(e) => handlePlaybackRateChange(parseFloat(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-600 focus:border-transparent"
                  disabled={isStreaming}
                >
                  <option value={0.25}>0.25x</option>
                  <option value={0.5}>0.5x</option>
                  <option value={0.75}>0.75x</option>
                  <option value={1}>Normal (1x)</option>
                  <option value={1.25}>1.25x</option>
                  <option value={1.5}>1.5x</option>
                  <option value={2}>2x</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm text-gray-700">Volume</label>
                <input
                  type="range" min="0" max="1" step="0.1" value={volume}
                  onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                  className="w-full accent-orange-600"
                  disabled={isStreaming}
                />
              </div>
            </div>
          </div>

          {/* Resolution Section in Sidebar */}
          {showResolutionSelector && (
            <div className="mt-6 w-full">
              <h3 className="font-semibold mb-3 text-sm uppercase text-gray-600 border-b border-gray-300 pb-1">
                Video Quality
              </h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-700">Current Quality</span>
                  <span className="text-sm font-semibold text-orange-700">
                    {formatResolution(currentResolution)}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {sortedResolutions.map((res) => (
                    <button
                      key={res}
                      onClick={() => handleResolutionChange(res)}
                      className={`px-3 py-2 text-xs rounded-lg transition-all ${
                        currentResolution === res
                          ? 'bg-orange-600 text-white shadow-md'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                    >
                      {formatResolution(res)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="mt-6 w-full">
            <h3 className="font-semibold mb-3 text-sm uppercase text-gray-600 border-b border-gray-300 pb-1">Layout</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-700">Video/Notes Split</span>
                <span className="text-sm font-semibold text-orange-700">
                  {Math.round(splitPosition)}/{Math.round(100 - splitPosition)}
                </span>
              </div>
              <div className="flex items-center gap-2 bg-white/60 rounded-xl p-2">
                {[70, 60, 50].map(preset => (
                  <button
                    key={preset}
                    onClick={() => handleSplitPreset(preset)}
                    className={`flex-1 px-3 py-2 text-sm rounded-lg transition-all cursor-pointer ${splitPosition === preset
                      ? 'bg-orange-600 text-white shadow-md'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                  >
                    {preset}/{100 - preset}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-10 w-full">
            <h3 className="font-semibold mb-3 text-sm uppercase text-gray-600 border-b border-gray-300 pb-1">Navigation</h3>
            <div className="flex items-center justify-between bg-white/60 rounded-2xl p-3 shadow-inner">
              <button onClick={onPrev} disabled={!hasPrev}
                className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-all disabled:opacity-30 cursor-pointer">
                <RotateCcw className="w-4 h-4" />
                <span className="text-sm">Previous</span>
              </button>
              <button onClick={onNext} disabled={!hasNext}
                className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-all disabled:opacity-30 cursor-pointer">
                <span className="text-sm">Next</span>
                <RotateCw className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="mt-6 w-full">
            <h3 className="font-semibold mb-3 text-sm uppercase text-gray-600 border-b border-gray-300 pb-1">Display</h3>
            <div className="flex items-center justify-center bg-white/60 rounded-2xl p-3 shadow-inner">
              <button onClick={handleFullscreen}
                className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-all cursor-pointer">
                {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
                <span className="text-sm">{isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Only render AI Chat if enabled */}
      {showAIChatOption && (
        <AIChat
          isOpen={aiOpen}
          onClose={handleAIClose}
          context={{
            topicTitle: currentItemTitle || title,
            fileName: title,
            fileType: "video",
            isDocumentView: true,
            hierarchy: hierarchy.length > 0 ? hierarchy : [title],
            fileUrl: videoUrl,
            isPDF: false,
          }}
        />
      )}

      {/* Only render Summary Chat if enabled */}
      {showAISummaryOption && (
        <SummaryChat
          isOpen={summaryOpen}
          onClose={handleSummaryClose}
          context={{
            topicTitle: currentItemTitle || title,
            fileName: title,
            fileType: "video",
            isDocumentView: true,
            hierarchy: hierarchy.length > 0 ? hierarchy : [title],
            pdfUrl: videoUrl,
            isPDF: false,
          }}
        />
      )}
    </div>
  )
}