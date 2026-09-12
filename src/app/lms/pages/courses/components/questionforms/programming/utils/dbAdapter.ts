// DB question → FlowQuestion adapter for the Programming authoring form.
// Extracted 2026-08-30 from ProgrammingQuestionForm.tsx.
//
// `dbQuestionToFlow` normalises every historical DB shape the form has seen
// (three different `description` layouts, missing execution-setup fields on
// pre-Execution-Setup questions, string vs array titles, etc.) into a single
// clean `FlowQuestion` the form's state machine can consume.

import type { FlowQuestion, ProgContentBlock } from '../types';
import { mkProgTextBlock } from './blocksHelpers';
import { mkLocalId } from './factories';
import { mkFunctionContract } from './execHelpers';

export const dbQuestionToFlow = (q: any): FlowQuestion => {
  // Normalize description into clean ProgContentBlock[] array
  const normalizeDescription = (desc: any): ProgContentBlock[] => {
    const mkId = () => `pb-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const normalizeBlock = (b: any): ProgContentBlock => ({ ...b, id: b.id || mkId() });

    if (!desc) return [mkProgTextBlock()];

    // Pure array
    if (Array.isArray(desc) && desc.length > 0) return desc.map(normalizeBlock);

    // contentBlocks array
    if (desc.contentBlocks && Array.isArray(desc.contentBlocks) && desc.contentBlocks.length > 0)
      return desc.contentBlocks.map(normalizeBlock);

    // text is array of blocks (bug shape in DB)
    if (Array.isArray(desc.text) && desc.text.length > 0)
      return desc.text.map(normalizeBlock);

    // Legacy: plain string + optional imageUrl
    const blocks: ProgContentBlock[] = [];
    const textVal = typeof desc === 'string' ? desc : (typeof desc.text === 'string' ? desc.text : '');
    if (textVal.trim()) blocks.push({ id: mkId(), type: 'text', value: textVal });
    if (desc.imageUrl) blocks.push({
      id: `pb-img-${mkId()}`,
      type: 'image',
      url: desc.imageUrl,
      alignment: desc.imageAlignment || 'center',
      sizePercent: desc.imageSizePercent || 60,
    });
    return blocks.length > 0 ? blocks : [mkProgTextBlock()];
  };

  return {
    __localId: q._id ? `db-${q._id}` : mkLocalId(),
    _id: q._id,
    title: Array.isArray(q.title)
      ? (q.title as any[]).filter((b: any) => b.type === 'text').map((b: any) => b.value).join(' ').trim()
      : (q.title || ''),
    description: normalizeDescription(q.description), // ← always a clean ProgContentBlock[]
    difficulty: q.difficulty || 'medium',
    score: q.score || q.points || 0,
    testCases: q.testCases || [],
    constraints: q.constraints || [],
    hints: q.hints || [],
    timeLimit: q.timeLimit || 2000,
    memoryLimit: q.memoryLimit || 256,
    questionType: 'programming',
    isSaved: true,
    isDirty: false,
    isPreExisting: true,
    isLinkQuestion: q.isLinkQuestion === true,
    questionLink: q.questionLink || '',
    starterCode: typeof q.starterCode === 'string' ? q.starterCode : '',
    solutionCode: typeof q.solutionCode === 'string' ? q.solutionCode : '',
    codeSetupLanguage: typeof q.codeSetupLanguage === 'string' ? q.codeSetupLanguage : undefined,
    // ── Execution setup — backward-compat: legacy questions default to fullProgram ──
    executionType: (q.executionType === 'function' || q.executionType === 'fullProgram')
      ? q.executionType
      : 'fullProgram',
    functionContract: q.functionContract && typeof q.functionContract === 'object'
      ? {
          functionName: typeof q.functionContract.functionName === 'string' ? q.functionContract.functionName : '',
          returnType: typeof q.functionContract.returnType === 'string' ? q.functionContract.returnType : 'integer',
          params: Array.isArray(q.functionContract.params)
            ? q.functionContract.params.map((p: any, i: number) => ({
                id: p?.id || `fp-${Date.now()}-${i}-${Math.random().toString(36).slice(2,5)}`,
                name: typeof p?.name === 'string' ? p.name : `p${i+1}`,
                type: typeof p?.type === 'string' ? p.type : 'integer',
              }))
            : [],
        }
      : mkFunctionContract(),
    startingExperience: (q.startingExperience === 'blank' || q.startingExperience === 'generated' || q.startingExperience === 'custom')
      ? q.startingExperience
      : (q.executionType === 'function' ? 'generated' : 'blank'),
  };
};
