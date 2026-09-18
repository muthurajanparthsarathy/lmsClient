"use client";

// Live preview of a print layout.
//
// Renders the SAME draft the form is editing, so the preview is the layout
// rather than a picture of one. "Print test" reuses `previewHtml` below, which
// means what you print is generated from the same values as what you see — a
// preview built separately from the print path drifts, and you only find out
// on paper.
//
// Sample content (the course table, the highlight tiles) is clearly filler: it
// exists to show how a real report sits inside the header/footer/watermark, and
// is never saved or sent anywhere.

import * as React from "react";
import type { PrintSetting } from "../api/printSetting";
import {
  applyTokens,
  headerLayout,
  logoFor,
  logoSlots,
  markFontSize,
  markImageWidth,
  printDocument,
  printWithLayout,
  textStyle,
  watermarkAnchor,
  watermarkTransform,
} from "@/app/lms/shared/print/printLayout";

// Re-exported so callers that already import them from here keep working, and
// so there is visibly ONE implementation rather than a copy per consumer.
export { applyTokens, FOOTER_TOKENS } from "@/app/lms/shared/print/printLayout";

/** Filler rows for the preview. Never saved, never sent — they exist only so
 *  the header, footer and watermark can be judged against realistic content. */
export const SAMPLE_ROWS = [
  { no: 1, name: "Python Programming", enrolled: 25, done: 18, pct: 72 },
  { no: 2, name: "Web Development", enrolled: 20, done: 15, pct: 75 },
  { no: 3, name: "Data Structures", enrolled: 18, done: 12, pct: 67 },
  { no: 4, name: "Java Programming", enrolled: 15, done: 10, pct: 67 },
];

/** The same filler, as the print HTML's body. */
const sampleBodyHtml = () => `<table>
      <thead><tr><th>#</th><th>Course name</th><th>Enrolled</th><th>Completed</th></tr></thead>
      <tbody>
        ${SAMPLE_ROWS.map(
          (row) =>
            `<tr><td>${row.no}</td><td>${row.name}</td><td>${row.enrolled}</td><td>${row.done}</td></tr>`
        ).join("")}
      </tbody>
    </table>`;

/* ── Print HTML (also what "Print test" writes into the iframe) ──────────── */

/**
 * The draft rendered as a printable page, with sample content inside it.
 *
 * The chrome comes from the shared builder every real print uses, so what you
 * judge here is the same code that will draw the header on paper.
 */
export function previewHtml(setting: Partial<PrintSetting>, title = "Print test"): string {
  return printDocument(setting, {
    title,
    heading: "Course Progress Report",
    bodyHtml: sampleBodyHtml(),
  });
}

/** Opens the print dialog on the current draft, via a hidden same-origin iframe. */
export function printTest(setting: Partial<PrintSetting>) {
  printWithLayout(setting, {
    title: "Print test",
    heading: "Course Progress Report",
    bodyHtml: sampleBodyHtml(),
  });
}

/* ── React preview ───────────────────────────────────────────────────────── */

/** One header logo, or the dashed stand-in showing where it will land. */
function LogoSlot({ url, height }: { url?: string; height?: number }) {
  return (
    <div className="shrink-0">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt=""
          // The sheet is a scaled-down page, so the configured height is
          // scaled with it rather than printed at full size on a thumbnail.
          style={{ height: (height ?? 44) / 1.6 }}
          className="w-auto object-contain"
        />
      ) : (
        <div className="flex h-7 w-14 items-center justify-center rounded bg-ink-100 text-[8px] text-ink-400">
          logo
        </div>
      )}
    </div>
  );
}

