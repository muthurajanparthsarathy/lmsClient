// Source instrumenter for the step-through visualizer (every language except
// Python and Ruby, which have real line tracers).
//
// It puts a trace call in front of each statement, ON THE SAME LINE, so line
// numbers (and compiler errors) stay exactly where the reader wrote them:
//
//     total += n;      →   __PT.t(4, "main", new Object[]{"total", total, "n", n}); total += n;
//
// The call runs just before the line, the same moment Python's sys.settrace
// reports a "line" event, so the UI's "next line to execute" arrow is right.
// Each call prints one step as JSON between @@PTS@@ … @@PTE@@ markers; the
// page pulls those out of the program's output (see traceStream.ts).
//
// There's no full parser per language. A careful line scanner is enough:
//   · strings and comments are masked first, so braces inside them don't count;
//   · every { is classified from the text before it: a code block (function,
//     if/for/while body, lambda), a type body (class/struct/…: no statements
//     allowed there) or an expression (array/object literal: left alone);
//   · a line starts a statement when the previous one ended (; { } or, in
//     Go/Kotlin/JS, a line that doesn't continue);
//   · variables are picked up from declarations, loop headers and parameters,
//     and only offered to the trace call where the compiler agrees they exist
//     and are assigned (Java/C# reject reading an unassigned local).
// Anything the scanner is unsure about is simply not traced, which is always
// safe: the program still runs exactly as written.

export type ILang = 'java' | 'c' | 'cpp' | 'csharp' | 'nodejs' | 'go' | 'kotlin' | 'php'

type CArrElem = 'i' | 'u' | 'd'
type Var = { name: string; carr?: CArrElem }
type BlockKind = 'code' | 'type' | 'expr' | 'top'
type Block = {
    kind: BlockKind
    paren: number
    vars: Var[]
    base: number // vars owned by the block itself (params, loop variables)
    pending: Var[] // declared by the current statement: visible from the next one
    unassigned: Var[] // declared without a value (Java/C#/C/C++): waiting for one
    fn: string
    boundary: boolean // lambdas/local classes: outer locals aren't readable here
    header: string
}

const MAX_VARS = 14

// ─── 1. Mask strings and comments (same length, newlines kept) ─────────────
function mask(src: string, lang: ILang): string {
    const out = src.split('')
    const n = src.length
    const blank = (a: number, b: number) => { for (let k = a; k < b && k < n; k++) if (out[k] !== '\n') out[k] = ' ' }
    let i = 0
    while (i < n) {
        const c = src[i], d = src[i + 1]
        // PHP open/close tags are not code.
        if (lang === 'php' && c === '<' && src.startsWith('<?php', i)) { blank(i, i + 5); i += 5; continue }
        if (lang === 'php' && c === '?' && d === '>') { blank(i, i + 2); i += 2; continue }
        if ((c === '/' && d === '/') || (lang === 'php' && c === '#' && d !== '[')) {
            let j = i; while (j < n && src[j] !== '\n') j++
            blank(i, j); i = j; continue
        }
        if (c === '/' && d === '*') {
            let j = src.indexOf('*/', i + 2); j = j === -1 ? n : j + 2
            blank(i, j); i = j; continue
        }
        if (lang === 'kotlin' && src.startsWith('"""', i)) {
            let j = src.indexOf('"""', i + 3); j = j === -1 ? n : j + 3
            blank(i + 1, j - 1); i = j; continue
        }
        if ((lang === 'go' || lang === 'nodejs') && c === '`') {
            let j = i + 1
            while (j < n && src[j] !== '`') { if (src[j] === '\\' && lang === 'nodejs') j++; j++ }
            blank(i + 1, j); i = j + 1; continue
        }
        if (lang === 'csharp' && (c === '@' || c === '$')) {
            const m = /^(\$@|@\$|@)"/.exec(src.slice(i, i + 3))
            if (m) {
                let j = i + m[0].length
                while (j < n) { if (src[j] === '"') { if (src[j + 1] === '"') { j += 2; continue } break } j++ }
                blank(i + m[0].length, j); i = j + 1; continue
            }
        }
        if (c === '"' || c === "'") {
            // C++14 digit separators (1'000'000) are not quotes.
            if (c === "'" && lang === 'cpp' && /[0-9a-fA-F]/.test(src[i - 1] || '') && /[0-9a-fA-F]/.test(d || '')) { i++; continue }
            const multiline = lang === 'php'
            let j = i + 1
            while (j < n && src[j] !== c && (multiline || src[j] !== '\n')) { if (src[j] === '\\') j++; j++ }
            blank(i + 1, j); i = j + 1; continue
        }
        i++
    }
    return out.join('')
}

