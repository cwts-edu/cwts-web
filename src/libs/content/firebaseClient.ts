import type {
  IContentClient,
  ContentEntry,
  DegreesWidgetDataItem,
  StudyModeWidgetDataItem,
  VersionRecord,
} from "./types";
import {
  type ContentSchemaMap,
  SchemaValidators,
  type Language,
  type FacultyCategory,
  type FacultyMetadata,
  type MenuItem,
} from "./schemas";
import site from "../site";
import { slug as slugify } from "github-slugger";
import { createComponent, unescapeHTML } from "astro/runtime/server/index.js";
import { createMarkdownProcessor } from "@astrojs/markdown-remark";

let markdownProcessorPromise: Promise<any> | null = null;
function getMarkdownProcessor() {
  if (!markdownProcessorPromise) {
    markdownProcessorPromise = createMarkdownProcessor();
  }
  return markdownProcessorPromise;
}

export function resolveActiveDraftId(): string | undefined {
  // 1. Explicit environment variable (Local dev, CI override)
  if (typeof process !== "undefined" && process.env?.DRAFT_ID) {
    return process.env.DRAFT_ID.trim();
  }

  // 2. Parsed from Netlify Build Hook payload (INCOMING_HOOK_BODY)
  if (typeof process !== "undefined" && process.env?.INCOMING_HOOK_BODY) {
    try {
      const payload = JSON.parse(process.env.INCOMING_HOOK_BODY);
      if (payload.draftId) {
        console.log(`🎯 [Netlify Build] Staging Preview active for draft: ${payload.draftId}`);
        return String(payload.draftId).trim();
      }
    } catch (e) {
      console.warn("⚠️ Could not parse Netlify INCOMING_HOOK_BODY payload:", e);
    }
  }

  // 3. Deploy previews and experimental/staging branches (e.g. cms-exp, staging, preview, dev)
  if (typeof process !== "undefined") {
    const context = process.env.CONTEXT;
    const branch = process.env.BRANCH;
    const isDeployPreview = context === "deploy-preview" || context === "branch-deploy";
    const isStagingBranch =
      branch === "cms-exp" ||
      branch === "staging" ||
      branch === "preview" ||
      branch === "dev";

    if (isDeployPreview || isStagingBranch || process.env.STAGING === "true" || process.env.CONTENT_SOURCE === "draft") {
      console.log(`🎯 [Draft Build] Active draft overlay enabled ('main') for context='${context}', branch='${branch}'`);
      return "main";
    }
  }

  return undefined;
}

export class FirebaseContentClient implements IContentClient {
  private projectId: string;
  private baseUrl: string;
  private draftId?: string;

  constructor(options: { projectId: string; draftId?: string }) {
    this.projectId = options.projectId;
    this.baseUrl = `https://firestore.googleapis.com/v1/projects/${this.projectId}/databases/(default)/documents`;
    this.draftId = options.draftId || resolveActiveDraftId();
  }

  /**
   * Fetches canonical documents and applies draft changes overlay if draftId is active.
   */
  async getCollection<K extends keyof ContentSchemaMap>(
    collection: K,
    filter?: (entry: ContentEntry<ContentSchemaMap[K]>) => boolean
  ): Promise<ContentEntry<ContentSchemaMap[K]>[]> {
    // 1. Fetch canonical published documents
    const canonicalEntries = await this.fetchCanonicalCollection(collection);

    // 2. If no staging draft is active, return canonical directly
    if (!this.draftId) {
      return filter ? canonicalEntries.filter(filter) : canonicalEntries;
    }

    // 3. Fetch draft overlay changes from /drafts/{draftId}/changes
    const draftChanges = await this.fetchDraftChanges(this.draftId, String(collection));
    if (draftChanges.length > 0) {
      console.log(
        `✨ [Draft Build] Applied ${draftChanges.length} draft change(s) for collection '${collection}' from draft '${this.draftId}'`
      );
    }

    // 4. Merge overlay changes
    const map = new Map<string, ContentEntry<ContentSchemaMap[K]>>(
      canonicalEntries.map((e) => [e.id, e])
    );

    const validator = SchemaValidators[collection];

    for (const change of draftChanges) {
      if (change.action === "delete") {
        map.delete(change.documentId);
      } else {
        const parsedData = validator.parse(change.data);
        map.set(change.documentId, {
          id: change.documentId,
          slug: change.documentId,
          language: (change.data.language as Language) || "zh",
          status: "draft",
          data: parsedData,
          body: change.body || "",
          html: change.bodyHtml || change.body || "",
          updatedAt: new Date(change.updatedAt || Date.now()),
        });
      }
    }

    const merged = Array.from(map.values());
    return filter ? merged.filter(filter) : merged;
  }

