import { content } from "./content";
import type { Language } from "./language";
import type { ShortcutItem } from "./content/schemas";

export type Shortcut = ShortcutItem;

const shortcuts = {
  zh: await content.shortcuts.get("zh"),
  en: await content.shortcuts.get("en"),
};

export default function getShortcuts(language: Language): Shortcut[] {
  return shortcuts[language];
}
