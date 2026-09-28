import type { Language, MenuItem } from "./schemas";
import type { IContentClient } from "./types";

export function extractMenuItems(raw: any): MenuItem[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw.items)) return raw.items;
  return [];
}

/**
 * Recursively resolves menu item configurations into fully qualified menu items.
 * Handles page title lookups, child page auto-discovery (includeChildren),
 * and custom names/URLs.
 */
export async function resolveMenuItems(
  rawItems: MenuItem[],
  client: IContentClient,
  language: Language
): Promise<MenuItem[]> {
  const convertMenuItem = async (m: MenuItem): Promise<MenuItem> => {
    let children: MenuItem[] | undefined;

    if (m.children && m.children.length > 0) {
      children = await Promise.all(m.children.map(convertMenuItem));
    } else if (m.page && m.includeChildren) {
      const targetSlug = m.page.startsWith("zh/") || m.page.startsWith("en/")
        ? m.page
        : `${language}/${m.page.replace(/^\/+/, "")}`;
      const childPages = await client.pages.listChildren(targetSlug);
      children = childPages.map((child) => ({
        name: child.title,
        url: child.url,
      }));
    }

    if (m.page) {
      const slug = m.page.startsWith("zh/") || m.page.startsWith("en/") ? m.page.slice(3) : m.page;
      const page = await client.pages.getBySlug(slug, language).catch(() => null);

      const title = m.name || page?.data?.title || m.page.split("/").pop() || m.page;

      let cleanUrl: string;
      if (page?.slug && page?.language) {
        cleanUrl = `/${page.language}/${page.slug}`;
      } else if (page?.id && page.id.includes("/")) {
        cleanUrl = "/" + page.id.replace(/^\/+/, "");
      } else {
        cleanUrl = m.page.startsWith("/") ? m.page : `/${m.page}`;
      }
      const url = !m.noUrl ? cleanUrl : undefined;

      return {
        name: title,
        url,
        children: children && children.length > 0 ? children : undefined,
      };
    } else {
      return {
        name: m.name,
        url: m.noUrl ? undefined : m.url,
        children: children && children.length > 0 ? children : undefined,
      };
    }
  };

  return Promise.all(rawItems.map(convertMenuItem));
}
