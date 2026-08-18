"use client";
import React, {
  useState,
  useRef,
  useCallback,
  useEffect,
} from "react";
import {
  X,
  Upload,
  FileText,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Download,
  Loader2,
  CheckSquare,
  Square,
  Eye,
  EyeOff,
  AlertTriangle,
  RefreshCw,
  ArrowRight,
  Info,
  Trash2,
  FileJson,
  Sheet,
  AlignLeft,
} from "lucide-react";
import { bulkUploadApi } from "../../../apiServices/bulkUploadApi";

// ─── Design tokens (match ProblemSolving / MCQQuestionForm) ───────────────────
const JKT: React.CSSProperties = {
  fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, sans-serif",
};
const OR = "#F27757"; // brand orange
const OR_LIGHT = "rgba(242,119,87,0.08)";
const OR_BORDER = "rgba(242,119,87,0.25)";

// ─── Types ────────────────────────────────────────────────────────────────────

interface MCQOption {
  text: string;
  isCorrect: boolean;
  imageUrl?: string | null;
  imageAlignment?: string;
  imageSizePercent?: number;
}

interface ParsedQuestion {
  _previewId: string;
  mcqQuestionTitle: string | Array<{ type: string; value?: string; id?: string }>; // ← union type
  mcqQuestionType: string;
  mcqQuestionDifficulty: string;
  mcqQuestionScore?: number;
  mcqQuestionOptions: MCQOption[];
  mcqQuestionCorrectAnswers: string[];
  mcqQuestionRequired: boolean;
  hasExplanation: boolean;
  mcqQuestionDescription?: string;
  mcqQuestionOptionsPerRow: number;
  isActive: boolean;
  questionType: "mcq";
}

interface InvalidRow {
  rowIndex: number;
  reason: string;
  raw: Record<string, unknown>;
}

interface ExerciseCapacity {
  scoringType: string;
  totalAllowed?: number;
  currentCount?: number;
  remaining?: number;
  marksPerQuestion?: number;
  maxMarks?: number;
  usedMarks?: number;
  remainingMarks?: number;
}

interface ParseResult {
  valid: ParsedQuestion[];
  invalid: InvalidRow[];
  summary: { total: number; valid: number; invalid: number };
  exerciseCapacity: ExerciseCapacity | null;
  storage: { url: string; path: string } | null;
}

interface Props {
  exerciseData: {
    exerciseId: string;
    exerciseName: string;
    exerciseLevel: string;
    nodeId: string;
    nodeName?: string;
    nodeType: string;
    subcategory: string;
    fullExerciseData?: Record<string, unknown>;
  };
  tabType: "I_Do" | "We_Do" | "You_Do";
  onClose: () => void;
  onInserted: (count: number) => void;
  breadcrumbs?: Array<{ name: string; type: string }>;
  // Custom-mix narrowing: remaining MANUAL quota slice (document imports are
  // stamped 'scratch-manual'). When set, it further caps the server-computed
  // overall capacity so a bulk upload can't blow past the Manual allocation.
  sliceRemaining?: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DIFF_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  easy:   { bg: "#f0fdf4", text: "#16a34a", dot: "#22c55e" },
  medium: { bg: "#fffbeb", text: "#d97706", dot: "#f59e0b" },
  hard:   { bg: "#fff1f2", text: "#e11d48", dot: "#f43f5e" },
};

const TYPE_LABELS: Record<string, string> = {
  multiple_choice: "Multiple Choice",
  multiple_select: "Multiple Select",
  true_false:      "True / False",
  short_answer:    "Short Answer",
  essay:           "Essay",
  dropdown:        "Dropdown",
  matching:        "Matching",
  ordering:        "Ordering",
  numeric:         "Numeric",
};



function extractTitleText(title: ParsedQuestion["mcqQuestionTitle"]): string {
  if (typeof title === "string") return title;
  if (Array.isArray(title)) {
    return title
      .filter((cb) => cb.type === "text")
      .map((cb) => (cb.value || "").replace(/<[^>]*>/g, "").trim())
      .filter(Boolean)
      .join(" ");
  }
  return "";
}

function hasCodeBlock(title: ParsedQuestion["mcqQuestionTitle"]): boolean {
  if (!Array.isArray(title)) return false;
  return title.some((cb) => cb.type === "code");
}



