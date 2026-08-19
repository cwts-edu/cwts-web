import React, { useState, useEffect, useCallback } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { DraftProvider, useDraft } from "./context/DraftContext";
import { AuthGate } from "./components/AuthGate";
import { AdminLayout, type AdminTab } from "./components/AdminLayout";
import { DashboardView } from "./views/DashboardView";
import { NewsListView, type NewsItem } from "./views/NewsListView";
import { NewsEditView } from "./views/NewsEditView";
import { JobsListView, type JobItem } from "./views/JobsListView";
import { JobsEditView } from "./views/JobsEditView";
import { db } from "./config/firebase";
import { collection, getDocs } from "firebase/firestore";
import type { NewsMetadata, JobMetadata } from "../libs/content/schemas";
import { INITIAL_NEWS_FIXTURES, INITIAL_JOBS_FIXTURES } from "./fixtures/initialContent";

const INITIAL_NEWS: NewsItem[] = INITIAL_NEWS_FIXTURES.map((item) => ({
  id: item.id,
  data: {
    title: item.data.title,
    date: new Date(item.data.date),
    thumbnail: item.data.thumbnail,
    url: item.data.url,
  },
  body: item.body,
  status: "published",
  version: 1,
  publishedVersion: 1,
}));

const INITIAL_JOBS: JobItem[] = INITIAL_JOBS_FIXTURES.map((item) => ({
  id: item.id,
  data: {
    title: item.data.title,
    location: item.data.location,
    date: new Date(item.data.date),
    ...(item.data.file ? { file: item.data.file } : {}),
  },
  body: item.body,
  status: "published",
  version: 1,
  publishedVersion: 1,
}));