  /**
   * Fetches single entry with draft overlay support.
   */
  async getEntry<K extends keyof ContentSchemaMap>(
    collection: K,
    id: string
  ): Promise<ContentEntry<ContentSchemaMap[K]> | null> {
    // 1. If draft active, check draft changes first
    if (this.draftId) {
      const draftChange = await this.fetchDraftChangeDoc(this.draftId, String(collection), id);
      if (draftChange) {
        if (draftChange.action === "delete") return null;
        console.log(`✨ [Draft Build] Applied draft entry overlay for '${String(collection)}/${id}'`);
        const parsedData = SchemaValidators[collection].parse(draftChange.data);
        return {
          id: draftChange.documentId || id,
          slug: draftChange.documentId || id,
          language: (draftChange.data.language as Language) || "zh",
          status: "draft",
          data: parsedData,
          body: draftChange.body || "",
          html: draftChange.bodyHtml || draftChange.body || "",
          updatedAt: new Date(draftChange.updatedAt || Date.now()),
        };
      }
    }

    // 2. Fall back to canonical collection
    const url = `${this.baseUrl}/${collection}/${id}`;
    const response = await fetch(url);
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`Failed to fetch entry ${String(collection)}/${id}`);

    const doc = await response.json();
    const fields = this.decodeFirestoreFields(doc.fields);
    if (fields.status === "deleted") return null;
    const parsedData = SchemaValidators[collection].parse(fields);

