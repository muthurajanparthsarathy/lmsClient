import React, { useState, useRef, useEffect } from 'react';
import {
  Plus,
  X,
  Play,
  CheckCircle,
  AlertCircle,
  Code2,
  FileText,
  Trash2,
  Edit3,
  Eye,
  EyeOff,
  Clock,
  Cpu,
  BookOpen,
  TestTube,
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  Quote,
  Code,
  Link,
  Image,
  Palette,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Undo,
  Redo,
  Superscript,
  Subscript,
  Strikethrough,
  Type,
  Minus,
  Maximize,
  Copy,
  ChevronDown,
  ChevronUp,
  Heading,
  FileCode,
  Zap,
  Settings,
  Save,
  Search,
  MoreVertical,
  Power,
  Filter,
  CodeIcon,
  Sun,
  Moon,
  ChevronLeft,
  ChevronRight,
  HelpCircle,
  GripVertical,
  Upload
} from 'lucide-react';
import dynamic from 'next/dynamic';

// Dynamically import Monaco Editor
const MonacoEditor = dynamic(() => import('@monaco-editor/react'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-gray-100">
      <div className="text-center">
        <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-1"></div>
        <p className="text-xs text-gray-600">Loading Editor...</p>
      </div>
    </div>
  )
});

interface TestCase {
  id: string;
  input: string;
  expectedOutput: string;
  isPublic: boolean;
  description?: string;
}

interface Example {
  id: string;
  input: string;
  output: string;
  explanation?: string;
}

interface Hint {
  id: string;
  text: string;
  order: number;
}

interface ProgrammingQuestion {
  id: string;
  title: string;
  description: string;
  difficulty: 'easy' | 'medium' | 'hard';
  timeLimit: number;
  memoryLimit: number;
  testCases: TestCase[];
  starterCode: string;
  solutionCode: string;
  language: string;
  tags: string[];
  functionName: string;
  enabled: boolean;
  examples: Example[];
  hints: Hint[];
  constraints: string[];
}

interface AddQuestionModalProps {
  question: ProgrammingQuestion;
  onSave: (question: ProgrammingQuestion) => void;
  onClose: () => void;
  compilerThemes: any;
  selectedTheme: string;
}

// Enhanced Piston API Code Execution Engine with improved input handling
class PistonExecutionEngine {
  private static readonly API_URL = process.env.NEXT_PUBLIC_PISTON_URL || 'https://emkc.org/api/v2/piston/execute';
  
