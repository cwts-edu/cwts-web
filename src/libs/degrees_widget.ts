import { CollectionEntry, getCollection } from "astro:content";
import { getLanguageBySlug, Language } from "./language";
import type { MarkdownInstance } from "astro";

export interface DegreesWidgetDataItem {
  slug: string;
  page: CollectionEntry<"degrees-widget">;
  Content: MarkdownInstance<{}>["Content"];
  children?: DegreesWidgetDataItem[];
}

interface RawDataItem {
  slug: string;
  children?: RawDataItem[];
}

import data from "@data/degrees_widget.yml";

async function findAndConvertData(
  raw: RawDataItem,
  contentMap: { [slug: string]: CollectionEntry<"degrees-widget"> }
): Promise<DegreesWidgetDataItem> {
  if (!(raw.slug in contentMap))
    throw new Error(`Cannot find ${raw.slug} in degrees_widget content`);
  const page = contentMap[raw.slug];
  const Content = (await page.render()).Content;
  return {
    slug: raw.slug,
    page: contentMap[raw.slug],
    Content: Content,
    children: raw.children
      ? await Promise.all(
          raw.children.map(async (c) => findAndConvertData(c, contentMap))
        )
      : undefined,
  };
}

export default async function getDegreesWidgetData(
  language: Language
): Promise<DegreesWidgetDataItem[]> {
  const contents = await getCollection(
    "degrees-widget",
    ({ slug }) => getLanguageBySlug(slug).language === language
  );

  const contentMap: { [slug: string]: CollectionEntry<"degrees-widget"> } = {};
  contents.map((page) => {
    contentMap[getLanguageBySlug(page.slug).slug] = page;
  });
  return await Promise.all(
    (data as RawDataItem[]).map(async (d) => findAndConvertData(d, contentMap))
  );
}
