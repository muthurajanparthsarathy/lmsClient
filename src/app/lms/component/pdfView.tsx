"use client"
import { getToken } from "@/lib/session";

import React, { useState, useEffect, useRef, useCallback } from "react"
import FileMCQAnnotationForm from "./FileMCQAnnotationForm"
import {
  X, Download, ZoomIn, ZoomOut, Maximize, Minimize, FileText,
  HelpCircle, Save, Loader, AlertCircle, Plus, Trash2,
  Copy, ChevronUp, ChevronDown, List, CheckSquare, AlignLeft,
  Image, Check, SlidersHorizontal,
  ChevronRight, BookOpen, ChevronLeft, Hash,
  MousePointer, Link, Zap, ExternalLink, Share2, QrCode,
  Users, Activity, BarChart2, TrendingUp, Clock, CheckCircle,
  XCircle, Award, Radio, Eye, ChevronRightIcon, Wifi, WifiOff,
  LayoutDashboard,
  BookMarked,
  GraduationCap,
  Layers,
} from "lucide-react"
import { io as socketIOClient, Socket } from "socket.io-client"

// ─── HELPERS ──────────────────────────────────────────────────────────────────
let _uid = 0
const uid = (prefix = "id") => `${prefix}-${++_uid}-${Math.random().toString(36).slice(2, 7)}`
const generateLinkToken = () =>
  Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)

// ─── TYPES ────────────────────────────────────────────────────────────────────
interface LiveStudentEvent {
  studentId: string
  studentName: string
  studentEmail?: string
  attemptId: string
  liveQuestionId: string
  startedAt?: string
  submittedAt?: string
  totalScore?: number
  maxScore?: number
  percentageScore?: number
  answeredCount?: number
  totalQuestions?: number
  isCorrect?: boolean
  scoreObtained?: number
  questionId?: string
  status: "started" | "answering" | "completed"
  lastActivity: Date
  // Per-answer detail: questionId → full detail
  answerDetails?: Record<string, {
    isCorrect: boolean
    scoreObtained: number
    studentAnswer?: any           // what the student chose
    correctAnswers?: string[]     // correct option text(s)
    questionTitle?: string        // question text
    options?: { text: string; isCorrect: boolean }[]  // all options
  }>
}

interface QuestionMeta {
  _id: string
  mcqQuestionTitle?: string
  mcqQuestionCorrectAnswers?: string[]
  mcqQuestionOptions?: Array<{ text: string; isCorrect: boolean }>
}

interface ActiveLink {
  link: string
  liveQuestionId: string
  pageNumber: number
  questionCount: number
  createdAt: Date
  label: string
  questions?: QuestionMeta[]
}


interface BreadcrumbItem {
  id: string;
  type: string;
  label: string;
  path?: string;
  onClick?: () => void;
}

// ─── SOCKET HOOK ──────────────────────────────────────────────────────────────
function useLiveStats(
  liveQuestionIds: string[],
  apiBaseUrl: string,
  enabled: boolean
) {
  const [students, setStudents] = useState<Record<string, LiveStudentEvent>>({})
  const [connected, setConnected] = useState(false)
  const socketRef = useRef<Socket | null>(null)

  useEffect(() => {
    if (!enabled || liveQuestionIds.length === 0) return

    const token = typeof localStorage !== "undefined" ? getToken() : ""
    const socketUrl = apiBaseUrl.replace("/api", "").replace(/\/+$/, "")

    const socket = socketIOClient(socketUrl, {
      auth: { token },
      transports: ["websocket"],
      reconnection: true,
      reconnectionDelay: 1000,
    })

    socketRef.current = socket

    socket.on("connect", () => {
      setConnected(true)
      liveQuestionIds.forEach(id => socket.emit("join-liveq", id))
    })

    socket.on("disconnect", () => setConnected(false))

    socket.on("student-started", (data: any) => {
      setStudents(prev => ({
        ...prev,
        [data.studentId]: {
          ...prev[data.studentId],
          studentId: data.studentId,
          studentName: data.studentName,
          studentEmail: data.studentEmail,
          attemptId: data.attemptId,
          liveQuestionId: data.liveQuestionId,
          status: "started",
          lastActivity: new Date(),
          startedAt: data.startedAt,
          answeredCount: 0,
          totalQuestions: data.totalQuestions,
          answerDetails: {},
        }
      }))
    })

    socket.on("answer-submitted", (data: any) => {
      setStudents(prev => {
        const existing = prev[data.studentId] || {}
        const prevDetails = existing.answerDetails || {}
        const newDetails = data.questionId
          ? {
              ...prevDetails,
              [data.questionId]: {
                isCorrect: data.isCorrect,
                scoreObtained: data.scoreObtained,
                studentAnswer: data.studentAnswer,
                correctAnswers: data.correctAnswers || [],
                questionTitle: data.questionTitle || "",
                options: data.options || [],
              }
            }
          : prevDetails
        return {
          ...prev,
          [data.studentId]: {
            ...existing,
            studentId: data.studentId,
            studentName: data.studentName,
            studentEmail: data.studentEmail,
            attemptId: data.attemptId,
            liveQuestionId: data.liveQuestionId,
            status: "answering",
            lastActivity: new Date(),
            totalScore: data.totalScore,
            answeredCount: data.answeredCount,
            totalQuestions: data.totalQuestions,
            answerDetails: newDetails,
          }
        }
      })
    })

    socket.on("test-completed", (data: any) => {
      setStudents(prev => ({
        ...prev,
        [data.studentId]: {
          ...prev[data.studentId],
          studentId: data.studentId,
          studentName: data.studentName,
          studentEmail: data.studentEmail,
          attemptId: data.attemptId,
          liveQuestionId: data.liveQuestionId,
          status: "completed",
          lastActivity: new Date(),
          totalScore: data.totalScore,
          maxScore: data.maxScore,
          percentageScore: data.percentageScore,
          submittedAt: data.submittedAt,
          answeredCount: data.answeredCount,
          totalQuestions: data.totalQuestions,
        }
      }))
    })

    return () => {
      liveQuestionIds.forEach(id => socket.emit("leave-liveq", id))
      socket.disconnect()
      socketRef.current = null
    }
  }, [JSON.stringify(liveQuestionIds), apiBaseUrl, enabled])

  // Fetch initial snapshot from API — returns questions list so caller can store it
  const fetchSnapshot = useCallback(async (liveQuestionId: string) => {
    try {
      const token = typeof localStorage !== "undefined" ? getToken() : ""
      const headers: Record<string,string> = {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      }

      // Fetch responses AND the live question data (for question titles + options)
      const [resResponses, resQuestion] = await Promise.all([
        fetch(`${apiBaseUrl}/live-questions/${liveQuestionId}/responses`, { headers }),
        fetch(`${apiBaseUrl}/api/live-questions/${liveQuestionId}`, { headers }).catch(() => null),
      ])

      const data = await resResponses.json()

      // Build a quick lookup: questionId → { title, options, correctAnswers }
      let questionMeta: Record<string, QuestionMeta> = {}
      let questionsList: QuestionMeta[] = []
      if (resQuestion?.ok) {
        const qData = await resQuestion.json().catch(() => null)
        const qs: any[] = qData?.data?.questions || []
        qs.forEach((q: any) => {
          const meta: QuestionMeta = {
            _id: q._id,
            mcqQuestionTitle: q.mcqQuestionTitle,
            mcqQuestionCorrectAnswers: q.mcqQuestionCorrectAnswers || [],
            mcqQuestionOptions: q.mcqQuestionOptions || [],
          }
          questionMeta[q._id.toString()] = meta
          questionsList.push(meta)
        })
      }

      if (data.success && data.data?.responses) {
        const snapshotStudents: Record<string, LiveStudentEvent> = {}
        data.data.responses.forEach((r: any) => {
          const sName = r.student?.name
            || `${r.student?.firstName || ""} ${r.student?.lastName || ""}`.trim()
            || r.student?.email
            || "Unknown"

          // Build enriched answerDetails
          const answerDetails: LiveStudentEvent["answerDetails"] = {}
          ;(r.answers || []).forEach((a: any) => {
            if (!a.questionId) return
            const qid = a.questionId.toString()
            const meta = questionMeta[qid]
            answerDetails[qid] = {
              isCorrect: a.isCorrect,
              scoreObtained: a.scoreObtained || 0,
              studentAnswer: a.answer,
              correctAnswers: meta?.mcqQuestionCorrectAnswers || [],
              questionTitle: meta?.mcqQuestionTitle || "",
              options: meta?.mcqQuestionOptions || [],
            }
          })

          snapshotStudents[r.student?._id || r._id] = {
            studentId: r.student?._id || r._id,
            studentName: sName,
            studentEmail: r.student?.email,
            attemptId: r._id,
            liveQuestionId,
            status: r.status === "completed" ? "completed" : r.status === "in-progress" ? "answering" : "started",
            lastActivity: new Date(r.updatedAt || r.startedAt),
            totalScore: r.totalScore,
            maxScore: r.maxScore,
            percentageScore: r.percentageScore,
            submittedAt: r.submittedAt,
            answeredCount: r.answeredCount ?? r.answers?.length ?? 0,
            totalQuestions: r.totalQuestions,
            answerDetails,
          }
        })
        setStudents(prev => ({ ...snapshotStudents, ...prev }))
      }

      // Return questions so PDFViewer can store them in activeLinks
      return questionsList
    } catch (e) {
      console.error("Failed to fetch snapshot:", e)
      return []
    }
  }, [apiBaseUrl])

  return { students, connected, fetchSnapshot }
}

