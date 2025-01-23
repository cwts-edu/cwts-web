import type { Language } from "../libs/language";

const siteData = {
  en: {
    title: "Christian Witness Theological Seminary",
    shortTitle: "CWTS",
    home: "/en",
    coverVideoTitle: "2025 BABC Promotion",
  },
  zh: {
    title: "CWTS 基督工人神學院",
    shortTitle: "基督工人神學院",
    home: "/",
    coverVideoTitle: "2025 BABC 教育大會 推廣片",
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
  coverVideoId = "3XctCQ-pg4g";
  coverVideoTitle(language: Language): string {
    return siteData[language].coverVideoTitle;
  }
}

export default new Site();
