"use client";

// Shared "Preview & print" flow.
//
// Two-step modal: pick a saved print layout from Dynamic Field Settings ▸
// Print Setting, then preview the caller's HTML wrapped in it and adjust the
// layout for this print only (session-only edits — nothing is written back).
//
// Every caller passes the SAME shape: the body HTML they want printed, a
// document title, and a heading. The picker + editor + preview are all
// shared, so the flow feels identical on every page that prints.

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Building2, Globe2, Loader2, Printer, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    fetchPrintSettings,
    type PrintSetting,
} from "@/app/lms/pages/dynamicfieldsettings/api/printSetting";
import { printDocumentHtml } from "@/app/lms/shared/print/printLayout";
import PrintLayoutEditor from "@/app/lms/component/live-print/PrintLayoutEditor";

export interface PrintPreviewModalProps {
    open: boolean;
    onClose: () => void;
    /** The caller's report body HTML — what goes inside the layout's letterhead. */
    bodyHtml: string;
    /** The <h1> above the body inside the print sheet. */
    heading?: string;
    /** Document title — the Save-as-PDF filename default. */
    title: string;
    /** Fires window.print() through the shared print pipeline with the layout
     *  the reader picked and edited. Called with `null` for the "print without
     *  a layout" fast path. */
    onPrint: (setting: Partial<PrintSetting> | null) => void;
}

type Step = "pick" | "edit";

const clientLabel = (setting: PrintSetting): string => {
    const c = setting.clientId;
    if (!c) return "Common (all clients)";
    return typeof c === "string" ? "Client layout" : (c.clientCompany || "Client");
};

const isCommon = (setting: PrintSetting): boolean => !setting.clientId;

/** Small deep-clone of the fields the editor touches, so the caller's saved
 *  setting is never mutated. */
const cloneEditable = (setting: PrintSetting): Partial<PrintSetting> => ({
    ...setting,
    headerData: { ...(setting.headerData || {}) },
    footerData: { ...(setting.footerData || {}) },
    pageSettings: { ...(setting.pageSettings || {}) },
    watermarkSettings: { ...(setting.watermarkSettings || {}) },
    footerSetting: { ...(setting.footerSetting || {}) },
    logoSettings: { ...(setting.logoSettings || {}) },
    signature: { ...(setting.signature || {}) },
    typography: { ...(setting.typography || {}) },
});

