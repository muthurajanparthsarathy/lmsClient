// printSetting.ts — fetch layer for /print-setting/*.
//
// Scope is the whole point of this module: a layout belongs either to ONE
// client, or to no client at all (the COMMON layout, `clientId: null`), which
// every client without its own falls back to. `resolvePrintSetting` is the one
// place that fallback is evaluated, server-side, so a page that prints never
// re-implements it.
//
// Assets (logos, signature, seal, watermark) are sent as multipart, because
// the server stores them in Cloudinary and returns URLs on the saved document.

import { http as apiClient } from "@/lib/http";

export interface PrintSettingClientRef {
  _id: string;
  clientCompany?: string;
  status?: string;
}

/** One styled run of text: the same knobs wherever text is configurable. */
export interface TextStyle {
  family?: string;
  size?: string;
  weight?: string;
  color?: string;
  align?: "left" | "center" | "right";
  /** CSS letter-spacing, e.g. "0.5px". Empty means normal. */
  letterSpacing?: string;
}

export type CanvasKind = "text" | "image" | "line" | "signature" | "body";

/** Canvas elements that show the form's own text or image instead of storing one. */
export type CanvasBinding =
  | "headerTitle"
  | "headerDescription"
  | "leftLogo"
  | "rightLogo"
  | "watermark"
  | "signature"
  | "seal"
  | "date"
  | "footerText";

/** One piece of a drag-and-drop layout. Geometry is a percentage of the sheet. */
export interface CanvasElement {
  id: string;
  kind: CanvasKind;
  bind?: CanvasBinding | "";
  x: number;
  y: number;
  w: number;
  h: number;
  text: string;
  /** Print px. */
  fontSize: number;
  bold: boolean;
  italic: boolean;
  align: "left" | "center" | "right";
  color: string;
  /** 0–1. */
  opacity: number;
  rotation: number;
  /** Uploaded image for an unbound image element. */
  dataUrl: string;
}

export interface PrintSetting {
  _id: string;
  institution?: string;
  /** null = the COMMON layout. Populated to a client object when scoped. */
  clientId: PrintSettingClientRef | string | null;
  status: "active" | "inactive";
  title?: string;
  description?: string;
  headerData?: {
    name?: string;
    /** Legacy name for the sub-line; `description` supersedes it. */
    address?: string;
    /** The header TITLE. */
    text?: string;
    /** The sub-line under the title, styled independently of it. */
    description?: string;
    /** Logo Yes/No. False hides the logo without discarding the upload. */
    showLogo?: boolean;
    alignment?: "left" | "center" | "right";
    logoPosition?: "left" | "right" | "both";
    /** corner = pinned to the page edge; center = tucked against the text. */
    logoPlacement?: "corner" | "center";
    background?: string;
  };
  /** Footer TEXT. Supports {{date}}, {{page}} and {{totalPages}}. */
  footerData?: { text?: string; alignment?: "left" | "center" | "right" };
  pageSettings?: {
    pageSize?: "A4" | "A3" | "Letter";
    orientation?: "portrait" | "landscape";
    showHeader?: boolean;
    showFooter?: boolean;
    margins?: { top?: number; bottom?: number; left?: number; right?: number };
  };
  typography?: {
    /** The header title. */
    headerData?: TextStyle;
    /** The header sub-line, styled apart from the title. */
    headerDescription?: TextStyle;
    footerData?: TextStyle;
  };
  signature?: {
    signatureUrl?: string;
    sealUrl?: string;
    /** Printed heights in px, as the header logos express theirs. */
    signatureHeight?: number;
    sealHeight?: number;
  };
  logoSettings?: {
    showLeftLogo?: boolean;
    showRightLogo?: boolean;
    /** Legacy t-shirt sizes, superseded by the *Height fields. */
    leftLogoSize?: "small" | "medium" | "large";
    rightLogoSize?: "small" | "medium" | "large";
    /** Printed height in px. Wins over the size enum when set. */
    leftLogoHeight?: number;
    rightLogoHeight?: number;
    leftLogoUrl?: string;
    rightLogoUrl?: string;
  };
  watermarkSettings?: {
    showWatermark?: boolean;
    /** Which watermark prints — both can be stored, this decides. */
    type?: "text" | "image";
    opacity?: number;
    /** Degrees; `position` anchors the stamp, this turns it. */
    rotation?: number;
    /** Percent of natural width, for an image watermark. */
    scale?: number;
    size?: "small" | "medium" | "large";
    watermarkUrl?: string;
    fontWeight?: string;
    /** px, matching how header and footer express their size. */
    fontSize?: string;
    letterSpacing?: string;
    /** Printed width in px for an image watermark. Wins over `scale`. */
    imageWidth?: number;
    /** Text stamp ("CONFIDENTIAL"), independent of watermarkUrl. */
    text?: string;
    position?: "center" | "diagonal" | "top" | "bottom";
    fontStyle?: "normal" | "italic" | "bold";
    fontFamily?: string;
    color?: string;
  };
  footerSetting?: {
    showSignatory?: boolean;
    showDate?: boolean;
    showSeal?: boolean;
    signatoryPosition?: 1 | 2 | 3;
    datePosition?: 1 | 2 | 3;
    sealPosition?: 1 | 2 | 3;
  };
  /** Drag-and-drop layout; empty means the flow layout. */
  canvasElements?: CanvasElement[];
  createdAt?: string;
  updatedAt?: string;
}

