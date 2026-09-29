// The teacher-facing mock modal — a preview of what the student sees when
// attempting this question. Runs solution against Piston directly (bypasses
// the auth-gated server proxy) so the teacher can dry-run without polluting
// the students' rate-limit. Extracted 2026-08-30.
import React, { useState, useEffect, useRef } from 'react';
import {
  X, Check, ChevronLeft, ChevronRight, Code, Loader2, Play,
} from 'lucide-react';
import { toast } from 'react-toastify';
import type { FlowQuestion, ProgContentBlock } from '../types';
import { DS } from '../constants';

// ─── PROGRAMMING MOCK MODAL ───────────────────────────────────────────────────

const PISTON_API_URL_MOCK = process.env.NEXT_PUBLIC_PISTON_URL || "https://emkc.org/api/v2/piston/execute";

const getPistonLangMock = (lang: string): { language: string; version: string } => {
  const map: Record<string, { language: string; version: string }> = {
    javascript: { language: 'javascript', version: '18.15.0' },
    python: { language: 'python', version: '3.10.0' },
    java: { language: 'java', version: '15.0.2' },
    cpp: { language: 'cpp', version: '10.2.0' },
    c: { language: 'c', version: '10.2.0' },
    csharp: { language: 'csharp', version: '6.12.0' },
    typescript: { language: 'typescript', version: '5.0.3' },
  };
  return map[lang.toLowerCase()] || { language: 'javascript', version: '18.15.0' };
};

interface ConsoleLine {
  id: string;
  type: 'output' | 'error' | 'input' | 'system';
  text: string;
}

