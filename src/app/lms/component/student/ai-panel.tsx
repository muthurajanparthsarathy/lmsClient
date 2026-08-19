"use client"

import { useState, useRef, useEffect } from "react"
import { Sparkles, X, Send, Bot, User, Loader2, FileText, AlertCircle, BookOpen, Clock, Hash, Video, PlayCircle, Mic } from "lucide-react"
import ReactMarkdown from 'react-markdown'

interface Message {
  role: "user" | "assistant"
  content: string
  timestamp: Date
}

interface AIPanelProps {
  isOpen: boolean
  onClose: () => void
  fileUrl: string
  title: string
  fileType: 'pdf' | 'ppt' | 'video'
}
// alert("Note: This AI panel is a prototype demonstrating integration with the Gemini API and Deepgram for video transcription. It may not work perfectly with all files and is intended for testing and demonstration purposes only.")
// Gemini API configuration
const GEMINI_API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY ?? ""
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent?key=${GEMINI_API_KEY}`;

// Backend API URL - adjust based on your environment
const BACKEND_API_URL = "https://lmsserver-yeve.onrender.com"

export default function AIPanel({ isOpen, onClose, fileUrl, title, fileType }: AIPanelProps) {
  const [prompt, setPrompt] = useState("")
  const [messages, setMessages] = useState<Message[]>([])
  const [isTyping, setIsTyping] = useState(false)
  const [fileContent, setFileContent] = useState<string | null>(null)
  const [fileMetadata, setFileMetadata] = useState<{ 
    pages?: number, 
    textLength?: number, 
    duration?: number,
    segments?: number,
    wordCount?: number,
    audioExtracted?: boolean,
    confidence?: number,
    language?: string
  }>({})
  const [extractionStatus, setExtractionStatus] = useState<'idle' | 'extracting' | 'success' | 'error'>('idle')
  const [extractionError, setExtractionError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'chat' | 'summary'>('summary')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const summaryContentRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isOpen])

  // Extract content based on file type
  const extractFileContent = async (): Promise<string> => {
    setExtractionStatus('extracting')
    setExtractionError(null)

    try {
      console.log("Extracting content from:", fileUrl)

      if (fileType === 'video') {
        // Use video transcription endpoint with Deepgram
        console.log("Processing video content for transcription...");
        let response = await fetch(`${BACKEND_API_URL}/api/video/extract-audio`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            videoUrl: fileUrl,
            title: title
          })
        })

        let data = await response.json()

        if (!response.ok || !data.success) {
          throw new Error(data.error || `Video processing failed`)
        }

        console.log(`Video transcribed successfully. Word count: ${data.transcription.wordCount}, Confidence: ${data.transcription.confidence}`)

        setExtractionStatus('success')
        setFileContent(data.transcription.transcript)
        setFileMetadata({
          duration: data.metadata.duration,
          audioExtracted: data.metadata.audioExtracted,
          wordCount: data.transcription.wordCount,
          confidence: data.transcription.confidence,
          language: data.metadata.language,
          segments: data.transcription.totalSegments
        })
        return data.transcription.transcript
      } else {
        // Existing PDF/PPT extraction logic
        const isPPT = fileType === 'ppt' || fileUrl.toLowerCase().includes('.ppt') || fileUrl.toLowerCase().includes('.pptx');
        const currentFileType = isPPT ? 'ppt' : 'pdf';

        if (isPPT) {
          // Use the universal file extraction endpoint for PPT files
          let response = await fetch(`${BACKEND_API_URL}/api/pdf/extract-file-text`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              fileUrl: fileUrl,
              fileType: 'ppt'
            })
          })

          let data = await response.json()

          if (!response.ok || !data.success) {
            throw new Error(data.error || `PPT extraction failed`)
          }

          console.log(`PPT text extracted successfully. Text length: ${data.textLength}`)

          setExtractionStatus('success')
          setFileContent(data.text)
          setFileMetadata({
            pages: data.pages || 0,
            textLength: data.textLength
          })
          return data.text
        } else {
          // Original PDF extraction logic
          let response = await fetch(`${BACKEND_API_URL}/api/pdf/extract-pdf-text`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ pdfUrl: fileUrl })
          })

          let data = await response.json()

          // If main endpoint fails, try PDF.js endpoint
          if (!response.ok || !data.success) {
            console.log("Main extraction failed, trying PDF.js endpoint...")

            response = await fetch(`${BACKEND_API_URL}/api/pdf/extract-pdf-text-pdfjs`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ pdfUrl: fileUrl })
            })

            data = await response.json()

            if (!response.ok || !data.success) {
              throw new Error(data.error || `PDF extraction failed with both methods`)
            }
          }

          console.log(`PDF text extracted successfully. Pages: ${data.pages}, Text length: ${data.textLength}`)

          setExtractionStatus('success')
          setFileContent(data.text)
          setFileMetadata({
            pages: data.pages,
            textLength: data.textLength
          })
          return data.text
        }
      }

    } catch (error) {
      console.error("File content extraction failed:", error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      setExtractionStatus('error')
      setExtractionError(errorMessage)

      // Fallback content based on file type
      const typeName = fileType === 'video' ? 'Video' : fileType === 'ppt' ? 'Presentation' : 'PDF';
      return `${typeName} Processing Failed: ${errorMessage}\n\nFile Information:\n- Title: ${title}\n- URL: ${fileUrl}\n- Type: ${fileType}\n\nPlease ensure the file is accessible and in a supported format.`
    }
  }

  // Function to call Gemini API
  const callGeminiAPI = async (userMessage: string, content: string): Promise<string> => {
    try {
      let contextPrompt = '';
      
      if (fileType === 'video') {
        contextPrompt = `
