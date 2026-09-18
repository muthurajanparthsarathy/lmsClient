'use client';

// Layout harness for the Schedule step's Availability section.
// ─────────────────────────────────────────────────────────────────────────────
// Mounts the REAL ScheduleStep with local state so the Availability rows and
// the date/time picker can be inspected — and measured — at desktop, tablet
// and phone widths without walking the whole exercise wizard (and without a
// copy of the markup that would drift from the component).
//
// The checks below are the acceptance criteria expressed as measurements:
// control groups aligned across rows, the AM/PM selector fully inside the
// picker, the footer inside the picker, and no horizontal overflow. Open
// /dev/schedule-step with `npm run dev` and press "Run layout checks", or
// call `window.__scheduleLayoutCheck()` from a driver.
//
// How to use it for a breakpoint sweep: set the browser to each width in
// turn (1440, 1366, 1024, 768, 375), reload, open a picker, and run the
// checks. The picker assertions must pass at every width; the row
// assertions apply to the Exercise Settings variant.
//
// The "Variant" button swaps in the Create Assessment sibling, which shares
// the picker dialog but keeps its own row markup — so on that variant only
// the picker assertions are meaningful.
//
// Dev-only: the route calls notFound() outside development and the auth gate
// treats /dev/* as public only when NODE_ENV !== 'production'.

import React, { useState } from 'react';
import { ScheduleStep } from '@/app/lms/component/ExerciseSettings/steps/ScheduleStep';
// The Create-Assessment sibling. Near-duplicate of the one above with a green
// palette; it shares the picker geometry, so the dialog checks below must hold
// for it too.
import { ScheduleStep as ScheduleStepGreen }
  from '@/app/lms/pages/courses/uploadcourseresources/components/youdo/assessments/ScheduleStep';

const INITIAL = {
  courseId: 'preview',
  schedule: {
    requiresAdminApproval: false,
    approvalScope: 'settings',
    startDate: { day: 3, month: 9, year: 2026, hour: 9, minute: 0 },
    endDate: { day: 4, month: 9, year: 2026, hour: 17, minute: 30 },
    cutOffEnabled: true,
    cutOffDate: { day: 5, month: 9, year: 2026, hour: 12, minute: 0 },
    remindGradeByEnabled: false,
    remindGradeBy: { day: 0, month: 0, year: 0, hour: 0, minute: 0 },
  },
};

export type LayoutCheck = { name: string; ok: boolean; detail: string };

