import { getCollection, getEntry, render } from "astro:content";
import type {
  IContentClient,
  ContentEntry,
  DegreesWidgetDataItem,
  StudyModeWidgetDataItem,
} from "./types";
import type {
  ContentSchemaMap,
  Language,
  FacultyCategory,
  FacultyMetadata,
  MenuItem,
  AssemblyTableMetadata,
  NewsletterMetadata,
} from "./schemas";
import { getLanguageBySlug } from "../language";
import site from "../site";
import { slug as slugify } from "github-slugger";
import {
  parseAssemblyCsv,
  renderAssemblyTableHtml,
  getDefaultSemesterTitle,
  calculateSemesterOrder,
  sortAssemblyTables,
} from "./assemblyUtils";
import {
  parseNewsletterFilename,
  formatNewsletterTitle,
  formatNewsletterPdfPath,
  formatNewsletterCoverPath,
  sortNewsletters,
} from "./newsletterUtils";
import { resolveMenuItems, extractMenuItems } from "./menuUtils";

const allAssemblyCsv = import.meta.glob<string>("/src/content/csv/assembly/*.csv", { query: "?raw", import: "default" });
const allNewsletterPdfs = import.meta.glob("/public/docs/newsletter/*.pdf");


import { ContentDataStore } from "./store";

export class AstroContentClient implements IContentClient {
  private stores = new Map<string, Promise<ContentDataStore<any>>>();
  private degreesWidgetCache = new Map<Language, Promise<DegreesWidgetDataItem[]>>();
  private studyModeWidgetCache = new Map<Language, Promise<StudyModeWidgetDataItem[]>>();

  async getStore<K extends keyof ContentSchemaMap>(
    collection: K
  ): Promise<ContentDataStore<ContentSchemaMap[K]>> {
    const key = String(collection);
    if (!this.stores.has(key)) {
      this.stores.set(key, this.loadStore(collection));
    }
    return this.stores.get(key)!;
  }

  private async loadStore<K extends keyof ContentSchemaMap>(
    collection: K
  ): Promise<ContentDataStore<ContentSchemaMap[K]>> {
    const store = new ContentDataStore<ContentSchemaMap[K]>();

    if (collection === "assembly") {
      const keys = Object.keys(allAssemblyCsv);
      for (const key of keys) {
        const rawLoader = allAssemblyCsv[key];
        if (!rawLoader) continue;
        const rawContent = await rawLoader();
        const filename = key.split("/").pop()?.replace(/\.csv$/, "") || "";
        if (!filename) continue;

        const isUpcoming = filename.toLowerCase() === "upcoming";
        const { columns, rows } = parseAssemblyCsv(rawContent);
        const title = getDefaultSemesterTitle(filename, isUpcoming);
        const order = calculateSemesterOrder(filename);
        const bodyHtml = renderAssemblyTableHtml(columns, rows);

        const data: AssemblyTableMetadata = {
          title,
          semester: filename,
          order,
          isUpcoming,
          columns,
          rows,
          bodyHtml,
        };

        store.set({
          id: filename,
          slug: filename,
          language: "zh",
          status: "published",
          data,
          body: rawContent,
          html: bodyHtml,
          updatedAt: new Date(),
        } as any);
      }
      return store;
    }

    if (collection === "newsletter") {
      for (const [filePath] of Object.entries(allNewsletterPdfs)) {
        const parts = filePath.split("/");
        const fullFilename = parts[parts.length - 1] || "";
        const parsed = parseNewsletterFilename(fullFilename);
        if (!parsed) continue;

        const data: NewsletterMetadata = {
          title: parsed.title,
          year: parsed.year,
          issue: parsed.issue,
          issueLetter: parsed.issueLetter,
          pdfPath: parsed.pdfPath,
          coverImage: parsed.coverImage,
          referencedAssets: [
            parsed.pdfPath.replace(/^\/+/, ""),
            parsed.coverImage.replace(/^\/+/, ""),
          ],
        };

        store.set({
          id: parsed.id,
          slug: parsed.id,
          language: "zh",
          status: "published",
          data,
          updatedAt: new Date(),
        } as any);
      }
      return store;
    }

    if (collection === "menu") {
      const langs: Language[] = ["zh", "en"];
      for (const lang of langs) {
        try {
          const rawEntry = await getEntry("menu", lang);
          if (rawEntry) {
            const items = extractMenuItems(rawEntry.data);
            const resolved = await resolveMenuItems(items, this, lang);
            store.set({
              id: lang,
              slug: lang,
              language: lang,
              status: "published",
              data: resolved as any,
              rawEntry,
              updatedAt: new Date(),
            });
          }
        } catch {
          // Ignored
        }
      }
      return store;
    }

    const rawEntries = await getCollection(collection as any);
    for (const raw of rawEntries) {
      let language: Language = "zh";
      let slug = raw.id;
      const aliases: string[] = [];

      if (collection === "pages") {
        language = raw.id.startsWith("en/") ? "en" : "zh";
        const rawSlug = raw.id.startsWith("zh/") || raw.id.startsWith("en/") ? raw.id.slice(3) : raw.id;
        if (rawSlug === "index") {
          slug = "";
        } else if (rawSlug.endsWith("/index")) {
          slug = rawSlug.slice(0, -6);
        } else {
          slug = rawSlug;
        }
        aliases.push(raw.id);
        aliases.push(`${language}/${slug}`);
        aliases.push(`${language}_${slug.split("/").join("_")}`);
      } else if (collection === "faculty") {
        language = raw.id.startsWith("en/") ? "en" : "zh";
        slug = raw.id.startsWith("zh/") || raw.id.startsWith("en/") ? raw.id.slice(3) : raw.id;
        aliases.push(slug);
      } else if (collection === "degrees-programs") {
        language = "zh";
        slug = raw.id.startsWith("zh/") ? raw.id.slice(3) : raw.id;
        aliases.push(slug);
      } else if (collection === "degrees-widget") {
        language = raw.id.startsWith("en/") ? "en" : "zh";
        slug = raw.id.startsWith("zh/") || raw.id.startsWith("en/") ? raw.id.slice(3) : raw.id;
      } else if (collection === "study-mode-widget") {
        language = "zh";
        slug = raw.id.startsWith("zh/") ? raw.id.slice(3) : raw.id;
      } else if (collection === "news" || collection === "jobs") {
        language = "zh";
        slug = raw.id;
      }

      store.set({
        id: raw.id,
        slug,
        language,
        status: "published" as const,
        data: raw.data,
        rawEntry: raw,
        body: raw.body,
        updatedAt: new Date(),
      } as any, aliases);
    }

    return store;
  }

