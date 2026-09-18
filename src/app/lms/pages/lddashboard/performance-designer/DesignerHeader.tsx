"use client";

/**
 * Modal header: title + subtitle, the live-preview pill, the Download Report
 * dropdown (PDF / Excel — the container's existing export functions) and
 * close. Nothing else, on purpose.
 */

import React from "react";
import { ChevronDown, Download, FileSpreadsheet, FileText, Loader2, X } from "lucide-react";

export function DesignerHeader({
    busy,
    canDownload,
    downloadOpen,
    onToggleDownload,
    downloadRef,
    onExcel,
    onPdf,
    onClose,
}: {
    busy: "" | "xlsx" | "pdf";
    canDownload: boolean;
    downloadOpen: boolean;
    onToggleDownload: () => void;
    downloadRef: React.RefObject<HTMLDivElement | null>;
    onExcel: () => void;
    onPdf: () => void;
    onClose: () => void;
}) {
    return (
        <header className="flex h-[62px] flex-shrink-0 items-center gap-4 border-b border-hairline bg-surface px-6">
            <div className="min-w-0">
                <h2 className="truncate text-[19px] font-bold leading-tight tracking-[-0.015em] text-heading">Create Performance Report</h2>
                <p className="mt-0.5 truncate text-[11.5px] text-subtle">
                    Build a report around learner progress, pedagogy stages, and industry readiness
                </p>
            </div>

            <span className="ml-auto hidden items-center gap-1.5 rounded-full border border-hairline bg-surface-sunken/60 px-2.5 py-1 text-[10.5px] font-medium text-subtle md:inline-flex">
                <span className="relative inline-flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success-500 opacity-60" aria-hidden />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-success-500" aria-hidden />
                </span>
                Live preview updates as you edit
            </span>

            <div ref={downloadRef} className="relative ml-2">
                <button
                    type="button"
                    onClick={onToggleDownload}
                    disabled={!!busy || !canDownload}
                    aria-haspopup="menu"
                    aria-expanded={downloadOpen}
                    className="inline-flex h-9 items-center gap-2 rounded-control bg-brand-500 px-3.5 text-[12.5px] font-semibold text-white transition-colors hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
                >
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Download className="h-4 w-4" aria-hidden />}
                    {busy === "xlsx" ? "Preparing Excel…" : busy === "pdf" ? "Preparing PDF…" : "Download Report"}
                    <ChevronDown className={`h-3.5 w-3.5 transition-transform ${downloadOpen ? "rotate-180" : ""}`} aria-hidden />
                </button>
                {downloadOpen ? (
                    <div role="menu" className="absolute right-0 top-[calc(100%+6px)] z-20 w-48 overflow-hidden rounded-control border border-hairline bg-surface shadow-sm">
                        <button
                            type="button"
                            role="menuitem"
                            onClick={onPdf}
                            disabled={!!busy}
                            className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-[12px] font-medium text-body transition-colors hover:bg-row-hover disabled:opacity-50"
                        >
                            <FileText className="h-4 w-4 text-danger-500" aria-hidden /> Download PDF
                        </button>
                        <button
                            type="button"
                            role="menuitem"
                            onClick={onExcel}
                            disabled={!!busy}
                            className="flex w-full items-center gap-2.5 border-t border-hairline px-3 py-2.5 text-left text-[12px] font-medium text-body transition-colors hover:bg-row-hover disabled:opacity-50"
                        >
                            <FileSpreadsheet className="h-4 w-4 text-success-500" aria-hidden /> Download Excel
                        </button>
                    </div>
                ) : null}
            </div>

            <button
                type="button"
                onClick={onClose}
                aria-label="Close report designer"
                className="flex h-9 w-9 items-center justify-center rounded-control text-subtle transition-colors hover:bg-row-hover hover:text-heading focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/30"
            >
                <X className="h-[18px] w-[18px]" aria-hidden />
            </button>
        </header>
    );
}

export default DesignerHeader;
