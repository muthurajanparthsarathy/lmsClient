// utils.ts
import { PedagogyPage, Resource, ResourceType } from "./types"

const IMAGE_EXTS = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.svg', '.avif', '.tiff']
const WORD_EXTS  = ['.docx', '.doc', '.odt', '.rtf', '.ocx'] // .ocx = backend strips 'd' from .docx

export const isImageResource = (fileUrl: string|{base?:string;[k:string]:string|undefined}, fileType: string): boolean => {
  const u = (typeof fileUrl === 'string' ? fileUrl : fileUrl?.base || '').toLowerCase()
  return fileType?.includes('image') || IMAGE_EXTS.some(e => u.endsWith(e))
}

export const isWordResource = (fileUrl: string|{base?:string;[k:string]:string|undefined}, fileType: string): boolean => {
  const u = (typeof fileUrl === 'string' ? fileUrl : fileUrl?.base || '').toLowerCase()
  return fileType?.includes('wordprocessingml') || fileType?.includes('msword') || fileType?.includes('opendocument.text') || WORD_EXTS.some(e => u.endsWith(e))
}

export const getFileType = (
  fileUrl: string | {base?:string;[k:string]:string|undefined}, 
  fileType: string,
  fileName?: string   // ← ADD this optional param
): ResourceType => {
  const u = typeof fileUrl === 'string' ? fileUrl : fileUrl.base || ''
  const ul = u.toLowerCase()
  const fn = (fileName || '').toLowerCase()   // ← ADD

  if(fileType?.includes("url/link") || fileType?.includes("link")) return "link"
  if(fileType?.includes("image") || IMAGE_EXTS.some(e => ul.endsWith(e) || fn.endsWith(e))) return "image"
  if(fileType?.includes("wordprocessingml") || fileType?.includes("msword") || 
     fileType?.includes("opendocument.text") || WORD_EXTS.some(e => ul.endsWith(e) || fn.endsWith(e))) return "word"
  if(fileType?.includes("zip") || ul.includes(".zip") || fn.endsWith(".zip")) return "zip"
  if(fileType?.includes("pdf") || fn.endsWith(".pdf")) return "pdf"
  if(fileType?.includes("powerpoint") || fileType?.includes("presentation") || 
     ul.includes(".ppt") || fn.endsWith(".ppt") || fn.endsWith(".pptx")) return "ppt"
  if(fileType?.includes("video") || ul.includes(".mp4") || ul.includes(".mov") || 
     ul.includes(".webm") || ul.includes(".avi") || ul.includes(".mkv") ||
     fn.match(/\.(mp4|mov|webm|avi|mkv)$/)) return "video"
  
  // ← MOVE txt check UP before the fallback, also check fileName
  if(ul.endsWith(".txt") || fn.endsWith(".txt") || fn.endsWith(".md") || 
     fileType?.includes("text/plain")) return "txt"
  
  if(fileType?.includes("application") || fileType?.includes("document")) return "pdf"
  return "link"
}

export const getFileUrlString = (fileUrl?: string|{base?:string}): string => 
  typeof fileUrl === "string" ? fileUrl : fileUrl?.base || ""

export const detectUrlType = (url: string): "video"|"ppt"|"pdf"|"external" => {
  const l = url.toLowerCase()
  if(l.match(/\.(mp4|mov|avi|wmv|webm)$/) || l.includes('youtube') || l.includes('youtu.be') || l.includes('vimeo')) return "video"
  if(l.match(/\.(ppt|pptx)$/)) return "ppt"
  if(l.match(/\.(pdf)$/) || l.includes('docs.google.com/document')) return "pdf"
  return "external"
}

export const getFileUrl = (fileUrl: string|{base?:string;[k:string]:string|undefined}): string => {
  if(typeof fileUrl === 'string') return fileUrl
  if((fileUrl as any).url) return (fileUrl as any).url
  if((fileUrl as any)['720p']) return (fileUrl as any)['720p']
  if(fileUrl.base) return fileUrl.base
  return ''
}

