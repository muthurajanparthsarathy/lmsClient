"use client";

// Session-only version of the Print Setting add/edit form.
//
// Uses the same field vocabulary as Dynamic Field Settings ▸ Print Setting
// (header title / description / logos / footer / watermark / page & margins /
// typography), but writes into a local draft — no Cloudinary upload, no
// database write. Images picked here become data URLs that ride inside the
// draft and get inlined into the printed sheet.
//
// Shared component: dropped into any page's print flow via
// <PrintPreviewModal>. Callers pass only the data being previewed; every
// caller sees the same editor UI.

import React, { useRef, useState } from "react";
import { toast } from "react-hot-toast";
import { Image as ImageIcon, Trash2 } from "lucide-react";
import type { PrintSetting, TextStyle } from "@/app/lms/pages/dynamicfieldsettings/api/printSetting";

/** Which section of the form is on screen. */
export type EditorTab = "header" | "footer" | "watermark" | "page";

const TAB_LABEL: Record<EditorTab, string> = {
    header: "Header",
    footer: "Footer",
    watermark: "Watermark",
    page: "Page & margins",
};

const FONT_FAMILIES = [
    "Arial, sans-serif",
    "Inter, sans-serif",
    "Georgia, serif",
    "Times New Roman, serif",
    "Courier New, monospace",
];
const FONT_SIZES = ["10px", "11px", "12px", "14px", "16px", "18px", "20px", "24px", "28px"];
const FONT_WEIGHTS = [
    { value: "normal", label: "Regular" },
    { value: "500", label: "Medium" },
    { value: "600", label: "Semibold" },
    { value: "bold", label: "Bold" },
];
const WATERMARK_FONT_SIZES = ["24px", "32px", "40px", "48px", "64px", "80px", "96px", "120px", "160px"];
const WATERMARK_POSITIONS = ["center", "top", "bottom", "diagonal"] as const;
const MARGIN_SIDES = ["top", "right", "bottom", "left"] as const;
const ALIGNMENTS = ["left", "center", "right"] as const;

const readFileAsDataUrl = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result || ""));
        r.onerror = () => reject(r.error || new Error("read"));
        r.readAsDataURL(file);
    });

export default function PrintLayoutEditor({
    draft,
    onChange,
}: {
    draft: Partial<PrintSetting>;
    onChange: (patcher: (prev: Partial<PrintSetting>) => Partial<PrintSetting>) => void;
}) {
    const [tab, setTab] = useState<EditorTab>("header");
    return (
        <div className="flex h-full min-h-0 flex-col">
            <div className="flex shrink-0 gap-1 border-b border-gray-200 bg-gray-50 px-2 pt-2">
                {(Object.keys(TAB_LABEL) as EditorTab[]).map((key) => {
                    const active = tab === key;
                    return (
                        <button
                            key={key}
                            type="button"
                            onClick={() => setTab(key)}
                            className={`h-8 rounded-t-md px-3 text-[11.5px] font-semibold transition-colors ${
                                active
                                    ? "bg-white text-indigo-700 border border-b-white border-gray-200 -mb-px"
                                    : "text-gray-500 hover:text-gray-800"
                            }`}
                        >
                            {TAB_LABEL[key]}
                        </button>
                    );
                })}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 space-y-3">
                {tab === "header" ? <HeaderTab draft={draft} onChange={onChange} /> : null}
                {tab === "footer" ? <FooterTab draft={draft} onChange={onChange} /> : null}
                {tab === "watermark" ? <WatermarkTab draft={draft} onChange={onChange} /> : null}
                {tab === "page" ? <PageTab draft={draft} onChange={onChange} /> : null}
            </div>
        </div>
    );
}

/* ── Header tab ──────────────────────────────────────────────────────────── */

