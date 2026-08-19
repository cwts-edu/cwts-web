# Headless CMS Architecture & Progressive Migration Design Document

**Project:** Christian Witness Theological Seminary (CWTS) Website  
**Topic:** Headless CMS on Firebase Free Tier (Spark Plan), Unified Admin Webapp (`cwts.edu/admin`), Direct Content Interface, Draft Workspaces, Netlify Staging Preview, Immutable Version History & Production Release Pipeline  
**Target Environments:** Local Development + Netlify CI/CD + Firebase Spark Plan + Cloudflare Edge  
**Date:** August 2026  
**Status:** Architectural Specification & Implementation Plan  

---

## 1. Executive Summary & Core Architectural Shift

This document details the architectural design for transitioning the CWTS website to a **Firebase-backed Headless CMS Webapp** integrated directly into the codebase.

### The Core Architectural Principles:
1. **Unified Codebase & Build Pipeline (`cwts.edu/admin`):** The CMS Admin webapp is embedded as an Astro Client Island SPA under `src/admin/`. Running `npm run build` builds both the public SSG website and the Admin Webapp into `dist/` and `dist/admin/` with a single command.
2. **Zero Code Duplication (Shared Schema & Types):** The public site and the Admin app share the exact same Zod validation schemas (`src/libs/content/schemas.ts`), TypeScript types, media dimension constants, and Firebase client SDKs.
3. **Direct Content Interface (`@libs/content`):** The entire site code consumes content exclusively via a strongly-typed `IContentClient` interface (`content.news.list()`, `content.pages.getBySlug()`), completely isolated from `astro:content`.
4. **Pluggable & Hybrid Backends:** The underlying implementation is swappable (`FirebaseContentClient`, `AstroContentClient`, `HybridContentClient`), enabling safe, zero-risk progressive canary migrations (`news` and `jobs` first).
5. **Draft Workspaces & Accumulated Changes:** All edits made by an editor accumulate within a private Draft Workspace. Unfinished drafts do not affect the live website.
6. **Netlify Staging Deploy Preview:** A **"Preview"** action in the CMS triggers a Netlify Staging Build with the `DRAFT_ID`. Netlify overlays the draft changes onto the canonical data, giving the editor a real, shareable staging URL to review before going live.
7. **Immutable Published Version History & Rollbacks:** Every published release automatically creates an immutable snapshot (`/collection/{id}/versions/{versionNumber}`). Editors can inspect past versions, compare diffs, and revert individual items or whole releases in one click.
8. **One-Click Production Release & Audit Trail:** A **"Publish to Production"** action promotes all accumulated draft changes into canonical Firestore collections, logs the responsible editor, and triggers the live production Netlify build.
9. **Cross-Build Asset Caching:** Persistent ETag/MD5 metadata cache (`.cache/cwts-assets/`) on Local and Netlify CI/CD builds, guaranteeing **sub-second builds and near-zero Firebase Storage egress (100% within the Spark Free Tier).**
10. **Zero-Compute Free Tier (Spark Plan):** In-browser client-side Web Workers, Canvas, and PDF.js perform all image resizing and PDF cover rendering prior to upload.

---

## 2. High-Level Architecture & Deployment Pipelines

