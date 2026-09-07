// ─────────────────────────────────────────────────────────────────────────────
// Client-side "document -> plain text" for the Add Question via -> Document flows.
//
// Trainers hand us the assessment paper they already wrote (.docx / .pdf) or a
// plain .txt. Every parser downstream (parseQuestionsTxt.ts) reads line-structured
// text - "Input:" on one line, the literal on the next - so extraction MUST
// preserve line breaks. That rules out the server's /api/extract-doc endpoints:
// they collapse every whitespace run (newlines included) into a single space,
// which is fine for a summary but destroys the structure a parser needs.
//
//   .docx -> a zip of XML; one <w:p> is one paragraph -> one line. JSZip is
//            imported lazily so the inflater only loads for trainers who
//            actually import a document.
//   .pdf  -> pdf.js text items carry no line breaks, so lines are rebuilt by
//            grouping items on a shared baseline (Y) and ordering them by X.
//            pdf.js comes from the same CDN build the PDF viewers already use.
// ─────────────────────────────────────────────────────────────────────────────

/** `accept` for the hidden file inputs behind every "Upload via Document" button. */
export const DOC_ACCEPT =
  '.txt,.docx,.pdf,text/plain,application/pdf,' +
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

/** Human-readable list of what those inputs take - keep UI copy in sync with DOC_ACCEPT. */
export const DOC_ACCEPT_LABEL = '.txt, .docx or .pdf';

// pdf.js build already used by pdfView.tsx / pdf-viewer.tsx - same version so
// the browser serves one cached copy for all three.
const PDFJS_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174';

// ─── Shared cleanup ──────────────────────────────────────────────────────────

// Soft hyphen, zero-width space/non-joiner/joiner, BOM, non-breaking space.
const INVISIBLES = /[­​‌‍﻿]/g;
const NBSP = / /g;

/**
 * Word and PDF both smuggle these through copy-paste, and they silently break
 * literal matching - a "nums" carrying a soft hyphen is not the "nums" the
 * argument splitter looks for.
 */
const stripInvisibles = (s: string): string => s.replace(INVISIBLES, '').replace(NBSP, ' ');

// Word draws list bullets with the Symbol / Wingdings fonts, and pdf.js reports
// those as the private-use codepoints the font maps them to rather than the
// character they look like. Fold the common ones back to a real bullet so the
// question parser can recognise (and strip) them like any other list marker.
const PUA_BULLETS = /[]/g;
const BULLET = String.fromCharCode(0x2022); // U+2022, the bullet the parser strips
const foldPuaBullets = (s: string): string => s.replace(PUA_BULLETS, BULLET);

// ─── DOCX ────────────────────────────────────────────────────────────────────

const XML_ENTITIES: Record<string, string> = {
  lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
};

const decodeXmlEntities = (s: string): string =>
  s
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&(lt|gt|quot|apos|nbsp);/g, (_, n) => XML_ENTITIES[n])
    // &amp; last so "&amp;lt;" decodes to "&lt;" and not to "<".
    .replace(/&amp;/g, '&');

/**
 * WordprocessingML -> plain text, one line per paragraph.
 *
 * The `(?:\s[^>]*)?` guards matter: without them `<w:t` also matches the
 * `<w:tabs>` element inside a paragraph's properties, and the lazy scan to the
 * next `</w:t>` swallows a screenful of raw XML into the text.
 */
export function docxXmlToText(xml: string): string {
  const lines: string[] = [];
  const paraRe = /<w:p(?:\s[^>]*)?>([\s\S]*?)<\/w:p>|<w:p\s*\/>/g;

  let para: RegExpExecArray | null;
  while ((para = paraRe.exec(xml)) !== null) {
    // Drop the properties blocks - they hold no text but do hold look-alike tags.
    const body = (para[1] || '').replace(
      /<w:(?:pPr|rPr|sectPr)(?:\s[^>]*)?>[\s\S]*?<\/w:(?:pPr|rPr|sectPr)>/g,
      '',
    );

    let text = '';
    const runRe = /<w:tab\s*\/>|<w:br(?:\s[^>]*)?\/?>|<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g;
    let run: RegExpExecArray | null;
    while ((run = runRe.exec(body)) !== null) {
      if (run[1] !== undefined) text += decodeXmlEntities(run[1]);
      else if (run[0].startsWith('<w:tab')) text += '\t';
      else text += '\n'; // <w:br/> - a hard line break inside the paragraph
    }

    lines.push(stripInvisibles(text).trimEnd());
  }

  return lines.join('\n');
}

/** True for the OOXML zip container (`PK\x03\x04`). */
const isZip = (buf: ArrayBuffer): boolean => {
  const b = new Uint8Array(buf, 0, Math.min(4, buf.byteLength));
  return b.length === 4 && b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04;
};

async function extractDocxText(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  if (!isZip(buf)) {
    // Legacy binary .doc (or a mislabelled file) - no client-side reader.
    throw new Error('This looks like an old binary .doc. Re-save it as .docx (Word -> Save As -> .docx) and upload again.');
  }
  const { default: JSZip } = await import('jszip');
  const zip = await JSZip.loadAsync(buf);

  // document.xml is the body; headers/footers are ignored on purpose (page
  // furniture would only pollute the parsed questions).
  const entry = zip.file('word/document.xml');
  if (!entry) throw new Error('That .docx has no readable document body.');

  return docxXmlToText(await entry.async('string'));
}

// ─── PDF ─────────────────────────────────────────────────────────────────────

