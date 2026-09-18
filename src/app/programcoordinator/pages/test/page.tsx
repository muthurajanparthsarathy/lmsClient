  "use client";

  import React, { useState } from 'react';
  import { 
    Settings, 
    Plus, 
    Trash2, 
    Edit3, 
    Save, 
    X, 
    Clock,
    Code,
    FileText,
    CheckCircle,
    User,
    Cpu,
    Play,
    BookOpen,
    Target,
    ChevronDown,
    ChevronRight,
    Copy,
    Database,
    Layout,
    Type,
    Zap,
    Upload,
    Camera,
    Monitor,
    Minimize2,
    Maximize2,
    Shield,
    Brain,
    Sparkles,
    Filter,
    Bookmark,
    Download,
    Eye,
    EyeOff
  } from 'lucide-react';

  // ==============================
  // Type Definitions
  // ==============================

  type LearningElementType = 'practice' | 'self-practice' | 'self-assessment' | 'custom';

  type EvaluationType = 'teacher' | 'testcase' | 'ai' | 'self';
  type ProblemType = 'quiz' | 'programming' | 'frontend' | 'sql' | 'text' | 'file-upload';
  type CompilerLanguage = 'javascript' | 'python' | 'java' | 'cpp' | 'sql' | 'none';
  type AIGenerationLevel = 'none' | 'basic' | 'intermediate' | 'advanced' | 'adaptive';

  interface SecuritySettings {
    enabled: boolean;
    screenCapture: boolean;
    allowTabSwitch: boolean;
    allowAppMinimize: boolean;
    fullScreenRequired: boolean;
    disableCopyPaste: boolean;
    disableRightClick: boolean;
    disablePrintScreen: boolean;
    watermarkEnabled: boolean;
    watermarkText: string;
    blockVirtualMachines: boolean;
    requireWebcam: boolean;
    identityVerification: boolean;
    lockdownBrowser: boolean;
  }

  interface AIGenerationSettings {
    enabled: boolean;
    generationLevel: AIGenerationLevel;
    autoGenerateQuestions: boolean;
    difficultyAdaptation: boolean;
    personalization: boolean;
    topics: string[];
    questionCount: number;
    includeExplanation: boolean;
    includeHints: boolean;
    language: string;
    tone: 'formal' | 'friendly' | 'technical';
    qualityCheck: boolean;
    plagiarismCheck: boolean;
  }

  interface CompilerSettings {
    enabled: boolean;
    language: CompilerLanguage;
    version: string;
    timeLimit: number;
    memoryLimit: number;
    allowCopyPaste: boolean;
    allowImports: boolean;
    allowedImports: string[];
    autoComplete: boolean;
    syntaxHighlighting: boolean;
    runCode: boolean;
    debugMode: boolean;
  }

  interface ProblemSettings {
    problemTypes: ProblemType[];
    totalQuestions: number;
    pointsPerQuestion: number;
    shuffleQuestions: boolean;
    showSolution: boolean;
    attemptsAllowed: number;
    randomizeOptions: boolean;
    showExplanation: boolean;
    allowSkip: boolean;
    negativeMarking: boolean;
    negativeMarkingPercentage: number;
    questionBankSize: number;
    adaptiveTesting: boolean;
    questionTags: string[];
  }

  interface TimeSettings {
    enabled: boolean;
    timeLimit: number;
    allowPause: boolean;
    autoSubmit: boolean;
    showTimer: boolean;
    warningBeforeTimeUp: number;
    gracePeriod: number;
    timePerQuestion: boolean;
    strictTiming: boolean;
  }

  interface EvaluationSettings {
    enabled: boolean;
    evaluationTypes: EvaluationType[];
    teacherWeight: number;
    testcaseWeight: number;
    aiWeight: number;
    selfWeight: number;
    passingScore: number;
    requireCodeSubmission: boolean;
    instantFeedback: boolean;
    showDetailedResults: boolean;
    allowRetake: boolean;
    maxRetakes: number;
    peerReview: boolean;
    rubricBased: boolean;
    analyticsEnabled: boolean;
  }

  interface AccessibilitySettings {
    enabled: boolean;
    highContrast: boolean;
    largeText: boolean;
    screenReader: boolean;
    keyboardNavigation: boolean;
    extraTime: boolean;
    extraTimePercentage: number;
    colorBlindMode: boolean;
    dyslexiaFriendly: boolean;
    textToSpeech: boolean;
    speechToText: boolean;
  }

  interface LearningElementSettings {
    id: string;
    name: string;
    type: LearningElementType;
    description: string;
    icon: React.ComponentType<any>;
    color: string;
    security: SecuritySettings;
    aiGeneration: AIGenerationSettings;
    compiler: CompilerSettings;
    problems: ProblemSettings;
    time: TimeSettings;
    evaluation: EvaluationSettings;
    accessibility: AccessibilitySettings;
    isCustom?: boolean;
    customType?: string;
  }

  interface LearningElementsSettingsProps {
    elements?: LearningElementSettings[];
    onElementsChange?: (elements: LearningElementSettings[]) => void;
    onSettingsSave?: (elementId: string, settings: Partial<LearningElementSettings>) => void;
  }

  // ==============================
  // Default Settings
  // ==============================

  const defaultSecuritySettings: SecuritySettings = {
    enabled: false,
    screenCapture: false,
    allowTabSwitch: true,
    allowAppMinimize: true,
    fullScreenRequired: false,
    disableCopyPaste: false,
    disableRightClick: false,
    disablePrintScreen: false,
    watermarkEnabled: false,
    watermarkText: 'Confidential - Learning Assessment',
    blockVirtualMachines: false,
    requireWebcam: false,
    identityVerification: false,
    lockdownBrowser: false
  };

  const defaultAIGenerationSettings: AIGenerationSettings = {
    enabled: false,
    generationLevel: 'none',
    autoGenerateQuestions: false,
    difficultyAdaptation: false,
    personalization: false,
    topics: [],
    questionCount: 10,
    includeExplanation: true,
    includeHints: false,
    language: 'english',
    tone: 'formal',
    qualityCheck: true,
    plagiarismCheck: true
  };

  const defaultCompilerSettings: CompilerSettings = {
    enabled: false,
    language: 'javascript',
    version: 'ES6',
    timeLimit: 10,
    memoryLimit: 256,
    allowCopyPaste: true,
    allowImports: true,
    allowedImports: [],
    autoComplete: true,
    syntaxHighlighting: true,
    runCode: true,
    debugMode: false
  };

  const defaultProblemSettings: ProblemSettings = {
    problemTypes: ['quiz'],
    totalQuestions: 10,
    pointsPerQuestion: 10,
    shuffleQuestions: true,
    showSolution: true,
    attemptsAllowed: 3,
    randomizeOptions: true,
    showExplanation: true,
    allowSkip: false,
    negativeMarking: false,
    negativeMarkingPercentage: 25,
    questionBankSize: 50,
    adaptiveTesting: false,
    questionTags: []
  };

  const defaultTimeSettings: TimeSettings = {
    enabled: false,
    timeLimit: 60,
    allowPause: false,
    autoSubmit: true,
    showTimer: true,
    warningBeforeTimeUp: 5,
    gracePeriod: 2,
    timePerQuestion: false,
    strictTiming: false
  };

  const defaultEvaluationSettings: EvaluationSettings = {
    enabled: false,
    evaluationTypes: ['teacher'],
    teacherWeight: 100,
    testcaseWeight: 0,
    aiWeight: 0,
    selfWeight: 0,
    passingScore: 70,
    requireCodeSubmission: false,
    instantFeedback: true,
    showDetailedResults: true,
    allowRetake: false,
    maxRetakes: 3,
    peerReview: false,
    rubricBased: false,
    analyticsEnabled: true
  };

  const defaultAccessibilitySettings: AccessibilitySettings = {
    enabled: false,
    highContrast: false,
    largeText: false,
    screenReader: false,
    keyboardNavigation: true,
    extraTime: false,
    extraTimePercentage: 25,
    colorBlindMode: false,
    dyslexiaFriendly: false,
    textToSpeech: false,
    speechToText: false
  };

  // ==============================
  // Default Learning Elements
  // ==============================

  const defaultLearningElements: LearningElementSettings[] = [
    {
      id: 'practice',
      name: 'Practice',
      type: 'practice',
      description: 'Teacher provides questions for students to practice',
      icon: Play,
      color: '#FB923C',
      security: { ...defaultSecuritySettings },
      aiGeneration: { ...defaultAIGenerationSettings },
      compiler: { ...defaultCompilerSettings, enabled: false },
      problems: { 
        ...defaultProblemSettings, 
        problemTypes: ['quiz'],
        attemptsAllowed: 0,
        showSolution: false 
      },
      time: { ...defaultTimeSettings, enabled: false },
      evaluation: { ...defaultEvaluationSettings, enabled: false },
      accessibility: { ...defaultAccessibilitySettings }
    },
    {
      id: 'self-practice',
      name: 'Self Practice',
      type: 'self-practice',
      description: 'Teacher solves some questions, others are assigned as homework',
      icon: BookOpen,
      color: '#10B981',
      security: { ...defaultSecuritySettings },
      aiGeneration: { ...defaultAIGenerationSettings, enabled: true, generationLevel: 'basic' },
      compiler: { ...defaultCompilerSettings, enabled: true },
      problems: { 
        ...defaultProblemSettings, 
        problemTypes: ['quiz', 'programming'],
        attemptsAllowed: 1 
      },
      time: { ...defaultTimeSettings, enabled: false },
      evaluation: { ...defaultEvaluationSettings, enabled: false },
      accessibility: { ...defaultAccessibilitySettings }
    },
    {
      id: 'self-assessment',
      name: 'Self Assessment',
      type: 'self-assessment',
      description: 'Test-based evaluation with multiple evaluation types',
      icon: Target,
      color: '#8B5CF6',
      security: { ...defaultSecuritySettings, enabled: true, screenCapture: true, allowTabSwitch: false },
      aiGeneration: { ...defaultAIGenerationSettings, enabled: true, generationLevel: 'intermediate' },
      compiler: { ...defaultCompilerSettings, enabled: true },
      problems: defaultProblemSettings,
      time: { ...defaultTimeSettings, enabled: true },
      evaluation: { ...defaultEvaluationSettings, enabled: true },
      accessibility: { ...defaultAccessibilitySettings, enabled: true }
    }
  ];

  // ==============================
  // Settings UI Components
  // ==============================

  interface SettingsSectionProps {
    title: string;
    icon: React.ComponentType<any>;
    children: React.ReactNode;
    isExpanded?: boolean;
    onToggle?: () => void;
    enabled?: boolean;
    onEnabledChange?: (enabled: boolean) => void;
  }

  const SettingsSection: React.FC<SettingsSectionProps> = ({ 
    title, 
    icon: Icon, 
    children, 
    isExpanded = false, 
    onToggle,
    enabled = true,
    onEnabledChange
  }) => {
    return (
      <div className="border border-gray-200 rounded-lg overflow-hidden dark:border-gray-700 mb-3">
        <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800">
          <button
            onClick={onToggle}
            className="flex items-center gap-2 flex-1 text-left"
          >
            <Icon className="w-4 h-4 text-gray-600 dark:text-gray-400" />
            <span className="font-medium text-sm text-gray-900 dark:text-white">{title}</span>
            {isExpanded ? (
              <ChevronDown className="w-4 h-4 text-gray-500" />
            ) : (
              <ChevronRight className="w-4 h-4 text-gray-500" />
            )}
          </button>
          
          {onEnabledChange && (
            <label className="flex items-center gap-2 ml-3">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => onEnabledChange(e.target.checked)}
                className="rounded border-gray-300 text-orange-600 focus:ring-orange-500 dark:bg-gray-700 dark:border-gray-600"
              />
              <span className="text-xs text-gray-600 dark:text-gray-400">Enable</span>
            </label>
          )}
        </div>
        
        {isExpanded && enabled && (
          <div className="p-3 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
            {children}
          </div>
        )}
      </div>
    );
  };

  interface InputFieldProps {
    label: string;
    type?: 'text' | 'number' | 'checkbox' | 'select' | 'textarea';
    value: any;
    onChange: (value: any) => void;
    options?: { value: string; label: string; icon?: React.ComponentType<any> }[];
    min?: number;
    max?: number;
    step?: number;
    placeholder?: string;
    disabled?: boolean;
    helperText?: string;
  }

  const InputField: React.FC<InputFieldProps> = ({
    label,
    type = 'text',
    value,
    onChange,
    options,
    min,
    max,
    step,
    placeholder,
    disabled = false,
    helperText
  }) => {
    return (
      <div className="flex flex-col gap-1 mb-3">
        <label className={`text-xs font-medium ${disabled ? 'text-gray-400' : 'text-gray-700 dark:text-gray-300'}`}>
          {label}
        </label>
        
        {type === 'select' && options ? (
          <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            className="px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-orange-500 dark:bg-gray-800 dark:border-gray-600 dark:text-white disabled:opacity-50"
          >
            {options.map(option => {
              const OptionIcon = option.icon;
              return (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              );
            })}
          </select>
        ) : type === 'checkbox' ? (
          <label className="inline-flex items-center">
            <input
              type="checkbox"
              checked={value}
              onChange={(e) => onChange(e.target.checked)}
              disabled={disabled}
              className="rounded border-gray-300 text-orange-600 focus:ring-orange-500 dark:bg-gray-700 dark:border-gray-600 disabled:opacity-50"
            />
            <span className={`ml-2 text-xs ${disabled ? 'text-gray-400' : 'text-gray-600 dark:text-gray-400'}`}>
              {label}
            </span>
          </label>
        ) : type === 'textarea' ? (
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            placeholder={placeholder}
            rows={2}
            className="px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-orange-500 dark:bg-gray-800 dark:border-gray-600 dark:text-white disabled:opacity-50 resize-vertical"
          />
        ) : (
          <input
            type={type}
            value={value}
            onChange={(e) => onChange(type === 'number' ? Number(e.target.value) : e.target.value)}
            min={min}
            max={max}
            step={step}
            placeholder={placeholder}
            disabled={disabled}
            className="px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-orange-500 dark:bg-gray-800 dark:border-gray-600 dark:text-white disabled:opacity-50"
          />
        )}
        
        {helperText && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{helperText}</p>
        )}
      </div>
    );
  };

  interface MultiSelectProps {
    label: string;
    options: { value: string; label: string; icon?: React.ComponentType<any> }[];
    selected: string[];
    onChange: (selected: string[]) => void;
    disabled?: boolean;
  }

  const MultiSelect: React.FC<MultiSelectProps> = ({
    label,
    options,
    selected,
    onChange,
    disabled = false
  }) => {
    const toggleOption = (value: string) => {
      if (selected.includes(value)) {
        onChange(selected.filter(item => item !== value));
      } else {
        onChange([...selected, value]);
      }
    };

    return (
      <div className="flex flex-col gap-2 mb-3">
        <label className={`text-xs font-medium ${disabled ? 'text-gray-400' : 'text-gray-700 dark:text-gray-300'}`}>
          {label}
        </label>
        
        <div className="flex flex-wrap gap-1">
          {options.map(option => {
            const OptionIcon = option.icon;
            const isSelected = selected.includes(option.value);
            
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => !disabled && toggleOption(option.value)}
                disabled={disabled}
                className={`flex items-center gap-1 px-2 py-1 rounded border transition-colors text-xs ${
                  isSelected
                    ? 'bg-orange-100 border-orange-500 text-orange-700 dark:bg-orange-900 dark:border-orange-400 dark:text-orange-300'
                    : 'bg-gray-50 border-gray-300 text-gray-700 hover:bg-gray-100 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700'
                } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {OptionIcon && <OptionIcon className="w-3 h-3" />}
                <span>{option.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  interface TagInputProps {
    label: string;
    tags: string[];
    onChange: (tags: string[]) => void;
    placeholder?: string;
    disabled?: boolean;
  }

  const TagInput: React.FC<TagInputProps> = ({
    label,
    tags,
    onChange,
    placeholder = "Add a tag and press Enter",
    disabled = false
  }) => {
    const [inputValue, setInputValue] = useState('');

    const addTag = (tag: string) => {
      const trimmedTag = tag.trim();
      if (trimmedTag && !tags.includes(trimmedTag)) {
        onChange([...tags, trimmedTag]);
      }
      setInputValue('');
    };

    const removeTag = (tagToRemove: string) => {
      onChange(tags.filter(tag => tag !== tagToRemove));
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && inputValue.trim()) {
        e.preventDefault();
        addTag(inputValue);
      }
    };

    return (
      <div className="flex flex-col gap-2 mb-3">
        <label className={`text-xs font-medium ${disabled ? 'text-gray-400' : 'text-gray-700 dark:text-gray-300'}`}>
          {label}
        </label>
        
        <div className="flex flex-wrap gap-1 mb-2">
          {tags.map(tag => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 px-2 py-1 bg-orange-100 text-orange-800 rounded text-xs dark:bg-orange-900 dark:text-orange-200"
            >
              {tag}
              <button
                type="button"
                onClick={() => removeTag(tag)}
                disabled={disabled}
                className="text-orange-600 hover:text-orange-800 dark:text-orange-300 dark:hover:text-orange-100"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
        
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          className="px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-orange-500 dark:bg-gray-800 dark:border-gray-600 dark:text-white disabled:opacity-50"
        />
      </div>
    );
  };

  // ==============================
  // Main Settings Component
  // ==============================

  const LearningElementsSettings: React.FC<LearningElementsSettingsProps> = ({
    elements = defaultLearningElements,
    onElementsChange,
    onSettingsSave
  }) => {
    const [editingElement, setEditingElement] = useState<string | null>(elements[0]?.id || null);
    const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
    const [newElementName, setNewElementName] = useState('');
    const [showAddElement, setShowAddElement] = useState(false);
    const [localElements, setLocalElements] = useState<LearningElementSettings[]>(elements);

    // Get the current editing element
    const currentElement = localElements.find(el => el.id === editingElement);
    
    // Toggle section expansion
    const toggleSection = (section: string) => {
      setExpandedSections(prev => ({
        ...prev,
        [section]: !prev[section]
      }));
    };

    // Problem type options
    const problemTypeOptions = [
      { value: 'quiz', label: 'Quiz/MCQ', icon: Type },
      { value: 'programming', label: 'Programming', icon: Code },
      { value: 'frontend', label: 'Frontend', icon: Layout },
      { value: 'sql', label: 'SQL', icon: Database },
      { value: 'text', label: 'Text Answer', icon: FileText },
      { value: 'file-upload', label: 'File Upload', icon: Upload }
    ];

    // Evaluation type options
    const evaluationTypeOptions = [
      { value: 'teacher', label: 'Teacher Evaluation', icon: User },
      { value: 'testcase', label: 'Test Case Evaluation', icon: CheckCircle },
      { value: 'ai', label: 'AI Evaluation', icon: Cpu },
      { value: 'self', label: 'Self Evaluation', icon: User }
    ];

    // Language options
    const languageOptions = [
      { value: 'none', label: 'No Compiler', icon: X },
      { value: 'javascript', label: 'JavaScript', icon: Zap },
      { value: 'python', label: 'Python', icon: Zap },
      { value: 'java', label: 'Java', icon: Zap },
      { value: 'cpp', label: 'C++', icon: Zap },
      { value: 'sql', label: 'SQL', icon: Database }
    ];

    // AI Generation level options
    const aiGenerationLevelOptions = [
      { value: 'none', label: 'No AI Generation', icon: X },
      { value: 'basic', label: 'Basic', icon: Sparkles },
      { value: 'intermediate', label: 'Intermediate', icon: Brain },
      { value: 'advanced', label: 'Advanced', icon: Zap },
      { value: 'adaptive', label: 'Adaptive', icon: Filter }
    ];

    // Tone options
    const toneOptions = [
      { value: 'formal', label: 'Formal', icon: FileText },
      { value: 'friendly', label: 'Friendly', icon: User },
      { value: 'technical', label: 'Technical', icon: Code }
    ];

    // Handle adding new custom element
    const handleAddElement = () => {
      if (!newElementName.trim()) return;

      const newElement: LearningElementSettings = {
        id: `custom-${Date.now()}`,
        name: newElementName,
        type: 'custom',
        description: 'Custom learning element',
        icon: Settings,
        color: '#6B7280',
        isCustom: true,
        customType: newElementName.toLowerCase().replace(/\s+/g, '-'),
        security: { ...defaultSecuritySettings },
        aiGeneration: { ...defaultAIGenerationSettings },
        compiler: { ...defaultCompilerSettings },
        problems: { ...defaultProblemSettings },
        time: { ...defaultTimeSettings },
        evaluation: { ...defaultEvaluationSettings },
        accessibility: { ...defaultAccessibilitySettings }
      };

      const updatedElements = [...localElements, newElement];
      setLocalElements(updatedElements);
      onElementsChange?.(updatedElements);
      setNewElementName('');
      setShowAddElement(false);
      setEditingElement(newElement.id);
    };

    // Handle deleting an element
    const handleDeleteElement = (elementId: string) => {
      if (localElements.length <= 1) {
        alert('You must have at least one learning element');
        return;
      }

      const updatedElements = localElements.filter(el => el.id !== elementId);
      setLocalElements(updatedElements);
      onElementsChange?.(updatedElements);
      
      if (editingElement === elementId) {
        setEditingElement(updatedElements[0]?.id || null);
      }
    };

    // Update element settings
    const updateElementSettings = (updates: Partial<LearningElementSettings>) => {
      if (!currentElement) return;

      const updatedElement = {
        ...currentElement,
        ...updates
      };

      const updatedElements = localElements.map(el => 
        el.id === currentElement.id ? updatedElement : el
      );
      
      setLocalElements(updatedElements);
      onElementsChange?.(updatedElements);
      onSettingsSave?.(currentElement.id, updatedElement);
    };

    // Update nested settings
    const updateSecuritySettings = (updates: Partial<SecuritySettings>) => {
      if (!currentElement) return;
      
      updateElementSettings({
        security: { ...currentElement.security, ...updates }
      });
    };

    const updateAIGenerationSettings = (updates: Partial<AIGenerationSettings>) => {
      if (!currentElement) return;
      
      updateElementSettings({
        aiGeneration: { ...currentElement.aiGeneration, ...updates }
      });
    };

    const updateCompilerSettings = (updates: Partial<CompilerSettings>) => {
      if (!currentElement) return;
      
      updateElementSettings({
        compiler: { ...currentElement.compiler, ...updates }
      });
    };

    const updateProblemSettings = (updates: Partial<ProblemSettings>) => {
      if (!currentElement) return;
      
      updateElementSettings({
        problems: { ...currentElement.problems, ...updates }
      });
    };

    const updateTimeSettings = (updates: Partial<TimeSettings>) => {
      if (!currentElement) return;
      
      updateElementSettings({
        time: { ...currentElement.time, ...updates }
      });
    };

    const updateEvaluationSettings = (updates: Partial<EvaluationSettings>) => {
      if (!currentElement) return;
      
      updateElementSettings({
        evaluation: { ...currentElement.evaluation, ...updates }
      });
    };

    const updateAccessibilitySettings = (updates: Partial<AccessibilitySettings>) => {
      if (!currentElement) return;
      
      updateElementSettings({
        accessibility: { ...currentElement.accessibility, ...updates }
      });
    };

    // Calculate total weight for validation
    const getTotalEvaluationWeight = () => {
      if (!currentElement?.evaluation) return 0;
      
      const { teacherWeight, testcaseWeight, aiWeight, selfWeight } = currentElement.evaluation;
      return teacherWeight + testcaseWeight + aiWeight + selfWeight;
    };

    // Handle save settings
    const handleSaveSettings = () => {
      if (!currentElement) return;
      
      onSettingsSave?.(currentElement.id, currentElement);
      alert('Settings saved successfully!');
    };

    return (
      <div className="max-w-7xl mx-auto p-4 space-y-4  dark:bg-gray-900 rounded-lg">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">
              Learning Elements Settings
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Configure practice, self-practice, and self-assessment elements
            </p>
          </div>
          
          <button
            onClick={() => setShowAddElement(true)}
            className="flex items-center gap-2 px-3 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors text-sm"
          >
            <Plus className="w-4 h-4" />
            Add Element
          </button>
        </div>

        {/* Add Element Modal */}
        {showAddElement && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg w-80">
              <h3 className="text-lg font-semibold mb-3 dark:text-white">
                Add New Learning Element
              </h3>
              
              <InputField
                label="Element Name"
                value={newElementName}
                onChange={setNewElementName}
                placeholder="Enter element name..."
              />
              
              <div className="flex gap-2 mt-4">
                <button
                  onClick={handleAddElement}
                  disabled={!newElementName.trim()}
                  className="flex-1 px-3 py-2 bg-orange-600 text-white rounded hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  Add Element
                </button>
                <button
                  onClick={() => setShowAddElement(false)}
                  className="flex-1 px-3 py-2 border border-gray-300 text-gray-700 rounded hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700 text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          {/* Sidebar - Element List */}
          <div className="lg:col-span-1 space-y-2">
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2 text-sm">
                Learning Elements
              </h3>
              
              <div className="space-y-1">
                {localElements.map(element => {
                  const Icon = element.icon;
                  return (
                    <button
                      key={element.id}
                      onClick={() => setEditingElement(element.id)}
                      className={`w-full flex items-center gap-2 p-2 rounded transition-colors text-sm ${
                        editingElement === element.id
                          ? 'bg-white dark:bg-gray-700 shadow border border-gray-200 dark:border-gray-600'
                          : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                      }`}
                    >
                      <div
                        className="w-6 h-6 rounded flex items-center justify-center"
                        style={{ backgroundColor: element.color }}
                      >
                        <Icon className="w-3 h-3 text-white" />
                      </div>
                      
                      <div className="flex-1 text-left">
                        <div className="font-medium text-gray-900 dark:text-white">
                          {element.name}
                        </div>
                      </div>

                      {element.isCustom && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteElement(element.id);
                          }}
                          className="p-1 text-red-500 hover:bg-red-50 rounded dark:hover:bg-red-900"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Main Settings Area */}
          <div className="lg:col-span-3">
            {currentElement ? (
              <div className="space-y-4">
                {/* Element Header */}
                <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: currentElement.color }}
                    >
                      <currentElement.icon className="w-5 h-5 text-white" />
                    </div>
                    
                    <div>
                      <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                        {currentElement.name}
                      </h2>
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        {currentElement.description}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {currentElement.isCustom && (
                      <button
                        onClick={() => handleDeleteElement(currentElement.id)}
                        className="flex items-center gap-1 px-2 py-1 text-red-600 hover:bg-red-50 rounded dark:hover:bg-red-900 text-sm"
                      >
                        <Trash2 className="w-3 h-3" />
                        Delete
                      </button>
                    )}
                    
                    <button
                      onClick={handleSaveSettings}
                      className="flex items-center gap-1 px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
                    >
                      <Save className="w-3 h-3" />
                      Save
                    </button>
                  </div>
                </div>

                {/* Settings Sections */}
                <div className="space-y-3">
                  {/* Security Settings */}
                  <SettingsSection
                    title="Security & Proctoring"
                    icon={Shield}
                    isExpanded={expandedSections.security}
                    onToggle={() => toggleSection('security')}
                    enabled={currentElement.security.enabled}
                    onEnabledChange={(enabled) => updateSecuritySettings({ enabled })}
                  >
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <InputField
                          label="Screen Capture"
                          type="checkbox"
                          value={currentElement.security.screenCapture}
                          onChange={(value) => updateSecuritySettings({ screenCapture: value })}
                          disabled={!currentElement.security.enabled}
                          helperText="Capture screen during assessment"
                        />
                        
                        <InputField
                          label="Allow Tab Switching"
                          type="checkbox"
                          value={currentElement.security.allowTabSwitch}
                          onChange={(value) => updateSecuritySettings({ allowTabSwitch: value })}
                          disabled={!currentElement.security.enabled}
                          helperText="Allow switching browser tabs"
                        />
                        
                        <InputField
                          label="Allow App Minimize"
                          type="checkbox"
                          value={currentElement.security.allowAppMinimize}
                          onChange={(value) => updateSecuritySettings({ allowAppMinimize: value })}
                          disabled={!currentElement.security.enabled}
                          helperText="Allow minimizing browser window"
                        />
                        
                        <InputField
                          label="Full Screen Required"
                          type="checkbox"
                          value={currentElement.security.fullScreenRequired}
                          onChange={(value) => updateSecuritySettings({ fullScreenRequired: value })}
                          disabled={!currentElement.security.enabled}
                        />
                        
                        <InputField
                          label="Disable Copy/Paste"
                          type="checkbox"
                          value={currentElement.security.disableCopyPaste}
                          onChange={(value) => updateSecuritySettings({ disableCopyPaste: value })}
                          disabled={!currentElement.security.enabled}
                        />
                        
                        <InputField
                          label="Disable Right Click"
                          type="checkbox"
                          value={currentElement.security.disableRightClick}
                          onChange={(value) => updateSecuritySettings({ disableRightClick: value })}
                          disabled={!currentElement.security.enabled}
                        />
                        
                        <InputField
                          label="Disable Print Screen"
                          type="checkbox"
                          value={currentElement.security.disablePrintScreen}
                          onChange={(value) => updateSecuritySettings({ disablePrintScreen: value })}
                          disabled={!currentElement.security.enabled}
                        />
                        
                        <InputField
                          label="Block Virtual Machines"
                          type="checkbox"
                          value={currentElement.security.blockVirtualMachines}
                          onChange={(value) => updateSecuritySettings({ blockVirtualMachines: value })}
                          disabled={!currentElement.security.enabled}
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <InputField
                          label="Require Webcam"
                          type="checkbox"
                          value={currentElement.security.requireWebcam}
                          onChange={(value) => updateSecuritySettings({ requireWebcam: value })}
                          disabled={!currentElement.security.enabled}
                        />
                        
                        <InputField
                          label="Identity Verification"
                          type="checkbox"
                          value={currentElement.security.identityVerification}
                          onChange={(value) => updateSecuritySettings({ identityVerification: value })}
                          disabled={!currentElement.security.enabled}
                        />
                        
                        <InputField
                          label="Lockdown Browser"
                          type="checkbox"
                          value={currentElement.security.lockdownBrowser}
                          onChange={(value) => updateSecuritySettings({ lockdownBrowser: value })}
                          disabled={!currentElement.security.enabled}
                        />
                        
                        <InputField
                          label="Watermark Enabled"
                          type="checkbox"
                          value={currentElement.security.watermarkEnabled}
                          onChange={(value) => updateSecuritySettings({ watermarkEnabled: value })}
                          disabled={!currentElement.security.enabled}
                        />
                      </div>

                      {currentElement.security.watermarkEnabled && (
                        <InputField
                          label="Watermark Text"
                          type="text"
                          value={currentElement.security.watermarkText}
                          onChange={(value) => updateSecuritySettings({ watermarkText: value })}
                          disabled={!currentElement.security.enabled}
                          placeholder="Confidential - Learning Assessment"
                        />
                      )}
                    </div>
                  </SettingsSection>

                  {/* AI Generation Settings */}
                  <SettingsSection
                    title="AI Question Generation"
                    icon={Brain}
                    isExpanded={expandedSections.aiGeneration}
                    onToggle={() => toggleSection('aiGeneration')}
                    enabled={currentElement.aiGeneration.enabled}
                    onEnabledChange={(enabled) => updateAIGenerationSettings({ enabled })}
                  >
                    <div className="space-y-3">
                      <InputField
                        label="Generation Level"
                        type="select"
                        value={currentElement.aiGeneration.generationLevel}
                        onChange={(value) => updateAIGenerationSettings({ generationLevel: value })}
                        options={aiGenerationLevelOptions}
                        disabled={!currentElement.aiGeneration.enabled}
                      />

                      {currentElement.aiGeneration.generationLevel !== 'none' && (
                        <>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <InputField
                              label="Auto Generate Questions"
                              type="checkbox"
                              value={currentElement.aiGeneration.autoGenerateQuestions}
                              onChange={(value) => updateAIGenerationSettings({ autoGenerateQuestions: value })}
                              disabled={!currentElement.aiGeneration.enabled}
                            />
                            
                            <InputField
                              label="Difficulty Adaptation"
                              type="checkbox"
                              value={currentElement.aiGeneration.difficultyAdaptation}
                              onChange={(value) => updateAIGenerationSettings({ difficultyAdaptation: value })}
                              disabled={!currentElement.aiGeneration.enabled}
                            />
                            
                            <InputField
                              label="Personalization"
                              type="checkbox"
                              value={currentElement.aiGeneration.personalization}
                              onChange={(value) => updateAIGenerationSettings({ personalization: value })}
                              disabled={!currentElement.aiGeneration.enabled}
                            />
                            
                            <InputField
                              label="Include Explanation"
                              type="checkbox"
                              value={currentElement.aiGeneration.includeExplanation}
                              onChange={(value) => updateAIGenerationSettings({ includeExplanation: value })}
                              disabled={!currentElement.aiGeneration.enabled}
                            />
                            
                            <InputField
                              label="Include Hints"
                              type="checkbox"
                              value={currentElement.aiGeneration.includeHints}
                              onChange={(value) => updateAIGenerationSettings({ includeHints: value })}
                              disabled={!currentElement.aiGeneration.enabled}
                            />
                            
                            <InputField
                              label="Quality Check"
                              type="checkbox"
                              value={currentElement.aiGeneration.qualityCheck}
                              onChange={(value) => updateAIGenerationSettings({ qualityCheck: value })}
                              disabled={!currentElement.aiGeneration.enabled}
                            />
                            
                            <InputField
                              label="Plagiarism Check"
                              type="checkbox"
                              value={currentElement.aiGeneration.plagiarismCheck}
                              onChange={(value) => updateAIGenerationSettings({ plagiarismCheck: value })}
                              disabled={!currentElement.aiGeneration.enabled}
                            />
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <InputField
                              label="Question Count"
                              type="number"
                              value={currentElement.aiGeneration.questionCount}
                              onChange={(value) => updateAIGenerationSettings({ questionCount: value })}
                              min={1}
                              max={100}
                              disabled={!currentElement.aiGeneration.enabled}
                            />
                            
                            <InputField
                              label="Language"
                              type="select"
                              value={currentElement.aiGeneration.language}
                              onChange={(value) => updateAIGenerationSettings({ language: value })}
                              options={[
                                { value: 'english', label: 'English' },
                                { value: 'spanish', label: 'Spanish' },
                                { value: 'french', label: 'French' },
                                { value: 'german', label: 'German' }
                              ]}
                              disabled={!currentElement.aiGeneration.enabled}
                            />
                            
                            <InputField
                              label="Tone"
                              type="select"
                              value={currentElement.aiGeneration.tone}
                              onChange={(value) => updateAIGenerationSettings({ tone: value })}
                              options={toneOptions}
                              disabled={!currentElement.aiGeneration.enabled}
                            />
                          </div>

                          <TagInput
                            label="Topics"
                            tags={currentElement.aiGeneration.topics}
                            onChange={(tags) => updateAIGenerationSettings({ topics: tags })}
                            placeholder="Add topic and press Enter"
                            disabled={!currentElement.aiGeneration.enabled}
                          />
                        </>
                      )}
                    </div>
                  </SettingsSection>

                  {/* Compiler Settings */}
                  <SettingsSection
                    title="Compiler Settings"
                    icon={Code}
                    isExpanded={expandedSections.compiler}
                    onToggle={() => toggleSection('compiler')}
                    enabled={currentElement.compiler.enabled}
                    onEnabledChange={(enabled) => updateCompilerSettings({ enabled })}
                  >
                    <div className="space-y-3">
                      <InputField
                        label="Programming Language"
                        type="select"
                        value={currentElement.compiler.language}
                        onChange={(value) => updateCompilerSettings({ language: value })}
                        options={languageOptions}
                        disabled={!currentElement.compiler.enabled}
                      />
                      
                      {currentElement.compiler.language !== 'none' && (
                        <>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <InputField
                              label="Time Limit (seconds)"
                              type="number"
                              value={currentElement.compiler.timeLimit}
                              onChange={(value) => updateCompilerSettings({ timeLimit: value })}
                              min={1}
                              max={300}
                              disabled={!currentElement.compiler.enabled}
                              helperText="Max execution time"
                            />
                            
                            <InputField
                              label="Memory Limit (MB)"
                              type="number"
                              value={currentElement.compiler.memoryLimit}
                              onChange={(value) => updateCompilerSettings({ memoryLimit: value })}
                              min={64}
                              max={1024}
                              disabled={!currentElement.compiler.enabled}
                              helperText="Max memory usage"
                            />
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <InputField
                              label="Allow Copy/Paste"
                              type="checkbox"
                              value={currentElement.compiler.allowCopyPaste}
                              onChange={(value) => updateCompilerSettings({ allowCopyPaste: value })}
                              disabled={!currentElement.compiler.enabled}
                            />
                            
                            <InputField
                              label="Allow Imports"
                              type="checkbox"
                              value={currentElement.compiler.allowImports}
                              onChange={(value) => updateCompilerSettings({ allowImports: value })}
                              disabled={!currentElement.compiler.enabled}
                            />
                            
                            <InputField
                              label="Auto Complete"
                              type="checkbox"
                              value={currentElement.compiler.autoComplete}
                              onChange={(value) => updateCompilerSettings({ autoComplete: value })}
                              disabled={!currentElement.compiler.enabled}
                            />
                            
                            <InputField
                              label="Syntax Highlighting"
                              type="checkbox"
                              value={currentElement.compiler.syntaxHighlighting}
                              onChange={(value) => updateCompilerSettings({ syntaxHighlighting: value })}
                              disabled={!currentElement.compiler.enabled}
                            />
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <InputField
                              label="Run Code Feature"
                              type="checkbox"
                              value={currentElement.compiler.runCode}
                              onChange={(value) => updateCompilerSettings({ runCode: value })}
                              disabled={!currentElement.compiler.enabled}
                            />
                            
                            <InputField
                              label="Debug Mode"
                              type="checkbox"
                              value={currentElement.compiler.debugMode}
                              onChange={(value) => updateCompilerSettings({ debugMode: value })}
                              disabled={!currentElement.compiler.enabled}
                            />
                          </div>

                          {currentElement.compiler.allowImports && (
                            <InputField
                              label="Allowed Imports (comma-separated)"
                              type="textarea"
                              value={currentElement.compiler.allowedImports.join(', ')}
                              onChange={(value) => updateCompilerSettings({ 
                                allowedImports: value.split(',').map(s => s.trim()).filter(Boolean)
                              })}
                              disabled={!currentElement.compiler.enabled}
                              placeholder="react, lodash, axios"
                              helperText="Specify allowed libraries"
                            />
                          )}
                        </>
                      )}
                    </div>
                  </SettingsSection>

                  {/* Problem Settings */}
                  <SettingsSection
                    title="Problem Settings"
                    icon={FileText}
                    isExpanded={expandedSections.problems}
                    onToggle={() => toggleSection('problems')}
                  >
                    <div className="space-y-3">
                      <MultiSelect
                        label="Problem Types"
                        options={problemTypeOptions}
                        selected={currentElement.problems.problemTypes}
                        onChange={(selected) => updateProblemSettings({ problemTypes: selected })}
                      />

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <InputField
                          label="Total Questions"
                          type="number"
                          value={currentElement.problems.totalQuestions}
                          onChange={(value) => updateProblemSettings({ totalQuestions: value })}
                          min={0}
                          max={100}
                        />
                        
                        <InputField
                          label="Points per Question"
                          type="number"
                          value={currentElement.problems.pointsPerQuestion}
                          onChange={(value) => updateProblemSettings({ pointsPerQuestion: value })}
                          min={0}
                          max={100}
                        />
                        
                        <InputField
                          label="Attempts Allowed"
                          type="number"
                          value={currentElement.problems.attemptsAllowed}
                          onChange={(value) => updateProblemSettings({ attemptsAllowed: value })}
                          min={0}
                          max={10}
                          helperText="0 = unlimited"
                        />
                        
                        <InputField
                          label="Question Bank Size"
                          type="number"
                          value={currentElement.problems.questionBankSize}
                          onChange={(value) => updateProblemSettings({ questionBankSize: value })}
                          min={0}
                          max={1000}
                          helperText="Total questions in bank"
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <InputField
                          label="Shuffle Questions"
                          type="checkbox"
                          value={currentElement.problems.shuffleQuestions}
                          onChange={(value) => updateProblemSettings({ shuffleQuestions: value })}
                        />
                        
                        <InputField
                          label="Randomize Options"
                          type="checkbox"
                          value={currentElement.problems.randomizeOptions}
                          onChange={(value) => updateProblemSettings({ randomizeOptions: value })}
                        />
                        
                        <InputField
                          label="Show Solution"
                          type="checkbox"
                          value={currentElement.problems.showSolution}
                          onChange={(value) => updateProblemSettings({ showSolution: value })}
                        />
                        
                        <InputField
                          label="Show Explanation"
                          type="checkbox"
                          value={currentElement.problems.showExplanation}
                          onChange={(value) => updateProblemSettings({ showExplanation: value })}
                        />
                        
                        <InputField
                          label="Allow Skip"
                          type="checkbox"
                          value={currentElement.problems.allowSkip}
                          onChange={(value) => updateProblemSettings({ allowSkip: value })}
                        />
                        
                        <InputField
                          label="Negative Marking"
                          type="checkbox"
                          value={currentElement.problems.negativeMarking}
                          onChange={(value) => updateProblemSettings({ negativeMarking: value })}
                        />
                        
                        <InputField
                          label="Adaptive Testing"
                          type="checkbox"
                          value={currentElement.problems.adaptiveTesting}
                          onChange={(value) => updateProblemSettings({ adaptiveTesting: value })}
                        />
                      </div>

                      {currentElement.problems.negativeMarking && (
                        <InputField
                          label="Negative Marking %"
                          type="number"
                          value={currentElement.problems.negativeMarkingPercentage}
                          onChange={(value) => updateProblemSettings({ negativeMarkingPercentage: value })}
                          min={0}
                          max={100}
                          helperText="Marks deducted for wrong answers"
                        />
                      )}

                      <TagInput
                        label="Question Tags"
                        tags={currentElement.problems.questionTags}
                        onChange={(tags) => updateProblemSettings({ questionTags: tags })}
                        placeholder="Add question tag and press Enter"
                      />
                    </div>
                  </SettingsSection>

                  {/* Time Settings */}
                  <SettingsSection
                    title="Time Settings"
                    icon={Clock}
                    isExpanded={expandedSections.time}
                    onToggle={() => toggleSection('time')}
                    enabled={currentElement.time.enabled}
                    onEnabledChange={(enabled) => updateTimeSettings({ enabled })}
                  >
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <InputField
                          label="Time Limit (minutes)"
                          type="number"
                          value={currentElement.time.timeLimit}
                          onChange={(value) => updateTimeSettings({ timeLimit: value })}
                          min={0}
                          max={300}
                          disabled={!currentElement.time.enabled}
                          helperText="0 = no limit"
                        />
                        
                        <InputField
                          label="Warning Before (minutes)"
                          type="number"
                          value={currentElement.time.warningBeforeTimeUp}
                          onChange={(value) => updateTimeSettings({ warningBeforeTimeUp: value })}
                          min={1}
                          max={15}
                          disabled={!currentElement.time.enabled}
                        />
                        
                        <InputField
                          label="Grace Period (minutes)"
                          type="number"
                          value={currentElement.time.gracePeriod}
                          onChange={(value) => updateTimeSettings({ gracePeriod: value })}
                          min={0}
                          max={10}
                          disabled={!currentElement.time.enabled}
                          helperText="Extra time after limit"
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <InputField
                          label="Allow Pause"
                          type="checkbox"
                          value={currentElement.time.allowPause}
                          onChange={(value) => updateTimeSettings({ allowPause: value })}
                          disabled={!currentElement.time.enabled}
                        />
                        
                        <InputField
                          label="Auto Submit"
                          type="checkbox"
                          value={currentElement.time.autoSubmit}
                          onChange={(value) => updateTimeSettings({ autoSubmit: value })}
                          disabled={!currentElement.time.enabled}
                        />
                        
                        <InputField
                          label="Show Timer"
                          type="checkbox"
                          value={currentElement.time.showTimer}
                          onChange={(value) => updateTimeSettings({ showTimer: value })}
                          disabled={!currentElement.time.enabled}
                        />
                        
                        <InputField
                          label="Time Per Question"
                          type="checkbox"
                          value={currentElement.time.timePerQuestion}
                          onChange={(value) => updateTimeSettings({ timePerQuestion: value })}
                          disabled={!currentElement.time.enabled}
                        />
                        
                        <InputField
                          label="Strict Timing"
                          type="checkbox"
                          value={currentElement.time.strictTiming}
                          onChange={(value) => updateTimeSettings({ strictTiming: value })}
                          disabled={!currentElement.time.enabled}
                        />
                      </div>
                    </div>
                  </SettingsSection>

                  {/* Evaluation Settings */}
                  <SettingsSection
                    title="Evaluation Settings"
                    icon={CheckCircle}
                    isExpanded={expandedSections.evaluation}
                    onToggle={() => toggleSection('evaluation')}
                    enabled={currentElement.evaluation.enabled}
                    onEnabledChange={(enabled) => updateEvaluationSettings({ enabled })}
                  >
                    <div className="space-y-3">
                      <MultiSelect
                        label="Evaluation Methods"
                        options={evaluationTypeOptions}
                        selected={currentElement.evaluation.evaluationTypes}
                        onChange={(selected) => updateEvaluationSettings({ evaluationTypes: selected })}
                        disabled={!currentElement.evaluation.enabled}
                      />

                      {currentElement.evaluation.evaluationTypes.length > 0 && (
                        <>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {currentElement.evaluation.evaluationTypes.includes('teacher') && (
                              <InputField
                                label="Teacher Weight (%)"
                                type="number"
                                value={currentElement.evaluation.teacherWeight}
                                onChange={(value) => updateEvaluationSettings({ teacherWeight: value })}
                                min={0}
                                max={100}
                                disabled={!currentElement.evaluation.enabled}
                              />
                            )}
                            
                            {currentElement.evaluation.evaluationTypes.includes('testcase') && (
                              <InputField
                                label="Test Case Weight (%)"
                                type="number"
                                value={currentElement.evaluation.testcaseWeight}
                                onChange={(value) => updateEvaluationSettings({ testcaseWeight: value })}
                                min={0}
                                max={100}
                                disabled={!currentElement.evaluation.enabled}
                              />
                            )}
                            
                            {currentElement.evaluation.evaluationTypes.includes('ai') && (
                              <InputField
                                label="AI Weight (%)"
                                type="number"
                                value={currentElement.evaluation.aiWeight}
                                onChange={(value) => updateEvaluationSettings({ aiWeight: value })}
                                min={0}
                                max={100}
                                disabled={!currentElement.evaluation.enabled}
                              />
                            )}
                            
                            {currentElement.evaluation.evaluationTypes.includes('self') && (
                              <InputField
                                label="Self Weight (%)"
                                type="number"
                                value={currentElement.evaluation.selfWeight}
                                onChange={(value) => updateEvaluationSettings({ selfWeight: value })}
                                min={0}
                                max={100}
                                disabled={!currentElement.evaluation.enabled}
                              />
                            )}
                            
                            <InputField
                              label="Passing Score (%)"
                              type="number"
                              value={currentElement.evaluation.passingScore}
                              onChange={(value) => updateEvaluationSettings({ passingScore: value })}
                              min={0}
                              max={100}
                              disabled={!currentElement.evaluation.enabled}
                            />
                          </div>

                          {getTotalEvaluationWeight() !== 100 && currentElement.evaluation.evaluationTypes.length > 0 && (
                            <div className="p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800">
                              Total weight: {getTotalEvaluationWeight()}% (should be 100%)
                            </div>
                          )}

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <InputField
                              label="Require Code Submission"
                              type="checkbox"
                              value={currentElement.evaluation.requireCodeSubmission}
                              onChange={(value) => updateEvaluationSettings({ requireCodeSubmission: value })}
                              disabled={!currentElement.evaluation.enabled}
                            />
                            
                            <InputField
                              label="Instant Feedback"
                              type="checkbox"
                              value={currentElement.evaluation.instantFeedback}
                              onChange={(value) => updateEvaluationSettings({ instantFeedback: value })}
                              disabled={!currentElement.evaluation.enabled}
                            />
                            
                            <InputField
                              label="Show Detailed Results"
                              type="checkbox"
                              value={currentElement.evaluation.showDetailedResults}
                              onChange={(value) => updateEvaluationSettings({ showDetailedResults: value })}
                              disabled={!currentElement.evaluation.enabled}
                            />
                            
                            <InputField
                              label="Allow Retake"
                              type="checkbox"
                              value={currentElement.evaluation.allowRetake}
                              onChange={(value) => updateEvaluationSettings({ allowRetake: value })}
                              disabled={!currentElement.evaluation.enabled}
                            />
                            
                            <InputField
                              label="Peer Review"
                              type="checkbox"
                              value={currentElement.evaluation.peerReview}
                              onChange={(value) => updateEvaluationSettings({ peerReview: value })}
                              disabled={!currentElement.evaluation.enabled}
                            />
                            
                            <InputField
                              label="Rubric Based"
                              type="checkbox"
                              value={currentElement.evaluation.rubricBased}
                              onChange={(value) => updateEvaluationSettings({ rubricBased: value })}
                              disabled={!currentElement.evaluation.enabled}
                            />
                            
                            <InputField
                              label="Analytics Enabled"
                              type="checkbox"
                              value={currentElement.evaluation.analyticsEnabled}
                              onChange={(value) => updateEvaluationSettings({ analyticsEnabled: value })}
                              disabled={!currentElement.evaluation.enabled}
                            />
                          </div>

                          {currentElement.evaluation.allowRetake && (
                            <InputField
                              label="Maximum Retakes"
                              type="number"
                              value={currentElement.evaluation.maxRetakes}
                              onChange={(value) => updateEvaluationSettings({ maxRetakes: value })}
                              min={1}
                              max={10}
                              disabled={!currentElement.evaluation.enabled}
                            />
                          )}
                        </>
                      )}
                    </div>
                  </SettingsSection>

                  {/* Accessibility Settings */}
                  <SettingsSection
                    title="Accessibility Settings"
                    icon={Eye}
                    isExpanded={expandedSections.accessibility}
                    onToggle={() => toggleSection('accessibility')}
                    enabled={currentElement.accessibility.enabled}
                    onEnabledChange={(enabled) => updateAccessibilitySettings({ enabled })}
                  >
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <InputField
                          label="High Contrast Mode"
                          type="checkbox"
                          value={currentElement.accessibility.highContrast}
                          onChange={(value) => updateAccessibilitySettings({ highContrast: value })}
                          disabled={!currentElement.accessibility.enabled}
                        />
                        
                        <InputField
                          label="Large Text"
                          type="checkbox"
                          value={currentElement.accessibility.largeText}
                          onChange={(value) => updateAccessibilitySettings({ largeText: value })}
                          disabled={!currentElement.accessibility.enabled}
                        />
                        
                        <InputField
                          label="Screen Reader Support"
                          type="checkbox"
                          value={currentElement.accessibility.screenReader}
                          onChange={(value) => updateAccessibilitySettings({ screenReader: value })}
                          disabled={!currentElement.accessibility.enabled}
                        />
                        
                        <InputField
                          label="Keyboard Navigation"
                          type="checkbox"
                          value={currentElement.accessibility.keyboardNavigation}
                          onChange={(value) => updateAccessibilitySettings({ keyboardNavigation: value })}
                          disabled={!currentElement.accessibility.enabled}
                        />
                        
                        <InputField
                          label="Extra Time"
                          type="checkbox"
                          value={currentElement.accessibility.extraTime}
                          onChange={(value) => updateAccessibilitySettings({ extraTime: value })}
                          disabled={!currentElement.accessibility.enabled}
                        />
                        
                        <InputField
                          label="Color Blind Mode"
                          type="checkbox"
                          value={currentElement.accessibility.colorBlindMode}
                          onChange={(value) => updateAccessibilitySettings({ colorBlindMode: value })}
                          disabled={!currentElement.accessibility.enabled}
                        />
                        
                        <InputField
                          label="Dyslexia Friendly"
                          type="checkbox"
                          value={currentElement.accessibility.dyslexiaFriendly}
                          onChange={(value) => updateAccessibilitySettings({ dyslexiaFriendly: value })}
                          disabled={!currentElement.accessibility.enabled}
                        />
                        
                        <InputField
                          label="Text to Speech"
                          type="checkbox"
                          value={currentElement.accessibility.textToSpeech}
                          onChange={(value) => updateAccessibilitySettings({ textToSpeech: value })}
                          disabled={!currentElement.accessibility.enabled}
                        />
                        
                        <InputField
                          label="Speech to Text"
                          type="checkbox"
                          value={currentElement.accessibility.speechToText}
                          onChange={(value) => updateAccessibilitySettings({ speechToText: value })}
                          disabled={!currentElement.accessibility.enabled}
                        />
                      </div>

                      {currentElement.accessibility.extraTime && (
                        <InputField
                          label="Extra Time Percentage"
                          type="number"
                          value={currentElement.accessibility.extraTimePercentage}
                          onChange={(value) => updateAccessibilitySettings({ extraTimePercentage: value })}
                          min={0}
                          max={100}
                          disabled={!currentElement.accessibility.enabled}
                          helperText="Additional time as percentage"
                        />
                      )}
                    </div>
                  </SettingsSection>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <Settings className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
                  Select a Learning Element
                </h3>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  Choose an element from the sidebar to configure settings
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Usage Example Component
  export default function TestPage() {
    const [learningElements, setLearningElements] = useState(defaultLearningElements);

    const handleElementsChange = (newElements: LearningElementSettings[]) => {
      console.log('Elements changed:', newElements);
      setLearningElements(newElements);
    };

    const handleSettingsSave = (elementId: string, settings: Partial<LearningElementSettings>) => {
      console.log('Settings saved for:', elementId, settings);
      // Here you would typically save to your backend
    };

    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
        <LearningElementsSettings
          elements={learningElements}
          onElementsChange={handleElementsChange}
          onSettingsSave={handleSettingsSave}
        />
      </div>
    );
  }