```mermaid
flowchart TD
    subgraph ADMIN_PORTAL ["Admin CMS Webapp (cwts.edu/admin)"]
        AUTH["Whitelist Auth Guard<br/>(@cwts.edu & Admins)"]
        FORMS["Zod Schema-Validated Editors"]
        MEDIA["In-Browser Image Resizer & PDF.js"]
        DRAFT_WS["Accumulated Draft Workspace<br/>(News, Jobs, Faculty, Pages)"]
        HISTORY["Version History & Rollback UI<br/>(v1, v2, v3... Revert to Draft)"]
    end

    subgraph FIRESTORE_DATABASE ["Cloud Firestore (Default DB)"]
        CANONICAL["Canonical Published Collections<br/>/news, /jobs, /faculty, /pages"]
        VERSIONS["Immutable Version Snapshots<br/>/{collection}/{id}/versions/{v}"]
        DRAFTS["Draft Workspaces<br/>/drafts/{draftId}/changes/{docId}"]
        RELEASES["Release History Audit<br/>/releases/{releaseId}"]
    end

    subgraph NETLIFY_BUILDS ["Netlify CI / CD Pipelines"]
        STAGING_BUILD["Netlify Staging / Deploy Preview<br/>(DRAFT_ID=draft_xxx)"]
        PROD_BUILD["Netlify Production Build<br/>(DRAFT_ID=null)"]
    end

    subgraph SITES ["Target Environments"]
        STAGING_SITE["Staging Preview URL<br/>(preview--cwts-staging.netlify.app)"]
        PROD_SITE["Live Production Website<br/>(cwts.edu)"]
    end

    AUTH --> FORMS
    FORMS -->|1. Save Edits| DRAFT_WS
    DRAFT_WS -->|Save Pending Changes| DRAFTS

    DRAFT_WS -->|2. Click 'Preview' (Webhook)| STAGING_BUILD
    DRAFTS & CANONICAL -->|Overlay Draft onto Canonical| STAGING_BUILD
    STAGING_BUILD --> STAGING_SITE
    STAGING_SITE -.->|Visual Review / Feedback| ADMIN_PORTAL

    DRAFT_WS -->|3. Click 'Publish'| CANONICAL
    CANONICAL -->|Snapshot Published State| VERSIONS
    CANONICAL -->|Log Release Audit| RELEASES
    DRAFT_WS -->|Trigger Production Webhook| PROD_BUILD
    CANONICAL -->|Build Static HTML| PROD_BUILD
    PROD_BUILD --> PROD_SITE

    VERSIONS -->|Revert Old Version to Draft| DRAFT_WS
```

---

## 3. Unified Codebase Structure & Admin Webapp (`cwts.edu/admin`)

The Admin Webapp lives inside `src/admin/` and is served at `cwts.edu/admin` via an Astro catch-all client route.

### 3.1 Directory Structure
```
cwts-web/
├── public/
│   ├── _redirects                  # Netlify redirect: /admin/* -> /admin/index.html 200
│   └── favicon.svg
├── src/
│   ├── admin/                      # React CMS Admin Single-Page App (SPA)
│   │   ├── AdminApp.tsx            # Root Router & State Provider
│   │   ├── components/
│   │   │   ├── AdminLayout.tsx     # Admin Header, Sidebar, Navigation
│   │   │   ├── AuthGate.tsx        # Whitelist Access Guard & Login Modal
│   │   │   ├── editor/             # TipTap WYSIWYG Editor
│   │   │   └── media/              # In-Browser Media Resizer & Upload Dropzone
│   │   ├── config/
│   │   │   ├── firebase.ts         # Firebase Client SDK
│   │   │   └── whitelist.ts        # Admin Email Whitelist Service
│   │   ├── context/
│   │   │   ├── AuthContext.tsx     # User & Whitelist Auth Context
│   │   │   └── DraftContext.tsx    # Active Draft Workspace Context
│   │   └── views/
│   │       ├── DashboardView.tsx   # Workspace Overview & Quick Actions
│   │       ├── NewsListView.tsx    # News Table with Draft & Version Badges
│   │       ├── NewsEditView.tsx    # News Editor (Auto-Slug, Save Draft, Publish, History)
│   │       ├── JobsListView.tsx    # Jobs Table with Draft & Version Badges
│   │       └── JobsEditView.tsx    # Jobs Editor (PDF Upload, Save Draft, Publish, History)
│   ├── libs/
│   │   └── content/                # SHARED DOMAIN LAYER
│   │       ├── schemas.ts          # Shared Zod Schemas & TypeScript Types
│   │       ├── constants.ts        # Shared Dimensions, Image Specs, Locales
│   │       ├── types.ts            # IContentClient Contract (with VersionRecord & AuditUser)
│   │       ├── firebaseClient.ts   # Firestore Client with Draft Overlay
│   │       ├── astroClient.ts      # Local Fallback Client
│   │       ├── hybridClient.ts     # Progressive Migration Router
│   │       └── index.ts            # Master Content Singleton Export
│   └── pages/
│       ├── admin/
│       │   └── [...app].astro      # Astro Mount Point for Admin SPA
│       ├── index.astro
│       └── [language]/[...slug].astro
├── netlify.toml
└── package.json
```

---

## 4. Shared Schema Registry & Type System

All entities across the public website and the CMS Admin webapp share the exact same Zod validation schemas and dimension constants from `src/libs/content/`.

### 4.1 Shared Dimension Constants (`src/libs/content/constants.ts`)

