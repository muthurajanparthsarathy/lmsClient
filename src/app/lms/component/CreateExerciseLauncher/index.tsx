"use client"

// ─────────────────────────────────────────────────────────────────────────────
// Create Exercise — the entry experience, replicating exercise-creation-flow.html.
//
// Screens (matching the demo 1:1):
//   choose   → "How do you want to create this exercise?" — THREE tiles
//              (Use a template · Start from scratch · Describe it in one line)
//   template → "Pick a template" gallery (badge cards + Custom Template)
//   command  → "Describe the exercise" spotlight box
//   review   → "Review & create" / "Parsed configuration" with the summary
//              card and the 300px sidebar
//
// It holds NO business logic. Template and Command produce a seed document;
// Scratch produces null. Everything is handed to ExerciseSettings, where all
// validation, marks allocation, grading and saving run exactly as before.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { TEMPLATES, buildSeedDocument, templateSummary, type TemplateSpec } from './templates'
import { parseCommand, COMMAND_EXAMPLES, type ParseResult } from './commandParser'

type Phase = 'choose' | 'template' | 'command' | 'review'

/** The subset of a saved exercise document this launcher may read. Reserved
 *  for the duplicate/draft flows the demo routes through Template. */
export type SavedExercise = {
    _id?: string
    exerciseType?: string
    isGraded?: boolean
    stepsSaved?: string[]
    questions?: unknown[]
    exerciseInformation?: {
        exerciseId?: string
        exerciseName?: string
        exerciseLevel?: string
        totalDuration?: number
        totalMarks?: number
    }
    evaluationMethod?: { method?: string }
}

export interface CreateExerciseLauncherProps {
    /** Course-configured languages — fills the UI-less Programming fields. */
    configuredLanguages?: { coreProgram?: string[]; frontend?: string[]; database?: string[] }
    /** Reserved: the demo routes drafts/duplicates through the Template screen. */
    recentExercises?: SavedExercise[]
    /**
     * `seed` is null for Start from Scratch / Custom Template (wizard opens
     * blank). `label` names the origin for the wizard's app-bar pill —
     * undefined for scratch and command. Presentational only.
     */
    onProceed: (seed: Record<string, unknown> | null, label?: string) => void
    onClose: () => void
}

