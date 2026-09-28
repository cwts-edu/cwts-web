/**
 * Media Collections Configuration & Types
 * Central registry for image and file collections managed in Firebase Storage.
 */

export interface MediaDimensions {
  width: number;
  height: number;
}

export interface MediaCollectionConfig {
  id: string;
  title: string;
  collectionPath: string; // Firebase Storage folder path e.g. "images/news"
  type: "image" | "file";
  allowedMimeTypes: string[];
  aspectRatio?: number; // e.g. 400 / 220
  aspectRatioLabel?: string; // e.g. "20:11 (400 × 220 px)"
  targetDimensions?: MediaDimensions;
  quality?: number; // 0.1 to 1.0 (e.g. 0.9)
  maxFileSizeMB?: number;
  description?: string;
}

export interface MediaItem {
  id: string;
  name: string;
  collectionId: string;
  collectionPath: string;
  filePath: string;
  siteRelativePath: string; // e.g. "/images/news/newsletter-2026A.jpg"
  downloadUrl: string;
  size?: number; // in bytes
  contentType?: string;
  updatedAt?: string; // ISO string
}

export const MEDIA_COLLECTIONS: Record<string, MediaCollectionConfig> = {
  "news-thumbnails": {
    id: "news-thumbnails",
    title: "News Thumbnails",
    collectionPath: "images/news",
    type: "image",
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
    aspectRatio: 400 / 220,
    aspectRatioLabel: "20:11 (400 × 220 px)",
    targetDimensions: { width: 400, height: 220 },
    quality: 0.9,
    maxFileSizeMB: 15,
    description: "Featured thumbnail images for news articles (standard 400×220 aspect).",
  },
  "job-docs": {
    id: "job-docs",
    title: "Job Description PDFs",
    collectionPath: "docs/jobs",
    type: "file",
    allowedMimeTypes: ["application/pdf"],
    maxFileSizeMB: 25,
    description: "Downloadable PDF documents for job postings.",
  },
  "faculty-photos": {
    id: "faculty-photos",
    title: "Faculty Portrait Photos",
    collectionPath: "images/faculty",
    type: "image",
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
    aspectRatio: 1,
    aspectRatioLabel: "1:1 Square (400 × 400 px)",
    targetDimensions: { width: 400, height: 400 },
    quality: 0.9,
    maxFileSizeMB: 15,
    description: "Portrait photos for core and adjunct faculty members (1:1 square).",
  },
  "carousel-images": {
    id: "carousel-images",
    title: "Homepage Carousel Banners",
    collectionPath: "images/carousel",
    type: "image",
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
    aspectRatio: 2560 / 1067,
    aspectRatioLabel: "2.4:1 (2560 × 1067 px)",
    targetDimensions: { width: 2560, height: 1067 },
    quality: 0.9,
    maxFileSizeMB: 25,
    description: "High-resolution carousel banners for the homepage hero widget.",
  },
  "page-covers": {
    id: "page-covers",
    title: "Page Cover Banners",
    collectionPath: "images/covers",
    type: "image",
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
    aspectRatio: 1440 / 1080,
    aspectRatioLabel: "4:3 (1440 × 1080 px)",
    targetDimensions: { width: 1440, height: 1080 },
    quality: 0.85,
    maxFileSizeMB: 20,
    description: "Header cover images for content sections and pages (1440×1080).",
  },
  "page-thumbnails": {
    id: "page-thumbnails",
    title: "Page Thumbnails (頁面縮圖)",
    collectionPath: "images/covers",
    type: "image",
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
    aspectRatio: 600 / 350,
    aspectRatioLabel: "12:7 (600 × 350 px)",
    targetDimensions: { width: 600, height: 350 },
    quality: 0.85,
    maxFileSizeMB: 15,
    description: "Thumbnail images for sub-page cards, listings, and social sharing previews (600×350).",
  },
  "general-images": {
    id: "general-images",
    title: "General Images",
    collectionPath: "images/general",
    type: "image",
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"],
    quality: 0.9,
    maxFileSizeMB: 25,
    description: "General-purpose images and photos across the site.",
  },
  "general-docs": {
    id: "general-docs",
    title: "General Documents",
    collectionPath: "docs/general",
    type: "file",
    allowedMimeTypes: [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ],
    maxFileSizeMB: 50,
    description: "General PDF forms, catalogs, and downloadable materials.",
  },
  "newsletter-docs": {
    id: "newsletter-docs",
    title: "Newsletter Documents & Covers",
    collectionPath: "docs/newsletter",
    type: "file",
    allowedMimeTypes: ["application/pdf", "image/png", "image/jpeg"],
    maxFileSizeMB: 50,
    description: "Seminary quarterly newsletter PDF documents and cover image assets.",
  },
  "docs": {
    id: "docs",
    title: "Seminary Documents (PDFs & Forms)",
    collectionPath: "docs",
    type: "file",
    allowedMimeTypes: [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ],
    maxFileSizeMB: 50,
    description: "Official seminary documents, catalogs, schedules, and effectiveness statements.",
  },
};

export interface DocSubfolder {
  id: string;
  name: string;
  folderPath: string;
}

export const DOC_SUBFOLDERS: DocSubfolder[] = [
  { id: "all", name: "All Folders (所有目錄)", folderPath: "docs" },
  { id: "effectiveness-statements", name: "Effectiveness Statements (學院成效報告)", folderPath: "docs/effectiveness-statements" },
  { id: "catalogs", name: "Academic Catalogs (課程概覽)", folderPath: "docs/catalogs" },
  { id: "course-schedules", name: "Course Schedules (課表)", folderPath: "docs/course-schedules" },
  { id: "admissions", name: "Admissions & Applications (入學與申請)", folderPath: "docs/admissions" },
  { id: "dormitory", name: "Dormitory & Housing (宿舍表格)", folderPath: "docs/dormitory" },
  { id: "jobs", name: "Job Descriptions (聘牧職缺)", folderPath: "docs/jobs" },
  { id: "newsletter", name: "Newsletters (院訊)", folderPath: "docs/newsletter" },
  { id: "babc", name: "BABC Convention (教育大會)", folderPath: "docs/babc" },
  { id: "general", name: "General Documents (一般文件)", folderPath: "docs/general" },
];

export function getMediaCollectionConfig(collectionId: string): MediaCollectionConfig {
  const config = MEDIA_COLLECTIONS[collectionId];
  if (!config) {
    return {
      id: collectionId,
      title: collectionId,
      collectionPath: `uploads/${collectionId}`,
      type: "image",
      allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
      quality: 0.9,
    };
  }
  return config;
}

export function getAllMediaCollections(): MediaCollectionConfig[] {
  return Object.values(MEDIA_COLLECTIONS);
}
