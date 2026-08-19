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
} from "./schemas";
import { getLanguageBySlug } from "../language";
import site from "../site";
import { slug as slugify } from "github-slugger";

export class AstroContentClient implements IContentClient {
  async getEntry<K extends keyof ContentSchemaMap>(
    collection: K,
    id: string
  ): Promise<ContentEntry<ContentSchemaMap[K]> | null> {
    try {
      const entry = await getEntry(collection as any, id);
      if (!entry) return null;

      let language: Language = "zh";
      let slug = id;
      try {
        const parsed = getLanguageBySlug(entry.id);
        language = parsed.language;
        slug = parsed.slug;
      } catch {
        // Not language prefixed
      }

      return {
        id: entry.id,
        slug,
        language,
        status: "published",
        data: entry.data as ContentSchemaMap[K],
        rawEntry: entry,
        body: entry.body,
        updatedAt: new Date(),
      };
    } catch {
      return null;
    }
  }

  async getCollection<K extends keyof ContentSchemaMap>(
    collection: K,
    filter?: (entry: ContentEntry<ContentSchemaMap[K]>) => boolean
  ): Promise<ContentEntry<ContentSchemaMap[K]>[]> {
    const rawEntries = await getCollection(collection as any);
    const results: ContentEntry<ContentSchemaMap[K]>[] = rawEntries.map((entry: any) => {
      let language: Language = "zh";
      let slug = entry.id;
      try {
        const parsed = getLanguageBySlug(entry.id);
        language = parsed.language;
        slug = parsed.slug;
      } catch {
        // Not language prefixed
      }

      return {
        id: entry.id,
        slug,
        language,
        status: "published" as const,
        data: entry.data as ContentSchemaMap[K],
        rawEntry: entry,
        body: entry.body,
        updatedAt: new Date(),
      };
    });

    return filter ? results.filter(filter) : results;
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
      return this.getEntry("pages", `${language}/${slug}`);
    },
    getById: async (id: string) => {
      return this.getEntry("pages", id);
    },
    list: async (language?: Language) => {
      const all = await this.getCollection("pages");
      return language ? all.filter((p) => p.language === language) : all;
    },
    listChildren: async (slug: string) => {
      const descendants = await getCollection(
        "pages",
        (page) => page.id.startsWith(slug) && page.id !== slug
      );

      const children = descendants
        .filter((page) => {
          const relPath = page.id.slice(slug.length + 1);
          return !relPath.includes("/");
        })
        .sort((a, b) => a.data.order - b.data.order);

      return children.map((page) => ({
        url: "/" + page.id,
        thumbnail: page.data.thumbnail || site.defaultThumbnail,
        title: page.data.title,
      }));
    },
  };

  news = {
    list: async (language?: Language, limit?: number) => {
      const all = await this.getCollection("news");
      let filtered = language ? all.filter((n) => n.language === language) : all;
      filtered.sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());
      return limit ? filtered.slice(0, limit) : filtered;
    },
    getById: async (id: string) => {
      return this.getEntry("news", id);
    },
  };

  faculty = {
    list: async (language?: Language) => {
      const all = await this.getCollection("faculty");
      return language ? all.filter((f) => f.language === language) : all;
    },
    listByCategory: async (category: FacultyCategory, language: Language) => {
      const all = await this.getCollection("faculty");
      return all
        .filter((f) => f.language === language && f.data.category === category)
        .sort((a, b) => (a.data.order || 0) - (b.data.order || 0));
    },
    getBySlug: async (slug: string, language: Language) => {
      return this.getEntry("faculty", `${language}/${slug}`);
    },
    getAdjunctList: async (language: Language) => {
      const entry = await getEntry("adjunct-prof", `${language}/adjunct-prof`);
      return entry ? (entry.data as FacultyMetadata[]) : [];
    },
    getMetadata: async (language: Language, categories?: FacultyCategory[]) => {
      const facultyPages = await getCollection("faculty");
      const adjunctEntry = await getEntry("adjunct-prof", `${language}/adjunct-prof`);
      const adjunctData = (adjunctEntry?.data || []) as FacultyMetadata[];

      const filterByCat = (cat: FacultyCategory) =>
        facultyPages
          .filter((p) => {
            const parsed = getLanguageBySlug(p.id);
            return parsed.language === language && p.data.category === cat;
          })
          .map((p) => {
            const { slug } = getLanguageBySlug(p.id);
            return {
              ...p.data,
              slug,
              url: `/${language}/academic/faculty/${slug}`,
            };
          })
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
      const all = await this.getCollection("degrees-programs");
      const filtered = language ? all.filter((d) => d.language === language) : all;
      return filtered.sort((a, b) => a.data.order - b.data.order);
    },
    getBySlug: async (slug: string, language: Language) => {
      return this.getEntry("degrees-programs", `${language}/${slug}`);
    },
  };

  degreesWidget = {
    getData: async (language: Language): Promise<DegreesWidgetDataItem[]> => {
      const contents = await getCollection(
        "degrees-widget",
        ({ id }) => getLanguageBySlug(id).language === language
      );

      const sortedContents = contents.sort(
        (a, b) => a.data.order - b.data.order
      );

      return await Promise.all(
        sortedContents.map(async (page) => {
          const Content = (await render(page)).Content;
          const { slug } = getLanguageBySlug(page.id);
          return {
            slug: slug.replace(/\.(md|mdx)$/, ""),
            page: {
              id: page.id,
              slug,
              language,
              status: "published" as const,
              data: page.data,
              rawEntry: page,
              body: page.body,
              updatedAt: new Date(),
            },
            Content,
          };
        })
      );
    },
  };

  studyModeWidget = {
    getData: async (language: Language): Promise<StudyModeWidgetDataItem[]> => {
      const pages = (
        await getCollection(
          "study-mode-widget",
          (e) => getLanguageBySlug(e.id).language == language
        )
      ).sort((a, b) => a.data.order - b.data.order);

      return await Promise.all(
        pages.map(async (p) => ({
          slug: getLanguageBySlug(p.id).slug,
          page: {
            id: p.id,
            slug: getLanguageBySlug(p.id).slug,
            language,
            status: "published" as const,
            data: p.data,
            rawEntry: p,
            body: p.body,
            updatedAt: new Date(),
          },
          Content: (await render(p)).Content,
        }))
      );
    },
  };

  jobs = {
    list: async (language?: Language) => {
      const all = await this.getCollection("jobs");
      const filtered = language ? all.filter((j) => j.language === language) : all;
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
      return this.getEntry("jobs", id);
    },
  };

  carousel = {
    get: async () => {
      const entry = await getEntry("carousel", "carousel");
      if (!entry) throw new Error("Carousel data not found");
      return entry.data;
    },
  };

  shortcuts = {
    get: async (language: Language) => {
      const entry = await getEntry("shortcuts", "shortcuts");
      if (!entry) throw new Error("Shortcuts data not found");
      return (entry.data as any)[language];
    },
  };

  translation = {
    get: async (key: string, language: Language) => {
      const entry = await getEntry("translation", "translation");
      if (!entry || !(key in entry.data)) throw new Error(`Unknown translation message: ${key}`);
      return (entry.data as any)[key][language];
    },
    getAll: async () => {
      const entry = await getEntry("translation", "translation");
      return (entry?.data || {}) as Record<string, { zh: string; en: string }>;
    },
  };

  menu = {
    get: async (language: Language): Promise<MenuItem[]> => {
      const entry = await getEntry("menu", language);
      if (!entry) throw new Error(`Menu data for ${language} not found`);

      const convertMenuItem = async (m: any): Promise<MenuItem> => {
        let children: MenuItem[] | undefined;
        if (m.children) {
          children = await Promise.all(m.children.map(convertMenuItem));
        } else if (m.page && m.includeChildren) {
          const childPages = await this.pages.listChildren(m.page);
          children = childPages.map((child) => ({
            name: child.title,
            url: child.url,
          }));
        }

        if (m.page) {
          const page = await getEntry("pages", m.page);
          if (!page) throw new Error("Menu page not found: " + m.page);
          return {
            name: page.data.title,
            url: (!m.noUrl && "/" + page.id) || undefined,
            children,
          };
        } else {
          return {
            name: m.name,
            url: m.url,
            children,
          };
        }
      };

      return await Promise.all((entry.data as any[]).map(convertMenuItem));
    },
  };
}