```typescript
export const MEDIA_SPECS = {
  cover: { width: 1440, height: 1080, quality: 80, darken: { brightness: 0.4, saturation: 0.4 }, ext: '.cover.webp' },
  thumbnail: { width: 600, height: 350, quality: 80, ext: '.thumbnail.webp' },
  news: { width: 400, height: 220, quality: 85, ext: '.news.webp' },
  carousel: { width: 2560, height: 1067, quality: 90, ext: '.carousel.webp' },
  pdfCover: { height: 528, ext: '.pdf.cover.png' }
} as const;

export const SUPPORTED_LANGUAGES = ['zh', 'en'] as const;
export const DEFAULT_LANGUAGE = 'zh' as const;
```

### 4.2 Shared Zod Schemas (`src/libs/content/schemas.ts`)

```typescript
import { z } from "zod";

export const AuditUserSchema = z.object({
  uid: z.string(),
  email: z.string().email(),
  displayName: z.string().optional(),
  photoURL: z.string().optional(),
  timestamp: z.string(), // ISO String
});
export type AuditUser = z.infer<typeof AuditUserSchema>;

// 1. News Schema
export const NewsMetadataSchema = z.object({
  title: z.string().min(1, "Title is required"),
  date: z.coerce.date(),
  thumbnail: z.string().min(1, "Thumbnail is required"),
  url: z.string().min(1, "Target URL or slug is required"),
});
export type NewsMetadata = z.infer<typeof NewsMetadataSchema>;

// 2. Jobs Schema
export const JobMetadataSchema = z.object({
  title: z.string().min(1, "Title is required"),
  location: z.string().min(1, "Location is required"),
  date: z.coerce.date(),
  file: z.string().optional(),
});
export type JobMetadata = z.infer<typeof JobMetadataSchema>;

// 3. Faculty Schema
export const FacultyMetadataSchema = z.object({
  photo: z.string().optional(),
  name: z.string().min(1, "Name is required"),
  category: z.enum(["faculty", "senior-adjunct", "adjunct"]),
  order: z.number().optional(),
  email: z.string().email().optional().or(z.literal("")),
  positions: z.array(z.string()).optional(),
  courses: z.array(z.string()).default([]),
  degrees: z.array(z.string()).default([]),
  moreDegrees: z.array(z.string()).optional(),
  former: z.array(z.string()).optional(),
});
export type FacultyMetadata = z.infer<typeof FacultyMetadataSchema>;

// 4. Pages Schema
export const PageMetadataSchema = z.object({
  title: z.string().min(1, "Title is required"),
  order: z.number().default(100),
  coverImage: z.string().optional(),
  thumbnail: z.string().optional(),
  showChildren: z.boolean().default(false),
});
export type PageMetadata = z.infer<typeof PageMetadataSchema>;
```

---

## 5. Draft Workspaces, Staging Preview, Version History & Rollback Pipeline

```mermaid
sequenceDiagram
    autonumber
    actor Editor as User / Editor (@cwts.edu)
    participant CMS as Admin CMS (/admin)
    participant FS as Cloud Firestore
    participant Netlify as Netlify Build & CDN
    participant Staging as Staging Preview Site
    participant Prod as Live Production (cwts.edu)

    Note over Editor,CMS: Phase 1: Drafting & Accumulation
    Editor->>CMS: Edit News article & Save
    CMS->>FS: Write to /drafts/{draftId}/changes/{docId} (with author audit)
    Editor->>CMS: Edit Job posting & Save
    CMS->>FS: Write to /drafts/{draftId}/changes/{docId} (accumulated)

    Note over Editor,Netlify: Phase 2: Staging Deploy Preview
    Editor->>CMS: Click "🔍 Preview on Staging"
    CMS->>Netlify: POST Build Hook (DRAFT_ID=draft_123)
    Netlify->>FS: Fetch Canonical data + Overlay /drafts/draft_123 changes
    Netlify->>Staging: Deploy Preview at preview--cwts-staging.netlify.app
    Netlify-->>CMS: Return Staging URL
    CMS-->>Editor: Display "Staging Ready: Open Preview ↗"

    Note over Editor,Staging: Phase 3: Visual Inspection & Iteration
    Editor->>Staging: Review look, feel, formatting, and layout
    alt Formatting needs adjustment
        Editor->>CMS: Make further tweaks & Re-save to draft
    else Everything looks great
        Note over Editor,Prod: Phase 4: Production Release & Snapshot
        Editor->>CMS: Click "🚀 Publish to Production"
        CMS->>FS: Merge /drafts/draft_123 changes into Canonical collections
        CMS->>FS: Create immutable Version Snapshots in /{collection}/{id}/versions/{v}
        CMS->>FS: Log Release Record in /releases/{releaseId}
        CMS->>Netlify: POST Production Build Hook (DRAFT_ID=null)
        Netlify->>FS: Fetch Canonical data only
        Netlify->>Prod: Deploy Live Site to cwts.edu
        CMS-->>Editor: Display "Published Successfully (vN)!"
    end

    Note over Editor,CMS: Phase 5: Revert / Rollback (If needed)
    Editor->>CMS: Open Version History -> Click "Revert to v2"
    CMS->>FS: Fetch snapshot from /{collection}/{id}/versions/2
    CMS->>Editor: Load v2 into Active Draft Workspace as proposed change
```