export default function PrintPreviewModal({
    open,
    onClose,
    bodyHtml,
    heading,
    title,
    onPrint,
}: PrintPreviewModalProps) {
    const [step, setStep] = useState<Step>("pick");
    const [draft, setDraft] = useState<Partial<PrintSetting> | null>(null);

    // Fresh state every reopen — no stale draft from a previous session.
    useEffect(() => {
        if (!open) return;
        setStep("pick");
        setDraft(null);
    }, [open]);

    const query = useQuery({
        queryKey: ["print-settings"],
        queryFn: fetchPrintSettings,
        enabled: open,
        // Keep the list warm across reopens; the Print Setting tab uses the
        // same key so a save there is picked up here without a refetch.
        staleTime: 30_000,
    });
    const list = query.data ?? [];

    const groups = useMemo(() => {
        const active = list.filter((s) => s.status !== "inactive");
        return {
            common: active.filter(isCommon),
            perClient: active.filter((s) => !isCommon(s)),
        };
    }, [list]);

    const pick = (setting: PrintSetting) => {
        setDraft(cloneEditable(setting));
        setStep("edit");
    };

    const patchDraft = (patcher: (prev: Partial<PrintSetting>) => Partial<PrintSetting>) =>
        setDraft((d) => (d ? patcher(d) : d));

    // The preview iframe renders exactly what will print — the print pipeline
    // itself produces the HTML, so the two stay in step by construction.
    const previewHtml = useMemo(() => {
        if (!draft) return "";
        return printDocumentHtml(
            [{ setting: draft, bodyHtml, heading }],
            { title, extraCss: "body{font-family:Arial,Helvetica,sans-serif}" }
        );
    }, [draft, bodyHtml, heading, title]);

    if (!open) return null;

    return (
        <AnimatePresence>
            <motion.div
                key="lp-print-scrim"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-modal flex items-center justify-center bg-ink-900/40 backdrop-blur-[2px] p-4"
                onClick={onClose}
            >
                <motion.div
                    key="lp-print-panel"
                    initial={{ scale: 0.96, y: 8 }}
                    animate={{ scale: 1, y: 0 }}
                    exit={{ scale: 0.96, y: 8 }}
                    onClick={(e) => e.stopPropagation()}
                    className="relative flex h-[92vh] w-[97vw] max-w-[1180px] flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl"
                >
                    <header className="flex shrink-0 items-center justify-between gap-3 border-b border-gray-200 px-5 py-3">
                        <div className="flex items-center gap-2">
                            {step === "edit" && (
                                <button
                                    type="button"
                                    onClick={() => setStep("pick")}
                                    title="Back to picker"
                                    className="flex h-7 w-7 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100"
                                >
                                    <ArrowLeft className="h-4 w-4" />
                                </button>
                            )}
                            <Printer className="h-4 w-4 text-indigo-600" />
                            <h3 className="text-[14px] font-semibold text-gray-900">
                                {step === "pick" ? "Choose a print layout" : "Preview & print"}
                            </h3>
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            aria-label="Close"
                            className="flex h-7 w-7 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </header>

                    {step === "pick" ? (
                        <PickerStep
                            loading={query.isPending}
                            errorMessage={query.isError ? (query.error as Error)?.message : ""}
                            groups={groups}
                            onSkip={() => { setDraft(null); onPrint(null); onClose(); }}
                            onPick={pick}
                        />
                    ) : (
                        <EditorStep
                            draft={draft}
                            previewHtml={previewHtml}
                            onPatch={patchDraft}
                            onPrint={() => { onPrint(draft); onClose(); }}
                        />
                    )}
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}

/* ── Picker step ─────────────────────────────────────────────────────────── */

function PickerStep({
    loading,
    errorMessage,
    groups,
    onSkip,
    onPick,
}: {
    loading: boolean;
    errorMessage: string;
    groups: { common: PrintSetting[]; perClient: PrintSetting[] };
    onSkip: () => void;
    onPick: (setting: PrintSetting) => void;
}) {
    const isEmpty = !loading && !errorMessage && groups.common.length === 0 && groups.perClient.length === 0;
    return (
        <>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
                <p className="mb-3 text-[12px] text-gray-600">
                    Pick a saved print layout from{" "}
                    <span className="font-semibold text-gray-800">Dynamic Field Settings ▸ Print Setting</span>.
                    You can adjust it on the next screen before printing — the edits are one-off, nothing is saved.
                </p>

                {loading ? (
                    <div className="flex h-40 items-center justify-center text-[12px] text-gray-500">
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading layouts…
                    </div>
                ) : errorMessage ? (
                    <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-700">
                        {errorMessage}
                    </div>
                ) : isEmpty ? (
                    <div className="rounded-md border border-dashed border-gray-300 bg-gray-50 px-4 py-6 text-center text-[12px] text-gray-600">
                        No print layouts have been configured yet.
                        <div className="mt-1 text-[11px] text-gray-500">
                            You can still print without a layout — click <span className="font-semibold">Print without a layout</span> below.
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        {[...groups.common, ...groups.perClient].map((s) => (
                            <LayoutCard key={s._id} setting={s} onPick={() => onPick(s)} />
                        ))}
                    </div>
                )}
            </div>
            <footer className="flex shrink-0 items-center justify-between gap-2 border-t border-gray-200 bg-gray-50 px-5 py-3">
                <button
                    type="button"
                    onClick={onSkip}
                    className="text-[11.5px] font-medium text-gray-600 hover:text-gray-800 hover:underline"
                >
                    Print without a layout
                </button>
                <span className="text-[10.5px] text-gray-400">
                    Manage layouts in Dynamic Field Settings ▸ Print Setting
                </span>
            </footer>
        </>
    );
}

function LayoutCard({ setting, onPick }: { setting: PrintSetting; onPick: () => void }) {
    const common = isCommon(setting);
    const page = setting.pageSettings;
    return (
        <button
            type="button"
            onClick={onPick}
            className="group flex items-start gap-3 rounded-lg border border-gray-200 bg-white p-3 text-left transition-colors hover:border-indigo-300 hover:bg-indigo-50/40"
        >
            <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${
                    common
                        ? "bg-orange-50 text-orange-600 border border-orange-100"
                        : "bg-gray-100 text-gray-600 border border-gray-200"
                }`}
            >
                {common ? <Globe2 className="h-4 w-4" /> : <Building2 className="h-4 w-4" />}
            </span>
            <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-semibold text-gray-900">
                    {clientLabel(setting)}
                </div>
                <div className="truncate text-[11px] text-gray-500">
                    {setting.title || setting.headerData?.text || "Untitled layout"}
                </div>
                <div className="mt-1 flex flex-wrap gap-1">
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600">
                        {page?.pageSize || "A4"} · {(page?.orientation || "portrait").replace(/^./, (c) => c.toUpperCase())}
                    </span>
                    {page?.showHeader !== false ? (
                        <span className="rounded-full bg-emerald-50 border border-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                            Header
                        </span>
                    ) : null}
                    {page?.showFooter !== false ? (
                        <span className="rounded-full bg-emerald-50 border border-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                            Footer
                        </span>
                    ) : null}
                    {setting.watermarkSettings?.showWatermark ? (
                        <span className="rounded-full bg-amber-50 border border-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                            Watermark
                        </span>
                    ) : null}
                </div>
            </div>
            <span className="mt-1 shrink-0 rounded-full border border-indigo-200 bg-white px-2 py-0.5 text-[10.5px] font-semibold text-indigo-700 opacity-0 transition-opacity group-hover:opacity-100">
                Use this
            </span>
        </button>
    );
}

/* ── Editor step ─────────────────────────────────────────────────────────── */

function EditorStep({
    draft,
    previewHtml,
    onPatch,
    onPrint,
}: {
    draft: Partial<PrintSetting> | null;
    previewHtml: string;
    onPatch: (patcher: (prev: Partial<PrintSetting>) => Partial<PrintSetting>) => void;
    onPrint: () => void;
}) {
    if (!draft) return null;
    return (
        <>
            <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px]">
                {/* Live preview — same HTML the print job will submit. */}
                <div className="min-h-0 border-b border-gray-200 bg-gray-100 p-3 lg:border-b-0 lg:border-r">
                    <iframe
                        srcDoc={previewHtml}
                        title="Print preview"
                        className="h-full w-full rounded-md border border-gray-300 bg-white shadow-inner"
                    />
                </div>

                {/* Full-featured editor — same field vocabulary as the Print
                    Setting add/edit page (header, footer, watermark, page &
                    margins, typography, images). Changes are session-only. */}
                <div className="min-h-0 border-t border-gray-200 lg:border-t-0">
                    <PrintLayoutEditor draft={draft} onChange={onPatch} />
                </div>
            </div>

            <footer className="flex shrink-0 items-center justify-between gap-2 border-t border-gray-200 bg-gray-50 px-5 py-3">
                <span className="text-[10.5px] text-gray-500">
                    Edits stay in this print — nothing is saved to the print setting.
                </span>
                <Button
                    onClick={onPrint}
                    className="h-9 bg-indigo-600 hover:bg-indigo-700 text-white text-[12.5px] font-semibold"
                >
                    <Printer className="h-4 w-4 mr-1.5" /> Print
                </Button>
            </footer>
        </>
    );
}
