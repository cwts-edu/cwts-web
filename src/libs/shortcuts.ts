import { getEntry } from "astro:content";
import type { Language } from "./language";

export interface Shortcut {
  name: string;
  url: string;
  type?: string;
  breakBefore?: boolean;
}

type ShortcutData = {
  [language in Language]: Shortcut[];
};

const shortcutsEntry = await getEntry("shortcuts", "shortcuts");
if (!shortcutsEntry) {
  throw new Error(
    "Shortcuts data file 'shortcuts.yml' not found in the 'shortcuts' collection. This file is required.",
  );
}

const shortcuts = shortcutsEntry.data;

export default function getShortcuts(language: Language): Shortcut[] {
  return (shortcuts as ShortcutData)[language];
}