function HeaderTab({
    draft,
    onChange,
}: {
    draft: Partial<PrintSetting>;
    onChange: (p: (prev: Partial<PrintSetting>) => Partial<PrintSetting>) => void;
}) {
    const header = draft.headerData || {};
    const logos = draft.logoSettings || {};
    const page = draft.pageSettings || {};
    const typo = draft.typography || {};
    const showLogo = header.showLogo !== false;
    const pos = header.logoPosition || "left";
    const bothSides = pos === "both";
    const showLeft = pos !== "right";
    const showRight = pos === "right" || pos === "both";

    const patchHeader = (patch: Partial<NonNullable<PrintSetting["headerData"]>>) =>
        onChange((d) => ({ ...d, headerData: { ...d.headerData, ...patch } }));
    const patchLogos = (patch: Partial<NonNullable<PrintSetting["logoSettings"]>>) =>
        onChange((d) => ({ ...d, logoSettings: { ...d.logoSettings, ...patch } }));
    const patchTypo = (
        group: keyof NonNullable<PrintSetting["typography"]>,
        patch: Partial<TextStyle>,
    ) =>
        onChange((d) => ({
            ...d,
            typography: { ...d.typography, [group]: { ...d.typography?.[group], ...patch } },
        }));

    return (
        <>
            <Section title="Header">
                <Toggle
                    label="Show header"
                    checked={page.showHeader !== false}
                    onChange={(v) =>
                        onChange((d) => ({ ...d, pageSettings: { ...d.pageSettings, showHeader: v } }))
                    }
                />
                <Field label="Header title">
                    <input
                        type="text"
                        value={header.text ?? header.name ?? ""}
                        onChange={(e) => patchHeader({ text: e.target.value })}
                        className={inputCls}
                    />
                </Field>
                <Field label="Header description">
                    <textarea
                        rows={2}
                        value={header.description ?? header.address ?? ""}
                        onChange={(e) => patchHeader({ description: e.target.value })}
                        className={textareaCls}
                    />
                </Field>
                <Grid2>
                    <Field label="Header alignment">
                        <Segment
                            value={header.alignment || "left"}
                            options={ALIGNMENTS.map((a) => ({ value: a, label: a }))}
                            onChange={(v) => patchHeader({ alignment: v as "left" | "center" | "right" })}
                        />
                    </Field>
                    <Field label="Background color">
                        <ColorRow
                            value={header.background || "#FFFFFF"}
                            onChange={(v) => patchHeader({ background: v })}
                        />
                    </Field>
                </Grid2>
            </Section>

            <Section title="Header title style">
                <TypographyRow style={typo.headerData} onChange={(patch) => patchTypo("headerData", patch)} />
            </Section>

            <Section title="Header description style">
                <TypographyRow
                    style={typo.headerDescription}
                    onChange={(patch) => patchTypo("headerDescription", patch)}
                />
            </Section>

            <Section title="Logo">
                <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-medium text-gray-600">Show logo</span>
                    <YesNo value={showLogo} onChange={(v) => patchHeader({ showLogo: v })} />
                </div>
                {showLogo ? (
                    <>
                        <Grid2>
                            <Field label="Position">
                                <select
                                    value={pos}
                                    onChange={(e) =>
                                        patchHeader({ logoPosition: e.target.value as "left" | "right" | "both" })
                                    }
                                    className={selectCls}
                                >
                                    <option value="left">Left</option>
                                    <option value="right">Right</option>
                                    <option value="both">Both sides</option>
                                </select>
                            </Field>
                            <Field label="Placement">
                                <select
                                    value={header.logoPlacement || "corner"}
                                    onChange={(e) =>
                                        patchHeader({ logoPlacement: e.target.value as "corner" | "center" })
                                    }
                                    className={selectCls}
                                >
                                    <option value="corner">Corner — pinned to the page edge</option>
                                    <option value="center">Center — next to the text</option>
                                </select>
                            </Field>
                        </Grid2>
                        {bothSides ? (
                            <ImagePicker
                                label="Logo"
                                hint="Prints on both sides of the header"
                                url={logos.leftLogoUrl}
                                height={logos.leftLogoHeight ?? 44}
                                onHeight={(h) => patchLogos({ leftLogoHeight: h })}
                                onDataUrl={(u) => patchLogos({ leftLogoUrl: u })}
                            />
                        ) : (
                            <Grid2>
                                {showLeft ? (
                                    <ImagePicker
                                        label="Left logo"
                                        url={logos.leftLogoUrl}
                                        height={logos.leftLogoHeight ?? 44}
                                        onHeight={(h) => patchLogos({ leftLogoHeight: h })}
                                        onDataUrl={(u) => patchLogos({ leftLogoUrl: u })}
                                    />
                                ) : null}
                                {showRight ? (
                                    <ImagePicker
                                        label="Right logo"
                                        url={logos.rightLogoUrl}
                                        height={logos.rightLogoHeight ?? 44}
                                        onHeight={(h) => patchLogos({ rightLogoHeight: h })}
                                        onDataUrl={(u) => patchLogos({ rightLogoUrl: u })}
                                    />
                                ) : null}
                            </Grid2>
                        )}
                    </>
                ) : null}
            </Section>
        </>
    );
}