// Only the slice of the pdf.js surface this file touches. The CDN build ships
// no types, and pulling the pdfjs-dist package in just for them would double
// the bytes for a reader that already loads from the same CDN as the viewers.
interface PdfTextItem { str?: unknown; transform?: number[]; width?: number }
interface PdfPage { getTextContent(): Promise<{ items: PdfTextItem[] }> }
interface PdfDocument { numPages: number; getPage(n: number): Promise<PdfPage> }
interface PdfJsLib {
  GlobalWorkerOptions: { workerSrc: string };
  getDocument(src: { data: Uint8Array }): { promise: Promise<PdfDocument> };
}

const pdfjsGlobal = (): PdfJsLib | undefined =>
  typeof window === 'undefined' ? undefined : (window as unknown as { pdfjsLib?: PdfJsLib }).pdfjsLib;

let pdfjsLoader: Promise<PdfJsLib> | null = null;

/** Load pdf.js from the CDN once per page, exactly as the PDF viewers do. */
function loadPdfJs(): Promise<PdfJsLib> {
  const ready = pdfjsGlobal();
  if (ready) return Promise.resolve(ready);
  if (pdfjsLoader) return pdfjsLoader;

  pdfjsLoader = new Promise<PdfJsLib>((resolve, reject) => {
    const s = document.createElement('script');
    s.src = `${PDFJS_CDN}/pdf.min.js`;
    s.onload = () => {
      const lib = pdfjsGlobal();
      if (!lib) { reject(new Error('pdf.js failed to initialise.')); return; }
      lib.GlobalWorkerOptions.workerSrc = `${PDFJS_CDN}/pdf.worker.min.js`;
      resolve(lib);
    };
    s.onerror = () => reject(new Error('Could not load the PDF reader (pdf.js CDN unavailable). Upload the .docx instead.'));
    document.head.appendChild(s);
  }).catch(err => { pdfjsLoader = null; throw err; });

  return pdfjsLoader;
}

interface PdfPiece { x: number; end: number; s: string }
interface PdfRow { y: number; pieces: PdfPiece[] }

/**
 * pdf.js text items -> visual lines. Items sharing a baseline are one line; a
 * space is inserted where the glyph runs leave a horizontal gap, and a blank
 * line where the vertical gap is clearly bigger than the body leading, so the
 * paper's paragraph breaks survive into the parser.
 */
function pdfRowsToLines(rows: PdfRow[]): string[] {
  rows.sort((a, b) => b.y - a.y); // PDF Y grows upward

  const gaps = rows.slice(1).map((r, i) => rows[i].y - r.y).filter(g => g > 0).sort((a, b) => a - b);
  const medianGap = gaps.length ? gaps[Math.floor(gaps.length / 2)] : 0;

  const out: string[] = [];
  rows.forEach((row, i) => {
    if (i > 0 && medianGap > 0 && rows[i - 1].y - row.y > medianGap * 1.6) out.push('');

    row.pieces.sort((a, b) => a.x - b.x);
    let line = '';
    let prevEnd: number | null = null;
    for (const p of row.pieces) {
      if (prevEnd !== null && p.x - prevEnd > 1 && !/\s$/.test(line) && !/^\s/.test(p.s)) line += ' ';
      line += p.s;
      prevEnd = p.end;
    }
    out.push(foldPuaBullets(stripInvisibles(line)).replace(/[ \t]+/g, ' ').trim());
  });

  return out;
}

async function extractPdfText(file: File): Promise<string> {
  const lib = await loadPdfJs();
  const data = new Uint8Array(await file.arrayBuffer());
  const doc = await lib.getDocument({ data }).promise;

  const pages: string[] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);
    const content = await page.getTextContent();

    const rows: PdfRow[] = [];
    for (const item of content.items) {
      const s = typeof item?.str === 'string' ? item.str : '';
      if (!s.trim()) continue;
      const x = Number(item.transform?.[4]) || 0;
      const y = Number(item.transform?.[5]) || 0;
      // 2.5pt of baseline slack absorbs sub/superscripts and rounding.
      let row = rows.find(r => Math.abs(r.y - y) <= 2.5);
      if (!row) { row = { y, pieces: [] }; rows.push(row); }
      row.pieces.push({ x, end: x + (Number(item.width) || 0), s });
    }

    pages.push(pdfRowsToLines(rows).join('\n'));
  }

  const text = pages.join('\n');
  if (!text.replace(/\s/g, '')) {
    throw new Error('No text found in that PDF - it looks like a scan. Upload the .docx (or a text-based PDF) instead.');
  }
  return text;
}

// ─── Entry point ─────────────────────────────────────────────────────────────

/**
 * Read an uploaded question document as plain text with its line structure
 * intact. Supports .txt (and any text/* file), .docx and .pdf.
 */
export async function extractDocumentText(file: File): Promise<string> {
  const name = (file.name || '').toLowerCase();
  const type = (file.type || '').toLowerCase();

  if (name.endsWith('.docx') || type.includes('wordprocessingml')) return extractDocxText(file);
  if (name.endsWith('.pdf') || type === 'application/pdf') return extractPdfText(file);
  if (name.endsWith('.doc') || type === 'application/msword') {
    throw new Error('Old binary .doc files are not supported. Re-save as .docx and upload again.');
  }
  if (name.endsWith('.txt') || name.endsWith('.md') || name.endsWith('.csv') || type.startsWith('text/') || !type) {
    return (await file.text()).replace(/\r\n?/g, '\n');
  }
  throw new Error(`Unsupported file type - upload a ${DOC_ACCEPT_LABEL} file.`);
}
