import { content } from "./content";

export interface ListingItem {
  url: string;
  thumbnail: string;
  title: string;
}

export default async function listChildren(
  slug: string
): Promise<ListingItem[]> {
  return content.pages.listChildren(slug);
}