/* ── Footer tab ──────────────────────────────────────────────────────────── */

function FooterTab({
    draft,
    onChange,
}: {
    draft: Partial<PrintSetting>;
    onChange: (p: (prev: Partial<PrintSetting>) => Partial<PrintSetting>) => void;
}) {
    const page = draft.pageSettings || {};
    const footer = draft.footerData || {};
    const setting = draft.footerSetting || {};
    const signature = draft.signature || {};
    const typo = draft.typography || {};

    const patchFooter = (patch: Partial<NonNullable<PrintSetting["footerData"]>>) =>
        onChange((d) => ({ ...d, footerData: { ...d.footerData, ...patch } }));
    const patchSetting = (patch: Partial<NonNullable<PrintSetting["footerSetting"]>>) =>
        onChange((d) => ({ ...d, footerSetting: { ...d.footerSetting, ...patch } }));
    const patchSignature = (patch: Partial<NonNullable<PrintSetting["signature"]>>) =>
        onChange((d) => ({ ...d, signature: { ...d.signature, ...patch } }));

    return (
        <>
            <Section title="Footer">
                <Toggle
                    label="Show footer"
                    checked={page.showFooter !== false}
                    onChange={(v) =>
                        onChange((d) => ({ ...d, pageSettings: { ...d.pageSettings, showFooter: v } }))
                    }
                />
                <Field label="Footer text" hint="Tokens: {{date}} · {{page}} · {{totalPages}}">
                    <input
                        type="text"
                        value={footer.text ?? ""}
                        onChange={(e) => patchFooter({ text: e.target.value })}
                        className={inputCls}
                    />
                </Field>
                <Field label="Footer alignment">
                    <Segment
                        value={footer.alignment || "center"}
                        options={ALIGNMENTS.map((a) => ({ value: a, label: a }))}
                        onChange={(v) => patchFooter({ alignment: v as "left" | "center" | "right" })}
                    />
                </Field>
            </Section>

            <Section title="Footer text style">
                <TypographyRow
                    style={typo.footerData}
                    onChange={(patch) =>
                        onChange((d) => ({
                            ...d,
                            typography: { ...d.typography, footerData: { ...d.typography?.footerData, ...patch } },
                        }))
                    }
                />
            </Section>

            <Section title="Signature row">
                <div className="flex flex-wrap gap-2">
                    <Check
                        label="Signatory"
                        checked={!!setting.showSignatory}
                        onChange={(v) => patchSetting({ showSignatory: v })}
                    />
                    <Check
                        label="Date"
                        checked={!!setting.showDate}
                        onChange={(v) => patchSetting({ showDate: v })}
                    />
                    <Check
                        label="Seal"
                        checked={!!setting.showSeal}
                        onChange={(v) => patchSetting({ showSeal: v })}
                    />
                </div>
                {setting.showSignatory || setting.showSeal ? (
                    <Grid2>
                        {setting.showSignatory ? (
                            <ImagePicker
                                label="Signature"
                                hint="Prints above the signatory line"
                                url={signature.signatureUrl}
                                height={signature.signatureHeight ?? 36}
                                onHeight={(h) => patchSignature({ signatureHeight: h })}
                                onDataUrl={(u) => patchSignature({ signatureUrl: u })}
                            />
                        ) : null}
                        {setting.showSeal ? (
                            <ImagePicker
                                label="Seal / stamp"
                                hint="Prints in the middle of the signature row"
                                url={signature.sealUrl}
                                height={signature.sealHeight ?? 56}
                                onHeight={(h) => patchSignature({ sealHeight: h })}
                                onDataUrl={(u) => patchSignature({ sealUrl: u })}
                            />
                        ) : null}
                    </Grid2>
                ) : null}
            </Section>
        </>
    );
}

