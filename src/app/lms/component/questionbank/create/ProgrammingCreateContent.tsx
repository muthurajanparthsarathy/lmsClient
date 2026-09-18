'use client';

/**
 * Programming question authoring — content area of the Create Question modal.
 * Reference layout: single scrollable body, left content cards (~68%) +
 * sticky right configuration card (~32%). Field model matches the bank's
 * programming payload; examples map to sampleInput/sampleOutput (first) and
 * isSample test cases (rest).
 */

import React, { forwardRef, useImperativeHandle, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import {
  SectionCard, Label, ChipInput, DifficultySegmented, ProblemTypePicker,
  TopicsMultiSelect, RichTextLite, CharCount, FieldError, HelperText,
  inputCls, controlCls, textareaCls, plainTextOf,
  type DiffValue,
} from './createShared';

export interface CreateContentHandle {
  // files: optional image uploads keyed for the bank's multipart create
  // endpoint (question_0_image / question_0_option_<i>_image).
  submit: () => { ok: boolean; payload?: any; files?: { key: string; file: File }[] };
}

type SubType = 'core' | 'frontend' | 'database';

interface TestCaseDraft {
  id: number;
  input: string;
  expectedOutput: string;
  isHidden: boolean;
  explanation: string;
}

const SUBTYPES: { key: SubType; label: string }[] = [
  { key: 'core', label: 'Core Programming' },
  { key: 'frontend', label: 'Frontend' },
  { key: 'database', label: 'Database' },
];

const LANGS: Record<SubType, string[]> = {
  core: ['python', 'javascript', 'java', 'c', 'cpp'],
  frontend: ['javascript', 'typescript'],
  database: ['sql'],
};

const SUBTYPE_TO_QT: Record<SubType, string> = { core: 'programming', frontend: 'frontend', database: 'database' };

const TITLE_MAX = 150;
const DESC_MAX = 5000;
const CONSTRAINTS_MAX = 1000;

let seq = 1;
const nid = () => seq++;

const ProgrammingCreateContent = forwardRef<CreateContentHandle, { defaultSubType?: SubType }>(
  ({ defaultSubType = 'core' }, ref) => {
    const [subType, setSubType] = useState<SubType>(defaultSubType);
    const [title, setTitle] = useState('');
    const [descHtml, setDescHtml] = useState('');
    const [sampleQuery, setSampleQuery] = useState('');
    const [expectedResult, setExpectedResult] = useState('');
    const [constraintsText, setConstraintsText] = useState('');
    const [starterLang, setStarterLang] = useState(LANGS[defaultSubType][0]);
    const [starterCode, setStarterCode] = useState('');
    const [outputCode, setOutputCode] = useState('');
    // Test Case 1 is always the sample (same rule as the exercise form).
    const [testCases, setTestCases] = useState<TestCaseDraft[]>([
      { id: nid(), input: '', expectedOutput: '', isHidden: false, explanation: '' },
    ]);
    const [problemType, setProblemType] = useState<string | null>(null);
    const [difficulty, setDifficulty] = useState<DiffValue>('easy');
    const [topics, setTopics] = useState<string[]>([]);
    const [tags, setTags] = useState<string[]>([]);
    const [timeComplexity, setTimeComplexity] = useState('');
    const [spaceComplexity, setSpaceComplexity] = useState('');
    const [marks, setMarks] = useState('');
    const [errs, setErrs] = useState<Record<string, string>>({});

    const changeSubType = (s: SubType) => {
      setSubType(s);
      if (!LANGS[s].includes(starterLang)) setStarterLang(LANGS[s][0]);
    };

    const addTC = () => setTestCases(p => [...p, {
      id: nid(), input: '', expectedOutput: '', isHidden: false, explanation: '',
    }]);
    const patchTC = (id: number, patch: Partial<TestCaseDraft>) =>
      setTestCases(p => p.map(tc => (tc.id === id ? { ...tc, ...patch } : tc)));

    useImperativeHandle(ref, () => ({
      submit: () => {
        const e: Record<string, string> = {};
        const descText = plainTextOf(descHtml);
        if (!title.trim()) e.title = 'Title is required';
        else if (title.length > TITLE_MAX) e.title = `Keep the title under ${TITLE_MAX} characters`;
        if (!descText) e.description = 'Description is required';
        else if (descText.length > DESC_MAX) e.description = `Keep the description under ${DESC_MAX} characters`;
        if (constraintsText.length > CONSTRAINTS_MAX) e.constraints = `Keep constraints under ${CONSTRAINTS_MAX} characters`;
        if (!problemType) e.problemType = 'Pick a category';
        if (topics.length === 0) e.topics = 'Add at least one topic';
        if (marks.trim() !== '' && (Number.isNaN(Number(marks)) || Number(marks) < 0 || Number(marks) > 100)) e.marks = 'Marks must be between 0 and 100';
        // Same rule as the exercise form: at least one complete test case.
        if (subType === 'core' && !testCases.some(tc => tc.input.trim() && tc.expectedOutput.trim())) {
          e.testCases = 'At least one test case with input & output is required';
        }
        setErrs(e);
        if (Object.keys(e).length > 0) return { ok: false };

        const payload: any = {
          questionCategory: 'Programming',
          questionType: SUBTYPE_TO_QT[subType],
          title: title.trim(),
          description: descHtml,
          difficulty,
          constraints: constraintsText.split('\n').map(c => c.trim()).filter(Boolean),
          isActive: true,
          source: 'scratch-manual',
          problemType: problemType || undefined,
          topics,
          tags,
          timeComplexity: timeComplexity.trim() || undefined,
          spaceComplexity: spaceComplexity.trim() || undefined,
        };
        if (marks.trim() !== '') payload.score = Number(marks);

        if (subType === 'database') {
          payload.sampleQuery = sampleQuery;
          payload.expectedResult = expectedResult;
        }
        if (subType !== 'database' && starterCode.trim()) {
          payload.solutions = { startedCode: starterCode, functionName: '', language: starterLang };
        }
        if (subType !== 'database' && outputCode.trim()) {
          payload.outputCode = outputCode;
        }
        if (subType !== 'database') {
          // Test Case 1 is the sample; it also fills sampleInput/sampleOutput
          // for bank previews. Everything ships in testCases so questions
          // survive the bank → exercise import intact.
          const filledTCs = testCases.filter(tc => tc.input.trim() || tc.expectedOutput.trim());
          if (filledTCs.length > 0) {
            payload.testCases = filledTCs.map((tc, i) => ({
              input: tc.input, expectedOutput: tc.expectedOutput,
              isSample: i === 0, isHidden: i === 0 ? false : tc.isHidden,
              ...(tc.explanation.trim() ? { explanation: tc.explanation.trim() } : {}),
            }));
            if (subType === 'core') {
              payload.sampleInput = filledTCs[0].input;
              payload.sampleOutput = filledTCs[0].expectedOutput;
            }
          }
        }
        return { ok: true, payload };
      },
    }), [subType, title, descHtml, sampleQuery, expectedResult, constraintsText,
         starterLang, starterCode, outputCode, testCases, problemType, difficulty,
         topics, tags, timeComplexity, spaceComplexity, marks]);

    return (
      <div className="flex min-h-0 flex-1">
        {/* ── Content column (~68%) — own scroll ── */}
        <div className="min-w-0 flex-1 space-y-4 overflow-y-auto p-5">
          <SectionCard title="Question Title" required>
            <input className={inputCls} maxLength={TITLE_MAX + 20} value={title}
              placeholder="Enter a clear and concise question title..."
              onChange={e => setTitle(e.target.value)} />
            <CharCount value={title} max={TITLE_MAX} />
            <FieldError msg={errs.title} />
          </SectionCard>

          <SectionCard title="Question Description" required>
            <RichTextLite placeholder="Write the full question description here..." minHeight={220}
              onChange={setDescHtml} />
            <CharCount value={plainTextOf(descHtml)} max={DESC_MAX} />
            <FieldError msg={errs.description} />
          </SectionCard>

          {subType !== 'database' && (
            <section>
              <div className="mb-2">
                <h3 className="flex items-center gap-1 text-[13.5px] font-semibold uppercase tracking-wide text-heading">
                  Test Cases {subType === 'core' && <span className="text-red-500">*</span>}
                </h3>
                <p className="mt-0.5 text-[11.5px] text-subtle">Test Case 1 is the sample. Add hidden cases for grading.</p>
              </div>
              <div className="space-y-3">
                {testCases.map((tc, i) => (
                  <div key={tc.id} className="rounded-[12px] border border-[#E8EAF2] p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <span className={`inline-flex h-6 items-center rounded-full px-2.5 text-[11.5px] font-semibold ${
                        i === 0 ? 'bg-brand-wash text-brand-strong' : 'bg-[#F3F4F8] text-[#4B5563]'}`}>
                        Test Case {i + 1}{i === 0 && ' · Sample'}
                      </span>
                      <div className="flex items-center gap-3">
                        {i > 0 && (
                          <label className="flex items-center gap-1.5 text-[11.5px] text-subtle">
                            <input type="checkbox" checked={tc.isHidden} onChange={e => patchTC(tc.id, { isHidden: e.target.checked })} /> Hidden
                          </label>
                        )}
                        {testCases.length > 1 && (
                          <button type="button" onClick={() => setTestCases(p => p.filter(x => x.id !== tc.id))}
                            className="rounded-md p-1 text-faint transition-colors hover:bg-rose-50 hover:text-rose-500" aria-label="Remove test case">
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-heading">
                          Input <span className="font-normal normal-case text-subtle">(click Enter to give multiple inputs)</span>
                        </div>
                        <textarea className={textareaCls} rows={3} value={tc.input}
                          placeholder="stdin..." onChange={e => patchTC(tc.id, { input: e.target.value })} />
                      </div>
                      <div>
                        <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-heading">Expected Output</div>
                        <textarea className={textareaCls} rows={3} value={tc.expectedOutput}
                          placeholder="expected stdout..." onChange={e => patchTC(tc.id, { expectedOutput: e.target.value })} />
                      </div>
                    </div>
                    <div className="mt-3">
                      <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-heading">
                        Explanation <span className="font-normal normal-case text-subtle">(optional)</span>
                      </div>
                      <input className={controlCls} value={tc.explanation}
                        placeholder={`Test Case ${i + 1}`} onChange={e => patchTC(tc.id, { explanation: e.target.value })} />
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-2.5 flex justify-end">
                <button type="button" onClick={addTC}
                  className="inline-flex h-8 items-center gap-1.5 rounded-[10px] border border-emerald-200 bg-emerald-50 px-2.5 text-[12px] font-semibold text-emerald-700 transition-colors hover:bg-emerald-100">
                  <Plus size={13} /> Add Test Case
                </button>
              </div>
              <FieldError msg={errs.testCases} />
            </section>
          )}

          {subType === 'database' && (
            <SectionCard title="Query & Result" optional>
              <div className="space-y-4">
                <div>
                  <Label>Sample Query</Label>
                  <textarea className={textareaCls} rows={3} value={sampleQuery}
                    placeholder="SELECT ..." onChange={e => setSampleQuery(e.target.value)} />
                </div>
                <div>
                  <Label>Expected Result</Label>
                  <textarea className={textareaCls} rows={3} value={expectedResult}
                    placeholder="Expected result set..." onChange={e => setExpectedResult(e.target.value)} />
                </div>
              </div>
            </SectionCard>
          )}

          <SectionCard title="Constraints" optional>
            <textarea className={textareaCls} rows={3} value={constraintsText}
              placeholder="Enter constraints for the question..."
              onChange={e => setConstraintsText(e.target.value)} />
            <CharCount value={constraintsText} max={CONSTRAINTS_MAX} />
            <HelperText>One constraint per line</HelperText>
            <FieldError msg={errs.constraints} />
          </SectionCard>

          {subType !== 'database' && (
            <SectionCard title="Starter Code" optional
              action={
                <select
                  className="h-8 rounded-[10px] border border-[#E5E7EB] bg-white px-2.5 text-[12px] text-body focus:outline-none focus:border-brand"
                  value={starterLang} onChange={e => setStarterLang(e.target.value)}>
                  {LANGS[subType].map(l => <option key={l} value={l}>{l.charAt(0).toUpperCase() + l.slice(1)}</option>)}
                </select>
              }>
              <div className="flex overflow-hidden rounded-[10px] border border-[#E5E7EB] bg-[#F8FAFC] focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/15 transition-colors">
                <div className="select-none border-r border-[#EEF0F5] bg-white px-2.5 py-2.5 text-right font-mono text-[11px] leading-[19px] text-faint">
                  {Array.from({ length: Math.max(6, starterCode.split('\n').length) }, (_, i) => (
                    <div key={i}>{i + 1}</div>
                  ))}
                </div>
                <textarea
                  className="min-h-[120px] w-full resize-y bg-transparent px-3 py-2.5 font-mono text-[12.5px] leading-[19px] text-body placeholder:text-faint focus:outline-none"
                  spellCheck={false} value={starterCode}
                  placeholder={'# Write starter code here (optional)...'}
                  onChange={e => setStarterCode(e.target.value)} />
              </div>
            </SectionCard>
          )}

          {subType !== 'database' && (
            <SectionCard title="Output Code" optional>
              <div className="flex overflow-hidden rounded-[10px] border border-[#E5E7EB] bg-[#F8FAFC] focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/15 transition-colors">
                <div className="select-none border-r border-[#EEF0F5] bg-white px-2.5 py-2.5 text-right font-mono text-[11px] leading-[19px] text-faint">
                  {Array.from({ length: Math.max(6, outputCode.split('\n').length) }, (_, i) => (
                    <div key={i}>{i + 1}</div>
                  ))}
                </div>
                <textarea
                  className="min-h-[120px] w-full resize-y bg-transparent px-3 py-2.5 font-mono text-[12.5px] leading-[19px] text-body placeholder:text-faint focus:outline-none"
                  spellCheck={false} value={outputCode}
                  placeholder={'# Model solution / answer code (optional)...'}
                  onChange={e => setOutputCode(e.target.value)} />
              </div>
            </SectionCard>
          )}

        </div>

        {/* ── Configuration rail (~32%) — own scroll ── */}
        <div className="w-[31%] min-w-[300px] shrink-0 overflow-y-auto border-l border-[#E8EAF2] p-5">
          <div className="mb-5">
            <h4 className="mb-2 text-[13px] font-semibold text-heading">Module</h4>
            <select className={controlCls} value={subType}
              onChange={e => changeSubType(e.target.value as SubType)}>
              {SUBTYPES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
          </div>

          <div className="mb-5">
            <h4 className="mb-2.5 flex items-center gap-1 text-[13px] font-semibold text-heading">Category <span className="text-red-500">*</span></h4>
            <ProblemTypePicker value={problemType} onChange={setProblemType} />
            <FieldError msg={errs.problemType} />
          </div>

          <div className="mb-5">
            <h4 className="mb-2.5 flex items-center gap-1 text-[13px] font-semibold text-heading">Difficulty Level <span className="text-red-500">*</span></h4>
            <DifficultySegmented value={difficulty} onChange={setDifficulty} />
          </div>

          <div className="mb-5">
            <h4 className="mb-2.5 flex items-center gap-1 text-[13px] font-semibold text-heading">Topics <span className="text-red-500">*</span></h4>
            <TopicsMultiSelect values={topics} onChange={setTopics} placeholder="Select topics" />
            <HelperText>You can select multiple topics</HelperText>
            <FieldError msg={errs.topics} />
          </div>

          <div className="mb-5">
            <h4 className="mb-2.5 text-[13px] font-semibold text-heading">Tags <span className="text-[11px] font-normal text-subtle">(Optional)</span></h4>
            <ChipInput values={tags} onChange={setTags} placeholder="Add tags and press Enter" />
            <HelperText>Press Enter to add multiple tags</HelperText>
          </div>

          <div className="mb-5 grid grid-cols-2 gap-3">
            <div>
              <h4 className="mb-2.5 text-[13px] font-semibold leading-tight text-heading">Time Complexity <span className="block text-[11px] font-normal text-subtle">(Optional)</span></h4>
              <input className={controlCls} value={timeComplexity} placeholder="e.g., O(n log n)"
                onChange={e => setTimeComplexity(e.target.value)} />
            </div>
            <div>
              <h4 className="mb-2.5 text-[13px] font-semibold leading-tight text-heading">Space Complexity <span className="block text-[11px] font-normal text-subtle">(Optional)</span></h4>
              <input className={controlCls} value={spaceComplexity} placeholder="e.g., O(1), O(n)"
                onChange={e => setSpaceComplexity(e.target.value)} />
            </div>
          </div>

          <div>
            <h4 className="mb-2.5 text-[13px] font-semibold text-heading">Marks <span className="text-[11px] font-normal text-subtle">(Optional)</span></h4>
            <input type="number" min={0} max={100} className={controlCls} value={marks} placeholder="Enter marks"
              onChange={e => setMarks(e.target.value)} />
            <HelperText>Total marks for this question</HelperText>
            <FieldError msg={errs.marks} />
          </div>
        </div>
      </div>
    );
  });

ProgrammingCreateContent.displayName = 'ProgrammingCreateContent';
export default ProgrammingCreateContent;
