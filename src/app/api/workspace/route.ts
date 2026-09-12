import { NextRequest, NextResponse } from "next/server"
import fs from "fs/promises"
import path from "path"
import {
  LANGUAGE_CONFIG,
  STARTER_CODE,
  TS_CONFIG_JSON,
  launchConfigFor,
  normalizeLanguage,
  detectLanguageFromFilename,
  type SupportedLanguage,
} from "@/lib/codeLanguages"

export const dynamic = "force-dynamic"

// ── Deployment switch ────────────────────────────────────────────────────────
// When RAILWAY_AGENT_URL is set we forward fs operations to the agent running
// in the same container as code-server on Railway. Otherwise we fall through
// to the local fs path (bind-mounted ./workspace) for local dev.
//
// `process.env.VERCEL` is `"1"` whenever this code runs on Vercel. On Vercel
// the local fs path can NEVER work (read-only filesystem → ENOENT mkdir
// '/var/workspace'), so we force the agent path on with a hardcoded URL
// fallback. Env vars still win when set — this only protects against the
// "I forgot to add the env var / forgot to redeploy" failure mode.
const RAILWAY_AGENT_FALLBACK = "https://docker-production-a462.up.railway.app"
const AGENT_URL    = ((process.env.RAILWAY_AGENT_URL || (process.env.VERCEL ? RAILWAY_AGENT_FALLBACK : "")) || "").replace(/\/+$/, "")
const AGENT_TOKEN  = process.env.AGENT_TOKEN || ""
const BACKEND_URL  = (process.env.BACKEND_URL || "").replace(/\/+$/, "")
const USE_AGENT    = !!AGENT_URL

// The workspace folder is the SAME directory bind-mounted into the code-server
// container (-v ./workspace:/home/coder/project). Next.js runs with cwd = client/,
// so the repo's workspace/ is one level up. Override with WORKSPACE_DIR if needed.
const WORKSPACE_DIR =
  process.env.WORKSPACE_DIR || path.resolve(process.cwd(), "..", "workspace")

const SKIP_DIRS = new Set([".vscode", "node_modules", ".git", "__pycache__", "_review"])
const SKIP_FILES = new Set([".DS_Store", "tsconfig.json", ".gitignore", "go.mod", "go.sum"])
const MAX_FILE_BYTES = 256 * 1024

// Extensions that "belong to" each selected language (kept during prune).
const LANG_EXTS: Record<SupportedLanguage, string[]> = {
  python: ["py", "pyw"],
  javascript: ["js", "mjs", "cjs", "jsx"],
  typescript: ["ts", "tsx"],
  java: ["java"],
  cpp: ["cpp", "cc", "cxx", "hpp", "hh", "h"],
  c: ["c", "h"],
  go: ["go"],
}
// Recognized code/source extensions we actively police. A file with one of these
// that doesn't belong to the selected language is removed; non-code/data files
// (txt, csv, json, md, images, …) are left untouched.
const POLICED_EXTS = new Set([
  "html", "htm", "css", "scss", "sass", "less",
  "js", "mjs", "cjs", "jsx", "ts", "tsx",
  "py", "pyw", "java", "cpp", "cc", "cxx", "hpp", "hh", "c", "h",
  "go", "rb", "php", "cs", "rs", "swift", "kt", "kts", "dart", "scala",
])

const isInside = (root: string, target: string) => {
  const rel = path.relative(root, target)
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel))
}

// Resolve an optional subfolder safely inside the workspace (used for staff review
// folders like _review/<id> so they never clobber a student's root workspace).
const resolveBaseDir = (subdir?: string): string => {
  if (!subdir) return WORKSPACE_DIR
  const clean = String(subdir).replace(/^[/\\]+/, "").replace(/\.\.[/\\]/g, "")
  const dir = path.join(WORKSPACE_DIR, clean)
  return isInside(WORKSPACE_DIR, dir) ? dir : WORKSPACE_DIR
}

