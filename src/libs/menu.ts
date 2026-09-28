import { content } from "./content";
import type { Language } from "./language";
import type { MenuItem } from "./content/schemas";

export type { MenuItem };

export default async function getMenu(language: Language): Promise<MenuItem[]> {
  return content.menu.get(language);
}
