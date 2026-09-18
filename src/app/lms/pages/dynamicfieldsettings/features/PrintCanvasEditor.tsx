"use client";

import * as React from "react";
import { toast } from "sonner";
import {
  Copy,
  Hash,
  Image as ImageIcon,
  LayoutTemplate,
  Minus,
  PenTool,
  Plus,
  Stamp,
  Trash2,
  Type as TypeIcon,
  type LucideIcon,
} from "lucide-react";
import type {
  CanvasBinding,
  CanvasElement,
  CanvasKind,
  PrintAssetField,
  PrintSetting,
} from "../api/printSetting";
import {
  BOUND_FIELDS,
  newCanvasElement,
  resolveCanvasElement,
  seedCanvas,
  writeCanvasBinding,
} from "@/app/lms/shared/print/printLayout";
import PrintCanvasSheet from "./PrintCanvasSheet";

type SettingUpdater = (draft: Partial<PrintSetting>) => Partial<PrintSetting>;
type Loose = Record<string, unknown>;

/* ── Undo / redo ─────────────────────────────────────────────────────────── */

type FieldChange = { path: string[]; before: unknown; after: unknown };

type HistoryEntry = {
  /** The whole canvas either side of the change; [] means no custom layout yet. */
  elements?: { before: CanvasElement[]; after: CanvasElement[] };
  /** Only the form fields this change wrote, so undo leaves other form edits alone. */
  fields?: FieldChange[];
  /** Changes sharing a key in quick succession merge into one step — typing, sliders, held arrow keys. */
  key?: string;
  at: number;
};

export type DesignerHistory = { undo: HistoryEntry[]; redo: HistoryEntry[] };

/** Kept by the dialog rather than the designer, so undo survives switching to the preview and back. */
export const useDesignerHistory = () => React.useState<DesignerHistory>(() => ({ undo: [], redo: [] }))[0];

export const clearDesignerHistory = (history: DesignerHistory) => {
  history.undo.length = 0;
  history.redo.length = 0;
};

const HISTORY_LIMIT = 100;
const MERGE_MS = 1000;

/** Every form field writeCanvasBinding can change. */
const BOUND_PATHS: string[][] = [
  ["headerData", "text"],
  ["headerData", "description"],
  ["footerData", "text"],
  ...["headerData", "headerDescription", "footerData"].flatMap((group) =>
    ["size", "weight", "align", "color"].map((key) => ["typography", group, key])
  ),
  ...["text", "fontSize", "fontWeight", "fontStyle", "color", "opacity", "rotation"].map((key) => [
    "watermarkSettings",
    key,
  ]),
];

const getPath = (source: unknown, path: string[]): unknown =>
  path.reduce<unknown>((value, key) => (value && typeof value === "object" ? (value as Loose)[key] : undefined), source);

const setPath = (target: Loose, [head, ...rest]: string[], value: unknown): Loose => ({
  ...target,
  [head]: rest.length ? setPath((target[head] as Loose | undefined) || {}, rest, value) : value,
});

/* ── Labels and presets ──────────────────────────────────────────────────── */

const BOUND_LABEL: Record<CanvasBinding, string> = {
  headerTitle: "Header title",
  headerDescription: "Header description",
  leftLogo: "Left logo",
  rightLogo: "Right logo",
  watermark: "Watermark",
  signature: "Signature",
  seal: "Seal",
  date: "Date",
  footerText: "Footer text",
};

const KIND_LABEL: Record<CanvasKind, string> = {
  text: "Text",
  image: "Image",
  line: "Line",
  signature: "Signature",
  body: "Report content",
};

const labelOf = (el: CanvasElement) => (el.bind ? BOUND_LABEL[el.bind] : KIND_LABEL[el.kind]);