// Recursively read all readable text files under `baseDir` (paths relative to it).
async function readFilesIn(baseDir: string): Promise<
  Array<{ filename: string; path: string; folderPath: string; content: string; language: string; isEntryPoint: boolean }>
> {
  const out: any[] = []
  const walk = async (dir: string) => {
    let entries: any[]
    try {
      entries = await fs.readdir(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const e of entries) {
      if (e.name.startsWith(".") && e.isDirectory()) continue
      if (e.isDirectory()) {
        if (SKIP_DIRS.has(e.name)) continue
        await walk(path.join(dir, e.name))
        continue
      }
      if (SKIP_FILES.has(e.name)) continue
      const full = path.join(dir, e.name)
      try {
        const stat = await fs.stat(full)
        if (stat.size > MAX_FILE_BYTES) continue
        const content = await fs.readFile(full, "utf8")
        const relDir = path.relative(baseDir, dir).split(path.sep).join("/")
        const folderPath = relDir ? `/${relDir}` : "/"
        const relPath = path.relative(baseDir, full).split(path.sep).join("/")
        out.push({
          filename: e.name,
          path: `/${relPath}`,
          folderPath,
          content,
          language: detectLanguageFromFilename(e.name),
          isEntryPoint: /^(main\.|Main\.)/.test(e.name),
        })
      } catch {
        /* skip unreadable / binary */
      }
    }
  }
  await walk(baseDir)
  return out
}

async function clearDir(baseDir: string, preserve: Set<string> = new Set()) {
  let entries: any[]
  try {
    entries = await fs.readdir(baseDir, { withFileTypes: true })
  } catch {
    await fs.mkdir(baseDir, { recursive: true })
    return
  }
  await Promise.all(
    entries
      .filter((e) => !preserve.has(e.name))
      .map((e) => fs.rm(path.join(baseDir, e.name), { recursive: true, force: true })),
  )
}

async function writeLaunchJson(baseDir: string, langs: SupportedLanguage[]) {
  const vscodeDir = path.join(baseDir, ".vscode")
  await fs.mkdir(vscodeDir, { recursive: true })
  const configurations = langs.map(launchConfigFor)
  await fs.writeFile(
    path.join(vscodeDir, "launch.json"),
    JSON.stringify({ version: "0.2.0", configurations }, null, 2),
    "utf8",
  )
}

// Auto-save so the student's edits reach disk (and thus submissions) without Ctrl+S.
async function writeSettingsJson(baseDir: string, autoSave: boolean) {
  const vscodeDir = path.join(baseDir, ".vscode")
  await fs.mkdir(vscodeDir, { recursive: true })
  await fs.writeFile(
    path.join(vscodeDir, "settings.json"),
    JSON.stringify(
      autoSave
        ? {
            "files.autoSave": "afterDelay",
            "files.autoSaveDelay": 700,
            // Hide staff review folders from the student's VS Code explorer.
            "files.exclude": { "_review": true },
          }
        : {},
      null,
      2,
    ),
    "utf8",
  )
}

// Write explicit file contents (restore a submission / seed a review folder).
async function writeFiles(baseDir: string, files: Array<{ filename?: string; path?: string; content?: string }>) {
  for (const f of files) {
    const rel = (f.path || f.filename || "").replace(/^\/+/, "")
    if (!rel) continue
    const target = path.join(baseDir, rel)
    if (!isInside(baseDir, target)) continue
    await fs.mkdir(path.dirname(target), { recursive: true })
    await fs.writeFile(target, f.content ?? "", "utf8")
  }
}

// Ensure the starter file for `lang` exists (does not overwrite existing edits).
async function ensureLanguageFile(baseDir: string, lang: SupportedLanguage) {
  const cfg = LANGUAGE_CONFIG[lang]
  const target = path.join(baseDir, cfg.filename)
  try {
    await fs.access(target)
  } catch {
    await fs.writeFile(target, STARTER_CODE[lang], "utf8")
  }
  if (lang === "typescript") {
    const tsconfig = path.join(baseDir, "tsconfig.json")
    try { await fs.access(tsconfig) } catch { await fs.writeFile(tsconfig, TS_CONFIG_JSON, "utf8") }
  }
}

const langsFromFiles = (files: Array<{ filename?: string }>): SupportedLanguage[] => {
  const set = new Set<SupportedLanguage>()
  for (const f of files) {
    const l = detectLanguageFromFilename(f.filename || "")
    if (l !== "text") set.add(l)
  }
  return [...set]
}

// ─── Agent / Mongo helpers (production: USE_AGENT === true) ──────────────────

type AgentFile = { path: string; name?: string; content: string }
type ClientFile = { filename: string; path: string; folderPath: string; content: string; language: string; isEntryPoint: boolean }

const authHeaders = () =>
  AGENT_TOKEN ? { Authorization: `Bearer ${AGENT_TOKEN}` } : ({} as Record<string, string>)

// Pull a userId/courseId out of the body, or parse it from a "student-<id>"
// subdir convention. Used to talk to the Mongo backend.
function resolveIdentity(body: any, subdir?: string) {
  const userId   = body?.userId   || (subdir && /^student-([^/]+)/.exec(subdir)?.[1]) || ""
  const courseId = body?.courseId || (subdir && /\/course-([^/]+)/.exec(subdir)?.[1]) || ""
  return { userId, courseId }
}

// Convert agent's { path, name, content }[] → the editor's client shape.
function toClientFiles(files: AgentFile[]): ClientFile[] {
  return files.map((f) => {
    const p = f.path.startsWith("/") ? f.path : "/" + f.path
    const name = f.name || p.split("/").pop() || ""
    const folderPath = p.includes("/") ? p.slice(0, p.lastIndexOf("/")) || "/" : "/"
    return {
      filename: name,
      path: p,
      folderPath,
      content: f.content,
      language: detectLanguageFromFilename(name),
      isEntryPoint: /^(main\.|Main\.)/.test(name),
    }
  })
}

async function agentRead(subdir: string): Promise<ClientFile[]> {
  const url = `${AGENT_URL}/__workspace/read?subdir=${encodeURIComponent(subdir)}`
  const r = await fetch(url, { headers: authHeaders(), cache: "no-store" })
  if (!r.ok) throw new Error(`agent read ${r.status}`)
  const j = await r.json()
  return toClientFiles(Array.isArray(j.files) ? j.files : [])
}

async function agentWrite(
  subdir: string,
  files: Array<{ path: string; content: string }>,
  replace: boolean,
): Promise<ClientFile[]> {
  const url = `${AGENT_URL}/__workspace/write`
  const r = await fetch(url, {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ subdir, replace, files }),
    cache: "no-store",
  })
  if (!r.ok) throw new Error(`agent write ${r.status}`)
  const j = await r.json()
  return toClientFiles(Array.isArray(j.files) ? j.files : [])
}

