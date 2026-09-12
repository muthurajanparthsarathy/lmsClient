"use client"

import React, { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Play, Square, Download, Upload, Plus, Minus, Settings, Code, Terminal, FileText, Sun, Moon, Send } from "lucide-react"

// CodeMirror imports
import { EditorView, basicSetup } from "codemirror"
import { EditorState } from "@codemirror/state"
import { javascript } from "@codemirror/lang-javascript"
import { python } from "@codemirror/lang-python"
import { java } from "@codemirror/lang-java"
import { cpp } from "@codemirror/lang-cpp"
import { rust } from "@codemirror/lang-rust"
import { go } from "@codemirror/lang-go"
import { php } from "@codemirror/lang-php"
import { oneDark } from "@codemirror/theme-one-dark"
import { autocompletion, closeBrackets } from "@codemirror/autocomplete"
import { bracketMatching, indentOnInput } from "@codemirror/language"
import { searchKeymap, highlightSelectionMatches } from "@codemirror/search"
import { keymap, highlightActiveLine, highlightActiveLineGutter, lineNumbers } from "@codemirror/view"
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands"

// Piston API Language mapping
const LANGUAGES = {
  javascript: { 
    name: "JavaScript", 
    extension: javascript(), 
    fileExt: 'js',
    pistonLang: 'javascript',
    pistonVersion: '18.15.0',
    defaultCode: `// Interactive JavaScript example
const readline = require('readline');
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log("Hello from JavaScript!");
rl.question('What is your name? ', (name) => {
  console.log('Hello, ' + name + '!');
  rl.question('How old are you? ', (age) => {
    console.log('You are ' + age + ' years old.');
    rl.close();
  });
});`,
    inputPatterns: [
      /rl\.question\s*\(\s*['"`]([^'"`]*)['"`]\s*,/g,
      /prompt\s*\(\s*['"`]([^'"`]*)['"`]\s*\)/g
    ]
  },
  python: { 
    name: "Python", 
    extension: python(), 
    fileExt: 'py',
    pistonLang: 'python',
    pistonVersion: '3.10.0',
    defaultCode: `print("Hello from Python!")
name = input("What is your name? ")
print(f"Hello, {name}!")
age = input("How old are you? ")
print(f"You are {age} years old.")`,
    inputPatterns: [
      /input\s*\(\s*['"`]([^'"`]*)['"`]\s*\)/g,
      /input\s*\(\s*([^)]+)\s*\)/g
    ]
  },
  java: {
    name: "Java",
    extension: java(),
    fileExt: 'java',
    pistonLang: 'java',
    pistonVersion: '15.0.2',
    defaultCode: `import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
        
        System.out.println("Hello from Java!");
        System.out.print("What is your name? ");
        String name = scanner.nextLine();
        System.out.println("Hello, " + name + "!");
        
        System.out.print("How old are you? ");
        String age = scanner.nextLine();
        System.out.println("You are " + age + " years old.");
        
        scanner.close();
    }
}`,
    inputPatterns: [
      /System\.out\.print\s*\(\s*['"`]([^'"`]*)['"`]\s*\)\s*;\s*\w+\s*=\s*scanner\.\w+\(\)/g,
      /System\.out\.println\s*\(\s*['"`]([^'"`]*\?\s*)['"`]\s*\)/g
    ]
  },
  csharp: {
    name: "C#",
    extension: java(), // Using Java syntax highlighting as closest match
    fileExt: 'cs',
    pistonLang: 'csharp',
    pistonVersion: '6.12.0',
    defaultCode: `using System;

class Program
{
    static void Main()
    {
        Console.WriteLine("Hello from C#!");
        Console.Write("What is your name? ");
        string name = Console.ReadLine();
        Console.WriteLine($"Hello, {name}!");
        
        Console.Write("How old are you? ");
        string age = Console.ReadLine();
        Console.WriteLine($"You are {age} years old.");
    }
}`,
    inputPatterns: [
      /Console\.Write\s*\(\s*['"`@]([^'"`]*)['"`]\s*\)\s*;\s*\w+\s*=\s*Console\.ReadLine\(\)/g,
      /Console\.Write\s*\(\s*['"`@]([^'"`]*\?\s*)['"`]\s*\)/g
    ]
  },
  cpp: {
    name: "C++",
    extension: cpp(),
    fileExt: 'cpp',
    pistonLang: 'c++',
    pistonVersion: '10.2.0',
    defaultCode: `#include <iostream>
#include <string>
using namespace std;

int main() {
    string name, age;
    
    cout << "Hello from C++!" << endl;
    cout << "What is your name? ";
    getline(cin, name);
    cout << "Hello, " << name << "!" << endl;
    
    cout << "How old are you? ";
    getline(cin, age);
    cout << "You are " << age << " years old." << endl;
    
    return 0;
}`,
    inputPatterns: [
      /cout\s*<<\s*['"`]([^'"`]*\?\s*)['"`]/g,
      /getline\s*\(\s*cin\s*,\s*\w+\s*\)/g,
      /cin\s*>>\s*\w+/g
    ]
  },
  c: {
    name: "C",
    extension: cpp(),
    fileExt: 'c',
    pistonLang: 'c',
    pistonVersion: '10.2.0',
    defaultCode: `#include <stdio.h>
#include <string.h>

int main() {
    char name[100], age[100];
    
    printf("Hello from C!\\n");
    printf("What is your name? ");
    fgets(name, sizeof(name), stdin);
    name[strcspn(name, "\\n")] = 0; // Remove newline
    printf("Hello, %s!\\n", name);
    
    printf("How old are you? ");
    fgets(age, sizeof(age), stdin);
    age[strcspn(age, "\\n")] = 0; // Remove newline
    printf("You are %s years old.\\n", age);
    
    return 0;
}`,
    inputPatterns: [
      /printf\s*\(\s*['"`]([^'"`]*\?\s*)['"`]/g,
      /fgets\s*\(\s*\w+\s*,/g,
      /scanf\s*\(/g
    ]
  },
  rust: { 
    name: "Rust", 
    extension: rust(), 
    fileExt: 'rs',
    pistonLang: 'rust',
    pistonVersion: '1.68.2',
    defaultCode: `use std::io;

fn main() {
    println!("Hello from Rust!");
    
    println!("What is your name? ");
    let mut name = String::new();
    io::stdin().read_line(&mut name).expect("Failed to read input");
    let name = name.trim();
    println!("Hello, {}!", name);
    
    println!("How old are you? ");
    let mut age = String::new();
    io::stdin().read_line(&mut age).expect("Failed to read input");
    let age = age.trim();
    println!("You are {} years old.", age);
}`,
    inputPatterns: [
      /println!\s*\(\s*['"`]([^'"`]*\?\s*)['"`]/g,
      /io::stdin\(\)\.read_line/g
    ]
  },
  go: {
    name: "Go",
    extension: go(),
    fileExt: 'go',
    pistonLang: 'go',
    pistonVersion: '1.16.2',
    defaultCode: `package main

import (
    "bufio"
    "fmt"
    "os"
    "strings"
)

func main() {
    reader := bufio.NewReader(os.Stdin)
    
    fmt.Println("Hello from Go!")
    
    fmt.Print("What is your name? ")
    name, _ := reader.ReadString('\\n')
    name = strings.TrimSpace(name)
    fmt.Printf("Hello, %s!\\n", name)
    
    fmt.Print("How old are you? ")
    age, _ := reader.ReadString('\\n')
    age = strings.TrimSpace(age)
    fmt.Printf("You are %s years old.\\n", age)
}`,
    inputPatterns: [
      /fmt\.Print\s*\(\s*['"`]([^'"`]*\?\s*)['"`]\s*\)/g,
      /reader\.ReadString/g,
      /fmt\.Scanf/g
    ]
  },
  php: { 
    name: "PHP", 
    extension: php(), 
    fileExt: 'php',
    pistonLang: 'php',
    pistonVersion: '8.2.3',
    defaultCode: `<?php
echo "Hello from PHP!\\n";

echo "What is your name? ";
$name = trim(fgets(STDIN));
echo "Hello, " . $name . "!\\n";

echo "How old are you? ";
$age = trim(fgets(STDIN));
echo "You are " . $age . " years old.\\n";
?>`,
    inputPatterns: [
      /echo\s*['"`]([^'"`]*\?\s*)['"`]/g,
      /fgets\s*\(\s*STDIN\s*\)/g,
      /readline\s*\(/g
    ]
  },
  typescript: {
    name: "TypeScript",
    extension: javascript(),
    fileExt: 'ts',
    pistonLang: 'typescript',
    pistonVersion: '5.0.3',
    defaultCode: `// Interactive TypeScript example
const readline = require('readline');
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log("Hello from TypeScript!");

rl.question('What is your name? ', (name: string) => {
  console.log('Hello, ' + name + '!');
  rl.question('How old are you? ', (age: string) => {
    console.log('You are ' + age + ' years old.');
    rl.close();
  });
});`,
    inputPatterns: [
      /rl\.question\s*\(\s*['"`]([^'"`]*)['"`]\s*,/g,
      /prompt\s*\(\s*['"`]([^'"`]*)['"`]\s*\)/g
    ]
  }
}

interface OutputLine {
  text: string;
  type: 'output' | 'error' | 'info' | 'input-prompt' | 'user-input';
  id: string;
  isInput?: boolean;
}

interface PistonResponse {
  language: string;
  version: string;
  run: {
    stdout: string;
    stderr: string;
    code: number;
    signal: string | null;
  };
  compile?: {
    stdout: string;
    stderr: string;
    code: number;
    signal: string | null;
  };
}

interface InteractiveExecution {
  isWaitingForInput: boolean;
  currentPrompt: string;
  userInputs: string[];
  inputPrompts: string[];
  currentInputIndex: number;
  isComplete: boolean;
}

export default function CodeCompiler() {
  const [selectedLanguage, setSelectedLanguage] = useState<keyof typeof LANGUAGES>("python")
  const [outputLines, setOutputLines] = useState<OutputLine[]>([])
  const [isRunning, setIsRunning] = useState(false)
  const [isDarkMode, setIsDarkMode] = useState(true)
  const [fontSize, setFontSize] = useState(14)
  const [activeTab, setActiveTab] = useState<'output' | 'problems'>('output')
  const [problems, setProblems] = useState<string[]>([])
  const [currentInput, setCurrentInput] = useState("")
  const [interactiveExecution, setInteractiveExecution] = useState<InteractiveExecution>({
    isWaitingForInput: false,
    currentPrompt: "",
    userInputs: [],
    inputPrompts: [],
    currentInputIndex: 0,
    isComplete: false
  })
  
  const editorRef = useRef<HTMLDivElement>(null)
  const editorViewRef = useRef<EditorView | null>(null)
  const outputEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const outputContainerRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom of output
  useEffect(() => {
    if (outputContainerRef.current) {
      outputContainerRef.current.scrollTop = outputContainerRef.current.scrollHeight
    }
  }, [outputLines])

  // Focus input when waiting
  useEffect(() => {
    if (interactiveExecution.isWaitingForInput && inputRef.current) {
      inputRef.current.focus()
    }
  }, [interactiveExecution.isWaitingForInput])

  const addOutputLine = (text: string, type: 'output' | 'error' | 'info' | 'input-prompt' | 'user-input' = 'output', isInput = false) => {
    setOutputLines(prev => [...prev, { text, type, id: Math.random().toString(36), isInput }])
  }

  // Initialize CodeMirror
  useEffect(() => {
    if (!editorRef.current) return

    const extensions = [
      basicSetup,
      LANGUAGES[selectedLanguage].extension,
      lineNumbers(),
      highlightActiveLine(),
      highlightActiveLineGutter(),
      autocompletion(),
      closeBrackets(),
      bracketMatching(),
      indentOnInput(),
      history(),
      highlightSelectionMatches(),
      keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap]),
      EditorView.theme({
        "&": { 
          height: "100%",
          fontSize: `${fontSize}px`
        },
        ".cm-scroller": { 
          fontFamily: "'JetBrains Mono', 'Fira Code', 'Source Code Pro', monospace"
        },
        ".cm-focused": { outline: "none" },
        ".cm-editor": { height: "100%" },
        ".cm-content": { padding: "16px" },
        ".cm-line": { padding: "0 4px" }
      }),
      ...(isDarkMode ? [oneDark] : []),
    ]

    const state = EditorState.create({
      doc: LANGUAGES[selectedLanguage].defaultCode,
      extensions,
    })

    const view = new EditorView({
      state,
      parent: editorRef.current,
    })

    editorViewRef.current = view

    return () => {
      view.destroy()
    }
  }, [selectedLanguage, isDarkMode, fontSize])

  const validateCode = (code: string) => {
    const newProblems: string[] = []
    
    if (code.trim() === '') {
      newProblems.push("Empty code - please write some code to execute")
    }
    
    setProblems(newProblems)
    return newProblems.length === 0
  }

  // Universal input detection function
  const detectInputPrompts = (code: string, language: keyof typeof LANGUAGES): string[] => {
    const prompts: string[] = []
    const patterns = LANGUAGES[language].inputPatterns

    patterns.forEach(pattern => {
      const matches = [...code.matchAll(pattern)]
      matches.forEach(match => {
        if (match[1] && match[1].trim()) {
          // Clean up the prompt text
          let prompt = match[1].trim()
          if (prompt.endsWith('?')) {
            prompts.push(prompt)
          } else if (prompt.includes('?')) {
            prompts.push(prompt)
          } else {
            prompts.push(prompt || "Enter input")
          }
        }
      })
    })

    // Fallback detection for common patterns
    if (prompts.length === 0) {
      // Look for common input indicators
      const commonPatterns = [
        /input|Input|INPUT/g,
        /read|Read|READ/g,
        /scan|Scan|SCAN/g,
        /enter|Enter|ENTER/g
      ]

      commonPatterns.forEach(pattern => {
        if (pattern.test(code) && prompts.length < 5) { // Limit to reasonable number
          prompts.push("Enter input")
        }
      })
    }

    return prompts.length > 0 ? prompts : []
  }

  const executeInteractiveCode = async (code: string, userInputs: string[] = []) => {
    try {
      const language = LANGUAGES[selectedLanguage]
      
      // Prepare stdin with user inputs
      const stdin = userInputs.join('\\n') + (userInputs.length > 0 ? '\\n' : '')

      const submissionData = {
        language: language.pistonLang,
        version: language.pistonVersion,
        files: [
          {
            name: `main.${language.fileExt}`,
            content: code
          }
        ],
        stdin: stdin,
        compile_timeout: 10000,
        run_timeout: 10000,
        compile_memory_limit: -1,
        run_memory_limit: -1
      }

      const response = await fetch(process.env.NEXT_PUBLIC_PISTON_URL || 'https://emkc.org/api/v2/piston/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(submissionData),
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result: PistonResponse = await response.json()
      
      // Handle compilation errors (for compiled languages)
      if (result.compile && result.compile.stderr && result.compile.stderr.trim()) {
        addOutputLine("❌ Compilation Error:", 'error')
        addOutputLine(result.compile.stderr, 'error')
        setProblems(prev => [...prev, `Compilation Error: ${result.compile!.stderr}`])
        return { completed: true, hasError: true }
      }

      // Handle compilation output (warnings, etc.)
      if (result.compile && result.compile.stdout && result.compile.stdout.trim()) {
        addOutputLine("📋 Compilation Output:", 'info')
        addOutputLine(result.compile.stdout, 'info')
      }

      // Handle runtime errors
      if (result.run.stderr && result.run.stderr.trim()) {
        addOutputLine("❌ Runtime Error:", 'error')
        addOutputLine(result.run.stderr, 'error')
        setProblems(prev => [...prev, `Runtime Error: ${result.run.stderr}`])
        return { completed: true, hasError: true }
      }

      // Handle standard output
      if (result.run.stdout && result.run.stdout.trim()) {
        addOutputLine("✅ Output:", 'info')
        addOutputLine(result.run.stdout, 'output')
      } else if (!result.run.stderr && (!result.compile || !result.compile.stderr)) {
        addOutputLine("ℹ️ Program executed successfully but produced no output", 'info')
      }

      // Handle different exit codes
      if (result.run.code === 0) {
        addOutputLine("", 'info')
        addOutputLine("🎉 Program completed successfully!", 'info')
        return { completed: true, hasError: false }
      } else if (result.run.code === 124) {
        addOutputLine("", 'error')
        addOutputLine("⏰ Program timed out!", 'error')
        setProblems(prev => [...prev, "Program execution timed out"])
        return { completed: true, hasError: true }
      } else {
        addOutputLine("", 'error')
        addOutputLine(`⚠️ Program exited with code: ${result.run.code}`, 'error')
        setProblems(prev => [...prev, `Program exited with non-zero code: ${result.run.code}`])
        return { completed: true, hasError: false }
      }
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred"
      addOutputLine(`❌ ${errorMessage}`, 'error')
      setProblems(prev => [...prev, `Network/API Error: ${errorMessage}`])
      return { completed: true, hasError: true }
    }
  }

  const handleInputSubmit = async () => {
    if (!currentInput.trim() || !interactiveExecution.isWaitingForInput) return

    // Add user input to output
    addOutputLine(currentInput, 'user-input')
    
    // Update user inputs and continue execution
    const newUserInputs = [...interactiveExecution.userInputs, currentInput]
    const nextInputIndex = interactiveExecution.currentInputIndex + 1
    
    // Clear current input
    setCurrentInput("")
    
    // Check if we have more prompts to go
    if (nextInputIndex < interactiveExecution.inputPrompts.length) {
      // More inputs needed
      setInteractiveExecution(prev => ({
        ...prev,
        userInputs: newUserInputs,
        currentInputIndex: nextInputIndex,
        currentPrompt: prev.inputPrompts[nextInputIndex] || "Enter input"
      }))
      
      setTimeout(() => {
        addOutputLine(interactiveExecution.inputPrompts[nextInputIndex] + ": ", 'input-prompt')
      }, 100)
    } else {
      // All inputs collected, execute the program
      setInteractiveExecution(prev => ({
        ...prev,
        isWaitingForInput: false,
        userInputs: newUserInputs,
        currentInputIndex: nextInputIndex
      }))
      
      const code = editorViewRef.current?.state.doc.toString() || ''
      
      setTimeout(async () => {
        const result = await executeInteractiveCode(code, newUserInputs)
        
        if (result.completed) {
          setIsRunning(false)
          setInteractiveExecution(prev => ({ 
            ...prev, 
            isComplete: true,
            isWaitingForInput: false 
          }))
          
          if (result.hasError) {
            setActiveTab('problems')
          }
        }
      }, 100)
    }
  }

  const handleInputKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleInputSubmit()
    }
  }

  const executeCode = async () => {
    if (!editorViewRef.current) return

    setIsRunning(true)
    setOutputLines([])
    setActiveTab('output')
    setProblems([])
    setInteractiveExecution({
      isWaitingForInput: false,
      currentPrompt: "",
      userInputs: [],
      inputPrompts: [],
      currentInputIndex: 0,
      isComplete: false
    })
    
    const code = editorViewRef.current.state.doc.toString()
    
    if (!validateCode(code)) {
      setIsRunning(false)
      setActiveTab('problems')
      return
    }

    try {
      addOutputLine("🚀 Starting execution...", 'info')
      addOutputLine("", 'info')
      
      const language = LANGUAGES[selectedLanguage]
      
      // Detect input prompts in the code
      const detectedPrompts = detectInputPrompts(code, selectedLanguage)
      
      if (detectedPrompts.length > 0) {
        addOutputLine(`📝 Running interactive ${language.name} program...`, 'info')
        addOutputLine(`🔍 Detected ${detectedPrompts.length} input prompt(s)`, 'info')
        addOutputLine("", 'info')
        
        // Start interactive execution
        setInteractiveExecution(prev => ({
          ...prev,
          isWaitingForInput: true,
          inputPrompts: detectedPrompts,
          currentPrompt: detectedPrompts[0] || "Enter input",
          currentInputIndex: 0
        }))
        
        addOutputLine(detectedPrompts[0] + ": ", 'input-prompt')
        return
      }

      // For non-interactive programs, use the regular Piston API
      addOutputLine(`📝 Executing ${language.name} code...`, 'info')
      addOutputLine("", 'info')

      const result = await executeInteractiveCode(code, [])
      
      if (result.completed) {
        setIsRunning(false)
        if (result.hasError) {
          setActiveTab('problems')
        }
      }
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred"
      addOutputLine(`❌ ${errorMessage}`, 'error')
      addOutputLine("", 'error')
      addOutputLine("💡 Possible solutions:", 'info')
      addOutputLine("1. Check your internet connection", 'info')
      addOutputLine("2. Verify the Piston API is accessible", 'info')
      addOutputLine("3. Try again in a few moments", 'info')
      setProblems(prev => [...prev, `Network/API Error: ${errorMessage}`])
      setActiveTab('problems')
      setIsRunning(false)
    }
  }

  const stopExecution = () => {
    setIsRunning(false)
    setInteractiveExecution(prev => ({
      ...prev,
      isWaitingForInput: false,
      isComplete: true
    }))
    addOutputLine("⏹️ Execution stopped by user", 'info')
  }

  const handleLanguageChange = (language: keyof typeof LANGUAGES) => {
    setSelectedLanguage(language)
    setOutputLines([])
    setProblems([])
    setInteractiveExecution({
      isWaitingForInput: false,
      currentPrompt: "",
      userInputs: [],
      inputPrompts: [],
      currentInputIndex: 0,
      isComplete: false
    })
  }

  const downloadCode = () => {
    if (!editorViewRef.current) return

    const code = editorViewRef.current.state.doc.toString()
    const blob = new Blob([code], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `code.${LANGUAGES[selectedLanguage].fileExt}`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const uploadFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || !editorViewRef.current) return

    const reader = new FileReader()
    reader.onload = (e) => {
      const content = e.target?.result as string
      const transaction = editorViewRef.current!.state.update({
        changes: {
          from: 0,
          to: editorViewRef.current!.state.doc.length,
          insert: content,
        },
      })
      editorViewRef.current!.dispatch(transaction)
    }
    reader.readAsText(file)
  }

  const clearOutput = () => {
    setOutputLines([])
    setProblems([])
    setInteractiveExecution({
      isWaitingForInput: false,
      currentPrompt: "",
      userInputs: [],
      inputPrompts: [],
      currentInputIndex: 0,
      isComplete: false
    })
  }

  const insertTemplate = () => {
    if (!editorViewRef.current) return
    
    const template = LANGUAGES[selectedLanguage].defaultCode
    const transaction = editorViewRef.current.state.update({
      changes: {
        from: 0,
        to: editorViewRef.current.state.doc.length,
        insert: template,
      },
    })
    editorViewRef.current.dispatch(transaction)
  }

  return (
    <div className={`h-screen flex flex-col overflow-hidden ${isDarkMode ? 'dark' : ''}`}>
      {/* Header - Fixed */}
      <div className="border-b bg-gradient-to-r from-emerald-600 via-blue-600 to-purple-600 text-white shadow-lg flex-shrink-0">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Code className="w-6 h-6" />
              Universal Code Compiler
            </h1>
            
            <Select value={selectedLanguage} onValueChange={handleLanguageChange}>
              <SelectTrigger className="w-44 bg-white/10 border-white/20 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(LANGUAGES).map(([key, lang]) => (
                  <SelectItem key={key} value={key}>
                    {lang.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <Button 
              onClick={executeCode} 
              disabled={isRunning} 
              className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white border-none"
            >
              <Play className="w-4 h-4" />
              {isRunning ? "Running..." : "Run Code"}
            </Button>

            <Button 
              onClick={stopExecution} 
              disabled={!isRunning && !interactiveExecution.isWaitingForInput} 
              className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white border-none"
            >
              <Square className="w-4 h-4" />
              Stop
            </Button>

            <Button 
              onClick={insertTemplate} 
              variant="outline" 
              className="border-white/20 bg-white/10 text-white hover:bg-white/20"
            >
              Template
            </Button>

            <Button 
              onClick={clearOutput} 
              variant="outline" 
              className="border-white/20 bg-white/10 text-white hover:bg-white/20"
            >
              Clear
            </Button>

            <Button 
              onClick={downloadCode} 
              variant="outline" 
              className="border-white/20 bg-white/10 text-white hover:bg-white/20"
            >
              <Download className="w-4 h-4" />
            </Button>

            <Button 
              variant="outline" 
              className="border-white/20 bg-white/10 text-white hover:bg-white/20" 
              asChild
            >
              <label htmlFor="file-upload" className="cursor-pointer flex items-center gap-2">
                <Upload className="w-4 h-4" />
                Upload
              </label>
            </Button>
            <input
              id="file-upload"
              type="file"
              className="hidden"
              onChange={uploadFile}
              accept={`.${LANGUAGES[selectedLanguage].fileExt},.txt`}
            />

            <div className="flex items-center border border-white/20 rounded bg-white/10">
              <Button 
                onClick={() => setFontSize(prev => Math.max(prev - 2, 10))} 
                variant="ghost" 
                size="sm"
                className="text-white hover:bg-white/20"
              >
                <Minus className="w-4 h-4" />
              </Button>
              <span className="px-3 text-sm text-white">{fontSize}px</span>
              <Button 
                onClick={() => setFontSize(prev => Math.min(prev + 2, 24))} 
                variant="ghost" 
                size="sm"
                className="text-white hover:bg-white/20"
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>

            <Button 
              onClick={() => setIsDarkMode(!isDarkMode)} 
              variant="outline" 
              className="border-white/20 bg-white/10 text-white hover:bg-white/20"
            >
              {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content - Flexible */}
      <div className="flex-1 flex overflow-hidden">
        {/* Editor Side - Scrollable */}
        <div className="flex-1 flex flex-col min-w-0">
          <div ref={editorRef} className="flex-1 border-r overflow-auto" />
        </div>

        {/* Side Panel - Scrollable */}
        <div className="w-96 flex flex-col border-l min-w-0">
          {/* Tabs - Fixed */}
          <div className="flex border-b bg-muted/30 flex-shrink-0">
            <button
              onClick={() => setActiveTab('output')}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'output' 
                  ? 'border-blue-500 text-blue-600 bg-blue-50 dark:bg-blue-900/20' 
                  : 'border-transparent hover:text-blue-500'
              }`}
            >
              <Terminal className="w-4 h-4" />
              Terminal
            </button>
            <button
              onClick={() => setActiveTab('problems')}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'problems' 
                  ? 'border-red-500 text-red-600 bg-red-50 dark:bg-red-900/20' 
                  : 'border-transparent hover:text-red-500'
              }`}
            >
              <FileText className="w-4 h-4" />
              Problems 
              {problems.length > 0 && (
                <span className="bg-red-500 text-white rounded-full text-xs px-2 py-0.5 min-w-[1.25rem] text-center">
                  {problems.length}
                </span>
              )}
            </button>
          </div>

          {/* Tab Content - Scrollable */}
          <div className="flex-1 overflow-hidden flex flex-col min-h-0">
            {activeTab === 'output' && (
              <div className="flex-1 flex flex-col overflow-hidden">
                {/* Output Area - Scrollable */}
                <div 
                  ref={outputContainerRef}
                  className="flex-1 overflow-auto p-4 bg-gray-50 dark:bg-gray-900"
                >
                  <div className="space-y-1 font-mono text-sm">
                    {outputLines.length === 0 ? (
                      <div className="text-muted-foreground italic space-y-2">
                        <div>Click 'Run Code' to execute your program...</div>
                        <div className="text-xs space-y-1">
                          <div>💡 Interactive programs support all languages</div>
                          <div>🔄 Each input call will wait for your input</div>
                          <div>🌍 Supported languages:</div>
                          <div className="bg-gray-200 dark:bg-gray-800 p-2 rounded text-xs font-mono">
                            Python • Java • C++ • C • C# • JavaScript<br/>
                            TypeScript • Rust • Go • PHP
                          </div>
                          <div className="mt-2">📝 Try an interactive example with any language!</div>
                        </div>
                      </div>
                    ) : (
                      outputLines.map((line) => (
                        <div 
                          key={line.id} 
                          className={`whitespace-pre-wrap ${
                            line.type === 'error' 
                              ? 'text-red-600 dark:text-red-400' 
                              : line.type === 'info'
                              ? 'text-blue-600 dark:text-blue-400'
                              : line.type === 'input-prompt'
                              ? 'text-green-600 dark:text-green-400 font-semibold'
                              : line.type === 'user-input'
                              ? 'text-yellow-600 dark:text-yellow-400 ml-4 font-semibold'
                              : 'text-foreground'
                          }`}
                        >
                          {line.type === 'user-input' ? `> ${line.text}` : line.text}
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Input Area - Fixed at bottom when waiting for input */}
                {interactiveExecution.isWaitingForInput && (
                  <div className="border-t p-3 bg-green-50 dark:bg-green-900/20 flex-shrink-0">
                    <div className="text-xs text-green-600 dark:text-green-400 mb-2 font-medium">
                      💬 Program is waiting for input ({interactiveExecution.currentInputIndex + 1}/{interactiveExecution.inputPrompts.length}):
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-green-600 dark:text-green-400">
                        &gt; 
                      </span>
                      <Input
                        ref={inputRef}
                        value={currentInput}
                        onChange={(e) => setCurrentInput(e.target.value)}
                        onKeyPress={handleInputKeyPress}
                        placeholder="Type your input here and press Enter..."
                        className="flex-1 font-mono text-sm"
                      />
                      <Button 
                        onClick={handleInputSubmit}
                        size="sm"
                        className="bg-green-600 hover:bg-green-700 text-white"
                      >
                        <Send className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
            
            {activeTab === 'problems' && (
              <div className="flex-1 p-4 overflow-auto">
                {problems.length === 0 ? (
                  <div className="text-sm text-muted-foreground flex items-center gap-2">
                    <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                    No problems detected
                  </div>
                ) : (
                  <div className="space-y-2">
                    {problems.map((problem, index) => (
                      <div 
                        key={index} 
                        className="text-sm p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md flex items-start gap-2"
                      >
                        <span className="w-2 h-2 bg-red-500 rounded-full mt-2 flex-shrink-0"></span>
                        <span>{problem}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Status Bar - Fixed */}
      <div className="border-t bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 px-4 py-2 text-xs flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-6">
          <span className="flex items-center gap-2">
            <span className="font-medium">Language:</span>
            <span className="text-blue-600 dark:text-blue-400">{LANGUAGES[selectedLanguage].name}</span>
          </span>
          <span className="flex items-center gap-2">
            <span className="font-medium">Version:</span>
            <span>{LANGUAGES[selectedLanguage].pistonVersion}</span>
          </span>
          <span className="flex items-center gap-2">
            <span className="font-medium">Font:</span>
            <span>{fontSize}px</span>
          </span>
          <span className="flex items-center gap-2">
            <span className="font-medium">Theme:</span>
            <span>{isDarkMode ? 'Dark' : 'Light'}</span>
          </span>
          <span className="flex items-center gap-2">
            <span className="font-medium">Inputs:</span>
            <span className="text-green-600 dark:text-green-400">{interactiveExecution.userInputs.length}</span>
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-muted-foreground">
            {isRunning 
              ? (interactiveExecution.isWaitingForInput 
                  ? `Waiting for input (${interactiveExecution.currentInputIndex + 1}/${interactiveExecution.inputPrompts.length})...` 
                  : 'Executing...') 
              : 'Ready'} • {outputLines.length} lines • Universal Interactive Terminal
          </span>
        </div>
      </div>
    </div>
  )
}