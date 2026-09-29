// ExerciseDetailsStep.tsx
import React, { useState, useRef, useEffect, ChangeEvent, useImperativeHandle, forwardRef } from "react";
import {
  FileText,
  Terminal,
  Code,
  Database,
  Check,
  AlertCircle,
  Lock,
  X,
  ChevronDown,
  ChevronUp,
  Info,
  Plus,
  Trash2,
  Layers,
  Monitor,
  ClipboardList,
  CheckCircle2,
  Circle
} from "lucide-react";
import { D, moduleLanguages } from "./constants";
import { FormDataType, ValidationErrors } from "./types";

// ─── OInput Component ────────────────────────────────────────────────────────
const OInput: React.FC<{
  type?: 'text' | 'number' | 'textarea';
  value: string | number;
  onChange: (v: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  readOnly?: boolean;
  id?: string;
  error?: string;
  touched?: boolean;
}> = ({ type = 'text', value, onChange, onBlur, placeholder, className = '', disabled, readOnly, id, error, touched }) => {
  const [internal, setInternal] = useState(value.toString());
  const timer = useRef<NodeJS.Timeout>();
  const isFocused = useRef(false);

  useEffect(() => {
    if (!isFocused.current) {
      setInternal(value.toString());
    }
  }, [value]);

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setInternal(e.target.value);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => onChange(e.target.value), 50);
  };

  const baseClass = [
    'w-full px-3 py-2 text-sm rounded-lg border transition-all duration-150 outline-none font-[Plus_Jakarta_Sans,sans-serif]',
    error && touched
      ? 'border-red-300 bg-red-50/30 focus:border-red-400 focus:ring-1 focus:ring-red-100'
      : 'border-[#eef0f4] bg-white focus:border-[#E8640C] focus:ring-1 focus:ring-[rgba(232,100,12,0.12)]',
    disabled ? 'bg-[#fafafa] text-[#9b9bae] cursor-not-allowed' : 'text-[#1a1a2e]',
    readOnly ? 'bg-[#fafafa] cursor-default text-[#9b9bae]' : '',
    className,
  ].filter(Boolean).join(' ');

  if (type === 'textarea') return (
    <div className="w-full">
      <textarea
        value={internal}
        onChange={handleChange as any}
        onFocus={() => { isFocused.current = true; }}
        onBlur={() => { isFocused.current = false; onChange(internal); onBlur?.(); }}
        placeholder={placeholder}
        disabled={disabled}
        readOnly={readOnly}
        id={id}
        rows={2}
        className={baseClass + ' resize-none leading-relaxed'} />
      {error && touched && <p className="mt-1 text-xs" style={{ color: D.red }}>{error}</p>}
    </div>
  );

  return (
    <div className="w-full">
      <input
        type={type}
        value={internal}
        onChange={handleChange as any}
        onFocus={() => { isFocused.current = true; }}
        onBlur={() => { isFocused.current = false; onChange(internal); onBlur?.(); }}
        placeholder={placeholder}
        disabled={disabled}
        readOnly={readOnly}
        id={id}
        className={baseClass} />
      {error && touched && <p className="mt-1 text-xs" style={{ color: D.red }}>{error}</p>}
    </div>
  );
};

