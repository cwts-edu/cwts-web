import { content } from "./content";
import type { Language } from "./language";
import type { FacultyMetadata as BaseFacultyMetadata } from "./content/schemas";

export type Category = "faculty" | "senior-adjunct" | "adjunct";
export type FacultyMetadata = BaseFacultyMetadata & {
  slug?: string;
  url?: string;
};

export async function getFacultyMetadata(
  language: Language,
  categories?: Category[]
): Promise<FacultyMetadata[]> {
  return content.faculty.getMetadata(language, categories);
}