const PRESETS: { kind: CanvasKind; label: string; icon: LucideIcon; patch: Partial<CanvasElement> }[] = [
  { kind: "text", label: "Text", icon: TypeIcon, patch: { text: "Text", x: 10, y: 45, w: 40, h: 5, fontSize: 14 } },
  { kind: "image", label: "Image", icon: ImageIcon, patch: { x: 10, y: 45, w: 16, h: 9 } },
  { kind: "line", label: "Line", icon: Minus, patch: { x: 6, y: 50, w: 88, h: 0.3, color: "#D0D5DD" } },
  {
    kind: "text",
    label: "Watermark",
    icon: Stamp,
    patch: { text: "CONFIDENTIAL", x: 10, y: 44, w: 80, h: 10, fontSize: 64, bold: true, align: "center", color: "#9CA3AF", opacity: 0.12, rotation: -30 },
  },
  {
    kind: "signature",
    label: "Signature",
    icon: PenTool,
    patch: { text: "Authorised signatory", x: 64, y: 84, w: 28, h: 7, fontSize: 11, align: "center", color: "#6B7280" },
  },
  {
    kind: "text",
    label: "Page number",
    icon: Hash,
    patch: { text: "Page {{page}} of {{totalPages}}", x: 70, y: 95, w: 24, h: 3, fontSize: 10, align: "right", color: "#6B7280" },
  },
];

const SHORTCUTS: [string, string][] = [
  ["Ctrl+C", "Copy"],
  ["Ctrl+X", "Cut"],
  ["Ctrl+V", "Paste"],
  ["Ctrl+D", "Duplicate"],
  ["Ctrl+Z", "Undo"],
  ["Ctrl+Y", "Redo"],
  ["Del", "Delete"],
  ["← ↑ → ↓", "Nudge"],
];

/** The server keeps at most this many pieces per layout. */
const MAX_ELEMENTS = 80;
/** How far, in % of the page, a duplicate or paste lands from its source. */
const OFFSET = 2;
const GRID = 0.5;
const snap = (value: number) => Math.round(value / GRID) * GRID;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const placeX = (x: number) => snap(clamp(x, -10, 99));
const placeY = (y: number) => snap(clamp(y, -10, 99.5));

const NUDGE: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};

/** Module-level so a piece copied in one layout can be pasted after opening another. */
let clipboard: { element: CanvasElement; offset: number } | null = null;

