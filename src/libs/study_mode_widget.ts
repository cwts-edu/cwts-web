import { getLanguageBySlug, type Language } from "./language";
import { type CollectionEntry, getCollection } from "astro:content";
import type { MarkdownInstance } from "astro";

interface StudyModeWidgetDataItem {
  slug: string;
  page: CollectionEntry<"study-mode-widget">;
  Content: MarkdownInstance<{}>["Content"];
}

export default async function getStudyModeWidgetData(
  language: Language
): Promise<StudyModeWidgetDataItem[]> {
  const pages = (
    await getCollection(
      "study-mode-widget",
      (e) => getLanguageBySlug(e.slug).language == language
    )
  ).sort((a, b) => a.data.order - b.data.order);
  return await Promise.all(
    pages.map(async (p) => ({
      slug: getLanguageBySlug(p.slug).slug,
      page: p,
      Content: (await p.render()).Content,
    }))
  );
}
