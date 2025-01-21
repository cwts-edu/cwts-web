import { type CollectionEntry, getCollection } from "astro:content";
import { getLanguageBySlug, type Language } from "./language";
import type {DegreesProgramsMetadata} from "./types";

export async function getDegreesPrograms(
  language: Language
): Promise<DegreesProgramsMetadata[]> {
  const pages = await getCollection(
    "degrees-programs",
    ({ id }) => getLanguageBySlug(id).language === language
  );
  return pages
    .sort((a, b) => a.data.order - b.data.order)
    .map((page) => {
      {
        const { language, slug } = getLanguageBySlug(page.id);
        return {
          ...page.data,
          language,
          slug,
          url: `/${language}/academic/degrees-programs/${slug}`,
          thumbnail:
            page.data.thumbnail || "/images/degrees-programs/default-cover.jpg",
        };
      }
    });
}
