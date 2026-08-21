import { useState, useEffect, useCallback, useMemo } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../../config/firebase";
import { useDraft } from "../../context/DraftContext";
import type { CarouselSlideItem } from "../../views/CarouselListView";
import type { CarouselItem } from "../../../libs/content/schemas";

export function useCarouselController(isActive: boolean, onNavigate?: (tab: any, param?: string) => void) {
  const { pendingChanges, saveChangeToDraft, discardDraftChange } = useDraft();
  const [carousel, setCarousel] = useState<CarouselSlideItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  const loadCarousel = useCallback(async () => {
    setIsLoading(true);
    try {
      const snap = await getDocs(collection(db, "carousel"));
      const loaded: CarouselSlideItem[] = [];
      snap.forEach((d) => {
        const val = d.data();
        if (val.status === "deleted") return;
        loaded.push({
          id: d.id,
          order: val.order ?? 999,
          image: val.image,
          link: val.link,
          newWindow: val.newWindow,
          status: val.status || "published",
          version: val.version || 1,
          publishedVersion: val.publishedVersion || 1,
          updatedBy: val.updatedBy,
          publishedBy: val.publishedBy,
          createdAt: val.createdAt,
          updatedAt: val.updatedAt,
        });
      });
      setCarousel(loaded);
      setIsLoaded(true);
    } catch (err) {
      console.warn("Could not load carousel from Firestore:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isActive && !isLoaded && !isLoading) {
      loadCarousel();
    }
  }, [isActive, isLoaded, isLoading, loadCarousel]);

  const saveDraft = async (docId: string, data: CarouselItem) => {
    await saveChangeToDraft("carousel", docId, "update", data);
    if (onNavigate) onNavigate("homepage_carousel");
  };

  const deleteItem = async (id: string) => {
    await saveChangeToDraft("carousel", id, "delete");
  };

  const undoDelete = async (id: string) => {
    await discardDraftChange("carousel", id);
  };

  const reorderItems = async (reorderedIds: string[]) => {
    const promises = reorderedIds.map((id, index) => {
      const existing = carousel.find((c) => c.id === id);
      const updatedData: CarouselItem = {
        order: index + 1,
        image: existing?.image || "",
        link: existing?.link,
        newWindow: existing?.newWindow,
      };
      return saveChangeToDraft("carousel", id, "update", updatedData);
    });
    await Promise.all(promises);
  };

  const mergedItems = useMemo(() => {
    const draftChanges = pendingChanges.filter((p) => p.collection === "carousel");
    const map = new Map<string, CarouselSlideItem>();
    carousel.forEach((c) => map.set(c.id, { ...c }));

    for (const draft of draftChanges) {
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
        map.set(draft.documentId, {
          id: draft.documentId,
          order: draft.data?.order ?? existing?.order ?? 999,
          image: draft.data?.image ?? existing?.image ?? "",
          link: draft.data?.link ?? existing?.link,
          newWindow: draft.data?.newWindow ?? existing?.newWindow,
          draftData: draft.data,
          status: "draft",
          updatedBy: draft.updatedBy,
          version: existing ? (existing.version || 1) + 1 : 1,
          publishedVersion: existing?.publishedVersion,
        });
      }
    }
    return Array.from(map.values());
  }, [carousel, pendingChanges]);

  return {
    items: mergedItems,
    isLoading,
    saveDraft,
    deleteItem,
    undoDelete,
    reorderItems,
    reload: loadCarousel,
  };
}
