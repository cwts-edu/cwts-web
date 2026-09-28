/**
 * Page Tree & Hierarchical Vector Sorting Utilities
 */

import type { ContentEntry } from "./types";
import type { PageMetadata } from "./schemas";

export interface PageTreeNode {
  id: string;
  slug: string;
  language: "zh" | "en";
  title: string;
  order: number;
  depth: number;
  coverImage?: string;
  thumbnail?: string;
  showChildren?: boolean;
  status: "published" | "draft" | "deleted";
  children: PageTreeNode[];
}

/**
 * Compares two order vectors lexicographically.
 * e.g. [1, 2] < [1, 3], and [2, 1] < [2, 1, 1]
 */
export function compareOrderVectors(aVector: number[], bVector: number[]): number {
  const minLen = Math.min(aVector.length, bVector.length);
  for (let i = 0; i < minLen; i++) {
    if (aVector[i] !== bVector[i]) {
      return aVector[i] - bVector[i];
    }
  }
  return aVector.length - bVector.length;
}

/**
 * Computes the order vector for a page based on all its ancestors
 */
export function getPageOrderVector(
  slug: string,
  pageMap: Map<string, number>,
  language?: string
): number[] {
  if (!slug) return [0];
  const parts = slug.split("/");
  const vec: number[] = [];

  for (let i = 1; i <= parts.length; i++) {
    const ancestorSlug = parts.slice(0, i).join("/");
    const key = language ? `${language}:${ancestorSlug}` : ancestorSlug;
    vec.push(pageMap.get(key) ?? 999);
  }
  return vec;
}

/**
 * Sorts an array of pages in topological depth-first tree order
 */
export function sortPagesHierarchically<T extends { slug: string; language?: string; data: { order?: number } }>(
  pages: T[]
): T[] {
  const pageMap = new Map<string, number>();
  for (const p of pages) {
    const key = p.language ? `${p.language}:${p.slug}` : p.slug;
    pageMap.set(key, typeof p.data.order === "number" ? p.data.order : 999);
  }

  return [...pages].sort((a, b) => {
    if (a.language && b.language && a.language !== b.language) {
      // Sort Traditional Chinese before English
      return b.language.localeCompare(a.language);
    }
    const vecA = getPageOrderVector(a.slug, pageMap, a.language);
    const vecB = getPageOrderVector(b.slug, pageMap, b.language);
    const cmp = compareOrderVectors(vecA, vecB);
    if (cmp !== 0) return cmp;
    return a.slug.localeCompare(b.slug);
  });
}

/**
 * Builds a hierarchical tree graph from a flat list of page entries
 */
export function buildPageTree(
  entries: ContentEntry<PageMetadata>[]
): PageTreeNode[] {
  const nodeMap = new Map<string, PageTreeNode>();
  const roots: PageTreeNode[] = [];

  const getNodeKey = (lang: string, slug: string) => `${lang}:${slug}`;

  // 1. Create nodes
  for (const entry of entries) {
    const depth = entry.slug ? entry.slug.split("/").length - 1 : 0;
    const lang = (entry.language as "zh" | "en") || "zh";
    const node: PageTreeNode = {
      id: entry.id,
      slug: entry.slug,
      language: lang,
      title: entry.data.title || entry.slug,
      order: entry.data.order ?? 1,
      depth,
      coverImage: entry.data.coverImage,
      thumbnail: entry.data.thumbnail,
      showChildren: entry.data.showChildren,
      status: (entry as any).status || "published",
      children: [],
    };
    nodeMap.set(getNodeKey(lang, entry.slug), node);
  }

  // 2. Attach children to parents
  for (const entry of entries) {
    const lang = (entry.language as "zh" | "en") || "zh";
    const node = nodeMap.get(getNodeKey(lang, entry.slug))!;
    if (!entry.slug.includes("/")) {
      roots.push(node);
    } else {
      const parentSlug = entry.slug.split("/").slice(0, -1).join("/");
      const parent = nodeMap.get(getNodeKey(lang, parentSlug));
      if (parent) {
        parent.children.push(node);
      } else {
        roots.push(node);
      }
    }
  }

  // 3. Sort siblings recursively by local order
  const sortTreeNodes = (nodes: PageTreeNode[]) => {
    nodes.sort((a, b) => {
      if (a.language !== b.language) {
        return b.language.localeCompare(a.language);
      }
      return a.order - b.order;
    });
    for (const n of nodes) {
      sortTreeNodes(n.children);
    }
  };
  sortTreeNodes(roots);

  return roots;
}
