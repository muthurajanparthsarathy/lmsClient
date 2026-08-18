"use client";
import { getToken } from "@/lib/session";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  ChevronLeft, ChevronRight, Upload, X, Loader2, CheckCircle2,
  AlertCircle, Download, FileText, Eye,
  Timer
} from 'lucide-react';
import OthersNotionEditor, { PageData } from './OthersNotionEditor';
import ExerciseInfoModals, { ExerciseInfoButtons } from './ExerciseInfoModals';
import toast from 'react-hot-toast';

// ─── Types ────────────────────────────────────────────────────────────────────

interface OthersAttachment { name: string; url: string; mimeType: string; }
type OthersImageEntry = string | { url: string; alt?: string; alignment?: string; sizePercent?: number };
interface OthersDescription { text?: string; html?: string; images?: OthersImageEntry[]; attachments?: OthersAttachment[]; }
interface FileUploadSettings { allowMultiple?: boolean; maxFiles?: number; maxFileSizeMB?: number; allowedTypes?: string[]; }
interface NotionSettings {
  allowBold?: boolean; allowItalic?: boolean; allowUnderline?: boolean;
  allowBulletList?: boolean; allowNumberedList?: boolean; allowHeadings?: boolean;
  allowTable?: boolean; allowImage?: boolean; allowCode?: boolean; allowLinks?: boolean;
}
interface OthersContentBlock {
  id: string; type: 'text' | 'image';
  value?: string; url?: string;
  alignment?: 'left' | 'center' | 'right'; sizePercent?: number;
}
interface OthersQuestionAttachment { name: string; url: string; mimeType: string; }
interface OthersQuestion {
  _id: string; questionType: string; othersQuestionType: 'notion' | 'file-upload';
  title: string; description?: string | OthersDescription; difficulty?: string;
  score?: number; isRequired?: boolean;
  questionContent?: OthersContentBlock[];        // content blocks (text + image)
  attachments?: OthersQuestionAttachment[];      // teacher paperclip attachments
  descriptionImageUrl?: string;                  // legacy
  descriptionImageAlignment?: 'left' | 'center' | 'right';
  descriptionImageSizePercent?: number;
  fileUploadSettings?: FileUploadSettings; notionSettings?: NotionSettings;
}
interface StudentFileAnswer { name: string; url: string; mimeType: string; }
interface StudentAnswer {
  type: 'notion' | 'file-upload';
  html?: string;
  notionPages?: PageData[];
  files?: StudentFileAnswer[];
}
interface OthersExamProps {
  exercise: any; courseId: string; courseName: string;
  nodeId: string; nodeName: string; nodeType: string;
  studentId: string; category: string; subcategory: string;
  hierarchy: string[]; onClose: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ALLOWED_TYPE_MAP: Record<string, string> = {
  pdf: '.pdf,application/pdf',
  docx: '.doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: '.xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pptx: '.ppt,.pptx,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation',
  image: '.jpg,.jpeg,.png,.gif,.webp,image/*',
  zip: '.zip,.rar,.7z', txt: '.txt,text/plain', csv: '.csv,text/csv', mp4: '.mp4,.mov,.avi,video/*',
};

function buildAcceptString(allowedTypes: string[] = []): string {
  if (!allowedTypes.length) return '*/*';
  return allowedTypes.flatMap(t => (ALLOWED_TYPE_MAP[t] || t).split(',')).join(',');
}

// Validate a file against allowed types setting
const MIME_TYPE_MAP: Record<string, string[]> = {
  pdf: ['application/pdf'],
  docx: ['application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  xlsx: ['application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  pptx: ['application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'],
  image: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'],
  zip: ['application/zip', 'application/x-zip-compressed', 'application/x-rar-compressed'],
  txt: ['text/plain'],
  csv: ['text/csv', 'application/csv'],
  mp4: ['video/mp4', 'video/quicktime', 'video/x-msvideo'],
};
const EXT_MAP: Record<string, string[]> = {
  pdf: ['.pdf'], docx: ['.doc', '.docx'], xlsx: ['.xls', '.xlsx'],
  pptx: ['.ppt', '.pptx'], image: ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
  zip: ['.zip', '.rar', '.7z'], txt: ['.txt'], csv: ['.csv'], mp4: ['.mp4', '.mov', '.avi'],
};

function isFileTypeAllowed(file: File, allowedTypes: string[]): boolean {
  if (!allowedTypes.length) return true;
  const mime = file.type.toLowerCase();
  const ext = '.' + file.name.split('.').pop()!.toLowerCase();
  return allowedTypes.some(t => {
    const mimes = MIME_TYPE_MAP[t] || [];
    const exts = EXT_MAP[t] || [];
    return mimes.some(m => mime.includes(m)) || exts.includes(ext);
  });
}

function getTypeLabel(allowedTypes: string[]): string {
  return allowedTypes.map(t => t.toUpperCase()).join(', ');
}

function getFileIcon(mimeType: string): string {
  if (!mimeType) return '📎';
  if (mimeType.includes('pdf')) return '📄';
  if (mimeType.includes('word') || mimeType.includes('doc')) return '📝';
  if (mimeType.includes('excel') || mimeType.includes('sheet') || mimeType.includes('csv')) return '📊';
  if (mimeType.includes('powerpoint') || mimeType.includes('presentation')) return '📋';
  if (mimeType.startsWith('image/')) return '🖼️';
  if (mimeType.startsWith('video/')) return '🎥';
  if (mimeType.includes('zip') || mimeType.includes('rar')) return '🗜️';
  return '📎';
}

function parseDescription(desc: string | OthersDescription | undefined): OthersDescription {
  if (!desc) return {};
  if (typeof desc === 'string') return { text: desc, html: desc };
  return desc;
}

// ─── Injected styles ──────────────────────────────────────────────────────────

const STYLES = `
  .oe-root { font-family: 'Poppins', -apple-system, BlinkMacSystemFont, sans-serif; }
  .oe-scroll::-webkit-scrollbar { width: 5px; }
  .oe-scroll::-webkit-scrollbar-track { background: transparent; }
  .oe-resizer:hover > .oe-resizer-line { border-color: #6366f1 !important; }
  .oe-resizer:hover > .oe-resizer-handle { background: #6366f1 !important; height: 48px !important; }
  .oe-scroll::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 4px; }
  .oe-scroll::-webkit-scrollbar-thumb:hover { background: #9ca3af; }
  .oe-editor:empty::before { content: attr(data-placeholder); color: #9ca3af; pointer-events: none; }
  .oe-editor:focus { outline: none; }
  .oe-fmt-btn { padding: 5px 9px; border: none; background: transparent; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 700; color: #6b7280; transition: background 0.12s, color 0.12s; line-height: 1; }
  .oe-fmt-btn:hover { background: #f3f4f6; color: #111827; }
  .oe-fmt-btn.active { background: #fef3c7; color: #92400e; }
  .oe-nav-btn { display: inline-flex; align-items: center; gap: 6px; padding: 9px 20px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; border: 1.5px solid #e5e7eb; background: #fff; color: #374151; transition: all 0.15s; font-family: inherit; }
  .oe-nav-btn:hover:not(:disabled) { background: #f9fafb; border-color: #d1d5db; }
  .oe-nav-btn:disabled { opacity: 0.35; cursor: not-allowed; }
  .oe-submit-btn { display: inline-flex; align-items: center; gap: 6px; padding: 9px 22px; border-radius: 8px; font-size: 13px; font-weight: 700; cursor: pointer; border: none; background: #16a34a; color: #fff; transition: all 0.15s; font-family: inherit; box-shadow: 0 2px 8px rgba(22,163,74,0.25); }
  .oe-submit-btn:hover:not(:disabled) { background: #15803d; }
  .oe-submit-btn:disabled { opacity: 0.4; cursor: not-allowed; box-shadow: none; }
  .oe-q-dot { width: 30px; height: 30px; border-radius: 7px; border: 1.5px solid #e5e7eb; background: #fff; color: #6b7280; font-size: 11px; font-weight: 700; cursor: pointer; transition: all 0.12s; font-family: inherit; }
  .oe-q-dot:hover { border-color: #f97316; color: #f97316; background: #fff7ed; }
  .oe-q-dot.active { border-color: #f97316; background: #f97316; color: #fff; }
  .oe-q-dot.answered { border-color: #16a34a; background: #f0fdf4; color: #16a34a; }
  .oe-q-dot.answered.active { background: #16a34a; color: #fff; }
  .oe-upload-zone { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 32px 20px; border-radius: 10px; cursor: pointer; border: 2px dashed #e5e7eb; background: #fafafa; transition: all 0.15s; }
  .oe-upload-zone:hover, .oe-upload-zone.drag { border-color: #f97316; background: #fff7ed; }
  .oe-file-row { display: flex; align-items: center; gap: 10px; padding: 10px 14px; border-radius: 8px; background: #f0fdf4; border: 1px solid #bbf7d0; }
  .oe-att-chip { display: inline-flex; align-items: center; gap: 5px; padding: 4px 10px; border-radius: 20px; background: #fff7ed; border: 1px solid #fed7aa; font-size: 11.5px; font-weight: 600; color: #f97316; text-decoration: none; max-width: 220px; }
`;

function injectStyles() {
  if (typeof document === 'undefined') return;
  if (document.getElementById('oe-styles')) return;
  const el = document.createElement('style');
  el.id = 'oe-styles';
  el.textContent = STYLES;
  document.head.appendChild(el);
}

// ─── Question Attachments (teacher paperclip files) ──────────────────────────

const QuestionAttachments: React.FC<{ attachments: OthersQuestionAttachment[] }> = ({ attachments }) => {
  const [previewAtt, setPreviewAtt] = useState<OthersQuestionAttachment | null>(null);
  return (
    <>
      <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <p style={{
          fontSize: 11, fontWeight: 700, color: '#9ca3af',
          textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 4px',
        }}>
          Attachments
        </p>
        {attachments.map((att, idx) => (
          <button key={idx} type="button"
            onClick={() => setPreviewAtt(att)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 12px', borderRadius: 8, textAlign: 'left',
              background: '#f8fafc', border: '1.5px solid #e2e8f0',
              cursor: 'pointer', width: '100%',
              transition: 'border-color 0.15s, background 0.15s',
              fontFamily: 'inherit',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.borderColor = '#f97316';
              (e.currentTarget as HTMLElement).style.background = '#fff7ed';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.borderColor = '#e2e8f0';
              (e.currentTarget as HTMLElement).style.background = '#f8fafc';
            }}
          >
            <span style={{ fontSize: 18, flexShrink: 0 }}>{getFileIcon(att.mimeType || '')}</span>
            <span style={{
              flex: 1, fontSize: 13, fontWeight: 600, color: '#f97316',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              textDecoration: 'underline', textUnderlineOffset: 2,
            }}>{att.name}</span>
            <Eye style={{ width: 13, height: 13, color: '#94a3b8', flexShrink: 0 }} />
          </button>
        ))}
      </div>
      {previewAtt && (
        <FilePreviewModal
          file={{ name: previewAtt.name, url: previewAtt.url, mimeType: previewAtt.mimeType }}
          onClose={() => setPreviewAtt(null)}
        />
      )}
    </>
  );
};

// ─── Description Block ────────────────────────────────────────────────────────

const DescriptionBlock: React.FC<{ description: string | OthersDescription | undefined }> = ({ description }) => {
  const desc = parseDescription(description);
  const hasContent = desc.html || desc.text || desc.images?.length || desc.attachments?.length;
  if (!hasContent) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 6 }}>
      {(desc.html || desc.text) && (
        <div
          style={{ fontSize: 14, color: '#4b5563', lineHeight: 1.75 }}
          dangerouslySetInnerHTML={{ __html: desc.html || desc.text || '' }}
        />
      )}
      {!!desc.images?.length && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {desc.images.map((entry, i) => {
            const imgUrl   = typeof entry === 'string' ? entry : entry.url;
            const imgSize  = typeof entry === 'object' && typeof entry.sizePercent === 'number' ? entry.sizePercent : 60;
            const imgAlign = typeof entry === 'object' ? (entry.alignment || 'center') : 'center';
            const justify  = imgAlign === 'left' ? 'flex-start' : imgAlign === 'right' ? 'flex-end' : 'center';
            return (
              <div key={i} style={{ display: 'flex', justifyContent: justify }}>
                <img src={imgUrl} alt=""
                  style={{ width: `${imgSize}%`, height: 'auto', objectFit: 'contain', borderRadius: 8, border: '1px solid #e5e7eb', display: 'block' }} />
              </div>
            );
          })}
        </div>
      )}
      {!!desc.attachments?.length && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {desc.attachments.map((att, i) => (
            <a key={i} href={att.url} target="_blank" rel="noopener noreferrer" className="oe-att-chip">
              <span>{getFileIcon(att.mimeType)}</span>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{att.name}</span>
              <Download style={{ width: 10, height: 10, flexShrink: 0 }} />
            </a>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Notion Editor ────────────────────────────────────────────────────────────

const NotionAnswerEditor: React.FC<{
  value: string; onChange: (html: string) => void;
  notionSettings?: NotionSettings; disabled?: boolean;
}> = ({ value, onChange, notionSettings = {}, disabled }) => {
  const editRef = useRef<HTMLDivElement>(null);
  const lastHtml = useRef('');
  const [fmt, setFmt] = useState({ bold: false, italic: false, underline: false });

  useEffect(() => {
    const el = editRef.current;
    if (!el || lastHtml.current === value) return;
    el.innerHTML = value || '';
    lastHtml.current = value || '';
  });

  const trackFmt = () => setFmt({
    bold: document.queryCommandState('bold'),
    italic: document.queryCommandState('italic'),
    underline: document.queryCommandState('underline'),
  });

  const applyFmt = (cmd: string) => {
    document.execCommand(cmd);
    trackFmt();
    const el = editRef.current;
    if (el) { lastHtml.current = el.innerHTML; onChange(el.innerHTML); }
  };

  const handleInput = () => {
    const el = editRef.current;
    if (!el) return;
    lastHtml.current = el.innerHTML;
    onChange(el.innerHTML);
    trackFmt();
  };

  const showBold = notionSettings.allowBold !== false;
  const showItalic = notionSettings.allowItalic !== false;
  const showUnderline = notionSettings.allowUnderline !== false;
  const hasToolbar = !disabled && (showBold || showItalic || showUnderline);

  return (
    <div style={{ border: '1.5px solid #e5e7eb', borderRadius: 10, overflow: 'hidden', background: '#fff' }}>
      {hasToolbar && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, padding: '6px 8px', borderBottom: '1px solid #f3f4f6', background: '#f9fafb' }}>
          {showBold && (
            <button type="button" className={`oe-fmt-btn${fmt.bold ? ' active' : ''}`}
              onMouseDown={e => { e.preventDefault(); applyFmt('bold'); }}
              style={{ fontWeight: 900 }}>B</button>
          )}
          {showItalic && (
            <button type="button" className={`oe-fmt-btn${fmt.italic ? ' active' : ''}`}
              onMouseDown={e => { e.preventDefault(); applyFmt('italic'); }}
              style={{ fontStyle: 'italic' }}>I</button>
          )}
          {showUnderline && (
            <button type="button" className={`oe-fmt-btn${fmt.underline ? ' active' : ''}`}
              onMouseDown={e => { e.preventDefault(); applyFmt('underline'); }}
              style={{ textDecoration: 'underline' }}>U</button>
          )}
        </div>
      )}
      <div
        ref={editRef}
        contentEditable={!disabled}
        suppressContentEditableWarning
        className="oe-editor"
        onInput={handleInput}
        onKeyUp={trackFmt}
        onMouseUp={trackFmt}
        data-placeholder="Type your answer here…"
        style={{
          minHeight: 160, padding: '14px 16px',
          fontSize: 14, color: '#111827', lineHeight: 1.75,
          whiteSpace: 'pre-wrap', wordBreak: 'break-word',
        }}
      />
    </div>
  );
};

// ─── File Upload Answer ───────────────────────────────────────────────────────

// ─── File Preview Modal ───────────────────────────────────────────────────────

/** Returns true if the file is a Word / Excel / PowerPoint document */
function isOfficeFile(mime: string, name: string): boolean {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  const officeExts = ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'];
  const officeMimes = [
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  ];
  return officeExts.includes(ext) || officeMimes.some(m => mime.includes(m));
}

/** Microsoft Office Online viewer URL — file.url must be publicly reachable */
function officeViewerUrl(fileUrl: string): string {
  return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(fileUrl)}`;
}

const FilePreviewModal: React.FC<{
  file: StudentFileAnswer;
  onClose: () => void;
}> = ({ file, onClose }) => {
  const mime = file.mimeType || '';
  const nameLower = file.name.toLowerCase();
  const isPdf = mime.includes('pdf') || nameLower.endsWith('.pdf');
  const isImage = mime.startsWith('image/');
  const isVideo = mime.startsWith('video/');
  const isText = mime.includes('text/plain') || nameLower.endsWith('.txt') || nameLower.endsWith('.csv');
  const isOffice = !isPdf && !isImage && !isVideo && !isText && isOfficeFile(mime, file.name);

  const [textContent, setTextContent] = useState<string | null>(null);
  const [officeError, setOfficeError] = useState(false);

  useEffect(() => {
    if (isText) {
      fetch(file.url).then(r => r.text()).then(setTextContent).catch(() => setTextContent(null));
    }
  }, [file.url, isText]);

  // Decide padding for the content area
  const noPad = isPdf || isImage || isVideo || isOffice;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{
        background: '#fff', borderRadius: 14, width: '100%', maxWidth: 920,
        maxHeight: '92vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 24px 64px rgba(0,0,0,0.3)', overflow: 'hidden',
      }}>
        {/* ── Header ── */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '14px 18px', borderBottom: '1px solid #f0f0f0',
          background: '#fafafa', flexShrink: 0,
        }}>
          <span style={{ fontSize: 22 }}>{getFileIcon(mime)}</span>
          <span style={{
            flex: 1, fontSize: 14, fontWeight: 700, color: '#111827',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            fontFamily: 'inherit',
          }}>{file.name}</span>
          <a href={file.url} target="_blank" rel="noopener noreferrer" download={file.name}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600,
              background: '#fff7ed', color: '#f97316', border: '1px solid #fed7aa',
              textDecoration: 'none', flexShrink: 0,
            }}>
            <Download style={{ width: 13, height: 13 }} /> Download
          </a>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', cursor: 'pointer', padding: 6,
            borderRadius: 8, display: 'flex', color: '#6b7280', flexShrink: 0,
          }}>
            <X style={{ width: 18, height: 18 }} />
          </button>
        </div>

        {/* ── Content ── */}
        <div style={{ flex: 1, overflow: 'auto', padding: noPad ? 0 : 20 }}>

          {/* PDF */}
          {isPdf && (
            <iframe src={file.url} style={{ width: '100%', height: '78vh', border: 'none', display: 'block' }}
              title={file.name} />
          )}

          {/* Image */}
          {isImage && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, minHeight: 300 }}>
              <img src={file.url} alt={file.name}
                style={{ maxWidth: '100%', maxHeight: '72vh', objectFit: 'contain', borderRadius: 8 }} />
            </div>
          )}

          {/* Video */}
          {isVideo && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
              <video src={file.url} controls style={{ maxWidth: '100%', maxHeight: '68vh', borderRadius: 8 }} />
            </div>
          )}

          {/* Plain text / CSV */}
          {isText && (
            textContent !== null
              ? <pre style={{
                fontSize: 13, color: '#374151', lineHeight: 1.8, whiteSpace: 'pre-wrap',
                wordBreak: 'break-word', fontFamily: 'ui-monospace, monospace', margin: 0,
              }}>{textContent}</pre>
              : <div style={{ padding: 32, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>Loading…</div>
          )}

          {/* Office files — Word / Excel / PowerPoint via MS Office Online viewer */}
          {isOffice && !officeError && (
            <div style={{ position: 'relative', width: '100%', height: '78vh' }}>
              <iframe
                src={officeViewerUrl(file.url)}
                style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
                title={file.name}
                onError={() => setOfficeError(true)}
              />
              {/* Subtle note */}
              <div style={{
                position: 'absolute', bottom: 0, left: 0, right: 0,
                padding: '6px 14px', background: 'rgba(249,250,251,0.92)',
                borderTop: '1px solid #f0f0f0', fontSize: 11, color: '#9ca3af',
                textAlign: 'center',
              }}>
                Previewed via Microsoft Office Online · File must be publicly accessible
              </div>
            </div>
          )}

          {/* Office viewer failed OR unknown type */}
          {(!isPdf && !isImage && !isVideo && !isText && (!isOffice || officeError)) && (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', gap: 16, padding: 48, textAlign: 'center',
            }}>
              <span style={{ fontSize: 56 }}>{getFileIcon(mime)}</span>
              <p style={{ fontSize: 15, fontWeight: 600, color: '#374151', margin: 0 }}>
                {officeError ? 'Office preview unavailable' : 'Preview not available for this file type'}
              </p>
              <p style={{ fontSize: 13, color: '#6b7280', margin: 0, maxWidth: 340 }}>
                {officeError
                  ? 'The file could not be loaded by the Office viewer. This usually means the file URL is not publicly accessible.'
                  : 'Download the file to view its contents.'}
              </p>
              <a href={file.url} target="_blank" rel="noopener noreferrer" download={file.name}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '10px 20px', borderRadius: 8, fontSize: 13, fontWeight: 700,
                  background: '#f97316', color: '#fff', textDecoration: 'none',
                  boxShadow: '0 2px 8px rgba(249,115,22,0.3)',
                }}>
                <Download style={{ width: 15, height: 15 }} /> Download {file.name}
              </a>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

// ─── File Upload Answer Area ──────────────────────────────────────────────────
const FileUploadAnswerArea: React.FC<{
  settings: FileUploadSettings; files: StudentFileAnswer[];
  onFilesChange: (files: StudentFileAnswer[]) => void;
  disabled?: boolean; questionId: string;
}> = ({ settings, files, onFilesChange, disabled }) => {
  const [uploading, setUploading] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);
  const [previewFile, setPreviewFile] = useState<StudentFileAnswer | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const maxFiles = settings.allowMultiple ? (settings.maxFiles || 5) : 1;
  const maxSizeMB = settings.maxFileSizeMB || 10;
  const allowedTypes = settings.allowedTypes || [];
  const atLimit = files.length >= maxFiles;

  const doUpload = async (file: File): Promise<string | null> => {
    // ── Validate type ──────────────────────────────────────────────────────────
    if (allowedTypes.length && !isFileTypeAllowed(file, allowedTypes)) {
      return `"${file.name}" is not allowed. Accepted: ${getTypeLabel(allowedTypes)}.`;
    }
    // ── Validate size ──────────────────────────────────────────────────────────
    if (file.size > maxSizeMB * 1024 * 1024) {
      return `"${file.name}" exceeds the ${maxSizeMB} MB limit.`;
    }
    // ── Validate count ─────────────────────────────────────────────────────────
    if (files.length >= maxFiles) {
      return `Maximum ${maxFiles} file${maxFiles > 1 ? 's' : ''} allowed.`;
    }
    // ── Upload ─────────────────────────────────────────────────────────────────
    try {
      const token = getToken() || localStorage.getItem('token') || '';
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('http://localhost:5533/upload/question-file', {
        method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd,
      });
      const json = await res.json();
      if (!res.ok || !json.success) return json.message || 'Upload failed';
      onFilesChange([...files, { name: json.name || file.name, url: json.url, mimeType: json.mimeType || file.type }]);
      return null; // no error
    } catch (e: any) {
      return e.message || 'Upload failed. Please try again.';
    }
  };

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList || disabled || atLimit) return;
    setErrors([]);
    setUploading(true);
    const picked = settings.allowMultiple ? Array.from(fileList) : [fileList[0]];
    const errs: string[] = [];
    for (const f of picked) {
      const err = await doUpload(f);
      if (err) errs.push(err);
    }
    setErrors(errs);
    setUploading(false);
    // reset input so same file can be re-selected
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* ── Upload zone (always shown, dimmed when at limit) ── */}
      <div
        className={`oe-upload-zone${dragging ? ' drag' : ''}`}
        style={{ opacity: atLimit || disabled ? 0.5 : 1, cursor: atLimit || disabled ? 'not-allowed' : 'pointer' }}
        onDragOver={e => { if (atLimit || disabled) return; e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files); }}
        onClick={() => { if (!atLimit && !disabled) inputRef.current?.click(); }}
      >
        {uploading ? (
          <>
            <Loader2 style={{ width: 26, height: 26, color: '#f97316' }} className="animate-spin" />
            <span style={{ fontSize: 13, color: '#6b7280' }}>Uploading…</span>
          </>
        ) : (
          <>
            <Upload style={{ width: 26, height: 26, color: dragging ? '#f97316' : '#9ca3af' }} />
            <p style={{ fontSize: 13, fontWeight: 600, color: '#374151', margin: 0 }}>
              {atLimit ? `Maximum ${maxFiles} file${maxFiles > 1 ? 's' : ''} reached` : 'Drag & drop or click to upload'}
            </p>
            <p style={{ fontSize: 11, color: '#9ca3af', margin: 0 }}>
              Max {maxSizeMB} MB
              {allowedTypes.length ? ` · ${getTypeLabel(allowedTypes)}` : ''}
              {settings.allowMultiple && maxFiles > 1 ? ` · Up to ${maxFiles} files` : ''}
            </p>
          </>
        )}
        <input ref={inputRef} type="file"
          accept={buildAcceptString(allowedTypes)}
          multiple={!!(settings.allowMultiple)}
          style={{ display: 'none' }}
          onChange={e => handleFiles(e.target.files)} />
      </div>

      {/* ── Uploaded files list ── */}
      {files.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {files.map((f, idx) => (
            <div key={idx} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 14px', borderRadius: 10,
              background: '#f0fdf4', border: '1.5px solid #bbf7d0',
            }}>
              {/* Icon */}
              <span style={{ fontSize: 20, flexShrink: 0 }}>{getFileIcon(f.mimeType)}</span>

              {/* Clickable filename → preview modal */}
              <button
                type="button"
                onClick={() => setPreviewFile(f)}
                style={{
                  flex: 1, background: 'none', border: 'none', padding: 0,
                  cursor: 'pointer', textAlign: 'left', minWidth: 0,
                  display: 'flex', alignItems: 'center', gap: 6,
                }}>
                <span style={{
                  fontSize: 13, fontWeight: 600, color: '#15803d',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  textDecoration: 'underline', textUnderlineOffset: 2,
                }}>
                  {f.name}
                </span>
                <Eye style={{ width: 13, height: 13, color: '#16a34a', flexShrink: 0 }} />
              </button>

              {/* Remove button */}
              {!disabled && (
                <button
                  type="button"
                  onClick={() => { onFilesChange(files.filter((_, i) => i !== idx)); setErrors([]); }}
                  style={{
                    background: '#fee2e2', border: '1px solid #fecaca',
                    borderRadius: 6, cursor: 'pointer', padding: '3px 6px',
                    display: 'flex', alignItems: 'center', gap: 3,
                    fontSize: 11, fontWeight: 600, color: '#dc2626', flexShrink: 0,
                  }}>
                  <X style={{ width: 12, height: 12 }} /> Remove
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Validation errors ── */}
      {errors.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {errors.map((err, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, fontSize: 12, color: '#dc2626' }}>
              <AlertCircle style={{ width: 13, height: 13, flexShrink: 0, marginTop: 1 }} />
              <span>{err}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── File preview modal ── */}
      {previewFile && (
        <FilePreviewModal file={previewFile} onClose={() => setPreviewFile(null)} />
      )}
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

const OthersExam: React.FC<OthersExamProps> = ({
  exercise, courseId, nodeId, nodeName, nodeType,courseName,
  category, subcategory, hierarchy = [], onClose,
}) => {
  useEffect(() => { injectStyles(); }, []);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, StudentAnswer>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Resizable split panel
  const [leftPct, setLeftPct] = useState(40);
  const isDragging = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Timer state
  const [timeLeft, setTimeLeft] = useState(0);
  const [totalDuration, setTotalDuration] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);


  const handleResizerMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const onMouseMove = (ev: MouseEvent) => {
      if (!isDragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const pct = ((ev.clientX - rect.left) / rect.width) * 100;
      setLeftPct(Math.min(65, Math.max(25, pct)));
    };

    const onMouseUp = () => {
      isDragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, []);

  useEffect(() => {
    const exerciseInfo = exercise.exerciseInformation || exercise;
    const duration = exerciseInfo.totalDuration || 0;
    
    if (duration > 0) {
      setTotalDuration(duration);
      setTimeLeft(duration * 60); // Convert minutes to seconds
      
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            if (timerRef.current) clearInterval(timerRef.current);
            // Auto-submit when time is up (uses a ref so it always sees the
            // student's latest answers, not the mount-time snapshot)
            timeUpRef.current();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [exercise]);

  // Keep the auto-submit handler fresh so the timer reads current answers.
  const timeUpRef = useRef<() => void>(() => {});
  useEffect(() => {
    timeUpRef.current = () => {
      if (submitted || isSubmitting) return;
      handleSubmit(undefined, { auto: true });
    };
  });

  const formatTime = (seconds: number): string => {
    if (seconds <= 0) return '00:00';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
    return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };


  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState('');

  // Exercise Info / Overview modals
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showOverviewModal, setShowOverviewModal] = useState(false);

  const questions: OthersQuestion[] = (exercise.questions || []).filter((q: any) => q.questionType === 'others');
  const exerciseInfo = exercise.exerciseInformation || exercise;
  const exerciseName = exerciseInfo.exerciseName || exercise.title || 'Exercise';
  const exerciseId = exercise._id;
  const currentQuestion = questions[currentIndex] ?? null;

  const setNotionPages = useCallback((qId: string, pages: PageData[]) => {
    setAnswers(prev => ({ ...prev, [qId]: { type: 'notion', notionPages: pages } }));
  }, []);

  const setNotionAnswer = useCallback((qId: string, html: string) => {
    setAnswers(prev => ({ ...prev, [qId]: { type: 'notion', html } }));
  }, []);

  const setFileAnswer = useCallback((qId: string, files: StudentFileAnswer[]) => {
    setAnswers(prev => ({ ...prev, [qId]: { type: 'file-upload', files } }));
  }, []);

  const isAnswered = (q: OthersQuestion) => {
    const a = answers[q._id];
    if (!a) return false;
    if (a.type === 'notion') {
      if (a.notionPages?.length) return a.notionPages.some(p => p.blocks.some(b => b.content.trim()));
      return !!(a.html?.trim());
    }
    if (a.type === 'file-upload') return (a.files?.length || 0) > 0;
    return false;
  };

  const answeredCount = questions.filter(isAnswered).length;

  // Indices of answered questions (drives the Score Overview "answered" count)
  const solvedQuestions = new Set<number>(
    questions.map((q, i) => (isAnswered(q) ? i : -1)).filter(i => i >= 0)
  );
  // Exercise object whose `questions` match the indices above, so the
  // ExerciseInfo / Overview modals compute totals & per-difficulty marks correctly.
  const infoExercise = { ...exercise, questions };
  const isGraded = (exercise as any)?.isGraded !== false;

  // Accepts optional override for the current question's notion pages
  // (needed because React state update is async — called right before handleSubmit)
  const handleSubmit = async (notionPagesOverride?: { qId: string; pages: PageData[] }, opts?: { auto?: boolean }) => {
    if (submitted) return;
    setIsSubmitting(true); setSubmitError('');
    try {
      const token = getToken() || localStorage.getItem('token') || '';
      for (const q of questions) {
        // Use override pages if provided for this question, otherwise use state
        let ans = answers[q._id];
        if (notionPagesOverride && notionPagesOverride.qId === q._id) {
          ans = { type: 'notion', notionPages: notionPagesOverride.pages };
        }
        if (!ans) continue;
        const fd = new FormData();
        fd.append('courseId', courseId);
        fd.append('exerciseId', exerciseId);
        fd.append('questionId', q._id);
        fd.append('category', category);
        fd.append('subcategory', subcategory);
        fd.append('nodeId', nodeId);
        fd.append('nodeName', nodeName || exerciseName);
        fd.append('score', '0');
        fd.append('status', 'submitted');
        if (ans.type === 'notion') {
          fd.append('nodeType', 'others_notion');
          fd.append('language', 'html');
          if (ans.notionPages?.length) {
            // Full multi-page Notion answer — store as JSON
            fd.append('code', JSON.stringify({ type: 'notionPages', pages: ans.notionPages }));
          } else {
            fd.append('code', ans.html || '');
          }
        } else {
          fd.append('nodeType', 'others_file');
          fd.append('language', 'json');
          fd.append('code', '');
          fd.append('othersFiles', JSON.stringify(ans.files || []));
        }
        await fetch('http://localhost:5533/courses/answers/submit', {
          method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd,
        });
      }

      // ── Final submission flag — increments testSubmissions on the backend
      // so exercises.tsx can detect this exercise as "Submitted" (same as MCQ does)
      const lastQ = questions[questions.length - 1];
      if (lastQ) {
        const fd = new FormData();
        fd.append('courseId', courseId);
        fd.append('exerciseId', exerciseId);
        fd.append('questionId', lastQ._id);
        fd.append('category', category);
        fd.append('subcategory', subcategory);
        fd.append('nodeId', nodeId);
        fd.append('nodeName', nodeName || exerciseName);
        fd.append('nodeType', nodeType || 'others_notion');
        fd.append('language', 'text');
        fd.append('code', '');
        fd.append('score', '0');
        fd.append('status', 'submitted');
        fd.append('isTestSubmission', 'true');
        await fetch('http://localhost:5533/courses/answers/submit', {
          method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd,
        });
      }

      setSubmitted(true);
      // Hand the toast to the list page so it shows reliably after the redirect.
      try {
        sessionStorage.setItem('lms_submit_toast', opts?.auto
          ? `Time's up! "${exerciseName}" submitted successfully.`
          : `"${exerciseName}" submitted successfully`);
      } catch { /* ignore */ }
      setTimeout(() => onClose(), 600);
    } catch (e: any) {
      setSubmitError(e.message || 'Submission failed. Please try again.');
      if (opts?.auto) toast.error('Auto-submit failed. Please submit manually.');
    } finally { setIsSubmitting(false); }
  };

  // ── Submitted ──────────────────────────────────────────────────────────────

  if (submitted) {
    return (
      <div className="oe-root" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f9fafb' }}>
        <div style={{ textAlign: 'center', padding: 40 }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <CheckCircle2 style={{ width: 32, height: 32, color: '#16a34a' }} />
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: '#111827', margin: '0 0 8px' }}>Submitted Successfully</h2>
          <p style={{ fontSize: 14, color: '#6b7280', margin: '0 0 4px' }}>Your responses have been saved.</p>
          <p style={{ fontSize: 13, color: '#9ca3af', margin: '0 0 20px' }}>
            {answeredCount} of {questions.length} question{questions.length !== 1 ? 's' : ''} answered
          </p>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: '#6b7280', fontSize: 13, fontWeight: 600 }}>
            <Loader2 style={{ width: 15, height: 15 }} className="animate-spin" />
            Returning to your exercises…
          </div>
        </div>
      </div>
    );
  }

  if (!currentQuestion) return null;

  const isLast = currentIndex === questions.length - 1;
  const currentAns = answers[currentQuestion._id];
  const diffColors: Record<string, { color: string; bg: string }> = {
    easy: { color: '#16a34a', bg: '#f0fdf4' },
    medium: { color: '#d97706', bg: '#fffbeb' },
    hard: { color: '#e53e3e', bg: '#fff5f5' },
  };
  const diff = currentQuestion.difficulty?.toLowerCase() || '';
  const dc = diffColors[diff];

  return (
    <div className="oe-root" style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#fff', overflow: 'hidden' }}>

      {/* ── FIXED TOP BAR ── */}

      {/* ── FIXED TOP BAR ── */}
{/* ── FIXED TOP BAR ── */}
<div style={{ 
  flexShrink: 0, 
  borderBottom: '1px solid #f0f0f0', 
  background: '#fff', 
  padding: '0 24px', 
  height: 56, 
  display: 'flex', 
  alignItems: 'center', 
  gap: 12 
}}>
  
  {/* Breadcrumb navigation - matching MCQ style */}
  <nav style={{ 
    display: 'flex', 
    alignItems: 'center', 
    gap: 0, 
    minWidth: 0, 
    overflow: 'hidden', 
    flex: 1 
  }}>
    {[
      { label: courseName !== 'Course' && courseName ? courseName : null },
      // Node hierarchy (e.g. Module → Topic) passed from the course view
      ...hierarchy.map(seg => ({ label: seg })),
      { label: category && category !== 'Course'
          ? (category === 'We_Do' ? 'We Do' : category === 'I_Do' ? 'I Do' : category === 'You_Do' ? 'You Do' : category.replace(/_/g, ' '))
          : null },
      { label: exerciseName, active: true }
    ].filter(b => b.label).map((b, i, arr) => (
      <React.Fragment key={i}>
        <span style={{
          fontSize: 12,
          fontWeight: b.active ? 700 : 500,
          color: b.active ? '#f97316' : '#6b7280',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          maxWidth: b.active ? 200 : 110
        }}>
          {b.label}
        </span>
        {i < arr.length - 1 && (
          <ChevronRight size={12} style={{ color: '#e5e7eb', margin: '0 5px', flexShrink: 0 }} />
        )}
      </React.Fragment>
    ))}
  </nav>

  {/* Exercise Info / Score Overview buttons */}
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginRight: 4 }}>
    <ExerciseInfoButtons
      onDetailsClick={() => setShowDetailsModal(true)}
      onOverviewClick={() => setShowOverviewModal(true)}
      isGraded={isGraded}
      detailsActive={showDetailsModal}
      overviewActive={showOverviewModal}
    />
  </div>

  <div style={{ width: 1, height: 18, background: '#e5e7eb', flexShrink: 0 }} />

  {/* Right side - Timer and Progress */}
  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
    
    {/* Timer Display */}
    {totalDuration > 0 && (
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: 7, 
        padding: '5px 11px', 
        borderRadius: 99, 
        background: timeLeft < 60 ? '#fef2f2' : timeLeft < 300 ? '#fffbeb' : '#fff7ed',
        border: `1.5px solid ${timeLeft < 60 ? '#ef4444' : timeLeft < 300 ? '#f59e0b' : '#f97316'}28`,
        animation: timeLeft < 60 ? 'pulse 1s ease-in-out infinite' : 'none'
      }}>
        <Timer size={12} style={{ 
          color: timeLeft < 60 ? '#ef4444' : timeLeft < 300 ? '#f59e0b' : '#f97316'
        }} />
        <span style={{ 
          fontFamily: 'monospace', 
          fontWeight: 800, 
          fontSize: 13, 
          color: timeLeft < 60 ? '#ef4444' : timeLeft < 300 ? '#f59e0b' : '#f97316',
          letterSpacing: '0.04em'
        }}>
          {formatTime(timeLeft)}
        </span>
        <div style={{ 
          width: 36, 
          height: 3, 
          borderRadius: 99, 
          background: `${timeLeft < 60 ? '#ef4444' : timeLeft < 300 ? '#f59e0b' : '#f97316'}22`,
          overflow: 'hidden'
        }}>
          <div style={{ 
            height: '100%', 
            width: `${totalDuration > 0 ? Math.max(0, (timeLeft / (totalDuration * 60)) * 100) : 0}%`,
            background: timeLeft < 60 ? '#ef4444' : timeLeft < 300 ? '#f59e0b' : '#f97316',
            borderRadius: 99,
            transition: 'width 1s linear'
          }} />
        </div>
      </div>
    )}

    <div style={{ width: 1, height: 18, background: '#e5e7eb' }} />

    {/* Progress indicators */}
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#6b7280' }}>{questions.length}</span>
        <span style={{ fontSize: 11, color: '#9ca3af', fontWeight: 500 }}>Total</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#16a34a' }}>{answeredCount}</span>
        <span style={{ fontSize: 11, color: '#9ca3af', fontWeight: 500 }}>Done</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#9ca3af' }}>{questions.length - answeredCount}</span>
        <span style={{ fontSize: 11, color: '#9ca3af', fontWeight: 500 }}>Left</span>
      </div>
    </div>
  </div>
