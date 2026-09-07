// Shared language config — imported by the workspace API route (server) and the
// multi-file code editor component (client). Keep this dependency-free so it works
// in both runtimes.

export type SupportedLanguage =
  | "python" | "javascript" | "typescript" | "java" | "cpp" | "c" | "go"

export const LANGUAGE_ORDER: SupportedLanguage[] = [
  "python", "javascript", "typescript", "java", "cpp", "c", "go",
]

export interface LanguageMeta {
  label: string
  ext: string
  filename: string
  color: string
  // Command to run from the workspace root (flat layout — file lives at root).
  runCmd: string
}

export const LANGUAGE_CONFIG: Record<SupportedLanguage, LanguageMeta> = {
  python:     { label: "Python",     ext: "py",   filename: "main.py",   color: "#3776ab", runCmd: "python main.py" },
  javascript: { label: "JavaScript", ext: "js",   filename: "main.js",   color: "#f7df1e", runCmd: "node main.js" },
  typescript: { label: "TypeScript", ext: "ts",   filename: "main.ts",   color: "#3178c6", runCmd: "ts-node main.ts" },
  java:       { label: "Java",       ext: "java", filename: "Main.java", color: "#b07219", runCmd: "javac Main.java && java Main" },
  cpp:        { label: "C++",        ext: "cpp",  filename: "main.cpp",  color: "#f34b7d", runCmd: "g++ main.cpp -o /tmp/prog && /tmp/prog" },
  c:          { label: "C",          ext: "c",    filename: "main.c",    color: "#a8b9cc", runCmd: "gcc main.c -o /tmp/prog && /tmp/prog" },
  go:         { label: "Go",         ext: "go",   filename: "main.go",   color: "#00acd7", runCmd: "go run main.go" },
}

// Normalize a raw language string (from exercise.programmingSettings.selectedLanguages)
export const normalizeLanguage = (raw: string): SupportedLanguage | null => {
  const k = (raw || "").toLowerCase().trim()
  if (k === "c++" || k === "cplusplus") return "cpp"
  if (k === "node" || k === "nodejs") return "javascript"
  if (k === "golang") return "go"
  if (k in LANGUAGE_CONFIG) return k as SupportedLanguage
  return null
}

export const detectLanguageFromFilename = (filename: string): SupportedLanguage | "text" => {
  const ext = filename.includes(".") ? filename.split(".").pop()!.toLowerCase() : ""
  const map: Record<string, SupportedLanguage> = {
    py: "python", js: "javascript", ts: "typescript",
    java: "java", cpp: "cpp", cc: "cpp", cxx: "cpp", c: "c", go: "go",
  }
  return map[ext] ?? "text"
}

