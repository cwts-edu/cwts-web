import adjunctFacultyZh from "@data/adjunct-prof-zh.yml";
import { getCollection } from "astro:content";
import type { CollectionEntry } from "astro:content";
import { getLanguageBySlug, Language } from "./language";

type Category = "faculty" | "senior-adjunct" | "adjunct";
export type FacultyMetadata = CollectionEntry<"faculty">["data"] & {
  slug?: string;
  url?: string;
};

const facultyPages = await getCollection("faculty");

function filterPagesByLanguageCategory(
  pages: CollectionEntry<"faculty">[],
  language: Language,
  category: Category
): CollectionEntry<"faculty">[] {
  return pages.filter(
    (page) =>
      getLanguageBySlug(page.slug).language == language &&
      page.data.category == category
  );
}

function getMetadata(pages: CollectionEntry<"faculty">[]): FacultyMetadata[] {
  return pages
    .map((page) => {
      const { language, slug } = getLanguageBySlug(page.slug);
      return {
        ...page.data,
        slug,
        url: `/${language}/academic/faculty/${slug}`,
      };
    })
    .sort((a, b) => a.order - b.order);
}

const facultyMetadata: Record<Language, Record<Category, FacultyMetadata[]>> = {
  zh: {
    faculty: getMetadata(
      filterPagesByLanguageCategory(facultyPages, "zh", "faculty")
    ),
    "senior-adjunct": getMetadata(
      filterPagesByLanguageCategory(facultyPages, "zh", "senior-adjunct")
    ),
    adjunct: adjunctFacultyZh as FacultyMetadata[],
  },
  en: {
    faculty: getMetadata(
      filterPagesByLanguageCategory(facultyPages, "en", "faculty")
    ),
    "senior-adjunct": getMetadata(
      filterPagesByLanguageCategory(facultyPages, "en", "senior-adjunct")
    ),
    adjunct: adjunctFacultyZh as FacultyMetadata[],
  },
};

export function getFacultyMetadata(
  language: Language,
  categories?: Category[]
): FacultyMetadata[] {
  return (categories || ["faculty", "senior-adjunct", "adjunct"]).flatMap(
    (category) => facultyMetadata[language][category]
  );
}
