"use client"
import { getToken } from "@/lib/session";

import { useEffect, useState, useRef } from "react"
import { FileText, X, Save, Trash2, Download, Copy, Check, Plus, Edit2, Search, Clock, Pin, PinOff, Loader2, Image as ImageIcon, ChevronLeft, ChevronRight, ClipboardPaste, CheckSquare, Square } from "lucide-react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { fetchNotes, createNote, updateNote, deleteNote, togglePinNote, Note } from "@/apiServices/notesPanelService"

// Import Tiptap components
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import TextAlign from '@tiptap/extension-text-align'
import { TextStyle } from '@tiptap/extension-text-style'
import Color from '@tiptap/extension-color'
import Underline from '@tiptap/extension-underline'
import FontFamily from '@tiptap/extension-font-family'
import Image from '@tiptap/extension-image'

export interface NotesResourceContext {
  resourceId: string
  resourceType: 'pdf' | 'ppt' | 'video'
  currentAnchor?: { page?: number; timestamp?: number }
  onJumpTo?: (anchor: { page?: number; timestamp?: number }) => void
  // Called by the panel after any create/update/delete so the viewer can
  // refresh its anchored-note cache without waiting for panel close.
  onNotesChanged?: () => void
}

interface NotesPanelProps {
  isOpen: boolean
  onClose: () => void
  isDraggable?: boolean  // Control drag behavior
  initialNoteData?: string | null  // Add this prop for initial note data
  // Optional resource context — when provided, panel gains
  // "This resource" / "All notes" tabs and can create anchored notes.
  resourceContext?: NotesResourceContext | null
  // When provided (and matches an anchored note), the panel auto-selects it.
  filterNoteId?: string | null
}

