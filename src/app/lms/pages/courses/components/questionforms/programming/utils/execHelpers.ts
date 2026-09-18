// Execution-setup helpers for the Programming form.
// Extracted 2026-08-30 from ProgrammingQuestionForm.tsx.
//
// The Programming form's Execution Setup lets the teacher configure:
//   1. `executionType`      — 'function' or 'fullProgram'
//   2. `functionContract`   — the signature students code against in function mode
//   3. `startingExperience` — Blank / Generated / Custom starter
//
// These helpers own the language-idiomatic pieces of that flow: the type
// catalogue per language, the signature preview, the auto-generated starter,
// the conceptual driver preview, and the real wrapper prepended to a
// submission when the teacher hits "Try Function".
//
// Contract: every helper that touches a language MUST canonicalise via
// `normalizeExecLang()` first. The DB stores language as lowercase
// ('python' / 'javascript') while the UI selector uses the capitalised label
// ('Python') — mixing them silently returned empty strings before this was
// enforced (blank signature, blank starter).

import type { FunctionContract, FunctionParam, TC } from '../types';

// Language-aware type catalogue. The label matches the language idiom (Python
// "integer[]" vs Java "int[]"). Serialized as-is; the wrapper builders below
// map it to real syntax when they emit the driver.
export const EXEC_DATA_TYPES: Record<string, string[]> = {
  Python:     ['integer', 'decimal', 'boolean', 'string', 'integer[]', 'decimal[]', 'string[]', 'custom'],
  JavaScript: ['integer', 'decimal', 'boolean', 'string', 'integer[]', 'decimal[]', 'string[]', 'custom'],
  Java:       ['int', 'double', 'boolean', 'String', 'int[]', 'double[]', 'String[]', 'custom'],
  'C++':      ['int', 'double', 'bool', 'string', 'vector<int>', 'vector<double>', 'vector<string>', 'custom'],
  C:          ['int', 'double', '_Bool', 'char*', 'int*', 'double*', 'char**', 'custom'],
};

// Case/alias-tolerant language canonicaliser. Existing exercises store their
// selected language as lowercase 'python' / 'javascript' etc., while the UI
// selector uses the capitalised label ('Python') — everywhere execution-setup
// helpers compare against a language, they MUST route through this first, or
// they silently return empty strings (blank signature, blank starter).
export const normalizeExecLang = (lang: string): string => {
  const s = (lang || '').toString().trim().toLowerCase();
  if (s === 'python' || s === 'py' || s === 'python3') return 'Python';
  if (s === 'javascript' || s === 'js' || s === 'node' || s === 'nodejs' || s === 'typescript' || s === 'ts') return 'JavaScript';
  if (s === 'java') return 'Java';
  if (s === 'c++' || s === 'cpp' || s === 'cplusplus') return 'C++';
  if (s === 'c') return 'C';
  return lang || 'Python';
};

export const execDataTypesFor = (lang: string): string[] =>
  EXEC_DATA_TYPES[normalizeExecLang(lang)] || EXEC_DATA_TYPES.Python;

export const mkFunctionContract = (): FunctionContract => ({
  functionName: '',
  returnType: 'integer',
  params: [],
});

export const mkFunctionParam = (i: number = 0): FunctionParam => ({
  id: `fp-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 5)}`,
  name: `p${i + 1}`,
  type: 'integer',
});

// Language-aware signature (single line) shown as a preview inside the contract.
export function execSignatureFor(lang: string, contract: FunctionContract): string {
  const L = normalizeExecLang(lang);
  const fname = contract.functionName || 'solve';
  const params = contract.params.map(p => ({ name: p.name || '?', type: p.type || 'string' }));
  if (L === 'Python')     return `def ${fname}(${params.map(p => `${p.name}: ${p.type}`).join(', ')}) -> ${contract.returnType}:`;
  if (L === 'JavaScript') return `function ${fname}(${params.map(p => `/* ${p.type} */ ${p.name}`).join(', ')}) /* -> ${contract.returnType} */ {`;
  if (L === 'Java')       return `public ${jType(contract.returnType)} ${fname}(${params.map(p => `${jType(p.type)} ${p.name}`).join(', ')}) {`;
  if (L === 'C++')        return `${cppType(contract.returnType)} ${fname}(${params.map(p => `${cppType(p.type)} ${p.name}`).join(', ')}) {`;
  if (L === 'C')          return `${cType(contract.returnType)} ${fname}(${params.map(p => `${cType(p.type)} ${p.name}`).join(', ')}) {`;
  return `def ${fname}(${params.map(p => `${p.name}: ${p.type}`).join(', ')}) -> ${contract.returnType}:`;
}

export function jType(t: string): string { return ({ integer:'int', decimal:'double', boolean:'boolean', string:'String', 'integer[]':'int[]', 'decimal[]':'double[]', 'string[]':'String[]', custom:'Object' } as any)[t] || t; }
export function cppType(t: string): string { return ({ integer:'int', decimal:'double', boolean:'bool', string:'std::string', 'integer[]':'std::vector<int>', 'decimal[]':'std::vector<double>', 'string[]':'std::vector<std::string>', custom:'auto' } as any)[t] || t; }
export function cType(t: string): string { return ({ integer:'int', decimal:'double', boolean:'int', string:'char*', 'integer[]':'int*', 'decimal[]':'double*', 'string[]':'char**' } as any)[t] || t; }