async function agentClear(subdir: string): Promise<void> {
  const url = `${AGENT_URL}/__workspace/clear?subdir=${encodeURIComponent(subdir)}`
  await fetch(url, { method: "DELETE", headers: authHeaders(), cache: "no-store" })
}

// ─── Per-question draft persistence ──────────────────────────────────────────
// Keyed by (userId from JWT, exerciseId, questionId) — handled by the backend
// at /draft/save and /draft/load. The student's JWT is forwarded as a Bearer
// header; backend derives userId from it, so the URL never trusts a body field.

async function draftLoad(
  authHeader: string,
  exerciseId: string,
  questionId: string,
): Promise<ClientFile[]> {
  if (!BACKEND_URL || !authHeader || !exerciseId || !questionId) return []
  try {
    const url = `${BACKEND_URL}/draft/load?exerciseId=${encodeURIComponent(exerciseId)}&questionId=${encodeURIComponent(questionId)}`
    const r = await fetch(url, {
      headers: { Authorization: authHeader },
      cache: "no-store",
    })
    if (!r.ok) return []
    const j = await r.json()
    const files: AgentFile[] = Array.isArray(j?.draft?.files) ? j.draft.files : []
    return toClientFiles(files)
  } catch {
    return []
  }
}

async function draftSave(
  authHeader: string,
  exerciseId: string,
  questionId: string,
  language: SupportedLanguage,
  files: Array<{ path: string; content: string }>,
) {
  if (!BACKEND_URL || !authHeader || !exerciseId || !questionId) return
  try {
    await fetch(`${BACKEND_URL}/draft/save`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: authHeader },
      body: JSON.stringify({
        exerciseId,
        questionId,
        language,
        files: files.map((f) => ({
          name: f.path.split("/").pop() || "",
          path: f.path,
          content: f.content,
        })),
      }),
      cache: "no-store",
    })
  } catch {
    /* persistence is best-effort */
  }
}

