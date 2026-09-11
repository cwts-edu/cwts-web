import { content, type DegreesWidgetDataItem } from "./content";
import type { Language } from "./language";

export type { DegreesWidgetDataItem };

export default async function getDegreesWidgetData(
  language: Language
): Promise<DegreesWidgetDataItem[]> {
  return content.degreesWidget.getData(language);
}
