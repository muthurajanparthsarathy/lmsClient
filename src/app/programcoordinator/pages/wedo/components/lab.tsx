"use client"

import { useState, useRef, useEffect } from "react"
import { 
  Plus, 
  Image as ImageIcon, 
  Trash2, 
  Code, 
  Play,
  Download,
  Copy,
  CheckCircle2,
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  Quote,
  Link,
  Undo,
  Redo,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Superscript,
  Subscript,
  Strikethrough,
  Palette,
  Type,
  Minus,
  Table,
  Video
} from "lucide-react"

interface ProgrammingQuestion {
  id: string
  title: string
  description: string
  codeTemplate?: string
  expectedOutput?: string
  images: string[]
  difficulty: "easy" | "medium" | "hard"
  tags: string[]
  language: string
  timeLimit?: number
  memoryLimit?: number
  testCases?: TestCase[]
}

interface TestCase {
  id: string
  input: string
  expectedOutput: string
  isHidden: boolean
}

interface LabProps {
  onSave?: (questions: ProgrammingQuestion[]) => void
  initialQuestions?: ProgrammingQuestion[]
}

// Rich Text Editor Component
const RichTextEditor = ({ 
  value, 
  onChange,
  placeholder = "Start typing..."
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}) => {
  const editorRef = useRef<HTMLDivElement>(null)
  const [history, setHistory] = useState<string[]>([value])
  const [historyIndex, setHistoryIndex] = useState(0)

  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.innerHTML = value
    }
  }, [value])

  const saveToHistory = (content: string) => {
    const newHistory = history.slice(0, historyIndex + 1)
    newHistory.push(content)
    setHistory(newHistory)
    setHistoryIndex(newHistory.length - 1)
  }

  const execCommand = (command: string, value?: string) => {
    document.execCommand(command, false, value)
    updateContent()
    focusEditor()
  }

  const updateContent = () => {
    if (editorRef.current) {
      const content = editorRef.current.innerHTML
      saveToHistory(content)
      onChange(content)
    }
  }

  const focusEditor = () => {
    editorRef.current?.focus()
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const text = e.clipboardData.getData('text/plain')
    document.execCommand('insertText', false, text)
    updateContent()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey) {
      switch (e.key) {
        case 'b':
          e.preventDefault()
          execCommand('bold')
          break
        case 'i':
          e.preventDefault()
          execCommand('italic')
          break
        case 'u':
          e.preventDefault()
          execCommand('underline')
          break
        case 'z':
          e.preventDefault()
          undo()
          break
        case 'y':
          e.preventDefault()
          redo()
          break
      }
    }
  }

  const undo = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1
      setHistoryIndex(newIndex)
      onChange(history[newIndex])
      if (editorRef.current) {
        editorRef.current.innerHTML = history[newIndex]
      }
    }
  }

  const redo = () => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1
      setHistoryIndex(newIndex)
      onChange(history[newIndex])
      if (editorRef.current) {
        editorRef.current.innerHTML = history[newIndex]
      }
    }
  }

  const insertTable = () => {
    const tableHTML = `
      <table border="1" style="border-collapse: collapse; width: 100%;">
        <tr>
          <td style="padding: 8px;">Cell 1</td>
          <td style="padding: 8px;">Cell 2</td>
        </tr>
        <tr>
          <td style="padding: 8px;">Cell 3</td>
          <td style="padding: 8px;">Cell 4</td>
        </tr>
      </table>
    `
    document.execCommand('insertHTML', false, tableHTML)
    updateContent()
  }

  const insertCode = () => {
    const codeHTML = `<pre style="background: #f4f4f4; padding: 10px; border-radius: 4px; border: 1px solid #ddd;"><code>// Your code here</code></pre>`
    document.execCommand('insertHTML', false, codeHTML)
    updateContent()
  }

  const changeFontSize = (size: string) => {
    execCommand('fontSize', size)
  }

  const changeFontFamily = (font: string) => {
    execCommand('fontName', font)
  }

  const changeColor = (color: string) => {
    execCommand('foreColor', color)
  }

  const changeBackgroundColor = (color: string) => {
    execCommand('backColor', color)
  }

  const insertLink = () => {
    const url = prompt('Enter URL:')
    if (url) {
      execCommand('createLink', url)
    }
  }

  return (
    <div className="rich-text-editor">
      {/* Toolbar */}
      <div className="toolbar">
        {/* Undo/Redo */}
        <div className="toolbar-group">
          <button type="button" onClick={undo} className="toolbar-btn" title="Undo (Ctrl+Z)">
            <Undo className="w-4 h-4" />
          </button>
          <button type="button" onClick={redo} className="toolbar-btn" title="Redo (Ctrl+Y)">
            <Redo className="w-4 h-4" />
          </button>
        </div>

        <div className="toolbar-divider" />

        {/* Font Family */}
        <div className="toolbar-group">
          <select 
            onChange={(e) => changeFontFamily(e.target.value)}
            className="toolbar-select"
            title="Font Family"
          >
            <option value="Arial">Arial</option>
            <option value="Helvetica">Helvetica</option>
            <option value="Times New Roman">Times New Roman</option>
            <option value="Courier New">Courier New</option>
            <option value="Georgia">Georgia</option>
            <option value="Verdana">Verdana</option>
          </select>
        </div>

        {/* Font Size */}
        <div className="toolbar-group">
          <select 
            onChange={(e) => changeFontSize(e.target.value)}
            className="toolbar-select"
            title="Font Size"
          >
            <option value="1">Small</option>
            <option value="3">Normal</option>
            <option value="5">Large</option>
            <option value="7">Huge</option>
          </select>
        </div>

        <div className="toolbar-divider" />

        {/* Text Formatting */}
        <div className="toolbar-group">
          <button type="button" onClick={() => execCommand('bold')} className="toolbar-btn" title="Bold (Ctrl+B)">
            <Bold className="w-4 h-4" />
          </button>
          <button type="button" onClick={() => execCommand('italic')} className="toolbar-btn" title="Italic (Ctrl+I)">
            <Italic className="w-4 h-4" />
          </button>
          <button type="button" onClick={() => execCommand('underline')} className="toolbar-btn" title="Underline (Ctrl+U)">
            <Underline className="w-4 h-4" />
          </button>
          <button type="button" onClick={() => execCommand('strikeThrough')} className="toolbar-btn" title="Strikethrough">
            <Strikethrough className="w-4 h-4" />
          </button>
        </div>

        <div className="toolbar-divider" />

        {/* Text Alignment */}
        <div className="toolbar-group">
          <button type="button" onClick={() => execCommand('justifyLeft')} className="toolbar-btn" title="Align Left">
            <AlignLeft className="w-4 h-4" />
          </button>
          <button type="button" onClick={() => execCommand('justifyCenter')} className="toolbar-btn" title="Align Center">
            <AlignCenter className="w-4 h-4" />
          </button>
          <button type="button" onClick={() => execCommand('justifyRight')} className="toolbar-btn" title="Align Right">
            <AlignRight className="w-4 h-4" />
          </button>
        </div>

        <div className="toolbar-divider" />

        {/* Lists */}
        <div className="toolbar-group">
          <button type="button" onClick={() => execCommand('insertUnorderedList')} className="toolbar-btn" title="Bullet List">
            <List className="w-4 h-4" />
          </button>
          <button type="button" onClick={() => execCommand('insertOrderedList')} className="toolbar-btn" title="Numbered List">
            <ListOrdered className="w-4 h-4" />
          </button>
          <button type="button" onClick={() => execCommand('outdent')} className="toolbar-btn" title="Outdent">
            <Minus className="w-4 h-4" />
          </button>
          <button type="button" onClick={() => execCommand('indent')} className="toolbar-btn" title="Indent">
            <Plus className="w-4 h-4" />
          </button>
        </div>

        <div className="toolbar-divider" />

        {/* Special Formats */}
        <div className="toolbar-group">
          <button type="button" onClick={() => execCommand('formatBlock', '<blockquote>')} className="toolbar-btn" title="Blockquote">
            <Quote className="w-4 h-4" />
          </button>
          <button type="button" onClick={insertCode} className="toolbar-btn" title="Insert Code">
            <Code className="w-4 h-4" />
          </button>
          <button type="button" onClick={insertTable} className="toolbar-btn" title="Insert Table">
            <Table className="w-4 h-4" />
          </button>
          <button type="button" onClick={insertLink} className="toolbar-btn" title="Insert Link">
            <Link className="w-4 h-4" />
          </button>
        </div>

        <div className="toolbar-divider" />

        {/* Script */}
        <div className="toolbar-group">
          <button type="button" onClick={() => execCommand('superscript')} className="toolbar-btn" title="Superscript">
            <Superscript className="w-4 h-4" />
          </button>
          <button type="button" onClick={() => execCommand('subscript')} className="toolbar-btn" title="Subscript">
            <Subscript className="w-4 h-4" />
          </button>
        </div>

        <div className="toolbar-divider" />

        {/* Colors */}
        <div className="toolbar-group">
          <input 
            type="color" 
            onChange={(e) => changeColor(e.target.value)}
            className="toolbar-color"
            title="Text Color"
          />
          <input 
            type="color" 
            onChange={(e) => changeBackgroundColor(e.target.value)}
            className="toolbar-color"
            title="Background Color"
          />
        </div>
      </div>

      {/* Editor */}
      <div
        ref={editorRef}
        contentEditable
        onInput={updateContent}
        onPaste={handlePaste}
        onKeyDown={handleKeyDown}
        className="editor-content"
        style={{
          minHeight: '200px',
          border: '1px solid hsl(var(--border))',
          borderRadius: 'var(--radius)',
          padding: '1rem',
          outline: 'none'
        }}
        placeholder={placeholder}
      />
    </div>
  )
}

