import translation from "./translation.yml";

export type Language = "zh" | "en";

export function isLanguage(language: string): language is Language {
  return language == "zh" || language == "en";
}

export function getLanguageBySlug(slug: string): Language {
  const parts = slug.split("/", 2);
  if (parts.length < 1)
    throw new Error("Unable to get language from slug: " + slug);
  if (isLanguage(parts[0])) return parts[0];
  throw new Error("Unable to get language from slug: " + slug);
}

export function T(msg: string, language: Language): string {
  if (!(msg in translation)) throw new Error("Unknown message: " + msg);
  return translation[msg][language];
}