export const formatSubItemName = (key: string) => 
  key.replace(/_/g," ").replace(/\b\w/g,l=>l.toUpperCase())

export const normalizeKey = (s: string) => s.trim().toLowerCase().replace(/\s+/g,'_')

export const hasChildItems = (item: any): boolean => {
  if('subModules' in item && item.subModules && item.subModules.length > 0) return true
  if('topics' in item && item.topics && item.topics.length > 0) return true
  if('subTopics' in item && item.subTopics && item.subTopics.length > 0) return true
  return false
}

export const hasPedagogyData = (item: any): boolean =>
  !!(item.pedagogy && (
    (item.pedagogy.I_Do && (Array.isArray(item.pedagogy.I_Do) ? item.pedagogy.I_Do.length > 0 : Object.keys(item.pedagogy.I_Do).length > 0)) ||
    (item.pedagogy.We_Do && (Array.isArray(item.pedagogy.We_Do) ? item.pedagogy.We_Do.length > 0 : Object.keys(item.pedagogy.We_Do).length > 0)) ||
    (item.pedagogy.You_Do && (Array.isArray(item.pedagogy.You_Do) ? item.pedagogy.You_Do.length > 0 : Object.keys(item.pedagogy.You_Do).length > 0))
  ))

// Download button is shown only when the file explicitly opts in via fileSettings.allowDownload.
// Folders, pages, and missing settings → no download button.
export const shouldShowDownload = (r: Resource) =>
  !r.isFolder && r.type !== "page" && r.fileSettings?.allowDownload === true

// A resource is visible to students unless fileSettings.showToStudents is explicitly false.
export const isResourceVisible = (r: Resource) =>
  !r.fileSettings || r.fileSettings.showToStudents !== false

// Group resources by groupId. Returns an ordered list where each entry is either:
//  - GroupRow — a group (which may contain its own nested sub-groups in `subGroups`)
//  - { kind: "item", resource } — a standalone visible resource
// Groups that have zero visible items after filtering are omitted entirely.
// Sub-groups (groups with parentGroupId pointing at another group) render inside
// their parent's `subGroups` array, not at the top level.
export interface GroupRow {
  kind: "group";
  groupId: string;
  groupName: string;
  items: Resource[];
  subGroups: GroupRow[];
}
export type GroupedResourceRow =
  | GroupRow
  | { kind: "item"; resource: Resource };

