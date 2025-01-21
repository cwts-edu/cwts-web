import type { Language } from "./language";

export type DegreesProgramsCategory = "doctor" | "master" | "diploma" | "certificate";

export type DegreesProgramsMetadata = {
    title: string;
    order: number;
    category: DegreesProgramsCategory;
    credits: number;
    length?: string | undefined;
    thumbnail?: string | undefined;
    redirect?: string | undefined;
} & {
    language: Language;
    slug: string;
    url: string;
    thumbnail: string;
}