// ─── Small text helpers ─────────────────────────────────────────────────────
const IDENT = /^[A-Za-z_$][\w$]*$/
const CONTROL = new Set(['if', 'for', 'foreach', 'while', 'switch', 'catch', 'using', 'lock', 'return', 'sizeof', 'typeof', 'new', 'function', 'func', 'fun', 'when', 'synchronized', 'fixed', 'elseif', 'match', 'do', 'else', 'try', 'throw', 'await', 'yield', 'delete', 'in', 'is', 'as', 'not', 'and', 'or', 'defer', 'go', 'select', 'range', 'var', 'val', 'let', 'const', 'static', 'final', 'public', 'private', 'protected', 'internal', 'override', 'virtual', 'abstract', 'async', 'unsafe', 'extern', 'inline', 'operator', 'void', 'int', 'char', 'long', 'short', 'double', 'float', 'bool', 'boolean', 'string', 'auto', 'struct', 'class', 'enum', 'this', 'super', 'true', 'false', 'null', 'nil', 'None', 'echo', 'print', 'include', 'require', 'goto', 'break', 'continue', 'case', 'default', 'package', 'import'])

// Words that start a statement but are not a type (so `return x;` isn't read
// as a declaration of `x`).
const STMT_KW = new Set(['return', 'new', 'throw', 'else', 'case', 'goto', 'using', 'yield', 'await', 'if', 'for', 'foreach', 'while', 'switch', 'do', 'try', 'catch', 'finally', 'break', 'continue', 'import', 'package', 'this', 'super', 'delete', 'typeof', 'sizeof', 'lock', 'checked', 'unchecked', 'fixed', 'default', 'assert', 'synchronized', 'throws', 'namespace', 'goto', 'static', 'public', 'private', 'protected', 'is', 'as', 'in', 'out', 'ref'])

// Split at top-level commas (ignores commas nested in () [] {} and <>).
function splitTop(s: string, angle = false): string[] {
    const parts: string[] = []
    let depth = 0, cur = ''
    for (const ch of s) {
        if ('([{'.includes(ch) || (angle && ch === '<')) depth++
        else if (')]}'.includes(ch) || (angle && ch === '>')) depth--
        if (ch === ',' && depth === 0) { parts.push(cur); cur = '' } else cur += ch
    }
    if (cur.trim()) parts.push(cur)
    return parts
}

// Text of the balanced (...) group starting at index `open` (which is '(').
function parenGroup(s: string, open: number): { inner: string; end: number } | null {
    let depth = 0
    for (let k = open; k < s.length; k++) {
        if (s[k] === '(') depth++
        else if (s[k] === ')') { depth--; if (depth === 0) return { inner: s.slice(open + 1, k), end: k } }
    }
    return null
}

// Does `s` contain an assignment `=` (or Go's :=) outside any brackets?
function hasTopAssign(s: string): boolean {
    let depth = 0
    for (let k = 0; k < s.length; k++) {
        const ch = s[k]
        if ('([{'.includes(ch)) depth++
        else if (')]}'.includes(ch)) depth--
        else if (ch === '=' && depth === 0) {
            const prev = s[k - 1] || '', next = s[k + 1] || ''
            if (next === '=' || next === '>' || '=!<>'.includes(prev)) continue
            return true
        }
    }
    return false
}

// Last identifier in a C-family parameter / declarator ("const vector<int>& v" → v).
function lastIdent(part: string): string {
    const cleaned = part.replace(/=[\s\S]*$/, '').replace(/\[[^\]]*\]/g, ' ').replace(/[&*.]/g, ' ').trim()
    const words = cleaned.split(/\s+/)
    const w = words[words.length - 1] || ''
    return IDENT.test(w) && !CONTROL.has(w) ? w : ''
}

// ─── 2. Classify a { from the text before it ────────────────────────────────
const TYPE_KW = /^(?:(?:public|private|protected|internal|static|final|abstract|sealed|partial|data|open|inner|enum|companion|export|default|readonly|unsafe|file|value|annotation)\s+)*(class|interface|enum|struct|union|namespace|record|object|trait)\b/