function getEntityType(nodeType: string): string {
  const m: Record<string, string> = {
    module: "modules", modules: "modules",
    submodule: "submodules", submodules: "submodules",
    topic: "topics", topics: "topics",
    subtopic: "subtopics", subtopics: "subtopics",
  };
  return m[nodeType?.toLowerCase()?.trim()] || "topics";
}

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Compact question card shown in the preview list */
const QuestionCard: React.FC<{
  q: ParsedQuestion;
  index: number;
  selected: boolean;
  onToggle: () => void;
  capacityError?: string;
}> = ({ q, index, selected, onToggle, capacityError }) => {
  const [expanded, setExpanded] = useState(false);
  const diff = DIFF_COLORS[q.mcqQuestionDifficulty] || DIFF_COLORS.medium;
  const isOptionBased = ["multiple_choice","multiple_select","dropdown"].includes(q.mcqQuestionType);
  const hasCorrect = q.mcqQuestionOptions.some((o) => o.isCorrect);
  const hasEnoughOptions = q.mcqQuestionOptions.length >= 2;




const titleText = extractTitleText(q.mcqQuestionTitle);
const showsCode = hasCodeBlock(q.mcqQuestionTitle);

const isValid = isOptionBased
  ? Boolean(titleText) && hasEnoughOptions && hasCorrect
  : Boolean(titleText);

  return (
    <div
      style={{
        ...JKT,
        border: `1.5px solid ${selected ? OR : (capacityError ? "#fecdd3" : "#e4e4ed")}`,
        borderRadius: 12,
        background: selected ? OR_LIGHT : (capacityError ? "#fff5f5" : "#fafafa"),
        transition: "all 0.15s",
        opacity: capacityError ? 0.6 : 1,
      }}
    >
      {/* Row */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 12px" }}>
        {/* Checkbox */}
        <button
          onClick={onToggle}
          disabled={!isValid || Boolean(capacityError)}
          style={{
            background: "none",
            border: "none",
            cursor: isValid && !capacityError ? "pointer" : "not-allowed",
            padding: 0,
            flexShrink: 0,
            marginTop: 2,
            color: selected ? OR : (isValid ? "#bcbccc" : "#e4e4ed"),
          }}
        >
          {selected ? (
            <CheckSquare size={16} />
          ) : (
            <Square size={16} />
          )}
        </button>

        {/* Number */}
        <span
          style={{
            ...JKT,
            fontSize: 11,
            fontWeight: 700,
            color: selected ? OR : "#bcbccc",
            flexShrink: 0,
            minWidth: 20,
            marginTop: 1,
          }}
        >
          {index + 1}
        </span>

        {/* Title + badges */}
        <div style={{ flex: 1, minWidth: 0 }}>
               <p style={{ ...JKT, fontSize: 13, fontWeight: 600, color: "#1a1a2e", margin: 0, lineHeight: 1.4 }}>
            {titleText || <em style={{ color: "#bcbccc" }}>Untitled</em>} {/* ← use titleText */}
          </p>

          {/* Code block indicator */}
          {showsCode && (
            <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 3 }}>
              <span style={{
                ...JKT, fontSize: 10, fontWeight: 600,
                padding: "1px 6px", borderRadius: 4,
                background: "#1e1e1e", color: "#d4d4d4",
                fontFamily: "monospace",
              }}>
                {"</>"}
              </span>
              <span style={{ ...JKT, fontSize: 10, color: "#8b8b9e" }}>contains code block</span>
            </div>
          )}

          {/* Validation warnings */}
          {!isValid && (
            <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 4 }}>
              <AlertCircle size={11} style={{ color: "#ef4444", flexShrink: 0 }} />
              <span style={{ ...JKT, fontSize: 10, color: "#ef4444", fontWeight: 600 }}>
                {!titleText                          // ← use titleText
                  ? "Missing question title"
                  : !hasEnoughOptions
                  ? "Needs ≥ 2 options"
                  : "No correct answer marked"}
              </span>
            </div>
          )}

          {capacityError && (
            <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 4 }}>
              <AlertTriangle size={11} style={{ color: "#d97706", flexShrink: 0 }} />
              <span style={{ ...JKT, fontSize: 10, color: "#d97706", fontWeight: 600 }}>
                {capacityError}
              </span>
            </div>
          )}

          {/* Badges row */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 6 }}>
            <span
              style={{
                ...JKT,
                fontSize: 10,
                fontWeight: 700,
                padding: "2px 7px",
                borderRadius: 20,
                background: diff.bg,
                color: diff.text,
                border: `1px solid ${diff.dot}40`,
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: diff.dot,
                  flexShrink: 0,
                }}
              />
              {q.mcqQuestionDifficulty.charAt(0).toUpperCase() + q.mcqQuestionDifficulty.slice(1)}
            </span>
            <span
              style={{
                ...JKT,
                fontSize: 10,
                fontWeight: 600,
                padding: "2px 7px",
                borderRadius: 20,
                background: "#f5f5f8",
                color: "#6b6b7e",
                border: "1px solid #e4e4ed",
              }}
            >
              {TYPE_LABELS[q.mcqQuestionType] || q.mcqQuestionType}
            </span>
            {q.mcqQuestionScore ? (
              <span
                style={{
                  ...JKT,
                  fontSize: 10,
                  fontWeight: 600,
                  padding: "2px 7px",
                  borderRadius: 20,
                  background: "#f5f5f8",
                  color: "#6b6b7e",
                  border: "1px solid #e4e4ed",
                }}
              >
                {q.mcqQuestionScore} mark{q.mcqQuestionScore !== 1 ? "s" : ""}
              </span>
            ) : null}
            {isValid && (
              <span
                style={{
                  ...JKT,
                  fontSize: 10,
                  fontWeight: 700,
                  padding: "2px 7px",
                  borderRadius: 20,
                  background: "#f0fdf4",
                  color: "#16a34a",
                  border: "1px solid #bbf7d0",
                }}
              >
                ✓ Valid
              </span>
            )}
          </div>
        </div>

        {/* Expand toggle */}
        <button
          onClick={() => setExpanded((v) => !v)}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: 4,
            color: "#8b8b9e",
            flexShrink: 0,
          }}
        >
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>

      {/* Expanded options */}
      {expanded && q.mcqQuestionOptions.length > 0 && (
        <div
          style={{
            borderTop: "1px solid #f0f0f5",
            padding: "8px 12px 10px 44px",
            display: "flex",
            flexDirection: "column",
            gap: 4,
          }}
        >
          {q.mcqQuestionOptions.map((opt, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 7,
                padding: "4px 8px",
                borderRadius: 7,
                background: opt.isCorrect ? "#f0fdf4" : "#fff",
                border: `1px solid ${opt.isCorrect ? "#bbf7d0" : "#e4e4ed"}`,
              }}
            >
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: opt.isCorrect ? "#16a34a" : "#bcbccc",
                  fontFamily: "monospace",
                  minWidth: 16,
                }}
              >
                {String.fromCharCode(65 + i)}
              </span>
              <span style={{ ...JKT, fontSize: 12, color: opt.isCorrect ? "#14532d" : "#6b6b7e", flex: 1 }}>
                {opt.text || <em style={{ color: "#bcbccc" }}>Empty</em>}
              </span>
              {opt.isCorrect && (
                <CheckCircle2 size={12} style={{ color: "#16a34a", flexShrink: 0 }} />
              )}
            </div>
          ))}
          {q.mcqQuestionDescription && (
            <p style={{ ...JKT, fontSize: 11, color: "#8b8b9e", margin: "4px 0 0" }}>
              <strong style={{ color: "#6b6b7e" }}>Explanation:</strong> {q.mcqQuestionDescription}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

/** Small card for invalid/skipped rows */
const InvalidRowCard: React.FC<{ row: InvalidRow }> = ({ row }) => {
  const [open, setOpen] = useState(false);
  return (
    <div
      style={{
        ...JKT,
        border: "1px solid #fecdd3",
        borderRadius: 8,
        background: "#fff5f5",
        padding: "8px 10px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
        <AlertCircle size={13} style={{ color: "#ef4444", flexShrink: 0 }} />
        <span style={{ ...JKT, fontSize: 11, color: "#e11d48", fontWeight: 600, flex: 1 }}>
          Row {row.rowIndex}: {row.reason}
        </span>
        <button
          onClick={() => setOpen((v) => !v)}
          style={{ background: "none", border: "none", cursor: "pointer", color: "#bcbccc", padding: 2 }}
        >
          {open ? <EyeOff size={12} /> : <Eye size={12} />}
        </button>
      </div>
      {open && (
        <pre
          style={{
            marginTop: 6,
            padding: "6px 8px",
            borderRadius: 6,
            background: "#fef2f2",
            fontSize: 10,
            color: "#7f1d1d",
            overflowX: "auto",
            whiteSpace: "pre-wrap",
            wordBreak: "break-all",
          }}
        >
          {JSON.stringify(row.raw, null, 2)}
        </pre>
      )}
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

const AddQuestionViaDocument: React.FC<Props> = ({
  exerciseData,
  tabType,
  onClose,
  onInserted,
  breadcrumbs = [],
  sliceRemaining,
}) => {
  // ── State ──────────────────────────────────────────────────────────────────
  type Stage = "upload" | "preview" | "inserting" | "done";
  const [stage, setStage]             = useState<Stage>("upload");
  const [dragOver, setDragOver]       = useState(false);
  const [file, setFile]               = useState<File | null>(null);
  const [parsing, setParsing]         = useState(false);
  const [parseError, setParseError]   = useState<string | null>(null);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [insertError, setInsertError] = useState<string | null>(null);
  const [insertedCount, setInsertedCount] = useState(0);
  const [showInvalid, setShowInvalid] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const entityType = getEntityType(exerciseData.nodeType);

  // ── Capacity helpers ───────────────────────────────────────────────────────
const getCapacityError = useCallback(
  (q: ParsedQuestion): string | undefined => {
    const cap = parseResult?.exerciseCapacity;
    if (!cap) return undefined;

    // Already selected — never block it
    if (selectedIds.has(q._previewId)) return undefined;

    if (cap.scoringType === "equalDistribution") {
      if (cap.remaining !== undefined && selectedIds.size >= cap.remaining) {
        return `Slot limit reached (${cap.remaining} remaining)`;
      }
    } else if (cap.scoringType === "questionSpecific") {
      const score = Number(q.mcqQuestionScore) || 0;
      if (score > 0 && cap.remainingMarks !== undefined) {
        const selectedMarks = parseResult!.valid
          .filter((v) => selectedIds.has(v._previewId))
          .reduce((sum, v) => sum + (Number(v.mcqQuestionScore) || 0), 0);
        if (score > (cap.remainingMarks - selectedMarks)) {
          return `Score ${score} exceeds remaining marks`;
        }
      }
    }
    return undefined;
  },
  [parseResult, selectedIds]
);
  // ── Auto-select all valid questions on parse ───────────────────────────────
useEffect(() => {
  if (!parseResult) return;
  const cap = parseResult.exerciseCapacity;

  const allValid = parseResult.valid.filter((q) => {
    const titleText = extractTitleText(q.mcqQuestionTitle);
    const isOptionBased = ["multiple_choice","multiple_select","dropdown"].includes(q.mcqQuestionType);
    return isOptionBased
      ? Boolean(titleText) && q.mcqQuestionOptions.length >= 2 && q.mcqQuestionOptions.some((o) => o.isCorrect)
      : Boolean(titleText);
  });

  // Respect remaining slot limit during auto-select
  let toSelect = allValid;
  if (cap?.scoringType === "equalDistribution" && cap.remaining !== undefined) {
    toSelect = allValid.slice(0, cap.remaining);
  } else if (cap?.scoringType === "questionSpecific" && cap.remainingMarks !== undefined) {
    let budget = cap.remainingMarks;
    toSelect = allValid.filter((q) => {
      const score = Number(q.mcqQuestionScore) || 0;
      if (score <= budget) { budget -= score; return true; }
      return false;
    });
  }

  setSelectedIds(new Set(toSelect.map((q) => q._previewId)));
}, [parseResult]);
  // ── File handling ──────────────────────────────────────────────────────────
  const acceptFile = (f: File) => {
    const ext = f.name.split(".").pop()?.toLowerCase();
    if (!["json", "csv", "txt"].includes(ext || "")) {
      setParseError("Only .json, .csv, and .txt files are supported.");
      return;
    }
    setFile(f);
    setParseError(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) acceptFile(dropped);
  };

  // ── Parse ──────────────────────────────────────────────────────────────────
  const handleParse = async () => {
    if (!file) return;
    setParsing(true);
    setParseError(null);
    try {
      const result = await bulkUploadApi.parseDocument(
        entityType,
        exerciseData.nodeId,
        exerciseData.exerciseId,
        file,
        tabType,
        exerciseData.subcategory
      );
      // Clamp the server's overall capacity by the Manual quota slice (when a
      // Custom mix is configured) — every downstream cap (auto-select,
      // tick-time block, select-all, capacity bar) reads cap.remaining.
      const parsed: any = result.data;
      if (
        typeof sliceRemaining === 'number' && sliceRemaining >= 0 &&
        parsed?.exerciseCapacity?.scoringType === 'equalDistribution' &&
        typeof parsed.exerciseCapacity.remaining === 'number'
      ) {
        parsed.exerciseCapacity = {
          ...parsed.exerciseCapacity,
          remaining: Math.min(parsed.exerciseCapacity.remaining, sliceRemaining),
        };
      }
      setParseResult(parsed);
      setStage("preview");
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: Array<{ value: string }> }; }; message?: string })
          ?.response?.data?.message?.[0]?.value ||
        (err as { message?: string })?.message ||
        "Failed to parse document. Please check the format.";
      setParseError(msg);
    } finally {
      setParsing(false);
    }
  };

  // ── Selection ──────────────────────────────────────────────────────────────
  const toggleOne = (id: string) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

const selectAllValid = () => {
  if (!parseResult) return;
  const cap = parseResult.exerciseCapacity;

  const allValid = parseResult.valid.filter((q) => {
    const titleText = extractTitleText(q.mcqQuestionTitle);
    const isOptionBased = ["multiple_choice","multiple_select","dropdown"].includes(q.mcqQuestionType);
    return isOptionBased
      ? Boolean(titleText) && q.mcqQuestionOptions.length >= 2 && q.mcqQuestionOptions.some((o) => o.isCorrect)
      : Boolean(titleText);
  });

  let toSelect = allValid;
  if (cap?.scoringType === "equalDistribution" && cap.remaining !== undefined) {
    toSelect = allValid.slice(0, cap.remaining);
  } else if (cap?.scoringType === "questionSpecific" && cap.remainingMarks !== undefined) {
    let budget = cap.remainingMarks;
    toSelect = allValid.filter((q) => {
      const score = Number(q.mcqQuestionScore) || 0;
      if (score <= budget) { budget -= score; return true; }
      return false;
    });
  }

  setSelectedIds(new Set(toSelect.map((q) => q._previewId)));
};

  const deselectAll = () => setSelectedIds(new Set());

  // ── Insert ─────────────────────────────────────────────────────────────────
  const handleInsert = async () => {
    if (!parseResult || !selectedIds.size) return;
    const toInsert = parseResult.valid.filter((q) => selectedIds.has(q._previewId));
    setStage("inserting");
    setInsertError(null);
    try {
      const result = await bulkUploadApi.insertQuestions(
        entityType,
        exerciseData.nodeId,
        exerciseData.exerciseId,
        tabType,
        exerciseData.subcategory,
        toInsert
      );
      setInsertedCount(result.data?.inserted?.length || toInsert.length);
      setStage("done");
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: Array<{ value: string }> }; }; message?: string })
          ?.response?.data?.message?.[0]?.value ||
        (err as { message?: string })?.message ||
        "Failed to insert questions.";
      setInsertError(msg);
      setStage("preview");
    }
  };

  // ── Capacity bar ──────────────────────────────────────────────────────────
  const renderCapacityBar = () => {
    const cap = parseResult?.exerciseCapacity;
    if (!cap) return null;

    let used = 0, max = 0, label = "";
    if (cap.scoringType === "equalDistribution" && cap.totalAllowed) {
      used = cap.currentCount || 0;
      max  = cap.totalAllowed;
      label = `${used}/${max} questions used · ${cap.remaining || 0} slots remaining`;
    } else if (cap.scoringType === "questionSpecific" && cap.maxMarks) {
      used = cap.usedMarks || 0;
      max  = cap.maxMarks;
      label = `${used}/${max} marks used · ${cap.remainingMarks || 0} marks remaining`;
    } else return null;

    const pct = max > 0 ? Math.min(100, (used / max) * 100) : 0;
    const sel = parseResult!.valid.filter((q) => selectedIds.has(q._previewId));
    const selCount = sel.length;

    return (
      <div
        style={{
          ...JKT,
          background: "#f7f7fb",
          border: "1px solid #e4e4ed",
          borderRadius: 10,
          padding: "10px 12px",
          marginBottom: 14,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
          <span style={{ ...JKT, fontSize: 11, fontWeight: 700, color: "#6b6b7e" }}>
            Exercise capacity
          </span>
          <span style={{ ...JKT, fontSize: 11, color: "#6b6b7e" }}>{label}</span>
        </div>
        <div
          style={{
            height: 6,
            background: "#e4e4ed",
            borderRadius: 3,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${pct}%`,
              background: pct >= 100 ? "#ef4444" : OR,
              borderRadius: 3,
              transition: "width 0.3s",
            }}
          />
        </div>
        {selCount > 0 && (
          <p style={{ ...JKT, fontSize: 11, color: OR, marginTop: 5, fontWeight: 600 }}>
            {selCount} question{selCount !== 1 ? "s" : ""} selected for insertion
          </p>
        )}
      </div>
    );
  };

  // ── Render: Upload Stage ───────────────────────────────────────────────────
  const renderUpload = () => (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: "20px 24px 24px" }}>

      {/* Template downloads */}
      <div
        style={{
          background: "#f0fdf4",
          border: "1px solid #bbf7d0",
          borderRadius: 10,
          padding: "10px 14px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 7 }}>
          <Info size={13} style={{ color: "#16a34a" }} />
          <span style={{ ...JKT, fontSize: 12, fontWeight: 700, color: "#14532d" }}>
            Download a template to get started
          </span>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {(["json", "csv", "txt"] as const).map((fmt) => {
            const icons = { json: <FileJson size={12} />, csv: <Sheet size={12} />, txt: <AlignLeft size={12} /> };
            return (
              <button
                key={fmt}
                onClick={() => bulkUploadApi.downloadTemplate(fmt)}
                style={{
                  ...JKT,
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  padding: "4px 10px",
                  borderRadius: 6,
                  background: "#fff",
                  border: "1px solid #bbf7d0",
                  color: "#16a34a",
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                {icons[fmt]}
                {fmt.toUpperCase()} template
                <Download size={10} />
              </button>
            );
          })}
        </div>
      </div>

      {/* Supported format guide */}
      <div
        style={{
          background: "#fafafa",
          border: "1px solid #e4e4ed",
          borderRadius: 10,
          padding: "10px 14px",
        }}
      >
        <p style={{ ...JKT, fontSize: 11, fontWeight: 700, color: "#6b6b7e", marginBottom: 6 }}>
          Required fields
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          {[
            { field: "questionTitle", note: "Required — the question text", required: true },
            { field: "options",       note: "Required for choice types — array or flat columns (optionA…optionD)", required: true },
            { field: "answer",        note: "Required — letter (A/B), 1-based index, or full option text", required: true },
            { field: "type",          note: `Optional — defaults to "multiple_choice"`, required: false },
            { field: "difficulty",    note: `Optional — easy / medium / hard. Default: "medium"`, required: false },
            { field: "score",         note: "Optional — marks for this question", required: false },
            { field: "explanation",   note: "Optional — explanation shown after answer", required: false },
          ].map(({ field, note, required }) => (
            <div key={field} style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <code
                style={{
                  fontSize: 10,
                  background: required ? "rgba(242,119,87,0.1)" : "#f5f5f8",
                  color: required ? OR : "#6b6b7e",
                  padding: "1px 5px",
                  borderRadius: 4,
                  flexShrink: 0,
                  fontFamily: "monospace",
                }}
              >
                {field}
              </code>
              <span style={{ ...JKT, fontSize: 11, color: "#8b8b9e" }}>{note}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        style={{
          border: `2px dashed ${dragOver ? OR : file ? "#22c55e" : "#d0d0de"}`,
          borderRadius: 14,
          padding: "28px 20px",
          textAlign: "center",
          cursor: "pointer",
          background: dragOver ? OR_LIGHT : file ? "#f0fdf4" : "#fafafa",
          transition: "all 0.15s",
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,.csv,.txt"
          style={{ display: "none" }}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) acceptFile(f); }}
        />
        {file ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
            <CheckCircle2 size={22} style={{ color: "#22c55e" }} />
            <div style={{ textAlign: "left" }}>
              <p style={{ ...JKT, fontSize: 13, fontWeight: 700, color: "#14532d", margin: 0 }}>
                {file.name}
              </p>
              <p style={{ ...JKT, fontSize: 11, color: "#6b6b7e", margin: 0 }}>
                {(file.size / 1024).toFixed(1)} KB · click to change
              </p>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); setFile(null); setParseError(null); }}
              style={{
                background: "#fee2e2",
                border: "none",
                borderRadius: 6,
                padding: "3px 6px",
                cursor: "pointer",
                color: "#ef4444",
              }}
            >
              <Trash2 size={12} />
            </button>
          </div>
        ) : (
          <>
            <Upload size={28} style={{ color: dragOver ? OR : "#bcbccc", marginBottom: 8 }} />
            <p style={{ ...JKT, fontSize: 13, fontWeight: 600, color: "#6b6b7e", margin: "0 0 4px" }}>
              Drag & drop your file here, or click to browse
            </p>
            <p style={{ ...JKT, fontSize: 11, color: "#bcbccc", margin: 0 }}>
              JSON · CSV · TXT · Max 5 MB
            </p>
          </>
        )}
      </div>

      {/* Parse error */}
      {parseError && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 12px",
            borderRadius: 8,
            background: "#fff5f5",
            border: "1px solid #fecdd3",
          }}
        >
          <AlertCircle size={14} style={{ color: "#ef4444", flexShrink: 0 }} />
          <span style={{ ...JKT, fontSize: 12, color: "#e11d48" }}>{parseError}</span>
        </div>
      )}

      {/* Parse button */}
      <button
        onClick={handleParse}
        disabled={!file || parsing}
        style={{
          ...JKT,
          background: file && !parsing ? OR : "#d4d4e2",
          color: "#fff",
          border: "none",
          borderRadius: 10,
          padding: "10px 0",
          fontSize: 13,
          fontWeight: 700,
          cursor: file && !parsing ? "pointer" : "not-allowed",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 7,
          boxShadow: file && !parsing ? "0 2px 8px rgba(242,119,87,0.3)" : "none",
          transition: "all 0.15s",
        }}
      >
        {parsing ? (
          <>
            <Loader2 size={15} className="animate-spin" />
            Parsing document…
          </>
        ) : (
          <>
            <ArrowRight size={15} />
            Parse & Preview
          </>
        )}
      </button>
    </div>
  );

  // ── Render: Preview Stage ──────────────────────────────────────────────────
  const renderPreview = () => {
    if (!parseResult) return null;
    const { valid, invalid, summary } = parseResult;
    const selCount = selectedIds.size;

    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>

        {/* Stats bar */}
        {/* <div
          style={{
            display: "flex",
            gap: 10,
            padding: "12px 16px",
            borderBottom: "1px solid #e4e4ed",
            flexShrink: 0,
          }}
        >
          {[
            { label: "Total rows",   value: summary.total,   color: "#6b6b7e", bg: "#f5f5f8"  },
            { label: "Valid",        value: summary.valid,   color: "#16a34a", bg: "#f0fdf4"  },
            { label: "Skipped",      value: summary.invalid, color: "#ef4444", bg: "#fff5f5"  },
            { label: "Selected",     value: selCount,        color: OR,        bg: OR_LIGHT   },
          ].map(({ label, value, color, bg }) => (
            <div
              key={label}
              style={{
                flex: 1,
                padding: "6px 10px",
                borderRadius: 8,
                background: bg,
                textAlign: "center",
              }}
            >
              <p style={{ ...JKT, fontSize: 18, fontWeight: 800, color, margin: 0, lineHeight: 1.1 }}>
                {value}
              </p>
              <p style={{ ...JKT, fontSize: 10, color: "#8b8b9e", margin: 0 }}>{label}</p>
            </div>
          ))}
        </div> */}

        {/* Capacity bar + select-all actions */}
        <div style={{ padding: "12px 16px 0", flexShrink: 0 }}>
          {renderCapacityBar()}

          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <button
              onClick={selectAllValid}
              style={{
                ...JKT,
                fontSize: 11,
                fontWeight: 700,
                color: OR,
                background: OR_LIGHT,
                border: `1px solid ${OR_BORDER}`,
                borderRadius: 6,
                padding: "4px 10px",
                cursor: "pointer",
              }}
            >
              Select all valid
            </button>
            {selCount > 0 && (
              <button
                onClick={deselectAll}
                style={{
                  ...JKT,
                  fontSize: 11,
                  fontWeight: 700,
                  color: "#6b6b7e",
                  background: "#f5f5f8",
                  border: "1px solid #e4e4ed",
                  borderRadius: 6,
                  padding: "4px 10px",
                  cursor: "pointer",
                }}
              >
                Deselect all
              </button>
            )}
            <button
              onClick={() => { setStage("upload"); setParseResult(null); setFile(null); }}
              style={{
                ...JKT,
                fontSize: 11,
                color: "#8b8b9e",
                background: "none",
                border: "none",
                cursor: "pointer",
                marginLeft: "auto",
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <RefreshCw size={11} /> Upload different file
            </button>
          </div>
        </div>

        {/* Scrollable list */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "0 16px 8px",
            display: "flex",
            flexDirection: "column",
            gap: 8,
            scrollbarWidth: "thin",
          }}
        >
          {valid.map((q, i) => (
            <QuestionCard
              key={q._previewId}
              q={q}
              index={i}
              selected={selectedIds.has(q._previewId)}
              onToggle={() => toggleOne(q._previewId)}
              capacityError={getCapacityError(q)}
            />
          ))}

          {/* Skipped/invalid section */}
          {invalid.length > 0 && (
            <>
              <button
                onClick={() => setShowInvalid((v) => !v)}
                style={{
                  ...JKT,
                  background: "none",
                  border: "1px solid #fecdd3",
                  borderRadius: 8,
                  padding: "7px 10px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  color: "#e11d48",
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                <AlertCircle size={13} />
                {invalid.length} skipped row{invalid.length !== 1 ? "s" : ""} (click to review)
                {showInvalid ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              </button>
              {showInvalid &&
                invalid.map((row) => <InvalidRowCard key={row.rowIndex} row={row} />)}
            </>
          )}
        </div>

        {/* Footer action */}
        <div
          style={{
            padding: "12px 16px",
            borderTop: "1px solid #e4e4ed",
            flexShrink: 0,
          }}
        >
          {insertError && (
            <div
              style={{
                marginBottom: 8,
                padding: "6px 10px",
                borderRadius: 7,
                background: "#fff5f5",
                border: "1px solid #fecdd3",
                display: "flex",
                gap: 6,
                alignItems: "center",
              }}
            >
              <AlertCircle size={13} style={{ color: "#ef4444" }} />
              <span style={{ ...JKT, fontSize: 11, color: "#e11d48" }}>{insertError}</span>
            </div>
          )}

          <button
            onClick={handleInsert}
            disabled={selCount === 0}
            style={{
              ...JKT,
              width: "20%",
              background: selCount > 0 ? OR : "#d4d4e2",
              color: "#fff",
              border: "none",
              borderRadius: 10,
              margin:'auto',
              padding: "10px 0",
              fontSize: 13,
              fontWeight: 700,
              cursor: selCount > 0 ? "pointer" : "not-allowed",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 7,
              boxShadow: selCount > 0 ? "0 2px 8px rgba(242,119,87,0.3)" : "none",
            }}
          >
            <CheckSquare size={15} />
            Insert {selCount} selected question{selCount !== 1 ? "s" : ""}
          </button>
        </div>
      </div>
    );
  };

  // ── Render: Inserting Stage ────────────────────────────────────────────────
  const renderInserting = () => (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
        padding: "48px 24px",
      }}
    >
      <div style={{ position: "relative" }}>
        <div
          style={{
            width: 52,
            height: 52,
            borderRadius: "50%",
            border: "4px solid #f5f5f8",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            width: 52,
            height: 52,
            borderRadius: "50%",
            border: "4px solid transparent",
            borderTopColor: OR,
            animation: "spin 0.8s linear infinite",
          }}
        />
      </div>
      <p style={{ ...JKT, fontSize: 14, fontWeight: 700, color: "#1a1a2e", margin: 0 }}>
        Inserting questions…
      </p>
      <p style={{ ...JKT, fontSize: 12, color: "#8b8b9e", margin: 0 }}>
        Writing {selectedIds.size} question{selectedIds.size !== 1 ? "s" : ""} to the exercise
      </p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  // ── Render: Done Stage ────────────────────────────────────────────────────
  const renderDone = () => (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 14,
        padding: "48px 24px",
        textAlign: "center",
      }}
    >
      <div
        style={{
          width: 60,
          height: 60,
          borderRadius: "50%",
          background: "#f0fdf4",
          border: "2px solid #bbf7d0",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <CheckCircle2 size={28} style={{ color: "#22c55e" }} />
      </div>
      <div>
        <p style={{ ...JKT, fontSize: 16, fontWeight: 800, color: "#1a1a2e", margin: "0 0 4px" }}>
          {insertedCount} question{insertedCount !== 1 ? "s" : ""} added!
        </p>
        <p style={{ ...JKT, fontSize: 12, color: "#8b8b9e", margin: 0 }}>
          Successfully inserted into{" "}
          <strong style={{ color: "#1a1a2e" }}>{exerciseData.exerciseName}</strong>
        </p>
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
        <button
          onClick={() => {
            setStage("upload");
            setFile(null);
            setParseResult(null);
            setParseError(null);
            setInsertError(null);
            setSelectedIds(new Set());
          }}
          style={{
            ...JKT,
            padding: "8px 18px",
            borderRadius: 9,
            border: "1.5px solid #e4e4ed",
            background: "#fff",
            color: "#6b6b7e",
            fontSize: 12,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Upload another
        </button>
        <button
          onClick={() => { onInserted(insertedCount); onClose(); }}
          style={{
            ...JKT,
            padding: "8px 18px",
            borderRadius: 9,
            border: "none",
            background: OR,
            color: "#fff",
            fontSize: 12,
            fontWeight: 700,
            cursor: "pointer",
            boxShadow: "0 2px 8px rgba(242,119,87,0.3)",
          }}
        >
          Done
        </button>
      </div>
    </div>
  );

  // ── Main render ────────────────────────────────────────────────────────────
  const stageTitles: Record<Stage, string> = {
    upload:    "Add Questions via Document",
    preview:   "Review & Select Questions",
    inserting: "Inserting…",
    done:      "Import Complete",
  };

  return (
    <>
      {/* Backdrop */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 90,
          background: "rgba(26,26,46,0.45)",
          backdropFilter: "blur(4px)",
        }}
        onClick={stage !== "inserting" ? onClose : undefined}
      />

      {/* Modal */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 91,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 16,
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            ...JKT,
            pointerEvents: "auto",
            background: "#fff",
            borderRadius: 18,
            boxShadow: "0 20px 60px rgba(26,26,46,0.18)",
            border: "1px solid #e4e4ed",
            width: "100%",
            maxWidth: 1200,
            maxHeight: "92vh",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          {/* Header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "14px 16px 12px",
              borderBottom: "1px solid #e4e4ed",
              flexShrink: 0,
            }}
          >
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 9,
                background: OR_LIGHT,
                border: `1px solid ${OR_BORDER}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <FileText size={15} style={{ color: OR }} />
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              {breadcrumbs.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 2, marginBottom: 2 }}>
                  {breadcrumbs.slice(0, 3).map((c, i) => (
                    <span key={i} style={{ display: "flex", alignItems: "center" }}>
                      {i > 0 && (
                        <span style={{ color: OR, fontSize: 11, margin: "0 2px" }}>›</span>
                      )}
                      <span style={{ ...JKT, fontSize: 10, color: "#8b8b9e" }}>{c.name}</span>
                    </span>
                  ))}
                </div>
              )}
              <h2 style={{ ...JKT, fontSize: 14, fontWeight: 800, color: "#1a1a2e", margin: 0 }}>
                {stageTitles[stage]}
              </h2>
            </div>

            {stage !== "inserting" && (
              <button
                onClick={onClose}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "#bcbccc",
                  padding: 4,
                  borderRadius: 6,
                  flexShrink: 0,
                }}
              >
                <X size={16} />
              </button>
            )}
          </div>

          {/* Stage progress dots */}
          {stage !== "done" && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                padding: "8px 0 6px",
                borderBottom: "1px solid #f0f0f5",
                flexShrink: 0,
              }}
            >
              {(["upload", "preview", "inserting"] as Stage[]).map((s, i) => {
                const stageOrder: Record<Stage, number> = { upload: 0, preview: 1, inserting: 2, done: 3 };
                const current = stageOrder[stage];
                const isCurrent = s === stage;
                const isDone = stageOrder[s] < current;
                return (
                  <React.Fragment key={s}>
                    {i > 0 && (
                      <div
                        style={{
                          width: 24,
                          height: 1,
                          background: isDone || isCurrent ? OR : "#e4e4ed",
                        }}
                      />
                    )}
                    <div
                      style={{
                        width: isCurrent ? 22 : 8,
                        height: 8,
                        borderRadius: 4,
                        background: isCurrent ? OR : isDone ? "#22c55e" : "#e4e4ed",
                        transition: "all 0.2s",
                      }}
                    />
                  </React.Fragment>
                );
              })}
            </div>
          )}

          {/* Body */}
          <div style={{ flex: 1, minHeight: 0, overflowY: stage === "preview" ? "hidden" : "auto", display: "flex", flexDirection: "column" }}>
            {stage === "upload"    && renderUpload()}
            {stage === "preview"   && renderPreview()}
            {stage === "inserting" && renderInserting()}
            {stage === "done"      && renderDone()}
          </div>
        </div>
      </div>
    </>
  );
};

export default AddQuestionViaDocument;