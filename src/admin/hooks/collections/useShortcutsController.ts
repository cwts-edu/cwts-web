import { useState, useEffect, useCallback } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../../config/firebase";
import type { ShortcutsData } from "../../../libs/content/schemas";

const DEFAULT_SHORTCUTS: ShortcutsData = {
  zh: [
    { name: "奉獻支持", url: "/zh/donation" },
    { name: "聯絡我們", url: "/zh/contact" },
    { name: "申請入學", url: "/zh/admissions/application-procedure", type: "button", breakBefore: true },
  ],
  en: [
    { name: "Give", url: "/en/donation" },
    { name: "Contact", url: "/en/contact" },
    { name: "Apply", url: "/en/academic/degrees-programs", type: "button", breakBefore: true },
  ],
};

export function useShortcutsController(isActive: boolean) {
  const [shortcuts, setShortcuts] = useState<ShortcutsData>(DEFAULT_SHORTCUTS);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  const loadShortcuts = useCallback(async () => {
    setIsLoading(true);
    try {
      const snap = await getDocs(collection(db, "shortcuts"));
      let loaded: ShortcutsData = { zh: [], en: [] };
      snap.forEach((d) => {
        const val = d.data();
        if (d.id === "shortcuts") {
          loaded.zh = val.zh || loaded.zh;
          loaded.en = val.en || loaded.en;
        } else if (d.id === "zh") {
          loaded.zh = val.items || val.zh || (Array.isArray(val) ? val : loaded.zh);
        } else if (d.id === "en") {
          loaded.en = val.items || val.en || (Array.isArray(val) ? val : loaded.en);
        }
      });

      if (loaded.zh.length === 0 && loaded.en.length === 0) {
        loaded = DEFAULT_SHORTCUTS;
      }

      setShortcuts(loaded);
      setIsLoaded(true);
    } catch (err) {
      console.warn("Could not load shortcuts from Firestore:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isActive && !isLoaded && !isLoading) {
      loadShortcuts();
    }
  }, [isActive, isLoaded, isLoading, loadShortcuts]);

  return {
    data: shortcuts,
    isLoading,
    reload: loadShortcuts,
  };
}