function classify(headerRaw: string, parent: Block, lang: ILang): { kind: BlockKind; fn?: string; params?: Var[]; boundary?: boolean } {
    const h = headerRaw.replace(/\s+/g, ' ').trim()
    // Kotlin `when` branches with a block body: `else -> {`
    if (lang === 'kotlin' && /->$/.test(h) && /\bwhen\b/.test(parent.header)) return { kind: 'code' }
    if (parent.kind === 'expr') return { kind: 'expr' }
    // Java arrow-switch blocks: `case 1 -> {`
    if (/^(case\b|default\b)/.test(h)) return { kind: parent.kind === 'code' ? 'code' : 'expr' }
    const inCode = parent.kind === 'code'
    const inDecl = parent.kind === 'type' || parent.kind === 'top'

    // Lambdas: JS/C# arrow bodies, Java/Kotlin -> bodies.
    if (/=>$/.test(h)) {
        const name = /(?:const|let|var)\s+([\w$]+)\s*=/.exec(h)?.[1] || '(anonymous)'
        const pm = /\(([^()]*)\)\s*=>$/.exec(h) || /([\w$]+)\s*=>$/.exec(h)
        const params = pm ? paramNames(pm[1], lang) : []
        return { kind: 'code', fn: lang === 'csharp' ? 'lambda' : name, params, boundary: false }
    }
    if (/->$/.test(h)) {
        if (lang === 'kotlin') return { kind: 'code' } // when-branch body
        if (lang === 'java') {
            const pm = /\(([^()]*)\)\s*->$/.exec(h) || /([\w$]+)\s*->$/.exec(h)
            return { kind: 'code', fn: 'lambda', params: pm ? paramNames(pm[1], lang) : [], boundary: true }
        }
    }
    if (lang === 'kotlin' && /\bwhen\b/.test(h) && !/^(?:.*\s)?fun\b/.test(h)) return { kind: 'expr' }
    if (lang === 'java' && /\bnew\s+[\w.<>, ]+\s*\([^()]*\)$/.test(h)) return { kind: 'type', boundary: true } // anonymous class
    if (TYPE_KW.test(h) || (lang === 'go' && /\b(struct|interface)$/.test(h)) || (lang === 'cpp' && /^extern "?\s*"?$/.test(h))) return { kind: 'type' }
    if (lang === 'kotlin' && /^(?:.*\s)?object\b/.test(h) && inDecl) return { kind: 'type' }

    // Go: headers start with a keyword.
    if (lang === 'go') {
        if (/^(?:\} ?)?else\b/.test(h) || /^(if|for|switch|select)\b/.test(h) || h === '') return { kind: inCode ? 'code' : 'expr' }
        if (/\bfunc\b/.test(h)) return fnInfo(h, lang, inCode)
        return { kind: 'expr' }
    }

    // C++ lambdas: [captures](params) mutable -> T {
    if (lang === 'cpp' && /\[[^\]]*\]\s*(\([^()]*\))?\s*(mutable\s*)?(->\s*[\w:<>]+\s*)?$/.test(h) && inCode) {
        const pm = /\[[^\]]*\]\s*\(([^()]*)\)/.exec(h)
        return { kind: 'code', fn: 'lambda', params: pm ? paramNames(pm[1], lang) : [], boundary: true }
    }
    if ((lang === 'nodejs' || lang === 'php') && /\bfunction\b/.test(h)) return fnInfo(h, lang, inCode)
    if (lang === 'kotlin' && /(^|\s)fun\b/.test(h)) return fnInfo(h, lang, inCode)

    if (hasTopAssign(h) || /^return\b/.test(h) || /:=/.test(h)) return { kind: 'expr' }

    // Control-flow and bare blocks.
    if (inCode) {
        if (h === '' || /^(?:\} ?)?(else|do|try|finally|unsafe|checked|unchecked|static|init)$/.test(h) || /^(?:\} ?)?(else )?(if|for|foreach|while|switch|catch|using|lock|synchronized|fixed|with)\b.*\)$/.test(h)) {
            return { kind: 'code' }
        }
        // Kotlin trailing lambdas: repeat(3) { … }, list.forEach { … }
        if (lang === 'kotlin' && /[\w)]$/.test(h)) return { kind: 'code', fn: undefined }
        return { kind: 'expr' }
    }
    // Declaration level: a function/method body if the header ends like one.
    if (inDecl) {
        if (/^static$/.test(h) || /^init$/.test(h)) return { kind: 'code', fn: 'static' }
        if (/\)\s*(const|noexcept|override|final|mutable|throws [\w., ]+|: *[\w.<>?, ]+|-> *[\w:<>]+|where .+)*$/.test(h) && /\(/.test(h)) return fnInfo(h, lang, false)
        if (lang === 'csharp' && /^(get|set|init|add|remove)$/.test(h)) return { kind: 'code', fn: h }
    }
    return { kind: 'expr' }
}