// ─── ONumberInput Component ──────────────────────────────────────────────────
const ONumberInput: React.FC<{
  value: number;
  onChange: (v: number) => void;
  onBlur?: () => void;
  min?: number;
  max?: number;
  placeholder?: string;
  className?: string;
  id?: string;
  error?: string;
  touched?: boolean;
  disabled?: boolean;
  style?: React.CSSProperties;
}> = ({ value, onChange, onBlur, min = 0, max = 1000, placeholder, className = '', id, error, touched, disabled, style }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const isFocused = useRef(false);
  const [localValue, setLocalValue] = useState<string>(!value ? '' : value.toString());

  useEffect(() => {
    if (!isFocused.current) {
      setLocalValue(!value ? '' : value.toString());
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    if (raw === '' || /^[0-9]*\.?[0-9]*$/.test(raw)) {
      setLocalValue(raw);
      if (raw === '') {
        onChange(0);
      } else {
        const parsed = parseFloat(raw);
        if (!isNaN(parsed)) onChange(Math.min(max, Math.max(min, parsed)));
      }
    }
  };

  const handleBlur = () => {
    isFocused.current = false;
    let final: number;
    const parsed = parseFloat(localValue);
    if (localValue === '' || localValue === '.' || isNaN(parsed)) {
      final = 0;
    } else {
      final = Math.min(max, Math.max(min, parsed));
    }
    const display = final === 0 ? '' : final % 1 === 0 ? final.toString() : final.toFixed(2);
    setLocalValue(display);
    onChange(final);
    onBlur?.();
  };

  return (
    <div className="w-full">
      <input
        ref={inputRef}
        type="text"
        inputMode="decimal"
        value={localValue}
        onChange={handleChange}
        onFocus={() => { isFocused.current = true; }}
        onBlur={handleBlur}
        placeholder={placeholder}
        id={id}
        disabled={disabled}
        style={style}
        className={[
          'w-full px-3 py-2 text-sm rounded-lg border transition-all duration-150 outline-none font-[Plus_Jakarta_Sans,sans-serif]',
          error && touched
            ? 'border-red-300 bg-red-50/30 focus:border-red-400 focus:ring-1 focus:ring-red-100'
            : 'border-[#eef0f4] bg-white focus:border-[#E8640C] focus:ring-1 focus:ring-[rgba(232,100,12,0.12)]',
          disabled ? 'bg-[#fafafa] text-[#9b9bae] cursor-not-allowed' : 'text-[#1a1a2e]',
          className,
        ].filter(Boolean).join(' ')}
      />
      {error && touched && <p className="mt-1 text-xs" style={{ color: D.red }}>{error}</p>}
    </div>
  );
};

// ─── InfoTooltip Component ───────────────────────────────────────────────────
const InfoTooltip: React.FC<{ content: string; side?: 'top' | 'bottom' | 'left' | 'right' }> = ({ content, side = 'top' }) => {
  const [show, setShow] = useState(false);
  const [pos, setPos] = useState({ left: 0, top: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (show && btnRef.current && tipRef.current) {
      const b = btnRef.current.getBoundingClientRect();
      const t = tipRef.current.getBoundingClientRect();
      let left = 0, top = 0;
      if (side === 'top') { left = b.left + b.width / 2 - t.width / 2; top = b.top - t.height - 8; }
      else if (side === 'bottom') { left = b.left + b.width / 2 - t.width / 2; top = b.bottom + 8; }
      else if (side === 'left') { left = b.left - t.width - 8; top = b.top + b.height / 2 - t.height / 2; }
      else if (side === 'right') { left = b.right + 8; top = b.top + b.height / 2 - t.height / 2; }
      if (left + t.width > window.innerWidth - 10) left = window.innerWidth - t.width - 10;
      if (left < 10) left = 10;
      if (top + t.height > window.innerHeight - 10) top = window.innerHeight - t.height - 10;
      if (top < 10) top = 10;
      setPos({ left, top });
    }
  }, [show, side]);

  return (
    <div className="relative inline-block ml-1 align-middle">
      <button
        ref={btnRef}
        type="button"
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        className="focus:outline-none transition-colors"
        style={{ color: D.textHint }}
        aria-label="Information"
      >
        <Info size={12} />
      </button>
      {show && (
        <div
          ref={tipRef}
          className="fixed z-[9999] p-2.5 text-xs rounded-xl shadow-2xl leading-relaxed"
          style={{ left: pos.left, top: pos.top, maxWidth: 'min(280px,calc(100vw - 40px))', width: 'max-content', background: D.textMain, color: '#fff', fontFamily: 'Poppins, sans-serif' }}
        >
          {content}
        </div>
      )}
    </div>
  );
};

// ─── SectionLabel Component ──────────────────────────────────────────────────
const SectionLabel: React.FC<{ children: React.ReactNode; required?: boolean; info?: string; className?: string }> = ({ children, required, info, className = '' }) => (
  <div className={`flex items-center gap-1 mb-1 ${className}`}>
    <label className="text-xs font-semibold" style={{ color: D.textSub, fontFamily: 'Poppins, sans-serif' }}>{children}</label>
    {required && <span className="text-xs font-bold" style={{ color: D.orange }}>*</span>}
    {info && <InfoTooltip content={info} />}
  </div>
);

// ─── Section Item Component ──────────────────────────────────────────────────
export interface SectionItem {
  id: string;
  name: string;
  order: number;
  description?: string;
  totalMarks?: number;
  totalDuration?: number;
}

const SectionItemComponent: React.FC<{
  section: SectionItem;
  index: number;
  onUpdate: (id: string, field: keyof SectionItem, value: string | number) => void;
  onRemove: (id: string) => void;
  canRemove: boolean;
  showDuration: boolean;
}> = ({ section, index, onUpdate, onRemove, canRemove, showDuration }) => {
  return (
    <div className="flex gap-2 items-start p-3 rounded-lg border" style={{ borderColor: D.border, background: D.bgLight }}>
      <div className="flex-1 space-y-2">
        <div className="flex gap-2">
          <div className="flex-1">
            <SectionLabel required info="Section name/title">
              Section {index + 1} Name
            </SectionLabel>
            <OInput
              value={section.name}
              onChange={(v) => onUpdate(section.id, 'name', v)}
              placeholder="e.g., Introduction, Core Concepts, Advanced Topics"
            />
          </div>
          <div className="w-24">
            <SectionLabel info="Display order of this section">
              Order
            </SectionLabel>
            <ONumberInput
              value={section.order}
              onChange={(v) => onUpdate(section.id, 'order', v)}
              min={1}
              max={100}
              placeholder="1"
            />
          </div>
        </div>
        <div>
          <SectionLabel info="Optional description for this section">
            Description
          </SectionLabel>
          <OInput
            type="textarea"
            value={section.description || ''}
            onChange={(v) => onUpdate(section.id, 'description', v)}
            placeholder="Brief description of what this section covers..."
          />
        </div>
        <div>
          <SectionLabel required info="Total marks allocated for this section">
            Total Mark for {section.name || `Section ${index + 1}`}
          </SectionLabel>
          <ONumberInput
            value={section.totalMarks || 0}
            onChange={(v) => onUpdate(section.id, 'totalMarks', v)}
            min={0}
            placeholder="0"
          />
        </div>
        {showDuration && (
          <div>
            <SectionLabel required info="Total duration allocated for this section (in minutes)">
              Total Duration for {section.name || `Section ${index + 1}`}
            </SectionLabel>
            <ONumberInput
              value={section.totalDuration || 0}
              onChange={(v) => onUpdate(section.id, 'totalDuration', v)}
              min={0}
              placeholder="0"
            />
          </div>
        )}
      </div>
      {canRemove && (
        <button
          type="button"
          onClick={() => onRemove(section.id)}
          className="p-1.5 rounded-lg transition-all hover:bg-red-50 flex-shrink-0 mt-6"
          style={{ color: D.red }}
        >
          <Trash2 size={16} />
        </button>
      )}
    </div>
  );
};

interface ExerciseDetailsStepProps {
  formData: FormDataType;
  setFormData: React.Dispatch<React.SetStateAction<FormDataType>>;
  setValidationErrors: React.Dispatch<React.SetStateAction<ValidationErrors>>;
  validationErrors: ValidationErrors;
  touchedFields: Set<string>;
  markTouched: (field: string) => void;
  handleSelectExerciseType: (
    type: "MCQ" | "Programming" | "Combined" | "Other",
  ) => void;
  toggleLanguage: (lang: string) => void;
  configuredLanguages?: {
    coreProgram?: string[];
    frontend?: string[];
    database?: string[];
  };
  hasPreConfiguredLanguages: boolean;
  flatLanguages: string[];
  getFilteredLanguages: (category: string) => { name: string; icon: string }[];
  TipTapEditor: any;
  OInput?: any;
  ONumberInput?: any;
  SectionLabel?: any;
  onSectionsChange?: (sections: SectionItem[]) => void;
  isSectionBasedProp?: boolean;
  onSectionBasedChange?: (enabled: boolean) => void;
  sectionsProp?: SectionItem[];
  isSectionBasedDurationProp?: boolean;
  onSectionBasedDurationChange?: (enabled: boolean) => void;
  onValidateSectionBased?: () => { isValid: boolean; error?: string };
}

export interface ExerciseDetailsStepRef {
  validateSectionBased: () => { isValid: boolean; error?: string };
}

// Test Type Options
const testTypeOptions = [
  { value: "mock", label: "Mock Test", description: "Simulates real exam conditions" },
  { value: "final", label: "Final Test", description: "End of course/term final assessment" },
];

export const ExerciseDetailsStep = forwardRef<ExerciseDetailsStepRef, ExerciseDetailsStepProps>(({
  formData,
  setFormData,
  setValidationErrors,
  validationErrors,
  touchedFields,
  markTouched,
  handleSelectExerciseType,
  toggleLanguage,
  configuredLanguages,
  hasPreConfiguredLanguages,
  flatLanguages,
  getFilteredLanguages,
  TipTapEditor,
  onSectionsChange,
  isSectionBasedProp = false,
  onSectionBasedChange,
  sectionsProp = [],
  isSectionBasedDurationProp = false,
  onSectionBasedDurationChange,
}, ref) => {
  const [isSectionBased, setIsSectionBased] = useState(isSectionBasedProp);
  const [isSectionBasedDuration, setIsSectionBasedDuration] = useState(isSectionBasedDurationProp);
  // Remember the exercise type chosen before section-based was enabled, so turning
  // section-based off again restores it instead of leaving it blank.
  const prevExerciseTypeRef = useRef<string>('');
  const [sections, setSections] = useState<SectionItem[]>(sectionsProp.length > 0 ? sectionsProp : [
    { id: crypto.randomUUID?.() || Math.random().toString(), name: '', order: 1, description: '', totalMarks: 0 }
  ]);

  // ── Sync inbound props → local state when parent loads edit data ────────────
  useEffect(() => {
    setIsSectionBased(isSectionBasedProp);
  }, [isSectionBasedProp]);

  useEffect(() => {
    setIsSectionBasedDuration(isSectionBasedDurationProp);
  }, [isSectionBasedDurationProp]);

  useEffect(() => {
    if (sectionsProp.length > 0) {
      setSections(sectionsProp);
    }
  }, [sectionsProp]);

  // Sync sections with parent
  useEffect(() => {
    onSectionsChange?.(sections);
  }, [sections, onSectionsChange]);

  // Sync isSectionBased with parent
  useEffect(() => {
    onSectionBasedChange?.(isSectionBased);
  }, [isSectionBased, onSectionBasedChange]);

  // Sync isSectionBasedDuration with parent
  useEffect(() => {
    onSectionBasedDurationChange?.(isSectionBasedDuration);
    setFormData(prev => ({ ...prev, sectionBasedDuration: isSectionBasedDuration }));
  }, [isSectionBasedDuration, onSectionBasedDurationChange, setFormData]);

  // Expose validation function to parent via ref
  useImperativeHandle(ref, () => ({
    validateSectionBased
  }));

  const isCombined = formData.exerciseType === "Combined";
  const isProgramming = formData.exerciseType === "Programming" || isCombined;
  const isMCQ = formData.exerciseType === "MCQ" || isCombined;

  // Always show the Skill Set (module/languages), regardless of exercise type —
  // matches the Exercise Settings behaviour. Only hidden in section-based mode,
  // which replaces the exercise-type area entirely.
  const showModuleSection = !isSectionBased;

  const exerciseTypeOptions = [
    { value: "MCQ", label: "MCQ — Multiple Choice Questions (auto-graded)" },
    {
      value: "Programming",
      label: "Programming — Code challenges with test cases",
    },
    { value: "Combined", label: "Combined — MCQ + Programming (hybrid)" },
    {
      value: "Other",
      label: "Other — Custom exercise with module & language config",
    },
  ];

  const difficultyOptions = [
    { value: "beginner", label: "Beginner" },
    { value: "intermediate", label: "Intermediate" },
    { value: "expert", label: "Expert" },
  ];

  // Get the selected test type label for display
  const getSelectedTestTypeLabel = () => {
    const selected = testTypeOptions.find(opt => opt.value === formData.testType);
    return selected ? selected.label : "Mock test";
  };

  // Get test type color based on selection
  const getTestTypeColor = () => {
    switch (formData.testType) {
      case "mock": return D.purple || "#8b5cf6";
      case "final": return D.red || "#ef4444";
      default: return D.orange;
    }
  };

  // Update total marks when MCQ or Programming marks change in Combined mode
  const updateCombinedMarks = (mcqMarks: number, progMarks: number) => {
    const newTotal = mcqMarks + progMarks;
    setFormData((prev) => ({
      ...prev,
      totalMarksMCQ: mcqMarks,
      totalMarksProgramming: progMarks,
      totalMarks: newTotal,
    }));
    
    if (mcqMarks > 0) {
      setValidationErrors(prev => {
        const e = { ...prev };
        delete e.totalMarksMCQ;
        delete e.totalMarks;
        return e;
      });
    }
    if (progMarks > 0) {
      setValidationErrors(prev => {
        const e = { ...prev };
        delete e.totalMarksProgramming;
        return e;
      });
    }
  };

  const buildConfiguredLangList = () => {
    if (!configuredLanguages) return [];
    const allIconEntries = [
      ...moduleLanguages["Core Programming"],
      ...moduleLanguages["Frontend"],
      ...moduleLanguages["Database"],
    ];
    const langAliases: Record<string, string> = {
      js: "JavaScript",
      ts: "TypeScript",
      css: "CSS",
      html: "HTML",
      react: "React",
      bootstrap: "Bootstrap",
      sql: "SQL",
      mongodb: "MongoDB",
      c: "C",
      "c++": "C++",
      java: "Java",
      python: "Python",
      "c#": "C#",
    };
    const findIcon = (name: string) => {
      const searchName = langAliases[name.toLowerCase()] || name;
      return (
        allIconEntries.find(
          (l) => l.name.toLowerCase() === searchName.toLowerCase(),
        )?.icon || ""
      );
    };
    const result: { name: string; icon: string; category: string }[] = [];
    const entries: [string, string][] = [
      ["Core Programming", "coreProgram"],
      ["Frontend", "frontend"],
      ["Database", "database"],
    ];
    for (const [category, key] of entries) {
      const names: string[] = (configuredLanguages as any)[key] || [];
      for (const name of names)
        result.push({ name, icon: findIcon(name), category });
    }
    return result;
  };

  const validateMarksField = (value: number, fieldName: string): boolean => {
    if (value <= 0) {
      setValidationErrors(prev => ({ 
        ...prev, 
        [fieldName]: `${fieldName === 'totalMarksMCQ' ? 'MCQ' : fieldName === 'totalMarksProgramming' ? 'Programming' : 'Total'} marks must be greater than 0` 
      }));
      return false;
    }
    setValidationErrors(prev => {
      const e = { ...prev };
      delete e[fieldName];
      return e;
    });
    return true;
  };

  const addSection = () => {
    const newOrder = sections.length + 1;
    setSections([
      ...sections,
      { id: crypto.randomUUID?.() || Math.random().toString(), name: '', order: newOrder, description: '', totalMarks: 0, totalDuration: 0 }
    ]);
  };

  const updateSection = (id: string, field: keyof SectionItem, value: string | number) => {
    setSections(sections.map(section => 
      section.id === id ? { ...section, [field]: value } : section
    ));
  };

  const removeSection = (id: string) => {
    if (sections.length > 1) {
      const newSections = sections.filter(section => section.id !== id);
      const reordered = newSections.map((section, idx) => ({
        ...section,
        order: idx + 1
      }));
      setSections(reordered);
    }
  };

  const handleSectionBasedToggle = (enabled: boolean) => {
    setIsSectionBased(enabled);

    if (enabled) {
      // Remember the current type before clearing it (type selector is hidden in
      // section-based mode), so it can be restored when section-based is turned off.
      prevExerciseTypeRef.current = formData.exerciseType || prevExerciseTypeRef.current || '';
      setFormData(prev => ({ ...prev, exerciseType: "" }));
      setValidationErrors(prev => {
        const e = { ...prev };
        delete e.exerciseType;
        return e;
      });
    } else {
      setSections([{ id: crypto.randomUUID?.() || Math.random().toString(), name: '', order: 1, description: '', totalMarks: 0, totalDuration: 0 }]);
      // Restore a valid exercise type — disabling left it blank, which blocked the save.
      // (Stale section configs are dropped from the save payload in CreateAssessmentModal.)
      setFormData(prev => ({
        ...prev,
        exerciseType: (prev.exerciseType || prevExerciseTypeRef.current || 'MCQ') as any,
      }));
    }
  };

  // Validation function for section-based exercises
  const validateSectionBased = (): { isValid: boolean; error?: string } => {
    if (!isSectionBased) return { isValid: true };

    // Validate section marks sum equals total marks
    const totalSectionMarks = sections.reduce((sum, section) => sum + (section.totalMarks || 0), 0);
    if (totalSectionMarks !== formData.totalMarks) {
      return {
        isValid: false,
        error: `Sum of section marks (${totalSectionMarks}) must equal Total Marks (${formData.totalMarks})`
      };
    }

    // Validate section durations sum equals total duration (if section-based duration is enabled)
    if (isSectionBasedDuration) {
      const totalSectionDuration = sections.reduce((sum, section) => sum + (section.totalDuration || 0), 0);
      if (totalSectionDuration !== formData.totalDuration) {
        return {
          isValid: false,
          error: `Sum of section durations (${totalSectionDuration} min) must equal Total Duration (${formData.totalDuration} min)`
        };
      }
    }

    return { isValid: true };
  };

  return (
    <div className="px-10 pt-4 pb-6">
      <div className="space-y-6">
        {/* ── Section 1: Basic Information ── */}
        <div style={{ padding: 0 }}>
          <div className="grid grid-cols-2 gap-4">
          <div>
            <SectionLabel info="Auto-generated unique identifier for this exercise">
              Exercise ID
            </SectionLabel>
            <div className="relative group">
              <OInput 
                value={formData.exerciseId} 
                onChange={() => {}} 
                readOnly 
                disabled
                className="cursor-not-allowed bg-gray-50 pr-8"
              />
              <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                <Lock size={14} className="text-gray-400" />
              </div>
            </div>
            <p className="text-[10px] mt-1" style={{ color: D.textMuted }}>
              Unique identifier automatically assigned to this exercise
            </p>
          </div>
          <div>
            <SectionLabel
              required
              info="The name displayed to students in their dashboard"
            >
              Exercise Name
            </SectionLabel>
            <OInput
              value={formData.exerciseName}
              onChange={(v) => {
                setFormData((prev) => ({ ...prev, exerciseName: v }));
                if (v.trim())
                  setValidationErrors((prev) => {
                    const e = { ...prev };
                    delete e.exerciseName;
                    return e;
                  });
              }}
              onBlur={() => markTouched("exerciseName")}
              placeholder="e.g. Advanced Algorithms"
              error={validationErrors.exerciseName}
              touched={touchedFields.has("exerciseName")}
            />
          </div>
        </div>

       

        </div>

        {/* ── Section 2: Test Configuration ── */}
        <div style={{ padding: 0 }}>

          {/* Test Type */}
          <div className="flex items-center gap-1 mb-2">
            <span className="text-xs font-semibold" style={{ color: D.textSub }}>Test Type</span>
            <span className="text-xs font-bold" style={{ color: D.orange }}>*</span>
            <InfoTooltip content="Select the type of test - Practice, Mock, or Final. This affects grading rules and test conditions." />
          </div>
          <div className="grid grid-cols-2 gap-3">
            {testTypeOptions.map((option) => {
              const sel = formData.testType === option.value;
              const Icon = option.value === 'final' ? ClipboardList : Monitor;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setFormData((prev) => ({ ...prev, testType: option.value as "practice" | "mock" | "final" }))}
                  className="flex items-center gap-3 p-3.5 rounded-xl border-2 text-left transition-all"
                  style={{ borderColor: sel ? D.orange : D.border, background: sel ? D.orangeLight : D.bg }}
                >
                  <span className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: sel ? D.orangeLight : D.surface, color: sel ? D.orange : D.textMuted }}>
                    <Icon size={18} />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-bold" style={{ color: sel ? '#1a1a2e' : D.textSub }}>{option.label}</span>
                    <span className="block text-[11px] mt-0.5" style={{ color: D.textMuted }}>{option.description}</span>
                  </span>
                  {sel
                    ? <CheckCircle2 size={20} style={{ color: D.orange }} className="flex-shrink-0" />
                    : <Circle size={20} style={{ color: '#d1d5db' }} className="flex-shrink-0" />}
                </button>
              );
            })}
          </div>
          <p className="text-[11px] mt-2" style={{ color: D.textMuted }}>
            Current selection: <span style={{ color: D.orange, fontWeight: 600 }}>{getSelectedTestTypeLabel()}</span>
          </p>
 {/* Section-Based Toggle */}
        <div className="flex items-center gap-3 mt-4 pt-4" style={{ borderTop: `1px solid ${D.border}` }}>
          <div className="flex items-center gap-1">
            <span
              className="text-xs font-semibold truncate"
              style={{ color: D.textSub }}
            >
              Section Based
            </span>
            <InfoTooltip content="Enable to organize exercise into multiple sections. This will disable the standard exercise type selection and add a Section Details tab." />
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => handleSectionBasedToggle(!isSectionBased)}
              className={`
                relative inline-flex h-6 w-11 items-center rounded-full transition-all duration-200
                ${isSectionBased ? 'bg-orange-500' : 'bg-gray-300'}
              `}
            >
              <span
                className={`
                  inline-block h-5 w-5 transform rounded-full bg-white shadow-lg transition-transform duration-200
                  ${isSectionBased ? 'translate-x-5' : 'translate-x-0.5'}
                `}
              />
            </button>
            <span className="text-xs font-medium" style={{ color: D.textSub }}>
              {isSectionBased ? 'Enabled' : 'Disabled'}
            </span>
            {isSectionBased && (
              <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: D.orangeLight, color: D.orange }}>
                Exercise Type Disabled
              </span>
            )}
          </div>
        </div>

        {/* Section-Based Duration Toggle */}
        {isSectionBased && (
          <div className="flex items-center gap-3 mt-3">
            <div className="flex items-center gap-1">
              <span
                className="text-xs font-semibold"
                style={{ color: D.textSub }}
              >
                Section Based Duration
              </span>
              <InfoTooltip content="Enable to set duration per section instead of a single duration for the entire exercise." />
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setIsSectionBasedDuration(!isSectionBasedDuration)}
                className={`
                  relative inline-flex h-6 w-11 items-center rounded-full transition-all duration-200
                  ${isSectionBasedDuration ? 'bg-orange-500' : 'bg-gray-300'}
                `}
              >
                <span
                  className={`
                    inline-block h-5 w-5 transform rounded-full bg-white shadow-lg transition-transform duration-200
                    ${isSectionBasedDuration ? 'translate-x-5' : 'translate-x-0.5'}
                  `}
                />
              </button>
              <span className="text-xs font-medium" style={{ color: D.textSub }}>
                {isSectionBasedDuration ? 'Enabled' : 'Disabled'}
              </span>
            </div>
          </div>
        )}

        {/* Total Marks - Show below Section Based toggle when section-based is enabled */}
        {isSectionBased && (
          <div className="grid grid-cols-[140px_1fr] items-start gap-3 mt-3">
            <div className="flex items-center gap-1 pt-2 min-w-0">
              <span
                className="text-xs font-semibold truncate"
                style={{ color: D.textSub }}
              >
                Total Marks
              </span>
              <span
                className="text-xs font-bold flex-shrink-0"
                style={{ color: D.orange }}
              >
                *
              </span>
              <InfoTooltip content="Total marks across all sections (auto-calculated from section marks)" />
            </div>
            <div>
              <ONumberInput
                value={formData.totalMarks}
                onChange={(v) => {
                  setFormData((prev) => ({ ...prev, totalMarks: v }));
                  validateMarksField(v, 'totalMarks');
                }}
                onBlur={() => {
                  markTouched("totalMarks");
                  if (formData.totalMarks <= 0) {
                    setValidationErrors(prev => ({
                      ...prev,
                      totalMarks: 'Total marks must be greater than 0'
                    }));
                  }
                }}
                placeholder="100"
                min={1}
                error={validationErrors.totalMarks}
                touched={touchedFields.has("totalMarks")}
              />
              <p className="text-[10px] mt-1" style={{ color: D.textMuted }}>
                Auto-calculated from section marks
              </p>
            </div>
          </div>
        )}

        {/* Total Duration - Show below Section Based Duration toggle when enabled */}
        {isSectionBased && isSectionBasedDuration && (
          <div className="grid grid-cols-[140px_1fr] items-start gap-3 mt-3">
            <div className="flex items-center gap-1 pt-2 min-w-0">
              <span
                className="text-xs font-semibold truncate"
                style={{ color: D.textSub }}
              >
                Total Duration (min)
              </span>
              <span
                className="text-xs font-bold flex-shrink-0"
                style={{ color: D.orange }}
              >
                *
              </span>
              <InfoTooltip content="Total duration across all sections (auto-calculated from section durations)" />
            </div>
            <div>
              <ONumberInput
                value={formData.totalDuration}
                onChange={(v) => {
                  setFormData((prev) => ({ ...prev, totalDuration: v }));
                  if (v > 0)
                    setValidationErrors((prev) => {
                      const e = { ...prev };
                      delete e.totalDuration;
                      return e;
                    });
                }}
                onBlur={() => markTouched("totalDuration")}
                placeholder="60"
                min={1}
                error={validationErrors.totalDuration}
                touched={touchedFields.has("totalDuration")}
              />
              <p className="text-[10px] mt-1" style={{ color: D.textMuted }}>
                Auto-calculated from section durations
              </p>
            </div>
          </div>
        )}
        </div>

        {/* ── Section 3: Exercise Setup ── */}
        <div style={{ padding: 0 }} className="space-y-3">

        {/* Exercise Type Section - Disabled when section-based is enabled */}
        {!isSectionBased && (
          <>
            <div className="grid grid-cols-2 gap-4 items-start">
              <div>
                <div className="flex items-center gap-1 mb-1.5">
                  <span className="text-xs font-semibold" style={{ color: D.textSub }}>Exercise Type</span>
                  <span className="text-xs font-bold" style={{ color: D.orange }}>*</span>
                </div>
                <select
                  value={formData.exerciseType || ""}
                  onChange={(e) => {
                    const v = e.target.value as any;
                    handleSelectExerciseType(v);
                    if (v)
                      setValidationErrors((prev) => {
                        const n = { ...prev };
                        delete n.exerciseType;
                        return n;
                      });
                  }}
                  onBlur={() => markTouched("exerciseType")}
                  className="w-full px-3 py-2 text-xs rounded-lg border outline-none transition-all"
                  style={{
                    borderColor:
                      validationErrors.exerciseType &&
                      touchedFields.has("exerciseType")
                        ? D.red
                        : D.border,
                    background: D.bg,
                    color: formData.exerciseType ? D.textMain : D.textMuted,
                    fontFamily: "Poppins, sans-serif",
                    fontWeight: 600,
                    width: "100%",
                    minWidth: 0,
                  }}
                >
                  <option value="" disabled>
                    Select exercise type…
                  </option>
                  {exerciseTypeOptions.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                {validationErrors.exerciseType &&
                  touchedFields.has("exerciseType") && (
                    <p
                      className="mt-1 text-xs flex items-center gap-1"
                      style={{ color: D.red }}
                    >
                      <AlertCircle size={11} />
                      {validationErrors.exerciseType}
                    </p>
                  )}
              </div>

            {/* Module/Language Section (second column) */}
            {showModuleSection && (
              <div>
                <div className="flex items-center gap-1 mb-1.5">
                  <span className="text-xs font-semibold" style={{ color: D.textSub }}>{hasPreConfiguredLanguages ? "Skill Set" : "Module"}</span>
                  <span className="text-xs font-bold" style={{ color: D.orange }}>*</span>
                </div>
                <div className="space-y-2">
                  {hasPreConfiguredLanguages ? (
                    /* Pre-configured languages → show read-only Skill Set chips,
                       exactly like Exercise Settings. The actual selection is
                       auto-applied in the parent (all configured languages). */
                    (() => {
                      const allLangs = buildConfiguredLangList();
                      if (allLangs.length === 0) {
                        return (
                          <span className="text-xs" style={{ color: D.textMuted }}>
                            No languages configured
                          </span>
                        );
                      }
                      return (
                        <div className="flex flex-wrap gap-1.5">
                          {allLangs.map((lang) => (
                            <span
                              key={lang.name}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-semibold"
                              style={{ borderColor: D.orange, background: D.orangeLight, color: D.orange }}
                            >
                              {lang.icon && (
                                <img
                                  src={lang.icon}
                                  alt={lang.name}
                                  className="w-3.5 h-3.5 object-contain"
                                  onError={(e) => { (e.target as any).style.display = 'none'; }}
                                />
                              )}
                              {lang.name}
                            </span>
                          ))}
                        </div>
                      );
                    })()
                  ) : (
                    /* No pre-configured languages → manual module + language picker. */
                    (() => {
                    // Determine which modules have languages (either pre-configured or default list)
                    const moduleHasLangs = (mod: string) => {
                      if (!hasPreConfiguredLanguages) return true;
                      if (mod === 'Core Programming') return !!(configuredLanguages?.coreProgram?.length);
                      if (mod === 'Frontend') return !!(configuredLanguages?.frontend?.length);
                      if (mod === 'Database') return !!(configuredLanguages?.database?.length);
                      return false;
                    };
                    const availableModules = (['Core Programming', 'Frontend', 'Database'] as const)
                      .filter(m => moduleHasLangs(m));
                    return (
                    <>
                      <div className="flex gap-2">
                        {availableModules.map((mod) => {
                          const sel = formData.selectedModule === mod;
                          const colors: Record<string, string> = {
                            'Core Programming': D.blue,
                            Frontend: D.orange,
                            Database: D.emerald,
                          };
                          const icons: Record<string, React.ReactNode> = {
                            'Core Programming': <Terminal size={11} />,
                            Frontend: <Code size={11} />,
                            Database: <Database size={11} />,
                          };
                          return (
                            <button
                              key={mod}
                              type="button"
                              onClick={() => {
                                setFormData((prev) => ({
                                  ...prev,
                                  selectedModule: mod,
                                  selectedLanguages: [],
                                }));
                                setValidationErrors((prev) => {
                                  const n = { ...prev };
                                  delete n.selectedModule;
                                  return n;
                                });
                              }}
                              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border-2 text-xs font-bold transition-all"
                              style={{
                                borderColor: sel ? colors[mod] : D.border,
                                background: sel ? colors[mod] + '10' : D.bg,
                                color: sel ? colors[mod] : D.textMuted,
                                cursor: 'pointer',
                              }}
                            >
                              {icons[mod]}
                              {mod}
                            </button>
                          );
                        })}
                      </div>
                      {validationErrors.selectedModule && touchedFields.has('selectedModule') && (
                        <p className="text-xs flex items-center gap-1" style={{ color: D.red }}>
                          <AlertCircle size={11} />
                          {validationErrors.selectedModule}
                        </p>
                      )}
                      {formData.selectedModule && (() => {
                        const langs = getFilteredLanguages(formData.selectedModule);
                        const allSel = langs.length > 0 && langs.every(l => formData.selectedLanguages.includes(l.name));
                        return (
                          <div>
                            <div className="flex flex-wrap gap-1.5 items-center">
                              {langs.map((lang) => {
                                const sel = formData.selectedLanguages.includes(lang.name);
                                return (
                                  <label
                                    key={lang.name}
                                    className="flex items-center gap-1.5 px-2 py-1 rounded-lg border cursor-pointer select-none text-xs font-semibold transition-all"
                                    style={{
                                      borderColor: sel ? D.orange : D.border,
                                      background: sel ? D.orangeLight : D.bg,
                                      color: sel ? D.orange : D.textSub,
                                    }}
                                  >
                                    <div className="relative flex items-center justify-center">
                                      <input
                                        type="checkbox"
                                        className="w-3.5 h-3.5 cursor-pointer opacity-0 absolute"
                                        checked={sel}
                                        onChange={() => toggleLanguage(lang.name)}
                                      />
                                      <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition-all ${sel ? 'border-orange-500 bg-orange-500' : 'border-gray-300 bg-white'}`}>
                                        {sel && <Check size={10} className="text-white" strokeWidth={2.5} />}
                                      </div>
                                    </div>
                                    {lang.icon && (
                                      <img
                                        src={lang.icon}
                                        alt={lang.name}
                                        className="w-3.5 h-3.5 object-contain"
                                        onError={(e) => { (e.target as any).style.display = 'none'; }}
                                      />
                                    )}
                                    {lang.name}
                                  </label>
                                );
                              })}
                              <button
                                type="button"
                                onClick={() => {
                                  const all = langs.map(l => l.name);
                                  setFormData(prev => ({ ...prev, selectedLanguages: allSel ? [] : all }));
                                }}
                                className="text-xs font-semibold px-2 py-1 rounded transition-all hover:opacity-70 whitespace-nowrap"
                                style={{ color: D.orange }}
                              >
                                {allSel ? 'Deselect All' : 'Select All'}
                              </button>
                            </div>
                            {validationErrors.selectedLanguages && touchedFields.has('selectedLanguages') && (
                              <p className="mt-1 text-xs flex items-center gap-1" style={{ color: D.red }}>
                                <AlertCircle size={11} />
                                {validationErrors.selectedLanguages}
                              </p>
                            )}
                          </div>
                        );
                      })()}
                    </>
                    );
                  })()
                  )}
                </div>
              </div>
            )}
            </div>
          </>
        )}

        {/* Section-Based Content */}
        {isSectionBased && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers size={14} style={{ color: D.orange }} />
                <span className="text-xs font-semibold" style={{ color: D.textMain }}>
                  Exercise Sections
                </span>
                <span className="text-[10px]" style={{ color: D.textMuted }}>
                  ({sections.length} section{sections.length !== 1 ? 's' : ''})
                </span>
              </div>
              <button
                type="button"
                onClick={addSection}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all hover:opacity-80"
                style={{ background: D.orangeLight, color: D.orange }}
              >
                <Plus size={12} />
                Add Section
              </button>
            </div>
            
            <div className="space-y-3">
              {sections.map((section, index) => (
                <SectionItemComponent
                  key={section.id}
                  section={section}
                  index={index}
                  onUpdate={updateSection}
                  onRemove={removeSection}
                  canRemove={sections.length > 1}
                  showDuration={isSectionBasedDuration}
                />
              ))}
            </div>
          </div>
        )}

        <div style={{ borderTop: `1px solid ${D.border}` }} />
        
        {/* Difficulty · Duration · Total Marks — one row.
            Section-based mode captures duration and marks PER SECTION further
            up, so those two cells are absent there and Difficulty takes the
            row on its own rather than sitting in a 3-column grid with two
            holes in it. */}
        <div className={isSectionBased ? undefined : "grid grid-cols-1 sm:grid-cols-3 gap-4 items-start"}>
        {/* Difficulty Level */}
        <div>
          <div className="flex items-center gap-1 mb-1.5">
            <span className="text-xs font-semibold" style={{ color: D.textSub }}>Difficulty Level</span>
          </div>
          <select
            value={formData.exerciseLevel}
            onChange={(e) =>
              setFormData((prev) => ({
                ...prev,
                exerciseLevel: e.target.value as any,
              }))
            }
            className="w-full px-3 py-2 text-xs rounded-lg border outline-none transition-all"
            style={{
              borderColor: D.border,
              background: D.bg,
              color: D.textMain,
              fontFamily: "Poppins, sans-serif",
              fontWeight: 600,
              width: "100%",
              minWidth: 0,
            }}
          >
            {difficultyOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        
        {/* Duration and Marks — the other two cells of the row above. Hidden
            when section-based, where both are per-section. */}
        {!isSectionBased && (
          <>
            <div>
                <SectionLabel required info="Total time allowed in minutes">
                  Duration (min)
                </SectionLabel>
                <ONumberInput
                  value={formData.totalDuration}
                  onChange={(v) => {
                    setFormData((prev) => ({ ...prev, totalDuration: v }));
                    if (v > 0)
                      setValidationErrors((prev) => {
                        const e = { ...prev };
                        delete e.totalDuration;
                        return e;
                      });
                  }}
                  onBlur={() => markTouched("totalDuration")}
                  placeholder="60"
                  min={1}
                  error={validationErrors.totalDuration}
                  touched={touchedFields.has("totalDuration")}
                />
              </div>

              <div>
                {!isCombined ? (
                <div>
                  <SectionLabel required info="Maximum marks a student can score">
                    Total Marks
                  </SectionLabel>
                  <ONumberInput
                    value={formData.totalMarks}
                    onChange={(v) => {
                      setFormData((prev) => ({ ...prev, totalMarks: v }));
                      validateMarksField(v, 'totalMarks');
                    }}
                    onBlur={() => {
                      markTouched("totalMarks");
                      if (formData.totalMarks <= 0) {
                        setValidationErrors(prev => ({ 
                          ...prev, 
                          totalMarks: 'Total marks must be greater than 0' 
                        }));
                      }
                    }}
                    placeholder="100"
                    min={1}
                    error={validationErrors.totalMarks}
                    touched={touchedFields.has("totalMarks")}
                  />
                </div>
              ) : isCombined && !isSectionBased ? (
                <div className="flex gap-3">
                  <div className="w-1/2">
                    <SectionLabel required info="Marks allocated for MCQ section">
                      MCQ Marks
                    </SectionLabel>
                    <ONumberInput
                      value={formData.totalMarksMCQ || 0}
                      onChange={(v) => {
                        const numValue = v || 0;
                        updateCombinedMarks(numValue, formData.totalMarksProgramming || 0);
                        validateMarksField(numValue, 'totalMarksMCQ');
                      }}
                      onBlur={() => {
                        markTouched("totalMarksMCQ");
                        if ((formData.totalMarksMCQ || 0) <= 0) {
                          setValidationErrors(prev => ({ 
                            ...prev, 
                            totalMarksMCQ: 'MCQ marks must be greater than 0' 
                          }));
                        }
                      }}
                      placeholder="50"
                      min={1}
                      error={validationErrors.totalMarksMCQ}
                      touched={touchedFields.has("totalMarksMCQ")}
                    />
                  </div>
                  <div className="w-1/2">
                    <SectionLabel required info="Marks allocated for Programming section">
                      Prog. Marks
                    </SectionLabel>
                    <ONumberInput
                      value={formData.totalMarksProgramming || 0}
                      onChange={(v) => {
                        const numValue = v || 0;
                        updateCombinedMarks(formData.totalMarksMCQ || 0, numValue);
                        validateMarksField(numValue, 'totalMarksProgramming');
                      }}
                      onBlur={() => {
                        markTouched("totalMarksProgramming");
                        if ((formData.totalMarksProgramming || 0) <= 0) {
                          setValidationErrors(prev => ({ 
                            ...prev, 
                            totalMarksProgramming: 'Programming marks must be greater than 0' 
                          }));
                        }
                      }}
                      placeholder="50"
                      min={1}
                      error={validationErrors.totalMarksProgramming}
                      touched={touchedFields.has("totalMarksProgramming")}
                    />
                  </div>
                </div>
              ) : isSectionBased && (
                <div>
                  <SectionLabel required info="Total marks across all sections (will be calculated automatically)">
                    Total Marks
                  </SectionLabel>
                  <ONumberInput
                    value={formData.totalMarks}
                    onChange={(v) => {
                      setFormData((prev) => ({ ...prev, totalMarks: v }));
                      validateMarksField(v, 'totalMarks');
                    }}
                    onBlur={() => {
                      markTouched("totalMarks");
                      if (formData.totalMarks <= 0) {
                        setValidationErrors(prev => ({ 
                          ...prev, 
                          totalMarks: 'Total marks must be greater than 0' 
                        }));
                      }
                    }}
                    placeholder="100"
                    min={1}
                    error={validationErrors.totalMarks}
                    touched={touchedFields.has("totalMarks")}
                  />
                </div>
              )}
            </div>
          </>
        )}
        </div>{/* ── close the Difficulty · Duration · Marks row ── */}

        {/* Combined marks roll-up — a caption for the row above, so it sits
            under the whole row rather than inside the marks cell. */}
        {isCombined && !isSectionBased && (
          <div className="flex justify-end">
            <div className="text-right">
              <p className="text-xs font-semibold" style={{ color: D.textSub }}>
                Total Marks: {formData.totalMarks}
              </p>
              <p className="text-[10px]" style={{ color: D.textMuted }}>
                Auto-calculated from MCQ + Programming marks
              </p>
            </div>
          </div>
        )}

        </div>{/* ── close Section 3: Exercise Setup ── */}

        {/* ── Section 4: Description ── */}
        <div style={{ padding: 0 }}>
          <TipTapEditor
            value={formData.description}
            onChange={(v: string) => setFormData((prev) => ({ ...prev, description: v }))}
            onBlur={() => markTouched("description")}
            placeholder="Enter description here..."
            minHeight="120px"
            maxHeight="160px"
            showToolbar
            editable
            error={validationErrors.description}
            touched={touchedFields.has("description")}
          />
        </div>
      </div>
    </div>
  );
});

ExerciseDetailsStep.displayName = 'ExerciseDetailsStep';