// Compose the full file set Vercel sends to the agent: starter or restored
// files + .vscode/launch.json + settings.json + optional tsconfig.
function buildAgentFiles(
  langs: SupportedLanguage[],
  active: SupportedLanguage,
  restoreFiles: Array<{ filename?: string; path?: string; content?: string }> | null,
  isReview: boolean,
): Array<{ path: string; content: string }> {
  const out: Array<{ path: string; content: string }> = []
  const seen = new Set<string>()
  const push = (p: string, content: string) => {
    const norm = "/" + p.replace(/^\/+/, "")
    if (seen.has(norm)) return
    seen.add(norm)
    out.push({ path: norm, content })
  }

  if (restoreFiles && restoreFiles.length > 0) {
    for (const f of restoreFiles) {
      const rel = (f.path || f.filename || "").replace(/^\/+/, "")
      if (!rel) continue
      push(rel, f.content ?? "")
    }
  } else {
    // Seed starter for the active language.
    const cfg = LANGUAGE_CONFIG[active]
    push(cfg.filename, STARTER_CODE[active])
  }

  if (active === "typescript" && !seen.has("/tsconfig.json")) {
    push("tsconfig.json", TS_CONFIG_JSON)
  }

  // .vscode/launch.json — debug configs for every selected language.
  push(
    ".vscode/launch.json",
    JSON.stringify({ version: "0.2.0", configurations: langs.map(launchConfigFor) }, null, 2),
  )

  // .vscode/settings.json — auto-save for student workspaces; nothing for review.
  push(
    ".vscode/settings.json",
    JSON.stringify(
      isReview
        ? {}
        : {
            "files.autoSave": "afterDelay",
            "files.autoSaveDelay": 700,
            "files.exclude": { _review: true },
          },
      null,
      2,
    ),
  )

  return out
}

// ── GET: read the real files the student edited in code-server ──────────────
// optional ?subdir=_review/<id> to read a specific review folder
// optional ?exerciseId=...&questionId=... to enable per-question draft rehydration
export async function GET(req: NextRequest) {
  try {
    const subdir = req.nextUrl.searchParams.get("subdir") || undefined
    const exerciseId = req.nextUrl.searchParams.get("exerciseId") || ""
    const questionId = req.nextUrl.searchParams.get("questionId") || ""
    const authHeader = req.headers.get("authorization") || ""

    // ── Production: read from Railway agent (with draft fallback) ──────────
    if (USE_AGENT) {
      if (!subdir) return NextResponse.json({ ok: false, error: "subdir required" }, { status: 400 })
      let files: ClientFile[] = []
      try {
        files = await agentRead(subdir)
      } catch {
        files = []
      }
      // If the container's disk is empty (cold start / volume wiped), restore
      // from the per-question draft so the student sees their last typed work.
      if (files.length === 0 && exerciseId && questionId && authHeader) {
        const fromDraft = await draftLoad(authHeader, exerciseId, questionId)
        if (fromDraft.length > 0) {
          try {
            await agentWrite(
              subdir,
              fromDraft.map((f) => ({ path: f.path, content: f.content })),
              true,
            )
            files = fromDraft
          } catch {
            files = fromDraft
          }
        }
      }
      return NextResponse.json({ ok: true, files, baseDir: subdir })
    }

    // ── Local dev: read straight off the bind-mounted workspace ────────────
    if (!subdir) {
      return NextResponse.json({ ok: false, error: "subdir required" }, { status: 400 })
    }
    const baseDir = resolveBaseDir(subdir)
    const files = await readFilesIn(baseDir)
    return NextResponse.json({ ok: true, files, baseDir })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "read failed" }, { status: 500 })
  }
}

