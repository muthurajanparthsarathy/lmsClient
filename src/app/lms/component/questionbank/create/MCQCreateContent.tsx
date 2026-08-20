'use client';

/**
 * MCQ question authoring — content area of the Create Question modal.
 * Field structure and validation mirror the bank create contract
 * (POST /create/question-bank, MCQ branch): all 9 mcq sub-types with
 * their per-type answer editors, explanation toggle, options-per-row
 * and required flag. Payload is JSON (image uploads stay on the classic
 * bank-page modal for now).
 */

import React, { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { Plus, Trash2, GripVertical, ImagePlus, X } from 'lucide-react';
import {
  SectionCard, Label, ChipInput, DifficultySegmented, ProblemTypePicker,
  RichTextLite, FieldError, inputCls, textareaCls, plainTextOf,
  type DiffValue,
} from './createShared';
import type { CreateContentHandle } from './ProgrammingCreateContent';

type McqType =
  | 'multiple_choice' | 'multiple_select' | 'dropdown' | 'true_false'
  | 'short_answer' | 'essay' | 'matching' | 'ordering' | 'numeric';

const MCQ_TYPES: { key: McqType; label: string }[] = [
  { key: 'multiple_choice', label: 'Multiple Choice' },
  { key: 'multiple_select', label: 'Multiple Select' },
  { key: 'dropdown', label: 'Dropdown' },
  { key: 'true_false', label: 'True / False' },
  { key: 'short_answer', label: 'Short Answer' },
  { key: 'essay', label: 'Essay / Paragraph' },
  { key: 'matching', label: 'Matching' },
  { key: 'ordering', label: 'Ordering' },
  { key: 'numeric', label: 'Numeric' },
];

const CHOICE_TYPES: McqType[] = ['multiple_choice', 'multiple_select', 'dropdown'];

interface OptDraft { id: number; text: string; isCorrect: boolean; imageFile?: File | null; imagePreview?: string }
interface PairDraft { id: number; left: string; right: string }
interface OrderDraft { id: number; text: string }

let seq = 1;
const nid = () => seq++;

const MCQCreateContent = forwardRef<CreateContentHandle, object>((_props, ref) => {
  const [mcqType, setMcqType] = useState<McqType>('multiple_choice');
  const [titleHtml, setTitleHtml] = useState('');
  // Ref mirrors titleHtml — read at submit time so we don't lose a keystroke
  // when the user types then immediately clicks Create before React has
  // flushed the state update (produced the "MCQ question title text is
  // required" server error on every fast create).
  const titleHtmlRef = useRef('');
  const [options, setOptions] = useState<OptDraft[]>([
    { id: nid(), text: '', isCorrect: false },
    { id: nid(), text: '', isCorrect: false },
  ]);
  const [trueFalseAnswer, setTrueFalseAnswer] = useState<boolean | null>(null);
  const [shortAnswer, setShortAnswer] = useState('');
  const [essayAnswer, setEssayAnswer] = useState('');
  const [pairs, setPairs] = useState<PairDraft[]>([
    { id: nid(), left: '', right: '' },
    { id: nid(), left: '', right: '' },
  ]);
  const [orderItems, setOrderItems] = useState<OrderDraft[]>([
    { id: nid(), text: '' },
    { id: nid(), text: '' },
  ]);
  const [numericAnswer, setNumericAnswer] = useState('');
  const [numericTolerance, setNumericTolerance] = useState('');
  const [hasExplanation, setHasExplanation] = useState(false);
  const [explanation, setExplanation] = useState('');
  const [optionsPerRow, setOptionsPerRow] = useState(1);
  const [isRequired, setIsRequired] = useState(false);
  const [hasOtherOption, setHasOtherOption] = useState(false);
  const [marks, setMarks] = useState('');
  const [difficulty, setDifficulty] = useState<DiffValue>('easy');
  const [problemType, setProblemType] = useState<string | null>(null);
  const [topics, setTopics] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [errs, setErrs] = useState<Record<string, string>>({});

  const isChoice = CHOICE_TYPES.includes(mcqType);
  const singleCorrect = mcqType === 'multiple_choice' || mcqType === 'dropdown';

  const toggleCorrect = (id: number) =>
    setOptions(p => p.map(o => ({
      ...o,
      isCorrect: o.id === id ? !o.isCorrect : (singleCorrect ? false : o.isCorrect),
    })));

  const attachOptionImage = (id: number, file: File | null) => {
    if (!file) return;
    const preview = URL.createObjectURL(file);
    setOptions(p => p.map(o => (o.id === id ? { ...o, imageFile: file, imagePreview: preview } : o)));
  };

  useImperativeHandle(ref, () => ({
    submit: () => {
      const e: Record<string, string> = {};
      // Prefer the DOM-mirroring ref over the React state so a keystroke
      // typed just before the click isn't lost to React's async render.
      const currentTitleHtml = titleHtmlRef.current || titleHtml;
      const titleText = plainTextOf(currentTitleHtml);
      if (!titleText) e.title = 'Question text is required';
      if (isChoice) {
        const filled = options.filter(o => o.text.trim());
        if (filled.length < 2) e.options = 'At least 2 options are required';
        else if (!filled.some(o => o.isCorrect)) e.options = 'Mark at least one option as correct';
      }
      if (mcqType === 'true_false' && trueFalseAnswer === null) e.trueFalse = 'Pick the correct answer';
      if (mcqType === 'short_answer' && !shortAnswer.trim()) e.shortAnswer = 'Expected answer is required';
      if (mcqType === 'matching' && pairs.filter(p => p.left.trim() && p.right.trim()).length < 2) e.pairs = 'At least 2 complete pairs are required';
      if (mcqType === 'ordering' && orderItems.filter(i => i.text.trim()).length < 2) e.order = 'At least 2 items are required';
      if (mcqType === 'numeric' && numericAnswer.trim() === '') e.numeric = 'The correct value is required';
      if (hasExplanation && !explanation.trim()) e.explanation = 'Write the explanation or untick the box';
      if (topics.length === 0) e.topics = 'Add at least one topic';
      if (marks.trim() !== '' && (Number.isNaN(Number(marks)) || Number(marks) < 0 || Number(marks) > 100)) e.marks = 'Marks must be between 0 and 100';
      setErrs(e);
      if (Object.keys(e).length > 0) return { ok: false };

      const files: { key: string; file: File }[] = [];
      const payload: any = {
        questionCategory: 'MCQ',
        questionType: 'mcq',
        isActive: true,
        mcqQuestionTitle: { text: currentTitleHtml },
        mcqQuestionType: mcqType,
        mcqQuestionDifficulty: difficulty,
        mcqQuestionOptionsPerRow: optionsPerRow,
        mcqQuestionRequired: isRequired,
        source: 'scratch-manual',
        problemType: problemType || undefined,
        topics,
        tags,
      };
      if (marks.trim() !== '') payload.mcqQuestionScore = Number(marks);
      if (isChoice) {
        // File keys must use the FILTERED option indices — the server pairs
        // question_0_option_<i>_image with mcqQuestionOptions[i].
        const filled = options.filter(o => o.text.trim());
        payload.mcqQuestionOptions = filled.map(o => ({ text: o.text.trim(), isCorrect: o.isCorrect }));
        payload.mcqQuestionCorrectAnswers = filled.filter(o => o.isCorrect).map(o => o.text.trim());
        payload.hasOtherOption = hasOtherOption;
        filled.forEach((o, idx) => {
          if (o.imageFile) files.push({ key: `question_0_option_${idx}_image`, file: o.imageFile });
        });
      }
      if (mcqType === 'true_false') payload.trueFalseAnswer = trueFalseAnswer;
      if (mcqType === 'short_answer') payload.shortAnswer = shortAnswer.trim();
      if (mcqType === 'essay') payload.essayAnswer = essayAnswer.trim();
      if (mcqType === 'matching') payload.matchingPairs = pairs.filter(p => p.left.trim() && p.right.trim()).map(p => ({ left: p.left.trim(), right: p.right.trim() }));
      if (mcqType === 'ordering') payload.orderingItems = orderItems.filter(i => i.text.trim()).map((i, idx) => ({ text: i.text.trim(), order: idx + 1 }));
      if (mcqType === 'numeric') {
        payload.numericAnswer = Number(numericAnswer);
        payload.numericTolerance = numericTolerance.trim() === '' ? null : Number(numericTolerance);
      }
      if (hasExplanation) {
        payload.hasExplanation = true;
        payload.explanation = explanation.trim();
      }
      return { ok: true, payload, files };
    },
  }), [mcqType, titleHtml, options, trueFalseAnswer, shortAnswer, essayAnswer, pairs,
       orderItems, numericAnswer, numericTolerance, hasExplanation, explanation,
       optionsPerRow, isRequired, difficulty, problemType, topics, tags, isChoice, singleCorrect,
       hasOtherOption, marks]);

  return (
    <div className="flex min-h-0 flex-1">
      {/* ── Content column (~68%) — own scroll ── */}
      <div className="min-w-0 flex-1 space-y-4 overflow-y-auto p-5">
        {/* Labelled "Question Title" so it matches the server's error copy
            ("MCQ question title text is required") — the field is the same
            RichTextLite, but the label made it look like something else. */}
        <SectionCard title="Question Title" required>
          <RichTextLite
            placeholder="Write the question here... (toolbar: code snippets, images)"
            minHeight={110}
            onChange={setTitleHtml}
            htmlRef={titleHtmlRef}
          />
          <FieldError msg={errs.title} />
        </SectionCard>

        {isChoice && (
          <SectionCard title="Options" required
            action={
              <button type="button"
                onClick={() => setOptions(p => [...p, { id: nid(), text: '', isCorrect: false }])}
                className="inline-flex h-8 items-center gap-1 rounded-control border border-brand-500/30 bg-brand-wash px-2.5 text-[11.5px] font-semibold text-brand-strong transition-colors hover:bg-brand-wash-hover">
                <Plus size={12} /> Add Option
              </button>
            }>
            <p className="mb-2 text-[11px] text-faint">
              {singleCorrect ? 'Tick exactly one correct option.' : 'Tick every correct option.'}
            </p>
            <div className="space-y-2">
              {options.map((o, i) => (
                <div key={o.id} className={`flex items-center gap-2 rounded-control border p-2 transition-colors ${o.isCorrect ? 'border-emerald-300 bg-emerald-50/60' : 'border-hairline bg-surface'}`}>
                  <input type={singleCorrect ? 'radio' : 'checkbox'} name="correct-opt" checked={o.isCorrect}
                    onChange={() => toggleCorrect(o.id)} className="accent-emerald-600" />
                  <span className="w-5 shrink-0 text-center font-mono text-[11px] font-bold text-subtle">{String.fromCharCode(65 + i)}</span>
                  <input className="h-8 min-w-0 flex-1 rounded-[7px] border border-transparent bg-transparent px-2 text-[13px] text-body placeholder:text-faint focus:border-brand focus:outline-none"
                    value={o.text} placeholder={`Option ${String.fromCharCode(65 + i)}`}
                    onChange={e => setOptions(p => p.map(x => x.id === o.id ? { ...x, text: e.target.value } : x))} />
                  {o.imagePreview ? (
                    <span className="relative shrink-0">
                      <img src={o.imagePreview} alt={`Option ${String.fromCharCode(65 + i)}`} className="h-8 w-8 rounded-[6px] border border-[#EEF0F5] object-cover" />
                      <button type="button"
                        onClick={() => setOptions(p => p.map(x => x.id === o.id ? { ...x, imageFile: null, imagePreview: undefined } : x))}
                        className="absolute -right-1.5 -top-1.5 rounded-full border border-[#E8EAF2] bg-white p-0.5 text-faint hover:text-rose-500"
                        aria-label="Remove option image">
                        <X size={9} />
                      </button>
                    </span>
                  ) : (
                    <label className="shrink-0 cursor-pointer rounded-md p-1 text-faint transition-colors hover:bg-brand-wash hover:text-brand-strong"
                      title="Add option image">
                      <ImagePlus size={13} />
                      <input type="file" accept="image/*" className="hidden"
                        onChange={e => { attachOptionImage(o.id, e.target.files?.[0] || null); e.target.value = ''; }} />
                    </label>
                  )}
                  <button type="button" disabled={options.length <= 2}
                    onClick={() => setOptions(p => p.filter(x => x.id !== o.id))}
                    className="rounded-md p-1 text-faint transition-colors hover:bg-rose-50 hover:text-rose-500 disabled:cursor-not-allowed disabled:opacity-30"
                    aria-label={`Remove option ${String.fromCharCode(65 + i)}`}>
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
            <label className="mt-2.5 flex items-center gap-1.5 text-[12px] font-medium text-subtle">
              <input type="checkbox" checked={hasOtherOption} onChange={e => setHasOtherOption(e.target.checked)} />
              Allow &quot;Other&quot; option (learner can type a free answer)
            </label>
            <FieldError msg={errs.options} />
          </SectionCard>
        )}

        {mcqType === 'true_false' && (
          <SectionCard title="Correct Answer" required>
            <div className="grid grid-cols-2 gap-2">
              {[true, false].map(v => (
                <button key={String(v)} type="button" onClick={() => setTrueFalseAnswer(v)}
                  className={`h-9 rounded-[10px] border text-[12.5px] font-semibold transition-colors ${
                    trueFalseAnswer === v
                      ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                      : 'border-hairline-strong bg-surface text-subtle hover:border-emerald-300 hover:text-emerald-700'}`}>
                  {v ? 'True' : 'False'}
                </button>
              ))}
            </div>
            <FieldError msg={errs.trueFalse} />
          </SectionCard>
        )}

        {mcqType === 'short_answer' && (
          <SectionCard title="Expected Answer" required>
            <input className={inputCls} value={shortAnswer} placeholder="The accepted answer..."
              onChange={e => setShortAnswer(e.target.value)} />
            <FieldError msg={errs.shortAnswer} />
          </SectionCard>
        )}

        {mcqType === 'essay' && (
          <SectionCard title="Model Answer" optional>
            <textarea className={textareaCls} rows={4} value={essayAnswer}
              placeholder="Sample/model answer used as a grading reference..."
              onChange={e => setEssayAnswer(e.target.value)} />
          </SectionCard>
        )}

        {mcqType === 'matching' && (
          <SectionCard title="Matching Pairs" required
            action={
              <button type="button" onClick={() => setPairs(p => [...p, { id: nid(), left: '', right: '' }])}
                className="inline-flex h-8 items-center gap-1 rounded-control border border-brand-500/30 bg-brand-wash px-2.5 text-[11.5px] font-semibold text-brand-strong transition-colors hover:bg-brand-wash-hover">
                <Plus size={12} /> Add Pair
              </button>
            }>
            <div className="space-y-2">
              {pairs.map((p, i) => (
                <div key={p.id} className="flex items-center gap-2">
                  <span className="w-5 text-center font-mono text-[11px] font-bold text-subtle">{i + 1}</span>
                  <input className={`${inputCls} h-8`} value={p.left} placeholder="Left item"
                    onChange={e => setPairs(x => x.map(y => y.id === p.id ? { ...y, left: e.target.value } : y))} />
                  <span className="text-faint">→</span>
                  <input className={`${inputCls} h-8`} value={p.right} placeholder="Matches with"
                    onChange={e => setPairs(x => x.map(y => y.id === p.id ? { ...y, right: e.target.value } : y))} />
                  <button type="button" disabled={pairs.length <= 2}
                    onClick={() => setPairs(x => x.filter(y => y.id !== p.id))}
                    className="rounded-md p-1 text-faint transition-colors hover:bg-rose-50 hover:text-rose-500 disabled:cursor-not-allowed disabled:opacity-30"
                    aria-label={`Remove pair ${i + 1}`}>
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
            <FieldError msg={errs.pairs} />
          </SectionCard>
        )}

        {mcqType === 'ordering' && (
          <SectionCard title="Items In Correct Order" required
            action={
              <button type="button" onClick={() => setOrderItems(p => [...p, { id: nid(), text: '' }])}
                className="inline-flex h-8 items-center gap-1 rounded-control border border-brand-500/30 bg-brand-wash px-2.5 text-[11.5px] font-semibold text-brand-strong transition-colors hover:bg-brand-wash-hover">
                <Plus size={12} /> Add Item
              </button>
            }>
            <p className="mb-2 text-[11px] text-faint">List the items top-to-bottom in the correct final order — learners see them shuffled.</p>
            <div className="space-y-2">
              {orderItems.map((it, i) => (
                <div key={it.id} className="flex items-center gap-2">
                  <GripVertical size={13} className="shrink-0 text-faint" />
                  <span className="w-5 text-center font-mono text-[11px] font-bold text-subtle">{i + 1}</span>
                  <input className={`${inputCls} h-8`} value={it.text} placeholder={`Item ${i + 1}`}
                    onChange={e => setOrderItems(x => x.map(y => y.id === it.id ? { ...y, text: e.target.value } : y))} />
                  <button type="button" disabled={orderItems.length <= 2}
                    onClick={() => setOrderItems(x => x.filter(y => y.id !== it.id))}
                    className="rounded-md p-1 text-faint transition-colors hover:bg-rose-50 hover:text-rose-500 disabled:cursor-not-allowed disabled:opacity-30"
                    aria-label={`Remove item ${i + 1}`}>
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
            <FieldError msg={errs.order} />
          </SectionCard>
        )}

        {mcqType === 'numeric' && (
          <SectionCard title="Correct Value" required>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Answer</Label>
                <input type="number" className={inputCls} value={numericAnswer} placeholder="e.g. 42"
                  onChange={e => setNumericAnswer(e.target.value)} />
              </div>
              <div>
                <Label optional>Tolerance (±)</Label>
                <input type="number" className={inputCls} value={numericTolerance} placeholder="e.g. 0.5"
                  onChange={e => setNumericTolerance(e.target.value)} />
              </div>
            </div>
            <FieldError msg={errs.numeric} />
          </SectionCard>
        )}

        <SectionCard title="Explanation" optional
          action={
            <label className="flex items-center gap-1.5 text-[11.5px] font-medium text-subtle">
              <input type="checkbox" checked={hasExplanation} onChange={e => setHasExplanation(e.target.checked)} />
              Add Explanation
            </label>
          }>
          {hasExplanation ? (
            <>
              <textarea className={textareaCls} rows={3} value={explanation}
                placeholder="Shown to learners after answering..."
                onChange={e => setExplanation(e.target.value)} />
              <FieldError msg={errs.explanation} />
            </>
          ) : (
            <p className="text-[12px] text-faint">Tick the box to attach an explanation learners see after answering.</p>
          )}
        </SectionCard>
      </div>

      {/* ── Configuration rail (~32%) — own scroll ── */}
      <div className="w-[31%] min-w-[300px] shrink-0 space-y-5 overflow-y-auto border-l border-[#E8EAF2] p-5">
        <div>
          <Label required>Question Type</Label>
          <select className={inputCls} value={mcqType} onChange={e => setMcqType(e.target.value as McqType)}>
            {MCQ_TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
          </select>
        </div>

        <div>
          <Label required>Difficulty Level</Label>
          <DifficultySegmented value={difficulty} onChange={setDifficulty} />
        </div>

        <div>
          <Label optional>Category</Label>
          <ProblemTypePicker value={problemType} onChange={setProblemType} />
        </div>

        <div>
          <Label required>Topics</Label>
          <ChipInput values={topics} onChange={setTopics} placeholder="Add topics and press Enter" />
          <p className="mt-1 text-[11px] text-faint">You can add multiple topics</p>
          <FieldError msg={errs.topics} />
        </div>

        <div>
          <Label optional>Tags</Label>
          <ChipInput values={tags} onChange={setTags} placeholder="Add tags and press Enter" />
        </div>

        <div>
          <Label optional>Marks</Label>
          <input type="number" min={0} max={100} className={inputCls} value={marks} placeholder="Enter marks"
            onChange={e => setMarks(e.target.value)} />
          <FieldError msg={errs.marks} />
        </div>

        {isChoice && (
          <div>
            <Label>Options Per Row</Label>
            <select className={inputCls} value={optionsPerRow} onChange={e => setOptionsPerRow(Number(e.target.value))}>
              {[1, 2, 3, 4].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
        )}

        <label className="flex items-center gap-2 text-[12.5px] font-medium text-body">
          <input type="checkbox" checked={isRequired} onChange={e => setIsRequired(e.target.checked)} />
          Answer required
        </label>
      </div>
    </div>
  );
});

MCQCreateContent.displayName = 'MCQCreateContent';
export default MCQCreateContent;