/** Every assertion the fix has to hold, run against the live DOM. */
export function runLayoutChecks(): LayoutCheck[] {
  const out: LayoutCheck[] = [];
  const push = (name: string, ok: boolean, detail: string) => out.push({ name, ok, detail });
  const round = (n: number) => Math.round(n * 10) / 10;

  // Some embedded viewers paint the page through a CSS zoom/transform, which
  // scales every getBoundingClientRect() result. Rather than guess the factor,
  // measure the viewport with a `position: fixed; inset: 0` probe — its rect
  // is the viewport expressed in the SAME space every other rect is read in,
  // so containment comparisons are exact whatever the viewer does.
  const probe = document.createElement('div');
  probe.style.cssText = 'position:fixed;inset:0;pointer-events:none;visibility:hidden';
  document.body.appendChild(probe);
  const view = probe.getBoundingClientRect();
  probe.remove();

  const rect = (el: Element) => el.getBoundingClientRect();
  const vw = round(view.width);
  const vh = round(view.height);

  // Row checks apply to the Exercise Settings variant, which is the one the
  // Availability grid was rebuilt in. The Create Assessment variant keeps its
  // own row markup and is here only to exercise the shared picker dialog.
  const rows = Array.from(document.querySelectorAll<HTMLElement>('.sch-row'));
  if (rows.length) push('four Availability rows render', rows.length === 4, `${rows.length} rows`);

  // 1 + 2: Start and End labels, and their control groups, share a column.
  const heads = rows.map(r => r.querySelector<HTMLElement>('.sch-row-head'));
  const ctrls = rows.map(r => r.querySelector<HTMLElement>('.sch-row-ctrl'));
  if (heads[0] && heads[1] && ctrls[0] && ctrls[1]) {
    const hl = heads.map(h => round(h!.getBoundingClientRect().left));
    const cl = ctrls.map(c => round(c!.getBoundingClientRect().left));
    push('Start/End labels share a left edge', hl[0] === hl[1], `${hl[0]} vs ${hl[1]}`);
    push('all four control groups share a left edge',
      cl.every(x => x === cl[0]), cl.join(' / '));

    // The End row must not push its controls onto their own line: measure the
    // primary group's offset from the top of its OWN row and require Start
    // and End to match.
    const primaries = rows.map(r => r.querySelector<HTMLElement>('.sch-primary'));
    const offsetInRow = (i: number) => primaries[i]
      ? round(primaries[i]!.getBoundingClientRect().top - rows[i].getBoundingClientRect().top)
      : null;
    const startTop = offsetInRow(0);
    const endTop = offsetInRow(1);
    push('End controls sit on the row, not below it',
      startTop !== null && startTop === endTop,
      `start offset ${startTop}, end offset ${endTop}`);

    // Primary controls never break apart above the mobile breakpoint. The
    // children are centre-aligned at differing heights, so compare centres.
    primaries.forEach((p, i) => {
      if (!p) return;
      const kids = Array.from(p.children) as HTMLElement[];
      const mids = kids.map(k => {
        const r = k.getBoundingClientRect();
        return Math.round(r.top + r.height / 2);
      });
      const lines = new Set(mids).size;
      push(`row ${i + 1} primary controls on one line`,
        window.innerWidth <= 620 || lines === 1, `${lines} line(s), centres ${mids.join('/')}`);
    });

    // The calendar trigger is the last primary control; it should land on the
    // same x in every enabled row, which only holds if nothing before it has
    // a text-dependent width.
    const calX = rows
      .map(r => r.querySelector<HTMLElement>('.sch-cal-btn'))
      .filter(Boolean)
      .map(b => round(b!.getBoundingClientRect().left));
    push('calendar buttons share a column',
      window.innerWidth <= 620 || calX.every(x => x === calX[0]), calX.join(' / '));

    // And the chip groups start where the previous row's chips start.
    const chipX = rows
      .map(r => r.querySelector<HTMLElement>('.sch-chips'))
      .filter(Boolean)
      .map(c => round(c!.getBoundingClientRect().left));
    push('quick-duration chip groups share a left edge',
      chipX.length === 0 || chipX.every(x => x === chipX[0]), chipX.join(' / '));
  }

  // 4: nothing spills sideways.
  const doc = document.documentElement;
  push('no horizontal page overflow', doc.scrollWidth <= doc.clientWidth + 1,
    `scrollWidth ${doc.scrollWidth} vs client ${doc.clientWidth}`);

  // 3 + 6: the open picker contains its own controls.
  const pop = document.querySelector<HTMLElement>('.sch-pop');
  if (!pop) {
    push('picker open', false, 'open a picker before running the checks');
  } else if (pop.style.visibility === 'hidden') {
    push('picker positioned', false, 'still measuring — re-run on the next frame');
  } else {
    const pr = rect(pop);
    push('picker fits the viewport',
      pr.left >= view.left && pr.right <= view.right
      && pr.top >= view.top && pr.bottom <= view.bottom,
      `l${round(pr.left)} r${round(pr.right)} t${round(pr.top)} b${round(pr.bottom)} / view ${vw}x${vh}`);
    push('picker is not wider than the viewport',
      pr.width <= view.width, `${round(pr.width)} vs ${vw}`);

    const period = pop.querySelector<HTMLElement>('[role="group"][aria-label*="AM or PM"]');
    if (period) {
      const gr = rect(period);
      const segs = Array.from(period.querySelectorAll('button')) as HTMLElement[];
      push('AM/PM selector is fully inside the picker',
        gr.right <= pr.right && gr.left >= pr.left,
        `selector right ${round(gr.right)} vs dialog right ${round(pr.right)} (gap ${round(pr.right - gr.right)})`);
      push('AM/PM keeps padding from the dialog edge',
        pr.right - gr.right >= 10, `${round(pr.right - gr.right)}px`);
      push('PM segment right edge is inside the dialog',
        rect(segs[1]).right <= pr.right,
        `${round(rect(segs[1]).right)} <= ${round(pr.right)}`);
      // offsetWidth is layout px, immune to any viewer transform.
      push('AM/PM segments are >= 44px wide',
        segs.every(b => b.offsetWidth >= 44), segs.map(b => b.offsetWidth).join('/'));
    } else {
      push('AM/PM selector present in picker', false, 'not found');
    }

    const confirm = Array.from(pop.querySelectorAll('button'))
      .find(b => b.textContent?.trim() === 'Confirm');
    if (confirm) {
      const cr = rect(confirm);
      push('Confirm is inside the dialog and on screen',
        cr.right <= pr.right && cr.bottom <= pr.bottom && cr.bottom <= view.bottom,
        `confirm r${round(cr.right)} b${round(cr.bottom)} / dialog r${round(pr.right)} b${round(pr.bottom)}`);
      push('footer keeps padding below Confirm',
        pr.bottom - cr.bottom >= 8, `${round(pr.bottom - cr.bottom)}px`);
    }

    // Panes stack rather than clip once the viewport is narrow.
    const body = pop.querySelector<HTMLElement>('.sch-pop > div:nth-child(2)');
    const time = pop.querySelector<HTMLElement>('[aria-label*="AM or PM"]')?.closest('div')?.parentElement?.parentElement;
    if (body && time) {
      const stacked = getComputedStyle(body).flexDirection === 'column';
      push('panes stack only on narrow viewports', stacked === (window.innerWidth < 492),
        `stacked=${stacked} at innerWidth ${window.innerWidth}`);
    }

    // No child may cross the rounded dialog boundary.
    const strays = Array.from(pop.querySelectorAll<HTMLElement>('*')).filter(el => {
      const r = rect(el);
      if (!r.width && !r.height) return false;
      return r.right > pr.right + 0.5 || r.left < pr.left - 0.5
        || r.bottom > pr.bottom + 0.5 || r.top < pr.top - 0.5;
    });
    push('no picker child crosses the dialog boundary', strays.length === 0,
      strays.slice(0, 3).map(e => `${e.tagName}.${e.className}`).join(' | ') || 'none');
  }

  return out;
}

