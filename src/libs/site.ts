import type { Language } from "../libs/language";

const siteData = {
  en: {
    title: "Christian Witness Theological Seminary",
    shortTitle: "CWTS",
    home: "/en",
    coverVideoTitle: "Christian Witness Theological Seminary 50th Anniversary",
  },
  zh: {
    title: "CWTS 基督工人神學院",
    shortTitle: "基督工人神學院",
    home: "/",
    coverVideoTitle: "基督工人神學院 50周年感恩慶典",
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
  coverVideoId = "nRPF5QHzFxU";
  coverVideoTitle(language: Language): string {
    return siteData[language].coverVideoTitle;
  }
}

export default new Site();