// ─── STUDENT CARD ─────────────────────────────────────────────────────────────
function StudentCard({ student, rank }: { student: LiveStudentEvent; rank?: number }) {
  const [expanded, setExpanded] = useState(false)
  const pct = student.percentageScore ?? 0
  const isCompleted = student.status === "completed"
  const isAnswering = student.status === "answering"

  const scoreColor = pct >= 80 ? "#10b981" : pct >= 60 ? "#f59e0b" : "#ef4444"

  const answered = student.answeredCount ?? 0
  const total = student.totalQuestions ?? 0
  const correct = Object.values(student.answerDetails || {}).filter(a => a.isCorrect).length
  const wrong = answered - correct

  return (
    <div style={{
      backgroundColor: "rgba(255,255,255,0.03)",
      border: `1px solid ${isCompleted ? "rgba(16,185,129,0.25)" : isAnswering ? "rgba(245,158,11,0.2)" : "rgba(255,255,255,0.06)"}`,
      borderRadius: 12,
      overflow: "hidden",
      transition: "all 0.3s ease",
      animation: "fadeSlideIn 0.3s ease-out",
    }}>
      {/* Main row */}
      <div
        style={{ padding: "12px 14px", display: "flex", alignItems: "center", gap: 12, cursor: answered > 0 ? "pointer" : "default" }}
        onClick={() => answered > 0 && setExpanded(e => !e)}
      >
        {/* Avatar */}
        <div style={{
          width: 38, height: 38, borderRadius: 10, flexShrink: 0,
          background: isCompleted
            ? "linear-gradient(135deg, #10b981, #059669)"
            : isAnswering
              ? "linear-gradient(135deg, #f59e0b, #d97706)"
              : "linear-gradient(135deg, #6366f1, #4f46e5)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 12, fontWeight: 800, color: "white", position: "relative",
        }}>
          {rank ? `#${rank}` : student.studentName?.charAt(0)?.toUpperCase() || "?"}
          {!isCompleted && (
            <div style={{
              position: "absolute", bottom: -2, right: -2,
              width: 8, height: 8, borderRadius: "50%",
              backgroundColor: isAnswering ? "#f59e0b" : "#6366f1",
              border: "1.5px solid #0c1220",
              animation: "livePulse 2s ease-in-out infinite",
            }} />
          )}
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Name + status badge */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "white", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {student.studentName || "Unknown"}
            </span>
            <span style={{
              fontSize: 9, padding: "1px 6px", borderRadius: 99, fontWeight: 700, flexShrink: 0,
              backgroundColor: isCompleted ? "rgba(16,185,129,0.15)" : isAnswering ? "rgba(245,158,11,0.15)" : "rgba(99,102,241,0.15)",
              color: isCompleted ? "#6ee7b7" : isAnswering ? "#fcd34d" : "#a5b4fc",
              textTransform: "uppercase" as const, letterSpacing: "0.5px",
            }}>
              {isCompleted ? "Done" : isAnswering ? "Answering" : "Joined"}
            </span>
          </div>

          {/* Stats row: correct / wrong / unanswered */}
          {answered > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: 10, color: "#10b981", fontWeight: 700, display: "flex", alignItems: "center", gap: 3 }}>
                <CheckCircle size={10} /> {correct} correct
              </span>
              {wrong > 0 && (
                <span style={{ fontSize: 10, color: "#ef4444", fontWeight: 700, display: "flex", alignItems: "center", gap: 3 }}>
                  <XCircle size={10} /> {wrong} wrong
                </span>
              )}
              {total > 0 && answered < total && (
                <span style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", fontWeight: 600 }}>
                  {total - answered} left
                </span>
              )}
            </div>
          )}

          {/* Progress bar */}
          {total > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ flex: 1, height: 4, backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 99, overflow: "hidden" }}>
                {/* correct segment */}
                <div style={{ display: "flex", height: "100%", width: `${(answered / total) * 100}%`, transition: "width 0.5s ease" }}>
                  <div style={{ flex: correct, backgroundColor: "#10b981", transition: "flex 0.4s ease" }} />
                  <div style={{ flex: wrong, backgroundColor: "#ef4444", transition: "flex 0.4s ease" }} />
                </div>
              </div>
              <span style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", flexShrink: 0 }}>
                {answered}/{total}
              </span>
            </div>
          )}
        </div>

        {/* Score / expand */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          {isCompleted && student.percentageScore !== undefined ? (
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: scoreColor, lineHeight: 1 }}>
                {Math.round(pct)}%
              </div>
              <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", marginTop: 1 }}>
                {student.totalScore ?? 0}/{student.maxScore ?? 0}pt
              </div>
            </div>
          ) : (
            <div style={{ color: "rgba(255,255,255,0.2)" }}>
              <Clock size={14} />
            </div>
          )}
          {answered > 0 && (
            <div style={{ color: "rgba(255,255,255,0.2)", transition: "transform 0.2s", transform: expanded ? "rotate(90deg)" : "rotate(0deg)" }}>
              <ChevronRight size={14} />
            </div>
          )}
        </div>
      </div>

      {/* Expanded per-question detail */}
      {expanded && answered > 0 && (
        <div style={{
          borderTop: "1px solid rgba(255,255,255,0.06)",
          padding: "10px 14px 14px",
          display: "flex", flexDirection: "column", gap: 8,
        }}>
          {/* Header row */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.5px" }}>
              Question breakdown
            </span>
            <div style={{ display: "flex", gap: 10 }}>
              {student.studentEmail && (
                <span style={{ fontSize: 9, color: "rgba(255,255,255,0.2)" }}>{student.studentEmail}</span>
              )}
              {isCompleted && student.submittedAt && (
                <span style={{ fontSize: 9, color: "rgba(255,255,255,0.2)" }}>
                  Submitted {new Date(student.submittedAt).toLocaleTimeString()}
                </span>
              )}
            </div>
          </div>

          {/* One row per answered question */}
          {Object.entries(student.answerDetails || {}).map(([qId, detail], i) => {
            const studentAns = Array.isArray(detail.studentAnswer)
              ? detail.studentAnswer.join(", ")
              : (detail.studentAnswer ?? "—")
            const correctAns = (detail.correctAnswers || []).join(", ") || "—"
            const hasQTitle = !!detail.questionTitle

            return (
              <div
                key={qId}
                style={{
                  borderRadius: 10,
                  border: `1px solid ${detail.isCorrect ? "rgba(16,185,129,0.2)" : "rgba(239,68,68,0.25)"}`,
                  backgroundColor: detail.isCorrect ? "rgba(16,185,129,0.05)" : "rgba(239,68,68,0.05)",
                  overflow: "hidden",
                }}
              >
                {/* Question row */}
                <div style={{
                  display: "flex", alignItems: "flex-start", gap: 8,
                  padding: "8px 10px",
                  borderBottom: detail.isCorrect ? "none" : "1px solid rgba(239,68,68,0.12)",
                }}>
                  {/* Q number badge */}
                  <div style={{
                    flexShrink: 0, width: 20, height: 20, borderRadius: 5,
                    backgroundColor: detail.isCorrect ? "rgba(16,185,129,0.2)" : "rgba(239,68,68,0.2)",
                    color: detail.isCorrect ? "#10b981" : "#ef4444",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 9, fontWeight: 800, marginTop: 1,
                  }}>
                    Q{i + 1}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {/* Question text */}
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.75)", fontWeight: 600, lineHeight: 1.4, marginBottom: 4 }}>
                      {hasQTitle ? detail.questionTitle : <span style={{ color: "rgba(255,255,255,0.25)", fontStyle: "italic" }}>Question {i + 1}</span>}
                    </div>
                    {/* Student answer */}
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 5, marginBottom: detail.isCorrect ? 0 : 4 }}>
                      <span style={{ fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.3)", flexShrink: 0, marginTop: 1 }}>
                        ANSWERED:
                      </span>
                      <span style={{
                        fontSize: 11, fontWeight: 700,
                        color: detail.isCorrect ? "#6ee7b7" : "#fca5a5",
                        wordBreak: "break-word" as const,
                      }}>
                        {studentAns || "—"}
                      </span>
                      <span style={{
                        flexShrink: 0, marginLeft: "auto",
                        fontSize: 9, fontWeight: 800,
                        padding: "1px 7px", borderRadius: 99,
                        backgroundColor: detail.isCorrect ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.15)",
                        color: detail.isCorrect ? "#10b981" : "#ef4444",
                      }}>
                        {detail.isCorrect ? "✓ Correct" : "✗ Wrong"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Correct answer row — only shown when wrong */}
                {!detail.isCorrect && (
                  <div style={{
                    padding: "6px 10px 7px 38px",
                    display: "flex", alignItems: "flex-start", gap: 5,
                    backgroundColor: "rgba(16,185,129,0.07)",
                  }}>
                    <span style={{ fontSize: 9, fontWeight: 700, color: "rgba(16,185,129,0.5)", flexShrink: 0, marginTop: 1 }}>
                      CORRECT:
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#6ee7b7", wordBreak: "break-word" as const }}>
                      {correctAns}
                    </span>
                  </div>
                )}
              </div>
            )
          })}

          {/* Unanswered questions placeholder */}
          {total > answered && (
            <div style={{
              borderRadius: 8, border: "1px solid rgba(255,255,255,0.06)",
              padding: "7px 10px",
              display: "flex", alignItems: "center", gap: 6,
            }}>
              <Clock size={11} color="rgba(255,255,255,0.2)" />
              <span style={{ fontSize: 10, color: "rgba(255,255,255,0.25)" }}>
                {total - answered} question{total - answered !== 1 ? "s" : ""} not yet answered
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── LIVE STATS MODAL ─────────────────────────────────────────────────────────
function LiveStatsModal({
  students,
  connected,
  activeLinks,
  onClose,
}: {
  students: Record<string, LiveStudentEvent>
  connected: boolean
  activeLinks: ActiveLink[]
  onClose: () => void
}) {
  const allStudents = Object.values(students)
  const completed = allStudents.filter(s => s.status === "completed")
  const inProgress = allStudents.filter(s => s.status !== "completed")
  const avgScore = completed.length > 0
    ? completed.reduce((sum, s) => sum + (s.percentageScore || 0), 0) / completed.length
    : 0

  const [tab, setTab] = useState<"live" | "completed" | "links">("live")
  const [copiedLink, setCopiedLink] = useState<string | null>(null)

  const handleCopy = async (link: string) => {
    try { await navigator.clipboard.writeText(link) } catch { }
    setCopiedLink(link)
    setTimeout(() => setCopiedLink(null), 2000)
  }

  // Overall correct/wrong across all students
  const totalCorrect = allStudents.reduce((sum, s) =>
    sum + Object.values(s.answerDetails || {}).filter(a => a.isCorrect).length, 0)
  const totalAnswered = allStudents.reduce((sum, s) => sum + (s.answeredCount || 0), 0)

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 30000,
      backgroundColor: "rgba(0,0,0,0.8)", backdropFilter: "blur(6px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 20,
    }} onClick={onClose}>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 780, maxHeight: "90vh",
          backgroundColor: "#0c1220",
          border: "1px solid rgba(99,102,241,0.3)",
          borderRadius: 20,
          display: "flex", flexDirection: "column",
          boxShadow: "0 40px 80px rgba(0,0,0,0.8), 0 0 0 1px rgba(99,102,241,0.1)",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div style={{
          padding: "18px 24px", borderBottom: "1px solid rgba(255,255,255,0.07)",
          background: "linear-gradient(135deg, rgba(99,102,241,0.15), rgba(16,185,129,0.08))",
          display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12,
              background: "linear-gradient(135deg, #6366f1, #10b981)",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 8px 20px rgba(99,102,241,0.4)",
            }}>
              <Activity size={20} color="white" />
            </div>
            <div>
              <h2 style={{ color: "white", fontWeight: 800, fontSize: 17, margin: 0 }}>
                Live Class Dashboard
              </h2>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
                <div style={{
                  width: 7, height: 7, borderRadius: "50%",
                  backgroundColor: connected ? "#10b981" : "#ef4444",
                  boxShadow: connected ? "0 0 6px #10b981" : "none",
                  animation: connected ? "livePulse 2s ease-in-out infinite" : "none",
                }} />
                <span style={{ fontSize: 11, color: connected ? "#10b981" : "#ef4444", fontWeight: 600 }}>
                  {connected ? "Connected · Live" : "Disconnected"}
                </span>
                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>·</span>
                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>
                  {allStudents.length} student{allStudents.length !== 1 ? "s" : ""} tracked
                </span>
              </div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#475569", padding: 6 }}>
            <X size={18} />
          </button>
        </div>

        {/* Stats Bar — 5 stats now */}
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(5, 1fr)",
          gap: 1, backgroundColor: "rgba(255,255,255,0.05)",
          borderBottom: "1px solid rgba(255,255,255,0.07)", flexShrink: 0,
        }}>
          {[
            { label: "Active", value: inProgress.length, color: "#f59e0b", icon: <Radio size={13} /> },
            { label: "Completed", value: completed.length, color: "#10b981", icon: <CheckCircle size={13} /> },
            { label: "Avg Score", value: `${Math.round(avgScore)}%`, color: "#6366f1", icon: <TrendingUp size={13} /> },
            { label: "Correct", value: totalCorrect, color: "#10b981", icon: <Check size={13} /> },
            { label: "Links", value: activeLinks.length, color: "#ec4899", icon: <Link size={13} /> },
          ].map(stat => (
            <div key={stat.label} style={{
              padding: "12px 14px", backgroundColor: "#0c1220",
              display: "flex", alignItems: "center", gap: 8,
            }}>
              <div style={{ color: stat.color }}>{stat.icon}</div>
              <div>
                <div style={{ fontSize: 18, fontWeight: 800, color: "white", lineHeight: 1 }}>{stat.value}</div>
                <div style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", marginTop: 2, fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.5px" }}>{stat.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{
          display: "flex", borderBottom: "1px solid rgba(255,255,255,0.07)",
          padding: "0 24px", flexShrink: 0,
        }}>
          {[
            { id: "completed", label: "Completed", count: completed.length },
            { id: "links", label: "Active Links", count: activeLinks.length },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id as any)}
              style={{
                padding: "12px 16px", background: "none", border: "none",
                cursor: "pointer", fontSize: 12, fontWeight: 700,
                color: tab === t.id ? "#6366f1" : "rgba(255,255,255,0.35)",
                borderBottom: `2px solid ${tab === t.id ? "#6366f1" : "transparent"}`,
                marginBottom: -1, display: "flex", alignItems: "center", gap: 6,
                transition: "all 0.15s",
              }}
            >
              {t.label}
              <span style={{
                backgroundColor: tab === t.id ? "rgba(99,102,241,0.2)" : "rgba(255,255,255,0.06)",
                color: tab === t.id ? "#a5b4fc" : "rgba(255,255,255,0.3)",
                padding: "1px 6px", borderRadius: 99, fontSize: 10,
              }}>{t.count}</span>
            </button>
          ))}
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 24px" }}>

          {tab === "live" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {inProgress.length === 0 ? (
                <div style={{ textAlign: "center", padding: "48px 0", color: "rgba(255,255,255,0.2)" }}>
                  <Radio size={36} style={{ margin: "0 auto 12px", display: "block", opacity: 0.3 }} />
                  <p style={{ fontSize: 13, margin: 0 }}>Waiting for students to join…</p>
                  <p style={{ fontSize: 11, margin: "6px 0 0", color: "rgba(255,255,255,0.15)" }}>
                    Click a student card to see per-question detail
                  </p>
                </div>
              ) : inProgress.map(s => (
                <StudentCard key={s.studentId} student={s} />
              ))}
            </div>
          )}

          {tab === "completed" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {completed.length === 0 ? (
                <div style={{ textAlign: "center", padding: "48px 0", color: "rgba(255,255,255,0.2)" }}>
                  <CheckCircle size={36} style={{ margin: "0 auto 12px", display: "block", opacity: 0.3 }} />
                  <p style={{ fontSize: 13, margin: 0 }}>No submissions yet</p>
                </div>
              ) : [...completed]
                .sort((a, b) => (b.percentageScore || 0) - (a.percentageScore || 0))
                .map((s, i) => (
                  <StudentCard key={s.studentId} student={s} rank={i + 1} />
                ))}
            </div>
          )}

          {tab === "links" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {activeLinks.length === 0 ? (
                <div style={{ textAlign: "center", padding: "48px 0", color: "rgba(255,255,255,0.2)" }}>
                  <Link size={36} style={{ margin: "0 auto 12px", display: "block", opacity: 0.3 }} />
                  <p style={{ fontSize: 13, margin: 0 }}>No active links yet.</p>
                </div>
              ) : activeLinks.map(link => {
                const linkStudents = Object.values(students).filter(s => s.liveQuestionId === link.liveQuestionId)
                const linkCompleted = linkStudents.filter(s => s.status === "completed")
                const linkCorrect = linkStudents.reduce((sum, s) =>
                  sum + Object.values(s.answerDetails || {}).filter(a => a.isCorrect).length, 0)
                const linkAnswered = linkStudents.reduce((sum, s) => sum + (s.answeredCount || 0), 0)
                return (
                  <div key={link.link} style={{
                    backgroundColor: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(245,158,11,0.2)",
                    borderRadius: 12, padding: "14px 16px",
                  }}>
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 10 }}>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: "#f59e0b", backgroundColor: "rgba(245,158,11,0.15)", padding: "2px 8px", borderRadius: 99 }}>
                            Page {link.pageNumber}
                          </span>
                          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>
                            {link.questionCount}Q
                          </span>
                          {linkAnswered > 0 && (
                            <span style={{ fontSize: 11, color: "#10b981" }}>
                              · {linkCorrect}/{linkAnswered} correct
                            </span>
                          )}
                        </div>
                        <p style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", margin: "0 0 2px", fontFamily: "monospace", wordBreak: "break-all" as const }}>
                          {link.link}
                        </p>
                        <p style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", margin: 0 }}>
                          Created {new Date(link.createdAt).toLocaleTimeString()}
                        </p>
                      </div>
                      <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                        <button
                          onClick={() => handleCopy(link.link)}
                          style={{
                            padding: "6px 12px", borderRadius: 7, border: "none", cursor: "pointer",
                            backgroundColor: copiedLink === link.link ? "rgba(16,185,129,0.15)" : "rgba(245,158,11,0.15)",
                            color: copiedLink === link.link ? "#10b981" : "#f59e0b",
                            fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", gap: 5,
                          }}
                        >
                          {copiedLink === link.link ? <Check size={11} /> : <Copy size={11} />}
                          {copiedLink === link.link ? "Copied!" : "Copy"}
                        </button>
                        <a
                          href={link.link} target="_blank" rel="noopener noreferrer"
                          style={{
                            padding: "6px 10px", borderRadius: 7,
                            backgroundColor: "rgba(99,102,241,0.15)",
                            color: "#a5b4fc", fontSize: 11, fontWeight: 700,
                            textDecoration: "none", display: "flex", alignItems: "center", gap: 4,
                          }}
                        >
                          <ExternalLink size={11} /> Open
                        </a>
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ flex: 1, height: 4, backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 99 }}>
                        <div style={{
                          height: "100%", borderRadius: 99, backgroundColor: "#10b981",
                          width: linkStudents.length > 0 ? `${(linkCompleted.length / linkStudents.length) * 100}%` : "0%",
                          transition: "width 0.5s ease",
                        }} />
                      </div>
                      <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", flexShrink: 0 }}>
                        {linkCompleted.length}/{linkStudents.length} done
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes livePulse {
          0%, 100% { opacity: 1; transform: scale(1) }
          50% { opacity: 0.5; transform: scale(1.3) }
        }
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(8px) }
          to { opacity: 1; transform: translateY(0) }
        }
      `}</style>
    </div>
  )
}

// ─── FLOATING STATS BUTTON ────────────────────────────────────────────────────
function FloatingStatsButton({
  students, connected, activeLinks, onClick,
}: {
  students: Record<string, LiveStudentEvent>
  connected: boolean
  activeLinks: ActiveLink[]
  onClick: () => void
}) {
  const all = Object.values(students)
  const active = all.filter(s => s.status !== "completed").length
  const hasActivity = all.length > 0

  return (
    <button
      onClick={onClick}
      title="Live Class Stats"
      style={{
        position: "fixed", right: 24, bottom: 24,
        width: 60, height: 60, borderRadius: "50%",
        background: hasActivity
          ? "linear-gradient(135deg, #6366f1, #10b981)"
          : "linear-gradient(135deg, #374151, #1f2937)",
        border: "none", cursor: "pointer",
        display: "flex", alignItems: "center", justifyContent: "center",
        boxShadow: hasActivity
          ? "0 8px 32px rgba(99,102,241,0.5), 0 0 0 4px rgba(99,102,241,0.15)"
          : "0 4px 16px rgba(0,0,0,0.4)",
        zIndex: 5000, transition: "all 0.3s ease",
      }}
    >
      <Activity size={24} color="white" />
      {active > 0 && (
        <div style={{
          position: "absolute", top: -2, right: -2,
          backgroundColor: "#f59e0b", color: "white",
          borderRadius: "50%", width: 20, height: 20,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 10, fontWeight: 800, border: "2px solid #0c1220",
        }}>{active > 9 ? "9+" : active}</div>
      )}
      {connected && (
        <div style={{
          position: "absolute", bottom: 2, right: 2,
          width: 10, height: 10, borderRadius: "50%",
          backgroundColor: "#10b981", border: "2px solid #0c1220",
          animation: "livePulse 2s ease-in-out infinite",
        }} />
      )}
    </button>
  )
}

// ─── ACTIVE LINKS CORNER BUTTON ───────────────────────────────────────────────
function ActiveLinksCorner({
  activeLinks, students, onClick,
}: {
  activeLinks: ActiveLink[]
  students: Record<string, LiveStudentEvent>
  onClick: () => void
}) {
  if (activeLinks.length === 0) return null
  const totalStudents = Object.values(students).length

  return (
    <button
      onClick={onClick}
      title="View active links"
      style={{
        position: "absolute", top: 56, right: 16,
        display: "flex", alignItems: "center", gap: 8,
        padding: "6px 12px",
        backgroundColor: "rgba(245,158,11,0.15)",
        border: "1px solid rgba(245,158,11,0.4)",
        borderRadius: 20, cursor: "pointer",
        color: "#f59e0b", fontSize: 11, fontWeight: 700,
        zIndex: 50, backdropFilter: "blur(8px)",
        animation: "slideDown 0.3s ease-out",
        transition: "all 0.2s",
      }}
      onMouseEnter={e => { e.currentTarget.style.backgroundColor = "rgba(245,158,11,0.25)"; e.currentTarget.style.borderColor = "rgba(245,158,11,0.6)" }}
      onMouseLeave={e => { e.currentTarget.style.backgroundColor = "rgba(245,158,11,0.15)"; e.currentTarget.style.borderColor = "rgba(245,158,11,0.4)" }}
    >
      <div style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: "#f59e0b", animation: "livePulse 2s ease-in-out infinite" }} />
      <Zap size={12} />
      {activeLinks.length} Live Link{activeLinks.length !== 1 ? "s" : ""}
      {totalStudents > 0 && (
        <span style={{ backgroundColor: "rgba(245,158,11,0.3)", padding: "1px 6px", borderRadius: 99, fontSize: 10 }}>
          {totalStudents} student{totalStudents !== 1 ? "s" : ""}
        </span>
      )}
    </button>
  )
}

// ─── GENERATED LINK POPUP ─────────────────────────────────────────────────────
function GeneratedLinkPopup({
  link, pageNumber, questionCount, fileName, onClose,
}: {
  link: string; pageNumber: number; questionCount: number; fileName: string; onClose: () => void;
}) {
  const [copied, setCopied] = useState(false)
  const [tab, setTab] = useState<"link" | "qr">("link")
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [qrError, setQrError] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Generate QR code onto canvas whenever tab switches to QR
  useEffect(() => {
    if (tab !== "qr") return
    let cancelled = false

    const generate = async () => {
      try {
        // Dynamically import qrcode (npm: qrcode)
        const QRCode = (await import("qrcode")).default
        if (cancelled) return

        if (canvasRef.current) {
          await QRCode.toCanvas(canvasRef.current, link, {
            width: 240,
            margin: 2,
            color: { dark: "#0f172a", light: "#ffffff" },
          })
          setQrDataUrl(canvasRef.current.toDataURL("image/png"))
        }
      } catch (e) {
        console.error("QR generation failed:", e)
        if (!cancelled) setQrError(true)
      }
    }

    generate()
    return () => { cancelled = true }
  }, [tab, link])

  const handleCopy = async () => {
    try { await navigator.clipboard.writeText(link) } catch {
      const el = document.createElement("textarea")
      el.value = link; document.body.appendChild(el); el.select()
      document.execCommand("copy"); document.body.removeChild(el)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDownloadQR = () => {
    if (!qrDataUrl) return
    const a = document.createElement("a")
    a.href = qrDataUrl
    a.download = `live-mcq-qr-page${pageNumber}.png`
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
  }

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 20000,
      backgroundColor: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      animation: "fadeIn 0.2s ease-out",
    }}>
      <div style={{
        backgroundColor: "#0f172a", border: "1px solid #1e293b",
        borderRadius: 20, padding: 28, maxWidth: 480, width: "90%",
        boxShadow: "0 30px 70px rgba(0,0,0,0.85)",
        animation: "slideUp 0.25s ease-out",
      }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 13 }}>
            <div style={{
              width: 46, height: 46,
              background: "linear-gradient(135deg, rgba(245,158,11,0.2), rgba(234,88,12,0.2))",
              border: "1px solid rgba(245,158,11,0.35)",
              borderRadius: 13, display: "flex", alignItems: "center", justifyContent: "center"
            }}>
              <Share2 size={21} color="#f59e0b" />
            </div>
            {/* <div>
              <h3 style={{ color: "white", fontWeight: 800, fontSize: 15, margin: 0 }}>Live MCQ Ready!</h3>
              <p style={{ color: "#64748b", fontSize: 11, margin: "3px 0 0" }}>
                {questionCount} question{questionCount !== 1 ? "s" : ""} · Page {pageNumber}
              </p>
            </div> */}
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#475569", padding: 4 }}>
            <X size={17} />
          </button>
        </div>

        {/* File badge */}
        <div style={{ backgroundColor: "#1e293b", borderRadius: 8, padding: "8px 12px", marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
          <FileText size={13} color="#64748b" />
          <span style={{ fontSize: 11, color: "#94a3b8", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{fileName}</span>
          <span style={{ fontSize: 9, color: "#f59e0b", backgroundColor: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.2)", padding: "2px 7px", borderRadius: 99, fontWeight: 700 }}>
            Page {pageNumber}
          </span>
        </div>

        {/* Tab switcher: Link | QR Code */}
        <div style={{
          display: "flex", backgroundColor: "#1e293b", borderRadius: 10,
          padding: 3, marginBottom: 16, gap: 2,
        }}>
          {(["link", "qr"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              flex: 1, padding: "8px 0", borderRadius: 8, border: "none", cursor: "pointer",
              fontSize: 12, fontWeight: 700,
              backgroundColor: tab === t ? (t === "qr" ? "#f59e0b" : "#6366f1") : "transparent",
              color: tab === t ? (t === "qr" ? "#0f172a" : "white") : "#64748b",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              transition: "all 0.2s",
            }}>
              {t === "link" ? <><Copy size={12} /> Copy Link</> : <><QrCode size={12} /> QR Code</>}
            </button>
          ))}
        </div>

        {/* Link tab */}
        {tab === "link" && (
          <>
            <div style={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: 10, padding: "11px 13px", marginBottom: 12 }}>
              <div style={{ fontSize: 9, color: "#64748b", fontWeight: 700, marginBottom: 6, textTransform: "uppercase" as const, letterSpacing: "0.5px" }}>Shareable Link</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ flex: 1, fontSize: 11, color: "#94a3b8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: "monospace" }}>{link}</span>
                <button onClick={handleCopy} style={{
                  display: "flex", alignItems: "center", gap: 5, padding: "6px 12px",
                  backgroundColor: copied ? "rgba(16,185,129,0.15)" : "rgba(245,158,11,0.15)",
                  border: `1px solid ${copied ? "rgba(16,185,129,0.3)" : "rgba(245,158,11,0.3)"}`,
                  borderRadius: 6, cursor: "pointer", color: copied ? "#10b981" : "#f59e0b",
                  fontSize: 11, fontWeight: 700, flexShrink: 0, transition: "all 0.2s",
                }}>
                  {copied ? <Check size={11} /> : <Copy size={11} />}
                  {copied ? "Copied!" : "Copy"}
                </button>
              </div>
            </div>
{/* 
            <a href={link} target="_blank" rel="noopener noreferrer" style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              width: "100%", padding: "11px 0", backgroundColor: "#f59e0b",
              borderRadius: 9, color: "#0f172a", fontWeight: 700, fontSize: 13,
              textDecoration: "none", marginBottom: 10,
            }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = "#d97706")}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = "#f59e0b")}
            >
              <ExternalLink size={14} /> Open Live MCQ Page
            </a> */}

            <p style={{ fontSize: 10, color: "#475569", textAlign: "center", margin: 0, lineHeight: 1.5 }}>
              Share this link with students. Results update live in the class dashboard.
            </p>
          </>
        )}

        {/* QR tab */}
        {tab === "qr" && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
            {/* QR canvas — white background card */}
            <div style={{
              backgroundColor: "white", borderRadius: 16, padding: 16,
              boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
              display: "flex", alignItems: "center", justifyContent: "center",
              position: "relative", minHeight: 272,
            }}>
              <canvas ref={canvasRef} style={{ display: "block", borderRadius: 4 }} />
              {!qrDataUrl && !qrError && (
                <div style={{
                  position: "absolute", inset: 0,
                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                  gap: 10, borderRadius: 16,
                  backgroundColor: "rgba(255,255,255,0.95)",
                }}>
                  <div style={{ width: 32, height: 32, border: "3px solid #e2e8f0", borderTop: "3px solid #f59e0b", borderRadius: "50%", animation: "pdfSpin 0.8s linear infinite" }} />
                  <span style={{ fontSize: 11, color: "#94a3b8" }}>Generating QR…</span>
                </div>
              )}
              {qrError && (
                <div style={{ textAlign: "center", padding: 20 }}>
                  <p style={{ fontSize: 12, color: "#ef4444", margin: "0 0 8px" }}>QR generation failed</p>
                  <p style={{ fontSize: 10, color: "#64748b", margin: 0 }}>Make sure <code>qrcode</code> is installed</p>
                </div>
              )}
            </div>

            <p style={{ fontSize: 11, color: "#64748b", textAlign: "center", margin: 0, lineHeight: 1.5 }}>
              Students scan this QR code to open the live quiz instantly.<br />
              <span style={{ color: "#94a3b8", fontSize: 10 }}>No link needed — just scan &amp; go.</span>
            </p>

            {/* Actions */}
            <div style={{ display: "flex", gap: 8, width: "100%" }}>
              <button
                onClick={handleCopy}
                style={{
                  flex: 1, padding: "10px 0", borderRadius: 9, border: "1px solid #334155",
                  backgroundColor: copied ? "rgba(16,185,129,0.12)" : "#1e293b",
                  color: copied ? "#10b981" : "#94a3b8",
                  fontSize: 12, fontWeight: 700, cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                  transition: "all 0.2s",
                }}
              >
                {copied ? <Check size={13} /> : <Copy size={13} />}
                {copied ? "Link Copied!" : "Copy Link"}
              </button>
              <button
                onClick={handleDownloadQR}
                disabled={!qrDataUrl}
                style={{
                  flex: 1, padding: "10px 0", borderRadius: 9, border: "none",
                  backgroundColor: qrDataUrl ? "#f59e0b" : "#334155",
                  color: qrDataUrl ? "#0f172a" : "#64748b",
                  fontSize: 12, fontWeight: 700,
                  cursor: qrDataUrl ? "pointer" : "not-allowed",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                  transition: "all 0.2s",
                }}
                onMouseEnter={e => { if (qrDataUrl) e.currentTarget.style.backgroundColor = "#d97706" }}
                onMouseLeave={e => { if (qrDataUrl) e.currentTarget.style.backgroundColor = "#f59e0b" }}
              >
                <Download size={13} /> Download QR
              </button>
            </div>
          </div>
        )}
      </div>
      <style>{`
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(20px) } to { opacity: 1; transform: translateY(0) } }
      `}</style>
    </div>
  )
}

// ─── RIGHT-CLICK CONTEXT MENU ─────────────────────────────────────────────────
function ContextMenu({ x, y, pageNumber, onAddMcq, onLiveAddMcq, onClose }: {
  x: number; y: number; pageNumber: number;
  onAddMcq: (page: number) => void;
  onLiveAddMcq: (page: number) => void;
  onClose: () => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const out = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose() }
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    document.addEventListener("mousedown", out)
    document.addEventListener("keydown", esc)
    return () => { document.removeEventListener("mousedown", out); document.removeEventListener("keydown", esc) }
  }, [onClose])

  return (
    <div ref={menuRef} style={{
      position: "fixed", left: x, top: y, zIndex: 10000,
      minWidth: 240, backgroundColor: "#1f2937", border: "1px solid #374151",
      borderRadius: 10, boxShadow: "0 10px 30px rgba(0,0,0,0.6)",
      padding: "4px 0", animation: "ctxFade 0.12s ease-out",
    }}>
      <div style={{ padding: "8px 12px", borderBottom: "1px solid #374151", fontSize: 11, color: "#9ca3af", fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.5px", display: "flex", alignItems: "center", gap: 6 }}>
        <Hash size={12} color="#a78bfa" /> Page {pageNumber}
      </div>
      <button onClick={() => { onAddMcq(pageNumber); onClose() }}
        style={{ width: "100%", padding: "10px 12px", backgroundColor: "transparent", border: "none", color: "#f3f4f6", fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 10 }}
        onMouseEnter={e => (e.currentTarget.style.backgroundColor = "#374151")}
        onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}>
        <HelpCircle size={14} color="#a78bfa" />
        <span style={{ flex: 1, textAlign: "left" }}>Add MCQ Question</span>
        <span style={{ fontSize: 10, color: "#a78bfa", backgroundColor: "rgba(124,58,237,0.15)", padding: "2px 6px", borderRadius: 4, fontWeight: 700 }}>default</span>
      </button>
      <button onClick={() => { onLiveAddMcq(pageNumber); onClose() }}
        style={{ width: "100%", padding: "10px 12px", backgroundColor: "transparent", border: "none", color: "#f3f4f6", fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 10 }}
        onMouseEnter={e => (e.currentTarget.style.backgroundColor = "#374151")}
        onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}>
        <Zap size={14} color="#f59e0b" />
        <span style={{ flex: 1, textAlign: "left" }}>Live Add MCQ Question</span>
        <span style={{ fontSize: 10, color: "#f59e0b", backgroundColor: "rgba(245,158,11,0.15)", padding: "2px 6px", borderRadius: 4, fontWeight: 700 }}>link</span>
      </button>
    </div>
  )
}

// ─── TYPE CONFIG ──────────────────────────────────────────────────────────────
const typeConfig = {
  "multiple-choice": { label: "Multiple Choice", icon: <List className="h-3.5 w-3.5" />, color: "text-violet-600", bg: "bg-violet-50" },
  "checkboxes":      { label: "Checkboxes",      icon: <CheckSquare className="h-3.5 w-3.5" />, color: "text-blue-600", bg: "bg-blue-50" },
  "short-answer":    { label: "Short Answer",     icon: <AlignLeft className="h-3.5 w-3.5" />, color: "text-orange-600", bg: "bg-orange-50" },
  "paragraph":       { label: "Paragraph",        icon: <BookOpen className="h-3.5 w-3.5" />, color: "text-teal-600", bg: "bg-teal-50" },
}

function OptionsPerRowPicker({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] font-semibold text-slate-400">Layout:</span>
      {[1, 2, 3, 4].map(n => (
        <button key={n} type="button" onClick={() => onChange(n)}
          className={`w-6 h-6 rounded-md text-[10px] font-bold transition-all ${value === n ? "bg-violet-600 text-white shadow-sm" : "bg-slate-100 text-slate-500 hover:bg-violet-50 hover:text-violet-600"}`}>
          {n}
        </button>
      ))}
      <span className="text-[10px] text-slate-400">per row</span>
    </div>
  )
}

function SettingsMenu({ isOpen, onClose, onCollapseAll, onExpandAll }: any) {
  if (!isOpen) return null
  return (
    <div className="absolute top-full right-0 mt-1.5 w-52 bg-white rounded-xl shadow-2xl border border-slate-200 py-2 z-50">
      <p className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">View</p>
      {([["Collapse All", <ChevronRight className="h-3.5 w-3.5 text-slate-400" />, onCollapseAll],
        ["Expand All", <ChevronDown className="h-3.5 w-3.5 text-slate-400" />, onExpandAll]] as any[]).map(([label, icon, handler]) => (
        <button key={label} onClick={() => { handler(); onClose() }}
          className="w-full px-3 py-2 flex items-center gap-2 hover:bg-slate-50 transition-colors text-xs text-slate-700">
          {icon}{label}
        </button>
      ))}
    </div>
  )
}

function ImageToolbar({ alignment, sizePercent, onAlignmentChange, onSizeChange, onRemove, onClose }: any) {
  return (
    <div className="absolute top-2 left-1/2 -translate-x-1/2 z-50 bg-white rounded-xl shadow-2xl border border-slate-200 flex items-stretch divide-x divide-slate-100" style={{ minWidth: 260 }}>
      <div className="flex flex-col items-center justify-center px-3 py-2 gap-1">
        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Align</span>
        <div className="flex gap-0.5">
          {["left", "center", "right"].map(a => (
            <button key={a} onClick={() => onAlignmentChange(a)}
              className={`w-6 h-6 rounded-md text-[10px] font-bold transition-all ${alignment === a ? "bg-violet-600 text-white" : "bg-slate-100 text-slate-400 hover:bg-violet-50 hover:text-violet-600"}`}>
              {a[0].toUpperCase()}
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-col justify-center px-3 py-2 gap-1 flex-1">
        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Size {sizePercent}%</span>
        <div className="flex items-center gap-1.5">
          <ZoomOut className="h-3 w-3 text-slate-300" />
          <input type="range" min={10} max={100} step={5} value={sizePercent} onChange={e => onSizeChange(parseInt(e.target.value))} className="flex-1 h-1.5 accent-violet-600 cursor-pointer" />
          <ZoomIn className="h-3 w-3 text-slate-300" />
        </div>
      </div>
      <div className="flex items-center gap-0.5 px-2 py-2">
        <button onClick={onRemove} className="p-1.5 hover:bg-red-50 rounded-lg text-slate-400 hover:text-red-500 transition-colors"><Trash2 className="h-3.5 w-3.5" /></button>
        <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 transition-colors"><X className="h-3.5 w-3.5" /></button>
      </div>
    </div>
  )
}

function PdfPageCanvas({ pdfDoc, pageNum, scale, onContextMenu, onClick, showMcqMarker, mcqCount, placeholderDims }: {
  pdfDoc: any; pageNum: number; scale: number;
  onContextMenu?: (e: React.MouseEvent, page: number) => void;
  onClick?: (e: React.MouseEvent, page: number) => void;
  showMcqMarker?: boolean; mcqCount?: number;
  placeholderDims?: { width: number; height: number } | null;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const taskRef = useRef<any>(null)
  const [shouldRender, setShouldRender] = useState(false)

  // Lazy-mount: render this page only once it comes near the viewport, then stay rendered
  useEffect(() => {
    if (shouldRender || !wrapperRef.current) return
    const observer = new IntersectionObserver(
      entries => { if (entries.some(e => e.isIntersecting)) setShouldRender(true) },
      { rootMargin: "1500px 0px" }
    )
    observer.observe(wrapperRef.current)
    return () => observer.disconnect()
  }, [shouldRender])

  useEffect(() => {
    if (!shouldRender || !pdfDoc || !canvasRef.current) return
    let cancelled = false
    ;(async () => {
      if (taskRef.current) { try { taskRef.current.cancel() } catch {} taskRef.current = null }
      try {
        const page = await pdfDoc.getPage(pageNum)
        if (cancelled) return
        const vp = page.getViewport({ scale })
        const canvas = canvasRef.current!
        canvas.width = vp.width; canvas.height = vp.height
        const task = page.render({ canvasContext: canvas.getContext("2d")!, viewport: vp })
        taskRef.current = task
        await task.promise
      } catch (e: any) { if (e?.name !== "RenderingCancelledException") console.error(e) }
    })()
    return () => { cancelled = true }
  }, [shouldRender, pdfDoc, pageNum, scale])

  return (
    <div ref={wrapperRef} style={{ position: "relative" }}>
      {shouldRender ? (
        <canvas
          ref={el => {
            canvasRef.current = el
            // Pre-size once at mount so the canvas holds the placeholder footprint until the real render sets exact dims
            if (el && !el.dataset.sized) { el.dataset.sized = "1"; el.width = placeholderDims?.width || 600; el.height = placeholderDims?.height || 800 }
          }}
          onContextMenu={e => { e.preventDefault(); onContextMenu?.(e, pageNum) }}
          onClick={e => onClick?.(e, pageNum)}
          style={{ display: "block", boxShadow: "0 2px 16px rgba(0,0,0,0.4)", borderRadius: 3, maxWidth: "100%", cursor: onContextMenu ? "cell" : "default" }}
        />
      ) : (
        <div style={{ width: placeholderDims?.width || 600, aspectRatio: placeholderDims ? `${placeholderDims.width} / ${placeholderDims.height}` : "3 / 4", maxWidth: "100%", backgroundColor: "#1f2937", boxShadow: "0 2px 16px rgba(0,0,0,0.4)", borderRadius: 3 }} />
      )}
      {showMcqMarker && (
        <div style={{ position: "absolute", top: 10, right: 10, backgroundColor: "rgba(124,58,237,0.9)", color: "white", borderRadius: 999, padding: "4px 10px", fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", gap: 4, boxShadow: "0 2px 8px rgba(0,0,0,0.4)", pointerEvents: "none" }}>
          <HelpCircle size={11} /> {mcqCount || 1} MCQ{(mcqCount || 1) !== 1 ? "s" : ""}
        </div>
      )}
    </div>
  )
}

// ─── MCQ QUESTION FORM ────────────────────────────────────────────────────────
function MCQQuestionForm({
  onClose, onSave, initialPageNumber = 1,
  institution, courses, structureType, tabType, subcategory, fileName,
  apiBaseUrl = "https://lmsserver-yeve.onrender.com",
  mcqMode = "default",
  onLinkGenerated,
}: any) {
  const makeBlock = () => ({
    id: uid("block"), isActive: true, sequence: 0, pageNumber: initialPageNumber,
    mcqQuestion: {
      questionTitle: "",
      options: [
        { id: uid("opt"), text: "", isCorrect: false, imageUrl: null, imageAlignment: "left", imageSizePercent: 100 },
        { id: uid("opt"), text: "", isCorrect: false, imageUrl: null, imageAlignment: "left", imageSizePercent: 100 },
      ],
      correctAnswers: [] as string[], explanation: "",
    },
    type: "multiple-choice", hasExplanation: false, explanation: "", optionsPerRow: 1, isRequired: false,
    questionImage: { imageUrl: "", alignment: "center", sizePercent: 60 }, explanationImageUrl: "",
  })

  const [blocks, setBlocks] = useState([makeBlock()])
  const [errors, setErrors] = useState<Record<string, any>>({})
  const [collapsedState, setCollapsed] = useState<Record<string, boolean>>({})
  const [showTypeMenu, setShowTypeMenu] = useState<string | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [activeImgToolbar, setActiveImgToolbar] = useState<any>(null)
  const [isSaving, setIsSaving] = useState(false)
  const isLinkMode = mcqMode === "link"

  const updateBlock = (id: string, patch: any) => setBlocks(bs => bs.map(b => b.id === id ? { ...b, ...patch } : b))
  const updateMcqQuestion = (id: string, patch: any) => setBlocks(bs => bs.map(b => b.id === id ? { ...b, mcqQuestion: { ...b.mcqQuestion, ...patch } } : b))
  const updateOption = (bid: string, oid: string, patch: any) => setBlocks(bs => bs.map(b => b.id === bid ? { ...b, mcqQuestion: { ...b.mcqQuestion, options: b.mcqQuestion.options.map((o: any) => o.id === oid ? { ...o, ...patch } : o) } } : b))
  const addBlock = () => { const nb = makeBlock(); setBlocks(bs => [...bs, nb]); setCollapsed(p => ({ ...p, [nb.id]: false })) }
  const removeBlock = (id: string) => { if (blocks.length === 1) { const nb = makeBlock(); setBlocks([nb]); setCollapsed({ [nb.id]: false }) } else { setBlocks(bs => bs.filter(b => b.id !== id)); setCollapsed(p => { const n = { ...p }; delete n[id]; return n }) } }
  const moveBlock = (id: string, dir: "up" | "down") => { const idx = blocks.findIndex(b => b.id === id); if (dir === "up" && idx === 0) return; if (dir === "down" && idx === blocks.length - 1) return; const nb = [...blocks]; const ni = dir === "up" ? idx - 1 : idx + 1; [nb[idx], nb[ni]] = [nb[ni], nb[idx]]; setBlocks(nb) }
  const duplicateBlock = (id: string) => { const src = blocks.find(b => b.id === id); if (!src) return; const nid = uid("block"); const dup = { ...src, id: nid, mcqQuestion: { ...src.mcqQuestion, options: src.mcqQuestion.options.map((o: any) => ({ ...o, id: uid("opt"), imageUrl: o.imageUrl?.startsWith("data:") ? "" : o.imageUrl })), correctAnswers: [] } }; setBlocks(bs => [...bs, dup]); setCollapsed(p => ({ ...p, [nid]: false })) }
  const collapseAll = () => { const s: any = {}; blocks.forEach(b => (s[b.id] = true)); setCollapsed(s) }
  const expandAll = () => { const s: any = {}; blocks.forEach(b => (s[b.id] = false)); setCollapsed(s) }
  const addOption = (bid: string) => setBlocks(bs => bs.map(b => b.id === bid ? { ...b, mcqQuestion: { ...b.mcqQuestion, options: [...b.mcqQuestion.options, { id: uid("opt"), text: "", isCorrect: false, imageUrl: null, imageAlignment: "left", imageSizePercent: 100 }] } } : b))
  const removeOption = (bid: string, oid: string) => setBlocks(bs => bs.map(b => { if (b.id !== bid) return b; const opt = b.mcqQuestion.options.find((o: any) => o.id === oid); const newOpts = b.mcqQuestion.options.filter((o: any) => o.id !== oid); let newCA = [...b.mcqQuestion.correctAnswers]; if (opt?.isCorrect) newCA = newCA.filter((a: string) => a !== opt.text); return { ...b, mcqQuestion: { ...b.mcqQuestion, options: newOpts, correctAnswers: newCA } } }))
  const setCorrect = (bid: string, oid: string) => setBlocks(bs => bs.map(b => { if (b.id !== bid) return b; const updated = b.mcqQuestion.options.map((o: any) => ({ ...o, isCorrect: o.id === oid })); const correct = updated.find((o: any) => o.id === oid); return { ...b, mcqQuestion: { ...b.mcqQuestion, options: updated, correctAnswers: correct?.text ? [correct.text] : [] } } }))
  const toggleCorrect = (bid: string, oid: string) => setBlocks(bs => bs.map(b => { if (b.id !== bid) return b; const updated = b.mcqQuestion.options.map((o: any) => o.id === oid ? { ...o, isCorrect: !o.isCorrect } : o); const newCA = updated.filter((o: any) => o.isCorrect).map((o: any) => o.text).filter((t: string) => t.trim()); return { ...b, mcqQuestion: { ...b.mcqQuestion, options: updated, correctAnswers: newCA } } }))
  const updateOptionText = (bid: string, oid: string, newText: string) => setBlocks(bs => bs.map(b => { if (b.id !== bid) return b; const old = b.mcqQuestion.options.find((o: any) => o.id === oid); const updated = b.mcqQuestion.options.map((o: any) => o.id === oid ? { ...o, text: newText } : o); let newCA = [...b.mcqQuestion.correctAnswers]; if (old?.isCorrect) { newCA = newCA.filter((a: string) => a !== old.text); if (newText.trim()) newCA.push(newText) } return { ...b, mcqQuestion: { ...b.mcqQuestion, options: updated, correctAnswers: newCA } } }))

  const uploadQuestionImage = (bid: string, file: File) => { const r = new FileReader(); r.onload = e => { updateBlock(bid, { questionImage: { ...blocks.find(b => b.id === bid)?.questionImage, imageUrl: (e.target as any).result } }); setActiveImgToolbar({ type: "question", blockId: bid }) }; r.readAsDataURL(file) }
  const uploadOptionImage = (bid: string, oid: string, file: File) => { const r = new FileReader(); r.onload = e => { updateOption(bid, oid, { imageUrl: (e.target as any).result }); setActiveImgToolbar({ type: "option", blockId: bid, optionId: oid }) }; r.readAsDataURL(file) }

  const isQImgActive = (bid: string) => activeImgToolbar?.type === "question" && activeImgToolbar.blockId === bid
  const isOptImgActive = (bid: string, oid: string) => activeImgToolbar?.type === "option" && activeImgToolbar.blockId === bid && activeImgToolbar.optionId === oid

  const validate = () => {
    const errs: any = {}; let valid = true
    blocks.forEach(b => {
      const be: any = {}
      const cleanTitle = b.mcqQuestion?.questionTitle?.replace(/<[^>]*>/g, "").trim() || ""
      if (!cleanTitle) { be.questionTitle = "Question title is required"; valid = false }
      const nonEmpty = b.mcqQuestion.options.filter((o: any) => o.text.trim())
      if (nonEmpty.length < 2) { be.options = "At least 2 non-empty options are required"; valid = false }
      if (b.mcqQuestion.correctAnswers.length === 0) { be.correctAnswer = "Mark at least one correct answer"; valid = false }
      if (Object.keys(be).length) errs[b.id] = be
    })
    setErrors(errs); return valid
  }

  const mapQuestionType = (t: string): string => ({
    "multiple-choice": "multiple_choice", "checkboxes": "checkboxes",
    "short-answer": "short_answer", "paragraph": "essay",
  }[t] || "multiple_choice")

  const buildQuestionsPayload = () => blocks.map((b, idx) => ({
    questionType: "mcq",
    mcqQuestionTitle: b.mcqQuestion?.questionTitle?.replace(/<[^>]*>/g, "").trim() || "",
    mcqQuestionDescription: b.hasExplanation ? (b.explanation || "") : "",
    mcqQuestionType: mapQuestionType(b.type),
    mcqQuestionDifficulty: "medium",
    mcqQuestionScore: 1,
    mcqQuestionOptionsPerRow: b.optionsPerRow || 1,
    mcqQuestionRequired: b.isRequired || false,
    mcqQuestionOptions: b.mcqQuestion.options.map((o: any) => ({
      text: o.text.trim(), isCorrect: o.isCorrect,
      imageUrl: o.imageUrl?.startsWith("data:") ? null : (o.imageUrl || null),
      imageAlignment: o.imageAlignment || "left", imageSizePercent: o.imageSizePercent || 100,
    })),
    mcqQuestionCorrectAnswers: b.mcqQuestion.correctAnswers.filter((a: string) => a && a.trim()),
    sequence: idx,
  }))

  const handleSave = async (e: React.MouseEvent) => {
    e.preventDefault()
    if (!validate()) return
    const missing: string[] = []
    if (!institution?.trim()) missing.push("institution")
    if (!courses?.trim()) missing.push("courses")
    if (missing.length > 0) { alert(`Missing required fields: ${missing.join(", ")}.`); return }
    setIsSaving(true)
    try {
      const linkToken = generateLinkToken()
      const origin = typeof window !== "undefined" ? window.location.origin : "http://localhost:3000"
      const shareableUrl = `${origin}/lms/pages/courses/live-mcq/${linkToken}`

      const payload: Record<string, any> = {
        structureType: structureType || null,
        tabType: tabType || undefined,
        subCategory: subcategory || undefined,
        link: linkToken,
        questions: buildQuestionsPayload(),
        allowRetake: false, maxAttempts: 1, shuffleQuestions: false,
        showResultImmediately: true, status: "active",
        startDate: new Date().toISOString(),
      }
      if (institution?.trim()) payload.institution = institution.trim()
      if (courses?.trim()) payload.courses = courses.trim()

      const token = typeof localStorage !== "undefined" ? getToken() : ""
      const headers: Record<string, string> = { "Content-Type": "application/json" }
      if (token) headers["Authorization"] = `Bearer ${token}`

      const response = await fetch(`${apiBaseUrl}/live-questions/create`, {
        method: "POST", headers, body: JSON.stringify(payload),
      })
      if (!response.ok) {
        const err = await response.json().catch(() => ({}))
        throw new Error(err.message || `API error ${response.status}`)
      }
      const responseData = await response.json()
      const savedLiveQuestion = responseData.data

      const savedQuestions = blocks.map(b => ({
        id: b.id,
        questionTitle: b.mcqQuestion?.questionTitle,
        options: b.mcqQuestion?.options,
        explanation: b.explanation,
        pageNumber: initialPageNumber,
        type: isLinkMode ? "link" : "default",
        link: isLinkMode ? shareableUrl : undefined,
        liveQuestionId: savedLiveQuestion?._id,
      }))

      onSave(savedQuestions)

      if (isLinkMode && onLinkGenerated) {
        onLinkGenerated(shareableUrl, blocks.length, savedLiveQuestion?._id)
        return
      }
      onClose()
    } catch (err: any) {
      console.error("Failed to save MCQ:", err)
      alert("Failed to save questions: " + err.message)
    } finally {
      setIsSaving(false)
    }
  }

  const renderOptions = (block: any) => {
    const cols = block.optionsPerRow || 1
    const gridCls = ["grid-cols-1", "grid-cols-2", "grid-cols-3", "grid-cols-4"][cols - 1]
    return (
      <div className={`grid ${gridCls} gap-2`}>
        {block.mcqQuestion.options.map((opt: any, idx: number) => (
          <div key={opt.id} className="group/opt relative">
            <div className={`flex flex-col rounded-lg border transition-all overflow-hidden ${opt.isCorrect ? "border-emerald-300 bg-emerald-50/40" : "border-slate-200 bg-white hover:border-slate-300"}`}>
              {opt.imageUrl && (
                <div className="px-2 pt-2 relative">
                  {isOptImgActive(block.id, opt.id) && <ImageToolbar alignment={opt.imageAlignment || "left"} sizePercent={opt.imageSizePercent || 100} onAlignmentChange={(a: string) => updateOption(block.id, opt.id, { imageAlignment: a })} onSizeChange={(v: number) => updateOption(block.id, opt.id, { imageSizePercent: v })} onRemove={() => { updateOption(block.id, opt.id, { imageUrl: null }); setActiveImgToolbar(null) }} onClose={() => setActiveImgToolbar(null)} />}
                  <div style={{ display: "flex", justifyContent: opt.imageAlignment === "left" ? "flex-start" : opt.imageAlignment === "right" ? "flex-end" : "center", marginTop: isOptImgActive(block.id, opt.id) ? 64 : 0 }}>
                    <div style={{ width: `${opt.imageSizePercent || 100}%` }} className="cursor-pointer" onClick={() => setActiveImgToolbar(isOptImgActive(block.id, opt.id) ? null : { type: "option", blockId: block.id, optionId: opt.id })}>
                      <img src={opt.imageUrl} alt="" className={`w-full h-auto rounded-md border-2 transition-all ${isOptImgActive(block.id, opt.id) ? "border-violet-400 ring-2 ring-violet-100" : "border-transparent hover:border-violet-200"}`} />
                    </div>
                  </div>
                </div>
              )}
              <div className="flex items-center gap-2 px-2.5 py-2">
                <button type="button" className="flex-shrink-0" onClick={() => block.type === "checkboxes" ? toggleCorrect(block.id, opt.id) : setCorrect(block.id, opt.id)}>
                  {block.type === "checkboxes" ? (
                    <div className={`w-3.5 h-3.5 rounded border-2 flex items-center justify-center transition-all ${opt.isCorrect ? "border-emerald-500 bg-emerald-500" : "border-slate-300 hover:border-violet-400"}`}>{opt.isCorrect && <Check className="h-2 w-2 text-white" />}</div>
                  ) : (
                    <div className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center transition-all ${opt.isCorrect ? "border-emerald-500 bg-emerald-500" : "border-slate-300 hover:border-violet-400"}`}>{opt.isCorrect && <div className="w-1.5 h-1.5 rounded-full bg-white" />}</div>
                  )}
                </button>
                <input type="text" value={opt.text} onChange={e => updateOptionText(block.id, opt.id, e.target.value)} placeholder={`Option ${String.fromCharCode(65 + idx)}`} className={`flex-1 text-xs outline-none bg-transparent placeholder:text-slate-300 ${opt.isCorrect ? "text-emerald-700 font-semibold" : "text-slate-700"}`} />
                <div className="opacity-0 group-hover/opt:opacity-100 flex items-center gap-0.5 transition-opacity">
                  {!opt.imageUrl && (<label className="cursor-pointer p-1 hover:bg-slate-100 rounded-md transition-colors"><Image className="h-3 w-3 text-slate-400" /><input type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) uploadOptionImage(block.id, opt.id, f) }} /></label>)}
                  {block.mcqQuestion.options.length > 2 && (<button onClick={() => removeOption(block.id, opt.id)} className="p-1 hover:bg-red-50 rounded-md transition-colors"><X className="h-3 w-3 text-slate-300 hover:text-red-400" /></button>)}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  const renderQuestionContent = (block: any) => {
    if (collapsedState[block.id]) return null
    return (
      <div className="px-4 py-3 space-y-2.5">
        <div className="flex items-center justify-between">
          <OptionsPerRowPicker value={block.optionsPerRow || 1} onChange={v => updateBlock(block.id, { optionsPerRow: v })} />
        </div>
        {renderOptions(block)}
        <button onClick={() => addOption(block.id)} className="text-[11px] text-violet-500 hover:text-violet-700 font-semibold">+ Add option</button>
        {errors[block.id]?.options && <div className="flex items-center gap-1.5 text-xs text-red-600 bg-red-50 px-2.5 py-1.5 rounded-lg"><AlertCircle className="h-3.5 w-3.5" />{errors[block.id].options}</div>}
        {errors[block.id]?.correctAnswer && <div className="flex items-center gap-1.5 text-xs text-amber-600 bg-amber-50 px-2.5 py-1.5 rounded-lg"><AlertCircle className="h-3.5 w-3.5" />{errors[block.id].correctAnswer}</div>}
      </div>
    )
  }

  const qTypeConfig = (type: string) => typeConfig[type as keyof typeof typeConfig] || typeConfig["multiple-choice"]

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-900/60 backdrop-blur-sm">
      <div className="flex items-center justify-between px-5 py-3 bg-white border-b border-slate-200 shadow-sm flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shadow-sm ${isLinkMode ? "bg-amber-500" : "bg-violet-600"}`}>
            {isLinkMode ? <Zap className="h-4 w-4 text-white" /> : <HelpCircle className="h-4 w-4 text-white" />}
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              {isLinkMode ? "Live Add MCQ Questions" : "Add MCQ Questions"}
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${isLinkMode ? "bg-amber-100 text-amber-700" : "bg-violet-100 text-violet-700"}`}>
                {isLinkMode ? "live link" : "default"}
              </span>
            </h2>
            <p className="text-[11px] text-slate-400 mt-0.5">
              On page <span className="font-mono text-violet-600">#{initialPageNumber}</span>
              &nbsp;·&nbsp;{blocks.length} question{blocks.length !== 1 ? "s" : ""}
              {fileName && <span className="ml-2">· {fileName}</span>}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <div className="relative">
            <button onClick={() => setShowSettings(s => !s)} className="p-2 hover:bg-slate-100 rounded-lg transition-colors"><SlidersHorizontal className="h-4 w-4 text-slate-500" /></button>
            <SettingsMenu isOpen={showSettings} onClose={() => setShowSettings(false)} onCollapseAll={collapseAll} onExpandAll={expandAll} />
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg transition-colors"><X className="h-4 w-4 text-slate-400" /></button>
        </div>
      </div>

      {isLinkMode && (
        <div style={{ padding: "10px 20px", backgroundColor: "#fffbeb", borderBottom: "1px solid #fcd34d", display: "flex", alignItems: "center", gap: 10 }}>
          <Zap size={15} color="#d97706" style={{ flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#b45309" }}>Live Link Mode</div>
            <div style={{ fontSize: 10, color: "#92400e", marginTop: 2 }}>
              Saves to DB and generates a shareable student URL. Results appear live in the class dashboard.
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto bg-slate-50/80 px-4 py-4">
        <div className="space-y-3 max-w-3xl mx-auto">
          {blocks.map((block, idx) => {
            const collapsed = collapsedState[block.id] || false
            const hasErr = !!errors[block.id]
            const qtype = qTypeConfig(block.type)
            return (
              <div key={block.id} className={`bg-white rounded-xl border shadow-sm transition-all ${hasErr ? "border-red-300 shadow-red-100" : "border-slate-200 hover:border-slate-300"}`}>
                <div className="flex items-start gap-2.5 px-4 pt-3.5 pb-2">
                  <div className={`flex-shrink-0 w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-black text-white mt-0.5 ${isLinkMode ? "bg-amber-500" : "bg-violet-600"}`}>{idx + 1}</div>
                  <button onClick={() => setCollapsed(p => ({ ...p, [block.id]: !p[block.id] }))} className="flex-shrink-0 p-1 hover:bg-slate-100 rounded-md transition-colors mt-0.5">
                    {collapsed ? <ChevronRight className="h-3.5 w-3.5 text-slate-400" /> : <ChevronDown className="h-3.5 w-3.5 text-slate-400" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    {collapsed ? (
                      <p className="text-xs text-slate-500 py-0.5 truncate">{block.mcqQuestion?.questionTitle?.replace(/<[^>]*>/g, "").trim() || <span className="italic text-slate-300">Empty question</span>}</p>
                    ) : (
                      <>
                        {!block.questionImage?.imageUrl && (
                          <label className="inline-flex items-center gap-1 text-[10px] text-slate-400 hover:text-violet-600 cursor-pointer transition-colors mb-1.5">
                            <Image className="h-2.5 w-2.5" /><span>Add image to question</span>
                            <input type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) uploadQuestionImage(block.id, f) }} />
                          </label>
                        )}
                        <input type="text" value={block.mcqQuestion?.questionTitle || ""} onChange={e => updateMcqQuestion(block.id, { questionTitle: e.target.value })} placeholder="Type your question here..." className="w-full text-sm font-medium outline-none border-b-2 border-slate-200 focus:border-violet-400 pb-1.5 mb-2" />
                        {block.questionImage?.imageUrl && (
                          <div className="mt-2 relative">
                            {isQImgActive(block.id) && <ImageToolbar alignment={block.questionImage.alignment || "center"} sizePercent={block.questionImage.sizePercent || 60} onAlignmentChange={(a: string) => updateBlock(block.id, { questionImage: { ...block.questionImage, alignment: a } })} onSizeChange={(v: number) => updateBlock(block.id, { questionImage: { ...block.questionImage, sizePercent: v } })} onRemove={() => { updateBlock(block.id, { questionImage: { imageUrl: "", alignment: "center", sizePercent: 60 } }); setActiveImgToolbar(null) }} onClose={() => setActiveImgToolbar(null)} />}
                            <div style={{ display: "flex", justifyContent: block.questionImage.alignment === "left" ? "flex-start" : block.questionImage.alignment === "right" ? "flex-end" : "center", marginTop: isQImgActive(block.id) ? 64 : 0 }}>
                              <div style={{ width: `${block.questionImage.sizePercent || 60}%` }} className="cursor-pointer" onClick={() => setActiveImgToolbar(isQImgActive(block.id) ? null : { type: "question", blockId: block.id })}>
                                <img src={block.questionImage.imageUrl} alt="" className={`w-full h-auto rounded-lg border-2 transition-all ${isQImgActive(block.id) ? "border-violet-400 ring-2 ring-violet-100" : "border-transparent hover:border-violet-200"}`} />
                              </div>
                            </div>
                          </div>
                        )}
                        {hasErr && errors[block.id]?.questionTitle && <div className="mt-2 flex items-center gap-1.5 text-xs text-red-600 bg-red-50 px-2.5 py-1.5 rounded-lg"><AlertCircle className="h-3.5 w-3.5" />{errors[block.id].questionTitle}</div>}
                        <div className="mt-2.5">
                          <label className="flex items-center gap-1.5 cursor-pointer">
                            <input type="checkbox" checked={block.hasExplanation} onChange={() => updateBlock(block.id, { hasExplanation: !block.hasExplanation })} className="w-3.5 h-3.5 rounded border-slate-300 accent-violet-600" />
                            <span className="text-[11px] text-slate-400 hover:text-violet-600 transition-colors flex items-center gap-1"><HelpCircle className="h-3 w-3" />Add explanation</span>
                          </label>
                          {block.hasExplanation && (
                            <div className="mt-1.5 ml-5 pl-3 border-l-2 border-violet-200">
                              <textarea value={block.explanation || ""} onChange={e => updateBlock(block.id, { explanation: e.target.value })} placeholder="Explain the correct answer…" className="w-full text-sm border border-slate-200 rounded-lg p-2 min-h-[80px] focus:outline-none focus:ring-2 focus:ring-violet-400" />
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                  <div className="relative flex-shrink-0">
                    <button onClick={() => setShowTypeMenu(showTypeMenu === block.id ? null : block.id)} className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-all ${qtype.bg} ${qtype.color} border-transparent hover:border-current/20`}>
                      {qtype.icon}<span className="max-w-[80px] truncate">{qtype.label}</span><ChevronDown className="h-3 w-3 opacity-60" />
                    </button>
                    {showTypeMenu === block.id && (
                      <div className="absolute top-full right-0 mt-1 w-48 bg-white rounded-xl shadow-2xl border border-slate-200 py-1.5 z-50">
                        <p className="px-3 py-1 text-[9px] font-bold text-slate-300 uppercase tracking-widest">Question Type</p>
                        {Object.entries(typeConfig).map(([t, cfg]) => (
                          <button key={t} onClick={() => { updateBlock(block.id, { type: t }); setShowTypeMenu(null) }} className={`w-full px-3 py-2 flex items-center gap-2 hover:bg-slate-50 text-xs ${block.type === t ? `${cfg.color} font-semibold` : "text-slate-700"}`}>
                            <span className={block.type === t ? cfg.color : "text-slate-400"}>{cfg.icon}</span>{cfg.label}{block.type === t && <Check className="h-3 w-3 ml-auto" />}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                {renderQuestionContent(block)}
                <div className="flex items-center justify-between px-4 py-2 border-t border-slate-100 bg-slate-50/50 rounded-b-xl">
                  <div className="flex items-center gap-0.5">
                    <button onClick={() => duplicateBlock(block.id)} className="p-1.5 hover:bg-white hover:shadow-sm rounded-lg text-slate-400 hover:text-slate-700 transition-all"><Copy className="h-3.5 w-3.5" /></button>
                    <button onClick={() => removeBlock(block.id)} className="p-1.5 hover:bg-red-50 rounded-lg text-slate-400 hover:text-red-500 transition-all"><Trash2 className="h-3.5 w-3.5" /></button>
                    <div className="w-px h-4 bg-slate-200 mx-1" />
                    <button onClick={() => moveBlock(block.id, "up")} disabled={idx === 0} className="p-1.5 hover:bg-white rounded-lg text-slate-400 hover:text-slate-700 disabled:opacity-25 disabled:cursor-not-allowed transition-all"><ChevronUp className="h-3.5 w-3.5" /></button>
                    <button onClick={() => moveBlock(block.id, "down")} disabled={idx === blocks.length - 1} className="p-1.5 hover:bg-white rounded-lg text-slate-400 hover:text-slate-700 disabled:opacity-25 disabled:cursor-not-allowed transition-all"><ChevronDown className="h-3.5 w-3.5" /></button>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <span className="text-[11px] font-semibold text-slate-500">Required</span>
                    <button type="button" onClick={() => updateBlock(block.id, { isRequired: !block.isRequired })} className={`relative rounded-full transition-colors ${block.isRequired ? "bg-violet-600" : "bg-slate-200"}`} style={{ width: 32, height: 18 }}>
                      <div className={`absolute top-0.5 h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform ${block.isRequired ? "translate-x-3.5" : "translate-x-0.5"}`} />
                    </button>
                  </label>
                </div>
              </div>
            )
          })}
        </div>
        <div className="max-w-3xl mx-auto mt-3">
          <button onClick={addBlock} className="w-full border-2 border-dashed border-slate-300 hover:border-violet-400 py-3.5 rounded-xl flex items-center justify-center gap-2 text-sm font-bold text-slate-500 hover:text-violet-700 hover:bg-violet-50 transition-all">
            <Plus className="h-5 w-5" />Add another question
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between px-5 py-3 border-t border-slate-200 bg-white flex-shrink-0">
        <span className="flex items-center gap-1.5 text-xs text-slate-500">
          <div className={`w-1.5 h-1.5 rounded-full ${isLinkMode ? "bg-amber-400" : "bg-emerald-400"}`} />
          {blocks.length} question{blocks.length !== 1 ? "s" : ""} ready
          {isLinkMode && <span className="ml-1 text-amber-600 font-semibold">· saves to DB & generates live link</span>}
        </span>
        <div className="flex items-center gap-2">
          <button onClick={onClose} className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-lg text-xs font-semibold transition-all">Cancel</button>
          <button onClick={handleSave} disabled={isSaving} className={`px-5 py-2 rounded-lg text-xs font-bold text-white flex items-center gap-1.5 disabled:opacity-50 shadow-sm transition-all ${isLinkMode ? "bg-amber-500 hover:bg-amber-600" : "bg-emerald-600 hover:bg-emerald-700"}`}>
            {isSaving ? <><Loader className="h-3.5 w-3.5 animate-spin" />Saving…</> : isLinkMode ? <><Share2 className="h-3.5 w-3.5" />Save & Generate Link</> : <><Save className="h-3.5 w-3.5" />Save Questions</>}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── PDF VIEWER PROPS ─────────────────────────────────────────────────────────
interface PDFViewerProps {
  fileUrl: string | { base: string }
  fileName: string
  fileId?: string
  entityType?: string
  entityId?: string
  institution?: string
  courses?: string
  tabType?: string
  subcategory?: string
  folderPath?: string[]
  apiBaseUrl?: string
  onClose: () => void
  initialMcqs?: any[]
  isTeacher?: boolean
  isStudent?: boolean
  sampleLiveLink?: string
  breadcrumbs?: BreadcrumbItem[]  // ← ADD THIS
  onNavigateToCourse?: () => void   // ← ADD THIS (optional)
}

// ─── PDF VIEWER (MAIN) ────────────────────────────────────────────────────────
// Add this interface at the top of pdfview.tsx (after the existing imports)
interface BreadcrumbItem {
  id: string;
  type: string;
  label: string;
  path?: string;
  onClick?: () => void;
}

// Update the PDFViewerProps interface to include breadcrumbs
interface PDFViewerProps {
  fileUrl: string | { base: string }
  fileName: string
  fileId?: string
  entityType?: string
  entityId?: string
  institution?: string
  courses?: string
  tabType?: string
  subcategory?: string
  folderPath?: string[]
  apiBaseUrl?: string
  onClose: () => void
  initialMcqs?: any[]
  isTeacher?: boolean
  isStudent?: boolean
  sampleLiveLink?: string
  breadcrumbs?: BreadcrumbItem[]  // ← ADD THIS
  onNavigateToCourse?: () => void   // ← ADD THIS (optional)
}

// Update the component props
export default function PDFViewer({
  fileUrl, fileName,
  fileId = "", entityType = "", entityId = "",
  institution = "", courses = "",
  tabType = "", subcategory = "",
  folderPath = [],
  apiBaseUrl = "https://lmsserver-yeve.onrender.com",
  onClose,
  initialMcqs = [],
  isTeacher = true,
  isStudent = false,
  sampleLiveLink,
  breadcrumbs = [],  // ← ADD THIS with default empty array
  onNavigateToCourse,  // ← ADD THIS
}: PDFViewerProps) {
  // ... rest of your existing state declarations
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [pdfDoc, setPdfDoc] = useState<any>(null)
  const [totalPages, setTotalPages] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [scale, setScale] = useState(1.4)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [pageDims, setPageDims] = useState<{ width: number; height: number } | null>(null)

  const containerRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const pageRefs = useRef<(HTMLDivElement | null)[]>([])

  const [savedMcqs, setSavedMcqs] = useState<any[]>(initialMcqs || [])
  const [showMcqForm, setShowMcqForm] = useState(false)
  const [mcqPageNumber, setMcqPageNumber] = useState(1)
  const [showAnnotationModal, setShowAnnotationModal] = useState(false)
  const [annotationModalPage, setAnnotationModalPage] = useState(0)
  const [mcqMode, setMcqMode] = useState<"default" | "link">("default")
  const [showMcqList, setShowMcqList] = useState(false)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; pageNumber: number } | null>(null)
  const [generatedLinkData, setGeneratedLinkData] = useState<{ link: string; pageNumber: number; questionCount: number } | null>(null)
  const [activeLinks, setActiveLinks] = useState<ActiveLink[]>([])
  const [showStatsModal, setShowStatsModal] = useState(false)

  const liveQuestionIds = activeLinks.map(l => l.liveQuestionId).filter(Boolean)
  const { students, connected, fetchSnapshot } = useLiveStats(
    liveQuestionIds,
    apiBaseUrl,
    isTeacher && !isStudent && liveQuestionIds.length > 0
  )

  useEffect(() => {
    liveQuestionIds.forEach(id => fetchSnapshot(id))
  }, [liveQuestionIds.join(","), fetchSnapshot])

  const getMcqPage = (q: any): number => {
    const raw = q.videoTimestamp ?? q.pageNumber ?? q.timestamp ?? 0
    return typeof raw === "number" ? Math.round(raw) : parseInt(String(raw)) || 0
  }


  // Add this helper function inside PDFViewer component (after state declarations)
const handleBreadcrumbClick = (crumb: BreadcrumbItem) => {
  if (crumb.onClick) {
    crumb.onClick();
  } else if (crumb.type === "course" && onNavigateToCourse) {
    onNavigateToCourse();
  }
};

  const mcqsByPage = React.useMemo(() => {
    const map = new Map<number, any[]>()
    savedMcqs.forEach(mcq => { const page = getMcqPage(mcq); if (!map.has(page)) map.set(page, []); map.get(page)!.push(mcq) })
    return map
  }, [savedMcqs])

  const pagesWithMcqs = new Set(Array.from(mcqsByPage.keys()))

  const normalizedUrl = React.useMemo(() => {
    if (!fileUrl) return ""
    if (typeof fileUrl === "string") return fileUrl
    if (typeof fileUrl === "object" && (fileUrl as any).base) return (fileUrl as any).base
    if (typeof fileUrl === "object") return (Object.values(fileUrl).find(v => typeof v === "string" && (v as string).startsWith("http")) as string) || ""
    return ""
  }, [fileUrl])

  useEffect(() => {
    if (!normalizedUrl) return
    let cancelled = false
    setIsLoading(true); setLoadError(null); setPdfDoc(null); setTotalPages(0)
    const load = async () => {
      try {
        if (!(window as any).pdfjsLib) {
          await new Promise<void>((res, rej) => {
            const s = document.createElement("script")
            s.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"
            s.onload = () => res(); s.onerror = () => rej(new Error("pdf.js CDN unavailable"))
            document.head.appendChild(s)
          })
        }
        const lib = (window as any).pdfjsLib
        lib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js"
        const doc = await lib.getDocument({ url: normalizedUrl, withCredentials: false }).promise
        if (cancelled) return
        setPdfDoc(doc); setTotalPages(doc.numPages); setCurrentPage(1)
        pageRefs.current = new Array(doc.numPages).fill(null)
        setIsLoading(false)
      } catch (e: any) { if (!cancelled) { setLoadError(e?.message || "Failed to load"); setIsLoading(false) } }
    }
    load()
    return () => { cancelled = true }
  }, [normalizedUrl])

  // Measure page 1 at the current scale — pre-sizes lazy page placeholders so scroll geometry stays correct
  useEffect(() => {
    if (!pdfDoc) return
    let cancelled = false
    pdfDoc.getPage(1).then((page: any) => {
      if (cancelled) return
      const vp = page.getViewport({ scale })
      setPageDims({ width: Math.floor(vp.width), height: Math.floor(vp.height) })
    }).catch(() => {})
    return () => { cancelled = true }
  }, [pdfDoc, scale])

  useEffect(() => {
    if (!pdfDoc || totalPages === 0) return
    const observer = new IntersectionObserver(
      entries => {
        let best = entries[0]
        entries.forEach(e => { if (e.intersectionRatio > (best?.intersectionRatio ?? 0)) best = e })
        if (best?.isIntersecting) { const pg = parseInt((best.target as HTMLElement).dataset.page || "1"); if (!isNaN(pg)) setCurrentPage(pg) }
      },
      { root: scrollRef.current, threshold: Array.from({ length: 11 }, (_, i) => i / 10) }
    )
    pageRefs.current.forEach(el => { if (el) observer.observe(el) })
    return () => observer.disconnect()
  }, [pdfDoc, totalPages, scale])

  const openMcqForm = (page: number, mode: "default" | "link" = "default") => {
    setMcqPageNumber(page); setMcqMode(mode); setShowMcqForm(true)
  }
  const handleCanvasContextMenu = (e: React.MouseEvent, pageNum: number) => {
    e.preventDefault(); if (isStudent || !isTeacher) return
    setContextMenu({ x: e.clientX, y: e.clientY, pageNumber: pageNum })
  }
  const handleCanvasClick = (e: React.MouseEvent, pageNum: number) => {
    if (isStudent || !isTeacher) return
    if (e.ctrlKey || e.metaKey) { e.preventDefault(); openMcqForm(pageNum, "default") }
  }
  const scrollToPage = (p: number) => {
    const next = Math.max(1, Math.min(totalPages || 1, p))
    const el = pageRefs.current[next - 1]
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" }); else setCurrentPage(next)
  }

  const handleMcqSave = (questions: any[]) => {
    setSavedMcqs(prev => [...prev, ...questions.map(q => ({ ...q, savedAt: new Date() }))])
    if (mcqMode !== "link") setShowMcqForm(false)
  }

  const handleLinkGenerated = (link: string, questionCount: number, liveQuestionId: string) => {
    const newLink: ActiveLink = {
      link, liveQuestionId,
      pageNumber: mcqPageNumber,
      questionCount,
      createdAt: new Date(),
      label: `Page ${mcqPageNumber} · ${questionCount}Q`,
    }
    setActiveLinks(prev => [...prev, newLink])
    setGeneratedLinkData({ link, pageNumber: mcqPageNumber, questionCount })
    setShowMcqForm(false)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (showMcqForm || generatedLinkData || showStatsModal) return
      if (e.key === "Escape" && isFullscreen) document.exitFullscreen?.()
      if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); scrollToPage(currentPage + 1) }
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); scrollToPage(currentPage - 1) }
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [currentPage, totalPages, isFullscreen, showMcqForm, generatedLinkData, showStatsModal])

  useEffect(() => {
    const fn = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener("fullscreenchange", fn)
    return () => document.removeEventListener("fullscreenchange", fn)
  }, [])

  const handleDownload = () => {
    if (!normalizedUrl) return
    const a = document.createElement("a"); a.href = normalizedUrl; a.download = fileName; a.target = "_blank"
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
  }

  const mcqsOnCurrentPage = mcqsByPage.get(currentPage) || []

  return (
    <div ref={containerRef} style={{ position: "fixed", inset: 0, backgroundColor: "#111827", zIndex: isFullscreen ? 2000 : 1000, display: "flex", flexDirection: "column" }}>

   {!isFullscreen && (
  <div style={{ 
    backgroundColor: "#ffffff",  // White background
    borderBottom: "1px solid #e2e8f0",
    flexShrink: 0,
    position: "relative",
    zIndex: 10,
  }}>
    
    {/* Breadcrumb row with close button */}
    {breadcrumbs && breadcrumbs.length > 0 && (
      <div style={{
        padding: "10px 14px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",  // Space between breadcrumbs and close button
        gap: "12px",
        borderBottom: "1px solid #f1f5f9",
      }}>
        {/* Breadcrumbs - left side */}
        <div style={{ 
          display: "flex", 
          alignItems: "center", 
          gap: "4px", 
          flexWrap: "wrap",
          flex: 1,
        }}>
          {breadcrumbs.map((crumb, idx) => (
            <div key={crumb.id} style={{ display: "flex", alignItems: "center", gap: "4px" }}>
              {idx > 0 && (
                <ChevronRight 
                  size={12} 
                  style={{ color: "#cbd5e1", flexShrink: 0 }} 
                />
              )}
              <button
                onClick={() => handleBreadcrumbClick(crumb)}
                disabled={idx === breadcrumbs.length - 1}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "4px 8px",
                  borderRadius: "6px",
                  fontSize: "11px",
                  fontWeight: idx === breadcrumbs.length - 1 ? 700 : 500,
                  color: idx === breadcrumbs.length - 1 ? "#1e293b" : "#64748b",
                  backgroundColor: idx === breadcrumbs.length - 1 ? "#f8fafc" : "transparent",
                  border: "none",
                  cursor: idx === breadcrumbs.length - 1 ? "default" : "pointer",
                  transition: "all 0.2s ease",
                  fontFamily: "'Poppins', system-ui, -apple-system, sans-serif",
                }}
                onMouseEnter={(e) => {
                  if (idx !== breadcrumbs.length - 1) {
                    e.currentTarget.style.backgroundColor = "#f1f5f9";
                    e.currentTarget.style.color = "#fb923c";
                  }
                }}
                onMouseLeave={(e) => {
                  if (idx !== breadcrumbs.length - 1) {
                    e.currentTarget.style.backgroundColor = "transparent";
                    e.currentTarget.style.color = "#64748b";
                  }
                }}
              >
                {/* Icon based on crumb type */}
                {crumb.type === "dashboard" && <LayoutDashboard size={12} style={{ flexShrink: 0 }} />}
                {crumb.type === "courses" && <BookMarked size={12} style={{ flexShrink: 0 }} />}
                {crumb.type === "course" && <GraduationCap size={12} style={{ flexShrink: 0, color: "#f27757" }} />}
                {crumb.type === "module" && <Layers size={12} style={{ flexShrink: 0 }} />}
                {crumb.type === "submodule" && <Layers size={12} style={{ flexShrink: 0 }} />}
                {crumb.type === "topic" && <BookOpen size={12} style={{ flexShrink: 0 }} />}
                {crumb.type === "subtopic" && <FileText size={12} style={{ flexShrink: 0 }} />}
                
                {/* Label */}
                <span style={{ 
                  maxWidth: "180px", 
                  overflow: "hidden", 
                  textOverflow: "ellipsis", 
                  whiteSpace: "nowrap" 
                }}>
                  {crumb.label}
                </span>
              </button>
            </div>
          ))}
        </div>

        {/* Close button - RIGHT CORNER of breadcrumb */}
        <button 
          onClick={onClose} 
          style={{ 
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "6px",
            padding: "6px 12px",
            backgroundColor: "#dc2626",  // Red background
            color: "white",              // White X
            border: "none", 
            borderRadius: "8px", 
            cursor: "pointer", 
            transition: "all 0.2s ease",
            fontWeight: 600,
            flexShrink: 0,
            fontSize: "12px",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "#b91c1c";  // Darker red on hover
            e.currentTarget.style.transform = "scale(0.98)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "#dc2626";
            e.currentTarget.style.transform = "scale(1)";
          }}
        >
          <X size={14} strokeWidth={2.5} />
          <span>Close</span>
        </button>
      </div>
    )}

    {/* Main header bar with file info and controls (without close button) */}
    <div style={{
      padding: "10px 14px",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
      flexWrap: "wrap",
      minHeight: 48,
      backgroundColor: "#ffffff",
    }}>
      {/* Left side - File info */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, flex: 1 }}>
        <FileText size={15} style={{ flexShrink: 0, color: "#a78bfa" }} />
        <span style={{ 
          fontSize: 13, 
          fontWeight: 600, 
          color: "#1e293b",
          maxWidth: 220, 
          overflow: "hidden", 
          textOverflow: "ellipsis", 
          whiteSpace: "nowrap" 
        }} title={fileName}>
          {fileName}
        </span>
        {!isStudent && isTeacher && (
          <span style={{ 
            fontSize: 10, 
            backgroundColor: "#7c3aed", 
            padding: "2px 8px", 
            borderRadius: 999, 
            color: "white", 
            fontWeight: 600,
            marginLeft: 4,
          }}>
            Teacher Mode
          </span>
        )}
      </div>

      {/* Right side - Controls (without close button) */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        {/* Page navigation */}
        <div style={{ 
          display: "flex", 
          alignItems: "center", 
          gap: 4, 
          backgroundColor: "#f8fafc", 
          borderRadius: 8, 
          padding: "4px 8px", 
          border: "1px solid #e2e8f0" 
        }}>
          <button 
            onClick={() => scrollToPage(currentPage - 1)} 
            disabled={currentPage <= 1 || isLoading} 
            style={{ 
              background: "none", 
              border: "none", 
              color: currentPage <= 1 ? "#cbd5e1" : "#64748b", 
              cursor: currentPage <= 1 ? "not-allowed" : "pointer", 
              padding: 2, 
              display: "flex",
              transition: "color 0.2s",
            }}
          >
            <ChevronLeft size={14} />
          </button>
          
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            {pagesWithMcqs.has(currentPage) && (
              <div style={{ 
                width: 6, 
                height: 6, 
                borderRadius: "50%", 
                backgroundColor: "#a78bfa",
                animation: "pulse 2s infinite",
              }} />
            )}
            <span style={{ fontSize: 11, color: "#64748b" }}>Page</span>
            <span style={{ 
              minWidth: 32, 
              padding: "2px 6px", 
              backgroundColor: "#ffffff", 
              border: "1px solid #e2e8f0", 
              borderRadius: 6, 
              color: "#1e293b", 
              fontSize: 12, 
              fontWeight: 600, 
              textAlign: "center" 
            }}>
              {currentPage}
            </span>
            {totalPages > 0 && (
              <span style={{ fontSize: 11, color: "#94a3b8" }}>/ {totalPages}</span>
            )}
          </div>
          
          <button 
            onClick={() => scrollToPage(currentPage + 1)} 
            disabled={currentPage >= totalPages || isLoading} 
            style={{ 
              background: "none", 
              border: "none", 
              color: currentPage >= totalPages ? "#cbd5e1" : "#64748b", 
              cursor: currentPage >= totalPages ? "not-allowed" : "pointer", 
              padding: 2, 
              display: "flex",
              transition: "color 0.2s",
            }}
          >
            <ChevronRight size={14} />
          </button>
        </div>

        {/* Zoom controls */}
        <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
          <button 
            onClick={() => setScale(z => Math.max(0.5, +(z - 0.25).toFixed(2)))} 
            style={{ 
              padding: "5px 8px", 
              backgroundColor: "#f8fafc", 
              color: "#64748b", 
              border: "1px solid #e2e8f0", 
              borderRadius: 6, 
              cursor: "pointer", 
              display: "flex",
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "#f1f5f9";
              e.currentTarget.style.borderColor = "#cbd5e1";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "#f8fafc";
              e.currentTarget.style.borderColor = "#e2e8f0";
            }}
          >
            <ZoomOut size={13} />
          </button>
          
          <span style={{ 
            fontSize: 11, 
            color: "#64748b", 
            minWidth: 38, 
            textAlign: "center",
            fontWeight: 500,
          }}>
            {Math.round(scale * 100)}%
          </span>
          
          <button 
            onClick={() => setScale(z => Math.min(3, +(z + 0.25).toFixed(2)))} 
            style={{ 
              padding: "5px 8px", 
              backgroundColor: "#f8fafc", 
              color: "#64748b", 
              border: "1px solid #e2e8f0", 
              borderRadius: 6, 
              cursor: "pointer", 
              display: "flex",
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "#f1f5f9";
              e.currentTarget.style.borderColor = "#cbd5e1";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "#f8fafc";
              e.currentTarget.style.borderColor = "#e2e8f0";
            }}
          >
            <ZoomIn size={13} />
          </button>
        </div>

        {/* Fullscreen button */}
        <button 
          onClick={() => { 
            if (!isFullscreen) containerRef.current?.requestFullscreen?.(); 
            else document.exitFullscreen?.(); 
          }} 
          style={{ 
            padding: "5px 8px", 
            backgroundColor: "#f8fafc", 
            color: "#64748b", 
            border: "1px solid #e2e8f0", 
            borderRadius: 6, 
            cursor: "pointer", 
            display: "flex",
            transition: "all 0.2s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "#f1f5f9";
            e.currentTarget.style.borderColor = "#cbd5e1";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "#f8fafc";
            e.currentTarget.style.borderColor = "#e2e8f0";
          }}
        >
          {isFullscreen ? <Minimize size={13} /> : <Maximize size={13} />}
        </button>

        {/* Download button */}
        <button 
          onClick={handleDownload} 
          style={{ 
            padding: "5px 8px", 
            backgroundColor: "#f8fafc", 
            color: "#64748b", 
            border: "1px solid #e2e8f0", 
            borderRadius: 6, 
            cursor: "pointer", 
            display: "flex",
            transition: "all 0.2s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "#f1f5f9";
            e.currentTarget.style.borderColor = "#cbd5e1";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "#f8fafc";
            e.currentTarget.style.borderColor = "#e2e8f0";
          }}
        >
          <Download size={13} />
        </button>
      </div>
    </div>
  </div>
)}

      {!isStudent && isTeacher && activeLinks.length > 0 && !showStatsModal && (
        <div style={{ position: "absolute", top: 54, right: 16, zIndex: 50 }}>
          <ActiveLinksCorner activeLinks={activeLinks} students={students} onClick={() => setShowStatsModal(true)} />
        </div>
      )}

      <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
        <div ref={scrollRef} style={{ width: "100%", height: "100%", overflowY: "auto", overflowX: "auto", backgroundColor: "#374151", display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "16px 0 24px" }}>
          {isLoading && (
            <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", color: "white", textAlign: "center" }}>
              <div style={{ width: 40, height: 40, border: "3px solid rgba(255,255,255,0.15)", borderTop: "3px solid #a78bfa", borderRadius: "50%", animation: "pdfSpin 0.8s linear infinite", margin: "0 auto 12px" }} />
              <p style={{ fontSize: 13, color: "#9ca3af", margin: 0 }}>Loading PDF…</p>
            </div>
          )}
          {loadError && !isLoading && (
            <div style={{ color: "white", textAlign: "center", padding: 40 }}>
              <FileText size={44} style={{ color: "#ef4444", margin: "0 auto 12px", display: "block" }} />
              <p style={{ margin: "0 0 8px", fontWeight: 700 }}>Could not load PDF</p>
              <p style={{ color: "#9ca3af", fontSize: 12, marginBottom: 16 }}>{loadError}</p>
              <button onClick={handleDownload} style={{ padding: "8px 18px", backgroundColor: "#7c3aed", color: "white", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600 }}>Download instead</button>
            </div>
          )}
          {/* {!isStudent && isTeacher && !isLoading && pdfDoc && (
            <div style={{ position: "sticky", top: 10, zIndex: 10, backgroundColor: "rgba(0,0,0,0.7)", color: "#9ca3af", fontSize: 10, padding: "6px 12px", borderRadius: 20, border: "1px solid #374151", display: "flex", alignItems: "center", gap: 6, marginBottom: 10, pointerEvents: "none" }}>
              <MousePointer size={10} color="#a78bfa" />
              Right-click: <span style={{ color: "#a78bfa" }}>Add MCQ</span> or <span style={{ color: "#f59e0b" }}>Live Add MCQ</span>
            </div>
          )} */}
          {pdfDoc && Array.from({ length: totalPages }, (_, i) => i + 1).map(pg => {
            const mcqsOnPage = mcqsByPage.get(pg) || []
            return (
              <div key={pg} data-page={pg} ref={el => { pageRefs.current[pg - 1] = el }} style={{ position: "relative", flexShrink: 0 }}>
                <PdfPageCanvas pdfDoc={pdfDoc} pageNum={pg} scale={scale} placeholderDims={pageDims}
                  onContextMenu={!isStudent && isTeacher ? handleCanvasContextMenu : undefined}
                  onClick={!isStudent && isTeacher ? handleCanvasClick : undefined}
                  showMcqMarker={mcqsOnPage.length > 0} mcqCount={mcqsOnPage.length} />
                <div style={{ position: "absolute", bottom: 8, right: 8, backgroundColor: "rgba(0,0,0,0.55)", color: "rgba(255,255,255,0.7)", fontSize: 10, fontWeight: 600, padding: "2px 7px", borderRadius: 99, pointerEvents: "none" }}>{pg}</div>
                {!isStudent && isTeacher && (
                  <button
                    onClick={e => { e.stopPropagation(); setAnnotationModalPage(pg); setShowAnnotationModal(true) }}
                    style={{
                      position: "absolute", top: 8, right: 8,
                      padding: "4px 10px",
                      backgroundColor: mcqsOnPage.length > 0 ? "rgba(242,119,87,0.88)" : "rgba(124,58,237,0.82)",
                      color: "white", border: "none", borderRadius: 6,
                      cursor: "pointer", fontSize: 11, fontWeight: 700,
                      display: "flex", alignItems: "center", gap: 4,
                      zIndex: 5, backdropFilter: "blur(4px)",
                      boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
                    }}
                  >
                    {mcqsOnPage.length > 0 ? `✏ Edit MCQ (${mcqsOnPage.length})` : "+ Add MCQ"}
                  </button>
                )}
              </div>
            )
          })}
        </div>

        {showMcqList && savedMcqs.length > 0 && (
          <div style={{ position: "absolute", top: 0, right: 0, bottom: 0, width: 290, backgroundColor: "#1f2937", borderLeft: "1px solid #374151", display: "flex", flexDirection: "column", zIndex: 20 }}>
            <div style={{ padding: "10px 14px", borderBottom: "1px solid #374151", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ color: "white", fontWeight: 600, fontSize: 13 }}>All MCQs ({savedMcqs.length})</span>
              <button onClick={() => setShowMcqList(false)} style={{ background: "none", border: "none", color: "#6b7280", cursor: "pointer", padding: 2 }}><X size={15} /></button>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: 8 }}>
              {savedMcqs.map((mcq, i) => {
                const page = getMcqPage(mcq)
                const isLink = mcq.type === "link"
                return (
                  <div key={mcq.id + i} onClick={() => scrollToPage(page)} style={{ padding: 10, borderRadius: 7, border: `1px solid ${page === currentPage ? "#7c3aed" : "#374151"}`, marginBottom: 6, backgroundColor: page === currentPage ? "rgba(124,58,237,0.1)" : "#111827", cursor: "pointer" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 4 }}>
                      <Hash size={11} color="#a78bfa" />
                      <span style={{ fontSize: 11, color: "#a78bfa", fontWeight: 700 }}>Page {page}</span>
                      <span style={{ fontSize: 9, padding: "1px 5px", borderRadius: 3, fontWeight: 700, backgroundColor: isLink ? "rgba(245,158,11,0.2)" : "rgba(124,58,237,0.2)", color: isLink ? "#f59e0b" : "#a78bfa" }}>{isLink ? "live link" : "default"}</span>
                      {page === currentPage && <span style={{ marginLeft: "auto", fontSize: 9, backgroundColor: "#7c3aed", color: "white", padding: "1px 5px", borderRadius: 3 }}>current</span>}
                    </div>
                    <p style={{ fontSize: 12, color: "#e5e7eb", fontWeight: 500, margin: "0 0 4px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{mcq.questionTitle?.replace(/<[^>]*>/g, "").trim() || "Untitled"}</p>
                    {isLink && mcq.link && (
                      <p style={{ fontSize: 9, color: "#f59e0b", margin: "2px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>🔗 {mcq.link}</p>
                    )}
                    <p style={{ fontSize: 9, color: "#4b5563", margin: "4px 0 0" }}>Click to jump to page</p>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {!isStudent && isTeacher && (
          <FloatingStatsButton students={students} connected={connected} activeLinks={activeLinks} onClick={() => setShowStatsModal(true)} />
        )}
      </div>

      {contextMenu && !isStudent && isTeacher && (
        <ContextMenu x={contextMenu.x} y={contextMenu.y} pageNumber={contextMenu.pageNumber}
          onAddMcq={page => { openMcqForm(page, "default"); setContextMenu(null) }}
          onLiveAddMcq={page => { openMcqForm(page, "link"); setContextMenu(null) }}
          onClose={() => setContextMenu(null)} />
      )}

      {isFullscreen && (
        <button onClick={() => document.exitFullscreen?.()} style={{ position: "fixed", top: 16, right: 16, zIndex: 2100, padding: "7px 14px", backgroundColor: "rgba(0,0,0,0.7)", color: "white", border: "1px solid #374151", borderRadius: 7, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
          <Minimize size={15} /> Exit Fullscreen
        </button>
      )}

      {showMcqForm && (
        <MCQQuestionForm
          initialPageNumber={mcqPageNumber}
          onClose={() => setShowMcqForm(false)}
          onSave={handleMcqSave}
          onLinkGenerated={handleLinkGenerated}
          institution={institution}
          courses={courses}
          structureType={entityId}
          tabType={tabType}
          subcategory={subcategory}
          fileName={fileName}
          apiBaseUrl={apiBaseUrl}
          mcqMode={mcqMode}
        />
      )}

      {generatedLinkData && (
        <GeneratedLinkPopup
          link={generatedLinkData.link}
          pageNumber={generatedLinkData.pageNumber}
          questionCount={generatedLinkData.questionCount}
          fileName={fileName}
          onClose={() => setGeneratedLinkData(null)}
        />
      )}

      {showStatsModal && (
        <LiveStatsModal
          students={students}
          connected={connected}
          activeLinks={activeLinks}
          onClose={() => setShowStatsModal(false)}
        />
      )}

      {showAnnotationModal && !isStudent && isTeacher && (
        <FileMCQAnnotationForm
          positionValue={annotationModalPage}
          positionLabel={`Page ${annotationModalPage}`}
          positionField="pageNumber"
          entityType={entityType}
          entityId={entityId}
          tabType={tabType}
          subcategory={subcategory}
          folderPath={folderPath}
          fileId={fileId}
          apiBaseUrl={apiBaseUrl}
          initialQuestions={mcqsByPage.get(annotationModalPage) || []}
          onQuestionsChanged={updatedQs => {
            setSavedMcqs(prev => {
              const others = prev.filter(q => getMcqPage(q) !== annotationModalPage)
              return [...others, ...updatedQs]
            })
          }}
          onClose={() => setShowAnnotationModal(false)}
        />
      )}

      <style>{`
        @keyframes pdfSpin { to { transform: rotate(360deg) } }
        @keyframes ctxFade { from { opacity: 0; transform: scale(0.95) } to { opacity: 1; transform: scale(1) } }
        @keyframes fadeSlideIn { from { opacity: 0; transform: translateY(8px) } to { opacity: 1; transform: translateY(0) } }
        @keyframes slideDown { from { opacity: 0; transform: translateY(-8px) } to { opacity: 1; transform: translateY(0) } }
        @keyframes livePulse { 0%, 100% { opacity: 1; transform: scale(1) } 50% { opacity: 0.5; transform: scale(1.4) } }
      `}</style>
    </div>
  )
}