  // Parse input string into array of inputs
  static parseInputs(input: string): string[] {
    if (!input || input.trim() === '') {
      return [''];
    }
    
    // Split by newlines and filter out empty lines
    return input.split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);
  }
  
  // Enhanced code preparation that handles different input scenarios
  static prepareCodeForExecution(code: string, language: string, inputs: string[]): string {
    const functionMatch = code.match(/def\s+(\w+)\s*\(/);
    const functionName = functionMatch ? functionMatch[1] : 'solution';
    
    // Parse inputs based on their content
    const parsedInputs = inputs.map(input => {
      const trimmed = input.trim();
      
      // Handle numbers
      if (!isNaN(Number(trimmed))) return Number(trimmed);
      
      // Handle arrays
      if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        try { 
          return JSON.parse(trimmed); 
        } catch { 
          return `"${trimmed}"`; 
        }
      }
      
      // Handle booleans
      if (trimmed.toLowerCase() === 'true') return 'True';
      if (trimmed.toLowerCase() === 'false') return 'False';
      
      // Handle strings
      return `"${trimmed}"`;
    });

    const functionCall = `${functionName}(${parsedInputs.join(', ')})`;
    
    return `${code}\n\n# Execute function with provided inputs\nresult = ${functionCall}\nprint(result)`;
  }

  // Single execution for individual test cases
  static async executeCode(code: string, language: string, inputs: string[]): Promise<any> {
    try {
      const runtime = this.getRuntime(language);
      const preparedCode = this.prepareCodeForExecution(code, language, inputs);
      
      const response = await fetch(this.API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          language: runtime.language,
          version: runtime.version,
          files: [
            {
              name: runtime.filename,
              content: preparedCode
            }
          ],
          stdin: '', // No stdin needed as inputs are passed directly
          args: [],
          compile_timeout: 10000,
          run_timeout: 5000,
          compile_memory_limit: -1,
          run_memory_limit: -1
        })
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.compile && data.compile.code !== 0) {
        throw new Error(`Compilation error: ${data.compile.output}`);
      }
      
      if (data.run.code !== 0) {
        throw new Error(`Runtime error: ${data.run.output}`);
      }
      
      return data.run.output.trim();
    } catch (error: any) {
      throw new Error(`Execution failed: ${error.message}`);
    }
  }

  // Batch execution for multiple test cases
  static async executeCodeBatch(code: string, language: string, testCases: {id: string, inputs: string[]}[]): Promise<{id: string, output: string, error?: string}[]> {
    try {
      const runtime = this.getRuntime(language);
      const results: {id: string, output: string, error?: string}[] = [];
      
      // Execute each test case individually to avoid conflicts
      for (const testCase of testCases) {
        try {
          const preparedCode = this.prepareCodeForExecution(code, language, testCase.inputs);
          
          const response = await fetch(this.API_URL, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              language: runtime.language,
              version: runtime.version,
              files: [
                {
                  name: runtime.filename,
                  content: preparedCode
                }
              ],
              stdin: '',
              args: [],
              compile_timeout: 10000,
              run_timeout: 5000,
              compile_memory_limit: -1,
              run_memory_limit: -1
            })
          });

          if (!response.ok) {
            throw new Error(`API request failed: ${response.statusText}`);
          }

          const data = await response.json();
          
          if (data.compile && data.compile.code !== 0) {
            results.push({
              id: testCase.id,
              output: '',
              error: `Compilation error: ${data.compile.output}`
            });
            continue;
          }
          
          if (data.run.code !== 0) {
            results.push({
              id: testCase.id,
              output: '',
              error: `Runtime error: ${data.run.output}`
            });
            continue;
          }
          
          results.push({
            id: testCase.id,
            output: data.run.output.trim(),
            error: undefined
          });
          
          // Small delay between executions to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 100));
          
        } catch (error: any) {
          results.push({
            id: testCase.id,
            output: '',
            error: `Execution failed: ${error.message}`
          });
        }
      }
      
      return results;
    } catch (error: any) {
      // If any error occurs, return error for all test cases
      return testCases.map(tc => ({
        id: tc.id,
        output: '',
        error: `Batch execution failed: ${error.message}`
      }));
    }
  }

  private static getRuntime(language: string): { language: string; version: string; filename: string } {
    const runtimes: { [key: string]: { language: string; version: string; filename: string } } = {
      python: { language: 'python', version: '3.10.0', filename: 'main.py' },
      javascript: { language: 'javascript', version: '18.15.0', filename: 'main.js' },
      typescript: { language: 'typescript', version: '5.0.3', filename: 'main.ts' },
      java: { language: 'java', version: '15.0.2', filename: 'Main.java' },
      cpp: { language: 'cpp', version: '10.2.0', filename: 'main.cpp' },
      c: { language: 'c', version: '10.2.0', filename: 'main.c' },
      csharp: { language: 'csharp', version: '6.12.0', filename: 'Main.cs' }
    };
    
    return runtimes[language] || runtimes.python;
  }
}

// Enhanced Monaco Editor Component
const CodeEditorComponent: React.FC<{
  value: string;
  onChange: (value: string) => void;
  language: string;
  placeholder?: string;
  height?: string;
  theme?: any;
}> = ({ value, onChange, language, placeholder, height = '300px', theme }) => {
  const getLanguage = (lang: string) => {
    const languageMap: { [key: string]: string } = {
      javascript: 'javascript',
      typescript: 'typescript',
      python: 'python',
      java: 'java',
      cpp: 'cpp',
      c: 'c',
      csharp: 'csharp'
    };
    return languageMap[lang] || 'python';
  };

  return (
    <div className={`border ${theme.borderColor} rounded-lg overflow-hidden font-sans ${theme.backgroundColor}`} style={{ height }}>
      <MonacoEditor
        height="100%"
        language={getLanguage(language)}
        value={value}
        onChange={(newValue) => onChange(newValue || '')}
        theme={theme.editorTheme}
        options={{
          minimap: { enabled: true },
          scrollBeyondLastLine: false,
          fontSize: 13,
          lineNumbers: 'on',
          folding: true,
          automaticLayout: true,
          tabSize: 4,
          insertSpaces: true,
          detectIndentation: true,
          wordWrap: 'on',
          fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
        }}
        loading={<div className={`w-full h-full flex items-center justify-center ${theme.backgroundColor}`}>
          <div className="text-center">
            <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-1"></div>
            <p className={`text-xs ${theme.textColor} opacity-70`}>Loading Editor...</p>
          </div>
        </div>}
      />
    </div>
  );
};

// Enhanced Toggle Switch Component
const ToggleSwitch: React.FC<{
  enabled: boolean;
  onChange: (enabled: boolean) => void;
  size?: 'sm' | 'md' | 'lg';
}> = ({ enabled, onChange, size = 'md' }) => {
  const sizes = {
    sm: 'w-8 h-4',
    md: 'w-10 h-5',
    lg: 'w-12 h-6'
  };

  const dotSizes = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5'
  };

  return (
    <button
      type="button"
      className={`${sizes[size]} flex items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:ring-offset-1 ${
        enabled ? 'bg-blue-600' : 'bg-gray-300'
      }`}
      onClick={() => onChange(!enabled)}
    >
      <span
        className={`${dotSizes[size]} transform transition-transform duration-200 bg-white rounded-full shadow-sm ${
          enabled 
            ? size === 'sm' ? 'translate-x-4' : size === 'md' ? 'translate-x-5' : 'translate-x-6'
            : 'translate-x-1'
        }`}
      />
    </button>
  );
};

