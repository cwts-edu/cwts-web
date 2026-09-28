import { content, type StudyModeWidgetDataItem } from "./content";
import type { Language } from "./language";

export type { StudyModeWidgetDataItem };

export default async function getStudyModeWidgetData(
  language: Language
): Promise<StudyModeWidgetDataItem[]> {
  return content.studyModeWidget.getData(language);
}
