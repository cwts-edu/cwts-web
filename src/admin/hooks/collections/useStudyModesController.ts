import { useState, useEffect, useCallback, useMemo } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../../config/firebase";
import { useDraft } from "../../context/DraftContext";
import type { StudyModeWidgetItem } from "../../views/StudyModeWidgetListView";
import type { StudyModeWidgetMetadata, Language } from "../../../libs/content/schemas";

export function useStudyModesController(isActive: boolean, onNavigate?: (tab: any, param?: string) => void) {
  const { pendingChanges, saveChangeToDraft, discardDraftChange } = useDraft();
  const [studyModes, setStudyModes] = useState<StudyModeWidgetItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  const loadStudyModes = useCallback(async () => {
    setIsLoading(true);
    try {
      const snap = await getDocs(collection(db, "study-mode-widget"));
      const loaded: StudyModeWidgetItem[] = [];
      snap.forEach((d) => {
        const val = d.data();
        if (val.status === "deleted") return;
        const lang = (val.language || d.id.split("_")[0] || "zh") as Language;
        const modeType = val.type || d.id.split("_")[1] || "full-time";
        loaded.push({
          id: d.id,
          language: lang,
          type: modeType,
          data: {
            title: val.title || d.id,
            order: val.order ?? 0,
            url: val.url,
          },
          body: val.body || "",
          bodyHtml: val.bodyHtml || "",
          bodyJson: val.bodyJson || null,
          status: val.status || "published",
          version: val.version || 1,
          publishedVersion: val.publishedVersion || 1,
          updatedBy: val.updatedBy,
          publishedBy: val.publishedBy,
          createdAt: val.createdAt,
          updatedAt: val.updatedAt,
        });
      });
      setStudyModes(loaded);
      setIsLoaded(true);
    } catch (err) {
      console.warn("Could not load study-mode-widget from Firestore:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isActive && !isLoaded && !isLoading) {
      loadStudyModes();
    }
  }, [isActive, isLoaded, isLoading, loadStudyModes]);

  const saveDraft = async (
    docId: string,
    language: Language,
    type: string,
    data: StudyModeWidgetMetadata,
    body: string,
    bodyJson?: any,
    bodyHtml?: string
  ) => {
    const payload = {
      ...data,
      language,
      type,
      bodyJson,
      bodyHtml,
    };
    await saveChangeToDraft("study-mode-widget", docId, "update", payload, body);
    if (onNavigate) onNavigate("homepage_studymodes");
  };

  const deleteItem = async (id: string) => {
    await saveChangeToDraft("study-mode-widget", id, "delete");
  };

  const undoDelete = async (id: string) => {
    await discardDraftChange("study-mode-widget", id);
  };

  const reorderItems = async (reorderedIds: string[]) => {
    const orderMap: Record<string, number> = {};
    reorderedIds.forEach((id, index) => {
      orderMap[id] = index + 1;
    });

    await saveChangeToDraft("study-mode-widget", "_order", "update", {
      title: "Study Modes Ordering",
      orderMap,
    });
  };

  const mergedItems = useMemo(() => {
    const draftChanges = pendingChanges.filter((p) => p.collection === "study-mode-widget");
    const map = new Map<string, StudyModeWidgetItem>();
    studyModes.forEach((s) => map.set(s.id, { ...s }));

    for (const draft of draftChanges) {
      if (draft.documentId === "_order") continue;

      const existing = map.get(draft.documentId);
      if (draft.action === "delete") {
        if (existing) {
          map.set(draft.documentId, {
            ...existing,
            status: "deleted",
            updatedBy: draft.updatedBy,
          });
        }
      } else {
        const rawData = draft.data as any;
        const lang = (rawData?.language || existing?.language || draft.documentId.split("_")[0] || "zh") as Language;
        const modeType = rawData?.type || existing?.type || draft.documentId.split("_")[1] || "full-time";
        const normalizedData: StudyModeWidgetMetadata = {
          title: rawData?.title || existing?.data?.title || draft.documentId,
          order: rawData?.order ?? existing?.data?.order ?? 0,
          url: rawData?.url ?? existing?.data?.url,
        };

        map.set(draft.documentId, {
          id: draft.documentId,
          language: lang,
          type: modeType,
          data: normalizedData,
          draftData: normalizedData,
          body: draft.body ?? existing?.body ?? "",
          draftBody: draft.body,
          bodyHtml: rawData?.bodyHtml ?? existing?.bodyHtml,
          bodyJson: rawData?.bodyJson ?? existing?.bodyJson,
          status: "draft",
          updatedBy: draft.updatedBy,
          version: existing ? (existing.version || 1) + 1 : 1,
          publishedVersion: existing?.publishedVersion,
        });
      }
    }

    const studyModeOrderDraft = draftChanges.find((p) => p.documentId === "_order");
    if (studyModeOrderDraft?.data?.orderMap) {
      for (const [id, newOrder] of Object.entries(studyModeOrderDraft.data.orderMap)) {
        const item = map.get(id);
        if (item) {
          map.set(id, {
            ...item,
            data: { ...item.data, order: Number(newOrder) },
            draftData: item.draftData ? { ...item.draftData, order: Number(newOrder) } : undefined,
          });
        }
      }
    }

    return Array.from(map.values()).filter((s) => s.id !== "_order");
  }, [studyModes, pendingChanges]);

  return {
    items: mergedItems,
    isLoading,
    saveDraft,
    deleteItem,
    undoDelete,
    reorderItems,
    reload: loadStudyModes,
  };
}
