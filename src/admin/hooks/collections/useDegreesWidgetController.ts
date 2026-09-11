import { useState, useEffect, useCallback, useMemo } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../../config/firebase";
import { useDraft } from "../../context/DraftContext";
import type { DegreesWidgetItem } from "../../views/DegreesWidgetListView";
import type { DegreesWidgetMetadata, Language } from "../../../libs/content/schemas";

export function useDegreesWidgetController(isActive: boolean, onNavigate?: (tab: any, param?: string) => void) {
  const { pendingChanges, saveChangeToDraft, discardDraftChange } = useDraft();
  const [degreesWidget, setDegreesWidget] = useState<DegreesWidgetItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  const loadDegreesWidget = useCallback(async () => {
    setIsLoading(true);
    try {
      const snap = await getDocs(collection(db, "degrees-widget"));
      const loaded: DegreesWidgetItem[] = [];
      snap.forEach((d) => {
        const val = d.data();
        if (val.status === "deleted") return;
        const lang = (val.language || d.id.split("_")[0] || "zh") as Language;
        const cardType = val.type || d.id.split("_")[1] || "master";
        loaded.push({
          id: d.id,
          language: lang,
          type: cardType,
          data: {
            title: val.title || d.id,
            order: val.order ?? 0,
            url: val.url,
            programs: val.programs || [],
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
      setDegreesWidget(loaded);
      setIsLoaded(true);
    } catch (err) {
      console.warn("Could not load degrees-widget from Firestore:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isActive && !isLoaded && !isLoading) {
      loadDegreesWidget();
    }
  }, [isActive, isLoaded, isLoading, loadDegreesWidget]);

  const saveDraft = async (
    docId: string,
    language: Language,
    type: string,
    data: DegreesWidgetMetadata,
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
    await saveChangeToDraft("degrees-widget", docId, "update", payload, body);
    if (onNavigate) onNavigate("homepage_degrees");
  };

  const deleteItem = async (id: string) => {
    await saveChangeToDraft("degrees-widget", id, "delete");
  };

  const undoDelete = async (id: string) => {
    await discardDraftChange("degrees-widget", id);
  };

  const reorderItems = async (reorderedIds: string[]) => {
    const orderMap: Record<string, number> = {};
    reorderedIds.forEach((id, index) => {
      orderMap[id] = index + 1;
    });

    await saveChangeToDraft("degrees-widget", "_order", "update", {
      title: "Degrees Widget Ordering",
      orderMap,
    });
  };

  const mergedItems = useMemo(() => {
    const draftChanges = pendingChanges.filter((p) => p.collection === "degrees-widget");
    const map = new Map<string, DegreesWidgetItem>();
    degreesWidget.forEach((d) => map.set(d.id, { ...d }));

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
        const cardType = rawData?.type || existing?.type || draft.documentId.split("_")[1] || "master";
        const normalizedData: DegreesWidgetMetadata = {
          title: rawData?.title || existing?.data?.title || draft.documentId,
          order: rawData?.order ?? existing?.data?.order ?? 0,
          url: rawData?.url ?? existing?.data?.url,
          programs: rawData?.programs ?? existing?.data?.programs ?? [],
        };

        map.set(draft.documentId, {
          id: draft.documentId,
          language: lang,
          type: cardType,
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

    const degreesOrderDraft = draftChanges.find((p) => p.documentId === "_order");
    if (degreesOrderDraft?.data?.orderMap) {
      for (const [id, newOrder] of Object.entries(degreesOrderDraft.data.orderMap)) {
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

    return Array.from(map.values()).filter((d) => d.id !== "_order");
  }, [degreesWidget, pendingChanges]);

  return {
    items: mergedItems,
    isLoading,
    saveDraft,
    deleteItem,
    undoDelete,
    reorderItems,
    reload: loadDegreesWidget,
  };
}