VIDEO ANALYSIS REQUEST

VIDEO TRANSCRIPTION:
${content}

USER QUESTION: ${userMessage}

INSTRUCTIONS:
This video has been transcribed using Deepgram AI speech-to-text technology.

Please provide helpful analysis based on the transcript including:
1. Key topics and main ideas discussed
2. Important points and conclusions
3. Analysis of the content structure and flow
4. Educational insights and learning points
5. Summary of the main arguments or teachings

Focus on providing accurate, educational analysis based on the actual spoken content.
`
      } else {
        const isPPT = fileType === 'ppt';
        const fileTypeName = isPPT ? 'PPT/PRESENTATION' : 'PDF DOCUMENT';
        
        contextPrompt = `
${fileTypeName} ANALYSIS REQUEST

${fileTypeName} CONTENT:
${content}

USER QUESTION: ${userMessage}

INSTRUCTIONS:
Please analyze the ${isPPT ? 'presentation content' : 'PDF content'} and provide a helpful response. If the content was successfully extracted, provide detailed analysis and answers based on the actual content. If there were extraction issues, provide helpful guidance and explain the limitations.

Focus on being accurate, helpful, and educational.${isPPT ? '\n\nFor presentations, focus on slide content, key points, and presentation structure.' : ''}
`
      }

      const response = await fetch(GEMINI_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: contextPrompt }] }]
        })
      })

      if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}`)
      }

      const data = await response.json()

      if (data.candidates && data.candidates[0] && data.candidates[0].content) {
        return data.candidates[0].content.parts[0].text
      } else {
        throw new Error('Invalid response format from Gemini API')
      }
    } catch (error) {
      console.error('Error calling Gemini API:', error)
      return `I apologize, but I encountered an error while processing your request. Please try again later. Error: ${error instanceof Error ? error.message : 'Unknown error'}`
    }
  }

  // Function to get comprehensive summary
  const getComprehensiveSummary = async (content: string): Promise<string> => {
    try {
      let summaryPrompt = '';
      
      if (fileType === 'video') {
        summaryPrompt = `
TASK: Provide comprehensive video analysis based on the AI-generated transcript.

VIDEO TRANSCRIPT:
${content}

OUTPUT INSTRUCTIONS:
1. Create a structured summary using clear markdown headings
2. Identify and summarize the main topics and key points
3. Extract important data points, statistics, or facts mentioned
4. Note the speaker's conclusions or recommendations
5. Analyze the flow and structure of the content
6. Highlight educational insights and learning objectives
7. Format the response to be comprehensive but well-organized

Focus on providing accurate analysis based on the actual spoken content from the video.
`
      } else {
        const isPPT = fileType === 'ppt';
        const fileTypeName = isPPT ? 'PowerPoint presentation' : 'PDF document';
        
        summaryPrompt = `
TASK: Act as an expert analyst and provide a comprehensive, well-structured summary of the following ${fileTypeName}.

DOCUMENT CONTENT:
${content}

OUTPUT INSTRUCTIONS (Strictly Adhere to Formatting):
1. Structure: Create a structured summary using clear markdown headings (e.g., ##, ###) for sections and bullet points for readability.
2. Key Content: Identify and list key topics, main arguments, and important findings.
3. Data Extraction: Extract all significant data points, statistics, or important facts and present them clearly.
4. Organization Analysis: Note the document's structure and organization${isPPT ? ' (e.g., Slide 1: Title, Slide 2-4: Problem, etc.)' : ' (e.g., Part I: Introduction, Part II: Methodology, etc.)'}.
5. Conclusions: Clearly state any conclusions or recommendations.
6. Information Flow: ${isPPT ? 'Organize the summary by major slides or logical sections of the presentation.' : 'If multi-page, organize the summary by major document sections or recurring themes.'}
7. Emphasis: Ensure the summary is comprehensive but well-organized and easy to read.
`
      }

      const response = await fetch(GEMINI_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: summaryPrompt }] }]
        })
      })

      if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}`)
      }

      const data = await response.json()

      if (data.candidates && data.candidates[0] && data.candidates[0].content) {
        return data.candidates[0].content.parts[0].text
      } else {
        throw new Error('Invalid response format from Gemini API')
      }
    } catch (error) {
      console.error('Error getting comprehensive summary:', error)
      return `I apologize, but I encountered an error while generating the comprehensive summary. Please try asking specific questions about the content instead.`
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const text = prompt.trim()
    if (!text || isTyping) return

    const userMessage: Message = {
      role: "user",
      content: text,
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    setPrompt("")
    setIsTyping(true)

    try {
      // Get file content (extract if not already done)
      let currentFileContent = fileContent
      if (!currentFileContent) {
        currentFileContent = await extractFileContent()
      }

      // Call Gemini API
      const aiResponse = await callGeminiAPI(text, currentFileContent)

      const aiMessage: Message = {
        role: "assistant",
        content: aiResponse,
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, aiMessage])
      setActiveTab('chat')
    } catch (error) {
      console.error('Error in AI conversation:', error)
      const errorMessage: Message = {
        role: "assistant",
        content: "I apologize, but I encountered an error while processing your request. Please try again later.",
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, errorMessage])
      setActiveTab('chat')
    } finally {
      setIsTyping(false)
    }
  }

  // Auto-summarize when AI panel opens for the first time
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      const autoSummarize = async () => {
        setIsTyping(true)
        try {
          // Extract file content first
          const extractedContent = await extractFileContent()

          // Then get comprehensive summary from Gemini
          const aiResponse = await getComprehensiveSummary(extractedContent)

          const summaryMessage: Message = {
            role: "assistant",
            content: aiResponse,
            timestamp: new Date(),
          }
          setMessages([summaryMessage])
        } catch (error) {
          console.error('Error in auto-summarize:', error)
          const typeName = fileType === 'video' ? 'video lecture' : fileType === 'ppt' ? 'presentation' : 'PDF document';

          const welcomeMessage: Message = {
            role: "assistant",
            content: `Hello! I'm your AI Learning Assistant for "${title}". I'm ready to help you analyze this ${typeName}. Ask me anything about the content!`,
            timestamp: new Date(),
          }
          setMessages([welcomeMessage])
        } finally {
          setIsTyping(false)
        }
      }

      autoSummarize()
    }
  }, [isOpen, messages.length, fileUrl, title, fileType])

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e as any)
    }
  }

  // Show extraction status
  const renderExtractionStatus = () => {
    const typeName = fileType === 'video' ? 'video' : fileType === 'ppt' ? 'presentation' : 'PDF';

    if (extractionStatus === 'extracting') {
      return (
        <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg mb-4">
          <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
          <span className="text-sm text-blue-700 dark:text-blue-300">
            {fileType === 'video' 
              ? 'Transcribing video content with Deepgram AI...' 
              : fileType === 'ppt'
                ? 'Processing PowerPoint file (this may take 20-30 seconds)...'
                : 'Extracting text from PDF...'
            }
          </span>
        </div>
      )
    }

    if (extractionStatus === 'error') {
      return (
        <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg mb-4">
          <AlertCircle className="w-4 h-4 text-red-500" />
          <span className="text-sm text-red-700 dark:text-red-300">{typeName} processing failed: {extractionError}</span>
        </div>
      )
    }

    if (extractionStatus === 'success') {
      return (
        <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg mb-4">
          <div className="flex items-center gap-2">
            <Mic className="w-4 h-4 text-green-500" />
            <span className="text-sm text-green-700 dark:text-green-300 flex-1">
              {fileType === 'video' 
                ? `Video transcribed successfully (${fileMetadata.wordCount} words, ${fileMetadata.confidence?.toFixed(2)} confidence)` 
                : `${typeName} content extracted successfully`}
            </span>
          </div>
          
          {fileType === 'video' && fileMetadata.confidence && (
            <div className="mt-2">
              <div className="flex justify-between text-xs text-green-700 dark:text-green-300 mb-1">
                <span>Transcription Confidence</span>
                <span>{(fileMetadata.confidence * 100).toFixed(1)}%</span>
              </div>
              <div className="w-full bg-green-200 dark:bg-green-800 rounded-full h-2">
                <div 
                  className="bg-green-600 h-2 rounded-full" 
                  style={{ width: `${fileMetadata.confidence * 100}%` }}
                />
              </div>
            </div>
          )}
        </div>
      )
    }

    return null
  }

  // Custom components for ReactMarkdown to match your styling
  const markdownComponents = {
    h1: ({ children }: { children?: React.ReactNode }) => (
      <h1 className="text-xl font-bold mt-4 mb-3 text-gray-900 dark:text-gray-100 border-b border-gray-200 dark:border-gray-700 pb-2">
        {children}
      </h1>
    ),
    h2: ({ children }: { children?: React.ReactNode }) => (
      <h2 className="text-lg font-semibold mt-4 mb-2 text-gray-900 dark:text-gray-100">
        {children}
      </h2>
    ),
    h3: ({ children }: { children?: React.ReactNode }) => (
      <h3 className="text-base font-semibold mt-3 mb-2 text-gray-900 dark:text-gray-100">
        {children}
      </h3>
    ),
    h4: ({ children }: { children?: React.ReactNode }) => (
      <h4 className="text-sm font-semibold mt-3 mb-2 text-gray-900 dark:text-gray-100">
        {children}
      </h4>
    ),
    p: ({ children }: { children?: React.ReactNode }) => (
      <p className="text-sm leading-relaxed mb-3 text-gray-900 dark:text-gray-100">
        {children}
      </p>
    ),
    ul: ({ children }: { children?: React.ReactNode }) => (
      <ul className="list-none pl-0 mb-3 space-y-1">
        {children}
      </ul>
    ),
    ol: ({ children }: { children?: React.ReactNode }) => (
      <ol className="list-decimal pl-5 mb-3 space-y-1">
        {children}
      </ol>
    ),
    li: ({ children }: { children?: React.ReactNode }) => (
      <li className="flex items-start mb-1">
        <span className="w-2 h-2 bg-blue-500 rounded-full mt-2 mr-3 flex-shrink-0" />
        <span className="text-sm leading-relaxed text-gray-900 dark:text-gray-100 flex-1">
          {children}
        </span>
      </li>
    ),
    strong: ({ children }: { children?: React.ReactNode }) => (
      <strong className="font-semibold text-gray-900 dark:text-gray-100">
        {children}
      </strong>
    ),
    em: ({ children }: { children?: React.ReactNode }) => (
      <em className="italic text-gray-900 dark:text-gray-100">
        {children}
      </em>
    ),
    blockquote: ({ children }: { children?: React.ReactNode }) => (
      <blockquote className="border-l-4 border-blue-500 pl-4 my-3 italic text-gray-700 dark:text-gray-300">
        {children}
      </blockquote>
    ),
    code: ({ children, inline }: { children?: React.ReactNode; inline?: boolean }) => 
      inline ? (
        <code className="bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded text-sm font-mono text-gray-900 dark:text-gray-100">
          {children}
        </code>
      ) : (
        <code className="block bg-gray-100 dark:bg-gray-800 p-3 rounded text-sm font-mono text-gray-900 dark:text-gray-100 overflow-x-auto my-3">
          {children}
        </code>
      ),
    table: ({ children }: { children?: React.ReactNode }) => (
      <div className="overflow-x-auto my-3">
        <table className="min-w-full border-collapse border border-gray-300 dark:border-gray-600">
          {children}
        </table>
      </div>
    ),
    th: ({ children }: { children?: React.ReactNode }) => (
      <th className="border border-gray-300 dark:border-gray-600 px-3 py-2 bg-gray-100 dark:bg-gray-800 font-semibold text-gray-900 dark:text-gray-100 text-left">
        {children}
      </th>
    ),
    td: ({ children }: { children?: React.ReactNode }) => (
      <td className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-gray-900 dark:text-gray-100">
        {children}
      </td>
    ),
  }

  // Get file type display name and icon
  const getFileTypeInfo = () => {
    switch (fileType) {
      case 'video':
        return { display: 'video lecture', icon: Video, color: 'purple' }
      case 'ppt':
        return { display: 'presentation', icon: FileText, color: 'orange' }
      default:
        return { display: 'PDF document', icon: FileText, color: 'red' }
    }
  }

  if (!isOpen) return null

  const fileTypeInfo = getFileTypeInfo()
  const FileTypeIcon = fileTypeInfo.icon

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50"
      role="dialog"
      aria-label="AI assistant panel"
    >
      <div className="flex flex-col w-[90vw] max-w-6xl h-[90vh] max-h-[800px] shadow-xl rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 animate-slide-in-up">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-blue-500 to-blue-600">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full flex items-center justify-center bg-white/20">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">AI Learning Assistant</h2>
              <div className="flex items-center gap-3 mt-1">
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-green-400" />
                  <span className="text-sm text-white/90">Analyzing: {title}</span>
                </div>
                {fileMetadata.pages && fileType !== 'video' && (
                  <div className="flex items-center gap-1 text-white/80">
                    <Hash className="w-3 h-3" />
                    <span className="text-xs">{fileMetadata.pages} {fileType === 'ppt' ? 'slides' : 'pages'}</span>
                  </div>
                )}
                {fileType === 'video' && fileMetadata.duration && (
                  <div className="flex items-center gap-1 text-white/80">
                    <Clock className="w-3 h-3" />
                    <span className="text-xs">{Math.round(fileMetadata.duration / 60)}min</span>
                  </div>
                )}
                {fileType === 'video' && fileMetadata.wordCount && (
                  <div className="flex items-center gap-1 text-white/80">
                    <Mic className="w-3 h-3" />
                    <span className="text-xs">{fileMetadata.wordCount} words</span>
                  </div>
                )}
                <div className="flex items-center gap-1 text-white/80">
                  <FileTypeIcon className="w-3 h-3" />
                  <span className="text-xs capitalize">{fileTypeInfo.display}</span>
                </div>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full flex items-center justify-center transition-colors hover:bg-white/20 text-white"
            aria-label="Close AI"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
          <button
            className={`flex items-center gap-2 px-6 py-4 text-sm font-medium transition-colors ${activeTab === 'summary'
                ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-500'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            onClick={() => setActiveTab('summary')}
          >
            <BookOpen className="w-4 h-4" />
            Summary
          </button>
          <button
            className={`flex items-center gap-2 px-6 py-4 text-sm font-medium transition-colors ${activeTab === 'chat'
                ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-500'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            onClick={() => setActiveTab('chat')}
          >
            <Bot className="w-4 h-4" />
            Chat
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 flex flex-col min-h-0">
          {/* Summary Panel */}
          {activeTab === 'summary' && (
            <div className="flex-1 flex flex-col p-6 bg-white dark:bg-gray-900 overflow-hidden">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                  {fileType === 'video' ? 'Video Transcription & Analysis' : fileType === 'ppt' ? 'Presentation Summary' : 'Document Summary'}
                </h3>
                {fileMetadata.textLength && (
                  <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                    <div className="flex items-center gap-1">
                      <FileText className="w-4 h-4" />
                      <span>{Math.round(fileMetadata.textLength / 1000)}k characters</span>
                    </div>
                    {fileMetadata.pages && fileType !== 'video' && (
                      <div className="flex items-center gap-1">
                        <BookOpen className="w-4 h-4" />
                        <span>{fileMetadata.pages} {fileType === 'ppt' ? 'slides' : 'pages'}</span>
                      </div>
                    )}
                    {fileType === 'video' && fileMetadata.wordCount && (
                      <div className="flex items-center gap-1">
                        <Mic className="w-4 h-4" />
                        <span>{fileMetadata.wordCount} words</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {renderExtractionStatus()}

              {/* Scrollable content area with flexible height */}
              <div className="flex-1 min-h-0 overflow-hidden">
                <div 
                  ref={summaryContentRef}
                  className="h-full p-4 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 overflow-y-auto"
                >
                  {messages.length > 0 ? (
                    <div className="prose prose-sm max-w-none dark:prose-invert">
                      <ReactMarkdown components={markdownComponents}>
                        {messages[0].content}
                      </ReactMarkdown>
                    </div>
                  ) : isTyping ? (
                    <div className="flex items-center justify-center h-full">
                      <div className="flex flex-col items-center gap-3">
                        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {fileType === 'video' ? 'Transcribing video with Deepgram AI...' : 'Generating comprehensive summary...'}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
                      <p>Summary will appear here once processing is complete.</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Quick Actions */}
              <div className="flex gap-3 mt-6">
                <button
                  className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg transition-colors bg-blue-500 hover:bg-blue-600 text-white"
                  onClick={() => setActiveTab('chat')}
                >
                  <Bot className="w-4 h-4" />
                  Ask Questions
                </button>
              </div>
            </div>
          )}

          {/* Chat Panel */}
          {activeTab === 'chat' && (
            <div className="flex-1 flex flex-col bg-white dark:bg-gray-900 min-h-0">
              {/* Messages Area */}
              <div className="flex-1 p-6 overflow-y-auto bg-white dark:bg-gray-900 min-h-0">
                {messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center px-4">
                    <div className="w-20 h-20 rounded-full flex items-center justify-center mb-4 bg-gray-100 dark:bg-gray-800">
                      <Bot className="w-10 h-10 text-gray-500 dark:text-gray-400" />
                    </div>
                    <h3 className="text-lg font-semibold mb-3 text-gray-900 dark:text-gray-100">
                      Start a Conversation
                    </h3>
                    <p className="text-sm leading-relaxed max-w-md text-gray-600 dark:text-gray-400">
                      {fileType === 'video' 
                        ? 'Video has been transcribed using Deepgram AI. Ask me about the content, key points, or specific details from the transcript.'
                        : `Ask me anything about "${title}". I can help explain concepts, find specific information, or answer questions based on the ${fileTypeInfo.display} content.`
                      }
                    </p>
                    <div className="mt-6 grid grid-cols-1 gap-2 w-full max-w-md">
                      {fileType === 'video' ? [
                        "What are the main topics discussed?",
                        "Summarize the key points",
                        "What conclusions were reached?",
                        "List the important concepts",
                        "Explain the lecture structure"
                      ] : [
                        "Explain the main concepts",
                        "What are the key points?",
                        "Summarize the conclusions",
                        "Quiz me on this content",
                        "Find specific information about..."
                      ].map((suggestion, i) => (
                        <button
                          key={i}
                          onClick={() => setPrompt(suggestion)}
                          className="text-sm px-4 py-3 rounded-lg text-left transition-colors hover:bg-gray-200 dark:hover:bg-gray-700 bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-700"
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6 max-w-4xl mx-auto">
                    {/* Extraction Status */}
                    {renderExtractionStatus()}

                    {/* Messages */}
                    {messages.map((message, i) => (
                      <div
                        key={i}
                        className={`flex gap-4 animate-fade-in ${message.role === "user" ? "flex-row-reverse" : ""}`}
                      >
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${message.role === "user"
                            ? "bg-blue-500"
                            : "bg-gray-100 dark:bg-gray-800"
                          }`}>
                          {message.role === "user" ? (
                            <User className="w-5 h-5 text-white" />
                          ) : (
                            <Bot className="w-5 h-5 text-gray-900 dark:text-gray-100" />
                          )}
                        </div>
                        <div className={`flex-1 ${message.role === "user" ? "items-end" : "items-start"} flex flex-col max-w-[80%]`}>
                          <div className={`px-5 py-3 rounded-2xl max-w-full ${message.role === "user"
                              ? "bg-blue-500 text-white rounded-br-none"
                              : "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-bl-none"
                            }`}>
                            <div className="prose prose-sm max-w-none dark:prose-invert">
                              <ReactMarkdown components={markdownComponents}>
                                {message.content}
                              </ReactMarkdown>
                            </div>
                          </div>
                          <span className="text-xs mt-2 px-1 text-gray-500 dark:text-gray-400">
                            {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                    ))}

                    {isTyping && (
                      <div className="flex gap-4 animate-fade-in">
                        <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 bg-gray-100 dark:bg-gray-800">
                          <Bot className="w-5 h-5 text-gray-900 dark:text-gray-100" />
                        </div>
                        <div className="px-5 py-3 rounded-2xl bg-gray-100 dark:bg-gray-800 rounded-bl-none">
                          <div className="flex gap-1">
                            <div className="w-2 h-2 rounded-full bg-gray-500 dark:bg-gray-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                            <div className="w-2 h-2 rounded-full bg-gray-500 dark:bg-gray-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                            <div className="w-2 h-2 rounded-full bg-gray-500 dark:bg-gray-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                          </div>
                        </div>
                      </div>
                    )}

                    <div ref={messagesEndRef} />
                  </div>
                )}
              </div>

              {/* Input Area */}
              <div className="p-6 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
                <div className="max-w-4xl mx-auto">
                  <div className="flex items-end gap-3">
                    <div className="flex-1">
                      <input
                        ref={inputRef}
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        onKeyPress={handleKeyPress}
                        className="w-full rounded-xl px-5 py-3 transition-all focus:ring-2 focus:ring-blue-500 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-900 dark:text-gray-100 text-base outline-none placeholder-gray-500 dark:placeholder-gray-400"
                        placeholder={fileType === 'video' 
                          ? 'Ask about the video content...' 
                          : `Ask about the ${fileTypeInfo.display} content...`
                        }
                        disabled={isTyping}
                      />
                    </div>
                    <button
                      onClick={handleSubmit}
                      disabled={!prompt.trim() || isTyping}
                      className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all hover:opacity-90 ${prompt.trim() && !isTyping
                          ? "bg-blue-500 text-white hover:bg-blue-600"
                          : "bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed"
                        }`}
                      aria-label="Send message"
                    >
                      {isTyping ? (
                        <Loader2 className="w-6 h-6 animate-spin" />
                      ) : (
                        <Send className="w-6 h-6" />
                      )}
                    </button>
                  </div>
                  <div className="flex gap-2 mt-3">
                    {fileType === 'video' ? [
                      "What are the main topics discussed?",
                      "Summarize the key points",
                      "What conclusions were reached?",
                      "Explain the lecture structure"
                    ] : [
                      "What are the key points?",
                      "Explain the main concepts",
                      "Summarize the conclusions",
                      "Find specific information about..."
                    ].map((suggestion, i) => (
                      <button
                        key={i}
                        onClick={() => setPrompt(suggestion)}
                        className="text-xs px-3 py-1 rounded-full border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 transition-colors hover:bg-gray-200 dark:hover:bg-gray-700"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}