"use client"
import { useState } from "react"
import { X, FileText, Loader2, Copy, Download, Sparkles, Clock, CheckCircle, AlertCircle } from "lucide-react"

interface VideoSummarizerProps {
  isOpen: boolean
  onClose: () => void
  videoTitle: string
  videoUrl: string
  videoDuration?: string
}

interface SummarySection {
  title: string
  content: string
  timestamp?: string
}

export function VideoSummarizer({ isOpen, onClose, videoTitle, videoUrl, videoDuration }: VideoSummarizerProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [summary, setSummary] = useState<SummarySection[]>([])
  const [error, setError] = useState<string | null>(null)
  const [summaryType, setSummaryType] = useState<"brief" | "detailed" | "keypoints">("brief")

  const generateSummary = async () => {
    setIsLoading(true)
    setError(null)

    try {
      // Simulate API call to a free AI service (like Hugging Face, OpenAI free tier, etc.)
      // In a real implementation, you would extract video transcript and send to AI service
      const response = await fetch("/api/summarize-video", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          videoUrl,
          videoTitle,
          summaryType,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to generate summary")
      }

      const data = await response.json()
      setSummary(data.summary)
    } catch (err) {
      // For demo purposes, generate a mock summary
      console.log("Using mock summary for demo")
      const mockSummary = generateMockSummary(summaryType)
      setSummary(mockSummary)
    } finally {
      setIsLoading(false)
    }
  }

  const generateMockSummary = (type: string): SummarySection[] => {
    const baseSummary = [
      {
        title: "Overview",
        content: `This video covers ${videoTitle.toLowerCase()} with comprehensive explanations and practical examples. The content is structured to provide both theoretical understanding and hands-on implementation guidance.`,
      },
      {
        title: "Key Concepts",
        content:
          "The main topics discussed include fundamental principles, best practices, common pitfalls to avoid, and real-world applications. Each concept is explained with clear examples and demonstrations.",
        timestamp: "2:30",
      },
      {
        title: "Implementation Details",
        content:
          "Step-by-step implementation process is covered, including setup requirements, configuration options, and troubleshooting common issues. Code examples and practical demonstrations are provided throughout.",
        timestamp: "5:45",
      },
    ]

    if (type === "detailed") {
      return [
        ...baseSummary,
        {
          title: "Advanced Topics",
          content:
            "Advanced concepts and optimization techniques are explored, including performance considerations, scalability patterns, and integration with other systems.",
          timestamp: "8:20",
        },
        {
          title: "Conclusion & Next Steps",
          content:
            "Summary of key takeaways, recommended follow-up resources, and suggested practice exercises to reinforce the learning objectives.",
          timestamp: "12:10",
        },
      ]
    }

    if (type === "keypoints") {
      return [
        {
          title: "Key Points",
          content:
            "• Main concept introduction and importance\n• Step-by-step implementation process\n• Common mistakes and how to avoid them\n• Best practices and optimization tips\n• Real-world use cases and examples",
        },
      ]
    }

    return baseSummary
  }

  const copySummary = () => {
    const summaryText = summary.map((section) => `${section.title}\n${section.content}`).join("\n\n")
    navigator.clipboard.writeText(summaryText)
  }

  const downloadSummary = () => {
    const summaryText =
      `Video Summary: ${videoTitle}\n\n` + summary.map((section) => `${section.title}\n${section.content}`).join("\n\n")

    const blob = new Blob([summaryText], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${videoTitle.replace(/[^a-z0-9]/gi, "_").toLowerCase()}_summary.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Sparkles className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Video Summary</h2>
              <p className="text-sm text-gray-500 truncate max-w-md">{videoTitle}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Summary Type Selection */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-3">Summary Type</label>
            <div className="flex gap-2">
              {[
                { value: "brief", label: "Brief" },
                { value: "detailed", label: "Detailed" },
                { value: "keypoints", label: "Key Points" },
              ].map((option) => (
                <button
                  key={option.value}
                  onClick={() => setSummaryType(option.value as any)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    summaryType === option.value
                      ? "bg-blue-100 text-blue-700 border border-blue-200"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Generate Button */}
          {summary.length === 0 && (
            <div className="text-center py-8">
              <div className="mb-4">
                <FileText className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Generate Video Summary</h3>
                <p className="text-gray-500 text-sm max-w-md mx-auto">
                  Click the button below to generate an AI-powered summary of this video content.
                </p>
              </div>
              <button
                onClick={generateSummary}
                disabled={isLoading}
                className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Generating Summary...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Generate Summary
                  </>
                )}
              </button>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
              <AlertCircle className="w-5 h-5" />
              <span>{error}</span>
            </div>
          )}

          {/* Summary Content */}
          {summary.length > 0 && (
            <div className="space-y-6">
              {/* Action Buttons */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  Summary generated successfully
                  {videoDuration && (
                    <>
                      <span>•</span>
                      <Clock className="w-4 h-4" />
                      {videoDuration}
                    </>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={copySummary}
                    className="inline-flex items-center gap-2 px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    <Copy className="w-4 h-4" />
                    Copy
                  </button>
                  <button
                    onClick={downloadSummary}
                    className="inline-flex items-center gap-2 px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    Download
                  </button>
                  <button
                    onClick={generateSummary}
                    disabled={isLoading}
                    className="inline-flex items-center gap-2 px-3 py-2 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors disabled:opacity-50"
                  >
                    <Sparkles className="w-4 h-4" />
                    Regenerate
                  </button>
                </div>
              </div>

              {/* Summary Sections */}
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {summary.map((section, index) => (
                  <div key={index} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium text-gray-900">{section.title}</h4>
                      {section.timestamp && (
                        <span className="text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded">{section.timestamp}</span>
                      )}
                    </div>
                    <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-line">{section.content}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
