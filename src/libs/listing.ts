import { getCollection, getEntryBySlug, CollectionEntry } from "astro:content";
import site from "./site";

export interface ListingItem {
  url: string;
  thumbnail: string;
  title: string;
}

export default async function listChildren(
  slug: string
): Promise<ListingItem[]> {
  const descendants = await getCollection(
    "pages",
    (page) => page.slug.startsWith(slug) && page.slug !== slug
  );

  const children = descendants
    .filter((page) => {
      const relPath = page.slug.slice(slug.length + 1);
      return !relPath.includes("/");
    })
    .sort((a, b) => a.data.order - b.data.order);

  return children.map((page) => ({
    url: "/" + page.slug,
    thumbnail: page.data.thumbnail || site.defaultThumbnail,
    title: page.data.title,
  }));
}
