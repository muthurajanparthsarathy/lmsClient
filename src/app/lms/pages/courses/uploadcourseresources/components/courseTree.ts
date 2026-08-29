// Course structure → sidebar tree.
//
// Lifted out of `uploadcourseresources/page.tsx` so the Grades detail screen
// can mount the same SYLLABUS rail without duplicating the transform. Pure
// function, no React, no closure deps — safe to import from anywhere.

import type {
  CourseStructureData, Module, SubModule, SubTopic, Topic,
} from "@/apiServices/coursesData";
import type { CourseNode } from "./Types";

export function transformToCourseNodes(courseData: CourseStructureData): CourseNode[] {
  return [{
    id: courseData._id, name: courseData.courseName, type: "course", level: 0,
    originalData: courseData,
    children: courseData.modules.map((module: Module) => ({
      id: module._id, name: module.title, type: "module" as const, level: 1,
      originalData: module,
      children: [
        ...module.topics.map((topic: Topic) => ({
          id: topic._id, name: topic.title, type: "topic" as const, level: 2,
          originalData: topic,
          children: topic.subTopics.map((st: SubTopic) => ({
            id: st._id, name: st.title, type: "subtopic" as const, level: 3, originalData: st,
          })),
        })),
        ...module.subModules.map((sm: SubModule) => ({
          id: sm._id, name: sm.title, type: "submodule" as const, level: 2,
          originalData: sm,
          children: sm.topics.map((topic: Topic) => ({
            id: topic._id, name: topic.title, type: "topic" as const, level: 3,
            originalData: topic,
            children: topic.subTopics.map((st: SubTopic) => ({
              id: st._id, name: st.title, type: "subtopic" as const, level: 4, originalData: st,
            })),
          })),
        })),
      ],
    })),
  }];
}

/** Ancestor ids of `targetId`, root-first. Used to auto-expand a node's path. */
export function findPathToNode(nodes: CourseNode[], targetId: string, trail: string[] = []): string[] | null {
  for (const node of nodes) {
    if (node.id === targetId) return trail;
    const found = node.children && findPathToNode(node.children, targetId, [...trail, node.id]);
    if (found) return found;
  }
  return null;
}
