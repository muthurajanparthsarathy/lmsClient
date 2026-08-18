import React, { useState, useRef, useEffect } from 'react';
import {
  Plus, Trash2, AlertCircle, Loader, X, Copy, ChevronUp, ChevronDown, Sparkles,
  List, CheckSquare, AlignLeft, ChevronDown as ChevronDownIcon,
  Bold, Italic, Underline, Image, HelpCircle, Columns,
  ZoomIn, ZoomOut, Tag, Check, Hash, ToggleLeft, Equal, ArrowUpDown
} from 'lucide-react';
import CommonFields from './CommonFields';

// ─── TYPES ────────────────────────────────────────────────────────────
interface MCQOption {
  id: string;
  text: string;
  isCorrect: boolean;
  imageUrl?: string;
  imageAlignment?: 'left' | 'center' | 'right';
  imageSizePercent?: number;
}

interface MatchingPair {
  id: string;
  left: string;
  right: string;
}

interface OrderingItem {
  id: string;
  text: string;
  order: number;
}

interface ExplanationImage {
  url: string;
  alignment: 'left' | 'center' | 'right';
  sizePercent: number;
}

type QuestionType =
  | 'multiple-choice'
  | 'multiple-select'
  | 'true-false'
  | 'short-answer'
  | 'paragraph'
  | 'dropdown'
  | 'matching'
  | 'ordering'
  | 'numeric';

interface QuestionBlock {
  id: string;
  type: QuestionType;
  questionText: string;
  questionCategory: string;
  isActive: boolean;
  questionImageUrl?: string;
  questionImageAlignment?: 'left' | 'center' | 'right';
  questionImageSizePercent?: number;
  optionsPerRow?: 1 | 2 | 3 | 4;
  options: MCQOption[];
  isRequired: boolean;
  hasOtherOption?: boolean;
  hasExplanation?: boolean;
  explanation?: string;
  explanationImage?: ExplanationImage;
  title?: string;
  description?: string;
  score?: number;
  difficulty?: 'easy' | 'medium' | 'hard';
  timeLimit?: number;
  memoryLimit?: number;
  sequence?: number;
  matchingPairs?: MatchingPair[];
  orderingItems?: OrderingItem[];
  trueFalseAnswer?: boolean | null;
  shortAnswer?: string;
  numericAnswer?: number | null;
  numericTolerance?: number | null;
}

interface MCQQuestionFormProps {
  initialData?: any;
  isEditing?: boolean;
  questionId?: string;
  onClose: () => void;
  onSave: (questionData: FormData, questionId?: string) => void;
  isSaving?: boolean;
  saveProgress?: number;
  saveMessage?: string;
  categories?: string[];
}

// ─── LOCAL STORAGE KEY ────────────────────────────────────────────────
const STORAGE_KEY = 'mcq_question_form_draft';

// ─── RICH TEXT EDITOR ─────────────────────────────────────────────────
const RichTextEditor: React.FC<{
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}> = ({ value, onChange, placeholder, className = '' }) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const [isEmpty, setIsEmpty] = useState(!value || value === '<br>' || value === '<div><br></div>' || value === '<p></p>' || value === '<p><br></p>');

  useEffect(() => {
    if (editorRef.current) {
      const currentContent = editorRef.current.innerHTML;
      const normalizedValue = value || '';
      if (currentContent !== normalizedValue) {
        editorRef.current.innerHTML = normalizedValue;
      }
    }
    setIsEmpty(!value || value === '<br>' || value === '<div><br></div>' || value === '<p></p>' || value === '<p><br></p>');
  }, [value]);

  const execCommand = (cmd: string) => {
    document.execCommand(cmd, false);
    if (editorRef.current) {
      const content = editorRef.current.innerHTML;
      onChange(content);
      setIsEmpty(!content || content === '<br>' || content === '<div><br></div>' || content === '<p></p>' || content === '<p><br></p>');
    }
  };

  return (
    <div className={`border-0 border-b-2 border-gray-200 dark:border-gray-700 focus-within:border-indigo-500 dark:focus-within:border-indigo-400 transition-colors duration-200 ${className}`}>
      <div className="flex items-center gap-0.5 pb-1">
        {[
          { cmd: 'bold', icon: <Bold className="h-3.5 w-3.5" />, label: 'Bold' },
          { cmd: 'italic', icon: <Italic className="h-3.5 w-3.5" />, label: 'Italic' },
          { cmd: 'underline', icon: <Underline className="h-3.5 w-3.5" />, label: 'Underline' },
        ].map(({ cmd, icon, label }) => (
          <button
            key={cmd}
            type="button"
            onMouseDown={(e) => { e.preventDefault(); execCommand(cmd); }}
            title={label}
            className="p-1.5 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-md transition-colors text-gray-500 dark:text-gray-400"
          >
            {icon}
          </button>
        ))}
      </div>
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={(e) => onChange(e.currentTarget.innerHTML)}
        className="py-1.5 min-h-[36px] focus:outline-none text-sm text-gray-800 dark:text-gray-200 font-medium prose prose-sm max-w-none dark:prose-invert"
        data-placeholder={placeholder}
      />
      {isEmpty && placeholder && (
        <div className="relative -top-6 left-0 text-gray-400 dark:text-gray-500 text-sm font-normal pointer-events-none select-none">
          {placeholder}
        </div>
      )}
    </div>
  );
};

