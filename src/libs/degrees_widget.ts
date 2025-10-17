import { type CollectionEntry, getCollection, getEntry, render } from "astro:content";
import { getLanguageBySlug, type Language } from "./language";
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

async function findAndConvertData(
  raw: RawDataItem,
  contentMap: { [slug: string]: CollectionEntry<"degrees-widget"> }
): Promise<DegreesWidgetDataItem> {
  if (!(raw.slug in contentMap))
    throw new Error(`Cannot find ${raw.slug} in degrees_widget content`);
  const page = contentMap[raw.slug];
  const Content = (await render(page)).Content;
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
  const dataEntry = await getEntry("degrees-widget-data", "degrees-widget");
  if (!dataEntry) {
    throw new Error(
      "Degrees widget data file 'degrees-widget.yml' not found in the 'degrees-widget-data' collection. This file is required.",
    );
  }
  const data = dataEntry.data;

  const contents = await getCollection(
    "degrees-widget",
    ({ id }) => getLanguageBySlug(id).language === language
  );

  const contentMap: { [slug: string]: CollectionEntry<"degrees-widget"> } = {};
  contents.map((page) => {
    contentMap[getLanguageBySlug(page.id).slug] = page;
  });
  return await Promise.all(
    (data[language] as RawDataItem[]).map(async (d) =>
      findAndConvertData(d, contentMap)
    )
  );
}
