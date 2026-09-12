"use client";

import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, 
  BookOpen, 
  Target, 
  Settings,
  Clock,
  CheckCircle,
  Code,
  FileText,
  User,
  Cpu,
  Shield,
  Eye,
  EyeOff,
  Maximize2,
  Minimize2,
  Copy,
  Download,
  Upload,
  Camera,
  Monitor,
  Zap,
  Brain,
  Sparkles,
  ChevronDown,
  ChevronRight,
  Save,
  X,
  Type,
  Layout,
  Database,
  Filter,
  Bookmark,
  Terminal,
  Lightbulb,
  AlertTriangle,
  CheckSquare,
  Square,
  Sun,
  Moon,
  ChevronLeft,
  Menu,
  ArrowRight,
  Star,
  Award,
  TrendingUp,
  ChevronUp,
  ChevronRightIcon,
  StickyNote,
  List
} from 'lucide-react';

// Monaco Editor imports
import Editor from '@monaco-editor/react';

// Reuse the same type definitions
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

interface Question {
  id: string;
  type: ProblemType;
  title: string;
  content: string;
  description?: string;
  examples?: { input: string; output: string; explanation?: string }[];
  constraints?: string[];
  hints?: string[];
  options?: string[];
  correctAnswer?: string;
  points: number;
  explanation?: string;
  hint?: string;
  codeTemplate?: string;
  testCases?: TestCase[];
  submitted?: boolean;
}

interface TestCase {
  input: string;
  expectedOutput: string;
  isHidden: boolean;
  actualOutput?: string;
  passed?: boolean;
}

// Mock data for learning elements
const defaultLearningElements: LearningElementSettings[] = [
  {
    id: 'practice',
    name: 'Practice',
    type: 'practice',
    description: 'Learn and practice with guidance',
    icon: Play,
    color: '#FB923C',
    security: { 
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
    },
    aiGeneration: {
      enabled: true,
      generationLevel: 'basic',
      autoGenerateQuestions: false,
      difficultyAdaptation: false,
      personalization: false,
      topics: ['JavaScript', 'HTML', 'CSS'],
      questionCount: 10,
      includeExplanation: true,
      includeHints: true,
      language: 'english',
      tone: 'friendly',
      qualityCheck: true,
      plagiarismCheck: false
    },
    compiler: {
      enabled: true,
      language: 'javascript',
      version: 'ES6',
      timeLimit: 30,
      memoryLimit: 256,
      allowCopyPaste: true,
      allowImports: true,
      allowedImports: ['lodash', 'axios'],
      autoComplete: true,
      syntaxHighlighting: true,
      runCode: true,
      debugMode: true
    },
    problems: {
      problemTypes: ['quiz', 'programming'],
      totalQuestions: 5,
      pointsPerQuestion: 10,
      shuffleQuestions: false,
      showSolution: true,
      attemptsAllowed: 0,
      randomizeOptions: false,
      showExplanation: true,
      allowSkip: true,
      negativeMarking: false,
      negativeMarkingPercentage: 25,
      questionBankSize: 50,
      adaptiveTesting: false,
      questionTags: ['basics', 'functions']
    },
    time: {
      enabled: false,
      timeLimit: 60,
      allowPause: true,
      autoSubmit: false,
      showTimer: true,
      warningBeforeTimeUp: 5,
      gracePeriod: 2,
      timePerQuestion: false,
      strictTiming: false
    },
    evaluation: {
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
      allowRetake: true,
      maxRetakes: 3,
      peerReview: false,
      rubricBased: false,
      analyticsEnabled: true
    },
    accessibility: {
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
    }
  },
  {
    id: 'self-practice',
    name: 'Self Practice',
    type: 'self-practice',
    description: 'Practice independently with submissions',
    icon: BookOpen,
    color: '#10B981',
    security: { 
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
    },
    aiGeneration: {
      enabled: true,
      generationLevel: 'intermediate',
      autoGenerateQuestions: true,
      difficultyAdaptation: true,
      personalization: true,
      topics: ['JavaScript', 'React', 'CSS', 'Algorithms'],
      questionCount: 15,
      includeExplanation: true,
      includeHints: true,
      language: 'english',
      tone: 'friendly',
      qualityCheck: true,
      plagiarismCheck: true
    },
    compiler: {
      enabled: true,
      language: 'javascript',
      version: 'ES6',
      timeLimit: 10,
      memoryLimit: 256,
      allowCopyPaste: true,
      allowImports: true,
      allowedImports: ['react', 'lodash', 'axios'],
      autoComplete: true,
      syntaxHighlighting: true,
      runCode: true,
      debugMode: true
    },
    problems: {
      problemTypes: ['quiz', 'programming', 'text'],
      totalQuestions: 8,
      pointsPerQuestion: 12,
      shuffleQuestions: true,
      showSolution: true,
      attemptsAllowed: 3,
      randomizeOptions: true,
      showExplanation: true,
      allowSkip: true,
      negativeMarking: false,
      negativeMarkingPercentage: 25,
      questionBankSize: 30,
      adaptiveTesting: true,
      questionTags: ['functions', 'arrays', 'react']
    },
    time: {
      enabled: true,
      timeLimit: 120,
      allowPause: true,
      autoSubmit: false,
      showTimer: true,
      warningBeforeTimeUp: 10,
      gracePeriod: 5,
      timePerQuestion: false,
      strictTiming: false
    },
    evaluation: {
      enabled: true,
      evaluationTypes: ['testcase', 'ai'],
      teacherWeight: 0,
      testcaseWeight: 70,
      aiWeight: 30,
      selfWeight: 0,
      passingScore: 60,
      requireCodeSubmission: true,
      instantFeedback: true,
      showDetailedResults: true,
      allowRetake: true,
      maxRetakes: 5,
      peerReview: false,
      rubricBased: true,
      analyticsEnabled: true
    },
    accessibility: {
      enabled: true,
      highContrast: false,
      largeText: true,
      screenReader: false,
      keyboardNavigation: true,
      extraTime: true,
      extraTimePercentage: 25,
      colorBlindMode: false,
      dyslexiaFriendly: true,
      textToSpeech: false,
      speechToText: false
    }
  },
  {
    id: 'self-assessment',
    name: 'Self Assessment',
    type: 'self-assessment',
    description: 'Formal assessment with security',
    icon: Target,
    color: '#8B5CF6',
    security: { 
      enabled: true,
      screenCapture: true,
      allowTabSwitch: false,
      allowAppMinimize: false,
      fullScreenRequired: true,
      disableCopyPaste: true,
      disableRightClick: true,
      disablePrintScreen: true,
      watermarkEnabled: true,
      watermarkText: 'Confidential - Assessment',
      blockVirtualMachines: true,
      requireWebcam: true,
      identityVerification: true,
      lockdownBrowser: true
    },
    aiGeneration: {
      enabled: true,
      generationLevel: 'advanced',
      autoGenerateQuestions: true,
      difficultyAdaptation: true,
      personalization: true,
      topics: ['Advanced JavaScript', 'Algorithms', 'System Design', 'Optimization'],
      questionCount: 20,
      includeExplanation: false,
      includeHints: false,
      language: 'english',
      tone: 'technical',
      qualityCheck: true,
      plagiarismCheck: true
    },
    compiler: {
      enabled: true,
      language: 'javascript',
      version: 'ES6',
      timeLimit: 30,
      memoryLimit: 512,
      allowCopyPaste: false,
      allowImports: true,
      allowedImports: ['lodash'],
      autoComplete: false,
      syntaxHighlighting: true,
      runCode: true,
      debugMode: false
    },
    problems: {
      problemTypes: ['quiz', 'programming', 'text', 'file-upload'],
      totalQuestions: 10,
      pointsPerQuestion: 10,
      shuffleQuestions: true,
      showSolution: false,
      attemptsAllowed: 1,
      randomizeOptions: true,
      showExplanation: false,
      allowSkip: false,
      negativeMarking: true,
      negativeMarkingPercentage: 25,
      questionBankSize: 100,
      adaptiveTesting: true,
      questionTags: ['advanced', 'algorithms', 'performance']
    },
    time: {
      enabled: true,
      timeLimit: 90,
      allowPause: false,
      autoSubmit: true,
      showTimer: true,
      warningBeforeTimeUp: 10,
      gracePeriod: 0,
      timePerQuestion: false,
      strictTiming: true
    },
    evaluation: {
      enabled: true,
      evaluationTypes: ['teacher', 'testcase', 'ai'],
      teacherWeight: 40,
      testcaseWeight: 40,
      aiWeight: 20,
      selfWeight: 0,
      passingScore: 75,
      requireCodeSubmission: true,
      instantFeedback: false,
      showDetailedResults: true,
      allowRetake: true,
      maxRetakes: 2,
      peerReview: true,
      rubricBased: true,
      analyticsEnabled: true
    },
    accessibility: {
      enabled: true,
      highContrast: true,
      largeText: true,
      screenReader: true,
      keyboardNavigation: true,
      extraTime: true,
      extraTimePercentage: 50,
      colorBlindMode: true,
      dyslexiaFriendly: true,
      textToSpeech: true,
      speechToText: true
    }
  }
];