/* ── Watermark tab ───────────────────────────────────────────────────────── */

function WatermarkTab({
    draft,
    onChange,
}: {
    draft: Partial<PrintSetting>;
    onChange: (p: (prev: Partial<PrintSetting>) => Partial<PrintSetting>) => void;
}) {
    const mark = draft.watermarkSettings || {};
    const type = mark.type || "text";
    const patch = (p: Partial<NonNullable<PrintSetting["watermarkSettings"]>>) =>
        onChange((d) => ({ ...d, watermarkSettings: { ...d.watermarkSettings, ...p } }));
    return (
        <Section title="Watermark">
            <Toggle
                label="Enable watermark"
                checked={!!mark.showWatermark}
                onChange={(v) => patch({ showWatermark: v })}
            />
            {mark.showWatermark ? (
                <>
                    <Field label="Watermark type">
                        <Segment
                            value={type}
                            options={[
                                { value: "text", label: "Text" },
                                { value: "image", label: "Image" },
                            ]}
                            onChange={(v) => patch({ type: v as "text" | "image" })}
                        />
                    </Field>
                    {type === "text" ? (
                        <>
                            <Field label="Watermark text">
                                <input
                                    type="text"
                                    value={mark.text ?? ""}
                                    onChange={(e) => patch({ text: e.target.value })}
                                    className={inputCls}
                                />
                            </Field>
                            <Grid2>
                                <Field label="Font family">
                                    <select
                                        value={mark.fontFamily || FONT_FAMILIES[0]}
                                        onChange={(e) => patch({ fontFamily: e.target.value })}
                                        className={selectCls}
                                    >
                                        {FONT_FAMILIES.map((f) => (
                                            <option key={f} value={f}>
                                                {f.split(",")[0]}
                                            </option>
                                        ))}
                                    </select>
                                </Field>
                                <Field label="Font size">
                                    <select
                                        value={mark.fontSize || "64px"}
                                        onChange={(e) => patch({ fontSize: e.target.value })}
                                        className={selectCls}
                                    >
                                        {WATERMARK_FONT_SIZES.map((f) => (
                                            <option key={f} value={f}>
                                                {f}
                                            </option>
                                        ))}
                                    </select>
                                </Field>
                                <Field label="Font weight">
                                    <select
                                        value={mark.fontWeight || "normal"}
                                        onChange={(e) => patch({ fontWeight: e.target.value })}
                                        className={selectCls}
                                    >
                                        {FONT_WEIGHTS.map((f) => (
                                            <option key={f.value} value={f.value}>
                                                {f.label}
                                            </option>
                                        ))}
                                    </select>
                                </Field>
                                <Field label="Text colour">
                                    <ColorRow
                                        value={mark.color || "#9CA3AF"}
                                        onChange={(v) => patch({ color: v })}
                                    />
                                </Field>
                            </Grid2>
                        </>
                    ) : (
                        <>
                            <ImagePicker
                                label="Watermark image"
                                hint="Printed behind the page content"
                                url={mark.watermarkUrl}
                                onDataUrl={(u) => patch({ watermarkUrl: u })}
                            />
                            <Field label="Image width (px)">
                                <input
                                    type="number"
                                    min={16}
                                    max={2000}
                                    value={mark.imageWidth ?? 260}
                                    onChange={(e) => patch({ imageWidth: Number(e.target.value) })}
                                    className={inputCls}
                                />
                            </Field>
                        </>
                    )}
                    <Grid2>
                        <Slider
                            label="Opacity"
                            suffix="%"
                            min={0}
                            max={100}
                            value={mark.opacity ?? 10}
                            onChange={(v) => patch({ opacity: v })}
                        />
                        <Slider
                            label="Rotation"
                            suffix="°"
                            min={-180}
                            max={180}
                            value={mark.rotation ?? 0}
                            onChange={(v) => patch({ rotation: v })}
                        />
                    </Grid2>
                    <Field label="Position">
                        <select
                            value={mark.position || "center"}
                            onChange={(e) =>
                                patch({
                                    position: e.target.value as "center" | "top" | "bottom" | "diagonal",
                                })
                            }
                            className={selectCls}
                        >
                            {WATERMARK_POSITIONS.map((v) => (
                                <option key={v} value={v}>
                                    {v.replace(/^./, (c) => c.toUpperCase())}
                                </option>
                            ))}
                        </select>
                    </Field>
                </>
            ) : null}
        </Section>
    );
}