  async getEntry<K extends keyof ContentSchemaMap>(
    collection: K,
    id: string
  ): Promise<ContentEntry<ContentSchemaMap[K]> | null> {
    const store = await this.getStore(collection);
    return store.get(id);
  }

  async getCollection<K extends keyof ContentSchemaMap>(
    collection: K,
    filter?: (entry: ContentEntry<ContentSchemaMap[K]>) => boolean
  ): Promise<ContentEntry<ContentSchemaMap[K]>[]> {
    const store = await this.getStore(collection);
    return filter ? store.filter(filter) : store.values();
  }

  async render<T = any>(
    entry: ContentEntry<T>
  ): Promise<{ Content: any; headings?: any[] }> {
    if (entry.rawEntry) {
      return render(entry.rawEntry);
    }
    if (entry.Content) {
      return { Content: entry.Content };
    }
    return {
      Content: () => entry.html || entry.body || "",
    };
  }

  pages = {
    getBySlug: async (slug: string, language: Language) => {
      const store = await this.getStore("pages");
      return store.getBySlug(slug, language);
    },
    getById: async (id: string) => {
      const store = await this.getStore("pages");
      return store.get(id);
    },
    list: async (language?: Language) => {
      const store = await this.getStore("pages");
      return language ? store.filter((p) => p.language === language) : store.values();
    },
    listChildren: async (parentPath: string) => {
      const store = await this.getStore("pages");
      const isEn = parentPath.startsWith("en/");
      const isZh = parentPath.startsWith("zh/");
      const lang: Language = isEn ? "en" : "zh";
      let parentSlug = isEn || isZh ? parentPath.slice(3) : parentPath;
      if (parentSlug === "index") {
        parentSlug = "";
      } else if (parentSlug.endsWith("/index")) {
        parentSlug = parentSlug.slice(0, -6);
      }
      const prefix = parentSlug ? `${parentSlug}/` : "";

      const children = store
        .filter((page) => {
          if (page.language !== lang) return false;
          if (!page.slug.startsWith(prefix) || page.slug === parentSlug) return false;
          const sub = page.slug.slice(prefix.length);
          return sub.length > 0 && !sub.includes("/");
        })
        .sort((a, b) => (a.data.order || 0) - (b.data.order || 0));

      return children.map((page) => ({
        url: `/${page.language}/${page.slug}`,
        thumbnail: page.data.thumbnail || site.defaultThumbnail,
        title: page.data.title,
      }));
    },
  };

  news = {
    list: async (language?: Language, limit?: number) => {
      const store = await this.getStore("news");
      let filtered = language ? store.filter((n) => n.language === language) : [...store.values()];
      filtered.sort((a, b) => {
        const diff = b.data.date.getTime() - a.data.date.getTime();
        if (diff !== 0) return diff;
        return b.id.localeCompare(a.id);
      });
      return limit ? filtered.slice(0, limit) : filtered;
    },
    getById: async (id: string) => {
      const store = await this.getStore("news");
      return store.get(id);
    },
  };

