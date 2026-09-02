"use client"
import { getToken } from "@/lib/session";

import type React from "react"
import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import {
  Play,
  Square,
  Download,
  Upload,
  Plus,
  Minus,
  Code,
  Terminal,
  FileText,
  Sun,
  Moon,
  Send,
  Save,
  Loader2,
  ChevronDown,
  ChevronUp,
  Sparkles,
} from "lucide-react"
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
// Animation imports
import { motion, AnimatePresence } from "framer-motion"

// Piston API Language mapping
const LANGUAGES = {
  javascript: {
    name: "JavaScript",
    extension: javascript(),
    fileExt: "js",
    pistonLang: "javascript",
    pistonVersion: "18.15.0",
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
    inputPatterns: [/rl\.question\s*\(\s*['"`]([^'"`]*)['"`]\s*,/g, /prompt\s*$$\s*['"`]([^'"`]*)['"`]\s*$$/g],
  },
  python: {
    name: "Python",
    extension: python(),
    fileExt: "py",
    pistonLang: "python",
    pistonVersion: "3.10.0",
    defaultCode: `print("Hello from Python!")
name = input("What is your name? ")
print(f"Hello, {name}!")
age = input("How old are you? ")
print(f"You are {age} years old.")`,
    inputPatterns: [/input\s*\(\s*['"`]([^'"`]*)['"`]\s*\)/g],
  },
 java: {
    name: "Java",
    extension: java(),
    fileExt: "java",
    pistonLang: "java",
    pistonVersion: "15.0.2",
    defaultCode: `import java.util.Scanner;
import java.time.LocalDate;
import java.time.Period;
import java.time.format.DateTimeFormatter;

public class Main {
    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
        
        System.out.println("Hello from Java!");
        System.out.print("What is your name? ");
        String name = scanner.nextLine();
        System.out.println("Hello, " + name + "!");
        
        try {
            System.out.print("Enter your Date of Birth (YYYY-MM-DD): ");
            String dobString = scanner.nextLine();
            
            LocalDate dob = LocalDate.parse(dobString);
            LocalDate today = LocalDate.now();
            
            // Calculate age
            Period age = Period.between(dob, today);
            
            System.out.println("Your age is: " + age.getYears() + " years");
            
            // Example check (18+ validation)
            if (age.getYears() >= 18) {
                System.out.println("You are eligible (18+).");
            } else {
                System.out.println("You are not eligible (under 18).");
            }
            
        } catch (Exception e) {
            System.out.println("Invalid date format! Please use YYYY-MM-DD.");
        }
        
        scanner.close();
    }
}`,
    // Fixed Java input patterns
    inputPatterns: [
      /System\.out\.print\s*\(\s*["']([^"']*)["']\s*\)\s*;\s*[^;]*\s*=\s*scanner\.nextLine\s*\(\s*\)/g,
      /System\.out\.print\s*\(\s*["']([^"']*\??\s*)["']\s*\)/g,
      /scanner\.nextLine\s*\(\s*\)/g,
      /scanner\.next\s*\(\s*\)/g,
      /scanner\.nextInt\s*\(\s*\)/g,
      /scanner\.nextDouble\s*\(\s*\)/g,
    ],
  },
 csharp: {
    name: "C#",
    extension: java(), // Using Java syntax highlighting as closest match
    fileExt: "cs",
    pistonLang: "csharp",
    pistonVersion: "6.12.0",
    defaultCode: `using System;
using System.Collections.Generic;
using System.Linq;

class FlamesChecker
{
    static void Main(string[] args)
    {
        Console.Write("Enter Name 1: ");
        string name1 = Console.ReadLine();

        Console.Write("Enter Name 2: ");
        string name2 = Console.ReadLine();

        string result = FlamesResult(name1, name2);
        Console.WriteLine("FLAMES Result: " + result);
    }

    static string FlamesResult(string raw1, string raw2)
    {
        string n1 = Sanitize(raw1);
        string n2 = Sanitize(raw2);

        if (n1.Length == 0 || n2.Length == 0)
        {
            return "Invalid input (need alphabetic characters).";
        }

        int unmatched = CountUnmatchedLetters(n1, n2);
        int step = (unmatched == 0) ? 1 : unmatched;

        List<char> flames = new List<char> { 'F', 'L', 'A', 'M', 'E', 'S' };

        int idx = 0;
        while (flames.Count > 1)
        {
            idx = (idx + step - 1) % flames.Count;
            flames.RemoveAt(idx);
        }

        return MapFlames(flames[0]);
    }

    static string Sanitize(string s)
    {
        return new string(s.Where(char.IsLetter).ToArray()).ToLower();
    }

    static int CountUnmatchedLetters(string a, string b)
    {
        int[] f1 = new int[26];
        int[] f2 = new int[26];

        foreach (char c in a) f1[c - 'a']++;
        foreach (char c in b) f2[c - 'a']++;

        int sum = 0;
        for (int i = 0; i < 26; i++)
        {
            sum += Math.Abs(f1[i] - f2[i]);
        }
        return sum;
    }

    static string MapFlames(char c)
    {
        return c switch
        {
            'F' => "Friends",
            'L' => "Love",
            'A' => "Affection",
            'M' => "Marriage",
            'E' => "Enemies",
            'S' => "Siblings",
            _ => "Unknown"
        };
    }
}`,
    // Fixed C# input patterns - prevent duplicate detection
    inputPatterns: [
      // Pattern for Console.Write followed by Console.ReadLine on the same line
      /Console\.Write(?:Line)?\s*\(\s*"([^"]+)"\s*\)\s*;\s*[^=]*=\s*Console\.ReadLine\s*\(\s*\)/g,
    ],
  },
  cpp: {
    name: "C++",
    extension: cpp(),
    fileExt: "cpp",
    pistonLang: "c++",
    pistonVersion: "10.2.0",
    defaultCode: `#include <iostream>
#include <string>
using namespace std;

int main() {
    string name, age;
    
    cout << "Hello from C++!" << endl;
    cout << "What is your name? ";
    getline(cin, name);
    cout << "Hello, " + name + "!" << endl;
    
    cout << "How old are you? ";
    getline(cin, age);
    cout << "You are " + age + " years old." << endl;
    
    return 0;
}`,
    inputPatterns: [/cout\s*<<\s*['"`]([^'"`]*\?\s*)['"`]/g, /getline\s*\(\s*cin\s*,\s*\w+\s*\)/g, /cin\s*>>\s*\w+/g],
  },
  c: {
    name: "C",
    extension: cpp(),
    fileExt: "c",
    pistonLang: "c",
    pistonVersion: "10.2.0",
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
    inputPatterns: [/printf\s*\(\s*['"`]([^'"`]*\?\s*)['"`]/g, /fgets\s*\(\s*\w+\s*,/g, /scanf\s*\(/g],
  },
rust: {
  name: "Rust",
  extension: rust(),
  fileExt: "rs",
  pistonLang: "rust",
  pistonVersion: "1.68.2",
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
  // More specific input patterns for Rust
  inputPatterns: [
    // Match println! followed by read_line
    /println!\s*\(\s*"([^"]+)"\s*\)\s*;\s*[^;]*read_line/g,
    // Match print! followed by read_line
    /print!\s*\(\s*"([^"]+)"\s*\)\s*;\s*[^;]*read_line/g,
    // Match println! with question mark followed by read_line
    /println!\s*\(\s*"([^"]*\?)"\s*\)\s*;\s*[^;]*read_line/g,
  ],
},

go: {
  name: "Go",
  extension: go(),
  fileExt: "go",
  pistonLang: "go",
  pistonVersion: "1.16.2",
  defaultCode: `package main

import (
	"bufio"
	"fmt"
	"os"
	"strings"
	"unicode"
)

func cleanInput(s string) string {
	s = strings.ToLower(s)
	s = strings.ReplaceAll(s, " ", "")
	var cleaned string
	for _, r := range s {
		if unicode.IsLetter(r) {
			cleaned += string(r)
		}
	}
	return cleaned
}

func getRemainingCount(name1, name2 string) int {
	freq1 := make(map[rune]int)
	freq2 := make(map[rune]int)

	for _, c := range name1 {
		freq1[c]++
	}

	for _, c := range name2 {
		freq2[c]++
	}

	// Cancel out common characters
	for ch, count1 := range freq1 {
		if count2, ok := freq2[ch]; ok {
			min := count1
			if count2 < count1 {
				min = count2
			}
			freq1[ch] -= min
			freq2[ch] -= min
		}
	 }

	remaining := 0
	for _, v := range freq1 {
		remaining += v
	}
	for _, v := range freq2 {
		remaining += v
	}

	return remaining
}

func flamesResult(count int) string {
	flames := []rune{'F', 'L', 'A', 'M', 'E', 'S'}
	meanings := map[rune]string{
		'F': "Friends",
		'L': "Love",
		'A': "Affection",
		'M': "Marriage",
		'E': "Enemies",
		'S': "Siblings",
	}

	index := 0
	for len(flames) > 1 {
		index = (index + count - 1) % len(flames)
		flames = append(flames[:index], flames[index+1:]...)
	}

	return meanings[flames[0]]
}

func main() {
	reader := bufio.NewReader(os.Stdin)

	fmt.Print("Enter the first name: ")
	name1, _ := reader.ReadString('\\n')
	name1 = cleanInput(name1)

	fmt.Print("Enter the second name: ")
	name2, _ := reader.ReadString('\\n')
	name2 = cleanInput(name2)

	count := getRemainingCount(name1, name2)
	result := flamesResult(count)

	fmt.Printf("FLAMES result for '%s' and '%s': %s\\n", name1, name2, result)
}`,
  inputPatterns: [
    /fmt\.Print(?:f?)\s*\(\s*"([^"]+)"\s*\)/g,
    /fmt\.Print(?:f?)\s*\(\s*'([^']+)'\s*\)/g,
  ],
},
  php: {
    name: "PHP",
    extension: php(),
    fileExt: "php",
    pistonLang: "php",
    pistonVersion: "8.2.3",
    defaultCode: `<?php
echo "Hello from PHP!\\n";

echo "What is your name? ";
$name = trim(fgets(STDIN));
echo "Hello, " . $name . "!\\n";

echo "How old are you? ";
$age = trim(fgets(STDIN));
echo "You are " . $age + " years old.\\n";
?>`,
    inputPatterns: [/echo\s*['"`]([^'"`]*\?\s*)['"`]/g, /fgets\s*\(\s*STDIN\s*\)/g, /readline\s*\(/g],
  },

}

interface OutputLine {
  text: string
  type: "output" | "error" | "info" | "input-prompt" | "user-input"
  id: string
  isInput?: boolean
}

interface PistonResponse {
  language: string
  version: string
  run: {
    stdout: string
    stderr: string
    code: number
    signal: string | null
  }
  compile?: {
    stdout: string
    stderr: string
    code: number
    signal: string | null
  }
}

interface InteractiveExecution {
  isWaitingForInput: boolean
  currentPrompt: string
  userInputs: string[]
  inputPrompts: string[]
  currentInputIndex: number
  isComplete: boolean
}

// Animation variants
const fadeIn = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.3 } }
}

const slideIn = {
  hidden: { opacity: 0, y: -10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3 } }
}

const slideUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } }
}

const scaleIn = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.3 } }
}

const pulse = {
  pulse: { scale: [1, 1.02, 1], transition: { duration: 1, repeat: Infinity } }
}

const buttonHover = {
  hover: { 
    scale: 1.05,
    transition: { duration: 0.2 }
  },
  tap: { scale: 0.95 }
}

const tabTransition = {
  hidden: { opacity: 0, x: -20 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.2 } },
  exit: { opacity: 0, x: 20, transition: { duration: 0.2 } }
}

