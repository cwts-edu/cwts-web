import React, { createContext, useContext, useEffect, useState } from "react";
import { useAuth } from "./AuthContext";
import { db } from "../config/firebase";
import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  deleteDoc,
  writeBatch,
} from "firebase/firestore";
import {
  triggerNetlifyStagingPreview,
  triggerNetlifyProductionDeploy,
  type DeployTriggerResult,
} from "../services/netlifyDeploy";
import type { AuditUser } from "../../libs/content/types";
import { textLinesToHtml } from "../../libs/content/textUtils";

export interface DraftChangeItem {
  id: string; // docId
  collection: "news" | "jobs" | "faculty" | "pages";
  documentId: string;
  action: "create" | "update" | "delete";
  data: any;
  body?: string;
  bodyHtml?: string;
  updatedBy: AuditUser;
  updatedAt: string;
}

export interface ReleaseLogItem {
  releaseId: string;
  description?: string;
  publishedBy: AuditUser;
  changesCount: number;
  changesSummary: Array<{ collection: string; id: string; action: string; title?: string }>;
  publishedAt: string;
}

interface DraftContextValue {
  activeDraftId: string;
  draftDescription: string;
  setDraftDescription: (desc: string) => void;
  pendingChanges: DraftChangeItem[];
  isLoadingDraft: boolean;
  isStagingBuilding: boolean;
  stagingBuildCountdown: number | null;
  isProdDeploying: boolean;
  prodDeployCountdown: number | null;
  stagingUrl: string | null;
  statusMessage: string | null;
  saveChangeToDraft: (
    coll: "news" | "jobs" | "faculty" | "pages",
    docId: string,
    action: "create" | "update" | "delete",
    data: any,
    body?: string
  ) => Promise<void>;
  discardDraftChange: (coll: string, docId: string) => Promise<void>;
  discardEntireDraft: () => Promise<void>;
  triggerStagingPreview: () => Promise<DeployTriggerResult>;
  publishDraftToProduction: () => Promise<DeployTriggerResult>;
}

const DraftContext = createContext<DraftContextValue | null>(null);