function fnInfo(h: string, lang: ILang, nested: boolean): { kind: BlockKind; fn?: string; params?: Var[]; boundary?: boolean } {
    // Functions declared at class/file level can't see any outer locals;
    // closures in JS/Go/Kotlin/C# can, Java and C++ lambdas can't (reliably).
    const boundary = !nested || lang === 'java' || lang === 'cpp'
    const assignedName = /(?:const|let|var|val)\s+([\w$]+)\s*=/.exec(h)?.[1] || /^([\w$]+)\s*:?=/.exec(h)?.[1] || '(anonymous)'
    let s = h
    if (lang === 'go') {
        s = h.slice(h.search(/\bfunc\b/) + 4).trimStart()
        if (s.startsWith('(')) {
            const g = parenGroup(s, 0)
            const after = g ? s.slice(g.end + 1).trimStart() : ''
            if (/^[A-Za-z_]\w*\s*\(/.test(after)) s = after // method: skip the receiver
            else return { kind: 'code', fn: assignedName, params: g ? paramNames(g.inner, lang) : [], boundary } // closure
        }
    }
    if (lang === 'kotlin') s = s.replace(/^.*?\bfun\b\s*(<[^>]*>\s*)?([\w.<>?]+\.)?/, '')
    if (lang === 'nodejs' || lang === 'php') {
        const f = /\bfunction\b\s*\*?\s*([\w$]*)\s*\(/.exec(s)
        if (f) {
            const g = parenGroup(s, f.index + f[0].length - 1)
            return { kind: 'code', fn: f[1] || assignedName, params: g ? paramNames(g.inner, lang) : [], boundary }
        }
    }
    // First "name(" that isn't a keyword.
    const re = /([A-Za-z_$][\w$]*)\s*\(/g
    let m: RegExpExecArray | null
    while ((m = re.exec(s))) {
        if (CONTROL.has(m[1])) continue
        const g = parenGroup(s, m.index + m[0].length - 1)
        return { kind: 'code', fn: m[1], params: g ? paramNames(g.inner, lang) : [], boundary }
    }
    return { kind: 'code', fn: assignedName, params: [], boundary }
}

function paramNames(inner: string, lang: ILang): Var[] {
    const out: Var[] = []
    for (const raw of splitTop(inner, lang !== 'nodejs' && lang !== 'php')) {
        const p = raw.trim()
        if (!p || p === 'void') continue
        let name = ''
        if (lang === 'go') name = (/^([A-Za-z_]\w*)/.exec(p)?.[1]) || ''
        else if (lang === 'kotlin') name = (/^(?:vararg\s+|val\s+|var\s+|crossinline\s+|noinline\s+)*([A-Za-z_]\w*)\s*:/.exec(p)?.[1]) || ''
        else if (lang === 'nodejs') name = (/^(?:\.\.\.)?([\w$]+)\s*(=|$)/.exec(p)?.[1]) || ''
        else if (lang === 'php') name = ''
        else {
            if (lang === 'csharp' && /^out\s/.test(p)) continue
            name = lastIdent(p.replace(/^(params|ref|in|this|final)\s+/, ''))
        }
        if (name && name !== '_' && !CONTROL.has(name)) out.push({ name })
    }
    return out
}

// ─── 3. Declarations on a statement line ────────────────────────────────────
type Decl = { vars: Var[]; unassigned: Var[]; blockVars: Var[] }

const C_TYPE = String.raw`(?:(?:const|static|unsigned|signed|register|volatile|long|short)\s+)*(?:int|long long|long|short|char|float|double|bool|_Bool|size_t|unsigned|signed|struct\s+\w+|\w+_t|FILE)`
const CPP_TYPE = String.raw`(?:(?:const|static|unsigned|signed|register|volatile|long|short|constexpr)\s+)*(?:std::)?(?:int|long long|long|short|char|float|double|bool|size_t|unsigned|auto|string|[A-Za-z_]\w*\s*<[^;()=]*>|[A-Z]\w*|\w+_t)`

function cArrElem(type: string): CArrElem | undefined {
    if (/\b(float|double)\b/.test(type)) return 'd'
    if (/\bchar\b/.test(type)) return undefined // char arrays print as strings
    if (/\bunsigned\b|\bsize_t\b/.test(type)) return 'u'
    if (/\b(int|long|short|bool|_Bool|\w+_t)\b/.test(type)) return 'i'
    return undefined
}

function declarations(stmt: string, lang: ILang): Decl {
    const d: Decl = { vars: [], unassigned: [], blockVars: [] }
    const s = stmt.trim()
    const skipInit = (init: string) => /\brequire\s*\(|createInterface|new\s+(java\.util\.)?Scanner\b|BufferedReader|InputStreamReader|bufio\.New|Console\.In\b|System\.`in`/.test(init)
    const addDeclarators = (rest: string, type: string, requireInit: boolean) => {
        for (const part of splitTop(rest)) {
            const m = /^\s*([A-Za-z_$][\w$]*)\s*((?:\[[^\]]*\])*)\s*(=\s*([\s\S]*))?$/.exec(part)
            if (!m || CONTROL.has(m[1])) continue
            const name = m[1], dims = m[2], init = m[4]
            if (init && skipInit(init)) continue
            let v: Var = { name }
            if ((lang === 'c' || lang === 'cpp') && dims) {
                if ((dims.match(/\[/g) || []).length > 1) continue // 2-D arrays: skip
                const elem = cArrElem(type)
                if (elem && lang === 'c') v = { name, carr: elem }
            }
            if (init !== undefined || !requireInit) d.vars.push(v)
            else d.unassigned.push(v)
        }
    }

    if (lang === 'java' || lang === 'csharp') {
        const m = /^(?:(?:final|const|static|readonly|volatile|scoped)\s+)*([A-Za-z_][\w.]*(?:\s*<[^;()]*>)?(?:\s*\[\s*\])*\??)\s+(?=[A-Za-z_])/.exec(s)
        if (m && !STMT_KW.has(m[1])) addDeclarators(s.slice(m[0].length).replace(/;\s*$/, ''), m[1], true)
        let f = /^for\s*\(\s*(?:final\s+)?(?:[\w.]+(?:\s*<[^;()]*>)?(?:\s*\[\s*\])*)\s+([A-Za-z_]\w*)\s*[=:]/.exec(s)
        if (f) d.blockVars.push({ name: f[1] })
        f = /^foreach\s*\(\s*(?:var|[\w.<>\[\]?, ]+?)\s+([A-Za-z_]\w*)\s+in\b/.exec(s)
        if (f) d.blockVars.push({ name: f[1] })
        f = /^using\s*\(\s*(?:var|[\w.<>]+)\s+([A-Za-z_]\w*)\s*=/.exec(s)
        if (f) d.blockVars.push({ name: f[1] })
    } else if (lang === 'c' || lang === 'cpp') {
        const T = lang === 'c' ? C_TYPE : CPP_TYPE
        const m = new RegExp(String.raw`^(${T})\s*[&*]*\s*(?=[A-Za-z_])`).exec(s)
        if (m && !/^(return|else|case|goto|delete|throw|new|using|typedef)\b/.test(s)) {
            const type = m[1]
            const classType = lang === 'cpp' && !/^(?:(?:const|static|unsigned|signed|long|short|constexpr)\s+)*(int|long|short|char|float|double|bool|size_t|unsigned|auto)\b/.test(type) && !/\*/.test(m[0])
            let rest = s.slice(m[0].length).replace(/;\s*$/, '')
            // "int *p, q" — strip pointer stars from each declarator
            rest = splitTop(rest).map((p) => p.replace(/^\s*[*&]+/, '')).join(',')
            const ctor = /^\s*([A-Za-z_]\w*)\s*[({]/.exec(rest) // vector<int> v(n); Point p{1, 2};
            if (!ctor) addDeclarators(rest, type, !classType)
            else if (classType) d.vars.push({ name: ctor[1] })
        }
        const f = new RegExp(String.raw`^for\s*\(\s*(?:${T})\s*[&*]*\s*([A-Za-z_]\w*)\s*[=:]`).exec(s)
            || /^for\s*\(\s*(?:const\s+)?auto\s*&{0,2}\s*([A-Za-z_]\w*)\s*:/.exec(s)
        if (f) d.blockVars.push({ name: f[1] })
    } else if (lang === 'go') {
        let m = /^([A-Za-z_]\w*(?:\s*,\s*[A-Za-z_]\w*)*)\s*:=/.exec(s)
        if (m) m[1].split(',').map((x) => x.trim()).filter((x) => x !== '_').forEach((name) => d.vars.push({ name }))
        m = /^var\s+([A-Za-z_]\w*(?:\s*,\s*[A-Za-z_]\w*)*)\b/.exec(s)
        if (m && !/bufio\.New/.test(s)) m[1].split(',').map((x) => x.trim()).filter((x) => x !== '_').forEach((name) => d.vars.push({ name }))
        m = /^(?:\}\s*else\s+)?(?:for|if|switch)\s+([A-Za-z_]\w*(?:\s*,\s*[A-Za-z_]\w*)*)\s*:=/.exec(s)
        if (m) { d.vars = []; m[1].split(',').map((x) => x.trim()).filter((x) => x !== '_').forEach((name) => d.blockVars.push({ name })) }
        if (/bufio\.New|os\.Stdin/.test(s)) d.vars = [] // the input reader itself is noise
    } else if (lang === 'kotlin') {
        const m = /^(?:val|var)\s+([A-Za-z_]\w*)\s*(?::\s*[^=]+)?=\s*([\s\S]*)$/.exec(s)
        if (m && !skipInit(m[2])) d.vars.push({ name: m[1] })
        let f = /^for\s*\(\s*([A-Za-z_]\w*)\s+in\b/.exec(s)
        if (f) d.blockVars.push({ name: f[1] })
        f = /^for\s*\(\s*\(([^)]*)\)\s+in\b/.exec(s)
        if (f) f[1].split(',').map((x) => x.trim().replace(/:.*$/, '')).filter((x) => IDENT.test(x) && x !== '_').forEach((name) => d.blockVars.push({ name }))
    } else if (lang === 'nodejs') {
        const m = /^(?:let|const|var)\s+([\s\S]+?);?$/.exec(s)
        if (m) {
            for (const part of splitTop(m[1])) {
                const p = part.trim()
                const eq = p.indexOf('=')
                const target = (eq === -1 ? p : p.slice(0, eq)).trim()
                const init = eq === -1 ? '' : p.slice(eq + 1)
                if (skipInit(init)) continue
                if (/^[{[]/.test(target)) target.replace(/[\w$]+(?=\s*[,}\]]|\s*$)/g, (w) => { if (!CONTROL.has(w)) d.vars.push({ name: w }); return w })
                else if (IDENT.test(target)) d.vars.push({ name: target })
            }
        }
        const f = /^for\s*\(\s*(?:let|const|var)\s+([\w$]+|\[[^\]]*\]|\{[^}]*\})/.exec(s)
        if (f) f[1].replace(/[\w$]+/g, (w) => { if (!CONTROL.has(w)) d.blockVars.push({ name: w }); return w })
    }
    // catch (Exception e) / catch (e: Exception) / catch (e)
    const c = /(?:^|\}\s*)catch\s*\(([^)]*)\)/.exec(s)
    if (c) {
        const inner = c[1].trim()
        const name = lang === 'kotlin' ? inner.split(':')[0].trim() : lang === 'nodejs' ? inner : lastIdent(inner)
        if (IDENT.test(name)) d.blockVars.push({ name })
    }
    return d
}

// Lines that give an unassigned C/C++/Java/C# variable its first value.
function assignsTo(stmt: string, name: string, lang: ILang): boolean {
    const n = name.replace(/\$/g, '\\$')
    if (new RegExp(String.raw`^${n}\s*(\[[^\]]*\]\s*)?=[^=]`).test(stmt)) return true
    if (lang === 'c' || lang === 'cpp') {
        if (new RegExp(String.raw`&\s*${n}\b`).test(stmt)) return true
        if (new RegExp(String.raw`\b(scanf|fgets|gets|strcpy|strncpy|sprintf|memset|getline)\s*\([^;]*\b${n}\b`).test(stmt)) return true
        if (new RegExp(String.raw`\bcin\b[^;]*>>\s*${n}\b`).test(stmt)) return true
    }
    return false
}

// ─── 4. The trace call for one line ─────────────────────────────────────────
function traceCall(lang: ILang, line: number, fn: string, vars: Var[]): string {
    const q = JSON.stringify(fn)
    switch (lang) {
        case 'java': return `__PT.t(${line}, ${q}, new Object[]{${vars.map((v) => `"${v.name}", ${v.name}`).join(', ')}}); `
        case 'csharp': return `__PT.T(${line}, ${q}, new object[]{${vars.map((v) => `"${v.name}", ${v.name}`).join(', ')}}); `
        case 'kotlin': return `__PT.t(${line}, ${q}, arrayOf<Any?>(${vars.map((v) => `"${v.name}", ${v.name}`).join(', ')})); `
        case 'go': return `__pt(${line}, ${q}${vars.map((v) => `, "${v.name}", ${v.name}`).join('')}); `
        case 'nodejs': return `__pt(${line}, ${q}, [${vars.map((v) => `[${JSON.stringify(v.name)}, () => ${v.name}]`).join(', ')}]); `
        case 'php': return `__pt(${line}, get_defined_vars()); `
        case 'c': return `__pt_b(${line}, ${q}, __builtin_frame_address(0)); ${vars.map((v) => v.carr ? `__PT_A${v.carr.toUpperCase()}("${v.name}", ${v.name}, (int)(sizeof(${v.name}) / sizeof(${v.name}[0]))); ` : `__PT_V("${v.name}", ${v.name}); `).join('')}__pt_e(); `
        case 'cpp': return `__pt::b(${line}, ${q}, __builtin_frame_address(0)); ${vars.map((v) => `__pt::v("${v.name}", ${v.name}); `).join('')}__pt::e(); `
    }
}

// ─── 5. Walk the program ────────────────────────────────────────────────────
const CONT_END = /(,|\(|\[|\+|-|\*|\/|%|&|\||\^|=|<|>|!|\?|:|\.|\\)$/
const NO_SEMI = new Set<ILang>(['go', 'kotlin', 'nodejs'])

export type InstrumentResult = { code: string; traced: number }

export function instrument(source: string, lang: ILang): InstrumentResult {
    const masked = mask(source, lang)
    const srcLines = source.split('\n')
    const mLines = masked.split('\n')
    const hasMain = lang !== 'csharp' || /\bstatic\s+(async\s+)?[\w<>]+\s+Main\s*\(/.test(masked)
    const topKind: BlockKind = lang === 'nodejs' || lang === 'php' || !hasMain ? 'code' : 'top'
    const topFn = lang === 'nodejs' || lang === 'php' ? '<global>' : 'Main'
    const stack: Block[] = [{ kind: topKind, paren: 0, vars: [], base: 0, pending: [], unassigned: [], fn: topFn, boundary: false, header: '' }]
    let paren = 0
    let header = ''
    let nextBlockVars: Var[] = []
    let prevSig = '{' // last significant character before the current line
    let prevTrim = ''
    let lastClosedHeader = ''
    let traced = 0
    const out: string[] = []

    const visibleVars = (): Var[] => {
        const seen = new Set<string>()
        const vs: Var[] = []
        let inFunction = false
        for (let k = stack.length - 1; k >= 0; k--) {
            const b = stack[k]
            if (b.kind === 'type') break
            // Script-level variables (JS/PHP) belong to the global frame, which
            // the visualizer already shows; a function lists its own.
            if (k === 0 && inFunction) break
            if (b.fn) inFunction = true
            for (let j = b.vars.length - 1; j >= 0; j--) {
                const v = b.vars[j]
                if (!seen.has(v.name)) { seen.add(v.name); vs.push(v) }
            }
            if (b.boundary) break
        }
        return vs.reverse().slice(-MAX_VARS)
    }
    const currentFn = (): string => {
        for (let k = stack.length - 1; k >= 0; k--) if (stack[k].fn) return stack[k].fn
        return topFn
    }

    for (let li = 0; li < srcLines.length; li++) {
        const raw = srcLines[li]
        const text = mLines[li] ?? ''
        const trimmed = text.trim()
        if (!trimmed || ((lang === 'c' || lang === 'cpp' || lang === 'csharp') && trimmed.startsWith('#'))) { out.push(raw); continue }

        const top = stack[stack.length - 1]
        // For languages without semicolons a finished line ends the header
        // (unless it was a function/control header waiting for its `{`).
        if (NO_SEMI.has(lang) && paren === top.paren && !CONT_END.test(prevTrim)
            && !/^(?:\}\s*)?(?:else\s+)?(?:if|for|while|switch|catch|function|fun|func)\b.*\)$/.test(prevTrim)) header = ''
        // A new `case` in C-family switches: locals of the previous case are
        // not assigned here (Java/C# would refuse to read them).
        if (top.kind === 'code' && /^(case\b|default\b)/.test(trimmed)) { top.vars.length = top.base; top.pending = []; top.unassigned = [] }

        let isStmt = false
        if (top.kind === 'code' && paren === top.paren) {
            const bad = /^(\}|\)|\]|\.|\?|:(?!:)|&&|\|\||,|else\b|catch\b|finally\b|case\b|default\b|@|import\b|package\b|using\b|where\b|->|=>|<\?php|\?>|super\s*\(|this\s*\(|extends\b|implements\b|throws\b|\+|\*|\/|%|=[^=]|<<|>>(?!=))/.test(trimmed)
                || (/^[A-Za-z_]\w*\s*:(?![:=])/.test(trimmed) && lang !== 'kotlin' && lang !== 'nodejs' && lang !== 'php')
                || (/^while\b/.test(trimmed) && /^do\b/.test(lastClosedHeader) && prevTrim === '}')
            const braceless = /^(\}\s*)?(else\s+)?(if|for|foreach|while)\b.*\)$|^(\}\s*)?else$|^do$/.test(prevTrim)
            const afterLabel = prevSig === ':' && /^(case\b|default\b)/.test(prevTrim)
            const kotlinLambda = lang === 'kotlin' && /\{\s*[\w\s,()]*->$/.test(prevTrim)
            const ended = ';{}'.includes(prevSig) || afterLabel || kotlinLambda || (NO_SEMI.has(lang) && !CONT_END.test(prevTrim))
            isStmt = !bad && !braceless && ended
        }

        let line = raw
        if (isStmt) {
            // Declarations from earlier statements become visible now.
            top.vars.push(...top.pending); top.pending = []
            const stmt = text.trim()
            // Unassigned locals that get a value on this line.
            for (let k = stack.length - 1; k >= 0; k--) {
                const b = stack[k]
                if (b.kind !== 'code') break
                if ((lang === 'java' || lang === 'csharp') && b !== top) continue
                b.unassigned = b.unassigned.filter((v) => {
                    if (!assignsTo(stmt, v.name, lang)) return true
                    b.pending.push(v); if (b !== top) top.pending.push(v)
                    return false
                })
                if (b.boundary) break
            }
            const col = raw.length - raw.trimStart().length
            const call = traceCall(lang, li + 1, currentFn(), visibleVars())
            line = raw.slice(0, col) + call + raw.slice(col)
            traced++
            const d = declarations(stmt, lang)
            top.pending.push(...d.vars)
            top.unassigned.push(...d.unassigned)
            nextBlockVars = d.blockVars
            header = ''
        } else if (top.kind === 'code' || top.kind === 'type' || top.kind === 'top') {
            // `} catch (Exception e) {`, `} else if (x := …)` and friends.
            const d = declarations(trimmed.replace(/^\}\s*/, ''), lang)
            if (d.blockVars.length) nextBlockVars = d.blockVars
        }

        // Scan the line's characters to follow blocks and brackets.
        for (let k = 0; k < text.length; k++) {
            const ch = text[k]
            if (ch === '(' || ch === '[') { paren++; header += ch }
            else if (ch === ')' || ch === ']') { paren = Math.max(0, paren - 1); header += ch }
            else if (ch === '{') {
                const parent = stack[stack.length - 1]
                const info = classify(header, parent, lang)
                const blk: Block = {
                    kind: info.kind, paren, vars: [], base: 0, pending: [], unassigned: [],
                    fn: info.fn || '', boundary: !!info.boundary, header: header.trim(),
                }
                if (info.kind === 'code') {
                    blk.vars.push(...(info.params || []))
                    blk.vars.push(...nextBlockVars)
                    if (/^main$/i.test(blk.fn)) blk.vars = blk.vars.filter((v) => v.name !== 'args')
                    if (lang === 'kotlin') {
                        // Kotlin lambda parameters: `{ x ->` / `{ (k, v) ->`
                        const after = text.slice(k + 1)
                        const lp = /^\s*\(?([\w\s,]+?)\)?\s*->/.exec(after)
                        if (lp) lp[1].split(',').map((x) => x.trim()).filter((x) => IDENT.test(x) && x !== '_').forEach((name) => blk.vars.push({ name }))
                    }
                }
                blk.base = blk.vars.length
                nextBlockVars = []
                stack.push(blk)
                header = ''
            } else if (ch === '}') {
                if (stack.length > 1) { lastClosedHeader = stack.pop()!.header }
                header = ''
            } else if (ch === ';' && paren === stack[stack.length - 1].paren
                // Go headers carry their own `;`: if x := f(); x > 0 {
                && !(lang === 'go' && /^\s*(\}\s*)?(else\s+)?(if|for|switch|select)\b/.test(header))) {
                header = ''
                nextBlockVars = []
            } else header += ch
        }
        header += ' '

        const sig = trimmed.replace(/\s+$/, '')
        prevSig = sig[sig.length - 1] || prevSig
        prevTrim = sig
        out.push(line)
    }
    return { code: out.join('\n'), traced }
}
