import type { Language } from "../libs/language";

const siteData = {
  en: {
    title: "Christian Witness Theological Seminary",
    shortTitle: "CWTS",
    home: "/en",
    coverVideoTitle: "Alumni interview: three generations of CWTS",
  },
  zh: {
    title: "CWTS 基督工人神學院",
    shortTitle: "基督工人神學院",
    home: "/",
    coverVideoTitle: "校友專訪：三代基神人，一路事主心",
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
  coverVideoId = "VSRVOo82_SM";
  coverVideoTitle(language: Language): string {
    return siteData[language].coverVideoTitle;
  }
}

export default new Site();
