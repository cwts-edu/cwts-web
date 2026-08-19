import type {
  IContentClient,
  ContentEntry,
  DegreesWidgetDataItem,
  StudyModeWidgetDataItem,
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

export class FirebaseContentClient implements IContentClient {
  private projectId: string;
  private baseUrl: string;

  constructor(options: { projectId: string }) {
    this.projectId = options.projectId;
    this.baseUrl = `https://firestore.googleapis.com/v1/projects/${this.projectId}/databases/(default)/documents`;
  }

  async getCollection<K extends keyof ContentSchemaMap>(
    collection: K,
    filter?: (entry: ContentEntry<ContentSchemaMap[K]>) => boolean
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
      const parsedData = validator.parse(fields);

      const entry: ContentEntry<ContentSchemaMap[K]> = {
        id,
        slug: fields.slug || id,
        language: (fields.language as Language) || "zh",
        status: fields.status || "published",
        data: parsedData,
        body: fields.body || "",
        html: fields.bodyHtml || fields.html || fields.body || "",
        updatedAt: new Date(doc.updateTime),
      };

      if (!filter || filter(entry)) {
        entries.push(entry);
      }
    }

    return entries;
  }

  async getEntry<K extends keyof ContentSchemaMap>(
    collection: K,
    id: string
  ): Promise<ContentEntry<ContentSchemaMap[K]> | null> {
    const url = `${this.baseUrl}/${collection}/${id}`;
    const response = await fetch(url);
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`Failed to fetch entry ${String(collection)}/${id}`);

    const doc = await response.json();
    const fields = this.decodeFirestoreFields(doc.fields);
    const parsedData = SchemaValidators[collection].parse(fields);

    return {
      id,
      slug: fields.slug || id,
      language: (fields.language as Language) || "zh",
      status: fields.status || "published",
      data: parsedData,
      body: fields.body || "",
      html: fields.bodyHtml || fields.html || fields.body || "",
      updatedAt: new Date(doc.updateTime),
    };
  }

  async render<T = any>(
    entry: ContentEntry<T>
  ): Promise<{ Content: any; headings?: any[] }> {
    if (entry.Content) {
      return { Content: entry.Content };
    }
    const html = entry.html || entry.body || "";
    return {
      Content: () => html,
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
      filtered.sort((a, b) => b.data.date.getTime() - a.data.date.getTime());
      return limit ? filtered.slice(0, limit) : filtered;
    },
    getById: (id: string) => this.getEntry("news", id),
  };

  jobs = {
    list: async (language?: Language) => {
      const items = await this.getCollection("jobs");
      const filtered = language ? items.filter((i) => i.language === language) : items;
      return filtered.sort((a, b) => b.data.date.getTime() - a.data.date.getTime());
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