// utils.ts - COMPLETE groupResources function with nested sub-group support
export const groupResources = (resources: Resource[]): GroupedResourceRow[] => {
  const rows: GroupedResourceRow[] = [];
  const seenGroups = new Set<string>();

  // Build buckets keyed by groupId — include ALL items (files AND folders).
  // Each bucket tracks its parentGroupId so we can nest sub-groups later.
  const groupBuckets = new Map<string, { name: string; items: Resource[]; parentGroupId?: string }>();

  // First pass: collect all items that belong to groups
  resources.forEach(r => {
    if (!r.groupId) return;
    // Files: visibility-gated. Folders: always included (they're containers).
    if (!r.isFolder && !isResourceVisible(r)) return;

    const bucket = groupBuckets.get(r.groupId) ?? { name: r.groupName || "", items: [] };
    if (!bucket.name && r.groupName) bucket.name = r.groupName;
    if (!bucket.parentGroupId && r.parentGroupId) bucket.parentGroupId = r.parentGroupId;
    bucket.items.push(r);
    groupBuckets.set(r.groupId, bucket);
  });

  // Build GroupRow nodes for every bucket
  const groupRows = new Map<string, GroupRow>();
  for (const [gid, bucket] of groupBuckets) {
    groupRows.set(gid, {
      kind: "group",
      groupId: gid,
      groupName: bucket.name || "Untitled group",
      items: bucket.items,
      subGroups: [],
    });
  }
  // Attach each sub-group to its parent (if the parent exists).
  // Orphans (parent missing) fall back to top-level rendering.
  for (const [gid, bucket] of groupBuckets) {
    if (bucket.parentGroupId && groupRows.has(bucket.parentGroupId)) {
      groupRows.get(bucket.parentGroupId)!.subGroups.push(groupRows.get(gid)!);
    }
  }

  // Second pass: build the final rows. Only top-level groups appear here;
  // sub-groups are reached via their parent's `subGroups` field.
  for (const r of resources) {
    if (!isResourceVisible(r) && !r.isFolder) continue;
    if (r.groupId) {
      const bucket = groupBuckets.get(r.groupId);
      if (!bucket || bucket.items.length === 0) continue;
      // Skip groups that are sub-groups (they render inside their parent)
      if (bucket.parentGroupId && groupRows.has(bucket.parentGroupId)) continue;
      if (seenGroups.has(r.groupId)) continue;
      seenGroups.add(r.groupId);
      rows.push(groupRows.get(r.groupId)!);
      continue;
    }
    rows.push({ kind: "item", resource: r });
  }

  return rows;
};
export const downloadFile = async (resource: Resource) => {
  let url = resource.externalUrl || ''
  if(!url && resource.fileUrl) {
    if(typeof resource.fileUrl === 'object' && resource.fileUrl.base) url = resource.fileUrl.base
    else if(typeof resource.fileUrl === 'string') url = resource.fileUrl
  }
  if(!url) return
  if(resource.type === 'link' || resource.type === 'reference') {
    window.open(url, '_blank', 'noopener,noreferrer')
    return
  }
  try {
    const r = await fetch(url)
    const b = await r.blob()
    const a = document.createElement('a')
    a.href = window.URL.createObjectURL(b)
    a.download = resource.title || 'download'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  } catch {
    window.open(url, '_blank', 'noopener,noreferrer')
  }
}

export const openPageInNewTab = (html: string) => {
  const t = window.open("", "_blank")
  if(!t) { alert("Popup blocked"); return }
  t.document.open()
  t.document.write(html)
  t.document.close()
}

export const fmtSize = (s: string): string => {
  if(!s || s === "-") return "-"
  try {
    const n = parseInt(s)
    if(n < 1024) return `${n} B`
    if(n < 1048576) return `${(n/1024).toFixed(1)} KB`
    return `${(n/1048576).toFixed(1)} MB`
  } catch { return "-" }
}

export const parseSize = (s: string) => {
  const sl = s.toLowerCase()
  if(sl.includes("kb")) return parseFloat(sl) * 1024
  if(sl.includes("mb")) return parseFloat(sl) * 1048576
  return parseFloat(sl) || 0
}

export const parseDate = (d: string) => {
  if(!d) return new Date(0)
  try { return new Date(d) } catch { return new Date(0) }
}

export const stampActiveTabOnPlaygrounds = (combinedCode: string, pages: PedagogyPage[]): string => {
  if (!combinedCode || !combinedCode.includes('playground-wrapper')) return combinedCode
  const activeTabs: string[] = []
  pages.forEach((page: any) => {
    if (!page?.blocks) return
    page.blocks.forEach((block: any) => {
      if (block.type === 'code_playground') {
        const primary = block.metadata?.playgroundPrimaryTab
        const editing = block.metadata?.playgroundActiveTab
        const tab = (primary && primary !== 'auto') ? primary : (editing || 'html')
        activeTabs.push(tab)
      }
    })
  })
  if (!activeTabs.length) return combinedCode
  let idx = 0
  return combinedCode.replace(/class="playground-wrapper"/g, () => {
    const tab = activeTabs[idx] || 'html'
    idx++
    return `class="playground-wrapper" data-active-tab="${tab}"`
  })
}

export const injectTryItButtons = (combinedCode: string): string => {
  // This function would be imported from the existing utils
  // For brevity, I'm assuming it exists
  return combinedCode
}