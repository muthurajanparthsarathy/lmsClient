// ─── Shared LMS Types ─────────────────────────────────────────────────────────

export interface CourseNode {
  id: string
  name: string
  type: "course" | "module" | "submodule" | "topic" | "subtopic"
  children?: CourseNode[]
  level: number
  originalData?: any
}

export interface Tag {
  tagName: string
  tagColor: string
}

export interface FileSettings {
  showToStudents: boolean
  allowDownload: boolean
  lastModified?: Date
}

export interface UploadedFile {
  id: string
  name: string
  type?: string
  size?: number
  url?: string | { base: string }
  uploadedAt?: Date
  subcategory: string
  folderId: string | null
  progress?: number
  status?: "preparing" | "uploading" | "ready" | "submitting" | "completed" | "error"
  tags?: Tag[]
  folderPath?: string
  isReference?: boolean | string
  isVideo?: boolean
  originalFileName?: string
  description?: string
  accessLevel?: string
  availableResolutions?: string[]         
  fileUrlMap?: Record<string, string>     
  fileSettings?: FileSettings,
  fileDescription?: string;
  groupId?: string;
  groupName?: string;
  parentGroupId?: string;
}

export interface FolderItem {
  id: string
  name: string
  type: "folder"
  parentId: string | null
  parentGroupId?: string;
  groupName?: string;
  groupDescription?: string;
  children: (FolderItem | UploadedFile)[]
  tabType: "I_Do" | "We_Do" | "You_Do"
  subcategory: string
  files?: UploadedFile[]
  subfolders?: FolderItem[]
  tags?: Tag[]
  folderPath?: string
}

export interface SubcategoryData {
  [key: string]: (UploadedFile | FolderItem)[]
}

export interface ContentData {
  I_Do: SubcategoryData
  We_Do: SubcategoryData
  You_Do: SubcategoryData
  [key: string]: SubcategoryData
}

export interface VideoItem {
  id: string
  title: string
  fileName: string
  fileUrl: string                          // base URL (for backward compat)
  availableResolutions: string[]           // e.g. ["360p","240p","base"]
  fileUrlMap: Record<string, string>       // e.g. { "360p": "https://...", "base": "https://..." }
  isVideo: boolean
}

export interface FileTypeConfig {
  key: string
  label: string
  icon: React.ReactNode
  color: string
  tooltip: string
  accept?: string
}

export interface BreadcrumbItem {
  label: string
  type: string
  id: string
  path?: string
}

export interface FolderNavState {
  currentFolderPath: string[]
  currentFolderId: string | null
}

// Type Guards
export const isFolderItem = (item: FolderItem | UploadedFile): item is FolderItem =>
  (item as FolderItem).type === "folder"

export const isUploadedFile = (item: FolderItem | UploadedFile): item is UploadedFile =>
  (item as UploadedFile).url !== undefined