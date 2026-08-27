import type {
  ContentSchemaMap,
  Language,
  FacultyCategory,
  PageMetadata,
  NewsMetadata,
  FacultyMetadata,
  DegreeProgramMetadata,
  JobMetadata,
  CarouselItem,
  ShortcutItem,
  MenuItem,
  DegreesWidgetMetadata,
  StudyModeWidgetMetadata,
} from "./schemas";

export type ContentStatus = "draft" | "published" | "deleted";

export interface AuditUser {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  timestamp: string; // ISO string
}

export interface VersionRecord<T = any> {
  version: number;
  status: ContentStatus;
  data: T;
  body?: string;
  html?: string;
  author: AuditUser;
  createdAt: string;
  publishedAt?: string;
  changeNote?: string;
}

export interface ContentEntry<T = any> {
  id: string;
  slug: string;
  language: Language;
  status: ContentStatus;
  version?: number;
  publishedVersion?: number;
  data: T;
  draftData?: T;
  rawEntry?: any;
  Content?: any; // Component rendering Markdown/MDX
  body?: string; // Raw markdown or text body
  html?: string; // Compiled or rich text HTML
  updatedBy?: AuditUser;
  publishedBy?: AuditUser;
  updatedAt: Date;
}

export interface CollectionFilter<T> {
  language?: Language;
  status?: ContentStatus;
  limit?: number;
  where?: { [K in keyof T]?: T[K] };
  orderBy?: { field: keyof T; direction: "asc" | "desc" };
}

export interface DegreesWidgetDataItem {
  slug: string;
  page: ContentEntry<DegreesWidgetMetadata>;
  Content: any;
}

export interface StudyModeWidgetDataItem {
  slug: string;
  page: ContentEntry<StudyModeWidgetMetadata>;
  Content: any;
}

export interface IContentClient {
  getEntry<K extends keyof ContentSchemaMap>(
    collection: K,
    id: string
  ): Promise<ContentEntry<ContentSchemaMap[K]> | null>;

  getCollection<K extends keyof ContentSchemaMap>(
    collection: K,
    filter?: (entry: ContentEntry<ContentSchemaMap[K]>) => boolean
  ): Promise<ContentEntry<ContentSchemaMap[K]>[]>;

  render<T = any>(
    entry: ContentEntry<T>
  ): Promise<{ Content: any; headings?: any[] }>;

  pages: {
    getBySlug(slug: string, language: Language): Promise<ContentEntry<PageMetadata> | null>;
    getById(id: string): Promise<ContentEntry<PageMetadata> | null>;
    list(language?: Language): Promise<ContentEntry<PageMetadata>[]>;
    listChildren(slug: string): Promise<Array<{ url: string; thumbnail: string; title: string }>>;
  };

  news: {
    list(language?: Language, limit?: number): Promise<ContentEntry<NewsMetadata>[]>;
    getById(id: string): Promise<ContentEntry<NewsMetadata> | null>;
  };

  faculty: {
    list(language?: Language): Promise<ContentEntry<FacultyMetadata>[]>;
    listByCategory(category: FacultyCategory, language: Language): Promise<ContentEntry<FacultyMetadata>[]>;
    getBySlug(slug: string, language: Language): Promise<ContentEntry<FacultyMetadata> | null>;
    getAdjunctList(language: Language): Promise<FacultyMetadata[]>;
    getMetadata(language: Language, categories?: FacultyCategory[]): Promise<Array<FacultyMetadata & { slug?: string; url?: string }>>;
  };

  degreesPrograms: {
    list(language?: Language): Promise<ContentEntry<DegreeProgramMetadata>[]>;
    getBySlug(slug: string, language: Language): Promise<ContentEntry<DegreeProgramMetadata> | null>;
  };

  degreesWidget: {
    getData(language: Language): Promise<DegreesWidgetDataItem[]>;
  };

  studyModeWidget: {
    getData(language: Language): Promise<StudyModeWidgetDataItem[]>;
  };

  jobs: {
    list(language?: Language): Promise<ContentEntry<JobMetadata>[]>;
    getById(id: string): Promise<ContentEntry<JobMetadata> | null>;
  };

  carousel: {
    get(): Promise<CarouselItem[]>;
  };

  shortcuts: {
    get(language: Language): Promise<ShortcutItem[]>;
  };

  translation: {
    get(key: string, language: Language): Promise<string>;
    getAll(): Promise<Record<string, { zh: string; en: string }>>;
  };

  menu: {
    get(language: Language): Promise<MenuItem[]>;
  };
}
