import adjunctFacultyZh from "@data/adjunct-prof-zh.yml";
import adjunctFacultyEn from "@data/adjunct-prof-en.yml";
import { getCollection } from "astro:content";
import type { CollectionEntry } from "astro:content";
import { getLanguageBySlug, type Language } from "./language";
import { slug as slugify } from "github-slugger";

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
      getLanguageBySlug(page.id).language == language &&
      page.data.category == category
  );
}

function getMetadata(pages: CollectionEntry<"faculty">[]): FacultyMetadata[] {
  return pages
    .map((page) => {
      const { language, slug } = getLanguageBySlug(page.id);
      return {
        ...page.data,
        slug,
        url: `/${language}/academic/faculty/${slug}`,
      };
    })
    .sort((a, b) => a.order - b.order);
}

function setAdjunctUrl(
  faculty: FacultyMetadata[],
  language: Language
): FacultyMetadata[] {
  const url = `/${language}/academic/faculty/adjunct-professors`;
  return faculty.map((person) => ({
    ...person,
    url: `${url}#${slugify(person.name)}`,
  }));
}

const facultyMetadata: Record<Language, Record<Category, FacultyMetadata[]>> = {
  zh: {
    faculty: getMetadata(
      filterPagesByLanguageCategory(facultyPages, "zh", "faculty")
    ),
    "senior-adjunct": getMetadata(
      filterPagesByLanguageCategory(facultyPages, "zh", "senior-adjunct")
    ),
    adjunct: setAdjunctUrl(adjunctFacultyZh as FacultyMetadata[], "zh"),
  },
  en: {
    faculty: getMetadata(
      filterPagesByLanguageCategory(facultyPages, "en", "faculty")
    ),
    "senior-adjunct": getMetadata(
      filterPagesByLanguageCategory(facultyPages, "en", "senior-adjunct")
    ),
    adjunct: setAdjunctUrl(adjunctFacultyEn as FacultyMetadata[], "en"),
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
