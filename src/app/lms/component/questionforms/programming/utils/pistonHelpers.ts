// Piston-run helpers shared by RunTestCasesModal, TryFunctionModal, and
// CustomInputModal. Extracted 2026-08-30.
//
// The type + 4 functions live here so the modals can build their run
// payloads / classify their results without knowing about each other. See
// [[lms-server-code-judge]] — the real grading runs server-side; these
// helpers are ONLY for the teacher's in-form dry-runs.
import type { FunctionContract } from '../types';
import { normalizeLanguage, type SupportedLanguage } from '@/lib/codeLanguages';
import { execBuildFunctionRunPayload } from './execHelpers';
import { runOnPiston, type RunResult } from '@/lib/pistonClient';

export type RunOutcome = 'pass' | 'fail' | 'compileErr' | 'runtimeErr' | 'timeout';

// Resolve the form's language string (from exercise.programmingSettings.selectedLanguages)
// to the canonical SupportedLanguage the shared Piston client expects.
// Falls back to python so the run flow can still fire something sensible for
// unknown labels — same fallback the multi-file editor uses.
export function resolveSupportedLang(lang: string): SupportedLanguage {
  return normalizeLanguage(lang) || 'python';
}

// Wrapper around the shared runOnPiston client. Runs the wrapped source as a
// SINGLE-file project (the auto-driver from execBuildFunctionRunPayload has
// already been prepended for function mode) with the test case's stdin.
export async function runOne(lang: string, source: string, stdin: string, signal?: AbortSignal): Promise<RunResult> {
  const L = resolveSupportedLang(lang);
  return await runOnPiston({
    language: L,
    files: [{ path: `main.${L === 'python' ? 'py' : L === 'javascript' ? 'js' : L === 'typescript' ? 'ts' : L === 'java' ? 'Main.java' : L === 'cpp' ? 'cpp' : L === 'c' ? 'c' : 'go'}`, content: source, isEntryPoint: true }],
    stdin,
    signal,
  });
}

export interface RunOutcomeRow {
  outcome: RunOutcome;
  actual: string;
  raw: string;
  stderr: string;
  exit: number | null;
  signal: string | null;
  runtimeMs?: number;
}
export function classifyRun(res: RunResult, expected: string, elapsedMs?: number): RunOutcomeRow {
  const compileErr = (res.compileError || '').trim();
  const stderr = (res.stderr || '').trim();
  const stdout = (res.stdout ?? res.output ?? '').toString();
  const exit = res.code;
  const signal = res.signal;
  if (compileErr) return { outcome: 'compileErr', actual: '', raw: stdout, stderr: compileErr, exit, signal, runtimeMs: elapsedMs };
  if (signal === 'SIGTERM' || signal === 'SIGKILL') return { outcome: 'timeout', actual: stdout.trim(), raw: stdout, stderr, exit, signal, runtimeMs: elapsedMs };
  if (stderr && (exit == null || exit !== 0)) return { outcome: 'runtimeErr', actual: stdout.trim(), raw: stdout, stderr, exit, signal, runtimeMs: elapsedMs };
  const actual = stdout.trim();
  const expTrim = (expected ?? '').toString().trim();
  return { outcome: actual === expTrim ? 'pass' : 'fail', actual, raw: stdout, stderr, exit, signal, runtimeMs: elapsedMs };
}

// Function-mode wrapper: prepends a hidden driver that reads a JSON test case
// from stdin, calls the configured function, and prints the return value. The
// student's own solutionCode is untouched.
export function buildFunctionRunSource(lang: string, contract: FunctionContract, solution: string): { source: string; supported: boolean } {
  return execBuildFunctionRunPayload(lang, contract, solution);
}
// Full-program: the solution is run as-is; stdin is fed from the test case.
export function buildFullProgramRunSource(_lang: string, _contract: FunctionContract, solution: string): { source: string; supported: boolean } {
  return { source: solution, supported: true };
}

// Compare the actual return (Piston stdout) to the expected literal. In
// function mode both sides are JSON-serialisable so we compare structurally
// when possible; falls back to a trimmed-string compare otherwise.
export function compareFunctionReturn(actualStdout: string, expected: string): boolean {
  const a = (actualStdout ?? '').toString().trim();
  const b = (expected ?? '').toString().trim();
  if (a === b) return true;
  try {
    const av = JSON.parse(a);
    const bv = JSON.parse(b);
    return JSON.stringify(av) === JSON.stringify(bv);
  } catch { /* fall through */ }
  return false;
}