// ── POST: prepare a workspace (student root) or a review subfolder ───────────
// body: { languages?: string[], active?: string, files?: [{path,content}], subdir?: string }
//   subdir present (+ files) → REVIEW: clear that subfolder and write the
//        submission into it (read-only viewing), auto-save OFF.
//   files present (no subdir) → student RESTORE (clear root + write), auto-save ON.
//   files absent (no subdir)  → student SEED (ensure starter, no clear), auto-save ON.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const subdir: string | undefined = body.subdir || undefined
    // A "review" subdir always starts with "_review/" (staff viewing a submission).
    // Student subdirs start with "student-" and are treated as normal live workspaces.
    const isReview = !!subdir && subdir.startsWith("_review")

    // ── Production: forward to Railway agent ──────────────────────────────
    if (USE_AGENT) {
      if (!subdir) return NextResponse.json({ ok: false, error: "subdir required" }, { status: 400 })
      // resolveIdentity kept for legacy callers; the new per-question draft
      // path takes the userId from the JWT instead.
      resolveIdentity(body, subdir)
      const exerciseId: string = body.exerciseId ? String(body.exerciseId) : ""
      const questionId: string = body.questionId ? String(body.questionId) : ""
      const authHeader = req.headers.get("authorization") || ""
      const canDraft = !!(exerciseId && questionId && authHeader && !isReview)

      // SYNC: read whatever is on disk and push it to the per-question draft.
      // No file mutation — used by the periodic 15-second backup timer in the
      // editor so typed work survives a Railway restart.
      if (body.sync) {
        const existing = await agentRead(subdir)
        if (canDraft) {
          const draftLang =
            (normalizeLanguage(body.language || body.active || "") as SupportedLanguage) ||
            (existing[0] ? (detectLanguageFromFilename(existing[0].filename) as SupportedLanguage) : "python")
          void draftSave(
            authHeader,
            exerciseId,
            questionId,
            draftLang,
            existing
              .filter((f) => !f.path.startsWith("/.vscode/") && f.path !== "/tsconfig.json")
              .map((f) => ({ path: f.path, content: f.content })),
          )
        }
        return NextResponse.json({ ok: true, synced: canDraft, files: existing })
      }

      // PRUNE: drop files whose extension belongs to a different recognized
      // language. Agent has no partial-delete, so we read → filter → rewrite.
      if (body.prune) {
        const allowed = normalizeLanguage(body.prune)
        const allowedExts = allowed ? LANG_EXTS[allowed] : []
        const existing = await agentRead(subdir)
        const removed: string[] = []
        const kept: Array<{ path: string; content: string }> = []
        for (const f of existing) {
          const ext = (f.filename.split(".").pop() || "").toLowerCase()
          if (allowed && POLICED_EXTS.has(ext) && !allowedExts.includes(ext)) {
            removed.push(f.filename)
          } else {
            kept.push({ path: f.path, content: f.content })
          }
        }
        const files = await agentWrite(subdir, kept, true)
        if (canDraft) {
          const draftLang = (normalizeLanguage(body.prune) as SupportedLanguage) || "python"
          void draftSave(
            authHeader,
            exerciseId,
            questionId,
            draftLang,
            files
              .filter((f) => !f.path.startsWith("/.vscode/") && f.path !== "/tsconfig.json")
              .map((f) => ({ path: f.path, content: f.content })),
          )
        }
        return NextResponse.json({ ok: true, pruned: true, removed, files })
      }

      // ADD: write new files without clearing the folder. Agent's writeFiles
      // will overwrite if the path collides — the UI already prevents that.
      if (body.add && Array.isArray(body.files) && body.files.length > 0) {
        const incoming = (body.files as Array<{ filename?: string; path?: string; content?: string }>)
          .map((f) => ({ path: ((f.path || f.filename || "").replace(/^\/+/, "")), content: f.content ?? "" }))
          .filter((f) => f.path)
          .map((f) => ({ path: "/" + f.path, content: f.content }))
        const files = await agentWrite(subdir, incoming, false)
        if (canDraft) {
          const draftLang =
            (normalizeLanguage(body.language || body.active || "") as SupportedLanguage) || "python"
          void draftSave(
            authHeader,
            exerciseId,
            questionId,
            draftLang,
            files
              .filter((f) => !f.path.startsWith("/.vscode/") && f.path !== "/tsconfig.json")
              .map((f) => ({ path: f.path, content: f.content })),
          )
        }
        return NextResponse.json({ ok: true, added: true, created: incoming.map((f) => f.path), skipped: [], files })
      }

      // SEED / RESTORE / REVIEW: build the file set in memory, write it once.
      const restoreFiles =
        Array.isArray(body.files) && body.files.length > 0
          ? (body.files as Array<{ filename?: string; path?: string; content?: string }>)
          : null
      const rawLangs: string[] = Array.isArray(body.languages)
        ? body.languages
        : body.language
          ? [body.language]
          : []
      let langs = rawLangs.map(normalizeLanguage).filter((l): l is SupportedLanguage => !!l)
      if (langs.length === 0 && restoreFiles) langs = langsFromFiles(restoreFiles)
      if (langs.length === 0) langs = ["python"]
      const active = normalizeLanguage(body.active || "") || langs[0]

      const toWrite = buildAgentFiles(langs, active, restoreFiles, isReview)
      // Replace = true for review and restore; for seed, only replace if the
      // folder is empty so we never wipe live student edits.
      let replace = isReview || !!restoreFiles
      if (!replace) {
        try {
          const existing = await agentRead(subdir)
          const hasUserFile = existing.some(
            (f) => !f.path.startsWith("/.vscode/") && f.path !== "/tsconfig.json",
          )
          if (!hasUserFile) replace = true
        } catch { /* fall through with replace = false */ }
      }
      const files = await agentWrite(subdir, toWrite, replace)

      // Best-effort draft persistence (live student workspaces only). We save
      // the *resulting* file list so the draft stays in sync with disk after a
      // seed, restore, or replace.
      if (canDraft) {
        void draftSave(
          authHeader,
          exerciseId,
          questionId,
          active,
          files
            .filter((f) => !f.path.startsWith("/.vscode/") && f.path !== "/tsconfig.json")
            .map((f) => ({ path: f.path, content: f.content })),
        )
      }
      return NextResponse.json({
        ok: true,
        review: isReview,
        seeded: [active],
        restored: !!restoreFiles,
        files,
      })
    }

    // ── Local dev: existing fs-based behavior ─────────────────────────────
    // Reject empty subdir explicitly so a missing field can't silently write
    // into the workspace ROOT (which would leak .vscode/, main.py etc. into
    // every student's view and looks like a per-student folder didn't get
    // created). The agent path already enforces this above.
    if (!subdir) {
      return NextResponse.json({ ok: false, error: "subdir required" }, { status: 400 })
    }
    const baseDir = resolveBaseDir(subdir)

    // ── Prune mode: delete files that don't match the allowed language ──────────
    // Used to enforce "only the selected language's files" in the live workspace.
    // Only removes files that are a DIFFERENT recognized programming language
    // (e.g. .html / .cpp when Python is selected). Leaves plain data files alone.
    if (body.prune) {
      const allowed = normalizeLanguage(body.prune)
      const allowedExts = allowed ? LANG_EXTS[allowed] : []
      const existing = await readFilesIn(baseDir)
      const removed: string[] = []
      if (allowed) {
        for (const f of existing) {
          const ext = (f.filename.split(".").pop() || "").toLowerCase()
          // Remove only recognized source files that belong to a different language.
          if (POLICED_EXTS.has(ext) && !allowedExts.includes(ext)) {
            const target = path.join(baseDir, f.path.replace(/^\/+/, ""))
            if (isInside(baseDir, target)) {
              try { await fs.rm(target, { force: true }); removed.push(f.filename) } catch { /* */ }
            }
          }
        }
      }
      const files = await readFilesIn(baseDir)
      return NextResponse.json({ ok: true, pruned: true, removed, files })
    }

    // ── Add mode: create new file(s) WITHOUT wiping the folder ──────────────────
    // Used by the LMS "New File" button. Enforces the selected language's
    // extension on the client; here we just write what we're given (no clear).
    if (body.add && Array.isArray(body.files) && body.files.length > 0) {
      await fs.mkdir(baseDir, { recursive: true })
      const created: string[] = []
      const skipped: string[] = []
      for (const f of body.files as Array<{ filename?: string; path?: string; content?: string }>) {
        const rel = (f.path || f.filename || "").replace(/^\/+/, "")
        if (!rel) continue
        const target = path.join(baseDir, rel)
        if (!isInside(baseDir, target)) continue
        // Don't overwrite an existing file — report it as skipped instead.
        try { await fs.access(target); skipped.push(rel); continue } catch { /* doesn't exist → create */ }
        await fs.mkdir(path.dirname(target), { recursive: true })
        await fs.writeFile(target, f.content ?? "", "utf8")
        created.push(rel)
      }
      const files = await readFilesIn(baseDir)
      return NextResponse.json({ ok: true, added: true, created, skipped, files })
    }

    const restoreFiles: Array<{ filename?: string; path?: string; content?: string }> | null =
      Array.isArray(body.files) && body.files.length > 0 ? body.files : null

    const rawLangs: string[] = Array.isArray(body.languages)
      ? body.languages
      : body.language
        ? [body.language]
        : []
    let langs = rawLangs
      .map(normalizeLanguage)
      .filter((l): l is SupportedLanguage => !!l)

    // For review folders, derive languages from the submitted files if not given.
    if (langs.length === 0 && restoreFiles) langs = langsFromFiles(restoreFiles)
    if (langs.length === 0) langs = ["python"]

    const active = normalizeLanguage(body.active || "") || langs[0]

    await fs.mkdir(baseDir, { recursive: true })

    if (isReview) {
      // Staff review: isolated folder, always replace with the submission's files.
      await clearDir(baseDir)
      if (restoreFiles) await writeFiles(baseDir, restoreFiles)
    } else if (restoreFiles) {
      // Student restore (root or per-student subdir): clear and write exact files.
      // We never need to preserve _review here — review folders are always siblings
      // at the workspace root, never nested inside a student-<id> folder.
      await clearDir(baseDir)
      await writeFiles(baseDir, restoreFiles)
      if (active === "typescript") {
        const tsconfig = path.join(baseDir, "tsconfig.json")
        try { await fs.access(tsconfig) } catch { await fs.writeFile(tsconfig, TS_CONFIG_JSON, "utf8") }
      }
    } else {
      // Student seed: create the starter only if missing (never wipe edits).
      await ensureLanguageFile(baseDir, active)
    }

    await writeLaunchJson(baseDir, langs)
    await writeSettingsJson(baseDir, !isReview) // auto-save only for the live student workspace

    const files = await readFilesIn(baseDir)
    return NextResponse.json({ ok: true, review: isReview, seeded: [active], restored: !!restoreFiles, files })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "prepare failed" }, { status: 500 })
  }
}