export const ProgrammingMockModal: React.FC<{
  questions: FlowQuestion[];
  selectedLanguages: string[];
  onClose: () => void;
  exerciseIsGraded?: boolean;
}> = ({ questions, selectedLanguages, onClose, exerciseIsGraded = true }) => {
  const [idx, setIdx] = useState(0);
  const [code, setCode] = useState('');
  const [lang, setLang] = useState(selectedLanguages[0]?.toLowerCase() || 'python');
  const [consoleLines, setConsoleLines] = useState<ConsoleLine[]>([]);
  const [consoleInput, setConsoleInput] = useState('');
  const [waitingForInput, setWaitingForInput] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [pyodideReady, setPyodideReady] = useState(false);
  const pyodideRef = useRef<any>(null);
  const codeRef = useRef<HTMLTextAreaElement>(null);
  const consoleEndRef = useRef<HTMLDivElement>(null);
  const consoleInputRef = useRef<HTMLInputElement>(null);
  const inputResolverRef = useRef<((v: string) => void) | null>(null);

  const q = questions[idx];

  const qTitleBlocks: ProgContentBlock[] = [{ id: 'title-text', type: 'text', value: typeof q?.title === 'string' ? q.title : 'Untitled' }];

  const descBlocks: ProgContentBlock[] = q?.description && ((q.description as any).contentBlocks || (q.description as any).blocks)
    ? ((q.description as any).contentBlocks || (q.description as any).blocks)
    : [{ id: 'desc-text', type: 'text', value: typeof q?.description === 'object' ? (q?.description as any)?.text || '' : q?.description || '' }];

  const sampleTcs = q?.testCases?.filter((t: any) => t.isSample && (t.input?.trim() || t.expectedOutput?.trim())) || [];
  const hasConstraints = q?.constraints?.filter((c: string) => c.trim()).length > 0;
  const hasDescription = descBlocks.some(b => b.type !== 'text' || (b as any).value?.trim());

  useEffect(() => {
    if (lang === 'python' && !pyodideReady && !pyodideRef.current) {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/pyodide/v0.23.4/full/pyodide.js';
      script.onload = async () => {
        try {
          const pyodide = await (window as any).loadPyodide({ indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.23.4/full/' });
          pyodideRef.current = pyodide;
          setPyodideReady(true);
        } catch (e) { console.warn('Pyodide load error:', e); }
      };
      document.head.appendChild(script);
    }
  }, [lang]);

  useEffect(() => { consoleEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [consoleLines]);
  useEffect(() => { if (waitingForInput) consoleInputRef.current?.focus(); }, [waitingForInput]);

  useEffect(() => {
    setCode('');
    setConsoleLines([]);
    setWaitingForInput(false);
    setIsRunning(false);
    inputResolverRef.current = null;
    if (lang === 'python') setConsoleInput('');
  }, [idx, lang]);

  const mkLineId = () => `cl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const appendLine = (type: ConsoleLine['type'], text: string) => {
    setConsoleLines(prev => [...prev, { id: mkLineId(), type, text }]);
  };
  const streamText = async (text: string, type: 'output' | 'error' = 'output') => {
    if (!text) return;
    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (lines[i] !== '' || i < lines.length - 1) {
        appendLine(type, lines[i]);
        await new Promise(r => setTimeout(r, 35));
      }
    }
  };
  const submitInput = () => {
    if (!waitingForInput || !inputResolverRef.current) return;
    const val = consoleInput;
    appendLine('input', val);
    setConsoleInput('');
    setWaitingForInput(false);
    const resolve = inputResolverRef.current;
    inputResolverRef.current = null;
    resolve(val);
  };

  const executeCode = async () => {
    if (!code.trim()) { appendLine('system', '⚠ Please write some code first.'); return; }
    setConsoleLines([{ id: mkLineId(), type: 'system', text: `▶ Running ${lang}…` }]);
    setIsRunning(true);
    setWaitingForInput(false);
    inputResolverRef.current = null;
    try {
      if (lang === 'python') {
        if (!pyodideReady || !pyodideRef.current) {
          appendLine('system', '⌛ Python runtime loading… Please wait and try again.');
          setIsRunning(false);
          return;
        }
        pyodideRef.current.setStdin({
          readline: () => new Promise<string>(resolve => {
            setWaitingForInput(true);
            inputResolverRef.current = (val: string) => resolve(val + '\n');
          })
        });
        const outLines: string[] = [];
        const errLines: string[] = [];
        pyodideRef.current.setStdout({ batched: (s: string) => { outLines.push(s); } });
        pyodideRef.current.setStderr({ batched: (s: string) => { errLines.push(s); } });
        try {
          const runPromise = pyodideRef.current.runPythonAsync(code);
          const flushInterval = setInterval(() => {
            if (outLines.length > 0) {
              const pending = outLines.splice(0);
              pending.forEach(s => {
                s.split('\n').forEach((line, i, arr) => {
                  if (line !== '' || i < arr.length - 1) {
                    setConsoleLines(prev => [...prev, { id: mkLineId(), type: 'output', text: line }]);
                  }
                });
              });
            }
          }, 50);
          await runPromise;
          clearInterval(flushInterval);
          const remaining = outLines.splice(0);
          for (const s of remaining) await streamText(s, 'output');
          for (const s of errLines) await streamText(s, 'error');
          appendLine('system', '✓ Process finished (exit 0)');
        } catch (e: any) {
          const remaining = outLines.splice(0);
          for (const s of remaining) await streamText(s, 'output');
          await streamText(e.message || String(e), 'error');
          appendLine('system', '✗ Process exited with error');
        }
      } else {
        const stdinVal = consoleInput;
        const pistonLang = getPistonLangMock(lang);
        const resp = await fetch(PISTON_API_URL_MOCK, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            language: pistonLang.language, version: pistonLang.version,
            files: [{ name: 'main', content: code }],
            stdin: stdinVal, args: [],
            compile_timeout: 10000, run_timeout: 8000,
            compile_memory_limit: -1, run_memory_limit: -1,
          }),
        });
        const data = await resp.json();
        if (data.run) {
          const out = (data.run.output || '').trim();
          const err = (data.run.stderr || '').trim();
          if (out) await streamText(out, 'output');
          if (err) await streamText(err, 'error');
          if (!out && !err) appendLine('system', '(no output)');
          appendLine('system', `✓ Process finished (exit ${data.run.code ?? 0})`);
        } else {
          appendLine('error', 'Execution failed — unexpected API response');
        }
      }
    } catch (e: any) {
      appendLine('error', `Network error: ${e.message}`);
    } finally {
      setIsRunning(false);
      setWaitingForInput(false);
      inputResolverRef.current = null;
    }
  };

  const diffStyle = DS[q?.difficulty] || DS.medium;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 300, display: 'flex', flexDirection: 'column',
      background: '#f5f5f5', overflow: 'hidden', fontFamily: 'var(--lms-font)'
    }}>

      {/* ── TOP NAV ── */}
      <div style={{
        flexShrink: 0, height: 44, borderBottom: '1px solid #e5e5e5', display: 'flex',
        alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', background: '#ffffff'
      }}>
        {/* Left: logo + title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 26, height: 26, borderRadius: 6, background: 'var(--lms-orange)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
          }}>
            <Code size={13} style={{ color: 'white' }} />
          </div>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#333', fontFamily: 'var(--lms-font)', letterSpacing: 0.2 }}>
            Mock Preview
          </span>
        </div>

        {/* Center: question pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {questions.map((qItem, i) => {
            const ds = DS[qItem.difficulty] || DS.medium;
            const isActive = i === idx;
            return (
              <button key={i} onClick={() => setIdx(i)}
                style={{
                  height: 26, minWidth: 26, padding: '0 8px', borderRadius: 6,
                  border: `1.5px solid ${isActive ? ds.border : '#e5e5e5'}`,
                  background: isActive ? ds.bg : '#f8f8f8',
                  color: isActive ? ds.text : '#666',
                  fontSize: 11, fontWeight: 700, cursor: 'pointer',
                  fontFamily: 'var(--lms-font)', transition: 'all 0.15s',
                  display: 'flex', alignItems: 'center', gap: 4,
                }}>
                {i + 1}
                {qItem.difficulty && <span style={{ fontSize: 9, opacity: 0.8, textTransform: 'capitalize' }}>{qItem.difficulty[0]}</span>}
              </button>
            );
          })}
        </div>

        {/* Right: lang select + close */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <select value={lang} onChange={e => setLang(e.target.value)}
            style={{
              fontFamily: 'var(--lms-font)', fontSize: 11, fontWeight: 600,
              border: '1px solid #e5e5e5', borderRadius: 6, padding: '4px 8px',
              background: '#ffffff', color: '#333', cursor: 'pointer', outline: 'none'
            }}>
            {selectedLanguages.length > 0
              ? selectedLanguages.map(l => <option key={l} value={l.toLowerCase()}>{l}</option>)
              : ['Python', 'JavaScript', 'Java', 'C++'].map(l => <option key={l} value={l.toLowerCase()}>{l}</option>)}
          </select>
          <button onClick={onClose}
            style={{
              width: 28, height: 28, borderRadius: 6, border: '1px solid #e5e5e5',
              background: '#f8f8f8', color: '#666', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s'
            }}>
            <X size={13} />
          </button>
        </div>
      </div>

      {/* ── BODY ── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* ── LEFT: Problem Panel ── */}
        <div style={{
          width: '42%', flexShrink: 0, borderRight: '1px solid #e5e5e5',
          display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#ffffff'
        }}>

          {/* Panel content — all in one like LeetCode */}
          <div className="lms-sidebar-scroll" style={{ flex: 1, overflowY: 'auto', padding: '24px 20px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>

              {/* Title row */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <span style={{ fontFamily: 'var(--lms-font)', fontSize: 11, fontWeight: 600, color: '#999' }}>
                    {idx + 1} / {questions.length}
                  </span>
                  {q?.difficulty && (
                    <span style={{ ...diffStyle.pill, fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, textTransform: 'capitalize' }}>
                      {q.difficulty}
                    </span>
                  )}
                  {exerciseIsGraded && q?.score > 0 && (
                    <span style={{ fontSize: 10, color: '#999', fontFamily: 'var(--lms-font)' }}>
                      {q.score} pts
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {qTitleBlocks.map((b, bi) => {
                    if (b.type === 'text' && (b as any).value?.trim()) return (
                      <h2 key={bi} dangerouslySetInnerHTML={{ __html: (b as any).value }} style={{ fontFamily: 'var(--lms-font)', fontSize: 20, fontWeight: 800, color: '#1a1a2e', lineHeight: 1.3, margin: 0 }} />
                    );
                    if (b.type === 'image') return (
                      <div key={bi} style={{ display: 'flex', justifyContent: (b as any).alignment === 'right' ? 'flex-end' : (b as any).alignment === 'center' ? 'center' : 'flex-start' }}>
                        <img src={(b as any).url} alt="" style={{ width: `${(b as any).sizePercent || 60}%`, borderRadius: 8, border: '1px solid #e5e5e5' }} />
                      </div>
                    );
                    if (b.type === 'code') {
                      const isDk = ['#1e1e1e', '#282a36', '#272822'].includes((b as any).bgColor);
                      return <pre key={bi} style={{ background: (b as any).bgColor || '#f5f5f5', color: isDk ? '#d4d4d4' : '#1a1a2e', fontFamily: 'ui-monospace,monospace', fontSize: 12, padding: '10px 14px', borderRadius: 8, margin: 0, overflowX: 'auto' }}>{(b as any).value}</pre>;
                    }
                    return null;
                  })}
                </div>
              </div>

              {/* Divider */}
              <div style={{ height: 1, background: '#e5e5e5' }} />

              {/* Description blocks */}
              {hasDescription && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {descBlocks.map((b, bi) => {
                    if (b.type === 'text') {
                      const val = (b as any).value?.trim();
                      if (!val) return null;
                      return <p key={bi} style={{ fontFamily: 'var(--lms-font)', fontSize: 13.5, lineHeight: 1.8, color: '#4a4a4a', margin: 0, whiteSpace: 'pre-wrap' }}>{val}</p>;
                    }
                    if (b.type === 'image') return (
                      <div key={bi} style={{ display: 'flex', justifyContent: (b as any).alignment === 'left' ? 'flex-start' : (b as any).alignment === 'right' ? 'flex-end' : 'center' }}>
                        <img src={(b as any).url} alt="" style={{ width: `${(b as any).sizePercent || 70}%`, borderRadius: 8, border: '1px solid #e5e5e5' }} />
                      </div>
                    );
                    if (b.type === 'code') {
                      const isDark = ['#1e1e1e', '#282a36', '#272822'].includes((b as any).bgColor);
                      return <pre key={bi} style={{ background: (b as any).bgColor || '#f5f5f5', color: isDark ? '#d4d4d4' : '#1a1a2e', fontFamily: 'ui-monospace,monospace', fontSize: 12.5, padding: '14px 16px', borderRadius: 10, overflowX: 'auto', margin: 0, lineHeight: 1.6 }}>{(b as any).value}</pre>;
                    }
                    return null;
                  })}
                </div>
              )}

              {/* Examples */}
              {sampleTcs.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {sampleTcs.map((tc: any, ti: number) => (
                    <div key={ti}>
                      <p style={{ fontFamily: 'var(--lms-font)', fontSize: 13, fontWeight: 700, color: '#1a1a2e', marginBottom: 10 }}>
                        Example {ti + 1}
                      </p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {tc.input?.trim() && (
                          <div style={{ background: '#f8f8f8', borderRadius: 8, padding: '10px 14px', border: '1px solid #e5e5e5' }}>
                            <p style={{ fontFamily: 'var(--lms-font)', fontSize: 10, fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>Input</p>
                            <pre style={{ fontFamily: 'ui-monospace,monospace', fontSize: 12.5, color: '#1a1a2e', margin: 0, whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{tc.input}</pre>
                          </div>
                        )}
                        {tc.expectedOutput?.trim() && (
                          <div style={{ background: '#f8f8f8', borderRadius: 8, padding: '10px 14px', border: '1px solid #e5e5e5' }}>
                            <p style={{ fontFamily: 'var(--lms-font)', fontSize: 10, fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>Output</p>
                            <pre style={{ fontFamily: 'ui-monospace,monospace', fontSize: 12.5, color: '#1a1a2e', margin: 0, whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{tc.expectedOutput}</pre>
                          </div>
                        )}
                        {tc.explanation?.trim() && (
                          <div style={{ padding: '8px 12px', borderLeft: '3px solid #e5e5e5', background: '#fafafa', borderRadius: '0 6px 6px 0' }}>
                            <p style={{ fontFamily: 'var(--lms-font)', fontSize: 12, color: '#666', margin: 0, lineHeight: 1.6 }}>
                              <strong style={{ color: '#333' }}>Explanation: </strong>{tc.explanation}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Constraints */}
              {hasConstraints && (
                <div>
                  <p style={{ fontFamily: 'var(--lms-font)', fontSize: 11, fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
                    Constraints
                  </p>
                  <ul style={{ paddingLeft: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 6, listStyle: 'none' }}>
                    {q.constraints.filter((c: string) => c.trim()).map((c: string, ci: number) => (
                      <li key={ci} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                        <span style={{ color: 'var(--lms-orange)', fontSize: 12, marginTop: 1, flexShrink: 0 }}>•</span>
                        <code style={{ fontFamily: 'ui-monospace,monospace', fontSize: 12.5, color: '#3a3a52', lineHeight: 1.6 }}>{c}</code>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

            </div>
          </div>
        </div>

        {/* ── RIGHT: Editor + Console ── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#fefefe' }}>

          {/* Editor toolbar */}
          <div style={{
            flexShrink: 0, padding: '0 14px', height: 40, borderBottom: '1px solid #e5e5e5',
            display: 'flex', alignItems: 'center', gap: 8, background: '#ffffff'
          }}>
            <span style={{ fontFamily: 'ui-monospace,monospace', fontSize: 11, color: '#999' }}>
              solution.{lang === 'python' ? 'py' : lang === 'javascript' ? 'js' : lang === 'java' ? 'java' : lang === 'cpp' ? 'cpp' : lang}
            </span>
            {lang === 'python' && !pyodideReady && (
              <span style={{ fontFamily: 'var(--lms-font)', fontSize: 10, color: '#d97706', marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4 }}>
                <Loader2 size={10} className="animate-spin" /> Loading runtime…
              </span>
            )}
            {lang === 'python' && pyodideReady && (
              <span style={{ fontFamily: 'var(--lms-font)', fontSize: 10, color: '#16a34a', marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#16a34a', display: 'inline-block' }} /> Ready
              </span>
            )}
            <button onClick={executeCode} disabled={isRunning}
              style={{
                marginLeft: lang === 'python' ? 8 : 'auto',
                display: 'inline-flex', alignItems: 'center', gap: 5,
                padding: '5px 14px', borderRadius: 6, border: 'none',
                background: isRunning ? '#e5e5e5' : 'var(--lms-orange)',
                color: isRunning ? '#999' : 'white',
                fontFamily: 'var(--lms-font)', fontSize: 11.5, fontWeight: 700,
                cursor: isRunning ? 'not-allowed' : 'pointer', transition: 'all 0.15s',
              }}>
              {isRunning ? <Loader2 size={11} className="animate-spin" /> : <Play size={11} />}
              {isRunning ? 'Running…' : 'Run'}
            </button>
          </div>

          {/* Code editor */}
          <textarea
            ref={codeRef}
            value={code}
            onChange={e => setCode(e.target.value)}
            placeholder={`// Write your ${lang} solution here…`}
            style={{
              flex: 1, background: '#fefefe', border: 'none', outline: 'none',
              color: '#1a1a2e', fontFamily: 'ui-monospace, "Courier New", monospace',
              fontSize: 13.5, lineHeight: 1.7, padding: '16px 18px',
              resize: 'none', boxSizing: 'border-box', tabSize: 2,
              borderBottom: '1px solid #e5e5e5',
            }}
            onKeyDown={e => {
              if (e.key === 'Tab') {
                e.preventDefault();
                const start = e.currentTarget.selectionStart;
                const end = e.currentTarget.selectionEnd;
                const val = e.currentTarget.value;
                setCode(val.substring(0, start) + '  ' + val.substring(end));
                setTimeout(() => { if (codeRef.current) { codeRef.current.selectionStart = codeRef.current.selectionEnd = start + 2; } }, 0);
              }
            }}
          />

          {/* Console */}
          <div style={{ flexShrink: 0, height: 220, display: 'flex', flexDirection: 'column', background: '#fafafa' }}>
            <div style={{
              flexShrink: 0, padding: '0 14px', height: 34, borderBottom: '1px solid #e5e5e5',
              display: 'flex', alignItems: 'center', gap: 8
            }}>
              <div style={{
                width: 7, height: 7, borderRadius: '50%',
                background: isRunning ? '#16a34a' : waitingForInput ? '#d97706' : '#ccc',
                transition: 'background 0.2s'
              }} />
              <span style={{ fontFamily: 'ui-monospace,monospace', fontSize: 10.5, fontWeight: 600, color: '#999' }}>
                {waitingForInput ? 'stdin' : isRunning ? 'running' : 'console'}
              </span>
              {lang !== 'python' && !isRunning && (
                <span style={{ fontFamily: 'var(--lms-font)', fontSize: 10, color: '#ccc' }}>· provide stdin below then run</span>
              )}
              {consoleLines.length > 0 && (
                <button onClick={() => setConsoleLines([])}
                  style={{
                    marginLeft: 'auto', fontFamily: 'var(--lms-font)', fontSize: 10,
                    color: '#999', background: 'none', border: 'none',
                    cursor: 'pointer', padding: '2px 6px', borderRadius: 4, transition: 'color 0.15s'
                  }}>
                  clear
                </button>
              )}
            </div>

            <div style={{
              flex: 1, overflowY: 'auto', padding: '8px 14px',
              fontFamily: 'ui-monospace, monospace', fontSize: 12,
              lineHeight: 1.7, scrollbarWidth: 'thin'
            }}>
              {consoleLines.length === 0 && !isRunning && (
                <span style={{ color: '#ccc', fontStyle: 'italic', fontSize: 11 }}>
                  {lang !== 'python' ? 'Provide stdin below, then run…' : 'Run your code to see output here…'}
                </span>
              )}
              {consoleLines.map(line => (
                <div key={line.id} style={{
                  color: line.type === 'error' ? '#dc2626' : line.type === 'input' ? '#FB923C' : line.type === 'system' ? '#999' : '#1a1a2e',
                  display: 'flex', alignItems: 'flex-start', gap: 6,
                }}>
                  <span style={{ flexShrink: 0, opacity: 0.6, fontSize: 10, marginTop: 2 }}>
                    {line.type === 'input' ? '›' : line.type === 'error' ? '✗' : line.type === 'system' ? '#' : '$'}
                  </span>
                  <span style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{line.text || '\u00A0'}</span>
                </div>
              ))}
              <div ref={consoleEndRef} />
            </div>

            {/* Input area */}
            {lang === 'python' ? (
              <div style={{
                flexShrink: 0, borderTop: `1px solid ${waitingForInput ? '#FB923C' : '#e5e5e5'}`,
                background: waitingForInput ? '#FFF7ED' : '#fafafa',
                padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 8, transition: 'all 0.15s'
              }}>
                <span style={{ fontFamily: 'ui-monospace,monospace', fontSize: 12, fontWeight: 700, color: waitingForInput ? '#FB923C' : '#ccc', flexShrink: 0 }}>›</span>
                <input
                  ref={consoleInputRef}
                  value={consoleInput}
                  onChange={e => setConsoleInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') submitInput(); }}
                  placeholder={waitingForInput ? 'Type input and press Enter…' : 'Waiting for input()…'}
                  disabled={!waitingForInput}
                  style={{
                    flex: 1, fontFamily: 'ui-monospace,monospace', fontSize: 12,
                    background: 'transparent', border: 'none', outline: 'none',
                    color: '#1a1a2e', opacity: waitingForInput ? 1 : 0.3
                  }}
                />
                {waitingForInput && (
                  <button onClick={submitInput}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      padding: '3px 10px', borderRadius: 5, border: '1px solid #FB923C',
                      background: '#FB923C', color: 'white', fontFamily: 'var(--lms-font)',
                      fontSize: 11, fontWeight: 600, cursor: 'pointer'
                    }}>
                    Enter ↵
                  </button>
                )}
              </div>
            ) : (
              <div style={{ flexShrink: 0, borderTop: '1px solid #e5e5e5', background: '#fafafa', padding: '6px 12px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontFamily: 'var(--lms-font)', fontSize: 9, fontWeight: 700, color: '#ccc', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Stdin</span>
                <textarea
                  value={consoleInput}
                  onChange={e => setConsoleInput(e.target.value)}
                  placeholder={'5\n3\nhello\n...'}
                  rows={2}
                  disabled={isRunning}
                  style={{
                    width: '100%', fontFamily: 'ui-monospace,monospace', fontSize: 11.5,
                    background: '#ffffff', border: '1px solid #e5e5e5', borderRadius: 5,
                    outline: 'none', color: '#1a1a2e', padding: '5px 8px',
                    resize: 'none', boxSizing: 'border-box', opacity: isRunning ? 0.4 : 1
                  }}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── FOOTER ── */}
      <div style={{
        flexShrink: 0, borderTop: '1px solid #e5e5e5', padding: '8px 16px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#ffffff'
      }}>
        <button onClick={() => { if (idx > 0) setIdx(idx - 1); }} disabled={idx === 0}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 12px',
            borderRadius: 6, border: '1px solid #e5e5e5', background: '#f8f8f8',
            color: idx === 0 ? '#ccc' : '#666', fontSize: 11, fontWeight: 600,
            cursor: idx === 0 ? 'not-allowed' : 'pointer', fontFamily: 'var(--lms-font)', transition: 'all 0.15s'
          }}>
          <ChevronLeft size={12} /> Prev
        </button>
        <span style={{ fontFamily: 'var(--lms-font)', fontSize: 11, color: '#999' }}>
          <span style={{ color: 'var(--lms-orange)', fontWeight: 700 }}>{idx + 1}</span>
          <span style={{ margin: '0 4px' }}>/</span>
          {questions.length}
        </span>
        {idx < questions.length - 1 ? (
          <button onClick={() => setIdx(idx + 1)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 12px',
              borderRadius: 6, border: '1px solid #e5e5e5', background: '#f8f8f8',
              color: '#666', fontSize: 11, fontWeight: 600, cursor: 'pointer',
              fontFamily: 'var(--lms-font)', transition: 'all 0.15s'
            }}>
            Next <ChevronRight size={12} />
          </button>
        ) : (
          <button onClick={onClose}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 14px',
              borderRadius: 6, border: 'none', background: 'var(--lms-orange)',
              color: 'white', fontSize: 11, fontWeight: 700, cursor: 'pointer',
              fontFamily: 'var(--lms-font)'
            }}>
            <Check size={12} /> Done
          </button>
        )}
      </div>
    </div>
  );
};

