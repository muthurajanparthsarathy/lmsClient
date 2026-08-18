'use client';

/**
 * Shared atoms for the Create Question modals (Question Bank).
 * Geometry follows the reference SaaS design: 48px inputs (radius 10),
 * 14px cards (border #E8EAF2, padding 20), 42px selector chips, compact
 * helper text. Accent stays the LMS brand orange token ramp.
 */

import React, { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import {
  X, Check, ChevronDown, Bold, Italic, Underline, Code2, List, ListOrdered,
  ImagePlus, Trash2,
  Workflow, Database, Sigma, GitBranch, Boxes, Bug, Gauge,
} from 'lucide-react';

// ── Field primitives ─────────────────────────────────────────────────────────

export const inputCls =
  'w-full h-10 px-3 rounded-[10px] border border-[#E5E7EB] bg-white text-[13px] text-body ' +
  'placeholder:text-faint focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/15 transition-colors duration-150';

// Compact control — dropdowns and small inputs in the config rail.
export const controlCls =
  'w-full h-10 px-3 rounded-[10px] border border-[#E5E7EB] bg-white text-[13px] text-body ' +
  'placeholder:text-faint focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/15 transition-colors duration-150';

export const textareaCls =
  'w-full px-3 py-2 rounded-[10px] border border-[#E5E7EB] bg-white text-[13px] text-body leading-relaxed ' +
  'placeholder:text-faint focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/15 transition-colors duration-150 resize-y';

export const Label = ({ children, required, optional }: { children: React.ReactNode; required?: boolean; optional?: boolean }) => (
  <label className="mb-1.5 flex items-center gap-1 text-[12.5px] font-semibold text-heading">
    {children}
    {required && <span className="text-red-500">*</span>}
    {optional && <span className="text-[11px] font-normal text-subtle">(Optional)</span>}
  </label>
);

// Flat section (no card box) — heading row + content, separated by column
// spacing, matching the ProgrammingQuestionForm's flat layout.
export const SectionCard = ({ title, required, optional, action, children }: {
  title: string; required?: boolean; optional?: boolean; action?: React.ReactNode; children: React.ReactNode;
}) => (
  <section>
    <div className="mb-2 flex items-center justify-between gap-2">
      <h3 className="flex items-center gap-1 text-[13.5px] font-semibold text-heading">
        {title}
        {required && <span className="text-red-500">*</span>}
        {optional && <span className="text-[11px] font-normal text-subtle">(Optional)</span>}
      </h3>
      {action}
    </div>
    {children}
  </section>
);

export const CharCount = ({ value, max }: { value: string; max: number }) => (
  <div className={`mt-1 text-right text-[11.5px] leading-none ${value.length > max ? 'text-red-500' : 'text-faint'}`}>
    {value.length}/{max}
  </div>
);

export const FieldError = ({ msg }: { msg?: string }) =>
  msg ? <p className="mt-1 text-[11px] font-medium text-red-500">{msg}</p> : null;

export const HelperText = ({ children }: { children: React.ReactNode }) => (
  <p className="mt-1.5 text-[11px] text-subtle">{children}</p>
);

// ── Value chips (small removable pills for topics / tags values) ────────────

export const ValueChips = ({ values, onRemove }: { values: string[]; onRemove: (v: string) => void }) =>
  values.length === 0 ? null : (
    <div className="mt-2.5 flex flex-wrap gap-2">
      {values.map(v => (
        <span key={v} className="inline-flex h-6 items-center gap-1 rounded-full border border-brand-500/30 bg-brand-wash pl-2 pr-1 text-[11.5px] font-medium text-brand-strong">
          {v}
          <button type="button" onClick={() => onRemove(v)}
            className="rounded-full p-0.5 hover:bg-brand-500/15" aria-label={`Remove ${v}`}>
            <X size={11} />
          </button>
        </span>
      ))}
    </div>
  );

// ── Chip input (Enter to add) — used for Tags ────────────────────────────────

export const ChipInput = ({ values, onChange, placeholder }: {
  values: string[]; onChange: (next: string[]) => void; placeholder?: string;
}) => {
  const [draft, setDraft] = useState('');
  const add = () => {
    const v = draft.trim();
    if (!v) return;
    if (!values.some(x => x.toLowerCase() === v.toLowerCase())) onChange([...values, v]);
    setDraft('');
  };
  return (
    <div>
      <input
        className={controlCls}
        value={draft}
        placeholder={placeholder || 'Type and press Enter'}
        onChange={e => setDraft(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
        onBlur={add}
      />
      <ValueChips values={values} onRemove={v => onChange(values.filter(x => x !== v))} />
    </div>
  );
};

// ── Topics multi-select dropdown ─────────────────────────────────────────────

export const TOPIC_SUGGESTIONS = [
  'Arrays', 'Strings', 'Linked List', 'Stacks & Queues', 'Trees', 'Graphs',
  'Recursion', 'Dynamic Programming', 'Sorting', 'Searching', 'Hashing',
  'Greedy', 'Math', 'Bit Manipulation', 'OOP', 'SQL', 'Databases',
];

export const TopicsMultiSelect = ({ values, onChange, placeholder }: {
  values: string[]; onChange: (next: string[]) => void; placeholder?: string;
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close, true);
    return () => document.removeEventListener('mousedown', close, true);
  }, [open]);

  const toggle = (t: string) =>
    values.includes(t) ? onChange(values.filter(x => x !== t)) : onChange([...values, t]);
  const addCustom = () => {
    const v = query.trim();
    if (!v) return;
    if (!values.some(x => x.toLowerCase() === v.toLowerCase())) onChange([...values, v]);
    setQuery('');
  };
  const filtered = TOPIC_SUGGESTIONS.filter(t => t.toLowerCase().includes(query.trim().toLowerCase()));
  const canAddCustom = !!query.trim()
    && !TOPIC_SUGGESTIONS.some(t => t.toLowerCase() === query.trim().toLowerCase())
    && !values.some(t => t.toLowerCase() === query.trim().toLowerCase());

  return (
    <div ref={boxRef} className="relative">
      <button type="button" onClick={() => setOpen(o => !o)}
        className="flex h-10 w-full items-center justify-between rounded-[10px] border border-[#E5E7EB] bg-white px-3 text-[13px] transition-colors focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/15">
        <span className={values.length ? 'text-body' : 'text-faint'}>
          {values.length ? `${values.length} topic${values.length > 1 ? 's' : ''} selected` : (placeholder || 'Select topics')}
        </span>
        <ChevronDown size={15} className={`shrink-0 text-faint transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute z-30 mt-1.5 w-full rounded-[10px] border border-[#E8EAF2] bg-white p-2 shadow-lg">
          <input
            autoFocus
            className="h-8 w-full rounded-[8px] border border-[#E5E7EB] px-2.5 text-[12.5px] text-body placeholder:text-faint focus:outline-none focus:border-brand"
            placeholder="Search or type a new topic…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustom(); } }}
          />
          <div className="mt-1.5 max-h-44 overflow-y-auto">
            {canAddCustom && (
              <button type="button" onClick={addCustom}
                className="flex w-full items-center rounded-[8px] px-2.5 py-1.5 text-left text-[12.5px] font-medium text-brand-strong hover:bg-brand-wash">
                + Add &quot;{query.trim()}&quot;
              </button>
            )}
            {filtered.map(t => (
              <button key={t} type="button" onClick={() => toggle(t)}
                className="flex w-full items-center justify-between rounded-[8px] px-2.5 py-1.5 text-left text-[12.5px] text-body hover:bg-row-hover">
                {t}
                {values.includes(t) && <Check size={13} className="shrink-0 text-brand-strong" />}
              </button>
            ))}
            {filtered.length === 0 && !canAddCustom && (
              <p className="px-2.5 py-2 text-[12px] text-faint">No matching topics</p>
            )}
          </div>
        </div>
      )}
      <ValueChips values={values} onRemove={v => onChange(values.filter(x => x !== v))} />
    </div>
  );
};

// ── Difficulty segmented control (42px chips) ────────────────────────────────

const DIFF_META = {
  easy:   { label: 'Easy',   on: 'border-emerald-300 bg-emerald-50 text-emerald-700', off: 'border-[#D7DCE5] bg-white text-emerald-600 hover:bg-emerald-50/50' },
  medium: { label: 'Medium', on: 'border-amber-300 bg-amber-50 text-amber-700',       off: 'border-[#D7DCE5] bg-white text-amber-600 hover:bg-amber-50/50' },
  hard:   { label: 'Hard',   on: 'border-rose-300 bg-rose-50 text-rose-700',          off: 'border-[#D7DCE5] bg-white text-rose-600 hover:bg-rose-50/50' },
} as const;

export type DiffValue = keyof typeof DIFF_META;

export const DifficultySegmented = ({ value, onChange }: { value: DiffValue; onChange: (d: DiffValue) => void }) => (
  <div className="grid grid-cols-3 gap-3">
    {(Object.keys(DIFF_META) as DiffValue[]).map(d => (
      <button key={d} type="button" onClick={() => onChange(d)}
        className={`h-9 rounded-[10px] border text-[12.5px] font-semibold transition-colors duration-150 ${value === d ? DIFF_META[d].on : DIFF_META[d].off}`}>
        {DIFF_META[d].label}
      </button>
    ))}
  </div>
);

// ── Problem Type picker (equal-width 42px chips + synced dropdown) ──────────

export const PROBLEM_TYPES: { key: string; label: string; icon: React.ReactNode }[] = [
  { key: 'Algorithm Design',       label: 'Algorithm Design',       icon: <Workflow size={14} /> },
  { key: 'Data Structures',        label: 'Data Structures',        icon: <Database size={14} /> },
  { key: 'Mathematical Reasoning', label: 'Mathematical Reasoning', icon: <Sigma size={14} /> },
  { key: 'Logic & Reasoning',      label: 'Logic & Reasoning',      icon: <GitBranch size={14} /> },
  { key: 'System Design',          label: 'System Design',          icon: <Boxes size={14} /> },
  { key: 'Debugging',              label: 'Debugging',              icon: <Bug size={14} /> },
  { key: 'Optimization',           label: 'Optimization',           icon: <Gauge size={14} /> },
];

// Dropdown only — the chip grid was dropped by user request.
export const ProblemTypePicker = ({ value, onChange }: { value: string | null; onChange: (v: string | null) => void }) => (
  <select
    className={controlCls}
    value={value || ''}
    onChange={e => onChange(e.target.value || null)}
  >
    <option value="">Select category</option>
    {PROBLEM_TYPES.map(pt => <option key={pt.key} value={pt.key}>{pt.label}</option>)}
  </select>
);

// ── Lightweight rich text editor (contentEditable + sanitize-on-read) ───────

const stripUnsafe = (html: string): string => {
  const div = document.createElement('div');
  div.innerHTML = html;
  div.querySelectorAll('script,style,iframe,object,embed,link,meta').forEach(n => n.remove());
  div.querySelectorAll('*').forEach(el => {
    [...el.attributes].forEach(a => {
      if (/^on/i.test(a.name) || (a.name === 'href' && /^javascript:/i.test(a.value))) el.removeAttribute(a.name);
    });
  });
  return div.innerHTML;
};

export const plainTextOf = (html: string): string => {
  const div = document.createElement('div');
  div.innerHTML = html;
  return (div.textContent || '').trim();
};

// Downscale an image file to a compact JPEG data-URL (max 900px wide) so
// inline images stay small enough to store in the question document.
const fileToDataUrl = (file: File): Promise<string> => new Promise((resolve, reject) => {
  const img = new Image();
  const url = URL.createObjectURL(file);
  img.onload = () => {
    const maxW = 900;
    const scale = Math.min(1, maxW / img.width);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.width * scale));
    canvas.height = Math.max(1, Math.round(img.height * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) { reject(new Error('canvas')); return; }
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    URL.revokeObjectURL(url);
    resolve(canvas.toDataURL('image/jpeg', 0.82));
  };
  img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('bad image')); };
  img.src = url;
});

const IMG_ALIGN_MARGIN: Record<'left' | 'center' | 'right', string> = {
  left: '8px auto 8px 0',
  center: '8px auto',
  right: '8px 0 8px auto',
};

export const RichTextLite = ({ initialHtml, onChange, placeholder, minHeight = 220 }: {
  initialHtml?: string; onChange: (html: string) => void; placeholder?: string; minHeight?: number;
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const hasContent = (html: string) => !!plainTextOf(html) || /<img/i.test(html);
  const [empty, setEmpty] = useState(!initialHtml || !hasContent(initialHtml));
  // Hovered inline image — hovering an <img> shows the four corner drag-grips
  // and the floating align/remove buttons, exactly like MCQQuestionForm.
  const [selImg, setSelImg] = useState<HTMLImageElement | null>(null);
  const [imgBox, setImgBox] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  const [imgPct, setImgPct] = useState(60);
  const [dragging, setDragging] = useState(false);
  const draggingRef = useRef(false);
  const clearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelClear = () => { if (clearTimerRef.current) { clearTimeout(clearTimerRef.current); clearTimerRef.current = null; } };
  const scheduleClear = () => {
    cancelClear();
    clearTimerRef.current = setTimeout(() => { if (!draggingRef.current) setSelImg(null); }, 120);
  };
  const exec = (cmd: string, arg?: string) => {
    ref.current?.focus();
    document.execCommand(cmd, false, arg);
    emit();
  };
  const emit = () => {
    const html = stripUnsafe(ref.current?.innerHTML || '');
    setEmpty(!hasContent(html));
    onChange(html);
  };
  const syncImgBox = (img: HTMLImageElement | null = selImg) => {
    if (!img || !img.isConnected || !wrapRef.current) { setImgBox(null); return; }
    const c = wrapRef.current.getBoundingClientRect();
    const r = img.getBoundingClientRect();
    setImgBox({ top: r.top - c.top, left: r.left - c.left, width: r.width, height: r.height });
    setImgPct(parseInt((img.style.width || '60').replace('%', ''), 10) || 60);
  };
  useEffect(() => { syncImgBox(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [selImg]);
  // Drag-to-resize, mirroring MCQQuestionForm: horizontal delta as a % of the
  // editor width, clamped 10–100, committed on mouseup.
  const startDrag = (e: React.MouseEvent, side: 'left' | 'right') => {
    if (!selImg) return;
    e.preventDefault();
    e.stopPropagation();
    const img = selImg;
    const startX = e.clientX;
    const parentW = ref.current?.clientWidth || 600;
    const startPct = parseInt((img.style.width || '').replace('%', ''), 10)
      || Math.round((img.getBoundingClientRect().width / parentW) * 100);
    setDragging(true);
    draggingRef.current = true;
    cancelClear();
    img.style.border = '1.5px solid #F27757';
    const apply = (clientX: number) => {
      const delta = ((clientX - startX) / parentW) * 100;
      const next = Math.min(100, Math.max(10, side === 'right' ? startPct + delta : startPct - delta));
      img.style.width = `${Math.round(next)}%`;
      syncImgBox(img);
    };
    const onMove = (ev: MouseEvent) => apply(ev.clientX);
    const onUp = (ev: MouseEvent) => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      apply(ev.clientX);
      img.style.border = '1.5px solid #e4e4ed';
      setDragging(false);
      draggingRef.current = false;
      emit();
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };
  // Corner grip with the diagonal double-arrow, like MCQQuestionForm's handles.
  const DiagArrow = ({ rotate }: { rotate: number }) => (
    <svg width="10" height="10" viewBox="0 0 10 10" style={{ transform: `rotate(${rotate}deg)`, display: 'block', pointerEvents: 'none' }}>
      <line x1="1" y1="9" x2="9" y2="1" stroke="#F27757" strokeWidth="1.8" strokeLinecap="round" />
      <polyline points="5,1 9,1 9,5" fill="none" stroke="#F27757" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <polyline points="5,9 1,9 1,5" fill="none" stroke="#F27757" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
  const gripStyle: React.CSSProperties = {
    position: 'absolute', width: 16, height: 16, background: 'white',
    border: '1.5px solid #F27757', borderRadius: 3, zIndex: 10, userSelect: 'none',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    boxShadow: '0 1px 4px rgba(0,0,0,0.15)',
  };
  const insertImage = async (file: File | null) => {
    if (!file) return;
    try {
      const dataUrl = await fileToDataUrl(file);
      if (dataUrl.length > 900_000) {
        toast.error('Image too large — please use a smaller image.');
        return;
      }
      ref.current?.focus();
      document.execCommand('insertHTML', false,
        `<img src="${dataUrl}" style="width:60%;display:block;margin:8px auto;border-radius:8px;border:1.5px solid #e4e4ed;" /><br/>`);
      emit();
    } catch {
      toast.error('Could not read that image file.');
    }
  };
  const currentImgAlign = (): 'left' | 'center' | 'right' => {
    const m = selImg?.style.margin || '';
    if (m === IMG_ALIGN_MARGIN.left) return 'left';
    if (m === IMG_ALIGN_MARGIN.right) return 'right';
    return 'center';
  };
  const patchImg = (fn: (img: HTMLImageElement) => void) => {
    if (!selImg) return;
    fn(selImg);
    emit();
  };
  const ToolBtn = ({ title, onClick, children }: { title: string; onClick: () => void; children: React.ReactNode }) => (
    <button type="button" title={title} onMouseDown={e => e.preventDefault()} onClick={onClick}
      className="flex h-8 w-8 items-center justify-center rounded-[8px] text-subtle transition-colors hover:bg-row-hover hover:text-heading">
      {children}
    </button>
  );
  return (
    <div className="overflow-hidden rounded-[10px] border border-[#E5E7EB] bg-white focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/15 transition-colors">
      <div className="flex items-center gap-0.5 border-b border-[#EEF0F5] px-2 py-1.5">
        <ToolBtn title="Bold" onClick={() => exec('bold')}><Bold size={14} /></ToolBtn>
        <ToolBtn title="Italic" onClick={() => exec('italic')}><Italic size={14} /></ToolBtn>
        <ToolBtn title="Underline" onClick={() => exec('underline')}><Underline size={14} /></ToolBtn>
        <div className="mx-1.5 h-4 w-px bg-[#E8EAF2]" />
        <ToolBtn title="Inline code" onClick={() => exec('formatBlock', 'pre')}><Code2 size={14} /></ToolBtn>
        <ToolBtn title="Bulleted list" onClick={() => exec('insertUnorderedList')}><List size={14} /></ToolBtn>
        <ToolBtn title="Numbered list" onClick={() => exec('insertOrderedList')}><ListOrdered size={14} /></ToolBtn>
        <div className="mx-1.5 h-4 w-px bg-[#E8EAF2]" />
        <label title="Insert image" onMouseDown={e => e.preventDefault()}
          className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-[8px] text-subtle transition-colors hover:bg-row-hover hover:text-heading">
          <ImagePlus size={14} />
          <input type="file" accept="image/*" className="hidden"
            onChange={e => { insertImage(e.target.files?.[0] || null); e.target.value = ''; }} />
        </label>
      </div>
      <div className="relative" ref={wrapRef}>
        {empty && placeholder && (
          <div className="pointer-events-none absolute left-3 top-2 text-[13px] text-faint">{placeholder}</div>
        )}
        <div
          ref={ref}
          contentEditable
          suppressContentEditableWarning
          onInput={() => { emit(); syncImgBox(); }}
          onMouseOver={e => {
            const t = e.target as HTMLElement;
            if (t.tagName === 'IMG') { cancelClear(); setSelImg(t as HTMLImageElement); }
          }}
          onMouseOut={e => {
            const t = e.target as HTMLElement;
            if (t.tagName === 'IMG') scheduleClear();
          }}
          className="w-full px-3 py-2 text-[13px] leading-relaxed text-body outline-none [&_pre]:rounded-md [&_pre]:bg-ink-900 [&_pre]:px-2 [&_pre]:py-1 [&_pre]:text-white [&_img]:rounded-[8px]"
          style={{ minHeight }}
          dangerouslySetInnerHTML={initialHtml ? { __html: initialHtml } : undefined}
        />
        {/* Hover overlay — 4 corner drag-grips, floating align/remove buttons
            and a drag % badge, matching MCQQuestionForm's image interaction. */}
        {selImg && imgBox && (
          <div onMouseEnter={cancelClear} onMouseLeave={scheduleClear}>
            <div style={{ ...gripStyle, top: imgBox.top - 7, left: imgBox.left - 7, cursor: 'nwse-resize' }}
              onMouseDown={e => startDrag(e, 'left')}><DiagArrow rotate={0} /></div>
            <div style={{ ...gripStyle, top: imgBox.top - 7, left: imgBox.left + imgBox.width - 9, cursor: 'nesw-resize' }}
              onMouseDown={e => startDrag(e, 'right')}><DiagArrow rotate={90} /></div>
            <div style={{ ...gripStyle, top: imgBox.top + imgBox.height - 9, left: imgBox.left - 7, cursor: 'nesw-resize' }}
              onMouseDown={e => startDrag(e, 'left')}><DiagArrow rotate={90} /></div>
            <div style={{ ...gripStyle, top: imgBox.top + imgBox.height - 9, left: imgBox.left + imgBox.width - 9, cursor: 'nwse-resize' }}
              onMouseDown={e => startDrag(e, 'right')}><DiagArrow rotate={0} /></div>

            {dragging ? (
              <div style={{
                position: 'absolute', top: imgBox.top + 8, left: imgBox.left + imgBox.width / 2,
                transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.65)', color: 'white',
                fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6,
                pointerEvents: 'none', zIndex: 20,
              }}>
                {imgPct}%
              </div>
            ) : (
              <div style={{
                position: 'absolute', top: imgBox.top + 8, left: imgBox.left + imgBox.width - 8,
                transform: 'translateX(-100%)', display: 'flex', alignItems: 'center', gap: 4, zIndex: 20,
              }}>
                {(['left', 'center', 'right'] as const).map(a => (
                  <button key={a} type="button" title={`Align ${a}`}
                    onClick={() => patchImg(img => { img.style.display = 'block'; img.style.margin = IMG_ALIGN_MARGIN[a]; syncImgBox(img); })}
                    className="h-6 w-6 rounded-md text-[10px] font-bold transition-all"
                    style={{
                      background: currentImgAlign() === a ? '#F27757' : 'white',
                      color: currentImgAlign() === a ? 'white' : '#6b6b7e',
                      border: '1px solid #e4e4ed', boxShadow: '0 1px 4px rgba(0,0,0,0.12)',
                    }}>
                    {a[0].toUpperCase()}
                  </button>
                ))}
                <button type="button" title="Remove image"
                  onClick={() => { patchImg(img => img.remove()); setSelImg(null); }}
                  className="flex h-6 w-6 items-center justify-center rounded-md transition-colors hover:bg-red-50"
                  style={{ background: 'white', color: '#6b6b7e', border: '1px solid #e4e4ed', boxShadow: '0 1px 4px rgba(0,0,0,0.12)' }}>
                  <Trash2 size={12} />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