// The demo's design system verbatim, scoped under .xcl.
const CSS = `
.xcl{--orange:#EE6A22;--orange-dark:#D65A16;--orange-soft:#FFF2E8;--cream:#FDF4EA;
 --navy:#0F172A;--ink:#1D2433;--muted:#6B7280;--faint:#9CA3AF;
 --line:#E9E5E1;--soft:#F1EEEA;--wash:#FAF9F8;
 --green:#0F9D58;--green-bg:#ECFDF3;--green-line:#C7EBD5;
 --red:#D92D20;--red-bg:#FEF3F2;--red-line:#FBD3CE;
 --amber:#B54708;--amber-bg:#FFFAEB;--amber-line:#F5DFA8;
 --blue:#175CD3;--blue-bg:#EFF6FF;--blue-line:#CFE0FB;
 font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Inter,Roboto,"Helvetica Neue",Arial,sans-serif;
 font-size:14px;color:var(--ink);line-height:1.45}
.xcl *{box-sizing:border-box}
.xcl button{font:inherit;color:inherit}
.xcl :focus-visible{outline:2px solid var(--orange);outline-offset:2px;border-radius:4px}

.xcl-scrim{position:fixed;inset:0;z-index:60;display:flex;align-items:center;justify-content:center;
 padding:18px;background:rgba(29,36,51,.42)}
.xcl-app{width:min(1300px,96%);height:92vh;min-height:560px;background:#fff;border-radius:14px;
 border:1px solid #DFDAD4;box-shadow:0 14px 40px rgba(15,23,42,.14);
 display:flex;flex-direction:column;overflow:hidden}

.xcl-bar{display:flex;align-items:center;gap:11px;padding:11px 20px;border-bottom:1px solid var(--soft);
 background:#fff;flex:none}
.xcl-mark{width:27px;height:27px;border-radius:8px;background:linear-gradient(140deg,#F58634,#E15912);
 color:#fff;display:grid;place-items:center;font-size:13px;flex:none}
.xcl-crumb{font-size:11.5px;color:var(--faint)}
.xcl-crumb b{color:var(--ink);font-weight:600}
.xcl-x{margin-left:auto;width:30px;height:30px;border:none;background:transparent;border-radius:8px;
 color:var(--muted);font-size:15px;cursor:pointer;display:grid;place-items:center}
.xcl-x:hover{background:var(--wash);color:var(--ink)}

.xcl-body{flex:1;min-height:0;display:flex;flex-direction:column;overflow:hidden}

/* buttons */
.xcl-btn{font-size:12.4px;font-weight:600;border-radius:8px;border:1px solid var(--line);background:#fff;
 color:var(--ink);padding:0 13px;height:34px;display:inline-flex;align-items:center;justify-content:center;
 gap:6px;cursor:pointer;white-space:nowrap}
.xcl-btn:hover{background:var(--wash)}
.xcl-btn.pri{background:var(--navy);border-color:var(--navy);color:#fff}
.xcl-btn.pri:hover{background:#1E293B}
.xcl-btn.gh{border-color:transparent;color:var(--muted)}
.xcl-btn.gh:hover{color:var(--ink)}
.xcl-btn.sm{height:29px;font-size:11.5px;padding:0 10px}
.xcl-btn.lg{height:39px;font-size:13.2px;padding:0 18px}
.xcl-btn.full{width:100%}
.xcl-btn:disabled{opacity:.45;cursor:not-allowed}

/* pills */
.xcl-pill{display:inline-flex;align-items:center;gap:5px;height:23px;padding:0 9px;border-radius:999px;
 font-size:10.8px;font-weight:600;border:1px solid transparent;white-space:nowrap}
.xcl-pg{background:var(--green-bg);border-color:var(--green-line);color:#046C4E}
.xcl-pa{background:var(--amber-bg);border-color:var(--amber-line);color:var(--amber)}
.xcl-pn{background:#F4F4F5;border-color:#E7E5E4;color:#57606E}

/* notes */
.xcl-note{display:flex;gap:8px;align-items:flex-start;padding:8px 10px;border-radius:8px;font-size:11.4px;
 line-height:1.5;background:var(--blue-bg);border:1px solid var(--blue-line);color:#1B4DA8}
.xcl-note.warn{background:var(--amber-bg);border-color:var(--amber-line);color:var(--amber)}

/* inputs */
.xcl input[type=text]{font:inherit;font-size:12.6px;color:var(--ink);background:#fff;
 border:1px solid var(--line);border-radius:8px;height:34px;padding:0 11px;width:100%;
 transition:border-color .13s,box-shadow .13s}
.xcl input[type=text]:focus{border-color:var(--orange);box-shadow:0 0 0 3px rgba(238,106,34,.13);outline:none}
.xcl input[type=text][readonly]{background:var(--wash);color:var(--muted)}
.xcl-lbl{font-size:11px;font-weight:600;color:#4B5563;display:block;margin-bottom:5px}
.xcl-req{color:var(--orange)}
.xcl-g2{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.xcl-mut{color:var(--muted);font-size:11.5px}

/* ── chooser ── */
.xcl-choose{flex:1;min-height:0;overflow:auto;display:flex;flex-direction:column;justify-content:center;
 padding:40px 24px}
.xcl-choose-h{font-size:22px;font-weight:700;letter-spacing:-.5px;text-align:center;color:var(--ink)}
.xcl-choose-s{font-size:12.5px;color:var(--muted);text-align:center;margin-top:4px}
.xcl-entry{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;max-width:980px;margin:26px auto 0;width:100%}
.xcl-echoice{display:flex;flex-direction:column;align-items:flex-start;gap:12px;padding:14px;text-align:left;
 background:#fff;border:1px solid #DFDAD4;border-radius:12px;cursor:pointer;
 transition:border-color .14s,box-shadow .14s}
.xcl-echoice:hover{border-color:#CFC9C2;box-shadow:0 8px 18px rgba(15,23,42,.06)}
.xcl-eart{width:100%;height:122px;border-radius:10px;display:grid;place-items:center;overflow:hidden;
 background:linear-gradient(135deg,#FFF7F0,#F7FAFC);border:1px solid #F4E7DC;color:var(--orange-dark)}
.xcl-eart svg{width:100%;max-width:210px;height:110px;display:block}
.xcl-eart.template{background:radial-gradient(circle at 25% 20%,#FFE4D1 0 22%,transparent 23%),linear-gradient(135deg,#FFF7F0,#F8FBFF)}
.xcl-eart.scratch{background:radial-gradient(circle at 78% 18%,#DFF4FF 0 20%,transparent 21%),linear-gradient(135deg,#F8FBFF,#FFF8F1);color:#175CD3}
.xcl-eart.command{background:radial-gradient(circle at 26% 22%,#F2E7FF 0 21%,transparent 22%),linear-gradient(135deg,#FFF8F1,#F8FBFF);color:#7A35C7}
.xcl-econtent{display:flex;align-items:flex-start;gap:10px}
.xcl-eicon{width:34px;height:34px;border-radius:9px;background:var(--orange-soft);color:var(--orange-dark);
 display:grid;place-items:center;font-size:15px;flex:none}
.xcl-echoice h4{margin:0;font-size:14.5px;font-weight:700;color:var(--ink)}
.xcl-echoice p{margin:3px 0 0;font-size:11.5px;color:var(--muted);line-height:1.45}
.xcl-efoot{margin-top:auto;padding-top:10px;border-top:1px solid var(--soft);width:100%}
.xcl-footnote{margin-top:26px;text-align:center;font-size:11.5px;color:var(--muted)}

/* ── template gallery ── */
.xcl-pad{flex:1;min-height:0;overflow:auto;padding:18px 22px;display:flex;flex-direction:column;gap:13px}
.xcl-h18{font-size:18px;font-weight:700;letter-spacing:-.3px;color:var(--ink)}
.xcl-tgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(225px,1fr));gap:13px}
.xcl-tpl{display:flex;flex-direction:column;gap:9px;text-align:left;background:#fff;
 border:1px solid var(--line);border-radius:12px;padding:13px;cursor:pointer;
 transition:border-color .14s,box-shadow .14s}
.xcl-tpl:hover{border-color:#CFC9C2;box-shadow:0 8px 18px rgba(15,23,42,.08)}
.xcl-tart{height:88px;border-radius:10px;display:grid;place-items:center;overflow:hidden;color:#fff}
.xcl-tart svg{width:100%;max-width:190px;height:82px;display:block}
.xcl-ttop{display:flex;align-items:center;gap:9px}
.xcl-tbadge{width:28px;height:28px;border-radius:8px;display:grid;place-items:center;
 font-size:11px;font-weight:700;color:#fff;flex:none}
.xcl-tpl h4{margin:0;font-size:12.7px;font-weight:700;line-height:1.25;color:var(--ink)}
.xcl-who{font-size:10.2px;color:var(--faint)}
.xcl-tspec{font-size:11.2px;color:var(--muted);line-height:1.65}
.xcl-tspec b{color:var(--ink);font-weight:600}
.xcl-tfoot{margin-top:auto;padding-top:8px;border-top:1px solid var(--soft);font-size:10.4px;color:var(--faint);
 display:flex;align-items:center;gap:6px}
.xcl-golink{text-decoration:underline;cursor:pointer;font-weight:700;color:inherit;background:none;border:none;
 padding:0;font-size:inherit}

/* ── command ── */
.xcl-cmdwrap{flex:1;min-height:0;overflow:auto;display:flex;flex-direction:column;align-items:center;
 justify-content:center;padding:44px 26px;gap:16px}
.xcl-cmdhero{width:min(760px,100%);height:118px;border-radius:16px;display:grid;place-items:center;
 color:var(--orange-dark);background:radial-gradient(circle at 22% 22%,#FFE4D1 0 19%,transparent 20%),
 linear-gradient(135deg,#FFF8F1,#F8FBFF);border:1px solid #F4E7DC}
.xcl-cmdhero svg{width:100%;max-width:320px;height:106px;display:block}
.xcl-cmd-h{font-size:20px;font-weight:700;letter-spacing:-.4px;text-align:center;color:var(--ink)}
.xcl-cmd-s{font-size:12.5px;color:var(--muted);text-align:center;margin-top:3px}
.xcl-cmdbox{width:min(760px,100%);background:#fff;border:1px solid var(--line);border-radius:14px;
 box-shadow:0 10px 30px rgba(15,23,42,.1);overflow:hidden}
.xcl-cmdinput{display:flex;align-items:center;gap:10px;padding:12px 15px}
.xcl-cmdinput .glyph{color:var(--faint);font-size:15px;flex:none}
.xcl-cmdinput input{border:none;height:30px;font-size:15px;padding:0;width:100%;background:transparent;
 color:var(--ink)}
.xcl-cmdinput input:focus{outline:none;box-shadow:none;border:none}
.xcl-cmdchips{display:flex;flex-wrap:wrap;gap:7px;align-items:center;padding:11px 15px;min-height:48px;
 border-top:1px solid var(--soft)}
.xcl-cmdhelp{padding:10px 15px;background:#FCFBFA;border-top:1px solid var(--soft);font-size:11.3px;
 line-height:1.6;color:var(--muted)}
.xcl-cmdhelp .exs{display:flex;flex-wrap:wrap;gap:7px;margin-top:6px}
.xcl kbd{font-family:ui-monospace,Menlo,monospace;background:#F1EFEC;border:1px solid var(--line);
 border-bottom-width:2px;border-radius:5px;padding:1px 5px;font-size:10.5px}

/* ── review ── */
.xcl-two{flex:1;min-height:0;display:grid;grid-template-columns:1fr 300px}
.xcl-two-main{overflow:auto;padding:18px 22px;display:flex;flex-direction:column;gap:12px}
.xcl-side{border-left:1px solid var(--soft);background:#FCFBFA;padding:17px 15px;display:flex;
 flex-direction:column;gap:14px;overflow:auto}
.xcl-side-t{font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--faint)}
.xcl-eyebrow{font-size:10.5px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:var(--faint)}
.xcl-h19{font-size:19px;font-weight:700;letter-spacing:-.4px;color:var(--ink);margin-top:2px}
.xcl-rsec{border:1px solid var(--line);border-radius:11px;background:#fff;overflow:hidden}
.xcl-rsec-h{display:flex;align-items:center;gap:9px;padding:9px 13px;background:var(--wash);
 border-bottom:1px solid var(--soft)}
.xcl-rsec-t{font-size:11.2px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:#3F4756}
.xcl-rhero{display:flex;align-items:center;gap:13px;border:1px solid var(--line);border-radius:12px;
 padding:12px;background:linear-gradient(135deg,#FFF8F1,#F8FBFF)}
.xcl-rart{width:118px;height:78px;border-radius:10px;display:grid;place-items:center;flex:none;
 color:var(--orange-dark);background:#fff;border:1px solid #F4E7DC}
.xcl-rart svg{width:110px;height:70px;display:block}
.xcl-rhero h3{margin:0;font-size:15px;font-weight:700;color:var(--ink)}
.xcl-rhero p{margin:3px 0 0;font-size:11.5px;color:var(--muted);line-height:1.45}
.xcl-rrow{display:flex;align-items:center;gap:12px;padding:8px 13px;font-size:12.3px;
 border-bottom:1px solid var(--soft)}
.xcl-rico{width:24px;height:24px;border-radius:7px;display:grid;place-items:center;flex:none;
 color:var(--orange-dark);background:var(--orange-soft);font-size:12px}
.xcl-rrow:last-child{border-bottom:none}
.xcl-rrow .k{width:170px;flex:none;color:var(--muted)}
.xcl-rrow .v{font-weight:600;color:var(--ink)}
.xcl-rrow .act{margin-left:auto}
.xcl-ck{display:flex;gap:8px;align-items:flex-start;font-size:11.5px;color:#4B5563;padding:4px 0;line-height:1.4}
.xcl-ck .g{color:var(--green);font-weight:700;flex:none}
.xcl-ck .a{color:var(--amber);font-weight:700;flex:none}
.xcl-srow{display:flex;justify-content:space-between;gap:8px;font-size:12px;padding:5px 0;
 border-bottom:1px dashed #EBE7E2}
.xcl-srow span:first-child{color:var(--muted)}
.xcl-srow span:last-child{font-weight:600;color:var(--ink)}
.xcl-chips{display:flex;flex-wrap:wrap;gap:6px}

@media(max-width:1080px){
 .xcl-entry{grid-template-columns:repeat(2,1fr)}
 .xcl-two{grid-template-columns:1fr}
 .xcl-side{border-left:none;border-top:1px solid var(--soft)}
}
@media(max-width:620px){
 .xcl-entry,.xcl-g2{grid-template-columns:1fr}
 .xcl-rrow .k{width:110px}
}
@media(prefers-reduced-motion:reduce){.xcl *{transition:none!important}}
`