// ─── IMAGE TOOLBAR ────────────────────────────────────────────────────
const ImageToolbar: React.FC<{
  alignment: 'left' | 'center' | 'right';
  sizePercent: number;
  onAlignmentChange: (a: 'left' | 'center' | 'right') => void;
  onSizeChange: (v: number) => void;
  onRemove: () => void;
  onClose: () => void;
}> = ({ alignment, sizePercent, onAlignmentChange, onSizeChange, onRemove, onClose }) => {
  return (
    <div className="absolute top-2 left-1/2 -translate-x-1/2 z-50 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl dark:shadow-gray-900/50 border border-indigo-100 dark:border-indigo-900/50 overflow-visible select-none min-w-[280px]">
      <div className="flex items-stretch divide-x divide-gray-100 dark:divide-gray-700">
        <div className="flex flex-col items-center justify-center px-3 py-2 gap-1">
          <span className="text-[9px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Align</span>
          <div className="flex items-center gap-0.5">
            {(['left', 'center', 'right'] as const).map((a) => (
              <button
                key={a}
                onClick={() => onAlignmentChange(a)}
                className={`w-6 h-6 rounded-lg text-[10px] font-bold transition-all ${
                  alignment === a
                    ? 'bg-indigo-600 text-white shadow-md dark:bg-indigo-500'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 hover:text-indigo-600 dark:hover:text-indigo-400'
                }`}
              >
                {a === 'left' ? 'L' : a === 'center' ? 'C' : 'R'}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col justify-center px-3 py-2 gap-1 flex-1">
          <span className="text-[9px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Size</span>
          <div className="flex items-center gap-1.5">
            <ZoomOut className="h-3 w-3 text-gray-400 dark:text-gray-500" />
            <input
              type="range"
              min={10}
              max={100}
              step={5}
              value={sizePercent}
              onChange={(e) => onSizeChange(parseInt(e.target.value))}
              className="flex-1 h-1.5 accent-indigo-600 dark:accent-indigo-500 cursor-pointer"
            />
            <ZoomIn className="h-3 w-3 text-gray-400 dark:text-gray-500" />
            <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 w-8 text-right">{sizePercent}%</span>
          </div>
        </div>

        <div className="flex items-center gap-0.5 px-2 py-2">
          <button
            onClick={onRemove}
            className="flex flex-col items-center gap-0.5 p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-red-500 dark:text-red-400 transition-all"
            title="Remove image"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span className="text-[9px] font-semibold">Remove</span>
          </button>
          <button
            onClick={onClose}
            className="flex flex-col items-center gap-0.5 p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-gray-400 dark:text-gray-500 transition-all"
            title="Close"
          >
            <X className="h-3.5 w-3.5" />
            <span className="text-[9px] font-semibold">Close</span>
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── QUESTION IMAGE SECTION ───────────────────────────────────────────
const QuestionImageSection: React.FC<{
  imageUrl: string;
  imageAlignment: 'left' | 'center' | 'right';
  imageSizePercent: number;
  isToolbarActive: boolean;
  onImageClick: () => void;
  onAlignmentChange: (a: 'left' | 'center' | 'right') => void;
  onSizeChange: (v: number) => void;
  onRemove: () => void;
  onCloseToolbar: () => void;
}> = ({
  imageUrl, imageAlignment, imageSizePercent, isToolbarActive,
  onImageClick, onAlignmentChange, onSizeChange, onRemove, onCloseToolbar,
}) => {
  const justify = imageAlignment === 'left' ? 'flex-start'
    : imageAlignment === 'right' ? 'flex-end' : 'center';
  
  return (
    <div className="px-4 pt-2 pb-1">
      <div className="flex items-center gap-2 mb-1">
        <span className="inline-flex items-center gap-1 text-[10px] text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 rounded-full font-semibold">
          <Image className="h-2.5 w-2.5" /> Question Image · {imageSizePercent}% · {imageAlignment}
        </span>
        <button
          onClick={onImageClick}
          className="text-[10px] text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 font-semibold underline underline-offset-2"
        >
          Edit
        </button>
      </div>
      <div className="relative" style={{ minHeight: isToolbarActive ? '80px' : 'auto' }}>
        {isToolbarActive && (
          <ImageToolbar
            alignment={imageAlignment}
            sizePercent={imageSizePercent}
            onAlignmentChange={onAlignmentChange}
            onSizeChange={onSizeChange}
            onRemove={onRemove}
            onClose={onCloseToolbar}
          />
        )}
        <div style={{ display: 'flex', justifyContent: justify }}>
          <div
            style={{ width: `${imageSizePercent}%` }}
            className="cursor-pointer transition-all duration-200"
            onClick={onImageClick}
          >
            <img
              src={imageUrl}
              alt="Question"
              className={`w-full h-auto rounded-xl border-2 transition-all ${
                isToolbarActive
                  ? 'border-indigo-400 dark:border-indigo-500 ring-4 ring-indigo-100 dark:ring-indigo-900/30 shadow-lg'
                  : 'border-transparent hover:border-indigo-300 dark:hover:border-indigo-600 hover:shadow-md'
              }`}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── OPTIONS PER ROW PICKER ───────────────────────────────────────────
const OptionsPerRowPicker: React.FC<{
  value: 1 | 2 | 3 | 4;
  onChange: (v: 1 | 2 | 3 | 4) => void;
}> = ({ value, onChange }) => (
  <div className="flex items-center gap-1.5">
    <Columns className="h-3 w-3 text-gray-400 dark:text-gray-500" />
    <span className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase">Per row:</span>
    {([1, 2, 3, 4] as const).map(n => (
      <button
        key={n}
        onClick={() => onChange(n)}
        className={`w-6 h-6 rounded-lg text-[11px] font-bold transition-all ${
          value === n
            ? 'bg-indigo-600 text-white shadow-md dark:bg-indigo-500'
            : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 hover:text-indigo-600 dark:hover:text-indigo-400'
        }`}
      >
        {n}
      </button>
    ))}
  </div>
);

// ─── OPTION INPUT ─────────────────────────────────────────────────────
const OptionInput: React.FC<{
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  isCorrect: boolean;
  type: QuestionType;
}> = ({ value, onChange, placeholder, isCorrect, type }) => {
  const isDropdown = type === 'dropdown';
  
  return (
    <div className="flex-1 relative">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full text-xs outline-none bg-transparent border-0 border-b border-transparent focus:border-indigo-300 dark:focus:border-indigo-500 py-0.5 transition-colors ${
          isCorrect ? 'font-semibold text-emerald-700 dark:text-emerald-400' : 'text-gray-700 dark:text-gray-300'
        }`}
        placeholder={placeholder}
      />
    </div>
  );
};

// ─── MATCHING PAIR COMPONENT ──────────────────────────────────────────
const MatchingPairComponent: React.FC<{
  pair: MatchingPair;
  index: number;
  onUpdate: (side: 'left' | 'right', value: string) => void;
  onRemove: () => void;
  canRemove: boolean;
}> = ({ pair, index, onUpdate, onRemove, canRemove }) => (
  <div className="flex items-center gap-2 mb-2 group">
    <span className="w-6 h-6 rounded-md text-[10px] font-bold flex items-center justify-center flex-shrink-0 bg-blue-100 text-blue-700">
      {index + 1}
    </span>
    <input
      type="text"
      value={pair.left}
      onChange={(e) => onUpdate('left', e.target.value)}
      placeholder="Left item..."
      className="flex-1 px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-gray-800"
    />
    <Equal className="h-4 w-4 text-gray-400 flex-shrink-0" />
    <input
      type="text"
      value={pair.right}
      onChange={(e) => onUpdate('right', e.target.value)}
      placeholder="Right item..."
      className="flex-1 px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-gray-800"
    />
    {canRemove && (
      <button
        onClick={onRemove}
        className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors flex-shrink-0"
      >
        <Trash2 className="h-3.5 w-3.5 text-red-500" />
      </button>
    )}
  </div>
);

// ─── ORDERING ITEM COMPONENT ──────────────────────────────────────────
const OrderingItemComponent: React.FC<{
  item: OrderingItem;
  index: number;
  totalItems: number;
  onUpdate: (value: string) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
  canRemove: boolean;
}> = ({ item, index, totalItems, onUpdate, onMoveUp, onMoveDown, onRemove, canRemove }) => (
  <div className="flex items-center gap-2 mb-2 group">
    <div className="flex flex-col gap-0.5 flex-shrink-0">
      <button
        onClick={onMoveUp}
        disabled={index === 0}
        className="p-0.5 rounded hover:bg-gray-100 disabled:opacity-30 transition-colors"
      >
        <ChevronUp className="h-3 w-3" />
      </button>
      <button
        onClick={onMoveDown}
        disabled={index === totalItems - 1}
        className="p-0.5 rounded hover:bg-gray-100 disabled:opacity-30 transition-colors"
      >
        <ChevronDown className="h-3 w-3" />
      </button>
    </div>
    <span className="w-6 h-6 rounded-md text-[10px] font-bold flex items-center justify-center flex-shrink-0 bg-cyan-100 text-cyan-700">
      {index + 1}
    </span>
    <input
      type="text"
      value={item.text}
      onChange={(e) => onUpdate(e.target.value)}
      placeholder={`Item ${index + 1}...`}
      className="flex-1 px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-gray-800"
    />
    {canRemove && (
      <button
        onClick={onRemove}
        className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors flex-shrink-0"
      >
        <Trash2 className="h-3.5 w-3.5 text-red-500" />
      </button>
    )}
  </div>
);

// ─── MAIN COMPONENT ───────────────────────────────────────────────────
const MCQFields: React.FC<MCQQuestionFormProps> = ({
  initialData,
  isEditing = false,
  questionId,
  onClose,
  onSave,
  isSaving = false,
  categories = [],
}) => {
  const [showQuestionTypeMenu, setShowQuestionTypeMenu] = useState<string | null>(null);
  const [activeImageToolbar, setActiveImageToolbar] = useState<
    { type: 'question'; blockId: string } |
    { type: 'option'; blockId: string; optionId: string } |
    { type: 'explanation'; blockId: string } |
    null
  >(null);
  const [hasLoadedFromStorage, setHasLoadedFromStorage] = useState(false);
  const [answerKeyOpenBlockId, setAnswerKeyOpenBlockId] = useState<string | null>(null);
  const [errors, setErrors] = useState<{ blocks?: { [key: string]: any } }>({});

  const generateId = (prefix: string) =>
    `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  const makeDefaultBlock = (id: string, sequence: number = 0): QuestionBlock => ({
    id,
    type: 'multiple-choice',
    questionText: '',
    questionCategory: '',
    isActive: true,
    title: '',
    description: '',
    questionImageUrl: '',
    questionImageAlignment: 'center',
    questionImageSizePercent: 60,
    optionsPerRow: 1,
    options: [
      { id: `${id}-opt-1`, text: '', isCorrect: false, imageAlignment: 'center', imageSizePercent: 60 },
      { id: `${id}-opt-2`, text: '', isCorrect: false, imageAlignment: 'center', imageSizePercent: 60 },
    ],
    isRequired: false,
    hasOtherOption: false,
    hasExplanation: false,
    explanation: '',
    score: 10,
    difficulty: 'medium',
    timeLimit: 2000,
    memoryLimit: 256,
    sequence,
    matchingPairs: [
      { id: `${id}-pair-1`, left: '', right: '' },
      { id: `${id}-pair-2`, left: '', right: '' },
    ],
    orderingItems: [
      { id: `${id}-ord-1`, text: '', order: 1 },
      { id: `${id}-ord-2`, text: '', order: 2 },
    ],
    trueFalseAnswer: null,
    shortAnswer: '',
    numericAnswer: null,
    numericTolerance: null,
  });

// Initialize state
const [questionBlocks, setQuestionBlocks] = useState<QuestionBlock[]>(() => {
  if (isEditing && initialData) {
    const blocksArray = Array.isArray(initialData) ? initialData : [initialData];
    
    return blocksArray.map((blockData, index) => {
      const id = blockData.id || `block-${index}-${Date.now()}`;
      
      // Extract the actual text content from mcqQuestionTitle (which might be a string or an object)
      let htmlContent = '';
      let titleImageUrl = '';
      let titleImageAlignment = 'center';
      let titleImageSizePercent = 60;

      if (blockData.mcqQuestionTitle) {
        if (typeof blockData.mcqQuestionTitle === 'string') {
          htmlContent = blockData.mcqQuestionTitle;
        } else if (typeof blockData.mcqQuestionTitle === 'object') {
          htmlContent = blockData.mcqQuestionTitle.text || '';
          titleImageUrl = blockData.mcqQuestionTitle.imageUrl || '';
          titleImageAlignment = blockData.mcqQuestionTitle.imageAlignment || 'center';
          titleImageSizePercent = blockData.mcqQuestionTitle.imageSizePercent || 60;
        }
      } else if (blockData.questionTitle) {
        htmlContent = blockData.questionTitle;
      } else if (blockData.questionText) {
        htmlContent = blockData.questionText;
      } else if (blockData.title) {
        htmlContent = blockData.title;
      }

      // Extract description text from mcqQuestionDescription
      let descriptionText = '';
      let descriptionImageUrl = '';
      let descriptionImageAlignment = 'center';
      let descriptionImageSizePercent = 60;
      let hasExplanation = false;

      if (blockData.mcqQuestionDescription) {
        if (typeof blockData.mcqQuestionDescription === 'string') {
          descriptionText = blockData.mcqQuestionDescription;
          hasExplanation = !!descriptionText;
        } else if (typeof blockData.mcqQuestionDescription === 'object') {
          descriptionText = blockData.mcqQuestionDescription.text || '';
          descriptionImageUrl = blockData.mcqQuestionDescription.imageUrl || '';
          descriptionImageAlignment = blockData.mcqQuestionDescription.imageAlignment || 'center';
          descriptionImageSizePercent = blockData.mcqQuestionDescription.imageSizePercent || 60;
          hasExplanation = !!descriptionText || !!descriptionImageUrl;
        }
      } else if (blockData.description) {
        descriptionText = blockData.description;
        hasExplanation = !!descriptionText;
      }
      
      const options = blockData.mcqQuestionOptions?.map((opt: any, oi: number) => ({
        id: opt.id || `opt-${index}-${oi}-${Date.now()}`,
        text: opt.text || opt.content || '',
        isCorrect: opt.isCorrect || false,
        imageUrl: opt.imageUrl || '',
        imageAlignment: opt.imageAlignment || 'center',
        imageSizePercent: opt.imageSizePercent || 60,
      })) || makeDefaultBlock(id).options;

      const matchingPairs = blockData.matchingPairs?.map((p: any, pi: number) => ({
        id: p.id || `${id}-pair-${pi}`,
        left: p.left || '',
        right: p.right || '',
      })) || makeDefaultBlock(id).matchingPairs;

      const orderingItems = blockData.orderingItems?.map((item: any, oi: number) => ({
        id: item.id || `${id}-ord-${oi}`,
        text: item.text || '',
        order: item.order || oi + 1,
      })) || makeDefaultBlock(id).orderingItems;
      
      const mapApiTypeToInternal = (apiType: string): QuestionType => {
        const mapping: Record<string, QuestionType> = {
          'multiple_choice': 'multiple-choice',
          'multiple_select': 'multiple-select',
          'true_false': 'true-false',
          'short_answer': 'short-answer',
          'essay': 'paragraph',
          'dropdown': 'dropdown',
          'matching': 'matching',
          'ordering': 'ordering',
          'numeric': 'numeric',
        };
        return mapping[apiType] || 'multiple-choice';
      };
      
      return {
        ...makeDefaultBlock(id),
        id,
        type: mapApiTypeToInternal(blockData.mcqQuestionType || blockData.questionType),
        questionText: htmlContent,
        questionCategory: blockData.questionCategory || '',
        isActive: blockData.isActive !== undefined ? blockData.isActive : true,
        title: htmlContent.replace(/<[^>]*>/g, '').trim(),
        description: descriptionText,
        options,
        matchingPairs,
        orderingItems,
        trueFalseAnswer: blockData.trueFalseAnswer ?? null,
        shortAnswer: blockData.shortAnswer || '',
        numericAnswer: blockData.numericAnswer ?? null,
        numericTolerance: blockData.numericTolerance ?? null,
        score: blockData.mcqQuestionScore || blockData.score || 10,
        difficulty: blockData.mcqQuestionDifficulty || blockData.difficulty || 'medium',
        timeLimit: blockData.mcqQuestionTimeLimit || blockData.timeLimit || 2000,
        memoryLimit: blockData.memoryLimit || 256,
        sequence: blockData.sequence !== undefined ? blockData.sequence : index,
        hasExplanation: hasExplanation || blockData.hasExplanation || false,
        explanation: descriptionText,
        explanationImage: descriptionImageUrl ? {
          url: descriptionImageUrl,
          alignment: descriptionImageAlignment,
          sizePercent: descriptionImageSizePercent
        } : undefined,
        isRequired: blockData.mcqQuestionRequired || blockData.isRequired || false,
        hasOtherOption: blockData.hasOtherOption || false,
        questionImageUrl: titleImageUrl,
        questionImageAlignment: titleImageAlignment,
        questionImageSizePercent: titleImageSizePercent,
        optionsPerRow: blockData.mcqQuestionOptionsPerRow || blockData.optionsPerRow || 1,
      };
    });
  }
  return [makeDefaultBlock(generateId('block'), 0)];
});

  const mapInternalTypeToApi = (type: QuestionType): string => {
    const mapping: Record<QuestionType, string> = {
      'multiple-choice': 'multiple_choice',
      'multiple-select': 'multiple_select',
      'true-false': 'true_false',
      'short-answer': 'short_answer',
      'paragraph': 'essay',
      'dropdown': 'dropdown',
      'matching': 'matching',
      'ordering': 'ordering',
      'numeric': 'numeric',
    };
    return mapping[type] || 'multiple_choice';
  };

  // Local Storage Persistence
  useEffect(() => {
    if (!isEditing && !initialData && !hasLoadedFromStorage) {
      const savedDraft = localStorage.getItem(STORAGE_KEY);
      if (savedDraft) {
        try {
          const parsed = JSON.parse(savedDraft);
          if (parsed && parsed.length > 0) {
            setQuestionBlocks(parsed);
          }
        } catch (e) {
          console.error('Failed to load draft:', e);
        }
      }
      setHasLoadedFromStorage(true);
    }
  }, [isEditing, initialData, hasLoadedFromStorage]);

  useEffect(() => {
    if (!isEditing && questionBlocks.length > 0 && hasLoadedFromStorage) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(questionBlocks));
    } else if (questionBlocks.length === 0 && !isEditing) {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [questionBlocks, isEditing, hasLoadedFromStorage]);

  const clearDraft = () => {
    if (!isEditing) {
      localStorage.removeItem(STORAGE_KEY);
    }
  };

  // Block mutators
  const updateBlock = (blockId: string, patch: Partial<QuestionBlock>) =>
    setQuestionBlocks(bs => bs.map(b => b.id === blockId ? { ...b, ...patch } : b));

  const updateOption = (blockId: string, optionId: string, patch: Partial<MCQOption>) =>
    setQuestionBlocks(bs => bs.map(b =>
      b.id === blockId
        ? { ...b, options: b.options.map(o => o.id === optionId ? { ...o, ...patch } : o) }
        : b
    ));

  // Matching helpers
  const addMatchingPair = (blockId: string) => {
    setQuestionBlocks(bs => bs.map(b =>
      b.id === blockId ? {
        ...b,
        matchingPairs: [...(b.matchingPairs || []), 
          { id: generateId(`pair-${blockId}`), left: '', right: '' }
        ]
      } : b
    ));
  };

  const updateMatchingPair = (blockId: string, pairId: string, side: 'left' | 'right', value: string) => {
    setQuestionBlocks(bs => bs.map(b =>
      b.id === blockId ? {
        ...b,
        matchingPairs: (b.matchingPairs || []).map(p =>
          p.id === pairId ? { ...p, [side]: value } : p
        )
      } : b
    ));
  };

  const removeMatchingPair = (blockId: string, pairId: string) => {
    setQuestionBlocks(bs => bs.map(b =>
      b.id === blockId && (b.matchingPairs?.length || 0) > 2 ? {
        ...b,
        matchingPairs: (b.matchingPairs || []).filter(p => p.id !== pairId)
      } : b
    ));
  };

  // Ordering helpers
  const addOrderingItem = (blockId: string) => {
    setQuestionBlocks(bs => bs.map(b =>
      b.id === blockId ? {
        ...b,
        orderingItems: [...(b.orderingItems || []),
          { id: generateId(`ord-${blockId}`), text: '', order: (b.orderingItems?.length || 0) + 1 }
        ]
      } : b
    ));
  };

  const updateOrderingItem = (blockId: string, itemId: string, value: string) => {
    setQuestionBlocks(bs => bs.map(b =>
      b.id === blockId ? {
        ...b,
        orderingItems: (b.orderingItems || []).map(item =>
          item.id === itemId ? { ...item, text: value } : item
        )
      } : b
    ));
  };

  const removeOrderingItem = (blockId: string, itemId: string) => {
    setQuestionBlocks(bs => bs.map(b =>
      b.id === blockId && (b.orderingItems?.length || 0) > 2 ? {
        ...b,
        orderingItems: (b.orderingItems || [])
          .filter(i => i.id !== itemId)
          .map((item, idx) => ({ ...item, order: idx + 1 }))
      } : b
    ));
  };

  const moveOrderingItem = (blockId: string, itemId: string, direction: 'up' | 'down') => {
    setQuestionBlocks(bs => bs.map(b => {
      if (b.id !== blockId) return b;
      const items = [...(b.orderingItems || [])];
      const idx = items.findIndex(i => i.id === itemId);
      if (idx < 0) return b;
      const newIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (newIdx < 0 || newIdx >= items.length) return b;
      [items[idx], items[newIdx]] = [items[newIdx], items[idx]];
      return {
        ...b,
        orderingItems: items.map((item, i) => ({ ...item, order: i + 1 }))
      };
    }));
  };

  const handleQuestionChange = (id: string, v: string) => {
    const plainText = v.replace(/<[^>]*>/g, '').trim();
    updateBlock(id, { 
      questionText: v || '',
      title: plainText || 'Untitled Question'
    });
  };

  const handleCategoryChange = (id: string, category: string) => {
    updateBlock(id, { questionCategory: category });
  };

  const handleActiveChange = (id: string, isActive: boolean) => {
    updateBlock(id, { isActive });
  };

  const handleExplanationChange = (id: string, v: string) => 
    updateBlock(id, { explanation: v });
  
  const toggleExplanation = (id: string) => 
    updateBlock(id, { hasExplanation: !questionBlocks.find(b => b.id === id)?.hasExplanation });
  
  const toggleRequired = (id: string) => 
    updateBlock(id, { isRequired: !questionBlocks.find(b => b.id === id)?.isRequired });
  
  const setOptionsPerRow = (id: string, v: 1 | 2 | 3 | 4) => 
    updateBlock(id, { optionsPerRow: v });

  // Explanation image handlers
  const handleExplanationImageUpload = (blockId: string, file: File) => {
    const r = new FileReader();
    r.onload = (e) => {
      updateBlock(blockId, {
        explanationImage: {
          url: e.target?.result as string,
          alignment: 'center',
          sizePercent: 60
        }
      });
      setActiveImageToolbar({ type: 'explanation', blockId });
    };
    r.readAsDataURL(file);
  };

  const removeExplanationImage = (blockId: string) => {
    updateBlock(blockId, { explanationImage: undefined });
    setActiveImageToolbar(null);
  };

  const updateExplanationImageAlignment = (blockId: string, a: 'left' | 'center' | 'right') => {
    const block = questionBlocks.find(b => b.id === blockId);
    updateBlock(blockId, {
      explanationImage: {
        ...(block?.explanationImage || { url: '', alignment: 'center', sizePercent: 60 }),
        alignment: a
      }
    });
  };

  const updateExplanationImageSizePercent = (blockId: string, v: number) => {
    const block = questionBlocks.find(b => b.id === blockId);
    updateBlock(blockId, {
      explanationImage: {
        ...(block?.explanationImage || { url: '', alignment: 'center', sizePercent: 60 }),
        sizePercent: v
      }
    });
  };

  // Question image handlers
  const handleQuestionImageUpload = (blockId: string, file: File) => {
    const r = new FileReader();
    r.onload = (e) => {
      updateBlock(blockId, {
        questionImageUrl: e.target?.result as string,
        questionImageAlignment: 'center',
        questionImageSizePercent: 60,
      });
      setActiveImageToolbar({ type: 'question', blockId });
    };
    r.readAsDataURL(file);
  };

  const removeQuestionImage = (id: string) => {
    updateBlock(id, { questionImageUrl: '' });
    setActiveImageToolbar(null);
  };

  const updateQuestionImageAlignment = (id: string, a: 'left' | 'center' | 'right') =>
    updateBlock(id, { questionImageAlignment: a });

  const updateQuestionImageSizePercent = (id: string, v: number) =>
    updateBlock(id, { questionImageSizePercent: v });

  const handleQuestionImageClick = (id: string) =>
    setActiveImageToolbar(
      activeImageToolbar?.type === 'question' && activeImageToolbar.blockId === id ? null
        : { type: 'question', blockId: id }
    );

  // Option image handlers
  const handleOptionImageUpload = (blockId: string, optionId: string, file: File) => {
    const r = new FileReader();
    r.onload = (e) => {
      updateOption(blockId, optionId, {
        imageUrl: e.target?.result as string,
        imageAlignment: 'center',
        imageSizePercent: 60
      });
      setActiveImageToolbar({ type: 'option', blockId, optionId });
    };
    r.readAsDataURL(file);
  };

  const removeOptionImage = (bid: string, oid: string) => {
    updateOption(bid, oid, { imageUrl: '' });
    setActiveImageToolbar(null);
  };

  const updateOptionImageAlignment = (bid: string, oid: string, a: 'left' | 'center' | 'right') =>
    updateOption(bid, oid, { imageAlignment: a });

  const updateOptionImageSizePercent = (bid: string, oid: string, v: number) =>
    updateOption(bid, oid, { imageSizePercent: v });

  const handleOptionImageClick = (bid: string, oid: string) =>
    setActiveImageToolbar(
      activeImageToolbar?.type === 'option' && activeImageToolbar.blockId === bid && activeImageToolbar.optionId === oid
        ? null : { type: 'option', blockId: bid, optionId: oid }
    );

  const addOption = (blockId: string) => {
    setQuestionBlocks(bs => bs.map(b =>
      b.id === blockId ? {
        ...b,
        options: [...b.options, {
          id: generateId(`opt-${blockId}`),
          text: '',
          isCorrect: false,
          imageAlignment: 'center',
          imageSizePercent: 60,
        }]
      } : b
    ));
  };

  const addOtherOption = (id: string) => updateBlock(id, { hasOtherOption: true });
  const removeOtherOption = (id: string) => updateBlock(id, { hasOtherOption: false });

  const updateOptionText = (bid: string, oid: string, t: string) =>
    updateOption(bid, oid, { text: t });

  const setCorrectAnswer = (bid: string, oid: string) =>
    setQuestionBlocks(bs => bs.map(b =>
      b.id === bid
        ? { ...b, options: b.options.map(o => ({ ...o, isCorrect: o.id === oid })) }
        : b
    ));

  const toggleCorrectAnswer = (bid: string, oid: string) =>
    setQuestionBlocks(bs => bs.map(b =>
      b.id === bid
        ? { ...b, options: b.options.map(o => o.id === oid ? ({ ...o, isCorrect: !o.isCorrect }) : o) }
        : b
    ));

  const removeOption = (bid: string, oid: string) =>
    setQuestionBlocks(bs => bs.map(b =>
      b.id === bid && b.options.length > 2
        ? { ...b, options: b.options.filter(o => o.id !== oid) }
        : b
    ));

  const addQuestionBlock = () => {
    const id = generateId('block');
    const newBlock = makeDefaultBlock(id, questionBlocks.length);
    setQuestionBlocks(bs => [...bs, newBlock]);
  };

  const duplicateQuestionBlock = (blockId: string) => {
    const src = questionBlocks.find(b => b.id === blockId);
    if (!src) return;
    const nid = generateId('block');
    setQuestionBlocks(bs => [...bs, {
      ...src,
      id: nid,
      sequence: bs.length,
      questionText: src.questionText,
      title: src.title,
      options: src.options.map((o, i) => ({
        ...o,
        id: `${nid}-opt-${i + 1}`,
        text: o.text,
      })),
      matchingPairs: src.matchingPairs?.map((p, i) => ({
        ...p,
        id: `${nid}-pair-${i + 1}`,
      })),
      orderingItems: src.orderingItems?.map((item, i) => ({
        ...item,
        id: `${nid}-ord-${i + 1}`,
      })),
      explanationImage: src.explanationImage,
    }]);
  };

  const removeQuestionBlock = (id: string) =>
    setQuestionBlocks(bs => bs.filter(b => b.id !== id).map((b, idx) => ({ ...b, sequence: idx })));

  const moveBlock = (id: string, dir: 'up' | 'down') => {
    const idx = questionBlocks.findIndex(b => b.id === id);
    if ((dir === 'up' && idx === 0) || (dir === 'down' && idx === questionBlocks.length - 1)) return;
    const nb = [...questionBlocks];
    const ni = dir === 'up' ? idx - 1 : idx + 1;
    [nb[idx], nb[ni]] = [nb[ni], nb[idx]];
    nb.forEach((b, index) => { b.sequence = index; });
    setQuestionBlocks(nb);
  };

  const clearBlockError = (blockId: string, field: string) => {
    setErrors(prev => {
      const be = { ...(prev.blocks?.[blockId] || {}) };
      delete be[field];
      return { blocks: { ...prev.blocks, [blockId]: be } };
    });
  };

  // Validation
  const validateSingleBlock = (b: QuestionBlock): boolean => {
    const be: any = {};
    let valid = true;

    const text = b.questionText.replace(/<[^>]*>/g, '').trim();
    if (!text) {
      be.questionText = 'Question text is required';
      valid = false;
    }

    if (!b.questionCategory) {
      be.questionCategory = 'Category is required';
      valid = false;
    }

    if (!b.difficulty) {
      be.difficulty = 'Difficulty is required';
      valid = false;
    }

    if (['multiple-choice', 'multiple-select', 'dropdown'].includes(b.type)) {
      const validOptions = b.options.filter(o => o.text.trim());
      if (validOptions.length < 2) {
        be.options = 'At least 2 options with text are required';
        valid = false;
      }

      const hasCorrectAnswer = b.options.some(o => o.isCorrect);
      if (!hasCorrectAnswer) {
        if (b.type === 'multiple-choice' || b.type === 'dropdown') {
          be.correctAnswer = 'Please mark one option as the correct answer';
        } else if (b.type === 'multiple-select') {
          be.correctAnswer = 'Please mark at least one option as correct';
        }
        valid = false;
      }
    }

    if (b.type === 'true-false' && b.trueFalseAnswer === null) {
      be.trueFalse = 'Please select True or False';
      valid = false;
    }

    if (b.type === 'matching') {
      const hasEmptyPairs = !b.matchingPairs?.every(p => p.left.trim() && p.right.trim());
      if (hasEmptyPairs) {
        be.matching = 'All matching pairs must be filled';
        valid = false;
      }
    }

    if (b.type === 'ordering') {
      const hasEmptyItems = !b.orderingItems?.every(item => item.text.trim());
      if (hasEmptyItems) {
        be.ordering = 'All ordering items must be filled';
        valid = false;
      }
    }

    if (b.type === 'numeric' && (b.numericAnswer === null || b.numericAnswer === undefined)) {
      be.numeric = 'Please enter a numeric answer';
      valid = false;
    }

    if (b.hasExplanation && !b.explanation?.replace(/<[^>]*>/g, '').trim() && !b.explanationImage?.url) {
      be.explanation = 'Explanation text or image is required when enabled';
      valid = false;
    }

    if (Object.keys(be).length > 0) {
      setErrors(prev => ({ blocks: { ...prev.blocks, [b.id]: be } }));
    } else {
      setErrors(prev => {
        const nb = { ...(prev.blocks || {}) };
        delete nb[b.id];
        return { blocks: nb };
      });
    }

    return valid;
  };

  const validateForm = (): boolean => {
    let allValid = true;
    questionBlocks.forEach((block) => {
      if (!validateSingleBlock(block)) {
        allValid = false;
      }
    });
    return allValid;
  };

  // Helper function to convert base64 to File
  const base64ToFile = (base64String: string, fileName: string): File | null => {
    try {
      const matches = base64String.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      if (!matches || matches.length !== 3) return null;

      const contentType = matches[1];
      const base64Data = matches[2];
      const binaryData = atob(base64Data);
      
      const arrayBuffer = new ArrayBuffer(binaryData.length);
      const uint8Array = new Uint8Array(arrayBuffer);
      
      for (let i = 0; i < binaryData.length; i++) {
        uint8Array[i] = binaryData.charCodeAt(i);
      }
      
      return new File([uint8Array], fileName, { type: contentType });
    } catch (error) {
      console.error('Error converting base64 to file:', error);
      return null;
    }
  };

// Format Payload for Save - CORRECTED VERSION
const formatPayload = () => {
  const imagesToUpload: { 
    path: string; 
    file: File; 
    type: 'option' | 'question' | 'explanation'; 
    questionIndex: number; 
    optionIndex?: number;
  }[] = [];
  
  const formattedQuestions = questionBlocks.map((block, questionIndex) => {
    const htmlContent = block.questionText && block.questionText.trim() !== '' 
      ? block.questionText 
      : '<p></p>';
    
    // Handle question image for mcqQuestionTitle
    let questionImageUrl = null;
    let questionImageAlignment = block.questionImageAlignment || 'center';
    let questionImageSizePercent = block.questionImageSizePercent || 60;
    
    if (block.questionImageUrl && block.questionImageUrl.startsWith('data:')) {
      const fileName = `question_${block.id}_${Date.now()}.jpg`;
      questionImageUrl = `/uploads/${fileName}`;
      
      const imageFile = base64ToFile(block.questionImageUrl, fileName);
      if (imageFile) {
        imagesToUpload.push({
          path: questionImageUrl,
          file: imageFile,
          type: 'question',
          questionIndex,
        });
      }
    } else if (block.questionImageUrl) {
      questionImageUrl = block.questionImageUrl;
    }
    
    // Handle explanation with image
    let explanationObject = null;
    
    if (block.hasExplanation) {
      const explanationText = block.explanation || '';
      let explanationImageUrl = null;
      
      // Handle explanation image
      if (block.explanationImage?.url && block.explanationImage.url.startsWith('data:')) {
        const fileName = `explanation_${block.id}_${Date.now()}.jpg`;
        explanationImageUrl = `/uploads/${fileName}`;
        
        const imageFile = base64ToFile(block.explanationImage.url, fileName);
        if (imageFile) {
          imagesToUpload.push({
            path: explanationImageUrl,
            file: imageFile,
            type: 'explanation',
            questionIndex,
          });
        }
      } else if (block.explanationImage?.url) {
        explanationImageUrl = block.explanationImage.url;
      }
      
      // Only create explanation object if there's text or image
      if (explanationText || explanationImageUrl) {
        explanationObject = {
          text: explanationText,
          ...(explanationImageUrl && { imageUrl: explanationImageUrl }),
          ...(block.explanationImage?.alignment && { imageAlignment: block.explanationImage.alignment }),
          ...(block.explanationImage?.sizePercent && { imageSizePercent: block.explanationImage.sizePercent })
        };
      }
    }
    
    // Handle options for choice-based questions
    let mcqQuestionOptions: any[] = [];
    let mcqQuestionCorrectAnswers: string[] = [];

    if (['multiple-choice', 'multiple-select', 'dropdown'].includes(block.type)) {
      const validOptions = block.options.filter(o => o.text.trim() !== '');
      
      if (block.type === 'multiple-select') {
        mcqQuestionCorrectAnswers = validOptions
          .filter(o => o.isCorrect)
          .map(o => o.text.trim());
      } else {
        const correctOption = validOptions.find(o => o.isCorrect);
        if (correctOption) {
          mcqQuestionCorrectAnswers = [correctOption.text.trim()];
        } else if (validOptions.length > 0) {
          mcqQuestionCorrectAnswers = [validOptions[0].text.trim()];
        }
      }

      mcqQuestionOptions = validOptions.map((o, optionIndex) => {
        let imagePath = null;
        
        if (o.imageUrl && o.imageUrl.startsWith('data:')) {
          const fileName = `option_${block.id}_${o.id}_${Date.now()}.jpg`;
          imagePath = `/uploads/${fileName}`;
          
          const imageFile = base64ToFile(o.imageUrl, fileName);
          if (imageFile) {
            imagesToUpload.push({
              path: imagePath,
              file: imageFile,
              type: 'option',
              questionIndex,
              optionIndex,
            });
          }
        } else if (o.imageUrl) {
          imagePath = o.imageUrl;
        }

        return {
          text: o.text.trim(),
          isCorrect: o.isCorrect || false,
          imageUrl: imagePath,
          imageAlignment: o.imageAlignment || 'left',
          imageSizePercent: o.imageSizePercent || 100
        };
      });
    }

    // Build the question payload - FIXED: mcqQuestionTitle as object
    const questionPayload: any = {
      questionCategory: block.questionCategory || 'MCQ',
      questionType: 'MCQ',
      isActive: block.isActive !== undefined ? block.isActive : true,
      // FIX: Send as object with text field
     mcqQuestionTitle: {
    text: htmlContent,
    ...(questionImageUrl && { imageUrl: questionImageUrl }),
    ...(questionImageAlignment && { imageAlignment: questionImageAlignment }),
    ...(questionImageSizePercent && { imageSizePercent: questionImageSizePercent })
  },
      mcqQuestionType: mapInternalTypeToApi(block.type),
      mcqQuestionDifficulty: block.difficulty || 'medium',
      mcqQuestionScore: block.score || 10,
      mcqQuestionTimeLimit: block.timeLimit || 0,
      mcqQuestionOptionsPerRow: block.optionsPerRow || 1,
      mcqQuestionRequired: block.isRequired === true,
      sequence: questionIndex,
    };

    // Add explanation as mcqQuestionDescription
    if (explanationObject) {
      questionPayload.mcqQuestionDescription = explanationObject;
    }

    // Add options only for choice-based questions
    if (['multiple-choice', 'multiple-select', 'dropdown'].includes(block.type)) {
      questionPayload.mcqQuestionOptions = mcqQuestionOptions;
      questionPayload.mcqQuestionCorrectAnswers = mcqQuestionCorrectAnswers;
    }

    // Add type-specific fields
    if (block.type === 'true-false') {
      questionPayload.trueFalseAnswer = block.trueFalseAnswer;
    }
    
    if (block.type === 'short-answer') {
      questionPayload.shortAnswer = block.shortAnswer || '';
    }
    
    if (block.type === 'numeric') {
      questionPayload.numericAnswer = block.numericAnswer ?? null;
      questionPayload.numericTolerance = block.numericTolerance ?? null;
    }
    
    if (block.type === 'matching') {
      questionPayload.matchingPairs = (block.matchingPairs || []).map(p => ({ 
        left: p.left, 
        right: p.right 
      }));
    }
    
    if (block.type === 'ordering') {
      questionPayload.orderingItems = (block.orderingItems || []).map(i => ({ 
        text: i.text, 
        order: i.order 
      }));
    }

    // Clean undefined fields
    Object.keys(questionPayload).forEach(key => {
      if (questionPayload[key] === undefined || questionPayload[key] === null) {
        delete questionPayload[key];
      }
    });

    return questionPayload;
  });

  return {
    questions: formattedQuestions,
    images: imagesToUpload
  };
};

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    const formattedData = formatPayload();
    if (!formattedData.questions || formattedData.questions.length === 0) return;
    
    const formData = new FormData();
    formData.append('questionsData', JSON.stringify(formattedData.questions));
    
    formattedData.images.forEach((item) => {
      if (item.type === 'option') {
        const fieldName = `question_${item.questionIndex}_option_${item.optionIndex}_image`;
        formData.append(fieldName, item.file);
      } else if (item.type === 'question') {
        const fieldName = `question_${item.questionIndex}_image`;
        formData.append(fieldName, item.file);
      } else if (item.type === 'explanation') {
        const fieldName = `question_${item.questionIndex}_explanation_image`;
        formData.append(fieldName, item.file);
      }
    });
    
    console.log('📤 Sending MCQ Payload:', {
      questionsCount: formattedData.questions.length,
      imagesCount: formattedData.images.length,
      firstQuestion: formattedData.questions[0]
    });
    
    clearDraft();
    
    onSave(formData, questionId);
  };

  const questionTypes: { type: QuestionType; label: string; icon: React.ReactNode; group: string }[] = [
    { type: 'multiple-choice', label: 'Multiple Choice', icon: <List className="h-3.5 w-3.5" />, group: 'Choice' },
    { type: 'multiple-select', label: 'Multiple Select', icon: <CheckSquare className="h-3.5 w-3.5" />, group: 'Choice' },
    { type: 'true-false', label: 'True / False', icon: <ToggleLeft className="h-3.5 w-3.5" />, group: 'Choice' },
    { type: 'dropdown', label: 'Dropdown', icon: <ChevronDownIcon className="h-3.5 w-3.5" />, group: 'Choice' },
    { type: 'short-answer', label: 'Short Answer', icon: <AlignLeft className="h-3.5 w-3.5" />, group: 'Text' },
    { type: 'paragraph', label: 'Paragraph', icon: <AlignLeft className="h-3.5 w-3.5" />, group: 'Text' },
    { type: 'matching', label: 'Matching', icon: <Equal className="h-3.5 w-3.5" />, group: 'Complex' },
    { type: 'ordering', label: 'Ordering', icon: <ArrowUpDown className="h-3.5 w-3.5" />, group: 'Complex' },
    { type: 'numeric', label: 'Numeric', icon: <Hash className="h-3.5 w-3.5" />, group: 'Complex' },
  ];

  const getTypeIcon = (type: QuestionType) =>
    questionTypes.find(qt => qt.type === type)?.icon ?? <List className="h-3.5 w-3.5" />;

  const getTypeLabel = (type: QuestionType) =>
    questionTypes.find(qt => qt.type === type)?.label ?? type;

  // Render options for choice-based questions
  const renderOptions = (block: QuestionBlock) => {
    const isMultiSelect = block.type === 'multiple-select';
    const isDropdown = block.type === 'dropdown';
    const isAnswerKeyMode = answerKeyOpenBlockId === block.id;
    const filledOptions = block.options.filter(o => o.text.trim());
    const correctCount = block.options.filter(o => o.isCorrect).length;

    if (isAnswerKeyMode) {
      return (
        <div className="px-4 py-3">
          <p className="text-sm text-gray-600 mb-3">
            Select the correct answer{isMultiSelect ? 's' : ''} below, then click <strong className="text-green-600">Done</strong>.
          </p>
          <div className="space-y-2">
            {block.options.map((opt, idx) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  if (isMultiSelect) {
                    toggleCorrectAnswer(block.id, opt.id);
                  } else {
                    setCorrectAnswer(block.id, opt.id);
                  }
                }}
                className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${
                  opt.isCorrect
                    ? 'border-green-400 bg-green-50'
                    : 'border-gray-200 bg-white hover:border-indigo-300'
                }`}
              >
                {isDropdown ? (
                  <span className="text-sm font-semibold w-5">{idx + 1}.</span>
                ) : isMultiSelect ? (
                  <div className={`w-5 h-5 border-2 rounded flex items-center justify-center ${
                    opt.isCorrect ? 'border-green-500 bg-green-500' : 'border-gray-300'
                  }`}>
                    {opt.isCorrect && <Check className="h-3 w-3 text-white" />}
                  </div>
                ) : (
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    opt.isCorrect ? 'border-green-500 bg-green-500' : 'border-gray-300'
                  }`}>
                    {opt.isCorrect && <div className="w-2 h-2 rounded-full bg-white" />}
                  </div>
                )}
                {opt.imageUrl && (
                  <img src={opt.imageUrl} alt="" className="h-8 w-8 object-cover rounded" />
                )}
                <span className={`flex-1 text-left ${opt.isCorrect ? 'font-semibold' : ''}`}>
                  {opt.text || `Option ${idx + 1}`}
                </span>
                {opt.isCorrect && <Check className="h-4 w-4 text-green-600" />}
              </button>
            ))}
          </div>
          <div className="mt-4 flex justify-end">
            <button
              onClick={() => setAnswerKeyOpenBlockId(null)}
              className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700"
            >
              Done
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="px-4 py-2">
        <div className="flex items-center justify-between mb-2">
          <OptionsPerRowPicker
            value={block.optionsPerRow || 1}
            onChange={(v) => setOptionsPerRow(block.id, v)}
          />
          <span className="text-[10px] text-emerald-600 font-semibold bg-emerald-50 px-2 py-0.5 rounded-full">
            {isMultiSelect ? 'Click checkbox to mark correct (multiple allowed)' : 'Click radio to mark correct answer'}
          </span>
        </div>

        <div className={`grid gap-2 ${
          block.optionsPerRow === 1 ? 'grid-cols-1' :
          block.optionsPerRow === 2 ? 'grid-cols-2' :
          block.optionsPerRow === 3 ? 'grid-cols-3' : 'grid-cols-4'
        }`}>
          {block.options.map((option, optionIndex) => (
            <div key={option.id} className="group relative">
              <div className={`flex flex-col rounded-xl border-2 transition-all overflow-hidden ${
                option.isCorrect
                  ? 'border-emerald-400 bg-emerald-50/60'
                  : 'border-gray-200 bg-white hover:border-indigo-200'
              }`}>
                {option.imageUrl && (
                  <div className="relative px-2 pt-2">
                    <div className="flex items-center gap-1 mb-1">
                      <span className="text-[9px] font-bold text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded-full">
                        {option.imageSizePercent || 60}% · {option.imageAlignment || 'center'}
                      </span>
                      <button
                        onClick={() => handleOptionImageClick(block.id, option.id)}
                        className="text-[9px] text-indigo-600 font-bold underline"
                      >
                        Edit
                      </button>
                    </div>
                    <div className="relative">
                      {activeImageToolbar?.type === 'option' &&
                        activeImageToolbar.blockId === block.id &&
                        activeImageToolbar.optionId === option.id && (
                          <ImageToolbar
                            alignment={option.imageAlignment || 'center'}
                            sizePercent={option.imageSizePercent || 60}
                            onAlignmentChange={(a) => updateOptionImageAlignment(block.id, option.id, a)}
                            onSizeChange={(v) => updateOptionImageSizePercent(block.id, option.id, v)}
                            onRemove={() => removeOptionImage(block.id, option.id)}
                            onClose={() => setActiveImageToolbar(null)}
                          />
                        )}
                      <div style={{
                        display: 'flex',
                        justifyContent: option.imageAlignment === 'left' ? 'flex-start'
                          : option.imageAlignment === 'right' ? 'flex-end' : 'center',
                      }}>
                        <div
                          style={{ width: `${option.imageSizePercent || 60}%` }}
                          className="cursor-pointer"
                          onClick={() => handleOptionImageClick(block.id, option.id)}
                        >
                          <img
                            src={option.imageUrl}
                            alt=""
                            className="w-full h-auto rounded-lg border-2 transition-all"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-2 px-2.5 py-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (isMultiSelect) {
                        toggleCorrectAnswer(block.id, option.id);
                      } else {
                        setCorrectAnswer(block.id, option.id);
                      }
                    }}
                    className="flex-shrink-0"
                  >
                    {isDropdown ? (
                      <span className="text-xs text-gray-500 font-bold w-4 text-center">
                        {optionIndex + 1}.
                      </span>
                    ) : isMultiSelect ? (
                      <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all ${
                        option.isCorrect ? 'border-emerald-500 bg-emerald-500' : 'border-gray-300'
                      }`}>
                        {option.isCorrect && (
                          <svg className="h-2.5 w-2.5 text-white" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </div>
                    ) : (
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all ${
                        option.isCorrect ? 'border-emerald-500 bg-emerald-500' : 'border-gray-300'
                      }`}>
                        {option.isCorrect && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </div>
                    )}
                  </button>

                  <OptionInput
                    value={option.text}
                    onChange={(v) => updateOptionText(block.id, option.id, v)}
                    placeholder="Click to edit option"
                    isCorrect={option.isCorrect}
                    type={block.type}
                  />

                  {!option.imageUrl && !isDropdown && (
                    <label className="opacity-0 group-hover:opacity-100 cursor-pointer flex items-center gap-1 px-1.5 py-0.5 bg-indigo-50 hover:bg-indigo-100 rounded-full transition-all">
                      <Image className="h-3 w-3 text-indigo-500" />
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) handleOptionImageUpload(block.id, option.id, f);
                        }}
                      />
                    </label>
                  )}
                  {block.options.length > 2 && !option.id.includes('other-') && (
                    <button
                      onClick={() => removeOption(block.id, option.id)}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-50 rounded-lg transition-all"
                    >
                      <Trash2 className="h-3 w-3 text-red-500" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2 mt-2">
          <button
            onClick={() => addOption(block.id)}
            className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold"
          >
            + Add option
          </button>
          {!block.hasOtherOption && !isDropdown && (
            <>
              <span className="text-gray-300 text-xs">or</span>
              <button
                onClick={() => addOtherOption(block.id)}
                className="text-xs text-indigo-500 hover:text-indigo-700"
              >
                add "Other"
              </button>
            </>
          )}
        </div>

        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setAnswerKeyOpenBlockId(block.id)}
            className="inline-flex items-center gap-2 text-sm font-semibold text-blue-600 hover:text-blue-700"
          >
            <div className="w-4 h-4 border-2 border-blue-600 rounded flex items-center justify-center">
              <Check className="h-3 w-3" />
            </div>
            Answer key
          </button>
          {correctCount > 0 && (
            <span className="text-xs text-gray-500">
              ({correctCount} {correctCount === 1 ? 'answer' : 'answers'} selected)
            </span>
          )}
        </div>

        {errors.blocks?.[block.id]?.options && (
          <div className="text-red-600 text-xs mt-1.5 flex items-center gap-1 bg-red-50 px-2 py-1 rounded-lg">
            <AlertCircle className="h-3 w-3" />
            {errors.blocks[block.id].options}
          </div>
        )}
        {errors.blocks?.[block.id]?.correctAnswer && (
          <div className="text-amber-700 text-xs mt-1 flex items-center gap-1 bg-amber-50 px-2 py-1 rounded-lg">
            <AlertCircle className="h-3 w-3" />
            {errors.blocks[block.id].correctAnswer}
          </div>
        )}
      </div>
    );
  };

  // Render True/False interface
  const renderTrueFalseInterface = (block: QuestionBlock) => {
    const isAnswerKeyMode = answerKeyOpenBlockId === block.id;
    
    if (isAnswerKeyMode) {
      return (
        <div className="px-5 py-4">
          <p className="text-sm text-gray-600 mb-3">
            Select the correct answer below, then click <strong className="text-green-600">Done</strong>.
          </p>
          <div className="space-y-2">
            {[true, false].map(val => (
              <button
                key={String(val)}
                type="button"
                onClick={() => {
                  updateBlock(block.id, { trueFalseAnswer: val });
                  clearBlockError(block.id, 'trueFalse');
                }}
                className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${
                  block.trueFalseAnswer === val
                    ? 'border-green-400 bg-green-50'
                    : 'border-gray-200 bg-white hover:border-indigo-300'
                }`}
              >
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                  block.trueFalseAnswer === val ? 'border-green-500 bg-green-500' : 'border-gray-300'
                }`}>
                  {block.trueFalseAnswer === val && <div className="w-2 h-2 rounded-full bg-white" />}
                </div>
                <span className="flex-1 text-left font-semibold">{val ? 'True' : 'False'}</span>
                {block.trueFalseAnswer === val && <Check className="h-4 w-4 text-green-600" />}
              </button>
            ))}
          </div>
          <div className="mt-4 flex justify-end">
            <button
              onClick={() => setAnswerKeyOpenBlockId(null)}
              className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700"
            >
              Done
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="px-5 py-4">
        <div className="flex gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name={`tf-${block.id}`}
              checked={block.trueFalseAnswer === true}
              onChange={() => {
                updateBlock(block.id, { trueFalseAnswer: true });
                clearBlockError(block.id, 'trueFalse');
              }}
              className="w-4 h-4 accent-green-600"
            />
            <span className="text-sm font-medium">True</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name={`tf-${block.id}`}
              checked={block.trueFalseAnswer === false}
              onChange={() => {
                updateBlock(block.id, { trueFalseAnswer: false });
                clearBlockError(block.id, 'trueFalse');
              }}
              className="w-4 h-4 accent-green-600"
            />
            <span className="text-sm font-medium">False</span>
          </label>
        </div>
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setAnswerKeyOpenBlockId(block.id)}
            className="inline-flex items-center gap-2 text-sm font-semibold text-blue-600 hover:text-blue-700"
          >
            <div className="w-4 h-4 border-2 border-blue-600 rounded flex items-center justify-center">
              <Check className="h-3 w-3" />
            </div>
            Answer key
          </button>
          {block.trueFalseAnswer !== null && (
            <span className="ml-2 text-xs text-gray-500">
              ({block.trueFalseAnswer ? 'True' : 'False'} selected)
            </span>
          )}
        </div>
        {errors.blocks?.[block.id]?.trueFalse && (
          <div className="mt-2 text-red-600 text-xs flex items-center gap-1">
            <AlertCircle className="h-3 w-3" />
            {errors.blocks[block.id].trueFalse}
          </div>
        )}
      </div>
    );
  };

  // Render Short Answer interface
  const renderShortAnswerInterface = (block: QuestionBlock) => (
    <div className="px-5 py-4">
      <div className="mb-4">
        <label className="block text-xs font-semibold text-gray-500 mb-1">Expected Answer (Optional)</label>
        <input
          type="text"
          value={block.shortAnswer || ''}
          onChange={(e) => updateBlock(block.id, { shortAnswer: e.target.value })}
          placeholder="Enter the expected answer..."
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
        />
        <p className="text-xs text-gray-400 mt-1">Leave blank for open-ended answers</p>
      </div>
    </div>
  );

  // Render Paragraph interface
  const renderParagraphInterface = () => (
    <div className="px-5 py-4">
      <div className="bg-gray-50 rounded-lg p-4 text-center">
        <p className="text-sm text-gray-500">Long-form answer text area will appear here</p>
        <p className="text-xs text-gray-400 mt-1">No correct answer needed for essay questions</p>
      </div>
    </div>
  );

  // Render Matching interface
  const renderMatchingInterface = (block: QuestionBlock) => (
    <div className="px-5 py-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-gray-500">Matching Pairs</p>
        <button
          onClick={() => addMatchingPair(block.id)}
          className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold"
        >
          + Add Pair
        </button>
      </div>
      <div className="space-y-2">
        {(block.matchingPairs || []).map((pair, idx) => (
          <MatchingPairComponent
            key={pair.id}
            pair={pair}
            index={idx}
            onUpdate={(side, value) => updateMatchingPair(block.id, pair.id, side, value)}
            onRemove={() => removeMatchingPair(block.id, pair.id)}
            canRemove={(block.matchingPairs?.length || 0) > 2}
          />
        ))}
      </div>
      {errors.blocks?.[block.id]?.matching && (
        <div className="mt-2 text-red-600 text-xs flex items-center gap-1">
          <AlertCircle className="h-3 w-3" />
          {errors.blocks[block.id].matching}
        </div>
      )}
    </div>
  );

  // Render Ordering interface
  const renderOrderingInterface = (block: QuestionBlock) => (
    <div className="px-5 py-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-gray-500">Correct Order (Drag arrows to reorder)</p>
        <button
          onClick={() => addOrderingItem(block.id)}
          className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold"
        >
          + Add Item
        </button>
      </div>
      <div className="space-y-2">
        {(block.orderingItems || [])
          .sort((a, b) => a.order - b.order)
          .map((item, idx) => (
            <OrderingItemComponent
              key={item.id}
              item={item}
              index={idx}
              totalItems={block.orderingItems?.length || 0}
              onUpdate={(value) => updateOrderingItem(block.id, item.id, value)}
              onMoveUp={() => moveOrderingItem(block.id, item.id, 'up')}
              onMoveDown={() => moveOrderingItem(block.id, item.id, 'down')}
              onRemove={() => removeOrderingItem(block.id, item.id)}
              canRemove={(block.orderingItems?.length || 0) > 2}
            />
          ))}
      </div>
      {errors.blocks?.[block.id]?.ordering && (
        <div className="mt-2 text-red-600 text-xs flex items-center gap-1">
          <AlertCircle className="h-3 w-3" />
          {errors.blocks[block.id].ordering}
        </div>
      )}
    </div>
  );

  // Render Numeric interface
  const renderNumericInterface = (block: QuestionBlock) => (
    <div className="px-5 py-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1">Correct Answer *</label>
          <input
            type="number"
            step="any"
            value={block.numericAnswer ?? ''}
            onChange={(e) => {
              updateBlock(block.id, { numericAnswer: e.target.value === '' ? null : parseFloat(e.target.value) });
              if (e.target.value !== '') clearBlockError(block.id, 'numeric');
            }}
            placeholder="Enter number..."
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1">Tolerance (±)</label>
          <input
            type="number"
            step="any"
            value={block.numericTolerance ?? ''}
            onChange={(e) => updateBlock(block.id, { numericTolerance: e.target.value === '' ? null : parseFloat(e.target.value) })}
            placeholder="Optional"
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>
      </div>
      {block.numericAnswer !== null && block.numericTolerance !== null && block.numericTolerance > 0 && (
        <div className="mt-3 p-2 bg-blue-50 rounded-lg">
          <p className="text-xs text-blue-700">
            Accepted range: {(block.numericAnswer - block.numericTolerance).toFixed(2)} to {(block.numericAnswer + block.numericTolerance).toFixed(2)}
          </p>
        </div>
      )}
      {errors.blocks?.[block.id]?.numeric && (
        <div className="mt-2 text-red-600 text-xs flex items-center gap-1">
          <AlertCircle className="h-3 w-3" />
          {errors.blocks[block.id].numeric}
        </div>
      )}
    </div>
  );

  // Explanation Image Toolbar Component
  const ExplanationImageToolbar: React.FC<{
    alignment: 'left' | 'center' | 'right';
    sizePercent: number;
    onAlignmentChange: (a: 'left' | 'center' | 'right') => void;
    onSizeChange: (v: number) => void;
    onRemove: () => void;
    onClose: () => void;
  }> = ({ alignment, sizePercent, onAlignmentChange, onSizeChange, onRemove, onClose }) => {
    return (
      <div className="absolute top-2 left-1/2 -translate-x-1/2 z-50 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl dark:shadow-gray-900/50 border border-indigo-100 dark:border-indigo-900/50 overflow-visible select-none min-w-[280px]">
        <div className="flex items-stretch divide-x divide-gray-100 dark:divide-gray-700">
          <div className="flex flex-col items-center justify-center px-3 py-2 gap-1">
            <span className="text-[9px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Align</span>
            <div className="flex items-center gap-0.5">
              {(['left', 'center', 'right'] as const).map((a) => (
                <button
                  key={a}
                  onClick={() => onAlignmentChange(a)}
                  className={`w-6 h-6 rounded-lg text-[10px] font-bold transition-all ${
                    alignment === a
                      ? 'bg-indigo-600 text-white shadow-md dark:bg-indigo-500'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 hover:text-indigo-600 dark:hover:text-indigo-400'
                  }`}
                >
                  {a === 'left' ? 'L' : a === 'center' ? 'C' : 'R'}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col justify-center px-3 py-2 gap-1 flex-1">
            <span className="text-[9px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Size</span>
            <div className="flex items-center gap-1.5">
              <ZoomOut className="h-3 w-3 text-gray-400 dark:text-gray-500" />
              <input
                type="range"
                min={10}
                max={100}
                step={5}
                value={sizePercent}
                onChange={(e) => onSizeChange(parseInt(e.target.value))}
                className="flex-1 h-1.5 accent-indigo-600 dark:accent-indigo-500 cursor-pointer"
              />
              <ZoomIn className="h-3 w-3 text-gray-400 dark:text-gray-500" />
              <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 w-8 text-right">{sizePercent}%</span>
            </div>
          </div>

          <div className="flex items-center gap-0.5 px-2 py-2">
            <button
              onClick={onRemove}
              className="flex flex-col items-center gap-0.5 p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-red-500 dark:text-red-400 transition-all"
              title="Remove image"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span className="text-[9px] font-semibold">Remove</span>
            </button>
            <button
              onClick={onClose}
              className="flex flex-col items-center gap-0.5 p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-gray-400 dark:text-gray-500 transition-all"
              title="Close"
            >
              <X className="h-3.5 w-3.5" />
              <span className="text-[9px] font-semibold">Close</span>
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderQuestionContent = (block: QuestionBlock) => {
    switch (block.type) {
      case 'short-answer':
        return renderShortAnswerInterface(block);
      case 'paragraph':
        return renderParagraphInterface();
      case 'multiple-choice':
      case 'multiple-select':
      case 'dropdown':
        return renderOptions(block);
      case 'true-false':
        return renderTrueFalseInterface(block);
      case 'matching':
        return renderMatchingInterface(block);
      case 'ordering':
        return renderOrderingInterface(block);
      case 'numeric':
        return renderNumericInterface(block);
      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(15,23,42,0.75)' }}>
      <div className="bg-white dark:bg-gray-900 w-screen h-screen flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-gray-200 dark:border-gray-800 flex-shrink-0 bg-gradient-to-r from-indigo-600 to-indigo-500 dark:from-indigo-700 dark:to-indigo-600">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
              <List className="h-4 w-4 text-white" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">
                {isEditing ? 'Edit MCQ Questions' : 'Add MCQ Questions'}
              </h2>
              <p className="text-[10px] text-white/70">Multiple choice, True/False, Matching, Ordering & more</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-xl transition-colors">
            <X className="h-4 w-4 text-white" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-gray-950 px-4 py-4">
          {questionBlocks.length === 0 ? (
            <div className="flex items-center justify-center min-h-full">
              <div className="bg-white dark:bg-gray-800 rounded-2xl p-10 max-w-sm w-full border border-gray-200 dark:border-gray-700 shadow-sm text-center">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 bg-indigo-50 dark:bg-indigo-900/30">
                  <List className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
                </div>
                <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 mb-1">No questions yet</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-5">Add a question to get started</p>
                <button
                  onClick={addQuestionBlock}
                  className="px-4 py-2 bg-indigo-600 dark:bg-indigo-500 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 dark:hover:bg-indigo-600 flex items-center gap-1 mx-auto"
                >
                  <Plus className="h-3.5 w-3.5" /> Add question
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="space-y-4 max-w-4xl mx-auto">
                {questionBlocks.map((block, blockIndex) => {
                  const hasError = !!errors.blocks?.[block.id];
                  return (
                    <div
                      key={block.id}
                      className={`bg-white dark:bg-gray-800 rounded-2xl border-2 transition-all overflow-visible shadow-sm ${
                        hasError ? 'border-red-300 dark:border-red-700' : 'border-gray-200 dark:border-gray-700 hover:border-indigo-200 dark:hover:border-indigo-700'
                      }`}
                    >
                      {/* Common Fields Section */}
                      <div className="px-4 pt-4 pb-2 border-b border-gray-100 dark:border-gray-700">
                        <CommonFields
                          data={{
                            questionCategory: block.questionCategory,
                            isActive: block.isActive,
                          }}
                          onChange={(field, value) => {
                            if (field === 'questionCategory') {
                              handleCategoryChange(block.id, value);
                            } else if (field === 'isActive') {
                              handleActiveChange(block.id, value);
                            }
                          }}
                          categories={categories}
                        />
                        {errors.blocks?.[block.id]?.questionCategory && (
                          <div className="mt-2 text-red-600 dark:text-red-400 text-xs flex items-center gap-1">
                            <AlertCircle className="h-3 w-3" />
                            {errors.blocks[block.id].questionCategory}
                          </div>
                        )}
                      </div>

                      {/* Question Content */}
                      <div className="px-4 pt-3 pb-2">
                        <div className="flex items-start gap-3">
                          <div className="flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold text-white bg-gradient-to-r from-indigo-600 to-indigo-500 dark:from-indigo-700 dark:to-indigo-600 mt-0.5">
                            {blockIndex + 1}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                              {block.isRequired && (
                                <span className="text-[10px] font-bold bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 px-2 py-0.5 rounded-full">
                                  Required
                                </span>
                              )}
                              {!block.questionImageUrl && (
                                <label className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 hover:bg-indigo-100 dark:hover:bg-indigo-800/40 px-2 py-0.5 rounded-full cursor-pointer transition-colors">
                                  <Image className="h-2.5 w-2.5" /> Add image
                                  <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={(e) => {
                                      const f = e.target.files?.[0];
                                      if (f) handleQuestionImageUpload(block.id, f);
                                    }}
                                  />
                                </label>
                              )}
                            </div>

                            <RichTextEditor
                              value={block.questionText}
                              onChange={(v) => handleQuestionChange(block.id, v)}
                              placeholder="Write your question here... (Use formatting tools above)"
                              className="mb-1"
                            />
                          </div>

                          <div className="relative flex-shrink-0">
                            <button
                              onClick={() => setShowQuestionTypeMenu(showQuestionTypeMenu === block.id ? null : block.id)}
                              className="flex items-center gap-1.5 px-3 py-2 bg-slate-50 dark:bg-gray-700 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 border-2 border-gray-200 dark:border-gray-600 hover:border-indigo-300 dark:hover:border-indigo-600 rounded-xl text-xs font-semibold text-gray-700 dark:text-gray-300 transition-all"
                            >
                              <span className="text-indigo-600 dark:text-indigo-400">{getTypeIcon(block.type)}</span>
                              <span className="max-w-[90px] truncate">{getTypeLabel(block.type)}</span>
                              <ChevronDown className="h-3 w-3 text-gray-400 dark:text-gray-500" />
                            </button>
                            {showQuestionTypeMenu === block.id && (
                              <div className="absolute top-full right-0 mt-1 w-52 bg-white dark:bg-gray-800 rounded-xl shadow-2xl dark:shadow-gray-900/50 border border-gray-200 dark:border-gray-700 py-1.5 z-50 max-h-72 overflow-y-auto">
                                {['Choice', 'Text', 'Complex'].map(group => {
                                  const items = questionTypes.filter(qt => qt.group === group);
                                  if (items.length === 0) return null;
                                  return (
                                    <div key={group}>
                                      <div className="px-3 py-1 text-[9px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
                                        {group}
                                      </div>
                                      {items.map((qt) => (
                                        <button
                                          key={qt.type}
                                          onClick={() => {
                                            setQuestionBlocks(bs => bs.map(b =>
                                              b.id === block.id ? {
                                                ...b,
                                                type: qt.type,
                                                hasOtherOption: qt.type === 'dropdown' ? false : b.hasOtherOption
                                              } : b
                                            ));
                                            setShowQuestionTypeMenu(null);
                                          }}
                                          className={`w-full px-3 py-1.5 flex items-center gap-2 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors text-xs ${
                                            block.type === qt.type ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 font-semibold' : 'text-gray-700 dark:text-gray-300'
                                          }`}
                                        >
                                          <span className={block.type === qt.type ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400 dark:text-gray-500'}>
                                            {qt.icon}
                                          </span>
                                          {qt.label}
                                          {block.type === qt.type && (
                                            <span className="ml-auto text-indigo-500 dark:text-indigo-400 text-[10px] font-bold">✓</span>
                                          )}
                                        </button>
                                      ))}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </div>

                        {block.questionImageUrl && (
                          <QuestionImageSection
                            imageUrl={block.questionImageUrl}
                            imageAlignment={block.questionImageAlignment || 'center'}
                            imageSizePercent={block.questionImageSizePercent || 60}
                            isToolbarActive={activeImageToolbar?.type === 'question' && activeImageToolbar.blockId === block.id}
                            onImageClick={() => handleQuestionImageClick(block.id)}
                            onAlignmentChange={(a) => updateQuestionImageAlignment(block.id, a)}
                            onSizeChange={(v) => updateQuestionImageSizePercent(block.id, v)}
                            onRemove={() => removeQuestionImage(block.id)}
                            onCloseToolbar={() => setActiveImageToolbar(null)}
                          />
                        )}

                        <div className="mt-2">
                          <label className="flex items-center gap-1.5 cursor-pointer group/exp">
                            <input
                              type="checkbox"
                              checked={block.hasExplanation}
                              onChange={() => toggleExplanation(block.id)}
                              className="w-3.5 h-3.5 rounded border-gray-300 dark:border-gray-600 text-indigo-600 dark:text-indigo-400 bg-white dark:bg-gray-700"
                            />
                            <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 group-hover/exp:text-indigo-600 dark:group-hover/exp:text-indigo-400 flex items-center gap-1">
                              <HelpCircle className="h-3 w-3" /> Add explanation
                            </span>
                          </label>
                          
                          {block.hasExplanation && (
                            <div className="mt-1.5 ml-5 pl-3 border-l-2 border-indigo-200 dark:border-indigo-800">
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">Explanation</span>
                                  {!block.explanationImage?.url && (
                                    <label className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 hover:bg-indigo-100 dark:hover:bg-indigo-800/40 px-2 py-0.5 rounded-full cursor-pointer transition-colors">
                                      <Image className="h-2.5 w-2.5" /> Add image
                                      <input
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={(e) => {
                                          const f = e.target.files?.[0];
                                          if (f) handleExplanationImageUpload(block.id, f);
                                        }}
                                      />
                                    </label>
                                  )}
                                </div>
                              </div>
                              
                              {/* Explanation Image Section */}
                              {block.explanationImage?.url && (
                                <div className="mb-3 relative">
                                  <div className="flex items-center gap-1 mb-1">
                                    <span className="text-[9px] font-bold text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded-full">
                                      Explanation Image · {block.explanationImage.sizePercent}% · {block.explanationImage.alignment}
                                    </span>
                                    <button
                                      onClick={() => setActiveImageToolbar({ type: 'explanation', blockId: block.id })}
                                      className="text-[9px] text-indigo-600 font-bold underline"
                                    >
                                      Edit
                                    </button>
                                  </div>
                                  <div className="relative">
                                    {activeImageToolbar?.type === 'explanation' && activeImageToolbar.blockId === block.id && (
                                      <ExplanationImageToolbar
                                        alignment={block.explanationImage.alignment || 'center'}
                                        sizePercent={block.explanationImage.sizePercent || 60}
                                        onAlignmentChange={(a) => updateExplanationImageAlignment(block.id, a)}
                                        onSizeChange={(v) => updateExplanationImageSizePercent(block.id, v)}
                                        onRemove={() => removeExplanationImage(block.id)}
                                        onClose={() => setActiveImageToolbar(null)}
                                      />
                                    )}
                                    <div style={{
                                      display: 'flex',
                                      justifyContent: block.explanationImage.alignment === 'left' ? 'flex-start'
                                        : block.explanationImage.alignment === 'right' ? 'flex-end' : 'center',
                                    }}>
                                      <div
                                        style={{ width: `${block.explanationImage.sizePercent || 60}%` }}
                                        className="cursor-pointer"
                                        onClick={() => setActiveImageToolbar({ type: 'explanation', blockId: block.id })}
                                      >
                                        <img
                                          src={block.explanationImage.url}
                                          alt="Explanation"
                                          className="w-full h-auto rounded-xl border-2 transition-all border-transparent hover:border-indigo-300 dark:hover:border-indigo-600"
                                        />
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              )}
                              
                              <RichTextEditor
                                value={block.explanation || ''}
                                onChange={(v) => handleExplanationChange(block.id, v)}
                                placeholder="Explain the correct answer... (Optional)"
                              />
                            </div>
                          )}
                        </div>

                        {hasError && errors.blocks?.[block.id]?.questionText && (
                          <div className="mt-2 text-red-600 dark:text-red-400 text-xs flex items-center gap-1.5 bg-red-50 dark:bg-red-900/20 px-3 py-1.5 rounded-xl">
                            <AlertCircle className="h-3.5 w-3.5" />
                            {errors.blocks[block.id].questionText}
                          </div>
                        )}
                      </div>

                      {/* Question Options/Answer Area */}
                      {renderQuestionContent(block)}

                      {/* Footer Actions */}
                      <div className="px-4 py-2 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between bg-slate-50 dark:bg-gray-800/50 rounded-b-2xl">
                        <div className="flex items-center gap-0.5">
                          <button
                            onClick={() => duplicateQuestionBlock(block.id)}
                            title="Duplicate"
                            className="p-1.5 hover:bg-white dark:hover:bg-gray-700 hover:shadow-sm rounded-lg transition-all text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400"
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => removeQuestionBlock(block.id)}
                            title="Delete"
                            className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                          <span className="text-gray-200 dark:text-gray-700 mx-1">|</span>
                          <button
                            onClick={() => moveBlock(block.id, 'up')}
                            disabled={blockIndex === 0}
                            title="Move up"
                            className="p-1.5 hover:bg-white dark:hover:bg-gray-700 hover:shadow-sm rounded-lg transition-all text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 disabled:opacity-25 disabled:cursor-not-allowed"
                          >
                            <ChevronUp className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => moveBlock(block.id, 'down')}
                            disabled={blockIndex === questionBlocks.length - 1}
                            title="Move down"
                            className="p-1.5 hover:bg-white dark:hover:bg-gray-700 hover:shadow-sm rounded-lg transition-all text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 disabled:opacity-25 disabled:cursor-not-allowed"
                          >
                            <ChevronDown className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        <label className="flex items-center gap-2 cursor-pointer">
                          <span className="text-xs font-semibold text-gray-600 dark:text-gray-400">Required</span>
                          <div className="relative">
                            <input
                              type="checkbox"
                              checked={block.isRequired}
                              onChange={() => toggleRequired(block.id)}
                              className="sr-only peer"
                            />
                            <div className="w-9 h-5 bg-gray-300 dark:bg-gray-600 peer-checked:bg-indigo-600 dark:peer-checked:bg-indigo-500 rounded-full transition-colors after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white dark:after:bg-gray-200 after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-4 after:border after:border-gray-200 dark:after:border-gray-700" />
                          </div>
                        </label>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="max-w-4xl mx-auto mt-4">
                <button
                  onClick={addQuestionBlock}
                  className="w-full border-2 border-dashed border-indigo-200 dark:border-indigo-800 hover:border-indigo-400 dark:hover:border-indigo-600 hover:bg-indigo-50/50 dark:hover:bg-indigo-900/20 p-3.5 rounded-2xl flex items-center justify-center gap-2 text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 text-xs font-bold transition-all"
                >
                  <Plus className="h-4 w-4" /> Add another question
                </button>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-6 py-3 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex-shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-5 py-2 border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-gray-300 dark:hover:border-gray-600 rounded-xl text-xs font-bold transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSaving || questionBlocks.length === 0}
              className="px-6 py-2 text-white rounded-xl text-xs font-bold disabled:opacity-50 flex items-center gap-1.5 transition-all bg-gradient-to-r from-emerald-600 to-emerald-500 dark:from-emerald-700 dark:to-emerald-600 hover:opacity-90"
            >
              {isSaving ? (
                <><Loader className="h-3.5 w-3.5 animate-spin" /> Saving...</>
              ) : (
                <>{isEditing ? '✓ Update' : '✓ Save'} Questions</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MCQFields;