### 5.1 Firestore Data Model for Workspaces & Versions

#### A. Draft Workspace: `/drafts/{draftId}`
```json
{
  "draftId": "draft_yusheng_20260818",
  "title": "August Newsletter & Fall Faculty Update",
  "status": "active",
  "author": {
    "uid": "abc123xyz",
    "email": "yusheng.sjtu@gmail.com",
    "displayName": "Yusheng",
    "timestamp": "2026-08-18T19:20:00.000Z"
  },
  "stagedDeployUrl": "https://deploy-preview-42--cwts-staging.netlify.app",
  "createdAt": "2026-08-18T19:00:00.000Z",
  "updatedAt": "2026-08-18T19:25:00.000Z"
}
```

#### B. Accumulated Changes Subcollection: `/drafts/{draftId}/changes/{changeDocId}`
Each document records an individual entity change within this draft workspace:
```json
{
  "collection": "news",
  "documentId": "2026-04-24-newsletter",
  "action": "update",
  "data": {
    "title": "基神院訊 2026 夏季號 (Draft Revision)",
    "date": "2026-04-24T00:00:00.000Z",
    "thumbnail": "/images/news/newsletter-2026A.jpg",
    "url": "/zh/news-events/newsletter/"
  },
  "body": "基神院訊夏季號精彩內容...",
  "updatedBy": {
    "email": "yusheng.sjtu@gmail.com",
    "timestamp": "2026-08-18T19:25:00.000Z"
  }
}
```

#### C. Immutable Version Snapshots: `/{collection}/{id}/versions/{versionNumber}`
Every publish event stores an immutable, point-in-time snapshot of the published object:
```json
{
  "version": 2,
  "status": "published",
  "data": {
    "title": "基神院訊 2026 夏季號",
    "date": "2026-04-24T00:00:00.000Z",
    "thumbnail": "/images/news/newsletter-2026A.jpg",
    "url": "/zh/news-events/newsletter/"
  },
  "body": "基神院訊夏季號精彩內容...",
  "publishedBy": {
    "email": "admin@cwts.edu",
    "displayName": "Seminary Admin",
    "timestamp": "2026-08-18T19:30:00.000Z"
  },
  "releaseId": "rel_20260818_193000",
  "createdAt": "2026-08-18T19:30:00.000Z"
}
```

#### D. Immutable Production Release Log: `/releases/{releaseId}`
Records the global production deployment event:
```json
{
  "releaseId": "rel_20260818_193000",
  "draftId": "draft_yusheng_20260818",
  "publishedBy": {
    "email": "admin@cwts.edu",
    "timestamp": "2026-08-18T19:30:00.000Z"
  },
  "changesCount": 3,
  "changesSummary": [
    { "collection": "news", "id": "2026-04-24-newsletter", "action": "update", "newVersion": 2 },
    { "collection": "jobs", "id": "2026-08-01-cantonese", "action": "create", "newVersion": 1 }
  ]
}
```

---

### 5.2 How Reverting Works (Single-Item & Global Release)

1. **Granular Single-Item Revert**:
   - In the CMS, opening an item displays the **"📜 Version History"** button.
   - Shows all historical published versions (`v1`, `v2`, `v3`) with timestamps and authors.
   - Clicking **"Restore to Draft"** on `v1` pulls that version's snapshot into the active draft workspace as a proposed change.
   - The editor can preview the restored version on Staging and publish it when ready.

2. **Global Release Rollback**:
   - The CMS Dashboard provides a **Release History** timeline.
   - If a production release caused unexpected issues, clicking **"Rollback Release"** fetches the snapshots prior to that release, creates a rollback draft, and triggers a Staging Preview before pushing the rollback live to Production.

---

### 5.3 Build-Time Draft Overlay in `FirebaseContentClient`

