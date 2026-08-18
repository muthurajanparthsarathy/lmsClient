"use client";

/**
 * OthersNotionEditor.tsx
 * Full multi-page Notion-like editor for student "Others / notion" question answers.
 * Data model mirrors PageCreationModal (PageData[] / PageBlock) for compatibility.
 * Stored as: JSON.stringify({ type: 'notionPages', pages: PageData[] }) in codeAnswer.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Plus, Trash2, GripVertical, Eye, Edit3,
  FileText, Layers, PenLine, Undo2, Redo2, Sun, Moon,
  ImageIcon, Code2, Table2,
  AlignLeft, List, ListOrdered, CheckSquare,
  Quote, Minus, MessageSquare, Copy,
  Heading1, Heading2, Heading3,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

export type BlockType =
  | 'text' | 'heading1' | 'heading2' | 'heading3'
  | 'bulleted_list' | 'numbered_list' | 'todo'
  | 'quote' | 'divider' | 'image' | 'snippet'
  | 'callout' | 'table';

export interface PageBlock {
  _uid: string;
  type: BlockType;
  content: string;
  metadata?: Record<string, any>;
}

export interface PageData {
  id: string;
  title: string;
  blocks: PageBlock[];
}

export interface NotionPagesAnswer {
  type: 'notionPages';
  pages: PageData[];
}

export interface NotionSettings {
  allowBold?: boolean;
  allowItalic?: boolean;
  allowUnderline?: boolean;
  allowBulletList?: boolean;
  allowNumberedList?: boolean;
  allowHeadings?: boolean;
  allowTable?: boolean;
  allowImage?: boolean;
  allowCode?: boolean;
  allowLinks?: boolean;
}

interface OthersNotionEditorProps {
  notionSettings?: NotionSettings;
  initialPages?: PageData[];
  onChange: (pages: PageData[]) => void;
  disabled?: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const generateId = () => `pg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
const generateUid = () => `blk_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

function buildInlineStyle(meta?: Record<string, any>): React.CSSProperties {
  if (!meta) return {};
  const s: React.CSSProperties = {};
  if (meta.textColor) s.color = meta.textColor;
  if (meta.backgroundColor) s.backgroundColor = meta.backgroundColor;
  if (meta.fontSize) s.fontSize = meta.fontSize;
  if (meta.fontWeight) s.fontWeight = meta.fontWeight as any;
  if (meta.fontStyle) s.fontStyle = meta.fontStyle as any;
  if (meta.textDecoration) s.textDecoration = meta.textDecoration as any;
  if (meta.textAlign) s.textAlign = meta.textAlign as any;
  if (meta.lineHeight) s.lineHeight = meta.lineHeight;
  if (meta.borderRadius) s.borderRadius = meta.borderRadius;
  if (meta.borderColor) s.borderColor = meta.borderColor;
  return s;
}

// ─── useUndoRedo ─────────────────────────────────────────────────────────────

function useUndoRedo<T>(initial: T) {
  const stackRef = useRef<T[]>([initial]);
  const idxRef = useRef(0);
  const [, forceRender] = useState(0);

  const current = stackRef.current[idxRef.current];
  const canUndo = idxRef.current > 0;
  const canRedo = idxRef.current < stackRef.current.length - 1;

  const push = useCallback((next: T) => {
    const sliced = stackRef.current.slice(0, idxRef.current + 1);
    stackRef.current = [...sliced, next].slice(-60);
    idxRef.current = stackRef.current.length - 1;
    forceRender(n => n + 1);
  }, []);

  const undo = useCallback(() => {
    if (idxRef.current > 0) { idxRef.current--; forceRender(n => n + 1); }
  }, []);

  const redo = useCallback(() => {
    if (idxRef.current < stackRef.current.length - 1) { idxRef.current++; forceRender(n => n + 1); }
  }, []);

  return { current, push, undo, redo, canUndo, canRedo };
}

// ─── DirectBlock (contentEditable text/heading/quote) ─────────────────────────

const DirectBlock: React.FC<{
  block: PageBlock;
  onChange: (b: PageBlock) => void;
  onEnter: () => void;
  onDeleteIfEmpty: () => void;
  onSlash: (rect: DOMRect) => void;
  isDark: boolean;
  autoFocus?: boolean;
}> = ({ block, onChange, onEnter, onDeleteIfEmpty, onSlash, isDark, autoFocus }) => {
  const ref = useRef<HTMLDivElement>(null);
  const lastHtml = useRef(block.content);

  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== block.content) {
      ref.current.innerHTML = block.content;
      lastHtml.current = block.content;
    }
  }, []); // only on mount

  useEffect(() => {
    if (autoFocus && ref.current) {
      ref.current.focus();
      const range = document.createRange();
      range.selectNodeContents(ref.current);
      range.collapse(false);
      window.getSelection()?.removeAllRanges();
      window.getSelection()?.addRange(range);
    }
  }, [autoFocus]);

  const placeholder = () => {
    switch (block.type) {
      case 'heading1': return 'Heading 1';
      case 'heading2': return 'Heading 2';
      case 'heading3': return 'Heading 3';
      case 'quote': return 'Quote…';
      default: return "Type '/' for commands…";
    }
  };

  const cls = () => {
    const base = `outline-none w-full break-words ${isDark ? 'text-gray-200' : 'text-gray-900'}`;
    switch (block.type) {
      case 'heading1': return `${base} text-3xl font-bold tracking-tight`;
      case 'heading2': return `${base} text-2xl font-semibold`;
      case 'heading3': return `${base} text-xl font-medium`;
      case 'quote': return `${base} italic text-base`;
      default: return `${base} text-base leading-relaxed`;
    }
  };

  return (
    <div
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      className={cls()}
      data-placeholder={placeholder()}
      onInput={() => {
        if (ref.current) {
          lastHtml.current = ref.current.innerHTML;
          onChange({ ...block, content: ref.current.innerHTML });
        }
      }}
      onKeyDown={e => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onEnter(); }
        if (e.key === 'Backspace' && (ref.current?.innerText || '') === '') { e.preventDefault(); onDeleteIfEmpty(); }
        if (e.key === '/') {
          setTimeout(() => {
            const sel = window.getSelection();
            if (sel && sel.rangeCount > 0) {
              const rect = sel.getRangeAt(0).getBoundingClientRect();
              if (rect.width === 0 && rect.height === 0) {
                const elRect = ref.current?.getBoundingClientRect();
                if (elRect) onSlash(elRect);
              } else {
                onSlash(rect);
              }
            }
          }, 10);
        }
      }}
      style={{ minHeight: '1.5em', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
    />
  );
};

// ─── Block Type Definitions ───────────────────────────────────────────────────

interface BlockTypeOption {
  type: BlockType;
  icon: React.ReactNode;
  label: string;
  desc: string;
  group: string;
}

function getAvailableBlockTypes(settings: NotionSettings): BlockTypeOption[] {
  const all: BlockTypeOption[] = [
    { type: 'text',          icon: <AlignLeft size={14} />,    label: 'Text',           desc: 'Plain paragraph',    group: 'Basic'    },
    { type: 'heading1',      icon: <Heading1 size={14} />,      label: 'Heading 1',      desc: 'Large heading',      group: 'Basic'    },
    { type: 'heading2',      icon: <Heading2 size={14} />,      label: 'Heading 2',      desc: 'Medium heading',     group: 'Basic'    },
    { type: 'heading3',      icon: <Heading3 size={14} />,      label: 'Heading 3',      desc: 'Small heading',      group: 'Basic'    },
    { type: 'quote',         icon: <Quote size={14} />,         label: 'Quote',          desc: 'Blockquote',         group: 'Basic'    },
    { type: 'bulleted_list', icon: <List size={14} />,          label: 'Bulleted List',  desc: 'Unordered list',     group: 'Lists'    },
    { type: 'numbered_list', icon: <ListOrdered size={14} />,   label: 'Numbered List',  desc: 'Ordered list',       group: 'Lists'    },
    { type: 'todo',          icon: <CheckSquare size={14} />,   label: 'To-do',          desc: 'Checkbox list',      group: 'Lists'    },
    { type: 'divider',       icon: <Minus size={14} />,         label: 'Divider',        desc: 'Horizontal line',    group: 'Layout'   },
    { type: 'callout',       icon: <MessageSquare size={14} />, label: 'Callout',        desc: 'Highlighted note',   group: 'Layout'   },
    { type: 'image',         icon: <ImageIcon size={14} />,     label: 'Image',          desc: 'Upload or URL',      group: 'Media'    },
    { type: 'snippet',       icon: <Code2 size={14} />,         label: 'Code',           desc: 'Code snippet',       group: 'Advanced' },
    { type: 'table',         icon: <Table2 size={14} />,        label: 'Table',          desc: 'Data table',         group: 'Advanced' },
  ];

  return all.filter(b => {
    if (['heading1', 'heading2', 'heading3'].includes(b.type) && settings.allowHeadings === false) return false;
    if (b.type === 'bulleted_list' && settings.allowBulletList === false) return false;
    if (b.type === 'numbered_list' && settings.allowNumberedList === false) return false;
    if (b.type === 'image' && settings.allowImage === false) return false;
    if (b.type === 'snippet' && settings.allowCode === false) return false;
    if (b.type === 'table' && settings.allowTable === false) return false;
    return true;
  });
}

// ─── Block Picker Menu ────────────────────────────────────────────────────────

const BlockPickerMenu: React.FC<{
  anchorRect: DOMRect;
  onSelect: (type: BlockType) => void;
  onClose: () => void;
  isDark: boolean;
  settings: NotionSettings;
}> = ({ anchorRect, onSelect, onClose, isDark, settings }) => {
  const [query, setQuery] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const blockTypes = getAvailableBlockTypes(settings);

  const filtered = query
    ? blockTypes.filter(b => b.label.toLowerCase().includes(query.toLowerCase()))
    : blockTypes;

  const grouped = filtered.reduce<Record<string, BlockTypeOption[]>>((acc, b) => {
    acc[b.group] = acc[b.group] || [];
    acc[b.group].push(b);
    return acc;
  }, {});

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 30);
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const top = Math.min(anchorRect.bottom + 8, window.innerHeight - 340);
  const left = Math.min(Math.max(8, anchorRect.left), window.innerWidth - 280);

  return (
    <div
      ref={menuRef}
      className={`fixed z-50 rounded-2xl shadow-2xl border overflow-hidden min-w-[260px] max-h-80 flex flex-col ${isDark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'}`}
      style={{ top, left }}
      onMouseDown={e => e.stopPropagation()}
    >
      <div className={`px-3 py-2 border-b ${isDark ? 'border-gray-800' : 'border-gray-100'}`}>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => { if (e.key === 'Escape') onClose(); }}
          placeholder="Search blocks…"
          className={`w-full text-xs bg-transparent outline-none ${isDark ? 'text-gray-200 placeholder-gray-600' : 'text-gray-800 placeholder-gray-400'}`}
        />
      </div>
      <div className="overflow-y-auto flex-1 p-2">
        {Object.entries(grouped).map(([group, items]) => (
          <div key={group}>
            <div className={`text-[10px] font-bold uppercase tracking-widest px-2 py-1 mt-1 ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>{group}</div>
            {items.map(b => (
              <button
                key={b.type}
                onMouseDown={e => { e.preventDefault(); onSelect(b.type); onClose(); }}
                className={`w-full flex items-center gap-3 px-2 py-2 rounded-lg text-left transition-colors ${isDark ? 'hover:bg-gray-800 text-gray-300' : 'hover:bg-gray-50 text-gray-700'}`}
              >
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${isDark ? 'bg-gray-800 text-indigo-400' : 'bg-gray-100 text-indigo-500'}`}>
                  {b.icon}
                </div>
                <div>
                  <div className="text-xs font-semibold">{b.label}</div>
                  <div className={`text-[10px] ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>{b.desc}</div>
                </div>
              </button>
            ))}
          </div>
        ))}
        {filtered.length === 0 && (
          <p className={`text-xs text-center py-4 ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>No blocks found</p>
        )}
      </div>
    </div>
  );
};

// ─── Image Upload Block ───────────────────────────────────────────────────────

const ImageUploadBlock: React.FC<{
  block: PageBlock;
  onChange: (b: PageBlock) => void;
  isDark?: boolean;
}> = ({ block, onChange, isDark }) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const reader = new FileReader();
    reader.onload = ev => {
      onChange({ ...block, content: ev.target?.result as string, metadata: { ...block.metadata, caption: file.name } });
      setUploading(false);
    };
    reader.readAsDataURL(file);
  };

  if (block.content) return (
    <div className="relative group">
      <img src={block.content} alt={block.metadata?.caption || 'Image'} className="max-w-full rounded-xl" style={{ maxHeight: 400, objectFit: 'contain' }} />
      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl flex items-center justify-center gap-2">
        <button onClick={() => fileRef.current?.click()} className="p-2 bg-white/20 hover:bg-white/30 rounded-lg text-white"><ImageIcon size={16} /></button>
        <button onClick={() => onChange({ ...block, content: '' })} className="p-2 bg-white/20 hover:bg-white/30 rounded-lg text-white"><Trash2 size={16} /></button>
      </div>
      {block.metadata?.caption && <p className="mt-1.5 text-xs text-center text-gray-400">{block.metadata.caption}</p>}
      <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
    </div>
  );

  return (
    <div className={`border-2 border-dashed rounded-xl p-8 text-center ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
      <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
      <ImageIcon size={28} className={`mx-auto mb-2 ${isDark ? 'text-gray-600' : 'text-gray-400'}`} />
      <p className={`text-sm mb-3 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{uploading ? 'Reading…' : 'Click to upload image'}</p>
      <div className="flex gap-2 justify-center">
        <button onClick={() => fileRef.current?.click()} className="px-3 py-1.5 text-xs bg-indigo-500 text-white rounded-lg hover:bg-indigo-600">Browse</button>
        <button onClick={() => { const u = prompt('Image URL:'); if (u) onChange({ ...block, content: u }); }} className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg hover:bg-gray-50">URL</button>
      </div>
    </div>
  );
};

// ─── Snippet / Code Block ─────────────────────────────────────────────────────

const SNIPPET_LANGS = ['javascript', 'typescript', 'python', 'java', 'html', 'css', 'sql', 'bash', 'json', 'other'];

const SnippetBlock: React.FC<{
  block: PageBlock;
  onChange: (b: PageBlock) => void;
  isDark?: boolean;
}> = ({ block, onChange, isDark }) => {
  const title = block.metadata?.snippetTitle ?? '';
  const language = block.metadata?.snippetLanguage ?? 'javascript';
  const code = block.content ?? '';

  return (
    <div className="w-full rounded-xl overflow-hidden border" style={{ borderColor: isDark ? '#334155' : '#e2e8f0' }}>
      <div className="flex items-center gap-3 px-3 py-2" style={{ background: isDark ? '#1e293b' : '#f1f5f9', borderBottom: `1px solid ${isDark ? '#334155' : '#e2e8f0'}` }}>
        <input type="text" value={title} onChange={e => onChange({ ...block, metadata: { ...block.metadata, snippetTitle: e.target.value } })} placeholder="Title (optional)…" className="flex-1 text-sm font-semibold bg-transparent outline-none" style={{ color: isDark ? '#f1f5f9' : '#0f172a' }} />
        <select value={language} onChange={e => onChange({ ...block, metadata: { ...block.metadata, snippetLanguage: e.target.value } })} className="text-xs px-2 py-1 rounded-lg outline-none" style={{ background: isDark ? '#0f172a' : '#e2e8f0', color: isDark ? '#94a3b8' : '#475569' }}>
          {SNIPPET_LANGS.map(l => <option key={l} value={l}>{l.toUpperCase()}</option>)}
        </select>
      </div>
      <div style={{ background: '#1e1e1e', position: 'relative', minHeight: 120 }}>
        <textarea
          value={code}
          onChange={e => onChange({ ...block, content: e.target.value })}
          onKeyDown={e => {
            if (e.key === 'Tab') {
              e.preventDefault();
              const s = e.currentTarget.selectionStart;
              const next = code.slice(0, s) + '  ' + code.slice(e.currentTarget.selectionEnd);
              onChange({ ...block, content: next });
              requestAnimationFrame(() => { e.currentTarget.selectionStart = e.currentTarget.selectionEnd = s + 2; });
            }
          }}
          spellCheck={false}
          placeholder={`// ${language} code…`}
          style={{ display: 'block', width: '100%', minHeight: 120, padding: '12px 16px', background: '#1e1e1e', color: '#d4d4d4', border: 'none', outline: 'none', resize: 'vertical', fontFamily: 'Fira Code, Cascadia Code, Courier New, monospace', fontSize: 13, lineHeight: 1.75, tabSize: 2, caretColor: '#fff', boxSizing: 'border-box' }}
        />
      </div>
      <div className="flex items-center justify-between px-4 py-1.5" style={{ background: isDark ? '#0f172a' : '#f8fafc', borderTop: '1px solid #333' }}>
        <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#888' }}>{language}</span>
        <span className="text-[10px]" style={{ color: '#555' }}>{code.split('\n').length} lines</span>
      </div>
    </div>
  );
};

// ─── List Item ────────────────────────────────────────────────────────────────

const ListItem: React.FC<{
  block: PageBlock; index: number; prefix: string; prefixClass: string;
  onChange: (b: PageBlock) => void; onAddBelow: () => void; onDelete: () => void; isDark: boolean;
}> = ({ block, index, prefix, prefixClass, onChange, onAddBelow, onDelete, isDark }) => {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { if (ref.current) ref.current.innerHTML = block.content; }, []);
  return (
    <div className="flex items-baseline gap-3 w-full px-2 py-0.5">
      <span className={`select-none flex-shrink-0 leading-7 ${prefixClass}`}>{prefix}</span>
      <div
        ref={ref} contentEditable suppressContentEditableWarning
        data-placeholder="List item…"
        className={`flex-1 outline-none text-base leading-7 min-h-[1.75rem] break-words ${isDark ? 'text-gray-200' : 'text-gray-800'}`}
        style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
        onInput={() => { if (ref.current) onChange({ ...block, content: ref.current.innerHTML }); }}
        onKeyDown={e => {
          if (e.key === 'Enter') { e.preventDefault(); onAddBelow(); }
          if (e.key === 'Backspace' && (ref.current?.innerText || '') === '') { e.preventDefault(); onDelete(); }
        }}
      />
    </div>
  );
};

// ─── Block Component ──────────────────────────────────────────────────────────

const BlockComp: React.FC<{
  block: PageBlock; index: number;
  onChange: (b: PageBlock) => void;
  onDelete: () => void; onDuplicate: () => void;
  onMoveUp: () => void; onMoveDown: () => void;
  onAddBelow: (type: BlockType) => void;
  onSlash: (rect: DOMRect, idx: number) => void;
  onOpenMenu: (rect: DOMRect) => void;
  isSelected: boolean; onSelect: () => void;
  isDark: boolean; autoFocus?: boolean;
}> = ({
  block, index, onChange, onDelete, onDuplicate, onMoveUp, onMoveDown,
  onAddBelow, onSlash, onOpenMenu, isSelected, onSelect, isDark, autoFocus,
}) => {
  const [showGripMenu, setShowGripMenu] = useState(false);
  const plusRef = useRef<HTMLButtonElement>(null);
  const gripRef = useRef<HTMLButtonElement>(null);

  const renderContent = () => {
    switch (block.type) {
      case 'text': case 'heading1': case 'heading2': case 'heading3': case 'quote':
        return <DirectBlock block={block} onChange={onChange} onEnter={() => onAddBelow('text')} onDeleteIfEmpty={onDelete} onSlash={rect => onSlash(rect, index)} isDark={isDark} autoFocus={autoFocus} />;

      case 'bulleted_list':
        return <ListItem block={block} index={index} prefix="•" prefixClass="text-lg text-indigo-400" onChange={onChange} onAddBelow={() => onAddBelow('bulleted_list')} onDelete={onDelete} isDark={isDark} />;

      case 'numbered_list':
        return <ListItem block={block} index={index} prefix={`${index + 1}.`} prefixClass="text-sm font-mono text-indigo-400" onChange={onChange} onAddBelow={() => onAddBelow('numbered_list')} onDelete={onDelete} isDark={isDark} />;

      case 'todo':
        return (
          <div className="flex items-start gap-3 w-full">
            <input type="checkbox" checked={block.metadata?.checked || false} onChange={e => onChange({ ...block, metadata: { ...block.metadata, checked: e.target.checked } })} className="mt-3.5 w-4 h-4 rounded border-gray-300 text-indigo-600 cursor-pointer" />
            <DirectBlock block={block} onChange={onChange} onEnter={() => onAddBelow('todo')} onDeleteIfEmpty={onDelete} onSlash={rect => onSlash(rect, index)} isDark={isDark} autoFocus={autoFocus} />
          </div>
        );

      case 'divider':
        return (
          <div className="w-full flex items-center gap-3 py-2">
            <div className="flex-1 h-px" style={{ background: `linear-gradient(to right, transparent, ${isDark ? '#4b5563' : '#9ca3af'}, transparent)` }} />
            <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: isDark ? '#4b5563' : '#9ca3af' }} />
            <div className="flex-1 h-px" style={{ background: `linear-gradient(to right, transparent, ${isDark ? '#4b5563' : '#9ca3af'}, transparent)` }} />
          </div>
        );

      case 'image':
        return <ImageUploadBlock block={block} onChange={onChange} isDark={isDark} />;

      case 'snippet':
        return <SnippetBlock block={block} onChange={onChange} isDark={isDark} />;

      case 'callout': {
        const s = buildInlineStyle(block.metadata);
        return (
          <div className="w-full p-4 rounded-xl border flex gap-3 items-start" style={{ backgroundColor: s.backgroundColor || (isDark ? '#1e293b' : '#fff7ed'), borderColor: s.borderColor || (isDark ? '#334155' : '#fed7aa'), borderWidth: '1px', borderStyle: 'solid' }}>
            <select value={block.metadata?.url || '💡'} onChange={e => onChange({ ...block, metadata: { ...block.metadata, url: e.target.value } })} className="text-xl bg-transparent border-none outline-none cursor-pointer mt-1 flex-shrink-0">
              {['💡', '⚠️', '✅', '❌', '🔥', '📌', '💬', '🎯', '🚀', '📝'].map(em => <option key={em} value={em}>{em}</option>)}
            </select>
            <div className="flex-1 min-w-0">
              <DirectBlock block={block} onChange={onChange} onEnter={() => onAddBelow('text')} onDeleteIfEmpty={onDelete} onSlash={rect => onSlash(rect, index)} isDark={isDark} />
            </div>
          </div>
        );
      }

      case 'table': {
        const tableData: string[][] = block.metadata?.data || [['Header 1', 'Header 2'], ['', '']];
        return (
          <div className="w-full overflow-x-auto">
            <table className="w-full border-collapse">
              <tbody>
                {tableData.map((row, ri) => (
                  <tr key={ri} style={{ backgroundColor: ri === 0 ? (isDark ? '#1f2937' : '#f9fafb') : undefined }}>
                    {row.map((cell, ci) => (
                      <td key={ci} className={`px-3 py-2 ${ri === 0 ? 'font-semibold' : ''}`} style={{ border: `1px solid ${isDark ? '#374151' : '#e5e7eb'}`, fontSize: 14 }}>
                        <div contentEditable suppressContentEditableWarning className="outline-none min-w-[60px]"
                          onBlur={e => {
                            const nd = tableData.map(r => [...r]);
                            nd[ri][ci] = e.currentTarget.textContent || '';
                            onChange({ ...block, metadata: { ...block.metadata, data: nd } });
                          }}>{cell}</div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex gap-3 mt-2 px-1">
              <button onClick={() => onChange({ ...block, metadata: { ...block.metadata, data: [...tableData, Array(tableData[0]?.length || 2).fill('')] } })} className="text-xs text-indigo-500 font-medium hover:underline">+ Row</button>
              <button onClick={() => onChange({ ...block, metadata: { ...block.metadata, data: tableData.map(r => [...r, '']) } })} className="text-xs text-indigo-500 font-medium hover:underline">+ Col</button>
              {tableData.length > 1 && <button onClick={() => onChange({ ...block, metadata: { ...block.metadata, data: tableData.slice(0, -1) } })} className="text-xs text-red-400 font-medium hover:underline">- Row</button>}
            </div>
          </div>
        );
      }

      default:
        return <DirectBlock block={block} onChange={onChange} onEnter={() => onAddBelow('text')} onDeleteIfEmpty={onDelete} onSlash={rect => onSlash(rect, index)} isDark={isDark} />;
    }
  };

  return (
    <div
      className={`group/block relative w-full transition-all duration-100 ${isSelected ? 'ring-2 ring-inset ring-indigo-300 rounded-xl' : ''}`}
      onClick={onSelect}
    >
      {showGripMenu && <div className="fixed inset-0 z-30" onMouseDown={() => setShowGripMenu(false)} />}

      {/* Left controls (hover) */}
      <div className="absolute -left-14 top-1/2 -translate-y-1/2 flex items-center gap-0.5 opacity-0 group-hover/block:opacity-100 transition-opacity z-40">
        <button
          ref={plusRef}
          onClick={e => { e.stopPropagation(); const rect = plusRef.current!.getBoundingClientRect(); onOpenMenu(rect); }}
          className={`p-1.5 rounded-lg transition-colors ${isDark ? 'hover:bg-gray-700 text-gray-500 hover:text-gray-300' : 'hover:bg-gray-100 text-gray-400 hover:text-gray-700'}`}
          title="Add block"
        ><Plus size={14} /></button>
        <button
          ref={gripRef}
          onClick={e => { e.stopPropagation(); setShowGripMenu(v => !v); }}
          className={`p-1.5 rounded-lg transition-colors cursor-grab ${isDark ? 'hover:bg-gray-700 text-gray-500 hover:text-gray-300' : 'hover:bg-gray-100 text-gray-400 hover:text-gray-700'}`}
          title="Block options"
        ><GripVertical size={14} /></button>
      </div>

      {/* Grip context menu */}
      {showGripMenu && (
        <div className={`absolute left-0 top-0 rounded-xl shadow-xl border py-1.5 z-40 min-w-[180px] ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'}`} onMouseDown={e => e.stopPropagation()}>
          <button onClick={() => { onMoveUp(); setShowGripMenu(false); }} className={`w-full px-3 py-2 text-sm text-left ${isDark ? 'hover:bg-gray-700 text-gray-300' : 'hover:bg-gray-50 text-gray-700'}`}>↑ Move up</button>
          <button onClick={() => { onMoveDown(); setShowGripMenu(false); }} className={`w-full px-3 py-2 text-sm text-left ${isDark ? 'hover:bg-gray-700 text-gray-300' : 'hover:bg-gray-50 text-gray-700'}`}>↓ Move down</button>
          <div className={`h-px my-1 ${isDark ? 'bg-gray-700' : 'bg-gray-100'}`} />
          <button onClick={() => { onDuplicate(); setShowGripMenu(false); }} className={`w-full px-3 py-2 text-sm text-left flex items-center gap-2 ${isDark ? 'hover:bg-gray-700 text-gray-300' : 'hover:bg-gray-50 text-gray-700'}`}><Copy size={13} /> Duplicate</button>
          <div className={`h-px my-1 ${isDark ? 'bg-gray-700' : 'bg-gray-100'}`} />
          <button onClick={() => { onDelete(); setShowGripMenu(false); }} className="w-full px-3 py-2 text-sm text-left flex items-center gap-2 text-red-500 hover:bg-red-50"><Trash2 size={13} /> Delete block</button>
        </div>
      )}

      <div className="w-full px-3 py-1">{renderContent()}</div>
    </div>
  );
};

