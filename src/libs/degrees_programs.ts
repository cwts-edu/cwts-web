import { CollectionEntry, getCollection } from "astro:content";
import { getLanguageBySlug, Language } from "./language";

export type DegreesProgramsMetadata =
  CollectionEntry<"degrees-programs">["data"] & {
    language: Language;
    slug: string;
    url: string;
    thumbnail: string;
  };

export type Category = DegreesProgramsMetadata["category"];

export async function getDegreesPrograms(
  language: Language
): Promise<DegreesProgramsMetadata[]> {
  const pages = await getCollection(
    "degrees-programs",
    ({ slug }) => getLanguageBySlug(slug).language === language
  );
  return pages
    .sort((a, b) => a.data.order - b.data.order)
    .map((page) => {
      {
        const { language, slug } = getLanguageBySlug(page.slug);
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