/* ── Page & margins tab ──────────────────────────────────────────────────── */

function PageTab({
    draft,
    onChange,
}: {
    draft: Partial<PrintSetting>;
    onChange: (p: (prev: Partial<PrintSetting>) => Partial<PrintSetting>) => void;
}) {
    const page = draft.pageSettings || {};
    const margins = page.margins || {};
    const patchPage = (patch: Partial<NonNullable<PrintSetting["pageSettings"]>>) =>
        onChange((d) => ({ ...d, pageSettings: { ...d.pageSettings, ...patch } }));
    return (
        <>
            <Section title="Paper">
                <Grid2>
                    <Field label="Size">
                        <select
                            value={page.pageSize || "A4"}
                            onChange={(e) =>
                                patchPage({
                                    pageSize: e.target.value as NonNullable<PrintSetting["pageSettings"]>["pageSize"],
                                })
                            }
                            className={selectCls}
                        >
                            <option value="A4">A4</option>
                            <option value="A3">A3</option>
                            <option value="Letter">Letter</option>
                        </select>
                    </Field>
                    <Field label="Orientation">
                        <Segment
                            value={page.orientation || "portrait"}
                            options={[
                                { value: "portrait", label: "Portrait" },
                                { value: "landscape", label: "Landscape" },
                            ]}
                            onChange={(v) =>
                                patchPage({
                                    orientation: v as NonNullable<PrintSetting["pageSettings"]>["orientation"],
                                })
                            }
                        />
                    </Field>
                </Grid2>
            </Section>

            <Section title="Margins (mm)">
                <div className="grid grid-cols-4 gap-2">
                    {MARGIN_SIDES.map((side) => (
                        <Field key={side} label={side[0].toUpperCase() + side.slice(1)}>
                            <input
                                type="number"
                                min={0}
                                max={100}
                                value={margins[side] ?? 12}
                                onChange={(e) => {
                                    const v = Math.max(0, Math.min(100, Number(e.target.value)));
                                    onChange((d) => ({
                                        ...d,
                                        pageSettings: {
                                            ...d.pageSettings,
                                            margins: { ...d.pageSettings?.margins, [side]: v },
                                        },
                                    }));
                                }}
                                className={inputCls}
                            />
                        </Field>
                    ))}
                </div>
            </Section>
        </>
    );
}

/* ── Reusable field UI ───────────────────────────────────────────────────── */

const inputCls =
    "h-8 w-full rounded-md border border-gray-300 bg-white px-2 text-[12.5px] outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15";
const textareaCls =
    "w-full rounded-md border border-gray-300 bg-white px-2 py-1 text-[12.5px] outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15";
