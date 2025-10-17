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
  if (index < 0) throw new Error("Unable to get language from slug: " + slug);
  const language = slug.substring(0, index);
  const remaining = slug.substring(index + 1);
  if (isLanguage(language)) return { language, slug: remaining };
  throw new Error("Unable to get language from slug: " + slug);
}

const translationEntry = await getEntry("translation", "translation");
if (!translationEntry) {
  throw new Error(
    "Translation data file 'translation.yml' not found in the 'translation' collection. This file is required.",
  );
}

const translation = translationEntry.data;

export function T(msg: string, language: Language): string {
  if (!(msg in translation)) throw new Error("Unknown message: " + msg);
  return translation[msg][language];
}
