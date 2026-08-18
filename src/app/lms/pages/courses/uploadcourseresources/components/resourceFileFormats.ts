/**
 * Which file formats a course actually accepts.
 *
 * Course Setup's Resource Type section decides which resource types a course
 * runs (video / ppt / pdf / image / zip …). Everything that lets a user put a
 * file into the course — the Upload Files modal, the Folder Builder, the
 * per-type upload modal — validates through here, so a type the course didn't
 * enable has no way in: not by browsing, not by drag & drop.
 *
 * Keys are the Course Setup config keys (`resourcesType.iDo.<key>`).
 */

export type TypeFileRule = { label: string; color: string; extensions: string[] };

/**
 * `document` and `audio` have no Course Setup switch — they are only reachable
 * through LEGACY_ALLOWED_TYPES, so a course saved before the resource config
 * existed keeps accepting what it always did.
 */
export const TYPE_FILE_RULES: Record<string, TypeFileRule> = {
  pdf:      { label: "PDF",    color: "#EF4444", extensions: ["pdf"] },
  ppt:      { label: "PPTX",   color: "#F97316", extensions: ["ppt", "pptx"] },
  document: { label: "DOCX",   color: "#3B82F6", extensions: ["doc", "docx", "txt"] },
  image:    { label: "Images", color: "#7C3AED", extensions: ["png", "jpg", "jpeg", "gif", "webp", "svg"] },
  video:    { label: "Video",  color: "#0891B2", extensions: ["mp4", "mov", "avi", "mkv", "webm"] },
  audio:    { label: "Audio",  color: "#D97706", extensions: ["mp3", "wav", "aac", "m4a"] },
  zip:      { label: "ZIP",    color: "#A855F7", extensions: ["zip", "rar", "7z", "tar", "gz"] },
};

/**
 * The config keys that describe an uploadable file format. `url` is not a file,
 * and `notes` / `ai` are student features — none of them should keep a drop
 * zone open on their own.
 */
export const UPLOADABLE_TYPE_KEYS = ["video", "ppt", "pdf", "image", "zip"];

/**
 * Order the accepted-type chips render in, and the order the blocked-file
 * message lists them. Matches the Course Setup row order so the two read the
 * same way.
 */
const TYPE_RULE_ORDER = ["pdf", "ppt", "document", "image", "video", "audio", "zip"];

/**
 * No config saved (legacy course) → accept what the upload modal historically
 * did, rather than locking the user out of uploading anything at all.
 */
export const LEGACY_ALLOWED_TYPES = ["ppt", "pdf", "document", "image", "video", "audio"];

/**
 * Per-type size ceiling in MB, keyed the same way — Course Setup's "Max file
 * size" field (`resourcesType.iDo.<key>.maxSize`). A type missing from this map
 * has no ceiling.
 */
export type MaxSizeByType = Record<string, number | undefined>;

export type AllowedFileRules = {
  extensions: Set<string>;
  /** `accept` attribute for an <input type="file">. */
  accept: string;
  /** Chips shown under a drop zone — `limit` is the type's ceiling in MB. */
  chips: { label: string; color: string; limit?: number }[];
  /** "PDF, PPTX" — for the blocked-file message. */
  summary: string;
  /** Which config key a file's extension belongs to, if any. */
  typeOf: (file: File) => string | undefined;
  /** null when the file is fine; otherwise why it was rejected. */
  reject: (file: File) => string | null;
};

export function getFileExt(name: string) {
  return name.includes(".") ? name.split(".").pop()?.toLowerCase() ?? "" : "";
}

/** 3 → "3 MB", 2.5 → "2.5 MB" — the field accepts halves. */
export function fmtLimit(mb: number) {
  return `${Number.isInteger(mb) ? mb : mb.toFixed(1)} MB`;
}

function fmtFileSize(bytes: number) {
  const mb = bytes / (1024 * 1024);
  return mb >= 0.1 ? `${mb.toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function buildAllowedRules(
  typeKeys: string[],
  maxSizeByType: MaxSizeByType = {}
): AllowedFileRules {
  const keys = TYPE_RULE_ORDER.filter(k => typeKeys.includes(k) && TYPE_FILE_RULES[k]);
  const rules = keys.map(k => TYPE_FILE_RULES[k]);

  // ext → config key, so a rejected file can name the type whose limit it broke
  // ("PPT allows max 3 MB") rather than a generic size error.
  const typeByExt = new Map<string, string>();
  keys.forEach(k => TYPE_FILE_RULES[k].extensions.forEach(e => typeByExt.set(e, k)));

  const typeOf = (file: File) => typeByExt.get(getFileExt(file.name));

  return {
    extensions: new Set(rules.flatMap(r => r.extensions)),
    accept: rules.flatMap(r => r.extensions.map(e => `.${e}`)).join(","),
    chips: keys.map(k => ({
      label: TYPE_FILE_RULES[k].label,
      color: TYPE_FILE_RULES[k].color,
      limit: maxSizeByType[k],
    })),
    summary: rules.map(r => r.label).join(", "),
    typeOf,
    reject: (file: File) => {
      const key = typeOf(file);
      if (!key) return "format";
      const limitMB = maxSizeByType[key];
      if (limitMB && file.size > limitMB * 1024 * 1024) {
        return `"${file.name}" is ${fmtFileSize(file.size)} — ${TYPE_FILE_RULES[key].label} allows max ${fmtLimit(limitMB)}`;
      }
      return null;
    },
  };
}

/**
 * Splits an incoming batch into what this course accepts and what it doesn't,
 * with a ready-to-show message.
 *
 * Format and size rejections are reported separately: a wrong format is fixed
 * by uploading something else, an oversized file by compressing it or raising
 * the limit in Course Setup — telling the user "blocked" for both would hide
 * which one they're hitting.
 */
export function partitionFiles(files: File[], rules: AllowedFileRules) {
  const allowed: File[] = [];
  const wrongFormat: File[] = [];
  const tooLarge: string[] = [];

  files.forEach(f => {
    const reason = rules.reject(f);
    if (!reason) allowed.push(f);
    else if (reason === "format") wrongFormat.push(f);
    else tooLarge.push(reason);
  });

  const messages: string[] = [];
  if (wrongFormat.length) {
    messages.push(
      rules.summary
        ? `${wrongFormat.length} file${wrongFormat.length > 1 ? "s" : ""} blocked — only ${rules.summary} allowed here`
        : "No file types are enabled for this course — enable one in Course Setup › Resource Type"
    );
  }
  // Name the first oversized file exactly; summarise the rest so a 20-file drop
  // doesn't produce a wall of text.
  if (tooLarge.length) {
    messages.push(
      tooLarge.length === 1
        ? `Blocked — ${tooLarge[0]}`
        : `${tooLarge.length} files blocked — over the size limit. ${tooLarge[0]}`
    );
  }

  return { allowed, wrongFormat, tooLarge, blockedMessage: messages.join(" · ") };
}
