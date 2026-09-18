// Printing a page with the institution's configured layout.
//
// Any page that prints asks the server which layout applies to the client it
// is printing for (`resolvePrintSetting`), then hands its own table or figures
// to `printWithLayout`. The header, footer, logos and watermark come from the
// layout; the CONTENT comes from the caller.
//
// This lives here rather than beside the Print Setting editor because it is
// the editor's output, not part of it — the editor happens to be the first
// caller, via its own preview.

import type {
  CanvasBinding,
  CanvasElement,
  CanvasKind,
  PrintSetting,
  TextStyle,
} from "@/app/lms/pages/dynamicfieldsettings/api/printSetting";

/* ── Token substitution ──────────────────────────────────────────────────── */

/**
 * The footer tokens a layout may use. They are stored LITERALLY so one layout
 * paginates correctly for a document of any length; only the printing page
 * knows the real page count, so it fills them in.
 */
export const FOOTER_TOKENS = ["{{date}}", "{{page}}", "{{totalPages}}"] as const;

export const applyTokens = (
  text: string,
  values: { date?: string; page?: number | string; totalPages?: number | string } = {}
): string =>
  String(text || "")
    .replace(/\{\{date\}\}/g, String(values.date ?? new Date().toLocaleDateString()))
    .replace(/\{\{page\}\}/g, String(values.page ?? 1))
    .replace(/\{\{totalPages\}\}/g, String(values.totalPages ?? 1));

/* ── Shared derivations, used by the print HTML and the on-screen preview ── */

export const SIZE_PX: Record<string, number> = { small: 28, medium: 44, large: 64 };
export const WATERMARK_PX: Record<string, number> = { small: 36, medium: 64, large: 96 };

