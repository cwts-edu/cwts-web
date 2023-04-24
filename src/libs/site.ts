import type { Language } from "../libs/language";

const siteData = {
  en: {
    title: "Christian Witness Theological Seminary",
    shortTitle: "CWTS",
    home: "/en",
  },
  zh: {
    title: "CWTS 基督工人神學院",
    shortTitle: "基督工人神學院",
    home: "/",
  },
};

class Site {
  title(language: Language): string {
    return siteData[language].title;
  }
  shortTitle(language: Language): string {
    return siteData[language].shortTitle;
  }
  home(language: Language): string {
    return siteData[language].home;
  }
  defaultCover = "/images/covers/default.cover.jpg";
  defaultThumbnail = "/images/covers/default.thumbnail.jpg";
}

export default new Site();