export default function CodeCompiler() {
  const [selectedLanguage, setSelectedLanguage] = useState<keyof typeof LANGUAGES>("python")
  const [outputLines, setOutputLines] = useState<OutputLine[]>([])
  const [isRunning, setIsRunning] = useState(false)
  const [isDarkMode, setIsDarkMode] = useState(true)
  const [fontSize, setFontSize] = useState(14)
  const [activeTab, setActiveTab] = useState<"output" | "problems">("output")
  const [problems, setProblems] = useState<string[]>([])
  const [currentInput, setCurrentInput] = useState("")
  const [showInlineInput, setShowInlineInput] = useState(false)
  const [interactiveExecution, setInteractiveExecution] = useState<InteractiveExecution>({
    isWaitingForInput: false,
    currentPrompt: "",
    userInputs: [],
    inputPrompts: [],
    currentInputIndex: 0,
    isComplete: false,
  })
  const [userId, setUserId] = useState<string>("68660173382d4419d8ecacbe")
  const [courseId, setCourseId] = useState<string>("6874c6fe7a5f692c8f434ff8")
  const [isSaving, setIsSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState<{ type: "success" | "error" | null; message: string }>({
    type: null,
    message: "",
  })
  const [isExpanded, setIsExpanded] = useState(true)

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

  const addOutputLine = (
    text: string,
    type: "output" | "error" | "info" | "input-prompt" | "user-input" = "output",
    isInput = false,
  ) => {
    setOutputLines((prev) => [...prev, { text, type, id: Math.random().toString(36), isInput }])
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
          fontSize: `${fontSize}px`,
        },
        ".cm-scroller": {
          fontFamily: "'JetBrains Mono', 'Fira Code', 'Source Code Pro', monospace",
          height: "100%",
        },
        ".cm-focused": { outline: "none" },
        ".cm-editor": {
          height: "100%",
          minHeight: "calc(100vh * var(--ui-scale-inv, 1))",
        },
        ".cm-content": {
          padding: "16px",
          minHeight: "100%",
        },
        ".cm-line": { padding: "0 4px" },
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

    if (code.trim() === "") {
      newProblems.push("Empty code - please write some code to execute")
    }

    setProblems(newProblems)
    return newProblems.length === 0
  }

  // Universal input detection function
  const detectInputPrompts = (code: string, language: keyof typeof LANGUAGES): string[] => {
    const prompts: string[] = []
    const patterns = LANGUAGES[language].inputPatterns

    patterns.forEach((pattern) => {
      const matches = [...code.matchAll(pattern)]
      matches.forEach((match) => {
        if (match[1] && match[1].trim()) {
          // Clean up the prompt text
          const prompt = match[1].trim()
          if (prompt.endsWith("?")) {
            prompts.push(prompt)
          } else if (prompt.includes("?")) {
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
      const commonPatterns = [/input|Input|INPUT/g, /read|Read|READ/g, /scan|Scan|SCAN/g, /enter|Enter|ENTER/g]

      commonPatterns.forEach((pattern) => {
        if (pattern.test(code) && prompts.length < 5) {
          // Limit to reasonable number
          prompts.push("Enter input")
        }
      })
    }

    return prompts.length > 0 ? prompts : []
  }

  const executeInteractiveCode = async (
    code: string,
    userInputs: string[],
  ): Promise<{ completed: boolean; hasError: boolean }> => {
    try {
      const language = LANGUAGES[selectedLanguage]

      const inputString = userInputs.length > 0 ? userInputs.join("\n") + "\n" : ""

      const response = await fetch(process.env.NEXT_PUBLIC_PISTON_URL || "https://emkc.org/api/v2/piston/execute", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          language: language.pistonLang,
          version: language.pistonVersion,
          files: [
            {
              name: `main.${language.fileExt}`,
              content: code,
            },
          ],
          stdin: inputString, // Properly formatted stdin
          args: [],
          compile_timeout: 10000,
          run_timeout: 5000, // Increased timeout for interactive programs
        }),
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result: PistonResponse = await response.json()

      // Handle compilation errors (for compiled languages)
      if (result.compile && result.compile.stderr && result.compile.stderr.trim()) {
        addOutputLine("❌ Compilation Error:", "error")
        addOutputLine(result.compile.stderr, "error")
        setProblems((prev) => [...prev, `Compilation Error: ${result.compile!.stderr}`])
        return { completed: true, hasError: true }
      }

      // Handle compilation output (warnings, etc.)
      if (result.compile && result.compile.stdout && result.compile.stdout.trim()) {
        addOutputLine("📋 Compilation Output:", "info")
        addOutputLine(result.compile.stdout, "info")
      }

      // Handle runtime errors
      if (result.run.stderr && result.run.stderr.trim()) {
        // Check if it's an EOF error (expected for interactive programs)
        if (result.run.stderr.includes("EOF when reading a line")) {
          // This is expected for interactive programs, don't treat as error
          addOutputLine("ℹ️ Program is waiting for input", "info")
          return { completed: false, hasError: false }
        }
        
        addOutputLine("❌ Runtime Error:", "error")
        addOutputLine(result.run.stderr, "error")
        setProblems((prev) => [...prev, `Runtime Error: ${result.run.stderr}`])
        return { completed: true, hasError: true }
      }

      // Handle standard output
      if (result.run.stdout && result.run.stdout.trim()) {
        // Split output by lines to handle partial outputs
        const outputLines = result.run.stdout.split('\n')
        outputLines.forEach(line => {
          if (line.trim()) {
            addOutputLine(line, "output")
          }
        })
      } else if (!result.run.stderr && (!result.compile || !result.compile.stderr)) {
        addOutputLine("ℹ️ Program executed successfully but produced no output", "info")
      }

      // Handle different exit codes
      if (result.run.code === 0) {
        addOutputLine("", "info")
        addOutputLine("🎉 Program completed successfully!", "info")
        return { completed: true, hasError: false }
      } else if (result.run.code === 124) {
        addOutputLine("", "error")
        addOutputLine("⏰ Program timed out!", "error")
        setProblems((prev) => [...prev, "Program execution timed out"])
        return { completed: true, hasError: true }
      } else {
        addOutputLine("", "error")
        addOutputLine(`⚠️ Program exited with code: ${result.run.code}`, "error")
        setProblems((prev) => [...prev, `Program exited with non-zero code: ${result.run.code}`])
        return { completed: true, hasError: false }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred"
      addOutputLine(`❌ ${errorMessage}`, "error")
      setProblems((prev) => [...prev, `Network/API Error: ${errorMessage}`])
      return { completed: true, hasError: true }
    }
  }

  const handleInputSubmit = async () => {
    if (!currentInput.trim() || !interactiveExecution.isWaitingForInput) return

    // Add user input to output right after the prompt
    const newOutputLines = [...outputLines]
    const lastPromptIndex = newOutputLines.findLastIndex(line => line.type === "input-prompt")
    
    if (lastPromptIndex !== -1) {
      // Update the prompt line to include the user input
      newOutputLines[lastPromptIndex] = {
        ...newOutputLines[lastPromptIndex],
        text: newOutputLines[lastPromptIndex].text + currentInput,
        type: "output" // Change type to output since it's now complete
      }
      setOutputLines(newOutputLines)
    } else {
      // Fallback: add user input as a separate line
      addOutputLine(currentInput, "user-input")
    }
    
    // Update user inputs and continue execution
    const newUserInputs = [...interactiveExecution.userInputs, currentInput]
    const nextInputIndex = interactiveExecution.currentInputIndex + 1

    if (nextInputIndex < interactiveExecution.inputPrompts.length) {
      // More inputs needed, show next prompt
      setInteractiveExecution((prev) => ({
        ...prev,
        userInputs: newUserInputs,
        currentInputIndex: nextInputIndex,
        currentPrompt: prev.inputPrompts[nextInputIndex] || "Enter input",
      }))

      addOutputLine(interactiveExecution.inputPrompts[nextInputIndex] + " ", "input-prompt")
      setCurrentInput("")
      setShowInlineInput(true)
      return
    }

    setInteractiveExecution((prev) => ({
      ...prev,
      isWaitingForInput: false,
      userInputs: newUserInputs,
      currentInputIndex: nextInputIndex,
    }))

    setCurrentInput("")
    setShowInlineInput(false)
    addOutputLine("", "info")
    addOutputLine("🔄 Executing program with provided inputs...", "info")
    addOutputLine("", "info")

    // Execute with all collected inputs
    const code = editorViewRef.current?.state.doc.toString() || ""
    const result = await executeInteractiveCode(code, newUserInputs)

    if (result.completed) {
      setIsRunning(false)
      if (result.hasError) {
        setActiveTab("problems")
      }
    } else if (!result.hasError) {
      // Program is still waiting for input
      setInteractiveExecution((prev) => ({
        ...prev,
        isWaitingForInput: true,
      }))
      addOutputLine("ℹ️ Program is waiting for more input", "info")
    }
  }

  const handleInputKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleInputSubmit()
    }
  }

  const runCode = async () => {
    if (isRunning) return

    setIsRunning(true)
    setOutputLines([])
    setProblems([])
    setActiveTab("output")

    // Reset interactive execution state
    setInteractiveExecution({
      isWaitingForInput: false,
      inputPrompts: [],
      userInputs: [],
      currentPrompt: "",
      currentInputIndex: 0,
      isComplete: false,
    })

    const code = editorViewRef.current?.state.doc.toString() || ""

    if (!validateCode(code)) {
      setIsRunning(false)
      setActiveTab("problems")
      return
    }

    try {
      addOutputLine("🚀 Starting execution...", "info")
      addOutputLine("", "info")

      const language = LANGUAGES[selectedLanguage]

      // Detect input prompts in the code
      const detectedPrompts = detectInputPrompts(code, selectedLanguage)

      if (detectedPrompts.length > 0) {
        addOutputLine(`📝 Running interactive ${language.name} program...", "info`)
        addOutputLine(`🔍 Detected ${detectedPrompts.length} input prompt(s)`, "info")

        detectedPrompts.forEach((prompt, index) => {
          addOutputLine(`${index + 1}. ${prompt}`, "info")
        })
        addOutputLine("", "info")

        // Start interactive execution
        setInteractiveExecution((prev) => ({
          ...prev,
          isWaitingForInput: true,
          inputPrompts: detectedPrompts,
          currentPrompt: detectedPrompts[0] || "Enter input",
          currentInputIndex: 0,
        }))

        addOutputLine(detectedPrompts[0] + " ", "input-prompt")
        setShowInlineInput(true)
        return
      }

      // For non-interactive programs, use the regular Piston API
      addOutputLine(`📝 Executing ${language.name} code...`, "info")
      addOutputLine("", "info")

      const result = await executeInteractiveCode(code, [])

      if (result.completed) {
        setIsRunning(false)
        if (result.hasError) {
          setActiveTab("problems")
        }
      } else if (!result.hasError) {
        // Program is waiting for input but we didn't detect prompts
        setInteractiveExecution((prev) => ({
          ...prev,
          isWaitingForInput: true,
          inputPrompts: ["Enter input"],
          currentPrompt: "Enter input",
          currentInputIndex: 0,
        }))
        addOutputLine("Enter input: ", "input-prompt")
        setShowInlineInput(true)
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred"
      addOutputLine(`❌ ${errorMessage}`, "error")
      setProblems((prev) => [...prev, `Execution Error: ${errorMessage}`])
      setIsRunning(false)
      setActiveTab("problems")
    }
  }

  const stopExecution = () => {
    setIsRunning(false)
    setInteractiveExecution((prev) => ({
      ...prev,
      isWaitingForInput: false,
      isComplete: true,
    }))
    addOutputLine("⏹️ Execution stopped by user", "info")
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
      isComplete: false,
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
      isComplete: false,
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

  const saveCode = async () => {
    if (!editorViewRef.current) return

    const code = editorViewRef.current.state.doc.toString()

    if (!userId || !courseId) {
      setSaveStatus({ type: "error", message: "Please enter User ID and Course ID" })
      return
    }

    if (!code.trim()) {
      setSaveStatus({ type: "error", message: "Cannot save empty code" })
      return
    }

    setIsSaving(true)
    setSaveStatus({ type: null, message: "" })

    try {
      const response = await fetch("http://localhost:5533/save/compiler", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${getToken() || ""}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId,
          courseId,
          language: selectedLanguage,
          code,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        setSaveStatus({ type: "success", message: `Code saved successfully! Version: ${data.version}` })
      } else {
        setSaveStatus({ type: "error", message: data.message?.[0]?.value || "Failed to save code" })
      }
    } catch (error) {
      setSaveStatus({ type: "error", message: "Network error. Please try again." })
    } finally {
      setIsSaving(false)
    }
  }

  const loadUserCode = async () => {
    if (!userId) {
      setSaveStatus({ type: "error", message: "Please enter User ID to load code" })
      return
    }

    if (!courseId) {
      setSaveStatus({ type: "error", message: "Please enter Course ID to load code" })
      return
    }

    try {
      const response = await fetch(`http://localhost:5533/get/compiler/${userId}/${courseId}`, {
        headers: {
          Authorization: `Bearer ${getToken() || ""}`,
          "Content-Type": "application/json",
        },
      })
      const data = await response.json()

      if (response.ok && data.success && data.submissions) {
        const submissions = data.submissions

        if (!submissions || submissions.length === 0) {
          setSaveStatus({ type: "error", message: "No submissions found for this course" })
          return
        }

        console.log("[v0] Selected language:", selectedLanguage)
        console.log(
          "[v0] Available submissions:",
          submissions.map((s: any) => ({ language: s.language, hasCode: !!s.code })),
        )

        const submission = submissions.find((s: any) => s.language.toLowerCase() === selectedLanguage.toLowerCase())

        if (!submission) {
          const languageName = LANGUAGES[selectedLanguage]?.name || selectedLanguage
          const availableLanguages = submissions.map((s: any) => s.language).join(", ")
          setSaveStatus({
            type: "error",
            message: `No ${languageName} code found for this course. Available languages: ${availableLanguages}`,
          })
          return
        }

        // Set the code in editor
        if (editorViewRef.current) {
          const transaction = editorViewRef.current.state.update({
            changes: {
              from: 0,
              to: editorViewRef.current.state.doc.length,
              insert: submission.code,
            },
          })
          editorViewRef.current.dispatch(transaction)
        }

        const languageName = LANGUAGES[selectedLanguage]?.name || selectedLanguage
        setSaveStatus({
          type: "success",
          message: `${languageName} code loaded successfully! Version: ${submission.version}`,
        })
      } else {
        setSaveStatus({ type: "error", message: data.message?.[0]?.value || "No saved code found" })
      }
    } catch (error) {
      setSaveStatus({ type: "error", message: "Failed to load code" })
    }
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-background dark:bg-gray-900">
      {/* Header - Fixed */}
      <motion.div 
        initial="hidden"
        animate="visible"
        variants={slideIn}
        className="border-b bg-gradient-to-r from-emerald-600 via-blue-600 to-purple-600 text-white shadow-lg flex-shrink-0"
      >
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-4">
            <motion.h1 
              className="text-xl font-bold flex items-center gap-2"
              whileHover={{ scale: 1.02 }}
              transition={{ type: "spring", stiffness: 400, damping: 10 }}
            >
              <Code className="w-6 h-6" />
              Universal Code Compiler
            </motion.h1>

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
            <motion.div whileHover="hover" whileTap="tap" variants={buttonHover}>
              <Button
                onClick={saveCode}
                disabled={isSaving}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white border-none"
              >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {isSaving ? "Saving..." : "Save"}
              </Button>
            </motion.div>

            <motion.div whileHover="hover" whileTap="tap" variants={buttonHover}>
              <Button
                onClick={runCode}
                disabled={isRunning}
                className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white border-none"
              >
                {isRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                {isRunning ? "Running..." : "Run"}
              </Button>
            </motion.div>

            <motion.div whileHover="hover" whileTap="tap" variants={buttonHover}>
              <Button
                onClick={stopExecution}
                disabled={!isRunning && !interactiveExecution.isWaitingForInput}
                className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white border-none"
              >
                <Square className="w-4 h-4" />
                Stop
              </Button>
            </motion.div>

            <motion.div whileHover="hover" whileTap="tap" variants={buttonHover}>
              <Button
                onClick={insertTemplate}
                variant="outline"
                className="border-white/20 bg-white/10 text-white hover:bg-white/20"
              >
                Template
              </Button>
            </motion.div>

            <motion.div whileHover="hover" whileTap="tap" variants={buttonHover}>
              <Button
                onClick={clearOutput}
                variant="outline"
                className="border-white/20 bg-white/10 text-white hover:bg-white/20"
              >
                Clear
              </Button>
            </motion.div>

            <motion.div whileHover="hover" whileTap="tap" variants={buttonHover}>
              <Button
                onClick={downloadCode}
                variant="outline"
                className="border-white/20 bg-white/10 text-white hover:bg-white/20"
              >
                <Download className="w-4 h-4" />
              </Button>
            </motion.div>

            <motion.div whileHover="hover" whileTap="tap" variants={buttonHover}>
              <Button variant="outline" className="border-white/20 bg-white/10 text-white hover:bg-white/20" asChild>
                <label htmlFor="file-upload" className="cursor-pointer flex items-center gap-2">
                  <Upload className="w-4 h-4" />
                  Upload
                </label>
              </Button>
            </motion.div>
            <input
              id="file-upload"
              type="file"
              className="hidden"
              onChange={uploadFile}
              accept={`.${LANGUAGES[selectedLanguage]?.fileExt || "txt"},.txt`}
            />

            <div className="flex items-center border border-white/20 rounded bg-white/10">
              <motion.div whileHover="hover" whileTap="tap" variants={buttonHover}>
                <Button
                  onClick={() => setFontSize((prev) => Math.max(prev - 2, 10))}
                  variant="ghost"
                  size="sm"
                  className="text-white hover:bg-white/20"
                >
                  <Minus className="w-4 h-4" />
                </Button>
              </motion.div>
              <span className="px-3 text-sm text-white">{fontSize}px</span>
              <motion.div whileHover="hover" whileTap="tap" variants={buttonHover}>
                <Button
                  onClick={() => setFontSize((prev) => Math.min(prev + 2, 24))}
                  variant="ghost"
                  size="sm"
                  className="text-white hover:bg-white/20"
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </motion.div>
            </div>

            <motion.div whileHover="hover" whileTap="tap" variants={buttonHover}>
              <Button
                onClick={() => setIsDarkMode(!isDarkMode)}
                variant="outline"
                className="border-white/20 bg-white/10 text-white hover:bg-white/20"
              >
                {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </Button>
            </motion.div>
          </div>
        </div>

        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="overflow-hidden"
            >
              <div className="px-4 pb-4 flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium">User ID:</label>
                  <Input
                    type="text"
                    value={userId}
                    onChange={(e) => setUserId(e.target.value)}
                    placeholder="Enter user ID"
                    className="px-3 py-1 rounded bg-white/10 border border-white/20 text-white placeholder-white/60 text-sm w-32"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium">Course ID:</label>
                  <Input
                    type="text"
                    value={courseId}
                    onChange={(e) => setCourseId(e.target.value)}
                    placeholder="Enter course ID"
                    className="px-3 py-1 rounded bg-white/10 border border-white/20 text-white placeholder-white/60 text-sm w-32"
                  />
                </div>

                <motion.div whileHover="hover" whileTap="tap" variants={buttonHover}>
                  <Button
                    onClick={loadUserCode}
                    className="bg-purple-600 hover:bg-purple-700 text-white border-none text-sm px-3 py-1 h-8"
                  >
                    Load Code
                  </Button>
                </motion.div>

                {saveStatus.type && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`text-sm px-3 py-1 rounded ${
                      saveStatus.type === "success"
                        ? "bg-green-500/20 text-green-100 border border-green-400/30"
                        : "bg-red-500/20 text-red-100 border border-red-400/30"
                    }`}
                  >
                    {saveStatus.message}
                  </motion.div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex justify-center pb-2">
          <motion.button
            onClick={() => setIsExpanded(!isExpanded)}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            className="text-white/60 hover:text-white"
          >
            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </motion.button>
        </div>
      </motion.div>

      {/* Main Content - Flexible */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Editor Side - Scrollable */}
        <motion.div 
          initial="hidden"
          animate="visible"
          variants={fadeIn}
          className="flex-1 flex flex-col min-w-0 min-h-0"
        >
          <div ref={editorRef} className="flex-1 border-r overflow-auto min-h-0 h-full" />
        </motion.div>

        {/* Side Panel - Scrollable */}
        <motion.div 
          initial="hidden"
          animate="visible"
          variants={slideIn}
          className="w-96 flex flex-col border-l min-w-0"
        >
          {/* Tabs - Fixed */}
          <div className="flex border-b bg-muted/30 flex-shrink-0">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setActiveTab("output")}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === "output"
                  ? "border-blue-500 text-blue-600 bg-blue-50 dark:bg-blue-900/20"
                  : "border-transparent hover:text-blue-500"
              }`}
            >
              <Terminal className="w-4 h-4" />
              Terminal
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setActiveTab("problems")}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === "problems"
                  ? "border-red-500 text-red-600 bg-red-50 dark:bg-red-900/20"
                  : "border-transparent hover:text-red-500"
              }`}
            >
              <FileText className="w-4 h-4" />
              Problems
              {problems.length > 0 && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="bg-red-500 text-white rounded-full text-xs px-2 py-0.5 min-w-[1.25rem] text-center"
                >
                  {problems.length}
                </motion.span>
              )}
            </motion.button>
          </div>

          {/* Tab Content - Scrollable */}
          <div className="flex-1 overflow-hidden flex flex-col min-h-0">
            <AnimatePresence mode="wait">
              {activeTab === "output" && (
                <motion.div
                  key="output"
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  variants={tabTransition}
                  className="flex-1 flex flex-col overflow-hidden min-h-0"
                >
                  {/* Output Area - Scrollable */}
                  <div ref={outputContainerRef} className="flex-1 overflow-auto p-4 bg-gray-50 dark:bg-gray-900">
                    <div className="space-y-1 font-mono text-sm">
                      {outputLines.length === 0 ? (
                        <motion.div 
                          initial="hidden"
                          animate="visible"
                          variants={fadeIn}
                          className="text-muted-foreground italic space-y-2"
                        >
                          <div>Click 'Run Code' to execute your program...</div>
                          <div className="text-xs space-y-1">
                            <div>💡 Interactive programs support all languages</div>
                            <div>🔄 Each input call will wait for your input</div>
                            <div>🌍 Supported languages:</div>
                            <div className="bg-gray-200 dark:bg-gray-800 p-2 rounded text-xs font-mono">
                              Python • Java • C++ • C • C# • JavaScript
                              <br />
                               Rust • Go • PHP
                            </div>
                            <div className="mt-2">📝 Try an interactive example with any language!</div>
                          </div>
                        </motion.div>
                      ) : (
                        outputLines.map((line, index) => (
                          <motion.div
                            key={line.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.05 }}
                            className={`whitespace-pre-wrap ${
                              line.type === "error"
                                ? "text-red-600 dark:text-red-400"
                                : line.type === "info"
                                  ? "text-blue-600 dark:text-blue-400"
                                  : line.type === "input-prompt"
                                    ? "text-green-600 dark:text-green-400 font-semibold"
                                    : line.type === "user-input"
                                      ? "text-yellow-600 dark:text-yellow-400 ml-4 font-semibold"
                                      : "text-foreground"
                            }`}
                          >
                            {line.type === "input-prompt" &&
                            interactiveExecution.isWaitingForInput &&
                            outputLines[outputLines.length - 1]?.id === line.id ? (
                              <div className="flex items-center">
                                <span>{line.text}</span>
                                <Input
                                  ref={inputRef}
                                  value={currentInput}
                                  onChange={(e) => setCurrentInput(e.target.value)}
                                  onKeyPress={handleInputKeyPress}
                                  className="ml-2 w-48 h-6 text-sm font-mono bg-transparent border-none p-0 text-green-600 dark:text-green-400 font-semibold focus:ring-0 focus:outline-none"
                                  placeholder=""
                                  autoFocus
                                />
                              </div>
                            ) : line.type === "user-input" ? (
                              `> ${line.text}`
                            ) : (
                              line.text
                            )}
                          </motion.div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Input Area - Fixed at bottom when waiting for input */}
                  {false && interactiveExecution.isWaitingForInput && (
                    <motion.div 
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="border-t p-3 bg-green-50 dark:bg-green-900/20 flex-shrink-0"
                    >
                      <div className="text-xs text-green-600 dark:text-green-400 mb-2 font-medium">
                        💬 Program is waiting for input ({interactiveExecution.currentInputIndex + 1}/
                        {interactiveExecution.inputPrompts.length}):
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-green-600 dark:text-green-400">&gt;</span>
                        <Input
                          ref={inputRef}
                          value={currentInput}
                          onChange={(e) => setCurrentInput(e.target.value)}
                          onKeyPress={handleInputKeyPress}
                          placeholder="Type your input here and press Enter..."
                          className="flex-1 font-mono text-sm"
                        />
                        <motion.div whileHover="hover" whileTap="tap" variants={buttonHover}>
                          <Button
                            onClick={handleInputSubmit}
                            size="sm"
                            className="bg-green-600 hover:bg-green-700 text-white"
                          >
                            <Send className="w-4 h-4" />
                          </Button>
                        </motion.div>
                      </div>
                    </motion.div>
                  )}
                </motion.div>
              )}

              {activeTab === "problems" && (
                <motion.div
                  key="problems"
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  variants={tabTransition}
                  className="flex-1 p-4 overflow-auto"
                >
                  {problems.length === 0 ? (
                    <motion.div 
                      initial="hidden"
                      animate="visible"
                      variants={fadeIn}
                      className="text-sm text-muted-foreground flex items-center gap-2"
                    >
                      <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                      No problems detected
                    </motion.div>
                  ) : (
                    <div className="space-y-2">
                      {problems.map((problem, index) => (
                        <motion.div
                          key={index}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.1 }}
                          className="text-sm p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md flex items-start gap-2"
                        >
                          <span className="w-2 h-2 bg-red-500 rounded-full mt-2 flex-shrink-0"></span>
                          <span>{problem}</span>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>

      {/* Status Bar - Fixed */}
      <motion.div 
        initial="hidden"
        animate="visible"
        variants={slideIn}
        className="border-t bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 px-4 py-2 text-xs flex items-center justify-between flex-shrink-0"
      >
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
            <span>{isDarkMode ? "Dark" : "Light"}</span>
          </span>
          <span className="flex items-center gap-2">
            <span className="font-medium">Inputs:</span>
            <span className="text-green-600 dark:text-green-400">{interactiveExecution.userInputs.length}</span>
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-muted-foreground">
            {isRunning
              ? interactiveExecution.isWaitingForInput
                ? `Waiting for input (${interactiveExecution.currentInputIndex + 1}/${interactiveExecution.inputPrompts.length})...`
                : "Executing..."
              : "Ready"}{" "}
            • {outputLines.length} lines • Universal Interactive Terminal
          </span>
          <motion.div
            animate="pulse"
            variants={pulse}
            className="flex items-center gap-1 text-purple-600 dark:text-purple-400"
          >
            <Sparkles size={12} />
            <span>Live</span>
          </motion.div>
        </div>
      </motion.div>
    </div>
  )
} 