interface MenuDataLink {
  name: string;
  url?: string;
}

interface MenuDataSlug {
  slug: string;
}

type MenuData = (MenuDataLink | MenuDataSlug) & {
  children?: MenuData[];
};

function isMenuDataSlug(data: MenuData): data is MenuDataSlug {
  return (data as MenuDataSlug).slug !== undefined;
}

import { getEntryBySlug } from "astro:content";
import _menu from "./menu.yml";

const menu = _menu as MenuData[];

export interface MenuItem {
  name: string;
  url?: string;
  children?: MenuItem[];
}

async function convertMenuDataToMenuItem(data: MenuData): Promise<MenuItem> {
  let children: MenuItem[] | undefined;
  if (data.children) {
    children = await Promise.all(
      data.children.map((child) => convertMenuDataToMenuItem(child))
    );
  }
  if (isMenuDataSlug(data)) {
    const page = await getEntryBySlug("pages", data.slug);
    if (!page) throw new Error("Menu page not found: " + data.slug);
    return {
      name: page.data.title,
      url: "/" + page.slug,
      children,
    };
  } else {
    return {
      name: data.name,
      url: data.url,
      children,
    };
  }
}

export default async function getMenu(): Promise<MenuItem[]> {
  return await Promise.all(menu.map(async (m) => convertMenuDataToMenuItem(m)));
}