export default function Lab({ onSave, initialQuestions = [] }: LabProps) {
  const [questions, setQuestions] = useState<ProgrammingQuestion[]>(initialQuestions)
  const [activeQuestion, setActiveQuestion] = useState<ProgrammingQuestion | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [copiedCode, setCopiedCode] = useState<string | null>(null)

  const defaultQuestion: ProgrammingQuestion = {
    id: Date.now().toString(),
    title: "",
    description: "",
    codeTemplate: "",
    expectedOutput: "",
    images: [],
    difficulty: "easy",
    tags: [],
    language: "python",
    timeLimit: 5,
    memoryLimit: 256,
    testCases: []
  }

  const programmingLanguages = [
    "python", "javascript", "java", "c", "cpp", "csharp", "php", "ruby",
    "swift", "kotlin", "go", "rust", "typescript", "r", "scala"
  ]

  const handleAddQuestion = () => {
    const newQuestion = { ...defaultQuestion, id: Date.now().toString() }
    setQuestions(prev => [...prev, newQuestion])
    setActiveQuestion(newQuestion)
    setIsEditing(true)
  }

  const handleEditQuestion = (question: ProgrammingQuestion) => {
    setActiveQuestion(question)
    setIsEditing(true)
  }

  const handleSaveQuestion = (updatedQuestion: ProgrammingQuestion) => {
    setQuestions(prev => 
      prev.map(q => q.id === updatedQuestion.id ? updatedQuestion : q)
    )
    setIsEditing(false)
    setActiveQuestion(null)
    onSave?.(questions)
  }

  const handleDeleteQuestion = (id: string) => {
    setQuestions(prev => prev.filter(q => q.id !== id))
    if (activeQuestion?.id === id) {
      setActiveQuestion(null)
      setIsEditing(false)
    }
  }

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || !activeQuestion) return

    const newImages: string[] = []
    
    Array.from(files).forEach(file => {
      const reader = new FileReader()
      reader.onload = (e) => {
        if (e.target?.result && activeQuestion) {
          newImages.push(e.target.result as string)
          const updatedQuestion = {
            ...activeQuestion,
            images: [...activeQuestion.images, ...newImages]
          }
          setActiveQuestion(updatedQuestion)
        }
      }
      reader.readAsDataURL(file)
    })
  }

  const removeImage = (imageIndex: number) => {
    if (!activeQuestion) return

    const updatedQuestion = {
      ...activeQuestion,
      images: activeQuestion.images.filter((_, index) => index !== imageIndex)
    }
    setActiveQuestion(updatedQuestion)
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopiedCode(text)
    setTimeout(() => setCopiedCode(null), 2000)
  }

  const downloadCode = (code: string, filename: string) => {
    const blob = new Blob([code], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${filename}.${getFileExtension(activeQuestion?.language || 'python')}`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const getFileExtension = (language: string) => {
    const extensions: { [key: string]: string } = {
      python: 'py',
      javascript: 'js',
      java: 'java',
      c: 'c',
      cpp: 'cpp',
      csharp: 'cs',
      php: 'php',
      ruby: 'rb',
      swift: 'swift',
      kotlin: 'kt',
      go: 'go',
      rust: 'rs',
      typescript: 'ts',
      r: 'r',
      scala: 'scala'
    }
    return extensions[language] || 'txt'
  }

  const addTestCase = () => {
    if (!activeQuestion) return

    const newTestCase: TestCase = {
      id: Date.now().toString(),
      input: '',
      expectedOutput: '',
      isHidden: false
    }

    const updatedQuestion = {
      ...activeQuestion,
      testCases: [...(activeQuestion.testCases || []), newTestCase]
    }
    setActiveQuestion(updatedQuestion)
  }

  const updateTestCase = (testCaseId: string, field: keyof TestCase, value: any) => {
    if (!activeQuestion) return

    const updatedQuestion = {
      ...activeQuestion,
      testCases: activeQuestion.testCases?.map(tc => 
        tc.id === testCaseId ? { ...tc, [field]: value } : tc
      )
    }
    setActiveQuestion(updatedQuestion)
  }

  const removeTestCase = (testCaseId: string) => {
    if (!activeQuestion) return

    const updatedQuestion = {
      ...activeQuestion,
      testCases: activeQuestion.testCases?.filter(tc => tc.id !== testCaseId)
    }
    setActiveQuestion(updatedQuestion)
  }

  return (
    <div className="lms-container">
      <style>{`
        .lab-container {
          background: hsl(var(--card));
          border-radius: var(--radius);
          border: 1px solid hsl(var(--border));
          overflow: hidden;
        }
        
        .lab-header {
          background: linear-gradient(135deg, hsl(var(--primary) / 0.08) 0%, hsl(var(--primary) / 0.03) 100%);
          border-bottom: 1px solid hsl(var(--border));
          padding: 1rem 1.5rem;
        }
        
        .lab-title {
          font-size: 1.1rem;
          font-weight: 700;
          color: hsl(var(--foreground));
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        
        .lab-subtitle {
          font-size: 0.8rem;
          color: hsl(var(--muted-foreground));
          margin-top: 0.25rem;
        }
        
        .questions-sidebar {
          width: 320px;
          border-right: 1px solid hsl(var(--border));
          background: hsl(var(--sidebar-background));
          overflow-y: auto;
        }
        
        .question-item {
          padding: 1rem;
          border-bottom: 1px solid hsl(var(--border));
          cursor: pointer;
          transition: all 0.15s;
        }
        
        .question-item:hover {
          background: hsl(var(--accent));
        }
        
        .question-item.active {
          background: hsl(var(--primary) / 0.1);
          border-right: 2px solid hsl(var(--primary));
        }
        
        .question-preview {
          flex: 1;
          padding: 1.5rem;
          overflow-y: auto;
        }
        
        .difficulty-badge {
          padding: 0.25rem 0.5rem;
          border-radius: 0.25rem;
          font-size: 0.7rem;
          font-weight: 600;
          text-transform: uppercase;
        }
        
        .difficulty-easy {
          background: hsl(142 76% 36% / 0.1);
          color: hsl(142 76% 36%);
        }
        
        .difficulty-medium {
          background: hsl(38 92% 50% / 0.1);
          color: hsl(38 92% 50%);
        }
        
        .difficulty-hard {
          background: hsl(0 84% 60% / 0.1);
          color: hsl(0 84% 60%);
        }
        
        .code-editor {
          background: hsl(var(--muted));
          border: 1px solid hsl(var(--border));
          border-radius: var(--radius);
          overflow: hidden;
          font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
        }
        
        .code-header {
          background: hsl(var(--sidebar-background));
          padding: 0.5rem 1rem;
          border-bottom: 1px solid hsl(var(--border));
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        
        .code-actions {
          display: flex;
          gap: 0.5rem;
        }
        
        .code-content {
          padding: 1rem;
          min-height: 200px;
          max-height: 400px;
          overflow-y: auto;
          white-space: pre-wrap;
          font-size: 0.8rem;
          line-height: 1.5;
        }
        
        .image-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
          gap: 1rem;
          margin-top: 1rem;
        }
        
        .image-item {
          position: relative;
          border-radius: var(--radius);
          overflow: hidden;
          border: 1px solid hsl(var(--border));
        }
        
        .image-item img {
          width: 100%;
          height: 120px;
          object-fit: cover;
        }
        
        .image-actions {
          position: absolute;
          top: 0.25rem;
          right: 0.25rem;
          opacity: 0;
          transition: opacity 0.15s;
        }
        
        .image-item:hover .image-actions {
          opacity: 1;
        }
        
        .tag {
          display: inline-flex;
          align-items: center;
          gap: 0.25rem;
          padding: 0.25rem 0.5rem;
          background: hsl(var(--secondary));
          color: hsl(var(--secondary-foreground));
          border-radius: 1rem;
          font-size: 0.7rem;
          margin: 0.125rem;
        }
        
        .form-group {
          margin-bottom: 1.5rem;
        }
        
        .form-label {
          display: block;
          font-size: 0.8rem;
          font-weight: 600;
          margin-bottom: 0.5rem;
          color: hsl(var(--foreground));
        }
        
        .form-input, .form-textarea, .form-select {
          width: 100%;
          padding: 0.5rem 0.75rem;
          border: 1px solid hsl(var(--border));
          border-radius: var(--radius);
          background: hsl(var(--background));
          color: hsl(var(--foreground));
          font-size: 0.8rem;
        }
        
        .form-textarea {
          min-height: 80px;
          resize: vertical;
        }
        
        .btn {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 1rem;
          border-radius: var(--radius);
          font-size: 0.8rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.15s;
          border: none;
        }
        
        .btn-primary {
          background: hsl(var(--primary));
          color: hsl(var(--primary-foreground));
        }
        
        .btn-primary:hover {
          background: hsl(var(--primary) / 0.9);
        }
        
        .btn-outline {
          background: transparent;
          border: 1px solid hsl(var(--border));
          color: hsl(var(--foreground));
        }
        
        .btn-outline:hover {
          background: hsl(var(--accent));
        }
        
        .btn-danger {
          background: hsl(0 84% 60% / 0.1);
          color: hsl(0 84% 60%);
          border: 1px solid hsl(0 84% 60% / 0.2);
        }
        
        .btn-danger:hover {
          background: hsl(0 84% 60% / 0.2);
        }
        
        .btn-sm {
          padding: 0.375rem 0.75rem;
          font-size: 0.7rem;
        }
        
        .btn-icon {
          padding: 0.375rem;
        }

        /* Rich Text Editor Styles */
        .rich-text-editor {
          border: 1px solid hsl(var(--border));
          border-radius: var(--radius);
          overflow: hidden;
        }

        .toolbar {
          display: flex;
          align-items: center;
          gap: 0.25rem;
          padding: 0.5rem;
          background: hsl(var(--muted));
          border-bottom: 1px solid hsl(var(--border));
          flex-wrap: wrap;
        }

        .toolbar-group {
          display: flex;
          align-items: center;
          gap: 0.125rem;
        }

        .toolbar-divider {
          width: 1px;
          height: 1.5rem;
          background: hsl(var(--border));
          margin: 0 0.25rem;
        }

        .toolbar-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0.375rem;
          border: 1px solid transparent;
          border-radius: var(--radius);
          background: transparent;
          cursor: pointer;
          transition: all 0.15s;
        }

        .toolbar-btn:hover {
          background: hsl(var(--accent));
          border-color: hsl(var(--border));
        }

        .toolbar-select {
          padding: 0.25rem 0.5rem;
          border: 1px solid hsl(var(--border));
          border-radius: var(--radius);
          background: hsl(var(--background));
          color: hsl(var(--foreground));
          font-size: 0.7rem;
        }

        .toolbar-color {
          width: 1.5rem;
          height: 1.5rem;
          border: 1px solid hsl(var(--border));
          border-radius: var(--radius);
          cursor: pointer;
        }

        .editor-content {
          min-height: 200px;
          max-height: 400px;
          overflow-y: auto;
          padding: 1rem;
          outline: none;
        }

        .editor-content:empty:before {
          content: attr(placeholder);
          color: hsl(var(--muted-foreground));
        }

        /* Test Cases Styles */
        .test-case {
          border: 1px solid hsl(var(--border));
          border-radius: var(--radius);
          padding: 1rem;
          margin-bottom: 1rem;
        }

        .test-case-header {
          display: flex;
          align-items: center;
          justify-content: between;
          margin-bottom: 1rem;
        }

        .grid-2 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1rem;
        }

        .limit-input {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .limit-input input {
          width: 80px;
        }

        .limit-unit {
          font-size: 0.8rem;
          color: hsl(var(--muted-foreground));
        }
      `}</style>

      <div className="lab-container">
        {/* Header */}
        <div className="lab-header">
          <div className="lab-title">
            <Code className="w-5 h-5" />
            Programming Lab
          </div>
          <div className="lab-subtitle">
            Create and manage programming questions with rich text editor and comprehensive options
          </div>
        </div>

        <div className="flex" style={{ height: 'calc(100vh - 200px)' }}>
          {/* Questions Sidebar */}
          <div className="questions-sidebar">
            <div className="p-3 border-b border-border">
              <button 
                onClick={handleAddQuestion}
                className="btn btn-primary w-full"
              >
                <Plus className="w-4 h-4" />
                Add New Question
              </button>
            </div>

            <div className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 280px)' }}>
              {questions.map((question) => (
                <div
                  key={question.id}
                  className={`question-item ${activeQuestion?.id === question.id ? 'active' : ''}`}
                  onClick={() => handleEditQuestion(question)}
                >
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="font-medium text-sm line-clamp-2 flex-1">
                      {question.title || "Untitled Question"}
                    </h4>
                    <span className={`difficulty-badge difficulty-${question.difficulty}`}>
                      {question.difficulty}
                    </span>
                  </div>
                  
                  <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                    {question.description ? question.description.replace(/<[^>]*>/g, '').substring(0, 100) : "No description"}
                  </p>
                  
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{question.images.length} images</span>
                    <span>{question.testCases?.length || 0} test cases</span>
                    <span className="capitalize">{question.language}</span>
                  </div>
                </div>
              ))}
              
              {questions.length === 0 && (
                <div className="p-4 text-center text-muted-foreground">
                  <Code className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No questions yet</p>
                  <p className="text-xs">Click "Add New Question" to get started</p>
                </div>
              )}
            </div>
          </div>

          {/* Question Editor/Viewer */}
          <div className="question-preview">
            {isEditing && activeQuestion ? (
              <QuestionEditor
                question={activeQuestion}
                onSave={handleSaveQuestion}
                onCancel={() => {
                  setIsEditing(false)
                  setActiveQuestion(null)
                }}
                onDelete={() => handleDeleteQuestion(activeQuestion.id)}
                onImageUpload={handleImageUpload}
                onRemoveImage={removeImage}
                fileInputRef={fileInputRef}
                programmingLanguages={programmingLanguages}
                onAddTestCase={addTestCase}
                onUpdateTestCase={updateTestCase}
                onRemoveTestCase={removeTestCase}
              />
            ) : activeQuestion ? (
              <QuestionViewer
                question={activeQuestion}
                onEdit={() => setIsEditing(true)}
                onCopyCode={copyToClipboard}
                onDownloadCode={downloadCode}
                copiedCode={copiedCode}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-center">
                <div>
                  <Code className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <h3 className="text-lg font-semibold mb-2">No Question Selected</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Select a question from the sidebar or create a new one to get started
                  </p>
                  <button 
                    onClick={handleAddQuestion}
                    className="btn btn-primary"
                  >
                    <Plus className="w-4 h-4" />
                    Create New Question
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// Question Editor Component
interface QuestionEditorProps {
  question: ProgrammingQuestion
  onSave: (question: ProgrammingQuestion) => void
  onCancel: () => void
  onDelete: () => void
  onImageUpload: (event: React.ChangeEvent<HTMLInputElement>) => void
  onRemoveImage: (index: number) => void
  fileInputRef: React.RefObject<HTMLInputElement>
  programmingLanguages: string[]
  onAddTestCase: () => void
  onUpdateTestCase: (testCaseId: string, field: keyof TestCase, value: any) => void
  onRemoveTestCase: (testCaseId: string) => void
}

function QuestionEditor({ 
  question, 
  onSave, 
  onCancel, 
  onDelete, 
  onImageUpload, 
  onRemoveImage, 
  fileInputRef,
  programmingLanguages,
  onAddTestCase,
  onUpdateTestCase,
  onRemoveTestCase
}: QuestionEditorProps) {
  const [formData, setFormData] = useState(question)
  const [newTag, setNewTag] = useState("")

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave(formData)
  }

  const addTag = () => {
    if (newTag.trim() && !formData.tags.includes(newTag.trim())) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, newTag.trim()]
      }))
      setNewTag("")
    }
  }

  const removeTag = (tagToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }))
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      addTag()
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Edit Question</h3>
        <div className="flex gap-2">
          <button type="button" onClick={onCancel} className="btn btn-outline">
            Cancel
          </button>
          <button type="submit" className="btn btn-primary">
            Save Question
          </button>
        </div>
      </div>

      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div className="form-group">
            <label className="form-label">Question Title *</label>
            <input
              type="text"
              className="form-input"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              placeholder="Enter question title..."
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Programming Language</label>
            <select
              className="form-select"
              value={formData.language}
              onChange={(e) => setFormData(prev => ({ ...prev, language: e.target.value }))}
            >
              {programmingLanguages.map(lang => (
                <option key={lang} value={lang}>
                  {lang.charAt(0).toUpperCase() + lang.slice(1)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Problem Description</label>
          <RichTextEditor
            value={formData.description}
            onChange={(value) => setFormData(prev => ({ ...prev, description: value }))}
            placeholder="Describe the problem statement with rich text formatting..."
          />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="form-group">
            <label className="form-label">Difficulty</label>
            <select
              className="form-select"
              value={formData.difficulty}
              onChange={(e) => setFormData(prev => ({ 
                ...prev, 
                difficulty: e.target.value as "easy" | "medium" | "hard" 
              }))}
            >
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Time Limit (seconds)</label>
            <div className="limit-input">
              <input
                type="number"
                className="form-input"
                value={formData.timeLimit}
                onChange={(e) => setFormData(prev => ({ ...prev, timeLimit: Number(e.target.value) }))}
                min="1"
                max="60"
              />
              <span className="limit-unit">sec</span>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Memory Limit (MB)</label>
            <div className="limit-input">
              <input
                type="number"
                className="form-input"
                value={formData.memoryLimit}
                onChange={(e) => setFormData(prev => ({ ...prev, memoryLimit: Number(e.target.value) }))}
                min="64"
                max="1024"
              />
              <span className="limit-unit">MB</span>
            </div>
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Tags</label>
          <div className="flex gap-2">
            <input
              type="text"
              className="form-input flex-1"
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Add tag and press Enter..."
            />
            <button type="button" onClick={addTag} className="btn btn-outline">
              Add
            </button>
          </div>
          <div className="flex flex-wrap gap-1 mt-2">
            {formData.tags.map((tag, index) => (
              <span key={index} className="tag">
                {tag}
                <button 
                  type="button"
                  onClick={() => removeTag(tag)}
                  className="hover:text-destructive ml-1"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Code Template</label>
          <textarea
            className="form-textarea font-mono text-sm"
            value={formData.codeTemplate}
            onChange={(e) => setFormData(prev => ({ ...prev, codeTemplate: e.target.value }))}
            placeholder={`Enter starter code for ${formData.language}...`}
            rows={8}
          />
        </div>

        <div className="form-group">
          <label className="form-label">Expected Output</label>
          <textarea
            className="form-textarea font-mono text-sm"
            value={formData.expectedOutput}
            onChange={(e) => setFormData(prev => ({ ...prev, expectedOutput: e.target.value }))}
            placeholder="Describe or show the expected output..."
            rows={3}
          />
        </div>

        {/* Test Cases Section */}
        <div className="form-group">
          <div className="flex items-center justify-between mb-2">
            <label className="form-label">Test Cases</label>
            <button
              type="button"
              onClick={onAddTestCase}
              className="btn btn-outline btn-sm"
            >
              <Plus className="w-4 h-4" />
              Add Test Case
            </button>
          </div>

          {formData.testCases?.map((testCase, index) => (
            <div key={testCase.id} className="test-case">
              <div className="test-case-header">
                <h4 className="font-medium">Test Case {index + 1}</h4>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-1 text-sm">
                    <input
                      type="checkbox"
                      checked={testCase.isHidden}
                      onChange={(e) => onUpdateTestCase(testCase.id, 'isHidden', e.target.checked)}
                    />
                    Hidden
                  </label>
                  <button
                    type="button"
                    onClick={() => onRemoveTestCase(testCase.id)}
                    className="btn btn-danger btn-sm"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>

              <div className="grid-2">
                <div>
                  <label className="form-label">Input</label>
                  <textarea
                    className="form-textarea font-mono text-sm"
                    value={testCase.input}
                    onChange={(e) => onUpdateTestCase(testCase.id, 'input', e.target.value)}
                    rows={3}
                  />
                </div>
                <div>
                  <label className="form-label">Expected Output</label>
                  <textarea
                    className="form-textarea font-mono text-sm"
                    value={testCase.expectedOutput}
                    onChange={(e) => onUpdateTestCase(testCase.id, 'expectedOutput', e.target.value)}
                    rows={3}
                  />
                </div>
              </div>
            </div>
          ))}

          {(!formData.testCases || formData.testCases.length === 0) && (
            <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
              <Code className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm text-muted-foreground">No test cases added</p>
              <p className="text-xs text-muted-foreground mt-1">
                Click "Add Test Case" to create test cases for this question
              </p>
            </div>
          )}
        </div>

        <div className="form-group">
          <div className="flex items-center justify-between mb-2">
            <label className="form-label">Images</label>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="btn btn-outline btn-sm"
            >
              <ImageIcon className="w-4 h-4" />
              Add Images
            </button>
          </div>
          
          <input
            type="file"
            ref={fileInputRef}
            onChange={onImageUpload}
            accept="image/*"
            multiple
            className="hidden"
          />

          {formData.images.length > 0 ? (
            <div className="image-grid">
              {formData.images.map((image, index) => (
                <div key={index} className="image-item">
                  <img src={image} alt={`Question image ${index + 1}`} />
                  <div className="image-actions">
                    <button
                      type="button"
                      onClick={() => onRemoveImage(index)}
                      className="btn btn-danger btn-icon btn-sm"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
              <ImageIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm text-muted-foreground">No images added</p>
              <p className="text-xs text-muted-foreground mt-1">
                Click "Add Images" to upload supporting images
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-between pt-4 border-t border-border">
        <button
          type="button"
          onClick={onDelete}
          className="btn btn-danger"
        >
          <Trash2 className="w-4 h-4" />
          Delete Question
        </button>
        
        <div className="flex gap-2">
          <button type="button" onClick={onCancel} className="btn btn-outline">
            Cancel
          </button>
          <button type="submit" className="btn btn-primary">
            Save Changes
          </button>
        </div>
      </div>
    </form>
  )
}

// Question Viewer Component
interface QuestionViewerProps {
  question: ProgrammingQuestion
  onEdit: () => void
  onCopyCode: (code: string) => void
  onDownloadCode: (code: string, filename: string) => void
  copiedCode: string | null
}

function QuestionViewer({ 
  question, 
  onEdit, 
  onCopyCode, 
  onDownloadCode, 
  copiedCode 
}: QuestionViewerProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">{question.title}</h3>
          <div className="flex items-center gap-2 mt-1">
            <span className={`difficulty-badge difficulty-${question.difficulty}`}>
              {question.difficulty}
            </span>
            <span className="text-sm text-muted-foreground capitalize">
              {question.language}
            </span>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span>Time: {question.timeLimit}s</span>
              <span>Memory: {question.memoryLimit}MB</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {question.tags.map((tag, index) => (
                <span key={index} className="tag">{tag}</span>
              ))}
            </div>
          </div>
        </div>
        <button onClick={onEdit} className="btn btn-outline">
          Edit Question
        </button>
      </div>

      {question.description && (
        <div>
          <h4 className="form-label mb-2">Problem Description</h4>
          <div 
            className="bg-muted/50 rounded-lg p-4 text-sm prose prose-sm max-w-none"
            dangerouslySetInnerHTML={{ __html: question.description }}
          />
        </div>
      )}

      {question.images.length > 0 && (
        <div>
          <h4 className="form-label mb-2">Supporting Images</h4>
          <div className="image-grid">
            {question.images.map((image, index) => (
              <div key={index} className="image-item">
                <img src={image} alt={`Question image ${index + 1}`} />
              </div>
            ))}
          </div>
        </div>
      )}

      {question.testCases && question.testCases.length > 0 && (
        <div>
          <h4 className="form-label mb-2">Test Cases</h4>
          <div className="space-y-3">
            {question.testCases.map((testCase, index) => (
              <div key={testCase.id} className="test-case">
                <div className="flex items-center justify-between mb-2">
                  <h5 className="font-medium">Test Case {index + 1}</h5>
                  {testCase.isHidden && (
                    <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                      Hidden
                    </span>
                  )}
                </div>
                <div className="grid-2">
                  <div>
                    <label className="form-label">Input</label>
                    <pre className="bg-muted p-2 rounded text-sm font-mono">
                      {testCase.input || <span className="text-muted-foreground">No input</span>}
                    </pre>
                  </div>
                  <div>
                    <label className="form-label">Expected Output</label>
                    <pre className="bg-muted p-2 rounded text-sm font-mono">
                      {testCase.expectedOutput}
                    </pre>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {question.codeTemplate && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="form-label">Code Template</h4>
            <div className="code-actions">
              <button
                onClick={() => onCopyCode(question.codeTemplate!)}
                className="btn btn-outline btn-sm"
                title="Copy code"
              >
                {copiedCode === question.codeTemplate ? (
                  <CheckCircle2 className="w-3 h-3 text-green-600" />
                ) : (
                  <Copy className="w-3 h-3" />
                )}
              </button>
              <button
                onClick={() => onDownloadCode(question.codeTemplate!, question.title)}
                className="btn btn-outline btn-sm"
                title="Download code"
              >
                <Download className="w-3 h-3" />
              </button>
            </div>
          </div>
          <div className="code-editor">
            <div className="code-header">
              <span className="text-xs font-mono capitalize">{question.language}</span>
            </div>
            <pre className="code-content">
              {question.codeTemplate}
            </pre>
          </div>
        </div>
      )}

      {question.expectedOutput && (
        <div>
          <h4 className="form-label mb-2">Expected Output</h4>
          <div className="bg-muted/50 rounded-lg p-4">
            <pre className="text-sm font-mono whitespace-pre-wrap">
              {question.expectedOutput}
            </pre>
          </div>
        </div>
      )}
    </div>
  )
}