During Netlify SSG builds, `FirebaseContentClient` checks for the environment variable `DRAFT_ID`:

1. **Production Build (`DRAFT_ID=""`)**:
   - Queries canonical Firestore collections (`/news`, `/jobs`, `/pages`, etc.).
2. **Staging / Preview Build (`DRAFT_ID="draft_xxx"`)**:
   - Fetches canonical collections into memory.
   - Fetches `/drafts/${DRAFT_ID}/changes/*`.
   - **Overlays** the draft changes onto the canonical records (merging updates, adding created docs, removing deleted docs).
   - Generates the staging static HTML reflecting the exact preview state.

```typescript
// src/libs/content/firebaseClient.ts (Draft Overlay Logic)
export class FirebaseContentClient implements IContentClient {
  private draftId?: string;

  constructor(options: { projectId: string; draftId?: string }) {
    this.draftId = options.draftId || process.env.DRAFT_ID;
  }

  async getCollection<K extends keyof ContentSchemaMap>(collection: K): Promise<ContentEntry<ContentSchemaMap[K]>[]> {
    // 1. Fetch canonical collection from Firestore
    const canonicalEntries = await this.fetchCanonicalCollection(collection);

    // 2. If no active draft preview, return canonical
    if (!this.draftId) {
      return canonicalEntries;
    }

    // 3. Fetch draft overlay changes from /drafts/{draftId}/changes
    const draftChanges = await this.fetchDraftChanges(this.draftId, collection);
    
    // 4. Apply overlay
    const mergedMap = new Map(canonicalEntries.map(e => [e.id, e]));
    for (const change of draftChanges) {
      if (change.action === 'delete') {
        mergedMap.delete(change.documentId);
      } else {
        mergedMap.set(change.documentId, {
          id: change.documentId,
          slug: change.documentId,
          language: change.data.language || 'zh',
          status: 'draft',
          data: change.data,
          body: change.body,
          updatedAt: new Date(change.updatedBy.timestamp)
        });
      }
    }

    return Array.from(mergedMap.values());
  }
}
```

---

### 5.4 Netlify Build Hooks Configuration

1. **Staging Deploy Preview Hook**:
   - URL: `https://api.netlify.com/build_hooks/staging-preview-hook`
   - Triggered by CMS:
     ```typescript
     await fetch('https://api.netlify.com/build_hooks/staging-preview-hook', {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({
         title: `Staging Preview for Draft: ${draftId}`,
         env: { DRAFT_ID: draftId, CONTENT_SOURCE: 'firebase' }
       })
     });
     ```
2. **Production Release Hook**:
   - URL: `https://api.netlify.com/build_hooks/production-release-hook`
   - Triggered by CMS on **"Publish to Production"** after merging changes in Firestore.

---

## 6. Client-Side Asset Processing (100% Spark Free Plan)

### 6.1 In-Browser Image Processor (`src/admin/services/imageProcessor.ts`)
When an editor drops an image in the CMS, all size variants (`.cover.webp`, `.thumbnail.webp`, `.news.webp`, `.carousel.webp`) are generated in the browser using HTML5 Canvas & WebP compression prior to upload:

```typescript
export async function resizeImageInBrowser(
  file: File,
  targetWidth: number,
  targetHeight: number,
  quality = 0.85
): Promise<Blob> {
  const img = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext("2d")!;
  
  // High-quality bicubic downscaling
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
  
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob!), "image/webp", quality);
  });
}
```

---

## 7. Cross-Build Asset Caching (Local & Netlify CI/CD)

```mermaid
sequenceDiagram
    autonumber
    participant Build as Astro Build (Local / Netlify)
    participant Cache as Persistent Disk Cache (.cache/cwts-assets/)
    participant Storage as Firebase Cloud Storage

    Build->>Cache: Read manifest.json
    Build->>Storage: HEAD /media/covers/spring-2026.cover.webp
    Storage-->>Build: Returns ETag / x-goog-hash (MD5) & Size

    alt ETag matches manifest entry & local file exists
        Build->>Cache: Copy from .cache/cwts-assets/ to public/images/
        Note over Build: 0 bytes downloaded from Firebase! (Fast & Free)
    else ETag is new or mismatched
        Build->>Storage: GET /media/covers/spring-2026.cover.webp
        Storage-->>Build: Stream binary data
        Build->>Cache: Save to .cache/cwts-assets/ & update manifest.json
        Build->>Build: Copy to public/images/
    end
```

---