// Format seconds as m:ss or h:mm:ss for anchor chips
const _fmtTs = (s: number): string => {
  if (!isFinite(s) || s < 0) s = 0
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = Math.floor(s % 60)
  const pad = (n: number) => n.toString().padStart(2, "0")
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`
}

export default function NotesPanel({ isOpen, onClose, isDraggable = false, initialNoteData = null, resourceContext = null, filterNoteId = null }: NotesPanelProps) {
  // 'resource' when opened from a viewer, 'all' otherwise. Kept in sync with prop.
  const [activeTab, setActiveTab] = useState<'resource' | 'all'>(resourceContext ? 'resource' : 'all')
  useEffect(() => { setActiveTab(resourceContext ? 'resource' : 'all') }, [resourceContext?.resourceId, resourceContext?.resourceType])
  const [currentNote, setCurrentNote] = useState<Note | null>(null)
  const [isEditing, setIsEditing] = useState(true)
  const [editContent, setEditContent] = useState("")
  const [editTitle, setEditTitle] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [copied, setCopied] = useState(false)
  const [pasted, setPasted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [editorKey, setEditorKey] = useState(0)
  const [isClient, setIsClient] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [isEditorReady, setIsEditorReady] = useState(false)
  const [toolbarUpdate, setToolbarUpdate] = useState(0)
  const [showNotesSidebar, setShowNotesSidebar] = useState(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [showSaveConfirm, setShowSaveConfirm] = useState(false)
  const [pendingClose, setPendingClose] = useState(false)
  const [selectedNotes, setSelectedNotes] = useState<string[]>([])
  const [isSelecting, setIsSelecting] = useState(false)
  const [showDeleteToast, setShowDeleteToast] = useState(false)
  const [deletedNoteTitle, setDeletedNoteTitle] = useState("")
  const [saveNoteTitle, setSaveNoteTitle] = useState("")
  const [showSaveToast, setShowSaveToast] = useState(false)

  // Three-dot dropdown state
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null)
  // Delete confirmation modal state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [notesToDelete, setNotesToDelete] = useState<string[]>([])
  const [deleteConfirmTitle, setDeleteConfirmTitle] = useState("")

  // Drag state variables - only used when isDraggable is true
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isResizing, setIsResizing] = useState(false);
  const [size, setSize] = useState({ width: 400, height: 600 });
  const {
    data: notes = [],
    isLoading: isLoadingNotes,
    error: notesError,
    refetch: refetchNotes
  } = useQuery({
    queryKey: ['notes', token],
    queryFn: () => {
      if (!token) throw new Error("No token available")
      return fetchNotes(token)
    },
    enabled: isOpen && !!token,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  })
  const fileInputRef = useRef<HTMLInputElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const saveTitleInputRef = useRef<HTMLInputElement>(null)
  const queryClient = useQueryClient()

  // Font families available
  const fontFamilies = [
    { name: 'Default', value: '' },
    { name: 'Arial', value: 'Arial, sans-serif' },
    { name: 'Times New Roman', value: 'Times New Roman, serif' },
    { name: 'Georgia', value: 'Georgia, serif' },
    { name: 'Verdana', value: 'Verdana, sans-serif' },
    { name: 'Courier New', value: 'Courier New, monospace' },
    { name: 'Comic Sans MS', value: 'Comic Sans MS, cursive' },
    { name: 'Trebuchet MS', value: 'Trebuchet MS, sans-serif' },
    { name: 'Impact', value: 'Impact, sans-serif' },
  ]



  // Add this useEffect near your other useEffect hooks in NotesPanel (around line 50-70)
  useEffect(() => {
    const handleOpenNotesPanel = () => {
      console.log('Received open-notes-panel event');

      // This will trigger the parent to open the panel
      // We'll dispatch an event that the parent component can listen to
      window.dispatchEvent(new CustomEvent('notes-panel-should-open'));

      // Always show sidebar when opened from toast
      setShowNotesSidebar(true);

      // Refresh notes data
      if (token) {
        queryClient.invalidateQueries({ queryKey: ['notes'] });
        refetchNotes();
      }
    };

    // Listen for the event from SummaryChat toast
    window.addEventListener('open-notes-panel', handleOpenNotesPanel);

    return () => {
      window.removeEventListener('open-notes-panel', handleOpenNotesPanel);
    };
  }, [token, queryClient, refetchNotes]);

  // Add this useEffect to handle specific note selection
  useEffect(() => {
    const handleNotesDataUpdated = (event: CustomEvent) => {
      const { noteId } = event.detail || {};

      if (noteId) {
        console.log('Received notes-data-updated event for note:', noteId);

        // Delay slightly to ensure notes are loaded
        setTimeout(() => {
          const note = notes.find(n => n._id === noteId);
          if (note) {
            // Select the specific note that was just created
            setCurrentNote(note);
            setEditTitle(note.title);
            setEditContent(note.content || "");
            setIsEditing(true);
            setHasUnsavedChanges(false);
            setShowNotesSidebar(true);
          }

          // Refresh notes list
          queryClient.invalidateQueries({ queryKey: ['notes'] });
        }, 1000);
      }
    };

    window.addEventListener('notes-data-updated', handleNotesDataUpdated as EventListener);

    return () => {
      window.removeEventListener('notes-data-updated', handleNotesDataUpdated as EventListener);
    };
  }, [notes, queryClient]);
  // Drag handlers - only used when isDraggable is true
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!isDraggable) return;

    // Don't drag if clicking on buttons, inputs, or other interactive elements
    if (
      (e.target as HTMLElement).closest('button') ||
      (e.target as HTMLElement).closest('input') ||
      (e.target as HTMLElement).closest('select') ||
      (e.target as HTMLElement).closest('.no-drag') ||
      (e.target as HTMLElement).closest('.resize-handle')
    ) {
      return;
    }

    setIsDragging(true);
    setDragStart({
      x: e.clientX - position.x,
      y: e.clientY - position.y
    });
    e.preventDefault();
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDraggable) return;

    if (isDragging) {
      const newX = e.clientX - dragStart.x;
      const newY = e.clientY - dragStart.y;

      // Calculate boundaries
      const maxX = window.innerWidth - size.width;
      const maxY = window.innerHeight - size.height;

      setPosition({
        x: Math.max(0, Math.min(maxX, newX)),
        y: Math.max(0, Math.min(maxY, newY))
      });
    }
  };

  const handleMouseUp = () => {
    if (!isDraggable) return;
    setIsDragging(false);
    setIsResizing(false);
  };

  // Resize handlers
  const handleResizeMouseDown = (e: React.MouseEvent) => {
    if (!isDraggable) return;
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    setDragStart({
      x: e.clientX,
      y: e.clientY
    });
  };

  const handleResizeMouseMove = (e: MouseEvent) => {
    if (!isDraggable || !isResizing) return;

    const deltaX = e.clientX - dragStart.x;
    const deltaY = e.clientY - dragStart.y;

    const newWidth = Math.max(300, Math.min(800, size.width + deltaX));
    const newHeight = Math.max(400, Math.min(1000, size.height + deltaY));

    setSize({ width: newWidth, height: newHeight });
    setDragStart({ x: e.clientX, y: e.clientY });
  };




  useEffect(() => {
    if (isOpen && initialNoteData) {
      try {
        const noteData = JSON.parse(initialNoteData);
        console.log('Loading initial note in PDF viewer:', noteData.title);

        // Create temporary note object
        const tempNote: Note = {
          _id: noteData._id,
          title: noteData.title,
          content: noteData.content,
          tags: noteData.tags || ['ai-summary'],
          isPinned: false,
          color: "#ffffff",
          userId: "",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          lastEdited: new Date().toISOString()
        };

        setCurrentNote(tempNote);
        setEditTitle(tempNote.title);
        setEditContent(tempNote.content || "");
        setIsEditing(true);
        setHasUnsavedChanges(false);

        // Clear the stored data after loading
        localStorage.removeItem('lastCreatedNote');
        localStorage.removeItem('lastCreatedNoteId');

      } catch (error) {
        console.error('Error parsing initial note data:', error);
      }
    }
  }, [isOpen, initialNoteData]);
  // Add event listeners for dragging and resizing - only when draggable
  useEffect(() => {
    if (isDraggable) {
      document.addEventListener('mousemove', isResizing ? handleResizeMouseMove : handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);

      if (isDragging || isResizing) {
        document.body.style.userSelect = 'none';
        document.body.style.cursor = isResizing ? 'nwse-resize' : 'grabbing';
      }
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mousemove', handleResizeMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
  }, [isDraggable, isDragging, isResizing, dragStart]);

  // Reset position and size when panel opens - only when draggable
  useEffect(() => {
    if (isOpen && isDraggable) {
      setPosition({
        x: window.innerWidth - 400, // 400px width + 20px margin from right
        y: 65 // 20px from top
      });
      setSize({ width: 400, height: 500 });
    }
  }, [isOpen, isDraggable]);
  // Set isClient to true when component mounts on client
  useEffect(() => {
    setIsClient(true)
  }, [])


  // Update this useEffect to load the stored note data immediately
  // Update the existing useEffect for localStorage
  useEffect(() => {
    if (isOpen && token && notes.length > 0) {
      // Check both localStorage and props for saved note
      const lastCreatedNoteData = localStorage.getItem('lastCreatedNote') || initialNoteData;
      const lastCreatedNoteId = localStorage.getItem('lastCreatedNoteId');

      if (lastCreatedNoteData) {
        try {
          const noteData = typeof lastCreatedNoteData === 'string'
            ? JSON.parse(lastCreatedNoteData)
            : lastCreatedNoteData;

          console.log('Loading note in notes panel:', noteData.title);

          // Only load if we're in the right context
          // Check if we're in PDF viewer by looking at the URL or parent context
          const isInPDFViewer = window.location.pathname.includes('pdf') ||
            document.querySelector('.pdf-viewer');

          if (isInPDFViewer) {
            const tempNote: Note = {
              _id: noteData._id,
              title: noteData.title,
              content: noteData.content,
              tags: noteData.tags || ['ai-summary'],
              isPinned: false,
              color: "#ffffff",
              userId: "",
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              lastEdited: new Date().toISOString()
            };

            setCurrentNote(tempNote);
            setEditTitle(tempNote.title);
            setEditContent(tempNote.content || "");
            setIsEditing(true);
            setHasUnsavedChanges(false);
            setShowNotesSidebar(true); // Show sidebar automatically

            // Clear storage after use
            localStorage.removeItem('lastCreatedNote');
            localStorage.removeItem('lastCreatedNoteId');
          }

          // Now try to find the real note in the fetched list
          setTimeout(() => {
            const realNote = notes.find(note => note._id === noteData._id);
            if (realNote) {
              console.log('Found real note in fetched list:', realNote.title);
              setCurrentNote(realNote);
              setEditTitle(realNote.title);
              setEditContent(realNote.content || "");
            }
          }, 500);

        } catch (error) {
          console.error('Error parsing stored note data:', error);
        }
      }
    }
  }, [isOpen, token, notes, initialNoteData]);

  // Focus save title input when save confirm modal opens

  // Add this useEffect to handle opening from toast for all viewers
  useEffect(() => {
    const handleOpenFromToast = () => {
      console.log('Opening notes panel from toast in viewer context');

      // Force the notes panel to open
      window.dispatchEvent(new CustomEvent('force-open-notes-in-viewer'));

      // Show sidebar when opened from toast
      setShowNotesSidebar(true);

      // Refresh notes data
      if (token) {
        queryClient.invalidateQueries({ queryKey: ['notes'] });
        refetchNotes();
      }
    };

    // Listen for the event from the toast
    window.addEventListener('open-notes-panel-from-toast', handleOpenFromToast);

    return () => {
      window.removeEventListener('open-notes-panel-from-toast', handleOpenFromToast);
    };
  }, [token, queryClient, refetchNotes]);

  // Update the existing useEffect for notes-data-updated to work in all viewer contexts
  useEffect(() => {
    const handleNotesDataUpdated = (event: CustomEvent) => {
      const { noteId } = event.detail || {};

      if (noteId) {
        console.log('Received notes-data-updated event for note:', noteId);

        // Check if we're in any viewer context (PDF, PPT, Video)
        const isInViewer = window.location.pathname.includes('pdf') ||
          window.location.pathname.includes('ppt') ||
          window.location.pathname.includes('video') ||
          document.querySelector('.pdf-viewer') ||
          document.querySelector('.ppt-viewer') ||
          document.querySelector('.video-player') ||
          document.querySelector('[class*="pdf-viewer"]') ||
          document.querySelector('[class*="ppt-viewer"]') ||
          document.querySelector('[class*="video-player"]');

        if (isInViewer) {
          // Wait a bit for notes to load
          setTimeout(() => {
            const note = notes.find(n => n._id === noteId);
            if (note) {
              console.log('Found note in viewer context:', note.title);
              // Select the specific note that was just created
              setCurrentNote(note);
              setEditTitle(note.title);
              setEditContent(note.content || "");
              setIsEditing(true);
              setHasUnsavedChanges(false);
              setShowNotesSidebar(true);

              // Scroll to the note in the sidebar if it exists
              const noteElement = document.querySelector(`[data-note-id="${noteId}"]`);
              if (noteElement) {
                noteElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }
            }

            // Refresh notes list
            queryClient.invalidateQueries({ queryKey: ['notes'] });
          }, 800);
        }
      }
    };

    window.addEventListener('notes-data-updated', handleNotesDataUpdated as EventListener);

    return () => {
      window.removeEventListener('notes-data-updated', handleNotesDataUpdated as EventListener);
    };
  }, [notes, queryClient]);
  useEffect(() => {
    if (showSaveConfirm && saveTitleInputRef.current) {
      setTimeout(() => {
        saveTitleInputRef.current?.focus()
        setSaveNoteTitle(editTitle || "Untitled Note")
      }, 100)
    }
  }, [showSaveConfirm])

  // Tiptap Editor Configuration - only initialize on client
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
        bulletList: {
          HTMLAttributes: {
            class: 'bullet-list',
          },
          keepMarks: true,
          keepAttributes: true,
        },
        orderedList: {
          HTMLAttributes: {
            class: 'ordered-list',
          },
          keepMarks: true,
          keepAttributes: true,
        },
      }),
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      TextStyle,
      Color,
      Underline,
      FontFamily.configure({
        types: ['textStyle'],
      }),
      Image.configure({
        HTMLAttributes: {
          class: 'rich-text-image',
        },
        allowBase64: true,
      }),
    ],
    content: editContent,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML()
      setEditContent(html)
      setToolbarUpdate(prev => prev + 1)
      setHasUnsavedChanges(true)
    },
    onTransaction: () => {
      setToolbarUpdate(prev => prev + 1)
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none focus:outline-none min-h-full p-4',
      },
    },
    immediatelyRender: false,
    enableInputRules: true,
    enablePasteRules: true,
    onCreate: () => {
      setIsEditorReady(true)
    },
    onDestroy: () => {
      setIsEditorReady(false)
    },
  }, [isClient, editorKey])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!(event.target as Element).closest('.three-dot-menu')) {
        setOpenDropdownId(null)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Update editor content when editContent changes
  useEffect(() => {
    if (editor && editContent !== editor.getHTML()) {
      setTimeout(() => {
        if (editor && !editor.isDestroyed) {
          editor.commands.setContent(editContent, { emitUpdate: false })
        }
      }, 0)
    }
  }, [editor, editContent])

  // Reset editor when switching between notes
  useEffect(() => {
    if (editor && currentNote && isEditing) {
      const timer = setTimeout(() => {
        if (editor && !editor.isDestroyed) {
          editor.commands.setContent(currentNote.content || "", { emitUpdate: false })
          setHasUnsavedChanges(false)
        }
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [editor, currentNote?._id, isEditing])

  // Handle editor mounting and unmounting
  useEffect(() => {
    return () => {
      if (editor) {
        editor.destroy()
      }
    }
  }, [editor])

  // Image upload handler
  const handleImageUpload = async (file: File) => {
    if (!editor) return

    setIsUploading(true)

    try {
      const reader = new FileReader()

      reader.onload = (e) => {
        const base64 = e.target?.result as string
        if (base64) {
          editor.chain().focus().setImage({ src: base64 }).run()
          setHasUnsavedChanges(true)
        }
        setIsUploading(false)
      }

      reader.onerror = () => {
        setError("Failed to read image file")
        setIsUploading(false)
      }

      reader.readAsDataURL(file)

    } catch (error) {
      console.error("Image upload error:", error)
      setError("Failed to upload image")
      setIsUploading(false)
    }
  }

  // Handle file input change
  const handleFileInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setError("Please select an image file")
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("Image size should be less than 5MB")
      return
    }

    handleImageUpload(file)

    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  // Trigger file input click
  const triggerImageUpload = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click()
    }
  }

  // Get token from localStorage when component mounts
  useEffect(() => {
    if (isOpen) {
      const storedToken = getToken()
      setToken(storedToken)

      // Create a default new note when panel opens
      if (!currentNote) {
        setEditTitle("Untitled Note")
        setEditContent("")
        setIsEditing(true)
        setHasUnsavedChanges(false)
      }
    }
  }, [isOpen])
  // React Query for notes
  // React Query for notes



  // Set error from query
  useEffect(() => {
    if (notesError) {
      setError(notesError instanceof Error ? notesError.message : 'Failed to load notes')
    }
  }, [notesError])

  // ✅ ADD THIS USEEFFECT RIGHT HERE - Event listeners for notes updates
  useEffect(() => {
    const handleRefresh = () => {
      console.log('Refreshing notes data...');
      queryClient.invalidateQueries({ queryKey: ['notes'] });
      refetchNotes();
    };

    window.addEventListener('notesDataUpdated', handleRefresh);
    window.addEventListener('refreshNotes', handleRefresh);

    return () => {
      window.removeEventListener('notesDataUpdated', handleRefresh);
      window.removeEventListener('refreshNotes', handleRefresh);
    };
  }, [queryClient, refetchNotes]);

  // ✅ ALSO ADD THIS - Refresh when panel opens
  useEffect(() => {
    if (isOpen && token) {
      console.log('Notes panel opened, refreshing notes...');
      const timer = setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['notes'] });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen, token, queryClient]);

  // Mutations
  const createNoteMutation = useMutation({
    mutationFn: async (noteData: Partial<Note>) => {
      if (!token) throw new Error("No token available")
      return createNote(noteData, token)
    },
    onSuccess: (newNote) => {
      queryClient.setQueryData(['notes', token], (old: Note[] = []) => [newNote, ...old])
      setCurrentNote(newNote)
      setEditTitle(newNote.title)
      setEditContent(newNote.content || "")
      setIsEditing(true)
      setEditorKey(prev => prev + 1)
      setError(null)
      setHasUnsavedChanges(false)
      // Show save success toast
      setShowSaveToast(true)
      setTimeout(() => setShowSaveToast(false), 3000)
      resourceContext?.onNotesChanged?.()
    },
    onError: (error: Error) => {
      setError(error.message)
    }
  })

  const updateNoteMutation = useMutation({
    mutationFn: async ({ noteId, noteData }: { noteId: string; noteData: Partial<Note> }) => {
      if (!token) throw new Error("No token available")
      return updateNote(noteId, noteData, token)
    },
    onSuccess: (updatedNote) => {
      queryClient.setQueryData(['notes', token], (old: Note[] = []) =>
        old.map(n => n._id === updatedNote._id ? updatedNote : n)
      )
      setCurrentNote(updatedNote)
      setIsEditing(false)
      setError(null)
      setHasUnsavedChanges(false)
      // Show save success toast
      setShowSaveToast(true)
      setTimeout(() => setShowSaveToast(false), 3000)
      resourceContext?.onNotesChanged?.()
    },
    onError: (error: Error) => {
      setError(error.message)
    }
  })

  const deleteNoteMutation = useMutation({
    mutationFn: async (noteIds: string[]) => {
      if (!token) throw new Error("No token available")
      // Join note IDs with slashes for the backend
      const path = noteIds.join('/')
      return deleteNote(path, token)
    },
    onSuccess: (response, noteIds) => {
      queryClient.setQueryData(['notes', token], (old: Note[] = []) =>
        old.filter(n => !noteIds.includes(n._id))
      )

      // Show delete toast
      if (noteIds.length === 1) {
        const deletedNote = notes.find(n => n._id === noteIds[0])
        setDeletedNoteTitle(deletedNote?.title || "Untitled Note")
      } else {
        setDeletedNoteTitle(`${noteIds.length} notes`)
      }
      setShowDeleteToast(true)
      setTimeout(() => setShowDeleteToast(false), 3000)

      // Clear selection
      setSelectedNotes([])
      setIsSelecting(false)

      // If current note was deleted, clear it
      if (currentNote && noteIds.includes(currentNote._id)) {
        setCurrentNote(null)
        setIsEditing(true)
        setEditTitle("Untitled Note")
        setEditContent("")
        setHasUnsavedChanges(false)
      }
      setError(null)
      resourceContext?.onNotesChanged?.()
    },
    onError: (error: Error) => {
      setError(error.message)
    }
  })
  const togglePinMutation = useMutation({
    mutationFn: async (noteId: string) => {
      if (!token) throw new Error("No token available")
      return togglePinNote(noteId, token)
    },
    onSuccess: (updatedNote) => {
      queryClient.setQueryData(['notes', token], (old: Note[] = []) =>
        old.map(n => n._id === updatedNote._id ? updatedNote : n)
      )
      if (currentNote?._id === updatedNote._id) {
        setCurrentNote(updatedNote)
      }
      setError(null)
    },
    onError: (error: Error) => {
      setError(error.message)
    }
  })

  // Reset internal state when panel closes
  useEffect(() => {
    if (!isOpen) {
      // Clear localStorage when panel closes
      localStorage.removeItem('lastCreatedNote');
      localStorage.removeItem('lastCreatedNoteId');

      // Reset all state
      setCurrentNote(null);
      setIsEditing(true);
      setOpenDropdownId(null);
      setEditContent("");
      setEditTitle("Untitled Note");
      setSearchQuery("");
      setError(null);
      setEditorKey(0);
      setIsEditorReady(false);
      setToolbarUpdate(0);
      setShowNotesSidebar(false);
      setHasUnsavedChanges(false);
      setShowSaveConfirm(false);
      setPendingClose(false);
      setSelectedNotes([]);
      setIsSelecting(false);
      setSaveNoteTitle("");

      // Reset delete confirmation state
      setShowDeleteConfirm(false);
      setNotesToDelete([]);
      setDeleteConfirmTitle("");
      setShowSaveToast(false);
      setShowDeleteToast(false);
      setDeletedNoteTitle("");

      // Reset copy/paste states
      setCopied(false);
      setPasted(false);

      // Reset drag-related states (if draggable)
      if (isDraggable) {
        setPosition({ x: 0, y: 0 });
        setIsDragging(false);
        setDragStart({ x: 0, y: 0 });
        setIsResizing(false);
        setSize({ width: 400, height: 600 });
      }

      // Clean up editor
      if (editor && !editor.isDestroyed) {
        editor.commands.clearContent();
      }
    }
  }, [isOpen, isDraggable, editor])

  // Data update listener for real-time updates
  useEffect(() => {
    const handleDataUpdate = (event: CustomEvent) => {
      const { version } = event.detail
      queryClient.invalidateQueries({ queryKey: ['notes'] })
    }

    window.addEventListener('notesDataUpdated', handleDataUpdate as EventListener)

    return () => {
      window.removeEventListener('notesDataUpdated', handleDataUpdate as EventListener)
    }
  }, [queryClient])

  // Save to localStorage as backup
  useEffect(() => {
    if (notes.length > 0) {
      sessionStorage.setItem("lms-notes-list", JSON.stringify(notes))
    }
  }, [notes])

  // Selection handlers
  const toggleNoteSelection = (noteId: string) => {
    setSelectedNotes(prev =>
      prev.includes(noteId)
        ? prev.filter(id => id !== noteId)
        : [...prev, noteId]
    )
  }

  const toggleSelectAll = () => {
    if (selectedNotes.length === filteredNotes.length) {
      setSelectedNotes([])
    } else {
      setSelectedNotes(filteredNotes.map(note => note._id))
    }
  }

  const clearSelection = () => {
    setSelectedNotes([])
    setIsSelecting(false)
  }

  // Enhanced delete confirmation handlers
  const showDeleteConfirmation = (noteIds: string[]) => {
    setNotesToDelete(noteIds)

    if (noteIds.length === 1) {
      const noteToDelete = notes.find(n => n._id === noteIds[0])
      setDeleteConfirmTitle(noteToDelete?.title || "Untitled Note")
    } else {
      setDeleteConfirmTitle(`${noteIds.length} notes`)
    }

    setShowDeleteConfirm(true)
  }

  const cancelDelete = () => {
    setShowDeleteConfirm(false)
    setNotesToDelete([])
    setDeleteConfirmTitle("")
  }

  const confirmDelete = () => {
    deleteNoteMutation.mutate(notesToDelete)
    setShowDeleteConfirm(false)
    setNotesToDelete([])
    setDeleteConfirmTitle("")
  }

  // Handle close with save confirmation
  const handleClose = () => {
    const isEmptyNote = !editContent.trim() && editTitle === "Untitled Note";

    // Clear localStorage when closing
    localStorage.removeItem('lastCreatedNote');
    localStorage.removeItem('lastCreatedNoteId');

    // For existing notes with unsaved changes
    if (currentNote && hasUnsavedChanges) {
      setShowSaveConfirm(true);
      setPendingClose(true);
      setSaveNoteTitle(currentNote.title);
    }
    // For new notes that have content
    else if (!currentNote && !isEmptyNote) {
      setShowSaveConfirm(true);
      setPendingClose(true);
      setSaveNoteTitle("");
    }
    // For empty notes or no unsaved changes, close directly
    else {
      onClose();
    }
  };
  const closeWithoutSaving = () => {
    setShowSaveConfirm(false);

    // Clear localStorage when closing without saving
    localStorage.removeItem('lastCreatedNote');
    localStorage.removeItem('lastCreatedNoteId');

    if (pendingClose) {
      setHasUnsavedChanges(false);
      onClose();
    }
  }

  const cancelClose = () => {
    setShowSaveConfirm(false);
    setPendingClose(false);
  }

  const saveWithTitle = () => {
    if (!editor) return;

    const finalContent = editor.getHTML();
    const finalTitle = saveNoteTitle.trim() || "Untitled Note";

    if (currentNote) {
      // Update existing note
      const noteData = {
        title: finalTitle,
        content: finalContent,
        tags: currentNote.tags,
        isPinned: currentNote.isPinned,
        color: currentNote.color
      };
      updateNoteMutation.mutate({ noteId: currentNote._id, noteData });
    } else {
      // Create new note (attach anchor when opened from a viewer on the resource tab)
      const newNoteData: Partial<Note> = {
        title: finalTitle,
        content: finalContent,
        tags: [],
        isPinned: false,
        color: "#ffffff"
      };
      if (resourceContext && activeTab === 'resource') {
        newNoteData.resourceId = resourceContext.resourceId
        newNoteData.resourceType = resourceContext.resourceType
        const a = resourceContext.currentAnchor
        if (a && (a.page != null || a.timestamp != null)) {
          newNoteData.anchor = {}
          if (a.page != null) newNoteData.anchor.page = a.page
          if (a.timestamp != null) newNoteData.anchor.timestamp = a.timestamp
        }
      }
      createNoteMutation.mutate(newNoteData);
    }

    setShowSaveConfirm(false);

    // Clear localStorage after saving
    localStorage.removeItem('lastCreatedNote');
    localStorage.removeItem('lastCreatedNoteId');

    if (pendingClose) {
      setTimeout(() => onClose(), 100)
    }
  }




  const saveCurrentNote = () => {
    if (!editor) return;

    const finalContent = editor.getHTML();

    // For existing notes, save directly
    if (currentNote) {
      const noteData = {
        title: editTitle, // Use displayed title
        content: finalContent,
        tags: currentNote.tags,
        isPinned: currentNote.isPinned,
        color: currentNote.color
      };
      updateNoteMutation.mutate({ noteId: currentNote._id, noteData });
    } else {
      // For new notes, always show "Save as" modal
      setShowSaveConfirm(true);
      setPendingClose(false);
      setSaveNoteTitle(""); // Start with empty for new note
    }
  };

  const createNewNote = () => {
    const isEmptyNote = !editContent.trim() && editTitle === "Untitled Note";

    // Check if current note has unsaved changes and is not empty
    if (hasUnsavedChanges && !isEmptyNote) {
      setShowSaveConfirm(true);
      setPendingClose(false);
      return;
    }

    // Reset to a clean new note state
    setCurrentNote(null);
    setEditTitle("Untitled Note");
    setEditContent("");
    setIsEditing(true);
    setHasUnsavedChanges(false);
    setEditorKey(prev => prev + 1);
  };

  const isEmptyNote = (): boolean => {
    return !editContent.trim() && (editTitle === "Untitled Note" || !editTitle.trim());
  };

  // UPDATED: Delete handlers to use modal confirmation
  const deleteNoteHandler = (noteId: string) => {
    showDeleteConfirmation([noteId])
  };

  const deleteSelectedNotes = () => {
    if (selectedNotes.length === 0) return;
    showDeleteConfirmation(selectedNotes)
  };

  const togglePinNoteHandler = (noteId: string) => {
    togglePinMutation.mutate(noteId)
  };

  const selectNote = (note: Note) => {
    // Close sidebar when selecting a note
    setShowNotesSidebar(false);

    const isEmptyNote = !editContent.trim() && editTitle === "Untitled Note";

    // Check for unsaved changes before switching (only if note is not empty)
    if (hasUnsavedChanges && !isEmptyNote) {
      setShowSaveConfirm(true);
      // Store the note to switch to after save decision
      setPendingClose(false);
      return;
    }

    setCurrentNote(note);
    setEditTitle(note.title);
    setEditContent(note.content || "");
    setIsEditing(true);
    setHasUnsavedChanges(false);
  };

  // Auto-select a note when opened with filterNoteId (from an indicator click)
  useEffect(() => {
    if (!isOpen || !filterNoteId) return
    const match = notes.find(n => n._id === filterNoteId)
    if (match && currentNote?._id !== match._id) {
      setCurrentNote(match)
      setEditTitle(match.title)
      setEditContent(match.content || "")
      setIsEditing(true)
      setHasUnsavedChanges(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterNoteId, isOpen, notes.length]);
  const copyToClipboard = async () => {
    const contentToCopy = editor ? editor.getText() : "";
    if (!contentToCopy.trim()) return;

    try {
      await navigator.clipboard.writeText(contentToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
      setError("Failed to copy to clipboard");
    }
  };

  // Add these functions to your component
  const copyNoteToClipboard = async (note: Note) => {
    const contentToCopy = note.content ? note.content.replace(/<[^>]*>/g, ' ').trim() : "";
    if (!contentToCopy) return;

    try {
      await navigator.clipboard.writeText(contentToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
      setError("Failed to copy to clipboard");
    }
  };

  const downloadNoteFromList = (format: 'txt' | 'md', note: Note) => {
    const contentToDownload = note.content || "";
    const titleToDownload = note.title || "Untitled Note";

    if (!contentToDownload.trim()) return;

    let content: string;
    let fileType: string;
    let fileName: string;

    const sanitizedTitle = titleToDownload.replace(/[^a-z0-9]/gi, '-').toLowerCase();

    if (format === 'txt') {
      content = htmlToFormattedText(contentToDownload);
      fileType = "text/plain";
      fileName = `${sanitizedTitle}.txt`;
    } else {
      content = contentToDownload;
      fileType = "text/markdown";
      fileName = `${sanitizedTitle}.md`;
    }

    const blob = new Blob([content], { type: fileType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Paste from external clipboard
  const pasteFromClipboard = async () => {
    if (!editor) return;

    try {
      const clipboardText = await navigator.clipboard.readText();
      if (clipboardText.trim()) {
        // Insert the pasted text at the current cursor position
        editor.chain().focus().insertContent(clipboardText).run();
        setHasUnsavedChanges(true);
        setPasted(true);
        setTimeout(() => setPasted(false), 2000);
      }
    } catch (err) {
      console.error("Failed to paste:", err);
      setError("Failed to paste from clipboard");
    }
  };

  const downloadNote = (format: 'txt' | 'md' = 'txt') => {
    const contentToDownload = editor ? editor.getHTML() : "";
    const titleToDownload = editTitle || "Untitled Note";

    if (!contentToDownload.trim()) return;

    let content: string;
    let fileType: string;
    let fileName: string;

    const sanitizedTitle = titleToDownload.replace(/[^a-z0-9]/gi, '-').toLowerCase();

    if (format === 'txt') {
      content = htmlToFormattedText(contentToDownload);
      fileType = "text/plain";
      fileName = `${sanitizedTitle}.txt`;
    } else {
      content = contentToDownload;
      fileType = "text/markdown";
      fileName = `${sanitizedTitle}.md`;
    }

    const blob = new Blob([content], { type: fileType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const htmlToFormattedText = (html: string): string => {
    if (!html) return "";

    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;

    let text = processNode(tempDiv);

    text = text
      .replace(/\n\s*\n\s*\n/g, '\n\n')
      .replace(/[ \t]+/g, ' ')
      .trim();

    return text;
  };

  const processNode = (node: Node): string => {
    let text = '';

    for (const childNode of Array.from(node.childNodes)) {
      if (childNode.nodeType === Node.TEXT_NODE) {
        text += childNode.textContent || '';
      } else if (childNode.nodeType === Node.ELEMENT_NODE) {
        const element = childNode as HTMLElement;
        const tagName = element.tagName.toLowerCase();

        switch (tagName) {
          case 'br':
            text += '\n';
            break;
          case 'p':
          case 'div':
            text += processNode(element) + '\n\n';
            break;
          case 'ul':
            text += processUl(element as HTMLUListElement);
            break;
          case 'ol':
            text += processOl(element as HTMLOListElement);
            break;
          case 'li':
            text += processNode(element) + '\n';
            break;
          case 'h1':
          case 'h2':
          case 'h3':
          case 'h4':
          case 'h5':
          case 'h6':
            text += processNode(element) + '\n\n';
            break;
          case 'strong':
          case 'b':
            text += processNode(element);
            break;
          case 'em':
          case 'i':
            text += processNode(element);
            break;
          case 'blockquote':
            text += '> ' + processNode(element).replace(/\n/g, '\n> ') + '\n\n';
            break;
          default:
            text += processNode(element);
            break;
        }
      }
    }

    return text;
  };

  const processUl = (ul: HTMLUListElement): string => {
    let text = '';
    const items = ul.querySelectorAll('li');
    items.forEach(item => {
      text += '• ' + processNode(item).trim() + '\n';
    });
    return text + '\n';
  };

  const processOl = (ol: HTMLOListElement): string => {
    let text = '';
    const items = ol.querySelectorAll('li');
    items.forEach((item, index) => {
      text += `${index + 1}. ` + processNode(item).trim() + '\n';
    });
    return text + '\n';
  };

  // Use lastEdited instead of updatedAt
  const formatDate = (dateString: string) => {
    const date = new Date(dateString || new Date());
    return date.toLocaleDateString('en-GB'); // DD/MM/YYYY format
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString || new Date());
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    }).toLowerCase(); // returns like "2:30 pm"
  };

  const getWordCount = (text: string) => {
    if (!text) return 0;
    const cleanText = text.replace(/<[^>]*>/g, ' ').trim();
    return cleanText.split(/\s+/).filter(word => word.length > 0).length;
  };

  // Filter and sort notes. When a resource context is active and the tab is
  // 'resource', restrict to notes anchored to this resource.
  const filteredNotes = notes.filter(n => {
    if (resourceContext && activeTab === 'resource') {
      if (n.resourceId !== resourceContext.resourceId) return false
      if (n.resourceType && n.resourceType !== resourceContext.resourceType) return false
    }
    return (
      n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      n.content?.toLowerCase().includes(searchQuery.toLowerCase())
    )
  });

  const sortedNotes = [...filteredNotes].sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    return new Date(b.lastEdited).getTime() - new Date(a.lastEdited).getTime();
  });

  // Combined loading state
  const isLoading = isLoadingNotes ||
    createNoteMutation.isPending ||
    updateNoteMutation.isPending ||
    deleteNoteMutation.isPending ||
    togglePinMutation.isPending;

  // Check if save button should be enabled
  const isSaveEnabled = token && (hasUnsavedChanges || !currentNote) &&
    (editContent.trim() || (editTitle.trim() && editTitle !== "Untitled Note"));

  // Render Tiptap toolbar
const renderTiptapToolbar = () => {
  if (!editor) return null
    return (
      <div className="tiptap-toolbar">
        {/* Font Family */}
        <div className="tiptap-toolbar-group">
          <select
            value={editor.getAttributes('textStyle').fontFamily || ''}
            onChange={(e) => {
              const fontFamily = e.target.value
              if (fontFamily) {
                editor.chain().focus().setFontFamily(fontFamily).run()
              } else {
                editor.chain().focus().unsetFontFamily().run()
              }
            }}
            className="tiptap-toolbar-select"
            title="Font Family"
            style={{
              minWidth: '120px',
              fontFamily: editor.getAttributes('textStyle').fontFamily || 'inherit'
            }}
          >
            {fontFamilies.map((font) => (
              <option
                key={font.value}
                value={font.value}
                style={{ fontFamily: font.value || 'inherit' }}
              >
                {font.name}
              </option>
            ))}
          </select>
        </div>

        {/* Text Formatting */}
        <div className="tiptap-toolbar-group">
          <button
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={`tiptap-toolbar-button ${editor.isActive('bold') ? 'is-active' : ''}`}
            title="Bold"
            type="button"
          >
            <strong>B</strong>
          </button>
          <button
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={`tiptap-toolbar-button ${editor.isActive('italic') ? 'is-active' : ''}`}
            title="Italic"
            type="button"
          >
            <em>I</em>
          </button>
          <button
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            className={`tiptap-toolbar-button ${editor.isActive('underline') ? 'is-active' : ''}`}
            title="Underline"
            type="button"
          >
            <u>U</u>
          </button>
          <button
            onClick={() => editor.chain().focus().toggleStrike().run()}
            className={`tiptap-toolbar-button ${editor.isActive('strike') ? 'is-active' : ''}`}
            title="Strikethrough"
            type="button"
          >
            <s>S</s>
          </button>
        </div>

        {/* Headings */}
        <div className="tiptap-toolbar-group">
          <button
            onClick={() => editor.chain().focus().setParagraph().run()}
            className={`tiptap-toolbar-button ${editor.isActive('paragraph') ? 'is-active' : ''}`}
            title="Paragraph"
            type="button"
          >
            P
          </button>
          <button
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            className={`tiptap-toolbar-button ${editor.isActive('heading', { level: 1 }) ? 'is-active' : ''}`}
            title="Heading 1"
            type="button"
          >
            H1
          </button>
          <button
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            className={`tiptap-toolbar-button ${editor.isActive('heading', { level: 2 }) ? 'is-active' : ''}`}
            title="Heading 2"
            type="button"
          >
            H2
          </button>
          <button
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            className={`tiptap-toolbar-button ${editor.isActive('heading', { level: 3 }) ? 'is-active' : ''}`}
            title="Heading 3"
            type="button"
          >
            H3
          </button>
        </div>

        {/* Lists */}
        <div className="tiptap-toolbar-group">
          <button
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={`tiptap-toolbar-button ${editor.isActive('bulletList') ? 'is-active' : ''}`}
            title="Bullet List"
            type="button"
          >
            • List
          </button>
          <button
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            className={`tiptap-toolbar-button ${editor.isActive('orderedList') ? 'is-active' : ''}`}
            title="Numbered List"
            type="button"
          >
            1. List
          </button>
        </div>

        {/* Alignment */}
        <div className="tiptap-toolbar-group">
          <button
            onClick={() => editor.chain().focus().setTextAlign('left').run()}
            className={`tiptap-toolbar-button ${editor.isActive({ textAlign: 'left' }) ? 'is-active' : ''}`}
            title="Align Left"
            type="button"
          >
            ←
          </button>
          <button
            onClick={() => editor.chain().focus().setTextAlign('center').run()}
            className={`tiptap-toolbar-button ${editor.isActive({ textAlign: 'center' }) ? 'is-active' : ''}`}
            title="Align Center"
            type="button"
          >
            ↔
          </button>
          <button
            onClick={() => editor.chain().focus().setTextAlign('right').run()}
            className={`tiptap-toolbar-button ${editor.isActive({ textAlign: 'right' }) ? 'is-active' : ''}`}
            title="Align Right"
            type="button"
          >
            →
          </button>
        </div>

        {/* Text Color */}
        <div className="tiptap-toolbar-group">
          <input
            type="color"
            onInput={event => editor.chain().focus().setColor(event.currentTarget.value).run()}
            value={editor.getAttributes('textStyle').color || '#000000'}
            title="Text Color"
            className="tiptap-toolbar-button"
            style={{ padding: 0, width: '2rem', height: '2rem' }}
          />
        </div>

        {/* Image Upload */}
        <div className="tiptap-toolbar-group">
          <button
            onClick={triggerImageUpload}
            disabled={isUploading}
            className={`tiptap-toolbar-button ${isUploading ? 'opacity-50' : ''}`}
            title="Insert Image"
            type="button"
          >
            {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
          </button>
        </div>

        {/* Clear Formatting */}
        <div className="tiptap-toolbar-group">
          <button
            onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()}
            className="tiptap-toolbar-button"
            title="Clear Formatting"
            type="button"
          >
            Clear
          </button>
        </div>
      </div>
    )
  }

  // Hidden file input for image upload
  const renderHiddenFileInput = () => (
    <input
      type="file"
      ref={fileInputRef}
      onChange={handleFileInputChange}
      accept="image/*"
      style={{ display: 'none' }}
    />
  )

  // Delete Confirmation Modal
  const renderDeleteConfirmation = () => {
    if (!showDeleteConfirm) return null;

    return (
      <div className="delete-confirm-overlay">
        <div className="delete-confirm-modal">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
              <Trash2 className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-gray-900">Delete Note{notesToDelete.length > 1 ? 's' : ''}</h3>
              <p className="text-sm text-gray-600 mt-1">
                Are you sure you want to delete "{deleteConfirmTitle}"?
              </p>
            </div>
          </div>

          <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
            <p className="text-xs text-red-700 flex items-center gap-2">
              <span className="w-4 h-4 bg-red-200 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-red-600 font-bold text-xs">!</span>
              </span>
              This action cannot be undone. The note{notesToDelete.length > 1 ? 's' : ''} will be permanently removed.
            </p>
          </div>

          <div className="flex gap-3 justify-end">
            <button
              onClick={cancelDelete}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
            >
              Cancel
            </button>
            <button
              onClick={confirmDelete}
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-lg hover:bg-red-700 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
            >
              Delete{notesToDelete.length > 1 ? ` ${notesToDelete.length} Notes` : ''}
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Resize handle component
  const renderResizeHandle = () => {
    if (!isDraggable) return null;

    return (
      <div
        className="resize-handle absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize bg-gray-300 hover:bg-gray-400 transition-colors rounded-tl"
        onMouseDown={handleResizeMouseDown}
        title="Resize"
      >
        <div className="w-full h-full flex items-center justify-center">
          <div className="w-2 h-2 border-t-2 border-r-2 border-gray-600 transform -translate-y-0.5 translate-x-0.5"></div>
        </div>
      </div>
    );
  };

  if (!isOpen) return null;

  // Main panel content (common for both draggable and non-draggable)
  const panelContent = (
    <div className="flex-1 flex min-h-0">
      {showNotesSidebar && (
        <div className="flex flex-col border-r border-gray-300 w-64 bg-gray-50 notes-sidebar sidebar-slide">
          {/* Sidebar Header */}
          <div className="p-4 border-b border-gray-300">
            <div className="flex items-center justify-between mb-3">
              {/* Left side with close button and title */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowNotesSidebar(false)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-[#FB923C] focus:ring-offset-1 btn-smooth"
                  aria-label="Close sidebar"
                  title="Close sidebar"
                >
                  <X className="w-4 h-4 text-gray-600" />
                </button>
                <span className="text-sm font-semibold text-gray-800">
                  All Notes ({notes.length})
                </span>
              </div>

              {/* Right side with action buttons */}
              <div className="flex gap-1">
                {/* Selection Mode Toggle */}
                {selectedNotes.length > 0 && (
                  <button
                    onClick={clearSelection}
                    className="w-8 h-8 rounded-lg flex items-center justify-center transition-all hover:bg-gray-200 btn-smooth"
                    title="Clear selection"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={createNewNote}
                  disabled={isLoading || !token}
                  className="w-8 h-8 rounded-lg flex items-center justify-center transition-all hover:bg-[#FB923C] disabled:opacity-50 bg-[#FB923C] text-white btn-smooth"
                  title="New note"
                >
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search notes..."
                className="w-full pl-10 pr-3 py-2 rounded-lg text-sm border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#FB923C] focus:border-transparent"
              />
            </div>

            {/* Bulk Actions Bar */}
            {selectedNotes.length > 0 && (
              <div className="flex items-center justify-between mt-3 p-2 bg-orange-50 rounded-lg border border-orange-200">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-orange-800">
                    {selectedNotes.length} selected
                  </span>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={deleteSelectedNotes}
                    className="p-1 rounded hover:bg-red-100 text-red-600 transition-colors btn-smooth"
                    title={`Delete ${selectedNotes.length} note${selectedNotes.length > 1 ? 's' : ''}`}
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded mx-3 mt-2">
              {error}
              <button
                onClick={() => setError(null)}
                className="float-right font-bold ml-2"
              >
                ×
              </button>
            </div>
          )}
          {/* Notes List */}
          <div className="flex-1 overflow-y-auto notes-scrollbar">
            {!token ? (
              <div className="p-4 text-center">
                <FileText className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                <p className="text-xs text-gray-500">Authentication required</p>
              </div>
            ) : isLoadingNotes ? (
              <div className="flex items-center justify-center p-4">
                <Loader2 className="w-4 h-4 animate-spin text-[#FB923C]" />
              </div>
            ) : sortedNotes.length === 0 ? (
              <div className="p-4 text-center">
                <FileText className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                <p className="text-xs text-gray-500">
                  {notes.length === 0 ? "No notes yet" : "No results"}
                </p>
              </div>
            ) : (
              <div className={selectedNotes.length > 0 ? 'selection-mode' : ''}>
                {/* Select All Header */}
                {selectedNotes.length > 0 && (
                  <div className="flex items-center gap-1 px-3 py-2 border-b border-gray-200 bg-gray-50">
                    <button
                      onClick={toggleSelectAll}
                      className="flex items-center gap-1 text-xs text-gray-600 hover:text-gray-800 transition-colors"
                    >
                      {selectedNotes.length === filteredNotes.length ? (
                        <CheckSquare className="w-3 h-3 text-[#FB923C]" />
                      ) : (
                        <Square className="w-3 h-3 text-gray-400" />
                      )}
                      <span className="text-xs">
                        {selectedNotes.length === filteredNotes.length ? 'Deselect all' : 'Select all'}
                      </span>
                    </button>
                  </div>
                )}

                {sortedNotes.map((note) => (
                  <div
                    key={note._id}
                    className={`note-item px-3 py-2 cursor-pointer transition-all group relative ${selectedNotes.includes(note._id)
                      ? 'selected bg-orange-50'
                      : 'hover:bg-gray-50'
                      } ${currentNote?._id === note._id
                        ? '!bg-[#FB923C]'
                        : ''
                      } border-b border-gray-100`}
                    onClick={(e) => {
                      if ((e.target as HTMLElement).closest('.note-checkbox-container') ||
                        (e.target as HTMLElement).closest('.three-dot-menu')) {
                        return;
                      }
                      selectNote(note);
                    }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      {/* Left side: Checkbox + Pin + Title */}
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        {/* Checkbox */}
                        <div className="note-checkbox-container flex-shrink-0">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleNoteSelection(note._id);
                            }}
                            className={`note-checkbox w-3.5 h-3.5 rounded border flex items-center justify-center transition-all flex-shrink-0
                              ${selectedNotes.includes(note._id)
                                ? 'bg-[#FB923C] border-[#FB923C] opacity-100'
                                : 'border-gray-300 bg-white hover:border-[#FB923C] opacity-0 group-hover:opacity-100'
                              }
                              ${currentNote?._id === note._id && selectedNotes.includes(note._id)
                                ? 'bg-white border-white'
                                : ''
                              }
                              ${currentNote?._id === note._id && !selectedNotes.includes(note._id)
                                ? 'border-white bg-white group-hover:border-white'
                                : ''
                              }`}
                          >
                            {selectedNotes.includes(note._id) && (
                              <Check className={`w-2.5 h-2.5 
                                ${currentNote?._id === note._id && selectedNotes.includes(note._id)
                                  ? 'text-[#FB923C]'
                                  : 'text-white'
                                }`} />
                            )}
                          </button>
                        </div>

                        {/* Pin + Title */}
                        <div className="flex items-center gap-1 flex-1 min-w-0">
                          {note.isPinned && (
                            <Pin className={`w-3 h-3 flex-shrink-0
                              ${currentNote?._id === note._id
                                ? 'text-white'
                                : 'text-[#FB923C]'
                              }`} />
                          )}
                          <h4 className={`text-xs font-medium truncate
                            ${currentNote?._id === note._id
                              ? 'text-white'
                              : 'text-gray-800'
                            }`}>
                            {note.title || "Untitled"}
                          </h4>
                        </div>
                      </div>

                      {/* Right side: Date + Time + Three dots */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {/* Date and Time - Compact */}
                        <div className={`flex items-center gap-1 text-xs
                          ${currentNote?._id === note._id
                            ? 'text-orange-100'
                            : 'text-gray-500'
                          }`}>
                          <span className="text-xs">
                            {note.lastEdited ? formatDate(note.lastEdited) : "25/11"}
                          </span>
                          <span className="mx-0.5">•</span>
                          <span className="text-xs">
                            {note.lastEdited ? formatTime(note.lastEdited) : "12:00 pm"}
                          </span>
                        </div>

                        {/* Three-dot Menu */}
                        <div className="three-dot-menu relative">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenDropdownId(openDropdownId === note._id ? null : note._id);
                            }}
                            className={`transition-all p-1 rounded flex items-center justify-center
                              ${currentNote?._id === note._id
                                ? 'text-orange-200 hover:text-white hover:bg-orange-700'
                                : 'text-gray-400 hover:text-gray-600 hover:bg-gray-200'
                              }
                              ${openDropdownId === note._id
                                ? currentNote?._id === note._id
                                  ? 'bg-orange-700 text-white'
                                  : 'bg-gray-300 text-gray-700'
                                : ''
                              }`}
                            title="More actions"
                          >
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M12 10c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0-6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 12c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
                            </svg>
                          </button>

                          {/* Dropdown Menu */}
                          {openDropdownId === note._id && (
                            <div className="absolute right-0 top-6 z-10 w-32 bg-white rounded-md shadow-lg border border-gray-200 py-1">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  togglePinNoteHandler(note._id);
                                  setOpenDropdownId(null);
                                }}
                                className="flex items-center gap-2 w-full px-2 py-1 text-xs text-gray-700 hover:bg-gray-100"
                              >
                                {note.isPinned ? (
                                  <>
                                    <PinOff className="w-3 h-3" />
                                    Unpin
                                  </>
                                ) : (
                                  <>
                                    <Pin className="w-3 h-3" />
                                    Pin
                                  </>
                                )}
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  downloadNoteFromList('txt', note);
                                  setOpenDropdownId(null);
                                }}
                                className="flex items-center gap-2 w-full px-2 py-1 text-xs text-gray-700 hover:bg-gray-100"
                              >
                                <Download className="w-3 h-3" />
                                TXT
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  downloadNoteFromList('md', note);
                                  setOpenDropdownId(null);
                                }}
                                className="flex items-center gap-2 w-full px-2 py-1 text-xs text-gray-700 hover:bg-gray-100"
                              >
                                <Download className="w-3 h-3" />
                                MD
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  copyNoteToClipboard(note);
                                  setOpenDropdownId(null);
                                }}
                                className="flex items-center gap-2 w-full px-2 py-1 text-xs text-gray-700 hover:bg-gray-100"
                              >
                                <Copy className="w-3 h-3" />
                                Copy
                              </button>
                              <hr className="my-1" />
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteNoteHandler(note._id);
                                  setOpenDropdownId(null);
                                }}
                                className="flex items-center gap-2 w-full px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                              >
                                <Trash2 className="w-3 h-3" />
                                Delete
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Single Row Header - All elements in one row with better spacing */}
        <div className="flex items-center justify-between p-3 border-b border-gray-300 bg-white">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {/* Expand Menu Button - Only show when sidebar is closed */}
            {!showNotesSidebar && (
              <button
                onClick={() => setShowNotesSidebar(true)}
                className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-[#FB923C] focus:ring-offset-1 btn-smooth"
                aria-label="Expand menu"
                title="Expand menu"
              >
                <svg
                  className="w-4 h-4 text-gray-700"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            )}

            {/* Title Input */}
            {/* <div className="flex-1 min-w-0">
              <input
                ref={titleInputRef}
                type="text"
                value={editTitle}
                onChange={(e) => {
                  setEditTitle(e.target.value)
                  setHasUnsavedChanges(true)
                }}
                placeholder="Untitled Note"
                className="w-full px-3 py-1.5 text-sm font-medium border border-transparent rounded focus:outline-none focus:border-[#FB923C] focus:ring-1 focus:ring-[#FB923C] bg-transparent"
              />
            </div> */}
            {/* Display File Name */}
            <div className="flex-1 min-w-0">
              <div className="px-3 py-1.5">
                <span className="text-sm font-medium text-gray-800 truncate block">
                  {editTitle}
                </span>
              </div>
            </div>
          </div>

          {/* Action Buttons - All in one row with better spacing */}
          <div className="flex items-center gap-2 ml-3">
            {/* Save Button */}
            <button
              onClick={saveCurrentNote}
              disabled={!isSaveEnabled || isLoading || isEmptyNote()}
              className={`flex items-center gap-2 px-3 py-1.5 rounded text-xs font-medium transition-all min-w-[70px] justify-center btn-smooth ${!isLoading && !isEmptyNote() && isSaveEnabled
                ? 'bg-green-500 text-white hover:bg-green-600'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              title={currentNote ? "Save note" : "Save as..."}
            >
              {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
              {isLoading ? "Saving..." : currentNote ? "Save" : "Save As"}
            </button>

            {/* Paste Button */}
            <button
              onClick={pasteFromClipboard}
              className="flex items-center gap-1 px-3 py-1.5 rounded text-xs font-medium transition-all bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 btn-smooth"
              title="Paste from clipboard"
            >
              <ClipboardPaste className="w-3 h-3" />
            </button>

            {/* Copy Button */}
            <button
              onClick={copyToClipboard}
              className="flex items-center gap-1 px-3 py-1.5 rounded text-xs font-medium transition-all bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 btn-smooth"
              disabled={!editContent.trim()}
              title="Copy text to clipboard"
            >
              {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
            </button>

            {/* Download Button */}
            <button
              onClick={() => downloadNote('txt')}
              className="flex items-center gap-1 px-3 py-1.5 rounded text-xs font-medium transition-all bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 btn-smooth"
              title="Download as text file"
              disabled={!editContent.trim()}
            >
              <Download className="w-3 h-3" />
            </button>

            {/* Delete Button (only show when note exists) */}
            {currentNote && (
              <button
                onClick={() => deleteNoteHandler(currentNote._id)}
                className="flex items-center gap-1 px-3 py-1.5 rounded text-xs font-medium transition-all hover:bg-red-50 bg-white text-red-600 border border-gray-300 btn-smooth"
                title="Delete note"
                disabled={!token}
              >
                <Trash2 className="w-3 h-3" />
              </button>
            )}

            {/* Close Button */}
            {/* <button
              onClick={handleClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-[#FB923C] focus:ring-offset-1 ml-1 btn-smooth"
              aria-label="Close notes"
              title="Close"
            >
              <X className="w-4 h-4 text-gray-600" />
            </button> */}
          </div>
        </div>

        {/* Content Area - Always show editor */}
        <div className="flex-1 overflow-y-auto bg-white">
          <div className="h-full flex flex-col">
            <div className="tiptap-editor-container">
              {renderTiptapToolbar()}
              <div className="tiptap-editor notes-scrollbar">
                {editor ? (
                  <EditorContent editor={editor} />
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <Loader2 className="w-8 h-8 animate-spin text-[#FB923C]" />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer - Compact */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-gray-300 text-xs bg-gray-50 text-gray-600">
          <div className="flex items-center gap-4">
            <span>
              <span className="font-medium">
                {getWordCount(editContent)}
              </span> words
            </span>
            <span>
              <span className="font-medium">
                {editContent.replace(/<[^>]*>/g, '').length}
              </span> chars
            </span>
            {hasUnsavedChanges && (
              <span className="text-amber-600 font-medium">Unsaved</span>
            )}
          </div>
          <span>
            {currentNote ? `Created ${formatDate(currentNote.createdAt)}` : "New note"}
          </span>
        </div>
      </div>
    </div>
  );

  // DRAGGABLE VERSION - for page.tsx
  if (isDraggable) {
    return (
      <div
        ref={panelRef}
        className={`fixed bg-white shadow-lg border border-gray-300 flex flex-col z-50 ${isDragging ? 'cursor-grabbing select-none' : 'cursor-default'
          }`}
        style={{
          left: `${position.x}px`,
          top: `${position.y}px`,
          width: `${size.width}px`,
          height: `${size.height}px`,
        }}
      >
        <div className="flex-1 flex min-h-0">
          {showNotesSidebar && (
            <div className="flex flex-col border-r border-gray-300 w-64 bg-gray-50 notes-sidebar sidebar-slide">
              <div
                className="p-4 border-b border-gray-300 cursor-move"
                onMouseDown={handleMouseDown}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowNotesSidebar(false)}
                      className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-[#FB923C] focus:ring-offset-1 btn-smooth no-drag"
                    >
                      <X className="w-4 h-4 text-gray-600" />
                    </button>
                    <span className="text-sm font-semibold text-gray-800">
                      All Notes ({notes.length})
                    </span>
                  </div>
                  <div className="flex gap-1">
                    {selectedNotes.length > 0 && (
                      <button
                        onClick={clearSelection}
                        className="w-8 h-8 rounded-lg flex items-center justify-center transition-all hover:bg-gray-200 btn-smooth no-drag"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={createNewNote}
                      disabled={isLoading || !token}
                      className="w-8 h-8 rounded-lg flex items-center justify-center transition-all hover:bg-[#FB923C] disabled:opacity-50 bg-[#FB923C] text-white btn-smooth no-drag"
                    >
                      {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search notes..."
                    className="w-full pl-10 pr-3 py-2 rounded-lg text-sm border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#FB923C] focus:border-transparent no-drag"
                  />
                </div>
                {resourceContext && (
                  <div className="flex items-center gap-1 mt-3 p-1 bg-gray-100 rounded-lg no-drag">
                    <button
                      onClick={() => setActiveTab('resource')}
                      className={`flex-1 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${activeTab === 'resource' ? 'bg-white text-[#F97316] shadow-sm' : 'text-gray-600 hover:text-gray-800'}`}
                    >
                      This {resourceContext.resourceType === 'video' ? 'video' : resourceContext.resourceType === 'ppt' ? 'presentation' : 'document'}
                    </button>
                    <button
                      onClick={() => setActiveTab('all')}
                      className={`flex-1 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${activeTab === 'all' ? 'bg-white text-[#F97316] shadow-sm' : 'text-gray-600 hover:text-gray-800'}`}
                    >
                      All notes
                    </button>
                  </div>
                )}
                {selectedNotes.length > 0 && (
                  <div className="flex items-center justify-between mt-3 p-2 bg-orange-50 rounded-lg border border-orange-200">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-orange-800">
                        {selectedNotes.length} selected
                      </span>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={deleteSelectedNotes}
                        className="p-1 rounded hover:bg-red-100 text-red-600 transition-colors btn-smooth no-drag"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex-1 overflow-y-auto notes-scrollbar">
                {!token ? (
                  <div className="p-4 text-center">
                    <FileText className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                    <p className="text-xs text-gray-500">Authentication required</p>
                  </div>
                ) : isLoadingNotes ? (
                  <div className="flex items-center justify-center p-4">
                    <Loader2 className="w-4 h-4 animate-spin text-[#FB923C]" />
                  </div>
                ) : sortedNotes.length === 0 ? (
                  <div className="p-4 text-center">
                    <FileText className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                    <p className="text-xs text-gray-500">
                      {notes.length === 0 ? "No notes yet" : "No results"}
                    </p>
                  </div>
                ) : (
                  <div className={selectedNotes.length > 0 ? 'selection-mode' : ''}>
                    {selectedNotes.length > 0 && (
                      <div className="flex items-center gap-1 px-3 py-2 border-b border-gray-200 bg-gray-50">
                        <button
                          onClick={toggleSelectAll}
                          className="flex items-center gap-1 text-xs text-gray-600 hover:text-gray-800 transition-colors no-drag"
                        >
                          {selectedNotes.length === filteredNotes.length ? (
                            <CheckSquare className="w-3 h-3 text-[#FB923C]" />
                          ) : (
                            <Square className="w-3 h-3 text-gray-400" />
                          )}
                          <span className="text-xs">
                            {selectedNotes.length === filteredNotes.length ? 'Deselect all' : 'Select all'}
                          </span>
                        </button>
                      </div>
                    )}
                    {sortedNotes.map((note) => (
                      <div
                        key={note._id}
                        className={`note-item px-3 py-2 cursor-pointer transition-all group relative ${selectedNotes.includes(note._id)
                          ? 'selected bg-orange-50'
                          : 'hover:bg-gray-50'
                          } ${currentNote?._id === note._id
                            ? '!bg-[#FB923C]'
                            : ''
                          } border-b border-gray-100`}
                        onClick={(e) => {
                          if ((e.target as HTMLElement).closest('.note-checkbox-container') ||
                            (e.target as HTMLElement).closest('.three-dot-menu')) {
                            return;
                          }
                          selectNote(note);
                        }}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <div className="note-checkbox-container flex-shrink-0">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleNoteSelection(note._id);
                                }}
                                className={`note-checkbox w-3.5 h-3.5 rounded border flex items-center justify-center transition-all flex-shrink-0 no-drag
                                ${selectedNotes.includes(note._id)
                                    ? 'bg-[#FB923C] border-[#FB923C] opacity-100'
                                    : 'border-gray-300 bg-white hover:border-[#FB923C] opacity-0 group-hover:opacity-100'
                                  }
                                ${currentNote?._id === note._id && selectedNotes.includes(note._id)
                                    ? 'bg-white border-white'
                                    : ''
                                  }
                                ${currentNote?._id === note._id && !selectedNotes.includes(note._id)
                                    ? 'border-white bg-white group-hover:border-white'
                                    : ''
                                  }`}
                              >
                                {selectedNotes.includes(note._id) && (
                                  <Check className={`w-2.5 h-2.5 
                                  ${currentNote?._id === note._id && selectedNotes.includes(note._id)
                                      ? 'text-[#FB923C]'
                                      : 'text-white'
                                    }`} />
                                )}
                              </button>
                            </div>
                            <div className="flex items-center gap-1 flex-1 min-w-0">
                              {note.isPinned && (
                                <Pin className={`w-3 h-3 flex-shrink-0
                                ${currentNote?._id === note._id
                                    ? 'text-white'
                                    : 'text-[#FB923C]'
                                  }`} />
                              )}
                              <h4 className={`text-xs font-medium truncate
                              ${currentNote?._id === note._id
                                  ? 'text-white'
                                  : 'text-gray-800'
                                }`}>
                                {note.title || "Untitled"}
                              </h4>
                              {note.anchor && (note.anchor.page != null || note.anchor.timestamp != null) && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    if (resourceContext?.onJumpTo && note.resourceId === resourceContext.resourceId) {
                                      resourceContext.onJumpTo({ page: note.anchor?.page, timestamp: note.anchor?.timestamp })
                                    }
                                  }}
                                  title={resourceContext?.onJumpTo ? 'Jump to this location' : 'Anchor'}
                                  className={`flex-shrink-0 no-drag px-1.5 py-0.5 rounded text-[10px] font-semibold border transition-colors ${currentNote?._id === note._id ? 'bg-white/20 text-white border-white/40 hover:bg-white/30' : 'bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100'}`}
                                >
                                  {note.anchor.page != null
                                    ? `p.${note.anchor.page}`
                                    : _fmtTs(note.anchor.timestamp || 0)}
                                </button>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <div className={`flex items-center gap-1 text-xs
                            ${currentNote?._id === note._id
                                ? 'text-orange-100'
                                : 'text-gray-500'
                              }`}>
                              <span className="text-xs">
                                {note.lastEdited ? formatDate(note.lastEdited) : "25/11"}
                              </span>
                              <span className="mx-0.5">•</span>
                              <span className="text-xs">
                                {note.lastEdited ? formatTime(note.lastEdited) : "12:00 pm"}
                              </span>
                            </div>
                            <div className="three-dot-menu relative">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setOpenDropdownId(openDropdownId === note._id ? null : note._id);
                                }}
                                className={`transition-all p-1 rounded flex items-center justify-center no-drag
                                ${currentNote?._id === note._id
                                    ? 'text-orange-200 hover:text-white hover:bg-orange-700'
                                    : 'text-gray-400 hover:text-gray-600 hover:bg-gray-200'
                                  }
                                ${openDropdownId === note._id
                                    ? currentNote?._id === note._id
                                      ? 'bg-orange-700 text-white'
                                      : 'bg-gray-300 text-gray-700'
                                    : ''
                                  }`}
                              >
                                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M12 10c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0-6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 12c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
                                </svg>
                              </button>
                              {openDropdownId === note._id && (
                                <div className="absolute right-0 top-6 z-10 w-32 bg-white rounded-md shadow-lg border border-gray-200 py-1">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      togglePinNoteHandler(note._id);
                                      setOpenDropdownId(null);
                                    }}
                                    className="flex items-center gap-2 w-full px-2 py-1 text-xs text-gray-700 hover:bg-gray-100 no-drag"
                                  >
                                    {note.isPinned ? (
                                      <>
                                        <PinOff className="w-3 h-3" />
                                        Unpin
                                      </>
                                    ) : (
                                      <>
                                        <Pin className="w-3 h-3" />
                                        Pin
                                      </>
                                    )}
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      downloadNoteFromList('txt', note);
                                      setOpenDropdownId(null);
                                    }}
                                    className="flex items-center gap-2 w-full px-2 py-1 text-xs text-gray-700 hover:bg-gray-100 no-drag"
                                  >
                                    <Download className="w-3 h-3" />
                                    TXT
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      downloadNoteFromList('md', note);
                                      setOpenDropdownId(null);
                                    }}
                                    className="flex items-center gap-2 w-full px-2 py-1 text-xs text-gray-700 hover:bg-gray-100 no-drag"
                                  >
                                    <Download className="w-3 h-3" />
                                    MD
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      copyNoteToClipboard(note);
                                      setOpenDropdownId(null);
                                    }}
                                    className="flex items-center gap-2 w-full px-2 py-1 text-xs text-gray-700 hover:bg-gray-100 no-drag"
                                  >
                                    <Copy className="w-3 h-3" />
                                    Copy
                                  </button>
                                  <hr className="my-1" />
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      deleteNoteHandler(note._id);
                                      setOpenDropdownId(null);
                                    }}
                                    className="flex items-center gap-2 w-full px-2 py-1 text-xs text-red-600 hover:bg-red-50 no-drag"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                    Delete
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="flex-1 flex flex-col min-w-0">
            <div
              className="flex items-center justify-between p-3 border-b border-gray-300 bg-white cursor-move"
              onMouseDown={handleMouseDown}
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                {!showNotesSidebar && (
                  <button
                    onClick={() => setShowNotesSidebar(true)}
                    className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-[#FB923C] focus:ring-offset-1 btn-smooth no-drag"
                  >
                    <svg
                      className="w-4 h-4 text-gray-700"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                  </button>
                )}
                <div className="mb-4">
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Note Title
                  </label>
                  <input
                    ref={saveTitleInputRef}
                    type="text"
                    value={saveNoteTitle}
                    onChange={(e) => setSaveNoteTitle(e.target.value)}
                    placeholder={currentNote ? currentNote.title : "Enter note title"}
                    className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FB923C] focus:border-transparent"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && saveNoteTitle.trim()) {
                        saveWithTitle();
                      }
                    }}
                  />
                </div>
              </div>
              <div className="flex items-center gap-2 ml-3">
                <button
                  onClick={saveCurrentNote}
                  disabled={!isSaveEnabled || isLoading || isEmptyNote()}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded text-xs font-medium transition-all min-w-[70px] justify-center btn-smooth no-drag ${!isLoading && !isEmptyNote() && isSaveEnabled
                    ? 'bg-green-500 text-white hover:bg-green-600'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    }`}
                >
                  {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                  {isLoading ? "Saving..." : "Save"}
                </button>
                <button
                  onClick={pasteFromClipboard}
                  className="flex items-center gap-1 px-3 py-1.5 rounded text-xs font-medium transition-all bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 btn-smooth no-drag"
                >
                  <ClipboardPaste className="w-3 h-3" />
                </button>
                <button
                  onClick={copyToClipboard}
                  className="flex items-center gap-1 px-3 py-1.5 rounded text-xs font-medium transition-all bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 btn-smooth no-drag"
                  disabled={!editContent.trim()}
                >
                  {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                </button>
                <button
                  onClick={() => downloadNote('txt')}
                  className="flex items-center gap-1 px-3 py-1.5 rounded text-xs font-medium transition-all bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 btn-smooth no-drag"
                  disabled={!editContent.trim()}
                >
                  <Download className="w-3 h-3" />
                </button>
                {currentNote && (
                  <button
                    onClick={() => deleteNoteHandler(currentNote._id)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded text-xs font-medium transition-all hover:bg-red-50 bg-white text-red-600 border border-gray-300 btn-smooth no-drag"
                    disabled={!token}
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
                <button
                  onClick={handleClose}
                  className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-[#FB923C] focus:ring-offset-1 ml-1 btn-smooth no-drag"
                >
                  <X className="w-4 h-4 text-gray-600" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto bg-white">
              <div className="h-full flex flex-col">
                <div className="tiptap-editor-container">
                  {renderTiptapToolbar()}
                  <div className="tiptap-editor notes-scrollbar">
                    {editor  ? (
                      <EditorContent editor={editor} />
                    ) : (
                      <div className="flex items-center justify-center h-full">
                        <Loader2 className="w-8 h-8 animate-spin text-[#FB923C]" />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between px-4 py-2 border-t border-gray-300 text-xs bg-gray-50 text-gray-600">
              <div className="flex items-center gap-4">
                <span>
                  <span className="font-medium">
                    {getWordCount(editContent)}
                  </span> words
                </span>
                <span>
                  <span className="font-medium">
                    {editContent.replace(/<[^>]*>/g, '').length}
                  </span> chars
                </span>
                {hasUnsavedChanges && (
                  <span className="text-amber-600 font-medium">Unsaved</span>
                )}
              </div>
              <span>
                {currentNote ? `Created ${formatDate(currentNote.createdAt)}` : "New note"}
              </span>
            </div>
          </div>
        </div>
        {renderResizeHandle()}

        <style>{`
        .notes-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        
        .notes-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        
        .notes-scrollbar::-webkit-scrollbar-thumb {
          background: #d1d5db;
          border-radius: 3px;
        }
        
        .notes-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #9ca3af;
        }

        .tiptap-editor-container {
          height: 100%;
          display: flex;
          flex-direction: column;
          background: white;
        }

        .tiptap-toolbar {
          background: #f9fafb;
          border-bottom: 1px solid #e5e7eb;
          padding: 0.5rem;
          display: flex;
          flex-wrap: wrap;
          gap: 0.25rem;
          align-items: center;
        }

        .tiptap-toolbar-group {
          display: flex;
          gap: 0.25rem;
          align-items: center;
          padding: 0 0.5rem;
          border-right: 1px solid #e5e7eb;
        }

        .tiptap-toolbar-group:last-child {
          border-right: none;
        }

        .tiptap-toolbar-button {
          padding: 0.375rem 0.5rem;
          border: 1px solid transparent;
          background: transparent;
          border-radius: 4px;
          cursor: pointer;
          font-size: 0.75rem;
          color: #374151;
          display: flex;
          align-items: center;
          justify-content: center;
          min-width: 2rem;
          height: 2rem;
          transition: all 0.2s ease;
        }

        .tiptap-toolbar-button:hover {
          background: #f3f4f6;
        }

        .tiptap-toolbar-button.is-active {
          background: #FB923C !important;
          color: white !important;
          border-color: #FB923C !important;
        }

        .tiptap-toolbar-button:active {
          transform: scale(0.95);
        }

        .tiptap-toolbar-button:focus {
          outline: 2px solid #FB923C;
          outline-offset: 1px;
        }

        .tiptap-toolbar-select {
          padding: 0.25rem 0.5rem;
          border: 1px solid #e5e7eb;
          border-radius: 4px;
          background: white;
          color: #374151;
          font-size: 0.75rem;
          cursor: pointer;
          min-width: 120px;
        }

        .tiptap-editor {
          flex: 1;
          overflow-y: auto;
          padding: 1rem;
          background: white;
          color: #374151;
        }

        .tiptap-editor .ProseMirror {
          outline: none;
          min-height: 100%;
          cursor: text;
        }

        .tiptap-editor .ProseMirror h1,
        .tiptap-editor .ProseMirror h2,
        .tiptap-editor .ProseMirror h3 {
          margin-top: 1em;
          margin-bottom: 0.5em;
          font-weight: 600;
        }

        .tiptap-editor .ProseMirror h1 { font-size: 1.5rem; }
        .tiptap-editor .ProseMirror h2 { font-size: 1.25rem; }
        .tiptap-editor .ProseMirror h3 { font-size: 1.125rem; }

        .tiptap-editor .ProseMirror p {
          margin-bottom: 0.75em;
        }

        .tiptap-editor .ProseMirror ul,
        .tiptap-editor .ProseMirror ol {
          padding-left: 1.5em;
          margin-bottom: 0.75em;
        }

        .tiptap-editor .ProseMirror ul {
          list-style-type: disc;
        }

        .tiptap-editor .ProseMirror ol {
          list-style-type: decimal;
        }

        .tiptap-editor .ProseMirror li {
          margin-bottom: 0.25em;
          display: list-item;
        }

        .tiptap-editor .ProseMirror ul ul,
        .tiptap-editor .ProseMirror ol ul {
          list-style-type: circle;
        }

        .tiptap-editor .ProseMirror ol ol,
        .tiptap-editor .ProseMirror ul ol {
          list-style-type: lower-roman;
        }

        .tiptap-editor .ProseMirror blockquote {
          border-left: 4px solid #e5e7eb;
          padding-left: 1em;
          margin: 1em 0;
          color: #6b7280;
          font-style: italic;
        }

        .tiptap-editor .ProseMirror code {
          background-color: #f3f4f6;
          padding: 0.2em 0.4em;
          border-radius: 3px;
          font-size: 0.85em;
          font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
        }

        .tiptap-editor .ProseMirror pre {
          background-color: #f3f4f6;
          padding: 1em;
          border-radius: 6px;
          overflow-x: auto;
          margin: 1em 0;
          border: 1px solid #e5e7eb;
        }

        .tiptap-editor .ProseMirror pre code {
          background: none;
          padding: 0;
        }

        .tiptap-editor .ProseMirror a {
          color: #FB923C;
          text-decoration: underline;
        }

        .tiptap-editor .ProseMirror strong {
          font-weight: 600;
        }

        .tiptap-editor .ProseMirror em {
          font-style: italic;
        }

        .tiptap-editor .ProseMirror u {
          text-decoration: underline;
        }

        .tiptap-editor .ProseMirror s {
          text-decoration: line-through;
        }

        .tiptap-editor .ProseMirror * {
          font-family: inherit;
        }

        .rich-text-image {
          max-width: 100%;
          height: auto;
          border-radius: 8px;
          margin: 1rem 0;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }

        .tiptap-editor .ProseMirror img {
          max-width: 100%;
          height: auto;
          border-radius: 8px;
          margin: 1rem 0;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }

        .tiptap-editor .ProseMirror img.ProseMirror-selectednode {
          outline: 2px solid #FB923C;
        }

        .save-confirm-overlay,
        .delete-confirm-overlay {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          backdrop-filter: blur(4px);
        }

        .save-confirm-modal,
        .delete-confirm-modal {
          background: white;
          border-radius: 12px;
          padding: 1.5rem;
          max-width: 400px;
          width: 90%;
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
          animation: modalSlideIn 0.2s ease-out;
        }

        @keyframes modalSlideIn {
          from {
            opacity: 0;
            transform: scale(0.95) translateY(-10px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }

        .copy-toast {
          position: absolute;
          top: 80px;
          right: 20px;
          background: #FB923C;
          color: white;
          padding: 8px 16px;
          border-radius: 6px;
          font-size: 0.875rem;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          z-index: 1000;
          animation: slideIn 0.3s ease-out;
        }

        .paste-toast {
          position: absolute;
          top: 80px;
          right: 20px;
          background: #10b981;
          color: white;
          padding: 8px 16px;
          border-radius: 6px;
          font-size: 0.875rem;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          z-index: 1000;
          animation: slideIn 0.3s ease-out;
        }

        .delete-toast {
          position: absolute;
          top: 80px;
          right: 20px;
          background: #ef4444;
          color: white;
          padding: 8px 16px;
          border-radius: 6px;
          font-size: 0.875rem;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          z-index: 1000;
          animation: slideIn 0.3s ease-out;
        }

        .save-toast {
          position: absolute;
          top: 80px;
          right: 20px;
          background: #10b981;
          color: white;
          padding: 8px 16px;
          border-radius: 6px;
          font-size: 0.875rem;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          z-index: 1000;
          animation: slideIn 0.3s ease-out;
        }

        @keyframes slideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }

        .note-checkbox {
          opacity: 0;
          transition: opacity 0.2s ease;
        }

        .note-item:hover .note-checkbox {
          opacity: 1;
        }

        .note-item.selected .note-checkbox {
          opacity: 1;
        }

        .selection-mode .note-checkbox {
          opacity: 1;
        }

        .btn-smooth {
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .btn-smooth:hover {
          transform: translateY(-1px);
        }

        .btn-smooth:active {
          transform: translateY(0);
        }

        .sidebar-slide {
          transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .loading-pulse {
          animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }

        .no-drag {
          cursor: default;
        }
        .no-drag * {
          cursor: default !important;
        }
        .cursor-move {
          cursor: move;
        }
        .cursor-move:hover {
          cursor: move;
        }
      `}</style>

        {renderHiddenFileInput()}
        {renderDeleteConfirmation()}

        {copied && (
          <div className="copy-toast">
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4" />
              <span>Text copied to clipboard!</span>
            </div>
          </div>
        )}

        {pasted && (
          <div className="paste-toast">
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4" />
              <span>Text pasted from clipboard!</span>
            </div>
          </div>
        )}

        {showDeleteToast && (
          <div className="delete-toast">
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4" />
              <span>"{deletedNoteTitle}" deleted successfully!</span>
            </div>
          </div>
        )}

        {showSaveToast && (
          <div className="save-toast">
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4" />
              <span>Note saved successfully!</span>
            </div>
          </div>
        )}

        {showSaveConfirm && (
          <div className="save-confirm-overlay">
            <div className="save-confirm-modal">
              <h3 className="text-base font-semibold mb-2 text-gray-800">
                {currentNote ? "Save Changes" : "Save Note As"}
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                {currentNote
                  ? "Do you want to save your changes?"
                  : "Please enter a title for your new note:"}
              </p><div className="mb-4">
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Note Title
                </label>
                <input
                  ref={saveTitleInputRef}
                  type="text"
                  value={saveNoteTitle}
                  onChange={(e) => setSaveNoteTitle(e.target.value)}
                  placeholder={currentNote ? currentNote.title : "Enter note title"}
                  className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FB923C] focus:border-transparent"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && saveNoteTitle.trim()) {
                      saveWithTitle();
                    }
                  }}
                />
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={closeWithoutSaving}
                  className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded transition-colors border border-gray-300 btn-smooth"
                >
                  {currentNote ? "Don't Save" : "Cancel"}
                </button>
                {currentNote && (
                  <button
                    onClick={cancelClose}
                    className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded transition-colors border border-gray-300 btn-smooth"
                  >
                    Cancel
                  </button>
                )}
                <button
                  onClick={saveWithTitle}
                  disabled={!currentNote && !saveNoteTitle.trim()}
                  className="px-3 py-1.5 text-xs bg-[#FB923C] text-white hover:bg-[#F97316] rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed btn-smooth"
                >
                  {currentNote ? "Save" : "Save Note"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // NON-DRAGGABLE VERSION - for PDF/PPT viewers (existing behavior)
  return (
    <div
      ref={panelRef}
      className="h-full flex flex-col bg-white shadow-lg border border-gray-300"
    >
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }

        .notes-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        
        .notes-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        
        .notes-scrollbar::-webkit-scrollbar-thumb {
          background: #d1d5db;
          border-radius: 3px;
        }
        
        .notes-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #9ca3af;
        }

        /* Tiptap Editor Styles */
        .tiptap-editor-container {
          height: 100%;
          display: flex;
          flex-direction: column;
          background: white;
        }

        .tiptap-toolbar {
          background: #f9fafb;
          border-bottom: 1px solid #e5e7eb;
          padding: 0.5rem;
          display: flex;
          flex-wrap: wrap;
          gap: 0.25rem;
          align-items: center;
        }

        .tiptap-toolbar-group {
          display: flex;
          gap: 0.25rem;
          align-items: center;
          padding: 0 0.5rem;
          border-right: 1px solid #e5e7eb;
        }

        .tiptap-toolbar-group:last-child {
          border-right: none;
        }

        .tiptap-toolbar-button {
          padding: 0.375rem 0.5rem;
          border: 1px solid transparent;
          background: transparent;
          border-radius: 4px;
          cursor: pointer;
          font-size: 0.75rem;
          color: #374151;
          display: flex;
          align-items: center;
          justify-content: center;
          min-width: 2rem;
          height: 2rem;
          transition: all 0.2s ease;
        }

        .tiptap-toolbar-button:hover {
          background: #f3f4f6;
        }

        .tiptap-toolbar-button.is-active {
          background: #FB923C !important;
          color: white !important;
          border-color: #FB923C !important;
        }

        .tiptap-toolbar-button:active {
          transform: scale(0.95);
        }

        .tiptap-toolbar-button:focus {
          outline: 2px solid #FB923C;
          outline-offset: 1px;
        }

        .tiptap-toolbar-select {
          padding: 0.25rem 0.5rem;
          border: 1px solid #e5e7eb;
          border-radius: 4px;
          background: white;
          color: #374151;
          font-size: 0.75rem;
          cursor: pointer;
          min-width: 120px;
        }

        .tiptap-editor {
          flex: 1;
          overflow-y: auto;
          padding: 1rem;
          background: white;
          color: #374151;
        }

        .tiptap-editor .ProseMirror {
          outline: none;
          min-height: 100%;
        }

        .tiptap-editor .ProseMirror h1,
        .tiptap-editor .ProseMirror h2,
        .tiptap-editor .ProseMirror h3 {
          margin-top: 1em;
          margin-bottom: 0.5em;
          font-weight: 600;
        }

        .tiptap-editor .ProseMirror h1 { font-size: 1.5rem; }
        .tiptap-editor .ProseMirror h2 { font-size: 1.25rem; }
        .tiptap-editor .ProseMirror h3 { font-size: 1.125rem; }

        .tiptap-editor .ProseMirror p {
          margin-bottom: 0.75em;
        }

        /* Enhanced List Styles for Tiptap */
        .tiptap-editor .ProseMirror ul,
        .tiptap-editor .ProseMirror ol {
          padding-left: 1.5em;
          margin-bottom: 0.75em;
        }

        .tiptap-editor .ProseMirror ul {
          list-style-type: disc;
        }

        .tiptap-editor .ProseMirror ol {
          list-style-type: decimal;
        }

        .tiptap-editor .ProseMirror li {
          margin-bottom: 0.25em;
          display: list-item;
        }

        .tiptap-editor .ProseMirror ul ul,
        .tiptap-editor .ProseMirror ol ul {
          list-style-type: circle;
        }

        .tiptap-editor .ProseMirror ol ol,
        .tiptap-editor .ProseMirror ul ol {
          list-style-type: lower-roman;
        }

        .tiptap-editor .ProseMirror blockquote {
          border-left: 4px solid #e5e7eb;
          padding-left: 1em;
          margin: 1em 0;
          color: #6b7280;
          font-style: italic;
        }

        .tiptap-editor .ProseMirror code {
          background-color: #f3f4f6;
          padding: 0.2em 0.4em;
          border-radius: 3px;
          font-size: 0.85em;
          font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
        }

        .tiptap-editor .ProseMirror pre {
          background-color: #f3f4f6;
          padding: 1em;
          border-radius: 6px;
          overflow-x: auto;
          margin: 1em 0;
          border: 1px solid #e5e7eb;
        }

        .tiptap-editor .ProseMirror pre code {
          background: none;
          padding: 0;
        }

        .tiptap-editor .ProseMirror a {
          color: #FB923C;
          text-decoration: underline;
        }

        .tiptap-editor .ProseMirror strong {
          font-weight: 600;
        }

        .tiptap-editor .ProseMirror em {
          font-style: italic;
        }

        .tiptap-editor .ProseMirror u {
          text-decoration: underline;
        }

        .tiptap-editor .ProseMirror s {
          text-decoration: line-through;
        }

        /* Font Family Styles */
        .tiptap-editor .ProseMirror * {
          font-family: inherit;
        }

        /* Image Styles */
        .rich-text-image {
          max-width: 100%;
          height: auto;
          border-radius: 8px;
          margin: 1rem 0;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }

        .tiptap-editor .ProseMirror img {
          max-width: 100%;
          height: auto;
          border-radius: 8px;
          margin: 1rem 0;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }

        .tiptap-editor .ProseMirror img.ProseMirror-selectednode {
          outline: 2px solid #FB923C;
        }

        /* Save Confirmation Modal */
        .save-confirm-overlay,
        .delete-confirm-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          backdrop-filter: blur(4px);
        }

        .save-confirm-modal,
        .delete-confirm-modal {
          background: white;
          border-radius: 12px;
          padding: 1.5rem;
          max-width: 400px;
          width: 90%;
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
          animation: modalSlideIn 0.2s ease-out;
        }

        @keyframes modalSlideIn {
          from {
            opacity: 0;
            transform: scale(0.95) translateY(-10px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }

        /* Sidebar transition */
        .notes-sidebar {
          transition: all 0.3s ease-in-out;
        }

        /* Toast notification */
        .copy-toast {
          position: fixed;
          top: 80px;
          right: 20px;
          background: #FB923C;
          color: white;
          padding: 8px 16px;
          border-radius: 6px;
          font-size: 0.875rem;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          z-index: 1000;
          animation: slideIn 0.3s ease-out;
        }

        .paste-toast {
          position: fixed;
          top: 80px;
          right: 20px;
          background: #10b981;
          color: white;
          padding: 8px 16px;
          border-radius: 6px;
          font-size: 0.875rem;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          z-index: 1000;
          animation: slideIn 0.3s ease-out;
        }

        .delete-toast {
          position: fixed;
          top: 80px;
          right: 20px;
          background: #ef4444;
          color: white;
          padding: 8px 16px;
          border-radius: 6px;
          font-size: 0.875rem;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          z-index: 1000;
          animation: slideIn 0.3s ease-out;
        }

        .save-toast {
          position: fixed;
          top: 80px;
          right: 20px;
          background: #10b981;
          color: white;
          padding: 8px 16px;
          border-radius: 6px;
          font-size: 0.875rem;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          z-index: 1000;
          animation: slideIn 0.3s ease-out;
        }

        @keyframes slideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }

        /* Selection checkbox styles */
        .note-checkbox {
          opacity: 0;
          transition: opacity 0.2s ease;
        }

        .note-item:hover .note-checkbox {
          opacity: 1;
        }

        .note-item.selected .note-checkbox {
          opacity: 1;
        }

        .selection-mode .note-checkbox {
          opacity: 1;
        }

        /* Enhanced button animations */
        .btn-smooth {
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .btn-smooth:hover {
          transform: translateY(-1px);
        }

        .btn-smooth:active {
          transform: translateY(0);
        }

        /* Enhanced sidebar animations */
        .sidebar-slide {
          transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        /* Loading states */
        .loading-pulse {
          animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
      `}</style>

      {panelContent}
      {renderHiddenFileInput()}
      {renderDeleteConfirmation()}

      {/* Toast notifications and save confirm modal (same as above) */}
      {copied && (
        <div className="copy-toast">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4" />
            <span>Text copied to clipboard!</span>
          </div>
        </div>
      )}

      {pasted && (
        <div className="paste-toast">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4" />
            <span>Text pasted from clipboard!</span>
          </div>
        </div>
      )}

      {showDeleteToast && (
        <div className="delete-toast">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4" />
            <span>"{deletedNoteTitle}" deleted successfully!</span>
          </div>
        </div>
      )}

      {showSaveToast && (
        <div className="save-toast">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4" />
            <span>Note saved successfully!</span>
          </div>
        </div>
      )}

      {showSaveConfirm && (
        <div className="save-confirm-overlay">
          <div className="save-confirm-modal">
            <h3 className="text-base font-semibold mb-2 text-gray-800">
              {currentNote ? "Save Changes" : "Save Note As"}
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              {currentNote
                ? "Do you want to save your changes?"
                : "Please enter a title for your new note:"}
            </p>

            {!currentNote && (
              <div className="mb-4">
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Note Title
                </label>
                <input
                  ref={saveTitleInputRef}
                  type="text"
                  value={saveNoteTitle}
                  onChange={(e) => setSaveNoteTitle(e.target.value)}
                  placeholder="Enter note title"
                  className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FB923C] focus:border-transparent"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && saveNoteTitle.trim()) {
                      saveWithTitle();
                    }
                  }}
                />
              </div>
            )}

            <div className="flex gap-2 justify-end">
              <button
                onClick={closeWithoutSaving}
                className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded transition-colors border border-gray-300 btn-smooth"
              >
                {currentNote ? "Don't Save" : "Cancel"}
              </button>
              {currentNote && (
                <button
                  onClick={cancelClose}
                  className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded transition-colors border border-gray-300 btn-smooth"
                >
                  Cancel
                </button>
              )}
              <button
                onClick={saveWithTitle}
                disabled={!currentNote && !saveNoteTitle.trim()}
                className="px-3 py-1.5 text-xs bg-[#FB923C] text-white hover:bg-[#F97316] rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed btn-smooth"
              >
                {currentNote ? "Save" : "Save Note"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}