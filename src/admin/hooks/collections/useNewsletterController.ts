import { useState, useEffect, useCallback, useMemo } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../../config/firebase";
import { useDraft } from "../../context/DraftContext";
import type { NewsletterMetadata } from "../../../libs/content/schemas";
import { sortNewsletters } from "../../../libs/content/newsletterUtils";

export interface NewsletterItem {
  id: string;
  data: NewsletterMetadata;
  draftData?: NewsletterMetadata;
  status: "published" | "draft" | "deleted";
  version?: number;
  publishedVersion?: number;
  updatedBy?: any;
  publishedBy?: any;
}

export function useNewsletterController(
  isActive: boolean,
  onNavigate?: (tab: any, param?: string) => void
) {
  const { pendingChanges, saveChangeToDraft, discardDraftChange } = useDraft();
  const [newsletterItems, setNewsletterItems] = useState<NewsletterItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  const loadNewsletters = useCallback(async () => {
    setIsLoading(true);
    try {
      const snap = await getDocs(collection(db, "newsletter"));
      const loaded: NewsletterItem[] = [];
      snap.forEach((d) => {
        const val = d.data();
        if (val.status === "deleted") return;

        const tableData: NewsletterMetadata = {
          title: val.title || d.id,
          year: typeof val.year === "number" ? val.year : new Date().getFullYear(),
          issue: typeof val.issue === "number" ? val.issue : 1,
          issueLetter: val.issueLetter,
          pdfPath: val.pdfPath || "",
          coverImage: val.coverImage || "",
          publishDate: val.publishDate,
          referencedAssets: val.referencedAssets || [],
        };

        loaded.push({
          id: d.id,
          data: tableData,
          status: val.status || "published",
          version: val.version || 1,
          publishedVersion: val.publishedVersion || 1,
          updatedBy: val.updatedBy,
          publishedBy: val.publishedBy,
        });
      });

      setNewsletterItems(sortNewsletters(loaded, "asc"));
      setIsLoaded(true);
    } catch (err) {
      console.warn("Could not load newsletters from Firestore:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isActive && !isLoaded && !isLoading) {
      loadNewsletters();
    }
  }, [isActive, isLoaded, isLoading, loadNewsletters]);

  const saveDraft = async (docId: string, data: NewsletterMetadata) => {
    await saveChangeToDraft("newsletter", docId, "update", data);
    if (onNavigate) onNavigate("newsletter");
  };

  const deleteItem = async (id: string) => {
    await saveChangeToDraft("newsletter", id, "delete");
  };

  const undoDelete = async (id: string) => {
    await discardDraftChange("newsletter", id);
  };

  const mergedItems = useMemo(() => {
    const draftChanges = pendingChanges.filter((p) => p.collection === "newsletter");
    const map = new Map<string, NewsletterItem>();
    newsletterItems.forEach((t) => map.set(t.id, { ...t }));

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
        const normalizedData: NewsletterMetadata = {
          title: rawData?.title || existing?.data?.title || draft.documentId,
          year: typeof rawData?.year === "number" ? rawData.year : existing?.data?.year || new Date().getFullYear(),
          issue: typeof rawData?.issue === "number" ? rawData.issue : existing?.data?.issue || 1,
          issueLetter: rawData?.issueLetter || existing?.data?.issueLetter,
          pdfPath: rawData?.pdfPath || existing?.data?.pdfPath || "",
          coverImage: rawData?.coverImage || existing?.data?.coverImage || "",
          publishDate: rawData?.publishDate || existing?.data?.publishDate,
          referencedAssets: rawData?.referencedAssets || existing?.data?.referencedAssets || [],
        };

        map.set(draft.documentId, {
          id: draft.documentId,
          data: normalizedData,
          draftData: normalizedData,
          status: "draft",
          updatedBy: draft.updatedBy,
          version: existing ? (existing.version || 1) + 1 : 1,
          publishedVersion: existing?.publishedVersion,
        });
      }
    }

    const result = Array.from(map.values());
    return sortNewsletters(result, "asc");
  }, [newsletterItems, pendingChanges]);

  return {
    items: mergedItems,
    isLoading,
    saveDraft,
    deleteItem,
    undoDelete,
    reload: loadNewsletters,
  };
}