// Enhanced mock questions with detailed examples, constraints, and hints
const mockQuestions: Question[] = [
  {
    id: '1',
    type: 'programming',
    title: 'Two Sum',
    content: 'Given an array of integers `nums` and an integer `target`, return indices of the two numbers such that they add up to `target`.',
    description: 'You may assume that each input would have exactly one solution, and you may not use the same element twice. You can return the answer in any order.',
    examples: [
      {
        input: 'nums = [2,7,11,15], target = 9',
        output: '[0,1]',
        explanation: 'Because nums[0] + nums[1] == 9, we return [0, 1].'
      },
      {
        input: 'nums = [3,2,4], target = 6',
        output: '[1,2]',
        explanation: ''
      },
      {
        input: 'nums = [3,3], target = 6',
        output: '[0,1]',
        explanation: ''
      }
    ],
    constraints: [
      '2 <= nums.length <= 10^4',
      '-10^9 <= nums[i] <= 10^9',
      '-10^9 <= target <= 10^9',
      'Only one valid answer exists.'
    ],
    hints: [
      'A brute force solution would be to check every pair of numbers.',
      'Can you think of a way to solve it in less than O(n^2) time?',
      'Use a hash map to store numbers and their indices as you iterate.'
    ],
    points: 10,
    codeTemplate: `/**
 * @param {number[]} nums
 * @param {number} target
 * @return {number[]}
 */
var twoSum = function(nums, target) {
    // Your code here
    
};`,
    testCases: [
      { input: '[2,7,11,15], 9', expectedOutput: '[0,1]', isHidden: false },
      { input: '[3,2,4], 6', expectedOutput: '[1,2]', isHidden: false },
      { input: '[3,3], 6', expectedOutput: '[0,1]', isHidden: false },
      { input: '[1,2,3,4,5], 9', expectedOutput: '[3,4]', isHidden: true },
      { input: '[0,4,3,0], 0', expectedOutput: '[0,3]', isHidden: true }
    ],
    explanation: 'The optimal solution uses a hash map to store numbers and their indices. For each number, check if the complement (target - num) exists in the map.'
  },
  {
    id: '2',
    type: 'programming',
    title: 'Array Sum Function',
    content: 'Write a function called `sumArray` that takes an array of numbers and returns the sum of all numbers in the array.',
    description: 'Create a function that calculates the sum of all elements in a given array of numbers. Handle edge cases like empty arrays appropriately.',
    examples: [
      {
        input: '[1, 2, 3, 4, 5]',
        output: '15',
        explanation: 'The sum of numbers 1 through 5 is 15'
      },
      {
        input: '[-1, 0, 1]',
        output: '0',
        explanation: 'Negative and positive numbers cancel each other out'
      },
      {
        input: '[10, 20, 30, 40]',
        output: '100',
        explanation: 'Sum of multiples of 10'
      }
    ],
    constraints: [
      'The input array can contain both positive and negative numbers',
      'The array can be empty',
      'You cannot use built-in methods like Array.prototype.reduce()',
      'Time complexity should be O(n)',
      'Space complexity should be O(1)'
    ],
    hints: [
      'You can use a simple for loop to iterate through the array',
      'Initialize a variable to store the sum starting from 0',
      'Remember to handle the case when the array is empty',
      'Consider using let instead of var for block scoping'
    ],
    points: 20,
    codeTemplate: 'function sumArray(arr) {\n  // Your code here\n  \n}',
    testCases: [
      { input: '[1, 2, 3, 4, 5]', expectedOutput: '15', isHidden: false },
      { input: '[-1, 0, 1]', expectedOutput: '0', isHidden: false },
      { input: '[10, 20, 30, 40]', expectedOutput: '100', isHidden: true },
      { input: '[]', expectedOutput: '0', isHidden: false },
      { input: '[5]', expectedOutput: '5', isHidden: true }
    ],
    explanation: 'This function should iterate through the array and accumulate the sum of all elements. The solution should handle edge cases like empty arrays by returning 0.',
  },
  {
    id: '3',
    type: 'programming',
    title: 'Palindrome Checker',
    content: 'Write a function that checks if a given string is a palindrome. A palindrome is a word that reads the same backward as forward.',
    description: 'Implement a function that determines whether a string is a palindrome, considering case sensitivity and ignoring non-alphanumeric characters.',
    examples: [
      {
        input: '"racecar"',
        output: 'true',
        explanation: 'The string reads the same forwards and backwards'
      },
      {
        input: '"hello"',
        output: 'false',
        explanation: 'The string does not read the same backwards'
      },
      {
        input: '"A man a plan a canal Panama"',
        output: 'true',
        explanation: 'When ignoring spaces and case, this is a palindrome'
      }
    ],
    constraints: [
      'The input string may contain spaces and punctuation',
      'Consider case sensitivity based on the problem requirements',
      'The solution should handle empty strings',
      'Time complexity should be O(n)',
      'Space complexity should be O(1) if possible'
    ],
    hints: [
      'Consider converting the string to lowercase first',
      'You can use two pointers approach - one from start and one from end',
      'Think about how to handle non-alphanumeric characters',
      'Remember that empty strings are typically considered palindromes'
    ],
    points: 15,
    codeTemplate: 'function isPalindrome(str) {\n  // Your code here\n  \n}',
    testCases: [
      { input: '"racecar"', expectedOutput: 'true', isHidden: false },
      { input: '"hello"', expectedOutput: 'false', isHidden: false },
      { input: '"A man a plan a canal Panama"', expectedOutput: 'true', isHidden: true },
      { input: '""', expectedOutput: 'true', isHidden: false },
      { input: '"a"', expectedOutput: 'true', isHidden: true }
    ]
  },
  {
    id: '4',
    type: 'text',
    title: 'Explain Closures',
    content: 'Explain what closures are in JavaScript and provide a practical example of their use.',
    description: 'Describe the concept of closures in JavaScript, including how they work and common use cases in real-world applications.',
    examples: [
      {
        input: 'N/A',
        output: 'A closure is a function that retains access to variables from its outer scope even after the outer function has finished executing.',
        explanation: 'This is a fundamental concept in JavaScript for data encapsulation and private variables'
      }
    ],
    constraints: [
      'Your explanation should be clear and concise',
      'Include at least one code example',
      'Mention practical use cases',
      'Explain the scope chain concept'
    ],
    hints: [
      'Think about function scope and lexical environment',
      'Consider how closures help in creating private variables',
      'Remember the connection between inner functions and outer variables',
      'Mention common patterns like module pattern'
    ],
    points: 15,
    explanation: 'A closure is a function that has access to variables in its outer scope even after the outer function has returned. This allows for data encapsulation and private variables in JavaScript.'
  },
  {
    id: '5',
    type: 'file-upload',
    title: 'Project Submission',
    content: 'Upload your completed project files in a zip format. Make sure to include all source code and documentation.',
    description: 'Submit your complete project solution including all source files, configuration files, and documentation in a single zip archive.',
    constraints: [
      'File must be in ZIP format',
      'Maximum file size: 10MB',
      'Include all source code files',
      'Documentation should be in PDF or Markdown format',
      'Test cases should be included if applicable'
    ],
    hints: [
      'Make sure to include a README file',
      'Double-check that all dependencies are listed',
      'Verify that the project can be built and run',
      'Include comments in your code for clarity'
    ],
    points: 40
  },
  {
    id: '6',
    type: 'quiz',
    title: 'React Hooks',
    content: 'Which React hook is used to perform side effects in functional components?',
    description: 'This question tests your understanding of React hooks and their specific use cases.',
    options: ['useState', 'useEffect', 'useContext', 'useReducer', 'useMemo'],
    correctAnswer: 'useEffect',
    points: 10,
    explanation: 'useEffect is the hook used to perform side effects in functional components, such as data fetching, subscriptions, or manually changing the DOM.',
    hint: 'Think about which hook replaces lifecycle methods like componentDidMount and componentDidUpdate.',
    hints: [
      'useEffect runs after every render by default',
      'You can control when it runs by providing a dependency array',
      'It can return a cleanup function'
    ]
  },
  {
    id: '7',
    type: 'programming',
    title: 'Fibonacci Sequence',
    content: 'Write a function that returns the nth number in the Fibonacci sequence.',
    description: 'Implement a function that calculates the Fibonacci number at position n using an efficient approach.',
    examples: [
      {
        input: '5',
        output: '5',
        explanation: 'Fibonacci sequence: 0, 1, 1, 2, 3, 5'
      },
      {
        input: '8',
        output: '21',
        explanation: 'Fibonacci sequence continues: 8, 13, 21'
      }
    ],
    constraints: [
      'n will be a non-negative integer',
      'For n=0, return 0',
      'For n=1, return 1',
      'Optimize for time complexity',
      'Consider using memoization or iterative approach'
    ],
    hints: [
      'The Fibonacci sequence starts with 0 and 1',
      'Each subsequent number is the sum of the previous two',
      'Consider using an iterative approach for better performance',
      'You can use dynamic programming to optimize'
    ],
    points: 25,
    codeTemplate: 'function fibonacci(n) {\n  // Your code here\n  \n}',
    testCases: [
      { input: '0', expectedOutput: '0', isHidden: false },
      { input: '1', expectedOutput: '1', isHidden: false },
      { input: '5', expectedOutput: '5', isHidden: false },
      { input: '10', expectedOutput: '55', isHidden: true },
      { input: '15', expectedOutput: '610', isHidden: true }
    ]
  }
];