const selectCls =
    "h-8 w-full rounded-md border border-gray-300 bg-white px-1.5 text-[12.5px] outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="rounded-md border border-gray-200 bg-white p-3">
            <div className="mb-2 text-[10.5px] font-semibold uppercase tracking-wider text-gray-500">
                {title}
            </div>
            <div className="space-y-2">{children}</div>
        </div>
    );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
    return (
        <label className="block">
            <span className="mb-1 block text-[11px] font-medium text-gray-600">{label}</span>
            {children}
            {hint ? <span className="mt-1 block text-[10px] text-gray-400">{hint}</span> : null}
        </label>
    );
}

function Grid2({ children }: { children: React.ReactNode }) {
    return <div className="grid grid-cols-2 gap-2">{children}</div>;
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
    return (
        <label className="flex cursor-pointer items-center gap-2 py-0.5">
            <input
                type="checkbox"
                checked={checked}
                onChange={(e) => onChange(e.target.checked)}
                className="size-3.5 accent-indigo-600"
            />
            <span className="text-[12px] text-gray-700">{label}</span>
        </label>
    );
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
    return (
        <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-gray-200 bg-white px-2 py-1 text-[11.5px] text-gray-700 hover:border-indigo-300">
            <input
                type="checkbox"
                checked={checked}
                onChange={(e) => onChange(e.target.checked)}
                className="size-3.5 accent-indigo-600"
            />
            {label}
        </label>
    );
}

