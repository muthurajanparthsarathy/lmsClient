import { getToken } from "@/lib/session";
import { useState, useRef, useEffect } from "react";
import FileMCQAnnotationForm from "./FileMCQAnnotationForm";
import {
  X, Play, Pause, Volume2, VolumeX, Maximize, Minimize,
  FileText, Sparkles, HelpCircle,
  Plus, Trash2, AlertCircle, Loader, Copy, ChevronUp, ChevronDown,
  List, CheckSquare, AlignLeft, Bold, Italic, Underline, Image,
  ZoomIn, ZoomOut, Check, Save,
  BookOpen, ChevronRight, SlidersHorizontal,
} from "lucide-react";

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function formatTime(seconds) {
  if (isNaN(seconds) || seconds === undefined) return "0:00";
  const hrs  = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  if (hrs > 0) return `${hrs}:${String(mins).padStart(2,"0")}:${String(secs).padStart(2,"0")}`;
  return `${mins}:${String(secs).padStart(2,"0")}`;
}

let _uid = 0;
const uid = (prefix = "id") => `${prefix}-${++_uid}-${Math.random().toString(36).slice(2,7)}`;

// ─── TYPE CONFIG ───────────────────────────────────────────────────────────────
const typeConfig = {
  "multiple-choice": { label: "Multiple Choice", icon: <List className="h-3.5 w-3.5" />,        color: "text-violet-600", bg: "bg-violet-50" },
  "checkboxes":      { label: "Checkboxes",      icon: <CheckSquare className="h-3.5 w-3.5" />,  color: "text-blue-600",   bg: "bg-blue-50"   },
  "dropdown":        { label: "Dropdown",         icon: <ChevronDown className="h-3.5 w-3.5" />,  color: "text-indigo-600", bg: "bg-indigo-50" },
  "short-answer":    { label: "Short Answer",     icon: <AlignLeft className="h-3.5 w-3.5" />,    color: "text-orange-600", bg: "bg-orange-50" },
  "paragraph":       { label: "Paragraph",        icon: <BookOpen className="h-3.5 w-3.5" />,     color: "text-teal-600",   bg: "bg-teal-50"   },
};

// ─── RICH TEXT EDITOR ──────────────────────────────────────────────────────────
function RichTextEditor({ value, onChange, placeholder, className = "", compact = false }) {
  const ref   = useRef(null);
  const [empty, setEmpty] = useState(!value);

  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== (value || ""))
      ref.current.innerHTML = value || "";
    setEmpty(!value || value === "<br>" || value === "<p><br></p>");
  }, [value]);

  const exec = (cmd) => {
    document.execCommand(cmd, false);
    if (ref.current) onChange(ref.current.innerHTML);
  };

  return (
    <div className={`group ${className}`}>
      <div className={`flex items-center gap-0.5 ${compact ? "mb-1" : "mb-1.5"}`}>
        {[["bold",<Bold className="h-3 w-3"/>],["italic",<Italic className="h-3 w-3"/>],["underline",<Underline className="h-3 w-3"/>]].map(([cmd,icon])=>(
          <button key={cmd} type="button" onMouseDown={e=>{e.preventDefault(); exec(cmd);}}
            className="p-1 hover:bg-slate-100 text-slate-400 hover:text-slate-700 rounded transition-colors">
            {icon}
          </button>
        ))}
      </div>
      <div className="relative">
        <div ref={ref} contentEditable suppressContentEditableWarning
          onInput={e=>{ const c=e.currentTarget.innerHTML; onChange(c); setEmpty(!c||c==="<br>"); }}
          className="focus:outline-none text-sm text-slate-800 leading-relaxed min-h-[36px] border-b-2 border-slate-200 focus:border-violet-400 pb-1.5 transition-colors" />
        {empty && placeholder && (
          <div className="absolute top-0 left-0 text-slate-300 text-sm pointer-events-none select-none">{placeholder}</div>
        )}
      </div>
    </div>
  );
}