</div>
      {/* ── BODY — resizable split panel ────────────────────────────────────── */}
      <div ref={containerRef} style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* LEFT — question panel */}
        <div className="oe-scroll" style={{ width: `${leftPct}%`, flexShrink: 0, overflowY: 'auto', padding: '32px 28px' }}>

          {/* Question number + badges */}
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
            <span style={{
              width: 28, height: 28, borderRadius: 7, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, fontWeight: 800,
              background: isAnswered(currentQuestion) ? '#dcfce7' : '#fff7ed',
              color: isAnswered(currentQuestion) ? '#16a34a' : '#f97316',
              border: `1.5px solid ${isAnswered(currentQuestion) ? '#bbf7d0' : '#fed7aa'}`,
            }}>
              {isAnswered(currentQuestion) ? '✓' : currentIndex + 1}
            </span>
            <span style={{
              fontSize: 10.5, fontWeight: 700, padding: '3px 9px', borderRadius: 20, textTransform: 'uppercase', letterSpacing: '0.04em',
              background: currentQuestion.othersQuestionType === 'notion' ? '#f5f3ff' : '#f0fdf4',
              color: currentQuestion.othersQuestionType === 'notion' ? '#7c3aed' : '#16a34a',
            }}>
              {currentQuestion.othersQuestionType === 'notion' ? 'Written Response' : 'File Upload'}
            </span>
            {dc && (
              <span style={{ fontSize: 10.5, fontWeight: 700, padding: '3px 9px', borderRadius: 20, background: dc.bg, color: dc.color, textTransform: 'capitalize' }}>
                {diff}
              </span>
            )}
            {currentQuestion.isRequired && (
              <span style={{ fontSize: 11, fontWeight: 700, color: '#ef4444' }}>* Required</span>
            )}
            {currentQuestion.score != null && currentQuestion.score > 0 && (
              <span style={{ fontSize: 12, fontWeight: 700, color: '#f97316' }}>
                {currentQuestion.score} marks
              </span>
            )}
          </div>

          {/* Title */}
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#111827', margin: '0 0 12px', lineHeight: 1.5 }}>
            {currentQuestion.title}
          </h2>

          {/* ── Question content blocks (text + image) ── */}
          {currentQuestion.questionContent && currentQuestion.questionContent.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 6 }}>
              {currentQuestion.questionContent.map((cb, i) => {
                if (cb.type === 'text' && cb.value) {
                  return (
                    <div key={cb.id || i}
                      style={{ fontSize: 14, color: '#4b5563', lineHeight: 1.75 }}
                      dangerouslySetInnerHTML={{ __html: cb.value }}
                    />
                  );
                }
                if (cb.type === 'image' && cb.url) {
                  const justify = cb.alignment === 'left' ? 'flex-start' : cb.alignment === 'right' ? 'flex-end' : 'center';
                  const sizePct = typeof cb.sizePercent === 'number' ? cb.sizePercent : 60;
                  return (
                    <div key={cb.id || i} style={{ display: 'flex', justifyContent: justify }}>
                      <img src={cb.url} alt=""
                        style={{
                          width: `${sizePct}%`, height: 'auto',
                          borderRadius: 8, border: '1.5px solid #e5e7eb', display: 'block',
                        }}
                      />
                    </div>
                  );
                }
                return null;
              })}
            </div>
          ) : (
            /* Fallback: legacy description + image fields */
            <>
              {currentQuestion.description && (
                <DescriptionBlock description={currentQuestion.description} />
              )}
              {currentQuestion.descriptionImageUrl && (
                <div style={{
                  display: 'flex',
                  justifyContent: currentQuestion.descriptionImageAlignment === 'left' ? 'flex-start'
                    : currentQuestion.descriptionImageAlignment === 'right' ? 'flex-end' : 'center',
                  marginTop: 12,
                }}>
                  <img src={currentQuestion.descriptionImageUrl} alt=""
                    style={{
                      width: `${currentQuestion.descriptionImageSizePercent || 60}%`,
                      height: 'auto', borderRadius: 8, border: '1.5px solid #e5e7eb', display: 'block',
                    }}
                  />
                </div>
              )}
            </>
          )}

          {/* ── Teacher attachments shown below image/content ── */}
          {(() => {
            const merged = [
              ...(currentQuestion.attachments || []),
              ...((currentQuestion as any).othersDescription?.attachments || []),
            ].filter((a, i, arr) => arr.findIndex(x => x.url === a.url) === i);
            return merged.length > 0 ? <QuestionAttachments attachments={merged} /> : null;
          })()}

          {/* Submit error */}
          {submitError && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 20, padding: '10px 14px', borderRadius: 8, background: '#fef2f2', border: '1px solid #fecaca', fontSize: 13, color: '#dc2626' }}>
              <AlertCircle style={{ width: 14, height: 14, flexShrink: 0 }} />{submitError}
            </div>
          )}

          {/* Question dot navigator */}
          {/* {questions.length > 1 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 32 }}>
              {questions.map((q, i) => (
                <button key={q._id} onClick={() => setCurrentIndex(i)}
                  className={`oe-q-dot${i === currentIndex ? ' active' : ''}${isAnswered(q) ? ' answered' : ''}`}>
                  {i + 1}
                </button>
              ))}
            </div>
          )} */}
        </div>

        {/* ── RESIZER ── */}
        <div
          className="oe-resizer"
          onMouseDown={handleResizerMouseDown}
          style={{
            width: 5, flexShrink: 0, cursor: 'col-resize', position: 'relative',
            background: 'transparent', zIndex: 10,
          }}
        >
          <div className="oe-resizer-line" style={{
            position: 'absolute', inset: 0,
            borderLeft: '1px solid #e5e7eb',
            transition: 'border-color 0.15s',
          }} />
          <div className="oe-resizer-handle" style={{
            position: 'absolute', top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 4, height: 32, borderRadius: 99,
            background: '#d1d5db',
            transition: 'background 0.15s, height 0.15s',
            pointerEvents: 'none',
          }} />
          {/* Wider invisible hit-zone */}
          <div style={{ position: 'absolute', inset: '0 -4px', cursor: 'col-resize' }} onMouseDown={handleResizerMouseDown} />
        </div>

        {/* RIGHT — Answer panel */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#fafafa' }}>

          {/* "Your Answer" label strip */}
          <div style={{ flexShrink: 0, padding: '12px 20px', borderBottom: '1px solid #f0f0f0', background: '#fff' }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.07em', margin: 0 }}>
              Your Answer
            </p>
          </div>

          {/* Answer content */}
          {currentQuestion.othersQuestionType === 'notion' ? (
            /* Notion editor fills remaining height */
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <OthersNotionEditor
                notionSettings={currentQuestion.notionSettings}
                initialPages={currentAns?.type === 'notion' && currentAns.notionPages?.length ? currentAns.notionPages : undefined}
                onChange={pages => setNotionPages(currentQuestion._id, pages)}
                disabled={isSubmitting}
              />
            </div>
          ) : (
            /* File upload — scrollable */
            <div className="oe-scroll" style={{ flex: 1, overflowY: 'auto', padding: '28px 24px' }}>
              <FileUploadAnswerArea
                settings={currentQuestion.fileUploadSettings || {}}
                files={currentAns?.type === 'file-upload' ? (currentAns.files || []) : []}
                onFilesChange={files => setFileAnswer(currentQuestion._id, files)}
                disabled={isSubmitting}
                questionId={currentQuestion._id}
              />
            </div>
          )}
        </div>
      </div>

      {/* ── FIXED BOTTOM NAV ── */}
      <div style={{
        flexShrink: 0, borderTop: '1px solid #f0f0f0', background: '#fff',
        padding: '12px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
      }}>
        <button
          className="oe-nav-btn"
          onClick={() => setCurrentIndex(i => Math.max(0, i - 1))}
          disabled={currentIndex === 0}>
          <ChevronLeft style={{ width: 15, height: 15 }} /> Previous
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Submit visible on last question or when all answered */}
          {(isLast || answeredCount === questions.length) && (
            <button className="oe-submit-btn" onClick={() => handleSubmit()}
              disabled={isSubmitting || answeredCount === 0}>
              {isSubmitting
                ? <><Loader2 style={{ width: 14, height: 14 }} className="animate-spin" />Submitting…</>
                : 'Submit Exercise'}
            </button>
          )}

          {!isLast && (
            <button
              className="oe-nav-btn"
              onClick={() => setCurrentIndex(i => Math.min(questions.length - 1, i + 1))}
              style={{ background: '#f97316', borderColor: '#f97316', color: '#fff' }}>
              Next <ChevronRight style={{ width: 15, height: 15 }} />
            </button>
          )}
        </div>
      </div>

      {/* ── Exercise Info / Score Overview modals ── */}
      <ExerciseInfoModals
        exercise={infoExercise}
        showDetailsModal={showDetailsModal}
        setShowDetailsModal={setShowDetailsModal}
        showOverviewModal={showOverviewModal}
        setShowOverviewModal={setShowOverviewModal}
        solvedQuestions={solvedQuestions}
      />
    </div>
  );
};

export default OthersExam;
