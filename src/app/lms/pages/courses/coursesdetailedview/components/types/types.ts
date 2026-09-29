// types.ts
export interface PedagogyLink { _id?:string; name:string; url:string; uploadedAt?:string }
// types.ts - UPDATED PedagogyFile interface
export interface PedagogyFile {
  _id?: string;
  fileName: string;
  fileType: string;
  size: string;
  uploadedAt?: string;
  fileUrl: string | { base?: string; [k: string]: string | undefined };
  isReference?: boolean;
  isVideo?: boolean;
  isArchive?: boolean;
  availableResolutions?: string[];
  fileSettings?: { showToStudents: boolean; allowDownload: boolean; lastModified?: string };
  tags?: Array<{ tagName: string; tagColor: string }>;
  // Add these group properties
  groupId?: string;           // Which group this file belongs to
  groupName?: string;         // Display name of the group
  parentGroupId?: string;     // If this file is inside a group folder
  folderId?: string;          // Which folder contains this file
}
export interface PedagogyFolder { _id?:string; name:string; files:PedagogyFile[]; subfolders?:PedagogyFolder[]; uploadedAt?:string; tags?:Array<{tagName:string;tagColor:string}> ; groupName?: string;       
  parentGroupId?: string;    
  parentId?: string;         
  folderPath?: string;   }
export interface PedagogyPage { _id:string; title:string; combinedCode:string; pageCount?:number; createdAt?:string; isMultiPage?:boolean; groupId?:string; groupName?:string; }
export interface PedagogyItem { description?:string; files?:PedagogyFile[]; folders?:PedagogyFolder[]; links?:PedagogyLink[]; pages?:PedagogyPage[]; _id?:string }
export interface Pedagogy { I_Do?:Record<string,PedagogyItem>|string[]; We_Do?:Record<string,PedagogyItem>|string[]; You_Do?:Record<string,PedagogyItem>|string[]; _id?:string }
export interface SubTopic { _id:string; title:string; description:string; duration?:string; level?:string; subTopics?:SubTopic[]; pedagogy?:Pedagogy }
export interface Topic    { _id:string; title:string; description:string; duration?:string; level?:string; subTopics?:SubTopic[]; pedagogy?:Pedagogy }
export interface SubModule{ _id:string; title:string; description:string; topics?:Topic[]; pedagogy?:Pedagogy }
export interface Module   { _id:string; title:string; description:string; subModules?:SubModule[]; topics?:Topic[]; pedagogy?:Pedagogy }

/**
 * One resource type's row in Course Setup → Resource Type: whether it's on,
 * its size ceiling, and the AI Chat / AI Summary / Notes sub-switches that
 * decide which buttons its viewer shows.
 */
export interface ResourceTypeConfig {
  enabled?: boolean;
  maxSize?: number;
  aiChat?: boolean;
  aiSummary?: boolean;
  notes?: boolean;
}

// One node's completion rollup — produced by server/utils/topicCompletion.js
// and embedded in the /getAll/courses-data/:id response as `topicProgress`.
// Keyed by node `_id`, indexed on the client per-node so the sidebar can
// look up a topic's status in O(1). Missing nodes → treat as `not_started`.
export type TopicStatus = 'completed' | 'in_progress' | 'not_started' | 'locked';
export interface TopicProgressEntry {
  status: TopicStatus;
  completedRequiredItems: number;
  totalRequiredItems: number;
  iDoComplete: boolean;
  weDoComplete: boolean;
  youDoComplete: boolean;
  iDo: { total: number; completed: number };
  weDo: { total: number; completed: number };
  youDo: { total: number; completed: number };
}
export type TopicProgressMap = Record<string, TopicProgressEntry>;

export interface CourseData {
  _id:string; courseName:string; courseDescription:string; courseHierarchy?:string[];
  I_Do?:string[]; We_Do?:string[]; You_Do?:string[];
  modules?:Module[];
  /** Per-node completion rollup for the sidebar's tick — server authoritative. */
  topicProgress?: TopicProgressMap;
  /** Per-pedagogy-phase resource config saved by Course Setup. */
  resourcesType?: {
    iDo?: Record<string, ResourceTypeConfig | undefined>;
    weDo?: Record<string, ResourceTypeConfig | undefined>;
    youDo?: Record<string, ResourceTypeConfig | undefined>;
  };
  batchAndParticipants?: Array<{
    _id?: string
    batchName?: string
    users?: Array<{
      user?: {
        _id?: string
        courses?: Array<{ courseId: string; answers?: Record<string, any> }>
        [key: string]: any
      }
      [key: string]: any
    }>
    [key: string]: any
  }>
}

export type ResourceType = "video"|"pdf"|"ppt"|"zip"|"link"|"reference"|"page"|"image"|"word"|"txt"
export interface Resource {
  id:string; title:string; type:ResourceType;
  fileUrl?:string|{base?:string;[k:string]:string|undefined}; 
  mcqQuestions?:any[];
  isReference?:boolean; externalUrl?:string; fileSize?:string; uploadedAt?:string;
  fileName?:string; isFolder?:boolean; folderContents?:Resource[]; folderType?:"similar"|"mixed";
  fileSettings?:{showToStudents:boolean;allowDownload:boolean};
  isVideo?:boolean; isArchive?:boolean; 
  availableResolutions?: string[];
  fileUrlMap?: Record<string, string>;
  _combinedCode?:string; _pageCount?:number; originalFolder?:string; folderName?:string;
  tags?: Array<{tagName:string; tagColor:string}>;
  groupId?: string;
  groupName?: string;
  parentGroupId?: string;
}
export interface PedagogySubItem { key:string; name:string; description:string; files:PedagogyFile[]; folders?:PedagogyFolder[]; links?:PedagogyLink[] }
export type LearningElementType = "i-do"|"we-do"|"you-do"
export interface LearningElement { id:string; title:string; type:LearningElementType; icon:React.ComponentType<any>; color:string; subItems:PedagogySubItem[] }
export type SelectedItemType = "module"|"submodule"|"topic"|"subtopic"
export interface SelectedItem { id:string; title:string; type:SelectedItemType; hierarchy:string[]; pedagogy?:Pedagogy }
export type SortField = "name"|"size"|"date"
export interface SortConfig { field:SortField; direction:"asc"|"desc" }
export interface RoleSwitchState { isDummyStudent:boolean; originalRole?:string; originalRenameRole?:string; switchTimestamp?:number }