let idSeq = 0;
const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}${(idSeq++).toString(36)}`;

const isEditable = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable || target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT");

/** The shortcut letter, read by key position when the keyboard layout does not type Latin letters. */
const shortcutLetter = (event: React.KeyboardEvent) =>
  /^[a-z]$/i.test(event.key) ? event.key.toLowerCase() : event.code.replace(/^Key/, "").toLowerCase();

const hex = (color: string) => (/^#[0-9a-f]{6}$/i.test(color) ? color : "#000000");
const isBold = (weight: string) => ["bold", "bolder", "600", "700", "800", "900"].includes(String(weight));

const assetFieldOf = (el: CanvasElement, setting: Partial<PrintSetting>): PrintAssetField | null => {
  switch (el.bind) {
    case "leftLogo":
      return "leftLogo";
    case "rightLogo":
      return setting.headerData?.logoPosition === "both" ? "leftLogo" : "rightLogo";
    case "seal":
      return "seal";
    case "signature":
      return "signature";
    case "watermark":
      return setting.watermarkSettings?.type === "image" ? "watermark" : null;
    default:
      return null;
  }
};

const rawTextOf = (el: CanvasElement, setting: Partial<PrintSetting>) => {
  switch (el.bind) {
    case "headerTitle":
      return setting.headerData?.text || "";
    case "headerDescription":
      return setting.headerData?.description || "";
    case "footerText":
      return setting.footerData?.text || "";
    case "watermark":
      return setting.watermarkSettings?.text || "";
    default:
      return el.text;
  }
};

/** The drag-and-drop designer: toolbar, the live page, and the selected piece's properties. */
export default function PrintCanvasEditor({
  setting,
  elements,
  committed,
  history,
  onElementsChange,
  onSettingChange,
  onPickAsset,
}: {
  /** The draft with just-picked images overlaid — what the page renders. */
  setting: Partial<PrintSetting>;
  elements: CanvasElement[];
  /** False while the page still shows the layout generated from the form. */
  committed: boolean;
  history: DesignerHistory;
  onElementsChange: (next: CanvasElement[]) => void;
  onSettingChange: (updater: SettingUpdater) => void;
  onPickAsset: (field: PrintAssetField, file: File) => void;
}) {
  const rootRef = React.useRef<HTMLDivElement>(null);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const selected = elements.find((el) => el.id === selectedId) || null;
  const canCopy = !!selected && selected.kind !== "body";

  const record = (entry: Omit<HistoryEntry, "at">) => {
    const now = Date.now();
    const top = history.undo[history.undo.length - 1];
    history.redo.length = 0;
    if (entry.key && top && top.key === entry.key && now - top.at < MERGE_MS) {
      if (entry.elements) {
        top.elements = { before: top.elements ? top.elements.before : entry.elements.before, after: entry.elements.after };
      }
      for (const change of entry.fields || []) {
        const same = top.fields?.find((item) => item.path.join(".") === change.path.join("."));
        if (same) same.after = change.after;
        else top.fields = [...(top.fields || []), change];
      }
      top.at = now;
      return;
    }
    history.undo.push({ ...entry, at: now });
    if (history.undo.length > HISTORY_LIMIT) history.undo.shift();
  };

  const commitElements = (next: CanvasElement[], key?: string) => {
    record({ elements: { before: committed ? elements : [], after: next }, key });
    onElementsChange(next);
  };

  const patchElement = (id: string, patch: Partial<CanvasElement>, key?: string) =>
    commitElements(elements.map((el) => (el.id === id ? { ...el, ...patch } : el)), key);

  const commitBinding = (bind: CanvasBinding, patch: Partial<CanvasElement>, key?: string) => {
    const next = writeCanvasBinding(setting, bind, patch);
    const fields = BOUND_PATHS.map((path) => ({ path, before: getPath(setting, path), after: getPath(next, path) })).filter(
      (change) => change.before !== change.after
    );
    if (fields.length) record({ fields, key });
    onSettingChange((draft) => writeCanvasBinding(draft, bind, patch));
  };

  /** Routes each field to where it lives: the form for linked text and style, the element otherwise. */
  const write = (el: CanvasElement, patch: Partial<CanvasElement>, merge = true) => {
    const owned = (el.bind && BOUND_FIELDS[el.bind]) || [];
    const toSetting: Partial<CanvasElement> = {};
    const toElement: Partial<CanvasElement> = {};
    for (const [key, value] of Object.entries(patch) as [keyof CanvasElement, never][]) {
      if (owned.includes(key)) toSetting[key] = value;
      else toElement[key] = value;
    }
    const fieldsKey = Object.keys(patch).join(",");
    if (el.bind && Object.keys(toSetting).length) {
      commitBinding(el.bind, toSetting, merge ? `form:${el.bind}:${fieldsKey}` : undefined);
    }
    if (Object.keys(toElement).length) {
      patchElement(el.id, toElement, merge ? `piece:${el.id}:${fieldsKey}` : undefined);
    }
  };

  const applyEntry = (entry: HistoryEntry, side: "before" | "after") => {
    if (entry.elements) onElementsChange(entry.elements[side]);
    const fields = entry.fields;
    if (fields?.length) {
      onSettingChange(
        (draft) =>
          fields.reduce<Loose>((acc, change) => setPath(acc, change.path, change[side]), draft as unknown as Loose) as unknown as Partial<PrintSetting>
      );
    }
    // The focused piece may be about to disappear; keep focus in the designer for the next shortcut.
    rootRef.current?.focus({ preventScroll: true });
  };

  const undo = () => {
    const entry = history.undo.pop();
    if (!entry) return;
    applyEntry(entry, "before");
    history.redo.push(entry);
    const top = history.undo[history.undo.length - 1];
    if (top) top.at = 0;
  };

  const redo = () => {
    const entry = history.redo.pop();
    if (!entry) return;
    applyEntry(entry, "after");
    history.undo.push({ ...entry, at: 0 });
  };

  const insert = (element: CanvasElement) => {
    if (elements.length >= MAX_ELEMENTS) {
      toast.error(`A layout can hold up to ${MAX_ELEMENTS} pieces.`);
      return false;
    }
    commitElements([...elements, element]);
    setSelectedId(element.id);
    return true;
  };

  const refuseBody = () => toast.info("The report content box stays on the page — drag it to move it.");

  const add = (preset: (typeof PRESETS)[number]) =>
    insert({ ...newCanvasElement(preset.kind, newId(preset.kind)), ...preset.patch });

  // A copy of a form-linked piece stays linked: same logo, text and style, its own position.
  const duplicate = () => {
    if (!selected) return;
    if (selected.kind === "body") return refuseBody();
    insert({
      ...selected,
      id: newId(selected.bind || selected.kind),
      x: placeX(selected.x + OFFSET),
      y: placeY(selected.y + OFFSET),
    });
  };

  const remove = () => {
    if (!selected) return;
    if (selected.kind === "body") return refuseBody();
    commitElements(elements.filter((el) => el.id !== selected.id));
    setSelectedId(null);
    rootRef.current?.focus({ preventScroll: true });
  };

  const copy = () => {
    if (!selected) return;
    if (selected.kind === "body") return refuseBody();
    clipboard = { element: { ...selected }, offset: OFFSET };
  };

  const cut = () => {
    if (!selected) return;
    if (selected.kind === "body") return refuseBody();
    // The first paste after a cut goes back exactly where the piece was.
    clipboard = { element: { ...selected }, offset: 0 };
    remove();
  };

  const paste = () => {
    if (!clipboard) return;
    const { element, offset } = clipboard;
    const pasted = {
      ...element,
      id: newId(element.bind || element.kind),
      x: placeX(element.x + offset),
      y: placeY(element.y + offset),
    };
    if (!insert(pasted)) return;
    clipboard = { element, offset: offset + OFFSET };
    if (!resolveCanvasElement(pasted, setting).visible) {
      toast.info(`${labelOf(pasted)} is switched off in the form, so the pasted copy is hidden.`);
    }
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (isEditable(event.target)) return;

    if ((event.ctrlKey || event.metaKey) && !event.altKey) {
      const letter = shortcutLetter(event);
      if (letter === "z" || letter === "y") {
        const redoing = letter === "y" || event.shiftKey;
        if (!(redoing ? history.redo : history.undo).length) return;
        event.preventDefault();
        if (redoing) redo();
        else undo();
        return;
      }
      const action =
        letter === "v" ? (clipboard ? paste : null)
        : !selected ? null
        : letter === "c" ? copy
        : letter === "x" ? cut
        : letter === "d" ? duplicate
        : null;
      if (!action) return;
      event.preventDefault();
      if (!event.repeat) action();
      return;
    }

    if (!selected || event.altKey) return;
    const delta = NUDGE[event.key];
    if (delta) {
      event.preventDefault();
      const step = event.shiftKey ? 2 : GRID;
      patchElement(
        selected.id,
        { x: placeX(selected.x + delta[0] * step), y: placeY(selected.y + delta[1] * step) },
        `nudge:${selected.id}`
      );
    } else if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      remove();
    }
  };

  const autoLayout = () => {
    commitElements(seedCanvas(setting));
    setSelectedId(null);
    toast.success("Arranged from the form — Save to keep it");
  };

  const seeded = React.useMemo(() => seedCanvas(setting), [setting]);
  // Form pieces the form still shows but which were deleted from the page.
  const missing = seeded.filter(
    (el) => el.bind && !elements.some((item) => item.bind === el.bind) && resolveCanvasElement(el, setting).visible
  );

  const pickOwnImage = (el: CanvasElement, file?: File) => {
    if (!file) return;
    if (file.size > 250_000) {
      toast.error("Use an image under 250 KB — it is stored inside the layout.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => patchElement(el.id, { dataUrl: String(reader.result || "") });
    reader.onerror = () => toast.error("Could not read that image");
    reader.readAsDataURL(file);
  };

  return (
    <div ref={rootRef} className="pce" tabIndex={-1} onKeyDown={onKeyDown}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      <div className="pce-toolbar">
        <span className="pce-label">Add</span>
        {PRESETS.map((preset) => (
          <button key={preset.label} type="button" className="pce-btn" onClick={() => add(preset)}>
            <preset.icon aria-hidden className="size-3.5" />
            {preset.label}
          </button>
        ))}
        <span className="pce-actions">
          <button type="button" className="pce-btn" onClick={autoLayout} title="Re-arrange every piece from the form's settings">
            <LayoutTemplate aria-hidden className="size-3.5" />
            Auto layout
          </button>
          <button type="button" className="pce-btn" disabled={!canCopy} onClick={duplicate} title="Duplicate (Ctrl+D)">
            <Copy aria-hidden className="size-3.5" />
            Duplicate
          </button>
          <button type="button" className="pce-btn is-danger" disabled={!canCopy} onClick={remove} title="Delete (Del)">
            <Trash2 aria-hidden className="size-3.5" />
            Delete
          </button>
        </span>
      </div>

      <div className="pce-grid">
        <PrintCanvasSheet
          setting={setting}
          elements={elements}
          interactive
          selectedId={selectedId}
          onSelect={setSelectedId}
          onGeometry={patchElement}
        />
        <aside className="pce-panel">
          {selected ? (
            <Properties
              el={selected}
              setting={setting}
              linkedCount={selected.bind ? elements.filter((el) => el.bind === selected.bind).length : 0}
              write={write}
              patchElement={patchElement}
              onPickAsset={onPickAsset}
              pickOwnImage={pickOwnImage}
            />
          ) : (
            <>
              <p className="pce-hint">
                Click a piece to move or edit it. The header, logos, footer, watermark, signature and seal stay linked
                to the form.
              </p>
              {missing.length ? (
                <>
                  <p className="pce-sub">Not on the page</p>
                  <div className="pce-chips">
                    {missing.map((el) => (
                      <button
                        key={el.id}
                        type="button"
                        className="pce-chip"
                        onClick={() => insert({ ...el, id: newId(el.bind || el.kind) })}
                      >
                        <Plus aria-hidden className="size-3" />
                        {labelOf(el)}
                      </button>
                    ))}
                  </div>
                </>
              ) : null}
              <p className="pce-sub">Shortcuts</p>
              <ul className="pce-keys">
                {SHORTCUTS.map(([keys, label]) => (
                  <li key={label}>
                    <kbd>{keys}</kbd>
                    {label}
                  </li>
                ))}
              </ul>
              <p className="pce-note">Hold Shift with the arrow keys for bigger steps.</p>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}

function Properties({
  el,
  setting,
  linkedCount,
  write,
  patchElement,
  onPickAsset,
  pickOwnImage,
}: {
  el: CanvasElement;
  setting: Partial<PrintSetting>;
  linkedCount: number;
  write: (el: CanvasElement, patch: Partial<CanvasElement>, merge?: boolean) => void;
  patchElement: (id: string, patch: Partial<CanvasElement>, key?: string) => void;
  onPickAsset: (field: PrintAssetField, file: File) => void;
  pickOwnImage: (el: CanvasElement, file?: File) => void;
}) {
  const r = resolveCanvasElement(el, setting);
  const bind = el.bind || "";
  const textLike = el.kind === "text" || el.kind === "signature";
  const typographyBound = bind === "headerTitle" || bind === "headerDescription" || bind === "footerText";
  const markIsImage = bind === "watermark" && setting.watermarkSettings?.type === "image";
  const showText = !markIsImage && ((!bind && textLike) || typographyBound || bind === "watermark");
  const showType = !markIsImage && textLike && bind !== "signature";
  const assetField = assetFieldOf(el, setting);
  const bold = isBold(r.style.fontWeight);

  return (
    <>
      <p className="pce-title">{labelOf(el)}</p>
      <p className="pce-hint">
        {el.kind === "body"
          ? "The report's own table prints inside this box."
          : !bind
            ? "Only on this layout."
            : linkedCount > 1
              ? `Linked to the form — all ${linkedCount} copies show the same content.`
              : "Linked to the form."}
      </p>

      {showText ? (
        <label className="pce-field">
          <span>Text</span>
          {bind === "headerDescription" ? (
            <textarea rows={2} value={rawTextOf(el, setting)} onChange={(e) => write(el, { text: e.target.value })} />
          ) : (
            <input value={rawTextOf(el, setting)} onChange={(e) => write(el, { text: e.target.value })} />
          )}
        </label>
      ) : null}
      {showText && (bind === "footerText" || !bind) ? (
        <p className="pce-note">{"Tokens: {{date}} · {{page}} · {{totalPages}}"}</p>
      ) : null}

      {assetField || (el.kind === "image" && !bind) ? (
        <label className="pce-file">
          <ImageIcon aria-hidden className="size-3.5" />
          {r.imageUrl ? "Replace image" : "Upload image"}
          <input
            type="file"
            accept={assetField ? "image/*" : "image/png,image/jpeg,image/webp,image/svg+xml"}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (assetField && file) onPickAsset(assetField, file);
              else if (!assetField) pickOwnImage(el, file);
              e.target.value = "";
            }}
          />
        </label>
      ) : null}

      {showType ? (
        <>
          <div className="pce-2">
            <label className="pce-field">
              <span>Size (px)</span>
              <input
                type="number"
                min={4}
                max={400}
                value={r.fontSize}
                onChange={(e) => {
                  const size = Number(e.target.value);
                  if (size > 0) write(el, { fontSize: Math.min(400, size) });
                }}
              />
            </label>
            <label className="pce-field">
              <span>Colour</span>
              <input type="color" value={hex(r.style.color)} onChange={(e) => write(el, { color: e.target.value })} />
            </label>
          </div>
          <div className="pce-row">
            {bind !== "watermark" ? (
              <div className="pce-seg">
                {(["left", "center", "right"] as const).map((align) => (
                  <button
                    key={align}
                    type="button"
                    className={r.style.textAlign === align ? "is-on" : ""}
                    onClick={() => write(el, { align }, false)}
                  >
                    {align}
                  </button>
                ))}
              </div>
            ) : null}
            <button
              type="button"
              aria-pressed={bold}
              className={bold ? "pce-mark is-on" : "pce-mark"}
              style={{ fontWeight: 800 }}
              onClick={() => write(el, { bold: !bold }, false)}
            >
              B
            </button>
            {!typographyBound ? (
              <button
                type="button"
                aria-pressed={r.style.fontStyle === "italic"}
                className={r.style.fontStyle === "italic" ? "pce-mark is-on" : "pce-mark"}
                style={{ fontStyle: "italic" }}
                onClick={() => write(el, { italic: r.style.fontStyle !== "italic" }, false)}
              >
                I
              </button>
            ) : null}
          </div>
        </>
      ) : null}

      {el.kind === "line" ? (
        <label className="pce-field">
          <span>Colour</span>
          <input type="color" value={hex(el.color)} onChange={(e) => write(el, { color: e.target.value })} />
        </label>
      ) : null}

      {el.kind !== "body" ? (
        <div className="pce-2">
          <label className="pce-field">
            <span>Opacity {Math.round(r.opacity * 100)}%</span>
            <input
              type="range"
              min={2}
              max={100}
              value={Math.round(r.opacity * 100)}
              onChange={(e) => write(el, { opacity: Number(e.target.value) / 100 })}
            />
          </label>
          <label className="pce-field">
            <span>Rotation {r.rotation}°</span>
            <input
              type="range"
              min={-180}
              max={180}
              value={r.rotation}
              onChange={(e) => write(el, { rotation: Number(e.target.value) })}
            />
          </label>
        </div>
      ) : null}

      <div className="pce-4">
        {(["x", "y", "w", "h"] as const).map((key) => (
          <label key={key} className="pce-field">
            <span>{key.toUpperCase()} %</span>
            <input
              type="number"
              step={0.5}
              value={Math.round(el[key] * 10) / 10}
              onChange={(e) => {
                const value = Number(e.target.value);
                if (e.target.value !== "" && Number.isFinite(value)) {
                  patchElement(el.id, { [key]: value }, `geom:${el.id}:${key}`);
                }
              }}
            />
          </label>
        ))}
      </div>
      <p className="pce-note">Position and size as a percentage of the page.</p>
    </>
  );
}

const CSS = `
  .pce {
    flex: 1 1 auto; min-height: 0; min-width: 0;
    display: flex; flex-direction: column; gap: 10px;
  }
  .pce:focus { outline: none; }
  .pce-toolbar {
    display: flex; flex-wrap: wrap; align-items: center; gap: 6px;
    padding: 8px 10px; border-radius: 10px; background: #FFFFFF; border: 1px solid #FFE4CC;
  }
  .pce-label { padding: 0 2px; font-size: 11px; font-weight: 700; color: #9A3412; }
  /* One group, so on a narrow pane it wraps to the next row as a whole, right-aligned. */
  .pce-actions { display: flex; flex-wrap: wrap; gap: 6px; margin-left: auto; }
  .pce-btn {
    display: inline-flex; align-items: center; gap: 5px; height: 28px; padding: 0 10px;
    border-radius: 8px; border: 1px solid #FDBA8C; background: #FFFFFF; color: #C2410C;
    font-size: 11.5px; font-weight: 600; cursor: pointer; transition: background .15s, border-color .15s;
  }
  .pce-btn:hover:not(:disabled) { background: #FFF7ED; border-color: #F97316; }
  .pce-btn:disabled { opacity: .45; cursor: not-allowed; }
  .pce-btn.is-danger { color: #DC2626; border-color: #FCA5A5; }
  .pce-btn.is-danger:hover:not(:disabled) { background: #FEF2F2; border-color: #DC2626; }

  .pce-grid {
    flex: 1 1 auto; min-height: 440px;
    display: grid; gap: 10px;
    grid-template-columns: minmax(0, 1fr) 250px;
    grid-template-rows: minmax(0, 1fr);
  }
  /* Stacked: the designer takes its natural height and the pane scrolls. */
  @media (max-width: 1100px) {
    .pce, .pce-grid { flex: none; }
    .pce-grid { grid-template-columns: minmax(0, 1fr); grid-template-rows: none; min-height: 0; }
    .pce .pcs-stage { height: 560px; }
    .pce-panel { overflow: visible; }
  }

  .pce-panel {
    min-height: 0; overflow-y: auto;
    padding: 12px; border-radius: 10px; background: #FFFFFF; border: 1px solid #EFEFEF;
  }
  .pce-title { margin: 0; font-size: 13px; font-weight: 700; color: #9A3412; }
  .pce-hint { margin: 3px 0 8px; font-size: 11px; line-height: 1.5; color: #6B7280; }
  .pce-note { margin: 6px 0 0; font-size: 10.5px; color: #9CA3AF; }
  .pce-sub {
    margin: 14px 0 7px; font-size: 10.5px; font-weight: 700;
    letter-spacing: .05em; text-transform: uppercase; color: #C2410C;
  }

  .pce-chips { display: flex; flex-wrap: wrap; gap: 6px; }
  .pce-chip {
    display: inline-flex; align-items: center; gap: 4px; height: 26px; padding: 0 9px;
    border-radius: 999px; border: 1px dashed #FDBA8C; background: #FFFBF7; color: #C2410C;
    font-size: 11px; font-weight: 600; cursor: pointer;
  }
  .pce-chip:hover { background: #FFF7ED; border-color: #F97316; }

  .pce-keys {
    display: grid; grid-template-columns: repeat(2, max-content); gap: 7px 16px;
    margin: 0; padding: 0; list-style: none;
  }
  .pce-keys li { display: flex; align-items: center; gap: 5px; font-size: 11px; color: #4B5563; white-space: nowrap; }
  .pce-keys kbd {
    padding: 1px 4px; border: 1px solid #E5E7EB; border-bottom-width: 2px; border-radius: 5px; background: #F9FAFB;
    font: 600 10px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace; color: #374151;
  }

  .pce .pce-field { display: block; margin: 8px 0 0 !important; }
  .pce .pce-field > span {
    display: block; margin-bottom: 3px; font-size: 10.5px; font-weight: 600; color: #6B7280 !important;
  }
  .pce .pce-field > input:not([type="range"]):not([type="color"]),
  .pce .pce-field > textarea {
    width: 100%; height: 32px !important; padding: 0 8px !important; font-size: 12px !important;
  }
  .pce .pce-field > textarea { height: auto !important; min-height: 52px; padding: 6px 8px !important; }
  .pce .pce-field > input[type="color"] {
    display: block; width: 100%; height: 32px; padding: 2px; cursor: pointer;
    border: 1px solid #E7E7E7; border-radius: 8px; background: #FFFFFF;
  }
  .pce .pce-field > input[type="range"] { width: 100%; }

  .pce-2 { display: grid; gap: 8px; grid-template-columns: 1fr 1fr; }
  .pce-4 { display: grid; gap: 6px; grid-template-columns: repeat(4, minmax(0, 1fr)); margin-top: 4px; }
  .pce-row { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-top: 9px; }
  .pce-seg { display: inline-flex; overflow: hidden; border: 1px solid #FDBA8C; border-radius: 8px; }
  .pce-seg button {
    padding: 4px 8px; border: 0; background: #FFFFFF; color: #6B7280;
    font-size: 11px; text-transform: capitalize; cursor: pointer;
  }
  .pce-seg button.is-on { background: #FFF7ED; color: #C2410C; font-weight: 700; }
  .pce-mark {
    min-width: 28px; height: 26px; border-radius: 8px; border: 1px solid #FDBA8C;
    background: #FFFFFF; color: #6B7280; font-size: 12px; cursor: pointer;
  }
  .pce-mark.is-on { background: #FFF7ED; border-color: #F97316; color: #C2410C; }

  .pce .pce-file {
    display: flex !important; align-items: center; justify-content: center; gap: 6px;
    margin: 10px 0 0 !important; padding: 7px 10px; border-radius: 8px; cursor: pointer;
    border: 1px dashed #FDBA8C; background: #FFFBF7;
    font-size: 11.5px !important; font-weight: 700 !important; color: #C2410C !important;
  }
  .pce .pce-file:hover { background: #FFF7ED; border-color: #F97316; }
  .pce .pce-file input { display: none; }
`;
