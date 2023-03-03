import type { Language } from "../libs/language";

type SiteConfig = {
  [language in Language]: Site;
};

const siteData = {
  en: {
    title: "Christian Witness Theological Seminary",
    shortTitle: "CWTS",
  },
  zh: {
    title: "CWTS 基督工人神學院",
    shortTitle: "基督工人神學院",
  },
};

class Site {
  title(language: Language): string {
    return siteData[language].title;
  }
  shortTitle(language: Language): string {
    return siteData[language].shortTitle;
  }
}

export default new Site();