// Auto-generated starter skeleton (Generated Starter mode). Always safe —
// students see this as the initial editor content; it's never used to grade.
export function execGeneratedStarter(lang: string, contract: FunctionContract): string {
  const L = normalizeExecLang(lang);
  const sig = execSignatureFor(L, contract);
  if (L === 'Python')     return `${sig}\n    # Write your code here\n    pass`;
  if (L === 'JavaScript') return `${sig}\n  // Write your code here\n}`;
  if (L === 'Java')       return `class Solution {\n    ${sig}\n        // Write your code here\n        return ${jDefault(contract.returnType)};\n    }\n}`;
  if (L === 'C++')        return `${sig}\n    // Write your code here\n    return ${cppDefault(contract.returnType)};\n}`;
  if (L === 'C')          return `${sig}\n    /* Write your code here */\n    return ${cDefault(contract.returnType)};\n}`;
  // Fallback: Python-style skeleton so the editor never renders empty.
  return `${sig}\n    # Write your code here\n    pass`;
}

export function jDefault(t: string): string { return ({ integer:'0', decimal:'0.0', boolean:'false', string:'""', 'integer[]':'new int[0]', 'decimal[]':'new double[0]', 'string[]':'new String[0]' } as any)[t] || 'null'; }
export function cppDefault(t: string): string { return ({ integer:'0', decimal:'0.0', boolean:'false', string:'""', 'integer[]':'{}', 'decimal[]':'{}', 'string[]':'{}' } as any)[t] || '{}'; }
export function cDefault(t: string): string { return ({ integer:'0', decimal:'0.0', boolean:'0', string:'""' } as any)[t] || '0'; }

// Conceptual driver preview shown to the teacher. String, not executed —
// mirrors the real wrapper the run flow prepends to the submission.
export function execDriverPreview(lang: string, contract: FunctionContract): string {
  const L = normalizeExecLang(lang);
  const fname = contract.functionName || 'solve';
  const argNames = contract.params.map(p => p.name || 'x');
  if (L === 'Python')
    return `# hidden driver — auto-generated at run time\nimport json, sys\n_tc = json.loads(sys.stdin.read())\n_ret = ${fname}(${argNames.map(n => `_tc[${JSON.stringify(n)}]`).join(', ')})\nprint(json.dumps(_ret))`;
  if (L === 'JavaScript')
    return `// hidden driver — auto-generated at run time\nconst _tc = JSON.parse(require('fs').readFileSync(0, 'utf8'));\nconst _ret = ${fname}(${argNames.map(n => `_tc[${JSON.stringify(n)}]`).join(', ')});\nconsole.log(JSON.stringify(_ret));`;
  if (L === 'Java')
    return `// hidden driver — auto-generated at run time\n// Reads {"p1":..,"p2":..} from stdin, calls new Solution().${fname}(...)\n// and prints the returned value.`;
  if (L === 'C++')
    return `// hidden driver — auto-generated at run time\n// Reads {"p1":..,"p2":..} from stdin, calls ${fname}(...)\n// and prints the returned value.`;
  if (L === 'C')
    return `/* hidden driver — auto-generated at run time */\n/* Reads {"p1":..,"p2":..} from stdin, calls ${fname}(...) and prints the return */`;
  return `# hidden driver — auto-generated at run time\n# Reads a JSON test case from stdin, calls ${fname}(...) and prints the return.`;
}

// The REAL wrapper prepended to the student's submission when running function
// mode. Only Python + JavaScript are fully wrapped — Java/C++/C fall back to
// a compile-warning payload because a generic wrapper requires full JSON→type
// deserialization the teacher can't customise here. The Run modal surfaces
// this limitation clearly.
export function execBuildFunctionRunPayload(lang: string, contract: FunctionContract, solution: string): { source: string; supported: boolean } {
  const L = normalizeExecLang(lang);
  const fname = contract.functionName || 'solve';
  const argNames = contract.params.map(p => p.name || 'x');
  if (L === 'Python') {
    const src = `${solution}\n\nif __name__ == "__main__":\n    import json, sys\n    _tc = json.loads(sys.stdin.read())\n    _ret = ${fname}(${argNames.map(n => `_tc[${JSON.stringify(n)}]`).join(', ')})\n    print(json.dumps(_ret))\n`;
    return { source: src, supported: true };
  }
  if (L === 'JavaScript') {
    const src = `${solution}\n\n(function(){\n  const _tc = JSON.parse(require('fs').readFileSync(0, 'utf8'));\n  const _ret = ${fname}(${argNames.map(n => `_tc[${JSON.stringify(n)}]`).join(', ')});\n  console.log(JSON.stringify(_ret));\n})();\n`;
    return { source: src, supported: true };
  }
  return { source: solution, supported: false };
}

// Best-effort coerce of a teacher-authored literal into a real JS value so it
// can be shipped to Piston as JSON. Accepts JSON, then numbers, then booleans,
// then bare arrays with number literals, else returns the trimmed string.
export function coerceTcInput(raw: string): any {
  const s = (raw ?? '').trim();
  if (s === '') return '';
  try { return JSON.parse(s); } catch {}
  if (/^-?\d+$/.test(s)) return parseInt(s, 10);
  if (/^-?\d*\.\d+$/.test(s)) return parseFloat(s);
  if (s === 'true' || s === 'false') return s === 'true';
  return s;
}

export function tcInputsToPayload(tc: TC, params: FunctionParam[]): Record<string, any> {
  const out: Record<string, any> = {};
  params.forEach(p => { out[p.name] = coerceTcInput((tc.functionInputs || {})[p.name] || ''); });
  return out;
}