// ─── Pages Sidebar ────────────────────────────────────────────────────────────

const PagesSidebar: React.FC<{
  pages: PageData[]; activePageId: string;
  onSelectPage: (id: string) => void; onCreatePage: () => void;
  onDeletePage: (id: string) => void; onRenamePage: (id: string, name: string) => void;
  isDark: boolean;
}> = ({ pages, activePageId, onSelectPage, onCreatePage, onDeletePage, onRenamePage, isDark }) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const startRename = (page: PageData) => { setEditingId(page.id); setEditingName(page.title); setTimeout(() => inputRef.current?.focus(), 50); };
  const commitRename = () => { if (editingId && editingName.trim()) onRenamePage(editingId, editingName.trim()); setEditingId(null); };

  return (
    <div className={`flex flex-col w-48 flex-shrink-0 border-r h-full ${isDark ? 'bg-gray-900/80 border-gray-800' : 'bg-gray-50 border-gray-100'}`}>
      <div className={`flex items-center justify-between px-3 py-2.5 border-b ${isDark ? 'border-gray-800' : 'border-gray-100'}`}>
        <div className="flex items-center gap-2">
          <Layers size={12} className={isDark ? 'text-indigo-400' : 'text-indigo-500'} />
          <span className={`text-[10px] font-bold uppercase tracking-widest ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Pages</span>
        </div>
        <button onClick={onCreatePage} className={`p-1 rounded-md ${isDark ? 'hover:bg-indigo-900/40 text-indigo-400' : 'hover:bg-indigo-100 text-indigo-500'}`} title="New page"><Plus size={13} /></button>
      </div>

      <div className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
        {pages.map((page, idx) => (
          <div
            key={page.id}
            className={`group/page relative flex items-center gap-2 px-2 py-2 rounded-lg cursor-pointer transition-all ${
              activePageId === page.id
                ? isDark ? 'bg-indigo-900/40 text-indigo-300' : 'bg-indigo-50 text-indigo-700'
                : isDark ? 'hover:bg-gray-800 text-gray-400 hover:text-gray-200' : 'hover:bg-white text-gray-500 hover:text-gray-800 hover:shadow-sm'
            }`}
            onClick={() => onSelectPage(page.id)}
          >
            {activePageId === page.id && (
              <div className={`absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-full ${isDark ? 'bg-indigo-400' : 'bg-indigo-500'}`} />
            )}
            <FileText size={11} className="flex-shrink-0" />
            {editingId === page.id ? (
              <input
                ref={inputRef}
                value={editingName}
                onChange={e => setEditingName(e.target.value)}
                onBlur={commitRename}
                onKeyDown={e => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setEditingId(null); }}
                onClick={e => e.stopPropagation()}
                className={`flex-1 text-xs bg-transparent outline-none border-none min-w-0 ${isDark ? 'text-gray-200' : 'text-gray-800'}`}
              />
            ) : (
              <span className="flex-1 text-xs font-medium truncate">{page.title || 'Untitled'}</span>
            )}
            <span className={`flex-shrink-0 text-[9px] px-1 py-0.5 rounded-full font-mono ${isDark ? 'bg-gray-800 text-gray-600' : 'bg-gray-100 text-gray-400'}`}>{idx + 1}</span>
            <div className={`absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5 opacity-0 group-hover/page:opacity-100 transition-opacity ${isDark ? 'bg-gray-900' : 'bg-white'} rounded-md shadow-sm`}>
              <button onClick={e => { e.stopPropagation(); startRename(page); }} className={`p-0.5 rounded ${isDark ? 'hover:bg-gray-700 text-gray-500' : 'hover:bg-gray-100 text-gray-400'}`}><PenLine size={9} /></button>
              {pages.length > 1 && <button onClick={e => { e.stopPropagation(); onDeletePage(page.id); }} className="p-0.5 rounded text-red-400 hover:bg-red-50"><Trash2 size={9} /></button>}
            </div>
          </div>
        ))}
      </div>

      <div className={`px-3 py-3 border-t ${isDark ? 'border-gray-800' : 'border-gray-100'}`}>
        <button onClick={onCreatePage} className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl border-2 border-dashed text-xs font-medium transition-all ${isDark ? 'border-gray-700 text-gray-600 hover:border-indigo-700 hover:text-indigo-400' : 'border-gray-200 text-gray-400 hover:border-indigo-300 hover:text-indigo-500'}`}>
          <Plus size={11} />New Page
        </button>
      </div>
    </div>
  );
};