    return {
      id,
      slug: fields.slug || id,
      language: (fields.language as Language) || "zh",
      status: fields.status || "published",
      version: fields.version || 1,
      publishedVersion: fields.publishedVersion || 1,
      data: parsedData,
      body: fields.body || "",
      html: fields.bodyHtml || fields.html || fields.body || "",
      updatedAt: new Date(doc.updateTime),
    };
  }

  /**
   * Fetches historical version snapshot from /{collection}/{id}/versions/{versionNumber}
   */
  async getVersion<K extends keyof ContentSchemaMap>(
    collection: K,
    id: string,
    versionNumber: number
  ): Promise<VersionRecord<ContentSchemaMap[K]> | null> {
    const url = `${this.baseUrl}/${collection}/${id}/versions/${versionNumber}`;
    const response = await fetch(url);
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`Failed to fetch version ${versionNumber} of ${String(collection)}/${id}`);

    const doc = await response.json();
    const fields = this.decodeFirestoreFields(doc.fields);
    const parsedData = SchemaValidators[collection].parse(fields.data);

    return {
      version: fields.version,
      status: fields.status,
      data: parsedData,
      body: fields.body,
      html: fields.bodyHtml,
      author: fields.author,
      createdAt: fields.createdAt,
      publishedAt: fields.publishedAt,
    };
  }

  async render<T = any>(
    entry: ContentEntry<T>
  ): Promise<{ Content: any; headings?: any[] }> {
    if (entry.Content) {
      return { Content: entry.Content };
    }

    let html = entry.html;
    let headings: any[] = [];
    if (!html && entry.body) {
      const processor = await getMarkdownProcessor();
      const result = await processor.render(entry.body);
      html = result.code;
      headings = result.metadata?.headings || [];
    } else if (!html) {
      html = "";
    }

    const Content = createComponent({
      factory(_result: any, _props: any, _slots: any) {
        return unescapeHTML(html);
      },
    });

    return {
      Content,
      headings,
    };
  }

  pages = {
    getBySlug: async (slug: string, language: Language) => {
      const id = `${language}_${slug.replace(/\//g, "_")}`;
      return this.getEntry("pages", id);
    },
    getById: async (id: string) => {
      return this.getEntry("pages", id);
    },
    list: async (language?: Language) => {
      const items = await this.getCollection("pages");
      return language ? items.filter((p) => p.language === language) : items;
    },
    listChildren: async (slug: string) => {
      const items = await this.getCollection("pages");
      const children = items
        .filter((p) => p.id.startsWith(slug) && p.id !== slug)
        .sort((a, b) => (a.data.order || 0) - (b.data.order || 0));

      return children.map((page) => ({
        url: "/" + page.id,
        thumbnail: page.data.thumbnail || site.defaultThumbnail,
        title: page.data.title,
      }));
    },
  };

  news = {
    list: async (language?: Language, limit?: number) => {
      const items = await this.getCollection("news");
      let filtered = language ? items.filter((i) => i.language === language) : items;
      filtered.sort((a, b) => {
        const diff = b.data.date.getTime() - a.data.date.getTime();
        if (diff !== 0) return diff;
        return b.id.localeCompare(a.id);
      });
      return limit ? filtered.slice(0, limit) : filtered;
    },
    getById: (id: string) => this.getEntry("news", id),
  };

  jobs = {
    list: async (language?: Language) => {
      const items = await this.getCollection("jobs");
      const filtered = language ? items.filter((i) => i.language === language) : items;
      return filtered.sort((a, b) => {
        const diff = b.data.date.getTime() - a.data.date.getTime();
        if (diff !== 0) return diff;
        return b.id.localeCompare(a.id);
      });
    },
    getById: (id: string) => this.getEntry("jobs", id),
  };

  faculty = {
    list: async (language?: Language) => {
      const items = await this.getCollection("faculty");
      return language ? items.filter((i) => i.language === language) : items;
    },
    listByCategory: async (category: FacultyCategory, language: Language) => {
      const items = await this.getCollection("faculty");
      return items
        .filter((i) => i.language === language && i.data.category === category)
        .sort((a, b) => (a.data.order || 0) - (b.data.order || 0));
    },
    getBySlug: async (slug: string, language: Language) => {
      return this.getEntry("faculty", `${language}_${slug}`);
    },
    getAdjunctList: async (language: Language) => {
      const entry = await this.getEntry("adjunct-prof", `${language}_adjunct`);
      return entry ? entry.data : [];
    },
    getMetadata: async (language: Language, categories?: FacultyCategory[]) => {
      const facultyList = await this.faculty.list(language);
      const adjunctData = await this.faculty.getAdjunctList(language);

      const filterByCat = (cat: FacultyCategory) =>
        facultyList
          .filter((p) => p.data.category === cat)
          .map((p) => ({
            ...p.data,
            slug: p.slug,
            url: `/${language}/academic/faculty/${p.slug}`,
          }))
          .sort((a, b) => (a.order || 0) - (b.order || 0));

      const adjunctUrl = `/${language}/academic/faculty/adjunct-professors`;
      const adjunctList = adjunctData.map((person) => ({
        ...person,
        url: `${adjunctUrl}#${slugify(person.name)}`,
      }));

      const dict: Record<FacultyCategory, Array<FacultyMetadata & { slug?: string; url?: string }>> = {
        faculty: filterByCat("faculty"),
        "senior-adjunct": filterByCat("senior-adjunct"),
        adjunct: adjunctList,
      };

      const requestedCategories = categories || ["faculty", "senior-adjunct", "adjunct"];
      return requestedCategories.flatMap((cat) => dict[cat]);
    },
  };

  degreesPrograms = {
    list: async (language?: Language) => {
      const items = await this.getCollection("degrees-programs");
      const filtered = language ? items.filter((d) => d.language === language) : items;
      return filtered.sort((a, b) => a.data.order - b.data.order);
    },
    getBySlug: async (slug: string, language: Language) => {
      return this.getEntry("degrees-programs", `${language}_${slug}`);
    },
  };

  degreesWidget = {
    getData: async (language: Language): Promise<DegreesWidgetDataItem[]> => {
      const items = await this.getCollection("degrees-widget");
      const filtered = items
        .filter((d) => d.language === language)
        .sort((a, b) => a.data.order - b.data.order);

      return filtered.map((item) => ({
        slug: item.slug,
        page: item,
        Content: null,
      }));
    },
  };

  studyModeWidget = {
    getData: async (language: Language): Promise<StudyModeWidgetDataItem[]> => {
      const items = await this.getCollection("study-mode-widget");
      const filtered = items
        .filter((d) => d.language === language)
        .sort((a, b) => a.data.order - b.data.order);

      return filtered.map((item) => ({
        slug: item.slug,
        page: item,
        Content: null,
      }));
    },
  };

  carousel = {
    get: async () => {
      const entry = await this.getEntry("carousel", "carousel");
      return entry ? entry.data : [];
    },
  };

  shortcuts = {
    get: async (language: Language) => {
      const entry = await this.getEntry("shortcuts", "shortcuts");
      return entry ? entry.data[language] : [];
    },
  };

  translation = {
    get: async (key: string, language: Language) => {
      const entry = await this.getEntry("translation", "translation");
      if (!entry || !entry.data[key]) throw new Error(`Missing translation key: ${key}`);
      return entry.data[key][language];
    },
    getAll: async () => {
      const entry = await this.getEntry("translation", "translation");
      return entry ? entry.data : {};
    },
  };

  menu = {
    get: async (language: Language): Promise<MenuItem[]> => {
      const entry = await this.getEntry("menu", language);
      return entry ? entry.data : [];
    },
  };

  private async fetchCanonicalCollection<K extends keyof ContentSchemaMap>(
    collection: K
  ): Promise<ContentEntry<ContentSchemaMap[K]>[]> {
    const url = `${this.baseUrl}/${collection}`;
    const response = await fetch(url);
    if (!response.ok) {
      if (response.status === 404) return [];
      throw new Error(`Failed to fetch collection ${String(collection)}: ${response.statusText}`);
    }

    const { documents } = await response.json();
    if (!documents) return [];

    const validator = SchemaValidators[collection];
    const entries: ContentEntry<ContentSchemaMap[K]>[] = [];

    for (const doc of documents) {
      const id = doc.name.split("/").pop()!;
      const fields = this.decodeFirestoreFields(doc.fields);
      if (fields.status === "deleted") continue;
      const parsedData = validator.parse(fields);

      entries.push({
        id,
        slug: fields.slug || id,
        language: (fields.language as Language) || "zh",
        status: fields.status || "published",
        version: fields.version || 1,
        publishedVersion: fields.publishedVersion || 1,
        data: parsedData,
        body: fields.body || "",
        html: fields.bodyHtml || fields.html || fields.body || "",
        updatedAt: new Date(doc.updateTime),
      });
    }

    return entries;
  }

  private async fetchDraftChanges(draftId: string, targetCollection: string): Promise<any[]> {
    try {
      const allChanges: any[] = [];
      const draftIdsToQuery = new Set<string>();

      if (draftId && draftId !== "all" && draftId !== "auto") {
        draftIdsToQuery.add(draftId);
      }

      // Query all draft documents from Firestore to discover active drafts
      const draftsUrl = `${this.baseUrl}/drafts`;
      const draftsRes = await fetch(draftsUrl).catch(() => null);
      if (draftsRes && draftsRes.ok) {
        const data = await draftsRes.json();
        if (data.documents && Array.isArray(data.documents)) {
          for (const doc of data.documents) {
            const id = doc.name.split("/").pop();
            if (id) draftIdsToQuery.add(id);
          }
        }
      }

      for (const dId of draftIdsToQuery) {
        const url = `${this.baseUrl}/drafts/${dId}/changes`;
        const response = await fetch(url).catch(() => null);
        if (response && response.ok) {
          const { documents } = await response.json();
          if (documents && Array.isArray(documents)) {
            for (const doc of documents) {
              const decoded = this.decodeFirestoreFields(doc.fields);
              if (decoded.collection === targetCollection) {
                allChanges.push(decoded);
              }
            }
          }
        }
      }

      return allChanges;
    } catch {
      return [];
    }
  }

  private async fetchDraftChangeDoc(draftId: string, targetCollection: string, docId: string): Promise<any | null> {
    try {
      const draftIdsToQuery = new Set<string>();
      if (draftId && draftId !== "all" && draftId !== "auto") {
        draftIdsToQuery.add(draftId);
      }

      const draftsUrl = `${this.baseUrl}/drafts`;
      const draftsRes = await fetch(draftsUrl).catch(() => null);
      if (draftsRes && draftsRes.ok) {
        const data = await draftsRes.json();
        if (data.documents && Array.isArray(data.documents)) {
          for (const doc of data.documents) {
            const id = doc.name.split("/").pop();
            if (id) draftIdsToQuery.add(id);
          }
        }
      }

      for (const dId of draftIdsToQuery) {
        // 1. Try formatted doc name: e.g. news_2026-04-24-newsletter
        const prefixedUrl = `${this.baseUrl}/drafts/${dId}/changes/${targetCollection}_${docId}`;
        let response = await fetch(prefixedUrl).catch(() => null);

        // 2. Fallback to raw docId
        if (!response || !response.ok) {
          const rawUrl = `${this.baseUrl}/drafts/${dId}/changes/${docId}`;
          response = await fetch(rawUrl).catch(() => null);
        }

        if (response && response.ok) {
          const doc = await response.json();
          const fields = this.decodeFirestoreFields(doc.fields);
          if (fields.collection === targetCollection) return fields;
        }
      }

      return null;
    } catch {
      return null;
    }
  }

  private decodeFirestoreFields(fields: Record<string, any>): Record<string, any> {
    const result: Record<string, any> = {};
    for (const [key, value] of Object.entries(fields || {})) {
      if ("stringValue" in value) result[key] = value.stringValue;
      else if ("integerValue" in value) result[key] = parseInt(value.integerValue, 10);
      else if ("doubleValue" in value) result[key] = parseFloat(value.doubleValue);
      else if ("booleanValue" in value) result[key] = value.booleanValue;
      else if ("timestampValue" in value) result[key] = new Date(value.timestampValue);
      else if ("arrayValue" in value) {
        result[key] = (value.arrayValue.values || []).map((v: any) => Object.values(v)[0]);
      } else if ("mapValue" in value) {
        result[key] = this.decodeFirestoreFields(value.mapValue.fields);
      }
    }
    return result;
  }
}
