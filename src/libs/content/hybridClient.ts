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
  DegreeProgramMetadata,
  JobMetadata,
  NewsMetadata,
  PageMetadata,
} from "./schemas";
import { FirebaseContentClient } from "./firebaseClient";
import { AstroContentClient } from "./astroClient";

export class HybridContentClient implements IContentClient {
  private firebase: FirebaseContentClient;
  private astro: AstroContentClient;
  private migratedCollections: Set<keyof ContentSchemaMap>;

  constructor(options: {
    firebase: FirebaseContentClient;
    astro: AstroContentClient;
    migrated: Array<keyof ContentSchemaMap>;
  }) {
    this.firebase = options.firebase;
    this.astro = options.astro;
    this.migratedCollections = new Set(options.migrated);
  }

  private isMigrated(collection: keyof ContentSchemaMap): boolean {
    return this.migratedCollections.has(collection);
  }

  getEntry<K extends keyof ContentSchemaMap>(
    collection: K,
    id: string
  ): Promise<ContentEntry<ContentSchemaMap[K]> | null> {
    return this.isMigrated(collection)
      ? this.firebase.getEntry(collection, id)
      : this.astro.getEntry(collection, id);
  }

  getCollection<K extends keyof ContentSchemaMap>(
    collection: K,
    filter?: (entry: ContentEntry<ContentSchemaMap[K]>) => boolean
  ): Promise<ContentEntry<ContentSchemaMap[K]>[]> {
    return this.isMigrated(collection)
      ? this.firebase.getCollection(collection, filter)
      : this.astro.getCollection(collection, filter);
  }

  render<T = any>(
    entry: ContentEntry<T>
  ): Promise<{ Content: any; headings?: any[] }> {
    return entry.rawEntry
      ? this.astro.render(entry)
      : this.firebase.render(entry);
  }

  get pages() {
    return this.isMigrated("pages") ? this.firebase.pages : this.astro.pages;
  }

  get news() {
    return this.isMigrated("news") ? this.firebase.news : this.astro.news;
  }

  get faculty() {
    return this.isMigrated("faculty") ? this.firebase.faculty : this.astro.faculty;
  }

  get degreesPrograms() {
    return this.isMigrated("degrees-programs")
      ? this.firebase.degreesPrograms
      : this.astro.degreesPrograms;
  }

  get degreesWidget() {
    return this.isMigrated("degrees-widget")
      ? this.firebase.degreesWidget
      : this.astro.degreesWidget;
  }

  get studyModeWidget() {
    return this.isMigrated("study-mode-widget")
      ? this.firebase.studyModeWidget
      : this.astro.studyModeWidget;
  }

  get jobs() {
    return this.isMigrated("jobs") ? this.firebase.jobs : this.astro.jobs;
  }

  get carousel() {
    return this.isMigrated("carousel") ? this.firebase.carousel : this.astro.carousel;
  }

  get shortcuts() {
    return this.isMigrated("shortcuts") ? this.firebase.shortcuts : this.astro.shortcuts;
  }

  get translation() {
    return this.isMigrated("translation")
      ? this.firebase.translation
      : this.astro.translation;
  }

  get menu() {
    return this.isMigrated("menu") ? this.firebase.menu : this.astro.menu;
  }
}