// Test Case Modal Component
const TestCaseModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onSave: (testCase: Omit<TestCase, 'id'>) => void;
  onUpdate?: (testCase: TestCase) => void;
  testCase?: TestCase | null;
}> = ({ isOpen, onClose, onSave, onUpdate, testCase }) => {
  const [formData, setFormData] = useState<Omit<TestCase, 'id'> | TestCase>({
    input: '',
    expectedOutput: '',
    isPublic: true,
    description: ''
  });

  useEffect(() => {
    if (testCase) {
      setFormData(testCase);
    } else {
      setFormData({
        input: '',
        expectedOutput: '',
        isPublic: true,
        description: ''
      });
    }
  }, [testCase, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.input.trim() || !formData.expectedOutput.trim()) {
      alert('Please fill in input and expected output');
      return;
    }

    if (testCase && onUpdate) {
      onUpdate(formData as TestCase);
    } else {
      onSave(formData);
    }
    
    setFormData({
      input: '',
      expectedOutput: '',
      isPublic: true,
      description: ''
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50 p-4 animate-fadeIn">
      <div className="bg-white rounded-lg w-full max-w-2xl transform transition-all duration-200 scale-100 animate-scaleIn">
        <div className="flex justify-between items-center p-4 border-b">
          <h3 className="font-semibold text-gray-900 text-sm">
            {testCase ? 'Edit Test Case' : 'Add Test Case'}
          </h3>
          <button
            onClick={onClose}
            className="p-1 text-gray-500 hover:text-gray-700 transition-colors duration-150"
          >
            <X size={16} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Input *
            </label>
            <textarea
              value={formData.input}
              onChange={(e) => setFormData(prev => ({ ...prev, input: e.target.value }))}
              placeholder="Enter input values (one per line if multiple)..."
              rows={3}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 font-mono transition-colors duration-150"
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              Enter input values that will be passed to the function. Use new lines for multiple inputs.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Expected Output *
            </label>
            <textarea
              value={formData.expectedOutput}
              onChange={(e) => setFormData(prev => ({ ...prev, expectedOutput: e.target.value }))}
              placeholder="Enter expected output..."
              rows={2}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 font-mono transition-colors duration-150"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description (Optional)
            </label>
            <input
              type="text"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="What this test case checks..."
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-150"
            />
          </div>

          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <ToggleSwitch
                enabled={formData.isPublic}
                onChange={(enabled) => setFormData(prev => ({ ...prev, isPublic: enabled }))}
                size="sm"
              />
              <span className="text-gray-700">Visible to students</span>
            </label>
            
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm text-gray-700 hover:text-gray-900 transition-colors duration-150"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors duration-150 text-sm font-medium"
              >
                {testCase ? 'Update' : 'Add'} Test Case
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

// Test Case Result Component
const TestCaseResult: React.FC<{
  result: any;
  testCase: TestCase;
  index: number;
  theme?: any;
}> = ({ result, testCase, index, theme }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className={`border rounded transition-all duration-200 ${
      result.passed 
        ? 'bg-green-50 border-green-200 hover:bg-green-100' 
        : 'bg-red-50 border-red-200 hover:bg-red-100'
    }`}>
      {/* Compact Header */}
      <div 
        className="flex justify-between items-center p-2 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          {result.passed ? (
            <CheckCircle size={14} className="text-green-600" />
          ) : (
            <AlertCircle size={14} className="text-red-600" />
          )}
          <div className="flex items-center gap-1">
            <span className={`font-medium text-xs ${theme.textColor}`}>Test {index + 1}</span>
            {testCase.description && (
              <span className={`text-xs ${theme.textColor} opacity-70`}>- {testCase.description}</span>
            )}
          </div>
          <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
            result.passed ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
          }`}>
            {result.passed ? 'PASSED' : 'FAILED'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className={`flex items-center gap-1 text-xs ${theme.textColor} opacity-70`}>
            <span>{result.executionTime.toFixed(2)} ms</span>
            <span>{result.memoryUsed.toFixed(1)} MB</span>
          </div>
          <button className={`${theme.textColor} opacity-70 hover:opacity-100 transition-colors`}>
            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      </div>

      {/* Expanded Details */}
      {isExpanded && (
        <div className={`border-t ${theme.borderColor} p-2 ${theme.cardBg}`}>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            {/* Input */}
            <div>
              <label className={`block text-xs font-medium ${theme.textColor} opacity-70 mb-1 uppercase tracking-wide`}>
                Input
              </label>
              <div className={`${theme.inputBg} p-2 rounded border font-mono text-xs overflow-x-auto ${theme.inputText}`}>
                {testCase.input || <span className="opacity-70">No input</span>}
              </div>
            </div>

            {/* Expected Output */}
            <div>
              <label className={`block text-xs font-medium ${theme.textColor} opacity-70 mb-1 uppercase tracking-wide`}>
                Expected
              </label>
              <div className={`p-2 rounded border font-mono text-xs overflow-x-auto ${
                result.passed ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'
              }`}>
                {testCase.expectedOutput}
              </div>
            </div>

            {/* Actual Output */}
            <div>
              <label className={`block text-xs font-medium ${theme.textColor} opacity-70 mb-1 uppercase tracking-wide`}>
                Actual
              </label>
              <div className={`p-2 rounded border font-mono text-xs overflow-x-auto ${
                result.passed ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'
              }`}>
                {result.actualOutput || <span className="opacity-70">No output</span>}
              </div>
            </div>
          </div>

          {/* Error Message */}
          {!result.passed && result.error && (
            <div className="mt-2">
              <label className={`block text-xs font-medium ${theme.textColor} opacity-70 mb-1 uppercase tracking-wide`}>
                Error
              </label>
              <div className="bg-red-50 border border-red-200 p-2 rounded font-mono text-xs text-red-700 overflow-x-auto">
                {result.error}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const AddQuestionModal: React.FC<AddQuestionModalProps> = ({ 
  question, 
  onSave, 
  onClose, 
  compilerThemes, 
  selectedTheme 
}) => {
  const [currentQuestion, setCurrentQuestion] = useState<ProgrammingQuestion>(question);
  const [activeTab, setActiveTab] = useState<'problem' | 'testcases' | 'solution'>('problem');
  const [isRunningTest, setIsRunningTest] = useState(false);
  const [testResults, setTestResults] = useState<any[]>([]);
  const [showTestCaseModal, setShowTestCaseModal] = useState(false);
  const [editingTestCase, setEditingTestCase] = useState<TestCase | null>(null);
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([question.language]);
  const [sampleInput, setSampleInput] = useState<string>('');
  const [sampleOutput, setSampleOutput] = useState<string>('');
  const [hint, setHint] = useState<string>('');

  const languages = [
    { value: 'python', label: 'Python' },
    { value: 'javascript', label: 'JavaScript' },
    { value: 'typescript', label: 'TypeScript' },
    { value: 'java', label: 'Java' },
    { value: 'cpp', label: 'C++' },
    { value: 'c', label: 'C' },
    { value: 'csharp', label: 'C#' }
  ];

  const difficultyOptions = [
    { value: 'easy', label: 'Easy', color: 'text-green-700 bg-green-100' },
    { value: 'medium', label: 'Medium', color: 'text-yellow-700 bg-yellow-100' },
    { value: 'hard', label: 'Hard', color: 'text-red-700 bg-red-100' }
  ];

  const getDefaultStarterCode = (language: string, functionName: string): string => {
    switch (language) {
      case 'python':
        return `def ${functionName}(a, b):
    # Write your code here
    pass`;
      case 'javascript':
        return `function ${functionName}(a, b) {
    // Your code here
}`;
      case 'typescript':
        return `function ${functionName}(a: number, b: number): number {
    // Your code here
    return 0;
}`;
      case 'java':
        return `public class Solution {
    public static int ${functionName}(int a, int b) {
        // Your code here
        return 0;
    }
}`;
      case 'cpp':
        return `int ${functionName}(int a, int b) {
    // Your code here
    return 0;
}`;
      case 'c':
        return `int ${functionName}(int a, int b) {
    // Your code here
    return 0;
}`;
      case 'csharp':
        return `public class Solution {
    public static int ${functionName}(int a, int b) {
        // Your code here
        return 0;
    }
}`;
      default:
        return `def ${functionName}(a, b):
    # Your code here
    pass`;
    }
  };

  const getDefaultSolutionCode = (language: string, functionName: string): string => {
    switch (language) {
      case 'python':
        return `def ${functionName}(a, b):
    return a + b`;
      case 'javascript':
        return `function ${functionName}(a, b) {
    return a + b;
}`;
      case 'typescript':
        return `function ${functionName}(a: number, b: number): number {
    return a + b;
}`;
      case 'java':
        return `public class Solution {
    public static int ${functionName}(int a, int b) {
        return a + b;
    }
}`;
      case 'cpp':
        return `int ${functionName}(int a, int b) {
    return a + b;
}`;
      case 'c':
        return `int ${functionName}(int a, int b) {
    return a + b;
}`;
      case 'csharp':
        return `public class Solution {
    public static int ${functionName}(int a, int b) {
        return a + b;
    }
}`;
      default:
        return `def ${functionName}(a, b):
    return a + b`;
    }
  };

  const handleSaveQuestion = () => {
    // Update question with multiple languages and sample data
    const updatedQuestion = {
      ...currentQuestion,
      language: selectedLanguages.join(','), // Store as comma-separated string
      examples: [
        {
          id: '1',
          input: sampleInput,
          output: sampleOutput,
          explanation: 'Sample test case'
        }
      ],
      hints: hint ? [{ id: '1', text: hint, order: 1 }] : []
    };
    onSave(updatedQuestion);
  };

  const handleAddTestCase = (testCase: Omit<TestCase, 'id'>) => {
    const newTestCase: TestCase = {
      ...testCase,
      id: Date.now().toString()
    };

    setCurrentQuestion(prev => ({
      ...prev,
      testCases: [...prev.testCases, newTestCase]
    }));
  };

  const handleEditTestCase = (testCase: TestCase) => {
    setEditingTestCase(testCase);
    setShowTestCaseModal(true);
  };

  const handleUpdateTestCase = (updatedTestCase: TestCase) => {
    setCurrentQuestion(prev => ({
      ...prev,
      testCases: prev.testCases.map(tc => 
        tc.id === updatedTestCase.id ? updatedTestCase : tc
      )
    }));
    setEditingTestCase(null);
  };

  const handleDeleteTestCase = (id: string) => {
    setCurrentQuestion(prev => ({
      ...prev,
      testCases: prev.testCases.filter(tc => tc.id !== id)
    }));
  };

  // Enhanced test execution with proper input handling
  const runTestCases = async () => {
    setIsRunningTest(true);
    setTestResults([]);

    try {
      // Prepare test cases for execution
      const testCasesWithInputs = currentQuestion.testCases.map(testCase => ({
        id: testCase.id,
        inputs: PistonExecutionEngine.parseInputs(testCase.input)
      }));

      // Execute all test cases using first selected language
      const startTime = performance.now();
      const batchResults = await PistonExecutionEngine.executeCodeBatch(
        currentQuestion.solutionCode,
        selectedLanguages[0],
        testCasesWithInputs
      );
      const endTime = performance.now();

      const totalExecutionTime = endTime - startTime;
      const avgExecutionTime = totalExecutionTime / currentQuestion.testCases.length;

      // Process results
      const processedResults = batchResults.map((batchResult, index) => {
        const testCase = currentQuestion.testCases[index];
        const expectedOutput = testCase.expectedOutput.trim();
        
        const passed = batchResult.output === expectedOutput && !batchResult.error;
        const executionTime = avgExecutionTime;
        const memoryUsed = Math.random() * 20 + 5; // Simulated memory usage

        return {
          id: testCase.id,
          passed,
          executionTime,
          memoryUsed,
          actualOutput: batchResult.output,
          error: batchResult.error || (passed ? undefined : `Expected: "${expectedOutput}", Got: "${batchResult.output}"`),
          executionMethod: 'piston-api'
        };
      });

      setTestResults(processedResults);

      // Show results summary
      const passedCount = processedResults.filter(r => r.passed).length;
      const totalCount = processedResults.length;
      const allPassed = passedCount === totalCount;
      
      if (allPassed) {
        alert(`✅ All tests passed! (${passedCount}/${totalCount})\n\nAll test cases executed successfully.`);
      } else {
        const failedTests = processedResults
          .filter(r => !r.passed)
          .map((r, i) => `Test ${i + 1}: ${r.error || 'Failed'}`)
          .join('\n');
        
        alert(`❌ Tests failed! (${passedCount}/${totalCount} passed)\n\nFailed tests:\n${failedTests}`);
      }
    } catch (error) {
      console.error('Test execution failed:', error);
      setTestResults(currentQuestion.testCases.map(testCase => ({
        id: testCase.id,
        passed: false,
        executionTime: 0,
        memoryUsed: 0,
        actualOutput: 'Error',
        error: 'Test execution failed',
        executionMethod: 'error'
      })));
      
      alert('❌ Test execution failed! Please check your solution code and try again.');
    } finally {
      setIsRunningTest(false);
    }
  };

  const handleLanguageToggle = (language: string) => {
    setSelectedLanguages(prev => {
      if (prev.includes(language)) {
        // If it's the last language, don't remove it
        if (prev.length === 1) return prev;
        return prev.filter(lang => lang !== language);
      } else {
        return [...prev, language];
      }
    });
  };

  const handleTagInput = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && e.currentTarget.value.trim()) {
      const newTag = e.currentTarget.value.trim();
      if (!currentQuestion.tags.includes(newTag)) {
        setCurrentQuestion(prev => ({
          ...prev,
          tags: [...prev.tags, newTag]
        }));
      }
      e.currentTarget.value = '';
    }
  };

  const removeTag = (tagToRemove: string) => {
    setCurrentQuestion(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }));
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const updateFunctionSignature = () => {
    const newStarterCode = getDefaultStarterCode(
      selectedLanguages[0], // Use first selected language for template
      currentQuestion.functionName
    );
    const newSolutionCode = getDefaultSolutionCode(
      selectedLanguages[0],
      currentQuestion.functionName
    );

    setCurrentQuestion(prev => ({
      ...prev,
      starterCode: newStarterCode,
      solutionCode: newSolutionCode
    }));
  };

  const currentTheme = compilerThemes[selectedTheme];

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50 p-0 animate-fadeIn">
      <div className={`${currentTheme.backgroundColor} w-full h-full flex transform transition-all duration-200 scale-100 animate-scaleIn`}>
        {/* Left Panel - Form */}
        <div className="flex-1 flex flex-col border-r border-gray-300">
          {/* Header */}
          <div className="flex justify-between items-center p-3 border-b border-gray-300 bg-gray-100">
            <div>
              <h2 className="font-semibold text-gray-900 text-base">
                {currentQuestion.id ? 'Edit Exercise' : 'Create Exercise'}
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={runTestCases}
                disabled={currentQuestion.testCases.length === 0 || isRunningTest}
                className="flex items-center gap-1 px-2 py-1.5 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors text-xs"
              >
                {isRunningTest ? (
                  <>
                    <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Testing...
                  </>
                ) : (
                  <>
                    <Play size={12} />
                    Run Tests
                  </>
                )}
              </button>
              <button
                onClick={handleSaveQuestion}
                className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-xs font-medium"
              >
                <Save size={12} />
                Save
              </button>
              <button
                onClick={onClose}
                className="p-1.5 text-gray-900 opacity-70 hover:opacity-100 hover:bg-white rounded transition-colors"
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="border-b border-gray-300 bg-gray-100">
            <div className="flex">
              {[
                { key: 'problem' as const, label: 'Exercise', icon: FileText },
                { key: 'testcases' as const, label: 'Test Cases', icon: TestTube },
                { key: 'solution' as const, label: 'Solution', icon: CodeIcon }
              ].map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  className={`flex items-center gap-1 px-3 py-2 border-b-2 font-medium text-xs transition-colors ${
                    activeTab === key
                      ? 'border-blue-500 text-blue-600 bg-blue-50'
                      : 'text-gray-900 opacity-70 hover:opacity-100 hover:bg-white border-transparent'
                  }`}
                >
                  <Icon size={12} />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Content Area */}
          <div className="flex-1 overflow-auto p-4 bg-white">
            {activeTab === 'problem' && (
              <div className="max-w-4xl space-y-6">
                {/* Basic Information */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-gray-900 text-base">Basic Information</h3>
                  
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Left Column */}
                    <div className="space-y-4">
                      {/* Exercise Title */}
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-2">
                          Exercise Title *
                        </label>
                        <input
                          type="text"
                          value={currentQuestion.title}
                          onChange={(e) => setCurrentQuestion(prev => ({ ...prev, title: e.target.value }))}
                          placeholder="Enter exercise title..."
                          className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                        />
                      </div>

                      {/* Function Name */}
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-2">
                          Function Name *
                        </label>
                        <input
                          type="text"
                          value={currentQuestion.functionName}
                          onChange={(e) => setCurrentQuestion(prev => ({ ...prev, functionName: e.target.value }))}
                          onBlur={updateFunctionSignature}
                          placeholder="solution"
                          className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 font-mono text-gray-900"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Name of the function students need to implement
                        </p>
                      </div>

                      {/* Difficulty */}
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-2">
                          Difficulty *
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                          {difficultyOptions.map(({ value, label, color }) => (
                            <button
                              key={value}
                              type="button"
                              onClick={() => setCurrentQuestion(prev => ({ ...prev, difficulty: value as any }))}
                              className={`p-2 text-center rounded border transition-colors text-xs font-medium ${
                                currentQuestion.difficulty === value
                                  ? `${color} border-current`
                                  : 'bg-white border-gray-300 hover:bg-gray-50 text-gray-900'
                              }`}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Right Column */}
                    <div className="space-y-4">
                      {/* Programming Languages - Multi-select */}
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-2">
                          Supported Languages *
                        </label>
                        <div className="border border-gray-300 rounded p-2 bg-white">
                          <div className="flex flex-wrap gap-2">
                            {languages.map(lang => (
                              <button
                                key={lang.value}
                                type="button"
                                onClick={() => handleLanguageToggle(lang.value)}
                                className={`px-3 py-1.5 rounded border text-xs font-medium transition-colors ${
                                  selectedLanguages.includes(lang.value)
                                    ? 'bg-blue-100 text-blue-700 border-blue-300'
                                    : 'bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200'
                                }`}
                              >
                                {lang.label}
                              </button>
                            ))}
                          </div>
                          <p className="text-xs text-gray-500 mt-2">
                            Select one or more languages that students can use
                          </p>
                        </div>
                      </div>

                      {/* Time and Memory Limits */}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-2">
                            Time Limit (seconds)
                          </label>
                          <input
                            type="number"
                            value={currentQuestion.timeLimit}
                            onChange={(e) => setCurrentQuestion(prev => ({ ...prev, timeLimit: Number(e.target.value) }))}
                            min="1"
                            max="60"
                            className="w-full px-2 py-1 text-sm bg-white border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-2">
                            Memory Limit (MB)
                          </label>
                          <input
                            type="number"
                            value={currentQuestion.memoryLimit}
                            onChange={(e) => setCurrentQuestion(prev => ({ ...prev, memoryLimit: Number(e.target.value) }))}
                            min="64"
                            max="1024"
                            className="w-full px-2 py-1 text-sm bg-white border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                          />
                        </div>
                      </div>

                      {/* Tags */}
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-2">
                          Tags
                        </label>
                        <div className="border border-gray-300 rounded p-2 min-h-[40px] text-sm bg-white focus-within:ring-1 focus-within:ring-blue-500 focus-within:border-blue-500">
                          <div className="flex flex-wrap gap-1 mb-1">
                            {currentQuestion.tags.map(tag => (
                              <span
                                key={tag}
                                className="flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-medium"
                              >
                                {tag}
                                <button
                                  type="button"
                                  onClick={() => removeTag(tag)}
                                  className="hover:text-blue-500 transition-colors"
                                >
                                  <X size={10} />
                                </button>
                              </span>
                            ))}
                          </div>
                          <input
                            type="text"
                            placeholder="Add tag and press Enter..."
                            onKeyDown={handleTagInput}
                            className="w-full border-none focus:ring-0 text-xs p-0 placeholder-opacity-70 bg-transparent text-gray-900"
                          />
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          Press Enter to add tags
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Exercise Description */}
                <div className="space-y-2">
                  <h3 className="font-semibold text-gray-900 text-base">
                    Exercise Description *
                  </h3>
                  <textarea
                    value={currentQuestion.description}
                    onChange={(e) => setCurrentQuestion(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Enter detailed exercise description. Explain the problem, provide context, and specify what students need to do..."
                    rows={8}
                    className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                  />
                </div>

                {/* Constraints Section */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-gray-900 text-base">
                      Constraints
                    </h3>
                    <button
                      type="button"
                      onClick={() => {
                        setCurrentQuestion(prev => ({
                          ...prev,
                          constraints: [...prev.constraints, '']
                        }));
                      }}
                      className="text-xs text-blue-600 hover:text-blue-800"
                    >
                      + Add Constraint
                    </button>
                  </div>
                  <div className="space-y-2">
                    {currentQuestion.constraints.map((constraint, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <input
                          type="text"
                          value={constraint}
                          onChange={(e) => {
                            const newConstraints = [...currentQuestion.constraints];
                            newConstraints[index] = e.target.value;
                            setCurrentQuestion(prev => ({ ...prev, constraints: newConstraints }));
                          }}
                          placeholder="e.g., -1000 ≤ a, b ≤ 1000"
                          className="flex-1 px-3 py-1.5 text-sm bg-white border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const newConstraints = currentQuestion.constraints.filter((_, i) => i !== index);
                            setCurrentQuestion(prev => ({ ...prev, constraints: newConstraints }));
                          }}
                          className="p-1.5 hover:bg-red-50 rounded"
                          disabled={currentQuestion.constraints.length === 1}
                        >
                          <X size={14} className="text-red-500" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Sample Input/Output */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <h3 className="font-semibold text-gray-900 text-base">
                      Sample Input
                    </h3>
                    <textarea
                      value={sampleInput}
                      onChange={(e) => setSampleInput(e.target.value)}
                      placeholder="Enter sample input that demonstrates the problem..."
                      rows={4}
                      className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 font-mono text-gray-900"
                    />
                    <p className="text-xs text-gray-500">
                      Provide a sample input that demonstrates the problem
                    </p>
                  </div>

                  <div className="space-y-2">
                    <h3 className="font-semibold text-gray-900 text-base">
                      Sample Output
                    </h3>
                    <textarea
                      value={sampleOutput}
                      onChange={(e) => setSampleOutput(e.target.value)}
                      placeholder="Enter expected output for the sample input..."
                      rows={4}
                      className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 font-mono text-gray-900"
                    />
                    <p className="text-xs text-gray-500">
                      Expected output for the sample input above
                    </p>
                  </div>
                </div>

                {/* Hint Section */}
                <div className="space-y-2">
                  <h3 className="font-semibold text-gray-900 text-base">
                    Hint
                  </h3>
                  <textarea
                    value={hint}
                    onChange={(e) => setHint(e.target.value)}
                    placeholder="Provide a helpful hint for students (optional)..."
                    rows={3}
                    className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                  />
                  <p className="text-xs text-gray-500">
                    Optional hint to guide students towards the solution
                  </p>
                </div>
              </div>
            )}

            {activeTab === 'testcases' && (
              <div className="space-y-4 max-w-7xl">
                {/* Header with Add Button */}
                <div className="flex justify-between items-center">
                  <h3 className="font-semibold text-gray-900 text-base">
                    Test Cases ({currentQuestion.testCases.length})
                  </h3>
                  <button
                    onClick={() => {
                      setEditingTestCase(null);
                      setShowTestCaseModal(true);
                    }}
                    className="flex items-center gap-1 px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-xs font-medium"
                  >
                    <Plus size={12} />
                    Add Test Case
                  </button>
                </div>

                {/* Test Cases Grid View */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {currentQuestion.testCases.map((testCase, index) => (
                    <div key={testCase.id} className="bg-gray-50 border border-gray-300 rounded p-3 hover:bg-gray-100 transition-colors">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm text-gray-900">Test {index + 1}</span>
                          {testCase.isPublic ? (
                            <span className="px-1.5 py-0.5 bg-green-100 text-green-700 rounded text-xs">
                              Public
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 bg-gray-100 text-gray-700 rounded text-xs">
                              Hidden
                            </span>
                          )}
                          {testCase.description && (
                            <span className="text-xs text-gray-600 truncate max-w-[100px]">
                              {testCase.description}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => copyToClipboard(testCase.input)}
                            className="p-1 hover:bg-blue-50 rounded text-blue-600"
                            title="Copy input"
                          >
                            <Copy size={12} />
                          </button>
                          <button
                            onClick={() => handleEditTestCase(testCase)}
                            className="p-1 hover:bg-yellow-50 rounded text-yellow-600"
                            title="Edit test case"
                          >
                            <Edit3 size={12} />
                          </button>
                          <button
                            onClick={() => handleDeleteTestCase(testCase.id)}
                            className="p-1 hover:bg-red-50 rounded text-red-600"
                            title="Delete test case"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <div>
                          <label className="text-xs text-gray-500">Input:</label>
                          <pre className="bg-white p-2 rounded border text-xs font-mono overflow-x-auto max-h-20">
                            {testCase.input || <span className="text-gray-400">No input</span>}
                          </pre>
                        </div>
                        <div>
                          <label className="text-xs text-gray-500">Expected Output:</label>
                          <pre className="bg-white p-2 rounded border text-xs font-mono overflow-x-auto max-h-20">
                            {testCase.expectedOutput || <span className="text-gray-400">No output</span>}
                          </pre>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Empty State for Test Cases */}
                {currentQuestion.testCases.length === 0 && (
                  <div className="p-8 text-center border-2 border-dashed border-gray-300 rounded-lg">
                    <TestTube size={48} className="mx-auto mb-3 text-gray-900 opacity-30" />
                    <p className="text-sm text-gray-900 opacity-70 mb-2">
                      No test cases added yet
                    </p>
                    <p className="text-xs text-gray-900 opacity-50 mb-4">
                      Add test cases to validate your solution
                    </p>
                    <button
                      onClick={() => {
                        setEditingTestCase(null);
                        setShowTestCaseModal(true);
                      }}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-sm font-medium"
                    >
                      <Plus size={14} />
                      Add Your First Test Case
                    </button>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'solution' && (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 max-w-7xl h-full">
                {/* Starter Code - Left Side */}
                <div className="bg-gray-50 rounded border border-gray-300 h-full flex flex-col">
                  <div className="flex justify-between items-center p-2 border-b border-gray-300">
                    <h3 className="font-semibold text-gray-900 text-sm">Starter Code</h3>
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-gray-900 opacity-70">{selectedLanguages[0]}</span>
                    </div>
                  </div>
                  <div className="flex-1">
                    <CodeEditorComponent
                      value={currentQuestion.starterCode}
                      onChange={(value) => setCurrentQuestion(prev => ({ ...prev, starterCode: value }))}
                      language={selectedLanguages[0]}
                      placeholder={`Enter starter code for ${selectedLanguages[0]}...`}
                      height="100%"
                      theme={currentTheme}
                    />
                  </div>
                </div>

                {/* Solution Code - Right Side */}
                <div className="bg-gray-50 rounded border border-gray-300 h-full flex flex-col">
                  <div className="flex justify-between items-center p-2 border-b border-gray-300">
                    <h3 className="font-semibold text-gray-900 text-sm">Solution Code</h3>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => copyToClipboard(currentQuestion.solutionCode)}
                        className="flex items-center gap-1 px-2 py-1 bg-white text-gray-900 opacity-70 rounded hover:opacity-100 transition-colors text-xs"
                      >
                        <Copy size={12} />
                        Copy
                      </button>
                    </div>
                  </div>
                  <div className="flex-1">
                    <CodeEditorComponent
                      value={currentQuestion.solutionCode}
                      onChange={(value) => setCurrentQuestion(prev => ({ ...prev, solutionCode: value }))}
                      language={selectedLanguages[0]}
                      placeholder={`Enter solution code for ${selectedLanguages[0]}...`}
                      height="100%"
                      theme={currentTheme}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add/Edit Test Case Modal */}
      <TestCaseModal
        isOpen={showTestCaseModal}
        onClose={() => {
          setShowTestCaseModal(false);
          setEditingTestCase(null);
        }}
        onSave={handleAddTestCase}
        onUpdate={handleUpdateTestCase}
        testCase={editingTestCase}
      />
    </div>
  );
};

export default AddQuestionModal;