const AdminDashboard: React.FC = () => {
  const { user } = useAuth();
  const { pendingChanges, saveChangeToDraft, discardDraftChange } = useDraft();

  const [currentTab, setCurrentTab] = useState<AdminTab>("dashboard");
  const [editingId, setEditingId] = useState<string | null>(null);

  const [news, setNews] = useState<NewsItem[]>(INITIAL_NEWS);
  const [jobs, setJobs] = useState<JobItem[]>(INITIAL_JOBS);
  const [isLoadingData, setIsLoadingData] = useState<boolean>(true);

  const loadData = useCallback(async () => {
    try {
      // 1. Fetch News (filter out soft-deleted items)
      const newsSnap = await getDocs(collection(db, "news"));
      if (!newsSnap.empty) {
        const loadedNews: NewsItem[] = [];
        newsSnap.forEach((d) => {
          const val = d.data();
          if (val.status === "deleted") return; // Ignore soft-deleted documents
          loadedNews.push({
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
        setNews(loadedNews);
      }

      // 2. Fetch Jobs (filter out soft-deleted items)
      const jobsSnap = await getDocs(collection(db, "jobs"));
      if (!jobsSnap.empty) {
        const loadedJobs: JobItem[] = [];
        jobsSnap.forEach((d) => {
          const val = d.data();
          if (val.status === "deleted") return; // Ignore soft-deleted documents
          loadedJobs.push({
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
        setJobs(loadedJobs);
      }
    } catch (err) {
      console.warn("Could not connect to live Firestore (using initial state):", err);
    } finally {
      setIsLoadingData(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleNavigate = (tab: AdminTab, param?: string) => {
    if (param) setEditingId(param);
    else setEditingId(null);
    setCurrentTab(tab);
  };

  // --------------------------------------------------------------------------
  // News Handlers (Draft Save & Soft Delete)
  // --------------------------------------------------------------------------
  const handleSaveNewsDraft = async (item: { id: string; data: NewsMetadata; body: string }) => {
    await saveChangeToDraft("news", item.id, "update", item.data, item.body);
    setCurrentTab("news");
    setEditingId(null);
  };

  const handleDeleteNews = async (id: string) => {
    const target = news.find((n) => n.id === id);
    if (target) {
      await saveChangeToDraft("news", id, "delete", target.data, target.body);
    }
  };

  const handleUndoDeleteNews = async (id: string) => {
    await discardDraftChange("news", id);
  };

  // --------------------------------------------------------------------------
  // Jobs Handlers (Draft Save & Soft Delete)
  // --------------------------------------------------------------------------
  const handleSaveJobDraft = async (item: { id: string; data: JobMetadata; body: string }) => {
    await saveChangeToDraft("jobs", item.id, "update", item.data, item.body);
    setCurrentTab("jobs");
    setEditingId(null);
  };

  const handleDeleteJob = async (id: string) => {
    const target = jobs.find((j) => j.id === id);
    if (target) {
      await saveChangeToDraft("jobs", id, "delete", target.data, target.body);
    }
  };

  const handleUndoDeleteJob = async (id: string) => {
    await discardDraftChange("jobs", id);
  };

  // Overlay active draft items into the view list for the editor
  const newsMap = new Map<string, NewsItem>(news.map((item) => [item.id, { ...item }]));
  const newsDraftChanges = pendingChanges.filter((p) => p.collection === "news");

  for (const draft of newsDraftChanges) {
    const existing = newsMap.get(draft.documentId);
    if (draft.action === "delete") {
      if (existing) {
        newsMap.set(draft.documentId, {
          ...existing,
          status: "deleted",
          updatedBy: draft.updatedBy,
        });
      }
    } else {
      newsMap.set(draft.documentId, {
        id: draft.documentId,
        data: draft.data as NewsMetadata,
        draftData: draft.data as NewsMetadata,
        body: draft.body,
        draftBody: draft.body,
        status: "draft",
        updatedBy: draft.updatedBy,
        version: existing ? (existing.version || 1) + 1 : 1,
        publishedVersion: existing?.publishedVersion,
      });
    }
  }
  const mergedNews = Array.from(newsMap.values());

  const jobsMap = new Map<string, JobItem>(jobs.map((item) => [item.id, { ...item }]));
  const jobsDraftChanges = pendingChanges.filter((p) => p.collection === "jobs");

  for (const draft of jobsDraftChanges) {
    const existing = jobsMap.get(draft.documentId);
    if (draft.action === "delete") {
      if (existing) {
        jobsMap.set(draft.documentId, {
          ...existing,
          status: "deleted",
          updatedBy: draft.updatedBy,
        });
      }
    } else {
      jobsMap.set(draft.documentId, {
        id: draft.documentId,
        data: draft.data as JobMetadata,
        draftData: draft.data as JobMetadata,
        body: draft.body,
        draftBody: draft.body,
        status: "draft",
        updatedBy: draft.updatedBy,
        version: existing ? (existing.version || 1) + 1 : 1,
        publishedVersion: existing?.publishedVersion,
      });
    }
  }
  const mergedJobs = Array.from(jobsMap.values());

  return (
    <AdminLayout currentTab={currentTab} onNavigate={handleNavigate}>
      {currentTab === "dashboard" && (
        <DashboardView
          onNavigate={handleNavigate}
          newsCount={mergedNews.filter((n) => n.status !== "deleted").length}
          jobsCount={mergedJobs.filter((j) => j.status !== "deleted").length}
          onRefreshData={loadData}
        />
      )}

      {currentTab === "news" && (
        <NewsListView
          items={mergedNews}
          onNew={() => handleNavigate("news_new")}
          onEdit={(id) => handleNavigate("news_edit", id)}
          onDelete={handleDeleteNews}
          onUndoDelete={handleUndoDeleteNews}
        />
      )}

      {currentTab === "news_new" && (
        <NewsEditView
          onSave={handleSaveNewsDraft}
          onCancel={() => handleNavigate("news")}
        />
      )}

      {currentTab === "news_edit" && (
        <NewsEditView
          initialItem={mergedNews.find((n) => n.id === editingId)}
          onSave={handleSaveNewsDraft}
          onCancel={() => handleNavigate("news")}
        />
      )}

      {currentTab === "jobs" && (
        <JobsListView
          items={mergedJobs}
          onNew={() => handleNavigate("jobs_new")}
          onEdit={(id) => handleNavigate("jobs_edit", id)}
          onDelete={handleDeleteJob}
          onUndoDelete={handleUndoDeleteJob}
        />
      )}

      {currentTab === "jobs_new" && (
        <JobsEditView
          onSave={handleSaveJobDraft}
          onCancel={() => handleNavigate("jobs")}
        />
      )}

      {currentTab === "jobs_edit" && (
        <JobsEditView
          initialItem={mergedJobs.find((j) => j.id === editingId)}
          onSave={handleSaveJobDraft}
          onCancel={() => handleNavigate("jobs")}
        />
      )}
    </AdminLayout>
  );
};

export const AdminApp: React.FC = () => {
  return (
    <AuthProvider>
      <AuthGate>
        <DraftProvider>
          <AdminDashboard />
        </DraftProvider>
      </AuthGate>
    </AuthProvider>
  );
};

export default AdminApp;
