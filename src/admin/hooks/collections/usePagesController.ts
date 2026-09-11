import { useState, useEffect, useCallback, useMemo } from "react";
import { collection, getDocs, doc, updateDoc } from "firebase/firestore";
import { db } from "../../config/firebase";
import { useDraft } from "../../context/DraftContext";
import type { PageItem } from "../../views/PagesListView";
import type { PageMetadata } from "../../../libs/content/schemas";

export function usePagesController(
  isActive: boolean,
  onNavigate?: (tab: any, param?: string) => void
) {
  const { pendingChanges, saveChangeToDraft, discardDraftChange } = useDraft();
  const [pages, setPages] = useState<PageItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  const loadPages = useCallback(async () => {
    setIsLoading(true);
    try {
      const snap = await getDocs(collection(db, "pages"));
      const loaded: PageItem[] = [];
      snap.forEach((d) => {
        const val = d.data();
        if (val.status === "deleted") return;

        const lang = val.language || (d.id.startsWith("en_") ? "en" : "zh");
        const defaultSlug = d.id.replace(/^[a-z]{2}_/, "").replace(/_/g, "/");
        const slug = val.slug !== undefined ? val.slug : defaultSlug;

        loaded.push({
          id: d.id,
          slug,
          language: lang,
          data: {
            title: val.title || slug,
            subTitle: val.subTitle,
            order: typeof val.order === "number" ? val.order : 1,
            coverImage: val.coverImage,
            thumbnail: val.thumbnail,
            showChildren: val.showChildren,
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
      setPages(loaded);
      setIsLoaded(true);
    } catch (err) {
      console.warn("Could not load pages from Firestore:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isActive && !isLoaded && !isLoading) {
      loadPages();
    }
  }, [isActive, isLoaded, isLoading, loadPages]);

  // Merge Firestore items with active draft changes
  const items = useMemo(() => {
    const pageChanges = pendingChanges.filter((c) => c.collection === "pages");
    if (pageChanges.length === 0) return pages;

    const map = new Map<string, PageItem>();
    pages.forEach((p) => map.set(p.id, { ...p }));

    pageChanges.forEach((c) => {
      const existing = map.get(c.documentId);
      if (c.operation === "delete") {
        if (existing) {
          existing.status = "deleted";
        }
      } else if (c.operation === "create" || c.operation === "update") {
        const lang = c.data?.language || (c.documentId.startsWith("en_") ? "en" : "zh");
        const slug = c.data?.slug || c.documentId.replace(/^[a-z]{2}_/, "").replace(/_/g, "/");

        const updated: PageItem = {
          id: c.documentId,
          slug,
          language: lang,
          data: existing?.data || {
            title: c.data?.title || slug,
            order: c.data?.order ?? 1,
          },
          draftData: {
            title: c.data?.title || slug,
            subTitle: c.data?.subTitle,
            order: typeof c.data?.order === "number" ? c.data?.order : 1,
            coverImage: c.data?.coverImage,
            thumbnail: c.data?.thumbnail,
            showChildren: c.data?.showChildren,
          },
          body: existing?.body || "",
          draftBody: c.body || "",
          bodyHtml: c.data?.bodyHtml || existing?.bodyHtml || "",
          bodyJson: c.data?.bodyJson || existing?.bodyJson || null,
          status: "draft",
          version: (existing?.version || 0) + 1,
          publishedVersion: existing?.publishedVersion || 1,
        };
        map.set(c.documentId, updated);
      }
    });

    return Array.from(map.values());
  }, [pages, pendingChanges]);

  const saveDraft = async (
    docId: string,
    data: PageMetadata,
    body: string,
    bodyJson?: any,
    bodyHtml?: string
  ) => {
    const lang = docId.startsWith("en_") ? "en" : "zh";
    const slug = docId.replace(/^[a-z]{2}_/, "").replace(/_/g, "/");

    await saveChangeToDraft(
      "pages",
      docId,
      "update",
      {
        ...data,
        slug,
        language: lang,
        bodyJson,
        bodyHtml,
      },
      body
    );
    if (onNavigate) {
      onNavigate("pages");
    }
  };

  const deletePage = async (docId: string) => {
    await saveChangeToDraft("pages", docId, "delete", null);
  };

  const undoDelete = async (docId: string) => {
    await discardDraftChange("pages", docId);
  };

  const updateSiblingOrder = async (docId: string, newOrder: number) => {
    const current = items.find((p) => p.id === docId);
    if (!current) return;

    const data: PageMetadata = {
      ...(current.draftData || current.data),
      order: Math.max(1, newOrder),
    };

    await saveChangeToDraft(
      "pages",
      docId,
      "update",
      {
        ...data,
        slug: current.slug,
        language: current.language,
        bodyHtml: current.bodyHtml,
        bodyJson: current.bodyJson,
      },
      current.draftBody || current.body || ""
    );
  };

  return {
    items,
    isLoading,
    saveDraft,
    deletePage,
    undoDelete,
    updateSiblingOrder,
    reload: loadPages,
  };
}
