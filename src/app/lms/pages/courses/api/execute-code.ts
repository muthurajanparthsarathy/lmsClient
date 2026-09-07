"use server"

interface ExecutionResult {
  output: string
  error?: string
}

export async function executeCodeAction(code: string, languageId: number, input: string): Promise<ExecutionResult> {
  try {
    // Map language IDs to Piston API language names and versions
    const languageMap: { [key: number]: { language: string; version: string } } = {
      63: { language: "javascript", version: "18.15.0" },  // JavaScript
      71: { language: "python", version: "3.10.0" },       // Python
      62: { language: "java", version: "15.0.2" },         // Java
      54: { language: "c++", version: "10.2.0" },          // C++
      74: { language: "typescript", version: "5.0.3" },    // TypeScript
    }

    const langConfig = languageMap[languageId]
    if (!langConfig) {
      return { output: "", error: "Unsupported language" }
    }

    const response = await fetch(process.env.NEXT_PUBLIC_PISTON_URL || "https://emkc.org/api/v2/piston/execute", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        language: langConfig.language,
        version: langConfig.version,
        files: [
          {
            name: getFileName(langConfig.language),
            content: code,
          },
        ],
        stdin: input,
        args: [],
        compile_timeout: 10000,
        run_timeout: 5000,
        compile_memory_limit: -1,
        run_memory_limit: -1,
      }),
    })

    const result = await response.json()

    if (result.run) {
      if (result.run.stderr) {
        return { output: "", error: result.run.stderr }
      }
      return { output: result.run.stdout || "" }
    } else if (result.compile && result.compile.stderr) {
      return { output: "", error: result.compile.stderr }
    } else {
      return { output: "", error: "Execution failed" }
    }
  } catch (error) {
    console.error("Execution error:", error)
    return { output: "", error: "Failed to execute code. Please try again." }
  }
}

function getFileName(language: string): string {
  const fileNames: { [key: string]: string } = {
    javascript: "main.js",
    python: "main.py",
    java: "Main.java",
    "c++": "main.cpp",
    typescript: "main.ts",
  }
  return fileNames[language] || "main.txt"
}