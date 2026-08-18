'use client';

// Right-side preview drawer for a question — replaces the legacy inline
// card-accordion. Renders the same type-specific sections (options grid,
// matching pairs, ordering, numeric, test cases, constraints) with proper
// hierarchy, plus the image lightbox ported from the old list.

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Check,
  Clock,
  Equal,
  MemoryStick,
  Pencil,
  Tag,
  Terminal,
  X,
} from 'lucide-react';
import type {
  MCQOption,
  MatchingPair,
  OrderingItem,
  Question,
} from '@/apiServices/type/question';
import { Drawer, StatusPill, easeStandard } from '@/app/lms/shared/ui';
import { Button } from '@/components/ui/button';
import {
  difficultyTone,
  formatDifficulty,
  getDifficulty,
  getExplanationHtml,
  getQuestionImageAlignment,
  getQuestionImageSize,
  getQuestionImageUrl,
  getQuestionTitleHtml,
  getQuestionTitleText,
  getQuestionTypeInfo,
  getScore,
  isMcqQuestion,
} from './lib';

interface QuestionDetailDrawerProps {
  question: Question | null;
  onClose: () => void;
  onEdit: (question: Question) => void;
  canEdit?: boolean;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-1.5 text-2xs font-semibold uppercase tracking-wider text-subtle">
      {children}
    </p>
  );
}

// Image margin from its stored alignment — identical maths to the old list.
const imageMargin = (alignment: 'left' | 'center' | 'right') =>
  alignment === 'center' ? '0 auto' : alignment === 'right' ? '0 0 0 auto' : '0';

