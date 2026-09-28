import { content } from "./content";
import type { Language } from "./language";
import type { DegreesProgramsMetadata } from "./types";

export async function getDegreesPrograms(
  language: Language
): Promise<DegreesProgramsMetadata[]> {
  const pages = await content.degreesPrograms.list(language);
  return pages.map((page) => ({
    ...page.data,
    language: page.language,
    slug: page.slug,
    url: `/${page.language}/academic/degrees-programs/${page.slug}`,
    thumbnail:
      page.data.thumbnail || "/images/degrees-programs/default-cover.jpg",
  }));
}
