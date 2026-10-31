import { useState, useEffect, useCallback } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../../config/firebase";
import type { MenuItem } from "../../../libs/content/schemas";

export interface MenuData {
  zh: MenuItem[];
  en: MenuItem[];
}

export const DEFAULT_MENU: MenuData = {
  zh: [
    { page: "zh/about", noUrl: true, includeChildren: true },
    { page: "zh/academic", noUrl: true, includeChildren: true },
    {
      page: "zh/admissions",
      noUrl: true,
      children: [
        { page: "zh/admissions/application-procedure", includeChildren: true },
        { page: "zh/admissions/international" },
        { page: "zh/admissions/tuition-scholarship" },
      ],
    },
    { page: "zh/student-life", noUrl: true, includeChildren: true },
    { page: "zh/ministry-institute", noUrl: true, includeChildren: true },
    { page: "zh/news-events", noUrl: true, includeChildren: true },
  ],
  en: [
    { page: "en/about", noUrl: true, includeChildren: true },
    {
      page: "en/academic",
      noUrl: true,
      children: [
        { page: "en/academic/degrees-programs", includeChildren: true },
        { page: "en/academic/catalog" },
        { page: "en/academic/faculty" },
      ],
    },
  ],
};

export function useMenuController(isActive: boolean) {
  const [menu, setMenu] = useState<MenuData>(DEFAULT_MENU);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  const loadMenu = useCallback(async () => {
    setIsLoading(true);
    try {
      const snap = await getDocs(collection(db, "menu"));
      let loaded: MenuData = { zh: [], en: [] };

      snap.forEach((d) => {
        const val = d.data();
        if (d.id === "zh") {
          loaded.zh = val.items || (Array.isArray(val) ? val : loaded.zh);
        } else if (d.id === "en") {
          loaded.en = val.items || (Array.isArray(val) ? val : loaded.en);
        } else if (d.id === "menu") {
          if (val.zh) loaded.zh = val.zh.items || val.zh;
          if (val.en) loaded.en = val.en.items || val.en;
        }
      });

      if (loaded.zh.length === 0 && loaded.en.length === 0) {
        loaded = DEFAULT_MENU;
      } else {
        if (loaded.zh.length === 0) loaded.zh = DEFAULT_MENU.zh;
        if (loaded.en.length === 0) loaded.en = DEFAULT_MENU.en;
      }

      setMenu(loaded);
      setIsLoaded(true);
    } catch (err) {
      console.warn("Could not load menu from Firestore:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isActive && !isLoaded && !isLoading) {
      loadMenu();
    }
  }, [isActive, isLoaded, isLoading, loadMenu]);

  return {
    data: menu,
    isLoading,
    reload: loadMenu,
  };
}
