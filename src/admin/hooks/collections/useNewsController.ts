import { useState, useEffect, useCallback, useMemo } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../../config/firebase";
import { useDraft } from "../../context/DraftContext";
import type { NewsItem } from "../../views/NewsListView";
import type { NewsMetadata } from "../../../libs/content/schemas";

export function useNewsController(isActive: boolean, onNavigate?: (tab: any, param?: string) => void) {
  const { pendingChanges, saveChangeToDraft, discardDraftChange } = useDraft();
  const [news, setNews] = useState<NewsItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  const loadNews = useCallback(async () => {
    setIsLoading(true);
    try {
      const snap = await getDocs(collection(db, "news"));
      const loaded: NewsItem[] = [];
      snap.forEach((d) => {
        const val = d.data();
        if (val.status === "deleted") return;
        loaded.push({
          id: d.id,
          data: {
            title: val.title,
            date: val.date?.toDate ? val.date.toDate() : new Date(val.date),
            thumbnail: val.thumbnail,
            url: val.url,
          },
          body: val.body || "",
          status: val.status || "published",
          version: val.version || 1,
          publishedVersion: val.publishedVersion || 1,
          updatedBy: val.updatedBy,
          publishedBy: val.publishedBy,
        });
      });
      setNews(loaded);
      setIsLoaded(true);
    } catch (err) {
      console.warn("Could not load news from Firestore:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isActive && !isLoaded && !isLoading) {
      loadNews();
    }
  }, [isActive, isLoaded, isLoading, loadNews]);

  const saveDraft = async (
    docId: string,
    data: NewsMetadata,
    body: string,
    bodyJson?: any,
    bodyHtml?: string
  ) => {
    await saveChangeToDraft("news", docId, "update", { ...data, bodyJson, bodyHtml }, body);
    if (onNavigate) onNavigate("news");
  };

  const deleteItem = async (id: string) => {
    await saveChangeToDraft("news", id, "delete");
  };

  const undoDelete = async (id: string) => {
    await discardDraftChange("news", id);
  };

  const mergedItems = useMemo(() => {
    const draftChanges = pendingChanges.filter((p) => p.collection === "news");
    const map = new Map<string, NewsItem>();
    news.forEach((n) => map.set(n.id, { ...n }));

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
        const rawData = draft.data as any;
        const normalizedData: NewsMetadata = {
          title: rawData?.title || existing?.data?.title || draft.documentId,
          date: rawData?.date ? new Date(rawData.date) : existing?.data?.date || new Date(),
          thumbnail: rawData?.thumbnail || existing?.data?.thumbnail || "",
          url: rawData?.url || existing?.data?.url || "",
        };

        map.set(draft.documentId, {
          id: draft.documentId,
          data: normalizedData,
          draftData: normalizedData,
          body: draft.body ?? existing?.body ?? "",
          draftBody: draft.body,
          status: "draft",
          updatedBy: draft.updatedBy,
          version: existing ? (existing.version || 1) + 1 : 1,
          publishedVersion: existing?.publishedVersion,
        });
      }
    }
    return Array.from(map.values());
  }, [news, pendingChanges]);

  return {
    items: mergedItems,
    isLoading,
    saveDraft,
    deleteItem,
    undoDelete,
    reload: loadNews,
  };
}
