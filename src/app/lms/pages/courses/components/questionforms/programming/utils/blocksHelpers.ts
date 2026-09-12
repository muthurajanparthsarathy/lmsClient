// Content-block helpers for the Programming question editor.
// Extracted 2026-08-30 from ProgrammingQuestionForm.tsx.
//
// The DB stores `description` in a compatibility shape:
//   { contentBlocks: ProgContentBlock[], text: string, imageUrl, imageAlignment, imageSizePercent }
// The editor works on the pure ProgContentBlock[] array; these helpers
// convert between the two forms and handle every legacy variant the DB has
// been observed to carry.

import type { ProgContentBlock } from '../types';

export const mkProgTextBlock = (id?: string): ProgContentBlock => ({
  id: id || `pb-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  type: 'text',
  value: '',
});

export const mkProgCodeBlock = (id?: string): ProgContentBlock => ({
  id: id || `pb-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  type: 'code',
  value: '',
  language: 'python',
  bgColor: '#f5f5f5',
});

export const descToBlocks = (description: any): ProgContentBlock[] => {
  if (!description) return [mkProgTextBlock()];

  const mkId = () =>
    `pb-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  const normalizeBlock = (b: any): ProgContentBlock => ({
    ...b,
    id: b.id || mkId(),
  });

  // 1. Pure array — ideal case (description IS the blocks array)
  if (Array.isArray(description) && description.length > 0) {
    return description.map(normalizeBlock);
  }

  // 2. contentBlocks array — standard stored shape
  if (
    description.contentBlocks &&
    Array.isArray(description.contentBlocks) &&
    description.contentBlocks.length > 0
  ) {
    return description.contentBlocks.map(normalizeBlock);
  }

  // 3. text is an array of blocks — the bug shape already in DB
  if (Array.isArray(description.text) && description.text.length > 0) {
    return description.text.map(normalizeBlock);
  }

  // 4. Legacy: text is a plain string + optional imageUrl
  const blocks: ProgContentBlock[] = [];
  const textVal =
    typeof description === 'string'
      ? description
      : typeof description.text === 'string'
        ? description.text
        : '';
  if (textVal.trim()) {
    blocks.push({ id: mkId(), type: 'text', value: textVal });
  }
  if (description.imageUrl) {
    blocks.push({
      id: `pb-img-${mkId()}`,
      type: 'image',
      url: description.imageUrl,
      alignment: description.imageAlignment || 'center',
      sizePercent: description.imageSizePercent || 60,
    });
  }
  return blocks.length > 0 ? blocks : [mkProgTextBlock()];
};

export const blocksToDescription = (blocks: ProgContentBlock[]): any => {
  const textParts = blocks
    .filter(b => b.type === 'text')
    .map(b => (b as any).value)
    .join('\n')
    .trim();
  const imgBlock = blocks.find(b => b.type === 'image') as any;
  return {
    contentBlocks: blocks,          // ← always store full blocks here
    text: textParts,                // ← always a plain string, never array
    imageUrl: imgBlock?.url || null,
    imageAlignment: imgBlock?.alignment || 'left',
    imageSizePercent: imgBlock?.sizePercent || 100,
  };
};

// ─── Title blocks helpers ─────────────────────────────────────────────────────
export const titleToBlocks = (title: any): ProgContentBlock[] => {
  if (Array.isArray(title) && title.length > 0) {
    return title.map((b: any) => ({ ...b, id: b.id || `tb-${Date.now()}-${Math.random().toString(36).slice(2, 7)}` }));
  }
  if (typeof title === 'string' && title) {
    return [{ id: `tb-${Date.now()}`, type: 'text', value: title }];
  }
  return [mkProgTextBlock()];
};

export const getTitleText = (blocks: ProgContentBlock[]): string => {
  const raw = blocks.filter(b => b.type === 'text').map(b => (b as any).value).join(' ').trim();
  return raw.replace(/<[^>]*>/g, '').trim();
};

export const fmtMark = (n: number): string => parseFloat(n.toFixed(2)).toString();