## 8. MDX Replacement & Rich Content Strategy

| Existing MDX Component | Current Usage in `.mdx` | Headless CMS Replacement Pattern |
| :--- | :--- | :--- |
| **`AccordionItem.astro`** | `<AccordionItem name="m" open><h1 slot="summary">...</h1>...</AccordionItem>` | **TipTap Accordion Node**: Renders native HTML5 `<details class="accordion-item"><summary>...</summary><div>...</div></details>`. Zero JS needed. |
| **`Pdf.astro`** | `<Pdf url="..." title="..." />` | **TipTap PDF Card Node**: Outputs `<figure class="pdf-embed"><figcaption><a href="...">Title</a></figcaption><object data="..." ...></object></figure>`. |
| **`Youtube.astro`** & **`Vimeo.astro`** | `<Youtube id="..." />`, `<Vimeo id="..." />` | **TipTap Video Extension**: Outputs responsive video embed markup. |
| **`Figure.astro`** | `<Figure imageUrl="..." title="..." />` | **TipTap Figure Node**: Native HTML5 `<figure><img src="..." alt="..." /><figcaption>...</figcaption></figure>`. |
| **`NewsletterList.astro`** | `<NewsletterList />` in `newsletter.mdx` | **Dedicated Astro Route Template**: The page template `src/pages/[language]/news-events/newsletter.astro` renders the CMS copy and appends `<NewsletterList />`. |
| **`CsvTable.astro`** | `<CsvTable csv={csvData(...)} />` in `assembly.mdx` | **Dedicated Astro Route Template**: The page template `src/pages/[language]/student-life/assembly.astro` renders the CMS copy and dynamically renders `/assembly` database collection items. |
| **`ObfuscatedEmail`** | `<ObfuscatedEmail email="..." />` in `administration.mdx` | **Global Build-Time Rehype Plugin**: Editors write standard emails/links in the CMS; an Astro Rehype plugin automatically obfuscates all `mailto:` links site-wide at build time. |

---

## 9. Firebase Free Tier (Spark Plan) Quota Verification

| Resource | Spark Free Quota | CWTS Usage (Est.) | Status |
| :--- | :--- | :--- | :--- |
| **Firestore Storage** | 1 GB | ~25 MB (500 docs + version history) | **2.5% used** |
| **Firestore Daily Reads** | 50,000 / day | ~500–2,000 / day | **1.0%–4.0% used** |
| **Firestore Daily Writes** | 20,000 / day | ~50 / day | **0.25% used** |
| **Storage Capacity** | 5 GB | ~2.0 GB | **40.0% used** |
| **Storage Daily Egress** | 1 GB / day (10 GB/mo on Blaze) | **~0 MB** (Cached on Netlify & Local builds) | **< 1.0% used** |
| **Auth MAU** | 50,000 / month | 10 accounts | **0.02% used** |
| **Cloud Functions** | *Requires Blaze* | **0 Functions used** | **100% Spark Compliant** |

---

## 10. Step-by-Step Implementation Roadmap

```mermaid
gantt
    title CWTS Headless CMS Implementation Roadmap
    dateFormat  YYYY-MM-DD
    section Phase 1: Shared Layer & Cache
    Create src/libs/content/ Schemas & Types       :done, p1_1, 2026-08-01, 3d
    Direct Content Interface Refactoring           :done, p1_2, after p1_1, 3d
    Asset Caching & Netlify Plugin Implementation  :p1_3, after p1_2, 3d
    section Phase 2: Pilot Migration & Seeding
    Seeding Tool for news & jobs (seed-firestore)  :done, p2_1, 2026-08-18, 1d
    Draft Workspaces & Netlify Preview Logic       :active, p2_2, 2026-08-19, 3d
    section Phase 3: Admin Webapp (cwts.edu/admin)
    Mount /admin SPA & Whitelist Auth Gate         :done, p3_1, 2026-08-18, 1d
    Draft Accumulator & Staging Preview UI         :active, p3_2, after p3_1, 3d
    Version History Drawer & Rollback Controls     :active, p3_3, after p3_2, 2d
    React + TipTap WYSIWYG & Schema Forms          :p3_4, after p3_3, 4d
    In-Browser Image & PDF.js Processors           :p3_5, after p3_4, 3d
    section Phase 4: Full Production Rollout
    Canary Pilot (news & jobs on staging preview)  :p4_1, after p3_5, 3d
    Production Release to cwts.edu                 :p4_2, after p4_1, 2d
```
