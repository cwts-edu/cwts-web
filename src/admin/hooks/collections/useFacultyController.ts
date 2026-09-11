import { useState, useEffect, useCallback, useMemo } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../../config/firebase";
import { useDraft } from "../../context/DraftContext";
import type { UnifiedFacultyItem } from "../../views/FacultyListView";

export function useFacultyController(isActive: boolean, onNavigate?: (tab: any, param?: string) => void) {
  const { pendingChanges, saveChangeToDraft } = useDraft();
  const [faculty, setFaculty] = useState<UnifiedFacultyItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  const loadFaculty = useCallback(async () => {
    setIsLoading(true);
    try {
      const snap = await getDocs(collection(db, "faculty"));
      const loaded: UnifiedFacultyItem[] = [];
      snap.forEach((d) => {
        const val = d.data();
        if (val.status === "deleted" || d.id === "_order") return;
        loaded.push({
          id: d.id,
          category: val.category || "faculty",
          order: val.order ?? 0,
          photo: val.photo,
          email: val.email,
          zh: val.zh || { name: d.id, title: "", bio: "" },
          en: val.en || { name: d.id, title: "", bio: "" },
          status: val.status || "published",
          version: val.version || 1,
          publishedVersion: val.publishedVersion || 1,
          updatedBy: val.updatedBy,
          publishedBy: val.publishedBy,
          createdAt: val.createdAt,
          updatedAt: val.updatedAt,
        });
      });
      setFaculty(loaded);
      setIsLoaded(true);
    } catch (err) {
      console.warn("Could not load faculty from Firestore:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isActive && !isLoaded && !isLoading) {
      loadFaculty();
    }
  }, [isActive, isLoaded, isLoading, loadFaculty]);

  const saveDraft = async (
    docId: string,
    facultyData: Partial<UnifiedFacultyItem>,
    bodyJson?: any,
    bodyHtml?: string
  ) => {
    await saveChangeToDraft("faculty", docId, "update", { ...facultyData, bodyJson, bodyHtml });
    if (onNavigate) onNavigate("faculty");
  };

  const deleteItem = async (id: string) => {
    await saveChangeToDraft("faculty", id, "delete");
  };

  const mergedItems = useMemo(() => {
    const draftChanges = pendingChanges.filter((p) => p.collection === "faculty");
    const map = new Map<string, UnifiedFacultyItem>();
    faculty.forEach((f) => map.set(f.id, { ...f }));

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
        map.set(draft.documentId, {
          id: draft.documentId,
          category: draft.data?.category || existing?.category || "faculty",
          order: draft.data?.order ?? existing?.order ?? 0,
          photo: draft.data?.photo ?? existing?.photo,
          email: draft.data?.email ?? existing?.email,
          zh: draft.data?.zh || existing?.zh || { name: draft.documentId, title: "", bio: "" },
          en: draft.data?.en || existing?.en || { name: draft.documentId, title: "", bio: "" },
          draftData: draft.data,
          status: "draft",
          updatedBy: draft.updatedBy,
          version: existing ? (existing.version || 1) + 1 : 1,
          publishedVersion: existing?.publishedVersion,
        });
      }
    }

    const orderDraft = draftChanges.find((p) => p.documentId === "_order");
    if (orderDraft?.data?.orderMap) {
      for (const [id, newOrder] of Object.entries(orderDraft.data.orderMap)) {
        const item = map.get(id);
        if (item) {
          map.set(id, { ...item, order: Number(newOrder) });
        }
      }
    }

    return Array.from(map.values()).filter((f) => f.id !== "_order");
  }, [faculty, pendingChanges]);

  return {
    items: mergedItems,
    isLoading,
    saveDraft,
    deleteItem,
    reload: loadFaculty,
  };
}
