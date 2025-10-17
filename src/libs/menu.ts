import { getEntry } from "astro:content";
import type { Language } from "./language";
import listChildren from "./listing";

interface MenuDataLink {
  name: string;
  url?: string;
}

interface MenuDataPage {
  page: string;
  noUrl?: boolean;
  includeChildren?: boolean;
}

type MenuData = (MenuDataLink | MenuDataPage) & {
  children?: MenuData[];
};

function isMenuDataSlug(data: MenuData): data is MenuDataPage {
  return (data as MenuDataPage).page !== undefined;
}

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
  } else if (isMenuDataSlug(data) && data.includeChildren) {
    children = (await listChildren(data.page)).map((child) => ({
      name: child.title,
      url: child.url,
    }));
  }
  if (isMenuDataSlug(data)) {
    const page = await getEntry("pages", data.page);
    if (!page) throw new Error("Menu page not found: " + data.page);
    return {
      name: page.data.title,
      url: (!data.noUrl && "/" + page.id) || undefined,
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

async function convertMenu(menu: MenuData[]): Promise<MenuItem[]> {
  return await Promise.all(menu.map(async (m) => convertMenuDataToMenuItem(m)));
}

const menuEnEntry = await getEntry("menu", "en");
if (!menuEnEntry) {
  throw new Error(
    "Menu data file 'en.yml' not found in the 'menu' collection. This file is required.",
  );
}
const menuEn = menuEnEntry.data;

const menuZhEntry = await getEntry("menu", "zh");
if (!menuZhEntry) {
  throw new Error(
    "Menu data file 'zh.yml' not found in the 'menu' collection. This file is required.",
  );
}
const menuZh = menuZhEntry.data;

const menu = {
  en: await convertMenu(menuEn as MenuData[]),
  zh: await convertMenu(menuZh as MenuData[]),
};

export default async function getMenu(language: Language): Promise<MenuItem[]> {
  return menu[language];
}