/** The five uploadable images, keyed by the form field the server reads. */
export type PrintAssetField =
  | "leftLogo"
  | "rightLogo"
  | "signature"
  | "seal"
  | "watermark";

export type PrintSettingFiles = Partial<Record<PrintAssetField, File | null>>;

/** The server's legacy envelope: `{ message: [{ key, value }], ...payload }`. */
const messageOf = (data: unknown, fallback: string): string => {
  const list = (data as { message?: { value?: string }[] } | undefined)?.message;
  return Array.isArray(list) && list[0]?.value ? list[0].value : fallback;
};

const asError = (error: unknown, fallback: string): Error => {
  const response = (error as { response?: { data?: unknown } })?.response;
  return new Error(
    response ? messageOf(response.data, fallback) : (error as Error)?.message || fallback
  );
};

/**
 * Flattens the nested layout into the bracketed multipart keys the server
 * unpacks (`pageSettings[pageSize]`). Booleans are stringified because
 * multipart carries no types — the server casts them back.
 */
const appendSection = (
  form: FormData,
  name: string,
  values: Record<string, unknown> | undefined
) => {
  if (!values) return;
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined || value === null || value === "") continue;
    // Server-issued URLs are read-only here; a new file replaces them.
    if (key.endsWith("Url")) continue;
    form.append(`${name}[${key}]`, String(value));
  }
};

const buildForm = (
  input: Partial<PrintSetting>,
  files?: PrintSettingFiles,
  /** Stored images to clear. Uploading a replacement is not the same thing
   *  as wanting no image at all, so removal is said explicitly. */
  removeAssets?: PrintAssetField[]
): FormData => {
  const form = new FormData();
  if (removeAssets?.length) form.append("removeAssets", removeAssets.join(","));

  if (input.title !== undefined) form.append("title", input.title ?? "");
  if (input.description !== undefined) form.append("description", input.description ?? "");
  if (input.status !== undefined) form.append("status", input.status);

  // "" is meaningful: it is how the COMMON layout is expressed.
  if (input.clientId !== undefined) {
    const value =
      typeof input.clientId === "string"
        ? input.clientId
        : input.clientId?._id || "";
    form.append("clientId", value);
  }

  appendSection(form, "headerData", input.headerData);
  appendSection(form, "footerData", input.footerData);
  // margins is nested one level deeper than appendSection flattens, so it is
  // appended explicitly rather than silently dropped.
  const { margins, ...pageRest } = input.pageSettings || {};
  appendSection(form, "pageSettings", pageRest);
  if (margins) {
    for (const [side, value] of Object.entries(margins)) {
      if (value === undefined || value === null) continue;
      form.append(`pageSettings[margins][${side}]`, String(value));
    }
  }
  appendSection(form, "signature", input.signature);
  appendSection(form, "logoSettings", input.logoSettings);
  appendSection(form, "watermarkSettings", input.watermarkSettings);
  appendSection(form, "footerSetting", input.footerSetting);
  if (input.canvasElements !== undefined) {
    form.append("canvasElements", JSON.stringify(input.canvasElements));
  }

  for (const group of ["headerData", "headerDescription", "footerData"] as const) {
    const values = input.typography?.[group];
    if (!values) continue;
    for (const [key, value] of Object.entries(values)) {
      if (value === undefined || value === null || value === "") continue;
      form.append(`typography[${group}][${key}]`, String(value));
    }
  }

  for (const [field, file] of Object.entries(files || {})) {
    if (file) form.append(field, file);
  }

  return form;
};

export const fetchPrintSettings = async (): Promise<PrintSetting[]> => {
  try {
    const response = await apiClient.get("/print-setting/getAll");
    return response.data?.printSettings ?? [];
  } catch (error) {
    throw asError(error, "Could not load print settings");
  }
};

/**
 * The layout a print should use for `clientId` — that client's own if it has
 * one, otherwise the institution's common layout. Pass nothing for a print
 * that is not tied to a client.
 */
export const resolvePrintSetting = async (
  clientId?: string | null
): Promise<{ printSetting: PrintSetting | null; source: "client" | "common" | "none" }> => {
  try {
    const response = await apiClient.get("/print-setting/resolve", {
      params: clientId ? { clientId } : {},
    });
    return {
      printSetting: response.data?.printSetting ?? null,
      source: response.data?.source ?? "none",
    };
  } catch (error) {
    throw asError(error, "Could not resolve a print setting");
  }
};

export const printSettingService = {
  create: async (input: Partial<PrintSetting>, files?: PrintSettingFiles) => {
    try {
      const response = await apiClient.post("/print-setting/create", buildForm(input, files), {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return response.data;
    } catch (error) {
      throw asError(error, "Could not create the print setting");
    }
  },

  update: async (
    id: string,
    input: Partial<PrintSetting>,
    files?: PrintSettingFiles,
    removeAssets?: PrintAssetField[]
  ) => {
    try {
      const response = await apiClient.put(
        `/print-setting/update/${id}`,
        buildForm(input, files, removeAssets),
        { headers: { "Content-Type": "multipart/form-data" } }
      );
      return response.data;
    } catch (error) {
      throw asError(error, "Could not update the print setting");
    }
  },

  remove: async (id: string) => {
    try {
      const response = await apiClient.delete(`/print-setting/delete/${id}`);
      return response.data;
    } catch (error) {
      throw asError(error, "Could not delete the print setting");
    }
  },
};
