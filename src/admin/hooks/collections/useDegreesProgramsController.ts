import { useState, useEffect, useCallback, useMemo } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../../config/firebase";
import { useDraft } from "../../context/DraftContext";
import type { DegreeProgramItem } from "../../views/DegreesProgramsListView";
import type { DegreeProgramMetadata } from "../../../libs/content/schemas";

export const DEGREE_CATEGORY_BASE_ORDER: Record<string, number> = {
  doctor: 100,
  master: 200,
  diploma: 300,
  certificate: 400,
};

export function useDegreesProgramsController(isActive: boolean, onNavigate?: (tab: any, param?: string) => void) {
  const { pendingChanges, saveChangeToDraft, discardDraftChange } = useDraft();
  const [programs, setPrograms] = useState<DegreeProgramItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  const loadPrograms = useCallback(async () => {
    setIsLoading(true);
    try {
      const snap = await getDocs(collection(db, "degrees-programs"));
      const loaded: DegreeProgramItem[] = [];
      snap.forEach((d) => {
        const val = d.data();
        if (val.status === "deleted") return;
        const category = val.category || "master";
        const baseOrder = DEGREE_CATEGORY_BASE_ORDER[category] || 200;
        const inCategoryOrder = val.inCategoryOrder ?? ((Number(val.order) % 100) || 1);
        const order = Number(val.order ?? (baseOrder + inCategoryOrder));

        loaded.push({
          id: d.id,
          slug: val.slug || d.id,
          language: val.language || "zh",
          data: {
            title: val.title || d.id,
            subTitle: val.subTitle,
            order,
            inCategoryOrder,
            thumbnail: val.thumbnail,
            length: val.length,
            credits: Number(val.credits ?? 0),
            category,
            redirect: val.redirect,
            referencedAssets: val.referencedAssets || [],
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
      setPrograms(loaded);
      setIsLoaded(true);
    } catch (err) {
      console.warn("Could not load degrees-programs from Firestore:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isActive && !isLoaded && !isLoading) {
      loadPrograms();
    }
  }, [isActive, isLoaded, isLoading, loadPrograms]);

  const saveDraft = async (
    docId: string,
    data: Omit<DegreeProgramMetadata, "order" | "inCategoryOrder"> & { order?: number; inCategoryOrder?: number },
    body: string,
    bodyJson?: any,
    bodyHtml?: string
  ) => {
    const existing = programs.find((p) => p.id === docId);
    const category = data.category || "master";
    const baseOrder = DEGREE_CATEGORY_BASE_ORDER[category] || 200;

    let inCategoryOrder = data.inCategoryOrder;
    let order = data.order;

    if (inCategoryOrder === undefined || !existing || existing.data.category !== category) {
      const sameCatItems = programs.filter(
        (p) => p.data.category === category && p.id !== docId && p.status !== "deleted"
      );
      inCategoryOrder = sameCatItems.length + 1;
      order = baseOrder + inCategoryOrder;
    }

    if (order === undefined) {
      order = baseOrder + (inCategoryOrder || 1);
    }

    const payload = {
      ...data,
      order,
      inCategoryOrder,
      slug: docId,
      language: "zh",
      bodyJson,
      bodyHtml,
    };
    await saveChangeToDraft("degrees-programs", docId, "update", payload, body);
    if (onNavigate) onNavigate("degrees_programs");
  };

  const deleteItem = async (id: string) => {
    await saveChangeToDraft("degrees-programs", id, "delete");
  };

  const undoDelete = async (id: string) => {
    await discardDraftChange("degrees-programs", id);
  };

  const reorderItems = async (reorderedIds: string[]) => {
    if (reorderedIds.length === 0) return;
    const firstItem = programs.find((p) => p.id === reorderedIds[0]);
    const category = firstItem?.data?.category || "master";
    const baseOrder = DEGREE_CATEGORY_BASE_ORDER[category] || 200;
    const orderMap: Record<string, number> = {};
    const inCategoryOrderMap: Record<string, number> = {};

    reorderedIds.forEach((id, index) => {
      const inCatOrder = index + 1;
      const fullOrder = baseOrder + inCatOrder;
      orderMap[id] = fullOrder;
      inCategoryOrderMap[id] = inCatOrder;
    });

    await saveChangeToDraft("degrees-programs", "_order", "update", {
      title: `Degrees & Programs Ordering (${category})`,
      category,
      orderMap,
      inCategoryOrderMap,
    });
  };

  const mergedItems = useMemo(() => {
    const draftChanges = pendingChanges.filter((p) => p.collection === "degrees-programs");
    const map = new Map<string, DegreeProgramItem>();
    programs.forEach((p) => map.set(p.id, { ...p }));

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
        const category = rawData?.category || existing?.data?.category || "master";
        const baseOrder = DEGREE_CATEGORY_BASE_ORDER[category] || 200;
        const inCategoryOrder = Number(rawData?.inCategoryOrder ?? existing?.data?.inCategoryOrder ?? 1);
        const order = Number(rawData?.order ?? existing?.data?.order ?? (baseOrder + inCategoryOrder));

        const normalizedData: DegreeProgramMetadata = {
          title: rawData?.title || existing?.data?.title || draft.documentId,
          subTitle: rawData?.subTitle ?? existing?.data?.subTitle,
          order,
          inCategoryOrder,
          thumbnail: rawData?.thumbnail ?? existing?.data?.thumbnail,
          length: rawData?.length ?? existing?.data?.length,
          credits: Number(rawData?.credits ?? existing?.data?.credits ?? 0),
          category,
          redirect: rawData?.redirect ?? existing?.data?.redirect,
          referencedAssets: rawData?.referencedAssets ?? existing?.data?.referencedAssets ?? [],
        };

        map.set(draft.documentId, {
          id: draft.documentId,
          slug: draft.documentId,
          language: "zh",
          data: normalizedData,
          draftData: normalizedData,
          body: draft.body ?? existing?.body ?? "",
          draftBody: draft.body,
          bodyHtml: rawData?.bodyHtml ?? existing?.bodyHtml ?? "",
          bodyJson: rawData?.bodyJson ?? existing?.bodyJson ?? null,
          status: "draft",
          updatedBy: draft.updatedBy,
          version: existing ? (existing.version || 1) + 1 : 1,
          publishedVersion: existing?.publishedVersion,
        });
      }
    }

    // Apply order overlay
    const orderDrafts = draftChanges.filter((p) => p.documentId === "_order");
    for (const orderDraft of orderDrafts) {
      const orderMap = (orderDraft.data as any)?.orderMap;
      const inCatMap = (orderDraft.data as any)?.inCategoryOrderMap;
      if (orderMap) {
        for (const [id, newOrder] of Object.entries(orderMap)) {
          const item = map.get(id);
          if (item) {
            item.data.order = Number(newOrder);
            if (item.draftData) item.draftData.order = Number(newOrder);
            if (inCatMap && inCatMap[id] !== undefined) {
              item.data.inCategoryOrder = Number(inCatMap[id]);
              if (item.draftData) item.draftData.inCategoryOrder = Number(inCatMap[id]);
            }
          }
        }
      }
    }

    return Array.from(map.values()).sort(
      (a, b) => (a.draftData || a.data).order - (b.draftData || b.data).order
    );
  }, [programs, pendingChanges]);

  return {
    items: mergedItems,
    isLoading,
    saveDraft,
    deleteItem,
    undoDelete,
    reorderItems,
    reload: loadPrograms,
  };
}