// Badge gradients by template flavour, matching the demo's b-prog/b-mcq/b-mix.
const badgeGradient = (t: TemplateSpec) =>
    t.type === 'MCQ' ? 'linear-gradient(140deg,#7C5CF0,#5B3FD1)'
        : t.type === 'Combined' ? 'linear-gradient(140deg,#20B2AA,#0E8F88)'
            : 'linear-gradient(140deg,#F58634,#E15912)'

const badgeGlyph = (t: TemplateSpec) =>
    t.type === 'MCQ' ? '☰' : t.type === 'Combined' ? '◆' : '</>'

const rowIcon = (label: string) => {
    if (/type/i.test(label)) return '▣'
    if (/question/i.test(label)) return '?'
    if (/mark|grade/i.test(label)) return '★'
    if (/duration|date|time/i.test(label)) return '◷'
    if (/attempt/i.test(label)) return '↻'
    if (/flow/i.test(label)) return '⇄'
    if (/evaluation/i.test(label)) return '✓'
    return '•'
}

// The four short spec lines on a gallery card, derived from the template.
const specLines = (t: TemplateSpec): React.ReactNode[] => {
    const lv = t.levels
    const progQ = t.strategy === 'general' ? (t.generalCount ?? 0)
        : lv ? lv.easy.q + lv.medium.q + lv.hard.q : 0
    const qTotal = t.type === 'MCQ' ? (t.mcqCount ?? 0)
        : progQ + (t.type === 'Combined' ? (t.mcqCount ?? 0) : 0)
    const total = t.type === 'Combined' ? (t.mcqMarks ?? 0) + (t.programmingMarks ?? 0) : (t.totalMarks ?? 0)
    const evalLabel = t.type === 'MCQ' ? 'Auto evaluated'
        : t.evaluation === 'testcase' ? 'Test case based'
            : t.evaluation === 'ai' ? 'AI based evaluation' : 'Manual evaluation'
    const flowLabel = t.flow === 'controlled' ? 'Controlled Flow' : 'Free Flow'
    const mix = lv && t.strategy !== 'general'
        ? `E${lv.easy.q} / M${lv.medium.q} / H${lv.hard.q}` : 'general config'
    return [
        <><b>{qTotal} questions</b> · {t.type === 'Combined' ? 'MCQ + Programming' : mix}</>,
        t.graded ? <><b>{total} marks</b> · {t.strategy === 'general' ? 'evenly split' : 'level-specific'}</>
            : <><b>Non-graded</b> · {t.attemptLimit ? `${t.attempts} attempts` : 'unlimited attempts'}</>,
        <>{evalLabel} · {flowLabel}</>,
        <>{t.attemptLimit ? `${t.attempts} attempt${t.attempts > 1 ? 's' : ''}` : 'Unlimited attempts'}{t.allRequired ? ' · all required' : ''}</>,
    ]
}