  faculty = {
    list: async (language?: Language) => {
      const store = await this.getStore("faculty");
      return language ? store.filter((f) => f.language === language) : store.values();
    },
    listByCategory: async (category: FacultyCategory, language: Language) => {
      const store = await this.getStore("faculty");
      return store
        .filter((f) => f.language === language && f.data.category === category)
        .sort((a, b) => (a.data.order || 0) - (b.data.order || 0));
    },
    getBySlug: async (slug: string, language: Language) => {
      const store = await this.getStore("faculty");
      return store.getBySlug(slug, language);
    },
    getAdjunctList: async (language: Language) => {
      const store = await this.getStore("adjunct-prof");
      const entry = store.get(`${language}/adjunct-prof`) || store.getBySlug("adjunct-prof", language);
      return entry ? (entry.data as FacultyMetadata[]) : [];
    },
    getMetadata: async (language: Language, categories?: FacultyCategory[]) => {
      const facultyStore = await this.getStore("faculty");
      const adjunctData = await this.faculty.getAdjunctList(language);

      const filterByCat = (cat: FacultyCategory) =>
        facultyStore
          .filter((p) => p.language === language && p.data.category === cat)
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
      const store = await this.getStore("degrees-programs");
      const filtered = language ? store.filter((d) => d.language === language) : [...store.values()];
      return filtered.sort((a, b) => a.data.order - b.data.order);
    },
    getBySlug: async (slug: string, language: Language) => {
      const store = await this.getStore("degrees-programs");
      return store.getBySlug(slug, language);
    },
  };

  degreesWidget = {
    getData: async (language: Language): Promise<DegreesWidgetDataItem[]> => {
      if (!this.degreesWidgetCache.has(language)) {
        this.degreesWidgetCache.set(
          language,
          (async () => {
            const store = await this.getStore("degrees-widget");
            const contents = store
              .filter((e) => e.language === language)
              .sort((a, b) => a.data.order - b.data.order);

            return await Promise.all(
              contents.map(async (page) => {
                const Content = (await render(page.rawEntry)).Content;
                return {
                  slug: page.slug,
                  page,
                  Content,
                };
              })
            );
          })()
        );
      }
      return this.degreesWidgetCache.get(language)!;
    },
  };

  studyModeWidget = {
    getData: async (language: Language): Promise<StudyModeWidgetDataItem[]> => {
      if (!this.studyModeWidgetCache.has(language)) {
        this.studyModeWidgetCache.set(
          language,
          (async () => {
            const store = await this.getStore("study-mode-widget");
            const pages = store
              .filter((e) => e.language === language)
              .sort((a, b) => a.data.order - b.data.order);

            return await Promise.all(
              pages.map(async (p) => ({
                slug: p.slug,
                page: p,
                Content: (await render(p.rawEntry)).Content,
              }))
            );
          })()
        );
      }
      return this.studyModeWidgetCache.get(language)!;
    },
  };

  jobs = {
    list: async (language?: Language) => {
      const store = await this.getStore("jobs");
      const filtered = language ? store.filter((j) => j.language === language) : [...store.values()];
      return filtered.sort((a, b) => {
        if (a.data.date > b.data.date) {
          return -1;
        }
        if (a.data.date < b.data.date) {
          return 1;
        }
        return b.id.localeCompare(a.id);
      });
    },
    getById: async (id: string) => {
      const store = await this.getStore("jobs");
      return store.get(id);
    },
  };

  carousel = {
    get: async () => {
      const store = await this.getStore("carousel");
      const entry = store.get("carousel") || store.values()[0];
      if (!entry) throw new Error("Carousel data not found");
      return entry.data;
    },
  };

  shortcuts = {
    get: async (language: Language) => {
      const store = await this.getStore("shortcuts");
      const entry = store.get("shortcuts") || store.values()[0];
      if (!entry) throw new Error("Shortcuts data not found");
      return (entry.data as any)[language];
    },
  };

  menu = {
    get: async (language: Language): Promise<MenuItem[]> => {
      const store = await this.getStore("menu");
      const entry = store.get(language);
      if (entry) return entry.data as MenuItem[];

      const rawEntry = await getEntry("menu", language);
      if (!rawEntry) throw new Error(`Menu data for ${language} not found`);
      const items = extractMenuItems(rawEntry.data);
      return resolveMenuItems(items, this, language);
    },
  };

  assembly = {
    list: async (language: Language = "zh"): Promise<ContentEntry<AssemblyTableMetadata>[]> => {
      const store = await this.getStore("assembly");
      return sortAssemblyTables(store.values());
    },

    getBySemester: async (
      semester: string,
      language: Language = "zh"
    ): Promise<ContentEntry<AssemblyTableMetadata> | null> => {
      const store = await this.getStore("assembly");
      return store.get(semester) || store.values().find((item) => item.data.semester === semester) || null;
    },
  };

  newsletter = {
    list: async (language: Language = "zh"): Promise<ContentEntry<NewsletterMetadata>[]> => {
      const store = await this.getStore("newsletter");
      return sortNewsletters(store.values(), "asc");
    },

    getByYearAndIssue: async (
      year: number,
      issue: number,
      language: Language = "zh"
    ): Promise<ContentEntry<NewsletterMetadata> | null> => {
      const store = await this.getStore("newsletter");
      return store.values().find((item) => item.data.year === year && item.data.issue === issue) || null;
    },
  };
}