// ─── Preview Renderer (read-only) ─────────────────────────────────────────────

export const NotionPreviewRenderer: React.FC<{
  blocks: PageBlock[];
  isDark?: boolean;
}> = ({ blocks, isDark = false }) => (
  <>
    {blocks.map((block, i) => {
      if (!block.content && !['divider', 'table', 'image', 'callout', 'snippet'].includes(block.type)) return null;
      const s = buildInlineStyle(block.metadata);
      switch (block.type) {
        case 'heading1': return <h1 key={i} className="text-3xl font-bold tracking-tight mt-6 mb-3" style={s} dangerouslySetInnerHTML={{ __html: block.content }} />;
        case 'heading2': return <h2 key={i} className="text-2xl font-semibold mt-5 mb-2" style={s} dangerouslySetInnerHTML={{ __html: block.content }} />;
        case 'heading3': return <h3 key={i} className="text-xl font-medium mt-4 mb-2" style={s} dangerouslySetInnerHTML={{ __html: block.content }} />;
        case 'text': return <p key={i} className="text-base leading-relaxed mb-3" style={s} dangerouslySetInnerHTML={{ __html: block.content }} />;
        case 'bulleted_list': return <ul key={i} className="list-disc pl-6 mb-2" style={s}><li dangerouslySetInnerHTML={{ __html: block.content }} /></ul>;
        case 'numbered_list': return <ol key={i} className="list-decimal pl-6 mb-2" style={s}><li dangerouslySetInnerHTML={{ __html: block.content }} /></ol>;
        case 'todo': return (
          <div key={i} className="flex items-start gap-3 my-1.5">
            <input type="checkbox" checked={block.metadata?.checked} readOnly className="mt-1 w-4 h-4 flex-shrink-0" />
            <span className={block.metadata?.checked ? 'line-through opacity-50' : ''} dangerouslySetInnerHTML={{ __html: block.content }} />
          </div>
        );
        case 'quote': return (
          <blockquote key={i} className="border-l-4 pl-5 py-2 my-4 italic"
            style={{ borderColor: '#6366f1', background: isDark ? '#1e1b4b22' : '#f5f3ff', borderRadius: '0 8px 8px 0', ...s }}
            dangerouslySetInnerHTML={{ __html: block.content }} />
        );
        case 'divider': return <hr key={i} className="my-6" style={{ borderColor: isDark ? '#374151' : '#e5e7eb', borderTopWidth: '1.5px' }} />;
        case 'image': return block.content ? (
          <figure key={i} className="my-4">
            <img src={block.content} alt={block.metadata?.caption || ''} style={{ maxWidth: '100%', borderRadius: 8 }} />
            {block.metadata?.caption && <figcaption className="text-sm text-center mt-2 text-gray-400">{block.metadata.caption}</figcaption>}
          </figure>
        ) : null;
        case 'snippet': return (
          <div key={i} className="my-4 rounded-xl overflow-hidden border" style={{ borderColor: isDark ? '#334155' : '#e2e8f0' }}>
            {block.metadata?.snippetTitle && (
              <div className="px-4 py-2 text-sm font-bold" style={{ background: isDark ? '#1e293b' : '#f1f5f9', color: isDark ? '#f1f5f9' : '#0f172a', borderBottom: `1px solid ${isDark ? '#334155' : '#e2e8f0'}` }}>
                {block.metadata.snippetTitle}
              </div>
            )}
            <pre style={{ background: '#1e1e1e', padding: '12px 16px', margin: 0, overflowX: 'auto' }}>
              <code style={{ color: '#d4d4d4', fontFamily: 'Fira Code, Courier New, monospace', fontSize: 13 }}>{block.content}</code>
            </pre>
          </div>
        );
        case 'callout': return (
          <div key={i} className="flex gap-3 p-4 rounded-xl my-3" style={{ backgroundColor: s.backgroundColor || (isDark ? '#1e293b' : '#fff7ed'), border: `1px solid ${s.borderColor || (isDark ? '#334155' : '#fed7aa')}` }}>
            <span className="text-xl flex-shrink-0">{block.metadata?.url || '💡'}</span>
            <div dangerouslySetInnerHTML={{ __html: block.content }} />
          </div>
        );
        case 'table': return (
          <table key={i} className="w-full border-collapse my-4">
            <tbody>
              {(block.metadata?.data || []).map((row: string[], ri: number) => (
                <tr key={ri} style={{ backgroundColor: ri === 0 ? (isDark ? '#1f2937' : '#f9fafb') : undefined }}>
                  {row.map((cell: string, ci: number) => (
                    <td key={ci} style={{ border: `1px solid ${isDark ? '#374151' : '#e5e7eb'}`, padding: '8px 12px', fontWeight: ri === 0 ? 600 : undefined }}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        );
        default: return <p key={i} style={s} dangerouslySetInnerHTML={{ __html: block.content }} />;
      }
    })}
  </>
);

// ─── Word-like Pages Viewer (for ReviewSubmission) ────────────────────────────

export const NotionPagesViewer: React.FC<{
  pages: PageData[];
  isDark?: boolean;
}> = ({ pages, isDark = false }) => (
  <div className="flex flex-col gap-0">
    {pages.map((page, pageIdx) => (
      <div key={page.id}>
        {/* Page partition */}
        {pageIdx > 0 && (
          <div className="relative flex items-center my-8">
            <div className="flex-1 border-t-2 border-dashed" style={{ borderColor: isDark ? '#374151' : '#e5e7eb' }} />
            <div className={`mx-4 flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-semibold ${isDark ? 'bg-gray-800 border border-gray-700 text-gray-500' : 'bg-gray-50 border border-gray-200 text-gray-400'}`}>
              <FileText size={10} />
              Page {pageIdx + 1}
            </div>
            <div className="flex-1 border-t-2 border-dashed" style={{ borderColor: isDark ? '#374151' : '#e5e7eb' }} />
          </div>
        )}

        {/* Page card */}
        <div
          className="rounded-xl border shadow-sm overflow-hidden"
          style={{
            borderColor: isDark ? '#1f2937' : '#e5e7eb',
            background: isDark ? '#111827' : '#ffffff',
            boxShadow: isDark ? '0 2px 16px 0 rgba(0,0,0,0.5)' : '0 2px 16px 0 rgba(0,0,0,0.06)',
          }}
        >
          {/* Page header strip */}
          <div className={`px-6 py-3 border-b flex items-center gap-3 ${isDark ? 'bg-gray-900 border-gray-800' : 'bg-gray-50 border-gray-100'}`}>
            <div className={`w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-black ${isDark ? 'bg-indigo-900 text-indigo-300' : 'bg-indigo-100 text-indigo-600'}`}>{pageIdx + 1}</div>
            <span className={`text-sm font-semibold ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>{page.title || `Page ${pageIdx + 1}`}</span>
            <span className={`ml-auto text-[10px] ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>{page.blocks.filter(b => b.content.trim()).length} blocks</span>
          </div>

          {/* Page content */}
          <div className={`px-8 py-6 ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>
            <NotionPreviewRenderer blocks={page.blocks} isDark={isDark} />
          </div>
        </div>
      </div>
    ))}
  </div>
);

// ─── Main Editor Component ────────────────────────────────────────────────────

const OthersNotionEditor: React.FC<OthersNotionEditorProps> = ({
  notionSettings = {},
  initialPages,
  onChange,
  disabled = false,
}) => {
  const firstId = generateId();
  const defaultPages: PageData[] = initialPages?.length
    ? initialPages
    : [{ id: firstId, title: 'Page 1', blocks: [{ type: 'text' as BlockType, content: '', _uid: generateUid() }] }];

  const { current: pages, push: pushPages, undo: undoPages, redo: redoPages, canUndo, canRedo } = useUndoRedo<PageData[]>(defaultPages);

  const setPages = useCallback((updater: PageData[] | ((prev: PageData[]) => PageData[])) => {
    const next = typeof updater === 'function' ? updater(pages) : updater;
    pushPages(next);
    onChange(next);
  }, [pages, pushPages, onChange]);

  const [activePageId, setActivePageId] = useState(defaultPages[0].id);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [isPreview, setIsPreview] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const [autoFocusIndex, setAutoFocusIndex] = useState<number | null>(null);
  const [blockMenu, setBlockMenu] = useState<{ rect: DOMRect; afterIndex: number } | null>(null);

  const activePage = pages.find(p => p.id === activePageId) || pages[0];
  const blocks = activePage?.blocks || [];
  const title = activePage?.title || '';

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && !e.shiftKey && e.key === 'z') { e.preventDefault(); undoPages(); }
      if (mod && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) { e.preventDefault(); redoPages(); }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [undoPages, redoPages]);

  const setTitle = useCallback((newTitle: string) => {
    setPages(prev => prev.map(p => p.id === activePageId ? { ...p, title: newTitle } : p));
  }, [activePageId, setPages]);

  const setBlocks = useCallback((updater: PageBlock[] | ((prev: PageBlock[]) => PageBlock[])) => {
    setPages(prev => prev.map(p => {
      if (p.id !== activePageId) return p;
      return { ...p, blocks: typeof updater === 'function' ? updater(p.blocks) : updater };
    }));
  }, [activePageId, setPages]);

  const createPage = useCallback(() => {
    const newPage: PageData = { id: generateId(), title: `Page ${pages.length + 1}`, blocks: [{ type: 'text' as BlockType, content: '', _uid: generateUid() }] };
    setPages(prev => [...prev, newPage]);
    setActivePageId(newPage.id);
    setSelectedIndex(-1);
  }, [pages.length, setPages]);

  const deletePage = useCallback((id: string) => {
    setPages(prev => {
      if (prev.length <= 1) return prev;
      const remaining = prev.filter(p => p.id !== id);
      if (activePageId === id) setActivePageId(remaining[0].id);
      return remaining;
    });
  }, [activePageId, setPages]);

  const renamePage = useCallback((id: string, name: string) => {
    setPages(prev => prev.map(p => p.id === id ? { ...p, title: name } : p));
  }, [setPages]);

  const makeBlockMeta = useCallback((type: BlockType): Record<string, any> | undefined => {
    switch (type) {
      case 'todo': return { checked: false };
      case 'table': return { data: [['Header 1', 'Header 2'], ['', '']] };
      case 'callout': return { backgroundColor: isDark ? '#1e293b' : '#fff7ed', url: '💡' };
      case 'snippet': return { snippetTitle: '', snippetLanguage: 'javascript' };
      default: return undefined;
    }
  }, [isDark]);

  const addBlock = useCallback((type: BlockType, afterIndex?: number) => {
    const newBlock: PageBlock = { _uid: generateUid(), type, content: '', metadata: makeBlockMeta(type) };
    setBlocks(prev => {
      const at = afterIndex !== undefined ? afterIndex + 1 : prev.length;
      return [...prev.slice(0, at), newBlock, ...prev.slice(at)];
    });
    const at = afterIndex !== undefined ? afterIndex + 1 : blocks.length;
    setSelectedIndex(at);
    setAutoFocusIndex(at);
    setTimeout(() => setAutoFocusIndex(null), 100);
  }, [blocks.length, makeBlockMeta, setBlocks]);

  const updateBlock = useCallback((index: number, updated: PageBlock) => {
    setBlocks(prev => prev.map((b, i) => i === index ? updated : b));
  }, [setBlocks]);

  const deleteBlock = useCallback((index: number) => {
    setBlocks(prev => {
      if (prev.length === 1) return [{ type: 'text' as BlockType, content: '', _uid: generateUid() }];
      return prev.filter((_, i) => i !== index);
    });
    setSelectedIndex(prev => prev > index ? prev - 1 : prev === index ? index - 1 : prev);
  }, [setBlocks]);

  const duplicateBlock = useCallback((index: number) => {
    setBlocks(prev => {
      const b = prev[index]; if (!b) return prev;
      const clone: PageBlock = { ...b, _uid: generateUid(), metadata: b.metadata ? JSON.parse(JSON.stringify(b.metadata)) : undefined };
      return [...prev.slice(0, index + 1), clone, ...prev.slice(index + 1)];
    });
  }, [setBlocks]);

  const moveBlock = useCallback((index: number, dir: 'up' | 'down') => {
    setBlocks(prev => {
      if (dir === 'up' && index === 0) return prev;
      if (dir === 'down' && index === prev.length - 1) return prev;
      const arr = [...prev];
      const swap = dir === 'up' ? index - 1 : index + 1;
      [arr[index], arr[swap]] = [arr[swap], arr[index]];
      setSelectedIndex(swap);
      return arr;
    });
  }, [setBlocks]);

  return (
    <div className={`flex flex-col h-full ${isDark ? 'bg-gray-950' : 'bg-white'}`} style={{ fontFamily: "'Poppins', -apple-system, sans-serif" }}>

      {/* ── Top Bar ─────────────────────────────────────────────────────────── */}
      <div className={`flex-shrink-0 flex items-center justify-between px-4 py-2 border-b ${isDark ? 'border-gray-800 bg-gray-900/60' : 'border-gray-100 bg-white'}`}>
        <div className="flex items-center gap-1">
          <button onClick={undoPages} disabled={!canUndo || disabled} title="Undo (Ctrl+Z)" className={`p-1.5 rounded-lg transition-colors disabled:opacity-25 ${isDark ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}><Undo2 size={14} /></button>
          <button onClick={redoPages} disabled={!canRedo || disabled} title="Redo (Ctrl+Y)" className={`p-1.5 rounded-lg transition-colors disabled:opacity-25 ${isDark ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}><Redo2 size={14} /></button>
          <div className={`w-px h-4 mx-1 ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`} />
          {pages.length > 1 && (
            <div className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold ${isDark ? 'bg-indigo-900/40 text-indigo-300' : 'bg-indigo-50 text-indigo-600'}`}>
              <Layers size={10} />{pages.length} pages
            </div>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={() => setIsDark(v => !v)} className={`p-1.5 rounded-lg ${isDark ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}>{isDark ? <Sun size={14} /> : <Moon size={14} />}</button>
          <button onClick={() => setIsPreview(v => !v)} className={`p-1.5 rounded-lg ${isPreview ? 'bg-indigo-100 text-indigo-600' : isDark ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`} title={isPreview ? 'Edit' : 'Preview'}>{isPreview ? <Edit3 size={14} /> : <Eye size={14} />}</button>
        </div>
      </div>

      {/* ── Body: Sidebar + Editor ───────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        <PagesSidebar
          pages={pages} activePageId={activePageId}
          onSelectPage={id => { setActivePageId(id); setSelectedIndex(-1); }}
          onCreatePage={createPage} onDeletePage={deletePage} onRenamePage={renamePage}
          isDark={isDark}
        />

        {/* ── Editor Canvas ── */}
        <div
          className={`flex-1 overflow-y-auto ${isDark ? 'bg-gray-950' : 'bg-white'}`}
          style={{ scrollbarWidth: 'thin' }}
        >
          {!isPreview ? (
            <div className="w-full min-h-full max-w-3xl mx-auto px-14 py-10">
              {/* Page title */}
              <input
                type="text"
                value={title}
                onChange={e => !disabled && setTitle(e.target.value)}
                disabled={disabled}
                placeholder="Page title…"
                className={`w-full text-3xl font-bold bg-transparent border-none outline-none mb-6 tracking-tight ${isDark ? 'text-gray-100 placeholder-gray-700' : 'text-gray-900 placeholder-gray-300'}`}
              />

              {/* Blocks */}
              <div className="w-full space-y-0.5 pl-14">
                {blocks.map((block, index) => (
                  <BlockComp
                    key={`${activePageId}-${block._uid ?? index}`}
                    block={block} index={index}
                    onChange={u => !disabled && updateBlock(index, u)}
                    onDelete={() => !disabled && deleteBlock(index)}
                    onDuplicate={() => !disabled && duplicateBlock(index)}
                    onMoveUp={() => !disabled && moveBlock(index, 'up')}
                    onMoveDown={() => !disabled && moveBlock(index, 'down')}
                    onAddBelow={type => !disabled && addBlock(type, index)}
                    onSlash={(rect, idx) => !disabled && setBlockMenu({ rect, afterIndex: idx })}
                    onOpenMenu={rect => !disabled && setBlockMenu({ rect, afterIndex: index })}
                    isSelected={selectedIndex === index}
                    onSelect={() => setSelectedIndex(index)}
                    isDark={isDark}
                    autoFocus={autoFocusIndex === index}
                  />
                ))}

                {/* Add block button */}
                {!disabled && (
                  <div className="pt-3">
                    <button
                      onClick={e => {
                        const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
                        setBlockMenu({ rect, afterIndex: blocks.length - 1 });
                      }}
                      className={`w-full flex items-center gap-3 py-3 px-4 rounded-xl border-2 border-dashed text-sm transition-all ${isDark ? 'border-gray-800 text-gray-700 hover:border-indigo-700 hover:text-indigo-400' : 'border-gray-100 text-gray-300 hover:border-indigo-200 hover:text-indigo-400'}`}
                    >
                      <Plus size={14} />
                      <span>Click to add a block — or type <kbd className={`text-xs px-1.5 py-0.5 rounded mx-1 ${isDark ? 'bg-gray-800 text-gray-500' : 'bg-gray-100 text-gray-500'}`}>/</kbd> for commands</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* ── Preview Mode ── */
            <div className="w-full min-h-full max-w-3xl mx-auto px-14 py-10">
              <h1 className={`text-3xl font-bold mb-6 tracking-tight ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>{title}</h1>
              <div className={isDark ? 'text-gray-200' : 'text-gray-800'}>
                <NotionPreviewRenderer blocks={blocks} isDark={isDark} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Status Bar ────────────────────────────────────────────────────────── */}
      <div className={`flex-shrink-0 flex items-center justify-between px-4 py-1 border-t text-[10px] ${isDark ? 'border-gray-800 bg-gray-900/60 text-gray-600' : 'border-gray-100 bg-gray-50 text-gray-400'}`}>
        <div className="flex items-center gap-3">
          <span>{blocks.length} block{blocks.length !== 1 ? 's' : ''}</span>
          <span className="flex items-center gap-1"><Layers size={9} />Page {pages.findIndex(p => p.id === activePageId) + 1} / {pages.length}</span>
        </div>
        <span>
          {isPreview ? '👁 Preview' : '✏️ Editing'}
          {!disabled && <> · <kbd className="px-1 py-0.5 rounded bg-gray-100 text-gray-500">Ctrl+Z</kbd> undo · <kbd className="px-1 py-0.5 rounded bg-gray-100 text-gray-500">/</kbd> commands</>}
        </span>
      </div>

      {/* ── Block Picker Menu ─────────────────────────────────────────────────── */}
      {blockMenu && (
        <BlockPickerMenu
          anchorRect={blockMenu.rect}
          onSelect={type => { addBlock(type, blockMenu.afterIndex); setBlockMenu(null); }}
          onClose={() => setBlockMenu(null)}
          isDark={isDark}
          settings={notionSettings}
        />
      )}

      <style jsx global>{`
        [contenteditable]:empty:before { content: attr(data-placeholder); color: #9ca3af; pointer-events: none; }
        [contenteditable]:focus { outline: none; }
        * { box-sizing: border-box; }
      `}</style>
    </div>
  );
};

export default OthersNotionEditor;