export default function QuestionDetailDrawer({
  question,
  onClose,
  onEdit,
  canEdit = true,
}: QuestionDetailDrawerProps) {
  // Cache the last question so the drawer's exit slide doesn't render empty.
  const [cached, setCached] = useState<Question | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  useEffect(() => {
    if (question) setCached(question);
  }, [question]);

  const q = question ?? cached;

  const renderMCQOptions = (
    options: MCQOption[],
    correctAnswers: string[],
    optionsPerRow: number
  ) => (
    <div
      className="grid gap-2"
      style={{ gridTemplateColumns: `repeat(${optionsPerRow}, minmax(0, 1fr))` }}
    >
      {options.map((opt, optIdx) => {
        const isCorrect = correctAnswers.includes(opt.text);
        return (
          <div
            key={opt.id || opt._id || optIdx}
            className={`flex flex-col overflow-hidden rounded-tile border ${
              isCorrect
                ? 'border-success-500/40 bg-success-50'
                : 'border-hairline bg-surface'
            }`}
          >
            {opt.imageUrl ? (
              <button
                type="button"
                onClick={() => setPreviewImage(opt.imageUrl!)}
                className="group w-full cursor-zoom-in border-b border-hairline bg-canvas p-2"
                style={{
                  display: 'flex',
                  justifyContent:
                    opt.imageAlignment === 'left'
                      ? 'flex-start'
                      : opt.imageAlignment === 'right'
                        ? 'flex-end'
                        : 'center',
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- user-uploaded URL with percent sizing; ported from the legacy list */}
                <img
                  src={opt.imageUrl}
                  alt={`Option ${String.fromCharCode(65 + optIdx)}`}
                  className="h-auto rounded-chip border border-hairline transition-colors duration-150 group-hover:border-brand"
                  style={{ width: `${opt.imageSizePercent || 60}%` }}
                />
              </button>
            ) : null}
            <div className="flex items-center gap-2 p-2.5">
              <span
                className={`flex size-5 shrink-0 items-center justify-center rounded-full text-2xs font-semibold ${
                  isCorrect ? 'bg-success-500 text-white' : 'bg-ink-100 text-ink-700'
                }`}
              >
                {String.fromCharCode(65 + optIdx)}
              </span>
              <span className="flex-1 break-words text-sm text-body">{opt.text}</span>
              {isCorrect ? (
                <Check size={14} className="shrink-0 text-success-700" aria-hidden="true" />
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );

  const renderTrueFalse = (trueFalseAnswer: boolean | null | undefined) => (
    <div className="flex gap-3">
      {[true, false].map((value) => {
        const selected = trueFalseAnswer === value;
        return (
          <div
            key={String(value)}
            className={`flex items-center gap-2 rounded-tile border px-3.5 py-2 ${
              selected
                ? 'border-success-500/40 bg-success-50'
                : 'border-hairline bg-surface'
            }`}
          >
            <span
              className={`flex size-4 items-center justify-center rounded-full border-2 ${
                selected ? 'border-success-500 bg-success-500' : 'border-hairline-strong'
              }`}
            >
              {selected ? <span className="size-1.5 rounded-full bg-white" /> : null}
            </span>
            <span className={`text-sm font-medium ${selected ? 'text-success-700' : 'text-body'}`}>
              {value ? 'True' : 'False'}
            </span>
          </div>
        );
      })}
    </div>
  );

  const renderMatchingPairs = (pairs: MatchingPair[] = []) => (
    <div className="space-y-1.5">
      {pairs.map((pair, idx) => (
        <div key={pair.id || pair._id || idx} className="flex items-center gap-2 text-sm">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-chip bg-brand-wash text-2xs font-semibold text-brand-strong">
            {idx + 1}
          </span>
          <div className="flex-1 rounded-tile border border-hairline bg-surface px-2.5 py-1.5 text-body">
            {pair.left || '—'}
          </div>
          <Equal size={14} className="shrink-0 text-faint" aria-hidden="true" />
          <div className="flex-1 rounded-tile border border-success-500/30 bg-success-50 px-2.5 py-1.5 text-success-700">
            {pair.right || '—'}
          </div>
        </div>
      ))}
    </div>
  );

  const renderOrderingItems = (items: OrderingItem[] = []) => {
    const sortedItems = [...items].sort((a, b) => a.order - b.order);
    return (
      <div className="space-y-1.5">
        {sortedItems.map((item, idx) => (
          <div key={item.id || item._id || idx} className="flex items-center gap-2 text-sm">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-chip bg-info-50 text-2xs font-semibold text-info-700">
              {idx + 1}
            </span>
            <div className="flex-1 rounded-tile border border-hairline bg-surface px-2.5 py-1.5 text-body">
              {item.text || '—'}
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderNumericAnswer = (
    answer: number | null | undefined,
    tolerance: number | null | undefined
  ) => {
    if (answer === null || answer === undefined) {
      return <p className="text-sm text-subtle">No answer set</p>;
    }
    return (
      <div className="flex flex-wrap items-center gap-2.5">
        <span className="rounded-tile border border-hairline bg-surface px-3 py-1.5 font-mono text-sm font-semibold text-heading">
          {answer}
        </span>
        {tolerance && tolerance > 0 ? (
          <>
            <span className="text-faint">±</span>
            <span className="rounded-tile border border-warn-500/30 bg-warn-50 px-3 py-1.5 font-mono text-sm text-warn-700">
              {tolerance}
            </span>
            <span className="text-xs text-subtle">
              Range: {(answer - tolerance).toFixed(2)} to {(answer + tolerance).toFixed(2)}
            </span>
          </>
        ) : null}
      </div>
    );
  };

  let body: React.ReactNode = null;

  if (q) {
    const isMCQ = isMcqQuestion(q);
    const typeInfo = getQuestionTypeInfo(q);
    const TypeIcon = typeInfo.icon;
    const difficulty = getDifficulty(q);
    const score = getScore(q);
    const plainTitle = getQuestionTitleText(q);
    const htmlTitle = getQuestionTitleHtml(q);
    const questionImageUrl = getQuestionImageUrl(q);
    const questionImageAlignment = getQuestionImageAlignment(q);
    const questionImageSize = getQuestionImageSize(q);
    const explanation = getExplanationHtml(q);

    const mcqType = q.mcqQuestionType;
    const options = isMCQ ? q.mcqQuestionOptions || [] : [];
    const correctAnswers = isMCQ ? q.mcqQuestionCorrectAnswers || [] : [];
    const optionsPerRow = q.mcqQuestionOptionsPerRow || 1;
    const timeLimit = isMCQ ? q.mcqQuestionTimeLimit || 0 : q.timeLimit || 0;
    const isChoiceType =
      mcqType === 'multiple_choice' || mcqType === 'multiple_select' || mcqType === 'dropdown';

    body = (
      <div className="space-y-5">
        {/* Identity chips */}
        <div className="flex flex-wrap items-center gap-1.5">
          <StatusPill tone={typeInfo.tone}>
            <TypeIcon size={11} aria-hidden="true" />
            {typeInfo.label}
          </StatusPill>
          <StatusPill tone={difficultyTone(difficulty)} dot>
            {formatDifficulty(difficulty)}
          </StatusPill>
          <StatusPill tone={q.isActive ? 'success' : 'neutral'} dot>
            {q.isActive ? 'Active' : 'Inactive'}
          </StatusPill>
          <span className="inline-flex h-6 items-center gap-1.5 rounded-chip border border-hairline bg-canvas px-2 text-xs text-body">
            <Tag size={11} className="text-faint" aria-hidden="true" />
            {q.questionCategory || 'Uncategorized'}
          </span>
          {(isMCQ || score > 0) && (
            <span className="inline-flex h-6 items-center rounded-chip border border-hairline bg-canvas px-2 text-xs tabular-nums text-body">
              {score} pts
            </span>
          )}
        </div>

        {/* Question */}
        <div>
          <SectionLabel>Question</SectionLabel>
          {isMCQ ? (
            <div
              className="prose prose-sm max-w-none rounded-tile border border-hairline bg-canvas p-3 text-sm text-body"
              dangerouslySetInnerHTML={{ __html: htmlTitle }}
            />
          ) : (
            <p className="text-md font-semibold leading-snug text-heading">
              {plainTitle}
            </p>
          )}
        </div>

        {/* Question image */}
        {questionImageUrl ? (
          <div>
            <SectionLabel>Question image</SectionLabel>
            <button
              type="button"
              className="block w-full cursor-zoom-in"
              onClick={() => setPreviewImage(questionImageUrl)}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- user-uploaded URL with percent sizing; ported from the legacy list */}
              <img
                src={questionImageUrl}
                alt="Question"
                className="max-h-48 rounded-tile border border-hairline transition-colors duration-150 hover:border-brand"
                style={{
                  width: `${questionImageSize}%`,
                  display: 'block',
                  margin: imageMargin(questionImageAlignment),
                }}
              />
            </button>
          </div>
        ) : null}

        {isMCQ ? (
          <>
            {isChoiceType ? (
              <div>
                <SectionLabel>
                  Options ({options.length}) · {optionsPerRow} per row
                </SectionLabel>
                {renderMCQOptions(options, correctAnswers, optionsPerRow)}
                {correctAnswers.length > 0 ? (
                  <div className="mt-2.5 flex items-start gap-1.5 rounded-tile border border-success-500/30 bg-success-50 px-2.5 py-1.5">
                    <Check size={13} className="mt-0.5 shrink-0 text-success-700" aria-hidden="true" />
                    <span className="text-xs text-success-700">
                      Correct: {correctAnswers.join(', ')}
                    </span>
                  </div>
                ) : null}
              </div>
            ) : mcqType === 'true_false' ? (
              <div>
                <SectionLabel>Correct answer</SectionLabel>
                {renderTrueFalse(q.trueFalseAnswer)}
              </div>
            ) : mcqType === 'short_answer' ? (
              <div>
                <SectionLabel>Answer key</SectionLabel>
                <div className="rounded-tile border border-hairline bg-surface p-3">
                  <p className="text-2xs text-subtle">Expected answer</p>
                  <p className="mt-0.5 text-sm text-heading">
                    {q.shortAnswer || 'No expected answer provided'}
                  </p>
                </div>
              </div>
            ) : mcqType === 'essay' ? (
              <div className="rounded-tile border border-warn-500/30 bg-warn-50 p-3">
                <p className="text-xs text-warn-700">
                  Essay questions are graded manually. No automatic answer key.
                </p>
              </div>
            ) : mcqType === 'matching' ? (
              <div>
                <SectionLabel>Matching pairs ({q.matchingPairs?.length || 0})</SectionLabel>
                {renderMatchingPairs(q.matchingPairs)}
              </div>
            ) : mcqType === 'ordering' ? (
              <div>
                <SectionLabel>
                  Correct order ({q.orderingItems?.length || 0} items)
                </SectionLabel>
                {renderOrderingItems(q.orderingItems)}
              </div>
            ) : mcqType === 'numeric' ? (
              <div>
                <SectionLabel>Numeric answer</SectionLabel>
                {renderNumericAnswer(q.numericAnswer, q.numericTolerance)}
              </div>
            ) : null}

            {explanation ? (
              <div>
                <SectionLabel>Explanation</SectionLabel>
                <div
                  className="prose prose-sm max-w-none rounded-tile border border-hairline bg-canvas p-3 text-sm text-body"
                  dangerouslySetInnerHTML={{ __html: explanation }}
                />
              </div>
            ) : null}

            {(timeLimit > 0 || q.mcqQuestionRequired) && (
              <div className="flex flex-wrap gap-2 border-t border-hairline pt-3">
                {timeLimit > 0 ? (
                  <span className="inline-flex items-center gap-1.5 rounded-chip border border-hairline bg-surface px-2 py-1 text-xs text-subtle">
                    <Clock size={11} aria-hidden="true" />
                    Time limit: {timeLimit}ms
                  </span>
                ) : null}
                {q.mcqQuestionRequired ? (
                  <span className="inline-flex items-center rounded-chip border border-danger-500/30 bg-danger-50 px-2 py-1 text-xs text-danger-700">
                    Required question
                  </span>
                ) : null}
              </div>
            )}
          </>
        ) : (
          <>
            {q.description ? (
              <div>
                <SectionLabel>Description</SectionLabel>
                <p className="whitespace-pre-wrap rounded-tile border border-hairline bg-canvas p-3 text-sm leading-relaxed text-body">
                  {q.description}
                </p>
              </div>
            ) : null}

            {(q.sampleInput || q.sampleOutput) && (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {q.sampleInput ? (
                  <div className="rounded-tile bg-ink-900 p-3">
                    <p className="mb-1 flex items-center gap-1.5 text-2xs text-ink-400">
                      <Terminal size={10} aria-hidden="true" /> Sample input
                    </p>
                    <pre className="whitespace-pre-wrap font-mono text-xs text-ink-100">
                      {q.sampleInput}
                    </pre>
                  </div>
                ) : null}
                {q.sampleOutput ? (
                  <div className="rounded-tile bg-ink-900 p-3">
                    <p className="mb-1 flex items-center gap-1.5 text-2xs text-ink-400">
                      <Terminal size={10} aria-hidden="true" /> Sample output
                    </p>
                    <pre className="whitespace-pre-wrap font-mono text-xs text-ink-100">
                      {q.sampleOutput}
                    </pre>
                  </div>
                ) : null}
              </div>
            )}

            {q.sampleQuery ? (
              <div>
                <SectionLabel>Sample query</SectionLabel>
                <pre className="whitespace-pre-wrap rounded-tile bg-ink-900 p-3 font-mono text-xs text-ink-100">
                  {q.sampleQuery}
                </pre>
              </div>
            ) : null}

            {q.expectedResult ? (
              <div>
                <SectionLabel>Expected result</SectionLabel>
                <pre className="whitespace-pre-wrap rounded-tile bg-ink-900 p-3 font-mono text-xs text-ink-100">
                  {q.expectedResult}
                </pre>
              </div>
            ) : null}

            {q.testCases && q.testCases.length > 0 ? (
              <div>
                <SectionLabel>Test cases ({q.testCases.length})</SectionLabel>
                <div className="space-y-2">
                  {q.testCases.map((tc, tcIdx) => (
                    <div
                      key={tcIdx}
                      className="rounded-tile border border-hairline bg-surface p-2.5"
                    >
                      <div className="mb-1.5 flex items-center justify-between">
                        <span className="font-mono text-xs text-subtle">#{tcIdx + 1}</span>
                        <StatusPill tone={tc.isHidden ? 'neutral' : 'success'} className="h-5 px-2 text-2xs">
                          {tc.isHidden ? 'Hidden' : 'Public'}
                        </StatusPill>
                      </div>
                      <div className="grid grid-cols-1 gap-1.5 text-xs sm:grid-cols-2">
                        <div className="min-w-0 text-body">
                          <span className="text-subtle">Input:</span>{' '}
                          <span className="break-all font-mono">{tc.input || '—'}</span>
                        </div>
                        <div className="min-w-0 text-body">
                          <span className="text-subtle">Output:</span>{' '}
                          <span className="break-all font-mono">{tc.expectedOutput || '—'}</span>
                        </div>
                      </div>
                      {(tc.points ?? 0) > 0 ? (
                        <p className="mt-1 text-2xs text-warn-700">Points: {tc.points}</p>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {q.constraints && q.constraints.length > 0 ? (
              <div>
                <SectionLabel>Constraints</SectionLabel>
                <ul className="list-inside list-disc space-y-1 rounded-tile border border-hairline bg-canvas p-3 text-sm text-body">
                  {q.constraints.map((constraint, cIdx) => (
                    <li key={cIdx}>{constraint}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {(q.timeLimit || q.memoryLimit) && (
              <div className="flex flex-wrap gap-2 border-t border-hairline pt-3">
                {q.timeLimit ? (
                  <span className="inline-flex items-center gap-1.5 rounded-chip border border-hairline bg-surface px-2 py-1 text-xs text-subtle">
                    <Clock size={11} aria-hidden="true" />
                    Time: {q.timeLimit}ms
                  </span>
                ) : null}
                {q.memoryLimit ? (
                  <span className="inline-flex items-center gap-1.5 rounded-chip border border-hairline bg-surface px-2 py-1 text-xs text-subtle">
                    <MemoryStick size={11} aria-hidden="true" />
                    Memory: {q.memoryLimit}MB
                  </span>
                ) : null}
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  return (
    <>
      <Drawer
        open={question !== null}
        onClose={onClose}
        title="Question preview"
        description={
          q ? `${getQuestionTypeInfo(q).label} · ${q.questionCategory || 'Uncategorized'}` : undefined
        }
        width="lg"
        footer={
          <>
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
            {canEdit && (
              <Button onClick={() => q && onEdit(q)}>
                <Pencil size={15} />
                Edit question
              </Button>
            )}
          </>
        }
      >
        {body}
      </Drawer>

      {/* Image lightbox — sits above the drawer (z-popover > z-modal). */}
      <AnimatePresence>
        {previewImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: easeStandard }}
            className="fixed inset-0 z-popover flex items-center justify-center bg-ink-900/80 p-6"
            onClick={() => setPreviewImage(null)}
          >
            <motion.div
              initial={{ scale: 0.96 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.96 }}
              transition={{ duration: 0.18, ease: easeStandard }}
              className="relative max-h-[85vh] max-w-4xl"
            >
              <button
                type="button"
                aria-label="Close image preview"
                onClick={() => setPreviewImage(null)}
                className="absolute -top-10 right-0 rounded-control p-2 text-white/80 transition-colors duration-150 hover:text-white"
              >
                <X size={20} />
              </button>
              {/* eslint-disable-next-line @next/next/no-img-element -- lightbox for arbitrary uploaded image URLs */}
              <img
                src={previewImage}
                alt="Preview"
                className="max-h-[85vh] max-w-full rounded-xl object-contain"
                onClick={(e) => e.stopPropagation()}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
