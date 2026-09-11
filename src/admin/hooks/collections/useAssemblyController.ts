import { useState, useEffect, useCallback, useMemo } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../../config/firebase";
import { useDraft } from "../../context/DraftContext";
import type { AssemblyTableMetadata } from "../../../libs/content/schemas";
import {
  renderAssemblyTableHtml,
  sortAssemblyTables,
} from "../../../libs/content/assemblyUtils";

export interface AssemblyItem {
  id: string;
  data: AssemblyTableMetadata;
  draftData?: AssemblyTableMetadata;
  status: "published" | "draft" | "deleted";
  version?: number;
  publishedVersion?: number;
  updatedBy?: any;
  publishedBy?: any;
}

export function useAssemblyController(
  isActive: boolean,
  onNavigate?: (tab: any, param?: string) => void
) {
  const { pendingChanges, saveChangeToDraft, discardDraftChange } = useDraft();
  const [assemblyTables, setAssemblyTables] = useState<AssemblyItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  const loadAssembly = useCallback(async () => {
    setIsLoading(true);
    try {
      const snap = await getDocs(collection(db, "assembly"));
      const loaded: AssemblyItem[] = [];
      snap.forEach((d) => {
        const val = d.data();
        if (val.status === "deleted") return;

        const tableData: AssemblyTableMetadata = {
          title: val.title || d.id,
          semester: val.semester || d.id,
          order: typeof val.order === "number" ? val.order : 0,
          isUpcoming: Boolean(val.isUpcoming || d.id.toLowerCase() === "upcoming"),
          columns: Array.isArray(val.columns) ? val.columns : [],
          rows: Array.isArray(val.rows) ? val.rows : [],
          body: val.body || "",
          bodyJson: val.bodyJson || null,
          bodyHtml: val.bodyHtml || renderAssemblyTableHtml(val.columns || [], val.rows || []),
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

      // Sort ascending by order
      loaded.sort((a, b) => a.data.order - b.data.order);
      setAssemblyTables(loaded);
      setIsLoaded(true);
    } catch (err) {
      console.warn("Could not load assembly tables from Firestore:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isActive && !isLoaded && !isLoading) {
      loadAssembly();
    }
  }, [isActive, isLoaded, isLoading, loadAssembly]);

  const saveDraft = async (docId: string, data: AssemblyTableMetadata) => {
    // Generate fresh bodyHtml
    const bodyHtml = renderAssemblyTableHtml(data.columns, data.rows);
    const fullData: AssemblyTableMetadata = {
      ...data,
      bodyHtml,
      bodyJson: { columns: data.columns, rows: data.rows },
    };

    await saveChangeToDraft("assembly", docId, "update", fullData);
    if (onNavigate) onNavigate("assembly");
  };

  const deleteItem = async (id: string) => {
    await saveChangeToDraft("assembly", id, "delete");
  };

  const undoDelete = async (id: string) => {
    await discardDraftChange("assembly", id);
  };

  const reorderItems = async (reorderedList: AssemblyItem[]) => {
    const pastItems = reorderedList.filter((item) => {
      const activeData = item.draftData || item.data;
      return !(
        activeData.isUpcoming ||
        activeData.semester?.toLowerCase() === "upcoming" ||
        item.id.toLowerCase() === "upcoming"
      );
    });

    const upcomingItem = reorderedList.find((item) => {
      const activeData = item.draftData || item.data;
      return (
        activeData.isUpcoming ||
        activeData.semester?.toLowerCase() === "upcoming" ||
        item.id.toLowerCase() === "upcoming"
      );
    });

    if (upcomingItem) {
      const activeData = upcomingItem.draftData || upcomingItem.data;
      if (activeData.order !== 9999) {
        await saveChangeToDraft("assembly", upcomingItem.id, "update", {
          ...activeData,
          order: 9999,
        });
      }
    }

    // Top item on screen gets highest order number; bottom gets 1
    for (let i = 0; i < pastItems.length; i++) {
      const item = pastItems[i];
      const targetOrder = pastItems.length - i;
      const activeData = item.draftData || item.data;
      if (activeData.order !== targetOrder) {
        const updatedData: AssemblyTableMetadata = {
          ...activeData,
          order: targetOrder,
        };
        await saveChangeToDraft("assembly", item.id, "update", updatedData);
      }
    }
  };

  const mergedItems = useMemo(() => {
    const draftChanges = pendingChanges.filter((p) => p.collection === "assembly");
    const map = new Map<string, AssemblyItem>();
    assemblyTables.forEach((t) => map.set(t.id, { ...t }));

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
        const normalizedData: AssemblyTableMetadata = {
          title: rawData?.title || existing?.data?.title || draft.documentId,
          semester: rawData?.semester || existing?.data?.semester || draft.documentId,
          order: typeof rawData?.order === "number" ? rawData.order : existing?.data?.order || 0,
          isUpcoming: Boolean(
            rawData?.isUpcoming ?? existing?.data?.isUpcoming ?? draft.documentId.toLowerCase() === "upcoming"
          ),
          columns: rawData?.columns || existing?.data?.columns || [],
          rows: rawData?.rows || existing?.data?.rows || [],
          body: rawData?.body || existing?.data?.body || "",
          bodyJson: rawData?.bodyJson || existing?.data?.bodyJson,
          bodyHtml:
            rawData?.bodyHtml ||
            existing?.data?.bodyHtml ||
            renderAssemblyTableHtml(rawData?.columns || [], rawData?.rows || []),
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
    return sortAssemblyTables(result);
  }, [assemblyTables, pendingChanges]);

  return {
    items: mergedItems,
    isLoading,
    saveDraft,
    deleteItem,
    undoDelete,
    reorderItems,
    reload: loadAssembly,
  };
}
