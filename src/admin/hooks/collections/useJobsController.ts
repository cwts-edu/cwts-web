import { useState, useEffect, useCallback, useMemo } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../../config/firebase";
import { useDraft } from "../../context/DraftContext";
import type { JobItem } from "../../views/JobsListView";
import type { JobMetadata } from "../../../libs/content/schemas";

export function useJobsController(isActive: boolean, onNavigate?: (tab: any, param?: string) => void) {
  const { pendingChanges, saveChangeToDraft, discardDraftChange } = useDraft();
  const [jobs, setJobs] = useState<JobItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  const loadJobs = useCallback(async () => {
    setIsLoading(true);
    try {
      const snap = await getDocs(collection(db, "jobs"));
      const loaded: JobItem[] = [];
      snap.forEach((d) => {
        const val = d.data();
        if (val.status === "deleted") return;
        loaded.push({
          id: d.id,
          data: {
            title: val.title,
            location: val.location,
            date: val.date?.toDate ? val.date.toDate() : new Date(val.date),
            ...(val.file ? { file: val.file } : {}),
          },
          body: val.body || "",
          status: val.status || "published",
          version: val.version || 1,
          publishedVersion: val.publishedVersion || 1,
          updatedBy: val.updatedBy,
          publishedBy: val.publishedBy,
        });
      });
      setJobs(loaded);
      setIsLoaded(true);
    } catch (err) {
      console.warn("Could not load jobs from Firestore:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isActive && !isLoaded && !isLoading) {
      loadJobs();
    }
  }, [isActive, isLoaded, isLoading, loadJobs]);

  const saveDraft = async (
    docId: string,
    data: JobMetadata,
    body: string,
    bodyJson?: any,
    bodyHtml?: string
  ) => {
    await saveChangeToDraft("jobs", docId, "update", { ...data, bodyJson, bodyHtml }, body);
    if (onNavigate) onNavigate("jobs");
  };

  const deleteItem = async (id: string) => {
    await saveChangeToDraft("jobs", id, "delete");
  };

  const undoDelete = async (id: string) => {
    await discardDraftChange("jobs", id);
  };

  const mergedItems = useMemo(() => {
    const draftChanges = pendingChanges.filter((p) => p.collection === "jobs");
    const map = new Map<string, JobItem>();
    jobs.forEach((j) => map.set(j.id, { ...j }));

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
        const normalizedData: JobMetadata = {
          title: rawData?.title || existing?.data?.title || draft.documentId,
          location: rawData?.location || existing?.data?.location || "",
          date: rawData?.date ? new Date(rawData.date) : existing?.data?.date || new Date(),
          file: rawData?.file || existing?.data?.file,
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
  }, [jobs, pendingChanges]);

  return {
    items: mergedItems,
    isLoading,
    saveDraft,
    deleteItem,
    undoDelete,
    reload: loadJobs,
  };
}