export const escapeHtml = (value: string) =>
  String(value ?? "").replace(/[&<>"']/g, (character) =>
    character === "&"
      ? "&amp;"
      : character === "<"
        ? "&lt;"
        : character === ">"
          ? "&gt;"
          : character === '"'
            ? "&quot;"
            : "&#39;"
  );

/**
 * One styled run of text → a style object.
 *
 * Both renderers derive from this single function, so the on-screen preview
 * and the printed page cannot disagree about what a style means. `fallback` is
 * what that particular slot looks like before anyone configures it.
 */
export const textStyle = (
  style: TextStyle | undefined,
  fallback: { size: string; weight: string; color: string; align?: string }
): React.CSSProperties => ({
  fontFamily: style?.family || "Arial, Helvetica, sans-serif",
  fontSize: style?.size || fallback.size,
  fontWeight: (style?.weight || fallback.weight) as React.CSSProperties["fontWeight"],
  color: style?.color || fallback.color,
  textAlign: (style?.align || fallback.align || "left") as React.CSSProperties["textAlign"],
  letterSpacing: style?.letterSpacing || "normal",
});

/** The same style object as an inline CSS string, for the print HTML. */
export const toCss = (style: React.CSSProperties): string =>
  Object.entries(style)
    .filter(([, value]) => value !== undefined && value !== "")
    .map(
      ([key, value]) =>
        `${key.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}:${escapeHtml(String(value))}`
    )
    .join(";");

/**
 * Degrees to turn the watermark.
 *
 * `position` anchors the stamp and `rotation` turns it, but "diagonal" used to
 * mean both at once. A layout written before rotation existed still says
 * diagonal and nothing else, so that keeps meaning -35° until someone sets an
 * angle of their own.
 */
export const watermarkRotation = (mark: { rotation?: number; position?: string }): number =>
  typeof mark.rotation === "number" && mark.rotation !== 0
    ? mark.rotation
    : mark.position === "diagonal"
      ? -35
      : (mark.rotation ?? 0);

export const watermarkTransform = (mark: { rotation?: number; position?: string }) => {
  const turn = ` rotate(${watermarkRotation(mark)}deg)`;
  switch (mark.position) {
    case "top":
      return `translate(-50%, 0)${turn}`;
    case "bottom":
      return `translate(-50%, -100%)${turn}`;
    default:
      return `translate(-50%, -50%)${turn}`;
  }
};

export const watermarkAnchor = (position?: string) => {
  if (position === "top") return { top: "12%", left: "50%" };
  if (position === "bottom") return { top: "88%", left: "50%" };
  return { top: "50%", left: "50%" };
};

/**
 * Which header logo slots print, from `headerData.logoPosition`.
 *
 *   left    one logo on the left, header text to its right
 *   right   one logo on the right, header text to its left
 *   both    a logo on each side, header text between them
 *
 * The slots are laid out left-then-right in source order, so "right" is a
 * hidden left slot rather than a reversed row — that keeps the header text
 * reading order the same in all three modes, which matters once the text is
 * centred.
 */
export const logoSlots = (position?: string) => ({
  left: position !== "right",
  right: position === "right" || position === "both",
});

/** px wins; the t-shirt enum is what rows written before px fall back to. */
export const logoHeight = (heightPx?: number, sizeEnum?: string): number =>
  typeof heightPx === "number" && heightPx > 0 ? heightPx : SIZE_PX[sizeEnum || "medium"];

/**
 * The image and height a given slot prints.
 *
 * "Both sides" deliberately reuses the LEFT upload on both edges — it is one
 * crest shown twice, not two different marks, so asking for a second upload
 * would only invite them to drift apart.
 */
export const logoFor = (
  side: "left" | "right",
  position: string | undefined,
  logos: {
    leftLogoUrl?: string;
    rightLogoUrl?: string;
    leftLogoSize?: string;
    rightLogoSize?: string;
    leftLogoHeight?: number;
    rightLogoHeight?: number;
  }
) =>
  side === "left" || position === "both"
    ? { url: logos.leftLogoUrl, height: logoHeight(logos.leftLogoHeight, logos.leftLogoSize) }
    : {
        url: logos.rightLogoUrl,
        height: logoHeight(logos.rightLogoHeight, logos.rightLogoSize),
      };

/** Watermark text size in px, from the px field or the legacy enum. */
export const markFontSize = (mark: { fontSize?: string; size?: string }): string =>
  mark.fontSize || `${WATERMARK_PX[mark.size || "medium"]}px`;

/** Watermark image width in px, from the px field or the legacy scale. */
export const markImageWidth = (mark: {
  imageWidth?: number;
  scale?: number;
  size?: string;
}): number =>
  typeof mark.imageWidth === "number" && mark.imageWidth > 0
    ? mark.imageWidth
    : WATERMARK_PX[mark.size || "medium"] * 4 * ((mark.scale ?? 100) / 100);

/**
 * How the header row distributes itself.
 *
 *   corner  logos pinned to the page edges, the text taking everything left
 *           over — the classic letterhead
 *   center  logos tucked against the text, the whole group centred as one
 */
export const headerLayout = (placement?: string) =>
  placement === "center"
    ? { justify: "center", textFlex: "0 1 auto" }
    : { justify: "space-between", textFlex: "1" };

/* ── The printable document ──────────────────────────────────────────────── */

export interface PrintDocumentOptions {
  /** The browser/print-dialog document title. */
  title?: string;
  /** The <h1> above the content. Omit for no heading. */
  heading?: string;
  /** The caller's own markup — the actual thing being printed. */
  bodyHtml?: string;
  /** Page numbers for the footer tokens. */
  page?: number | string;
  totalPages?: number | string;
}

/** One client's sheet: its own layout wrapped around its own content. */
export interface PrintSheet extends PrintDocumentOptions {
  setting: Partial<PrintSetting> | null | undefined;
}

/**
 * One `.sheet` fragment — the configured chrome wrapped around `bodyHtml`.
 *
 * `setting` may be null: a client with no layout of its own and no common
 * layout prints plain rather than not printing at all.
 */
export function printSheetHtml(
  setting: Partial<PrintSetting> | null | undefined,
  options: PrintDocumentOptions = {}
): string {
  if (setting?.canvasElements?.length) return canvasSheetHtml(setting, options);
  const layout = setting || {};
  const page = layout.pageSettings || {};
  const margins = page.margins || {};
  const header = layout.headerData || {};
  const footerText = layout.footerData || {};
  const mark = layout.watermarkSettings || {};
  const logos = layout.logoSettings || {};
  const signature = layout.signature || {};
  const footer = layout.footerSetting || {};

  const titleStyle = textStyle(layout.typography?.headerData, {
    size: "16px",
    weight: "bold",
    color: "#111827",
    align: header.alignment,
  });
  const descStyle = textStyle(layout.typography?.headerDescription, {
    size: "11px",
    weight: "normal",
    color: "#6B7280",
    align: header.alignment,
  });
  const footStyle = textStyle(layout.typography?.footerData, {
    size: "12px",
    weight: "normal",
    color: "#6B7280",
    align: footerText.alignment || "center",
  });
  const headerDescription = header.description || header.address || "";

  const slots = logoSlots(header.logoPosition);
  const rowLayout = headerLayout(header.logoPlacement);
  const leftLogo = logoFor("left", header.logoPosition, logos);
  const rightLogo = logoFor("right", header.logoPosition, logos);
  // showLogo !== false, so a layout saved before the toggle existed still
  // prints the logo it was set up with.
  const withLogo = header.showLogo !== false;

  const logoImg = (url?: string, height?: number) =>
    url
      ? `<img src="${escapeHtml(url)}" alt="" style="height:${height ?? 44}px;width:auto;object-fit:contain" />`
      : "";

  const headerBlock = page.showHeader
    ? `<header style="display:flex;align-items:center;justify-content:${rowLayout.justify};gap:16px;
         background:${escapeHtml(header.background || "#FFFFFF")};
         padding:10px 0;border-bottom:2px solid #F97316">
         ${withLogo && slots.left ? `<div>${logoImg(leftLogo.url, leftLogo.height)}</div>` : ""}
         <div style="flex:${rowLayout.textFlex};min-width:0">
           <div style="${toCss(titleStyle)}">${escapeHtml(header.text || header.name || "")}</div>
           ${headerDescription ? `<div style="${toCss(descStyle)};white-space:pre-line">${escapeHtml(headerDescription)}</div>` : ""}
         </div>
         ${withLogo && slots.right ? `<div>${logoImg(rightLogo.url, rightLogo.height)}</div>` : ""}
       </header>`
    : "";

  const markIsImage = mark.type === "image";
  const markHasContent = markIsImage ? !!mark.watermarkUrl : !!mark.text;

  const markBlock =
    mark.showWatermark && markHasContent
      ? `<div style="position:absolute;${Object.entries(watermarkAnchor(mark.position))
          .map(([k, v]) => `${k}:${v}`)
          .join(";")};
          transform:${watermarkTransform(mark)};
          opacity:${(mark.opacity ?? 10) / 100};pointer-events:none;z-index:0">
          ${
            markIsImage
              ? `<img src="${escapeHtml(mark.watermarkUrl || "")}" alt="" style="width:${Math.round(markImageWidth(mark))}px" />`
              : `<span style="font-family:${escapeHtml(mark.fontFamily || "Arial, sans-serif")};
                   font-size:${escapeHtml(markFontSize(mark))};
                   font-style:${mark.fontStyle === "italic" ? "italic" : "normal"};
                   font-weight:${escapeHtml(mark.fontWeight || (mark.fontStyle === "bold" ? "700" : "400"))};
                   letter-spacing:${escapeHtml(mark.letterSpacing || "normal")};
                   color:${escapeHtml(mark.color || "#9CA3AF")};white-space:nowrap">${escapeHtml(mark.text || "")}</span>`
          }
        </div>`
      : "";

  const footerRow =
    footer.showSignatory || footer.showDate || footer.showSeal
      ? `<div style="display:flex;justify-content:space-between;align-items:flex-end;margin-top:24px;gap:16px">
          ${footer.showDate ? `<div style="font-size:11px;color:#6B7280">Generated on ${escapeHtml(new Date().toLocaleDateString())}</div>` : "<div></div>"}
          ${footer.showSeal && signature.sealUrl ? `<img src="${escapeHtml(signature.sealUrl)}" alt="" style="height:${signature.sealHeight ?? 56}px" />` : "<div></div>"}
          ${
            footer.showSignatory
              ? `<div style="text-align:center">
                   ${signature.signatureUrl ? `<img src="${escapeHtml(signature.signatureUrl)}" alt="" style="height:${signature.signatureHeight ?? 36}px" />` : ""}
                   <div style="border-top:1px solid #9CA3AF;margin-top:4px;padding-top:4px;font-size:11px;color:#6B7280">Authorized Signature</div>
                 </div>`
              : "<div></div>"
          }
        </div>`
      : "";

  const footerBlock = page.showFooter
    ? `<footer style="margin-top:16px;padding-top:8px;border-top:1px solid #E5E7EB;${toCss(footStyle)}">
         ${escapeHtml(
           applyTokens(footerText.text || "", {
             page: options.page ?? 1,
             totalPages: options.totalPages ?? 1,
           })
         )}
       </footer>`
    : "";

  // Margins are per-LAYOUT, so they are padding on the sheet rather than the
  // document's @page rule — two clients in one job can have different ones.
  return `<div class="sheet" style="padding:${margins.top ?? 12}mm ${margins.right ?? 12}mm ${margins.bottom ?? 12}mm ${margins.left ?? 12}mm">
  ${markBlock}
  <div class="content">
    ${headerBlock}
    ${options.heading ? `<h1>${escapeHtml(options.heading)}</h1>` : ""}
    ${options.bodyHtml || ""}
    ${footerRow}
    ${footerBlock}
  </div>
</div>`;
}

/**
 * A full HTML document, one sheet per entry.
 *
 * Each sheet carries its OWN layout, which is the point: a print job covering
 * three clients uses each client's letterhead rather than flattening them to
 * whichever happened to be first.
 *
 * @page can only state one paper size for the document, so the first entry's
 * wins. Page SIZE is a property of the paper in the tray; the rest of the
 * layout is per sheet.
 */
export function printDocumentHtml(
  sheets: PrintSheet[],
  documentOptions: { title?: string; extraCss?: string } = {}
): string {
  const first = sheets[0]?.setting?.pageSettings || {};
  const body = sheets
    .map(({ setting, ...options }) => printSheetHtml(setting, options))
    .join("");

  return `<!doctype html><html><head><meta charset="utf-8" /><title>${escapeHtml(documentOptions.title || "Print")}</title>
<style>
  *{box-sizing:border-box}
  body{margin:0;font-family:Arial,Helvetica,sans-serif;color:#111827}
  .sheet{position:relative}
  /* Every client starts a new sheet of paper. */
  .sheet + .sheet{break-before:page;page-break-before:always}
  .content{position:relative;z-index:1}
  h1{font-size:20px;text-align:center;margin:18px 0}
  table{width:100%;border-collapse:collapse;margin-top:8px}
  th,td{border:1px solid #E5E7EB;padding:6px 8px;font-size:11px;text-align:left}
  th{background:#F9FAFB}
  @page{size:${first.pageSize || "A4"} ${first.orientation || "portrait"};margin:0}
${documentOptions.extraCss || ""}
</style></head>
<body>${body}</body></html>`;
}

/** The single-layout case: one client, one sheet, one document. */
export function printDocument(
  setting: Partial<PrintSetting> | null | undefined,
  options: PrintDocumentOptions = {}
): string {
  return printDocumentHtml([{ setting, ...options }], { title: options.title });
}

/**
 * Opens the print dialog on one or more sheets, via a hidden same-origin
 * iframe.
 *
 * An iframe rather than window.open: a popup is blocked by default in most
 * browsers, and the print then silently does nothing.
 */
export function printSheetsWithLayout(
  sheets: PrintSheet[],
  documentOptions: { title?: string; extraCss?: string } = {}
) {
  const frame = document.createElement("iframe");
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
  document.body.appendChild(frame);

  const doc = frame.contentWindow?.document;
  if (!doc) {
    frame.remove();
    throw new Error("Could not open the print view");
  }
  doc.open();
  doc.write(printDocumentHtml(sheets, documentOptions));
  doc.close();

  // Removed on a timer: pulling the iframe synchronously cancels the print
  // dialog in Chrome.
  const cleanup = () => setTimeout(() => frame.remove(), 1000);
  frame.contentWindow?.addEventListener("afterprint", cleanup);

  /**
   * Wait for the images before opening the dialog.
   *
   * print() paints whatever is decoded AT THAT MOMENT, so calling it straight
   * after close() prints empty boxes wherever a logo was still in flight —
   * which is every remote image on a first run, since none of them are cached
   * yet. Blob URLs from a just-picked file resolve instantly; Cloudinary ones
   * do not.
   */
  const images = Array.from(doc.images);
  const decoded = Promise.all(
    images.map((image) =>
      image.complete
        ? Promise.resolve()
        : new Promise<void>((resolve) => {
            image.addEventListener("load", () => resolve(), { once: true });
            // A broken URL resolves too — one dead logo must not cost you the
            // whole print.
            image.addEventListener("error", () => resolve(), { once: true });
          })
    )
  );
  const givenUp = new Promise<void>((resolve) => setTimeout(resolve, 4000));

  void Promise.race([decoded, givenUp]).then(() => {
    frame.contentWindow?.focus();
    frame.contentWindow?.print();
    setTimeout(cleanup, 60_000);
  });
}

/** The single-layout case. */
export function printWithLayout(
  setting: Partial<PrintSetting> | null | undefined,
  options: PrintDocumentOptions = {}
) {
  printSheetsWithLayout([{ setting, ...options }], { title: options.title });
}

/* ── Drag-and-drop canvas layout ─────────────────────────────────────────── */

const PAPER_MM: Record<string, [number, number]> = {
  A4: [210, 297],
  A3: [297, 420],
  Letter: [215.9, 279.4],
};
export const PX_PER_MM = 96 / 25.4;
const MM_PER_PX = 25.4 / 96;

export const sheetMm = (page?: PrintSetting["pageSettings"]) => {
  const [w, h] = PAPER_MM[page?.pageSize || "A4"] || PAPER_MM.A4;
  return page?.orientation === "landscape" ? { W: h, H: w } : { W: w, H: h };
};

const pxOf = (value: string | undefined, fallback: number) => {
  const parsed = parseFloat(String(value ?? ""));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export const newCanvasElement = (
  kind: CanvasKind,
  id: string,
  bind: CanvasBinding | "" = ""
): CanvasElement => ({
  id,
  kind,
  bind,
  x: 10,
  y: 40,
  w: 30,
  h: 6,
  text: "",
  fontSize: 12,
  bold: false,
  italic: false,
  align: "left",
  color: "#111827",
  opacity: 1,
  rotation: 0,
  dataUrl: "",
});

/** A canvas that reproduces the flow layout, built from the setting's own values and margins. */
export function seedCanvas(setting: Partial<PrintSetting>): CanvasElement[] {
  const page = setting.pageSettings || {};
  const { W, H } = sheetMm(page);
  const m = page.margins || {};
  const x0 = m.left ?? 12;
  const x1 = W - (m.right ?? 12);
  const y0 = m.top ?? 12;
  const y1 = H - (m.bottom ?? 12);
  const cw = x1 - x0;
  const header = setting.headerData || {};
  const typo = setting.typography || {};
  const logos = setting.logoSettings || {};
  const footer = setting.footerSetting || {};
  const sign = setting.signature || {};
  const mark = setting.watermarkSettings || {};
  const pct = (mm: number, total: number) => Math.round((mm / total) * 1000) / 10;
  const lineH = (px: number) => px * 1.3 * MM_PER_PX;
  const box = (
    kind: CanvasKind,
    id: string,
    bind: CanvasBinding | "",
    x: number,
    y: number,
    w: number,
    h: number,
    extra: Partial<CanvasElement> = {}
  ): CanvasElement => ({
    ...newCanvasElement(kind, id, bind),
    x: pct(x, W),
    y: pct(y, H),
    w: pct(w, W),
    h: Math.max(0.1, pct(h, H)),
    ...extra,
  });

  const titleH = lineH(pxOf(typo.headerData?.size, 16));
  const desc = header.description || header.address || "";
  const descH = lineH(pxOf(typo.headerDescription?.size, 11)) * Math.min(4, Math.max(1, desc.split("\n").length));
  const logoH = Math.min(40, Math.max(8, logoHeight(logos.leftLogoHeight, logos.leftLogoSize) * MM_PER_PX));
  const logoW = logoH * 1.6;
  const headerH = Math.max(logoH, titleH + (desc ? descH : 0));
  const slots = logoSlots(header.logoPosition);
  const centered = header.logoPlacement === "center";
  const gap = 4;
  let textX = x0;
  let textW = cw;
  if (centered) {
    textW = cw * 0.5;
    textX = x0 + cw * 0.25;
  } else {
    if (slots.left) {
      textX += logoW + gap;
      textW -= logoW + gap;
    }
    if (slots.right) textW -= logoW + gap;
  }
  const textY = y0 + (headerH - titleH - (desc ? descH : 0)) / 2;
  const logoY = y0 + (headerH - logoH) / 2;
  const showHeader = !!page.showHeader;
  const bodyTop = showHeader ? y0 + headerH + 5 : y0;

  const footH = lineH(pxOf(typo.footerData?.size, 12));
  const showFooter = !!page.showFooter;
  const rowBottom = showFooter ? y1 - footH - 3 : y1;
  const sigImgH = (sign.signatureHeight ?? 36) * MM_PER_PX;
  const sealH = (sign.sealHeight ?? 56) * MM_PER_PX;
  const rowH = Math.max(sigImgH + 5, sealH, 5);
  const rowTop = rowBottom - rowH;
  const hasRow = footer.showSignatory || footer.showDate || footer.showSeal;
  const bodyBottom = hasRow ? rowTop - 4 : rowBottom - 2;

  const markIsImage = mark.type === "image";
  const markW = markIsImage ? Math.min(W * 0.9, markImageWidth(mark) * MM_PER_PX) : W * 0.8;
  const markH = markIsImage ? markW * 0.6 : lineH(pxOf(markFontSize(mark), 64));
  const markY =
    mark.position === "top" ? H * 0.12 : mark.position === "bottom" ? H * 0.88 - markH : (H - markH) / 2;

  return [
    box("text", "watermark", "watermark", (W - markW) / 2, markY, markW, markH),
    box("body", "body", "", x0, bodyTop, cw, Math.max(20, bodyBottom - bodyTop)),
    box("image", "leftLogo", "leftLogo", centered ? textX - gap - logoW : x0, logoY, logoW, logoH),
    box("image", "rightLogo", "rightLogo", centered ? textX + textW + gap : x1 - logoW, logoY, logoW, logoH),
    box("text", "headerTitle", "headerTitle", textX, textY, textW, titleH),
    box("text", "headerDescription", "headerDescription", textX, textY + titleH, textW, descH),
    ...(showHeader ? [box("line", "headerRule", "", x0, y0 + headerH + 2, cw, 0.6, { color: "#F97316" })] : []),
    box("text", "date", "date", x0, rowTop + rowH - 5, 70, 5, { fontSize: 11, color: "#6B7280" }),
    box("image", "seal", "seal", (W - sealH) / 2, rowTop + rowH - sealH, sealH, sealH),
    box("signature", "signature", "signature", x1 - 50, rowTop + rowH - sigImgH - 5, 50, sigImgH + 5),
    ...(showFooter ? [box("line", "footerRule", "", x0, rowBottom + 1, cw, 0.3, { color: "#E5E7EB" })] : []),
    box("text", "footerText", "footerText", x0, y1 - footH, cw, footH),
  ];
}

export interface ResolvedCanvasElement {
  visible: boolean;
  text: string;
  imageUrl: string;
  /** Print px; each renderer scales it to its sheet. */
  fontSize: number;
  style: {
    fontFamily: string;
    fontWeight: string;
    fontStyle: string;
    color: string;
    textAlign: "left" | "center" | "right";
    letterSpacing: string;
  };
  opacity: number;
  rotation: number;
  /** Shown on the canvas where an image or text has not been provided yet. */
  placeholder: string;
}

const typographyOf = (
  style: TextStyle | undefined,
  fallback: { size: number; weight: string; color: string; align?: string }
) => ({
  fontSize: pxOf(style?.size, fallback.size),
  style: {
    fontFamily: style?.family || "Arial, Helvetica, sans-serif",
    fontWeight: style?.weight || fallback.weight,
    fontStyle: "normal",
    color: style?.color || fallback.color,
    textAlign: (style?.align || fallback.align || "left") as "left" | "center" | "right",
    letterSpacing: style?.letterSpacing || "normal",
  },
});

/** What an element shows and whether it prints — shared by the canvas and the print HTML. */
export function resolveCanvasElement(
  el: CanvasElement,
  setting: Partial<PrintSetting>,
  tokens: { page?: number | string; totalPages?: number | string } = {}
): ResolvedCanvasElement {
  const page = setting.pageSettings || {};
  const header = setting.headerData || {};
  const typo = setting.typography || {};
  const mark = setting.watermarkSettings || {};
  const footer = setting.footerSetting || {};
  const sign = setting.signature || {};
  const own: ResolvedCanvasElement = {
    visible: true,
    text: applyTokens(el.text, tokens),
    imageUrl: el.dataUrl,
    fontSize: el.fontSize,
    style: {
      fontFamily: "Arial, Helvetica, sans-serif",
      fontWeight: el.bold ? "bold" : "normal",
      fontStyle: el.italic ? "italic" : "normal",
      color: el.color,
      textAlign: el.align,
      letterSpacing: "normal",
    },
    opacity: el.opacity,
    rotation: el.rotation,
    placeholder: el.kind === "image" ? "Image" : el.kind === "text" ? "Text" : "",
  };

  switch (el.bind) {
    case "headerTitle":
      return {
        ...own,
        ...typographyOf(typo.headerData, { size: 16, weight: "bold", color: "#111827", align: header.alignment }),
        visible: !!page.showHeader,
        text: header.text || header.name || "",
        placeholder: "Header title",
      };
    case "headerDescription": {
      const text = header.description || header.address || "";
      return {
        ...own,
        ...typographyOf(typo.headerDescription, { size: 11, weight: "normal", color: "#6B7280", align: header.alignment }),
        visible: !!page.showHeader && !!text,
        text,
      };
    }
    case "leftLogo":
    case "rightLogo": {
      const side = el.bind === "leftLogo" ? "left" : "right";
      return {
        ...own,
        visible: !!page.showHeader && header.showLogo !== false && logoSlots(header.logoPosition)[side],
        imageUrl: logoFor(side, header.logoPosition, setting.logoSettings || {}).url || "",
        placeholder: "Logo",
      };
    }
    case "watermark": {
      const image = mark.type === "image";
      return {
        ...own,
        visible: !!mark.showWatermark && (image ? !!mark.watermarkUrl : !!mark.text),
        text: image ? "" : mark.text || "",
        imageUrl: image ? mark.watermarkUrl || "" : "",
        fontSize: pxOf(markFontSize(mark), 64),
        style: {
          fontFamily: mark.fontFamily || "Arial, sans-serif",
          fontWeight: mark.fontWeight || (mark.fontStyle === "bold" ? "bold" : "normal"),
          fontStyle: mark.fontStyle === "italic" ? "italic" : "normal",
          color: mark.color || "#9CA3AF",
          textAlign: "center",
          letterSpacing: mark.letterSpacing || "normal",
        },
        opacity: (mark.opacity ?? 10) / 100,
        rotation: watermarkRotation(mark),
      };
    }
    case "signature":
      return {
        ...own,
        visible: !!footer.showSignatory,
        imageUrl: sign.signatureUrl || "",
        text: "Authorized Signature",
        fontSize: 11,
        style: { ...own.style, fontWeight: "normal", fontStyle: "normal", color: "#6B7280", textAlign: "center" },
      };
    case "seal":
      return { ...own, visible: !!footer.showSeal, imageUrl: sign.sealUrl || "", placeholder: "Seal" };
    case "date":
      return { ...own, visible: !!footer.showDate, text: `Generated on ${applyTokens("{{date}}", tokens)}` };
    case "footerText":
      return {
        ...own,
        ...typographyOf(typo.footerData, {
          size: 12,
          weight: "normal",
          color: "#6B7280",
          align: setting.footerData?.alignment || "center",
        }),
        visible: !!page.showFooter,
        text: applyTokens(setting.footerData?.text || "", tokens),
      };
    default:
      return own;
  }
}

/** Which element fields a bound element stores on the setting rather than on itself. */
export const BOUND_FIELDS: Partial<Record<CanvasBinding, (keyof CanvasElement)[]>> = {
  headerTitle: ["text", "fontSize", "bold", "align", "color"],
  headerDescription: ["text", "fontSize", "bold", "align", "color"],
  footerText: ["text", "fontSize", "bold", "align", "color"],
  watermark: ["text", "fontSize", "bold", "italic", "color", "opacity", "rotation"],
};

/** Writes a canvas edit of a bound element back into the form's fields. */
export function writeCanvasBinding(
  setting: Partial<PrintSetting>,
  bind: CanvasBinding,
  patch: Partial<CanvasElement>
): Partial<PrintSetting> {
  if (bind === "watermark") {
    const next = { ...setting.watermarkSettings };
    if (patch.text !== undefined) next.text = patch.text;
    if (patch.fontSize !== undefined) next.fontSize = `${patch.fontSize}px`;
    if (patch.bold !== undefined) next.fontWeight = patch.bold ? "bold" : "normal";
    if (patch.italic !== undefined) next.fontStyle = patch.italic ? "italic" : "normal";
    if (patch.color !== undefined) next.color = patch.color;
    if (patch.opacity !== undefined) next.opacity = Math.round(patch.opacity * 100);
    if (patch.rotation !== undefined) next.rotation = patch.rotation;
    return { ...setting, watermarkSettings: next };
  }
  if (bind !== "headerTitle" && bind !== "headerDescription" && bind !== "footerText") return setting;

  const group = bind === "footerText" ? "footerData" : bind === "headerDescription" ? "headerDescription" : "headerData";
  const style: TextStyle = { ...setting.typography?.[group] };
  if (patch.fontSize !== undefined) style.size = `${patch.fontSize}px`;
  if (patch.bold !== undefined) style.weight = patch.bold ? "bold" : "normal";
  if (patch.align !== undefined) style.align = patch.align;
  if (patch.color !== undefined) style.color = patch.color;
  const next: Partial<PrintSetting> = { ...setting, typography: { ...setting.typography, [group]: style } };
  if (patch.text !== undefined) {
    if (bind === "footerText") next.footerData = { ...setting.footerData, text: patch.text };
    else next.headerData = { ...setting.headerData, [bind === "headerTitle" ? "text" : "description"]: patch.text };
  }
  return next;
}

function canvasInnerHtml(el: CanvasElement, r: ResolvedCanvasElement): string {
  const text = `font-size:${r.fontSize}px;${toCss(r.style)};line-height:1.25;white-space:pre-line;overflow-wrap:anywhere`;
  const img = (url: string) =>
    url ? `<img src="${escapeHtml(url)}" alt="" style="display:block;width:100%;height:100%;object-fit:contain" />` : "";
  if (el.kind === "line") {
    return `<div style="width:100%;height:100%;background:${escapeHtml(el.color)};-webkit-print-color-adjust:exact;print-color-adjust:exact"></div>`;
  }
  if (el.kind === "image" || r.imageUrl) {
    if (el.kind !== "signature") return img(r.imageUrl);
  }
  if (el.kind === "signature") {
    return `<div style="display:flex;flex-direction:column;justify-content:flex-end;height:100%">
      ${r.imageUrl ? `<div style="flex:1;min-height:0">${img(r.imageUrl)}</div>` : ""}
      <div style="border-top:1px solid #9CA3AF;padding-top:1mm;${text}">${escapeHtml(r.text)}</div>
    </div>`;
  }
  return `<div style="display:flex;flex-direction:column;justify-content:center;height:100%;${text}">${escapeHtml(r.text)}</div>`;
}

/** A sheet drawn from canvas elements; the report content flows inside the body box. */
function canvasSheetHtml(setting: Partial<PrintSetting>, options: PrintDocumentOptions): string {
  const { W, H } = sheetMm(setting.pageSettings);
  const elements = setting.canvasElements || [];
  const tokens = { page: options.page ?? 1, totalPages: options.totalPages ?? 1 };
  const at = (percent: number, total: number) => +((percent / 100) * total).toFixed(2);
  // A millimetre short of the paper, so rounding never spills onto a blank page.
  const sheetH = H - 1;
  const body = elements.find((el) => el.kind === "body") || { x: 6, y: 20, w: 88, h: 60 };
  const bodyBottom = at(body.y + body.h, H);

  const pieces = elements
    .filter((el) => el.kind !== "body")
    .map((el) => {
      const r = resolveCanvasElement(el, setting, tokens);
      if (!r.visible) return "";
      const top = at(el.y, H);
      const height = at(el.h, H);
      // Anything below the content follows it, so a long report pushes the sign-off down instead of printing over it.
      const vertical =
        top >= bodyBottom ? `bottom:${Math.max(0, +(sheetH - top - height).toFixed(2))}mm` : `top:${top}mm`;
      return `<div style="position:absolute;left:${at(el.x, W)}mm;${vertical};width:${at(el.w, W)}mm;height:${height}mm;opacity:${r.opacity};transform:rotate(${r.rotation}deg);z-index:${el.bind === "watermark" ? 0 : 2}">${canvasInnerHtml(el, r)}</div>`;
    })
    .join("");

  return `<div class="sheet" style="position:relative;min-height:${sheetH}mm">
  ${pieces}
  <div class="content" style="margin-left:${at(body.x, W)}mm;width:${at(body.w, W)}mm;padding-top:${at(body.y, H)}mm;padding-bottom:${Math.max(0, +(sheetH - bodyBottom).toFixed(2))}mm">
    ${options.heading ? `<h1>${escapeHtml(options.heading)}</h1>` : ""}
    ${options.bodyHtml || ""}
  </div>
</div>`;
}
