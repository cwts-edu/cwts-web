import { getCollection } from "astro:content";
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
    (page) => page.id.startsWith(slug) && page.id !== slug
  );

  const children = descendants
    .filter((page) => {
      const relPath = page.id.slice(slug.length + 1);
      return !relPath.includes("/");
    })
    .sort((a, b) => a.data.order - b.data.order);

  return children.map((page) => ({
    url: "/" + page.id,
    thumbnail: page.data.thumbnail || site.defaultThumbnail,
    title: page.data.title,
  }));
}
