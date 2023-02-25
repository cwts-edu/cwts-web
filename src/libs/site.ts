import type { Language } from "../libs/language";

interface Site {
  title: string;
  shortTitle: string;
}

type SiteConfig = {
  [language in Language]: Site;
};

const site: SiteConfig = {
  en: {
    title: "Christian Witness Theological Seminary",
    shortTitle: "CWTS",
  },
  zh: {
    title: "CWTS 基督工人神學院",
    shortTitle: "基督工人神學院",
  },
};

export function getSite(language: Language): Site {
  return site[language];
}
