import { type CollectionEntry, getCollection, render } from "astro:content";
import { getLanguageBySlug, type Language } from "./language";
import type { MarkdownInstance } from "astro";

export interface DegreesWidgetDataItem {
  slug: string;
  page: CollectionEntry<"degrees-widget">;
  Content: MarkdownInstance<{}>["Content"];
}

export default async function getDegreesWidgetData(
  language: Language
): Promise<DegreesWidgetDataItem[]> {
  const contents = await getCollection(
    "degrees-widget",
    ({ id }) => getLanguageBySlug(id).language === language
  );

  const sortedContents = contents.sort(
    (a, b) => a.data.order - b.data.order
  );

  return await Promise.all(
    sortedContents.map(async (page) => {
      const Content = (await render(page)).Content;
      const { slug } = getLanguageBySlug(page.id);
      return {
        slug: slug.replace(/\.(md|mdx)$/, ""),
        page,
        Content,
      };
    })
  );
}
