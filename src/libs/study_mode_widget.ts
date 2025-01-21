import { getLanguageBySlug, type Language } from "./language";
import { type CollectionEntry, getCollection, render } from "astro:content";
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
      (e) => getLanguageBySlug(e.id).language == language
    )
  ).sort((a, b) => a.data.order - b.data.order);
  return await Promise.all(
    pages.map(async (p) => ({
      slug: getLanguageBySlug(p.id).slug,
      page: p,
      Content: (await render(p)).Content,
    }))
  );
}
