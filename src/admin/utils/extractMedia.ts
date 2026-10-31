/**
 * Modular Media Extraction Engine
 * 
 * Provides collection-specific metadata extractors and universal rich-text / body parsers
 * to extract and normalize referenced media assets (images, PDFs, documents) into canonical
 * relative storage paths (e.g. "images/news/photo.jpg", "docs/jobs/posting.pdf").
 */

/**
 * Normalizes any URL, site-relative path, or Firebase Storage URL into a clean
 * relative storage path (e.g. "images/news/example.jpg").
 */
export function normalizeStoragePath(rawUrlOrPath?: string | null): string | null {
  if (!rawUrlOrPath || typeof rawUrlOrPath !== "string") return null;

  let trimmed = rawUrlOrPath.trim();
  if (!trimmed) return null;

  // Remove trailing query params and hash
  trimmed = trimmed.split("?")[0].split("#")[0];

  // 1. Firebase Storage URL (e.g. https://firebasestorage.googleapis.com/v0/b/.../o/images%2Fnews%2Fphoto.jpg)
  if (trimmed.includes("firebasestorage.googleapis.com")) {
    try {
      const match = trimmed.match(/\/o\/([^?]+)/);
      if (match && match[1]) {
        const decoded = decodeURIComponent(match[1]).replace(/^\/+/, "");
        if (decoded.startsWith("images/") || decoded.startsWith("docs/")) {
          return decoded;
        }
      }
    } catch {}
  }

  // 2. Direct site-relative path with leading slash (e.g. /images/... or /docs/...)
  if (trimmed.startsWith("/images/") || trimmed.startsWith("/docs/")) {
    return trimmed.replace(/^\/+/, "");
  }

  // 3. Storage relative path without leading slash (e.g. images/... or docs/...)
  if (trimmed.startsWith("images/") || trimmed.startsWith("docs/")) {
    return trimmed;
  }

  return null;
}

/**
 * Recursively traverses a TipTap/ProseMirror JSON document AST and extracts media URLs.
 */
function traverseTipTapAst(node: any, assetSet: Set<string>) {
  if (!node || typeof node !== "object") return;

  // Check attributes of current node
  if (node.attrs && typeof node.attrs === "object") {
    const candidateFields = ["src", "url", "imageUrl", "file", "downloadUrl", "href"];
    for (const field of candidateFields) {
      if (typeof node.attrs[field] === "string") {
        const normalized = normalizeStoragePath(node.attrs[field]);
        if (normalized) assetSet.add(normalized);
      }
    }
  }

  // Check custom widget / figure embeds
  if (node.type === "image" || node.type === "pdfCard" || node.type === "figure") {
    for (const val of Object.values(node.attrs || {})) {
      if (typeof val === "string") {
        const normalized = normalizeStoragePath(val);
        if (normalized) assetSet.add(normalized);
      }
    }
  }

  // Recurse into children
  if (Array.isArray(node.content)) {
    for (const child of node.content) {
      traverseTipTapAst(child, assetSet);
    }
  }
}

/**
 * Scans markdown or HTML text for embedded image and document paths.
 */
function scanTextForMediaPaths(text: string, assetSet: Set<string>) {
  if (!text || typeof text !== "string") return;

  // 1. Markdown images: ![...](url)
  const mdImgMatches = text.matchAll(/!\[.*?\]\(([^)\s]+)(?:\s+["'].*?["'])?\)/g);
  for (const m of mdImgMatches) {
    const sp = normalizeStoragePath(m[1]);
    if (sp) assetSet.add(sp);
  }

  // 2. Markdown links: [...](url) (for docs or images)
  const mdLinkMatches = text.matchAll(/\[.*?\]\(([^)\s]+)(?:\s+["'].*?["'])?\)/g);
  for (const m of mdLinkMatches) {
    const sp = normalizeStoragePath(m[1]);
    if (sp) assetSet.add(sp);
  }

  // 3. HTML attributes: src="..." or href="..."
  const htmlMatches = text.matchAll(/(?:src|href)=["']([^"']+)["']/g);
  for (const m of htmlMatches) {
    const sp = normalizeStoragePath(m[1]);
    if (sp) assetSet.add(sp);
  }

  // 4. Raw Firebase Storage URLs in text
  const fbMatches = text.matchAll(/https:\/\/firebasestorage\.googleapis\.com\/v0\/b\/[^/]+\/o\/([^?&"'\s\)]+)/g);
  for (const m of fbMatches) {
    try {
      const decoded = decodeURIComponent(m[1]).replace(/^\/+/, "");
      if (decoded.startsWith("images/") || decoded.startsWith("docs/")) {
        assetSet.add(decoded);
      }
    } catch {}
  }
}

/**
 * Universal rich-text / body media extractor.
 * Handles both TipTap structured JSON AST and markdown/HTML text.
 */
export function extractBodyMedia(bodyJson?: any, bodyHtmlOrMd?: string): string[] {
  const assetSet = new Set<string>();

  if (bodyJson) {
    traverseTipTapAst(bodyJson, assetSet);
  }

  if (bodyHtmlOrMd) {
    scanTextForMediaPaths(bodyHtmlOrMd, assetSet);
  }

  return Array.from(assetSet);
}

/**
 * Modular Collection Extractor Contract.
 * Each content type defines its own metadata extraction rules.
 */
export interface CollectionMediaExtractor<T = any> {
  extractMetadataMedia: (data: T) => string[];
}

/**
 * Registry of collection-specific metadata extractors.
 */
export const MediaExtractors: Record<string, CollectionMediaExtractor> = {
  news: {
    extractMetadataMedia: (data: { thumbnail?: string }) => {
      const p = normalizeStoragePath(data?.thumbnail);
      return p ? [p] : [];
    },
  },
  jobs: {
    extractMetadataMedia: (data: { file?: string }) => {
      const p = normalizeStoragePath(data?.file);
      return p ? [p] : [];
    },
  },
  pages: {
    extractMetadataMedia: (data: { coverImage?: string; thumbnail?: string }) => {
      const res: string[] = [];
      const c = normalizeStoragePath(data?.coverImage);
      const t = normalizeStoragePath(data?.thumbnail);
      if (c) res.push(c);
      if (t) res.push(t);
      return res;
    },
  },
  faculty: {
    extractMetadataMedia: (data: { photo?: string }) => {
      const p = normalizeStoragePath(data?.photo);
      return p ? [p] : [];
    },
  },
  "degrees-programs": {
    extractMetadataMedia: (data: { thumbnail?: string }) => {
      const p = normalizeStoragePath(data?.thumbnail);
      return p ? [p] : [];
    },
  },
};

/**
 * Combines collection metadata extraction and rich-text body extraction
 * to return a unique, sorted list of referenced storage assets.
 */
export function extractReferencedMediaForCollection(
  collectionName: string,
  metadata: any,
  bodyJson?: any,
  bodyHtmlOrMd?: string
): string[] {
  const assets = new Set<string>();

  // 1. Collection-specific metadata extraction
  const extractor = MediaExtractors[collectionName];
  if (extractor && metadata) {
    const metaAssets = extractor.extractMetadataMedia(metadata);
    for (const p of metaAssets) {
      if (p) assets.add(p);
    }
  }

  // 2. Rich-text body extraction (TipTap AST and Markdown/HTML)
  const bodyAssets = extractBodyMedia(bodyJson, bodyHtmlOrMd);
  for (const p of bodyAssets) {
    if (p) assets.add(p);
  }

  return Array.from(assets).sort();
}
