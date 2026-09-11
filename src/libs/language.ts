import { getEntry } from "astro:content";

export type Language = "zh" | "en";

export function isLanguage(language: string): language is Language {
  return language == "zh" || language == "en";
}

export function getLanguageBySlug(slug: string): {
  language: Language;
  slug: string;
} {
  const index = slug.indexOf("/");
  if (index < 0) {
    if (slug.startsWith("zh_") || slug.startsWith("en_")) {
      const language = slug.substring(0, 2) as Language;
      const remaining = slug.substring(3).replace(/_/g, "/");
      return { language, slug: remaining };
    }
    throw new Error("Unable to get language from slug: " + slug);
  }
  const language = slug.substring(0, index);
  const remaining = slug.substring(index + 1);
  if (isLanguage(language)) return { language, slug: remaining };
  throw new Error("Unable to get language from slug: " + slug);
}

const translationEntry = await getEntry("translation", "translation");
const translation = (translationEntry?.data || {}) as Record<string, { zh: string; en: string }>;

export function T(msg: string, language: Language): string {
  if (!(msg in translation)) throw new Error("Unknown message: " + msg);
  return translation[msg][language];
}
