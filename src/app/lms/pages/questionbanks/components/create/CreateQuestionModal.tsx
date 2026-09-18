'use client';

/**
 * Create Question modal — the authoring counterpart of the Question Bank
 * picker. Shared shell (header / footer / add-another) around the per-type
 * content components. Saves to POST /create/question-bank and reports the
 * created questions back so the picker can refetch and highlight them.
 */

import React, { useRef, useState } from 'react';
import { X, Code2, ListChecks, Loader2, FilePlus2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { questionBankService } from '@/app/lms/pages/questionbanks/api/questionBankService';
import ProgrammingCreateContent, { type CreateContentHandle } from './ProgrammingCreateContent';
import MCQCreateContent from './MCQCreateContent';
import type { CreateQType } from './QuestionTypeChooserModal';

const CreateQuestionModal = ({
  qType,
  defaultSubType,
  onClose,
  onCreated,
  bankSource = 'internal',
  courseId,
}: {
  qType: CreateQType;
  defaultSubType?: 'core' | 'frontend' | 'database';
  onClose: () => void;
  /** Called after every successful save (even in add-another mode). */
  onCreated: () => void;
  /**
   * Which bank the save goes into. `'internal'` (default) posts to the
   * institution-scoped Question Bank; `'external'` posts to the GLOBAL Other
   * Platform bank — a top-level collection with no image-upload path yet, so
   * MCQ image uploads are refused at save time on that source.
   */
  bankSource?: 'internal' | 'external';
  /**
   * When set, the created question is pinned to this course — it lives under
   * the Course Specific tab for that course only. Omit for the General bank.
   */
  courseId?: string | null;
}) => {
  const contentRef = useRef<CreateContentHandle>(null);
  const [saving, setSaving] = useState(false);
  const [addAnother, setAddAnother] = useState(false);
  // Remount key resets the content component for "add another".
  const [formKey, setFormKey] = useState(0);

  const isProg = qType === 'programming';
  const isExternal = bankSource === 'external';

  const handleCreate = async () => {
    if (saving) return;
    const result = contentRef.current?.submit();
    if (!result?.ok || !result.payload) {
      toast.error('Fix the highlighted fields first.');
      return;
    }
    // Pin the question to a course when the modal was opened from the Course
    // Specific view. Merged here rather than inside each content component so
    // MCQ + Programming share the same wiring.
    if (courseId) {
      result.payload.courseId = courseId;
    }
    setSaving(true);
    try {
      if (result.files && result.files.length > 0) {
        if (isExternal) {
          // The External bank's create endpoint accepts JSON only. Blocking
          // here instead of silently dropping the image references keeps
          // authored options from ending up with dead imageUrl values.
          toast.error(
            'Image uploads on the External bank aren\'t supported yet — remove the images or save on the Internal bank.',
          );
          return;
        }
        // Images ride along as multipart files — the bank's create endpoint
        // uploads them and fills the corresponding imageUrl fields.
        const fd = new FormData();
        fd.append('questionsData', JSON.stringify([result.payload]));
        result.files.forEach(f => fd.append(f.key, f.file));
        await questionBankService.createQuestion(fd);
      } else if (isExternal) {
        await questionBankService.createOtherPlatformQuestion(result.payload);
      } else {
        await questionBankService.createQuestion(result.payload);
      }
      toast.success('Question added to the question bank.');
      onCreated();
      if (addAnother) {
        setFormKey(k => k + 1);
      } else {
        onClose();
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Could not create the question.';
      toast.error(typeof msg === 'string' ? msg : 'Could not create the question.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="flex h-[min(920px,94vh)] w-[min(1520px,96vw)] flex-col overflow-hidden rounded-[18px] border border-[#E8EAF2] bg-white shadow-[0_20px_60px_rgba(16,24,40,0.12)]">

        {/* Header — compact, fixed */}
        <div className="flex h-[50px] shrink-0 items-center justify-between border-b border-[#E8EAF2] bg-white px-5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-[8px] bg-brand-wash text-brand-strong">
              {isProg ? <Code2 size={15} /> : <ListChecks size={15} />}
            </div>
            <div className="flex items-baseline gap-2">
              <h2 className="text-[14px] font-bold leading-none text-heading">
                {isProg ? 'Create Programming Question' : 'Create MCQ Question'}
              </h2>
              <p className="hidden text-[11.5px] leading-none text-[#6B7280] md:block">
                Create a new reusable question for your question bank.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-faint transition-colors hover:bg-row-hover hover:text-subtle" aria-label="Close">
            <X size={16} />
          </button>
        </div>

        {/* Body — left and right columns scroll independently (like the
            ProgrammingQuestionForm); header/footer stay fixed */}
        {isProg ? (
          <ProgrammingCreateContent key={formKey} ref={contentRef} defaultSubType={defaultSubType} />
        ) : (
          <MCQCreateContent key={formKey} ref={contentRef} />
        )}

        {/* Footer — compact, fixed */}
        <div className="flex h-[46px] shrink-0 items-center justify-between border-t border-[#E8EAF2] bg-white px-5">
          <label className="flex items-center gap-1.5 text-[12.5px] font-medium text-body">
            <input type="checkbox" className="h-3.5 w-3.5" checked={addAnother} onChange={e => setAddAnother(e.target.checked)} />
            Add another question after saving
          </label>
          <div className="flex items-center gap-2">
            <button onClick={onClose} disabled={saving}
              className="h-8 rounded-[8px] border border-[#D7DCE5] bg-white px-3.5 text-[12.5px] font-semibold text-body transition-colors hover:bg-row-hover disabled:opacity-50">
              Cancel
            </button>
            <button onClick={handleCreate} disabled={saving}
              className="inline-flex h-8 items-center gap-1.5 rounded-[8px] bg-brand-strong px-3.5 text-[12.5px] font-semibold text-white shadow-xs transition-colors hover:bg-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30 disabled:opacity-60">
              {saving ? <Loader2 size={13} className="animate-spin" /> : <FilePlus2 size={13} />}
              {saving ? 'Creating…' : 'Create Question'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateQuestionModal;