export default function CreateExerciseLauncher({
    configuredLanguages, onProceed, onClose,
}: CreateExerciseLauncherProps) {
    const [phase, setPhase] = useState<Phase>('choose')
    const [picked, setPicked] = useState<TemplateSpec | null>(null)
    const [parsed, setParsed] = useState<ParseResult | null>(null)
    const [command, setCommand] = useState('')
    const [name, setName] = useState('')
    const [busy, setBusy] = useState(false)
    const cmdRef = useRef<HTMLInputElement | null>(null)

    // Programming/Combined need selectedModule + selectedLanguages, which have
    // no UI in production and come from the course. Warn before the dead end.
    const languageList = useMemo(() => [
        ...(configuredLanguages?.coreProgram ?? []),
        ...(configuredLanguages?.frontend ?? []),
        ...(configuredLanguages?.database ?? []),
    ].filter(Boolean), [configuredLanguages])
    const hasLanguages = languageList.length > 0
    const needsLanguages = (t: TemplateSpec | null) =>
        Boolean(t && (t.type === 'Programming' || t.type === 'Combined') && !hasLanguages)

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [onClose])

    useEffect(() => { if (phase === 'command') cmdRef.current?.focus() }, [phase])

    const spec = picked ?? parsed?.spec ?? null

    const proceed = (payload: Record<string, unknown> | null, label?: string) => {
        setBusy(true)
        setTimeout(() => onProceed(payload, label), 0)
    }
    const proceedFromReview = () => {
        if (!spec) return
        proceed(
            buildSeedDocument(spec, { configuredLanguages, exerciseName: name.trim() }),
            picked ? picked.name : undefined,
        )
    }

    const runParse = (text?: string) => {
        const v = (text ?? command).trim()
        if (!v) return
        if (text != null) setCommand(text)
        const r = parseCommand(v)
        setParsed(r); setPicked(null)
        setName(v.split(',')[0].trim().replace(/\b\w/g, (c) => c.toUpperCase()).slice(0, 60))
        setPhase('review')
    }

    const glance = (t: TemplateSpec): Array<[string, string]> => {
        const rows = templateSummary(t)
        const find = (k: string) => rows.find(([a]) => a === k)?.[1]
        return ([
            ['Type', find('Exercise Type')],
            ['Questions', find('Questions')],
            ['Marks', t.graded ? find('Total Marks') : 'Non-graded'],
            ['Duration', find('Duration')],
            ['Attempts', find('Attempts')],
        ] as Array<[string, string | undefined]>)
            .filter((r): r is [string, string] => Boolean(r[1]))
    }

    const creationMethods = [
        {
            key: 'template',
            icon: '▦',
            title: 'Use a template',
            desc: 'Pick a ready configuration, review it, create. Fastest for a standard exercise.',
            foot: '~4 clicks · recommended',
        },
        {
            key: 'scratch',
            icon: '⬒',
            title: 'Start from scratch',
            desc: 'Step through all six sections and set every option yourself.',
            foot: 'Full control · guided',
        },
        {
            key: 'command',
            icon: '⌘',
            title: 'Describe it in one line',
            desc: 'Type it as a sentence and get a complete draft to review.',
            foot: 'Fastest for power users',
        },
    ] as const

    const renderMethodArt = (key: typeof creationMethods[number]['key']) => {
        if (key === 'template') {
            return (
                <svg viewBox="0 0 220 120" aria-hidden="true" focusable="false">
                    <rect x="34" y="24" width="152" height="78" rx="14" fill="currentColor" opacity=".08" />
                    <rect x="52" y="42" width="38" height="28" rx="8" fill="currentColor" opacity=".18" />
                    <rect x="102" y="44" width="64" height="8" rx="4" fill="currentColor" opacity=".28" />
                    <rect x="102" y="59" width="48" height="7" rx="3.5" fill="currentColor" opacity=".18" />
                    <rect x="52" y="80" width="114" height="8" rx="4" fill="currentColor" opacity=".16" />
                    <path d="M64 55h14M71 48v14" stroke="currentColor" strokeWidth="4" strokeLinecap="round" opacity=".8" />
                    <path d="M178 38l8 8 14-18" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" opacity=".55" />
                </svg>
            )
        }
        if (key === 'scratch') {
            return (
                <svg viewBox="0 0 220 120" aria-hidden="true" focusable="false">
                    <rect x="42" y="24" width="136" height="78" rx="14" fill="currentColor" opacity=".08" />
                    <circle cx="72" cy="48" r="12" fill="currentColor" opacity=".18" />
                    <rect x="96" y="42" width="62" height="8" rx="4" fill="currentColor" opacity=".3" />
                    <circle cx="72" cy="76" r="12" fill="currentColor" opacity=".12" />
                    <rect x="96" y="70" width="48" height="8" rx="4" fill="currentColor" opacity=".22" />
                    <path d="M70 48h4M72 46v4M68 76h8" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
                    <path d="M160 32l18 18-18 18" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" opacity=".5" />
                </svg>
            )
        }
        return (
            <svg viewBox="0 0 220 120" aria-hidden="true" focusable="false">
                <rect x="34" y="28" width="152" height="64" rx="18" fill="currentColor" opacity=".08" />
                <rect x="54" y="50" width="82" height="9" rx="4.5" fill="currentColor" opacity=".28" />
                <rect x="54" y="67" width="52" height="8" rx="4" fill="currentColor" opacity=".18" />
                <circle cx="160" cy="60" r="18" fill="currentColor" opacity=".16" />
                <path d="M154 60h12M160 54v12" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
                <path d="M48 32c8-12 22-14 34-7" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" opacity=".35" />
            </svg>
        )
    }

    const renderTemplateArt = (t: TemplateSpec) => {
        const isMcq = t.type === 'MCQ'
        const isCombined = t.type === 'Combined'
        return (
            <span className="xcl-tart" style={{ background: badgeGradient(t) }}>
                <svg viewBox="0 0 220 96" aria-hidden="true" focusable="false">
                    <rect x="34" y="20" width={isCombined ? 66 : 152} height="56" rx="12" fill="#fff" opacity=".22" />
                    {isCombined && <rect x="120" y="20" width="66" height="56" rx="12" fill="#fff" opacity=".18" />}
                    {isMcq ? (
                        <>
                            <path d="M60 42l7 7 14-18" fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" opacity=".9" />
                            <rect x="96" y="34" width="62" height="8" rx="4" fill="#fff" opacity=".66" />
                            <rect x="96" y="52" width="44" height="7" rx="3.5" fill="#fff" opacity=".42" />
                        </>
                    ) : isCombined ? (
                        <>
                            <path d="M56 48l6 6 12-16" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" opacity=".92" />
                            <path d="M140 40l-9 8 9 8M166 40l9 8-9 8" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" opacity=".88" />
                            <path d="M100 48h20" stroke="#fff" strokeWidth="4" strokeLinecap="round" opacity=".48" />
                        </>
                    ) : (
                        <>
                            <path d="M78 38l-12 10 12 10M142 38l12 10-12 10M123 32l-26 32" fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" opacity=".9" />
                            <rect x="62" y="68" width="42" height="6" rx="3" fill="#fff" opacity=".44" />
                            <rect x="116" y="68" width="42" height="6" rx="3" fill="#fff" opacity=".34" />
                        </>
                    )}
                </svg>
            </span>
        )
    }

    const renderCommandHero = () => (
        <svg viewBox="0 0 360 120" aria-hidden="true" focusable="false">
            <rect x="46" y="34" width="210" height="54" rx="18" fill="currentColor" opacity=".08" />
            <rect x="70" y="54" width="92" height="9" rx="4.5" fill="currentColor" opacity=".28" />
            <rect x="70" y="72" width="62" height="8" rx="4" fill="currentColor" opacity=".18" />
            <circle cx="240" cy="61" r="22" fill="currentColor" opacity=".14" />
            <path d="M233 61h14M240 54v14" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
            <rect x="272" y="39" width="44" height="14" rx="7" fill="currentColor" opacity=".16" />
            <rect x="272" y="67" width="34" height="14" rx="7" fill="currentColor" opacity=".12" />
        </svg>
    )

    return (
        <div className="xcl">
            <style>{CSS}</style>
            <div className="xcl-scrim" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
                <div className="xcl-app" role="dialog" aria-modal="true" aria-label="Create exercise">

                    <div className="xcl-bar">
                        <span className="xcl-mark">✦</span>
                        <span className="xcl-crumb">Exercises / <b>New exercise</b></span>
                        <button className="xcl-x" onClick={onClose} aria-label="Close">✕</button>
                    </div>

                    <div className="xcl-body">

                        {/* ── CHOOSER ─────────────────────────────────────────── */}
                        {phase === 'choose' && (
                            <div className="xcl-choose">
                                <div className="xcl-choose-h">How do you want to create this exercise?</div>
                                <div className="xcl-choose-s">
                                    All three routes produce the same exercise and expose the same settings.
                                    Pick whichever suits this one — you can switch at any point without losing your work.
                                </div>

                                <div className="xcl-entry" role="group" aria-label="Creation method">
                                    {creationMethods.map(({ key, icon, title, desc, foot }) => (
                                        <button key={key} className="xcl-echoice" disabled={busy}
                                            onClick={() => {
                                                if (key === 'scratch') { proceed(null); return }
                                                setPhase(key as Phase)
                                            }}>
                                            <span className={`xcl-eart ${key}`}>{renderMethodArt(key)}</span>
                                            <span className="xcl-econtent">
                                                <span className="xcl-eicon">{icon}</span>
                                                <span>
                                                    <h4>{title}</h4>
                                                    <p>{desc}</p>
                                                </span>
                                            </span>
                                            <span className="xcl-efoot">
                                                <span className="xcl-pill xcl-pn">{foot}</span>
                                            </span>
                                        </button>
                                    ))}
                                </div>

                                <div className="xcl-footnote">
                                    Continuing a draft or duplicating an existing exercise both land in the
                                    Template route with values pre-filled.
                                </div>
                            </div>
                        )}

                        {/* ── TEMPLATE GALLERY ────────────────────────────────── */}
                        {phase === 'template' && (
                            <div className="xcl-pad">
                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div className="xcl-h18">Pick a template</div>
                                        <div className="xcl-mut" style={{ marginTop: 3 }}>
                                            Each one carries a complete configuration — every setting pre-filled and valid.
                                        </div>
                                    </div>
                                    <button className="xcl-btn sm" onClick={() => setPhase('choose')}>← Back</button>
                                </div>

                                <div className="xcl-tgrid">
                                    {TEMPLATES.map((t) => (
                                        <button key={t.id} className="xcl-tpl" disabled={busy}
                                            onClick={() => { setPicked(t); setParsed(null); setName(''); setPhase('review') }}>
                                            {renderTemplateArt(t)}
                                            <span className="xcl-ttop">
                                                <span className="xcl-tbadge" style={{ background: badgeGradient(t) }}>{badgeGlyph(t)}</span>
                                                <span>
                                                    <h4>{t.name}</h4>
                                                    <span className="xcl-who">{t.who}</span>
                                                </span>
                                            </span>
                                            <span className="xcl-tspec">
                                                {specLines(t).map((l, i) => <span key={i} style={{ display: 'block' }}>{l}</span>)}
                                            </span>
                                            <span className="xcl-tfoot">
                                                {t.uses ? `Used ${t.uses} times` : 'Blank configuration'}
                                                {needsLanguages(t) && <span className="xcl-pill xcl-pa">⚠ needs language</span>}
                                            </span>
                                        </button>
                                    ))}

                                    {/* Custom Template — straight to the blank wizard, like the demo. */}
                                    <button className="xcl-tpl" disabled={busy} onClick={() => proceed(null)}>
                                        <span className="xcl-tart" style={{ background: 'linear-gradient(140deg,#94A3B8,#64748B)' }}>
                                            <svg viewBox="0 0 220 96" aria-hidden="true" focusable="false">
                                                <rect x="48" y="18" width="124" height="60" rx="13" fill="#fff" opacity=".18" />
                                                <path d="M86 48h48M110 24v48" stroke="#fff" strokeWidth="6" strokeLinecap="round" opacity=".88" />
                                                <rect x="58" y="76" width="104" height="7" rx="3.5" fill="#fff" opacity=".24" />
                                            </svg>
                                        </span>
                                        <span className="xcl-ttop">
                                            <span className="xcl-tbadge" style={{ background: 'linear-gradient(140deg,#94A3B8,#64748B)' }}>✎</span>
                                            <span>
                                                <h4>Custom Template</h4>
                                                <span className="xcl-who">Nothing pre-filled</span>
                                            </span>
                                        </span>
                                        <span className="xcl-tspec">
                                            <span style={{ display: 'block' }}>Opens the full configuration</span>
                                            <span style={{ display: 'block' }}>with every field at its default.</span>
                                            <span style={{ display: 'block' }}>Equivalent to the</span>
                                            <span style={{ display: 'block' }}>six-step flow.</span>
                                        </span>
                                        <span className="xcl-tfoot">Blank configuration</span>
                                    </button>
                                </div>

                                <div className="xcl-note">
                                    <span>ⓘ</span>
                                    <span>
                                        Nothing suitable?{' '}
                                        <button className="xcl-golink" onClick={() => proceed(null)}>
                                            Start from scratch in the wizard
                                        </button>
                                        {' '}— every option stays available there.
                                    </span>
                                </div>
                            </div>
                        )}

                        {/* ── COMMAND ─────────────────────────────────────────── */}
                        {phase === 'command' && (
                            <div className="xcl-cmdwrap">
                                <div className="xcl-cmdhero">{renderCommandHero()}</div>
                                <div>
                                    <div className="xcl-cmd-h">Describe the exercise</div>
                                    <div className="xcl-cmd-s">
                                        One line. Anything you don&apos;t mention uses a sensible default you can review.
                                    </div>
                                </div>

                                <div className="xcl-cmdbox">
                                    <div className="xcl-cmdinput">
                                        <span className="glyph">⌘</span>
                                        <input ref={cmdRef} type="text" value={command}
                                            onChange={(e) => setCommand(e.target.value)}
                                            onKeyDown={(e) => { if (e.key === 'Enter') runParse() }}
                                            placeholder="e.g. Programming test, 5 questions, 50 marks, 90 minutes, test case based"
                                            style={{ border: 'none', boxShadow: 'none' }} />
                                    </div>
                                    <div className="xcl-cmdchips">
                                        <span className="xcl-mut">Recognised —</span>
                                        {['type', 'questions', 'marks', 'duration', 'attempts', 'difficulty mix', 'evaluation', 'flow', 'graded']
                                            .map((c) => <span key={c} className="xcl-pill xcl-pn">{c}</span>)}
                                    </div>
                                    <div className="xcl-cmdhelp">
                                        Press <kbd>Enter</kbd> to parse. Try one of these:
                                        <span className="exs">
                                            {COMMAND_EXAMPLES.map((ex) => (
                                                <button key={ex} className="xcl-btn sm" onClick={() => runParse(ex)}>
                                                    {ex.length > 44 ? ex.slice(0, 44) + '…' : ex}
                                                </button>
                                            ))}
                                        </span>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', gap: 9, width: 'min(760px,100%)' }}>
                                    <button className="xcl-btn" onClick={() => setPhase('choose')}>← Back</button>
                                    <span style={{ marginLeft: 'auto' }} />
                                    <button className="xcl-btn pri lg" disabled={!command.trim() || busy}
                                        onClick={() => runParse()}>
                                        Parse &amp; review →
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* ── REVIEW ──────────────────────────────────────────── */}
                        {phase === 'review' && spec && (
                            <div className="xcl-two">
                                <div className="xcl-two-main">
                                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9 }}>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            {picked && <div className="xcl-eyebrow">Step 2 of 2</div>}
                                            <div className="xcl-h19">{picked ? 'Review & create' : 'Parsed configuration'}</div>
                                        </div>
                                        <button className="xcl-btn sm"
                                            onClick={() => setPhase(picked ? 'template' : 'command')}>
                                            ← {picked ? 'Change template' : 'Edit the sentence'}
                                        </button>
                                        <button className="xcl-btn sm gh" disabled={busy} onClick={proceedFromReview}>
                                            ⚙ Customize configuration
                                        </button>
                                    </div>

                                    <div className="xcl-rhero">
                                        <span className="xcl-rart">
                                            {picked ? renderTemplateArt(spec) : renderCommandHero()}
                                        </span>
                                        <span>
                                            <h3>{picked ? picked.name : 'Generated exercise draft'}</h3>
                                            <p>
                                                {picked
                                                    ? 'Template settings are ready. Review the values, then continue to add or customize questions.'
                                                    : 'Your sentence has been converted into a complete draft. Check the assumptions before continuing.'}
                                            </p>
                                        </span>
                                    </div>

                                    {parsed && (
                                        <div className="xcl-chips">
                                            {parsed.detected.map((d) => <span key={d} className="xcl-pill xcl-pg">✓ {d}</span>)}
                                            {parsed.assumed.map((a) => <span key={a} className="xcl-pill xcl-pa">assumed · {a}</span>)}
                                        </div>
                                    )}

                                    <div className="xcl-g2">
                                        <div>
                                            <label className="xcl-lbl" htmlFor="xcl-name">
                                                Exercise Name <span className="xcl-req">*</span>
                                            </label>
                                            <input id="xcl-name" type="text" value={name}
                                                onChange={(e) => setName(e.target.value)}
                                                placeholder="e.g. Java Fundamentals — Week 4" />
                                        </div>
                                        <div>
                                            <label className="xcl-lbl" htmlFor="xcl-skill">Skill Set</label>
                                            <input id="xcl-skill" type="text" readOnly
                                                value={languageList.join(', ') || 'Set on the course'}
                                                title="Configured on the course, not here" />
                                        </div>
                                    </div>

                                    <div className="xcl-rsec">
                                        <div className="xcl-rsec-h">
                                            <span className="xcl-rsec-t">Configuration summary</span>
                                            <span className="xcl-pill xcl-pn" style={{ marginLeft: 'auto' }}>
                                                {templateSummary(spec).length} settings
                                            </span>
                                        </div>
                                        {templateSummary(spec).map(([k, v]) => (
                                            <div className="xcl-rrow" key={k}>
                                                <span className="xcl-rico">{rowIcon(k)}</span>
                                                <span className="k">{k}</span>
                                                <span className="v">{v}</span>
                                                <span className="act">
                                                    <button className="xcl-btn sm gh" disabled={busy} onClick={proceedFromReview}>
                                                        Change
                                                    </button>
                                                </span>
                                            </div>
                                        ))}
                                    </div>

                                    {needsLanguages(spec) && (
                                        <div className="xcl-note warn">
                                            <span>⚠</span>
                                            <span>
                                                This course has no configured languages, which a {spec.type} exercise
                                                requires. You can continue, but saving is blocked until a module and
                                                language are set on the course.
                                            </span>
                                        </div>
                                    )}

                                    <div className="xcl-note">
                                        <span>ⓘ</span>
                                        <span>
                                            {parsed && spec.strategy !== 'general'
                                                ? 'Marks were auto-balanced across levels to match the total you gave. '
                                                : ''}
                                            Nothing is saved yet — the next screen is the full configuration, every
                                            field stays editable, and the usual validation runs before anything is created.
                                        </span>
                                    </div>
                                </div>

                                <aside className="xcl-side">
                                    <div>
                                        <div className="xcl-side-t">Ready to create</div>
                                        <div className="xcl-ck">
                                            <span className={name.trim() ? 'g' : 'a'}>{name.trim() ? '✓' : '⚠'}</span>
                                            <span>{name.trim() ? 'Exercise name entered' : 'Exercise name still needed'}</span>
                                        </div>
                                        <div className="xcl-ck">
                                            <span className="g">✓</span>
                                            <span>{picked ? 'Template configuration applied' : 'Configuration parsed'}</span>
                                        </div>
                                        <div className="xcl-ck">
                                            <span className={needsLanguages(spec) ? 'a' : 'g'}>
                                                {needsLanguages(spec) ? '⚠' : '✓'}
                                            </span>
                                            <span>{needsLanguages(spec) ? 'Course languages not configured' : 'Course setup complete'}</span>
                                        </div>
                                    </div>

                                    <div>
                                        <div className="xcl-side-t">At a glance</div>
                                        {glance(spec).map(([k, v]) => (
                                            <div className="xcl-srow" key={k}><span>{k}</span><span>{v}</span></div>
                                        ))}
                                    </div>

                                    <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
                                        <button className="xcl-btn pri lg full" disabled={busy} onClick={proceedFromReview}>
                                            {busy ? 'Opening…' : 'Create & add questions →'}
                                        </button>
                                        <button className="xcl-btn gh sm full" disabled={busy} onClick={proceedFromReview}>
                                            ⚙ Customize all configuration
                                        </button>
                                    </div>
                                </aside>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