export const DraftProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [activeDraftId, setActiveDraftId] = useState<string>("draft_workspace");
  const [draftDescription, setDraftDescription] = useState<string>("");
  const [pendingChanges, setPendingChanges] = useState<DraftChangeItem[]>([]);
  const [isLoadingDraft, setIsLoadingDraft] = useState<boolean>(true);
  
  const [isStagingBuilding, setIsStagingBuilding] = useState<boolean>(false);
  const [stagingBuildCountdown, setStagingBuildCountdown] = useState<number | null>(null);

  const [isProdDeploying, setIsProdDeploying] = useState<boolean>(false);
  const [prodDeployCountdown, setProdDeployCountdown] = useState<number | null>(null);

  const [stagingUrl, setStagingUrl] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    if (user?.uid) {
      const draftId = `draft_${user.uid.slice(0, 10)}`;
      setActiveDraftId(draftId);
      loadDraftWorkspace(draftId);
    } else {
      setIsLoadingDraft(false);
    }
  }, [user?.uid]);

  const loadDraftWorkspace = async (draftId: string) => {
    try {
      setIsLoadingDraft(true);
      
      // 1. Fetch draft root metadata
      const draftDoc = await getDoc(doc(db, "drafts", draftId));
      if (draftDoc.exists()) {
        const val = draftDoc.data();
        if (val.description) setDraftDescription(val.description);
        if (val.stagedDeployUrl) setStagingUrl(val.stagedDeployUrl);
      }

      // 2. Fetch changes subcollection
      const snap = await getDocs(collection(db, "drafts", draftId, "changes"));
      const items: DraftChangeItem[] = [];
      snap.forEach((d) => {
        const val = d.data();
        items.push({
          id: d.id,
          collection: val.collection,
          documentId: val.documentId,
          action: val.action || "update",
          data: val.data,
          body: val.body,
          bodyHtml: val.bodyHtml,
          updatedBy: val.updatedBy,
          updatedAt: val.updatedAt,
        });
      });

      setPendingChanges(items);
    } catch (err) {
      console.warn("Could not load draft workspace from Firestore:", err);
    } finally {
      setIsLoadingDraft(false);
    }
  };

  const getAuditUser = (): AuditUser => ({
    uid: user?.uid || "anonymous",
    email: user?.email || "unknown@cwts.edu",
    displayName: user?.displayName || user?.email || "CWTS Admin",
    photoURL: user?.photoURL || undefined,
    timestamp: new Date().toISOString(),
  });

  const saveChangeToDraft = async (
    coll: "news" | "jobs" | "faculty" | "pages",
    docId: string,
    action: "create" | "update" | "delete",
    data: any,
    body?: string
  ) => {
    const audit = getAuditUser();
    const changeItem: DraftChangeItem = {
      id: `${coll}_${docId}`,
      collection: coll,
      documentId: docId,
      action,
      data,
      body: body || "",
      bodyHtml: body || "",
      updatedBy: audit,
      updatedAt: new Date().toISOString(),
    };

    try {
      await setDoc(
        doc(db, "drafts", activeDraftId),
        {
          draftId: activeDraftId,
          description: draftDescription || `Draft updates by ${audit.email}`,
          author: audit,
          updatedAt: new Date().toISOString(),
          status: "active",
        },
        { merge: true }
      );

      await setDoc(doc(db, "drafts", activeDraftId, "changes", `${coll}_${docId}`), changeItem);
    } catch (err) {
      console.warn("Could not persist draft change to Firestore:", err);
    }

    setPendingChanges((prev) => {
      const idx = prev.findIndex((p) => p.collection === coll && p.documentId === docId);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = changeItem;
        return next;
      }
      return [changeItem, ...prev];
    });

    setStatusMessage(`Saved change to draft workspace.`);
  };

  const discardDraftChange = async (coll: string, docId: string) => {
    try {
      await deleteDoc(doc(db, "drafts", activeDraftId, "changes", `${coll}_${docId}`));
    } catch (err) {
      console.warn("Could not delete draft change in Firestore:", err);
    }

    setPendingChanges((prev) => prev.filter((p) => !(p.collection === coll && p.documentId === docId)));
  };

  const discardEntireDraft = async () => {
    try {
      const snap = await getDocs(collection(db, "drafts", activeDraftId, "changes"));
      const batch = writeBatch(db);
      snap.forEach((d) => batch.delete(d.ref));
      batch.delete(doc(db, "drafts", activeDraftId));
      await batch.commit();
    } catch (err) {
      console.warn("Could not clear draft in Firestore:", err);
    }

    setPendingChanges([]);
    setDraftDescription("");
    setStagingUrl(null);
    setStatusMessage("Draft workspace cleared.");
  };

  const triggerStagingPreview = async (): Promise<DeployTriggerResult> => {
    setIsStagingBuilding(true);
    setStagingBuildCountdown(45);
    setStatusMessage("Triggering Netlify staging deploy preview...");

    const audit = getAuditUser();

    // Save description to Firestore draft doc
    try {
      await setDoc(
        doc(db, "drafts", activeDraftId),
        { description: draftDescription },
        { merge: true }
      );
    } catch {}

    const result = await triggerNetlifyStagingPreview(activeDraftId, audit.email);

    if (result.success) {
      // 45-second timed progress countdown for Netlify build completion
      let count = 45;
      const interval = setInterval(() => {
        count -= 1;
        if (count <= 0) {
          clearInterval(interval);
          setStagingBuildCountdown(null);
          setIsStagingBuilding(false);
          setStagingUrl(result.stagingUrl || "https://cwts-staging.netlify.app");
          setStatusMessage("Staging Preview Ready!");
        } else {
          setStagingBuildCountdown(count);
          setStatusMessage(`Building Staging Preview (${count}s remaining)...`);
        }
      }, 1000);
    } else {
      setIsStagingBuilding(false);
      setStagingBuildCountdown(null);
      setStatusMessage(result.message);
    }

    return result;
  };

  const publishDraftToProduction = async (): Promise<DeployTriggerResult> => {
    const audit = getAuditUser();
    const releaseId = `rel_${Date.now()}`;
    setStatusMessage("Publishing changes to production...");
    setIsProdDeploying(true);
    setProdDeployCountdown(45);

    try {
      const batch = writeBatch(db);

      // 1. Merge each draft change into canonical collection and archive version snapshot
      for (const change of pendingChanges) {
        if (change.collection === "faculty" && change.documentId === "_order" && change.data?.orderMap) {
          for (const [id, newOrder] of Object.entries(change.data.orderMap)) {
            const facultyRef = doc(db, "faculty", id);
            batch.set(
              facultyRef,
              { order: Number(newOrder), updatedAt: new Date().toISOString() },
              { merge: true }
            );
          }
          continue;
        }

        const canonicalRef = doc(db, change.collection, change.documentId);
        
        let currentVer = 1;
        try {
          const snap = await getDoc(canonicalRef);
          if (snap.exists()) {
            currentVer = (snap.data()?.version || 1) + 1;
          }
        } catch {}

        let currentData = change.data;
        let currentBody = change.body;

        if (change.action === "delete") {
          // Soft delete in Canonical document
          batch.set(
            canonicalRef,
            {
              status: "deleted",
              version: currentVer,
              publishedVersion: currentVer,
              deletedBy: audit,
              deletedAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
            { merge: true }
          );

          // Create Immutable Version Snapshot marking status as deleted
          const versionRef = doc(db, change.collection, change.documentId, "versions", String(currentVer));
          batch.set(versionRef, {
            version: currentVer,
            status: "deleted",
            data: currentData || {},
            body: currentBody || "",
            deletedBy: audit,
            releaseId,
            releaseDescription: draftDescription,
            createdAt: new Date().toISOString(),
          });
        } else {
          const bodyHtml =
            change.bodyHtml ||
            (change.collection === "news" && change.body ? textLinesToHtml(change.body) : undefined);

          // Write Canonical document
          batch.set(canonicalRef, {
            ...change.data,
            body: change.body,
            ...(bodyHtml ? { bodyHtml } : {}),
            status: "published",
            version: currentVer,
            publishedVersion: currentVer,
            publishedBy: audit,
            publishedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });

          // Create Immutable Version Snapshot
          const versionRef = doc(db, change.collection, change.documentId, "versions", String(currentVer));
          batch.set(versionRef, {
            version: currentVer,
            status: "published",
            data: change.data,
            body: change.body,
            ...(bodyHtml ? { bodyHtml } : {}),
            publishedBy: audit,
            releaseId,
            releaseDescription: draftDescription,
            createdAt: new Date().toISOString(),
          });
        }
      }

      // 2. Write Release Log
      const releaseRef = doc(db, "releases", releaseId);
      batch.set(releaseRef, {
        releaseId,
        description: draftDescription || `Production release by ${audit.email}`,
        publishedBy: audit,
        changesCount: pendingChanges.length,
        changesSummary: pendingChanges.map((c) => ({
          collection: c.collection,
          id: c.documentId,
          action: c.action,
          title: c.data?.title || c.documentId,
        })),
        publishedAt: new Date().toISOString(),
      });

      // 3. Clear draft changes from workspace
      const draftChangesSnap = await getDocs(collection(db, "drafts", activeDraftId, "changes"));
      draftChangesSnap.forEach((d) => batch.delete(d.ref));
      batch.delete(doc(db, "drafts", activeDraftId));

      // Commit atomic batch
      await batch.commit();
    } catch (err: any) {
      console.error("Failed to commit publish batch to Firestore:", err);
    }

    // 4. Trigger Netlify Production Build Hook
    const deployResult = await triggerNetlifyProductionDeploy(releaseId, audit.email);

    // Timed countdown for production deployment
    let count = 45;
    const interval = setInterval(() => {
      count -= 1;
      if (count <= 0) {
        clearInterval(interval);
        setProdDeployCountdown(null);
        setIsProdDeploying(false);
        setStatusMessage("Successfully deployed to live production!");
      } else {
        setProdDeployCountdown(count);
        setStatusMessage(`Deploying to live production (${count}s remaining)...`);
      }
    }, 1000);

    setPendingChanges([]);
    setDraftDescription("");
    setStagingUrl(null);

    return deployResult;
  };

  return (
    <DraftContext.Provider
      value={{
        activeDraftId,
        draftDescription,
        setDraftDescription,
        pendingChanges,
        isLoadingDraft,
        isStagingBuilding,
        stagingBuildCountdown,
        isProdDeploying,
        prodDeployCountdown,
        stagingUrl,
        statusMessage,
        saveChangeToDraft,
        discardDraftChange,
        discardEntireDraft,
        triggerStagingPreview,
        publishDraftToProduction,
      }}
    >
      {children}
    </DraftContext.Provider>
  );
};

export const useDraft = () => {
  const context = useContext(DraftContext);
  if (!context) {
    throw new Error("useDraft must be used within a DraftProvider");
  }
  return context;
};
