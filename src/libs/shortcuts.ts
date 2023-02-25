import shortcuts from "@data/shortcuts.yml";
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

export default function getShortcuts(language: Language): Shortcut[] {
  return (shortcuts as ShortcutData)[language];
}
