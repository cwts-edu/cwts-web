import type { Language } from "../libs/language";

const siteData = {
  en: {
    title: "Christian Witness Theological Seminary",
    shortTitle: "CWTS",
    home: "/en",
    coverVideoTitle: "A seminarian's testimony: How theological studies have uplifted and transformed me",
  },
  zh: {
    title: "CWTS 基督工人神學院",
    shortTitle: "基督工人神學院",
    home: "/",
    coverVideoTitle: "神學生見證 - 神學學習如何提升和改變我",
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
  coverVideoId = "fkfx1alIKrI";
  coverVideoTitle(language: Language): string {
    return siteData[language].coverVideoTitle;
  }
}

export default new Site();
