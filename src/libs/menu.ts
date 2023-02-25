interface MenuDataLink {
  name: string;
  url?: string;
}

interface MenuDataPage {
  page: string;
  noUrl?: boolean;
}

type MenuData = (MenuDataLink | MenuDataPage) & {
  children?: MenuData[];
};

function isMenuDataSlug(data: MenuData): data is MenuDataPage {
  return (data as MenuDataPage).page !== undefined;
}

import { getEntryBySlug } from "astro:content";
import _menu from "@data/menu.yml";

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
    const page = await getEntryBySlug("pages", data.page);
    if (!page) throw new Error("Menu page not found: " + data.page);
    return {
      name: page.data.title,
      url: (!data.noUrl && "/" + page.slug) || undefined,
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