function YesNo({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
    return (
        <div className="inline-flex overflow-hidden rounded-md border border-gray-300 text-[11px] font-semibold">
            {[
                { on: true, label: "Yes" },
                { on: false, label: "No" },
            ].map((opt) => (
                <button
                    key={opt.label}
                    type="button"
                    onClick={() => onChange(opt.on)}
                    className={`h-6 min-w-[38px] px-2 transition-colors ${
                        value === opt.on ? "bg-indigo-600 text-white" : "bg-white text-gray-700 hover:bg-gray-50"
                    }`}
                >
                    {opt.label}
                </button>
            ))}
        </div>
    );
}

function Segment<T extends string>({
    value,
    options,
    onChange,
}: {
    value: T;
    options: { value: T; label: string }[];
    onChange: (v: T) => void;
}) {
    return (
        <div className="inline-flex w-full overflow-hidden rounded-md border border-gray-300 bg-white">
            {options.map((o) => (
                <button
                    key={o.value}
                    type="button"
                    onClick={() => onChange(o.value)}
                    className={`flex-1 h-8 px-2 text-[11.5px] transition-colors capitalize ${
                        value === o.value ? "bg-indigo-600 text-white" : "text-gray-700 hover:bg-gray-50"
                    }`}
                >
                    {o.label}
                </button>
            ))}
        </div>
    );
}

function ColorRow({ value, onChange }: { value: string; onChange: (v: string) => void }) {
    return (
        <div className="flex h-8 items-center gap-2 rounded-md border border-gray-300 bg-white px-2">
            <input
                type="color"
                value={/^#[0-9a-f]{6}$/i.test(value) ? value : "#000000"}
                onChange={(e) => onChange(e.target.value)}
                className="h-5 w-6 cursor-pointer rounded border-0 bg-transparent p-0"
                aria-label="Pick a colour"
            />
            <input
                value={value}
                onChange={(e) => onChange(e.target.value)}
                spellCheck={false}
                className="h-6 flex-1 min-w-0 border-0 p-0 text-[12px] font-mono uppercase text-gray-800 outline-none"
            />
        </div>
    );
}

function Slider({
    label,
    suffix,
    min,
    max,
    value,
    onChange,
}: {
    label: string;
    suffix: string;
    min: number;
    max: number;
    value: number;
    onChange: (v: number) => void;
}) {
    return (
        <Field label={`${label} ${value}${suffix}`}>
            <input
                type="range"
                min={min}
                max={max}
                value={value}
                onChange={(e) => onChange(Number(e.target.value))}
                className="w-full accent-indigo-600"
            />
        </Field>
    );
}

function TypographyRow({
    style,
    onChange,
}: {
    style?: TextStyle;
    onChange: (patch: Partial<TextStyle>) => void;
}) {
    const sizeOptions = Array.from(new Set([...FONT_SIZES, style?.size || "14px"])).sort(
        (a, b) => parseFloat(a) - parseFloat(b),
    );
    return (
        <Grid2>
            <Field label="Font">
                <select
                    value={style?.family || FONT_FAMILIES[0]}
                    onChange={(e) => onChange({ family: e.target.value })}
                    className={selectCls}
                >
                    {FONT_FAMILIES.map((f) => (
                        <option key={f} value={f}>
                            {f.split(",")[0]}
                        </option>
                    ))}
                </select>
            </Field>
            <Field label="Size">
                <select
                    value={style?.size || "14px"}
                    onChange={(e) => onChange({ size: e.target.value })}
                    className={selectCls}
                >
                    {sizeOptions.map((s) => (
                        <option key={s} value={s}>
                            {s}
                        </option>
                    ))}
                </select>
            </Field>
            <Field label="Weight">
                <select
                    value={style?.weight || "normal"}
                    onChange={(e) => onChange({ weight: e.target.value })}
                    className={selectCls}
                >
                    {FONT_WEIGHTS.map((w) => (
                        <option key={w.value} value={w.value}>
                            {w.label}
                        </option>
                    ))}
                </select>
            </Field>
            <Field label="Colour">
                <ColorRow
                    value={style?.color || "#1F2937"}
                    onChange={(v) => onChange({ color: v })}
                />
            </Field>
        </Grid2>
    );
}

function ImagePicker({
    label,
    hint,
    url,
    height,
    onHeight,
    onDataUrl,
}: {
    label: string;
    hint?: string;
    url?: string;
    height?: number;
    onHeight?: (v: number) => void;
    onDataUrl: (dataUrl: string) => void;
}) {
    const [busy, setBusy] = useState(false);
    const inputRef = useRef<HTMLInputElement | null>(null);
    const onPick = async (file: File | null | undefined) => {
        if (!file) return;
        // Keep the payload light — a big letterhead crest as a data URL bloats
        // every printed page's HTML. 1 MB is roughly the print pipeline's
        // comfort zone (the print iframe reads it back at render time).
        if (file.size > 1_000_000) {
            toast.error("Use an image under 1 MB.");
            return;
        }
        setBusy(true);
        try {
            const url = await readFileAsDataUrl(file);
            onDataUrl(url);
        } catch {
            toast.error("Could not read that image.");
        } finally {
            setBusy(false);
            if (inputRef.current) inputRef.current.value = "";
        }
    };
    return (
        <div className="rounded-md border border-gray-200 bg-white p-2">
            <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                    <div className="text-[11.5px] font-semibold text-gray-800">{label}</div>
                    {hint ? <div className="text-[10px] text-gray-500">{hint}</div> : null}
                </div>
                {url ? (
                    <button
                        type="button"
                        onClick={() => onDataUrl("")}
                        className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[10.5px] font-semibold text-red-600 hover:bg-red-100"
                    >
                        <Trash2 className="size-3" /> Remove
                    </button>
                ) : null}
            </div>
            {url ? (
                <div className="mt-2 flex items-center gap-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src={url}
                        alt={label}
                        className="h-10 max-w-[60%] rounded border border-gray-200 bg-white object-contain p-0.5"
                    />
                </div>
            ) : null}
            <label className="mt-2 flex cursor-pointer items-center gap-1.5 text-[11px] text-indigo-700 hover:underline">
                <ImageIcon className="size-3.5" />
                {busy ? "Reading…" : url ? "Replace image" : "Choose an image"}
                <input
                    ref={inputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    onChange={(e) => onPick(e.target.files?.[0])}
                    className="hidden"
                />
            </label>
            {onHeight && url ? (
                <div className="mt-2">
                    <Field label="Printed height (px)">
                        <input
                            type="number"
                            min={8}
                            max={400}
                            value={height ?? 44}
                            onChange={(e) => onHeight(Number(e.target.value))}
                            className={inputCls}
                        />
                    </Field>
                </div>
            ) : null}
        </div>
    );
}