// ─── IMAGE TOOLBAR ─────────────────────────────────────────────────────────────
function ImageToolbar({ alignment, sizePercent, onAlignmentChange, onSizeChange, onRemove, onClose }) {
  return (
    <div className="absolute top-2 left-1/2 -translate-x-1/2 z-50 bg-white rounded-xl shadow-2xl border border-slate-200 flex items-stretch divide-x divide-slate-100" style={{ minWidth: 260 }}>
      <div className="flex flex-col items-center justify-center px-3 py-2 gap-1">
        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Align</span>
        <div className="flex gap-0.5">
          {["left","center","right"].map(a=>(
            <button key={a} onClick={()=>onAlignmentChange(a)}
              className={`w-6 h-6 rounded-md text-[10px] font-bold transition-all ${alignment===a?"bg-violet-600 text-white":"bg-slate-100 text-slate-400 hover:bg-violet-50 hover:text-violet-600"}`}>
              {a[0].toUpperCase()}
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-col justify-center px-3 py-2 gap-1 flex-1">
        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Size {sizePercent}%</span>
        <div className="flex items-center gap-1.5">
          <ZoomOut className="h-3 w-3 text-slate-300"/>
          <input type="range" min={10} max={100} step={5} value={sizePercent}
            onChange={e=>onSizeChange(parseInt(e.target.value))}
            className="flex-1 h-1.5 accent-violet-600 cursor-pointer"/>
          <ZoomIn className="h-3 w-3 text-slate-300"/>
        </div>
      </div>
      <div className="flex items-center gap-0.5 px-2 py-2">
        <button onClick={onRemove} className="p-1.5 hover:bg-red-50 rounded-lg text-slate-400 hover:text-red-500 transition-colors" title="Remove image"><Trash2 className="h-3.5 w-3.5"/></button>
        <button onClick={onClose}  className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 transition-colors" title="Close"><X className="h-3.5 w-3.5"/></button>
      </div>
    </div>
  );
}

// ─── OPTIONS-PER-ROW PICKER ────────────────────────────────────────────────────
function OptionsPerRowPicker({ value, onChange }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] font-semibold text-slate-400">Layout:</span>
      {[1,2,3,4].map(n=>(
        <button key={n} onClick={()=>onChange(n)}
          className={`w-6 h-6 rounded-md text-[10px] font-bold transition-all ${value===n?"bg-violet-600 text-white shadow-sm":"bg-slate-100 text-slate-500 hover:bg-violet-50 hover:text-violet-600"}`}>
          {n}
        </button>
      ))}
      <span className="text-[10px] text-slate-400">per row</span>
    </div>
  );
}

// ─── SETTINGS MENU ─────────────────────────────────────────────────────────────
function SettingsMenu({ isOpen, onClose, onCollapseAll, onExpandAll }) {
  if (!isOpen) return null;
  return (
    <div className="absolute top-full right-0 mt-1.5 w-52 bg-white rounded-xl shadow-2xl border border-slate-200 py-2 z-50">
      <p className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">View</p>
      {[["Collapse All", <ChevronRight className="h-3.5 w-3.5 text-slate-400"/>, onCollapseAll],
        ["Expand All",   <ChevronDown  className="h-3.5 w-3.5 text-slate-400"/>, onExpandAll ]].map(([label,icon,handler])=>(
        <button key={label} onClick={()=>{ handler(); onClose(); }}
          className="w-full px-3 py-2 flex items-center gap-2 hover:bg-slate-50 transition-colors text-xs text-slate-700">
          {icon}{label}
        </button>
      ))}
    </div>
  );
}

// ─── DUPLICATE-WARNING DIALOG ──────────────────────────────────────────────────
function DuplicateWarningDialog({ isOpen, duplicateCount, onAddAnyway, onCancel }) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[200] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full border border-slate-200">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100">
          <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
            <Copy className="h-4 w-4 text-amber-600"/>
          </div>
          <h3 className="text-sm font-bold text-slate-900">{duplicateCount} Duplicate{duplicateCount>1?"s":""} Detected</h3>
        </div>
        <div className="px-5 py-4">
          <p className="text-xs text-slate-500 mb-4 leading-relaxed">
            {duplicateCount === 1 ? "One question appears to already exist." : `${duplicateCount} questions appear to already exist.`} Save anyway?
          </p>
          <div className="flex gap-2">
            <button onClick={onCancel}    className="flex-1 px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 border border-slate-200 hover:bg-slate-50 transition-all">Keep Editing</button>
            <button onClick={onAddAnyway} className="flex-1 px-4 py-2 rounded-lg text-xs font-bold text-white bg-amber-500 hover:bg-amber-600 transition-all">Save Anyway</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── MCQ QUESTION FORM (BACKEND-ALIGNED WITH FIXES) ──────────────────────────
function MCQQuestionForm({ 
  onClose, 
  onSave, 
  initialTimestamp = 0, 
  fileId, 
  fileName, 
  entityType, 
  entityId, 
  tabType, 
  subcategory, 
  folderPath = [], 
  apiBaseUrl = "http://localhost:5533" 
}) {
 const makeBlock = () => ({
  id: uid("block"),
  // Backend expects these at root level
  isActive: true,
  sequence: 0,
  timestamp: initialTimestamp,
  videoTimestamp: initialTimestamp,
  
  // Nested mcqQuestion object for UI state
  mcqQuestion: {
    questionTitle: "",
    options: [
      { 
        id: uid("opt"), 
        text: "", 
        isCorrect: false, 
        imageUrl: null, 
        imageAlignment: "left", 
        imageSizePercent: 100 
      },
      { 
        id: uid("opt"), 
        text: "", 
        isCorrect: false, 
        imageUrl: null, 
        imageAlignment: "left", 
        imageSizePercent: 100 
      },
    ],
    correctAnswers: [],
    explanation: ""
  },
  
  // UI state (not sent to backend)
  type: "multiple-choice",
  hasExplanation: false,
  optionsPerRow: 1,
  isRequired: false,
  questionImage: {
    imageUrl: "",
    alignment: "center",
    sizePercent: 60
  },
  explanationImageUrl: "",
});

  const [blocks, setBlocks] = useState([makeBlock()]);
  const [errors, setErrors] = useState({});
  const [collapsedState, setCollapsed] = useState({});
  const [showTypeMenu, setShowTypeMenu] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [activeImgToolbar, setActiveImgToolbar] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [dupeWarning, setDupeWarning] = useState({ show: false, count: 0 });

  // ── Block helpers ──────────────────────────────────────────────────────────
  const updateBlock = (id, patch) => setBlocks(bs => bs.map(b => b.id === id ? { ...b, ...patch } : b));
  
  const updateMcqQuestion = (id, patch) => setBlocks(bs => bs.map(b => 
    b.id === id ? { 
      ...b, 
      mcqQuestion: { ...b.mcqQuestion, ...patch } 
    } : b
  ));

  const updateOption = (bid, oid, patch) => setBlocks(bs => bs.map(b => 
    b.id === bid ? { 
      ...b, 
      mcqQuestion: {
        ...b.mcqQuestion,
        options: b.mcqQuestion.options.map(o => o.id === oid ? { ...o, ...patch } : o)
      }
    } : b
  ));

  const addBlock = () => {
    const nb = makeBlock();
    setBlocks(bs => [...bs, nb]);
    setCollapsed(p => ({ ...p, [nb.id]: false }));
  };

  const removeBlock = (id) => {
    if (blocks.length === 1) {
      const nb = makeBlock(); 
      setBlocks([nb]); 
      setCollapsed({ [nb.id]: false });
    } else {
      setBlocks(bs => bs.filter(b => b.id !== id));
      setCollapsed(p => { const n = { ...p }; delete n[id]; return n; });
    }
  };

  const moveBlock = (id, dir) => {
    const idx = blocks.findIndex(b => b.id === id);
    if (dir === "up" && idx === 0) return;
    if (dir === "down" && idx === blocks.length - 1) return;
    const nb = [...blocks];
    const ni = dir === "up" ? idx - 1 : idx + 1;
    [nb[idx], nb[ni]] = [nb[ni], nb[idx]];
    setBlocks(nb);
  };

  const duplicateBlock = (id) => {
    const src = blocks.find(b => b.id === id);
    if (!src) return;
    const nid = uid("block");
    const dup = { 
      ...src, 
      id: nid,
      mcqQuestion: {
        ...src.mcqQuestion,
        options: src.mcqQuestion.options.map(o => ({ 
          ...o, 
          id: uid("opt"),
          // Reset image URLs for duplicate (they'll need to be re-uploaded)
          imageUrl: o.imageUrl?.startsWith('data:') ? '' : o.imageUrl
        })),
        correctAnswers: [] // Reset correct answers for duplicate
      }
    };
    setBlocks(bs => [...bs, dup]);
    setCollapsed(p => ({ ...p, [nid]: false }));
  };

  const collapseAll = () => { 
    const s = {}; 
    blocks.forEach(b => s[b.id] = true);  
    setCollapsed(s); 
  };
  
  const expandAll = () => { 
    const s = {}; 
    blocks.forEach(b => s[b.id] = false); 
    setCollapsed(s); 
  };

  // ── Option helpers ─────────────────────────────────────────────────────────
  const addOption = (bid) => setBlocks(bs => bs.map(b => 
    b.id === bid ? { 
      ...b, 
      mcqQuestion: {
        ...b.mcqQuestion,
        options: [...b.mcqQuestion.options, {
          id: uid("opt"),
          text: "",
          isCorrect: false,
          imageUrl: null,
          imageAlignment: "left",
          imageSizePercent: 100
        }]
      }
    } : b
  ));

  const removeOption = (bid, oid) => setBlocks(bs => bs.map(b => {
    if (b.id !== bid) return b;
    
    const optionToRemove = b.mcqQuestion.options.find(o => o.id === oid);
    const newOptions = b.mcqQuestion.options.filter(o => o.id !== oid);
    
    // Update correctAnswers if the removed option was correct
    let newCorrectAnswers = [...b.mcqQuestion.correctAnswers];
    if (optionToRemove?.isCorrect) {
      newCorrectAnswers = newCorrectAnswers.filter(ans => ans !== optionToRemove.text);
    }
    
    return {
      ...b,
      mcqQuestion: {
        ...b.mcqQuestion,
        options: newOptions,
        correctAnswers: newCorrectAnswers
      }
    };
  }));

  // Update correctAnswers when option is marked correct
  const setCorrect = (bid, oid) => {
    setBlocks(bs => bs.map(b => {
      if (b.id !== bid) return b;
      
      const updatedOptions = b.mcqQuestion.options.map(o => ({
        ...o,
        isCorrect: o.id === oid
      }));
      
      const correctOption = updatedOptions.find(o => o.id === oid);
      const newCorrectAnswers = correctOption?.text ? [correctOption.text] : [];
      
      return {
        ...b,
        mcqQuestion: {
          ...b.mcqQuestion,
          options: updatedOptions,
          correctAnswers: newCorrectAnswers
        }
      };
    }));
  };

  const toggleCorrect = (bid, oid) => {
    setBlocks(bs => bs.map(b => {
      if (b.id !== bid) return b;
      
      const updatedOptions = b.mcqQuestion.options.map(o => 
        o.id === oid ? { ...o, isCorrect: !o.isCorrect } : o
      );
      
      const newCorrectAnswers = updatedOptions
        .filter(o => o.isCorrect)
        .map(o => o.text)
        .filter(text => text.trim());
      
      return {
        ...b,
        mcqQuestion: {
          ...b.mcqQuestion,
          options: updatedOptions,
          correctAnswers: newCorrectAnswers
        }
      };
    }));
  };

  // Update correctAnswers when option text changes
  const updateOptionText = (bid, oid, newText) => {
    setBlocks(bs => bs.map(b => {
      if (b.id !== bid) return b;
      
      const oldOption = b.mcqQuestion.options.find(o => o.id === oid);
      const updatedOptions = b.mcqQuestion.options.map(o => 
        o.id === oid ? { ...o, text: newText } : o
      );
      
      // Update correctAnswers if this option was correct
      let newCorrectAnswers = [...b.mcqQuestion.correctAnswers];
      if (oldOption?.isCorrect) {
        // Remove old text
        newCorrectAnswers = newCorrectAnswers.filter(ans => ans !== oldOption.text);
        // Add new text if not empty
        if (newText.trim()) {
          newCorrectAnswers.push(newText);
        }
      }
      
      return {
        ...b,
        mcqQuestion: {
          ...b.mcqQuestion,
          options: updatedOptions,
          correctAnswers: newCorrectAnswers
        }
      };
    }));
  };

  // ── Image helpers ──────────────────────────────────────────────────────────
  const uploadQuestionImage = (bid, file) => {
    const r = new FileReader();
    r.onload = e => { 
      updateBlock(bid, { 
        questionImage: {
          ...blocks.find(b => b.id === bid)?.questionImage,
          imageUrl: e.target.result
        }
      }); 
      setActiveImgToolbar({ type: "question", blockId: bid }); 
    };
    r.readAsDataURL(file);
  };

  const updateQuestionImageAlignment = (bid, alignment) => {
    updateBlock(bid, {
      questionImage: {
        ...blocks.find(b => b.id === bid)?.questionImage,
        alignment
      }
    });
  };

  const updateQuestionImageSize = (bid, sizePercent) => {
    updateBlock(bid, {
      questionImage: {
        ...blocks.find(b => b.id === bid)?.questionImage,
        sizePercent
      }
    });
  };

  const uploadOptionImage = (bid, oid, file) => {
    const r = new FileReader();
    r.onload = e => { 
      updateOption(bid, oid, { imageUrl: e.target.result }); 
      setActiveImgToolbar({ type: "option", blockId: bid, optionId: oid }); 
    };
    r.readAsDataURL(file);
  };

  const uploadExplanationImage = (bid, file) => {
    const r = new FileReader();
    r.onload = e => { 
      updateBlock(bid, { explanationImageUrl: e.target.result }); 
      setActiveImgToolbar({ type: "explanation", blockId: bid }); 
    };
    r.readAsDataURL(file);
  };

  const isQImgActive = (bid) => activeImgToolbar?.type === "question" && activeImgToolbar.blockId === bid;
  const isOptImgActive = (bid, oid) => activeImgToolbar?.type === "option" && activeImgToolbar.blockId === bid && activeImgToolbar.optionId === oid;
  const isExpImgActive = (bid) => activeImgToolbar?.type === "explanation" && activeImgToolbar.blockId === bid;

  // ── Validation ─────────────────────────────────────────────────────────────
  const validate = () => {
    const errs = {};
    let valid = true;
    
    blocks.forEach(b => {
      const be = {};
      
      // Check question title (required)
      const cleanTitle = b.mcqQuestion?.questionTitle?.replace(/<[^>]*>/g, "").trim() || "";
      if (!cleanTitle) { 
        be.questionTitle = "Question title is required"; 
        valid = false; 
      }
      
      // Check options
      if (b.mcqQuestion.options.length < 2) { 
        be.options = "At least 2 options are required"; 
        valid = false; 
      }
      
      const nonEmptyOptions = b.mcqQuestion.options.filter(o => o.text.trim());
      if (nonEmptyOptions.length < 2) { 
        be.options = "At least 2 non-empty options are required"; 
        valid = false; 
      }
      
      // Check correct answers
      if (b.mcqQuestion.correctAnswers.length === 0) { 
        be.correctAnswer = "Mark at least one correct answer"; 
        valid = false; 
      }
      
      if (Object.keys(be).length) errs[b.id] = be;
    });
    
    setErrors(errs);
    return valid;
  };

  // ── Base64 → File helper ───────────────────────────────────────────────────
  const base64ToFile = (b64, name) => {
    try {
      const m = b64.match(/^data:([^;]+);base64,(.+)$/);
      if (!m) return null;
      const bytes = atob(m[2]);
      const buf = new Uint8Array(bytes.length);
      for (let i = 0; i < bytes.length; i++) buf[i] = bytes.charCodeAt(i);
      return new File([buf], name, { type: m[1] });
    } catch { 
      return null; 
    }
  };

// ─── MAIN HANDLE SAVE FUNCTION ─────────────────────────────────────────────
const handleSave = async (e) => {
  e.preventDefault();
  if (!validate()) return;

  setIsSaving(true);
  
  try {
    const formData = new FormData();
    
    // Add required fields
    formData.append("tabType", tabType || "");
    formData.append("subcategory", subcategory || "");
    
    // Handle folderPath - send as JSON string
    const folderPathValue = Array.isArray(folderPath) && folderPath.length > 0 
      ? JSON.stringify(folderPath) 
      : JSON.stringify([]);
    formData.append("folderPath", folderPathValue);
    formData.append("fileId", fileId || "");

    // Prepare questions data according to backend schema
    const questionsData = blocks.map((b, idx) => {
      // Extract clean text without HTML tags
      const cleanQuestionTitle = b.mcqQuestion?.questionTitle?.replace(/<[^>]*>/g, "").trim() || "";
      
      // Prepare options array
      const options = b.mcqQuestion.options.map((o, oi) => {
        const option = {
          text: o.text.trim(),
          isCorrect: o.isCorrect,
          imageAlignment: o.imageAlignment || "left",
          imageSizePercent: o.imageSizePercent || 100
        };
        
        // Handle option images
        if (o.imageUrl?.startsWith("data:")) {
          const imageKey = `question_${idx}_option_${oi}_image`;
          const file = base64ToFile(o.imageUrl, `option_${b.id}_${o.id}_${Date.now()}.jpg`);
          if (file) {
            formData.append(imageKey, file);
            // Store reference to the image field
            option.imageUrl = imageKey;
          }
        } else if (o.imageUrl) {
          option.imageUrl = o.imageUrl; // Existing URL
        } else {
          option.imageUrl = null;
        }
        
        return option;
      });

      // Prepare correct answers array (filter out empty strings)
      const correctAnswers = b.mcqQuestion.correctAnswers.filter(ans => ans && ans.trim());

      // Build question data matching backend schema
      const questionData = {
        // Root level fields - these match what backend expects
        mcqQuestionTitle: cleanQuestionTitle,
        mcqQuestionType: "multiple_choice",
        mcqQuestionOptionsPerRow: b.optionsPerRow || 1,
        mcqQuestionOptions: options,
        mcqQuestionCorrectAnswers: correctAnswers,
        mcqQuestionRequired: b.isRequired || false,
        mcqQuestionDescription: b.hasExplanation ? (b.explanation || "") : "",
        isActive: true,
        sequence: idx,
        videoTimestamp: initialTimestamp,
        timestamp: initialTimestamp
      };

      // Handle question image
      if (b.questionImage?.imageUrl) {
        if (b.questionImage.imageUrl.startsWith("data:")) {
          const imageKey = `question_${idx}_image`;
          const file = base64ToFile(b.questionImage.imageUrl, `question_${b.id}_${Date.now()}.jpg`);
          if (file) {
            formData.append(imageKey, file);
            questionData.mcqQuestionImageUrl = imageKey;
            questionData.mcqQuestionImageAlignment = b.questionImage.alignment || "center";
            questionData.mcqQuestionImageSizePercent = b.questionImage.sizePercent || 60;
          }
        } else {
          questionData.mcqQuestionImageUrl = b.questionImage.imageUrl;
          questionData.mcqQuestionImageAlignment = b.questionImage.alignment || "center";
          questionData.mcqQuestionImageSizePercent = b.questionImage.sizePercent || 60;
        }
      }

      // Handle explanation image
      if (b.hasExplanation && b.explanationImageUrl) {
        if (b.explanationImageUrl.startsWith("data:")) {
          const imageKey = `question_${idx}_explanation_image`;
          const file = base64ToFile(b.explanationImageUrl, `explanation_${b.id}_${Date.now()}.jpg`);
          if (file) {
            formData.append(imageKey, file);
            questionData.explanationImageUrl = imageKey;
          }
        } else {
          questionData.explanationImageUrl = b.explanationImageUrl;
        }
      }

      return questionData;
    });

    // Add questionsData as JSON string
    formData.append("questionsData", JSON.stringify(questionsData));

    // Log for debugging
    console.log("📦 Sending to backend:", {
      url: `${apiBaseUrl}/file-mcq-add/${entityType}/${entityId}`,
      formDataEntries: {
        tabType: formData.get("tabType"),
        subcategory: formData.get("subcategory"),
        folderPath: formData.get("folderPath"),
        fileId: formData.get("fileId"),
        questionsData: JSON.parse(formData.get("questionsData")),
        hasImages: [...formData.entries()].some(entry => entry[1] instanceof File)
      }
    });

    // API call
    const token = typeof localStorage !== "undefined" ? getToken() : "";
    const headers = token ? { Authorization: `Bearer ${token}` } : {};

    const response = await fetch(`${apiBaseUrl}/file-mcq-add/${entityType}/${entityId}`, {
      method: "POST",
      headers,
      body: formData
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message?.[0]?.value || `API error ${response.status}`);
    }

    const result = await response.json();

    // Pass saved questions to parent
    onSave(blocks.map(b => ({
      id: b.id,
      questionTitle: b.mcqQuestion?.questionTitle,
      options: b.mcqQuestion?.options,
      explanation: b.explanation,
      timestamp: initialTimestamp
    })));

    onClose();

  } catch (err) {
    console.error("Failed to save MCQ:", err);
    alert("Failed to save questions: " + err.message);
  } finally {
    setIsSaving(false);
  }
};

  // ── Render options ─────────────────────────────────────────────────────────
  const renderOptions = (block) => {
    const cols = block.optionsPerRow || 1;
    const gridCls = ["grid-cols-1", "grid-cols-2", "grid-cols-3", "grid-cols-4"][cols - 1];

    return (
      <div className={`grid ${gridCls} gap-2`}>
        {block.mcqQuestion.options.map((opt, idx) => (
          <div key={opt.id} className="group/opt relative">
            <div className={`flex flex-col rounded-lg border transition-all overflow-hidden ${
              opt.isCorrect ? "border-emerald-300 bg-emerald-50/40" : "border-slate-200 bg-white hover:border-slate-300"
            }`}>

              {/* Option image */}
              {opt.imageUrl && (
                <div className="px-2 pt-2 relative">
                  {isOptImgActive(block.id, opt.id) && (
                    <ImageToolbar
                      alignment={opt.imageAlignment || "left"} 
                      sizePercent={opt.imageSizePercent || 100}
                      onAlignmentChange={a => updateOption(block.id, opt.id, { imageAlignment: a })}
                      onSizeChange={v => updateOption(block.id, opt.id, { imageSizePercent: v })}
                      onRemove={() => { 
                        updateOption(block.id, opt.id, { imageUrl: null }); 
                        setActiveImgToolbar(null); 
                      }}
                      onClose={() => setActiveImgToolbar(null)}
                    />
                  )}
                  <div style={{ 
                    display: "flex", 
                    justifyContent: opt.imageAlignment === "left" ? "flex-start" : opt.imageAlignment === "right" ? "flex-end" : "center", 
                    marginTop: isOptImgActive(block.id, opt.id) ? 64 : 0 
                  }}>
                    <div style={{ width: `${opt.imageSizePercent || 100}%` }} className="cursor-pointer"
                      onClick={() => setActiveImgToolbar(
                        isOptImgActive(block.id, opt.id) ? null : { type: "option", blockId: block.id, optionId: opt.id }
                      )}>
                      <img src={opt.imageUrl} alt=""
                        className={`w-full h-auto rounded-md border-2 transition-all ${
                          isOptImgActive(block.id, opt.id) ? "border-violet-400 ring-2 ring-violet-100" : "border-transparent hover:border-violet-200"
                        }`}/>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2 px-2.5 py-2">
                {/* Correct toggle */}
                <button type="button" className="flex-shrink-0"
                  onClick={() => block.type === "checkboxes" ? toggleCorrect(block.id, opt.id) : setCorrect(block.id, opt.id)}>
                  {block.type === "checkboxes" ? (
                    <div className={`w-3.5 h-3.5 rounded border-2 flex items-center justify-center transition-all ${
                      opt.isCorrect ? "border-emerald-500 bg-emerald-500" : "border-slate-300 hover:border-violet-400"
                    }`}>
                      {opt.isCorrect && <svg className="h-2 w-2 text-white" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 010 1.414l-8 8a1 1 01-1.414 0l-4-4a1 1 011.414-1.414L8 12.586l7.293-7.293a1 1 011.414 0z" clipRule="evenodd"/></svg>}
                    </div>
                  ) : (
                    <div className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center transition-all ${
                      opt.isCorrect ? "border-emerald-500 bg-emerald-500" : "border-slate-300 hover:border-violet-400"
                    }`}>
                      {opt.isCorrect && <div className="w-1.5 h-1.5 rounded-full bg-white"/>}
                    </div>
                  )}
                </button>

                <input 
                  type="text" 
                  value={opt.text}
                  onChange={e => updateOptionText(block.id, opt.id, e.target.value)}
                  placeholder={`Option ${String.fromCharCode(65 + idx)}`}
                  className={`flex-1 text-xs outline-none bg-transparent placeholder:text-slate-300 ${
                    opt.isCorrect ? "text-emerald-700 font-semibold" : "text-slate-700"
                  }`}
                />

                <div className="opacity-0 group-hover/opt:opacity-100 flex items-center gap-0.5 transition-opacity">
                  {/* Add image to option */}
                  {!opt.imageUrl && (
                    <label className="cursor-pointer p-1 hover:bg-slate-100 rounded-md transition-colors" title="Add image to option">
                      <Image className="h-3 w-3 text-slate-400"/>
                      <input type="file" accept="image/*" className="hidden"
                        onChange={e => { const f = e.target.files?.[0]; if (f) uploadOptionImage(block.id, opt.id, f); }}/>
                    </label>
                  )}
                  {block.mcqQuestion.options.length > 2 && (
                    <button onClick={() => removeOption(block.id, opt.id)} className="p-1 hover:bg-red-50 rounded-md transition-colors">
                      <X className="h-3 w-3 text-slate-300 hover:text-red-400"/>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  // ── Render question content ────────────────────────────────────────────────
  const renderQuestionContent = (block) => {
    if (collapsedState[block.id]) return null;

    return (
      <div className="px-4 py-3 space-y-2.5">
        <div className="flex items-center justify-between">
          <OptionsPerRowPicker value={block.optionsPerRow || 1} onChange={v => updateBlock(block.id, { optionsPerRow: v })}/>
          <span className={`text-[10px] px-2 py-0.5 rounded font-semibold ${
            typeConfig[block.type]?.bg || "bg-slate-50"
          } ${
            typeConfig[block.type]?.color || "text-slate-600"
          }`}>
            {block.type === "multiple-choice" ? "Single correct" : block.type === "checkboxes" ? "Multiple correct" : "Dropdown"}
          </span>
        </div>
        {renderOptions(block)}
        <button onClick={() => addOption(block.id)} className="text-[11px] text-violet-500 hover:text-violet-700 font-semibold">
          + Add option
        </button>
        {errors[block.id]?.options && (
          <div className="flex items-center gap-1.5 text-xs text-red-600 bg-red-50 px-2.5 py-1.5 rounded-lg">
            <AlertCircle className="h-3.5 w-3.5"/>{errors[block.id].options}
          </div>
        )}
        {errors[block.id]?.correctAnswer && (
          <div className="flex items-center gap-1.5 text-xs text-amber-600 bg-amber-50 px-2.5 py-1.5 rounded-lg">
            <AlertCircle className="h-3.5 w-3.5"/>{errors[block.id].correctAnswer}
          </div>
        )}
      </div>
    );
  };

  // ── Main render ────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-900/60 backdrop-blur-sm">
      {/* HEADER - same as before */}
      <div className="flex items-center justify-between px-5 py-3 bg-white border-b border-slate-200 shadow-sm flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-violet-600 flex items-center justify-center shadow-sm">
            <HelpCircle className="h-4 w-4 text-white"/>
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900">Add MCQ Questions</h2>
            <p className="text-[11px] text-slate-400 mt-0.5">
              At timestamp <span className="font-mono text-violet-600">{formatTime(initialTimestamp)}</span>
              &nbsp;·&nbsp;{blocks.length} question{blocks.length !== 1 ? "s" : ""}
              {fileName && <span className="ml-2">· {fileName}</span>}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <div className="relative">
            <button onClick={() => setShowSettings(s => !s)} className="p-2 hover:bg-slate-100 rounded-lg transition-colors" title="Settings">
              <SlidersHorizontal className="h-4 w-4 text-slate-500"/>
            </button>
            <SettingsMenu 
              isOpen={showSettings} 
              onClose={() => setShowSettings(false)} 
              onCollapseAll={collapseAll} 
              onExpandAll={expandAll}
            />
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
            <X className="h-4 w-4 text-slate-400"/>
          </button>
        </div>
      </div>

      {/* BODY */}
      <div className="flex-1 overflow-y-auto bg-slate-50/80 px-4 py-4">
        <div className="space-y-3 max-w-3xl mx-auto">
          {blocks.map((block, idx) => {
            const collapsed = collapsedState[block.id] || false;
            const hasErr = !!errors[block.id];
            const qtype = typeConfig[block.type] || typeConfig["multiple-choice"];

            return (
              <div key={block.id} className={`bg-white rounded-xl border shadow-sm transition-all ${
                hasErr ? "border-red-300 shadow-red-100" : "border-slate-200 hover:border-slate-300"
              }`}>

                {/* Card header */}
                <div className="flex items-start gap-2.5 px-4 pt-3.5 pb-2">
                  <div className="flex-shrink-0 w-6 h-6 rounded-md bg-violet-600 flex items-center justify-center text-[10px] font-black text-white mt-0.5">
                    {idx + 1}
                  </div>

                  <button onClick={() => setCollapsed(p => ({ ...p, [block.id]: !p[block.id] }))} 
                    className="flex-shrink-0 p-1 hover:bg-slate-100 rounded-md transition-colors mt-0.5">
                    {collapsed ? <ChevronRight className="h-3.5 w-3.5 text-slate-400"/> : <ChevronDown className="h-3.5 w-3.5 text-slate-400"/>}
                  </button>

                  <div className="flex-1 min-w-0">
                    {collapsed ? (
                      <p className="text-xs text-slate-500 py-0.5 truncate">
                        {block.mcqQuestion?.questionTitle?.replace(/<[^>]*>/g, "").trim() || <span className="italic text-slate-300">Empty question</span>}
                      </p>
                    ) : (
                      <>
                        {/* Add question image */}
                        {!block.questionImage?.imageUrl && (
                          <label className="inline-flex items-center gap-1 text-[10px] text-slate-400 hover:text-violet-600 cursor-pointer transition-colors mb-1.5">
                            <Image className="h-2.5 w-2.5"/><span>Add image to question</span>
                            <input type="file" accept="image/*" className="hidden"
                              onChange={e => { const f = e.target.files?.[0]; if (f) uploadQuestionImage(block.id, f); }}/>
                          </label>
                        )}

                        {/* Question title input */}
                        <input
                          type="text"
                          value={block.mcqQuestion?.questionTitle || ""}
                          onChange={e => updateMcqQuestion(block.id, { questionTitle: e.target.value })}
                          placeholder="Type your question here..."
                          className="w-full text-sm font-medium outline-none border-b-2 border-slate-200 focus:border-violet-400 pb-1.5 mb-2"
                        />

                        {/* Question image preview */}
                        {block.questionImage?.imageUrl && (
                          <div className="mt-2 relative">
                            {isQImgActive(block.id) && (
                              <ImageToolbar
                                alignment={block.questionImage.alignment || "center"} 
                                sizePercent={block.questionImage.sizePercent || 60}
                                onAlignmentChange={a => updateQuestionImageAlignment(block.id, a)}
                                onSizeChange={v => updateQuestionImageSize(block.id, v)}
                                onRemove={() => { 
                                  updateBlock(block.id, { 
                                    questionImage: { imageUrl: "", alignment: "center", sizePercent: 60 } 
                                  }); 
                                  setActiveImgToolbar(null); 
                                }}
                                onClose={() => setActiveImgToolbar(null)}
                              />
                            )}
                            <div style={{ 
                              display: "flex", 
                              justifyContent: block.questionImage.alignment === "left" ? "flex-start" : block.questionImage.alignment === "right" ? "flex-end" : "center", 
                              marginTop: isQImgActive(block.id) ? 64 : 0 
                            }}>
                              <div style={{ width: `${block.questionImage.sizePercent || 60}%` }} className="cursor-pointer"
                                onClick={() => setActiveImgToolbar(
                                  isQImgActive(block.id) ? null : { type: "question", blockId: block.id }
                                )}>
                                <img src={block.questionImage.imageUrl} alt=""
                                  className={`w-full h-auto rounded-lg border-2 transition-all ${
                                    isQImgActive(block.id) ? "border-violet-400 ring-2 ring-violet-100" : "border-transparent hover:border-violet-200"
                                  }`}/>
                              </div>
                            </div>
                          </div>
                        )}

                        {hasErr && errors[block.id]?.questionTitle && (
                          <div className="mt-2 flex items-center gap-1.5 text-xs text-red-600 bg-red-50 px-2.5 py-1.5 rounded-lg">
                            <AlertCircle className="h-3.5 w-3.5"/>{errors[block.id].questionTitle}
                          </div>
                        )}

                        {/* Explanation */}
                        <div className="mt-2.5">
                          <label className="flex items-center gap-1.5 cursor-pointer">
                            <input type="checkbox" checked={block.hasExplanation}
                              onChange={() => updateBlock(block.id, { hasExplanation: !block.hasExplanation })}
                              className="w-3.5 h-3.5 rounded border-slate-300 accent-violet-600"/>
                            <span className="text-[11px] text-slate-400 hover:text-violet-600 transition-colors flex items-center gap-1">
                              <HelpCircle className="h-3 w-3"/>Add explanation
                            </span>
                          </label>
                          
                          {block.hasExplanation && (
                            <div className="mt-1.5 ml-5 pl-3 border-l-2 border-violet-200 space-y-2">
                              <textarea
                                value={block.explanation || ""}
                                onChange={e => updateBlock(block.id, { explanation: e.target.value })}
                                placeholder="Explain the correct answer…"
                                className="w-full text-sm border border-slate-200 rounded-lg p-2 min-h-[80px] focus:outline-none focus:ring-2 focus:ring-violet-400"
                              />
                              
                              {/* Explanation image */}
                              {!block.explanationImageUrl ? (
                                <label className="inline-flex items-center gap-1 text-[10px] text-slate-400 hover:text-violet-600 cursor-pointer transition-colors">
                                  <Image className="h-2.5 w-2.5"/><span>Add image to explanation</span>
                                  <input type="file" accept="image/*" className="hidden"
                                    onChange={e => { const f = e.target.files?.[0]; if (f) uploadExplanationImage(block.id, f); }}/>
                                </label>
                              ) : (
                                <div className="relative mt-2">
                                  {isExpImgActive(block.id) && (
                                    <ImageToolbar
                                      alignment="left" 
                                      sizePercent={60}
                                      onAlignmentChange={() => {}}
                                      onSizeChange={() => {}}
                                      onRemove={() => { 
                                        updateBlock(block.id, { explanationImageUrl: "" }); 
                                        setActiveImgToolbar(null); 
                                      }}
                                      onClose={() => setActiveImgToolbar(null)}
                                    />
                                  )}
                                  <div style={{ marginTop: isExpImgActive(block.id) ? 64 : 0 }}>
                                    <img 
                                      src={block.explanationImageUrl} 
                                      alt="Explanation" 
                                      className="w-full max-w-xs rounded-lg border border-slate-200 cursor-pointer"
                                      onClick={() => setActiveImgToolbar(
                                        isExpImgActive(block.id) ? null : { type: "explanation", blockId: block.id }
                                      )}
                                    />
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>

                  {/* Type picker */}
                  <div className="relative flex-shrink-0">
                    <button onClick={() => setShowTypeMenu(showTypeMenu === block.id ? null : block.id)}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
                        qtype.bg} ${qtype.color} border-transparent hover:border-current/20`}>
                      {qtype.icon}<span className="max-w-[80px] truncate">{qtype.label}</span><ChevronDown className="h-3 w-3 opacity-60"/>
                    </button>
                    {showTypeMenu === block.id && (
                      <div className="absolute top-full right-0 mt-1 w-48 bg-white rounded-xl shadow-2xl border border-slate-200 py-1.5 z-50">
                        <p className="px-3 py-1 text-[9px] font-bold text-slate-300 uppercase tracking-widest">Question Type</p>
                        {Object.entries(typeConfig).map(([t, cfg]) => (
                          <button key={t} onClick={() => { 
                            updateBlock(block.id, { type: t }); 
                            setShowTypeMenu(null); 
                          }}
                            className={`w-full px-3 py-2 flex items-center gap-2 hover:bg-slate-50 text-xs ${
                              block.type === t ? `${cfg.color} font-semibold` : "text-slate-700"
                            }`}>
                            <span className={block.type === t ? cfg.color : "text-slate-400"}>{cfg.icon}</span>
                            {cfg.label}
                            {block.type === t && <Check className="h-3 w-3 ml-auto"/>}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Options area */}
                {renderQuestionContent(block)}

                {/* Card footer */}
                <div className="flex items-center justify-between px-4 py-2 border-t border-slate-100 bg-slate-50/50 rounded-b-xl">
                  <div className="flex items-center gap-0.5">
                    <button onClick={() => duplicateBlock(block.id)} title="Duplicate" className="p-1.5 hover:bg-white hover:shadow-sm rounded-lg text-slate-400 hover:text-slate-700 transition-all">
                      <Copy className="h-3.5 w-3.5"/>
                    </button>
                    <button onClick={() => removeBlock(block.id)} title="Delete" className="p-1.5 hover:bg-red-50 rounded-lg text-slate-400 hover:text-red-500 transition-all">
                      <Trash2 className="h-3.5 w-3.5"/>
                    </button>
                    <div className="w-px h-4 bg-slate-200 mx-1"/>
                    <button onClick={() => moveBlock(block.id, "up")} disabled={idx === 0} className="p-1.5 hover:bg-white rounded-lg text-slate-400 hover:text-slate-700 disabled:opacity-25 disabled:cursor-not-allowed transition-all">
                      <ChevronUp className="h-3.5 w-3.5"/>
                    </button>
                    <button onClick={() => moveBlock(block.id, "down")} disabled={idx === blocks.length - 1} className="p-1.5 hover:bg-white rounded-lg text-slate-400 hover:text-slate-700 disabled:opacity-25 disabled:cursor-not-allowed transition-all">
                      <ChevronDown className="h-3.5 w-3.5"/>
                    </button>
                  </div>

                  {/* Required toggle */}
                  <label className="flex items-center gap-2 cursor-pointer">
                    <span className="text-[11px] font-semibold text-slate-500">Required</span>
                    <button type="button" onClick={() => updateBlock(block.id, { isRequired: !block.isRequired })}
                      className={`relative rounded-full transition-colors ${block.isRequired ? "bg-violet-600" : "bg-slate-200"}`}
                      style={{ width: 32, height: 18 }}>
                      <div className={`absolute top-0.5 h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform ${
                        block.isRequired ? "translate-x-3.5" : "translate-x-0.5"
                      }`}/>
                    </button>
                  </label>
                </div>
              </div>
            );
          })}
        </div>

        {/* Add question */}
        <div className="max-w-3xl mx-auto mt-3">
          <button onClick={addBlock}
            className="w-full border-2 border-dashed border-slate-300 hover:border-violet-400 py-3.5 rounded-xl flex items-center justify-center gap-2 text-sm font-bold text-slate-500 hover:text-violet-700 hover:bg-violet-50 transition-all">
            <Plus className="h-5 w-5"/>Add another question
          </button>
        </div>
      </div>

      {/* FOOTER */}
      <div className="flex items-center justify-between px-5 py-3 border-t border-slate-200 bg-white flex-shrink-0">
        <span className="flex items-center gap-1.5 text-xs text-slate-500">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400"/>
          {blocks.length} question{blocks.length !== 1 ? "s" : ""} ready
        </span>
        <div className="flex items-center gap-2">
          <button onClick={onClose} className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-lg text-xs font-semibold transition-all">
            Cancel
          </button>
          <button onClick={handleSave} disabled={isSaving}
            className="px-5 py-2 rounded-lg text-xs font-bold text-white flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 shadow-sm transition-all">
            {isSaving ? <><Loader className="h-3.5 w-3.5 animate-spin"/>Saving…</> : <><Save className="h-3.5 w-3.5"/>Save Questions</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── VIDEO VIEWER ──────────────────────────────────────────────────────────────
export default function VideoViewer({
  fileUrl = "",
  fileName = "",
  fileId = "",
  entityType = "",
  entityId = "",
  tabType = "",
  subcategory = "",
  folderPath = [],
  onClose,
  apiBaseUrl = "http://localhost:5533",
  availableResolutions = [],       // e.g. ["360p","240p","base"]  ← resolution NAMES from backend
  fileUrlMap = {} as Record<string, string>, // e.g. { "360p": "https://...", "base": "https://..." }
  allVideos = [],
  currentVideoIndex = 0,
  onVideoChange = null,
  // Course Setup → Resource Type → Video: the AI Chat / AI Summary / Notes
  // sub-rows. Staff see the same buttons students do, so they're gated by the
  // same switches. Off by default — a caller that doesn't pass them has no
  // config to go on, and must not surface a feature the course never enabled.
  aiChatEnabled = false,
  aiSummaryEnabled = false,
  notesEnabled = false,
}) {
  const videoRef        = useRef(null);
  const playerRef       = useRef(null);
  const controlsTimeout = useRef(null);
  const playPromise     = useRef(null);
  const qualityMenuRef  = useRef(null);  // wraps the whole quality selector widget

  const [isPlaying,    setIsPlaying]    = useState(false);
  const [currentTime,  setCurrentTime]  = useState(0);
  const [duration,     setDuration]     = useState(0);
  const [volume,       setVolume]       = useState(1);
  const [isMuted,      setIsMuted]      = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [buffering,    setBuffering]    = useState(false);
  const [videoError,   setVideoError]   = useState("");

  // Quality selector state
  const [selectedQuality, setSelectedQuality] = useState("auto");
  const [activeVideoUrl,  setActiveVideoUrl]  = useState(fileUrl);
  const [showQualityMenu, setShowQualityMenu] = useState(false);

  // ── Quality helpers ────────────────────────────────────────────────────────

  /** Human-readable label for a resolution name from the backend (e.g. "360p" → "360p", "base" → "HD") */
  const getQualityLabel = (resName: string): string => {
    if (!resName) return "HD";
    if (resName === "base") return "HD";
    return resName; // "360p", "240p", "720p", etc. are already good labels
  };

  /** Pick the best resolution NAME for the current network conditions */
  const getNetworkQualityName = (resolutions: string[]): string => {
    if (!resolutions.length) return "";
    const conn = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
    const effectiveType: string = conn?.effectiveType || "4g";
    const downlink: number = conn?.downlink ?? 10;
    const pick = (name: string) => resolutions.find(r => r.toLowerCase() === name.toLowerCase());
    // Slow network → lowest quality
    if (effectiveType === "slow-2g" || effectiveType === "2g" || downlink < 0.5) {
      return pick("240p") || resolutions[resolutions.length - 1];
    }
    // Medium network → medium quality
    if (effectiveType === "3g" || downlink < 2) {
      return pick("360p") || pick("480p") || resolutions[Math.floor(resolutions.length / 2)];
    }
    // Fast network → original / highest quality
    return pick("base") || pick("1080p") || pick("720p") || resolutions[0];
  };

  /** Resolve a resolution name to its actual playback URL */
  const getUrlForResName = (resName: string): string => {
    if (!resName) return fileUrl;
    // First look in the fileUrlMap passed from the backend
    if (fileUrlMap[resName]) return fileUrlMap[resName];
    // Fallback: if the name looks like a URL itself (backward compat), use it directly
    if (resName.includes("://")) return resName;
    return fileUrl;
  };

  // When fileUrl / fileUrlMap props change (e.g. different video in playlist), reset to auto
  useEffect(() => {
    setSelectedQuality("auto");
    const autoName = availableResolutions.length > 0 ? getNetworkQualityName(availableResolutions) : "";
    setActiveVideoUrl(autoName ? getUrlForResName(autoName) : fileUrl);
    setVideoError("");
  }, [fileUrl]);  // eslint-disable-line react-hooks/exhaustive-deps

  // Re-apply network quality when connection speed changes (only when "auto" is selected)
  useEffect(() => {
    const conn = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
    if (!conn || !availableResolutions.length) return;
    const handleChange = () => {
      if (selectedQuality === "auto") {
        const name = getNetworkQualityName(availableResolutions);
        setActiveVideoUrl(name ? getUrlForResName(name) : fileUrl);
      }
    };
    conn.addEventListener("change", handleChange);
    return () => conn.removeEventListener("change", handleChange);
  }, [fileUrl, fileUrlMap, availableResolutions, selectedQuality]);  // eslint-disable-line react-hooks/exhaustive-deps

  const handleQualityChange = (res: string) => {
    const wasPlaying = isPlaying;
    if (wasPlaying) safePause();
    const saved = videoRef.current?.currentTime || 0;

    // Resolve the chosen resolution name → actual URL
    let newUrl: string;
    if (res === "auto") {
      const autoName = availableResolutions.length > 0 ? getNetworkQualityName(availableResolutions) : "";
      newUrl = autoName ? getUrlForResName(autoName) : fileUrl;
    } else {
      newUrl = getUrlForResName(res);
    }

    setSelectedQuality(res);
    setShowQualityMenu(false);
    setActiveVideoUrl(newUrl);   // keep React state in sync

    // Directly assign src on the DOM element so the swap is instant and
    // not dependent on React's render cycle completing before load() runs
    if (videoRef.current) {
      videoRef.current.src = newUrl;
      videoRef.current.load();
      videoRef.current.addEventListener("loadedmetadata", () => {
        if (!videoRef.current) return;
        videoRef.current.currentTime = saved;
        if (wasPlaying) safePlay();
      }, { once: true });
    }
  };

  // Close quality menu when user clicks / taps outside the quality widget.
  // Uses mousedown so it fires before any click handler, and checks the ref
  // so clicks INSIDE the widget (on the options) are never intercepted.
  useEffect(() => {
    if (!showQualityMenu) return;
    const handleOutside = (e: MouseEvent) => {
      if (qualityMenuRef.current && !(qualityMenuRef.current as HTMLElement).contains(e.target as Node)) {
        setShowQualityMenu(false);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [showQualityMenu]);

  const [notesOpen,    setNotesOpen]    = useState(false);
  const [aiOpen,       setAiOpen]       = useState(false);
  const showAIButton = aiChatEnabled || aiSummaryEnabled;

  const [contextMenu,   setContextMenu]  = useState({ x:0, y:0, show:false });
  const [menuTimestamp, setMenuTimestamp]= useState(0);

  const [showMcqForm,  setShowMcqForm]  = useState(false);
  const [mcqTimestamp, setMcqTimestamp] = useState(0);
  const [savedMcqs,    setSavedMcqs]    = useState([]);
  const [showMcqList,  setShowMcqList]  = useState(false);
  const [showAnnotationModal, setShowAnnotationModal] = useState(false);
  const [annotationTimestamp, setAnnotationTimestamp] = useState(0);

  // ── Playback ────────────────────────────────────────────────────────────────
  const safePlay = async () => {
    if (!videoRef.current) return;
    try { playPromise.current=videoRef.current.play(); await playPromise.current; setIsPlaying(true); }
    catch { setIsPlaying(false); }
  };

  const safePause = () => {
    if (!videoRef.current) return;
    videoRef.current.pause(); setIsPlaying(false);
    if (playPromise.current) { playPromise.current.catch(()=>{}); playPromise.current=null; }
  };

  const handlePlayPause   = () => isPlaying ? safePause() : safePlay();
  const handleSeek        = (t) => { if (videoRef.current) { videoRef.current.currentTime=t; setCurrentTime(t); } };
  const handleVolumeChange= (v) => { if (videoRef.current) { videoRef.current.volume=v; setVolume(v); setIsMuted(v===0); } };
  const handleToggleMute  = () => { if (videoRef.current) { videoRef.current.muted=!isMuted; setIsMuted(!isMuted); } };

  const handleFullscreen = async () => {
    if (!playerRef.current) return;
    try { if (!isFullscreen) await playerRef.current.requestFullscreen(); else await document.exitFullscreen(); setIsFullscreen(!isFullscreen); }
    catch {}
  };

  const showControlsTemporarily = () => {
    setShowControls(true);
    if (controlsTimeout.current) clearTimeout(controlsTimeout.current);
    // Don't start the hide timer while the quality menu is open
    if (!showQualityMenu) {
      controlsTimeout.current = setTimeout(()=>{ if (isPlaying) setShowControls(false); },3000);
    }
  };

  useEffect(()=>{
    if (isPlaying) controlsTimeout.current=setTimeout(()=>setShowControls(false),3000);
    else setShowControls(true);
    return ()=>{ if (controlsTimeout.current) clearTimeout(controlsTimeout.current); };
  },[isPlaying]);

  // Keep controls visible while quality menu is open; restart timer when it closes
  useEffect(()=>{
    if (showQualityMenu) {
      if (controlsTimeout.current) clearTimeout(controlsTimeout.current);
      setShowControls(true);
    } else if (isPlaying) {
      if (controlsTimeout.current) clearTimeout(controlsTimeout.current);
      controlsTimeout.current = setTimeout(()=>setShowControls(false), 3000);
    }
  },[showQualityMenu]);


  useEffect(()=>{
    if (showMcqForm) return;
    const h=(e)=>{
      switch(e.key){
        case " ": case "k": e.preventDefault(); handlePlayPause(); break;
        case "f": e.preventDefault(); handleFullscreen(); break;
        case "m": e.preventDefault(); handleToggleMute(); break;
        case "ArrowLeft":  e.preventDefault(); handleSeek(Math.max(0,currentTime-10)); break;
        case "ArrowRight": e.preventDefault(); handleSeek(Math.min(duration,currentTime+10)); break;
      }
    };
    document.addEventListener("keydown",h);
    return ()=>document.removeEventListener("keydown",h);
  },[isPlaying,currentTime,duration,showMcqForm]);

  useEffect(()=>{
    const h=()=>setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange",h);
    return ()=>document.removeEventListener("fullscreenchange",h);
  },[]);

  useEffect(()=>{
    const h=()=>{ setContextMenu({x:0,y:0,show:false}); setShowQualityMenu(false); };
    document.addEventListener("click",h);
    return ()=>document.removeEventListener("click",h);
  },[]);

  useEffect(()=>()=>{
    if (controlsTimeout.current) clearTimeout(controlsTimeout.current);
    if (videoRef.current) { videoRef.current.pause(); videoRef.current.src=""; }
  },[]);

  // ── Context menu ────────────────────────────────────────────────────────────
  const handleContextMenu = (e) => {
    e.preventDefault();
    setMenuTimestamp(videoRef.current?.currentTime||0);
    setContextMenu({x:e.clientX,y:e.clientY,show:true});
  };

const openMcqForm = () => {
  setMcqTimestamp(menuTimestamp);
  setContextMenu({ x: 0, y: 0, show: false });
  if (isPlaying) safePause();
  setShowMcqForm(true);
};

  const handleMcqSave = (questions) => {
    setSavedMcqs(prev=>[...prev,...questions.map(q=>({...q,savedAt:new Date()}))]);
    setShowMcqForm(false);
  };

  const mcqMarkers = savedMcqs.filter((m,i,arr)=>arr.findIndex(x=>Math.abs(x.timestamp-m.timestamp)<0.5)===i);
  const progress   = duration>0?(currentTime/duration)*100:0;

  return (
    <div className="fixed inset-0 z-40 bg-black">
      <div ref={playerRef} className="w-full h-full relative" onMouseMove={showControlsTemporarily} onContextMenu={handleContextMenu}>

        {/* Video element */}
        {!videoError ? (
          <>
            <video ref={videoRef} src={activeVideoUrl} className="w-full h-full object-contain"
              onTimeUpdate={()=>{ if(videoRef.current) setCurrentTime(videoRef.current.currentTime); }}
              onLoadedMetadata={()=>{ if(videoRef.current){ setDuration(videoRef.current.duration); setVideoError(""); } }}
              onWaiting={()=>setBuffering(true)} onCanPlay={()=>setBuffering(false)}
              onEnded={()=>setIsPlaying(false)}
              onError={()=>setVideoError("Failed to load video.")}
              preload="metadata"/>
            {buffering && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-10">
                <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-white"/>
              </div>
            )}
          </>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <div className="text-center">
              <div className="text-red-400 text-5xl mb-4">⚠️</div>
              <p className="text-white font-semibold mb-1">Could not load video</p>
              <p className="text-white/50 text-sm mb-5">{videoError}</p>
              {onClose && <button onClick={onClose} className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-sm rounded-xl transition-colors">Close</button>}
            </div>
          </div>
        )}

        {/* Right-click context menu */}
        {contextMenu.show && (
          <div className="fixed z-50 bg-gray-900/95 backdrop-blur-sm border border-gray-700 rounded-lg shadow-xl py-1 w-56"
            style={{left:contextMenu.x,top:contextMenu.y}}>
            <div className="px-3 py-2 text-xs text-gray-400 border-b border-gray-700">
              At <span className="font-mono text-yellow-400">{formatTime(menuTimestamp)}</span>
            </div>
            <button onClick={openMcqForm}
              className="w-full px-3 py-2.5 text-left text-sm text-white hover:bg-gray-800 flex items-center gap-2 transition-colors">
              <HelpCircle className="w-4 h-4 text-violet-400"/>
              <span>Add MCQ Question</span>
            </button>
          </div>
        )}

        {/* Controls overlay */}
        {showControls && !videoError && (
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent z-20">

            {/* Top bar */}
            <div className="absolute top-0 left-0 right-0 p-4 flex items-center justify-between">
              {/* <div className="flex items-center gap-3">
                <div className="text-white text-sm font-medium truncate max-w-xs" title={fileName}>{fileName||"Video"}</div>
                <div className="text-white/60 text-xs bg-black/40 px-2 py-1 rounded">Right-click to add MCQ</div>
              </div> */}
              <div className="flex items-center gap-1.5">
                {savedMcqs.length>0 && (
                  <button onClick={()=>setShowMcqList(!showMcqList)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${showMcqList?"bg-yellow-500 text-black":"text-white hover:bg-white/20"}`}>
                    <HelpCircle className="w-4 h-4"/>MCQs ({savedMcqs.length})
                  </button>
                )}
                <button
                  onClick={() => { setAnnotationTimestamp(currentTime); setShowAnnotationModal(true) }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-white hover:bg-white/20 transition-colors"
                  title="Add MCQ at current timestamp"
                >
                  <HelpCircle className="w-4 h-4 text-violet-400"/>+ Add MCQ
                </button>
                {notesEnabled && (
                  <button onClick={()=>{ setNotesOpen(!notesOpen); setAiOpen(false); }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${notesOpen?"bg-blue-600 text-white":"text-white hover:bg-white/20"}`}>
                    <FileText className="w-4 h-4"/>Notes
                  </button>
                )}
                {/* One AI button covering both switches — either one on is
                    enough to make the assistant reachable. */}
                {showAIButton && (
                  <button onClick={()=>{ setAiOpen(!aiOpen); setNotesOpen(false); }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${aiOpen?"bg-purple-600 text-white":"text-white hover:bg-white/20"}`}>
                    <Sparkles className="w-4 h-4"/>AI
                  </button>
                )}
                {onClose && (
                  <button onClick={()=>{ safePause(); onClose(); }} className="ml-2 text-white/70 hover:text-white hover:bg-white/20 p-2 rounded-lg transition-colors">
                    <X className="w-5 h-5"/>
                  </button>
                )}
              </div>
            </div>

            {/* Center play */}
            {!isPlaying && (
              <div className="absolute inset-0 flex items-center justify-center z-30" onClick={handlePlayPause}>
                <button className="bg-black/50 hover:bg-black/70 text-white rounded-full p-6 transition-all hover:scale-110">
                  <Play className="w-16 h-16 ml-2"/>
                </button>
              </div>
            )}

            {/* Bottom controls */}
            <div className="absolute bottom-0 left-0 right-0 p-4 space-y-2 z-30">
              {/* Progress bar */}
              <div className="relative group">
                <div className="h-2 bg-gray-600 rounded-full cursor-pointer relative overflow-visible">
                  {mcqMarkers.map((m,i)=>{
                    const pct=duration>0?(m.timestamp/duration)*100:0;
                    return (
                      <div key={i} style={{left:`${pct}%`}} title={`MCQ at ${formatTime(m.timestamp)}`}
                        onClick={()=>handleSeek(m.timestamp)}
                        className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-yellow-400 rounded-full cursor-pointer border-2 border-yellow-200 shadow z-10 -translate-x-1/2 hover:scale-125 transition-transform"/>
                    );
                  })}
                  <div className="h-full bg-red-600 rounded-full relative transition-all duration-100" style={{width:`${progress}%`}}>
                    <div className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 bg-red-600 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"/>
                  </div>
                </div>
                <input type="range" min={0} max={duration||100} value={currentTime}
                  onChange={e=>handleSeek(parseFloat(e.target.value))}
                  className="absolute inset-0 w-full h-4 opacity-0 cursor-pointer"/>
                <div className="flex justify-between text-white text-xs mt-1">
                  <span>{formatTime(currentTime)}</span>
                  <span>{formatTime(duration)}</span>
                </div>
              </div>

              {/* Buttons row */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button onClick={handlePlayPause} className="text-white bg-black/50 hover:bg-black/70 p-3 rounded-full transition-colors">
                    {isPlaying ? <Pause className="w-6 h-6"/> : <Play className="w-6 h-6 ml-0.5"/>}
                  </button>
                  <div className="flex items-center gap-2">
                    <button onClick={handleToggleMute} className="text-white hover:bg-white/20 p-2 rounded transition-colors">
                      {isMuted||volume===0 ? <VolumeX className="w-5 h-5"/> : <Volume2 className="w-5 h-5"/>}
                    </button>
                    <input type="range" min={0} max={1} step={0.1} value={isMuted?0:volume}
                      onChange={e=>handleVolumeChange(parseFloat(e.target.value))}
                      className="w-24 accent-white"/>
                  </div>
                  <div className="text-white text-sm font-mono bg-black/50 px-2 py-1 rounded">
                    {formatTime(currentTime)} / {formatTime(duration)}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {/* Quality selector */}
                  {availableResolutions.length > 0 && (
                    <div className="relative" ref={qualityMenuRef}>
                      {/* Toggle button */}
                      <button
                        onClick={() => setShowQualityMenu(p => !p)}
                        className="flex items-center gap-1.5 bg-black/80 text-white border border-gray-600 rounded px-3 py-1 text-sm cursor-pointer hover:border-gray-400 transition-colors">
                        <SlidersHorizontal className="w-3.5 h-3.5"/>
                        <span>
                          {selectedQuality === "auto"
                            ? `Auto · ${getQualityLabel(getNetworkQualityName(availableResolutions))}`
                            : getQualityLabel(selectedQuality)}
                        </span>
                      </button>

                      {/* Dropdown — no backdrop needed; outside clicks handled via mousedown+ref */}
                      {showQualityMenu && (
                        <div className="absolute bottom-full mb-2 right-0 bg-gray-900 border border-gray-700 rounded-lg shadow-xl overflow-hidden min-w-[130px]" style={{ zIndex: 9999 }}>
                          <div className="px-3 py-1.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-700">
                            Quality
                          </div>

                          {/* Auto */}
                          <button
                            onClick={() => handleQualityChange("auto")}
                            className={`w-full text-left px-3 py-2 text-sm transition-colors flex items-center justify-between gap-2 ${selectedQuality === "auto" ? "bg-blue-600 text-white" : "text-gray-200 hover:bg-gray-800"}`}>
                            <span>Auto</span>
                            <span className="text-[10px] opacity-60">{getQualityLabel(getNetworkQualityName(availableResolutions))}</span>
                            {selectedQuality === "auto" && <span className="w-1.5 h-1.5 rounded-full bg-white flex-shrink-0"/>}
                          </button>

                          {/* One row per resolution name from backend */}
                          {availableResolutions.map((res) => (
                            <button key={res}
                              onClick={() => handleQualityChange(res)}
                              className={`w-full text-left px-3 py-2 text-sm transition-colors flex items-center justify-between gap-2 ${selectedQuality === res ? "bg-blue-600 text-white" : "text-gray-200 hover:bg-gray-800"}`}>
                              <span>{getQualityLabel(res)}</span>
                              {selectedQuality === res && <span className="w-1.5 h-1.5 rounded-full bg-white flex-shrink-0"/>}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  <select value={playbackRate}
                    onChange={e=>{ const r=parseFloat(e.target.value); setPlaybackRate(r); if(videoRef.current) videoRef.current.playbackRate=r; }}
                    className="bg-black/80 text-white border border-gray-600 rounded px-3 py-1 text-sm cursor-pointer">
                    {[0.25,0.5,0.75,1,1.25,1.5,2].map(r=><option key={r} value={r}>{r===1?"Normal":`${r}x`}</option>)}
                  </select>
                  <button onClick={handleFullscreen} className="text-white hover:bg-white/20 p-2 rounded transition-colors">
                    {isFullscreen ? <Minimize className="w-5 h-5"/> : <Maximize className="w-5 h-5"/>}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Notes panel */}
        {notesOpen && notesEnabled && (
          <div className="absolute top-20 left-4 w-80 h-[calc(100vh-160px)] bg-gray-900/95 backdrop-blur-sm border border-gray-700 rounded-lg z-40 flex flex-col">
            <div className="p-4 border-b border-gray-700 flex items-center justify-between">
              <h3 className="text-white font-semibold">Notes</h3>
              <button onClick={()=>setNotesOpen(false)} className="text-gray-400 hover:text-white p-1 rounded hover:bg-white/10"><X className="w-5 h-5"/></button>
            </div>
            <div className="flex-1 p-4">
              <textarea className="w-full h-full bg-gray-800 text-white rounded p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Add your notes here…"/>
            </div>
          </div>
        )}

        {/* AI panel */}
        {aiOpen && showAIButton && (
          <div className="absolute top-20 left-4 w-80 h-[calc(100vh-160px)] bg-gray-900/95 backdrop-blur-sm border border-gray-700 rounded-lg z-40 flex flex-col">
            <div className="p-4 border-b border-gray-700 flex items-center justify-between">
              <h3 className="text-white font-semibold">AI Assistant</h3>
              <button onClick={()=>setAiOpen(false)} className="text-gray-400 hover:text-white p-1 rounded hover:bg-white/10"><X className="w-5 h-5"/></button>
            </div>
            <div className="flex-1 p-4 flex items-center justify-center">
              <p className="text-gray-400 text-sm">AI features coming soon…</p>
            </div>
          </div>
        )}

        {/* Saved MCQ list */}
        {showMcqList && savedMcqs.length>0 && (
          <div className="absolute top-20 right-4 w-80 h-[calc(100vh-160px)] bg-gray-900/95 backdrop-blur-sm border border-gray-700 rounded-lg z-40 flex flex-col">
            <div className="p-4 border-b border-gray-700 flex items-center justify-between">
              <h3 className="text-white font-semibold">MCQ Questions ({savedMcqs.length})</h3>
              <button onClick={()=>setShowMcqList(false)} className="text-gray-400 hover:text-white p-1 rounded hover:bg-white/10"><X className="w-5 h-5"/></button>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-2">
              {savedMcqs.map((mcq,i)=>(
                <div key={mcq.id+i} onClick={()=>handleSeek(mcq.timestamp)}
                  className="p-3 rounded-lg hover:bg-gray-800 cursor-pointer transition-colors border border-gray-700">
                  <span className="text-xs text-yellow-400 font-mono">{formatTime(mcq.timestamp)}</span>
                  <p className="text-sm text-white font-medium my-1 line-clamp-2">{mcq.questionText.replace(/<[^>]*>/g,"").trim()||"Untitled"}</p>
                  <div className="space-y-1">
                    {mcq.options.map((opt,oi)=>(
                      <div key={oi} className={`text-xs px-2 py-1 rounded ${opt.isCorrect?"bg-emerald-600/20 text-emerald-400":"text-gray-400"}`}>
                        {String.fromCharCode(65+oi)}. {opt.text||(opt.imageUrl?"[image]":"(empty)")}
                      </div>
                    ))}
                  </div>
                  <div className="mt-1.5 text-[10px] text-gray-500">Click to seek</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Hint */}
        {!isPlaying && savedMcqs.length===0 && showControls && (
          <div className="absolute bottom-32 left-1/2 -translate-x-1/2 z-30 pointer-events-none">
            <div className="bg-black/60 text-white text-xs px-4 py-2 rounded-full border border-white/20 backdrop-blur-sm flex items-center gap-2">
              <HelpCircle className="w-3.5 h-3.5 text-violet-400"/>
              Right-click anywhere on the video to add an MCQ question
            </div>
          </div>
        )}
      </div>

      {/* MCQ Form */}
     {showMcqForm && (
  <MCQQuestionForm
    initialTimestamp={mcqTimestamp}
    onClose={() => setShowMcqForm(false)}
    onSave={handleMcqSave}
    fileId={fileId}
    fileName={fileName}
    entityType={entityType}
    entityId={entityId}
    tabType={tabType}
    subcategory={subcategory}
    folderPath={folderPath}
    apiBaseUrl={apiBaseUrl}
  />
)}

      {showAnnotationModal && (
        <FileMCQAnnotationForm
          positionValue={Math.round(annotationTimestamp)}
          positionLabel={`${Math.floor(annotationTimestamp/60)}:${String(Math.floor(annotationTimestamp%60)).padStart(2,"0")}`}
          positionField="videoTimestamp"
          entityType={entityType}
          entityId={entityId}
          tabType={tabType}
          subcategory={subcategory}
          folderPath={folderPath}
          fileId={fileId}
          apiBaseUrl={apiBaseUrl}
          initialQuestions={savedMcqs.filter(q => Math.abs((q.videoTimestamp||q.timestamp||0) - annotationTimestamp) < 0.5)}
          onQuestionsChanged={updatedQs => {
            setSavedMcqs(prev => {
              const others = prev.filter(q => Math.abs((q.videoTimestamp||q.timestamp||0) - annotationTimestamp) >= 0.5)
              return [...others, ...updatedQs]
            })
          }}
          onClose={() => setShowAnnotationModal(false)}
        />
      )}
    </div>
  );
}