// ==============================
// Questions Modal Component
// ==============================

interface QuestionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  questions: Question[];
  currentQuestionIndex: number;
  onQuestionSelect: (index: number) => void;
  submittedQuestions: Set<string>;
  answers: Record<string, any>;
  darkMode: boolean;
}

const QuestionsModal: React.FC<QuestionsModalProps> = ({
  isOpen,
  onClose,
  questions,
  currentQuestionIndex,
  onQuestionSelect,
  submittedQuestions,
  answers,
  darkMode
}) => {
  if (!isOpen) return null;

  const getQuestionStatus = (question: Question) => {
    if (submittedQuestions.has(question.id)) {
      return { status: 'submitted', color: 'bg-emerald-500' };
    }
    if (answers[question.id]) {
      return { status: 'answered', color: 'bg-orange-500' };
    }
    return { status: 'unanswered', color: 'bg-slate-400' };
  };

  const getQuestionTypeIcon = (type: ProblemType) => {
    switch (type) {
      case 'quiz': return <CheckSquare className="w-4 h-4" />;
      case 'programming': return <Code className="w-4 h-4" />;
      case 'text': return <FileText className="w-4 h-4" />;
      case 'file-upload': return <Upload className="w-4 h-4" />;
      default: return <FileText className="w-4 h-4" />;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className={`rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden ${
        darkMode ? 'bg-slate-800 text-slate-100' : 'bg-white text-slate-900'
      } border ${darkMode ? 'border-slate-700' : 'border-slate-200'}`}>
        {/* Header */}
        <div className={`flex items-center justify-between p-6 border-b ${
          darkMode ? 'border-slate-700' : 'border-slate-200'
        }`}>
          <div className="flex items-center gap-3">
            <List className="w-6 h-6 text-orange-500" />
            <h2 className="text-xl font-bold">All Questions</h2>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
              darkMode ? 'bg-slate-700 text-slate-300' : 'bg-slate-100 text-slate-700'
            }`}>
              {questions.length} questions
            </span>
          </div>
          <button
            onClick={onClose}
            className={`p-2 rounded-lg transition-colors ${
              darkMode 
                ? 'hover:bg-slate-700 text-slate-400 hover:text-slate-300' 
                : 'hover:bg-slate-100 text-slate-500 hover:text-slate-700'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Questions List */}
        <div className="overflow-y-auto p-6" style={{ maxHeight: 'calc(90vh - 200px)' }}>
          <div className="grid gap-4">
            {questions.map((question, index) => {
              const status = getQuestionStatus(question);
              const isCurrent = index === currentQuestionIndex;
              
              return (
                <div
                  key={question.id}
                  className={`p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 ${
                    isCurrent
                      ? darkMode 
                        ? 'border-orange-500 bg-orange-500/10 shadow-lg' 
                        : 'border-orange-500 bg-orange-50 shadow-lg'
                      : darkMode
                      ? 'border-slate-700 bg-slate-800/50 hover:bg-slate-700/50 hover:border-slate-600'
                      : 'border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300'
                  }`}
                  onClick={() => {
                    onQuestionSelect(index);
                    onClose();
                  }}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold transition-colors ${
                        status.color
                      }`}>
                        {index + 1}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          {getQuestionTypeIcon(question.type)}
                          <h3 className="font-semibold text-base">{question.title}</h3>
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            darkMode ? 'bg-amber-500/20 text-amber-300' : 'bg-amber-100 text-amber-800'
                          }`}>
                            {question.points} pts
                          </span>
                        </div>
                        <p className={`text-sm mb-2 ${
                          darkMode ? 'text-slate-400' : 'text-slate-600'
                        }`}>
                          {question.content.length > 120 
                            ? question.content.substring(0, 120) + '...' 
                            : question.content
                          }
                        </p>
                        <div className="flex items-center gap-4 text-xs">
                          <span className={`flex items-center gap-1 ${
                            darkMode ? 'text-slate-500' : 'text-slate-500'
                          }`}>
                            <Code className="w-3 h-3" />
                            {question.type}
                          </span>
                          <span className={`flex items-center gap-1 ${
                            status.status === 'submitted' 
                              ? 'text-emerald-500' 
                              : status.status === 'answered'
                              ? 'text-orange-500'
                              : darkMode 
                              ? 'text-slate-500' 
                              : 'text-slate-400'
                          }`}>
                            <div className={`w-2 h-2 rounded-full ${status.color}`}></div>
                            {status.status === 'submitted' ? 'Submitted' :
                             status.status === 'answered' ? 'Answered' : 'Not Started'}
                          </span>
                        </div>
                      </div>
                    </div>
                    {isCurrent && (
                      <div className={`px-2 py-1 rounded text-xs font-medium ${
                        darkMode ? 'bg-orange-500 text-white' : 'bg-orange-500 text-white'
                      }`}>
                        Current
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className={`px-6 py-4 border-t ${
          darkMode ? 'border-slate-700 bg-slate-800/80' : 'border-slate-200 bg-slate-50'
        } flex justify-between items-center`}>
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
              <span className={darkMode ? 'text-slate-300' : 'text-slate-700'}>Submitted</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-orange-500"></div>
              <span className={darkMode ? 'text-slate-300' : 'text-slate-700'}>Answered</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-slate-400"></div>
              <span className={darkMode ? 'text-slate-300' : 'text-slate-700'}>Not Started</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              darkMode 
                ? 'bg-slate-700 hover:bg-slate-600 text-slate-300' 
                : 'bg-slate-200 hover:bg-slate-300 text-slate-700'
            }`}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

// ==============================
// Notes Modal Component
// ==============================

interface NotesModalProps {
  isOpen: boolean;
  onClose: () => void;
  question: Question;
  notes: Record<string, string>;
  onNoteChange: (questionId: string, note: string) => void;
  darkMode: boolean;
}

const NotesModal: React.FC<NotesModalProps> = ({
  isOpen,
  onClose,
  question,
  notes,
  onNoteChange,
  darkMode
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className={`rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden ${
        darkMode ? 'bg-slate-800 text-slate-100' : 'bg-white text-slate-900'
      } border ${darkMode ? 'border-slate-700' : 'border-slate-200'}`}>
        {/* Header */}
        <div className={`flex items-center justify-between p-6 border-b ${
          darkMode ? 'border-slate-700' : 'border-slate-200'
        }`}>
          <div className="flex items-center gap-3">
            <StickyNote className="w-6 h-6 text-amber-500" />
            <div>
              <h2 className="text-xl font-bold">Notes</h2>
              <p className={`text-sm ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                {question.title}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`p-2 rounded-lg transition-colors ${
              darkMode 
                ? 'hover:bg-slate-700 text-slate-400 hover:text-slate-300' 
                : 'hover:bg-slate-100 text-slate-500 hover:text-slate-700'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Notes Content */}
        <div className="p-6">
          <textarea
            value={notes[question.id] || ''}
            onChange={(e) => onNoteChange(question.id, e.target.value)}
            rows={12}
            className={`w-full p-4 border rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 resize-vertical text-sm transition-colors ${
              darkMode 
                ? 'bg-slate-700/50 border-slate-600 text-slate-100 placeholder-slate-500' 
                : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400'
            }`}
            placeholder="Add your personal notes for this question..."
          />
          <div className={`mt-3 text-sm ${
            darkMode ? 'text-slate-500' : 'text-slate-600'
          }`}>
            Notes are saved automatically and private to you.
          </div>
        </div>

        {/* Footer */}
        <div className={`px-6 py-4 border-t ${
          darkMode ? 'border-slate-700 bg-slate-800/80' : 'border-slate-200 bg-slate-50'
        } flex justify-end gap-3`}>
          <button
            onClick={onClose}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              darkMode 
                ? 'bg-slate-700 hover:bg-slate-600 text-slate-300' 
                : 'bg-slate-200 hover:bg-slate-300 text-slate-700'
            }`}
          >
            Cancel
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-amber-500 text-white rounded-lg font-medium hover:bg-amber-600 transition-colors shadow-lg shadow-amber-500/25"
          >
            Save Notes
          </button>
        </div>
      </div>
    </div>
  );
};

// ==============================
// Hints Modal Component
// ==============================

interface HintsModalProps {
  isOpen: boolean;
  onClose: () => void;
  question: Question;
  selectedElement: LearningElementSettings;
  darkMode: boolean;
}

const HintsModal: React.FC<HintsModalProps> = ({
  isOpen,
  onClose,
  question,
  selectedElement,
  darkMode
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className={`rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden ${
        darkMode ? 'bg-slate-800 text-slate-100' : 'bg-white text-slate-900'
      } border ${darkMode ? 'border-slate-700' : 'border-slate-200'}`}>
        {/* Header */}
        <div className={`flex items-center justify-between p-6 border-b ${
          darkMode ? 'border-slate-700' : 'border-slate-200'
        }`}>
          <div className="flex items-center gap-3">
            <Lightbulb className="w-6 h-6 text-amber-500" />
            <div>
              <h2 className="text-xl font-bold">Hints & Help</h2>
              <p className={`text-sm ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                {question.title}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`p-2 rounded-lg transition-colors ${
              darkMode 
                ? 'hover:bg-slate-700 text-slate-400 hover:text-slate-300' 
                : 'hover:bg-slate-100 text-slate-500 hover:text-slate-700'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Hints Content */}
        <div className="p-6 space-y-6">
          {/* AI Hint */}
          {selectedElement.aiGeneration.includeHints && question.hint && (
            <div className={`p-4 rounded-xl border ${
              darkMode ? 'bg-purple-500/10 border-purple-500/30' : 'bg-purple-50 border-purple-200'
            }`}>
              <div className="flex items-center gap-2 mb-2">
                <Brain className="w-5 h-5 text-purple-500" />
                <span className="font-semibold">AI Hint</span>
              </div>
              <p className={`text-sm ${darkMode ? 'text-purple-300' : 'text-purple-800'}`}>
                {question.hint}
              </p>
            </div>
          )}

          {/* Step-by-step Hints */}
          {question.hints && question.hints.length > 0 && (
            <div>
              <h3 className="font-semibold text-lg mb-3">Step-by-step hints:</h3>
              <div className="space-y-3">
                {question.hints.map((hint, index) => (
                  <div
                    key={index}
                    className={`p-3 rounded-xl border ${
                      darkMode ? 'bg-slate-700/50 border-slate-600' : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold ${
                        darkMode ? 'bg-orange-500 text-white' : 'bg-orange-500 text-white'
                      }`}>
                        {index + 1}
                      </span>
                      <span className="text-sm flex-1">{hint}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* AI Evaluation for Programming Questions */}
          {(selectedElement.type === 'self-assessment' || selectedElement.type === 'self-practice') && 
           question.type === 'programming' && (
            <div className={`p-4 rounded-xl border ${
              darkMode ? 'bg-slate-700/50 border-slate-600' : 'bg-slate-50 border-slate-200'
            }`}>
              <div className="flex items-center gap-2 mb-3">
                <Brain className="w-5 h-5 text-purple-500" />
                <span className="font-semibold">AI Code Analysis</span>
              </div>
              <div className="text-sm space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                  <span>Code Quality: Good structure and naming</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
                  <span>Time Complexity: O(n) - Optimal for this problem</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                  <span>Space Complexity: O(1) - Efficient memory usage</span>
                </div>
                <div className={`mt-3 p-2 rounded text-xs ${
                  darkMode ? 'bg-amber-500/20 text-amber-300' : 'bg-amber-100 text-amber-800'
                }`}>
                  💡 AI suggests: Consider edge cases for empty input and large numbers
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={`px-6 py-4 border-t ${
          darkMode ? 'border-slate-700 bg-slate-800/80' : 'border-slate-200 bg-slate-50'
        } flex justify-end`}>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition-colors shadow-lg shadow-orange-500/25"
          >
            Got It
          </button>
        </div>
      </div>
    </div>
  );
};

// ==============================
// Learning Element Selector
// ==============================

interface ElementSelectorProps {
  onElementSelect: (element: LearningElementSettings) => void;
  darkMode: boolean;
}

const ElementSelector: React.FC<ElementSelectorProps> = ({ onElementSelect, darkMode }) => {
  return (
    <div className={`min-h-screen transition-colors duration-300 ${
      darkMode 
        ? 'bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-slate-100' 
        : 'bg-gradient-to-br from-orange-50 via-indigo-50 to-purple-50 text-slate-900'
    }`}>
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Code className="w-8 h-8 text-orange-500" />
            <h1 className="text-4xl font-bold bg-gradient-to-r from-orange-600 to-purple-600 bg-clip-text text-transparent">
              CodeLearning IDE
            </h1>
          </div>
          <p className={`text-lg max-w-2xl mx-auto ${
            darkMode ? 'text-slate-400' : 'text-slate-600'
          }`}>
            Choose your learning mode and start coding with AI-powered assistance
          </p>
        </div>

        {/* Learning Elements Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {defaultLearningElements.map((element) => {
            const Icon = element.icon;
            return (
              <div
                key={element.id}
                className={`group cursor-pointer transition-all duration-300 transform hover:scale-105 ${
                  darkMode 
                    ? 'bg-slate-800/50 hover:bg-slate-700/50 border-slate-700 backdrop-blur-sm' 
                    : 'bg-white/80 hover:bg-white border-slate-200 backdrop-blur-sm'
                } border rounded-2xl p-6 shadow-xl hover:shadow-2xl`}
                onClick={() => onElementSelect(element)}
              >
                {/* Header */}
                <div className="flex items-center gap-4 mb-4">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-200 shadow-lg"
                    style={{ backgroundColor: element.color }}
                  >
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-bold">{element.name}</h3>
                    <p className={`text-sm ${
                      darkMode ? 'text-slate-400' : 'text-slate-600'
                    }`}>
                      {element.description}
                    </p>
                  </div>
                  <ArrowRight className={`w-5 h-5 ${
                    darkMode ? 'text-slate-500' : 'text-slate-400'
                  } group-hover:text-orange-500 transition-colors`} />
                </div>

                {/* Features */}
                <div className="space-y-3">
                  {/* Security Features */}
                  {element.security.enabled && (
                    <div className="flex items-center gap-2 text-sm">
                      <Shield className="w-4 h-4 text-red-500" />
                      <span className={darkMode ? 'text-slate-300' : 'text-slate-700'}>
                        Secure Proctoring
                      </span>
                    </div>
                  )}

                  {/* AI Features */}
                  {element.aiGeneration.enabled && (
                    <div className="flex items-center gap-2 text-sm">
                      <Brain className="w-4 h-4 text-purple-500" />
                      <span className={darkMode ? 'text-slate-300' : 'text-slate-700'}>
                        AI {element.aiGeneration.generationLevel}
                      </span>
                    </div>
                  )}

                  {/* Time Features */}
                  {element.time.enabled && (
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="w-4 h-4 text-amber-500" />
                      <span className={darkMode ? 'text-slate-300' : 'text-slate-700'}>
                        {element.time.timeLimit} min limit
                      </span>
                    </div>
                  )}

                  {/* Compiler Features */}
                  {element.compiler.enabled && (
                    <div className="flex items-center gap-2 text-sm">
                      <Code className="w-4 h-4 text-emerald-500" />
                      <span className={darkMode ? 'text-slate-300' : 'text-slate-700'}>
                        {element.compiler.language} Compiler
                      </span>
                    </div>
                  )}

                  {/* Evaluation Features */}
                  {element.evaluation.enabled && (
                    <div className="flex items-center gap-2 text-sm">
                      <Target className="w-4 h-4 text-orange-500" />
                      <span className={darkMode ? 'text-slate-300' : 'text-slate-700'}>
                        {element.evaluation.passingScore}% to pass
                      </span>
                    </div>
                  )}
                </div>

                {/* Stats */}
                <div className={`flex justify-between items-center mt-4 pt-4 border-t ${
                  darkMode ? 'border-slate-700' : 'border-slate-200'
                }`}>
                  <div className="text-center">
                    <div className="font-bold text-lg">{element.problems.totalQuestions}</div>
                    <div className={`text-xs ${darkMode ? 'text-slate-500' : 'text-slate-600'}`}>
                      Questions
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="font-bold text-lg">
                      {element.problems.attemptsAllowed === 0 ? '∞' : element.problems.attemptsAllowed}
                    </div>
                    <div className={`text-xs ${darkMode ? 'text-slate-500' : 'text-slate-600'}`}>
                      Attempts
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="font-bold text-lg">
                      {element.problems.pointsPerQuestion * element.problems.totalQuestions}
                    </div>
                    <div className={`text-xs ${darkMode ? 'text-slate-500' : 'text-slate-600'}`}>
                      Total Points
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer Info */}
        <div className={`text-center mt-12 max-w-2xl mx-auto ${
          darkMode ? 'text-slate-500' : 'text-slate-600'
        }`}>
          <p className="text-sm">
            Each learning mode provides different features and restrictions tailored for specific learning goals
          </p>
        </div>
      </div>
    </div>
  );
};

// ==============================
// Pagination Component
// ==============================

interface PaginationProps {
  currentQuestionIndex: number;
  totalQuestions: number;
  onQuestionChange: (index: number) => void;
  submittedQuestions: Set<string>;
  answers: Record<string, any>;
  darkMode: boolean;
  onShowQuestionsModal: () => void;
}

const Pagination: React.FC<PaginationProps> = ({
  currentQuestionIndex,
  totalQuestions,
  onQuestionChange,
  submittedQuestions,
  answers,
  darkMode,
  onShowQuestionsModal
}) => {
  const getQuestionStatus = (index: number) => {
    const questionId = mockQuestions[index]?.id;
    if (!questionId) return 'unanswered';
    
    if (submittedQuestions.has(questionId)) {
      return 'submitted';
    }
    if (answers[questionId]) {
      return 'answered';
    }
    return 'unanswered';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'submitted': return 'bg-emerald-500';
      case 'answered': return 'bg-orange-500';
      default: return 'bg-slate-400';
    }
  };

  return (
    <div className={`p-4 border-b ${
      darkMode ? 'border-slate-700' : 'border-slate-200'
    }`}>
      {/* Simplified Pagination Controls */}
      <div className="flex items-center justify-between">
        <button
          onClick={onShowQuestionsModal}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors shadow-lg ${
            darkMode 
              ? 'bg-orange-500 hover:bg-orange-600 text-white shadow-orange-500/25' 
              : 'bg-orange-500 hover:bg-orange-600 text-white shadow-orange-500/25'
          }`}
        >
          <List className="w-4 h-4" />
          Questions
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onQuestionChange(currentQuestionIndex - 1)}
            disabled={currentQuestionIndex === 0}
            className={`p-2 rounded-lg transition-colors ${
              currentQuestionIndex === 0
                ? 'opacity-50 cursor-not-allowed'
                : darkMode
                ? 'bg-slate-700 hover:bg-slate-600 text-slate-300'
                : 'bg-slate-200 hover:bg-slate-300 text-slate-700'
            }`}
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <span className={`text-sm font-medium px-3 ${
            darkMode ? 'text-slate-300' : 'text-slate-700'
          }`}>
            {currentQuestionIndex + 1} / {totalQuestions}
          </span>

          <button
            onClick={() => onQuestionChange(currentQuestionIndex + 1)}
            disabled={currentQuestionIndex === totalQuestions - 1}
            className={`p-2 rounded-lg transition-colors ${
              currentQuestionIndex === totalQuestions - 1
                ? 'opacity-50 cursor-not-allowed'
                : darkMode
                ? 'bg-slate-700 hover:bg-slate-600 text-slate-300'
                : 'bg-slate-200 hover:bg-slate-300 text-slate-700'
            }`}
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};

// ==============================
// Main IDE Component
// ==============================

interface LearningIDEProps {
  selectedElement: LearningElementSettings;
  onBack: () => void;
  darkMode: boolean;
  toggleDarkMode: () => void;
}

const LearningIDE: React.FC<LearningIDEProps> = ({ 
  selectedElement, 
  onBack, 
  darkMode, 
  toggleDarkMode 
}) => {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [code, setCode] = useState<string>('');
  const [output, setOutput] = useState<string>('');
  const [isRunning, setIsRunning] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(selectedElement.time.enabled ? selectedElement.time.timeLimit * 60 : 0);
  const [isPaused, setIsPaused] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [showSecurityWarning, setShowSecurityWarning] = useState(true);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [submittedQuestions, setSubmittedQuestions] = useState<Set<string>>(new Set());
  const [testResults, setTestResults] = useState<TestCase[]>([]);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showOutputPanel, setShowOutputPanel] = useState(false);
  const [showExamples, setShowExamples] = useState(true);
  const [showConstraints, setShowConstraints] = useState(true);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [showQuestionsModal, setShowQuestionsModal] = useState(false);
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [showHintsModal, setShowHintsModal] = useState(false);

  const currentQuestion = mockQuestions[currentQuestionIndex];
  const questions = mockQuestions.slice(0, selectedElement.problems.totalQuestions);

  // Initialize code from template
  useEffect(() => {
    if (currentQuestion?.codeTemplate) {
      setCode(currentQuestion.codeTemplate);
    }
  }, [currentQuestion]);

  // Timer effect
  useEffect(() => {
    if (!selectedElement.time.enabled || isPaused || timeRemaining <= 0) return;

    const timer = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          if (selectedElement.time.autoSubmit) {
            handleSubmitAssessment();
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [selectedElement.time.enabled, isPaused, timeRemaining]);

  // Security restrictions
  useEffect(() => {
    if (selectedElement.security.enabled) {
      const handleContextMenu = (e: Event) => e.preventDefault();
      const handleKeyDown = (e: KeyboardEvent) => {
        if (selectedElement.security.disablePrintScreen && (e.key === 'PrintScreen' || (e.ctrlKey && e.key === 'p'))) {
          e.preventDefault();
        }
        if (selectedElement.security.disableCopyPaste && (e.ctrlKey && (e.key === 'c' || e.key === 'v'))) {
          e.preventDefault();
        }
      };

      const handleVisibilityChange = () => {
        if (document.hidden && selectedElement.security.allowTabSwitch === false) {
          alert('Tab switching is not allowed!');
        }
      };

      document.addEventListener('contextmenu', handleContextMenu);
      document.addEventListener('keydown', handleKeyDown);
      document.addEventListener('visibilitychange', handleVisibilityChange);

      return () => {
        document.removeEventListener('contextmenu', handleContextMenu);
        document.removeEventListener('keydown', handleKeyDown);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      };
    }
  }, [selectedElement.security.enabled]);

  // Full screen handler
  useEffect(() => {
    const handleFullScreenChange = () => {
      setIsFullScreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullScreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullScreenChange);
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleRunCode = async () => {
    if (!selectedElement.compiler.enabled) return;
    
    setIsRunning(true);
    setOutput('🚀 Running code...\n\n');
    setShowOutputPanel(true);
    
    // Simulate code execution with test cases
    setTimeout(() => {
      const results: TestCase[] = currentQuestion.testCases?.map((testCase, index) => {
        let actualOutput = '';
        let passed = false;

        // Simulate different outputs based on test case
        if (currentQuestion.id === '1') { // Two Sum
          if (testCase.input === '[2,7,11,15], 9') {
            actualOutput = '[0,1]';
            passed = true;
          } else if (testCase.input === '[3,2,4], 6') {
            actualOutput = '[1,2]';
            passed = true;
          } else if (testCase.input === '[3,3], 6') {
            actualOutput = '[0,1]';
            passed = true;
          } else {
            actualOutput = Math.random() > 0.3 ? '[3,4]' : '[0,3]';
            passed = actualOutput === testCase.expectedOutput;
          }
        } else if (currentQuestion.id === '2') { // Array Sum
          if (testCase.input === '[1, 2, 3, 4, 5]') {
            actualOutput = '15';
            passed = true;
          } else if (testCase.input === '[-1, 0, 1]') {
            actualOutput = '0';
            passed = true;
          } else if (testCase.input === '[]') {
            actualOutput = '0';
            passed = true;
          } else {
            actualOutput = Math.random() > 0.5 ? '100' : 'error';
            passed = actualOutput === testCase.expectedOutput;
          }
        } else if (currentQuestion.id === '3') { // Palindrome
          if (testCase.input === '"racecar"') {
            actualOutput = 'true';
            passed = true;
          } else if (testCase.input === '"hello"') {
            actualOutput = 'false';
            passed = true;
          } else {
            actualOutput = Math.random() > 0.5 ? 'true' : 'false';
            passed = actualOutput === testCase.expectedOutput;
          }
        } else if (currentQuestion.id === '7') { // Fibonacci
          if (testCase.input === '0') {
            actualOutput = '0';
            passed = true;
          } else if (testCase.input === '1') {
            actualOutput = '1';
            passed = true;
          } else if (testCase.input === '5') {
            actualOutput = '5';
            passed = true;
          } else {
            actualOutput = Math.random() > 0.5 ? '55' : '610';
            passed = actualOutput === testCase.expectedOutput;
          }
        }

        return {
          ...testCase,
          actualOutput,
          passed
        };
      }) || [];
      
      setTestResults(results);
      
      const passedCount = results.filter(t => t.passed).length;
      const totalCount = results.length;
      const hiddenCount = results.filter(t => t.isHidden).length;
      
      setOutput(prev => prev + 
        `✅ Tests completed: ${passedCount}/${totalCount} passed\n` +
        `📊 Hidden tests: ${hiddenCount}\n` +
        `🎯 Score: ${Math.round((passedCount / totalCount) * currentQuestion.points)}/${currentQuestion.points}\n\n` +
        `Detailed Results:\n${results.map((test, index) => 
          `Test ${index + 1} ${test.isHidden ? '(Hidden)' : ''}: ${test.passed ? '✅ PASS' : '❌ FAIL'}\n` +
          (test.isHidden ? '' : `  Input: ${test.input}\n  Expected: ${test.expectedOutput}\n  Received: ${test.actualOutput}\n`)
        ).join('\n')}`
      );
      setIsRunning(false);
    }, 2000);
  };

  const handleSubmitQuestion = () => {
    if (currentQuestion.type === 'programming') {
      setSubmittedQuestions(prev => new Set(prev).add(currentQuestion.id));
    }
    
    if (selectedElement.evaluation.instantFeedback && currentQuestion.explanation) {
      setOutput(prev => prev + `\n\n💡 Explanation: ${currentQuestion.explanation}`);
    }
    
    alert(`✅ Question ${currentQuestionIndex + 1} submitted successfully!`);
  };

  const handleSubmitAssessment = () => {
    const submittedCount = submittedQuestions.size;
    const totalCount = questions.filter(q => q.type === 'programming').length;
    
    alert(`📝 Assessment submitted! ${submittedCount}/${totalCount} programming questions completed.`);
  };

  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };

  const togglePause = () => {
    if (selectedElement.time.allowPause) {
      setIsPaused(!isPaused);
    }
  };

  const handleAnswerChange = (questionId: string, answer: any) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: answer
    }));
  };

  const handleNoteChange = (questionId: string, note: string) => {
    setNotes(prev => ({
      ...prev,
      [questionId]: note
    }));
  };

  const getLanguageForEditor = () => {
    switch (selectedElement.compiler.language) {
      case 'javascript': return 'javascript';
      case 'python': return 'python';
      case 'java': return 'java';
      case 'cpp': return 'cpp';
      case 'sql': return 'sql';
      default: return 'javascript';
    }
  };

  const toggleSidebar = () => {
    setSidebarCollapsed(!sidebarCollapsed);
  };

  const handleQuestionChange = (index: number) => {
    if (index >= 0 && index < questions.length) {
      setCurrentQuestionIndex(index);
    }
  };

  return (
    <div className={`h-screen flex flex-col transition-colors duration-300 ${
      darkMode 
        ? 'bg-gradient-to-br from-slate-900 to-slate-800 text-slate-100' 
        : 'bg-gradient-to-br from-slate-50 to-orange-50 text-slate-900'
    }`}>
      
      {/* Security Warning */}
      {selectedElement.security.enabled && showSecurityWarning && (
        <div className="fixed inset-0 bg-red-600 text-white z-50 flex items-center justify-center p-4">
          <div className="max-w-2xl text-center">
            <Shield className="w-16 h-16 mx-auto mb-4" />
            <h2 className="text-3xl font-bold mb-4">Security Restrictions Active</h2>
            <div className="grid grid-cols-2 gap-4 mb-6 text-left">
              {selectedElement.security.screenCapture && (
                <div className="flex items-center gap-2">
                  <Monitor className="w-5 h-5" />
                  <span>Screen Capture Monitoring</span>
                </div>
              )}
              {selectedElement.security.requireWebcam && (
                <div className="flex items-center gap-2">
                  <Camera className="w-5 h-5" />
                  <span>Webcam Required</span>
                </div>
              )}
              {!selectedElement.security.allowTabSwitch && (
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5" />
                  <span>Tab Switching Blocked</span>
                </div>
              )}
              {selectedElement.security.disableCopyPaste && (
                <div className="flex items-center gap-2">
                  <Copy className="w-5 h-5" />
                  <span>Copy/Paste Disabled</span>
                </div>
              )}
            </div>
            <button
              onClick={() => setShowSecurityWarning(false)}
              className="bg-white text-red-600 px-8 py-3 rounded-lg font-semibold text-lg hover:bg-gray-100 transition-colors"
            >
              Start Assessment
            </button>
          </div>
        </div>
      )}

      {/* Watermark */}
      {selectedElement.security.watermarkEnabled && (
        <div className="fixed inset-0 pointer-events-none z-40">
          <div className="absolute inset-0 opacity-10 flex items-center justify-center">
            <div className="text-6xl font-bold text-slate-600 rotate-45 transform">
              {selectedElement.security.watermarkText}
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      <QuestionsModal
        isOpen={showQuestionsModal}
        onClose={() => setShowQuestionsModal(false)}
        questions={questions}
        currentQuestionIndex={currentQuestionIndex}
        onQuestionSelect={setCurrentQuestionIndex}
        submittedQuestions={submittedQuestions}
        answers={answers}
        darkMode={darkMode}
      />

      <NotesModal
        isOpen={showNotesModal}
        onClose={() => setShowNotesModal(false)}
        question={currentQuestion}
        notes={notes}
        onNoteChange={handleNoteChange}
        darkMode={darkMode}
      />

      <HintsModal
        isOpen={showHintsModal}
        onClose={() => setShowHintsModal(false)}
        question={currentQuestion}
        selectedElement={selectedElement}
        darkMode={darkMode}
      />

      {/* Header */}
      <header className={`border-b transition-colors duration-300 backdrop-blur-sm ${
        darkMode 
          ? 'bg-slate-800/80 border-slate-700 text-slate-100' 
          : 'bg-white/80 border-slate-200 text-slate-900'
      } px-4 py-3 flex items-center justify-between`}>
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className={`p-2 rounded-lg transition-colors ${
              darkMode 
                ? 'hover:bg-slate-700 text-slate-400 hover:text-slate-300' 
                : 'hover:bg-slate-100 text-slate-500 hover:text-slate-700'
            }`}
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center shadow-lg"
              style={{ backgroundColor: selectedElement.color }}
            >
              <selectedElement.icon className="w-4 h-4 text-white" />
            </div>
            <span className="font-semibold text-lg">{selectedElement.name}</span>
          </div>
          
          <div className={`flex items-center gap-2 text-sm ${
            darkMode ? 'text-slate-400' : 'text-slate-600'
          }`}>
            <Code className="w-4 h-4" />
            <span>{selectedElement.compiler.language.toUpperCase()}</span>
          </div>

          {/* AI Status */}
          {selectedElement.aiGeneration.enabled && (
            <div className={`flex items-center gap-2 text-sm px-2 py-1 rounded ${
              darkMode ? 'bg-purple-500/20 text-purple-300' : 'bg-purple-100 text-purple-700'
            }`}>
              <Brain className="w-4 h-4" />
              <span>AI</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* Action Buttons */}
          <div className="flex items-center gap-2">
           

            <button
              onClick={() => setShowNotesModal(true)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors shadow-lg ${
                darkMode 
                  ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-amber-500/25' 
                  : 'bg-amber-500 hover:bg-amber-600 text-white shadow-amber-500/25'
              }`}
            >
              <StickyNote className="w-4 h-4" />
              Notes
            </button>

            <button
              onClick={() => setShowHintsModal(true)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors shadow-lg ${
                darkMode 
                  ? 'bg-purple-500 hover:bg-purple-600 text-white shadow-purple-500/25' 
                  : 'bg-purple-500 hover:bg-purple-600 text-white shadow-purple-500/25'
              }`}
            >
              <Lightbulb className="w-4 h-4" />
              Hints
            </button>
          </div>

          {/* Timer */}
          {selectedElement.time.enabled && selectedElement.time.showTimer && (
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium shadow-lg transition-colors ${
              timeRemaining < 300 
                ? darkMode 
                  ? 'bg-red-500 text-white shadow-red-500/25' 
                  : 'bg-red-500 text-white shadow-red-500/25'
                : darkMode 
                ? 'bg-orange-500 text-white shadow-orange-500/25' 
                : 'bg-orange-500 text-white shadow-orange-500/25'
            }`}>
              <Clock className="w-4 h-4" />
              <span className="font-mono font-bold">{formatTime(timeRemaining)}</span>
              {selectedElement.time.allowPause && (
                <button
                  onClick={togglePause}
                  className="hover:opacity-70 ml-1 transition-opacity"
                >
                  {isPaused ? <Play className="w-4 h-4" /> : <X className="w-4 h-4" />}
                </button>
              )}
            </div>
          )}

          {/* Security Indicators */}
          {selectedElement.security.enabled && (
            <div className="flex items-center gap-2">
              {selectedElement.security.requireWebcam && (
                <Camera className="w-5 h-5 text-emerald-400" title="Webcam Active" />
              )}
              <Shield className="w-5 h-5 text-amber-400" title="Security Enabled" />
            </div>
          )}

          {/* Fullscreen Toggle */}
          {selectedElement.security.fullScreenRequired && (
            <button
              onClick={toggleFullScreen}
              className={`p-2 rounded-lg transition-colors ${
                darkMode 
                  ? 'hover:bg-slate-700 text-slate-400 hover:text-slate-300' 
                  : 'hover:bg-slate-200 text-slate-500 hover:text-slate-700'
              }`}
            >
              {isFullScreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
            </button>
          )}

          {/* Run Code Icon */}
          {currentQuestion.type === 'programming' && (
            <button
              onClick={handleRunCode}
              disabled={isRunning}
              className={`p-2 rounded-lg transition-colors ${
                isRunning
                  ? 'opacity-50 cursor-not-allowed'
                  : darkMode
                  ? 'hover:bg-slate-700 text-emerald-400 hover:text-emerald-300'
                  : 'hover:bg-slate-200 text-emerald-600 hover:text-emerald-700'
              }`}
              title="Run Code"
            >
              <Play className="w-5 h-5" />
            </button>
          )}

          {/* Theme Toggle */}
          <button
            onClick={toggleDarkMode}
            className={`p-2 rounded-lg transition-colors ${
              darkMode 
                ? 'hover:bg-slate-700 text-amber-400 hover:text-amber-300' 
                : 'hover:bg-slate-200 text-slate-700 hover:text-slate-900'
            }`}
          >
            {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Question & Navigation */}
        <div 
          className={`flex flex-col transition-all duration-300 backdrop-blur-sm ${
            darkMode 
              ? 'bg-slate-800/80 border-slate-700 text-slate-100' 
              : 'bg-white/80 border-slate-200 text-slate-900'
          } border-r`}
          style={{ width: sidebarCollapsed ? '0px' : '40%', minWidth: sidebarCollapsed ? '0px' : '400px' }}
        >
          {!sidebarCollapsed && (
            <>
              {/* Pagination Component */}
              <Pagination
                currentQuestionIndex={currentQuestionIndex}
                totalQuestions={questions.length}
                onQuestionChange={handleQuestionChange}
                submittedQuestions={submittedQuestions}
                answers={answers}
                darkMode={darkMode}
                onShowQuestionsModal={() => setShowQuestionsModal(true)}
              />

              {/* Current Question Content */}
              <div className="flex-1 overflow-y-auto p-6">
                {/* Question Header */}
                <div className="mb-6">
                  <div className="flex items-center gap-3 mb-3">
                    <h2 className="text-2xl font-bold">{currentQuestion.title}</h2>
                    <span className={`text-sm px-2.5 py-1 rounded font-medium ${
                      darkMode ? 'bg-amber-500/20 text-amber-300' : 'bg-amber-100 text-amber-800'
                    }`}>
                      {currentQuestion.points} pts
                    </span>
                  </div>
                  
                  {selectedElement.problems.negativeMarking && (
                    <div className={`text-sm mb-3 flex items-center gap-2 ${
                      darkMode ? 'text-red-400' : 'text-red-600'
                    }`}>
                      <AlertTriangle className="w-4 h-4" />
                      -{selectedElement.problems.negativeMarkingPercentage}% for wrong answer
                    </div>
                  )}

                  <div className={`text-base mb-4 leading-relaxed ${
                    darkMode ? 'text-slate-300' : 'text-slate-700'
                  }`}>
                    {currentQuestion.content}
                  </div>

                  {/* Description */}
                  {currentQuestion.description && (
                    <div className={`text-sm mb-5 p-3 rounded-xl ${
                      darkMode ? 'bg-slate-700/50 text-slate-300' : 'bg-orange-50 text-orange-800'
                    }`}>
                      <strong>💡 Description:</strong> {currentQuestion.description}
                    </div>
                  )}
                </div>

                {/* Examples Section */}
                {currentQuestion.examples && currentQuestion.examples.length > 0 && (
                  <div className="mb-6">
                    <button
                      onClick={() => setShowExamples(!showExamples)}
                      className="flex items-center gap-2 w-full text-left mb-3"
                    >
                      <ChevronRight className={`w-5 h-5 transition-transform ${showExamples ? 'rotate-90' : ''}`} />
                      <span className="font-semibold text-lg">Examples</span>
                    </button>
                    
                    {showExamples && (
                      <div className="space-y-4 ml-4">
                        {currentQuestion.examples.map((example, index) => (
                          <div
                            key={index}
                            className={`p-4 rounded-xl border ${
                              darkMode ? 'bg-slate-700/50 border-slate-600' : 'bg-slate-50 border-slate-200'
                            }`}
                          >
                            <div className="space-y-2">
                              <div className="font-mono text-sm">
                                <strong>Input:</strong> {example.input}
                              </div>
                              <div className="font-mono text-sm">
                                <strong>Output:</strong> {example.output}
                              </div>
                              {example.explanation && (
                                <div className="text-sm">
                                  <strong>Explanation:</strong> {example.explanation}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Constraints Section */}
                {currentQuestion.constraints && currentQuestion.constraints.length > 0 && (
                  <div className="mb-6">
                    <button
                      onClick={() => setShowConstraints(!showConstraints)}
                      className="flex items-center gap-2 w-full text-left mb-3"
                    >
                      <ChevronRight className={`w-5 h-5 transition-transform ${showConstraints ? 'rotate-90' : ''}`} />
                      <span className="font-semibold text-lg">Constraints</span>
                    </button>
                    
                    {showConstraints && (
                      <ul className={`ml-4 space-y-2 text-sm ${
                        darkMode ? 'text-slate-300' : 'text-slate-700'
                      }`}>
                        {currentQuestion.constraints.map((constraint, index) => (
                          <li key={index} className="flex items-start gap-2">
                            <span className="text-red-500 mt-0.5">•</span>
                            <span className="font-mono">{constraint}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}

                {/* Multiple Choice Options */}
                {currentQuestion.type === 'quiz' && currentQuestion.options && (
                  <div className="space-y-3 mt-4">
                    <h4 className="font-semibold text-lg mb-3">Select your answer:</h4>
                    {currentQuestion.options.map((option, index) => (
                      <label
                        key={index}
                        className={`flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-colors ${
                          answers[currentQuestion.id] === option
                            ? darkMode 
                              ? 'bg-orange-500/20 border-orange-500' 
                              : 'bg-orange-50 border-orange-500'
                            : darkMode
                            ? 'bg-slate-700/50 border-slate-600 hover:bg-slate-600/50'
                            : 'bg-slate-50 border-slate-300 hover:bg-slate-100'
                        }`}
                      >
                        <input
                          type="radio"
                          name={`question-${currentQuestion.id}`}
                          value={option}
                          checked={answers[currentQuestion.id] === option}
                          onChange={(e) => handleAnswerChange(currentQuestion.id, e.target.value)}
                          className="text-orange-600 focus:ring-orange-500"
                        />
                        <span className="text-sm flex-1">{option}</span>
                      </label>
                    ))}
                  </div>
                )}

                {/* Text Answer */}
                {currentQuestion.type === 'text' && (
                  <div className="mt-4">
                    <h4 className="font-semibold text-lg mb-3">Your answer:</h4>
                    <textarea
                      value={answers[currentQuestion.id] || ''}
                      onChange={(e) => handleAnswerChange(currentQuestion.id, e.target.value)}
                      rows={6}
                      className={`w-full p-4 border rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 resize-vertical text-sm transition-colors ${
                        darkMode 
                          ? 'bg-slate-700/50 border-slate-600 text-slate-100 placeholder-slate-500' 
                          : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400'
                      }`}
                      placeholder="Type your detailed answer here..."
                    />
                  </div>
                )}

                {/* File Upload */}
                {currentQuestion.type === 'file-upload' && (
                  <div className="mt-4">
                    <h4 className="font-semibold text-lg mb-3">Upload your solution:</h4>
                    <div className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors ${
                      darkMode 
                        ? 'border-slate-600 hover:border-slate-500' 
                        : 'border-slate-300 hover:border-slate-400'
                    }`}>
                      <Upload className="w-8 h-8 text-slate-400 mx-auto mb-3" />
                      <p className={`text-sm mb-4 ${
                        darkMode ? 'text-slate-400' : 'text-slate-600'
                      }`}>
                        Drag and drop your file here, or click to browse
                      </p>
                      <input
                        type="file"
                        className="hidden"
                        id="file-upload"
                        onChange={(e) => handleAnswerChange(currentQuestion.id, e.target.files?.[0])}
                      />
                      <label
                        htmlFor="file-upload"
                        className="inline-block px-4 py-2 bg-orange-500 text-white rounded-lg text-sm hover:bg-orange-600 cursor-pointer transition-colors shadow-lg shadow-orange-500/25"
                      >
                        Choose File
                      </label>
                      {answers[currentQuestion.id] && (
                        <p className={`mt-3 text-sm ${
                          darkMode ? 'text-emerald-400' : 'text-emerald-600'
                        }`}>
                          ✅ File selected: {(answers[currentQuestion.id] as File).name}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Test Cases Results */}
                {testResults.length > 0 && (
                  <div className="mt-6">
                    <h4 className="font-semibold text-lg mb-3">Test Results:</h4>
                    <div className="space-y-3">
                      {testResults.map((test, index) => (
                        <div
                          key={index}
                          className={`p-3 rounded-xl text-sm ${
                            test.passed 
                              ? darkMode 
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' 
                                : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                              : darkMode
                              ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                              : 'bg-red-50 text-red-800 border border-red-200'
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-2">
                            {test.passed ? 
                              <CheckSquare className="w-4 h-4" /> : 
                              <Square className="w-4 h-4" />
                            }
                            <span>Test {index + 1}{test.isHidden ? ' (Hidden)' : ''}</span>
                            <span className={`ml-auto text-sm font-medium ${
                              test.passed ? '' : ''
                            }`}>
                              {test.passed ? 'PASS' : 'FAIL'}
                            </span>
                          </div>
                          {!test.isHidden && (
                            <div className={`mt-1 text-xs font-mono space-y-1 ${
                              darkMode ? 'opacity-80' : 'opacity-90'
                            }`}>
                              <div>Input: {test.input}</div>
                              <div>Expected: {test.expectedOutput}</div>
                              {test.actualOutput && <div>Received: {test.actualOutput}</div>}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Center Panel - Code Editor */}
        <div className="flex-1 flex flex-col" style={{ width: sidebarCollapsed ? '100%' : '60%' }}>
          {/* Editor Header */}
          <div className={`border-b transition-colors duration-300 backdrop-blur-sm ${
            darkMode 
              ? 'bg-slate-800/80 border-slate-700 text-slate-100' 
              : 'bg-white/80 border-slate-200 text-slate-900'
          } px-4 py-3 flex items-center justify-between`}>
            <div className="flex items-center gap-4">
              <button
                onClick={toggleSidebar}
                className={`p-2 rounded-lg transition-colors ${
                  darkMode 
                    ? 'hover:bg-slate-700 text-slate-400 hover:text-slate-300' 
                    : 'hover:bg-slate-200 text-slate-500 hover:text-slate-700'
                }`}
                title={sidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
              >
                {sidebarCollapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
              </button>
              <span className="font-mono text-sm font-semibold">{currentQuestion.title}</span>
              <div className={`flex items-center gap-2 text-xs ${
                darkMode ? 'text-slate-400' : 'text-slate-600'
              }`}>
                {selectedElement.compiler.autoComplete && (
                  <span className={`px-2 py-1 rounded font-medium ${
                    darkMode ? 'bg-emerald-500/20 text-emerald-300' : 'bg-emerald-100 text-emerald-800'
                  }`}>Auto-complete</span>
                )}
                {selectedElement.compiler.syntaxHighlighting && (
                  <span className={`px-2 py-1 rounded font-medium ${
                    darkMode ? 'bg-orange-500/20 text-orange-300' : 'bg-orange-100 text-orange-800'
                  }`}>Syntax Highlighting</span>
                )}
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {selectedElement.compiler.allowCopyPaste && (
                <button className={`p-2 rounded-lg transition-colors ${
                  darkMode 
                    ? 'hover:bg-slate-700 text-slate-400 hover:text-slate-300' 
                    : 'hover:bg-slate-200 text-slate-500 hover:text-slate-700'
                }`}>
                  <Copy className="w-5 h-5" />
                </button>
              )}
              <button className={`p-2 rounded-lg transition-colors ${
                darkMode 
                  ? 'hover:bg-slate-700 text-slate-400 hover:text-slate-300' 
                  : 'hover:bg-slate-200 text-slate-500 hover:text-slate-700'
              }`}>
                <Save className="w-5 h-5" />
              </button>

              {/* Output Toggle */}
              <button
                onClick={() => setShowOutputPanel(!showOutputPanel)}
                className={`p-2 rounded-lg transition-colors ${
                  showOutputPanel 
                    ? darkMode 
                      ? 'bg-orange-500 text-white' 
                      : 'bg-orange-500 text-white'
                    : darkMode 
                    ? 'hover:bg-slate-700 text-slate-400 hover:text-slate-300' 
                    : 'hover:bg-slate-200 text-slate-500 hover:text-slate-700'
                }`}
              >
                <Terminal className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Monaco Editor */}
          <div className="flex-1" style={{ height: showOutputPanel ? '60%' : '100%' }}>
            <Editor
              height="100%"
              language={getLanguageForEditor()}
              value={code}
              onChange={(value) => setCode(value || '')}
              theme={darkMode ? "vs-dark" : "vs"}
              options={{
                minimap: { enabled: true },
                fontSize: selectedElement.accessibility.largeText ? 16 : 14,
                readOnly: !selectedElement.compiler.allowCopyPaste,
                wordWrap: 'on',
                automaticLayout: true,
                scrollBeyondLastLine: false,
                suggestOnTriggerCharacters: selectedElement.compiler.autoComplete,
                quickSuggestions: selectedElement.compiler.autoComplete,
                parameterHints: { enabled: selectedElement.compiler.autoComplete },
                lineNumbers: 'on',
                glyphMargin: true,
                folding: true,
                renderLineHighlight: 'all',
                tabSize: 2,
                insertSpaces: true,
                detectIndentation: true,
                trimAutoWhitespace: true,
                formatOnPaste: true,
                formatOnType: true,
              }}
            />
          </div>

          {/* Output Panel */}
          {showOutputPanel && (
            <div className={`border-t transition-all duration-300 flex flex-col backdrop-blur-sm ${
              darkMode 
                ? 'bg-slate-800/80 border-slate-700 text-slate-100' 
                : 'bg-white/80 border-slate-200 text-slate-900'
            }`} style={{ height: '40%' }}>
              <div className={`px-4 py-3 flex items-center justify-between ${
                darkMode ? 'bg-slate-900/80' : 'bg-slate-100/80'
              }`}>
                <div className="flex items-center gap-2">
                  <Terminal className="w-5 h-5" />
                  <span className="font-semibold">Output</span>
                  {isRunning && (
                    <div className="flex items-center gap-2 text-sm text-amber-600">
                      <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse"></div>
                      Running...
                    </div>
                  )}
                </div>
                <button
                  onClick={() => setShowOutputPanel(false)}
                  className={`p-1 rounded-lg transition-colors ${
                    darkMode 
                      ? 'hover:bg-slate-700 text-slate-400 hover:text-slate-300' 
                      : 'hover:bg-slate-200 text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className={`flex-1 p-4 font-mono text-sm overflow-auto ${
                darkMode ? 'bg-slate-900/50 text-slate-100' : 'bg-white/50 text-slate-900'
              }`}>
                <pre className="whitespace-pre-wrap">{output || 'Click the Run Code icon to see the output here...'}</pre>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Submit Assessment Button - Only for self-practice and assessment */}
      {(selectedElement.type === 'self-practice' || selectedElement.type === 'self-assessment') && (
        <div className={`border-t transition-colors duration-300 backdrop-blur-sm ${
          darkMode 
            ? 'bg-slate-800/80 border-slate-700 text-slate-100' 
            : 'bg-white/80 border-slate-200 text-slate-900'
        } px-4 py-3 flex justify-between items-center`}>
          <div className={`text-sm ${
            darkMode ? 'text-slate-400' : 'text-slate-600'
          }`}>
            {submittedQuestions.size} of {questions.filter(q => q.type === 'programming').length} programming questions submitted
          </div>
          <button
            onClick={handleSubmitAssessment}
            className="px-6 py-2 bg-emerald-500 text-white rounded-lg text-sm font-semibold hover:bg-emerald-600 transition-colors shadow-lg shadow-emerald-500/25"
          >
            Submit Assessment
          </button>
        </div>
      )}
    </div>
  );
};

// ==============================
// Main App Component
// ==============================

const CodeLearningApp: React.FC = () => {
  const [selectedElement, setSelectedElement] = useState<LearningElementSettings | null>(null);
  const [darkMode, setDarkMode] = useState(false);

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
  };

  if (!selectedElement) {
    return (
      <ElementSelector 
        onElementSelect={setSelectedElement} 
        darkMode={darkMode}
      />
    );
  }

  return (
    <LearningIDE
      selectedElement={selectedElement}
      onBack={() => setSelectedElement(null)}
      darkMode={darkMode}
      toggleDarkMode={toggleDarkMode}
    />
  );
};

export default CodeLearningApp;