// Interactive calculator starters (flat layout — file sits at the workspace root).
export const STARTER_CODE: Record<SupportedLanguage, string> = {
  python:
`# Simple Interactive Calculator (Python)
# Run:  python main.py

def main():
    a = float(input("Enter first number: "))
    op = input("Enter operator (+, -, *, /): ")
    b = float(input("Enter second number: "))

    if op == "+":
        result = a + b
    elif op == "-":
        result = a - b
    elif op == "*":
        result = a * b
    elif op == "/":
        result = a / b if b != 0 else "Error: division by zero"
    else:
        result = "Error: unknown operator"

    print("Result:", result)


if __name__ == "__main__":
    main()
`,
  javascript:
`// Simple Interactive Calculator (JavaScript / Node.js)
// Run:  node main.js

const readline = require("readline");
const rl = readline.createInterface({ input: process.stdin, terminal: false });
const lines = rl[Symbol.asyncIterator]();

const ask = async (question) => {
  process.stdout.write(question);
  const { value } = await lines.next();
  return (value ?? "").toString();
};

async function main() {
  const a = parseFloat(await ask("Enter first number: "));
  const op = (await ask("Enter operator (+, -, *, /): ")).trim();
  const b = parseFloat(await ask("Enter second number: "));

  let result;
  switch (op) {
    case "+": result = a + b; break;
    case "-": result = a - b; break;
    case "*": result = a * b; break;
    case "/": result = b !== 0 ? a / b : "Error: division by zero"; break;
    default: result = "Error: unknown operator";
  }

  console.log("Result:", result);
  rl.close();
}

main();
`,
  typescript:
`// Simple Interactive Calculator (TypeScript)
// Run:  ts-node main.ts

import * as readline from "readline";

const rl = readline.createInterface({ input: process.stdin, terminal: false });
const lines = rl[Symbol.asyncIterator]();

const ask = async (question: string): Promise<string> => {
  process.stdout.write(question);
  const { value } = await lines.next();
  return (value ?? "").toString();
};

async function main(): Promise<void> {
  const a = parseFloat(await ask("Enter first number: "));
  const op = (await ask("Enter operator (+, -, *, /): ")).trim();
  const b = parseFloat(await ask("Enter second number: "));

  let result: number | string;
  switch (op) {
    case "+": result = a + b; break;
    case "-": result = a - b; break;
    case "*": result = a * b; break;
    case "/": result = b !== 0 ? a / b : "Error: division by zero"; break;
    default: result = "Error: unknown operator";
  }

  console.log("Result:", result);
  rl.close();
}

main();
`,
  java:
`// Simple Interactive Calculator (Java)
// Run:  javac Main.java && java Main

import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);

        System.out.print("Enter first number: ");
        double a = sc.nextDouble();

        System.out.print("Enter operator (+, -, *, /): ");
        String op = sc.next();

        System.out.print("Enter second number: ");
        double b = sc.nextDouble();

        boolean valid = true;
        double result = 0;
        switch (op) {
            case "+": result = a + b; break;
            case "-": result = a - b; break;
            case "*": result = a * b; break;
            case "/":
                if (b != 0) {
                    result = a / b;
                } else {
                    System.out.println("Error: division by zero");
                    valid = false;
                }
                break;
            default:
                System.out.println("Error: unknown operator");
                valid = false;
        }

        if (valid) {
            System.out.println("Result: " + result);
        }
        sc.close();
    }
}
`,
  cpp:
`// Simple Interactive Calculator (C++)
// Run:  g++ main.cpp -o /tmp/prog && /tmp/prog

#include <iostream>
using namespace std;

int main() {
    double a, b;
    char op;

    cout << "Enter first number: ";
    cin >> a;

    cout << "Enter operator (+, -, *, /): ";
    cin >> op;

    cout << "Enter second number: ";
    cin >> b;

    switch (op) {
        case '+': cout << "Result: " << a + b << endl; break;
        case '-': cout << "Result: " << a - b << endl; break;
        case '*': cout << "Result: " << a * b << endl; break;
        case '/':
            if (b != 0) cout << "Result: " << a / b << endl;
            else cout << "Error: division by zero" << endl;
            break;
        default: cout << "Error: unknown operator" << endl;
    }

    return 0;
}
`,
  c:
`/* Simple Interactive Calculator (C)
 * Run:  gcc main.c -o /tmp/prog && /tmp/prog
 */

#include <stdio.h>

int main(void) {
    double a, b;
    char op;

    printf("Enter first number: ");
    scanf("%lf", &a);

    printf("Enter operator (+, -, *, /): ");
    scanf(" %c", &op);

    printf("Enter second number: ");
    scanf("%lf", &b);

    switch (op) {
        case '+': printf("Result: %.2f\\n", a + b); break;
        case '-': printf("Result: %.2f\\n", a - b); break;
        case '*': printf("Result: %.2f\\n", a * b); break;
        case '/':
            if (b != 0) printf("Result: %.2f\\n", a / b);
            else printf("Error: division by zero\\n");
            break;
        default: printf("Error: unknown operator\\n");
    }

    return 0;
}
`,
  go:
`// Simple Interactive Calculator (Go)
// Run:  go run main.go

package main

import (
	"bufio"
	"fmt"
	"os"
	"strconv"
	"strings"
)

func main() {
	reader := bufio.NewReader(os.Stdin)

	fmt.Print("Enter first number: ")
	aStr, _ := reader.ReadString('\\n')
	a, _ := strconv.ParseFloat(strings.TrimSpace(aStr), 64)

	fmt.Print("Enter operator (+, -, *, /): ")
	op, _ := reader.ReadString('\\n')
	op = strings.TrimSpace(op)

	fmt.Print("Enter second number: ")
	bStr, _ := reader.ReadString('\\n')
	b, _ := strconv.ParseFloat(strings.TrimSpace(bStr), 64)

	switch op {
	case "+":
		fmt.Printf("Result: %.2f\\n", a+b)
	case "-":
		fmt.Printf("Result: %.2f\\n", a-b)
	case "*":
		fmt.Printf("Result: %.2f\\n", a*b)
	case "/":
		if b != 0 {
			fmt.Printf("Result: %.2f\\n", a/b)
		} else {
			fmt.Println("Error: division by zero")
		}
	default:
		fmt.Println("Error: unknown operator")
	}
}
`,
}

// A root tsconfig.json so `ts-node main.ts` works on Node 20 + TypeScript 6.
export const TS_CONFIG_JSON = JSON.stringify({
  compilerOptions: {
    target: "ES2020",
    module: "commonjs",
    moduleResolution: "node",
    ignoreDeprecations: "6.0",
    esModuleInterop: true,
    skipLibCheck: true,
    strict: false,
  },
  "ts-node": { transpileOnly: true },
}, null, 2)

// VS Code debug launch configuration for a given language (flat layout).
export const launchConfigFor = (lang: SupportedLanguage): any => {
  switch (lang) {
    case "python":
      return { name: "Debug Python", type: "debugpy", request: "launch", program: "${workspaceFolder}/main.py", console: "integratedTerminal" }
    case "javascript":
      return { name: "Debug JavaScript", type: "node", request: "launch", program: "${workspaceFolder}/main.js", console: "integratedTerminal" }
    case "typescript":
      return { name: "Debug TypeScript", type: "node", request: "launch", program: "${workspaceFolder}/main.ts", runtimeArgs: ["-r", "ts-node/register"], console: "integratedTerminal" }
    case "java":
      return { name: "Debug Java", type: "java", request: "launch", mainClass: "Main", console: "integratedTerminal" }
    case "go":
      return { name: "Debug Go", type: "go", request: "launch", mode: "auto", program: "${workspaceFolder}/main.go", console: "integratedTerminal" }
    case "cpp":
    case "c":
      return { name: `Debug ${LANGUAGE_CONFIG[lang].label}`, type: "lldb", request: "launch", program: "${workspaceFolder}/prog", args: [], cwd: "${workspaceFolder}" }
  }
}
