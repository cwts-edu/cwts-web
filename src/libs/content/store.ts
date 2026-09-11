import type { ContentEntry } from "./types";
import type { Language } from "./schemas";

/**
 * In-memory DataStore inspired by Astro's Content Loader DataStore API.
 * Caches all entries of a collection in memory with primary indexing by ID
 * and secondary indexing by (language, slug) composite key.
 *
 * Enforces strict, deterministic lookups: zero regex, zero fallback guessing.
 */
export class ContentDataStore<T = any> {
  private byId = new Map<string, ContentEntry<T>>();
  private bySlug = new Map<string, ContentEntry<T>>(); // key: `${language}:${slug}`
  private all: ContentEntry<T>[] = [];

  set(entry: ContentEntry<T>, aliases?: string[]): void {
    const existingIndex = this.all.findIndex((e) => e.id === entry.id);
    if (existingIndex >= 0) {
      this.all[existingIndex] = entry;
    } else {
      this.all.push(entry);
    }

    this.byId.set(entry.id, entry);

    if (aliases) {
      for (const alias of aliases) {
        this.byId.set(alias, entry);
      }
    }

    if (entry.language && entry.slug) {
      this.bySlug.set(`${entry.language}:${entry.slug}`, entry);
    }
  }

  get(id: string): ContentEntry<T> | null {
    return this.byId.get(id) ?? null;
  }

  getBySlug(slug: string, language: Language): ContentEntry<T> | null {
    return this.bySlug.get(`${language}:${slug}`) ?? null;
  }

  delete(id: string): boolean {
    const entry = this.byId.get(id);
    if (!entry) return false;

    this.byId.delete(id);

    if (entry.language && entry.slug) {
      this.bySlug.delete(`${entry.language}:${entry.slug}`);
    }

    const idx = this.all.findIndex((e) => e.id === id || e.id === entry.id);
    if (idx >= 0) {
      this.all.splice(idx, 1);
    }

    return true;
  }

  has(id: string): boolean {
    return this.byId.has(id);
  }

  values(): ContentEntry<T>[] {
    return this.all;
  }

  filter(predicate: (entry: ContentEntry<T>) => boolean): ContentEntry<T>[] {
    return this.all.filter(predicate);
  }

  get size(): number {
    return this.all.length;
  }
}
