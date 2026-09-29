"use client";

import * as React from "react";
import type { CanvasElement, PrintSetting } from "../api/printSetting";
import {
  PX_PER_MM,
  resolveCanvasElement,
  sheetMm,
  type ResolvedCanvasElement,
} from "@/app/lms/shared/print/printLayout";
import { SAMPLE_ROWS } from "./PrintSettingPreview";

export type CanvasGeometry = Pick<CanvasElement, "x" | "y" | "w" | "h">;

const GRID = 0.5;
const snap = (value: number) => Math.round(value / GRID) * GRID;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** The page drawn from canvas elements — interactive in the designer, static in the preview. */
export default function PrintCanvasSheet({
  setting,
  elements,
  interactive = false,
  selectedId = null,
  onSelect,
  onGeometry,
}: {
  setting: Partial<PrintSetting>;
  elements: CanvasElement[];
  interactive?: boolean;
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;
  onGeometry?: (id: string, geometry: CanvasGeometry) => void;
}) {
  const page = setting.pageSettings || {};
  const margins = page.margins || {};
  const { W, H } = sheetMm(page);
  // Print px → a share of the sheet's width, so type scales exactly as it prints.
  const fs = (px: number) => `${(px / (W * PX_PER_MM)) * 100}cqw`;

  const sheetRef = React.useRef<HTMLDivElement>(null);
  const drag = React.useRef<null | {
    id: string;
    mode: "move" | "resize";
    startX: number;
    startY: number;
    origin: CanvasGeometry;
    rect: DOMRect;
  }>(null);
  // Positions change on every pointermove; they stay local until the gesture ends.
  const [live, setLive] = React.useState<{ id: string; geometry: CanvasGeometry } | null>(null);
  const liveRef = React.useRef(live);
  liveRef.current = live;

  const begin = (event: React.PointerEvent, el: CanvasElement, mode: "move" | "resize") => {
    const sheet = sheetRef.current;
    if (!interactive || !sheet) return;
    event.preventDefault();
    event.stopPropagation();
    sheet.setPointerCapture(event.pointerId);
    drag.current = {
      id: el.id,
      mode,
      startX: event.clientX,
      startY: event.clientY,
      origin: { x: el.x, y: el.y, w: el.w, h: el.h },
      rect: sheet.getBoundingClientRect(),
    };
    onSelect?.(el.id);
    (event.currentTarget.closest("[data-el]") as HTMLElement | null)?.focus({ preventScroll: true });
  };

  const move = (event: React.PointerEvent) => {
    const state = drag.current;
    if (!state) return;
    const dx = ((event.clientX - state.startX) / state.rect.width) * 100;
    const dy = ((event.clientY - state.startY) / state.rect.height) * 100;
    const { origin } = state;
    const geometry =
      state.mode === "move"
        ? { ...origin, x: snap(clamp(origin.x + dx, -10, 99)), y: snap(clamp(origin.y + dy, -10, 99.5)) }
        : { ...origin, w: snap(clamp(origin.w + dx, 1, 110)), h: Math.max(0.1, snap(clamp(origin.h + dy, 0, 110))) };
    setLive({ id: state.id, geometry });
  };

  const end = (event: React.PointerEvent) => {
    const state = drag.current;
    if (!state) return;
    sheetRef.current?.releasePointerCapture(event.pointerId);
    drag.current = null;
    const finished = liveRef.current;
    setLive(null);
    if (finished) onGeometry?.(finished.id, finished.geometry);
  };

  const sheet = (
    <div
      ref={sheetRef}
      className={interactive ? "pcs-sheet is-live" : "pcs-sheet"}
      style={{ aspectRatio: `${W} / ${H}`, ["--pcs-ratio" as string]: W / H }}
      onPointerMove={interactive ? move : undefined}
      onPointerUp={interactive ? end : undefined}
      onPointerCancel={interactive ? end : undefined}
      onPointerDown={interactive ? () => onSelect?.(null) : undefined}
    >
      {interactive ? (
        <div
          aria-hidden
          className="pcs-margins"
          style={{
            top: `${((margins.top ?? 12) / H) * 100}%`,
            bottom: `${((margins.bottom ?? 12) / H) * 100}%`,
            left: `${((margins.left ?? 12) / W) * 100}%`,
            right: `${((margins.right ?? 12) / W) * 100}%`,
          }}
        />
      ) : null}

      {elements.map((element) => {
        const r = resolveCanvasElement(element, setting);
        if (!r.visible) return null;
        const g = live?.id === element.id ? { ...element, ...live.geometry } : element;
        const selected = interactive && element.id === selectedId;
        return (
          <div
            key={element.id}
            data-el=""
            role={interactive ? "button" : undefined}
            tabIndex={interactive ? 0 : undefined}
            aria-label={interactive ? `${element.bind || element.kind} element` : undefined}
            className={`pcs-el${selected ? " is-selected" : ""}${element.kind === "line" ? " is-line" : ""}`}
            onPointerDown={interactive ? (event) => begin(event, element, "move") : undefined}
            onFocus={interactive ? () => onSelect?.(element.id) : undefined}
            style={{
              left: `${g.x}%`,
              top: `${g.y}%`,
              width: `${g.w}%`,
              height: `${g.h}%`,
              opacity: element.kind === "body" ? 1 : r.opacity,
              transform: r.rotation && element.kind !== "body" ? `rotate(${r.rotation}deg)` : undefined,
              // In the designer the body sits lowest, so the watermark behind it can still be grabbed.
              zIndex:
                element.kind === "body"
                  ? interactive ? 0 : 1
                  : element.bind === "watermark"
                    ? interactive ? 1 : 0
                    : 2,
            }}
          >
            <ElementBody element={element} r={r} fs={fs} W={W} interactive={interactive} />
            {selected ? (
              <span
                role="button"
                tabIndex={-1}
                aria-label="Resize"
                className="pcs-grip"
                onPointerDown={(event) => begin(event, element, "resize")}
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      {interactive ? (
        <div className="pcs-stage">
          {sheet}
          <p className="pcs-caption">
            {page.pageSize || "A4"} · {page.orientation || "portrait"} · drag to move, corner to resize, arrow keys to nudge
          </p>
        </div>
      ) : (
        sheet
      )}
    </>
  );
}

function ElementBody({
  element,
  r,
  fs,
  W,
  interactive,
}: {
  element: CanvasElement;
  r: ResolvedCanvasElement;
  fs: (px: number) => string;
  W: number;
  interactive: boolean;
}) {
  if (element.kind === "line") return <div className="pcs-fill" style={{ background: element.color }} />;
  if (element.kind === "body") return <SampleBody fs={fs} interactive={interactive} />;

  const textStyle: React.CSSProperties = { fontSize: fs(r.fontSize), ...r.style };
  const image = (url: string, placeholder: string) =>
    url ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={url} alt="" draggable={false} className="pcs-img" />
    ) : interactive && placeholder ? (
      <div className="pcs-empty">{placeholder}</div>
    ) : null;

  if (element.kind === "signature") {
    return (
      <div className="pcs-sign">
        {r.imageUrl ? <div className="pcs-sign-img">{image(r.imageUrl, "")}</div> : null}
        <div className="pcs-sign-label" style={{ ...textStyle, paddingTop: `${(1 / W) * 100}cqw` }}>
          {r.text}
        </div>
      </div>
    );
  }
  if (element.kind === "image" || r.imageUrl) return image(r.imageUrl, r.placeholder);
  return (
    <div className="pcs-text" style={textStyle}>
      {r.text || (interactive ? <span className="pcs-ghost">{r.placeholder}</span> : null)}
    </div>
  );
}

/** The print test's filler, drawn with the print stylesheet's sizes. */
function SampleBody({ fs, interactive }: { fs: (px: number) => string; interactive: boolean }) {
  const cell: React.CSSProperties = { fontSize: fs(11), padding: `${fs(6)} ${fs(8)}` };
  return (
    <div className={interactive ? "pcs-body is-live" : "pcs-body"}>
      {interactive ? <span className="pcs-body-label">Report content</span> : null}
      <p className="pcs-h1" style={{ fontSize: fs(20), margin: `${fs(18)} 0` }}>
        Course Progress Report
      </p>
      <table className="pcs-table" style={{ marginTop: fs(8) }}>
        <thead>
          <tr>
            {["#", "Course name", "Enrolled", "Completed"].map((heading) => (
              <th key={heading} style={cell}>
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {SAMPLE_ROWS.map((row) => (
            <tr key={row.no}>
              <td style={cell}>{row.no}</td>
              <td style={cell}>{row.name}</td>
              <td style={cell}>{row.enrolled}</td>
              <td style={cell}>{row.done}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const CSS = `
  .pcs-stage {
    container-type: size;
    min-height: 0;
    display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px;
    padding: 12px; border-radius: 10px; background: #F3F4F6;
  }
  .pcs-sheet {
    container-type: inline-size;
    position: relative; overflow: hidden; flex-shrink: 0;
    width: 100%; background: #FFFFFF; color: #111827;
    font-family: Arial, Helvetica, sans-serif;
    border-radius: 6px;
    box-shadow: 0 1px 3px rgba(17,24,39,.10), 0 8px 24px rgba(17,24,39,.08);
  }
  .pcs-sheet.is-live {
    width: min(100cqw - 8px, (100cqh - 34px) * var(--pcs-ratio));
    touch-action: none;
  }
  .pcs-margins { position: absolute; pointer-events: none; border: 1px dashed rgba(249,115,22,.35); }
  .pcs-el { position: absolute; user-select: none; }
  .pcs-sheet.is-live .pcs-el { cursor: grab; outline: 1px dashed transparent; outline-offset: 1px; }
  .pcs-sheet.is-live .pcs-el:hover { outline-color: rgba(249,115,22,.6); }
  .pcs-sheet.is-live .pcs-el:focus-visible { outline: 2px solid rgba(249,115,22,.6); }
  .pcs-sheet.is-live .pcs-el.is-selected { outline: 2px solid #F97316; z-index: 3 !important; }
  .pcs-sheet.is-live .pcs-el:active { cursor: grabbing; }
  .pcs-el.is-line::before { content: ""; position: absolute; left: 0; right: 0; top: -5px; bottom: -5px; }
  .pcs-grip {
    position: absolute; right: -5px; bottom: -5px; width: 10px; height: 10px;
    border-radius: 2px; border: 1px solid #FFFFFF; background: #F97316;
    box-shadow: 0 1px 2px rgba(0,0,0,.3); cursor: nwse-resize;
  }
  .pcs-fill { width: 100%; height: 100%; }
  .pcs-img { display: block; width: 100%; height: 100%; object-fit: contain; pointer-events: none; }
  .pcs-empty {
    display: flex; align-items: center; justify-content: center; width: 100%; height: 100%;
    border: 1px dashed #CBD5E1; border-radius: 3px; color: #9CA3AF; font-size: 10px;
  }
  .pcs-text {
    display: flex; flex-direction: column; justify-content: center; height: 100%;
    line-height: 1.25; white-space: pre-line; overflow-wrap: anywhere;
  }
  .pcs-ghost { color: #CBD5E1; font-style: italic; }
  .pcs-sign { display: flex; flex-direction: column; justify-content: flex-end; height: 100%; }
  .pcs-sign-img { flex: 1; min-height: 0; }
  .pcs-sign-label { border-top: 1px solid #9CA3AF; line-height: 1.25; }
  .pcs-body { position: relative; width: 100%; height: 100%; overflow: hidden; }
  .pcs-body.is-live { outline: 1px dashed #94A3B8; background: rgba(248,250,252,.55); }
  .pcs-body-label {
    position: absolute; right: 4px; bottom: 2px; font-size: 9px; font-weight: 700;
    letter-spacing: .06em; text-transform: uppercase; color: #94A3B8;
  }
  .pcs-h1 { font-weight: 700; text-align: center; }
  .pcs-table { width: 100%; border-collapse: collapse; }
  .pcs-table th, .pcs-table td { border: 1px solid #E5E7EB; text-align: left; }
  .pcs-table th { background: #F9FAFB; }
  .pcs-caption { margin: 0; font-size: 10.5px; color: #6B7280; white-space: nowrap; }
`;