export default function PrintSettingPreview({ setting }: { setting: Partial<PrintSetting> }) {
  const page = setting.pageSettings || {};
  const margins = page.margins || {};
  const header = setting.headerData || {};
  const footerText = setting.footerData || {};
  const mark = setting.watermarkSettings || {};
  const logos = setting.logoSettings || {};
  const signature = setting.signature || {};
  const footer = setting.footerSetting || {};

  const anchor = watermarkAnchor(mark.position);
  const slots = logoSlots(header.logoPosition);
  const layout = headerLayout(header.logoPlacement);
  const leftLogo = logoFor("left", header.logoPosition, logos);
  const rightLogo = logoFor("right", header.logoPosition, logos);

  // The same three derivations previewHtml makes, from the same helper.
  const titleStyle = textStyle(setting.typography?.headerData, {
    size: "16px",
    weight: "bold",
    color: "#111827",
    align: header.alignment,
  });
  const descStyle = textStyle(setting.typography?.headerDescription, {
    size: "11px",
    weight: "normal",
    color: "#6B7280",
    align: header.alignment,
  });
  const footStyle = textStyle(setting.typography?.footerData, {
    size: "12px",
    weight: "normal",
    color: "#6B7280",
    align: footerText.alignment || "center",
  });
  const headerDescription = header.description || header.address || "";
  const withLogo = header.showLogo !== false;
  const markIsImage = mark.type === "image";
  const markHasContent = markIsImage ? !!mark.watermarkUrl : !!mark.text;

  return (
    <div
      className="relative overflow-hidden rounded-md bg-white text-[#1F2937]"
      // Sheet-on-desk look: a real drop shadow rather than a hairline, so the
      // page reads as paper against the grey well.
      data-ps-sheet=""
      style={{
        boxShadow: "0 1px 3px rgba(17,24,39,0.10), 0 8px 24px rgba(17,24,39,0.08)",
        paddingTop: `${margins.top ?? 12}px`,
        paddingBottom: `${margins.bottom ?? 12}px`,
        paddingLeft: `${margins.left ?? 12}px`,
        paddingRight: `${margins.right ?? 12}px`,
        aspectRatio: page.orientation === "landscape" ? "297 / 210" : "210 / 297",
      }}
    >
      {/* Watermark sits behind the content, exactly as it prints. */}
      {mark.showWatermark && markHasContent ? (
        <div
          aria-hidden
          className="pointer-events-none absolute z-0 select-none"
          style={{
            top: anchor.top,
            left: anchor.left,
            transform: watermarkTransform(mark),
            opacity: (mark.opacity ?? 10) / 100,
          }}
        >
          {markIsImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={mark.watermarkUrl}
              alt=""
              style={{ width: markImageWidth(mark) * 0.75 }}
            />
          ) : (
            <span
              className="whitespace-nowrap"
              style={{
                fontFamily: mark.fontFamily || "Arial, sans-serif",
                fontSize: markFontSize(mark),
                fontStyle: mark.fontStyle === "italic" ? "italic" : "normal",
                fontWeight: (mark.fontWeight ||
                  (mark.fontStyle === "bold"
                    ? 700
                    : 400)) as React.CSSProperties["fontWeight"],
                letterSpacing: mark.letterSpacing || "normal",
                color: mark.color || "#9CA3AF",
              }}
            >
              {mark.text}
            </span>
          )}
        </div>
      ) : null}

      <div className="relative z-10 flex h-full flex-col">
        {page.showHeader ? (
          <div
            className="flex items-center gap-3 border-b-2 border-[#F97316] pb-2"
            style={{
              background: header.background || "#FFFFFF",
              justifyContent: layout.justify,
            }}
          >
            {/* An empty slot still renders its placeholder, so the layout the
                logo WILL occupy is visible before anything is uploaded. */}
            {withLogo && slots.left ? <LogoSlot {...leftLogo} /> : null}

            <div className="min-w-0" style={{ flex: layout.textFlex }}>
              <div className="truncate" style={titleStyle}>
                {header.text || header.name || "Header title"}
              </div>
              {headerDescription ? (
                <div className="whitespace-pre-line leading-tight" style={descStyle}>
                  {headerDescription}
                </div>
              ) : null}
            </div>

            {withLogo && slots.right ? <LogoSlot {...rightLogo} /> : null}
          </div>
        ) : null}

        <p className="my-2.5 text-center text-[15px] font-bold text-[#1F2937]">
          Course Progress Report
        </p>

        <p className="mb-1 text-[9px] font-bold">Course Progress Summary</p>
        <table className="w-full border-collapse text-[7px]">
          <thead>
            <tr className="bg-ink-50">
              {["#", "Course name", "Enrolled", "Done", "Completion %"].map((h) => (
                <th key={h} className="border border-ink-200 px-1 py-0.5 text-left font-semibold">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SAMPLE_ROWS.map((row) => (
              <tr key={row.no}>
                <td className="border border-ink-200 px-1 py-0.5">{row.no}</td>
                <td className="border border-ink-200 px-1 py-0.5">{row.name}</td>
                <td className="border border-ink-200 px-1 py-0.5">{row.enrolled}</td>
                <td className="border border-ink-200 px-1 py-0.5">{row.done}</td>
                <td className="border border-ink-200 px-1 py-0.5">
                  <span className="flex items-center gap-1">
                    <span className="h-1 flex-1 rounded-full bg-ink-200">
                      <span
                        className="block h-1 rounded-full bg-[#F97316]"
                        style={{ width: `${row.pct}%` }}
                      />
                    </span>
                    {row.pct}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <p className="mb-1 mt-2 text-[9px] font-bold">Key Highlights</p>
        <div className="grid grid-cols-4 gap-1">
          {[
            ["90", "Total Learners"],
            ["64", "Completed"],
            ["26", "In Progress"],
            ["71%", "Overall"],
          ].map(([value, label]) => (
            <div key={label} className="rounded border border-ink-200 px-1 py-1 text-center">
              <span className="block text-[10px] font-bold text-ink-800">{value}</span>
              <span className="block text-[6px] text-ink-500">{label}</span>
            </div>
          ))}
        </div>

        <div className="mt-auto">
          {footer.showSignatory || footer.showDate || footer.showSeal ? (
            <div className="flex items-end justify-between gap-3 pt-3 text-[8px] text-ink-500">
              <span>
                {footer.showDate ? `Generated on ${new Date().toLocaleDateString()}` : ""}
              </span>
              {footer.showSeal ? (
                signature.sealUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={signature.sealUrl}
                    alt=""
                    // Scaled with the sheet, which is a miniature of the page.
                    style={{ height: (signature.sealHeight ?? 56) / 1.6 }}
                    className="w-auto object-contain"
                  />
                ) : (
                  <span className="flex size-8 items-center justify-center rounded-full border border-dashed border-ink-300 text-[6px]">
                    seal
                  </span>
                )
              ) : null}
              {footer.showSignatory ? (
                <span className="text-center">
                  {signature.signatureUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={signature.signatureUrl}
                      alt=""
                      style={{ height: (signature.signatureHeight ?? 36) / 1.6 }}
                      className="mx-auto w-auto object-contain"
                    />
                  ) : null}
                  <span className="mt-0.5 block border-t border-ink-400 pt-0.5">
                    Authorized Signature
                  </span>
                </span>
              ) : null}
            </div>
          ) : null}

          {page.showFooter ? (
            <div
              className="mt-2 border-t border-ink-200 pt-1.5"
              // The sheet is a scaled-down page, so the configured point size
              // would swamp it — everything else here is miniaturised too.
              style={{ ...footStyle, fontSize: "8px" }}
            >
              {applyTokens(footerText.text || "", { page: 1, totalPages: 1 })}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