export default function SchedulePreview() {
  // `any` deliberately: the two ScheduleStep variants type `formData`
  // differently (loose `any` vs `FormDataType`), and one mock has to satisfy
  // both. Narrowing here would only add casts at the call sites.
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const [formData, setFormData] = useState<any>(INITIAL);
  const [validationErrors, setValidationErrors] = useState<any>({});
  const [results, setResults] = useState<LayoutCheck[] | null>(null);
  const [variant, setVariant] = useState<'orange' | 'green'>('orange');

  if (typeof window !== 'undefined') {
    (window as any).__scheduleLayoutCheck = runLayoutChecks;
  }
  /* eslint-enable @typescript-eslint/no-explicit-any */

  return (
    <div style={{ minHeight: '100vh', background: '#fff' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
        padding: '10px 16px', borderBottom: '1px solid #E4E7EC', fontSize: 12,
      }}>
        <strong>Schedule step — layout harness</strong>
        <span style={{ color: '#6B7280' }}>viewport {typeof window !== 'undefined' ? window.innerWidth : '?'}px</span>
        <button
          type="button"
          onClick={() => setResults(runLayoutChecks())}
          style={{ height: 28, padding: '0 12px', borderRadius: 6, border: '1px solid #D0D5DD', background: '#fff', cursor: 'pointer' }}
        >
          Run layout checks
        </button>
        <button
          type="button"
          id="variant-toggle"
          onClick={() => { setVariant(v => (v === 'orange' ? 'green' : 'orange')); setResults(null); }}
          style={{ height: 28, padding: '0 12px', borderRadius: 6, border: '1px solid #D0D5DD', background: '#fff', cursor: 'pointer' }}
        >
          Variant: {variant === 'orange' ? 'Exercise Settings' : 'Create Assessment'}
        </button>
        {results && (
          <span style={{ color: results.every(r => r.ok) ? '#0F9D58' : '#D92D20', fontWeight: 700 }}>
            {results.filter(r => r.ok).length}/{results.length} passed
          </span>
        )}
      </div>

      {variant === 'orange' ? (
        <ScheduleStep
          formData={formData}
          setFormData={setFormData}
          validationErrors={validationErrors}
          setValidationErrors={setValidationErrors}
          touchedFields={new Set<string>()}
          isEditing
        />
      ) : (
        <ScheduleStepGreen
          formData={formData}
          setFormData={setFormData}
          validationErrors={validationErrors}
          setValidationErrors={setValidationErrors}
          touchedFields={new Set<string>()}
          isEditing
        />
      )}

      {results && (
        <ul style={{ margin: 0, padding: '12px 16px 32px', listStyle: 'none', fontSize: 11.5, fontFamily: 'ui-monospace, monospace' }}>
          {results.map(r => (
            <li key={r.name} style={{ color: r.ok ? '#0F9D58' : '#D92D20', padding: '1px 0' }}>
              {r.ok ? 'PASS' : 'FAIL'} — {r.name} <span style={{ color: '#6B7280' }}>({r.detail})</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
